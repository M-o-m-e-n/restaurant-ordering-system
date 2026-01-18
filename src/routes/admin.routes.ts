import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { asyncHandler } from '../middlewares/error.middleware';
import { syncController } from '../controllers/sync.controller';
import prisma from '../config/database';
import { parsePagination } from '../utils/helpers';
import { Prisma } from '@prisma/client';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize('ADMIN'));

// ==================== ANALYTICS ====================

/**
 * Get dashboard stats
 * GET /api/admin/stats
 */
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  const { restaurantId } = req.query;

  const where: Prisma.OrderWhereInput = {};
  if (restaurantId) {
    where.restaurantId = restaurantId as string;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalOrders,
    todayOrders,
    totalRevenue,
    todayRevenue,
    totalUsers,
    totalDrivers,
    activeDrivers,
    pendingOrders,
  ] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.count({ where: { ...where, createdAt: { gte: today } } }),
    prisma.order.aggregate({
      where: { ...where, status: 'DELIVERED' },
      _sum: { totalAmount: true },
    }),
    prisma.order.aggregate({
      where: { ...where, status: 'DELIVERED', createdAt: { gte: today } },
      _sum: { totalAmount: true },
    }),
    prisma.user.count({ where: { role: 'CUSTOMER' } }),
    prisma.driver.count(),
    prisma.driver.count({ where: { isAvailable: true } }),
    prisma.order.count({ where: { ...where, status: 'PENDING' } }),
  ]);

  res.json({
    success: true,
    data: {
      orders: {
        total: totalOrders,
        today: todayOrders,
        pending: pendingOrders,
      },
      revenue: {
        total: totalRevenue._sum.totalAmount || 0,
        today: todayRevenue._sum.totalAmount || 0,
      },
      users: {
        total: totalUsers,
      },
      drivers: {
        total: totalDrivers,
        active: activeDrivers,
      },
    },
  });
}));

/**
 * Get order analytics
 * GET /api/admin/analytics/orders
 */
