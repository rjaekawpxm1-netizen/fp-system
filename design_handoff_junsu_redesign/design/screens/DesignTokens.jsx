// ─── Design Tokens · junsu / AX consulting ───
// 확정된 디자인 시스템 한눈에 보기

const DesignTokens = () => {
  const BLUE = '#3182F6';
  const INK = '#191F28';
  const SUB = '#4E5968';
  const MUTE = '#8B95A1';
  const LINE = '#F2F4F6';
  const BG = '#F9FAFB';

  const Section = ({ title, children, span = 12 }) => (
    <section style={{
      gridColumn: `span ${span}`,
      background: '#fff', border: `1px solid ${LINE}`,
      borderRadius: 16, padding: '24px 28px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: MUTE, marginBottom: 16 }}>
        {title}
      </div>
      {children}
    </section>
  );

  const Swatch = ({ color, name, hex, light }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        height: 88, borderRadius: 12, background: color,
        border: light ? `1px solid ${LINE}` : 'none',
      }} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>{name}</div>
        <div style={{ fontSize: 11, color: MUTE, fontFamily: 'SF Mono, ui-monospace, monospace', marginTop: 2 }}>{hex}</div>
      </div>
    </div>
  );

  return (
    <div style={{
      width: '100%', height: '100%',
      background: BG,
      fontFamily: "'Pretendard', system-ui, sans-serif",
      color: INK, padding: '40px',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, background: BLUE,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 900, fontSize: 18, letterSpacing: '-0.04em',
            }}>j</div>
            <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em' }}>junsu</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em' }}>Design System</h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: SUB, fontWeight: 500 }}>
            확정안 · D · Toss Style · 2026
          </p>
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', borderRadius: 999,
          background: '#E7F8EF', color: '#0F8B47',
          fontSize: 13, fontWeight: 700,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#0F8B47' }} />
          확정됨
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16 }}>
        {/* Colors */}
        <Section title="COLORS · PRIMARY" span={4}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
            <Swatch color={BLUE} name="Brand Blue" hex="#3182F6" />
            <Swatch color="#EAF3FF" name="Blue Tint" hex="#EAF3FF" light />
          </div>
        </Section>

        <Section title="COLORS · NEUTRAL" span={5}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            <Swatch color={INK} name="Ink" hex="#191F28" />
            <Swatch color={SUB} name="Sub" hex="#4E5968" />
            <Swatch color={MUTE} name="Mute" hex="#8B95A1" />
            <Swatch color="#fff" name="Surface" hex="#FFFFFF" light />
            <Swatch color={BG} name="Surface 2" hex="#F9FAFB" light />
            <Swatch color={LINE} name="Line" hex="#F2F4F6" light />
          </div>
        </Section>

        <Section title="COLORS · STATUS" span={3}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
            {[
              { c: '#0F8B47', bg: '#E7F8EF', l: '결재완료' },
              { c: BLUE, bg: '#EAF3FF', l: '결재중' },
              { c: '#E53935', bg: '#FFEBEB', l: '반려' },
            ].map(s => (
              <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 11px', borderRadius: 999,
                  fontSize: 12, fontWeight: 700,
                  background: s.bg, color: s.c,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.c }} />
                  {s.l}
                </span>
                <span style={{ fontSize: 11, color: MUTE, fontFamily: 'SF Mono, ui-monospace, monospace' }}>{s.c}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Typography */}
        <Section title="TYPOGRAPHY · Pretendard" span={7}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { l: 'Display', size: 48, weight: 800, label: '48 / 800', text: 'BA · AA · DA · TA' },
              { l: 'H1', size: 28, weight: 800, label: '28 / 800', text: '지출결의' },
              { l: 'H2', size: 22, weight: 800, label: '22 / 800', text: '검색결과 6건' },
              { l: 'Body', size: 14, weight: 500, label: '14 / 500', text: '월별 경비 청구 내역을 한눈에 확인하세요.' },
              { l: 'Caption', size: 12, weight: 600, label: '12 / 600', text: '3분 전 동기화됨', color: MUTE },
            ].map(t => (
              <div key={t.l} style={{ display: 'flex', alignItems: 'baseline', gap: 16, paddingBottom: 12, borderBottom: `1px solid ${LINE}` }}>
                <div style={{ width: 70, fontSize: 11, fontWeight: 700, color: MUTE, fontFamily: 'SF Mono, ui-monospace, monospace' }}>
                  {t.l}
                </div>
                <div style={{
                  flex: 1, fontSize: t.size, fontWeight: t.weight,
                  letterSpacing: '-0.025em', color: t.color || INK,
                }}>{t.text}</div>
                <div style={{ fontSize: 11, color: MUTE, fontFamily: 'SF Mono, ui-monospace, monospace' }}>
                  {t.label}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Components */}
        <Section title="BUTTONS" span={5}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button style={{
                height: 56, padding: '0 28px', borderRadius: 999,
                background: BLUE, color: '#fff', border: 'none',
                fontSize: 15, fontWeight: 800, cursor: 'pointer',
                boxShadow: '0 10px 24px rgba(49,130,246,0.32)',
              }}>지금 시작하기 →</button>
              <span style={{ fontSize: 11, color: MUTE, fontFamily: 'SF Mono, ui-monospace, monospace' }}>Primary · Pill</span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button style={{
                height: 40, padding: '0 16px', borderRadius: 10,
                background: BLUE, color: '#fff', border: 'none',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>+ 신규 상신</button>
              <button style={{
                height: 40, padding: '0 14px', borderRadius: 10,
                background: '#fff', color: INK, border: `1px solid ${LINE}`,
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>↓ 다운로드</button>
              <span style={{ fontSize: 11, color: MUTE, fontFamily: 'SF Mono, ui-monospace, monospace' }}>Default · 40h</span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button style={{
                height: 34, padding: '0 14px', borderRadius: 999,
                background: '#EAF3FF', color: BLUE, border: 'none',
                fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              }}>활성 필터</button>
              <button style={{
                height: 34, padding: '0 14px', borderRadius: 999,
                background: '#fff', color: SUB, border: `1px solid ${LINE}`,
                fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              }}>전체</button>
              <span style={{ fontSize: 11, color: MUTE, fontFamily: 'SF Mono, ui-monospace, monospace' }}>Chip · 34h</span>
            </div>
          </div>
        </Section>

        {/* Radius */}
        <Section title="RADIUS" span={4}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { r: 8, l: 'sm' },
              { r: 10, l: 'md' },
              { r: 14, l: 'lg' },
              { r: 999, l: 'pill' },
            ].map(x => (
              <div key={x.l} style={{ textAlign: 'center' }}>
                <div style={{
                  height: 56, background: BLUE, opacity: 0.12,
                  borderRadius: x.r, marginBottom: 8,
                  border: `1.5px dashed ${BLUE}`,
                }} />
                <div style={{ fontSize: 12, fontWeight: 700, color: INK }}>{x.l}</div>
                <div style={{ fontSize: 10, color: MUTE, fontFamily: 'SF Mono, ui-monospace, monospace' }}>
                  {x.r === 999 ? '∞' : `${x.r}px`}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="SPACING SCALE" span={4}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100 }}>
            {[4, 8, 12, 16, 20, 24, 32, 40].map(s => (
              <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 26, height: s * 2.4, background: BLUE, borderRadius: 4 }} />
                <span style={{ fontSize: 10, color: MUTE, fontFamily: 'SF Mono, ui-monospace, monospace' }}>{s}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Voice */}
        <Section title="VOICE · 친근하고 단정하게" span={4}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              '안녕하세요, 처음이신가요?',
              '무엇이든 찾아보세요',
              '도움이 필요하세요?',
              '3분 전 동기화됨',
            ].map(t => (
              <div key={t} style={{
                fontSize: 13, fontWeight: 600, color: INK,
                padding: '10px 14px', background: BG,
                borderRadius: 10, letterSpacing: '-0.01em',
              }}>"{t}"</div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
};

window.DesignTokens = DesignTokens;
