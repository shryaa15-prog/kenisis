import React from 'react';
import {ArrowRight, IndianRupee} from 'lucide-react';
import {Link} from 'react-router-dom';
import {fareText} from '../data/data';
export default function RouteCard({r}){
  const first=r.legs?.[0];
  const q=new URLSearchParams({board:r.from,alight:first?first.to:r.to,fare:first?'':(r.fare??'')});
  return <div className="routeCard">
    <div className="routeTop"><div><span className="busPill">{r.name}</span>{r.recommended&&<span className="recommend">Recommended</span>}</div><strong>{r.duration} min</strong></div>
    <div className="routeLine"><span>{r.from}</span><ArrowRight size={16}/><span>{r.to}</span></div>
    {r.legs&&<div className="legs">{r.legs.map((l,i)=><div key={i}><b>{l.bus}</b> {l.from} → {l.to} <small>{l.departs} – {l.arrives}</small></div>)}</div>}
    <div className="routeMeta"><span><IndianRupee size={14}/>{fareText(r.fare).replace('₹','')}</span><span>{r.changes===0?'Direct':`${r.changes} change`}</span><span>{r.via}</span></div>
    {r.nextDepartures&&<div className="deps">Next: {r.nextDepartures.join(' · ')}{r.arrivalAt&&<> · arrives {r.arrivalAt}</>}</div>}
    <div className="routeBottom"><small>{r.status} · {r.departure}</small><Link to={`/journey/${r.id}?${q}`}>View route <ArrowRight size={15}/></Link></div>
  </div>}
