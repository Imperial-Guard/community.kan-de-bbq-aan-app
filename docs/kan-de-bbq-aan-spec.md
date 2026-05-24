# Kan de BBQ aan? — Homey App bouwinstructie

**Voor Claude Code.** Dit is een complete specificatie voor het bouwen van de Homey-app "Kan de BBQ aan?" volgens de Homey Apps SDK v3. Volg deze spec letterlijk. Bij twijfel: altijd de SDK-docs op https://apps.developer.homey.app als leidraad.

---

## 1. Projectsamenvatting

**Kan de BBQ aan?** is een ludieke Homey-app met een knipoog. Eén vraag: kan de BBQ vandaag aan? Antwoord: **JA / TWIJFEL / NEE**, plus een korte grappige zin en de onderliggende cijfers. De logica volgt het algoritme van barbecueradar.nl, gevoed door een gratis Open-Meteo weersvoorspelling.

De app biedt:
- Geen pairing, geen device om toe te voegen — app installeren is genoeg.
- Drie dashboard-widgets: **Verdict** (groot hoofdvisueel), **Score** (compact cijfer), **Vooruitblik** (7 dagen).
- Vijf flow-kaarten (2 triggers, 2 conditions, 1 action) voor automatisering.
- Nederlandse + Engelse lokalisatie.

**Platforms**: `platforms: ["local"]` dekt in Homey's terminologie automatisch Homey Pro, Homey Pro mini én Homey Self-Hosted Server. Homey Cloud niet (daar werken widgets niet). De code is wel Cloud-compatibel geschreven voor latere uitbreiding.

**Inspiratie**: "Kan ik vandaag een korte broek aan?" (Menno van Hout) — zelfde categorie (Klimaat), zelfde community-app-gevoel, zelfde vraag-als-titel-stijl.

---

## 2. Architectuurbeslissingen (kritisch — niet afwijken)

### 2.1 SDK & platforms

- **SDK v3** (`"sdk": 3` in manifest).
- **`compatibility: ">=12.3.0"`** — widgets vereisen dit.
- **`platforms: ["local"]`** — alleen Homey Pro. We schrijven de code wél Cloud-compatibel (zie 2.4) zodat later uitbreiden triviaal is.
- **Node.js 22** als target. Gebruik `"engines": { "node": ">=22" }` in `package.json`.

### 2.2 Architectuur: app-only (geen device)

De app heeft **geen driver en geen device**. Alle state, logica en API's leven op app-niveau. Gebruikers installeren de app en zien 'm direct tussen de flows en in de widget-picker, niet in de apparatenlijst. Dit past bij het concept: een BBQ is geen fysiek apparaat.

**Waarom app-only en niet device-based?**
- Het is een virtueel concept (een vraag over het weer) — geen apparaat.
- De gebruiker hoeft niks toe te voegen: app installeren = klaar.
- Zelfde patroon als de inspiratiebron "Kan ik vandaag een korte broek aan?".
- Simpelere architectuur = minder kans op fouten.

**Wat we opgeven**: de gratis Insights-grafiek uit custom capabilities. Acceptabel — de Vooruitblik-widget geeft al een 7-daags overzicht, en score-historie is geen kernfunctie van het concept.

### 2.3 Data-architectuur

```
Open-Meteo API
     │  (poll elke 30 min vanuit app.js)
     ▼
App.#weatherCache     (in-memory, op app instance)
App.#currentSnapshot  { status, score, advice, conditions, updatedAt }
App.#forecast         array van 7 dagen
     │
     ├─► BBQ algoritme ─► status, score, advice (vandaag)
     │                    forecast (7 dagen)
     │
     └─► Flow triggers vuurt bij status-wijziging
     
Widgets ─► Homey.api('GET', '/status')    (elke 5 min poll)
          Homey.api('GET', '/forecast')   (voor Vooruitblik)
          ↓
          api.js ─► homey.app.getCurrentSnapshot() / getForecast()
```

Geen drivers, geen devices, geen custom capabilities — alles zit in één app-instance.

### 2.4 Cloud-compatibele codestijl

Ook al is `platforms: ["local"]`, volg deze regels zodat Cloud-uitbreiding triviaal is:

1. **Geen globals.** Alles via `this.*` op de App-instance.
2. **Gebruik `this.homey.setInterval(...)`** — nooit kale `setInterval`.
3. **Altijd `.catch(this.error)`** op promises die niet ge-`await` worden.
4. **Implementeer `onUninit()`** op de App voor cleanup (intervals, fetches).
5. **Relatieve paths altijd** (`require('./lib/...')`, `path.join(__dirname, ...)`).
6. **Geen `homey:manager:api` of `homey:app:*` permissions** — hoeft ook niet.

### 2.5 Locatie & privacy

Gebruik `this.homey.geolocation.getLatitude()` en `getLongitude()` voor de Open-Meteo-call. Fallback bij null: `52.1326, 5.2913` (centrum NL). Lokaliseer geen gegevens die niet nodig zijn — we sturen alleen lat/lon naar Open-Meteo, verder niks.

### 2.6 Attributie Open-Meteo

Open-Meteo is CC BY 4.0. Voeg in `readme.txt` en in de app-manifest `description` een credit toe: "Weersdata door Open-Meteo.com". In de app-manifest ook het veld `contributing.donate` niet invullen voor Open-Meteo (dat is voor jou als dev), maar wel in de readme vermelden.

---

## 3. Folder structuur

Creëer exact deze boomstructuur in de root van de app:

