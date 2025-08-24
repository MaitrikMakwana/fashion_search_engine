import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Heart, Filter } from 'lucide-react';
import { Ootd, WishlistItem } from '../types';
import { api } from '../utils/api';
import Header from '../components/Header';
import OotdCard from '../components/OotdCard';
import ProductCard from '../components/ProductCard';
import Toast, { ToastType } from '../components/Toast';

const OotdPage: React.FC = () => {
  const navigate = useNavigate();
  const [ootdItems, setOotdItems] = useState<Ootd[]>([]);
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  // Platform removed; backend aggregates across India marketplaces
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filteredOotdItems, setFilteredOotdItems] = useState<Ootd[]>([]);
  const [filteredWishlistItems, setFilteredWishlistItems] = useState<WishlistItem[]>([]);
  
  // Outfit suggestions state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [outfitAnalysis, setOutfitAnalysis] = useState<any>(null);
  const [outfitSuggestions, setOutfitSuggestions] = useState<any>({});
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  // Filter states
  const [filters, setFilters] = useState({
    searchTerm: '',
    dateRange: '',
  });

  const applyFilters = useCallback(() => {
    // Filter OOTD items
    let filteredOotd = [...ootdItems];
    if (filters.searchTerm) {
      filteredOotd = filteredOotd.filter(item =>
        item.caption.toLowerCase().includes(filters.searchTerm.toLowerCase())
      );
    }
    setFilteredOotdItems(filteredOotd);

    // Filter wishlist items
    let filteredWishlist = [...wishlistItems];
    if (filters.searchTerm) {
      filteredWishlist = filteredWishlist.filter(item =>
        item.title.toLowerCase().includes(filters.searchTerm.toLowerCase())
      );
    }
    setFilteredWishlistItems(filteredWishlist);
  }, [ootdItems, wishlistItems, filters]);

  useEffect(() => {
    // Only load data if user is authenticated
    const token = localStorage.getItem('token');
    if (token) {
      loadOotdItems();
      loadWishlist();
    }
  }, []);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const loadOotdItems = async () => {
    try {
      const response = await api('/ootd');
      setOotdItems(response.items);
    } catch (error) {
      console.error('Failed to load OOTD items:', error);
    }
  };

  const loadWishlist = async () => {
    try {
      const response = await api('/wishlist');
      setWishlistItems(response.items);
    } catch (error) {
      console.error('Failed to load wishlist:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile) {
      showToast('error', 'Please select an image to post your OOTD.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      
      if (imageFile) {
        formData.append('image', imageFile);
        console.log('Uploading image:', imageFile.name, 'Size:', imageFile.size);
      }
      
      if (caption.trim()) {
        formData.append('caption', caption.trim());
      }

      console.log('Submitting OOTD with:', {
        hasImage: !!imageFile,
        caption: caption.trim(),
        formDataEntries: Array.from(formData.entries())
      });

      const response = await api('/ootd', {
        method: 'POST',
        body: formData,
      });

      console.log('OOTD response:', response);

      // Clear form
      setImageFile(null);
      setCaption('');
      
      // Reload OOTD items
      await loadOotdItems();
      
      showToast('success', 'OOTD posted successfully!');
    } catch (error: any) {
      console.error('OOTD submit error:', error);
      showToast('error', error.message || 'Failed to post OOTD. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOotd = async (id: string) => {
    try {
      await api(`/ootd/${id}`, { method: 'DELETE' });
      setOotdItems(prev => prev.filter(item => item._id !== id));
      showToast('success', 'OOTD deleted successfully!');
    } catch (error: any) {
      showToast('error', error.message || 'Failed to delete OOTD.');
    }
  };

  const handleShopSimilar = async (ootd: Ootd) => {
    try {
      console.log('Shop similar for OOTD:', ootd);
      
      // Create a search request based on the OOTD
      const formData = new FormData();
      
      // Convert relative URL to absolute URL if needed
      let imageUrl = ootd.imageUrl;
      if (imageUrl && imageUrl.startsWith('/uploads/')) {
        imageUrl = `${window.location.origin}${imageUrl}`;
      }
      
      formData.append('imageUrl', imageUrl);
      if (ootd.caption) {
        formData.append('text', ootd.caption);
      }
      console.log('Searching with OOTD data:', {
        imageUrl: imageUrl,
        caption: ootd.caption
      });

      const response = await api('/search', {
        method: 'POST',
        body: formData,
      });

      console.log('OOTD search response:', response);

      // Save to sessionStorage for result page
      sessionStorage.setItem('searchResults', JSON.stringify(response));
      navigate('/result');
    } catch (error: any) {
      console.error('OOTD search error:', error);
      showToast('error', error.message || 'Failed to search for similar items.');
    }
  };

  const getOutfitSuggestions = async () => {
    if (!imageFile) {
      showToast('error', 'Please select an image first to get outfit suggestions.');
      return;
    }

    setSuggestionsLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      if (caption.trim()) {
        formData.append('caption', caption.trim());
      }

      const response = await api('/ootd/suggestions', {
        method: 'POST',
        body: formData,
      });

      setOutfitAnalysis(response.analysis);
      setOutfitSuggestions(response.suggestions);
      setShowSuggestions(true);
      showToast('success', 'Outfit analysis complete! Check the suggestions below.');
    } catch (error: any) {
      console.error('Error getting outfit suggestions:', error);
      showToast('error', error.message || 'Failed to get outfit suggestions.');
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const handleSaveToWishlist = (item: WishlistItem) => {
    setWishlistItems(prev => [item, ...prev]);
    showToast('success', 'Added to wishlist!');
  };

  const handleRemoveFromWishlist = (id: string) => {
    setWishlistItems(prev => prev.filter(item => item._id !== id));
    showToast('success', 'Removed from wishlist!');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log('Selected file:', file.name, 'Size:', file.size, 'Type:', file.type);
      setImageFile(file);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const clearFilters = () => {
    setFilters({
      searchTerm: '',
      dateRange: '',
    });
  };

  const showToast = (type: ToastType, message: string) => {
    setToast({ type, message });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header showBackButton onBackClick={() => navigate('/')} backText="Back to search" />
      
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Upload Card */}
        <div className="card mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Share Your OOTD</h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Image Upload */}
            <div>
              <label htmlFor="imageFile" className="block text-sm font-medium text-gray-700 mb-2">
                Upload your outfit photo
              </label>
              <div className="relative">
                <input
                  id="imageFile"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="input-field pl-10"
                />
                <Camera className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              </div>
            </div>

            {/* Caption */}
            <div>
              <label htmlFor="caption" className="block text-sm font-medium text-gray-700 mb-2">
                Caption (optional)
              </label>
              <textarea
                id="caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="input-field resize-none"
                rows={3}
                placeholder="Describe your outfit or add some context..."
              />
            </div>



            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={getOutfitSuggestions}
                disabled={suggestionsLoading || !imageFile}
                className="w-full px-6 py-3 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-200 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {suggestionsLoading ? 'Analyzing...' : 'Get Outfit Suggestions'}
              </button>
              
              <button
                type="submit"
                disabled={loading || (!imageFile && !caption.trim())}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Posting...' : 'Post OOTD + Find Similar'}
              </button>
            </div>
          </form>
        </div>

        {/* Outfit Suggestions */}
        {showSuggestions && outfitAnalysis && (
          <div className="card mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Outfit Analysis & Suggestions</h3>
            
            {/* Analysis Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">Main Item</p>
                <p className="font-medium capitalize">{outfitAnalysis.mainItem}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Style</p>
                <p className="font-medium capitalize">{outfitAnalysis.style}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Color Scheme</p>
                <p className="font-medium capitalize">{outfitAnalysis.colorScheme}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Occasion</p>
                <p className="font-medium capitalize">{outfitAnalysis.occasion}</p>
              </div>
            </div>

            {/* Suggestions Grid */}
            <div className="space-y-6">
              {/* Bottoms Suggestions */}
              {outfitSuggestions.bottoms && outfitSuggestions.bottoms.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Suggested Bottoms</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {outfitSuggestions.bottoms.slice(0, 8).map((product: any, index: number) => (
                      <ProductCard
                        key={index}
                        product={product}
                        onSave={handleSaveToWishlist}
                        onRemove={handleRemoveFromWishlist}
                        isSaved={wishlistItems.some(item => item.title === product.title)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Tops Suggestions */}
              {outfitSuggestions.tops && outfitSuggestions.tops.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Suggested Tops</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {outfitSuggestions.tops.slice(0, 8).map((product: any, index: number) => (
                      <ProductCard
                        key={index}
                        product={product}
                        onSave={handleSaveToWishlist}
                        onRemove={handleRemoveFromWishlist}
                        isSaved={wishlistItems.some(item => item.title === product.title)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Shoes Suggestions */}
              {outfitSuggestions.shoes && outfitSuggestions.shoes.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Suggested Shoes</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {outfitSuggestions.shoes.slice(0, 8).map((product: any, index: number) => (
                      <ProductCard
                        key={index}
                        product={product}
                        onSave={handleSaveToWishlist}
                        onRemove={handleRemoveFromWishlist}
                        isSaved={wishlistItems.some(item => item.title === product.title)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Accessories Suggestions */}
              {outfitSuggestions.accessories && outfitSuggestions.accessories.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Suggested Accessories</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {outfitSuggestions.accessories.slice(0, 8).map((product: any, index: number) => (
                      <ProductCard
                        key={index}
                        product={product}
                        onSave={handleSaveToWishlist}
                        onRemove={handleRemoveFromWishlist}
                        isSaved={wishlistItems.some(item => item.title === product.title)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Close Suggestions Button */}
            <div className="mt-6 text-center">
              <button
                onClick={() => setShowSuggestions(false)}
                className="text-gray-600 hover:text-gray-800 font-medium"
              >
                Hide Suggestions
              </button>
            </div>
          </div>
        )}

        {/* OOTD Feed */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <Camera className="text-purple-600" size={24} />
              <h2 className="text-2xl font-bold text-gray-900">Your OOTD Feed</h2>
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200"
            >
              <Filter size={18} />
              <span>Filters</span>
            </button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="card mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Clear all
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Search Term */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search
                  </label>
                  <input
                    type="text"
                    placeholder="Search OOTD captions or wishlist items..."
                    value={filters.searchTerm}
                    onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>

                {/* Date Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date Range
                  </label>
                  <select
                    value={filters.dateRange}
                    onChange={(e) => handleFilterChange('dateRange', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="">All time</option>
                    <option value="today">Today</option>
                    <option value="week">This week</option>
                    <option value="month">This month</option>
                  </select>
                </div>
              </div>
            </div>
          )}
          
          {filteredOotdItems.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredOotdItems.map((ootd) => (
                <OotdCard
                  key={ootd._id}
                  ootd={ootd}
                  onDelete={handleDeleteOotd}
                  onShopSimilar={handleShopSimilar}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Camera className="mx-auto text-gray-400 mb-4" size={48} />
              {ootdItems.length === 0 ? (
                <>
                  <p className="text-gray-500 text-lg">No OOTD posts yet.</p>
                  <p className="text-gray-400">Share your first outfit above!</p>
                </>
              ) : (
                <>
                  <p className="text-gray-500 text-lg">No OOTD posts match your filters.</p>
                  <button
                    onClick={clearFilters}
                    className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Clear filters
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Wishlist */}
        {filteredWishlistItems.length > 0 && (
          <div>
            <div className="flex items-center space-x-2 mb-6">
              <Heart className="text-red-500" size={24} />
              <h2 className="text-2xl font-bold text-gray-900">Your Wishlist</h2>
              <span className="text-gray-500">({filteredWishlistItems.length} of {wishlistItems.length})</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredWishlistItems.map((item) => (
                <ProductCard
                  key={item._id}
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
                />
              ))}
            </div>
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

export default OotdPage;
