import { connect, now, audit } from '../store.js';
const [command,emailArg] = process.argv.slice(2);
if (!['promote','demote'].includes(command) || !emailArg) {
  console.error('Usage: npm run admin -- promote admin@example.com  (or demote)');process.exit(1);
}
const email=emailArg.trim().toLowerCase();
const db=connect();
const u=db.prepare('SELECT id,role FROM users WHERE email=?').get(email);
if(!u){console.error('Account not found. Register through the web app first.');process.exit(1);}
const role=command==='promote'?'admin':'resident';
if(u.role==='admin'&&role!=='admin'&&db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin'").get().n<=1){console.error('Cannot demote the last administrator.');process.exit(1);}
db.prepare('UPDATE users SET role=? WHERE id=?').run(role,u.id);
db.prepare('DELETE FROM sessions WHERE user_id=?').run(u.id);
audit(db,u.id,'cli_role_'+command,u.id);
console.log(`${email}: ${role}. Previous sessions revoked; sign in again.`);
db.close();

