import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { extractProjectInfo, parseDocumentFunctions } from '../utils/claudeApi';
import { reconstructPdfLines, detectFunctionListPattern, combineRfpFiles } from '../utils/textExtract';
import { REUSE_TYPE } from '../utils/fpConstants';
import { detectFunctionColumns, parseFunctionRows, parseManualColumnMapping } from '../utils/excelFunctionParser';
import { getAuthHeaders } from '../utils/supabase';

export const useFileIngestion = ({
  id,
  project,
  upgradeMode,
  setUpgradeMode,
  saveSettings,
  functions,
  setFunctions,
  saveProject,
  uploadedFiles,
  setUploadedFiles,
  xlsxFunctions,
  setXlsxFunctions,
  setTab,
  setLoading,
  setLoadingMsg,
  systemName,
  setSystemName,
  systemOverview,
  setSystemOverview,
  setRfpText,
}) => {
  // ── PDF 텍스트 추출 ──────────────────────────────────────────
  const extractPdfText = async (file) => {
    const pdfjsLib = await import('pdfjs-dist');
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
      ).toString();
    } catch {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    }
    const ab = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: ab }).promise;

    // 텍스트 레이어 추출 + 페이지별 텍스트량 기록 (혼합 PDF 판별용)
    let text = '';
    const pageTextLen = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const lineText = reconstructPdfLines(content.items);
      pageTextLen.push(lineText.replace(/\s/g, '').length);
      text += lineText + '\n';
    }

    // [개선] 스캔 판별: 전체<100자(완전 스캔)뿐 아니라,
    // 텍스트가 거의 없는 페이지 비율이 높은 '혼합 PDF'(표지·목차만 텍스트,
    // 본문은 스캔 이미지)도 OCR 대상으로 본다. 기존엔 본문을 통째로 놓쳤다.
    const totalChars = text.replace(/\s/g, '').length;
    const emptyPages = pageTextLen.filter(n => n < 30).length;
    const isFullyScanned = totalChars < 100;
    const isMostlyScanned = pdf.numPages >= 2 && emptyPages / pdf.numPages >= 0.5;
    if (isFullyScanned || isMostlyScanned) {
      setLoadingMsg('스캔 PDF 감지 — Vision OCR 처리 중...');
      const ocrTexts = [];
      // [개선] 5 → 15페이지. 요구사항이 뒤쪽에 있는 RFP 대응.
      const maxPages = Math.min(pdf.numPages, 15);
      for (let i = 1; i <= maxPages; i++) {
        // 혼합 PDF면 텍스트가 충분한 페이지는 OCR 건너뛰고 기존 텍스트 사용 (비용 절감)
        if (isMostlyScanned && !isFullyScanned && pageTextLen[i - 1] >= 30) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          ocrTexts.push(`[${i}페이지]\n${reconstructPdfLines(content.items)}`);
          continue;
        }
        setLoadingMsg(`Vision OCR 처리 중... (${i}/${maxPages}페이지)`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;

        // canvas → base64
        const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];

        // Claude Vision API 호출
        try {
          const authHeaders = await getAuthHeaders();
          const res = await fetch('/api/claude', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Project-Id': id, ...authHeaders },
            body: JSON.stringify({
              model: 'claude-sonnet-4-5',
              max_tokens: 4000,
              messages: [{
                role: 'user',
                content: [
                  { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
                  { type: 'text', text: '이 문서 이미지에서 텍스트를 모두 추출해주세요. 표가 있다면 표 구조도 유지해주세요. 텍스트만 출력하세요.' }
                ]
              }]
            })
          });
          const data = await res.json();
          const pageText = data.content?.map(c => c.type === 'text' ? c.text : '').join('') || '';
          ocrTexts.push(`[${i}페이지]\n${pageText}`);
        } catch (e) {
          console.warn(`${i}페이지 OCR 실패:`, e.message);
        }
      }
      text = ocrTexts.join('\n\n');
      if (maxPages < pdf.numPages) {
        text += `\n\n[참고: 총 ${pdf.numPages}페이지 중 ${maxPages}페이지까지 처리됨]`;
        alert(`⚠ 스캔 PDF OCR은 ${maxPages}페이지까지만 처리됩니다.\n(총 ${pdf.numPages}페이지 — 이후 내용은 분석에서 제외됨)\n전체가 필요하면 텍스트 레이어가 있는 PDF로 변환해 업로드하세요.`);
      }
    }
    return text;
  };

  // ── 파일 읽기 ────────────────────────────────────────────────
  const readFile = async (file) => {
    if (file.name.endsWith('.pdf')) return await extractPdfText(file);
    if (file.name.endsWith('.docx')) {
      const ab = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: ab });
      return result.value;
    }
    if (file.name.endsWith('.txt')) return await file.text();
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      // xlsx는 기능정의서 직접 파싱
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      // 병합셀 처리
      const merges = ws['!merges'] || [];
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      const cellMap = {};
      for (let R = range.s.r; R <= range.e.r; R++)
        for (let C = range.s.c; C <= range.e.c; C++) {
          const addr = XLSX.utils.encode_cell({r:R,c:C});
          cellMap[`${R}_${C}`] = ws[addr]?.v ?? null;
        }
      for (const m of merges) {
        const v = cellMap[`${m.s.r}_${m.s.c}`];
        for (let R = m.s.r; R <= m.e.r; R++)
          for (let C = m.s.c; C <= m.e.c; C++)
            cellMap[`${R}_${C}`] = v;
      }
      const totalCols = range.e.c - range.s.c + 1;
      const rows = [];
      for (let R = range.s.r; R <= range.e.r; R++) {
        rows.push(Array.from({ length: totalCols }, (_, offset) => cellMap[`${R}_${range.s.c + offset}`]));
      }
      const detected = detectFunctionColumns(rows);
      let columns = detected.columns;
      let headerRow = detected.headerRow;
      if (detected.missing.length > 0) {
        const manual = window.prompt(
          `LV1/LV2/LV3 헤더를 자동으로 찾지 못했습니다 (${detected.missing.join(', ')}).\n` +
          'LV1, LV2, LV3, 정의 열 문자를 쉼표로 입력하세요. 예: B,C,D,E'
        );
        if (manual == null) return { isXlsx: true, cancelled: true, functions: [] };
        columns = parseManualColumnMapping(manual);
        headerRow = -1;
        if (!columns) throw new Error('열 지정 형식이 올바르지 않습니다. 예: B,C,D,E');
      }
      const parsed = parseFunctionRows(rows, columns, headerRow);
      const sample = parsed.functions.slice(0, 3)
        .map(f => `${f.lv1} > ${f.lv2} > ${f.lv3}`)
        .join('\n');
      const confirmed = window.confirm(
        `기능목록 파싱 미리보기\n\n${sample || '(유효 행 없음)'}\n\n` +
        `반영 ${parsed.functions.length}개 / 누락 ${parsed.stats.incompleteRows}개 (${Math.round(parsed.stats.missingRate * 100)}%) / 중복 ${parsed.stats.duplicateRows}개\n\n이 결과를 반영할까요?`
      );
      return { isXlsx: true, cancelled: !confirmed, functions: confirmed ? parsed.functions : [] };
    }
    throw new Error('HWP는 PDF로 변환 후 업로드하세요.');
  };

  // ── 파일 업로드 핸들러 ───────────────────────────────────────
  // ── 파일 추가 핸들러 (다중 파일 지원) ──────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setLoading(true);
    setLoadingMsg(`"${file.name}" 읽는 중...`);
    try {
      const result = await readFile(file);

      // xlsx 기능정의서 → xlsxFunctions에 저장
      if (result?.isXlsx) {
        if (result.cancelled) return;
        if (result.functions.length === 0) {
          alert('기능 데이터를 찾을 수 없습니다. LV1/LV2/LV3 컬럼이 있는지 확인하세요.');
          return;
        }
        const newXlsx = [...xlsxFunctions, ...result.functions];
        setXlsxFunctions(newXlsx);

        // xlsx도 파일 목록에 표시 (이름만, 텍스트 없이)
        // 기능목록을 텍스트로 변환해서 rfpText에도 포함 (기능 생성 시 활용)
        const xlsxAsText = result.functions
          .map(f => `${f.lv1} > ${f.lv2} > ${f.lv3}: ${f.definition || ''}`)
          .join('\n');
        const xlsxEntry = {
          name: file.name,
          text: xlsxAsText.slice(0, 5000), // xlsx 기능목록 텍스트로 변환
          type: 'xlsx',
          size: Math.round(file.size / 1024),
          addedAt: new Date().toISOString(),
          isXlsx: true,
          functionCount: result.functions.length,
        };
        const existingIdx = uploadedFiles.findIndex(f => f.name === file.name);
        const newUploadedFiles = existingIdx >= 0
          ? uploadedFiles.map((f,i) => i===existingIdx ? xlsxEntry : f)
          : [...uploadedFiles, xlsxEntry];
        setUploadedFiles(newUploadedFiles);
        saveProject({uploadedFiles: newUploadedFiles, xlsxFunctions: newXlsx});

        const isUpgrade = upgradeMode; // 버튼으로 이미 선택된 모드 사용
        const withId = result.functions.map((f,i)=>({
          ...f, id:Date.now()+i,
          reuseType: isUpgrade ? REUSE_TYPE.REUSED : REUSE_TYPE.NEW
        }));
        const base = isUpgrade ? functions : [];
        const merged = [...base, ...withId];
        const seen = new Set();
        const deduped = merged.filter(f=>{
          const k = `${f.lv1}|${f.lv2}|${f.lv3}`;
          if(seen.has(k)) return false;
          seen.add(k); return true;
        });
        setFunctions(deduped);
        if (isUpgrade) { setUpgradeMode(true); saveSettings({ upgradeMode: true }); }
        saveProject({functions: deduped, xlsxFunctions: newXlsx});
        setTab('functions'); // 탭 먼저 전환
        setTimeout(()=>{
          if (isUpgrade) {
            alert(`✅ 고도화 모드 적용!\n${result.functions.length}개 기능이 재사용으로 추가됐습니다 (총 ${deduped.length}개)\nFP 산정 시 신규 기능만 "신규개발"로 변경하세요.`);
          } else {
            // 신규 모드인데 기존 기능목록을 올렸다 → 고도화일 가능성 안내
            const toUpgrade = window.confirm(
              `기능정의서 ${withId.length}개를 불러왔습니다.\n\n` +
              `기존 시스템의 기능목록이라면 "고도화 사업"일 가능성이 높습니다.\n` +
              `지금 고도화 모드로 전환할까요?\n\n` +
              `[확인] 고도화 모드 ON — 이 기능들을 '재사용'으로 표시하고,\n` +
              `        이후 RFP로 신규 기능만 추가/분류합니다.\n` +
              `[취소] 신규 모드 유지 — 이 기능들을 신규 목록으로 사용합니다.`
            );
            if (toUpgrade) {
              setUpgradeMode(true);
              saveSettings({ upgradeMode: true });
              const remarked = deduped.map(f => ({...f, reuseType: REUSE_TYPE.REUSED}));
              setFunctions(remarked);
              saveProject({functions: remarked});
              alert('✅ 고도화 모드로 전환했습니다. 이제 RFP를 올리고 "기능 생성"을 누르면 신규 기능만 추가됩니다.');
            }
          }
        }, 100);
        return;
      }

      // 텍스트 문서 → uploadedFiles 배열에 추가
      const text = result;

      // [D1] 기능목록 문서 감지 — 기존 기능목록을 PDF/DOCX로 넣으면
      // RFP 텍스트로 삼켜져 고도화가 무효화되는 사고 방지
      const detection = detectFunctionListPattern(text);
      if (detection.isFunctionList) {
        const asFunc = window.confirm(
          `"${file.name}"이(가) 기능목록 문서로 보입니다.\n\n` +
          `[확인] 기능정의서로 파싱 → 기능목록에 ${upgradeMode ? "'재사용'으로 추가 (고도화)" : "추가"}\n` +
          `[취소] RFP 텍스트로 사용 (요구사항 추출용)`
        );
        if (asFunc) {
          setLoadingMsg('기능정의서 파싱 중... (문서 전체)');
          const parsed = await parseDocumentFunctions(text);
          if (parsed.length === 0) {
            alert('기능을 추출하지 못했습니다. RFP 텍스트로 사용하려면 다시 업로드 후 [취소]를 선택하세요.');
            return;
          }
          const withId = parsed.map((f, i) => ({
            ...f, id: Date.now() + i,
            reuseType: upgradeMode ? REUSE_TYPE.REUSED : REUSE_TYPE.NEW,
          }));
          const base = upgradeMode ? functions : [];
          const seen = new Set();
          const merged = [...base, ...withId].filter(f => {
            const k = `${f.lv1}|${f.lv2}|${f.lv3}`;
            if (seen.has(k)) return false;
            seen.add(k); return true;
          });
          setFunctions(merged);
          saveProject({ functions: merged });
          alert(upgradeMode
            ? `✅ 고도화 모드 적용!\n"${file.name}"에서 ${withId.length}개 기능을 재사용으로 추가했습니다 (총 ${merged.length}개)`
            : `✅ 기능정의서 파싱 완료!\n${withId.length}개 기능 추출됐습니다 (총 ${merged.length}개)`);
          return;
        }
      }

      const fileEntry = {
        name: file.name,
        text,
        type: file.name.split('.').pop().toLowerCase(),
        size: Math.round(text.length / 1000),
        addedAt: new Date().toISOString(),
      };

      // 같은 이름 파일이면 교체, 아니면 추가
      const existing = uploadedFiles.findIndex(f => f.name === file.name);
      const newFiles = existing >= 0
        ? uploadedFiles.map((f,i) => i===existing ? fileEntry : f)
        : [...uploadedFiles, fileEntry];

      setUploadedFiles(newFiles);

      // 합산 텍스트 업데이트
      const rfpFull = combineRfpFiles(newFiles, 150000);
      setRfpText(rfpFull);
      saveProject({uploadedFiles: newFiles, rfpText: rfpFull});

      // 첫 파일이면 시스템 정보 자동 추출
      if (newFiles.length === 1 || !systemName) {
        setLoadingMsg('시스템 정보 추출 중...');
        const info = await extractProjectInfo(text.slice(0,3000));
        if (info.systemName && !systemName) { setSystemName(info.systemName); saveProject({systemName:info.systemName}); }
        if (info.systemOverview && !systemOverview) { setSystemOverview(info.systemOverview); saveProject({systemOverview:info.systemOverview}); }
      }

      alert(`✅ "${file.name}" 추가 완료!\n총 ${newFiles.length}개 파일 업로드됨\n\n"기능 생성" 버튼으로 전체 파일을 종합해서 기능을 생성하세요.`);
    } catch (err) {
      alert('파일 읽기 오류: ' + err.message);
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  // 파일 삭제
  const handleRemoveFile = (fileName) => {
    const newFiles = uploadedFiles.filter(f => f.name !== fileName);
    const rfpFull = combineRfpFiles(newFiles, 150000);
    setUploadedFiles(newFiles);
    setRfpText(rfpFull);
    saveProject({uploadedFiles: newFiles, rfpText: rfpFull});
  };

  return { handleFileUpload, handleRemoveFile };
};
