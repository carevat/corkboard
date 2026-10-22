import JSZip from "jszip";
import { getAsset, putAsset } from "./archive-storage";
import { uid, type Evidence, type Investigation } from "./archive-types";

interface CasePackage {
  format: "the-black-archive";
  version: 1;
  investigation: Investigation;
  mimeTypes: Record<string, string>;
}

export async function exportInvestigation(investigation: Investigation): Promise<Blob> {
  const zip = new JSZip();
  const copy: Investigation = JSON.parse(JSON.stringify(investigation));
  const mimeTypes: Record<string, string> = {};
  const processed = new Set<string>();
  for (const evidence of copy.evidence) {
    if (evidence.type !== "image") continue;
    const original = investigation.evidence.find((item) => item.id === evidence.id);
    if (!original || original.type !== "image") continue;
    const key = original.assetId ?? `built-in-${original.id}`;
    if (!processed.has(key)) {
      let blob: Blob | undefined;
      if (original.assetId) blob = await getAsset(original.assetId);
      else if (original.src) {
        const response = await fetch(original.src);
        if (response.ok) blob = await response.blob();
      }
      if (!blob) throw new Error(`The image for “${original.title}” could not be found. Export was cancelled.`);
      zip.file(`assets/${key}`, blob);
      mimeTypes[key] = blob.type || "image/jpeg";
      processed.add(key);
    }
    evidence.assetId = key;
    delete evidence.src;
  }
  const manifest: CasePackage = { format: "the-black-archive", version: 1, investigation: copy, mimeTypes };
  zip.file("project.json", JSON.stringify(manifest, null, 2));
  return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 4 } });
}

function validEvidence(item: unknown): item is Evidence {
  if (!item || typeof item !== "object") return false;
  const e = item as Record<string, unknown>;
  return typeof e.id === "string" && typeof e.type === "string" && ["image", "note", "document", "link", "text", "shape"].includes(e.type) &&
    [e.x, e.y, e.width, e.height, e.rotation].every((n) => typeof n === "number" && Number.isFinite(n)) &&
    typeof e.title === "string";
}

export async function importInvestigation(file: File): Promise<Investigation> {
  if (file.size > 250 * 1024 * 1024) throw new Error("This case file is larger than the 250 MB import limit.");
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(file); }
  catch { throw new Error("This is not a valid .zip case file."); }
  const jsonFile = zip.file("project.json");
  if (!jsonFile) throw new Error("The case file has no project.json manifest.");
  let manifest: CasePackage;
  try { manifest = JSON.parse(await jsonFile.async("text")) as CasePackage; }
  catch { throw new Error("The case file manifest is damaged."); }
  const source = manifest.investigation;
  if (manifest.format !== "the-black-archive" || manifest.version !== 1 || !source || typeof source.title !== "string" ||
    !Array.isArray(source.evidence) || !source.evidence.every(validEvidence) || !Array.isArray(source.connections) || !Array.isArray(source.timeline)) {
    throw new Error("This case file is incompatible or contains invalid evidence.");
  }
  const assetMap = new Map<string, string>();
  for (const evidence of source.evidence) {
    if (evidence.type !== "image" || !evidence.assetId || assetMap.has(evidence.assetId)) continue;
    const asset = zip.file(`assets/${evidence.assetId}`);
    if (!asset) throw new Error(`An image asset is missing from the case file: ${evidence.title}.`);
    const bytes = await asset.async("uint8array");
    const type = manifest.mimeTypes?.[evidence.assetId] || "image/jpeg";
    if (!type.startsWith("image/")) throw new Error("The case file contains an invalid image asset.");
    const newId = uid();
    await putAsset(newId, new Blob([new Uint8Array(bytes)], { type }));
    assetMap.set(evidence.assetId, newId);
  }
  const now = new Date().toISOString();
  const copy: Investigation = JSON.parse(JSON.stringify(source));
  copy.id = uid(); copy.createdAt = now; copy.updatedAt = now;
  copy.view = { x: 0, y: 0, zoom: 1 };
  copy.settings = Object.assign({ background: "cork" as const, showGrid: false, showMinimap: true, defaultStringColor: "red" as const }, copy.settings || {});
  copy.evidence = copy.evidence.map((e) => e.type === "image" && e.assetId ? { ...e, assetId: assetMap.get(e.assetId), src: undefined } : e);
  copy.connections = copy.connections.filter((c) => copy.evidence.some((e) => e.id === c.fromId) && copy.evidence.some((e) => e.id === c.toId));
  return copy;
}
