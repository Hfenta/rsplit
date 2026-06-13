// Regression: across all schedules with ≥3-leg members, verify every leg
// of every member lands on a driver (none unassigned, none missing).
const fs   = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const INDEX = 'C:\\Users\\haile\\Desktop\\wheApps\\rsplit-main\\rsplit-main\\index.html';
const DIR   = 'C:\\Users\\haile\\Downloads';

const html = fs.readFileSync(INDEX, 'utf8');
const scriptStartOpen = html.indexOf('>', html.indexOf('<script>\n')) + 1;
const scriptEnd       = html.indexOf('</script>', scriptStartOpen);
let script = html.slice(scriptStartOpen, scriptEnd);
script = script.slice(0, script.indexOf('const $=id=>document.getElementById'));

const oldWarn = console.warn;
const warns = [];
console.warn = (...a) => warns.push(a.join(' '));

const { parseRows, dispatch } = new Function(`
  var driverNames = Array.from({length:200},(_,i)=>"Driver "+(i+1));
  ${script}
  return { parseRows, dispatch };
`)();

const files = fs.readdirSync(DIR)
  .filter(n => /^\d{6}.*\.xlsx$/i.test(n) || /^Trip Log\.xlsx$/i.test(n))
  .map(n => path.join(DIR, n));

let totalOK = 0, totalProblems = 0;
const driverCounts = [2, 3, 5, 10];

for (const f of files) {
  let wb, json, trips;
  try {
    wb = XLSX.read(fs.readFileSync(f), { type: 'buffer', cellDates: false });
    json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    trips = parseRows(json);
    if (trips.length === 0) continue;
  } catch (e) { continue; }

  const byName = {};
  trips.forEach(t => { (byName[t.name] = byName[t.name] || []).push(t); });
  const multi = Object.entries(byName).filter(([, v]) => v.length >= 3);
  if (!multi.length) continue;

  for (const nDrivers of driverCounts) {
    const wbefore = warns.length;
    let res;
    try { res = dispatch(trips, nDrivers); }
    catch (e) { console.log(`${path.basename(f)} n=${nDrivers}: THREW ${e.message}`); totalProblems++; continue; }

    for (const [name, legs] of multi) {
      const placed = [];
      for (const leg of legs) {
        let where = null;
        for (let i = 0; i < res.drivers.length; i++) {
          if (res.drivers[i].trips.some(t => t._key === leg._key)) { where = i; break; }
        }
        if (where == null && res.unassigned.some(t => t._key === leg._key)) where = 'UNASSIGNED';
        placed.push(where);
      }
      const missing = placed.filter(p => p === null).length;
      const unassigned = placed.filter(p => p === 'UNASSIGNED').length;
      const distinctDrivers = new Set(placed.filter(p => typeof p === 'number')).size;
      // Driver split heuristic: if the member's outbound + WC return are on different drivers, flag
      const outIdx = legs.findIndex(l => !l.isReturn);
      const outDriver = outIdx >= 0 ? placed[outIdx] : null;
      const wcOnDifferentDriver = legs
        .map((l, i) => ({ l, p: placed[i] }))
        .filter(o => o.l.willCall && o.l.isReturn)
        .some(o => typeof o.p === 'number' && o.p !== outDriver);

      if (missing || unassigned || wcOnDifferentDriver) {
        console.log(`PROBLEM  ${path.basename(f).padEnd(25)} n=${nDrivers} ${name}: legs=${legs.length} placed=${JSON.stringify(placed)} ${missing?'MISSING ':''}${unassigned?'UNASSIGNED ':''}${wcOnDifferentDriver?'WC-split':''}`);
        totalProblems++;
      } else {
        totalOK++;
      }
    }
    if (warns.length > wbefore) {
      console.log(`WARN ${path.basename(f)} n=${nDrivers}: ${warns.slice(wbefore).join(' | ')}`);
    }
  }
}

console.log(`\nSummary: ${totalOK} OK, ${totalProblems} problems, ${warns.length} total warnings`);
console.warn = oldWarn;
