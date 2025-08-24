import React, { useState } from 'react';
import { Product, WishlistItem } from '../types';
import { Heart, ExternalLink } from 'lucide-react';
import { api } from '../utils/api';

interface ProductCardProps {
  product: Product;
  onSave?: (item: WishlistItem) => void;
  onRemove?: (id: string) => void;
  isSaved?: boolean;
  showSaveButton?: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onSave,
  onRemove,
  isSaved = false,
  showSaveButton = true,
}) => {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(isSaved);

  const handleSave = async () => {
    if (saving) return;
    
    setSaving(true);
    try {
      if (saved && onRemove) {
        // Remove from wishlist
        if (product._id) {
          await api(`/wishlist/${product._id}`, { method: 'DELETE' });
          setSaved(false);
          onRemove(product._id);
        }
      } else if (!saved && onSave) {
        // Add to wishlist
        const response = await api('/wishlist', {
          method: 'POST',
          body: JSON.stringify({
            title: product.title,
            price: product.price,
            link: product.link,
            image: product.thumbnail,
            source: product.source,
          }),
        });
        setSaved(true);
        onSave(response.item);
      }
    } catch (error: any) {
      console.error('Failed to toggle save:', error);
      // Show user-friendly error message
      if (error.message?.includes('Missing token') || error.message?.includes('Invalid token')) {
        alert('Please log in to save items to your wishlist');
      } else {
        alert('Failed to save item. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  // Helper function to parse and format price
  const formatPrice = (priceString?: string): string => {
    if (!priceString) return '';
    
    const priceStr = String(priceString).trim();
    
    // Handle common price patterns
    // Pattern 1: ₹1,000 or $1,000 or €1,000
    let match = priceStr.match(/[₹$€£]\s*([\d,]+(?:\.\d{2})?)/);
    if (match) {
      const cleanPrice = match[1].replace(/,/g, '');
      const num = parseFloat(cleanPrice);
      if (!isNaN(num)) {
        return new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(num);
      }
    }
    
    // Pattern 2: 1,000 or 1000 (without currency symbol)
    match = priceStr.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/);
    if (match) {
      const cleanPrice = match[1].replace(/,/g, '');
      const num = parseFloat(cleanPrice);
      if (!isNaN(num)) {
        return new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(num);
      }
    }
    
    // Pattern 3: "Rs. 1,000" or "Price: 1000" or "1000 only"
    match = priceStr.match(/(?:Rs?\.?\s*|₹\s*|price\s*:?\s*|cost\s*:?\s*)(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)(?:\s*\/-|\s*only|\s*rs?)?/i);
    if (match) {
      const cleanPrice = match[1].replace(/,/g, '');
      const num = parseFloat(cleanPrice);
      if (!isNaN(num)) {
        return new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(num);
      }
    }
    
    // Pattern 4: Extract any number that looks like a price (3+ digits)
    const allNumbers = priceStr.match(/\d{3,}/g);
    if (allNumbers && allNumbers.length > 0) {
      const candidates = allNumbers
        .map(n => parseInt(n.replace(/,/g, ''), 10))
        .filter(n => n > 100 && n < 1000000); // Reasonable price range
      
      if (candidates.length > 0) {
        candidates.sort((a, b) => a - b);
        const num = candidates[Math.floor(candidates.length / 2)];
        return new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(num);
      }
    }
    
    // Fallback: try to extract any number
    const fallbackMatch = priceStr.match(/(\d+\.?\d*)/);
    if (fallbackMatch) {
      const num = parseFloat(fallbackMatch[1]);
      if (!isNaN(num)) {
        return new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(num);
      }
    }
    
    // If all else fails, return the original price string
    return priceString;
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDMwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xNTAgMTgwQzE2Ni41NjkgMTgwIDE4MCAxNjYuNTY5IDE4MCAxNTBDMTgwIDEzMy40MzEgMTY2LjU2OSAxMjAgMTUwIDEyMEMxMzMuNDMxIDEyMCAxMjAgMTMzLjQzMSAxMjAgMTUwQzEyMCAxNjYuNTY5IDEzMy40MzEgMTgwIDE1MCAxODBaIiBmaWxsPSIjOUI5QkEwIi8+CjxwYXRoIGQ9Ik0xNTAgMjAwQzE2Ni41NjkgMjAwIDE4MCAxODYuNTY5IDE4MCAxNzBDMTgwIDE1My40MzEgMTY2LjU2OSAxNDAgMTUwIDE0MEMxMzMuNDMxIDE0MCAxMjAgMTUzLjQzMSAxMjAgMTcwQzEyMCAxODYuNTY5IDEzMy40MzEgMjAwIDE1MCAyMDBaIiBmaWxsPSIjOUI5QkEwIi8+Cjx0ZXh0IHg9IjE1MCIgeT0iMjUwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNjc3NDhCIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4K';
  };

  return (
    <div className="card group hover:shadow-medium transition-shadow duration-200">
      <div className="relative aspect-[3/4] mb-4 overflow-hidden rounded-lg">
        <img
          src={product.thumbnail || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDMwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xNTAgMTgwQzE2Ni41NjkgMTgwIDE4MCAxNjYuNTY5IDE4MCAxNTBDMTgwIDEzMy40MzEgMTY2LjU2OSAxMjAgMTUwIDEyMEMxMzMuNDMxIDEyMCAxMjAgMTMzLjQzMSAxMjAgMTUwQzEyMCAxNjYuNTY5IDEzMy40MzEgMTgwIDE1MCAxODBaIiBmaWxsPSIjOUI5QkEwIi8+CjxwYXRoIGQ9Ik0xNTAgMjAwQzE2Ni41NjkgMjAwIDE4MCAxODYuNTY5IDE4MCAxNzBDMTgwIDE1My40MzEgMTY2LjU2OSAxNDAgMTUwIDE0MEMxMzMuNDMxIDE0MCAxMjAgMTUzLjQzMSAxMjAgMTcwQzEyMCAxODYuNTY5IDEzMy40MzEgMjAwIDE1MCAyMDBaIiBmaWxsPSIjOUI5QkEwIi8+Cjx0ZXh0IHg9IjE1MCIgeT0iMjUwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNjc3NDhCIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4K'}
          alt={product.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          onError={handleImageError}
          loading="lazy"
        />
        
        {showSaveButton && (
          <button
            onClick={handleSave}
            disabled={saving}
            className={`absolute top-3 right-3 p-2 rounded-full transition-all duration-200 ${
              saved
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-white/80 text-gray-600 hover:bg-white hover:text-red-500'
            }`}
          >
            <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>
      
      <div className="space-y-2">
        <h3 className="font-medium text-gray-900 line-clamp-2 leading-tight">
          {product.title}
        </h3>
        
        {product.price && (
          <p className="text-lg font-semibold text-gray-900">
            {formatPrice(product.price)}
          </p>
        )}
        
        {product.source && (
          <p className="text-sm text-gray-500">
            {product.source}
          </p>
        )}
        
        {product.link ? (
          <a
            href={product.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline"
          >
            <span>View Deal</span>
            <ExternalLink size={14} />
          </a>
        ) : (
          <span className="text-sm text-gray-400 font-medium">
            Link unavailable
          </span>
        )}
      </div>
    </div>
  );
};

export default ProductCard;
