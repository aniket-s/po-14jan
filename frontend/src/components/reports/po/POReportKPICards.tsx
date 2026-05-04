'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, DollarSign, Calendar, AlertTriangle, CheckCircle } from 'lucide-react';
import type { POReportSummary } from './types';

interface Props {
  summary: POReportSummary | null;
  activeFilter: string;
  onFilterClick: (key: string) => void;
}

interface KPICard {
  key: string;
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  alert?: boolean;
}

const formatNumber = (n: number) => new Intl.NumberFormat('en-US').format(n);
const formatCompact = (n: number) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

export function POReportKPICards({ summary, activeFilter, onFilterClick }: Props) {
  const total = summary?.total_orders ?? 0;
  const totalValue = summary?.total_value ?? 0;
  const totalQty = summary?.total_quantity ?? 0;
  const byStatus = summary?.by_status ?? {};
  const active = (byStatus.active ?? 0) + (byStatus.in_progress ?? 0);
  const completed = byStatus.completed ?? 0;
  const overdue = summary?.overdue_etd ?? 0;
  const upcoming = summary?.upcoming_etd ?? 0;

  const cards: KPICard[] = [
    {
      key: 'all',
      title: 'Total Orders',
      value: formatNumber(total),
      subtitle: `${formatNumber(totalQty)} units`,
      icon: <Package className="h-4 w-4" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950',
    },
    {
      key: 'value',
      title: 'Total Value',
      value: formatCompact(totalValue),
      subtitle: 'across filtered POs',
      icon: <DollarSign className="h-4 w-4" />,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950',
    },
    {
      key: 'active',
      title: 'Active',
      value: formatNumber(active),
      subtitle: `${formatNumber(completed)} completed`,
      icon: <CheckCircle className="h-4 w-4" />,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950',
    },
    {
      key: 'upcoming_etd',
      title: 'Upcoming ETD',
      value: formatNumber(upcoming),
      subtitle: 'next 30 days',
      icon: <Calendar className="h-4 w-4" />,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-950',
    },
    {
      key: 'etd_overdue',
      title: 'Overdue ETD',
      value: formatNumber(overdue),
      subtitle: 'past due, still open',
      icon: <AlertTriangle className="h-4 w-4" />,
      color: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-950',
      alert: overdue > 0,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => {
        const isActive = activeFilter === card.key;
        return (
          <Card
            key={card.key}
            className={`cursor-pointer transition-all hover:shadow-md ${
              isActive ? 'ring-2 ring-primary shadow-md' : ''
            } ${card.alert ? 'border-red-200 dark:border-red-900' : ''}`}
            onClick={() => onFilterClick(isActive ? '' : card.key)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <div className={`rounded-md p-1.5 ${card.bgColor}`}>
                <span className={card.color}>{card.icon}</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className={`text-xs mt-1 ${card.alert ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                {card.subtitle}
              </p>
              {isActive && <p className="text-xs text-primary mt-1 font-medium">Filtering active</p>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
