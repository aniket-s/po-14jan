'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Edit, Trash2, Package, Link2, ExternalLink, FileText } from 'lucide-react';
import { Style } from '@/services/styles';
import { SampleImageGallery } from '@/components/samples/SampleImageGallery';

interface StyleDetailPanelProps {
  style: Style;
  onClose: () => void;
  onEdit?: (style: Style) => void;
  onDelete?: (style: Style) => void;
  canEdit: boolean;
  canDelete: boolean;
}

export function StyleDetailPanel({
  style,
  onClose,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: StyleDetailPanelProps) {
  const router = useRouter();
  const images = style.images || [];
  const documents = style.technical_file_paths || [];

  return (
    <div className="flex flex-col h-full border-l bg-card">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm truncate">{style.style_number}</h3>
          <p className="text-xs text-muted-foreground truncate">{style.description || 'No description'}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0 shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Image */}
          {images.length > 0 && (
            <div className="rounded-lg overflow-hidden border bg-muted">
              <img src={images[0]} alt={style.style_number} className="w-full h-44 object-cover" />
            </div>
          )}
          {images.length > 1 && (
            <SampleImageGallery images={images} title="" />
          )}

          {/* Status */}
          <div className="flex items-center gap-2">
            <Badge
              variant={style.is_active !== false ? 'default' : 'secondary'}
              className={style.is_active !== false ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-300' : ''}
            >
              {style.is_active !== false ? 'Active' : 'Inactive'}
            </Badge>
            {style.purchase_orders && style.purchase_orders.length > 0 && (
              <Badge variant="outline" className="text-[10px]">
                <Link2 className="h-2.5 w-2.5 mr-0.5" />
                {style.purchase_orders.length} PO{style.purchase_orders.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          <Separator />

          {/* Details */}
          <div className="space-y-2.5">
            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Details</h4>
            <div className="space-y-2">
              {style.brand?.name && <DetailRow label="Brand" value={style.brand.name} />}
              {style.retailer?.name && <DetailRow label="Retailer" value={style.retailer.name} />}
              {style.category?.name && <DetailRow label="Category" value={style.category.name} />}
              {style.season?.name && <DetailRow label="Season" value={style.season.name} />}
              {style.gender?.name && <DetailRow label="Gender" value={style.gender.name} />}
              {style.fit && <DetailRow label="Fit" value={style.fit} />}
            </div>
          </div>

          {/* Fabric & Color */}
          {(style.fabric_type_name || style.color?.name || style.color_name) && (
            <>
              <Separator />
              <div className="space-y-2.5">
                <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Fabric & Color</h4>
                <div className="space-y-2">
                  {style.fabric_type_name && <DetailRow label="Fabric" value={style.fabric_type_name} />}
                  {style.fabric_weight && <DetailRow label="Weight" value={style.fabric_weight} />}
                  {(style.color?.name || style.color_name) && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Color</span>
                      <div className="flex items-center gap-1.5">
                        {style.color?.code && (
                          <span className="h-3.5 w-3.5 rounded-full border" style={{ backgroundColor: style.color.code }} />
                        )}
                        <span className="text-xs font-medium">{style.color?.name || style.color_name}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Pricing */}
          {(style.unit_price || style.fob_price || style.msrp || style.wholesale_price) && (
            <>
              <Separator />
              <div className="space-y-2.5">
                <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Pricing</h4>
                <div className="space-y-2">
                  {style.unit_price != null && Number(style.unit_price) > 0 && (
                    <DetailRow label="Unit Price" value={`$${Number(style.unit_price).toFixed(2)}`} />
                  )}
                  {style.fob_price != null && Number(style.fob_price) > 0 && (
                    <DetailRow label="FOB Price" value={`$${Number(style.fob_price).toFixed(2)}`} />
                  )}
                  {style.msrp != null && Number(style.msrp) > 0 && (
                    <DetailRow label="MSRP" value={`$${Number(style.msrp).toFixed(2)}`} />
                  )}
                  {style.wholesale_price != null && Number(style.wholesale_price) > 0 && (
                    <DetailRow label="Wholesale" value={`$${Number(style.wholesale_price).toFixed(2)}`} />
                  )}
                </div>
              </div>
            </>
          )}

          {/* Purchase Orders */}
          {style.purchase_orders && style.purchase_orders.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2.5">
                <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Purchase Orders</h4>
                <div className="space-y-1.5">
                  {style.purchase_orders.map((po: any) => (
                    <Button
                      key={po.id}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start h-8 text-xs"
                      onClick={() => router.push(`/purchase-orders/${po.id}`)}
                    >
                      <Link2 className="h-3 w-3 mr-1.5 shrink-0" />
                      {po.po_number}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Documents */}
          {documents.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2.5">
                <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Documents</h4>
                <div className="space-y-1">
                  {documents.map((url: string, idx: number) => (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-blue-600 hover:underline py-1 px-2 rounded hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Technical File {idx + 1}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 ml-auto" />
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Audit */}
          {style.creator && (
            <>
              <Separator />
              <div className="space-y-1.5 text-[11px] text-muted-foreground">
                <p>Created by <span className="font-medium text-foreground">{style.creator.name}</span> on {new Date(style.created_at).toLocaleDateString()}</p>
                {style.updatedBy && (
                  <p>Updated by <span className="font-medium text-foreground">{style.updatedBy.name}</span> on {new Date(style.updated_at).toLocaleDateString()}</p>
                )}
              </div>
            </>
          )}
        </div>
      </ScrollArea>

      {/* Actions */}
      {(canEdit || canDelete) && (
        <div className="border-t p-3 space-y-2">
          {canEdit && onEdit && (
            <Button size="sm" variant="outline" className="w-full" onClick={() => onEdit(style)}>
              <Edit className="mr-1.5 h-3.5 w-3.5" /> Edit Style
            </Button>
          )}
          {canDelete && onDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
              onClick={() => onDelete(style)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete Style
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-right">{value}</span>
    </div>
  );
}
