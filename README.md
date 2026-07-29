# TCM Clinic Miniapp

> [中文文档](./README.zh-CN.md) | English

A full-stack Traditional Chinese Medicine (TCM) clinic management platform built as a WeChat miniprogram, with an embedded admin console, Node.js/Express backend, and PC admin dashboard.

## Architecture

```
tcm-clinic-miniapp/
├── backend/                    # Node.js + Express API server
│   ├── src/
│   │   ├── routes/             # REST API routes
│   │   ├── middleware/         # Auth, rate limiting, error handling
│   │   └── config/             # DB pool, environment config
│   └── database/               # SQL schema, migrations, seed data
├── miniprogram/                # WeChat miniprogram (user + admin)
│   ├── pages/
│   │   ├── home/               # Homepage (services, articles, activities)
│   │   ├── booking/            # Appointment booking flow
│   │   ├── health/             # Health records management
│   │   ├── profile/            # User profile, orders, member info
│   │   ├── admin/              # Embedded management console
│   │   ├── technician/         # Technician workbench
│   │   └── ...                 # 13+ feature pages
│   └── utils/                  # request wrapper, constants, mock data
├── pc-admin/                   # PC admin dashboard (Vite + vanilla)
└── packages/
    └── admin-shared/           # Shared types, API contracts, enums
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express, Zod validation, PostgreSQL |
| Miniprogram | WeChat native miniprogram framework |
| PC Admin | Vite, vanilla TypeScript |
| Monorepo | pnpm workspaces |

## Key Features

### User-Facing
- **Homepage** — Service showcase, health articles, marketing activities, store info
- **Booking** — Service selection, practitioner selection, time slot picking, order confirmation
- **Health Records** — TCM constitution assessment, symptoms, tongue diagnosis, pulse notes
- **Profile** — Order history, member tier and points, coupons, messages, favorites, settings
- **Order Management** — Order detail, cancellation, payment, review submission, rescheduling
- **Member System** — Points, tier progression, benefits
- **Coupons & Favorites** — Promotional coupons, favorite stores/practitioners
- **Content** — Health articles, marketing activities, messages

### Management Console (Embedded in Miniprogram)
- **Dashboard** — Revenue, orders, practitioners, user metrics, rankings
- **Multi-Store** — Store CRUD, default store toggle
- **Services** — Service/procedure management with pricing and duration
- **Practitioners** — Practitioner profiles, specialties, status management
- **Schedules** — Individual and bulk schedule generation with capacity control
- **Orders** — Order list, status management (confirm/complete/cancel)
- **Commissions** — Commission rules by practitioner/service/threshold
- **Homepage Config** — Section-based homepage layout configuration
- **Content Marketing** — Activities and articles management
- **User & Roles** — Member management, role assignment (owner/manager/frontdesk/member)
- **Reviews** — Review moderation with reply support
- **Payment Config** — WeChat Pay parameters, mock payment toggle, timeout settings
- **Audit Logs** — Admin operation audit trail

### Technician Workbench
- Schedule overview, commission tracking

## Getting Started

### Prerequisites

- Node.js >= 18
- PostgreSQL >= 14
- pnpm >= 11
- WeChat DevTools (for miniprogram development)

### Backend Setup

```bash
# Install dependencies
pnpm install

# Initialize database schema and seed data
pnpm db:init

# Start development server
pnpm dev:api
```

### Miniprogram

1. Open [WeChat DevTools](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. Import the `miniprogram/` directory
3. Configure your AppID in `miniprogram/project.config.json`
4. Ensure the backend API base URL matches your environment

### PC Admin Dashboard

```bash
pnpm dev:pc
```

### Demo Mode

The backend supports a demo mode via the `x-demo-user-id` header, which bypasses authentication for development. Enable with `NODE_ENV=development`.

## Database Schema

The project uses PostgreSQL with a comprehensive schema covering:

- **Users & Members** — Profiles, roles, membership tiers, points
- **Stores** — Multi-store support with default store logic
- **Services** — TCM treatments and procedures with pricing
- **Practitioners** — Staff profiles, specialties, multi-store assignment
- **Schedules** — Time slots with capacity control and booking locks
- **Appointments** — Orders with status state machine (pending → confirmed → completed → cancelled/refunded)
- **Health Records** — TCM-specific health assessments
- **Reviews** — Rating and review system
- **Content** — Articles, activities, coupons
- **Commission Rules** — Configurable commission by service/practitioner/threshold
- **Homepage Config** — Flexible section-based homepage layout
- **Audit Logs** — Admin operation tracking
- **Payment Configs** — Payment method configuration per store

## Project Structure

```
backend/
├── src/
│   ├── app.js                    # Express app setup, route registration
│   ├── config/
│   │   ├── db.js                 # PostgreSQL connection pool
│   │   └── env.js                # Environment config, feature flags
│   ├── middleware/
│   │   ├── auth.js               # JWT auth, role-based access
│   │   ├── async-handler.js      # Error handling wrapper
│   │   └── rate-limit.js         # API rate limiting
│   └── routes/
│       ├── admin.js              # All admin API routes
│       ├── catalog.js            # Public catalog (services, practitioners, stores, schedules)
│       ├── orders.js             # User order management
│       ├── reviews.js            # User reviews
│       ├── content.js            # Articles, activities, coupons
│       ├── user.js               # User profile, payment, messages, practitioners
│       └── favorites.js          # User favorites
├── database/
│   ├── schema.sql                # All table definitions
│   ├── comments.sql              # Table/column documentation
│   ├── migrate_favorites.sql     # user_favorites + messages tables
│   ├── migrate_payment_configs.sql # payment_configs table
│   ├── seed.sql                  # Demo data
│   └── seed_messages.sql         # Demo messages
├── scripts/
│   ├── init-db.js                # Schema + migrations runner
│   └── seed-db.js                # Seed data runner
└── package.json

