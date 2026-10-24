// Photon is an open-source geocoder (komoot/photon); no Google key is required.
export async function suggestAddresses(query,fetcher=globalThis.fetch){
  const url=new URL('https://photon.komoot.io/api/');
  url.search=new URLSearchParams({q:query,limit:'6',lang:'en',countrycode:'US'}).toString();
  const response=await fetcher(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(6000)});
  if(!response.ok)throw Error('Address suggestions unavailable');
  const data=await response.json(),seen=new Set();
  return (Array.isArray(data.features)?data.features:[]).flatMap(feature=>{
    const p=feature.properties||{},coords=feature.geometry?.coordinates;
    if(String(p.countrycode).toUpperCase()!=='US'||feature.geometry?.type!=='Point'||!Array.isArray(coords)||!Number.isFinite(coords[0])||!Number.isFinite(coords[1])||Math.abs(coords[0])>180||Math.abs(coords[1])>90)return [];
    const clean=value=>typeof value==='string'?value.trim().slice(0,120):'';
    const street=[clean(p.housenumber),clean(p.street)].filter(Boolean).join(' ');
    const address=[clean(p.name)!==street?clean(p.name):'',street,clean(p.city)||clean(p.town)||clean(p.village),clean(p.state),clean(p.postcode)].filter(Boolean).join(', ').slice(0,180);
    if(!address||seen.has(address))return [];seen.add(address);
    return [{address,lat:coords[1],lon:coords[0],precision:p.housenumber&&p.street?'street-address':'place',source:'Photon / OpenStreetMap'}];
  }).slice(0,6);
}
