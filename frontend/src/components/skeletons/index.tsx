import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ─── Stat Cards ───────────────────────────────────────────────

export function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-1" />
        <Skeleton className="h-3 w-28" />
      </CardContent>
    </Card>
  );
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  const gridClass =
    count === 3
      ? 'grid gap-4 md:grid-cols-3'
      : count === 2
        ? 'grid gap-4 md:grid-cols-2'
        : count === 1
          ? 'grid gap-4 md:grid-cols-1'
          : 'grid gap-4 md:grid-cols-2 lg:grid-cols-4';

  return (
    <div className={gridClass}>
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ─── Filter / Search Bar ──────────────────────────────────────

export function FilterBarSkeleton({ filters = 1 }: { filters?: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent>
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1" />
          {Array.from({ length: filters }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-[180px]" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Table ────────────────────────────────────────────────────

export function TableSkeleton({
  columns = 5,
  rows = 5,
  hasHeader = true,
}: {
  columns?: number;
  rows?: number;
  hasHeader?: boolean;
}) {
  const colWidths = Array.from({ length: columns }).map((_, i) => {
    if (i === 0) return 'w-24';
    if (i === columns - 1) return 'w-16';
    return 'w-full';
  });

  return (
    <Card>
      {hasHeader && (
        <CardHeader>
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-44" />
        </CardHeader>
      )}
      <CardContent className={hasHeader ? undefined : 'p-0'}>
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: columns }).map((_, i) => (
                <TableHead key={i}>
                  <Skeleton className="h-4 w-20" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }).map((_, rowIdx) => (
              <TableRow key={rowIdx}>
                {Array.from({ length: columns }).map((_, colIdx) => (
                  <TableCell key={colIdx}>
                    <Skeleton
                      className={`h-4 ${colIdx === columns - 1 ? 'w-16 ml-auto' : colIdx === 0 ? 'w-24' : 'w-full max-w-[120px]'}`}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Page Header ──────────────────────────────────────────────

export function PageHeaderSkeleton({ hasActions = true }: { hasActions?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <Skeleton className="h-9 w-48 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>
      {hasActions && (
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-32" />
        </div>
      )}
    </div>
  );
}

// ─── Search Only Bar ──────────────────────────────────────────

export function SearchBarSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-40" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}

// ─── Dashboard Skeleton ───────────────────────────────────────

export function DashboardPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-9 w-48 mb-2" />
        <Skeleton className="h-4 w-80" />
      </div>
      {/* Stats Grid */}
      <StatCardsSkeleton count={4} />
      {/* Secondary Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-6 w-28 mb-1" />
                <Skeleton className="h-4 w-40" />
              </div>
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-12" />
              </div>
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-8 rounded-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-6 w-32 mb-1" />
                <Skeleton className="h-4 w-40" />
              </div>
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-8 w-8 rounded-full mt-0.5" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-28 mb-1" />
                    <Skeleton className="h-3 w-40 mb-1" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-28 mb-1" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Notification List Skeleton ───────────────────────────────

export function NotificationListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-3 rounded-lg border p-4"
        >
          <Skeleton className="h-8 w-8 rounded-full mt-0.5" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-full max-w-md" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      ))}
    </div>
  );
}

// ─── Form Skeleton ────────────────────────────────────────────

export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-60" />
      </CardHeader>
      <CardContent className="space-y-6">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <Skeleton className="h-10 w-24" />
      </CardContent>
    </Card>
  );
}

// ─── Detail Page Skeleton ─────────────────────────────────────

export function DetailPageSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      {/* Info cards row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-6 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Tabs placeholder */}
      <div>
        <div className="flex gap-2 mb-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-md" />
          ))}
        </div>
        <Card>
          <CardContent className="pt-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 flex-1 max-w-sm" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Master Data Page Skeleton (reusable for all 12+ pages) ──

export function MasterDataPageSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <SearchBarSkeleton />
      <TableSkeleton columns={columns} rows={5} />
    </div>
  );
}

// ─── List Page Skeleton (stats + filters + table) ─────────────

export function ListPageSkeleton({
  statCards = 4,
  filterCount = 1,
  columns = 7,
  rows = 5,
}: {
  statCards?: number;
  filterCount?: number;
  columns?: number;
  rows?: number;
}) {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <StatCardsSkeleton count={statCards} />
      <FilterBarSkeleton filters={filterCount} />
      <TableSkeleton columns={columns} rows={rows} hasHeader={false} />
    </div>
  );
}
