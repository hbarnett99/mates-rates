'use client';

import { useRef } from 'react';
import { dateChips, longDayLabel } from '@/lib/dates';
import { isIsoDate, type IsoDate } from '@/lib/deals/is-deal-on';

type Props = {
  today: IsoDate;
  selected: IsoDate;
  onSelect: (date: IsoDate) => void;
  className?: string;
};

const chipClass =
  'flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors';

/** Today, Tomorrow, five named days, then a calendar for anything further out. */
export function DateChips({ today, selected, onSelect, className = '' }: Props) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const chips = dateChips(today);
  const inChips = chips.some((c) => c.date === selected);

  function openPicker() {
    const input = pickerRef.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
      input.click();
    }
  }

  return (
    <div className={`no-scrollbar flex gap-2 overflow-x-auto ${className}`} role="group" aria-label="Pick a date">
      {chips.map((chip) => (
        <button
          key={chip.date}
          type="button"
          aria-pressed={chip.date === selected}
          onClick={() => onSelect(chip.date)}
          className={`${chipClass} ${chip.date === selected ? 'bg-accent text-pin-text' : 'bg-raised text-text hover:bg-line'}`}
        >
          {chip.label}
        </button>
      ))}
      {!inChips && (
        <button type="button" aria-pressed="true" onClick={openPicker} className={`${chipClass} bg-accent text-pin-text`}>
          {longDayLabel(selected, today)}
        </button>
      )}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={openPicker}
          aria-label="Pick another date"
          className={`${chipClass} bg-raised px-3 text-text hover:bg-line`}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
        </button>
        <input
          ref={pickerRef}
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          value={selected}
          onChange={(e) => {
            if (isIsoDate(e.target.value)) onSelect(e.target.value);
          }}
          className="pointer-events-none absolute inset-0 opacity-0"
        />
      </div>
    </div>
  );
}
