import prisma from '../config/database';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { generateOrderNumber, parsePagination } from '../utils/helpers';
import { OrderStatus, Prisma } from '@prisma/client';
import { cacheService } from './cache.service';

// Valid status transitions
const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['ON_THE_WAY', 'CANCELLED'],
  ON_THE_WAY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

export class OrderService {
  // ==================== CART ====================

  /**
   * Get or create cart for user
   */
  async getCart(userId: string) {
    let cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            menuItem: {
              include: {
                category: { select: { restaurantId: true } },
              },
            },
          },
        },
      },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId },
        include: {
          items: {
            include: {
              menuItem: {
                include: {
                  category: { select: { restaurantId: true } },
                },
              },
            },
          },
        },
      });
    }

    // Calculate totals
    const subtotal = cart.items.reduce((sum, item) => {
      return sum + Number(item.menuItem.price) * item.quantity;
    }, 0);

    return {
      ...cart,
      subtotal: subtotal.toFixed(2),
      itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
    };
  }

  /**
   * Add item to cart
   */
  async addToCart(userId: string, data: {
    menuItemId: string;
    quantity: number;
    notes?: string;
  }) {
    // Verify menu item exists and is available
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: data.menuItemId },
    });

    if (!menuItem) {
      throw new NotFoundError('Menu item not found');
    }

    if (!menuItem.isAvailable) {
      throw new BadRequestError('Menu item is not available');
    }

    // Get or create cart
    let cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      cart = await prisma.cart.create({ data: { userId } });
    }

    // Check if item already in cart
    const existingItem = await prisma.cartItem.findUnique({
      where: {
        cartId_menuItemId: {
          cartId: cart.id,
          menuItemId: data.menuItemId,
        },
      },
    });

    if (existingItem) {
      // Update quantity
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: existingItem.quantity + data.quantity,
          notes: data.notes || existingItem.notes,
        },
      });
    } else {
      // Add new item
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          menuItemId: data.menuItemId,
          quantity: data.quantity,
          notes: data.notes,
        },
      });
    }

    return this.getCart(userId);
  }

  /**
   * Update cart item
   */
  async updateCartItem(userId: string, itemId: string, data: {
    quantity?: number;
    notes?: string;
  }) {
    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      throw new NotFoundError('Cart not found');
    }

    const cartItem = await prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
    });

    if (!cartItem) {
      throw new NotFoundError('Cart item not found');
    }

    if (data.quantity !== undefined && data.quantity <= 0) {
      // Remove item if quantity is 0 or less
      await prisma.cartItem.delete({ where: { id: itemId } });
    } else {
      await prisma.cartItem.update({
        where: { id: itemId },
        data,
      });
    }

    return this.getCart(userId);
  }

  /**
   * Remove item from cart
   */
  async removeFromCart(userId: string, itemId: string) {
    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      throw new NotFoundError('Cart not found');
    }

    const cartItem = await prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
    });

    if (!cartItem) {
      throw new NotFoundError('Cart item not found');
    }

    await prisma.cartItem.delete({ where: { id: itemId } });

    return this.getCart(userId);
  }

  /**
   * Clear cart
   */
  async clearCart(userId: string) {
    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (cart) {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }
    return { message: 'Cart cleared' };
  }

  // ==================== ORDERS ====================

  /**
   * Create order from cart or direct items
   */
  async createOrder(userId: string, data: {
    restaurantId: string;
    deliveryAddress: string;
    notes?: string;
    items?: Array<{
      menuItemId: string;
      quantity: number;
      notes?: string;
    }>;
  }) {
    // Verify restaurant exists
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: data.restaurantId },
    });

    if (!restaurant) {
      throw new NotFoundError('Restaurant not found');
    }

    let orderItems: Array<{
      menuItemId: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
      totalPrice: Prisma.Decimal;
      notes?: string;
    }> = [];

    if (data.items && data.items.length > 0) {
      // Use provided items
      for (const item of data.items) {
        const menuItem = await prisma.menuItem.findUnique({
          where: { id: item.menuItemId },
          include: { category: true },
        });

        if (!menuItem) {
          throw new NotFoundError(`Menu item ${item.menuItemId} not found`);
        }

        if (!menuItem.isAvailable) {
          throw new BadRequestError(`${menuItem.name} is not available`);
        }

        if (menuItem.category.restaurantId !== data.restaurantId) {
          throw new BadRequestError(`${menuItem.name} does not belong to this restaurant`);
        }

        orderItems.push({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          unitPrice: menuItem.price,
          totalPrice: new Prisma.Decimal(Number(menuItem.price) * item.quantity),
          notes: item.notes,
        });
      }
    } else {
      // Use cart items
      const cart = await prisma.cart.findUnique({
        where: { userId },
        include: {
          items: {
            include: {
              menuItem: {
                include: { category: true },
              },
            },
          },
        },
      });

      if (!cart || cart.items.length === 0) {
        throw new BadRequestError('Cart is empty');
      }

      // Verify all items belong to the same restaurant
      for (const item of cart.items) {
        if (item.menuItem.category.restaurantId !== data.restaurantId) {
          throw new BadRequestError('All items must be from the same restaurant');
        }

        if (!item.menuItem.isAvailable) {
          throw new BadRequestError(`${item.menuItem.name} is no longer available`);
        }

        orderItems.push({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          unitPrice: item.menuItem.price,
          totalPrice: new Prisma.Decimal(Number(item.menuItem.price) * item.quantity),
          notes: item.notes || undefined,
        });
      }
    }

    // Calculate totals
    const subtotal = orderItems.reduce(
      (sum, item) => sum + Number(item.totalPrice),
      0
    );
    const tax = subtotal * 0.1; // 10% tax
    const deliveryFee = 5.00; // Fixed delivery fee
    const totalAmount = subtotal + tax + deliveryFee;

    // Create order with transaction
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          userId,
          restaurantId: data.restaurantId,
          deliveryAddress: data.deliveryAddress,
          notes: data.notes,
          subtotal: new Prisma.Decimal(subtotal),
          tax: new Prisma.Decimal(tax),
          deliveryFee: new Prisma.Decimal(deliveryFee),
          totalAmount: new Prisma.Decimal(totalAmount),
          status: 'PENDING',
          items: {
            create: orderItems,
          },
        },
        include: {
          items: {
            include: {
              menuItem: { select: { id: true, name: true, imageUrl: true } },
            },
          },
          restaurant: { select: { id: true, name: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      });

      // Clear cart if used
      if (!data.items || data.items.length === 0) {
        const cart = await tx.cart.findUnique({ where: { userId } });
        if (cart) {
          await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        }
      }

      return newOrder;
    });

    return order;
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string, userId?: string) {
    const where: Prisma.OrderWhereUniqueInput = { id: orderId };

    const order = await prisma.order.findUnique({
      where,
      include: {
        items: {
          include: {
            menuItem: { select: { id: true, name: true, imageUrl: true } },
          },
        },
        restaurant: { select: { id: true, name: true, address: true, phone: true } },
        user: { select: { id: true, name: true, email: true, phone: true } },
        delivery: {
          include: {
            driver: {
              include: {
                user: { select: { id: true, name: true, phone: true } },
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    // Check ownership if userId provided (for customers)
    if (userId && order.userId !== userId) {
      throw new NotFoundError('Order not found');
    }

    return order;
  }

  /**
   * Get orders with filtering
   */
  async getOrders(options: {
    userId?: string;
    restaurantId?: string;
    status?: OrderStatus;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const { skip, take, page, limit } = parsePagination(options.page, options.limit);

    const where: Prisma.OrderWhereInput = {};

    if (options.userId) {
      where.userId = options.userId;
    }

    if (options.restaurantId) {
      where.restaurantId = options.restaurantId;
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

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              menuItem: { select: { id: true, name: true } },
            },
          },
          restaurant: { select: { id: true, name: true } },
          delivery: {
            select: { status: true, estimatedTime: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.order.count({ where }),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId: string, newStatus: OrderStatus, updatedBy?: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    // Validate status transition
    const allowedTransitions = STATUS_TRANSITIONS[order.status];
    if (!allowedTransitions.includes(newStatus)) {
      throw new BadRequestError(
        `Cannot transition from ${order.status} to ${newStatus}`
      );
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus },
      include: {
        items: {
          include: {
            menuItem: { select: { id: true, name: true } },
          },
        },
        restaurant: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true, fcmToken: true } },
        delivery: true,
      },
    });

    return updatedOrder;
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId: string, userId: string, reason?: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    if (order.userId !== userId) {
      throw new NotFoundError('Order not found');
    }

    // Can only cancel pending or confirmed orders
    if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
      throw new BadRequestError('Order cannot be cancelled at this stage');
    }

    return this.updateOrderStatus(orderId, 'CANCELLED');
  }
}

export const orderService = new OrderService();
export default orderService;

