import prisma from '../config/database';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { DeliveryStatus, Prisma } from '@prisma/client';
import { parsePagination, calculateDistance } from '../utils/helpers';

// Valid delivery status transitions
const DELIVERY_STATUS_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  ASSIGNED: ['PICKED_UP'],
  PICKED_UP: ['IN_TRANSIT'],
  IN_TRANSIT: ['DELIVERED'],
  DELIVERED: [],
};

export class DeliveryService {
  /**
   * Get driver by user ID
   */
  async getDriverByUserId(userId: string) {
    const driver = await prisma.driver.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    });

    if (!driver) {
      throw new NotFoundError('Driver profile not found');
    }

    return driver;
  }

  /**
   * Assign driver to order
   */
  async assignDriver(orderId: string, driverId: string, estimatedTime?: number) {
    // Verify order exists and is in correct status
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { delivery: true },
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    if (order.status !== 'PREPARING' && order.status !== 'CONFIRMED') {
      throw new BadRequestError('Order is not ready for delivery assignment');
    }

    if (order.delivery) {
      throw new BadRequestError('Order already has a delivery assigned');
    }

    // Verify driver exists and is available
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      include: { user: true },
    });

    if (!driver) {
      throw new NotFoundError('Driver not found');
    }

    if (!driver.isAvailable) {
      throw new BadRequestError('Driver is not available');
    }

    // Create delivery and update order status in transaction
    const delivery = await prisma.$transaction(async (tx) => {
      // Create delivery
      const newDelivery = await tx.delivery.create({
        data: {
          orderId,
          driverId,
          estimatedTime,
          status: 'ASSIGNED',
        },
        include: {
          driver: {
            include: {
              user: { select: { id: true, name: true, phone: true } },
            },
          },
          order: {
            select: { id: true, orderNumber: true, deliveryAddress: true },
          },
        },
      });

      // Update order status to ON_THE_WAY if it's PREPARING
      if (order.status === 'PREPARING') {
        await tx.order.update({
          where: { id: orderId },
          data: { status: 'ON_THE_WAY' },
        });
      }

      // Update driver availability
      await tx.driver.update({
        where: { id: driverId },
        data: { isAvailable: false },
      });

      return newDelivery;
    });

    return delivery;
  }

  /**
   * Update delivery status
   */
  async updateDeliveryStatus(deliveryId: string, newStatus: DeliveryStatus) {
    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { order: true, driver: true },
    });

    if (!delivery) {
      throw new NotFoundError('Delivery not found');
    }

    // Validate status transition
    const allowedTransitions = DELIVERY_STATUS_TRANSITIONS[delivery.status];
    if (!allowedTransitions.includes(newStatus)) {
      throw new BadRequestError(
        `Cannot transition from ${delivery.status} to ${newStatus}`
      );
    }

    const updateData: Prisma.DeliveryUpdateInput = { status: newStatus };

    // Set timestamps based on status
    if (newStatus === 'PICKED_UP') {
      updateData.pickupTime = new Date();
    } else if (newStatus === 'DELIVERED') {
      updateData.deliveryTime = new Date();
    }

    // Update delivery and related records in transaction
    const updatedDelivery = await prisma.$transaction(async (tx) => {
      const updated = await tx.delivery.update({
        where: { id: deliveryId },
        data: updateData,
        include: {
          driver: {
            include: {
              user: { select: { id: true, name: true, phone: true } },
            },
          },
          order: {
            include: {
              user: { select: { id: true, name: true, email: true, fcmToken: true } },
            },
          },
        },
      });

      // If delivered, update order status and driver availability
      if (newStatus === 'DELIVERED') {
        await tx.order.update({
          where: { id: delivery.orderId },
          data: { status: 'DELIVERED' },
        });

        await tx.driver.update({
          where: { id: delivery.driverId },
          data: {
            isAvailable: true,
            totalDeliveries: { increment: 1 },
          },
        });
      }

      return updated;
    });

    return updatedDelivery;
  }

  /**
   * Update driver location
   */
  async updateDriverLocation(driverId: string, latitude: number, longitude: number) {
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
    });

    if (!driver) {
      throw new NotFoundError('Driver not found');
    }

    // Update driver location
    await prisma.driver.update({
      where: { id: driverId },
      data: {
        currentLat: new Prisma.Decimal(latitude),
        currentLng: new Prisma.Decimal(longitude),
      },
    });

    // Also update active delivery location
    const activeDelivery = await prisma.delivery.findFirst({
      where: {
        driverId,
        status: { in: ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] },
      },
    });

    if (activeDelivery) {
      await prisma.delivery.update({
        where: { id: activeDelivery.id },
        data: {
          currentLat: new Prisma.Decimal(latitude),
          currentLng: new Prisma.Decimal(longitude),
        },
      });
    }

    return { message: 'Location updated', latitude, longitude };
  }

  /**
   * Get delivery by ID
   */
  async getDeliveryById(deliveryId: string) {
    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: {
        driver: {
          include: {
            user: { select: { id: true, name: true, phone: true } },
          },
        },
        order: {
          include: {
            user: { select: { id: true, name: true, phone: true } },
            restaurant: { select: { id: true, name: true, address: true } },
            items: {
              include: {
                menuItem: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!delivery) {
      throw new NotFoundError('Delivery not found');
    }

    return delivery;
  }

  /**
   * Get deliveries with filtering
   */
  async getDeliveries(options: {
    driverId?: string;
    status?: DeliveryStatus;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const { skip, take, page, limit } = parsePagination(options.page, options.limit);

    const where: Prisma.DeliveryWhereInput = {};

    if (options.driverId) {
      where.driverId = options.driverId;
    }

    if (options.status) {
      where.status = options.status;
    }

    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) {
        where.createdAt.gte = new Date(options.startDate);
      }
      if (options.endDate) {
        where.createdAt.lte = new Date(options.endDate);
      }
    }

    const [deliveries, total] = await Promise.all([
      prisma.delivery.findMany({
        where,
        include: {
          driver: {
            include: {
              user: { select: { id: true, name: true } },
            },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
              deliveryAddress: true,
              totalAmount: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.delivery.count({ where }),
    ]);

    return {
      deliveries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get available drivers
   */
  async getAvailableDrivers(restaurantLat?: number, restaurantLng?: number) {
    const drivers = await prisma.driver.findMany({
      where: { isAvailable: true },
      include: {
        user: { select: { id: true, name: true, phone: true } },
      },
    });

    // If restaurant coordinates provided, calculate distance and sort
    if (restaurantLat !== undefined && restaurantLng !== undefined) {
      const driversWithDistance = drivers.map((driver) => {
        let distance: number | null = null;
        if (driver.currentLat && driver.currentLng) {
          distance = calculateDistance(
            restaurantLat,
            restaurantLng,
            Number(driver.currentLat),
            Number(driver.currentLng)
          );
        }
        return { ...driver, distance };
      });

      // Sort by distance (null distances at the end)
      driversWithDistance.sort((a, b) => {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });

      return driversWithDistance;
    }

    return drivers;
  }

  /**
   * Update driver availability
   */
  async updateDriverAvailability(driverId: string, isAvailable: boolean) {
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
    });

    if (!driver) {
      throw new NotFoundError('Driver not found');
    }

    // Check for active deliveries if trying to go offline
    if (!isAvailable) {
      const activeDelivery = await prisma.delivery.findFirst({
        where: {
          driverId,
          status: { in: ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] },
        },
      });

      if (activeDelivery) {
        throw new BadRequestError('Cannot go offline with active delivery');
      }
    }

    const updated = await prisma.driver.update({
      where: { id: driverId },
      data: { isAvailable },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    return updated;
  }

  /**
   * Create driver profile for user
   */
  async createDriverProfile(userId: string, data: {
    vehicleType?: string;
    vehicleNumber?: string;
    licenseNumber?: string;
  }) {
    // Check if user exists and doesn't have a driver profile
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { driver: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.driver) {
      throw new BadRequestError('User already has a driver profile');
    }

    // Create driver profile and update user role
    const driver = await prisma.$transaction(async (tx) => {
      const newDriver = await tx.driver.create({
        data: {
          userId,
          ...data,
        },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
      });

      // Update user role to DRIVER
      await tx.user.update({
        where: { id: userId },
        data: { role: 'DRIVER' },
      });

      return newDriver;
    });

    return driver;
  }

  /**
   * Get driver's active delivery
   */
  async getActiveDelivery(driverId: string) {
    const delivery = await prisma.delivery.findFirst({
      where: {
        driverId,
        status: { in: ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] },
      },
      include: {
        order: {
          include: {
            user: { select: { id: true, name: true, phone: true } },
            restaurant: { select: { id: true, name: true, address: true, phone: true } },
            items: {
              include: {
                menuItem: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    return delivery;
  }
}

export const deliveryService = new DeliveryService();
export default deliveryService;

