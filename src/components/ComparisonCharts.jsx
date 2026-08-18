const LEFT_COLOR = '#b38618'
const RIGHT_COLOR = '#237a5d'

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
  const scaleTicks = [0, 50, 100]
  const leftScores = metrics.map((metric) => metric.leftScore)
  const rightScores = metrics.map((metric) => metric.rightScore)

  return (
    <article className="visual-panel radar-panel">
      <header className="visual-panel-heading">
        <div>
          <span>EST_MAP 통계</span>
          <h3>연간 상권 지표</h3>
        </div>
        <div className="chart-legend" aria-label="지역 색상 범례">
          <span className="left"><i />{leftName}</span>
          <span className="right"><i />{rightName}</span>
        </div>
      </header>

      <div className="radar-canvas">
        <svg viewBox="0 0 560 340" role="img" aria-label={`${leftName}과 ${rightName}의 EST_MAP 연간 지표 레이더 차트. 축 값은 0에서 100까지의 상대 점수이며 높을수록 양호합니다.`}>
          {[25, 50, 75, 100].map((level) => (
            <polygon
              key={level}
              className={`radar-grid${scaleTicks.includes(level) ? ' major' : ''}`}
              points={polygonPoints(Array(total).fill(level), radius, centerX, centerY)}
            />
          ))}
          <g className="radar-scale" aria-hidden="true">
            {scaleTicks.map((level) => {
              const tick = radarPoint(0, level, total, centerX, centerY, radius)
              return (
                <g key={level}>
                  {level > 0 && <line className="radar-scale-tick" x1={centerX - 4} y1={tick.y} x2={centerX + 4} y2={tick.y} />}
                  <text x={centerX + 9} y={tick.y + 4}>{level}</text>
                </g>
              )
            })}
          </g>
          {metrics.map((metric, index) => {
            const end = radarPoint(index, 100, total, centerX, centerY, radius)
            const label = radarPoint(index, 100, total, centerX, centerY, radius + 28)
            const anchor = label.x < centerX - 10 ? 'end' : label.x > centerX + 10 ? 'start' : 'middle'
            return (
              <g key={metric.key}>
                <line className="radar-axis" x1={centerX} y1={centerY} x2={end.x} y2={end.y} />
                <text className="radar-label" x={label.x} y={label.y + 4} textAnchor={anchor}>
                  {metric.label}
                </text>
              </g>
            )
          })}
          <polygon
            className="radar-area left"
            points={polygonPoints(leftScores, radius, centerX, centerY)}
          />
          <polygon
            className="radar-area right"
            points={polygonPoints(rightScores, radius, centerX, centerY)}
          />
          {metrics.map((metric, index) => {
            const left = radarPoint(index, metric.leftScore, total, centerX, centerY, radius)
            const right = radarPoint(index, metric.rightScore, total, centerX, centerY, radius)
            return (
              <g key={`${metric.key}-points`}>
                <circle className="radar-dot left" cx={left.x} cy={left.y} r="4">
                  <title>{`${leftName} ${metric.label}: ${metric.leftDisplay}`}</title>
                </circle>
                <circle className="radar-dot right" cx={right.x} cy={right.y} r="4">
                  <title>{`${rightName} ${metric.label}: ${metric.rightDisplay}`}</title>
                </circle>
              </g>
            )
          })}
        </svg>
      </div>

      <div className="radar-value-table">
        <div className="radar-value-head"><span>지표</span><span>{leftName}</span><span>{rightName}</span></div>
        {metrics.map((metric) => (
          <div key={metric.key}>
            <span>{metric.label}</span>
            <strong>{metric.leftDisplay}</strong>
            <strong>{metric.rightDisplay}</strong>
          </div>
        ))}
      </div>
      <p className="chart-method">레이더는 서로 다른 단위를 0~100 상대 점수로 맞춘 비교 차트입니다. 바깥쪽에 가까울수록 같은 업종의 서울 행정동 중 조건이 더 양호합니다.</p>
    </article>
  )
}

