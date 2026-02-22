'use client';

import * as React from 'react';
import { DayPicker } from 'react-day-picker';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, ...props }: CalendarProps) {
  return (
    <DayPicker
      className={cn('p-3', className)}
      classNames={{
        months: 'relative flex flex-col',
        month: 'flex flex-col gap-4',
        month_caption: 'flex items-center justify-center h-10',
        caption_label: 'text-sm font-medium text-on-surface',
        nav: 'absolute top-3 flex w-full items-center justify-between px-1 z-10',
        button_previous: cn(
          'inline-flex h-8 w-8 items-center justify-center rounded-lg',
          'border border-outline-variant bg-surface-container-high text-on-surface-variant',
          'hover:bg-surface-container-highest hover:text-on-surface transition-colors'
        ),
        button_next: cn(
          'inline-flex h-8 w-8 items-center justify-center rounded-lg',
          'border border-outline-variant bg-surface-container-high text-on-surface-variant',
          'hover:bg-surface-container-highest hover:text-on-surface transition-colors'
        ),
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday:
          'text-on-surface-variant w-9 text-center font-normal text-[0.8rem]',
        week: 'flex w-full mt-2',
        day: 'relative p-0 text-center text-sm focus-within:relative focus-within:z-20',
        day_button: cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-lg p-0 font-normal transition-colors',
          'hover:bg-primary/10 hover:text-primary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
        ),
        selected:
          '[&_.rdp-day_button]:bg-primary [&_.rdp-day_button]:text-white [&_.rdp-day_button]:hover:bg-primary [&_.rdp-day_button]:hover:text-white',
        today:
          '[&_.rdp-day_button]:bg-surface-container-highest [&_.rdp-day_button]:text-on-surface [&_.rdp-day_button]:font-semibold',
        outside: '[&_.rdp-day_button]:text-on-surface-variant/40',
        disabled:
          '[&_.rdp-day_button]:text-on-surface-variant/30 [&_.rdp-day_button]:cursor-not-allowed',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left' ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
