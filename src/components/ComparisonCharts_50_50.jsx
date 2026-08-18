import '../styles/ComparisonChartsSplit.css'
function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum)
}

function radarPoint(index, value, total, centerX, centerY, radius) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / total
  const distance = radius * clamp(value, 0, 100) / 100
  return {
    x: centerX + Math.cos(angle) * distance,
    y: centerY + Math.sin(angle) * distance,
  }
}

function polygonPoints(values, radius, centerX, centerY) {
  return values
    .map((value, index) => radarPoint(index, value, values.length, centerX, centerY, radius))
    .map((point) => `${point.x},${point.y}`)
    .join(' ')
}

export function MarketRadarComparison({ leftName, rightName, metrics }) {
  const centerX = 280
  const centerY = 165
  const radius = 112
  const total = metrics.length
  const leftScores = metrics.map((metric) => metric.leftScore)
  const rightScores = metrics.map((metric) => metric.rightScore)

  return (
    <article className="compare-result-card compare-radar-card">
      <header className="compare-result-heading">
        <div><span>연간 통계</span><h3>상권 지표 비교</h3></div>
        <div className="compare-legend"><span className="left"><i />{leftName}</span><span className="right"><i />{rightName}</span></div>
      </header>
      <div className="compare-radar-split">
        <div className="compare-radar-canvas">
          <svg viewBox="0 0 560 340" role="img" aria-label={`${leftName}과 ${rightName} 상권 지표 비교`}>
            {[25, 50, 75, 100].map((level) => (
              <polygon key={level} className="compare-radar-grid" points={polygonPoints(Array(total).fill(level), radius, centerX, centerY)} />
            ))}
            {metrics.map((metric, index) => {
              const end = radarPoint(index, 100, total, centerX, centerY, radius)
              const label = radarPoint(index, 100, total, centerX, centerY, radius + 30)
              const anchor = label.x < centerX - 10 ? 'end' : label.x > centerX + 10 ? 'start' : 'middle'
              return <g key={metric.key}><line className="compare-radar-axis" x1={centerX} y1={centerY} x2={end.x} y2={end.y} /><text className="compare-radar-label" x={label.x} y={label.y + 4} textAnchor={anchor}>{metric.label}</text></g>
            })}
            <polygon className="compare-radar-area left" points={polygonPoints(leftScores, radius, centerX, centerY)} />
            <polygon className="compare-radar-area right" points={polygonPoints(rightScores, radius, centerX, centerY)} />
            {metrics.map((metric, index) => {
              const left = radarPoint(index, metric.leftScore, total, centerX, centerY, radius)
              const right = radarPoint(index, metric.rightScore, total, centerX, centerY, radius)
              return <g key={`${metric.key}-dots`}><circle className="compare-radar-dot left" cx={left.x} cy={left.y} r="4"><title>{`${leftName} ${metric.label}: ${metric.leftDisplay}`}</title></circle><circle className="compare-radar-dot right" cx={right.x} cy={right.y} r="4"><title>{`${rightName} ${metric.label}: ${metric.rightDisplay}`}</title></circle></g>
            })}
          </svg>
        </div>
        <div className="compare-value-table">
          <div className="head"><span>지표</span><span>{leftName}</span><span>{rightName}</span></div>
          {metrics.map((metric) => <div key={metric.key}><span>{metric.label}</span><strong>{metric.leftDisplay}</strong><strong>{metric.rightDisplay}</strong></div>)}
      </div>
      </div>
    </article>
  )
}

function locationFitScore(ai) {
  const components = ai?.market?.startup_fit_components || {}
  const weighted = [[components.revenue_capacity, .25], [components.competition_balance, .20], [components.market_momentum, .15], [components.demand_capacity, .10]]
  if (weighted.some(([value]) => !Number.isFinite(value))) return null
  const weight = weighted.reduce((sum, [, itemWeight]) => sum + itemWeight, 0)
  return weighted.reduce((sum, [value, itemWeight]) => sum + value * itemWeight, 0) / weight
}

function winner(left, right, leftName, rightName) {
  if (!Number.isFinite(left) || !Number.isFinite(right) || left === right) return '동일'
  return left > right ? `${leftName} 우세` : `${rightName} 우세`
}

export function AiMetricComparison({ leftName, rightName, leftAi, rightAi }) {
  const metrics = [
    ['창업 적합도', leftAi?.market?.startup_fit, rightAi?.market?.startup_fit],
    ['단기 안정성', Number.isFinite(leftAi?.market?.current_risk) ? 100 - leftAi.market.current_risk : null, Number.isFinite(rightAi?.market?.current_risk) ? 100 - rightAi.market.current_risk : null],
    ['입지 적합도', locationFitScore(leftAi), locationFitScore(rightAi)],
    ['사업 회복력', leftAi?.resilience?.score, rightAi?.resilience?.score],
  ]

  return (
    <article className="compare-result-card compare-ai-card">
      <header className="compare-result-heading"><div><span>AI 분석</span><h3>예측 지표 비교</h3></div></header>
      <div className="compare-ai-list">
        {metrics.map(([label, left, right], index) => (
          <div className={index === 0 ? 'featured' : ''} key={label}>
            <div className="compare-ai-title"><strong>{label}</strong><em>{winner(left, right, leftName, rightName)}</em></div>
            <div className="compare-ai-row"><span>{leftName}</span><div><i style={{ width: `${clamp(Number(left) || 0, 0, 100)}%` }} /></div><b>{Number.isFinite(left) ? `${Math.round(left)}점` : '-'}</b></div>
            <div className="compare-ai-row right"><span>{rightName}</span><div><i style={{ width: `${clamp(Number(right) || 0, 0, 100)}%` }} /></div><b>{Number.isFinite(right) ? `${Math.round(right)}점` : '-'}</b></div>
          </div>
        ))}
      </div>
      <div className="compare-market-position">
        <div><span>{leftName}</span><strong>{leftAi?.market?.market_position?.quadrant || '-'}</strong><small>위험 {leftAi?.market?.current_risk_label || '-'} · 적합도 {leftAi?.market?.startup_fit_label || '-'}</small></div>
        <div><span>{rightName}</span><strong>{rightAi?.market?.market_position?.quadrant || '-'}</strong><small>위험 {rightAi?.market?.current_risk_label || '-'} · 적합도 {rightAi?.market?.startup_fit_label || '-'}</small></div>
      </div>
    </article>
  )
}
