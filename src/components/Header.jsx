import FilterBar from './FilterBar'

export default function Header(props) {
  const {
    detailMode,
    onReturnToMap,
    ...filterProps
  } = props
  return (
    <header className={`app-header ${detailMode ? 'detail-header' : ''}`}>
      <a className="brand-block map-brand-lockup" href="/" aria-label="POST MORTEM 시작 화면">
        <span className="map-brand-logo-window" aria-hidden="true">
          <img src="/assets/post-mortem-logo.png" alt="" />
        </span>
        <span className="map-brand-subtitle">서울 상권 변화 지도</span>
      </a>
      {detailMode ? (
        <div className="detail-header-actions">
          <button type="button" onClick={onReturnToMap}>상권 지도 보기</button>
        </div>
      ) : <FilterBar {...filterProps} />}
    </header>
  )
}
