"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const BG_IMAGES = ["/assets/img1.png", "/assets/img2.png", "/assets/img3.png", "/assets/img5.png"];
const getFallbackBg = (i) => BG_IMAGES[i % BG_IMAGES.length];

const getProjectBg = (projName, index) => {
  const specificCovers = {
    timesheet: "/assets/timesheet.png",
    roomie: "/assets/roomie.png",
    tika: "/assets/tika.png",
    easypro: "/assets/pmpro.png",
    kmiso: "/assets/kmiso.png",
    eqinfo: "/assets/eqinfo.png",
  };
  return specificCovers[projName] || getFallbackBg(index);
};

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

const AdminIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 2L3 6v6c0 5 3.84 9.74 9 11 5.16-1.26 9-6 9-11V6l-9-4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function CarouselSection({ title, projects, themeBlue = false, onOpen }) {
  const carouselRef = useRef(null);
  const [activeDot, setActiveDot] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const autoRef = useRef(null);
  const total = projects.length;

  const updateDot = useCallback(() => {
    const el = carouselRef.current;
    if (!el) return;
    const cards = el.querySelectorAll(".card");
    if (!cards.length) return;

    const scrollLeft = el.scrollLeft;
    let closest = 0;
    let minDist = Infinity;
    cards.forEach((card, i) => {
      const dist = Math.abs(scrollLeft - card.offsetLeft);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    });
    setActiveDot(closest % total);
  }, [total]);

  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateDot, { passive: true });
    return () => el.removeEventListener("scroll", updateDot);
  }, [updateDot]);

  const startAuto = useCallback(() => {
    autoRef.current = setInterval(() => {
      carouselRef.current?.scrollBy({ left: 345, behavior: "smooth" });
    }, 4000);
  }, []);

  const stopAuto = useCallback(() => clearInterval(autoRef.current), []);
  const resetAuto = useCallback(() => {
    stopAuto();
    startAuto();
  }, [startAuto, stopAuto]);

  useEffect(() => {
    startAuto();
    return stopAuto;
  }, [startAuto, stopAuto]);

  const scrollTo = (index) => {
    const el = carouselRef.current;
    if (!el) return;
    const cards = el.querySelectorAll(".card");
    const card = cards[index];
    if (!card) return;
    el.scrollTo({ left: card.offsetLeft - el.clientWidth / 2 + card.offsetWidth / 2, behavior: "smooth" });
    resetAuto();
  };

  const prev = () => {
    carouselRef.current?.scrollBy({ left: -345, behavior: "smooth" });
    resetAuto();
  };

  const next = () => {
    carouselRef.current?.scrollBy({ left: 345, behavior: "smooth" });
    resetAuto();
  };

  return (
    <div className="section-block">
      <h3 className="section-title">{title}</h3>

      <div className={`nav-container ${themeBlue ? "theme-blue" : ""}`}>
        <div className="nav-dots">
          {projects.map((_, i) => (
            <button key={i} className={`nav-dot ${activeDot === i ? "active" : ""}`} onClick={() => scrollTo(i)} />
          ))}
        </div>
        <button className="view-all-btn" onClick={() => { stopAuto(); setModalOpen(true); }}>
          ทั้งหมด ({total})
        </button>
      </div>

      <div className="carousel-wrapper">
        <button className="nav-btn prev-btn" onClick={prev} aria-label="Previous"><ChevronLeft /></button>
        <div ref={carouselRef} className="carousel-container" onMouseEnter={stopAuto} onMouseLeave={startAuto}>
          {projects.map((proj, i) => <ProjectCard key={proj.name} proj={proj} index={i} onOpen={onOpen} />)}
        </div>
        <button className="nav-btn next-btn" onClick={next} aria-label="Next"><ChevronRight /></button>
      </div>

      {modalOpen && (
        <div className="modal-overlay active" onClick={(e) => {
          if (e.target.classList.contains("modal-overlay")) {
            setModalOpen(false);
            startAuto();
          }
        }}>
          <div className="modal-container">
            <div className="modal-header">
              <h3>โปรเจกต์ทั้งหมด — {title}</h3>
              <button className="modal-close-btn" onClick={() => { setModalOpen(false); startAuto(); }}>
                <CloseIcon />
              </button>
            </div>
            <div className="modal-grid">
              {projects.map((proj, i) => <ProjectCard key={proj.name} proj={proj} index={i} onOpen={onOpen} />)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectCard({ proj, index, onOpen }) {
  const num = String(index + 1).padStart(2, "0");
  const canOpen = proj.desiredState === "RUN";

  return (
    <div className="card" style={{ backgroundImage: `url('${getProjectBg(proj.name, index)}')` }}>
      <div className="card-content">
        <span className="card-number">{num}</span>
        <h3>
          <span className={`status-dot ${proj.running ? "online" : ""}`} />
          {proj.name}
          <span className={`status-pill inline ${proj.running ? "running" : "stopped"}`}>
            {proj.running ? "กำลังทำงาน" : "หยุดทำงาน"}
          </span>
        </h3>
      </div>

      <div className="card-footer">
        <button
          className={`card-btn ${canOpen ? "running" : "disabled"}`}
          disabled={!canOpen}
          onClick={() => canOpen && onOpen(proj)}
        >
          {canOpen ? "Open Application ↗" : "Under Modify"}
        </button>
      </div>
    </div>
  );
}

function AboutModal({ projects, onClose }) {
  return (
    <div className="modal-overlay active" onClick={(e) => e.target.classList.contains("modal-overlay") && onClose()}>
      <div className="modal-container about-modal">
        <div className="modal-header">
          <h3>About Portal Applications</h3>
          <button className="modal-close-btn" onClick={onClose}><CloseIcon /></button>
        </div>
        <div className="modal-grid">
          {projects.map((proj, idx) => (
            <div key={proj.name} className="card" style={{ backgroundImage: `url('${getProjectBg(proj.name, idx)}')`, height: 260 }}>
              <div className="card-content">
                <h3>{proj.name}</h3>
                <p>กลุ่ม: {proj.group === "general" ? "บริการทั่วไป" : "บริการเฉพาะ"}</p>
                <p>URL: {proj.appUrl}</p>
                <p>สถานะการแสดง Card: {proj.showCard ? "Show" : "Not show"}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminLoginModal({ onClose, onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Login failed");
      return;
    }
    onSuccess();
  };

  return (
    <div className="modal-overlay active" onClick={(e) => e.target.classList.contains("modal-overlay") && onClose()}>
      <div className="modal-container admin-login-modal">
        <div className="modal-header">
          <h3>Admin Login</h3>
          <button className="modal-close-btn" onClick={onClose}><CloseIcon /></button>
        </div>

        <form className="admin-login-form" onSubmit={submit}>
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" />
          <label>Password</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} required type="password" />
          {error && <div className="login-error">{error}</div>}
          <div className="admin-login-actions">
            <button type="button" className="card-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="card-btn running" disabled={loading}>{loading ? "Checking..." : "Login"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Home() {
  const [allProjects, setAllProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/public/projects");
      if (!res.ok) return;
      const data = await res.json();
      setAllProjects(data.projects || []);
    } catch {
      showToast("โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
    const id = setInterval(fetchProjects, 10000);
    return () => clearInterval(id);
  }, [fetchProjects]);

  const handleOpen = async (proj) => {
    if (proj.desiredState === "RUN" && !proj.running) {
      await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: proj.name }),
      });
    }

    await fetch("/api/public/track-open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appName: proj.name }),
    });
    window.open(proj.appUrl || `http://localhost/${proj.name}`, "_blank");
  };

  const visibleProjects = useMemo(() => allProjects.filter((item) => item.showCard), [allProjects]);
  const section1 = visibleProjects.filter((item) => item.group === "general");
  const section2 = visibleProjects.filter((item) => item.group === "specific");

  return (
    <div className="app-container">
      <header>
        <div className="logo-container">
          <img src="/assets/logo.png" alt="Portal Logo" className="app-logo" />
        </div>
        <h2 className="title">Projects Portal</h2>
        <p className="subtitle">เปิดและจัดการโปรเจกต์ WSL ทั้งหมดจากที่เดียว</p>
      </header>

      {loading ? (
        <div style={{ color: "var(--text-secondary)", marginTop: "4rem", display: "flex", gap: "10px", alignItems: "center" }}>
          <span className="spinner" /> กำลังโหลดโปรเจกต์...
        </div>
      ) : visibleProjects.length === 0 ? (
        <p style={{ color: "var(--text-secondary)", marginTop: "4rem" }}>ไม่พบโปรเจกต์</p>
      ) : (
        <>
          {section1.length > 0 && <CarouselSection title="บริการทั่วไป" projects={section1} themeBlue onOpen={handleOpen} />}
          {section2.length > 0 && <CarouselSection title="บริการเฉพาะ" projects={section2} onOpen={handleOpen} />}
        </>
      )}

      <div className="bottom-actions">
        <button className="refresh-btn" onClick={() => { fetchProjects(); showToast("รีเฟรชรายการโปรเจกต์แล้ว"); }}>
          ↺ รีเฟรช
        </button>
        <button className="floating-about-btn" onClick={() => setAboutOpen(true)}>
          About
        </button>
        <button className="floating-admin-btn" onClick={() => setAdminOpen(true)}>
          <AdminIcon /> Admin Login
        </button>
      </div>

      {toast && <div className="portal-toast">{toast}</div>}
      {aboutOpen && <AboutModal projects={allProjects} onClose={() => setAboutOpen(false)} />}
      {adminOpen && (
        <AdminLoginModal
          onClose={() => setAdminOpen(false)}
          onSuccess={() => {
            setAdminOpen(false);
            window.open("/manageportalapp", "manageportalapp");
            showToast("Admin login success");
          }}
        />
      )}
    </div>
  );
}
