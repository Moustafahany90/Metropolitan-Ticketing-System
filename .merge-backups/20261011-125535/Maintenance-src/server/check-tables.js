const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/maintenance.db', (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the maintenance database.');
});

db.all("SELECT name FROM sqlite_master WHERE type='table';", (err, rows) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log('Tables:');
    rows.forEach(row => {
      console.log(row.name);
    });
  }
  db.close();
});