router.get('/analytics/orders', asyncHandler(async (req: Request, res: Response) => {
  const { restaurantId, period = 'week' } = req.query;

  const now = new Date();
  let startDate: Date;

  switch (period) {
    case 'day':
      startDate = new Date(now.setHours(0, 0, 0, 0));
      break;
    case 'week':
      startDate = new Date(now.setDate(now.getDate() - 7));
      break;
    case 'month':
      startDate = new Date(now.setMonth(now.getMonth() - 1));
      break;
    case 'year':
      startDate = new Date(now.setFullYear(now.getFullYear() - 1));
      break;
    default:
      startDate = new Date(now.setDate(now.getDate() - 7));
  }

  const where: Prisma.OrderWhereInput = {
    createdAt: { gte: startDate },
  };
  if (restaurantId) {
    where.restaurantId = restaurantId as string;
  }

  const orders = await prisma.order.groupBy({
    by: ['status'],
    where,
    _count: { id: true },
    _sum: { totalAmount: true },
  });

  const dailyOrders = await prisma.$queryRaw`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as count,
      SUM(total_amount) as revenue
    FROM "Order"
    WHERE created_at >= ${startDate}
    ${restaurantId ? Prisma.sql`AND restaurant_id = ${restaurantId}` : Prisma.empty}
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;

  res.json({
    success: true,
    data: {
      byStatus: orders,
      daily: dailyOrders,
    },
  });
}));

/**
 * Get popular items
 * GET /api/admin/analytics/popular-items
 */
router.get('/analytics/popular-items', asyncHandler(async (req: Request, res: Response) => {
  const { restaurantId, limit = '10' } = req.query;

  const popularItems = await prisma.orderItem.groupBy({
    by: ['menuItemId'],
    where: restaurantId ? {
      order: { restaurantId: restaurantId as string },
    } : undefined,
    _count: { id: true },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: parseInt(limit as string),
  });

  // Get item details
  const itemIds = popularItems.map(item => item.menuItemId);
  const items = await prisma.menuItem.findMany({
    where: { id: { in: itemIds } },
    include: { category: { select: { name: true } } },
  });

  const result = popularItems.map(popular => {
    const item = items.find(i => i.id === popular.menuItemId);
    return {
      ...item,
      orderCount: popular._count.id,
      totalQuantity: popular._sum.quantity,
    };
  });

  res.json({
    success: true,
    data: result,
  });
}));

// ==================== USER MANAGEMENT ====================

/**
 * Get all users
 * GET /api/admin/users
 */
router.get('/users', asyncHandler(async (req: Request, res: Response) => {
  const { role, search, page, limit } = req.query;
  const { skip, take } = parsePagination(page as string, limit as string);

  const where: Prisma.UserWhereInput = {};
  if (role) {
    where.role = role as any;
  }
  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { email: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.user.count({ where }),
  ]);

  res.json({
    success: true,
    data: users,
    pagination: {
      page: parseInt(page as string) || 1,
      limit: take,
      total,
      totalPages: Math.ceil(total / take),
    },
  });
}));

/**
 * Update user status
 * PATCH /api/admin/users/:id/status
 */
router.patch('/users/:id/status', asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { isActive } = req.body;

  const user = await prisma.user.update({
    where: { id },
    data: { isActive },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
    },
  });

  res.json({
    success: true,
    message: `User ${isActive ? 'activated' : 'deactivated'}`,
    data: user,
  });
}));

/**
 * Update user role
 * PATCH /api/admin/users/:id/role
 */
router.patch('/users/:id/role', asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { role } = req.body;

  const user = await prisma.user.update({
    where: { id },
    data: { role },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  res.json({
    success: true,
    message: 'User role updated',
    data: user,
  });
}));

// ==================== DRIVER MANAGEMENT ====================

/**
 * Get all drivers
 * GET /api/admin/drivers
 */
router.get('/drivers', asyncHandler(async (req: Request, res: Response) => {
  const { isAvailable, page, limit } = req.query;
  const { skip, take } = parsePagination(page as string, limit as string);

  const where: Prisma.DriverWhereInput = {};
  if (isAvailable !== undefined) {
    where.isAvailable = isAvailable === 'true';
  }

  const [drivers, total] = await Promise.all([
    prisma.driver.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        _count: { select: { deliveries: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.driver.count({ where }),
  ]);

  res.json({
    success: true,
    data: drivers,
    pagination: {
      page: parseInt(page as string) || 1,
      limit: take,
      total,
      totalPages: Math.ceil(total / take),
    },
  });
}));

/**
 * Get driver performance
 * GET /api/admin/drivers/:id/performance
 */
router.get('/drivers/:id/performance', asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const driver = await prisma.driver.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true, phone: true } },
    },
  });

  if (!driver) {
    return res.status(404).json({ success: false, error: { message: 'Driver not found' } });
  }

  const [totalDeliveries, completedDeliveries, avgDeliveryTime] = await Promise.all([
    prisma.delivery.count({ where: { driverId: id } }),
    prisma.delivery.count({ where: { driverId: id, status: 'DELIVERED' } }),
    prisma.delivery.aggregate({
      where: { driverId: id, status: 'DELIVERED' },
      _avg: { estimatedTime: true },
    }),
  ]);

  res.json({
    success: true,
    data: {
      driver,
      performance: {
        totalDeliveries,
        completedDeliveries,
        completionRate: totalDeliveries > 0
          ? ((completedDeliveries / totalDeliveries) * 100).toFixed(2)
          : 0,
        avgDeliveryTime: avgDeliveryTime._avg.estimatedTime || 0,
        rating: driver.rating || 0,
      },
    },
  });
}));

// ==================== RESTAURANT MANAGEMENT ====================

/**
 * Create restaurant
 * POST /api/admin/restaurants
 */
router.post('/restaurants', asyncHandler(async (req: Request, res: Response) => {
  const restaurant = await prisma.restaurant.create({
    data: req.body,
  });

  res.status(201).json({
    success: true,
    message: 'Restaurant created',
    data: restaurant,
  });
}));

/**
 * Get all restaurants
 * GET /api/admin/restaurants
 */
router.get('/restaurants', asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = req.query;
  const { skip, take } = parsePagination(page as string, limit as string);

  const [restaurants, total] = await Promise.all([
    prisma.restaurant.findMany({
      include: {
        _count: { select: { orders: true, categories: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.restaurant.count(),
  ]);

  res.json({
    success: true,
    data: restaurants,
    pagination: {
      page: parseInt(page as string) || 1,
      limit: take,
      total,
      totalPages: Math.ceil(total / take),
    },
  });
}));

/**
 * Update restaurant
 * PATCH /api/admin/restaurants/:id
 */
router.patch('/restaurants/:id', asyncHandler(async (req: Request, res: Response) => {
  const restaurant = await prisma.restaurant.update({
    where: { id: req.params.id as string },
    data: req.body,
  });

  res.json({
    success: true,
    message: 'Restaurant updated',
    data: restaurant,
  });
}));

// ==================== QUEUE MANAGEMENT ====================

router.get('/queue/status', syncController.getQueueStatus);
router.post('/queue/process', syncController.processQueue);
router.delete('/queue', syncController.clearQueue);

export default router;

