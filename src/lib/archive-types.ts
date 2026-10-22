export type Point = { x: number; y: number };
export type ViewState = { x: number; y: number; zoom: number };
export type EvidenceStatus = "unverified" | "relevant" | "disputed" | "confirmed";
export type Attachment = "pin" | "tape" | "none";
export type FrameStyle = "print" | "polaroid" | "darkroom" | "clipping" | "highlighted";
export type StringColor = "red" | "ivory" | "yellow" | "neutral";
export type Tool = "select" | "note" | "image" | "document" | "link" | "string" | "text" | "shape";
export type ShapeKind = "rectangle" | "ellipse" | "arrow" | "freehand";

export interface BaseEvidence {
  id: string;
  type: "image" | "note" | "document" | "link" | "text" | "shape";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  z: number;
  title: string;
  description: string;
  tags: string[];
  entities: string[];
  status: EvidenceStatus;
  locked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ImageEvidence extends BaseEvidence {
  type: "image";
  assetId?: string;
  src?: string;
  aspect: number;
  frame: FrameStyle;
  attachment: Attachment;
  caption: string;
  showBorder: boolean;
  showCaption: boolean;
  showAnnotations: boolean;
  annotations: { x: number; y: number; label: string }[];
  source: string;
}
export interface NoteEvidence extends BaseEvidence {
  type: "note";
  body: string;
  paper: "kraft" | "butter" | "rose" | "cream";
  attachment: Attachment;
}
export interface DocumentEvidence extends BaseEvidence {
  type: "document";
  body: string;
  variant: "report" | "statement" | "map" | "spectrum" | "clipping";
  source: string;
  attachment: Attachment;
}
export interface LinkEvidence extends BaseEvidence {
  type: "link";
  url: string;
  body: string;
  attachment: Attachment;
}
export interface TextEvidence extends BaseEvidence {
  type: "text";
  body: string;
  color: string;
}
export interface ShapeEvidence extends BaseEvidence {
  type: "shape";
  shape: ShapeKind;
  color: string;
  strokeWidth: number;
  points: Point[];
}
export type Evidence = ImageEvidence | NoteEvidence | DocumentEvidence | LinkEvidence | TextEvidence | ShapeEvidence;

export interface Connection {
  id: string;
  fromId: string;
  toId: string;
  color: StringColor;
  width: number;
  style: "straight" | "curved";
  dash: "solid" | "dashed";
}
export interface TimelineEntry {
  id: string;
  date: string;
  title: string;
  detail: string;
  evidenceId?: string;
}
export interface Investigation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  view: ViewState;
  settings: {
    background: "cork" | "dark-cork";
    showGrid: boolean;
    showMinimap: boolean;
    defaultStringColor: StringColor;
  };
  evidence: Evidence[];
  connections: Connection[];
  timeline: TimelineEntry[];
}

export const BOARD_WIDTH = 1540;
export const BOARD_HEIGHT = 890;
export const STATUS_LABELS: Record<EvidenceStatus, string> = {
  unverified: "Unverified", relevant: "Relevant", disputed: "Disputed", confirmed: "Confirmed",
};
export const STRING_COLORS: Record<StringColor, string> = {
  red: "#a53c32", ivory: "#ded4ba", yellow: "#d9ae55", neutral: "#8e8981",
};

export function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const demoTime = "1987-10-24T08:00:00.000Z";
function base(id: string, type: BaseEvidence["type"], title: string, x: number, y: number, width: number, height: number, rotation: number, z: number): BaseEvidence {
  return { id, type, title, x, y, width, height, rotation, z, description: "", tags: [], entities: [], status: "unverified", locked: false, createdAt: demoTime, updatedAt: demoTime };
}
function photo(id: string, title: string, src: string, x: number, y: number, width: number, height: number, rotation: number, z: number, more: Partial<ImageEvidence> = {}): ImageEvidence {
  return { ...base(id, "image", title, x, y, width, height, rotation, z), type: "image", src, aspect: 1.5, frame: "print", attachment: "pin", caption: title, showBorder: true, showCaption: true, showAnnotations: false, annotations: [], source: "Field archive · October 1987", ...more };
}
function note(id: string, body: string, x: number, y: number, width: number, height: number, rotation: number, z: number, paper: NoteEvidence["paper"] = "kraft", more: Partial<NoteEvidence> = {}): NoteEvidence {
  return { ...base(id, "note", "Field note", x, y, width, height, rotation, z), type: "note", body, paper, attachment: "pin", ...more };
}
function document(id: string, title: string, body: string, variant: DocumentEvidence["variant"], x: number, y: number, width: number, height: number, rotation: number, z: number, more: Partial<DocumentEvidence> = {}): DocumentEvidence {
  return { ...base(id, "document", title, x, y, width, height, rotation, z), type: "document", body, variant, source: "BLACKWATER FIELD ARCHIVE / 1987", attachment: "pin", ...more };
}