```
kan-de-bbq-aan/
├── .homeycompose/
│   ├── app.json
│   └── flow/
│       ├── triggers/
│       │   ├── bbq_status_changed.json
│       │   └── bbq_became_yes.json
│       ├── conditions/
│       │   ├── is_bbq_weather.json
│       │   └── bbq_score_above.json
│       └── actions/
│           └── refresh_now.json
├── widgets/
│   ├── verdict/
│   │   ├── widget.compose.json
│   │   ├── api.js
│   │   ├── preview-light.png      (1024x1024)
│   │   ├── preview-dark.png       (1024x1024)
│   │   └── public/
│   │       └── index.html
│   ├── score/
│   │   ├── widget.compose.json
│   │   ├── api.js
│   │   ├── preview-light.png
│   │   ├── preview-dark.png
│   │   └── public/
│   │       └── index.html
│   └── forecast/
│       ├── widget.compose.json
│       ├── api.js
│       ├── preview-light.png
│       ├── preview-dark.png
│       └── public/
│           └── index.html
├── lib/
│   ├── open-meteo.js
│   ├── bbq-algorithm.js
│   └── copy-bank.js
├── locales/
│   ├── en.json
│   └── nl.json
├── assets/
│   ├── icon.svg
│   └── images/
│       ├── small.png       (250x175)
│       ├── large.png       (500x350)
│       └── xlarge.png      (1000x700)
├── app.js
├── package.json
├── README.md
├── readme.txt
└── .gitignore
```

**Geen `drivers/` folder. Geen `.homeycompose/capabilities/`**. De app draait als pure app-instance zonder apparaten.

---

## 4. App manifest

**Bestand**: `.homeycompose/app.json`

```json
{
  "id": "nl.bbqaan.app",
  "version": "1.0.0",
  "compatibility": ">=12.3.0",
  "sdk": 3,
  "platforms": ["local"],
  "brandColor": "#D85A30",
  "name": {
    "en": "Kan de BBQ aan?",
    "nl": "Kan de BBQ aan?"
  },
  "description": {
    "en": "Can the BBQ fire up today? Get a clear yes, maybe, or no.",
    "nl": "Kan de BBQ vandaag aan? Krijg een helder ja, twijfel of nee."
  },
  "category": ["climate"],
  "permissions": [],
  "images": {
    "small": "/assets/images/small.png",
    "large": "/assets/images/large.png",
    "xlarge": "/assets/images/xlarge.png"
  },
  "author": {
    "name": "YOUR_NAME_HERE",
    "email": "YOUR_EMAIL_HERE"
  },
  "contributors": {
    "developers": []
  },
  "source": "https://github.com/USERNAME/nl.bbqaan.app",
  "bugs": {
    "url": "https://github.com/USERNAME/nl.bbqaan.app/issues"
  },
  "homeyCommunityTopicId": 0,
  "support": "mailto:YOUR_EMAIL_HERE"
}
```

**`brandColor`**: `#D85A30` is de coral/vlam-kleur uit onze palette. Past bij BBQ en leest goed achter een wit of donker icoon.

**Opmerking**: de `author.name`, e-mail, en source-URL moet de ontwikkelaar zelf invullen. Laat ze staan als placeholders.

---

## 5. Open-Meteo integratie

**Bestand**: `lib/open-meteo.js`

### 5.1 Endpoint en parameters

```
GET https://api.open-meteo.com/v1/forecast
```

Query parameters:

| Parameter | Waarde | Reden |
|---|---|---|
| `latitude` | float uit `homey.geolocation` | Locatie gebruiker |
| `longitude` | float uit `homey.geolocation` | Locatie gebruiker |
| `hourly` | `temperature_2m,precipitation,wind_speed_10m,wind_gusts_10m,relative_humidity_2m,cloud_cover` | Per-uur data voor BBQ-venster |
| `daily` | `temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max` | Per-dag samenvattingen voor vooruitblik |
| `timezone` | `auto` | Automatisch tijdzone op basis van lat/lon |
| `forecast_days` | `7` | 7 dagen vooruit |
| `wind_speed_unit` | `kmh` | Conform barbecueradar.nl drempels |

### 5.2 Implementatie

```javascript
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

/**
 * Haal 7-daagse weerdata op bij Open-Meteo.
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<object>} Open-Meteo JSON response
 */
async function fetchWeather(latitude, longitude) {
  const url = new URL(BASE_URL);
  url.searchParams.set('latitude', latitude.toFixed(4));
  url.searchParams.set('longitude', longitude.toFixed(4));
  url.searchParams.set('hourly', HOURLY_PARAMS);
  url.searchParams.set('daily', DAILY_PARAMS);
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '7');
  url.searchParams.set('wind_speed_unit', 'kmh');

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Open-Meteo returned ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

module.exports = { fetchWeather };
```

### 5.3 Caching & update-frequentie

- App polt elke **30 minuten** naar Open-Meteo.
- Cache resultaat in `this._weatherCache` op de App-instance met timestamp.
- Als er binnen 30 min opnieuw data nodig is (bijv. door action `refresh_now`), alleen opnieuw ophalen als cache ouder dan 5 minuten is.
- Open-Meteo heeft geen harde rate limit voor non-commercieel, maar wees netjes.

---

## 6. Het BBQ-algoritme

**Bestand**: `lib/bbq-algorithm.js`

Dit is een directe vertaling van het barbecueradar.nl-algoritme. **Wijk hier niet van af** — dit is de bron van waarheid van het concept.

### 6.1 BBQ-venster

Het algoritme kijkt naar het **avondvenster 17:00–21:00 lokale tijd**. Voor "vandaag" gebruikt het de uurwaarden binnen dat venster; voor toekomstige dagen hetzelfde. Dit is accurater dan dagelijks gemiddelde (een middagbui die om 14u stopt hoeft de avond niet te verpesten).

### 6.2 Input per dag

Uit de Open-Meteo hourly arrays, filter op uren 17:00–21:00 van de betreffende dag, en bereken:

```javascript
{
  temperature: gemiddelde van temperature_2m over venster,
  precipitation: som van precipitation over venster (mm),
  windSpeed: max van wind_speed_10m over venster (km/h),
  windGusts: max van wind_gusts_10m over venster (km/h),
  humidity: gemiddelde van relative_humidity_2m over venster,
  cloudCover: gemiddelde van cloud_cover over venster,
}
```

### 6.3 Knock-out criteria

Als **één van deze** geldt, is de status direct `no` en score maximaal 40:

```javascript
const KNOCK_OUTS = {
  tooCold: temperature < 10,
  tooWet: precipitation > 2,
  tooWindy: windGusts > 65,
};
```

### 6.4 Sub-scores (elk 0–100)

