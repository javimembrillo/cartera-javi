const firebaseConfig={apiKey:"AIzaSyCAhTFcJqDtUUjntwrApGGOv7RBRxuqPAw",authDomain:"cartera-membrillo-quinonez.firebaseapp.com",projectId:"cartera-membrillo-quinonez",storageBucket:"cartera-membrillo-quinonez.firebasestorage.app",messagingSenderId:"131713034804",appId:"1:131713034804:web:6cd27c06ec30b4af3d7861"};
firebase.initializeApp(firebaseConfig);const auth=firebase.auth(),db=firebase.firestore();
const ALLOWED=['javier@doctormembrillo.com','mabel.felicia@gmail.com'];
const NAMES={QDVE:'iShares S&P 500 Info Tech',TSLA:'Tesla',VWCE:'Vanguard FTSE All-World',SPCX:'SpaceX',BTC:'Bitcoin'};
const CCY={QDVE:'EUR',TSLA:'USD',VWCE:'EUR',SPCX:'USD',BTC:'EUR'};
const STOCKS=['TSLA','SPCX','QDVE','VWCE'];
const ASSETS=['TSLA','SPCX','QDVE','VWCE','BTC'];
const LS_KEY='carteraJavi.ledger.v1';
const SEED=[{d:'2024-11-01',t:'TSLA',q:8,a:-2002.68,c:'USD'},{d:'2024-11-12',t:'TSLA',q:-8,a:2716.01,c:'USD'},{d:'2025-02-03',t:'QDVE',q:63,a:-1976.31,c:'EUR'},{d:'2025-02-17',t:'QDVE',q:2.2782503,a:-75,c:'EUR'},{d:'2025-02-20',t:'QDVE',q:3.6226415,a:-120,c:'EUR'},{d:'2025-03-03',t:'QDVE',q:13.02879202,a:-405,c:'EUR'},{d:'2025-03-10',t:'QDVE',q:5.22739153,a:-150,c:'EUR'},{d:'2025-03-26',t:'TSLA',q:1,a:-273.84,c:'USD'},{d:'2025-03-28',t:'TSLA',q:0.40674026,a:-112,c:'USD'},{d:'2025-04-09',t:'TSLA',q:0.73018699,a:-164,c:'USD'},{d:'2025-04-09',t:'TSLA',q:0.05211428,a:-13.68,c:'USD'},{d:'2025-04-28',t:'TSLA',q:0.53635073,a:-155,c:'USD'},{d:'2025-05-08',t:'QDVE',q:18.07011203,a:-500,c:'EUR'},{d:'2025-05-08',t:'TSLA',q:1.78814104,a:-500,c:'USD'},{d:'2025-05-21',t:'QDVE',q:22.93967714,a:-675,c:'EUR'},{d:'2025-05-21',t:'TSLA',q:0.58034937,a:-200,c:'USD'},{d:'2025-05-23',t:'QDVE',q:3.26404397,a:-95,c:'EUR'},{d:'2025-05-26',t:'QDVE',q:1.89491817,a:-55,c:'EUR'},{d:'2025-06-02',t:'QDVE',q:5.18045242,a:-150,c:'EUR'},{d:'2026-06-08',t:'VWCE',q:11.96288454,a:-1921,c:'EUR'},{d:'2026-06-09',t:'VWCE',q:12.35635734,a:-2000,c:'EUR'},{d:'2025-06-09',t:'TSLA',q:6.64963427,a:-1900,c:'USD'},{d:'2025-06-27',t:'QDVE',q:18.07326125,a:-560,c:'EUR'},{d:'2025-07-02',t:'QDVE',q:4.8828125,a:-150,c:'EUR'},{d:'2025-07-07',t:'QDVE',q:6.22804215,a:-195,c:'EUR'},{d:'2025-07-08',t:'TSLA',q:0.25648306,a:-77.37,c:'USD'},{d:'2025-07-08',t:'TSLA',q:1,a:-302.07,c:'USD'},{d:'2025-07-15',t:'QDVE',q:3.99749176,a:-127.5,c:'EUR'},{d:'2025-07-22',t:'QDVE',q:4.2313117,a:-135,c:'EUR'},{d:'2025-07-29',t:'QDVE',q:12.87787181,a:-426,c:'EUR'},{d:'2025-08-04',t:'TSLA',q:1,a:-308.08,c:'USD'},{d:'2025-08-04',t:'TSLA',q:1,a:-308.04,c:'USD'},{d:'2025-11-07',t:'QDVE',q:15,a:-533.78,c:'EUR'},{d:'2025-11-07',t:'QDVE',q:9.18263678,a:-326.4,c:'EUR'},{d:'2025-11-07',t:'QDVE',q:2.02029297,a:-71.83,c:'EUR'},{d:'2025-11-07',t:'TSLA',q:2,a:-851.19,c:'USD'},{d:'2025-11-26',t:'QDVE',q:3,a:-108.15,c:'EUR'},{d:'2025-11-26',t:'TSLA',q:1,a:-421.85,c:'USD'},{d:'2026-01-05',t:'TSLA',q:2,a:-904.42,c:'USD'},{d:'2026-03-13',t:'TSLA',q:4,a:-1584.36,c:'USD'},{d:'2026-04-01',t:'QDVE',q:30,a:-988.8,c:'EUR'},{d:'2026-06-29',t:'TSLA',q:1.02303132,a:-390,c:'USD'},{d:'2026-07-30',t:'TSLA',q:4.95867768,a:-1500,c:'USD'},{d:'2026-07-30',t:'SPCX',q:17.42525579,a:-2000,c:'USD'},{d:'2026-08-21',t:'SPCX',q:2.23596403,a:-300,c:'USD'},{d:'2026-08-21',t:'TSLA',q:0.02,a:-7.19,c:'USD'},{d:'2026-08-21',t:'SPCX',q:0.31427103,a:-42.81,c:'USD'}];
function fxOn(d){const y=+d.slice(0,4),m=+d.slice(5,7);if(y<=2024)return 1.082;if(y===2025){if(m<=4)return 1.09;if(m<=8)return 1.14;return 1.16;}return eurusd||1.17;}
function toEUR(a,c,d){return c==='EUR'?a:a/fxOn(d);}
function pxFromDaily(tk,d){
  if(!dailyPrices)return null;
  if(dailyPrices[d]&&dailyPrices[d][tk]>0)return dailyPrices[d][tk];
  const days=Object.keys(dailyPrices).sort();
  let p=null;
  for(let i=0;i<days.length;i++){
    if(days[i]<=d){const v=dailyPrices[days[i]]&&dailyPrices[days[i]][tk];if(v>0)p=v;}
    else break;
  }
  return p;
}
function pxOn(tk,d,live){
  if(live&&prices[tk]>0)return prices[tk];
  const fromDaily=pxFromDaily(tk,d);
  if(fromDaily!=null)return fromDaily;
  const s=(typeof HIST!=='undefined'&&HIST[tk])||[];
  let p=null;
  for(let i=0;i<s.length;i++){if(s[i][0]<=d)p=s[i][1];else break;}
  if(p==null&&prices[tk]>0)return prices[tk];
  return p;
}
function todayISO(){const n=new Date();return n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0');}
function isoFromDate(n){return n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0');}
function daysBetween(a,b){return Math.max(0,Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/86400000));}
function nid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
function prevCloseISO(){const d=new Date();d.setDate(d.getDate()-1);while(d.getDay()===0||d.getDay()===6)d.setDate(d.getDate()-1);return isoFromDate(d);}
function readLocal(){try{return JSON.parse(localStorage.getItem(LS_KEY)||'null');}catch(e){return null;}}
function persistLocal(){try{localStorage.setItem(LS_KEY,JSON.stringify({depositTxs:depositTxs,extraTxs:extraTxs,snapshots:snapshots,deposits:deposits,t:Date.now()}));}catch(e){}}
function setSaveHint(msg,ok){
  const el=document.getElementById('saveHint');
  if(!el)return;
  el.textContent=msg||'';
  el.className='muted '+(ok===false?'neg':(ok?'pos':''));
}

let holdings={},prices={QDVE:42.52,TSLA:353.12,VWCE:165.62,SPCX:136,BTC:0};
let deposits={EUR:{tin:0},USD:{tin:0}};
let depositTxs=[],extraTxs=[],snapshots=[];
let dailyPrices={};
let eurusd=1.1685,history=[],investedStocksEUR=0,investedBtcEUR=0,investedDepEUR=0;
let dataLoaded=false,depositsCleared=false,saveChain=Promise.resolve();
const chartInst={};

function stockTxs(){return SEED.concat(extraTxs);}
function weekDates(){const out=[],end=new Date();let d=new Date('2024-11-01T12:00:00');while(d<=end){out.push(isoFromDate(d));d.setDate(d.getDate()+7);}stockTxs().forEach(x=>{if(x.d&&out.indexOf(x.d)<0)out.push(x.d);});depositTxs.forEach(x=>{if(x.d&&out.indexOf(x.d)<0)out.push(x.d);});out.sort();return out;}
function lotsAt(dateStr){const lots={EUR:[],USD:[]};(depositTxs||[]).filter(function(t){return t&&t.d&&t.d<=dateStr;}).sort(function(a,b){return a.d.localeCompare(b.d)||String(a.id||'').localeCompare(String(b.id||''));}).forEach(function(t){const k=(t.k==='USD')?'USD':'EUR';const tin=t.tin!=null?t.tin:(deposits[k]&&deposits[k].tin)||0;if(t.a>=0) lots[k].push({d:t.d,a:t.a,tin});else{let need=-t.a;while(need>1e-8&&lots[k].length){const L=lots[k][0];const take=Math.min(L.a,need);L.a-=take;need-=take;if(L.a<1e-8)lots[k].shift();}}});return lots;}
function depPrincipalOn(dateStr,k){return lotsAt(dateStr)[k].reduce(function(s,L){return s+L.a;},0);}
function depValueNativeOn(dateStr,k){return lotsAt(dateStr)[k].reduce(function(s,L){return s+L.a*(1+(L.tin/100/365)*daysBetween(L.d,dateStr));},0);}
function depValueEUROn(dateStr){return depValueNativeOn(dateStr,'EUR')+depValueNativeOn(dateStr,'USD')/fxOn(dateStr);}
function depInvestedEUROn(dateStr){let eur=0;(depositTxs||[]).filter(function(t){return t&&t.d&&t.d<=dateStr;}).forEach(function(t){eur+=t.k==='EUR'?t.a:t.a/fxOn(t.d);});return eur;}
function snapshotOn(dateStr,live){
  const qty={};ASSETS.forEach(function(tk){qty[tk]=0;});
  let invS=0,invB=0;
  stockTxs().forEach(function(x){
    if(!x||!x.d||x.d>dateStr)return;
    qty[x.t]=(qty[x.t]||0)+x.q;
    const inv=-toEUR(x.a,x.c,x.d);
    if(x.t==='BTC')invB+=inv;else invS+=inv;
  });
  let vS=0;
  STOCKS.forEach(function(tk){
    const q=qty[tk];if(!q)return;
    const p=pxOn(tk,dateStr,live);if(p==null)return;
    vS+=CCY[tk]==='EUR'?q*p:q*p/fxOn(dateStr);
  });
  let vB=0;
  if(qty.BTC){const p=pxOn('BTC',dateStr,live);if(p!=null)vB=qty.BTC*p;}
  const vD=depValueEUROn(dateStr),invD=depInvestedEUROn(dateStr);
  return {v:vS+vB+vD,inv:invS+invB+invD,vStocks:vS,invStocks:invS,vBtc:vB,invBtc:invB,vDep:vD,invDep:invD,pl:(vS+vB+vD)-(invS+invB+invD)};
}
function applyLedger(){
  holdings={};
  ASSETS.forEach(function(tk){holdings[tk]={qty:0,currency:CCY[tk],name:NAMES[tk]};});
  investedStocksEUR=0;investedBtcEUR=0;history=[];
  const byDate={};
  stockTxs().forEach(function(x){(byDate[x.d]=byDate[x.d]||[]).push(x);});
  weekDates().forEach(function(d){
    (byDate[d]||[]).forEach(function(x){
      if(holdings[x.t])holdings[x.t].qty+=x.q;
      const inv=-toEUR(x.a,x.c,x.d);
      if(x.t==='BTC')investedBtcEUR+=inv;else investedStocksEUR+=inv;
    });
    let vStocks=0;
    STOCKS.forEach(function(tk){
      const q=holdings[tk].qty;if(!q)return;
      const p=pxOn(tk,d,false);if(p==null)return;
      vStocks+=holdings[tk].currency==='EUR'?q*p:q*p/fxOn(d);
    });
    let vBtc=0;
    if(holdings.BTC&&holdings.BTC.qty){
      const p=pxOn('BTC',d,false);if(p!=null)vBtc=holdings.BTC.qty*p;
    }
    const vDep=depValueEUROn(d);const invDep=depInvestedEUROn(d);
    history.push({t:new Date(d+'T15:00:00').getTime(),v:vStocks+vBtc+vDep,inv:investedStocksEUR+investedBtcEUR+invDep,vDep:vDep,invDep:invDep,vStocks:vStocks,invStocks:investedStocksEUR,vBtc:vBtc,invBtc:investedBtcEUR});
  });
  investedDepEUR=depInvestedEUROn(todayISO());
}

auth.onAuthStateChanged(async function(u){
  if(u&&ALLOWED.indexOf((u.email||'').toLowerCase())!==-1){
    document.getElementById('loginScreen').style.display='none';
    document.getElementById('app').style.display='block';
    document.getElementById('userEmail').textContent=u.email;
    const depDate=document.getElementById('depDate');
    if(depDate)depDate.value=todayISO();
    const btcDate=document.getElementById('btcDate');
    if(btcDate)btcDate.value=todayISO();
    await load();
    renderAll();
    if(typeof startPriceLoop==='function')startPriceLoop();
  }else{
    if(u){await auth.signOut();document.getElementById('loginError').textContent='No autorizado';}
    document.getElementById('loginScreen').style.display='block';
    document.getElementById('app').style.display='none';
  }
});
async function doLogin(){const e=document.getElementById('loginEmail').value.trim().toLowerCase(),p=document.getElementById('loginPassword').value,err=document.getElementById('loginError');err.textContent='';if(ALLOWED.indexOf(e)<0){err.textContent='Email no autorizado';return;}try{await auth.signInWithEmailAndPassword(e,p);}catch(ex){if(ex.code==='auth/user-not-found'){try{await auth.createUserWithEmailAndPassword(e,p);}catch(e2){err.textContent=e2.message;}}else err.textContent=ex.message;}}
function doLogout(){auth.signOut();}
function migrateDepositsIfNeeded(d){
  if(Array.isArray(d.depositTxs)&&d.depositTxs.length){depositTxs=d.depositTxs.slice();return true;}
  if(!d.deposits)return false;
  let added=false;
  ['EUR','USD'].forEach(function(k){
    const dep=d.deposits[k]||{};
    const p=+dep.principal||0;
    if(!p)return;
    const dt=dep.lastUpdate?new Date(dep.lastUpdate).toISOString().slice(0,10):todayISO();
    depositTxs.push({id:'mig-'+k,d:dt,k:k,a:p,tin:+dep.tin||0,note:'Saldo migrado'});
    if(dep.tin!=null)deposits[k]={tin:+dep.tin||0};
    added=true;
  });
  return added;
}
async function load(){
  let cloudHadDeposits=false;
  try{
    const doc=await db.collection('portfolio').doc('main').get();
    if(doc.exists){
      const d=doc.data();
      if(d.prices)prices=Object.assign(prices,d.prices);
      if(d.deposits){deposits={EUR:{tin:(d.deposits.EUR&&d.deposits.EUR.tin)||0},USD:{tin:(d.deposits.USD&&d.deposits.USD.tin)||0}};}
      if(d.eurusd)eurusd=d.eurusd;
      if(Array.isArray(d.extraTxs))extraTxs=d.extraTxs.slice();
      if(Array.isArray(d.snapshots))snapshots=d.snapshots.slice();
      cloudHadDeposits=migrateDepositsIfNeeded(d);
    }
  }catch(e){console.error(e);}
  const local=readLocal();
  if(local){
    if(!cloudHadDeposits&&Array.isArray(local.depositTxs)&&local.depositTxs.length){
      depositTxs=local.depositTxs.slice();
    }
    if((!extraTxs||!extraTxs.length)&&Array.isArray(local.extraTxs)&&local.extraTxs.length) extraTxs=local.extraTxs.slice();
    if((!snapshots||!snapshots.length)&&Array.isArray(local.snapshots)&&local.snapshots.length) snapshots=local.snapshots.slice();
    if(local.deposits){
      if(!(deposits.EUR&&deposits.EUR.tin)&&local.deposits.EUR) deposits.EUR=local.deposits.EUR;
      if(!(deposits.USD&&deposits.USD.tin)&&local.deposits.USD) deposits.USD=local.deposits.USD;
    }
  }
  applyLedger();
  dataLoaded=true;
  persistLocal();
  if(depositTxs.length&&!cloudHadDeposits){
    try{await save();}catch(e){console.error(e);}
  }
}
function save(){
  if(!dataLoaded) return Promise.resolve();
  if(!depositTxs.length&&!depositsCleared){
    const loc=readLocal();
    if(loc&&Array.isArray(loc.depositTxs)&&loc.depositTxs.length){
      depositTxs=loc.depositTxs.slice();
    }
  }
  persistLocal();
  const payload={
    holdings:holdings,
    prices:prices,
    deposits:deposits,
    depositTxs:depositTxs,
    extraTxs:extraTxs,
    snapshots:snapshots,
    eurusd:eurusd,
    investedStocksEUR:investedStocksEUR,
    investedDepEUR:investedDepEUR,
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  };
  saveChain=saveChain.catch(function(){}).then(function(){
    return db.collection('portfolio').doc('main').set(payload,{merge:true});
  }).then(function(){
    persistLocal();
    setSaveHint('Guardado en la nube',true);
    return true;
  }).catch(function(e){
    console.error(e);
    setSaveHint('No se pudo guardar en la nube. Los datos siguen en este teléfono.',false);
    alert('No se pudo guardar. Revisa la conexión e inténtalo otra vez.');
    throw e;
  });
  return saveChain;
}
async function savePricesOnly(){
  if(!dataLoaded)return;
  try{
    await db.collection('portfolio').doc('main').set({prices:prices,eurusd:eurusd},{merge:true});
  }catch(e){console.error(e);}
}
function fmt(n,dec){if(dec==null)dec=2;n=+n;return !isFinite(n)?'\u2014':n.toLocaleString('es-ES',{minimumFractionDigits:dec,maximumFractionDigits:dec});}
function valEUR(t){const h=holdings[t];if(!h)return 0;const p=prices[t]||0;return h.currency==='EUR'?h.qty*p:h.qty*p/eurusd;}
function stocksNow(){return STOCKS.reduce(function(s,k){return s+valEUR(k);},0);}
function btcNow(){return valEUR('BTC');}
function btcFeesOn(dateStr){let s=0;stockTxs().forEach(function(x){if(x&&x.t==='BTC'&&x.kind==='fee'&&x.d&&x.d<=dateStr)s+=-toEUR(x.a,x.c,x.d);});return s;}
function depNow(){return depValueEUROn(todayISO());}
function total(){return stocksNow()+btcNow()+depNow();}
function investedTotal(){return investedStocksEUR+investedBtcEUR+depInvestedEUROn(todayISO());}
function investedIn(tk){
  let s=0;
  stockTxs().forEach(function(x){if(x&&x.t===tk)s+=-toEUR(x.a,x.c,x.d);});
  return s;
}
function qtyOn(tk,dateStr){
  let q=0;
  stockTxs().forEach(function(x){if(x&&x.t===tk&&x.d&&x.d<=dateStr)q+=x.q;});
  return q;
}
function investedInOn(tk,dateStr){
  let s=0;
  stockTxs().forEach(function(x){if(x&&x.t===tk&&x.d&&x.d<=dateStr)s+=-toEUR(x.a,x.c,x.d);});
  return s;
}
function valOn(tk,dateStr,live){
  const q=qtyOn(tk,dateStr);
  if(!q)return 0;
  const p=pxOn(tk,dateStr,live);
  if(p==null)return null;
  return CCY[tk]==='EUR'?q*p:q*p/fxOn(dateStr);
}
function dayMoveAsset(tk){
  const prevD=prevCloseISO();
  const valPrev=valOn(tk,prevD,false);
  if(valPrev==null)return null;
  const invPrev=investedInOn(tk,prevD);
  const valNow=valEUR(tk);
  const invNow=investedIn(tk);
  const dayPl=(valNow-invNow)-(valPrev-invPrev);
  const pct=valPrev?dayPl/valPrev*100:0;
  return {dayPl:dayPl,pct:pct,prevD:prevD,valPrev:valPrev};
}
function renderHoldings(){
  const g=document.getElementById('holdingsGrid');if(!g)return;g.innerHTML='';
  ASSETS.forEach(function(t){
    const h=holdings[t]||{qty:0,currency:CCY[t],name:NAMES[t]};
    const p=prices[t]||0;
    const qDec=t==='BTC'?8:4;
    const val=valEUR(t);
    const inv=investedIn(t);
    const pl=val-inv;
    const pct=inv?pl/inv*100:0;
    const cls=pl>=0?'pos':'neg';
    const plTxt='Total '+(pl>=0?'+':'')+fmt(pl)+' \u20ac \u00b7 '+(pct>=0?'+':'')+fmt(pct,1)+'%';
    const hasPos=!!(h.qty||inv);
    let dayHtml='';
    if(hasPos){
      const dm=dayMoveAsset(t);
      if(dm){
        const dcls=dm.dayPl>=0?'pos':'neg';
        const dTxt=(dm.dayPl>=0?'+':'')+fmt(dm.dayPl)+' \u20ac \u00b7 '+(dm.pct>=0?'+':'')+fmt(dm.pct,1)+'%';
        dayHtml='<div class="pl-day"><span class="muted">Hoy</span><span class="'+dcls+'">'+dTxt+'</span></div>';
      }
    }
    const valueBlock=hasPos
      ?'<div class="value-eur '+cls+'">'+fmt(val)+' \u20ac</div><div class="pl-asset '+cls+'">'+plTxt+'</div>'+dayHtml
      :'<div class="value-eur">'+fmt(val)+' \u20ac</div>';
    const c=document.createElement('div');c.className='card';
    c.innerHTML='<div style="display:flex;justify-content:space-between"><b>'+t+'</b><span class="badge">'+h.currency+'</span></div><div class="muted">'+h.name+'</div><div class="price-row"><span>Cantidad</span><span>'+fmt(h.qty,qDec)+'</span></div><div class="price-row"><span>Precio</span><span><input class="edit-price" type="number" step="any" value="'+p+'" onchange="updatePrice(\''+t+'\',this.value)"> '+(h.currency==='EUR'?'\u20ac':'$')+'</span></div>'+valueBlock;
    g.appendChild(c);
  });
}
function renderDeps(){const g=document.getElementById('depositsGrid');if(!g)return;g.innerHTML='';const today=todayISO();['EUR','USD'].forEach(function(k){const prin=depPrincipalOn(today,k);const valN=depValueNativeOn(today,k);const valE=k==='EUR'?valN:valN/eurusd;const intN=valN-prin;const tin=(deposits[k]&&deposits[k].tin)||0;const c=document.createElement('div');c.className='card';c.innerHTML='<div style="display:flex;justify-content:space-between"><b>Dep\u00f3sito '+k+'</b><span class="badge badge-dep">TIN '+fmt(tin,2)+'%</span></div><div class="price-row"><span>Aportado neto</span><span>'+fmt(prin)+' '+k+'</span></div><div class="price-row"><span>Intereses est.</span><span class="'+(intN>=0?'pos':'neg')+'">'+(intN>=0?'+':'')+fmt(intN)+' '+k+'</span></div><div class="value-eur">'+fmt(valE)+' \u20ac</div>';g.appendChild(c);});const tb=document.getElementById('depTxBody');if(!tb)return;tb.innerHTML='';depositTxs.slice().sort(function(a,b){return b.d.localeCompare(a.d);}).forEach(function(t){const cls=t.a>=0?'pos':'neg';tb.innerHTML+='<tr><td>'+t.d+'</td><td>'+t.k+'</td><td class="'+cls+'">'+(t.a>=0?'+':'')+fmt(t.a)+' '+t.k+'</td><td>'+fmt(t.tin||0,2)+'%</td><td style="text-align:left">'+(t.note||'')+'</td><td><button class="btn-danger" onclick="removeDepositTx(\''+t.id+'\')">Quitar</button></td></tr>';});}
function renderTotal(){
  const v=total(),invDep=depInvestedEUROn(todayISO()),invS=investedStocksEUR,invB=investedBtcEUR,inv=invS+invB+invDep;
  const vS=stocksNow(),vB=btcNow(),vD=depNow(),fees=btcFeesOn(todayISO());
  const plBolsa=vS-invS,plBtc=vB-invB,plFondos=vD-invDep,pl=v-inv;
  const pct=inv?pl/inv*100:0,pctB=invS?plBolsa/invS*100:0,pctF=invDep?plFondos/invDep*100:0,pctC=invB?plBtc/invB*100:0;
  const tv=document.getElementById('totalValue');if(tv)tv.textContent=fmt(v)+' \u20ac';
  const plEl=document.getElementById('plLine');
  if(plEl){
    let html='Invertido neto (acciones + bitcoin + dep\u00f3sitos): <b>'+fmt(inv)+' \u20ac</b>';
    if(fees) html+=' \u00b7 comisiones BTC <span class="neg">-'+fmt(fees)+' \u20ac</span> (coste, sin valor)';
    html+='<br>Acciones valor '+fmt(vS)+' \u20ac \u00b7 invertido '+fmt(invS)+' \u20ac';
    if(vB||invB) html+=' \u00b7 Bitcoin valor '+fmt(vB)+' \u20ac \u00b7 invertido '+fmt(invB)+' \u20ac';
    html+=' \u00b7 Dep\u00f3sitos valor '+fmt(vD)+' \u20ac \u00b7 invertido '+fmt(invDep)+' \u20ac<br>';
    html+='P/L real bolsa: <span class="'+(plBolsa>=0?'pos':'neg')+'">'+(plBolsa>=0?'+':'')+fmt(plBolsa)+' \u20ac ('+fmt(pctB,1)+'%)</span>';
    if(vB||invB) html+=' \u00b7 P/L real bitcoin: <span class="'+(plBtc>=0?'pos':'neg')+'">'+(plBtc>=0?'+':'')+fmt(plBtc)+' \u20ac ('+fmt(pctC,1)+'%)</span>';
    html+=' \u00b7 P/L real fondos: <span class="'+(plFondos>=0?'pos':'neg')+'">'+(plFondos>=0?'+':'')+fmt(plFondos)+' \u20ac ('+fmt(pctF,1)+'%)</span> \u00b7 P/L real total: <span class="'+(pl>=0?'pos':'neg')+'">'+(pl>=0?'+':'')+fmt(pl)+' \u20ac ('+fmt(pct,1)+'%)</span>';
    plEl.innerHTML=html;
  }
  const sub=document.getElementById('totalSub');if(sub)sub.textContent='EUR/USD \u2248 '+fmt(eurusd,4);
}
function renderDayMove(){const el=document.getElementById('dayPl'),sub=document.getElementById('daySub');if(!el)return;try{const prevD=prevCloseISO();const prev=snapshotOn(prevD,false);const nowV=total(),nowInv=investedTotal(),nowPl=nowV-nowInv;const dPl=nowPl-(prev.pl||0),dV=nowV-prev.v,dInv=nowInv-prev.inv;el.className='day-val '+(dPl>=0?'pos':'neg');el.textContent=(dPl>=0?'+':'')+fmt(dPl)+' \u20ac';if(sub)sub.innerHTML='Cierre '+prevD+' \u00b7 valor entonces '+fmt(prev.v)+' \u20ac \u00b7 P/L entonces '+(prev.pl>=0?'+':'')+fmt(prev.pl)+' \u20ac<br>Hoy valor '+fmt(nowV)+' \u20ac \u00b7 cambio valor '+(dV>=0?'+':'')+fmt(dV)+' \u20ac \u00b7 aportado desde cierre '+(dInv>=0?'+':'')+fmt(dInv)+' \u20ac';}catch(e){console.error(e);el.textContent='sin dato';if(sub)sub.textContent=String(e.message||e);}}
function updatePrice(t,v){prices[t]=parseFloat(v)||0;save();renderAll();}
function addPurchase(){const t=document.getElementById('addTicker').value,q=parseFloat(document.getElementById('addQty').value),p=parseFloat(document.getElementById('addPrice').value);if(!q||!p){alert('Datos inv\u00e1lidos');return;}if(t==='BTC'){alert('Usa el formulario de Bitcoin, para apuntar tambi\u00e9n la comisi\u00f3n.');return;}const today=todayISO();extraTxs.push({id:nid(),d:today,t:t,q:q,a:-(q*p),c:CCY[t]});if(typeof HIST!=='undefined'){if(!HIST[t])HIST[t]=[];HIST[t].push([today,p]);HIST[t].sort(function(a,b){return a[0].localeCompare(b[0]);});}applyLedger();prices[t]=p;save();renderAll();}
async function addBtc(){
  const q=parseFloat(document.getElementById('btcQty').value);
  const pRaw=document.getElementById('btcPrice').value;
  const feeRaw=document.getElementById('btcFee').value;
  const d=document.getElementById('btcDate').value||todayISO();
  const p=pRaw===''?(+prices.BTC||0):parseFloat(pRaw);
  const fee=feeRaw===''?0:parseFloat(feeRaw);
  if(!q||q<=0||!isFinite(q)){alert('Cantidad de BTC inv\u00e1lida');return;}
  if(!p||p<=0||!isFinite(p)){alert('Precio de BTC inv\u00e1lido. Pon el precio en euros o espera a que cargue.');return;}
  if(isNaN(fee)||fee<0){alert('Comisi\u00f3n inv\u00e1lida');return;}
  extraTxs.push({id:nid(),d:d,t:'BTC',q:q,a:-(q*p),c:'EUR'});
  if(fee>0) extraTxs.push({id:nid(),d:d,t:'BTC',q:0,a:-Math.abs(fee),c:'EUR',kind:'fee',note:'Comisi\u00f3n de compra'});
  if(typeof HIST!=='undefined'){if(!HIST.BTC)HIST.BTC=[];HIST.BTC.push([d,p]);HIST.BTC.sort(function(a,b){return a[0].localeCompare(b[0]);});}
  prices.BTC=p;
  document.getElementById('btcQty').value='';
  document.getElementById('btcFee').value='';
  persistLocal();
  applyLedger();
  renderAll();
  setSaveHint('Guardando Bitcoin\u2026');
  try{await save();}catch(e){}
}
function renderBtcTxs(){
  const tb=document.getElementById('btcTxBody');if(!tb)return;
  tb.innerHTML='';
  extraTxs.filter(function(x){return x&&x.t==='BTC';}).slice().sort(function(a,b){return b.d.localeCompare(a.d);}).forEach(function(t){
    const isFee=t.kind==='fee';
    const qty=isFee?'\u2014':fmt(t.q,8);
    const amt=-toEUR(t.a,t.c,t.d);
    const label=isFee?'Comisi\u00f3n':'Compra';
    tb.innerHTML+='<tr><td>'+t.d+'</td><td>'+label+'</td><td>'+qty+'</td><td class="neg">-'+fmt(amt)+' \u20ac</td><td><button class="btn-danger" onclick="removeExtraTx(\''+t.id+'\')">Quitar</button></td></tr>';
  });
}
async function removeExtraTx(id){
  extraTxs=extraTxs.filter(function(t){return t.id!==id;});
  persistLocal();
  applyLedger();
  renderAll();
  try{await save();}catch(e){}
}
async function addDepositTx(){
  const k=document.getElementById('depSelect').value;
  const a=parseFloat(document.getElementById('depAmount').value);
  const tinRaw=document.getElementById('depTin').value;
  const tin=tinRaw===''?((deposits[k]&&deposits[k].tin)||0):parseFloat(tinRaw);
  const d=document.getElementById('depDate').value||todayISO();
  const note=document.getElementById('depNote').value.trim();
  if(isNaN(a)||!a){alert('Importe inv\u00e1lido');return;}
  if(isNaN(tin)){alert('TIN inv\u00e1lido');return;}
  deposits[k]={tin:tin};
  depositTxs.push({id:nid(),d:d,k:k,a:a,tin:tin,note:note});
  depositsCleared=false;
  document.getElementById('depAmount').value='';
  document.getElementById('depNote').value='';
  persistLocal();
  applyLedger();
  renderAll();
  setSaveHint('Guardando dep\u00f3sito…');
  try{await save();}catch(e){}
}
async function removeDepositTx(id){
  depositTxs=depositTxs.filter(function(t){return t.id!==id;});
  if(!depositTxs.length) depositsCleared=true;
  persistLocal();
  applyLedger();
  renderAll();
  try{await save();}catch(e){}
}
async function saveSnapshot(){
  const b=document.getElementById('saveSnapBtn');
  if(b){b.disabled=true;b.textContent='Guardando…';}
  setSaveHint('Guardando punto…');
  snapshots.push({t:Date.now(),v:total(),inv:investedTotal(),vDep:depNow()});
  persistLocal();
  try{
    await save();
    updateChart();
    if(b){b.textContent='Guardado';setTimeout(function(){b.disabled=false;b.textContent='Guardar punto';},1600);}
  }catch(e){
    if(b){b.disabled=false;b.textContent='Reintentar';}
  }
}
function lineOpts(){return {responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#ccc'}}},scales:{x:{ticks:{color:'#9a9aab',maxTicksLimit:8},grid:{color:'#2e2e3a'}},y:{ticks:{color:'#9a9aab'},grid:{color:'#2e2e3a'}}}};}
function lineSets(pts){return [{label:'Valor total (\u20ac)',data:pts.map(function(h){return h.v;}),borderColor:'#3b82f6',spanGaps:true,fill:true,backgroundColor:'rgba(59,130,246,.10)',tension:.15,pointRadius:2},{label:'Invertido total (\u20ac)',data:pts.map(function(h){return h.inv;}),borderColor:'#f59e0b',borderDash:[6,4],fill:false,tension:0,pointRadius:2},{label:'Valor dep\u00f3sitos (\u20ac)',data:pts.map(function(h){return h.vDep||0;}),borderColor:'#14b8a6',borderDash:[2,3],fill:false,tension:0,pointRadius:2}];}
function paintChart(canvasId,instKey,pts,labelFn,datasets,opts){try{const el=document.getElementById(canvasId);if(!el||typeof Chart==='undefined'||!pts||!pts.length)return;const labels=pts.map(labelFn);if(chartInst[instKey]){try{chartInst[instKey].destroy();}catch(e){}}chartInst[instKey]=new Chart(el.getContext('2d'),{type:'line',data:{labels:labels,datasets:datasets||lineSets(pts)},options:opts||lineOpts()});}catch(e){console.error('chart',canvasId,e);}}
function updateChart(){const pts=(history||[]).slice();(snapshots||[]).forEach(function(s){pts.push(s);});pts.sort(function(a,b){return a.t-b.t;});const last=pts[pts.length-1];if(!last||Math.abs(last.t-Date.now())>36e5)pts.push({t:Date.now(),v:total(),inv:investedTotal(),vDep:depNow()});paintChart('valueChart','hist',pts,function(h){return new Date(h.t).toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'2-digit'});});updateWeekChart();}
function lastWeekPts(){
  const pts=[];
  for(let i=7;i>=0;i--){
    const d=new Date();
    d.setHours(18,0,0,0);
    d.setDate(d.getDate()-i);
    const iso=isoFromDate(d);
    const live=i===0;
    const s=snapshotOn(iso,live);
    pts.push({t:live?Date.now():d.getTime(),v:s.v});
  }
  return pts;
}
function weekOpts(pts){
  const o=lineOpts();
  o.plugins={
    legend:{display:false},
    tooltip:{callbacks:{label:function(ctx){return ' '+Number(ctx.parsed.y).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' \u20ac';}}}
  };
  const vals=pts.map(function(h){return +h.v;}).filter(function(n){return isFinite(n);});
  if(!vals.length)return o;
  const mn=Math.min.apply(null,vals),mx=Math.max.apply(null,vals);
  const span=Math.max(mx-mn,1);
  const pad=Math.max(span*0.45,Math.abs(mx)*0.0025,25);
  o.scales.y.min=Math.floor((mn-pad)/10)*10;
  o.scales.y.max=Math.ceil((mx+pad)/10)*10;
  o.scales.y.ticks.callback=function(v){return Number(v).toLocaleString('es-ES',{maximumFractionDigits:0})+' \u20ac';};
  return o;
}
function updateWeekChart(){
  const pts=lastWeekPts();
  paintChart(
    'weekChartCanvas',
    'week',
    pts,
    function(h){return new Date(h.t).toLocaleDateString('es-ES',{weekday:'short',day:'2-digit',month:'short'});},
    [{label:'Valor cartera (\u20ac)',data:pts.map(function(h){return h.v;}),borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,.18)',fill:true,tension:.25,pointRadius:5,pointHoverRadius:7,borderWidth:2.5,spanGaps:true}],
    weekOpts(pts)
  );
}
function updateProjections(){const rEl=document.getElementById('assumedReturn'),vEl=document.getElementById('assumedVol'),iEl=document.getElementById('assumedInflation'),tb=document.getElementById('projBody');if(!tb)return;const r=(+(rEl&&rEl.value)||8)/100,vol=(+(vEl&&vEl.value)||18)/100,inf=(+(iEl&&iEl.value)||2.5)/100,base=total();const hs=[['1 d\u00eda',1/365],['1 sem',7/365],['1 mes',1/12],['1 a\u00f1o',1],['5 a\u00f1os',5],['10 a\u00f1os',10]];tb.innerHTML='';hs.forEach(function(item){const l=item[0],y=item[1];const m=base*Math.pow(1+r,y),real=m/Math.pow(1+inf,y),s=base*vol*Math.sqrt(y);tb.innerHTML+='<tr><td>'+l+'</td><td>'+fmt(base)+' \u20ac</td><td><b>'+fmt(m)+' \u20ac</b></td><td>'+fmt(real)+' \u20ac</td><td>'+fmt(Math.max(0,m-s))+' \u2013 '+fmt(m+s)+' \u20ac</td></tr>';});}
function renderAll(){try{renderHoldings();}catch(e){console.error(e);}try{renderBtcTxs();}catch(e){console.error(e);}try{renderDeps();}catch(e){console.error(e);}try{renderTotal();}catch(e){console.error(e);}try{renderDayMove();}catch(e){console.error(e);}try{updateProjections();}catch(e){console.error(e);}try{updateChart();}catch(e){console.error(e);}}
async function fetchFX(){try{const r=await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json');const d=await r.json();if(d&&d.eur&&d.eur.usd){eurusd=d.eur.usd;}}catch(e){}}
