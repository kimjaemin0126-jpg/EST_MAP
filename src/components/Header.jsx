import FilterBar from './FilterBar'

export default function Header(props) {
  const { detailMode, onReturnToMap, onOpenComparison, ...filterProps } = props
  return (
    <header className={`app-header ${detailMode ? 'detail-header' : ''}`}>
      <a className="brand-block" href="/" aria-label="POST MORTEM 시작 화면">
        <span className="brand-logo-window" aria-hidden="true">
          <img src="/assets/post-mortem-logo.png" alt="" />
        </span>
        <p>서울 상권 변화 지도</p>
      </a>
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
