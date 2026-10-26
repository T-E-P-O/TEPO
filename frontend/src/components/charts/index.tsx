import type { ReactNode } from 'react';

// Grafici SVG fatti in casa: nessuna dipendenza, colori dai token, tabella sr-only inclusa.

type LinePoint = { x: number; y: number };

export type LineSeries = {
  key: string;
  label: string;
  color: string;
  points: LinePoint[];
  dashed?: boolean;
  markers?: boolean;
};

type LineChartProps = {
  series: LineSeries[];
  xLabel: string;
  yLabel: string;
  formatX: (value: number) => string;
  formatY: (value: number) => string;
  ariaLabel: string;
  height?: number;
  annotation?: { x: number; y: number; label: string };
  yMinZero?: boolean;
};

const WIDTH = 720;

function niceDomain(min: number, max: number, includeZero: boolean): [number, number] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  let low = includeZero ? Math.min(0, min) : min;
  let high = includeZero ? Math.max(0, max) : max;
  if (low === high) {
    low = low - 1;
    high = high + 1;
  }
  const padding = (high - low) * 0.08;
  low = includeZero && low === 0 ? 0 : low - padding;
  high += padding;
  return [low, high];
}

export function LineChart({
  series,
  xLabel,
  yLabel,
  formatX,
  formatY,
  ariaLabel,
  height = 300,
  annotation,
  yMinZero = false
}: LineChartProps) {
  const allPoints = series.flatMap((item) => item.points);
  if (allPoints.length === 0) {
    return <div className="chart-empty">Nessun dato da rappresentare.</div>;
  }

  const margin = { top: 16, right: 18, bottom: 40, left: 62 };
  const innerWidth = WIDTH - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const xValues = allPoints.map((point) => point.x);
  const yValues = allPoints.map((point) => point.y);
  const [xMin, xMax] = niceDomain(Math.min(...xValues), Math.max(...xValues), false);
  const [yMin, yMax] = niceDomain(Math.min(...yValues), Math.max(...yValues), yMinZero);

  const scaleX = (value: number) =>
    margin.left + ((value - xMin) / (xMax - xMin)) * innerWidth;
  const scaleY = (value: number) =>
    margin.top + innerHeight - ((value - yMin) / (yMax - yMin)) * innerHeight;

  const stepX = (xMax - xMin) / 4;
  const xTicks = Array.from({ length: 5 }, (_, index) => xMin + stepX * index);
  const yTicks = Array.from({ length: 4 }, (_, index) => yMin + ((yMax - yMin) / 3) * index);

  return (
    <figure style={{ margin: 0, minWidth: 0 }}>
      <svg
        className="chart"
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="img"
        aria-label={ariaLabel}
        preserveAspectRatio="xMidYMid meet"
      >
        <title>{ariaLabel}</title>
        {/* Griglia orizzontale */}
        {yTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line
              className="chart__grid"
              x1={margin.left}
              x2={WIDTH - margin.right}
              y1={scaleY(tick)}
              y2={scaleY(tick)}
            />
            <text x={margin.left - 8} y={scaleY(tick) + 3} textAnchor="end">
              {formatY(tick)}
            </text>
          </g>
        ))}
        {/* Asse X */}
        <line
          className="chart__axis"
          x1={margin.left}
          x2={WIDTH - margin.right}
          y1={margin.top + innerHeight}
          y2={margin.top + innerHeight}
        />
        {xTicks.map((tick, index) => (
          <g key={`x-${tick}`}>
            <line
              className="chart__tick"
              x1={scaleX(tick)}
              x2={scaleX(tick)}
              y1={margin.top + innerHeight}
              y2={margin.top + innerHeight + 4}
            />
            {(index === 0 || index === xTicks.length - 1 || index === 2) && (
              <text
                x={scaleX(tick)}
                y={margin.top + innerHeight + 16}
                textAnchor={index === 0 ? 'start' : index === xTicks.length - 1 ? 'end' : 'middle'}
              >
                {formatX(tick)}
              </text>
            )}
          </g>
        ))}
        {/* Serie */}
        {series.map((item) => {
          const path = item.points
            .map((point, index) => `${index === 0 ? 'M' : 'L'} ${scaleX(point.x)} ${scaleY(point.y)}`)
            .join(' ');
          return (
            <g key={item.key}>
              <path
                className={`chart__line${item.dashed ? ' chart__line--b' : ''}`}
                d={path}
                style={{ stroke: item.color }}
              />
              {(item.markers ?? true) &&
                item.points.map((point) => (
                  <circle
                    key={`${item.key}-${point.x}-${point.y}`}
                    className="chart__dot"
                    cx={scaleX(point.x)}
                    cy={scaleY(point.y)}
                    r={3.5}
                    style={{ fill: item.color }}
                  >
                    <title>{`${formatX(point.x)}: ${formatY(point.y)}`}</title>
                  </circle>
                ))}
            </g>
          );
        })}
        {/* Annotazione singola */}
        {annotation && (() => {
          const xPos = scaleX(annotation.x);
          const yPos = scaleY(annotation.y);
          const isNearRight = xPos > WIDTH - 180;
          return (
            <g>
              <line
                className="chart__annotation-line"
                x1={xPos}
                x2={xPos}
                y1={margin.top}
                y2={margin.top + innerHeight}
              />
              <text
                className="chart__annotation"
                x={xPos + (isNearRight ? -6 : 6)}
                y={Math.max(margin.top + 14, Math.min(margin.top + innerHeight - 6, yPos - 6))}
                textAnchor={isNearRight ? 'end' : 'start'}
              >
                {annotation.label}
              </text>
            </g>
          );
        })()}
        {/* Titoli assi */}
        <text className="chart__title" x={margin.left} y={height - 4}>
          {xLabel}
        </text>
        <text
          className="chart__title"
          x={margin.left}
          y={11}
          textAnchor="start"
        >
          {yLabel}
        </text>
      </svg>

      <div className="chart-legend">
        {series.map((item) => (
          <span key={item.key} className="chart-legend__item">
            <span
              className={`chart-legend__swatch${item.dashed ? ' chart-legend__swatch--dashed' : ''}`}
              style={{ background: item.dashed ? undefined : item.color }}
              aria-hidden="true"
            />
            {item.label}
          </span>
        ))}
      </div>

      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">{xLabel}</th>
            {series.map((item) => (
              <th key={item.key} scope="col">
                {item.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {series[0]?.points.map((point, index) => (
            <tr key={index}>
              <th scope="row">{formatX(point.x)}</th>
              {series.map((item) => (
                <td key={item.key}>{formatY(item.points[index]?.y ?? 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

// Lista a barre

export type BarItem = {
  label: string;
  value: number;
  color?: string;
  hint?: string;
};

type BarListProps = {
  items: BarItem[];
  formatValue: (value: number) => string;
  ariaLabel: string;
  emptyLabel?: string;
};

export function BarList({ items, formatValue, ariaLabel, emptyLabel = 'Nessun dato.' }: BarListProps) {
  if (items.length === 0) return <div className="chart-empty">{emptyLabel}</div>;
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="bars" role="img" aria-label={ariaLabel}>
      {items.map((item) => (
        <div className="bars__row" key={item.label} title={item.hint}>
          <span className="bars__label">{item.label}</span>
          <span className="bars__track">
            <span
              className="bars__fill"
              style={{
                width: `${Math.max(1, (item.value / max) * 100)}%`,
                background: item.color
              }}
            />
          </span>
          <span className="bars__value">{formatValue(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

// Mappa di calore

export type HeatCell = 'off' | 'on' | 'always' | 'swing';

export type HeatRow = {
  id: string;
  label: string;
  cells: HeatCell[];
};

type HeatmapProps = {
  rows: HeatRow[];
  columns: string[];
  ariaLabel: string;
};

const cellLabel = (cell: HeatCell): string => {
  if (cell === 'always') return 'sempre selezionato';
  if (cell === 'swing') return 'selezione variabile';
  if (cell === 'on') return 'selezionato';
  return 'non selezionato';
};

export function Heatmap({ rows, columns, ariaLabel }: HeatmapProps) {
  if (rows.length === 0 || columns.length === 0) {
    return <div className="chart-empty">Nessun dato da rappresentare.</div>;
  }

  return (
    <div>
      <div className="heatmap-scroll">
        <div
          className="heatmap"
          style={{ gridTemplateColumns: `minmax(150px, 190px) repeat(${columns.length}, minmax(8px, 1fr))` }}
          aria-hidden="true"
        >
          <span />
          {columns.map((column) => (
            <span className="heatmap__col" key={column}>
              {column}
            </span>
          ))}
          {rows.map((row) => (
            <RowCells key={row.id} row={row} />
          ))}
        </div>
      </div>

      <div className="heatmap__legend" aria-hidden="true">
        <span className="heatmap__legend-item">
          <span className="heatmap__legend-swatch" style={{ background: 'var(--ok)' }} />
          Sempre selezionato
        </span>
        <span className="heatmap__legend-item">
          <span className="heatmap__legend-swatch" style={{ background: 'var(--warn)' }} />
          Oscillante
        </span>
        <span className="heatmap__legend-item">
          <span className="heatmap__legend-swatch" style={{ background: 'var(--accent)' }} />
          Selezionato in alcuni punti
        </span>
        <span className="heatmap__legend-item">
          <span className="heatmap__legend-swatch" style={{ background: 'var(--surface-sunken)' }} />
          Mai selezionato
        </span>
      </div>

      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">Intervento</th>
            {columns.map((column) => (
              <th key={column} scope="col">
                Budget {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">{row.label}</th>
              {row.cells.map((cell, index) => (
                <td key={`${row.id}-${index}`}>{cellLabel(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowCells({ row }: { row: HeatRow }) {
  return (
    <>
      <span className="heatmap__row-label" title={row.label}>
        {row.label}
      </span>
      {row.cells.map((cell, index) => (
        <span
          key={`${row.id}-${index}`}
          className={`heatmap__cell${
            cell === 'off' ? '' : ` heatmap__cell--${cell}`
          }`}
        />
      ))}
    </>
  );
}
