# Fashion Search (Gemini + SerpAPI)

A simple fashion search app that:
- Uses Google Gemini to correct/normalize text or extract a search phrase from an image
- Searches products from Google Shopping (default) or selected platforms (Myntra, Amazon India, Flipkart) via SerpAPI
- Serves a minimal frontend with text input and image upload

## Features
- Text search with Gemini spell correction (toggle via `SPELL_ONLY`)
- Image-based search using Gemini vision
- Platform selection: Myntra, Amazon (IN), Flipkart, or default Google Shopping
- Result details page shows the Gemini query used to search

## Project Structure
```
.
├─ public/                # Static frontend
│  ├─ index.html          # Search UI (text/image + platform)
│  └─ result.html         # Shows Gemini query and product results
├─ server.js              # Express server + Gemini/SerpAPI integration
├─ package.json           # Node project manifest
├─ .env.example           # Sample env file (copy to .env)
├─ .gitignore             # Ignore secrets, node_modules, etc.
└─ README.md              # This file
```

## Prerequisites
- Node.js 18+
- Accounts/keys:
  - Google Gemini API key
  - SerpAPI key

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `.env` from the sample and add your keys:
   ```bash
   cp .env.example .env
   # edit .env and set GEMINI_API_KEY, SERPAPI_API_KEY
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Open the app:
   - http://localhost:5001

## Environment Variables
- `GEMINI_API_KEY`: Your Gemini API key
- `SERPAPI_API_KEY`: Your SerpAPI key
- `PORT`: Server port (default 5000; sample uses 5001)
- `MOCK`: `1/true` to use mock data without external calls (for testing)
- `SPELL_ONLY`: `1/true` for Gemini to only correct spelling and return corrected phrase; `0/false` to let Gemini craft a shopping-ready query

## API
- `POST /search`
  - JSON body: `{ text?: string, imageUrl?: string, platform?: 'google_shopping'|'myntra'|'amazon'|'flipkart' }`
  - Multipart: fields `image` (file), `imageUrl` (text), `text` (text), `platform` (text)
  - Response:
    ```json
    {
      "query": "<gemini-corrected-or-generated-phrase>",
      "products": [ { "title": "...", "price": "...", "link": "...", "source": "...", "thumbnail": "..." } ],
      "platform": "myntra|amazon|flipkart|google_shopping"
    }
    ```

## Frontend
- `public/index.html`: Search by text or upload an image. Select platform from dropdown.
- `public/result.html`: Displays the Gemini query and results (last search is saved via `sessionStorage`).

## Notes
- Do not commit `.env` or any secrets; `.gitignore` ignores it by default.
- For Amazon India/Flipkart/Myntra, results are sourced via SerpAPI (Amazon engine) or Google with site filters.

## License
Add a license (e.g., MIT) if you plan to open-source. Create a `LICENSE` file.