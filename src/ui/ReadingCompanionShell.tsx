import type { RefObject } from 'react';

interface ReadingCompanionShellProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  sceneError: string | null;
}

export function ReadingCompanionShell({ canvasRef, sceneError }: ReadingCompanionShellProps) {
  return (
    <main className="reading-companion" aria-label="Lincoln Island 阅读伴侣技术纵切">
      <div className="world-view">
        <canvas ref={canvasRef} aria-label="林肯岛灰盒三维场景" />
      </div>
      <header className="product-header">
        <p className="eyebrow">LINCOLN ISLAND</p>
        <h1>《神秘岛》阅读伴侣</h1>
        <p className="status">技术纵切 · 灰盒空间</p>
      </header>
      {sceneError ? <p className="scene-error" role="alert">{sceneError}</p> : null}
      <p className="interaction-hint">点击画面进入视角 · WASD/方向键移动 · Esc 退出鼠标锁定</p>
    </main>
  );
}
