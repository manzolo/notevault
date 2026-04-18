'use client';

import { forwardRef, useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import { CalendarIcon } from './Icons';

interface Props {
  value: string | null;
  onChange: (iso: string | null) => void;
  placeholder?: string;
  triggerClassName?: string;
  /** Show just a calendar icon when no date is set (task-row style) */
  iconOnly?: boolean;
  disabled?: boolean;
}

interface TriggerProps {
  value?: string;
  onClick?: () => void;
  triggerClassName?: string;
  iconOnly?: boolean;
  placeholder?: string;
  hasValue?: boolean;
  disabled?: boolean;
}

const Trigger = forwardRef<HTMLButtonElement, TriggerProps>(
  ({ value, onClick, triggerClassName, iconOnly, placeholder, hasValue, disabled }, ref) => {
    if (!hasValue && iconOnly) {
      return (
        <button
          ref={ref}
          type="button"
          onClick={onClick}
          title={placeholder}
          className={triggerClassName}
          disabled={disabled}
        >
          <CalendarIcon className="h-3.5 w-3.5" />
        </button>
      );
    }
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        className={triggerClassName}
        disabled={disabled}
      >
        {value || <span className="opacity-60">{placeholder ?? 'Seleziona data…'}</span>}
      </button>
    );
  },
);
Trigger.displayName = 'DateTimePickerTrigger';

// Custom time input using the native <input type="time"> so the browser handles
// hour→minute focus progression natively, avoiding the focus-jump bug in the
// default react-datepicker time input.
const NativeTimeInput = forwardRef<HTMLInputElement, { value?: string; onChange?: (v: string) => void }>(
  ({ value, onChange }, ref) => {
    const [localValue, setLocalValue] = useState(value ?? '');

    useEffect(() => {
      setLocalValue(value ?? '');
    }, [value]);

    return (
      <input
        ref={ref}
        type="time"
        value={localValue}
        onChange={(e) => {
          const newVal = e.target.value;
          setLocalValue(newVal);
          // Propagate immediately so the time is captured before the popup closes
          onChange?.(newVal);
        }}
        onBlur={(e) => {
          // Safety net: in case onChange was not called (some browsers)
          if (e.target.value !== (value ?? '')) onChange?.(e.target.value);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') onChange?.(e.currentTarget.value);
        }}
        onKeyUp={(e) => e.stopPropagation()}
        onKeyPress={(e) => e.stopPropagation()}
        className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
    );
  }
);
NativeTimeInput.displayName = 'NativeTimeInput';

export default function DateTimePicker({
  value,
  onChange,
  placeholder,
  triggerClassName,
  iconOnly = false,
  disabled = false,
}: Props) {
  const selected = value ? new Date(value) : null;

  return (
    <div className="nv-dp flex items-center gap-0.5">
      <DatePicker
        selected={selected}
        onChange={(date) => onChange(date ? date.toISOString() : null)}
        showTimeInput
        timeInputLabel=""
        customTimeInput={<NativeTimeInput />}
        timeFormat="HH:mm"
        dateFormat="dd/MM/yyyy HH:mm"
        placeholderText={placeholder}
        popperPlacement="bottom-end"
        customInput={
          <Trigger
            triggerClassName={triggerClassName}
            iconOnly={iconOnly}
            placeholder={placeholder}
            hasValue={!!selected}
            disabled={disabled}
          />
        }
        disabled={disabled}
      />
      {selected && !disabled && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-gray-300 hover:text-red-400 dark:text-gray-600 dark:hover:text-red-400 transition-colors leading-none"
          title="Rimuovi data"
        >
          ×
        </button>
      )}
    </div>
  );
}
