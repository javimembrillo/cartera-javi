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
    const today=typeof todayISO==='function'?todayISO():new Date().toISOString().slice(0,10);
    dailyPrices=dailyPrices||{};
    dailyPrices[today]=Object.assign({},dailyPrices[today]||{},live);
  }
  return got;
}
async function loadJSON(url){
  const ctrl=typeof AbortController!=='undefined'?new AbortController():null;
  const t=setTimeout(function(){try{ctrl&&ctrl.abort();}catch(e){}},12000);
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
function yahooUrls(symbol){
  const y='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?interval=1d&range=5d';
  return [
    y,
    'https://api.allorigins.win/raw?url='+encodeURIComponent(y)
  ];
}
function pxFromYahoo(d){
  const res=((d&&d.chart)||{}).result||[];
  if(!res.length)return null;
  const px=+((res[0].meta||{}).regularMarketPrice);
  return px>0?px:null;
}
async function yahooLive(symbol){
  const urls=yahooUrls(symbol);
  for(let i=0;i<urls.length;i++){
    try{
      const d=await loadJSON(urls[i]);
      const px=pxFromYahoo(d);
      if(px>0)return px;
    }catch(e){}
  }
  return null;
}
async function btcLive(){
  try{
    const d=await loadJSON('https://api.coinbase.com/v2/prices/BTC-EUR/spot');
    const px=+((d.data||{}).amount);
    if(px>0)return px;
  }catch(e){}
  try{
    const d=await loadJSON('https://api.kraken.com/0/public/Ticker?pair=XBTEUR');
    const px=+((((d.result||{}).XXBTZEUR||{}).c)||[])[0];
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
async function fetchPrices(opts){
  if(fetching)return false;
  fetching=true;
  const forceLive=opts&&opts.live;
  setStatus('actualizando…');
  const stamp=Date.now();
  const urls=[
    'prices.json?t='+stamp,
    'https://raw.githubusercontent.com/javimembrillo/cartera-javi/main/prices.json?t='+stamp,
    'https://cdn.jsdelivr.net/gh/javimembrillo/cartera-javi@main/prices.json?t='+stamp
  ];
  let d=null,src='';
  for(let i=0;i<urls.length;i++){
    try{
      d=await loadJSON(urls[i]);
      if(d&&d.prices){src=i===0?'Pages':(i===1?'GitHub':'jsDelivr');break;}
    }catch(e){console.warn('precio fuente',i,e);}
  }
  try{
    if(!d||!d.prices)throw new Error('sin fuentes');
    const got=applyFeed(d);
    const age=lastPriceAt?(Date.now()-lastPriceAt.getTime()):1e12;
    const stale=age>20*60*1000;
    const liveDue=forceLive||stale||(Date.now()-lastLiveAt>10*60*1000);
    let liveGot=0,liveSrc='';
    if(liveDue){
      try{
        const live=await fetchLiveOverlay();
        liveGot=applyLive(live);
        if(liveGot){liveSrc='vivo';src=src+' + vivo';}
      }catch(e){console.warn('live overlay',e);}
    }
    const when=fmtWhen(lastPriceAt);
    const seen=fmtWhen(lastSeenAt);
    const n=(typeof ASSETS!=='undefined'&&ASSETS.length)?ASSETS.length:Object.keys((d&&d.prices)||{}).length||4;
    setStatus((got?got+'/'+n+' ok':'0/'+n)+(liveGot?' · '+liveGot+' vivos':'')+' · dato '+when+(seen?' · visto '+seen:'')+' · '+src);
    if((got||liveGot)&&typeof savePricesOnly==='function'){try{await savePricesOnly();}catch(e){}}
    if(typeof renderAll==='function'){try{renderAll();}catch(e){console.error(e);}}
    fetching=false;
    return (got+liveGot)>0;
  }catch(e){
    console.error(e);
    try{
      const live=await fetchLiveOverlay();
      const liveGot=applyLive(live);
      if(liveGot){
        setStatus(liveGot+' vivos · sin prices.json');
        if(typeof renderAll==='function'){try{renderAll();}catch(e2){}}
        fetching=false;
        return true;
      }
    }catch(e2){}
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
  setInterval(function(){fetchPrices();},60*1000);
}
const _renderTotal=typeof renderTotal==='function'?renderTotal:function(){};
renderTotal=function(){
  _renderTotal();
  patchPriceStatus();
};
