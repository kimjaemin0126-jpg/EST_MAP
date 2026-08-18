import { useEffect, useMemo, useRef, useState } from 'react'

const DEFAULT_SIZE = { width: 720, height: 92 }
const PADDING = { top: 15, right: 20, bottom: 25, left: 50 }

function buildSegments(points) {
  return points.reduce((result, point) => {
    if (point.y == null) result.push([])
    else result[result.length - 1].push(point)
    return result
  }, [[]]).filter((segment) => segment.length > 1)
}

export default function ClosureTrendChart({
  data,
  valueKey = 'rate',
  metricLabel = '폐업률',
  secondaryValueKey,
  secondaryMetricLabel = '개업률',
}) {
  const [hovered, setHovered] = useState(null)
  const chartRef = useRef(null)
  const [size, setSize] = useState(DEFAULT_SIZE)

  useEffect(() => {
    const element = chartRef.current
    if (!element) return undefined
    const updateSize = () => {
      const { width, height } = element.getBoundingClientRect()
      if (width <= 0 || height <= 0) return
      setSize((previous) => (
        Math.abs(previous.width - width) < 1 && Math.abs(previous.height - height) < 1
          ? previous
          : { width, height }
      ))
    }
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const chart = useMemo(() => {
    const seriesConfig = [
      { key: valueKey, label: metricLabel, className: '' },
      ...(secondaryValueKey ? [{ key: secondaryValueKey, label: secondaryMetricLabel, className: 'open-rate' }] : []),
    ]
    const values = seriesConfig.flatMap((series) => data.map((item) => item[series.key])).filter(Number.isFinite)
    const maxRate = Math.max(1, ...values)
    const chartWidth = size.width - PADDING.left - PADDING.right
    const chartHeight = size.height - PADDING.top - PADDING.bottom
    const series = seriesConfig.map((config) => ({
      ...config,
      points: data.map((item, index) => ({
        ...item,
        x: PADDING.left + (chartWidth * index) / Math.max(data.length - 1, 1),
        value: item[config.key],
        y: Number.isFinite(item[config.key])
          ? PADDING.top + chartHeight - (item[config.key] / maxRate) * chartHeight
          : null,
      })),
    }))
    return { maxRate, series }
  }, [data, metricLabel, secondaryMetricLabel, secondaryValueKey, size, valueKey])

  return (
    <div className="trend-chart-wrap" ref={chartRef}>
      {chart.series.length > 1 && (
        <div className="trend-legend" aria-hidden="true">
          {chart.series.map((series) => <span key={series.key} className={series.className}><i />{series.label}</span>)}
        </div>
      )}
      {hovered && (
        <div
          className="trend-tooltip"
          style={{
            left: `${Math.min(88, Math.max(12, (hovered.x / size.width) * 100))}%`,
            top: `${(hovered.y / size.height) * 100}%`,
          }}
        >
          <strong>{hovered.label}</strong>
          <span>{hovered.metricLabel} {hovered.value.toFixed(2)}%</span>
        </div>
      )}
      <svg className="trend-chart" viewBox={`0 0 ${size.width} ${size.height}`} role="img" aria-label={`2025년 분기별 ${chart.series.map((series) => series.label).join('과 ')} 추이`}>
        {[0, 0.5, 1].map((ratio) => {
          const y = PADDING.top + (size.height - PADDING.top - PADDING.bottom) * ratio
          const value = chart.maxRate * (1 - ratio)
          return (
            <g key={ratio}>
              <line x1={PADDING.left} x2={size.width - PADDING.right} y1={y} y2={y} className="chart-grid-line" />
              <text x={PADDING.left - 7} y={y + 4} textAnchor="end" className="chart-axis-label">{value.toFixed(1)}%</text>
            </g>
          )
        })}
        {chart.series.map((series) => (
          <g key={series.key}>
            {buildSegments(series.points).map((segment) => (
              <polyline key={`${series.key}-${segment[0].quarterCode}-${segment.at(-1).quarterCode}`} points={segment.map((point) => `${point.x},${point.y}`).join(' ')} className={`chart-line ${series.className}`} />
            ))}
            {series.points.map((point) => point.y != null && (
              <circle
                key={`${series.key}-${point.quarterCode}`}
                cx={point.x}
                cy={point.y}
                r="5"
                className={`chart-point ${series.className}`}
                tabIndex="0"
                onMouseEnter={() => setHovered({ ...point, metricLabel: series.label })}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered({ ...point, metricLabel: series.label })}
                onBlur={() => setHovered(null)}
              />
            ))}
          </g>
        ))}
        {chart.series[0]?.points.map((point) => <text key={point.quarterCode} x={point.x} y={size.height - 7} textAnchor="middle" className="chart-quarter-label">{point.shortLabel}</text>)}
      </svg>
    </div>
  )
}
