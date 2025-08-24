export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
}

export interface Product {
  _id?: string;
  title: string;
  price?: string;
  link?: string;
  source?: string;
  thumbnail?: string;
  rating?: number;
  reviews?: number;
  availability?: string;
  shipping?: string;
}

export interface WishlistItem {
  _id: string;
  title: string;
  price?: string;
  link?: string;
  image?: string;
  source?: string;
  createdAt?: string;
}

export interface Ootd {
  _id: string;
  caption: string;
  imageUrl: string;
  colors?: string[];
  styleTags?: string[];
  createdAt?: string;
}

export interface ComparisonData {
  companies: string[];
  companyGroups: Record<string, Product[]>;
  priceStats: {
    min: number;
    max: number;
    avg: number;
    total: number;
    count: number;
  } | null;
  bestDeals: Array<{
    company: string;
    product: Product;
    price: number;
  }>;
  totalProducts: number;
  priceRange: {
    lowest: number;
    highest: number;
    difference: number;
  } | null;
}

export interface SearchResponse {
  query: string;
  products: Product[];
  comparison: ComparisonData;
  filters?: {
    minPrice?: number;
    maxPrice?: number;
    colors?: string[];
    sizes?: string[];
    brands?: string[];
  };
  sort?: {
    sortBy?: string;
    sortOrder?: string;
  };
}

export interface TrendingResponse {
  platform?: string;
  items: Product[];
}

export interface ConfigResponse {
  googleClientId: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}



export interface SearchFilters {
  minPrice?: number;
  maxPrice?: number;
  colors?: string[];
  sizes?: string[];
  brands?: string[];
}

export interface SortOptions {
  sortBy?: 'price' | 'date';
  sortOrder?: 'asc' | 'desc';
}
