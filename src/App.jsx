import React, { useState, useRef, useEffect } from "react";

/* Walmart Weekly Sales Forecasting Dashboard
   Drop this file in as src/App.js in a Create React App or Vite React project.
   No extra packages needed. */

const MODELS = [
  { id: "lr", name: "Linear Regression", short: "Linear", trainR2: 0.9309, r2: 0.9172, rmse: 162374, mae: 88452, mape: 8.69, gap: 0.0136, g: ["#fafafa", "#6b7280"],
    note: "Easy to read and explain. It misses the sharp holiday spikes, so big weeks are under predicted." },
  { id: "rf", name: "Random Forest", short: "Forest", trainR2: 0.9963, r2: 0.9807, rmse: 78504, mae: 52471, mape: 5.22, gap: 0.0157, g: ["#60a5fa", "#0071ce"],
    note: "A crowd of decision trees voting together. It follows curves and interactions that a straight line cannot." },
  { id: "xgb", name: "XGBoost", short: "XGBoost", trainR2: 0.9973, r2: 0.9864, rmse: 65733, mae: 42332, mape: 4.26, gap: 0.0109, g: ["#ffe08a", "#ff9f1c"],
    note: "Trees that learn from each other's mistakes. Best on every metric and the smallest overfitting gap." },
];

const METRICS = [
  { k: "r2", label: "Test R²", fmt: (v) => v.toFixed(4), best: "max", hint: "Share of sales variation explained. Higher is better." },
  { k: "rmse", label: "RMSE", fmt: (v) => "$" + v.toLocaleString(), best: "min", hint: "Typical miss in dollars, punishing big misses. Lower is better." },
  { k: "mae", label: "MAE", fmt: (v) => "$" + v.toLocaleString(), best: "min", hint: "Average miss in dollars. Lower is better." },
  { k: "mape", label: "MAPE", fmt: (v) => v + "%", best: "min", hint: "Average miss as a share of actual sales. Lower is better." },
];

const DRIVERS = {
  rf: { name: "Random Forest", parts: [["Sales a week ago", 86.7, "#3b9bff"], ["Sales four weeks ago", 8.8, "#ffc220"], ["Other twelve features", 4.5, "#9ca3af"]] },
  xgb: { name: "XGBoost", parts: [["Sales a week ago", 83.9, "#3b9bff"], ["Sales four weeks ago", 8.8, "#ffc220"], ["Other twelve features", 7.3, "#9ca3af"]] },
};

const STEPS = [
  ["Load", "6,435 weekly rows and 8 columns from Walmart.csv, covering 45 stores from February 2010 to October 2012.", "Each store has 143 weeks, so the data is a panel of many short time series."],
  ["Clean", "No duplicates and no missing values. Dates became real datetimes and rows were sorted by store, then date.", "Sorting first keeps lag features honest."],
  ["Outliers", "The IQR rule flagged 34 weeks, just 0.53% of rows. They sit around Thanksgiving and Christmas.", "They were kept, because they are real holiday demand the model must learn."],
  ["Features", "Fourteen predictors: calendar parts, three sales lags, a temperature and fuel price interaction, and the original covariates.", "Lags of 1, 4 and 12 weeks give each store a memory."],
  ["Split", "Lag features removed 540 rows, leaving 5,895. A random 80/20 split gave 4,716 for training and 1,179 for testing.", "All features were standardised first."],
  ["Model", "Linear Regression, Random Forest and XGBoost were trained on identical data and judged on R², RMSE, MAE and MAPE.", "XGBoost won."],
];

