import { useEffect, useState } from 'react';

/** Высота зоны под визуальным viewport (виртуальная клавиатура и т.п.) */
export function getVisualViewportBottomInset(): number {
  const vv = window.visualViewport;
  if (!vv) return 0;
  return Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
}

/** Подписка на изменение высоты клавиатуры через Visual Viewport API */
export function useVisualViewportBottomInset(active = true): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!active) {
      setInset(0);
      return;
    }

    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => setInset(getVisualViewportBottomInset());

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [active]);

  return inset;
}
