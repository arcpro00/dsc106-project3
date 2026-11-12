import {finite, rankedRegions, regionLabel} from './geo.js';
import {createTooltip} from './tooltip.js';
const d3 = window.d3;
export function createRankingChart({viewport, svg, axis, onSelectRegion, onSummary}) {
  const root = d3.select(svg), axisRoot = d3.select(axis);
  const tooltip = createTooltip();
  const rowHeight = 35, width = 690, left = 230, right = 622;
  let rows = [], current, x;
  const pixelRatio = () => viewport.clientWidth / width;
  root.attr('viewBox', `0 0 ${width} 1`).attr('width', width);
  axisRoot.attr('viewBox', `0 0 ${width} 40`);
  const zero = root.append('line').attr('pointer-events', 'none').attr('stroke', '#6d7976').attr('stroke-dasharray', '2,3');
  const group = root.append('g');
  function draw() {
    const start = Math.max(0, Math.floor(viewport.scrollTop/(rowHeight*pixelRatio()))-6);
    const end = Math.min(rows.length, start+Math.ceil(viewport.clientHeight/(rowHeight*pixelRatio()))+12);
    const visible = rows.slice(start, end).map((d, i) => ({...d, index: start+i}));
    const row = group.selectAll('g').data(visible, d => d.id).join(enter => {
      const g = enter.append('g').attr('class', 'rank-row').attr('role', 'button').attr('tabindex', 0);
      g.append('rect').attr('class', 'row-bg').attr('width', width).attr('height', rowHeight-1);
      g.append('rect').attr('class', 'bar').attr('y', 8).attr('height', 19);
      g.append('text').attr('class', 'row-label').attr('x', 10).attr('y', 23);
      g.append('text').attr('class', 'row-value').attr('x', width-12).attr('y', 23).attr('text-anchor', 'end');
      return g;
    }).attr('transform', d => `translate(0,${d.index*rowHeight})`).attr('aria-label', d => `${regionLabel(d)}: ${d3.format('+.3f')(d.difference)} degrees C per decade`).attr('aria-pressed', d => d.id === current.selectedRegionId).classed('selected', d => d.id === current.selectedRegionId)
      .on('click', (_, d) => onSelectRegion(d.id)).on('keydown', (event, d) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectRegion(d.id); } })
      .on('pointermove', (event, d) => tooltip.show(event, [regionLabel(d), `${d.id} · ${current.seasonA}: ${d.rates[current.seasonA].toFixed(4)} °C/decade`, `${current.seasonB}: ${d.rates[current.seasonB].toFixed(4)} °C/decade`, `A − B: ${d3.format('+.4f')(d.difference)} °C/decade`])).on('pointerleave', () => tooltip.hide());
    row.select('.bar').attr('x', d => x(Math.min(0, d.difference))).attr('width', d => Math.abs(x(d.difference)-x(0))).attr('fill', d => d.difference >= 0 ? '#b75b39' : '#397f99');
    row.select('.row-label').text(d => regionLabel(d));
    row.select('.row-value').text(d => d3.format('+.3f')(d.difference));
    zero.raise();
  }
  viewport.addEventListener('scroll', draw);
  const observer = new ResizeObserver(() => {
    root.attr('height', Math.max(rows.length*rowHeight, 1)*pixelRatio());
    if (current) draw();
  });
  observer.observe(viewport);
  let priorFilter;
  return {
    update(state) {
      current = state;
      const filterKey = JSON.stringify([state.bounds, state.seasonA, state.seasonB, state.rankDirection, state.search, state.threshold]);
      if (priorFilter !== filterKey) { viewport.scrollTop = 0; priorFilter = filterKey; }
      const result = rankedRegions(state.regions, state);
      rows = result.rows;
      const extent = d3.max(state.regions, d => finite(d.rates[state.seasonA]) && finite(d.rates[state.seasonB]) ? Math.abs(d.rates[state.seasonA]-d.rates[state.seasonB]) : 0) || 0.1;
      x = d3.scaleLinear().domain([-extent, extent]).nice().range([left, right]);
      const height = Math.max(rows.length*rowHeight, 1);
      root.attr('height', height*pixelRatio()).attr('viewBox', `0 0 ${width} ${height}`);
      zero.attr('x1', x(0)).attr('x2', x(0)).attr('y1', 0).attr('y2', height);
      axisRoot.selectAll('g').data([null]).join('g').attr('transform', 'translate(0,28)').call(d3.axisTop(x).ticks(5).tickSize(4));
      onSummary(result);
      draw();
    },
    destroy() { observer.disconnect(); viewport.removeEventListener('scroll', draw); tooltip.destroy(); root.selectAll('*').remove(); }
  };
}
