import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export function connect(path = process.env.DATABASE_PATH || './data/flood-finder.sqlite') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'resident'
        CHECK(role IN ('resident','responder','admin')),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, specialty TEXT NOT NULL,
      contact TEXT NOT NULL DEFAULT '', base_lat REAL, base_lon REAL,
      lead_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      availability TEXT NOT NULL DEFAULT 'available'
        CHECK(availability IN ('available','deployed','offline')),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('flood','road','power','medical','debris','shelter','other')),
      severity TEXT NOT NULL CHECK(severity IN ('low','moderate','high','critical')),
      status TEXT NOT NULL DEFAULT 'reported'
        CHECK(status IN ('reported','verified','dispatched','in_progress','resolved','rejected')),
      lat REAL NOT NULL, lon REAL NOT NULL, address TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL REFERENCES users(id),
      team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY, incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
      team_id TEXT NOT NULL REFERENCES teams(id),
      status TEXT NOT NULL DEFAULT 'assigned'
        CHECK(status IN ('assigned','acknowledged','en_route','on_scene','completed','reassigned','cancelled')),
      assigned_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS updates (
      id TEXT PRIMARY KEY, incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
      actor_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit (
      id TEXT PRIMARY KEY, actor_id TEXT REFERENCES users(id), action TEXT NOT NULL,
      subject_id TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS incidents_status ON incidents(status);
    CREATE INDEX IF NOT EXISTS incidents_created ON incidents(created_at);
    CREATE INDEX IF NOT EXISTS incidents_location ON incidents(lat,lon);
    CREATE INDEX IF NOT EXISTS assignments_incident ON assignments(incident_id);
    CREATE INDEX IF NOT EXISTS assignments_team ON assignments(team_id);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS updates_incident ON updates(incident_id,created_at);
  `);
  return db;
}

export const now = () => new Date().toISOString();
export const id = () => randomUUID();
export function runTransaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const result = fn(); db.exec('COMMIT'); return result; }
  catch (err) { db.exec('ROLLBACK'); throw err; }
}
export function logUpdate(db, incident, actor, action, message = '') {
  db.prepare('INSERT INTO updates VALUES (?,?,?,?,?,?)').run(id(), incident, actor, action, message, now());
}
export function audit(db, actor, action, subject) {
  db.prepare('INSERT INTO audit VALUES (?,?,?,?,?)').run(id(), actor, action, subject, now());
}
export const INCIDENT_SELECT = `SELECT i.id,i.title,i.description,i.category,i.severity,i.status,
  i.lat,i.lon,i.address,i.created_at,i.updated_at,i.team_id,t.name AS team_name
  FROM incidents i LEFT JOIN teams t ON t.id=i.team_id`;

