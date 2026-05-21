import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

// ── Supabase ──────────────────────────────────────────────────────────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ── Constants ─────────────────────────────────────────────────────────────────
const MARKETS = [
  { id: "FR",          label: "França" },
  { id: "CH-BNL-DEAT", label: "CH-BNL-DEAT" },
];
const MARKET_COLORS = { FR: "#9333ea", "CH-BNL-DEAT": "#d97706" };
const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const SITE_PASSWORD = import.meta.env.VITE_SITE_PASSWORD || "partnersfranca";
const GATE_KEY = "faturacao_gate_v2";

const monthKey = (y, m) => `${y}-${String(m + 1).padStart(2, "0")}`;
const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const fmtEur = (n) => `${fmt(n)} €`;
const today = new Date();

// ── Password Gate ─────────────────────────────────────────────────────────────
function PasswordGate({ onUnlock }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const submit = (e) => {
    e.preventDefault();
    if (pw === SITE_PASSWORD) {
      try { localStorage.setItem(GATE_KEY, "1"); } catch {}
      onUnlock();
    } else {
      setErr("Password incorrecta");
      setPw("");
    }
  };
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-background-tertiary)" }}>
      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 16, padding: "2.5rem 2rem", width: 320, textAlign: "center" }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--color-background-info)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
          <svg width="20" height="20" fill="none" stroke="var(--color-text-info)" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <p style={{ fontWeight: 500, fontSize: 18, margin: "0 0 4px", color: "var(--color-text-primary)" }}>Faturação da Equipa</p>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 1.5rem" }}>Acesso restrito</p>
        <form onSubmit={submit}>
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Password" autoFocus
            style={{ width: "100%", marginBottom: 12, boxSizing: "border-box" }} />
          {err && <p style={{ fontSize: 12, color: "var(--color-text-danger)", margin: "0 0 10px" }}>{err}</p>}
          <button type="submit" style={{ width: "100%", padding: "9px", background: "#1D9E75", color: "#fff", border: "none", borderRadius: 8, fontWeight: 500, cursor: "pointer", fontSize: 14 }}>
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Data loading ──────────────────────────────────────────────────────────────
async function loadMonthData(year, month) {
  const key = monthKey(year, month);
  const { data } = await supabase.from("billing_months").select("entries,team_goals").eq("month_key", key).maybeSingle();
  return data || { entries: {}, team_goals: {} };
}

