// Compare PRE-FIX vs POST-FIX dispatch on the Dontrell case (061226.xlsx)
// by patching the script in-memory before evaluation.

const fs   = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const INDEX = 'C:\\Users\\haile\\Desktop\\wheApps\\rsplit-main\\rsplit-main\\index.html';
const SCHED = 'C:\\Users\\haile\\Downloads\\061226.xlsx';

const html = fs.readFileSync(INDEX, 'utf8');
const scriptStartOpen = html.indexOf('>', html.indexOf('<script>\n')) + 1;
const scriptEnd       = html.indexOf('</script>', scriptStartOpen);
let scriptPost = html.slice(scriptStartOpen, scriptEnd);
scriptPost = scriptPost.slice(0, scriptPost.indexOf('const $=id=>document.getElementById'));

// Reverse Fix A — Will Call returns no longer prioritised
const fixA_after = `const rets=group.filter(t=>t.isReturn)
      .sort((a,b)=>{
        // Will Call returns MUST stay with the outbound (Rule 3.5),
        // so they take pairing priority over fixed-time returns.
        if(a.willCall!==b.willCall) return a.willCall?-1:1;
        return (a.apptMin??1e9)-(b.apptMin??1e9);
      });`;
const fixA_before = `const rets=group.filter(t=>t.isReturn)
      .sort((a,b)=>(a.apptMin??1e9)-(b.apptMin??1e9));`;

// Reverse Fix B — pickupStart falls back to 0, no null-skip guard
const fixB_after = `const pickupStart=unit.outbound.startMin??unit.outAppt;
    if(pickupStart!=null && driver.lastEnd!=null){
      const gap=pickupStart-driver.lastEnd;
      if(gap<BUFFER_MIN)       score+=(BUFFER_MIN-gap)*50;
      else if(gap<BUFFER_PREF) score+=(BUFFER_PREF-gap)*2;
    }`;
const fixB_before = `const pickupStart=unit.outbound.startMin??unit.outAppt??0;
    if(driver.lastEnd!=null){
      const gap=pickupStart-driver.lastEnd;
      if(gap<BUFFER_MIN)       score+=(BUFFER_MIN-gap)*50;
      else if(gap<BUFFER_PREF) score+=(BUFFER_PREF-gap)*2;
    }`;

let scriptPre = scriptPost.replace(fixA_after, fixA_before).replace(fixB_after, fixB_before);
if (scriptPre === scriptPost) { console.error('Reverse-patch failed — fix markers not found'); process.exit(1); }

function load(s) {
  return new Function(`
    var driverNames = Array.from({length:200},(_,i)=>"Driver "+(i+1));
    ${s}
    return { parseRows, dispatch };
  `)();
}

const pre  = load(scriptPre);
const post = load(scriptPost);

const wb = XLSX.read(fs.readFileSync(SCHED), { type: 'buffer', cellDates: false });
const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });

function trial(label, mod) {
  const trips = mod.parseRows(json);
  const res = mod.dispatch(trips, 10);
  console.log(`\n=== ${label} ===`);
  console.log(`Total drivers used: ${res.drivers.filter(d=>d.trips.length).length} / 10`);
  console.log(`Unassigned: ${res.unassigned.length}`);
  if (res.unassigned.length) {
    res.unassigned.forEach(t => console.log(`  UNASSIGNED ${t.tripNum} ${t.name}: ${t.unassignedReason}`));
  }
  const dontrell = trips.filter(t => /dontrell/i.test(t.name));
  console.log('Dontrell legs:');
  for (const leg of dontrell) {
    let where = 'MISSING';
    for (let i = 0; i < res.drivers.length; i++) {
      if (res.drivers[i].trips.some(t => t._key === leg._key)) { where = `Driver ${i+1}`; break; }
    }
    if (where === 'MISSING' && res.unassigned.some(t => t._key === leg._key)) {
      where = `UNASSIGNED (${res.unassigned.find(t => t._key === leg._key).unassignedReason})`;
    }
    const time = leg.willCall ? 'Will Call' : `${Math.floor(leg.apptMin/60)}:${String(leg.apptMin%60).padStart(2,'0')}`;
    console.log(`  ${leg.tripNum} ${leg.isReturn?'RET':'OUT'} ${time.padEnd(10)} → ${where}`);
  }
}

for (const n of [2, 3, 4]) {
  console.log(`\n\n############ numDrivers = ${n} ############`);
  trialN('PRE-FIX (original code)', pre, n);
  trialN('POST-FIX (current index.html)', post, n);
}

function trialN(label, mod, numDrivers) {
  const trips = mod.parseRows(json);
  const res = mod.dispatch(trips, numDrivers);
  console.log(`\n=== ${label} (${numDrivers} drivers) ===`);
  console.log(`Drivers used: ${res.drivers.filter(d=>d.trips.length).length} / ${numDrivers} | Unassigned: ${res.unassigned.length}`);
  if (res.unassigned.length) res.unassigned.forEach(t => console.log(`  UNASSIGNED ${t.tripNum} ${t.name}: ${t.unassignedReason}`));
  const dontrell = trips.filter(t => /dontrell/i.test(t.name));
  for (const leg of dontrell) {
    let where = 'MISSING';
    for (let i = 0; i < res.drivers.length; i++) {
      if (res.drivers[i].trips.some(t => t._key === leg._key)) { where = `Driver ${i+1}`; break; }
    }
    if (where === 'MISSING' && res.unassigned.some(t => t._key === leg._key)) {
      where = `UNASSIGNED (${res.unassigned.find(t => t._key === leg._key).unassignedReason})`;
    }
    const time = leg.willCall ? 'Will Call' : `${Math.floor(leg.apptMin/60)}:${String(leg.apptMin%60).padStart(2,'0')}`;
    console.log(`  ${leg.tripNum} ${leg.isReturn?'RET':'OUT'} ${time.padEnd(10)} → ${where}`);
  }
}
