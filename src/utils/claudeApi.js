/* eslint-disable no-unused-vars */
import {
  getLV123Prompt,
  getFPPrompt,
  getParsePrompt,
  getParseImagePrompt,
  getSystemInfoPrompt,
  getSystemInfoImagePrompt,
} from './systemPrompt';

// JSON 안전 파싱 (잘림 방지)
const safeParseJSON = (text) => {
  // 마크다운 제거
  let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();

  // 1차 시도
  try { return JSON.parse(clean); } catch (e1) {}

  // 2차: 마지막 완전한 객체까지
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start !== -1 && end !== -1) {
    try { return JSON.parse(clean.slice(start, end + 1)); } catch (e2) {}

    // 3차: 배열 마지막 완전한 항목까지
    const lastComma = clean.lastIndexOf('},');
    if (lastComma > 0) {
      // functions 배열인지 확인
      const prefix = clean.slice(start, lastComma + 1);
      // 어떤 키인지 찾기
      const keyMatch = prefix.match(/"(\w+)"\s*:\s*\[/);
      if (keyMatch) {
        const fixed = `{"${keyMatch[1]}":[${prefix.split('[').slice(1).join('[').slice(0, lastComma - prefix.indexOf('['))}]}`;
        try { return JSON.parse(fixed); } catch (e3) {}
      }
      // 단순 배열 복구
      const arrStart = clean.indexOf('[');
      if (arrStart !== -1) {
        const fixed2 = clean.slice(0, lastComma + 1) + ']}';
        try { return JSON.parse(fixed2); } catch (e4) {}
      }
    }
  }
  throw new Error('JSON 파싱 실패: ' + text.slice(0, 100));
};

// 텍스트 API 호출
const callClaude = async (content, maxTokens = 2000) => {
  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      max_tokens: maxTokens,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const status = response.status;
    if (status === 504) throw new Error('504: 요청 시간 초과. 파일이 너무 크거나 텍스트가 길 수 있습니다.');
    throw new Error(err.error?.message || `API 오류 (${status})`);
  }

  const data = await response.json();
  if (data.error) throw new Error(data.error);
  const text = data.content?.map((c) => (c.type === 'text' ? c.text : '')).join('') || '';
  return safeParseJSON(text);
};

// 이미지 API 호출
const callClaudeWithImage = async (textPrompt, imageFile, maxTokens = 2000) => {
  const base64 = await fileToBase64(imageFile);
  const mediaType = imageFile.type || 'image/jpeg';

  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      max_tokens: maxTokens,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: textPrompt },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 504) throw new Error('504: 이미지 처리 시간 초과. 이미지를 작게 줄여서 다시 시도하세요.');
    throw new Error(`이미지 API 오류 (${status})`);
  }

  const data = await response.json();
  if (data.error) throw new Error(data.error);
  const text = data.content?.map((c) => (c.type === 'text' ? c.text : '')).join('') || '';
  return safeParseJSON(text);
};

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result.split(',')[1]);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

