let lastPriceAt=null,lastSeenAt=null,priceStatus='pendiente',priceLoopStarted=false,fetching=false,lastLiveAt=0;

const LIVE_TICK={TSLA:'TSLA',SPCX:'SPCX',QDVE:'QDVE.DE',VWCE:'VWCE.DE',BTC:'BTC-EUR'};

function patchPriceStatus(){
  const el=document.getElementById('totalSub');
  if(!el)return;
  const base=(el.textContent||'').replace(/\s*[·|]\s*Precios:.*$/,'');
  el.textContent=base+' · Precios: '+(priceStatus||'pendiente');
}
function setStatus(s){
  priceStatus=s;
  patchPriceStatus();
}
function applyFeed(d){
  if(!d||!d.prices)return 0;
  let got=0;
  Object.keys(d.prices).forEach(function(k){
    const px=+d.prices[k];
    if(px>0){prices[k]=px;got++;}
  });
  if(d.eurusd&&+d.eurusd>0)eurusd=+d.eurusd;
  if(d.updatedAt)lastPriceAt=new Date(d.updatedAt);
  if(d.daily&&typeof d.daily==='object') dailyPrices=d.daily;
  lastSeenAt=new Date();
  return got;
}
function applyLive(live){
  if(!live)return 0;
  let got=0;
  Object.keys(live).forEach(function(k){
    const px=+live[k];
    if(px>0){prices[k]=px;got++;}
  });
  if(got){
    lastSeenAt=new Date();
    lastLiveAt=Date.now();
    lastPriceAt=new Date();
    const today=typeof todayISO==='function'?todayISO():new Date().toISOString().slice(0,10);
    dailyPrices=dailyPrices||{};
    dailyPrices[today]=Object.assign({},dailyPrices[today]||{},live);
  }
  return got;
}
async function loadJSON(url, ms){
  const ctrl=typeof AbortController!=='undefined'?new AbortController():null;
  const t=setTimeout(function(){try{ctrl&&ctrl.abort();}catch(e){}}, ms||6000);
  try{
    const r=await fetch(url,{cache:'no-store',signal:ctrl?ctrl.signal:undefined,headers:{'Cache-Control':'no-cache','Pragma':'no-cache'}});
    clearTimeout(t);
    if(!r.ok)throw new Error('http '+r.status);
    return await r.json();
  }catch(e){
    clearTimeout(t);
    throw e;
  }
}
function fmtWhen(dt){
  if(!dt)return '';
  return dt.toLocaleString('es-ES',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
}
function pxFromYahoo(d){
  const res=((d&&d.chart)||{}).result||[];
  if(!res.length)return null;
  const px=+((res[0].meta||{}).regularMarketPrice);
  return px>0?px:null;
}
function yahooChartUrl(symbol){
  return 'https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?interval=1d&range=5d';
}
function proxyUrls(target){
  return [
    'https://corsproxy.io/?url='+encodeURIComponent(target),
    'https://api.allorigins.win/raw?url='+encodeURIComponent(target),
    target
  ];
}
async function firstJSON(urls, ms){
  let last=null;
  const tasks=urls.map(function(u){
    return loadJSON(u, ms||5000).then(function(d){
      if(!d)throw new Error('empty');
      return d;
    }).catch(function(e){last=e; throw e;});
  });
  if(typeof Promise.any==='function'){
    try{return await Promise.any(tasks);}catch(e){throw last||e;}
  }
  for(let i=0;i<urls.length;i++){
    try{return await loadJSON(urls[i], ms||5000);}catch(e){last=e;}
  }
  throw last||new Error('sin json');
}
async function yahooLive(symbol){
  try{
    const d=await firstJSON(proxyUrls(yahooChartUrl(symbol)), 5000);
    return pxFromYahoo(d);
  }catch(e){return null;}
}
async function btcLive(){
  try{
    const d=await loadJSON('https://api.coinbase.com/v2/prices/BTC-EUR/spot', 5000);
    const px=+((d.data||{}).amount);
    if(px>0)return px;
  }catch(e){}
  return yahooLive('BTC-EUR');
}
async function fetchLiveOverlay(){
  const got={};
  const keys=Object.keys(LIVE_TICK);
  await Promise.all(keys.map(async function(k){
    try{
      const px=k==='BTC'?await btcLive():await yahooLive(LIVE_TICK[k]);
      if(px>0) got[k]=k==='BTC'?Math.round(px*100)/100:Math.round(px*10000)/10000;
    }catch(e){}
  }));
  return got;
}
async function loadPricesFile(){
  const stamp=Date.now();
  const urls=[
    'prices.json?t='+stamp,
    'https://raw.githubusercontent.com/javimembrillo/cartera-javi/main/prices.json?t='+stamp
  ];
  for(let i=0;i<urls.length;i++){
    try{
      const d=await loadJSON(urls[i], 8000);
      if(d&&d.prices)return {d:d, src:i===0?'Pages':'GitHub'};
    }catch(e){}
  }
  return null;
}
function paintStatus(fileGot, liveGot, src){
  const n=(typeof ASSETS!=='undefined'&&ASSETS.length)?ASSETS.length:5;
  const when=fmtWhen(lastPriceAt);
  setStatus((liveGot?liveGot+' vivos':(fileGot?fileGot+'/'+n+' ok':'sin dato'))+' · '+when+(src?' · '+src:''));
}
async function fetchPrices(opts){
  if(fetching)return false;
  fetching=true;
  setStatus('actualizando…');
  const wantLive=!(opts&&opts.live===false);
  const fileP=loadPricesFile();
  const liveP=wantLive?fetchLiveOverlay():Promise.resolve({});
  let file=null, live={}, src='';
  try{file=await fileP;}catch(e){}
  try{live=await liveP;}catch(e){console.warn('live',e);}
  let fileGot=0, liveGot=0;
  if(file&&file.d){
    fileGot=applyFeed(file.d);
    src=file.src;
  }
  liveGot=applyLive(live);
  if(liveGot) src=(src?src+' + ':'')+'vivo';
  try{
    if(!fileGot&&!liveGot)throw new Error('sin fuentes');
    paintStatus(fileGot, liveGot, src);
    if((fileGot||liveGot)&&typeof savePricesOnly==='function'){try{await savePricesOnly();}catch(e){}}
    if(typeof renderAll==='function'){try{renderAll();}catch(e){console.error(e);}}
    fetching=false;
    return true;
  }catch(e){
    console.error(e);
    setStatus('error precios');
    fetching=false;
    return false;
  }
}
async function manualRefresh(){
  fetching=false;
  const ok=await fetchPrices({live:true});
  if(typeof fetchFX==='function'){try{await fetchFX();}catch(e){}}
  if(!ok) setStatus((priceStatus||'error')+' · reintenta en un minuto');
}
function startPriceLoop(){
  if(priceLoopStarted){
    fetchPrices({live:true});
    return;
  }
  priceLoopStarted=true;
  fetchPrices({live:true});
  setInterval(function(){fetchPrices({live:true});},30*1000);
}
const _renderTotal=typeof renderTotal==='function'?renderTotal:function(){};
renderTotal=function(){
  _renderTotal();
  patchPriceStatus();
};
