import admin from 'firebase-admin';
import config from './index';
import { logger } from './logger';

let firebaseApp: admin.app.App | null = null;

export const initializeFirebase = (): admin.app.App | null => {
  if (!config.firebase.projectId || !config.firebase.privateKey || !config.firebase.clientEmail) {
    logger.warn('Firebase credentials not configured. Push notifications will be disabled.');
    return null;
  }

  if (!firebaseApp) {
    try {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: config.firebase.projectId,
          privateKey: config.firebase.privateKey,
          clientEmail: config.firebase.clientEmail,
        }),
      });
      logger.info('Firebase initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Firebase:', error);
      return null;
    }
  }

  return firebaseApp;
};

export const getMessaging = (): admin.messaging.Messaging | null => {
  if (!firebaseApp) {
    initializeFirebase();
  }
  return firebaseApp ? admin.messaging(firebaseApp) : null;
};

export default { initializeFirebase, getMessaging };

