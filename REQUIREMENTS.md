# RouteSplit v2.0 — Requirements Checklist

Feature inventory of the current `index.html`. Each item is a verifiable behaviour the app must satisfy.

---

## 1. File Input & Parsing

- [x] Accept `.xlsx`, `.xls`, and `.csv` schedule files via drop zone / file picker
- [x] Read first worksheet only, with `cellDates:false`
- [x] Show filename in the upload label after a successful read
- [x] Show error if the file has no rows / no header row
- [x] Show error if neither member-name nor time columns can be found
- [x] Show a soft yellow warning (not error) when optional columns are missing (cost, mileage, trip number, pickup/delivery address)
- [x] Auto-extract `Schedule date` from the file's date column
- [x] Display trip count after parsing

### 1.1 Fuzzy column resolver

- [x] Match logical fields to actual headers using alias lists (FIRST, LAST, FULLNAME, PHONE, TIME, COST, MILES, TRIPNUM, TRIPTYPE, WILLCALL, PU_ADDR/CITY/ZIP, DL_ADDR/CITY/ZIP, DATE)
- [x] 3-pass match: exact → substring contains → loose alias equality (header ≥ 5 chars)
- [x] Case-insensitive header lookup with fallback getter
- [x] Treat `Will Call` column as either the time value OR a flag

### 1.2 Trip type & leg detection

- [x] Trip Type `T` = outbound, `F` = return
- [x] Trip Number suffix `A` = outbound, `B`–`Z` = return
- [x] Fall back to keyword match on type field (`return`, `inbound`, `back`)
- [x] Detect Will Call from value (`will call`, `w/c`, `wc`, or literal `Time`) OR from `Y` flag column

### 1.3 Time parsing

- [x] Accept JS `Date` objects
- [x] Accept decimal numbers (Excel fractional time)
- [x] Accept `12:45 PM`, `1245`, `1:30`, `13:00`, plain hour
- [x] Honour AM/PM markers
- [x] Reject hours > 23 or minutes > 59
- [x] Treat `Will Call` strings as null time
- [x] **Outbound leg** est. pickup = appt time − drive time (`miles × 3 min`)
- [x] **Return leg** est. pickup = appt time exactly (driver collects member at the appt time; no drive-time offset)

### 1.4 Name resolution

- [x] Build name from first + last
- [x] Fall back to full-name column
- [x] Fall back to pickup address (`STREET, CITY`)
- [x] Fall back to trip number
- [x] Last resort: `Trip N`

---

## 2. UI Controls

- [x] Driver-count stepper, range 2–200
- [x] "Save app" button — download current page as `RouteSplit_v{VERSION}.html`
- [x] Schedule date readout
- [x] Trips-loaded count readout
- [x] Stats bar: total trips, total cost, target cost per driver, unassigned count
- [x] Export Excel button
- [x] Export Word button
- [x] Inline-editable driver name on every card (persists across re-render & file reload)
- [x] 20-colour palette cycling cleanly for up to 200 drivers
- [x] Dark theme with CSS variables (`--bg`, `--panel`, `--accent`, etc.)
- [x] Mobile-responsive grid (cards auto-fill, min 300px)
- [x] Legend with tag meanings
- [x] Dispatching rules footnote on the page

### 2.1 Trip card tags

- [x] `🕒 est. pickup` time tag
- [x] `📅 appt time` tag
- [x] `Nmi · Nmin` miles + drive-time tag
- [x] `↩ return · <label>` return-leg tag with kept-rule label
- [x] `📞 will call` tag
- [x] `🔗 kept same driver` (chain) tag
- [x] `⇄ reassigned` tag
- [x] `› last of day` tag
- [x] Warning tag for unassigned

### 2.2 Address links

- [x] Address renders as clickable `gps` link → Google Maps directions
- [x] 📋 Copy-to-clipboard button per address with `navigator.clipboard` + non-HTTPS textarea fallback

---

## 3. Dispatch Algorithm

### 3.1 Leg pairing (3-pass)

- [x] Pass 1: match outbound + earliest return by shared trip-number prefix
- [x] Pass 2: pair unmatched outbounds to returns by member name, earliest first
- [x] Pass 3: collect any remaining unpaired returns as **orphan legs** (3rd, 4th, etc.) so they're still assigned, not dropped
- [x] Within a multi-leg group, extra returns beyond the first (C, D, …) become orphans and propagate the outbound's name
- [x] Propagate outbound name to return when return name was an address fallback
- [x] Orphan legs are added to the units list as standalone single-leg units (no return), sorted into the main schedule by appt time
- [x] Orphan-leg assignment tagged with `keptRule:"extra"`, `keptTag:"extra leg"` so the UI shows `↩ return · extra leg`

