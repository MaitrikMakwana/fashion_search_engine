# Frontend Specification and Feature Checklist

This document lists the pages, features, data contracts, and implementation notes to build a modern frontend for the Fashion Search app.

## Goals
- Clean UX for search, trending, OOTD uploads, and wishlist
- Secure auth with cookie + token support
- Fast perceived performance (skeletons, caching)
- Accessible, responsive, and mobile-first

## Pages and Routes
- Home (/)
  - Search (text, image upload/image URL)
  - Platform selector (Google Shopping, Myntra, Amazon, Flipkart)
  - Trending section with Save ♥ to wishlist
  - Wishlist preview and management
- Result (/result)
  - Shows the Gemini-generated query and products
  - Client-side filters (price, color, size, brand) and sorting
  - Save ♥ to wishlist
- OOTD (/ootd)
  - Upload outfit (image + caption)
  - OOTD feed showing past uploads (thumbnail, caption, date)
  - For any item: "Shop Similar" to run a search with the image
  - Save ♥ to wishlist from results
- Auth (/login)
  - Email/password login + signup
  - Google Sign-In (using `googleClientId` from /config)

## Core Features
- Text search with Gemini spell correction or query generation
- Image-based search via Gemini vision (file upload or URL)
- Multi-platform search via SerpAPI/Google Shopping
- Trending with quick-save to wishlist
- OOTD: upload, persist, and shop similar
- Wishlist: add/remove; persistent per user
- Logout: clears cookie (server) and local token (client)

## Authentication
- Cookie: HTTP-only `token` set by server on login/signup/Google
- Client token: also returned in JSON; store in `localStorage` for API Authorization header
- Guard protected pages: redirect to `/login` if cookie/token missing
- Logout: POST `/auth/logout`, then clear local storage and redirect to `/login`

### Auth Flows
1) Login/Signup/Google
   - Call relevant endpoint → cookie set + token returned
   - Save token locally → navigate to protected page
2) Guarded pages
   - Check cookie (server) and/or token (client) before render
3) Logout
   - POST `/auth/logout` → clear local token → redirect `/login`

## API Endpoints (used by frontend)
- Auth
  - POST `/auth/signup` → `{ token, user }`
  - POST `/auth/login` → `{ token, user }`
  - POST `/auth/google` → `{ token, user }`
  - POST `/auth/logout` → `{ ok: true }`
- Config
  - GET `/config` → `{ googleClientId }`
- Search & Trending
  - POST `/search` (JSON or multipart)
  - GET `/trending?platform=all|myntra|ajio|amazon&limit=12` → `{ items: [...] }`
- Wishlist
  - GET `/wishlist` → `{ items }`
  - POST `/wishlist` body: `{ title, price, link, image, source }` → `{ item }`
  - DELETE `/wishlist/:id` → `{ ok: true }`
- OOTD
  - GET `/ootd` → `{ items }`
  - POST `/ootd` (multipart preferred) fields: `image`, `caption`
  - DELETE `/ootd/:id` → `{ ok: true }`
- Static
  - GET `/uploads/*` serves uploaded images

## Data Shapes (simplified)
- Product: `{ title, price, link, source, thumbnail }`
- WishlistItem: `{ _id, title, price, link, image, source, createdAt }`
- OOTD: `{ _id, caption, imageUrl, colors[], styleTags[], createdAt }`

## API Client (example)
```js
// api.ts - adds Authorization when a token is present
export function getToken() {
  try { return localStorage.getItem('token') || ''; } catch { return ''; }
}

export async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const token = getToken();
  if (token && !(opts.body instanceof FormData)) {
    headers['Authorization'] = `Bearer ${token}`;
    if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
  } else if (token && opts.body instanceof FormData) {
    headers['Authorization'] = `Bearer ${token}`; // do not set Content-Type manually
  }
  const res = await fetch(path, { ...opts, headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}
```

## Auth Guard (example)
```js
export function ensureAuthed() {
  try {
    const token = localStorage.getItem('token');
    if (!token) window.location.replace('/login.html');
  } catch {}
}
```

## File Upload (OOTD) (example)
```js
export async function createOotd({ file, caption }) {
  const form = new FormData();
  form.append('image', file, file.name || 'ootd.jpg');
  form.append('caption', caption || '');
  return api('/ootd', { method: 'POST', body: form });
}
```

## UI/Component Checklist
- Header
  - App title + Logout button
- Search form
  - Text input, image upload, image URL input
  - Platform selector, Submit, Clear
  - Status area + error feedback
- Trending grid
  - Card layout with image, title, source, link
  - Save ♥ button (toggles state; reflects saved/not-saved)
- Results grid (on /result)
  - Product cards with image, title, price, source, link
  - Filters: price min/max, colors, sizes, brands
  - Sorting: price/date relevance asc/desc
  - Save ♥ button
- OOTD
  - Upload section (file + caption)
  - Feed grid of uploads with date/time
  - For each upload: Shop Similar (reuses search flow with image)
- Wishlist
  - Grid of saved items with remove button
  - Empty state copy and guidance

## State Management
- Keep it simple (Context or minimal store) unless scaling
- Cache: last search result in `sessionStorage` for /result hydration
- Wishlist: cache IDs for quick Save ♥ toggling

## Performance
- Use skeletons while loading grids
- Debounce search input if adding live search
- Lazy-load images (`loading="lazy"`)
- Avoid large data URLs on the client; use multipart uploads

## Accessibility
- Semantic HTML for forms and lists
- Keyboard focus states; Enter to submit
- ARIA labels for buttons (Save/Unsave, Logout)
- Adequate color contrast

## Error Handling & UX
- Central toast/snackbar for errors
- Inline validation messages
- Retry button for network errors
- Graceful empty states

## Styling
- Mobile-first CSS grid/flex
- Theme variables (colors, spacing)
- Reusable button and card components

## Configuration
- On load, GET `/config` for `{ googleClientId }`
- Feature flags via env or server-provided config (e.g., `SPELL_ONLY` info message)

## Testing
- Unit test utils (API client, formatters)
- Integration test flows: login, search, wishlist, OOTD
- Accessibility audit (axe)

## Build & Deploy
- SPA (React/Vue) or MPA (server static) both fine
- If SPA, ensure routes fallback to index.html and server auth still protects protected pages
- Serve over HTTPS in production; set cookie `secure: true` and `sameSite: 'none'`

## Migration Checklist (from current HTML)
- [ ] Implement API client with auth header
- [ ] Recreate pages/components listed above
- [ ] Hook up endpoints and verify data contracts
- [ ] Implement Save ♥ toggle with optimistic UI
- [ ] Multipart uploads for OOTD; show uploaded thumbnail from `/uploads/...`
- [ ] Client-side filters and sorting on results
- [ ] Auth guards and logout flow
- [ ] Loading states, error handling, and empty states
- [ ] Accessibility checks and responsive layout

## Nice-to-Haves
- Persist filters per user
- Infinite scroll or pagination
- Dark mode
- Analytics for searches and saves