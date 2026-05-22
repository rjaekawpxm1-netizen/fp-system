# Handoff: junsu — D · Toss Style 리뉴얼 (v2)

## Overview

기존 **fp-system** (Create React App 기반, BA/AA/DA/TA 4가지 아키텍처 도우미를 제공하는 IT 컨설팅 통합 플랫폼)의 전체 UI를 **D · Toss Style** 디자인 시스템으로 리뉴얼합니다.

- **브랜드명**: CAS IT Consulting → **junsu** (도메인 표기 시 "AX consulting")
- **이전 톤**: 다크 네이비 + 인디고/바이올렛 그라디언트
- **새 톤**: 화이트 베이스 + Toss 블루 단일 액센트 + Pretendard
- **기존 기능은 100% 유지**, 비주얼 레이어만 교체

대상 코드베이스: https://github.com/rjaekawpxm1-netizen/fp-system

## About the Design Files

이 번들에 포함된 파일들은 **HTML/JSX로 만든 디자인 레퍼런스 프로토타입**입니다 — 의도된 모습/동작을 보여주는 것이 목적이며, 그대로 프로덕션에 복사해서 쓰는 코드가 아닙니다.

목표는 이 디자인 레퍼런스를 **대상 코드베이스(React 18, Create React App)의 기존 환경에서 재현**하는 것입니다. 기존 라이브러리(react-router-dom, supabase, xlsx, axios 등)와 페이지 구조는 그대로 두고, 시각 표현만 새 디자인으로 교체합니다.

## Fidelity

**High-fidelity (hifi)** — 컬러 hex, 픽셀 간격, 폰트 weight까지 명시된 픽셀-퍼펙트 모킹입니다. 정확히 재현해주세요:
- 컬러 토큰 (모든 hex 값 정확히)
- 타이포그래피 (Pretendard, weight, letter-spacing)
- 둥근 모서리 (8/10/14/16/999)
- 보더 컬러 (`#F2F4F6` 고정)
- 친근체 카피 톤 ("도와드려요", "정확도가 올라가요")

## What's New in v2 (2026-05-18)

GitHub repo의 ProjectDetail.jsx에 추가된 신규 기능이 시안에 반영되어 있습니다. 마이그레이션 시 다음 4가지를 빠뜨리지 마세요:

### 1. 고도화 모드 (`upgradeMode` state)
- XLSX 기능정의서 재업로드 시 confirm 다이얼로그로 모드 선택
- 활성 시 신규 기능을 `reuseType: '재사용'`으로 추가 (기존 기능에 누적)
- 기능목록 탭 헤더에 🔧 노란색 뱃지 노출 (`#FFF3D6` bg, `#B26A00` fg, pill)

### 2. 일괄 선택/편집 (`selectedIds: Set<id>`, `bulkLV1: string`)
- 각 기능 행에 체크박스 추가 (width 44, accent `#3182F6`, 14×14)
- 1개 이상 선택 시 블루 틴트 툴바 활성 (`#EAF3FF` bg, `1px solid #D1E3FA`, radius 12)
- 툴바 구성: 좌측 "✓ N개 선택됨" pill + "LV1 일괄 수정" 인풋 + [일괄 수정] (blue) + [🗑 일괄 삭제] (red ghost: `#fff` bg, `#E53935` fg, `1px solid #FFCDD2`) + [✕] 닫기
- 선택된 행은 배경 `#EAF3FF`

### 3. 프로젝트 복사 (사이드바 nav item)
- "📋 프로젝트 복사" 메뉴를 사이드바 워크스페이스 하단에 추가 (구분선 위)
- 클릭 시 `window.prompt`로 새 이름 입력 → `window.dispatchEvent(new CustomEvent('copyProject', {detail: copied}))` → App.js의 `handleCopyProject`로 전달

### 4. XLSX 파일 표시 개선
- 업로드 파일 리스트에서 XLSX 파일은 파일명 옆에 "기능정의서" 녹색 라벨 (`#fff` bg, `#0F8B47` text, radius 6)
- 고도화 모드로 추가된 파일은 "🔧 고도화" 노란색 라벨 (`#FFF3D6` bg, `#B26A00` text) 추가
- 메타: "X개 기능 파싱됨 · 재사용으로 추가됨"

---

## Screens / Views

모킹된 화면은 총 12개입니다. 각 화면은 `design/screens/` 폴더의 `.jsx` 파일과 1:1 대응.

### Public Pages

#### 1. 메인 페이지 (`MainPageToss.jsx`) → 대상: `src/pages/Home.jsx`
- AX consulting 거대 텍스트 (200px, weight 900) + "지금 시작하기" 버튼 + BA/AA/DA/TA 카드 4개
- 각 카드에 기능 리스트 (체크박스), 사용 가능/준비 중 상태별 색상

