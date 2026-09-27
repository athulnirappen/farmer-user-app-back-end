import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import router from './routes/index.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import { rateLimitMiddleware } from './middleware/rate-limit.middleware.js';
import { API_PREFIX, CORS_OPTIONS } from './config/constants.js';
import { AppError } from './shared/errors/app-error.js';
import pinoHttp from 'pino-http';
import { logger } from './config/logger.js';

const app = express();

app.use(pinoHttp({ logger }));

// Security Middlewares
app.use(helmet());
app.use(cors(CORS_OPTIONS));

// Request Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global Rate Limiter
app.use(rateLimitMiddleware);

// API Routes
app.use(API_PREFIX, router);

// Handle 404 errors
app.use((req, res, next) => {
  next(new AppError(`Route ${req.method} ${req.originalUrl} not found`, 404));
});

// Global Error Handler
app.use(errorMiddleware);

export default app;
