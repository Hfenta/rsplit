const XLSX = require('xlsx');
const wb = XLSX.read(require('fs').readFileSync('C:\\Users\\haile\\Desktop\\NEMT\\DailyTripLogs Info\\TripsLog_030526 & 030626.xlsx'), { type: 'buffer', cellDates: false });
console.log('Sheets:', wb.SheetNames);
wb.SheetNames.forEach(name => {
  const ws = wb.Sheets[name];
  console.log(`\n=== Sheet: ${name} ===`);
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  console.log('Rows:', aoa.length);
  aoa.slice(0, 5).forEach((row, i) => console.log(`Row ${i}:`, JSON.stringify(row).slice(0, 300)));
});
