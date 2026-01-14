'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { deleteStandaloneStyle, type Style } from '@/services/styles';
import { Loader2, AlertTriangle } from 'lucide-react';

interface DeleteStyleConfirmationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  style: Style | null;
  onSuccess: () => void;
}

export function DeleteStyleConfirmation({
  open,
  onOpenChange,
  style,
  onSuccess,
}: DeleteStyleConfirmationProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!style) {
      toast.error('No style selected');
      return;
    }

    try {
      setIsDeleting(true);
      await deleteStandaloneStyle(style.id);
      toast.success(`Style "${style.style_number}" deleted successfully`);
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Failed to delete style:', error);
      const errorMessage = error.response?.data?.message || 'Failed to delete style';
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!style) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete Style?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Are you sure you want to delete style <strong>{style.style_number}</strong>?
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-900">
              <p className="font-semibold mb-1">⚠️ Warning:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>This action cannot be undone</li>
                <li>
                  If this style is used in any purchase orders, those associations will be removed
                </li>
                <li>All PO-specific data (quantities, prices, assignments) will be lost</li>
                <li>This may affect PO totals and reports</li>
              </ul>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Consider removing the style from specific POs instead of deleting it entirely.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Style'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
