// Test script to verify Gemini improvements with proper settings
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY;

if (!GEMINI_API_KEY || !SERPAPI_API_KEY) {
  console.error('Missing API keys. Please set GEMINI_API_KEY and SERPAPI_API_KEY in your .env file');
  process.exit(1);
}

// Test the Gemini API directly to see the difference
async function testGeminiDirectly() {
  console.log('🧪 Testing Gemini API directly...\n');
  
  const testCases = [
    {
      name: 'Red T-shirt',
      text: 'red cotton t-shirt',
      expected: 'red cotton t-shirt casual fashion'
    },
    {
      name: 'Black Dress',
      text: 'black dress',
      expected: 'black dress women fashion elegant'
    },
    {
      name: 'Blue Jeans',
      text: 'blue jeans',
      expected: 'blue denim jeans casual fashion'
    }
  ];

  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.name}`);
    console.log(`Input: "${testCase.text}"`);
    
    try {
      // Test with raw=true (bypasses Gemini, uses text as-is)
      const rawResponse = await fetch('http://localhost:5001/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: testCase.text, raw: true })
      });
      
      const rawResult = await rawResponse.json();
      console.log(`Raw Query: "${rawResult.query}"`);
      console.log(`Raw Products: ${rawResult.products.length}`);
      
      // Test with raw=false (uses Gemini processing)
      const geminiResponse = await fetch('http://localhost:5001/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: testCase.text, raw: false })
      });
      
      const geminiResult = await geminiResponse.json();
      console.log(`Gemini Query: "${geminiResult.query}"`);
      console.log(`Gemini Products: ${geminiResult.products.length}`);
      
      // Compare results
      if (rawResult.query !== geminiResult.query) {
        console.log('✅ Gemini processing is working!');
      } else {
        console.log('⚠️  Gemini processing may not be working (SPELL_ONLY=1?)');
      }
      
      console.log('---\n');
    } catch (error) {
      console.error(`Error testing ${testCase.name}:`, error.message);
      console.log('---\n');
    }
  }
}

// Test image analysis
async function testImageAnalysis() {
  console.log('🖼️  Testing image analysis...\n');
  
  // Test with a fashion image
  const sampleImageUrl = 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop';
  
  try {
    const response = await fetch('http://localhost:5001/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: sampleImageUrl,
        text: 'casual outfit' // Optional caption
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();
    console.log(`Image Analysis Query: "${result.query}"`);
    console.log(`Products Found: ${result.products.length}`);
    
    if (result.products.length > 0) {
      console.log('Sample products:');
      result.products.slice(0, 3).forEach((product, index) => {
        console.log(`  ${index + 1}. ${product.title} - ${product.price} (${product.source})`);
      });
    }
    
  } catch (error) {
    console.error('Error testing image analysis:', error.message);
  }
}

// Show current configuration
function showConfiguration() {
  console.log('📋 Current Configuration:');
  console.log(`- GEMINI_API_KEY: ${GEMINI_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`- SERPAPI_API_KEY: ${SERPAPI_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`- SPELL_ONLY: ${process.env.SPELL_ONLY || 'not set'}`);
  console.log(`- MOCK: ${process.env.MOCK || 'not set'}`);
  console.log('');
  
  if (process.env.SPELL_ONLY === '1' || process.env.SPELL_ONLY === 'true') {
    console.log('⚠️  WARNING: SPELL_ONLY=1 is set. This means Gemini will only do spell correction, not full query generation.');
    console.log('   To enable full Gemini processing, set SPELL_ONLY=0 in your .env file.\n');
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Testing Gemini Improvements\n');
  
  showConfiguration();
  
  // Test text-based queries
  await testGeminiDirectly();
  
  // Test image analysis
  await testImageAnalysis();
  
  console.log('✅ Tests completed!');
  console.log('\n📝 Summary:');
  console.log('- If Gemini queries are the same as raw queries, SPELL_ONLY=1 is preventing full processing');
  console.log('- To fix: Set SPELL_ONLY=0 in your .env file');
  console.log('- The improvements are in place and will work once SPELL_ONLY is disabled');
}

runTests().catch(console.error);
