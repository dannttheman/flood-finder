// Nearby official weather hazards. Areas are never converted into invented incident pins.
const NWS='https://api.weather.gov';
const text=(value,max=500)=>typeof value==='string'?value.trim().slice(0,max):'';
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const validPoint=(lat,lon)=>finite(lat)&&Math.abs(lat)<=90&&finite(lon)&&Math.abs(lon)<=180;
const deltaLon=(lon,center)=>((lon-center+540)%360)-180;
const category=event=>/flood|storm surge/i.test(event)?'flood':/tornado|thunderstorm|hurricane|tropical storm/i.test(event)?'storm':/fire|red flag/i.test(event)?'fire':/snow|winter|blizzard|ice|freeze|cold|frost/i.test(event)?'winter':/heat/i.test(event)?'heat':/surf|rip current|marine|gale|tsunami/i.test(event)?'marine':/wind|dust/i.test(event)?'wind':'other';
function polygons(geometry){return geometry?.type==='Polygon'?[geometry.coordinates]:geometry?.type==='MultiPolygon'?geometry.coordinates:[];}
function projectedRing(ring,lat,lon){
  if(!Array.isArray(ring))return [];
  return ring.filter(point=>Array.isArray(point)&&validPoint(point[1],point[0])).map(point=>[deltaLon(point[0],lon)*111.32*Math.cos(lat*Math.PI/180),(point[1]-lat)*111.32]);
}
function containsOrigin(ring){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [xi,yi]=ring[i],[xj,yj]=ring[j];
    if((yi>0)!==(yj>0)&&0<(xj-xi)*(-yi)/(yj-yi)+xi)inside=!inside;
  }
  return inside;
}
export function intersectsRadius(geometry,lat,lon,radiusKm){
  for(const polygon of polygons(geometry)){
    const rings=polygon.map(ring=>projectedRing(ring,lat,lon));
    if(rings[0]?.length<3)continue;
    if(containsOrigin(rings[0])&&!rings.slice(1).some(containsOrigin))return true;
    for(const ring of rings)for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dy=b[1]-a[1];
      const t=Math.max(0,Math.min(1,-(a[0]*dx+a[1]*dy)/(dx*dx+dy*dy||1)));
      if(Math.hypot(a[0]+t*dx,a[1]+t*dy)<=radiusKm)return true;
    }
  }
  return false;
}
const allowedLink=value=>{const url=new URL(value);if(url.origin!==NWS)throw Error('Unexpected NWS URL');return url.href;};
async function json(url,fetcher){
  const response=await fetcher(url,{headers:{Accept:'application/geo+json','User-Agent':process.env.NWS_USER_AGENT||'FloodFinder/3.0 (local hazard map)'},signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error('Official hazard service unavailable');
  return response.json();
}
export function createHazardService(fetcher=globalThis.fetch){
  const zones=new Map();
  async function zoneGeometry(url){
    const link=allowedLink(url),existing=zones.get(link);
    if(existing&&existing.expires>Date.now())return existing.promise;
    const promise=json(link,fetcher).then(data=>{
      if(!polygons(data.geometry).length)throw Error('Zone geometry unavailable');
      return data.geometry;
    }).catch(error=>{zones.delete(link);throw error;});
    if(zones.size>=100)zones.delete(zones.keys().next().value);
    zones.set(link,{promise,expires:Date.now()+86400000});return promise;
  }
  return async function getHazards(lat,lon,radiusKm=25){
    const result={source:'National Weather Service',status:'unavailable',fetchedAt:new Date().toISOString(),location:{lat,lon,label:`${lat.toFixed(3)}, ${lon.toFixed(3)}`},radiusKm,hazards:[],message:''};
    try{
      const point=await json(`${NWS}/points/${lat.toFixed(4)},${lon.toFixed(4)}`,fetcher);
      const properties=point.properties||{},place=properties.relativeLocation?.properties,state=text(place?.state,2);
      if(!/^[A-Z]{2}$/.test(state))throw Error('Location outside supported NWS coverage');
      result.location.label=[text(place?.city,100),state].filter(Boolean).join(', ');
      const pointZones=new Set([properties.forecastZone,properties.county,properties.fireWeatherZone].filter(Boolean));
      // State-wide alerts provide surrounding geography; point alerts also include broad regional notices.
      const feeds=await Promise.allSettled([
        json(`${NWS}/alerts/active?area=${state}`,fetcher),json(`${NWS}/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`,fetcher)
      ]);
      if(feeds.every(feed=>feed.status==='rejected'))throw Error('Alerts unavailable');
      let partial=feeds.some(feed=>feed.status==='rejected'),zoneBudget=64;
      const zoneDeadline=Date.now()+18000;
      const pointIds=new Set(feeds[1].status==='fulfilled'?(feeds[1].value.features||[]).map(feature=>feature.id||feature.properties?.id):[]);
      const features=new Map();
      for(const feed of feeds)if(feed.status==='fulfilled')for(const feature of feed.value.features||[])features.set(feature.id||feature.properties?.id,feature);
      if(features.size>200)partial=true;
      const now=Date.now();
      const orderedFeatures=[...features.values()].sort((a,b)=>Number(pointIds.has(b.id)||(b.properties?.affectedZones||[]).some(zone=>pointZones.has(zone)))-Number(pointIds.has(a.id)||(a.properties?.affectedZones||[]).some(zone=>pointZones.has(zone))));
      for(const feature of orderedFeatures.slice(0,200)){
        const p=feature.properties||{},id=text(feature.id||p.id,300),event=text(p.event,120);
        if(!id||!event||p.status&&p.status!=='Actual'||p.messageType==='Cancel')continue;
        if(Number.isFinite(Date.parse(p.expires))&&Date.parse(p.expires)<=now)continue;
        const type=category(event);
        if(type==='other'&&!/warning|watch|advisory|statement/i.test(event))continue;
        const areas=[],original=feature.geometry;
        if(polygons(original).length){if(intersectsRadius(original,lat,lon,radiusKm))areas.push(original);}
        else{
          const affected=Array.isArray(p.affectedZones)?p.affectedZones:[];
          const ordered=[...affected].sort((a,b)=>Number(pointZones.has(b))-Number(pointZones.has(a)));
          for(let start=0;start<ordered.length;start+=4){
            if(Date.now()>zoneDeadline){partial=true;break;}
            const batch=ordered.slice(start,start+4).filter(link=>{
              if(zones.has(link))return true;
              if(zoneBudget<=0){partial=true;return false;}
              zoneBudget--;return true;
            });
            const resolved=await Promise.allSettled(batch.map(zoneGeometry));
            for(const entry of resolved){if(entry.status==='fulfilled'){if(intersectsRadius(entry.value,lat,lon,radiusKm))areas.push(entry.value);}else partial=true;}
            if(zoneBudget<=0&&start+4<ordered.length){partial=true;break;}
          }
        }
        const textOnly=!areas.length&&!polygons(original).length&&(pointIds.has(feature.id||p.id)||(p.affectedZones||[]).some(zone=>pointZones.has(zone)));
        if(!areas.length&&!textOnly)continue;
        const geometry=areas.length?{type:'MultiPolygon',coordinates:areas.flatMap(area=>polygons(area))}:null;
        result.hazards.push({id,event,category:type,severity:text(p.severity,20),urgency:text(p.urgency,20),certainty:text(p.certainty,20),
          headline:text(p.headline,500),description:text(p.description,8000),instruction:text(p.instruction,6000),area:text(p.areaDesc,1000),
          effective:p.effective||null,onset:p.onset||null,expires:p.expires||null,sent:p.sent||null,
          url:`${NWS}/alerts/${encodeURIComponent(id.split('/').pop())}`,geometry,
          geometrySource:geometry?(polygons(original).length?'alert_polygon':'affected_zone'):'text_only',
          locationNote:geometry?(polygons(original).length?'Official alert boundary; not a precise incident location.':'Official affected zone; coverage may be broader than the hazard.'):'Applies to the selected point; no area boundary is available.'});
      }
      const priority={Extreme:0,Severe:1,Moderate:2,Minor:3,Unknown:4};
      result.hazards.sort((a,b)=>(priority[a.severity]??4)-(priority[b.severity]??4));
      result.status=partial?'partial':'live';
      result.message=partial?'Some official areas could not be loaded. The map may be incomplete.':result.hazards.length?'':'No matching official alerts were returned for this search area. Unreported hazards may still exist.';
    }catch{result.message='Official hazard data is unavailable for this location. Community reports remain available; try again or check weather.gov.';}
    return result;
  };
}
