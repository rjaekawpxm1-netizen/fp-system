/**
 * excelExport.js
 * ExcelJS 기반 공식 양식 Excel 생성
 * SW사업 대가산정 가이드 2025 공식 양식 기준
 *
 * 설치 필요: npm install exceljs file-saver
 */
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// ── 공통 색상 상수 ────────────────────────────────────────────
const C = {
  HEADER1: 'FFFF99',   // 연노랑 (헤더)
  NOTE:    'FFCC66',   // 주황 (비고)
  TOTAL:   'C5D9F1',   // 진파랑 (합계)
  SUMMARY: 'DAEEF3',   // 연파랑 (요약)
  WHITE:   'FFFFFF',
  BLACK:   '000000',
  RED:     'FF0000',
};

const thin = { style: 'thin', color: { argb: 'FF000000' } };
const BORDER = { top: thin, left: thin, bottom: thin, right: thin };
const FONT   = (bold = false, sz = 10) => ({ name: '맑은 고딕', bold, size: sz });

function applyCell(cell, value, {
  bg = null, bold = false, sz = 10,
  align = 'center', vAlign = 'middle',
  border = true, wrap = true, color = null,
  numFmt = null,
} = {}) {
  cell.value = value;
  cell.font  = { name: '맑은 고딕', bold, size: sz, color: color ? { argb: 'FF' + color } : undefined };
  cell.alignment = { horizontal: align, vertical: vAlign, wrapText: wrap };
  if (bg)     cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bg } };
  if (border) cell.border = BORDER;
  if (numFmt) cell.numFmt = numFmt;
}

// ── 간이법 가중치 ─────────────────────────────────────────────
const AVG_WEIGHTS = { EI: 4.0, EO: 5.2, EQ: 3.9, ILF: 7.5, EIF: 5.4 };

// ── 정통법 복잡도 + 가중치 ────────────────────────────────────
function getComplexityStd(fpType, ftr, det) {
  ftr = Number(ftr) || 0;
  det = Number(det) || 0;
  if (['ILF', 'EIF'].includes(fpType)) {
    if (ftr <= 1 && det <= 19) return 'L';
    if (ftr <= 1 && det <= 50) return 'A';
    if (ftr <= 1) return 'H';
    if (ftr <= 5 && det <= 50) return 'A';
    return 'H';
  }
  if (fpType === 'EI') {
    if (ftr <= 1 && det <= 15) return 'L';
    if (ftr <= 1) return 'A';
    if (ftr === 2 && det <= 4) return 'L';
    if (ftr === 2 && det <= 15) return 'A';
    if (ftr === 2) return 'H';
    if (ftr >= 3 && det <= 4) return 'A';
    return 'H';
  }
  if (fpType === 'EO' || fpType === 'EQ') {
    if (ftr <= 1 && det <= 19) return 'L';
    if (ftr <= 1) return 'A';
    if (ftr <= 3 && det <= 19) return 'A';
    if (ftr <= 3) return 'H';
    if (ftr >= 4 && det <= 4) return 'A';
    return 'H';
  }
  return 'A';
}

const STD_WEIGHTS = {
  EI:  { L: 3, A: 4, H: 6  },
  EO:  { L: 4, A: 5, H: 7  },
  EQ:  { L: 3, A: 4, H: 6  },
  ILF: { L: 7, A: 10, H: 15 },
  EIF: { L: 5, A: 7,  H: 10 },
};

function getWeightStd(fpType, ftr, det) {
  const c = getComplexityStd(fpType, ftr, det);
  return (STD_WEIGHTS[fpType] || {})[c] || 0;
}


