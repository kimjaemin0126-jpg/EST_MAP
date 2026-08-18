const WIDTH = 720
const HEIGHT = 300
const PLOT = { left: 66, right: 694, top: 28, bottom: 252 }
const CENTER_X = (PLOT.left + PLOT.right) / 2
const CENTER_Y = (PLOT.top + PLOT.bottom) / 2

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

function getPosition(openRate, closureRate, averages) {
  const halfWidth = (PLOT.right - PLOT.left) / 2
  const halfHeight = (PLOT.bottom - PLOT.top) / 2
  return {
    x: clamp(CENTER_X + ((openRate - averages.openRate) / Math.max(averages.openRate, 0.1)) * halfWidth * 0.72, PLOT.left + 10, PLOT.right - 10),
    y: clamp(CENTER_Y - ((closureRate - averages.closureRate) / Math.max(averages.closureRate, 0.1)) * halfHeight * 0.72, PLOT.top + 10, PLOT.bottom - 10),
  }
}

export default function MarketQuadrant({
  marketType,
  averages,
  points = [],
  selectedDongCode,
  selectedDongName,
}) {
  if (!marketType || !averages) return null
  const selected = getPosition(marketType.openRate, marketType.closureRate, averages)
  const labelOnLeft = selected.x > PLOT.right - 120

  return (
    <div className="quadrant-wrap">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="quadrant-chart" role="img" aria-label={`개업률과 폐업률 기준 ${marketType.label}`}>
        <rect x={PLOT.left} y={PLOT.top} width={CENTER_X - PLOT.left} height={CENTER_Y - PLOT.top} className="quadrant-zone zone-risk" />
        <rect x={CENTER_X} y={PLOT.top} width={PLOT.right - CENTER_X} height={CENTER_Y - PLOT.top} className="quadrant-zone zone-turnover" />
        <rect x={PLOT.left} y={CENTER_Y} width={CENTER_X - PLOT.left} height={PLOT.bottom - CENTER_Y} className="quadrant-zone zone-stable" />
        <rect x={CENTER_X} y={CENTER_Y} width={PLOT.right - CENTER_X} height={PLOT.bottom - CENTER_Y} className="quadrant-zone zone-entry" />
        <rect x={PLOT.left} y={PLOT.top} width={PLOT.right - PLOT.left} height={PLOT.bottom - PLOT.top} className="quadrant-bg" />
        <line x1={CENTER_X} x2={CENTER_X} y1={PLOT.top} y2={PLOT.bottom} className="quadrant-axis" />
        <line x1={PLOT.left} x2={PLOT.right} y1={CENTER_Y} y2={CENTER_Y} className="quadrant-axis" />

        <text x={(PLOT.left + CENTER_X) / 2} y={PLOT.top + 22} textAnchor="middle" className="quadrant-type-label">저진입·고폐업형</text>
        <text x={(CENTER_X + PLOT.right) / 2} y={PLOT.top + 22} textAnchor="middle" className="quadrant-type-label">고경쟁·고회전형</text>
        <text x={(PLOT.left + CENTER_X) / 2} y={PLOT.bottom - 14} textAnchor="middle" className="quadrant-type-label">안정 유지형</text>
        <text x={(CENTER_X + PLOT.right) / 2} y={PLOT.bottom - 14} textAnchor="middle" className="quadrant-type-label">진입활발·저폐업형</text>


        {points
          .filter((point) => String(point.code) !== String(selectedDongCode))
          .map((point) => {
            const position = getPosition(point.openRate, point.closureRate, averages)
            return (
              <circle
                key={point.code}
                cx={position.x}
                cy={position.y}
                r="4"
                className="quadrant-peer-point"
              >
                <title>{`${point.name || point.code}\n개업률 ${point.openRate.toFixed(2)}%\n폐업률 ${point.closureRate.toFixed(2)}%\n${point.label || ''}`}</title>
              </circle>
            )
          })}

        <circle cx={selected.x} cy={selected.y} r="15" className="quadrant-selected-halo" />
        <circle cx={selected.x} cy={selected.y} r="10" className="quadrant-point">
          <title>{`${selectedDongName}\n개업률 ${marketType.openRate.toFixed(2)}%\n폐업률 ${marketType.closureRate.toFixed(2)}%\n${marketType.label}`}</title>
        </circle>
        <text x={selected.x + (labelOnLeft ? -16 : 16)} y={selected.y - 13} textAnchor={labelOnLeft ? 'end' : 'start'} className="quadrant-selected-label">{selectedDongName}</text>

        <text x={CENTER_X} y={HEIGHT - 8} textAnchor="middle" className="quadrant-axis-title">낮음 ← 개업률 → 높음</text>
        <text x="17" y={CENTER_Y} textAnchor="middle" className="quadrant-axis-title" transform={`rotate(-90 17 ${CENTER_Y})`}>낮음 ← 폐업률 → 높음</text>
        <text x={CENTER_X + 8} y={PLOT.bottom + 14} className="quadrant-average-label">서울 평균 개업률 {averages.openRate.toFixed(2)}%</text>
        <text x={PLOT.left + 8} y={CENTER_Y - 8} className="quadrant-average-label">서울 평균 폐업률 {averages.closureRate.toFixed(2)}%</text>
      </svg>
    </div>
  )
}