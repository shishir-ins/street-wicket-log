import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export type TabItem = { key: string; label: string };

/**
 * Monochrome mica-glass segmented tabs with a pill that stretches while
 * travelling between tabs, then settles back onto the active one.
 */
export function MatchTabs({
  items, value, onChange,
}: { items: TabItem[]; value: string; onChange: (key: string) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [box, setBox] = useState({ left: 0, width: 0, ready: false });
  const activeIndex = Math.max(0, items.findIndex((i) => i.key === value));
  const prevIndex = useRef(activeIndex);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const restFor = useCallback((index: number) => {
    const el = itemRefs.current[index];
    const parent = containerRef.current;
    if (!el || !parent) return null;
    const p = parent.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { left: r.left - p.left, width: r.width };
  }, []);

  const settle = useCallback(() => {
    const rest = restFor(activeIndex);
    if (rest) setBox({ ...rest, ready: true });
  }, [restFor, activeIndex]);

  useLayoutEffect(() => {
    const from = prevIndex.current;
    const to = activeIndex;
    if (from === to) { settle(); return; }
    prevIndex.current = to;
    const a = restFor(from);
    const b = restFor(to);
    if (a && b) {
      const left = Math.min(a.left, b.left);
      const right = Math.max(a.left + a.width, b.left + b.width);
      setBox({ left, width: right - left, ready: true });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(settle, 220);
    } else settle();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [activeIndex, restFor, settle]);

  useEffect(() => {
    const onResize = () => settle();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [settle]);

  return (
    <div
      ref={containerRef}
      role="tablist"
      className="mica-tabs mb-4"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="mica-tab-pill"
        style={{ opacity: box.ready ? 1 : 0, transform: `translateX(${box.left}px)`, width: box.width }}
      />
      {items.map((it, i) => (
        <button
          key={it.key}
          role="tab"
          aria-selected={it.key === value}
          data-active={it.key === value}
          ref={(el) => { itemRefs.current[i] = el; }}
          onClick={() => onChange(it.key)}
          className="mica-tab text-center"
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
