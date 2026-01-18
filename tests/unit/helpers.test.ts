import { generateOrderNumber, generateOTP, calculateDistance, parsePagination, formatPrice, sanitizeObject } from '../../src/utils/helpers';

describe('Helpers', () => {
  describe('generateOrderNumber', () => {
    it('should generate a unique order number', () => {
      const orderNumber = generateOrderNumber();
      expect(orderNumber).toMatch(/^ORD-[A-Z0-9]+-[A-Z0-9]+$/);
    });

    it('should generate different order numbers', () => {
      const orderNumber1 = generateOrderNumber();
      const orderNumber2 = generateOrderNumber();
      expect(orderNumber1).not.toBe(orderNumber2);
    });
  });

  describe('generateOTP', () => {
    it('should generate a 6-digit OTP by default', () => {
      const otp = generateOTP();
      expect(otp).toHaveLength(6);
      expect(otp).toMatch(/^\d{6}$/);
    });

    it('should generate OTP with custom length', () => {
      const otp = generateOTP(4);
      expect(otp).toHaveLength(4);
      expect(otp).toMatch(/^\d{4}$/);
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance between two coordinates', () => {
      // New York to Los Angeles (approximately 3944 km)
      const distance = calculateDistance(40.7128, -74.0060, 34.0522, -118.2437);
      expect(distance).toBeGreaterThan(3900);
      expect(distance).toBeLessThan(4000);
    });

    it('should return 0 for same coordinates', () => {
      const distance = calculateDistance(40.7128, -74.0060, 40.7128, -74.0060);
      expect(distance).toBe(0);
    });
  });

  describe('parsePagination', () => {
    it('should use default values when not provided', () => {
      const result = parsePagination();
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.skip).toBe(0);
      expect(result.take).toBe(10);
    });

    it('should parse string values', () => {
      const result = parsePagination('2', '20');
      expect(result.page).toBe(2);
      expect(result.limit).toBe(20);
      expect(result.skip).toBe(20);
      expect(result.take).toBe(20);
    });

    it('should enforce minimum page of 1', () => {
      const result = parsePagination('0', '10');
      expect(result.page).toBe(1);
    });

    it('should enforce maximum limit of 100', () => {
      const result = parsePagination('1', '200');
      expect(result.limit).toBe(100);
    });
  });

  describe('formatPrice', () => {
    it('should format number to 2 decimal places', () => {
      expect(formatPrice(10)).toBe('10.00');
      expect(formatPrice(10.5)).toBe('10.50');
      expect(formatPrice(10.567)).toBe('10.57');
    });

    it('should handle string input', () => {
      expect(formatPrice('10.5')).toBe('10.50');
    });
  });

  describe('sanitizeObject', () => {
    it('should remove undefined and null values', () => {
      const obj = { a: 1, b: undefined, c: null, d: 'test' };
      const result = sanitizeObject(obj);
      expect(result).toEqual({ a: 1, d: 'test' });
    });

    it('should keep falsy values that are not undefined/null', () => {
      const obj = { a: 0, b: '', c: false };
      const result = sanitizeObject(obj);
      expect(result).toEqual({ a: 0, b: '', c: false });
    });
  });
});

