
import express from 'express';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import morgan from 'morgan';
import cors from 'cors';
import helmet from 'helmet';
import 'express-async-errors';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

app.use(express.json());      
app.use(morgan('dev'));         
app.use(cors());                
app.use(helmet());          

app.get('/', (req, res) => {
  res.json({ message: 'API is running' });
});

app.get('/users', async (req, res) => {
  const users = await prisma.user.findMany();
  res.json(users);
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
