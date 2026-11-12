import { regionLabel, geographicBrushBounds, regionIdAt } from './geo.js';
import {
  formatRegionLocation,
  summarizeLandCover,
  summarizeAreaGeography,
} from './geography-context.js';
import {
  selectedIndices,
  blockWeight,
  zoomTarget,
  moveAreaBounds,
} from './area-selection.js';
import { seasonName } from './seasons.js';
import { createTooltip } from './tooltip.js';
const d3 = window.d3;
export function createMap({
  svg,
  legend,
  geography,
  regions,
  geographyById,
  onRegionSelect,
  onAreaSelect,
}) {
  const root = d3.select(svg);
  const projection = d3
    .geoEquirectangular()
    .scale(420 / Math.PI)
    .translate([480, 244]);
  const path = d3.geoPath(projection),
    tooltip = createTooltip();
  root
    .append('defs')
    .append('clipPath')
    .attr('id', 'map-clip')
    .append('rect')
    .attr('x', 60)
    .attr('y', 34)
    .attr('width', 840)
    .attr('height', 420);
  const viewport = root.append('g').attr('clip-path', 'url(#map-clip)');
  const world = viewport.append('g');
  const ocean = world
    .append('rect')
    .attr('class', 'map-ocean')
    .attr('x', 60)
    .attr('y', 34)
    .attr('width', 840)
    .attr('height', 420);
  const land = world
    .append('path')
    .attr('class', 'map-land')
    .datum(geography.land)
    .attr('d', path);
  const cells = world
    .append('g')
    .selectAll('rect')
    .data(regions, (d) => d.id)
    .join('rect')
    .attr('x', (d) => projection([d.bounds[0], d.bounds[3]])[0])
    .attr('y', (d) => projection([d.bounds[0], d.bounds[3]])[1])
    .attr('width', projection([5, 0])[0] - projection([0, 0])[0])
    .attr('height', projection([0, 0])[1] - projection([0, 5])[1])
    .attr('class', 'climate-cell')
    .attr('tabindex', 0)
    .attr('role', 'button')
    .attr(
      'aria-label',
      (d) => `${formatRegionLocation(geographyById[d.id], d.bounds)} · ${regionLabel(d)}`,
    );
  const coast = world
    .append('path')
    .attr('class', 'map-coastline')
    .datum(geography.coastlines)
    .attr('d', path);
  const outline = world.append('rect').attr('class', 'map-selected');
  const lr = d3.select(legend);
  const gradient = lr
    .append('defs')
    .append('linearGradient')
    .attr('id', 'difference-legend');
  lr.append('rect')
    .attr('x', 20)
    .attr('y', 5)
    .attr('width', 360)
    .attr('height', 12)
    .attr('class', 'difference-legend-ramp');
  const axis = lr.append('g').attr('transform', 'translate(0,20)');
  let current;
  function showRegion(event, d) {
    if (!d) return;
    const i = regions.indexOf(d),
      s = current;
    if (!s) return;
    tooltip.show(event, [
      formatRegionLocation(geographyById[d.id], d.bounds),
      `${d.id} · ${regionLabel(d)}`,
      summarizeLandCover(geographyById[d.id]?.land_fraction),
      `${s.period.start}–${s.period.end}`,
      `${seasonName(s.seasonA)}: ${s.ratesA[i].toFixed(4)} °C/decade`,
      `${seasonName(s.seasonB)}: ${s.ratesB[i].toFixed(4)} °C/decade`,
      `A − B: ${d3.format('+.4f')(s.ratesA[i] - s.ratesB[i])} °C/decade`,
    ]);
  }
  cells
    .on('keydown', (event, d) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onRegionSelect(d.id);
      }
    })
    .on('click', (_, d) => onRegionSelect(d.id))
    .on('pointermove', showRegion)
    .on('pointerleave', () => tooltip.hide());
  let transform = d3.zoomIdentity,
    brushing = false,
    brushStart = null,
    dragBounds = null;
  const regionById = new Map(regions.map((region) => [region.id, region]));
  function hitRegion(event) {
    const point = projection.invert(transform.invert(d3.pointer(event, svg)));
    return regionById.get(regionIdAt(...point));
  }
  const zoom = d3
    .zoom()
    .extent([
      [60, 34],
      [900, 454],
    ])
    .translateExtent([
      [60, 34],
      [900, 454],
    ])
    .scaleExtent([1, 12])
    .filter(
      (event) =>
        event.type === 'wheel' ||
        (event.type === 'mousedown' && event.shiftKey && !event.button),
    )
    .on('zoom', (event) => {
      transform = event.transform;
      world.attr('transform', transform);
      tooltip.hide();
      syncBrush();
    });
  root.call(zoom);
  const brush = d3
    .brush()
    .filter((event) => !event.shiftKey && !event.button)
    .extent([
      [60, 34],
      [900, 454],
    ])
    .on('start brush end', (event) => {
      if (!event.sourceEvent) return;
      if (event.type === 'start') {
        brushing = true;
        dragBounds =
          event.mode === 'drag' || event.mode === 'space'
            ? current?.selectedBounds
            : null;
        brushStart = d3.pointer(event.sourceEvent.touches?.[0] ?? event.sourceEvent, svg);
      }
      let bounds = geographicBrushBounds(event.selection, (point) =>
        projection.invert(transform.invert(point)),
      );
      if (dragBounds && event.selection) {
        const [west, north] = projection.invert(transform.invert(event.selection[0]));
        bounds = moveAreaBounds(dragBounds, west, north);
      }
      const indices = bounds ? selectedIndices(regions, bounds) : [];
      if (event.selection) {
        const source = event.sourceEvent.touches?.[0] ?? event.sourceEvent;
        let a = 0,
          b = 0,
          weight = 0;
        for (const i of indices) {
          if (Number.isFinite(current.ratesA[i]) && Number.isFinite(current.ratesB[i])) {
            const w = blockWeight(regions[i].bounds);
            a += w * current.ratesA[i];
            b += w * current.ratesB[i];
            weight += w;
          }
        }
        const areaBounds = bounds
          ? [bounds.lonMin, bounds.lonMax, bounds.latMin, bounds.latMax]
          : null;
        const areaGeo = areaBounds
          ? summarizeAreaGeography(geographyById, regions, indices, areaBounds)
          : null;
        tooltip.show(source, [
          areaBounds
            ? formatRegionLocation(areaGeo, areaBounds)
            : 'Select a geographic area',
          `${indices.length} complete 5° blocks`,
          summarizeLandCover(areaGeo?.land_fraction),
          weight
            ? `Area A − B: ${d3.format('+.4f')((a - b) / weight)} °C/decade`
            : 'No complete blocks in this rectangle',
          bounds
            ? regionLabel({
                bounds: [bounds.lonMin, bounds.lonMax, bounds.latMin, bounds.latMax],
              })
            : 'Drag a larger area to include a complete block',
          'Release to inspect area-weighted anomaly histories',
        ]);
      }
      if (event.type === 'end') {
        tooltip.hide();
        brushing = false;
        const end = d3.pointer(
          event.sourceEvent.changedTouches?.[0] ?? event.sourceEvent,
          svg,
        );
        if (
          !dragBounds &&
          brushStart &&
          Math.hypot(end[0] - brushStart[0], end[1] - brushStart[1]) < 4
        ) {
          const region = hitRegion(
            event.sourceEvent.changedTouches?.[0] ?? event.sourceEvent,
          );
          if (region) onRegionSelect(region.id);
        } else if (indices.length) onAreaSelect(bounds);
        syncBrush();
      }
    });
  const brushGroup = root
    .append('g')
    .attr('class', 'geographic-brush persistent-area-brush')
    .attr('clip-path', 'url(#map-clip)')
    .call(brush)
    .on('pointermove', (event) => {
      if (!brushing) showRegion(event, hitRegion(event));
    })
    .on('pointerleave', () => {
      if (!brushing) tooltip.hide();
    });
  function syncBrush() {
    if (brushing) return;
    const b = current?.selectedBounds;
    const selection = b
      ? [
          transform.apply(projection([b.lonMin, b.latMax])),
          transform.apply(projection([b.lonMax, b.latMin])),
        ]
      : null;
    brushGroup.call(brush.move, selection);
  }
  return {
    zoomBy(factor) {
      const b = current?.selectedBounds;
      if (factor > 1 && b) {
        const target = zoomTarget(b, projection, transform.k * factor);
        const next = d3.zoomIdentity.translate(target.x, target.y).scale(target.k);
        root.call(
          zoom.transform,
          zoom.constrain()(
            next,
            [
              [60, 34],
              [900, 454],
            ],
            [
              [60, 34],
              [900, 454],
            ],
          ),
        );
      } else root.call(zoom.scaleBy, factor);
    },
    resetZoom() {
      root.call(zoom.transform, d3.zoomIdentity);
    },
    update(s) {
      current = s;
      tooltip.hide();
      const color = d3
        .scaleDiverging((t) => d3.interpolateRdBu(1 - t))
        .domain([s.colorDomain[0], 0, s.colorDomain[1]]);
      for (const [name, value] of Object.entries(s.colors))
        root.style(`--map-${name}`, value);
      root.style('--map-overlay-opacity', s.overlayOpacity);
      cells.attr('fill', (_, i) =>
        Number.isFinite(s.ratesA[i] - s.ratesB[i])
          ? color(s.ratesA[i] - s.ratesB[i])
          : 'none',
      );
      syncBrush();

      const selected = regions.find((d) => d.id === s.selectedRegionId);
      outline.attr('display', selected ? null : 'none');
      if (selected)
        outline
          .attr('x', projection([selected.bounds[0], selected.bounds[3]])[0])
          .attr('y', projection([selected.bounds[0], selected.bounds[3]])[1])
          .attr('width', cells.attr('width'))
          .attr('height', cells.attr('height'));
      gradient
        .selectAll('stop')
        .data(d3.range(21))
        .join('stop')
        .attr('offset', (i) => `${i * 5}%`)
        .attr('stop-color', (i) =>
          color(s.colorDomain[0] + (i * (s.colorDomain[1] - s.colorDomain[0])) / 20),
        );
      axis.call(
        d3
          .axisBottom(d3.scaleLinear().domain(s.colorDomain).range([20, 380]))
          .tickValues([s.colorDomain[0], 0, s.colorDomain[1]])
          .tickFormat(d3.format('+.2f')),
      );
    },
  };
}
