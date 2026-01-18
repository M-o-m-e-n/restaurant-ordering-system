import { AppError, BadRequestError, UnauthorizedError, NotFoundError, ValidationError } from '../../src/utils/errors';

describe('Custom Errors', () => {
  describe('AppError', () => {
    it('should create an error with default values', () => {
      const error = new AppError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
    });

    it('should create an error with custom values', () => {
      const error = new AppError('Custom error', 400, true, 'CUSTOM_CODE');
      expect(error.message).toBe('Custom error');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
      expect(error.code).toBe('CUSTOM_CODE');
    });
  });

  describe('BadRequestError', () => {
    it('should create a 400 error', () => {
      const error = new BadRequestError('Bad request');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('BAD_REQUEST');
    });

    it('should use default message', () => {
      const error = new BadRequestError();
      expect(error.message).toBe('Bad Request');
    });
  });

  describe('UnauthorizedError', () => {
    it('should create a 401 error', () => {
      const error = new UnauthorizedError('Unauthorized');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('NotFoundError', () => {
    it('should create a 404 error', () => {
      const error = new NotFoundError('Not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });
  });

  describe('ValidationError', () => {
    it('should create a 422 error with errors object', () => {
      const errors = { email: ['Invalid email format'] };
      const error = new ValidationError('Validation failed', errors);
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.errors).toEqual(errors);
    });
  });
});

