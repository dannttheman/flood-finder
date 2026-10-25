import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

async function browserHarness(search='',hash='#home'){
  const nodes=new Map(),requests=[];
  const node=selector=>{
    if(!nodes.has(selector))nodes.set(selector,{value:'',checked:false,hidden:true,textContent:'',innerHTML:'',dataset:{},classList:{remove(){},toggle(){}},setAttribute(){},removeAttribute(){},addEventListener(){},showModal(){this.open=true;}});
    return nodes.get(selector);
  };
  node('#sortFilter').value='priority';
  const incidents=[
    {id:'new',title:'New minor report',description:'New report',category:'road',severity:'low',status:'reported',lat:26.35,lon:-80.13,created_at:'2026-10-23T12:00:00Z'},
    {id:'urgent',title:'Older critical report',description:'Critical report',category:'flood',severity:'critical',status:'reported',lat:26.35,lon:-80.13,created_at:'2026-10-22T12:00:00Z'},
    {id:'closed',title:'Resolved critical report',description:'Closed report',category:'flood',severity:'critical',status:'resolved',lat:26.35,lon:-80.13,created_at:'2026-10-23T13:00:00Z'}
  ];
  let events;
  const context=vm.createContext({
    document:{querySelector:node,querySelectorAll:()=>[],addEventListener(){},body:{addEventListener(){}},visibilityState:'visible'},
    location:{hash,search,pathname:'/',origin:'http://localhost'},URL,URLSearchParams,window:{scrollTo(){},addEventListener(){}},console,Date,Set,Number,String,Promise,
    setTimeout,clearTimeout,setInterval:()=>0,navigator:{},
    EventSource:class{constructor(){events=this;this.listeners={};}addEventListener(name,fn){this.listeners[name]=fn;}},
    fetch:async path=>{
      requests.push(path);
      const responses={
        '/api/auth/me':{user:{id:'resident',name:'Test resident',role:'resident'}},
        '/api/incidents/new':{incident:incidents[0],updates:[]},
        '/api/incidents':{incidents},'/api/incidents/mine':{incidents:[incidents[0]]},
        '/api/stats':{active:2,critical:1,resolved:1,total:3},
        '/api/alerts':{alerts:[],status:'live',area:'FL',fetchedAt:'2026-10-23T12:00:00Z'}
      };
      return {ok:true,json:async()=>path.startsWith('/api/geocode?')?{matches:[{address:'201 W PALMETTO PARK RD, BOCA RATON, FL 33432',lat:26.35,lon:-80.09}]}:responses[path]};
    }
  });
  vm.runInContext(readFileSync(new URL('../public/app.js',import.meta.url),'utf8')+'\nglobalThis.driver={route,initialize,filteredIncidents,toggleReportType,ensureReportLocation,clearReportLocation,filteredHazards,setSourceFilter,state,reportResource};',context);
  await context.driver.initialize();
  return {driver:context.driver,node,requests,get events(){return events;}};
}
test('priority puts open urgent reports first; newest and ownership filters work together',async()=>{
  const browser=await browserHarness();
  assert.deepEqual(Array.from(browser.driver.filteredIncidents(),i=>i.id),['urgent','new','closed']);
  browser.node('#sortFilter').value='newest';
  assert.deepEqual(Array.from(browser.driver.filteredIncidents(),i=>i.id),['closed','new','urgent']);
  browser.node('#myReportsFilter').checked=true;
  assert.deepEqual(Array.from(browser.driver.filteredIncidents(),i=>i.id),['new']);
  browser.node('#severityFilter').value='critical';
  assert.equal(browser.driver.filteredIncidents().length,0);
});
test('a burst of incident and assignment events still refreshes public reports',async()=>{
  const browser=await browserHarness();browser.requests.length=0;
  browser.events.listeners.change({data:JSON.stringify({kind:'incidents'})});
  browser.events.listeners.change({data:JSON.stringify({kind:'assignments'})});
  await new Promise(resolve=>setTimeout(resolve,380));
  assert.ok(browser.requests.includes('/api/incidents'));
  assert.ok(browser.requests.includes('/api/stats'));
  assert.ok(browser.requests.includes('/api/incidents/mine'));
  browser.events.listeners.change({data:'invalid-json'});
});

