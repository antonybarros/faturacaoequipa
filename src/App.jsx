import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  Target, TrendingUp, Calendar, Euro, CheckCircle2, AlertCircle,
  Info, Lock, LogOut, Eye,
} from "lucide-react";
import { supabase, ADMIN_EMAIL } from "./supabase.js";

const TEAMS = ["PT", "IT", "ES", "FR", "CH-BNL-DEAT", "CZ", "USA", "OT"];
const SCOPES = [
  { id: "total", label: "Total" },
  { id: "PT", label: "Portugal" },
  { id: "IT", label: "Itália" },
  { id: "ES", label: "Espanha" },
  { id: "FR", label: "França" },
  { id: "CH-BNL-DEAT", label: "CH-BNL-DEAT" },
  { id: "CZ", label: "Chéquia" },
  { id: "USA", label: "USA" },
  { id: "OT", label: "Outros" },
];
// Equipas para "Análise comercial" — cada equipa agrega vários mercados
const ANALISE_TEAMS = [
  { id: "total",      label: "Total",      markets: ["PT","IT","ES","FR","CH-BNL-DEAT","CZ","USA","OT"] },
  { id: "equipa_pt",  label: "Equipa PT",  markets: ["PT","OT"] },
  { id: "equipa_it",  label: "Equipa IT",  markets: ["IT"] },
  { id: "equipa_es",  label: "Equipa ES",  markets: ["ES"] },
  { id: "equipa_fr",  label: "Equipa FR",  markets: ["FR","CH-BNL-DEAT"] },
  { id: "equipa_na",  label: "Equipa NA",  markets: ["CZ","USA"] },
];
const ANALISE_COLORS = {
  total: "#0f172a", equipa_pt: "#16a34a", equipa_it: "#2563eb",
  equipa_es: "#dc2626", equipa_fr: "#9333ea", equipa_na: "#0891b2",
};

const TEAM_COLORS = {
  PT: "#16a34a", IT: "#2563eb", ES: "#dc2626",
  FR: "#9333ea", "CH-BNL-DEAT": "#d97706",
  CZ: "#0891b2", USA: "#7c3aed", OT: "#64748b", total: "#0f172a",
};

const monthKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const fmtEur = (v) =>
  new Intl.NumberFormat("pt-PT", {
    style: "currency", currency: "EUR", maximumFractionDigits: 0,
  }).format(v || 0);
const fmtPct = (v) => `${(v || 0).toFixed(1)}%`;

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const emptyMonth = () => ({
  totalGoal: 0,
  teamGoals: { PT: 0, IT: 0, ES: 0, FR: 0, "CH-BNL-DEAT": 0, CZ: 0, USA: 0, OT: 0 },
  entries: {},
});

function MainApp() {
  const today = new Date();
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(monthKey(today));
  const [data, setData] = useState(emptyMonth());
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("analise");
  const [analiseScope, setAnaliseScope] = useState("total");
  const [scope, setScope] = useState("total");
  const [saveMsg, setSaveMsg] = useState("");
  const [annualGoal, setAnnualGoalState] = useState(0);

  const isAdmin = !!session;

  const [year, monthNum] = selectedMonth.split("-").map(Number);
  const month = monthNum - 1;
  const totalDays = daysInMonth(year, month);
  const isCurrentMonth =
    year === today.getFullYear() && month === today.getMonth();
  const isPastMonth =
    new Date(year, month + 1, 0) <
    new Date(today.getFullYear(), today.getMonth(), 1);

  let closedDay;
  if (isCurrentMonth) closedDay = today.getDate() - 1;
  else if (isPastMonth) closedDay = totalDays;
  else closedDay = 0;

  // --- Auth: listen to session changes ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setSession(s)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  // If user loses admin status, force back to a public tab
  useEffect(() => {
    if (!isAdmin && !["analise","dashboard","afiliacao","encomendas","leads","history"].includes(tab)) setTab("analise");
  }, [isAdmin, tab]);

  // --- Load annual goal when year changes ---
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const annualKey = `${year}-annual`;
      const { data: row } = await supabase
        .from("billing_months")
        .select("total_goal")
        .eq("month_key", annualKey)
        .maybeSingle();
      if (cancelled) return;
      setAnnualGoalState(Number(row?.total_goal) || 0);
    })();
    return () => { cancelled = true; };
  }, [year]);

  // --- Load data from Supabase when month changes ---
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: row, error } = await supabase
        .from("billing_months")
        .select("*")
        .eq("month_key", selectedMonth)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error(error);
        setData(emptyMonth());
      } else if (row) {
        setData({
          totalGoal: Number(row.total_goal) || 0,
          teamGoals: row.team_goals || { PT: 0, IT: 0, ES: 0, FR: 0 },
          entries: row.entries || {},
        });
      } else {
        setData(emptyMonth());
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedMonth]);

  // --- Save (upsert) ---
  const persist = async (next) => {
    const { error } = await supabase.from("billing_months").upsert(
      {
        month_key: selectedMonth,
        total_goal: next.totalGoal,
        team_goals: next.teamGoals,
        entries: next.entries,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "month_key" }
    );
    if (error) {
      setSaveMsg("Erro: " + error.message);
      setTimeout(() => setSaveMsg(""), 3000);
    } else {
      setSaveMsg("Guardado ✓");
      setTimeout(() => setSaveMsg(""), 1500);
    }
  };

  const save = (updater) => {
    if (!isAdmin) return;
    setData((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      persist(next);
      return next;
    });
  };

  const setTotalGoal = (val) =>
    save((prev) => ({ ...prev, totalGoal: Number(val) || 0 }));
  const setTeamGoal = (team, val) =>
    save((prev) => ({
      ...prev,
      teamGoals: { ...prev.teamGoals, [team]: Number(val) || 0 },
    }));
  const setEntry = (day, field, val) => {
    save((prev) => {
      const current = prev.entries[day] || {};
      const finalVal =
        typeof val === "boolean"
          ? val
          : val === ""
          ? ""
          : Number(val);
      return {
        ...prev,
        entries: {
          ...prev.entries,
          [day]: { ...current, [field]: finalVal },
        },
      };
    });
  };
  const distributeEqually = () =>
    save((prev) => {
      const each = Math.round((Number(prev.totalGoal) || 0) / (ANALISE_TEAMS.length - 1)); // excl. total
      const goals = {};
      ANALISE_TEAMS.filter(t => t.id !== "total").forEach(t => { goals[t.id] = each; });
      return { ...prev, teamGoals: goals };
    });

  const saveAnnualGoal = async (val) => {
    if (!isAdmin) return;
    const numVal = Number(val) || 0;
    setAnnualGoalState(numVal);
    const annualKey = `${year}-annual`;
    const { error } = await supabase.from("billing_months").upsert(
      { month_key: annualKey, total_goal: numVal, team_goals: {}, entries: {}, updated_at: new Date().toISOString() },
      { onConflict: "month_key" }
    );
    if (!error) { setSaveMsg("Guardado ✓"); setTimeout(() => setSaveMsg(""), 1500); }
  };

  const monthOptions = useMemo(() => {
    const opts = [];
    for (let y = 2025; y <= 2026; y++) {
      for (let m = 0; m < 12; m++) {
        const d = new Date(y, m, 1);
        opts.push({
          key: monthKey(d),
          label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
        });
      }
    }
    return opts;
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const availableTabs = isAdmin
    ? [
        { id: "analise", label: "Análise comercial" },
        { id: "dashboard", label: "Revenda" },
        { id: "afiliacao", label: "Afiliação" },
        { id: "encomendas", label: "Encomendas" },
        { id: "leads", label: "Leads / Parcerias" },
        { id: "relatorio", label: "Relatório" },
        { id: "history", label: "Histórico" },
        { id: "entry", label: "Registo Diário" },
        { id: "revenda_reg", label: "Registo Revenda" },
        { id: "setup", label: "Objetivos" },
      ]
    : [
        { id: "analise", label: "Análise comercial" },
        { id: "dashboard", label: "Revenda" },
        { id: "afiliacao", label: "Afiliação" },
        { id: "encomendas", label: "Encomendas" },
        { id: "leads", label: "Leads / Parcerias" },
        { id: "history", label: "Histórico" },
      ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <header className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                Faturação da Equipa
              </h1>
              <p className="text-slate-600 text-sm mt-1 flex items-center gap-2">
                Acompanhamento diário · Total · PT · IT · ES · FR
                {authReady && !isAdmin && (
                  <span className="inline-flex items-center gap-1 text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                    <Eye className="w-3 h-3" /> só leitura
                  </span>
                )}
                {isAdmin && (
                  <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                    <Lock className="w-3 h-3" /> admin
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium"
              >
                {monthOptions.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
              {isAdmin ? (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-xs font-medium px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                >
                  <LogOut className="w-3 h-3" /> Sair
                </button>
              ) : (
                <button
                  onClick={() => setShowLogin(true)}
                  className="flex items-center gap-1 text-xs font-medium px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Lock className="w-3 h-3" /> Entrar
                </button>
              )}
            </div>
          </div>

          <div className="mt-5 flex gap-1 border-b border-slate-200">
            {availableTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                {t.label}
              </button>
            ))}
            {saveMsg && (
              <span className="ml-auto self-center text-xs text-green-600 font-medium">
                {saveMsg}
              </span>
            )}
          </div>
        </header>

        {loading ? (
          <div className="text-center py-12 text-slate-500">A carregar…</div>
        ) : (
          <>
            {tab === "analise" && (
              <AnaliseDashboardWrapper
                data={data}
                totalDays={totalDays}
                closedDay={closedDay}
                month={MONTH_NAMES[month]}
                monthNum={month}
                year={year}
                scope={analiseScope}
                setScope={setAnaliseScope}
                isCurrentMonth={isCurrentMonth}
              />
            )}
            {tab === "dashboard" && (
              <DashboardWrapper
                data={data}
                totalDays={totalDays}
                closedDay={closedDay}
                month={MONTH_NAMES[month]}
                monthNum={month}
                year={year}
                scope={scope}
                setScope={setScope}
                isCurrentMonth={isCurrentMonth}
              />
            )}
            {tab === "history" && <History annualGoal={annualGoal} currentYear={year} />}
            {tab === "afiliacao" && (
              <AfiliacaoDashboard
                totalDays={totalDays}
                closedDay={closedDay}
                month={MONTH_NAMES[month]}
                monthNum={month}
                year={year}
                isCurrentMonth={isCurrentMonth}
                isAdmin={isAdmin}
              />
            )}
            {tab === "encomendas" && (
              <Encomendas monthNum={month} year={year} isAdmin={isAdmin} />
            )}
            {tab === "leads" && (
              <LeadsParcerias monthNum={month} year={year} isAdmin={isAdmin} />
            )}
            {tab === "relatorio" && isAdmin && (
              <Relatorio monthNum={month} year={year} />
            )}
            {tab === "entry" && isAdmin && (
              <Entry
                data={data}
                setEntry={setEntry}
                totalDays={totalDays}
                closedDay={closedDay}
                isCurrentMonth={isCurrentMonth}
              />
            )}
            {tab === "revenda_reg" && isAdmin && (
              <EntryRevenda
                monthNum={month}
                year={year}
                totalDays={totalDays}
                closedDay={closedDay}
                isCurrentMonth={isCurrentMonth}
              />
            )}
            {tab === "setup" && isAdmin && (
              <Setup
                data={data}
                setTotalGoal={setTotalGoal}
                setTeamGoal={setTeamGoal}
                distributeEqually={distributeEqually}
                annualGoal={annualGoal}
                saveAnnualGoal={saveAnnualGoal}
                year={year}
              />
            )}
          </>
        )}

        {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}

        <footer className="mt-12 text-center text-xs text-slate-400">
          Faturação da Equipa · {isAdmin ? "Modo administrador" : "Modo consulta"}
        </footer>
      </div>
    </div>
  );
}

// ---- Login Modal ----
function LoginModal({ onClose }) {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password,
    });
    setLoading(false);
    if (error) {
      setErr("Password incorreta");
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Lock className="w-4 h-4" /> Acesso de administrador
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Introduz a password partilhada para registar dados.
        </p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          {err && <div className="text-xs text-red-600">{err}</div>}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !password}
              className="px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "A entrar…" : "Entrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---- Stats ----
function computeScopeStats(data, scope, totalDays, closedDay, year, month) {
  const goal =
    scope === "total"
      ? Number(data.totalGoal) || 0
      : Number(data.teamGoals[scope]) || 0;
  const dailyAvg = totalDays > 0 ? Math.round(goal / totalDays) : 0;

  let actual = 0;
  let lastCumulative = 0;
  const daily = [];

  for (let d = 1; d <= totalDays; d++) {
    const entry = data.entries[d] || {};
    const raw = entry[scope];
    const hasValue =
      raw !== undefined &&
      raw !== "" &&
      raw !== null &&
      !Number.isNaN(Number(raw));
    const cumulative = hasValue ? Number(raw) : lastCumulative;
    daily.push({
      day: d,
      value: cumulative - lastCumulative,
      cumulative: hasValue ? cumulative : null,
      expected: dailyAvg * d,
      supersales: entry.supersales === true,
      weekday: year && month !== undefined ? new Date(year, month, d).getDay() : undefined,
    });
    if (d <= closedDay && hasValue) actual = cumulative;
    if (hasValue) lastCumulative = cumulative;
  }

  const expectedToDate = dailyAvg * closedDay;
  const diff = actual - expectedToDate;
  const pctOfGoal = goal > 0 ? (actual / goal) * 100 : 0;
  const pctVsExpected =
    expectedToDate > 0 ? (actual / expectedToDate) * 100 : 0;
  const avgSoFar = closedDay > 0 ? actual / closedDay : 0;
  const projection = avgSoFar * totalDays;

  // Dias restantes (após o dia fechado mais recente)
  const remainingDays = totalDays - closedDay;
  // Quanto falta para o objetivo
  const remaining = goal - actual;
  // Necessário por dia para atingir o objetivo
  const neededPerDay = remainingDays > 0 ? Math.ceil(remaining / remainingDays) : 0;

  // Média diária excluindo dias de Supersales
  const nonSuperDays = daily.filter(
    (d) => d.day <= closedDay && !d.supersales && d.cumulative !== null
  );
  // Recalcula o acumulado nos dias não-supersales para obter a soma incremental
  let nonSuperTotal = 0;
  let nonSuperCount = 0;
  for (let d = 1; d <= closedDay; d++) {
    const entry = daily[d - 1];
    if (!entry.supersales && entry.cumulative !== null) {
      nonSuperTotal += entry.value;
      nonSuperCount++;
    }
  }
  const avgWithoutSuper = nonSuperCount > 0 ? Math.round(nonSuperTotal / nonSuperCount) : 0;
  const hasSuperDays = daily.some((d) => d.day <= closedDay && d.supersales);
  const superDaysCount = daily.filter((d) => d.day <= closedDay && d.supersales).length;
  const nonSuperTotalDays = totalDays - superDaysCount;
  // Soma exata de faturação nos dias de Supersales (já realizados)
  let superDaysTotal = 0;
  for (let d = 1; d <= closedDay; d++) {
    const entry = daily[d - 1];
    if (entry.supersales && entry.cumulative !== null) {
      superDaysTotal += entry.value;
    }
  }
  // Projeção = média dos dias normais × dias normais do mês + faturação exata dos dias Supersales
  const projectionWithoutSuper = avgWithoutSuper > 0
    ? avgWithoutSuper * nonSuperTotalDays + superDaysTotal
    : projection;

  return {
    goal, dailyAvg, actual, expectedToDate, diff,
    pctOfGoal, pctVsExpected, projection, daily,
    remainingDays, remaining, neededPerDay,
    avgWithoutSuper, hasSuperDays, projectionWithoutSuper,
    nonSuperCount, nonSuperTotalDays, superDaysCount, superDaysTotal,
  };
}


// Converts daily-value entries (Registo Revenda) into cumulative format
// so computeScopeStats can process them unchanged
function dailyToCumulative(dailyEntries, teams) {
  const cumulative = {};
  const running = {};
  teams.forEach(t => { running[t] = 0; });
  let runningTotal = 0;

  const days = Object.keys(dailyEntries)
    .map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);

  const maxDay = days.length > 0 ? Math.max(...days) : 0;

  for (let d = 1; d <= maxDay; d++) {
    const row = dailyEntries[d] || {};
    const hasAnyTeam = teams.some(t => row[t] !== undefined && row[t] !== "" && row[t] !== null);
    if (hasAnyTeam) {
      teams.forEach(t => { running[t] += Number(row[t]) || 0; });
      runningTotal += teams.reduce((s, t) => s + (Number(row[t]) || 0), 0);
      cumulative[d] = {
        ...teams.reduce((obj, t) => ({ ...obj, [t]: running[t] }), {}),
        total: runningTotal,
        supersales: row.supersales === true,
      };
    } else if (row.supersales) {
      cumulative[d] = { supersales: true };
    }
  }
  return cumulative;
}

// Agrega múltiplos mercados num único scope virtual para Análise comercial
function computeTeamScopeStats(data, teamDef, totalDays, closedDay, year, month) {
  if (teamDef.id === "total") {
    return computeScopeStats(data, "total", totalDays, closedDay, year, month);
  }
  const markets = teamDef.markets;

  // Goal = objetivo definido para a equipa
  const goal = Number(data.teamGoals[teamDef.id]) || 0;
  const dailyAvg = totalDays > 0 ? Math.round(goal / totalDays) : 0;

  const daily = [];
  let lastCumulativeByMkt = {};
  markets.forEach(m => { lastCumulativeByMkt[m] = 0; });

  for (let d = 1; d <= totalDays; d++) {
    const entry = data.entries[d] || {};
    let dayCumulative = 0;
    let anyValue = false;
    markets.forEach(m => {
      const raw = entry[m];
      const hasValue = raw !== undefined && raw !== "" && raw !== null && !Number.isNaN(Number(raw));
      if (hasValue) {
        lastCumulativeByMkt[m] = Number(raw);
        anyValue = true;
      }
      dayCumulative += lastCumulativeByMkt[m];
    });
    const prevDayEntry = daily[d - 2];
    const prevCumulative = prevDayEntry ? prevDayEntry._cumRaw : 0;
    daily.push({
      day: d,
      value: dayCumulative - prevCumulative,
      cumulative: anyValue ? dayCumulative : null,
      _cumRaw: dayCumulative,
      expected: dailyAvg * d,
      supersales: entry.supersales === true,
      weekday: year && month !== undefined ? new Date(year, month, d).getDay() : undefined,
    });
  }

  let actual = 0;
  let lastHasValue = 0;
  for (let d = 1; d <= closedDay; d++) {
    if (daily[d-1].cumulative !== null) actual = daily[d-1].cumulative;
  }

  const expectedToDate = dailyAvg * closedDay;
  const diff = actual - expectedToDate;
  const pctOfGoal = goal > 0 ? (actual / goal) * 100 : 0;
  const pctVsExpected = expectedToDate > 0 ? (actual / expectedToDate) * 100 : 0;
  const avgSoFar = closedDay > 0 ? actual / closedDay : 0;
  const projection = avgSoFar * totalDays;
  const remainingDays = totalDays - closedDay;
  const remaining = goal - actual;
  const neededPerDay = remainingDays > 0 ? Math.ceil(remaining / remainingDays) : 0;

  let nonSuperTotal = 0, nonSuperCount = 0, superDaysCount = 0, superDaysTotal = 0;
  for (let d = 1; d <= closedDay; d++) {
    const entry = daily[d - 1];
    if (entry.supersales) { superDaysCount++; superDaysTotal += entry.value; }
    else if (entry.cumulative !== null) { nonSuperTotal += entry.value; nonSuperCount++; }
  }
  const avgWithoutSuper = nonSuperCount > 0 ? Math.round(nonSuperTotal / nonSuperCount) : 0;
  const hasSuperDays = superDaysCount > 0;
  const nonSuperTotalDays = totalDays - superDaysCount;
  const projectionWithoutSuper = avgWithoutSuper > 0
    ? avgWithoutSuper * nonSuperTotalDays + superDaysTotal : projection;

  return {
    goal, dailyAvg, actual, expectedToDate, diff,
    pctOfGoal, pctVsExpected, projection, daily,
    remainingDays, remaining, neededPerDay,
    avgWithoutSuper, hasSuperDays, projectionWithoutSuper,
    nonSuperCount, nonSuperTotalDays, superDaysCount, superDaysTotal,
  };
}

