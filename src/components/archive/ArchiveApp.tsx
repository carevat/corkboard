"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { AlertCircle, ArrowDownToLine, Check, CircleHelp, Clipboard, Download, FilePlus2, Focus, ImagePlus, Keyboard, Link2, LockKeyhole, MousePointer2, Plus, Settings2, Trash2, UploadCloud, X } from "lucide-react";
import { Board, type BoardHandle } from "./Board";
import { AssetTray, Sidebar, ToolRail, TopBar, type MenuAction } from "./WorkspacePanels";
import { useArchive } from "@/hooks/use-archive";
import { exportInvestigation, importInvestigation } from "@/lib/archive-transfer";
import { putAsset } from "@/lib/archive-storage";
import { makeEvidence, uid, type Connection, type Evidence, type ImageEvidence, type Investigation, type Point, type ShapeEvidence, type ShapeKind, type Tool } from "@/lib/archive-types";

type Modal = "new" | "rename" | "clear" | "delete" | "link" | "help" | "settings" | null;
type Toast = { id: number; message: string; kind: "success" | "error" };
const CLIP_PREFIX = "THE_BLACK_ARCHIVE_OBJECTS:";
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_IMAGE_BYTES = 18 * 1024 * 1024;

function fileMime(file: File): string {
  if (ACCEPTED_TYPES.has(file.type.toLowerCase())) return file.type.toLowerCase();
  const extension = file.name.toLowerCase().split(".").pop();
  return extension === "jpg" || extension === "jpeg" ? "image/jpeg" : extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : extension === "gif" ? "image/gif" : "";
}
function imageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve({ width: image.naturalWidth, height: image.naturalHeight }); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("This image could not be decoded by the browser.")); };
    image.src = url;
  });
}
function cleanTitle(name: string): string {
  const cleaned = name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return cleaned ? cleaned.replace(/\b\w/g, (letter) => letter.toUpperCase()).slice(0, 80) : "Untitled photograph";
}
function editableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && !!target.closest("input,textarea,select,[contenteditable='true']");
}