export function createDemoInvestigation(): Investigation {
  const evidence: Evidence[] = [
    note("demo-headline", "THE SIGNAL WENT SILENT.\nSOMEONE HEARD IT.", 52, 50, 270, 112, -7, 5, "kraft", { title: "The signal went silent", tags: ["theory:interference"] }),
    document("demo-map", "Blackwater / Survey Map", "Last known position: Relay 04, north of Greywater Inlet.", "map", 375, 48, 315, 246, 3, 2, { tags: ["location"], entities: ["Relay 04", "Greywater Inlet"] }),
    photo("demo-portrait", "Dr. Mara Voss", "/evidence/mara-voss.jpg", 748, 47, 189, 249, 5, 7, { aspect: .8, frame: "polaroid", caption: "DR. MARA VOSS  /  researcher", entities: ["Dr. Mara Voss"], status: "relevant", description: "Radio astronomer. Last confirmed at Relay 04 on the night of October 23." }),
    note("demo-question", "Why did the recorder\nkeep running after\n03:17?", 972, 75, 174, 137, -6, 9, "butter", { title: "The recording question", tags: ["theory:interference"] }),
    photo("demo-control", "Control room, 03:17", "/evidence/control-room.jpg", 1198, 65, 278, 218, 4, 5, { frame: "polaroid", caption: "RELAY 04  /  03:17 AM", status: "confirmed", entities: ["Relay 04"] }),
    photo("demo-relay", "Relay 04 at dusk", "/evidence/relay-tower.jpg", 72, 268, 314, 234, -3, 8, { caption: "RELAY 04  /  last known location", status: "confirmed", entities: ["Relay 04"], tags: ["location"] }),
    note("demo-last-seen", "Last seen:\n23 Oct, 22:40", 373, 264, 145, 106, 8, 11, "cream", { title: "Last confirmed sighting" }),
    photo("demo-tape", "The unmarked recording", "/evidence/tape-recorder.jpg", 429, 329, 250, 195, -5, 7, { frame: "darkroom", caption: "TAPE 7B  /  origin unknown", status: "disputed", description: "A reel marked only '7B' was recovered from the empty control room.", tags: ["theory:interference"] }),
    document("demo-report", "A voice beneath the static", "INCIDENT REPORT  /  FILE 017-B\n\nAt 03:17, the Blackwater receiver logged a second transmission beneath the station's own carrier wave. The night operator reported a voice. No speaker was scheduled on this frequency.\n\nDr. Mara Voss was gone when the morning crew arrived. Her notes remained on the desk; the final 11 minutes of tape have never been accounted for.", "report", 728, 324, 400, 287, -2, 6, { status: "relevant", entities: ["Dr. Mara Voss", "Relay 04"], tags: ["case file"], description: "Primary incident summary for the disappearance at Blackwater Relay 04." }),
    photo("demo-coast", "Greywater Inlet", "/evidence/shoreline.jpg", 1184, 360, 288, 218, 5, 5, { frame: "polaroid", caption: "GREYWATER INLET  /  8 miles west", tags: ["location"], entities: ["Greywater Inlet"] }),
    note("demo-coast-note", "I saw NO LIGHTS\nby the water.\n— witness #02", 1118, 470, 137, 117, -8, 12, "kraft", { title: "Second witness account", status: "disputed", description: "Contradicts Elias Rowe's account of a red light moving toward the inlet." }),
    photo("demo-road", "North service road", "/evidence/forest-road.jpg", 89, 620, 292, 204, -4, 4, { frame: "print", caption: "NORTH ROAD  /  no tracks after rain", tags: ["location"] }),
    document("demo-witness", "Witness statement 02", "I saw the station lights go out. Then a red light moved through the trees, slowly, towards the inlet. I told them it wasn't a car.\n\n— ELIAS ROWE, NIGHT WATCH\nRecorded 24 OCT 1987", "statement", 413, 614, 262, 208, 2, 6, { status: "disputed", entities: ["Elias Rowe"], description: "The witness was three miles from the relay station; visibility was poor." }),
    note("demo-theory", "WHAT IF THE SIGNAL\nWASN'T COMING\nFROM THE TOWER?", 714, 678, 236, 147, -6, 8, "rose", { title: "Origin of the signal", tags: ["theory:alternate source"], status: "disputed" }),
    document("demo-spectrum", "Frequency anomaly", "Receiver log / 03:17:09\nUnidentified second carrier", "spectrum", 991, 642, 242, 175, 3, 4, { status: "confirmed", tags: ["theory:interference"], entities: ["Relay 04"] }),
    note("demo-final", "THE TRUTH IS\nOUT THERE.\n\nOR IS IT HERE?", 1267, 635, 175, 155, 5, 8, "kraft", { title: "A question left behind", tags: ["theory:alternate source"] }),
  ];
  const links: [string, string, Connection["color"], Connection["style"]][] = [
    ["demo-headline", "demo-map", "red", "straight"], ["demo-map", "demo-relay", "red", "straight"],
    ["demo-map", "demo-portrait", "red", "straight"], ["demo-portrait", "demo-report", "red", "straight"],
    ["demo-control", "demo-question", "red", "straight"], ["demo-control", "demo-report", "red", "straight"],
    ["demo-relay", "demo-tape", "ivory", "straight"], ["demo-tape", "demo-report", "red", "curved"],
    ["demo-report", "demo-coast", "red", "straight"], ["demo-coast", "demo-coast-note", "yellow", "straight"],
    ["demo-road", "demo-witness", "red", "straight"], ["demo-witness", "demo-theory", "ivory", "curved"],
    ["demo-spectrum", "demo-report", "red", "straight"], ["demo-spectrum", "demo-final", "yellow", "straight"],
    ["demo-theory", "demo-report", "red", "straight"], ["demo-road", "demo-relay", "neutral", "straight"],
  ];
  return {
    id: uid(), title: "PROJECT: THE VANISHING SIGNAL", createdAt: demoTime, updatedAt: demoTime,
    view: { x: 0, y: 0, zoom: 1 },
    settings: { background: "cork", showGrid: false, showMinimap: true, defaultStringColor: "red" },
    evidence,
    connections: links.map(([fromId, toId, color, style], i) => ({ id: `demo-string-${i}`, fromId, toId, color, width: 1.8, style, dash: "solid" })),
    timeline: [
      { id: "t1", date: "OCT 23 · 22:40", title: "Last confirmed sighting", detail: "Voss enters Relay 04.", evidenceId: "demo-relay" },
      { id: "t2", date: "OCT 24 · 03:17", title: "Second signal recorded", detail: "Unknown carrier appears beneath transmission.", evidenceId: "demo-spectrum" },
      { id: "t3", date: "OCT 24 · 03:21", title: "Witness accounts diverge", detail: "One reports a red light. Another saw nothing.", evidenceId: "demo-coast-note" },
      { id: "t4", date: "OCT 24 · 06:10", title: "Station found empty", detail: "Morning crew arrives at Relay 04.", evidenceId: "demo-report" },
      { id: "t5", date: "NOV 02", title: "Tape 7B recovered", detail: "Eleven minutes remain unaccounted for.", evidenceId: "demo-tape" },
    ],
  };
}

