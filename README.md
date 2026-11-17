# Frantic Backend (NestJS + MongoDB)

A small, easy-to-follow API. The **AdminPanel** saves content here and the **Website** reads it.

```
AdminPanel ──(login + edit)──▶ Backend ──▶ MongoDB
Website   ──(read content, send leads)──▶ Backend
```

## Run

```bash
cp .env.example .env     # then edit values
npm install
npm run start:dev        # http://localhost:4000
```

- **No `MONGODB_URI`?** In development the API starts a temporary in-memory MongoDB and fills it with the
  homepage content every start (changes are lost on restart). Set `MONGODB_URI` (e.g. MongoDB Atlas) to keep data.
- On first start with an empty database it creates the first admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD`
  and loads `seed/seed-data.json` (homepage, 5 service pages, forms, SEO…). Existing data is never overwritten.

## Folder structure

```
src/
  main.ts                 start server, CORS, body size
  app.module.ts           wires everything together
  database/mongo-uri.ts   MONGODB_URI or in-memory DB for dev
  auth/                   POST /auth/login (JWT) + AuthGuard
  users/                  admin users (passwords hashed with bcrypt)
  content/                ONE generic API for all content types
  public/                 read-only API for the website + lead form
  seed/                   first admin + starting content
seed/seed-data.json       starting content (from the current homepage)
```

## API

**Login** — `POST /auth/login` `{ email, password }` → `{ accessToken, user }`
Send the token as `Authorization: Bearer <token>` to every `/admin/*` route.

**Admin (login required)**

| Method | Route | What |
|---|---|---|
| GET / POST | `/admin/:resource` | list / create |
| GET / PATCH / DELETE | `/admin/:resource/:id` | read / update / delete |
| GET / PUT | `/admin/settings/home` | hero, about, stats |
| GET / PUT | `/admin/settings/settings` | contact, offices, socials |
| GET / POST / PATCH / DELETE | `/admin/users` | admin users (admins only) |

`:resource` is one of: `servicePages, services, caseStudies, testimonials, blogs, faqs, clients, hireRoles,
industries, leads, forms, seo, redirects, media`. To add a new content type, add its name to `RESOURCES`
in `src/content/content.service.ts`.

**Public (no login, used by the website)**

| Method | Route | What |
|---|---|---|
| GET | `/public/home` | everything the homepage needs |
| GET | `/public/service-pages` | published service pages |
| GET | `/public/service-pages/:slug` | one service page |
| GET | `/public/redirects` | redirects |
| POST | `/public/leads` | website form → appears in Admin → Leads |

## Going live

- Set `NODE_ENV=production`, a real `MONGODB_URI`, a long random `JWT_SECRET` and a strong `ADMIN_PASSWORD`.
- Set `CORS_ORIGINS=https://www.franticpro.com,https://admin.franticpro.com`.
- `npm run build && npm run start:prod`
