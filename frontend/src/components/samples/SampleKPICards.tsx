'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  PackageCheck,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Send,
} from 'lucide-react';
import { Sample } from './types';

interface SampleKPICardsProps {
  samples: Sample[];
  role: 'factory' | 'agency' | 'importer' | 'other';
  activeFilter: string | null;
  onFilterClick: (filter: string) => void;
}

interface KPICard {
  key: string;
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

export function SampleKPICards({ samples, role, activeFilter, onFilterClick }: SampleKPICardsProps) {
  const getFactoryCards = (): KPICard[] => [
    {
      key: 'all',
      title: 'Total Submitted',
      value: samples.length,
      icon: <PackageCheck className="h-4 w-4" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950',
    },
    {
      key: 'pending',
      title: 'Awaiting Review',
      value: samples.filter(s => s.final_status === 'pending').length,
      icon: <Clock className="h-4 w-4" />,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-950',
    },
    {
      key: 'rejected',
      title: 'Needs Resubmit',
      value: samples.filter(s => s.final_status === 'rejected').length,
      icon: <AlertTriangle className="h-4 w-4" />,
      color: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-950',
    },
    {
      key: 'approved',
      title: 'Approved',
      value: samples.filter(s => s.final_status === 'approved').length,
      icon: <CheckCircle className="h-4 w-4" />,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950',
    },
  ];

  const getAgencyCards = (): KPICard[] => [
    {
      key: 'needs_agency_review',
      title: 'Needs My Review',
      value: samples.filter(s => s.agency_status === 'pending').length,
      icon: <AlertTriangle className="h-4 w-4" />,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-950',
    },
    {
      key: 'agency_approved',
      title: 'Approved by Me',
      value: samples.filter(s => s.agency_status === 'approved').length,
      icon: <CheckCircle className="h-4 w-4" />,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950',
    },
    {
      key: 'agency_rejected',
      title: 'Rejected by Me',
      value: samples.filter(s => s.agency_status === 'rejected').length,
      icon: <XCircle className="h-4 w-4" />,
      color: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-950',
    },
    {
      key: 'passed_to_importer',
      title: 'Passed to Importer',
      value: samples.filter(s => s.agency_status === 'approved' && s.importer_status === 'pending').length,
      icon: <ArrowRight className="h-4 w-4" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950',
    },
  ];

  const getImporterCards = (): KPICard[] => [
    {
      key: 'needs_importer_review',
      title: 'Needs My Review',
      value: samples.filter(s => s.agency_status === 'approved' && s.importer_status === 'pending').length,
      icon: <AlertTriangle className="h-4 w-4" />,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-950',
    },
    {
      key: 'approved',
      title: 'Fully Approved',
      value: samples.filter(s => s.final_status === 'approved').length,
      icon: <CheckCircle className="h-4 w-4" />,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950',
    },
    {
      key: 'rejected',
      title: 'Rejected',
      value: samples.filter(s => s.final_status === 'rejected').length,
      icon: <XCircle className="h-4 w-4" />,
      color: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-950',
    },
    {
      key: 'completion',
      title: 'Completion Rate',
      value: samples.length > 0
        ? Math.round((samples.filter(s => s.final_status === 'approved').length / samples.length) * 100)
        : 0,
      icon: <Send className="h-4 w-4" />,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-950',
    },
  ];

  const getDefaultCards = (): KPICard[] => [
    {
      key: 'all',
      title: 'Total Samples',
      value: samples.length,
      icon: <PackageCheck className="h-4 w-4" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950',
    },
    {
      key: 'approved',
      title: 'Approved',
      value: samples.filter(s => s.final_status === 'approved').length,
      icon: <CheckCircle className="h-4 w-4" />,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950',
    },
    {
      key: 'pending',
      title: 'Pending',
      value: samples.filter(s => s.final_status === 'pending').length,
      icon: <Clock className="h-4 w-4" />,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-950',
    },
    {
      key: 'rejected',
      title: 'Rejected',
      value: samples.filter(s => s.final_status === 'rejected').length,
      icon: <XCircle className="h-4 w-4" />,
      color: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-950',
    },
  ];

  const cards = role === 'factory'
    ? getFactoryCards()
    : role === 'agency'
      ? getAgencyCards()
      : role === 'importer'
        ? getImporterCards()
        : getDefaultCards();

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
              <div className="text-2xl font-bold">
                {card.key === 'completion' ? `${card.value}%` : card.value}
              </div>
              {isActive && (
                <p className="text-xs text-primary mt-1 font-medium">
                  Filtering active
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
