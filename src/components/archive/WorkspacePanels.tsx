"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Archive, ArrowDownToLine, ArrowUpRight, BadgeHelp, BringToFront, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Circle, CloudOff, Copy, Ellipsis, FilePlus2, FileText, Focus, GitBranch, ImagePlus, Layers2, Link2, LockKeyhole, Menu, Minus, MoreHorizontal, MousePointer2, Pencil, Plus, Redo2, RotateCcw, Save, Settings2, Shapes, Share2, StickyNote, Trash2, Type, Undo2, UnlockKeyhole, UploadCloud, X } from "lucide-react";
import { STATUS_LABELS, STRING_COLORS, type Connection, type Evidence, type Investigation, type ShapeKind, type Tool } from "@/lib/archive-types";
import type { SaveStatus } from "@/hooks/use-archive";

export type MenuAction = "new" | "rename" | "duplicate" | "clear" | "delete" | "export" | "import" | "summary" | "help" | "settings";
interface TopBarProps {
  project: Investigation; cases: Investigation[]; status: SaveStatus; canUndo: boolean; canRedo: boolean;
  onOpenCase: (id: string) => void; onAction: (action: MenuAction) => void; onUndo: () => void; onRedo: () => void; onSave: () => void; onToggleSidebar: () => void;
}
function ArchiveMark() {
  return <svg className="archive-mark" viewBox="0 0 42 42" fill="none" aria-hidden="true"><path d="M21 2 40 36H2L21 2Z" stroke="currentColor" strokeWidth="1.5" /><path d="M21 9 34 33H8L21 9Z" stroke="currentColor" strokeWidth=".7" opacity=".75" /><path d="M11 24c3.2-4.4 6.6-6.5 10-6.5s6.8 2.1 10 6.5c-3.2 4.4-6.6 6.5-10 6.5s-6.8-2.1-10-6.5Z" stroke="currentColor" strokeWidth="1.3" /><circle cx="21" cy="24" r="3.3" stroke="currentColor" strokeWidth="1.2" /><path d="M21 1V0M1 36l-1 2m41-2 1 2" stroke="currentColor" /></svg>;
}
export function TopBar({ project, cases, status, canUndo, canRedo, onOpenCase, onAction, onUndo, onRedo, onSave, onToggleSidebar }: TopBarProps) {
  const [menu, setMenu] = useState<"project" | "share" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenu(null); };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, []);
  const act = (action: MenuAction) => { setMenu(null); onAction(action); };
  return <header className="topbar" ref={menuRef}>
    <Link href="/" className="brand-block" title="Return to the archive homepage"><ArchiveMark /><div className="brand-words"><strong>THE BLACK ARCHIVE</strong><small>INVESTIGATION WORKSPACE</small></div></Link>
    <div className="topbar-divider" />
    <div className="project-switch-wrap">
      <button type="button" className={`project-switch ${menu === "project" ? "is-open" : ""}`} onClick={() => setMenu(menu === "project" ? null : "project")} title="Switch or manage investigations"><span className="project-overline">CURRENT INVESTIGATION</span><span className="project-current">{project.title}<ChevronDown size={14} /></span></button>
      {menu === "project" && <div className="header-menu project-menu"><div className="menu-eyebrow">YOUR INVESTIGATIONS <span>{cases.length}</span></div>
        <div className="case-list">{cases.map((item) => <button type="button" key={item.id} className={`case-menu-row ${item.id === project.id ? "active" : ""}`} onClick={() => { setMenu(null); onOpenCase(item.id); }}><span className="case-row-icon"><Archive size={15} /></span><span><strong>{item.title}</strong><small>{item.evidence.length} pieces of evidence · {new Date(item.updatedAt).toLocaleDateString()}</small></span>{item.id === project.id && <Check size={14} />}</button>)}</div>
        <div className="menu-divider" />
        <button type="button" className="menu-item" onClick={() => act("new")}><Plus size={15} /> New blank investigation</button>
        <button type="button" className="menu-item" onClick={() => act("rename")}><Pencil size={15} /> Rename investigation</button>
        <button type="button" className="menu-item" onClick={() => act("duplicate")}><Copy size={15} /> Duplicate investigation</button>
        <button type="button" className="menu-item" onClick={() => act("clear")}><RotateCcw size={15} /> Clear this board</button>
        <button type="button" className="menu-item danger" onClick={() => act("delete")}><Trash2 size={15} /> Delete investigation</button>
      </div>}
    </div>
    <div className="save-cluster"><button type="button" className={`save-status save-${status}`} onClick={onSave} title={status === "error" ? "Save failed — click to retry" : "Save now"}>{status === "saved" ? <CheckCheck size={14} /> : status === "error" ? <CloudOff size={14} /> : <Save size={14} />}<span>{status === "saved" ? "Saved locally" : status === "saving" ? "Saving…" : status === "error" ? "Save error" : "Opening…"}</span></button><span className="save-divider" /><button type="button" className="header-icon-button" title="Undo · Ctrl/⌘ Z" onClick={onUndo} disabled={!canUndo}><Undo2 size={17} /></button><button type="button" className="header-icon-button" title="Redo · Ctrl/⌘ Shift Z" onClick={onRedo} disabled={!canRedo}><Redo2 size={17} /></button></div>
    <div className="topbar-spacer" />
    <span className="local-badge"><span /> LOCAL ONLY</span>
    <div className="share-wrap"><button type="button" className="share-button" onClick={() => setMenu(menu === "share" ? null : "share")}><Share2 size={15} /> <span>Share / Export</span> <ChevronDown size={13} /></button>
      {menu === "share" && <div className="header-menu share-menu"><div className="menu-eyebrow">CASE FILE</div><button type="button" className="menu-item" onClick={() => act("export")}><ArrowDownToLine size={15} /> Export complete case (.zip)</button><button type="button" className="menu-item" onClick={() => act("import")}><UploadCloud size={15} /> Import a case file</button><button type="button" className="menu-item" onClick={() => act("summary")}><Copy size={15} /> Copy case summary</button><div className="menu-footnote">Investigations live in this browser. Export a file to share one.</div></div>}
    </div>
    <button type="button" className="header-round" title="Keyboard shortcuts and help" onClick={() => onAction("help")}><BadgeHelp size={18} /></button>
    <button type="button" className="header-round" title="Board settings" onClick={() => onAction("settings")}><Settings2 size={17} /></button>
    <button type="button" className="header-round sidebar-toggle-header" title="Toggle case intelligence" onClick={onToggleSidebar}><Menu size={17} /></button>
    <div className="user-seal" title="Your local workspace">BA</div>
  </header>;
}

