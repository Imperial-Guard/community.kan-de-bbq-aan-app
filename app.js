'use strict';

const Homey = require('homey');
const { fetchWeather } = require('./lib/open-meteo');
const { analyzeDay, analyzeWeek } = require('./lib/bbq-algorithm');
const { pickAdvice } = require('./lib/copy-bank');

// Single source of truth voor alle non-compose strings.
const STRINGS = {
  nl: require('./locales/nl.json'),
  en: require('./locales/en.json'),
};

const POLL_INTERVAL_MS = 30 * 60 * 1000;
const MIN_REFRESH_AGE_MS = 5 * 60 * 1000;

class KanDeBbqAanApp extends Homey.App {

  async onInit() {
    this.log('Kan de BBQ aan? app initialized');

    this._weatherCache = null;
    this._weatherFetchedAt = 0;
    this._currentSnapshot = null;
    this._forecast = [];
    this._lastCopyIndex = this.homey.settings.get('lastCopyIndex') ?? -1;

    this._triggerStatusChanged = this.homey.flow.getTriggerCard('bbq_status_changed');
    this._triggerBecameYes = this.homey.flow.getTriggerCard('bbq_became_yes');

    this.homey.flow
      .getConditionCard('is_bbq_weather')
      .registerRunListener(async () => {
        return this._currentSnapshot?.status === 'yes';
      });

    this.homey.flow
      .getConditionCard('bbq_score_above')
      .registerRunListener(async (args) => {
        const current = this._currentSnapshot?.score ?? 0;
        return current > args.score;
      });

    this.homey.flow
      .getActionCard('refresh_now')
      .registerRunListener(async () => {
        await this._update(true);
      });

    await this._update().catch(this.error);
    this._pollInterval = this.homey.setInterval(
      () => this._update().catch(this.error),
      POLL_INTERVAL_MS
    );
  }

  async onUninit() {
    if (this._pollInterval) {
      this.homey.clearInterval(this._pollInterval);
    }
  }

  async _update(force = false) {
    const now = Date.now();
    const age = now - this._weatherFetchedAt;

    let weather = this._weatherCache;
    if (!weather || age > POLL_INTERVAL_MS || (force && age > MIN_REFRESH_AGE_MS)) {
      const lat = this.homey.geolocation.getLatitude() ?? 52.1326;
      const lon = this.homey.geolocation.getLongitude() ?? 5.2913;
      try {
        weather = await fetchWeather(lat, lon);
        this._weatherCache = weather;
        this._weatherFetchedAt = now;
      } catch (err) {
        this.error('Weather fetch failed:', err);
        // Val terug op stale cache als die er is, anders bail
        if (!this._weatherCache) return;
        weather = this._weatherCache;
      }
    }

    const today = analyzeDay(weather, new Date());
    if (!today) {
      this.error('No weather data for today');
      return;
    }
    this._forecast = analyzeWeek(weather);

    // Volg de Homey device-taal: NL-device → NL copy, EN-device → EN copy.
    const strings = this.getStrings();
    const { advice, index } = pickAdvice(today.status, strings.advice, this._lastCopyIndex);
    this._lastCopyIndex = index;
    this.homey.settings.set('lastCopyIndex', index);

    const previousStatus = this._currentSnapshot?.status ?? null;

    this._currentSnapshot = {
      status: today.status,
      score: today.score,
      advice,
      conditions: today.conditions,
      knockOuts: today.knockOuts,
      updatedAt: this._weatherFetchedAt,
    };

    if (previousStatus !== today.status) {
      await this._triggerStatusChanged.trigger({
        status: today.status,
        advice,
        score: today.score,
      }).catch(this.error);

      if (previousStatus !== 'yes' && today.status === 'yes') {
        await this._triggerBecameYes.trigger({
          advice,
          score: today.score,
        }).catch(this.error);
      }
    }
  }

  getCurrentSnapshot() {
    return this._currentSnapshot;
  }

  getForecast() {
    return this._forecast;
  }

  /**
   * Geeft de huidige locale-code terug op basis van de Homey device-taal.
   * @returns {'nl'|'en'}
   */
  getLocale() {
    return this.homey.i18n.getLanguage() === 'nl' ? 'nl' : 'en';
  }

  /**
   * Geeft het volledige string-bundel voor de huidige locale.
   * Widgets krijgen alleen hun eigen subtree via de per-widget /i18n endpoint.
   * @returns {object} parsed locales/{lang}.json
   */
  getStrings() {
    return STRINGS[this.getLocale()];
  }
}

module.exports = KanDeBbqAanApp;
