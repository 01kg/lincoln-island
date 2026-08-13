import { useEffect, useRef, useState } from 'react';
import { buildId } from './buildInfo';
import { ReadingCompanionShell } from './ui/ReadingCompanionShell';
import type { SceneDiagnostics } from './scene/createIslandScene';
import './styles.css';

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<SceneDiagnostics | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let active = true;
    let cleanup: (() => void) | null = null;

    void import('./scene/createIslandScene')
      .then(({ createIslandScene }) => {
        if (!active) return;
        const sceneHandle = createIslandScene(canvas, setDiagnostics);
        sceneHandle.engine.runRenderLoop(() => sceneHandle.scene.render());
        const resize = () => sceneHandle.engine.resize();
        window.addEventListener('resize', resize);
        cleanup = () => {
          window.removeEventListener('resize', resize);
          sceneHandle.dispose();
        };
      })
      .catch((error: unknown) => {
        if (!active) return;
        setSceneError(error instanceof Error ? error.message : '三维场景初始化失败，请刷新后重试。');
      });

    return () => {
      active = false;
      cleanup?.();
    };
  }, []);

  return <ReadingCompanionShell canvasRef={canvasRef} sceneError={sceneError} diagnostics={diagnostics} buildId={buildId} />;
}
