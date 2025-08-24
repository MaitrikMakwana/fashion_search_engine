// Fashion Search Engine backend
// Features:
// - POST /search accepts either:
//    a) JSON: { imageUrl?: string, text?: string }
//    b) multipart/form-data with fields: image (file) or imageUrl (text) or text (text)
// - Uses Google Gemini to create a shopping-friendly query from text or image
//   * Text -> gemini-pro
//   * Image -> gemini-pro-vision
// - Uses SerpAPI (google_shopping) to fetch product results

import express from 'express';
import fetch from 'node-fetch';
import multer from 'multer';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import cors from 'cors';

// Load env vars from .env if present
dotenv.config();

const app = express();

// Enable CORS for frontend development
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5001'],
  credentials: true
}));

// Increase body limits to avoid 413 for larger payloads (e.g., data URLs)
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Serve static frontend
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve React frontend build only (no legacy public HTML)
const frontendBuildPath = path.join(__dirname, 'frontend', 'build');
if (fs.existsSync(frontendBuildPath)) {
  app.use(express.static(frontendBuildPath));
}

// Static for uploaded files
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Gate: if not authenticated, redirect to login for main app pages (using cookie)
function getCookieToken(req) {
  const raw = req.headers.cookie || '';
  const parts = raw.split(';').map(s => s.trim());
  for (const p of parts) { if (p.startsWith('token=')) return decodeURIComponent(p.slice(6)); }
  return null;
}



// Public config for frontend initialization (e.g., Google Client ID)
app.get('/config', (req, res) => {
  res.json({ googleClientId: GOOGLE_CLIENT_ID });
});

// Multer for OOTD uploads (saves to disk)
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      // Derive a safe extension from original name or fallback to MIME type
      const mimeExtMap = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/bmp': 'bmp'
      };
      let ext = (file.originalname && file.originalname.includes('.') ? file.originalname.split('.').pop() : '') || '';
      ext = ext && ext !== file.originalname ? ext.toLowerCase() : '';
      if (!ext || ext === 'null' || ext === 'blob') {
        ext = mimeExtMap[file.mimetype] || 'jpg';
      }
      cb(null, `ootd_${Date.now()}.${ext}`);
    }
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  },
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB max
});

// Multer for search uploads (keeps in memory)
const searchUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (req, file, cb) => {
    // Only accept image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only image files (JPEG, PNG, GIF, WebP, BMP) are allowed.`), false);
    }
  }
});

const PORT = process.env.PORT || 5000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'changeme';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const MOCK = String(process.env.MOCK || '').toLowerCase() === '1' || String(process.env.MOCK || '').toLowerCase() === 'true';
const SPELL_ONLY = String(process.env.SPELL_ONLY || '').toLowerCase() === '1' || String(process.env.SPELL_ONLY || '').toLowerCase() === 'true';

// Connect to MongoDB (after env vars are defined)
if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err.message));
} else {
  console.warn('MONGODB_URI not set. Database features disabled.');
}

const GEMINI_TEXT_MODEL = 'gemini-1.5-flash';
const GEMINI_VISION_MODEL = 'gemini-1.5-flash';

// Helper: fetch image and convert to base64 for Gemini inline_data
async function fetchImageAsBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const arrayBuf = await res.arrayBuffer();
  const base64 = Buffer.from(arrayBuf).toString('base64');
  return { base64, contentType };
}

