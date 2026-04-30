/* eslint-disable no-unused-vars */
import {
  getLV123Prompt,
  getFPPrompt,
  getParsePrompt,
  getSystemInfoPrompt,
} from './systemPrompt';

const callClaude = async (content) => {
  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: String(content) }],
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err?.error || JSON.stringify(err));
  }

  const data = await response.json();
  const text = data.content
    .map((c) => (c.type === 'text' ? c.text : ''))
    .join('');

  // JSON 블록 추출
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
                    text.match(/```\s*([\s\S]*?)\s*```/) ||
                    text.match(/(\{[\s\S]*\})/);

  if (!jsonMatch) {
    throw new Error('AI 응답에서 JSON을 찾을 수 없습니다.');
  }

  const clean = jsonMatch[1] || jsonMatch[0];
  return JSON.parse(clean.trim());
};

// 이미지를 base64로 변환
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// 이미지 파일 Claude API로 전송
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
    const err = await response.json();
    throw new Error(err?.error || JSON.stringify(err));
  }

  const data = await response.json();
  const text = data.content
    .map((c) => (c.type === 'text' ? c.text : ''))
    .join('');

  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
                    text.match(/```\s*([\s\S]*?)\s*```/) ||
                    text.match(/(\{[\s\S]*\})/);

  if (!jsonMatch) throw new Error('JSON을 찾을 수 없습니다.');
  return JSON.parse((jsonMatch[1] || jsonMatch[0]).trim());
};

export const generateFunctions = async (systemInfo, keyword) => {
  const prompt = getLV123Prompt(systemInfo, keyword);
  const result = await callClaude(prompt);
  return result.functions || [];
};

export const generateFPList = async (functions) => {
  const prompt = getFPPrompt(functions);
  const result = await callClaude(prompt);
  return result.fpList || [];
};

export const parseDocument = async (text, file) => {
  // PNG/JPG는 이미지로 직접 전송
  if (file && (file.type === 'image/png' || file.type === 'image/jpeg')) {
    const base64 = await fileToBase64(file);
    const prompt = getParsePrompt('이미지에서 LV1, LV2, LV3, 기능정의를 추출해주세요.');
    const result = await callClaudeWithImage(prompt, base64, file.type);
    return result.functions || [];
  }
  const prompt = getParsePrompt(text);
  const result = await callClaude(prompt);
  return result.functions || [];
};

export const parseSystemInfo = async (text, file) => {
  // PNG/JPG는 이미지로 직접 전송
  if (file && (file.type === 'image/png' || file.type === 'image/jpeg')) {
    const base64 = await fileToBase64(file);
    const prompt = getSystemInfoPrompt('이미지에서 시스템 정보를 추출해주세요.');
    const result = await callClaudeWithImage(prompt, base64, file.type);
    return result;
  }
  const prompt = getSystemInfoPrompt(text);
  const result = await callClaude(prompt);
  return result;
};