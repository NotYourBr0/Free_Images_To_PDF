# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Overview

Two apps in one repo:
- `frontend/`: React app bootstrapped with Vite. Talks to the backend via the `/api` path.
- `backend/`: Express server that receives image uploads and returns a generated PDF.

Ports and proxy:
- Frontend dev server: `5173` (see `frontend/vite.config.js`).
- Backend server: `5000` by default, configurable via `PORT` (see `backend/src/index.js`).
- Vite dev proxy forwards `/api` to `http://localhost:5000`.

## Common commands

Install dependencies (run once per app):
- Frontend: `cd frontend && npm ci`
- Backend: `cd backend && npm ci`

Run in development (use two terminals):
- Backend (nodemon): `cd backend && npm run dev`
- Frontend (Vite): `cd frontend && npm run dev`

Build and preview frontend:
- Build: `cd frontend && npm run build`
- Preview build locally: `cd frontend && npm run preview`

Lint (frontend only – ESLint configured):
- Entire project: `cd frontend && npm run lint`
- Single file: `cd frontend && npx eslint src/App.jsx`

Run backend in production mode:
- `cd backend && npm run start`
- Optional port override (PowerShell): `$env:PORT=5001; npm run start`

Tests:
- No test framework or test scripts are configured in this repo at present.

## High-level architecture

Data flow
1) The React app (`frontend/src/App.jsx`) collects images (JPG/PNG), allows reordering in-memory, and submits a `FormData` payload to `/api/convert`.
2) Vite’s proxy (`frontend/vite.config.js`) forwards `/api/*` calls to the backend during development.
3) The Express server (`backend/src/index.js`) uses Multer to persist uploads under `backend/uploads/`. It generates a PDF with PDFKit into `backend/generated/`, streams it back to the client as `application/pdf`, then deletes both the generated PDF and all uploaded images.

Backend responsibilities (key points)
- Endpoints:
  - `GET /api/health` → `{ ok: true }` (simple readiness check)
  - `POST /api/convert` → returns PDF stream for download
- Upload constraints (enforced by Multer): up to 50 files; max 10MB/file; MIME types: `image/jpeg`, `image/png`.
- Directories are created at startup if missing: `uploads/` and `generated/`.
- Cleanup: generated PDF and uploaded images are removed after each request completes.
- Configuration: `PORT` env var; otherwise defaults to `5000`. `.env` is supported via `dotenv`.

Frontend responsibilities (key points)
- UI state and client-side validation (limit to 50 images, type/size checks matching the backend).
- Uses `fetch('/api/convert')` with `FormData` under the `images` field name to match the backend’s `upload.array('images', 50)`.
- On success, triggers a client-side download of the returned PDF.

## Where to change important behavior
- Frontend → Backend routing and ports: `frontend/vite.config.js` (`server.proxy['/api']`, `server.port`).
- Backend port: `backend/src/index.js` (`PORT` env var).
- Upload limits and allowed MIME types: `backend/src/index.js` (Multer `limits`, `fileFilter`, `allowedMime`).
- PDF page sizing/fit: `backend/src/index.js` (PDFKit `addPage`, `doc.image` options).
