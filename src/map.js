import {displayCells, finite, regionLabel, coordinate} from './geo.js';
import {createTooltip} from './tooltip.js';
const d3 = window.d3;
export function createMap({svg, legend, geography, metadata, onRegionSelect}) {
  const root = d3.select(svg).attr('viewBox', '0 0 960 520');
  const projection = d3.geoEquirectangular().precision(0.2);
  const path = d3.geoPath(projection);
  const clipId = 'map-extent';
  root.append('defs').append('clipPath').attr('id', clipId).append('rect');
  const frame = root.append('g').attr('clip-path', `url(#${clipId})`);
  const ocean = frame.append('rect');
  const land = frame.append('path').datum(geography.land);
  const cellsGroup = frame.append('g');
  const coast = frame.append('path').datum(geography.coastlines).attr('fill', 'none').attr('stroke-width', 0.65).attr('pointer-events', 'none');
  const selected = frame.append('rect').attr('fill', 'none').attr('stroke-width', 2.5).attr('pointer-events', 'none');
  const axes = root.append('g').attr('class', 'map-labels');
  const tooltip = createTooltip();
  const legendRoot = d3.select(legend).attr('viewBox', '0 0 360 52');
  const gradient = legendRoot.append('defs').append('linearGradient').attr('id', 'climate-gradient');
  legendRoot.append('rect').attr('x', 15).attr('y', 2).attr('width', 330).attr('height', 10).attr('fill', 'url(#climate-gradient)');
  const legendAxis = legendRoot.append('g').attr('transform', 'translate(0,15)');
  let current, lastGrid, lastBounds, display;
  function rect(selection) {
    return selection.attr('x', d => projection([d.bounds[0], d.bounds[3]])[0]).attr('y', d => projection([d.bounds[0], d.bounds[3]])[1])
      .attr('width', d => projection([d.bounds[1], 0])[0] - projection([d.bounds[0], 0])[0] + 0.1)
      .attr('height', d => projection([0, d.bounds[2]])[1] - projection([0, d.bounds[3]])[1] + 0.1);
  }
  cellsGroup.on('pointermove', event => {
    const cell = d3.select(event.target).datum();
    if (!cell?.bounds) return;
    tooltip.show(event, [regionLabel(cell), finite(cell.value) ? `${cell.value.toFixed(3)} ${current.layer === 'warming_rate' ? '°C/decade' : '°C'}` : 'No data', display.coarse ? 'Area-weighted 5° display cell' : 'Native 1° × 1.25° cell']);
  }).on('pointerleave', () => tooltip.hide()).on('click', event => {
    const [x, y] = projection.invert(d3.pointer(event, svg));
    if (x < -180 || x >= 180 || y < -90 || y >= 90) return;
    onRegionSelect(`r${Math.floor((y+90)/5)}_c${Math.floor((x+180)/5)}`);
  });
  return {
    update(state) {
      current = state;
      const {bounds: b, layerGrid, layer, colors, overlayOpacity, selectedRegion} = state;
      const boundsKey = JSON.stringify(b);
      const scale = Math.min(880 / ((b.lonMax-b.lonMin)*Math.PI/180), 420 / ((b.latMax-b.latMin)*Math.PI/180));
      projection.center([(b.lonMin+b.lonMax)/2, (b.latMin+b.latMax)/2]).scale(scale).translate([480, 244]);
      const [left, top] = projection([b.lonMin, b.latMax]);
      const [right, bottom] = projection([b.lonMax, b.latMin]);
      root.select(`#${clipId} rect`).attr('x', left).attr('y', top).attr('width', right-left).attr('height', bottom-top);
      ocean.attr('x', left).attr('y', top).attr('width', right-left).attr('height', bottom-top).attr('fill', colors.ocean);
      land.attr('d', path).attr('fill', colors.land);
      coast.attr('d', path).attr('stroke', colors.coastline);
      if (lastGrid !== layerGrid || lastBounds !== boundsKey) {
        display = displayCells(layerGrid, metadata, b);
        lastGrid = layerGrid; lastBounds = boundsKey;
      }
      const domain = metadata.domains[layer];
      const color = layer === 'temperature' ? d3.scaleSequential(d3.interpolateInferno).domain(domain) : d3.scaleDiverging(t => d3.interpolateRdBu(1-t)).domain([domain[0], 0, domain[1]]);
      rect(cellsGroup.selectAll('rect').data(display.cells, d => d.id).join('rect')).attr('fill', d => finite(d.value) ? color(d.value) : 'none').attr('fill-opacity', overlayOpacity);
      selected.datum(selectedRegion || {bounds: [0, 0, 0, 0]}).attr('display', selectedRegion ? null : 'none').attr('stroke', colors.selection).call(rect);
      const lonTicks = d3.ticks(b.lonMin, b.lonMax, 6), latTicks = d3.ticks(b.latMin, b.latMax, 4);
      axes.selectAll('.lon').data(lonTicks).join('text').attr('class', 'lon').attr('x', d => projection([d, 0])[0]).attr('y', bottom+23).attr('text-anchor', 'middle').text(d => coordinate(d));
      axes.selectAll('.lat').data(latTicks).join('text').attr('class', 'lat').attr('x', left-9).attr('y', d => projection([0, d])[1]+4).attr('text-anchor', 'end').text(d => coordinate(d, true));
      gradient.selectAll('stop').data(d3.range(21)).join('stop').attr('offset', d => `${d*5}%`).attr('stop-color', d => color(domain[0]+(domain[1]-domain[0])*d/20));
      legendAxis.call(d3.axisBottom(d3.scaleLinear().domain(domain).range([15, 345])).ticks(5).tickSize(3));
      return display.coarse;
    },
    destroy() { tooltip.destroy(); root.selectAll('*').remove(); }
  };
}
