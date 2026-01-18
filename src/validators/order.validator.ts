import { z } from 'zod';
import { OrderStatus } from '@prisma/client';

// Cart validators
export const addToCartSchema = z.object({
  body: z.object({
    menuItemId: z.string().uuid('Invalid menu item ID'),
    quantity: z.number().int().positive('Quantity must be positive'),
    notes: z.string().optional(),
  }),
});

export const updateCartItemSchema = z.object({
  params: z.object({
    itemId: z.string().uuid('Invalid cart item ID'),
  }),
  body: z.object({
    quantity: z.number().int().positive('Quantity must be positive').optional(),
    notes: z.string().optional(),
  }),
});

export const removeFromCartSchema = z.object({
  params: z.object({
    itemId: z.string().uuid('Invalid cart item ID'),
  }),
});

// Order validators
export const createOrderSchema = z.object({
  body: z.object({
    restaurantId: z.string().uuid('Invalid restaurant ID'),
    deliveryAddress: z.string().min(10, 'Delivery address is required'),
    notes: z.string().optional(),
    items: z.array(z.object({
      menuItemId: z.string().uuid('Invalid menu item ID'),
      quantity: z.number().int().positive('Quantity must be positive'),
      notes: z.string().optional(),
    })).min(1, 'At least one item is required').optional(),
  }),
});

export const updateOrderStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid order ID'),
  }),
  body: z.object({
    status: z.nativeEnum(OrderStatus),
  }),
});

export const orderQuerySchema = z.object({
  query: z.object({
    status: z.nativeEnum(OrderStatus).optional(),
    restaurantId: z.string().uuid().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    page: z.string().transform(Number).optional(),
    limit: z.string().transform(Number).optional(),
  }),
});

// Offline sync validators
export const syncOrdersSchema = z.object({
  body: z.object({
    orders: z.array(z.object({
      clientId: z.string(),
      restaurantId: z.string().uuid(),
      deliveryAddress: z.string(),
      notes: z.string().optional(),
      items: z.array(z.object({
        menuItemId: z.string().uuid(),
        quantity: z.number().int().positive(),
        notes: z.string().optional(),
      })),
      createdAt: z.string().datetime(),
    })),
  }),
});

export type AddToCartInput = z.infer<typeof addToCartSchema>['body'];
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>['body'];
export type CreateOrderInput = z.infer<typeof createOrderSchema>['body'];
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>['body'];
export type OrderQueryInput = z.infer<typeof orderQuerySchema>['query'];
export type SyncOrdersInput = z.infer<typeof syncOrdersSchema>['body'];

