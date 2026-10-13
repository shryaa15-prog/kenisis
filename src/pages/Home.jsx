import React from 'react';import {Link} from 'react-router-dom';import {ArrowRight,Bus,Sparkles,MapPinned} from 'lucide-react';import {routes,places} from '../data/data';import AskTrip from '../components/AskTrip';
export default function Home(){const featured=routes.find(r=>r.id==='MRG180_0')||routes[0];return <div className="page home"><section className="hero"><div className="eyebrow">MADE FOR GOA ✦</div><h1>Hello, explorer<span>.</span></h1><p>A little less planning. A lot more Goa.</p><div className="tripBox"><div className="tripHead"><span>Where are we heading?</span></div><AskTrip/><div className="tripFooter"></div></div><div className="quick"><Link to={`/tracking/${featured.id}`}><Bus/>Track a bus</Link><Link to="/assistant"><Sparkles/>Ask KINESIS AI</Link></div></section>
{/* <section className="section">
    <div className="sectionHead">
        <div>
            <div className="eyebrow">ON THE MOVE</div>
            <h2>Stay with your journey</h2>
            </div>
            <Link to={`/tracking/${featured.id}`}>View tracking <ArrowRight size={16}/></Link>
            </div>
            <div className="trackingPreview">
                <div className="mapFake">
                <div className="mapGrid"></div>
                <div className="mapRoute"><span className="dot">
                    </span><span className="dot end"></span></div>
                    <span className="mapLabel one">{featured.from}</span>
                    <span className="mapLabel two">{featured.nextStop}</span>
                    <span className="mapLabel three">{featured.to}</span></div>
                    <div className="busStatus"><span className="status">{featured.status.toUpperCase()}</span>
                    <h3>{featured.name}</h3><p>{featured.from} → {featured.to}</p><div className="eta"><div><small>NEXT STOP</small><b>{featured.nextStop}</b></div><strong>{featured.stops[1]?.time}</strong></div><Link className="secondary" to={`/tracking/${featured.id}`}>View live demo</Link></div></div>
                    </section> */}
                    
                    <section className="section"><div className="sectionHead"><div><div className="eyebrow">GO SOMEWHERE LOVELY</div><h2>Explore Goa</h2></div><Link to="/explore">Explore all <ArrowRight size={16}/></Link></div><div className="placeGrid">{places.slice(0,3).map(p=><Link className="placeCard" to={`/explore/${p.id}`} key={p.id}><img src={p.image}/><span>{p.type}</span><h3>{p.name}</h3><small>{p.area}</small></Link>)}</div></section></div>}
