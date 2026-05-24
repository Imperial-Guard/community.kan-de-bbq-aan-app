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

// Exponentiële backoff: 1s, 3s, 9s (3 hertries, ongeveer 13s wachttijd in het slechtste geval).
const RETRY_DELAYS_MS = [1000, 3000, 9000];

// Timeout per poging. De native fetch in Node kent geen standaard timeout.
const FETCH_TIMEOUT_MS = 10_000;

// TODO(na 1.0): retry-with-backoff naar app.js verplaatsen, daar levert
// this.homey.setTimeout timers op die meelopen met de app-lifecycle. Deze
// native setTimeout werkt prima omdat elke wachttijd begrensd is (max 9s)
// en de loop sequentieel awaitet, maar bij teardown tijdens een retry
// blijft de timer voor die periode hangen.
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

  // Eerste poging plus hertries: totaal 1 + RETRY_DELAYS_MS.length pogingen.
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url.toString(), { signal: ctrl.signal });
      if (!response.ok) {
        // 4xx-fouten zijn permanent. Niet hertryen.
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`Open-Meteo client error ${response.status}: ${response.statusText}`);
        }
        throw new Error(`Open-Meteo returned ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (err) {
      lastError = err;
      // Bij een permanente fout (4xx) direct doorgooien zonder hertry.
      if (err.message?.includes('client error')) throw err;
      // Een AbortError komt van onze eigen timeout en telt als tijdelijke fout.
      // Wachten voor de volgende poging, alleen zolang er nog hertries over zijn.
      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new Error('Open-Meteo fetch mislukt na alle hertries');
}

module.exports = { fetchWeather };
