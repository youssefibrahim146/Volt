import { GoogleGenerativeAI } from "@google/generative-ai";
import { PrismaClient } from "@prisma/client";
import { calculateDeviceCost } from "../utils.js";
import * as dotenv from "dotenv";

// Load environment variables first, before any other operations
dotenv.config();

const prisma = new PrismaClient();

// Verify environment variables immediately
if (!process.env.GOOGLE_API_KEY) {
  console.error("GOOGLE_API_KEY environment variable is not set");
  process.exit(1);
}

console.log(process.env.GOOGLE_API_KEY);

/**
 * Creates an instance of the Gemini model
 * @returns {Object} The configured Gemini model and generation config
 */
const createGeminiModel = () => {
  console.log("Starting createGeminiModel");

  const apiKey = process.env.GOOGLE_API_KEY;
  console.log("API Key present:", !!apiKey);

  // Validate API key
  if (!apiKey || typeof apiKey !== "string") {
    throw new Error("Invalid or missing GOOGLE_API_KEY environment variable");
  }

  // Clean and validate the API key
  const cleanedApiKey = apiKey.toString().trim();
  if (cleanedApiKey === "") {
    throw new Error("GOOGLE_API_KEY cannot be empty");
  }

  // Get optional configuration from environment variables or use defaults
  let modelName = process.env.GEMINI_MODEL_NAME || "gemini-1.5-flash";

  // Fix common model name format issues
  // Replace spaces with hyphens and ensure lowercase
  modelName = modelName.toLowerCase().replace(/\s+/g, "-");

  // Handle specific model name mappings
  const modelMappings = {
    "gemini-1.5-flash-8b": "gemini-1.5-flash",
  };

  if (modelMappings[modelName]) {
    modelName = modelMappings[modelName];
  }

  const maxTokens = parseInt(process.env.GEMINI_MAX_TOKENS, 10) || 2048;
  const temp = parseFloat(process.env.GEMINI_TEMPERATURE) || 0.2;

  console.log("Creating Gemini model with config:", {
    modelName,
    maxTokens,
    temp,
  });

  console.log("Using normalized model name:", modelName);

  try {
    // Initialize the Google Generative AI client
    const genAI = new GoogleGenerativeAI(cleanedApiKey);

    // Get the model
    const model = genAI.getGenerativeModel({
      model: modelName,
    });

    // Create generation config
    const generationConfig = {
      maxOutputTokens: maxTokens,
      temperature: temp,
    };

    console.log("Successfully created Gemini model");

    return { model, generationConfig };
  } catch (error) {
    console.error("Error creating Gemini model:", error);
    throw new Error(`Failed to initialize AI model: ${error.message}`);
  }
};

/**
 * Creates a recommendation prompt with the given data
 * @param {Object} data - The data to include in the prompt
 * @returns {string} The formatted prompt
 */
const createRecommendationPrompt = (data) => {
  return `
You are an AI assistant for an electricity management application called SmartWatt.

The user has the following information:
- Total monthly budget: ${data.budget} units
- Used budget: ${data.usedBudget} units
- Remaining budget: ${data.remainingBudget} units
- Current devices: ${data.currentDevices}

The user is looking for personalized recommendations to optimize their electricity usage.
Available devices that could fit in their budget: ${data.availableDevices}

Based on their current devices and usage patterns, recommend up to 3 devices they should consider adding.
For each recommendation, explain why it would be beneficial for their specific situation
(e.g., energy efficiency, complementary to existing devices, better value).
Also provide energy-saving tips specific to their device collection.

Format your response as a JSON object with the following structure:
{
  "deviceRecommendations": [
    {
      "deviceId": number,
      "deviceName": string,
      "recommendedWattage": number,
      "reasonForRecommendation": string,
      "estimatedMonthlyCost": number,
      "estimatedSavings": number
    }
  ],
  "energySavingTips": [
    {
      "tip": string,
      "potentialSavings": string,
      "relevantDevices": string[]
    }
  ]
}
`;
};

