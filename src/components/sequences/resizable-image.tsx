"use client";

import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useCallback, useRef, useState } from "react";
import { AlignLeft, AlignCenter, AlignRight, Maximize2 } from "lucide-react";

// ── 8 resize handles ─────────────────────────────────────────
const HANDLES = [
  { key: "tl", pos: { top: -5, left: -5 },                                     cursor: "nw-resize", side: "left"  as const, axis: "both"  },
  { key: "tr", pos: { top: -5, right: -5 },                                    cursor: "ne-resize", side: "right" as const, axis: "both"  },
  { key: "bl", pos: { bottom: -5, left: -5 },                                  cursor: "sw-resize", side: "left"  as const, axis: "both"  },
  { key: "br", pos: { bottom: -5, right: -5 },                                 cursor: "se-resize", side: "right" as const, axis: "both"  },
  { key: "r",  pos: { top: "50%", right: -5,   transform: "translateY(-50%)" }, cursor: "e-resize",  side: "right" as const, axis: "x"     },
  { key: "l",  pos: { top: "50%", left: -5,    transform: "translateY(-50%)" }, cursor: "w-resize",  side: "left"  as const, axis: "x"     },
  { key: "t",  pos: { top: -5,   left: "50%",  transform: "translateX(-50%)" }, cursor: "n-resize",  side: "right" as const, axis: "y-inv" },
  { key: "b",  pos: { bottom: -5,left: "50%",  transform: "translateX(-50%)" }, cursor: "s-resize",  side: "right" as const, axis: "y"     },
];

// ── Node view ────────────────────────────────────────────────

