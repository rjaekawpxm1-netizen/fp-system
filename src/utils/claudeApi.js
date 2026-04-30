/* eslint-disable no-unused-vars */
import {
  getLV123Prompt,
  getFPPrompt,
  getParsePrompt,
  getSystemInfoPrompt,
} from './systemPrompt';

// JSON 추출 함수
const extractJSON = (text) => {
  // 1. ```json ... ``` 블록
  const jsonBlock = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonBlock) return jsonBlock[1].trim();

  // 2. ``` ... ``` 블록
  const codeBlock = text.match(/```\s*([\s\S]*?)\s*```/);
  if (codeBlock) return codeBlock[1].trim();

  // 3. { ... } 추출
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1) return text.slice(start, end + 1).trim();

  throw new Error('JSON을 찾을 수 없습니다: ' + text.substring(0, 200));
};

// 텍스트 기반 Claude 호출
const callClaude = async (content) => {
  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: String(content) }],
    }),
  });

  if (!response.ok) {
    let errMsg = 'API 호출 실패';
    try {
      const err = await response.json();
      errMsg = err?.error?.message || err?.error || JSON.stringify(err);
    } catch (e) {
      errMsg = await response.text();
    }
    throw new Error(errMsg);
  }

  const data = await response.json();

  if (!data.content || !Array.isArray(data.content)) {
    throw new Error('API 응답 형식 오류: ' + JSON.stringify(data));
  }

  const text = data.content
    .map((c) => (c.type === 'text' ? c.text : ''))
    .join('');

  const jsonStr = extractJSON(text);
  return JSON.parse(jsonStr);
};

// 이미지 기반 Claude 호출
const callClaudeWithImage = async (prompt, imageBase64, mediaType) => {
  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageBase64,
              },
            },
            { type: 'text', text: String(prompt) },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    let errMsg = 'API 호출 실패';
    try {
      const err = await response.json();
      errMsg = err?.error?.message || err?.error || JSON.stringify(err);
    } catch (e) {
      errMsg = await response.text();
    }
    throw new Error(errMsg);
  }

  const data = await response.json();
  const text = data.content
    .map((c) => (c.type === 'text' ? c.text : ''))
    .join('');

  const jsonStr = extractJSON(text);
  return JSON.parse(jsonStr);
};

// 파일을 base64로 변환
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// LV1~LV3 기능목록 생성
export const generateFunctions = async (systemInfo, keyword) => {
  const prompt = getLV123Prompt(systemInfo, keyword);
  const result = await callClaude(prompt);
  return result.functions || [];
};

// FP 산정표 자동완성
export const generateFPList = async (functions) => {
  // 함수 목록이 너무 길면 나눠서 처리
  const chunkSize = 20;
  if (functions.length <= chunkSize) {
    const prompt = getFPPrompt(functions);
    const result = await callClaude(prompt);
    return result.fpList || [];
  }

  // 20개씩 나눠서 처리
  let allResults = [];
  for (let i = 0; i < functions.length; i += chunkSize) {
    const chunk = functions.slice(i, i + chunkSize);
    const prompt = getFPPrompt(chunk);
    const result = await callClaude(prompt);
    allResults = allResults.concat(result.fpList || []);
  }
  return allResults;
};

// 기능정의서 파싱
export const parseDocument = async (text, file) => {
  if (file && (file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/jpg')) {
    const base64 = await fileToBase64(file);
    const prompt = getParsePrompt('위 이미지는 기능정의서입니다. 이미지에서 LV1, LV2, LV3, 기능정의를 모두 추출해주세요.');
    const result = await callClaudeWithImage(prompt, base64, file.type === 'image/jpg' ? 'image/jpeg' : file.type);
    return result.functions || [];
  }
  const prompt = getParsePrompt(text);
  const result = await callClaude(prompt);
  return result.functions || [];
};

// 시스템 개요 파싱
export const parseSystemInfo = async (text, file) => {
  if (file && (file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/jpg')) {
    const base64 = await fileToBase64(file);
    const prompt = getSystemInfoPrompt('위 이미지는 시스템 개요 문서입니다. 시스템명, 개요, 주요기능, 관련기관, 키워드를 추출해주세요.');
    const result = await callClaudeWithImage(prompt, base64, file.type === 'image/jpg' ? 'image/jpeg' : file.type);
    return result;
  }
  const prompt = getSystemInfoPrompt(text);
  const result = await callClaude(prompt);
  return result;
};