### 3.2 Work-unit construction

- [x] One unit per outbound (with optional return)
- [x] Sum pair fare (outbound + return cost)
- [x] Compute gap between outbound and return appointment times
- [x] Mark `mustKeepReturn` when gap ≤ 60 min and not will-call
- [x] Compute `freeAfter` = baseEnd + 30 min buffer
- [x] Sort units by outbound appointment time ascending

### 3.3 Driver scoring

- [x] Cost balance: weight 100 × normalised deviation from target
- [x] Trip-count balance: weight 100 × normalised deviation
- [x] ZIP cluster proximity: −60 same cluster, −20 adjacent
- [x] Same-time conflict on same driver: +10000 (hard block)
- [x] Timing-gap violation: +10000 (hard block)
- [x] Availability gap: hard penalty < 30 min, soft penalty 30–60 min

### 3.4 Timing rules

- [x] `MIN_OUT_GAP = 60` min between consecutive outbounds on the same driver
- [x] `MIN_OUT_RET_GAP = 45` min between an outbound and a return of a different member on the same driver
- [x] `BUFFER_MIN = 30` min minimum free buffer
- [x] `BUFFER_PREF = 60` min preferred buffer
- [x] `MIN_PER_MILE = 3` for drive-time estimate

### 3.5 Return-leg assignment rules

- [x] Will Call → always same driver as outbound
- [x] Gap ≤ 60 min → same driver keeps both legs (`<Nmin wait>` label)
- [x] Gap > 60 min and original driver still busy at return time → reassign to least-loaded free driver
- [x] Otherwise → original driver keeps the return (`<Nmin gap>` label)

### 3.6 ZIP cluster map (Charlotte metro)

- [x] Cluster labels: EAST, NW, NORTH, SOUTH, SW, WEST, UPTOWN, SE, OTHER
- [x] Explicit per-ZIP map (no numeric-distance proxy)
- [x] Cluster adjacency matrix returning 0 / 1 / 2

### 3.7 Conflict & unassigned handling

- [x] When all drivers are hard-blocked, compare pair-fare of new vs already-assigned conflict
- [x] If new unit costs MORE → swap: move existing (cheaper) pair to Unassigned, assign new
- [x] If new unit costs LESS or equal → push it to Unassigned, existing stays
- [x] Every unassigned trip carries an `unassignedReason` string
- [x] Render an "Unassigned — Requires Manual Dispatch" card spanning full width when any unassigned exist

### 3.8 Post-assignment balance pass

- [x] Up to 15 rounds, stop on no improvement
- [x] MOVE: transfer one unit from overloaded → underloaded driver if score improves
- [x] SWAP: exchange one unit between two drivers if score improves
- [x] Skip any move/swap that would create a same-time conflict on the destination driver
- [x] Skip any move/swap that would violate timing-gap rules
- [x] Score = cost imbalance + trip-count imbalance − (ZIP cohesion × 0.15)
- [x] Cohesion = count of same/adjacent-cluster pairs within a driver's units

### 3.9 Last-trip-of-day rule

- [x] For each driver, find their last outbound by start time
- [x] That member's return MUST be on the same driver — move if currently elsewhere
- [x] Mark the moved return as `forcedLast` (rendered as `› last of day`)

### 3.10 Per-driver trip ordering

- [x] Sort by appointment time ascending (primary)
- [x] Tie-break (within 60 min window) by nearest ZIP cluster to previous drop
- [x] Keep outbound/return leg pairs grouped as a block
- [x] Safe-fallback: leave unsorted if sort produces fewer trips than input

---

## 4. Excel (.xlsx) Export

- [x] Pure OpenXML builder (does not rely on `XLSX` for cell colours)
- [x] Pure-JS ZIP packaging with `CompressionStream('deflate-raw')` and `crc32`
- [x] Falls back to stored (uncompressed) if CompressionStream unavailable

### 4.1 Workbook structure

- [x] Summary sheet first
- [x] One sheet per driver (sheet name truncated to 31 chars)
- [x] Unassigned sheet at end (only when there are unassigned trips)

