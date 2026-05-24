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

  async getI18n({ homey }) {
    const w = homey.app.getStrings().widget;
    return {
      verdicts: w.verdict.verdicts,
      loading:  w.verdict.loading,
      score:    w.verdict.score,
      wind:     w.weather.wind,
      rain:     w.weather.rain,
    };
  },
};
