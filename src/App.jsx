import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  Target, TrendingUp, Calendar, Euro, CheckCircle2, AlertCircle,
  Info, Lock, LogOut, Eye,
} from "lucide-react";
import { supabase, ADMIN_EMAIL } from "./supabase.js";

const TEAMS = ["PT", "IT", "ES", "FR", "CH-BNL-DEAT", "CZ-SK-GR-CY-PL", "USA", "OT"];
const SCOPES = [
  { id: "total", label: "Total" },
  { id: "PT", label: "Portugal" },
  { id: "IT", label: "Itália" },
  { id: "ES", label: "Espanha" },
  { id: "FR", label: "França" },
  { id: "CH-BNL-DEAT", label: "CH-BNL-DEAT" },
  { id: "CZ-SK-GR-CY-PL", label: "CZ-SK-GR-CY-PL" },
  { id: "USA", label: "USA" },
  { id: "OT", label: "Outros" },
];
// Equipas para "Análise comercial" — cada equipa agrega vários mercados
const ANALISE_TEAMS = [
  { id: "total",      label: "Total",      markets: ["PT","IT","ES","FR","CH-BNL-DEAT","CZ-SK-GR-CY-PL","USA","OT"] },
  { id: "equipa_pt",  label: "Equipa PT",  markets: ["PT","OT"] },
  { id: "equipa_it",  label: "Equipa IT",  markets: ["IT"] },
  { id: "equipa_es",  label: "Equipa ES",  markets: ["ES"] },
  { id: "equipa_fr",  label: "Equipa FR",  markets: ["FR","CH-BNL-DEAT"] },
  { id: "equipa_na",  label: "Equipa NA",  markets: ["CZ-SK-GR-CY-PL","USA"] },
];
const ANALISE_COLORS = {
  total: "#0f172a", equipa_pt: "#16a34a", equipa_it: "#2563eb",
  equipa_es: "#dc2626", equipa_fr: "#9333ea", equipa_na: "#0891b2",
};

