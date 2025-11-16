const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, '..', 'data', 'database.sqlite');

function openDatabase() {
  if (!fs.existsSync(path.dirname(DB_PATH))) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  }
  const db = new sqlite3.Database(DB_PATH);
  db.serialize(() => {
    db.configure('busyTimeout', 5000);
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA foreign_keys = ON');
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        profession TEXT,
        category TEXT,
        about TEXT,
        city TEXT,
        district TEXT,
        phone TEXT,
        contact_email TEXT,
        website TEXT,
        avatar TEXT,
        banner TEXT,
        gallery TEXT,
        rating REAL DEFAULT 0,
        review_count INTEGER DEFAULT 0,
        completed_jobs INTEGER DEFAULT 0,
        verified INTEGER DEFAULT 0,
        verification_code TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS requests (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT,
        category TEXT,
        description TEXT,
        city TEXT,
        district TEXT,
        status TEXT DEFAULT 'open',
        accepted_offer_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS offers (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
        provider_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message TEXT,
        price REAL,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });
  return db;
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function cb(err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

module.exports = {
  openDatabase,
  run,
  get,
  all,
  DB_PATH,
};
