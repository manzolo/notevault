'use client';

import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import DatePicker, { ReactDatePickerCustomHeaderProps } from 'react-datepicker';
import { useLocale, useTranslations } from 'next-intl';
import { CalendarIcon } from './Icons';

// Tracks whether the user is actively clicking a calendar day/nav button.
// Module-level is fine: only one popup is ever open at a time.
const _calendarInteraction = { current: false };

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

const NativeTimeInput = forwardRef<HTMLInputElement, { value?: string; onChange?: (v: string) => void }>(
  ({ value, onChange }, fwdRef) => {
    const [localValue, setLocalValue] = useState(value ?? '');
    const ownRef = useRef<HTMLInputElement>(null);

    // Merge the forwarded ref (react-datepicker) with our own so we can call .focus()
    const setRef = useCallback((node: HTMLInputElement | null) => {
      (ownRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
      if (typeof fwdRef === 'function') fwdRef(node);
      else if (fwdRef) (fwdRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
    }, [fwdRef]);

    useEffect(() => { setLocalValue(value ?? ''); }, [value]);

    return (
      <input
        ref={setRef}
        type="time"
        value={localValue}
        onChange={(e) => {
          const newVal = e.target.value;
          setLocalValue(newVal);
          onChange?.(newVal);
          // After onChange triggers a react-datepicker re-render, Calendar.componentDidUpdate
          // may call .focus() imperatively on the selected day. Detect and undo it.
          requestAnimationFrame(() => {
            if (_calendarInteraction.current) return;
            const active = document.activeElement as HTMLElement | null;
            if (active && active !== ownRef.current && active.closest('.react-datepicker__month')) {
              ownRef.current?.focus();
            }
          });
        }}
        onBlur={(e) => {
          if (e.target.value !== (value ?? '')) onChange?.(e.target.value);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          e.nativeEvent.stopImmediatePropagation();
          if (e.key === 'Enter') onChange?.(e.currentTarget.value);
        }}
        onKeyUp={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
        onKeyPress={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
        className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
    );
  }
);
NativeTimeInput.displayName = 'NativeTimeInput';

function PickerHeader({
  date,
  decreaseMonth,
  increaseMonth,
  prevMonthButtonDisabled,
  nextMonthButtonDisabled,
  changeMonth,
  changeYear,
  locale,
  todayLabel,
}: ReactDatePickerCustomHeaderProps & {
  locale: string;
  todayLabel: string;
}) {
  const today = new Date();
  const isCurrentMonth =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth();

  return (
    <div>
      <div className="flex items-center justify-between px-2 pt-2">
        <button
          type="button"
          onClick={decreaseMonth}
          disabled={prevMonthButtonDisabled}
          className="react-datepicker__navigation react-datepicker__navigation--previous static translate-x-0 translate-y-0 border-none bg-transparent p-0 disabled:opacity-40"
          aria-label="Previous month"
        >
          <span className="react-datepicker__navigation-icon react-datepicker__navigation-icon--previous">
            Previous month
          </span>
        </button>
        <h2 className="react-datepicker__current-month">
          {new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date)}
        </h2>
        <button
          type="button"
          onClick={increaseMonth}
          disabled={nextMonthButtonDisabled}
          className="react-datepicker__navigation react-datepicker__navigation--next static translate-x-0 translate-y-0 border-none bg-transparent p-0 disabled:opacity-40"
          aria-label="Next month"
        >
          <span className="react-datepicker__navigation-icon react-datepicker__navigation-icon--next">
            Next month
          </span>
        </button>
      </div>
      <div className="px-2 pb-2 pt-1 text-center">
        <button
          type="button"
          onClick={() => {
            changeYear(today.getFullYear());
            changeMonth(today.getMonth());
          }}
          disabled={isCurrentMonth}
          className="text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-700 disabled:cursor-default disabled:text-gray-400 dark:text-indigo-300 dark:hover:text-indigo-200 dark:disabled:text-gray-500"
        >
          {todayLabel}
        </button>
      </div>
    </div>
  );
}

export default function DateTimePicker({
  value,
  onChange,
  placeholder,
  triggerClassName,
  iconOnly = false,
  disabled = false,
}: Props) {
  const tc = useTranslations('common');
  const locale = useLocale();
  const selected = value ? new Date(value) : null;

  return (
    <div
      className="nv-dp flex items-center gap-0.5"
      onMouseDownCapture={(e) => {
        // When the user intentionally clicks a calendar day or nav button, suppress
        // focus restoration so their click is not overridden.
        if ((e.target as HTMLElement).closest('.react-datepicker__day, .react-datepicker__navigation')) {
          _calendarInteraction.current = true;
          requestAnimationFrame(() => { _calendarInteraction.current = false; });
        }
      }}
    >
      <DatePicker
        selected={selected}
        onChange={(date) => onChange(date ? date.toISOString() : null)}
        showTimeInput
        timeInputLabel=""
        customTimeInput={<NativeTimeInput />}
        timeFormat="HH:mm"
        dateFormat="dd/MM/yyyy HH:mm"
        placeholderText={placeholder}
        fixedHeight
        popperPlacement="bottom-end"
        renderCustomHeader={(props) => (
          <PickerHeader
            {...props}
            locale={locale}
            todayLabel={tc('today')}
          />
        )}
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
