import {test} from 'node:test';
import assert from 'node:assert/strict';
import {suggestAddresses} from '../services/address-suggestions.js';
const feature=(properties={},coordinates=[-80.09,26.35])=>({geometry:{type:'Point',coordinates},properties:{countrycode:'US',housenumber:'201',street:'West Palmetto Park Road',city:'Boca Raton',state:'Florida',postcode:'33432',...properties}});
test('Photon suggestions retain provider coordinates, filter invalid/foreign results and deduplicate labels',async()=>{
  let requested;
  const result=await suggestAddresses('201 palmetto',async url=>{requested=new URL(url);return {ok:true,json:async()=>({features:[feature(),feature(),feature({countrycode:'CA'}),feature({},[null,26]),feature({},[0,999]),feature({housenumber:'',street:'',name:'Boca Raton'})]})};});
  assert.equal(requested.searchParams.get('countrycode'),'US');assert.equal(requested.searchParams.get('q'),'201 palmetto');
  assert.equal(result.length,2);assert.equal(result[0].lat,26.35);assert.equal(result[0].precision,'street-address');assert.equal(result[1].precision,'place');
});
test('suggestion outages and malformed provider responses never create locations',async()=>{
  await assert.rejects(suggestAddresses('201 palmetto',async()=>({ok:false})),/unavailable/);
  assert.deepEqual(await suggestAddresses('201 palmetto',async()=>({ok:true,json:async()=>({features:null})})),[]);
});