// ════════════════════════════════════════════════════════════════
// 간이법 FP산정표
// ════════════════════════════════════════════════════════════════
async function buildSimpleSheet(wb, fpList, projectInfo) {
  const ws = wb.addWorksheet('FP산정(간이법)');

  // 열 너비
  ws.columns = [
    { key: 'A', width: 2.5 },
    { key: 'B', width: 17 },
    { key: 'C', width: 16 },
    { key: 'D', width: 20 },
    { key: 'E', width: 26 },
    { key: 'F', width: 9.5 },
    { key: 'G', width: 7.5 },
    { key: 'H', width: 8 },
    { key: 'I', width: 10 },
    { key: 'J', width: 16 },
    { key: 'K', width: 7.5 },
    { key: 'L', width: 7.5 },
    { key: 'M', width: 7.5 },
    { key: 'N', width: 7.2 },
    { key: 'O', width: 7.5 },
    { key: 'P', width: 7.2 },
    { key: 'Q', width: 9.5 },
    { key: 'R', width: 20 },
  ];

  // 행 높이
  ws.getRow(1).height = 22;
  ws.getRow(7).height = 30;
  ws.getRow(8).height = 38;

  // ── 제목 행 ─────────────────────────────────────────────────
  ws.mergeCells('A1:R1');
  applyCell(ws.getCell('A1'),
    `기능점수 산정 (간이법) - ${projectInfo.systemName || ''} ${projectInfo.projectName || ''}`,
    { bold: true, sz: 13, border: false, bg: C.SUMMARY }
  );

  // ── 우측 요약 (신규/변경/삭제/재사용) ───────────────────────
  const reuseSummary = [
    ['신규개발',       fpList.filter(f => f.reuseType === '신규개발').reduce((s, f) => s + (AVG_WEIGHTS[f.fpType] || 0), 0)],
    ['기능변경',       fpList.filter(f => f.reuseType === '기능변경').reduce((s, f) => s + (AVG_WEIGHTS[f.fpType] || 0) * (f.impactFactor || 1), 0)],
    ['기능삭제',       '측정 비대상'],
    ['수정없이 재사용', fpList.filter(f => f.reuseType === '수정없이재사용').reduce((s, f) => s + (AVG_WEIGHTS[f.fpType] || 0), 0)],
  ];
  reuseSummary.forEach(([label, val], i) => {
    const r = i + 2;
    applyCell(ws.getCell(r, 10), label, { bg: C.HEADER1, bold: true });
    applyCell(ws.getCell(r, 11), val,   { bold: true, numFmt: '#,##0.00' });
    ws.mergeCells(r, 11, r, 12);
  });

  // ── EIF 안내 ─────────────────────────────────────────────────
  ws.mergeCells('F6:G6');
  applyCell(ws.getCell('F6'), 'EIF', { bold: true, sz: 11, color: C.RED, border: false });
  ws.mergeCells('H6:R6');
  applyCell(ws.getCell('H6'), '= 관리주체가 외부에 있으므로 기능변경 측정 대상이 아님에 유의',
    { sz: 9, align: 'left', border: false });

  // ── 헤더 행 7 (대분류) ───────────────────────────────────────
  ws.mergeCells('B7:E7');
  applyCell(ws.getCell('B7'), '기능명', { bg: C.HEADER1, bold: true });
  ws.mergeCells('F7:H7');
  applyCell(ws.getCell('F7'), '데이터 및 트랜잭션 기능', { bg: C.HEADER1, bold: true });

  const hdr7right = [
    [9,  9,  'FP 산출'],
    [10, 10, '재사용유형'],
    [11, 11, 'FTR\n변경량'],
    [12, 12, 'DET\n변경량'],
    [13, 13, 'FTR\n변경률'],
    [14, 14, 'DET\n변경률'],
    [15, 15, '기능\n변경률'],
    [16, 16, '영향\n계수'],
    [17, 17, '재사용\n기능점수'],
    [18, 18, '비고'],
  ];
  hdr7right.forEach(([c1, c2, val]) => {
    if (c1 !== c2) ws.mergeCells(7, c1, 8, c2);
    applyCell(ws.getCell(7, c1), val, { bg: C.HEADER1, bold: true });
  });

  // ── 헤더 행 8 (소분류) ───────────────────────────────────────
  ws.mergeCells('B7:B8');
  const hdr8 = [
    [2, '①어플리케이션명'],
    [3, '②세부 업무명'],
    [4, '③단위프로세스명'],
    [5, '단위프로세스 설명'],
    [6, '④FP유형'],
    [7, '⑤FTR'],
    [8, '⑥DET'],
    [9, '⑧가중치'],
  ];
  hdr8.forEach(([col, val]) => {
    applyCell(ws.getCell(8, col), val, { bg: C.HEADER1, bold: true });
  });

  // ── 데이터 행 ─────────────────────────────────────────────────
  const START = 9;
  fpList.forEach((f, i) => {
    const r = START + i;
    ws.getRow(r).height = 15;
    const w = AVG_WEIGHTS[f.fpType] || 0;
    const reuse = f.reuseType || '신규개발';
    const isChg = reuse === '기능변경';

    const dataRow = [
      [1, ''],
      [2, f.lv1 || '', 'left'],
      [3, f.lv2 || '', 'left'],
      [4, f.lv3 || '', 'left'],
      [5, f.definition || '', 'left'],
      [6, f.fpType || '', 'center'],
      [7, ['ILF','EIF'].includes(f.fpType) ? '' : (f.ftr || ''), 'center'],
      [8, f.det || '', 'center'],
      [9, w, 'center'],
      [10, reuse, 'left'],
      [11, isChg ? (f.ftrChange || '') : '', 'center'],
      [12, isChg ? (f.detChange || '') : '', 'center'],
    ];
    dataRow.forEach(([col, val, align = 'center']) => {
      applyCell(ws.getCell(r, col), val, { align, sz: 10 });
    });

    // 변경률/영향계수/재사용FP (계산값)
    const ftrC = Number(f.ftrChange) || 0;
    const detC = Number(f.detChange) || 0;
    const ftrR = f.ftr ? ftrC / f.ftr : 0;
    const detR = f.det ? detC / f.det : 0;
    const funcR = ['ILF','EIF'].includes(f.fpType) ? detR : (ftrR + detR) / 2;
    const impact = funcR <= 0.25 ? 0.25 : funcR <= 0.5 ? 0.5 : funcR <= 0.75 ? 0.75 : 1.0;
    const reuseScore = isChg ? w * impact : '';

    applyCell(ws.getCell(r, 13), isChg ? ftrR  : '', { numFmt: '0.0%' });
    applyCell(ws.getCell(r, 14), isChg ? detR  : '', { numFmt: '0.0%' });
    applyCell(ws.getCell(r, 15), isChg ? funcR : '', { numFmt: '0.0%' });
    applyCell(ws.getCell(r, 16), isChg ? impact : '');
    applyCell(ws.getCell(r, 17), isChg ? reuseScore : '', { numFmt: '#,##0.00' });
    applyCell(ws.getCell(r, 18), f.bigo || '');
  });

  // ── 합계 행 ───────────────────────────────────────────────────
  const last = START + fpList.length - 1;
  const totalRow = last + 1;
  ws.mergeCells(totalRow, 2, totalRow, 8);
  applyCell(ws.getCell(totalRow, 2), '합  계', { bg: C.TOTAL, bold: true });
  const totalFP = fpList.filter(f => f.reuseType === '신규개발')
    .reduce((s, f) => s + (AVG_WEIGHTS[f.fpType] || 0), 0);
  applyCell(ws.getCell(totalRow, 9), totalFP, { bg: C.TOTAL, bold: true, numFmt: '#,##0.00' });
  for (let c = 10; c <= 18; c++) {
    applyCell(ws.getCell(totalRow, c), '', { bg: C.TOTAL });
  }
}


