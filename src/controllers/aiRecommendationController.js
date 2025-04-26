import { formatResponse } from "../utils.js";
import {
  getAIRecommendations,
  getDeviceEnergyTips,
} from "../services/aiRecommendationService.js";

/**
 * Get AI-powered device recommendations for a user
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
export async function getAIDeviceRecommendations(req, res) {
  try {
    const userId = req.user.id;
    const { costPerKWh = 0.68 } = req.query;

    const result = await getAIRecommendations({
      userId,
      costPerKWh: Number(costPerKWh),
    });

    return formatResponse(
      res,
      200,
      "AI recommendations retrieved successfully",
      result
    );
  } catch (error) {
    console.error("Error in AI recommendation controller:", error);
    return formatResponse(
      res,
      500,
      "Failed to retrieve AI recommendations",
      null,
      false
    );
  }
}

/**
 * Get device-specific energy-saving tips
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
export async function getDeviceSpecificTips(req, res) {
  try {
    const { deviceId } = req.params;
    if (!deviceId) {
      return formatResponse(res, 400, "Device ID is required", null, false);
    }

    const result = await getDeviceEnergyTips({ deviceId: Number(deviceId) });

    return formatResponse(
      res,
      200,
      "Device tips retrieved successfully",
      result
    );
  } catch (error) {
    console.error("Error retrieving device tips:", error);
    return formatResponse(
      res,
      500,
      "Failed to retrieve device tips",
      null,
      false
    );
  }
}

/**
 * Analyze user consumption patterns and provide efficiency insights
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
export async function analyzeConsumptionPatterns(req, res) {
  try {
    const userId = req.user.id;

    return formatResponse(
      res,
      200,
      "Consumption analysis not yet implemented",
      {
        message: "This feature will be available in a future update",
      }
    );
  } catch (error) {
    console.error("Error analyzing consumption patterns:", error);
    return formatResponse(
      res,
      500,
      "Failed to analyze consumption patterns",
      null,
      false
    );
  }
}
