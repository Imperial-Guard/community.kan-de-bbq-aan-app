'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { analyzeDay, analyzeWeek } = require('../lib/bbq-algorithm');

// ============ Helper: build a minimal Open-Meteo response ============
function buildWeather(targetDate, perHour) {
  // perHour: { temperature_2m, precipitation, wind_speed_10m, wind_gusts_10m, relative_humidity_2m, cloud_cover }
  // Generates 24 hours of data for targetDate, using the same values for every
  // hour unless explicitly overridden.
  const dateStr = targetDate.toISOString().slice(0, 10);
  const hourly = {
    time: [],
    temperature_2m: [],
    precipitation: [],
    wind_speed_10m: [],
    wind_gusts_10m: [],
    relative_humidity_2m: [],
    cloud_cover: [],
  };
  for (let h = 0; h < 24; h++) {
    hourly.time.push(`${dateStr}T${String(h).padStart(2, '0')}:00`);
    hourly.temperature_2m.push(perHour.temperature_2m ?? 20);
    hourly.precipitation.push(perHour.precipitation ?? 0);
    hourly.wind_speed_10m.push(perHour.wind_speed_10m ?? 10);
    hourly.wind_gusts_10m.push(perHour.wind_gusts_10m ?? 15);
    hourly.relative_humidity_2m.push(perHour.relative_humidity_2m ?? 60);
    hourly.cloud_cover.push(perHour.cloud_cover ?? 30);
  }
  return { hourly };
}

// ============ analyzeDay: verdict thresholds ============
test('analyzeDay: perfect BBQ weather yields yes with a high score', () => {
  const w = buildWeather(new Date('2026-06-15'), {
    temperature_2m: 22,
    precipitation: 0,
    wind_speed_10m: 8,
    wind_gusts_10m: 12,
    relative_humidity_2m: 50,
    cloud_cover: 20,
  });
  const r = analyzeDay(w, new Date('2026-06-15'));
  assert.equal(r.status, 'yes');
  assert.ok(r.score >= 90, `expected >= 90, got ${r.score}`);
  assert.equal(r.knockOuts.tooCold, false);
  assert.equal(r.knockOuts.tooWet, false);
  assert.equal(r.knockOuts.tooWindy, false);
});

test('analyzeDay: borderline weather yields maybe', () => {
  // precipitation 0.3/h * 5 evening hours = 1.5 mm total, below the 2 mm knockout threshold.
  const w = buildWeather(new Date('2026-04-15'), {
    temperature_2m: 13,
    precipitation: 0.3,
    wind_speed_10m: 20,
    wind_gusts_10m: 28,
    relative_humidity_2m: 75,
    cloud_cover: 70,
  });
  const r = analyzeDay(w, new Date('2026-04-15'));
  assert.equal(r.knockOuts.tooWet, false, 'rain should not knockout');
  assert.equal(r.status, 'maybe');
  assert.ok(r.score >= 45 && r.score < 75, `expected 45-74, got ${r.score}`);
});

test('analyzeDay: bad day yields no', () => {
  const w = buildWeather(new Date('2026-11-15'), {
    temperature_2m: 6,
    precipitation: 3,
    wind_speed_10m: 30,
    wind_gusts_10m: 50,
    relative_humidity_2m: 92,
    cloud_cover: 95,
  });
  const r = analyzeDay(w, new Date('2026-11-15'));
  assert.equal(r.status, 'no');
  assert.ok(r.score < 45, `expected < 45, got ${r.score}`);
});

// ============ Knockouts ============
test('knockout tooCold: temp below 10 caps score at 40', () => {
  const w = buildWeather(new Date('2026-03-15'), {
    temperature_2m: 8,
    precipitation: 0,
    wind_speed_10m: 5,
  });
  const r = analyzeDay(w, new Date('2026-03-15'));
  assert.equal(r.knockOuts.tooCold, true);
  assert.ok(r.score <= 40, `expected <= 40, got ${r.score}`);
});

test('knockout tooWet: rain above 2 mm caps score at 40', () => {
  const w = buildWeather(new Date('2026-06-15'), {
    temperature_2m: 22,
    precipitation: 0.5, // 0.5 * 5 evening hours = 2.5 mm total, above the 2 mm threshold.
    wind_speed_10m: 5,
  });
  const r = analyzeDay(w, new Date('2026-06-15'));
  assert.equal(r.knockOuts.tooWet, true);
  assert.ok(r.score <= 40, `expected <= 40, got ${r.score}`);
});

test('knockout tooWindy: gusts above 65 km/h cap score at 40', () => {
  const w = buildWeather(new Date('2026-06-15'), {
    temperature_2m: 22,
    precipitation: 0,
    wind_gusts_10m: 70,
  });
  const r = analyzeDay(w, new Date('2026-06-15'));
  assert.equal(r.knockOuts.tooWindy, true);
  assert.ok(r.score <= 40, `expected <= 40, got ${r.score}`);
});

