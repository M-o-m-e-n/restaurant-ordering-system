import { PrismaClient, UserRole, OrderStatus } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing data
  await prisma.delivery.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.menuCategory.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.blacklistedToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.restaurant.deleteMany();

  console.log('🗑️ Cleaned existing data');

  // Create admin user
  const adminPassword = await argon2.hash('Admin123!');
  const admin = await prisma.user.create({
    data: {
      email: 'admin@restaurant.com',
      password: adminPassword,
      name: 'System Admin',
      phone: '+1234567890',
      role: UserRole.ADMIN,
    },
  });
  console.log('👤 Created admin user:', admin.email);

  // Create staff user
  const staffPassword = await argon2.hash('Staff123!');
  const staff = await prisma.user.create({
    data: {
      email: 'staff@restaurant.com',
      password: staffPassword,
      name: 'Restaurant Staff',
      phone: '+1234567891',
      role: UserRole.STAFF,
    },
  });
  console.log('👤 Created staff user:', staff.email);

  // Create driver user
  const driverPassword = await argon2.hash('Driver123!');
  const driverUser = await prisma.user.create({
    data: {
      email: 'driver@restaurant.com',
      password: driverPassword,
      name: 'John Driver',
      phone: '+1234567892',
      role: UserRole.DRIVER,
    },
  });

  // Create driver profile
  const driver = await prisma.driver.create({
    data: {
      userId: driverUser.id,
      vehicleType: 'Motorcycle',
      vehicleNumber: 'ABC-1234',
      licenseNumber: 'DL-12345',
      isAvailable: true,
      currentLat: 40.7128,
      currentLng: -74.0060,
    },
  });
  console.log('🚗 Created driver:', driverUser.email);

  // Create customer user
  const customerPassword = await argon2.hash('Customer123!');
  const customer = await prisma.user.create({
    data: {
      email: 'customer@example.com',
      password: customerPassword,
      name: 'Jane Customer',
      phone: '+1234567893',
      role: UserRole.CUSTOMER,
    },
  });
  console.log('👤 Created customer user:', customer.email);

  // Create restaurant
  const restaurant = await prisma.restaurant.create({
    data: {
      name: 'The Great Kitchen',
      description: 'Fine dining experience with modern cuisine',
      address: '123 Main Street, New York, NY 10001',
      phone: '+1234567800',
      email: 'contact@greatkitchen.com',
      openingTime: '09:00',
      closingTime: '22:00',
      isActive: true,
      staff: {
        connect: [{ id: admin.id }, { id: staff.id }],
      },
    },
  });
  console.log('🏪 Created restaurant:', restaurant.name);

  // Create menu categories
  const appetizers = await prisma.menuCategory.create({
    data: {
      name: 'Appetizers',
      description: 'Start your meal with our delicious appetizers',
      restaurantId: restaurant.id,
      sortOrder: 1,
    },
  });

  const mainCourses = await prisma.menuCategory.create({
    data: {
      name: 'Main Courses',
      description: 'Hearty main dishes to satisfy your hunger',
      restaurantId: restaurant.id,
      sortOrder: 2,
    },
  });

  const desserts = await prisma.menuCategory.create({
    data: {
      name: 'Desserts',
      description: 'Sweet treats to end your meal',
      restaurantId: restaurant.id,
      sortOrder: 3,
    },
  });

  const beverages = await prisma.menuCategory.create({
    data: {
      name: 'Beverages',
      description: 'Refreshing drinks',
      restaurantId: restaurant.id,
      sortOrder: 4,
    },
  });
  console.log('📂 Created menu categories');

  // Create menu items
  const menuItems = await Promise.all([
    // Appetizers
    prisma.menuItem.create({
      data: {
        name: 'Spring Rolls',
        description: 'Crispy vegetable spring rolls with sweet chili sauce',
        price: 8.99,
        categoryId: appetizers.id,
        preparationTime: 10,
        sortOrder: 1,
      },
    }),
    prisma.menuItem.create({
      data: {
        name: 'Chicken Wings',
        description: 'Spicy buffalo wings with blue cheese dip',
        price: 12.99,
        categoryId: appetizers.id,
        preparationTime: 15,
        sortOrder: 2,
      },
    }),
    prisma.menuItem.create({
      data: {
        name: 'Garlic Bread',
        description: 'Toasted bread with garlic butter and herbs',
        price: 5.99,
        categoryId: appetizers.id,
        preparationTime: 8,
        sortOrder: 3,
      },
    }),

    // Main Courses
    prisma.menuItem.create({
      data: {
        name: 'Grilled Salmon',
        description: 'Fresh Atlantic salmon with lemon butter sauce',
        price: 24.99,
        categoryId: mainCourses.id,
        preparationTime: 25,
        sortOrder: 1,
      },
    }),
    prisma.menuItem.create({
      data: {
        name: 'Beef Steak',
        description: 'Prime ribeye steak with mashed potatoes',
        price: 29.99,
        categoryId: mainCourses.id,
        preparationTime: 30,
        sortOrder: 2,
      },
    }),
    prisma.menuItem.create({
      data: {
        name: 'Pasta Carbonara',
        description: 'Creamy pasta with bacon and parmesan',
        price: 16.99,
        categoryId: mainCourses.id,
        preparationTime: 20,
        sortOrder: 3,
      },
    }),
    prisma.menuItem.create({
      data: {
        name: 'Vegetable Curry',
        description: 'Aromatic curry with seasonal vegetables and rice',
        price: 14.99,
        categoryId: mainCourses.id,
        preparationTime: 20,
        sortOrder: 4,
      },
    }),

    // Desserts
    prisma.menuItem.create({
      data: {
        name: 'Chocolate Cake',
        description: 'Rich chocolate layer cake with ganache',
        price: 8.99,
        categoryId: desserts.id,
        preparationTime: 5,
        sortOrder: 1,
      },
    }),
    prisma.menuItem.create({
      data: {
        name: 'Cheesecake',
        description: 'New York style cheesecake with berry compote',
        price: 9.99,
        categoryId: desserts.id,
        preparationTime: 5,
        sortOrder: 2,
      },
    }),
    prisma.menuItem.create({
      data: {
        name: 'Ice Cream Sundae',
        description: 'Three scoops with chocolate sauce and whipped cream',
        price: 7.99,
        categoryId: desserts.id,
        preparationTime: 5,
        sortOrder: 3,
      },
    }),

    // Beverages
    prisma.menuItem.create({
      data: {
        name: 'Fresh Orange Juice',
        description: 'Freshly squeezed orange juice',
        price: 4.99,
        categoryId: beverages.id,
        preparationTime: 3,
        sortOrder: 1,
      },
    }),
    prisma.menuItem.create({
      data: {
        name: 'Iced Coffee',
        description: 'Cold brew coffee with milk',
        price: 5.99,
        categoryId: beverages.id,
        preparationTime: 3,
        sortOrder: 2,
      },
    }),
    prisma.menuItem.create({
      data: {
        name: 'Soft Drinks',
        description: 'Cola, Sprite, or Fanta',
        price: 2.99,
        categoryId: beverages.id,
        preparationTime: 1,
        sortOrder: 3,
      },
    }),
  ]);
  console.log(`🍽️ Created ${menuItems.length} menu items`);

  // Create a sample order
  const order = await prisma.order.create({
    data: {
      orderNumber: 'ORD-SAMPLE-001',
      userId: customer.id,
      restaurantId: restaurant.id,
      status: OrderStatus.DELIVERED,
      subtotal: 49.97,
      tax: 5.00,
      deliveryFee: 5.00,
      totalAmount: 59.97,
      deliveryAddress: '456 Customer Street, New York, NY 10002',
      notes: 'Please ring the doorbell',
      items: {
        create: [
          {
            menuItemId: menuItems[3].id, // Grilled Salmon
            quantity: 1,
            unitPrice: 24.99,
            totalPrice: 24.99,
          },
          {
            menuItemId: menuItems[0].id, // Spring Rolls
            quantity: 2,
            unitPrice: 8.99,
            totalPrice: 17.98,
          },
          {
            menuItemId: menuItems[7].id, // Chocolate Cake
            quantity: 1,
            unitPrice: 8.99,
            totalPrice: 8.99,
          },
        ],
      },
    },
  });
  console.log('📦 Created sample order:', order.orderNumber);

  console.log('\n✅ Database seeded successfully!');
  console.log('\n📋 Test Credentials:');
  console.log('   Admin: admin@restaurant.com / Admin123!');
  console.log('   Staff: staff@restaurant.com / Staff123!');
  console.log('   Driver: driver@restaurant.com / Driver123!');
  console.log('   Customer: customer@example.com / Customer123!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

