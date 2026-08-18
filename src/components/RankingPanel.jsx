import { useEffect, useState } from 'react'
import {
  ANALYSIS_MODES,
  MODE_STYLES,
  formatAnalysisValue,
} from '../utils/dataProcessor'

export default function RankingPanel({
  mode,
  ranking,
  distribution,
  selectedDongCode,
  onSelectDong,
  unavailable,
}) {
  const [expanded, setExpanded] = useState(false)
  const modeStyle = MODE_STYLES[mode]
  const visibleRanking = expanded ? ranking.slice(0, 10) : ranking.slice(0, 5)

  useEffect(() => setExpanded(false), [mode, ranking])

  return (
    <section className="ranking-panel" aria-label={modeStyle.rankingTitle}>
      <div className="ranking-heading">
        <h2>{modeStyle.rankingTitle.replace(' TOP 10', '')}</h2>
      </div>
      {mode === ANALYSIS_MODES.MARKET_TYPE ? (
        <div className="type-distribution">
          {modeStyle.levels.map((level) => (
            <div key={level.key}>
              <span className="distribution-swatch" style={{ backgroundColor: level.color }} />
              <span>{level.label}</span>
              <strong>{distribution?.[level.key] || 0}개 동</strong>
            </div>
          ))}
        </div>
      ) : unavailable ? (
        <p className="ranking-empty">비교 데이터 없음<br />이전 분기 데이터가 없어 변화량을 계산할 수 없습니다.</p>
      ) : ranking.length ? (
        <ol>
          {visibleRanking.map((row, index) => (
            <li key={row.code}>
              <button
                type="button"
                className={selectedDongCode === row.code ? 'selected' : ''}
                onClick={() => onSelectDong(row.code)}
              >
                <span className="ranking-number">{index + 1}</span>
                <span className="ranking-name">{row.name}</span>
                <strong>{formatAnalysisValue(row.value, mode)}</strong>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="ranking-empty">
          {mode === ANALYSIS_MODES.CLOSURE_CHANGE
            ? '전분기 대비 폐업률이 증가한 지역이 없습니다.'
            : '조건에 해당하는 지역이 없습니다.'}
        </p>
      )}
      {mode !== ANALYSIS_MODES.MARKET_TYPE && !unavailable && ranking.length > 5 && (
        <button
          type="button"
          className="ranking-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? 'TOP 5만 보기 ↑' : '전체 TOP 10 보기 →'}
        </button>
      )}
    </section>
  )
}