export function createBlankInvestigation(title = "UNTITLED INVESTIGATION"): Investigation {
  const now = new Date().toISOString();
  return { id: uid(), title, createdAt: now, updatedAt: now, view: { x: 0, y: 0, zoom: 1 }, settings: { background: "cork", showGrid: false, showMinimap: true, defaultStringColor: "red" }, evidence: [], connections: [], timeline: [] };
}

export function makeEvidence(type: Exclude<Tool, "select" | "string">, point: Point, z: number, shape: ShapeKind = "rectangle"): Evidence {
  const now = new Date().toISOString();
  const common = { id: uid(), x: point.x, y: point.y, rotation: type === "note" ? -2 : 0, z, title: "", description: "", tags: [], entities: [], status: "unverified" as EvidenceStatus, locked: false, createdAt: now, updatedAt: now };
  switch (type) {
    case "note": return { ...common, type: "note", title: "New note", width: 205, height: 175, body: "Write a thought...", paper: "butter", attachment: "pin" };
    case "document": return { ...common, type: "document", title: "Untitled document", width: 260, height: 240, body: "Click twice to edit this document.\n\nAdd your observations here.", variant: "statement", source: "", attachment: "pin" };
    case "link": return { ...common, type: "link", title: "New source", width: 250, height: 125, url: "", body: "Add a URL and notes in the evidence details.", attachment: "pin" };
    case "text": return { ...common, type: "text", title: "Text annotation", width: 220, height: 90, body: "Double-click to edit", color: "#f0dec4" };
    case "shape": return { ...common, type: "shape", title: `${shape} marking`, width: 150, height: 105, shape, color: "#b94a3e", strokeWidth: 3, points: [] };
    case "image": return { ...common, type: "image", title: "New photograph", width: 260, height: 210, aspect: 1.5, frame: "print", attachment: "pin", caption: "NEW EVIDENCE", showBorder: true, showCaption: true, showAnnotations: false, annotations: [], source: "" };
  }
}
