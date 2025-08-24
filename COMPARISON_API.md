# Product Comparison API

This document describes the new product comparison feature that allows users to compare products side by side based on price and company/source.

## Overview

The comparison feature enables users to:
- Create comparison sessions with multiple products
- Group products by company/source (Myntra, Ajio, etc.)
- Analyze price differences and find the best deals
- Save and manage multiple comparison sessions

## API Endpoints

### 1. Create Comparison Session
**POST** `/comparison`

Creates a new comparison session with selected products.

**Request Body:**
```json
{
  "name": "Summer Dresses Comparison",
  "products": [
    {
      "_id": "product1",
      "title": "Floral Summer Dress",
      "price": "₹1,299",
      "link": "https://myntra.com/dress1",
      "source": "Myntra",
      "thumbnail": "https://image1.jpg",
      "rating": 4.2,
      "reviews": 156
    },
    {
      "_id": "product2", 
      "title": "Summer Maxi Dress",
      "price": "₹1,599",
      "link": "https://ajio.com/dress2",
      "source": "Ajio",
      "thumbnail": "https://image2.jpg",
      "rating": 4.5,
      "reviews": 89
    }
  ]
}
```

**Response:**
```json
{
  "session": {
    "_id": "comparison_id",
    "userId": "user_id",
    "name": "Summer Dresses Comparison",
    "products": [...],
    "createdAt": "2025-08-24T13:45:00.000Z",
    "updatedAt": "2025-08-24T13:45:00.000Z"
  }
}
```

### 2. Get All Comparison Sessions
**GET** `/comparison`

Retrieves all comparison sessions for the authenticated user.

**Response:**
```json
{
  "sessions": [
    {
      "_id": "comparison_id",
      "name": "Summer Dresses Comparison",
      "products": [...],
      "createdAt": "2025-08-24T13:45:00.000Z",
      "updatedAt": "2025-08-24T13:45:00.000Z"
    }
  ]
}
```

### 3. Get Specific Comparison Session
**GET** `/comparison/:id`

Retrieves a specific comparison session by ID.

**Response:**
```json
{
  "session": {
    "_id": "comparison_id",
    "name": "Summer Dresses Comparison",
    "products": [...],
    "createdAt": "2025-08-24T13:45:00.000Z",
    "updatedAt": "2025-08-24T13:45:00.000Z"
  }
}
```

### 4. Update Comparison Session
**PUT** `/comparison/:id`

Updates an existing comparison session (add/remove products or change name).

**Request Body:**
```json
{
  "name": "Updated Comparison Name",
  "products": [...]
}
```

### 5. Delete Comparison Session
**DELETE** `/comparison/:id`

Deletes a comparison session.

**Response:**
```json
{
  "ok": true
}
```

### 6. Get Comparison Analytics
**GET** `/comparison/:id/analytics`

Provides detailed analytics for a comparison session including price analysis and company distribution.

**Response:**
```json
{
  "analytics": {
    "totalProducts": 5,
    "companies": ["Myntra", "Ajio", "Amazon"],
    "companyDistribution": [
      {
        "company": "Myntra",
        "count": 2,
        "avgPrice": 1299.5
      },
      {
        "company": "Ajio", 
        "count": 2,
        "avgPrice": 1599.0
      },
      {
        "company": "Amazon",
        "count": 1,
        "avgPrice": 1899.0
      }
    ],
    "priceStats": {
      "min": 999,
      "max": 1899,
      "avg": 1399.3,
      "total": 6996.5,
      "count": 5
    },
    "bestDeals": [
      {
        "company": "Myntra",
        "product": {...},
        "price": 999
      },
      {
        "company": "Ajio",
        "product": {...},
        "price": 1299
      }
    ],
    "priceRange": {
      "lowest": 999,
      "highest": 1899,
      "difference": 900
    }
  }
}
```

## Product Data Structure

Each product in a comparison session includes:

```json
{
  "productId": "unique_id",
  "title": "Product Title",
  "price": "₹1,299",
  "priceNumber": 1299,
  "link": "https://product-url.com",
  "source": "Myntra",
  "thumbnail": "https://image-url.jpg",
  "rating": 4.2,
  "reviews": 156,
  "availability": "In Stock",
  "shipping": "Free Delivery",
  "originalData": {...}
}
```

## Authentication

All comparison endpoints require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Error Responses

All endpoints return appropriate HTTP status codes:

- `400` - Bad Request (invalid data)
- `401` - Unauthorized (missing/invalid token)
- `404` - Not Found (comparison doesn't exist)
- `500` - Internal Server Error

## Usage Examples

### Creating a Comparison from Search Results

1. Perform a search using the existing `/search` endpoint
2. Select products from the results
3. Create a comparison session with selected products
4. Use analytics to find the best deals

### Frontend Integration

The comparison feature can be integrated into the existing frontend by:

1. Adding a "Compare" button to product cards
2. Creating a comparison page to display side-by-side comparisons
3. Using the analytics endpoint to show price insights
4. Implementing a comparison management interface

## Features

- **Price Analysis**: Compare prices across different companies
- **Company Distribution**: See how many products are from each source
- **Best Deals**: Automatically identify the lowest-priced option per company
- **Price Range**: Calculate the difference between highest and lowest prices
- **Session Management**: Save and manage multiple comparison sessions
- **Real-time Updates**: Update comparisons by adding/removing products