/**
 * Gets AI-powered device recommendations for a user
 * @param {Object} options - The options for generating recommendations
 * @param {number} options.userId - The ID of the user
 * @param {number} [options.costPerKWh=0.68] - The cost per kilowatt-hour
 * @returns {Promise<Object>} The recommendations and energy saving tips
 */
export const getAIRecommendations = async ({ userId, costPerKWh = 0.68 }) => {
  try {
    // Get user data
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Get user's current devices
    const userDevices = await prisma.userHomeDevice.findMany({
      where: { userId },
      include: {
        systemDevice: true,
      },
    });

    // Get all available devices
    const allDevices = await prisma.systemDevice.findMany();

    // Filter devices that fit within remaining budget
    const remainingBudget = user.budget - user.minBudget;
    const availableDevices = allDevices
      .filter((device) => {
        // Find the lowest wattage option that fits the budget
        const affordableWattOptions = device.wattsOptions.filter((watts) => {
          const dailyCost = calculateDeviceCost(
            watts,
            device.deviceWorkAllDay ? 24 : 8,
            costPerKWh
          );
          return dailyCost * 30 <= remainingBudget;
        });
        return affordableWattOptions.length > 0;
      })
      .map((device) => {
        // Find the most affordable wattage option
        const affordableWattage = Math.min(
          ...device.wattsOptions.filter((watts) => {
            const dailyCost = calculateDeviceCost(
              watts,
              device.deviceWorkAllDay ? 24 : 8,
              costPerKWh
            );
            return dailyCost * 30 <= remainingBudget;
          })
        );
        return {
          ...device,
          affordableWattage,
        };
      });

    // Format current devices for the prompt
    const formattedCurrentDevices = userDevices.map((device) => ({
      id: device.systemDeviceId,
      name: device.systemDevice.name,
      wattage: device.chosenWatts,
      workHours: device.userInputWorkTime,
      isAllDay: device.systemDevice.deviceWorkAllDay,
      monthlyCost:
        calculateDeviceCost(
          device.chosenWatts,
          device.systemDevice.deviceWorkAllDay ? 24 : device.userInputWorkTime,
          costPerKWh
        ) * 30,
    }));

    // Format available devices for the prompt
    const formattedAvailableDevices = availableDevices.map((device) => ({
      id: device.id,
      name: device.name,
      affordableWattage: device.affordableWattage,
      isAllDay: device.deviceWorkAllDay,
      monthlyCost:
        calculateDeviceCost(
          device.affordableWattage,
          device.deviceWorkAllDay ? 24 : 8,
          costPerKWh
        ) * 30,
    }));

    // Create the model
    const { model, generationConfig } = createGeminiModel();

    // Create prompt with data
    const promptData = {
      budget: user.budget,
      usedBudget: user.minBudget,
      remainingBudget,
      currentDevices: JSON.stringify(formattedCurrentDevices),
      availableDevices: JSON.stringify(formattedAvailableDevices),
    };

    const prompt = createRecommendationPrompt(promptData);

    // Generate content
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
    });

    // Extract the response text
    const responseText = result.response.text();

    // Parse the result
    let parsedResult;
    try {
      // Clean the response text to handle Markdown code blocks
      let cleanedResponseText = responseText;

      // Check if the response starts with markdown code fences
      const jsonCodeBlockMatch = responseText.match(
        /```(?:json)?\s*([\s\S]*?)```/
      );
      if (jsonCodeBlockMatch && jsonCodeBlockMatch[1]) {
        cleanedResponseText = jsonCodeBlockMatch[1].trim();
      }

      parsedResult = JSON.parse(cleanedResponseText);

      // Do some validation on the parsed result
      if (
        !parsedResult.deviceRecommendations ||
        !Array.isArray(parsedResult.deviceRecommendations)
      ) {
        throw new Error("Invalid response format");
      }

      // Enrich the recommendations with additional data
      parsedResult.deviceRecommendations =
        parsedResult.deviceRecommendations.map((rec) => {
          const device = availableDevices.find((d) => d.id === rec.deviceId);
          return {
            ...rec,
            deviceImage: device?.img || null,
            wattsOptions: device?.wattsOptions || [],
            deviceWorkAllDay: device?.deviceWorkAllDay || false,
          };
        });

      return {
        recommendations: parsedResult.deviceRecommendations,
        energySavingTips: parsedResult.energySavingTips,
        budget: {
          total: user.budget,
          used: user.minBudget,
          remaining: remainingBudget,
        },
      };
    } catch (error) {
      console.error("Error parsing AI response:", error);
      // Fallback to rule-based recommendations
      return getFallbackRecommendations({ userId, costPerKWh });
    }
  } catch (error) {
    console.error("Error generating AI recommendations:", error);
    // Fallback to rule-based recommendations
    return getFallbackRecommendations({ userId, costPerKWh });
  }
};

