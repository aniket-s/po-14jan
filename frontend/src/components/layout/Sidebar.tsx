'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Factory,
  ClipboardCheck,
  Truck,
  BarChart3,
  Users,
  Settings,
  FileText,
  Mail,
  UserCheck,
  PackageCheck,
  LucideIcon,
  Shield,
  Layers,
  Workflow,
  Key,
  Activity,
  ChevronDown,
  ChevronRight,
  Cog,
  Database,
  Store,
  Warehouse,
  Palette,
  FolderOpen,
  Building2,
  Ship,
} from 'lucide-react';
import { useState } from 'react';

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
  permissions?: string[];
  requireAny?: boolean;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Purchase Orders',
    href: '/purchase-orders',
    icon: ShoppingCart,
    permissions: ['po.view', 'po.view_all', 'po.create'],
    requireAny: true,
  },
  {
    title: 'Styles',
    href: '/styles',
    icon: Package,
    permissions: ['style.view', 'style.create'],
    requireAny: true,
  },
  {
    title: 'Master Data',
    href: '/master-data',
    icon: Database,
    children: [
      {
        title: 'Brands',
        href: '/master-data/brands',
        icon: Package,
      },
      {
        title: 'Seasons',
        href: '/master-data/seasons',
        icon: Package,
      },
      {
        title: 'Genders',
        href: '/master-data/genders',
        icon: Users,
      },
      {
        title: 'Sizes',
        href: '/master-data/sizes',
        icon: Package,
      },
      {
        title: 'Retailers',
        href: '/master-data/retailers',
        icon: Store,
      },
      {
        title: 'Agents',
        href: '/master-data/agents',
        icon: Users,
      },
      {
        title: 'Vendors',
        href: '/master-data/vendors',
        icon: Factory,
      },
      {
        title: 'Countries',
        href: '/master-data/countries',
        icon: Warehouse,
      },
      {
        title: 'Warehouses',
        href: '/master-data/warehouses',
        icon: Warehouse,
      },
      {
        title: 'Trims & Accessories',
        href: '/master-data/trims',
        icon: Package,
      },
      {
        title: 'Prepack Codes',
        href: '/master-data/prepack-codes',
        icon: Package,
      },
      {
        title: 'Colors',
        href: '/master-data/colors',
        icon: Palette,
      },
      {
        title: 'Buyers',
        href: '/master-data/buyers',
        icon: Building2,
      },
      {
        title: 'Categories',
        href: '/master-data/categories',
        icon: FolderOpen,
      },
    ],
  },
  {
    title: 'Invitations',
    href: '/invitations',
    icon: Mail,
    permissions: ['invitation.send', 'invitation.view_all'],
    requireAny: true,
  },
  {
    title: 'Factory Assignments',
    href: '/factory-assignments',
    icon: Factory,
    permissions: ['po.assign_factory', 'style.assign_factory'],
    requireAny: true,
  },
  {
    title: 'Samples',
    href: '/samples',
    icon: PackageCheck,
    permissions: ['sample.view', 'sample.submit', 'sample.approve_final', 'sample.approve_agency'],
    requireAny: true,
  },
  {
    title: 'Production',
    href: '/production',
    icon: UserCheck,
    permissions: ['production.view', 'production.view_all', 'production.submit'],
    requireAny: true,
  },
  {
    title: 'Quality Inspections',
    href: '/quality-inspections',
    icon: ClipboardCheck,
    permissions: ['quality_inspection.view', 'quality.view_all_inspections', 'quality_inspection.create'],
    requireAny: true,
  },
  {
    title: 'Shipments',
    href: '/shipments',
    icon: Truck,
    permissions: ['shipment.view', 'shipment.view_all', 'shipment.track'],
    requireAny: true,
  },
  {
    title: 'Ship Options',
    href: '/ship-options',
    icon: Ship,
    permissions: ['shipment.view', 'shipment.view_all', 'shipment.create', 'po.view'],
    requireAny: true,
  },
  {
    title: 'Reports',
    href: '/reports',
    icon: BarChart3,
    permissions: ['reports.view'],
  },
  {
    title: 'Admin',
    href: '/admin',
    icon: Settings,
    permissions: ['admin.users.view', 'admin.roles.view', 'admin.permissions.view', 'admin.sample_types.view', 'admin.production_stages.view', 'admin.activity_logs.view', 'admin.email_templates.view', 'admin.settings.view', 'admin.statuses.view'],
    requireAny: true,
    children: [
      {
        title: 'Users',
        href: '/admin/users',
        icon: Users,
        permissions: ['admin.users.view'],
      },
      {
        title: 'Roles',
        href: '/admin/roles',
        icon: Shield,
        permissions: ['admin.roles.view'],
      },
      {
        title: 'Permissions',
        href: '/admin/permissions',
        icon: Key,
        permissions: ['admin.permissions.view'],
      },
      {
        title: 'Sample Types',
        href: '/admin/sample-types',
        icon: Layers,
        permissions: ['admin.sample_types.view'],
      },
      {
        title: 'Production Stages',
        href: '/admin/production-stages',
        icon: Workflow,
        permissions: ['admin.production_stages.view'],
      },
      {
        title: 'Email Templates',
        href: '/admin/email-templates',
        icon: Mail,
        permissions: ['admin.email_templates.view', 'admin.settings.view'],
        requireAny: true,
      },
      {
        title: 'System Settings',
        href: '/admin/system-settings',
        icon: Cog,
        permissions: ['admin.settings.view', 'admin.settings.edit'],
        requireAny: true,
      },
      {
        title: 'Status Management',
        href: '/admin/statuses',
        icon: Workflow,
        permissions: ['admin.statuses.view', 'admin.statuses.manage'],
        requireAny: true,
      },
      {
        title: 'Activity Logs',
        href: '/admin/activity-logs',
        icon: Activity,
        permissions: ['admin.activity_logs.view'],
      },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, can, canAny } = useAuth();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const hasPermission = (item: NavItem): boolean => {
    if (!item.permission && !item.permissions) return true;

    if (item.permission) {
      return can(item.permission);
    }

    if (item.permissions) {
      return item.requireAny
        ? canAny(item.permissions)
        : item.permissions.every(perm => can(perm));
    }

    return false;
  };

  const filteredNavItems = navItems.map((item) => {
    if (item.children) {
      const filteredChildren = item.children.filter(hasPermission);
      if (filteredChildren.length === 0) return null;
      return { ...item, children: filteredChildren };
    }
    return hasPermission(item) ? item : null;
  }).filter(Boolean) as NavItem[];

  const toggleExpand = (href: string) => {
    setExpandedItems((prev) =>
      prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href]
    );
  };

  // Auto-expand sections if on their pages
  useState(() => {
    if (pathname.startsWith('/admin')) {
      setExpandedItems(['/admin']);
    } else if (pathname.startsWith('/master-data')) {
      setExpandedItems(['/master-data']);
    }
  });

  const NavItemComponent = ({ item, isChild = false }: { item: NavItem; isChild?: boolean }) => {
    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
    const isExpanded = expandedItems.includes(item.href);
    const Icon = item.icon;
    const hasChildren = item.children && item.children.length > 0;

    if (hasChildren) {
      return (
        <div key={item.href}>
          <button
            onClick={() => toggleExpand(item.href)}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="flex-1 text-left">{item.title}</span>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          {isExpanded && (
            <div className="ml-4 mt-1 space-y-1 border-l pl-2">
              {item.children?.map((child) => (
                <NavItemComponent key={child.href} item={child} isChild />
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          isChild && 'text-xs'
        )}
      >
        <Icon className={cn('h-5 w-5', isChild && 'h-4 w-4')} />
        <span>{item.title}</span>
      </Link>
    );
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card transition-transform">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center border-b px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Package className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold">Supply Chain</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {filteredNavItems.map((item) => (
            <NavItemComponent key={item.href} item={item} />
          ))}
        </nav>

        {/* User Info */}
        <div className="border-t p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Users className="h-5 w-5" />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium">{user?.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
