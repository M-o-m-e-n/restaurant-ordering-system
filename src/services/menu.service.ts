import prisma from '../config/database';
import { cacheService, CacheService } from './cache.service';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { Prisma } from '@prisma/client';
import { parsePagination } from '../utils/helpers';

export class MenuService {
  // ==================== CATEGORIES ====================

  /**
   * Create a new category
   */
  async createCategory(data: {
    name: string;
    description?: string;
    imageUrl?: string;
    sortOrder?: number;
    restaurantId: string;
  }) {
    const category = await prisma.menuCategory.create({
      data,
      include: {
        restaurant: { select: { id: true, name: true } },
      },
    });

    // Invalidate cache
    await cacheService.invalidateMenu(data.restaurantId);

    return category;
  }

  /**
   * Get all categories for a restaurant
   */
  async getCategories(restaurantId: string, includeInactive = false) {
    // Try cache first
    const cacheKey = CacheService.keys.categories(restaurantId);
    const cached = await cacheService.get<any[]>(cacheKey);

    if (cached && !includeInactive) {
      return cached;
    }

    const categories = await prisma.menuCategory.findMany({
      where: {
        restaurantId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        items: {
          where: includeInactive ? {} : { isAvailable: true },
          orderBy: { sortOrder: 'asc' },
        },
        _count: { select: { items: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });

    // Cache if not including inactive
    if (!includeInactive) {
      await cacheService.set(cacheKey, categories, 300); // 5 minutes
    }

    return categories;
  }

  /**
   * Get category by ID
   */
  async getCategoryById(id: string) {
    const category = await prisma.menuCategory.findUnique({
      where: { id },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        restaurant: { select: { id: true, name: true } },
      },
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    return category;
  }

  /**
   * Update category
   */
  async updateCategory(id: string, data: {
    name?: string;
    description?: string;
    imageUrl?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  }) {
    const category = await prisma.menuCategory.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    const updated = await prisma.menuCategory.update({
      where: { id },
      data,
      include: {
        restaurant: { select: { id: true, name: true } },
      },
    });

    // Invalidate cache
    await cacheService.invalidateMenu(category.restaurantId);

    return updated;
  }

  /**
   * Delete category
   */
  async deleteCategory(id: string) {
    const category = await prisma.menuCategory.findUnique({
      where: { id },
      include: { _count: { select: { items: true } } },
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    if (category._count.items > 0) {
      throw new BadRequestError('Cannot delete category with items. Remove items first or set inactive.');
    }

    await prisma.menuCategory.delete({ where: { id } });

    // Invalidate cache
    await cacheService.invalidateMenu(category.restaurantId);

    return { message: 'Category deleted successfully' };
  }

  // ==================== MENU ITEMS ====================

  /**
   * Create a new menu item
   */
  async createMenuItem(data: {
    name: string;
    description?: string;
    price: number;
    imageUrl?: string;
    categoryId: string;
    preparationTime?: number;
    sortOrder?: number;
  }) {
    // Verify category exists
    const category = await prisma.menuCategory.findUnique({
      where: { id: data.categoryId },
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    const item = await prisma.menuItem.create({
      data: {
        ...data,
        price: new Prisma.Decimal(data.price),
      },
      include: {
        category: { select: { id: true, name: true, restaurantId: true } },
      },
    });

    // Invalidate cache
    await cacheService.invalidateMenu(category.restaurantId);

    return item;
  }

  /**
   * Get menu items with filtering
   */
  async getMenuItems(options: {
    restaurantId?: string;
    categoryId?: string;
    isAvailable?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { skip, take, page, limit } = parsePagination(options.page, options.limit);

    const where: Prisma.MenuItemWhereInput = {};

    if (options.categoryId) {
      where.categoryId = options.categoryId;
    }

    if (options.restaurantId) {
      where.category = { restaurantId: options.restaurantId };
    }

    if (options.isAvailable !== undefined) {
      where.isAvailable = options.isAvailable;
    }

    if (options.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.menuItem.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, restaurantId: true } },
        },
        orderBy: { sortOrder: 'asc' },
        skip,
        take,
      }),
      prisma.menuItem.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get menu item by ID
   */
  async getMenuItemById(id: string) {
    const item = await prisma.menuItem.findUnique({
      where: { id },
      include: {
        category: {
          select: { id: true, name: true, restaurantId: true },
        },
      },
    });

    if (!item) {
      throw new NotFoundError('Menu item not found');
    }

    return item;
  }

  /**
   * Update menu item
   */
  async updateMenuItem(id: string, data: {
    name?: string;
    description?: string;
    price?: number;
    imageUrl?: string | null;
    categoryId?: string;
    preparationTime?: number;
    sortOrder?: number;
    isAvailable?: boolean;
  }) {
    const item = await prisma.menuItem.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!item) {
      throw new NotFoundError('Menu item not found');
    }

    // If changing category, verify new category exists
    if (data.categoryId && data.categoryId !== item.categoryId) {
      const newCategory = await prisma.menuCategory.findUnique({
        where: { id: data.categoryId },
      });
      if (!newCategory) {
        throw new NotFoundError('New category not found');
      }
    }

    const updateData: Prisma.MenuItemUpdateInput = { ...data };
    if (data.price !== undefined) {
      updateData.price = new Prisma.Decimal(data.price);
    }

    const updated = await prisma.menuItem.update({
      where: { id },
      data: updateData,
      include: {
        category: { select: { id: true, name: true, restaurantId: true } },
      },
    });

    // Invalidate cache
    await cacheService.invalidateMenu(item.category.restaurantId);

    return updated;
  }

  /**
   * Toggle item availability
   */
  async toggleAvailability(id: string, isAvailable: boolean) {
    return this.updateMenuItem(id, { isAvailable });
  }

  /**
   * Delete menu item
   */
  async deleteMenuItem(id: string) {
    const item = await prisma.menuItem.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!item) {
      throw new NotFoundError('Menu item not found');
    }

    await prisma.menuItem.delete({ where: { id } });

    // Invalidate cache
    await cacheService.invalidateMenu(item.category.restaurantId);

    return { message: 'Menu item deleted successfully' };
  }

  // ==================== FULL MENU ====================

  /**
   * Get full menu for a restaurant (categories with items)
   */
  async getFullMenu(restaurantId: string) {
    // Try cache first
    const cacheKey = CacheService.keys.menu(restaurantId);
    const cached = await cacheService.get(cacheKey);

    if (cached) {
      return cached;
    }

    const menu = await prisma.menuCategory.findMany({
      where: {
        restaurantId,
        isActive: true,
      },
      include: {
        items: {
          where: { isAvailable: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    // Cache for 5 minutes
    await cacheService.set(cacheKey, menu, 300);

    return menu;
  }
}

export const menuService = new MenuService();
export default menuService;

