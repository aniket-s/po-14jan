# Garment Supply Chain Platform - Frontend

A comprehensive Next.js-based frontend application for managing the complete garment supply chain lifecycle, from purchase orders to shipment tracking.

## 🚀 Tech Stack

- **Framework:** Next.js 16 (App Router)
- **UI Library:** React 19
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4
- **Component Library:** shadcn/ui (New York style)
- **Form Management:** React Hook Form + Zod validation
- **HTTP Client:** Axios with interceptors
- **Real-Time:** Laravel Echo + Pusher.js (Laravel Reverb)
- **State Management:** React Context API
- **Icons:** Lucide React

## ✨ Features

### Core Modules
- **Purchase Orders** - Complete PO lifecycle management
- **Samples** - Sample approval workflow
- **Quality Control** - Inspection and defect tracking
- **Shipments** - End-to-end shipment management
- **Factories** - Factory information and assignments
- **Buyers & Brands** - Client relationship management
- **Suppliers** - Supplier/vendor management
- **Users & Roles** - RBAC with 76+ permissions

### Advanced Features
- **Real-Time Notifications** - WebSocket-powered instant updates via Laravel Reverb
- **Activity Logs** - Complete audit trail
- **Dashboard Analytics** - Statistics and insights
- **Permission-Based Access** - Granular role-based controls
- **Dark Mode** - Full theme support
- **Responsive Design** - Mobile-friendly interface
- **Browser Notifications** - Native notification support

## 📋 Prerequisites

- Node.js 18.x or later
- npm or yarn package manager
- Running Laravel backend (with Reverb configured)
- Modern browser with WebSocket support

## 🛠️ Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd po-claude/frontend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_APP_NAME=Garment Supply Chain Platform

# Laravel Reverb Configuration (WebSocket)
NEXT_PUBLIC_REVERB_APP_KEY=your-reverb-app-key
NEXT_PUBLIC_REVERB_HOST=localhost
NEXT_PUBLIC_REVERB_PORT=8080
NEXT_PUBLIC_REVERB_SCHEME=http
```

**Important:** Make sure these values match your Laravel backend configuration:
- `REVERB_APP_KEY` should match Laravel's `config/reverb.php`
- For production, use `https` scheme and update host/port

### 4. Start the development server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## 🏗️ Project Structure

```
frontend/
├── src/
│   ├── app/                          # Next.js App Router pages
│   │   ├── (auth)/                   # Auth pages (login, register, etc.)
│   │   ├── admin/                    # Admin-only pages
│   │   │   ├── users/
│   │   │   ├── roles/
│   │   │   ├── permissions/
│   │   │   ├── activity-logs/
│   │   │   └── system-settings/
│   │   ├── purchase-orders/          # PO management
│   │   ├── samples/                  # Sample workflow
│   │   ├── quality-control/          # QC inspections
│   │   ├── shipments/                # Shipment tracking
│   │   ├── factories/                # Factory management
│   │   ├── factory-assignments/      # Factory-PO assignments
│   │   ├── buyers/                   # Buyer management
│   │   ├── brands/                   # Brand management
│   │   ├── suppliers/                # Supplier management
│   │   ├── styles/                   # Style catalog
│   │   ├── notifications/            # Notification center
│   │   ├── profile/                  # User profile
│   │   ├── settings/                 # User settings
│   │   └── dashboard/                # Main dashboard
│   ├── components/                   # React components
│   │   ├── ui/                       # shadcn/ui components
│   │   ├── layout/                   # Layout components
│   │   │   ├── DashboardLayout.tsx
│   │   │   ├── Header.tsx
│   │   │   └── Sidebar.tsx
│   │   └── ProtectedRoute.tsx        # Auth guard
│   ├── contexts/                     # React contexts
│   │   ├── AuthContext.tsx           # Authentication state
│   │   └── NotificationsContext.tsx  # Real-time notifications
│   ├── lib/                          # Utilities and configs
│   │   ├── api.ts                    # Axios instance
│   │   ├── echo.ts                   # Laravel Echo config
│   │   └── utils.ts                  # Helper functions
│   └── types/                        # TypeScript types
├── public/                           # Static assets
├── .env.example                      # Environment template
├── .env.local                        # Local environment (gitignored)
├── tailwind.config.ts                # Tailwind configuration
├── tsconfig.json                     # TypeScript configuration
└── package.json                      # Dependencies
```

## 🔔 Real-Time Notifications

The platform uses **Laravel Reverb** for WebSocket-based real-time updates.

### How It Works

1. **Authentication:** WebSocket connection authenticates using Bearer token
2. **Private Channels:** Each user has private channels for notifications
3. **Event Broadcasting:** Backend broadcasts events to specific channels
4. **Client Updates:** Frontend receives events and updates UI in real-time

### Supported Event Types

- **Purchase Order Updates** - Status changes, modifications
- **Sample Status Changes** - Approval workflow updates
- **Quality Inspection Results** - QC completion notifications
- **Shipment Tracking** - Status updates, delivery notifications

### Channel Structure

```javascript
// User-specific notifications
App.Models.User.{userId}

