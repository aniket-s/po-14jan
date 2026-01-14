'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, GripVertical, ArrowUp, ArrowDown, Plus, X } from 'lucide-react';
import api from '@/lib/api';

interface SampleType {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  is_custom: boolean;
}

interface SelectedSampleType extends SampleType {
  priority: number;
}

interface BulkSampleProcessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedStyleIds: number[];
  onSuccess: () => void;
}

export function BulkSampleProcessModal({
  open,
  onOpenChange,
  selectedStyleIds,
  onSuccess,
}: BulkSampleProcessModalProps) {
  const [sampleTypes, setSampleTypes] = useState<SampleType[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<SelectedSampleType[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customTypeName, setCustomTypeName] = useState('');
  const [customTypeDescription, setCustomTypeDescription] = useState('');

  useEffect(() => {
    if (open) {
      fetchSampleTypes();
    }
  }, [open]);

  const fetchSampleTypes = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ sample_types: SampleType[] }>('/admin/sample-types');
      setSampleTypes(response.data.sample_types || []);
    } catch (error) {
      console.error('Failed to fetch sample types:', error);
      setSampleTypes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSampleType = (sampleType: SampleType, checked: boolean) => {
    if (checked) {
      const newPriority = selectedTypes.length + 1;
      setSelectedTypes([...selectedTypes, { ...sampleType, priority: newPriority }]);
    } else {
      const filtered = selectedTypes.filter(t => t.id !== sampleType.id);
      // Recalculate priorities
      const reordered = filtered.map((type, index) => ({
        ...type,
        priority: index + 1,
      }));
      setSelectedTypes(reordered);
    }
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newSelected = [...selectedTypes];
    [newSelected[index - 1], newSelected[index]] = [newSelected[index], newSelected[index - 1]];
    // Recalculate priorities
    const reordered = newSelected.map((type, idx) => ({
      ...type,
      priority: idx + 1,
    }));
    setSelectedTypes(reordered);
  };

  const moveDown = (index: number) => {
    if (index === selectedTypes.length - 1) return;
    const newSelected = [...selectedTypes];
    [newSelected[index], newSelected[index + 1]] = [newSelected[index + 1], newSelected[index]];
    // Recalculate priorities
    const reordered = newSelected.map((type, idx) => ({
      ...type,
      priority: idx + 1,
    }));
    setSelectedTypes(reordered);
  };

  const handleAddCustomType = () => {
    if (!customTypeName.trim()) return;

    const newCustomType: SelectedSampleType = {
      id: Date.now(), // Temporary ID for UI
      name: customTypeName.toLowerCase().replace(/\s+/g, '_'),
      display_name: customTypeName,
      description: customTypeDescription || null,
      is_custom: true,
      priority: selectedTypes.length + 1,
    };

    setSelectedTypes([...selectedTypes, newCustomType]);
    setCustomTypeName('');
    setCustomTypeDescription('');
    setShowAddCustom(false);
  };

  const handleSubmit = async () => {
    if (selectedTypes.length === 0) {
      alert('Please select at least one sample type');
      return;
    }

    try {
      setSubmitting(true);
      const sampleTypeIds = selectedTypes
        .filter(t => !t.is_custom)
        .map(t => t.id);

      await api.post('/styles/bulk-assign-sample-processes', {
        style_ids: selectedStyleIds,
        sample_type_ids: sampleTypeIds,
      });

      // Handle custom types separately if needed
      for (const customType of selectedTypes.filter(t => t.is_custom)) {
        for (const styleId of selectedStyleIds) {
          await api.post(`/styles/${styleId}/sample-processes/add-custom`, {
            display_name: customType.display_name,
            description: customType.description,
            priority: customType.priority,
          });
        }
      }

      onSuccess();
      onOpenChange(false);
      setSelectedTypes([]);
    } catch (error) {
      console.error('Failed to assign sample processes:', error);
      alert('Failed to assign sample processes. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Sample Approval Process</DialogTitle>
          <DialogDescription>
            Select sample types and arrange them in priority order for {selectedStyleIds.length} selected style(s).
            Drag to reorder or use arrow buttons.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Available Sample Types */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Available Sample Types</Label>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {sampleTypes.map((sampleType) => {
                  const isSelected = selectedTypes.some(t => t.id === sampleType.id);
                  return (
                    <div
                      key={sampleType.id}
                      className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <Checkbox
                        id={`sample-type-${sampleType.id}`}
                        checked={isSelected}
                        onCheckedChange={(checked) => handleToggleSampleType(sampleType, checked as boolean)}
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor={`sample-type-${sampleType.id}`}
                          className="font-medium cursor-pointer"
                        >
                          {sampleType.display_name}
                        </Label>
                        {sampleType.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {sampleType.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Custom Type Button */}
            {!showAddCustom && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddCustom(true)}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Custom Sample Type
              </Button>
            )}

            {/* Add Custom Type Form */}
            {showAddCustom && (
              <div className="p-4 border rounded-lg space-y-3 bg-muted/50">
                <div className="space-y-2">
                  <Label htmlFor="custom-type-name">Custom Type Name *</Label>
                  <Input
                    id="custom-type-name"
                    value={customTypeName}
                    onChange={(e) => setCustomTypeName(e.target.value)}
                    placeholder="e.g., Strike Off Sample"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custom-type-description">Description (Optional)</Label>
                  <Textarea
                    id="custom-type-description"
                    value={customTypeDescription}
                    onChange={(e) => setCustomTypeDescription(e.target.value)}
                    placeholder="Brief description of this sample type..."
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleAddCustomType}
                    disabled={!customTypeName.trim()}
                  >
                    Add
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowAddCustom(false);
                      setCustomTypeName('');
                      setCustomTypeDescription('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Selected & Ordered Sample Types */}
          {selectedTypes.length > 0 && (
            <div className="space-y-3">
              <Label className="text-base font-semibold">
                Priority Order ({selectedTypes.length} selected)
              </Label>
              <p className="text-sm text-muted-foreground">
                Factory will submit samples in this order. Lower number = higher priority.
              </p>
              <div className="space-y-2">
                {selectedTypes.map((type, index) => (
                  <div
                    key={type.id}
                    className="flex items-center gap-3 p-3 border rounded-lg bg-card"
                  >
                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                    <Badge variant="secondary" className="font-mono">
                      {type.priority}
                    </Badge>
                    <div className="flex-1">
                      <div className="font-medium">{type.display_name}</div>
                      {type.description && (
                        <div className="text-xs text-muted-foreground">{type.description}</div>
                      )}
                      {type.is_custom && (
                        <Badge variant="outline" className="text-xs mt-1">
                          Custom
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveUp(index)}
                        disabled={index === 0}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveDown(index)}
                        disabled={index === selectedTypes.length - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleSampleType(type, false)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || selectedTypes.length === 0}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Assign to {selectedStyleIds.length} Style(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
