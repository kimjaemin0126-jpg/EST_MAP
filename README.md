# 서울 상권 폐업 지도 (개발용)

## 실행

```bash
npm install
npm run dev
```

저장소에는 브라우저에서 사용하는 전처리 결과가 포함되어 있어 원본 CSV가 없어도 실행됩니다.

`npm run dev`는 Vite 프런트엔드만 실행하므로 `/api/*`는 제공하지 않습니다. 지도 분석의 Python API까지 함께 실행하려면 다음 명령을 사용합니다.

```bash
npm run dev:full
```

이 명령은 Vite와 로컬 Python API를 함께 실행하고 `/api/scenario`, `/api/coach`를 same-origin으로 프록시합니다. Vercel CLI를 사용하는 경우 `vercel dev`도 프런트엔드와 Functions를 함께 실행합니다.

## 인허가 폐업 데이터 교체

1. 준비된 파일을 아래 이름으로 `src/data/`에 넣거나 덮어씁니다.
   - `서울시 일반음식점 인허가 정보.csv`
   - `서울시 휴게음식점 인허가 정보.csv`
   - `서울시 미용업 인허가 정보.csv`
2. `npm run preprocess:closures`를 실행합니다. `npm run dev`와 `npm run build`도 시작 전에 같은 작업을 자동 실행합니다.
3. 생성된 `public/data/closed_restaurants_2025.json`을 확인합니다.

세 파일 중 현재 존재하는 파일만 처리합니다. 각 폐업 위치에는 `일반음식점`, `휴게음식점`, `미용업` 분류가 저장되며 지도에서 서로 다른 색으로 표시됩니다.

원본 CSV는 용량이 커서 Git에 포함하지 않습니다. 전처리 결과 JSON만 커밋합니다.

행정동 원본 경계가 변경된 경우에만 `npm run preprocess:districts`로 자치구 외곽선을 다시 생성합니다.

## 지도 레이어 구조

- `RiskLayer`: 상권 통계의 행정동별 폐업률을 색상으로 표현합니다.
- `ClosureLocationLayer`: 인허가 데이터의 폐업 좌표를 독립 레이어로 표시합니다. 자치구·행정동·근거리 클러스터는 단일 색상이며 개별 좌표만 데이터 분류별 색상을 사용합니다.
- `DistrictBoundaryLayer`: 동 내부 선을 제외한 25개 자치구 외곽선과 선택 강조선을 담당합니다.
- `MapLayerControls`: 위험도와 폐업 위치를 서로 독립적으로 표시하거나 숨깁니다.
- `useSeoulMapData`: 지도 경계와 전처리 결과 JSON의 로딩 경로 및 오류 처리를 담당합니다.

두 데이터는 같은 지도에 표시되지만 직접 결합된 지표가 아니므로 별도 레이어로 유지합니다.

## 운영 시나리오·창업 코치 API

상세 분석 상단의 `지도 분석` 버튼으로 진입하는 운영 시나리오 화면은 다음 Vercel Python Function을 사용합니다.

- `POST /api/scenario`: 행정동·업종 시장 데이터와 사용자 가정으로 손익분기 및 12개월 운영 여력을 계산합니다.
- `POST /api/coach`: 같은 입력을 다시 계산한 뒤 규칙 기반 또는 Gemini 코치 결과를 반환합니다.

두 API 모두 `dong_code`, `industry_code`와 다음 숫자 필드를 JSON으로 받습니다: `rent_manwon`, `other_fixed_manwon`, `variable_cost_rate`, `basket_won`, `operating_days`, `sales_adjustment`, `startup_budget_manwon`, `initial_investment_manwon`.

기본 코치는 외부 패키지나 API 키가 필요 없는 규칙 기반 방식입니다. Vercel에서 Gemini를 사용하려면 `GENAI_PROVIDER=gemini`와 `GEMINI_API_KEY`를 설정하고, 필요한 경우 `GEMINI_MODEL`을 지정합니다. `GEMINI_API_KEY`가 없거나 provider 값이 잘못된 경우 규칙 기반 코치로 안전하게 전환됩니다.

로컬에서 Vite 개발 서버만 실행하면 `/api/*` Function은 함께 뜨지 않습니다. 프런트와 Python Function을 함께 확인할 때는 Vercel의 로컬 개발 환경을 사용하거나 API를 별도로 실행해야 합니다.
