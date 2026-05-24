'use strict';

/**
 * Returns the current meteorological season for the advice bank lookup.
 * @returns {'spring'|'summer'|'autumn'|'winter'}
 */
function currentSeason() {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4)  return 'spring'; // March-May
  if (month >= 5 && month <= 7)  return 'summer'; // June-August
  if (month >= 8 && month <= 10) return 'autumn'; // September-November
  return 'winter';                                // December-February
}

/**
 * Picks an advice string from the bank for the given status and current season.
 * Skips the previously chosen index so rotation is visible to the user.
 *
 * @param {'yes'|'maybe'|'no'} status
 * @param {object} adviceBank Shape: { yes: { summer: [...], spring: [...], ... }, ... }.
 *   Loaded from locales/{lang}.json under the `advice` key.
 * @param {number} lastIndex
 * @returns {{ advice: string, index: number }}
 */
function pickAdvice(status, adviceBank, lastIndex = -1) {
  const bank = adviceBank?.[status]?.[currentSeason()];
  if (!Array.isArray(bank) || bank.length === 0) {
    return { advice: '', index: -1 };
  }
  let idx = Math.floor(Math.random() * bank.length);
  if (bank.length > 1 && idx === lastIndex) {
    idx = (idx + 1) % bank.length;
  }
  return { advice: bank[idx], index: idx };
}

module.exports = { pickAdvice, currentSeason };
