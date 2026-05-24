'use strict';

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

const HOURLY_PARAMS = [
  'temperature_2m',
  'precipitation',
  'wind_speed_10m',
  'wind_gusts_10m',
  'relative_humidity_2m',
  'cloud_cover',
].join(',');

const DAILY_PARAMS = [
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'wind_speed_10m_max',
  'wind_gusts_10m_max',
].join(',');

// Exponential backoff: 1s, 3s, 9s. Three retries, worst case ~13s total wait.
const RETRY_DELAYS_MS = [1000, 3000, 9000];

// Per-attempt timeout. Node's native fetch does not have a default timeout.
const FETCH_TIMEOUT_MS = 10_000;

// TODO(post-1.0): move retry orchestration to app.js where this.homey.setTimeout
// provides lifecycle-tracked timers. The native setTimeout below works because
// each wait is bounded (max 9s) and the loop awaits sequentially, but on
// teardown during a retry the timer would dangle for that bounded period.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWeather(latitude, longitude) {
  const url = new URL(BASE_URL);
  url.searchParams.set('latitude', latitude.toFixed(4));
  url.searchParams.set('longitude', longitude.toFixed(4));
  url.searchParams.set('hourly', HOURLY_PARAMS);
  url.searchParams.set('daily', DAILY_PARAMS);
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '7');
  url.searchParams.set('wind_speed_unit', 'kmh');

  let lastError = null;

  // First attempt plus retries: 1 + RETRY_DELAYS_MS.length attempts in total.
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url.toString(), { signal: ctrl.signal });
      if (!response.ok) {
        // 4xx responses are permanent. Do not retry.
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`Open-Meteo client error ${response.status}: ${response.statusText}`);
        }
        throw new Error(`Open-Meteo returned ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (err) {
      lastError = err;
      // Permanent client errors propagate immediately without further retries.
      if (err.message?.includes('client error')) throw err;
      // An AbortError originates from our own timeout and counts as transient.
      // Wait before the next attempt, only while retries remain.
      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new Error('Open-Meteo fetch failed after all retries');
}

module.exports = { fetchWeather };
