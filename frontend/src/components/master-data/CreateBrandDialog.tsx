'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

const brandSchema = z.object({
  name: z.string().min(1, 'Brand name is required'),
  code: z.string().optional(),
  description: z.string().optional(),
});

type BrandFormData = z.infer<typeof brandSchema>;

interface CreateBrandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (data?: any) => void;
}

export function CreateBrandDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateBrandDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<BrandFormData>({
    resolver: zodResolver(brandSchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
    },
  });

  const onSubmit = async (data: BrandFormData) => {
    setIsSubmitting(true);
    try {
      const response = await api.post('/master-data/brands', {
        ...data,
        is_active: true,
      });
      toast.success(`Brand "${data.name}" created successfully`);
      reset();
      onOpenChange(false);
      onSuccess(response.data?.data);
    } catch (error: any) {
      console.error('Failed to create brand:', error);
      toast.error(error.response?.data?.message || 'Failed to create brand');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Brand</DialogTitle>
          <DialogDescription>
            Add a new brand to your master data.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Brand Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Nike, Adidas"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                placeholder="e.g., NK, AD"
                {...register('code')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional description..."
                {...register('description')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Brand'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
