import { getMessaging } from '../config/firebase';
import { getTwilioClient } from '../config/twilio';
import config from '../config';
import { logger } from '../config/logger';
import prisma from '../config/database';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export class NotificationService {
  /**
   * Send push notification via Firebase Cloud Messaging
   */
  async sendPushNotification(
    fcmToken: string,
    payload: NotificationPayload
  ): Promise<boolean> {
    const messaging = getMessaging();

    if (!messaging) {
      logger.warn('Firebase not configured, skipping push notification');
      return false;
    }

    try {
      await messaging.send({
        token: fcmToken,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data,
      });
      logger.info(`Push notification sent to ${fcmToken.substring(0, 10)}...`);
      return true;
    } catch (error: any) {
      logger.error('Failed to send push notification:', error);

      // Handle invalid token
      if (error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered') {
        // Token is invalid, could remove from database
        logger.warn('Invalid FCM token, should be removed');
      }

      return false;
    }
  }

  /**
   * Send push notification to user by ID
   */
  async sendPushToUser(
    userId: string,
    payload: NotificationPayload
  ): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });

    if (!user?.fcmToken) {
      logger.debug(`User ${userId} has no FCM token`);
      return false;
    }

    return this.sendPushNotification(user.fcmToken, payload);
  }

  /**
   * Send SMS via Twilio
   */
  async sendSMS(to: string, message: string): Promise<boolean> {
    const client = getTwilioClient();

    if (!client) {
      logger.warn('Twilio not configured, skipping SMS');
      return false;
    }

    try {
      await client.messages.create({
        body: message,
        from: config.twilio.phoneNumber,
        to,
      });
      logger.info(`SMS sent to ${to}`);
      return true;
    } catch (error) {
      logger.error('Failed to send SMS:', error);
      return false;
    }
  }

  /**
   * Send SMS to user by ID
   */
  async sendSMSToUser(userId: string, message: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });

    if (!user?.phone) {
      logger.debug(`User ${userId} has no phone number`);
      return false;
    }

    return this.sendSMS(user.phone, message);
  }

  // ==================== ORDER NOTIFICATIONS ====================

  /**
   * Notify customer about order status change
   */
  async notifyOrderStatusChange(
    orderId: string,
    status: string,
    userId: string
  ): Promise<void> {
    const statusMessages: Record<string, string> = {
      CONFIRMED: 'Your order has been confirmed and is being prepared.',
      PREPARING: 'Your order is being prepared.',
      ON_THE_WAY: 'Your order is on the way!',
      DELIVERED: 'Your order has been delivered. Enjoy!',
      CANCELLED: 'Your order has been cancelled.',
    };

    const message = statusMessages[status] || `Order status updated to ${status}`;

    // Send push notification
    await this.sendPushToUser(userId, {
      title: 'Order Update',
      body: message,
      data: {
        type: 'order_status',
        orderId,
        status,
      },
    });
  }

  /**
   * Notify restaurant about new order
   */
  async notifyNewOrder(
    orderId: string,
    orderNumber: string,
    restaurantId: string
  ): Promise<void> {
    // Get restaurant staff
    const staff = await prisma.user.findMany({
      where: {
        restaurants: { some: { id: restaurantId } },
        role: { in: ['STAFF', 'ADMIN'] },
        fcmToken: { not: null },
      },
      select: { fcmToken: true },
    });

    // Send notifications to all staff
    for (const member of staff) {
      if (member.fcmToken) {
        await this.sendPushNotification(member.fcmToken, {
          title: 'New Order',
          body: `New order #${orderNumber} received`,
          data: {
            type: 'new_order',
            orderId,
            orderNumber,
          },
        });
      }
    }
  }

  /**
   * Notify driver about new delivery assignment
   */
  async notifyDriverAssignment(
    deliveryId: string,
    orderId: string,
    driverId: string
  ): Promise<void> {
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      include: {
        user: { select: { fcmToken: true } },
      },
    });

    if (driver?.user.fcmToken) {
      await this.sendPushNotification(driver.user.fcmToken, {
        title: 'New Delivery',
        body: 'You have been assigned a new delivery',
        data: {
          type: 'delivery_assigned',
          deliveryId,
          orderId,
        },
      });
    }
  }

  /**
   * Send OTP via SMS
   */
  async sendOTP(phone: string, otp: string): Promise<boolean> {
    const message = `Your Restaurant App verification code is: ${otp}. Valid for 15 minutes.`;
    return this.sendSMS(phone, message);
  }

  /**
   * Send order confirmation SMS
   */
  async sendOrderConfirmationSMS(
    phone: string,
    orderNumber: string
  ): Promise<boolean> {
    const message = `Your order #${orderNumber} has been confirmed. We'll notify you when it's on the way!`;
    return this.sendSMS(phone, message);
  }
}

export const notificationService = new NotificationService();
export default notificationService;