// 텍스트 길이 제한 (토큰 절약)
const truncateText = (text, maxLen = 3000) => {
  if (!text || text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '\n...(이하 생략)';
};

// ============================================================
// 기능목록 생성 (2000토큰으로 줄여서 rate limit 회피)
// ============================================================
export const generateFunctions = async (systemInfo, keyword) => {
  const prompt = getLV123Prompt(systemInfo, keyword);
  const result = await callClaude(prompt, 2000);
  return result.functions || [];
};

// ============================================================
// FP 산정 (청크당 2000)
// ============================================================
export const generateFPList = async (functions) => {
  const CHUNK = 25;
  if (functions.length <= CHUNK) {
    const prompt = getFPPrompt(functions);
    const result = await callClaude(prompt, 2000);
    return result.fpList || [];
  }

  let allFP = [];
  for (let i = 0; i < functions.length; i += CHUNK) {
    const chunk = functions.slice(i, i + CHUNK);
    const prompt = getFPPrompt(chunk);
    const result = await callClaude(prompt, 2000);
    allFP = [...allFP, ...(result.fpList || [])];
  }
  return allFP;
};

// ============================================================
// 기능정의서 파싱 (청크당 4000)
// ============================================================
export const parseDocument = async (text, imageFile = null) => {
  if (imageFile) {
    const prompt = getParseImagePrompt();
    const result = await callClaudeWithImage(prompt, imageFile, 2000);
    return result.functions || [];
  }

  const MAX_CHUNK = 2000;
  if (!text || text.length === 0) throw new Error('파일에서 텍스트를 추출할 수 없습니다.');

  if (text.length <= MAX_CHUNK) {
    const prompt = getParsePrompt(truncateText(text, MAX_CHUNK));
    const result = await callClaude(prompt, 2000);
    return result.functions || [];
  }

  // 긴 문서: 청크별 파싱
  let allFunctions = [];
  const chunks = [];
  for (let i = 0; i < text.length; i += MAX_CHUNK) {
    chunks.push(text.slice(i, i + MAX_CHUNK));
  }

  for (const chunk of chunks.slice(0, 3)) {
    try {
      const prompt = getParsePrompt(chunk);
      const result = await callClaude(prompt, 2000);
      allFunctions = [...allFunctions, ...(result.functions || [])];
    } catch (e) {
      console.warn('청크 파싱 실패:', e.message);
    }
  }

  const seen = new Set();
  return allFunctions.filter(f => {
    const key = `${f.lv1}|${f.lv2}|${f.lv3}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// ============================================================
// 시스템 개요 파싱 (간단 → 1000)
// ============================================================
export const parseSystemInfo = async (text, imageFile = null) => {
  if (imageFile) {
    const prompt = getSystemInfoImagePrompt();
    const result = await callClaudeWithImage(prompt, imageFile, 1000);
    return result;
  }
  const prompt = getSystemInfoPrompt(truncateText(text, 2000));
  const result = await callClaude(prompt, 1000);
  return result;
};

// ============================================================
// 텍스트 반환 (JSON 아닌 순수 텍스트 응답용)
// ============================================================
export const callClaudeText = async (content, maxTokens = 2000) => {
  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      max_tokens: maxTokens,
      messages: [{ role: 'user', content }],
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API 오류 (${response.status})`);
  }
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.content?.map(c => c.type === 'text' ? c.text : '').join('') || '';
};

// ============================================================
// ISP 정보화전략계획서 섹션 생성
// ============================================================
import { getISPDraftPrompt } from './systemPrompt';

export const generateISPSection = async (section, rfpText, systemName, overview, functions) => {
  const prompt = getISPDraftPrompt(section, rfpText, systemName, overview, functions);
  const text = await callClaudeText(prompt, 2000);
  // JSON 파싱
  let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start !== -1 && end !== -1) {
    try { return JSON.parse(clean.slice(start, end + 1)); } catch (e) {}
  }
  throw new Error('ISP 섹션 파싱 실패');
};

// ============================================================
// 대용량 RFP 청크 처리 (3000자 제한 우회)
// ============================================================
export const parseRFPLarge = async (text) => {
  const CHUNK = 2500;
  const chunks = [];
  for (let i = 0; i < Math.min(text.length, 15000); i += CHUNK) {
    chunks.push(text.slice(i, i + CHUNK));
  }

  let allFunctions = [];
  let systemInfo = {};

  for (let i = 0; i < chunks.length; i++) {
    try {
      const isFirst = i === 0;
      const prompt = isFirst
        ? `SW사업 BA전문가. RFP에서 기능요구사항만 추출. JSON만.\n${chunks[i]}\n{"systemName":"","overview":"","functions":[{"lv1":"","lv2":"","lv3":"","definition":""}]}`
        : `SW사업 BA전문가. RFP 추가 청크에서 기능요구사항 추출. 중복제외. JSON만.\n${chunks[i]}\n{"functions":[{"lv1":"","lv2":"","lv3":"","definition":""}]}`;

      const text2 = await callClaudeText(prompt, 2000);
      let clean = text2.replace(/```json/g, '').replace(/```/g, '').trim();
      const s = clean.indexOf('{'), e2 = clean.lastIndexOf('}');
      if (s !== -1 && e2 !== -1) {
        const parsed = JSON.parse(clean.slice(s, e2 + 1));
        if (isFirst) {
          systemInfo = { systemName: parsed.systemName || '', overview: parsed.overview || '' };
        }
        allFunctions = [...allFunctions, ...(parsed.functions || [])];
      }
    } catch (err) {
      console.warn(`청크 ${i} 파싱 실패:`, err.message);
    }
  }

  // 중복 제거
  const seen = new Set();
  const deduped = allFunctions
    .filter(f => f.lv1 && f.lv2 && f.lv3)
    .filter(f => {
      const k = `${f.lv1}|${f.lv2}|${f.lv3}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

  return { ...systemInfo, functions: deduped };
};
