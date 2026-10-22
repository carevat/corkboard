"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, Check, Clock3, FileText, Fingerprint, FolderOpen, GitBranch, Image as ImageIcon, LockKeyhole, Plus, Radio, Search, Shield, StickyNote } from "lucide-react";
import { createBlankInvestigation, createDemoInvestigation, type Investigation } from "@/lib/archive-types";
import { listInvestigations, saveInvestigation } from "@/lib/archive-storage";

const CURRENT_KEY = "black-archive-current-case";

function ArchiveEmblem({ size = 35 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 42 42" fill="none" aria-hidden="true"><path d="M21 2 40 36H2L21 2Z" stroke="currentColor" strokeWidth="1.5"/><path d="M21 9 34 33H8L21 9Z" stroke="currentColor" strokeWidth=".7" opacity=".75"/><path d="M11 24c3.2-4.4 6.6-6.5 10-6.5s6.8 2.1 10 6.5c-3.2 4.4-6.6 6.5-10 6.5s-6.8-2.1-10-6.5Z" stroke="currentColor" strokeWidth="1.3"/><circle cx="21" cy="24" r="3.3" stroke="currentColor" strokeWidth="1.2"/></svg>;
}

export default function ArchiveHome() {
  const router = useRouter();
  const [cases, setCases] = useState<Investigation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        let stored = await listInvestigations();
        if (!stored.length) {
          const demo = createDemoInvestigation();
          await saveInvestigation(demo);
          stored = [demo];
        }
        if (!mounted) return;
        setCases(stored);
        const remembered = localStorage.getItem(CURRENT_KEY);
        setActiveId(stored.find((item) => item.id === remembered)?.id ?? stored[0].id);
      } catch (cause) {
        if (mounted) setError(cause instanceof Error ? cause.message : "Could not open your local archive.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  function openCase(id?: string) {
    if (id) localStorage.setItem(CURRENT_KEY, id);
    router.push("/investigation");
  }
  async function newCase() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const fresh = createBlankInvestigation();
      await saveInvestigation(fresh);
      localStorage.setItem(CURRENT_KEY, fresh.id);
      router.push("/investigation");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create a new investigation.");
      setBusy(false);
    }
  }

  const current = cases.find((item) => item.id === activeId) ?? cases[0];
  return <main className="home-shell">
    <header className="home-header">
      <div className="home-brand"><ArchiveEmblem /><div><strong>THE BLACK ARCHIVE</strong><span>PRIVATE INVESTIGATION ROOM</span></div></div>
      <nav className="home-nav" aria-label="Home navigation"><a href="#the-archive">THE ARCHIVE</a><a href="#how-it-works">HOW IT WORKS</a></nav>
      <button type="button" className="home-header-action" onClick={() => openCase(activeId ?? undefined)}>ENTER WORKSPACE <ArrowUpRight size={15}/></button>
    </header>

    <section className="home-hero">
      <div className="home-hero-copy">
        <div className="home-eyebrow"><span className="home-live-dot"/> THE INVESTIGATION BEGINS HERE <span className="home-eyebrow-line"/></div>
        <h1>Every clue<br/>has a <em>story.</em></h1>
        <p className="home-hero-intro">A place for the unanswered. Pin the photographs. Connect the contradictions. Follow the thread until the bigger picture comes into focus.</p>
        <div className="home-hero-actions"><button type="button" className="home-primary" onClick={() => openCase(activeId ?? undefined)}>ENTER THE ARCHIVE <ArrowRight size={17}/></button><button type="button" className="home-secondary" onClick={newCase} disabled={busy}><Plus size={16}/>{busy ? "CREATING…" : "START A BLANK CASE"}</button></div>
        {error && <div className="home-error" role="alert">{error}</div>}
        <div className="home-hero-foot"><span><LockKeyhole size={13}/> PRIVATE BY DESIGN</span><i/><span><Shield size={13}/> SAVED IN YOUR BROWSER</span></div>
      </div>
      <div className="home-hero-visual" aria-label="A visual preview of photographs, notes and threads on an investigation corkboard">
        <div className="home-wood-frame"><div className="home-cork">
          <svg className="home-threads" viewBox="0 0 670 520" preserveAspectRatio="none" aria-hidden="true"><path d="M162 179 L351 117 L527 166 M161 180 L296 355 L535 373 M351 117 L296 355 M527 166 L535 373 M296 355 L113 380" fill="none" stroke="#17100c" strokeWidth="3" opacity=".65"/><path d="M162 179 L351 117 L527 166 M161 180 L296 355 L535 373 M351 117 L296 355 M527 166 L535 373 M296 355 L113 380" fill="none" stroke="#a6463a" strokeWidth="1.5" opacity=".88"/></svg>
          <div className="home-scrap home-scrap-title"><span className="home-mini-pin"/> THE SIGNAL WENT<br/>SILENT AT 03:17.<span className="home-scrap-underline"/></div>
          <div className="home-photo home-photo-tower"><span className="home-mini-pin"/><img src="/evidence/relay-tower.jpg" alt="Fictional relay tower in a misty forest"/><div>RELAY 04 <small>/ LAST KNOWN LOCATION</small></div></div>
          <div className="home-photo home-photo-portrait"><span className="home-mini-pin"/><img src="/evidence/mara-voss.jpg" alt="Fictional researcher Mara Voss"/><div>DR. MARA VOSS <small>/ MISSING</small></div></div>
          <div className="home-photo home-photo-room"><span className="home-mini-pin"/><img src="/evidence/control-room.jpg" alt="Dark radio relay control room"/><div>CONTROL ROOM <small>/ 03:17 AM</small></div></div>
          <div className="home-scrap home-scrap-question"><span className="home-mini-pin"/> What was on<br/>the missing<br/>eleven minutes?</div>
          <div className="home-photo home-photo-tape"><span className="home-mini-pin"/><img src="/evidence/tape-recorder.jpg" alt="Vintage reel-to-reel tape recorder"/><div>TAPE 7B <small>/ ORIGIN UNKNOWN</small></div></div>
          <div className="home-scrap home-scrap-footer">FOLLOW THE THREAD. <span>→</span></div>
        </div></div>
        <div className="home-visual-caption"><span>01 / THE INVESTIGATION ROOM</span><span>ALL EVIDENCE IS EDITABLE <ArrowUpRight size={12}/></span></div>
      </div>
    </section>

    <section className="home-archive-section" id="the-archive">
      <div className="home-section-heading"><div><div className="home-section-kicker"><span/> YOUR CASE FILES</div><h2>Pick up where you left off.</h2><p>Every investigation lives here, on this device. Open a case or start a new thread.</p></div><button type="button" className="home-new-inline" onClick={newCase} disabled={busy}><Plus size={16}/> NEW INVESTIGATION</button></div>
      <div className="home-case-grid">
        {loading ? <div className="home-cases-loading">OPENING YOUR ARCHIVE <span className="home-loading-dots">···</span></div> : cases.length ? cases.map((item) => {
          const photo = item.evidence.find((e) => e.type === "image" && e.src);
          const src = photo?.type === "image" ? photo.src : null;
          return <button type="button" className="home-case-card" key={item.id} onClick={() => openCase(item.id)}>
            <div className="home-case-image" style={src ? { backgroundImage: `linear-gradient(0deg, #0b1010ee, #0b101015 75%), url("${src}")` } : undefined}>{!src && <Fingerprint size={56} strokeWidth={.8}/>}<span className="home-case-stamp">{item.id === activeId ? "CURRENT CASE" : "CASE FILE"}</span></div>
            <div className="home-case-info"><span className="home-case-index">FILE / {item.id.slice(0, 6).toUpperCase()}</span><h3>{item.title}</h3><div className="home-case-meta"><span><ImageIcon size={13}/>{item.evidence.length} EVIDENCE</span><span><GitBranch size={13}/>{item.connections.length} CONNECTIONS</span></div><div className="home-case-bottom"><span><Clock3 size={12}/> UPDATED {new Date(item.updatedAt).toLocaleDateString()}</span><span className="home-case-open">OPEN CASE <ArrowUpRight size={14}/></span></div></div>
          </button>;
        }) : <div className="home-cases-loading">NO CASES YET. START WITH A BLANK INVESTIGATION.</div>}
        <button type="button" className="home-new-card" onClick={newCase} disabled={busy}><div className="home-new-card-icon"><Plus size={25} strokeWidth={1.2}/></div><strong>Start a new investigation</strong><span>A clean board. An open question.<br/>The next lead is yours to find.</span><small>OPEN A NEW CASE <ArrowRight size={13}/></small></button>
      </div>
    </section>

    <section className="home-method" id="how-it-works"><div className="home-method-heading"><span>THE METHOD / 001—003</span><h2>Make sense of the mystery.</h2></div><div className="home-method-grid"><div><span className="home-method-icon"><ImageIcon size={19}/></span><small>01 / COLLECT</small><h3>Gather the evidence.</h3><p>Drop in photographs, paste a screenshot, pin a note, or add a source. Each clue finds its place on the board.</p></div><div><span className="home-method-icon"><GitBranch size={19}/></span><small>02 / CONNECT</small><h3>Follow the thread.</h3><p>Draw strings between clues, mark contradictions, and see how the pieces relate without mistaking a theory for a fact.</p></div><div><span className="home-method-icon"><Search size={19}/></span><small>03 / DISCOVER</small><h3>See the whole picture.</h3><p>Pan out, trace the timeline, and revisit the details. Your investigation is saved privately as you go.</p></div></div></section>
    <footer className="home-footer"><div className="home-footer-brand"><ArchiveEmblem size={25}/><span>THE BLACK ARCHIVE</span></div><span>THE TRUTH IS IN THE DETAILS.</span><span>PRIVATE. LOCAL. YOURS.</span></footer>
  </main>;
}
