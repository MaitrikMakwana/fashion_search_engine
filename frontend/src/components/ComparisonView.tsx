import React from 'react';
import { TrendingUp, TrendingDown, Minus, Star } from 'lucide-react';
import { ComparisonData } from '../types';
import ProductCard from './ProductCard';

interface ComparisonViewProps {
  comparison: ComparisonData;
  onSaveToWishlist: (product: any) => void;
  onRemoveFromWishlist: (id: string) => void;
  wishlistItems: any[];
}

const ComparisonView: React.FC<ComparisonViewProps> = ({
  comparison,
  onSaveToWishlist,
  onRemoveFromWishlist,
  wishlistItems
}) => {
  if (!comparison || comparison.companies.length === 0) {
    return null;
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const getPriceTrend = (price: number) => {
    if (!comparison.priceStats) return 'neutral';
    const avg = comparison.priceStats.avg;
    if (price < avg * 0.9) return 'down';
    if (price > avg * 1.1) return 'up';
    return 'neutral';
  };

  const getPriceTrendIcon = (trend: string) => {
    switch (trend) {
      case 'down':
        return <TrendingDown className="w-4 h-4 text-green-500" />;
      case 'up':
        return <TrendingUp className="w-4 h-4 text-red-500" />;
      default:
        return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="mb-8">
      {/* Comparison Header */}
      <div className="card mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Price Comparison by Company</h2>
        
        {/* Price Statistics */}
        {comparison.priceStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">Lowest Price</p>
              <p className="text-xl font-bold text-blue-600">
                {formatPrice(comparison.priceStats.min)}
              </p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600">Average Price</p>
              <p className="text-xl font-bold text-green-600">
                {formatPrice(comparison.priceStats.avg)}
              </p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-gray-600">Highest Price</p>
              <p className="text-xl font-bold text-red-600">
                {formatPrice(comparison.priceStats.max)}
              </p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-gray-600">Price Range</p>
              <p className="text-xl font-bold text-purple-600">
                {formatPrice(comparison.priceStats.max - comparison.priceStats.min)}
              </p>
            </div>
          </div>
        )}

        {/* Best Deals */}
        {comparison.bestDeals.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Best Deals by Company</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {comparison.bestDeals.slice(0, 6).map((deal, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">{deal.company}</span>
                    <span className="text-lg font-bold text-green-600">
                      {formatPrice(deal.price)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                    {deal.product.title}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1">
                      {deal.product.rating && (
                        <>
                          <Star className="w-4 h-4 text-yellow-400 fill-current" />
                          <span className="text-sm text-gray-600">{deal.product.rating}</span>
                        </>
                      )}
                    </div>
                    {deal.product.link ? (
                      <a
                        href={deal.product.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline"
                      >
                        View Deal →
                      </a>
                    ) : (
                      <span className="text-sm text-gray-400 font-medium">
                        Link unavailable
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Company-wise Product Groups */}
      <div className="space-y-8">
        {comparison.companies.map((company) => {
          const products = comparison.companyGroups[company];
          const avgPrice = products.reduce((sum, p) => {
            const price = parseFloat(p.price?.replace(/[^\d.]/g, '') || '0');
            return sum + price;
          }, 0) / products.length;

          return (
            <div key={company} className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{company}</h3>
                  <p className="text-sm text-gray-600">
                    {products.length} product{products.length !== 1 ? 's' : ''} • 
                    Avg: {formatPrice(avgPrice)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Starting from</p>
                  <p className="text-lg font-bold text-green-600">
                    {formatPrice(Math.min(...products.map(p => 
                      parseFloat(p.price?.replace(/[^\d.]/g, '') || '0')
                    )))}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {products.map((product, index) => {
                  const price = parseFloat(product.price?.replace(/[^\d.]/g, '') || '0');
                  const trend = getPriceTrend(price);
                  const isSaved = wishlistItems.some(item => item.title === product.title);

                  return (
                    <div key={index} className="relative">
                      <ProductCard
                        product={product}
                        onSave={onSaveToWishlist}
                        onRemove={onRemoveFromWishlist}
                        isSaved={isSaved}
                      />
                      
                      {/* Price Trend Indicator */}
                      <div className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-sm">
                        {getPriceTrendIcon(trend)}
                      </div>
                      
                      {/* Price Comparison Badge */}
                      {comparison.priceStats && (
                        <div className="absolute top-2 left-2">
                          {trend === 'down' && (
                            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">
                              Good Deal
                            </span>
                          )}
                          {trend === 'up' && (
                            <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-medium">
                              Above Avg
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ComparisonView;
