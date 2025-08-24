// Test script for improved Gemini image analysis
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY;

if (!GEMINI_API_KEY || !SERPAPI_API_KEY) {
  console.error('Missing API keys. Please set GEMINI_API_KEY and SERPAPI_API_KEY in your .env file');
  process.exit(1);
}

// Test the improved Gemini image analysis
async function testGeminiImageAnalysis() {
  console.log('Testing improved Gemini image analysis...\n');
  
  // Test cases with different types of fashion items
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
    },
    {
      name: 'White Sneakers',
      text: 'white sneakers',
      expected: 'white sneakers casual footwear fashion'
    }
  ];

  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.name}`);
    console.log(`Input: "${testCase.text}"`);
    
    try {
      const response = await fetch('http://localhost:5001/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: testCase.text,
          raw: false // Use Gemini processing
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const result = await response.json();
      console.log(`Generated Query: "${result.query}"`);
      console.log(`Products Found: ${result.products.length}`);
      
      // Show first few products
      if (result.products.length > 0) {
        console.log('Sample products:');
        result.products.slice(0, 3).forEach((product, index) => {
          console.log(`  ${index + 1}. ${product.title} - ${product.price} (${product.source})`);
        });
      }
      
      console.log('---\n');
    } catch (error) {
      console.error(`Error testing ${testCase.name}:`, error.message);
      console.log('---\n');
    }
  }
}

// Test image analysis with a sample image URL
async function testImageAnalysis() {
  console.log('Testing image analysis with sample image...\n');
  
  // You can replace this with any fashion image URL
  const sampleImageUrl = 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop';
  
  try {
    const response = await fetch('http://localhost:5001/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
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
    
    // Show first few products
    if (result.products.length > 0) {
      console.log('Sample products from image analysis:');
      result.products.slice(0, 3).forEach((product, index) => {
        console.log(`  ${index + 1}. ${product.title} - ${product.price} (${product.source})`);
      });
    }
    
  } catch (error) {
    console.error('Error testing image analysis:', error.message);
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting Gemini Image Analysis Tests\n');
  
  // Test text-based queries
  await testGeminiImageAnalysis();
  
  // Test image analysis
  await testImageAnalysis();
  
  console.log('✅ Tests completed!');
}

runTests().catch(console.error);
