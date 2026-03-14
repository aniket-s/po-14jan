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
import { Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

const buyerSchema = z.object({
  name: z.string().min(1, 'Buyer name is required'),
  code: z.string().optional(),
  description: z.string().optional(),
});

type BuyerFormData = z.infer<typeof buyerSchema>;

interface CreateBuyerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  defaultName?: string;
}

export function CreateBuyerDialog({
  open,
  onOpenChange,
  onSuccess,
  defaultName,
}: CreateBuyerDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<BuyerFormData>({
    resolver: zodResolver(buyerSchema),
    defaultValues: {
      name: defaultName || '',
      code: '',
      description: '',
    },
  });

  const onSubmit = async (data: BuyerFormData) => {
    setIsSubmitting(true);
    try {
      await api.post('/master-data/buyers', {
        name: data.name,
        code: data.code || undefined,
        description: data.description || undefined,
        is_active: true,
      });

      toast.success(`Buyer "${data.name}" created successfully`);
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Failed to create buyer:', error);
      const errorMessage = error.response?.data?.message || 'Failed to create buyer';
      toast.error(errorMessage);

      if (error.response?.data?.errors) {
        Object.entries(error.response.data.errors).forEach(([field, messages]) => {
          toast.error(`${field}: ${(messages as string[])[0]}`);
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Create New Buyer
          </DialogTitle>
          <DialogDescription>
            Add a new buyer/buying house to the system
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="buyer-name">
              Buyer Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="buyer-name"
              placeholder="e.g., SPORT CASUAL INTERNATIONAL"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="buyer-code">Code</Label>
            <Input
              id="buyer-code"
              placeholder="e.g., SCI"
              {...register('code')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="buyer-description">Description</Label>
            <Textarea
              id="buyer-description"
              placeholder="Optional description..."
              rows={2}
              {...register('description')}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
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
                'Create Buyer'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
