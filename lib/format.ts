/** "$35" for whole dollars, "$12.50" otherwise. */
export function formatPrice(cents: number): string {
  const dollars = Math.floor(cents / 100);
  const rest = cents % 100;
  return rest === 0 ? `$${dollars}` : `$${dollars}.${String(rest).padStart(2, '0')}`;
}

/**
 * Parses what someone typed in the price box ("35", "$12.5", "12.50") into
 * whole cents. Returns null for anything that isn't a non-negative amount
 * with at most two decimal places.
 */
export function parsePriceToCents(input: string): number | null {
  const match = /^\$?\s*(\d{1,5})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  const dollars = Number(match[1]);
  const cents = Number((match[2] ?? '').padEnd(2, '0'));
  return dollars * 100 + cents;
}

/** "17:00:00" or "17:00" -> "5pm"; "17:30" -> "5:30pm". */
export function formatTime(time: string): string {
  const [h = '0', m = '00'] = time.split(':');
  const hours = Number(h);
  const suffix = hours < 12 ? 'am' : 'pm';
  const twelve = hours % 12 === 0 ? 12 : hours % 12;
  return m === '00' ? `${twelve}${suffix}` : `${twelve}:${m}${suffix}`;
}

/** "4pm–7pm", "From 4pm", "Until 7pm", or "All day" when both are null. */
export function formatTimeWindow(start: string | null, end: string | null): string {
  if (start && end) return `${formatTime(start)}–${formatTime(end)}`;
  if (start) return `From ${formatTime(start)}`;
  if (end) return `Until ${formatTime(end)}`;
  return 'All day';
}

/** Postgres "17:00:00" -> "17:00" for an <input type="time">. */
export function toTimeInput(time: string | null): string {
  return time ? time.slice(0, 5) : '';
}

/** "350 m", "1.2 km", "12 km". */
export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.max(10, Math.round(metres / 10) * 10)} m`;
  const km = metres / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}