```javascript
// Temperatuur-score
function tempScore(t) {
  if (t < 10) return 0;
  if (t < 15) return 30 + (t - 10) * 8;    // 30-70
  if (t < 18) return 70 + (t - 15) * 10;   // 70-100
  if (t <= 25) return 100;                 // optimum
  if (t <= 30) return 100 - (t - 25) * 4;  // 100-80
  return 80;                               // te heet, maar BBQ kan
}

// Neerslag-score
function rainScore(mm) {
  if (mm > 2) return 0;
  if (mm > 1) return 30;
  if (mm > 0.5) return 70;
  return 100;
}

// Wind-score (combineert wind + windstoten, neemt strengste)
function windScore(speed, gusts) {
  if (gusts > 65) return 0;
  if (gusts > 45) return 20;
  if (speed > 45 || gusts > 35) return 40;
  if (speed > 25) return 60;
  if (speed > 15) return 80;
  return 100;
}

// Luchtvochtigheid-score
function humidityScore(h) {
  if (h > 90) return 20;
  if (h > 85) return 50;
  if (h > 75) return 75;
  if (h >= 30) return 100;
  return 85; // erg droog is ongebruikelijk in NL, ook OK
}

// Bewolking-score
function cloudScore(c) {
  if (c > 75) return 60;
  if (c > 50) return 75;
  if (c > 25) return 90;
  return 100;
}
```

### 6.5 Gewogen eindscore

```javascript
const WEIGHTS = {
  temp: 0.30,
  rain: 0.25,
  wind: 0.20,
  humidity: 0.15,
  cloud: 0.10,
};

function calculateScore(conditions) {
  const knockOut = 
    conditions.temperature < 10 ||
    conditions.precipitation > 2 ||
    conditions.windGusts > 65;

  const rawScore = Math.round(
    tempScore(conditions.temperature) * WEIGHTS.temp +
    rainScore(conditions.precipitation) * WEIGHTS.rain +
    windScore(conditions.windSpeed, conditions.windGusts) * WEIGHTS.wind +
    humidityScore(conditions.humidity) * WEIGHTS.humidity +
    cloudScore(conditions.cloudCover) * WEIGHTS.cloud
  );

  // Knock-out capt de score op 40 (max voor "nee").
  return knockOut ? Math.min(rawScore, 40) : rawScore;
}
```

### 6.6 Status uit score

```javascript
function statusFromScore(score) {
  if (score >= 75) return 'yes';
  if (score >= 45) return 'maybe';
  return 'no';
}
```

### 6.7 Output object

De hoofdfunctie retourneert:

```javascript
{
  status: 'yes' | 'maybe' | 'no',
  score: 0..100,
  conditions: { temperature, precipitation, windSpeed, windGusts, humidity, cloudCover },
  knockOuts: { tooCold: bool, tooWet: bool, tooWindy: bool },
}
```

### 6.8 Complete export

```javascript
'use strict';

function tempScore(t)      { /* ... zie 6.4 ... */ }
function rainScore(mm)     { /* ... */ }
function windScore(s, g)   { /* ... */ }
function humidityScore(h)  { /* ... */ }
function cloudScore(c)     { /* ... */ }

const WEIGHTS = { temp: 0.30, rain: 0.25, wind: 0.20, humidity: 0.15, cloud: 0.10 };
const EVENING_HOURS = [17, 18, 19, 20, 21];

/**
 * Bereken BBQ-score voor een specifieke datum uit Open-Meteo hourly data.
 * @param {object} weather - Open-Meteo response object
 * @param {Date} date - Doeldatum (locale tijd)
 * @returns {object} { status, score, conditions, knockOuts }
 */
function analyzeDay(weather, date) {
  const targetDateStr = date.toISOString().slice(0, 10); // "YYYY-MM-DD"
  const hours = weather.hourly.time;
  const indices = hours.reduce((acc, timeStr, i) => {
    if (timeStr.startsWith(targetDateStr)) {
      const hour = parseInt(timeStr.slice(11, 13), 10);
      if (EVENING_HOURS.includes(hour)) acc.push(i);
    }
    return acc;
  }, []);

  if (indices.length === 0) {
    return null; // geen data voor deze dag
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

/**
 * Analyseer 7 dagen vanaf vandaag.
 * @returns {Array<{ date: string, status, score, ... }>}
 */
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
```

---

## 7. Copy bank (seizoensvariaties)

**Bestand**: `lib/copy-bank.js`

### 7.1 Seizoenslogica

```javascript
function currentSeason() {
  const month = new Date().getMonth(); // 0-11
  if (month >= 2 && month <= 4)  return 'spring'; // mrt-mei
  if (month >= 5 && month <= 7)  return 'summer'; // jun-aug
  if (month >= 8 && month <= 10) return 'autumn'; // sep-nov
  return 'winter';                                // dec-feb
}
```

### 7.2 De zinnen (Nederlands)

```javascript
const COPY_NL = {
  yes: {
    summer: [
      'Kolen aansteken!',
      'Vuur erop, vlees erbij',
      'Terras aan, vlees erop',
      'Het rooster roept',
      'Bier koud, grill heet',
    ],
    spring: [
      'Jas aan, vuur aan',
      'Kolen eruit, zomer komt',
      'Eerste BBQ van het jaar?',
      'Het mag weer',
      'Proloog op de zomer',
    ],
    autumn: [
      'Laatste ronde van het jaar',
      'Snel, vóór de winter',
      'Grillen in oktoberlicht',
      'Rooster aan, raampje open',
    ],
    winter: [
      'BBQ onder de luifel?',
      'Winterbarbecue? Waarom niet',
      'Warme jas, heet rooster',
      'Wie durft, die grilt',
    ],
  },
  maybe: {
    summer: [
      'Gokje wagen?',
      'Wolkje riskeren?',
      'Durf je het aan?',
      'Paraplu klaar',
      'Tussen de buien door?',
    ],
    spring: [
      'Hou de lucht in de gaten',
      '50/50, jij beslist',
      'Jasje aan en gaan?',
      'Tussen de buien door',
      'Dapper gegokt',
    ],
    autumn: [
      'Misschien trekt de bui over',
      'Rooster binnen handbereik',
      'Geduld is een schone zaak',
      'Onder een afdak kan veel',
    ],
    winter: [
      'Ambitieus. Doe je ding.',
      'Extra warm aankleden',
      'Dapper van je',
      'Doorzetten is een kunst',
    ],
  },
  no: {
    summer: [
      'Vergeet het maar',
      'Morgen misschien',
      'Niet vandaag, chef',
      'Even wachten op beter weer',
      'De lucht heeft andere plannen',
    ],
    spring: [
      'Vandaag even niet',
      'Bewaar het vlees',
      'Oven en pan zijn ook prima',
      'Het weer zegt nee',
    ],
    autumn: [
      'De herfst heeft gesproken',
      'Te koud, te nat — of allebei',
      'Beter binnen vandaag',
      'Spaar het rooster nog even',
    ],
    winter: [
      'Natuurlijk niet, het is winter',
      'De oven belt je',
      'Blijf lekker binnen',
      'Wie grilt hier in deze bende?',
    ],
  },
};
```

