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
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

const currencySchema = z.object({
  code: z.string().min(1, 'Currency code is required').max(10),
  name: z.string().min(1, 'Currency name is required'),
  symbol: z.string().optional(),
  exchange_rate: z.coerce.number().min(0).optional(),
});

type CurrencyFormData = z.infer<typeof currencySchema>;

interface CreateCurrencyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (data?: any) => void;
}

export function CreateCurrencyDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateCurrencyDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CurrencyFormData>({
    resolver: zodResolver(currencySchema),
    defaultValues: {
      code: '',
      name: '',
      symbol: '',
      exchange_rate: 1,
    },
  });

  const onSubmit = async (data: CurrencyFormData) => {
    setIsSubmitting(true);
    try {
      const response = await api.post('/master-data/currencies', {
        ...data,
        is_active: true,
      });
      toast.success(`Currency "${data.code}" created successfully`);
      reset();
      onOpenChange(false);
      onSuccess(response.data?.data);
    } catch (error: any) {
      console.error('Failed to create currency:', error);
      toast.error(error.response?.data?.message || 'Failed to create currency');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Currency</DialogTitle>
          <DialogDescription>
            Add a new currency to your master data.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code">Currency Code *</Label>
              <Input
                id="code"
                placeholder="e.g., USD, EUR, GBP"
                {...register('code')}
              />
              {errors.code && (
                <p className="text-sm text-destructive">{errors.code.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Currency Name *</Label>
              <Input
                id="name"
                placeholder="e.g., US Dollar, Euro"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="symbol">Symbol</Label>
              <Input
                id="symbol"
                placeholder="e.g., $, EUR"
                {...register('symbol')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exchange_rate">Exchange Rate</Label>
              <Input
                id="exchange_rate"
                type="number"
                step="0.000001"
                placeholder="1.0"
                {...register('exchange_rate')}
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
                'Create Currency'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