miniprogram/
├── pages/
│   ├── home/                     # Homepage
│   ├── booking/                  # Appointment booking
│   ├── health/                   # Health records
│   ├── profile/                  # User profile and orders
│   ├── admin/                    # Management console
│   ├── technician/               # Technician workbench
│   ├── order-detail/             # Order detail view
│   ├── order-cancel/             # Cancel confirmation
│   ├── order-pay/                # Payment flow
│   ├── order-review/             # Review submission
│   ├── order-reschedule/         # Reschedule flow
│   ├── article-detail/           # Article reading
│   ├── activity-detail/          # Activity detail
│   ├── messages/                 # Message center
│   ├── coupons/                  # Coupon center
│   ├── store-detail/             # Store detail
│   ├── member/                   # Member benefits
│   ├── settings/                 # App settings
│   └── favorites/                # Favorites management
├── utils/
│   ├── request.js                # API client with dev-mode fallback
│   ├── constants.js              # Status text mappings
│   └── mock-data.js              # Demo data for offline mode
├── app.json                      # Miniprogram config (pages, tabBar)
├── app.wxss                      # Global styles
└── sitemap.json

pc-admin/
├── src/                          # PC admin dashboard
├── index.html
├── vite.config.js
└── package.json
```

## API Overview

### Public Catalog
- `GET /api/services` — List services
- `GET /api/practitioners` — List practitioners
- `GET /api/stores/:id` — Store detail
- `GET /api/schedules` — Available time slots
- `GET /api/articles/:id` — Article detail
- `GET /api/activities/:id` — Activity detail
- `GET /api/practitioners/:id` — Practitioner detail

### User (authenticated)
- `GET /api/me/summary` — User profile summary
- `GET /api/me/appointments` — My appointments
- `GET /api/me/appointments/:id` — Order detail
- `PATCH /api/me/appointments/:id/cancel` — Cancel order
- `PATCH /api/me/appointments/:id/reschedule` — Reschedule order
- `POST /api/me/appointments/:id/pay` — Process payment
- `GET /api/me/messages` — My messages
- `PATCH /api/me/messages/:id/read` — Mark message as read
- `GET /api/me/reviews` — My reviews
- `POST /api/reviews` — Submit review
- `GET /api/me/favorites` — My favorites
- `POST /api/me/favorites` — Add favorite
- `DELETE /api/me/favorites/:id` — Remove favorite
- `GET /api/coupons` — My coupons
- `POST /api/health-records` — Save health record

### Admin (authenticated, role-based)
- `GET /api/admin/dashboard` — Business dashboard
- `GET/POST/PATCH /api/admin/stores` — Store management
- `GET/POST/PATCH /api/admin/services` — Service management
- `GET/POST/PATCH /api/admin/practitioners` — Practitioner management
- `GET/POST /api/admin/schedules` — Schedule management
- `PATCH /api/admin/orders/:id/status` — Order status updates
- `GET/POST/PATCH /api/admin/commission-rules` — Commission rules
- `GET/POST/PATCH /api/admin/homepage-configs` — Homepage configuration
- `GET/POST /api/admin/activities` — Activity management
- `GET/POST /api/admin/articles` — Article management
- `GET/PATCH /api/admin/users` — User and role management
- `GET/PATCH /api/admin/reviews/:id` — Review moderation
- `GET /api/admin/payment-configs` — Payment configuration
- `PATCH /api/admin/payment-configs/:id` — Update payment config
- `GET /api/admin/audit-logs` — Admin audit logs

## Status State Machine

```
Appointments:  pending → confirmed → completed → cancelled/refunded
Payment:       unpaid → paid → refunded
```

## Development

```bash
# Backend development with auto-reload
pnpm dev:api

# PC admin development
pnpm dev:pc

# Database initialization
pnpm db:init

# Database seeding
pnpm db:seed

# Full verification
pnpm verify:all
```

## Contributing

This project welcomes contributions. Please feel free to submit issues and pull requests.

## License

MIT