### 7.3 Selectielogica

Kies op app-niveau een zin die **niet dezelfde is als de vorige**. Sla de laatst-gekozen index op in `this.homey.settings.set('lastCopyIndex', ...)` zodat refreshes en app-restarts niet steeds dezelfde zin laten zien.

```javascript
function pickAdvice(status, locale = 'nl', lastIndex = -1) {
  const bank = (locale === 'en' ? COPY_EN : COPY_NL)[status][currentSeason()];
  let idx = Math.floor(Math.random() * bank.length);
  if (bank.length > 1 && idx === lastIndex) {
    idx = (idx + 1) % bank.length;
  }
  return { advice: bank[idx], index: idx };
}

module.exports = { pickAdvice, currentSeason };
```

### 7.4 Engels (zelfde structuur)

```javascript
const COPY_EN = {
  yes: {
    summer: ['Fire up the grill', 'Tongs ready, flames high', 'Patio on, meat on', 'The grill is calling', 'Cold beer, hot coals'],
    spring: ['Jacket on, grill on', 'First BBQ of the year?', 'Season opener', 'Prelude to summer', 'It\'s allowed again'],
    autumn: ['Last rounds of the season', 'Quick, before winter', 'Grilling in October light', 'Grill on, window open'],
    winter: ['Under the awning?', 'Winter BBQ? Why not', 'Warm coat, hot grill', 'Who dares, grills'],
  },
  maybe: {
    summer: ['Take a chance?', 'Risk the cloud?', 'Dare you?', 'Umbrella handy', 'Between the showers?'],
    spring: ['Watch the sky', '50/50, your call', 'Jacket on and go?', 'Between the showers', 'Brave gamble'],
    autumn: ['The rain might pass', 'Keep the grill close', 'Patience is a virtue', 'An awning goes a long way'],
    winter: ['Ambitious. Go for it.', 'Bundle up', 'Brave of you', 'Perseverance is an art'],
  },
  no: {
    summer: ['Forget it', 'Maybe tomorrow', 'Not today, chef', 'Wait for better weather', 'The sky has other plans'],
    spring: ['Not today', 'Save the meat', 'Oven and pan work fine', 'The weather says no'],
    autumn: ['Autumn has spoken', 'Too cold, too wet — or both', 'Better indoors today', 'Spare the grill a while'],
    winter: ['Of course not, it\'s winter', 'Your oven is calling', 'Stay inside and warm', 'Who grills in this mess?'],
  },
};
```

---

## 8. App state & update loop

Alle state leeft op de `App`-instance. Eén periodieke update zet alles bij.

### 8.1 State-velden

De app houdt deze velden bij op `this.*`:

| Veld | Type | Beschrijving |
|---|---|---|
| `this._weatherCache` | object \| null | Ruwe Open-Meteo response |
| `this._weatherFetchedAt` | number | Timestamp laatste fetch (ms) |
| `this._currentSnapshot` | object \| null | `{ status, score, advice, conditions, updatedAt }` voor vandaag |
| `this._forecast` | array | 7 dagen analyse (via `analyzeWeek`) |
| `this._lastCopyIndex` | number | Index van laatst-gekozen zin, voorkomt herhaling |
| `this._pollInterval` | handle | `this.homey.setInterval` handle |

### 8.2 Update-cadans

- Eerste update: bij `onInit()`.
- Interval: elke **30 minuten** (`POLL_INTERVAL_MS = 30 * 60 * 1000`).
- Bij action `refresh_now`: force-refresh, maar alleen als cache ouder is dan 5 min (`MIN_REFRESH_AGE_MS`).

### 8.3 Persistentie

Gebruik `homey.settings.set/get` voor `lastCopyIndex` zodat het rouleren over app-restarts heen werkt. Andere velden hoeven niet te persisteren — bij cold start haalt de app gewoon opnieuw op.

## 9. Flow-kaarten

### 9.1 Trigger: `bbq_status_changed`

**Bestand**: `.homeycompose/flow/triggers/bbq_status_changed.json`

```json
{
  "title": {
    "en": "BBQ verdict changed",
    "nl": "BBQ-verdict is veranderd"
  },
  "hint": {
    "en": "Fires when the BBQ verdict changes to yes, maybe or no.",
    "nl": "Start wanneer het BBQ-verdict verandert naar ja, twijfel of nee."
  },
  "tokens": [
    {
      "name": "status",
      "type": "string",
      "title": { "en": "Status", "nl": "Status" },
      "example": { "en": "yes", "nl": "ja" }
    },
    {
      "name": "advice",
      "type": "string",
      "title": { "en": "Advice", "nl": "Advies" },
      "example": { "en": "Fire up the grill", "nl": "Kolen aansteken!" }
    },
    {
      "name": "score",
      "type": "number",
      "title": { "en": "Score", "nl": "Score" },
      "example": 84
    }
  ]
}
```

### 9.2 Trigger: `bbq_became_yes` (highlighted)

**Bestand**: `.homeycompose/flow/triggers/bbq_became_yes.json`

