import { Router } from 'express';
import { deliveryController } from '../controllers/delivery.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import validate from '../middlewares/validate.middleware';
import {
  assignDriverSchema,
  updateDeliveryStatusSchema,
  updateDriverLocationSchema,
  updateDriverAvailabilitySchema,
  createDriverProfileSchema,
} from '../validators/delivery.validator';

const router = Router();

// All delivery routes require authentication
router.use(authenticate);

// ==================== DRIVER ROUTES ====================

// Create driver profile (any authenticated user)
router.post(
  '/drivers/profile',
  validate(createDriverProfileSchema),
  deliveryController.createDriverProfile
);

// Get available drivers (staff/admin only)
router.get(
  '/drivers/available',
  authorize('STAFF', 'ADMIN'),
  deliveryController.getAvailableDrivers
);

// Update driver availability (driver only)
router.patch(
  '/drivers/availability',
  authorize('DRIVER'),
  validate(updateDriverAvailabilitySchema),
  deliveryController.updateDriverAvailability
);

// Get driver's active delivery (driver only)
router.get(
  '/drivers/active',
  authorize('DRIVER'),
  deliveryController.getActiveDelivery
);

// Update driver location (driver only)
router.post(
  '/location',
  authorize('DRIVER'),
  validate(updateDriverLocationSchema),
  deliveryController.updateDriverLocation
);

// ==================== DELIVERY MANAGEMENT ROUTES ====================

// Assign driver to order (staff/admin only)
router.post(
  '/assign/:orderId',
  authorize('STAFF', 'ADMIN'),
  validate(assignDriverSchema),
  deliveryController.assignDriver
);

// Get deliveries with filtering (staff/admin/driver)
router.get(
  '/',
  authorize('STAFF', 'ADMIN', 'DRIVER'),
  deliveryController.getDeliveries
);

// Get delivery by ID
router.get('/:deliveryId', deliveryController.getDeliveryById);

// Update delivery status (driver/staff/admin)
router.patch(
  '/:deliveryId/status',
  authorize('DRIVER', 'STAFF', 'ADMIN'),
  validate(updateDeliveryStatusSchema),
  deliveryController.updateDeliveryStatus
);

export default router;

