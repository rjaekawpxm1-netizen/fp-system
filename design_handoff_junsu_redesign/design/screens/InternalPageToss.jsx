// ─── Internal Page · Toss Style ───
// junsu / AX consulting 내부 페이지 — Toss 디자인 시스템 톤

const InternalPageToss = () => {
  // colors
  const BLUE = '#3182F6';
  const BLUE_TINT = '#EAF3FF';
  const INK = '#191F28';
  const SUB = '#4E5968';
  const MUTE = '#8B95A1';
  const LINE = '#F2F4F6';
  const BG = '#F9FAFB';

  const sideNav = [
    {
      group: '사업관리',
      items: [
        { label: '프로젝트 목록', count: 12 },
        { label: '제안수주현황', count: 4 },
        { label: '계약 관리', count: 0 },
      ],
      open: false,
    },
    {
      group: '비용관리',
      items: [
        { label: '카드/현금영수증', count: 8 },
        { label: '지출결의', count: 6, active: true },
        { label: '경비 정산', count: 2 },
      ],
      open: true,
    },
    {
      group: '급여/보상관리',
      items: [],
      open: false,
    },
    {
      group: '인사/조직',
      items: [],
      open: false,
    },
  ];

  const tableRows = [
    { date: '2026-05-06', no: '20260506-001', title: '[AI컨설팅] 2026-04월분 경비 2건', amount: '482,300', dept: 'BA팀', status: '결재완료' },
    { date: '2026-05-02', no: '20260502-003', title: '[BA프로젝트] 출장경비 청구 - 부산', amount: '318,500', dept: 'BA팀', status: '결재중' },
    { date: '2026-04-28', no: '20260428-007', title: '[DA표준화] 외부 미팅 식대 / 다과', amount: '86,000', dept: 'DA팀', status: '결재완료' },
    { date: '2026-04-22', no: '20260422-012', title: '[내부] 분기 워크샵 운영비', amount: '2,140,000', dept: '경영지원', status: '반려' },
    { date: '2026-04-15', no: '20260415-004', title: '[TA구축] 클라우드 라이센스 정산', amount: '1,260,000', dept: 'TA팀', status: '결재완료' },
    { date: '2026-04-10', no: '20260410-009', title: '[AA설계] 컨설턴트 외근 교통비 정산', amount: '124,800', dept: 'AA팀', status: '결재완료' },
  ];

  const statusColor = (s) => {
    if (s === '결재완료') return { bg: '#E7F8EF', fg: '#0F8B47' };
    if (s === '결재중') return { bg: BLUE_TINT, fg: BLUE };
    return { bg: '#FFEBEB', fg: '#E53935' };
  };

  return (
    <div style={{
      width: '100%', height: '100%',
      background: BG,
      fontFamily: "'Pretendard', 'Apple SD Gothic Neo', system-ui, sans-serif",
      color: INK,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* ─── Top Header ─── */}
      <header style={{
        height: 64,
        background: '#fff',
        borderBottom: `1px solid ${LINE}`,
        display: 'flex', alignItems: 'center',
        padding: '0 24px', gap: 24,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: BLUE,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 900, fontSize: 15, letterSpacing: '-0.04em',
          }}>j</div>
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em' }}>junsu</span>
        </div>

        {/* Nav */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 16 }}>
          {[
            { l: '사업관리', active: true },
            { l: '내부행정', active: false },
            { l: '인사관리', active: false },
            { l: '리포트', active: false },
          ].map(n => (
            <button key={n.l} style={{
              height: 40, padding: '0 16px', borderRadius: 999,
              background: n.active ? BLUE_TINT : 'transparent',
              color: n.active ? BLUE : SUB,
              border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em',
            }}>{n.l}</button>
          ))}
        </nav>

        {/* Search */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            height: 40, padding: '0 16px',
            background: BG, borderRadius: 999,
            width: 260,
          }}>
            <span style={{ color: MUTE, fontSize: 14 }}>⌕</span>
            <input placeholder="무엇이든 찾아보세요"
              style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, fontSize: 13, color: SUB, fontFamily: 'inherit' }}
              readOnly />
            <span style={{ fontSize: 11, color: MUTE, padding: '2px 6px', background: '#fff', borderRadius: 4, fontWeight: 600 }}>⌘K</span>
          </div>

          <button style={iconBtn(MUTE)}>♡</button>
          <button style={iconBtn(MUTE)}>🔔</button>

          {/* User */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            paddingLeft: 12, marginLeft: 4,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: BLUE, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 800, letterSpacing: '-0.02em',
            }}>준수</div>
            <div style={{ lineHeight: 1.15 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>김준수 님</div>
              <div style={{ fontSize: 11, color: MUTE, fontWeight: 500 }}>BA팀 · 책임</div>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Body ─── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Sidebar */}
        <aside style={{
          width: 240,
          background: '#fff',
          borderRight: `1px solid ${LINE}`,
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '20px 12px 8px' }}>
            <div style={{
              padding: '0 12px 12px',
              fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: MUTE,
            }}>MENU</div>

            {sideNav.map(g => (
              <div key={g.group} style={{ marginBottom: 2 }}>
                <button style={{
                  width: '100%', height: 44, padding: '0 12px',
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  fontSize: 14, fontWeight: 700, color: INK,
                  borderRadius: 10,
                  letterSpacing: '-0.01em',
                }}>
                  <span>{g.group}</span>
                  <span style={{ fontSize: 11, color: MUTE }}>{g.open ? '▾' : '▸'}</span>
                </button>
                {g.open && (
                  <div style={{ marginTop: 2, marginBottom: 6 }}>
                    {g.items.map(it => (
                      <button key={it.label} style={{
                        width: '100%', height: 40, padding: '0 12px 0 24px',
                        border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center',
                        fontSize: 13, borderRadius: 10,
                        background: it.active ? BLUE_TINT : 'transparent',
                        color: it.active ? BLUE : SUB,
                        fontWeight: it.active ? 700 : 600,
                        letterSpacing: '-0.01em',
                      }}>
                        <span style={{ flex: 1, textAlign: 'left' }}>{it.label}</span>
                        {it.count > 0 && (
                          <span style={{
                            fontSize: 11, fontWeight: 700,
                            padding: '2px 8px', borderRadius: 999,
                            background: it.active ? '#fff' : LINE,
                            color: it.active ? BLUE : MUTE,
                          }}>{it.count}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Bottom tip card */}
          <div style={{ marginTop: 'auto', padding: 12 }}>
            <div style={{
              background: BLUE_TINT, borderRadius: 14,
              padding: 14,
            }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: BLUE, marginBottom: 4, letterSpacing: '-0.01em' }}>
                💡 도움이 필요하세요?
              </div>
              <div style={{ fontSize: 12, color: SUB, lineHeight: 1.5, marginBottom: 10, fontWeight: 500 }}>
                지출결의 작성법이 헷갈리시면 가이드를 확인해보세요.
              </div>
              <button style={{
                width: '100%', height: 34, borderRadius: 8,
                background: '#fff', color: BLUE,
                border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>가이드 보기 →</button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'auto' }}>
          {/* Tabs */}
          <div style={{
            height: 48, background: '#fff',
            borderBottom: `1px solid ${LINE}`,
            display: 'flex', alignItems: 'center', padding: '0 24px', gap: 4,
          }}>
            {[
              { l: '제안수주현황', active: false },
              { l: '지출결의', active: true, closable: true },
              { l: '카드/현금영수증', active: false, closable: true },
            ].map(t => (
              <div key={t.l} style={{
                height: 36, padding: '0 14px', borderRadius: 999,
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 13, fontWeight: 700,
                background: t.active ? BLUE_TINT : 'transparent',
                color: t.active ? BLUE : SUB,
                cursor: 'pointer',
                letterSpacing: '-0.01em',
              }}>
                {t.l}
                {t.closable && (
                  <span style={{ color: t.active ? BLUE : MUTE, fontSize: 14, opacity: 0.7 }}>×</span>
                )}
              </div>
            ))}
          </div>

          {/* Page header */}
          <div style={{ padding: '28px 32px 0' }}>
            <div style={{ fontSize: 12, color: MUTE, marginBottom: 10, fontWeight: 600 }}>
              사업관리 · 비용관리 · <span style={{ color: BLUE, fontWeight: 700 }}>지출결의</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>지출결의</h1>
                <p style={{ margin: '8px 0 0', fontSize: 14, color: SUB, fontWeight: 500, lineHeight: 1.6 }}>
                  월별 경비 청구 상신 내역을 한눈에 확인하세요.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={ghostBtn(INK, LINE)}>↓ 엑셀 다운로드</button>
                <button style={primaryBtn(BLUE)}>+ 신규 상신</button>
              </div>
            </div>
          </div>

          {/* KPI cards */}
          <div style={{ padding: '0 32px 16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { l: '이번 달 상신', v: '6건', d: '+2 지난달 대비' },
                { l: '결재 완료', v: '4건', d: '67%' },
                { l: '결재 대기', v: '1건', d: '평균 1.2일' },
                { l: '총 금액', v: '₩ 4,411,600', d: '예산의 38%' },
              ].map((k, i) => (
                <div key={i} style={{
                  background: '#fff', borderRadius: 14,
                  border: `1px solid ${LINE}`,
                  padding: '18px 20px',
                }}>
                  <div style={{ fontSize: 12, color: MUTE, fontWeight: 600, marginBottom: 6 }}>{k.l}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.025em' }}>{k.v}</div>
                  <div style={{ fontSize: 11, color: BLUE, marginTop: 4, fontWeight: 600 }}>{k.d}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Filter */}
          <div style={{ padding: '0 32px' }}>
            <div style={{
              background: '#fff', borderRadius: 14,
              border: `1px solid ${LINE}`,
              padding: '16px 18px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <Field label="상신년월" value="2026-05" type="date" />
              <Field label="처리상태" value="전체" type="select" />
              <Field label="작성팀" value="BA팀" type="select" />
              <Field label="키워드" value="" placeholder="제목 검색..." type="text" />
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button style={ghostBtn(SUB, LINE)}>초기화</button>
                <button style={{ ...primaryBtn(BLUE), paddingInline: 22 }}>⌕ 검색</button>
              </div>
            </div>
          </div>

          {/* Table card */}
          <div style={{ padding: '16px 32px 32px' }}>
            <div style={{
              background: '#fff', borderRadius: 14,
              border: `1px solid ${LINE}`,
              overflow: 'hidden',
            }}>
              {/* card header */}
              <div style={{
                padding: '18px 20px',
                borderBottom: `1px solid ${LINE}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em' }}>
                    검색결과 <span style={{ color: BLUE }}>6건</span>
                  </div>
                  <div style={{ fontSize: 11, color: MUTE, marginTop: 4, fontWeight: 500 }}>3분 전 동기화됨 · 자동 새로고침 ON</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {['전체', '결재완료', '결재중', '반려'].map((c, i) => (
                    <button key={c} style={{
                      height: 34, padding: '0 14px',
                      borderRadius: 999, fontSize: 12.5,
                      fontWeight: 700, letterSpacing: '-0.01em',
                      background: i === 0 ? BLUE_TINT : '#fff',
                      color: i === 0 ? BLUE : SUB,
                      border: i === 0 ? 'none' : `1px solid ${LINE}`,
                      cursor: 'pointer',
                    }}>{c}</button>
                  ))}
                </div>
              </div>

              {/* Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ background: BG }}>
                  <tr>
                    <Th width={48}><input type="checkbox" /></Th>
                    <Th>상신일자</Th>
                    <Th>상신번호</Th>
                    <Th align="left">상신제목</Th>
                    <Th align="right">금액</Th>
                    <Th>작성팀</Th>
                    <Th>처리상태</Th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((r, i) => {
                    const c = statusColor(r.status);
                    return (
                      <tr key={r.no} style={{ borderTop: `1px solid ${LINE}` }}>
                        <Td><input type="checkbox" /></Td>
                        <Td color={SUB}>{r.date}</Td>
                        <Td color={MUTE} mono>{r.no}</Td>
                        <Td align="left" weight={600}>{r.title}</Td>
                        <Td align="right" weight={700}>
                          <span style={{ color: MUTE, fontWeight: 500 }}>₩</span>{' '}{r.amount}
                        </Td>
                        <Td color={SUB} weight={500}>{r.dept}</Td>
                        <Td>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '4px 11px', borderRadius: 999,
                            fontSize: 11.5, fontWeight: 700,
                            background: c.bg, color: c.fg,
                          }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.fg }} />
                            {r.status}
                          </span>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* footer */}
              <div style={{
                padding: '16px 20px', borderTop: `1px solid ${LINE}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: BG,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: SUB, fontWeight: 500 }}>
                  <span>표시할 행 수</span>
                  <select style={{
                    padding: '6px 10px', borderRadius: 8,
                    border: `1px solid ${LINE}`, fontSize: 12, fontWeight: 600,
                    background: '#fff', color: INK, fontFamily: 'inherit',
                  }}><option>10</option></select>
                  <span style={{ color: MUTE }}>·</span>
                  <span>1 - 6 / 6건</span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {['‹‹', '‹', '1', '2', '3', '›', '››'].map((p, i) => (
                    <button key={i} style={{
                      width: 34, height: 34, borderRadius: 8,
                      background: p === '1' ? BLUE : '#fff',
                      color: p === '1' ? '#fff' : SUB,
                      border: p === '1' ? 'none' : `1px solid ${LINE}`,
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}>{p}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

// ─── helpers ───
const iconBtn = (color) => ({
  width: 38, height: 38, borderRadius: 10,
  background: 'transparent', border: 'none', cursor: 'pointer',
  color, fontSize: 14,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
});
const primaryBtn = (color) => ({
  height: 40, padding: '0 16px', borderRadius: 10,
  background: color, color: '#fff', border: 'none',
  fontSize: 13, fontWeight: 700, cursor: 'pointer',
  letterSpacing: '-0.01em',
});
const ghostBtn = (color, line) => ({
  height: 40, padding: '0 14px', borderRadius: 10,
  background: '#fff', color,
  border: `1px solid ${line}`,
  fontSize: 13, fontWeight: 700, cursor: 'pointer',
  letterSpacing: '-0.01em',
});

const Field = ({ label, value, placeholder, type }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span style={{ fontSize: 11, fontWeight: 700, color: '#8B95A1', letterSpacing: '-0.01em' }}>{label}</span>
    <div style={{
      height: 38, minWidth: 140, padding: '0 14px',
      border: '1px solid #F2F4F6', borderRadius: 10,
      background: '#F9FAFB', display: 'flex', alignItems: 'center', gap: 8,
      fontSize: 13, color: value ? '#191F28' : '#8B95A1', fontWeight: 600,
    }}>
      {value || placeholder}
      {(type === 'date' || type === 'select') && (
        <span style={{ marginLeft: 'auto', color: '#8B95A1' }}>▾</span>
      )}
    </div>
  </div>
);

const Th = ({ children, align = 'center', width }) => (
  <th style={{
    padding: '14px 16px', textAlign: align,
    fontSize: 12, fontWeight: 700, color: '#4E5968',
    width, letterSpacing: '-0.01em',
  }}>{children}</th>
);
const Td = ({ children, align = 'center', color, weight, mono }) => (
  <td style={{
    padding: '16px 16px', textAlign: align,
    fontSize: 13.5,
    color: color || '#191F28',
    fontWeight: weight || 500,
    fontFamily: mono ? 'SF Mono, ui-monospace, monospace' : 'inherit',
    fontVariantNumeric: align === 'right' ? 'tabular-nums' : 'normal',
    letterSpacing: '-0.01em',
  }}>{children}</td>
);

window.InternalPageToss = InternalPageToss;
