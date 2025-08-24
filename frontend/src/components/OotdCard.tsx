import React from 'react';
import { Ootd } from '../types';
import { Trash2, ShoppingBag } from 'lucide-react';

interface OotdCardProps {
  ootd: Ootd;
  onDelete?: (id: string) => void;
  onShopSimilar?: (ootd: Ootd) => void;
}

const OotdCard: React.FC<OotdCardProps> = ({
  ootd,
  onDelete,
  onShopSimilar,
}) => {
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDMwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xNTAgMTgwQzE2Ni41NjkgMTgwIDE4MCAxNjYuNTY5IDE4MCAxNTBDMTgwIDEzMy40MzEgMTY2LjU2OSAxMjAgMTUwIDEyMEMxMzMuNDMxIDEyMCAxMjAgMTMzLjQzMSAxMjAgMTUwQzEyMCAxNjYuNTY5IDEzMy40MzEgMTgwIDE1MCAxODBaIiBmaWxsPSIjOUI5QkEwIi8+CjxwYXRoIGQ9Ik0xNTAgMjAwQzE2Ni41NjkgMjAwIDE4MCAxODYuNTY5IDE4MCAxNzBDMTgwIDE1My40MzEgMTY2LjU2OSAxNDAgMTUwIDE0MEMxMzMuNDMxIDE0MCAxMjAgMTUzLjQzMSAxMjAgMTcwQzEyMCAxODYuNTY5IDEzMy40MzEgMjAwIDE1MCAyMDBaIiBmaWxsPSIjOUI5QkEwIi8+Cjx0ZXh0IHg9IjE1MCIgeT0iMjUwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNjc3NDhCIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4K';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="card group hover:shadow-medium transition-shadow duration-200">
      <div className="relative aspect-square mb-4 overflow-hidden rounded-lg">
        <img
          src={ootd.imageUrl}
          alt={ootd.caption}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          onError={handleImageError}
          loading="lazy"
        />
        
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200" />
        
        <div className="absolute top-3 right-3 flex space-x-2">
          {onShopSimilar && (
            <button
              onClick={() => onShopSimilar(ootd)}
              className="p-2 bg-white/80 text-gray-600 hover:bg-white hover:text-blue-600 rounded-full transition-all duration-200"
              title="Shop Similar"
            >
              <ShoppingBag size={18} />
            </button>
          )}
          
          {onDelete && (
            <button
              onClick={() => onDelete(ootd._id)}
              className="p-2 bg-white/80 text-gray-600 hover:bg-white hover:text-red-600 rounded-full transition-all duration-200"
              title="Delete"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>
      
      <div className="space-y-3">
        <p className="text-gray-900 font-medium leading-relaxed">
          {ootd.caption}
        </p>
        
        {ootd.createdAt && (
          <p className="text-sm text-gray-500">
            {formatDate(ootd.createdAt)}
          </p>
        )}
        
        {(ootd.colors && ootd.colors.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {ootd.colors.map((color, index) => (
              <span
                key={index}
                className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full"
              >
                {color}
              </span>
            ))}
          </div>
        )}
        
        {(ootd.styleTags && ootd.styleTags.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {ootd.styleTags.map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OotdCard;
