'use strict';

const Homey = require('homey');
const { fetchWeather } = require('./lib/open-meteo');
const { analyzeDay, analyzeWeek } = require('./lib/bbq-algorithm');
const { pickAdvice } = require('./lib/copy-bank');

// Eén bron van waarheid voor alle strings buiten compose.
const STRINGS = {
  nl: require('./locales/nl.json'),
  en: require('./locales/en.json'),
};

const POLL_INTERVAL_MS = 30 * 60 * 1000;
const MIN_REFRESH_AGE_MS = 5 * 60 * 1000;

class KanDeBbqAanApp extends Homey.App {

  async onInit() {
    this.log('Kan de BBQ aan? app geïnitialiseerd');

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

    await this._update().catch((err) => this.error(err));
    this._pollInterval = this.homey.setInterval(
      () => this._update().catch((err) => this.error(err)),
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
      const lat = (await this.homey.geolocation.getLatitude()) ?? 52.1326;
      const lon = (await this.homey.geolocation.getLongitude()) ?? 5.2913;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)
          || (lat === 52.1326 && lon === 5.2913)) {
        this.log('LET OP: terugval op geografisch middelpunt van NL voor locatie');
      }
      try {
        weather = await fetchWeather(lat, lon);
        this._weatherCache = weather;
        this._weatherFetchedAt = now;
      } catch (err) {
        this.error('Ophalen van weerdata mislukt:', err);
        // Bij fout terugvallen op de gecachte data als die bestaat, anders afbreken.
        if (!this._weatherCache) return;
        weather = this._weatherCache;
      }
    }

    const today = analyzeDay(weather, new Date());
    if (!today) {
      this.error('Geen weerdata beschikbaar voor vandaag');
      return;
    }
    this._forecast = analyzeWeek(weather);

    // Volgt de Homey-apparaattaal: NL-toestel krijgt NL copy, anders EN.
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
      }).catch((err) => this.error(err));

      if (previousStatus !== 'yes' && today.status === 'yes') {
        await this._triggerBecameYes.trigger({
          advice,
          score: today.score,
        }).catch((err) => this.error(err));
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
   * Geeft het volledige string-bundel voor de huidige locale terug.
   * Widgets krijgen alleen hun eigen subtree via de /i18n endpoint per widget.
   * @returns {object} ingelezen locales/{lang}.json
   */
  getStrings() {
    return STRINGS[this.getLocale()];
  }
}

module.exports = KanDeBbqAanApp;
