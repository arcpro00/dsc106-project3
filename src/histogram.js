import {histogramDomain} from './selectors.js';
const d3 = window.d3;
export function createHistogram({svg, onRangeChange}) {
  const width = 690, height = 165, margin = {left: 38, right: 16, top: 18, bottom: 36};
  const root = d3.select(svg).attr('viewBox', `0 0 ${width} ${height}`);
  const bars = root.append('g').attr('class', 'histogram-bars');
  const zero = root.append('line').attr('class', 'histogram-zero');
  const axis = root.append('g').attr('transform', `translate(0,${height-margin.bottom})`);
  root.append('text').attr('class', 'histogram-label').attr('x', width/2).attr('y', height-3).attr('text-anchor', 'middle').text('Signed A − B difference · °C/decade');
  const label = root.append('text').attr('class', 'histogram-label').attr('x', margin.left).attr('y', 11);
  const x = d3.scaleLinear().range([margin.left, width-margin.right]);
  const brush = d3.brushX().extent([[margin.left, margin.top], [width-margin.right, height-margin.bottom]])
    .on('end', event => {
      if (!event.sourceEvent) return;
      onRangeChange(event.selection ? event.selection.map(x.invert) : null);
    });
  const brushGroup = root.append('g').attr('class', 'histogram-brush').call(brush);
  let priorEligible;
  return {
    update({eligible, histogramRange}) {
      // Keep the eligible distribution in place when presets or the brush change.
      if (eligible !== priorEligible) {
        x.domain(histogramDomain(eligible)).nice();
        const bins = d3.bin().value(region => region.difference).domain(x.domain()).thresholds(x.ticks(36))(eligible);
        const y = d3.scaleLinear().domain([0, d3.max(bins, bin => bin.length) || 1]).range([height-margin.bottom, margin.top]);
        bars.selectAll('rect').data(bins, bin => bin.x0).join('rect')
          .attr('x', bin => x(bin.x0)+.5).attr('width', bin => Math.max(0, x(bin.x1)-x(bin.x0)-1))
          .attr('y', bin => y(bin.length)).attr('height', bin => y(0)-y(bin.length))
          .attr('class', bin => (bin.x0+bin.x1)/2 < 0 ? 'negative' : 'positive')
          .selectAll('title').data(bin => [bin]).join('title').text(bin => `${bin.length} regions · ${bin.x0.toFixed(3)} to ${bin.x1.toFixed(3)} °C/decade`);
        axis.call(d3.axisBottom(x).ticks(6).tickSize(3));
        zero.attr('x1', x(0)).attr('x2', x(0)).attr('y1', margin.top).attr('y2', height-margin.bottom);
        label.text(`${eligible.length.toLocaleString()} eligible regions · count per bin`);
        priorEligible = eligible;
      }
      brushGroup.call(brush.move, histogramRange ? histogramRange.map(x) : null);
    },
    destroy() { root.selectAll('*').remove(); }
  };
}
