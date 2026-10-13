import React,{useEffect,useState} from 'react';
import {useSearchParams,useNavigate} from 'react-router-dom';
import {ArrowRight,SlidersHorizontal,Sparkles,Loader2,MapPin} from 'lucide-react';
import RouteCard from '../components/RouteCard';
import AskTrip,{API} from '../components/AskTrip';
import {stopNames} from '../data/data';
import {getHere,deviceMinutes} from '../lib/here';
const enc=encodeURIComponent;
const sorters={Fastest:(a,b)=>a.duration-b.duration,Cheapest:(a,b)=>(a.fare??1e9)-(b.fare??1e9),'Least changes':(a,b)=>a.changes-b.changes};
export default function RoutesPage(){
  const [params]=useSearchParams();const nav=useNavigate();
  const q=params.get('q'),pFrom=params.get('from')||'',pTo=params.get('to')||'',when=params.get('when')||'';
  const [from,setFrom]=useState(pFrom),[to,setTo]=useState(pTo),[filter,setFilter]=useState('All');
  const [st,setSt]=useState({loading:false,error:'',plan:null});const [retry]=useState(0);
  useEffect(()=>{setFrom(pFrom);setTo(pTo)},[pFrom,pTo]);
  useEffect(()=>{
    if(!q&&!pTo){setSt({loading:false,error:'',plan:null});return}
    let dead=false;setSt({loading:true,error:'',plan:null});
    (async()=>{
      // Starting point not typed -> use the device's GPS; leave time = device clock unless a time of day was chosen.
      const g=(q||!pFrom)?await getHere():{pos:null}; console.log("GPS result:", g);const here=g.pos;const nowMin=deviceMinutes(); console.log("Coordinates being sent:", here);
      const req=q?fetch(`${API}/api/plan`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:q,defaultOrigin:pFrom||undefined,when:when||undefined,here:here||undefined,nowMin})})
        :fetch(`${API}/api/journeys?from=${enc(pFrom)}&to=${enc(pTo)}&when=${enc(when)}&now=${nowMin}${here?`&lat=${here.lat}&lon=${here.lon}`:''}`);
      const r=await req;if(!r.ok)throw new Error();const plan=await r.json();
      if(dead)return;
      setSt({loading:false,error:'',plan:{...plan,gpsReason:g.reason}});
      if(plan.origin&&!plan.usedLocation)setFrom(plan.origin);if(plan.destination)setTo(plan.destination);
    })().catch(()=>!dead&&setSt({loading:false,error:'The assistant server is not reachable. Start it with npm run server.',plan:null}));
    return()=>{dead=true};
  },[q,pFrom,pTo,when,retry]);
  const {plan,loading,error}=st;
  const list=plan?[...plan.journeys].sort(sorters[filter]||(()=>0)):[];
  const search=()=>to&&nav(`/routes?from=${enc(from)}&to=${enc(to)}${when?`&when=${when}`:''}`);
  return <div className="page"><div className="eyebrow">EXPLORE GOA. TRAVEL SMARTER.</div><h1>Your route, your choice</h1>
    <p className="lead">Search Goa bus routes using the KINESIS travel assistant.</p>
    <div className="tripBox compact"><AskTrip initial={q||[pFrom,pTo].filter(Boolean).join(' to ')} when={when} chips={false}/></div>
    {plan?.usedLocation&&<div className="aiBanner"><MapPin size={18}/><div>Starting from <b>your current location</b> (nearest stop: <b>{plan.origin}</b>, {plan.distanceToStopKm} km away) · leaving <b>{plan.leaveAt}</b></div></div>}
    {q&&plan&&<div className="aiBanner"><Sparkles size={18}/><div>You asked: “{q}”<br/>KINESIS understood <b>{plan.heardOrigin||plan.origin||'your starting point'}</b> → <b>{plan.heardDestination||'?'}</b>{plan.time&&<> · {plan.time}</>}{!plan.usedLocation&&plan.leaveAt&&<> · from {plan.leaveAt}</>}</div></div>}
    <div className="filterRow"><SlidersHorizontal size={17}/>{['All','Fastest','Cheapest','Least changes'].map(f=><button className={filter===f?'selected':''} onClick={()=>setFilter(f)} key={f}>{f}</button>)}</div>
    <div className="routesList">
      {loading&&<div className="empty"><Loader2 className="spin"/><p>Finding buses…</p></div>}
      {error&&<div className="empty"><h2>Can't reach the server</h2><p>{error}</p></div>}
      {!loading&&!error&&plan?.needLocation&&<div className="empty"><h2>Starting point needed</h2><p>Type where you are starting from in the FROM box above.</p></div>}
      {!loading&&!error&&plan&&!plan.ok&&!plan.needLocation&&<div className="empty"><h2>No route found</h2><p>{plan.message}</p></div>}
      {!loading&&!error&&!plan&&<div className="empty"><h2>Where to?</h2><p>Type a trip above, or tell KINESIS on the Home page.</p></div>}
      {list.map((r,i)=><RouteCard key={r.id+r.from+r.to+i} r={r}/>)}
    </div>
  </div>}
