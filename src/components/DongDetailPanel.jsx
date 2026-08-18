import {
  MARKET_TYPE_DESCRIPTIONS,
  MIN_STORE_COUNT,
  getDistrictName,
  getDongDisplayIndex,
  getDongStats,
  getMarketTypeData,
  quarterLabelToCode,
} from '../utils/dataProcessor'
import { formatNumber } from '../utils/formatters'

function getFlowSummary(opened, closed) {
  if (!Number.isFinite(opened) || !Number.isFinite(closed)) return ['선택한 조건의 개폐업 흐름을 확인할 데이터가 부족합니다.']
  if (opened > closed) return ['폐업보다 개업이 많은 지역입니다.', '점포 수가 순증가하고 있습니다.']
  if (opened < closed) return ['개업보다 폐업이 많은 지역입니다.', '점포 수가 순감소하고 있습니다.']
  return ['개업과 폐업 규모가 비슷한 지역입니다.', '점포 수에는 큰 변화가 없습니다.']
}

export default function DongDetailPanel({
  dongCode,
  quarter,
  industry,
  processed,
  onOpenDetail,
  canOpenDetail,
}) {
  if (!dongCode) {
    return (
      <aside className="detail-panel empty">
        <div className="empty-state-icon" aria-hidden="true">+</div>
        <h2>지역을 선택해주세요</h2>
        <p>지도 또는 지역 순위에서 행정동을 선택하면<br />상권 변화와 참고 데이터를 확인할 수 있습니다.</p>
      </aside>
    )
  }

  const quarterCode = quarterLabelToCode(quarter)
  const info = processed?.[dongCode]
  const stats = getDongStats(info, quarterCode, industry)
  const marketData = getMarketTypeData(processed, quarterCode, industry)
  const marketType = marketData.points.find((point) => point.code === dongCode) || null
  const sampleInsufficient = Number.isFinite(stats?.['점포_수']) && stats['점포_수'] < MIN_STORE_COUNT
  const opened = stats?.['개업_점포_수']
  const closed = stats?.['폐업_점포_수']
  const netOpenClose = Number.isFinite(opened) && Number.isFinite(closed) ? opened - closed : null
  const flowSummary = getFlowSummary(opened, closed)
  const flowLabel = netOpenClose > 0 ? '점포 증가' : netOpenClose < 0 ? '점포 감소' : '변동 없음'
  const flowIndicator = netOpenClose > 0 ? '↑' : netOpenClose < 0 ? '↓' : '–'
  const quarterLabel = `${quarterCode.slice(0, 4)}년 ${quarterCode.slice(4)}분기`
  const marketDescription = marketType ? MARKET_TYPE_DESCRIPTIONS[marketType.key] : null

  return (
    <aside className="detail-panel region-summary-panel">
      <div className="detail-scroll summary-scroll">
        <div className="dong-heading detailed">
          <div><div className="region-eyebrow">지역 분석 <span>/ {getDongDisplayIndex(processed, dongCode)}</span></div><h2>{info?.name || '행정동 정보 없음'}</h2><p>{getDistrictName(dongCode)} · {quarterLabel} · {industry}</p></div>
          {sampleInsufficient && <div className="detail-badges"><span className="sample-badge">표본 부족</span></div>}
        </div>

        <section className="opening-closing-summary" aria-labelledby="opening-closing-title">
          <h3 id="opening-closing-title">개폐업 현황</h3>
          {stats ? (
            <div className="summary-metrics">
              <div><span>개업</span><strong>{formatNumber(opened, '개') || '데이터 없음'}</strong></div>
              <div><span>폐업</span><strong>{formatNumber(closed, '개') || '데이터 없음'}</strong></div>
              <div className="net-metric"><span>순증감</span><strong className={netOpenClose < 0 ? 'negative' : netOpenClose > 0 ? 'positive' : ''}>{Number.isFinite(netOpenClose) ? `${netOpenClose > 0 ? '+' : ''}${formatNumber(netOpenClose, '개')}` : '데이터 없음'}</strong><small className={netOpenClose < 0 ? 'negative' : netOpenClose > 0 ? 'positive' : ''}>{Number.isFinite(netOpenClose) ? `${flowIndicator} ${flowLabel}` : '판단 불가'}</small></div>
            </div>
          ) : <p className="section-empty">선택한 조건의 점포 데이터가 없습니다.</p>}
        </section>

        <section className="flow-summary"><h3>현재 흐름</h3><p>{flowSummary.map((line) => <span key={line}>{line}</span>)}</p></section>
        <section className="market-type-compact"><span>시장 유형</span><strong>{sampleInsufficient ? '표본 부족' : marketType?.label || '분류 데이터 없음'}</strong></section>
        {marketDescription && <p className="summary-market-description">{marketDescription}</p>}
        <button type="button" className="detail-analysis-button" onClick={onOpenDetail} disabled={!canOpenDetail} title={canOpenDetail ? undefined : '전체 업종이 아닌 업종을 선택해주세요.'}>상세 분석 보기 <span aria-hidden="true">→</span></button>
        {!canOpenDetail && <p className="detail-analysis-help">AI 상세 분석은 상단에서 개별 업종을 선택한 뒤 이용할 수 있습니다.</p>}
      </div>
    </aside>
  )
}