```json
{
  "title": {
    "en": "It's BBQ weather",
    "nl": "Het is BBQ-weer"
  },
  "hint": {
    "en": "Fires once when today's verdict turns into YES.",
    "nl": "Start één keer wanneer het verdict van vandaag op JA komt."
  },
  "highlight": true,
  "tokens": [
    {
      "name": "advice",
      "type": "string",
      "title": { "en": "Advice", "nl": "Advies" },
      "example": { "en": "Fire up the grill", "nl": "Kolen aansteken!" }
    },
    {
      "name": "score",
      "type": "number",
      "title": { "en": "Score", "nl": "Score" },
      "example": 84
    }
  ]
}
```

Deze trigger vuurt alleen af bij de overgang naar `yes` — niet bij iedere status-wijziging. Dat implementeert de app zelf (zie § 11).

### 9.3 Condition: `is_bbq_weather`

**Bestand**: `.homeycompose/flow/conditions/is_bbq_weather.json`

```json
{
  "title": {
    "en": "It !{{is|isn't}} BBQ weather",
    "nl": "Het !{{is|is geen}} BBQ-weer"
  },
  "hint": {
    "en": "True when the current verdict is YES.",
    "nl": "Waar wanneer het huidige verdict JA is."
  }
}
```

### 9.4 Condition: `bbq_score_above`

**Bestand**: `.homeycompose/flow/conditions/bbq_score_above.json`

```json
{
  "title": {
    "en": "BBQ score is !{{higher|lower}} than...",
    "nl": "BBQ-score is !{{hoger|lager}} dan..."
  },
  "titleFormatted": {
    "en": "BBQ score is !{{higher|lower}} than [[score]]",
    "nl": "BBQ-score is !{{hoger|lager}} dan [[score]]"
  },
  "args": [
    {
      "name": "score",
      "type": "number",
      "min": 0,
      "max": 100,
      "step": 1,
      "placeholder": { "en": "Score", "nl": "Score" }
    }
  ]
}
```

### 9.5 Action: `refresh_now`

**Bestand**: `.homeycompose/flow/actions/refresh_now.json`

```json
{
  "title": {
    "en": "Refresh BBQ data",
    "nl": "Ververs BBQ-data"
  },
  "hint": {
    "en": "Forces a fresh fetch from the weather service.",
    "nl": "Forceert een verse ophaal bij de weerdienst."
  }
}
```

---

## 10. Geen driver, geen device

**Expliciet: deze app bevat geen `drivers/` folder en geen pairing-flow.** De app verschijnt niet in de apparatenlijst. Gebruikers installeren de app en gebruiken 'm meteen via flows en widgets.

Dit past bij het karakter van de app (de BBQ is geen fysiek apparaat) en volgt exact het patroon van de inspiratie-app "Kan ik vandaag een korte broek aan?", die ook alleen flow-kaarten heeft.

## 11. App entry point — volledige implementatie

### 11.1 `app.js`

```javascript
'use strict';

const Homey = require('homey');
const { fetchWeather } = require('./lib/open-meteo');
const { analyzeDay, analyzeWeek } = require('./lib/bbq-algorithm');
const { pickAdvice } = require('./lib/copy-bank');

const POLL_INTERVAL_MS = 30 * 60 * 1000;   // 30 min
const MIN_REFRESH_AGE_MS = 5 * 60 * 1000;  // 5 min

class KanDeBbqAanApp extends Homey.App {

  async onInit() {
    this.log('Kan de BBQ aan? app initialized');

    this._weatherCache = null;
    this._weatherFetchedAt = 0;
    this._currentSnapshot = null;
    this._forecast = [];
    this._lastCopyIndex = this.homey.settings.get('lastCopyIndex') ?? -1;

    // Trigger-kaarten referenties
    this._triggerStatusChanged = this.homey.flow.getTriggerCard('bbq_status_changed');
    this._triggerBecameYes = this.homey.flow.getTriggerCard('bbq_became_yes');

    // Condition: is_bbq_weather
    this.homey.flow
      .getConditionCard('is_bbq_weather')
      .registerRunListener(async () => {
        return this._currentSnapshot?.status === 'yes';
      });

    // Condition: bbq_score_above
    this.homey.flow
      .getConditionCard('bbq_score_above')
      .registerRunListener(async (args) => {
        const current = this._currentSnapshot?.score ?? 0;
        return current > args.score;
      });

    // Action: refresh_now
    this.homey.flow
      .getActionCard('refresh_now')
      .registerRunListener(async () => {
        await this._update(true);
      });

    // Eerste update + periodieke poll
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

  /**
   * Haal weer op, bereken BBQ-status, werk state bij, vuur triggers.
   * @param {boolean} force - forceer nieuwe fetch (mits >5min oud)
   */
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
        if (!this._currentSnapshot) return; // geen fallback beschikbaar
        return; // behoud oude snapshot
      }
    }

    const today = analyzeDay(weather, new Date());
    if (!today) {
      this.error('No weather data for today');
      return;
    }
    this._forecast = analyzeWeek(weather);

    // Kies roulerend advies (niet dezelfde als vorige)
    const locale = this.homey.i18n.getLanguage() === 'nl' ? 'nl' : 'en';
    const { advice, index } = pickAdvice(today.status, locale, this._lastCopyIndex);
    this._lastCopyIndex = index;
    this.homey.settings.set('lastCopyIndex', index);

    // Bewaar vorige status voor trigger-logica
    const previousStatus = this._currentSnapshot?.status ?? null;

    this._currentSnapshot = {
      status: today.status,
      score: today.score,
      advice,
      conditions: today.conditions,
      knockOuts: today.knockOuts,
      updatedAt: this._weatherFetchedAt,
    };

    // Fire triggers alleen bij echte wijziging
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

  /**
   * Publieke API voor widgets.
   */
  getCurrentSnapshot() {
    return this._currentSnapshot;
  }

  getForecast() {
    return this._forecast;
  }
}

module.exports = KanDeBbqAanApp;
```

### 11.2 Belangrijke notities