// ════════════════════════════════════════════════════════════════
// 정통법 FP산정표
// ════════════════════════════════════════════════════════════════
async function buildStandardSheet(wb, fpList, projectInfo) {
  const ws = wb.addWorksheet('FP산정(정통법)');

  ws.columns = [
    { key: 'A', width: 2.5 },
    { key: 'B', width: 16.2 },
    { key: 'C', width: 15.9 },
    { key: 'D', width: 20.4 },
    { key: 'E', width: 26.4 },
    { key: 'F', width: 9.4 },
    { key: 'G', width: 10.9 },
    { key: 'H', width: 9.4 },
    { key: 'I', width: 8.8 },
    { key: 'J', width: 9.0 },
    { key: 'K', width: 16.4 },
    { key: 'L', width: 7.5 },
    { key: 'M', width: 7.5 },
    { key: 'N', width: 7.5 },
    { key: 'O', width: 7.2 },
    { key: 'P', width: 7.5 },
    { key: 'Q', width: 7.1 },
    { key: 'R', width: 9.4 },
    { key: 'S', width: 20 },
  ];

  ws.getRow(1).height = 22;
  ws.getRow(7).height = 30;
  ws.getRow(8).height = 38;

  // 제목
  ws.mergeCells('A1:S1');
  applyCell(ws.getCell('A1'),
    `기능점수 산정 (정통법) - ${projectInfo.systemName || ''} ${projectInfo.projectName || ''}`,
    { bold: true, sz: 13, bg: C.SUMMARY }
  );

  // 요약
  const reuseSummary2 = [
    ['신규개발',       fpList.filter(f => f.reuseType === '신규개발').reduce((s, f) => s + getWeightStd(f.fpType, f.ftr, f.det), 0)],
    ['기능변경',       fpList.filter(f => f.reuseType === '기능변경').reduce((s, f) => s + getWeightStd(f.fpType, f.ftr, f.det) * (f.impactFactor || 1), 0)],
    ['기능삭제',       '측정 비대상'],
    ['수정없이 재사용', fpList.filter(f => f.reuseType === '수정없이재사용').reduce((s, f) => s + getWeightStd(f.fpType, f.ftr, f.det), 0)],
  ];
  reuseSummary2.forEach(([label, val], i) => {
    const r = i + 2;
    applyCell(ws.getCell(r, 11), label, { bg: C.HEADER1, bold: true });
    ws.mergeCells(r, 12, r, 13);
    applyCell(ws.getCell(r, 12), val, { bold: true, numFmt: '#,##0.00' });
  });

  // EIF 안내
  ws.mergeCells('F6:H6');
  applyCell(ws.getCell('F6'), 'EIF', { bold: true, sz: 11, color: C.RED, border: false });
  ws.mergeCells('I6:S6');
  applyCell(ws.getCell('I6'), '= 관리주체가 외부에 있으므로 기능변경 측정 대상이 아님에 유의',
    { sz: 9, align: 'left', border: false });

  // 헤더 행 7
  ws.mergeCells('B7:E7');
  applyCell(ws.getCell('B7'), '기능명', { bg: C.HEADER1, bold: true });
  ws.mergeCells('F7:J7');
  applyCell(ws.getCell('F7'), '데이터 및 트랜잭션 기능', { bg: C.HEADER1, bold: true });

  const hdr7r = [
    [11, 11, '재사용유형'], [12, 12, 'FTR\n변경량'], [13, 13, 'DET\n변경량'],
    [14, 14, 'FTR\n변경률'], [15, 15, 'DET\n변경률'], [16, 16, '기능\n변경률'],
    [17, 17, '영향\n계수'], [18, 18, '재사용\n기능점수'], [19, 19, '비고'],
  ];
  // FP산출 헤더
  ws.mergeCells(7, 10, 8, 10);
  applyCell(ws.getCell(7, 10), 'FP 산출', { bg: C.HEADER1, bold: true });
  hdr7r.forEach(([c1, c2, val]) => {
    ws.mergeCells(7, c1, 8, c2);
    applyCell(ws.getCell(7, c1), val, { bg: C.HEADER1, bold: true });
  });

  // 헤더 행 8
  const hdr8s = [
    [2,'①어플리케이션명'],[3,'②세부 업무명'],[4,'③단위프로세스명'],
    [5,'단위프로세스 설명'],[6,'④FP유형'],[7,'⑤RET/FTR'],[8,'⑥DET'],
    [9,'⑦복잡도'],
  ];
  hdr8s.forEach(([col, val]) => applyCell(ws.getCell(8, col), val, { bg: C.HEADER1, bold: true }));

  // 데이터 행
  const START2 = 9;
  fpList.forEach((f, i) => {
    const r = START2 + i;
    ws.getRow(r).height = 15;
    const comp   = getComplexityStd(f.fpType, f.ftr, f.det);
    const weight = getWeightStd(f.fpType, f.ftr, f.det);
    const reuse  = f.reuseType || '신규개발';
    const isChg  = reuse === '기능변경';

    [[1,''],[2,f.lv1||'','left'],[3,f.lv2||'','left'],[4,f.lv3||'','left'],
     [5,f.definition||'','left'],[6,f.fpType||''],[7,f.ftr||''],[8,f.det||''],
     [9,comp],[10,weight],[11,reuse,'left'],
     [12,isChg?(f.ftrChange||''):''],[13,isChg?(f.detChange||''):''],
    ].forEach(([col, val, align='center']) => {
      applyCell(ws.getCell(r, col), val, { align });
    });

    const ftrC = Number(f.ftrChange) || 0;
    const detC = Number(f.detChange) || 0;
    const ftrR = f.ftr ? ftrC / f.ftr : 0;
    const detR = f.det ? detC / f.det : 0;
    const funcR = ['ILF','EIF'].includes(f.fpType) ? detR : (ftrR + detR) / 2;
    const impact = funcR <= 0.25 ? 0.25 : funcR <= 0.5 ? 0.5 : funcR <= 0.75 ? 0.75 : 1.0;

    applyCell(ws.getCell(r, 14), isChg ? ftrR  : '', { numFmt: '0.0%' });
    applyCell(ws.getCell(r, 15), isChg ? detR  : '', { numFmt: '0.0%' });
    applyCell(ws.getCell(r, 16), isChg ? funcR : '', { numFmt: '0.0%' });
    applyCell(ws.getCell(r, 17), isChg ? impact : '');
    applyCell(ws.getCell(r, 18), isChg ? weight * impact : '', { numFmt: '#,##0.00' });
    applyCell(ws.getCell(r, 19), f.bigo || '');
  });

  // 합계 행
  const last2 = START2 + fpList.length - 1;
  const tr2 = last2 + 1;
  ws.mergeCells(tr2, 2, tr2, 9);
  applyCell(ws.getCell(tr2, 2), '합  계', { bg: C.TOTAL, bold: true });
  const totalFP2 = fpList.filter(f => f.reuseType === '신규개발')
    .reduce((s, f) => s + getWeightStd(f.fpType, f.ftr, f.det), 0);
  applyCell(ws.getCell(tr2, 10), totalFP2, { bg: C.TOTAL, bold: true, numFmt: '#,##0.00' });
  for (let c = 11; c <= 19; c++) applyCell(ws.getCell(tr2, c), '', { bg: C.TOTAL });
}


