let lastPriceAt=null,lastSeenAt=null,priceStatus='pendiente',priceLoopStarted=false,fetching=false,fetchStarted=0,lastLiveAt=0;

const LIVE_TICK={TSLA:'TSLA',SPCX:'SPCX',QDVE:'QDVE.DE',VWCE:'VWCE.DE',BTC:'BTC-EUR'};
const SPARK='https://query1.finance.yahoo.com/v7/finance/spark?symbols=TSLA,SPCX,QDVE.DE,VWCE.DE,BTC-EUR&range=1d&interval=1d';
const SYM={'TSLA':'TSLA','SPCX':'SPCX','QDVE.DE':'QDVE','VWCE.DE':'VWCE','BTC-EUR':'BTC'};
const REFRESH_MS=15*60*1000;

function patchPriceStatus(){
  const el=document.getElementById('totalSub');
  if(!el)return;
  const base=(el.textContent||'').replace(/\s*[·|]\s*Precios:.*$/,'');
  el.textContent=base+' · Precios: '+(priceStatus||'pendiente');
}
function setStatus(s){priceStatus=s;patchPriceStatus();}
function fmtWhen(dt){
  if(!dt)return '';
  return dt.toLocaleString('es-ES',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
}
function roundPx(k,px){return k==='BTC'?Math.round(px*100)/100:Math.round(px*10000)/10000;}
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
function loadJSON(url, ms){
  const ctrl=typeof AbortController!=='undefined'?new AbortController():null;
  const t=setTimeout(function(){try{ctrl&&ctrl.abort();}catch(e){}}, ms||7000);
  return fetch(url,{cache:'no-store',mode:'cors',signal:ctrl?ctrl.signal:undefined,headers:{'Accept':'application/json'}}).then(function(r){
    clearTimeout(t);
    if(!r.ok)throw new Error('http '+r.status);
    return r.json();
  }).catch(function(e){clearTimeout(t);throw e;});
}
function jsonp(url, ms){
  return new Promise(function(resolve, reject){
    const cb='cj_'+Math.random().toString(36).slice(2,10);
    const s=document.createElement('script');
    const t=setTimeout(function(){cleanup();reject(new Error('jsonp timeout'));}, ms||8000);
    function cleanup(){
      clearTimeout(t);
      try{delete window[cb];}catch(e){window[cb]=undefined;}
      if(s.parentNode)s.parentNode.removeChild(s);
    }
    window[cb]=function(data){cleanup();resolve(data);};
    s.onerror=function(){cleanup();reject(new Error('jsonp'));};
    s.src=url+(url.indexOf('?')>=0?'&':'?')+'callback='+cb;
    (document.head||document.documentElement).appendChild(s);
  });
}
function unwrap(d){
  if(!d)return d;
  if(typeof d.contents==='string'){
    try{return JSON.parse(d.contents);}catch(e){return d;}
  }
  return d;
}
function parseSpark(d){
  d=unwrap(d);
  const out={};
  const rows=(((d||{}).spark)||{}).result||[];
  rows.forEach(function(row){
    const k=SYM[row.symbol];
    const resp=(row.response&&row.response[0])||{};
    const px=+(resp.meta&&resp.meta.regularMarketPrice);
    if(k&&px>0) out[k]=roundPx(k,px);
  });
  return out;
}
function parseChart(d, k){
  d=unwrap(d);
  const res=((d&&d.chart)||{}).result||[];
  const px=+(((res[0]||{}).meta)||{}).regularMarketPrice;
  if(k&&px>0){const o={};o[k]=roundPx(k,px);return o;}
  return {};
}
async function firstOk(fns){
  for(let i=0;i<fns.length;i++){
    try{
      const v=await fns[i]();
      if(v&&Object.keys(v).length)return v;
    }catch(e){}
  }
  return {};
}
async function yahooSpark(){
  const enc=encodeURIComponent(SPARK);
  return firstOk([
    function(){return loadJSON('https://api.allorigins.win/get?url='+enc,4000).then(parseSpark);},
    function(){return jsonp('https://api.allorigins.win/get?url='+enc,4000).then(parseSpark);},
    function(){return loadJSON(SPARK,3500).then(parseSpark);}
  ]);
}
async function yahooOne(k, symbol){
  const y='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?interval=1d&range=1d';
  const enc=encodeURIComponent(y);
  return firstOk([
    function(){return loadJSON('https://api.allorigins.win/raw?url='+enc,3500).then(function(d){return parseChart(d,k);});},
    function(){return jsonp('https://api.allorigins.win/get?url='+enc,4000).then(function(d){return parseChart(d,k);});}
  ]);
}
async function btcLive(){
  try{
    const d=await loadJSON('https://api.coinbase.com/v2/prices/BTC-EUR/spot',4000);
    const px=+((d.data||{}).amount);
    if(px>0)return px;
  }catch(e){}
  try{
    const d=await loadJSON('https://api.kraken.com/0/public/Ticker?pair=XBTEUR',4000);
    const px=+((((d.result||{}).XXBTZEUR||{}).c)||[])[0];
    if(px>0)return px;
  }catch(e){}
  return 0;
}
async function fxLive(){
  try{
    const d=await loadJSON('https://api.frankfurter.app/latest?from=EUR&to=USD',4000);
    const px=+((d.rates||{}).USD);
    if(px>0)return px;
  }catch(e){}
  try{
    const d=await loadJSON('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json',4000);
    const px=+((d.eur||{}).usd);
    if(px>0)return px;
  }catch(e){}
  return 0;
}
async function fetchLiveOverlay(){
  const got={};
  const btcP=btcLive();
  const fxP=fxLive();
  let spark={};
  try{spark=await yahooSpark();}catch(e){}
  Object.assign(got, spark);
  const missing=Object.keys(LIVE_TICK).filter(function(k){return !(got[k]>0);});
  if(missing.length){
    await Promise.all(missing.map(async function(k){
      if(k==='BTC')return;
      try{Object.assign(got, await yahooOne(k, LIVE_TICK[k]));}catch(e){}
    }));
  }
  try{
    const btc=await btcP;
    if(btc>0)got.BTC=roundPx('BTC',btc);
  }catch(e){}
  try{
    const fx=await fxP;
    if(fx>0)eurusd=fx;
  }catch(e){}
  return got;
}
async function loadPricesFile(){
  const stamp=Date.now();
  const urls=['prices.json?t='+stamp,'https://raw.githubusercontent.com/javimembrillo/cartera-javi/main/prices.json?t='+stamp];
  for(let i=0;i<urls.length;i++){
    try{
      const d=await loadJSON(urls[i],8000);
      if(d&&d.prices)return {d:d,src:i===0?'Pages':'GitHub'};
    }catch(e){}
  }
  return null;
}
function paintStatus(fileGot, liveGot, src){
  const n=(typeof ASSETS!=='undefined'&&ASSETS.length)?ASSETS.length:5;
  const when=fmtWhen(lastPriceAt);
  const label=liveGot?(liveGot+'/'+n+' mercado'):(fileGot?fileGot+'/'+n+' archivo':'sin dato');
  setStatus(label+' · '+when+(src?' · '+src:''));
}
function paintNow(fileGot, liveGot, src){
  paintStatus(fileGot, liveGot, src);
  if(typeof renderAll==='function'){try{renderAll();}catch(e){console.error(e);}}
}
async function fetchPrices(opts){
  if(fetching && Date.now()-fetchStarted<20000)return false;
  fetching=true;
  fetchStarted=Date.now();
  const wantLive=!!(opts&&opts.live);
  setStatus(wantLive?'consultando mercado…':'cargando archivo…');
  let file=null, src='', fileGot=0, liveGot=0;
  try{file=await loadPricesFile();}catch(e){}
  if(file&&file.d){fileGot=applyFeed(file.d);src=file.src;}
  if(fileGot) paintNow(fileGot, 0, src);
  if(wantLive){
    let live={};
    try{live=await fetchLiveOverlay();}catch(e){console.warn('live',e);}
    liveGot=applyLive(live);
    if(liveGot) src=(src?src+' + ':'')+'mercado';
  }
  fetching=false;
  if(!fileGot&&!liveGot){
    setStatus('error precios');
    return false;
  }
  paintNow(fileGot, liveGot, src);
  if((fileGot||liveGot)&&typeof savePricesOnly==='function'){try{await savePricesOnly();}catch(e){}}
  return true;
}
async function manualRefresh(){
  fetching=false;
  const ok=await fetchPrices({live:true});
  if(!ok) setStatus((priceStatus||'error')+' · reintenta');
}
function startPriceLoop(){
  if(priceLoopStarted){
    fetchPrices({live:false});
    return;
  }
  priceLoopStarted=true;
  fetchPrices({live:false});
  setInterval(function(){fetchPrices({live:true});}, REFRESH_MS);
}
const _renderTotal=typeof renderTotal==='function'?renderTotal:function(){};
renderTotal=function(){_renderTotal();patchPriceStatus();};
