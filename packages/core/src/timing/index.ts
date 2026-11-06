export interface DailyDuration { date: string; seconds: number }

/** Allocates [start, end) by elapsed milliseconds in each local calendar date.
 * UTC is the deterministic default. No system clock or host timezone is consulted.
 */
export function splitDurationAcrossMidnight(
  startTimeMs: number, endTimeMs: number, effectiveSeconds: number, timeZone = 'UTC',
): DailyDuration[] {
  if (![startTimeMs, endTimeMs, effectiveSeconds].every(Number.isFinite) ||
      Math.abs(startTimeMs) > 8.64e15 || Math.abs(endTimeMs) > 8.64e15 ||
      endTimeMs < startTimeMs || effectiveSeconds < 0 || (endTimeMs === startTimeMs && effectiveSeconds > 0)) {
    throw new RangeError('Expected valid timestamps, an ordered interval and nonnegative effective seconds');
  }
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', calendar: 'iso8601', numberingSystem: 'latn',
  });
  const dateAt = (ms: number): string => {
    const parts = formatter.formatToParts(ms);
    const get = (type: string) => parts.find(part => part.type === type)!.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  };
  const result: DailyDuration[] = [];
  let cursor = startTimeMs;
  let allocated = 0;
  if (effectiveSeconds === 0) return result;
  while (cursor < endTimeMs) {
    const date = dateAt(cursor);
    // Bracket a date transition in hourly steps, then find its exact millisecond.
    // Calendar-aware formatting handles DST, fractional offsets and skipped dates.
    let low = cursor;
    let high = Math.min(cursor + 3600000, endTimeMs);
    while (high < endTimeMs && dateAt(high) === date) {
      low = high;
      high = Math.min(high + 3600000, endTimeMs);
    }
    if (dateAt(high) !== date) {
      while (high - low > 1) {
        const middle = Math.floor((low + high) / 2);
        if (dateAt(middle) === date) low = middle;
        else high = middle;
      }
    }
    const seconds = high === endTimeMs ? effectiveSeconds - allocated :
      effectiveSeconds * ((high - cursor) / (endTimeMs - startTimeMs));
    result.push({ date, seconds });
    allocated += seconds;
    cursor = high;
  }
  return result;
}
