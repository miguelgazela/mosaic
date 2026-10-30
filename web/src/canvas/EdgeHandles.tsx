import { useEffect, useRef, useState } from "react";
import { useBoard } from "./store";
import { startLineFromHandle } from "./connectInteractions";
import type { Side } from "./connections";

const POS: Record<Side, React.CSSProperties> = {
  top: { left: "50%", top: 0 },
  bottom: { left: "50%", top: "100%" },
  left: { left: 0, top: "50%" },
  right: { left: "100%", top: "50%" },
};

const SIDES: Side[] = ["top", "right", "bottom", "left"];

/** How close (screen px) the pointer must be to a card edge to reveal that side's dot. */
const NEAR_EDGE = 14;

/** Side of `r` the pointer is within NEAR_EDGE px of (the closest one), or null in the middle of the card. */
export function nearestSide(
  r: { left: number; top: number; right: number; bottom: number },
  x: number,
  y: number,
): Side | null {
  const d: Array<[Side, number]> = [
    ["top", y - r.top],
    ["bottom", r.bottom - y],
    ["left", x - r.left],
    ["right", r.right - x],
  ];
  const [side, dist] = d.reduce((a, b) => (b[1] < a[1] ? b : a));
  return dist <= NEAR_EDGE ? side : null;
}

/**
 * Round handles for drawing lines. Not four dots on every hover: hovering a card shows one (right, or bottom
 * where the resize handle sits); the others appear when the pointer nears their edge or the card is selected.
 * Dragging one draws a line. `skip` hides a side (e.g. where the resize handle sits).
 */
export function EdgeHandles({ id, skip }: { id: string; skip?: Side }) {
  const selected = useBoard(
    (s) => s.selected[id] === true && Object.keys(s.selected).length === 1,
  );
  const [near, setNear] = useState<Side | null>(null);
  const probe = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const card = probe.current?.parentElement;
    if (!card) return;
    const move = (e: PointerEvent) =>
      setNear(nearestSide(card.getBoundingClientRect(), e.clientX, e.clientY));
    const leave = () => setNear(null);
    card.addEventListener("pointermove", move);
    card.addEventListener("pointerleave", leave);
    return () => {
      card.removeEventListener("pointermove", move);
      card.removeEventListener("pointerleave", leave);
    };
  }, []);
  const primary: Side = skip === "right" ? "bottom" : "right";
  return (
    <>
      <span ref={probe} hidden />
      {SIDES.filter((s) => s !== skip).map((side) => {
        const extra = selected || near === side;
        const shown = side === primary || extra;
        return (
          <div
            key={side}
            data-edge-handle={side}
            data-nodrag
            title="Drag to draw a line"
            className={`pointer-events-none absolute opacity-0 transition-opacity duration-[var(--dur-hover)] hover:!bg-[var(--primary)] ${
              shown
                ? "group-hover/card:pointer-events-auto group-hover/card:opacity-100"
                : ""
            } ${extra && selected ? "!pointer-events-auto !opacity-100" : ""}`}
            style={{
              ...POS[side],
              width: "calc(10px / var(--zoom))",
              height: "calc(10px / var(--zoom))",
              marginLeft: "calc(-5px / var(--zoom))",
              marginTop: "calc(-5px / var(--zoom))",
              borderRadius: "50%",
              background: "var(--card-bg)",
              border: "calc(1.5px / var(--zoom)) solid var(--primary)",
              cursor: "crosshair",
              zIndex: 3,
              touchAction: "none",
            }}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.stopPropagation();
              startLineFromHandle(e, id, side);
            }}
          />
        );
      })}
    </>
  );
}
