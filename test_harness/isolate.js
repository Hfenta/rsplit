// Isolate the "Sort failed" warning — does it happen pre-fix too?
const fs   = require('fs');
const XLSX = require('xlsx');

const INDEX = 'C:\\Users\\haile\\Desktop\\wheApps\\rsplit-main\\rsplit-main\\index.html';
const SCHED = 'C:\\Users\\haile\\Downloads\\061226.xlsx';

const html = fs.readFileSync(INDEX, 'utf8');
const scriptStartOpen = html.indexOf('>', html.indexOf('<script>\n')) + 1;
const scriptEnd       = html.indexOf('</script>', scriptStartOpen);
let scriptPost = html.slice(scriptStartOpen, scriptEnd);
scriptPost = scriptPost.slice(0, scriptPost.indexOf('const $=id=>document.getElementById'));

const fixA_after  = `if(a.willCall!==b.willCall) return a.willCall?-1:1;\n        return (a.apptMin??1e9)-(b.apptMin??1e9);`;
const fixB_after  = `if(pickupStart!=null && driver.lastEnd!=null){`;
const fixA_before = `// removed will-call priority\n        return (a.apptMin??1e9)-(b.apptMin??1e9);`;
const fixB_before = `if(driver.lastEnd!=null){`;

let scriptPre = scriptPost
  .replace('const pickupStart=unit.outbound.startMin??unit.outAppt;', 'const pickupStart=unit.outbound.startMin??unit.outAppt??0;')
  .replace(fixB_after, fixB_before)
  .replace(fixA_after, fixA_before);

function load(s) {
  return new Function(`
    var driverNames = Array.from({length:200},(_,i)=>"Driver "+(i+1));
    ${s}
    return { parseRows, dispatch };
  `)();
}

const wb   = XLSX.read(fs.readFileSync(SCHED), { type: 'buffer', cellDates: false });
const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });

for (const n of [4, 5, 6, 8, 10]) {
  for (const [label, src] of [['PRE', scriptPre], ['POST', scriptPost]]) {
    const m = load(src);
    const oldWarn = console.warn;
    const warns = [];
    console.warn = (...a) => warns.push(a.join(' '));
    try {
      const trips = m.parseRows(json);
      m.dispatch(trips, n);
    } finally { console.warn = oldWarn; }
    console.log(`n=${n} ${label}: ${warns.length} sort warnings  ${warns[0] || ''}`);
  }
}
