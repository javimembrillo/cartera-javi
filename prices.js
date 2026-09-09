let lastPriceAt=null,lastSeenAt=null,priceStatus='pendiente',priceLoopStarted=false,fetching=false,fetchStarted=0,lastLiveAt=0;
const REFRESH_MS=15*60*1000;
const CNBC='https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=TSLA|SPCX|QDVE-DE|VWCE-DE&requestMethod=itv&noform=1&partnerId=2&output=json';
const CNBC_MAP={'TSLA':'TSLA','SPCX':'SPCX','QDVE-DE':'QDVE','VWCE-DE':'VWCE','QDVE.DE':'QDVE','VWCE.DE':'VWCE'};
const SPARK='https://query1.finance.yahoo.com/v7/finance/spark?symbols=TSLA,SPCX,QDVE.DE,VWCE.DE,BTC-EUR&range=1d&interval=1d';
const YSYM={'TSLA':'TSLA','SPCX':'SPCX','QDVE.DE':'QDVE','VWCE.DE':'VWCE','BTC-EUR':'BTC'};

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
function roundPx(k,px){return k==='BTC'?Math.round(px*100)/100:Math.round(px*10000)/10000;}
function parsePx(s){
  if(typeof s==='number')return s;
  if(s==null||s==='')return 0;
  const n=parseFloat(String(s).replace(/[^0-9.+-]/g,'').replace(/,/g,''));
  return isFinite(n)?n:0;
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
  const t=setTimeout(function(){try{ctrl&&ctrl.abort();}catch(e){}}, ms||6000);
  return fetch(url,{cache:'no-store',mode:'cors',signal:ctrl?ctrl.signal:undefined}).then(function(r){
    clearTimeout(t);
    if(!r.ok)throw new Error('http '+r.status);
    return r.json();
  }).catch(function(e){clearTimeout(t);throw e;});
}
function loadText(url, ms){
  const ctrl=typeof AbortController!=='undefined'?new AbortController():null;
  const t=setTimeout(function(){try{ctrl&&ctrl.abort();}catch(e){}}, ms||6000);
  return fetch(url,{cache:'no-store',mode:'cors',signal:ctrl?ctrl.signal:undefined}).then(function(r){
    clearTimeout(t);
    if(!r.ok)throw new Error('http '+r.status);
    return r.text();
  }).catch(function(e){clearTimeout(t);throw e;});
}
function parseCnbc(d){
  const out={};
  let q=((d||{}).FormattedQuoteResult||{}).FormattedQuote;
  if(!q)return out;
  if(!Array.isArray(q))q=[q];
  q.forEach(function(item){
    const k=CNBC_MAP[item.symbol];
    const px=parsePx(item.last);
    if(k&&px>0)out[k]=roundPx(k,px);
  });
  return out;
}
function parseSpark(d){
  const out={};
  const rows=(((d||{}).spark)||{}).result||[];
  rows.forEach(function(row){
    const k=YSYM[row.symbol];
    const resp=(row.response&&row.response[0])||{};
    const px=+((resp.meta||{}).regularMarketPrice);
    if(k&&px>0)out[k]=roundPx(k,px);
  });
  return out;
}
async function cnbcLive(){
  const d=await loadJSON(CNBC,5000);
  return parseCnbc(d);
}
async function yahooViaJina(){
  const txt=await loadText('https://r.jina.ai/'+SPARK,6000);
  const i=txt.indexOf('{');
  const j=txt.lastIndexOf('}');
  if(i<0||j<=i)return {};
  return parseSpark(JSON.parse(txt.slice(i,j+1)));
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
  try{Object.assign(got, await cnbcLive());}catch(e){console.warn('cnbc',e);}
  const missing=['TSLA','SPCX','QDVE','VWCE'].filter(function(k){return !(got[k]>0);});
  if(missing.length){
    try{Object.assign(got, await yahooViaJina());}catch(e){console.warn('jina',e);}
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
  const urls=['prices.json?nocache='+stamp,'https://raw.githubusercontent.com/javimembrillo/cartera-javi/main/prices.json?nocache='+stamp];
  let lastError;
  for(let i=0;i<urls.length;i++){
    try{
      const d=await loadJSON(urls[i],8000);
      if(d&&d.prices)return {data:d,source:i===0?'Pages':'GitHub'};
    }catch(e){lastError=e;}
  }
  throw lastError||new Error('No se pudo leer prices.json');
}
function paintStatus(fileGot, liveGot, source){
  const n=(typeof ASSETS!=='undefined'&&ASSETS.length)||5;
  const when=fmtWhen(lastPriceAt)||'sin fecha';
  const label=liveGot?(liveGot+'/'+n+' mercado'):(fileGot?fileGot+'/'+n+' archivo':'sin dato');
  setStatus(label+' · '+when+(source?' · '+source:''));
}
function repaint(fileGot, liveGot, source){
  paintStatus(fileGot, liveGot, source);
  if(typeof renderAll==='function'){
    try{renderAll();}catch(e){console.error(e);}
  }
}
async function fetchPrices(opts){
  if(fetching && Date.now()-fetchStarted<8000)return false;
  fetching=true;
  fetchStarted=Date.now();
  const wantLive=!(opts&&opts.live===false);
  setStatus(wantLive?'consultando mercado…':'cargando archivo…');
  let fileGot=0, liveGot=0, source='';
  try{
    const result=await loadPricesFile();
    fileGot=applyFeed(result.data);
    source=result.source;
    if(fileGot)repaint(fileGot,0,source);
  }catch(e){console.warn('archivo',e);}
  if(wantLive){
    try{
      const live=await fetchLiveOverlay();
      liveGot=applyLive(live);
      if(liveGot)source=(source?source+' + ':'')+'mercado';
    }catch(e){console.warn('live',e);}
  }
  fetching=false;
  if(!fileGot&&!liveGot){
    setStatus('error al cargar precios');
    return false;
  }
  repaint(fileGot, liveGot, source);
  if((fileGot||liveGot)&&typeof savePricesOnly==='function'){
    try{await savePricesOnly();}catch(e){}
  }
  return true;
}
async function manualRefresh(){
  const btn=document.querySelector('button[onclick="manualRefresh()"]');
  if(btn){btn.disabled=true;btn.textContent='Actualizando…';}
  fetching=false;
  try{
    const ok=await fetchPrices({live:true});
    if(!ok)setStatus((priceStatus||'error')+' · reintenta');
  }finally{
    if(btn){btn.disabled=false;btn.textContent='Actualizar precios';}
  }
}
function startPriceLoop(){
  if(priceLoopStarted){
    fetchPrices({live:true});
    return;
  }
  priceLoopStarted=true;
  fetchPrices({live:true});
  setInterval(function(){fetchPrices({live:true});}, REFRESH_MS);
}
const _renderTotal=typeof renderTotal==='function'?renderTotal:function(){};
renderTotal=function(){_renderTotal();patchPriceStatus();};
