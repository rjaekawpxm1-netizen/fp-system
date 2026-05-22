// ─── BA Project Detail · Toss Style ───
// Setup tab: 파일 업로드 + 시스템 정보 + 기능 생성

const ProjectDetailToss = () => {
  const BLUE = '#3182F6';
  const BLUE_TINT = '#EAF3FF';
  const INK = '#191F28';
  const SUB = '#4E5968';
  const MUTE = '#8B95A1';
  const LINE = '#F2F4F6';
  const BG = '#F9FAFB';

  const uploadedFiles = [
    { name: 'RFP_신용평가_v3.pdf', type: 'pdf', size: 124 },
    { name: '요구사항_정리본.docx', type: 'docx', size: 38 },
    { name: '기능정의서_초안.xlsx', type: 'xlsx', size: 86, isXlsx: true, functionCount: 124 },
    { name: '기존시스템_기능목록.xlsx', type: 'xlsx', size: 142, isXlsx: true, functionCount: 218, upgrade: true },
  ];

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
        height: 64, background: '#fff',
        borderBottom: `1px solid ${LINE}`,
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10, background: BLUE,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 900, fontSize: 15, letterSpacing: '-0.04em',
          }}>j</div>
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em' }}>junsu</span>
        </div>

        <div style={{ marginLeft: 16, fontSize: 13, color: SUB, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
          <span style={{ color: MUTE }}>BA 도우미</span>
          <span style={{ color: MUTE }}>›</span>
          <span>신용평가 시스템 재구축</span>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button style={{
            height: 40, padding: '0 16px', borderRadius: 999,
            background: BG, color: SUB, border: 'none',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>← 목록으로</button>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', background: BLUE, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 800,
          }}>준수</div>
        </div>
      </header>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* ─── Sidebar ─── */}
        <aside style={{
          width: 260,
          background: '#fff',
          borderRight: `1px solid ${LINE}`,
          display: 'flex', flexDirection: 'column',
          padding: '20px 16px',
          flexShrink: 0,
        }}>
          {/* Project card */}
          <div style={{
            padding: '14px 16px', borderRadius: 12,
            background: BLUE_TINT,
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: BLUE, letterSpacing: '0.08em', marginBottom: 6 }}>현재 프로젝트</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: INK, letterSpacing: '-0.02em', marginBottom: 4 }}>
              신용평가 시스템 재구축
            </div>
            <div style={{ fontSize: 11, color: SUB, fontWeight: 600 }}>신용평가 v2 · 2026.04.12 생성</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <div style={{ flex: 1, height: 5, background: '#fff', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: '64%', height: '100%', background: BLUE, borderRadius: 999 }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, color: BLUE, letterSpacing: '-0.01em' }}>64%</span>
            </div>
          </div>

          {/* Nav */}
          <div style={{ fontSize: 10, fontWeight: 800, color: MUTE, letterSpacing: '0.08em', padding: '4px 12px', marginBottom: 6 }}>워크스페이스</div>
          {[
            { l: '프로젝트 설정', count: null, icon: '⚙', active: true },
            { l: '기능목록', count: 218, icon: '⊞', active: false },
            { l: 'FP 산정표', count: 218, icon: '⌧', active: false },
            { l: '화면목록', count: 56, icon: '▦', active: false },
            { l: '요구사항', count: 98, icon: '✓', active: false },
            { l: 'WBS', count: null, icon: '⊟', active: false },
            { l: '프로젝트 복사', count: null, icon: '⎘', active: false, divider: true },
          ].map(n => (
            <React.Fragment key={n.l}>
              {n.divider && <div style={{ height: 1, background: LINE, margin: '8px 4px' }} />}
              <button style={{
                width: '100%', height: 42, padding: '0 12px',
                border: 'none', cursor: 'pointer', borderRadius: 10,
                display: 'flex', alignItems: 'center', gap: 10,
                background: n.active ? BLUE_TINT : 'transparent',
                color: n.active ? BLUE : SUB,
                fontSize: 13.5, fontWeight: n.active ? 800 : 600,
                letterSpacing: '-0.01em', marginBottom: 2,
              }}>
                <span style={{ fontSize: 14, opacity: 0.8 }}>{n.icon}</span>
                <span style={{ flex: 1, textAlign: 'left' }}>{n.l}</span>
                {n.count !== null && (
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 999,
                    background: n.active ? '#fff' : LINE,
                    color: n.active ? BLUE : MUTE,
                  }}>{n.count}</span>
                )}
              </button>
            </React.Fragment>
          ))}

          {/* Spacer + cost button */}
          <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: `1px solid ${LINE}` }}>
            <button style={{
              width: '100%', height: 44, borderRadius: 10,
              background: INK, color: '#fff', border: 'none',
              fontSize: 13, fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              letterSpacing: '-0.01em',
            }}>
              <span>₩</span> 개발비 산출
            </button>
          </div>
        </aside>

        {/* ─── Main ─── */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'auto' }}>
          {/* Tabs */}
          <div style={{
            height: 48, background: '#fff',
            borderBottom: `1px solid ${LINE}`,
            display: 'flex', alignItems: 'center', padding: '0 24px', gap: 4,
          }}>
            {[
              { l: '프로젝트 설정', active: true },
              { l: '기능목록 (218)', active: false },
              { l: 'FP 산정표 (218)', active: false },
            ].map(t => (
              <div key={t.l} style={{
                height: 36, padding: '0 16px', borderRadius: 999,
                display: 'flex', alignItems: 'center',
                fontSize: 13, fontWeight: 800,
                background: t.active ? BLUE_TINT : 'transparent',
                color: t.active ? BLUE : SUB,
                cursor: 'pointer', letterSpacing: '-0.01em',
              }}>{t.l}</div>
            ))}
          </div>

          {/* Page header */}
          <div style={{ padding: '28px 32px 0' }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em' }}>프로젝트 설정</h1>
            <p style={{ margin: '8px 0 24px', fontSize: 14, color: SUB, fontWeight: 500, lineHeight: 1.6, maxWidth: 560 }}>
              RFP나 요구사항 문서를 올려주시면<br />
              AI가 기능목록을 자동으로 만들어드려요.
            </p>
          </div>

          <div style={{ padding: '0 32px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* ─── File upload card ─── */}
            <section style={card(LINE)}>
              <div style={cardHeader(LINE)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={iconBox(BLUE_TINT, BLUE)}>📁</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.01em' }}>파일 업로드</div>
                    <div style={{ fontSize: 11.5, color: MUTE, marginTop: 2, fontWeight: 500 }}>여러 개 올릴수록 정확도가 올라가요</div>
                  </div>
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 800,
                  padding: '4px 10px', borderRadius: 999,
                  background: '#E7F8EF', color: '#0F8B47',
                }}>{uploadedFiles.length}개 파일</span>
              </div>

              <div style={{ padding: '16px 20px' }}>
                {/* file list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                  {uploadedFiles.map(f => (
                    <div key={f.name} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px',
                      background: f.isXlsx ? '#E7F8EF' : BLUE_TINT,
                      borderRadius: 12,
                      border: `1px solid ${f.isXlsx ? '#D1F2DD' : '#D1E3FA'}`,
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 8,
                        background: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18,
                      }}>{f.type === 'pdf' ? '📄' : f.type === 'docx' ? '📝' : '📊'}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em', display:'flex', alignItems:'center', gap: 6 }}>
                          {f.name}
                          {f.isXlsx && (
                            <span style={{ fontSize: 10, fontWeight: 800, padding:'2px 7px', borderRadius: 6, background:'#fff', color:'#0F8B47', flexShrink: 0 }}>기능정의서</span>
                          )}
                          {f.upgrade && (
                            <span style={{ fontSize: 10, fontWeight: 800, padding:'2px 7px', borderRadius: 6, background:'#FFF3D6', color:'#B26A00', flexShrink: 0 }}>🔧 고도화</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: SUB, marginTop: 2, fontWeight: 500 }}>
                          {f.size}KB
                          {f.isXlsx && ` · ${f.functionCount}개 기능 파싱됨`}
                          {f.upgrade && ` · 재사용으로 추가됨`}
                        </div>
                      </div>
                      <button style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: MUTE, fontSize: 14,
                      }}>✕</button>
                    </div>
                  ))}
                </div>

                {/* Drop zone */}
                <label style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  padding: '20px', cursor: 'pointer',
                  background: BG, border: `1.5px dashed #D1D6DB`,
                  borderRadius: 12,
                }}>
                  <span style={{ fontSize: 18 }}>＋</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: INK, letterSpacing: '-0.01em' }}>파일 추가하기</div>
                    <div style={{ fontSize: 11, color: MUTE, marginTop: 2, fontWeight: 500 }}>PDF · DOCX · XLSX · TXT</div>
                  </div>
                </label>

                <div style={{
                  marginTop: 12, padding: '10px 14px',
                  background: '#FFF8E1', borderRadius: 10,
                  fontSize: 12, color: '#7A5C00', fontWeight: 600, letterSpacing: '-0.01em',
                }}>
                  💡 파일이 3개 있어요. "기능 생성" 누르면 모두 종합해서 만들어드려요.
                </div>
              </div>
            </section>

            {/* ─── System info card ─── */}
            <section style={card(LINE)}>
              <div style={cardHeader(LINE)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={iconBox('#FFF1E7', '#FF6B2C')}>✏</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.01em' }}>시스템 정보</div>
                    <div style={{ fontSize: 11.5, color: MUTE, marginTop: 2, fontWeight: 500 }}>이름과 개요를 적어주세요</div>
                  </div>
                </div>
              </div>

              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="시스템명" required value="신용평가 시스템 v2" />
                <FieldArea label="시스템 개요" rows={3}
                  value="기존 신용평가 시스템을 차세대 아키텍처로 재구축하여 평가 정확도와 처리 속도를 개선한다. AI 기반 자동 평가 및 실시간 모니터링 기능을 포함한다." />
                <FieldArea label="추가 요구사항 (선택)" rows={4} placeholder={'RFP에 없는 추가 요구사항을 적어주세요\n\n예)\n- 외부 신용평가사 API 연동\n- 실시간 알림 발송 기능'} value="" />
              </div>
            </section>
          </div>

          {/* ─── Generate CTA ─── */}
          <div style={{ padding: '0 32px 32px' }}>
            <div style={{
              background: `linear-gradient(135deg, ${BLUE} 0%, #1F6FE5 100%)`,
              borderRadius: 16,
              padding: '24px 28px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 24,
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', top: -60, right: 60,
                width: 220, height: 220, borderRadius: '50%',
                background: 'rgba(255,255,255,0.08)',
              }} />
              <div style={{
                position: 'absolute', bottom: -100, right: -60,
                width: 280, height: 280, borderRadius: '50%',
                background: 'rgba(255,255,255,0.05)',
              }} />

              <div style={{ position: 'relative' }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 11.5, fontWeight: 800,
                  padding: '4px 11px', borderRadius: 999,
                  background: 'rgba(255,255,255,0.18)', color: '#fff',
                  marginBottom: 12, letterSpacing: '-0.01em',
                }}>
                  <span>✨</span> AI 기반 자동 생성
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.025em', marginBottom: 6 }}>
                  AI가 기능목록을 만들어드려요
                </div>
                <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.85)', fontWeight: 500, maxWidth: 520, lineHeight: 1.6 }}>
                  업로드한 3개 파일과 시스템 정보를 종합해서<br />
                  정확한 기능목록을 자동 생성해요. 보통 1~3분 정도 걸려요.
                </div>
              </div>

              <button style={{
                position: 'relative',
                height: 56, padding: '0 28px', borderRadius: 999,
                background: '#fff', color: BLUE, border: 'none',
                fontSize: 15, fontWeight: 800, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 10,
                letterSpacing: '-0.01em',
                boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
                flexShrink: 0,
              }}>
                기능 생성 시작 →
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

