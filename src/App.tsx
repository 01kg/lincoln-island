import { useEffect, useRef } from 'react';
import { createGreyboxScene } from './scene/createGreyboxScene';
import { ReadingCompanionShell } from './ui/ReadingCompanionShell';
import './styles.css';

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const { engine, scene } = createGreyboxScene(canvas);
    engine.runRenderLoop(() => scene.render());

    const resize = () => engine.resize();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      scene.dispose();
      engine.dispose();
    };
  }, []);

  return <ReadingCompanionShell canvasRef={canvasRef} />;
}
