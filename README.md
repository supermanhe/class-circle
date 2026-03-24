<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Class Circle

Mobile class-circle app with React + Express + SQLite backend.

## Run locally

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local` and configure Cloudinary variables.
3. Start the app:
   `npm run dev`

## API

- `GET /api/posts`
- `POST /api/posts`
- `POST /api/posts/:id/like`
- `POST /api/uploads/signature` (Cloudinary signed upload)
