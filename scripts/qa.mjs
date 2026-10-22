import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1536, height: 1024 }, permissions: ["clipboard-read", "clipboard-write"], acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
let step = "opening";
const log = (label, extra = "") => { step = label; console.log(`✓ ${label}${extra ? ` — ${extra}` : ""}`); };
const count = () => page.locator(".evidence-object").count();
const dimensions = (id) => page.locator(`[data-evidence-id="${id}"]`).evaluate((element) => ({ x: parseFloat(element.style.left), y: parseFloat(element.style.top), width: parseFloat(element.style.width), height: parseFloat(element.style.height) }));
const waitCount = async (expected) => { await page.waitForFunction((n) => document.querySelectorAll(".evidence-object").length === n, expected, { timeout: 15000 }); assert.equal(await count(), expected); };
try {
  await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Every clue/ }).waitFor();
  await page.getByRole("button", { name: /ENTER THE ARCHIVE/ }).click();
  await page.waitForURL("**/investigation");
  await waitCount(16);
  assert.equal(await page.locator(".photo-media img").count(), 6);
  assert.equal(await page.locator(".photo-media img").evaluateAll((items) => items.filter((img) => img.complete && img.naturalWidth > 0).length), 6);
  log("starter case and six photographs loaded");
  await page.screenshot({ path: "qa-desktop.png", fullPage: true });

  await page.locator('.rail-tool[title^="Note"]').click();
  await page.locator(".board-surface").click({ position: { x: 1050, y: 320 } });
  await waitCount(17);
  await page.locator(".evidence-inline-editor").fill("QA note: follow the northern service road.");
  await page.locator(".evidence-inline-editor").press("Tab");
  assert.equal(await page.locator(".evidence-note").last().locator(".note-writing").innerText(), "QA note: follow the northern service road.");
  log("added and edited a sticky note");

  const newNoteId = await page.locator(".evidence-note").last().getAttribute("data-evidence-id");
  await page.locator(`[data-evidence-id="${newNoteId}"]`).dblclick({ force: true });
  const editor = page.locator(".evidence-inline-editor");
  await editor.fill("Editing cannot delete the board.");
  await editor.press("Control+A");
  await editor.press("Backspace");
  assert.equal(await count(), 17, "Backspace in text editor must not remove evidence");
  await editor.fill("QA note: follow the northern service road.");
  await editor.press("Tab");
  log("keyboard shortcuts ignored during note editing");

  const beforeConnections = await page.locator(".connection-hit").count();
  await page.locator('.rail-tool[title^="String"]').click();
  await page.locator('[data-evidence-id="demo-road"]').click({ force: true });
  await page.locator('[data-evidence-id="demo-portrait"]').click({ force: true });
  await page.waitForFunction((n) => document.querySelectorAll(".connection-hit").length === n + 1, beforeConnections);
  const afterConnections = await page.locator(".connection-hit").count();
  log("connected two clues", `${beforeConnections} → ${afterConnections} strings`);

  await page.locator('.rail-tool[title^="Select"]').click();
  const portrait = page.locator('[data-evidence-id="demo-portrait"]');
  const beforeMove = await dimensions("demo-portrait");
  const box = await portrait.boundingBox();
  await page.mouse.move(box.x + box.width * .48, box.y + box.height * .57);
  await page.mouse.down(); await page.mouse.move(box.x + box.width * .48 + 53, box.y + box.height * .57 + 25, { steps: 6 }); await page.mouse.up();
  const afterMove = await dimensions("demo-portrait");
  assert(Math.abs(afterMove.x - beforeMove.x) > 15 && Math.abs(afterMove.y - beforeMove.y) > 8, `Portrait did not move: ${JSON.stringify({ beforeMove, afterMove })}`);
  log("moved connected evidence", `${beforeMove.x.toFixed(0)},${beforeMove.y.toFixed(0)} → ${afterMove.x.toFixed(0)},${afterMove.y.toFixed(0)}`);

  const handle = portrait.locator(".handle-se");
  const handleBox = await handle.boundingBox();
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down(); await page.mouse.move(handleBox.x + handleBox.width / 2 + 35, handleBox.y + handleBox.height / 2 + 26, { steps: 6 }); await page.mouse.up();
  const afterResize = await dimensions("demo-portrait");
  assert(afterResize.width > afterMove.width + 10, `Resize handle did not change width: ${JSON.stringify({ afterMove, afterResize })}`);
  assert(Math.abs(afterResize.width / afterResize.height - afterMove.width / afterMove.height) < .02, "Image frame aspect ratio changed during resize");
  assert.equal(await portrait.locator("img").evaluate((img) => getComputedStyle(img).objectFit), "contain");
  log("resized image without distorting its source");
  await page.keyboard.press("Control+z");
  assert(Math.abs((await dimensions("demo-portrait")).width - afterMove.width) < 2, "Undo did not revert resize");
  await page.keyboard.press("Control+Shift+z");
  assert(Math.abs((await dimensions("demo-portrait")).width - afterResize.width) < 2, "Redo did not restore resize");
  log("undo and redo restored the image dimensions");

  const zoomBefore = await page.locator(".board-zoom-controls span").innerText();
  await page.locator(".board-surface").hover({ position: { x: 650, y: 440 } });
  await page.mouse.wheel(0, -200);
  await page.waitForTimeout(200);
  const zoomAfter = await page.locator(".board-zoom-controls span").innerText();
  assert.notEqual(zoomBefore, zoomAfter, "Wheel zoom did not update view");
  log("zoomed at pointer", `${zoomBefore} → ${zoomAfter}`);

  const upload = page.locator('input[aria-label="Upload image evidence"]');
  await upload.setInputFiles(["public/evidence/forest-road.jpg", "public/evidence/control-room.jpg"]);
  await waitCount(19);
  await page.waitForTimeout(800);
  log("uploaded multiple image files");

  await page.evaluate(async () => {
    const canvas = document.createElement("canvas"); canvas.width = 72; canvas.height = 54;
    const ctx = canvas.getContext("2d"); ctx.fillStyle = "#345661"; ctx.fillRect(0, 0, 72, 54); ctx.fillStyle = "#d4b37e"; ctx.fillRect(14, 14, 39, 24);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  });
  await page.locator(".board-surface").hover({ position: { x: 650, y: 460 } });
  await page.keyboard.press("Control+v");
  await waitCount(20);
  log("pasted an image from the clipboard");

  const exact = await page.locator(".board-surface").evaluate((surface) => {
    const rect = surface.getBoundingClientRect(); const layer = document.querySelector(".world-layer");
    const transform = layer.style.transform.match(/translate3d\(([-\d.]+)px, ([-\d.]+)px, 0px?\) scale\(([-\d.]+)\)/);
    if (!transform) throw new Error(`Unexpected board transform: ${layer.style.transform}`);
    const offsetX = Number(transform[1]), offsetY = Number(transform[2]), zoom = Number(transform[3]);
    return { clientX: rect.left + 970, clientY: rect.top + 510, expectedX: (970 - offsetX) / zoom, expectedY: (510 - offsetY) / zoom, serialized: layer.style.transform };
  });
  await page.locator(".board-surface").evaluate(async (surface, pos) => {
    const canvas = document.createElement("canvas"); canvas.width = 55; canvas.height = 40;
    const ctx = canvas.getContext("2d"); ctx.fillStyle = "#714332"; ctx.fillRect(0, 0, 55, 40);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const transfer = new DataTransfer(); transfer.items.add(new File([blob], "precise-drop.png", { type: "image/png" }));
    for (const type of ["dragenter", "dragover", "drop"]) surface.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, clientX: pos.clientX, clientY: pos.clientY, dataTransfer: transfer }));
  }, exact);
  await waitCount(21);
  const dropped = await page.locator(".evidence-object").last().evaluate((item) => ({ x: parseFloat(item.style.left), y: parseFloat(item.style.top) }));
  assert(Math.abs(dropped.x - exact.expectedX) < 3 && Math.abs(dropped.y - exact.expectedY) < 3, `Drop location mismatch: ${JSON.stringify({ exact, dropped })}`);
  log("dropped an image at precise zoom-adjusted coordinates");

  await page.waitForFunction(() => document.querySelector(".save-status")?.textContent?.includes("Saved locally"), undefined, { timeout: 10000 });
  await page.reload({ waitUntil: "networkidle" });
  await waitCount(21);
  assert.equal(await page.locator(".photo-media img").count(), 10);
  await page.waitForFunction(() => [...document.querySelectorAll(".photo-media img")].filter((img) => img.complete && img.naturalWidth > 0).length === 10, undefined, { timeout: 10000 });
  assert((await page.locator(`[data-evidence-id="${newNoteId}"] .note-writing`).innerText()).includes("northern service road"));
  assert.equal(await page.locator(".connection-hit").count(), afterConnections);
  log("restored notes, strings, view, and imported images after refresh");

  const downloadPromise = page.waitForEvent("download", { timeout: 30000 });
  await page.locator(".share-button").click();
  await page.getByRole("button", { name: /Export complete case/ }).click();
  const download = await downloadPromise;
  await download.saveAs("qa-case.blackarchive.zip");
  const exportSize = (await stat("qa-case.blackarchive.zip")).size;
  assert(exportSize > 200000, `Archive unexpectedly small: ${exportSize}`);
  log("exported a complete ZIP case file", `${Math.round(exportSize / 1024)} KB`);

  await page.locator(".project-switch").click();
  await page.getByRole("button", { name: /New blank investigation/ }).click();
  await page.locator('.modal-field input').fill("QA BLANK CASE");
  await page.getByRole("button", { name: "Create investigation" }).click();
  await waitCount(0);
  log("created a blank investigation");
  await page.locator('input[aria-label="Import investigation case file"]').setInputFiles("qa-case.blackarchive.zip");
  await waitCount(21);
  await page.waitForFunction(() => [...document.querySelectorAll(".photo-media img")].filter((img) => img.complete && img.naturalWidth > 0).length === 10, undefined, { timeout: 10000 });
  log("reimported complete case with its ten photographs");

  await page.locator('[data-evidence-id="demo-portrait"]').click({ force: true });
  await page.locator('.inspector .toggle-list input').nth(2).check();
  await page.getByRole('button', { name: 'Add marker' }).click();
  assert.equal(await page.locator('[data-evidence-id="demo-portrait"] .photo-marker').count(), 1);
  assert.equal(await page.locator('.marker-coordinates input[type="range"]').count(), 2);
  await page.locator('.rotation-field button').click();
  assert.equal(await page.locator('[data-evidence-id="demo-portrait"]').evaluate((el) => el.style.transform), 'rotate(0deg)');
  log("edited photo markers and straightened its frame");

  await page.locator('.connection-hit').last().dispatchEvent('pointerdown', { button: 0, pointerId: 7 });
  assert.equal(await page.locator('.inspector-help').isVisible(), true);
  await page.locator('.inspector select').first().selectOption('curved');
  assert.equal(await page.locator('.inspector select').first().inputValue(), 'curved');
  log("selected and restyled an evidence connection");

  await page.evaluate(() => document.activeElement.blur());
  const oldPosition = await dimensions('demo-portrait');
  const oldTransform = await page.locator('.world-layer').getAttribute('style');
  const panBox = await page.locator('[data-evidence-id="demo-portrait"]').boundingBox();
  await page.mouse.move(panBox.x + panBox.width / 2, panBox.y + panBox.height / 2);
  await page.keyboard.down('Space');
  await page.mouse.down(); await page.mouse.move(panBox.x + panBox.width / 2 + 36, panBox.y + panBox.height / 2 + 20, { steps: 5 }); await page.mouse.up();
  await page.keyboard.up('Space');
  assert.notEqual(await page.locator('.world-layer').getAttribute('style'), oldTransform, 'Space drag did not pan');
  assert.equal((await dimensions('demo-portrait')).x, oldPosition.x, 'Space drag moved evidence');
  log("Space-drag pans from on top of a photograph");

  await page.locator('.board-zoom-controls button[title="Fit board to view"]').click();
  await page.locator('[data-evidence-id="demo-road"]').click({ force: true });
  await page.locator('[data-evidence-id="demo-control"]').click({ force: true, modifiers: ['Shift'] });
  assert.equal(await page.locator('.evidence-object.is-selected').count(), 2);
  const roadStart = await dimensions('demo-road'), controlStart = await dimensions('demo-control');
  const roadBox = await page.locator('[data-evidence-id="demo-road"]').boundingBox();
  await page.mouse.move(roadBox.x + roadBox.width / 2, roadBox.y + roadBox.height / 2);
  await page.mouse.down(); await page.mouse.move(roadBox.x + roadBox.width / 2 + 28, roadBox.y + roadBox.height / 2 + 18, { steps: 5 }); await page.mouse.up();
  const roadEnd = await dimensions('demo-road'), controlEnd = await dimensions('demo-control');
  assert(Math.abs((roadEnd.x - roadStart.x) - (controlEnd.x - controlStart.x)) < 2, 'Selected clues did not move as a group');
  log("shift-selected and moved a group of evidence");

  const priorTrayDrop = await count();
  await page.locator('.board-surface').evaluate((surface) => {
    const rect = surface.getBoundingClientRect();
    const transfer = new DataTransfer(); transfer.setData('application/x-black-archive-evidence', 'demo-tape');
    surface.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientX: rect.left + 750, clientY: rect.top + 680, dataTransfer: transfer }));
  });
  await waitCount(priorTrayDrop + 1);
  log("dragged an existing asset from the tray to duplicate it");

  await page.locator('.board-zoom-controls button[title="Reset view to 100%"]').click();
  assert.equal((await page.locator('.board-zoom-controls span').innerText()).trim(), '100%');
  await page.locator('.board-zoom-controls button[title="Fit board to view"]').click();
  log("reset view to 100% and fit the board again");

  const beforeDrawing = await count();
  await page.locator('.rail-tool[title^="Markings"]').click();
  await page.locator('.shape-options button').first().click();
  const surfaceBox = await page.locator('.board-surface').boundingBox();
  await page.mouse.move(surfaceBox.x + 445, surfaceBox.y + 697);
  await page.mouse.down(); await page.mouse.move(surfaceBox.x + 540, surfaceBox.y + 735, { steps: 7 }); await page.mouse.up();
  await waitCount(beforeDrawing + 1);
  assert.equal(await page.locator('.evidence-shape').count(), 1);
  log("drew a persistent rectangle marking");

  await page.keyboard.press('l');
  await page.locator('.board-surface').click({ position: { x: 650, y: 700 } });
  await page.locator('input[placeholder="https://example.org/source"]').fill('https://example.org/field-records');
  await page.locator('input[placeholder="What is this source?"]').fill('Field record index');
  await page.getByRole('button', { name: 'Pin source' }).click();
  await waitCount(beforeDrawing + 2);
  assert.equal(await page.locator('.evidence-link a[target="_blank"][rel="noopener noreferrer"]').count(), 1);
  log("pinned an external source with safe link behavior");

  await page.locator('.section-add').click();
  await page.locator('input[aria-label="Timeline date"]').fill('NOV 03 · 09:00');
  await page.locator('input[aria-label="Event title"]').fill('The archive is reopened');
  await page.getByRole('button', { name: 'Add event' }).click();
  assert.equal(await page.locator('.timeline-entry').count(), 6);
  log("added a real timeline event");

  await page.locator('.project-switch').click();
  await page.getByRole('button', { name: /Duplicate investigation/ }).click();
  await page.waitForFunction(() => document.querySelector('.project-current')?.textContent?.includes('/ COPY'));
  await page.locator('.project-switch').click();
  await page.getByRole('button', { name: /Delete investigation/ }).click();
  await page.getByRole('button', { name: 'Delete case' }).click();
  await page.waitForFunction(() => !document.querySelector('.project-current')?.textContent?.includes('/ COPY'));
  log("duplicated and deleted an investigation");

  await page.setViewportSize({ width: 840, height: 720 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: "qa-small.png", fullPage: true });
  assert.equal(await page.locator(".archive-app").evaluate((el) => el.scrollWidth <= window.innerWidth), true, "Workspace overflows on small viewport");
  log("small-screen layout stays within viewport");
  assert.deepEqual(errors, [], `Browser errors: ${errors.join("\n")}`);
  log("no uncaught browser or console errors");
} catch (error) {
  console.error(`FAILED AT: ${step}\n${error.stack || error}`);
  await page.screenshot({ path: "qa-failure.png", fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally { await browser.close(); }
