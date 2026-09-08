let lastPriceAt=null,lastSeenAt=null,priceStatus='pendiente',priceLoopStarted=false,fetching=false,fetchStarted=0;
const REFRESH_MS=5*60*1000;
const STALE_MS=12*60*1000;
const LIVE_TICK={TSLA:'tsla.us',SPCX:'spcx.us'};

function patchPriceStatus(){
  const el=document.getElementById('totalSub');
  if(!el)return;
  const base=(el.textContent||'').replace(/\s*[·|]\s*Precios:.*$/,'');
  el.textContent=base+' · Precios: '+(priceStatus||'pendiente');
}
function setStatus(s){priceStatus=s;patchPriceStatus();}
function fmtWhen(dt){
  if(!dt||isNaN(dt.getTime()))return '';
  return dt.toLocaleString('es-ES',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
}
function applyFeed(d){
  if(!d||!d.prices)return 0;
  let got=0;
  Object.keys(d.prices).forEach(function(k){
    const px=+d.prices[k];
    if(px>0){prices[k]=px;got++;}
  });
  if(+d.eurusd>0)eurusd=+d.eurusd;
  if(d.updatedAt)lastPriceAt=new Date(d.updatedAt);
  if(d.daily&&typeof d.daily==='object')dailyPrices=d.daily;
  lastSeenAt=new Date();
  return got;
}
function loadPricesFile(){
  const stamp=Date.now();
  const urls=[
    'prices.json?nocache='+stamp,
    'https://raw.githubusercontent.com/javimembrillo/cartera-javi/main/prices.json?nocache='+stamp
  ];
  return (async function(){
    let lastError;
    for(let i=0;i<urls.length;i++){
      try{
        const response=await fetch(urls[i],{cache:'no-store',headers:{Accept:'application/json'}});
        if(!response.ok)throw new Error('HTTP '+response.status);
        const data=await response.json();
        if(data&&data.prices)return {data:data,source:i===0?'Pages':'GitHub'};
      }catch(error){lastError=error;}
    }
    throw lastError||new Error('No se pudo leer prices.json');
  })();
}
function isMarketOpenNow(name){
  if(typeof window==='undefined'||!window.__marketStatusNow)return false;
  try{
    const s=window.__marketStatusNow(name);
    return !!(s&&s.open);
  }catch(e){return false;}
}
async function tryLiveOverlay(){
  if(!isMarketOpenNow('wallstreet'))return 0;
  let got=0;
  await Promise.all(Object.keys(LIVE_TICK).map(async function(k){
    try{
      const ctrl=typeof AbortController!=='undefined'?new AbortController():null;
      const t=setTimeout(function(){try{ctrl&&ctrl.abort();}catch(e){}},4000);
      const r=await fetch('https://stooq.com/q/l/?s='+LIVE_TICK[k]+'&i=d',{signal:ctrl?ctrl.signal:undefined});
      clearTimeout(t);
      if(!r.ok)return;
      const line=(await r.text()).trim().split('\n')[0];
      const parts=line.split(',');
      const px=+parts[6];
      if(px>0){prices[k]=px;got++;}
    }catch(e){/* CORS o red: se ignora, no afecta al resto de la app */}
  }));
  if(got){lastSeenAt=new Date();}
  return got;
}
function paintStatus(got,source,liveGot){
  const total=(typeof ASSETS!=='undefined'&&ASSETS.length)||5;
  const age=lastPriceAt?fmtWhen(lastPriceAt):'sin fecha';
  const liveTxt=liveGot?(' + '+liveGot+' en vivo'):'';
  setStatus(got+'/'+total+' archivo'+liveTxt+' · '+age+(source?' · '+source:''));
}
function repaint(got,source,liveGot){
  paintStatus(got,source,liveGot);
  if(typeof renderAll==='function'){
    try{renderAll();}catch(error){console.error(error);}
  }
}
async function fetchPrices(){
  if(fetching)return false;
  fetching=true;
  fetchStarted=Date.now();
  setStatus('actualizando…');
  try{
    const result=await loadPricesFile();
    const got=applyFeed(result.data);
    if(!got){setStatus('archivo sin precios');return false;}
    let liveGot=0;
    const isStale=!lastPriceAt||(Date.now()-lastPriceAt.getTime())>STALE_MS;
    if(isStale){
      try{liveGot=await tryLiveOverlay();}catch(e){}
    }
    repaint(got,result.source,liveGot);
    return true;
  }catch(error){
    console.error('No se pudieron cargar precios',error);
    setStatus('error al cargar precios');
    return false;
  }finally{
    fetching=false;
  }
}
async function manualRefresh(){
  const btn=document.querySelector('button[onclick="manualRefresh()"]');
  if(btn){btn.disabled=true;btn.textContent='Actualizando…';}
  try{
    await fetchPrices();
  }finally{
    if(btn){btn.disabled=false;btn.textContent='Actualizar precios';}
  }
}
function startPriceLoop(){
  if(priceLoopStarted)return;
  priceLoopStarted=true;
  fetchPrices();
  setInterval(fetchPrices,REFRESH_MS);
  document.addEventListener('visibilitychange',function(){
    if(!document.hidden)fetchPrices();
  });
}
const _renderTotal=typeof renderTotal==='function'?renderTotal:function(){};
renderTotal=function(){_renderTotal();patchPriceStatus();};