function AnaliseScopeTabs({ scope, setScope }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-1 flex gap-1 overflow-x-auto">
      {ANALISE_TEAMS.map((s) => {
        const active = scope === s.id;
        const color = ANALISE_COLORS[s.id];
        return (
          <button
            key={s.id}
            onClick={() => setScope(s.id)}
            className={`flex-1 min-w-[80px] px-3 py-2 rounded-md text-sm font-semibold transition-colors ${
              active ? "text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
            style={active ? { backgroundColor: color } : undefined}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

function AnaliseDashboardWrapper({
  data, totalDays, closedDay, month, monthNum, year, scope, setScope, isCurrentMonth,
}) {
  const teamDef = ANALISE_TEAMS.find(t => t.id === scope) || ANALISE_TEAMS[0];

  const stats = useMemo(
    () => computeTeamScopeStats(data, teamDef, totalDays, closedDay, year, monthNum),
    [data, teamDef, totalDays, closedDay, year, monthNum]
  );

  // Team stats for breakdown — one per equipa (excluding total)
  const teamStats = useMemo(
    () => ANALISE_TEAMS.filter(t => t.id !== "total").map(t => ({
      team: t.label,
      ...computeTeamScopeStats(data, t, totalDays, closedDay, year, monthNum),
    })),
    [data, totalDays, closedDay, year, monthNum]
  );

  if (stats.goal === 0) {
    return (
      <>
        <AnaliseScopeTabs scope={scope} setScope={setScope} />
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center mt-4">
          <Target className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-900">
            {scope === "total"
              ? "Sem objetivo total definido para este mês"
              : `Sem objetivo definido para ${teamDef.label}`}
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            O administrador ainda não configurou este âmbito.
          </p>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-5">
      <AnaliseScopeTabs scope={scope} setScope={setScope} />
      <Dashboard
        stats={stats}
        scope={teamDef.label}
        month={month}
        year={year}
        totalDays={totalDays}
        closedDay={closedDay}
        isCurrentMonth={isCurrentMonth}
        teamStats={teamStats}
      />
    </div>
  );
}

function DashboardWrapper({
  data, totalDays, closedDay, month, monthNum, year, scope, setScope, isCurrentMonth,
}) {
  // From May 2026 onwards, use Registo Revenda (daily values) as data source
  const useRevendaReg = (year > 2026) || (year === 2026 && monthNum >= 4);
  const revendaKey = `revenda-daily-${year}-${String(monthNum + 1).padStart(2, "0")}`;

  const [revendaEntries, setRevendaEntries] = useState(null);
  useEffect(() => {
    if (!useRevendaReg) { setRevendaEntries(null); return; }
    supabase.from("billing_months").select("entries").eq("month_key", revendaKey).maybeSingle()
      .then(({ data: row }) => {
        setRevendaEntries(row?.entries || {});
      });
  }, [revendaKey, useRevendaReg]);

  // Build effective data: if using Registo Revenda, convert daily→cumulative
  const effectiveData = useMemo(() => {
    if (!useRevendaReg || revendaEntries === null) return data;
    return {
      ...data,
      entries: dailyToCumulative(revendaEntries, TEAMS),
    };
  }, [data, useRevendaReg, revendaEntries]);

  const stats = useMemo(
    () => computeScopeStats(effectiveData, scope, totalDays, closedDay, year, monthNum),
    [effectiveData, scope, totalDays, closedDay, year, monthNum]
  );

  // Load prev year data + closing data (margem, encomendas)
  const [prevYearActual, setPrevYearActual] = useState(null);
  const [closingCurr, setClosingCurr] = useState(null);
  const [closingPrev, setClosingPrev] = useState(null);

  useEffect(() => {
    const prevKey = `${year - 1}-${String(monthNum + 1).padStart(2, "0")}`;
    // Prev year billing — also try revenda-daily for prev year if applicable
    const prevUseReg = (year - 1 > 2026) || (year - 1 === 2026 && monthNum >= 4);
    const prevDataKey = prevUseReg
      ? `revenda-daily-${year - 1}-${String(monthNum + 1).padStart(2, "0")}`
      : prevKey;

    supabase.from("billing_months").select("entries").eq("month_key", prevDataKey).maybeSingle()
      .then(({ data: row }) => {
        if (!row?.entries) { setPrevYearActual(null); return; }
        let entries = row.entries;
        if (prevUseReg) {
          // Convert daily to cumulative to extract final value
          entries = dailyToCumulative(entries, TEAMS);
        }
        const days = Object.keys(entries).map(Number).filter(n => !isNaN(n)).sort((a,b)=>a-b);
        if (!days.length) { setPrevYearActual(null); return; }
        const lastEntry = entries[String(days[days.length - 1])] || {};
        if (scope === "total") {
          const val = lastEntry.total ?? Object.entries(lastEntry)
            .filter(([k]) => k !== "supersales" && k !== "total")
            .reduce((s,[,v]) => s + (Number(v)||0), 0);
          setPrevYearActual(Number(val) || null);
        } else {
          setPrevYearActual(lastEntry[scope] != null ? Number(lastEntry[scope]) : null);
        }
      });
    // Closing current month
    loadClosing(year, monthNum).then(setClosingCurr);
    // Closing prev year same month
    loadClosing(year - 1, monthNum).then(setClosingPrev);
  }, [year, monthNum, scope]);

  if (stats.goal === 0) {
    return (
      <>
        <ScopeTabs scope={scope} setScope={setScope} />
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center mt-4">
          <Target className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-900">
            {scope === "total"
              ? "Sem objetivo total definido para este mês"
              : `Sem objetivo definido para ${scope}`}
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            O administrador ainda não configurou este âmbito.
          </p>
        </div>
      </>
    );
  }

  // YoY faturação
  const evoPct = prevYearActual > 0 ? ((stats.actual - prevYearActual) / prevYearActual) * 100 : null;
  const evoAbs = prevYearActual != null ? stats.actual - prevYearActual : null;
  const isAheadYoY = evoPct != null && evoPct >= 0;

  // Margem — from closing data (global, same for all scopes for now)
  const marginCurr = closingCurr?.revenda_margin ? parseFloat(closingCurr.revenda_margin) : null;
  const marginPrev = closingPrev?.revenda_margin ? parseFloat(closingPrev.revenda_margin) : null;

  // Encomendas — aggregate across all markets (total) or specific market
  const sumField = (closing, field) => {
    if (!closing?.markets) return null;
    const markets = scope === "total" ? MC_MARKETS.map(m => m.code) : [scope];
    const vals = markets.map(m => parseFloat(closing.markets[m]?.[field]) || 0);
    const total = vals.reduce((s,v) => s+v, 0);
    return total > 0 ? total : null;
  };
  const ordersCurr    = sumField(closingCurr, "orders_curr");
  const ordersPrev    = sumField(closingPrev, "orders_curr");
  const firstCurr     = sumField(closingCurr, "first_orders_curr");
  const firstPrev     = sumField(closingPrev, "first_orders_curr");
  const firstRevCurr  = sumField(closingCurr, "first_orders_rev_curr");
  const firstRevPrev  = sumField(closingPrev, "first_orders_rev_curr");
  const leadsCurr     = sumField(closingCurr, "leads_curr");
  const leadsPrev     = sumField(closingPrev, "leads_curr");
  // Afiliação
  const afilCurr = (() => {
    if (!closingCurr?.markets) return null;
    const markets = scope === "total" ? MC_MARKETS.map(m => m.code) : [scope];
    const t = markets.reduce((s,m) => s + (parseFloat(closingCurr.markets[m]?.afil_result)||0), 0);
    return t > 0 ? t : null;
  })();
  const afilPrev = (() => {
    if (!closingPrev?.markets) return null;
    const markets = scope === "total" ? MC_MARKETS.map(m => m.code) : [scope];
    const t = markets.reduce((s,m) => s + (parseFloat(closingPrev.markets[m]?.afil_result)||0), 0);
    return t > 0 ? t : null;
  })();

  return (
    <div className="space-y-5">
      <ScopeTabs scope={scope} setScope={setScope} />

      {useRevendaReg && (
        <div className="flex items-center gap-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
          <span className="font-semibold">📋 Fonte:</span> Registo Revenda (valores diários)
          {revendaEntries && Object.keys(revendaEntries).filter(k => !isNaN(Number(k))).length === 0 && (
            <span className="ml-1 text-orange-600 font-medium">— ainda sem dados registados</span>
          )}
        </div>
      )}

      {/* Comparação vs ano anterior — faturação */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-orange-500" />
          Faturação vs {year - 1}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs text-slate-500 font-medium mb-1">{month} {year - 1}</p>
            <p className="text-xl font-bold text-slate-700">
              {prevYearActual != null ? fmtEur(prevYearActual) : <span className="text-slate-400 text-sm">Sem dados</span>}
            </p>
          </div>
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-xs text-slate-500 font-medium mb-1">{month} {year}</p>
            <p className="text-xl font-bold text-blue-700">{fmtEur(stats.actual)}</p>
          </div>
          <div className={`rounded-xl p-4 ${evoPct == null ? "bg-slate-50" : isAheadYoY ? "bg-green-50" : "bg-red-50"}`}>
            <p className="text-xs text-slate-500 font-medium mb-1">Evolução %</p>
            <p className={`text-xl font-bold ${evoPct == null ? "text-slate-400" : isAheadYoY ? "text-green-700" : "text-red-700"}`}>
              {evoPct == null ? "—" : `${isAheadYoY ? "+" : ""}${evoPct.toFixed(1)}%`}
            </p>
          </div>
          <div className={`rounded-xl p-4 ${evoAbs == null ? "bg-slate-50" : isAheadYoY ? "bg-green-50" : "bg-red-50"}`}>
            <p className="text-xs text-slate-500 font-medium mb-1">Ganho absoluto</p>
            <p className={`text-xl font-bold ${evoAbs == null ? "text-slate-400" : isAheadYoY ? "text-green-700" : "text-red-700"}`}>
              {evoAbs == null ? "—" : `${evoAbs >= 0 ? "+" : ""}${fmtEur(evoAbs)}`}
            </p>
          </div>
        </div>
      </div>

      <RevDashboard
        stats={stats}
        scope={scope}
        month={month}
        year={year}
        totalDays={totalDays}
        closedDay={closedDay}
        isCurrentMonth={isCurrentMonth}
        prevYearActual={prevYearActual}
        marginCurr={marginCurr}
        marginPrev={marginPrev}
        ordersCurr={ordersCurr}
        ordersPrev={ordersPrev}
        firstCurr={firstCurr}
        firstPrev={firstPrev}
        firstRevCurr={firstRevCurr}
        firstRevPrev={firstRevPrev}
        leadsCurr={leadsCurr}
        leadsPrev={leadsPrev}
        afilCurr={afilCurr}
        afilPrev={afilPrev}
      />
    </div>
  );
}

function ScopeTabs({ scope, setScope }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-1 flex gap-1 overflow-x-auto">
      {SCOPES.map((s) => {
        const active = scope === s.id;
        const color = TEAM_COLORS[s.id];
        return (
          <button
            key={s.id}
            onClick={() => setScope(s.id)}
            className={`flex-1 min-w-[70px] px-3 py-2 rounded-md text-sm font-semibold transition-colors ${
              active ? "text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
            style={active ? { backgroundColor: color } : undefined}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, tone = "default", onClick }) {
  const tones = {
    default: "bg-white border-slate-200",
    good: "bg-green-50 border-green-200",
    bad: "bg-red-50 border-red-200",
    info: "bg-blue-50 border-blue-200",
  };
  return (
    <div
      className={`rounded-xl border p-4 ${tones[tone]} ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 text-slate-600 text-xs font-medium uppercase tracking-wide">
        {Icon && <Icon className="w-4 h-4" />} {label}
        {onClick && <span className="ml-auto text-slate-400 text-[10px] normal-case font-normal">ver detalhe →</span>}
      </div>
      <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-600">{sub}</div>}
    </div>
  );
}

function Dashboard({
  stats, scope, month, year, totalDays, closedDay, isCurrentMonth, teamStats,
}) {
  const {
    goal, dailyAvg, actual, expectedToDate, diff,
    pctOfGoal, pctVsExpected, projection, daily,
    remainingDays, remaining, neededPerDay,
    avgWithoutSuper, hasSuperDays, projectionWithoutSuper,
    nonSuperCount, nonSuperTotalDays, superDaysCount, superDaysTotal,
  } = stats;
  const isAhead = diff >= 0;
  const scopeLabel = scope === "total" ? "Total" : `Equipa ${scope}`;
  const color = TEAM_COLORS[scope];
  const noClosedDays = closedDay === 0;
  const [modal, setModal] = useState(null); // "faturado" | "pctGoal" | "pctExpected"

  return (
    <>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2 text-sm">
        <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-blue-900">
          <strong>{scopeLabel}</strong> · {month} {year} ·{" "}
          {noClosedDays ? (
            "Ainda não há dias fechados para analisar."
          ) : (
            <>
              Análise sobre <strong>{closedDay}</strong>{" "}
              {closedDay === 1 ? "dia fechado" : "dias fechados"}{" "}
              {isCurrentMonth && "(até ontem)"} de {totalDays}.
            </>
          )}
        </div>
      </div>

      {noClosedDays ? null : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              icon={Target}
              label={`Objetivo ${scopeLabel}`}
              value={fmtEur(goal)}
              sub={`${totalDays} dias · ${fmtEur(dailyAvg)}/dia`}
            />
            <StatCard
              icon={Euro}
              label={`Faturado até dia ${closedDay}`}
              value={fmtEur(actual)}
              sub={`${closedDay} de ${totalDays} dias`}
              tone="info"
              onClick={() => setModal("faturado")}
            />
            <StatCard
              icon={TrendingUp}
              label={`Esperado ao dia ${closedDay}`}
              value={fmtEur(expectedToDate)}
              sub="Ritmo linear"
            />
            <StatCard
              icon={isAhead ? CheckCircle2 : AlertCircle}
              label={isAhead ? "Acima do esperado" : "Abaixo do esperado"}
              value={`${isAhead ? "+" : ""}${fmtEur(diff)}`}
              sub={`vs. esperado ao dia ${closedDay}`}
              tone={isAhead ? "good" : "bad"}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <ProgressCard
              title="% do objetivo mensal"
              subtitle="Faturado vs. objetivo total do mês"
              pct={pctOfGoal}
              detail={`${fmtEur(actual)} de ${fmtEur(goal)}`}
              onClick={() => setModal("pctGoal")}
            />
            <ProgressCard
              title="% vs. esperado ao dia atual"
              subtitle="100% = exatamente no ritmo previsto"
              pct={pctVsExpected}
              detail={`${fmtEur(actual)} vs. esperado ${fmtEur(expectedToDate)}`}
              benchmark={100}
              onClick={() => setModal("pctExpected")}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Necessário/dia para atingir objetivo */}
            <div className={`rounded-xl border p-5 ${
              remainingDays <= 0
                ? "bg-slate-50 border-slate-200"
                : neededPerDay <= dailyAvg
                ? "bg-green-50 border-green-200"
                : neededPerDay <= dailyAvg * 1.3
                ? "bg-amber-50 border-amber-200"
                : "bg-red-50 border-red-200"
            }`}>
              <div className="flex items-center gap-2 text-slate-600 text-xs font-medium uppercase tracking-wide">
                <TrendingUp className="w-4 h-4" />
                Necessário/dia para atingir objetivo
              </div>
              {remainingDays <= 0 ? (
                <div className="mt-2 text-2xl font-bold text-slate-500">—</div>
              ) : remaining <= 0 ? (
                <>
                  <div className="mt-2 text-2xl font-bold text-green-700">Objetivo atingido!</div>
                  <div className="mt-1 text-xs text-green-700">Superado em {fmtEur(Math.abs(remaining))}</div>
                </>
              ) : (
                <>
                  <div className={`mt-2 text-2xl font-bold ${
                    neededPerDay <= dailyAvg ? "text-green-700"
                    : neededPerDay <= dailyAvg * 1.3 ? "text-amber-700"
                    : "text-red-700"
                  }`}>
                    {fmtEur(neededPerDay)}/dia
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    Faltam faturar {fmtEur(remaining)} para atingir objetivo mensal
                  </div>
                </>
              )}
            </div>

            {/* Média diária sem Supersales */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 text-slate-600 text-xs font-medium uppercase tracking-wide">
                <Calendar className="w-4 h-4" />
                Média diária (sem Supersales)
              </div>
              {closedDay === 0 ? (
                <div className="mt-2 text-2xl font-bold text-slate-400">—</div>
              ) : !hasSuperDays ? (
                <>
                  <div className="mt-2 text-2xl font-bold text-slate-900">
                    {fmtEur(avgWithoutSuper)}/dia
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Sem dias de Supersales no período analisado
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-2 text-2xl font-bold text-slate-900">
                    {fmtEur(avgWithoutSuper)}/dia
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    Excluindo dias de Supersales ·{" "}
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" />
                      campanha de descontos
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <ProjectionAccordion
            projection={projection}
            projectionWithoutSuper={projectionWithoutSuper}
            goal={goal}
            closedDay={closedDay}
            totalDays={totalDays}
            dailyAvg={dailyAvg}
            actual={actual}
            daily={daily}
            hasSuperDays={hasSuperDays}
            avgWithoutSuper={avgWithoutSuper}
            nonSuperCount={nonSuperCount}
            nonSuperTotalDays={nonSuperTotalDays}
            superDaysCount={superDaysCount}
            superDaysTotal={superDaysTotal}
          />

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-900 mb-4">
              Evolução acumulada vs. linha esperada — {scopeLabel}
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(v) => fmtEur(v)}
                    labelFormatter={(l) => {
                      const entry = daily.find((x) => x.day === l);
                      return `Dia ${l}${entry?.supersales ? " · Supersales" : ""}`;
                    }}
                  />
                  <Legend />
                  {daily
                    .filter((d) => d.supersales)
                    .map((d) => (
                      <ReferenceLine
                        key={`ss-${d.day}`}
                        x={d.day}
                        stroke="#f59e0b"
                        strokeWidth={2}
                        strokeDasharray="2 2"
                        ifOverflow="extendDomain"
                      />
                    ))}
                  <Line
                    type="monotone"
                    dataKey="expected"
                    name="Esperado"
                    stroke="#94a3b8"
                    strokeDasharray="5 5"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    name="Acumulado real"
                    stroke={color}
                    strokeWidth={2}
                    dot={(props) => {
                      const { cx, cy, payload, index } = props;
                      if (cy == null || cx == null) return null;
                      if (payload.supersales) {
                        return (
                          <circle
                            key={`dot-${index}`}
                            cx={cx}
                            cy={cy}
                            r={6}
                            fill="#f59e0b"
                            stroke="#fff"
                            strokeWidth={2}
                          />
                        );
                      }
                      return (
                        <circle
                          key={`dot-${index}`}
                          cx={cx}
                          cy={cy}
                          r={3}
                          fill={color}
                        />
                      );
                    }}
                    label={(props) => {
                      const { x, y, index, value } = props;
                      // Only show label on the last closed day with a value
                      const entry = daily[index];
                      if (!entry || value == null) return null;
                      if (entry.day !== closedDay) return null;
                      const exp = dailyAvg * closedDay;
                      if (exp <= 0) return null;
                      const pct = ((value / exp) * 100).toFixed(1);
                      const pctColor = value >= exp ? "#16a34a" : "#dc2626";
                      return (
                        <text
                          x={x}
                          y={y - 10}
                          textAnchor="middle"
                          fontSize={10}
                          fontWeight="600"
                          fill={pctColor}
                        >
                          {pct}%
                        </text>
                      );
                    }}
                    connectNulls
                  />
                  {closedDay > 0 && closedDay < totalDays && (
                    <ReferenceLine
                      x={closedDay}
                      stroke="#dc2626"
                      strokeDasharray="3 3"
                      label={{
                        value: "Último fechado",
                        fontSize: 11,
                        fill: "#dc2626",
                      }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
            {daily.some((d) => d.supersales) && (
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                <span className="inline-block w-3 h-3 rounded-full bg-amber-500 border-2 border-white ring-1 ring-amber-500" />
                Dia de Supersales (campanha de descontos)
              </div>
            )}
          </div>

          {scope === "total" && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-900 mb-1">
                Resumo por equipa
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Os totais das equipas não somam necessariamente o Total
                (existem outras equipas que contribuem mas não são analisadas).
              </p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={teamStats.map((t) => ({
                      team: t.team,
                      Faturado: t.actual,
                      Objetivo: t.goal,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="team" tick={{ fontSize: 12 }} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip formatter={(v) => fmtEur(v)} />
                    <Legend />
                    <Bar dataKey="Objetivo" fill="#cbd5e1" />
                    <Bar dataKey="Faturado" fill="#2563eb" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                {teamStats.map((t) => (
                  <div
                    key={t.team}
                    className="border border-slate-200 rounded-lg p-3"
                  >
                    <div
                      className="text-xs font-semibold"
                      style={{ color: TEAM_COLORS[t.team] }}
                    >
                      {t.team}
                    </div>
                    <div className="text-sm font-bold mt-1">
                      {fmtEur(t.actual)}
                    </div>
                    <div className="text-xs text-slate-500">
                      de {fmtEur(t.goal)} · {fmtPct(t.pctOfGoal)}
                    </div>
                    <div
                      className={`text-xs font-medium mt-1 ${
                        t.diff >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {t.diff >= 0 ? "+" : ""}
                      {fmtEur(t.diff)} vs. esperado
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      {modal && (
        <DailyModal
          mode={modal}
          daily={daily}
          closedDay={closedDay}
          goal={goal}
          dailyAvg={dailyAvg}
          scope={scope}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}


// ── RevDashboard — separador Revenda (sem duplicados do Análise comercial) ──
function RevDashboard({ stats, scope, month, year, totalDays, closedDay, isCurrentMonth,
  prevYearActual, marginCurr, marginPrev, ordersCurr, ordersPrev, firstCurr, firstPrev,
  firstRevCurr, firstRevPrev, leadsCurr, leadsPrev, afilCurr, afilPrev }) {
  const {
    goal, dailyAvg, actual, daily,
    avgWithoutSuper, hasSuperDays,
    nonSuperCount, nonSuperTotalDays, superDaysCount, superDaysTotal,
    remainingDays, remaining, neededPerDay,
    projection, projectionWithoutSuper,
  } = stats;
  const color = TEAM_COLORS[scope] || "#2563eb";
  const noClosedDays = closedDay === 0;
  const scopeLabel = scope === "total" ? "Total" : scope;
  const [modal, setModal] = useState(null);

  function YoYCard({ title, curr, prev, isEur = true, isPct = false }) {
    const fmt = v => v == null ? "—" : isPct ? `${v.toFixed(2)}%` : isEur ? fmtEur(v) : String(Math.round(v));
    const evo = (prev > 0 && curr != null) ? ((curr - prev) / prev * 100) : null;
    const diff = (curr != null && prev != null) ? curr - prev : null;
    const pos = evo != null && evo >= 0;
    const diffLabel = isPct
      ? (diff != null ? `${diff >= 0 ? "+" : ""}${diff.toFixed(2)}pp` : "—")
      : isEur
        ? (diff != null ? `${diff >= 0 ? "+" : ""}${fmtEur(diff)}` : "—")
        : (diff != null ? `${diff >= 0 ? "+" : ""}${Math.round(diff)}` : "—");
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-3">{title}</p>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-xs text-slate-400 mb-1">{year - 1}</p>
            <p className="text-base font-semibold text-slate-600">{fmt(prev)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">{year}</p>
            <p className="text-lg font-bold text-slate-900">{fmt(curr)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Evolução</p>
            <p className={`text-sm font-bold ${evo == null ? "text-slate-400" : pos ? "text-green-600" : "text-red-600"}`}>
              {evo == null ? "—" : `${pos ? "+" : ""}${evo.toFixed(1)}%`}
            </p>
            <p className={`text-xs ${diff == null ? "text-slate-400" : pos ? "text-green-600" : "text-red-600"}`}>
              {diffLabel}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start justify-between gap-2 text-sm">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-blue-900">
            <strong>{scopeLabel}</strong> · {month} {year} ·{" "}
            {noClosedDays ? "Ainda não há dias fechados para analisar." : (
              <>Análise sobre <strong>{closedDay}</strong> {closedDay === 1 ? "dia fechado" : "dias fechados"}{" "}
              {isCurrentMonth && "(até ontem)"} de {totalDays}.</>
            )}
          </div>
        </div>
      </div>

      {!noClosedDays && (<>

        {/* Margem % — logo após Faturação vs ano anterior */}
        <YoYCard title="Margem %" curr={marginCurr} prev={marginPrev} isEur={false} isPct={true} />

        {/* 3 cards lado a lado: Média sem SS · Média com SS · % SS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Média sem Supersales */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-slate-600 text-xs font-medium uppercase tracking-wide">
              <Calendar className="w-4 h-4" />
              Média/dia (sem SS)
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">
              {fmtEur(avgWithoutSuper)}/dia
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {hasSuperDays ? "Excluindo dias de Supersales" : "Sem dias de Supersales"}
            </div>
          </div>

          {/* Média com Supersales */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-slate-600 text-xs font-medium uppercase tracking-wide">
              <Calendar className="w-4 h-4" />
              Média/dia (com SS)
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">
              {fmtEur(closedDay > 0 ? Math.round(actual / closedDay) : 0)}/dia
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {hasSuperDays ? `Inclui ${superDaysCount} dia${superDaysCount > 1 ? "s" : ""} de Supersales` : "Sem Supersales no período"}
            </div>
          </div>

          {/* % Supersales */}
          <div className={`rounded-xl border p-5 ${hasSuperDays ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200"}`}>
            <div className={`flex items-center gap-2 text-xs font-medium uppercase tracking-wide ${hasSuperDays ? "text-amber-700" : "text-slate-600"}`}>
              <TrendingUp className="w-4 h-4" />
              % Supersales / total
            </div>
            <div className={`mt-2 text-2xl font-bold ${hasSuperDays ? "text-amber-800" : "text-slate-400"}`}>
              {hasSuperDays && actual > 0 ? `${((superDaysTotal / actual) * 100).toFixed(1)}%` : "0%"}
            </div>
            <div className="mt-1 text-xs text-slate-600">
              {hasSuperDays ? `${fmtEur(superDaysTotal)} em ${superDaysCount} dia${superDaysCount > 1 ? "s" : ""}` : "Sem Supersales"}
            </div>
          </div>
        </div>

        {/* Encomendas */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-3">Encomendas</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-400 mb-2 font-medium">Total encomendas</p>
              <div className="grid grid-cols-3 gap-1 text-sm">
                <div><p className="text-xs text-slate-400">{year-1}</p><p className="font-semibold text-slate-600">{ordersPrev != null ? Math.round(ordersPrev) : "—"}</p></div>
                <div><p className="text-xs text-slate-400">{year}</p><p className="font-bold text-slate-900">{ordersCurr != null ? Math.round(ordersCurr) : "—"}</p></div>
                <div>
                  <p className="text-xs text-slate-400">Evo.</p>
                  {ordersCurr != null && ordersPrev > 0
                    ? (() => { const e=(ordersCurr-ordersPrev)/ordersPrev*100; return <p className={`font-bold text-xs ${e>=0?"text-green-600":"text-red-600"}`}>{e>=0?"+":""}{e.toFixed(1)}%</p>; })()
                    : <p className="text-xs text-slate-400">—</p>}
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-2 font-medium">1ªs encomendas</p>
              <div className="grid grid-cols-3 gap-1 text-sm">
                <div><p className="text-xs text-slate-400">{year-1}</p><p className="font-semibold text-slate-600">{firstPrev != null ? Math.round(firstPrev) : "—"}</p></div>
                <div><p className="text-xs text-slate-400">{year}</p><p className="font-bold text-slate-900">{firstCurr != null ? Math.round(firstCurr) : "—"}</p></div>
                <div>
                  <p className="text-xs text-slate-400">Evo.</p>
                  {firstCurr != null && firstPrev > 0
                    ? (() => { const e=(firstCurr-firstPrev)/firstPrev*100; return <p className={`font-bold text-xs ${e>=0?"text-green-600":"text-red-600"}`}>{e>=0?"+":""}{e.toFixed(1)}%</p>; })()
                    : <p className="text-xs text-slate-400">—</p>}
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-2 font-medium">Fat. 1ªs enc.</p>
              <div className="grid grid-cols-3 gap-1 text-sm">
                <div><p className="text-xs text-slate-400">{year-1}</p><p className="font-semibold text-slate-600">{firstRevPrev != null ? fmtEur(firstRevPrev) : "—"}</p></div>
                <div><p className="text-xs text-slate-400">{year}</p><p className="font-bold text-slate-900">{firstRevCurr != null ? fmtEur(firstRevCurr) : "—"}</p></div>
                <div>
                  <p className="text-xs text-slate-400">Evo.</p>
                  {firstRevCurr != null && firstRevPrev > 0
                    ? (() => { const e=(firstRevCurr-firstRevPrev)/firstRevPrev*100; return <p className={`font-bold text-xs ${e>=0?"text-green-600":"text-red-600"}`}>{e>=0?"+":""}{e.toFixed(1)}%</p>; })()
                    : <p className="text-xs text-slate-400">—</p>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Leads / Parcerias */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-3">Leads / Parcerias</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-400 mb-1">{year - 1}</p>
              <p className="text-xl font-semibold text-slate-600">
                {leadsPrev != null ? Math.round(leadsPrev) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">{year}</p>
              <p className="text-2xl font-bold text-slate-900">
                {leadsCurr != null ? Math.round(leadsCurr) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Evolução</p>
              {leadsCurr != null && leadsPrev > 0 ? (() => {
                const e = (leadsCurr - leadsPrev) / leadsPrev * 100;
                return (
                  <>
                    <p className={`text-lg font-bold ${e >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {e >= 0 ? "+" : ""}{e.toFixed(1)}%
                    </p>
                    <p className={`text-xs ${e >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {leadsCurr - leadsPrev >= 0 ? "+" : ""}{Math.round(leadsCurr - leadsPrev)} leads
                    </p>
                  </>
                );
              })() : <p className="text-slate-400 text-sm">—</p>}
            </div>
          </div>
        </div>

        {/* Total Revenda + Afiliação */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-3">Total (Revenda + Afiliação)</p>
          {(() => {
            const totalCurr = actual + (afilCurr || 0);
            const totalPrev = (prevYearActual || 0) + (afilPrev || 0);
            const evo = totalPrev > 0 ? ((totalCurr - totalPrev) / totalPrev * 100) : null;
            const diff = totalPrev > 0 ? totalCurr - totalPrev : null;
            const pos = evo != null && evo >= 0;
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Revenda {year}</p>
                  <p className="text-lg font-bold text-slate-700">{fmtEur(actual)}</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Afiliação {year}</p>
                  <p className="text-lg font-bold text-purple-700">{afilCurr != null ? fmtEur(afilCurr) : <span className="text-slate-400 text-sm">Sem dados</span>}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Total {year}</p>
                  <p className="text-xl font-bold text-blue-700">{fmtEur(totalCurr)}</p>
                </div>
                <div className={`rounded-xl p-4 ${evo == null ? "bg-slate-50" : pos ? "bg-green-50" : "bg-red-50"}`}>
                  <p className="text-xs text-slate-500 mb-1">vs {year - 1}</p>
                  <p className={`text-xl font-bold ${evo == null ? "text-slate-400" : pos ? "text-green-700" : "text-red-700"}`}>
                    {evo == null ? "—" : `${pos ? "+" : ""}${evo.toFixed(1)}%`}
                  </p>
                  {diff != null && (
                    <p className={`text-xs ${pos ? "text-green-600" : "text-red-600"}`}>
                      {diff >= 0 ? "+" : ""}{fmtEur(diff)}
                    </p>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Faturação por dia de semana */}
        {(() => {
          const DAYS_PT = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
          const DAYS_FULL = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
          // Aggregate daily data by weekday (exclude supersales days from avg)
          const byWeekday = Array.from({length:7}, (_,i) => ({
            label: DAYS_PT[i], full: DAYS_FULL[i],
            total: 0, count: 0, ssTotal: 0, ssCount: 0,
          }));
          daily.forEach(d => {
            if (d.day > closedDay) return;
            const val = d.value;
            if (val == null || val === 0) return;
            const wd = d.weekday !== undefined ? d.weekday : new Date(year, monthNum, d.day).getDay();
            if (d.supersales) {
              byWeekday[wd].ssTotal += val;
              byWeekday[wd].ssCount++;
            } else {
              byWeekday[wd].total += val;
              byWeekday[wd].count++;
            }
          });
          // Reorder Mon–Sun (1–0)
          const ordered = [1,2,3,4,5,6,0].map(i => ({
            ...byWeekday[i],
            avg: byWeekday[i].count > 0 ? Math.round(byWeekday[i].total / byWeekday[i].count) : null,
            cumTotal: byWeekday[i].total + byWeekday[i].ssTotal,
          }));
          const maxAvg = Math.max(...ordered.map(d => d.avg || 0));
          return (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-900 mb-1">Faturação por dia de semana</h3>
              <p className="text-xs text-slate-500 mb-4">Média e cumulado por dia de semana · dias de Supersales excluídos da média</p>
              <div className="grid grid-cols-7 gap-2">
                {ordered.map((d, i) => {
                  const barPct = maxAvg > 0 && d.avg ? Math.round((d.avg / maxAvg) * 100) : 0;
                  const isWeekend = i >= 5;
                  return (
                    <div key={d.label} className={`flex flex-col items-center rounded-xl p-2 ${isWeekend ? "bg-slate-50" : "bg-white"} border border-slate-100`}>
                      <p className={`text-xs font-bold mb-2 ${isWeekend ? "text-slate-400" : "text-slate-700"}`}>{d.label}</p>
                      {/* Bar */}
                      <div className="w-full h-16 bg-slate-100 rounded-lg overflow-hidden flex items-end mb-2">
                        <div
                          className="w-full rounded-lg transition-all"
                          style={{
                            height: `${barPct}%`,
                            backgroundColor: isWeekend ? "#94a3b8" : (TEAM_COLORS[scope] || "#2563eb"),
                            minHeight: barPct > 0 ? "4px" : "0"
                          }}
                        />
                      </div>
                      {/* Avg */}
                      <p className="text-xs font-bold text-slate-800 text-center leading-tight">
                        {d.avg != null ? `${(d.avg/1000).toFixed(0)}k` : "—"}
                      </p>
                      <p className="text-[10px] text-slate-400 text-center">média</p>
                      {/* Count */}
                      <p className="text-[10px] text-slate-500 mt-1">{d.count} dia{d.count !== 1 ? "s" : ""}</p>
                      {/* Cumulated */}
                      <p className="text-[10px] text-slate-700 font-semibold mt-1 text-center">
                        {d.cumTotal > 0 ? `${(d.cumTotal/1000).toFixed(0)}k` : "—"}
                      </p>
                      <p className="text-[10px] text-slate-400 text-center">total</p>
                      {d.ssCount > 0 && (
                        <span className="mt-1 text-[9px] bg-amber-100 text-amber-700 rounded px-1">+SS</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
                <span>Média = valor diário médio excluindo Supersales</span>
                <span>Total = cumulado do mês</span>
              </div>
            </div>
          );
        })()}

        {/* Gráfico acumulado */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-4">
            Evolução acumulada — {scopeLabel}
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => fmtEur(v)} labelFormatter={(l) => {
                  const e = daily.find(x => x.day === l);
                  return `Dia ${l}${e?.supersales ? " · Supersales" : ""}`;
                }} />
                <Legend />
                {daily.filter(d => d.supersales).map(d => (
                  <ReferenceLine key={`ss-${d.day}`} x={d.day} stroke="#f59e0b" strokeWidth={2} strokeDasharray="2 2" ifOverflow="extendDomain" />
                ))}
                <Line type="monotone" dataKey="expected" name="Esperado" stroke="#94a3b8" strokeDasharray="5 5" dot={false} />
                <Line type="monotone" dataKey="cumulative" name="Acumulado real" stroke={color} strokeWidth={2} connectNulls
                  dot={(props) => {
                    const { cx, cy, payload, index } = props;
                    if (cy == null || cx == null) return null;
                    return payload.supersales
                      ? <circle key={`dot-${index}`} cx={cx} cy={cy} r={6} fill="#f59e0b" stroke="#fff" strokeWidth={2} />
                      : <circle key={`dot-${index}`} cx={cx} cy={cy} r={3} fill={color} />;
                  }}
                />
                {closedDay > 0 && closedDay < totalDays && (
                  <ReferenceLine x={closedDay} stroke="#dc2626" strokeDasharray="3 3"
                    label={{ value: "Último fechado", fontSize: 11, fill: "#dc2626" }} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {daily.some(d => d.supersales) && (
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <span className="inline-block w-3 h-3 rounded-full bg-amber-500 border-2 border-white ring-1 ring-amber-500" />
              Dia de Supersales (campanha de descontos)
            </div>
          )}
        </div>

        <ProjectionAccordion
          projection={projection} projectionWithoutSuper={projectionWithoutSuper}
          goal={goal} closedDay={closedDay} totalDays={totalDays} dailyAvg={dailyAvg}
          actual={actual} daily={daily} hasSuperDays={hasSuperDays}
          avgWithoutSuper={avgWithoutSuper} nonSuperCount={nonSuperCount}
          nonSuperTotalDays={nonSuperTotalDays} superDaysCount={superDaysCount}
          superDaysTotal={superDaysTotal}
        />

        {modal && (
          <DailyModal mode={modal} daily={daily} closedDay={closedDay} goal={goal}
            dailyAvg={dailyAvg} scope={scope} onClose={() => setModal(null)} />
        )}
      </>)}
    </>
  );
}

function ProgressCard({ title, subtitle, pct, detail, benchmark, onClick }) {
  const capped = Math.min(Math.max(pct, 0), 150);
  const color = benchmark
    ? pct >= benchmark
      ? "bg-green-500"
      : pct >= benchmark * 0.9
      ? "bg-amber-500"
      : "bg-red-500"
    : "bg-blue-600";
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 p-5 ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <div className="flex items-center gap-2">
          {onClick && <span className="text-slate-400 text-[10px] font-normal">ver detalhe →</span>}
          <span className="text-2xl font-bold">{fmtPct(pct)}</span>
        </div>
      </div>
      <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
      <div className="mt-3 h-3 bg-slate-100 rounded-full overflow-hidden relative">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${(capped / 150) * 100}%` }}
        />
        {benchmark && (
          <div
            className="absolute top-0 bottom-0 w-px bg-slate-700"
            style={{ left: `${(benchmark / 150) * 100}%` }}
          />
        )}
      </div>
      <div className="text-xs text-slate-600 mt-2">{detail}</div>
    </div>
  );
}



// ---- Projection Accordion ----
const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function ProjectionAccordion({
  projection, projectionWithoutSuper, goal, closedDay, totalDays,
  dailyAvg, actual, daily, hasSuperDays, avgWithoutSuper,
  nonSuperCount, nonSuperTotalDays, superDaysCount, superDaysTotal,
}) {
  const [open, setOpen] = useState(false);

  // --- Média por dia da semana (excluindo Supersales) ---
  const byWeekday = {};
  const byWeekdayCount = {};
  daily.forEach((d) => {
    if (d.day > closedDay || d.cumulative === null || d.supersales) return;
    // Reconstruct the date for this day — we don't have year/month here,
    // but we use a trick: pass it via a ref. Instead, compute weekday index
    // from the day number. We'll need the first weekday of the month,
    // which we don't have directly. Use a workaround: store in parent.
    // Actually we can compute from `daily` index (day - 1).
    // We need the weekday of day 1 of the month. We don't have year/month
    // directly in this component. Use a data-driven approach instead.
    const weekdayIdx = d.weekday; // we'll add this to daily entries
    if (weekdayIdx === undefined) return;
    if (!byWeekday[weekdayIdx]) { byWeekday[weekdayIdx] = 0; byWeekdayCount[weekdayIdx] = 0; }
    byWeekday[weekdayIdx] += d.value;
    byWeekdayCount[weekdayIdx]++;
  });
  const weekdayStats = Object.keys(byWeekday).map((idx) => ({
    name: DAY_NAMES[idx],
    idx: Number(idx),
    avg: Math.round(byWeekday[idx] / byWeekdayCount[idx]),
    count: byWeekdayCount[idx],
  })).sort((a, b) => (a.idx === 0 ? 7 : a.idx) - (b.idx === 0 ? 7 : b.idx));

  const hasWeekdayData = weekdayStats.length > 0;
  const maxWeekdayAvg = hasWeekdayData ? Math.max(...weekdayStats.map((w) => w.avg)) : 1;

  // --- Projeção por dia da semana ---
  // actual já faturado + para cada dia restante, usa a média do seu dia da semana
  // Se não houver média para esse dia da semana, usa avgWithoutSuper como fallback
  const weekdayAvgMap = {};
  weekdayStats.forEach((w) => { weekdayAvgMap[w.idx] = w.avg; });
  let projectionWeekday = actual;
  const remainingDaysList = daily.filter((d) => d.day > closedDay);
  remainingDaysList.forEach((d) => {
    const wd = d.weekday;
    const avg = wd !== undefined && weekdayAvgMap[wd] !== undefined
      ? weekdayAvgMap[wd]
      : (avgWithoutSuper || 0);
    projectionWeekday += avg;
  });
  // Build breakdown for tooltip: list remaining weekdays and their expected value
  const remainingBreakdown = remainingDaysList.reduce((acc, d) => {
    const wd = d.weekday;
    const name = wd !== undefined ? DAY_NAMES[wd] : "?";
    const avg = wd !== undefined && weekdayAvgMap[wd] !== undefined
      ? weekdayAvgMap[wd]
      : (avgWithoutSuper || 0);
    if (!acc[name]) acc[name] = { count: 0, avg };
    acc[name].count++;
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header — always visible, clickable */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-700">Projeção de fecho do mês</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${
            projection >= goal ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
          }`}>
            {projection >= goal ? "✓ Atinge objetivo" : `Falta ${fmtEur(goal - projection)}`}
          </span>
        </div>
        <span className={`text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="border-t border-slate-100 px-5 pb-5 pt-4 space-y-5">

          {/* Three projection cards */}
          <div className="grid md:grid-cols-3 gap-4">
            {/* Com Supersales */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-1">
                    <div className="text-xs uppercase tracking-wide text-slate-500 font-medium">Com Supersales</div>
                    <span className="text-slate-400 text-xs cursor-help relative group">
                      ✱
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-slate-800 text-white text-xs rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 normal-case font-normal leading-relaxed">
                        Média diária de todos os {closedDay} dias fechados × {totalDays} dias do mês.
                      </span>
                    </span>
                  </div>
                  <div className="text-xs text-amber-600 font-medium mt-0.5 flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
                    Inclui dias Supersales
                  </div>
                  <div className="text-xl font-bold mt-2">{fmtEur(projection)}</div>
                  <div className="text-xs text-slate-500 mt-1">Ao ritmo atual ({fmtEur(closedDay > 0 ? actual / closedDay : 0)}/dia)</div>
                </div>
                <div className={`text-xs font-semibold px-2 py-1 rounded-lg flex-shrink-0 ${projection >= goal ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                  {projection >= goal ? "✓ Atinge objetivo" : `Falta ${fmtEur(goal - projection)}`}
                </div>
              </div>
            </div>

            {/* Sem Supersales */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-1">
                    <div className="text-xs uppercase tracking-wide text-slate-500 font-medium">Sem Supersales</div>
                    <span className="text-slate-400 text-xs cursor-help relative group">
                      ✱
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-800 text-white text-xs rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 normal-case font-normal leading-relaxed">
                        {hasSuperDays
                          ? `Média dos ${nonSuperCount} dias normais (${fmtEur(avgWithoutSuper)}/dia) × ${nonSuperTotalDays} dias normais do mês + faturação exata dos ${superDaysCount} dia(s) Supersales (${fmtEur(superDaysTotal)}).`
                          : "Sem dias de Supersales no período — igual à projeção padrão."}
                      </span>
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-slate-300" />
                    Sem dias Supersales
                  </div>
                  <div className="text-xl font-bold mt-2">{hasSuperDays ? fmtEur(projectionWithoutSuper) : fmtEur(projection)}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {hasSuperDays
                      ? `${fmtEur(avgWithoutSuper)}/dia × ${nonSuperTotalDays} dias + ${fmtEur(superDaysTotal)} Supersales`
                      : "Sem dias de Supersales no período"}
                  </div>
                </div>
                <div className={`text-xs font-semibold px-2 py-1 rounded-lg flex-shrink-0 ${(hasSuperDays ? projectionWithoutSuper : projection) >= goal ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                  {(hasSuperDays ? projectionWithoutSuper : projection) >= goal ? "✓ Atinge objetivo" : `Falta ${fmtEur(goal - (hasSuperDays ? projectionWithoutSuper : projection))}`}
                </div>
              </div>
            </div>

            {/* Por dia da semana */}
            {hasWeekdayData && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-1">
                      <div className="text-xs uppercase tracking-wide text-slate-500 font-medium">Por dia da semana</div>
                      <span className="text-slate-400 text-xs cursor-help relative group">
                        ✱
                        <span className="absolute top-full right-0 mt-1 w-64 bg-slate-800 text-white text-xs rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 normal-case font-normal leading-relaxed">
                          {`Faturação real dos ${closedDay} dias fechados (${fmtEur(actual)}) + para cada dia restante, a média histórica desse dia da semana (excl. Supersales). Dias sem histórico usam a média geral.`}
                        </span>
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-400" />
                      Ritmo por weekday
                    </div>
                    <div className="text-xl font-bold mt-2">{fmtEur(projectionWeekday)}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {fmtEur(actual)} real + {Object.entries(remainingBreakdown).map(([name, v]) => `${v.count}× ${name}`).join(", ")}
                    </div>
                  </div>
                  <div className={`text-xs font-semibold px-2 py-1 rounded-lg flex-shrink-0 ${projectionWeekday >= goal ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                    {projectionWeekday >= goal ? "✓ Atinge objetivo" : `Falta ${fmtEur(goal - projectionWeekday)}`}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Média por dia da semana — sub-accordion */}
          {hasWeekdayData && <WeekdayChart weekdayStats={weekdayStats} maxWeekdayAvg={maxWeekdayAvg} />}
        </div>
      )}
    </div>
  );
}


function WeekdayChart({ weekdayStats, maxWeekdayAvg }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <span className="text-xs uppercase tracking-wide text-slate-500 font-medium">
          Média por dia da semana <span className="normal-case font-normal text-slate-400">(excl. Supersales)</span>
        </span>
        <span className={`text-slate-400 text-sm transition-transform duration-200 ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="px-4 py-4 space-y-2 bg-white">
          {weekdayStats.map((w) => (
            <div key={w.idx} className="flex items-center gap-3">
              <div className="w-7 text-xs font-medium text-slate-500 text-right">{w.name}</div>
              <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${(w.avg / maxWeekdayAvg) * 100}%` }}
                />
              </div>
              <div className="w-24 text-xs font-semibold text-slate-700 text-right">{fmtEur(w.avg)}/dia</div>
              <div className="w-10 text-[10px] text-slate-400">({w.count}x)</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Daily Detail Modal ----
function DailyModal({ mode, daily, closedDay, goal, dailyAvg, scope, onClose }) {
  const titles = {
    faturado: "Faturado diário — detalhe",
    pctGoal: "% do objetivo mensal — evolução diária",
    pctExpected: "% vs. esperado — evolução diária",
  };

  const rows = daily
    .filter((d) => d.day <= closedDay && d.cumulative !== null)
    .map((d) => {
      const pctGoal = goal > 0 ? (d.cumulative / goal) * 100 : 0;
      const exp = dailyAvg * d.day;
      const pctExp = exp > 0 ? (d.cumulative / exp) * 100 : 0;
      return { ...d, pctGoal, pctExp };
    });

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h2 className="font-semibold text-slate-900">{titles[mode]}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {scope === "total" ? "Total" : `Equipa ${scope}`} · {closedDay} dias fechados
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl font-bold px-2"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left">Dia</th>
                {mode === "faturado" && (
                  <>
                    <th className="px-4 py-2 text-right">Acumulado</th>
                    <th className="px-4 py-2 text-right">+Nesse dia</th>
                  </>
                )}
                {mode === "pctGoal" && (
                  <>
                    <th className="px-4 py-2 text-right">Acumulado</th>
                    <th className="px-4 py-2 text-right">% do objetivo</th>
                  </>
                )}
                {mode === "pctExpected" && (
                  <>
                    <th className="px-4 py-2 text-right">Acumulado</th>
                    <th className="px-4 py-2 text-right">Esperado</th>
                    <th className="px-4 py-2 text-right">% vs. esperado</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr
                  key={d.day}
                  className={`border-t border-slate-100 ${d.supersales ? "bg-amber-50" : ""}`}
                >
                  <td className="px-4 py-2 font-medium text-slate-700">
                    {d.day}
                    {d.supersales && (
                      <span className="ml-1 inline-block w-2 h-2 rounded-full bg-amber-400" title="Supersales" />
                    )}
                  </td>
                  {mode === "faturado" && (
                    <>
                      <td className="px-4 py-2 text-right font-semibold">{fmtEur(d.cumulative)}</td>
                      <td className={`px-4 py-2 text-right text-xs ${d.value < 0 ? "text-red-500" : "text-slate-500"}`}>
                        {d.value >= 0 ? "+" : ""}{fmtEur(d.value)}
                      </td>
                    </>
                  )}
                  {mode === "pctGoal" && (
                    <>
                      <td className="px-4 py-2 text-right">{fmtEur(d.cumulative)}</td>
                      <td className={`px-4 py-2 text-right font-semibold ${d.pctGoal >= 100 ? "text-green-600" : "text-slate-700"}`}>
                        {fmtPct(d.pctGoal)}
                      </td>
                    </>
                  )}
                  {mode === "pctExpected" && (
                    <>
                      <td className="px-4 py-2 text-right">{fmtEur(d.cumulative)}</td>
                      <td className="px-4 py-2 text-right text-slate-400">{fmtEur(dailyAvg * d.day)}</td>
                      <td className={`px-4 py-2 text-right font-semibold ${
                        d.pctExp >= 100 ? "text-green-600" : d.pctExp >= 90 ? "text-amber-600" : "text-red-600"
                      }`}>
                        {fmtPct(d.pctExp)}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Entry({ data, setEntry, totalDays, closedDay, isCurrentMonth }) {
  const days = Array.from({ length: totalDays }, (_, i) => i + 1);
  const today = new Date();
  const todayDay = isCurrentMonth ? today.getDate() : null;
  const FIELDS = ["total", ...TEAMS];

  const deltas = useMemo(() => {
    const prev = { total: 0, PT: 0, IT: 0, ES: 0, FR: 0 };
    const byDay = {};
    for (let d = 1; d <= totalDays; d++) {
      const entry = data.entries[d] || {};
      const row = {};
      FIELDS.forEach((f) => {
        const raw = entry[f];
        const hasValue =
          raw !== undefined &&
          raw !== "" &&
          raw !== null &&
          !Number.isNaN(Number(raw));
        if (hasValue) {
          const cum = Number(raw);
          row[f] = cum - prev[f];
          prev[f] = cum;
        } else {
          row[f] = null;
        }
      });
      byDay[d] = row;
    }
    return byDay;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.entries, totalDays]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200">
        <h3 className="font-semibold text-slate-900">
          Registo diário de faturação
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Introduz o valor <strong>acumulado</strong> no final de cada dia
          (total corrente desde o início do mês). Por baixo aparece
          automaticamente quanto foi faturado nesse dia. Marca a caixa{" "}
          <strong>Supersales</strong> nos dias em que houve campanha de
          descontos.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left sticky left-0 bg-slate-50">
                Dia
              </th>
              <th className="px-3 py-2 text-right font-bold text-slate-900">
                Total
              </th>
              {TEAMS.map((t) => (
                <th
                  key={t}
                  className="px-3 py-2 text-right"
                  style={{ color: TEAM_COLORS[t] }}
                >
                  {t}
                </th>
              ))}
              <th className="px-3 py-2 text-center text-amber-700">
                Supersales
              </th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const entry = data.entries[d] || {};
              const delta = deltas[d];
              const isToday = todayDay === d;
              const isClosed = d <= closedDay;
              const isSupersales = entry.supersales === true;
              const renderDelta = (v) => {
                if (v === null || v === undefined) return "—";
                const sign = v < 0 ? "" : "+";
                return `${sign}${fmtEur(v)}`;
              };
              const rowBg = isSupersales
                ? "bg-amber-50"
                : isToday
                ? "bg-blue-50"
                : isClosed
                ? ""
                : "bg-slate-50/40";
              const stickyBg = isSupersales
                ? "bg-amber-50"
                : isToday
                ? "bg-blue-50"
                : "bg-white";
              return (
                <tr
                  key={d}
                  className={`border-t border-slate-100 ${rowBg}`}
                >
                  <td
                    className={`px-3 py-2 font-medium sticky left-0 align-top ${stickyBg}`}
                  >
                    {d}
                    {isToday && (
                      <span className="ml-1 text-xs text-blue-600">
                        (hoje)
                      </span>
                    )}
                    {isClosed && !isToday && (
                      <span className="ml-1 text-xs text-green-600">✓</span>
                    )}
                  </td>
                  <td className="px-2 py-1 text-right align-top">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={entry.total ?? ""}
                      onChange={(e) => setEntry(d, "total", e.target.value)}
                      placeholder="0"
                      className="w-28 text-right px-2 py-1 border-2 border-slate-300 rounded font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                    <div
                      className={`text-[10px] mt-0.5 pr-1 ${
                        delta.total !== null && delta.total < 0
                          ? "text-red-400"
                          : "text-slate-400"
                      }`}
                    >
                      {renderDelta(delta.total)}
                    </div>
                  </td>
                  {TEAMS.map((t) => (
                    <td key={t} className="px-2 py-1 text-right align-top">
                      <input
                        type="number"
                        inputMode="decimal"
                        value={entry[t] ?? ""}
                        onChange={(e) => setEntry(d, t, e.target.value)}
                        placeholder="0"
                        className="w-24 text-right px-2 py-1 border border-slate-200 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                      <div
                        className={`text-[10px] mt-0.5 pr-1 ${
                          delta[t] !== null && delta[t] < 0
                            ? "text-red-400"
                            : "text-slate-400"
                        }`}
                      >
                        {renderDelta(delta[t])}
                      </div>
                    </td>
                  ))}
                  <td className="px-2 py-1 text-center align-top">
                    <label className="inline-flex items-center justify-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSupersales}
                        onChange={(e) =>
                          setEntry(d, "supersales", e.target.checked)
                        }
                        className="w-5 h-5 rounded border-slate-300 text-amber-600 focus:ring-2 focus:ring-amber-500 cursor-pointer accent-amber-600"
                      />
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


// ── EntryRevenda — registo por valor do DIA (não acumulado) ──
function EntryRevenda({ monthNum, year, totalDays, closedDay, isCurrentMonth }) {
  const [entries, setEntries] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  const RKEY = `revenda-daily-${year}-${String(monthNum + 1).padStart(2, "0")}`;
  const today = new Date();
  const todayDay = isCurrentMonth ? today.getDate() : null;

  // Keep a ref to the latest entries so the debounced save always uses fresh data
  const entriesRef = React.useRef(entries);
  entriesRef.current = entries;

  useEffect(() => {
    setLoading(true);
    supabase.from("billing_months").select("entries").eq("month_key", RKEY).maybeSingle()
      .then(({ data: row }) => {
        setEntries(row?.entries || {});
        setLoading(false);
      });
  }, [RKEY]);

  // Debounced auto-save — fires 800ms after the last change
  const saveTimer = React.useRef(null);
  const triggerAutoSave = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaved(false);
    setSaving(false);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await supabase.from("billing_months").upsert(
        { month_key: RKEY, total_goal: 0, team_goals: {}, entries: entriesRef.current, updated_at: new Date().toISOString() },
        { onConflict: "month_key" }
      );
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }, 800);
  };

  // Clear timer on unmount
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const setField = (day, field, val) => {
    setEntries(prev => ({
      ...prev,
      [day]: {
        ...(prev[day] || {}),
        [field]: typeof val === "boolean" ? val : val === "" ? "" : Number(val),
      },
    }));
    triggerAutoSave();
  };

  // Compute totals per column (sum of all filled days)
  const totals = useMemo(() => {
    const t = { total: 0 };
    TEAMS.forEach(tm => { t[tm] = 0; });
    Object.values(entries).forEach(row => {
      if (!row || typeof row !== "object") return;
      TEAMS.forEach(tm => { t[tm] += Number(row[tm]) || 0; });
    });
    t.total = TEAMS.reduce((s, tm) => s + t[tm], 0);
    return t;
  }, [entries]);

  if (loading) return <div className="text-center py-12 text-slate-500">A carregar…</div>;

  const days = Array.from({ length: totalDays }, (_, i) => i + 1);
  const MONTH_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"][monthNum];

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-slate-900">Registo Revenda — {MONTH_PT} {year}</h3>
          <p className="text-xs text-slate-500 mt-1">
            Introduz o valor <strong>faturado no próprio dia</strong> (não acumulado)
            para cada mercado. Guardado automaticamente.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 text-xs">
          {saving && <span className="text-slate-400 animate-pulse">A guardar…</span>}
          {saved && !saving && <span className="text-green-600 font-medium">✓ Guardado</span>}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left sticky left-0 bg-slate-50">Dia</th>
              <th className="px-3 py-2 text-right font-bold text-slate-900">Total dia</th>
              {TEAMS.map(t => (
                <th key={t} className="px-3 py-2 text-right" style={{ color: TEAM_COLORS[t] }}>{t}</th>
              ))}
              <th className="px-3 py-2 text-center text-amber-700">SS</th>
            </tr>
          </thead>
          <tbody>
            {days.map(d => {
              const row = entries[d] || {};
              const isToday = todayDay === d;
              const isClosed = d <= closedDay;
              const isSupersales = row.supersales === true;
              // Compute day total from sum of team fields
              const dayTotal = TEAMS.reduce((s, t) => s + (Number(row[t]) || 0), 0);
              const rowBg = isSupersales ? "bg-amber-50" : isToday ? "bg-blue-50" : isClosed ? "" : "bg-slate-50/40";
              const stickyBg = isSupersales ? "bg-amber-50" : isToday ? "bg-blue-50" : "bg-white";
              return (
                <tr key={d} className={`border-t border-slate-100 ${rowBg}`}>
                  <td className={`px-3 py-2 font-medium sticky left-0 align-top ${stickyBg}`}>
                    {d}
                    {isToday && <span className="ml-1 text-xs text-blue-600">(hoje)</span>}
                    {isClosed && !isToday && <span className="ml-1 text-xs text-green-600">✓</span>}
                  </td>
                  {/* Total dia — calculado automaticamente */}
                  <td className="px-2 py-1 text-right align-top">
                    <div className="w-28 text-right px-2 py-1.5 font-bold text-slate-800">
                      {dayTotal > 0 ? fmtEur(dayTotal) : <span className="text-slate-300">—</span>}
                    </div>
                  </td>
                  {TEAMS.map(t => (
                    <td key={t} className="px-2 py-1 text-right align-top">
                      <input
                        type="number"
                        inputMode="decimal"
                        value={row[t] ?? ""}
                        onChange={e => setField(d, t, e.target.value)}
                        placeholder="0"
                        className="w-24 text-right px-2 py-1 border border-slate-200 rounded focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1 text-center align-top">
                    <label className="inline-flex items-center justify-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSupersales}
                        onChange={e => setField(d, "supersales", e.target.checked)}
                        className="w-5 h-5 rounded border-slate-300 text-amber-600 focus:ring-2 focus:ring-amber-500 cursor-pointer accent-amber-600"
                      />
                    </label>
                  </td>
                </tr>
              );
            })}

            {/* Linha total */}
            <tr className="border-t-2 border-slate-400 bg-slate-50 font-bold">
              <td className="px-3 py-3 sticky left-0 bg-slate-50 text-slate-700 text-xs uppercase tracking-wide">Total</td>
              <td className="px-2 py-3 text-right text-slate-900">{fmtEur(totals.total)}</td>
              {TEAMS.map(t => (
                <td key={t} className="px-2 py-3 text-right" style={{ color: TEAM_COLORS[t] }}>
                  {totals[t] > 0 ? fmtEur(totals[t]) : <span className="text-slate-300">—</span>}
                </td>
              ))}
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Setup({ data, setTotalGoal, setTeamGoal, distributeEqually, annualGoal, saveAnnualGoal, year }) {
  const equipas = ANALISE_TEAMS.filter(t => t.id !== "total");
  const sumEquipas = equipas.reduce((s, t) => s + (Number(data.teamGoals[t.id]) || 0), 0);
  const totalGoal = Number(data.totalGoal) || 0;
  const diff = totalGoal - sumEquipas;
  const [annualInput, setAnnualInput] = useState(annualGoal || "");

  React.useEffect(() => { setAnnualInput(annualGoal || ""); }, [annualGoal]);

  return (
    <div className="space-y-4">
      {/* Objetivo anual */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <Target className="w-4 h-4" /> Objetivo anual — {year}
        </h3>
        <p className="text-xs text-slate-500 mt-1">Objetivo total de faturação para o ano {year}.</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-slate-500">€</span>
          <input
            type="number"
            value={annualInput}
            onChange={(e) => setAnnualInput(e.target.value)}
            onBlur={(e) => saveAnnualGoal(e.target.value)}
            placeholder="ex: 15000000"
            className="flex-1 max-w-xs px-3 py-2 border border-slate-300 rounded-lg text-lg font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Objetivo total do mês */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <Target className="w-4 h-4" /> Objetivo total do mês
        </h3>
        <p className="text-xs text-slate-500 mt-1">Soma de todas as equipas. Usado no sub-tab "Total".</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-slate-500">€</span>
          <input
            type="number"
            value={data.totalGoal || ""}
            onChange={(e) => setTotalGoal(e.target.value)}
            placeholder="ex: 1300000"
            className="flex-1 max-w-xs px-3 py-2 border border-slate-300 rounded-lg text-lg font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Objetivos por equipa */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <div>
            <h3 className="font-semibold text-slate-900">Objetivos por equipa</h3>
            <p className="text-xs text-slate-500 mt-1">
              Equipa PT = Portugal + Outros · Equipa FR = França + CH-BNL-DEAT · Equipa NA = Chéquia + USA
            </p>
          </div>
          <button
            onClick={distributeEqually}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
          >
            Distribuir igualmente (÷5)
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {equipas.map((t) => (
            <div key={t.id} className="flex items-center gap-3 border border-slate-200 rounded-lg p-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white text-xs text-center leading-tight px-1"
                style={{ backgroundColor: ANALISE_COLORS[t.id] }}
              >
                {t.label.replace("Equipa ","")}
              </div>
              <div className="flex-1">
                <label className="text-xs text-slate-500">{t.label}</label>
                <p className="text-xs text-slate-400">{t.markets.join(" + ")}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-slate-400 text-sm">€</span>
                  <input
                    type="number"
                    value={data.teamGoals[t.id] || ""}
                    onChange={(e) => setTeamGoal(t.id, e.target.value)}
                    placeholder="0"
                    className="w-full px-2 py-1 border border-slate-200 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 rounded-lg text-sm bg-slate-50 border border-slate-200 flex items-center justify-between flex-wrap gap-2">
          <span>Soma das equipas: <strong>{fmtEur(sumEquipas)}</strong></span>
          <span>Objetivo total: <strong>{fmtEur(totalGoal)}</strong></span>
          {totalGoal > 0 && Math.abs(diff) > 0 && (
            <span className={diff < 0 ? "text-red-600" : "text-slate-600"}>
              Diferença: <strong>{diff > 0 ? "+" : ""}{fmtEur(diff)}</strong>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// History — visão anual por mês e equipa
// ============================================================
function History({ annualGoal: annualGoalProp, currentYear }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [annualGoal, setAnnualGoal] = useState(annualGoalProp || 0);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("billing_months")
        .select("*")
        .like("month_key", `${year}-%`)
        .order("month_key", { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error(error);
        setRows([]);
      } else {
        setRows(data || []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [year]);

  const monthsData = useMemo(() => {
    const byKey = {};
    rows.forEach((r) => {
      byKey[r.month_key] = r;
    });
    const result = [];
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, "0")}`;
      const row = byKey[key];
      const entries = row?.entries || {};
      const teamGoals = row?.team_goals || { PT: 0, IT: 0, ES: 0, FR: 0 };
      const totalGoal = Number(row?.total_goal) || 0;

      // Para cada âmbito, encontra o último valor acumulado preenchido
      // (os valores são cumulativos → o último dia dá o total do mês)
      const billed = { total: 0, PT: 0, IT: 0, ES: 0, FR: 0 };
      Object.keys(entries)
        .map((d) => Number(d))
        .sort((a, b) => a - b)
        .forEach((day) => {
          const e = entries[day] || {};
          ["total", "PT", "IT", "ES", "FR"].forEach((s) => {
            const v = e[s];
            if (
              v !== undefined &&
              v !== "" &&
              v !== null &&
              !Number.isNaN(Number(v))
            ) {
              billed[s] = Number(v);
            }
          });
        });

      result.push({
        month: m,
        monthName: MONTH_NAMES[m - 1],
        shortName: MONTH_NAMES[m - 1].slice(0, 3),
        totalGoal,
        teamGoals,
        billed,
        pctTotal: totalGoal > 0 ? (billed.total / totalGoal) * 100 : 0,
      });
    }
    return result;
  }, [rows, year]);

  const annualTotals = useMemo(() => {
    const t = {
      total: 0, PT: 0, IT: 0, ES: 0, FR: 0,
      totalGoal: 0,
      teamGoals: { PT: 0, IT: 0, ES: 0, FR: 0 },
    };
    monthsData.forEach((m) => {
      t.total += m.billed.total;
      t.PT += m.billed.PT;
      t.IT += m.billed.IT;
      t.ES += m.billed.ES;
      t.FR += m.billed.FR;
      t.totalGoal += m.totalGoal;
      TEAMS.forEach((team) => {
        t.teamGoals[team] += Number(m.teamGoals[team]) || 0;
      });
    });
    t.pctTotal = t.totalGoal > 0 ? (t.total / t.totalGoal) * 100 : 0;
    return t;
  }, [monthsData]);

  const bestMonth = useMemo(() => {
    const filled = monthsData.filter((m) => m.billed.total > 0);
    if (filled.length === 0) return null;
    return filled.reduce((a, b) => (b.billed.total > a.billed.total ? b : a));
  }, [monthsData]);

  // Load annual goal for selected year
  useEffect(() => {
    if (year === currentYear && annualGoalProp) {
      setAnnualGoal(annualGoalProp);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: row } = await supabase
        .from("billing_months")
        .select("total_goal")
        .eq("month_key", `${year}-annual`)
        .maybeSingle();
      if (!cancelled) setAnnualGoal(Number(row?.total_goal) || 0);
    })();
    return () => { cancelled = true; };
  }, [year, annualGoalProp, currentYear]);

  const yearOptions = useMemo(() => {
    const current = today.getFullYear();
    return [current - 2, current - 1, current, current + 1];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxBilled = Math.max(...monthsData.map((m) => m.billed.total), 1);
  const monthsWithData = monthsData.filter((m) => m.billed.total > 0).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Histórico anual</h2>

        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-500" />
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">
          <div className="text-4xl mb-3">⏳</div>
          <div className="text-sm">A carregar histórico…</div>
        </div>
      ) : (
        <>
          {/* KPI summary cards */}
          {(() => {
            const pctAnual = annualGoal > 0 ? (annualTotals.total / annualGoal) * 100 : null;
            const isAnualOver = pctAnual !== null && pctAnual >= 100;
            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="text-xs uppercase tracking-wide text-blue-600 font-medium">Total faturado</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">{fmtEur(annualTotals.total)}</div>
                  <div className="text-xs text-blue-600 mt-1">{year}</div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500 font-medium">Objetivo anual</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">{annualGoal > 0 ? fmtEur(annualGoal) : "—"}</div>
                  <div className="text-xs text-slate-400 mt-1">{annualGoal > 0 ? `${year}` : "não definido"}</div>
                </div>
                <div className={`rounded-xl p-4 border ${pctAnual === null ? "bg-white border-slate-200" : isAnualOver ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
                  <div className={`text-xs uppercase tracking-wide font-medium ${pctAnual === null ? "text-slate-500" : isAnualOver ? "text-green-600" : "text-amber-600"}`}>% do objetivo anual feito</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">{pctAnual !== null ? fmtPct(pctAnual) : "—"}</div>
                  <div className="text-xs text-slate-400 mt-1">{pctAnual !== null ? `${fmtEur(annualTotals.total)} de ${fmtEur(annualGoal)}` : "sem objetivo definido"}</div>
                </div>
              </div>
            );
          })()}



          {/* Monthly cards grid */}
          <div>
            <h3 className="font-semibold text-slate-800 mb-3">Detalhe mensal</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {monthsData.map((m) => {
                const hasData = m.billed.total > 0 || TEAMS.some((t) => m.billed[t] > 0);
                const today2 = new Date();
                const isCurrentMonth2 = m.month === today2.getMonth() + 1 && year === today2.getFullYear();
                const isPastMonth2 = new Date(year, m.month, 0) < new Date(today2.getFullYear(), today2.getMonth(), 1);
                const isOver = m.pctTotal >= 100;
                const isOngoing = !isPastMonth2 && isCurrentMonth2 && !isOver;
                // Border + bar color logic
                const borderClass = !hasData
                  ? "border-slate-100 opacity-50"
                  : isOver
                  ? "border-green-400"
                  : isOngoing
                  ? "border-amber-400"
                  : isPastMonth2 && hasData
                  ? "border-red-300"
                  : "border-slate-200";
                const barColor = isOver ? "bg-green-500" : isOngoing ? "bg-amber-400" : isPastMonth2 && hasData ? "bg-red-400" : "bg-blue-400";
                const barWidth = isOver ? 100 : m.totalGoal > 0 ? Math.min((m.billed.total / m.totalGoal) * 100, 100) : 0;
                return (
                  <div key={m.month} className={`bg-white rounded-xl border-2 p-4 ${borderClass}`}>
                    {/* Month header */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-slate-800">{m.monthName}</span>
                      {hasData && m.totalGoal > 0 && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isOver ? "bg-green-100 text-green-700" : isOngoing ? "bg-amber-100 text-amber-700" : isPastMonth2 ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600"}`}>
                          {fmtPct(m.pctTotal)}
                        </span>
                      )}
                    </div>
                    {/* Total + bar */}
                    <div className="text-xl font-bold text-slate-900">{hasData ? fmtEur(m.billed.total) : "—"}</div>
                    {m.totalGoal > 0 && (
                      <div className="text-xs text-slate-400 mt-0.5">obj. {fmtEur(m.totalGoal)}</div>
                    )}
                    {hasData && (
                      <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barColor}`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    )}
                    {/* Teams mini row */}
                    {hasData && (
                      <div className="mt-3 grid grid-cols-4 gap-1">
                        {TEAMS.map((t) => {
                          const billed = m.billed[t];
                          const goal = Number(m.teamGoals[t]) || 0;
                          const pctOfGoal = goal > 0 ? (billed / goal) * 100 : null;
                          const pctOfTotal = m.billed.total > 0 && billed > 0 ? (billed / m.billed.total) * 100 : null;
                          return (
                            <div key={t} className="text-center">
                              <div className="text-[10px] font-bold" style={{ color: TEAM_COLORS[t] }}>{t}</div>
                              <div className="text-[11px] font-semibold text-slate-700 mt-0.5">
                                {billed > 0 ? `${(billed / 1000).toFixed(0)}k` : "—"}
                              </div>
                              {pctOfTotal !== null && (
                                <div className="text-[9px] font-medium text-slate-400">
                                  {fmtPct(pctOfTotal)}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Annual totals footer */}
          <div className="bg-slate-800 text-white rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Total {year}</h3>

            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wide">Total</div>
                <div className="text-lg font-bold mt-1">{fmtEur(annualTotals.total)}</div>

              </div>
              {TEAMS.map((t) => (
                <div key={t}>
                  <div className="text-xs uppercase tracking-wide font-bold" style={{ color: TEAM_COLORS[t] }}>{t}</div>
                  <div className="text-lg font-bold mt-1">{annualTotals[t] > 0 ? fmtEur(annualTotals[t]) : "—"}</div>

                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// Password gate — bloqueia toda a aplicação até a password ser introduzida
// ============================================================
const SITE_PASSWORD =
  import.meta.env.VITE_SITE_PASSWORD || "Prozis12345";
const GATE_STORAGE_KEY = "faturacao_gate_unlocked_v1";

// ─── CONSTANTES PARTILHADAS ───────────────────────────────────────────────────

const MC_MARKETS = [
  { code: "PT",          name: "Portugal" },
  { code: "IT",          name: "Itália" },
  { code: "ES",          name: "Espanha" },
  { code: "FR",          name: "França" },
  { code: "CH-BNL-DEAT", name: "CH-BNL-DEAT" },
  { code: "CZ",          name: "Chéquia" },
  { code: "USA",         name: "USA" },
  { code: "OT",          name: "Outros" },
];

const MC_PROGRAMS = [
  "Professionals","Elite","Progym","Proteams",
  "Probox","Performance","Horeca","Corporate",
];

const MC_MONTHS_PT = [
  "","Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

function mcKey(year, monthNum) {
  return `closing-${year}-${String(monthNum+1).padStart(2,"0")}`;
}

function emptyClosing() {
  const mkt = {};
  MC_MARKETS.forEach(m => {
    mkt[m.code] = {
      afil_result: "", afil_prev: "",
      orders_curr: "", orders_prev: "",
      first_orders_curr: "", first_orders_prev: "",
      first_orders_rev_curr: "", first_orders_rev_prev: "",
      leads_curr: "", leads_prev: "",
    };
  });
  return {
    afil_objective: "", afil_result: "", afil_prev: "",
    revenda_margin: "", revenda_margin_prev: "",
    programs: Object.fromEntries(MC_PROGRAMS.map(p => [p, { curr: "", prev: "" }])),
    markets: mkt,
  };
}

async function loadClosing(year, monthNum) {
  const key = mcKey(year, monthNum);
  const { data } = await supabase
    .from("billing_months")
    .select("entries")
    .eq("month_key", key)
    .maybeSingle();
  if (data?.entries && Object.keys(data.entries).length > 0) return data.entries;
  return emptyClosing();
}

async function saveClosing(year, monthNum, closing) {
  const key = mcKey(year, monthNum);
  await supabase.from("billing_months").upsert(
    { month_key: key, total_goal: 0, team_goals: {}, entries: closing, updated_at: new Date().toISOString() },
    { onConflict: "month_key" }
  );
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function MCField({ label, value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-slate-500 font-medium leading-tight">{label}</label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="0"
        className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
      />
    </div>
  );
}

function MCCard({ title, accent, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-4">
      <h3 className={`font-semibold text-sm uppercase tracking-wide mb-4 ${accent || "text-orange-500"}`}>{title}</h3>
      {children}
    </div>
  );
}

function SaveBar({ saving, saved, onSave, label = "Guardar" }) {
  return (
    <div className="flex items-center justify-end gap-3 mt-2">
      {saved && <span className="text-sm text-green-600 font-medium">✓ Guardado</span>}
      <button
        onClick={onSave}
        disabled={saving}
        className="px-5 py-2 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition-colors disabled:opacity-60"
      >
        {saving ? "A guardar…" : `💾 ${label}`}
      </button>
    </div>
  );
}

// ─── AFILIAÇÃO (updated with closing form) ───────────────────────────────────

function AfiliacaoFecho({ monthNum, year, isAdmin }) {
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadClosing(year, monthNum).then(d => setData(d));
    setSaved(false);
  }, [year, monthNum]);

  const upMkt = (code, field, val) =>
    setData(p => ({ ...p, markets: { ...p.markets, [code]: { ...p.markets[code], [field]: val } } }));

  if (!data) return <div className="text-center py-8 text-slate-400 text-sm">A carregar…</div>;

  const onSave = async () => {
    setSaving(true);
    await saveClosing(year, monthNum, data);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-orange-500"/>
        <p className="text-sm text-slate-500">Fecho mensal · {MC_MONTHS_PT[monthNum+1]} {year}</p>
      </div>

      <MCCard title="Afiliação — Resultados globais">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <MCField label="Objetivo (€)" value={data.afil_objective} onChange={v => setData(p => ({...p, afil_objective: v}))} />
          <MCField label={`Resultado ${year-1} (€)`} value={data.afil_prev} onChange={v => setData(p => ({...p, afil_prev: v}))} />
          <MCField label={`Resultado ${year} (€)`} value={data.afil_result} onChange={v => setData(p => ({...p, afil_result: v}))} />
        </div>
      </MCCard>

      <MCCard title="Afiliação — Por mercado">
        {MC_MARKETS.map(m => (
          <div key={m.code} className="mb-4">
            <p className="text-sm font-semibold text-slate-700 mb-2">{m.name}</p>
            <div className="grid grid-cols-2 gap-3">
              <MCField label={`${year-1} (€)`} value={data.markets[m.code]?.afil_prev||""} onChange={v => upMkt(m.code,"afil_prev",v)} />
              <MCField label={`${year} (€)`} value={data.markets[m.code]?.afil_result||""} onChange={v => upMkt(m.code,"afil_result",v)} />
            </div>
          </div>
        ))}
      </MCCard>

      {isAdmin && <SaveBar saving={saving} saved={saved} onSave={onSave} />}
    </div>
  );
}

// ─── ENCOMENDAS ───────────────────────────────────────────────────────────────

function Encomendas({ monthNum, year, isAdmin }) {
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadClosing(year, monthNum).then(d => setData(d));
    setSaved(false);
  }, [year, monthNum]);

  const upMkt = (code, field, val) =>
    setData(p => ({ ...p, markets: { ...p.markets, [code]: { ...p.markets[code], [field]: val } } }));

  if (!data) return <div className="text-center py-8 text-slate-400 text-sm">A carregar…</div>;

  const onSave = async () => {
    setSaving(true);
    await saveClosing(year, monthNum, data);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-blue-500"/>
        <p className="text-sm text-slate-500">Fecho mensal · {MC_MONTHS_PT[monthNum+1]} {year}</p>
      </div>

      {MC_MARKETS.map(m => (
        <MCCard key={m.code} title={m.name} accent="text-blue-600">
          <div className="grid grid-cols-3 gap-4">
            {/* Col 1: Encomendas */}
            <div className="flex flex-col gap-2">
              <MCField label={`Encomendas ${year-1}`} value={data.markets[m.code]?.orders_prev||""} onChange={v => upMkt(m.code,"orders_prev",v)} />
              <MCField label={`Encomendas ${year}`} value={data.markets[m.code]?.orders_curr||""} onChange={v => upMkt(m.code,"orders_curr",v)} />
            </div>
            {/* Col 2: 1ªs enc. */}
            <div className="flex flex-col gap-2">
              <MCField label={`1ªs enc. ${year-1}`} value={data.markets[m.code]?.first_orders_prev||""} onChange={v => upMkt(m.code,"first_orders_prev",v)} />
              <MCField label={`1ªs enc. ${year}`} value={data.markets[m.code]?.first_orders_curr||""} onChange={v => upMkt(m.code,"first_orders_curr",v)} />
            </div>
            {/* Col 3: Fat. 1ªs enc. */}
            <div className="flex flex-col gap-2">
              <MCField label={`Fat. 1ªs enc. ${year-1} (€)`} value={data.markets[m.code]?.first_orders_rev_prev||""} onChange={v => upMkt(m.code,"first_orders_rev_prev",v)} />
              <MCField label={`Fat. 1ªs enc. ${year} (€)`} value={data.markets[m.code]?.first_orders_rev_curr||""} onChange={v => upMkt(m.code,"first_orders_rev_curr",v)} />
            </div>
          </div>
        </MCCard>
      ))}

      {isAdmin && <SaveBar saving={saving} saved={saved} onSave={onSave} />}
    </div>
  );
}

// ─── LEADS / PARCERIAS ────────────────────────────────────────────────────────

function LeadsParcerias({ monthNum, year, isAdmin }) {
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadClosing(year, monthNum).then(d => setData(d));
    setSaved(false);
  }, [year, monthNum]);

  const upMkt = (code, field, val) =>
    setData(p => ({ ...p, markets: { ...p.markets, [code]: { ...p.markets[code], [field]: val } } }));

  if (!data) return <div className="text-center py-8 text-slate-400 text-sm">A carregar…</div>;

  const onSave = async () => {
    setSaving(true);
    await saveClosing(year, monthNum, data);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-purple-500"/>
        <p className="text-sm text-slate-500">Fecho mensal · {MC_MONTHS_PT[monthNum+1]} {year}</p>
      </div>

      {MC_MARKETS.map(m => (
        <MCCard key={m.code} title={m.name} accent="text-purple-600">
          <div className="grid grid-cols-2 gap-3">
            <MCField label={`Leads ${year-1}`} value={data.markets[m.code]?.leads_prev||""} onChange={v => upMkt(m.code,"leads_prev",v)} />
            <MCField label={`Leads ${year}`} value={data.markets[m.code]?.leads_curr||""} onChange={v => upMkt(m.code,"leads_curr",v)} />
          </div>
        </MCCard>
      ))}

      {isAdmin && <SaveBar saving={saving} saved={saved} onSave={onSave} />}
    </div>
  );
}


// ─── RELATÓRIO (auto-fill version) ───────────────────────────────────────────

function Relatorio({ monthNum, year }) {
  const [step, setStep] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  // All form state
  const [rev, setRev] = useState({
    result: 0, objective: 0, margin_pct: "",
    margin_pct_prev: "",
    q_result_prev_year: "", q_objective: "", q_result: "",
    q_month1_revenue: "", q_month1_evolution: "", q_month1_margin: "",
    q_month2_revenue: "", q_month2_evolution: "", q_month2_margin: "",
    q_month3_revenue: "", q_month3_evolution: "", q_month3_margin: "",
    prev_year: "",
    byMarket: Object.fromEntries(MC_MARKETS.map(m => [m.code, { curr: 0, prev: "" }])),
  });
  const [afil, setAfil] = useState({
    objective: "", result: "", prev_year: "",
    byMarket: Object.fromEntries(MC_MARKETS.map(m => [m.code, { curr: "", prev: "" }])),
  });
  const [orders, setOrders] = useState({
    byMarket: Object.fromEntries(MC_MARKETS.map(m => [m.code, {
      orders_curr:"", orders_prev:"",
      first_curr:"", first_prev:"",
      first_rev_curr:"", first_rev_prev:"",
    }])),
  });
  const [leads, setLeads] = useState({
    byMarket: Object.fromEntries(MC_MARKETS.map(m => [m.code, { curr:"", prev:"" }])),
  });
  const [programs, setPrograms] = useState(
    Object.fromEntries(MC_PROGRAMS.map(p => [p, { curr:"", prev:"" }]))
  );

  // Auto-fill from Supabase
  useEffect(() => {
    (async () => {
      setLoading(true);
      const monthKey = `${year}-${String(monthNum+1).padStart(2,"0")}`;

      // 1. Revenda from billing_months
      const { data: bm } = await supabase
        .from("billing_months")
        .select("*")
        .eq("month_key", monthKey)
        .maybeSingle();

      // 2. Closing data (afil, encomendas, leads, programs, margins)
      const closing = await loadClosing(year, monthNum);

      // Build revenda by market from last entry
      const byMarket = Object.fromEntries(MC_MARKETS.map(m => [m.code, { curr: 0, prev: "" }]));
      if (bm?.entries) {
        const days = Object.keys(bm.entries).map(Number).sort((a,b)=>a-b);
        const lastDay = days[days.length - 1];
        if (lastDay) {
          const lastEntry = bm.entries[String(lastDay)];
          MC_MARKETS.forEach(m => {
            if (lastEntry?.[m.code]) byMarket[m.code].curr = lastEntry[m.code];
          });
        }
      }

      // Fill closing market data into byMarket prev
      if (closing?.markets) {
        MC_MARKETS.forEach(m => {
          const d = closing.markets[m.code] || {};
          byMarket[m.code].prev = d.afil_prev || "";
        });
      }

      // Restore manual fields from closing
      const savedByMkt = closing?.revenda_by_market || {};
      MC_MARKETS.forEach(m => {
        if (savedByMkt[m.code]?.prev) byMarket[m.code].prev = savedByMkt[m.code].prev;
      });

      setRev(p => ({
        ...p,
        result: bm?.entries ? (() => {
          const days = Object.keys(bm.entries).map(Number).sort((a,b)=>a-b);
          const lastEntry = bm.entries[String(days[days.length-1])] || {};
          return lastEntry.total || Object.values(lastEntry).reduce((s,v) => typeof v==="number"?s+v:s, 0);
        })() : 0,
        objective: bm?.total_goal || 0,
        margin_pct:          closing?.revenda_margin || "",
        margin_pct_prev:     closing?.revenda_margin_prev || "",
        prev_year:           closing?.revenda_prev || "",
        q_result_prev_year:  closing?.q_result_prev_year || "",
        q_objective:         closing?.q_objective || "",
        q_result:            closing?.q_result || "",
        q_month1_revenue:    closing?.q_month1_revenue || "",
        q_month1_evolution:  closing?.q_month1_evolution || "",
        q_month1_margin:     closing?.q_month1_margin || "",
        q_month2_revenue:    closing?.q_month2_revenue || "",
        q_month2_evolution:  closing?.q_month2_evolution || "",
        q_month2_margin:     closing?.q_month2_margin || "",
        q_month3_revenue:    closing?.q_month3_revenue || "",
        q_month3_evolution:  closing?.q_month3_evolution || "",
        q_month3_margin:     closing?.q_month3_margin || "",
        byMarket,
      }));

      setAfil({
        objective: closing?.afil_objective || "",
        result: closing?.afil_result || "",
        prev_year: closing?.afil_prev || "",
        byMarket: Object.fromEntries(MC_MARKETS.map(m => [m.code, {
          curr: closing?.markets?.[m.code]?.afil_result || "",
          prev: closing?.markets?.[m.code]?.afil_prev || "",
        }])),
      });

      setOrders({
        byMarket: Object.fromEntries(MC_MARKETS.map(m => [m.code, {
          orders_curr: closing?.markets?.[m.code]?.orders_curr || "",
          orders_prev: closing?.markets?.[m.code]?.orders_prev || "",
          first_curr:  closing?.markets?.[m.code]?.first_orders_curr || "",
          first_prev:  closing?.markets?.[m.code]?.first_orders_prev || "",
          first_rev_curr: closing?.markets?.[m.code]?.first_orders_rev_curr || "",
          first_rev_prev: closing?.markets?.[m.code]?.first_orders_rev_prev || "",
        }])),
      });

      setLeads({
        byMarket: Object.fromEntries(MC_MARKETS.map(m => [m.code, {
          curr: closing?.markets?.[m.code]?.leads_curr || "",
          prev: closing?.markets?.[m.code]?.leads_prev || "",
        }])),
      });

      if (closing?.programs) {
        setPrograms(Object.fromEntries(MC_PROGRAMS.map(p => [p, {
          curr: closing.programs[p]?.curr || "",
          prev: closing.programs[p]?.prev || "",
        }])));
      }

      setLoading(false);
    })();
  }, [monthNum, year]);

  const N = s => parseFloat(s) || 0;
  const fmtE = n => n == null ? "–" : new Intl.NumberFormat("fr-FR").format(n) + " €";
  const fmtP = (n, sign=false) => {
    if (n == null || isNaN(n)) return "–";
    const s = Math.abs(n).toFixed(2) + "%";
    if (sign) return (n>=0?"+":"-")+s;
    return s;
  };
  const evo = (prev, curr) => {
    if (!prev) return "–";
    const e = ((curr-prev)/prev)*100;
    return fmtP(e, true);
  };

  const MONTHS_UPPER = MC_MONTHS_PT.map(m => m.toUpperCase());
  const [savingDraft, setSavingDraft] = useState(false);
  const [savedDraft, setSavedDraft] = useState(false);

  async function saveDraft() {
    setSavingDraft(true);
    const existing = await loadClosing(year, monthNum);
    const merged = {
      ...existing,
      revenda_margin:      rev.margin_pct,
      revenda_margin_prev: rev.margin_pct_prev,
      revenda_prev:        rev.prev_year,
      revenda_by_market:   Object.fromEntries(MC_MARKETS.map(m => [m.code, { prev: rev.byMarket[m.code]?.prev || "" }])),
      afil_objective:      afil.objective,
      afil_result:         afil.result,
      afil_prev:           afil.prev_year,
      q_result_prev_year:  rev.q_result_prev_year,
      q_objective:         rev.q_objective,
      q_result:            rev.q_result,
      q_month1_revenue:    rev.q_month1_revenue,
      q_month1_evolution:  rev.q_month1_evolution,
      q_month1_margin:     rev.q_month1_margin,
      q_month2_revenue:    rev.q_month2_revenue,
      q_month2_evolution:  rev.q_month2_evolution,
      q_month2_margin:     rev.q_month2_margin,
      q_month3_revenue:    rev.q_month3_revenue,
      q_month3_evolution:  rev.q_month3_evolution,
      q_month3_margin:     rev.q_month3_margin,
      programs:            Object.fromEntries(MC_PROGRAMS.map(p => [p, { curr: programs[p]?.curr || "", prev: programs[p]?.prev || "" }])),
      markets: Object.fromEntries(MC_MARKETS.map(m => [m.code, {
        ...(existing?.markets?.[m.code] || {}),
        afil_result:             afil.byMarket[m.code]?.curr || "",
        afil_prev:               afil.byMarket[m.code]?.prev || "",
        orders_curr:             orders.byMarket[m.code]?.orders_curr || "",
        orders_prev:             orders.byMarket[m.code]?.orders_prev || "",
        first_orders_curr:       orders.byMarket[m.code]?.first_curr || "",
        first_orders_prev:       orders.byMarket[m.code]?.first_prev || "",
        first_orders_rev_curr:   orders.byMarket[m.code]?.first_rev_curr || "",
        first_orders_rev_prev:   orders.byMarket[m.code]?.first_rev_prev || "",
        leads_curr:              leads.byMarket[m.code]?.curr || "",
        leads_prev:              leads.byMarket[m.code]?.prev || "",
      }])),
    };
    await saveClosing(year, monthNum, merged);
    setSavingDraft(false);
    setSavedDraft(true);
    setTimeout(() => setSavedDraft(false), 3000);
  }

  async function generatePptx() {
    setGenerating(true);
    await saveDraft(); // auto-save before generating
    try {
      const { default: PptxGenJS } = await import("https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js");
      const prs = new PptxGenJS();
      prs.layout = "LAYOUT_WIDE";
      prs.title = `Apresentação de Resultados – ${MC_MONTHS_PT[monthNum+1]} ${year}`;
      const C = { black:"1A1A1A", white:"FFFFFF", gray:"F2F2F2", grayDark:"6B6B6B",
        accent:"FF6B00", blue:"0D3B66", green:"00A86B", red:"E53935",
        tableHead:"1A1A1A", r1:"FFFFFF", r2:"F7F7F7" };
      const W=13.33, H=7.5;
      const mLabel = MONTHS_UPPER[monthNum+1];

      function addSep(dept, num) {
        const s = prs.addSlide(); s.background={color:C.blue};
        s.addText("DEPARTAMENTO",{x:1,y:2.2,w:11,h:0.6,fontSize:14,color:C.white,fontFace:"Calibri",charSpacing:6,transparency:30});
        s.addText(dept,{x:1,y:2.9,w:9,h:1.4,fontSize:72,bold:true,color:C.white,fontFace:"Calibri"});
        s.addText(num,{x:11.5,y:5.8,w:1.5,h:1.2,fontSize:80,bold:true,color:C.accent,fontFace:"Calibri",align:"right"});
      }

      function addResult(dept, subtitle, prevYear, objective, result) {
        const s = prs.addSlide(); s.background={color:C.white};
        const evoPct = prevYear?((result-prevYear)/prevYear*100):0;
        const objPct = objective?(result/objective*100):0;
        s.addText(dept,{x:0.4,y:0.15,w:6,h:0.35,fontSize:11,bold:true,color:C.accent,fontFace:"Calibri",charSpacing:3});
        s.addText(subtitle,{x:0.4,y:0.48,w:9,h:0.3,fontSize:9,color:C.grayDark,fontFace:"Calibri"});
        s.addShape(prs.ShapeType.line,{x:0.4,y:0.82,w:W-0.8,h:0,line:{color:C.gray,width:1}});
        [{label:"RESULTADO "+(year-1),value:fmtE(prevYear)},
         {label:"OBJETIVO "+year,value:fmtE(objective)},
         {label:"RESULTADO "+year,value:fmtE(result),sub:fmtP(evoPct,true)+" vs "+(year-1)}]
        .forEach((item,i)=>{
          const y2=1.1+i*1.6, isLast=i===2;
          s.addText(item.label,{x:0.4,y:y2,w:5.5,h:0.3,fontSize:9,color:C.grayDark,fontFace:"Calibri"});
          s.addText(item.value,{x:0.4,y:y2+0.28,w:5.5,h:0.7,fontSize:isLast?36:28,bold:true,color:isLast?C.accent:C.black,fontFace:"Calibri"});
          if(item.sub) s.addText(item.sub,{x:0.4,y:y2+0.98,w:5.5,h:0.3,fontSize:13,color:evoPct>=0?C.green:C.red,fontFace:"Calibri",bold:true});
        });
        [{label:"Evolução vs "+(year-1),value:fmtP(evoPct,true)},
         {label:"Ganho absoluto",value:(result-prevYear>=0?"+":"")+fmtE(result-prevYear)},
         {label:"Acima do objetivo",value:(result-objective>=0?"+":"")+fmtE(result-objective)},
         {label:"% do objetivo",value:fmtP(objPct)}]
        .forEach((m2,i)=>{
          const x2=6.8+(i%2)*3.0,y2=1.8+Math.floor(i/2)*1.6;
          s.addText(m2.label,{x:x2,y:y2,w:2.8,h:0.3,fontSize:8,color:C.grayDark,fontFace:"Calibri"});
          s.addText(m2.value,{x:x2,y:y2+0.28,w:2.8,h:0.7,fontSize:22,bold:true,color:C.blue,fontFace:"Calibri"});
        });
      }

      function mktTable(slide, rows) {
        slide.addTable(rows,{x:0.4,y:1.1,w:12.4,colW:[3,1.8,1.8,1.6,1.6,1.1,1.5],
          border:{type:"solid",color:C.gray,pt:0.5},rowH:0.48});
      }

      // ── Slide 1: Capa ──
      const s1=prs.addSlide(); s1.background={color:C.black};
      s1.addShape(prs.ShapeType.rect,{x:0,y:0,w:0.18,h:H,fill:{color:C.accent}});
      s1.addText(MONTHS_UPPER[monthNum+1]+" "+year,{x:0.5,y:1.8,w:6,h:0.8,fontSize:28,bold:true,color:C.accent,fontFace:"Calibri"});
      s1.addText("Apresentação\nde resultados",{x:0.5,y:2.5,w:8,h:2,fontSize:54,bold:true,color:C.white,fontFace:"Calibri",breakLine:true});
      s1.addText("PROZIS PARTNERS",{x:0.5,y:5.2,w:6,h:0.5,fontSize:18,bold:true,color:C.grayDark,fontFace:"Calibri",charSpacing:4});

      // ── Slides REVENDA ──
      addSep("REVENDA","1");
      addResult("REVENDA",mLabel+" "+year+" – em comparação ao ano anterior",N(rev.prev_year),N(rev.objective),N(rev.result));

      // Trimestre
      const sQ=prs.addSlide(); sQ.background={color:C.white};
      sQ.addText("REVENDA",{x:0.4,y:0.15,w:5,h:0.35,fontSize:11,bold:true,color:C.accent,fontFace:"Calibri",charSpacing:3});
      sQ.addText("Trimestre",{x:0.4,y:0.48,w:9,h:0.3,fontSize:9,color:C.grayDark,fontFace:"Calibri"});
      sQ.addShape(prs.ShapeType.line,{x:0.4,y:0.82,w:W-0.8,h:0,line:{color:C.gray,width:1}});
      const qPrev=N(rev.q_result_prev_year),qObj=N(rev.q_objective),qRes=N(rev.q_result),qEvo=qPrev?((qRes-qPrev)/qPrev*100):0;
      sQ.addText("RESULTADO TRIMESTRE "+(year-1),{x:0.4,y:1.0,w:5,h:0.3,fontSize:9,color:C.grayDark,fontFace:"Calibri"});
      sQ.addText(fmtE(qPrev),{x:0.4,y:1.28,w:5,h:0.55,fontSize:24,bold:true,color:C.black,fontFace:"Calibri"});
      sQ.addText("OBJETIVO TRIMESTRE "+year,{x:0.4,y:2.0,w:5,h:0.3,fontSize:9,color:C.grayDark,fontFace:"Calibri"});
      sQ.addText(fmtE(qObj),{x:0.4,y:2.28,w:5,h:0.55,fontSize:24,bold:true,color:C.black,fontFace:"Calibri"});
      sQ.addText("RESULTADO TRIMESTRE "+year,{x:0.4,y:3.3,w:5,h:0.3,fontSize:9,color:C.grayDark,fontFace:"Calibri"});
      sQ.addText(fmtE(qRes),{x:0.4,y:3.58,w:5.5,h:0.7,fontSize:32,bold:true,color:C.accent,fontFace:"Calibri"});
      sQ.addText(fmtP(qEvo,true)+" vs "+(year-1),{x:0.4,y:4.25,w:5,h:0.3,fontSize:13,bold:true,color:qEvo>=0?C.green:C.red,fontFace:"Calibri"});
      const qMonths=(m=>{if(m<3)return[1,2,3];if(m<6)return[4,5,6];if(m<9)return[7,8,9];return[10,11,12]})(monthNum);
      const qRows=[
        [{text:"MÉTRICA",options:{bold:true,color:C.white,fill:{color:C.tableHead},fontSize:9}},
         ...qMonths.map(mn=>({text:MONTHS_UPPER[mn],options:{bold:true,color:C.white,fill:{color:C.tableHead},fontSize:9}}))],
        [{text:"FATURAÇÃO",options:{fontSize:9}},
         {text:String(N(rev.q_month1_revenue)),options:{fontSize:9,bold:true}},
         {text:String(N(rev.q_month2_revenue)),options:{fontSize:9,bold:true}},
         {text:String(N(rev.q_month3_revenue)),options:{fontSize:9,bold:true}}],
        [{text:"EVOLUÇÃO vs ANO ANTERIOR",options:{fontSize:9}},
         {text:fmtP(N(rev.q_month1_evolution),true),options:{fontSize:9,color:N(rev.q_month1_evolution)>=0?C.green:C.red}},
         {text:fmtP(N(rev.q_month2_evolution),true),options:{fontSize:9,color:N(rev.q_month2_evolution)>=0?C.green:C.red}},
         {text:fmtP(N(rev.q_month3_evolution),true),options:{fontSize:9,color:N(rev.q_month3_evolution)>=0?C.green:C.red}}],
        [{text:"MARGEM",options:{fontSize:9}},
         {text:fmtP(N(rev.q_month1_margin)),options:{fontSize:9}},
         {text:fmtP(N(rev.q_month2_margin)),options:{fontSize:9}},
         {text:fmtP(N(rev.q_month3_margin)),options:{fontSize:9}}],
      ];
      sQ.addTable(qRows,{x:6.8,y:1.0,w:6.1,colW:[2.5,1.2,1.2,1.2],border:{type:"solid",color:C.gray,pt:0.5},rowH:0.5});

      // Revenda por mercado
      const sRM=prs.addSlide(); sRM.background={color:C.white};
      sRM.addText("REVENDA",{x:0.4,y:0.15,w:5,h:0.35,fontSize:11,bold:true,color:C.accent,fontFace:"Calibri",charSpacing:3});
      sRM.addText("Distribuição por mercado",{x:0.4,y:0.48,w:9,h:0.3,fontSize:9,color:C.grayDark,fontFace:"Calibri"});
      sRM.addShape(prs.ShapeType.line,{x:0.4,y:0.82,w:W-0.8,h:0,line:{color:C.gray,width:1}});
      const rmRows=[
        [{text:"MERCADO",options:{bold:true,color:C.white,fill:{color:C.tableHead},fontSize:9}},
         {text:mLabel+" "+year,options:{bold:true,color:C.white,fill:{color:C.tableHead},fontSize:9,align:"right"}},
         {text:mLabel+" "+(year-1),options:{bold:true,color:C.white,fill:{color:C.tableHead},fontSize:9,align:"right"}},
         {text:"EVOLUÇÃO",options:{bold:true,color:C.white,fill:{color:C.tableHead},fontSize:9,align:"right"}}],
        ...MC_MARKETS.map((m,i)=>{
          const curr=N(rev.byMarket[m.code]?.curr),prev=N(rev.byMarket[m.code]?.prev);
          const e=evo(prev,curr); const bg=i%2===0?C.r1:C.r2;
          return [{text:m.name,options:{fontSize:9,fill:{color:bg}}},
            {text:fmtE(curr),options:{fontSize:9,bold:true,align:"right",fill:{color:bg}}},
            {text:fmtE(prev),options:{fontSize:9,align:"right",fill:{color:bg}}},
            {text:e,options:{fontSize:9,align:"right",fill:{color:bg},color:e.startsWith("+")?C.green:C.red}}];
        }),
      ];
      sRM.addTable(rmRows,{x:0.4,y:1.1,w:8,colW:[3,2,2,1],border:{type:"solid",color:C.gray,pt:0.5},rowH:0.52});

      // Programas
      const sProg=prs.addSlide(); sProg.background={color:C.white};
      sProg.addText("REVENDA",{x:0.4,y:0.15,w:5,h:0.35,fontSize:11,bold:true,color:C.accent,fontFace:"Calibri",charSpacing:3});
      sProg.addText("Distribuição por programa",{x:0.4,y:0.48,w:9,h:0.3,fontSize:9,color:C.grayDark,fontFace:"Calibri"});
      sProg.addShape(prs.ShapeType.line,{x:0.4,y:0.82,w:W-0.8,h:0,line:{color:C.gray,width:1}});
      const progRows=[
        [{text:"PROGRAMA",options:{bold:true,color:C.white,fill:{color:C.tableHead},fontSize:9}},
         {text:mLabel+" "+year,options:{bold:true,color:C.white,fill:{color:C.tableHead},fontSize:9,align:"right"}},
         {text:mLabel+" "+(year-1),options:{bold:true,color:C.white,fill:{color:C.tableHead},fontSize:9,align:"right"}},
         {text:"EVOLUÇÃO",options:{bold:true,color:C.white,fill:{color:C.tableHead},fontSize:9,align:"right"}}],
        ...MC_PROGRAMS
          .filter(p=>N(programs[p]?.curr)>0||N(programs[p]?.prev)>0)
          .sort((a,b)=>N(programs[b]?.curr)-N(programs[a]?.curr))
          .map((p,i)=>{
            const curr=N(programs[p]?.curr),prev=N(programs[p]?.prev);
            const e=evo(prev,curr); const bg=i%2===0?C.r1:C.r2;
            return [{text:p,options:{fontSize:9,fill:{color:bg}}},
              {text:fmtE(curr),options:{fontSize:9,bold:true,align:"right",fill:{color:bg}}},
              {text:fmtE(prev),options:{fontSize:9,align:"right",fill:{color:bg}}},
              {text:e,options:{fontSize:9,align:"right",fill:{color:bg},color:e.startsWith("+")?C.green:C.red}}];
          }),
      ];
      sProg.addTable(progRows,{x:0.4,y:1.1,w:8,colW:[3,2,2,1],border:{type:"solid",color:C.gray,pt:0.5},rowH:0.52});

      // ── Slides AFILIAÇÃO ──
      addSep("AFILIAÇÃO","2");
      addResult("AFILIAÇÃO",mLabel+" "+year+" – em comparação ao ano anterior",N(afil.prev_year),N(afil.objective),N(afil.result));

      const sAM=prs.addSlide(); sAM.background={color:C.white};
      sAM.addText("AFILIAÇÃO",{x:0.4,y:0.15,w:5,h:0.35,fontSize:11,bold:true,color:C.accent,fontFace:"Calibri",charSpacing:3});
      sAM.addText("Distribuição por mercado",{x:0.4,y:0.48,w:9,h:0.3,fontSize:9,color:C.grayDark,fontFace:"Calibri"});
      sAM.addShape(prs.ShapeType.line,{x:0.4,y:0.82,w:W-0.8,h:0,line:{color:C.gray,width:1}});
      const amRows=[
        [{text:"MERCADO",options:{bold:true,color:C.white,fill:{color:C.tableHead},fontSize:9}},
         {text:mLabel+" "+year,options:{bold:true,color:C.white,fill:{color:C.tableHead},fontSize:9,align:"right"}},
         {text:mLabel+" "+(year-1),options:{bold:true,color:C.white,fill:{color:C.tableHead},fontSize:9,align:"right"}},
         {text:"EVOLUÇÃO",options:{bold:true,color:C.white,fill:{color:C.tableHead},fontSize:9,align:"right"}}],
        ...MC_MARKETS.map((m,i)=>{
          const curr=N(afil.byMarket[m.code]?.curr),prev=N(afil.byMarket[m.code]?.prev);
          const e=evo(prev,curr); const bg=i%2===0?C.r1:C.r2;
          return [{text:m.name,options:{fontSize:9,fill:{color:bg}}},
            {text:fmtE(curr),options:{fontSize:9,bold:true,align:"right",fill:{color:bg}}},
            {text:fmtE(prev),options:{fontSize:9,align:"right",fill:{color:bg}}},
            {text:e,options:{fontSize:9,align:"right",fill:{color:bg},color:e.startsWith("+")?C.green:C.red}}];
        }),
      ];
      sAM.addTable(amRows,{x:0.4,y:1.1,w:8,colW:[3,2,2,1],border:{type:"solid",color:C.gray,pt:0.5},rowH:0.52});

      // ── Slides TOTAL ──
      addSep("TOTAL","3");
      const totalResult=N(rev.result)+N(afil.result);
      const totalPrev=N(rev.prev_year)+N(afil.prev_year);
      const totalObj=N(rev.objective)+N(afil.objective);
      addResult("REVENDA + AFILIAÇÃO",mLabel+" "+year+" – em comparação ao ano anterior",totalPrev,totalObj,totalResult);

      // Total breakdown
      const sT=prs.addSlide(); sT.background={color:C.white};
      sT.addText("REVENDA + AFILIAÇÃO",{x:0.4,y:0.15,w:8,h:0.35,fontSize:11,bold:true,color:C.accent,fontFace:"Calibri",charSpacing:3});
      sT.addShape(prs.ShapeType.line,{x:0.4,y:0.82,w:W-0.8,h:0,line:{color:C.gray,width:1}});
      sT.addText("TOTAL "+year,{x:0.4,y:1.0,w:5,h:0.3,fontSize:9,color:C.grayDark,fontFace:"Calibri"});
      sT.addText(fmtE(totalResult),{x:0.4,y:1.28,w:7,h:0.8,fontSize:40,bold:true,color:C.accent,fontFace:"Calibri"});
      const revPct=totalResult>0?N(rev.result)/totalResult*100:0;
      const afPct=totalResult>0?N(afil.result)/totalResult*100:0;
      [{label:"REVENDA",color:C.blue,val:N(rev.result),pct:revPct},
       {label:"AFILIAÇÃO",color:C.accent,val:N(afil.result),pct:afPct}]
      .forEach((item,i)=>{
        const x2=0.4+i*5;
        sT.addShape(prs.ShapeType.rect,{x:x2,y:2.5,w:4.5,h:2.5,fill:{color:item.color},line:{color:item.color}});
        sT.addText(item.label,{x:x2,y:2.6,w:4.5,h:0.4,fontSize:11,bold:true,color:C.white,fontFace:"Calibri",align:"center"});
        sT.addText(fmtE(item.val),{x:x2,y:3.1,w:4.5,h:0.7,fontSize:26,bold:true,color:C.white,fontFace:"Calibri",align:"center"});
        sT.addText(item.pct.toFixed(0)+"%",{x:x2,y:3.85,w:4.5,h:0.8,fontSize:40,bold:true,color:C.white,fontFace:"Calibri",align:"center"});
      });

      // ── Slides POR MERCADO ──
      addSep("POR MERCADO","4");
      MC_MARKETS.forEach(m=>{
        const rd=rev.byMarket[m.code]||{}, ad=afil.byMarket[m.code]||{};
        const od=orders.byMarket[m.code]||{}, ld=leads.byMarket[m.code]||{};
        const rCurr=N(rd.curr),rPrev=N(rd.prev),aCurr=N(ad.curr),aPrev=N(ad.prev);
        if(!rCurr&&!aCurr) return;
        const tCurr=rCurr+aCurr, tPrev=rPrev+aPrev;
        const sm2=prs.addSlide(); sm2.background={color:C.white};
        sm2.addText(m.name.toUpperCase(),{x:0.4,y:0.15,w:10,h:0.45,fontSize:20,bold:true,color:C.blue,fontFace:"Calibri",charSpacing:2});
        sm2.addText("DETALHE POR MÉTRICA",{x:0.4,y:0.58,w:6,h:0.25,fontSize:9,color:C.grayDark,fontFace:"Calibri"});
        sm2.addShape(prs.ShapeType.line,{x:0.4,y:0.85,w:W-0.8,h:0,line:{color:C.gray,width:1}});
        const rEvo=rPrev?((rCurr-rPrev)/rPrev*100):0;
        const oEvo=N(od.orders_prev)?((N(od.orders_curr)-N(od.orders_prev))/N(od.orders_prev)*100):0;
        const mDiff=N(rd.margin_curr||rev.margin_pct)-N(rd.margin_prev||rev.margin_pct_prev);
        [{label:"Revenda",value:fmtE(rCurr),sub:fmtP(rEvo,true),color:rEvo>=0?C.green:C.red},
         {label:"Margem",value:fmtP(N(rev.margin_pct)),sub:fmtP(mDiff,true)+"pp",color:mDiff>=0?C.green:C.red},
         {label:"Encomendas",value:String(N(od.orders_curr)||"–"),sub:fmtP(oEvo,true),color:oEvo>=0?C.green:C.red},
         {label:"Total "+year,value:fmtE(tCurr),sub:evo(tPrev,tCurr),color:C.blue}]
        .forEach((k,i)=>{
          const x2=0.4+i*3.2;
          sm2.addText(k.label,{x:x2,y:1.0,w:3,h:0.25,fontSize:8,color:C.grayDark,fontFace:"Calibri"});
          sm2.addText(k.value,{x:x2,y:1.22,w:3,h:0.55,fontSize:20,bold:true,color:C.black,fontFace:"Calibri"});
          sm2.addText(k.sub,{x:x2,y:1.75,w:3,h:0.3,fontSize:11,bold:true,color:k.color,fontFace:"Calibri"});
        });
        const detRows=[
          [{text:"",options:{bold:true,color:C.white,fill:{color:C.tableHead},fontSize:9}},
           {text:mLabel+" "+(year-1),options:{bold:true,color:C.white,fill:{color:C.tableHead},fontSize:9,align:"right"}},
           {text:mLabel+" "+year,options:{bold:true,color:C.white,fill:{color:C.tableHead},fontSize:9,align:"right"}},
           {text:"EVOLUÇÃO",options:{bold:true,color:C.white,fill:{color:C.tableHead},fontSize:9,align:"right"}}],
          ...([
            ["Revenda",fmtE(rPrev),fmtE(rCurr),evo(rPrev,rCurr)],
            ["Afiliação",fmtE(aPrev),fmtE(aCurr),evo(aPrev,aCurr)],
            ["Total",fmtE(tPrev),fmtE(tCurr),evo(tPrev,tCurr)],
            ["Margem",fmtP(N(rev.margin_pct_prev)),fmtP(N(rev.margin_pct)),fmtP(mDiff,true)+"pp"],
            ["Encomendas",String(N(od.orders_prev)),String(N(od.orders_curr)),evo(N(od.orders_prev),N(od.orders_curr))],
            ["1ªs enc.",String(N(od.first_prev)),String(N(od.first_curr)),evo(N(od.first_prev),N(od.first_curr))],
            ["Fat. 1ªs enc.",fmtE(N(od.first_rev_prev)),fmtE(N(od.first_rev_curr)),evo(N(od.first_rev_prev),N(od.first_rev_curr))],
            ["Leads",String(N(ld.prev)),String(N(ld.curr)),evo(N(ld.prev),N(ld.curr))],
          ].map((r,i)=>{
            const bg=i%2===0?C.r1:C.r2;
            const ec=r[3].startsWith("+")?C.green:C.red;
            return [{text:r[0],options:{fontSize:9,fill:{color:bg}}},
              {text:r[1],options:{fontSize:9,align:"right",fill:{color:bg}}},
              {text:r[2],options:{fontSize:9,bold:true,align:"right",fill:{color:bg}}},
              {text:r[3],options:{fontSize:9,align:"right",fill:{color:bg},color:ec}}];
          })),
        ];
        sm2.addTable(detRows,{x:0.4,y:2.2,w:12.5,colW:[4,2.5,2.5,2],border:{type:"solid",color:C.gray,pt:0.5},rowH:0.46});
      });

      await prs.writeFile({fileName:`Relatorio-${MC_MONTHS_PT[monthNum+1]}-${year}.pptx`});
    } catch(e) {
      console.error(e);
      alert("Erro ao gerar PowerPoint: "+e.message);
    }
    setGenerating(false);
  }

  const isQuarterMonth = [2,5,8,11].includes(monthNum); // Mar, Jun, Set, Dez
  const steps = isQuarterMonth
    ? ["Revenda","Afiliação","Total","Mercados","Programas","Trimestre"]
    : ["Revenda","Afiliação","Total","Mercados","Programas"];

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-slate-400">
      <div className="text-center">
        <div className="text-3xl mb-3">⏳</div>
        <p className="text-sm">A carregar dados de {MC_MONTHS_PT[monthNum+1]} {year}…</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto pb-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Relatório — {MC_MONTHS_PT[monthNum+1]} {year}</h2>
          <p className="text-sm text-slate-500 mt-0.5">Dados carregados automaticamente · edita antes de gerar</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {savedDraft && <span className="text-xs text-green-600 font-medium">✓ Guardado</span>}
          <button onClick={saveDraft} disabled={savingDraft}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60">
            {savingDraft ? "A guardar…" : "💾 Guardar"}
          </button>
          <button onClick={generatePptx} disabled={generating}
            className="px-5 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center gap-2">
            {generating ? "⏳ A gerar…" : "⬇️ Gerar PowerPoint"}
          </button>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex gap-1 mb-5 overflow-x-auto pb-1">
        {steps.map((s,i) => (
          <button key={i} onClick={() => setStep(i)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              step===i?"bg-orange-500 text-white":"bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            {i+1}. {s}
          </button>
        ))}
      </div>

      {/* Step 0 – Revenda */}
      {step===0 && (
        <>
          <MCCard title="Revenda — Resultados mensais">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <MCField label={`Resultado ${year-1} (€)`} value={rev.prev_year} onChange={v=>setRev(p=>({...p,prev_year:v}))} />
              <MCField label={`Objetivo ${year} (€)`} value={String(rev.objective)} onChange={v=>setRev(p=>({...p,objective:v}))} />
              <MCField label={`Resultado ${year} (€) ✦`} value={String(rev.result)} onChange={v=>setRev(p=>({...p,result:v}))} />
              <MCField label={`Margem ${year} %`} value={rev.margin_pct} onChange={v=>setRev(p=>({...p,margin_pct:v}))} />
              <MCField label={`Margem ${year-1} %`} value={rev.margin_pct_prev} onChange={v=>setRev(p=>({...p,margin_pct_prev:v}))} />
            </div>
          </MCCard>
          <MCCard title="Revenda — Por mercado">
            {MC_MARKETS.map(m => (
              <div key={m.code} className="mb-3">
                <p className="text-xs font-semibold text-slate-600 mb-2">{m.name}</p>
                <div className="grid grid-cols-2 gap-3">
                  <MCField label={`${year} (€) ✦`} value={String(rev.byMarket[m.code]?.curr||"")} onChange={v=>setRev(p=>({...p,byMarket:{...p.byMarket,[m.code]:{...p.byMarket[m.code],curr:v}}}))} />
                  <MCField label={`${year-1} (€)`} value={String(rev.byMarket[m.code]?.prev||"")} onChange={v=>setRev(p=>({...p,byMarket:{...p.byMarket,[m.code]:{...p.byMarket[m.code],prev:v}}}))} />
                </div>
              </div>
            ))}
          </MCCard>
          <p className="text-xs text-slate-400 mt-1">✦ preenchido automaticamente a partir do Registo Diário</p>
        </>
      )}

      {/* Step 1 – Afiliação */}
      {step===1 && (
        <>
          <MCCard title="Afiliação — Resultados mensais">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <MCField label={`Resultado ${year-1} (€)`} value={afil.prev_year} onChange={v=>setAfil(p=>({...p,prev_year:v}))} />
              <MCField label={`Objetivo ${year} (€) ✦`} value={String(afil.objective)} onChange={v=>setAfil(p=>({...p,objective:v}))} />
              <MCField label={`Resultado ${year} (€) ✦`} value={String(afil.result)} onChange={v=>setAfil(p=>({...p,result:v}))} />
            </div>
          </MCCard>
          <MCCard title="Afiliação — Por mercado">
            {MC_MARKETS.map(m => (
              <div key={m.code} className="mb-3">
                <p className="text-xs font-semibold text-slate-600 mb-2">{m.name}</p>
                <div className="grid grid-cols-2 gap-3">
                  <MCField label={`${year-1} (€)`} value={String(afil.byMarket[m.code]?.prev||"")} onChange={v=>setAfil(p=>({...p,byMarket:{...p.byMarket,[m.code]:{...p.byMarket[m.code],prev:v}}}))} />
                  <MCField label={`${year} (€) ✦`} value={String(afil.byMarket[m.code]?.curr||"")} onChange={v=>setAfil(p=>({...p,byMarket:{...p.byMarket,[m.code]:{...p.byMarket[m.code],curr:v}}}))} />
                </div>
              </div>
            ))}
          </MCCard>
          <p className="text-xs text-slate-400 mt-1">✦ preenchido automaticamente a partir de Afiliação</p>
        </>
      )}

      {/* Step 2 – Total */}
      {step===2 && (
        <MCCard title="Total (Revenda + Afiliação)">
          <div className="grid grid-cols-2 gap-4">
            {[["Resultado "+year+" (€)","auto",N(rev.result)+N(afil.result)],
              ["Resultado "+(year-1)+" (€)","auto",N(rev.prev_year)+N(afil.prev_year)],
              ["Objetivo "+year+" (€)","auto",N(rev.objective)+N(afil.objective)]]
            .map(([label,,val],i) => (
              <div key={i} className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-1">{label}</p>
                <p className="text-xl font-bold text-slate-800">{new Intl.NumberFormat("fr-FR").format(val)} €</p>
                <p className="text-xs text-slate-400 mt-1">calculado automaticamente</p>
              </div>
            ))}
          </div>
        </MCCard>
      )}

      {/* Step 3 – Mercados (encomendas + leads) */}
      {step===3 && (
        <>
          {MC_MARKETS.map(m => (
            <MCCard key={m.code} title={m.name}>
              <div className="grid grid-cols-2 gap-6">
                {/* Coluna 2025 */}
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{year-1}</p>
                  <MCField label={`Enc. ${year-1}`} value={orders.byMarket[m.code]?.orders_prev||""} onChange={v=>setOrders(p=>({...p,byMarket:{...p.byMarket,[m.code]:{...p.byMarket[m.code],orders_prev:v}}}))} />
                  <MCField label={`1ªs enc. ${year-1}`} value={orders.byMarket[m.code]?.first_prev||""} onChange={v=>setOrders(p=>({...p,byMarket:{...p.byMarket,[m.code]:{...p.byMarket[m.code],first_prev:v}}}))} />
                  <MCField label={`Fat. 1ªs enc. ${year-1} (€)`} value={orders.byMarket[m.code]?.first_rev_prev||""} onChange={v=>setOrders(p=>({...p,byMarket:{...p.byMarket,[m.code]:{...p.byMarket[m.code],first_rev_prev:v}}}))} />
                  <MCField label={`Leads ${year-1}`} value={leads.byMarket[m.code]?.prev||""} onChange={v=>setLeads(p=>({...p,byMarket:{...p.byMarket,[m.code]:{...p.byMarket[m.code],prev:v}}}))} />
                </div>
                {/* Coluna 2026 */}
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-bold text-orange-400 uppercase tracking-wide">{year} ✦</p>
                  <MCField label={`Enc. ${year}`} value={orders.byMarket[m.code]?.orders_curr||""} onChange={v=>setOrders(p=>({...p,byMarket:{...p.byMarket,[m.code]:{...p.byMarket[m.code],orders_curr:v}}}))} />
                  <MCField label={`1ªs enc. ${year}`} value={orders.byMarket[m.code]?.first_curr||""} onChange={v=>setOrders(p=>({...p,byMarket:{...p.byMarket,[m.code]:{...p.byMarket[m.code],first_curr:v}}}))} />
                  <MCField label={`Fat. 1ªs enc. ${year} (€)`} value={orders.byMarket[m.code]?.first_rev_curr||""} onChange={v=>setOrders(p=>({...p,byMarket:{...p.byMarket,[m.code]:{...p.byMarket[m.code],first_rev_curr:v}}}))} />
                  <MCField label={`Leads ${year}`} value={leads.byMarket[m.code]?.curr||""} onChange={v=>setLeads(p=>({...p,byMarket:{...p.byMarket,[m.code]:{...p.byMarket[m.code],curr:v}}}))} />
                </div>
              </div>
            </MCCard>
          ))}
          <p className="text-xs text-slate-400 mt-1">✦ preenchido automaticamente a partir de Encomendas / Leads</p>
        </>
      )}

      {/* Step 4 – Programas */}
      {step===4 && (
        <MCCard title="Revenda — Programas">
          {MC_PROGRAMS.map(p => (
            <div key={p} className="mb-3">
              <p className="text-xs font-semibold text-slate-600 mb-2">{p}</p>
              <div className="grid grid-cols-2 gap-3">
                <MCField label={`${year-1} (€)`} value={programs[p]?.prev||""} onChange={v=>setPrograms(pr=>({...pr,[p]:{...pr[p],prev:v}}))} />
                <MCField label={`${year} (€)`} value={programs[p]?.curr||""} onChange={v=>setPrograms(pr=>({...pr,[p]:{...pr[p],curr:v}}))} />
              </div>
            </div>
          ))}
        </MCCard>
      )}

      {/* Step 5 – Trimestre (só Mar/Jun/Set/Dez) */}
      {step===5 && isQuarterMonth && (
        <>
          <MCCard title="Revenda — Trimestre">
            <div className="grid grid-cols-3 gap-3">
              <MCField label={`Trim. ${year-1} (€)`} value={rev.q_result_prev_year} onChange={v=>setRev(p=>({...p,q_result_prev_year:v}))} />
              <MCField label={`Obj. trim. ${year} (€)`} value={rev.q_objective} onChange={v=>setRev(p=>({...p,q_objective:v}))} />
              <MCField label={`Res. trim. ${year} (€)`} value={rev.q_result} onChange={v=>setRev(p=>({...p,q_result:v}))} />
            </div>
          </MCCard>
          <MCCard title="Detalhe dos 3 meses">
            {[{key:"q_month1",label:MC_MONTHS_PT[monthNum<3?1:monthNum<6?4:monthNum<9?7:10]},
              {key:"q_month2",label:MC_MONTHS_PT[monthNum<3?2:monthNum<6?5:monthNum<9?8:11]},
              {key:"q_month3",label:MC_MONTHS_PT[monthNum<3?3:monthNum<6?6:monthNum<9?9:12]}]
            .map(({key,label}) => (
              <div key={key} className="mb-4">
                <p className="text-sm font-semibold text-slate-700 mb-2">{label}</p>
                <div className="grid grid-cols-3 gap-3">
                  <MCField label="Faturação (€)" value={rev[`${key}_revenue`]} onChange={v=>setRev(p=>({...p,[`${key}_revenue`]:v}))} />
                  <MCField label="Evolução % (ex: 74.9)" value={rev[`${key}_evolution`]} onChange={v=>setRev(p=>({...p,[`${key}_evolution`]:v}))} />
                  <MCField label="Margem % (ex: 49.6)" value={rev[`${key}_margin`]} onChange={v=>setRev(p=>({...p,[`${key}_margin`]:v}))} />
                </div>
              </div>
            ))}
          </MCCard>
        </>
      )}

      {/* Navegação */}
      <div className="flex justify-between mt-4">
        <button onClick={() => setStep(s => Math.max(0,s-1))} disabled={step===0}
          className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-30">
          ← Anterior
        </button>
        {step < steps.length-1 ? (
          <button onClick={() => setStep(s => s+1)}
            className="px-4 py-2 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700">
            Seguinte →
          </button>
        ) : (
          <button onClick={generatePptx} disabled={generating}
            className="px-5 py-2 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 disabled:opacity-60">
            {generating?"⏳ A gerar…":"⬇️ Gerar PowerPoint"}
          </button>
        )}
      </div>
    </div>
  );
}


// ---- Afiliação ----
const AFILIACAO_SCOPES = [
  { id: "total", label: "Total" },
  { id: "PT", label: "Portugal" },
  { id: "IT", label: "Itália" },
  { id: "ES", label: "Espanha" },
  { id: "FR", label: "França" },
  { id: "CH-BNL-DEAT", label: "CH-BNL-DEAT" },
  { id: "CZ", label: "Chéquia" },
  { id: "USA", label: "USA" },
  { id: "OT", label: "Outros" },
];

function AfiliacaoDashboard({ totalDays, closedDay, month, monthNum, year, isCurrentMonth, isAdmin }) {
  const [afilScope, setAfilScope] = useState("total");
  const [afilData, setAfilData] = useState({
    totalGoal: 0,
    teamGoals: { PT: 0, IT: 0, ES: 0, FR: 0, "CH-BNL-DEAT": 0, CZ: 0, USA: 0, OT: 0 },
    entries: {},
  });
  const [loading, setLoading] = useState(true);
  const today = new Date();
  const selectedMonth = `${year}-${String(monthNum + 1).padStart(2, "0")}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const afilKey = `afil-${selectedMonth}`;
      const { data: row } = await supabase
        .from("billing_months")
        .select("*")
        .eq("month_key", afilKey)
        .maybeSingle();
      if (cancelled) return;
      if (row) {
        setAfilData({
          totalGoal: Number(row.total_goal) || 0,
          teamGoals: row.team_goals || { PT: 0, IT: 0, ES: 0, FR: 0, "CH-BNL-DEAT": 0, CZ: 0, USA: 0, OT: 0 },
          entries: row.entries || {},
        });
      } else {
        setAfilData({ totalGoal: 0, teamGoals: { PT: 0, IT: 0, ES: 0, FR: 0, "CH-BNL-DEAT": 0, CZ: 0, USA: 0, OT: 0 }, entries: {} });
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [selectedMonth]);

  const stats = useMemo(
    () => computeScopeStats(afilData, afilScope, totalDays, closedDay, year, monthNum),
    [afilData, afilScope, totalDays, closedDay, year, monthNum]
  );
  const teamStats = useMemo(
    () => ["PT","IT","ES","FR","CH-BNL-DEAT","CZ","USA","OT"].map((t) => ({
      team: t,
      ...computeScopeStats(afilData, t, totalDays, closedDay, year, monthNum),
    })),
    [afilData, totalDays, closedDay, year, monthNum]
  );

  if (loading) return <div className="text-center py-12 text-slate-500">A carregar…</div>;

  const scopeColor = TEAM_COLORS[afilScope] || "#0f172a";
  const scopeLabel = AFILIACAO_SCOPES.find(s => s.id === afilScope)?.label || afilScope;

  return (
    <div className="space-y-5">
      <AfiliacaoFecho monthNum={monthNum} year={year} isAdmin={isAdmin} />
      <div className="space-y-5">
      {/* Scope tabs */}
      <div className="bg-white rounded-lg border border-slate-200 p-1 flex gap-1 overflow-x-auto">
        {AFILIACAO_SCOPES.map((s) => {
          const active = afilScope === s.id;
          const color = TEAM_COLORS[s.id];
          return (
            <button
              key={s.id}
              onClick={() => setAfilScope(s.id)}
              className={`flex-1 min-w-[70px] px-3 py-2 rounded-md text-sm font-semibold transition-colors ${
                active ? "text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
              style={active ? { backgroundColor: color } : undefined}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {stats.goal === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center mt-4">
          <Target className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-900">
            {afilScope === "total"
              ? "Sem objetivo total definido para este mês"
              : `Sem objetivo definido para ${scopeLabel}`}
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            O administrador ainda não configurou este âmbito.
          </p>
        </div>
      ) : (
        <Dashboard
          stats={stats}
          scope={afilScope}
          month={month}
          year={year}
          totalDays={totalDays}
          closedDay={closedDay}
          isCurrentMonth={isCurrentMonth}
          teamStats={teamStats}
        />
      )}
    </div>
    </div>
  );
}

// ---- Tab vazia ----
function TabVazia({ titulo }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <TrendingUp className="w-8 h-8 text-slate-300" />
      </div>
      <h3 className="text-lg font-semibold text-slate-500">{titulo}</h3>
      <p className="text-sm mt-1">Brevemente disponível</p>
    </div>
  );
}


export default function App() {
  const [unlocked, setUnlocked] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(GATE_STORAGE_KEY) === "1"
  );

  if (!unlocked) {
    return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  }
  return <MainApp />;
}

function PasswordGate({ onUnlock }) {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (password === SITE_PASSWORD) {
      try {
        window.localStorage.setItem(GATE_STORAGE_KEY, "1");
      } catch {}
      onUnlock();
    } else {
      setErr("Password incorreta");
      setPassword("");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 max-w-sm w-full p-8">
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-3">
            <Lock className="w-5 h-5 text-blue-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Faturação da Equipa</h1>
          <p className="text-sm text-slate-500 mt-1">Acesso restrito</p>
        </div>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setErr("");
            }}
            placeholder="Password"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          {err && <div className="text-xs text-red-600 text-center">{err}</div>}
          <button
            type="submit"
            disabled={!password}
            className="w-full px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
