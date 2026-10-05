// 빌드 산출물 검사 (Node 전용, 브라우저 번들 미포함).
// CRA는 .cjs 같은 비표준 확장자를 정적 파일(URL 문자열)로 복사하므로,
// 소스 모듈이 build/static/media 에 떨어지면 브라우저에서 import 결과가 문자열이 된다.
const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '..', 'build');
const mediaDir = path.join(buildDir, 'static', 'media');
const jsDir = path.join(buildDir, 'static', 'js');
const problems = [];

if (fs.existsSync(mediaDir)) {
  fs.readdirSync(mediaDir)
    .filter(name => /\.(cjs|js)$/.test(name))
    .forEach(name => problems.push(`build/static/media/${name}: 소스 모듈이 정적 파일로 복사됨`));
}

if (fs.existsSync(jsDir)) {
  fs.readdirSync(jsDir)
    .filter(name => /^main\..*\.js$/.test(name))
    .forEach(name => {
      const code = fs.readFileSync(path.join(jsDir, name), 'utf8');
      const hits = code.match(/\/static\/media\/[\w.-]+\.(?:cjs|js)\b/g);
      if (hits) problems.push(`${name}: 번들에 모듈 파일 URL 문자열 포함 (${[...new Set(hits)].join(', ')})`);
    });
} else {
  problems.push('build/static/js 가 없습니다. 먼저 빌드하세요.');
}

if (problems.length) {
  console.error('[check-build-assets] 실패');
  problems.forEach(problem => console.error(` - ${problem}`));
  process.exit(1);
}
console.log('[check-build-assets] OK: 소스 모듈이 정적 에셋으로 복사되지 않았습니다.');
