import { Router } from 'express';
import { menuController } from '../controllers/menu.controller';
import { authenticate, authorize, optionalAuth } from '../middlewares/auth.middleware';
import validate from '../middlewares/validate.middleware';
import { upload } from '../config/cloudinary';
import {
    createCategorySchema,
    updateCategorySchema,
    createMenuItemSchema,
    updateMenuItemSchema,
    toggleAvailabilitySchema,
} from '../validators/menu.validator';

const router = Router();

// ==================== PUBLIC ROUTES ====================

// Get full menu for a restaurant (public)
router.get('/:restaurantId', optionalAuth, menuController.getFullMenu);

// Get menu items with filtering (public)
router.get('/items', optionalAuth, menuController.getMenuItems);

// Get single menu item (public)
router.get('/items/:id', optionalAuth, menuController.getMenuItemById);

// ==================== CATEGORY ROUTES ====================

// Get categories (public for active, staff for all)
router.get('/categories', optionalAuth, menuController.getCategories);

// Get category by ID
router.get('/categories/:id', optionalAuth, menuController.getCategoryById);

// Create category (staff/admin only)
router.post(
    '/categories',
    authenticate,
    authorize('STAFF', 'ADMIN'),
    validate(createCategorySchema),
    menuController.createCategory
);

// Update category (staff/admin only)
router.patch(
    '/categories/:id',
    authenticate,
    authorize('STAFF', 'ADMIN'),
    validate(updateCategorySchema),
    menuController.updateCategory
);

// Delete category (admin only)
router.delete(
    '/categories/:id',
    authenticate,
    authorize('ADMIN'),
    menuController.deleteCategory
);

// ==================== MENU ITEM ROUTES ====================

// Create menu item (staff/admin only)
router.post(
  '/items',
  authenticate,
  authorize('STAFF', 'ADMIN'),
  validate(createMenuItemSchema),
  menuController.createMenuItem
);

// Create menu item with image upload
router.post(
    '/items/with-image',
    authenticate,
    authorize('STAFF', 'ADMIN'),
    upload.single('image'),
    menuController.createMenuItem
);

// Update menu item (staff/admin only)
router.patch(
  '/items/:id',
  authenticate,
  authorize('STAFF', 'ADMIN'),
  validate(updateMenuItemSchema),
  menuController.updateMenuItem
);

// Toggle availability (staff/admin only)
router.patch(
    '/items/:id/availability',
    authenticate,
    authorize('STAFF', 'ADMIN'),
    validate(toggleAvailabilitySchema),
    menuController.toggleAvailability
);

// Delete menu item (admin only)
router.delete(
    '/items/:id',
    authenticate,
    authorize('ADMIN'),
    menuController.deleteMenuItem
);

export default router;

