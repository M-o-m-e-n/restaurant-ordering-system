## Plan: Restaurant Ordering System Backend Implementation

A complete Node.js/Express backend with PostgreSQL, Prisma ORM, JWT authentication, WebSocket real-time updates, and REST APIs supporting multi-tenant restaurant operations with role-based access control.

### Technology Stack

| Category | Technology |
|----------|------------|
| Runtime | Node.js + TypeScript |
| Framework | Express.js |
| Database | PostgreSQL with Prisma ORM |
| Caching/Sessions | Redis (sessions, menu cache, rate limiting) |
| Real-time | Socket.io |
| Authentication | JWT (access/refresh tokens) + Argon2 |
| Validation | Zod |
| Image Storage | Cloudinary |
| Notifications | Firebase Cloud Messaging + Twilio SMS |
| Logging | Winston |
| Testing | Jest + Supertest |

### Steps

1. **Initialize project structure and dependencies**
   - Create `package.json` with Express, Prisma, Socket.io, JWT, Argon2, Zod, Winston, ioredis, cloudinary, firebase-admin, twilio, and testing libraries
   - Set up folder structure: `src/` with `config/`, `controllers/`, `middlewares/`, `models/`, `routes/`, `services/`, `sockets/`, `utils/`, `validators/`
   - Configure `.env.example` with required variables:
     ```
     DATABASE_URL, REDIS_URL, JWT_SECRET, JWT_REFRESH_SECRET,
     CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET,
     FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL,
     TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, PORT
     ```
   - Configure `tsconfig.json` for TypeScript setup

2. **Design and implement database schema with Prisma**
   - Create [prisma/schema.prisma](prisma/schema.prisma) with models: `User`, `Restaurant`, `MenuCategory`, `MenuItem`, `Cart`, `CartItem`, `Order`, `OrderItem`, `Delivery`, `Driver`
   - Add multi-tenant support via `restaurantId` foreign keys
   - Implement enums for `UserRole` (CUSTOMER, STAFF, DRIVER, ADMIN) and `OrderStatus` (PENDING, CONFIRMED, PREPARING, ON_THE_WAY, DELIVERED, CANCELLED)
   - Add indexes on frequently queried columns (`userId`, `restaurantId`, `status`, `createdAt`)

3. **Build authentication module with JWT and RBAC**
   - Implement `AuthController` in [src/controllers/auth.controller.ts](src/controllers/auth.controller.ts): register, login, refresh token, password recovery, logout
   - Create `AuthService` in [src/services/auth.service.ts](src/services/auth.service.ts) with argon2 password hashing, JWT access/refresh token generation
   - Add RBAC middleware in [src/middlewares/auth.middleware.ts](src/middlewares/auth.middleware.ts) with `authenticate` and `authorize(roles[])` functions
   - Configure Redis client in [src/config/redis.ts](src/config/redis.ts) for token blacklisting and session management
   - Implement token blacklist service for secure logout and refresh token rotation

4. **Implement menu management APIs**
   - Create CRUD endpoints in [src/routes/menu.routes.ts](src/routes/menu.routes.ts) for categories (`/categories`) and items (`/items`)
   - Build `MenuService` in [src/services/menu.service.ts](src/services/menu.service.ts) with business logic for menu operations
   - Configure Cloudinary in [src/config/cloudinary.ts](src/config/cloudinary.ts) for image uploads with automatic transformations
   - Implement Multer middleware with Cloudinary storage adapter for menu item image uploads
   - Add Redis caching layer for menu items in [src/services/cache.service.ts](src/services/cache.service.ts) with TTL-based invalidation
   - Add admin/staff-only access control for create/update/delete operations
   - Implement availability toggle and category-based filtering

5. **Build order management system with state machine and offline sync**
   - Create `OrderController` in [src/controllers/order.controller.ts](src/controllers/order.controller.ts) with place order, get orders, update status endpoints
   - Implement order state machine in [src/services/order.service.ts](src/services/order.service.ts) enforcing valid status transitions
   - Add cart-to-order conversion with total price calculation
   - Include order history with pagination and filtering by status/date
   - Implement offline sync endpoint (`POST /orders/sync`) in [src/controllers/sync.controller.ts](src/controllers/sync.controller.ts) for batched order submission
   - Use FIFO queue strategy for order submissions and status updates to preserve chronological order
   - Add Redis-backed queue in [src/services/queue.service.ts](src/services/queue.service.ts) for processing offline orders sequentially