**Trigger-logica.** We vuren `bbq_status_changed` alleen bij een daadwerkelijke wijziging (niet bij elke refresh). `bbq_became_yes` is een subset: alleen bij de overgang van niet-yes naar yes.

**Fout-afhandeling.** Als Open-Meteo onbereikbaar is en we hebben al een vorige snapshot, houden we die aan. Widgets en flows blijven dan werken op de laatst-bekende data, ondanks dat de widget-timestamp verouderd is.

**Geen globals.** Alle state zit op `this.*` — conform de Cloud-compatibele codestijl uit §2.4.

**Persistentie `lastCopyIndex`.** Via `homey.settings` — blijft behouden na app-restart, voorkomt dat je na elke restart dezelfde zin te zien krijgt.

## 12. Widgets

Alle drie widgets poll'en elke 5 minuten via `Homey.api('GET', '/status')` op hun eigen API-endpoint. De widget-API's zitten in `api.js` per widget. Widgets volgen **strict** de Homey widget styling guidelines — alleen `--homey-*` CSS variabelen, geen eigen kleuren behalve de status-tinten.

### 12.1 Widget 1: **BBQ Verdict** (groot, hoofdwidget)

#### `widgets/verdict/widget.compose.json`

```json
{
  "name": {
    "en": "BBQ Verdict",
    "nl": "BBQ Verdict"
  },
  "height": 220,
  "transparent": false,
  "settings": [
    {
      "id": "show_details",
      "type": "checkbox",
      "title": {
        "en": "Show weather details",
        "nl": "Toon weerdetails"
      },
      "value": true
    }
  ],
  "api": {
    "getStatus": {
      "method": "GET",
      "path": "/status"
    }
  }
}
```

#### `widgets/verdict/api.js`

```javascript
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
      rain: snapshot.conditions.precipitation,
      humidity: snapshot.conditions.humidity,
      updatedAt: snapshot.updatedAt,
    };
  },
};
```

