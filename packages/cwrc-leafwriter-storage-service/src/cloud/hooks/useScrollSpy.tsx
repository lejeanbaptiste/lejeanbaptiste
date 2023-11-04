import { useEffect, useState, type MutableRefObject } from 'react';

interface useScrollSpyProps {
  container: MutableRefObject<HTMLElement | null>;
  target: MutableRefObject<HTMLElement | null>;
  offset?: number;
}

export const useScrollSpy = ({ container, target, offset = 0 }: useScrollSpyProps) => {
  const [reachBottom, setReachBottom] = useState(false);

  useEffect(() => {
    if (container.current) container.current.addEventListener('scroll', spy);

    return () => {
      if (container.current) container.current.removeEventListener('scroll', spy);
    };
  }, []);

  const spy = () => {
    if (!container.current || !target.current) return;

    const rectContainer = container.current.getBoundingClientRect();
    const rectTarget = target.current.getBoundingClientRect();

    const visible = rectTarget.bottom + offset <= rectContainer.bottom;
    setReachBottom(visible);
  };

  return {
    reachBottom,
  };
};
