# Conduit API - NestJS RealWorld Backend Clone

> Medium Clone RESTful API built with **NestJS**, **TypeORM**, **MySQL 8**, **Redis**, and **JWT**.

---

##  Tech Stack & Key Features (Pull 1)

- **Framework:** [NestJS](https://nestjs.com/) (Modular Architecture, ESM)
- **Database & ORM:** MySQL 8 + TypeORM (Manual Migrations CLI)
- **Caching & Revocation:** Redis 7 (Token Blacklist upon Logout)
- **Authentication:** JWT (JSON Web Tokens) with Passport Strategy & Blacklist Guard
- **API Documentation:** OpenAPI / Swagger UI at `/api/docs`
- **Internationalization:** `nestjs-i18n` with support for English (`en`) and Vietnamese (`vi`)
- **Testing:** Vitest & Supertest for Unit and E2E Testing

---

##  Getting Started

### 1. Requirements
- Node.js >= 20 (Tested on Node.js v24)
- npm >= 10
- Docker Desktop (for MySQL 8 and Redis 7)

### 2. Setup Environment
Clone the repository and copy the environment configuration:
```bash
cp .env.example .env
```

### 3. Start Database & Redis via Docker Compose
```bash
docker compose up -d
```

### 4. Run Database Migrations
```bash
npm run migration:run
```

### 5. Install Dependencies & Run
```bash
# Install dependencies
npm install

# Development mode with watch
npm run start:dev

# Production build & run
npm run build
npm run start:prod
```

Once running:
- **API Base URL:** [http://localhost:3000/api](http://localhost:3000/api)
- **Swagger Documentation:** [http://localhost:3000/api/docs](http://localhost:3000/api/docs)
- **Health Check:** [http://localhost:3000/api/health](http://localhost:3000/api/health)

---

##  Testing

```bash
# Run unit tests
npm test

# Run e2e tests
npm run test:e2e

# Run Sunlint (Sun* Coding Standards)
npm run lint:sun
```

---

##  Pull Requests Roadmap

- [x] **Pull 1:** Init project, base modular architecture, i18n, Swagger OpenAPI & Health API
- [x] **Pull 2:** Database migration setup (MySQL 8), User Entity, Auth (Register, Login, Redis Blacklist Logout, Current User)
- [ ] **Pull 3:** Profile, Follow/Unfollow, Polymorphic Attachments & Local Avatar upload
- [ ] **Pull 4:** Articles Module (CRUD, Feed, Tag, Paging, Favorites)
- [ ] **Pull 5:** Comments Module (CRD & Authorization)
- [ ] **Pull 6:** E2E Integration Testing (Test DB isolation, clean truncate, C2 coverage)
