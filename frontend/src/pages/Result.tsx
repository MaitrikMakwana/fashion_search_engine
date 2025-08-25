import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, BarChart3 } from 'lucide-react';
import { SearchResponse, Product, WishlistItem, SearchFilters, SortOptions } from '../types';
import Header from '../components/Header';
import ProductCard from '../components/ProductCard';
import ComparisonView from '../components/ComparisonView';
import Toast, { ToastType } from '../components/Toast';

const Result: React.FC = () => {
  const navigate = useNavigate();
  const [searchData, setSearchData] = useState<SearchResponse | null>(null);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showComparison, setShowComparison] = useState(true); // Show comparison by default
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null);

  // Filter states
  const [filters, setFilters] = useState<SearchFilters>({});
  const [sortOptions, setSortOptions] = useState<SortOptions>({});
  
  // Available filter options extracted from actual product data
  const [availableFilters, setAvailableFilters] = useState<{
    sources: string[];
    priceRanges: { label: string; min: number; max: number }[];
    colors: string[];
  }>({
    sources: [],
    priceRanges: [],
    colors: []
  });

  // Helper function to parse price from string
  const parsePrice = (priceString?: string): number => {
    if (!priceString) return 0;
    
    const priceStr = String(priceString).trim();
    
    // Handle common price patterns
    // Pattern 1: ₹1,000 or $1,000 or €1,000
    let match = priceStr.match(/[₹$€£]\s*([\d,]+(?:\.\d{2})?)/);
    if (match) {
      const cleanPrice = match[1].replace(/,/g, '');
      const num = parseFloat(cleanPrice);
      if (!isNaN(num)) return num;
    }
    
    // Pattern 2: 1,000 or 1000 (without currency symbol)
    match = priceStr.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/);
    if (match) {
      const cleanPrice = match[1].replace(/,/g, '');
      const num = parseFloat(cleanPrice);
      if (!isNaN(num)) return num;
    }
    
    // Pattern 3: "Rs. 1,000" or "Price: 1000" or "1000 only"
    match = priceStr.match(/(?:Rs?\.?\s*|₹\s*|price\s*:?\s*|cost\s*:?\s*)(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)(?:\s*\/-|\s*only|\s*rs?)?/i);
    if (match) {
      const cleanPrice = match[1].replace(/,/g, '');
      const num = parseFloat(cleanPrice);
      if (!isNaN(num)) return num;
    }
    
    // Pattern 4: Extract any number that looks like a price (3+ digits)
    const allNumbers = priceStr.match(/\d{3,}/g);
    if (allNumbers && allNumbers.length > 0) {
      const candidates = allNumbers
        .map(n => parseInt(n.replace(/,/g, ''), 10))
        .filter(n => n > 100 && n < 1000000); // Reasonable price range
      
      if (candidates.length > 0) {
        candidates.sort((a, b) => a - b);
        return candidates[Math.floor(candidates.length / 2)];
      }
    }
    
    // Fallback: try to extract any number
    const fallbackMatch = priceStr.match(/(\d+\.?\d*)/);
    if (fallbackMatch) {
      const num = parseFloat(fallbackMatch[1]);
      if (!isNaN(num)) return num;
    }
    
    return 0;
  };

  // Extract available filter options from product data
  const extractAvailableFilters = useCallback((products: Product[]) => {
    if (!products || products.length === 0) return;

    // Extract unique sources (brands/platforms)
    const sources = Array.from(new Set(products
      .map(p => p.source)
      .filter(Boolean)
      .map(s => s!)
    )).sort();

    // Extract colors from product titles
    const commonColors = [
      'black', 'white', 'red', 'blue', 'green', 'yellow', 'pink', 'purple', 
      'brown', 'gray', 'grey', 'orange', 'navy', 'beige', 'cream', 'gold', 
      'silver', 'maroon', 'olive', 'teal', 'coral', 'lime', 'indigo'
    ];
    
    const foundColors = new Set<string>();
    products.forEach(product => {
      const title = product.title.toLowerCase();
      commonColors.forEach(color => {
        if (title.includes(color)) {
          foundColors.add(color);
        }
      });
    });
    const colors = Array.from(foundColors).sort();

    // Create price ranges based on actual product prices
    const prices = products
      .map(p => parsePrice(p.price))
      .filter(price => price > 0)
      .sort((a, b) => a - b);

    const priceRanges = [];
    if (prices.length > 0) {
      const min = prices[0];
      const max = prices[prices.length - 1];
      
      if (max > 100) {
        const allRanges = [
          { label: 'Under ₹500', min: 0, max: 500 },
          { label: '₹500 - ₹1000', min: 500, max: 1000 },
          { label: '₹1000 - ₹2000', min: 1000, max: 2000 },
          { label: '₹2000 - ₹5000', min: 2000, max: 5000 },
          { label: 'Above ₹5000', min: 5000, max: Infinity }
        ];
        
        priceRanges.push(...allRanges.filter(range => 
          // Only include ranges that have products
          products.some(p => {
            const price = parsePrice(p.price);
            return price >= range.min && (range.max === Infinity ? true : price <= range.max);
          })
        ));
      }
    }

    setAvailableFilters({ sources, colors, priceRanges });
  }, []);

  const loadSearchResults = useCallback(() => {
    const savedResults = sessionStorage.getItem('searchResults');
    if (savedResults) {
      const data = JSON.parse(savedResults);
      setSearchData(data);
      setFilteredProducts(data.products);
      extractAvailableFilters(data.products);
    } else {
      navigate('/');
    }
  }, [navigate, extractAvailableFilters]);

  const loadWishlist = useCallback(async () => {
    try {
      const response = await fetch(`${window.location.origin}/wishlist`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setWishlistItems(data.items);
      }
    } catch (error) {
      console.error('Failed to load wishlist:', error);
    }
  }, []);

  const applyFiltersAndSort = useCallback(() => {
    if (!searchData) return;

    let filtered = [...searchData.products];

    // Apply source/brand filter
    if (filters.brands && filters.brands.length > 0) {
      filtered = filtered.filter(product =>
        filters.brands!.includes(product.source || '')
      );
    }

    // Apply color filter
    if (filters.colors && filters.colors.length > 0) {
      filtered = filtered.filter(product => {
        const title = product.title.toLowerCase();
        return filters.colors!.some(color =>
          title.includes(color.toLowerCase())
        );
      });
    }

            // Apply price range filter
        if (filters.minPrice !== undefined && filters.maxPrice !== undefined) {
          filtered = filtered.filter(product => {
            const price = parsePrice(product.price);
            if (price === 0) return false; // Exclude products with no price
            
            const min = filters.minPrice!;
            const max = filters.maxPrice!;
            
            return price >= min && (max === Infinity ? true : price <= max);
          });
        }

    // Apply sorting
    if (sortOptions.sortBy === 'price') {
      filtered.sort((a, b) => {
        const priceA = parsePrice(a.price);
        const priceB = parsePrice(b.price);
        
        // Handle products with no price (put them at the end)
        if (priceA === 0 && priceB === 0) return 0;
        if (priceA === 0) return 1;
        if (priceB === 0) return -1;
        
        return sortOptions.sortOrder === 'desc' ? priceB - priceA : priceA - priceB;
      });
    }

    setFilteredProducts(filtered);
  }, [searchData, filters, sortOptions]);

  const handleSaveToWishlist = (item: WishlistItem) => {
    setWishlistItems(prev => [item, ...prev]);
    showToast('success', 'Added to wishlist!');
  };

  const handleRemoveFromWishlist = (id: string) => {
    setWishlistItems(prev => prev.filter(item => item._id !== id));
    showToast('success', 'Removed from wishlist!');
  };

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    console.log(`Filter change: ${key} =`, value);
    setFilters(prev => {
      const newFilters = {
        ...prev,
        [key]: value,
      };
      console.log('New filters:', newFilters);
      return newFilters;
    });
  };

  const handleSortChange = (sortBy: string, sortOrder: string) => {
    console.log(`Sort change: ${sortBy} - ${sortOrder}`);
    const newSortOptions = { 
      sortBy: sortBy === 'relevance' ? undefined : sortBy as 'price' | 'date', 
      sortOrder: sortOrder as 'asc' | 'desc' 
    };
    console.log('New sort options:', newSortOptions);
    setSortOptions(newSortOptions);
  };

  const clearFilters = () => {
    setFilters({});
    setSortOptions({});
    showToast('success', 'Filters cleared!');
  };

  const showToast = (type: ToastType, message: string) => {
    setToast({ type, message });
  };

  // useEffect hooks after function declarations
  useEffect(() => {
    loadSearchResults();
    loadWishlist();
  }, [loadSearchResults, loadWishlist]);

  // Apply filters and sorting whenever filters or sort options change
  useEffect(() => {
    applyFiltersAndSort();
  }, [applyFiltersAndSort]);

  if (!searchData) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header showBackButton onBackClick={() => navigate('/')} />
      
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Search Details */}
        <div className="card mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Search Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Query</p>
              <p className="font-medium text-gray-900">{searchData.query}</p>
            </div>
            <div>

            </div>
          </div>
        </div>

        {/* Filters and Sort */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200"
            >
              <Filter size={18} />
              <span>Filters</span>
            </button>
            
            <button
              onClick={() => setShowComparison(!showComparison)}
              className={`flex items-center space-x-2 px-4 py-2 border rounded-lg transition-colors duration-200 ${
                showComparison 
                  ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' 
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <BarChart3 size={18} />
              <span>Comparison</span>
            </button>
            
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Sort by:</span>
              <select
                value={`${sortOptions.sortBy || 'relevance'}-${sortOptions.sortOrder || 'asc'}`}
                onChange={(e) => {
                  const [sortBy, sortOrder] = e.target.value.split('-');
                  handleSortChange(sortBy, sortOrder);
                }}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="relevance-asc">Relevance</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
            </div>
          </div>
          
          <p className="text-sm text-gray-600">
            {filteredProducts.length} of {searchData.products.length} results
          </p>
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
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Price Range */}
              {availableFilters.priceRanges.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price Range
                  </label>
                  <select
                    value={
                      filters.minPrice !== undefined && filters.maxPrice !== undefined
                        ? `${filters.minPrice}-${filters.maxPrice}`
                        : ''
                    }
                    onChange={(e) => {
                      if (e.target.value === '') {
                        handleFilterChange('minPrice', undefined);
                        handleFilterChange('maxPrice', undefined);
                      } else {
                        const [min, max] = e.target.value.split('-').map(Number);
                        handleFilterChange('minPrice', min);
                        handleFilterChange('maxPrice', max);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="">All Prices</option>
                    {availableFilters.priceRanges.map((range, index) => (
                      <option key={index} value={`${range.min}-${range.max}`}>
                        {range.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Colors */}
              {availableFilters.colors.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Colors ({availableFilters.colors.length} available)
                  </label>
                  <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
                    {availableFilters.colors.map((color) => (
                      <label key={color} className="flex items-center space-x-2 py-1">
                        <input
                          type="checkbox"
                          checked={filters.colors?.includes(color) || false}
                          onChange={(e) => {
                            const currentColors = filters.colors || [];
                            if (e.target.checked) {
                              handleFilterChange('colors', [...currentColors, color]);
                            } else {
                              handleFilterChange('colors', currentColors.filter(c => c !== color));
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm capitalize">{color}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Sources/Brands */}
              {availableFilters.sources.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sources ({availableFilters.sources.length} available)
                  </label>
                  <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
                    {availableFilters.sources.map((source) => (
                      <label key={source} className="flex items-center space-x-2 py-1">
                        <input
                          type="checkbox"
                          checked={filters.brands?.includes(source) || false}
                          onChange={(e) => {
                            const currentBrands = filters.brands || [];
                            if (e.target.checked) {
                              handleFilterChange('brands', [...currentBrands, source]);
                            } else {
                              handleFilterChange('brands', currentBrands.filter(b => b !== source));
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">{source}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Comparison View */}
        {showComparison && searchData.comparison && (
          <ComparisonView
            comparison={searchData.comparison}
            onSaveToWishlist={handleSaveToWishlist}
            onRemoveFromWishlist={handleRemoveFromWishlist}
            wishlistItems={wishlistItems}
          />
        )}

        {/* Results Grid */}
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product, index) => (
              <ProductCard
                key={index}
                product={product}
                onSave={handleSaveToWishlist}
                onRemove={handleRemoveFromWishlist}
                isSaved={wishlistItems.some(item => item.title === product.title)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No products found matching your filters.</p>
            <button
              onClick={clearFilters}
              className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear filters
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

export default Result;
