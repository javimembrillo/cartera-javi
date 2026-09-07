let lastPriceAt=null,lastSeenAt=null,priceStatus='pendiente',priceLoopStarted=false,fetching=false,fetchStarted=0;
const REFRESH_MS=5*60*1000;

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
function paintStatus(got,source){
  const total=(typeof ASSETS!=='undefined'&&ASSETS.length)||5;
  const age=lastPriceAt?fmtWhen(lastPriceAt):'sin fecha';
  setStatus(got+'/'+total+' archivo · '+age+(source?' · '+source:''));
}
function repaint(got,source){
  paintStatus(got,source);
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
    repaint(got,result.source);
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
