import { useEffect, useState, type MutableRefObject } from 'react';

interface useScrollSpyProps {
  container: MutableRefObject<HTMLElement | null>;
  target: MutableRefObject<HTMLElement | null>;
  offset?: number;
}

export const useScrollSpy = ({ container, target, offset = 0 }: useScrollSpyProps) => {
  const [reachBottom, setReachBottom] = useState(false);

  useEffect(() => {
    const node = container.current;
    if (node) node.addEventListener('scroll', spy);

    return () => {
      if (node) node.removeEventListener('scroll', spy);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
