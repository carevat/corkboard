"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Focus, Minus, Plus, UploadCloud } from "lucide-react";
import { BOARD_HEIGHT, BOARD_WIDTH, STRING_COLORS, makeEvidence, type Evidence, type Investigation, type Point, type ShapeEvidence, type ShapeKind, type Tool, type ViewState } from "@/lib/archive-types";
import { EvidenceCard, type Handle } from "./EvidenceCard";

export interface BoardHandle {
  fit: () => void;
  reset: () => void;
  focus: (id: string) => void;
  center: () => Point;
  fromClient: (x: number, y: number) => Point;
}
interface BoardProps {
  project: Investigation;
  assetUrls: Record<string, string>;
  selection: string[];
  selectedConnectionId: string | null;
  tool: Tool;
  shapeKind: ShapeKind;
  stringFrom: string | null;
  editingId: string | null;
  onSelect: (ids: string[], connectionId?: string | null) => void;
  onStringFrom: (id: string | null) => void;
  onAddAt: (tool: Tool, point: Point) => void;
  onAddShape: (shape: ShapeEvidence) => void;
  onConnect: (from: string, to: string) => void;
  onImportFiles: (files: File[], point: Point) => void;
  onImportUrl: (url: string, point: Point) => void;
  onDropAsset: (id: string, point: Point) => void;
  onPreview: (before: Investigation, updater: (snapshot: Investigation) => Investigation) => void;
  onFinishPreview: (before: Investigation, record?: boolean) => void;
  onSetView: (view: ViewState) => void;
  onUpdateEvidence: (id: string, patch: Partial<Evidence>) => void;
  onContext: (target: { id?: string; connectionId?: string; x: number; y: number }) => void;
  onEdit: (id: string) => void;
  onEndEdit: () => void;
  onPointerPosition: (point: Point) => void;
  onToast: (message: string, kind?: "error" | "success") => void;
}

type Action =
  | { kind: "move"; before: Investigation; start: Point; ids: string[]; moved: boolean }
  | { kind: "resize"; before: Investigation; start: Point; evidence: Evidence; handle: Exclude<Handle, "rotate">; moved: boolean }
  | { kind: "rotate"; before: Investigation; evidence: Evidence; center: Point; startAngle: number; moved: boolean }
  | { kind: "pan"; before: Investigation; startX: number; startY: number; moved: boolean }
  | { kind: "marquee"; startX: number; startY: number; additive: boolean }
  | { kind: "shape"; start: Point; points: Point[] }
  | { kind: "string"; from: string };

function pinPoint(e: Evidence): Point {
  const angle = e.rotation * Math.PI / 180;
  const vertical = 9 - e.height / 2;
  return { x: e.x + e.width / 2 - Math.sin(angle) * vertical, y: e.y + e.height / 2 + Math.cos(angle) * vertical };
}
function stringPath(a: Point, b: Point, curved: boolean): string {
  if (!curved) return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  const dx = b.x - a.x, dy = b.y - a.y, length = Math.max(1, Math.hypot(dx, dy));
  const bend = Math.min(55, length * .105);
  return `M ${a.x} ${a.y} Q ${(a.x + b.x) / 2 - dy / length * bend} ${(a.y + b.y) / 2 + dx / length * bend} ${b.x} ${b.y}`;
}
function isEditable(target: EventTarget | null) {
  return target instanceof HTMLElement && !!target.closest("input,textarea,[contenteditable='true']");
}