#### 2. 내부 페이지 (`InternalPageToss.jsx`) — 레퍼런스
- 사이드바 + 탭 + 검색 + KPI 카드 4개 + 결과 테이블 레이아웃 가이드

### BA 도우미 플로우

#### 3. BA · 프로젝트 목록 (`ProjectListToss.jsx`) → `src/pages/ProjectList.jsx`
- 히어로 카드 (진행률 통계 4개) + 필터 칩 + 프로젝트 카드 리스트
- 진행률 색상: <30% `#E53935`, <70% `#F5A623`, 그 외 `#0F8B47`
- 하단 도움말 카드 (FP 단가 안내)

#### 4. BA · 프로젝트 설정 (`ProjectDetailToss.jsx`) → `src/pages/ProjectDetail.jsx` (setup 탭)
- 사이드바: 현재 프로젝트 카드 + 워크스페이스 메뉴 (+ ⭐ "프로젝트 복사" v2)
- 파일 업로드 카드 (⭐ "기능정의서"/"🔧 고도화" 라벨 v2) + 시스템 정보 카드
- 큰 CTA 배너 (blue 그라디언트 + 흰색 필 버튼)

#### 5. BA · 기능목록 (`BAFunctions.jsx`) → `src/pages/ProjectDetail.jsx` (functions 탭)
- LV1 그룹 카드 + LV2/LV3/기능정의/⭐ 재사용/액션 테이블 (v2)
- ⭐ 페이지 제목 옆 "🔧 고도화 모드" 뱃지 (v2)
- ⭐ 체크박스 컬럼 + 일괄 편집 툴바 (v2)
- 통합 검색바 + LV1 필터 셀렉트

