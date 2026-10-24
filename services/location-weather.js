// Government data adapters. Providers never receive account details or report text.
const NWS = 'https://api.weather.gov';
const CENSUS = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';
const text = (value, max=300) => typeof value==='string' ? value.trim().slice(0,max) : '';
const numeric = value => typeof value==='number' && Number.isFinite(value) ? value : null;
const validPoint = (lat,lon) => Number.isFinite(lat)&&Math.abs(lat)<=90&&Number.isFinite(lon)&&Math.abs(lon)<=180;
const userAgent = () => process.env.NWS_USER_AGENT || 'FloodFinder/2.0 (community weather and incident reporting)';
async function json(url,fetcher){
  const res=await fetcher(url,{headers:{Accept:'application/geo+json, application/json','User-Agent':userAgent()},signal:AbortSignal.timeout(8000)});
  if(!res.ok)throw Object.assign(new Error('External service unavailable'),{status:res.status});
  return res.json();
}
function nwsLink(value){
  const url=new URL(value);
  if(url.origin!==NWS)throw Error('Unexpected weather service URL');
  return url.href;
}
export async function lookupAddress(address,fetcher=globalThis.fetch){
  const url=new URL(CENSUS);
  url.search=new URLSearchParams({address,benchmark:'Public_AR_Current',format:'json'}).toString();
  const data=await json(url.href,fetcher);
  return (data.result?.addressMatches||[]).slice(0,5).flatMap(match=>{
    const lat=numeric(match.coordinates?.y),lon=numeric(match.coordinates?.x);
    return lat!==null&&lon!==null&&validPoint(lat,lon)&&text(match.matchedAddress)?[{address:text(match.matchedAddress),lat,lon}]:[];
  });
}
export async function getLocalWeather(lat,lon,fetcher=globalThis.fetch){
  const fetchedAt=new Date().toISOString();
  const result={source:'National Weather Service',status:'unavailable',fetchedAt,location:{lat,lon,label:`${lat.toFixed(3)}, ${lon.toFixed(3)}`},observation:null,forecast:[]};
  try{
    const point=await json(`${NWS}/points/${lat.toFixed(4)},${lon.toFixed(4)}`,fetcher);
    const props=point.properties||{},place=props.relativeLocation?.properties;
    if(place?.city)result.location.label=[text(place.city,100),text(place.state,10)].filter(Boolean).join(', ');
    const [stations,forecast]=await Promise.allSettled([
      json(nwsLink(props.observationStations),fetcher),json(nwsLink(props.forecast),fetcher)
    ]);
    if(forecast.status==='fulfilled'){
      result.forecast=(forecast.value.properties?.periods||[]).filter(p=>Date.parse(p.endTime)>Date.now()).slice(0,4).map(p=>({
        name:text(p.name,60),startTime:p.startTime,endTime:p.endTime,temperature:numeric(p.temperature),temperatureUnit:text(p.temperatureUnit,5),
        shortForecast:text(p.shortForecast,160),windSpeed:text(p.windSpeed,60),windDirection:text(p.windDirection,10),
        precipitationProbability:numeric(p.probabilityOfPrecipitation?.value)
      }));
    }
    if(stations.status==='fulfilled'){
      // Try the nearest three listed stations; a missing station must not invent observations.
      for(const feature of (stations.value.features||[]).slice(0,3)){
        const station=feature.properties||{},ident=text(station.stationIdentifier,20);
        if(!/^[A-Za-z0-9]+$/.test(ident))continue;
        try{
          const latest=await json(`${NWS}/stations/${ident}/observations/latest`,fetcher);
          const o=latest.properties||{},observedAt=o.timestamp;
          if(!Number.isFinite(Date.parse(observedAt)))continue;
          const temp=numeric(o.temperature?.value),wind=numeric(o.windSpeed?.value),rain=numeric(o.precipitationLastHour?.value);
          result.observation={station:ident,stationName:text(station.name,150),observedAt,
            stale:Date.now()-Date.parse(observedAt)>2*60*60*1000,description:text(o.textDescription,160),
            temperatureF:temp!==null&&o.temperature?.unitCode==='wmoUnit:degC'?Math.round((temp*9/5+32)*10)/10:null,
            windMph:wind===null?null:['wmoUnit:km_h-1','wmoUnit:km_h'].includes(o.windSpeed?.unitCode)?Math.round(wind/1.609344):['wmoUnit:m_s-1','wmoUnit:m_s'].includes(o.windSpeed?.unitCode)?Math.round(wind*2.236936):null,
            humidityPercent:numeric(o.relativeHumidity?.value),
            rainLastHourMm:rain===null?null:o.precipitationLastHour?.unitCode==='wmoUnit:mm'?rain:o.precipitationLastHour?.unitCode==='wmoUnit:m'?rain*1000:null};
          break;
        }catch{/* Try another station while preserving the forecast. */}
      }
    }
    if(result.observation&&!result.observation.stale&&result.forecast.length)result.status='live';
    else if(result.observation||result.forecast.length)result.status='partial';
    result.message=result.status==='unavailable'?'Weather is unavailable for this location. Try a U.S. land location or check weather.gov.':result.status==='partial'?'Some weather data is missing or older than two hours. Check the source times.':'';
  }catch{
    result.message='Weather service unavailable or this location is outside NWS coverage. Try again or check weather.gov.';
  }
  return result;
}
