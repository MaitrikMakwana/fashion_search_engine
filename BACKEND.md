# Backend Architecture and Operations

This document explains how the backend works, how to run it locally, the API endpoints, authentication flow, data models, and troubleshooting tips.

## Stack
- Node.js + Express (ES modules)
- MongoDB via Mongoose
- JWT auth (cookie + Authorization header)
- Google Gemini (search query generation and spell correction)
- SerpAPI (product search)
- Multer for uploads (OOTD images)

## Project Layout
- `server.js`: Main server and all routes
- `public/`: Static frontend (served by Express)
- `uploads/`: Uploaded images (served under `/uploads`)
- `package.json`: Node project config
- `.env`: Environment variables

## Environment Variables (.env)
- `PORT` (default 5000; sample uses 5001)
- `GEMINI_API_KEY` (required unless MOCK=1)
- `SERPAPI_API_KEY` (required unless MOCK=1)
- `MONGODB_URI` (MongoDB connection string)
- `JWT_SECRET` (JWT signing secret)
- `GOOGLE_CLIENT_ID` (for Google login)
- `MOCK` (1/true to return mock data)
- `SPELL_ONLY` (1/true to only do spell correction, else generate shopping query)

## Running Locally
1. Install deps: `npm install`
2. Set up `.env` with your keys
3. Start: `npm start`
4. Open http://localhost:5001

## Auth Model
- Token created on signup/login/google login using `JWT_SECRET`.
- Token sent to client in two ways:
  - HTTP-only cookie `token` (used for server-side redirects for protected pages).
  - JSON response also includes `token` for client scripts (stored in localStorage).
- Protected pages (`/`, `/index.html`, `/ootd.html`, `/result.html`) redirect to `/login.html` if no valid cookie.
- Protected APIs check either `Authorization: Bearer <token>` or cookie token.

### Endpoints (Auth)
- POST `/auth/signup` → `{ token, user }` + sets cookie
- POST `/auth/login` → `{ token, user }` + sets cookie
- POST `/auth/google` → `{ token, user }` + sets cookie
- POST `/auth/logout` → clears cookie

## Data Models
- User: `{ email, name, passwordHash, provider, avatar }`
- WishlistItem: `{ userId, title, price, link, image, source }`
- OOTD: `{ userId, caption, imageUrl, colors, styleTags }`

## Key Routes

### Public
- GET `/config` → `{ googleClientId }`
- GET `/uploads/*` (static) → serves uploaded images

### Product Search
- POST `/search` (JSON or multipart)
  - JSON: `{ text?, imageUrl?, platform? }`
  - Multipart: fields `image` (file), `imageUrl` (text), `text` (text), `platform` (text)
  - Uses Gemini to build query (spell-only or shopping query), then SerpAPI to fetch products
  - Response: `{ query, products[], platform }`

### Trending
- GET `/trending?platform=all|myntra|ajio|amazon&limit=12`
  - Uses mock data when `MOCK=1`, else live via SerpAPI

### Wishlist
- GET `/wishlist` (auth) → `{ items }`
- POST `/wishlist` (auth) → `{ item }` (body: `{ title, price, link, image, source }`)
- DELETE `/wishlist/:id` (auth) → `{ ok: true }`

### OOTD
- GET `/ootd` (auth) → `{ items }`
- POST `/ootd` (auth, multipart accepted)
  - Accepts `image` file (stored in `/uploads/ootd_<timestamp>.<ext>`) and `caption`
  - Also accepts JSON `{ imageUrl }` if not uploading a file
  - Response: `{ item }`
- DELETE `/ootd/:id` (auth) → `{ ok: true }`

## Middleware & Limits
- express.json/urlencoded limits set to `25mb` to avoid 413s
- Multer upload size limit `20mb`
- `/uploads` directory is served statically

## Security Notes
- HTTP-only cookies mitigate XSS access to tokens
- JWT expiry: 7 days
- For production, set cookie `secure: true` and `sameSite: 'none'` behind HTTPS
- Never commit `.env` to source control

## Common Flows
- Login/Signup → cookie set → navigate to `/` → server verifies cookie → page served
- Save to Wishlist → POST `/wishlist` with Bearer or cookie auth → render items
- OOTD Upload → POST `/ootd` with multipart → item saved with `imageUrl` pointing to `/uploads/...`
- Shop Similar from OOTD → file used to query Gemini and SerpAPI

## Troubleshooting
- 413 Payload Too Large: already mitigated via body limits + multipart for images
- Not redirected to login: check cookie presence and JWT validity; verify `JWT_SECRET`
- Images not displaying: ensure `/uploads` exists and server restarted; check `imageUrl` in DB
- Missing results: verify `GEMINI_API_KEY` and `SERPAPI_API_KEY`, or set `MOCK=1` for testing

## Scripts
- `npm start` → runs `node server.js`

## Future Enhancements
- Move image storage to S3/Cloudinary
- Add refresh tokens and rotation
- Rate limiting and input validation
- Better platform-specific scrapers when not using SerpAPI