/**
 * Gets fallback recommendations when AI recommendations fail
 * @param {Object} options - The options for generating recommendations
 * @param {number} options.userId - The ID of the user
 * @param {number} [options.costPerKWh=0.68] - The cost per kilowatt-hour
 * @returns {Promise<Object>} The recommendations
 */
const getFallbackRecommendations = async ({ userId, costPerKWh = 0.68 }) => {
  // This is a simplified version of the existing recommendation system
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const allDevices = await prisma.systemDevice.findMany();

    // Filter devices that fit within remaining budget
    const remainingBudget = user.budget - user.minBudget;
    const recommendedDevices = allDevices
      .filter((device) => {
        // Find the lowest wattage option that fits the budget
        const affordableWattOptions = device.wattsOptions.filter((watts) => {
          const dailyCost = calculateDeviceCost(
            watts,
            device.deviceWorkAllDay ? 24 : 8,
            costPerKWh
          );
          return dailyCost * 30 <= remainingBudget;
        });
        return affordableWattOptions.length > 0;
      })
      .slice(0, 3); // Limit to 3 recommendations

    // Format the recommendations
    const recommendations = recommendedDevices.map((device) => {
      const affordableWattage = Math.min(
        ...device.wattsOptions.filter((watts) => {
          const dailyCost = calculateDeviceCost(
            watts,
            device.deviceWorkAllDay ? 24 : 8,
            costPerKWh
          );
          return dailyCost * 30 <= remainingBudget;
        })
      );

      return {
        deviceId: device.id,
        deviceName: device.name,
        deviceImage: device.img,
        recommendedWattage: affordableWattage,
        wattsOptions: device.wattsOptions,
        deviceWorkAllDay: device.deviceWorkAllDay,
        reasonForRecommendation:
          "This device fits within your remaining budget",
        estimatedMonthlyCost:
          calculateDeviceCost(
            affordableWattage,
            device.deviceWorkAllDay ? 24 : 8,
            costPerKWh
          ) * 30,
        estimatedSavings: 0, // No specific savings calculated for fallback
      };
    });

    // Generic energy saving tips
    const energySavingTips = [
      {
        tip: "Turn off devices when not in use",
        potentialSavings: "Up to 10% on your electricity bill",
        relevantDevices: [],
      },
      {
        tip: "Use energy-efficient settings on your appliances",
        potentialSavings: "5-15% on device-specific consumption",
        relevantDevices: [],
      },
      {
        tip: "Consider upgrading to energy-efficient models for frequently used devices",
        potentialSavings: "Up to 30% on specific device consumption",
        relevantDevices: [],
      },
    ];

    return {
      recommendations,
      energySavingTips,
      budget: {
        total: user.budget,
        used: user.minBudget,
        remaining: remainingBudget,
      },
    };
  } catch (error) {
    console.error("Error generating fallback recommendations:", error);
    throw error;
  }
};

/**
 * Gets device-specific energy-saving tips
 * @param {Object} options - The options for generating tips
 * @param {number} options.deviceId - The ID of the device
 * @returns {Promise<Object>} The device-specific tips
 */
