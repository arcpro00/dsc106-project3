import {createState} from './state.js';
import {loadMetadata,loadRegions,loadGeography,loadRegionalAnomalies,loadGlobalAnomalies} from './data.js';
import {createTrends,periodFor} from './trends.js';
import {createMap} from './map.js';
import {createTemporalChart} from './temporal-chart.js';
import {seasonName} from './seasons.js';
import {regionLabel} from './geo.js';
const $=id=>document.getElementById(id);
const store=createState({seasonA:'DJF',seasonB:'JJA',periodMode:'full',windowEndYear:2014,windowYears:30,selectedRegionId:null,overlayOpacity:.8,colors:{land:'#d8dfd3',ocean:'#dcecf5',coastline:'#596a6e',selection:'#242424'}});
async function init(){
 try {
 const [metadata,regions,geography,bundle,global]=await Promise.all([loadMetadata(),loadRegions(),loadGeography(),loadRegionalAnomalies(),loadGlobalAnomalies()]);
 if(bundle.regionIds.length!==regions.length||bundle.regionIds.some((id,i)=>id!==regions[i].id)||bundle.years.length!==65)throw Error('Regional bundle ordering or dimensions are invalid.');
 const trends=createTrends(bundle);
 const map=createMap({svg:$('map'),legend:$('legend'),geography,regions,onRegionSelect:id=>store.set({selectedRegionId:id})});
 const chart=createTemporalChart({svg:$('temporal')});
 function render(s){
 const period=periodFor(s.periodMode,s.windowEndYear);
 $('period-label').textContent=`Analysis period: ${period.start}–${period.end} (${period.end-period.start+1} years)`;
 $('full-period').checked=s.periodMode==='full';$('end-year').value=s.windowEndYear;
 $('end-value').textContent=s.windowEndYear;
 for(const id of ['seasonA','seasonB']){ $(id).value=s[id];for(const option of $(id).options)option.disabled=option.value===s[id==='seasonA'?'seasonB':'seasonA']; }
 const ratesA=trends.getRates(s.seasonA,period),ratesB=trends.getRates(s.seasonB,period);
 map.update({...s,period,ratesA,ratesB,colorDomain:trends.getDomain(s.seasonA,s.seasonB)});
 const index=bundle.regionIds.indexOf(s.selectedRegionId);
 const context=index<0?'Global context':`${s.selectedRegionId} · ${regionLabel(regions[index])}`;
 $('context').textContent=context;$('clear-selection').hidden=index<0;
 const seriesA=index<0?global.anomalies[s.seasonA]:bundle.anomalies[s.seasonA][index];
 const seriesB=index<0?global.anomalies[s.seasonB]:bundle.anomalies[s.seasonB][index];
 const fits=chart.update({years:bundle.years,seriesA,seriesB,seasonA:s.seasonA,seasonB:s.seasonB,period});
 $('summary').textContent=fits.every(Boolean)?`${seasonName(s.seasonA)}: ${fits[0].rate.toFixed(4)} · ${seasonName(s.seasonB)}: ${fits[1].rate.toFixed(4)} · A − B: ${window.d3.format('+.4f')(fits[0].rate-fits[1].rate)} °C/decade`:'Insufficient observations to fit trends.';
 $('legend-caption').textContent=`Negative: ${seasonName(s.seasonB)} warms faster · Positive: ${seasonName(s.seasonA)} warms faster. Scale fixed across all periods for this pair.`;
 $('status').textContent='Ready · GFDL-ESM4 historical simulation';
 }
 for(const id of ['seasonA','seasonB'])$(id).addEventListener('change',e=>store.set({[id]:e.target.value}));
 $('full-period').addEventListener('change',e=>store.set({periodMode:e.target.checked?'full':'moving'}));
 let frame;
 $('end-year').addEventListener('input',e=>{const end=Number(e.target.value);$('end-value').textContent=end;$('period-label').textContent=`Analysis period: ${end-29}–${end} (30 years)`;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>store.set({windowEndYear:end,periodMode:'moving'}));});
 $('clear-selection').addEventListener('click',()=>store.set({selectedRegionId:null}));
 $('opacity').addEventListener('input',e=>store.set({overlayOpacity:Number(e.target.value)}));
 for(const key of ['land','ocean','coastline','selection'])$(key).addEventListener('input',e=>store.set({colors:{...store.get().colors,[key]:e.target.value}}));
 store.subscribe(render);render(store.get());
 }catch(error){$('status').textContent=`Unable to load explorer: ${error.message} Refresh to retry. Serve the site through HTTP.`;}
}
init();
