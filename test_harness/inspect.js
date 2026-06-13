const fs   = require('fs');
const XLSX = require('xlsx');

const INDEX = 'C:\\Users\\haile\\Desktop\\wheApps\\rsplit-main\\rsplit-main\\index.html';
const SCHED = process.argv[2];
const N     = parseInt(process.argv[3] || '2', 10);
const NAME  = process.argv[4];

const html = fs.readFileSync(INDEX, 'utf8');
const scriptStartOpen = html.indexOf('>', html.indexOf('<script>\n')) + 1;
const scriptEnd       = html.indexOf('</script>', scriptStartOpen);
let script = html.slice(scriptStartOpen, scriptEnd);
script = script.slice(0, script.indexOf('const $=id=>document.getElementById'));

const { parseRows, dispatch } = new Function(`
  var driverNames = Array.from({length:200},(_,i)=>"Driver "+(i+1));
  ${script}
  return { parseRows, dispatch };
`)();

const wb = XLSX.read(fs.readFileSync(SCHED), { type: 'buffer', cellDates: false });
const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
const trips = parseRows(json);
console.log(`File: ${SCHED}`);
console.log(`Trips: ${trips.length}, Drivers: ${N}`);
const res = dispatch(trips, N);
console.log(`\nUnassigned: ${res.unassigned.length}`);
res.unassigned.forEach(t => console.log(`  ${t.tripNum} ${t.name} (WC=${t.willCall}) appt=${t.apptMin} → "${t.unassignedReason}"`));
console.log(`\nDriver loads:`);
res.drivers.forEach((d, i) => console.log(`  Driver ${i+1}: ${d.trips.length} trips, cost $${d.cost.toFixed(2)}`));

if (NAME) {
  const re = new RegExp(NAME, 'i');
  console.log(`\nLegs of "${NAME}":`);
  trips.filter(t => re.test(t.name)).forEach(leg => {
    let where = 'MISSING';
    for (let i = 0; i < res.drivers.length; i++) {
      if (res.drivers[i].trips.some(t => t._key === leg._key)) { where = `Driver ${i+1}`; break; }
    }
    if (where === 'MISSING' && res.unassigned.some(t => t._key === leg._key)) where = 'UNASSIGNED';
    const time = leg.willCall ? 'Will Call' : (leg.apptMin!=null ? `${Math.floor(leg.apptMin/60)}:${String(leg.apptMin%60).padStart(2,'0')}` : '—');
    console.log(`  ${leg.tripNum.padEnd(12)} ${leg.isReturn?'RET':'OUT'} ${time.padEnd(10)} cost=$${leg.cost} → ${where}`);
  });
}
