/* eslint-disable no-unused-vars */
import {
  getLV123Prompt,
  getFPPrompt,
  getParsePrompt,
  getParseImagePrompt,
  getSystemInfoPrompt,
  getSystemInfoImagePrompt,
} from './systemPrompt';

// JSON 추출 함수
const extractJSON = (text) => {
  // 1. ```json ... ``` 블록
  const jsonBlock = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonBlock) return jsonBlock[1].trim();

  // 2. ``` ... ``` 블록
  const codeBlock = text.match(/```\s*([\s\S]*?)\s*```/);
  if (codeBlock) return codeBlock[1].trim();

  // 3. { ... } 추출 (가장 바깥쪽)
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 1).trim();
  }

  throw new Error('JSON을 찾을 수 없습니다. AI 응답: ' + text.substring(0, 300));
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
      errMsg = response.status + ' ' + response.statusText;
    }
    throw new Error(errMsg);
  }

  const data = await response.json();

  if (!data.content || !Array.isArray(data.content)) {
    throw new Error('API 응답 형식 오류: ' + JSON.stringify(data).substring(0, 200));
  }

  const text = data.content
    .map((c) => (c.type === 'text' ? c.text : ''))
    .join('');

  const jsonStr = extractJSON(text);
  return JSON.parse(jsonStr);
};

// 이미지 기반 Claude 호출 (이미지 + 텍스트 프롬프트)
const callClaudeWithImage = async (imageBase64, mediaType, textPrompt) => {
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
            {
              type: 'text',
              text: String(textPrompt),
            },
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
      errMsg = response.status + ' ' + response.statusText;
    }
    throw new Error(errMsg);
  }

  const data = await response.json();

  if (!data.content || !Array.isArray(data.content)) {
    throw new Error('API 응답 형식 오류: ' + JSON.stringify(data).substring(0, 200));
  }

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
    reader.onerror = () => reject(new Error('파일 읽기 실패'));
    reader.readAsDataURL(file);
  });
};

// 이미지 타입 정규화
const normalizeMediaType = (file) => {
  if (file.type === 'image/jpg' || file.name.toLowerCase().endsWith('.jpg')) {
    return 'image/jpeg';
  }
  return file.type || 'image/png';
};

// 이미지 파일 여부 확인
const isImageFile = (file) => {
  return file && (
    file.type === 'image/png' ||
    file.type === 'image/jpeg' ||
    file.type === 'image/jpg' ||
    file.name.toLowerCase().endsWith('.png') ||
    file.name.toLowerCase().endsWith('.jpg') ||
    file.name.toLowerCase().endsWith('.jpeg')
  );
};

// LV1~LV3 기능목록 생성
export const generateFunctions = async (systemInfo, keyword) => {
  const prompt = getLV123Prompt(systemInfo, keyword);
  const result = await callClaude(prompt);
  return result.functions || [];
};

// FP 산정표 자동완성 (20개씩 나눠서 처리)
export const generateFPList = async (functions) => {
  const chunkSize = 20;

  if (functions.length <= chunkSize) {
    const prompt = getFPPrompt(functions);
    const result = await callClaude(prompt);
    return result.fpList || [];
  }

  let allResults = [];
  for (let i = 0; i < functions.length; i += chunkSize) {
    const chunk = functions.slice(i, i + chunkSize);
    const prompt = getFPPrompt(chunk);
    const result = await callClaude(prompt);
    allResults = allResults.concat(result.fpList || []);
  }
  return allResults;
};

// 기능정의서 파싱 (텍스트 or 이미지)
export const parseDocument = async (text, file) => {
  if (isImageFile(file)) {
    const base64 = await fileToBase64(file);
    const mediaType = normalizeMediaType(file);
    // 이미지 전용 프롬프트 사용 (더 정확한 표 인식)
    const prompt = getParseImagePrompt();
    const result = await callClaudeWithImage(base64, mediaType, prompt);
    return result.functions || [];
  }

  const prompt = getParsePrompt(text);
  const result = await callClaude(prompt);
  return result.functions || [];
};

// 시스템 개요 파싱 (텍스트 or 이미지)
export const parseSystemInfo = async (text, file) => {
  if (isImageFile(file)) {
    const base64 = await fileToBase64(file);
    const mediaType = normalizeMediaType(file);
    // 이미지 전용 프롬프트 사용
    const prompt = getSystemInfoImagePrompt();
    const result = await callClaudeWithImage(base64, mediaType, prompt);
    return result;
  }

  const prompt = getSystemInfoPrompt(text);
  const result = await callClaude(prompt);
  return result;
};
