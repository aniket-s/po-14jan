'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  X, Edit, Trash2, Package, Link2, Ruler, Palette, ShoppingBag,
  Tag, Calendar, User, FileText, Image as ImageIcon,
} from 'lucide-react';
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
        <div className="space-y-1 min-w-0">
          <h3 className="font-semibold text-sm truncate">{style.style_number}</h3>
          <p className="text-xs text-muted-foreground truncate">{style.description || 'No description'}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0 shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* Image */}
          {images.length > 0 && (
            <div>
              <div className="rounded-lg overflow-hidden border bg-muted mb-2">
                <img src={images[0]} alt={style.style_number} className="w-full h-48 object-cover" />
              </div>
              {images.length > 1 && (
                <SampleImageGallery images={images} title="" />
              )}
            </div>
          )}

          {/* Status */}
          <div className="flex items-center gap-2">
            <Badge variant={style.is_active !== false ? 'default' : 'secondary'} className={style.is_active !== false ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-300' : ''}>
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

          {/* Details Grid */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Details</h4>
            <div className="grid grid-cols-2 gap-3">
              {style.brand?.name && (
                <DetailItem icon={<Tag />} label="Brand" value={style.brand.name} />
              )}
              {style.retailer?.name && (
                <DetailItem icon={<ShoppingBag />} label="Retailer" value={style.retailer.name} />
              )}
              {style.category?.name && (
                <DetailItem icon={<Package />} label="Category" value={style.category.name} />
              )}
              {style.season?.name && (
                <DetailItem icon={<Calendar />} label="Season" value={style.season.name} />
              )}
              {style.gender?.name && (
                <DetailItem icon={<User />} label="Gender" value={style.gender.name} />
              )}
              {style.fit && (
                <DetailItem icon={<Ruler />} label="Fit" value={style.fit} />
              )}
            </div>
          </div>

          {/* Fabric & Color */}
          {(style.fabric_type_name || style.color?.name || style.color_name) && (
            <>
              <Separator />
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Fabric & Color</h4>
                <div className="grid grid-cols-2 gap-3">
                  {style.fabric_type_name && (
                    <DetailItem icon={<Ruler />} label="Fabric Type" value={style.fabric_type_name} />
                  )}
                  {style.fabric_weight && (
                    <DetailItem icon={<Ruler />} label="Weight" value={style.fabric_weight} />
                  )}
                  {(style.color?.name || style.color_name) && (
                    <div className="flex items-start gap-2">
                      <Palette className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground">Color</p>
                        <div className="flex items-center gap-1">
                          {style.color?.code && (
                            <span className="h-3 w-3 rounded-full border" style={{ backgroundColor: style.color.code }} />
                          )}
                          <p className="text-xs font-medium">{style.color?.name || style.color_name}</p>
                        </div>
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
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Pricing</h4>
                <div className="grid grid-cols-2 gap-3">
                  {style.unit_price != null && style.unit_price > 0 && (
                    <DetailItem icon={<Tag />} label="Unit Price" value={`$${Number(style.unit_price).toFixed(2)}`} />
                  )}
                  {style.fob_price != null && style.fob_price > 0 && (
                    <DetailItem icon={<Tag />} label="FOB Price" value={`$${Number(style.fob_price).toFixed(2)}`} />
                  )}
                  {style.msrp != null && style.msrp > 0 && (
                    <DetailItem icon={<Tag />} label="MSRP" value={`$${Number(style.msrp).toFixed(2)}`} />
                  )}
                  {style.wholesale_price != null && style.wholesale_price > 0 && (
                    <DetailItem icon={<Tag />} label="Wholesale" value={`$${Number(style.wholesale_price).toFixed(2)}`} />
                  )}
                </div>
              </div>
            </>
          )}

          {/* Purchase Orders */}
          {style.purchase_orders && style.purchase_orders.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Purchase Orders</h4>
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
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Documents</h4>
                <div className="space-y-1">
                  {documents.map((url: string, idx: number) => (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-blue-600 hover:underline py-1"
                    >
                      <FileText className="h-3 w-3 shrink-0" />
                      Technical File {idx + 1}
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
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Audit</h4>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>Created by {style.creator.name} on {new Date(style.created_at).toLocaleDateString()}</p>
                  {style.updatedBy && (
                    <p>Updated by {style.updatedBy.name} on {new Date(style.updated_at).toLocaleDateString()}</p>
                  )}
                </div>
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

function DetailItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-xs font-medium">{value}</p>
      </div>
    </div>
  );
}