// Helper: parse Gemini generateContent response to text
function parseGeminiText(json) {
  return (json?.candidates?.[0]?.content?.parts || [])
    .map(p => (p.text || '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

async function queryGeminiFromText(text) {
  const taskPrompt = SPELL_ONLY
    ? [
        'You are a shopping assistant.',
        'Task: Correct spelling and normalize the phrase for product search.',
        'Return ONLY the corrected phrase without quotes.'
      ].join('\n')
    : [
        'You are a fashion expert creating shopping search queries.',
        'TASK: Convert this description into a precise shopping search query for fashion items.',
        '',
        'INCLUDE THESE ELEMENTS:',
        '- Clothing type (shirt, dress, pants, shoes, bag, etc.)',
        '- Color if mentioned',
        '- Material if specified (cotton, denim, leather, silk, etc.)',
        '- Style (casual, formal, vintage, sporty, elegant, etc.)',
        '- Gender if clear (men\'s, women\'s, unisex)',
        '- Distinctive features (buttons, patterns, fit, design elements)',
        '',
        'EXAMPLES:',
        '- "red cotton t-shirt casual women\'s fashion"',
        '- "black leather jacket men\'s biker style"',
        '- "blue denim jeans high-waisted women\'s"',
        '- "white sneakers casual footwear"',
        '- "floral summer dress women\'s casual"',
        '',
        'Write ONLY the search query - no explanations or quotes.'
      ].join('\n');

  const prompt = `${taskPrompt}\n\nUser description:\n${text}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    contents: [
      { role: 'user', parts: [{ text: prompt }] }
    ]
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    throw new Error(`Gemini text error: ${resp.status} ${await resp.text()}`);
  }
  const json = await resp.json();
  console.log('Gemini text response:', JSON.stringify(json, null, 2));
  const out = parseGeminiText(json);
  if (!out) throw new Error('Empty Gemini text result');
  
  // Check if the response contains error indicators or is too generic
  const lowerOut = out.toLowerCase();
  if (lowerOut.includes('cannot provide') || 
      lowerOut.includes('no shopping query') || 
      lowerOut.includes('cannot analyze') ||
      lowerOut.includes('unable to') ||
      lowerOut.includes('error') ||
      lowerOut.includes('sorry') ||
      lowerOut.includes('i cannot') ||
      lowerOut.includes('i don\'t understand') ||
      out.length < 3 || // Too short
      out.length > 200) { // Too long
    throw new Error(`Gemini returned invalid response: ${out}`);
  }
  
  console.log('Parsed Gemini text query:', out);
  return out;
}

async function queryGeminiFromImage({ base64, contentType }, caption) {
  // Always use enhanced prompt for image analysis, regardless of SPELL_ONLY setting
  const task = `You are a fashion expert analyzing clothing images. Look at this image carefully and identify the specific fashion items.

TASK: Create a precise shopping search query for the clothing/fashion items you see.

ANALYSIS STEPS:
1. Identify the main clothing item (shirt, dress, pants, jeans, jacket, shoes, bag, etc.)
2. Note the color(s) visible
3. Identify the material if clear (cotton, denim, leather, silk, etc.)
4. Determine the style (casual, formal, vintage, sporty, elegant, etc.)
5. Specify gender if obvious (men's, women's, unisex)
6. Note any distinctive features (buttons, patterns, fit, design elements)

EXAMPLES OF GOOD QUERIES:
- "red cotton t-shirt casual women's fashion"
- "black leather jacket men's biker style"
- "blue denim jeans high-waisted women's"
- "white sneakers casual footwear"
- "floral summer dress women's casual"
- "striped polo shirt men's cotton"
- "black handbag leather women's"

IMPORTANT: 
- Be specific about the item type
- Include color and style when visible
- Write ONLY the search query - no explanations, quotes, or additional text
- If you cannot identify clothing items, return "fashion clothing style"`;
  const promptParts = [];
  promptParts.push({ text: task });
  if (caption && caption.trim()) {
    promptParts.push({ text: `Additional context from user: ${caption.trim()}` });
  }
  promptParts.push({ inline_data: { mime_type: contentType, data: base64 } });

  // Validate image data
  if (!base64 || base64.length < 100) {
    throw new Error('Invalid image data: image too small or corrupted');
  }
  
  console.log('Sending image to Gemini for analysis...');
  console.log('Image size:', base64.length, 'characters');
  console.log('Content type:', contentType);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const body = { contents: [{ role: 'user', parts: promptParts }] };

  // Add timeout to prevent hanging
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!resp.ok) {
      throw new Error(`Gemini vision error: ${resp.status} ${await resp.text()}`);
    }
    const json = await resp.json();
    console.log('Gemini vision response:', JSON.stringify(json, null, 2));
    const out = parseGeminiText(json);
    if (!out) throw new Error('Empty Gemini vision result');
    
    // Check if the response contains error indicators or is too generic
    const lowerOut = out.toLowerCase();
    if (lowerOut.includes('cannot provide') || 
        lowerOut.includes('no shopping query') || 
        lowerOut.includes('cannot analyze') ||
        lowerOut.includes('unable to') ||
        lowerOut.includes('error') ||
        lowerOut.includes('sorry') ||
        lowerOut.includes('i cannot') ||
        lowerOut.includes('i don\'t see') ||
        lowerOut.includes('no clothing') ||
        lowerOut.includes('no fashion') ||
        out.length < 5 || // Too short
        out.length > 200) { // Too long
      throw new Error(`Gemini returned invalid response: ${out}`);
    }
    
    console.log('Parsed Gemini vision query:', out);
    return out;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function searchSerpApi(searchQuery) {
  const serpUrl = new URL('https://serpapi.com/search.json');
  serpUrl.searchParams.set('engine', 'google_shopping');
  serpUrl.searchParams.set('q', searchQuery);
  serpUrl.searchParams.set('gl', 'in'); // country: India
  serpUrl.searchParams.set('hl', 'en');
  serpUrl.searchParams.set('google_domain', 'google.co.in');
  serpUrl.searchParams.set('num', '20'); // Get more results
  serpUrl.searchParams.set('api_key', SERPAPI_API_KEY);

  const serpResp = await fetch(serpUrl.toString());
  if (!serpResp.ok) {
    throw new Error(`SerpAPI error: ${serpResp.status} ${await serpResp.text()}`);
  }
  const serpJson = await serpResp.json();
  const products = (serpJson?.shopping_results || []).map(item => {
    const currency = item.currency || item.currency_symbol;
    let priceStr = item.price || null;
    if (!priceStr && item.extracted_price != null) {
      // Only format INR explicitly; otherwise leave null to be filtered later
      if (currency === 'INR' || currency === '₹') priceStr = `₹${item.extracted_price}`;
    }
    return {
      title: item.title ?? null,
      price: priceStr,
      link: item.link ?? null,
      source: item.source ?? null,
      thumbnail: item.thumbnail ?? null
    };
  });
  return products;
}

async function searchAmazonIn(searchQuery) {
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'amazon');
  url.searchParams.set('amazon_domain', 'amazon.in');
  url.searchParams.set('gl', 'in');
  url.searchParams.set('hl', 'en');
  url.searchParams.set('k', searchQuery);
  url.searchParams.set('num', '10'); // Get more results
  url.searchParams.set('api_key', SERPAPI_API_KEY);

  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`SerpAPI amazon error: ${resp.status} ${await resp.text()}`);
  const json = await resp.json();
  const items = json?.organic_results || [];
  return items.map(item => {
    // prefer INR price if present
    let price = item.price || item.price_raw || null;
    if (price && typeof price === 'string' && !price.includes('₹') && item.currency === 'INR') {
      price = `₹${price.replace(/[^\d.]/g, '')}`;
    }
    return {
      title: item.title ?? null,
      price,
      link: item.link ?? null,
      source: 'Amazon',
      thumbnail: item.thumbnail ?? null
    };
  });
}

async function searchGoogleSite(searchQuery, site) {
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google');
  url.searchParams.set('google_domain', 'google.co.in');
  url.searchParams.set('gl', 'in');
  url.searchParams.set('hl', 'en');
  url.searchParams.set('q', `site:${site} ${searchQuery}`);
  url.searchParams.set('api_key', SERPAPI_API_KEY);

  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`SerpAPI google(site:${site}) error: ${resp.status} ${await resp.text()}`);
  const json = await resp.json();
  const items = json?.organic_results || [];
  return items.map(item => ({
    title: item.title ?? null,
    price: null, // price not extracted from organic results; fallback to null
    link: item.link ?? null,
    source: site.replace(/^www\./, ''),
    thumbnail: item.thumbnail ?? item.thumbnail_url ?? null
  }));
}

// ---- Trending: simple scraping via SERP + TF-IDF diversity ----
function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w && !stopwords.has(w));
}

const stopwords = new Set('a,an,the,and,or,of,in,on,for,with,to,from,by,is,are,was,were,be,as,at,that,this,these,those,men,man,women,woman,unisex,kids,boys,girls,new,latest,online,shop,shopping,buy,style,styles,trend,trending,popular,best,seller,sellers,collection,collections,2024,2025'.split(','));

function buildTfIdfEmbeddings(texts) {
  const docs = texts.map(t => tokenize(t));
  const df = new Map();
  for (const doc of docs) {
    const uniq = new Set(doc);
    for (const w of uniq) df.set(w, (df.get(w) || 0) + 1);
  }
  const N = docs.length;
  const vecs = docs.map(doc => {
    const tf = new Map();
    for (const w of doc) tf.set(w, (tf.get(w) || 0) + 1);
    const len = doc.length || 1;
    const v = new Map();
    for (const [w, c] of tf) {
      const idf = Math.log((N + 1) / ((df.get(w) || 0) + 1)) + 1; // smoothed idf
      v.set(w, (c / len) * idf);
    }
    return v;
  });
  return vecs;
}

function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (const [k, va] of a) {
    na += va * va;
    const vb = b.get(k);
    if (vb != null) dot += va * vb;
  }
  for (const [, vb] of b) nb += vb * vb;
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function selectDiverse(items, titles, k) {
  if (items.length <= k) return items;
  const vecs = buildTfIdfEmbeddings(titles);
  const selected = [];
  const candidates = items.map((it, i) => ({ i, it }));
  // Greedy max-min diversity starting from first
  selected.push(candidates.shift());
  while (selected.length < k && candidates.length) {
    let best = null, bestScore = -1, bestIdx = -1;
    for (let ci = 0; ci < candidates.length; ci++) {
      const { i } = candidates[ci];
      let minSim = 1;
      for (const s of selected) {
        const sim = cosineSim(vecs[i], vecs[s.i]);
        if (sim < minSim) minSim = sim;
      }
      if (minSim > bestScore) { bestScore = minSim; best = candidates[ci]; bestIdx = ci; }
    }
    if (best) {
      selected.push(best);
      candidates.splice(bestIdx, 1);
    } else break;
  }
  return selected.map(s => s.it);
}

async function getTrending({ limit = 12 }) {
  const kwPool = [
    'trending fashion', 'best sellers', 'new arrivals', 'most popular',
    'streetwear', 'summer collection', 'ethnic wear', 'sneakers', 't-shirts', 'hoodies'
  ];
  const sites = ['myntra.com', 'ajio.com', 'amazon.in', 'flipkart.com'];

  const results = [];
  // Pick up to 2 random keywords per site
  for (const site of sites) {
    const picked = kwPool.sort(() => Math.random() - 0.5).slice(0, 2);
    for (const kw of picked) {
      try {
        const items = await searchGoogleSite(kw, site);
        for (const it of items) {
          if (it && it.title && it.link) results.push(it);
        }
      } catch (e) {
        // continue on error
      }
    }
  }

  // Deduplicate by URL and title
  const seenLink = new Set();
  const deduped = [];
  for (const it of results) {
    const key = (it.link || '').split('?')[0];
    const tkey = (it.title || '').toLowerCase().trim();
    const combo = key + '|' + tkey;
    if (seenLink.has(combo)) continue;
    seenLink.add(combo);
    deduped.push(it);
  }

  // Select diverse top-N via TF-IDF
  const titles = deduped.map(d => d.title || '');
  const diverse = selectDiverse(deduped, titles, Number(limit) || 12);

  // Shuffle to vary order a bit
  diverse.sort(() => Math.random() - 0.5);
  return diverse;
}

async function searchProducts(searchQuery) {
  // Aggregate: Google Shopping India + Amazon.in + Flipkart + Myntra via site search
  const providers = [
    () => searchSerpApi(searchQuery),
    () => searchAmazonIn(searchQuery),
    () => searchGoogleSite(searchQuery, 'flipkart.com'),
    () => searchGoogleSite(searchQuery, 'myntra.com'),
  ];
  
  // Run all providers concurrently for better performance
  const results = await Promise.allSettled(providers.map(provider => provider()));
  
  const out = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      out.push(...result.value);
    }
  }
  
  // Deduplicate by link+title with better matching
  const seen = new Set();
  const deduped = [];
  for (const it of out) {
    if (!it || !it.title || !it.link) continue; // Skip invalid items
    
    // Create a more robust key for deduplication
    const linkKey = (it.link || '').split('?')[0].toLowerCase();
    const titleKey = (it.title || '').toLowerCase().trim();
    const key = `${linkKey}|${titleKey}`;
    
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(it);
  }
  
  console.log(`Search results: ${out.length} total, ${deduped.length} after deduplication`);
  return deduped;
}

// Filtering & sorting helpers
function parsePriceToNumber(price) {
  if (price == null) return null;
  if (typeof price === 'number') return price;
  const s = String(price).replace(/[,\s]/g, '').replace(/[₹$€£]/g, '');
  const m = s.match(/(\d+\.?\d*)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : null;
}

function normalizeProduct(p) {
  const title = p.title || '';
  const priceNumber = parsePriceToNumber(p.price);
  return {
    ...p,
    priceNumber,
    _titleLower: title.toLowerCase(),
    _sourceLower: (p.source || '').toLowerCase(),
    _linkLower: (p.link || '').toLowerCase(),
  };
}

function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean).map(String);
  return String(val)
    .split(/[,|]/)
    .map(s => s.trim())
    .filter(Boolean);
}

function applyFilters(products, { minPrice, maxPrice, colors, sizes, brands }) {
  const colorList = toArray(colors).map(s => s.toLowerCase());
  const sizeList = toArray(sizes).map(s => s.toLowerCase());
  const brandList = toArray(brands).map(s => s.toLowerCase());
  const minP = minPrice != null && minPrice !== '' ? Number(minPrice) : null;
  const maxP = maxPrice != null && maxPrice !== '' ? Number(maxPrice) : null;

  return products.filter(p => {
    // Only filter by price if a numeric price exists; unknown prices pass through
    if (minP != null && p.priceNumber != null && p.priceNumber < minP) return false;
    if (maxP != null && p.priceNumber != null && p.priceNumber > maxP) return false;

    if (colorList.length) {
      const match = colorList.some(c => p._titleLower.includes(c));
      if (!match) return false;
    }
    if (sizeList.length) {
      const match = sizeList.some(s => p._titleLower.includes(s));
      if (!match) return false;
    }
    if (brandList.length) {
      const hay = p._titleLower + ' ' + p._sourceLower + ' ' + p._linkLower;
      const match = brandList.some(b => hay.includes(b));
      if (!match) return false;
    }
    return true;
  });
}

// Enhanced semantic re-rank: prioritize titles closer to the query tokens
function rerankByQueryHeuristics(products, query) {
  if (!query || !products.length) return products;
  
  const q = query.toLowerCase();
  const tokens = q.split(/[^a-z0-9]+/).filter(Boolean);
  if (!tokens.length) return products;
  
  const scored = products.map(p => {
    const t = (p.title || '').toLowerCase();
    const s = (p.source || '').toLowerCase();
    let score = 0;
    
    // Score based on token matches
    for (const tok of tokens) {
      if (!tok || tok.length < 2) continue; // Skip very short tokens
      
      // Higher weight for full-word matches
      if (new RegExp(`\\b${tok}\\b`).test(t)) score += 5;
      else if (t.includes(tok)) score += 2;
      
      // Bonus for source matching
      if (s.includes(tok)) score += 1;
    }
    
    // Bonus for fashion-specific terms in title
    const fashionTerms = ['shirt', 'dress', 'pant', 'jean', 'shoe', 'bag', 'jacket', 'coat', 'skirt', 'top', 'blouse', 'sneaker', 'boot', 'handbag', 'purse', 'jewelry', 'accessory', 'fashion', 'style', 'wear', 'clothing'];
    const titleFashionMatches = fashionTerms.filter(term => t.includes(term)).length;
    score += titleFashionMatches * 0.5;
    
    // Bonus for color matches
    const colors = ['red', 'blue', 'green', 'yellow', 'black', 'white', 'pink', 'purple', 'orange', 'brown', 'gray', 'grey', 'navy', 'maroon', 'beige', 'cream'];
    const colorMatches = colors.filter(color => t.includes(color)).length;
    score += colorMatches * 0.3;
    
    // Bonus for having a price
    if (p.price && p.price !== 'null') score += 1;
    
    // Bonus for having a thumbnail
    if (p.thumbnail) score += 0.5;
    
    return { p, score };
  });
  
  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.p);
}

function applySort(products, sortBy, sortOrder) {
  const order = (sortOrder || 'asc').toLowerCase();
  const dir = order === 'desc' ? -1 : 1;
  if ((sortBy || '').toLowerCase() === 'price') {
    return [...products].sort((a, b) => {
      const pa = a.priceNumber, pb = b.priceNumber;
      if (pa == null && pb == null) return 0;
      if (pa == null) return 1; // nulls last
      if (pb == null) return -1;
      return (pa - pb) * dir;
    });
  }
  return products;
}

function stripInternalFields(products) {
  return products.map(({ _titleLower, _sourceLower, _linkLower, priceNumber, ...rest }) => rest);
}

// Real-time price fetching from original sites
async function fetchRealTimePrice(product) {
  if (!product.link) return product;
  
  try {
    const source = product.source?.toLowerCase() || '';
    let price = null;
    
    // Fetch price based on the source
    if (source.includes('amazon')) {
      price = await fetchAmazonPrice(product.link);
    } else if (source.includes('myntra')) {
      price = await fetchMyntraPrice(product.link);
    } else if (source.includes('ajio')) {
      price = await fetchAjioPrice(product.link);
    } else if (source.includes('flipkart')) {
      price = await fetchFlipkartPrice(product.link);
    } else if (source.includes('snapdeal')) {
      price = await fetchSnapdealPrice(product.link);
    }
    
    if (price) {
      return { ...product, price: `₹${price}`, priceUpdated: true };
    }
  } catch (error) {
    console.error(`Failed to fetch real-time price for ${product.title}:`, error);
  }
  
  return product;
}

// Fetch price from Amazon
async function fetchAmazonPrice(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) return null;
    
    const html = await response.text();
    
    // Try multiple price selectors for Amazon
    const priceSelectors = [
      '.a-price-whole',
      '.a-price .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '.a-price-range .a-price-whole'
    ];
    
    for (const selector of priceSelectors) {
      const priceMatch = html.match(new RegExp(`<span[^>]*class="[^"]*${selector.replace('.', '')}[^"]*"[^>]*>([^<]+)</span>`));
      if (priceMatch) {
        const price = priceMatch[1].replace(/[^\d]/g, '');
        if (price && !isNaN(parseInt(price))) {
          return parseInt(price);
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Amazon price fetch error:', error);
    return null;
  }
}

// Fetch price from Myntra
async function fetchMyntraPrice(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) return null;
    
    const html = await response.text();
    
    // Myntra price selectors
    const priceSelectors = [
      '.pdp-price',
      '.pdp-discounted-price',
      '.pdp-mrp',
      '[data-testid="price"]'
    ];
    
    for (const selector of priceSelectors) {
      const priceMatch = html.match(new RegExp(`<span[^>]*class="[^"]*${selector.replace('.', '')}[^"]*"[^>]*>([^<]+)</span>`));
      if (priceMatch) {
        const price = priceMatch[1].replace(/[^\d]/g, '');
        if (price && !isNaN(parseInt(price))) {
          return parseInt(price);
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Myntra price fetch error:', error);
    return null;
  }
}

// Fetch price from Ajio
async function fetchAjioPrice(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) return null;
    
    const html = await response.text();
    
    // Ajio price selectors
    const priceSelectors = [
      '.prod-sp',
      '.prod-mrp',
      '.price',
      '.discounted-price'
    ];
    
    for (const selector of priceSelectors) {
      const priceMatch = html.match(new RegExp(`<span[^>]*class="[^"]*${selector.replace('.', '')}[^"]*"[^>]*>([^<]+)</span>`));
      if (priceMatch) {
        const price = priceMatch[1].replace(/[^\d]/g, '');
        if (price && !isNaN(parseInt(price))) {
          return parseInt(price);
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Ajio price fetch error:', error);
    return null;
  }
}

  // Fetch price from Flipkart
async function fetchFlipkartPrice(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) return null;
    
    const html = await response.text();
    
    // Flipkart price selectors
    const priceSelectors = [
      '._30jeq3',
      '._16Jk6d',
      '._1vC4OE',
      '.price'
    ];
    
    for (const selector of priceSelectors) {
      const priceMatch = html.match(new RegExp(`<div[^>]*class="[^"]*${selector.replace('.', '')}[^"]*"[^>]*>([^<]+)</div>`));
      if (priceMatch) {
        const price = priceMatch[1].replace(/[^\d]/g, '');
        if (price && !isNaN(parseInt(price))) {
          return parseInt(price);
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Flipkart price fetch error:', error);
    return null;
  }
}

// Fetch price from Snapdeal
async function fetchSnapdealPrice(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) return null;
    
    const html = await response.text();
    
    // Snapdeal price selectors
    const priceSelectors = [
      '.payBlkBig',
      '.pdp-final-price',
      '.price'
    ];
    
    for (const selector of priceSelectors) {
      const priceMatch = html.match(new RegExp(`<span[^>]*class="[^"]*${selector.replace('.', '')}[^"]*"[^>]*>([^<]+)</span>`));
      if (priceMatch) {
        const price = priceMatch[1].replace(/[^\d]/g, '');
        if (price && !isNaN(parseInt(price))) {
          return parseInt(price);
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Snapdeal price fetch error:', error);
    return null;
  }
}

  // Enhance products with real-time price fetching (optimized)
async function enhanceProductPrices(products) {
  // Limit to first 5 products for performance, and only fetch real-time prices for products with links
  const productsToEnhance = products.slice(0, 5).filter(product => product.link);
  const productsWithoutLinks = products.slice(0, 10).filter(product => !product.link);
  
  // Fetch real-time prices concurrently with timeout
  const enhancedProductsWithLinks = await Promise.allSettled(
    productsToEnhance.map(product => 
      Promise.race([
        fetchRealTimePrice(product),
        new Promise(resolve => setTimeout(() => resolve(product), 2000)) // 2 second timeout
      ])
    )
  );
  
  // Process results
  const enhancedProducts = [];
  
  // Add products with real-time prices
  enhancedProductsWithLinks.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value.priceUpdated) {
      enhancedProducts.push(result.value);
    } else {
      // Fallback to title extraction
      const product = productsToEnhance[index];
      let fallbackProduct = { ...product };
      
      // If no price is available, try to extract from title
      if (!fallbackProduct.price || fallbackProduct.price === 'null') {
        const priceMatch = fallbackProduct.title?.match(/₹?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/);
        if (priceMatch) {
          const price = priceMatch[1].replace(/,/g, '');
          fallbackProduct.price = `₹${price}`;
        } else {
          // Try to find price patterns like "Rs. 999" or "999/-"
          const altPriceMatch = fallbackProduct.title?.match(/(?:Rs?\.?\s*|₹\s*|price\s*:?\s*)(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)(?:\s*\/-|\s*only)?/i);
          if (altPriceMatch) {
            const price = altPriceMatch[1].replace(/,/g, '');
            fallbackProduct.price = `₹${price}`;
          }
        }
      }
      
      // Ensure price has proper formatting
      if (fallbackProduct.price && fallbackProduct.price !== 'null') {
        // Remove any existing currency symbols and add ₹
        const cleanPrice = fallbackProduct.price.replace(/[₹$€£]/g, '').trim();
        if (cleanPrice && !isNaN(parseFloat(cleanPrice))) {
          fallbackProduct.price = `₹${parseFloat(cleanPrice).toFixed(0)}`;
        }
      }
      
      enhancedProducts.push(fallbackProduct);
    }
  });
  
  // Add products without links (apply title extraction)
  productsWithoutLinks.forEach(product => {
    let enhancedProduct = { ...product };
    
    // If no price is available, try to extract from title
    if (!enhancedProduct.price || enhancedProduct.price === 'null') {
      const priceMatch = enhancedProduct.title?.match(/₹?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/);
      if (priceMatch) {
        const price = priceMatch[1].replace(/,/g, '');
        enhancedProduct.price = `₹${price}`;
      } else {
        // Try to find price patterns like "Rs. 999" or "999/-"
        const altPriceMatch = enhancedProduct.title?.match(/(?:Rs?\.?\s*|₹\s*|price\s*:?\s*)(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)(?:\s*\/-|\s*only)?/i);
        if (altPriceMatch) {
          const price = altPriceMatch[1].replace(/,/g, '');
          enhancedProduct.price = `₹${price}`;
        }
      }
    }
    
    // Ensure price has proper formatting
    if (enhancedProduct.price && enhancedProduct.price !== 'null') {
      // Remove any existing currency symbols and add ₹
      const cleanPrice = enhancedProduct.price.replace(/[₹$€£]/g, '').trim();
      if (cleanPrice && !isNaN(parseFloat(cleanPrice))) {
        enhancedProduct.price = `₹${parseFloat(cleanPrice).toFixed(0)}`;
      }
    }
    
    enhancedProducts.push(enhancedProduct);
  });
  
  // Add remaining products (beyond first 10) with basic price formatting
  const remainingProducts = products.slice(10).map(product => {
    let enhancedProduct = { ...product };
    
    // Basic price formatting for remaining products
    if (enhancedProduct.price && enhancedProduct.price !== 'null') {
      const cleanPrice = enhancedProduct.price.replace(/[₹$€£]/g, '').trim();
      if (cleanPrice && !isNaN(parseFloat(cleanPrice))) {
        enhancedProduct.price = `₹${parseFloat(cleanPrice).toFixed(0)}`;
      }
    }
    
    return enhancedProduct;
  });
  
  return [...enhancedProducts, ...remainingProducts];
}

// Generate comparison data by grouping products by company/source
function generateComparisonData(products) {
  if (!products || products.length === 0) {
    return {
      companies: [],
      companyGroups: {},
      priceStats: null,
      bestDeals: []
    };
  }

  // Group products by company/source
  const companyGroups = {};
  const priceStats = {
    min: Infinity,
    max: -Infinity,
    avg: 0,
    total: 0,
    count: 0
  };

  products.forEach(product => {
    const source = product.source || 'Unknown';
    if (!companyGroups[source]) {
      companyGroups[source] = [];
    }
    companyGroups[source].push(product);

    // Calculate price statistics
    const priceNumber = parsePriceToNumber(product.price);
    if (priceNumber !== null && priceNumber !== undefined) {
      priceStats.min = Math.min(priceStats.min, priceNumber);
      priceStats.max = Math.max(priceStats.max, priceNumber);
      priceStats.total += priceNumber;
      priceStats.count++;
    }
  });

  // Calculate average price
  if (priceStats.count > 0) {
    priceStats.avg = priceStats.total / priceStats.count;
  } else {
    priceStats.min = null;
    priceStats.max = null;
    priceStats.avg = null;
  }

  // Find best deals (lowest price per company)
  const bestDeals = Object.entries(companyGroups).map(([company, companyProducts]) => {
    const validProducts = companyProducts.filter(p => {
      const price = parsePriceToNumber(p.price);
      return price !== null && price !== undefined;
    });
    
    if (validProducts.length === 0) return null;
    
    const lowest = validProducts.reduce((min, p) => {
      const price = parsePriceToNumber(p.price);
      const minPrice = parsePriceToNumber(min.price);
      return price < minPrice ? p : min;
    });
    
    return {
      company,
      product: lowest,
      price: parsePriceToNumber(lowest.price)
    };
  }).filter(Boolean).sort((a, b) => a.price - b.price);

  // Sort companies by number of products (descending)
  const companies = Object.keys(companyGroups).sort((a, b) => 
    companyGroups[b].length - companyGroups[a].length
  );

  return {
    companies,
    companyGroups,
    priceStats: priceStats.count > 0 ? priceStats : null,
    bestDeals,
    totalProducts: products.length,
    priceRange: priceStats.count > 0 ? {
      lowest: priceStats.min,
      highest: priceStats.max,
      difference: priceStats.max - priceStats.min
    } : null
  };
}

// --- Models ---
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  name: String,
  passwordHash: String,
  provider: { type: String, default: 'local' }, // local | google
  avatar: String,
}, { timestamps: true });

const wishlistItemSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  title: String,
  price: String,
  link: String,
  image: String,
  source: String,
}, { timestamps: true });

const ootdSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  caption: String,
  imageUrl: String,
  colors: [String],
  styleTags: [String],
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', userSchema);
const WishlistItem = mongoose.models.WishlistItem || mongoose.model('WishlistItem', wishlistItemSchema);
const OOTD = mongoose.models.OOTD || mongoose.model('OOTD', ootdSchema);

// Comparison session schema
const comparisonSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  name: String, // User-defined name for the comparison
  products: [{
    productId: String, // Original product ID from search
    title: String,
    price: String,
    priceNumber: Number,
    link: String,
    source: String, // Company/site name (Myntra, Ajio, etc.)
    thumbnail: String,
    rating: Number,
    reviews: Number,
    availability: String,
    shipping: String,
    originalData: Object // Store complete original product data
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const ComparisonSession = mongoose.models.ComparisonSession || mongoose.model('ComparisonSession', comparisonSessionSchema);

// --- Auth helpers ---
function signToken(u) { return jwt.sign({ uid: u._id, email: u.email }, JWT_SECRET, { expiresIn: '7d' }); }
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  let token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) token = getCookieToken(req);
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try { req.user = jwt.verify(token, JWT_SECRET); return next(); }
  catch { return res.status(401).json({ error: 'Invalid token' }); }
}

// --- Outfit Analysis Helpers ---


// --- Auth routes ---
app.post('/auth/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email already registered' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, name, passwordHash, provider: 'local' });
    const token = signToken(user);
    res.cookie?.('token', token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 7*24*3600*1000 });
    return res.json({ token, user: { id: user._id, email: user.email, name: user.name } });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Signup failed' }); }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const user = await User.findOne({ email });
    if (!user || !user.passwordHash) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = signToken(user);
    res.cookie?.('token', token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 7*24*3600*1000 });
    return res.json({ token, user: { id: user._id, email: user.email, name: user.name } });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Login failed' }); }
});

const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;
app.post('/auth/google', async (req, res) => {
  try {
    if (!googleClient) return res.status(500).json({ error: 'Google not configured' });
    const { credential } = req.body || {};
    if (!credential) return res.status(400).json({ error: 'credential required' });
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const email = payload.email;
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({ email, name: payload.name, avatar: payload.picture, provider: 'google' });
    }
    const token = signToken(user);
    res.cookie?.('token', token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 7*24*3600*1000 });
    return res.json({ token, user: { id: user._id, email: user.email, name: user.name, avatar: user.avatar } });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Google auth failed' }); }
});

// Get current user info
app.get('/auth/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.uid).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: { id: user._id, email: user.email, name: user.name, avatar: user.avatar } });
  } catch (error) {
    console.error('Error getting user info:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// Logout: clear cookie
app.post('/auth/logout', (req, res) => {
  // Clear cookie by setting expired maxAge
  res.cookie?.('token', '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  res.json({ ok: true });
});

// --- Wishlist routes ---
app.get('/wishlist', auth, async (req, res) => {
  const items = await WishlistItem.find({ userId: req.user.uid }).sort({ createdAt: -1 });
  res.json({ items });
});
app.post('/wishlist', auth, async (req, res) => {
  const { title, price, link, image, source } = req.body || {};
  const item = await WishlistItem.create({ userId: req.user.uid, title, price, link, image, source });
  res.json({ item });
});
app.delete('/wishlist/:id', auth, async (req, res) => {
  await WishlistItem.deleteOne({ _id: req.params.id, userId: req.user.uid });
  res.json({ ok: true });
});

// --- OOTD routes ---
app.get('/ootd', auth, async (req, res) => {
  const items = await OOTD.find({ userId: req.user.uid }).sort({ createdAt: -1 });
  res.json({ items });
});

// Accept either multipart file (image) or JSON (imageUrl)
app.post('/ootd', auth, upload.single('image'), async (req, res) => {
  try {
    const caption = (req.body?.caption || '').toString();
    let imageUrl = (req.body?.imageUrl || '').toString();

    // If file uploaded, store path as URL for serving
    if (req.file && req.file.path) {
      const rel = req.file.path.split('uploads').pop();
      imageUrl = `/uploads${rel}`;
    }

    const colors = Array.isArray(req.body?.colors) ? req.body.colors : [];
    const styleTags = Array.isArray(req.body?.styleTags) ? req.body.styleTags : [];

    if (!imageUrl) return res.status(400).json({ error: 'image or imageUrl required' });
    const item = await OOTD.create({ userId: req.user.uid, caption, imageUrl, colors, styleTags });
    return res.json({ item });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to create OOTD' });
  }
});

// New endpoint for outfit suggestions
app.post('/ootd/suggestions', auth, upload.single('image'), async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini API not configured' });
    }

    let imageBuffer = undefined;
    let imageMime = undefined;
    let imageUrl = undefined;

    if (req.file) {
      imageBuffer = req.file.buffer;
      imageMime = req.file.mimetype;
    } else if (req.body?.imageUrl) {
      imageUrl = req.body.imageUrl;
    } else {
      return res.status(400).json({ error: 'image or imageUrl required' });
    }

    const caption = (req.body?.caption || '').toString();

    // Analyze image with Gemini to get outfit suggestions
    let outfitAnalysis;
    if (imageBuffer) {
      const payload = { 
        base64: Buffer.from(imageBuffer).toString('base64'), 
        contentType: imageMime 
      };
      outfitAnalysis = await analyzeOutfitForSuggestions(payload, caption);
    } else {
      outfitAnalysis = await analyzeOutfitForSuggestions({ imageUrl }, caption);
    }

    // Get product suggestions for each category
    const suggestions = await getOutfitSuggestions(outfitAnalysis);

    res.json({
      analysis: outfitAnalysis,
      suggestions
    });

  } catch (error) {
    console.error('Error generating outfit suggestions:', error);
    res.status(500).json({ error: 'Failed to generate outfit suggestions' });
  }
});

app.delete('/ootd/:id', auth, async (req, res) => {
  await OOTD.deleteOne({ _id: req.params.id, userId: req.user.uid });
  res.json({ ok: true });
});

// --- Comparison routes ---
// Create a new comparison session
app.post('/comparison', auth, async (req, res) => {
  try {
    const { name, products } = req.body || {};
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'Products array is required' });
    }

    // Validate and normalize products
    const normalizedProducts = products.map(product => ({
      productId: product._id || product.id || Math.random().toString(36).substr(2, 9),
      title: product.title || '',
      price: product.price || '',
      priceNumber: product.priceNumber || parsePriceToNumber(product.price) || null,
      link: product.link || '',
      source: product.source || '',
      thumbnail: product.thumbnail || product.image || '',
      rating: product.rating || null,
      reviews: product.reviews || null,
      availability: product.availability || '',
      shipping: product.shipping || '',
      originalData: product
    }));

    const session = await ComparisonSession.create({
      userId: req.user.uid,
      name: name || `Comparison ${new Date().toLocaleDateString()}`,
      products: normalizedProducts
    });

    res.json({ session });
  } catch (error) {
    console.error('Error creating comparison:', error);
    res.status(500).json({ error: 'Failed to create comparison' });
  }
});

// Get all comparison sessions for a user
app.get('/comparison', auth, async (req, res) => {
  try {
    const sessions = await ComparisonSession.find({ userId: req.user.uid })
      .sort({ updatedAt: -1 })
      .select('-__v');
    res.json({ sessions });
  } catch (error) {
    console.error('Error fetching comparisons:', error);
    res.status(500).json({ error: 'Failed to fetch comparisons' });
  }
});

// Get a specific comparison session
app.get('/comparison/:id', auth, async (req, res) => {
  try {
    const session = await ComparisonSession.findOne({
      _id: req.params.id,
      userId: req.user.uid
    }).select('-__v');

    if (!session) {
      return res.status(404).json({ error: 'Comparison not found' });
    }

    res.json({ session });
  } catch (error) {
    console.error('Error fetching comparison:', error);
    res.status(500).json({ error: 'Failed to fetch comparison' });
  }
});

// Update a comparison session (add/remove products)
app.put('/comparison/:id', auth, async (req, res) => {
  try {
    const { name, products } = req.body || {};
    const updateData = { updatedAt: new Date() };
    
    if (name !== undefined) updateData.name = name;
    if (products !== undefined) {
      const normalizedProducts = products.map(product => ({
        productId: product._id || product.id || Math.random().toString(36).substr(2, 9),
        title: product.title || '',
        price: product.price || '',
        priceNumber: product.priceNumber || parsePriceToNumber(product.price) || null,
        link: product.link || '',
        source: product.source || '',
        thumbnail: product.thumbnail || product.image || '',
        rating: product.rating || null,
        reviews: product.reviews || null,
        availability: product.availability || '',
        shipping: product.shipping || '',
        originalData: product
      }));
      updateData.products = normalizedProducts;
    }

    const session = await ComparisonSession.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.uid },
      updateData,
      { new: true }
    ).select('-__v');

    if (!session) {
      return res.status(404).json({ error: 'Comparison not found' });
    }

    res.json({ session });
  } catch (error) {
    console.error('Error updating comparison:', error);
    res.status(500).json({ error: 'Failed to update comparison' });
  }
});

// Delete a comparison session
app.delete('/comparison/:id', auth, async (req, res) => {
  try {
    const result = await ComparisonSession.deleteOne({
      _id: req.params.id,
      userId: req.user.uid
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Comparison not found' });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting comparison:', error);
    res.status(500).json({ error: 'Failed to delete comparison' });
  }
});

// Get comparison analytics (price analysis, company distribution, etc.)
app.get('/comparison/:id/analytics', auth, async (req, res) => {
  try {
    const session = await ComparisonSession.findOne({
      _id: req.params.id,
      userId: req.user.uid
    });

    if (!session) {
      return res.status(404).json({ error: 'Comparison not found' });
    }

    // Group products by company/source
    const companyGroups = {};
    const priceStats = {
      min: Infinity,
      max: -Infinity,
      avg: 0,
      total: 0,
      count: 0
    };

    session.products.forEach(product => {
      const source = product.source || 'Unknown';
      if (!companyGroups[source]) {
        companyGroups[source] = [];
      }
      companyGroups[source].push(product);

      // Price statistics
      if (product.priceNumber !== null && product.priceNumber !== undefined) {
        priceStats.min = Math.min(priceStats.min, product.priceNumber);
        priceStats.max = Math.max(priceStats.max, product.priceNumber);
        priceStats.total += product.priceNumber;
        priceStats.count++;
      }
    });

    if (priceStats.count > 0) {
      priceStats.avg = priceStats.total / priceStats.count;
    } else {
      priceStats.min = null;
      priceStats.max = null;
      priceStats.avg = null;
    }

    // Find best deals (lowest price per company)
    const bestDeals = Object.entries(companyGroups).map(([company, products]) => {
      const validProducts = products.filter(p => p.priceNumber !== null && p.priceNumber !== undefined);
      if (validProducts.length === 0) return null;
      
      const lowest = validProducts.reduce((min, p) => 
        p.priceNumber < min.priceNumber ? p : min
      );
      
      return {
        company,
        product: lowest,
        price: lowest.priceNumber
      };
    }).filter(Boolean).sort((a, b) => a.price - b.price);

    const analytics = {
      totalProducts: session.products.length,
      companies: Object.keys(companyGroups),
      companyDistribution: Object.entries(companyGroups).map(([company, products]) => ({
        company,
        count: products.length,
        avgPrice: products.reduce((sum, p) => sum + (p.priceNumber || 0), 0) / products.length
      })),
      priceStats,
      bestDeals,
      priceRange: priceStats.max !== -Infinity ? {
        lowest: priceStats.min,
        highest: priceStats.max,
        difference: priceStats.max - priceStats.min
      } : null
    };

    res.json({ analytics });
  } catch (error) {
    console.error('Error generating analytics:', error);
    res.status(500).json({ error: 'Failed to generate analytics' });
  }
});

// POST /search (JSON or multipart)
// GET /trending?limit=12 (aggregated for India)
app.get('/trending', async (req, res) => {
  try {
    if (!SERPAPI_API_KEY) {
      return res.status(500).json({ error: 'Missing SERPAPI_API_KEY' });
    }
    const limit = req.query.limit || 12;
    const items = await getTrending({ limit });
    return res.json({ platform: 'all', items });
  } catch (e) {
    console.error('Error in /trending:', e);
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

// Error handling middleware for multer
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 20MB.' });
    }
    return res.status(400).json({ error: error.message });
  }
  if (error.message === 'Only image files are allowed') {
    return res.status(400).json({ error: 'Only image files are allowed. Please upload a JPEG, PNG, GIF, WebP, or BMP image.' });
  }
  next(error);
});

app.post('/search', searchUpload.single('image'), async (req, res) => {
  try {
    console.log('Search request received:', {
      contentType: req.headers['content-type'],
      hasFile: !!req.file,
      body: req.body,
      hasGeminiKey: !!GEMINI_API_KEY,
      hasSerpKey: !!SERPAPI_API_KEY
    });

    if (!GEMINI_API_KEY || !SERPAPI_API_KEY) {
      console.error('Missing API keys: GEMINI_API_KEY or SERPAPI_API_KEY');
      return res.status(500).json({ error: 'Something went wrong' });
    }

    const isMultipart = req.headers['content-type']?.includes('multipart/form-data');
    let text = undefined;
    let imageBuffer = undefined;
    let imageMime = undefined;
    let imageUrl = undefined;
    let useRaw = false;

    if (isMultipart) {
      text = req.body?.text;
      imageUrl = req.body?.imageUrl;
      console.log('Multipart request details:', {
        hasFile: !!req.file,
        fileField: req.file?.fieldname,
        fileSize: req.file?.size,
        fileMime: req.file?.mimetype,
        bodyKeys: Object.keys(req.body || {})
      });
      if (req.file) {
        // Validate MIME type for images
        const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
        if (!validImageTypes.includes(req.file.mimetype)) {
          return res.status(400).json({ 
            error: 'Invalid image format. Please upload a JPEG, PNG, GIF, WebP, or BMP image.' 
          });
        }
        
        imageBuffer = req.file.buffer;
        imageMime = req.file.mimetype;
        console.log('File uploaded successfully:', {
          fieldName: req.file.fieldname,
          originalName: req.file.originalname,
          size: req.file.size,
          mimeType: req.file.mimetype
        });
      } else {
        console.log('No file found in multipart request');
      }
    } else {
      // JSON
      const { text: bodyText, imageUrl: bodyImageUrl, raw: bodyRaw, platform: bodyPlatform } = req.body || {};
      text = bodyText;
      imageUrl = bodyImageUrl;
      useRaw = Boolean(bodyRaw);
      req.platform = bodyPlatform;
    }

    console.log('Validation check:', {
      hasText: !!text,
      hasImageUrl: !!imageUrl,
      hasImageBuffer: !!imageBuffer,
      imageBufferLength: imageBuffer?.length
    });
    
    if (!text && !imageUrl && !imageBuffer) {
      return res.status(400).json({ error: 'Provide text, imageUrl, or image file (field name: image)' });
    }



    console.log('Search parameters:', {
      text: text,
      imageUrl: imageUrl,
      hasImageBuffer: !!imageBuffer,
      imageMime: imageMime,
      useRaw: useRaw
    });

    let searchQuery = '';

    if (useRaw && text && text.trim()) {
      // Use the provided text directly as the shopping query
      searchQuery = text.trim();
      console.log('Using raw text, search query:', searchQuery);
    } else if (text && text.trim()) {
      // Prefer text if provided (Gemini: spell-only or full query depending on SPELL_ONLY)
      try {
        if (!GEMINI_API_KEY) {
          throw new Error('Gemini API key not configured');
        }
        searchQuery = await queryGeminiFromText(text.trim());
        console.log('Using Gemini text processing, search query:', searchQuery);
      } catch (error) {
        console.warn('Gemini API failed, using enhanced fallback:', error.message);
        console.warn('Error details:', error.stack);
        
        // Enhanced fallback: improve the text query with fashion-specific terms
        const originalText = text.trim().toLowerCase();
        
        // Check if the text already contains fashion-related terms
        const fashionTerms = ['shirt', 'dress', 'pant', 'jean', 'shoe', 'bag', 'jacket', 'coat', 'skirt', 'top', 'blouse', 'sneaker', 'boot', 'handbag', 'purse', 'jewelry', 'accessory'];
        const hasFashionTerms = fashionTerms.some(term => originalText.includes(term));
        
        if (hasFashionTerms) {
          // Text already contains fashion terms, just add some context
          searchQuery = `${originalText} fashion style`;
        } else {
          // Text doesn't contain fashion terms, add clothing context
          searchQuery = `${originalText} fashion clothing style`;
        }
      }
    } else if (imageBuffer || imageUrl) {
      // Handle image (+ optional caption fusion)
      console.log('Processing image search...');
      let payload;
      if (imageBuffer) {
        payload = { base64: Buffer.from(imageBuffer).toString('base64'), contentType: imageMime };
        console.log('Using uploaded image buffer, size:', imageBuffer.length);
        console.log('Image MIME type:', imageMime);
        console.log('Base64 length:', payload.base64.length);
      } else {
        payload = await fetchImageAsBase64(imageUrl);
        console.log('Using image URL:', imageUrl);
        console.log('Base64 length:', payload.base64.length);
      }
      try {
        if (!GEMINI_API_KEY) {
          throw new Error('Gemini API key not configured');
        }
        searchQuery = await queryGeminiFromImage(payload, text);
        console.log('Image search query generated:', searchQuery);
      } catch (error) {
        console.warn('Gemini image API failed, using intelligent fallback:', error.message);
        console.warn('Error details:', error.stack);
        
        // Enhanced intelligent fallback based on image metadata and text
        if (text && text.trim()) {
          // Try to improve the text query with specific fashion terms
          const improvedText = text.trim().toLowerCase();
          
          // Clothing categories with specific search terms
          if (improvedText.includes('shirt') || improvedText.includes('top') || improvedText.includes('blouse') || improvedText.includes('tee')) {
            searchQuery = `${improvedText} clothing fashion casual wear`;
          } else if (improvedText.includes('pant') || improvedText.includes('jean') || improvedText.includes('trouser') || improvedText.includes('legging')) {
            searchQuery = `${improvedText} bottoms fashion casual wear`;
          } else if (improvedText.includes('dress') || improvedText.includes('gown') || improvedText.includes('frock')) {
            searchQuery = `${improvedText} women fashion casual elegant`;
          } else if (improvedText.includes('shoe') || improvedText.includes('sneaker') || improvedText.includes('boot') || improvedText.includes('footwear')) {
            searchQuery = `${improvedText} footwear fashion casual`;
          } else if (improvedText.includes('bag') || improvedText.includes('purse') || improvedText.includes('handbag') || improvedText.includes('backpack')) {
            searchQuery = `${improvedText} accessories fashion`;
          } else if (improvedText.includes('jacket') || improvedText.includes('coat') || improvedText.includes('blazer')) {
            searchQuery = `${improvedText} outerwear fashion casual formal`;
          } else if (improvedText.includes('skirt') || improvedText.includes('short')) {
            searchQuery = `${improvedText} women fashion casual`;
          } else if (improvedText.includes('jewelry') || improvedText.includes('necklace') || improvedText.includes('earring') || improvedText.includes('ring')) {
            searchQuery = `${improvedText} accessories fashion jewelry`;
          } else {
            // Generic fashion search with the provided text
            searchQuery = `${improvedText} fashion clothing style trendy`;
          }
        } else {
          // Enhanced image analysis fallback based on image properties and URL
          const imageSize = imageBuffer ? imageBuffer.length : 0;
          const imageUrlLower = (imageUrl || '').toLowerCase();
          
          // Try to extract clues from image URL if available
          let urlClues = '';
          if (imageUrlLower.includes('shirt') || imageUrlLower.includes('top') || imageUrlLower.includes('tee')) {
            urlClues = 'shirt top clothing';
          } else if (imageUrlLower.includes('dress') || imageUrlLower.includes('gown')) {
            urlClues = 'dress women fashion';
          } else if (imageUrlLower.includes('pant') || imageUrlLower.includes('jean')) {
            urlClues = 'pants jeans bottoms';
          } else if (imageUrlLower.includes('shoe') || imageUrlLower.includes('sneaker') || imageUrlLower.includes('boot')) {
            urlClues = 'shoes footwear';
          } else if (imageUrlLower.includes('bag') || imageUrlLower.includes('purse') || imageUrlLower.includes('handbag')) {
            urlClues = 'bag accessories';
          } else if (imageUrlLower.includes('jacket') || imageUrlLower.includes('coat')) {
            urlClues = 'jacket coat outerwear';
          }
          
          // Combine URL clues with size-based analysis
          const isLargeImage = imageSize > 200000; // > 200KB
          const isMediumImage = imageSize > 50000; // > 50KB
          const isSmallImage = imageSize < 20000; // < 20KB
          
          if (urlClues) {
            // Use URL clues if available
            searchQuery = `${urlClues} fashion style`;
          } else if (isLargeImage) {
            // Large images likely contain full outfits or detailed clothing
            searchQuery = 'fashion clothing outfit style casual wear trendy';
          } else if (isMediumImage) {
            // Medium images likely contain specific clothing items
            searchQuery = 'fashion clothing style casual wear';
          } else if (isSmallImage) {
            // Small images likely contain accessories or jewelry
            searchQuery = 'fashion accessories jewelry bags shoes';
          } else {
            // Default fallback
            searchQuery = 'fashion clothing style trendy casual wear';
          }
        }
        console.log('Using enhanced intelligent fallback query:', searchQuery);
      }
    } else {
      // Fallback for edge cases
      searchQuery = 'fashion clothing';
      console.log('Using fallback search query:', searchQuery);
    }

    console.log('Searching products with query:', searchQuery);
    
    let products = await searchProducts(searchQuery);
    
    console.log('Products found:', products.length);

    // Normalize
    products = products.map(normalizeProduct);

    // Extract filters/sort from body or query
    const {
      minPrice, maxPrice,
      colors, sizes, brands,
      sortBy, sortOrder
    } = isMultipart ? req.body || {} : (req.body || {});

    // Apply filters
    products = applyFilters(products, { minPrice, maxPrice, colors, sizes, brands });
    // If no explicit sort, re-rank by query relevance; otherwise apply chosen sort
    if (!sortBy) {
      products = rerankByQueryHeuristics(products, searchQuery);
    } else {
      products = applySort(products, sortBy, sortOrder);
    }

    // Strip internal fields
    products = stripInternalFields(products);

    // Enhance products with real-time price fetching
    products = await enhanceProductPrices(products);

    // Generate comparison data by grouping products by company/source
    const comparisonData = generateComparisonData(products);

    return res.json({
      query: searchQuery,
      products,
      comparison: comparisonData,
      platform: req.platform || req.body?.platform || 'google_shopping',
      filters: { minPrice, maxPrice, colors, sizes, brands },
      sort: { sortBy: sortBy || null, sortOrder: (sortOrder || 'asc').toLowerCase() }
    });
  } catch (err) {
    console.error('Unhandled error in /search:', err);
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      name: err.name
    });
    return res.status(500).json({ error: 'Something went wrong', details: err.message });
  }
});

// Analyze outfit image and generate suggestions
async function analyzeOutfitForSuggestions(imageData, caption) {
  const prompt = `You are a fashion expert analyzing an outfit image. Look at this image carefully and provide detailed analysis.

TASK: Analyze the clothing items in the image and suggest complementary pieces to complete the outfit.

ANALYSIS REQUIREMENTS:
1. Identify the MAIN ITEM visible (e.g., "tshirt", "shirt", "dress", "jeans", "shoes", "bag")
2. Identify the STYLE (e.g., "casual", "formal", "streetwear", "elegant", "sporty")
3. Identify the COLOR SCHEME (e.g., "neutral", "dark", "bright", "pastel")
4. Identify the OCCASION (e.g., "casual", "work", "party", "sport", "formal")

SUGGESTION CATEGORIES:
- If main item is TOP (tshirt, shirt, blouse): suggest BOTTOMS (jeans, pants, skirts)
- If main item is BOTTOM (jeans, pants, skirt): suggest TOPS (tshirt, shirt, blouse)
- If main item is DRESS: suggest SHOES, BAGS, ACCESSORIES
- If main item is SHOES: suggest COMPLETE OUTFIT
- Always suggest ACCESSORIES (bags, jewelry, watches, belts, scarves)

OUTPUT FORMAT (JSON):
{
  "mainItem": "tshirt",
  "style": "casual",
  "colorScheme": "neutral",
  "occasion": "casual",
  "suggestions": {
    "bottoms": ["jeans", "pants", "shorts"],
    "tops": [],
    "shoes": ["sneakers", "boots"],
    "accessories": ["bag", "watch", "necklace"],
    "completeOutfit": "casual streetwear look"
  }
}

Additional context: ${caption || 'No caption provided'}`;

  try {
    let payload;
    if (imageData.base64) {
      payload = { 
        inline_data: { 
          mime_type: imageData.contentType, 
          data: imageData.base64 
        } 
      };
    } else {
      const { base64, contentType } = await fetchImageAsBase64(imageData.imageUrl);
      payload = { 
        inline_data: { 
          mime_type: contentType, 
          data: base64 
        } 
      };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const body = {
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          payload
        ]
      }]
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      throw new Error(`Gemini vision error: ${resp.status} ${await resp.text()}`);
    }

    const json = await resp.json();
    const responseText = parseGeminiText(json);
    
    // Try to parse JSON response
    try {
      return JSON.parse(responseText);
    } catch (parseError) {
      // Fallback: create structured response from text
      const lowerText = responseText.toLowerCase();
      return {
        mainItem: extractMainItem(lowerText),
        style: extractStyle(lowerText),
        colorScheme: extractColorScheme(lowerText),
        occasion: extractOccasion(lowerText),
        suggestions: extractSuggestions(lowerText),
        rawResponse: responseText
      };
    }
  } catch (error) {
    console.error('Error analyzing outfit:', error);
    // Return fallback analysis
    return {
      mainItem: 'clothing',
      style: 'casual',
      colorScheme: 'neutral',
      occasion: 'casual',
      suggestions: {
        bottoms: ['jeans', 'pants'],
        tops: ['tshirt', 'shirt'],
        shoes: ['sneakers'],
        accessories: ['bag', 'watch'],
        completeOutfit: 'casual everyday look'
      }
    };
  }
}

// Helper functions for fallback analysis
function extractMainItem(text) {
  if (text.includes('tshirt') || text.includes('shirt')) return 'tshirt';
  if (text.includes('dress')) return 'dress';
  if (text.includes('jeans') || text.includes('pants')) return 'bottoms';
  if (text.includes('shoes') || text.includes('sneakers')) return 'shoes';
  if (text.includes('bag') || text.includes('purse')) return 'bag';
  return 'clothing';
}

function extractStyle(text) {
  if (text.includes('casual')) return 'casual';
  if (text.includes('formal')) return 'formal';
  if (text.includes('streetwear')) return 'streetwear';
  if (text.includes('elegant')) return 'elegant';
  if (text.includes('sporty')) return 'sporty';
  return 'casual';
}

function extractColorScheme(text) {
  if (text.includes('dark') || text.includes('black')) return 'dark';
  if (text.includes('bright') || text.includes('colorful')) return 'bright';
  if (text.includes('pastel')) return 'pastel';
  return 'neutral';
}

function extractOccasion(text) {
  if (text.includes('work') || text.includes('office')) return 'work';
  if (text.includes('party') || text.includes('evening')) return 'party';
  if (text.includes('sport') || text.includes('gym')) return 'sport';
  if (text.includes('formal')) return 'formal';
  return 'casual';
}

function extractSuggestions(text) {
  const suggestions = {
    bottoms: [],
    tops: [],
    shoes: [],
    accessories: [],
    completeOutfit: 'casual look'
  };

  if (text.includes('jeans')) suggestions.bottoms.push('jeans');
  if (text.includes('pants')) suggestions.bottoms.push('pants');
  if (text.includes('tshirt')) suggestions.tops.push('tshirt');
  if (text.includes('shirt')) suggestions.tops.push('shirt');
  if (text.includes('sneakers')) suggestions.shoes.push('sneakers');
  if (text.includes('bag')) suggestions.accessories.push('bag');
  if (text.includes('watch')) suggestions.accessories.push('watch');

  return suggestions;
}

// Get product suggestions for outfit categories
async function getOutfitSuggestions(analysis) {
  try {
    const suggestions = {};
    
    // Generate search queries for each suggestion category
    if (analysis.suggestions.bottoms && analysis.suggestions.bottoms.length > 0) {
      const query = `${analysis.suggestions.bottoms.join(' ')} ${analysis.style} ${analysis.colorScheme}`;
      suggestions.bottoms = await searchProducts(query);
    }
    
    if (analysis.suggestions.tops && analysis.suggestions.tops.length > 0) {
      const query = `${analysis.suggestions.tops.join(' ')} ${analysis.style} ${analysis.colorScheme}`;
      suggestions.tops = await searchProducts(query);
    }
    
    if (analysis.suggestions.shoes && analysis.suggestions.shoes.length > 0) {
      const query = `${analysis.suggestions.shoes.join(' ')} ${analysis.style} footwear`;
      suggestions.shoes = await searchProducts(query);
    }
    
    if (analysis.suggestions.accessories && analysis.suggestions.accessories.length > 0) {
      const query = `${analysis.suggestions.accessories.join(' ')} ${analysis.style} accessories`;
      suggestions.accessories = await searchProducts(query);
    }

    return suggestions;
  } catch (error) {
    console.error('Error getting outfit suggestions:', error);
    return {};
  }
}

// Simple chat endpoint powered by Gemini or OpenAI
app.post('/chat', async (req, res) => {
  try {
    const { messages, profile } = req.body || {};
    if (!Array.isArray(messages) || !messages.length) {
      return res.status(400).json({ error: 'messages array required' });
    }

    if (MOCK || (!GEMINI_API_KEY && !OPENAI_API_KEY)) {
      // Mock: echo with small stylist intent
      const last = messages[messages.length - 1]?.content || '';
      return res.json({ reply: `Mock stylist: For ${profile?.undertone || 'neutral'} undertone, try navy and burgundy. You said: ${last}` });
    }

    const sysPrompt = [
      'You are a friendly, concise personal stylist. Keep replies natural and under 120 words.',
      'Focus on personalized styling advice: suitable colors by skin tone/undertone, outfit ideas by occasion, accessories and hair suggestions.',
      'Avoid product links or shopping calls; do not push purchases.',
      'Be supportive, avoid sensitive health/medical claims.',
    ].join(' ');

    const profileText = profile ? `User profile: ${JSON.stringify(profile)}` : '';

    if (GEMINI_API_KEY) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      const parts = [{ text: sysPrompt }, { text: profileText }].concat(
        messages.map(m => ({ text: `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}` }))
      );
      const body = { contents: [{ role: 'user', parts }] };
      const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!resp.ok) throw new Error(await resp.text());
      const json = await resp.json();
      const reply = (json?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join(' ').trim() || 'Sorry, I could not generate a reply.';
      return res.json({ reply });
    }

    // OpenAI fallback
    const url = 'https://api.openai.com/v1/chat/completions';
    const body = {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: sysPrompt },
        profile ? { role: 'system', content: profileText } : null,
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ].filter(Boolean),
      temperature: 0.7,
      max_tokens: 300
    };
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` }, body: JSON.stringify(body) });
    if (!resp.ok) throw new Error(await resp.text());
    const json = await resp.json();
    const reply = json?.choices?.[0]?.message?.content?.trim() || 'Sorry, I could not generate a reply.';
    return res.json({ reply });
  } catch (e) {
    console.error('Error in /chat:', e);
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

// Refresh prices for specific products
app.post('/refresh-prices', auth, async (req, res) => {
  try {
    const { products } = req.body || {};
    
    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ error: 'Products array is required' });
    }
    
    const updatedProducts = [];
    
    for (const product of products) {
      if (product.link) {
        const updatedProduct = await fetchRealTimePrice(product);
        updatedProducts.push(updatedProduct);
      } else {
        updatedProducts.push(product);
      }
    }
    
    res.json({ products: updatedProducts });
  } catch (error) {
    console.error('Error refreshing prices:', error);
    res.status(500).json({ error: 'Failed to refresh prices' });
  }
});

// Catch-all handler for React Router
app.get('*', (req, res) => {
  // Serve the React app for any unmatched routes
  const indexPath = path.join(__dirname, 'frontend', 'build', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Not found');
  }
});

app.listen(PORT, () => {
  console.log(`Fashion Search API listening on port ${PORT}`);
});