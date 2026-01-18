import Twilio from 'twilio';
import config from './index';
import { logger } from './logger';

let twilioClient: Twilio.Twilio | null = null;

export const initializeTwilio = (): Twilio.Twilio | null => {
  if (!config.twilio.accountSid || !config.twilio.authToken) {
    logger.warn('Twilio credentials not configured. SMS notifications will be disabled.');
    return null;
  }

  if (!twilioClient) {
    try {
      twilioClient = Twilio(config.twilio.accountSid, config.twilio.authToken);
      logger.info('Twilio initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Twilio:', error);
      return null;
    }
  }

  return twilioClient;
};

export const getTwilioClient = (): Twilio.Twilio | null => {
  if (!twilioClient) {
    initializeTwilio();
  }
  return twilioClient;
};

export default { initializeTwilio, getTwilioClient };

