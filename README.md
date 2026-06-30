# Eventizers Auth Backend

This is a production-ready authentication backend built using Node.js, Express, PostgreSQL, and Prisma ORM.

## Tech Stack
- **Node.js** & **Express.js** (REST API)
- **PostgreSQL** (Database)
- **Prisma ORM** (Database queries and migrations)
- **JWT** (Stored in HttpOnly Cookies for security)
- **bcryptjs** (Secure password hashing)

---

## Folder Tree of Created Backend Files

```text
backend/
├── prisma/
│   ├── migrations/
│   │   └── init/
│   │       └── migration.sql
│   └── schema.prisma
├── src/
│   ├── config/
│   │   └── prisma.js
│   ├── controllers/
│   │   └── auth.controller.js
│   ├── middleware/
│   │   └── auth.middleware.js
│   ├── routes/
│   │   └── auth.routes.js
│   ├── services/
│   │   └── auth.service.js
│   ├── app.js
│   └── server.js
├── .env
├── .env.example
├── package.json
└── README.md
```

---

## PostgreSQL Setup Commands

Before running the backend, ensure you have PostgreSQL installed and running. Create a new database named `eventizers`:

Using PostgreSQL CLI (`psql`):
```sql
-- Connect to your postgres instance
psql -U postgres

-- Create database
CREATE DATABASE eventizers;
```

---

## Installation Commands

Navigate to the `backend` folder and run the following command to install the required packages:

```bash
cd backend
npm install
```

---

## Prisma Configuration & Commands

1. Make sure to configure your `DATABASE_URL` in the `.env` file in the root of the `backend/` folder:
   ```env
   DATABASE_URL="postgresql://<username>:<password>@localhost:5432/eventizers?schema=public"
   ```

2. Generate the Prisma client:
   ```bash
   npx prisma generate
   ```

3. Sync database schema or run migration:
   ```bash
   -- To run the schema onto the DB directly
   npx prisma db push

   -- OR to apply the migration history
   npx prisma migrate dev --name init
   ```

---

## Running the Application

To run the backend application in development mode (using `nodemon`):
```bash
npm run dev
```

To run in production mode:
```bash
npm start
```

The backend server runs on `http://localhost:5000` by default.

---

## API Documentation

### Register User
* **URL:** `/api/auth/register`
* **Method:** `POST`
* **Headers:** `Content-Type: application/json`
* **Body:**
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "password": "securepassword123"
  }
  ```
* **Success Response:** `201 Created` with HttpOnly cookie `token`.

### Login User
* **URL:** `/api/auth/login`
* **Method:** `POST`
* **Headers:** `Content-Type: application/json`
* **Body:**
  ```json
  {
    "email": "john@example.com",
    "password": "securepassword123"
  }
  ```
* **Success Response:** `200 OK` with HttpOnly cookie `token`.

### Logout User
* **URL:** `/api/auth/logout`
* **Method:** `POST`
* **Headers:** None
* **Success Response:** `200 OK` (cookie cleared).

### Current Authenticated User (Profile)
* **URL:** `/api/auth/me`
* **Method:** `GET`
* **Headers:** None (Uses cookie session token)
* **Success Response:** `200 OK` with user info.
* **Error Response:** `401 Unauthorized` if token is missing or invalid.