export const Board = forwardRef<BoardHandle, BoardProps>(function Board({ project, assetUrls, selection, selectedConnectionId, tool, shapeKind, stringFrom, editingId, onSelect, onStringFrom, onAddAt, onAddShape, onConnect, onImportFiles, onImportUrl, onDropAsset, onPreview, onFinishPreview, onSetView, onUpdateEvidence, onContext, onEdit, onEndEdit, onPointerPosition, onToast }, ref) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<Action | null>(null);
  const projectRef = useRef(project);
  const viewRef = useRef(project.view);
  const handlersRef = useRef({ project, tool, stringFrom, selection, onSelect, onStringFrom, onConnect, onEdit, onEndEdit, onUpdateEvidence, onContext });
  projectRef.current = project;
  viewRef.current = project.view;
  handlersRef.current = { project, tool, stringFrom, selection, onSelect, onStringFrom, onConnect, onEdit, onEndEdit, onUpdateEvidence, onContext };
  const [spaceHeld, setSpaceHeld] = useState(false);
  const spaceRef = useRef(false);
  const [dragOver, setDragOver] = useState(false);
  const dragDepth = useRef(0);
  const [marquee, setMarquee] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [shapeDraft, setShapeDraft] = useState<{ start: Point; end: Point; points: Point[] } | null>(null);
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);

  const fromClient = useCallback((clientX: number, clientY: number): Point => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    const view = viewRef.current;
    if (!rect) return { x: BOARD_WIDTH / 2, y: BOARD_HEIGHT / 2 };
    return { x: (clientX - rect.left - view.x) / view.zoom, y: (clientY - rect.top - view.y) / view.zoom };
  }, []);
  const center = useCallback((): Point => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return { x: BOARD_WIDTH / 2, y: BOARD_HEIGHT / 2 };
    const usableX = rect.width > 1050 ? (rect.width - 285) / 2 + 35 : rect.width / 2;
    return fromClient(rect.left + usableX, rect.top + rect.height / 2);
  }, [fromClient]);
  const fit = useCallback(() => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return;
    const isWide = rect.width > 1080;
    const leftGutter = isWide ? 92 : 28;
    const rightGutter = isWide ? 300 : 28;
    const minX = Math.min(0, ...projectRef.current.evidence.map((e) => e.x - 22));
    const minY = Math.min(0, ...projectRef.current.evidence.map((e) => e.y - 18));
    const maxX = Math.max(BOARD_WIDTH, ...projectRef.current.evidence.map((e) => e.x + e.width + 22));
    const maxY = Math.max(BOARD_HEIGHT, ...projectRef.current.evidence.map((e) => e.y + e.height + 18));
    const contentW = maxX - minX, contentH = maxY - minY;
    const availableW = Math.max(250, rect.width - leftGutter - rightGutter);
    const zoom = Math.max(.25, Math.min(1.15, availableW / contentW, (rect.height - 42) / contentH));
    onSetView({ zoom, x: leftGutter + (availableW - contentW * zoom) / 2 - minX * zoom, y: (rect.height - contentH * zoom) / 2 - minY * zoom });
  }, [onSetView]);
  const reset = useCallback(() => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.width > 1080 ? (rect.width - 285) / 2 + 35 : rect.width / 2;
    onSetView({ zoom: 1, x: centerX - BOARD_WIDTH / 2, y: rect.height / 2 - BOARD_HEIGHT / 2 });
  }, [onSetView]);
  const focus = useCallback((id: string) => {
    const e = projectRef.current.evidence.find((item) => item.id === id);
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!e || !rect) return;
    const zoom = Math.max(.78, Math.min(1.15, viewRef.current.zoom));
    const targetX = rect.width > 1080 ? (rect.width - 278) / 2 + 35 : rect.width / 2;
    onSetView({ zoom, x: targetX - (e.x + e.width / 2) * zoom, y: rect.height / 2 - (e.y + e.height / 2) * zoom });
  }, [onSetView]);
  useImperativeHandle(ref, () => ({ fit, reset, focus, center, fromClient }), [fit, reset, focus, center, fromClient]);

  useEffect(() => {
    if (project.view.x === 0 && project.view.y === 0 && project.view.zoom === 1) {
      const frame = requestAnimationFrame(() => fit());
      return () => cancelAnimationFrame(frame);
    }
    // Only refit a newly opened project, not after every drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);
  useEffect(() => {
    function down(event: KeyboardEvent) {
      if (event.code === "Space" && !isEditable(event.target)) { spaceRef.current = true; setSpaceHeld(true); event.preventDefault(); }
    }
    function up(event: KeyboardEvent) { if (event.code === "Space") { spaceRef.current = false; setSpaceHeld(false); } }
    function blur() { spaceRef.current = false; setSpaceHeld(false); }
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }, []);
  useEffect(() => {
    const element = surfaceRef.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if (isEditable(event.target)) return;
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const old = viewRef.current;
      const cx = event.clientX - rect.left, cy = event.clientY - rect.top;
      const worldX = (cx - old.x) / old.zoom, worldY = (cy - old.y) / old.zoom;
      const nextZoom = Math.max(.25, Math.min(2.4, old.zoom * Math.exp(-event.deltaY * .00125)));
      onSetView({ zoom: nextZoom, x: cx - worldX * nextZoom, y: cy - worldY * nextZoom });
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [onSetView]);

  const capture = useCallback((pointerId: number) => { try { surfaceRef.current?.setPointerCapture(pointerId); } catch { /* The pointer may already have been released. */ } }, []);
  const startObject = useCallback((id: string, event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const { project: current, tool: activeTool, stringFrom: source, selection: selected, onSelect: choose, onStringFrom: setSource, onConnect: connectItems } = handlersRef.current;
    const e = current.evidence.find((item) => item.id === id);
    if (!e) return;
    if (spaceRef.current) {
      actionRef.current = { kind: "pan", before: current, startX: event.clientX, startY: event.clientY, moved: false };
      capture(event.pointerId);
      return;
    }
    if (activeTool === "string") {
      if (source && source !== id) { connectItems(source, id); setSource(null); setHoverPoint(null); return; }
      setSource(id);
      actionRef.current = { kind: "string", from: id };
      capture(event.pointerId);
      return;
    }
    if (event.shiftKey) {
      choose(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id], null);
      return;
    }
    const ids = selected.includes(id) ? selected : [id];
    choose(ids, null);
    if (e.locked || activeTool !== "select") return;
    actionRef.current = { kind: "move", before: current, start: fromClient(event.clientX, event.clientY), ids, moved: false };
    // Capture begins at first movement, allowing native double-click to reach this card.
  }, [capture, fromClient]);
  const startHandle = useCallback((id: string, handle: Handle, event: ReactPointerEvent<HTMLSpanElement>) => {
    event.preventDefault(); event.stopPropagation();
    const current = handlersRef.current.project;
    const e = current.evidence.find((item) => item.id === id);
    if (!e || e.locked) return;
    const point = fromClient(event.clientX, event.clientY);
    if (handle === "rotate") {
      const centerPoint = { x: e.x + e.width / 2, y: e.y + e.height / 2 };
      actionRef.current = { kind: "rotate", before: current, evidence: e, center: centerPoint, startAngle: Math.atan2(point.y - centerPoint.y, point.x - centerPoint.x), moved: false };
    } else actionRef.current = { kind: "resize", before: current, start: point, evidence: e, handle, moved: false };
    capture(event.pointerId);
  }, [capture, fromClient]);
  const editBody = useCallback((id: string, body: string) => handlersRef.current.onUpdateEvidence(id, { body } as Partial<Evidence>), []);
  const beginEdit = useCallback((id: string) => handlersRef.current.onEdit(id), []);
  const endEdit = useCallback(() => handlersRef.current.onEndEdit(), []);
  const openCardContext = useCallback((id: string, event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault(); event.stopPropagation();
    if (!handlersRef.current.selection.includes(id)) handlersRef.current.onSelect([id], null);
    handlersRef.current.onContext({ id, x: event.clientX, y: event.clientY });
  }, []);
  const blankDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 1) return;
    if (event.target !== event.currentTarget && !(event.target instanceof Element && event.target.closest(".world-layer,.board-grid-overlay"))) return;
    const point = fromClient(event.clientX, event.clientY);
    if (tool === "string" && !spaceRef.current) { onStringFrom(null); onSelect([], null); return; }
    if (!spaceRef.current && event.button === 0 && tool === "shape") {
      actionRef.current = { kind: "shape", start: point, points: [point] };
      setShapeDraft({ start: point, end: point, points: [point] });
      capture(event.pointerId); event.preventDefault(); return;
    }
    if (!spaceRef.current && event.button === 0 && tool !== "select") {
      onAddAt(tool, point); event.preventDefault(); return;
    }
    if (event.shiftKey && !spaceRef.current && event.button === 0) {
      const rect = surfaceRef.current!.getBoundingClientRect();
      actionRef.current = { kind: "marquee", startX: event.clientX - rect.left, startY: event.clientY - rect.top, additive: true };
      capture(event.pointerId); return;
    }
    if (!spaceRef.current && event.button === 0) onSelect([], null);
    actionRef.current = { kind: "pan", before: project, startX: event.clientX, startY: event.clientY, moved: false };
    capture(event.pointerId);
  };
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const point = fromClient(event.clientX, event.clientY);
    onPointerPosition(point);
    if (tool === "string" && stringFrom) setHoverPoint(point);
    const action = actionRef.current;
    if (!action) return;
    if (action.kind === "move") {
      const dx = point.x - action.start.x, dy = point.y - action.start.y;
      if (Math.abs(dx) + Math.abs(dy) < .4 && !action.moved) return;
      if (!action.moved) capture(event.pointerId);
      action.moved = true;
      onPreview(action.before, (snapshot) => ({ ...snapshot, evidence: snapshot.evidence.map((e) => action.ids.includes(e.id) && !e.locked ? { ...e, x: e.x + dx, y: e.y + dy } : e) }));
    } else if (action.kind === "resize") {
      const e = action.evidence;
      const dx = point.x - action.start.x, dy = point.y - action.start.y;
      if (Math.abs(dx) + Math.abs(dy) < .4 && !action.moved) return;
      action.moved = true;
      const angle = e.rotation * Math.PI / 180;
      const localDx = dx * Math.cos(angle) + dy * Math.sin(angle);
      const localDy = -dx * Math.sin(angle) + dy * Math.cos(angle);
      const west = action.handle.includes("w"), north = action.handle.includes("n");
      const minW = e.type === "shape" ? 26 : 110, minH = e.type === "shape" ? 26 : 65;
      let width = Math.max(minW, e.width + (west ? -localDx : localDx));
      let height = Math.max(minH, e.height + (north ? -localDy : localDy));
      if (e.type === "image" && !event.shiftKey) {
        const ratio = e.width / e.height;
        if (Math.abs(localDx) >= Math.abs(localDy)) height = Math.max(minH, width / ratio);
        else width = Math.max(minW, height * ratio);
      }
      const x = e.x + (west ? e.width - width : 0);
      const y = e.y + (north ? e.height - height : 0);
      onPreview(action.before, (snapshot) => ({ ...snapshot, evidence: snapshot.evidence.map((item) => item.id === e.id ? { ...item, x, y, width, height } : item) }));
    } else if (action.kind === "rotate") {
      const angle = Math.atan2(point.y - action.center.y, point.x - action.center.x);
      let rotation = action.evidence.rotation + (angle - action.startAngle) * 180 / Math.PI;
      if (event.shiftKey) rotation = Math.round(rotation / 15) * 15;
      action.moved = true;
      onPreview(action.before, (snapshot) => ({ ...snapshot, evidence: snapshot.evidence.map((e) => e.id === action.evidence.id ? { ...e, rotation: Math.round(rotation * 10) / 10 } : e) }));
    } else if (action.kind === "pan") {
      const dx = event.clientX - action.startX, dy = event.clientY - action.startY;
      if (Math.abs(dx) + Math.abs(dy) < 1 && !action.moved) return;
      action.moved = true;
      onPreview(action.before, (snapshot) => ({ ...snapshot, view: { ...snapshot.view, x: snapshot.view.x + dx, y: snapshot.view.y + dy } }));
    } else if (action.kind === "marquee") {
      const rect = surfaceRef.current!.getBoundingClientRect();
      const x = event.clientX - rect.left, y = event.clientY - rect.top;
      setMarquee({ x: Math.min(x, action.startX), y: Math.min(y, action.startY), width: Math.abs(x - action.startX), height: Math.abs(y - action.startY) });
    } else if (action.kind === "shape") {
      if (shapeKind === "freehand") action.points.push(point);
      setShapeDraft({ start: action.start, end: point, points: [...action.points] });
    }
  };
  const pointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const action = actionRef.current;
    if (!action) return;
    actionRef.current = null;
    if (action.kind === "move" || action.kind === "resize" || action.kind === "rotate") {
      if (action.moved) onFinishPreview(action.before, true);
    } else if (action.kind === "pan") {
      if (action.moved) onFinishPreview(action.before, false);
    } else if (action.kind === "marquee") {
      const rect = surfaceRef.current!.getBoundingClientRect();
      const ax = Math.min(action.startX, event.clientX - rect.left), ay = Math.min(action.startY, event.clientY - rect.top);
      const bx = Math.max(action.startX, event.clientX - rect.left), by = Math.max(action.startY, event.clientY - rect.top);
      if (bx - ax > 5 && by - ay > 5) {
        const topLeft = fromClient(rect.left + ax, rect.top + ay), bottomRight = fromClient(rect.left + bx, rect.top + by);
        const ids = projectRef.current.evidence.filter((e) => e.x < bottomRight.x && e.x + e.width > topLeft.x && e.y < bottomRight.y && e.y + e.height > topLeft.y).map((e) => e.id);
        onSelect(action.additive ? [...new Set([...selection, ...ids])] : ids, null);
      }
      setMarquee(null);
    } else if (action.kind === "shape") {
      const end = fromClient(event.clientX, event.clientY);
      const points = shapeKind === "freehand" ? [...action.points, end] : [action.start, end];
      const minX = Math.min(...points.map((p) => p.x)), minY = Math.min(...points.map((p) => p.y));
      const maxX = Math.max(...points.map((p) => p.x)), maxY = Math.max(...points.map((p) => p.y));
      if (Math.hypot(end.x - action.start.x, end.y - action.start.y) > 7 || (shapeKind === "freehand" && points.length > 3)) {
        const base = makeEvidence("shape", { x: minX, y: minY }, Math.max(1, ...projectRef.current.evidence.map((e) => e.z)) + 1, shapeKind) as ShapeEvidence;
        onAddShape({ ...base, width: Math.max(25, maxX - minX), height: Math.max(25, maxY - minY), points: shapeKind === "freehand" ? points.map((p) => ({ x: p.x - minX, y: p.y - minY })) : [] });
      }
      setShapeDraft(null);
    } else if (action.kind === "string") {
      const element = document.elementFromPoint(event.clientX, event.clientY);
      const targetId = element instanceof Element ? element.closest("[data-evidence-id]")?.getAttribute("data-evidence-id") : null;
      if (targetId && targetId !== action.from) { onConnect(action.from, targetId); onStringFrom(null); setHoverPoint(null); }
    }
    try { if (surfaceRef.current?.hasPointerCapture(event.pointerId)) surfaceRef.current.releasePointerCapture(event.pointerId); } catch { /* Already released. */ }
  };
  const pointerCancel = () => {
    const action = actionRef.current;
    if (action && "before" in action) onPreview(action.before, (snapshot) => snapshot);
    actionRef.current = null; setShapeDraft(null); setMarquee(null);
  };

  const zoomBy = (factor: number) => {
    const rect = surfaceRef.current?.getBoundingClientRect(); if (!rect) return;
    const old = project.view, zoom = Math.max(.25, Math.min(2.4, old.zoom * factor));
    const cx = rect.width > 1080 ? (rect.width - 285) / 2 + 35 : rect.width / 2, cy = rect.height / 2;
    onSetView({ zoom, x: cx - (cx - old.x) / old.zoom * zoom, y: cy - (cy - old.y) / old.zoom * zoom });
  };
  const dragEnter = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); dragDepth.current++; setDragOver(true); };
  const dragLeave = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); dragDepth.current = Math.max(0, dragDepth.current - 1); if (dragDepth.current === 0) setDragOver(false); };
  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault(); event.stopPropagation(); dragDepth.current = 0; setDragOver(false);
    const point = fromClient(event.clientX, event.clientY);
    const assetId = event.dataTransfer.getData("application/x-black-archive-evidence");
    if (assetId) { onDropAsset(assetId, point); return; }
    const files = Array.from(event.dataTransfer.files);
    if (files.length) { onImportFiles(files, point); return; }
    const html = event.dataTransfer.getData("text/html");
    let url = "";
    if (html) {
      const documentFragment = new DOMParser().parseFromString(html, "text/html");
      url = documentFragment.querySelector("img")?.getAttribute("src") || "";
    }
    url ||= event.dataTransfer.getData("text/uri-list").split("\n").find((line) => line.startsWith("http")) || "";
    url ||= event.dataTransfer.getData("text/plain").trim();
    if (/^https?:\/\//i.test(url)) onImportUrl(url, point);
    else onToast("Drop an image file, a direct image URL, or an asset from the tray.", "error");
  };

  const evidenceMap = new Map(project.evidence.map((e) => [e.id, e]));
  const sorted = [...project.evidence].sort((a, b) => a.z - b.z);
  const stringStart = stringFrom ? evidenceMap.get(stringFrom) : undefined;
  const previewString = stringStart && hoverPoint ? stringPath(pinPoint(stringStart), hoverPoint, false) : "";
  const bounds = { minX: 0, minY: 0, maxX: Math.max(BOARD_WIDTH, ...project.evidence.map((e) => e.x + e.width)), maxY: Math.max(BOARD_HEIGHT, ...project.evidence.map((e) => e.y + e.height)) };
  const miniW = 164, miniH = 95;
  const miniX = (n: number) => (n - bounds.minX) / (bounds.maxX - bounds.minX) * miniW;
  const miniY = (n: number) => (n - bounds.minY) / (bounds.maxY - bounds.minY) * miniH;
  const surfaceRect = surfaceRef.current?.getBoundingClientRect();
  const visibleRect = surfaceRect ? { x: miniX(-project.view.x / project.view.zoom), y: miniY(-project.view.y / project.view.zoom), w: surfaceRect.width / project.view.zoom / (bounds.maxX - bounds.minX) * miniW, h: surfaceRect.height / project.view.zoom / (bounds.maxY - bounds.minY) * miniH } : null;
  const draftX = shapeDraft ? Math.min(shapeDraft.start.x, shapeDraft.end.x) : 0;
  const draftY = shapeDraft ? Math.min(shapeDraft.start.y, shapeDraft.end.y) : 0;
  return (
    <div className="board-root">
      <div className="board-wood">
        <div ref={surfaceRef} className={`board-surface background-${project.settings.background} ${project.settings.showGrid ? "with-grid" : ""} ${spaceHeld ? "space-held" : ""} ${tool === "string" ? "string-mode" : ""} ${tool === "shape" ? "shape-mode" : ""} ${dragOver ? "is-drop-target" : ""}`}
          onPointerDown={blankDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerCancel}
          onDragEnter={dragEnter} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }} onDragLeave={dragLeave} onDrop={drop}
          onContextMenu={(event) => { if (event.target === event.currentTarget) { event.preventDefault(); onContext({ x: event.clientX, y: event.clientY }); } }}
        >
          <div className="board-grid-overlay" />
          <div className="world-layer" style={{ transform: `translate3d(${project.view.x}px, ${project.view.y}px, 0) scale(${project.view.zoom})`, "--handle-scale": Math.min(3, Math.max(.75, 1 / project.view.zoom)) } as CSSProperties}>
            <svg className="string-layer" width={BOARD_WIDTH} height={BOARD_HEIGHT} viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}>
              <defs><filter id="thread-shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="1" dy="2" stdDeviation="1.2" floodColor="#000" floodOpacity=".75" /></filter></defs>
              {project.connections.map((connection) => {
                const from = evidenceMap.get(connection.fromId), to = evidenceMap.get(connection.toId);
                if (!from || !to) return null;
                const a = pinPoint(from), b = pinPoint(to);
                const path = stringPath(a, b, connection.style === "curved");
                const chosen = selectedConnectionId === connection.id;
                return <g key={connection.id} className={chosen ? "connection-selected" : ""}>
                  <path d={path} fill="none" stroke="#160f0d" strokeWidth={connection.width + 2.6} opacity=".65" />
                  <path d={path} fill="none" stroke={STRING_COLORS[connection.color]} strokeWidth={connection.width + (chosen ? 1.4 : 0)} strokeDasharray={connection.dash === "dashed" ? "8 6" : undefined} filter="url(#thread-shadow)" strokeLinecap="round" />
                  <circle cx={a.x} cy={a.y} r="3.4" fill={STRING_COLORS[connection.color]} stroke="#2d1c16" strokeWidth="1.3" /><circle cx={b.x} cy={b.y} r="3.4" fill={STRING_COLORS[connection.color]} stroke="#2d1c16" strokeWidth="1.3" />
                  <path d={path} fill="none" stroke="transparent" strokeWidth="18" className="connection-hit" onPointerDown={(event) => { event.stopPropagation(); onSelect([], connection.id); }} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onContext({ connectionId: connection.id, x: event.clientX, y: event.clientY }); }} />
                </g>;
              })}
              {previewString && <path d={previewString} fill="none" stroke={STRING_COLORS[project.settings.defaultStringColor]} strokeWidth="2" strokeDasharray="6 5" opacity=".85" />}
            </svg>
            {sorted.map((e) => <EvidenceCard key={e.id} evidence={e} assetUrl={e.type === "image" && e.assetId ? assetUrls[e.assetId] : undefined} selected={selection.includes(e.id)} soleSelected={selection.length === 1} editing={editingId === e.id} stringSource={stringFrom === e.id} onStart={startObject} onHandleStart={startHandle} onEdit={beginEdit} onEndEdit={endEdit} onBodyChange={editBody} onContext={openCardContext} />)}
            {shapeDraft && <svg className="shape-draft" style={{ left: draftX, top: draftY }} width={Math.max(2, Math.abs(shapeDraft.end.x - shapeDraft.start.x))} height={Math.max(2, Math.abs(shapeDraft.end.y - shapeDraft.start.y))} viewBox={`0 0 ${Math.max(2, Math.abs(shapeDraft.end.x - shapeDraft.start.x))} ${Math.max(2, Math.abs(shapeDraft.end.y - shapeDraft.start.y))}`}>
              {shapeKind === "rectangle" && <rect x="1" y="1" width="98%" height="98%" fill="none" stroke="#b94a3e" strokeWidth="3" />}
              {shapeKind === "ellipse" && <ellipse cx="50%" cy="50%" rx="48%" ry="48%" fill="none" stroke="#b94a3e" strokeWidth="3" />}
              {shapeKind === "arrow" && <path d={`M2 ${Math.abs(shapeDraft.end.y - shapeDraft.start.y) - 2} L${Math.abs(shapeDraft.end.x - shapeDraft.start.x) - 2} 2`} fill="none" stroke="#b94a3e" strokeWidth="3" />}
              {shapeKind === "freehand" && <polyline points={shapeDraft.points.map((p) => `${p.x - draftX},${p.y - draftY}`).join(" ")} fill="none" stroke="#b94a3e" strokeWidth="3" />}
            </svg>}
          </div>
          {marquee && <div className="board-marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.width, height: marquee.height }} />}
          {project.evidence.length === 0 && <div className="empty-board-message"><span className="empty-crosshair">⌖</span><small>AN OPEN CASE</small><h2>Every lead starts somewhere.</h2><p>Drop a photograph, paste a screenshot, or choose a tool to begin.</p><button type="button" onClick={(event) => { event.stopPropagation(); onAddAt("image", center()); }}><UploadCloud size={15} /> Add your first image</button></div>}
          {dragOver && <div className="board-drop-overlay"><div><UploadCloud size={31} strokeWidth={1.3} /><strong>DROP TO ADD EVIDENCE</strong><span>Images land exactly where you place them</span></div></div>}
        </div>
      </div>
      <div className="board-zoom-controls" onPointerDown={(event) => event.stopPropagation()}>
        <button type="button" title="Zoom out" onClick={() => zoomBy(1 / 1.2)}><Minus size={14} /></button>
        <span>{Math.round(project.view.zoom * 100)}%</span>
        <button type="button" title="Zoom in" onClick={() => zoomBy(1.2)}><Plus size={14} /></button>
        <i />
        <button type="button" title="Fit board to view" onClick={fit}><Focus size={16} /></button>
        <button type="button" title="Reset view to 100%" onClick={reset} className="reset-zoom-button">1:1</button>
      </div>
      {project.settings.showMinimap && project.evidence.length > 0 && <div className="board-minimap" title="Click to navigate the board" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width * (bounds.maxX - bounds.minX) + bounds.minX;
        const y = (event.clientY - rect.top) / rect.height * (bounds.maxY - bounds.minY) + bounds.minY;
        const surface = surfaceRef.current?.getBoundingClientRect();
        if (surface) onSetView({ ...project.view, x: surface.width / 2 - x * project.view.zoom, y: surface.height / 2 - y * project.view.zoom });
      }}>
        <div className="minimap-label">BOARD OVERVIEW <span>⌖</span></div>
        <div className="minimap-content" style={{ width: miniW, height: miniH }}>
          {project.evidence.map((e) => <span key={e.id} className={`mini-object mini-${e.type} ${selection.includes(e.id) ? "active" : ""}`} style={{ left: miniX(e.x), top: miniY(e.y), width: Math.max(2, miniX(e.width)), height: Math.max(2, miniY(e.height)) }} />)}
          {visibleRect && <span className="minimap-viewport" style={{ left: visibleRect.x, top: visibleRect.y, width: visibleRect.w, height: visibleRect.h }} />}
        </div>
      </div>}
    </div>
  );
});
