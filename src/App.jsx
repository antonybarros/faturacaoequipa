import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";

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
  return { goal, partnerGoal, actual, expected, vsExpected, vsExpPct, dailyAvg, neededPerDay, projNoSS, projWithSS, avgNormal, avgSS, remainingDays:rem, closedDay, remaining };
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
  const mktData = MARKETS.map(m=>{ const l=daily[closedDay-1]; return {label:m.label,value:l?(m.id==="FR"?l.FR:l.CH):0,color:MARKET_COLORS[m.id]}; });
  const mktTotal = mktData.reduce((s,m)=>s+m.value,0);

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

      {/* Row 2 — parceiros */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2, minmax(0,1fr))", gap:10 }}>
        <StatCard label="Novos parceiros" value={partnersCount!=null?fmt(partnersCount):"—"}
          sub={remainingPartners!=null?(remainingPartners>0?`faltam ${fmt(remainingPartners)} para o objetivo`:"objetivo atingido!"):undefined}
          subColor={remainingPartners!=null&&remainingPartners<=0?C.green:C.muted}
          highlight={partnersCount!=null&&stats.partnerGoal>0&&partnersCount>=stats.partnerGoal} />
        <StatCard label="Objetivo de novos parceiros" value={stats.partnerGoal>0?fmt(stats.partnerGoal):"Sem objetivo"}
          sub={pctPartners!=null?`${pctPartners}% realizado em ${pctMonth}% do mês`:undefined}
          subColor={pctPartners!=null&&Number(pctPartners)<Number(pctMonth)?C.red:C.green} />
      </div>

      {/* Row 3 — projeções */}
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
          {[{c:C.green,l:String(year)},{c:"#9333ea",l:"Objetivo"}].map(({c,l})=>(
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
            <Tooltip formatter={(v,n)=>[fmtEur(v),n==="atual"?year:"Objetivo"]} labelFormatter={l=>`Dia ${l}`} contentStyle={{ borderRadius:8, border:`0.5px solid ${C.border}`, fontSize:12, background:C.bg }} />
            {closedDay>0&&closedDay<totalDays&&<ReferenceLine x={closedDay} stroke="#D3D1C7" strokeDasharray="3 3" />}
            <Line type="monotone" dataKey="atual" stroke={C.green} strokeWidth={2} dot={false} connectNulls />
            {stats.goal>0&&<Line type="monotone" dataKey="objetivo" stroke="#9333ea" strokeWidth={1.5} dot={false} strokeDasharray="6 3" />}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem" }}>
        <div style={T.card}>
          <p style={T.sectionTitle}>Faturação diária</p>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={barData} margin={{ top:4, right:4, left:0, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1EFE8" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize:9, fill:"#B4B2A9" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v=>Math.round(v/1000)+"k"} tick={{ fontSize:9, fill:"#B4B2A9" }} axisLine={false} tickLine={false} width={28} />
              <Tooltip formatter={v=>fmtEur(v)} labelFormatter={l=>`Dia ${l}`} contentStyle={{ borderRadius:8, border:`0.5px solid ${C.border}`, fontSize:11, background:C.bg }} />
              <Bar dataKey="value" radius={[3,3,0,0]} maxBarSize={18}>
                {barData.map((d,i)=><Cell key={i} fill={d.ss?"#d97706":C.green} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {barData.some(d=>d.ss)&&(
            <div style={{ display:"flex", gap:12, marginTop:8, fontSize:11, color:C.muted }}>
              <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:8, height:8, borderRadius:2, background:C.green, display:"inline-block" }}></span>Normal</span>
              <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:8, height:8, borderRadius:2, background:"#d97706", display:"inline-block" }}></span>Supersales</span>
            </div>
          )}
        </div>
        <div style={T.card}>
          <p style={T.sectionTitle}>Por mercado</p>
          {mktData.map(m=>(
            <div key={m.label} style={{ marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                <span style={{ fontSize:13, color:C.text }}>{m.label}</span>
                <span style={{ fontSize:13, fontWeight:500, color:C.text }}>{fmtEur(m.value)}{mktTotal>0?` · ${Math.round(m.value/mktTotal*100)}%`:""}</span>
              </div>
              <div style={{ height:6, background:"#E8E6E0", borderRadius:3, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${mktTotal>0?Math.round(m.value/mktTotal*100):0}%`, background:m.color, borderRadius:3 }} />
              </div>
            </div>
          ))}
          <div style={{ marginTop:12, paddingTop:10, borderTop:`0.5px solid ${C.border}`, display:"flex", justifyContent:"space-between" }}>
            <span style={{ fontSize:12, color:C.muted }}>Dias fechados</span>
            <span style={{ fontSize:13, fontWeight:500, color:C.text }}>{closedDay} / {totalDays}</span>
          </div>
        </div>
      </div>
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
            {tab==="registo"?"Separador Registo — em breve":"Separador Parceiros — em breve"}
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
