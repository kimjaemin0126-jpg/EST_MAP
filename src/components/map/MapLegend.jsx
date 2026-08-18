import { ANALYSIS_MODES, MODE_STYLES, formatLegendBoundary } from '../../utils/dataProcessor'

function getRangeLabel(index, thresholds, mode) {
  if (mode === ANALYSIS_MODES.MARKET_TYPE || thresholds.length < 3) return ''
  if (index === 0) return `${formatLegendBoundary(thresholds[0], mode)} 이하`
  if (index === 3) return `${formatLegendBoundary(thresholds[2], mode)} 초과`
  return `${formatLegendBoundary(thresholds[index], mode)} 이하`
}

export default function MapLegend({ mode, thresholds }) {
  const config = MODE_STYLES[mode]
  return (
    <div className="map-legend" aria-label={`${config.title} 범례`}>
      <div className="legend-heading">
        <strong>{config.title}</strong>
      </div>
      <div className="legend-scale">
        {config.levels.map((level) => <span className="legend-swatch" key={level.key} style={{ backgroundColor: level.color }} />)}
      </div>
      <div className="legend-ranges">
        {config.levels.map((level, index) => (
          <span key={level.key}><b>{level.label}</b><small>{getRangeLabel(index, thresholds, mode)}</small></span>
        ))}
      </div>
      <p>{mode === ANALYSIS_MODES.MARKET_TYPE ? '선택 조건의 서울 가중 기준' : '서울 행정동 상대 분포 기준'}</p>
    </div>
  )
}