function computeStats(entries, teamGoals, totalDays, closedDay, year, month) {
  const goal = (Number(teamGoals?.equipa_fr) || 0);
  const daily = [];
  let lastFR = 0, lastCH = 0;

  for (let d = 1; d <= totalDays; d++) {
    const e = entries[d] || {};
    if (e.FR !== undefined) lastFR = Number(e.FR) || 0;
    if (e["CH-BNL-DEAT"] !== undefined) lastCH = Number(e["CH-BNL-DEAT"]) || 0;
    const cumul = lastFR + lastCH;
    const expected = goal > 0 ? Math.round((goal / totalDays) * d) : null;
    daily.push({ day: d, FR: lastFR, CH: lastCH, cumul, expected, supersales: e.supersales === true });
  }

  const actual = daily[closedDay - 1]?.cumul || 0;
  const dailyAvg = closedDay > 0 ? Math.round(actual / closedDay) : 0;
  const remaining = goal > 0 ? goal - actual : null;
  const remainingDays = totalDays - closedDay;
  const neededPerDay = remaining > 0 && remainingDays > 0 ? Math.round(remaining / remainingDays) : null;
  const projection = dailyAvg > 0 ? Math.round(actual + dailyAvg * remainingDays) : null;

  return { goal, actual, daily, dailyAvg, remaining, remainingDays, neededPerDay, projection, closedDay };
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
const card = { background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1.25rem" };
const metricCard = { background: "var(--color-background-secondary)", borderRadius: 8, padding: "14px 16px" };

function MetricCard({ label, value, sub, subColor }) {
  return (
    <div style={metricCard}>
      <p style={{ fontSize: 11, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: ".06em", margin: "0 0 6px" }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 500, margin: 0, color: "var(--color-text-primary)" }}>{value}</p>
      {sub && <p style={{ fontSize: 12, margin: "4px 0 0", color: subColor || "var(--color-text-secondary)" }}>{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }) {
  return <p style={{ fontSize: 12, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 500, margin: "0 0 12px" }}>{children}</p>;
}

// ── Análise Tab ───────────────────────────────────────────────────────────────
function AnaliseTab({ year, month, totalDays, closedDay, entries, teamGoals }) {
  const [mktScope, setMktScope] = useState("total");
  const [prevEntries, setPrevEntries] = useState({});

  useEffect(() => {
    loadMonthData(year - 1, month).then(d => setPrevEntries(d.entries || {}));
  }, [year, month]);

  const stats = useMemo(() => computeStats(entries, teamGoals, totalDays, closedDay, year, month), [entries, teamGoals, totalDays, closedDay]);
  const prevStats = useMemo(() => computeStats(prevEntries, {}, totalDays, totalDays, year - 1, month), [prevEntries, totalDays]);

  const evoPct = prevStats.actual > 0 ? ((stats.actual - prevStats.actual) / prevStats.actual * 100) : null;

  const chartData = stats.daily.map((d, i) => ({
    day: d.day,
    atual: d.day <= closedDay ? d.cumul : null,
    anterior: prevStats.daily[i]?.cumul || null,
    objetivo: d.expected,
    diario: d.day <= closedDay ? (d.cumul - (stats.daily[i - 1]?.cumul || 0)) : null,
    isSS: d.supersales,
  }));

  const mktData = MARKETS.map(m => {
    const lastEntry = stats.daily[closedDay - 1];
    return { label: m.label, value: lastEntry?.[m.id === "FR" ? "FR" : "CH"] || 0, color: MARKET_COLORS[m.id] };
  });
  const total = mktData.reduce((s, m) => s + m.value, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", gap: 8 }}>
        {[{ id: "total", label: "Total" }, ...MARKETS].map(m => (
          <button key={m.id} onClick={() => setMktScope(m.id)}
            style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, border: "0.5px solid var(--color-border-tertiary)", cursor: "pointer",
              background: mktScope === m.id ? "#1D9E75" : "transparent",
              color: mktScope === m.id ? "#fff" : "var(--color-text-secondary)" }}>
            {m.label || m.id}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10 }}>
        <MetricCard label="Faturado" value={fmtEur(stats.actual)}
          sub={evoPct != null ? `${evoPct >= 0 ? "+" : ""}${evoPct.toFixed(1)}% vs ${year - 1}` : `vs ${year - 1}: sem dados`}
          subColor={evoPct == null ? undefined : evoPct >= 0 ? "#1D9E75" : "var(--color-text-danger)"} />
        <MetricCard label="Objetivo" value={stats.goal > 0 ? fmtEur(stats.goal) : "Sem objetivo"}
          sub={stats.goal > 0 ? `${Math.round(stats.actual / stats.goal * 100)}% realizado` : undefined}
          subColor={stats.goal > 0 && stats.actual < stats.goal ? "var(--color-text-danger)" : "#1D9E75"} />
        <MetricCard label="Projeção" value={stats.projection ? fmtEur(stats.projection) : "—"}
          sub={stats.projection && stats.goal > 0 ? (stats.projection >= stats.goal ? "acima do objetivo" : "abaixo do objetivo") : undefined}
          subColor={stats.projection >= stats.goal ? "#1D9E75" : "var(--color-text-danger)"} />
        <MetricCard label="Média / dia" value={stats.dailyAvg > 0 ? fmtEur(stats.dailyAvg) : "—"}
          sub={stats.neededPerDay ? `precisa ${fmtEur(stats.neededPerDay)}` : undefined}
          subColor={stats.neededPerDay > stats.dailyAvg ? "var(--color-text-danger)" : "#1D9E75"} />
      </div>

      <div style={card}>
        <SectionTitle>Evolução acumulada vs objetivo</SectionTitle>
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 12 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 16, height: 2, background: "#1D9E75", display: "inline-block", borderRadius: 1 }}></span>{year}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 16, height: 2, background: "#B4B2A9", display: "inline-block", borderRadius: 1, borderTop: "2px dashed #B4B2A9" }}></span>{year - 1}</span>
          {stats.goal > 0 && <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 16, height: 2, background: "#9333ea", display: "inline-block", borderRadius: 1 }}></span>Objetivo</span>}
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.06)" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#888" }} axisLine={false} tickLine={false} interval={4} />
            <YAxis tickFormatter={v => v >= 1000 ? Math.round(v / 1000) + "k" : v} tick={{ fontSize: 10, fill: "#888" }} axisLine={false} tickLine={false} width={40} />
            <Tooltip formatter={(v, name) => [fmtEur(v), name === "atual" ? year : name === "anterior" ? year - 1 : "Objetivo"]} labelFormatter={l => `Dia ${l}`} contentStyle={{ borderRadius: 8, border: "0.5px solid var(--color-border-tertiary)", fontSize: 12 }} />
            {closedDay > 0 && closedDay < totalDays && <ReferenceLine x={closedDay} stroke="#ccc" strokeDasharray="3 3" />}
            <Line type="monotone" dataKey="atual" stroke="#1D9E75" strokeWidth={2} dot={false} connectNulls />
            <Line type="monotone" dataKey="anterior" stroke="#B4B2A9" strokeWidth={1.5} dot={false} strokeDasharray="4 3" connectNulls />
            {stats.goal > 0 && <Line type="monotone" dataKey="objetivo" stroke="#9333ea" strokeWidth={1.5} dot={false} strokeDasharray="6 3" />}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div style={card}>
          <SectionTitle>Faturação diária</SectionTitle>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={chartData.filter(d => d.diario != null && d.diario > 0)} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.06)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: "#888" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => Math.round(v / 1000) + "k"} tick={{ fontSize: 9, fill: "#888" }} axisLine={false} tickLine={false} width={28} />
              <Tooltip formatter={v => fmtEur(v)} labelFormatter={l => `Dia ${l}`} contentStyle={{ borderRadius: 8, border: "0.5px solid var(--color-border-tertiary)", fontSize: 11 }} />
              <Bar dataKey="diario" fill="#1D9E75" radius={[3, 3, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={card}>
          <SectionTitle>Por mercado</SectionTitle>
          {mktData.map(m => (
            <div key={m.label} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 13, color: "var(--color-text-primary)" }}>{m.label}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{fmtEur(m.value)}</span>
              </div>
              <div style={{ height: 6, background: "var(--color-background-secondary)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${total > 0 ? Math.round(m.value / total * 100) : 0}%`, background: m.color, borderRadius: 3 }} />
              </div>
            </div>
          ))}
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "0.5px solid var(--color-border-tertiary)", display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Dias fechados</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{closedDay} / {totalDays}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
function MainApp() {
  const [tab, setTab] = useState("analise");
  const [selectedMonth, setSelectedMonth] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`);
  const [monthData, setMonthData] = useState({ entries: {}, team_goals: {} });
  const [loading, setLoading] = useState(true);

  const [year, monthIdx] = selectedMonth.split("-").map(Number);
  const month = monthIdx - 1;
  const totalDays = daysInMonth(year, month);
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  const isPast = new Date(year, month + 1, 0) < new Date(today.getFullYear(), today.getMonth(), 1);
  const closedDay = isPast ? totalDays : isCurrentMonth ? Math.max(0, today.getDate() - 1) : 0;

  useEffect(() => {
    setLoading(true);
    loadMonthData(year, month).then(d => { setMonthData(d); setLoading(false); });
  }, [year, month]);

  const monthOptions = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    monthOptions.push({ value: monthKey(d.getFullYear(), d.getMonth()), label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` });
  }

  const tabs = [
    { id: "analise", label: "Análise" },
    { id: "registo", label: "Registo" },
    { id: "parceiros", label: "Parceiros" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-background-tertiary)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.25rem 1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <div>
            <p style={{ fontSize: 20, fontWeight: 500, margin: 0, color: "var(--color-text-primary)" }}>Faturação da Equipa</p>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "3px 0 0" }}>Equipa FR · França + CH-BNL-DEAT</p>
          </div>
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            style={{ fontSize: 13, padding: "7px 12px", borderRadius: 8, border: "0.5px solid var(--color-border-tertiary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}>
            {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", gap: 0, borderBottom: "0.5px solid var(--color-border-tertiary)", marginBottom: "1.5rem" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: "9px 20px", borderRadius: 0, border: "none", borderBottom: tab === t.id ? "2px solid #1D9E75" : "2px solid transparent",
                background: "transparent", color: tab === t.id ? "#1D9E75" : "var(--color-text-secondary)",
                fontWeight: tab === t.id ? 500 : 400, fontSize: 14, cursor: "pointer", transition: "all .15s" }}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--color-text-secondary)", fontSize: 14 }}>A carregar…</div>
        ) : (
          <>
            {tab === "analise" && (
              <AnaliseTab year={year} month={month} totalDays={totalDays} closedDay={closedDay}
                entries={monthData.entries || {}} teamGoals={monthData.team_goals || {}} />
            )}
            {tab === "registo" && (
              <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--color-text-secondary)", fontSize: 14 }}>
                Separador Registo — em breve
              </div>
            )}
            {tab === "parceiros" && (
              <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--color-text-secondary)", fontSize: 14 }}>
                Separador Parceiros — em breve
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [unlocked, setUnlocked] = useState(() => {
    try { return localStorage.getItem(GATE_KEY) === "1"; } catch { return false; }
  });
  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  return <MainApp />;
}
