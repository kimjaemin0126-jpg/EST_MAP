import FilterBar from './FilterBar'

export default function Header(props) {
  const { detailMode, onReturnToMap, onOpenComparison, ...filterProps } = props
  return (
    <header className={`app-header ${detailMode ? 'detail-header' : ''}`}>
      <div className="brand-block">
        <h1>서울 상권 변화 지도</h1>
        <p>개업과 폐업의 흐름으로 보는 서울 상권</p>
      </div>
      {detailMode ? (
        <div className="detail-header-actions">
          <span>지도 분석</span>
          <button type="button" className="comparison-button" onClick={onOpenComparison}>비교 분석</button>
          <button type="button" className="map-button" onClick={onReturnToMap}>상권 지도 보기</button>
        </div>
      ) : (
        <div className="header-actions">
          <a className="comparison-entry-link" href="/comparison">지역 비교</a>
          <FilterBar {...filterProps} />
        </div>
      )}
    </header>
  )
}
