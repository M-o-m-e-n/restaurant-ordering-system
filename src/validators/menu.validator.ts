import { z } from 'zod';

// Category validators
export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    description: z.string().optional(),
    imageUrl: z.string().url().optional(),
    sortOrder: z.number().int().optional(),
    restaurantId: z.string().uuid('Invalid restaurant ID'),
  }),
});

export const updateCategorySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid category ID'),
  }),
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').optional(),
    description: z.string().optional(),
    imageUrl: z.string().url().optional().nullable(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
  }),
});

// Menu item validators
export const createMenuItemSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    description: z.string().optional(),
    price: z.number().positive('Price must be positive'),
    imageUrl: z.string().url().optional(),
    categoryId: z.string().uuid('Invalid category ID'),
    preparationTime: z.number().int().positive().optional(),
    sortOrder: z.number().int().optional(),
  }),
});

export const updateMenuItemSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid menu item ID'),
  }),
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').optional(),
    description: z.string().optional(),
    price: z.number().positive('Price must be positive').optional(),
    imageUrl: z.string().url().optional().nullable(),
    categoryId: z.string().uuid('Invalid category ID').optional(),
    preparationTime: z.number().int().positive().optional(),
    sortOrder: z.number().int().optional(),
    isAvailable: z.boolean().optional(),
  }),
});

export const toggleAvailabilitySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid menu item ID'),
  }),
  body: z.object({
    isAvailable: z.boolean(),
  }),
});

// Query params validators
export const menuQuerySchema = z.object({
  query: z.object({
    restaurantId: z.string().uuid('Invalid restaurant ID').optional(),
    categoryId: z.string().uuid('Invalid category ID').optional(),
    isAvailable: z.string().transform(val => val === 'true').optional(),
    search: z.string().optional(),
    page: z.string().transform(Number).optional(),
    limit: z.string().transform(Number).optional(),
  }),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>['body'];
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>['body'];
export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>['body'];
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>['body'];
export type MenuQueryInput = z.infer<typeof menuQuerySchema>['query'];

