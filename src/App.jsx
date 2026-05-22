import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { LineChart, Line, BarChart, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
const MARKETS = [{ id: "FR", label: "França" }, { id: "CH-BNL-DEAT", label: "CH-BNL-DEAT" }];
const MARKET_COLORS = { FR: "#9333ea", "CH-BNL-DEAT": "#d97706" };
const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const SITE_PASSWORD = import.meta.env.VITE_SITE_PASSWORD || "partnersfranca";
const GATE_KEY = "faturacao_gate_v2";
const today = new Date();
const monthKey = (y, m) => `${y}-${String(m + 1).padStart(2, "0")}`;
const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const fmtEur = (n) => `${fmt(n)} €`;
const C = { bg:"#fff", card:"#F7F6F3", border:"#E8E6E0", text:"#2C2C2A", muted:"#888780", green:"#1D9E75", red:"#E24B4A", amber:"#BA7517" };
const T = {
  card: { background:C.card, borderRadius:12, padding:"1.1rem 1.25rem" },
  label: { fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:".06em", margin:"0 0 8px", fontWeight:500 },
  value: { fontSize:22, fontWeight:500, margin:0, color:C.text },
  sectionTitle: { fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:".06em", fontWeight:500, margin:"0 0 14px" },
};

function PasswordGate({ onUnlock }) {
  const [pw, setPw] = useState(""), [err, setErr] = useState("");
  const submit = (e) => {
    e.preventDefault();
    if (pw === SITE_PASSWORD) { try { localStorage.setItem(GATE_KEY, "1"); } catch {} onUnlock(); }
    else { setErr("Password incorrecta"); setPw(""); }
  };
  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.bg }}>
      <div style={{ background:C.bg, border:`0.5px solid ${C.border}`, borderRadius:16, padding:"2.5rem 2rem", width:320, textAlign:"center" }}>
        <div style={{ width:48, height:48, borderRadius:"50%", background:"#E1F5EE", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 1rem" }}>
          <svg width="20" height="20" fill="none" stroke={C.green} strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <p style={{ fontWeight:500, fontSize:18, margin:"0 0 4px", color:C.text }}>Faturação da Equipa</p>
        <p style={{ fontSize:13, color:C.muted, margin:"0 0 1.5rem" }}>Acesso restrito</p>
        <form onSubmit={submit}>
          <input type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="Password" autoFocus
            style={{ width:"100%", marginBottom:12, boxSizing:"border-box", border:`0.5px solid ${C.border}`, borderRadius:8, padding:"9px 12px", fontSize:14, outline:"none", background:C.bg, color:C.text }} />
          {err && <p style={{ fontSize:12, color:C.red, margin:"0 0 10px" }}>{err}</p>}
          <button type="submit" style={{ width:"100%", padding:"9px", background:C.green, color:"#fff", border:"none", borderRadius:8, fontWeight:500, cursor:"pointer", fontSize:14 }}>Entrar</button>
        </form>
      </div>
    </div>
  );
}

async function loadMonthData(year, month) {
  const { data } = await supabase.from("billing_months").select("entries,team_goals").eq("month_key", monthKey(year, month)).maybeSingle();
  return data || { entries:{}, team_goals:{} };
}

async function loadPartnersCount(year, month) {
  const start = new Date(year, month, 1).toISOString();
  const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
  const { count } = await supabase.from("partner_followup")
    .select("*", { count:"exact", head:true })
    .gte("stage_started_at", start)
    .lte("stage_started_at", end);
  return count || 0;
}

function buildDaily(entries, totalDays) {
  const daily = []; let lastFR=0, lastCH=0, prevCumul=0;
  for (let d=1; d<=totalDays; d++) {
    const e = entries[d] || {};
    if (e.FR !== undefined) lastFR = Number(e.FR)||0;
    if (e["CH-BNL-DEAT"] !== undefined) lastCH = Number(e["CH-BNL-DEAT"])||0;
    const cumul = lastFR + lastCH;
    daily.push({ day:d, FR:lastFR, CH:lastCH, cumul, dayValue:cumul>prevCumul?cumul-prevCumul:0, supersales:e.supersales===true });
    prevCumul = cumul;
  }
  return daily;
}

function computeStats(daily, teamGoals, totalDays, closedDay) {
  const goal = Number(teamGoals?.equipa_fr)||0;
  const partnerGoal = Number(teamGoals?.equipa_fr_partners)||0;
  const closed = daily.filter(d=>d.day<=closedDay);
  const actual = closed.length>0 ? closed[closed.length-1].cumul : 0;
  const expected = goal>0&&closedDay>0 ? Math.round(goal/totalDays*closedDay) : null;
  const vsExpected = expected!=null ? actual-expected : null;
  const vsExpPct = expected>0 ? (actual/expected*100) : null;
  const normal = closed.filter(d=>!d.supersales&&d.dayValue>0);
  const ss = closed.filter(d=>d.supersales&&d.dayValue>0);
  const avgNormal = normal.length>0 ? Math.round(normal.reduce((s,d)=>s+d.dayValue,0)/normal.length) : 0;
  const avgSS = ss.length>0 ? Math.round(ss.reduce((s,d)=>s+d.dayValue,0)/ss.length) : 0;
  const rem = totalDays-closedDay;
  const projNoSS = avgNormal>0 ? actual+avgNormal*rem : null;
  const projWithSS = avgNormal>0&&avgSS>0 ? actual+avgNormal*(rem-1)+avgSS : projNoSS;
  const dailyAvg = closedDay>0 ? Math.round(actual/closedDay) : 0;
  const neededPerDay = goal>0&&rem>0 ? Math.round((goal-actual)/rem) : null;
  const remaining = goal>0 ? goal-actual : null;
  const firstRevActual = Number(teamGoals?.equipa_fr_first_rev)||0;
  const firstRevGoal = Number(teamGoals?.equipa_fr_first_rev_goal)||0;
  return { goal, partnerGoal, actual, expected, vsExpected, vsExpPct, dailyAvg, neededPerDay, projNoSS, projWithSS, avgNormal, avgSS, remainingDays:rem, closedDay, remaining, firstRevActual, firstRevGoal };
}

