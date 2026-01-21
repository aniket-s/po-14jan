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

const fabricQualitySchema = z.object({
  name: z.string().min(1, 'Fabric quality name is required'),
  code: z.string().optional(),
  description: z.string().optional(),
});

type FabricQualityFormData = z.infer<typeof fabricQualitySchema>;

interface CreateFabricQualityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (data?: any) => void;
}

export function CreateFabricQualityDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateFabricQualityDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FabricQualityFormData>({
    resolver: zodResolver(fabricQualitySchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
    },
  });

  const onSubmit = async (data: FabricQualityFormData) => {
    setIsSubmitting(true);
    try {
      const response = await api.post('/master-data/fabric-qualities', {
        ...data,
        is_active: true,
      });
      toast.success(`Fabric quality "${data.name}" created successfully`);
      reset();
      onOpenChange(false);
      onSuccess(response.data?.data);
    } catch (error: any) {
      console.error('Failed to create fabric quality:', error);
      toast.error(error.response?.data?.message || 'Failed to create fabric quality');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Fabric Quality</DialogTitle>
          <DialogDescription>
            Add a new fabric quality to your master data.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Fabric Quality Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Premium, Standard, Economy"
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
                placeholder="e.g., PREM, STD"
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
                'Create Fabric Quality'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
