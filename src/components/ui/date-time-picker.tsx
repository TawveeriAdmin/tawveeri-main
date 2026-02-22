'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DateTimePickerProps {
  value?: string; // ISO string or empty
  onChange: (value: string) => void;
  placeholder?: string;
  locale?: string;
  disabled?: boolean;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder,
  locale = 'en',
  disabled,
}: DateTimePickerProps) {
  const isRTL = locale === 'ar';
  const dateLocale = isRTL ? ar : enUS;

  const date = value ? new Date(value) : undefined;
  const hours = date ? date.getHours() : 12;
  const minutes = date ? date.getMinutes() : 0;

  const handleDateSelect = (selected: Date | undefined) => {
    if (!selected) return;
    const newDate = new Date(selected);
    if (date) {
      newDate.setHours(date.getHours(), date.getMinutes());
    } else {
      newDate.setHours(12, 0, 0, 0);
    }
    onChange(newDate.toISOString());
  };

  const handleHourChange = (h: string) => {
    const d = date ? new Date(date) : new Date();
    if (!date) {
      d.setMinutes(0, 0, 0);
    }
    d.setHours(parseInt(h));
    onChange(d.toISOString());
  };

  const handleMinuteChange = (m: string) => {
    const d = date ? new Date(date) : new Date();
    if (!date) {
      d.setHours(12, 0, 0, 0);
    }
    d.setMinutes(parseInt(m));
    onChange(d.toISOString());
  };

  const hourOptions = Array.from({ length: 24 }, (_, i) => i);
  const minuteOptions = Array.from({ length: 12 }, (_, i) => i * 5);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'h-11 w-full justify-start rounded-xl border-outline-variant bg-surface-container px-3 text-start text-sm font-normal',
            !date && 'text-on-surface-variant'
          )}
        >
          <CalendarIcon className="me-2 h-4 w-4 shrink-0 text-on-surface-variant" />
          {date
            ? format(date, 'PPP  HH:mm', { locale: dateLocale })
            : placeholder || (isRTL ? 'اختر التاريخ والوقت' : 'Pick date & time')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleDateSelect}
          locale={dateLocale}
          dir={isRTL ? 'rtl' : 'ltr'}
        />
        <div className="border-t border-outline-variant px-3 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-on-surface-variant">
              {isRTL ? 'الوقت' : 'Time'}
            </span>
            <Select
              value={String(hours)}
              onValueChange={handleHourChange}
            >
              <SelectTrigger className="h-9 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {hourOptions.map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {String(h).padStart(2, '0')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm font-bold text-on-surface-variant">:</span>
            <Select
              value={String(minutes)}
              onValueChange={handleMinuteChange}
            >
              <SelectTrigger className="h-9 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {minuteOptions.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {String(m).padStart(2, '0')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
