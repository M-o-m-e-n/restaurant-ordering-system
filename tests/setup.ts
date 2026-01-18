import { PrismaClient } from '@prisma/client';

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-v4'),
}));

// Mock Redis
jest.mock('../src/config/redis', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    keys: jest.fn(),
    lpop: jest.fn(),
    rpush: jest.fn(),
    llen: jest.fn(),
    quit: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
  },
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    keys: jest.fn(),
    lpop: jest.fn(),
    rpush: jest.fn(),
    llen: jest.fn(),
    quit: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
  },
}));

// Mock Firebase
jest.mock('../src/config/firebase', () => ({
  initializeFirebase: jest.fn(),
  getMessaging: jest.fn().mockReturnValue(null),
}));

// Mock Twilio
jest.mock('../src/config/twilio', () => ({
  initializeTwilio: jest.fn(),
  getTwilioClient: jest.fn().mockReturnValue(null),
}));

// Global test setup
beforeAll(async () => {
  // Setup test database or mocks
});

afterAll(async () => {
  // Cleanup
});

// Increase timeout for integration tests
jest.setTimeout(30000);

