import { reconstructPdfLines, splitTextChunks, prioritizeRfpText, detectFunctionListPattern } from '../textExtract';

const mk = (str, x, y, w) => ({ str, transform: [10, 0, 0, 10, x, y], width: w });

describe('reconstructPdfLines', () => {
  test('표 행을 별도 줄로 복원, 행 간 미혼입', () => {
    const items = [
      mk('SFR-001', 50, 700, 40), mk('사용자관리', 120, 700, 50), mk('사용자를 등록한다', 200, 700, 90),
      mk('SFR-002', 50, 680, 40), mk('권한관리', 120, 680, 40), mk('권한을 부여한다', 200, 680, 80),
    ];
    const lines = reconstructPdfLines(items).split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('SFR-001');
    expect(lines[0]).toContain('사용자를 등록한다');
    expect(lines[0]).not.toContain('SFR-002');
  });
  test('넓은 셀 간격은 탭으로 구분', () => {
    const items = [mk('A', 50, 700, 10), mk('B', 400, 700, 10)];
    expect(reconstructPdfLines(items)).toBe('A\tB');
  });
  test('y 미세 흔들림(±2pt)은 같은 줄', () => {
    const items = [mk('가', 50, 700, 10), mk('나', 70, 701.5, 10), mk('다', 90, 698.8, 10)];
    expect(reconstructPdfLines(items)).toBe('가 나 다');
  });
  test('빈/비정상 입력 안전', () => {
    expect(reconstructPdfLines([])).toBe('');
    expect(reconstructPdfLines(null)).toBe('');
    expect(reconstructPdfLines([{ str: 'x' }])).toBe('');
  });
});

describe('splitTextChunks', () => {
  test('줄 경계 분할 — 어떤 줄도 잘리지 않음', () => {
    const doc = Array.from({ length: 100 }, (_, i) =>
      `요구사항 SFR-${String(i).padStart(3, '0')}: 시스템은 데이터를 처리해야 한다`).join('\n');
    const chunks = splitTextChunks(doc, 1000, 100);
    expect(chunks.length).toBeGreaterThan(1);
    for (let i = 0; i < 100; i++) {
      const full = `SFR-${String(i).padStart(3, '0')}: 시스템은 데이터를 처리해야 한다`;
      expect(chunks.some(c => c.includes(full))).toBe(true);
    }
  });
  test('예산 이내면 1청크, 빈 입력은 빈 배열', () => {
    expect(splitTextChunks('짧은 텍스트')).toHaveLength(1);
    expect(splitTextChunks('')).toEqual([]);
  });
});

describe('prioritizeRfpText', () => {
  test('예산 초과 시 기능 섹션 우선, 행정 섹션 후순위', () => {
    const admin = '제안서 작성 요령 및 평가 기준 입찰 참가 자격 계약 조건\n'.repeat(500);
    const func = '시스템은 연동합의서 등록 기능과 현황 조회 기능을 제공해야 한다\n'.repeat(500);
    const out = prioritizeRfpText(admin + '\n\n' + func + '\n\n' + admin, 25000);
    expect(out.length).toBeLessThanOrEqual(25000);
    expect(out).toContain('연동합의서 등록');
    expect((out.match(/연동합의서/g) || []).length)
      .toBeGreaterThan((out.match(/입찰/g) || []).length);
  });
  test('[회귀] 사업관리/품질/PMR 섹션이 가짜 도메인을 만들지 않도록 완전 제외', () => {
    const biz = ['제5장 사업관리 방안',
      '사업자는 사업관리 계획을 수립하여 제출해야 한다. 사업 수행 조직과 투입 인력 관리 방안을 포함한다.',
      '품질 관리: 산출물 품질 관리 체계를 수립하고 단계별 검토를 수행해야 한다.',
      'PMR-001 사업 수행 계획서를 착수 시 제출하여야 한다.'].join('\n');
    const func = ['제3장 기능 요구사항',
      'SFR-001 연동합의서를 등록, 수정, 삭제할 수 있어야 한다.'].join('\n');
    const out = prioritizeRfpText((biz + '\n\n').repeat(30) + func + ('\n\n' + biz).repeat(30), 3000);
    expect(out).toContain('SFR-001');
    expect(out.match(/사업관리 방안|PMR-|수행 계획서/g)).toBeNull();
  });
  test('전부 행정 텍스트여도 빈 결과 방지 (가드 백필)', () => {
    const biz = '사업관리 계획을 수립하고 품질 관리 체계와 보고 체계를 운영해야 한다. PMR-001 수행 계획서 제출.\n제5장 사업관리 방안';
    const out = prioritizeRfpText((biz + '\n\n').repeat(60), 3000);
    expect(out.length).toBeGreaterThan(500);
  });
  test('예산 이내면 원본 유지', () => {
    expect(prioritizeRfpText('짧음', 1000)).toBe('짧음');
  });
});

describe('detectFunctionListPattern', () => {
  const funcList = Array.from({ length: 60 }, (_, i) => {
    const lv2 = ['합의서관리', '현황조회', '장애관리'][i % 3];
    const verb = ['등록', '수정', '삭제', '목록조회', '상세조회'][i % 5];
    return `연동관리\t${lv2}\t${lv2} ${verb}\t${lv2}을(를) ${verb}한다`;
  }).join('\n');

  test('기능목록(탭) 감지', () => {
    expect(detectFunctionListPattern(funcList).isFunctionList).toBe(true);
  });
  test('기능목록(공백 — PDF 재구성 모사) 감지', () => {
    const spaceList = funcList.split('\n').map(l => l.split('\t').join('  ')).join('\n');
    expect(detectFunctionListPattern(spaceList).isFunctionList).toBe(true);
  });
  test('RFP 서술형 미오탐', () => {
    const rfp = Array.from({ length: 60 }, (_, i) =>
      `SFR-${i} 시스템은 사용자 정보를 관리하는 기능을 제공해야 한다.`).join('\n');
    expect(detectFunctionListPattern(rfp).isFunctionList).toBe(false);
  });
  test('요구사항 표 형태 미오탐', () => {
    const rfpTable = Array.from({ length: 60 }, (_, i) =>
      `SFR-${String(i).padStart(3, '0')}\t연동기능\t연동합의서를 등록할 수 있어야 한다`).join('\n');
    expect(detectFunctionListPattern(rfpTable).isFunctionList).toBe(false);
  });
  test('짧은 텍스트 미감지', () => {
    expect(detectFunctionListPattern('짧은 글').isFunctionList).toBe(false);
  });
});
