const YTICK={TSLA:'TSLA',SPCX:'SPCX',QDVE:'QDVE.DE',VWCE:'VWCE.DE'};
let lastPriceAt=null,priceStatus='pendiente',priceLoopStarted=false;

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
}
async function fetchJSON(url){
  const r=await fetch(url,{cache:'no-store'});
  if(!r.ok)throw new Error(String(r.status));
  const t=await r.text();
  return JSON.parse(t);
}
async function onePrice(symbol){
  const raw='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?interval=1m&range=1d';
  const urls=[
    raw,
    'https://corsproxy.io/?'+encodeURIComponent(raw),
    'https://api.allorigins.win/raw?url='+encodeURIComponent(raw)
  ];
  for(let i=0;i<urls.length;i++){
    try{
      const j=await fetchJSON(urls[i]);
      const px=parseYahoo(j);
      if(px)return px;
    }catch(e){}
  }
  return null;
}
async function fetchPrices(force){
  if(!force&&!isWallStreetOpen()){
    priceStatus=(lastPriceAt?('ultima '+lastPriceAt.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})):'sin sesion')+' · WS cerrado';
    if(typeof renderAll==='function')renderAll();
    return false;
  }
  let got=0;
  const keys=Object.keys(YTICK);
  for(let i=0;i<keys.length;i++){
    const t=keys[i];
    const px=await onePrice(YTICK[t]);
    if(px){prices[t]=px;got++;}
  }
  try{
    const r=await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json',{cache:'no-store'});
    const d=await r.json();
    if(d&&d.eur&&d.eur.usd)eurusd=d.eur.usd;
  }catch(e){}
  lastPriceAt=new Date();
  priceStatus=(got?got+'/4 ok':'0/4 fallida')+' · '+lastPriceAt.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})+' · WS '+(isWallStreetOpen()?'abierto':'cerrado');
  if(got&&typeof save==='function')await save();
  if(typeof renderAll==='function')renderAll();
  return got>0;
}
async function manualRefresh(){
  priceStatus='actualizando…';
  if(typeof renderAll==='function')renderAll();
  await fetchPrices(true);
}
function startPriceLoop(){
  if(priceLoopStarted)return;
  priceLoopStarted=true;
  fetchPrices(true);
  setInterval(function(){fetchPrices(false);},60*60*1000);
}
const _renderTotal=typeof renderTotal==='function'?renderTotal:function(){};
renderTotal=function(){
  _renderTotal();
  const el=document.getElementById('totalSub');
  if(!el)return;
  const extra=' · Precios: '+(priceStatus||'pendiente');
  if(el.textContent.indexOf('Precios:')===-1)el.textContent+=extra;
};
if(typeof auth!=='undefined'){
  auth.onAuthStateChanged(function(u){
    if(u&&ALLOWED.indexOf(u.email.toLowerCase())!==-1)startPriceLoop();
  });
}
