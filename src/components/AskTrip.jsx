import React,{useState,useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import {Sparkles,ArrowRight,MapPin} from 'lucide-react';
export const API=import.meta.env.VITE_API_URL||'http://localhost:8787';
const examples=['I want to travel to Margao','Panaji to Calangute tomorrow morning','Take me to Palolem Beach'];
export default function AskTrip({defaultOrigin,when,initial='',chips=true}){
  const [text,setText]=useState(initial);
  useEffect(()=>setText(initial),[initial]);const nav=useNavigate();
  const go=(t=text)=>{if(!t.trim())return;nav(`/routes?q=${encodeURIComponent(t)}&from=${encodeURIComponent(defaultOrigin||'')}${when?`&when=${when}`:''}`)};
  return <div className="askTrip"><label><span><Sparkles size={14}/> TELL KINESIS WHERE YOU WANT TO GO</span>
    <div className="askRow"><input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&go()} placeholder="e.g. I want to travel to Margao" maxLength={300}/>
    <button className="primary" onClick={()=>go()} disabled={!text.trim()}><ArrowRight size={17}/></button></div></label>
    {chips&&<div className="askChips">{examples.map(e=><button key={e} type="button" onClick={()=>{setText(e);go(e)}}>{e}</button>)}</div>}
    <div className="askHint"><MapPin size={13}/> KINESIS will automatically use your current location.</div></div>
}
