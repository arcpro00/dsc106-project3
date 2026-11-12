import {regionLabel} from './geo.js';
import {seasonName} from './seasons.js';
import {createTooltip} from './tooltip.js';
const d3=window.d3;
export function createMap({svg,legend,geography,regions,onRegionSelect}) {
 const root=d3.select(svg).attr('viewBox','0 0 960 520');
 const projection=d3.geoEquirectangular().scale(420/Math.PI).translate([480,244]);
 const path=d3.geoPath(projection), tooltip=createTooltip();
 const ocean=root.append('rect').attr('x',60).attr('y',34).attr('width',840).attr('height',420);
 const land=root.append('path').datum(geography.land).attr('d',path);
 const cells=root.append('g').selectAll('rect').data(regions,d=>d.id).join('rect')
 .attr('x',d=>projection([d.bounds[0],d.bounds[3]])[0]).attr('y',d=>projection([d.bounds[0],d.bounds[3]])[1])
 .attr('width',projection([5,0])[0]-projection([0,0])[0]).attr('height',projection([0,0])[1]-projection([0,5])[1]).attr('cursor','pointer');
 const coast=root.append('path').datum(geography.coastlines).attr('d',path).attr('fill','none').attr('stroke-width',.7).attr('pointer-events','none');
 const outline=root.append('rect').attr('fill','none').attr('stroke-width',3).attr('pointer-events','none');
 const lr=d3.select(legend).attr('viewBox','0 0 400 60');
 const gradient=lr.append('defs').append('linearGradient').attr('id','difference-legend');
 lr.append('rect').attr('x',20).attr('y',5).attr('width',360).attr('height',12).attr('fill','url(#difference-legend)');
 const axis=lr.append('g').attr('transform','translate(0,20)');
 let current;
 cells.on('click',(_,d)=>onRegionSelect(d.id)).on('pointermove',(event,d)=>{
  const i=regions.indexOf(d),s=current;
  d3.select(event.currentTarget).attr('stroke','#c38d1e');
  tooltip.show(event,[`${d.id} · ${regionLabel(d)}`,`${s.period.start}–${s.period.end}`,`${seasonName(s.seasonA)}: ${s.ratesA[i].toFixed(4)} °C/decade`,`${seasonName(s.seasonB)}: ${s.ratesB[i].toFixed(4)} °C/decade`,`A − B: ${d3.format('+.4f')(s.ratesA[i]-s.ratesB[i])} °C/decade`]);
 }).on('pointerleave',event=>{d3.select(event.currentTarget).attr('stroke',null);tooltip.hide();});
 return {update(s){
  current=s;
  const color=d3.scaleDiverging(t=>d3.interpolateRdBu(1-t)).domain([s.colorDomain[0],0,s.colorDomain[1]]);
  ocean.attr('fill',s.colors.ocean);land.attr('fill',s.colors.land);coast.attr('stroke',s.colors.coastline);
  cells.attr('fill',(_,i)=>Number.isFinite(s.ratesA[i]-s.ratesB[i])?color(s.ratesA[i]-s.ratesB[i]):'none').attr('fill-opacity',s.overlayOpacity);
  const selected=regions.find(d=>d.id===s.selectedRegionId);
  outline.attr('display',selected?null:'none').attr('stroke',s.colors.selection);
  if(selected)outline.attr('x',projection([selected.bounds[0],selected.bounds[3]])[0]).attr('y',projection([selected.bounds[0],selected.bounds[3]])[1]).attr('width',cells.attr('width')).attr('height',cells.attr('height'));
  gradient.selectAll('stop').data(d3.range(21)).join('stop').attr('offset',i=>`${i*5}%`).attr('stop-color',i=>color(s.colorDomain[0]+i*(s.colorDomain[1]-s.colorDomain[0])/20));
  axis.call(d3.axisBottom(d3.scaleLinear().domain(s.colorDomain).range([20,380])).tickValues([s.colorDomain[0],0,s.colorDomain[1]]).tickFormat(d3.format('+.2f')));
 }};
}