function CountUp({ to, decimals = 0, prefix = "", suffix = "" }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf, t0;
    const run = (t) => {
      if (!t0) t0 = t;
      const p = Math.min((t - t0) / 1200, 1);
      setV(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(run);
    };
    raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{prefix}{v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</>;
}

function Tilt({ children, className = "", max = 9, onClick, style }) {
  const ref = useRef(null);
  const move = (e) => {
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    ref.current.style.transform = `perspective(900px) rotateX(${-y * max}deg) rotateY(${x * max}deg) translateZ(6px)`;
    ref.current.style.setProperty("--mx", (x + 0.5) * 100 + "%");
    ref.current.style.setProperty("--my", (y + 0.5) * 100 + "%");
  };
  const leave = () => (ref.current.style.transform = "perspective(900px) rotateX(0) rotateY(0)");
  return (
    <div ref={ref} className={"glass tilt " + className} onMouseMove={move} onMouseLeave={leave} onClick={onClick} style={style}>
      {children}
    </div>
  );
}

function Cube({ h, w = 76, g }) {
  const fill = (b) => ({ background: `linear-gradient(180deg, ${g[0]}, ${g[1]})`, filter: `brightness(${b})` });
  return (
    <div className="cube" style={{ width: w, height: h }}>
      <div className="face" style={{ width: w, height: h, transform: `translateZ(${w / 2}px)`, ...fill(1) }} />
      <div className="face" style={{ width: w, height: h, transform: `translateZ(${-w / 2}px) rotateY(180deg)`, ...fill(0.6) }} />
      <div className="face" style={{ width: w, height: h, left: w, transformOrigin: "left", transform: `translateZ(${w / 2}px) rotateY(90deg)`, ...fill(0.72) }} />
      <div className="face" style={{ width: w, height: h, left: -w, transformOrigin: "right", transform: `translateZ(${w / 2}px) rotateY(-90deg)`, ...fill(0.82) }} />
      <div className="face" style={{ width: w, height: w, top: 0, transformOrigin: "top", transform: `translateZ(${w / 2}px) rotateX(90deg)`, ...fill(1.25) }} />
    </div>
  );
}

function Scene3D({ metric }) {
  const [rot, setRot] = useState(-28);
  const [spin, setSpin] = useState(false);
  const drag = useRef(null);
  useEffect(() => {
    if (!spin) return;
    const id = setInterval(() => setRot((r) => r + 0.8), 30);
    return () => clearInterval(id);
  }, [spin]);
  const vals = MODELS.map((m) => m[metric.k]);
  const max = Math.max(...vals);
  const bestVal = metric.best === "max" ? max : Math.min(...vals);
  return (
    <div>
      <div
        className="stage"
        onPointerDown={(e) => { drag.current = e.clientX; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (drag.current !== null) { setRot((r) => r + (e.clientX - drag.current) * 0.5); drag.current = e.clientX; } }}
        onPointerUp={() => (drag.current = null)}
      >
        <div className="floor" />
        <div className="scene" style={{ transform: `rotateX(-14deg) rotateY(${rot}deg)` }}>
          {MODELS.map((m) => (
            <Cube key={m.id} g={m.g} h={40 + (m[metric.k] / max) * 170} />
          ))}
        </div>
      </div>
      <div className="labels">
        {MODELS.map((m) => (
          <div key={m.id} className={m[metric.k] === bestVal ? "lab best" : "lab"}>
            <b>{metric.fmt(m[metric.k])}</b>
            <span>{m.short}{m[metric.k] === bestVal ? " (best)" : ""}</span>
          </div>
        ))}
      </div>
      <div className="row ctl">
        <input type="range" min="-90" max="90" value={Math.max(-90, Math.min(90, ((rot + 90) % 360) - 90))} onChange={(e) => { setSpin(false); setRot(+e.target.value); }} aria-label="Rotate chart" />
        <button className={spin ? "chip on" : "chip"} onClick={() => setSpin(!spin)}>{spin ? "Stop spinning" : "Auto spin"}</button>
      </div>
      <p className="muted small">Drag the chart sideways to turn it. Bar height compares models on the chosen metric.</p>
    </div>
  );
}

function Overview() {
  const [zoom, setZoom] = useState(false);
  const [open, setOpen] = useState(0);
  const reg = 1041948, hol = 1128303;
  const base = zoom ? 1000000 : 0;
  const hh = (v) => ((v - base) / (1200000 - base)) * 100;
  const kpis = [
    ["Variance explained", <CountUp to={98.64} decimals={2} suffix="%" />, "XGBoost on unseen test weeks"],
    ["Average error", <CountUp to={4.26} decimals={2} suffix="%" />, "MAPE for the best model"],
    ["Weekly records", <CountUp to={6435} />, "45 stores, 143 weeks each"],
    ["Holiday lift", <CountUp to={8.3} decimals={1} suffix="%" />, "Holiday weeks vs regular weeks"],
  ];
  const notes = [
    ["The split is random, not chronological", "Test weeks can sit between training weeks, so the accuracy shown is a best case estimate for real forecasting."],
    ["There is no naive baseline yet", "Sales_Lag1 dominates, so a simple 'same as last week' rule may already be strong. Test against it next."],
    ["It forecasts one week ahead", "The model needs last week's sales, so it cannot look several weeks out without changes."],
    ["Short and old data", "Only two to three holiday seasons per store, ending in 2012, before the rise of e-commerce."],
  ];
  return (
    <>
      <div className="kpis">
        {kpis.map((k, i) => (
          <Tilt key={i} className="kpi">
            <span className="muted">{k[0]}</span>
            <strong className="big">{k[1]}</strong>
            <span className="small muted">{k[2]}</span>
          </Tilt>
        ))}
      </div>
      <div className="grid2">
        <Tilt max={4} className="pad">
          <h3>Do holidays really lift sales?</h3>
          <p className="muted">Average weekly sales per store, holiday weeks against regular weeks.</p>
          <div className="bars">
            {[["Regular", reg, "#fafafa", "#6b7280"], ["Holiday", hol, "#ffe08a", "#ff9f1c"]].map((b) => (
              <div key={b[0]} className="bcol">
                <b>${b[1].toLocaleString()}</b>
                <div className="bar" style={{ height: hh(b[1]) * 1.8 + "px", background: `linear-gradient(180deg, ${b[2]}, ${b[3]})` }} />
                <span>{b[0]}</span>
              </div>
            ))}
          </div>
          <button className={zoom ? "chip on" : "chip"} onClick={() => setZoom(!zoom)}>{zoom ? "Show from zero" : "Zoom into the gap"}</button>
          <p className="small muted">{zoom ? "The axis starts at $1,000,000, which exaggerates the gap on purpose." : "From zero, the 8.3% lift looks modest but it is steady and real."}</p>
        </Tilt>
        <Tilt max={4} className="pad">
          <h3>What the sales data looks like</h3>
          <ul className="facts">
            <li><span>Mean weekly sales</span><b>$1,047,881</b></li>
            <li><span>Median weekly sales</span><b>$958,620</b></li>
            <li><span>Highest week</span><b>about $3.8M</b></li>
            <li><span>Outlier weeks</span><b>34 (0.53%)</b></li>
            <li><span>Peak months</span><b>November, December</b></li>
            <li><span>Quietest months</span><b>January, February</b></li>
          </ul>
          <p className="muted small">Sales lean to the right. Every outlier is a high week, none is a low one.</p>
        </Tilt>
      </div>
      <Tilt max={2} className="pad">
        <h3>Read these before trusting the numbers</h3>
        {notes.map((n, i) => (
          <div key={i} className={open === i ? "acc open" : "acc"}>
            <button onClick={() => setOpen(open === i ? -1 : i)}>{n[0]}<i>{open === i ? "−" : "+"}</i></button>
            <p>{n[1]}</p>
          </div>
        ))}
      </Tilt>
    </>
  );
}

function ModelsTab() {
  const [mi, setMi] = useState(0);
  const [sel, setSel] = useState("xgb");
  const m = MODELS.find((x) => x.id === sel);
  const metric = METRICS[mi];
  return (
    <>
      <Tilt max={2} className="pad">
        <div className="row wrap">
          <h3>Compare the three models</h3>
          <div className="row wrap">
            {METRICS.map((x, i) => (
              <button key={x.k} className={i === mi ? "chip on" : "chip"} onClick={() => setMi(i)}>{x.label}</button>
            ))}
          </div>
        </div>
        <p className="muted">{metric.hint}</p>
        <Scene3D metric={metric} />
      </Tilt>
      <div className="grid3">
        {MODELS.map((x) => (
          <Tilt key={x.id} className={"mcard pad" + (sel === x.id ? " sel" : "")} onClick={() => setSel(x.id)} style={{ "--a": x.g[0], "--b": x.g[1] }}>
            <div className="dot" style={{ background: `linear-gradient(135deg, ${x.g[0]}, ${x.g[1]})` }} />
            <h4>{x.name}</h4>
            <p className="muted small">{x.note}</p>
          </Tilt>
        ))}
      </div>
      <Tilt max={2} className="pad">
        <h3>{m.name} up close</h3>
        <div className="grid2">
          <div>
            <p className="muted small">Train R² against Test R². A small gap means the model learned patterns, not memorised rows.</p>
            {[["Train R²", m.trainR2], ["Test R²", m.r2]].map((r) => (
              <div key={r[0]} className="meter">
                <span>{r[0]}</span>
                <div className="track"><div className="fill" style={{ width: r[1] * 100 + "%", background: `linear-gradient(90deg, ${m.g[0]}, ${m.g[1]})` }} /></div>
                <b>{r[1].toFixed(4)}</b>
              </div>
            ))}
          </div>
          <div>
            <p className="muted small">Overfitting gap against the 0.05 caution line.</p>
            <div className="meter">
              <span>Gap</span>
              <div className="track"><div className="fill" style={{ width: (m.gap / 0.05) * 100 + "%", background: `linear-gradient(90deg, ${m.g[0]}, ${m.g[1]})` }} /><em style={{ left: "100%" }} /></div>
              <b>{m.gap.toFixed(4)}</b>
            </div>
            <p className="small">Right edge of the track is the 0.05 caution line. {m.name} stays well inside it.</p>
          </div>
        </div>
      </Tilt>
    </>
  );
}

function Drivers() {
  const [id, setId] = useState("xgb");
  const [hi, setHi] = useState(0);
  const d = DRIVERS[id];
  let acc = 0;
  const stops = d.parts.map((p) => { const s = acc; acc += p[1]; return `${p[2]} ${s}% ${acc}%`; }).join(", ");
  return (
    <Tilt max={2} className="pad">
      <div className="row wrap">
        <h3>What drives weekly sales</h3>
        <div className="row">
          {Object.keys(DRIVERS).map((k) => (
            <button key={k} className={k === id ? "chip on" : "chip"} onClick={() => setId(k)}>{DRIVERS[k].name}</button>
          ))}
        </div>
      </div>
      <div className="grid2 center">
        <div className="donutwrap">
          <div className="donut" style={{ background: `conic-gradient(${stops})`, transform: `rotateX(48deg) rotateZ(${hi * 20}deg)` }} />
          <div className="shadow" />
          <div className="dlabel"><b>{d.parts[hi][1]}%</b><span>{d.parts[hi][0]}</span></div>
        </div>
        <div>
          {d.parts.map((p, i) => (
            <div key={p[0]} className={hi === i ? "drow on" : "drow"} onMouseEnter={() => setHi(i)} onClick={() => setHi(i)}>
              <i style={{ background: p[2] }} />
              <span>{p[0]}</span>
              <b>{p[1]}%</b>
            </div>
          ))}
          <p className="muted">A store's own sales from one week ago do most of the work. Calendar effects such as month and holiday matter next. Temperature, fuel price, CPI and unemployment add little, because they move slowly while sales jump week to week.</p>
        </div>
      </div>
    </Tilt>
  );
}

function Pipeline() {
  const [flip, setFlip] = useState({});
  return (
    <>
      <p className="muted">Tap a card to flip it and read why each choice was made.</p>
      <div className="grid3">
        {STEPS.map((s, i) => (
          <div key={s[0]} className={flip[i] ? "flip on" : "flip"} onClick={() => setFlip({ ...flip, [i]: !flip[i] })}>
            <div className="inner">
              <div className="side glass front">
                <span className="stepn">Step {i + 1}</span>
                <h3>{s[0]}</h3>
                <p className="muted small">{s[1]}</p>
              </div>
              <div className="side glass back" style={{ background: "linear-gradient(135deg, rgba(0,113,206,.75), rgba(255,194,32,.35))" }}>
                <h3>Why it matters</h3>
                <p>{s[2]}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Planner() {
  const [sales, setSales] = useState(1000000);
  const [holiday, setHoliday] = useState(false);
  const centre = sales * (holiday ? 1.083 : 1);
  const lo = centre * 0.75, hi = centre * 1.25;
  const pos = (v) => ((v - lo) / (hi - lo)) * 100;
  return (
    <Tilt max={2} className="pad">
      <h3>Planning band calculator</h3>
      <p className="muted">Enter what you expect a store to sell next week. Each model's typical error then draws a range around it, so you can see how much room to leave for stock and staff.</p>
      <label className="slab">Expected sales: <b>${sales.toLocaleString()}</b></label>
      <input type="range" min="200000" max="3800000" step="10000" value={sales} onChange={(e) => setSales(+e.target.value)} aria-label="Expected weekly sales" />
      <button className={holiday ? "chip on" : "chip"} onClick={() => setHoliday(!holiday)}>{holiday ? "Holiday week on (+8.3%)" : "Regular week"}</button>
      <div className="bands">
        {MODELS.map((m) => {
          const a = centre * (1 - m.mape / 100), b = centre * (1 + m.mape / 100);
          return (
            <div key={m.id} className="band">
              <span>{m.short}</span>
              <div className="track tall">
                <div className="range" style={{ left: pos(a) + "%", width: pos(b) - pos(a) + "%", background: `linear-gradient(90deg, ${m.g[0]}, ${m.g[1]})` }} />
                <em style={{ left: pos(centre) + "%" }} />
              </div>
              <b>${Math.round(a / 1000).toLocaleString()}K to ${Math.round(b / 1000).toLocaleString()}K</b>
            </div>
          );
        })}
      </div>
      <p className="small muted">Ranges use each model's test MAPE. XGBoost averages a miss of about ${MODELS[2].mae.toLocaleString()}, so stock for the top of its band during peak weeks. This is an illustration of error size, not a live forecast.</p>
    </Tilt>
  );
}

function ParticleField() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current, x = c.getContext("2d");
    let w, h, raf;
    const size = () => { w = c.width = window.innerWidth; h = c.height = window.innerHeight; };
    size();
    window.addEventListener("resize", size);
    const cols = ["#ffffff", "#93c5fd", "#ffc220", "#6b7280"];
    const ps = Array.from({ length: 55 }, (_, i) => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, r: 1 + Math.random() * 2.2, c: cols[i % 4] }));
    const draw = () => {
      x.clearRect(0, 0, w, h);
      ps.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        x.globalAlpha = 0.8; x.fillStyle = p.c;
        x.beginPath(); x.arc(p.x, p.y, p.r, 0, 7); x.fill();
        for (let j = i + 1; j < ps.length; j++) {
          const q = ps[j], d = Math.hypot(p.x - q.x, p.y - q.y);
          if (d < 120) { x.globalAlpha = (1 - d / 120) * 0.25; x.strokeStyle = p.c; x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(q.x, q.y); x.stroke(); }
        }
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", size); };
  }, []);
  return <canvas ref={ref} className="particles" />;
}

function Glow() {
  const ref = useRef(null);
  useEffect(() => {
    const m = (e) => { ref.current.style.transform = `translate(${e.clientX - 200}px, ${e.clientY - 200}px)`; };
    window.addEventListener("mousemove", m);
    return () => window.removeEventListener("mousemove", m);
  }, []);
  return <div ref={ref} className="cglow" />;
}

const TABS = [["Overview", Overview], ["Models", ModelsTab], ["Drivers", Drivers], ["Pipeline", Pipeline], ["Planner", Planner]];

export default function App() {
  const [tab, setTab] = useState(0);
  const Page = TABS[tab][1];
  return (
    <div className="app">
      <style>{CSS}</style>
      <ParticleField /><Glow /><div className="aurora"><i /><i /><i /><i /></div>
      <header>
        <div>
          <h1>Walmart Weekly Sales Forecast</h1>
          <p className="muted">Three models, 45 stores and one clear winner. Explore how each one performs.</p>
        </div>
        <div className="row">
          <div className="spinwrap"><div className="spin"><Cube h={46} w={46} g={["#ffffff", "#0071ce"]} /><i className="ring r1" /><i className="ring r2" /></div></div>
          <div className="badge"><b>XGBoost</b><span>selected model</span></div>
        </div>
      </header>
      <nav>
        {TABS.map((t, i) => (
          <button key={t[0]} className={i === tab ? "tab on" : "tab"} onClick={() => setTab(i)}>{t[0]}</button>
        ))}
      </nav>
      <main key={tab}><Page /></main>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;800&family=DM+Sans:wght@400;500;700&display=swap');
*{box-sizing:border-box}
body{margin:0;background:#0a0826}
.app{min-height:100vh;color:#eef0ff;font-family:'DM Sans',system-ui,sans-serif;padding:28px clamp(16px,4vw,48px) 60px;position:relative;overflow:hidden;background:linear-gradient(160deg,#0a0826 0%,#1b0f4a 45%,#083344 100%)}
h1,h2,h3,h4,.big,.badge b{font-family:'Sora',sans-serif;margin:0}
h1{font-size:clamp(26px,4vw,44px);font-weight:800;background:linear-gradient(90deg,#fff,#a5f3fc 45%,#f9a8d4);-webkit-background-clip:text;background-clip:text;color:transparent}
h3{font-size:19px;margin-bottom:6px} h4{font-size:16px;margin:10px 0 4px}
.muted{color:#aab0d8} .small{font-size:13px}
.aurora i{position:fixed;border-radius:50%;filter:blur(90px);opacity:.45;animation:drift 18s ease-in-out infinite alternate;pointer-events:none}
.aurora i:nth-child(1){width:420px;height:420px;background:#7c3aed;top:-120px;left:-80px}
.aurora i:nth-child(2){width:380px;height:380px;background:#06b6d4;bottom:-120px;right:-60px;animation-delay:-6s}
.aurora i:nth-child(3){width:300px;height:300px;background:#ec4899;top:40%;left:55%;animation-delay:-12s;opacity:.25}
@keyframes drift{to{transform:translate(60px,40px) scale(1.2)}}
header,nav,main{position:relative;z-index:1;max-width:1100px;margin:0 auto}
header{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:22px}
.badge{padding:12px 20px;border-radius:16px;background:linear-gradient(135deg,#8b5cf6,#ec4899);box-shadow:0 12px 30px rgba(139,92,246,.45);display:flex;flex-direction:column;transform:perspective(600px) rotateY(-10deg)}
.badge span{font-size:12px;opacity:.9}
nav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:22px}
.tab,.chip{font:inherit;color:#dfe3ff;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.07);border-radius:999px;padding:9px 18px;cursor:pointer;transition:all .25s}
.tab:hover,.chip:hover{background:rgba(255,255,255,.16);transform:translateY(-2px)}
.tab.on,.chip.on{background:linear-gradient(90deg,#22d3ee,#8b5cf6);border-color:transparent;color:#fff;box-shadow:0 8px 22px rgba(34,211,238,.3)}
:focus-visible{outline:2px solid #67e8f9;outline-offset:2px}
main{display:grid;gap:18px;animation:in .5s ease}
@keyframes in{from{opacity:0;transform:translateY(14px)}}
.glass{background:linear-gradient(135deg,rgba(255,255,255,.12),rgba(255,255,255,.04));border:1px solid rgba(255,255,255,.16);border-radius:22px;backdrop-filter:blur(14px);box-shadow:0 18px 40px rgba(0,0,0,.35);position:relative}
.tilt{transition:transform .15s ease-out,box-shadow .3s;transform-style:preserve-3d}
.tilt::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:radial-gradient(260px circle at var(--mx,50%) var(--my,0%),rgba(255,255,255,.14),transparent 60%)}
.pad{padding:24px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:16px}
.kpi{padding:22px;display:flex;flex-direction:column;gap:6px}
.big{font-size:34px;font-weight:800;background:linear-gradient(90deg,#67e8f9,#f0abfc);-webkit-background-clip:text;background-clip:text;color:transparent}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px}
.grid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px}
.center{align-items:center}
.row{display:flex;gap:10px;align-items:center}.wrap{flex-wrap:wrap;justify-content:space-between}
.bars{display:flex;gap:40px;align-items:flex-end;justify-content:center;height:250px;margin:10px 0 14px}
.bcol{display:flex;flex-direction:column;align-items:center;gap:6px;justify-content:flex-end}
.bar{width:84px;border-radius:12px 12px 4px 4px;transition:height .7s cubic-bezier(.2,.9,.3,1.2);box-shadow:0 10px 24px rgba(0,0,0,.35)}
.facts{list-style:none;padding:0;margin:12px 0}
.facts li{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.1)}
.acc button{width:100%;display:flex;justify-content:space-between;font:inherit;font-weight:700;color:#fff;background:none;border:0;border-bottom:1px solid rgba(255,255,255,.12);padding:14px 0;cursor:pointer;text-align:left}
.acc i{font-style:normal;color:#67e8f9;font-size:20px}
.acc p{max-height:0;overflow:hidden;margin:0;color:#c3c8ee;transition:max-height .35s,padding .35s}
.acc.open p{max-height:120px;padding:10px 0}
.stage{height:330px;perspective:900px;display:flex;align-items:flex-end;justify-content:center;cursor:grab;position:relative;touch-action:none;padding-bottom:50px}
.stage:active{cursor:grabbing}
.floor{position:absolute;bottom:20px;left:8%;right:8%;height:120px;border-radius:50%;background:radial-gradient(ellipse,rgba(139,92,246,.45),transparent 70%);transform:rotateX(70deg)}
.scene{display:flex;gap:70px;transform-style:preserve-3d;transition:transform .1s linear;margin-left:-70px}
.cube{position:relative;transform-style:preserve-3d}
.face{position:absolute;top:auto;left:0;bottom:0}
.labels{display:flex;justify-content:center;gap:28px;flex-wrap:wrap;margin-top:6px}
.lab{display:flex;flex-direction:column;align-items:center;min-width:110px;padding:8px 12px;border-radius:12px;background:rgba(255,255,255,.06)}
.lab.best{background:linear-gradient(135deg,rgba(34,211,238,.3),rgba(139,92,246,.3));box-shadow:0 0 0 1px rgba(103,232,249,.5)}
.lab span{font-size:12px;color:#c3c8ee}
.ctl{margin-top:12px}.ctl input{flex:1}
input[type=range]{accent-color:#8b5cf6;width:100%}
.mcard{cursor:pointer}
.mcard.sel{box-shadow:0 0 0 2px var(--a),0 18px 44px rgba(0,0,0,.45)}
.dot{width:36px;height:36px;border-radius:12px;box-shadow:0 8px 18px rgba(0,0,0,.35)}
.meter{display:grid;grid-template-columns:70px 1fr 64px;gap:10px;align-items:center;margin:12px 0}
.track{height:14px;border-radius:99px;background:rgba(255,255,255,.1);position:relative;overflow:visible}
.track.tall{height:26px}
.fill{height:100%;border-radius:99px;transition:width .6s}
.track em{position:absolute;top:-4px;width:2px;height:calc(100% + 8px);background:#fff}
.donutwrap{height:280px;display:flex;align-items:center;justify-content:center;perspective:700px;position:relative}
.donut{width:220px;height:220px;border-radius:50%;transition:transform .6s;box-shadow:0 26px 0 -2px rgba(0,0,0,.3),0 40px 40px rgba(0,0,0,.4);-webkit-mask:radial-gradient(circle,transparent 52px,#000 53px);mask:radial-gradient(circle,transparent 52px,#000 53px)}
.dlabel{position:absolute;display:flex;flex-direction:column;align-items:center;text-align:center;width:100px;font-size:11px;top:42%}
.dlabel b{font-family:'Sora';font-size:22px}
.drow{display:flex;gap:12px;align-items:center;padding:12px;border-radius:12px;cursor:pointer;transition:background .2s}
.drow i{width:14px;height:14px;border-radius:5px}.drow span{flex:1}
.drow.on{background:rgba(255,255,255,.1)}
.flip{perspective:1000px;height:210px;cursor:pointer}
.inner{position:relative;width:100%;height:100%;transition:transform .7s;transform-style:preserve-3d}
.flip.on .inner{transform:rotateY(180deg)}
.side{position:absolute;inset:0;padding:20px;backface-visibility:hidden;-webkit-backface-visibility:hidden}
.back{transform:rotateY(180deg)}
.stepn{font-size:12px;color:#67e8f9}
.slab{display:block;margin:18px 0 6px}
.bands{margin:20px 0}
.band{display:grid;grid-template-columns:70px 1fr 150px;gap:12px;align-items:center;margin:14px 0}
.range{position:absolute;top:0;bottom:0;border-radius:99px;transition:all .3s;box-shadow:0 6px 16px rgba(0,0,0,.3)}
@media(max-width:600px){.band{grid-template-columns:1fr}.scene{gap:44px;margin-left:-44px}.meter{grid-template-columns:60px 1fr 56px}}
.particles{position:fixed;inset:0;z-index:0;pointer-events:none}
.cglow{position:fixed;top:0;left:0;width:400px;height:400px;border-radius:50%;pointer-events:none;z-index:0;mix-blend-mode:screen;transition:transform .25s ease-out;background:radial-gradient(circle,rgba(103,232,249,.22),rgba(139,92,246,.12) 45%,transparent 70%)}
.app{background:radial-gradient(900px 500px at 8% 0%,rgba(124,58,237,.55),transparent 60%),radial-gradient(800px 500px at 100% 18%,rgba(6,182,212,.4),transparent 60%),radial-gradient(700px 500px at 50% 100%,rgba(236,72,153,.32),transparent 60%),linear-gradient(160deg,#080621,#150b3d 50%,#06232f)}
.aurora i:nth-child(4){width:260px;height:260px;background:#fbbf24;top:15%;right:20%;opacity:.14;animation-delay:-3s}
h1{background-image:linear-gradient(90deg,#fff,#67e8f9,#f0abfc,#fcd34d,#fff);background-size:200% 100%;animation:slide 7s linear infinite}
.big{background-image:linear-gradient(90deg,#67e8f9,#a78bfa,#f472b6,#fcd34d,#67e8f9);background-size:200% 100%;animation:slide 6s linear infinite}
@keyframes slide{to{background-position:200% 0}}
.kpi::before,.mcard.sel::before{content:"";position:absolute;inset:-1px;border-radius:inherit;padding:1.5px;pointer-events:none;background:linear-gradient(120deg,#22d3ee,#8b5cf6,#f472b6,#fcd34d,#22d3ee);background-size:200% 100%;animation:slide 6s linear infinite;-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}
.badge{animation:pulse 2.4s ease-in-out infinite}
.lab.best{animation:pulse 2.4s ease-in-out infinite}
@keyframes pulse{50%{box-shadow:0 0 34px rgba(244,114,182,.7)}}
.spinwrap{perspective:500px;width:80px;height:80px;display:flex;align-items:center;justify-content:center}
.spin{position:relative;width:46px;height:46px;transform-style:preserve-3d;animation:turn 9s linear infinite}
@keyframes turn{from{transform:rotateX(-24deg) rotateY(0)}to{transform:rotateX(-24deg) rotateY(360deg)}}
.cube{animation:bob 4s ease-in-out infinite}
.cube:nth-child(2){animation-delay:-1.3s}.cube:nth-child(3){animation-delay:-2.6s}
.spin .cube{animation:none}
@keyframes bob{50%{transform:translateY(-10px)}}
.bar{position:relative;overflow:hidden}
.bar::after{content:"";position:absolute;inset:0;background:linear-gradient(105deg,transparent 30%,rgba(255,255,255,.4) 50%,transparent 70%);background-size:250% 100%;animation:sweep 3.2s ease-in-out infinite}
@keyframes sweep{from{background-position:150% 0}to{background-position:-50% 0}}
.fill{background-size:200% 100%}
.tab:active,.chip:active{transform:scale(.94)}
.drow:hover{transform:translateX(6px)}
.drow{transition:background .2s,transform .2s}
body{background:#000}
.app{background:radial-gradient(900px 520px at 8% 0%,rgba(0,113,206,.38),transparent 60%),radial-gradient(700px 480px at 100% 15%,rgba(255,194,32,.14),transparent 60%),radial-gradient(900px 500px at 50% 110%,rgba(255,255,255,.08),transparent 60%),linear-gradient(165deg,#000 0%,#0c0d12 55%,#15171f 100%)}
.aurora i:nth-child(1){background:#0071ce}.aurora i:nth-child(2){background:#3b9bff;opacity:.26}.aurora i:nth-child(3){background:#ffc220;opacity:.12}.aurora i:nth-child(4){background:#fff;opacity:.06}
.cglow{background:radial-gradient(circle,rgba(255,255,255,.16),rgba(59,155,255,.1) 45%,transparent 70%)}
.glass{backdrop-filter:none;background:linear-gradient(145deg,rgba(255,255,255,.11),rgba(255,255,255,.02) 40%,rgba(0,0,0,.5));border:1px solid rgba(255,255,255,.14);box-shadow:0 30px 60px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.22)}
.muted{color:#9ca3af}
h1{background-image:linear-gradient(90deg,#fff,#9ca3af,#fff,#3b9bff,#ffc220,#fff)}
.big{background-image:linear-gradient(90deg,#fff,#93c5fd,#ffc220,#fff)}
.badge{background:linear-gradient(135deg,#ffc220,#ff9f1c);color:#111;box-shadow:0 12px 30px rgba(255,194,32,.4)}
@keyframes pulse{50%{box-shadow:0 0 36px rgba(255,194,32,.75)}}
.tab.on,.chip.on{background:linear-gradient(90deg,#fff,#cbd5e1);color:#05060a;box-shadow:0 10px 26px rgba(255,255,255,.22)}
.kpi::before,.mcard.sel::before{background:linear-gradient(120deg,#fff,#3b9bff,#ffc220,#fff);background-size:200% 100%}
.lab.best{background:linear-gradient(135deg,rgba(255,194,32,.28),rgba(255,255,255,.06));box-shadow:0 0 0 1px rgba(255,194,32,.6)}
.floor{background:radial-gradient(ellipse,rgba(59,155,255,.45),transparent 70%)}
.stepn,.acc i{color:#ffc220}
input[type=range]{accent-color:#ffc220}
:focus-visible{outline-color:#ffc220}
.stage::before{content:"";position:absolute;left:4%;right:4%;bottom:6px;height:220px;transform:rotateX(72deg);background:linear-gradient(rgba(255,255,255,.2) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.2) 1px,transparent 1px);background-size:34px 34px;-webkit-mask:radial-gradient(ellipse,#000 30%,transparent 72%);mask:radial-gradient(ellipse,#000 30%,transparent 72%)}
.face{box-shadow:inset 0 0 0 1px rgba(255,255,255,.4),inset 0 0 26px rgba(255,255,255,.14)}
.kpi>*{transform:translateZ(34px)}.mcard>*{transform:translateZ(24px)}.pad>h3{transform:translateZ(20px)}
.spinwrap{width:120px;height:120px}
.ring{position:absolute;left:50%;top:50%;width:104px;height:104px;margin:-52px 0 0 -52px;border-radius:50%;border:2px solid rgba(255,255,255,.55)}
.r1{transform:rotateX(75deg)}.r2{transform:rotateY(75deg);border-color:#ffc220}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;