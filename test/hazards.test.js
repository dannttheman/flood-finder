import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.js';
import {createHazardService,intersectsRadius} from '../services/hazards.js';
const lat=26.36,lon=-80.13;
const rectangle=(x,y,size=.03)=>({type:'Polygon',coordinates:[[[x-size,y-size],[x+size,y-size],[x+size,y+size],[x-size,y+size],[x-size,y-size]]]});
const zone='https://api.weather.gov/zones/forecast/FLZ001';
const point={properties:{relativeLocation:{properties:{city:'Boca Raton',state:'FL'}},forecastZone:zone}};
function feature(id,event,geometry,extra={}){return {id,geometry,properties:{event,status:'Actual',messageType:'Alert',severity:'Severe',certainty:'Observed',headline:event+' affecting the local area',expires:new Date(Date.now()+3600000).toISOString(),affectedZones:[],...extra}};}
const local=feature('local-flood','Flood Warning',rectangle(lon,lat));
const far=feature('distant-storm','Severe Thunderstorm Warning',rectangle(-84,31));
const zoneAlert=feature('local-zone','Coastal Flood Advisory',null,{affectedZones:[zone]});
const old=feature('expired','Flood Warning',rectangle(lon,lat),{expires:'2020-01-01T00:00:00Z'});
const drill=feature('test-only','Tornado Warning',rectangle(lon,lat),{status:'Test'});
let calls=[];
async function provider(url){
  calls.push(url);let data;
  if(url.includes('/points/'))data=point;
  else if(url.includes('/alerts/active?area='))data={features:[local,far,zoneAlert,old,drill]};
  else if(url.includes('/alerts/active?point='))data={features:[local,zoneAlert]};
  else if(url===zone)data={geometry:rectangle(lon+.05,lat)};
  else throw Error('Unexpected endpoint '+url);
  return {ok:true,json:async()=>data};
}
test('area intersection handles containing areas, nearby edges, distant polygons, and holes',()=>{
  assert.equal(intersectsRadius(rectangle(lon,lat),lat,lon,10),true);
  assert.equal(intersectsRadius(rectangle(lon+.1,lat),lat,lon,10),true);
  assert.equal(intersectsRadius(rectangle(-85,31),lat,lon,25),false);
  const withHole=rectangle(lon,lat,1);withHole.coordinates.push(rectangle(lon,lat,.5).coordinates[0]);
  assert.equal(intersectsRadius(withHole,lat,lon,10),false);
  assert.equal(intersectsRadius(withHole,lat,lon,100),true);
});
test('official hazards retain their areas, exclude distant/expired/test alerts, and resolve zone geometry',async()=>{
  const result=await createHazardService(provider)(lat,lon,25);
  assert.equal(result.status,'live');assert.equal(result.location.label,'Boca Raton, FL');
  assert.deepEqual(result.hazards.map(h=>h.id).sort(),['local-flood','local-zone']);
  const flood=result.hazards.find(h=>h.id==='local-flood');assert.equal(flood.geometrySource,'alert_polygon');assert.equal(flood.category,'flood');
  const fallback=result.hazards.find(h=>h.id==='local-zone');assert.equal(fallback.geometrySource,'affected_zone');assert.equal(fallback.geometry.type,'MultiPolygon');
  assert.ok(!('lat' in flood));assert.ok(!('lon' in flood));
});
test('a point notice without geometry stays textual, and an outage does not become a clean safety signal',async()=>{
  const textOnly=await createHazardService(async url=>{
    if(url===zone)throw Error('Zone offline');
    if(url.includes('/points/'))return {ok:true,json:async()=>point};
    return {ok:true,json:async()=>({features:[zoneAlert]})};
  })(lat,lon,25);
  assert.equal(textOnly.status,'partial');assert.equal(textOnly.hazards[0].geometry,null);assert.equal(textOnly.hazards[0].geometrySource,'text_only');
  const unavailable=await createHazardService(async()=>{throw Error('Offline');})(lat,lon,25);
  assert.equal(unavailable.status,'unavailable');assert.equal(unavailable.hazards.length,0);assert.match(unavailable.message,/unavailable/);
});
const folder=mkdtempSync(join(tmpdir(),'flood-hazards-test-'));
const {server}=createApp({databasePath:join(folder,'test.sqlite'),weatherFetch:provider});let base;
before(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;});
after(async()=>{await new Promise(resolve=>server.close(resolve));rmSync(folder,{recursive:true,force:true});});
test('hazards endpoint validates radius and coordinates, and caches repeated area searches',async()=>{
  calls=[];const query='/api/hazards?lat=26.36&lon=-80.13&radius=25';
  const response=await fetch(base+query);assert.equal(response.status,200);assert.equal((await response.json()).hazards.length,2);
  const count=calls.length;await fetch(base+query);assert.equal(calls.length,count);
  assert.equal((await fetch(base+'/api/hazards?lat=26&lon=-80&radius=101')).status,400);
  assert.equal((await fetch(base+'/api/hazards?lat=&lon=-80')).status,400);
});

test('nearby coastal zones are not lost behind a dozen distant statewide notices',async()=>{
  const notices=Array.from({length:16},(_,i)=>feature('far-zone-'+i,'Wind Advisory',null,{affectedZones:['https://api.weather.gov/zones/forecast/FLZ'+(200+i)]}));
  const nearby=feature('coastal-nearby','Coastal Flood Advisory',null,{affectedZones:['https://api.weather.gov/zones/forecast/FLZ168']});
  const result=await createHazardService(async url=>{
    if(url.includes('/points/'))return {ok:true,json:async()=>point};
    if(url.includes('/alerts/active?point='))return {ok:true,json:async()=>({features:[]})};
    if(url.includes('/alerts/active?area='))return {ok:true,json:async()=>({features:[...notices,nearby]})};
    return {ok:true,json:async()=>({geometry:url.endsWith('FLZ168')?rectangle(lon+.05,lat):rectangle(-85,31)})};
  })(lat,lon,25);
  assert.equal(result.status,'live');assert.deepEqual(result.hazards.map(h=>h.id),['coastal-nearby']);
});
