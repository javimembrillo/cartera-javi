let lastPriceAt=null,priceStatus='pendiente',priceLoopStarted=false,fetching=false;

function patchPriceStatus(){
  const el=document.getElementById('totalSub');
  if(!el)return;
  const base=(el.textContent||'').replace(/\s*[\u00b7|]\s*Precios:.*$/,'');
  el.textContent=base+' \u00b7 Precios: '+(priceStatus||'pendiente');
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
  return got;
}
async function fetchPrices(){
  if(fetching)return false;
  fetching=true;
  setStatus('actualizando\u2026');
  try{
    const r=await fetch('prices.json?t='+Date.now(),{cache:'no-store'});
    if(!r.ok)throw new Error('http '+r.status);
    const d=await r.json();
    const got=applyFeed(d);
    const when=lastPriceAt?lastPriceAt.toLocaleString('es-ES',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'';
    setStatus((got?got+'/4 ok':'0/4')+' \u00b7 '+when+' \u00b7 GitHub');
    if(got&&typeof save==='function'){try{await save();}catch(e){}}
    if(typeof renderAll==='function'){try{renderAll();}catch(e){console.error(e);}}
    fetching=false;
    return got>0;
  }catch(e){
    console.error(e);
    setStatus('error prices.json');
    fetching=false;
    return false;
  }
}
async function manualRefresh(){
  await fetchPrices();
  if(typeof fetchFX==='function'){try{await fetchFX();}catch(e){}}
}
function startPriceLoop(){
  if(priceLoopStarted)return;
  priceLoopStarted=true;
  fetchPrices();
  setInterval(function(){fetchPrices();},60*1000);
}
const _renderTotal=typeof renderTotal==='function'?renderTotal:function(){};
renderTotal=function(){
  _renderTotal();
  patchPriceStatus();
};
if(typeof auth!=='undefined'){
  auth.onAuthStateChanged(function(u){
    if(u&&typeof ALLOWED!=='undefined'&&ALLOWED.indexOf((u.email||'').toLowerCase())!==-1)startPriceLoop();
  });
}
