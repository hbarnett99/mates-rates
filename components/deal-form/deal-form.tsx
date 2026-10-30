'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { CATEGORY_LABEL } from '@/components/category';
import { WEEKDAYS_MONDAY_FIRST } from '@/lib/dates';
import { validateDealInput, type DealInput } from '@/lib/deals/input';
import type { Deal } from '@/lib/deals/types';
import { formatPrice, parsePriceToCents, toTimeInput } from '@/lib/format';
import type { DealCategory, VenueRow } from '@/lib/db/types';
import { applyTagRules, TAGS, tagsFromText, type Tag } from '@/lib/tags/rules';
import { choiceFromVenue, VenueSearch, type VenueChoice } from './venue-search';

const DAY_LETTERS: Record<number, string> = { 0: 'S', 1: 'M', 2: 'T', 3: 'W', 4: 'T', 5: 'F', 6: 'S' };
const DAY_NAMES: Record<number, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};
const CATEGORIES: DealCategory[] = ['food', 'drink', 'both'];

type Props = {
  /** The deal being edited, or null to add one. */
  deal: Deal | null;
  venues: VenueRow[];
  bounds: google.maps.LatLngBoundsLiteral | null;
  /** Weekday preselected for a new deal: the date being viewed. */
  defaultDay: number;
  onSubmit: (input: DealInput, venue: VenueChoice) => void;
  onCancel: () => void;
};

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">
        {label}
        {hint && <span className="ml-1 font-normal text-muted">{hint}</span>}
      </legend>
      {children}
    </fieldset>
  );
}

const inputClass =
  'min-h-12 w-full rounded-xl bg-raised px-4 placeholder:text-muted focus:ring-2 focus:ring-accent focus:outline-none';

export function DealForm({ deal, venues, bounds, defaultDay, onSubmit, onCancel }: Props) {
  const [venue, setVenue] = useState<VenueChoice | null>(deal ? choiceFromVenue(deal.venue) : null);
  const [title, setTitle] = useState(deal?.title ?? '');
  const [price, setPrice] = useState(deal ? formatPrice(deal.price_cents).slice(1) : '');
  const [days, setDays] = useState<Set<number>>(new Set(deal?.days ?? [defaultDay]));
  const [startTime, setStartTime] = useState(toTimeInput(deal?.start_time ?? null));
  const [endTime, setEndTime] = useState(toTimeInput(deal?.end_time ?? null));
  const [category, setCategory] = useState<DealCategory>(deal?.category ?? 'food');
  const [notes, setNotes] = useState(deal?.notes ?? '');
  const [showDates, setShowDates] = useState(Boolean(deal?.valid_from || deal?.valid_until));
  const [validFrom, setValidFrom] = useState(deal?.valid_from ?? '');
  const [validUntil, setValidUntil] = useState(deal?.valid_until ?? '');
  // Tags picked by hand, and keyword-rule tags the person untapped. When
  // editing, a rule tag missing from the saved deal was untapped before.
  const [manualTags, setManualTags] = useState<Set<string>>(new Set(deal?.tags ?? []));
  const [dismissed, setDismissed] = useState<Set<string>>(
    new Set(deal ? tagsFromText(deal.title, deal.notes).filter((t) => !deal.tags.includes(t)) : []),
  );
  const [error, setError] = useState<string | null>(null);

  const ruleTags = new Set<string>(tagsFromText(title, notes || null));
  const selectedTags = new Set<Tag>(
    applyTagRules({ title, notes: notes || null, tags: [...manualTags], dismissed: [...dismissed] }),
  );

  function toggleDay(day: number) {
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  function toggleTag(tag: Tag) {
    const on = selectedTags.has(tag);
    setManualTags((prev) => {
      const next = new Set(prev);
      if (on) next.delete(tag);
      else next.add(tag);
      return next;
    });
    setDismissed((prev) => {
      const next = new Set(prev);
      if (on && ruleTags.has(tag)) next.add(tag);
      else next.delete(tag);
      return next;
    });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!venue) {
      setError('Pick a venue, or drop a pin.');
      return;
    }
    const priceCents = parsePriceToCents(price);
    if (priceCents === null) {
      setError('Enter a price, like 35 or 12.50.');
      return;
    }
    const result = validateDealInput({
      venue: venue.input,
      title,
      priceCents,
      category,
      days: [...days],
      startTime: startTime || null,
      endTime: endTime || null,
      validFrom: showDates ? validFrom || null : null,
      validUntil: showDates ? validUntil || null : null,
      notes,
      tags: [...manualTags],
      dismissedTags: [...dismissed],
    } satisfies Record<keyof DealInput, unknown>);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSubmit(result.value, venue);
  }

  return (
    <form onSubmit={submit} className="flex h-full flex-col" noValidate>
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] lg:pt-3">
        <button type="button" onClick={onCancel} className="min-h-11 px-2 text-muted hover:text-text">
          Cancel
        </button>
        <h2 className="font-semibold">{deal ? 'Edit deal' : 'Add a deal'}</h2>
        <button type="submit" className="min-h-11 rounded-full bg-accent px-5 font-semibold text-pin-text">
          Save
        </button>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        {error && (
          <p role="alert" className="rounded-xl bg-danger/15 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        <Field label="Venue">
          <VenueSearch venues={venues} bounds={bounds} value={venue} onChange={setVenue} autoFocus={!deal} />
        </Field>

        <Field label="Deal">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Parma + pot"
            aria-label="Deal title"
            maxLength={120}
            enterKeyHint="next"
            className={inputClass}
          />
        </Field>

        <Field label="Price">
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted">$</span>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              placeholder="28"
              aria-label="Price in dollars"
              className={`${inputClass} pl-8`}
            />
          </div>
        </Field>

        <Field label="Days">
          <div className="flex justify-between gap-1.5">
            {WEEKDAYS_MONDAY_FIRST.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                aria-pressed={days.has(day)}
                aria-label={DAY_NAMES[day]}
                className={`flex size-11 items-center justify-center rounded-full font-semibold transition-colors ${
                  days.has(day) ? 'bg-accent text-pin-text' : 'bg-raised text-muted hover:bg-line'
                }`}
              >
                {DAY_LETTERS[day]}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Time" hint="(optional, leave blank for all day)">
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              aria-label="Start time"
              className={inputClass}
            />
            <span className="text-muted">to</span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              aria-label="End time"
              className={inputClass}
            />
          </div>
        </Field>

        <Field label="Category">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-raised p-1">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
                className={`min-h-11 rounded-lg text-sm font-medium ${category === c ? 'bg-line text-text' : 'text-muted'}`}
              >
                {CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Notes" hint="(optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Mains only, book ahead…"
            aria-label="Notes"
            className={`${inputClass} py-3`}
          />
        </Field>

        <Field label="Tags" hint="(some are added from the title and notes)">
          <div className="flex flex-wrap gap-2">
            {TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                aria-pressed={selectedTags.has(tag)}
                className={`min-h-9 rounded-full px-3 text-sm transition-colors ${
                  selectedTags.has(tag) ? 'bg-text text-bg' : 'bg-raised text-muted hover:bg-line'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </Field>

        <div className="space-y-3">
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={showDates}
              onChange={(e) => setShowDates(e.target.checked)}
              className="size-5 accent-accent"
            />
            Only runs between certain dates
          </label>
          {showDates && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                  aria-label="From"
                  className={inputClass}
                />
                <span className="text-muted">to</span>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  aria-label="Until"
                  className={inputClass}
                />
              </div>
              <p className="text-xs text-muted">Leave either side blank for open-ended. A one-off is the same date twice.</p>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
