<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Class Circle

Mobile class-circle app with React + Netlify Functions + Supabase.

## Run locally

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local` and fill Supabase + Cloudinary variables.
3. Start the app:
   `npm run dev`

## Supabase schema

Run SQL from:

- `supabase/schema.sql`

## API

- `GET /api/posts`
- `POST /api/posts`
- `POST /api/posts/:id/like`
- `POST /api/uploads/signature` (Cloudinary signed upload)

## Deploy to Netlify

1. Push repository to GitHub.
2. Create Netlify site from this repo.
3. Set environment variables in Netlify:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
   - `CLOUDINARY_FOLDER` (optional)
4. Deploy. `netlify.toml` already configures:
   - build command: `npm run build`
   - publish dir: `dist`
   - functions dir: `netlify/functions`
