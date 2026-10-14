/**
 * Helpers for the date <-> string conversions the EthiopianDatePicker relies on.
 *
 * The picker emits a NAIVE local string ("2026-09-25T09:00") with no timezone
 * offset, and it parses incoming values the same way. Anything that produces a
 * value for the picker must therefore use LOCAL components, not `toISOString()`,
 * which returns UTC and silently shifts the displayed time by the browser's
 * UTC offset.
 *
 * The reverse conversion matters too. A naive string is ambiguous: the backend
 * parses it with `new Date(value)`, which resolves against the SERVER's timezone
 * (observed as America/Los_Angeles in production), not the user's. Sending the
 * offset along makes the instant unambiguous no matter where the server runs.
 */

/** Format a Date as a naive local "YYYY-MM-DDTHH:mm" string for the picker. */
export function toLocalNaive(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/**
 * Convert a picker value into a full ISO instant for the API.
 *
 * `new Date('2026-09-25T09:00')` in the browser resolves as browser-local, which
 * is the same wall-clock the user picked. Serialising that to ISO carries the
 * user's UTC offset, so the backend stores the correct moment instead of one
 * skewed by the server's own timezone. Values that are already offset-bearing,
 * or that are not parseable, are passed through untouched.
 */
export function pickerValueToIso(value) {
  if (!value) return value;
  const str = String(value).trim();
  if (!str) return value;
  // Already carries an offset or is a full instant - leave it alone.
  if (/[Zz]$|[+-]\d{2}:?\d{2}$/.test(str)) return value;
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString();
}
