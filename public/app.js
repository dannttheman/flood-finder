/* Flood Finder client: every mutation is backed by a real API endpoint. */
'use strict';
const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];
const allowedViews = ['home','map','admin','tasks','help','about','privacy','terms'];
const categories = {flood:'Flooding',road:'Road / access',power:'Power / utility',medical:'Medical / safety',debris:'Storm debris',shelter:'Shelter need',other:'Other'};
const symbols={flood:'≋',road:'⛔',power:'⚡',medical:'✚',debris:'◈',shelter:'⌂',other:'!'};
const statusLabel = s => ({in_progress:'In progress'}[s] || String(s||'').replaceAll('_',' '));
const escapeHtml = x => String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shortDate = d => d ? new Date(d).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : 'Unknown';
const formatCoordinate = n => Number(n).toFixed(5);
const state={hazards:[],hazardMeta:null,visibleHazards:[],searchCircle:null,user:null,incidents:[],filtered:[],teams:[],users:[],assignments:[],metrics:null,stats:null,map:null,reportMap:null,reportMarker:null,markers:null,weatherLayer:null,routeLayer:null,routeMarkers:null,selected:null,lastRefresh:null,stream:null,authMode:'login',mapReady:false};
let debounceTimer,toastTimer,refreshTimer;
let pendingReport = false;
const pendingChanges = new Set();
const selectedReportTypes=new Set();
let reportAddressMatches=[],areaAddressMatches=[],reportLookupVersion=0,areaLookupVersion=0,hazardVersion=0;
let searchArea={lat:26.3683,lon:-80.1289};
let sourceFilter='all';
let selectedAreaLabel=null;
let myReportIds = new Set();
async function api(path,{method='GET',body}={}) {
  const opts={method,credentials:'same-origin',headers:{'Accept':'application/json'}};
  if(method!=='GET'){opts.headers['X-FloodFinder']='1';opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(body||{});}
  const res=await fetch(path,opts);
  let data;try{data=await res.json();}catch{throw Error('Server sent an invalid response');}
  if(!res.ok)throw Error(data.error||`Request failed (${res.status})`);
  return data;
}
function toast(message,type='success') {
  const el=$('#toast');el.textContent=message;el.className='toast'+(type==='error'?' error':'');el.hidden=false;
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,5500);
}
function formError(selector,message){const el=$(selector);el.hidden=!message;el.textContent=message||'';}
function loadingButton(button,yes,label){button.disabled=yes;if(yes){button.dataset.oldLabel=button.textContent;button.textContent='Working…';}else button.textContent=label||button.dataset.oldLabel||button.textContent;}
function openDialog(selector){const el=$(selector);if(!el.open)el.showModal();}
function closeDialog(selector){const el=$(selector);if(el?.open)el.close();}
function requireLogin(onReady){if(state.user){onReady();return;}pendingReport=true;toast('Create an account or sign in to continue your report.');openAuth('register');}
function openAuth(mode='login') {
  state.authMode=mode;
  $('#loginTab').classList.toggle('active',mode==='login');
  $('#registerTab').classList.toggle('active',mode==='register');
  $('#nameField').hidden=mode!=='register';$('#authName').required=mode==='register';
  $('#authPassword').autocomplete=mode==='register'?'new-password':'current-password';
  $('#authPassword').minLength=mode==='register'?12:0;
  $('#passwordHint').hidden=mode!=='register';
  $('#authHeading').textContent=mode==='login'?'Welcome back.':'Join your community.';
  $('#authDesc').textContent=mode==='login'?'Sign in to report incidents and follow your submissions.':'Create a secure account to contribute real incident information.';
  $('#authSubmit').textContent=mode==='login'?'Sign in ↗':'Create account ↗';
  formError('#authError','');openDialog('#authDialog');
}
async function submitAuth(e){
  e.preventDefault();const form=e.currentTarget;
  const b={email:form.elements.email.value,password:form.elements.password.value};
  if(state.authMode==='register')b.name=form.elements.name.value;
  const button=$('#authSubmit');loadingButton(button,true);
  formError('#authError','');
  try{
    const data=await api('/api/auth/'+(state.authMode==='register'?'register':'login'),{method:'POST',body:b});
    state.user=data.user;form.reset();closeDialog('#authDialog');updateAuthUI();await Promise.all([refreshPrivate(),fetchIncidents()]);route();toast('Signed in as '+data.user.name);if(pendingReport){pendingReport=false;openReport();}
  }catch(ex){formError('#authError',ex.message)}finally{loadingButton(button,false,state.authMode==='register'?'Create account ↗':'Sign in ↗');}
}
async function logout(){
  try{await api('/api/auth/logout',{method:'POST'});state.user=null;state.teams=[];state.users=[];state.assignments=[];state.metrics=null;updateAuthUI();route();toast('You have signed out.');}
  catch(e){toast(e.message,'error')}
}
function updateAuthUI(){
  const u=state.user;
  $('#userBadge').hidden=!u;$('#userBadge').textContent=u?.name||'';
  $('#accountButton').hidden=!!u;$('#signUpButton').hidden=!!u;$('#logoutButton').hidden=!u;
  $('#adminNav').hidden=u?.role!=='admin';
  $('#tasksNav').hidden=!u||!['responder','admin'].includes(u.role);
  $('#myReportsControl').hidden=!u;
  if(!u){$('#myReportsFilter').checked=false;myReportIds.clear();renderIncidents();}
}
function route(){
  let target=location.hash.replace(/^#/,'')||'home';
  if(!allowedViews.includes(target))target='home';
  if(target==='admin'&&state.user?.role!=='admin')target='map';
  if(target==='tasks'&&!['responder','admin'].includes(state.user?.role))target='map';
  for(const v of allowedViews)$('#'+v+'View').hidden=v!==target;
  $$('[data-nav]').forEach(el=>el.classList.toggle('active',el.dataset.nav===target));
  $('.nav-links').classList.remove('open');
  $('#mobileMenu').setAttribute('aria-expanded','false');
  $$('[data-nav]').forEach(el=>{if(el.dataset.nav===target)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  if(target==='map'){
    initializeMap();setTimeout(()=>{state.map?.invalidateSize();},90);
    renderIncidents();renderHazards();
  }
  document.title = `Flood Finder | ${{home:'Local knowledge, shared clearly',map:'Local Hazard Map',about:'About',help:'How it works',privacy:'Privacy',terms:'Responsible use',admin:'Command center',tasks:'My assignments'}[target]}`;
  if(target==='admin')renderAdmin();
  if(target==='tasks')renderAssignments();
  window.scrollTo({top:0,behavior:'instant'});
}
function statsRender(){
  const s=state.stats||{active:0,critical:0,resolved:0,total:0};
  $('#statActive').textContent=s.active;$('#statCritical').textContent=s.critical;$('#statResolved').textContent=s.resolved;
}
async function fetchIncidents(){
  const [incidentData,statsData,mine]=await Promise.all([api('/api/incidents'),api('/api/stats'),state.user?api('/api/incidents/mine'):Promise.resolve({incidents:[]})]);
  myReportIds=new Set(mine.incidents.map(i=>i.id));
  $('#connectionNotice').hidden=true;
  state.incidents=incidentData.incidents;state.stats=statsData;state.lastRefresh=new Date();
  $('#lastUpdated').textContent='Updated '+state.lastRefresh.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
  statsRender();renderIncidents();if(!$('#adminView').hidden)renderAdmin();
}
async function refreshPrivate(){
  if(!state.user)return;
  try{
    if(state.user.role==='admin'){
      const [teams,users,metrics,assignments]=await Promise.all([api('/api/teams'),api('/api/admin/users'),api('/api/admin/metrics'),api('/api/assignments/mine')]);
      state.teams=teams.teams;state.users=users.users;state.metrics=metrics;state.assignments=assignments.assignments;renderAdmin();renderAssignments();
    }else if(state.user.role==='responder'){
      const [teams,assignments]=await Promise.all([api('/api/teams'),api('/api/assignments/mine')]);state.teams=teams.teams;state.assignments=assignments.assignments;renderAssignments();
    }
  }catch(e){toast('Unable to load team data: '+e.message,'error')}
}
async function refreshAll(){
  const results=await Promise.allSettled([fetchIncidents(),refreshPrivate(),fetchHazards()]);
  if(results[0].status==='rejected')showConnectionError();
  if(results.some(r=>r.status==='rejected'))toast('Some information could not refresh. Check your connection and try again.','error');
}
function showConnectionError(){
  $('#connectionNotice').textContent='Reports could not refresh. Information on screen may be out of date. Use Refresh to try again.';
  $('#connectionNotice').hidden=false;
}
function fitReports(){
  if(!state.map)return;
  const bounds=L.latLngBounds(state.filtered.map(report=>[report.lat,report.lon]));
  for(const hazard of state.visibleHazards)if(hazard.geometry){const area=L.geoJSON(hazard.geometry).getBounds();if(area.isValid())bounds.extend(area);}
  if(bounds.isValid())state.map.fitBounds(bounds,{padding:[45,75],maxZoom:14});
  else if(state.searchCircle)state.map.fitBounds(state.searchCircle.getBounds(),{padding:[30,60]});
}

function filteredIncidents(){
  const q=$('#searchFilter').value.trim().toLowerCase(),status=$('#statusFilter').value,severity=$('#severityFilter').value;
  const onlyMine=$('#myReportsFilter').checked;
  const items=state.incidents.filter(i=>distanceKm(i.lat,i.lon)<=searchRadius()&&(!selectedReportTypes.size||selectedReportTypes.has(i.category))&&(!status||i.status===status)&&(!severity||i.severity===severity)&&(!onlyMine||myReportIds.has(i.id))&&(!q||[i.title,i.description,i.address,i.id].some(v=>String(v||'').toLowerCase().includes(q))));
  const rank={critical:0,high:1,moderate:2,low:3};
  return items.sort((a,b)=>{
    if($('#sortFilter').value==='priority'){
      const closed=i=>['resolved','rejected'].includes(i.status)?1:0;
      const difference=closed(a)-closed(b)||(rank[a.severity]??4)-(rank[b.severity]??4);
      if(difference)return difference;
    }
    return new Date(b.created_at)-new Date(a.created_at);
  });
}
function toggleReportType(type){
  if(type==='all')selectedReportTypes.clear();
  else if(selectedReportTypes.has(type))selectedReportTypes.delete(type);
  else selectedReportTypes.add(type);
  updateTypeChips();renderIncidents();
}
function updateTypeChips(){
  $$('[data-report-type]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.reportType==='all'?selectedReportTypes.size===0:selectedReportTypes.has(button.dataset.reportType))));
}
function distanceKm(lat,lon){
  if(!Number.isFinite(lat)||!Number.isFinite(lon))return Infinity;
  const rad=Math.PI/180,dlat=(lat-searchArea.lat)*rad,dlon=(lon-searchArea.lon)*rad;
  const a=Math.sin(dlat/2)**2+Math.cos(searchArea.lat*rad)*Math.cos(lat*rad)*Math.sin(dlon/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)));
}
const searchRadius=()=>Number($('#radiusFilter').value)||25;
function setSourceFilter(value){
  if(!['all','official','community'].includes(value))return;
  sourceFilter=value;$$('[data-source-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.sourceFilter===value)));renderIncidents();
}
function filteredHazards(){
  const type=$('#hazardTypeFilter').value,q=$('#searchFilter').value.trim().toLowerCase();
  return sourceFilter==='community'?[]:state.hazards.filter(h=>(!type||h.category===type)&&(!q||[h.event,h.headline,h.area].some(value=>String(value||'').toLowerCase().includes(q))));
}
async function fetchHazards(){
  const version=++hazardVersion;
  $('#hazardStatus').textContent='Checking official hazards…';
  if(state.hazardMeta&&(state.hazardMeta.location?.lat!==searchArea.lat||state.hazardMeta.location?.lon!==searchArea.lon||state.hazardMeta.radiusKm!==searchRadius())){state.hazards=[];renderIncidents();}
  try{
    const data=await api(`/api/hazards?lat=${searchArea.lat}&lon=${searchArea.lon}&radius=${searchRadius()}`);
    if(version!==hazardVersion)return;
    state.hazardMeta=data;state.hazards=data.hazards||[];
    $('#areaName').textContent=selectedAreaLabel||data.location?.label||'Selected area';
    $('#hazardStatus').textContent=(data.status==='live'?'Official feed updated ':data.status==='partial'?'Partial official coverage · ':'Official feed unavailable · ')+shortDate(data.fetchedAt);
    $('#hazardNotice').hidden=!data.message;$('#hazardNotice').textContent=data.message||'';
    renderHazards();
  }catch{
    if(version!==hazardVersion)return;
    state.hazards=[];state.hazardMeta={status:'unavailable'};
    $('#hazardStatus').textContent='Official feed unavailable';$('#hazardNotice').hidden=false;
    $('#hazardNotice').textContent='Official hazards could not refresh. Community reports remain available. Try Refresh or check weather.gov.';
    renderHazards();
  }
}
function renderHazards(){renderIncidents();}
function renderHazardAreas(){
  if(!state.map||!state.weatherLayer)return;
  state.weatherLayer.clearLayers();
  if($('#alertsToggle').checked&&sourceFilter!=='community'){
    for(const hazard of state.visibleHazards)if(hazard.geometry){
      try{state.weatherLayer.addData({type:'Feature',properties:{id:hazard.id,event:hazard.event,severity:hazard.severity,geometrySource:hazard.geometrySource},geometry:hazard.geometry});}catch{console.warn('Skipped invalid official hazard boundary');}
    }
    state.weatherLayer.addTo(state.map);
  }else if(state.map.hasLayer(state.weatherLayer))state.map.removeLayer(state.weatherLayer);
  if(state.searchCircle)state.map.removeLayer(state.searchCircle);
  state.searchCircle=L.circle([searchArea.lat,searchArea.lon],{radius:searchRadius()*1000,color:'#536f85',weight:1,dashArray:'5 6',fill:false,interactive:false}).addTo(state.map);
}

function reportResource(category,official=false){
  const links={
    flood:['https://www.weather.gov/safety/flood','NWS · Flood safety'],
    storm:['https://www.weather.gov/safety/thunderstorm','NWS · Storm safety'],
    wind:['https://www.weather.gov/safety/wind','NWS · Wind safety'],
    fire:['https://www.weather.gov/safety/wildfire','NWS · Wildfire safety'],
    winter:['https://www.weather.gov/safety/cold','NWS · Cold weather safety'],
    heat:['https://www.weather.gov/safety/heat','NWS · Heat safety'],
    marine:['https://www.weather.gov/safety/ripcurrent','NWS · Surf and rip currents'],
    power:['https://www.redcross.org/get-help/how-to-prepare-for-emergencies/types-of-emergencies/power-outage.html','American Red Cross · Power outages'],
    shelter:['https://www.redcross.org/get-help/disaster-relief-and-recovery-services/find-an-open-shelter.html','American Red Cross · Find shelter']
  };
  const [url,label]=links[category]||(official?['https://www.weather.gov/safety/','NWS · Safety resources']:['https://www.redcross.org/get-help/disaster-relief-and-recovery-services.html','American Red Cross · Disaster assistance']);
  return `<a class="resource-link" href="${url}" target="_blank" rel="noopener noreferrer"><span>Safety guidance<small>${label} · General advice, not evidence for this report</small></span><span aria-hidden="true">↗</span></a>`;
}
function setupAddressAutocomplete(kind){
  if(typeof Awesomplete==='undefined')return;
  const input=$('#'+kind+'Address'),status=$('#'+kind+'AddressResults');
  // Override the library's HTML renderer: provider labels are always text nodes.
  const widget=new Awesomplete(input,{minChars:4,maxItems:6,sort:false,autoFirst:false,filter:()=>true,
    item:function(text,value,index){const li=document.createElement('li');li.textContent=text.label;li.setAttribute('role','option');li.setAttribute('aria-selected','false');li.id=`awesomplete_list_${this.count}_item_${index}`;return li;}});
  let timer,version=0,matches=[],composing=false;
  function cancel(){clearTimeout(timer);version++;matches=[];widget.list=[];widget.close();input.removeAttribute('aria-busy');}
  function changed(){
    cancel();status.textContent='';const query=input.value.trim();
    if(composing||query.length<4||/^\d+(?:-\d*)?$/.test(query))return;
    const current=version;
    timer=setTimeout(async()=>{
      if(current!==version)return;
      status.textContent='Finding addresses…';input.setAttribute('aria-busy','true');
      try{
        const data=await api('/api/location-suggestions?query='+encodeURIComponent(query));
        if(current!==version||input.value.trim()!==query)return;
        matches=kind==='report'?data.matches.filter(match=>match.precision==='street-address'):data.matches;
        widget.list=matches.map((match,index)=>({label:match.address,value:String(index)}));
        status.textContent=matches.length?'Use ↑ / ↓ and Enter, or select an address.':'No suggestions. Add city and state, or enter the full address and use '+(kind==='area'?'Locate.':'Find address.');
      }catch(error){if(current===version)status.textContent=error.message;}
      finally{if(current===version)input.removeAttribute('aria-busy');}
    },650);
  }
  input.addEventListener('input',changed);
  input.addEventListener('compositionstart',()=>{composing=true;cancel();});
  input.addEventListener('compositionend',()=>{composing=false;changed();});
  input.addEventListener('awesomplete-selectcomplete',event=>{
    const match=matches[Number(event.text.value)];if(!match)return;
    cancel();status.textContent='';
    if(kind==='report'){reportLookupVersion++;reportAddressMatches=[];useReportAddress(match);$('#reportLocationStatus').textContent='Suggested address selected. Check the location before publishing.';}
    else{areaLookupVersion++;areaAddressMatches=[];useAreaAddress(match);}
  });
  input.addEventListener('keydown',event=>{if(event.key==='Escape'){cancel();status.textContent='';}});
  input.form?.addEventListener('submit',cancel);
  // Leaving the field cannot reopen a stale dropdown or keep a queued request alive.
  input.addEventListener('blur',()=>{cancel();});
}

function openHazard(ident){
  const hazard=state.hazards.find(item=>item.id===ident);if(!hazard)return;
  $('#hazardDetailContent').innerHTML=`<p class="source-label official-source">OFFICIAL · NATIONAL WEATHER SERVICE</p><h2 id="hazardHeading">${escapeHtml(hazard.event)}</h2><p><span class="status-tag">${escapeHtml(hazard.severity)} · ${escapeHtml(hazard.certainty)}</span></p><p class="detail-body">${escapeHtml(hazard.headline)}</p><p class="hazard-location-note">${escapeHtml(hazard.locationNote)}</p><div class="detail-grid"><div class="detail-cell"><small>AFFECTED AREA</small><strong>${escapeHtml(hazard.area)}</strong></div><div class="detail-cell"><small>EXPIRES</small><strong>${escapeHtml(shortDate(hazard.expires))}</strong></div></div><h3>Official description</h3><p class="detail-body">${escapeHtml(hazard.description||'No additional description supplied.')}</p><h3>Instructions from the issuer</h3><p class="detail-body">${escapeHtml(hazard.instruction||'No additional instructions supplied. Check the official source.')}</p><a class="button button-outline" href="${escapeHtml(hazard.url)}" target="_blank" rel="noopener noreferrer">Open official alert</a>${hazard.geometry?'<button class="button button-outline" id="showHazardArea">Show affected area</button>':''}${reportResource(hazard.category,true)}`;
  if(hazard.geometry)$('#showHazardArea').addEventListener('click',()=>{closeDialog('#hazardDialog');location.hash='#map';if(state.map){const bounds=L.geoJSON(hazard.geometry).getBounds();if(bounds.isValid())state.map.fitBounds(bounds,{padding:[40,50],maxZoom:12});}});
  openDialog('#hazardDialog');
}
function showAddressMatches(container,matches,kind){
  $(container).innerHTML=matches.length?matches.map((match,index)=>`<button type="button" data-address-kind="${kind}" data-address-index="${index}">${escapeHtml(match.address)} <span>Use this address ↗</span></button>`).join(''):'<p class="weather-notice">No matching U.S. street address. Include the street number, city, state, and ZIP. You can also use the optional map.</p>';
}
function clearReportLocation(){
  reportLookupVersion++;reportAddressMatches=[];$('#reportAddressResults').innerHTML='';
  $('#reportLat').value='';$('#reportLon').value='';
  if(state.reportMarker&&state.reportMap){state.reportMap.removeLayer(state.reportMarker);state.reportMarker=null;}
  $('#reportLocationStatus').textContent='Address changed. Its location will be looked up before publishing.';
}
function useReportAddress(match){
  $('#reportAddress').value=match.address;
  setReportPin(match.lat,match.lon,'address');
  state.reportMap?.setView([match.lat,match.lon],16);
  $('#reportAddressResults').innerHTML='';
}
async function findReportAddress(){
  const address=$('#reportAddress').value.trim();
  if(/^\d{5}(?:-\d{4})?$/.test(address))throw Error('A ZIP covers a whole area. Enter a street address for this incident, or set a precise location with the optional map.');
  if(address.length<8)throw Error('Enter a full U.S. street address, or choose a location using the optional map.');
  const version=++reportLookupVersion;
  $('#reportLocationStatus').textContent='Looking up the address…';
  const result=await api('/api/geocode?address='+encodeURIComponent(address));
  if(version!==reportLookupVersion)throw Error('The address changed during lookup. Find the new address before publishing.');
  reportAddressMatches=result.matches;
  if(result.matches.length===1){useReportAddress(result.matches[0]);return true;}
  showAddressMatches('#reportAddressResults',result.matches,'report');
  $('#reportLocationStatus').textContent=result.matches.length?'Choose a matching address below.':'Address not found. Try a more complete address or use the optional map.';
  return false;
}
async function ensureReportLocation(){
  if($('#reportLat').value!==''&&$('#reportLon').value!=='')return true;
  return findReportAddress();
}
async function findAreaAddress(e){
  e.preventDefault();const button=$('#areaSearchButton'),version=++areaLookupVersion;
  loadingButton(button,true);
  try{
    const result=await api('/api/locations?query='+encodeURIComponent($('#areaAddress').value.trim()));
    if(version!==areaLookupVersion)return;
    areaAddressMatches=result.matches;
    if(result.matches.length===1)useAreaAddress(result.matches[0]);
    else if(result.matches.length)showAddressMatches('#areaAddressResults',result.matches,'area');
    else $('#areaAddressResults').textContent=result.message||'No location matched. Try a ZIP or full street address.';
  }catch(error){$('#areaAddressResults').textContent=error.message;}
  finally{loadingButton(button,false,'Locate ↗');}
}
function useAreaAddress(match){
  searchArea={lat:match.lat,lon:match.lon};selectedAreaLabel=match.address;$('#areaAddress').value=match.zip||match.address;$('#areaAddressResults').innerHTML='';
  $('#areaPrecision').textContent=match.precision==='postal-area'?'Approximate ZIP center':match.precision==='place'?'Place location · approximate':'Address location';renderIncidents();
  state.map?.setView([match.lat,match.lon],match.precision==='postal-area'?11:13);fetchHazards();
}
function severityPill(i){return `<span class="pill severity-${escapeHtml(i.severity)}">${escapeHtml(i.severity)}</span>`;}
function renderIncidents(){
  state.filtered=sourceFilter==='official'?[]:filteredIncidents();state.visibleHazards=filteredHazards();
  $('#feedCount').textContent=state.filtered.length+state.visibleHazards.length;
  const official=state.visibleHazards.map(h=>`<button class="incident-item official-item" data-hazard-id="${escapeHtml(h.id)}" type="button"><span class="source-label official-source">OFFICIAL · NWS</span><div class="incident-item-top"><strong>${escapeHtml(h.event)}</strong><span class="status-tag">${escapeHtml(h.severity)}</span></div><p class="incident-description">${escapeHtml(h.headline||h.area)}</p><div class="incident-meta"><span>${h.geometrySource==='affected_zone'?'Affected zone':h.geometry?'Alert boundary':'Area notice · no boundary'}</span><span>Until ${shortDate(h.expires)}</span></div></button>`).join('');
  const community=state.filtered.map(i=>`<button class="incident-item" data-open-id="${i.id}" type="button"><span class="source-label">USER SUBMISSION · ${escapeHtml(statusLabel(i.status))}</span><div class="incident-item-top">${severityPill(i)}<span class="status-tag">${escapeHtml(categories[i.category])}</span></div><div class="incident-title">${escapeHtml(i.title)}</div><p class="incident-description">${escapeHtml(i.description)}</p><div class="incident-meta"><span>${escapeHtml(i.address||'Pinned location')}</span><span>${shortDate(i.created_at)}</span></div></button>`).join('');
  $('#incidentFeed').innerHTML=official+community||'<div class="empty-state"><strong>No matching situations to display.</strong><br>Try another source, type, search radius, or location. This does not establish that the area is safe.</div>';
  if(!state.map)return;
  state.markers?.clearLayers();
  for(const i of state.filtered){
    const severity=['resolved','rejected'].includes(i.status)?'resolved':i.severity;
    const marker=L.marker([i.lat,i.lon],{icon:L.divIcon({className:'',html:`<div class="map-pin ${severity}"><span>${symbols[i.category]||'!'}</span></div>`,iconSize:[38,38],iconAnchor:[20,36]})});
    marker.bindTooltip(escapeHtml(i.title),{direction:'top',offset:[0,-29]});marker.on('click',()=>openIncident(i.id));state.markers.addLayer(marker);
  }
  renderHazardAreas();
}
function initializeMap(){
  if(state.map||typeof L==='undefined'){
    if(typeof L==='undefined')$('#incidentMap').innerHTML='<div class="map-load-error">Map library could not load. Check internet access or your network restrictions. Reports are still accessible in the list.</div>';
    return;
  }
  const initial=[26.3683,-80.1289];
  state.map=L.map('incidentMap',{zoomControl:true}).setView(initial,9);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'}).addTo(state.map);
  state.markers=L.layerGroup().addTo(state.map);state.weatherLayer=L.geoJSON(null,{style:feature=>({color:['Extreme','Severe'].includes(feature.properties.severity)?'#ac412f':'#b57b22',weight:2,fillOpacity:.13,dashArray:feature.properties.geometrySource==='affected_zone'?'6 4':undefined}),onEachFeature:(feature,layer)=>{
    layer.bindTooltip(escapeHtml(feature.properties.event));layer.on('click',()=>openHazard(feature.properties.id));
  }});
  state.mapReady=true;renderIncidents();
}
function setReportPin(lat,lon,source='map'){
  $('#reportLocationStatus').textContent=source==='address'?'Address found. Location is ready; map selection is optional.':'Location set using the map or coordinates.';
  $('#reportLat').value=Number(lat).toFixed(6);$('#reportLon').value=Number(lon).toFixed(6);
  if(state.reportMap){
    if(state.reportMarker)state.reportMarker.setLatLng([lat,lon]);
    else state.reportMarker=L.marker([lat,lon],{draggable:true}).addTo(state.reportMap).on('dragend',ev=>{
      const p=ev.target.getLatLng();setReportPin(p.lat,p.lng);
    });
  }
}
function openReport(){
  requireLogin(()=>{
    formError('#reportError','');$('#reportForm').reset();reportLookupVersion++;reportAddressMatches=[];$('#reportAddressResults').innerHTML='';$('#reportLocationStatus').textContent='Enter an address to locate this report automatically.';$('#reportMapOptions').open=false;$('#reportLat').value='';$('#reportLon').value='';
    if(state.reportMarker&&state.reportMap){state.reportMap.removeLayer(state.reportMarker);state.reportMarker=null;}
    openDialog('#reportDialog');
    setTimeout(()=>{
      if(typeof L==='undefined'){formError('#reportError','Map preview unavailable. Address lookup and coordinate entry still work.');return;}
      if(!state.reportMap){
        const center=state.map?state.map.getCenter():{lat:26.3683,lng:-80.1289};
        state.reportMap=L.map('reportMap').setView([center.lat,center.lng],12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(state.reportMap);
        state.reportMap.on('click',e=>setReportPin(e.latlng.lat,e.latlng.lng));
      }
      state.reportMap.invalidateSize();
      if(state.map){const p=state.map.getCenter();state.reportMap.setView([p.lat,p.lng],state.map.getZoom()>13?13:state.map.getZoom());}
    },100);
  });
}
async function submitReport(e){
  e.preventDefault();const form=e.currentTarget,button=$('#reportSubmit');formError('#reportError','');
  loadingButton(button,true);
  try{
    if(!await ensureReportLocation())return;
    const b=Object.fromEntries(new FormData(form).entries());b.lat=Number(b.lat);b.lon=Number(b.lon);
    if(!Number.isFinite(b.lat)||Math.abs(b.lat)>90||!Number.isFinite(b.lon)||Math.abs(b.lon)>180)throw Error('Choose a valid location.');
    const result=await api('/api/incidents',{method:'POST',body:b});closeDialog('#reportDialog');
    searchArea={lat:result.incident.lat,lon:result.incident.lon};selectedAreaLabel=result.incident.address||'Report location';$('#areaPrecision').textContent='Report location';$('#areaAddress').value=result.incident.address||'';
    await fetchIncidents();fetchHazards();location.hash='#map';
    setTimeout(()=>{state.map?.setView([result.incident.lat,result.incident.lon],14);openIncident(result.incident.id);},120);
    toast('Your report is now on the map and awaiting verification.');
  }catch(ex){formError('#reportError',ex.message)}finally{loadingButton(button,false,'Publish community report ↗');}
}
async function openIncident(ident){
  const content=$('#incidentDetailContent');content.innerHTML='<div class="empty-state">Loading report…</div>';
  openDialog('#incidentDialog');
  try{
    const data=await api('/api/incidents/'+encodeURIComponent(ident));const i=data.incident;
    state.selected=i;
    const reportLink=new URL(location.pathname,location.origin);reportLink.searchParams.set('incident',i.id);reportLink.hash='map';
    const navigate=`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(i.lat+','+i.lon)}`;
    const teamOptions=state.teams.map(t=>`<option value="${t.id}" ${t.id===i.team_id?'selected':''}>${escapeHtml(t.name)} (${escapeHtml(t.availability)})</option>`).join('');
    const admin=state.user?.role==='admin';
    const updates=data.updates.map(u=>`<div class="update-item"><strong>${escapeHtml(statusLabel(u.action))} <small>· ${shortDate(u.created_at)}</small></strong><p>${escapeHtml(u.message)}</p><small>${escapeHtml(u.actor_role)} action</small></div>`).join('');
    content.innerHTML=`<div class="modal-kicker">COMMUNITY REPORT / ${escapeHtml(i.id.slice(0,8).toUpperCase())}</div><h2 class="detail-title" id="detailHeading">${escapeHtml(i.title)}</h2><div class="detail-header">${severityPill(i)}<span class="status-tag">${escapeHtml(statusLabel(i.status))}</span><span class="status-tag">${escapeHtml(categories[i.category])}</span></div><div class="provenance-card"><span class="source-label">SOURCE / USER SUBMISSION</span><strong>Reported by a community member</strong><p>This is a user-provided observation, not an official alert. Review status reflects review within Flood Finder; it does not establish confirmation by an outside authority.</p><a href="${escapeHtml(reportLink.href)}">Open this report’s original record ↗</a><small>No external source citation is attached to this submission.</small></div><p class="detail-body">${escapeHtml(i.description)}</p>
    <div class="detail-grid"><div class="detail-cell"><small>LOCATION</small><strong>${escapeHtml(i.address||'Coordinates pinned by reporter')}</strong></div><div class="detail-cell"><small>COORDINATES</small><strong>${formatCoordinate(i.lat)}, ${formatCoordinate(i.lon)}</strong></div><div class="detail-cell"><small>FIRST REPORTED</small><strong>${shortDate(i.created_at)}</strong></div><div class="detail-cell"><small>ASSIGNED TEAM</small><strong>${escapeHtml(i.team_name||'Not assigned')}</strong></div></div>
    <div class="detail-actions"><button type="button" class="button button-outline" id="centerIncident">⌖ Show on map</button><a class="button button-outline" href="${navigate}" rel="noopener noreferrer" target="_blank">↗ Open navigation</a><button type="button" class="button button-outline" id="copyCoordinates">Copy coordinates</button></div>
    ${admin?`<div class="admin-edit"><div class="detail-section-heading">COMMAND CENTER · REVIEW & DISPATCH</div><form id="incidentAdminForm"><div class="form-row"><label>Review status<select name="status">${['reported','verified','dispatched','in_progress','resolved','rejected'].map(s=>`<option value="${s}" ${s===i.status?'selected':''}>${escapeHtml(statusLabel(s))}</option>`).join('')}</select></label><label>Priority<select name="severity">${['low','moderate','high','critical'].map(s=>`<option value="${s}" ${s===i.severity?'selected':''}>${s}</option>`).join('')}</select></label></div><label>Assign a response team<select name="team_id"><option value="">No team assigned</option>${teamOptions}</select></label><label>Operational update (public log)<textarea name="note" maxlength="500" rows="2" placeholder="Describe verification or dispatch decision. Avoid sensitive details."></textarea></label><button class="button button-primary button-full" type="submit">Save and dispatch ↗</button><div class="form-error" id="adminIncidentError" role="alert" hidden></div></form>${i.team_id?`<button id="routeTeam" type="button" class="button button-outline button-full" style="margin-top:12px">↗ Show team-to-incident route</button>`:''}</div>`:''}
    <div class="detail-section-heading">INCIDENT HISTORY</div><div class="updates-feed">${updates||'<div class="empty-state">No updates recorded.</div>'}</div>${reportResource(i.category)}`;
    $('#centerIncident').addEventListener('click',()=>{closeDialog('#incidentDialog');location.hash='#map';setTimeout(()=>{state.map?.setView([i.lat,i.lon],15);},110);});
    $('#copyCoordinates').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(`${i.lat}, ${i.lon}`);toast('Coordinates copied.');}catch{toast('Clipboard unavailable.','error');}});
    if(admin){$('#incidentAdminForm').addEventListener('submit',e=>submitAdminIncident(e,i.id));$('#routeTeam')?.addEventListener('click',()=>routeTeamToIncident(i));}
  }catch(e){content.innerHTML='<div class="empty-state">Could not load incident: '+escapeHtml(e.message)+'</div>';}
}
async function submitAdminIncident(e,ident){
  e.preventDefault();const form=e.currentTarget,b=Object.fromEntries(new FormData(form).entries());const btn=form.querySelector('[type=submit]');
  formError('#adminIncidentError','');loadingButton(btn,true);
  try{
    await api('/api/admin/incidents/'+ident,{method:'PATCH',body:b});
    await Promise.all([fetchIncidents(),refreshPrivate()]);
    toast('Report updated and team assignment saved.');await openIncident(ident);
  }catch(ex){formError('#adminIncidentError',ex.message)}finally{if(btn.isConnected)loadingButton(btn,false,'Save and dispatch ↗');}
}
async function routeTeamToIncident(i){
  const team=state.teams.find(t=>t.id===i.team_id);
  if(!team||team.base_lat==null||team.base_lon==null){toast('Add the team’s real base coordinates before routing.','error');return;}
  closeDialog('#incidentDialog');location.hash='#map';
  setTimeout(async()=>{
    if(!state.map){toast('The map is not available','error');return;}
    if(state.routeLayer){state.map.removeLayer(state.routeLayer);state.routeLayer=null;}
    if(state.routeMarkers){state.map.removeLayer(state.routeMarkers);state.routeMarkers=null;}
    const box=$('#routeInfo');box.hidden=false;box.innerHTML='<strong>Calculating road route…</strong>';
    try{
      const params=new URLSearchParams({from_lat:team.base_lat,from_lon:team.base_lon,to_lat:i.lat,to_lon:i.lon});
      const result=await api('/api/route?'+params);
      const line=result.coordinates.map(p=>[p[1],p[0]]);
      state.routeLayer=L.polyline(line,{color:'#008d78',weight:5,opacity:.85}).addTo(state.map);
      state.map.fitBounds(state.routeLayer.getBounds(),{padding:[60,60]});
      const km=(result.distance_m/1000).toFixed(1),minutes=Math.round(result.duration_s/60);
      box.innerHTML=`<strong>${escapeHtml(team.name)} → ${escapeHtml(i.title)}</strong>Estimated driving route: ${km} km · ~${minutes} min. Not flood-safe verified.<div><button id="clearRoute">Clear route ×</button></div>`;
    }catch(e){
      state.routeLayer=L.polyline([[team.base_lat,team.base_lon],[i.lat,i.lon]],{color:'#db9361',weight:3,dashArray:'7 7'}).addTo(state.map);
      state.map.fitBounds(state.routeLayer.getBounds(),{padding:[60,60]});
      box.innerHTML=`<strong>Road route not available.</strong>Orange dotted line is straight-line direction only—not a drivable route. Check road closures and official directions.<div><button id="clearRoute">Clear indication ×</button></div>`;
    }
    state.routeMarkers=L.layerGroup([L.marker([team.base_lat,team.base_lon]).bindTooltip(escapeHtml(team.name)+' base')]).addTo(state.map);
    $('#clearRoute')?.addEventListener('click',clearRoute);
  },150);
}
function clearRoute(){if(state.routeLayer)state.map.removeLayer(state.routeLayer);if(state.routeMarkers)state.map.removeLayer(state.routeMarkers);state.routeLayer=state.routeMarkers=null;$('#routeInfo').hidden=true;}
function renderAdmin(){
  if(state.user?.role!=='admin')return;
  const s=state.stats||{total:0};
  $('#adminTotal').textContent=s.total;
  $('#adminPending').textContent=state.incidents.filter(i=>i.status==='reported').length;
  $('#adminDispatch').textContent=state.incidents.filter(i=>['dispatched','in_progress'].includes(i.status)).length;
  $('#adminTeams').textContent=state.teams.length;
  const sorted=[...state.incidents].filter(i=>!['resolved','rejected'].includes(i.status)).sort((a,b)=>{
    const sev={critical:4,high:3,moderate:2,low:1};return sev[b.severity]-sev[a.severity] || a.created_at.localeCompare(b.created_at);
  });
  $('#adminQueue').innerHTML=sorted.length?sorted.slice(0,20).map(i=>`<div class="queue-item"><div class="queue-main"><div class="queue-top">${severityPill(i)}<span class="status-tag">${escapeHtml(statusLabel(i.status))}</span></div><strong>${escapeHtml(i.title)}</strong><small>${escapeHtml(i.address||formatCoordinate(i.lat)+', '+formatCoordinate(i.lon))} · ${shortDate(i.created_at)}</small></div><button type="button" data-open-id="${i.id}">Manage ↗</button></div>`).join(''):'<div class="empty-state">No active reports in the queue.</div>';
  const metrics=state.metrics||{byCategory:[],days:[]};
  const max=Math.max(1,...metrics.byCategory.map(x=>x.count));
  $('#categoryChart').innerHTML=metrics.byCategory.length?metrics.byCategory.map(v=>`<div class="bar-row"><span>${escapeHtml(categories[v.label]||v.label)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round(v.count/max*100)}%"></div></div><strong>${v.count}</strong></div>`).join(''):'<div class="empty-state">No reports yet. Categories appear as submissions arrive.</div>';
  const days=[];
  for(let n=13;n>=0;n--){const d=new Date();d.setDate(d.getDate()-n);const date=d.toISOString().slice(0,10);days.push({day:date,count:metrics.days.find(v=>v.day===date)?.count||0});}
  const mx=Math.max(1,...days.map(x=>x.count));
  $('#activityChart').innerHTML=days.map(d=>`<div class="activity-day" title="${d.day}: ${d.count} reports"><div style="height:${Math.max(3,Math.round(d.count/mx*95))}%"></div><small>${d.day.slice(8)}</small></div>`).join('');
  $('#teamsList').innerHTML=state.teams.length?state.teams.map(t=>`<div class="team-card"><div><strong>${escapeHtml(t.name)}</strong><p>${escapeHtml(t.specialty)} · ${escapeHtml(t.lead_name||'No crew lead')}</p></div><div><span class="availability ${escapeHtml(t.availability)}">${escapeHtml(t.availability)}</span><button type="button" data-edit-team="${t.id}">Edit</button></div></div>`).join(''):'<div class="empty-state">No response teams created. Add a crew with a real location and registered lead.</div>';
  $('#userList').innerHTML=state.users.length?state.users.map(u=>`<div class="user-row"><div><strong>${escapeHtml(u.name)}${u.id===state.user.id?' (you)':''}</strong><small>${escapeHtml(u.email)}</small></div><select aria-label="Role for ${escapeHtml(u.name)}" data-user-role="${u.id}"><option value="resident" ${u.role==='resident'?'selected':''}>Resident</option><option value="responder" ${u.role==='responder'?'selected':''}>Responder</option><option value="admin" ${u.role==='admin'?'selected':''}>Admin</option></select></div>`).join(''):'<div class="empty-state">No users</div>';
}
function openTeam(idValue=null){
  const team=idValue?state.teams.find(t=>t.id===idValue):null;
  const f=$('#teamForm');f.reset();$('#editTeamId').value=team?.id||'';
  $('#teamHeading').textContent=team?'Edit response team':'Create a response team';
  $('#teamSubmit').textContent=team?'Save changes':'Create response team';
  const leads=state.users.filter(u=>['responder','admin'].includes(u.role));
  $('#teamLead').innerHTML='<option value="">Unassigned (administrators only)</option>'+leads.map(u=>`<option value="${u.id}">${escapeHtml(u.name)} (${escapeHtml(u.email)})</option>`).join('');
  if(team){for(const name of ['name','specialty','contact','base_lat','base_lon','lead_user_id','availability'])f.elements[name].value=team[name]??'';}
  formError('#teamError','');openDialog('#teamDialog');
}
async function submitTeam(e){
  e.preventDefault();const form=e.currentTarget,button=$('#teamSubmit');const b=Object.fromEntries(new FormData(form).entries()),ident=b.id;delete b.id;
  formError('#teamError','');loadingButton(button,true);
  try{
    await api(ident?'/api/admin/teams/'+ident:'/api/admin/teams',{method:ident?'PATCH':'POST',body:b});
    closeDialog('#teamDialog');await refreshPrivate();toast(ident?'Team updated.':'New response team created.');
  }catch(ex){formError('#teamError',ex.message)}finally{loadingButton(button,false,ident?'Save changes':'Create response team');}
}
async function updateRole(select){
  const ident=select.dataset.userRole,u=state.users.find(x=>x.id===ident),role=select.value;
  if(!u)return;
  if(!confirm(`Change ${u.name}'s role from ${u.role} to ${role}? This changes their access to disaster response operations.`)){select.value=u.role;return;}
  select.disabled=true;
  try{await api('/api/admin/users/'+ident,{method:'PATCH',body:{role}});await refreshPrivate();toast('Role updated.');
    if(ident===state.user.id){const me=await api('/api/auth/me');state.user=me.user;updateAuthUI();route();}
  }catch(e){select.value=u.role;toast(e.message,'error')}finally{select.disabled=false;}
}
function renderAssignments(){
  if(!['responder','admin'].includes(state.user?.role))return;
  const active=state.assignments.filter(a=>!['reassigned','cancelled'].includes(a.status));
  const html=active.map(a=>{
    const progress=['assigned','acknowledged','en_route','on_scene','completed'];
    const index=progress.indexOf(a.status);
    const next=progress[index+1];
    return `<article class="assignment-card"><div class="queue-top"><span class="pill severity-${escapeHtml(a.severity)}">${escapeHtml(a.severity)}</span><span class="status-tag">${escapeHtml(statusLabel(a.status))}</span></div><h2>${escapeHtml(a.title)}</h2><p>${escapeHtml(a.description)}</p><div class="job-meta"><span>TEAM: ${escapeHtml(a.team_name)}</span><span>${formatCoordinate(a.lat)}, ${formatCoordinate(a.lon)}</span><span>${escapeHtml(a.address||'Pinned coordinates')}</span></div><div class="job-actions"><button type="button" data-open-id="${a.incident_id}">Details & location ↗</button>${next?`<button type="button" data-progress-id="${a.id}" data-progress-status="${next}">Mark ${escapeHtml(statusLabel(next))}</button>`:'<button disabled>Completed ✓</button>'}</div></article>`;
  }).join('');
  $('#assignmentsList').innerHTML=html||'<div class="empty-state">No assignments yet. A response coordinator must assign a team to a report, and the team must have your account listed as lead.</div>';
}
async function updateAssignment(idValue,status){
  if(status==='completed'&&!confirm('Confirm that this incident has been resolved by the assigned response team?'))return;
  try{await api('/api/assignments/'+idValue,{method:'PATCH',body:{status}});await Promise.all([refreshPrivate(),fetchIncidents()]);toast('Response progress updated.');}
  catch(e){toast(e.message,'error')}
}
async function initialize(){
  $('#footerYear').textContent=new Date().getFullYear();
  $('.skip-link').addEventListener('click',e=>{e.preventDefault();$('#mainContent').focus();});
  $('#accountButton').addEventListener('click',()=>openAuth('login'));
  $('#signUpButton').addEventListener('click',()=>openAuth('register'));
  $('#logoutButton').addEventListener('click',logout);
  $('#loginTab').addEventListener('click',()=>openAuth('login'));
  $('#registerTab').addEventListener('click',()=>openAuth('register'));
  $('#authForm').addEventListener('submit',submitAuth);
  $$('#heroReport,#mapReport').forEach(b=>b.addEventListener('click',openReport));
  $('#reportForm').addEventListener('submit',submitReport);
  $('#reportAddress').addEventListener('input',clearReportLocation);
  $('#findReportAddress').addEventListener('click',async()=>{const button=$('#findReportAddress');loadingButton(button,true);formError('#reportError','');try{await findReportAddress();}catch(error){formError('#reportError',error.message);}finally{loadingButton(button,false,'Find address');}});
  $('#reportMapOptions').addEventListener('toggle',()=>{if($('#reportMapOptions').open)state.reportMap?.invalidateSize();});
  $('#areaSearchForm').addEventListener('submit',findAreaAddress);
  $('#radiusFilter').addEventListener('change',()=>{renderIncidents();fetchHazards();});
  $('#hazardTypeFilter').addEventListener('change',renderIncidents);
  $('#areaAddress').addEventListener('input',()=>{areaLookupVersion++;areaAddressMatches=[];$('#areaAddressResults').innerHTML='';});
  setupAddressAutocomplete('area');setupAddressAutocomplete('report');
  $('#searchMapArea').addEventListener('click',()=>{const point=state.map?.getCenter();if(point){searchArea={lat:point.lat,lon:point.lng};selectedAreaLabel=null;$('#areaPrecision').textContent='Map center';$('#areaAddress').value='';fetchHazards();}});

  $('#useLocation').addEventListener('click',()=>{
    if(!navigator.geolocation){formError('#reportError','Geolocation not supported');return;}
    navigator.geolocation.getCurrentPosition(p=>{
      setReportPin(p.coords.latitude,p.coords.longitude);state.reportMap?.setView([p.coords.latitude,p.coords.longitude],15);
    },e=>formError('#reportError','Location denied or unavailable: '+e.message),{timeout:10000,enableHighAccuracy:true});
  });
  $$('#reportLat,#reportLon').forEach(el=>el.addEventListener('change',()=>{
    const lat=Number($('#reportLat').value),lon=Number($('#reportLon').value);
    if($('#reportLat').value&&$('#reportLon').value&&Math.abs(lat)<=90&&Math.abs(lon)<=180){setReportPin(lat,lon);state.reportMap?.panTo([lat,lon]);}
  }));
  $('#teamForm').addEventListener('submit',submitTeam);
  $$('#addTeam,#addTeamSecondary').forEach(b=>b.addEventListener('click',()=>openTeam()));
  $$('#refreshButton,#adminRefresh,#tasksRefresh').forEach(b=>b.addEventListener('click',refreshAll));
  $$('#statusFilter,#severityFilter,#sortFilter,#myReportsFilter').forEach(el=>el.addEventListener('change',renderIncidents));
  $('#searchFilter').addEventListener('input',()=>{clearTimeout(debounceTimer);debounceTimer=setTimeout(renderIncidents,170)});
  $('#clearFilters').addEventListener('click',()=>{$('#searchFilter').value='';$('#hazardTypeFilter').value='';sourceFilter='all';$$('[data-source-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.sourceFilter==='all')));selectedReportTypes.clear();updateTypeChips();$('#statusFilter').value='';$('#severityFilter').value='';$('#sortFilter').value='priority';$('#myReportsFilter').checked=false;renderIncidents()});
  $('#alertsToggle').addEventListener('change',renderHazards);
  $('#recenterButton').addEventListener('click',fitReports);
  $('#mobileMenu').addEventListener('click',()=>{const open=$('.nav-links').classList.toggle('open');$('#mobileMenu').setAttribute('aria-expanded',String(open));});
  $$('[data-close]').forEach(btn=>btn.addEventListener('click',()=>closeDialog('#'+btn.dataset.close)));
  $$('dialog').forEach(d=>d.addEventListener('click',e=>{
    if(e.target!==d)return;
    const box=d.getBoundingClientRect();
    if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)d.close();
  }));
  $('#authDialog').addEventListener('close',()=>{if(!state.user)pendingReport=false;});
  document.body.addEventListener('click',e=>{
    const source=e.target.closest('[data-source-filter]');if(source){setSourceFilter(source.dataset.sourceFilter);return;}
    const hazard=e.target.closest('[data-hazard-id]');if(hazard){openHazard(hazard.dataset.hazardId);return;}
    const type=e.target.closest('[data-report-type]');if(type){toggleReportType(type.dataset.reportType);return;}
    const address=e.target.closest('[data-address-kind]');if(address){const matches=address.dataset.addressKind==='report'?reportAddressMatches:areaAddressMatches,match=matches[Number(address.dataset.addressIndex)];if(match){if(address.dataset.addressKind==='report')useReportAddress(match);else useAreaAddress(match);}return;}
    const op=e.target.closest('[data-open-id]');if(op){openIncident(op.dataset.openId);return;}
    const edit=e.target.closest('[data-edit-team]');if(edit){openTeam(edit.dataset.editTeam);return;}
    const prog=e.target.closest('[data-progress-id]');if(prog){updateAssignment(prog.dataset.progressId,prog.dataset.progressStatus);return;}
  });
  document.body.addEventListener('change',e=>{if(e.target.matches('[data-user-role]'))updateRole(e.target)});
  window.addEventListener('hashchange',route);
  try{const me=await api('/api/auth/me');state.user=me.user;}catch(e){console.warn('Auth check failed',e)}
  updateAuthUI();route();
  const initialRefresh=refreshAll();
  route();
  try{
    const events=new EventSource('/api/stream');state.stream=events;
    events.onopen=()=>{$('#syncStatus').innerHTML='<span class="live-dot"></span> Live updates connected';$('#feedSyncStatus').textContent='● LIVE SYNC';};
    events.onerror=()=>{$('#syncStatus').textContent='Reconnecting updates…';$('#feedSyncStatus').textContent='RECONNECTING';};
    events.addEventListener('change',e=>{
      let message;try{message=JSON.parse(e.data);}catch{return;}
      pendingChanges.add(message.kind);clearTimeout(refreshTimer);
      refreshTimer=setTimeout(async()=>{
        const changes=new Set(pendingChanges);pendingChanges.clear();
        const jobs=[];
        if(changes.has('incidents'))jobs.push(fetchIncidents());
        if(changes.has('teams')||changes.has('assignments')||(changes.has('incidents')&&state.user))jobs.push(refreshPrivate());
        const results=await Promise.allSettled(jobs);
        if(results.some(r=>r.status==='rejected'))showConnectionError();
      },300);
    });
  }catch(e){console.warn('Live events unavailable',e)}
  setInterval(()=>{if(document.visibilityState==='visible')fetchIncidents().catch(showConnectionError);},60000);
  setInterval(()=>{if(document.visibilityState==='visible')fetchHazards();},2*60000);
  await initialRefresh;
  const linkedIncident=new URLSearchParams(location.search).get('incident');
  if(linkedIncident){location.hash='#map';await openIncident(linkedIncident);}
}
document.addEventListener('DOMContentLoaded',initialize);