### 4.2 Summary sheet

- [x] Columns: Driver, Trips, Total Cost, vs Target, % of Total
- [x] Header row with dark fill, light text
- [x] Each driver row tinted with their colour (85% lightened)

### 4.3 Driver sheets

- [x] Columns: Member, Phone, Leg, Est. Pickup, Appt Time, Miles, Drive Min, Pickup Address, Delivery Address, Cost, Notes
- [x] Coloured header row matching the driver card colour
- [x] Outbound rows: light yellow background (`FFFDE7`)
- [x] Return rows: white background, italic font, dim text
- [x] Phone cell uses `HYPERLINK("tel:...", "(XXX) XXX-XXXX")`
- [x] Pickup/Delivery cells use `HYPERLINK` to Google Maps directions
- [x] TOTAL row at bottom with lightened driver colour

### 4.4 Unassigned sheet

- [x] Sheet name `Unassigned` (≤ 31 chars, no special chars)
- [x] Red-themed header (`CC2222`)
- [x] Light red row background (`FFE0E0`)
- [x] Reason column at the end of every row
- [x] TOTAL row at bottom

### 4.5 Styling fundamentals

- [x] Style table with fills / fonts / borders / xfs deduplicated by key
- [x] Thin `D0D5DE` borders on data cells; medium black borders on headers/totals
- [x] Calibri 10/11 pt
- [x] Wrap text on all data cells, centred vertical alignment
- [x] Per-sheet custom column widths

### 4.6 File naming

- [x] Output: `RouteSplit_v{VERSION}_{ScheduleDate}.xlsx`
- [x] Falls back to `dispatch` when no schedule date present
- [x] Special filename chars sanitised to `-`

---

## 5. Word (.doc) Export

- [x] HTML-based document with Office namespaces (`xmlns:o`, `xmlns:w`)
- [x] `@page A4 landscape, 1.5cm margins`
- [x] MIME `application/msword`, extension `.doc`
- [x] Title row with totals + generated-date
- [x] One section per driver with coloured header bar (driver colour)
- [x] Trip table per driver: Member, Leg, Est. Pickup, Appt Time, Pickup Address, Delivery Address, Cost, Notes
- [x] Member cell shows name + clickable `tel:` link on next line
- [x] Address cells are clickable Google Maps links
- [x] Outbound rows light yellow (`#fffde7`), return rows white
- [x] TOTAL footer row with driver-colour-tinted fill
- [x] Unassigned section (red theme) when unassigned trips exist
- [x] Filename: `RouteSplit_v{VERSION}_{ScheduleDate}.doc`

---

## 6. PWA / Offline

- [x] `manifest.json` linked
- [x] `apple-touch-icon` linked
- [x] `theme-color`, `mobile-web-app-capable`, `apple-mobile-web-app-*` meta tags
- [x] Install banner ("Install RouteSplit · Works offline after install") wired to `beforeinstallprompt`
- [x] Install button calls `prompt()`
- [x] Dismiss (×) button hides the banner
- [x] Banner auto-hides on `appinstalled`
- [x] Service worker registered only when `serviceWorker` API present
- [x] Registration skipped in iframes
- [x] Registration restricted to HTTPS or localhost
- [x] Service worker delivered inline (base64 blob → object URL) — no external SW file needed
- [x] SW caches: `./`, `./index.html`, `./manifest.json`, both icons, the XLSX CDN library
- [x] Cache-first fetch strategy; writes successful network responses back to cache
- [x] Old caches purged on `activate`
- [x] Returns `503 Offline` response when both cache and network fail

---

## 7. Self-Save (Single-File Distribution)

- [x] "Save app" button serialises `document.documentElement.outerHTML` to a Blob
- [x] Downloads as `RouteSplit_v{VERSION}.html`
- [x] Button label is dynamically rewritten with the current version on `DOMContentLoaded`

---

## 8. Error Handling

- [x] All file-read errors surface as visible red error banner with message
- [x] Dispatch errors caught; show user-actionable message + top 3 stack frames
- [x] Sort failures caught per-driver; original order kept, warning logged
- [x] Defensive filtering of `undefined` units throughout swap/move passes

---

## 9. Version Metadata

- [x] `APP_VERSION = "2.0"` constant used in titles, filenames, save button
- [x] Version comment block lists v1.0, v1.8, v1.9 changes inline in source
- [x] Page header shows `ROUTESPLIT v2.0`
