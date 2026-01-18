import { Request, Response } from 'express';
import { orderService } from '../services/order.service';
import { notificationService } from '../services/notification.service';
import { asyncHandler } from '../middlewares/error.middleware';
import { getIO } from '../sockets';

export class OrderController {
  // ==================== CART ====================

  /**
   * Get user's cart
   * GET /api/orders/cart
   */
  getCart = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const cart = await orderService.getCart(userId);

    res.json({
      success: true,
      data: cart,
    });
  });

  /**
   * Add item to cart
   * POST /api/orders/cart
   */
  addToCart = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const cart = await orderService.addToCart(userId, req.body);

    res.status(201).json({
      success: true,
      message: 'Item added to cart',
      data: cart,
    });
  });

  /**
   * Update cart item
   * PATCH /api/orders/cart/:itemId
   */
  updateCartItem = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const cart = await orderService.updateCartItem(userId, req.params.itemId as string, req.body);

    res.json({
      success: true,
      message: 'Cart updated',
      data: cart,
    });
  });

  /**
   * Remove item from cart
   * DELETE /api/orders/cart/:itemId
   */
  removeFromCart = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const cart = await orderService.removeFromCart(userId, req.params.itemId as string);

    res.json({
      success: true,
      message: 'Item removed from cart',
      data: cart,
    });
  });

  /**
   * Clear cart
   * DELETE /api/orders/cart
   */
  clearCart = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const result = await orderService.clearCart(userId);

    res.json({
      success: true,
      ...result,
    });
  });

  // ==================== ORDERS ====================

  /**
   * Create order
   * POST /api/orders
   */
  createOrder = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const order = await orderService.createOrder(userId, req.body);

    // Emit socket event for new order
    const io = getIO();
    if (io) {
      io.to(`restaurant:${order.restaurantId}`).emit('order:new', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
      });
    }

    // Send notification to restaurant
    await notificationService.notifyNewOrder(
      order.id,
      order.orderNumber,
      order.restaurantId
    );

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: order,
    });
  });

  /**
   * Get order by ID
   * GET /api/orders/:id
   */
  getOrderById = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    // Staff and admin can view any order
    const order = await orderService.getOrderById(
      req.params.id as string,
      userRole === 'CUSTOMER' ? userId : undefined
    );

    res.json({
      success: true,
      data: order,
    });
  });

  /**
   * Get orders (with filtering)
   * GET /api/orders
   */
  getOrders = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const { status, restaurantId, startDate, endDate, page, limit } = req.query;

    const result = await orderService.getOrders({
      // Customers can only see their own orders
      userId: userRole === 'CUSTOMER' ? userId : undefined,
      status: status as any,
      restaurantId: restaurantId as string,
      startDate: startDate as string,
      endDate: endDate as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({
      success: true,
      data: result.orders,
      pagination: result.pagination,
    });
  });

  /**
   * Update order status
   * PATCH /api/orders/:id/status
   */
  updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.body;
    const order = await orderService.updateOrderStatus(req.params.id as string, status);

    // Emit socket event
    const io = getIO();
    if (io) {
      io.to(`order:${order.id}`).emit('order:status-changed', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
      });
      io.to(`restaurant:${order.restaurantId}`).emit('order:status-changed', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
      });
    }

    // Send notification to customer
    await notificationService.notifyOrderStatusChange(
      order.id,
      order.status,
      order.userId
    );

    res.json({
      success: true,
      message: 'Order status updated',
      data: order,
    });
  });

  /**
   * Cancel order (customer)
   * POST /api/orders/:id/cancel
   */
  cancelOrder = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { reason } = req.body;

    const order = await orderService.cancelOrder(req.params.id as string, userId, reason);

    // Emit socket event
    const io = getIO();
    if (io) {
      io.to(`order:${order.id}`).emit('order:status-changed', {
        orderId: order.id,
        status: 'CANCELLED',
      });
      io.to(`restaurant:${order.restaurantId}`).emit('order:status-changed', {
        orderId: order.id,
        status: 'CANCELLED',
      });
    }

    res.json({
      success: true,
      message: 'Order cancelled',
      data: order,
    });
  });
}

export const orderController = new OrderController();
export default orderController;

