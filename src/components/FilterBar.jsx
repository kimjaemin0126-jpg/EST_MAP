import { ANALYSIS_MODE_OPTIONS } from '../utils/dataProcessor'

const QUARTERS = [
  { value: '20251', label: '2025년 1분기' },
  { value: '20252', label: '2025년 2분기' },
  { value: '20253', label: '2025년 3분기' },
  { value: '20254', label: '2025년 4분기' },
]

export default function FilterBar({
  selectedQuarter,
  onQuarterChange,
  selectedIndustry,
  onIndustryChange,
  industries,
  analysisMode,
  onAnalysisModeChange,
}) {
  return (
    <div className="filter-bar" aria-label="데이터 필터">
      <label className="filter-field">
        <span className="sr-only">기준 분기</span>
        <select value={selectedQuarter} onChange={(event) => onQuarterChange(event.target.value)}>
          {QUARTERS.map((quarter) => (
            <option key={quarter.value} value={quarter.value}>{quarter.label}</option>
          ))}
        </select>
      </label>
      <label className="filter-field industry-filter">
        <span className="sr-only">업종</span>
        <select value={selectedIndustry} onChange={(event) => onIndustryChange(event.target.value)}>
          {industries.map((industry) => <option key={industry}>{industry}</option>)}
        </select>
      </label>
      <div className="analysis-mode-field">
        <span className="sr-only">분석 기준</span>
        <div className="segmented-control" role="tablist" aria-label="지도 분석 기준">
          {ANALYSIS_MODE_OPTIONS.map((mode) => (
            <button
              key={mode.value}
              type="button"
              role="tab"
              aria-selected={analysisMode === mode.value}
              className={analysisMode === mode.value ? 'active' : ''}
              onClick={() => onAnalysisModeChange(mode.value)}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
