

# SMART OPTION CONTRACT SELECTOR – ELITE PRO

A personal-use options trading intelligence dashboard that scans NIFTY option chains via Zerodha Kite Connect API, scores contracts, and highlights the best buy opportunities in real time.

---

## Phase 1: Foundation & Admin Setup

### Admin Token Panel
- A settings page where you paste your daily Kite Connect **access_token** and **API key**
- Token stored securely in Supabase database
- Token used by all backend edge functions to call Kite API

### Supabase Cloud Setup
- Database tables for: `kite_config` (API token), `volume_history` (tick snapshots), `signals` (generated trade signals)
- Edge function to proxy all Kite API calls (keeps credentials off the frontend)

---

## Phase 2: Option Chain Scanner

### Edge Function: Fetch & Score
- Calls Kite Connect's option chain endpoint for NIFTY
- Returns all strikes with LTP, Volume, OI, OI Change, IV
- Stores volume snapshots in `volume_history` table for spike calculation

### Scoring Engine (runs in edge function)
- Normalizes Volume, OI, OI Change, IV, and Volume Spike (0–1)
- Calculates **Confidence Score** using weighted formula (20% each)
- Computes **Volume Acceleration** across recent snapshots (10s, 30s, 1m, 3m, 5m windows)
- Flags contracts with spike > 1.5× average as **VOLUME BURST**

### Signal Generation
- Auto-generates a BUY signal when: #1 ranked + Confidence > 65% + Volume Burst
- Calculates Entry (LTP), SL (0.7×), T1 (1.3×), T2 (1.6×), T3 (2.2×)
- Stores signals in database with 5-minute dedup window

---

## Phase 3: Live Dashboard UI

### Dark Trading Theme
- Professional dark-mode trading terminal aesthetic
- Mobile-first responsive design
- Color-coded confidence indicators (green/yellow/red)

### Dashboard Components
1. **NIFTY Price Header** – Current NIFTY spot price, prominently displayed
2. **PCR Ratio** – Live Put-Call Ratio indicator
3. **Best Contract Card** – Highlighted top-ranked contract with entry/SL/targets
4. **Top 20 Contracts Table** – Sortable table with columns: Symbol, Strike, Type (CE/PE), LTP, Volume, OI, IV, Score, Confidence%, Signal status
5. **Volume Burst Panel** – Live feed of contracts flagged as VOLUME BURST with animated highlights
6. **Signal History** – Recent BUY signals with timestamps

### Auto-Refresh
- Dashboard polls the scanner edge function every 3–5 seconds
- UI updates smoothly with latest rankings and signals
- Visual animations when rankings change or new signals fire

---

## Phase 4: Polish & Enhancements

- Signal popup/toast notifications when a new BUY signal fires
- Sound alert option for new signals
- Strike range filter (ATM ± N strikes)
- CE/PE toggle filter
- Score breakdown tooltip on hover
- Export signals to CSV

