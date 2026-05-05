'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import type { UserRole } from '@/lib/database/types';
import { useTranslations } from '@/lib/simple-intl-provider';

interface UserRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    full_name: string | null;
    email: string | null;
    role: UserRole;
  };
  onSuccess: () => void;
  locale: string;
}

export function UserRoleDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
  locale,
}: UserRoleDialogProps) {
  const [role, setRole] = useState<UserRole>(user.role);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const t = useTranslations();
  const isRTL = locale === 'ar';

  const handleSubmit = async () => {
    if (role === user.role) {
      onOpenChange(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/admin/users/${user.id}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update role');
      }

      toast({
        title: t('admin.userRoleDialog.updated'),
        description: t('admin.userRoleDialog.roleUpdated'),
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating user role:', error);
      toast({
        title: t('common.error'),
        description:
          error instanceof Error
            ? error.message
            : t('admin.userRoleDialog.updateFailed'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('admin.userRoleDialog.title')}
          </DialogTitle>
          <DialogDescription>
            {t('admin.userRoleDialog.description', { name: user.full_name || user.email || '' })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="role">{t('admin.userRoleDialog.role')}</Label>
            <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">{t('admin.userRoleDialog.admin')}</SelectItem>
                <SelectItem value="customer">{t('admin.userRoleDialog.customer')}</SelectItem>
                <SelectItem value="store">{t('admin.userRoleDialog.store')}</SelectItem>
                <SelectItem value="guest">{t('admin.userRoleDialog.guest')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? t('common.saving') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