6. **Implement real-time WebSocket layer with push notifications**
   - Configure Socket.io server in [src/sockets/index.ts](src/sockets/index.ts) with JWT authentication middleware
   - Create event handlers in [src/sockets/handlers/](src/sockets/handlers/): `order.handler.ts`, `delivery.handler.ts`
   - Implement rooms: `restaurant:{id}`, `order:{id}`, `driver:{id}` for targeted broadcasts
   - Emit events: `order:new`, `order:status-changed`, `delivery:assigned`, `delivery:location-update`
   - Configure Firebase Admin SDK in [src/config/firebase.ts](src/config/firebase.ts) for push notifications
   - Create `NotificationService` in [src/services/notification.service.ts](src/services/notification.service.ts) with Firebase Cloud Messaging integration
   - Configure Twilio client in [src/config/twilio.ts](src/config/twilio.ts) for SMS notifications
   - Implement SMS notifications for critical events: order confirmation, delivery updates, OTP for password recovery

7. **Develop delivery management module**
   - Create `DeliveryController` in [src/controllers/delivery.controller.ts](src/controllers/delivery.controller.ts) with assign driver, update status, track location endpoints
   - Build `DeliveryService` in [src/services/delivery.service.ts](src/services/delivery.service.ts) with driver availability management
   - Implement estimated time calculation logic
   - Add driver assignment algorithm (basic: nearest available driver)

8. **Build admin dashboard APIs**
   - Create admin routes in [src/routes/admin.routes.ts](src/routes/admin.routes.ts) with admin-only middleware
   - Implement analytics endpoints: daily/weekly/monthly orders, revenue reports, popular items
   - Add driver management: CRUD operations, performance metrics
   - Include order oversight with bulk status updates

9. **Implement error handling, validation, logging, and rate limiting**
   - Create global error handler in [src/middlewares/error.middleware.ts](src/middlewares/error.middleware.ts) with custom `AppError` class
   - Add Zod validation schemas in [src/validators/](src/validators/) for all request bodies
   - Configure Winston logger in [src/config/logger.ts](src/config/logger.ts) with file rotation
   - Implement request ID tracking and response time logging
   - Add Redis-backed rate limiting middleware in [src/middlewares/rateLimit.middleware.ts](src/middlewares/rateLimit.middleware.ts)
   - Configure rate limits per endpoint (e.g., stricter limits on auth endpoints)

10. **Set up testing infrastructure**
    - Configure Jest in [jest.config.ts](jest.config.ts) with TypeScript support
    - Create unit tests in [tests/unit/](tests/unit/) for services and utils
    - Add integration tests in [tests/integration/](tests/integration/) using Supertest with test database
    - Implement test fixtures and factories in [tests/fixtures/](tests/fixtures/)

---

## Implementation log (what’s already done)

This section tracks what’s been implemented in the repo so far, relative to the plan above.

### Security & authentication hardening

- **Prevented privilege escalation during signup**
  - `AuthService.register()` now forces `role: 'CUSTOMER'` and ignores any client-provided role.
  - File: `src/services/auth.service.ts`

- **Refresh token expiry alignment**
  - Refresh token DB expiry is no longer hardcoded to 7 days.
  - It now derives `expiresAt` from `JWT_REFRESH_EXPIRES_IN` using a small parser that supports strings like `"15m"`, `"7d"`.
  - File: `src/services/auth.service.ts`

- **Refresh tokens hashed at rest (migration-ready)**
  - Added SHA-256 helper: `src/utils/crypto.ts` (`sha256(value)`)
  - New refresh tokens are stored as a hash (`tokenHash`) rather than the raw token.
  - Refresh flow supports:
    - legacy rows that still have raw `token` stored
    - new rows storing `tokenHash`
  - Note: database migration requires a running Postgres instance; code includes safe fallbacks so the project still compiles/tests without a live DB.
  - Files: `src/services/auth.service.ts`, `src/utils/crypto.ts`, `prisma/schema.prisma`

- **OTP abuse protection (Redis)**
  - Added per-email OTP request throttling (3 requests / 15 minutes): `otp:req:${email}`
  - Added per-email OTP attempt limit (5 tries / 15 minutes): `otp:attempts:${email}`
  - OTP and attempt keys are cleaned up on success and burned on too many failed attempts.
  - File: `src/services/auth.service.ts`

- **Reset-password contract fixed & validated**
  - `resetPasswordSchema` now validates `{ email, otp, password }` to match controller/service.
  - `/api/auth/reset-password` now uses `validate(resetPasswordSchema)`.
  - Files: `src/validators/auth.validator.ts`, `src/routes/auth.routes.ts`

### Token revocation & real-time security