// Feature-specific channels
purchase-orders.{userId}
samples.{userId}
quality-inspections.{userId}
shipments.{userId}
```

### Browser Notifications

The app requests permission for native browser notifications. When granted, users receive desktop notifications even when the app is in the background.

## 🔐 Authentication & Authorization

### Authentication Flow

1. User logs in with email/password
2. Backend returns Sanctum token
3. Token stored in localStorage
4. Token sent with every API request via Authorization header
5. Token also used for WebSocket authentication

### Permission System

The platform uses a granular permission system with 76+ permissions across modules:

- `purchase_orders.view`
- `purchase_orders.create`
- `purchase_orders.update`
- `purchase_orders.delete`
- `samples.approve`
- `quality_control.inspect`
- And many more...

### Protected Routes

All dashboard routes are protected using the `ProtectedRoute` component:

```typescript
<DashboardLayout
  requiredPermission="purchase_orders.view"
  // or
  requiredPermissions={['purchase_orders.view', 'purchase_orders.create']}
  requireAll={false}
  // or
  requiredRole="admin"
>
  {/* Page content */}
</DashboardLayout>
```

## 📦 Available Scripts

```bash
# Development
npm run dev              # Start dev server on http://localhost:3000
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
npm run type-check       # Run TypeScript compiler check

# shadcn/ui component management
npx shadcn@latest add <component-name>
```

## 🎨 UI Component Library

The project uses **shadcn/ui** - a collection of re-usable components built with Radix UI and Tailwind CSS.

### Adding New Components

```bash
npx shadcn@latest add button
npx shadcn@latest add dialog
npx shadcn@latest add table
```

Components are added to `src/components/ui/` and can be customized.

### Pre-installed Components

- Button, Input, Textarea, Select
- Dialog, Alert Dialog, Sheet
- Card, Badge, Avatar
- Table, Dropdown Menu
- Tabs, Separator
- Form components (Label, Checkbox, Radio)
- And more...

## 🔧 Development Guidelines

### Code Style

- Use TypeScript for all new files
- Follow React best practices (hooks, functional components)
- Use Tailwind classes for styling (avoid inline styles)
- Implement proper error handling
- Add loading states for async operations

### Form Validation

Use React Hook Form + Zod for all forms:

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
});

const form = useForm({
  resolver: zodResolver(schema),
});
```

### API Calls

Use the pre-configured Axios instance:

```typescript
import api from '@/lib/api';

// Automatically includes auth token and CSRF protection
const response = await api.get('/purchase-orders');
const data = await api.post('/purchase-orders', formData);
```

### Context Usage

For global state, use React Context:

```typescript
const { user, hasPermission } = useAuth();
const { notifications, unreadCount, markAsRead } = useNotifications();
```

## 🚀 Deployment

### Building for Production

```bash
npm run build
```

This creates an optimized production build in the `.next` folder.

### Environment Variables for Production

Update `.env.local` (or use platform-specific env config):

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
NEXT_PUBLIC_REVERB_APP_KEY=your-production-key
NEXT_PUBLIC_REVERB_HOST=reverb.yourdomain.com
NEXT_PUBLIC_REVERB_PORT=443
NEXT_PUBLIC_REVERB_SCHEME=https
```

### Deployment Platforms

This Next.js app can be deployed to:

- **Vercel** (recommended) - Zero-config deployment
- **Netlify** - Supports Next.js
- **AWS Amplify** - Full AWS integration
- **Docker** - Containerized deployment
- **Traditional VPS** - Using PM2 or systemd

### Vercel Deployment

```bash
npm install -g vercel
vercel
```

Follow the prompts and add environment variables in Vercel dashboard.

## 🔒 Security Considerations

### CSRF Protection

The app automatically handles CSRF tokens for state-changing requests via Axios interceptors.

### XSS Prevention

- All user input is sanitized
- React automatically escapes rendered content
- Use `dangerouslySetInnerHTML` only when necessary and with sanitized HTML

### Authentication

- Tokens stored in localStorage (httpOnly cookies preferred for production)
- Tokens expire and require re-login
- Logout clears all local storage

### Environment Variables

- Never commit `.env.local` to version control
- Use platform-specific secret management for production
- Rotate API keys regularly

## 📱 Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

**Note:** WebSocket support required for real-time features.

## 🐛 Troubleshooting

### WebSocket Connection Issues

**Problem:** Notifications not working

**Solutions:**
1. Verify Laravel Reverb is running: `php artisan reverb:start`
2. Check `REVERB_APP_KEY` matches between frontend and backend
3. Ensure WebSocket port (8080) is not blocked by firewall
4. Check browser console for WebSocket errors

### API Connection Issues

**Problem:** "Network Error" or CORS errors

**Solutions:**
1. Verify backend is running at `NEXT_PUBLIC_API_URL`
2. Check CORS configuration in Laravel backend
3. Ensure API routes are properly defined
4. Verify auth token is valid

### Build Errors

**Problem:** TypeScript or build errors

**Solutions:**
1. Delete `.next` folder and `node_modules`
2. Run `npm install` again
3. Check for TypeScript errors: `npm run type-check`
4. Ensure all dependencies are installed

## 📄 License

This project is proprietary software. All rights reserved.

## 🤝 Support

For issues, questions, or contributions, please contact the development team.

---

**Version:** 1.0.0
**Last Updated:** 2025-11-21
**Node Version:** 18.x+
**Next.js Version:** 16.0.0