const tools: { id: Tool; label: string; shortcut: string; icon: typeof MousePointer2 }[] = [
  { id: "select", label: "Select", shortcut: "V", icon: MousePointer2 },
  { id: "note", label: "Note", shortcut: "N", icon: StickyNote },
  { id: "image", label: "Image", shortcut: "I", icon: ImagePlus },
  { id: "document", label: "Document", shortcut: "D", icon: FileText },
  { id: "link", label: "Link", shortcut: "L", icon: Link2 },
  { id: "string", label: "String", shortcut: "C", icon: GitBranch },
  { id: "text", label: "Text", shortcut: "T", icon: Type },
  { id: "shape", label: "Markings", shortcut: "M", icon: Shapes },
];
export function ToolRail({ tool, shapeKind, onTool, onShapeKind, onUpload }: { tool: Tool; shapeKind: ShapeKind; onTool: (tool: Tool) => void; onShapeKind: (shape: ShapeKind) => void; onUpload: () => void }) {
  const [showShapes, setShowShapes] = useState(false);
  return <nav className="tool-rail" aria-label="Board tools"><div className="rail-label">TOOLS <span>08</span></div><div className="rail-tools">{tools.map(({ id, label, shortcut, icon: Icon }) => <div className="rail-tool-wrap" key={id}><button type="button" title={`${label} · ${shortcut}${id === "image" ? " · click board or upload" : ""}`} className={`rail-tool ${tool === id ? "active" : ""}`} onClick={() => { if (id === "image") { onTool(id); onUpload(); } else { onTool(id); if (id === "shape") setShowShapes(!showShapes); else setShowShapes(false); } }}><Icon size={17} strokeWidth={tool === id ? 2 : 1.8} /><span>{label}</span>{id === "shape" && <ChevronDown size={11} className="rail-chevron" />}</button></div>)}</div>
    {showShapes && <div className="shape-options"><div className="menu-eyebrow">DRAW MARKING</div>{(["rectangle", "ellipse", "arrow", "freehand"] as ShapeKind[]).map((kind) => <button key={kind} type="button" className={shapeKind === kind ? "active" : ""} onClick={() => { onShapeKind(kind); onTool("shape"); setShowShapes(false); }}>{kind === "freehand" ? <Pencil size={14} /> : kind === "ellipse" ? <Circle size={14} /> : kind === "arrow" ? <ArrowUpRight size={14} /> : <Shapes size={14} />}{kind === "ellipse" ? "Circle" : kind.charAt(0).toUpperCase() + kind.slice(1)}</button>)}</div>}
    <div className="rail-foot"><span className="rail-foot-dot" /> CASE TOOLS</div>
  </nav>;
}

