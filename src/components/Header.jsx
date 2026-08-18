import FilterBar from './FilterBar'

export default function Header(props) {
  return (
    <header className="app-header">
      <div className="brand-block">
        <h1>서울 상권 변화 지도</h1>
        <p>개업과 폐업의 흐름으로 보는 서울 상권</p>
      </div>
      <div className="header-actions">
        <a className="comparison-entry-link" href="/comparison">지역 비교</a>
        <FilterBar {...props} />
      </div>
    </header>
  )
}
