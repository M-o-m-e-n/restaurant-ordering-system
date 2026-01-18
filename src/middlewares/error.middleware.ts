import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../utils/errors';
import { logger } from '../config/logger';
import config from '../config';

interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    errors?: Record<string, string[]>;
    stack?: string;
  };
}

/**
 * Global error handler middleware
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log error
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    user: req.user?.userId,
  });

  // Default error response
  const response: ErrorResponse = {
    success: false,
    error: {
      message: 'Internal Server Error',
    },
  };

  let statusCode = 500;

  // Handle AppError
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    response.error.message = err.message;
    response.error.code = err.code;

    // Include validation errors if present
    if (err instanceof ValidationError) {
      response.error.errors = err.errors;
    }
  }

  // Handle Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as any;
    switch (prismaError.code) {
      case 'P2002':
        statusCode = 409;
        response.error.message = 'A record with this value already exists';
        response.error.code = 'DUPLICATE_ENTRY';
        break;
      case 'P2025':
        statusCode = 404;
        response.error.message = 'Record not found';
        response.error.code = 'NOT_FOUND';
        break;
      default:
        response.error.message = 'Database error';
        response.error.code = 'DATABASE_ERROR';
    }
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    const zodError = err as any;
    statusCode = 422;
    response.error.message = 'Validation Error';
    response.error.code = 'VALIDATION_ERROR';
    response.error.errors = zodError.errors.reduce((acc: Record<string, string[]>, e: any) => {
      const path = e.path.join('.');
      if (!acc[path]) acc[path] = [];
      acc[path].push(e.message);
      return acc;
    }, {});
  }

  // Include stack trace in development
  if (config.nodeEnv === 'development') {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  res.status(404).json({
    success: false,
    error: {
      message: `Route ${req.method} ${req.path} not found`,
      code: 'ROUTE_NOT_FOUND',
    },
  });
};

/**
 * Async handler wrapper to catch errors
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default { errorHandler, notFoundHandler, asyncHandler };

