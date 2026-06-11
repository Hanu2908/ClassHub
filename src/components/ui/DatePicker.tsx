import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface DatePickerProps {
  value?: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Select date...',
  disabled = false,
  minDate,
  maxDate,
  className = '',
}: DatePickerProps) {
  const [open, setOpen] = useState(false);

  // Parse YYYY-MM-DD string safely as a local date (prevents timezone offset bugs)
  const parseValue = (val?: string) => {
    if (!val) return undefined;
    const parts = val.split('-');
    if (parts.length !== 3) return undefined;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed
    const day = parseInt(parts[2], 10);
    const date = new Date(year, month, day);
    return !isNaN(date.getTime()) ? date : undefined;
  };

  const selectedDate = parseValue(value);


  // Format selected date for display
  const displayValue = selectedDate
    ? selectedDate.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      // Format as YYYY-MM-DD in local time
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      onChange(`${year}-${month}-${day}`);
      setOpen(false);
    }
  };

  // Build disabled days array/matcher
  const disabledDays = [];
  if (minDate) {
    const min = new Date(minDate);
    min.setHours(0, 0, 0, 0);
    disabledDays.push({ before: min });
  }
  if (maxDate) {
    const max = new Date(maxDate);
    max.setHours(23, 59, 59, 999);
    disabledDays.push({ after: max });
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={`datepicker-trigger ${className}`}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <CalendarIcon size={16} className="datepicker-icon" />
          <span className={`datepicker-text ${!displayValue ? 'placeholder' : ''}`}>
            {displayValue || placeholder}
          </span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={8}
          className="datepicker-popover-content animate-slide-up"
        >
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            disabled={disabledDays.length > 0 ? disabledDays : undefined}
            classNames={{
              root: 'rdp-custom-root',
              months: 'rdp-custom-months',
              month: 'rdp-custom-month',
              month_caption: 'rdp-custom-caption',
              caption_label: 'rdp-custom-caption-label',
              nav: 'rdp-custom-nav',
              button_previous: 'rdp-custom-nav-btn rdp-custom-nav-btn-prev',
              button_next: 'rdp-custom-nav-btn rdp-custom-nav-btn-next',
              month_grid: 'rdp-custom-grid',
              weekdays: 'rdp-custom-weekdays',
              weekday: 'rdp-custom-weekday',
              weeks: 'rdp-custom-tbody',
              week: 'rdp-custom-week',
              day: 'rdp-custom-day',
              day_button: 'rdp-custom-day-button',
              selected: 'rdp-custom-day-selected',
              today: 'rdp-custom-day-today',
              outside: 'rdp-custom-day-outside',
              disabled: 'rdp-custom-day-disabled',
              hidden: 'rdp-custom-day-hidden',
            }}
            components={{
              Chevron: ({ ...props }) => {
                if (props.orientation === 'left') {
                  return <ChevronLeft size={16} />;
                }
                return <ChevronRight size={16} />;
              }
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
