import { fitTrend } from './trends.js';
import { seasonName, seasonColor } from './seasons.js';
const d3 = window.d3;
export function createTemporalChart({ svg }) {
  const root = d3.select(svg);
  const shade = root.append('rect').attr('class', 'analysis-window');
  const zero = root.append('line').attr('class', 'anomaly-zero');
  const lines = root.append('g'),
    fits = root.append('g');
  const xa = root.append('g').attr('transform', 'translate(0,350)'),
    ya = root.append('g').attr('transform', 'translate(55,0)');
  const legend = root.append('g').attr('transform', 'translate(55,20)');
  root
    .append('text')
    .attr('x', 55)
    .attr('y', 390)
    .text('Year · seasonal anomaly (°C), baseline 1951–1980')
    .attr('class', 'temporal-axis-label');
  return {
    update({ years, seriesA, seriesB, seasonA, seasonB, period }) {
      root.style('--series-a-color', seasonColor(seasonA));
      root.style('--series-b-color', seasonColor(seasonB));
      const data = [
        { season: seasonA, values: seriesA },
        { season: seasonB, values: seriesB },
      ];
      const trends = data.map((d) => fitTrend(years, d.values, period));
      const values = data.flatMap((d) =>
        d.values.filter((v) => typeof v === 'number' && Number.isFinite(v)),
      );
      const x = d3.scaleLinear().domain([1950, 2014]).range([55, 670]);
      const y = d3
        .scaleLinear()
        .domain([Math.min(-0.1, ...values), Math.max(0.1, ...values)])
        .nice()
        .range([350, 45]);
      shade
        .attr('x', x(period.start))
        .attr('y', 40)
        .attr('width', x(period.end) - x(period.start))
        .attr('height', 310);
      zero.attr('x1', 55).attr('x2', 670).attr('y1', y(0)).attr('y2', y(0));
      xa.call(d3.axisBottom(x).ticks(6).tickFormat(d3.format('d')));
      ya.call(d3.axisLeft(y).ticks(6));
      const line = d3
        .line()
        .defined((d) => typeof d.value === 'number' && Number.isFinite(d.value))
        .x((d) => x(d.year))
        .y((d) => y(d.value));
      lines
        .selectAll('path')
        .data(data)
        .join('path')
        .attr('class', (_, i) => `anomaly-line anomaly-history series-${i}`)
        .attr('d', (d) => line(years.map((year, i) => ({ year, value: d.values[i] }))));
      fits
        .selectAll('path')
        .data(trends)
        .join('path')
        .attr('class', (_, i) => `anomaly-line anomaly-fit series-${i}`)
        .attr('d', (d) =>
          d
            ? line([
                { year: period.start, value: d.startValue },
                { year: period.end, value: d.endValue },
              ])
            : null,
        );
      legend
        .selectAll('text')
        .data(data)
        .join('text')
        .attr('x', (_, i) => i * 240)
        .attr('class', (_, i) => `legend-label series-${i}`)
        .text((d, i) => `${seasonName(d.season)} · ${i ? 'dashed' : 'solid'}`);
      return trends;
    },
  };
}