// ─── helpers ───
const card = (line) => ({
  background: '#fff',
  border: `1px solid ${line}`,
  borderRadius: 14,
  overflow: 'hidden',
});
const cardHeader = (line) => ({
  padding: '16px 20px',
  borderBottom: `1px solid ${line}`,
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
});
const iconBox = (bg, fg) => ({
  width: 36, height: 36, borderRadius: 10,
  background: bg, color: fg,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 16,
});

const Field = ({ label, value, required, placeholder }) => (
  <div>
    <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#4E5968', marginBottom: 8, letterSpacing: '-0.01em' }}>
      {label} {required && <span style={{ color: '#3182F6' }}>*</span>}
    </label>
    <div style={{
      height: 42, padding: '0 14px',
      border: '1px solid #F2F4F6', borderRadius: 10,
      background: '#F9FAFB',
      display: 'flex', alignItems: 'center',
      fontSize: 13.5, fontWeight: 600, color: value ? '#191F28' : '#8B95A1', letterSpacing: '-0.01em',
    }}>{value || placeholder}</div>
  </div>
);
const FieldArea = ({ label, value, rows = 3, placeholder }) => (
  <div>
    <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#4E5968', marginBottom: 8, letterSpacing: '-0.01em' }}>
      {label}
    </label>
    <div style={{
      minHeight: rows * 22 + 16, padding: '12px 14px',
      border: '1px solid #F2F4F6', borderRadius: 10,
      background: '#F9FAFB',
      fontSize: 13.5, fontWeight: 500, color: value ? '#191F28' : '#8B95A1', letterSpacing: '-0.01em',
      lineHeight: 1.6, whiteSpace: 'pre-wrap',
    }}>{value || placeholder}</div>
  </div>
);

window.ProjectDetailToss = ProjectDetailToss;
