// Route data is generated from the Kadamba (KTCL) GTFS feed: node scripts/build-gtfs.mjs <gtfs-folder>
export {routes,stopNames} from './routes.generated.js';
export {places,tickets,assistantAnswers} from './extras.js';
export const fareText=f=>f==null?'Fare n/a':`₹${f}`;
const mins=t=>t==='Start'?0:parseInt(t)||0;
// Cut a full route down to the part the passenger actually rides.
export function segment(r,board,alight,fare){
  if(!board)return r;
  const i=r.stops.findIndex(s=>s.name===board);const j=r.stops.findIndex((s,k)=>k>i&&s.name===alight);
  if(i<0||j<0)return r;
  const base=mins(r.stops[i].time);
  const stops=r.stops.slice(i,j+1).map((s,k)=>({name:s.name,time:k===0?'Start':`${Math.round(mins(s.time)-base)} min`}));
  return {...r,from:board,to:alight,stops,nextStop:stops[1]?.name||alight,duration:Math.max(1,Math.round(mins(r.stops[j].time)-base)),fare:fare===undefined?null:fare};
}