const TEAM_COLORS = {
  PT: "#16a34a", IT: "#2563eb", ES: "#dc2626",
  FR: "#9333ea", "CH-BNL-DEAT": "#d97706",
  "CZ-SK-GR-CY-PL": "#0891b2", USA: "#7c3aed", OT: "#64748b", total: "#0f172a",
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
  teamGoals: { PT: 0, IT: 0, ES: 0, FR: 0, "CH-BNL-DEAT": 0, "CZ-SK-GR-CY-PL": 0, USA: 0, OT: 0 },
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
    if (!isAdmin && !["analise","dashboard","history"].includes(tab)) setTab("analise");
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
        { id: "dashboard", label: "Resumo" },
        { id: "relatorio", label: "Relatório" },
        { id: "history", label: "Histórico" },
        { id: "entry", label: "Registo" },
        { id: "setup", label: "Objetivos" },
      ]
    : [
        { id: "analise", label: "Análise comercial" },
        { id: "dashboard", label: "Resumo" },
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

            {tab === "relatorio" && isAdmin && (
              <Relatorio monthNum={month} year={year} />
            )}
            {tab === "entry" && isAdmin && (
              <EntryHub
                data={data}
                setEntry={setEntry}
                totalDays={totalDays}
                closedDay={closedDay}
                isCurrentMonth={isCurrentMonth}
                monthNum={month}
                year={year}
                isAdmin={isAdmin}
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
// so computeScopeStats can process them unchanged.
// For 2025 entries, the data is stored as a single "_total" key with monthly totals.
function dailyToCumulative(dailyEntries, teams) {
  // 2025 format: { _total: { PT: x, IT: y, ... } }
  if (dailyEntries["_total"]) {
    const row = dailyEntries["_total"];
    const total = teams.reduce((s, t) => s + (Number(row[t]) || 0), 0);
    // Represent as a single entry on day 1 with the full monthly total
    return {
      1: {
        ...teams.reduce((obj, t) => ({ ...obj, [t]: Number(row[t]) || 0 }), {}),
        total,
        supersales: false,
      },
    };
  }

  // 2026+ format: daily values
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
  // Resumo uses same data as Análise comercial (billing_months/YYYY-MM)
  const stats = useMemo(
    () => computeScopeStats(data, scope, totalDays, closedDay, year, monthNum),
    [data, scope, totalDays, closedDay, year, monthNum]
  );

  // Load prev year data + closing data (margem, encomendas)
  const [prevYearActual, setPrevYearActual] = useState(null);
  const [closingCurr, setClosingCurr] = useState(null);
  const [closingPrev, setClosingPrev] = useState(null);

  useEffect(() => {
    const prevKey = `${year - 1}-${String(monthNum + 1).padStart(2, "0")}`;
    // Prev year billing — same source as current year (billing_months)
    supabase.from("billing_months").select("entries").eq("month_key", prevKey).maybeSingle()
      .then(({ data: row }) => {
        if (!row?.entries) { setPrevYearActual(null); return; }
        const entries = row.entries;
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

  // YoY faturação — use displayActual (may differ from stats.actual when using Registo Revenda)
  const evoPct = prevYearActual > 0 ? ((stats.actual - prevYearActual) / prevYearActual) * 100 : null;
  const evoAbs = prevYearActual != null ? stats.actual - prevYearActual : null;
  const isAheadYoY = evoPct != null && evoPct >= 0;

  // Margem — from MargemRegisto (closing.markets[code].margin_curr/prev)
  // For "total" scope: use global revenda_margin field (set in Registo > Margem)
  // For specific market scope: use that market's margin_curr/prev
  const getMargin = (closing, marketCode) => {
    if (!closing) return null;
    if (marketCode === "total") {
      // Try global field first, then fall back to average of markets
      if (closing.revenda_margin) return parseFloat(closing.revenda_margin);
      const vals = MC_MARKETS.map(m => parseFloat(closing.markets?.[m.code]?.margin_curr)).filter(v => !isNaN(v) && v > 0);
      return vals.length > 0 ? vals.reduce((s,v) => s+v, 0) / vals.length : null;
    }
    const v = closing.markets?.[marketCode]?.margin_curr;
    return v ? parseFloat(v) : null;
  };
  // margin_prev is stored in closingCurr (the current month's closing record),
  // not in closingPrev (which is the previous year's closing record).
  const getMarginPrev = (closing, marketCode) => {
    if (!closing) return null;
    if (marketCode === "total") {
      if (closing.revenda_margin_prev) return parseFloat(closing.revenda_margin_prev);
      const vals = MC_MARKETS.map(m => parseFloat(closing.markets?.[m.code]?.margin_prev)).filter(v => !isNaN(v) && v > 0);
      return vals.length > 0 ? vals.reduce((s,v) => s+v, 0) / vals.length : null;
    }
    const v = closing.markets?.[marketCode]?.margin_prev;
    return v ? parseFloat(v) : null;
  };
  const marginCurr = getMargin(closingCurr, scope);
  const marginPrev = getMarginPrev(closingCurr, scope); // reads margin_prev from current closing record

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
    if (!closingCurr) return null;
    // Try per-market sum first
    if (closingCurr.markets) {
      const markets = scope === "total" ? MC_MARKETS.map(m => m.code) : [scope];
      const t = markets.reduce((s,m) => s + (parseFloat(closingCurr.markets[m]?.afil_result)||0), 0);
      if (t > 0) return t;
    }
    // Fallback: global afil_result field
    const global = parseFloat(closingCurr.afil_result);
    return global > 0 ? global : null;
  })();
  const afilPrev = (() => {
    if (!closingCurr) return null; // prev year stored in current closing as afil_prev
    // Try per-market afil_prev
    if (closingCurr.markets) {
      const markets = scope === "total" ? MC_MARKETS.map(m => m.code) : [scope];
      const t = markets.reduce((s,m) => s + (parseFloat(closingCurr.markets[m]?.afil_prev)||0), 0);
      if (t > 0) return t;
    }
    // Fallback: global afil_prev field
    const global = parseFloat(closingCurr.afil_prev);
    return global > 0 ? global : null;
  })();

  // Fallback: if billing data is empty, try to read total from Registo Revenda closing
  // This covers months where data was entered via the simple 2025 form
  const revendaActual = stats.actual > 0 ? stats.actual : (() => {
    if (!closingCurr) return 0;
    // Try _total from revenda closing (2025 format stored in closing)
    const rev = closingCurr?.revenda_total;
    if (rev) return Number(rev);
    return 0;
  })();

  // Use revendaActual instead of stats.actual for YoY comparison display
  const displayActual = revendaActual || stats.actual;

  return (
    <div className="space-y-5">
      <ScopeTabs scope={scope} setScope={setScope} />

<RevDashboard
        stats={stats}
        scope={scope}
        month={month}
        year={year}
        totalDays={totalDays}
        closedDay={closedDay}
        data={data}
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
        closingCurr={closingCurr}
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
  firstRevCurr, firstRevPrev, leadsCurr, leadsPrev, afilCurr, afilPrev,
  closingCurr, data }) {
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
  const [histData, setHistData] = useState([]);
  const [mktHistData, setMktHistData] = useState([]);
  useEffect(() => {
    if (scope !== "total") return;
    const MONTH_LABELS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    (async () => {
      const rows = await Promise.all(
        MONTH_LABELS.map(async (_, mi) => {
          const getTotal = async (y) => {
            const key = `${y}-${String(mi+1).padStart(2,"0")}`;
            const {data:row} = await supabase.from("billing_months").select("entries").eq("month_key",key).maybeSingle();
            if (!row?.entries) return null;
            const days = Object.keys(row.entries).map(Number).filter(n=>!isNaN(n)).sort((a,b)=>a-b);
            if (!days.length) return null;
            const last = row.entries[String(days[days.length-1])];
            return last?.total || TEAMS.reduce((s,t)=>s+(Number(last?.[t])||0),0) || null;
          };
          const [v25, v26] = await Promise.all([getTotal(year-1), getTotal(year)]);
          return { month: MONTH_LABELS[mi], [year-1]: v25, [year]: v26 };
        })
      );
      setHistData(rows);
    })();
  }, [year, scope]);

  // Per-market historical data
  useEffect(() => {
    if (scope === "total") return;
    const MONTH_LABELS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    (async () => {
      const rows = await Promise.all(
        MONTH_LABELS.map(async (_, mi) => {
          const getVal = async (y) => {
            const key = `${y}-${String(mi+1).padStart(2,"0")}`;
            const {data:row} = await supabase.from("billing_months").select("entries").eq("month_key",key).maybeSingle();
            if (!row?.entries) return null;
            const days = Object.keys(row.entries).map(Number).filter(n=>!isNaN(n)).sort((a,b)=>a-b);
            if (!days.length) return null;
            const last = row.entries[String(days[days.length-1])];
            return Number(last?.[scope]) || null;
          };
          const [v25, v26] = await Promise.all([getVal(year-1), getVal(year)]);
          return { month: MONTH_LABELS[mi], [year-1]: v25, [year]: v26 };
        })
      );
      setMktHistData(rows);
    })();
  }, [year, scope]);

  // ── Design helpers ──────────────────────────────────────────────────────────
  const DS = {
    card: "bg-white rounded-2xl border border-slate-200 p-5 space-y-4",
    title: "text-2xl font-bold text-slate-900 tracking-tight",
    subtitle: "text-sm font-semibold text-slate-500",
    kpiBox: "bg-emerald-50 rounded-2xl p-4 border border-emerald-100",
    kpiBoxHL: "bg-emerald-50 rounded-2xl p-4 border-2 border-emerald-400",
    kpiLabel: "text-xs text-slate-500 uppercase tracking-wide mb-2",
    kpiVal: "text-2xl font-bold text-slate-700",
    kpiValGreen: "text-2xl font-bold text-emerald-700",
    kpiValBig: "text-3xl font-bold text-emerald-700",
    detailBox: "bg-slate-50 rounded-xl border border-slate-200 p-4",
    detailLabel: "text-xs font-bold text-slate-400 uppercase tracking-widest mb-3",
    divider: "divide-x divide-slate-200",
    col: "px-4 first:pl-0 last:pr-0",
    tag: "text-xs text-slate-500",
    val: "text-xl font-bold",
  };

  function BigCard({ name, result, prev, objective, showObjective = true, totalResult = 0, children }) {
    const evoPct = prev > 0 ? ((result - prev) / prev * 100) : null;
    const evoAbs = prev != null ? result - prev : null;
    const aboveObj = objective > 0 ? result - objective : null;
    const pctObj   = objective > 0 ? (result / objective * 100) : null;
    const pos = evoPct != null && evoPct >= 0;
    const clampPct  = pctObj != null ? Math.min(pctObj / 100, 1) : 0;
    const excessPct = pctObj != null ? Math.max(0, pctObj / 100 - 1) : 0;
    const fmtE = v => v != null ? fmtEur(v) : "—";
    const fmtP = (v, sign=false) => v == null ? "—" : `${sign&&v>=0?"+":""}${v.toFixed(2)}%`;
    return (
      <div className={DS.card}>
        <div>
          <h2 className={DS.title}>{name}</h2>
          <p className={DS.subtitle}>{month} {year} – em comparação ao ano anterior · {scopeLabel}</p>
        </div>
        {/* 3 KPI cards */}
        <div className={showObjective ? "grid grid-cols-3 gap-3" : "grid grid-cols-2 gap-3"}>
          <div className={DS.kpiBox}>
            <p className={DS.kpiLabel}>RESULTADO {month.toUpperCase()} {year-1}</p>
            <p className={DS.kpiVal}>{prev > 0 ? fmtE(prev) : <span className="text-slate-400 text-base">Sem dados</span>}</p>
          </div>
          {showObjective && (
          <div className={DS.kpiBox}>
            <p className={DS.kpiLabel}>OBJETIVO {month.toUpperCase()} {year}</p>
            <p className="text-2xl font-bold text-emerald-600">{objective > 0 ? fmtE(objective) : <span className="text-slate-400 text-base">Sem objetivo</span>}</p>
            {objective > 0 && prev > 0 && <p className="text-xs text-emerald-700 mt-1">{fmtP((objective-prev)/prev*100,true)} vs {month.toLowerCase()} {year-1}</p>}
          </div>
          )}
          <div className={DS.kpiBoxHL}>
            <p className={DS.kpiLabel}>RESULTADO {month.toUpperCase()} {year}</p>
            <p className={DS.kpiValBig}>{result > 0 ? fmtE(result) : <span className="text-slate-400 text-base">Sem dados</span>}</p>
            {evoPct != null && <p className="text-sm font-bold text-emerald-700 mt-1">{fmtP(evoPct,true)} vs {year-1}</p>}
          </div>
        </div>
        {/* Detail row */}
        <div className={DS.detailBox}>
          <p className={DS.detailLabel}>DETALHE DO RESULTADO</p>
          <div className={`grid grid-cols-4 gap-0 ${DS.divider}`}>
            {[
              {label:`Evolução vs ${year-1}`, val: fmtP(evoPct,true), color: pos?"text-emerald-600":"text-red-600"},
              {label:"Ganho absoluto",         val: evoAbs!=null?`${evoAbs>=0?"+":""}${fmtE(evoAbs)}`:"—", color:"text-slate-900"},
              ...(!showObjective && totalResult > 0 && result > 0 ? [
                {label:"% do total",  val: `${(result/totalResult*100).toFixed(1)}%`, color:"text-slate-700"},
              ] : []),
              ...(showObjective ? [
                {label:"Acima do objetivo", val: aboveObj!=null?fmtE(aboveObj):"—", color: aboveObj==null?"text-slate-400":aboveObj>=0?"text-emerald-600":"text-red-600"},
                {label:"% do objetivo",     val: pctObj!=null?fmtP(pctObj):"—",    color: pctObj==null?"text-slate-400":pctObj>=100?"text-emerald-600":"text-red-600"},
              ] : []),
            ].map((d,i) => (
              <div key={i} className={DS.col}>
                <p className="text-xs text-slate-500 mb-1">{d.label}</p>
                <p className={`text-xl font-bold ${d.color}`}>{d.val}</p>
              </div>
            ))}
          </div>
        </div>
        {/* Progress bar */}
        {objective > 0 && result > 0 && (
          <div className={DS.detailBox}>
            <p className={DS.detailLabel}>CONCRETIZAÇÃO DO OBJETIVO</p>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>0 €</span>
              <span>Objetivo: {fmtE(objective)}{aboveObj > 0 ? ` +${fmtE(aboveObj)}` : ""}</span>
            </div>
            <div className="relative h-7">
              {/* Coloured fill bars */}
              <div className="absolute inset-0 rounded-full overflow-hidden flex">
                <div className="h-full bg-emerald-600" style={{width:`${(clampPct*100).toFixed(2)}%`,minWidth:clampPct>0?"4px":"0"}}/>
                {excessPct > 0 && <div className="h-full bg-emerald-300" style={{width:`${(excessPct*100).toFixed(2)}%`,minWidth:"4px"}}/>}
                <div className="h-full bg-slate-200 flex-1"/>
              </div>
              {/* Objective line — outside overflow:hidden so it's always visible */}
              <div className="absolute top-0 bottom-0 w-1 bg-slate-900 rounded-full z-10"
                style={{left:`calc(${(clampPct*100).toFixed(2)}% - 2px)`}}/>
            </div>
            <div className="flex items-center justify-between mt-3">
              <div>
                <p className="text-xs text-slate-500">% do objetivo</p>
                <p className="text-2xl font-bold text-emerald-700">{pctObj!=null?fmtP(pctObj):"—"}</p>
              </div>
              {aboveObj > 0 && <div className="bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5 text-xs font-bold text-emerald-700">✓ +{fmtE(aboveObj)} acima do objetivo</div>}
            </div>
            <div className="flex items-center gap-5 mt-2 text-xs text-slate-500 flex-wrap">
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-emerald-600"/>Realizado até objetivo ({fmtE(objective)})</span>
              {excessPct > 0 && <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-emerald-300"/>Excedente (+{fmtE(aboveObj)})</span>}
              <span className="flex items-center gap-1.5"><span className="inline-block w-0.5 h-3 bg-slate-900"/>Linha de objetivo</span>
            </div>
          </div>
        )}
        {children}
      </div>
    );
  }

  // ── Market distribution donut (inline) ─────────────────────────────────────
  function MktDonut({ data, colors, title }) {
    if (!data.length) return null;
    const total = data.reduce((s,d)=>s+d.val,0);
    if (!total) return null;
    const size=180, cx=90, cy=90, r=68, ri=38;
    let a=-Math.PI/2;
    const slices = data.map((d,i)=>{
      const angle=(d.val/total)*2*Math.PI, ea=a+angle;
      const path=`M ${cx+ri*Math.cos(a)} ${cy+ri*Math.sin(a)} L ${cx+r*Math.cos(a)} ${cy+r*Math.sin(a)} A ${r} ${r} 0 ${angle>Math.PI?1:0} 1 ${cx+r*Math.cos(ea)} ${cy+r*Math.sin(ea)} L ${cx+ri*Math.cos(ea)} ${cy+ri*Math.sin(ea)} A ${ri} ${ri} 0 ${angle>Math.PI?1:0} 0 ${cx+ri*Math.cos(a)} ${cy+ri*Math.sin(a)} Z`;
      a=ea; return {...d,path,pct:(d.val/total*100).toFixed(1),color:colors[i%colors.length]};
    });
    return (
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{title}</p>
        <div className="flex items-center gap-4">
          <svg width={size} height={size} className="shrink-0">
            {slices.map((s,i)=><path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth={2}/>)}
            <text x={cx} y={cy-6} textAnchor="middle" fontSize={10} fill="#94a3b8">Total</text>
            <text x={cx} y={cy+9} textAnchor="middle" fontSize={11} fontWeight="bold" fill="#1e293b">
              {new Intl.NumberFormat("fr-FR").format(Math.round(total/1000))}k€
            </text>
          </svg>
          <div className="flex-1 space-y-1.5">
            {slices.map((s,i)=>(
              <div key={i} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{backgroundColor:s.color}}/>
                <span className="w-20 text-xs text-slate-600 truncate shrink-0">{s.name}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div className="h-full rounded-full" style={{width:`${s.pct}%`,backgroundColor:s.color}}/>
                </div>
                <span className="text-xs font-bold text-slate-700 w-9 text-right shrink-0">{s.pct}%</span>
                <span className="text-xs text-slate-400 w-20 text-right shrink-0 hidden sm:block">{new Intl.NumberFormat("fr-FR").format(Math.round(s.val))} €</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Data for charts ─────────────────────────────────────────────────────────
  const getLastMktVal = (code) => {
    if (!stats?.daily) return 0;
    // Use the last cumulative value from stats.daily for this scope
    // For per-market, read directly from data.entries last day
    const entries = data?.entries || {};
    const days = Object.keys(entries).map(Number).filter(n=>!isNaN(n)).sort((a,b)=>a-b);
    if (!days.length) return 0;
    return Number(entries[String(days[days.length-1])][code]) || 0;
  };
  const COLORS_REV  = ["#3A9E8F","#2E7D71","#5BB8AC","#7DCCC3","#A8DDD8","#C5ECEA","#1A5C52","#0D3B33"];
  const COLORS_AFIL = ["#3A9E8F","#2E7D71","#5BB8AC","#7DCCC3","#A8DDD8","#C5ECEA","#1A5C52","#0D3B33"];
  const revendaByMkt = MC_MARKETS.map(m=>({name:m.name,code:m.code,val:getLastMktVal(m.code)})).filter(m=>m.val>0).sort((a,b)=>b.val-a.val);
  const afilByMkt    = MC_MARKETS.map(m=>({name:m.name,code:m.code,val:Number(closingCurr?.markets?.[m.code]?.afil_result||closingCurr?.markets?.[m.code]?.afil_curr)||0})).filter(m=>m.val>0).sort((a,b)=>b.val-a.val);

  return (
    <>
      {/* Info bar */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2 text-sm">
        <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-blue-900">
          <strong>{scopeLabel}</strong> · {month} {year} ·{" "}
          {noClosedDays ? "Ainda não há dias fechados para analisar." : (
            <>Análise sobre <strong>{closedDay}</strong> {closedDay === 1 ? "dia fechado" : "dias fechados"}{" "}
            {isCurrentMonth && "(até ontem)"} de {totalDays}.</>
          )}
        </div>
      </div>

      {/* ── CARD: REVENDA ── */}
      <BigCard name="REVENDA" result={actual} prev={prevYearActual||0} objective={goal} showObjective={scope === "total"} totalResult={scope !== "total" ? (() => { if (!effectiveData?.entries) return 0; const days=Object.keys(effectiveData.entries).map(Number).filter(n=>!isNaN(n)).sort((a,b)=>a-b); if(!days.length) return 0; const l=effectiveData.entries[String(days[days.length-1])]; return l?.total||TEAMS.reduce((s,t)=>s+(Number(l?.[t])||0),0); })() : 0}>
        {/* Distribuição por mercado — dentro do card Revenda */}
        {revendaByMkt.length > 0 && (
          <MktDonut data={revendaByMkt} colors={COLORS_REV} title="DISTRIBUIÇÃO POR MERCADO — REVENDA" />
        )}
        {/* Margem */}
        {(marginCurr || marginPrev) && (
          <div className={DS.detailBox}>
            <p className={DS.detailLabel}>MARGEM</p>
            <div className={`grid grid-cols-3 gap-0 ${DS.divider}`}>
              <div className={DS.col}>
                <p className="text-xs text-slate-400 mb-1">{year-1}</p>
                <p className="text-xl font-semibold text-slate-600">{marginPrev!=null?`${marginPrev.toFixed(2)}%`:"—"}</p>
              </div>
              <div className={DS.col}>
                <p className="text-xs text-slate-400 mb-1">{year}</p>
                <p className="text-xl font-bold text-slate-900">{marginCurr!=null?`${marginCurr.toFixed(2)}%`:"—"}</p>
              </div>
              <div className={DS.col}>
                <p className="text-xs text-slate-400 mb-1">Evolução</p>
                {marginCurr!=null&&marginPrev!=null?(()=>{const d=marginCurr-marginPrev;return(
                  <p className={`text-xl font-bold ${d>=0?"text-emerald-600":"text-red-600"}`}>{d>=0?"+":""}{d.toFixed(2)}pp</p>
                );})():<p className="text-xl font-bold text-slate-400">—</p>}
              </div>
            </div>
          </div>
        )}

        {/* Médias diárias */}
        {closedDay > 0 && (
          <div className={DS.detailBox}>
            <p className={DS.detailLabel}>MÉDIAS DIÁRIAS</p>
            <div className={`grid grid-cols-3 gap-0 ${DS.divider}`}>
              <div className={DS.col}>
                <p className="text-xs text-slate-500 mb-1">Média/dia (sem SS)</p>
                <p className="text-xl font-bold text-slate-900">{fmtEur(avgWithoutSuper)}</p>
                <p className="text-xs text-slate-400">{hasSuperDays?"excl. Supersales":"sem SS no período"}</p>
              </div>
              <div className={DS.col}>
                <p className="text-xs text-slate-500 mb-1">Média/dia (com SS)</p>
                <p className="text-xl font-bold text-slate-900">{fmtEur(closedDay>0?Math.round(actual/closedDay):0)}</p>
                <p className="text-xs text-slate-400">{hasSuperDays?`${superDaysCount} dia${superDaysCount>1?"s":""} de SS`:"sem SS"}</p>
              </div>
              <div className={DS.col}>
                <p className="text-xs text-slate-500 mb-1">% Supersales / total</p>
                <p className={`text-xl font-bold ${hasSuperDays?"text-amber-700":"text-slate-400"}`}>
                  {hasSuperDays&&actual>0?`${((superDaysTotal/actual)*100).toFixed(1)}%`:"0%"}
                </p>
                <p className="text-xs text-slate-400">{hasSuperDays?`${fmtEur(superDaysTotal)}`:"sem Supersales"}</p>
              </div>
            </div>
          </div>
        )}
      </BigCard>

      {/* ── CARD: MARGEM ── */}
      {(marginCurr || marginPrev) && (
        <div className={DS.card}>
          <div>
            <h2 className={DS.title}>MARGEM</h2>
            <p className={DS.subtitle}>{month} {year} – comparação ao ano anterior</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className={DS.kpiBox}>
              <p className={DS.kpiLabel}>MARGEM {year-1}</p>
              <p className={DS.kpiVal}>{marginPrev!=null?`${marginPrev.toFixed(2)}%`:"—"}</p>
            </div>
            <div className={DS.kpiBoxHL}>
              <p className={DS.kpiLabel}>MARGEM {year}</p>
              <p className={DS.kpiValBig}>{marginCurr!=null?`${marginCurr.toFixed(2)}%`:"—"}</p>
              {marginCurr!=null&&marginPrev!=null&&(
                <p className="text-sm font-bold text-emerald-700 mt-1">
                  {(marginCurr-marginPrev)>=0?"+":""}{(marginCurr-marginPrev).toFixed(2)}pp vs {year-1}
                </p>
              )}
            </div>
            <div className={DS.kpiBox}>
              <p className={DS.kpiLabel}>EVOLUÇÃO</p>
              {marginCurr!=null&&marginPrev!=null?(
                <>
                  <p className={`text-2xl font-bold ${marginCurr>=marginPrev?"text-emerald-600":"text-red-600"}`}>
                    {(marginCurr-marginPrev)>=0?"+":""}{(marginCurr-marginPrev).toFixed(2)}pp
                  </p>
                  <p className="text-xs text-slate-400 mt-1">pontos percentuais</p>
                </>
              ):<p className={DS.kpiVal}>—</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── CARD: ENCOMENDAS ── */}
      {(ordersCurr || ordersPrev) && (
        <div className={DS.card}>
          <div>
            <h2 className={DS.title}>ENCOMENDAS</h2>
            <p className={DS.subtitle}>{month} {year} – comparação ao ano anterior</p>
          </div>
          {[
            {label:"Total encomendas", prev:ordersPrev, curr:ordersCurr, fmt:v=>v!=null?Math.round(v).toString():"—"},
            {label:"1ªs encomendas",   prev:firstPrev,  curr:firstCurr,  fmt:v=>v!=null?Math.round(v).toString():"—"},
            {label:"Fat. 1ªs enc. (€)",prev:firstRevPrev, curr:firstRevCurr, fmt:v=>v!=null?fmtEur(v):"—"},
          ].map((row,i)=>{
            const evo=row.prev>0&&row.curr!=null?((row.curr-row.prev)/row.prev*100):null;
            const pos=evo!=null&&evo>=0;
            return (
              <div key={i} className={DS.detailBox}>
                <p className={DS.detailLabel}>{row.label}</p>
                <div className={`grid grid-cols-3 gap-0 ${DS.divider}`}>
                  <div className={DS.col}><p className="text-xs text-slate-400 mb-1">{year-1}</p><p className="text-xl font-semibold text-slate-600">{row.fmt(row.prev)}</p></div>
                  <div className={DS.col}><p className="text-xs text-slate-400 mb-1">{year}</p><p className="text-xl font-bold text-slate-900">{row.fmt(row.curr)}</p></div>
                  <div className={DS.col}><p className="text-xs text-slate-400 mb-1">Evolução</p>
                    <p className={`text-xl font-bold ${evo==null?"text-slate-400":pos?"text-emerald-600":"text-red-600"}`}>
                      {evo==null?"—":`${pos?"+":""}${evo.toFixed(1)}%`}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CARD: AFILIAÇÃO ── */}
      {afilCurr != null && (
        <BigCard name="AFILIAÇÃO" result={afilCurr||0} prev={afilPrev||0}
          objective={scope === "total" ? (parseFloat(closingCurr?.afil_objective)||0) : 0}
          showObjective={scope === "total"}>
          {afilByMkt.length > 0 && (
            <MktDonut data={afilByMkt} colors={COLORS_AFIL} title="DISTRIBUIÇÃO POR MERCADO — AFILIAÇÃO" />
          )}
        </BigCard>
      )}

      {/* ── CARD: LEADS ── */}
      {(leadsCurr || leadsPrev) && (
        <div className={DS.card}>
          <div>
            <h2 className={DS.title}>LEADS</h2>
            <p className={DS.subtitle}>{month} {year} – comparação ao ano anterior</p>
          </div>
          <div className={DS.detailBox}>
            <div className={`grid grid-cols-3 gap-0 ${DS.divider}`}>
              <div className={DS.col}><p className="text-xs text-slate-400 mb-1">{year-1}</p><p className="text-xl font-semibold text-slate-600">{leadsPrev!=null?Math.round(leadsPrev):"—"}</p></div>
              <div className={DS.col}><p className="text-xs text-slate-400 mb-1">{year}</p><p className="text-xl font-bold text-slate-900">{leadsCurr!=null?Math.round(leadsCurr):"—"}</p></div>
              <div className={DS.col}><p className="text-xs text-slate-400 mb-1">Evolução</p>
                {leadsCurr!=null&&leadsPrev>0?(()=>{const e=(leadsCurr-leadsPrev)/leadsPrev*100;return <p className={`text-xl font-bold ${e>=0?"text-emerald-600":"text-red-600"}`}>{e>=0?"+":""}{e.toFixed(1)}%</p>;})():<p className="text-xl font-bold text-slate-400">—</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CARD: TOTAL REVENDA + AFILIAÇÃO ── */}
      {afilCurr != null && scope === "total" && (() => {
        const totalCurr = actual + (afilCurr||0);
        const totalPrev = (prevYearActual||0) + (afilPrev||0);
        const revPct = totalCurr>0?Math.round(actual/totalCurr*100):0;
        const afPct  = totalCurr>0?Math.round((afilCurr||0)/totalCurr*100):0;
        return (
          <div className={DS.card}>
            <div>
              <h2 className={DS.title}>TOTAL (REVENDA + AFILIAÇÃO)</h2>
              <p className={DS.subtitle}>{month} {year} – comparação ao ano anterior</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className={DS.kpiBox}><p className={DS.kpiLabel}>REVENDA {year}</p><p className={DS.kpiVal}>{fmtEur(actual)}</p><p className="text-xs text-emerald-700 font-semibold mt-1">{revPct}% do total</p></div>
              <div className={DS.kpiBox}><p className={DS.kpiLabel}>AFILIAÇÃO {year}</p><p className={DS.kpiVal}>{fmtEur(afilCurr||0)}</p><p className="text-xs text-purple-700 font-semibold mt-1">{afPct}% do total</p></div>
              <div className={DS.kpiBoxHL}><p className={DS.kpiLabel}>TOTAL {year}</p><p className={DS.kpiValBig}>{fmtEur(totalCurr)}</p>
                {totalPrev>0&&<p className="text-sm font-bold text-emerald-700 mt-1">{totalCurr>=totalPrev?"+":""}{((totalCurr-totalPrev)/totalPrev*100).toFixed(1)}% vs {year-1}</p>}
              </div>
            </div>
            {/* Split bar */}
            <div className="relative h-7 rounded-full overflow-hidden flex">
              <div className="h-full bg-emerald-600" style={{width:`${revPct}%`}}/>
              <div className="h-full bg-emerald-400 flex-1"/>
            </div>
            <div className="flex items-center gap-6 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-emerald-600"/>Revenda ({revPct}%)</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-emerald-400"/>Afiliação ({afPct}%)</span>
            </div>
          </div>
        );
      })()}

      {/* ── CARD: FATURAÇÃO POR DIA DE SEMANA ── */}
      {closedDay > 0 && (() => {
        const DAYS_PT = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
        const byWeekday = Array.from({length:7},(_,i)=>({label:DAYS_PT[i],total:0,count:0,ssTotal:0,ssCount:0}));
        daily.forEach(d=>{
          if(d.day>closedDay) return;
          const val=d.value;
          if(val==null||val===0) return;
          const wd=d.weekday!==undefined?d.weekday:new Date(year,monthNum,d.day).getDay();
          if(d.supersales){byWeekday[wd].ssTotal+=val;byWeekday[wd].ssCount++;}
          else{byWeekday[wd].total+=val;byWeekday[wd].count++;}
        });
        const ordered=[1,2,3,4,5,6,0].map(i=>({...byWeekday[i],avg:byWeekday[i].count>0?Math.round(byWeekday[i].total/byWeekday[i].count):null}));
        const maxAvg=Math.max(...ordered.map(d=>d.avg||0));
        if(!maxAvg) return null;
        const barColor=TEAM_COLORS[scope]||"#2563eb";
        return (
          <div className={DS.card}>
            <div>
              <h2 className={DS.title}>MÉDIA POR DIA DA SEMANA</h2>
              <p className={DS.subtitle}>Excluindo dias de Supersales · (Nx) = nº de dias</p>
            </div>
            <div className="space-y-3">
              {ordered.map((d,i)=>{
                const barPct=maxAvg>0&&d.avg?(d.avg/maxAvg*100):0;
                const isWeekend=i>=5;
                return (
                  <div key={d.label} className="flex items-center gap-3">
                    <div className="w-8 text-sm font-semibold text-slate-600 shrink-0 text-right">{d.label}</div>
                    <div className="flex-1 bg-slate-100 rounded-full h-8 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{width:`${barPct}%`,backgroundColor:isWeekend?"#94a3b8":"#6ee7b7",minWidth:barPct>0?"8px":"0"}}/>
                    </div>
                    <div className="w-36 flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold text-slate-800">{d.avg!=null?new Intl.NumberFormat("fr-FR").format(d.avg)+" €/dia":"—"}</span>
                      {d.count>0&&<span className="text-xs text-slate-400">({d.count}x)</span>}
                      {d.ssCount>0&&<span className="text-[10px] bg-amber-100 text-amber-700 rounded px-1">+SS</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-slate-400">Média = valor diário médio excluindo dias de Supersales</p>
          </div>
        );
      })()}

      {/* ── CARD: HISTÓRICO 2025 vs 2026 (só Total) ── */}
      {scope === "total" && histData.some(r=>r[year-1]||r[year]) && (
        <div className={DS.card}>
          <div>
            <h2 className={DS.title}>HISTÓRICO {year-1} VS {year}</h2>
            <p className={DS.subtitle}>Faturação mensal comparativa · actualiza automaticamente</p>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={histData} margin={{top:20,right:8,left:8,bottom:0}} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
              <XAxis dataKey="month" tick={{fontSize:11,fill:"#94a3b8"}} axisLine={false} tickLine={false}/>
              <YAxis tickFormatter={v=>v>=1000000?(v/1000000).toFixed(1)+"M":v>=1000?Math.round(v/1000)+"k":String(v)}
                tick={{fontSize:10,fill:"#94a3b8"}} axisLine={false} tickLine={false} width={44}/>
              <Tooltip formatter={(v,name)=>[new Intl.NumberFormat("fr-FR").format(v)+" €",name]}
                contentStyle={{borderRadius:"8px",border:"1px solid #e2e8f0",fontSize:"12px"}}/>
              <Legend iconType="square" iconSize={10} formatter={v=><span style={{fontSize:"11px",color:"#64748b"}}>{v}</span>}/>
              <Bar dataKey={String(year-1)} name={String(year-1)} fill="#F4A261" radius={[3,3,0,0]} maxBarSize={30}/>
              <Bar dataKey={String(year)} name={String(year)} fill="#8B4513" radius={[3,3,0,0]} maxBarSize={30}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── 7. Per-market historical chart (non-total scopes) ── */}
      {scope !== "total" && mktHistData.some(r=>r[year-1]||r[year]) && (
        <div className={DS.card}>
          <div>
            <h2 className={DS.title}>HISTÓRICO {year-1} VS {year}</h2>
            <p className={DS.subtitle}>{SCOPES.find(s=>s.id===scope)?.label} · faturação mensal comparativa</p>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={mktHistData} margin={{top:20,right:8,left:8,bottom:0}} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
              <XAxis dataKey="month" tick={{fontSize:11,fill:"#94a3b8"}} axisLine={false} tickLine={false}/>
              <YAxis tickFormatter={v=>v>=1000000?(v/1000000).toFixed(1)+"M":v>=1000?Math.round(v/1000)+"k":String(v)}
                tick={{fontSize:10,fill:"#94a3b8"}} axisLine={false} tickLine={false} width={44}/>
              <Tooltip formatter={(v,name)=>[new Intl.NumberFormat("fr-FR").format(v)+" €",name]}
                contentStyle={{borderRadius:"8px",border:"1px solid #e2e8f0",fontSize:"12px"}}/>
              <Legend iconType="square" iconSize={10} formatter={v=><span style={{fontSize:"11px",color:"#64748b"}}>{v}</span>}/>
              <Bar dataKey={String(year-1)} name={String(year-1)} fill="#F4A261" radius={[3,3,0,0]} maxBarSize={30}/>
              <Bar dataKey={String(year)} name={String(year)} fill="#3A9E8F" radius={[3,3,0,0]} maxBarSize={30}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── 8. Daily revenue chart for each market ── */}
      {scope !== "total" && closedDay > 0 && (() => {
        const scopeLabel2 = SCOPES.find(s=>s.id===scope)?.label || scope;
        const chartData = daily
          .filter(d => d.day <= closedDay)
          .map(d => ({
            dia: d.day,
            valor: d.value > 0 ? d.value : null,
            supersales: d.supersales,
          }));
        if (!chartData.some(d=>d.valor)) return null;
        return (
          <div className={DS.card}>
            <div>
              <h2 className={DS.title}>FATURAÇÃO DIÁRIA</h2>
              <p className={DS.subtitle}>{scopeLabel2} · {month} {year} · valor faturado por dia</p>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{top:10,right:8,left:8,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                <XAxis dataKey="dia" tick={{fontSize:10,fill:"#94a3b8"}} axisLine={false} tickLine={false}
                  label={{value:"Dia",position:"insideBottomRight",offset:-5,fontSize:10,fill:"#94a3b8"}}/>
                <YAxis tickFormatter={v=>v>=1000?Math.round(v/1000)+"k":String(v)}
                  tick={{fontSize:10,fill:"#94a3b8"}} axisLine={false} tickLine={false} width={40}/>
                <Tooltip
                  formatter={(v)=>[new Intl.NumberFormat("fr-FR").format(v)+" €","Faturação"]}
                  labelFormatter={l=>`Dia ${l}`}
                  contentStyle={{borderRadius:"8px",border:"1px solid #e2e8f0",fontSize:"12px"}}/>
                <Bar dataKey="valor" radius={[3,3,0,0]} maxBarSize={24}>
                  {chartData.map((d,i)=>(
                    <Cell key={i} fill={d.supersales?"#F59E0B":"#3A9E8F"}/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {chartData.some(d=>d.supersales) && (
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-emerald-500"/>Dia normal</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-amber-400"/>Supersales</span>
              </div>
            )}
          </div>
        );
      })()}

      {modal && (
        <DailyModal mode={modal} daily={daily} closedDay={closedDay} goal={goal}
          dailyAvg={dailyAvg} scope={scope} onClose={() => setModal(null)} />
      )}
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

  const statusBadge = (
    <div className="flex items-center gap-2 shrink-0 text-xs">
      {saving && <span className="text-slate-400 animate-pulse">A guardar…</span>}
      {saved && !saving && <span className="text-green-600 font-medium">✓ Guardado</span>}
    </div>
  );

  // ── 2025: formulário simples de total mensal por mercado ──
  if (year === 2025) {
    const monthTotal = entries["_total"] || {};
    const grandTotal = TEAMS.reduce((s, t) => s + (Number(monthTotal[t]) || 0), 0);
    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-slate-900">Registo Revenda — {MONTH_PT} {year}
            <span className="ml-2 text-xs font-normal text-slate-400">→ alimenta o separador <span className="text-blue-700 font-semibold">Revenda</span></span>
          </h3>
            <p className="text-xs text-slate-500 mt-1">
              Insere o <strong>total mensal</strong> de faturação por mercado para {year}. Guardado automaticamente.
            </p>
          </div>
          {statusBadge}
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {TEAMS.map(t => (
              <div key={t} className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: TEAM_COLORS[t] }}>{t}</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={monthTotal[t] ?? ""}
                  onChange={e => setField("_total", t, e.target.value)}
                  placeholder="0"
                  className="text-right px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between bg-slate-50 rounded-xl px-5 py-4 border border-slate-200">
            <span className="text-sm font-medium text-slate-600">Total {MONTH_PT} {year}</span>
            <span className="text-2xl font-bold text-slate-900">{grandTotal > 0 ? fmtEur(grandTotal) : "—"}</span>
          </div>
        </div>
      </div>
    );
  }

  // ── 2026+: tabela dia a dia ──
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
        {statusBadge}
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
              Equipa PT = Portugal + Outros · Equipa FR = França + CH-BNL-DEAT · Equipa NA = CZ-SK-GR-CY-PL + USA
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
  { code: "CZ-SK-GR-CY-PL", name: "CZ-SK-GR-CY-PL" },
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
  const dataRef = React.useRef(null);
  const saveTimer = React.useRef(null);

  useEffect(() => {
    (async () => {
      const curr = await loadClosing(year, monthNum);
      const prev = await loadClosing(year - 1, monthNum);
      if (prev) {
        // Global
        if (!curr.afil_prev && prev.afil_result) curr.afil_prev = prev.afil_result;
        if (!curr.afil_objective) curr.afil_objective = curr.afil_objective || "";
        // Per market
        MC_MARKETS.forEach(m => {
          if (!curr.markets[m.code]) curr.markets[m.code] = {};
          if (!curr.markets[m.code].afil_prev && prev.markets?.[m.code]?.afil_result)
            curr.markets[m.code].afil_prev = prev.markets[m.code].afil_result;
        });
      }
      setData(curr); dataRef.current = curr; setSaved(false);
    })();
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [year, monthNum]);

  const triggerAutoSave = (latest) => {
    dataRef.current = latest;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaved(false);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await saveClosing(year, monthNum, dataRef.current);
      setSaving(false); setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }, 800);
  };

  const upField = (updater) => {
    setData(p => {
      const next = updater(p);
      triggerAutoSave(next);
      return next;
    });
  };

  const upMkt = (code, field, val) =>
    upField(p => ({ ...p, markets: { ...p.markets, [code]: { ...p.markets[code], [field]: val } } }));

  if (!data) return <div className="text-center py-8 text-slate-400 text-sm">A carregar…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-500"/>
          <p className="text-sm text-slate-500">Fecho mensal · {MC_MONTHS_PT[monthNum+1]} {year}</p>
        </div>
        <div className="text-xs">
          {saving && <span className="text-slate-400 animate-pulse">A guardar…</span>}
          {saved && !saving && <span className="text-green-600 font-medium">✓ Guardado</span>}
        </div>
      </div>

      <MCCard title="Afiliação — Resultados globais">
        <div className="grid grid-cols-3 gap-3">
          <MCField label={`Resultado ${year-1} (€)`} value={data.afil_prev} onChange={v => upField(p => ({...p, afil_prev: v}))} />
          <MCField label="Objetivo (€)" value={data.afil_objective} onChange={v => upField(p => ({...p, afil_objective: v}))} />
          <MCField label={`Resultado ${year} (€)`} value={data.afil_result} onChange={v => upField(p => ({...p, afil_result: v}))} />
        </div>
      </MCCard>

      {MC_MARKETS.map(m => (
        <MCCard key={m.code} title={m.name} accent="text-orange-600">
          <div className="grid grid-cols-1 gap-3">
            <MCField label="Afiliação (€)" value={data.markets[m.code]?.afil_result||""} onChange={v => upMkt(m.code,"afil_result",v)} />
          </div>
        </MCCard>
      ))}
    </div>
  );
}

// ─── ENCOMENDAS ───────────────────────────────────────────────────────────────

function Encomendas({ monthNum, year, isAdmin }) {
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dataRef = React.useRef(null);
  const saveTimer = React.useRef(null);

  useEffect(() => {
    (async () => {
      const curr = await loadClosing(year, monthNum);
      const prev = await loadClosing(year - 1, monthNum);
      if (prev) {
        MC_MARKETS.forEach(m => {
          if (!curr.markets[m.code]) curr.markets[m.code] = {};
          const pm = prev.markets?.[m.code] || {};
          const cm = curr.markets[m.code];
          if (!cm.orders_prev && pm.orders_curr)             cm.orders_prev = pm.orders_curr;
          if (!cm.first_orders_prev && pm.first_orders_curr) cm.first_orders_prev = pm.first_orders_curr;
          if (!cm.first_orders_rev_prev && pm.first_orders_rev_curr)
            cm.first_orders_rev_prev = pm.first_orders_rev_curr;
        });
      }
      setData(curr); dataRef.current = curr; setSaved(false);
    })();
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [year, monthNum]);

  const triggerAutoSave = (latest) => {
    dataRef.current = latest;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaved(false);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await saveClosing(year, monthNum, dataRef.current);
      setSaving(false); setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }, 800);
  };

  const upMkt = (code, field, val) =>
    setData(p => {
      const next = { ...p, markets: { ...p.markets, [code]: { ...p.markets[code], [field]: val } } };
      triggerAutoSave(next);
      return next;
    });

  if (!data) return <div className="text-center py-8 text-slate-400 text-sm">A carregar…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500"/>
          <p className="text-sm text-slate-500">Fecho mensal · {MC_MONTHS_PT[monthNum+1]} {year}</p>
        </div>
        <div className="text-xs">
          {saving && <span className="text-slate-400 animate-pulse">A guardar…</span>}
          {saved && !saving && <span className="text-green-600 font-medium">✓ Guardado</span>}
        </div>
      </div>

      {/* Card Total — soma de todos os mercados */}
      {(() => {
        const sumF = (field) => MC_MARKETS.reduce((s,m) => s + (Number(data.markets[m.code]?.[field])||0), 0);
        const totals = {
          orders_prev: sumF("orders_prev"), orders_curr: sumF("orders_curr"),
          first_orders_prev: sumF("first_orders_prev"), first_orders_curr: sumF("first_orders_curr"),
          first_orders_rev_prev: sumF("first_orders_rev_prev"), first_orders_rev_curr: sumF("first_orders_rev_curr"),
        };
        const fmt = n => n > 0 ? new Intl.NumberFormat("fr-FR").format(n) : "—";
        const fmtE = n => n > 0 ? new Intl.NumberFormat("fr-FR").format(n) + " €" : "—";
        const evo = (prev, curr) => prev > 0 && curr > 0 ? ((curr-prev)/prev*100).toFixed(1)+"%" : "—";
        return (
          <MCCard title="Total" accent="text-blue-800">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Encomendas {year-1}</p>
                  <p className="font-semibold text-slate-700">{fmt(totals.orders_prev)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Encomendas {year}</p>
                  <p className="font-bold text-slate-900">{fmt(totals.orders_curr)}</p>
                  <p className={`text-xs font-semibold mt-0.5 ${totals.orders_curr>=totals.orders_prev?"text-green-600":"text-red-600"}`}>{evo(totals.orders_prev,totals.orders_curr)}</p>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-xs text-slate-400 mb-1">1ªs enc. {year-1}</p>
                  <p className="font-semibold text-slate-700">{fmt(totals.first_orders_prev)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">1ªs enc. {year}</p>
                  <p className="font-bold text-slate-900">{fmt(totals.first_orders_curr)}</p>
                  <p className={`text-xs font-semibold mt-0.5 ${totals.first_orders_curr>=totals.first_orders_prev?"text-green-600":"text-red-600"}`}>{evo(totals.first_orders_prev,totals.first_orders_curr)}</p>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Fat. 1ªs enc. {year-1} (€)</p>
                  <p className="font-semibold text-slate-700">{fmtE(totals.first_orders_rev_prev)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Fat. 1ªs enc. {year} (€)</p>
                  <p className="font-bold text-slate-900">{fmtE(totals.first_orders_rev_curr)}</p>
                  <p className={`text-xs font-semibold mt-0.5 ${totals.first_orders_rev_curr>=totals.first_orders_rev_prev?"text-green-600":"text-red-600"}`}>{evo(totals.first_orders_rev_prev,totals.first_orders_rev_curr)}</p>
                </div>
              </div>
            </div>
          </MCCard>
        );
      })()}

      {MC_MARKETS.map(m => (
        <MCCard key={m.code} title={m.name} accent="text-blue-600">
          <div className="grid grid-cols-3 gap-3">
            <MCField label="Encomendas" value={data.markets[m.code]?.orders_curr||""} onChange={v => upMkt(m.code,"orders_curr",v)} />
            <MCField label="1ªs enc." value={data.markets[m.code]?.first_orders_curr||""} onChange={v => upMkt(m.code,"first_orders_curr",v)} />
            <MCField label="Fat. 1ªs enc. (€)" value={data.markets[m.code]?.first_orders_rev_curr||""} onChange={v => upMkt(m.code,"first_orders_rev_curr",v)} />
          </div>
        </MCCard>
      ))}
    </div>
  );
}

// ─── LEADS / PARCERIAS ────────────────────────────────────────────────────────

function LeadsParcerias({ monthNum, year, isAdmin }) {
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dataRef = React.useRef(null);
  const saveTimer = React.useRef(null);

  useEffect(() => {
    (async () => {
      const curr = await loadClosing(year, monthNum);
      const prev = await loadClosing(year - 1, monthNum);
      if (prev) {
        MC_MARKETS.forEach(m => {
          if (!curr.markets[m.code]) curr.markets[m.code] = {};
          const pm = prev.markets?.[m.code] || {};
          const cm = curr.markets[m.code];
          if (!cm.leads_prev && pm.leads_curr)         cm.leads_prev = pm.leads_curr;
          if (!cm.partners_prev && pm.partners_curr)   cm.partners_prev = pm.partners_curr;
        });
      }
      setData(curr); dataRef.current = curr; setSaved(false);
    })();
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [year, monthNum]);

  const triggerAutoSave = (latest) => {
    dataRef.current = latest;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaved(false);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await saveClosing(year, monthNum, dataRef.current);
      setSaving(false); setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }, 800);
  };

  const upMkt = (code, field, val) =>
    setData(p => {
      const next = { ...p, markets: { ...p.markets, [code]: { ...p.markets[code], [field]: val } } };
      triggerAutoSave(next);
      return next;
    });

  if (!data) return <div className="text-center py-8 text-slate-400 text-sm">A carregar…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-purple-500"/>
          <p className="text-sm text-slate-500">Fecho mensal · {MC_MONTHS_PT[monthNum+1]} {year}</p>
        </div>
        <div className="text-xs">
          {saving && <span className="text-slate-400 animate-pulse">A guardar…</span>}
          {saved && !saving && <span className="text-green-600 font-medium">✓ Guardado</span>}
        </div>
      </div>

      {/* Card Total — soma de todos os mercados */}
      {(() => {
        const sumF = (field) => MC_MARKETS.reduce((s,m) => s + (Number(data.markets[m.code]?.[field])||0), 0);
        const totals = {
          leads_prev: sumF("leads_prev"), leads_curr: sumF("leads_curr"),
          partners_prev: sumF("partners_prev"), partners_curr: sumF("partners_curr"),
        };
        const fmt = n => n > 0 ? new Intl.NumberFormat("fr-FR").format(n) : "—";
        const evo = (prev, curr) => prev > 0 && curr > 0 ? ((curr-prev)/prev*100).toFixed(1)+"%" : "—";
        return (
          <MCCard title="Total" accent="text-purple-800">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Leads {year-1}</p>
                  <p className="font-semibold text-slate-700">{fmt(totals.leads_prev)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Leads {year}</p>
                  <p className="font-bold text-slate-900">{fmt(totals.leads_curr)}</p>
                  <p className={`text-xs font-semibold mt-0.5 ${totals.leads_curr>=totals.leads_prev?"text-green-600":"text-red-600"}`}>{evo(totals.leads_prev,totals.leads_curr)}</p>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Novos parceiros {year-1}</p>
                  <p className="font-semibold text-slate-700">{fmt(totals.partners_prev)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Novos parceiros {year}</p>
                  <p className="font-bold text-slate-900">{fmt(totals.partners_curr)}</p>
                  <p className={`text-xs font-semibold mt-0.5 ${totals.partners_curr>=totals.partners_prev?"text-green-600":"text-red-600"}`}>{evo(totals.partners_prev,totals.partners_curr)}</p>
                </div>
              </div>
            </div>
          </MCCard>
        );
      })()}

      {MC_MARKETS.map(m => (
        <MCCard key={m.code} title={m.name} accent="text-purple-600">
          <div className="grid grid-cols-2 gap-3">
            <MCField label="Leads" value={data.markets[m.code]?.leads_curr||""} onChange={v => upMkt(m.code,"leads_curr",v)} />
            <MCField label="Novos parceiros" value={data.markets[m.code]?.partners_curr||""} onChange={v => upMkt(m.code,"partners_curr",v)} />
          </div>
        </MCCard>
      ))}
    </div>
  );
}


// ─── RELATÓRIO (auto-fill version) ───────────────────────────────────────────

function Relatorio({ monthNum, year }) {
  const [step, setStep] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [closingCurr, setClosingCurr] = useState(null);
  const [closingPrev, setClosingPrev] = useState(null);

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

      // Load closing data for margin/orders in PPTX
      loadClosing(year, monthNum).then(setClosingCurr);
      loadClosing(year - 1, monthNum).then(setClosingPrev);

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
    await saveDraft();
    try {
      const pptxgenjs = await import("pptxgenjs");
      const PptxGenJS = pptxgenjs.default || pptxgenjs;
      const prs = new PptxGenJS();
      prs.layout = "LAYOUT_WIDE";
      prs.title = `Apresentação de Resultados – ${MC_MONTHS_PT[monthNum+1]} ${year}`;

      // ── Design system (Prozis Partners template) ──
      const C = {
        cream:   "F2F0EB",  // background
        white:   "FFFFFF",
        black:   "1A1A1A",
        teal:    "3A9E8F",  // primary accent
        tealDk:  "2E7D71",  // dark teal
        tealLt:  "D6EDE9",  // light teal card bg
        gray:    "E8E6E1",  // divider
        grayDk:  "888888",  // muted text
        grayLt:  "F7F5F1",  // subtle card bg
        green:   "2E7D71",
        red:     "C0392B",
      };
      const W = 13.33, H = 7.5;
      const FF = "Calibri";
      const mLabel = MONTHS_UPPER[monthNum+1];

      // Format helpers
      const fmtN = n => n == null ? "—" : new Intl.NumberFormat("fr-FR").format(Math.round(n));
      const fmtE2 = n => n == null ? "—" : fmtN(n) + " €";
      const fmtP2 = (n, sign=false) => {
        if (n == null || isNaN(n)) return "—";
        const s = Math.abs(n).toFixed(2) + "%";
        return sign ? (n>=0?"+":"-")+s : s;
      };
      const evo2 = (prev, curr) => {
        if (!prev || !curr) return "—";
        const e = ((curr-prev)/prev*100);
        return fmtP2(e, true);
      };
      const N2 = s => parseFloat(s)||0;

      // ── Slide helpers ──

      // Cream background on every slide
      function bgCream(s) { s.background = {color: C.cream}; }

      // Section separator slide (design: teal circle badge + bordered box label)
      function addSep(num, title) {
        const s = prs.addSlide(); bgCream(s);
        // Diagonal stripe watermark
        s.addShape(prs.ShapeType.rect, {x:4.5,y:-1,w:12,h:10, rotate:15,
          fill:{color:"E8E6E1",transparency:70}, line:{color:"E8E6E1",transparency:70}});
        s.addShape(prs.ShapeType.rect, {x:5.5,y:-1,w:12,h:10, rotate:15,
          fill:{color:"E8E6E1",transparency:80}, line:{color:"E8E6E1",transparency:80}});
        // Teal circle with number
        s.addShape(prs.ShapeType.ellipse, {x:3.9, y:3.1, w:0.9, h:0.9,
          fill:{color:C.teal}, line:{color:C.teal}});
        s.addText(String(num), {x:3.9,y:3.05,w:0.9,h:0.9,
          fontSize:28, bold:true, color:C.white, align:"center", fontFace:FF});
        // Bordered label box
        s.addShape(prs.ShapeType.rect, {x:4.95,y:2.85,w:7.2,h:0.85,
          fill:{color:C.white,transparency:100}, line:{color:C.teal,pt:1.5}});
        s.addText("DEPARTAMENTO", {x:5.1,y:2.88,w:7,h:0.25,
          fontSize:10, bold:true, color:C.teal, fontFace:FF, charSpacing:3});
        s.addText(title, {x:5.1,y:3.18,w:7,h:0.45,
          fontSize:26, bold:false, color:C.black, fontFace:FF});
      }

      // Result slide (3 cards + detail row + progress bar)
      function addResult(dept, subtitle, prevYear, objective, result) {
        const s = prs.addSlide(); bgCream(s);
        // Title
        s.addText(dept, {x:0.5,y:0.25,w:12,h:0.5, fontSize:32,bold:true,color:C.black,fontFace:FF});
        s.addText(subtitle, {x:0.5,y:0.75,w:12,h:0.28, fontSize:13,color:C.grayDk,fontFace:FF});

        // 3 KPI cards
        const cards = [
          {label:`RESULTADO ${mLabel} ${year-1}`, val: fmtE2(prevYear), big:false, bordered:false},
          {label:`OBJETIVO ${mLabel} ${year}`,   val: fmtE2(objective),
           sub: objective&&prevYear ? fmtP2((objective-prevYear)/prevYear*100,true)+" vs resultado "+mLabel.toLowerCase()+" "+(year-1) : "",
           big:false, bordered:false, teal:true},
          {label:`RESULTADO ${mLabel} ${year}`,  val: fmtE2(result),
           sub: result&&prevYear ? fmtP2((result-prevYear)/prevYear*100,true)+" vs "+(year-1) : "",
           big:true, bordered:true, teal:true},
        ];
        cards.forEach((c,i) => {
          const x = 0.5 + i*4.15;
          s.addShape(prs.ShapeType.roundRect, {x, y:1.15, w:3.95, h:1.55,
            fill:{color:C.tealLt}, line:{color: c.bordered ? C.teal : C.tealLt, pt: c.bordered?2:1},
            rectRadius:0.12});
          s.addText(c.label, {x:x+0.18,y:1.22,w:3.6,h:0.28, fontSize:9,color:C.grayDk,fontFace:FF,bold:false});
          s.addText(c.val, {x:x+0.18,y:1.52,w:3.6,h:0.55,
            fontSize: c.big?28:22, bold:c.big, color: c.teal?C.teal:C.black, fontFace:FF});
          if (c.sub) s.addText(c.sub, {x:x+0.18,y:2.12,w:3.6,h:0.22,
            fontSize:10, bold:c.big, color:C.teal, fontFace:FF});
        });

        // Detail row
        const evoPct = prevYear ? ((result-prevYear)/prevYear*100) : 0;
        const evoAbs = result - (prevYear||0);
        const aboveObj = result - (objective||0);
        const pctObj = objective ? (result/objective*100) : 0;
        const details = [
          {label:"Evolução vs "+(year-1), val: fmtP2(evoPct,true)},
          {label:"Ganho absoluto",          val: (evoAbs>=0?"+":"")+fmtE2(evoAbs)},
          {label:"Acima do objetivo",       val: fmtE2(aboveObj)},
          {label:"% do objetivo",           val: fmtP2(pctObj)},
        ];
        s.addShape(prs.ShapeType.roundRect, {x:0.5,y:2.88,w:12.33,h:1.0,
          fill:{color:C.white}, line:{color:C.gray,pt:1}, rectRadius:0.1});
        s.addText("DETALHE DO RESULTADO", {x:0.72,y:2.93,w:4,h:0.22,
          fontSize:8, bold:true, color:C.grayDk, fontFace:FF, charSpacing:2});
        details.forEach((d,i) => {
          const x = 0.72 + i*3.08;
          if (i>0) s.addShape(prs.ShapeType.line, {x:x-0.05,y:3.05,w:0,h:0.65,
            line:{color:C.gray,pt:1}});
          s.addText(d.label, {x:x+0.05,y:3.06,w:2.9,h:0.22, fontSize:11,color:C.black,fontFace:FF});
          const pos = !d.val.startsWith("-");
          s.addText(d.val, {x:x+0.05,y:3.32,w:2.9,h:0.42,
            fontSize:22, bold:true, color: i===0||i===3 ? C.teal : C.black, fontFace:FF});
        });

        // Progress bar
        s.addShape(prs.ShapeType.roundRect, {x:0.5,y:4.08,w:12.33,h:1.75,
          fill:{color:C.white}, line:{color:C.gray,pt:1}, rectRadius:0.1});
        s.addText("CONCRETIZAÇÃO DO OBJETIVO", {x:0.72,y:4.13,w:6,h:0.24,
          fontSize:8, bold:true, color:C.grayDk, fontFace:FF, charSpacing:2});
        const barW = 11.5;
        const barX = 0.72;
        const barY = 4.52;
        const barH = 0.28;
        const clampPct = Math.min(pctObj/100, 1);
        const excessPct = Math.max(0, pctObj/100 - 1);
        // Bar track
        s.addShape(prs.ShapeType.roundRect, {x:barX,y:barY,w:barW,h:barH,
          fill:{color:C.gray}, line:{color:C.gray,pt:0.5}, rectRadius:0.05});
        // Main bar (up to objective)
        s.addShape(prs.ShapeType.roundRect, {x:barX,y:barY,w:barW*clampPct,h:barH,
          fill:{color:C.teal}, line:{color:C.teal}, rectRadius:0.05});
        // Excess bar
        if (excessPct>0) {
          s.addShape(prs.ShapeType.roundRect, {x:barX+barW*clampPct,y:barY,w:barW*excessPct,h:barH,
            fill:{color:C.tealLt}, line:{color:C.teal,pt:0.5}, rectRadius:0.05});
        }
        // Objective line
        s.addShape(prs.ShapeType.line, {x:barX+barW*clampPct,y:barY-0.05,w:0,h:barH+0.1,
          line:{color:C.black,pt:2}});
        // Labels
        s.addText("% do objetivo", {x:barX,y:barY+0.35,w:2,h:0.24, fontSize:9,color:C.grayDk,fontFace:FF});
        s.addText(fmtP2(pctObj), {x:barX,y:barY+0.57,w:2,h:0.38, fontSize:22,bold:true,color:C.teal,fontFace:FF});
        if (aboveObj>0) {
          s.addShape(prs.ShapeType.roundRect, {x:barX+7.5,y:barY+0.42,w:4,h:0.32,
            fill:{color:C.tealLt}, line:{color:C.teal,pt:0.5}, rectRadius:0.08});
          s.addText(`✓  +${fmtE2(aboveObj)} acima do objetivo`, {x:barX+7.6,y:barY+0.46,w:3.8,h:0.24,
            fontSize:9, color:C.teal, bold:true, fontFace:FF});
        }
        // Legend
        const legends = [
          {color:C.teal, label:`Realizado até objetivo (${fmtE2(objective)})`},
          {color:C.tealLt, label:`Excedente (+${fmtE2(aboveObj)})`},
        ];
        legends.forEach((l,i) => {
          const lx = barX + i*4.5;
          s.addShape(prs.ShapeType.rect, {x:lx,y:6.08,w:0.18,h:0.12,fill:{color:l.color},line:{color:l.color}});
          s.addText(l.label, {x:lx+0.25,y:6.05,w:4,h:0.2, fontSize:9,color:C.grayDk,fontFace:FF});
        });
        s.addShape(prs.ShapeType.line, {x:barX+9,y:6.08,w:0,h:0.12,line:{color:C.black,pt:1.5}});
        s.addText("Linha de objetivo", {x:barX+9.1,y:6.05,w:3,h:0.2, fontSize:9,color:C.grayDk,fontFace:FF});
      }

      // Market distribution table slide
      function addMktTable(dept, subtitle, rows) {
        const s = prs.addSlide(); bgCream(s);
        s.addText(dept, {x:0.5,y:0.25,w:8,h:0.45, fontSize:28,bold:true,color:C.black,fontFace:FF});
        s.addText(subtitle, {x:0.5,y:0.72,w:9,h:0.28, fontSize:13,color:C.grayDk,fontFace:FF});
        // Table
        const tRows = [
          [{text:"MERCADO",options:{bold:true,color:C.white,fill:{color:C.teal},fontSize:10}},
           {text:"FATURAÇÃO",options:{bold:true,color:C.white,fill:{color:C.teal},fontSize:10,align:"right"}}],
          ...rows.map((r,i)=>[
            {text:r[0],options:{fontSize:10,fill:{color:i%2===0?C.white:C.grayLt},color:C.black}},
            {text:r[1],options:{fontSize:10,bold:true,align:"right",fill:{color:i%2===0?C.white:C.grayLt},color:C.black}},
          ])
        ];
        s.addTable(tRows, {x:0.5,y:1.15,w:5.5,colW:[4,1.5],border:{type:"solid",color:C.gray,pt:0.5},rowH:0.45});
      }

      // ─────────────────────────────────────────────
      // SLIDE 1: CAPA
      // ─────────────────────────────────────────────
      const s1 = prs.addSlide(); bgCream(s1);
      // Diagonal stripe left
      s1.addShape(prs.ShapeType.rect, {x:-1,y:-0.5,w:4,h:9,rotate:5,
        fill:{color:"ECEAE4",transparency:30},line:{color:"ECEAE4",transparency:30}});
      // Teal bar left edge
      s1.addShape(prs.ShapeType.rect, {x:0,y:0,w:0.35,h:H,fill:{color:C.teal},line:{color:C.teal}});
      // Logo area
      s1.addText("PROZIS PARTNERS", {x:0.6,y:0.4,w:6,h:0.5,
        fontSize:16,bold:true,color:C.teal,fontFace:FF,charSpacing:2});
      // Title
      s1.addText("Apresentação\nde resultados", {x:0.6,y:2.5,w:7,h:2.2,
        fontSize:52,bold:true,color:C.black,fontFace:FF,breakLine:true});
      s1.addText(`${mLabel} ${year}`, {x:0.6,y:4.7,w:7,h:0.8,
        fontSize:36,bold:true,color:C.teal,fontFace:FF});

      // ─────────────────────────────────────────────
      // REVENDA
      // ─────────────────────────────────────────────
      addSep(1, "REVENDA");
      addResult("REVENDA", `${mLabel} ${year} – em comparação ao ano anterior`,
        N2(rev.prev_year), N2(rev.objective), N2(rev.result));

      // Trimestre (only if quarter month)
      if (isQuarterMonth) {
        const qPrev=N2(rev.q_result_prev_year), qObj=N2(rev.q_objective), qRes=N2(rev.q_result);
        const qEvo = qPrev?((qRes-qPrev)/qPrev*100):0;
        const sq = prs.addSlide(); bgCream(sq);
        sq.addText("REVENDA", {x:0.5,y:0.25,w:8,h:0.45,fontSize:28,bold:true,color:C.black,fontFace:FF});
        sq.addText("Mensal", {x:0.5,y:0.72,w:9,h:0.28,fontSize:13,color:C.grayDk,fontFace:FF});
        const qCards = [
          {label:`1º TRIMESTRE ${year-1}`, val:fmtE2(qPrev)},
          {label:`OBJETIVO TRIMESTRE ${year}`, val:fmtE2(qObj),
           sub:qPrev?fmtP2((qObj-qPrev)/qPrev*100,true)+" vs resultado 1º trimestre "+(year-1):""},
          {label:`RESULTADO TRIMESTRE ${year}`, val:fmtE2(qRes),
           sub:qPrev?fmtP2(qEvo,true)+" vs "+(year-1):"", big:true},
        ];
        qCards.forEach((c,i)=>{
          const x=0.5+i*4.15;
          sq.addShape(prs.ShapeType.roundRect,{x,y:1.15,w:3.95,h:c.big?1.8:1.55,
            fill:{color:C.tealLt},line:{color:c.big?C.teal:C.tealLt,pt:c.big?2:1},rectRadius:0.12});
          sq.addText(c.label,{x:x+0.18,y:1.22,w:3.6,h:0.28,fontSize:9,color:C.grayDk,fontFace:FF});
          sq.addText(c.val,{x:x+0.18,y:1.52,w:3.6,h:0.55,
            fontSize:c.big?26:20,bold:c.big,color:C.teal,fontFace:FF});
          if(c.sub) sq.addText(c.sub,{x:x+0.18,y:2.1,w:3.6,h:0.22,fontSize:10,bold:c.big,color:C.teal,fontFace:FF});
        });
        const qMonthNums = monthNum<3?[1,2,3]:monthNum<6?[4,5,6]:monthNum<9?[7,8,9]:[10,11,12];
        const qTblRows = [
          [{text:"MÉTRICA",options:{bold:true,color:C.white,fill:{color:C.teal},fontSize:9}},
           ...qMonthNums.map(mn=>({text:MONTHS_UPPER[mn],options:{bold:true,color:C.white,fill:{color:C.teal},fontSize:9,align:"right"}}))],
          [{text:"FATURAÇÃO",options:{fontSize:9}},
           {text:fmtN(N2(rev.q_month1_revenue)),options:{fontSize:9,bold:true,align:"right"}},
           {text:fmtN(N2(rev.q_month2_revenue)),options:{fontSize:9,bold:true,align:"right"}},
           {text:fmtN(N2(rev.q_month3_revenue)),options:{fontSize:9,bold:true,align:"right"}}],
          [{text:"EVOLUÇÃO FACE AO ANO ANTERIOR",options:{fontSize:9}},
           {text:fmtP2(N2(rev.q_month1_evolution),true),options:{fontSize:9,color:N2(rev.q_month1_evolution)>=0?C.teal:C.red,align:"right"}},
           {text:fmtP2(N2(rev.q_month2_evolution),true),options:{fontSize:9,color:N2(rev.q_month2_evolution)>=0?C.teal:C.red,align:"right"}},
           {text:fmtP2(N2(rev.q_month3_evolution),true),options:{fontSize:9,color:N2(rev.q_month3_evolution)>=0?C.teal:C.red,align:"right"}}],
          [{text:"MARGEM",options:{fontSize:9}},
           {text:fmtP2(N2(rev.q_month1_margin)),options:{fontSize:9,align:"right"}},
           {text:fmtP2(N2(rev.q_month2_margin)),options:{fontSize:9,align:"right"}},
           {text:fmtP2(N2(rev.q_month3_margin)),options:{fontSize:9,align:"right"}}],
        ];
        sq.addTable(qTblRows,{x:0.5,y:3.2,w:12.3,colW:[5,2.1,2.1,2.1],
          border:{type:"solid",color:C.gray,pt:0.5},rowH:0.48});
      }

      // Market distribution — revenda
      const revMktRows = MC_MARKETS
        .filter(m=>N2(rev.byMarket[m.code]?.curr)>0)
        .sort((a,b)=>N2(rev.byMarket[b.code]?.curr)-N2(rev.byMarket[a.code]?.curr))
        .map(m=>[m.name, fmtE2(N2(rev.byMarket[m.code]?.curr))]);
      if (revMktRows.length) addMktTable("REVENDA","Distribuição da faturação por mercado", revMktRows);

      // Programs
      const progRows = MC_PROGRAMS.filter(p=>N2(programs[p]?.curr)>0)
        .sort((a,b)=>N2(programs[b]?.curr)-N2(programs[a]?.curr))
        .map(p=>[p, fmtE2(N2(programs[p]?.curr))]);
      if (progRows.length) addMktTable("REVENDA","Distribuição da faturação por programa", progRows);

      // ─────────────────────────────────────────────
      // AFILIAÇÃO
      // ─────────────────────────────────────────────
      addSep(2, "AFILIAÇÃO");
      addResult("AFILIAÇÃO", `${mLabel} ${year} – em comparação ao ano anterior`,
        N2(afil.prev_year), N2(afil.objective), N2(afil.result));

      const afilMktRows = MC_MARKETS
        .filter(m=>N2(afil.byMarket[m.code]?.curr)>0)
        .sort((a,b)=>N2(afil.byMarket[b.code]?.curr)-N2(afil.byMarket[a.code]?.curr))
        .map(m=>[m.name, fmtE2(N2(afil.byMarket[m.code]?.curr))]);
      if (afilMktRows.length) addMktTable("AFILIAÇÃO","Distribuição da afiliação por mercado", afilMktRows);

      // ─────────────────────────────────────────────
      // TOTAL
      // ─────────────────────────────────────────────
      addSep(3, "TOTAL");
      const totResult = N2(rev.result)+N2(afil.result);
      const totPrev   = N2(rev.prev_year)+N2(afil.prev_year);
      const totObj    = N2(rev.objective)+N2(afil.objective);
      addResult("REVENDA + AFILIAÇÃO", `${mLabel} ${year} – em comparação ao ano anterior`,
        totPrev, totObj, totResult);

      // Total breakdown slide
      const st = prs.addSlide(); bgCream(st);
      st.addText("REVENDA + AFILIAÇÃO", {x:0.5,y:0.25,w:12,h:0.45,fontSize:28,bold:true,color:C.black,fontFace:FF});
      st.addText(`${mLabel} ${year} – Histórico em gráficos`, {x:0.5,y:0.72,w:12,h:0.28,fontSize:13,color:C.grayDk,fontFace:FF});
      const revPct = totResult>0?Math.round(N2(rev.result)/totResult*100):0;
      const afPct  = totResult>0?Math.round(N2(afil.result)/totResult*100):0;
      st.addShape(prs.ShapeType.roundRect,{x:0.5,y:1.2,w:3.5,h:2.5,
        fill:{color:C.tealLt},line:{color:C.teal,pt:1},rectRadius:0.12});
      st.addText("TOTAL", {x:0.6,y:1.28,w:3.3,h:0.28,fontSize:9,bold:true,color:C.grayDk,fontFace:FF});
      st.addText(fmtE2(totResult), {x:0.6,y:1.6,w:3.3,h:0.65,fontSize:24,bold:true,color:C.black,fontFace:FF});
      // Revenda / Afil boxes
      [{label:"REVENDA",val:N2(rev.result),pct:revPct,y:3.95},{label:"AFILIAÇÃO",val:N2(afil.result),pct:afPct,y:5.1}]
      .forEach((item)=>{
        st.addShape(prs.ShapeType.roundRect,{x:0.5,y:item.y,w:3.5,h:0.95,
          fill:{color:C.tealLt},line:{color:C.teal,pt:0.5},rectRadius:0.1});
        st.addText(item.label,{x:0.65,y:item.y+0.08,w:2,h:0.25,fontSize:9,bold:true,color:C.grayDk,fontFace:FF});
        st.addText(fmtE2(item.val),{x:0.65,y:item.y+0.35,w:2.8,h:0.42,fontSize:18,bold:true,color:C.teal,fontFace:FF});
        st.addText(`${item.pct}%`,{x:3.1,y:item.y+0.25,w:0.9,h:0.45,fontSize:22,bold:true,color:C.teal,fontFace:FF,align:"right"});
      });

      // ─────────────────────────────────────────────
      // ENCOMENDAS
      // ─────────────────────────────────────────────
      addSep(4, "ENCOMENDAS");
      const encTotCurr  = MC_MARKETS.reduce((s,m)=>s+(N2(orders.byMarket[m.code]?.orders_curr)),0);
      const encTotPrev  = MC_MARKETS.reduce((s,m)=>s+(N2(orders.byMarket[m.code]?.orders_prev)),0);
      const enc1stCurr  = MC_MARKETS.reduce((s,m)=>s+(N2(orders.byMarket[m.code]?.first_curr)),0);
      const enc1stPrev  = MC_MARKETS.reduce((s,m)=>s+(N2(orders.byMarket[m.code]?.first_prev)),0);
      const encRev1Curr = MC_MARKETS.reduce((s,m)=>s+(N2(orders.byMarket[m.code]?.first_rev_curr)),0);
      const encRev1Prev = MC_MARKETS.reduce((s,m)=>s+(N2(orders.byMarket[m.code]?.first_rev_prev)),0);

      const se = prs.addSlide(); bgCream(se);
      se.addText("ENCOMENDAS", {x:0.5,y:0.25,w:12,h:0.45,fontSize:28,bold:true,color:C.black,fontFace:FF});
      se.addText(`${mLabel} ${year}`, {x:0.5,y:0.72,w:12,h:0.28,fontSize:13,color:C.grayDk,fontFace:FF});
      se.addText("DETALHE POR MÉTRICA", {x:0.5,y:1.12,w:12,h:0.25,fontSize:8,bold:true,color:C.grayDk,fontFace:FF,charSpacing:2});
      const encMetrics = [
        [`ENCOMENDAS TOTAIS`, fmtN(encTotPrev), fmtN(encTotCurr), evo2(encTotPrev,encTotCurr)],
        [`PRIMEIRAS ENCOMENDAS`, fmtN(enc1stPrev), fmtN(enc1stCurr), evo2(enc1stPrev,enc1stCurr)],
        [`FATURAÇÃO 1ªs ENC.`, fmtE2(encRev1Prev), fmtE2(encRev1Curr), evo2(encRev1Prev,encRev1Curr)],
      ];
      const encHdr = [
        [{text:"",options:{fill:{color:C.teal}}},{text:mLabel+" "+(year-1),options:{bold:true,color:C.white,fill:{color:C.teal},align:"right",fontSize:10}},
         {text:mLabel+" "+year,options:{bold:true,color:C.white,fill:{color:C.teal},align:"right",fontSize:10}},
         {text:"EVOLUÇÃO",options:{bold:true,color:C.white,fill:{color:C.teal},align:"right",fontSize:10}}],
        ...encMetrics.map((r,i)=>{
          const bg=i%2===0?C.white:C.grayLt;
          const pos=r[3].startsWith("+");
          return [{text:r[0],options:{fontSize:10,fill:{color:bg},bold:true}},
            {text:r[1],options:{fontSize:10,align:"right",fill:{color:bg}}},
            {text:r[2],options:{fontSize:10,bold:true,align:"right",fill:{color:bg}}},
            {text:r[3],options:{fontSize:10,align:"right",fill:{color:bg},color:pos?C.teal:C.red,bold:true}}];
        })
      ];
      se.addTable(encHdr,{x:0.5,y:1.4,w:12.3,colW:[4.5,2.5,2.5,2.8],
        border:{type:"solid",color:C.gray,pt:0.5},rowH:0.52});

      // ─────────────────────────────────────────────
      // LEADS
      // ─────────────────────────────────────────────
      addSep(5, "LEADS E NOVAS PARCERIAS");
      const leadsTotal = MC_MARKETS.reduce((s,m)=>s+N2(leads.byMarket[m.code]?.curr),0);
      const leadsPrevTotal = MC_MARKETS.reduce((s,m)=>s+N2(leads.byMarket[m.code]?.prev),0);
      const partnersTotal = MC_MARKETS.reduce((s,m)=>s+N2(leads.byMarket[m.code]?.partners_curr),0);
      const partnersPrevT = MC_MARKETS.reduce((s,m)=>s+N2(leads.byMarket[m.code]?.partners_prev),0);

      // Leads by market table
      const leadsRows = MC_MARKETS
        .filter(m=>N2(leads.byMarket[m.code]?.curr)>0)
        .sort((a,b)=>N2(leads.byMarket[b.code]?.curr)-N2(leads.byMarket[a.code]?.curr))
        .map(m=>[m.name, String(Math.round(N2(leads.byMarket[m.code]?.curr)))]);
      if (leadsRows.length) addMktTable("LEADS","BE A PARTNER – por mercado", leadsRows);

      // Leads summary slide
      const sl = prs.addSlide(); bgCream(sl);
      sl.addText("LEADS", {x:0.5,y:0.25,w:8,h:0.45,fontSize:28,bold:true,color:C.black,fontFace:FF});
      sl.addText(`${mLabel} ${year}`, {x:0.5,y:0.72,w:8,h:0.28,fontSize:13,color:C.grayDk,fontFace:FF});
      const lSummary = [
        ["TOTAL DE LEADS", leadsPrevTotal, leadsTotal],
        ["NOVAS PARCERIAS", partnersPrevT, partnersTotal],
      ];
      lSummary.forEach((row,i)=>{
        const y = 1.2+i*1.4;
        sl.addShape(prs.ShapeType.roundRect,{x:0.5,y,w:12.3,h:1.2,
          fill:{color:i===0?C.tealLt:C.white},line:{color:C.teal,pt:0.5},rectRadius:0.1});
        sl.addText(row[0],{x:0.7,y:y+0.08,w:4,h:0.25,fontSize:9,bold:true,color:C.grayDk,fontFace:FF,charSpacing:1});
        sl.addText(fmtN(row[2]),{x:0.7,y:y+0.42,w:3,h:0.55,fontSize:30,bold:true,color:C.teal,fontFace:FF});
        if (row[1]>0) {
          const e=(row[2]-row[1])/row[1]*100;
          sl.addText(`${e>=0?"+":""}${e.toFixed(2)}% vs ${mLabel.toLowerCase()} ${year-1}`,
            {x:4,y:y+0.52,w:4,h:0.3,fontSize:12,bold:true,color:e>=0?C.teal:C.red,fontFace:FF});
        }
      });

      // ─────────────────────────────────────────────
      // RESULTADOS POR MERCADO
      // ─────────────────────────────────────────────
      addSep(6, "RESULTADOS POR MERCADO");

      MC_MARKETS.forEach(m=>{
        const rd=rev.byMarket[m.code]||{}, ad=afil.byMarket[m.code]||{};
        const od=orders.byMarket[m.code]||{};
        const rCurr=N2(rd.curr),rPrev=N2(rd.prev),aCurr=N2(ad.curr),aPrev=N2(ad.prev);
        if(!rCurr&&!aCurr) return;
        const tCurr=rCurr+aCurr, tPrev=rPrev+aPrev;
        const mDiff=N2(closingCurr?.markets?.[m.code]?.margin_curr)-N2(closingCurr?.markets?.[m.code]?.margin_prev||closingPrev?.markets?.[m.code]?.margin_curr);

        const sm = prs.addSlide(); bgCream(sm);
        sm.addText(m.name.toUpperCase(),{x:0.5,y:0.25,w:12,h:0.45,fontSize:28,bold:true,color:C.black,fontFace:FF});
        sm.addText("DETALHE POR MÉTRICA",{x:0.5,y:0.72,w:12,h:0.28,fontSize:13,color:C.grayDk,fontFace:FF});

        // KPI indicators (4 cards)
        const rEvo=rPrev?((rCurr-rPrev)/rPrev*100):0;
        const oEvo=N2(od.orders_prev)?((N2(od.orders_curr)-N2(od.orders_prev))/N2(od.orders_prev)*100):0;
        const kpis=[
          {label:"Revenda",val:fmtE2(rCurr),sub:fmtP2(rEvo,true),pos:rEvo>=0},
          {label:"Margem",val:fmtP2(N2(closingCurr?.markets?.[m.code]?.margin_curr)),sub:fmtP2(mDiff,true)+"pp",pos:mDiff>=0},
          {label:"Encomendas",val:fmtN(N2(od.orders_curr)),sub:fmtP2(oEvo,true),pos:oEvo>=0},
          {label:`Total ${year}`,val:fmtE2(tCurr),sub:evo2(tPrev,tCurr),pos:tCurr>=tPrev},
        ];
        kpis.forEach((k,i)=>{
          const x=0.5+i*3.2;
          sm.addShape(prs.ShapeType.roundRect,{x,y:1.18,w:3.0,h:1.1,
            fill:{color:C.white},line:{color:C.gray,pt:0.8},rectRadius:0.1});
          sm.addText("INDICADORES PRINCIPAIS",{x:0.5,y:1.1,w:12,h:0.2,fontSize:7,bold:true,color:C.grayDk,fontFace:FF,charSpacing:2});
          sm.addText(k.label,{x:x+0.12,y:1.22,w:2.8,h:0.22,fontSize:9,color:C.grayDk,fontFace:FF});
          sm.addText(k.val,{x:x+0.12,y:1.46,w:2.8,h:0.45,fontSize:18,bold:true,color:C.black,fontFace:FF});
          sm.addText(k.sub,{x:x+0.12,y:1.92,w:2.8,h:0.22,fontSize:9,bold:true,color:k.pos?C.teal:C.red,fontFace:FF});
        });

        // Detail table
        const dtRows=[
          [{text:"",options:{fill:{color:C.teal}}},
           {text:mLabel+" "+(year-1),options:{bold:true,color:C.white,fill:{color:C.teal},align:"right",fontSize:9}},
           {text:mLabel+" "+year,options:{bold:true,color:C.white,fill:{color:C.teal},align:"right",fontSize:9}},
           {text:"EVOLUÇÃO",options:{bold:true,color:C.white,fill:{color:C.teal},align:"right",fontSize:9}}],
          ...([
            ["Revenda", fmtE2(rPrev), fmtE2(rCurr), evo2(rPrev,rCurr)],
            ["Afiliação", fmtE2(aPrev), fmtE2(aCurr), evo2(aPrev,aCurr)],
            ["Total (rev + afil)", fmtE2(tPrev), fmtE2(tCurr), evo2(tPrev,tCurr)],
            ["Margem", fmtP2(N2(closingPrev?.markets?.[m.code]?.margin_curr)), fmtP2(N2(closingCurr?.markets?.[m.code]?.margin_curr)), fmtP2(mDiff,true)+"pp"],
            ["Encomendas", fmtN(N2(od.orders_prev)), fmtN(N2(od.orders_curr)), evo2(N2(od.orders_prev),N2(od.orders_curr))],
            ["1ªs enc.", fmtN(N2(od.first_prev)), fmtN(N2(od.first_curr)), evo2(N2(od.first_prev),N2(od.first_curr))],
            ["Faturação 1ªs enc.", fmtE2(N2(od.first_rev_prev)), fmtE2(N2(od.first_rev_curr)), evo2(N2(od.first_rev_prev),N2(od.first_rev_curr))],
          ].map((r,i)=>{
            const bg=i%2===0?C.white:C.grayLt;
            const pos=r[3].startsWith("+");
            return [
              {text:r[0],options:{fontSize:9,fill:{color:bg},bold:i===2}},
              {text:r[1],options:{fontSize:9,align:"right",fill:{color:bg}}},
              {text:r[2],options:{fontSize:9,bold:true,align:"right",fill:{color:bg}}},
              {text:r[3],options:{fontSize:9,align:"right",fill:{color:bg},color:pos?C.teal:C.red,bold:true}},
            ];
          }))
        ];
        sm.addTable(dtRows,{x:0.5,y:2.45,w:12.3,colW:[4.2,2.5,2.5,2.6],
          border:{type:"solid",color:C.gray,pt:0.5},rowH:0.45});
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
  { id: "CZ-SK-GR-CY-PL", label: "CZ-SK-GR-CY-PL" },
  { id: "USA", label: "USA" },
  { id: "OT", label: "Outros" },
];

function AfiliacaoDashboard({ totalDays, closedDay, month, monthNum, year, isCurrentMonth, isAdmin }) {
  const [afilScope, setAfilScope] = useState("total");
  const [afilData, setAfilData] = useState({
    totalGoal: 0,
    teamGoals: { PT: 0, IT: 0, ES: 0, FR: 0, "CH-BNL-DEAT": 0, "CZ-SK-GR-CY-PL": 0, USA: 0, OT: 0 },
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
          teamGoals: row.team_goals || { PT: 0, IT: 0, ES: 0, FR: 0, "CH-BNL-DEAT": 0, "CZ-SK-GR-CY-PL": 0, USA: 0, OT: 0 },
          entries: row.entries || {},
        });
      } else {
        setAfilData({ totalGoal: 0, teamGoals: { PT: 0, IT: 0, ES: 0, FR: 0, "CH-BNL-DEAT": 0, "CZ-SK-GR-CY-PL": 0, USA: 0, OT: 0 }, entries: {} });
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
    () => ["PT","IT","ES","FR","CH-BNL-DEAT","CZ-SK-GR-CY-PL","USA","OT"].map((t) => ({
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


// ── RegistoHub — separador "Registo" com sub-tabs ──
function MargemRegisto({ monthNum, year, isAdmin }) {
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dataRef = React.useRef(null);
  const saveTimer = React.useRef(null);

  useEffect(() => {
    (async () => {
      // Load current month closing
      const curr = await loadClosing(year, monthNum);

      // Auto-fill prev year values from prev year's closing (margin_curr of year-1)
      // Only fill if not already manually set
      const prevYearClosing = await loadClosing(year - 1, monthNum);
      if (prevYearClosing) {
        // Global margin
        if (!curr.revenda_margin_prev && prevYearClosing.revenda_margin) {
          curr.revenda_margin_prev = prevYearClosing.revenda_margin;
        }
        // Per market
        MC_MARKETS.forEach(m => {
          if (!curr.markets[m.code]) curr.markets[m.code] = {};
          if (!curr.markets[m.code].margin_prev && prevYearClosing.markets?.[m.code]?.margin_curr) {
            curr.markets[m.code].margin_prev = prevYearClosing.markets[m.code].margin_curr;
          }
        });
      }

      setData(curr);
      dataRef.current = curr;
      setSaved(false);
    })();
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [year, monthNum]);

  const triggerAutoSave = (latest) => {
    dataRef.current = latest;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaved(false);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await saveClosing(year, monthNum, dataRef.current);
      setSaving(false); setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }, 800);
  };

  const upField = (field, val) =>
    setData(p => {
      const next = { ...p, [field]: val };
      triggerAutoSave(next);
      return next;
    });

  const upMkt = (code, field, val) =>
    setData(p => {
      const next = { ...p, markets: { ...p.markets, [code]: { ...p.markets[code], [field]: val } } };
      triggerAutoSave(next);
      return next;
    });

  if (!data) return <div className="text-center py-8 text-slate-400 text-sm">A carregar…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-slate-500">Margem mensal · {MC_MONTHS_PT[monthNum+1]} {year}</p>
        <div className="text-xs">
          {saving && <span className="text-slate-400 animate-pulse">A guardar…</span>}
          {saved && !saving && <span className="text-green-600 font-medium">✓ Guardado</span>}
        </div>
      </div>

      <MCCard title="Margem global — Revenda">
        <div className="grid grid-cols-2 gap-3">
          <MCField label={`Margem ${year-1} %`} value={data.revenda_margin_prev||""} onChange={v => upField("revenda_margin_prev", v)} />
          <MCField label={`Margem ${year} %`} value={data.revenda_margin||""} onChange={v => upField("revenda_margin", v)} />
        </div>
      </MCCard>

      {MC_MARKETS.map(m => (
        <MCCard key={m.code} title={m.name} accent="text-green-700">
          <div className="grid grid-cols-2 gap-3">
            <MCField label={`${year-1} %`} value={data.markets[m.code]?.margin_prev||""} onChange={v => upMkt(m.code,"margin_prev",v)} />
            <MCField label={`${year} %`} value={data.markets[m.code]?.margin_curr||""} onChange={v => upMkt(m.code,"margin_curr",v)} />
          </div>
        </MCCard>
      ))}
    </div>
  );
}

function RegistoHub({ monthNum, year, totalDays, closedDay, isCurrentMonth, isAdmin }) {
  const [subTab, setSubTab] = useState("revenda");

  const subTabs = [
    { id: "revenda",    label: "Revenda",          color: "bg-blue-500" },
    { id: "afiliacao",  label: "Afiliação",         color: "bg-orange-500" },
    { id: "encomendas", label: "Encomendas",        color: "bg-blue-600" },
    { id: "leads",      label: "Leads / Parcerias", color: "bg-purple-500" },
    { id: "margem",     label: "Margem",            color: "bg-green-600" },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {subTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              subTab === t.id
                ? `${t.color} text-white`
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {subTab === "revenda" && (
        <EntryRevenda
          monthNum={monthNum}
          year={year}
          totalDays={totalDays}
          closedDay={closedDay}
          isCurrentMonth={isCurrentMonth}
        />
      )}
      {subTab === "afiliacao" && (
        <AfiliacaoFecho monthNum={monthNum} year={year} isAdmin={isAdmin} />
      )}
      {subTab === "encomendas" && (
        <Encomendas monthNum={monthNum} year={year} isAdmin={isAdmin} />
      )}
      {subTab === "leads" && (
        <LeadsParcerias monthNum={monthNum} year={year} isAdmin={isAdmin} />
      )}
      {subTab === "margem" && (
        <MargemRegisto monthNum={monthNum} year={year} isAdmin={isAdmin} />
      )}
    </div>
  );
}


// ── EntryHub — Registo Diário com sub-tabs ──────────────────────────────────
function EntryHub({ data, setEntry, totalDays, closedDay, isCurrentMonth, monthNum, year, isAdmin }) {
  const [subTab, setSubTab] = useState("registo");
  const subTabs = [
    { id: "registo",    label: "Registo Diário", color: "bg-blue-600" },
    { id: "afiliacao",  label: "Afiliação",      color: "bg-orange-500" },
    { id: "encomendas", label: "Encomendas",     color: "bg-blue-700" },
    { id: "parceiros",  label: "Parceiros",      color: "bg-purple-500" },
    { id: "margem",     label: "Margem",         color: "bg-green-600" },
  ];
  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto pb-1">
        {subTabs.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              subTab === t.id ? `${t.color} text-white` : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {subTab === "registo" && (
        <Entry data={data} setEntry={setEntry} totalDays={totalDays}
          closedDay={closedDay} isCurrentMonth={isCurrentMonth} />
      )}
      {subTab === "afiliacao" && <AfiliacaoFecho monthNum={monthNum} year={year} isAdmin={isAdmin} />}
      {subTab === "encomendas" && <Encomendas monthNum={monthNum} year={year} isAdmin={isAdmin} />}
      {subTab === "parceiros" && <LeadsParcerias monthNum={monthNum} year={year} isAdmin={isAdmin} />}
      {subTab === "margem" && <MargemRegisto monthNum={monthNum} year={year} isAdmin={isAdmin} />}
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
