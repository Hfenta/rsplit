const fs   = require('fs');
const XLSX = require('xlsx');

const INDEX = 'C:\\Users\\haile\\Desktop\\wheApps\\rsplit-main\\rsplit-main\\index.html';
const SCHED = 'C:\\Users\\haile\\Downloads\\061226.xlsx';

const html = fs.readFileSync(INDEX, 'utf8');
const scriptStartOpen = html.indexOf('>', html.indexOf('<script>\n')) + 1;
const scriptEnd       = html.indexOf('</script>', scriptStartOpen);
let script = html.slice(scriptStartOpen, scriptEnd);
script = script.slice(0, script.indexOf('const $=id=>document.getElementById'));

// Inject debug logs near orphan choice
script = script.replace(
  'if(unit.isOrphanLeg && unit.outbound.willCall){',
  `console.log('>>> orphan WC dispatch:', unit.outbound.tripNum, 'name=', unit.outbound.name);
   if(unit.isOrphanLeg && unit.outbound.willCall){`
);
script = script.replace(
  'const outDriver=drivers.find(d=>d.trips.some(t=>',
  `console.log('>>> drivers state:', drivers.map((d,i)=>({i,trips:d.trips.map(t=>t.tripNum+'/'+(t.isReturn?'R':'O')+'/'+t.name)})));
   const outDriver=drivers.find(d=>d.trips.some(t=>`
);
script = script.replace(
  'if(outDriver && scores[drivers.indexOf(outDriver)]<10000) chosen=outDriver;',
  `console.log('>>> outDriver=', outDriver?drivers.indexOf(outDriver):'none', 'score=', outDriver?scores[drivers.indexOf(outDriver)]:'-');
   if(outDriver && scores[drivers.indexOf(outDriver)]<10000) chosen=outDriver;
   console.log('>>> chosen=', chosen?drivers.indexOf(chosen):'none');`
);

const factory = new Function(`
  var driverNames = Array.from({length:200},(_,i)=>"Driver "+(i+1));
  ${script}
  return { parseRows, dispatch };
`);
const { parseRows, dispatch } = factory();

const wb = XLSX.read(fs.readFileSync(SCHED), { type: 'buffer', cellDates: false });
const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
const trips = parseRows(json);
const res = dispatch(trips, 10);

console.log('\nFinal Dontrell layout:');
trips.filter(t => /dontrell/i.test(t.name)).forEach(leg => {
  let where = 'MISSING';
  for (let i = 0; i < res.drivers.length; i++) {
    if (res.drivers[i].trips.some(t => t._key === leg._key)) { where = `Driver ${i+1}`; break; }
  }
  console.log(`  ${leg.tripNum} ${leg.isReturn?'RET':'OUT'} → ${where}`);
});
