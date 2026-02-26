'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ── Cards background images (fallback if specific cover missing) ──
const BG_IMAGES = [
    '/assets/img1.png',
    '/assets/img2.png',
    '/assets/img3.png',
    '/assets/img5.png',
];
const getFallbackBg = (i) => BG_IMAGES[i % BG_IMAGES.length];

const getProjectBg = (projName, index) => {
    // กำหนดรูปภาพพื้นหลังให้ตรงกับความหมายของแต่ละ Project ตามที่คุณต้องการ
    const specificCovers = {
        'timesheet': '/assets/timesheet.png',
        'roomie': '/assets/roomie.png',
        'tika': '/assets/tika.png',
        'easypro': '/assets/pmpro.png',
        'kmiso': '/assets/kmiso.png',
        'eqinfo': '/assets/eqinfo.png'
    };

    if (specificCovers[projName]) {
        return specificCovers[projName];
    }
    return getFallbackBg(index);
};

// ── Close SVG ──
const CloseIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
const ChevronLeft = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
const ChevronRight = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// ────────────────────────────────────────────────
// CarouselSection — mirrors the carousel from projects/carousel
// ────────────────────────────────────────────────
function CarouselSection({ title, projects, themeBlue = false, onRun, onStop, onOpen, actingOn }) {
    const carouselRef = useRef(null);
    const [activeDot, setActiveDot] = useState(0);
    const [modalOpen, setModalOpen] = useState(false);
    const autoRef = useRef(null);

    const total = projects.length;

    // ─ update active dot based on scroll position ─
    const updateDot = useCallback(() => {
        const el = carouselRef.current;
        if (!el) return;
        const cards = el.querySelectorAll('.card');
        if (!cards.length) return;
        const center = el.getBoundingClientRect().left + el.clientWidth / 2;
        let closest = 0, minDist = Infinity;
        cards.forEach((c, i) => {
            const r = c.getBoundingClientRect();
            const d = Math.abs(center - (r.left + r.width / 2));
            if (d < minDist) { minDist = d; closest = i; }
        });
        setActiveDot(closest % total);
    }, [total]);

    useEffect(() => {
        const el = carouselRef.current;
        if (!el) return;
        el.addEventListener('scroll', updateDot, { passive: true });
        return () => el.removeEventListener('scroll', updateDot);
    }, [updateDot]);

    // ─ auto-scroll right every 4 s ─
    const startAuto = useCallback(() => {
        autoRef.current = setInterval(() => {
            carouselRef.current?.scrollBy({ left: 345, behavior: 'smooth' });
        }, 4000);
    }, []);

    const stopAuto = useCallback(() => clearInterval(autoRef.current), []);
    const resetAuto = useCallback(() => { stopAuto(); startAuto(); }, [stopAuto, startAuto]);

    useEffect(() => { startAuto(); return stopAuto; }, [startAuto, stopAuto]);

    const scrollTo = (index) => {
        const el = carouselRef.current;
        if (!el) return;
        const cards = el.querySelectorAll('.card');
        const card = cards[index];
        if (!card) return;
        el.scrollTo({ left: card.offsetLeft - el.clientWidth / 2 + card.offsetWidth / 2, behavior: 'smooth' });
        resetAuto();
    };

    const prev = () => { carouselRef.current?.scrollBy({ left: -345, behavior: 'smooth' }); resetAuto(); };
    const next = () => { carouselRef.current?.scrollBy({ left: 345, behavior: 'smooth' }); resetAuto(); };

    return (
        <div className="section-block">
            <h3 className="section-title">{title}</h3>

            {/* Nav row */}
            <div className={`nav-container ${themeBlue ? 'theme-blue' : ''}`}>
                <div className="nav-dots">
                    {projects.map((_, i) => (
                        <button
                            key={i}
                            className={`nav-dot ${activeDot === i ? 'active' : ''}`}
                            aria-label={`Go to card ${i + 1}`}
                            onClick={() => scrollTo(i)}
                        />
                    ))}
                </div>
                <button className="view-all-btn" onClick={() => { stopAuto(); setModalOpen(true); }}>
                    ทั้งหมด ({total})
                </button>
            </div>

            {/* Carousel */}
            <div className="carousel-wrapper">
                <button className="nav-btn prev-btn" onClick={prev} aria-label="Previous"><ChevronLeft /></button>

                <div
                    ref={carouselRef}
                    className="carousel-container"
                    onMouseEnter={stopAuto}
                    onMouseLeave={startAuto}
                >
                    {projects.map((proj, i) => (
                        <ProjectCard
                            key={proj.name}
                            proj={proj}
                            index={i}
                            actingOn={actingOn}
                            onRun={onRun}
                            onStop={onStop}
                            onOpen={onOpen}
                        />
                    ))}
                </div>

                <button className="nav-btn next-btn" onClick={next} aria-label="Next"><ChevronRight /></button>
            </div>

            {/* Modal */}
            {modalOpen && (
                <div
                    className="modal-overlay active"
                    onClick={(e) => { if (e.target.classList.contains('modal-overlay')) { setModalOpen(false); startAuto(); } }}
                >
                    <div className="modal-container">
                        <div className="modal-header">
                            <h3>โปรเจกต์ทั้งหมด — {title}</h3>
                            <button className="modal-close-btn" onClick={() => { setModalOpen(false); startAuto(); }}>
                                <CloseIcon />
                            </button>
                        </div>
                        <div className="modal-grid">
                            {projects.map((proj, i) => (
                                <ProjectCard
                                    key={proj.name}
                                    proj={proj}
                                    index={i}
                                    actingOn={actingOn}
                                    onRun={onRun}
                                    onStop={onStop}
                                    onOpen={onOpen}
                                    onClick={() => { setModalOpen(false); setTimeout(() => scrollTo(i), 300); startAuto(); }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ────────────────────────────────────────────────
// Single project card
// ────────────────────────────────────────────────
function ProjectCard({ proj, index, actingOn, onRun, onStop, onOpen, onClick }) {
    const isRunning = proj.running;
    const isActing = actingOn === proj.name;
    const num = String(index + 1).padStart(2, '0');

    return (
        <div
            className="card"
            style={{ backgroundImage: `url('${getProjectBg(proj.name, index)}')` }}
            onClick={onClick}
        >
            <div className="card-content">
                <span className="card-number">{num}</span>
                <h3>
                    <span className={`status-dot ${isRunning ? 'online' : ''}`} />
                    {proj.name}
                </h3>
                <p style={{ marginTop: '0.35rem' }}>{proj.message || (isRunning ? 'กำลังทำงาน' : 'หยุดทำงาน')}</p>
                {proj.logs?.length > 0 && (
                    <div className="card-log">
                        {proj.logs.slice(-3).map((l, i) => <div key={i}>{l}</div>)}
                    </div>
                )}
            </div>

            <div className="card-footer" onClick={(e) => e.stopPropagation()}>
                {isRunning ? (
                    <>
                        <a
                            href={proj.appUrl || `http://localhost/${proj.name}`}
                            target="_blank"
                            rel="noreferrer"
                            className="card-btn running"
                        >
                            เปิดแอป ↗
                        </a>
                        <button className="card-btn" style={{ fontSize: '0.78rem' }} onClick={() => onStop(proj.name)}>
                            หยุด
                        </button>
                    </>
                ) : (
                    <button className="card-btn" onClick={() => onRun(proj.name)} disabled={isActing}>
                        {isActing ? <><span className="spinner" /> กำลังเริ่ม…</> : 'Run ▶'}
                    </button>
                )}
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────
// Main page
// ────────────────────────────────────────────────
export default function Home() {
    const [allProjects, setAllProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actingOn, setActingOn] = useState(null);
    const [toast, setToast] = useState(null);

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    };

    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/status');
            if (!res.ok) return;
            const data = await res.json();
            setAllProjects(
                Object.entries(data).map(([name, info]) => ({ name, ...info }))
            );
        } catch (_) { }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        fetchStatus();
        const id = setInterval(fetchStatus, 4000);
        return () => clearInterval(id);
    }, [fetchStatus]);

    const handleRun = async (name) => {
        setActingOn(name);
        try {
            const res = await fetch('/api/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            const data = await res.json();
            showToast(data.message || `เริ่มต้น ${name} แล้ว`);
            setTimeout(fetchStatus, 1500);
        } catch (_) { showToast(`เกิดข้อผิดพลาดขณะเริ่ม ${name}`); }
        finally { setActingOn(null); }
    };

    const handleStop = async (name) => {
        try {
            const res = await fetch('/api/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            const data = await res.json();
            showToast(data.message || `หยุด ${name} แล้ว`);
            setTimeout(fetchStatus, 1000);
        } catch (_) { }
    };

    const handleOpen = (proj) => {
        window.open(proj.appUrl || `http://localhost/${proj.name}`, '_blank');
    };

    // Group projects based on their "group" property defined in projects.json
    const section1 = allProjects.filter(p => p.group === 'general');
    const section2 = allProjects.filter(p => p.group === 'specific');

    return (
        <div className="app-container">
            {/* Header */}
            <header>
                <div className="logo-container">
                    <img src="/assets/logo.png" alt="Portal Logo" className="app-logo" />
                </div>
                <h2 className="title">Projects Portal</h2>
                <p className="subtitle">เปิดและจัดการโปรเจกต์ WSL ทั้งหมดจากที่เดียว</p>
            </header>

            {loading ? (
                <div style={{ color: 'var(--text-secondary)', marginTop: '4rem', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span className="spinner" /> กำลังโหลดโปรเจกต์…
                </div>
            ) : allProjects.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', marginTop: '4rem' }}>
                    ไม่พบโปรเจกต์ — ตรวจสอบ <code>projects.json</code>
                </p>
            ) : (
                <>
                    {section1.length > 0 && (
                        <CarouselSection
                            title="บริการทั่วไป"
                            projects={section1}
                            themeBlue={true}
                            onRun={handleRun}
                            onStop={handleStop}
                            onOpen={handleOpen}
                            actingOn={actingOn}
                        />
                    )}
                    {section2.length > 0 && (
                        <CarouselSection
                            title="บริการเฉพาะ"
                            projects={section2}
                            themeBlue={false}
                            onRun={handleRun}
                            onStop={handleStop}
                            onOpen={handleOpen}
                            actingOn={actingOn}
                        />
                    )}
                </>
            )}

            {/* Manual Refresh */}
            <button className="refresh-btn" onClick={() => { fetchStatus(); showToast('รีเฟรชรายการโปรเจกต์แล้ว'); }}>
                ↺ รีเฟรช
            </button>

            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: '5rem', left: '50%', transform: 'translateX(-50%)',
                    background: 'rgba(20,20,28,0.95)', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff', padding: '0.7rem 1.6rem', borderRadius: '2rem',
                    fontSize: '0.9rem', backdropFilter: 'blur(10px)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 9999,
                    animation: 'fadeInUp 0.3s ease both',
                }}>
                    {toast}
                </div>
            )}
        </div>
    );
}