// ════════════════════════════════════════════════════════════════
// 기능목록 시트
// ════════════════════════════════════════════════════════════════
function buildFunctionSheet(wb, functions) {
  const ws = wb.addWorksheet('기능목록');
  ws.columns = [
    { width: 18 }, { width: 18 }, { width: 28 }, { width: 50 }
  ];
  ws.getRow(1).height = 20;

  const headers = ['LV1', 'LV2', 'LV3 (단위프로세스명)', '기능 정의'];
  headers.forEach((h, ci) => {
    applyCell(ws.getCell(1, ci + 1), h, { bg: C.HEADER1, bold: true });
  });

  functions.forEach((f, i) => {
    const r = i + 2;
    [f.lv1||'', f.lv2||'', f.lv3||'', f.definition||''].forEach((val, ci) => {
      applyCell(ws.getCell(r, ci + 1), val, { align: ci < 2 ? 'center' : 'left' });
    });
  });
}


// ════════════════════════════════════════════════════════════════
// 기타 시트들 (화면목록, 요구사항 등)
// ════════════════════════════════════════════════════════════════
function buildGenericSheet(wb, sheetName, headers, rows, colWidths = []) {
  const ws = wb.addWorksheet(sheetName);
  ws.columns = headers.map((h, i) => ({ width: colWidths[i] || 15 }));
  ws.getRow(1).height = 20;

  headers.forEach((h, ci) => {
    applyCell(ws.getCell(1, ci + 1), h, { bg: C.HEADER1, bold: true });
  });
  rows.forEach((row, ri) => {
    const r = ri + 2;
    headers.forEach((h, ci) => {
      applyCell(ws.getCell(r, ci + 1), row[h] ?? '', { align: 'left' });
    });
  });
}