#### 6. BA · FP 산정표 (`BAFPTable.jsx`) → `src/pages/ProjectDetail.jsx` (fp 탭)
- 사이드바: FP 요약 카드 (`#EAF3FF`) + 예상 개발비 카드 (`#FFF3D6`) + FP 유형 분포 바
- 12컬럼 테이블 (#/LV1/LV2/LV3/FP유형/복잡도/FTR/DET/가중치/재사용/FP점수/비고)
- 정통법/간이법 토글, 검증 배너

#### 7. BA · 개발비 산출 (`BACost.jsx`)
- 좌측: 산정방법/단가/이윤율/직접경비 + 보정계수 4개 (옵션 칩) + 예산역산 토글
- 우측: 다크 그라디언트 결과 카드 (8.26억원, fontSize 44) + breakdown

### DA 도우미 플로우

#### 8. DA · 메인 (`DAMain.jsx`) → `src/pages/DAMain.jsx`
- 히어로 + 워크플로우 6단계 카드 + 6대 품질 영역

#### 9. DA · DB 연결 (`DAConnect.jsx`) → `src/pages/DAConnect.jsx`
- 진행 인디케이터 (4단계) + DB 종류 선택 카드 + 연결 폼 + 발견된 테이블 미리보기

#### 10. DA · AI 표준화 (`DAStandard.jsx`) → `src/pages/DAStandard.jsx`
- 입력 패널 + AI 종합 평가 카드 (보라 톤) + 표준화 결과 카드 리스트 (신뢰도 색상)

#### 11. DA · 진단 결과 (`DAResult.jsx`) → `src/pages/DAResult.jsx`
- 종합 점수 카드 (다크 그라디언트, 88.2/100) + 6영역 점수 그리드 + 이슈 테이블

### Design System

#### 12. Design Tokens (`DesignTokens.jsx`) → `src/styles/tokens.js`
- 전체 토큰 시각화 레퍼런스

---

## Interactions & Behavior

기존 fp-system의 모든 라우팅, 상태 관리, API 호출, 파일 업로드, FP 계산 로직은 **그대로 유지**합니다. 디자인만 교체.

- 네비게이션: `react-router-dom` 그대로
- 데이터: `@supabase/supabase-js` 그대로
- 파일 처리: `xlsx`, `mammoth`, `pdfjs-dist` 그대로
- 상태: 기존 `useState`/`useCallback` 패턴 그대로

**호버 효과**: Toss 식 미세 darken (brightness(0.95)) 또는 보더 색상 변경 정도로 충분

**상태별 스타일**:
- 사용 가능: 정상 컬러
- 준비 중: 카드 약간 회색화, 라벨 `#D1D6DB`, 버튼 disabled
- 활성 탭/필터: `#EAF3FF` bg + `#3182F6` fg
- 선택된 행 (일괄 편집): `#EAF3FF` bg

---

## Design Tokens

`tokens.js` 파일에 모든 값이 정의되어 있습니다.

### Colors
| 토큰 | Hex | 용도 |
|---|---|---|
| `color.blue` | `#3182F6` | Primary 액센트 |
| `color.blueTint` | `#EAF3FF` | Primary 배경 |
| `color.ink` | `#191F28` | 헤드라인 / 본문 |
| `color.sub` | `#4E5968` | 보조 텍스트 |
| `color.mute` | `#8B95A1` | 캡션 |
| `color.line` | `#F2F4F6` | 보더 |
| `color.bg` | `#F9FAFB` | 회색 배경 |
| `color.surface` | `#FFFFFF` | 카드 |
| `color.success`/`successBg` | `#0F8B47` / `#E7F8EF` | 완료, 재사용 (XLSX) |
| `color.warning`/`warningBg` | `#B26A00` / `#FFF3D6` | 고도화 모드, 재사용(LV3) |
| `color.danger`/`dangerBg` | `#E53935` / `#FFEBEB` | 위험, 일괄 삭제 |

### Radius
`sm: 8` / `md: 10` / `lg: 14` / `xl: 16` / `pill: 999`

### Typography
- Pretendard CDN: `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css`
- Display 48/800/-0.035em · H1 28/800/-0.03em · H2 22/800/-0.025em · Body 14/500/-0.01em

### Global CSS
```css
h1, h2, h3 { text-wrap: balance; word-break: keep-all; }
p { text-wrap: pretty; word-break: keep-all; }
```

---

## Color Migration Map

기존 (다크 네온) → 새 (D · Toss):
- `#0f1923`, `#1a2535`, `#131c27` (배경/카드) → `#FFFFFF` + `1px solid #F2F4F6`
- `#1e3a8a`, `#1d4ed8` (헤더/주요 액션) → `#FFFFFF` (헤더), `#3182F6` (액션)
- `#3b6cf8`, `#2563eb` (블루) → `#3182F6`
- `#fff` (텍스트) → `#191F28`
- `#64748b` (보조) → `#4E5968`
- `#94a3b8`, `#cbd5e1` (캡션) → `#8B95A1`
- `#e5e7eb` (보더) → `#F2F4F6`
- `#7c3aed` (보라) → `#7C3AED` (AA 카드만 유지)
- `#059669`, `#10b981` (녹색) → `#0F8B47`
- emerald 그라디언트 → `#3182F6` 또는 `linear-gradient(135deg, #3182F6 0%, #1F6FE5 100%)`

---

## Migration Strategy

1. **0단계 — 토큰 설치**:
   - `tokens.js`를 `src/styles/tokens.js`로 복사
   - `public/index.html`에 Pretendard CDN 추가
   - 전역 CSS에 줄바꿈 룰 추가

2. **1단계 — Home.jsx**: 가장 영향 적고 ROI 큼. `MainPageToss.jsx` 참고.

3. **2단계 — ProjectList.jsx**: `ProjectListToss.jsx` 참고. 기존 `calcProgress`, `handleCreate`, `handleCopy`, `handleDeleteProject` 로직 유지.

4. **3단계 — ProjectDetail.jsx** (가장 큰 작업, 84KB): 탭 단위로 마이그레이션.
   - setup 탭 → `ProjectDetailToss.jsx` (⭐ XLSX 라벨링 + 프로젝트 복사 메뉴 포함)
   - functions 탭 → `BAFunctions.jsx` (⭐ 고도화 뱃지 + 일괄 편집 툴바 + 체크박스 + 재사용 컬럼 포함)
   - fp 탭 → `BAFPTable.jsx`
   - 개발비 패널 → `BACost.jsx`

5. **4단계 — DA 페이지들**: `DAMain.jsx`, `DAConnect.jsx`, `DAStandard.jsx`, `DAResult.jsx`

6. **5단계 — 정리**: 인라인 스타일을 토큰의 `button.primary`, `button.ghost`, `button.chip`, `card.default` 등으로 정리.

---

## Voice & Tone

친근체로 통일:
- ✅ "...해요" (안내/도움말)
- ✅ "RFP나 요구사항 문서를 올려주시면 AI가 기능목록을 자동으로 만들어드려요."
- ✅ "여러 개 올릴수록 정확도가 올라가요"
- ✅ "보통 1~3분 정도 걸려요"
- ✅ "3개 선택됨 · 선택 항목 일괄 편집"
- ❌ "파일 업로드 후 기능 생성 버튼을 클릭하세요"

---

## Files

- **`design/index.html`** — 메인 캔버스 (모든 시안 한눈에)
- **`design/screens/`** — 화면별 JSX 컴포넌트 12개
- **`design/design-canvas.jsx`** — 디자인 캔버스 라이브러리 (시안 보기 전용)
- **`tokens.js`** — 디자인 토큰 (그대로 `src/styles/tokens.js`로 복사)

## How to Run Locally

```bash
cd design/
python3 -m http.server 8080
# http://localhost:8080
```

---

**권장 순서**: 토큰 설치 → Home.jsx (1h) → ProjectList.jsx (1h) → DA 페이지 (각 30~60분) → ProjectDetail.jsx 탭별 (총 3~4h, 신규 기능 4개 포함) → 마무리. 단계마다 배포/확인 후 진행 권장.
