'use strict';

/**
 * Bepaal het huidige meteorologisch seizoen voor de copy-bank.
 * @returns {'spring'|'summer'|'autumn'|'winter'}
 */
function currentSeason() {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4)  return 'spring'; // mrt-mei
  if (month >= 5 && month <= 7)  return 'summer'; // jun-aug
  if (month >= 8 && month <= 10) return 'autumn'; // sep-nov
  return 'winter';                                // dec-feb
}

/**
 * Kiest een advieszin uit de bank voor de gegeven status en het huidige seizoen.
 * Slaat de laatst gekozen index over zodat rouleren zichtbaar is.
 *
 * @param {'yes'|'maybe'|'no'} status
 * @param {object} adviceBank Structuur { yes: { summer: [...], spring: [...], ... }, ... }
 *   wordt ingelezen uit locales/{lang}.json, key `advice`.
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
