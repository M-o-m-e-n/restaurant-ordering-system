import { Request, Response } from 'express';
import { menuService } from '../services/menu.service';
import { asyncHandler } from '../middlewares/error.middleware';

export class MenuController {
  // ==================== CATEGORIES ====================

  /**
   * Create category
   * POST /api/menu/categories
   */
  createCategory = asyncHandler(async (req: Request, res: Response) => {
    const category = await menuService.createCategory(req.body);

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category,
    });
  });

  /**
   * Get all categories for a restaurant
   * GET /api/menu/categories?restaurantId=xxx
   */
  getCategories = asyncHandler(async (req: Request, res: Response) => {
    const { restaurantId, includeInactive } = req.query;

    const categories = await menuService.getCategories(
      restaurantId as string,
      includeInactive === 'true'
    );

    res.json({
      success: true,
      data: categories,
    });
  });

  /**
   * Get category by ID
   * GET /api/menu/categories/:id
   */
  getCategoryById = asyncHandler(async (req: Request, res: Response) => {
    const category = await menuService.getCategoryById(req.params.id as string);

    res.json({
      success: true,
      data: category,
    });
  });

  /**
   * Update category
   * PATCH /api/menu/categories/:id
   */
  updateCategory = asyncHandler(async (req: Request, res: Response) => {
    const category = await menuService.updateCategory(req.params.id as string, req.body);

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: category,
    });
  });

  /**
   * Delete category
   * DELETE /api/menu/categories/:id
   */
  deleteCategory = asyncHandler(async (req: Request, res: Response) => {
    const result = await menuService.deleteCategory(req.params.id as string);

    res.json({
      success: true,
      ...result,
    });
  });

  // ==================== MENU ITEMS ====================

  /**
   * Create menu item
   * POST /api/menu/items
   */
  createMenuItem = asyncHandler(async (req: Request, res: Response) => {
    const item = await menuService.createMenuItem(req.body);

    res.status(201).json({
      success: true,
      message: 'Menu item created successfully',
      data: item,
    });
  });

  /**
   * Get menu items with filtering
   * GET /api/menu/items
   */
  getMenuItems = asyncHandler(async (req: Request, res: Response) => {
    const { restaurantId, categoryId, isAvailable, search, page, limit } = req.query;

    const result = await menuService.getMenuItems({
      restaurantId: restaurantId as string,
      categoryId: categoryId as string,
      isAvailable: isAvailable === 'true' ? true : isAvailable === 'false' ? false : undefined,
      search: search as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  });

  /**
   * Get menu item by ID
   * GET /api/menu/items/:id
   */
  getMenuItemById = asyncHandler(async (req: Request, res: Response) => {
    const item = await menuService.getMenuItemById(req.params.id as string);

    res.json({
      success: true,
      data: item,
    });
  });

  /**
   * Update menu item
   * PATCH /api/menu/items/:id
   */
  updateMenuItem = asyncHandler(async (req: Request, res: Response) => {
    const item = await menuService.updateMenuItem(req.params.id as string, req.body);

    res.json({
      success: true,
      message: 'Menu item updated successfully',
      data: item,
    });
  });

  /**
   * Toggle menu item availability
   * PATCH /api/menu/items/:id/availability
   */
  toggleAvailability = asyncHandler(async (req: Request, res: Response) => {
    const { isAvailable } = req.body;
    const item = await menuService.toggleAvailability(req.params.id as string, isAvailable);

    res.json({
      success: true,
      message: `Menu item ${isAvailable ? 'enabled' : 'disabled'} successfully`,
      data: item,
    });
  });

  /**
   * Delete menu item
   * DELETE /api/menu/items/:id
   */
  deleteMenuItem = asyncHandler(async (req: Request, res: Response) => {
    const result = await menuService.deleteMenuItem(req.params.id as string);

    res.json({
      success: true,
      ...result,
    });
  });

  // ==================== FULL MENU ====================

  /**
   * Get full menu for a restaurant
   * GET /api/menu/:restaurantId
   */
  getFullMenu = asyncHandler(async (req: Request, res: Response) => {
    const menu = await menuService.getFullMenu(req.params.restaurantId as string);

    res.json({
      success: true,
      data: menu,
    });
  });
}

export const menuController = new MenuController();
export default menuController;

