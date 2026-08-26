let lastPriceAt=null,lastSeenAt=null,priceStatus='pendiente',priceLoopStarted=false,fetching=false;

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
async function loadJSON(url){
  const ctrl=typeof AbortController!=='undefined'?new AbortController():null;
  const t=setTimeout(function(){try{ctrl&&ctrl.abort();}catch(e){}},10000);
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
async function fetchPrices(){
  if(fetching)return false;
  fetching=true;
  setStatus('actualizando…');
  const stamp=Date.now();
  const urls=[
    'https://raw.githubusercontent.com/javimembrillo/cartera-javi/main/prices.json?t='+stamp,
    'https://cdn.jsdelivr.net/gh/javimembrillo/cartera-javi@main/prices.json?t='+stamp,
    'prices.json?t='+stamp
  ];
  let d=null,src='';
  for(let i=0;i<urls.length;i++){
    try{
      d=await loadJSON(urls[i]);
      if(d&&d.prices){src=i===0?'GitHub':(i===1?'jsDelivr':'Pages');break;}
    }catch(e){console.warn('precio fuente',i,e);}
  }
  try{
    if(!d||!d.prices)throw new Error('sin fuentes');
    const got=applyFeed(d);
    const when=fmtWhen(lastPriceAt);
    const seen=fmtWhen(lastSeenAt);
    const n=(typeof ASSETS!=='undefined'&&ASSETS.length)?ASSETS.length:Object.keys((d&&d.prices)||{}).length||4;
    setStatus((got?got+'/'+n+' ok':'0/'+n)+' · dato '+when+(seen?' · visto '+seen:'')+' · '+src);
    if(got&&typeof savePricesOnly==='function'){try{await savePricesOnly();}catch(e){}}
    if(typeof renderAll==='function'){try{renderAll();}catch(e){console.error(e);}}
    fetching=false;
    return got>0;
  }catch(e){
    console.error(e);
    setStatus('error precios');
    fetching=false;
    return false;
  }
}
async function manualRefresh(){
  fetching=false;
  const ok=await fetchPrices();
  if(typeof fetchFX==='function'){try{await fetchFX();}catch(e){}}
  if(!ok) setStatus((priceStatus||'error')+' · reintenta en un minuto');
}
function startPriceLoop(){
  if(priceLoopStarted){
    fetchPrices();
    return;
  }
  priceLoopStarted=true;
  fetchPrices();
  setInterval(function(){fetchPrices();},60*1000);
}
const _renderTotal=typeof renderTotal==='function'?renderTotal:function(){};
renderTotal=function(){
  _renderTotal();
  patchPriceStatus();
};
