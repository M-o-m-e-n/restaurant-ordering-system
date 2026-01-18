import { z } from 'zod';
import { DeliveryStatus } from '@prisma/client';

export const assignDriverSchema = z.object({
  params: z.object({
    orderId: z.string().uuid('Invalid order ID'),
  }),
  body: z.object({
    driverId: z.string().uuid('Invalid driver ID'),
    estimatedTime: z.number().int().positive('Estimated time must be positive').optional(),
  }),
});

export const updateDeliveryStatusSchema = z.object({
  params: z.object({
    deliveryId: z.string().uuid('Invalid delivery ID'),
  }),
  body: z.object({
    status: z.nativeEnum(DeliveryStatus),
  }),
});

export const updateDriverLocationSchema = z.object({
  body: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
});

export const updateDriverAvailabilitySchema = z.object({
  body: z.object({
    isAvailable: z.boolean(),
  }),
});

export const createDriverProfileSchema = z.object({
  body: z.object({
    vehicleType: z.string().optional(),
    vehicleNumber: z.string().optional(),
    licenseNumber: z.string().optional(),
  }),
});

export const deliveryQuerySchema = z.object({
  query: z.object({
    status: z.nativeEnum(DeliveryStatus).optional(),
    driverId: z.string().uuid().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    page: z.string().transform(Number).optional(),
    limit: z.string().transform(Number).optional(),
  }),
});

export type AssignDriverInput = z.infer<typeof assignDriverSchema>['body'];
export type UpdateDeliveryStatusInput = z.infer<typeof updateDeliveryStatusSchema>['body'];
export type UpdateDriverLocationInput = z.infer<typeof updateDriverLocationSchema>['body'];
export type UpdateDriverAvailabilityInput = z.infer<typeof updateDriverAvailabilitySchema>['body'];
export type CreateDriverProfileInput = z.infer<typeof createDriverProfileSchema>['body'];
export type DeliveryQueryInput = z.infer<typeof deliveryQuerySchema>['query'];

