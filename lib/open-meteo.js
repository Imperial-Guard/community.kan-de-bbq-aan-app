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

// Exponential backoff: 1s, 3s, 9s (3 retries, ~13s totale wachttijd in worst case)
const RETRY_DELAYS_MS = [1000, 3000, 9000];

// Per-attempt fetch timeout — Node's native fetch heeft GEEN default timeout.
const FETCH_TIMEOUT_MS = 10_000;

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

  // Initial attempt + retries (totaal 1 + RETRY_DELAYS_MS.length pogingen)
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url.toString(), { signal: ctrl.signal });
      if (!response.ok) {
        // 4xx fouten zijn permanent — niet retryen
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`Open-Meteo client error ${response.status}: ${response.statusText}`);
        }
        throw new Error(`Open-Meteo returned ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (err) {
      lastError = err;
      // Geen retry bij permanente fouten (4xx)
      if (err.message?.includes('client error')) throw err;
      // AbortError = onze eigen timeout — telt als transient, mag retryen
      // Wacht voor de volgende poging — alleen als we nog retries hebben
      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new Error('Open-Meteo fetch failed after retries');
}

module.exports = { fetchWeather };