function Modal({ title, subtitle, onClose, children }) {
  return (
    <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
      <div style={{ background:C.bg, borderRadius:16, width:"100%", maxWidth:520, maxHeight:"85vh", display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ padding:"1.25rem", borderBottom:`0.5px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
          <div>
            <p style={{ fontWeight:500, fontSize:16, margin:0, color:C.text }}>{title}</p>
            <p style={{ fontSize:13, color:C.muted, margin:"3px 0 0" }}>{subtitle}</p>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:C.muted, fontSize:24, padding:"0 4px", lineHeight:1 }}>×</button>
        </div>
        <div style={{ overflowY:"auto", flex:1 }}>{children}</div>
      </div>
    </div>
  );
}

function DailyDetailModal({ daily, closedDay, goal, mode, onClose }) {
  const rows = daily.filter(d=>d.day<=closedDay&&d.cumul>0);
  const isObj = mode === "objetivo";
  return (
    <Modal title={isObj?"% do objetivo mensal — evolução diária":"% vs. esperado — evolução diária"}
      subtitle={`Equipa FR · ${closedDay} dias fechados`} onClose={onClose}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
        <thead style={{ position:"sticky", top:0, background:C.bg, zIndex:1 }}>
          <tr>{[{v:"DIA"},{v:"ACUMULADO"},...(isObj?[{v:"% DO OBJETIVO"}]:[{v:"ESPERADO"},{v:"% VS. ESPERADO"}])].map((h,i)=>(
            <th key={i} style={{ padding:"10px 1.25rem", textAlign:i===0?"left":"right", color:C.muted, fontWeight:500, fontSize:11, textTransform:"uppercase", letterSpacing:".06em", borderBottom:`0.5px solid ${C.border}` }}>{h.v}</th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.map(d=>{
            if (isObj) {
              const pct = goal>0?(d.cumul/goal*100):null;
              return (
                <tr key={d.day} style={{ borderBottom:`0.5px solid ${C.card}`, background:d.supersales?"#FAEEDA":"transparent" }}>
                  <td style={{ padding:"11px 1.25rem", fontWeight:500, color:C.text }}>{d.day}{d.supersales?" ⚡":""}</td>
                  <td style={{ padding:"11px 1.25rem", textAlign:"right", fontWeight:500, color:C.text }}>{fmtEur(d.cumul)}</td>
                  <td style={{ padding:"11px 1.25rem", textAlign:"right", fontWeight:500, color:pct==null?C.muted:pct>=100?C.green:pct>=80?C.amber:C.muted }}>{pct!=null?`${pct.toFixed(1)}%`:"—"}</td>
                </tr>
              );
            } else {
              const exp = goal>0?Math.round(goal/daily.length*d.day):null;
              const pct = exp>0?(d.cumul/exp*100):null;
              return (
                <tr key={d.day} style={{ borderBottom:`0.5px solid ${C.card}`, background:d.supersales?"#FAEEDA":"transparent" }}>
                  <td style={{ padding:"11px 1.25rem", fontWeight:500, color:C.text }}>{d.day}{d.supersales?" ⚡":""}</td>
                  <td style={{ padding:"11px 1.25rem", textAlign:"right", fontWeight:500, color:C.text }}>{fmtEur(d.cumul)}</td>
                  <td style={{ padding:"11px 1.25rem", textAlign:"right", color:C.muted }}>{exp?fmtEur(exp):"—"}</td>
                  <td style={{ padding:"11px 1.25rem", textAlign:"right", fontWeight:500, color:pct==null?C.muted:pct>=100?C.green:pct>=90?C.amber:C.red }}>{pct!=null?`${pct.toFixed(1)}%`:"—"}</td>
                </tr>
              );
            }
          })}
        </tbody>
      </table>
    </Modal>
  );
}

function StatCard({ label, value, sub, subColor, onClick, highlight, small }) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ ...T.card, ...(highlight?{border:`2px solid ${C.green}`}:{}), ...(onClick?{cursor:"pointer"}:{}), ...(hov&&onClick?{background:"#EEEDE8"}:{}) }}>
      <p style={T.label}>{label}</p>
      <p style={{ ...T.value, fontSize:small?18:22 }}>{value}</p>
      {sub && <p style={{ fontSize:12, margin:"6px 0 0", color:subColor||C.muted }}>{sub}</p>}
      {onClick && <p style={{ fontSize:11, color:C.green, margin:"8px 0 0" }}>ver detalhe →</p>}
    </div>
  );
}

function AnaliseTab({ year, month, totalDays, closedDay, entries, teamGoals }) {
  const [modal, setModal] = useState(null);
  const [partnersCount, setPartnersCount] = useState(null);

  useEffect(()=>{
    loadPartnersCount(year, month).then(setPartnersCount);
  }, [year, month]);

  const daily = useMemo(()=>buildDaily(entries,totalDays),[entries,totalDays]);
  const stats = useMemo(()=>computeStats(daily,teamGoals,totalDays,closedDay),[daily,teamGoals,totalDays,closedDay]);

  const pctMonth = (closedDay/totalDays*100).toFixed(1);
  const pctObj = stats.goal>0 ? (stats.actual/stats.goal*100).toFixed(1) : null;
  const pctPartners = stats.partnerGoal>0&&partnersCount!=null ? (partnersCount/stats.partnerGoal*100).toFixed(1) : null;
  const remainingPartners = stats.partnerGoal>0&&partnersCount!=null ? stats.partnerGoal-partnersCount : null;

  const chartData = daily.map(d=>({
    day:d.day,
    atual:d.day<=closedDay?d.cumul:null,
    objetivo:stats.goal>0?Math.round(stats.goal/totalDays*d.day):null,
  }));
  const barData = daily.filter(d=>d.day<=closedDay&&d.dayValue>0).map(d=>({day:d.day,value:d.dayValue,ss:d.supersales}));

  // Weekday averages from closed non-SS days
  const wdTotals = Array.from({length:7},()=>({sum:0,count:0}));
  daily.filter(d=>d.day<=closedDay&&!d.supersales&&d.dayValue>0).forEach(d=>{
    const wd = new Date(year, month, d.day).getDay();
    wdTotals[wd].sum += d.dayValue;
    wdTotals[wd].count++;
  });
  const globalAvg = closedDay>0 ? Math.round(daily.filter(d=>d.day<=closedDay&&!d.supersales&&d.dayValue>0).reduce((s,d)=>s+d.dayValue,0)/Math.max(closedDay,1)) : 0;
  const wdAvgs = wdTotals.map(w=>w.count>0?Math.round(w.sum/w.count):globalAvg);

  // All days bar data (including future days with wdAvg only)
  const allDaysBar = daily.map(d=>{
    const wd = new Date(year, month, d.day).getDay();
    return { day:d.day, value:d.day<=closedDay?d.dayValue:0, ss:d.supersales, wdAvg:wdAvgs[wd]||globalAvg };
  });

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
      {modal && <DailyDetailModal daily={daily} closedDay={closedDay} goal={stats.goal} mode={modal} onClose={()=>setModal(null)} />}

      {/* Row 1 — faturação */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4, minmax(0,1fr))", gap:10 }}>
        <StatCard label="Faturado" value={fmtEur(stats.actual)}
          sub={stats.remaining!=null?`faltam ${fmtEur(stats.remaining)} para o objetivo`:undefined}
          subColor={C.muted}
          onClick={()=>setModal("faturado")} highlight />
        <StatCard label="Objetivo" value={stats.goal>0?fmtEur(stats.goal):"Sem objetivo"}
          sub={pctObj!=null?`${pctObj}% realizado em ${pctMonth}% do mês`:undefined}
          subColor={pctObj!=null&&Number(pctObj)<Number(pctMonth)?C.red:C.green}
          onClick={stats.goal>0?()=>setModal("objetivo"):undefined} />
        <StatCard label={`Esperado ao dia ${closedDay}`} value={stats.expected?fmtEur(stats.expected):"—"}
          sub={stats.vsExpPct!=null?`${stats.vsExpPct.toFixed(1)}% vs o esperado ao dia ${closedDay}`:undefined}
          subColor={stats.vsExpPct==null?undefined:stats.vsExpPct>=100?C.green:stats.vsExpPct>=90?C.amber:C.red}
          onClick={stats.goal>0?()=>setModal("esperado"):undefined} />
        <StatCard label={stats.vsExpected!=null&&stats.vsExpected>=0?"Acima do esperado":"Abaixo do esperado"}
          value={stats.vsExpected!=null?`${stats.vsExpected>=0?"+":"-"}${fmtEur(Math.abs(stats.vsExpected))}`:"-"}
          sub={`ao dia ${closedDay}`}
          subColor={stats.vsExpected==null?undefined:stats.vsExpected>=0?C.green:C.red} />
      </div>

      {/* Row 2 — projeções */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3, minmax(0,1fr))", gap:10 }}>
        <StatCard label="Média / dia" value={stats.dailyAvg>0?fmtEur(stats.dailyAvg):"—"}
          sub={stats.neededPerDay?`é preciso ${fmtEur(stats.neededPerDay)}/dia para atingir 100% do objetivo`:undefined}
          subColor={stats.neededPerDay&&stats.neededPerDay>stats.dailyAvg?C.red:C.green} small />
        <StatCard label="Projeção sem Supersales" value={stats.projNoSS?fmtEur(stats.projNoSS):"—"}
          sub={stats.projNoSS&&stats.goal>0?(stats.projNoSS>=stats.goal?"↑ acima do objetivo":"↓ abaixo do objetivo"):`média ${stats.avgNormal>0?fmtEur(stats.avgNormal):"—"}/dia`}
          subColor={stats.projNoSS>=stats.goal?C.green:C.red} small />
        <StatCard label="Projeção com Supersales" value={stats.projWithSS?fmtEur(stats.projWithSS):"—"}
          sub={stats.projWithSS&&stats.goal>0?(stats.projWithSS>=stats.goal?"↑ acima do objetivo":"↓ abaixo do objetivo"):`SS médio ${stats.avgSS>0?fmtEur(stats.avgSS):"sem dados"}`}
          subColor={stats.projWithSS>=stats.goal?C.green:C.red} small />
      </div>

      {/* Chart */}
      <div style={T.card}>
        <p style={T.sectionTitle}>Evolução acumulada vs objetivo</p>
        <div style={{ display:"flex", gap:16, fontSize:12, color:C.muted, marginBottom:12 }}>
          {[{c:C.green,l:"Resultado"},{c:"#9333ea",l:"Objetivo"}].map(({c,l})=>(
            <span key={l} style={{ display:"flex", alignItems:"center", gap:5 }}>
              <span style={{ width:16, height:2, background:c, display:"inline-block", borderRadius:1 }}></span>{l}
            </span>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top:4, right:8, left:8, bottom:0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1EFE8" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize:10, fill:"#B4B2A9" }} axisLine={false} tickLine={false} interval={4} />
            <YAxis tickFormatter={v=>v>=1000?Math.round(v/1000)+"k":v} tick={{ fontSize:10, fill:"#B4B2A9" }} axisLine={false} tickLine={false} width={40} />
            <Tooltip formatter={(v,n)=>[fmtEur(v),n==="atual"?"Resultado":"Objetivo"]} labelFormatter={l=>`Dia ${l}`} contentStyle={{ borderRadius:8, border:`0.5px solid ${C.border}`, fontSize:12, background:C.bg }} />
            {closedDay>0&&closedDay<totalDays&&<ReferenceLine x={closedDay} stroke="#D3D1C7" strokeDasharray="3 3" />}
            <Line type="monotone" dataKey="atual" stroke={C.green} strokeWidth={2} dot={false} connectNulls />
            {stats.goal>0&&<Line type="monotone" dataKey="objetivo" stroke="#9333ea" strokeWidth={1.5} dot={false} strokeDasharray="6 3" />}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={T.card}>
        <p style={T.sectionTitle}>Faturação diária vs. média por dia da semana</p>
        <div style={{ display:"flex", gap:16, fontSize:11, color:C.muted, marginBottom:12 }}>
          <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:8, height:8, borderRadius:2, background:C.green, display:"inline-block" }}></span>Acima da média</span>
          <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:8, height:8, borderRadius:2, background:C.red, display:"inline-block" }}></span>Abaixo da média</span>
          <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:8, height:8, borderRadius:2, background:"#d97706", display:"inline-block" }}></span>Supersales</span>
          <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:16, height:2, background:"#9333ea", display:"inline-block", borderRadius:1 }}></span>Média esperada</span>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <ComposedChart data={allDaysBar} margin={{ top:4, right:8, left:0, bottom:0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1EFE8" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize:9, fill:"#B4B2A9" }} axisLine={false} tickLine={false} interval={2} />
            <YAxis tickFormatter={v=>Math.round(v/1000)+"k"} tick={{ fontSize:9, fill:"#B4B2A9" }} axisLine={false} tickLine={false} width={28} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active||!payload?.length) return null;
                const d = payload[0]?.payload;
                return (
                  <div style={{ background:C.bg, border:`0.5px solid ${C.border}`, borderRadius:8, padding:"8px 12px", fontSize:12 }}>
                    <p style={{ margin:"0 0 4px", fontWeight:500, color:C.text }}>Dia {label}</p>
                    {d.value>0&&<p style={{ margin:"0 0 2px", color:C.text }}>Faturado: {fmtEur(d.value)}</p>}
                    <p style={{ margin:0, color:C.muted }}>Média esperada: {fmtEur(d.wdAvg)}</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="value" radius={[3,3,0,0]} maxBarSize={16}>
              {allDaysBar.map((d,i)=><Cell key={i} fill={d.value===0?"transparent":d.ss?"#d97706":d.value>=d.wdAvg?C.green:C.red} />)}
            </Bar>
            <Line type="stepAfter" dataKey="wdAvg" stroke="#9333ea" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
          </ComposedChart>
        </ResponsiveContainer>
        <div style={{ marginTop:8, display:"flex", justifyContent:"space-between", fontSize:12, color:C.muted }}>
          <span>Dias fechados: {closedDay} / {totalDays}</span>
          {barData.some(d=>d.ss)&&<span>⚡ dias com Supersales</span>}
        </div>
      </div>

      {/* Row 5 — parceiros + primeiras compras */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3, minmax(0,1fr))", gap:10 }}>
        <StatCard label="Novos parceiros" value={partnersCount!=null?fmt(partnersCount):"—"}
          sub={remainingPartners!=null?(remainingPartners>0?`faltam ${fmt(remainingPartners)} para o objetivo`:"objetivo atingido!"):undefined}
          subColor={remainingPartners!=null&&remainingPartners<=0?C.green:C.muted}
          highlight={partnersCount!=null&&stats.partnerGoal>0&&partnersCount>=stats.partnerGoal} />
        <StatCard label="Objetivo de novos parceiros" value={stats.partnerGoal>0?fmt(stats.partnerGoal):"Sem objetivo"}
          sub={pctPartners!=null?`${pctPartners}% realizado em ${pctMonth}% do mês`:undefined}
          subColor={pctPartners!=null&&Number(pctPartners)<Number(pctMonth)?C.red:C.green} />
        <StatCard label="Faturação primeiras compras"
          value={stats.firstRevActual>0?fmtEur(stats.firstRevActual):"—"}
          sub={stats.firstRevGoal>0?`objetivo: ${fmtEur(stats.firstRevGoal)}`:undefined}
          subColor={stats.firstRevActual>0&&stats.firstRevGoal>0?(stats.firstRevActual>=stats.firstRevGoal?C.green:C.red):C.muted} />
      </div>
    </div>
  );
}

// ── Helper: is new structure (June 2026+) ─────────────────────────────────────
const isNewStructure = (year, month) => year > 2026 || (year === 2026 && month >= 5); // month is 0-indexed, 5 = June

// ── Registo Tab ────────────────────────────────────────────────────────────────
function RegistoTab({ year, month, totalDays, closedDay, monthData, setMonthData }) {
  const [subTab, setSubTab] = useState("faturacao");
  const newStruct = isNewStructure(year, month);

  const SUB_TABS = [
    { id:"faturacao",  label:"Faturação diária" },
    { id:"afiliacao",  label:"Afiliação" },
    { id:"encomendas", label:"Encomendas" },
    { id:"parceiros",  label:"Parceiros / Leads" },
    { id:"margem",     label:"Margem" },
    { id:"objetivos",  label:"Objetivos" },
  ];

  const save = async (newData) => {
    const key = monthKey(year, month);
    await supabase.from("billing_months").upsert({ month_key: key, ...newData }, { onConflict:"month_key" });
    setMonthData(prev => ({ ...prev, ...newData }));
  };

  const updateEntry = (day, field, val) => {
    const entries = { ...(monthData.entries || {}) };
    entries[day] = { ...(entries[day] || {}), [field]: val === "" ? undefined : Number(val) };
    setMonthData(prev => ({ ...prev, entries }));
  };

  const toggleSS = async (day) => {
    const entries = { ...(monthData.entries || {}) };
    entries[day] = { ...(entries[day] || {}), supersales: !entries[day]?.supersales };
    const updated = { ...monthData, entries };
    setMonthData(updated);
    await save({ entries: updated.entries, team_goals: updated.team_goals });
  };

  const saveAll = () => save({ entries: monthData.entries, team_goals: monthData.team_goals });

  const entries   = monthData.entries    || {};
  const goals     = monthData.team_goals || {};

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
      {/* Sub-tabs */}
      <div style={{ display:"flex", gap:0, borderBottom:`0.5px solid ${C.border}`, overflowX:"auto" }}>
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            style={{ padding:"8px 16px", border:"none", borderBottom:subTab===t.id?`2px solid ${C.green}`:"2px solid transparent",
              background:"transparent", color:subTab===t.id?C.green:C.muted, fontWeight:subTab===t.id?500:400, fontSize:13, cursor:"pointer", whiteSpace:"nowrap" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Faturação diária ── */}
      {subTab === "faturacao" && (
        <div style={T.card}>
          <p style={T.sectionTitle}>Faturação diária — {MONTH_NAMES[month]} {year}</p>
          {!newStruct && (
            <div style={{ padding:"10px 14px", background:"#FEF3C7", borderRadius:8, marginBottom:12, fontSize:13, color:"#92400E" }}>
              ⚠ Meses anteriores a Junho 2026 usam a estrutura antiga (FR + CH-BNL-DEAT)
            </div>
          )}
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ borderBottom:`0.5px solid ${C.border}` }}>
                  {["Dia", "França", ...(newStruct?["Suíça","Benelux","DE-AT"]:["CH-BNL-DEAT"]), "Supersales"].map((h,i) => (
                    <th key={h} style={{ padding:"8px 10px", textAlign:i===0?"left":"center", color:C.muted, fontWeight:500, fontSize:11, textTransform:"uppercase", letterSpacing:".05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({length:totalDays}, (_,i) => i+1).map(day => {
                  const e = entries[day] || {};
                  const isSS = !!e.supersales;
                  return (
                    <tr key={day} style={{ borderBottom:`0.5px solid ${C.card}`, background:isSS?"#FAEEDA":"transparent" }}>
                      <td style={{ padding:"6px 10px", fontWeight:500, color:C.text }}>{day}</td>
                      {(newStruct ? ["FR","CH","BNL","DEAT"] : ["FR","CH-BNL-DEAT"]).map(field => (
                        <td key={field} style={{ padding:"4px 6px", textAlign:"center" }}>
                          <input type="number" value={e[field] ?? ""} onChange={ev => updateEntry(day, field, ev.target.value)} onBlur={saveAll}
                            placeholder="0"
                            style={{ width:80, textAlign:"right", padding:"5px 8px", border:`0.5px solid ${C.border}`, borderRadius:6, fontSize:13, background:C.bg, color:C.text, outline:"none" }} />
                        </td>
                      ))}
                      <td style={{ padding:"4px 6px", textAlign:"center" }}>
                        <button onClick={() => toggleSS(day)}
                          style={{ padding:"4px 10px", border:`0.5px solid ${isSS?"#d97706":C.border}`, borderRadius:6, background:isSS?"#FEF3C7":"transparent", color:isSS?"#92400E":C.muted, fontSize:12, cursor:"pointer" }}>
                          {isSS ? "⚡ SS" : "—"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Afiliação ── */}
      {subTab === "afiliacao" && (() => {
        const AFL_MKTS_OLD = [{key:"FR",label:"França"},{key:"CH-BNL-DEAT",label:"CH-BNL-DEAT"}];
        const AFL_MKTS_NEW = [{key:"FR",label:"França"},{key:"CH",label:"Suíça"},{key:"BNL",label:"Benelux"},{key:"DEAT",label:"Alemanha e Áustria"}];
        const mktList = newStruct ? AFL_MKTS_NEW : AFL_MKTS_OLD;
        const inpAfil = (field, placeholder="0") => (
          <input type="number" value={goals[field]??""} onChange={e=>setMonthData(prev=>({...prev,team_goals:{...prev.team_goals,[field]:e.target.value}}))} onBlur={saveAll}
            placeholder={placeholder} style={{width:"100%",boxSizing:"border-box",padding:"9px 12px",border:`0.5px solid ${C.border}`,borderRadius:8,fontSize:14,background:C.bg,color:C.text,outline:"none"}} />
        );
        return (
          <div style={{display:"flex",flexDirection:"column",gap:"1rem"}}>
            {mktList.map(mkt=>(
              <div key={mkt.key} style={T.card}>
                <p style={T.sectionTitle}>{mkt.label}</p>
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:16}}>
                  <div>
                    <p style={{fontSize:12,color:C.muted,margin:"0 0 6px"}}>Afiliação {year} (€)</p>
                    {inpAfil(`afil_${mkt.key}`)}
                  </div>
                  <div>
                    <p style={{fontSize:12,color:C.muted,margin:"0 0 6px"}}>Afiliação {year-1} (€)</p>
                    {inpAfil(`afil_prev_${mkt.key}`)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── Encomendas ── */}
      {subTab === "encomendas" && (() => {
        const ENC_MARKETS_OLD = [{key:"FR",label:"França"},{key:"CH-BNL-DEAT",label:"CH-BNL-DEAT"}];
        const ENC_MARKETS_NEW = [{key:"FR",label:"França"},{key:"CH",label:"Suíça"},{key:"BNL",label:"Benelux"},{key:"DEAT",label:"Alemanha e Áustria"}];
        const mktList = newStruct ? ENC_MARKETS_NEW : ENC_MARKETS_OLD;
        const ENC_FIELDS = [
          {field:"orders_total",    label:`Total enc. ${year}`},
          {field:"orders_first",    label:`1ªs enc. ${year}`},
          {field:"orders_first_rev",label:`Fat. 1ªs enc. ${year} (€)`},
          {field:"orders_total_prev",    label:`Total enc. ${year-1}`},
          {field:"orders_first_prev",    label:`1ªs enc. ${year-1}`},
          {field:"orders_first_rev_prev",label:`Fat. 1ªs enc. ${year-1} (€)`},
        ];
        return (
          <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
            {mktList.map(mkt => (
              <div key={mkt.key} style={T.card}>
                <p style={T.sectionTitle}>{mkt.label}</p>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3, minmax(0,1fr))", gap:12 }}>
                  {ENC_FIELDS.map(({field,label}) => {
                    const fkey = `${field}_${mkt.key}`;
                    return (
                      <div key={fkey}>
                        <p style={{ fontSize:12, color:C.muted, margin:"0 0 6px" }}>{label}</p>
                        <input type="number" value={goals[fkey] ?? ""}
                          onChange={e => setMonthData(prev => ({ ...prev, team_goals:{ ...prev.team_goals, [fkey]:e.target.value } }))} onBlur={saveAll}
                          placeholder="0"
                          style={{ width:"100%", boxSizing:"border-box", padding:"9px 12px", border:`0.5px solid ${C.border}`, borderRadius:8, fontSize:14, background:C.bg, color:C.text, outline:"none" }} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── Parceiros / Leads ── */}
      {subTab === "parceiros" && (() => {
        const MKT_OLD = [{key:"FR",label:"França",color:"#9333ea"},{key:"CH-BNL-DEAT",label:"CH-BNL-DEAT",color:"#d97706"}];
        const MKT_NEW = [{key:"FR",label:"França",color:"#9333ea"},{key:"CH",label:"Suíça",color:"#d97706"},{key:"BNL",label:"Benelux",color:"#0891b2"},{key:"DEAT",label:"DE-AT",color:"#16a34a"}];
        const mktList = newStruct ? MKT_NEW : MKT_OLD;
        const PROGS = ["Professionals","Elite","ProGym","ProBox","ProTeams","Performance","Horeca","Corporate"];
        const PROGS_S = ["Prof.","Elite","ProGym","ProBox","ProTeams","Perf.","Horeca","Corp."];

        const getVal = (day, mkt, field) => {
          const k = `${field}_d${day}_${mkt}`;
          return goals[k] ?? "";
        };
        const setVal = (day, mkt, field, val) => {
          const k = `${field}_d${day}_${mkt}`;
          setMonthData(prev => ({ ...prev, team_goals: { ...prev.team_goals, [k]: val === "" ? undefined : Number(val) } }));
        };
        const getTotal = (day, mkt) => PROGS.reduce((s,p) => s + (Number(goals[`prog_${p.toLowerCase()}_d${day}_${mkt}`])||0), 0);

        const thStyle = { padding:"7px 5px", fontSize:10, fontWeight:500, color:C.muted, textTransform:"uppercase", letterSpacing:".04em", borderBottom:`0.5px solid ${C.border}`, textAlign:"center", whiteSpace:"nowrap" };
        const tdStyle = { padding:"5px 4px", textAlign:"center", borderBottom:`0.5px solid ${C.card}`, verticalAlign:"middle" };
        const inpStyle = { padding:"4px 3px", border:`0.5px solid ${C.border}`, borderRadius:5, fontSize:12, background:C.bg, color:C.text, width:34, textAlign:"center" };

        return (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign:"left", width:36 }}>Dia</th>
                  <th style={{ ...thStyle, textAlign:"left", width:90 }}>Mercado</th>
                  {PROGS_S.map((p,i) => <th key={i} style={thStyle}>{p}</th>)}
                  <th style={{ ...thStyle, width:48 }}>Leads</th>
                  <th style={{ ...thStyle, color:C.green }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({length:totalDays},(_,i)=>i+1).map(day => (
                  mktList.map((mkt, mi) => {
                    const total = getTotal(day, mkt.key);
                    const isFirst = mi === 0;
                    return (
                      <tr key={`${day}-${mkt.key}`}>
                        {isFirst && (
                          <td rowSpan={mktList.length} style={{ ...tdStyle, borderRight:`0.5px solid ${C.border}`, fontWeight:500, fontSize:14, textAlign:"center", verticalAlign:"middle", borderBottom:`0.5px solid ${C.border}` }}>{day}</td>
                        )}
                        <td style={{ ...tdStyle, textAlign:"left", fontWeight:500, fontSize:11, color:mkt.color, borderBottom: mi===mktList.length-1?`0.5px solid ${C.border}`:tdStyle.borderBottom }}>{mkt.label}</td>
                        {PROGS.map(prog => {
                          const fkey = `prog_${prog.toLowerCase()}_d${day}_${mkt.key}`;
                          return (
                            <td key={prog} style={{ ...tdStyle, borderBottom: mi===mktList.length-1?`0.5px solid ${C.border}`:tdStyle.borderBottom }}>
                              <input type="number" min="0" value={goals[fkey]??""} placeholder="—"
                                onChange={e => setMonthData(prev => ({ ...prev, team_goals:{ ...prev.team_goals, [fkey]: e.target.value===""?undefined:Number(e.target.value) } }))}
                                onBlur={saveAll}
                                style={inpStyle} />
                            </td>
                          );
                        })}
                        <td style={{ ...tdStyle, borderBottom: mi===mktList.length-1?`0.5px solid ${C.border}`:tdStyle.borderBottom }}>
                          <input type="number" min="0" value={goals[`leads_d${day}_${mkt.key}`]??""} placeholder="—"
                            onChange={e => setMonthData(prev => ({ ...prev, team_goals:{ ...prev.team_goals, [`leads_d${day}_${mkt.key}`]: e.target.value===""?undefined:Number(e.target.value) } }))}
                            onBlur={saveAll}
                            style={{ ...inpStyle, width:40 }} />
                        </td>
                        <td style={{ ...tdStyle, fontWeight:500, color:total>0?C.green:C.muted, fontSize:13, borderBottom: mi===mktList.length-1?`0.5px solid ${C.border}`:tdStyle.borderBottom }}>{total}</td>
                      </tr>
                    );
                  })
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* ── Margem ── */}
      {subTab === "margem" && (() => {
        const MRG_MARKETS_OLD = [{key:"FR",label:"França"},{key:"CH-BNL-DEAT",label:"CH-BNL-DEAT"}];
        const MRG_MARKETS_NEW = [{key:"FR",label:"França"},{key:"CH",label:"Suíça"},{key:"BNL",label:"Benelux"},{key:"DEAT",label:"Alemanha e Áustria"}];
        const mktList = newStruct ? MRG_MARKETS_NEW : MRG_MARKETS_OLD;
        return (
          <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
            {mktList.map(mkt => (
              <div key={mkt.key} style={T.card}>
                <p style={T.sectionTitle}>{mkt.label}</p>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(2, minmax(0, 280px))", gap:16 }}>
                  {[{f:`margin_pct_${mkt.key}`,l:"Margem do mês (%)"},{f:`margin_pct_prev_${mkt.key}`,l:"Margem mesmo mês ano anterior (%)"}].map(({f,l}) => (
                    <div key={f}>
                      <p style={{ fontSize:12, color:C.muted, margin:"0 0 6px" }}>{l}</p>
                      <input type="number" step="0.01" value={goals[f] ?? ""}
                        onChange={e => setMonthData(prev => ({ ...prev, team_goals:{ ...prev.team_goals, [f]:e.target.value } }))} onBlur={saveAll}
                        placeholder="0.00"
                        style={{ width:"100%", boxSizing:"border-box", padding:"9px 12px", border:`0.5px solid ${C.border}`, borderRadius:8, fontSize:14, background:C.bg, color:C.text, outline:"none" }} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── Objetivos ── */}
      {subTab === "objetivos" && (
        <div style={T.card}>
          <p style={T.sectionTitle}>Objetivos — {MONTH_NAMES[month]} {year}</p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3, minmax(0,1fr))", gap:16 }}>
            {[
              {field:"equipa_fr",           label:"Objetivo de faturação (€)"},
              {field:"equipa_fr_partners",   label:"Objetivo de novos parceiros"},
              {field:"equipa_fr_first_rev",  label:"Objetivo fat. primeiras compras (€)"},
            ].map(({field,label}) => (
              <div key={field}>
                <p style={{ fontSize:12, color:C.muted, margin:"0 0 6px" }}>{label}</p>
                <input type="number" value={goals[field] ?? ""}
                  onChange={e => setMonthData(prev => ({ ...prev, team_goals:{ ...prev.team_goals, [field]:e.target.value } }))} onBlur={saveAll}
                  placeholder="0"
                  style={{ width:"100%", boxSizing:"border-box", padding:"9px 12px", border:`0.5px solid ${C.border}`, borderRadius:8, fontSize:14, background:C.bg, color:C.text, outline:"none" }} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MainApp() {
  const [tab, setTab] = useState("analise");
  const [selMonth, setSelMonth] = useState(`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}`);
  const [monthData, setMonthData] = useState({ entries:{}, team_goals:{} });
  const [loading, setLoading] = useState(true);
  const [year, mIdx] = selMonth.split("-").map(Number);
  const month = mIdx-1;
  const totalDays = daysInMonth(year, month);
  const isCurrentMonth = year===today.getFullYear()&&month===today.getMonth();
  const isPast = new Date(year,month+1,0)<new Date(today.getFullYear(),today.getMonth(),1);
  const closedDay = isPast?totalDays:isCurrentMonth?Math.max(0,today.getDate()-1):0;
  useEffect(()=>{ setLoading(true); loadMonthData(year,month).then(d=>{ setMonthData(d); setLoading(false); }); },[year,month]);
  const monthOptions = Array.from({length:12},(_,i)=>{ const d=new Date(today.getFullYear(),today.getMonth()-i,1); return { value:monthKey(d.getFullYear(),d.getMonth()), label:`${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` }; });
  return (
    <div style={{ minHeight:"100vh", background:C.bg }}>
      <div style={{ maxWidth:920, margin:"0 auto", padding:"1.25rem 1rem" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1.5rem" }}>
          <div>
            <p style={{ fontSize:20, fontWeight:500, margin:0, color:C.text }}>Faturação da Equipa</p>
            <p style={{ fontSize:13, color:C.muted, margin:"3px 0 0" }}>Equipa FR · França + CH-BNL-DEAT</p>
          </div>
          <select value={selMonth} onChange={e=>setSelMonth(e.target.value)}
            style={{ fontSize:13, padding:"7px 12px", borderRadius:8, border:`0.5px solid ${C.border}`, background:C.bg, color:C.text, outline:"none" }}>
            {monthOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div style={{ display:"flex", borderBottom:`0.5px solid ${C.border}`, marginBottom:"1.5rem" }}>
          {[{id:"analise",l:"Análise"},{id:"registo",l:"Registo"},{id:"parceiros",l:"Parceiros"}].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{ padding:"9px 20px", border:"none", borderBottom:tab===t.id?`2px solid ${C.green}`:"2px solid transparent",
                background:"transparent", color:tab===t.id?C.green:C.muted, fontWeight:tab===t.id?500:400, fontSize:14, cursor:"pointer" }}>
              {t.l}
            </button>
          ))}
        </div>
        {loading?(
          <div style={{ textAlign:"center", padding:"4rem 0", color:C.muted, fontSize:14 }}>A carregar…</div>
        ):tab==="analise"?(
          <AnaliseTab year={year} month={month} totalDays={totalDays} closedDay={closedDay} entries={monthData.entries||{}} teamGoals={monthData.team_goals||{}} />
        ):(
          <div style={{ textAlign:"center", padding:"4rem 0", color:C.muted, fontSize:14 }}>
            {tab==="registo" ? <RegistoTab year={year} month={month} totalDays={totalDays} closedDay={closedDay} monthData={monthData} setMonthData={setMonthData} /> : "Separador Parceiros — em breve"}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [unlocked, setUnlocked] = useState(()=>{ try { return localStorage.getItem(GATE_KEY)==="1"; } catch { return false; } });
  if (!unlocked) return <PasswordGate onUnlock={()=>setUnlocked(true)} />;
  return <MainApp />;
}
