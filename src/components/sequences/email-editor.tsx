"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { ResizableImage } from "./resizable-image";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Placeholder from "@tiptap/extension-placeholder";
import { useRef, useState } from "react";
import {
  Bold, Italic, UnderlineIcon,
  Heading1, Heading2, Heading3,
  List, ListOrdered,
  Link2, ImageIcon,
  AlignLeft, AlignCenter, AlignRight,
  Minus, Quote,
  Upload, X, Unlink, Check,
  Monitor, Tablet, Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Merge tokens ─────────────────────────────────────────────
const MERGE_TOKENS = [
  { label: "First name",      token: "{{firstName}}"    },
  { label: "Last name",       token: "{{lastName}}"     },
  { label: "Company",         token: "{{companyName}}"  },
  { label: "Title",           token: "{{title}}"        },
  { label: "Unsubscribe link",token: "{{unsubscribeUrl}}"},
];

// ── Device preview widths ─────────────────────────────────────
const DEVICES = [
  { id: "desktop", label: "Desktop", icon: Monitor,    width: "100%"  },
  { id: "tablet",  label: "Tablet",  icon: Tablet,     width: "768px" },
  { id: "mobile",  label: "Mobile",  icon: Smartphone, width: "390px" },
] as const;
type Device = typeof DEVICES[number]["id"];

// ─────────────────────────────────────────────────────────────

interface EmailEditorProps {
  initialContent: string;
  onChange: (html: string) => void;
}

export function EmailEditor({ initialContent, onChange }: EmailEditorProps) {
  const [showImageModal, setShowImageModal] = useState(false);
  const [showLinkPopover, setShowLinkPopover] = useState(false);
  const [linkUrl, setLinkUrl]     = useState("");
  const [linkNewTab, setLinkNewTab] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);

  // Auto-select device preview based on actual screen width at mount time
  const [device, setDevice] = useState<Device>(() => {
    if (typeof window === "undefined") return "desktop";
    const w = window.innerWidth;
    if (w < 768) return "mobile";
    if (w < 1024) return "tablet";
    return "desktop";
  });

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: "Write your email here…  or drag & drop an image from your desktop" }),
      Link.configure({ openOnClick: false }),
      ResizableImage,
    ],
    content: initialContent || "",
    onUpdate({ editor }) { onChange(editor.getHTML()); },
    editorProps: {
      attributes: {
        // [&_img]:my-0 overrides Tailwind Typography's 2em top/bottom margin on images
        class: "min-h-[340px] w-full px-8 py-6 text-sm leading-relaxed outline-none prose prose-neutral dark:prose-invert max-w-none break-words [&_img]:my-0 [&_figure]:my-0",
      },
      // ── Handle image files dropped anywhere on the editor ──
      handleDrop(view, event, _slice, moved) {
        // `moved` = internal TipTap node drag — let ProseMirror handle it
        if (moved) return false;
        const files = Array.from(event.dataTransfer?.files ?? []);
        const img   = files.find((f) => f.type.startsWith("image/"));
        if (!img) return false;

        event.preventDefault();
        setIsDragOver(false);

        // Translate mouse coords → ProseMirror document position
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        const pos    = coords?.pos ?? view.state.doc.content.size;

        const reader = new FileReader();
        reader.onload = (e) => {
          const src  = e.target?.result as string;
          const node = view.state.schema.nodes.image?.createAndFill({ src, width: 400 });
          if (node) view.dispatch(view.state.tr.insert(pos, node));
        };
        reader.readAsDataURL(img);
        return true; // handled — suppress ProseMirror default
      },
      // Show/hide drag-over overlay
      handleDOMEvents: {
        dragover(_v, e) {
          if (e.dataTransfer?.types.includes("Files")) setIsDragOver(true);
          return false;
        },
        dragleave() { setIsDragOver(false); return false; },
        drop()      { setIsDragOver(false); return false; },
      },
    },
  });

  if (!editor) return null;

  // ── Link ────────────────────────────────────────────────────
  function openLinkPopover() {
    setLinkUrl(editor.getAttributes("link").href as string ?? "");
    setLinkNewTab(true);
    setShowLinkPopover(true);
  }
  function applyLink() {
    if (!linkUrl.trim()) return;
    editor.chain().focus().extendMarkRange("link")
      .setLink({ href: linkUrl.trim(), target: linkNewTab ? "_blank" : "_self" }).run();
    setShowLinkPopover(false);
    setLinkUrl("");
  }
  function removeLink() {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setShowLinkPopover(false);
  }

  // ── Image ───────────────────────────────────────────────────
  function insertImage(src: string, alt = "") {
    (editor.chain().focus() as any).setImage({ src, alt, width: 400 }).run(); // setImage added by ResizableImage
  }

  // ── Merge tokens ────────────────────────────────────────────
  function insertToken(token: string) {
    editor.chain().focus().insertContent(token).run();
  }

  const currentDeviceWidth = DEVICES.find((d) => d.id === device)?.width ?? "100%";

  return (
    <div className="flex h-full flex-col overflow-hidden">

      {/* ── Toolbar — scrolls horizontally on mobile, wraps on sm+ ── */}
      <div className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b border-border bg-muted/40 p-1.5 sm:flex-wrap sm:overflow-x-visible">

        {/* Headings */}
        <ToolGroup>
          <ToolBtn active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="H1"><Heading1 className="h-4 w-4" /></ToolBtn>
          <ToolBtn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="H2"><Heading2 className="h-4 w-4" /></ToolBtn>
          <ToolBtn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="H3"><Heading3 className="h-4 w-4" /></ToolBtn>
        </ToolGroup><Sep />

        {/* Text style */}
        <ToolGroup>
          <ToolBtn active={editor.isActive("bold")}      onClick={() => editor.chain().focus().toggleBold().run()}      title="Bold"><Bold className="h-4 w-4" /></ToolBtn>
          <ToolBtn active={editor.isActive("italic")}    onClick={() => editor.chain().focus().toggleItalic().run()}    title="Italic"><Italic className="h-4 w-4" /></ToolBtn>
          <ToolBtn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline"><UnderlineIcon className="h-4 w-4" /></ToolBtn>
        </ToolGroup><Sep />

        {/* Align */}
        <ToolGroup>
          <ToolBtn active={editor.isActive({ textAlign: "left" })}   onClick={() => editor.chain().focus().setTextAlign("left").run()}   title="Left"><AlignLeft className="h-4 w-4" /></ToolBtn>
          <ToolBtn active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Center"><AlignCenter className="h-4 w-4" /></ToolBtn>
          <ToolBtn active={editor.isActive({ textAlign: "right" })}  onClick={() => editor.chain().focus().setTextAlign("right").run()}  title="Right"><AlignRight className="h-4 w-4" /></ToolBtn>
        </ToolGroup><Sep />

        {/* Lists */}
        <ToolGroup>
          <ToolBtn active={editor.isActive("bulletList")}  onClick={() => editor.chain().focus().toggleBulletList().run()}  title="Bullet list"><List className="h-4 w-4" /></ToolBtn>
          <ToolBtn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list"><ListOrdered className="h-4 w-4" /></ToolBtn>
          <ToolBtn active={editor.isActive("blockquote")}  onClick={() => editor.chain().focus().toggleBlockquote().run()}  title="Quote / Signature"><Quote className="h-4 w-4" /></ToolBtn>
        </ToolGroup><Sep />

        {/* Link */}
        <div className="relative">
          <ToolBtn active={editor.isActive("link")} onClick={openLinkPopover} title="Link">
            <Link2 className="h-4 w-4" />
          </ToolBtn>
          {showLinkPopover && (
            <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-lg border border-border bg-card p-3 shadow-xl">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Insert link</p>
              <input autoFocus placeholder="https://example.com" value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") applyLink(); if (e.key === "Escape") setShowLinkPopover(false); }}
                className="mb-2 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <label className="mb-3 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={linkNewTab} onChange={(e) => setLinkNewTab(e.target.checked)} className="rounded" />
                Open in new tab
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={applyLink} disabled={!linkUrl.trim()}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40">
                  <Check className="h-3.5 w-3.5" />Apply
                </button>
                {editor.isActive("link") && (
                  <button type="button" onClick={removeLink}
                    className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10">
                    <Unlink className="h-3.5 w-3.5" />Remove
                  </button>
                )}
                <button type="button" onClick={() => setShowLinkPopover(false)}
                  className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Image */}
        <ToolBtn active={false} onClick={() => setShowImageModal(true)} title="Insert image">
          <ImageIcon className="h-4 w-4" />
        </ToolBtn>

        {/* Divider */}
        <ToolBtn active={false} onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider">
          <Minus className="h-4 w-4" />
        </ToolBtn>

        <Sep />

        {/* ── Device preview ────────────────────────────────── */}
        <ToolGroup>
          {DEVICES.map(({ id, label, icon: Icon }) => (
            <ToolBtn key={id} active={device === id} onClick={() => setDevice(id)} title={`${label} preview`}>
              <Icon className="h-4 w-4" />
            </ToolBtn>
          ))}
        </ToolGroup>

        <Sep />

        {/* Merge tokens */}
        <span className="ml-1 shrink-0 text-xs text-muted-foreground">Insert:</span>
        {MERGE_TOKENS.map((t) => (
          <button key={t.token} type="button" title={t.label}
            onMouseDown={(e) => { e.preventDefault(); insertToken(t.token); }}
            className="shrink-0 rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[11px] text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400">
            {t.token}
          </button>
        ))}
      </div>

      {/* ── Device label strip ──────────────────────────────── */}
      {device !== "desktop" && (
        <div className="flex shrink-0 items-center justify-center gap-2 border-b border-dashed border-border bg-muted/20 py-1 text-xs text-muted-foreground">
          {device === "tablet" ? <Tablet className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />}
          {device === "tablet" ? "Tablet — 768 px" : "Mobile — 390 px"} preview
        </div>
      )}

      {/* ── Editor area ─────────────────────────────────────── */}
      {/*
        overflow-auto (both x + y) so that tablet/desktop preview can
        scroll horizontally when the device is narrower than the preview width.
      */}
      <div
        className="relative min-h-0 flex-1 overflow-auto bg-muted/20"
        onClick={() => setShowLinkPopover(false)}
      >
        {/* Drag-over overlay — shown when user drags a file over the editor */}
        {isDragOver && (
          <div className="pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 rounded-lg border-4 border-dashed border-primary bg-primary/5">
            <ImageIcon className="h-10 w-10 text-primary/60" />
            <p className="text-sm font-medium text-primary">Drop image anywhere to insert</p>
          </div>
        )}

        {/*
          Desktop → fill 100% of container (responsive).
          Tablet / Mobile preview → pin to exact preview width so users on
          a narrower screen can scroll horizontally to see the true layout.
        */}
        <div
          className="bg-background shadow-sm transition-all duration-300"
          style={
            device === "desktop"
              ? { width: "100%", minHeight: "100%" }
              : { width: currentDeviceWidth, minWidth: currentDeviceWidth, margin: "0 auto", minHeight: "100%" }
          }
        >
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* ── Image modal ─────────────────────────────────────── */}
      {showImageModal && (
        <ImageModal
          onInsert={(src, alt) => { insertImage(src, alt); setShowImageModal(false); }}
          onClose={() => setShowImageModal(false)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Image upload / URL modal
// ─────────────────────────────────────────────────────────────
function ImageModal({
  onInsert,
  onClose,
}: {
  onInsert: (src: string, alt: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab]         = useState<"upload" | "url">("upload");
  const [preview, setPreview] = useState("");
  const [alt, setAlt]         = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function readFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handleInsert() {
    const src = tab === "upload" ? preview : urlInput.trim();
    if (src) onInsert(src, alt);
  }

  const canInsert = tab === "upload" ? !!preview : !!urlInput.trim();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-[420px] mx-4 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">Insert image</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex border-b border-border">
          {(["upload", "url"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={cn("flex-1 py-2 text-sm font-medium transition-colors",
                tab === t ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {t === "upload" ? "Upload file" : "Image URL"}
            </button>
          ))}
        </div>

        <div className="space-y-3 p-4">
          {tab === "upload" ? (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) readFile(f); }}
                onClick={() => fileRef.current?.click()}
                className={cn("flex h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed transition-colors",
                  dragging ? "border-primary bg-primary/5" : "border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50")}
              >
                {preview
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={preview} alt="preview" className="h-full w-full rounded-md object-contain p-1" />
                  : <>
                      <Upload className="h-7 w-7 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Drop image or <span className="text-primary underline">browse</span></p>
                      <p className="text-xs text-muted-foreground/60">PNG · JPG · GIF · WebP</p>
                    </>
                }
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); }} />
            </>
          ) : (
            <input autoFocus placeholder="https://example.com/image.png" value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && canInsert && handleInsert()}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          )}

          <input placeholder="Alt text (optional)" value={alt} onChange={(e) => setAlt(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent">Cancel</button>
            <button type="button" onClick={handleInsert} disabled={!canInsert}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40 hover:opacity-90">
              Insert image
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Toolbar primitives
// ─────────────────────────────────────────────────────────────
function ToolGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex shrink-0 items-center gap-0.5">{children}</div>;
}
function Sep() {
  return <div className="mx-1 h-5 w-px shrink-0 bg-border" />;
}
function ToolBtn({ children, onClick, title, active }: {
  children: React.ReactNode; onClick: () => void; title?: string; active: boolean;
}) {
  return (
    <button type="button" title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={cn("rounded p-1.5 transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
      {children}
    </button>
  );
}
