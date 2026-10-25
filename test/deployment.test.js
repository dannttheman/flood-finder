import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {createApp} from '../server.js';

test('readiness, consistent online backup, persistence, and shutdown with a live stream',async()=>{
  const folder=mkdtempSync(join(tmpdir(),'flood-deploy-'));
  const path=join(folder,'live.sqlite');
  let app=createApp({databasePath:path});
  let reader;
  try {
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
    const base=`http://127.0.0.1:${app.server.address().port}`;
    assert.equal((await fetch(base+'/api/ready')).status,200);
    const page=await fetch(base+'/');
    assert.match(await page.text(),/Monitor the event/);
    assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
    for(const [asset,type] of [['/vendor/leaflet/leaflet.js','text/javascript'],['/vendor/leaflet/leaflet.css','text/css'],['/vendor/leaflet/images/marker-icon.png','image/png']]){
      const file=await fetch(base+asset);assert.equal(file.status,200);assert.ok(file.headers.get('content-type').startsWith(type));await file.arrayBuffer();
    }
    const registration=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json','X-FloodFinder':'1'},body:JSON.stringify({name:'Backup user',email:'backup@example.com',password:'long secure test password'})});
    assert.equal(registration.status,201);
    const cookie=registration.headers.get('set-cookie').split(';')[0];
    const destination=join(folder,'backup.sqlite');
    execFileSync(process.execPath,['scripts/backup.js',destination],{env:{...process.env,DATABASE_PATH:path}});
    const restored=new DatabaseSync(destination,{readOnly:true});
    assert.equal(restored.prepare('SELECT email FROM users').get().email,'backup@example.com');
    assert.equal(restored.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
    restored.close();
    assert.throws(()=>execFileSync(process.execPath,['scripts/backup.js',destination],{env:{...process.env,DATABASE_PATH:path},stdio:'pipe'}));
    const events=await fetch(base+'/api/stream');reader=events.body.getReader();
    await reader.read();
    await app.shutdown();
    await reader.cancel();reader=null;
    app=createApp({databasePath:path});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
    const me=await fetch(`http://127.0.0.1:${app.server.address().port}/api/auth/me`,{headers:{Cookie:cookie}});
    assert.equal((await me.json()).user.email,'backup@example.com');
  } finally {
    if(reader)await reader.cancel();
    if(app.server.listening)await app.shutdown();
    rmSync(folder,{recursive:true,force:true});
  }
});
