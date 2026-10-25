import { DatabaseSync, backup } from 'node:sqlite';
import { resolve } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const source=resolve(process.env.DATABASE_PATH || './data/flood-finder.sqlite');
const destination=process.argv[2] && resolve(process.argv[2]);
if(!destination || source===destination || existsSync(destination)) {
  console.error('Usage: node scripts/backup.js NEW_DESTINATION.sqlite (must not exist)');
  process.exit(1);
}
mkdirSync(dirname(destination),{recursive:true});
const db=new DatabaseSync(source,{readOnly:true});
try {
  await backup(db,destination);
  const copy=new DatabaseSync(destination,{readOnly:true});
  try {
    if(copy.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Backup integrity check failed');
  } finally {copy.close();}
  console.log('SQLite backup completed and verified');
} finally {db.close();}
