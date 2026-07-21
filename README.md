# PrimeMinster — Burnham PM Social Cohesion

Dynamic Chronoflux **social cohesion** analysis for the scenario of **@AndyBurnham** as Prime Minister, with graphs in the structural family of desktop `BURNHAM.md`.

## Live on Render

| Page | URL |
|------|-----|
| **Burnham UI** | https://evolve-perc-internet.onrender.com/burnham |
| Health | https://evolve-perc-internet.onrender.com/health |
| SCS latest | https://evolve-perc-internet.onrender.com/scs/latest |
| SCS score | `POST` https://evolve-perc-internet.onrender.com/scs/score |

Hosted on the existing **evolve-perc-internet** flokkinet node (`perc_chain` auto-deploy from [rgsneddon/evolve](https://github.com/rgsneddon/evolve)).

Dedicated Blueprint for this repo: [`render.yaml`](./render.yaml) — one-click:  
https://render.com/deploy?repo=https://github.com/rgsneddon/primeminster

Env var **names** only (set secrets in Render dashboard, never commit): `PORT`, `NODE_VERSION`, `XAI_API_KEY` (optional live Grok).

## Features

- **SCS engine** — Evolve-style hydrodynamic Chronoflux scoring from observed discourse fields **v / f / s** (+ resistance)
- **SSUCF posed question** ending in **please**
- **Perpetual Grok construe** loop (heuristic offline; live Grok when `XAI_API_KEY` set) — fills **blank fields only**
- **Web page** with radar, doughnut, gauge, history, and Part One/Two/Three report
- **Flokkinet integration** — same routes on Render `evolve-perc-internet` (`perc_chain` internet node)

## Quick start

```bash
cd primeminster
npm test
npm run scs
npm start
# open http://127.0.0.1:9480/
```

### Scoring script

```bash
node scripts/run_scs.js
node scripts/run_scs.js --out capture.json
node scripts/run_scs.js --markdown
node scripts/run_scs.js --construe --blanks
```

### Perpetual construe

```bash
# three ticks locally
$env:SCS_MAX_TICKS=3; node scripts/perpetual_construe.js

# against running server
$env:SCS_SERVER_URL='http://127.0.0.1:9480'; $env:SCS_MAX_TICKS=2; node scripts/perpetual_construe.js
```

## Flokkinet / Render (evolve-perc-internet)

SCS is mounted on the perc internet node:

| Route | Method | Purpose |
|-------|--------|---------|
| `/burnham` | GET | Dynamic web page |
| `/scs/score` | POST | Score scenario (body: v,f,s,r,posedQuestion,construe?) |
| `/scs/cycle` | POST | Construe blanks + score + history |
| `/scs/latest` | GET | Latest result + history |
| `/scs/report` | GET | BURNHAM.md-style Markdown |
| `/scs/scenario` | GET | Seed Burnham-PM scenario |
| `/scs/health` | GET | SCS health |

Local:

```bash
cd evolve_app/perc_chain
npm run start:internet
# http://127.0.0.1:9478/burnham
# POST http://127.0.0.1:9478/scs/score
```

### Credentials (env names only — never commit secrets)

| Variable | Use |
|----------|-----|
| `XAI_API_KEY` | Live Grok construe (optional; heuristic fallback) |
| `RENDER_EXTERNAL_URL` | Set automatically on Render |
| `PORT` / `PERC_RENDEZVOUS_PORT` | Internet node listen port |
| `SCS_DATA_DIR` / `PERC_DATA_DIR` | History persistence |
| `SCS_INTERVAL_MS` / `SCS_MAX_TICKS` | Perpetual loop |

Existing local pattern: `evolve_app/grok_proxy.local.env` (`XAI_API_KEY`, X OAuth vars).

Public health (when network allows): `https://evolve-perc-internet.onrender.com/health`

## Scenario framing

Objective handle `@AndyBunrham` is treated as **@AndyBurnham**. Scenario uses social-discourse-observed construct fields seeded from `BURNHAM.md` structure without freezing its numeric SCS as the only result.
