// Scan a directory of schedule xlsx files, find ones containing "Dontrell"
// and/or members with ≥3 legs. Report what dispatch does with them.

const fs   = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const INDEX = 'C:\\Users\\haile\\Desktop\\wheApps\\rsplit-main\\rsplit-main\\index.html';
const DIR   = process.argv[2] || 'C:\\Users\\haile\\Downloads';

const html = fs.readFileSync(INDEX, 'utf8');
const scriptStartOpen = html.indexOf('>', html.indexOf('<script>\n')) + 1;
const scriptEnd       = html.indexOf('</script>', scriptStartOpen);
let script = html.slice(scriptStartOpen, scriptEnd);
script = script.slice(0, script.indexOf('const $=id=>document.getElementById'));

const factory = new Function(`
  var driverNames = Array.from({length:200},(_,i)=>"Driver "+(i+1));
  ${script}
  return { parseRows, dispatch, pairLegs };
`);
const { parseRows, dispatch } = factory();

const files = fs.readdirSync(DIR)
  .filter(n => /^\d{6}.*\.xlsx$/i.test(n) || /^Trip Log\.xlsx$/i.test(n))
  .map(n => path.join(DIR, n))
  .map(p => ({ p, mtime: fs.statSync(p).mtime }))
  .sort((a, b) => b.mtime - a.mtime)
  .map(o => o.p);

console.log(`Scanning ${files.length} schedule files in ${DIR}\n`);

const hits = [];
for (const f of files) {
  try {
    const wb = XLSX.read(fs.readFileSync(f), { type: 'buffer', cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
    const trips = parseRows(json);
    if (trips.length === 0) continue;

    const hasDontrell = trips.some(t => /dontrell/i.test(t.name));

    const byName = {};
    trips.forEach(t => { (byName[t.name] = byName[t.name] || []).push(t); });
    const multi = Object.entries(byName).filter(([, v]) => v.length >= 3);

    if (hasDontrell || multi.length) {
      hits.push({ f, trips, hasDontrell, multi });
    }
  } catch (e) {
    // skip unreadable
  }
}

console.log(`Files containing Dontrell or ≥3-leg members: ${hits.length}\n`);
hits.forEach(({ f, trips, hasDontrell, multi }) => {
  console.log(`── ${path.basename(f)} (${trips.length} trips${hasDontrell ? ', has DONTRELL' : ''}) ──`);
  multi.forEach(([n, v]) => {
    const wc = v.filter(t => t.willCall).length;
    const tags = v.map(t => `${t.tripNum||'?'}/${t.isReturn?'R':'O'}${t.willCall?'(WC)':''}`).join(' ');
    console.log(`  ${v.length} legs  ${n.padEnd(28)}  wc=${wc}  [${tags}]`);
  });
  console.log('');
});
