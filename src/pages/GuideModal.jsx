import { useState } from 'react';
import { color } from '../styles/tokens';

// ─────────────────────────────────────────────────────────
// GuideModal — FP 산정 도우미 사용 가이드 (실무자용)
// 톤: 실무자가 5분 안에 흐름을 잡는 것. FP 이론 설명은 최소화.
// ─────────────────────────────────────────────────────────

const TABS = ['시작하기', '신규 구축', '고도화 사업', 'FP 산정', '자주 겪는 문제'];

const GuideModal = ({ onClose }) => {
  const [tab, setTab] = useState('시작하기');

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 16, width: '100%', maxWidth: 760,
          maxHeight: '86vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden',
        }}
      >
        {/* 헤더 */}
        <div style={{
          padding: '20px 24px', borderBottom: `1px solid ${color.line}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: color.ink }}>사용 가이드</div>
            <div style={{ fontSize: 13, color: color.mute, marginTop: 2 }}>
              RFP 업로드부터 FP 산정까지, 5분이면 흐름이 잡힙니다.
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 999, border: 'none',
            background: color.bg, color: color.sub, fontSize: 18, cursor: 'pointer',
          }}>×</button>
        </div>

        {/* 탭 */}
        <div style={{
          display: 'flex', gap: 4, padding: '12px 24px 0',
          borderBottom: `1px solid ${color.line}`, flexWrap: 'wrap',
        }}>
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '8px 14px', border: 'none', background: 'transparent',
              borderBottom: tab === t ? `2px solid ${color.blue}` : '2px solid transparent',
              color: tab === t ? color.blue : color.sub,
              fontSize: 14, fontWeight: tab === t ? 800 : 600, cursor: 'pointer',
              marginBottom: -1,
            }}>{t}</button>
          ))}
        </div>

        {/* 본문 */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', fontSize: 14, lineHeight: 1.7, color: color.sub }}>
          {tab === '시작하기' && <Start />}
          {tab === '신규 구축' && <NewBuild />}
          {tab === '고도화 사업' && <Upgrade />}
          {tab === 'FP 산정' && <FPCalc />}
          {tab === '자주 겪는 문제' && <Troubles />}
        </div>
      </div>
    </div>
  );
};

// ── 재사용 소품 ──────────────────────────────────────────
const H = ({ children }) => (
  <div style={{ fontSize: 15, fontWeight: 800, color: color.ink, margin: '4px 0 8px' }}>{children}</div>
);
const Step = ({ n, title, children }) => (
  <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
    <div style={{
      flexShrink: 0, width: 24, height: 24, borderRadius: 999,
      background: color.blueTint, color: color.blue,
      fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{n}</div>
    <div>
      <div style={{ fontWeight: 700, color: color.ink, marginBottom: 2 }}>{title}</div>
      <div>{children}</div>
    </div>
  </div>
);
const Tip = ({ children }) => (
  <div style={{
    background: color.blueTint, borderRadius: 10, padding: '10px 14px',
    fontSize: 13, color: color.sub, margin: '10px 0',
  }}>💡 {children}</div>
);
const Warn = ({ children }) => (
  <div style={{
    background: color.warningBg, borderRadius: 10, padding: '10px 14px',
    fontSize: 13, color: color.warning, margin: '10px 0', fontWeight: 600,
  }}>⚠ {children}</div>
);

// ── 탭 내용 ──────────────────────────────────────────────
const Start = () => (
  <div>
    <H>이 도구가 하는 일</H>
    <p style={{ margin: '0 0 12px' }}>
      RFP(제안요청서)나 기능정의서를 올리면 AI가 기능목록(LV1/LV2/LV3)을 뽑고,
      거기에 기능점수(FP)를 산정해 개발비 추정까지 이어집니다.
    </p>
    <H>전체 흐름</H>
    <Step n="1" title="프로젝트 만들기">홈에서 “새 프로젝트 만들기”로 시작합니다.</Step>
    <Step n="2" title="모드 선택 (중요)">
      <b style={{ color: color.ink }}>신규 구축</b>이냐 <b style={{ color: color.ink }}>고도화 사업</b>이냐를 먼저 정합니다.
      이걸 잘못 고르면 결과가 크게 달라집니다.
    </Step>
    <Step n="3" title="파일 업로드 + 정보 입력">RFP를 올리고, 예산과 추가 설명을 입력합니다.</Step>
    <Step n="4" title="기능 생성">AI가 도메인을 뽑고 → 확인 후 → 기능목록을 만듭니다.</Step>
    <Step n="5" title="FP 산정 → 개발비">기능목록에 FP를 매기고 개발비를 추정합니다.</Step>
    <Tip>파일은 여러 개 올릴수록 정확도가 올라갑니다. RFP + 별첨 요구사항서를 같이 올리세요.</Tip>
  </div>
);

const NewBuild = () => (
  <div>
    <H>신규 구축 — 아무것도 없는 상태에서 시작</H>
    <p style={{ margin: '0 0 12px' }}>
      RFP만 보고 “이 시스템에 어떤 기능이 있어야 하는지”를 AI가 새로 설계합니다.
    </p>
    <Step n="1" title="상단에서 ‘신규 구축’ 선택" />
    <Step n="2" title="RFP 업로드">
      PDF/DOCX/XLSX/TXT를 올립니다. 표가 많은 요구사항서는 PDF나 XLSX가 인식이 잘 됩니다.
    </Step>
    <Step n="3" title="시스템 정보 입력">
      시스템명, 예산(억 단위), 그리고 <b style={{ color: color.ink }}>추가 설명</b>을 채웁니다.
      추가 설명에 “이 사업의 핵심은 OO”라고 적으면 그 기능이 우선 생성됩니다.
    </Step>
    <Step n="4" title="예산 입력">
      예산을 넣으면 적정 기능 수가 자동 계산됩니다. 생성된 기능이 이 범위와 크게 다르면 경고가 뜹니다.
    </Step>
    <Step n="5" title="기능 생성 → 도메인 확인 → 완료">
      AI가 LV1(대분류)을 먼저 제안합니다. 빠지거나 이상한 게 있으면 여기서 끄고/켜고 확인 후 진행하세요.
    </Step>
    <Tip>추가 설명 칸은 RFP가 부실할 때 특히 강력합니다. 핵심 기능을 3~5줄로 적어주면 결과가 확 좋아집니다.</Tip>
  </div>
);

const Upgrade = () => (
  <div>
    <H>고도화 사업 — 기존 시스템에 기능 추가</H>
    <p style={{ margin: '0 0 12px' }}>
      이미 돌아가는 시스템의 기능목록을 올리고, 새 RFP로 <b style={{ color: color.ink }}>추가/변경될 기능만</b> 뽑습니다.
      기존 기능은 “재사용”으로 분류돼 FP가 낮게 잡힙니다(그래야 사업비가 정확).
    </p>
    <Step n="1" title="상단에서 ‘고도화 사업’ 선택">
      이걸 먼저 켜야 합니다. 신규 모드로 두면 기존 기능이 재사용으로 인식되지 않습니다.
    </Step>
    <Step n="2" title="기존 기능목록(Excel) 업로드">
      LV1/LV2/LV3 컬럼이 있는 xlsx를 올리면 자동 인식됩니다. → 전부 ‘재사용’으로 등록됩니다.
    </Step>
    <Step n="3" title="고도화 RFP 업로드">새로 추가될 요구사항이 담긴 RFP를 올립니다.</Step>
    <Step n="4" title="기능 생성">
      AI가 새 기능을 만들면서 기존과 대조합니다:
      <div style={{ marginTop: 6 }}>
        · 같은 기능 → <b style={{ color: color.success }}>재사용</b><br />
        · 이름이 거의 같음 → <b style={{ color: color.warning }}>기능변경</b><br />
        · 완전히 새 기능 → <b style={{ color: color.blue }}>신규개발</b>
      </div>
    </Step>
    <Warn>
      순서가 중요합니다. <b>먼저 고도화 모드 ON → 기존 기능목록 → 그 다음 RFP.</b>
      기존 기능을 먼저 올렸는데 신규 모드였다면, 기능 생성 시 뜨는 “고도화로 전환할까요?” 안내에서 [확인]을 누르세요.
    </Warn>
    <Tip>기존 기능목록이 PDF밖에 없다면, 먼저 xlsx(LV1/LV2/LV3 3열)로 변환해 올리는 게 가장 정확합니다.</Tip>
  </div>
);

const FPCalc = () => (
  <div>
    <H>FP 산정 — 기능목록에 점수 매기기</H>
    <p style={{ margin: '0 0 12px' }}>
      기능목록이 완성되면 “FP 산정” 탭에서 각 기능의 유형과 점수를 매깁니다.
      AI는 <b style={{ color: color.ink }}>유형 분류만</b> 하고, 실제 FTR/DET·점수는 규칙표가 계산합니다(같은 입력이면 항상 같은 결과).
    </p>
    <Step n="1" title="FP 산정 실행">유형(EI/EO/EQ)과 데이터그룹(ILF/EIF)이 자동으로 잡힙니다.</Step>
    <Step n="2" title="검증 결과 확인">
      산정 후 경고가 뜨면 꼭 확인하세요:
      <div style={{ marginTop: 6 }}>
        · <b>복잡도 L이 80% 초과</b> → 산정이 덜 된 것일 수 있음<br />
        · <b>ILF 과다</b> → 데이터그룹이 메뉴마다 잡힘(중복)<br />
        · <b>기능 수 과다</b> → 예산 대비 너무 많음(중복/과분해 의심)<br />
        · <b>병합 후보</b> → 조회/검색/목록이 따로 잡힘(합칠 수 있음)
      </div>
    </Step>
    <Step n="3" title="개발비 확인">정통법/간이법과 보정계수를 선택하면 개발비가 계산됩니다.</Step>
    <Warn>
      FP 값 자체(기능당 평균점수 등)는 아직 캘리브레이션 전 추정치입니다.
      사내 확정 FP 사업 몇 건으로 보정하기 전에는 “참고용”으로 쓰세요.
    </Warn>
  </div>
);

const Troubles = () => (
  <div>
    <H>자주 겪는 문제</H>

    <div style={{ fontWeight: 700, color: color.ink, marginTop: 10 }}>Q. 기능이 이상하게 적게/많이 뽑혀요</div>
    <p style={{ margin: '4px 0 12px' }}>
      모드를 확인하세요. 고도화인데 신규 모드면 기존 기능이 무시되고, 신규인데 기존 목록이 남아있으면
      덮어쓰기로 꼬입니다. 상단 모드 → 파일 → 생성 순서를 지키세요.
    </p>

    <div style={{ fontWeight: 700, color: color.ink }}>Q. 추가 설명을 적었는데 반영이 안 돼요</div>
    <p style={{ margin: '4px 0 12px' }}>
      추가 설명은 기능 생성 단계에 반영됩니다. 이미 만든 기능목록에는 적용되지 않으니,
      설명을 바꿨다면 다시 “기능 생성”을 눌러야 합니다.
    </p>

    <div style={{ fontWeight: 700, color: color.ink }}>Q. 핵심 기능(예: API Gateway)이 안 나와요</div>
    <p style={{ margin: '4px 0 12px' }}>
      추가 설명 칸에 “이 사업의 핵심은 API Gateway”처럼 명시하세요.
      RFP에 묻혀 있으면 놓칠 수 있는데, 추가 설명에 적으면 우선 생성됩니다.
    </p>

    <div style={{ fontWeight: 700, color: color.ink }}>Q. PDF를 올렸는데 표가 깨져서 인식돼요</div>
    <p style={{ margin: '4px 0 12px' }}>
      스캔 PDF는 자동 OCR로 처리하지만 15페이지까지만 봅니다.
      기능목록처럼 표가 핵심인 문서는 xlsx로 올리는 게 가장 정확합니다.
    </p>

    <div style={{ fontWeight: 700, color: color.ink }}>Q. 생성 중 오류(504)가 나요</div>
    <p style={{ margin: '4px 0 12px' }}>
      RFP가 너무 크거나 기능이 많을 때 시간 초과가 날 수 있습니다.
      잠시 후 다시 시도하거나, RFP를 나눠서 올려보세요.
    </p>
  </div>
);

export default GuideModal;
