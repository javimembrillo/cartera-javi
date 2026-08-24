const YTICK={TSLA:'TSLA',SPCX:'SPCX',QDVE:'QDVE.DE',VWCE:'VWCE.DE'};
let lastPriceAt=null,priceStatus='pendiente',priceLoopStarted=false,fetching=false;

function nyNow(){
  const fmt=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const p={};
  fmt.formatToParts(new Date()).forEach(function(x){p[x.type]=x.value;});
  return p;
}
function isWallStreetOpen(){
  const p=nyNow();
  if(p.weekday==='Sat'||p.weekday==='Sun')return false;
  const mins=(+p.hour)*60+(+p.minute);
  return mins>=570&&mins<960;
}
function parseYahoo(j){
  try{
    if(typeof j==='string')j=JSON.parse(j);
    const r=j&&j.chart&&j.chart.result&&j.chart.result[0];
    if(!r)return null;
    const meta=r.meta||{};
    let px=meta.regularMarketPrice;
    if(px==null&&r.indicators&&r.indicators.quote&&r.indicators.quote[0]){
      const c=r.indicators.quote[0].close||[];
      for(let i=c.length-1;i>=0;i--){if(c[i]!=null){px=c[i];break;}}
    }
    px=+px;
    return (px>0)?px:null;
  }catch(e){return null;}
}
function withTimeout(ms){
  if(typeof AbortSignal!=='undefined'&&AbortSignal.timeout)return AbortSignal.timeout(ms);
  const c=new AbortController();
  setTimeout(function(){try{c.abort();}catch(e){}},ms);
  return c.signal;
}
async function fetchJSON(url,ms){
  const r=await fetch(url,{cache:'no-store',signal:withTimeout(ms||7000)});
  if(!r.ok)throw new Error(String(r.status));
  const t=await r.text();
  return JSON.parse(t);
}
async function onePrice(symbol){
  const raw='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?interval=1d&range=5d';
  const urls=[
    'https://api.allorigins.win/raw?url='+encodeURIComponent(raw),
    'https://api.codetabs.com/v1/proxy?quest='+encodeURIComponent(raw),
    raw
  ];
  for(let i=0;i<urls.length;i++){
    try{
      const j=await fetchJSON(urls[i],8000);
      const px=parseYahoo(j);
      if(px)return px;
    }catch(e){}
  }
  return null;
}
function setStatus(s){
  priceStatus=s;
  if(typeof renderAll==='function'){
    try{renderAll();}catch(e){}
  }else{
    const el=document.getElementById('totalSub');
    if(el)el.textContent=(el.textContent.replace(/ \u00b7 Precios:.*$/,'')||el.textContent)+' \u00b7 Precios: '+s;
  }
}
async function fetchPrices(force){
  if(fetching)return false;
  if(!force&&!isWallStreetOpen()){
    setStatus((lastPriceAt?('ultima '+lastPriceAt.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})):'sin sesion')+' \u00b7 WS cerrado');
    return false;
  }
  fetching=true;
  setStatus('actualizando\u2026');
  let got=0;
  const keys=Object.keys(YTICK);
  try{
    const results=await Promise.all(keys.map(function(t){
      return onePrice(YTICK[t]).then(function(px){return {t:t,px:px};}).catch(function(){return {t:t,px:null};});
    }));
    results.forEach(function(r){
      if(r.px){prices[r.t]=r.px;got++;}
    });
    try{
      const r=await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json',{cache:'no-store',signal:withTimeout(6000)});
      const d=await r.json();
      if(d&&d.eur&&d.eur.usd)eurusd=d.eur.usd;
    }catch(e){}
    lastPriceAt=new Date();
    setStatus((got?got+'/4 ok':'0/4 fallida')+' \u00b7 '+lastPriceAt.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})+' \u00b7 WS '+(isWallStreetOpen()?'abierto':'cerrado'));
    if(got&&typeof save==='function'){
      try{await save();}catch(e){}
    }
  }catch(e){
    setStatus('error de red \u00b7 WS '+(isWallStreetOpen()?'abierto':'cerrado'));
  }
  fetching=false;
  return got>0;
}
async function manualRefresh(){
  await fetchPrices(true);
}
function startPriceLoop(){
  if(priceLoopStarted)return;
  priceLoopStarted=true;
  setTimeout(function(){fetchPrices(true);},300);
  setInterval(function(){fetchPrices(false);},60*60*1000);
}
const _renderTotal=typeof renderTotal==='function'?renderTotal:function(){};
renderTotal=function(){
  _renderTotal();
  const el=document.getElementById('totalSub');
  if(!el)return;
  const base=(el.textContent||'').replace(/\s*\u00b7\s*Precios:.*$/,'');
  el.textContent=base+' \u00b7 Precios: '+(priceStatus||'pendiente');
};
if(typeof auth!=='undefined'){
  auth.onAuthStateChanged(function(u){
    if(u&&ALLOWED.indexOf(u.email.toLowerCase())!==-1)startPriceLoop();
  });
}
