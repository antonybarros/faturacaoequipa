import React, { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { LineChart, Line, BarChart, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

// ── Helper: is new structure (June 2026+) ─────────────────────────────────────
const isNewStructure = (year, month) => year > 2026 || (year === 2026 && month >= 5);

const TEAMS = [
  { key:"equipa_fr", label:"Equipa FR", markets:["FR","CH","BNL","DEAT","CH-BNL-DEAT"], gestors:["Antony","Fabien","Mónica"] },
  { key:"equipa_it", label:"Equipa IT", markets:["IT"], gestors:["Kamila Barros","Catarina Monteiro","Bruno Vieira","Vanessa Ferreirinha"] },
  { key:"equipa_es", label:"Equipa ES", markets:["ES"], gestors:["Guilherme Mendes","Jose Castillo","Mariana Lopes"] },
  { key:"equipa_pt", label:"Equipa PT", markets:["PT","IE","WW","SE","GB","EU","RO","DK","FI","CA","OTHER"], gestors:["Ines Anjo","Daniel Silva","Abilio Morais","Margarida Pinheiro"] },
  { key:"equipa_na", label:"Equipa NA", markets:["NA","CZ","SK","GR","CY","PL"], dashboardMarkets:["NA","CZ"], gestors:["Pedro Oliveira","Telma Barroso","Beatriz Beato"] },
];

// Returns the markets that count for dashboard/objectives (may differ from all markets)
function getDashboardMarkets(team) {
  const t = TEAMS.find(t=>t.key===team);
  return t?.dashboardMarkets || t?.markets || [];
}

// Returns market list for a given team and structure
function getTeamMarkets(team, newStruct) {
  if (team === "equipa_it") return [{key:"IT", label:"Itália"}];
  if (team === "equipa_es") return [{key:"ES", label:"Espanha"}];
  if (team === "equipa_pt") return [{key:"PT",label:"Portugal"},{key:"OTHER",label:"Outros"}];
  if (team === "equipa_na") return [{key:"NA",label:"USA"},{key:"CZ",label:"República Checa"}];
  // equipa_fr
  if (newStruct) return [{key:"FR",label:"França"},{key:"CH",label:"Suíça"},{key:"BNL",label:"Benelux"},{key:"DEAT",label:"DE-AT"}];
  return [{key:"FR",label:"França"},{key:"CH-BNL-DEAT",label:"CH-BNL-DEAT"}];
}
const MARKETS = [{ id: "FR", label: "França" }, { id: "CH-BNL-DEAT", label: "CH-BNL-DEAT" }];
const MARKET_COLORS = { FR: "#9333ea", "CH-BNL-DEAT": "#d97706" };
const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const PASSWORDS = {
  admin: import.meta.env.VITE_PASSWORD_ADMIN || "partnersfranca",
  fabien: import.meta.env.VITE_PASSWORD_FABIEN || "partnersfabien",
  monica: import.meta.env.VITE_PASSWORD_MONICA || "partnersmonica",
  pedro: import.meta.env.VITE_PASSWORD_PEDRO || "partnersna",
};
const ROLES = {
  admin:  { name:"Antony",         gestor:"Antony",         isAdmin:true,  canEditRegisto:true,  registoTeam:null,        followupTeam:null },
  fabien: { name:"Fabien",         gestor:"Fabien",         isAdmin:false, canEditRegisto:false, registoTeam:null,        followupTeam:"equipa_fr" },
  monica: { name:"Mónica",         gestor:"Mónica",         isAdmin:false, canEditRegisto:false, registoTeam:null,        followupTeam:"equipa_fr" },
  pedro:  { name:"Pedro Oliveira", gestor:"Pedro Oliveira", isAdmin:false, canEditRegisto:true,  registoTeam:"equipa_na", followupTeam:"equipa_na" },
};
const GATE_KEY = "faturacao_gate_v3";
const ROLE_KEY = "faturacao_role_v3";
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


const MKT_LABELS = {
  "FR":"França","CH":"Suíça","BNL":"Benelux","DEAT":"Alemanha e Áustria","CH-BNL-DEAT":"CH-BNL-DEAT",
  "IT":"Itália","ES":"Espanha","PT":"Portugal","OTHER":"Outros",
  "IE":"Irlanda","WW":"Worldwide","SE":"Suécia","GB":"Reino Unido","EU":"EU",
  "RO":"Roménia","DK":"Dinamarca","FI":"Finlândia","CA":"Canadá",
  "NA":"USA","CZ":"República Checa","SK":"Eslováquia","GR":"Grécia","CY":"Chipre","PL":"Polónia",
};


function PasswordGate({ onUnlock }) {
  const [pw, setPw] = useState(""), [err, setErr] = useState("");
  const submit = (e) => {
    e.preventDefault();
    const role = Object.keys(PASSWORDS).find(r => PASSWORDS[r] === pw);
    if (role) {
      try { localStorage.setItem(GATE_KEY, "1"); localStorage.setItem(ROLE_KEY, role); } catch {}
      onUnlock(role);
    } else { setErr("Password incorrecta"); setPw(""); }
  };
  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.bg }}>
      <div style={{ background:C.bg, border:`0.5px solid ${C.border}`, borderRadius:16, padding:"2.5rem 2rem", width:320, textAlign:"center" }}>
        <div style={{ width:48, height:48, borderRadius:"50%", background:"#E1F5EE", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 1rem" }}>
          <svg width="20" height="20" fill="none" stroke={C.green} strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <p style={{ fontWeight:500, fontSize:18, margin:"0 0 4px", color:C.text }}>Resultados</p>
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

async function loadMonthData(year, month, team="equipa_fr") {
  const { data } = await supabase.from("billing_months").select("entries,team_goals").eq("month_key", monthKey(year, month)).eq("team", team).maybeSingle();
  return data || { entries:{}, team_goals:{} };
}

// Returns total value from an entry object for a given team
function getEntryTotal(e, team) {
  if (!e) return 0;
  if (team === "equipa_it") return Number(e.IT)||0;
  if (team === "equipa_es") return Number(e.ES)||0;
  if (team === "equipa_pt") return (Number(e.PT)||0)+(Number(e.OTHER)||0);
  if (team === "equipa_na") return (Number(e.NA)||0)+(Number(e.CZ)||0);
  // equipa_fr — use all FR markets
  return (Number(e.FR)||0)+(Number(e["CH-BNL-DEAT"])||0)+(Number(e.CH)||0)+(Number(e.BNL)||0)+(Number(e.DEAT)||0);
}

async function loadHistoricalSSAvg(year, month, team="equipa_fr") {
  // Load previous months, find months that had a SS day, sum their SS day values, divide by count
  const keys = [];
  for (let i = 1; i <= 12; i++) {
    const d = new Date(year, month - i, 1);
    keys.push(monthKey(d.getFullYear(), d.getMonth()));
  }
  const { data } = await supabase.from("billing_months").select("entries").in("month_key", keys).eq("team", team);
  if (!data || data.length === 0) return 0;
  let totalSSValue = 0, monthsWithSS = 0;
  for (const row of data) {
    const entries = row.entries || {};
    const days = Object.keys(entries).map(Number).sort((a,b)=>a-b);
    // Build cumul per day first
    const cumuls = {};
    let prev = 0;
    for (const d of days) {
      const e = entries[d];
      const val = getEntryTotal(e, team);
      cumuls[d] = val > prev ? val : prev;
      prev = cumuls[d];
    }
    // Find SS day and compute its day value = cumul[ssDay] - cumul[ssDay-1]
    for (const d of days) {
      const e = entries[d];
      if (!e.supersales) continue;
      const prevDay = days.filter(x => x < d).slice(-1)[0];
      const prevCumul = prevDay != null ? cumuls[prevDay] : 0;
      const ssValue = cumuls[d] - prevCumul;
      if (ssValue > 0) { totalSSValue += ssValue; monthsWithSS++; }
      break; // only 1 SS day per month
    }
  }
  return monthsWithSS > 0 ? Math.round(totalSSValue / monthsWithSS) : 0;
}

async function loadHistoricalDowAvg(year, month, team="equipa_fr") {
  // Load last 3 months and compute average day value per day of week
  const keys = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(year, month - i, 1);
    keys.push(monthKey(d.getFullYear(), d.getMonth()));
  }
  const { data } = await supabase.from("billing_months").select("entries,month_key").in("month_key", keys).eq("team", team);
  if (!data || data.length === 0) return {};
  const dowSum = {}, dowCnt = {};
  for (const row of data) {
    const [y, m] = row.month_key.split("-").map(Number);
    const mIdx = m - 1;
    const entries = row.entries || {};
    const isNew = isNewStructure(y, mIdx);
    let prev = 0;
    const days = Object.keys(entries).map(Number).sort((a,b)=>a-b);
    for (const d of days) {
      const e = entries[d];
      const cumul = getEntryTotal(e, team);
      const dayVal = cumul > prev ? cumul - prev : 0;
      // Only include normal days (exclude SS and campaigns from averages)
      if (dayVal > 0 && !e.supersales && !e.campanha) {
        const dow = new Date(y, mIdx, d).getDay();
        dowSum[dow] = (dowSum[dow]||0) + dayVal;
        dowCnt[dow] = (dowCnt[dow]||0) + 1;
      }
      prev = cumul;
    }
  }
  const result = {};
  Object.keys(dowSum).forEach(k => { result[k] = Math.round(dowSum[k]/dowCnt[k]); });
  return result;
}

async function loadPartnersCount(year, month, team="equipa_fr") {
  const start = new Date(year, month, 1).toISOString();
  const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
  const teamObj = TEAMS.find(t=>t.key===team);
  const markets = teamObj?.dashboardMarkets || teamObj?.markets || ["FR","CH","BNL","DEAT","CH-BNL-DEAT"];
  const { count } = await supabase.from("partner_followup")
    .select("*", { count:"exact", head:true })
    .gte("original_created_at", start)
    .lte("original_created_at", end)
    .neq("status", "deleted")
    .in("market", markets);
  return count || 0;
}

async function loadPartnersByMktProg(year, month, team="equipa_fr") {
  const pad = n => String(n).padStart(2,"0");
  const lastDay = new Date(year,month+1,0).getDate();
  const start = `${year}-${pad(month+1)}-01T00:00:00.000Z`;
  const end = `${year}-${pad(month+1)}-${pad(lastDay)}T23:59:59.999Z`;
  const teamObj = TEAMS.find(t=>t.key===team);
  const markets = teamObj ? teamObj.markets : ["FR","CH","BNL","DEAT","CH-BNL-DEAT"];
  const { data } = await supabase.from("partner_followup")
    .select("market,programme,gestor")
    .gte("original_created_at", start)
    .lte("original_created_at", end)
    .neq("status", "deleted")
    .in("market", markets)
    .limit(5000);
  return data || [];
}

function buildDaily(entries, totalDays, year, month, team="equipa_fr") {
  const daily = []; let prevCumul=0;
  const newStruct = (year!=null&&month!=null) ? isNewStructure(year,month) : false;
  // For non-FR teams, use getEntryTotal directly
  const isFR = !team || team === "equipa_fr";
  let lastFR=0, lastCH=0, lastBNL=0, lastDEAT=0;
  for (let d=1; d<=totalDays; d++) {
    const e = entries[d] || {};
    let cumul;
    if (isFR) {
      if (newStruct) {
        if (e.FR !== undefined) lastFR = Number(e.FR)||0;
        if (e.CH !== undefined) lastCH = Number(e.CH)||0;
        if (e.BNL !== undefined) lastBNL = Number(e.BNL)||0;
        if (e.DEAT !== undefined) lastDEAT = Number(e.DEAT)||0;
      } else {
        if (e.FR !== undefined) lastFR = Number(e.FR)||0;
        if (e["CH-BNL-DEAT"] !== undefined) lastCH = Number(e["CH-BNL-DEAT"])||0;
      }
      cumul = newStruct ? lastFR+lastCH+lastBNL+lastDEAT : lastFR+lastCH;
    } else {
      const val = getEntryTotal(e, team);
      cumul = val > 0 ? val : prevCumul;
    }
    const dow = (year!=null&&month!=null) ? new Date(year, month, d).getDay() : null;
    daily.push({ day:d, cumul, dayValue:cumul>prevCumul?cumul-prevCumul:0, supersales:e.supersales===true, campanha:e.campanha===true, dow });
    prevCumul = cumul;
  }
  return daily;
}

function buildDailyFirstRev(entries, totalDays, newStruct, team="equipa_fr") {
  let fields;
  if (team === "equipa_it") fields = ["first_rev_IT"];
  else if (team === "equipa_es") fields = ["first_rev_ES"];
  else if (team === "equipa_pt") fields = ["first_rev_PT","first_rev_OTHER"];
  else if (team === "equipa_na") fields = ["first_rev_NA","first_rev_CZ"];
  else fields = newStruct ? ["first_rev_FR","first_rev_CH","first_rev_BNL","first_rev_DEAT"] : ["first_rev_FR","first_rev_CH-BNL-DEAT"];
  const daily = []; let prevCumul = 0;
  const lastVals = {};
  for (let d = 1; d <= totalDays; d++) {
    const e = entries[d] || {};
    fields.forEach(f => { if (e[f] !== undefined) lastVals[f] = Number(e[f])||0; });
    const cumul = fields.reduce((s,f) => s + (lastVals[f]||0), 0);
    daily.push({ day:d, cumul, dayValue: cumul > prevCumul ? cumul - prevCumul : 0, supersales: false });
    prevCumul = cumul;
  }
  return daily;
}

function computeStats(daily, teamGoals, totalDays, closedDay, historicalSSAvg=0, historicalDowAvg={}) {
  const teamKey = typeof currentTeam !== 'undefined' ? currentTeam : "equipa_fr";
  const goal = Number(teamGoals?.[teamKey])||Number(teamGoals?.equipa_fr)||0;
  const partnerGoal = Number(teamGoals?.[teamKey+"_partners"])||Number(teamGoals?.equipa_fr_partners)||0;
  const closed = daily.filter(d=>d.day<=closedDay);
  const actual = closed.length>0 ? closed[closed.length-1].cumul : 0;
  const expected = goal>0&&closedDay>0 ? Math.round(goal/totalDays*closedDay) : null;
  const vsExpected = expected!=null ? actual-expected : null;
  const vsExpPct = expected>0 ? (actual/expected*100) : null;
  const normal = closed.filter(d=>!d.supersales&&!d.campanha&&d.dayValue>0);
  const ss = closed.filter(d=>d.supersales&&d.dayValue>0);
  const avgNormal = normal.length>0 ? Math.round(normal.reduce((s,d)=>s+d.dayValue,0)/normal.length) : 0;
  const avgSS = ss.length>0 ? Math.round(ss.reduce((s,d)=>s+d.dayValue,0)/ss.length) : 0;
  const rem = totalDays-closedDay;

  // Day-of-week averages (0=Sun, 1=Mon, ... 6=Sat)
  // We need to know the year/month to get the day of week for each day
  // We pass year/month via the daily array's context — compute from totalDays anchor
  // Use a reference: day 1 of the month. We derive weekday from totalDays count (passed externally).
  // Instead, compute dow-based avg using closed days
  const dowAvg = {};
  const dowCount = {};
  closed.filter(d=>!d.supersales&&!d.campanha&&d.dayValue>0).forEach(d=>{
    // d.dow is set by buildDaily if available, otherwise skip
    if (d.dow==null) return;
    dowAvg[d.dow] = (dowAvg[d.dow]||0) + d.dayValue;
    dowCount[d.dow] = (dowCount[d.dow]||0) + 1;
  });
  const avgByDow = {};
  Object.keys(dowAvg).forEach(k=>{ avgByDow[k] = Math.round(dowAvg[k]/dowCount[k]); });
  // Use historical dow averages as fallback when current month has insufficient data
  const effectiveDowAvg = Object.keys(historicalDowAvg).length > 0 ? historicalDowAvg : avgByDow;
  const hasDowData = Object.keys(effectiveDowAvg).length >= 7;

  // Project remaining days using dow avg (fallback to avgNormal if dow not available)
  const remDayValues = hasDowData ? daily.filter(d=>d.day>closedDay&&!d.supersales).map(d=>effectiveDowAvg[d.dow]||avgNormal) : [];
  const projNoSS = hasDowData && remDayValues.length>0
    ? actual + remDayValues.reduce((s,v)=>s+v, 0)
    : avgNormal>0 ? actual+avgNormal*rem : null;

  // SS projection
  const ssHappened = ss.length > 0;
  const effectiveSSAvg = ssHappened ? avgSS : historicalSSAvg;
  let projWithSS;
  if (ssHappened) {
    projWithSS = projNoSS;
  } else if (effectiveSSAvg > 0 && projNoSS!=null && rem >= 1) {
    // Replace the weakest remaining day with SS day
    const weakestIdx = remDayValues.length>0 ? remDayValues.indexOf(Math.min(...remDayValues)) : -1;
    const adjRemTotal = weakestIdx>=0
      ? remDayValues.reduce((s,v,i)=>s+(i===weakestIdx?effectiveSSAvg:v),0)
      : remDayValues.reduce((s,v)=>s+v,0) - (avgNormal*(rem-1)) + effectiveSSAvg;
    projWithSS = actual + adjRemTotal;
  } else {
    projWithSS = null;
  }
  const dailyAvg = closedDay>0 ? Math.round(actual/closedDay) : 0;
  const neededPerDay = goal>0&&rem>0 ? Math.round((goal-actual)/rem) : null;
  const remaining = goal>0 ? goal-actual : null;
  const firstRevGoal = Number(teamGoals?.equipa_fr_first_rev)||0;
  return { goal, partnerGoal, actual, expected, vsExpected, vsExpPct, dailyAvg, neededPerDay, projNoSS, projWithSS, avgNormal, avgSS, historicalSSAvg: effectiveSSAvg, ssHappened, remainingDays:rem, closedDay, remaining, firstRevGoal };
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
  const isFat = mode === "faturado";
  const isObj = mode === "objetivo";
  const title = isFat ? "Faturado diário — detalhe" : isObj ? "% do objetivo mensal — evolução diária" : "% vs. esperado — evolução diária";
  const headers = isFat
    ? [{v:"DIA"},{v:"ACUMULADO"},{v:"+NESSE DIA"}]
    : isObj
    ? [{v:"DIA"},{v:"ACUMULADO"},{v:"% DO OBJETIVO"}]
    : [{v:"DIA"},{v:"ACUMULADO"},{v:"ESPERADO"},{v:"% VS. ESPERADO"}];
  return (
    <Modal title={title} subtitle={`Equipa FR · ${closedDay} dias fechados`} onClose={onClose}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
        <thead style={{ position:"sticky", top:0, background:C.bg, zIndex:1 }}>
          <tr>{headers.map((h,i)=>(
            <th key={i} style={{ padding:"10px 1.25rem", textAlign:i===0?"left":"right", color:C.muted, fontWeight:500, fontSize:11, textTransform:"uppercase", letterSpacing:".06em", borderBottom:`0.5px solid ${C.border}` }}>{h.v}</th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.map(d=>{
            const rowStyle = { borderBottom:`0.5px solid ${C.card}`, background:d.supersales?"#FAEEDA":"transparent" };
            const dayCell = <td style={{ padding:"11px 1.25rem", fontWeight:500, color:C.text }}>{d.day}{d.supersales?" ⚡":""}</td>;
            const cumulCell = <td style={{ padding:"11px 1.25rem", textAlign:"right", fontWeight:500, color:C.text }}>{fmtEur(d.cumul)}</td>;
            if (isFat) {
              return (
                <tr key={d.day} style={rowStyle}>
                  {dayCell}{cumulCell}
                  <td style={{ padding:"11px 1.25rem", textAlign:"right", color:C.muted }}>+{fmtEur(d.dayValue)}</td>
                </tr>
              );
            } else if (isObj) {
              const pct = goal>0?(d.cumul/goal*100):null;
              return (
                <tr key={d.day} style={rowStyle}>
                  {dayCell}{cumulCell}
                  <td style={{ padding:"11px 1.25rem", textAlign:"right", fontWeight:500, color:pct==null?C.muted:pct>=100?C.green:pct>=80?C.amber:C.muted }}>{pct!=null?`${pct.toFixed(1)}%`:"—"}</td>
                </tr>
              );
            } else {
              const exp = goal>0?Math.round(goal/daily.length*d.day):null;
              const pct = exp>0?(d.cumul/exp*100):null;
              return (
                <tr key={d.day} style={rowStyle}>
                  {dayCell}{cumulCell}
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

function PartnersDetailModal({ year, month, closedDay, onClose, currentTeam="equipa_fr" }) {
  const [rows, setRows] = useState([]);
  useEffect(()=>{
    const start = new Date(year, month, 1).toISOString();
    const end = new Date(year, month+1, 0, 23, 59, 59).toISOString();
    const teamObj = TEAMS.find(t=>t.key===currentTeam);
    const markets = teamObj ? teamObj.markets : ["FR","CH","BNL","DEAT","CH-BNL-DEAT"];
    supabase.from("partner_followup").select("original_created_at").gte("original_created_at", start).lte("original_created_at", end).neq("status","deleted").in("market", markets).limit(5000)
      .then(({data})=>{
        if (!data) return;
        const byDay = {};
        data.forEach(r=>{
          const d = new Date(r.original_created_at).getDate();
          byDay[d] = (byDay[d]||0)+1;
        });
        const today = new Date();
        const isCurrentMonth = today.getFullYear()===year && today.getMonth()===month;
        const lastDay = isCurrentMonth ? today.getDate() : new Date(year, month+1, 0).getDate();
        let cumul = 0;
        const result = [];
        for (let d=1; d<=lastDay; d++) {
          const dayVal = byDay[d]||0;
          cumul += dayVal;
          result.push({ day:d, cumul, dayVal });
        }
        setRows(result);
      });
  }, [year, month]);

  return (
    <Modal title="Novos parceiros — detalhe" subtitle={`${TEAMS.find(t=>t.key===currentTeam)?.label||"Equipa FR"} · ${closedDay} dias fechados`} onClose={onClose}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
        <thead style={{ position:"sticky", top:0, background:C.bg, zIndex:1 }}>
          <tr>
            {["DIA","ACUMULADO","+NESSE DIA"].map((h,i)=>(
              <th key={i} style={{ padding:"10px 1.25rem", textAlign:i===0?"left":"right", color:C.muted, fontWeight:500, fontSize:11, textTransform:"uppercase", letterSpacing:".06em", borderBottom:`0.5px solid ${C.border}` }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(d=>(
            <tr key={d.day} style={{ borderBottom:`0.5px solid ${C.card}` }}>
              <td style={{ padding:"11px 1.25rem", fontWeight:500, color:C.text }}>{d.day}</td>
              <td style={{ padding:"11px 1.25rem", textAlign:"right", fontWeight:500, color:C.text }}>{d.cumul}</td>
              <td style={{ padding:"11px 1.25rem", textAlign:"right", color:C.muted }}>+{d.dayVal}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}

function AnaliseTab({ year, month, totalDays, closedDay, entries, teamGoals, partnersCount, currentTeam="equipa_fr" }) {
  const [modal, setModal] = useState(null);


  const newStruct = isNewStructure(year, month);
  const [historicalSSAvg, setHistoricalSSAvg] = useState(0);
  const [historicalDowAvg, setHistoricalDowAvg] = useState({});
  useEffect(()=>{ loadHistoricalSSAvg(year, month, currentTeam).then(setHistoricalSSAvg); }, [year, month, currentTeam]);
  useEffect(()=>{ loadHistoricalDowAvg(year, month, currentTeam).then(setHistoricalDowAvg); }, [year, month, currentTeam]);
  const daily = useMemo(()=>buildDaily(entries,totalDays,year,month,currentTeam),[entries,totalDays,year,month,currentTeam]);
  const stats = useMemo(()=>computeStats(daily,teamGoals,totalDays,closedDay,historicalSSAvg,historicalDowAvg),[daily,teamGoals,totalDays,closedDay,historicalSSAvg,historicalDowAvg]);
  const dailyFirstRev = useMemo(()=>buildDailyFirstRev(entries,totalDays,newStruct,currentTeam),[entries,totalDays,newStruct,currentTeam]);
  const firstRevActual = closedDay>0&&dailyFirstRev.length>0 ? (dailyFirstRev.filter(d=>d.day<=closedDay).slice(-1)[0]?.cumul||0) : 0;
  const firstRevGoal = stats.firstRevGoal;

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

  // Weekday averages from closed non-SS days — fallback to historical when insufficient data
  const wdTotals = Array.from({length:7},()=>({sum:0,count:0}));
  daily.filter(d=>d.day<=closedDay&&!d.supersales&&!d.campanha&&d.dayValue>0).forEach(d=>{
    const wd = new Date(year, month, d.day).getDay();
    wdTotals[wd].sum += d.dayValue;
    wdTotals[wd].count++;
  });
  const globalAvg = closedDay>0 ? Math.round(daily.filter(d=>d.day<=closedDay&&!d.supersales&&!d.campanha&&d.dayValue>0).reduce((s,d)=>s+d.dayValue,0)/Math.max(closedDay,1)) : 0;
  const wdAvgs = Array.from({length:7},(_,i)=>historicalDowAvg[String(i)]||historicalDowAvg[i]||globalAvg);

  // All days bar data (including future days with wdAvg only)
  const allDaysBar = daily.map(d=>{
    const wd = new Date(year, month, d.day).getDay();
    return { day:d.day, value:d.day<=closedDay?d.dayValue:0, ss:d.supersales, wdAvg:wdAvgs[wd]||globalAvg };
  });

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
      {modal==="parceiros" && <PartnersDetailModal year={year} month={month} closedDay={closedDay} onClose={()=>setModal(null)} currentTeam={currentTeam} />}
      {modal && modal!=="parceiros" && (modal==="firstrev_faturado"||modal==="firstrev_objetivo"
        ? <DailyDetailModal daily={dailyFirstRev} closedDay={closedDay} goal={firstRevGoal} mode={modal==="firstrev_faturado"?"faturado":"objetivo"} onClose={()=>setModal(null)} />
        : <DailyDetailModal daily={daily} closedDay={closedDay} goal={stats.goal} mode={modal} onClose={()=>setModal(null)} />
      )}

      {/* Row 1 — faturação */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4, minmax(0,1fr))", gap:10 }}>
        <StatCard label="Faturado" value={fmtEur(stats.actual)}
          sub={stats.remaining!=null?(stats.remaining<=0?"objetivo atingido!":`faltam ${fmtEur(stats.remaining)} para o objetivo`):undefined}
          subColor={stats.remaining!=null&&stats.remaining<=0?C.green:undefined}
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
          sub={stats.projWithSS==null?"sem dados SS históricos":stats.ssHappened?`SS já realizada (${fmtEur(stats.avgSS)})`:`estimativa SS: ${fmtEur(stats.historicalSSAvg)} (média histórica)`}
          subColor={stats.projWithSS==null?C.muted:stats.projWithSS>=stats.goal?C.green:C.red} small />
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
            <XAxis dataKey="day" tick={{ fontSize:10, fill:"#B4B2A9" }} axisLine={false} tickLine={false} interval={0} />
            <YAxis tickFormatter={v=>v>=1000?Math.round(v/1000)+"k":v} tick={{ fontSize:10, fill:"#B4B2A9" }} axisLine={false} tickLine={false} width={40} />
            <Tooltip formatter={(v,n)=>[fmtEur(v),n==="atual"?"Resultado":"Objetivo"]} labelFormatter={l=>`Dia ${l}`} contentStyle={{ borderRadius:8, border:`0.5px solid ${C.border}`, fontSize:12, background:C.bg }} />
            {closedDay>0&&closedDay<totalDays&&<ReferenceLine x={closedDay} stroke="#D3D1C7" strokeDasharray="3 3"
              label={(props)=>{
                const {viewBox} = props;
                if (!viewBox || stats.vsExpPct==null) return null;
                return (
                  <text x={viewBox.x+4} y={viewBox.y+12} fill="#888" fontSize={11} fontWeight={600}>
                    {`${stats.vsExpPct.toFixed(1)}%`}
                  </text>
                );
              }} />}
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
      {(() => {
        const pctFirstRev = firstRevGoal>0&&firstRevActual>0 ? (firstRevActual/firstRevGoal*100).toFixed(1) : null;
        return (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4, minmax(0,1fr))", gap:10 }}>
            <StatCard label="Novos parceiros" value={partnersCount!=null?fmt(partnersCount):"—"}
              sub={remainingPartners!=null?(remainingPartners>0?`faltam ${fmt(remainingPartners)} para o objetivo`:"objetivo atingido!"):undefined}
              subColor={remainingPartners!=null&&remainingPartners<=0?C.green:C.muted}
              onClick={partnersCount!=null?()=>setModal("parceiros"):undefined}
              highlight />
            <StatCard label="Objetivo de novos parceiros" value={stats.partnerGoal>0?fmt(stats.partnerGoal):"Sem objetivo"}
              sub={pctPartners!=null?`${pctPartners}% realizado em ${pctMonth}% do mês`:undefined}
              subColor={pctPartners!=null&&Number(pctPartners)<Number(pctMonth)?C.red:C.green} />
            <StatCard label="Faturação 1ªs compras"
              value={firstRevActual>0?fmtEur(firstRevActual):"—"}
              sub={firstRevGoal>0?(firstRevActual>=firstRevGoal?"objetivo atingido!":`faltam ${fmtEur(Math.max(0,firstRevGoal-firstRevActual))} para o objetivo`):undefined}
              subColor={firstRevGoal>0&&firstRevActual>=firstRevGoal?C.green:C.muted}
              onClick={firstRevActual>0?()=>setModal("firstrev_faturado"):undefined}
              highlight />
            <StatCard label="Objetivo faturação primeiras compras"
              value={firstRevGoal>0?fmtEur(firstRevGoal):"Sem objetivo"}
              sub={pctFirstRev!=null?`${pctFirstRev}% realizado em ${pctMonth}% do mês`:undefined}
              subColor={pctFirstRev!=null&&Number(pctFirstRev)<Number(pctMonth)?C.red:C.green}
              onClick={firstRevGoal>0?()=>setModal("firstrev_objetivo"):undefined} />
          </div>
        );
      })()}
    </div>
  );
}
// ── Registo Tab ────────────────────────────────────────────────────────────────
function RegistoTab({ year, month, totalDays, closedDay, monthData, setMonthData, currentTeam, setCurrentTeam }) {
  const [subTab, setSubTab] = useState("faturacao");
  const newStruct = isNewStructure(year, month);

  const SUB_TABS = [
    { id:"faturacao",   label:"Faturação diária" },
    { id:"primeiras",   label:"1ªs Compras" },
    { id:"afiliacao",   label:"Afiliação" },
    { id:"encomendas",  label:"Encomendas" },
    { id:"parceiros",   label:"Parceiros / Leads" },
    { id:"margem",      label:"Margem" },
    { id:"fat_programa", label:"Fat. Programa" },
    { id:"objetivos",   label:"Objetivos" },
  ];

  const save = async (newData) => {
    const key = monthKey(year, month);
    await supabase.from("billing_months").upsert({ month_key: key, team: currentTeam, ...newData }, { onConflict:"month_key,team" });
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

  const toggleCampanha = async (day) => {
    const entries = { ...(monthData.entries || {}) };
    entries[day] = { ...(entries[day] || {}), campanha: !entries[day]?.campanha };
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
                  {["Dia", ...getTeamMarkets(currentTeam,newStruct).map(m=>m.label), "Supersales", "Campanha"].map((h,i) => (
                    <th key={h} style={{ padding:"8px 10px", textAlign:i===0?"left":"center", color:C.muted, fontWeight:500, fontSize:11, textTransform:"uppercase", letterSpacing:".05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({length:totalDays}, (_,i) => i+1).map(day => {
                  const e = entries[day] || {};
                  const isSS = !!e.supersales;
                  const isCampanha = !!e.campanha;
                  return (
                    <tr key={day} style={{ borderBottom:`0.5px solid ${C.card}`, background:isSS?"#FAEEDA":isCampanha?"#EFF6FF":"transparent" }}>
                      <td style={{ padding:"6px 10px", fontWeight:500, color:C.text }}>{day}</td>
                      {getTeamMarkets(currentTeam,newStruct).map(m=>m.key).map(field => (
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
                      <td style={{ padding:"4px 6px", textAlign:"center" }}>
                        <button onClick={() => toggleCampanha(day)}
                          style={{ padding:"4px 10px", border:`0.5px solid ${isCampanha?"#2563EB":C.border}`, borderRadius:6, background:isCampanha?"#EFF6FF":"transparent", color:isCampanha?"#1D4ED8":C.muted, fontSize:12, cursor:"pointer" }}>
                          {isCampanha ? "🏷️ Camp." : "—"}
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

      {/* ── Mercados mensais Equipa NA ── */}
      {subTab === "faturacao" && currentTeam === "equipa_na" && (() => {
        const naMonthlyMkts = [{key:"SK",label:"Eslováquia"},{key:"GR",label:"Grécia"},{key:"CY",label:"Chipre"},{key:"PL",label:"Polónia"}];
        return (
          <div style={T.card}>
            <p style={{...T.sectionTitle,marginBottom:4}}>FATURAÇÃO MENSAL — MERCADOS SECUNDÁRIOS</p>
            <p style={{fontSize:12,color:C.muted,margin:"0 0 14px"}}>Eslováquia, Grécia, Chipre e Polónia — valor total do mês</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12}}>
              {naMonthlyMkts.map(mkt=>(
                <div key={mkt.key}>
                  <p style={{fontSize:12,color:C.muted,margin:"0 0 6px"}}>{mkt.label} (€)</p>
                  <input type="number" value={goals[`fat_${mkt.key}`]??""} placeholder="0"
                    onChange={e=>setMonthData(prev=>({...prev,team_goals:{...prev.team_goals,[`fat_${mkt.key}`]:e.target.value}}))}
                    onBlur={saveAll}
                    style={{width:"100%",boxSizing:"border-box",padding:"9px 12px",border:`0.5px solid ${C.border}`,borderRadius:8,fontSize:14,background:C.bg,color:C.text,outline:"none"}} />
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── 1ªs Compras ── */}
      {subTab === "primeiras" && (
        <div style={T.card}>
          <p style={T.sectionTitle}>Faturação 1ªs compras — {MONTH_NAMES[month]} {year}</p>
          {!newStruct && (
            <div style={{ padding:"10px 14px", background:"#FEF3C7", borderRadius:8, marginBottom:12, fontSize:13, color:"#92400E" }}>
              ⚠ Meses anteriores a Junho 2026 usam a estrutura antiga (FR + CH-BNL-DEAT)
            </div>
          )}
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ borderBottom:`0.5px solid ${C.border}` }}>
                  {["Dia", ...getTeamMarkets(currentTeam,newStruct).map(m=>m.label)].map((h,i) => (
                    <th key={h} style={{ padding:"8px 10px", textAlign:i===0?"left":"center", color:C.muted, fontWeight:500, fontSize:11, textTransform:"uppercase", letterSpacing:".05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({length:totalDays}, (_,i) => i+1).map(day => {
                  const e = entries[day] || {};
                  return (
                    <tr key={day} style={{ borderBottom:`0.5px solid ${C.card}` }}>
                      <td style={{ padding:"6px 10px", fontWeight:500, color:C.text }}>{day}</td>
                      {getTeamMarkets(currentTeam,newStruct).map(m=>"first_rev_"+m.key).map(field => (
                        <td key={field} style={{ padding:"4px 6px", textAlign:"center" }}>
                          <input type="number" value={e[field] ?? ""} onChange={ev => updateEntry(day, field, ev.target.value)} onBlur={saveAll}
                            placeholder="0"
                            style={{ width:80, textAlign:"right", padding:"5px 8px", border:`0.5px solid ${C.border}`, borderRadius:6, fontSize:13, background:C.bg, color:C.text, outline:"none" }} />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {subTab==="primeiras"&&currentTeam === "equipa_na" && (() => {
        const naMonthlyMkts = [{key:"SK",label:"Eslováquia"},{key:"GR",label:"Grécia"},{key:"CY",label:"Chipre"},{key:"PL",label:"Polónia"}];
        return (
          <div style={T.card}>
            <p style={{...T.sectionTitle,marginBottom:4}}>1ªS COMPRAS — MERCADOS SECUNDÁRIOS</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12}}>
              {naMonthlyMkts.map(mkt=>{
                const fkey = `first_rev_${mkt.key}`;
                return (
                  <div key={fkey}>
                    <p style={{fontSize:12,color:C.muted,margin:"0 0 6px"}}>{mkt.label}</p>
                    <input type="number" value={goals[fkey]??""} placeholder="0"
                      onChange={e=>setMonthData(prev=>({...prev,team_goals:{...prev.team_goals,[fkey]:e.target.value}}))}
                      onBlur={saveAll}
                      style={{width:"100%",boxSizing:"border-box",padding:"9px 12px",border:`0.5px solid ${C.border}`,borderRadius:8,fontSize:14,background:C.bg,color:C.text,outline:"none"}} />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Afiliação ── */}
      {subTab === "afiliacao" && (() => {
        const mktList = getTeamMarkets(currentTeam, newStruct);
        return (
          <div style={{display:"flex",flexDirection:"column",gap:"1rem"}}>
            <div style={T.card}>
              <p style={{...T.sectionTitle,marginBottom:14}}>AFILIAÇÃO — {MONTH_NAMES[month].toUpperCase()} {year}</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12}}>
                {mktList.map(mkt=>{
                  const fkey = `afil_${mkt.key}`;
                  return (
                    <div key={fkey}>
                      <p style={{fontSize:12,color:C.muted,margin:"0 0 6px"}}>{mkt.label} (€)</p>
                      <input type="number" value={goals[fkey]??""} placeholder="0"
                        onChange={e=>setMonthData(prev=>({...prev,team_goals:{...prev.team_goals,[fkey]:e.target.value}}))}
                        onBlur={saveAll}
                        style={{width:"100%",boxSizing:"border-box",padding:"9px 12px",border:`0.5px solid ${C.border}`,borderRadius:8,fontSize:14,background:C.bg,color:C.text,outline:"none"}} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}


      {subTab==="afiliacao"&&currentTeam === "equipa_na" && (() => {
        const naMonthlyMkts = [{key:"SK",label:"Eslováquia"},{key:"GR",label:"Grécia"},{key:"CY",label:"Chipre"},{key:"PL",label:"Polónia"}];
        return (
          <div style={T.card}>
            <p style={{...T.sectionTitle,marginBottom:4}}>AFILIAÇÃO — MERCADOS SECUNDÁRIOS</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12}}>
              {naMonthlyMkts.map(mkt=>{
                const fkey = `afil_${mkt.key}`;
                return (
                  <div key={fkey}>
                    <p style={{fontSize:12,color:C.muted,margin:"0 0 6px"}}>{mkt.label}</p>
                    <input type="number" value={goals[fkey]??""} placeholder="0"
                      onChange={e=>setMonthData(prev=>({...prev,team_goals:{...prev.team_goals,[fkey]:e.target.value}}))}
                      onBlur={saveAll}
                      style={{width:"100%",boxSizing:"border-box",padding:"9px 12px",border:`0.5px solid ${C.border}`,borderRadius:8,fontSize:14,background:C.bg,color:C.text,outline:"none"}} />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Encomendas ── */}
      {subTab === "encomendas" && (() => {
        const mktList = getTeamMarkets(currentTeam, newStruct);
        return (
          <div style={{display:"flex",flexDirection:"column",gap:"1rem"}}>
            <div style={T.card}>
              <p style={{...T.sectionTitle,marginBottom:14}}>ENCOMENDAS — {MONTH_NAMES[month].toUpperCase()} {year}</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12}}>
                {mktList.flatMap(mkt=>[
                  <div key={`tot_${mkt.key}`}>
                    <p style={{fontSize:12,color:C.muted,margin:"0 0 6px"}}>Total enc. — {mkt.label}</p>
                    <input type="number" value={goals[`orders_total_${mkt.key}`]??""} placeholder="0"
                      onChange={e=>setMonthData(prev=>({...prev,team_goals:{...prev.team_goals,[`orders_total_${mkt.key}`]:e.target.value}}))}
                      onBlur={saveAll}
                      style={{width:"100%",boxSizing:"border-box",padding:"9px 12px",border:`0.5px solid ${C.border}`,borderRadius:8,fontSize:14,background:C.bg,color:C.text,outline:"none"}} />
                  </div>,
                  <div key={`fst_${mkt.key}`}>
                    <p style={{fontSize:12,color:C.muted,margin:"0 0 6px"}}>1ªs enc. — {mkt.label}</p>
                    <input type="number" value={goals[`orders_first_${mkt.key}`]??""} placeholder="0"
                      onChange={e=>setMonthData(prev=>({...prev,team_goals:{...prev.team_goals,[`orders_first_${mkt.key}`]:e.target.value}}))}
                      onBlur={saveAll}
                      style={{width:"100%",boxSizing:"border-box",padding:"9px 12px",border:`0.5px solid ${C.border}`,borderRadius:8,fontSize:14,background:C.bg,color:C.text,outline:"none"}} />
                  </div>
                ])}
              </div>
            </div>
          </div>
        );
      })()}


      {subTab==="encomendas"&&currentTeam === "equipa_na" && (() => {
        const naMonthlyMkts = [{key:"SK",label:"Eslováquia"},{key:"GR",label:"Grécia"},{key:"CY",label:"Chipre"},{key:"PL",label:"Polónia"}];
        return (
          <div style={T.card}>
            <p style={{...T.sectionTitle,marginBottom:4}}>ENCOMENDAS — MERCADOS SECUNDÁRIOS</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12}}>
              {naMonthlyMkts.map(mkt=>{
                const fkey = `orders_total_${mkt.key}`;
                return (
                  <div key={fkey}>
                    <p style={{fontSize:12,color:C.muted,margin:"0 0 6px"}}>{mkt.label}</p>
                    <input type="number" value={goals[fkey]??""} placeholder="0"
                      onChange={e=>setMonthData(prev=>({...prev,team_goals:{...prev.team_goals,[fkey]:e.target.value}}))}
                      onBlur={saveAll}
                      style={{width:"100%",boxSizing:"border-box",padding:"9px 12px",border:`0.5px solid ${C.border}`,borderRadius:8,fontSize:14,background:C.bg,color:C.text,outline:"none"}} />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Parceiros / Leads ── */}
      {subTab === "parceiros" && (() => {
        const mktList = getTeamMarkets(currentTeam, newStruct);
        return (
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={T.card}>
            <p style={T.sectionTitle}>Leads — {MONTH_NAMES[month]} {year}</p>
            <p style={{ fontSize:12, color:C.muted, margin:"0 0 14px" }}>Os novos parceiros são registados automaticamente no separador Parceiros.</p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(2, minmax(0,1fr))", gap:12 }}>
              {mktList.map(mkt => (
                <div key={mkt.key}>
                  <p style={{ fontSize:12, color:C.muted, margin:"0 0 6px" }}>Leads — {mkt.label}</p>
                  <input type="number" value={goals[`leads_d_${mkt.key}`]??""} placeholder="0"
                    onChange={e=>setMonthData(prev=>({...prev,team_goals:{...prev.team_goals,[`leads_d_${mkt.key}`]:e.target.value}}))}
                    onBlur={saveAll}
                    style={{width:"100%",boxSizing:"border-box",padding:"9px 12px",border:`0.5px solid ${C.border}`,borderRadius:8,fontSize:14,background:C.bg,color:C.text,outline:"none"}} />
                </div>
              ))}
            </div>
          </div>


          </div>
        );
      })()}


      {subTab==="parceiros"&&currentTeam === "equipa_na" && (() => {
        const naMonthlyMkts = [{key:"SK",label:"Eslováquia"},{key:"GR",label:"Grécia"},{key:"CY",label:"Chipre"},{key:"PL",label:"Polónia"}];
        return (
          <div style={T.card}>
            <p style={{...T.sectionTitle,marginBottom:4}}>PARCEIROS/LEADS — MERCADOS SECUNDÁRIOS</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12}}>
              {naMonthlyMkts.map(mkt=>{
                const fkey = `leads_${mkt.key}`;
                return (
                  <div key={fkey}>
                    <p style={{fontSize:12,color:C.muted,margin:"0 0 6px"}}>{mkt.label}</p>
                    <input type="number" value={goals[fkey]??""} placeholder="0"
                      onChange={e=>setMonthData(prev=>({...prev,team_goals:{...prev.team_goals,[fkey]:e.target.value}}))}
                      onBlur={saveAll}
                      style={{width:"100%",boxSizing:"border-box",padding:"9px 12px",border:`0.5px solid ${C.border}`,borderRadius:8,fontSize:14,background:C.bg,color:C.text,outline:"none"}} />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Margem ── */}
      {subTab === "margem" && (() => {
        const mktList = getTeamMarkets(currentTeam, newStruct);
        return (
          <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
            {mktList.map(mkt => (
              <div key={mkt.key} style={T.card}>
                <p style={T.sectionTitle}>{mkt.label}</p>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(2, minmax(0, 280px))", gap:16 }}>
                  {[{f:`margin_pct_${mkt.key}`,l:"Margem do mês (%)"}].map(({f,l}) => (
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


      {subTab==="margem"&&currentTeam === "equipa_na" && (() => {
        const naMonthlyMkts = [{key:"SK",label:"Eslováquia"},{key:"GR",label:"Grécia"},{key:"CY",label:"Chipre"},{key:"PL",label:"Polónia"}];
        return (
          <div style={T.card}>
            <p style={{...T.sectionTitle,marginBottom:4}}>MARGEM — MERCADOS SECUNDÁRIOS</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12}}>
              {naMonthlyMkts.map(mkt=>{
                const fkey = `margin_pct_${mkt.key}`;
                return (
                  <div key={fkey}>
                    <p style={{fontSize:12,color:C.muted,margin:"0 0 6px"}}>{mkt.label}</p>
                    <input type="number" value={goals[fkey]??""} placeholder="0"
                      onChange={e=>setMonthData(prev=>({...prev,team_goals:{...prev.team_goals,[fkey]:e.target.value}}))}
                      onBlur={saveAll}
                      style={{width:"100%",boxSizing:"border-box",padding:"9px 12px",border:`0.5px solid ${C.border}`,borderRadius:8,fontSize:14,background:C.bg,color:C.text,outline:"none"}} />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Faturação por programa ── */}
      {subTab === "fat_programa" && (
        <div style={T.card}>
          <p style={T.sectionTitle}>Faturação por programa — {MONTH_NAMES[month]} {year}</p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2, minmax(0,1fr))", gap:12 }}>
            {["Elite","Professionals","Pro Gym","Pro Box","Pro Teams","Performance","Horeca","Corporate"].map(prog => {
              const fkey = `fat_prog_${prog.replace(/ /g,"_").toLowerCase()}`;
              return (
                <div key={fkey}>
                  <p style={{ fontSize:12, color:C.muted, margin:"0 0 6px" }}>{prog}</p>
                  <input type="number" value={goals[fkey]??""} placeholder="0"
                    onChange={e=>setMonthData(prev=>({...prev,team_goals:{...prev.team_goals,[fkey]:e.target.value}}))}
                    onBlur={saveAll}
                    style={{width:"100%",boxSizing:"border-box",padding:"9px 12px",border:`0.5px solid ${C.border}`,borderRadius:8,fontSize:14,background:C.bg,color:C.text,outline:"none"}} />
                </div>
              );
            })}
          </div>
        </div>
      )}

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

// ── Partner constants & mappings ──────────────────────────────────────────────
const GESTORS = ["Antony", "Fabien", "Mónica", "Kamila Barros", "Catarina Monteiro", "Bruno Vieira", "Vanessa Ferreirinha", "Jose Castillo", "Mariana Lopes", "Guilherme Mendes", "Ines Anjo", "Daniel Silva", "Margarida Pinheiro", "Abilio Morais", "Beatriz Beato", "Telma Barroso", "Pedro Oliveira"];
const ALL_MKTS = [
  {key:"FR",label:"França"},{key:"CH-BNL-DEAT",label:"CH-BNL-DEAT"},
  {key:"CH",label:"Suíça"},{key:"BNL",label:"Benelux"},{key:"DEAT",label:"Alemanha e Áustria"}
];
const GESTOR_MAP = {
  "ANTONY BARROS":"Antony","FABIEN COLETTE":"Fabien","MONICA OLIVEIRA":"Mónica",
  "ANTONY":"Antony","FABIEN":"Fabien","MONICA":"Mónica","MÓNICA":"Mónica",
  "KAMILA BARROS":"Kamila Barros","KAMILA":"Kamila Barros",
  "CATARINA MONTEIRO":"Catarina Monteiro","CATARINA CMONTEIRO":"Catarina Monteiro","CATARINA":"Catarina Monteiro",
  "BRUNO VIEIRA":"Bruno Vieira","BRUNO":"Bruno Vieira",
  "JOSE CASTILLO":"Jose Castillo","JOSÉ CASTILLO":"Jose Castillo","JOSE":"Jose Castillo",
  "MARIANA LOPES":"Mariana Lopes","MARIANA":"Mariana Lopes",
  "GUILHERME MENDES":"Guilherme Mendes","GUILHERME":"Guilherme Mendes",
  "INES ANJO":"Ines Anjo","INÊS ANJO":"Ines Anjo","INES":"Ines Anjo",
  "DANIEL SILVA":"Daniel Silva","DANIEL":"Daniel Silva",
  "MARGARIDA PINHEIRO":"Margarida Pinheiro","MARGARIDA":"Margarida Pinheiro",
  "ABILIO MORAIS":"Abilio Morais","ABÍLIO MORAIS":"Abilio Morais","ABILIO":"Abilio Morais",
  "BEATRIZ BEATO":"Beatriz Beato","BEATRIZ":"Beatriz Beato",
  "TELMA BARROSO":"Telma Barroso","TELMA":"Telma Barroso",
  "PEDRO OLIVEIRA":"Pedro Oliveira","PEDRO":"Pedro Oliveira",
  "VANESSA FERREIRINHA":"Vanessa Ferreirinha","VANESSA":"Vanessa Ferreirinha",
};
const MKT_MAP = {
  "França":"FR","FRANCA":"FR","FRANCE":"FR",
  "Suiça":"CH","SUICA":"CH","SUIÇA":"CH","SWITZERLAND":"CH",
  "AT":"DEAT","DE":"DEAT","DEAT":"DEAT",
  "BE":"BNL","NL":"BNL","LU":"BNL","BNL":"BNL",
  "FR":"FR","CH":"CH",
  "IT":"IT","ITALY":"IT","ITALIA":"IT","ITÁLIA":"IT",
  "ES":"ES","SPAIN":"ES","ESPANHA":"ES","ESPANA":"ES",
  "PT":"PT","PORTUGAL":"PT",
  "OTHER":"OTHER","OUTROS":"OTHER",
  "NA":"NA",
  "CZ":"CZ","CZECH":"CZ","REPUBLICA CHECA":"CZ",
  "SK":"SK","SLOVAKIA":"SK","ESLOVÁQUIA":"SK",
  "GR":"GR","GREECE":"GR","GRECIA":"GR","GRÉCIA":"GR",
  "CY":"CY","CYPRUS":"CY","CHIPRE":"CY",
  "PL":"PL","POLAND":"PL","POLÓNIA":"PL",
  "IE":"IE","IRELAND":"IE","IRLANDA":"IE",
  "WW":"WW","WORLDWIDE":"WW",
  "SE":"SE","SWEDEN":"SE","SUECIA":"SE","SUÉCIA":"SE",
  "GB":"GB","UK":"GB","REINO UNIDO":"GB","UNITED KINGDOM":"GB",
  "EU":"EU",
  "RO":"RO","ROMANIA":"RO","ROMÉNIA":"RO",
  "DK":"DK","DENMARK":"DK","DINAMARCA":"DK",
  "FI":"FI","FINLAND":"FI","FINLÂNDIA":"FI",
  "CA":"CA","CANADA":"CA","CANADÁ":"CA",
};

const GESTOR_MAP_IT = {
  "KAMILA BARROS":"Kamila Barros","KAMILA":"Kamila Barros",
  "CATARINA MONTEIRO":"Catarina Monteiro","CATARINA":"Catarina Monteiro",
  "BRUNO VIEIRA":"Bruno Vieira","BRUNO":"Bruno Vieira",
};
const PROG_MAP = {
  "ELITE-PARTNER":"Elite","ELITE":"Elite",
  "PROFESSIONALS":"Professionals","PROFESSIONAL":"Professionals",
  "PRO GYM":"Pro Gym","PROGYM":"Pro Gym",
  "PRO BOX":"Pro Box","PROBOX":"Pro Box",
  "PRO TEAMS":"Pro Teams","PROTEAMS":"Pro Teams",
  "PERFORMANCE":"Performance","HORECA":"Horeca","CORPORATE":"Corporate",
};
function mapVal(map, val) {
  if (!val) return null;
  const k = String(val).trim().toUpperCase();
  return map[String(val).trim()] || map[k] || null;
}

// ── CopyBtn ───────────────────────────────────────────────────────────────────
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(String(text)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={handleCopy} title="Copiar ID"
      style={{ display:"inline-flex", alignItems:"center", gap:4, background:copied?"#DCFCE7":"transparent",
               border:`1px solid ${copied?"#86EFAC":"#D1D5DB"}`, cursor:"pointer", padding:"3px 8px",
               borderRadius:6, color:copied?"#16A34A":C.muted, fontSize:12, fontWeight:500, lineHeight:1, flexShrink:0, transition:"all .15s" }}>
      <span style={{ fontSize:13 }}>{copied ? "✓" : "⎘"}</span>
      <span>{copied ? "Copiado" : "Copiar"}</span>
    </button>
  );
}

// ── PartnerFollowup ────────────────────────────────────────────────────────────
function PartnerFollowup({ year, month, gestor: gestorFilter, isAdmin=false, followupTeam=null, role=null }) {
  const isGestorFiltered = !!gestorFilter;
  const PROGS = ["Professionals","Elite","Pro Gym","Pro Box","Pro Teams","Performance","Horeca","Corporate"];
  const MKT_OLD = [{key:"FR",label:"França"},{key:"CH-BNL-DEAT",label:"CH-BNL-DEAT"}];
  const MKT_NEW = [{key:"FR",label:"França"},{key:"CH",label:"Suíça"},{key:"BNL",label:"Benelux"},{key:"DEAT",label:"Alemanha e Áustria"}];
  const isNew = isNewStructure(year, month);
  const mktList = isNew ? MKT_NEW : MKT_OLD;

  const STAGES = [
    { key:"s30", days:30, label:"30 dias" },
    { key:"s60", days:60, label:"60 dias" },
    { key:"s90", days:90, label:"90 dias" },
  ];

  const [followTab, setFollowTab] = useState("acompanhamento");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [filterGestor, setFilterGestor] = useState("all");
  const [filterMkt, setFilterMkt] = useState("all");
  const [filterProg, setFilterProg] = useState("all");
  const [sortOrder, setSortOrder] = useState("urgency");
  const [clientId, setClientId] = useState("");
  const [mkt, setMkt] = useState("");
  const [prog, setProg] = useState("");
  const [gestor, setGestor] = useState(gestorFilter||"");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0,10));
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [importDetails, setImportDetails] = useState(null);
  const [showImportDetails, setShowImportDetails] = useState(false);
  const fileRef = React.useRef();

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("partner_followup").select("*").order("stage_started_at", { ascending:false }).limit(5000);
    if (followupTeam) {
      const teamObj = TEAMS.find(t=>t.key===followupTeam);
      if (teamObj) q = q.in("market", teamObj.markets);
    }
    if (gestorFilter) q = q.eq("gestor", gestorFilter);
    const { data } = await q;
    setRecords(data || []);
    setLoading(false);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!clientId.trim() || !mkt || !prog) return;
    setSaving(true);
    const { data: existing } = await supabase.from("partner_followup").select("id").eq("client_id", clientId.trim()).maybeSingle();
    if (existing) { alert(`ID ${clientId.trim()} já existe na lista.`); setSaving(false); return; }
    const { error } = await supabase.from("partner_followup").insert({
      client_id: clientId.trim(),
      programme: prog,
      stage: "s30",
      stage_started_at: new Date(startDate).toISOString(),
      original_created_at: new Date(startDate).toISOString(),
      status: "pending",
      market: mkt,
      gestor,
    });
    if (error) { alert("Erro ao guardar: " + error.message); setSaving(false); return; }
    setClientId(""); setProg(""); setMkt(""); setGestor(gestorFilter||"");
    setStartDate(new Date().toISOString().slice(0,10));
    await load();
    setSaving(false);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    setImportMsg("");
    setImportDetails(null);
    setShowImportDetails(false);
    try {
      // Read as text (works for CSV; for XLSX we use a script tag)
      const parseDate = (v) => {
        if (!v) return new Date().toISOString();
        if (v instanceof Date) return v.toISOString();
        // Excel serial date number
        if (typeof v === "number") return new Date(Math.round((v - 25569) * 86400000)).toISOString();
        // DD/MM/YYYY or YYYY-MM-DD
        const s = String(v).trim();
        const parts = s.split(/[\/\-\.]/);
        if (parts.length === 3) {
          const [a,b,c] = parts.map(Number);
          if (a > 31) return new Date(a, b-1, c).toISOString(); // YYYY-MM-DD
          return new Date(c, b-1, a).toISOString(); // DD/MM/YYYY
        }
        return new Date().toISOString();
      };

      // Use SheetJS via script injection if xlsx not available
      if (!window._XLSX) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
        window._XLSX = window.XLSX;
      }
      const XL = window._XLSX;
      const buf = await file.arrayBuffer();
      const wb = XL.read(buf, { type:"array", cellDates:false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XL.utils.sheet_to_json(ws, { header:1, defval:"" });

      let headerIdx = rows.findIndex(r => r.some(c => ["ID","AFENT_CODIGO","AFÉNT_CODIGO"].includes(String(c).trim().toUpperCase())));
      if (headerIdx < 0) { setImportMsg("❌ Coluna ID não encontrada"); setImporting(false); return; }
      const headers = rows[headerIdx].map(h => String(h).trim().toUpperCase());
      const iID   = headers.findIndex(h => h==="ID" || h==="AFENT_CODIGO" || h==="AFÉNT_CODIGO");
      const iGest = headers.findIndex(h => h==="GESTOR" || h==="GUSP_NOME");
      const iMkt  = headers.findIndex(h => h==="MERCADO" || h==="FPLN_LOJA");
      const iProg = headers.findIndex(h => h==="PROGRAMA" || h==="FPMO_NOME");
      const iDate = headers.findIndex(h => h.includes("DATA") || h==="FPLN_DATA_INICIO");
      const dataRows = rows.slice(headerIdx + 1).filter(r => String(r[iID]||"").trim());
      let ok = 0, skipInvalid = 0, skipDup = 0;
      const invalidDetails = [], dupDetails = [];
      for (const r of dataRows) {
        const clientId  = String(r[iID]).trim();
        const gestorRaw = iGest >= 0 ? String(r[iGest]||"").trim() : "";
        const mktRaw    = iMkt >= 0  ? String(r[iMkt]||"").trim()  : "";
        const progRaw   = iProg >= 0 ? String(r[iProg]||"").trim() : "";
        const dateRaw   = iDate >= 0 ? r[iDate] : null;
        const gestorVal = mapVal(GESTOR_MAP, gestorRaw) || gestorRaw;
        const mktVal    = mapVal(MKT_MAP, mktRaw);
        const progVal   = mapVal(PROG_MAP, progRaw);
        if (!mktVal || !progVal) {
          skipInvalid++;
          invalidDetails.push({ id: clientId, motivo: !mktVal ? `Mercado não reconhecido: "${mktRaw}"` : `Programa não reconhecido: "${progRaw}"` });
          continue;
        }
        const { data: existing } = await supabase.from("partner_followup").select("id").eq("client_id", clientId).maybeSingle();
        if (existing) { skipDup++; dupDetails.push({ id: clientId }); continue; }
        const { error } = await supabase.from("partner_followup").insert({
          client_id: clientId, gestor: gestorVal, market: mktVal, programme: progVal,
          stage:"s30", stage_started_at: parseDate(dateRaw),
          original_created_at: parseDate(dateRaw), status:"pending",
        });
        if (!error) ok++; else { skipInvalid++; invalidDetails.push({ id: clientId, motivo: "Erro ao inserir" }); }
      }
      const parts = [`✓ ${ok} registos importados`];
      if (skipDup > 0) parts.push(`${skipDup} duplicados ignorados`);
      if (invalidDetails.length > 0) parts.push(`${invalidDetails.length} inválidos ignorados`);
      setImportMsg(parts.join(" · "));
      setImportDetails({ dups: dupDetails, invalids: invalidDetails });
      await load();
    } catch(err) {
      setImportMsg("❌ Erro: " + err.message);
    }
    setImporting(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleBought = async (id) => {
    await supabase.from("partner_followup").update({ status:"bought" }).eq("id", id);
    await load();
  };

  const handleNotBought = async (record) => {
    const next = record.stage==="s30"?"s60":record.stage==="s60"?"s90":null;
    if (!next) {
      await supabase.from("partner_followup").update({ status:"closed" }).eq("id", record.id);
    } else {
      await supabase.from("partner_followup").update({ stage:next, stage_started_at:new Date().toISOString(), status:"pending" }).eq("id", record.id);
    }
    await load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Apagar este registo? Será removido da contagem de novos parceiros.")) return;
    await supabase.from("partner_followup").delete().eq("id", id);
    await load();
  };

  const getInfo = (r) => {
    const stage = STAGES.find(s=>s.key===r.stage)||STAGES[0];
    const regDate = r.original_created_at || r.stage_started_at;
    const diff = Math.floor((new Date()-new Date(regDate))/86400000);
    const left = stage.days-diff;
    return { stage, diff, left, overdue: left<=0 };
  };

  const pending = records.filter(r=>r.status==="pending");
  const overdueCount = pending.filter(r=>getInfo(r).overdue).length;

  const sortByUrgency = (arr) => [...arr].sort((a,b) => {
    const ia = getInfo(a), ib = getInfo(b);
    if (ia.overdue && !ib.overdue) return -1;
    if (!ia.overdue && ib.overdue) return 1;
    return ia.left - ib.left;
  });

  const stageFiltered = filter==="all" ? pending :
    filter==="s30" ? pending.filter(r=>r.stage==="s30") :
    filter==="s60" ? pending.filter(r=>r.stage==="s60") :
    pending.filter(r=>r.stage==="s90");

  const applySort = (arr) => {
    if (sortOrder==="urgency") return sortByUrgency(arr);
    if (sortOrder==="newest") return [...arr].sort((a,b)=>new Date(b.original_created_at||b.stage_started_at)-new Date(a.original_created_at||a.stage_started_at));
    if (sortOrder==="oldest") return [...arr].sort((a,b)=>new Date(a.original_created_at||a.stage_started_at)-new Date(b.original_created_at||b.stage_started_at));
    return arr;
  };

  const filtered = applySort(stageFiltered
    .filter(r => filterGestor==="all" || r.gestor===filterGestor)
    .filter(r => filterMkt==="all" || r.market===filterMkt)
    .filter(r => filterProg==="all" || r.programme===filterProg)
  );

  const STAGE_COLORS = {
    s30: { bg:C.card, border:C.border, badgeBg:"#FCEBEB", badgeText:C.red,
           overdueBg:"#F7C1C1", overdueBorder:"#E05555" },
    s60: { bg:"#FAEEDA", border:"#EF9F27", badgeBg:"#FAEEDA", badgeText:"#633806",
           overdueBg:"#F5D79E", overdueBorder:"#C47D10" },
    s90: { bg:"#FCEBEB", border:C.red, badgeBg:"#F7C1C1", badgeText:"#791F1F",
           overdueBg:"#F0A0A0", overdueBorder:"#B91C1C" },
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
      {/* Sub-tab buttons */}
      <div style={{ display:"flex", alignItems:"center", gap:8, borderBottom:`0.5px solid ${C.border}`, paddingBottom:8 }}>
        {["acompanhamento","analise"].map(t=>(
          <button key={t} onClick={()=>setFollowTab(t)}
            style={{ padding:"6px 16px", border:"none", borderBottom:followTab===t?`2px solid ${C.green}`:"2px solid transparent",
              background:"transparent", color:followTab===t?C.green:C.muted, fontWeight:followTab===t?500:400, fontSize:13, cursor:"pointer" }}>
            {t==="acompanhamento"?"Acompanhamento":"Análise"}
          </button>
        ))}
        {followTab==="acompanhamento"&&overdueCount>0&&(
          <span style={{ marginLeft:"auto", background:"#FCEBEB", color:C.red, fontSize:12, fontWeight:500, padding:"5px 12px", borderRadius:20 }}>
            ⚠ {overdueCount} {overdueCount===1?"alerta":"alertas"}
          </span>
        )}
      </div>

      {followTab==="analise"&&<AnaliseFollowup year={year} month={month} isAdmin={isAdmin} role={role} />}
      {followTab==="acompanhamento"&&<>

      {/* Form */}
      <div style={T.card}>
        <p style={T.sectionTitle}>Registar Novo</p>
        <form onSubmit={handleAdd}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr auto", gap:10, alignItems:"end" }}>
            <div>
              <p style={{ fontSize:12, color:C.muted, margin:"0 0 5px" }}>ID</p>
              <input type="text" value={clientId} onChange={e=>setClientId(e.target.value)} placeholder="P (ex: 123456)" required
                style={{ width:"100%", boxSizing:"border-box", padding:"8px 12px", border:`0.5px solid ${C.border}`, borderRadius:8, fontSize:13, background:C.bg, color:C.text, outline:"none" }} />
            </div>
            <div>
              <p style={{ fontSize:12, color:C.muted, margin:"0 0 5px" }}>Gestor</p>
              <select value={gestor} onChange={e=>!isGestorFiltered&&setGestor(e.target.value)} disabled={isGestorFiltered} required
                style={{ width:"100%", padding:"8px 12px", border:`0.5px solid ${C.border}`, borderRadius:8, fontSize:13, background:isGestorFiltered?C.card:C.bg, color:C.text, outline:"none", opacity:isGestorFiltered?0.7:1 }}>
                <option value="">Seleccionar…</option>
                {GESTORS.map(g=><option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <p style={{ fontSize:12, color:C.muted, margin:"0 0 5px" }}>Mercado</p>
              <select value={mkt} onChange={e=>setMkt(e.target.value)} required
                style={{ width:"100%", padding:"8px 12px", border:`0.5px solid ${C.border}`, borderRadius:8, fontSize:13, background:C.bg, color:C.text, outline:"none" }}>
                <option value="">Seleccionar…</option>
                {mktList.map(m=><option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <p style={{ fontSize:12, color:C.muted, margin:"0 0 5px" }}>Programa</p>
              <select value={prog} onChange={e=>setProg(e.target.value)} required
                style={{ width:"100%", padding:"8px 12px", border:`0.5px solid ${C.border}`, borderRadius:8, fontSize:13, background:C.bg, color:C.text, outline:"none" }}>
                <option value="">Seleccionar…</option>
                {PROGS.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <p style={{ fontSize:12, color:C.muted, margin:"0 0 5px" }}>Data de entrada</p>
              <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} required
                style={{ width:"100%", boxSizing:"border-box", padding:"8px 12px", border:`0.5px solid ${C.border}`, borderRadius:8, fontSize:13, background:C.bg, color:C.text, outline:"none" }} />
            </div>
            <button type="submit" disabled={saving||!clientId.trim()||!mkt||!prog}
              style={{ padding:"8px 18px", background:C.green, color:"#fff", border:"none", borderRadius:8, fontSize:13, fontWeight:500, cursor:"pointer", opacity:saving?0.6:1, whiteSpace:"nowrap" }}>
              {saving?"…":"+ Adicionar"}
            </button>
          </div>
        </form>
      </div>

      {/* Import */}
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <input type="file" accept=".xlsx,.xls,.csv" ref={fileRef} onChange={handleImport} style={{ display:"none" }} />
        <button onClick={()=>fileRef.current.click()} disabled={importing}
          style={{ padding:"8px 16px", background:"transparent", border:`0.5px solid ${C.border}`, borderRadius:8, fontSize:13, color:C.text, cursor:"pointer", opacity:importing?0.6:1 }}>
          {importing?"A importar…":"📂 Importar Excel"}
        </button>
        {importMsg && (
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:13, color:importMsg.startsWith("✓")?C.green:C.red }}>{importMsg}</span>
              {importDetails && (importDetails.invalids.length>0||importDetails.dups.length>0) && (
                <button onClick={()=>setShowImportDetails(v=>!v)}
                  style={{ fontSize:12, color:C.muted, background:"transparent", border:`0.5px solid ${C.border}`, borderRadius:6, padding:"2px 8px", cursor:"pointer" }}>
                  {showImportDetails?"▲ Ocultar":"▼ Ver detalhes"}
                </button>
              )}
            </div>
            {showImportDetails && importDetails && (
              <div style={{ background:C.card, border:`0.5px solid ${C.border}`, borderRadius:8, padding:"10px 14px", fontSize:12, display:"flex", flexDirection:"column", gap:6, maxHeight:200, overflowY:"auto" }}>
                {importDetails.dups.length>0 && (
                  <div>
                    <p style={{ margin:"0 0 4px", fontWeight:500, color:C.muted }}>Duplicados ignorados</p>
                    {importDetails.dups.map((d,i)=>(
                      <p key={i} style={{ margin:"2px 0", color:C.text }}>· ID {d.id} — já existe na base de dados</p>
                    ))}
                  </div>
                )}
                {importDetails.invalids.length>0 && (
                  <div>
                    <p style={{ margin:"0 0 4px", fontWeight:500, color:C.red }}>Inválidos ignorados</p>
                    {importDetails.invalids.map((d,i)=>(
                      <p key={i} style={{ margin:"2px 0", color:C.text }}>· ID {d.id} — {d.motivo}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{ display:"flex", flexWrap:"nowrap", gap:8, alignItems:"center", overflowX:"auto" }}>
        {/* Stage buttons */}
        <div style={{ display:"flex", gap:8 }}>
          {[
            {id:"all",  label:`Todos (${pending.length})`},
            {id:"s30",  label:`30 dias (${pending.filter(r=>r.stage==="s30").length})`},
            {id:"s60",  label:`60 dias (${pending.filter(r=>r.stage==="s60").length})`},
            {id:"s90",  label:`90 dias (${pending.filter(r=>r.stage==="s90").length})`},
          ].map(f=>(
            <button key={f.id} onClick={()=>setFilter(f.id)}
              style={{ padding:"6px 14px", borderRadius:20, fontSize:12, border:`0.5px solid ${C.border}`, cursor:"pointer",
                background:filter===f.id?C.green:"transparent", color:filter===f.id?"#fff":C.muted, fontWeight:filter===f.id?500:400 }}>
              {f.label}
            </button>
          ))}
        </div>
        {/* Sort toggle */}
        <select value={sortOrder} onChange={e=>setSortOrder(e.target.value)}
          style={{ padding:"5px 8px", border:`0.5px solid ${C.border}`, borderRadius:8, fontSize:12, background:C.bg, color:C.muted, outline:"none", cursor:"pointer", flexShrink:0 }}>
          <option value="urgency">↑ Mais urgente</option>
          <option value="oldest">↑ Mais antigo</option>
          <option value="newest">↓ Mais recente</option>
        </select>
        {/* Separator */}
        <div style={{ width:1, height:24, background:C.border, margin:"0 4px" }} />
        {/* Gestor */}
        <select value={filterGestor} onChange={e=>setFilterGestor(e.target.value)}
          style={{ padding:"5px 8px", border:`0.5px solid ${C.border}`, borderRadius:8, fontSize:12, background:C.bg, color:filterGestor!=="all"?C.text:C.muted, outline:"none", cursor:"pointer", flexShrink:0 }}>
          <option value="all">Gestor</option>
          {GESTORS.map(g=><option key={g} value={g}>{g}</option>)}
        </select>
        {/* Mercado */}
        <select value={filterMkt} onChange={e=>setFilterMkt(e.target.value)}
          style={{ padding:"5px 8px", border:`0.5px solid ${C.border}`, borderRadius:8, fontSize:12, background:C.bg, color:filterMkt!=="all"?C.text:C.muted, outline:"none", cursor:"pointer", flexShrink:0 }}>
          <option value="all">Mercado</option>
          <option value="FR">França</option>
          <option value="CH">Suíça</option>
          <option value="BNL">Benelux</option>
          <option value="DEAT">Alemanha e Áustria</option>
          <option value="IT">Itália</option>
          <option value="ES">Espanha</option>
          <option value="PT">Portugal</option>
          <option value="IE">Irlanda</option>
          <option value="WW">Worldwide</option>
          <option value="SE">Suécia</option>
          <option value="GB">Reino Unido</option>
          <option value="EU">EU</option>
          <option value="RO">Roménia</option>
          <option value="DK">Dinamarca</option>
          <option value="FI">Finlândia</option>
          <option value="CA">Canadá</option>
          <option value="NA">NA</option>
          <option value="CZ">República Checa</option>
          <option value="SK">Eslováquia</option>
          <option value="GR">Grécia</option>
          <option value="CY">Chipre</option>
          <option value="PL">Polónia</option>
        </select>
        {/* Programa */}
        <select value={filterProg} onChange={e=>setFilterProg(e.target.value)}
          style={{ padding:"5px 8px", border:`0.5px solid ${C.border}`, borderRadius:8, fontSize:12, background:C.bg, color:filterProg!=="all"?C.text:C.muted, outline:"none", cursor:"pointer", flexShrink:0 }}>
          <option value="all">Programa</option>
          <option value="Elite">Elite</option>
          <option value="Professionals">Professionals</option>
          <option value="Pro Gym">Pro Gym</option>
          <option value="Pro Box">Pro Box</option>
          <option value="Pro Teams">Pro Teams</option>
          <option value="Performance">Performance</option>
          <option value="Horeca">Horeca</option>
          <option value="Corporate">Corporate</option>
        </select>
        {/* Reset */}
        {(filterGestor!=="all"||filterMkt!=="all"||filterProg!=="all") && (
          <button onClick={()=>{ setFilterGestor("all"); setFilterMkt("all"); setFilterProg("all"); }}
            style={{ padding:"5px 10px", borderRadius:8, fontSize:12, border:`0.5px solid ${C.border}`, background:"transparent", color:C.muted, cursor:"pointer" }}>
            ✕ Limpar filtros
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign:"center", padding:"3rem 0", color:C.muted, fontSize:14 }}>A carregar…</div>
      ) : filtered.length===0 ? (
        <div style={{ textAlign:"center", padding:"3rem 0", color:C.muted, fontSize:14, background:C.card, borderRadius:12 }}>
          Nenhum registo nesta categoria.
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {filtered.map(r=>{
            const {stage,diff,left,overdue}=getInfo(r);
            const sc = STAGE_COLORS[stage.key];
            const mktLabel = ALL_MKTS.find(m=>m.key===r.market)?.label || r.market || "—";
            return (
              <div key={r.id} style={{ background:overdue?sc.overdueBg:sc.bg, border:`1.5px solid ${overdue?sc.overdueBorder:sc.border}`, borderRadius:12, padding:"12px 16px" }}>
                {/* Linha 1 */}
                <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:overdue?C.red:"#d97706", flexShrink:0 }} />
                  <div style={{ display:"flex", alignItems:"center", gap:6, minWidth:150 }}>
                    <p style={{ fontWeight:600, fontSize:14, margin:0, color:C.text }}>ID: {r.client_id}</p>
                    <CopyBtn text={r.client_id} />
                  </div>
                  <p style={{ fontSize:13, fontWeight:500, margin:0, color:C.text, minWidth:80 }}>{r.gestor||"—"}</p>
                  <div style={{ textAlign:"center", minWidth:70 }}>
                    <p style={{ fontSize:11, color:C.muted, margin:0 }}>Fase</p>
                    <p style={{ fontSize:13, fontWeight:500, margin:0, color:C.text }}>{stage.label}</p>
                  </div>
                  <div style={{ textAlign:"center", minWidth:80 }}>
                    <p style={{ fontSize:11, color:C.muted, margin:0 }}>Registado há</p>
                    <p style={{ fontSize:13, fontWeight:500, margin:0, color:C.text }}>{diff} {diff===1?"dia":"dias"}</p>
                  </div>
                  <div style={{ minWidth:120, textAlign:"center" }}>
                    {overdue ? (
                      <span style={{ background:sc.badgeBg, color:sc.badgeText, fontSize:11, fontWeight:500, padding:"4px 10px", borderRadius:20 }}>⚠ Verificar agora</span>
                    ) : (
                      <span style={{ background:C.card, color:C.muted, fontSize:11, padding:"4px 10px", borderRadius:20 }}>{left} {left===1?"dia":"dias"} restantes</span>
                    )}
                  </div>
                  <div style={{ display:"flex", gap:8, marginLeft:"auto", flexShrink:0 }}>
                    <button onClick={()=>handleBought(r.id)}
                      style={{ padding:"6px 14px", background:C.green, color:"#fff", border:"none", borderRadius:8, fontSize:12, fontWeight:500, cursor:"pointer" }}>
                      ✓ Fez
                    </button>
                    <button onClick={()=>handleNotBought(r)}
                      style={{ padding:"6px 12px", background:C.card, color:C.text, border:`0.5px solid ${C.border}`, borderRadius:8, fontSize:12, cursor:"pointer" }}>
                      ✗ Não fez
                    </button>
                    <button onClick={()=>handleDelete(r.id)} title="Apagar erro de registo"
                      style={{ padding:"6px 10px", background:"transparent", color:C.muted, border:`0.5px solid ${C.border}`, borderRadius:8, fontSize:12, cursor:"pointer" }}>
                      🗑
                    </button>
                  </div>
                </div>
                {/* Linha 2 */}
                <div style={{ display:"flex", gap:8, marginTop:8, paddingLeft:22 }}>
                  <span style={{ fontSize:11, background:C.card, color:C.muted, padding:"2px 8px", borderRadius:20 }}>{r.programme}</span>
                  <span style={{ fontSize:11, background:C.card, color:C.muted, padding:"2px 8px", borderRadius:20 }}>{mktLabel}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
    }
    </div>
  );
}


// ── CockpitTab ────────────────────────────────────────────────────────────────
function CockpitTab({ gestor, isAdmin, year, month }) {
  const [followupData, setFollowupData] = useState([]);
  const [ordersData, setOrdersData] = useState([]);
  const [partnersData, setPartnersData] = useState([]);
  const [ssDates, setSsDates] = useState(new Set());
  const [loading, setLoading] = useState(true);

  const myGestor = isAdmin ? null : (gestor?.name || gestor);
  const gestors = isAdmin ? ["Antony","Fabien","Mónica","Kamila Barros","Catarina Monteiro","Bruno Vieira","Jose Castillo","Mariana Lopes","Guilherme Mendes","Ines Anjo","Daniel Silva","Margarida Pinheiro","Abilio Morais","Beatriz Beato","Telma Barroso","Pedro Oliveira"] : [myGestor];

  useEffect(()=>{
    setLoading(true);
    Promise.all([
      supabase.from("partner_followup").select("*").eq("status","pending").limit(5000),
      supabase.from("partner_orders").select("*").order("order_date",{ascending:false}),
      supabase.from("top_partners").select("*").order("import_date",{ascending:false}),
      supabase.from("billing_months").select("month_key,entries"),
    ]).then(([{data:fu},{data:po},{data:tp},{data:bm}])=>{
      setFollowupData(fu||[]);
      setOrdersData(po||[]);
      setPartnersData(tp||[]);
      // Build SS dates
      const ssSet = new Set();
      (bm||[]).forEach(row=>{
        const [y,m] = row.month_key.split("-").map(Number);
        Object.entries(row.entries||{}).forEach(([d,e])=>{
          if(e.supersales) ssSet.add(`${y}-${String(m).padStart(2,"0")}-${String(Number(d)).padStart(2,"0")}`);
        });
      });
      setSsDates(ssSet);
      setLoading(false);
    });
  },[]);

  if (loading) return <div style={{padding:"2rem",color:C.muted,fontSize:13}}>A carregar...</div>;

  const today = new Date();
  const STAGES = [
    {key:"s30",days:30,label:"30 dias"},
    {key:"s60",days:60,label:"60 dias"},
    {key:"s90",days:90,label:"90 dias"},
  ];

  const getInfo = (r) => {
    const stage = STAGES.find(s=>s.key===r.stage)||STAGES[0];
    const regDate = r.original_created_at||r.stage_started_at;
    const diff = Math.floor((new Date()-new Date(regDate))/86400000);
    const left = stage.days-diff;
    return {stage,diff,left,overdue:left<=0};
  };

  // Latest partners by client
  const imports = [...new Set(partnersData.map(r=>r.import_date))].sort().reverse();
  const lastImport = imports[0];
  const latestPartners = {};
  partnersData.filter(r=>r.import_date===lastImport).forEach(r=>{ latestPartners[r.client_id]=r; });

  // Orders by client
  const ordersByClient = {};
  ordersData.forEach(o=>{ if(!ordersByClient[o.client_id]) ordersByClient[o.client_id]=[]; ordersByClient[o.client_id].push(o); });

  // Analysis data for "contactar hoje"
  const analysisData = Object.values(latestPartners).map(p=>{
    const clientOrders = (ordersByClient[p.client_id]||[]).sort((a,b)=>new Date(a.order_date)-new Date(b.order_date));
    const n = clientOrders.length;
    const lastOrderDate = n>0?new Date(clientOrders[n-1].order_date):null;
    let avgFreq = null;
    if(n>=2){const gaps=[];for(let i=1;i<n;i++)gaps.push((new Date(clientOrders[i].order_date)-new Date(clientOrders[i-1].order_date))/86400000);avgFreq=Math.round(gaps.reduce((s,g)=>s+g,0)/gaps.length);}
    const nextPredicted = (lastOrderDate&&avgFreq)?new Date(lastOrderDate.getTime()+avgFreq*86400000):null;
    return {...p,clientOrders,n,lastOrderDate,avgFreq,nextPredicted};
  });

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={T.card}>
        <p style={T.sectionTitle}>Cockpit — {today.toLocaleDateString("pt-PT",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p>
      </div>

      {gestors.map(g=>{
        // Follow-up overdue for this gestor
        const myFollowup = followupData.filter(r=>(r.gestor===g)).filter(r=>{
          const info = getInfo(r);
          return info.overdue || info.left===0;
        }).sort((a,b)=>getInfo(a).left-getInfo(b).left);

        // Contactar hoje - next 5 days for this gestor
        const toContact = analysisData.filter(p=>{
          if(p.gestor!==g||!p.nextPredicted||!p.avgFreq) return false;
          const daysUntil = Math.floor((p.nextPredicted-today)/86400000);
          return daysUntil<=5;
        }).sort((a,b)=>Math.floor((a.nextPredicted-today)/86400000)-Math.floor((b.nextPredicted-today)/86400000));

        return (
          <div key={g}>
            {isAdmin&&<p style={{...T.sectionTitle,marginBottom:10,color:C.muted,fontSize:12,textTransform:"uppercase",letterSpacing:".08em"}}>{g}</p>}

            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}}>
              {/* Follow-up pendente */}
              <div style={T.card}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <p style={{...T.sectionTitle,margin:0,flex:1}}>Follow-up pendente</p>
                  {myFollowup.length>0&&<span style={{background:"#FCEBEB",color:C.red,fontSize:11,fontWeight:500,padding:"3px 10px",borderRadius:20}}>{myFollowup.length}</span>}
                </div>
                {myFollowup.length===0?<p style={{fontSize:12,color:C.muted,textAlign:"center",padding:"1rem 0"}}>Sem pendências hoje 🎉</p>:
                myFollowup.map(r=>{
                  const info = getInfo(r);
                  return (
                    <div key={r.id} style={{padding:"8px 0",borderBottom:`0.5px solid ${C.border}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                        <span style={{fontSize:13,fontWeight:500,color:C.text,flex:1}}>ID: {r.client_id}</span>
                        <span style={{fontSize:11,padding:"2px 7px",borderRadius:20,background:"#E1F5EE",color:"#085041"}}>{info.stage.label}</span>
                        <span style={{fontSize:11,fontWeight:500,color:info.overdue?C.red:"#D97706"}}>
                          {info.overdue?`${Math.abs(info.left)}d em atraso`:"expira hoje"}
                        </span>
                      </div>
                      <p style={{fontSize:11,color:C.muted,margin:0}}>{r.programme} · {r.market}</p>
                    </div>
                  );
                })}
              </div>

              {/* Contactar hoje */}
              <div style={T.card}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <p style={{...T.sectionTitle,margin:0,flex:1}}>Contactar nos próximos 5 dias</p>
                  {toContact.length>0&&<span style={{background:"#EFF6FF",color:"#1D4ED8",fontSize:11,fontWeight:500,padding:"3px 10px",borderRadius:20}}>{toContact.length}</span>}
                </div>
                {toContact.length===0?<p style={{fontSize:12,color:C.muted,textAlign:"center",padding:"1rem 0"}}>Nenhum para esta semana</p>:
                toContact.map(p=>{
                  const daysUntil = Math.floor((p.nextPredicted-today)/86400000);
                  const prodCount = {};
                  p.clientOrders.forEach(o=>{ (o.products||"").split("+").forEach(pr=>{ const t=pr.trim(); if(t) prodCount[t]=(prodCount[t]||0)+1; }); });
                  const topProd = Object.entries(prodCount).sort((a,b)=>b[1]-a[1])[0]?.[0]||"—";
                  return (
                    <div key={p.client_id} style={{padding:"8px 0",borderBottom:`0.5px solid ${C.border}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                        <span style={{fontSize:13,fontWeight:500,color:C.text,flex:1}}>{p.partner_name||"—"}</span>
                        <span style={{fontSize:11,fontWeight:500,color:daysUntil<=0?C.red:daysUntil<=2?"#D97706":C.green}}>
                          {daysUntil<=0?"hoje":daysUntil===1?"amanhã":`em ${daysUntil} dias`}
                        </span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                        <span style={{fontSize:11,color:C.muted}}>ID: {p.client_id}</span>
                        <button onClick={()=>navigator.clipboard.writeText(p.client_id)}
                          style={{fontSize:10,padding:"1px 6px",border:`0.5px solid ${C.border}`,borderRadius:4,background:"transparent",color:C.muted,cursor:"pointer"}}>
                          ⊕ Copiar
                        </button>
                      </div>
                      <p style={{fontSize:11,color:C.muted,margin:0}}>💊 {topProd}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── PerformanceTab ────────────────────────────────────────────────────────────
function PerformanceTab({ year, month, isAdmin, currentTeam }) {
  const [perfTab, setPerfTab] = useState("registo");
  const [monthData, setMonthData] = useState({ team_goals:{} });
  const [histData, setHistData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [partnersCount, setPartnersCount] = useState(0);
  const [partnersData, setPartnersData] = useState([]);
  const [perfTeam, setPerfTeam] = useState(currentTeam||"equipa_fr");

  useEffect(()=>{ setPerfTeam(currentTeam||"equipa_fr"); },[currentTeam]);

  useEffect(()=>{
    setLoading(true);
    // Load current month + last 12 months for YoY and trend
    const keys = [];
    for (let i=0;i<=12;i++){
      const d = new Date(year, month-i, 1);
      keys.push(monthKey(d.getFullYear(), d.getMonth()));
    }
    const teamObj = TEAMS.find(t=>t.key===perfTeam);
    const markets = teamObj?.dashboardMarkets || teamObj?.markets || [];
    Promise.all([
      supabase.from("billing_months").select("team_goals").eq("month_key", monthKey(year,month)).eq("team", perfTeam).maybeSingle(),
      supabase.from("billing_months").select("month_key,team_goals").in("month_key", keys).eq("team", perfTeam),
      // Load partners detail for current month
      supabase.from("partner_followup").select("market,programme")
        .gte("original_created_at", new Date(year,month,1).toISOString())
        .lte("original_created_at", new Date(year,month+1,0,23,59,59).toISOString())
        .neq("status","deleted")
        .in("market", markets)
        .limit(5000),
    ]).then(([curr, hist, partners])=>{
      setMonthData(curr.data || { team_goals:{} });
      setHistData(hist.data || []);
      const pd = partners.data || [];
      setPartnersCount(pd.length);
      setPartnersData(pd);
      setLoading(false);
    });
  },[year, month, perfTeam]);

  const save = async (newGoals) => {
    const key = monthKey(year, month);
    const merged = { ...monthData.team_goals, ...newGoals };
    await supabase.from("billing_months").upsert({ month_key:key, team:perfTeam, team_goals:merged }, { onConflict:"month_key,team" });
    setMonthData(prev=>({...prev, team_goals:merged}));
  };

  const goals = monthData.team_goals || {};
  const inp = (field, label) => (
    <div>
      <p style={{fontSize:12,color:C.muted,margin:"0 0 6px"}}>{label}</p>
      <input type="number" value={goals[field]??""} placeholder="0"
        onChange={e=>setMonthData(prev=>({...prev,team_goals:{...prev.team_goals,[field]:e.target.value}}))}
        onBlur={()=>save({[field]:goals[field]})}
        style={{width:"100%",boxSizing:"border-box",padding:"9px 12px",border:`0.5px solid ${C.border}`,borderRadius:8,fontSize:14,background:C.bg,color:C.text,outline:"none"}} />
    </div>
  );

  const leads = Number(goals.perf_leads)||0;
  const leadsAng = Number(goals.perf_leads_ang)||0;
  const leadsSem = Number(goals.perf_leads_sem)||0;
  const prospects = Number(goals.perf_prospects)||0;
  const convRate = leads>0?(prospects/leads*100).toFixed(1):0;
  const angPct = leads>0?(leadsAng/leads*100).toFixed(1):0;

  // YoY comparison
  const prevYearKey = monthKey(year-1, month);
  const prevYearData = histData.find(d=>d.month_key===prevYearKey)?.team_goals||{};
  const prevLeads = Number(prevYearData.perf_leads)||0;
  const prevProspects = Number(prevYearData.perf_prospects)||0;
  const leadsYoY = prevLeads>0?((leads-prevLeads)/prevLeads*100).toFixed(1):null;
  const prospectsYoY = prevProspects>0?((prospects-prevProspects)/prevProspects*100).toFixed(1):null;

  // Last 6 months trend with partners count
  const [trendPartners, setTrendPartners] = useState({});
  useEffect(()=>{
    const teamObj = TEAMS.find(t=>t.key===perfTeam);
    const markets = teamObj?.dashboardMarkets || teamObj?.markets || [];
    const promises = [];
    for (let i=0;i<=5;i++){
      const d = new Date(year, month-i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
      const end = new Date(d.getFullYear(), d.getMonth()+1, 0, 23, 59, 59).toISOString();
      const k = monthKey(d.getFullYear(), d.getMonth());
      promises.push(
        supabase.from("partner_followup").select("*",{count:"exact",head:true})
          .gte("original_created_at", start).lte("original_created_at", end)
          .neq("status","deleted").in("market", markets)
          .then(({count})=>({key:k, count:count||0}))
      );
    }
    Promise.all(promises).then(results=>{
      const map = {};
      results.forEach(r=>{ map[r.key]=r.count; });
      setTrendPartners(map);
    });
  },[year, month, perfTeam]);

  const trend = [];
  for (let i=5;i>=0;i--){
    const d = new Date(year, month-i, 1);
    const k = monthKey(d.getFullYear(), d.getMonth());
    const g = histData.find(h=>h.month_key===k)?.team_goals||{};
    trend.push({
      label: MONTH_NAMES[d.getMonth()].slice(0,3)+" "+d.getFullYear(),
      leads: Number(g.perf_leads)||0,
      prospects: Number(g.perf_prospects)||0,
      partners: trendPartners[k]||0,
    });
  }

  if (loading) return <div style={{padding:"2rem",color:C.muted,fontSize:13}}>A carregar...</div>;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Header */}
      <div style={{...T.card,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <p style={{...T.sectionTitle,margin:0,flex:1}}>Performance — {MONTH_NAMES[month]} {year}</p>
        <div style={{display:"flex",gap:6}}>
          {TEAMS.map(t=>(
            <button key={t.key} onClick={()=>setPerfTeam(t.key)}
              style={{padding:"5px 12px",borderRadius:20,fontSize:12,border:`0.5px solid ${C.border}`,cursor:"pointer",
                background:perfTeam===t.key?C.green:"transparent",color:perfTeam===t.key?"#fff":C.muted}}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{display:"flex",gap:6}}>
          {[{id:"registo",l:"Registo"},{id:"analise",l:"Análise"}].map(t=>(
            <button key={t.id} onClick={()=>setPerfTab(t.id)}
              style={{padding:"5px 12px",borderRadius:20,fontSize:12,border:`0.5px solid ${C.border}`,cursor:"pointer",
                background:perfTab===t.id?"#6366F1":"transparent",color:perfTab===t.id?"#fff":C.muted}}>
              {t.l}
            </button>
          ))}
        </div>
      </div>

      {/* Registo */}
      {perfTab==="registo"&&(
        <div style={T.card}>
          <p style={{...T.sectionTitle,marginBottom:14}}>Registo — {MONTH_NAMES[month]} {year} · {TEAMS.find(t=>t.key===perfTeam)?.label}</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12}}>
            {inp("perf_leads","Leads recebidos")}
            {inp("perf_leads_ang","Leads com angariador")}
            {inp("perf_leads_sem","Leads sem angariador")}
            {inp("perf_prospects","Leads de prospeção (outbound)")}
          </div>
        </div>
      )}

      {/* Análise */}
      {perfTab==="analise"&&<>
        {/* KPI cards */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:10}}>
          {[
            {label:"Leads recebidos",value:leads,diff:leadsYoY,color:C.text},
            {label:"Com angariador",value:leadsAng,sub:`${angPct}% do total`,color:C.text},
            {label:"Sem angariador",value:leadsSem,sub:`${leads>0?((leadsSem/leads)*100).toFixed(1):0}% do total`,color:C.text},
            {label:"Leads prospeção (outbound)",value:prospects,diff:prospectsYoY,color:C.green},
          ].map((s,i)=>(
            <div key={i} style={T.card}>
              <p style={T.label}>{s.label}</p>
              <p style={{fontSize:24,fontWeight:500,color:s.color,margin:"4px 0"}}>{s.value}</p>
              {s.diff!=null&&<p style={{fontSize:11,color:Number(s.diff)>=0?C.green:C.red,margin:0}}>{Number(s.diff)>=0?"+":""}{s.diff}% vs. ano anterior</p>}
              {s.sub&&<p style={{fontSize:11,color:C.muted,margin:0}}>{s.sub}</p>}
            </div>
          ))}
        </div>

        {/* Leads quality */}
        <div style={T.card}>
          <p style={{...T.sectionTitle,marginBottom:10}}>Origem dos leads recebidos</p>
          <div style={{display:"flex",gap:4,margin:"8px 0",height:16,borderRadius:8,overflow:"hidden"}}>
            <div style={{flex:leadsAng||0,background:C.green,transition:"flex .3s"}} />
            <div style={{flex:leadsSem||0,background:C.muted,transition:"flex .3s"}} />
          </div>
          <div style={{display:"flex",gap:24,fontSize:13,marginTop:8}}>
            <span style={{color:C.green}}>● Com angariador — {leadsAng} ({angPct}%)</span>
            <span style={{color:C.muted}}>● Sem angariador — {leadsSem} ({leads>0?((leadsSem/leads)*100).toFixed(1):0}%)</span>
          </div>
        </div>

        {/* Conversion rate */}
        {(leads+prospects)>0&&partnersCount>0&&<div style={T.card}>
          <p style={{...T.sectionTitle,marginBottom:8}}>Taxa de conversão — total leads → novos parceiros</p>
          <p style={{fontSize:32,fontWeight:500,color:C.green,margin:"8px 0 4px"}}>{(partnersCount/(leads+prospects)*100).toFixed(1)}%</p>
          <p style={{fontSize:12,color:C.muted,margin:0}}>{partnersCount} novos parceiros de {leads+prospects} leads totais ({leads} recebidos + {prospects} prospeção)</p>
        </div>}

        {/* Por programa e por mercado */}
        {/* Por gestor */}
        {partnersData.length>0&&(()=>{
          const teamGestors = TEAMS.find(t=>t.key===perfTeam)?.gestors||[];
          if (!teamGestors.length) return null;
          return <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(teamGestors.length,3)},minmax(0,1fr))`,gap:10}}>
            {teamGestors.map(g=>{
              const n = partnersData.filter(p=>p.gestor===g).length;
              const byProg = {};
              partnersData.filter(p=>p.gestor===g).forEach(p=>{ byProg[p.programme]=(byProg[p.programme]||0)+1; });
              return <div key={g} style={T.card}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <p style={{...T.sectionTitle,margin:0,flex:1}}>{g}</p>
                  <span style={{fontSize:12,fontWeight:500,color:C.text}}>{n} parceiros</span>
                </div>
                {["Elite","Professionals","Pro Gym","Pro Box","Pro Teams","Performance","Horeca","Corporate"].map(prog=>{
                  const pn=byProg[prog]||0;
                  if(!pn) return null;
                  return <div key={prog} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0"}}>
                    <span style={{fontSize:12,color:C.text,flex:1}}>{prog}</span>
                    <span style={{fontSize:12,fontWeight:500,color:C.text}}>{pn}</span>
                    <span style={{fontSize:11,color:C.muted,minWidth:36,textAlign:"right"}}>{n>0?(pn/n*100).toFixed(0):0}%</span>
                  </div>;
                })}
                {n===0&&<p style={{fontSize:12,color:C.muted,textAlign:"center",padding:"1rem 0"}}>Sem registos</p>}
              </div>;
            })}
          </div>;
        })()}

        {partnersData.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}}>
          <div style={T.card}>
            <p style={{...T.sectionTitle,marginBottom:10}}>Novos parceiros por programa</p>
            {["Elite","Professionals","Pro Gym","Pro Box","Pro Teams","Performance","Horeca","Corporate"].map(prog=>{
              const n = partnersData.filter(p=>p.programme===prog).length;
              if (!n) return null;
              const pct = (n/partnersCount*100).toFixed(1);
              return <div key={prog} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"0.5px solid "+C.border}}>
                <span style={{fontSize:13,color:C.text,flex:1}}>{prog}</span>
                <span style={{fontSize:13,fontWeight:500,color:C.text}}>{n}</span>
                <span style={{fontSize:11,color:C.muted,minWidth:40,textAlign:"right"}}>{pct}%</span>
              </div>;
            })}
          </div>
          <div style={T.card}>
            <p style={{...T.sectionTitle,marginBottom:10}}>Novos parceiros por mercado</p>
            {Object.entries(partnersData.reduce((acc,p)=>{ acc[p.market]=(acc[p.market]||0)+1; return acc; },{}))
              .sort((a,b)=>b[1]-a[1]).map(([mkt,n])=>{
              const pct = (n/partnersCount*100).toFixed(1);
              return <div key={mkt} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"0.5px solid "+C.border}}>
                <span style={{fontSize:13,color:C.text,flex:1}}>{MKT_LABELS[mkt]||mkt}</span>
                <span style={{fontSize:13,fontWeight:500,color:C.text}}>{n}</span>
                <span style={{fontSize:11,color:C.muted,minWidth:40,textAlign:"right"}}>{pct}%</span>
              </div>;
            })}
          </div>
        </div>}

        {/* Trend table */}
        <div style={T.card}>
          <p style={{...T.sectionTitle,marginBottom:10}}>Evolução — últimos 6 meses</p>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr style={{borderBottom:`0.5px solid ${C.border}`}}>
              {["Mês","Leads recebidos","Leads prospeção","Novos parceiros"].map((h,i)=>(
                <th key={i} style={{padding:"7px 10px",textAlign:i===0?"left":"right",color:C.muted,fontWeight:500,fontSize:11,textTransform:"uppercase"}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {trend.map((t,i)=>(
                <tr key={i} style={{borderBottom:`0.5px solid ${C.card}`,fontWeight:i===trend.length-1?500:400}}>
                  <td style={{padding:"8px 10px",color:C.text}}>{t.label}</td>
                  <td style={{padding:"8px 10px",textAlign:"right",color:C.text}}>{t.leads||"—"}</td>
                  <td style={{padding:"8px 10px",textAlign:"right",color:C.text}}>{t.prospects||"—"}</td>
                  <td style={{padding:"8px 10px",textAlign:"right",color:C.green}}>{t.partners||"—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>}
    </div>
  );
}

// ── AnaliseFollowup (embedded in Follow-up tab) ────────────────────────────────
function AnaliseFollowup({ year, month, isAdmin, role=null }) {
  const [periodo, setPeriodo] = useState("mes");
  const defaultTeam = role?.followupTeam || (isAdmin ? "global" : "equipa_fr");
  const [analiseTeam, setAnaliseTeam] = useState(defaultTeam);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const progs = ["Elite","Professionals","Pro Gym","Pro Box","Pro Teams","Performance","Horeca","Corporate"];
  const gestors = ["Antony","Fabien","Mónica","Kamila Barros","Catarina Monteiro","Bruno Vieira","Jose Castillo","Mariana Lopes","Guilherme Mendes","Ines Anjo","Daniel Silva","Margarida Pinheiro","Abilio Morais","Beatriz Beato","Telma Barroso","Pedro Oliveira"];

  useEffect(()=>{
    setLoading(true);
    const pad = n => String(n).padStart(2,"0");
    const lastDay = new Date(year,month+1,0).getDate();
    let start, end;
    if (periodo==="mes") {
      start = `${year}-${pad(month+1)}-01T00:00:00.000Z`;
      end = `${year}-${pad(month+1)}-${pad(lastDay)}T23:59:59.999Z`;
    } else {
      const sm = month-2 < 0 ? month+10 : month-2;
      const sy = month-2 < 0 ? year-1 : year;
      start = `${sy}-${pad(sm+1)}-01T00:00:00.000Z`;
      end = `${year}-${pad(month+1)}-${pad(lastDay)}T23:59:59.999Z`;
    }
    let q = supabase.from("partner_followup")
      .select("gestor,programme,status,stage,market,original_created_at", { count:"exact" })
      .gte("original_created_at", start)
      .lte("original_created_at", end)
      .neq("status","deleted");
    // Filter by selected team
    if (analiseTeam !== "global") {
      const teamObj = TEAMS.find(t=>t.key===analiseTeam);
      if (teamObj) q = q.in("market", teamObj.markets);
    }
    q.range(0, 4999).then(({data:rows})=>{ setData(rows||[]); setLoading(false); });
  },[year,month,periodo,analiseTeam]);

  if (loading) return <div style={{padding:"2rem",color:C.muted,fontSize:13}}>A carregar...</div>;

  const byProg = {}, byGestor = {}, byMkt = {};
  gestors.forEach(g=>{ byGestor[g]={total:0,progs:{}}; });
  data.forEach(r=>{
    const p = r.programme||"—";
    byProg[p]=(byProg[p]||0)+1;
    const g = r.gestor||"—";
    if (!byGestor[g]) byGestor[g]={total:0,progs:{}};
    byGestor[g].total++;
    byGestor[g].progs[p]=(byGestor[g].progs[p]||0)+1;
    const m = r.market||"—";
    byMkt[m]=(byMkt[m]||0)+1;
  });

  const totalAll = data.length;
  const verified = data.filter(r=>r.status==="bought"||r.status==="closed"||r.stage==="s60"||r.stage==="s90");
  const verifiedBought = verified.filter(r=>r.status==="bought").length;
  const verifiedNotBought = verified.filter(r=>r.status!=="bought").length;
  const stillInS30 = data.filter(r=>r.stage==="s30"&&r.status==="pending").length;
  const periodoLabel = periodo==="mes" ? `${MONTH_NAMES[month]} ${year}` : `${MONTH_NAMES[(month-2+12)%12]} — ${MONTH_NAMES[month]} ${year}`;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{...T.card,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <p style={{...T.sectionTitle,margin:0,flex:1}}>Análise — {periodoLabel}</p>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {/* Team selector */}
          {[{id:"global",l:"Geral"},...(isAdmin?TEAMS:[TEAMS.find(t=>t.key===(role?.followupTeam||"equipa_fr"))].filter(Boolean))].map(t=>(
            <button key={t.id||t.key} onClick={()=>setAnaliseTeam(t.id||t.key)}
              style={{padding:"4px 10px",borderRadius:20,fontSize:12,border:`0.5px solid ${C.border}`,cursor:"pointer",
                background:analiseTeam===(t.id||t.key)?"#6366F1":"transparent",color:analiseTeam===(t.id||t.key)?"#fff":C.muted}}>
              {t.l||t.label}
            </button>
          ))}
          <div style={{width:1,height:16,background:C.border,alignSelf:"center"}} />
          {[{id:"mes",l:"Mês atual"},{id:"3meses",l:"Últimos 3 meses"}].map(p=>(
            <button key={p.id} onClick={()=>setPeriodo(p.id)}
              style={{padding:"5px 12px",borderRadius:20,fontSize:12,border:`0.5px solid ${C.border}`,cursor:"pointer",
                background:periodo===p.id?C.green:"transparent",color:periodo===p.id?"#fff":C.muted}}>
              {p.l}
            </button>
          ))}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:periodo==="3meses"?"repeat(3,minmax(0,1fr))":"repeat(1,minmax(0,1fr))",gap:10}}>
        <div style={T.card}>
          <p style={T.label}>Total novos parceiros</p>
          <p style={{fontSize:24,fontWeight:500,color:C.text,margin:"4px 0"}}>{totalAll}</p>
        </div>
        {periodo==="3meses"&&<>
          <div style={T.card}>
            <p style={T.label}>Com 1ª compra</p>
            <p style={{fontSize:24,fontWeight:500,color:C.green,margin:"4px 0"}}>{verifiedBought}</p>
            <p style={{fontSize:11,color:C.muted,margin:0}}>{verified.length>0?(verifiedBought/verified.length*100).toFixed(1):0}% de conversão</p>
          </div>
          <div style={T.card}>
            <p style={T.label}>Sem 1ª compra</p>
            <p style={{fontSize:24,fontWeight:500,color:C.red,margin:"4px 0"}}>{verifiedNotBought}</p>
            <p style={{fontSize:11,color:C.muted,margin:0}}>{stillInS30>0?`${stillInS30} ainda em avaliação`:"todos verificados"}</p>
          </div>
        </>}
      </div>

      <div style={T.card}>
        <p style={{...T.sectionTitle,marginBottom:10}}>Por programa</p>
        {progs.map(p=>{
          const n=byProg[p]||0;
          if(n===0) return null;
          const pct=totalAll>0?(n/totalAll*100).toFixed(1):0;
          const bought=periodo==="3meses"?verified.filter(r=>r.programme===p&&r.status==="bought").length:null;
          const verifiedProg=periodo==="3meses"?verified.filter(r=>r.programme===p).length:0;
          const convPct=verifiedProg>0?(bought/verifiedProg*100).toFixed(0):null;
          return (
            <div key={p} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"0.5px solid "+C.border}}>
              <span style={{fontSize:13,color:C.text,flex:1}}>{p}</span>
              <span style={{fontSize:13,fontWeight:500,color:C.text}}>{n}</span>
              {periodo==="3meses"?<span style={{fontSize:11,color:C.green,minWidth:80,textAlign:"right"}}>{bought} compraram ({convPct}%)</span>
              :<span style={{fontSize:11,color:C.muted,minWidth:40,textAlign:"right"}}>{pct}%</span>}
            </div>
          );
        })}
        {totalAll===0&&<p style={{fontSize:12,color:C.muted,textAlign:"center",padding:"1rem 0"}}>Sem registos</p>}
      </div>

      <div style={T.card}>
        <p style={{...T.sectionTitle,marginBottom:10}}>Por mercado</p>
        {Object.entries(byMkt).sort((a,b)=>b[1]-a[1]).map(([mkt,n])=>{
          const pct=totalAll>0?(n/totalAll*100).toFixed(1):0;
          return (
            <div key={mkt} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"0.5px solid "+C.border}}>
              <span style={{fontSize:13,color:C.text,flex:1}}>{MKT_LABELS[mkt]||mkt}</span>
              <span style={{fontSize:13,fontWeight:500,color:C.text}}>{n}</span>
              <span style={{fontSize:11,color:C.muted,minWidth:40,textAlign:"right"}}>{pct}%</span>
            </div>
          );
        })}
        {totalAll===0&&<p style={{fontSize:12,color:C.muted,textAlign:"center",padding:"1rem 0"}}>Sem registos</p>}
      </div>

      {(()=>{
        // Show gestor cards: admin sees all, Pedro sees his team, others see none
        const naGestors = ["Pedro Oliveira","Telma Barroso","Beatriz Beato"];
        const showGestorCards = isAdmin || (role?.followupTeam==="equipa_na");
        const visibleGestors = isAdmin ? gestors : naGestors;
        if (!showGestorCards || periodo!=="mes") return null;
        return <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:10}}>
          {visibleGestors.map(g=>{
          const gd=byGestor[g]||{total:0,progs:{}};
          return (
            <div key={g} style={T.card}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                <p style={{...T.sectionTitle,margin:0,flex:1}}>{g}</p>
                <span style={{fontSize:12,fontWeight:500,color:C.text}}>{gd.total} parceiros</span>
              </div>
              {progs.map(p=>{
                const n=gd.progs[p]||0;
                if(n===0) return null;
                const pct=gd.total>0?(n/gd.total*100).toFixed(0):0;
                return (
                  <div key={p} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0"}}>
                    <span style={{fontSize:12,color:C.text,flex:1}}>{p}</span>
                    <span style={{fontSize:12,fontWeight:500,color:C.text}}>{n}</span>
                    <span style={{fontSize:11,color:C.muted,minWidth:36,textAlign:"right"}}>{pct}%</span>
                  </div>
                );
              })}
              {gd.total===0&&<p style={{fontSize:12,color:C.muted,textAlign:"center",padding:"1rem 0"}}>Sem registos</p>}
            </div>
          );
        })}
      </div>;
      })()}
    </div>
  );
}

// ── ResultadosTab ──────────────────────────────────────────────────────────────
const PROGS_RES = ["Elite","Professionals","Pro Gym","Pro Box","Pro Teams","Performance","Horeca","Corporate"];
const MKT_RES_LIST = [{key:"FR",label:"França"},{key:"CH",label:"Suíça"},{key:"BNL",label:"Benelux"},{key:"DEAT",label:"DE-AT"}];

function ResultadosTab({ year, month, partnersCount, currentTeam="equipa_fr" }) {
  const [curr, setCurr] = useState(null);
  const [prev, setPrev] = useState(null);
  const [partnersPrev, setPartnersPrev] = useState(0);
  const [partnersCurrData, setPartnersCurrData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [prevNextData, setPrevNextData] = useState(null);
  const [explModal, setExplModal] = useState(null);
  const [mktTab, setMktTab] = useState("global");
  const prevYear = year-1;
  const nextMonth = month===11?0:month+1;
  const nextYear2 = month===11?year+1:year;

  useEffect(()=>{
    setLoading(true);
    Promise.all([
      loadMonthData(year, month, currentTeam),
      loadMonthData(prevYear, month, currentTeam),
      loadPartnersCount(prevYear, month, currentTeam),
      loadPartnersByMktProg(year, month, currentTeam),
    ]).then(([c,p,pp,pc])=>{
      setCurr(c); setPrev(p);
      setPartnersPrev(pp||0);
      setPartnersCurrData(pc||[]);
      setLoading(false);
    });
  },[year,month,currentTeam]);
  useEffect(()=>{ if(prevYear&&nextMonth!=null) loadMonthData(prevYear, nextMonth).then(setPrevNextData); },[prevYear, nextMonth]);

  if (loading) return <div style={{padding:"2rem",color:C.muted,fontSize:13}}>A carregar...</div>;

  const cg = curr?.team_goals||{};
  const pg = prev?.team_goals||{};
  const ce = curr?.entries||{};
  const pe = prev?.entries||{};
  const totalDaysCurr = daysInMonth(year,month);
  const totalDaysPrev = daysInMonth(prevYear,month);
  const dailyCurr = buildDaily(ce, totalDaysCurr, year, month, currentTeam);
  const dailyPrev = buildDaily(pe, totalDaysPrev, prevYear, month, currentTeam);

  // Helper: get last known cumul value for a daily field from entries
  const getLastDailyCumul = (entries, totalDays, field) => {
    let last = 0;
    for (let d = totalDays; d >= 1; d--) {
      const v = entries[d]?.[field];
      if (v !== undefined && v !== "") { last = Number(v)||0; break; }
    }
    return last;
  };

  // Orders and afiliacao from daily entries
  const getTeamOrdersCumul = (entries, totalDays, team, mkts) =>
    mkts.reduce((s, mkt) => s + getLastDailyCumul(entries, totalDays, `orders_total_d_${mkt}`), 0);
  const getTeamFirst1Cumul = (entries, totalDays, team, mkts) =>
    mkts.reduce((s, mkt) => s + getLastDailyCumul(entries, totalDays, `orders_first_d_${mkt}`), 0);
  const getTeamAfilCumul = (entries, totalDays, team, mkts) =>
    mkts.reduce((s, mkt) => s + getLastDailyCumul(entries, totalDays, `afil_d_${mkt}`), 0);
  const naSecondaryMkts = ["SK","GR","CY","PL"];
  const fatCurrBase = dailyCurr.length>0 ? dailyCurr[totalDaysCurr-1]?.cumul||0 : 0;
  const fatPrevBase = dailyPrev.length>0 ? dailyPrev[totalDaysPrev-1]?.cumul||0 : 0;
  const fatCurrSecondary = currentTeam==="equipa_na" ? naSecondaryMkts.reduce((s,mk)=>s+(Number(cg["fat_"+mk])||0),0) : 0;
  const fatPrevSecondary = currentTeam==="equipa_na" ? naSecondaryMkts.reduce((s,mk)=>s+(Number(pg["fat_"+mk])||0),0) : 0;
  const fatCurr = fatCurrBase + fatCurrSecondary;
  const fatPrev = fatPrevBase + fatPrevSecondary;

  const sumMkts = (prefix, g, mkts) => mkts.reduce((s,mk)=>s+(Number(g[prefix+"_"+mk])||0),0);
  const getMkts = (y,m) => {
    const team = currentTeam || "equipa_fr";
    if (team === "equipa_it") return ["IT"];
    if (team === "equipa_es") return ["ES"];
    if (team === "equipa_pt") return ["PT","OTHER"];
    if (team === "equipa_na") return ["NA","CZ"]; // SK,GR,CY,PL stored monthly in team_goals as fat_SK etc.
    return isNewStructure(y,m) ? ["FR","CH","BNL","DEAT"] : ["FR","CH-BNL-DEAT"];
  };
  const currMkts = getMkts(year,month);
  const prevMkts = getMkts(prevYear,month);
  const encCurr = sumMkts("orders_total", cg, currMkts);
  const enc1Curr = sumMkts("orders_first", cg, currMkts);
  const afilCurr = sumMkts("afil", cg, currMkts);
  const encPrev = sumMkts("orders_total", pg, prevMkts);
  const enc1Prev = sumMkts("orders_first", pg, prevMkts);
  const afilPrev = sumMkts("afil", pg, prevMkts);
  const getMargem = (g,y,m) => { const mkts=getMkts(y,m); const vs=mkts.map(k=>Number(g["margin_pct_"+k])||0).filter(v=>v>0); return vs.length>0?(vs.reduce((s,v)=>s+v,0)/vs.length).toFixed(1):null; };
  const margemCurr = getMargem(cg,year,month);
  const margemPrev = getMargem(pg,prevYear,month);
  const ticketCurr = encCurr>0 ? Math.round(fatCurr/encCurr) : null;
  const ticketPrev = encPrev>0 ? Math.round(fatPrev/encPrev) : null;
  // 1ªs compras from daily entries (like Dashboard)
  const newStructCurr = isNewStructure(year,month);
  const newStructPrev = isNewStructure(prevYear,month);
  const dailyFirstCurr = buildDailyFirstRev(ce, totalDaysCurr, newStructCurr, currentTeam);
  const dailyFirstPrev = buildDailyFirstRev(pe, totalDaysPrev, newStructPrev, currentTeam);
  const fat1Curr = dailyFirstCurr.length>0 ? dailyFirstCurr[totalDaysCurr-1]?.cumul||0 : 0;
  const fat1Prev = dailyFirstPrev.length>0 ? dailyFirstPrev[totalDaysPrev-1]?.cumul||0 : 0;
  const ticket1Curr = enc1Curr>0 ? Math.round(fat1Curr/enc1Curr) : null;
  const ticket1Prev = enc1Prev>0 ? Math.round(fat1Prev/enc1Prev) : null;
  const revendaAfilCurr = (fatCurr||0)+(afilCurr||0);
  const revendaAfilPrev = (fatPrev||0)+(afilPrev||0);
  const pctVar = (c,p) => p>0 ? ((c-p)/p*100).toFixed(1) : null;
  const varEl = (c,p) => {
    if (c==null||p==null||p===0) return <span style={{color:C.muted,fontSize:12}}>—</span>;
    const up=c>=p;
    return <span style={{fontSize:12,fontWeight:500,color:up?C.green:C.red}}>{up?"↑":"↓"} {Math.abs(pctVar(c,p))}%</span>;
  };
  const totalPC = partnersCount||0;
  const histTotal = Number(pg["hist_partners_total"])||0;
  const totalPP = partnersPrev > 0 ? partnersPrev : histTotal;

  // Breakdown by market and programme
  const byMkt={}, byProg={};
  partnersCurrData.forEach(p=>{ byMkt[p.market]=(byMkt[p.market]||0)+1; byProg[p.programme]=(byProg[p.programme]||0)+1; });
  const byMktPrev = {};
  const byProgPrev = {};
  ["FR","CH","BNL","DEAT"].forEach(k=>{ const v=Number(pg[`hist_partners_mkt_${k}`])||0; if(v>0) byMktPrev[k]=v; });
  ["Elite","Professionals","Pro Gym","Pro Box","Pro Teams","Performance","Horeca","Corporate"].forEach(p=>{ const v=Number(pg[`hist_partners_prog_${p.replace(/ /g,"_").toLowerCase()}`])||0; if(v>0) byProgPrev[p]=v; });
  const getFatProg = g => PROGS_RES.reduce((s,p)=>s+(Number(g["fat_prog_"+p.replace(/ /g,"_").toLowerCase()])||0),0);
  const totalFatProg = getFatProg(cg);
  const dowAvg={}, dowCnt={};
  dailyCurr.filter(d=>!d.supersales&&d.dayValue>0).forEach(d=>{ if(d.dow==null)return; dowAvg[d.dow]=(dowAvg[d.dow]||0)+d.dayValue; dowCnt[d.dow]=(dowCnt[d.dow]||0)+1; });
  const tdNext = daysInMonth(nextYear2,nextMonth);
  let suggestDow = 0;
  for(let d=1;d<=tdNext;d++){ const dow=new Date(nextYear2,nextMonth,d).getDay(); suggestDow+=(dowAvg[dow]&&dowCnt[dow]?Math.round(dowAvg[dow]/dowCnt[dow]):0); }
  const growthYoY = fatPrev>0?(fatCurr-fatPrev)/fatPrev:0;
  const suggestYoY = fatPrev>0 ? Math.round(fatPrev*(1+growthYoY)) : null;
  // Seasonality: use ratio of nextMonth/currentMonth from previous year
  const fatPrevNext = (() => {
    if (!prevNextData) return 0;
    const e = prevNextData.entries||{};
    const td = daysInMonth(prevYear, nextMonth);
    const d = buildDaily(e, td, prevYear, nextMonth);
    return d.length>0 ? d[td-1]?.cumul||0 : 0;
  })();
  const seasonRatio = fatPrev>0&&fatPrevNext>0 ? fatPrevNext/fatPrev : null;
  const suggestSeason = seasonRatio!=null&&fatCurr>0 ? Math.round(fatCurr*seasonRatio) : null;
  const seasonPct = seasonRatio!=null ? ((seasonRatio-1)*100).toFixed(1) : null;

  // Market-specific data
  const newStruct = isNewStructure(year,month);
  const teamMarkets = getTeamMarkets(currentTeam, newStruct);
  const isSingleMarket = teamMarkets.length === 1;
  // For single-market teams, use that market directly; for FR show sub-tabs
  const mktList = isSingleMarket ? [] : teamMarkets;
  const getMktData = (mkt) => {
    if (mkt==="global") return {fatC:fatCurr,fatP:fatPrev,encC:encCurr,encP:encPrev,afilC:afilCurr,afilP:afilPrev,margemC:margemCurr,margemP:margemPrev,ticketC:ticketCurr,ticketP:ticketPrev,revendaAfilC:(fatCurr||0)+(afilCurr||0),revendaAfilP:(fatPrev||0)+(afilPrev||0)};
    const fatC = (() => {
      let last=0;
      for(let d=totalDaysCurr;d>=1;d--){ const e=ce[d]||{}; if(e[mkt]!==undefined){ last=Number(e[mkt])||0; break; } }
      return last;
    })();
    const fatP = (() => {
      let last=0;
      for(let d=totalDaysPrev;d>=1;d--){ const e=pe[d]||{}; if(e[mkt]!==undefined){ last=Number(e[mkt])||0; break; } }
      return last;
    })();
    const encC = Number(cg["orders_total_"+mkt])||0;
    const encP = Number(pg["orders_total_"+mkt])||0;
    const afilC = Number(cg["afil_"+mkt])||0;
    const afilP = Number(pg["afil_"+mkt])||0;
    const margemC = cg["margin_pct_"+mkt]?Number(cg["margin_pct_"+mkt]).toFixed(1):null;
    const margemP = pg["margin_pct_"+mkt]?Number(pg["margin_pct_"+mkt]).toFixed(1):null;
    const ticketC = encC>0?Math.round(fatC/encC):null;
    const ticketP = encP>0?Math.round(fatP/encP):null;
    // 1ªs compras by market
    const fat1C = (() => {
      const fkey = newStructCurr ? "first_rev_"+mkt : (mkt==="FR"?"first_rev_FR":"first_rev_CH-BNL-DEAT");
      let last=0;
      for(let d=totalDaysCurr;d>=1;d--){ const e=ce[d]||{}; if(e[fkey]!==undefined){ last=Number(e[fkey])||0; break; } }
      return last;
    })();
    const fat1P = (() => {
      const fkey = newStructPrev ? "first_rev_"+mkt : (mkt==="FR"?"first_rev_FR":"first_rev_CH-BNL-DEAT");
      let last=0;
      for(let d=totalDaysPrev;d>=1;d--){ const e=pe[d]||{}; if(e[fkey]!==undefined){ last=Number(e[fkey])||0; break; } }
      return last;
    })();
    const revendaAfilC = (fatC||0)+(afilC||0);
    const revendaAfilP = (fatP||0)+(afilP||0);
    // Partners by market — for CH-BNL-DEAT include all sub-markets
    const mktFilter = mkt==="CH-BNL-DEAT"
      ? (p) => ["CH-BNL-DEAT","CH","BNL","DEAT"].includes(p.market)
      : (p) => p.market===mkt;
    const partnersMktC = partnersCurrData.filter(mktFilter).length;
    const partnersMktPByProg = {};
    partnersCurrData.filter(mktFilter).forEach(p=>{ partnersMktPByProg[p.programme]=(partnersMktPByProg[p.programme]||0)+1; });
    const histMktP = Number(pg["hist_partners_mkt_"+mkt])||0;
    return {fatC,fatP,encC,encP,afilC,afilP,margemC,margemP,ticketC,ticketP,fat1C,fat1P,revendaAfilC,revendaAfilP,partnersMktC,partnersMktPByProg,histMktP};
  };
  const md = getMktData(mktTab);

  const Row = ({label,c,p,f=fmtEur,suf=""}) => (
    <tr style={{borderBottom:"0.5px solid "+C.border}}>
      <td style={{padding:"10px 12px",fontSize:13,color:C.text}}>{label}</td>
      <td style={{padding:"10px 12px",fontSize:13,fontWeight:500,color:C.text,textAlign:"right"}}>{c!=null?f(c)+suf:"—"}</td>
      <td style={{padding:"10px 12px",fontSize:13,color:C.muted,textAlign:"right"}}>{p!=null?f(p)+suf:"—"}</td>
      <td style={{padding:"10px 12px",textAlign:"right"}}>{varEl(c,p)}</td>
    </tr>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={T.card}>
        <p style={T.sectionTitle}>Resultados — {MONTH_NAMES[month]} {year} vs. {MONTH_NAMES[month]} {prevYear}</p>
      </div>
      <div style={T.card}>
        <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
          {isSingleMarket ? (
            <span style={{fontSize:13,fontWeight:500,color:C.green}}>{teamMarkets[0].label}</span>
          ) : [{key:"global",label:"Global"},...mktList].map(m=>(
            <button key={m.key} onClick={()=>setMktTab(m.key)}
              style={{padding:"5px 12px",borderRadius:20,fontSize:12,border:"0.5px solid "+C.border,cursor:"pointer",
                background:mktTab===m.key?C.green:"transparent",color:mktTab===m.key?"#fff":C.muted}}>
              {m.label}
            </button>
          ))}
        </div>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{borderBottom:"0.5px solid "+C.border}}>
            {["Métrica",MONTH_NAMES[month]+" "+year,MONTH_NAMES[month]+" "+prevYear,"Var. YoY"].map((h,i)=>(
              <th key={i} style={{padding:"8px 12px",textAlign:i===0?"left":"right",color:C.muted,fontWeight:500,fontSize:11,textTransform:"uppercase",letterSpacing:".05em"}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            <Row label="Faturação total" c={md.fatC||null} p={md.fatP||null} />
            <Row label="Margem" c={md.margemC?Number(md.margemC):null} p={md.margemP?Number(md.margemP):null} f={v=>v.toFixed(1)} suf="%" />
            <Row label="Nº encomendas" c={md.encC||null} p={md.encP||null} f={fmt} />
            <Row label="Ticket médio" c={md.ticketC} p={md.ticketP} />
            {mktTab==="global"?<>
              <Row label="Faturação 1ªs compras" c={fat1Curr||null} p={fat1Prev||null} />
              <Row label="Nº 1ªs encomendas" c={enc1Curr||null} p={enc1Prev||null} f={fmt} />
              <Row label="Ticket médio 1ªs compras" c={ticket1Curr} p={ticket1Prev} />
              <Row label="Novos parceiros" c={totalPC||null} p={totalPP||null} f={fmt} />
            </>:<>
              <Row label="Faturação 1ªs compras" c={md.fat1C||null} p={md.fat1P||null} />
              <Row label="Novos parceiros" c={md.partnersMktC||null} p={md.histMktP||null} f={fmt} />
            </>}
            <Row label="Afiliação" c={md.afilC||null} p={md.afilP||null} />
            <Row label="Revenda + Afiliação" c={md.revendaAfilC||null} p={md.revendaAfilP||null} />
          </tbody>
        </table>
      </div>
      {mktTab!=="global"&&md.partnersMktC>0&&(
        <div style={T.card}>
          <p style={{...T.sectionTitle,marginBottom:10}}>Novos parceiros por programa — {mktList.find(m=>m.key===mktTab)?.label}</p>
          {PROGS_RES.map(prog=>{
            const n=md.partnersMktPByProg[prog]||0;
            const pct=md.partnersMktC>0?(n/md.partnersMktC*100).toFixed(1):0;
            return n>0?<div key={prog} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"0.5px solid "+C.border}}>
              <span style={{fontSize:13,color:C.text,flex:1}}>{prog}</span>
              <span style={{fontSize:13,fontWeight:500,color:C.text}}>{n}</span>
              <span style={{fontSize:11,color:C.muted,minWidth:44,textAlign:"right"}}>{pct}%</span>
            </div>:null;
          })}
        </div>
      )}
      {mktTab==="global"&&<div style={{display:"grid",gridTemplateColumns:isSingleMarket?"repeat(1,minmax(0,1fr))":"repeat(2,minmax(0,1fr))",gap:10}}>
        {!isSingleMarket&&<div style={T.card}>
          <p style={{...T.sectionTitle,marginBottom:10}}>Novos parceiros por mercado</p>
          {getTeamMarkets(currentTeam, isNewStructure(year,month)).map(({key,label})=>{
            const n=byMkt[key]||0, p=totalPC>0?(n/totalPC*100).toFixed(1):0;
            return <div key={key} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"0.5px solid "+C.border}}>
              <span style={{fontSize:13,color:C.text,flex:1}}>{label}</span>
              <span style={{fontSize:13,fontWeight:500,color:C.text}}>{n}</span>
              <span style={{fontSize:11,color:C.muted,minWidth:44,textAlign:"right"}}>{p}%</span>
            </div>;
          })}
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",marginTop:4}}>
            <span style={{fontSize:12,color:C.muted,flex:1}}>Total</span>
            <span style={{fontSize:13,fontWeight:500,color:C.text}}>{totalPC}</span>
          </div>
        </div>}
        <div style={T.card}>
          <p style={{...T.sectionTitle,marginBottom:10}}>Novos parceiros por programa</p>
          {PROGS_RES.map(prog=>{
            const n=byProg[prog]||0, p=totalPC>0?(n/totalPC*100).toFixed(1):0;
            return <div key={prog} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"0.5px solid "+C.border}}>
              <span style={{fontSize:13,color:C.text,flex:1}}>{prog}</span>
              <span style={{fontSize:13,fontWeight:500,color:C.text}}>{n}</span>
              <span style={{fontSize:11,color:C.muted,minWidth:44,textAlign:"right"}}>{p}%</span>
            </div>;
          })}
        </div>
      </div>}
      {mktTab==="global"&&totalFatProg>0&&<div style={T.card}>
        <p style={{...T.sectionTitle,marginBottom:10}}>Faturação por programa</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:4}}>
          {PROGS_RES.map(prog=>{
            const v=Number(cg["fat_prog_"+prog.replace(/ /g,"_").toLowerCase()])||0;
            const p=totalFatProg>0?(v/totalFatProg*100).toFixed(1):0;
            return v>0?<div key={prog} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"0.5px solid "+C.border}}>
              <span style={{fontSize:13,color:C.text,flex:1}}>{prog}</span>
              <span style={{fontSize:13,fontWeight:500,color:C.text}}>{fmtEur(v)}</span>
              <span style={{fontSize:11,color:C.muted,minWidth:44,textAlign:"right"}}>{p}%</span>
            </div>:null;
          })}
        </div>
      </div>}
      {mktTab==="global"&&(()=>{
        const explanations = {
          season: {
            title:"Sazonalidade",
            body:`Compara a relação entre ${MONTH_NAMES[nextMonth]} e ${MONTH_NAMES[month]} do ano anterior.\n\n${MONTH_NAMES[nextMonth]} ${prevYear}: ${fatPrevNext>0?fmtEur(fatPrevNext):"sem dados"} / ${MONTH_NAMES[month]} ${prevYear}: ${fatPrev>0?fmtEur(fatPrev):"sem dados"}${seasonPct!=null?" = "+seasonPct+"% de variação":""}.\n\nAplica essa relação a ${MONTH_NAMES[month]} ${year} (${fmtEur(fatCurr)}).`
          },
          yoy: {
            title:"Base YoY",
            body:`Calcula o crescimento de ${MONTH_NAMES[month]} ${prevYear} para ${MONTH_NAMES[month]} ${year} (+${(growthYoY*100).toFixed(1)}%) e aplica-o a ${MONTH_NAMES[nextMonth]} ${prevYear} (${fatPrev>0?fmtEur(fatPrev):"sem dados"}).\n\nPresupõe que ${MONTH_NAMES[nextMonth]} vai crescer ao mesmo ritmo que ${MONTH_NAMES[month]}.`
          },
          dow: {
            title:"Média por dia da semana",
            body:`Para cada um dos ${tdNext} dias de ${MONTH_NAMES[nextMonth]}, usa a média histórica do dia da semana correspondente calculada com os dias de ${MONTH_NAMES[month]} ${year} (excluindo Supersales e Campanhas).\n\nSoma as médias de todos os ${tdNext} dias.`
          }
        };
        return <>
          {explModal&&<Modal title={explanations[explModal].title} subtitle="" onClose={()=>setExplModal(null)}>
            <div style={{padding:"0 1.25rem 1.25rem",fontSize:13,color:C.text,lineHeight:1.6,whiteSpace:"pre-line"}}>
              {explanations[explModal].body}
            </div>
          </Modal>}
          <div style={T.card}>
            <p style={{...T.sectionTitle,marginBottom:12}}>Sugestão objetivo — {MONTH_NAMES[nextMonth]} {nextYear2}</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:10}}>
              {[
                {id:"season",label:"Sazonalidade",value:suggestSeason,sub:seasonPct!=null?`${MONTH_NAMES[nextMonth]}/${MONTH_NAMES[month]} ${prevYear}: ${seasonPct}%`:"introduz dados de "+MONTH_NAMES[nextMonth]+" "+prevYear},
                {id:"yoy",label:"Base YoY",value:suggestYoY,sub:MONTH_NAMES[month]+" "+prevYear+" × variação atual (+"+((growthYoY||0)*100).toFixed(1)+"%)"},
                {id:"dow",label:"Média dia da semana",value:suggestDow>0?suggestDow:null,sub:tdNext+" dias em "+MONTH_NAMES[nextMonth]},
              ].map((s,i)=>(
                <div key={i} onClick={()=>setExplModal(s.id)}
                  style={{...T.card,background:C.bg,cursor:"pointer",transition:"opacity .15s"}}
                  onMouseEnter={e=>e.currentTarget.style.opacity=".8"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                  <p style={{fontSize:11,color:C.muted,margin:"0 0 6px",textTransform:"uppercase",letterSpacing:".05em"}}>{s.label}</p>
                  <p style={{fontSize:20,fontWeight:500,color:C.text,margin:"0 0 4px"}}>{s.value?fmtEur(s.value):"—"}</p>
                  <p style={{fontSize:11,color:C.muted,margin:"0 0 4px"}}>{s.sub}</p>
                  <p style={{fontSize:10,color:C.green,margin:0}}>ℹ ver explicação</p>
                </div>
              ))}
            </div>
          </div>
        </>;
      })()}
    </div>
  );
}

// ── TestesTab ─────────────────────────────────────────────────────────────────
function TestesTab({ year, month }) {
  const [periodo, setPeriodo] = useState("mes");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    setLoading(true);
    let start, end;
    const pad = n => String(n).padStart(2,"0");
    const lastDay = new Date(year,month+1,0).getDate();
    if (periodo==="mes") {
      start = `${year}-${pad(month+1)}-01T00:00:00.000Z`;
      end = `${year}-${pad(month+1)}-${pad(lastDay)}T23:59:59.999Z`;
    } else {
      const sm = month-2 < 0 ? month+10 : month-2;
      const sy = month-2 < 0 ? year-1 : year;
      start = `${sy}-${pad(sm+1)}-01T00:00:00.000Z`;
      end = `${year}-${pad(month+1)}-${pad(lastDay)}T23:59:59.999Z`;
    }
    supabase.from("partner_followup")
      .select("gestor,programme,status,stage,market,original_created_at", { count:"exact" })
      .gte("original_created_at", start)
      .lte("original_created_at", end)
      .neq("status","deleted")
      .range(0, 4999)
      .then(({data:rows})=>{
        setData(rows||[]);
        setLoading(false);
      });
  },[year,month,periodo]);

  if (loading) return <div style={{padding:"2rem",color:C.muted,fontSize:13}}>A carregar...</div>;

  const gestors = ["Antony","Fabien","Mónica","Kamila Barros","Catarina Monteiro","Bruno Vieira","Jose Castillo","Mariana Lopes","Guilherme Mendes","Ines Anjo","Daniel Silva","Margarida Pinheiro","Abilio Morais","Beatriz Beato","Telma Barroso","Pedro Oliveira"];
  const progs = ["Elite","Professionals","Pro Gym","Pro Box","Pro Teams","Performance","Horeca","Corporate"];

  // By programme
  const byProg = {};
  const byGestor = {};
  gestors.forEach(g=>{ byGestor[g]={total:0,progs:{}}; });
  data.forEach(r=>{
    const p = r.programme||"—";
    byProg[p]=(byProg[p]||0)+1;
    const g = r.gestor||"—";
    if (!byGestor[g]) byGestor[g]={total:0,progs:{}};
    byGestor[g].total++;
    byGestor[g].progs[p]=(byGestor[g].progs[p]||0)+1;
  });

  const totalAll = data.length;
  const totalBought = data.filter(r=>r.status==="bought").length;
  // Only count partners that have been verified (past 30 days): stage s60/s90 or status closed/bought
  const verified = data.filter(r=>r.status==="bought"||r.status==="closed"||r.stage==="s60"||r.stage==="s90");
  const verifiedBought = verified.filter(r=>r.status==="bought").length;
  const verifiedNotBought = verified.filter(r=>r.status!=="bought").length;
  const stillInS30 = data.filter(r=>r.stage==="s30"&&r.status==="pending").length;
  const periodoLabel = periodo==="mes" ? `${MONTH_NAMES[month]} ${year}` : `${MONTH_NAMES[(month-2+12)%12]} — ${MONTH_NAMES[month]} ${year}`;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>

      {/* Header + toggle */}
      <div style={{...T.card,display:"flex",alignItems:"center",gap:12}}>
        <p style={{...T.sectionTitle,margin:0,flex:1}}>Testes — {periodoLabel}</p>
        <div style={{display:"flex",gap:8}}>
          {[{id:"mes",l:"Mês atual"},{id:"3meses",l:"Últimos 3 meses"}].map(p=>(
            <button key={p.id} onClick={()=>setPeriodo(p.id)}
              style={{padding:"5px 12px",borderRadius:20,fontSize:12,border:`0.5px solid ${C.border}`,cursor:"pointer",
                background:periodo===p.id?C.green:"transparent",color:periodo===p.id?"#fff":C.muted}}>
              {p.l}
            </button>
          ))}
        </div>
      </div>

      {/* Resumo geral */}
      <div style={{display:"grid",gridTemplateColumns:periodo==="3meses"?"repeat(3,minmax(0,1fr))":"repeat(1,minmax(0,1fr))",gap:10}}>
        <div style={T.card}>
          <p style={T.label}>Total novos parceiros</p>
          <p style={{fontSize:24,fontWeight:500,color:C.text,margin:"4px 0"}}>{totalAll}</p>
        </div>
        {periodo==="3meses"&&<>
          <div style={T.card}>
            <p style={T.label}>Com 1ª compra</p>
            <p style={{fontSize:24,fontWeight:500,color:C.green,margin:"4px 0"}}>{verifiedBought}</p>
            <p style={{fontSize:11,color:C.muted,margin:0}}>{verified.length>0?(verifiedBought/verified.length*100).toFixed(1):0}% de conversão</p>
          </div>
          <div style={T.card}>
            <p style={T.label}>Sem 1ª compra</p>
            <p style={{fontSize:24,fontWeight:500,color:C.red,margin:"4px 0"}}>{verifiedNotBought}</p>
            <p style={{fontSize:11,color:C.muted,margin:0}}>{stillInS30>0?`${stillInS30} ainda em avaliação`:"todos verificados"}</p>
          </div>
        </>}
      </div>

      {/* Por programa */}
      <div style={T.card}>
        <p style={{...T.sectionTitle,marginBottom:10}}>Por programa</p>
        {progs.map(p=>{
          const n=byProg[p]||0;
          if(n===0) return null;
          const pct=totalAll>0?(n/totalAll*100).toFixed(1):0;
          const bought=periodo==="3meses"?verified.filter(r=>r.programme===p&&r.status==="bought").length:null;
          const verifiedProg=periodo==="3meses"?verified.filter(r=>r.programme===p).length:0;
          const convPct=verifiedProg>0?(bought/verifiedProg*100).toFixed(0):null;
          return (
            <div key={p} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"0.5px solid "+C.border}}>
              <span style={{fontSize:13,color:C.text,flex:1}}>{p}</span>
              <span style={{fontSize:13,fontWeight:500,color:C.text}}>{n}</span>
              {periodo==="3meses"?<span style={{fontSize:11,color:C.green,minWidth:80,textAlign:"right"}}>{bought} compraram ({convPct}%)</span>
              :<span style={{fontSize:11,color:C.muted,minWidth:40,textAlign:"right"}}>{pct}%</span>}
            </div>
          );
        })}
        {totalAll===0&&<p style={{fontSize:12,color:C.muted,textAlign:"center",padding:"1rem 0"}}>Sem registos</p>}
      </div>

      {/* Por gestor — só mês atual */}
      {periodo==="mes"&&<div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:10}}>
        {gestors.map(g=>{
          const gd=byGestor[g]||{total:0,progs:{}};
          return (
            <div key={g} style={T.card}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                <p style={{...T.sectionTitle,margin:0,flex:1}}>{g}</p>
                <span style={{fontSize:12,fontWeight:500,color:C.text}}>{gd.total} parceiros</span>
              </div>
              {progs.map(p=>{
                const n=gd.progs[p]||0;
                if(n===0) return null;
                const pct=gd.total>0?(n/gd.total*100).toFixed(0):0;
                return (
                  <div key={p} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0"}}>
                    <span style={{fontSize:12,color:C.text,flex:1}}>{p}</span>
                    <span style={{fontSize:12,fontWeight:500,color:C.text}}>{n}</span>
                    <span style={{fontSize:11,color:C.muted,minWidth:36,textAlign:"right"}}>{pct}%</span>
                  </div>
                );
              })}
              {gd.total===0&&<p style={{fontSize:12,color:C.muted,textAlign:"center",padding:"1rem 0"}}>Sem registos</p>}
            </div>
          );
        })}
      </div>}

    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding:"2rem", background:"#FCEBEB", borderRadius:12, color:"#791F1F", fontSize:13 }}>
        <p style={{ fontWeight:500, margin:"0 0 8px" }}>Erro ao carregar o separador</p>
        <p style={{ margin:0, fontFamily:"monospace" }}>{this.state.error.message}</p>
      </div>
    );
    return this.props.children;
  }
}

function MainApp({ role, onLogout }) {
  // role includes: name, gestor, isAdmin, canEditRegisto, registoTeam, followupTeam
  const isAdmin = role.isAdmin;
  const gestor = role.gestor;
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
  const [currentTeam, setCurrentTeam] = useState(role.registoTeam||"equipa_fr");
  useEffect(()=>{ setLoading(true); loadMonthData(year,month,currentTeam).then(d=>{ setMonthData(d); setLoading(false); }); },[year,month,currentTeam]);
  const [partnersCount, setPartnersCount] = useState(null);
  useEffect(()=>{ loadPartnersCount(year,month,currentTeam).then(setPartnersCount); },[year,month,currentTeam]);
  const monthCount = (today.getFullYear()-2025)*12 + today.getMonth() + 1;
  const monthOptions = Array.from({length:monthCount},(_,i)=>{ const d=new Date(today.getFullYear(),today.getMonth()-i,1); return { value:monthKey(d.getFullYear(),d.getMonth()), label:`${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` }; });
  return (
    <div style={{ minHeight:"100vh", background:C.bg }}>
      <div style={{ maxWidth:920, margin:"0 auto", padding:"1.25rem 1rem" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1.5rem" }}>
          <div>
            <p style={{ fontSize:20, fontWeight:500, margin:0, color:C.text }}>Resultados</p>
            <p style={{ fontSize:13, color:C.muted, margin:"3px 0 0" }}>Partners · {role.name}{isAdmin?" · Admin":""}</p>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <select value={selMonth} onChange={e=>setSelMonth(e.target.value)}
            style={{ fontSize:13, padding:"7px 12px", borderRadius:8, border:`0.5px solid ${C.border}`, background:C.bg, color:C.text, outline:"none" }}>
            {monthOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={onLogout}
              style={{ fontSize:12, padding:"6px 12px", border:`0.5px solid ${C.border}`, borderRadius:8, background:"transparent", color:C.muted, cursor:"pointer" }}>
              → Sair
            </button>
          </div>
        </div>
        <div style={{ display:"flex", borderBottom:`0.5px solid ${C.border}`, marginBottom:"1.5rem" }}>
          {[{id:"analise",l:"Dashboard",adminOnly:false},{id:"cockpit",l:"Cockpit",adminOnly:false,hidden:true},{id:"parceiros",l:"Follow-up",adminOnly:false},{id:"registo",l:"Registo",adminOnly:false},{id:"resultados",l:"Resultados",adminOnly:false},{id:"performance",l:"Performance",adminOnly:true}]
            .filter(t=>(!t.adminOnly||isAdmin)&&!t.hidden&&(t.id!=="registo"||role.canEditRegisto))
            .map(t=>(
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
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{display:"flex",gap:0,borderBottom:`0.5px solid ${C.border}`}}>
              {TEAMS.map(t=>(
                <button key={t.key} onClick={()=>setCurrentTeam(t.key)}
                  style={{padding:"7px 16px",border:"none",borderBottom:currentTeam===t.key?`2px solid ${C.green}`:"2px solid transparent",
                    background:"transparent",color:currentTeam===t.key?C.green:C.muted,fontWeight:currentTeam===t.key?500:400,fontSize:13,cursor:"pointer"}}>
                  {t.label}
                </button>
              ))}
            </div>
            <AnaliseTab year={year} month={month} totalDays={totalDays} closedDay={closedDay} entries={monthData.entries||{}} teamGoals={monthData.team_goals||{}} partnersCount={partnersCount} currentTeam={currentTeam} />
          </div>
        ):(
          <div>
            {tab==="registo" ? <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{display:"flex",gap:0,borderBottom:`0.5px solid ${C.border}`}}>
                {TEAMS.filter(t=>!role.registoTeam||t.key===role.registoTeam).map(t=>(
                  <button key={t.key} onClick={()=>setCurrentTeam(t.key)}
                    style={{padding:"7px 16px",border:"none",borderBottom:currentTeam===t.key?`2px solid ${C.green}`:"2px solid transparent",
                      background:"transparent",color:currentTeam===t.key?C.green:C.muted,fontWeight:currentTeam===t.key?500:400,fontSize:13,cursor:"pointer"}}>
                    {t.label}
                  </button>
                ))}
              </div>
              <RegistoTab year={year} month={month} totalDays={totalDays} closedDay={closedDay} monthData={monthData} setMonthData={setMonthData} currentTeam={currentTeam} setCurrentTeam={setCurrentTeam} />
            </div> : tab==="performance" ? <PerformanceTab year={year} month={month} isAdmin={isAdmin} currentTeam={currentTeam} /> : tab==="resultados" ? <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{display:"flex",gap:0,borderBottom:`0.5px solid ${C.border}`}}>
                {TEAMS.map(t=>(
                  <button key={t.key} onClick={()=>setCurrentTeam(t.key)}
                    style={{padding:"7px 16px",border:"none",borderBottom:currentTeam===t.key?`2px solid ${C.green}`:"2px solid transparent",
                      background:"transparent",color:currentTeam===t.key?C.green:C.muted,fontWeight:currentTeam===t.key?500:400,fontSize:13,cursor:"pointer"}}>
                    {t.label}
                  </button>
                ))}
              </div>
              <ResultadosTab year={year} month={month} partnersCount={partnersCount} currentTeam={currentTeam} />
            </div> : tab==="cockpit" ? <CockpitTab gestor={gestor} isAdmin={isAdmin} year={year} month={month} /> : <PartnerFollowup year={year} month={month} gestor={isAdmin?null:role.canEditRegisto?null:gestor} isAdmin={isAdmin} followupTeam={role.followupTeam} role={role} />}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [role, setRole] = useState(()=>{ try { return localStorage.getItem(GATE_KEY)==="1" ? localStorage.getItem(ROLE_KEY)||"admin" : null; } catch { return null; } });
  if (!role) return <PasswordGate onUnlock={(r)=>setRole(r)} />;
  return <MainApp role={ROLES[role]} onLogout={()=>{ try { localStorage.removeItem(GATE_KEY); localStorage.removeItem(ROLE_KEY); } catch {} setRole(null); }} />;
}
