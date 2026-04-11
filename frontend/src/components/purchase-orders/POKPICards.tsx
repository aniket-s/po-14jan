'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Package,
  DollarSign,
  Calendar,
  Layers,
  TrendingUp,
} from 'lucide-react';
import { PurchaseOrder } from '@/types';

interface POKPICardsProps {
  purchaseOrders: PurchaseOrder[];
  totalFromServer?: number;
  activeFilter: string | null;
  onFilterClick: (filter: string) => void;
}

interface KPICard {
  key: string;
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

export function POKPICards({ purchaseOrders, totalFromServer, activeFilter, onFilterClick }: POKPICardsProps) {
  const cards = useMemo((): KPICard[] => {
    const total = totalFromServer || purchaseOrders.length;
    const totalValue = purchaseOrders.reduce((sum, po) => sum + (po.total_value || 0), 0);
    const totalStyles = purchaseOrders.reduce((sum, po) => sum + (po.styles_count || 0), 0);
    const totalQty = purchaseOrders.reduce((sum, po) => sum + (po.total_quantity || 0), 0);

    // ETD within next 30 days
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const upcomingETD = purchaseOrders.filter(po => {
      if (!po.etd_date) return false;
      const etd = new Date(po.etd_date);
      return etd >= now && etd <= thirtyDaysFromNow;
    }).length;

    // Determine primary currency for display
    const currencyCounts: Record<string, number> = {};
    purchaseOrders.forEach(po => {
      const c = po.currency || 'USD';
      currencyCounts[c] = (currencyCounts[c] || 0) + 1;
    });
    const primaryCurrency = Object.entries(currencyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'USD';

    const formatValue = (val: number) => {
      if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
      if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
      return val.toLocaleString();
    };

    return [
      {
        key: 'all',
        title: 'Total Orders',
        value: total.toString(),
        subtitle: `${totalQty.toLocaleString()} total units`,
        icon: <Package className="h-4 w-4" />,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50 dark:bg-blue-950',
      },
      {
        key: 'value',
        title: 'Total Value',
        value: `${formatValue(totalValue)}`,
        subtitle: `${Object.keys(currencyCounts).length > 1 ? `${Object.keys(currencyCounts).length} currencies` : primaryCurrency}`,
        icon: <DollarSign className="h-4 w-4" />,
        color: 'text-green-600',
        bgColor: 'bg-green-50 dark:bg-green-950',
      },
      {
        key: 'upcoming_etd',
        title: 'Upcoming ETD',
        value: upcomingETD.toString(),
        subtitle: 'next 30 days',
        icon: <Calendar className="h-4 w-4" />,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50 dark:bg-amber-950',
      },
      {
        key: 'styles',
        title: 'Total Styles',
        value: totalStyles.toString(),
        subtitle: 'across all POs',
        icon: <Layers className="h-4 w-4" />,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50 dark:bg-purple-950',
      },
    ];
  }, [purchaseOrders, totalFromServer]);

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {cards.map((card) => {
        const isActive = activeFilter === card.key;
        return (
          <Card
            key={card.key}
            className={`cursor-pointer transition-all hover:shadow-md ${
              isActive ? 'ring-2 ring-primary shadow-md' : ''
            }`}
            onClick={() => onFilterClick(isActive ? '' : card.key)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className={`rounded-md p-1.5 ${card.bgColor}`}>
                <span className={card.color}>{card.icon}</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
              {isActive && (
                <p className="text-xs text-primary mt-1 font-medium">Filtering active</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