test('report type chips support multiple categories and reset to all reports',async()=>{
  const browser=await browserHarness();
  browser.driver.toggleReportType('flood');
  assert.deepEqual(Array.from(browser.driver.filteredIncidents(),i=>i.id),['urgent','closed']);
  browser.driver.toggleReportType('road');
  assert.equal(browser.driver.filteredIncidents().length,3);
  browser.driver.toggleReportType('flood');
  assert.deepEqual(Array.from(browser.driver.filteredIncidents(),i=>i.id),['new']);
  browser.driver.toggleReportType('all');
  assert.equal(browser.driver.filteredIncidents().length,3);
});

test('typing an address resolves coordinates without a map click and editing it invalidates the old pin',async()=>{
  const browser=await browserHarness();
  browser.node('#reportAddress').value='201 W Palmetto Park Rd, Boca Raton, FL 33432';
  assert.equal(browser.driver.state.reportMap,null);
  assert.equal(await browser.driver.ensureReportLocation(),true);
  assert.equal(browser.node('#reportLat').value,'26.350000');
  assert.equal(browser.node('#reportLon').value,'-80.090000');
  assert.ok(browser.requests.some(path=>path.startsWith('/api/geocode?')));
  browser.node('#reportAddress').value='A different address';browser.driver.clearReportLocation();
  assert.equal(browser.node('#reportLat').value,'');assert.equal(browser.node('#reportLon').value,'');
});

test('source filters keep official areas separate from community reports and reject distant reports',async()=>{
  const browser=await browserHarness();
  browser.driver.state.hazards=[{id:'official-flood',event:'Flood Warning',category:'flood',area:'Local area'}];
  browser.driver.state.incidents.push({id:'far-away',category:'road',lat:35,lon:-85,severity:'critical',status:'reported',created_at:new Date().toISOString()});
  assert.equal(browser.driver.filteredIncidents().length,3);
  browser.driver.setSourceFilter('official');assert.equal(browser.driver.state.filtered.length,0);assert.equal(browser.driver.filteredHazards().length,1);
  browser.driver.setSourceFilter('community');assert.equal(browser.driver.filteredHazards().length,0);assert.equal(browser.driver.state.filtered.length,3);
  browser.driver.setSourceFilter('all');browser.node('#hazardTypeFilter').value='winter';assert.equal(browser.driver.filteredHazards().length,0);
});

test('report resource links use category-specific trusted sources and a useful fallback',async()=>{
  const {driver}=await browserHarness();
  assert.match(driver.reportResource('flood'),/https:\/\/www.weather.gov\/safety\/flood/);
  assert.match(driver.reportResource('power'),/redcross.org.*power-outage.html/);
  assert.match(driver.reportResource('shelter'),/find-an-open-shelter.html/);
  assert.match(driver.reportResource('unknown'),/redcross.org/);
  assert.match(driver.reportResource('unknown',true),/weather.gov\/safety\//);
  assert.match(driver.reportResource('flood'),/rel="noopener noreferrer"/);
});

test('shared community record opens its original submission and separates advice from evidence',async()=>{
  const browser=await browserHarness('?incident=new');
  assert.ok(browser.requests.includes('/api/incidents/new'));
  assert.equal(browser.node('#incidentDialog').open,true);
  const html=browser.node('#incidentDetailContent').innerHTML;
  assert.match(html,/SOURCE \/ USER SUBMISSION/);
  assert.match(html,/No external source citation is attached/);
  assert.match(html,/http:\/\/localhost\/\?incident=new#map/);
  assert.match(html,/General advice, not evidence/);
  assert.doesNotMatch(html,/Could not load incident/);
});


test('first visit opens landing page and informational views remain navigable',async()=>{
  const browser=await browserHarness('', '');
  assert.equal(browser.node('#homeView').hidden,false);
  assert.equal(browser.node('#mapView').hidden,true);
  assert.equal(browser.node('#privacyView').hidden,true);
  const map=await browserHarness('', '#map');
  assert.equal(map.node('#homeView').hidden,true);
  assert.equal(map.node('#mapView').hidden,false);
  for(const view of ['about','privacy','terms','help']){
    const page=await browserHarness('', '#'+view);
    assert.equal(page.node('#'+view+'View').hidden,false);
    assert.equal(page.node('#homeView').hidden,true);
  }
});
