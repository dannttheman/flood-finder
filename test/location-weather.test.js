import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.js';
import {getLocalWeather,lookupAddress,lookupArea} from '../services/location-weather.js';
const timestamp=new Date().toISOString();
const forecast={properties:{periods:[{name:'Tonight',startTime:timestamp,endTime:new Date(Date.now()+86400000).toISOString(),temperature:76,temperatureUnit:'F',shortForecast:'Chance of rain',windSpeed:'8 mph',windDirection:'NE',probabilityOfPrecipitation:{value:40}}]}};
const points={properties:{relativeLocation:{properties:{city:'Boca Raton',state:'FL'}},observationStations:'https://api.weather.gov/gridpoints/MFL/100,100/stations',forecast:'https://api.weather.gov/gridpoints/MFL/100,100/forecast'}};
const station={features:[{properties:{stationIdentifier:'KBCT',name:'Boca Raton Airport'}}]};
const observation={properties:{timestamp,textDescription:'Light Rain',temperature:{value:25,unitCode:'wmoUnit:degC'},windSpeed:{value:16.09344,unitCode:'wmoUnit:km_h-1'},relativeHumidity:{value:85},precipitationLastHour:{value:0.001,unitCode:'wmoUnit:m'}}};
const address={result:{addressMatches:[{matchedAddress:'201 W PALMETTO PARK RD, BOCA RATON, FL, 33432',coordinates:{x:-80.09,y:26.35}}]}};
const calls=[];
async function fakeFetch(url){
  calls.push(String(url));
  const path=new URL(url).pathname;
  let data=path.includes('onelineaddress')?address:path.startsWith('/points/')?points:path.endsWith('/stations')?station:path.endsWith('/observations/latest')?observation:path.endsWith('/forecast')?forecast:{features:[]};
  return {ok:true,json:async()=>data};
}
const folder=mkdtempSync(join(tmpdir(),'flood-weather-test-'));
const {server}=createApp({databasePath:join(folder,'test.sqlite'),weatherFetch:fakeFetch});let base;
before(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;});
after(async()=>{await new Promise(resolve=>server.close(resolve));rmSync(folder,{recursive:true,force:true});});
test('address lookup supplies usable coordinates without a map',async()=>{
  const input='201 W Palmetto Park Rd, Boca Raton, FL 33432';
  const response=await fetch(base+'/api/geocode?address='+encodeURIComponent(input));
  assert.equal(response.status,200);const data=await response.json();
  assert.equal(data.matches[0].lat,26.35);assert.equal(data.matches[0].lon,-80.09);
  const url=new URL(calls.find(url=>url.includes('onelineaddress')));assert.equal(url.searchParams.get('address'),input);
  assert.equal((await fetch(base+'/api/geocode?address=x')).status,400);
});
test('weather includes genuine upstream observations and forecasts and caches repeated points',async()=>{
  calls.length=0;
  const response=await fetch(base+'/api/weather?lat=26.35&lon=-80.09');assert.equal(response.status,200);
  const data=await response.json();assert.equal(data.status,'live');assert.equal(data.source,'National Weather Service');
  assert.equal(data.observation.temperatureF,77);assert.equal(data.observation.windMph,10);assert.equal(data.observation.rainLastHourMm,1);
  assert.equal(data.forecast[0].precipitationProbability,40);assert.equal(data.location.label,'Boca Raton, FL');
  const count=calls.length;await fetch(base+'/api/weather?lat=26.35&lon=-80.09');assert.equal(calls.length,count);
  assert.equal((await fetch(base+'/api/weather?lat=999&lon=0')).status,400);
  assert.equal((await fetch(base+'/api/weather?lat=&lon=0')).status,400);
});
test('external outage, missing readings and old observations never become fabricated clear weather',async()=>{
  const unavailable=await getLocalWeather(26,-80,async()=>{throw Error('Offline');});
  assert.equal(unavailable.status,'unavailable');assert.equal(unavailable.observation,null);assert.equal(unavailable.forecast.length,0);
  const partial=await getLocalWeather(26,-80,async url=>{
    if(url.includes('/observations/latest'))return {ok:true,json:async()=>({properties:{timestamp:'2020-01-01T00:00:00Z',temperature:{value:null}}})};
    return fakeFetch(url);
  });
  assert.equal(partial.status,'partial');assert.equal(partial.observation.stale,true);assert.equal(partial.observation.temperatureF,null);
  const noMatch=await lookupAddress('An unmatched address',async()=>({ok:true,json:async()=>({result:{addressMatches:[]}})}));assert.deepEqual(noMatch,[]);
});
test('linked weather URLs cannot redirect the adapter to an unrelated host',async()=>{
  const seen=[];
  const result=await getLocalWeather(26,-80,async url=>{seen.push(url);return {ok:true,json:async()=>({properties:{observationStations:'https://unrelated.example/stations',forecast:'https://unrelated.example/forecast'}})};});
  assert.equal(result.status,'unavailable');assert.equal(seen.length,1);
});

test('ZIP area search supports ZIP+4 and leading zeroes without street geocoding',async()=>{
  const seen=[];
  const zipFetch=async url=>{seen.push(String(url));return {ok:true,json:async()=>({places:[{'place name':'Boston','state abbreviation':'MA',latitude:'42.357',longitude:'-71.063'}]})};};
  for(const value of ['02108','02108-1234']){
    const result=await lookupArea(value,zipFetch);
    assert.equal(result.matches[0].zip,'02108');assert.equal(result.matches[0].precision,'postal-area');assert.equal(result.matches[0].lat,42.357);
  }
  assert.deepEqual(seen,['https://api.zippopotam.us/us/02108','https://api.zippopotam.us/us/02108']);
  await assert.rejects(lookupArea('1234',zipFetch),{code:400});
});
test('ZIP lookup exposes no-match, invalid coordinates and provider failure honestly',async()=>{
  assert.deepEqual((await lookupArea('00000',async()=>({status:404}))).matches,[]);
  assert.deepEqual((await lookupArea('33432',async()=>({ok:true,json:async()=>({places:[{latitude:'',longitude:''}]})}))).matches,[]);
  await assert.rejects(lookupArea('33432',async()=>({ok:false,status:503})),/unavailable/);
});
test('area endpoint accepts a ZIP while precise report geocoding still requires a street address',async()=>{
  const response=await fetch(base+'/api/locations?query=33432');assert.equal(response.status,200);
  const result=await response.json();assert.equal(result.kind,'postal-area');
  assert.equal((await fetch(base+'/api/geocode?address=33432')).status,400);
  assert.equal((await fetch(base+'/api/locations?query=1234')).status,400);
});
