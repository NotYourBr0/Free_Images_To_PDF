# Image to PDF Webapp

Convert multiple images (JPG/PNG) into a single downloadable PDF. Reorder images in the browser, then convert on the server.

## Tech Stack
- Frontend: React 19 + Vite
- Backend: Node.js + Express 5, Multer (uploads), PDFKit (PDF generation)
- Tooling: ESLint (frontend)

## Repo Structure
- `frontend/` — React app (Vite dev server on 5173; proxies `/api` to backend in dev)
- `backend/` — Express server (default on 5000)

## Getting Started (Local Dev)
Prerequisites: Node.js 18+

Install deps (run in two terminals or sequentially):
```bash
# Backend
cd backend
npm ci

# Frontend
cd ../frontend
npm ci
```

Run dev servers (two terminals):
```bash
# Backend (nodemon)
cd backend
npm run dev

# Frontend (Vite)
cd frontend
npm run dev
```
- Frontend dev: http://localhost:5173
- Backend dev: http://localhost:5000
- Vite dev proxy forwards `/api/*` to the backend (configured in `frontend/vite.config.js`).

## Environment Variables
Backend (`backend/.env`):
- `PORT=5000` (default; Render/other hosts usually inject `PORT` automatically)

Frontend (`frontend/.env`):
- `VITE_API_BASE_URL=`
  - Leave empty in development (Vite proxy handles `/api`).
  - Set to your backend origin in production, e.g. `https://your-backend.example.com`.

## Build & Run
Frontend:
```bash
cd frontend
npm run build     # outputs to dist/
npm run preview   # optional local preview of the build
```
Serve `frontend/dist` on your static host/CDN. Ensure `VITE_API_BASE_URL` points to your backend origin.

Backend:
```bash
cd backend
npm ci            # install
npm run start     # node src/index.js
```
No separate build step; it’s plain Node.js.

## API
Base URL: `<backend-origin>` (dev: `http://localhost:5000`)

- `GET /api/health`
  - 200 → `{ "ok": true }`

- `POST /api/convert`
  - Content-Type: `multipart/form-data`
  - Field: `images` (repeatable) — JPG/PNG
  - Limits: max 50 images; max 10MB per image
  - 200 → `application/pdf` stream; triggers download in the UI
  - 400 → `{ error: string }` for invalid type/size/count or no files
  - 500 → `{ error: string }` on server error

## How It Works
- Frontend: `src/App.jsx`
  - Select/drag-drop up to 50 images (type/size validated client-side), reorder via drag-and-drop, then submit as `FormData` to `/api/convert`.
- Backend: `src/index.js`
  - Multer writes uploaded images to `backend/uploads/`.
  - PDFKit creates a PDF in `backend/generated/` with one page per image, scaled to fit the page.
  - Responds with the PDF; then deletes the generated PDF and all uploaded images.

## Deployment
Backend (example: Render Web Service):
- Root Directory: `backend`
- Build Command: `npm ci` (or `npm ci --omit=dev`)
- Start Command: `npm run start`
- Health Check Path: `/api/health`
- Env: `PORT` is provided automatically by Render; no extra envs required by default.

Frontend (any static host: Vercel/Netlify/etc.):
- Set `VITE_API_BASE_URL` to your backend origin.
- Build locally or in CI with `npm run build` in `frontend/`.
- Deploy the `dist/` directory.

## Notes
- Reordering is preserved in the submission order.
- Images are scaled to fit each page (A4) without cropping; zero page margins.
- All temporary files are cleaned up server-side after each conversion.

## License
ISC
