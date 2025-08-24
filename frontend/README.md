# Fashion Search Frontend

A modern, Gumroad-style React frontend for the Fashion Search application. Built with TypeScript, Tailwind CSS, and React Router.

## Features

- **Modern UI**: Clean, minimal design inspired by Gumroad
- **Authentication**: Email/password and Google Sign-In support
- **Search**: Text, image upload, and image URL search capabilities
- **Product Discovery**: Trending products and personalized recommendations
- **Wishlist**: Save and manage favorite products
- **OOTD**: Share outfit photos and find similar items
- **Responsive**: Mobile-first design that works on all devices

## Tech Stack

- **React 18** with TypeScript
- **React Router** for navigation
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **Context API** for state management

## Getting Started

### Prerequisites

- Node.js 16+ and npm
- Backend server running (see backend documentation)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables (optional):
```bash
# Create .env file in the frontend directory
REACT_APP_API_BASE=http://localhost:5000
```

3. Start the development server:
```bash
npm start
```

The app will be available at `http://localhost:3000`.

### Building for Production

```bash
npm run build
```

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Header.tsx      # Navigation header
│   ├── ProductCard.tsx # Product display card
│   ├── OotdCard.tsx    # OOTD display card
│   └── Toast.tsx       # Notification component
├── contexts/           # React contexts
│   └── AuthContext.tsx # Authentication state
├── pages/              # Page components
│   ├── Login.tsx       # Authentication page
│   ├── Home.tsx        # Main search page
│   ├── Result.tsx      # Search results page
│   └── Ootd.tsx        # OOTD management page
├── types/              # TypeScript type definitions
│   ├── index.ts        # Main type definitions
│   └── global.d.ts     # Global type extensions
├── utils/              # Utility functions
│   └── api.ts          # API client and auth helpers
└── App.tsx             # Main application component
```

## API Integration

The frontend communicates with the backend through the following endpoints:

### Authentication
- `POST /auth/login` - Email/password login
- `POST /auth/signup` - User registration
- `POST /auth/google` - Google Sign-In
- `POST /auth/logout` - User logout
- `GET /config` - Get configuration (Google Client ID)

### Search & Products
- `POST /search` - Search products (supports multipart for images)
- `GET /trending` - Get trending products

### User Data
- `GET /wishlist` - Get user's wishlist
- `POST /wishlist` - Add item to wishlist
- `DELETE /wishlist/:id` - Remove item from wishlist
- `GET /ootd` - Get user's OOTD posts
- `POST /ootd` - Create OOTD post
- `DELETE /ootd/:id` - Delete OOTD post

## Authentication Flow

1. **Login/Signup**: Users can authenticate via email/password or Google Sign-In
2. **Token Management**: JWT tokens are stored in localStorage and sent with API requests
3. **Protected Routes**: All main pages require authentication
4. **Auto-redirect**: Unauthenticated users are redirected to login

## Search Features

### Text Search
- Natural language product descriptions
- AI-powered query optimization

### Image Search
- Upload local images
- Provide image URLs
- AI-powered image analysis

### Platform Support
- Google Shopping (default)
- Myntra
- Amazon
- Flipkart

## Styling

The app uses Tailwind CSS with a custom design system inspired by Gumroad:

- **Colors**: Neutral grays with accent colors
- **Typography**: Inter font family
- **Spacing**: Consistent 6px grid system
- **Components**: Rounded corners, subtle shadows, smooth transitions

### Custom Classes

- `.btn-primary` - Primary action buttons
- `.btn-secondary` - Secondary action buttons
- `.card` - Content containers
- `.input-field` - Form inputs

## Development

### Code Style

- TypeScript for type safety
- Functional components with hooks
- Consistent naming conventions
- Proper error handling

### State Management

- React Context for global state (auth)
- Local state for component-specific data
- SessionStorage for temporary data (search results)

### Error Handling

- Toast notifications for user feedback
- Graceful fallbacks for failed API calls
- Loading states for better UX

## Deployment

The app can be deployed to any static hosting service:

1. Build the production bundle: `npm run build`
2. Deploy the `build/` directory
3. Configure environment variables for production API endpoints

## Contributing

1. Follow the existing code style
2. Add TypeScript types for new features
3. Test thoroughly before submitting
4. Update documentation as needed

## License

This project is part of the Fashion Search application.
