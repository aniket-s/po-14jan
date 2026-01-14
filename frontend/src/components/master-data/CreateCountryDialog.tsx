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

const countrySchema = z.object({
  name: z.string().min(1, 'Country name is required'),
  code: z.string().min(1, 'Country code is required').max(3),
  sailing_time_days: z.coerce.number().min(0).max(365),
});

type CountryFormData = z.infer<typeof countrySchema>;

interface CreateCountryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateCountryDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateCountryDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CountryFormData>({
    resolver: zodResolver(countrySchema),
    defaultValues: {
      name: '',
      code: '',
      sailing_time_days: 0,
    },
  });

  const onSubmit = async (data: CountryFormData) => {
    setIsSubmitting(true);
    try {
      const response = await api.post('/master-data/countries', {
        ...data,
        is_active: true,
      });
      toast.success(`Country "${data.name}" created successfully`);
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Failed to create country:', error);
      toast.error(error.response?.data?.message || 'Failed to create country');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Country</DialogTitle>
          <DialogDescription>
            Add a new country of origin with shipping time.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Country Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Bangladesh"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Country Code *</Label>
              <Input
                id="code"
                placeholder="e.g., BD"
                maxLength={3}
                {...register('code')}
              />
              {errors.code && (
                <p className="text-sm text-destructive">{errors.code.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sailing_time_days">Sailing Time (Days) *</Label>
              <Input
                id="sailing_time_days"
                type="number"
                placeholder="e.g., 30"
                {...register('sailing_time_days')}
              />
              {errors.sailing_time_days && (
                <p className="text-sm text-destructive">{errors.sailing_time_days.message}</p>
              )}
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
                'Create Country'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
