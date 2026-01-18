import { Router } from 'express';
import { orderController } from '../controllers/order.controller';
import { syncController } from '../controllers/sync.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import validate from '../middlewares/validate.middleware';
import {
  addToCartSchema,
  updateCartItemSchema,
  createOrderSchema,
  updateOrderStatusSchema,
  syncOrdersSchema,
} from '../validators/order.validator';

const router = Router();

// All order routes require authentication
router.use(authenticate);

// ==================== CART ROUTES ====================

router.get('/cart', orderController.getCart);

router.post('/cart', validate(addToCartSchema), orderController.addToCart);

router.patch(
  '/cart/:itemId',
  validate(updateCartItemSchema),
  orderController.updateCartItem
);

router.delete('/cart/:itemId', orderController.removeFromCart);

router.delete('/cart', orderController.clearCart);

// ==================== ORDER ROUTES ====================

// Create order
router.post('/', validate(createOrderSchema), orderController.createOrder);

// Get user's orders
router.get('/', orderController.getOrders);

// Get order by ID
router.get('/:id', orderController.getOrderById);

// Update order status (staff/admin only)
router.patch(
  '/:id/status',
  authorize('STAFF', 'ADMIN'),
  validate(updateOrderStatusSchema),
  orderController.updateOrderStatus
);

// Cancel order (customer)
router.post('/:id/cancel', orderController.cancelOrder);

// ==================== SYNC ROUTES ====================

// Sync offline orders
router.post('/sync', validate(syncOrdersSchema), syncController.syncOrders);

export default router;

