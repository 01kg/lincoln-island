import type { RefObject } from 'react';
import type { SceneDiagnostics } from '../scene/createIslandScene';

interface ReadingCompanionShellProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  sceneError: string | null;
  diagnostics: SceneDiagnostics | null;
}

export function ReadingCompanionShell({ canvasRef, sceneError, diagnostics }: ReadingCompanionShellProps) {
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
      <aside className="diagnostic-hud" aria-label="技术诊断状态">
        <p className="diagnostic-title">技术诊断 · 灰盒参照</p>
        <p>位置 {diagnostics ? diagnostics.position.map((value) => value.toFixed(1)).join(' / ') : '加载中'}</p>
        <p>朝向 {diagnostics ? `${diagnostics.heading} · yaw ${diagnostics.yaw.toFixed(2)}` : '加载中'}</p>
        <p>输入 {diagnostics?.keys ?? '加载中'}</p>
        <p>视角 {diagnostics?.pointerLocked ? '已进入视角' : '未锁定'}</p>
      </aside>
      <p className="interaction-hint">点击画面进入视角 · WASD/方向键移动 · Esc 退出鼠标锁定</p>
    </main>
  );
}
