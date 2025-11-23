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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { DataTable, type Column } from '@/components/admin/data-table';

interface BulkPriceUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Array<{ id: string; name: string; current_price: number }>;
  locale: string;
  onSuccess: () => void;
}

export function BulkPriceUpdateDialog({
  open,
  onOpenChange,
  products,
  locale,
  onSuccess,
}: BulkPriceUpdateDialogProps) {
  const [updateType, setUpdateType] = useState<'percentage' | 'fixed'>('percentage');
  const [updateValue, setUpdateValue] = useState<string>('');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const isRTL = locale === 'ar';

  const previewChanges = () => {
    if (!updateValue) return [];

    const value = parseFloat(updateValue);
    if (isNaN(value)) return [];

    return Array.from(selectedProducts).map((productId) => {
      const product = products.find((p) => p.id === productId);
      if (!product) return null;

      let newPrice = product.current_price;
      if (updateType === 'percentage') {
        newPrice = product.current_price * (1 + value / 100);
      } else {
        newPrice = product.current_price + value;
      }

      return {
        id: product.id,
        name: product.name,
        current_price: product.current_price,
        new_price: Math.max(0, newPrice),
      };
    }).filter(Boolean);
  };

  const handleSubmit = async () => {
    if (selectedProducts.size === 0) {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'يرجى اختيار منتج واحد على الأقل' : 'Please select at least one product',
        variant: 'destructive',
      });
      return;
    }

    if (!updateValue) {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'يرجى إدخال قيمة التحديث' : 'Please enter update value',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/store/products/bulk-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productIds: Array.from(selectedProducts),
          updateType,
          updateValue: parseFloat(updateValue),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update prices');
      }

      toast({
        title: isRTL ? 'نجح' : 'Success',
        description: isRTL ? 'تم تحديث الأسعار بنجاح' : 'Prices updated successfully',
      });

      onSuccess();
      onOpenChange(false);
      setSelectedProducts(new Set());
      setUpdateValue('');
    } catch (error: any) {
      console.error('Error updating prices:', error);
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: error.message || (isRTL ? 'فشل تحديث الأسعار' : 'Failed to update prices'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const preview = previewChanges();

  const previewColumns: Column<any>[] = [
    {
      key: 'name',
      label: isRTL ? 'المنتج' : 'Product',
    },
    {
      key: 'current_price',
      label: isRTL ? 'السعر الحالي' : 'Current Price',
      render: (row) => `$${row.current_price.toLocaleString()}`,
    },
    {
      key: 'new_price',
      label: isRTL ? 'السعر الجديد' : 'New Price',
      render: (row) => `$${row.new_price.toFixed(2)}`,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isRTL ? 'تحديث الأسعار بالجملة' : 'Bulk Price Update'}
          </DialogTitle>
          <DialogDescription>
            {isRTL
              ? 'اختر المنتجات وقم بتحديث أسعارها'
              : 'Select products and update their prices'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product Selection */}
          <div className="space-y-2">
            <Label>{isRTL ? 'اختر المنتجات' : 'Select Products'}</Label>
            <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
              {products.map((product) => (
                <div key={product.id} className="flex items-center space-x-2 py-2">
                  <Checkbox
                    id={product.id}
                    checked={selectedProducts.has(product.id)}
                    onCheckedChange={(checked) => {
                      const newSet = new Set(selectedProducts);
                      if (checked) {
                        newSet.add(product.id);
                      } else {
                        newSet.delete(product.id);
                      }
                      setSelectedProducts(newSet);
                    }}
                  />
                  <Label
                    htmlFor={product.id}
                    className="flex-1 cursor-pointer"
                  >
                    {product.name} - ${product.current_price.toLocaleString()}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Update Type */}
          <div className="space-y-2">
            <Label>{isRTL ? 'نوع التحديث' : 'Update Type'}</Label>
            <Select value={updateType} onValueChange={(value: 'percentage' | 'fixed') => setUpdateType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">
                  {isRTL ? 'نسبة مئوية' : 'Percentage'}
                </SelectItem>
                <SelectItem value="fixed">
                  {isRTL ? 'مبلغ ثابت' : 'Fixed Amount'}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Update Value */}
          <div className="space-y-2">
            <Label>
              {updateType === 'percentage'
                ? isRTL
                  ? 'النسبة المئوية (%)'
                  : 'Percentage (%)'
                : isRTL
                ? 'المبلغ'
                : 'Amount'}
            </Label>
            <Input
              type="number"
              step={updateType === 'percentage' ? '0.1' : '0.01'}
              value={updateValue}
              onChange={(e) => setUpdateValue(e.target.value)}
              placeholder={updateType === 'percentage' ? '10' : '50'}
            />
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="space-y-2">
              <Label>{isRTL ? 'معاينة التغييرات' : 'Preview Changes'}</Label>
              <DataTable data={preview} columns={previewColumns} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button onClick={handleSubmit} disabled={loading || selectedProducts.size === 0}>
            {loading
              ? isRTL
                ? 'جاري التحديث...'
                : 'Updating...'
              : isRTL
              ? 'تحديث'
              : 'Update'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

