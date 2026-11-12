import { finite, regionLabel } from './geo.js';
import { seasonName } from './seasons.js';
import { globalStanding } from './selectors.js';
const d3 = window.d3;
export function createRegionDetails({ container, svg, status, loadSeries }) {
  const root = d3.select(svg).attr('viewBox', '0 0 690 240');
  const plot = root.append('g');
  const xAxis = root.append('g').attr('transform', 'translate(0,204)');
  const yAxis = root.append('g').attr('transform', 'translate(48,0)');
  const zero = plot.append('line').attr('class', 'anomaly-zero');
  const lines = plot.append('g');
  const legend = root.append('g').attr('transform', 'translate(48,15)');
  root
    .append('text')
    .attr('class', 'anomaly-axis-label')
    .attr('x', 48)
    .attr('y', 237)
    .text('Year · seasonal anomaly relative to 1951–1980 (°C)');
  let requestId = 0,
    previousKey;
  function message(text) {
    const p = document.createElement('p');
    p.textContent = text;
    return p;
  }
  return {
    async update({ state, global }) {
      const key = JSON.stringify([state.selectedRegionId, state.seasonA, state.seasonB]);
      if (key === previousKey) return;
      previousKey = key;
      const token = ++requestId;
      const selected = global.find((region) => region.id === state.selectedRegionId);
      container.replaceChildren();
      if (!selected) {
        container.append(
          message(
            'Select a ranked region or a map block to inspect its seasonal rates and anomaly history.',
          ),
        );
        svg.setAttribute('hidden', '');
        status.textContent = '';
        return;
      }
      const heading = document.createElement('strong');
      heading.textContent = `${regionLabel(selected)} · ${selected.id}`;
      container.append(heading);
      const list = document.createElement('dl');
      for (const [season, rate] of Object.entries(selected.rates)) {
        const item = document.createElement('div'),
          dt = document.createElement('dt'),
          dd = document.createElement('dd');
        dt.textContent = seasonName(season);
        dd.textContent = finite(rate) ? rate.toFixed(3) : 'No data';
        item.append(dt, dd);
        list.append(item);
      }
      container.append(
        list,
        message('Four seasonal warming rates · °C/decade · fitted over 1950–2014'),
      );
      const comparison = `${seasonName(state.seasonA)} − ${seasonName(state.seasonB)}`;
      const faster =
        selected.difference > 0
          ? `${seasonName(state.seasonA)} warms faster`
          : selected.difference < 0
            ? `${seasonName(state.seasonB)} warms faster`
            : 'Both seasons warm at the same rate';
      container.append(
        message(
          `${comparison}: ${d3.format('+.4f')(selected.difference)} °C/decade · ${faster}.`,
        ),
      );
      const standing = globalStanding(global, selected.id);
      container.append(
        message(
          `Global signed rank ${standing.rank.toLocaleString()} of ${standing.total.toLocaleString()} · ${standing.percentile.toFixed(1)}th percentile. Rank 1 is the largest signed difference; ties use region ID.`,
        ),
      );
      svg.setAttribute('hidden', '');
      status.textContent = 'Loading seasonal anomaly history…';
      try {
        const seasons = [...new Set([state.seasonA, state.seasonB])];
        const series = await Promise.all(
          seasons.map((season) => loadSeries(selected.id, season)),
        );
        if (token !== requestId) return;
        const x = d3.scaleLinear().domain([1950, 2014]).range([48, 670]);
        const values = series.flatMap((series) => series.values.filter(finite));
        if (!values.length) {
          status.textContent = 'No anomaly observations are available for this region.';
          return;
        }
        const y = d3
          .scaleLinear()
          .domain([Math.min(0, d3.min(values)), Math.max(0, d3.max(values))])
          .nice()
          .range([204, 34]);
        if (y.domain()[0] === y.domain()[1]) y.domain([-1, 1]);
        xAxis.call(d3.axisBottom(x).ticks(6).tickFormat(d3.format('d')));
        yAxis.call(d3.axisLeft(y).ticks(5).tickSize(3));
        zero.attr('x1', 48).attr('x2', 670).attr('y1', y(0)).attr('y2', y(0));
        const line = d3
          .line()
          .defined((point) => finite(point.value))
          .x((point) => x(point.year))
          .y((point) => y(point.value));
        lines
          .selectAll('path')
          .data(series, (series) => series.season)
          .join('path')
          .attr('class', (_, index) => `anomaly-line series-${index}`)
          .attr('d', (series) =>
            line(series.years.map((year, i) => ({ year, value: series.values[i] }))),
          );
        const keys = legend
          .selectAll('g')
          .data(series, (series) => series.season)
          .join('g')
          .attr('transform', (_, index) => `translate(${index * 170},0)`);
        keys
          .selectAll('line')
          .data((_, index) => [index])
          .join('line')
          .attr('class', (index) => `anomaly-line series-${index}`)
          .attr('x2', 25);
        keys
          .selectAll('text')
          .data((series) => [series])
          .join('text')
          .attr('x', 33)
          .attr('y', 4)
          .text((series) => seasonName(series.season));
        svg.removeAttribute('hidden');
        status.textContent =
          'Seasonal temperature anomalies · 1950–2014 · baseline 1951–1980. These are annual seasonal anomalies, not annual warming rates.';
      } catch (error) {
        if (token !== requestId) return;
        previousKey = null;
        status.textContent = `Anomaly history unavailable: ${error.message}`;
      }
    },
    destroy() {
      requestId++;
      root.selectAll('*').remove();
    },
  };
}