export const getDeviceEnergyTips = async ({ deviceId }) => {
  try {
    const parsedDeviceId = Number(deviceId);
    if (isNaN(parsedDeviceId)) {
      throw new Error("Invalid device ID provided");
    }

    const device = await prisma.systemDevice.findUnique({
      where: { id: parsedDeviceId },
    });

    if (!device) {
      throw new Error("Device not found");
    }

    // Create the model
    const { model, generationConfig } = createGeminiModel();

    // Create prompt for device tips
    const prompt = `
You are an energy efficiency expert for an electricity management application.
Provide detailed energy-saving tips for a specific device: ${device.name}.
The device has the following specifications:
- Wattage options: ${JSON.stringify(device.wattsOptions)}
- Works all day: ${device.deviceWorkAllDay}

Provide 5 specific, actionable tips to reduce energy consumption for this device.
For each tip, include:
1. A clear, concise description of what to do
2. An estimate of potential energy savings (percentage or kWh)
3. Difficulty level to implement (Easy, Medium, Hard)
4. Any additional benefits (comfort, device longevity, etc.)

Format your response as a JSON array:
[
  {
    "tip": string,
    "potentialSavings": string,
    "difficultyLevel": string,
    "additionalBenefits": string
  }
]
`;

    // Generate content
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
    });

    // Extract the response text
    const responseText = result.response.text();

    // Parse the result
    try {
      // Clean the response text to handle Markdown code blocks
      let cleanedResponseText = responseText;

      // Check if the response starts with markdown code fences
      const jsonCodeBlockMatch = responseText.match(
        /```(?:json)?\s*([\s\S]*?)```/
      );
      if (jsonCodeBlockMatch && jsonCodeBlockMatch[1]) {
        cleanedResponseText = jsonCodeBlockMatch[1].trim();
      }

      const parsedResult = JSON.parse(cleanedResponseText);
      return {
        device,
        tips: parsedResult,
      };
    } catch (error) {
      console.error("Error parsing device tips:", error);
      // Return fallback tips
      return {
        device,
        tips: getFallbackDeviceTips(device),
      };
    }
  } catch (error) {
    console.error("Error generating device energy tips:", error);
    throw error;
  }
};

/**
 * Gets fallback device-specific tips when AI tips fail
 * @param {Object} device - The device object
 * @returns {Array} Array of fallback tips
 */
const getFallbackDeviceTips = (device) => {
  const genericTips = [
    {
      tip: `Use ${device.name} during off-peak hours when electricity rates are lower`,
      potentialSavings: "10-15% cost reduction",
      difficultyLevel: "Easy",
      additionalBenefits: "Helps balance the electrical grid",
    },
    {
      tip: `Choose the lowest wattage setting that meets your needs for ${device.name}`,
      potentialSavings: "5-20% energy reduction",
      difficultyLevel: "Easy",
      additionalBenefits: "Extends device lifespan",
    },
    {
      tip: `Perform regular maintenance on your ${device.name} to ensure optimal efficiency`,
      potentialSavings: "Up to 10% energy savings",
      difficultyLevel: "Medium",
      additionalBenefits: "Improves performance and extends lifespan",
    },
    {
      tip: device.deviceWorkAllDay
        ? `Consider using a smart plug to control your ${device.name} and reduce standby power consumption`
        : `Turn off your ${device.name} completely when not in use rather than leaving it in standby mode`,
      potentialSavings: "3-10% energy savings",
      difficultyLevel: "Easy",
      additionalBenefits: "Reduces vampire power draw",
    },
    {
      tip: `Consider upgrading to a more energy-efficient ${device.name} if yours is over 10 years old`,
      potentialSavings: "Up to 30% energy reduction with newer models",
      difficultyLevel: "Hard",
      additionalBenefits: "Access to newer features and improved performance",
    },
  ];

  return genericTips;
};
