const baseUrl = process.argv[2] ?? process.env.DEV_SERVER_URL ?? 'http://127.0.0.1:5173';

async function fetchText(path, label) {
  const url = new URL(path, baseUrl);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${label} 返回 HTTP ${response.status}: ${url}`);
  }
  return response.text();
}

try {
  await fetchText('/', '根 HTML');
  const mainModule = await fetchText('/src/main.tsx', '入口模块');
  const dependencyReferences = [
    ...mainModule.matchAll(/['"]((?:\/@fs\/[^'"]+|\/node_modules\/\.vite\/deps\/)[^'"]+\.js(?:\?[^'"]*)?)['"]/g),
  ].map((match) => match[1]);

  if (dependencyReferences.length === 0) {
    throw new Error('入口模块没有发现 Vite 预构建依赖引用');
  }

  for (const dependencyReference of new Set(dependencyReferences)) {
    await fetchText(dependencyReference, '预构建依赖');
  }
  console.log(`dev smoke OK: root, /src/main.tsx, ${[...new Set(dependencyReferences)].join(', ')}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
