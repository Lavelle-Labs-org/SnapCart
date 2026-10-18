/**
 * Santim-Birr Currency Conversion & Formatting Utilities (CLEANUP-002, FR-7)
 * All monetary amounts in database & APIs are stored as integer Santim (1 Birr = 100 Santim).
 */

export interface FormatBirrOptions {
  suffix?: string;
}

/**
 * Converts Birr (decimal or integer) to integer Santim.
 * Uses Math.round to prevent floating point inaccuracies.
 * E.g. toSantim(350) -> 35000, toSantim(19.99) -> 1999.
 */
export function toSantim(birr: number): number {
  if (typeof birr !== "number" || Number.isNaN(birr) || !Number.isFinite(birr)) {
    throw new Error(`Invalid monetary amount: ${birr}`);
  }
  return Math.round(Number((birr * 100).toFixed(6)));
}

/**
 * Converts integer Santim to Birr (decimal or integer).
 * E.g. toBirr(35000) -> 350, toBirr(1999) -> 19.99.
 */
export function toBirr(santim: number): number {
  if (typeof santim !== "number" || Number.isNaN(santim) || !Number.isFinite(santim)) {
    throw new Error(`Invalid santim amount: ${santim}`);
  }
  return santim / 100;
}

/**
 * Formats integer Santim to standard display string.
 * E.g. formatBirr(35050) -> "350.50 ETB".
 */
export function formatBirr(santim: number, options?: FormatBirrOptions): string {
  if (typeof santim !== "number" || Number.isNaN(santim) || !Number.isFinite(santim)) {
    throw new Error(`Invalid santim amount: ${santim}`);
  }
  const birrValue = (santim / 100).toFixed(2);
  const suffix = options?.suffix !== undefined ? options.suffix : " ETB";
  return `${birrValue}${suffix}`;
}
