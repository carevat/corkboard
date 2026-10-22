"use client";

import { memo, useEffect, useRef, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from "react";
import { ExternalLink, FileWarning, Link2 } from "lucide-react";
import type { DocumentEvidence, Evidence, ImageEvidence, ShapeEvidence } from "@/lib/archive-types";

type Handle = "nw" | "ne" | "sw" | "se" | "rotate";
interface EvidenceCardProps {
  evidence: Evidence;
  assetUrl?: string;
  selected: boolean;
  soleSelected: boolean;
  editing: boolean;
  stringSource: boolean;
  onStart: (id: string, event: ReactPointerEvent<HTMLDivElement>) => void;
  onHandleStart: (id: string, handle: Handle, event: ReactPointerEvent<HTMLSpanElement>) => void;
  onEdit: (id: string) => void;
  onEndEdit: () => void;
  onBodyChange: (id: string, body: string) => void;
  onContext: (id: string, event: ReactMouseEvent<HTMLDivElement>) => void;
}

function MapPreview() {
  return (
    <div className="map-preview">
      <svg viewBox="0 0 310 190" preserveAspectRatio="none" aria-label="Illustrated survey map of the fictional Blackwater coast">
        <defs>
          <pattern id="map-grid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M 22 0 L 0 0 0 22" fill="none" stroke="#b2b6a2" strokeOpacity=".13" strokeWidth=".7" /></pattern>
        </defs>
        <rect width="310" height="190" fill="#152326" /><rect width="310" height="190" fill="url(#map-grid)" />
        <path d="M0 39 C38 31 66 60 87 48 S132 25 148 48 S168 84 195 76 S242 71 253 101 S290 123 310 112 L310 190 L0 190Z" fill="#253a3b" stroke="#849382" strokeWidth="1.2" />
        <path d="M0 68 C38 61 64 80 90 69 S130 48 151 69 S180 105 204 92 S242 99 260 126 S294 145 310 139 M0 90 C41 80 55 106 87 94 S134 70 154 92 S178 130 211 114 S251 124 265 143 M18 111 C53 100 71 125 92 116 S130 97 157 118 S185 149 214 137 S250 144 285 171 M11 126 C57 121 68 145 100 135 S139 119 162 139 S206 161 239 155" fill="none" stroke="#788878" strokeOpacity=".56" strokeWidth=".8" />
        <path d="M34 20 Q69 42 80 75 T127 130 T201 174 M249 18 Q209 43 192 73 T122 163" fill="none" stroke="#d5c4a1" strokeOpacity=".55" strokeDasharray="4 3" strokeWidth="1.4" />
        <path d="M53 80 Q103 91 174 104 T265 148" fill="none" stroke="#c14b3c" strokeWidth="1.3" strokeDasharray="3 3" />
        <circle cx="81" cy="86" r="12" fill="none" stroke="#bf4e3e" strokeWidth="1.7" /><circle cx="81" cy="86" r="2.5" fill="#da6550" />
        <circle cx="220" cy="133" r="10" fill="none" stroke="#bf4e3e" strokeWidth="1.5" /><circle cx="220" cy="133" r="2" fill="#da6550" />
        <text x="13" y="17" fill="#ded8ba" fontSize="8" letterSpacing="2">BLACKWATER SECTOR</text>
        <text x="96" y="84" fill="#e1d9b8" fontSize="7" letterSpacing="1">RELAY 04</text>
        <text x="176" y="153" fill="#d6d0b4" fontSize="7" letterSpacing="1">GREYWATER INLET</text>
        <text x="13" y="177" fill="#b9beaa" fontSize="7" letterSpacing="2">47° 18′ N   /   SURVEY 1987</text>
        <path d="M287 16 l-6 16 h12z" fill="none" stroke="#d2d0b2" strokeWidth="1" /><text x="284" y="44" fill="#d2d0b2" fontSize="7">N</text>
      </svg>
    </div>
  );
}
function SpectrumPreview() {
  return (
    <div className="spectrum-preview">
      <svg viewBox="0 0 240 99" preserveAspectRatio="none" aria-label="Frequency anomaly chart">
        <rect width="240" height="99" fill="#101a1b" />
        {[25, 50, 75].map((y) => <path key={y} d={`M0 ${y} H240`} stroke="#779591" strokeOpacity=".22" strokeWidth=".7" />)}
        {[30, 60, 90, 120, 150, 180, 210].map((x) => <path key={x} d={`M${x} 0 V99`} stroke="#779591" strokeOpacity=".16" strokeWidth=".7" />)}
        <path d="M0 64 L7 61 15 67 23 60 30 62 40 57 47 63 55 54 65 58 74 47 83 52 92 40 99 47 107 43 116 39 125 41 133 34 142 39 150 44 158 35 167 38 174 45 182 43 191 47 198 56 207 50 214 59 223 56 232 63 240 62" fill="none" stroke="#d8dbcc" strokeWidth="1.4" />
        <path d="M0 76 Q69 75 112 72 T170 72 Q188 73 197 55 Q207 50 217 74 T240 73" fill="none" stroke="#b94b3e" strokeWidth="1.3" />
        <circle cx="201" cy="57" r="14" fill="none" stroke="#bf493a" strokeWidth="1.2" />
        <text x="8" y="11" fill="#9cae9f" fontSize="7" letterSpacing="1">03:17:09 / 98.6 MHz</text>
      </svg>
    </div>
  );
}

function ImageContent({ evidence, assetUrl }: { evidence: ImageEvidence; assetUrl?: string }) {
  const src = evidence.assetId ? assetUrl : evidence.src;
  return (
    <div className={`photo-content frame-${evidence.frame} ${evidence.showBorder ? "has-border" : "no-border"} ${evidence.showCaption ? "has-caption" : "no-caption"}`}>
      <div className="photo-media">
        {src ? <img src={src} alt={evidence.title || "Evidence photograph"} draggable={false} /> : <div className="missing-image"><FileWarning size={23} strokeWidth={1.4} /><span>Image unavailable</span></div>}
        {evidence.showAnnotations && evidence.annotations.map((marker, index) => (
          <span key={`${index}-${marker.label}`} className="photo-marker" style={{ left: `${marker.x}%`, top: `${marker.y}%` }} title={marker.label}>{index + 1}</span>
        ))}
      </div>
      {evidence.showCaption && <div className="photo-caption"><span>{evidence.caption || evidence.title || "UNTITLED EVIDENCE"}</span><small>{evidence.status === "disputed" ? "?" : ""}</small></div>}
      {evidence.status === "disputed" && <span className="evidence-flag">DISPUTED</span>}
    </div>
  );
}
function ShapeContent({ evidence }: { evidence: ShapeEvidence }) {
  const w = Math.max(1, evidence.width), h = Math.max(1, evidence.height);
  const points = evidence.points.map((p) => `${p.x},${p.y}`).join(" ");
  return (
    <svg className="shape-svg" width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-label={`${evidence.shape} marking`}>
      <defs><marker id={`arrow-${evidence.id}`} markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M1 1 L9 5 L1 9" fill="none" stroke={evidence.color} strokeWidth="1.8" /></marker></defs>
      {evidence.shape === "rectangle" && <rect x="3" y="3" width={Math.max(1, w - 6)} height={Math.max(1, h - 6)} fill="none" stroke={evidence.color} strokeWidth={evidence.strokeWidth} />}
      {evidence.shape === "ellipse" && <ellipse cx={w / 2} cy={h / 2} rx={Math.max(1, w / 2 - 3)} ry={Math.max(1, h / 2 - 3)} fill="none" stroke={evidence.color} strokeWidth={evidence.strokeWidth} />}
      {evidence.shape === "arrow" && <path d={`M5 ${h - 5} L${w - 11} 11`} fill="none" stroke={evidence.color} strokeWidth={evidence.strokeWidth} markerEnd={`url(#arrow-${evidence.id})`} />}
      {evidence.shape === "freehand" && <polyline points={points} fill="none" stroke={evidence.color} strokeWidth={evidence.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

export const EvidenceCard = memo(function EvidenceCard({ evidence, assetUrl, selected, soleSelected, editing, stringSource, onStart, onHandleStart, onEdit, onEndEdit, onBodyChange, onContext }: EvidenceCardProps) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (editing) { textarea.current?.focus(); textarea.current?.select(); } }, [editing]);
  const canEditBody = evidence.type === "note" || evidence.type === "document" || evidence.type === "text" || evidence.type === "link";
  const content = (() => {
    switch (evidence.type) {
      case "image": return <ImageContent evidence={evidence} assetUrl={assetUrl} />;
      case "note": return <div className={`note-content paper-${evidence.paper}`}><div className="note-writing">{evidence.body}</div>{evidence.status === "disputed" && <span className="note-disputed">?</span>}</div>;
      case "document": return evidence.variant === "map" ? <div className="document-content document-map"><div className="map-topline">FIELD SURVEY <span>FIG. 04 / 1987</span></div><MapPreview /><div className="map-bottomline">{evidence.title}</div></div> : evidence.variant === "spectrum" ? <div className="document-content document-spectrum"><div className="spectrum-topline">RECEIVER LOG / 24 OCT 1987</div><SpectrumPreview /><div className="spectrum-caption">{evidence.title}<small> / 03:17 AM</small></div></div> : <div className={`document-content document-${evidence.variant}`}><div className="document-topline">{evidence.source || "FIELD DOCUMENT"} <span>✳</span></div><div className="document-rule" /><h3>{evidence.title}</h3><div className="document-body">{evidence.body}</div><div className="document-footer">BLACKWATER / ARCHIVE COPY <span>01</span></div></div>;
      case "link": return <div className="link-content"><div className="link-icon"><Link2 size={19} strokeWidth={1.5} /></div><span className="link-kicker">SOURCE MATERIAL / URL</span><strong>{evidence.title || "Untitled source"}</strong><span className="link-host">{evidence.url ? (() => { try { return new URL(evidence.url).hostname; } catch { return evidence.url; } })() : "No URL added yet"}</span><p>{evidence.body}</p>{evidence.url && /^https?:\/\//i.test(evidence.url) && <a className="link-open" href={evidence.url} target="_blank" rel="noopener noreferrer" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} title="Open source in a new tab"><ExternalLink size={14} /></a>}</div>;
      case "text": return <div className="text-content" style={{ color: evidence.color }}>{evidence.body}</div>;
      case "shape": return <ShapeContent evidence={evidence} />;
    }
  })();
  const attachment = "attachment" in evidence ? evidence.attachment : "none";
  return (
    <div
      className={`evidence-object evidence-${evidence.type} ${evidence.locked ? "is-locked" : ""} ${selected ? "is-selected" : ""} ${stringSource ? "is-string-source" : ""}`}
      data-evidence-id={evidence.id}
      style={{ left: evidence.x, top: evidence.y, width: evidence.width, height: evidence.height, transform: `rotate(${evidence.rotation}deg)`, zIndex: evidence.z }}
      onPointerDown={(event) => onStart(evidence.id, event)}
      onDoubleClick={(event) => { event.stopPropagation(); if (canEditBody) onEdit(evidence.id); }}
      onContextMenu={(event) => onContext(evidence.id, event)}
      role="button" tabIndex={-1} aria-label={`${evidence.type}: ${evidence.title}`}
    >
      {content}
      {attachment === "pin" && <span className="physical-pin" aria-hidden="true" />}
      {attachment === "tape" && <span className="physical-tape" aria-hidden="true" />}
      {editing && canEditBody && <textarea
        ref={textarea} className="evidence-inline-editor" value={evidence.body}
        onChange={(event) => onBodyChange(evidence.id, event.target.value)}
        onBlur={onEndEdit}
        onPointerDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Escape") { event.preventDefault(); onEndEdit(); } }}
        spellCheck={false} aria-label={`Edit ${evidence.type} text`}
      />}
      {selected && <div className="selection-frame" aria-hidden="true">
        {soleSelected && !evidence.locked && <>
          {(["nw", "ne", "sw", "se"] as const).map((handle) => <span key={handle} className={`resize-handle handle-${handle}`} onPointerDown={(event) => onHandleStart(evidence.id, handle, event)} />)}
          <span className="rotate-stem" /><span className="rotate-handle" onPointerDown={(event) => onHandleStart(evidence.id, "rotate", event)} />
        </>}
      </div>}
    </div>
  );
});

export type { Handle };
