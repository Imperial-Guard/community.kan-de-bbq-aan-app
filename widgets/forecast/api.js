'use strict';

module.exports = {
  async getForecast({ homey }) {
    const days = homey.app.getForecast();
    if (!days || days.length === 0) return { error: 'No data yet', days: [] };
    return { days };
  },

  async getI18n({ homey }) {
    const w = homey.app.getStrings().widget;
    return {
      days: w.forecast.days,
    };
  },
};