// ════════════════════════════════════════════════════════════════
// 메인 내보내기 함수
// ════════════════════════════════════════════════════════════════
export const exportAllExcelNew = async (projectData, projectName) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'FP 도우미';
  wb.created = new Date();

  const {
    functions = [], fpList = [], screenList = [], reqList = [],
    crudMatrix = {}, ifList = [], wbsList = [], traceList = [],
    tcList = [], asisList = [],
    systemName = '', projectNameStr = '', manager = '',
  } = projectData;

  const projectInfo = { systemName, projectName: projectNameStr, manager };

  // 기능목록
  if (functions.length > 0) buildFunctionSheet(wb, functions);

  // FP산정 (간이법 + 정통법)
  if (fpList.length > 0) {
    await buildSimpleSheet(wb, fpList, projectInfo);
    await buildStandardSheet(wb, fpList, projectInfo);
  }

  // 화면목록
  if (screenList.length > 0) {
    buildGenericSheet(wb, '화면목록',
      ['화면ID','화면명','화면유형','LV1','LV2','관련기능','비고'],
      screenList.map(s => ({
        '화면ID': s.screenId, '화면명': s.screenName, '화면유형': s.screenType,
        'LV1': s.lv1, 'LV2': s.lv2, '관련기능': s.relatedFunctions, '비고': s.note || '',
      })),
      [12, 25, 12, 15, 15, 40, 15]
    );
  }

  // 요구사항정의서
  if (reqList.length > 0) {
    buildGenericSheet(wb, '요구사항정의서',
      ['요구사항ID','유형','요구사항명','상세내용','관련화면','우선순위','비고'],
      reqList.map(r => ({
        '요구사항ID': r.reqId, '유형': r.type, '요구사항명': r.reqName,
        '상세내용': r.detail, '관련화면': r.relatedScreen,
        '우선순위': r.priority, '비고': r.note || '',
      })),
      [12, 10, 25, 50, 12, 10, 15]
    );
  }

  // CRUD 분석
  const crudRows = crudMatrix.matrix || [];
  if (crudRows.length > 0) {
    const entities = crudMatrix.entities || [];
    buildGenericSheet(wb, 'CRUD분석',
      ['LV1', 'LV2', 'LV3', ...entities],
      crudRows.map(f => ({
        'LV1': f.lv1, 'LV2': f.lv2, 'LV3': f.lv3,
        ...Object.fromEntries(entities.map(e => [e, f.crud?.[e] || ''])),
      })),
      [15, 15, 25, ...entities.map(() => 8)]
    );
  }

  // 인터페이스 정의서
  if (ifList.length > 0) {
    buildGenericSheet(wb, '인터페이스정의서',
      ['인터페이스ID','인터페이스명','송신시스템','수신시스템','연동방식','연동주기','주요데이터항목','비고'],
      ifList.map(f => ({
        '인터페이스ID': f.ifId, '인터페이스명': f.ifName,
        '송신시스템': f.sendSystem, '수신시스템': f.receiveSystem,
        '연동방식': f.method, '연동주기': f.cycle,
        '주요데이터항목': f.dataItems, '비고': f.note || '',
      })),
      [14, 25, 20, 20, 12, 12, 40, 15]
    );
  }

  // WBS
  if (wbsList.length > 0) {
    buildGenericSheet(wb, 'WBS',
      ['WBS ID','단계','작업명','LV1','LV2','공수(일)','담당자','비고'],
      wbsList.map(w => ({
        'WBS ID': w.wbsId, '단계': w.phase, '작업명': w.task,
        'LV1': w.lv1, 'LV2': w.lv2,
        '공수(일)': w.workDays, '담당자': w.role, '비고': w.note || '',
      })),
      [8, 10, 30, 15, 15, 10, 10, 20]
    );
  }

  // 요구사항 추적표
  if (traceList.length > 0) {
    buildGenericSheet(wb, '요구사항추적표',
      ['요구사항ID','요구사항명','관련기능','관련화면','테스트케이스ID','상태'],
      traceList.map(t => ({
        '요구사항ID': t.reqId, '요구사항명': t.reqName,
        '관련기능': t.relatedFunctions, '관련화면': t.relatedScreens,
        '테스트케이스ID': t.testId, '상태': t.status,
      })),
      [12, 25, 30, 20, 14, 10]
    );
  }

  // 테스트케이스
  if (tcList.length > 0) {
    buildGenericSheet(wb, '테스트케이스',
      ['TC ID','요구사항ID','테스트케이스명','유형','사전조건','테스트절차','기대결과','결과'],
      tcList.map(t => ({
        'TC ID': t.tcId, '요구사항ID': t.reqId, '테스트케이스명': t.tcName,
        '유형': t.type, '사전조건': t.precondition,
        '테스트절차': t.steps, '기대결과': t.expected, '결과': t.result,
      })),
      [10, 10, 30, 8, 20, 40, 30, 10]
    );
  }

  // AS-IS/TO-BE
  if (asisList.length > 0) {
    buildGenericSheet(wb, 'AS-IS_TO-BE',
      ['LV1','LV2','AS-IS(현행)','TO-BE(목표)','기대효과','변화유형'],
      asisList.map(a => ({
        'LV1': a.lv1, 'LV2': a.lv2,
        'AS-IS(현행)': a.asIs, 'TO-BE(목표)': a.toBe,
        '기대효과': a.improvement, '변화유형': a.changeType,
      })),
      [15, 20, 40, 40, 30, 12]
    );
  }

  if (wb.worksheets.length === 0) {
    alert('출력할 데이터가 없습니다. 먼저 기능목록을 생성하세요.');
    return;
  }

  // 다운로드
  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }), `${projectName}_전체산출물.xlsx`);
};