// ============ Score smoothness ============
test('analyzeDay: 25 degrees sits at the peak of the temperature curve', () => {
  const w25 = buildWeather(new Date('2026-06-15'), {
    temperature_2m: 25, precipitation: 0, wind_speed_10m: 5,
  });
  const w22 = buildWeather(new Date('2026-06-15'), {
    temperature_2m: 22, precipitation: 0, wind_speed_10m: 5,
  });
  const r25 = analyzeDay(w25, new Date('2026-06-15'));
  const r22 = analyzeDay(w22, new Date('2026-06-15'));
  // Both temperatures should map to tempScore 100, so the overall score is equal.
  assert.equal(r25.score, r22.score);
});

test('analyzeDay: higher wind lowers the score even without a knockout', () => {
  const calm = buildWeather(new Date('2026-06-15'), {
    temperature_2m: 22, precipitation: 0, wind_speed_10m: 5, wind_gusts_10m: 10,
  });
  const breezy = buildWeather(new Date('2026-06-15'), {
    temperature_2m: 22, precipitation: 0, wind_speed_10m: 28, wind_gusts_10m: 40,
  });
  const r1 = analyzeDay(calm, new Date('2026-06-15'));
  const r2 = analyzeDay(breezy, new Date('2026-06-15'));
  assert.ok(r2.score < r1.score, `breezy ${r2.score} should be < calm ${r1.score}`);
});

// ============ Edge cases ============
test('analyzeDay: returns null when no evening data is available', () => {
  // Only morning hours present, so the evening window has nothing to analyse.
  const w = {
    hourly: {
      time: ['2026-06-15T05:00', '2026-06-15T08:00', '2026-06-15T10:00'],
      temperature_2m: [15, 18, 20],
      precipitation: [0, 0, 0],
      wind_speed_10m: [5, 5, 5],
      wind_gusts_10m: [10, 10, 10],
      relative_humidity_2m: [60, 60, 60],
      cloud_cover: [30, 30, 30],
    },
  };
  const r = analyzeDay(w, new Date('2026-06-15'));
  assert.equal(r, null);
});

test('analyzeDay: only the 17:00-21:00 window is analysed, never midday', () => {
  // Midday is extremely hot (35) and evening is 22. The algorithm should pick
  // up the evening, not the midday.
  const dateStr = '2026-07-15';
  const hourly = {
    time: [], temperature_2m: [], precipitation: [], wind_speed_10m: [],
    wind_gusts_10m: [], relative_humidity_2m: [], cloud_cover: [],
  };
  for (let h = 0; h < 24; h++) {
    hourly.time.push(`${dateStr}T${String(h).padStart(2, '0')}:00`);
    hourly.temperature_2m.push(h >= 17 && h <= 21 ? 22 : 35);
    hourly.precipitation.push(0);
    hourly.wind_speed_10m.push(5);
    hourly.wind_gusts_10m.push(10);
    hourly.relative_humidity_2m.push(60);
    hourly.cloud_cover.push(20);
  }
  const r = analyzeDay({ hourly }, new Date('2026-07-15'));
  // 22 degrees sits in the peak temperature zone (15-25), so tempScore is 100.
  assert.equal(r.status, 'yes');
  assert.ok(r.conditions.temperature >= 21 && r.conditions.temperature <= 23);
});

// ============ analyzeWeek ============
test('analyzeWeek: returns 7 days when data is available', () => {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const hourly = {
    time: [], temperature_2m: [], precipitation: [], wind_speed_10m: [],
    wind_gusts_10m: [], relative_humidity_2m: [], cloud_cover: [],
  };
  // Generate seven days of data, starting from today.
  for (let day = 0; day < 7; day++) {
    const d = new Date(today);
    d.setDate(today.getDate() + day);
    const dStr = d.toISOString().slice(0, 10);
    for (let h = 0; h < 24; h++) {
      hourly.time.push(`${dStr}T${String(h).padStart(2, '0')}:00`);
      hourly.temperature_2m.push(20);
      hourly.precipitation.push(0);
      hourly.wind_speed_10m.push(5);
      hourly.wind_gusts_10m.push(10);
      hourly.relative_humidity_2m.push(60);
      hourly.cloud_cover.push(30);
    }
  }
  const week = analyzeWeek({ hourly });
  assert.equal(week.length, 7);
  assert.ok(week[0].date === todayStr);
  for (const day of week) {
    assert.ok(['yes', 'maybe', 'no'].includes(day.status));
    assert.ok(typeof day.score === 'number');
  }
});

// ============ Score range guard ============
test('analyzeDay: score is always within the 0-100 range', () => {
  const cases = [
    { temperature_2m: -5, precipitation: 5, wind_gusts_10m: 80 }, // worst case
    { temperature_2m: 22, precipitation: 0, wind_speed_10m: 5 },  // best case
    { temperature_2m: 40, precipitation: 1, wind_speed_10m: 30 }, // mixed
  ];
  for (const c of cases) {
    const w = buildWeather(new Date('2026-06-15'), c);
    const r = analyzeDay(w, new Date('2026-06-15'));
    assert.ok(r.score >= 0 && r.score <= 100, `score out of range: ${r.score} for ${JSON.stringify(c)}`);
  }
});