function metricWinner(metric, leftName, rightName) {
  if (!Number.isFinite(metric.left) || !Number.isFinite(metric.right) || metric.left === metric.right) {
    return { label: '동일', side: 'equal' }
  }
  const leftWins = metric.lowerIsBetter
    ? metric.left < metric.right
    : metric.left > metric.right
  return {
    label: `${leftWins ? leftName : rightName} 우세`,
    side: leftWins ? 'left' : 'right',
  }
}

function barWidth(value, maximum) {
  if (!Number.isFinite(value) || !maximum) return 0
  return clamp(value / maximum * 100, 0, 100)
}

export function AiMetricComparison({ leftName, rightName, leftAi, rightAi }) {
  const forecastMax = Math.max(
    20,
    Math.ceil(Math.max(
      leftAi.market.ai_next_close_rate,
      rightAi.market.ai_next_close_rate,
    ) / 5) * 5,
  )
  const metrics = [
    {
      key: 'stability',
      label: '단기 안정성',
      left: 100 - leftAi.market.current_risk,
      right: 100 - rightAi.market.current_risk,
      maximum: 100,
      lowerIsBetter: false,
      format: (value) => `${Math.round(value)}점 / 100점`,
    },
    {
      key: 'forecast',
      label: '예측 폐업률',
      left: leftAi.market.ai_next_close_rate,
      right: rightAi.market.ai_next_close_rate,
      maximum: forecastMax,
      lowerIsBetter: true,
      format: (value) => `${value.toFixed(1)}%`,
    },
    {
      key: 'fit',
      label: '입지 적합도',
      left: leftAi.market.startup_fit,
      right: rightAi.market.startup_fit,
      maximum: 100,
      lowerIsBetter: false,
      format: (value) => `${Math.round(value)}점 / 100점`,
    },
    {
      key: 'resilience',
      label: '사업 회복력',
      left: leftAi.resilience.score,
      right: rightAi.resilience.score,
      maximum: 100,
      lowerIsBetter: false,
      format: (value) => `${Math.round(value)}점 / 100점`,
    },
  ]

  return (
    <article className="visual-panel ai-panel">
      <header className="visual-panel-heading">
        <div>
          <span>OpenSafe AI</span>
          <h3>AI 예측 지표</h3>
        </div>
        <div className="chart-legend" aria-label="지역 색상 범례">
          <span className="left"><i />{leftName}</span>
          <span className="right"><i />{rightName}</span>
        </div>
      </header>

      <div className="ai-metric-chart">
        {metrics.map((metric) => {
          const winner = metricWinner(metric, leftName, rightName)
          return (
            <div className="ai-metric-row" key={metric.key}>
              <div className="ai-metric-title">
                <strong>{metric.label}</strong>
                <span className={`metric-winner ${winner.side}`}>{winner.label}</span>
              </div>
              <div className="ai-series left">
                <span>{leftName}</span>
                <div className="ai-bar-track"><i style={{ width: `${barWidth(metric.left, metric.maximum)}%` }} /></div>
                <strong>{metric.format(metric.left, 'left')}</strong>
              </div>
              <div className="ai-series right">
                <span>{rightName}</span>
                <div className="ai-bar-track"><i style={{ width: `${barWidth(metric.right, metric.maximum)}%` }} /></div>
                <strong>{metric.format(metric.right, 'right')}</strong>
              </div>
            </div>
          )
        })}
      </div>

      <div className="ai-market-summary">
        <div>
          <span>{leftName}</span>
          <strong>{leftAi.market.market_position.quadrant}</strong>
          <small>위험 {leftAi.market.current_risk_label} · 적합도 {leftAi.market.startup_fit_label}</small>
        </div>
        <div>
          <span>{rightName}</span>
          <strong>{rightAi.market.market_position.quadrant}</strong>
          <small>위험 {rightAi.market.current_risk_label} · 적합도 {rightAi.market.startup_fit_label}</small>
        </div>
      </div>
      <p className="chart-method">단기 안정성·입지 적합도·사업 회복력은 높을수록 유리합니다. 예측 폐업률은 실제 %이며 낮을수록 유리합니다.</p>
    </article>
  )
}
