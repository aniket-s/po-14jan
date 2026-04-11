'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, CheckCircle, Link2, AlertTriangle } from 'lucide-react';
import { Style } from '@/services/styles';

interface StyleKPICardsProps {
  styles: Style[];
  total: number;
  activeFilter: string | null;
  onFilterClick: (filter: string) => void;
}

export function StyleKPICards({ styles, total, activeFilter, onFilterClick }: StyleKPICardsProps) {
  const cards = useMemo(() => {
    const activeCount = styles.filter(s => s.is_active !== false).length;
    const inactiveCount = styles.filter(s => s.is_active === false).length;
    const usedInPOs = styles.filter(s => s.purchase_orders && s.purchase_orders.length > 0).length;
    const notInPOs = styles.filter(s => !s.purchase_orders || s.purchase_orders.length === 0).length;

    return [
      {
        key: 'all',
        title: 'Total Styles',
        value: total.toString(),
        subtitle: `${styles.length} on this page`,
        icon: <Package className="h-4 w-4" />,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50 dark:bg-blue-950',
      },
      {
        key: 'active',
        title: 'Active',
        value: activeCount.toString(),
        subtitle: inactiveCount > 0 ? `${inactiveCount} inactive` : 'all active',
        icon: <CheckCircle className="h-4 w-4" />,
        color: 'text-green-600',
        bgColor: 'bg-green-50 dark:bg-green-950',
      },
      {
        key: 'used_in_pos',
        title: 'Used in POs',
        value: usedInPOs.toString(),
        subtitle: 'linked to purchase orders',
        icon: <Link2 className="h-4 w-4" />,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50 dark:bg-purple-950',
      },
      {
        key: 'not_in_pos',
        title: 'Unassigned',
        value: notInPOs.toString(),
        subtitle: 'not yet in any PO',
        icon: <AlertTriangle className="h-4 w-4" />,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50 dark:bg-amber-950',
      },
    ];
  }, [styles, total]);

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
