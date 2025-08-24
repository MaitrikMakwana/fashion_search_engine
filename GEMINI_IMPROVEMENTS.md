# Gemini Image Analysis Improvements

## Problem Identified
The original Gemini integration was giving random product search results instead of properly classifying and returning products based on the uploaded image. The issues included:

1. **Generic prompts**: The original prompts were too vague and didn't provide clear instructions for fashion item classification
2. **Poor error handling**: When Gemini failed, the fallback logic was too basic and didn't provide meaningful results
3. **Weak product matching**: The search results weren't properly ranked based on relevance to the query
4. **Limited search scope**: Not enough results were being fetched from different sources

## Improvements Made

### 1. Enhanced Gemini Prompts

#### Image Analysis Prompt
- **Before**: Generic instructions to "describe what clothing or fashion items you see"
- **After**: Structured analysis with specific steps:
  - Identify main clothing item (shirt, dress, pants, jeans, jacket, shoes, bag, etc.)
  - Note visible colors
  - Identify materials if clear (cotton, denim, leather, silk, etc.)
  - Determine style (casual, formal, vintage, sporty, elegant, etc.)
  - Specify gender if obvious (men's, women's, unisex)
  - Note distinctive features (buttons, patterns, fit, design elements)

#### Text Processing Prompt
- **Before**: Basic instructions to "convert description into shopping query"
- **After**: Fashion expert role with specific elements to include:
  - Clothing type, color, material, style, gender, distinctive features
  - Better examples of good queries
  - Clear formatting instructions

### 2. Improved Error Handling

#### Better Response Validation
- Added length checks (too short or too long responses are rejected)
- Enhanced error detection patterns
- More comprehensive validation of Gemini responses

#### Enhanced Fallback Logic
- **Text-based queries**: Intelligent fallback that checks if text already contains fashion terms
- **Image analysis**: Size-based fallback that generates appropriate queries based on image characteristics
- **Category-specific fallbacks**: Different fallback strategies for different clothing types

### 3. Better Product Search

#### Enhanced Search Parameters
- Increased result count from SerpAPI (20 results instead of default)
- Added concurrent search across multiple providers
- Better deduplication logic

#### Improved Product Ranking
- Enhanced semantic reranking with fashion-specific terms
- Color matching bonuses
- Price and thumbnail availability bonuses
- Better token matching with full-word vs partial matches

### 4. Search Provider Improvements

#### Google Shopping
- Added `num=20` parameter to get more results
- Better error handling for failed requests

#### Amazon India
- Added `num=10` parameter for more results
- Improved price extraction and formatting

#### Concurrent Processing
- All search providers now run concurrently for better performance
- Better error handling for individual provider failures

## Key Changes in Code

### `queryGeminiFromImage()` Function
```javascript
// Enhanced prompt with structured analysis steps
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
```

### Enhanced Fallback Logic
```javascript
// Enhanced intelligent fallback based on image metadata and text
if (text && text.trim()) {
  // Try to improve the text query with specific fashion terms
  const improvedText = text.trim().toLowerCase();
  
  // Clothing categories with specific search terms
  if (improvedText.includes('shirt') || improvedText.includes('top') || improvedText.includes('blouse') || improvedText.includes('tee')) {
    searchQuery = `${improvedText} clothing fashion casual wear`;
  } else if (improvedText.includes('pant') || improvedText.includes('jean') || improvedText.includes('trouser') || improvedText.includes('legging')) {
    searchQuery = `${improvedText} bottoms fashion casual wear`;
  }
  // ... more categories
} else {
  // Analyze image based on file properties
  const imageSize = imageBuffer ? imageBuffer.length : 0;
  const isLargeImage = imageSize > 200000; // > 200KB
  const isMediumImage = imageSize > 50000; // > 50KB
  const isSmallImage = imageSize < 20000; // < 20KB
  
  if (isLargeImage) {
    searchQuery = 'fashion clothing outfit style casual wear trendy';
  } else if (isMediumImage) {
    searchQuery = 'fashion clothing style casual wear';
  } else if (isSmallImage) {
    searchQuery = 'fashion accessories jewelry bags shoes';
  }
}
```

### Improved Product Ranking
```javascript
// Enhanced semantic re-rank with fashion-specific scoring
function rerankByQueryHeuristics(products, query) {
  // ... validation
  
  const scored = products.map(p => {
    const t = (p.title || '').toLowerCase();
    const s = (p.source || '').toLowerCase();
    let score = 0;
    
    // Score based on token matches
    for (const tok of tokens) {
      if (!tok || tok.length < 2) continue;
      
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
    
    // Bonus for having a price and thumbnail
    if (p.price && p.price !== 'null') score += 1;
    if (p.thumbnail) score += 0.5;
    
    return { p, score };
  });
  
  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.p);
}
```

## Testing

A test script (`test-gemini-improved.js`) has been created to verify the improvements:

```bash
node test-gemini-improved.js
```

The test script:
- Tests text-based queries with different fashion items
- Tests image analysis with sample images
- Verifies that generated queries are more specific and relevant
- Checks that product results are better matched to the queries

## Expected Results

After these improvements, you should see:

1. **More specific search queries**: Instead of generic "fashion clothing", you'll get queries like "red cotton t-shirt casual women's fashion"
2. **Better product matches**: Products will be more relevant to the actual items in the image
3. **Improved fallbacks**: When Gemini fails, the system will still provide meaningful results
4. **Better ranking**: More relevant products will appear at the top of results
5. **More comprehensive results**: More products from different sources with better deduplication

## Configuration

The improvements work with the existing environment variables:
- `GEMINI_API_KEY`: Your Google Gemini API key
- `SERPAPI_API_KEY`: Your SerpAPI key
- `SPELL_ONLY`: Set to '1' or 'true' to only do spell correction instead of full query generation

## Monitoring

The improved system includes better logging:
- Detailed Gemini response logging
- Search result statistics
- Error tracking with specific error types
- Performance metrics for search providers

This should resolve the issue of random product search and provide much more accurate, relevant results based on the uploaded images.
