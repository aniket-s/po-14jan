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
import { Loader2, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

const agentSchema = z.object({
  name: z.string().min(1, 'Agent name is required'),
  email: z.string().email('Valid email is required'),
  company: z.string().optional(),
  phone: z.string().optional(),
});

type AgentFormData = z.infer<typeof agentSchema>;

interface CreateAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  defaultName?: string;
}

export function CreateAgentDialog({
  open,
  onOpenChange,
  onSuccess,
  defaultName,
}: CreateAgentDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<AgentFormData>({
    resolver: zodResolver(agentSchema),
    defaultValues: {
      name: defaultName || '',
      email: '',
      company: defaultName || '',
      phone: '',
    },
  });

  const onSubmit = async (data: AgentFormData) => {
    setIsSubmitting(true);
    try {
      await api.post('/master-data/agents', {
        name: data.name,
        email: data.email,
        company: data.company || undefined,
        phone: data.phone || undefined,
      });

      toast.success(`Agent "${data.name}" created successfully`);
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Failed to create agent:', error);
      const errorMessage = error.response?.data?.message || 'Failed to create agent';
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
            <Building2 className="h-5 w-5" />
            Create New Agent
          </DialogTitle>
          <DialogDescription>
            Add a new agent/agency to the system
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agent-name">
              Agent Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="agent-name"
              placeholder="e.g., Crystal Apparels India"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-email">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="agent-email"
              type="email"
              placeholder="e.g., agent@example.com"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-company">Company</Label>
            <Input
              id="agent-company"
              placeholder="e.g., Crystal Apparels India Pvt Ltd"
              {...register('company')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-phone">Phone</Label>
            <Input
              id="agent-phone"
              placeholder="e.g., +91 9876543210"
              {...register('phone')}
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
                'Create Agent'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
