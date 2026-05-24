'use strict';

module.exports = {
  async getStatus({ homey }) {
    const snapshot = homey.app.getCurrentSnapshot();
    if (!snapshot) return { error: 'No data yet' };
    return {
      status: snapshot.status,
      score: snapshot.score,
      advice: snapshot.advice,
      temperature: snapshot.conditions.temperature,
      windSpeed: snapshot.conditions.windSpeed,
      windGusts: snapshot.conditions.windGusts,
      rain: snapshot.conditions.precipitation,
      humidity: snapshot.conditions.humidity,
      cloudCover: snapshot.conditions.cloudCover,
      updatedAt: snapshot.updatedAt,
    };
  },

  async getForecast({ homey }) {
    const days = homey.app.getForecast();
    if (!days || days.length === 0) return { error: 'No data yet', days: [] };
    return { days };
  },

  async getI18n({ homey }) {
    const w = homey.app.getStrings().widget;
    return {
      kicker:   w.score.kicker,
      upcoming: w.score.upcoming,
      max:      w.score.max,
      labels:   w.score.labels,
      days:     w.forecast.days,
      wind:     w.weather.wind,
      rain:     w.weather.rain,
    };
  },
};
