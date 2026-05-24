'use strict';

function tempScore(t) {
  if (t < 10) return 0;
  if (t < 15) return 30 + (t - 10) * 8;
  if (t < 18) return 70 + (t - 15) * 10;
  if (t <= 25) return 100;
  if (t <= 30) return 100 - (t - 25) * 4;
  return 80;
}

function rainScore(mm) {
  if (mm > 2) return 0;
  if (mm > 1) return 30;
  if (mm > 0.5) return 70;
  return 100;
}

function windScore(speed, gusts) {
  if (gusts > 65) return 0;
  if (gusts > 45) return 20;
  if (speed > 45 || gusts > 35) return 40;
  if (speed > 25) return 60;
  if (speed > 15) return 80;
  return 100;
}

function humidityScore(h) {
  if (h > 90) return 20;
  if (h > 85) return 50;
  if (h > 75) return 75;
  if (h >= 30) return 100;
  return 85;
}

function cloudScore(c) {
  if (c > 75) return 60;
  if (c > 50) return 75;
  if (c > 25) return 90;
  return 100;
}

const WEIGHTS = { temp: 0.30, rain: 0.25, wind: 0.20, humidity: 0.15, cloud: 0.10 };
const EVENING_HOURS = [17, 18, 19, 20, 21];

function analyzeDay(weather, date) {
  const targetDateStr = date.toISOString().slice(0, 10);
  const hours = weather.hourly.time;
  const indices = hours.reduce((acc, timeStr, i) => {
    if (timeStr.startsWith(targetDateStr)) {
      const hour = parseInt(timeStr.slice(11, 13), 10);
      if (EVENING_HOURS.includes(hour)) acc.push(i);
    }
    return acc;
  }, []);

  if (indices.length === 0) {
    return null;
  }

  const pick = (key, fn) => fn(indices.map(i => weather.hourly[key][i]));
  const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  const max = arr => Math.max(...arr);
  const sum = arr => arr.reduce((a, b) => a + b, 0);

  const conditions = {
    temperature:  pick('temperature_2m', avg),
    precipitation: pick('precipitation', sum),
    windSpeed:    pick('wind_speed_10m', max),
    windGusts:    pick('wind_gusts_10m', max),
    humidity:     pick('relative_humidity_2m', avg),
    cloudCover:   pick('cloud_cover', avg),
  };

  const knockOuts = {
    tooCold: conditions.temperature < 10,
    tooWet: conditions.precipitation > 2,
    tooWindy: conditions.windGusts > 65,
  };

  const rawScore = Math.round(
    tempScore(conditions.temperature) * WEIGHTS.temp +
    rainScore(conditions.precipitation) * WEIGHTS.rain +
    windScore(conditions.windSpeed, conditions.windGusts) * WEIGHTS.wind +
    humidityScore(conditions.humidity) * WEIGHTS.humidity +
    cloudScore(conditions.cloudCover) * WEIGHTS.cloud
  );

  const knockOut = knockOuts.tooCold || knockOuts.tooWet || knockOuts.tooWindy;
  const score = knockOut ? Math.min(rawScore, 40) : rawScore;
  const status = score >= 75 ? 'yes' : score >= 45 ? 'maybe' : 'no';

  return { status, score, conditions, knockOuts };
}

function analyzeWeek(weather) {
  const today = new Date();
  const results = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const r = analyzeDay(weather, d);
    if (r) results.push({ date: d.toISOString().slice(0, 10), ...r });
  }
  return results;
}

module.exports = { analyzeDay, analyzeWeek };
