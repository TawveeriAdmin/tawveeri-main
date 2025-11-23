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
        title: isRTL ? 'تم التحديث' : 'Updated',
        description: isRTL ? 'تم تحديث دور المستخدم بنجاح' : 'User role updated successfully',
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating user role:', error);
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description:
          error instanceof Error
            ? error.message
            : isRTL
            ? 'فشل تحديث دور المستخدم'
            : 'Failed to update user role',
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
            {isRTL ? 'تعديل دور المستخدم' : 'Edit User Role'}
          </DialogTitle>
          <DialogDescription>
            {isRTL
              ? `تعديل دور ${user.full_name || user.email}`
              : `Change role for ${user.full_name || user.email}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="role">{isRTL ? 'الدور' : 'Role'}</Label>
            <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="customer">{isRTL ? 'عميل' : 'Customer'}</SelectItem>
                <SelectItem value="store">{isRTL ? 'متجر' : 'Store'}</SelectItem>
                <SelectItem value="guest">{isRTL ? 'ضيف' : 'Guest'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : isRTL ? 'حفظ' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