function Section({ title, count, open, onToggle, children, action }: { title: string; count?: number; open: boolean; onToggle: () => void; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className="sidebar-section"><div className="section-heading"><button type="button" onClick={onToggle}><span>{title}</span>{count !== undefined && <small>{count}</small>}{open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</button>{action}</div>{open && <div className="section-content">{children}</div>}</section>;
}
function MetaField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="meta-field"><span>{label}</span>{children}</label>; }
function CSVField({ label, value, onSave, placeholder }: { label: string; value: string[]; onSave: (items: string[]) => void; placeholder: string }) {
  const [text, setText] = useState(value.join(", "));
  useEffect(() => setText(value.join(", ")), [value]);
  return <MetaField label={label}><input value={text} placeholder={placeholder} onChange={(event) => setText(event.target.value)} onBlur={() => onSave([...new Set(text.split(",").map((item) => item.trim()).filter(Boolean))])} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></MetaField>;
}
function Swatches({ options, current, onChange }: { options: { value: string; color: string; label: string }[]; current: string; onChange: (value: string) => void }) {
  return <div className="swatch-row">{options.map((option) => <button type="button" key={option.value} title={option.label} aria-label={option.label} className={`color-swatch ${current === option.value ? "chosen" : ""}`} style={{ background: option.color }} onClick={() => onChange(option.value)} />)}</div>;
}
function EvidenceInspector({ evidence, onUpdate, onDelete, onFocus }: { evidence: Evidence; onUpdate: (id: string, patch: Partial<Evidence>) => void; onDelete: () => void; onFocus: () => void }) {
  const update = (patch: Partial<Evidence>) => onUpdate(evidence.id, patch);
  return <div className="inspector" key={evidence.id}>
    <div className="inspector-type"><span className="type-square">{evidence.type === "image" ? <ImagePlus size={15} /> : evidence.type === "note" ? <StickyNote size={15} /> : evidence.type === "link" ? <Link2 size={15} /> : evidence.type === "shape" ? <Shapes size={15} /> : <FileText size={15} />}</span><span>{evidence.type.toUpperCase()} / #{evidence.id.slice(-5).toUpperCase()}</span><button type="button" title="Center on evidence" onClick={onFocus}><Focus size={14} /></button></div>
    <MetaField label="EVIDENCE TITLE"><input value={evidence.title} onChange={(event) => update({ title: event.target.value })} placeholder="Untitled evidence" /></MetaField>
    {evidence.type === "image" && <>
      <MetaField label="PHOTO CAPTION"><input value={evidence.caption} onChange={(event) => update({ caption: event.target.value })} placeholder="Add a caption" /></MetaField>
      <div className="two-fields"><MetaField label="FRAME"><select value={evidence.frame} onChange={(event) => update({ frame: event.target.value } as Partial<Evidence>)}><option value="print">Photo print</option><option value="polaroid">Polaroid</option><option value="darkroom">Darkroom</option><option value="clipping">Clipping</option><option value="highlighted">Highlighted</option></select></MetaField><MetaField label="ATTACHMENT"><select value={evidence.attachment} onChange={(event) => update({ attachment: event.target.value } as Partial<Evidence>)}><option value="pin">Pushpin</option><option value="tape">Tape</option><option value="none">None</option></select></MetaField></div>
      <div className="toggle-list"><label><input type="checkbox" checked={evidence.showBorder} onChange={(event) => update({ showBorder: event.target.checked } as Partial<Evidence>)} /> Border</label><label><input type="checkbox" checked={evidence.showCaption} onChange={(event) => update({ showCaption: event.target.checked } as Partial<Evidence>)} /> Caption</label><label><input type="checkbox" checked={evidence.showAnnotations} onChange={(event) => update({ showAnnotations: event.target.checked } as Partial<Evidence>)} /> Markers</label></div>
      {evidence.showAnnotations && <div className="marker-editor">
        {evidence.annotations.map((marker, index) => <div key={index} className="marker-control">
          <div className="marker-row"><span>{index + 1}</span><input value={marker.label} onChange={(event) => update({ annotations: evidence.annotations.map((m, i) => i === index ? { ...m, label: event.target.value } : m) } as Partial<Evidence>)} aria-label={`Marker ${index + 1} label`} /><button type="button" title="Remove marker" onClick={() => update({ annotations: evidence.annotations.filter((_, i) => i !== index) } as Partial<Evidence>)}><X size={12} /></button></div>
          <div className="marker-coordinates"><label>X <input type="range" min="5" max="95" value={marker.x} aria-label={`Marker ${index + 1} horizontal position`} onChange={(event) => update({ annotations: evidence.annotations.map((m, i) => i === index ? { ...m, x: Number(event.target.value) } : m) } as Partial<Evidence>)} /></label><label>Y <input type="range" min="5" max="95" value={marker.y} aria-label={`Marker ${index + 1} vertical position`} onChange={(event) => update({ annotations: evidence.annotations.map((m, i) => i === index ? { ...m, y: Number(event.target.value) } : m) } as Partial<Evidence>)} /></label></div>
        </div>)}
        <button type="button" className="text-action" onClick={() => update({ annotations: [...evidence.annotations, { x: 50 + (evidence.annotations.length % 3) * 11, y: 45, label: `Marker ${evidence.annotations.length + 1}` }] } as Partial<Evidence>)}><Plus size={13} /> Add marker</button>
      </div>}
      <MetaField label="SOURCE / CREDIT"><input value={evidence.source} onChange={(event) => update({ source: event.target.value } as Partial<Evidence>)} placeholder="File, URL or provenance" /></MetaField>
    </>}
    {evidence.type === "note" && <><MetaField label="NOTE TEXT"><textarea rows={4} value={evidence.body} onChange={(event) => update({ body: event.target.value } as Partial<Evidence>)} /></MetaField><MetaField label="PAPER COLOR"><Swatches current={evidence.paper} onChange={(value) => update({ paper: value } as Partial<Evidence>)} options={[{ value: "kraft", color: "#b4906d", label: "Kraft" }, { value: "butter", color: "#d6ba78", label: "Yellow" }, { value: "rose", color: "#b87f74", label: "Rose" }, { value: "cream", color: "#ddd0aa", label: "Cream" }]} /></MetaField><MetaField label="ATTACHMENT"><select value={evidence.attachment} onChange={(event) => update({ attachment: event.target.value } as Partial<Evidence>)}><option value="pin">Pushpin</option><option value="tape">Tape</option><option value="none">None</option></select></MetaField></>}
    {evidence.type === "document" && <><MetaField label="DOCUMENT TEXT"><textarea rows={5} value={evidence.body} onChange={(event) => update({ body: event.target.value } as Partial<Evidence>)} /></MetaField><MetaField label="SOURCE / FILENAME"><input value={evidence.source} onChange={(event) => update({ source: event.target.value } as Partial<Evidence>)} /></MetaField><MetaField label="DOCUMENT STYLE"><select value={evidence.variant} onChange={(event) => update({ variant: event.target.value } as Partial<Evidence>)}><option value="report">Incident report</option><option value="statement">Witness statement</option><option value="map">Survey map</option><option value="spectrum">Frequency chart</option><option value="clipping">Newspaper clipping</option></select></MetaField></>}
    {evidence.type === "link" && <><MetaField label="SOURCE URL"><input value={evidence.url} onChange={(event) => update({ url: event.target.value } as Partial<Evidence>)} placeholder="https://..." /></MetaField><MetaField label="NOTES"><textarea rows={3} value={evidence.body} onChange={(event) => update({ body: event.target.value } as Partial<Evidence>)} /></MetaField></>}
    {evidence.type === "text" && <><MetaField label="TEXT"><textarea rows={3} value={evidence.body} onChange={(event) => update({ body: event.target.value } as Partial<Evidence>)} /></MetaField><MetaField label="INK COLOR"><input type="color" value={evidence.color} onChange={(event) => update({ color: event.target.value } as Partial<Evidence>)} /></MetaField></>}
    {evidence.type === "shape" && <><MetaField label="MARKING"><select value={evidence.shape} onChange={(event) => update({ shape: event.target.value } as Partial<Evidence>)}><option value="rectangle">Rectangle</option><option value="ellipse">Circle</option><option value="arrow">Arrow</option><option value="freehand">Freehand</option></select></MetaField><MetaField label="INK COLOR"><input type="color" value={evidence.color} onChange={(event) => update({ color: event.target.value } as Partial<Evidence>)} /></MetaField><MetaField label={`STROKE · ${evidence.strokeWidth}px`}><input type="range" min="1" max="12" value={evidence.strokeWidth} onChange={(event) => update({ strokeWidth: Number(event.target.value) } as Partial<Evidence>)} /></MetaField></>}
    <div className="rotation-field"><MetaField label={`ROTATION · ${Math.round(evidence.rotation)}°`}><input type="range" min="-180" max="180" step="1" value={evidence.rotation} onChange={(event) => update({ rotation: Number(event.target.value) })} /></MetaField><button type="button" onClick={() => update({ rotation: evidence.rotation === 0 ? -3 : 0 })}>{evidence.rotation === 0 ? "Add tilt" : "Straighten"}</button></div>
    <MetaField label="STATUS"><select value={evidence.status} onChange={(event) => update({ status: event.target.value } as Partial<Evidence>)}>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></MetaField>
    <MetaField label="DESCRIPTION"><textarea rows={2} value={evidence.description} onChange={(event) => update({ description: event.target.value })} placeholder="Context, caveats, provenance…" /></MetaField>
    <CSVField label="TAGS · COMMA SEPARATED" value={evidence.tags} onSave={(tags) => update({ tags })} placeholder="e.g. location, theory:signal" />
    <CSVField label="PEOPLE / ENTITIES" value={evidence.entities} onSave={(entities) => update({ entities })} placeholder="e.g. Mara Voss, Relay 04" />
    <div className="inspector-actions"><button type="button" onClick={() => update({ locked: !evidence.locked })}>{evidence.locked ? <UnlockKeyhole size={14} /> : <LockKeyhole size={14} />}{evidence.locked ? "Unlock" : "Lock"}</button><button type="button" className="danger" onClick={onDelete}><Trash2 size={14} /> Delete</button></div>
  </div>;
}
function ConnectionInspector({ connection, onUpdate, onDelete }: { connection: Connection; onUpdate: (id: string, patch: Partial<Connection>) => void; onDelete: () => void }) {
  return <div className="inspector"><div className="inspector-type"><span className="type-square"><GitBranch size={15} /></span><span>USER-CREATED CONNECTION</span></div><p className="inspector-help">A string records a possible relationship, not a verified conclusion.</p>
    <MetaField label="STRING COLOR"><Swatches current={connection.color} onChange={(color) => onUpdate(connection.id, { color: color as Connection["color"] })} options={Object.entries(STRING_COLORS).map(([value, color]) => ({ value, color, label: value }))} /></MetaField>
    <MetaField label={`THICKNESS · ${connection.width.toFixed(1)}px`}><input type="range" min="1" max="5" step="0.2" value={connection.width} onChange={(event) => onUpdate(connection.id, { width: Number(event.target.value) })} /></MetaField>
    <div className="two-fields"><MetaField label="PATH"><select value={connection.style} onChange={(event) => onUpdate(connection.id, { style: event.target.value as Connection["style"] })}><option value="straight">Straight</option><option value="curved">Gently curved</option></select></MetaField><MetaField label="LINE"><select value={connection.dash} onChange={(event) => onUpdate(connection.id, { dash: event.target.value as Connection["dash"] })}><option value="solid">Solid</option><option value="dashed">Dashed</option></select></MetaField></div>
    <div className="inspector-actions"><button type="button" className="danger" onClick={onDelete}><Trash2 size={14} /> Remove string</button></div>
  </div>;
}
interface SidebarProps {
  project: Investigation; selection: string[]; selectedConnectionId: string | null; open: boolean; onToggle: () => void;
  onUpdateEvidence: (id: string, patch: Partial<Evidence>) => void; onUpdateConnection: (id: string, patch: Partial<Connection>) => void;
  onDelete: () => void; onFocus: (id: string) => void; onAddTimeline: (date: string, title: string, detail: string) => void; onDeleteTimeline: (id: string) => void;
}
export function Sidebar({ project, selection, selectedConnectionId, open, onToggle, onUpdateEvidence, onUpdateConnection, onDelete, onFocus, onAddTimeline, onDeleteTimeline }: SidebarProps) {
  const [expanded, setExpanded] = useState({ evidence: true, timeline: true, entities: true, theories: true, tags: false });
  const [addingTime, setAddingTime] = useState(false);
  const [timeForm, setTimeForm] = useState({ date: "", title: "", detail: "" });
  const toggle = (key: keyof typeof expanded) => setExpanded((current) => ({ ...current, [key]: !current[key] }));
  const selected = project.evidence.find((item) => item.id === selection[0]);
  const connection = project.connections.find((item) => item.id === selectedConnectionId);
  const entities = [...new Set(project.evidence.flatMap((e) => e.entities))].map((name) => ({ name, items: project.evidence.filter((e) => e.entities.includes(name)) }));
  const theories = [...new Set(project.evidence.flatMap((e) => e.tags.filter((tag) => tag.toLowerCase().startsWith("theory:")).map((tag) => tag.slice(7).trim())))].map((name) => ({ name, items: project.evidence.filter((e) => e.tags.some((tag) => tag.toLowerCase() === `theory:${name.toLowerCase()}`)) }));
  const tags = [...new Set(project.evidence.flatMap((e) => e.tags.filter((tag) => !tag.toLowerCase().startsWith("theory:"))))].map((name) => ({ name, items: project.evidence.filter((e) => e.tags.includes(name)) }));
  if (!open) return <button type="button" className="sidebar-reopen" title="Open case intelligence" onClick={onToggle}><ChevronLeft size={18} /><span>CASE FILE</span></button>;
  return <aside className="case-sidebar"><div className="sidebar-top"><div><span>INTELLIGENCE DESK</span><strong>CASE FILE <em>/{String(project.evidence.length).padStart(2, "0")}</em></strong></div><button type="button" title="Collapse sidebar" onClick={onToggle}><ChevronRight size={16} /></button></div>
    <div className="sidebar-scroll">
      {(selected || connection || selection.length > 1) && <Section title={selection.length > 1 ? `${selection.length} ITEMS SELECTED` : "SELECTED EVIDENCE"} open={expanded.evidence} onToggle={() => toggle("evidence")}>
        {selected && selection.length === 1 ? <EvidenceInspector key={selected.id} evidence={selected} onUpdate={onUpdateEvidence} onDelete={onDelete} onFocus={() => onFocus(selected.id)} /> : connection ? <ConnectionInspector connection={connection} onUpdate={onUpdateConnection} onDelete={onDelete} /> : <div className="multi-selection"><p>Move these clues together, or use the context menu to duplicate them.</p><button type="button" onClick={onDelete}><Trash2 size={13} /> Delete selected</button></div>}
      </Section>}
      <Section title="INVESTIGATION TIMELINE" count={project.timeline.length} open={expanded.timeline} onToggle={() => toggle("timeline")} action={<button type="button" className="section-add" title="Add timeline event" onClick={() => { setAddingTime(!addingTime); setExpanded((current) => ({ ...current, timeline: true })); }}><Plus size={14} /></button>}>
        {project.timeline.length ? <div className="timeline-list">{project.timeline.map((entry) => <div key={entry.id} className="timeline-entry"><span className="timeline-dot" /><div className="timeline-entry-main"><small>{entry.date}</small><button type="button" onClick={() => entry.evidenceId && onFocus(entry.evidenceId)} disabled={!entry.evidenceId}>{entry.title}</button><p>{entry.detail}</p></div><button type="button" className="timeline-delete" title="Remove timeline event" onClick={() => onDeleteTimeline(entry.id)}><X size={11} /></button></div>)}</div> : <p className="section-empty">No events recorded. Add a date to start a timeline.</p>}
        {addingTime && <div className="timeline-form"><input value={timeForm.date} onChange={(event) => setTimeForm({ ...timeForm, date: event.target.value })} placeholder="DATE / TIME" aria-label="Timeline date" /><input value={timeForm.title} onChange={(event) => setTimeForm({ ...timeForm, title: event.target.value })} placeholder="What happened?" aria-label="Event title" /><input value={timeForm.detail} onChange={(event) => setTimeForm({ ...timeForm, detail: event.target.value })} placeholder="Optional detail" aria-label="Event detail" /><button type="button" onClick={() => { if (!timeForm.title.trim()) return; onAddTimeline(timeForm.date.trim() || "UNDATED", timeForm.title.trim(), timeForm.detail.trim()); setTimeForm({ date: "", title: "", detail: "" }); setAddingTime(false); }}><Plus size={13} /> Add event</button></div>}
      </Section>
      <Section title="PEOPLE & ENTITIES" count={entities.length} open={expanded.entities} onToggle={() => toggle("entities")}>
        {entities.length ? <div className="entity-list">{entities.map(({ name, items }) => <button type="button" key={name} className="entity-row" onClick={() => onFocus(items[0].id)}><span className="entity-avatar">{name.split(" ").slice(0, 2).map((word) => word[0]).join("").toUpperCase()}</span><span><strong>{name}</strong><small>{items.length} linked {items.length === 1 ? "item" : "items"}</small></span><ChevronRight size={13} /></button>)}</div> : <p className="section-empty">Add entities to evidence details to track them here.</p>}
      </Section>
      <Section title="ACTIVE THEORIES" count={theories.length} open={expanded.theories} onToggle={() => toggle("theories")}>
        {theories.length ? <div className="theory-list">{theories.map(({ name, items }, index) => <button type="button" key={name} onClick={() => onFocus(items[0].id)}><span className={`theory-icon theory-${index % 3}`}><GitBranch size={12} /></span><span>{name}</span><small>{items.length}</small></button>)}</div> : <p className="section-empty">Add a tag beginning with “theory:” to group related clues.</p>}
      </Section>
      <Section title="TAGS & CATEGORIES" count={tags.length} open={expanded.tags} onToggle={() => toggle("tags")}>
        {tags.length ? <div className="sidebar-tags">{tags.map(({ name, items }) => <button type="button" key={name} onClick={() => onFocus(items[0].id)}>{name} <span>{items.length}</span></button>)}</div> : <p className="section-empty">Tags added to clues appear here.</p>}
      </Section>
      <div className="sidebar-endnote"><span>✳</span><p>Follow the evidence.<br />Question the connection.</p><small>THE BLACK ARCHIVE / LOCAL CASE FILE</small></div>
    </div>
  </aside>;
}

interface TrayProps { project: Investigation; assetUrls: Record<string, string>; onFocus: (id: string) => void; onUpload: () => void; onImport: () => void; onFiles: (files: File[]) => void; }
export function AssetTray({ project, assetUrls, onFocus, onUpload, onImport, onFiles }: TrayProps) {
  const [filter, setFilter] = useState<"All" | "Images" | "Documents" | "Links" | "Notes" | "Markings">("All");
  const [trayDrop, setTrayDrop] = useState(false);
  const visible = project.evidence.filter((e) => filter === "All" || (filter === "Images" && e.type === "image") || (filter === "Documents" && e.type === "document") || (filter === "Links" && e.type === "link") || (filter === "Notes" && e.type === "note") || (filter === "Markings" && (e.type === "text" || e.type === "shape")));
  const onDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setTrayDrop(false); const files = Array.from(event.dataTransfer.files); if (files.length) onFiles(files); };
  return <div className="asset-tray"><div className="tray-topline"><div className="tray-heading"><span className="tray-dot" /> EVIDENCE LIBRARY <small>{project.evidence.length} ASSETS</small></div><div className="tray-filters">{(["All", "Images", "Documents", "Links", "Notes", "Markings"] as const).map((item) => <button key={item} type="button" className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div><div className="tray-spacer" /><button type="button" className="tray-import-action" onClick={onImport}><ArrowDownToLine size={13} /> Import case</button></div>
    <div className="tray-bottom"><div className="asset-lane">{visible.length ? visible.map((e) => <button type="button" className={`asset-thumb asset-thumb-${e.type}`} key={e.id} title={`Locate: ${e.title} · drag onto board to duplicate`} draggable onDragStart={(event) => { event.dataTransfer.setData("application/x-black-archive-evidence", e.id); event.dataTransfer.effectAllowed = "copy"; }} onClick={() => onFocus(e.id)}>
      {e.type === "image" ? <>{(e.assetId ? assetUrls[e.assetId] : e.src) ? <img src={e.assetId ? assetUrls[e.assetId] : e.src} alt="" draggable={false} /> : <ImagePlus size={20} />}<span>{e.title}</span></> : e.type === "note" ? <div className={`thumb-note paper-${e.paper}`}><small>FIELD NOTE</small><span>{e.body}</span></div> : e.type === "document" ? <div className="thumb-document"><small>ARCHIVE / FILE</small><strong>{e.title}</strong><span>{e.body.slice(0, 62)}</span></div> : e.type === "link" ? <div className="thumb-link"><Link2 size={18} /><span>{e.title}</span></div> : <div className="thumb-marking"><Shapes size={17} /><span>{e.title}</span></div>}
    </button>) : <div className="tray-no-assets">No {filter === "All" ? "evidence" : filter.toLowerCase()} on this board yet.</div>}</div>
    <div className={`tray-upload ${trayDrop ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setTrayDrop(true); }} onDragLeave={() => setTrayDrop(false)} onDrop={onDrop}><button type="button" onClick={onUpload}><UploadCloud size={20} strokeWidth={1.5} /><strong>UPLOAD IMAGES</strong><span>or drop files here</span></button></div></div>
  </div>;
}