export default function ArchiveApp() {
  const archive = useArchive();
  const { project, projectRef, cases, assetUrls, status, storageError, canUndo, canRedo, preview, finishPreview, setView, addEvidence, updateEvidence, addConnection, updateConnection, deleteSelection, duplicateEvidence, pasteEvidence, setSettings, addTimeline, deleteTimeline, rename, clearBoard, undo, redo, openCase, createCase, duplicateCase, importCase, removeCase, saveNow, registerAsset, change } = archive;
  const boardRef = useRef<BoardHandle>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const uploadPoint = useRef<Point | null>(null);
  const lastPointer = useRef<{ point: Point; time: number } | null>(null);
  const copied = useRef<{ evidence: Evidence[]; connections: Connection[] } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [shapeKind, setShapeKind] = useState<ShapeKind>("rectangle");
  const [selection, setSelection] = useState<string[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [stringFrom, setStringFrom] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [modal, setModal] = useState<Modal>(null);
  const [modalText, setModalText] = useState("");
  const [linkForm, setLinkForm] = useState({ title: "", url: "", notes: "" });
  const [linkPoint, setLinkPoint] = useState<Point>({ x: 400, y: 300 });
  const [contextMenu, setContextMenu] = useState<{ id?: string; connectionId?: string; x: number; y: number } | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const notify = useCallback((message: string, kind: "success" | "error" = "success") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, kind });
    toastTimer.current = setTimeout(() => setToast(null), kind === "error" ? 6500 : 3700);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  useEffect(() => {
    const preventNavigation = (event: DragEvent) => event.preventDefault();
    window.addEventListener("dragover", preventNavigation); window.addEventListener("drop", preventNavigation);
    return () => { window.removeEventListener("dragover", preventNavigation); window.removeEventListener("drop", preventNavigation); };
  }, []);
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("pointerdown", close);
    window.addEventListener("scroll", close, true);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("scroll", close, true); };
  }, [contextMenu]);

  const select = useCallback((ids: string[], connectionId: string | null = null) => {
    setSelection(ids); setSelectedConnectionId(connectionId); setContextMenu(null);
  }, []);
  const openUpload = useCallback((point?: Point) => {
    uploadPoint.current = point ?? boardRef.current?.center() ?? { x: 500, y: 400 };
    if (uploadRef.current) { uploadRef.current.value = ""; uploadRef.current.click(); }
  }, []);
  const openImport = useCallback(() => { if (importRef.current) { importRef.current.value = ""; importRef.current.click(); } }, []);

  const importFiles = useCallback(async (files: File[], at: Point, sourceOverride?: string) => {
    if (!files.length) return;
    const current = projectRef.current;
    if (!current) return;
    const created: ImageEvidence[] = [];
    const errors: string[] = [];
    setProgress({ current: 0, total: files.length });
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const mime = fileMime(file);
        if (!mime) throw new Error(`${file.name}: unsupported format. Use PNG, JPEG, WebP, or GIF.`);
        if (file.size > MAX_IMAGE_BYTES) throw new Error(`${file.name}: exceeds the 18 MB image limit.`);
        if (!file.size) throw new Error(`${file.name}: this file is empty.`);
        const blob = file.type === mime ? file : new Blob([file], { type: mime });
        const dimensions = await imageDimensions(blob);
        const aspect = dimensions.width / dimensions.height;
        const id = uid();
        await putAsset(id, blob);
        registerAsset(id, blob);
        const frame: ImageEvidence["frame"] = aspect < .88 ? "polaroid" : aspect > 2.05 ? "darkroom" : i % 5 === 4 ? "highlighted" : "print";
        const width = aspect < .85 ? 214 : aspect > 2.1 ? 302 : 263;
        const height = Math.max(112, Math.min(382, Math.round((width - 18) / aspect + (frame === "polaroid" ? 54 : 37))));
        const title = cleanTitle(file.name);
        const base = makeEvidence("image", { x: at.x + (created.length % 4) * 37, y: at.y + (created.length % 4) * 32 }, Math.max(1, ...current.evidence.map((e) => e.z)) + created.length + 1) as ImageEvidence;
        created.push({ ...base, width, height, rotation: [-3, 2, -1, 4, 0][created.length % 5], title, caption: title.toUpperCase(), assetId: id, aspect, frame, attachment: created.length % 4 === 2 ? "tape" : "pin", source: sourceOverride || file.name, description: sourceOverride ? `Imported from ${sourceOverride}` : "" });
      } catch (error) { errors.push(error instanceof Error ? error.message : `${file.name}: import failed.`); }
      setProgress({ current: i + 1, total: files.length });
    }
    if (created.length) { addEvidence(created); select([created[created.length - 1].id]); setTool("select"); notify(`${created.length} ${created.length === 1 ? "photograph" : "photographs"} pinned to the board.`); }
    if (errors.length) notify(errors.length === 1 ? errors[0] : `${errors.length} files skipped. ${errors[0]}`, "error");
    setProgress(null);
  }, [projectRef, addEvidence, registerAsset, select, notify]);
  const importUrl = useCallback(async (url: string, point: Point) => {
    try {
      setProgress({ current: 0, total: 1 });
      const response = await fetch(`/api/ingest?url=${encodeURIComponent(url)}`);
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || "That URL could not be imported as an image."); }
      const blob = await response.blob();
      let name = "Web photograph";
      try { name = decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() || "Web photograph"); } catch { /* Use fallback name. */ }
      const extension = blob.type === "image/png" ? ".png" : blob.type === "image/webp" ? ".webp" : blob.type === "image/gif" ? ".gif" : ".jpg";
      if (!/\.(jpe?g|png|webp|gif)$/i.test(name)) name += extension;
      await importFiles([new File([blob], name, { type: blob.type })], point, url);
    } catch (error) { notify(error instanceof Error ? error.message : "Image URL import failed.", "error"); setProgress(null); }
  }, [importFiles, notify]);

  const addAt = useCallback((kind: Tool, point: Point) => {
    const current = projectRef.current;
    if (!current) return;
    if (kind === "image") { openUpload(point); return; }
    if (kind === "link") { setLinkPoint(point); setLinkForm({ title: "", url: "", notes: "" }); setModal("link"); return; }
    if (kind === "select" || kind === "string") return;
    const item = makeEvidence(kind, point, Math.max(1, ...current.evidence.map((e) => e.z)) + 1, shapeKind);
    addEvidence([item]); select([item.id]); setTool("select");
    if (kind === "note" || kind === "text" || kind === "document") setEditingId(item.id);
    notify(`${kind.charAt(0).toUpperCase() + kind.slice(1)} added. Double-click to edit directly.`);
  }, [projectRef, openUpload, addEvidence, select, shapeKind, notify]);
  const addShape = useCallback((shape: ShapeEvidence) => { addEvidence([shape]); select([shape.id]); setTool("select"); notify("Marking added to the board."); }, [addEvidence, select, notify]);
  const connect = useCallback((from: string, to: string) => {
    if (addConnection(from, to)) notify("Connection added. Select the string to change its meaning and style.");
    else notify("Those clues are already connected.", "error");
  }, [addConnection, notify]);
  const dropAsset = useCallback((id: string, point: Point) => {
    const ids = duplicateEvidence([id], point);
    if (ids.length) { select(ids); notify("A copy of the evidence was added to the board."); }
  }, [duplicateEvidence, select, notify]);
  const focus = useCallback((id: string) => { select([id]); boardRef.current?.focus(id); }, [select]);
  const removeSelected = useCallback(() => {
    if (!selection.length && !selectedConnectionId) return;
    deleteSelection(selection, selectedConnectionId);
    select([]); setEditingId(null); notify("Removed from the board. Undo is available.");
  }, [selection, selectedConnectionId, deleteSelection, select, notify]);
  const duplicateSelected = useCallback(() => {
    const ids = duplicateEvidence(selection);
    if (ids.length) { select(ids); notify(`${ids.length} ${ids.length === 1 ? "item" : "items"} duplicated.`); }
  }, [selection, duplicateEvidence, select, notify]);
  const copySelected = useCallback(() => {
    const current = projectRef.current;
    if (!current || !selection.length) return;
    const evidence = current.evidence.filter((e) => selection.includes(e.id));
    const connections = current.connections.filter((c) => selection.includes(c.fromId) && selection.includes(c.toId));
    copied.current = { evidence, connections };
    void navigator.clipboard?.writeText(CLIP_PREFIX + JSON.stringify(copied.current)).catch(() => { /* Internal copy still works in restrictive browsers. */ });
    notify(`${evidence.length} ${evidence.length === 1 ? "clue" : "clues"} copied.`);
  }, [projectRef, selection, notify]);
  const pasteObjects = useCallback((payload: { evidence: Evidence[]; connections: Connection[] }, point?: Point) => {
    if (!Array.isArray(payload.evidence) || !payload.evidence.length) return;
    const ids = pasteEvidence(payload.evidence, Array.isArray(payload.connections) ? payload.connections : [], point ?? boardRef.current?.center() ?? { x: 400, y: 300 });
    if (ids.length) { select(ids); notify(`${ids.length} ${ids.length === 1 ? "clue" : "clues"} pasted onto the board.`); }
  }, [pasteEvidence, select, notify]);

  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      if (editableTarget(event.target) || modal) return;
      const clipboard = event.clipboardData;
      if (!clipboard) return;
      const images = Array.from(clipboard.items).filter((item) => item.kind === "file" && item.type.startsWith("image/")).map((item) => item.getAsFile()).filter((file): file is File => !!file);
      if (!images.length) images.push(...Array.from(clipboard.files).filter((file) => file.type.startsWith("image/")));
      if (images.length) {
        event.preventDefault();
        const at = lastPointer.current && Date.now() - lastPointer.current.time < 15000 ? lastPointer.current.point : boardRef.current?.center() ?? { x: 500, y: 400 };
        void importFiles(images, at);
        return;
      }
      const text = clipboard.getData("text/plain");
      if (text.startsWith(CLIP_PREFIX)) {
        event.preventDefault();
        try { pasteObjects(JSON.parse(text.slice(CLIP_PREFIX.length)) as { evidence: Evidence[]; connections: Connection[] }); }
        catch { notify("Could not read the copied evidence.", "error"); }
      } else if (!text && copied.current) { event.preventDefault(); pasteObjects(copied.current); }
    };
    window.addEventListener("paste", paste);
    return () => window.removeEventListener("paste", paste);
  }, [modal, importFiles, pasteObjects, notify]);

  const handleAction = useCallback((action: MenuAction) => {
    if (action === "import") { openImport(); return; }
    if (action === "export") {
      const current = projectRef.current;
      if (!current || busy) return;
      setBusy(true); notify("Packing case file and image assets…");
      void (async () => {
        try {
          await saveNow();
          const blob = await exportInvestigation(current);
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a"); anchor.href = url;
          anchor.download = `${current.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "investigation"}.blackarchive.zip`;
          document.body.appendChild(anchor); anchor.click(); anchor.remove();
          setTimeout(() => URL.revokeObjectURL(url), 60000);
          notify("Complete case file exported, including photographs.");
        } catch (error) { notify(error instanceof Error ? error.message : "Export failed.", "error"); }
        finally { setBusy(false); }
      })();
      return;
    }
    if (action === "duplicate") {
      void duplicateCase().then(() => { select([]); notify("Investigation duplicated."); }).catch((error) => notify(error instanceof Error ? error.message : "Could not duplicate investigation.", "error"));
      return;
    }
    if (action === "summary") {
      const current = projectRef.current;
      if (!current) return;
      const summary = `${current.title}\n${current.evidence.length} pieces of evidence · ${current.connections.length} user-created connections\n\nTIMELINE\n${current.timeline.map((t) => `${t.date} — ${t.title}: ${t.detail}`).join("\n")}\n\nCreated in THE BLACK ARCHIVE. Connections are investigative annotations, not verified facts.`;
      void navigator.clipboard.writeText(summary).then(() => notify("Case summary copied to clipboard.")).catch(() => notify("Clipboard access was blocked. Use Export instead.", "error"));
      return;
    }
    if (action === "rename") setModalText(projectRef.current?.title ?? "");
    if (action === "new") setModalText("");
    setModal(action);
  }, [openImport, projectRef, busy, notify, saveNow, duplicateCase, select]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (editableTarget(event.target)) return;
      if (modal) { if (event.key === "Escape") setModal(null); return; }
      const modifier = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (modifier) {
        if (key === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return; }
        if (key === "y") { event.preventDefault(); redo(); return; }
        if (key === "s") { event.preventDefault(); void saveNow().then(() => notify("Investigation saved locally.")).catch(() => notify("Save failed. Check browser storage.", "error")); return; }
        if (key === "c") { if (selection.length) { event.preventDefault(); copySelected(); } return; }
        if (key === "d") { if (selection.length) { event.preventDefault(); duplicateSelected(); } return; }
        if (key === "a") { event.preventDefault(); select(projectRef.current?.evidence.map((e) => e.id) ?? []); return; }
        // Paste is handled by the native paste event so clipboard image items remain available.
        return;
      }
      if (event.key === "Escape") { setTool("select"); setStringFrom(null); setEditingId(null); select([]); setContextMenu(null); return; }
      if (event.key === "Delete" || event.key === "Backspace") { if (selection.length || selectedConnectionId) { event.preventDefault(); removeSelected(); } return; }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key) && selection.length) {
        event.preventDefault();
        const amount = event.shiftKey ? 10 : 1;
        const dx = event.key === "ArrowLeft" ? -amount : event.key === "ArrowRight" ? amount : 0;
        const dy = event.key === "ArrowUp" ? -amount : event.key === "ArrowDown" ? amount : 0;
        change((p) => ({ ...p, evidence: p.evidence.map((e) => selection.includes(e.id) && !e.locked ? { ...e, x: e.x + dx, y: e.y + dy } : e) }));
        return;
      }
      if (event.repeat || event.altKey || event.shiftKey) return;
      const shortcuts: Record<string, Tool> = { v: "select", n: "note", i: "image", d: "document", l: "link", c: "string", t: "text", m: "shape" };
      if (shortcuts[key]) { event.preventDefault(); setTool(shortcuts[key]); setStringFrom(null); if (key === "i") openUpload(); return; }
      if (key === "f") { event.preventDefault(); boardRef.current?.fit(); }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [modal, selection, selectedConnectionId, redo, undo, saveNow, notify, copySelected, duplicateSelected, select, projectRef, removeSelected, change, openUpload]);

  const switchCase = useCallback((id: string) => {
    if (id === projectRef.current?.id) return;
    void openCase(id).then(() => { select([]); setTool("select"); setEditingId(null); setStringFrom(null); notify("Investigation opened."); }).catch((error) => notify(error instanceof Error ? error.message : "Could not open investigation.", "error"));
  }, [openCase, projectRef, select, notify]);
  const submitModal = async () => {
    try {
      if (modal === "new") { await createCase(modalText.trim() || "UNTITLED INVESTIGATION"); select([]); notify("A blank investigation is ready."); }
      if (modal === "rename") { if (!modalText.trim()) { notify("Enter a name for this investigation.", "error"); return; } rename(modalText); notify("Investigation renamed."); }
      if (modal === "clear") { clearBoard(); select([]); notify("Board cleared. Undo is available."); }
      if (modal === "delete") { await removeCase(); select([]); notify("Investigation deleted."); }
      if (modal === "link") {
        if (!/^https?:\/\//i.test(linkForm.url.trim())) { notify("Enter a valid http:// or https:// URL.", "error"); return; }
        try { new URL(linkForm.url.trim()); } catch { notify("Enter a valid URL.", "error"); return; }
        const current = projectRef.current;
        if (!current) return;
        const link = makeEvidence("link", linkPoint, Math.max(1, ...current.evidence.map((e) => e.z)) + 1);
        if (link.type !== "link") return;
        link.title = linkForm.title.trim() || new URL(linkForm.url).hostname;
        link.url = linkForm.url.trim(); link.body = linkForm.notes.trim();
        addEvidence([link]); select([link.id]); setTool("select"); notify("Source link pinned to the board.");
      }
      setModal(null);
    } catch (error) { notify(error instanceof Error ? error.message : "The action could not be completed.", "error"); }
  };
  const filePicked = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length) void importFiles(files, uploadPoint.current ?? boardRef.current?.center() ?? { x: 500, y: 400 });
    uploadPoint.current = null;
  };
  const casePicked = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    setBusy(true); notify("Opening and checking case file…");
    void importInvestigation(file).then(async (next) => { await importCase(next); select([]); setTool("select"); notify("Case restored with all image assets."); }).catch((error) => notify(error instanceof Error ? error.message : "The case file could not be imported.", "error")).finally(() => setBusy(false));
  };
  const contextAction = (action: "duplicate" | "forward" | "backward" | "lock" | "delete" | "copy" | "focus") => {
    const current = projectRef.current;
    const ids = contextMenu?.id && !selection.includes(contextMenu.id) ? [contextMenu.id] : selection;
    if (action === "delete") { deleteSelection(ids, contextMenu?.connectionId || selectedConnectionId); select([]); notify("Removed. Undo is available."); }
    if (action === "duplicate") { const copies = duplicateEvidence(ids); select(copies); notify("Evidence duplicated."); }
    if (action === "copy") copySelected();
    if (action === "focus" && ids[0]) focus(ids[0]);
    if (action === "lock" && current) {
      const shouldLock = !current.evidence.find((e) => e.id === ids[0])?.locked;
      change((p) => ({ ...p, evidence: p.evidence.map((e) => ids.includes(e.id) ? { ...e, locked: shouldLock } : e) }));
      notify(shouldLock ? "Evidence locked in place." : "Evidence unlocked.");
    }
    if ((action === "forward" || action === "backward") && current) {
      const values = current.evidence.map((e) => e.z);
      const z = action === "forward" ? Math.max(0, ...values) + 1 : Math.min(0, ...values) - 1;
      change((p) => ({ ...p, evidence: p.evidence.map((e, index) => ids.includes(e.id) ? { ...e, z: z + (action === "forward" ? index * .001 : -index * .001) } : e) }));
    }
    setContextMenu(null);
  };

  if (!project) return <div className="archive-loading"><div className="loading-emblem">△</div><span>THE BLACK ARCHIVE</span><p>Opening the investigation room…</p></div>;
  return <main className="archive-app">
    <TopBar project={project} cases={cases} status={status} canUndo={canUndo} canRedo={canRedo} onOpenCase={switchCase} onAction={handleAction} onUndo={undo} onRedo={redo} onSave={() => void saveNow().then(() => notify("Investigation saved locally.")).catch(() => notify("Could not save. Check browser storage.", "error"))} onToggleSidebar={() => setSidebarOpen((open) => !open)} />
    <div className="workspace">
      <Board ref={boardRef} project={project} assetUrls={assetUrls} selection={selection} selectedConnectionId={selectedConnectionId} tool={tool} shapeKind={shapeKind} stringFrom={stringFrom} editingId={editingId} onSelect={select} onStringFrom={setStringFrom} onAddAt={addAt} onAddShape={addShape} onConnect={connect} onImportFiles={(files, point) => void importFiles(files, point)} onImportUrl={(url, point) => void importUrl(url, point)} onDropAsset={dropAsset} onPreview={preview} onFinishPreview={finishPreview} onSetView={setView} onUpdateEvidence={updateEvidence} onContext={setContextMenu} onEdit={(id) => { select([id]); setEditingId(id); }} onEndEdit={() => setEditingId(null)} onPointerPosition={(point) => { lastPointer.current = { point, time: Date.now() }; }} onToast={notify} />
      <ToolRail tool={tool} shapeKind={shapeKind} onTool={(next) => { setTool(next); setStringFrom(null); }} onShapeKind={setShapeKind} onUpload={() => openUpload()} />
      <Sidebar project={project} selection={selection} selectedConnectionId={selectedConnectionId} open={sidebarOpen} onToggle={() => setSidebarOpen((open) => !open)} onUpdateEvidence={updateEvidence} onUpdateConnection={updateConnection} onDelete={removeSelected} onFocus={focus} onAddTimeline={addTimeline} onDeleteTimeline={deleteTimeline} />
      {status === "error" && <div className="storage-warning"><AlertCircle size={15} /><span>Storage error: {storageError || "Changes may not be saved."}</span><button type="button" onClick={() => void saveNow().catch(() => {})}>Retry</button></div>}
      {progress && <div className="import-progress"><div className="progress-heading"><ImagePlus size={15} /> IMPORTING EVIDENCE <strong>{progress.current} / {progress.total}</strong></div><div className="progress-track"><span style={{ width: `${Math.max(5, progress.current / progress.total * 100)}%` }} /></div></div>}
    </div>
    <AssetTray project={project} assetUrls={assetUrls} onFocus={focus} onUpload={() => openUpload()} onImport={openImport} onFiles={(files) => void importFiles(files, boardRef.current?.center() ?? { x: 400, y: 300 })} />
    <input className="visually-hidden" ref={uploadRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif" multiple onChange={filePicked} aria-label="Upload image evidence" />
    <input className="visually-hidden" ref={importRef} type="file" accept=".zip,.blackarchive.zip,application/zip" onChange={casePicked} aria-label="Import investigation case file" />
    {contextMenu && <div className="board-context-menu" style={{ left: Math.min(contextMenu.x, typeof window !== "undefined" ? window.innerWidth - 212 : contextMenu.x), top: Math.min(contextMenu.y, typeof window !== "undefined" ? window.innerHeight - 266 : contextMenu.y) }} onPointerDown={(event) => event.stopPropagation()}>
      <div className="context-heading">{contextMenu.connectionId ? "CONNECTION" : contextMenu.id ? "EVIDENCE OPTIONS" : "BOARD OPTIONS"}</div>
      {contextMenu.connectionId ? <button type="button" onClick={() => contextAction("delete")}><Trash2 size={14} /> Remove connection <span>⌫</span></button> : <>
        <button type="button" onClick={() => contextAction("focus")}><Focus size={14} /> Center on evidence</button>
        <button type="button" onClick={() => contextAction("duplicate")}><FilePlus2 size={14} /> Duplicate <span>⌘ D</span></button>
        <button type="button" onClick={() => contextAction("copy")}><Clipboard size={14} /> Copy <span>⌘ C</span></button>
        <div className="context-divider" /><button type="button" onClick={() => contextAction("forward")}>↑ &nbsp; Bring to front</button><button type="button" onClick={() => contextAction("backward")}>↓ &nbsp; Send to back</button>
        <button type="button" onClick={() => contextAction("lock")}><LockKeyhole size={14} /> Lock / unlock</button>
        <div className="context-divider" /><button type="button" className="danger" onClick={() => contextAction("delete")}><Trash2 size={14} /> Delete <span>⌫</span></button>
      </>}
    </div>}
    {toast && <div key={toast.id} className={`archive-toast toast-${toast.kind}`} role="status">{toast.kind === "error" ? <AlertCircle size={16} /> : <Check size={16} />}<span>{toast.message}</span><button type="button" title="Dismiss" onClick={() => setToast(null)}><X size={14} /></button></div>}
    {modal && <div className="modal-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}><div className="archive-modal" role="dialog" aria-modal="true" aria-label={modal === "help" ? "Help and shortcuts" : modal === "settings" ? "Board settings" : "Investigation action"}>
      <div className="modal-top"><div className="modal-kicker">THE BLACK ARCHIVE / CASE DESK</div><button type="button" title="Close" onClick={() => setModal(null)}><X size={17} /></button></div>
      {modal === "help" ? <><div className="modal-title-row"><Keyboard size={24} /><h2>Field guide & shortcuts</h2></div><p className="modal-intro">The board is a local-first workspace. Nothing is uploaded to a cloud account.</p><div className="shortcuts-grid">{[["V / N / I / D", "Select / Note / Image / Document"], ["L / C / T / M", "Link / String / Text / Markings"], ["Space + drag", "Pan the board"], ["Mouse wheel", "Zoom at the pointer"], ["F", "Fit board to view"], ["Shift + click", "Select multiple clues"], ["Shift + drag on cork", "Marquee-select clues"], ["Double-click", "Edit a note or document"], ["⌘/Ctrl + C / V", "Copy / paste clues or images"], ["⌘/Ctrl + D", "Duplicate selected clues"], ["⌘/Ctrl + Z", "Undo"], ["⌘/Ctrl + Shift + Z", "Redo"], ["Delete / Backspace", "Remove selection"], ["Arrow keys", "Nudge selection (Shift: 10px)"], ["⌘/Ctrl + S", "Save now"], ["Escape", "Cancel tool or selection"]].map(([key, description]) => <div className="shortcut-row" key={key}><kbd>{key}</kbd><span>{description}</span></div>)}</div><div className="help-note"><ImagePlus size={17} /><span>Paste a screenshot, drop photos onto the cork, or upload multiple images. Use the String tool to click one clue and then another, or drag directly between them.</span></div><div className="modal-footer"><button type="button" className="modal-primary" onClick={() => setModal(null)}>Back to investigation</button></div></>
        : modal === "settings" ? <><div className="modal-title-row"><Settings2 size={24} /><h2>Board settings</h2></div><p className="modal-intro">These preferences are saved with this investigation.</p><div className="settings-group"><span>BOARD SURFACE</span><div className="setting-options"><button type="button" className={project.settings.background === "cork" ? "active" : ""} onClick={() => setSettings({ background: "cork" })}>Warm cork</button><button type="button" className={project.settings.background === "dark-cork" ? "active" : ""} onClick={() => setSettings({ background: "dark-cork" })}>Smoked cork</button></div></div><div className="settings-group"><span>DEFAULT STRING COLOR</span><div className="setting-options">{(["red", "ivory", "yellow", "neutral"] as const).map((color) => <button type="button" key={color} className={project.settings.defaultStringColor === color ? "active" : ""} onClick={() => setSettings({ defaultStringColor: color })}><span className={`settings-color color-${color}`} />{color}</button>)}</div></div><div className="settings-toggle"><div><strong>Subtle alignment grid</strong><small>Show a low-contrast grid over the cork</small></div><input type="checkbox" checked={project.settings.showGrid} onChange={(event) => setSettings({ showGrid: event.target.checked })} /></div><div className="settings-toggle"><div><strong>Board overview</strong><small>Show the clickable minimap</small></div><input type="checkbox" checked={project.settings.showMinimap} onChange={(event) => setSettings({ showMinimap: event.target.checked })} /></div><div className="settings-foot">All cases and imported images are stored in this browser using IndexedDB. Use Export to keep a portable backup.</div><div className="modal-footer"><button type="button" className="modal-primary" onClick={() => setModal(null)}>Done</button></div></>
        : modal === "link" ? <><div className="modal-title-row"><Link2 size={24} /><h2>Pin a source link</h2></div><p className="modal-intro">Add a URL to the board. Links open safely in a new tab.</p><label className="modal-field">SOURCE URL<input autoFocus value={linkForm.url} onChange={(event) => setLinkForm({ ...linkForm, url: event.target.value })} placeholder="https://example.org/source" onKeyDown={(event) => { if (event.key === "Enter") void submitModal(); }} /></label><label className="modal-field">EVIDENCE TITLE<input value={linkForm.title} onChange={(event) => setLinkForm({ ...linkForm, title: event.target.value })} placeholder="What is this source?" /></label><label className="modal-field">NOTES<textarea rows={3} value={linkForm.notes} onChange={(event) => setLinkForm({ ...linkForm, notes: event.target.value })} placeholder="Why might this matter?" /></label><div className="modal-footer"><button type="button" onClick={() => setModal(null)}>Cancel</button><button type="button" className="modal-primary" onClick={() => void submitModal()}>Pin source</button></div></>
        : <><div className="modal-title-row">{modal === "delete" || modal === "clear" ? <Trash2 size={24} /> : <FilePlus2 size={24} />}<h2>{modal === "new" ? "Open a new investigation" : modal === "rename" ? "Rename this investigation" : modal === "clear" ? "Clear this board?" : "Delete this investigation?"}</h2></div><p className="modal-intro">{modal === "new" ? "Begin with an empty corkboard. Your current case stays in the project menu." : modal === "rename" ? "Give this investigation a name that will be easy to find later." : modal === "clear" ? "This removes all evidence, strings, and timeline events from this case. You can undo it until you close the case." : "This permanently removes the current case from this browser. Export a backup first if you need one."}</p>{(modal === "new" || modal === "rename") && <label className="modal-field">INVESTIGATION NAME<input autoFocus value={modalText} onChange={(event) => setModalText(event.target.value)} placeholder="UNTITLED INVESTIGATION" onKeyDown={(event) => { if (event.key === "Enter") void submitModal(); }} /></label>}<div className="modal-footer"><button type="button" onClick={() => setModal(null)}>Cancel</button><button type="button" className={`modal-primary ${modal === "delete" || modal === "clear" ? "destructive" : ""}`} onClick={() => void submitModal()}>{modal === "new" ? "Create investigation" : modal === "rename" ? "Save name" : modal === "clear" ? "Clear board" : "Delete case"}</button></div></>}
    </div></div>}
  </main>;
}
