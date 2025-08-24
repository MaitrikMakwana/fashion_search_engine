import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Trash2 } from 'lucide-react';
import { WishlistItem } from '../types';
import { api } from '../utils/api';
import Header from '../components/Header';
import ProductCard from '../components/ProductCard';
import Toast, { ToastType } from '../components/Toast';

const Wishlist: React.FC = () => {
  const navigate = useNavigate();
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null);

  const loadWishlist = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api('/wishlist');
      setWishlistItems(response.items);
    } catch (error) {
      console.error('Failed to load wishlist:', error);
      showToast('error', 'Failed to load wishlist items.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only load data if user is authenticated
    const token = localStorage.getItem('token');
    if (token) {
      loadWishlist();
    }
  }, [loadWishlist]);



  const handleRemoveFromWishlist = async (id: string) => {
    try {
      await api(`/wishlist/${id}`, { method: 'DELETE' });
      setWishlistItems(prev => prev.filter(item => item._id !== id));
      showToast('success', 'Item removed from wishlist!');
    } catch (error) {
      console.error('Failed to remove item:', error);
      showToast('error', 'Failed to remove item from wishlist.');
    }
  };

  const handleRefreshPrices = async () => {
    try {
      setLoading(true);
      showToast('info', 'Refreshing prices... This may take a moment.');
      
      const response = await api('/refresh-prices', {
        method: 'POST',
        body: JSON.stringify({ products: wishlistItems }),
      });
      
      setWishlistItems(response.products);
      showToast('success', 'Prices refreshed successfully!');
    } catch (error) {
      console.error('Failed to refresh prices:', error);
      showToast('error', 'Failed to refresh prices. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToWishlist = (item: WishlistItem) => {
    setWishlistItems(prev => [item, ...prev]);
    showToast('success', 'Added to wishlist!');
  };



  const showToast = (type: ToastType, message: string) => {
    setToast({ type, message });
  };

  // Helper function to parse price string to number
  const parsePrice = (priceString?: string): number => {
    if (!priceString) return 0;
    const cleaned = priceString.replace(/[^\d.]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Calculate total price of all wishlist items
  const calculateTotalPrice = (): string => {
    const total = wishlistItems.reduce((sum, item) => {
      return sum + parsePrice(item.price);
    }, 0);
    
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(total);
  };

  // Calculate average price of wishlist items
  const calculateAveragePrice = (): string => {
    if (wishlistItems.length === 0) return '₹0';
    
    const total = wishlistItems.reduce((sum, item) => {
      return sum + parsePrice(item.price);
    }, 0);
    
    const average = total / wishlistItems.length;
    
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(average);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading wishlist...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header showBackButton onBackClick={() => navigate('/')} backText="Back to search" />
      
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-2">
            <Heart className="text-red-500" size={28} />
            <h1 className="text-3xl font-bold text-gray-900">My Wishlist</h1>
            <span className="text-gray-500">({wishlistItems.length} items)</span>
          </div>
          {wishlistItems.length > 0 && (
            <button
              onClick={handleRefreshPrices}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh Prices</span>
            </button>
          )}
        </div>

        {/* Wishlist Summary */}
        {wishlistItems.length > 0 && (
          <div className="card mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">Total Items</p>
                <p className="text-2xl font-bold text-blue-600">{wishlistItems.length}</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-600">Total Value</p>
                <p className="text-2xl font-bold text-green-600">
                  {calculateTotalPrice()}
                </p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-sm text-gray-600">Average Price</p>
                <p className="text-2xl font-bold text-purple-600">
                  {calculateAveragePrice()}
                </p>
              </div>
            </div>
          </div>
        )}



        {/* Wishlist Grid */}
        {wishlistItems.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {wishlistItems.map((item) => (
              <div key={item._id} className="relative">
                <ProductCard
                  product={{
                    _id: item._id,
                    title: item.title,
                    price: item.price,
                    link: item.link,
                    source: item.source,
                    thumbnail: item.image,
                  }}
                  onSave={handleSaveToWishlist}
                  onRemove={handleRemoveFromWishlist}
                  isSaved={true}
                  showSaveButton={false}
                />
                
                {/* Remove Button */}
                <button
                  onClick={() => handleRemoveFromWishlist(item._id)}
                  className="absolute top-3 left-3 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors duration-200"
                  title="Remove from wishlist"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
                  ) : (
            <div className="text-center py-12">
              <Heart className="mx-auto text-gray-400 mb-4" size={48} />
              <p className="text-gray-500 text-lg">Your wishlist is empty.</p>
              <p className="text-gray-400 mb-6">Start adding items you love!</p>
              <button
                onClick={() => navigate('/')}
                className="btn-primary"
              >
                Browse Products
              </button>
            </div>
          )}
      </main>

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default Wishlist;
