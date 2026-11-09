# Conduit API - NestJS RealWorld Backend Clone

> Medium Clone RESTful API built with **NestJS**.

---

## 🛠️ Tech Stack & Key Features (Pull 1)

- **Framework:** [NestJS](https://nestjs.com/) (Modular Architecture, ESM)
- **API Documentation:** OpenAPI / Swagger UI at `/api/docs`
- **Internationalization:** `nestjs-i18n` with support for English (`en`) and Vietnamese (`vi`)
- **Testing:** Vitest & Supertest for Unit and E2E Testing

---

## 🚀 Getting Started

### 1. Requirements
- Node.js >= 20 (Tested on Node.js v24)
- npm >= 10

### 2. Setup Environment
Clone the repository and copy the environment configuration:
```bash
cp .env.example .env
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run the Application
```bash
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

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run e2e tests
npm run test:e2e
```

---

## 📋 Pull Requests Roadmap

- [x] **Pull 1:** Init project, base modular architecture, i18n, Swagger OpenAPI & Health API
- [ ] **Pull 2:** Database migration setup, User Entity, Auth (Register, Login, Redis Blacklist Logout, Current User)
- [ ] **Pull 3:** Profile, Follow/Unfollow, Polymorphic Attachments & Local Avatar upload
- [ ] **Pull 4:** Articles Module (CRUD, Feed, Tag, Paging, Favorites)
- [ ] **Pull 5:** Comments Module (CRD & Authorization)
- [ ] **Pull 6:** E2E Integration Testing (Test DB isolation, clean truncate, C2 coverage)
