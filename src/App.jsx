
import React from 'react';
import {Routes,Route} from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';import RoutesPage from './pages/RoutesPage';import Tracking from './pages/Tracking';import Journey from './pages/Journey';import Explore from './pages/Explore';import Place from './pages/Place';import Assistant from './pages/Assistant';import Booking from './pages/Booking';
export default function App(){return <Layout><Routes><Route path="/" element={<Home/>}/><Route path="/routes" element={<RoutesPage/>}/><Route path="/tracking" element={<Tracking/>}/><Route path="/tracking/:routeId" element={<Tracking/>}/><Route path="/journey" element={<Journey/>}/><Route path="/journey/:routeId" element={<Journey/>}/><Route path="/explore" element={<Explore/>}/><Route path="/explore/:id" element={<Place/>}/><Route path="/assistant" element={<Assistant/>}/><Route path="/booking" element={<Booking/>}/><Route path="*" element={<Home/>}/></Routes></Layout>}
