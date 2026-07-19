import { useEffect, useRef } from "react";

export function CursorBall() {
  const ballRef = useRef<HTMLDivElement>(null);
  const trailRefs = useRef<HTMLDivElement[]>([]);
  const pos = useRef({ x: -100, y: -100 });
  const target = useRef({ x: -100, y: -100 });

  useEffect(() => {
    if (window.matchMedia("(hover: none)").matches) return;

    const onMove = (e: MouseEvent) => {
      target.current = { x: e.clientX, y: e.clientY };
      // update card glow position
      const el = (e.target as HTMLElement)?.closest?.(".chalk-board") as HTMLElement | null;
      if (el) {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
      }
    };
    window.addEventListener("mousemove", onMove, { passive: true });

    let raf = 0;
    const trailHistory: { x: number; y: number }[] = [];
    const loop = () => {
      pos.current.x += (target.current.x - pos.current.x) * 0.22;
      pos.current.y += (target.current.y - pos.current.y) * 0.22;
      if (ballRef.current) {
        ballRef.current.style.transform = `translate(${pos.current.x}px, ${pos.current.y}px) translate(-50%, -50%)`;
      }
      trailHistory.unshift({ ...pos.current });
      trailHistory.length = Math.min(trailHistory.length, 8);
      trailRefs.current.forEach((el, i) => {
        const p = trailHistory[i * 2] ?? trailHistory[trailHistory.length - 1];
        if (!p || !el) return;
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) scale(${1 - i * 0.18})`;
        el.style.opacity = `${0.35 - i * 0.07}`;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { window.removeEventListener("mousemove", onMove); cancelAnimationFrame(raf); };
  }, []);

  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} ref={(el) => { if (el) trailRefs.current[i] = el; }} className="cursor-trail" />
      ))}
      <div ref={ballRef} className="cursor-ball" />
    </>
  );
}