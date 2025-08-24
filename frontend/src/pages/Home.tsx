import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Upload, 
  Link as LinkIcon, 
  TrendingUp, 
  Heart, 
  Sparkles, 
  Camera, 
  ShoppingBag, 
  Zap,
  Users,
  Star,
  ArrowRight
} from 'lucide-react';
import { api } from '../utils/api';
import { Product, WishlistItem } from '../types';
import Header from '../components/Header';
import ProductCard from '../components/ProductCard';
import Toast, { ToastType } from '../components/Toast';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null);

  useEffect(() => {
    loadTrendingProducts();
    
    const token = localStorage.getItem('token');
    if (token) {
      loadWishlist();
    }
  }, []);

  const loadTrendingProducts = async () => {
    try {
      const response = await api('/trending?limit=8');
      setTrendingProducts(response.items);
    } catch (error) {
      console.error('Failed to load trending products:', error);
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchText && !imageFile && !imageUrl) {
      showToast('error', 'Please provide a search term, image file, or image URL.');
      return;
    }

    if (imageFile && imageFile.size > 10 * 1024 * 1024) {
      showToast('error', 'Image file is too large. Please select an image smaller than 10MB.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      
      if (imageFile) {
        formData.append('image', imageFile);
      }
      
      if (imageUrl) {
        formData.append('imageUrl', imageUrl);
      }
      
      if (searchText) {
        formData.append('text', searchText);
      }

      const response = await api('/search', {
        method: 'POST',
        body: formData,
      });

      sessionStorage.setItem('searchResults', JSON.stringify(response));
      navigate('/result');
    } catch (error: any) {
      console.error('Search error:', error);
      showToast('error', error.message || 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSearchText('');
    setImageFile(null);
    setImageUrl('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
      if (!validTypes.includes(file.type)) {
        showToast('error', 'Please select a valid image file (JPEG, PNG, GIF, WebP, or BMP).');
        e.target.value = '';
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) {
        showToast('error', 'Image file is too large. Please select an image smaller than 10MB.');
        e.target.value = '';
        return;
      }
      
      setImageFile(file);
      setImageUrl('');
      showToast('success', `Image "${file.name}" selected successfully!`);
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageUrl(e.target.value);
    setImageFile(null);
  };

  const handleSaveToWishlist = (item: WishlistItem) => {
    setWishlistItems(prev => [item, ...prev]);
    showToast('success', 'Added to wishlist!');
  };

  const handleRemoveFromWishlist = (id: string) => {
    setWishlistItems(prev => prev.filter(item => item._id !== id));
    showToast('success', 'Removed from wishlist!');
  };

  const showToast = (type: ToastType, message: string) => {
    setToast({ type, message });
  };

  const features = [
    {
      icon: <Search className="text-blue-600" size={24} />,
      title: "Smart Text Search",
      description: "Describe what you're looking for in natural language and find exactly what you need."
    },
    {
      icon: <Camera className="text-purple-600" size={24} />,
      title: "Visual Search",
      description: "Upload any fashion image and discover similar products from top retailers."
    },
    {
      icon: <Heart className="text-red-600" size={24} />,
      title: "Personal Wishlist",
      description: "Save your favorite finds and build your perfect wardrobe collection."
    },
    {
      icon: <TrendingUp className="text-green-600" size={24} />,
      title: "Price Comparison",
      description: "Compare prices across multiple platforms to get the best deals."
    },
    {
      icon: <Sparkles className="text-yellow-600" size={24} />,
      title: "OOTD Gallery",
      description: "Share your outfits of the day and get inspired by the community."
    },
    {
      icon: <Zap className="text-indigo-600" size={24} />,
      title: "Trending Styles",
      description: "Stay updated with the latest fashion trends and popular items."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      <Header />
      
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-6">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full blur opacity-75"></div>
              <div className="relative bg-white p-3 rounded-full">
                <ShoppingBag className="text-blue-600" size={32} />
              </div>
            </div>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Find Your Perfect
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent block">
              Fashion Style
            </span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
            Discover fashion with AI-powered search. Search by text, upload images, or browse trending styles. 
            Compare prices across multiple retailers and build your dream wardrobe.
          </p>
          
          <div className="flex items-center justify-center space-x-8 text-sm text-gray-500">
            <div className="flex items-center space-x-2">
              <Users size={16} />
              <span>10K+ Happy Users</span>
            </div>
            <div className="flex items-center space-x-2">
              <Star size={16} className="text-yellow-500" />
              <span>4.9/5 Rating</span>
            </div>
            <div className="flex items-center space-x-2">
              <ShoppingBag size={16} />
              <span>1M+ Products</span>
            </div>
          </div>
        </div>

        {/* Search Section */}
        <div className="max-w-4xl mx-auto mb-20">
          <div className="relative">
            {/* Gradient Background */}
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-25"></div>
            
            <div className="relative bg-white rounded-2xl shadow-medium border border-gray-100 p-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Start Your Fashion Journey</h2>
                <p className="text-gray-600">Search by description, upload an image, or paste an image URL</p>
              </div>
              
              <form onSubmit={handleSearch} className="space-y-6">
                {/* Text Search */}
                <div className="group">
                  <label htmlFor="searchText" className="block text-sm font-semibold text-gray-700 mb-3">
                    <Search className="inline mr-2" size={16} />
                    Describe Your Style
                  </label>
                  <div className="relative">
                    <input
                      id="searchText"
                      type="text"
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="input-field pl-12 py-4 text-lg border-2 group-hover:border-blue-300 transition-all duration-200"
                      placeholder="e.g., vintage leather jacket, summer floral dress, minimalist white sneakers..."
                    />
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-blue-500 transition-colors" size={20} />
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="h-px bg-gray-200 flex-1"></div>
                  <span className="text-sm text-gray-500 font-medium">OR</span>
                  <div className="h-px bg-gray-200 flex-1"></div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Image Upload */}
                  <div className="group">
                    <label htmlFor="imageFile" className="block text-sm font-semibold text-gray-700 mb-3">
                      <Upload className="inline mr-2" size={16} />
                      Upload Image
                    </label>
                    <div className="relative">
                      <input
                        id="imageFile"
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="input-field pl-12 py-4 border-2 group-hover:border-purple-300 transition-all duration-200"
                      />
                      <Upload className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-purple-500 transition-colors" size={20} />
                    </div>
                    {imageFile && (
                      <div className="mt-3 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-green-800">{imageFile.name}</p>
                            <p className="text-xs text-green-600">{(imageFile.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Image URL */}
                  <div className="group">
                    <label htmlFor="imageUrl" className="block text-sm font-semibold text-gray-700 mb-3">
                      <LinkIcon className="inline mr-2" size={16} />
                      Image URL
                    </label>
                    <div className="relative">
                      <input
                        id="imageUrl"
                        type="url"
                        value={imageUrl}
                        onChange={handleUrlChange}
                        className="input-field pl-12 py-4 border-2 group-hover:border-indigo-300 transition-all duration-200"
                        placeholder="https://example.com/image.jpg"
                      />
                      <LinkIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-indigo-500 transition-colors" size={20} />
                    </div>
                    {imageUrl && (
                      <div className="mt-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <LinkIcon className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-blue-800">Image URL provided</p>
                            <p className="text-xs text-blue-600 truncate">{imageUrl}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-lg"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <Search size={20} />
                        <span>Find My Style</span>
                        <ArrowRight size={20} />
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="sm:w-auto px-8 py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors duration-200"
                  >
                    Clear All
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Why Choose Fashion Search?</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Discover the future of fashion shopping with our AI-powered platform
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="group p-6 bg-white rounded-xl shadow-soft border border-gray-100 hover:shadow-medium transition-all duration-300 hover:-translate-y-1">
                <div className="mb-4 p-3 bg-gray-50 rounded-lg w-fit group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Trending Section */}
        {trendingProducts.length > 0 && (
          <div className="mb-16">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-r from-orange-400 to-pink-500 rounded-lg">
                  <TrendingUp className="text-white" size={24} />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">Trending Now</h2>
                  <p className="text-gray-600">What's hot in fashion today</p>
                </div>
              </div>
              <button 
                onClick={() => navigate('/result')}
                className="text-blue-600 hover:text-blue-700 font-semibold flex items-center space-x-2 transition-colors"
              >
                <span>View All</span>
                <ArrowRight size={16} />
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {trendingProducts.slice(0, 8).map((product, index) => (
                <div key={index} className="group">
                  <ProductCard
                    product={product}
                    onSave={handleSaveToWishlist}
                    onRemove={handleRemoveFromWishlist}
                    isSaved={wishlistItems.some(item => item.title === product.title)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Wishlist CTA */}
        {wishlistItems.length > 0 && (
          <div className="text-center bg-gradient-to-r from-pink-50 to-rose-50 rounded-2xl p-8 border border-pink-100">
            <Heart className="text-red-500 mx-auto mb-4" size={48} />
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Your Wishlist Awaits</h3>
            <p className="text-gray-600 mb-6">You have {wishlistItems.length} amazing items saved</p>
            <button
              onClick={() => navigate('/wishlist')}
              className="inline-flex items-center space-x-2 px-8 py-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl font-semibold hover:from-pink-600 hover:to-rose-600 transition-all duration-200 shadow-lg"
            >
              <Heart size={20} />
              <span>View My Wishlist</span>
              <ArrowRight size={20} />
            </button>
          </div>
        )}
      </section>

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

export default Home;
