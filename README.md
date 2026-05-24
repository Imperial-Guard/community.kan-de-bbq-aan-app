# Kan de BBQ aan?

Een ludieke Homey-app die één vraag beantwoordt: kan de BBQ vandaag aan?

**JA / TWIJFEL / NEE**, plus een korte zin en de onderliggende cijfers, berekend over het avondvenster 17:00–21:00 lokale tijd. Gebruikt [Open-Meteo](https://open-meteo.com) (CC BY 4.0) voor het weer; algoritme geïnspireerd door [barbecueradar.nl](https://barbecueradar.nl).

## Installeren (development)

```bash
npm install -g homey
homey login
homey app run
```

## Publiceren

```bash
homey app validate --level publish
homey app publish
```

## Architectuur

- SDK v3, `platforms: ["local"]` (Homey Pro / Pro mini / Self-Hosted Server).
- App-only: geen drivers, geen devices. State leeft op de App-instance.
- Pollt Open-Meteo elke 30 minuten.
- 3 widgets (Verdict, Score, Vooruitblik), 5 flow-kaarten.

## Licentie

MIT. Weersdata: Open-Meteo (CC BY 4.0).
