// Test harness: runs RouteSplit dispatch on a real schedule and reports
// what happens to each multi-leg member (≥3 legs).
//
// Usage: node run.js <path-to-schedule.xlsx>

const fs   = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const INDEX = path.resolve(__dirname, '..', 'rsplit-main', 'index.html');
const SCHED = process.argv[2] || 'C:\\Users\\haile\\Desktop\\NEMT\\DailyTripLogs Info\\TripsLog_030526 & 030626.xlsx';

// ── 1. Pull the <script> block out of index.html ────────────────────────────
const html = fs.readFileSync(INDEX, 'utf8');
const scriptStart = html.indexOf('<script>\n');
const scriptStartOpen = html.indexOf('>', scriptStart) + 1;
const scriptEnd   = html.indexOf('</script>', scriptStartOpen);
let script = html.slice(scriptStartOpen, scriptEnd);

// ── 2. Strip the DOM-touching tail (everything from `const $=id=>...` on) ──
const cutAt = script.indexOf('const $=id=>document.getElementById');
if (cutAt < 0) throw new Error('Could not locate DOM section to cut');
script = script.slice(0, cutAt);

// ── 3. Evaluate the dispatch JS in a sandbox, return parseRows + dispatch ──
const factory = new Function(`
  var driverNames = Array.from({length:200},(_,i)=>"Driver "+(i+1));
  ${script}
  return { parseRows, dispatch, pairLegs };
`);
const { parseRows, dispatch, pairLegs } = factory();

// ── 4. Load and parse the schedule ─────────────────────────────────────────
console.log('Loading schedule:', SCHED);
const wb = XLSX.read(fs.readFileSync(SCHED), { type: 'buffer', cellDates: false });
const ws = wb.Sheets[wb.SheetNames[0]];
const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
console.log('Rows in sheet:', json.length);

const trips = parseRows(json);
console.log('Parsed trips:', trips.length);

// ── 5. Locate Dontrell ─────────────────────────────────────────────────────
const dontrell = trips.filter(t => /dontrell/i.test(t.name));
console.log(`\n── Dontrell legs in schedule: ${dontrell.length} ──`);
dontrell.forEach(t => {
  console.log(`  ${t.tripNum.padEnd(12)} | name="${t.name}" | isReturn=${t.isReturn} | willCall=${t.willCall} | apptMin=${t.apptMin} | cost=${t.cost}`);
});

// Also list all members with ≥3 legs (in case the name is spelled differently)
const byName = {};
trips.forEach(t => { (byName[t.name] = byName[t.name] || []).push(t); });
const multi = Object.entries(byName).filter(([, v]) => v.length >= 3);
console.log(`\n── All members with ≥3 legs (${multi.length} total) ──`);
multi.forEach(([n, v]) => {
  const wc = v.filter(t => t.willCall).length;
  console.log(`  ${v.length} legs: ${n}  (will-call legs: ${wc})`);
});

// ── 6. Run dispatch and report on Dontrell + any ≥3-leg members ────────────
const NUM_DRIVERS = 10;
const res = dispatch(trips, NUM_DRIVERS);
console.log(`\n── Dispatch result: ${res.drivers.length} drivers, ${res.unassigned.length} unassigned ──`);

function reportMember(name) {
  console.log(`\n── Where did "${name}" end up? ──`);
  const legs = trips.filter(t => t.name === name);
  if (!legs.length) { console.log('  (no legs found)'); return; }
  for (const leg of legs) {
    let location = 'MISSING';
    for (let i = 0; i < res.drivers.length; i++) {
      if (res.drivers[i].trips.some(t => t._key === leg._key)) {
        location = `Driver ${i + 1} (${res.drivers[i].name})`;
        break;
      }
    }
    if (location === 'MISSING' && res.unassigned.some(t => t._key === leg._key)) {
      const u = res.unassigned.find(t => t._key === leg._key);
      location = `UNASSIGNED — reason: "${u.unassignedReason}"`;
    }
    const time = leg.willCall ? 'Will Call' : (leg.apptMin != null ? `${Math.floor(leg.apptMin/60)}:${String(leg.apptMin%60).padStart(2,'0')}` : '—');
    console.log(`  ${leg.tripNum.padEnd(12)} ${leg.isReturn?'RET':'OUT'} ${time.padEnd(10)} → ${location}`);
  }
}

const seen = new Set();
multi.forEach(([n]) => { reportMember(n); seen.add(n); });
if (dontrell.length && !seen.has(dontrell[0].name)) reportMember(dontrell[0].name);

console.log(`\nTotal unassigned: ${res.unassigned.length}`);
if (res.unassigned.length) {
  console.log('Unassigned trips:');
  res.unassigned.forEach(t => console.log(`  ${t.tripNum} ${t.name}: ${t.unassignedReason}`));
}
