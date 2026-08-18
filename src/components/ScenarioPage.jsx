import { useEffect, useState } from 'react'
import { BrandLockup } from './LandingPage'
import '../styles/landing.css'

export default function ScenarioPage() {
  const [selectedStep, setSelectedStep] = useState(0)

  useEffect(() => {
    document.body.classList.add('landing-page-body')
    return () => document.body.classList.remove('landing-page-body')
  }, [])

  return (
    <div className="landing-root scenario-root">
      <header className="landing-header">
        <BrandLockup />
        <nav className="landing-nav" aria-label="주요 메뉴">
          <a href="/map">상권 지도</a>
          <a href="/comparison">지역 비교</a>
          <a className="active" href="/scenario" aria-current="page">창업 시나리오</a>
        </nav>
      </header>
      <main className="scenario-main">
        <section className="scenario-card entrance entrance-2">
          <p className="landing-eyebrow">COMING SOON · INTERACTIVE PREVIEW</p>
          <h1>창업 조건을 바꿔보는<br />시나리오 분석을 준비하고 있습니다.</h1>
          <p>
            업종, 예산, 희망 지역을 조합해 후보 지역의 변화를 비교하는 기능입니다.
            현재는 흐름을 미리 확인할 수 있습니다.
          </p>
          <div className="scenario-preview" aria-label="창업 시나리오 예상 단계">
            {['업종 선택', '예산 입력', '후보 지역 비교'].map((step, index) => (
              <button
                type="button"
                className={selectedStep === index ? 'active' : ''}
                key={step}
                onClick={() => setSelectedStep(index)}
              >
                <span>0{index + 1}</span>
                {step}
              </button>
            ))}
          </div>
          <p className="scenario-status" aria-live="polite">
            {selectedStep === 0 && '먼저 분석할 업종을 선택합니다.'}
            {selectedStep === 1 && '예산과 운영 조건을 입력합니다.'}
            {selectedStep === 2 && '조건에 맞는 후보 지역을 같은 기준으로 비교합니다.'}
          </p>
          <div className="scenario-actions">
            <a className="scenario-primary" href="/comparison">지역 비교로 먼저 살펴보기</a>
            <a className="scenario-secondary" href="/">시작 화면으로 돌아가기</a>
          </div>
        </section>
      </main>
    </div>
  )
}