- **HTTP auth middleware already checks blacklisted access tokens**
  - Confirms `blacklist:${token}` in Redis before accepting a JWT.
  - File: `src/middlewares/auth.middleware.ts`

- **Socket.io auth now checks token blacklist**
  - Socket authentication rejects revoked tokens using the same Redis blacklist mechanism.
  - File: `src/sockets/index.ts`

### Delivery real-time correctness

- **Delivery tracking room mismatch fixed**
  - Customers track deliveries by joining `delivery:${deliveryId}`.
  - Driver location updates now broadcast to `delivery:${activeDelivery.id}` (not `order:${orderId}`).
  - File: `src/sockets/handlers/delivery.handler.ts`

### Redis / caching scalability

- **Replaced blocking Redis `KEYS` with `SCAN`**
  - `CacheService.deletePattern()` now iterates with `SCAN` and deletes in batches.
  - File: `src/services/cache.service.ts`

### Tooling / developer experience

- **ESLint added and configured (ESLint v9 flat config)**
  - Installed dev dependencies: `eslint`, `@eslint/js`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`.
  - Added `eslint.config.mjs` suitable for Node.js + TypeScript and Express global namespace augmentation.
  - `npm run lint` now runs (warnings remain, no errors).

### Tests added / verification

- Added unit tests covering:
  - refresh token storage using `tokenHash`
  - refresh token lookup supporting legacy + hash modes
  - OTP request throttling
  - OTP attempt limit enforcement
  - File: `tests/unit/auth.service.security.test.ts`

### Quality gates status

- `npm test`: **PASS**
- `npm run build`: **PASS**
- `npm run lint`: **PASS** (warnings only)

### Remaining follow-ups (recommended)

- Bring up Postgres locally and run Prisma migration + generate:
  - `npx prisma migrate dev --name refresh-token-hash`
  - `npx prisma generate`
- After migration, remove the temporary Prisma `as any` compatibility in refresh-token lookups.
- Resolve the remaining ESLint warnings (unused imports/vars) to get a clean lint run.

### Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Database | PostgreSQL + Prisma | Type safety, relations support, excellent migration tooling |
| Multi-tenancy | Shared tables with `restaurantId` | Simpler maintenance, easier querying, cost-effective |
| Caching | Redis | Sessions + menu cache + rate limiting + offline sync queues |
| Image Storage | Cloudinary | Automatic transformations, CDN delivery, no server storage overhead |
| Push Notifications | Firebase Cloud Messaging | Cross-platform support, reliable delivery |
| SMS Notifications | Twilio | OTP for password recovery, order confirmations, delivery updates |
| Password Hashing | Argon2 | Modern, memory-hard algorithm (more secure than bcrypt) |
| Validation | Zod | TypeScript-first, better type inference than Joi |

### Offline Sync Strategy

| Data Type | Strategy | Description |
|-----------|----------|-------------|
| Cart state | Timestamp LWW | Last-write-wins based on client timestamp |
| Final order submission | FIFO Queue | Preserve chronological order |
| Order status updates | FIFO | Sequential processing to maintain state integrity |
| Profile updates | Timestamp LWW | Latest update wins |
| Inventory changes | FIFO | Prevent race conditions in stock management |

### Project Structure

```
src/
├── config/
│   ├── cloudinary.ts
│   ├── firebase.ts
│   ├── logger.ts
│   ├── redis.ts
│   └── twilio.ts
├── controllers/
│   ├── auth.controller.ts
│   ├── delivery.controller.ts
│   ├── menu.controller.ts
│   ├── order.controller.ts
│   └── sync.controller.ts
├── middlewares/
│   ├── auth.middleware.ts
│   ├── error.middleware.ts
│   ├── rateLimit.middleware.ts
│   └── upload.middleware.ts
├── routes/
│   ├── admin.routes.ts
│   ├── auth.routes.ts
│   ├── delivery.routes.ts
│   ├── menu.routes.ts
│   └── order.routes.ts
├── services/
│   ├── auth.service.ts
│   ├── cache.service.ts
│   ├── delivery.service.ts
│   ├── menu.service.ts
│   ├── notification.service.ts
│   ├── order.service.ts
│   └── queue.service.ts
├── sockets/
│   ├── handlers/
│   │   ├── delivery.handler.ts
│   │   └── order.handler.ts
│   └── index.ts
├── validators/
│   ├── auth.validator.ts
│   ├── menu.validator.ts
│   └── order.validator.ts
├── utils/
│   └── helpers.ts
└── app.ts
prisma/
└── schema.prisma
tests/
├── fixtures/
├── integration/
└── unit/
```
