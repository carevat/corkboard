"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createBlankInvestigation, createDemoInvestigation, uid, type Connection, type Evidence, type Investigation, type Point, type TimelineEntry, type ViewState } from "@/lib/archive-types";
import { deleteInvestigation, getAsset, listInvestigations, saveInvestigation } from "@/lib/archive-storage";

export type SaveStatus = "loading" | "saving" | "saved" | "error";
const CURRENT_KEY = "black-archive-current-case";
const MAX_HISTORY = 60;

export function useArchive() {
  const [project, setProject] = useState<Investigation | null>(null);
  const projectRef = useRef<Investigation | null>(null);
  const [cases, setCases] = useState<Investigation[]>([]);
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<SaveStatus>("loading");
  const [storageError, setStorageError] = useState("");
  const [historyCounter, setHistoryCounter] = useState(0);
  const undoStack = useRef<Investigation[]>([]);
  const redoStack = useRef<Investigation[]>([]);
  const pendingSave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revision = useRef(0);
  const loadSequence = useRef(0);

  const loadUrls = useCallback(async (investigation: Investigation) => {
    const sequence = ++loadSequence.current;
    const ids = [...new Set(investigation.evidence.filter((e) => e.type === "image" && e.assetId).map((e) => (e.type === "image" ? e.assetId! : "")))];
    for (const id of ids) {
      try {
        const blob = await getAsset(id);
        if (sequence !== loadSequence.current) return;
        if (blob) setAssetUrls((current) => current[id] ? current : { ...current, [id]: URL.createObjectURL(blob) });
      } catch { /* A missing image is represented by the missing-image state on the board. */ }
    }
  }, []);

  const queueSave = useCallback((snapshot: Investigation) => {
    revision.current += 1;
    const myRevision = revision.current;
    setStatus("saving");
    setStorageError("");
    if (pendingSave.current) clearTimeout(pendingSave.current);
    pendingSave.current = setTimeout(async () => {
      pendingSave.current = null;
      try {
        await saveInvestigation(snapshot);
        if (myRevision === revision.current) {
          setStatus("saved");
          setCases((items) => [snapshot, ...items.filter((item) => item.id !== snapshot.id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
        }
      } catch (error) {
        if (myRevision === revision.current) {
          setStatus("error");
          setStorageError(error instanceof Error ? error.message : "Unable to save to this browser.");
        }
      }
    }, 600);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        let stored = await listInvestigations();
        if (!stored.length) {
          const demo = createDemoInvestigation();
          await saveInvestigation(demo);
          stored = [demo];
        }
        if (!active) return;
        const requested = localStorage.getItem(CURRENT_KEY);
        const chosen = stored.find((item) => item.id === requested) ?? stored[0];
        setCases(stored);
        projectRef.current = chosen;
        setProject(chosen);
        setStatus("saved");
        localStorage.setItem(CURRENT_KEY, chosen.id);
        void loadUrls(chosen);
      } catch (error) {
        if (!active) return;
        // The demo remains usable even if storage is unavailable; the error stays visible.
        const demo = createDemoInvestigation();
        projectRef.current = demo;
        setProject(demo);
        setCases([demo]);
        setStatus("error");
        setStorageError(error instanceof Error ? error.message : "Local storage is unavailable.");
      }
    })();
    return () => { active = false; if (pendingSave.current) clearTimeout(pendingSave.current); };
  }, [loadUrls]);

  const setCurrent = useCallback((next: Investigation, record = true, save = true) => {
    const before = projectRef.current;
    if (!before || next === before) return;
    if (record) {
      undoStack.current.push(before);
      if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
      redoStack.current = [];
      setHistoryCounter((n) => n + 1);
    }
    const updated = { ...next, updatedAt: new Date().toISOString() };
    projectRef.current = updated;
    setProject(updated);
    if (save) queueSave(updated);
  }, [queueSave]);

  const change = useCallback((updater: (current: Investigation) => Investigation, record = true) => {
    const before = projectRef.current;
    if (!before) return;
    setCurrent(updater(before), record);
  }, [setCurrent]);

  const preview = useCallback((before: Investigation, updater: (snapshot: Investigation) => Investigation) => {
    if (projectRef.current?.id !== before.id) return;
    const next = updater(before);
    projectRef.current = next;
    setProject(next);
  }, []);
  const finishPreview = useCallback((before: Investigation, record = true) => {
    const current = projectRef.current;
    if (!current || current.id !== before.id || current === before) return;
    if (record) {
      undoStack.current.push(before);
      if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
      redoStack.current = [];
      setHistoryCounter((n) => n + 1);
    }
    const next = { ...current, updatedAt: new Date().toISOString() };
    projectRef.current = next;
    setProject(next);
    queueSave(next);
  }, [queueSave]);

  const updateEvidence = useCallback((id: string, patch: Partial<Evidence>) => {
    change((p) => ({ ...p, evidence: p.evidence.map((e) => e.id === id ? { ...e, ...patch, updatedAt: new Date().toISOString() } as Evidence : e) }));
  }, [change]);
  const addEvidence = useCallback((items: Evidence[]) => {
    if (!items.length) return;
    change((p) => ({ ...p, evidence: [...p.evidence, ...items] }));
  }, [change]);
  const addConnection = useCallback((fromId: string, toId: string) => {
    const current = projectRef.current;
    if (!current || fromId === toId || current.connections.some((c) => (c.fromId === fromId && c.toId === toId) || (c.fromId === toId && c.toId === fromId))) return false;
    const newConnection: Connection = { id: uid(), fromId, toId, color: current.settings.defaultStringColor, width: 1.8, style: "straight", dash: "solid" };
    change((p) => ({ ...p, connections: [...p.connections, newConnection] }));
    return true;
  }, [change]);
  const updateConnection = useCallback((id: string, patch: Partial<Connection>) => {
    change((p) => ({ ...p, connections: p.connections.map((c) => c.id === id ? { ...c, ...patch } : c) }));
  }, [change]);
  const deleteSelection = useCallback((ids: string[], connectionId?: string | null) => {
    if (!ids.length && !connectionId) return;
    const removed = new Set(ids);
    change((p) => ({ ...p, evidence: p.evidence.filter((e) => !removed.has(e.id)), connections: p.connections.filter((c) => c.id !== connectionId && !removed.has(c.fromId) && !removed.has(c.toId)), timeline: p.timeline.map((t) => removed.has(t.evidenceId ?? "") ? { ...t, evidenceId: undefined } : t) }));
  }, [change]);
  const duplicateEvidence = useCallback((ids: string[], at?: Point): string[] => {
    const current = projectRef.current;
    if (!current) return [];
    const selected = current.evidence.filter((e) => ids.includes(e.id));
    if (!selected.length) return [];
    const minX = Math.min(...selected.map((e) => e.x));
    const minY = Math.min(...selected.map((e) => e.y));
    const map = new Map<string, string>();
    const zBase = Math.max(0, ...current.evidence.map((e) => e.z));
    const now = new Date().toISOString();
    const copies = selected.map((e, index) => {
      const id = uid(); map.set(e.id, id);
      return { ...e, id, x: at ? at.x + e.x - minX : e.x + 32, y: at ? at.y + e.y - minY : e.y + 32, z: zBase + index + 1, locked: false, createdAt: now, updatedAt: now } as Evidence;
    });
    const strings = current.connections.filter((c) => map.has(c.fromId) && map.has(c.toId)).map((c) => ({ ...c, id: uid(), fromId: map.get(c.fromId)!, toId: map.get(c.toId)! }));
    change((p) => ({ ...p, evidence: [...p.evidence, ...copies], connections: [...p.connections, ...strings] }));
    return copies.map((e) => e.id);
  }, [change]);
  const pasteEvidence = useCallback((items: Evidence[], strings: Connection[], at: Point): string[] => {
    if (!items.length) return [];
    const current = projectRef.current;
    if (!current) return [];
    const minX = Math.min(...items.map((e) => e.x));
    const minY = Math.min(...items.map((e) => e.y));
    const zBase = Math.max(0, ...current.evidence.map((e) => e.z));
    const map = new Map<string, string>();
    const now = new Date().toISOString();
    const copies = items.map((e, index) => {
      const id = uid(); map.set(e.id, id);
      return { ...e, id, x: at.x + e.x - minX, y: at.y + e.y - minY, z: zBase + index + 1, locked: false, createdAt: now, updatedAt: now } as Evidence;
    });
    const newStrings = strings.filter((c) => map.has(c.fromId) && map.has(c.toId)).map((c) => ({ ...c, id: uid(), fromId: map.get(c.fromId)!, toId: map.get(c.toId)! }));
    change((p) => ({ ...p, evidence: [...p.evidence, ...copies], connections: [...p.connections, ...newStrings] }));
    return copies.map((e) => e.id);
  }, [change]);
  const setView = useCallback((view: ViewState) => { change((p) => ({ ...p, view }), false); }, [change]);
  const setSettings = useCallback((settings: Partial<Investigation["settings"]>) => { change((p) => ({ ...p, settings: { ...p.settings, ...settings } })); }, [change]);
  const addTimeline = useCallback((date: string, title: string, detail: string) => {
    const entry: TimelineEntry = { id: uid(), date, title, detail };
    change((p) => ({ ...p, timeline: [...p.timeline, entry] }));
  }, [change]);
  const deleteTimeline = useCallback((id: string) => { change((p) => ({ ...p, timeline: p.timeline.filter((entry) => entry.id !== id) })); }, [change]);
  const rename = useCallback((title: string) => { if (title.trim()) change((p) => ({ ...p, title: title.trim() })); }, [change]);
  const clearBoard = useCallback(() => { change((p) => ({ ...p, evidence: [], connections: [], timeline: [] })); }, [change]);

  const undo = useCallback(() => {
    const previous = undoStack.current.pop();
    const current = projectRef.current;
    if (!previous || !current) return;
    redoStack.current.push(current);
    projectRef.current = previous; setProject(previous); setHistoryCounter((n) => n + 1); queueSave(previous);
  }, [queueSave]);
  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    const current = projectRef.current;
    if (!next || !current) return;
    undoStack.current.push(current);
    projectRef.current = next; setProject(next); setHistoryCounter((n) => n + 1); queueSave(next);
  }, [queueSave]);

  const activate = useCallback(async (next: Investigation, skipFlush = false) => {
    if (pendingSave.current) { clearTimeout(pendingSave.current); pendingSave.current = null; }
    if (!skipFlush && projectRef.current) {
      try { await saveInvestigation(projectRef.current); }
      catch { /* The new case can still be opened. */ }
    }
    revision.current += 1;
    undoStack.current = []; redoStack.current = []; setHistoryCounter((n) => n + 1);
    projectRef.current = next; setProject(next); setStatus("saved"); setStorageError("");
    localStorage.setItem(CURRENT_KEY, next.id);
    void loadUrls(next);
  }, [loadUrls]);
  const openCase = useCallback(async (id: string) => {
    const found = await listInvestigations();
    const next = found.find((item) => item.id === id);
    if (!next) throw new Error("This investigation could not be found.");
    await activate(next);
    setCases(found);
  }, [activate]);
  const createCase = useCallback(async (title?: string) => {
    const next = createBlankInvestigation(title);
    await saveInvestigation(next);
    await activate(next);
    setCases((items) => [next, ...items]);
    return next;
  }, [activate]);
  const duplicateCase = useCallback(async () => {
    const current = projectRef.current;
    if (!current) return;
    const next: Investigation = { ...JSON.parse(JSON.stringify(current)), id: uid(), title: `${current.title} / COPY`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await saveInvestigation(next);
    await activate(next);
    setCases((items) => [next, ...items]);
  }, [activate]);
  const importCase = useCallback(async (next: Investigation) => {
    await saveInvestigation(next);
    await activate(next);
    setCases((items) => [next, ...items]);
  }, [activate]);
  const removeCase = useCallback(async () => {
    const current = projectRef.current;
    if (!current) return;
    if (pendingSave.current) { clearTimeout(pendingSave.current); pendingSave.current = null; }
    revision.current += 1;
    await deleteInvestigation(current.id);
    let remaining = (await listInvestigations()).filter((item) => item.id !== current.id);
    if (!remaining.length) { const blank = createBlankInvestigation(); await saveInvestigation(blank); remaining = [blank]; }
    await activate(remaining[0], true);
    setCases(remaining);
  }, [activate]);
  const saveNow = useCallback(async () => {
    const current = projectRef.current;
    if (!current) return;
    if (pendingSave.current) { clearTimeout(pendingSave.current); pendingSave.current = null; }
    const token = ++revision.current;
    setStatus("saving");
    try { await saveInvestigation(current); if (token === revision.current) { setStatus("saved"); setStorageError(""); } }
    catch (error) { setStatus("error"); setStorageError(error instanceof Error ? error.message : "Save failed."); throw error; }
  }, []);
  const registerAsset = useCallback((id: string, blob: Blob) => {
    setAssetUrls((current) => ({ ...current, [id]: URL.createObjectURL(blob) }));
  }, []);

  void historyCounter;
  return { project, projectRef, cases, assetUrls, status, storageError, canUndo: undoStack.current.length > 0, canRedo: redoStack.current.length > 0,
    setCurrent, change, preview, finishPreview, updateEvidence, addEvidence, addConnection, updateConnection, deleteSelection,
    duplicateEvidence, pasteEvidence, setView, setSettings, addTimeline, deleteTimeline, rename, clearBoard, undo, redo,
    openCase, createCase, duplicateCase, importCase, removeCase, saveNow, registerAsset };
}
