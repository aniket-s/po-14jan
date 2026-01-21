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
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

const paymentTermSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required').max(50),
  days: z.coerce.number().min(0).optional().nullable(),
  requires_percentage: z.boolean().optional(),
  description: z.string().optional(),
});

type PaymentTermFormData = z.infer<typeof paymentTermSchema>;

interface CreatePaymentTermDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (data?: any) => void;
}

export function CreatePaymentTermDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreatePaymentTermDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requiresPercentage, setRequiresPercentage] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<PaymentTermFormData>({
    resolver: zodResolver(paymentTermSchema),
    defaultValues: {
      name: '',
      code: '',
      days: null,
      requires_percentage: false,
      description: '',
    },
  });

  const onSubmit = async (data: PaymentTermFormData) => {
    setIsSubmitting(true);
    try {
      const response = await api.post('/master-data/payment-terms', {
        ...data,
        requires_percentage: requiresPercentage,
        is_active: true,
      });
      toast.success(`Payment term "${data.name}" created successfully`);
      reset();
      setRequiresPercentage(false);
      onOpenChange(false);
      onSuccess(response.data?.data);
    } catch (error: any) {
      console.error('Failed to create payment term:', error);
      toast.error(error.response?.data?.message || 'Failed to create payment term');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Payment Term</DialogTitle>
          <DialogDescription>
            Add a new payment term to your master data.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="e.g., NET 30, ADVANCE"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Code *</Label>
              <Input
                id="code"
                placeholder="e.g., NET30, ADVANCE"
                {...register('code')}
              />
              <p className="text-xs text-muted-foreground">
                Will be auto-converted to uppercase
              </p>
              {errors.code && (
                <p className="text-sm text-destructive">{errors.code.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="days">Days (for NET terms)</Label>
              <Input
                id="days"
                type="number"
                min="0"
                placeholder="e.g., 30, 60, 90"
                {...register('days')}
              />
              <p className="text-xs text-muted-foreground">
                Number of days for payment (leave empty if not applicable)
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="requires_percentage"
                checked={requiresPercentage}
                onCheckedChange={(checked) => {
                  setRequiresPercentage(checked as boolean);
                  setValue('requires_percentage', checked as boolean);
                }}
              />
              <Label htmlFor="requires_percentage" className="cursor-pointer">
                Requires Percentage (e.g., ADVANCE payments)
              </Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="e.g., Payment due 30 days after invoice"
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
                'Create Payment Term'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
