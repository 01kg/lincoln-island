const baseUrl = process.argv[2] ?? process.env.DEV_SERVER_URL ?? 'http://127.0.0.1:5173';
const expectedBuildId = process.env.VITE_BUILD_ID ?? 'source-local';

async function fetchText(path, label) {
  const url = new URL(path, baseUrl);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${label} 返回 HTTP ${response.status}: ${url}`);
  }
  if (!response.headers.get('cache-control')?.includes('no-store')) {
    throw new Error(`${label} 未返回 Cache-Control: no-store: ${url}`);
  }
  return response.text();
}

function requireText(text, expected, label) {
  if (!text.includes(expected)) {
    throw new Error(`${label} 未包含预期内容：${expected}`);
  }
}

try {
  const rootHtml = await fetchText('/', '根 HTML');
  requireText(rootHtml, `name="lincoln-build-id" content="${expectedBuildId}"`, '根 HTML 的 build id');
  const mainModule = await fetchText('/src/main.tsx', '入口模块');
  const appModule = await fetchText('/src/App.tsx', '应用模块');
  const shellModule = await fetchText('/src/ui/ReadingCompanionShell.tsx', '阅读界面模块');
  const buildInfoModule = await fetchText('/src/buildInfo.ts', '构建标识模块');
  requireText(appModule, 'buildId', '应用模块的 build id 传递');
  requireText(shellModule, '技术诊断 · 灰盒参照', '阅读界面的静态 HUD');
  requireText(shellModule, '"data-testid": "build-id"', '阅读界面的 build id 标记');
  requireText(buildInfoModule, '__LINCOLN_BUILD_ID__', '构建标识模块的 Vite 注入标记');
  const dependencyReferences = [
    ...mainModule.matchAll(/['"]((?:\/@fs\/[^'"]+|\/node_modules\/\.vite\/deps\/)[^'"]+\.js(?:\?[^'"]*)?)['"]/g),
  ].map((match) => match[1]);

  if (dependencyReferences.length === 0) {
    throw new Error('入口模块没有发现 Vite 预构建依赖引用');
  }

  for (const dependencyReference of new Set(dependencyReferences)) {
    await fetchText(dependencyReference, '预构建依赖');
  }
  console.log(`dev smoke OK: build=${expectedBuildId}, root, HUD modules, /src/main.tsx, ${[...new Set(dependencyReferences)].join(', ')}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