#### `widgets/verdict/public/index.html`

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    /* Widget-body krijgt automatisch .homey-widget. Overschrijf background voor de status-fill. */
    body { margin: 0; transition: background-color 0.3s ease; }
    body.status-yes   { background-color: var(--homey-color-green-050); }
    body.status-maybe { background-color: var(--homey-color-orange-500); background-color: #FAEEDA; }
    body.status-no    { background-color: var(--homey-color-red-050); }

    .wrapper {
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      text-align: center;
    }
    .icon {
      font-size: 48px;
      line-height: 1;
      margin-top: var(--homey-su-1);
    }
    .verdict {
      font-size: var(--homey-font-size-xxlarge);
      font-weight: var(--homey-font-weight-bold);
      line-height: var(--homey-line-height-xxlarge);
      letter-spacing: -0.02em;
      margin-top: var(--homey-su-1);
    }
    .advice {
      font-size: var(--homey-font-size-default);
      margin-top: var(--homey-su-1);
      opacity: 0.85;
    }
    .details {
      width: 100%;
      display: flex;
      justify-content: space-between;
      font-size: var(--homey-font-size-small);
      padding-top: var(--homey-su-2);
      border-top: 1px solid rgba(0,0,0,0.12);
      opacity: 0.8;
    }
    .details.hidden { display: none; }

    /* Status-specifieke tekstkleuren */
    body.status-yes   .verdict, body.status-yes   .advice, body.status-yes   .details { color: var(--homey-color-green-800); }
    body.status-maybe .verdict, body.status-maybe .advice, body.status-maybe .details { color: var(--homey-color-orange-500); color: #633806; }
    body.status-no    .verdict, body.status-no    .advice, body.status-no    .details { color: var(--homey-color-red-800); }
  </style>
</head>
<body class="homey-widget">
  <div class="wrapper">
    <div>
      <div class="icon" id="icon">🔥</div>
      <div class="verdict" id="verdict">—</div>
      <div class="advice" id="advice">Laden...</div>
    </div>
    <div class="details" id="details">
      <span id="temp">—</span>
      <span id="wind">—</span>
      <span id="rain">—</span>
    </div>
  </div>

  <script>
    function onHomeyReady(Homey) {
      Homey.ready({ height: 220 });

      const settings = Homey.getSettings();
      const showDetails = settings.show_details !== false;
      if (!showDetails) document.getElementById('details').classList.add('hidden');

      const labels = {
        yes:   { icon: '🔥', text: 'JA' },
        maybe: { icon: '🤔', text: 'TWIJFEL' },
        no:    { icon: '🌧️', text: 'NEE' },
      };

      async function refresh() {
        try {
          const data = await Homey.api('GET', '/status');
          if (!data || data.error) return;

          const label = labels[data.status] ?? labels.maybe;
          document.body.classList.remove('status-yes','status-maybe','status-no');
          document.body.classList.add('status-' + data.status);
          document.getElementById('icon').textContent = label.icon;
          document.getElementById('verdict').textContent = label.text;
          document.getElementById('advice').textContent = data.advice ?? '';
          document.getElementById('temp').textContent = data.temperature != null ? Math.round(data.temperature) + '°' : '—';
          document.getElementById('wind').textContent = data.windSpeed != null ? Math.round(data.windSpeed) + ' km/u' : '—';
          document.getElementById('rain').textContent = data.rain != null ? data.rain.toFixed(1) + ' mm' : '—';
        } catch (e) { console.error(e); }
      }

      refresh();
      setInterval(refresh, 5 * 60 * 1000); // 5 min
    }
  </script>
</body>
</html>
```

### 12.2 Widget 2: **BBQ Score** (klein, compact)

#### `widgets/score/widget.compose.json`

```json
{
  "name": {
    "en": "BBQ Score",
    "nl": "BBQ-score"
  },
  "height": 120,
  "transparent": false,
  "api": {
    "getStatus": { "method": "GET", "path": "/status" }
  }
}
```

#### `widgets/score/api.js`

Identiek aan verdict widget (`return homey.app.getCurrentSnapshot()` met dezelfde mapping).

#### `widgets/score/public/index.html`

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { margin: 0; }
    .wrap {
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .score {
      font-size: var(--homey-font-size-xxlarge);
      font-weight: var(--homey-font-weight-bold);
      line-height: 1;
      letter-spacing: -0.03em;
    }
    .label {
      font-size: var(--homey-font-size-small);
      color: var(--homey-text-color-light);
      margin-top: var(--homey-su-1);
    }
    .score.yes   { color: var(--homey-color-green-800); }
    .score.maybe { color: #633806; }
    .score.no    { color: var(--homey-color-red-800); }
  </style>
</head>
<body class="homey-widget-small">
  <div class="wrap">
    <div class="score" id="score">—</div>
    <div class="label">van 100</div>
  </div>
  <script>
    function onHomeyReady(Homey) {
      Homey.ready({ height: 120 });
      async function refresh() {
        try {
          const d = await Homey.api('GET', '/status');
          if (!d) return;
          const el = document.getElementById('score');
          el.textContent = d.score ?? '—';
          el.className = 'score ' + (d.status ?? '');
        } catch (e) { console.error(e); }
      }
      refresh();
      setInterval(refresh, 5 * 60 * 1000);
    }
  </script>
</body>
</html>
```

### 12.3 Widget 3: **BBQ Vooruitblik** (7 dagen)

#### `widgets/forecast/widget.compose.json`

```json
{
  "name": {
    "en": "BBQ Forecast",
    "nl": "BBQ-vooruitblik"
  },
  "height": 140,
  "transparent": false,
  "api": {
    "getForecast": { "method": "GET", "path": "/forecast" }
  }
}
```

#### `widgets/forecast/api.js`

```javascript
'use strict';

module.exports = {
  async getForecast({ homey }) {
    const days = homey.app.getForecast();
    if (!days || days.length === 0) return { error: 'No data yet', days: [] };
    return { days };
  },
};
```

#### `widgets/forecast/public/index.html`

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { margin: 0; }
    .grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: var(--homey-su-1);
      height: 100%;
    }
    .day { display: flex; flex-direction: column; align-items: center; }
    .dow {
      font-size: var(--homey-font-size-small);
      color: var(--homey-text-color-light);
      margin-bottom: var(--homey-su-1);
      text-transform: lowercase;
    }
    .cell {
      flex: 1;
      width: 100%;
      border-radius: var(--homey-border-radius-small);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--homey-su-1) 0;
    }
    .cell.yes   { background: var(--homey-color-green-050); color: var(--homey-color-green-800); }
    .cell.maybe { background: #FAEEDA;                      color: #633806; }
    .cell.no    { background: var(--homey-color-red-050);   color: var(--homey-color-red-800); }
    .emoji { font-size: 18px; line-height: 1; }
    .num { font-size: var(--homey-font-size-small); font-weight: var(--homey-font-weight-medium); margin-top: 4px; }
  </style>
</head>
<body class="homey-widget-small">
  <div class="grid" id="grid"></div>
  <script>
    const DOW_NL = ['zo','ma','di','wo','do','vr','za'];
    const EMOJI = { yes: '🔥', maybe: '🤔', no: '🌧️' };

    function onHomeyReady(Homey) {
      Homey.ready({ height: 140 });
      async function refresh() {
        try {
          const res = await Homey.api('GET', '/forecast');
          const days = res?.days ?? [];
          const grid = document.getElementById('grid');
          grid.innerHTML = '';
          for (const d of days) {
            const dt = new Date(d.date);
            const el = document.createElement('div');
            el.className = 'day';
            el.innerHTML =
              '<div class="dow">' + DOW_NL[dt.getDay()] + '</div>' +
              '<div class="cell ' + d.status + '">' +
                '<div class="emoji">' + (EMOJI[d.status] || '') + '</div>' +
                '<div class="num">' + d.score + '</div>' +
              '</div>';
            grid.appendChild(el);
          }
        } catch (e) { console.error(e); }
      }
      refresh();
      setInterval(refresh, 5 * 60 * 1000);
    }
  </script>
</body>
</html>
```

---

## 13. Locales

### 13.1 `locales/nl.json`

```json
{
  "app": {
    "name": "Kan de BBQ aan?",
    "description": "Kan de BBQ vandaag aan? Krijg een helder ja, twijfel of nee."
  },
  "errors": {
    "no_data": "Nog geen weerdata. Even geduld, we halen 'm op.",
    "weather_unavailable": "Weersdata kon niet worden opgehaald. Probeer het later opnieuw."
  }
}
```

### 13.2 `locales/en.json`

```json
{
  "app": {
    "name": "Kan de BBQ aan?",
    "description": "Can the BBQ fire up today? Get a clear yes, maybe, or no."
  },
  "errors": {
    "no_data": "No weather data yet. Please wait a moment while we fetch it.",
    "weather_unavailable": "Weather data could not be retrieved. Please try again later."
  }
}
```

---

## 14. Assets

### 14.1 App icon

**Bestand**: `assets/icon.svg`

Eisen: SVG, transparante achtergrond, vult hele canvas, geen tekst. Ontwerp-suggestie: een gestileerd vlam-icoon in `#D85A30` (brandColor), of een rooster met een vlammetje. Claude Code mag een eenvoudige, werkende SVG aanleveren:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="none">
  <!-- Vlam-silhouet -->
  <path d="M128 32 C 110 72, 76 96, 84 144 C 60 136, 56 172, 72 192 C 56 208, 68 232, 92 232 L 164 232 C 188 232, 200 208, 184 192 C 200 172, 196 136, 172 144 C 180 96, 146 72, 128 32 Z"
        fill="#D85A30"/>
  <path d="M128 88 C 116 112, 100 128, 108 156 C 120 148, 136 144, 136 128 C 136 112, 128 100, 128 88 Z"
        fill="#F5C4B3"/>
</svg>
```

### 14.2 App images (assets/images/)

- `small.png` (250x175) — brand/lifestyle sfeerbeeld
- `large.png` (500x350)
- `xlarge.png` (1000x700)

Het moet een leuke BBQ-sfeer ademen. GEEN logo of clipart. GEEN Homey-logo. Suggestie: een foto/render van een aangestoken BBQ met een vraagteken-wolk erboven, of minimalistisch: een brandend rooster tegen een zachte gradient.

**Claude Code: hiervoor is de gebruiker verantwoordelijk**. Laat een placeholder-image staan van de juiste afmetingen met de tekst "Kan de BBQ aan? — vervang met echte artwork".

### 14.3 Widget previews

Per widget: `preview-light.png` en `preview-dark.png`, allebei 1024x1024. Gebruik Athom's Figma-template (genoemd in guidelines § 1.9). Geen tekst, simpele vormen, transparante achtergrond, Homey-kleurstijlen.

---

## 15. README & publishing

### 15.1 `readme.txt`

```
Een ludieke app met een knipoog: kan de BBQ vandaag aan? "Kan de BBQ aan?" beantwoordt die vraag met een helder JA, TWIJFEL of NEE, gebaseerd op temperatuur, neerslag, wind, luchtvochtigheid en bewolking tijdens het avondvenster. Drie dashboard-widgets laten je in één blik zien of de kolen aan kunnen.

Weersgegevens door Open-Meteo.com (CC BY 4.0). Algoritme geïnspireerd door barbecueradar.nl.
```

Geen markdown, geen URLs (die zijn niet toegestaan in readme volgens guidelines), geen changelog.

### 15.2 `README.md` (repo-level, wél markdown)

Hier mag je wel markdown + URLs gebruiken. Typisch bouwinstructies, contributing, licensie.

### 15.3 `package.json`

```json
{
  "name": "nl.bbqaan.app",
  "version": "1.0.0",
  "description": "Kan de BBQ aan? — a Homey app",
  "main": "app.js",
  "engines": { "node": ">=22" },
  "scripts": {
    "test": "homey app validate --level publish"
  }
}
```

Geen `dependencies`. `fetch` is native in Node 22. Als je later libraries nodig hebt, `npm install` en ze komen erbij.

### 15.4 `.gitignore`

```
node_modules/
.DS_Store
*.log
/env.json
/.homeybuild/
```

### 15.5 Publishing checklist

Voer per release door:

- [ ] `homey app validate --level publish` gaat door (géén errors of warnings).
- [ ] App icon + alle images aanwezig en in juiste afmetingen.
- [ ] Widget previews aanwezig (per widget, light + dark).
- [ ] `readme.txt` is één paragraaf, geen markdown, geen URLs.
- [ ] Geen spelfouten in Nederlandse OF Engelse strings.
- [ ] `brandColor` laat het app-icoon goed uitkomen.
- [ ] `homey app run` draait lokaal zonder errors.
- [ ] Test op echte Homey Pro: app installeren, widget plaatsen, flow activeren en zien triggeren.
- [ ] Changelog via `homey app publish` invullen (niet in readme).

---

## 16. Bouwvolgorde voor Claude Code

Werk deze volgorde af. Elke stap is zelfstandig testbaar. Commit na elke stap zodat je kunt terugrollen.

1. **Scaffolding**: maak de folder structuur (zie § 3), `package.json`, `.gitignore`, lege `app.js`, placeholder `readme.txt`.
2. **Manifest**: `.homeycompose/app.json` (zie § 4) + `locales/nl.json` + `locales/en.json` (zie § 13).
3. **Libraries**: `lib/open-meteo.js` (§ 5), `lib/bbq-algorithm.js` (§ 6), `lib/copy-bank.js` (§ 7). Deze zijn unit-testbaar zonder Homey — schrijf een klein node-testscript dat ze aanroept met een statische Open-Meteo-response om te verifiëren dat het algoritme klopt.
4. **Flow cards**: alle JSON's in `.homeycompose/flow/triggers/`, `/conditions/` en `/actions/` (zie § 9).
5. **App.js**: volledige implementatie (zie § 11) — state, flow listeners, update-loop, trigger-helpers.
6. **Eerste validatie**: `homey app validate`. Fix alle warnings en errors voordat je verder gaat.
7. **App icon**: plaats `assets/icon.svg` (§ 14.1) en placeholder app-images met juiste afmetingen (§ 14.2).
8. **Test met `homey app run`**: installeer op een ontwikkel-Homey, verifieer dat flow-kaarten verschijnen in de Flow Editor en dat een trigger af kan gaan.
9. **Widget 1 (Verdict)**: compose + api + index.html (§ 12.1). Test door de widget aan je dashboard toe te voegen en te verifiëren dat de drie statussen correct kleuren en de copy roteert.
10. **Widget 2 (Score)**: idem (§ 12.2).
11. **Widget 3 (Forecast)**: idem (§ 12.3).
12. **Widget previews**: `preview-light.png` en `preview-dark.png` per widget via Athom's Figma-template (§ 14.3).
13. **Readme + README.md**: `readme.txt` (plain, geen markdown) en `README.md` (repo-level, mag markdown).
14. **Full validate**: `homey app validate --level publish`. Alleen als dit 100% clean is, is de app klaar voor publicatie.

Tussen stap 6 en 8: als `validate` fouten geeft over flow-kaarten, check dat je de condition-listeners in app.js hebt geregistreerd en dat JSON-bestanden correct gepareerd kunnen worden.

---

## 17. Samengevat: hoe dit past bij de SDK-guidelines

- App naam ≤ 4 woorden ✓ ("Kan de BBQ aan?" = 4 woorden, exact op de limiet)
- Geen Homey/Athom/protocolnaam in naam ✓
- Description is één zin, geen "Adds support for..." ✓
- `readme.txt`: geen markdown, geen URLs, één alinea ✓
- Widget previews light+dark, 1024x1024, geen tekst ✓
- Flow titels kort, zonder "when/and/then", geen haakjes ✓
- `brandColor` gezet ✓
- SDK v3, compatibility >=12.3.0 ✓
- Widgets gebruiken `--homey-*` CSS variabelen ✓
- Code is Cloud-compatibel (geen globals, `this.homey.setInterval`, `.catch(this.error)`) ✓
- Open-Meteo attributie in readme ✓

Veel bouwplezier. Bij twijfel tijdens de implementatie: altijd de SDK-docs als bron en valideren met `homey app validate`.
