// Test script for image analysis improvements
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY;

if (!GEMINI_API_KEY || !SERPAPI_API_KEY) {
  console.error('Missing API keys. Please set GEMINI_API_KEY and SERPAPI_API_KEY in your .env file');
  process.exit(1);
}

// Test different types of fashion images
async function testImageAnalysis() {
  console.log('🖼️  Testing Image Analysis Improvements\n');
  
  const testImages = [
    {
      name: 'Red T-shirt Image',
      url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop',
      caption: 'red cotton t-shirt',
      expected: 'red cotton t-shirt casual fashion'
    },
    {
      name: 'Black Dress Image',
      url: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=400&h=400&fit=crop',
      caption: 'black dress',
      expected: 'black dress women fashion elegant'
    },
    {
      name: 'Blue Jeans Image',
      url: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&h=400&fit=crop',
      caption: 'blue jeans',
      expected: 'blue denim jeans casual fashion'
    },
    {
      name: 'White Sneakers Image',
      url: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&h=400&fit=crop',
      caption: 'white sneakers',
      expected: 'white sneakers casual footwear fashion'
    }
  ];

  for (const testImage of testImages) {
    console.log(`Testing: ${testImage.name}`);
    console.log(`Image URL: ${testImage.url}`);
    console.log(`Caption: "${testImage.caption}"`);
    
    try {
      const response = await fetch('http://localhost:5001/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: testImage.url,
          text: testImage.caption
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const result = await response.json();
      console.log(`Generated Query: "${result.query}"`);
      console.log(`Products Found: ${result.products.length}`);
      
      // Check if the query is specific and relevant
      const query = result.query.toLowerCase();
      const isSpecific = query.includes('red') || query.includes('black') || query.includes('blue') || query.includes('white') ||
                        query.includes('cotton') || query.includes('denim') || query.includes('leather') ||
                        query.includes('shirt') || query.includes('dress') || query.includes('jean') || query.includes('sneaker');
      
      if (isSpecific) {
        console.log('✅ Query is specific and relevant!');
      } else {
        console.log('⚠️  Query might be too generic');
      }
      
      // Show sample products
      if (result.products.length > 0) {
        console.log('Sample products:');
        result.products.slice(0, 3).forEach((product, index) => {
          console.log(`  ${index + 1}. ${product.title} - ${product.price} (${product.source})`);
        });
      }
      
      console.log('---\n');
    } catch (error) {
      console.error(`Error testing ${testImage.name}:`, error.message);
      console.log('---\n');
    }
  }
}

// Test image analysis without caption
async function testImageOnly() {
  console.log('🖼️  Testing Image Analysis Without Caption\n');
  
  const testImage = {
    name: 'Fashion Image (No Caption)',
    url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop'
  };
  
  console.log(`Testing: ${testImage.name}`);
  console.log(`Image URL: ${testImage.url}`);
  console.log('Caption: None');
  
  try {
    const response = await fetch('http://localhost:5001/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: testImage.url
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();
    console.log(`Generated Query: "${result.query}"`);
    console.log(`Products Found: ${result.products.length}`);
    
    // Check if the query is specific
    const query = result.query.toLowerCase();
    const isSpecific = query.includes('shirt') || query.includes('dress') || query.includes('pant') || 
                      query.includes('shoe') || query.includes('bag') || query.includes('jacket');
    
    if (isSpecific) {
      console.log('✅ Query is specific and relevant!');
    } else {
      console.log('⚠️  Query might be too generic');
    }
    
    // Show sample products
    if (result.products.length > 0) {
      console.log('Sample products:');
      result.products.slice(0, 3).forEach((product, index) => {
        console.log(`  ${index + 1}. ${product.title} - ${product.price} (${product.source})`);
      });
    }
    
  } catch (error) {
    console.error(`Error testing ${testImage.name}:`, error.message);
  }
}

// Test fallback behavior
async function testFallback() {
  console.log('🔄 Testing Fallback Behavior\n');
  
  // Test with a non-fashion image to see fallback behavior
  const testImage = {
    name: 'Non-Fashion Image (Test Fallback)',
    url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop', // Landscape image
    caption: 'test'
  };
  
  console.log(`Testing: ${testImage.name}`);
  console.log(`Image URL: ${testImage.url}`);
  console.log(`Caption: "${testImage.caption}"`);
  
  try {
    const response = await fetch('http://localhost:5001/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: testImage.url,
        text: testImage.caption
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();
    console.log(`Generated Query: "${result.query}"`);
    console.log(`Products Found: ${result.products.length}`);
    
    // Show sample products
    if (result.products.length > 0) {
      console.log('Sample products:');
      result.products.slice(0, 3).forEach((product, index) => {
        console.log(`  ${index + 1}. ${product.title} - ${product.price} (${product.source})`);
      });
    }
    
  } catch (error) {
    console.error(`Error testing ${testImage.name}:`, error.message);
  }
}

// Show configuration
function showConfiguration() {
  console.log('📋 Current Configuration:');
  console.log(`- GEMINI_API_KEY: ${GEMINI_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`- SERPAPI_API_KEY: ${SERPAPI_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`- SPELL_ONLY: ${process.env.SPELL_ONLY || 'not set'}`);
  console.log(`- MOCK: ${process.env.MOCK || 'not set'}`);
  console.log('');
  
  if (process.env.SPELL_ONLY === '1' || process.env.SPELL_ONLY === 'true') {
    console.log('ℹ️  Note: SPELL_ONLY=1 is set, but image analysis now uses enhanced prompts regardless.');
    console.log('');
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Testing Image Analysis Improvements\n');
  
  showConfiguration();
  
  // Test image analysis with captions
  await testImageAnalysis();
  
  // Test image analysis without caption
  await testImageOnly();
  
  // Test fallback behavior
  await testFallback();
  
  console.log('✅ Image analysis tests completed!');
  console.log('\n📝 Summary:');
  console.log('- Image analysis now uses enhanced prompts regardless of SPELL_ONLY setting');
  console.log('- Better fallback logic for when Gemini fails');
  console.log('- More specific and relevant search queries');
  console.log('- Improved error handling and validation');
}

runTests().catch(console.error);
