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

// ==================== CATEGORY ROUTES ====================
// Static category routes first
router.get('/categories', optionalAuth, menuController.getCategories);

router.post(
    '/categories',
    authenticate,
    authorize('STAFF', 'ADMIN'),
    validate(createCategorySchema),
    menuController.createCategory
);

// Category with ID parameter
router.get('/categories/:id', optionalAuth, menuController.getCategoryById);

router.patch(
    '/categories/:id',
    authenticate,
    authorize('STAFF', 'ADMIN'),
    validate(updateCategorySchema),
    menuController.updateCategory
);

router.delete(
    '/categories/:id',
    authenticate,
    authorize('ADMIN'),
    menuController.deleteCategory
);

// ==================== MENU ITEM ROUTES ====================
// Most specific item routes first (static paths)
router.post(
    '/items/with-image',
    authenticate,
    authorize('STAFF', 'ADMIN'),
    upload.single('image'),
    menuController.createMenuItem
);

// Static "items" path
router.get('/items', optionalAuth, menuController.getMenuItems);

router.post(
    '/items',
    authenticate,
    authorize('STAFF', 'ADMIN'),
    validate(createMenuItemSchema),
    menuController.createMenuItem
);

// Item routes with specific parameter paths (more specific)
router.patch(
    '/items/:id/availability',
    authenticate,
    authorize('STAFF', 'ADMIN'),
    validate(toggleAvailabilitySchema),
    menuController.toggleAvailability
);

// General item ID routes (less specific)
router.get('/items/:id', optionalAuth, menuController.getMenuItemById);

router.patch(
    '/items/:id',
    authenticate,
    authorize('STAFF', 'ADMIN'),
    validate(updateMenuItemSchema),
    menuController.updateMenuItem
);

router.delete(
    '/items/:id',
    authenticate,
    authorize('ADMIN'),
    menuController.deleteMenuItem
);

// ==================== RESTAURANT MENU ROUTE ====================
// Most general route last - catches /:restaurantId
router.get('/:restaurantId', optionalAuth, menuController.getFullMenu);

export default router;