function ImageNodeView({ node, updateAttributes, selected }: NodeViewProps) {
  const src   = node.attrs.src   as string;
  const alt   = (node.attrs.alt  as string) ?? "";
  const width = node.attrs.width as number | null;
  const align = (node.attrs.align as string) ?? "center";

  const imgRef       = useRef<HTMLImageElement>(null);
  const startX       = useRef(0);
  const startY       = useRef(0);
  const startW       = useRef(0);
  const alignAtStart = useRef(align);
  const [hovered, setHovered] = useState(false);

  // ── Resize ──────────────────────────────────────────────────
  const startResize = useCallback(
    (e: React.MouseEvent, h: typeof HANDLES[number]) => {
      e.preventDefault();
      e.stopPropagation(); // prevent node-drag while resizing
      startX.current       = e.clientX;
      startY.current       = e.clientY;
      startW.current       = imgRef.current?.offsetWidth ?? (width ?? 400);
      alignAtStart.current = align;

      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX.current;
        const dy = ev.clientY - startY.current;
        let delta = 0;
        if (h.axis === "x")     delta = h.side === "right" ? dx : -dx;
        if (h.axis === "y")     delta = dy;
        if (h.axis === "y-inv") delta = -dy;
        if (h.axis === "both") {
          const vd = h.key.startsWith("t") ? -dy : dy;
          const hd = h.side === "right" ? dx : -dx;
          delta = Math.abs(hd) > Math.abs(vd) ? hd : vd;
        }
        const newW = Math.max(60, Math.round(startW.current + delta));
        if (alignAtStart.current === "full") {
          updateAttributes({ align: "center", width: newW });
          alignAtStart.current = "center";
        } else {
          updateAttributes({ width: newW });
        }
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [width, align, updateAttributes],
  );

  // ── Alignment ───────────────────────────────────────────────
  function setAlign(a: string) {
    if (align === a) {
      updateAttributes({ align: "center", width: 400 });
    } else {
      updateAttributes({ align: a, ...(a === "full" ? { width: null } : {}) });
    }
  }

  // ── Layout helpers ───────────────────────────────────────────
  const boxW: string = align === "full" ? "100%" : width ? `${width}px` : "400px";

  const wrapperStyle: React.CSSProperties =
    align === "center" ? { display: "block", textAlign: "center", margin: "4px 0" } :
    align === "full"   ? { display: "block", margin: "4px 0" }                      :
    {};

  const boxStyle: React.CSSProperties =
    align === "left"  ? { float: "left",  marginRight: 12, marginBottom: 4, marginTop: 4 } :
    align === "right" ? { float: "right", marginLeft:  12, marginBottom: 4, marginTop: 4 } :
    {};

  const showControls = selected || hovered;

  return (
    <NodeViewWrapper style={{ display: "block", lineHeight: 0, userSelect: "none" }}>
      <div style={wrapperStyle}>
        {/*
          data-drag-handle on this div → TipTap lets the user drag the WHOLE image
          to a new position in the document.
          Resize handles and the toolbar each call e.stopPropagation() on mousedown
          so they don't accidentally trigger a node-drag.
        */}
        <div
          data-drag-handle
          contentEditable={false}
          style={{
            ...boxStyle,
            position: "relative",
            display: "inline-block",
            width: boxW,
            maxWidth: "100%",
            lineHeight: 0,
            cursor: showControls ? "grab" : "default",
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {/* ── Image ─────────────────────────────────────── */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            draggable={false}
            style={{
              display: "block",
              width: "100%",
              height: "auto",
              borderRadius: 3,
              outline: !selected && hovered ? "2px dashed #93c5fd" : "none",
              outlineOffset: 2,
            }}
          />

          {/* ── Selection ring ──────────────────────────── */}
          {selected && (
            <div
              style={{
                position: "absolute", inset: 0,
                border: "2px solid #3b82f6",
                borderRadius: 3,
                pointerEvents: "none",
                zIndex: 10,
              }}
            />
          )}

          {/* ── Inline toolbar — INSIDE the image at top ─
               Placed inside the image so it is never clipped
               by the editor's overflow-y:auto container.
               stopPropagation on the wrapper prevents the
               toolbar from triggering a node-drag.            */}
          {showControls && (
            <div
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                top: 8,
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                alignItems: "center",
                gap: 2,
                background: "rgba(255,255,255,0.95)",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: "3px 6px",
                boxShadow: "0 2px 12px rgba(0,0,0,.18)",
                zIndex: 30,
                whiteSpace: "nowrap",
                backdropFilter: "blur(4px)",
              }}
            >
              {(
                [
                  { a: "left",   icon: <AlignLeft   size={13} />, label: "Float left"  },
                  { a: "center", icon: <AlignCenter  size={13} />, label: "Center"      },
                  { a: "right",  icon: <AlignRight   size={13} />, label: "Float right" },
                  { a: "full",   icon: <Maximize2    size={13} />, label: "Full width"  },
                ] as const
              ).map(({ a, icon, label }) => (
                <button
                  key={a}
                  type="button"
                  title={label}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setAlign(a); }}
                  style={{
                    padding: "3px 5px",
                    border: "none",
                    borderRadius: 5,
                    cursor: "pointer",
                    background: align === a ? "#3b82f6" : "transparent",
                    color:      align === a ? "#fff"    : "#64748b",
                    display: "flex",
                    alignItems: "center",
                    lineHeight: 0,
                  }}
                >
                  {icon}
                </button>
              ))}

              {width && align !== "full" && (
                <span style={{ marginLeft: 4, fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>
                  {width}px
                </span>
              )}
            </div>
          )}

          {/* ── 8 resize handles ────────────────────────── */}
          {selected && HANDLES.map((h) => (
            <div
              key={h.key}
              onMouseDown={(e) => startResize(e, h)}
              style={{
                position: "absolute",
                ...(h.pos as React.CSSProperties),
                width: 11,
                height: 11,
                background: "#3b82f6",
                border: "2.5px solid #fff",
                borderRadius: "50%",
                cursor: h.cursor,
                zIndex: 20,
                boxShadow: "0 1px 4px rgba(0,0,0,.3)",
              }}
            />
          ))}
        </div>
      </div>
    </NodeViewWrapper>
  );
}

// ── TipTap extension ─────────────────────────────────────────

export const ResizableImage = Image.extend({
  draggable: true,

  // Allow base64 data-URL images (uploaded files).
  // The default TipTap Image extension filters them out with
  //   img[src]:not([src^="data:"])
  // which causes uploaded images to vanish when HTML is re-parsed.
  parseHTML() {
    return [{ tag: "img[src]" }];
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: 400,
        parseHTML: (el) => {
          const v = el.getAttribute("width");
          return v ? parseInt(v, 10) : null;
        },
        renderHTML: (a) => (a.width ? { width: String(a.width) } : {}),
      },
      align: {
        default: "center",
        parseHTML: (el) => {
          const s = el.getAttribute("style") ?? "";
          if (s.includes("float:left")  || s.includes("float: left"))  return "left";
          if (s.includes("float:right") || s.includes("float: right")) return "right";
          if (s.includes("width:100%")  || s.includes("width: 100%"))  return "full";
          return "center";
        },
        renderHTML: (a) => {
          const s =
            a.align === "left"  ? "float:left;margin-right:12px;margin-bottom:4px;margin-top:4px" :
            a.align === "right" ? "float:right;margin-left:12px;margin-bottom:4px;margin-top:4px" :
            a.align === "full"  ? "display:block;width:100%;margin:4px 0"                          :
                                  "display:block;margin:4px auto";
          return { style: s };
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});