// FP산정표만 단독 내보내기
export const exportFPExcel = async (fpList, projectInfo, method = 'both') => {
  const wb = new ExcelJS.Workbook();

  if (method === 'simple' || method === 'both') {
    await buildSimpleSheet(wb, fpList, projectInfo);
  }
  if (method === 'standard' || method === 'both') {
    await buildStandardSheet(wb, fpList, projectInfo);
  }

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }), `FP산정표_${projectInfo.systemName || ''}.xlsx`);
};


// ════════════════════════════════════════════════════════════════
// 개발비 산출서 내보내기 (공식 양식)
// ════════════════════════════════════════════════════════════════
export const exportCostExcel = async (data) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('SW재개발비 산정');

  ws.columns = [
    { width: 2 }, { width: 28 }, { width: 50 },
    { width: 18 }, { width: 18 },
  ];

  const fmt = (n) => typeof n === 'number' ? n.toLocaleString('ko-KR') : n;

  // 제목
  ws.mergeCells('A1:E1');
  applyCell(ws.getCell('A1'),
    `「${data.projectName}」 소프트웨어 재개발비 산정`,
    { bold: true, sz: 13, bg: C.SUMMARY, border: false }
  );
  ws.getRow(1).height = 24;

  ws.mergeCells('A2:E2');
  applyCell(ws.getCell('A2'),
    `산정일자: ${new Date().toLocaleDateString('ko-KR')}  |  산정방법: ${data.method === 'standard' ? '정통법' : '간이법'}`,
    { sz: 9, align: 'left', border: false }
  );

  const sections = [
    { title: '① 기능점수(FP) 산출', rows: [
      ['총 기능점수',    `${data.method === 'standard' ? '정통법' : '간이법'} 기준`, `${data.totalFP} FP`, ''],
      ['신규개발 FP',    '', `${data.fpSummary.newDev} FP`, ''],
      ['기능변경 FP',    '', `${data.fpSummary.changed} FP`, ''],
      ['기능삭제',       '', '측정 비대상', ''],
    ]},
    { title: '② 보정전 재개발원가', rows: [
      ['기능점수당 단가', '행안부 고시 기준', `${data.fpUnitPrice.toLocaleString()}원/FP`, ''],
      ['보정전 재개발원가', '= 총 FP × 단가', '', fmt(data.preCorrectionCost) + '원'],
    ]},
    { title: '③ 보정계수', rows: [
      ['① 규모 보정계수',   '= 0.4057×(log(FP)−7.1978)²+0.8878', data.sizeCoeff.toFixed(4), ''],
      ['② 연계복잡성',      data.linkLabel, data.linkCoeff.toFixed(2), ''],
      ['③ 성능 요구수준',   data.perfLabel, data.perfCoeff.toFixed(2), ''],
      ['④ 운영환경 호환성', data.envLabel,  data.envCoeff.toFixed(2), ''],
      ['⑤ 보안성',          data.secLabel,  data.secCoeff.toFixed(2), ''],
      ['총 보정계수',        '① × ② × ③ × ④ × ⑤', data.totalCoeff.toFixed(4), ''],
    ]},
    { title: '④ 재개발비 산정', rows: [
      ['보정후 재개발원가', '= 보정전 원가 × 총 보정계수', '', fmt(data.devCost) + '원'],
      ['직접경비',          '', '', fmt(data.directCost) + '원'],
      ['이윤',              `개발원가의 ${data.profitRate}%`, '', fmt(data.profit) + '원'],
    ]},
  ];

  let row = 4;
  sections.forEach(({ title, rows: sRows }) => {
    ws.mergeCells(row, 2, row, 5);
    applyCell(ws.getCell(row, 2), title, { bg: C.HEADER1, bold: true, align: 'left' });
    ws.getRow(row).height = 18;
    row++;
    sRows.forEach(([label, desc, val, money]) => {
      applyCell(ws.getCell(row, 2), label,  { bold: !!money, align: 'left' });
      applyCell(ws.getCell(row, 3), desc,   { align: 'left', sz: 9 });
      applyCell(ws.getCell(row, 4), val,    { align: 'center' });
      applyCell(ws.getCell(row, 5), money,  { align: 'right', bold: !!money });
      row++;
    });
    row++;
  });

  // 최종 합계
  ws.mergeCells(row, 2, row, 4);
  applyCell(ws.getCell(row, 2), 'SW 개발비 합계 (부가세 별도)',   { bg: C.SUMMARY, bold: true, sz: 12, align: 'left' });
  applyCell(ws.getCell(row, 5), fmt(data.totalDevCost) + '원',   { bg: C.SUMMARY, bold: true, sz: 12, align: 'right' });
  ws.getRow(row).height = 22;
  row++;

  ws.mergeCells(row, 2, row, 4);
  applyCell(ws.getCell(row, 2), 'SW 개발비 합계 (부가세 포함, VAT 10%)', { bg: C.TOTAL, bold: true, sz: 12, align: 'left' });
  applyCell(ws.getCell(row, 5), fmt(data.totalWithVAT) + '원',           { bg: C.TOTAL, bold: true, sz: 12, align: 'right' });
  ws.getRow(row).height = 22;

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }), `${data.projectName}_개발비산출서.xlsx`);
};


// ════════════════════════════════════════════════════════════════
// 범용 시트 단독 내보내기 (탭별 Excel 출력)
// ════════════════════════════════════════════════════════════════
export const exportGenericExcel = async (sheetName, headers, rows, colWidths = [], projectName = '') => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);

  ws.columns = headers.map((h, i) => ({ width: colWidths[i] || 15 }));
  ws.getRow(1).height = 20;

  // 헤더
  headers.forEach((h, ci) => {
    applyCell(ws.getCell(1, ci + 1), h, { bg: C.HEADER1, bold: true });
  });

  // 데이터
  rows.forEach((row, ri) => {
    const r = ri + 2;
    headers.forEach((h, ci) => {
      applyCell(ws.getCell(r, ci + 1), row[h] ?? '', { align: ci < 3 ? 'center' : 'left' });
    });
  });

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }), `${projectName}_${sheetName}.xlsx`);
};
