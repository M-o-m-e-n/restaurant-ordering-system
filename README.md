# Restaurant Ordering System - Backend

A complete Node.js/Express backend with PostgreSQL, Prisma ORM, JWT authentication, WebSocket real-time updates, and REST APIs supporting multi-tenant restaurant operations with role-based access control.

## Technology Stack

| Category | Technology |
|----------|------------|
| Runtime | Node.js + TypeScript |
| Framework | Express.js |
| Database | PostgreSQL with Prisma ORM |
| Caching/Sessions | Redis |
| Real-time | Socket.io |
| Authentication | JWT + Argon2 |
| Validation | Zod |
| Image Storage | Cloudinary |
| Notifications | Firebase Cloud Messaging + Twilio SMS |
| Logging | Winston |
| Testing | Jest + Supertest |

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

4. Update `.env` with your configuration:
   - `DATABASE_URL` - PostgreSQL connection string
   - `REDIS_URL` - Redis connection string
   - `JWT_SECRET` - Secret for JWT access tokens
   - `JWT_REFRESH_SECRET` - Secret for JWT refresh tokens
   - Optional: Cloudinary, Firebase, Twilio credentials

5. Generate Prisma client:
   ```bash
   npm run db:generate
   ```

6. Run database migrations:
   ```bash
   npm run db:migrate
   ```

7. Seed the database (optional):
   ```bash
   npm run db:seed
   ```

### Running the Application

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
npm run build
npm start
```

## API Endpoints

### Authentication (`/api/auth`)
- `POST /register` - Register new user
- `POST /login` - Login user
- `POST /logout` - Logout user
- `POST /refresh` - Refresh access token
- `POST /forgot-password` - Request password reset
- `POST /reset-password` - Reset password with OTP
- `GET /profile` - Get current user profile
- `PATCH /profile` - Update user profile
- `POST /change-password` - Change password

### Menu (`/api/menu`)
- `GET /:restaurantId` - Get full menu for a restaurant
- `GET /categories` - Get all categories
- `POST /categories` - Create category (staff/admin)
- `PATCH /categories/:id` - Update category (staff/admin)
- `DELETE /categories/:id` - Delete category (admin)
- `GET /items` - Get menu items with filtering
- `POST /items` - Create menu item (staff/admin)
- `PATCH /items/:id` - Update menu item (staff/admin)
- `DELETE /items/:id` - Delete menu item (admin)

### Orders (`/api/orders`)
- `GET /cart` - Get user's cart
- `POST /cart` - Add item to cart
- `PATCH /cart/:itemId` - Update cart item
- `DELETE /cart/:itemId` - Remove item from cart
- `DELETE /cart` - Clear cart
- `POST /` - Create order
- `GET /` - Get user's orders
- `GET /:id` - Get order by ID
- `PATCH /:id/status` - Update order status (staff/admin)
- `POST /:id/cancel` - Cancel order
- `POST /sync` - Sync offline orders

### Deliveries (`/api/deliveries`)
- `POST /assign/:orderId` - Assign driver to order (staff/admin)
- `PATCH /:deliveryId/status` - Update delivery status
- `POST /location` - Update driver location (driver)
- `GET /drivers/available` - Get available drivers (staff/admin)
- `PATCH /drivers/availability` - Update driver availability (driver)
- `POST /drivers/profile` - Create driver profile
- `GET /drivers/active` - Get driver's active delivery (driver)

### Admin (`/api/admin`)
- `GET /stats` - Dashboard statistics
- `GET /analytics/orders` - Order analytics
- `GET /analytics/popular-items` - Popular items report
- `GET /users` - List users
- `PATCH /users/:id/status` - Activate/deactivate user
- `PATCH /users/:id/role` - Update user role
- `GET /drivers` - List drivers
- `GET /drivers/:id/performance` - Driver performance metrics
- `POST /restaurants` - Create restaurant
- `GET /restaurants` - List restaurants
- `PATCH /restaurants/:id` - Update restaurant

## WebSocket Events

### Client -> Server
- `order:join` - Join order room for updates
- `order:leave` - Leave order room
- `restaurant:join` - Join restaurant room (staff)
- `delivery:track` - Start tracking delivery
- `delivery:untrack` - Stop tracking delivery
- `delivery:location-update` - Driver sends location
- `driver:status` - Driver goes online/offline

### Server -> Client
- `order:new` - New order received
- `order:status-changed` - Order status updated
- `delivery:assigned` - Driver assigned to delivery
- `delivery:status-changed` - Delivery status updated
- `delivery:location-update` - Driver location update

## Test Credentials (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@restaurant.com | Admin123! |
| Staff | staff@restaurant.com | Staff123! |
| Driver | driver@restaurant.com | Driver123! |
| Customer | customer@example.com | Customer123! |

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Start production server
npm run db:generate  # Generate Prisma client
npm run db:migrate   # Run database migrations
npm run db:seed      # Seed database
npm run db:studio    # Open Prisma Studio
npm test             # Run tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage
```

## Project Structure

```
src/
├── config/          # Configuration files
├── controllers/     # Route controllers
├── middlewares/     # Express middlewares
├── routes/          # API routes
├── services/        # Business logic
├── sockets/         # WebSocket handlers
├── validators/      # Zod validation schemas
├── utils/           # Utility functions
├── app.ts           # Express app setup
└── server.ts        # Server entry point
prisma/
├── schema.prisma    # Database schema
└── seed.ts          # Database seeder
tests/
├── unit/            # Unit tests
├── integration/     # Integration tests
└── fixtures/        # Test fixtures
```

## License

ISC

