'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Package, Edit, Trash2, Link2 } from 'lucide-react';
import { Style } from '@/services/styles';
import { cn } from '@/lib/utils';

interface StyleCardGridProps {
  styles: Style[];
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  selectedStyleId: number | null;
  onSelectStyle: (style: Style) => void;
  onEdit?: (style: Style) => void;
  onDelete?: (style: Style) => void;
  canEdit: boolean;
  canDelete: boolean;
}

export function StyleCardGrid({
  styles,
  selectedIds,
  onToggleSelect,
  selectedStyleId,
  onSelectStyle,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: StyleCardGridProps) {
  if (styles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Package className="h-12 w-12 text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground font-medium">No styles found</p>
        <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters or create a new style</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {styles.map((style) => {
        const isSelected = selectedStyleId === style.id;
        const isChecked = selectedIds.has(style.id);
        const imageUrl = style.images && style.images.length > 0 ? style.images[0] : null;
        const poCount = style.purchase_orders?.length || 0;

        return (
          <div
            key={style.id}
            className={cn(
              'group rounded-lg border bg-card overflow-hidden transition-all hover:shadow-md cursor-pointer',
              isSelected && 'ring-2 ring-primary shadow-md',
            )}
            onClick={() => onSelectStyle(style)}
          >
            {/* Image */}
            <div className="relative h-40 bg-muted">
              {imageUrl ? (
                <img src={imageUrl} alt={style.style_number} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <Package className="h-10 w-10 text-muted-foreground/30" />
                </div>
              )}
              {/* Checkbox overlay */}
              <div className="absolute top-2 left-2" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => onToggleSelect(style.id)}
                  className="bg-white/80 backdrop-blur-sm"
                />
              </div>
              {/* Status badge */}
              {style.is_active === false && (
                <Badge variant="secondary" className="absolute top-2 right-2 text-[10px]">Inactive</Badge>
              )}
            </div>

            {/* Content */}
            <div className="p-3 space-y-2">
              <div>
                <p className="text-sm font-semibold truncate">{style.style_number}</p>
                <p className="text-xs text-muted-foreground truncate">{style.description || 'No description'}</p>
              </div>

              {/* Meta row */}
              <div className="flex items-center gap-2 flex-wrap">
                {style.brand?.name && (
                  <Badge variant="outline" className="text-[10px] px-1.5">{style.brand.name}</Badge>
                )}
                {style.retailer?.name && (
                  <Badge variant="outline" className="text-[10px] px-1.5">{style.retailer.name}</Badge>
                )}
                {style.category?.name && (
                  <Badge variant="secondary" className="text-[10px] px-1.5">{style.category.name}</Badge>
                )}
              </div>

              {/* Color + Fabric */}
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                {(style.color?.name || style.color_name) && (
                  <span className="flex items-center gap-1">
                    {style.color?.code && (
                      <span className="h-2.5 w-2.5 rounded-full border" style={{ backgroundColor: style.color.code }} />
                    )}
                    {style.color?.name || style.color_name}
                  </span>
                )}
                {style.fabric_type_name && <span>{style.fabric_type_name}</span>}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-1 border-t">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Link2 className="h-3 w-3" />
                  {poCount > 0 ? `${poCount} PO${poCount > 1 ? 's' : ''}` : 'No POs'}
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  {canEdit && onEdit && (
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onEdit(style)}>
                      <Edit className="h-3 w-3" />
                    </Button>
                  )}
                  {canDelete && onDelete && (
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-600" onClick={() => onDelete(style)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
