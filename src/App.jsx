import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { LineChart, Line, BarChart, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
const MARKETS = [{ id: "FR", label: "França" }, { id: "CH-BNL-DEAT", label: "CH-BNL-DEAT" }];
const MARKET_COLORS = { FR: "#9333ea", "CH-BNL-DEAT": "#d97706" };
const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const PASSWORDS = {
  admin: import.meta.env.VITE_PASSWORD_ADMIN || "partnersfranca",
  fabien: import.meta.env.VITE_PASSWORD_FABIEN || "partnersfabien",
  monica: import.meta.env.VITE_PASSWORD_MONICA || "partnersmonica",
};
const ROLES = {
  admin: { name:"Antony", gestor:"Antony", isAdmin:true },
  fabien: { name:"Fabien", gestor:"Fabien", isAdmin:false },
  monica: { name:"Mónica", gestor:"Mónica", isAdmin:false },
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


// ── TopParceirosTab ────────────────────────────────────────────────────────────
const TOP_CLIENTS = [{"id":"P2867825","mercado":"FR","programa":"Corporate","n_encomendas":12,"valor_total":18373,"valor_medio":1837,"frequencia":53,"dias_desde_ultima":31,"ultima_compra":"25/04/2026","proxima_compra":"17/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Multivitamínico","trend":"down","trend_pct":14,"churn":false,"comprou_3m":"Sim"},{"id":"P5614226","mercado":"FR","programa":"Professionals","n_encomendas":13,"valor_total":22404,"valor_medio":1867,"frequencia":44,"dias_desde_ultima":7,"ultima_compra":"19/05/2026","proxima_compra":"02/07/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Magnésio","trend":"down","trend_pct":23,"churn":false,"comprou_3m":"Sim"},{"id":"P3341057","mercado":"FR","programa":"Corporate","n_encomendas":15,"valor_total":36623,"valor_medio":2616,"frequencia":30,"dias_desde_ultima":84,"ultima_compra":"03/03/2026","proxima_compra":"02/04/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Queimador de Gordura","trend":"down","trend_pct":40,"churn":false,"comprou_3m":"Sim"},{"id":"P2458591","mercado":"BNL","programa":"Elite","n_encomendas":14,"valor_total":26768,"valor_medio":1912,"frequencia":25,"dias_desde_ultima":129,"ultima_compra":"17/01/2026","proxima_compra":"11/02/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Creatina Monohidratada","trend":"flat","trend_pct":0,"churn":true,"comprou_3m":"Não"},{"id":"P1499914","mercado":"FR","programa":"Professionals","n_encomendas":13,"valor_total":22859,"valor_medio":1758,"frequencia":39,"dias_desde_ultima":27,"ultima_compra":"29/04/2026","proxima_compra":"07/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Queimador de Gordura","trend":"down","trend_pct":56,"churn":false,"comprou_3m":"Sim"},{"id":"P4903402","mercado":"FR","programa":"Performance","n_encomendas":4,"valor_total":10674,"valor_medio":2669,"frequencia":23,"dias_desde_ultima":290,"ultima_compra":"09/08/2025","proxima_compra":"01/09/2025","ss_pct":0,"ss_class":"Regular","top_produto":"Omega 3","trend":"down","trend_pct":37,"churn":true,"comprou_3m":"Não"},{"id":"P4335942","mercado":"BNL","programa":"Professionals","n_encomendas":15,"valor_total":35077,"valor_medio":2505,"frequencia":38,"dias_desde_ultima":12,"ultima_compra":"14/05/2026","proxima_compra":"21/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Glutamina","trend":"flat","trend_pct":0,"churn":false,"comprou_3m":"Sim"},{"id":"P8536477","mercado":"CH","programa":"Horeca","n_encomendas":7,"valor_total":9600,"valor_medio":1371,"frequencia":84,"dias_desde_ultima":7,"ultima_compra":"19/05/2026","proxima_compra":"11/08/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Proteína Isolada","trend":"up","trend_pct":47,"churn":false,"comprou_3m":"Sim"},{"id":"P1109031","mercado":"FR","programa":"Corporate","n_encomendas":20,"valor_total":35275,"valor_medio":1764,"frequencia":24,"dias_desde_ultima":1,"ultima_compra":"25/05/2026","proxima_compra":"18/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Colagénio","trend":"down","trend_pct":10,"churn":false,"comprou_3m":"Sim"},{"id":"P8090293","mercado":"BNL","programa":"Pro Gym","n_encomendas":13,"valor_total":23187,"valor_medio":1932,"frequencia":44,"dias_desde_ultima":3,"ultima_compra":"23/05/2026","proxima_compra":"06/07/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Ganho de Massa","trend":"flat","trend_pct":0,"churn":false,"comprou_3m":"Sim"},{"id":"P3608513","mercado":"FR","programa":"Horeca","n_encomendas":3,"valor_total":7135,"valor_medio":2378,"frequencia":92,"dias_desde_ultima":298,"ultima_compra":"01/08/2025","proxima_compra":"01/11/2025","ss_pct":0,"ss_class":"Regular","top_produto":"BCAA Premium","trend":"down","trend_pct":21,"churn":true,"comprou_3m":"Não"},{"id":"P6647119","mercado":"FR","programa":"Elite","n_encomendas":12,"valor_total":23409,"valor_medio":1951,"frequencia":35,"dias_desde_ultima":104,"ultima_compra":"11/02/2026","proxima_compra":"18/03/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Ganho de Massa","trend":"up","trend_pct":16,"churn":true,"comprou_3m":"Não"},{"id":"P7374122","mercado":"FR","programa":"Pro Gym","n_encomendas":14,"valor_total":29718,"valor_medio":2123,"frequencia":35,"dias_desde_ultima":19,"ultima_compra":"07/05/2026","proxima_compra":"11/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Proteína Vegana","trend":"down","trend_pct":43,"churn":false,"comprou_3m":"Sim"},{"id":"P6770619","mercado":"CH","programa":"Horeca","n_encomendas":13,"valor_total":27266,"valor_medio":2097,"frequencia":38,"dias_desde_ultima":5,"ultima_compra":"21/05/2026","proxima_compra":"28/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Barra Proteica","trend":"down","trend_pct":13,"churn":false,"comprou_3m":"Sim"},{"id":"P1728977","mercado":"DEAT","programa":"Performance","n_encomendas":10,"valor_total":21944,"valor_medio":2438,"frequencia":46,"dias_desde_ultima":114,"ultima_compra":"01/02/2026","proxima_compra":"19/03/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Barra Proteica","trend":"down","trend_pct":47,"churn":true,"comprou_3m":"Não"},{"id":"P3094235","mercado":"BNL","programa":"Elite","n_encomendas":8,"valor_total":14717,"valor_medio":1840,"frequencia":66,"dias_desde_ultima":32,"ultima_compra":"24/04/2026","proxima_compra":"29/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Caseína Micelar","trend":"up","trend_pct":117,"churn":false,"comprou_3m":"Sim"},{"id":"P5918715","mercado":"BNL","programa":"Performance","n_encomendas":14,"valor_total":22327,"valor_medio":1595,"frequencia":34,"dias_desde_ultima":41,"ultima_compra":"15/04/2026","proxima_compra":"19/05/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Colagénio","trend":"flat","trend_pct":0,"churn":false,"comprou_3m":"Sim"},{"id":"P4226067","mercado":"FR","programa":"Elite","n_encomendas":13,"valor_total":17540,"valor_medio":1349,"frequencia":30,"dias_desde_ultima":76,"ultima_compra":"11/03/2026","proxima_compra":"10/04/2026","ss_pct":0,"ss_class":"Regular","top_produto":"ZMA","trend":"down","trend_pct":23,"churn":false,"comprou_3m":"Sim"},{"id":"P4823498","mercado":"CH","programa":"Elite","n_encomendas":18,"valor_total":34175,"valor_medio":2136,"frequencia":33,"dias_desde_ultima":10,"ultima_compra":"16/05/2026","proxima_compra":"18/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Barra Proteica","trend":"down","trend_pct":34,"churn":false,"comprou_3m":"Sim"},{"id":"P4905582","mercado":"FR","programa":"Pro Box","n_encomendas":17,"valor_total":43268,"valor_medio":2704,"frequencia":30,"dias_desde_ultima":28,"ultima_compra":"28/04/2026","proxima_compra":"28/05/2026","ss_pct":0,"ss_class":"Regular","top_produto":"ZMA","trend":"flat","trend_pct":0,"churn":false,"comprou_3m":"Sim"},{"id":"P5663623","mercado":"DEAT","programa":"Corporate","n_encomendas":14,"valor_total":24813,"valor_medio":1909,"frequencia":34,"dias_desde_ultima":70,"ultima_compra":"17/03/2026","proxima_compra":"20/04/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Vitamina D3","trend":"down","trend_pct":14,"churn":false,"comprou_3m":"Sim"},{"id":"P7120868","mercado":"FR","programa":"Pro Gym","n_encomendas":15,"valor_total":16564,"valor_medio":1183,"frequencia":35,"dias_desde_ultima":17,"ultima_compra":"09/05/2026","proxima_compra":"13/06/2026","ss_pct":2,"ss_class":"Regular","top_produto":"Ganho de Massa","trend":"flat","trend_pct":0,"churn":false,"comprou_3m":"Sim"},{"id":"P6960453","mercado":"FR","programa":"Corporate","n_encomendas":15,"valor_total":23070,"valor_medio":1538,"frequencia":34,"dias_desde_ultima":19,"ultima_compra":"07/05/2026","proxima_compra":"10/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Omega 3","trend":"up","trend_pct":46,"churn":false,"comprou_3m":"Sim"},{"id":"P5479144","mercado":"FR","programa":"Performance","n_encomendas":7,"valor_total":12245,"valor_medio":1749,"frequencia":83,"dias_desde_ultima":7,"ultima_compra":"19/05/2026","proxima_compra":"10/08/2026","ss_pct":0,"ss_class":"Regular","top_produto":"ZMA","trend":"down","trend_pct":22,"churn":false,"comprou_3m":"Sim"},{"id":"P3871230","mercado":"FR","programa":"Professionals","n_encomendas":10,"valor_total":22444,"valor_medio":2244,"frequencia":50,"dias_desde_ultima":12,"ultima_compra":"14/05/2026","proxima_compra":"03/07/2026","ss_pct":2,"ss_class":"Regular","top_produto":"Omega 3","trend":"up","trend_pct":22,"churn":false,"comprou_3m":"Sim"},{"id":"P8755439","mercado":"BNL","programa":"Pro Gym","n_encomendas":14,"valor_total":28219,"valor_medio":2016,"frequencia":38,"dias_desde_ultima":14,"ultima_compra":"12/05/2026","proxima_compra":"19/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Pre-Treino Intenso","trend":"up","trend_pct":20,"churn":false,"comprou_3m":"Sim"},{"id":"P4684531","mercado":"BNL","programa":"Horeca","n_encomendas":14,"valor_total":26860,"valor_medio":1919,"frequencia":33,"dias_desde_ultima":61,"ultima_compra":"26/03/2026","proxima_compra":"28/04/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Vitamina D3","trend":"up","trend_pct":21,"churn":false,"comprou_3m":"Sim"},{"id":"P1938483","mercado":"FR","programa":"Horeca","n_encomendas":9,"valor_total":15659,"valor_medio":1740,"frequencia":36,"dias_desde_ultima":109,"ultima_compra":"06/02/2026","proxima_compra":"14/03/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Queimador de Gordura","trend":"down","trend_pct":19,"churn":true,"comprou_3m":"Não"},{"id":"P1538552","mercado":"BNL","programa":"Pro Box","n_encomendas":3,"valor_total":4656,"valor_medio":1552,"frequencia":124,"dias_desde_ultima":135,"ultima_compra":"11/01/2026","proxima_compra":"15/05/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Multivitamínico","trend":"flat","trend_pct":0,"churn":true,"comprou_3m":"Não"},{"id":"P5491946","mercado":"FR","programa":"Professionals","n_encomendas":10,"valor_total":11581,"valor_medio":1158,"frequencia":55,"dias_desde_ultima":6,"ultima_compra":"20/05/2026","proxima_compra":"14/07/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Vitamina D3","trend":"down","trend_pct":51,"churn":false,"comprou_3m":"Sim"},{"id":"P6279418","mercado":"FR","programa":"Corporate","n_encomendas":7,"valor_total":13757,"valor_medio":1965,"frequencia":62,"dias_desde_ultima":53,"ultima_compra":"03/04/2026","proxima_compra":"04/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"ZMA","trend":"up","trend_pct":143,"churn":false,"comprou_3m":"Sim"},{"id":"P9375710","mercado":"BNL","programa":"Corporate","n_encomendas":5,"valor_total":11502,"valor_medio":2300,"frequencia":46,"dias_desde_ultima":100,"ultima_compra":"15/02/2026","proxima_compra":"02/04/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Multivitamínico","trend":"up","trend_pct":516,"churn":true,"comprou_3m":"Não"},{"id":"P8698256","mercado":"FR","programa":"Pro Gym","n_encomendas":16,"valor_total":26569,"valor_medio":1661,"frequencia":28,"dias_desde_ultima":34,"ultima_compra":"22/04/2026","proxima_compra":"20/05/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Colagénio","trend":"down","trend_pct":22,"churn":false,"comprou_3m":"Sim"},{"id":"P3342608","mercado":"FR","programa":"Corporate","n_encomendas":7,"valor_total":14520,"valor_medio":2074,"frequencia":72,"dias_desde_ultima":77,"ultima_compra":"10/03/2026","proxima_compra":"21/05/2026","ss_pct":26,"ss_class":"Misto","top_produto":"Proteína Isolada","trend":"down","trend_pct":41,"churn":false,"comprou_3m":"Sim"},{"id":"P5408072","mercado":"BNL","programa":"Performance","n_encomendas":9,"valor_total":12549,"valor_medio":1394,"frequencia":57,"dias_desde_ultima":13,"ultima_compra":"13/05/2026","proxima_compra":"09/07/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Omega 3","trend":"down","trend_pct":21,"churn":false,"comprou_3m":"Sim"},{"id":"P7700828","mercado":"BNL","programa":"Professionals","n_encomendas":9,"valor_total":13740,"valor_medio":1527,"frequencia":51,"dias_desde_ultima":74,"ultima_compra":"13/03/2026","proxima_compra":"03/05/2026","ss_pct":0,"ss_class":"Regular","top_produto":"BCAA Premium","trend":"down","trend_pct":48,"churn":false,"comprou_3m":"Sim"},{"id":"P3320821","mercado":"DEAT","programa":"Elite","n_encomendas":8,"valor_total":12406,"valor_medio":1551,"frequencia":59,"dias_desde_ultima":25,"ultima_compra":"01/05/2026","proxima_compra":"29/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Proteína Vegana","trend":"down","trend_pct":51,"churn":false,"comprou_3m":"Sim"},{"id":"P1790481","mercado":"FR","programa":"Professionals","n_encomendas":7,"valor_total":13368,"valor_medio":1910,"frequencia":73,"dias_desde_ultima":54,"ultima_compra":"02/04/2026","proxima_compra":"14/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Queimador de Gordura","trend":"up","trend_pct":42,"churn":false,"comprou_3m":"Sim"},{"id":"P3684052","mercado":"BNL","programa":"Performance","n_encomendas":18,"valor_total":28113,"valor_medio":1562,"frequencia":24,"dias_desde_ultima":46,"ultima_compra":"10/04/2026","proxima_compra":"04/05/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Queimador de Gordura","trend":"flat","trend_pct":0,"churn":false,"comprou_3m":"Sim"},{"id":"P2065818","mercado":"BNL","programa":"Pro Box","n_encomendas":13,"valor_total":30939,"valor_medio":2380,"frequencia":37,"dias_desde_ultima":26,"ultima_compra":"30/04/2026","proxima_compra":"06/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"ZMA","trend":"down","trend_pct":40,"churn":false,"comprou_3m":"Sim"},{"id":"P8852574","mercado":"CH","programa":"Performance","n_encomendas":14,"valor_total":24482,"valor_medio":1749,"frequencia":37,"dias_desde_ultima":17,"ultima_compra":"09/05/2026","proxima_compra":"15/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Proteína Whey Concentrada","trend":"flat","trend_pct":0,"churn":false,"comprou_3m":"Sim"},{"id":"P1192619","mercado":"FR","programa":"Corporate","n_encomendas":18,"valor_total":33153,"valor_medio":1842,"frequencia":26,"dias_desde_ultima":59,"ultima_compra":"28/03/2026","proxima_compra":"23/04/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Vitamina D3","trend":"down","trend_pct":50,"churn":false,"comprou_3m":"Sim"},{"id":"P5476583","mercado":"BNL","programa":"Elite","n_encomendas":9,"valor_total":19315,"valor_medio":2146,"frequencia":39,"dias_desde_ultima":118,"ultima_compra":"28/01/2026","proxima_compra":"08/03/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Glutamina","trend":"up","trend_pct":41,"churn":true,"comprou_3m":"Não"},{"id":"P5924115","mercado":"BNL","programa":"Professionals","n_encomendas":11,"valor_total":17836,"valor_medio":1621,"frequencia":50,"dias_desde_ultima":7,"ultima_compra":"19/05/2026","proxima_compra":"08/07/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Proteína Vegana","trend":"up","trend_pct":74,"churn":false,"comprou_3m":"Sim"},{"id":"P8612220","mercado":"FR","programa":"Corporate","n_encomendas":5,"valor_total":8925,"valor_medio":1785,"frequencia":48,"dias_desde_ultima":114,"ultima_compra":"01/02/2026","proxima_compra":"21/03/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Ganho de Massa","trend":"up","trend_pct":38,"churn":true,"comprou_3m":"Não"},{"id":"P5418934","mercado":"FR","programa":"Performance","n_encomendas":7,"valor_total":9770,"valor_medio":1396,"frequencia":73,"dias_desde_ultima":66,"ultima_compra":"21/03/2026","proxima_compra":"02/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Magnésio","trend":"down","trend_pct":63,"churn":false,"comprou_3m":"Sim"},{"id":"P2785277","mercado":"CH","programa":"Horeca","n_encomendas":3,"valor_total":6173,"valor_medio":2058,"frequencia":100,"dias_desde_ultima":25,"ultima_compra":"01/05/2026","proxima_compra":"09/08/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Queimador de Gordura","trend":"flat","trend_pct":0,"churn":false,"comprou_3m":"Sim"},{"id":"P9517169","mercado":"FR","programa":"Professionals","n_encomendas":19,"valor_total":34688,"valor_medio":1927,"frequencia":28,"dias_desde_ultima":1,"ultima_compra":"25/05/2026","proxima_compra":"22/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Queimador de Gordura","trend":"flat","trend_pct":0,"churn":false,"comprou_3m":"Sim"},{"id":"P7273233","mercado":"FR","programa":"Performance","n_encomendas":4,"valor_total":8366,"valor_medio":2092,"frequencia":45,"dias_desde_ultima":81,"ultima_compra":"06/03/2026","proxima_compra":"20/04/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Creatina Monohidratada","trend":"down","trend_pct":17,"churn":false,"comprou_3m":"Sim"},{"id":"P9897858","mercado":"FR","programa":"Performance","n_encomendas":19,"valor_total":37429,"valor_medio":1970,"frequencia":26,"dias_desde_ultima":1,"ultima_compra":"25/05/2026","proxima_compra":"20/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Glutamina","trend":"flat","trend_pct":0,"churn":false,"comprou_3m":"Sim"},{"id":"P6438436","mercado":"DEAT","programa":"Elite","n_encomendas":8,"valor_total":17843,"valor_medio":2230,"frequencia":22,"dias_desde_ultima":54,"ultima_compra":"02/04/2026","proxima_compra":"24/04/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Creatina Monohidratada","trend":"flat","trend_pct":0,"churn":false,"comprou_3m":"Sim"},{"id":"P2876828","mercado":"BNL","programa":"Horeca","n_encomendas":4,"valor_total":9602,"valor_medio":2401,"frequencia":124,"dias_desde_ultima":92,"ultima_compra":"23/02/2026","proxima_compra":"27/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Proteína Whey Concentrada","trend":"up","trend_pct":102,"churn":true,"comprou_3m":"Não"},{"id":"P6159230","mercado":"FR","programa":"Elite","n_encomendas":3,"valor_total":7685,"valor_medio":2562,"frequencia":67,"dias_desde_ultima":90,"ultima_compra":"25/02/2026","proxima_compra":"03/05/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Queimador de Gordura","trend":"down","trend_pct":33,"churn":false,"comprou_3m":"Sim"},{"id":"P5041154","mercado":"FR","programa":"Elite","n_encomendas":18,"valor_total":36040,"valor_medio":2002,"frequencia":27,"dias_desde_ultima":4,"ultima_compra":"22/05/2026","proxima_compra":"18/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"BCAA Premium","trend":"down","trend_pct":13,"churn":false,"comprou_3m":"Sim"},{"id":"P9153566","mercado":"FR","programa":"Horeca","n_encomendas":3,"valor_total":3390,"valor_medio":1130,"frequencia":210,"dias_desde_ultima":85,"ultima_compra":"02/03/2026","proxima_compra":"28/09/2026","ss_pct":0,"ss_class":"Regular","top_produto":"BCAA Premium","trend":"up","trend_pct":192,"churn":false,"comprou_3m":"Sim"},{"id":"P9937326","mercado":"FR","programa":"Professionals","n_encomendas":11,"valor_total":15967,"valor_medio":1597,"frequencia":42,"dias_desde_ultima":48,"ultima_compra":"08/04/2026","proxima_compra":"20/05/2026","ss_pct":0,"ss_class":"Regular","top_produto":"ZMA","trend":"flat","trend_pct":0,"churn":false,"comprou_3m":"Sim"},{"id":"P8973915","mercado":"FR","programa":"Pro Gym","n_encomendas":4,"valor_total":4860,"valor_medio":1215,"frequencia":118,"dias_desde_ultima":97,"ultima_compra":"18/02/2026","proxima_compra":"16/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"BCAA Premium","trend":"down","trend_pct":69,"churn":true,"comprou_3m":"Não"},{"id":"P9852897","mercado":"BNL","programa":"Professionals","n_encomendas":7,"valor_total":12706,"valor_medio":1815,"frequencia":50,"dias_desde_ultima":123,"ultima_compra":"23/01/2026","proxima_compra":"14/03/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Creatina Monohidratada","trend":"down","trend_pct":59,"churn":true,"comprou_3m":"Não"},{"id":"P4374754","mercado":"CH","programa":"Pro Box","n_encomendas":10,"valor_total":18339,"valor_medio":1834,"frequencia":40,"dias_desde_ultima":51,"ultima_compra":"05/04/2026","proxima_compra":"15/05/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Colagénio","trend":"flat","trend_pct":0,"churn":false,"comprou_3m":"Sim"},{"id":"P7264956","mercado":"DEAT","programa":"Performance","n_encomendas":12,"valor_total":20420,"valor_medio":1702,"frequencia":39,"dias_desde_ultima":71,"ultima_compra":"16/03/2026","proxima_compra":"24/04/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Proteína Vegana","trend":"up","trend_pct":48,"churn":false,"comprou_3m":"Sim"},{"id":"P8574680","mercado":"FR","programa":"Professionals","n_encomendas":19,"valor_total":41662,"valor_medio":2315,"frequencia":16,"dias_desde_ultima":79,"ultima_compra":"08/03/2026","proxima_compra":"24/03/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Multivitamínico","trend":"down","trend_pct":14,"churn":false,"comprou_3m":"Sim"},{"id":"P4769795","mercado":"FR","programa":"Pro Gym","n_encomendas":14,"valor_total":15178,"valor_medio":1084,"frequencia":32,"dias_desde_ultima":89,"ultima_compra":"26/02/2026","proxima_compra":"30/03/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Caseína Micelar","trend":"down","trend_pct":34,"churn":false,"comprou_3m":"Sim"},{"id":"P1352896","mercado":"FR","programa":"Performance","n_encomendas":19,"valor_total":36791,"valor_medio":1936,"frequencia":27,"dias_desde_ultima":6,"ultima_compra":"20/05/2026","proxima_compra":"16/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Queimador de Gordura","trend":"up","trend_pct":10,"churn":false,"comprou_3m":"Sim"},{"id":"P4694634","mercado":"FR","programa":"Elite","n_encomendas":14,"valor_total":25902,"valor_medio":1850,"frequencia":35,"dias_desde_ultima":12,"ultima_compra":"14/05/2026","proxima_compra":"18/06/2026","ss_pct":1,"ss_class":"Regular","top_produto":"Vitamina D3","trend":"up","trend_pct":65,"churn":false,"comprou_3m":"Sim"},{"id":"P1987737","mercado":"FR","programa":"Elite","n_encomendas":4,"valor_total":5693,"valor_medio":1423,"frequencia":56,"dias_desde_ultima":152,"ultima_compra":"25/12/2025","proxima_compra":"19/02/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Creatina Monohidratada","trend":"up","trend_pct":539,"churn":true,"comprou_3m":"Não"},{"id":"P1527021","mercado":"BNL","programa":"Elite","n_encomendas":10,"valor_total":20079,"valor_medio":2008,"frequencia":43,"dias_desde_ultima":42,"ultima_compra":"14/04/2026","proxima_compra":"27/05/2026","ss_pct":11,"ss_class":"Regular","top_produto":"Proteína Whey Concentrada","trend":"flat","trend_pct":0,"churn":false,"comprou_3m":"Sim"},{"id":"P9626108","mercado":"FR","programa":"Pro Gym","n_encomendas":9,"valor_total":17014,"valor_medio":1890,"frequencia":52,"dias_desde_ultima":1,"ultima_compra":"25/05/2026","proxima_compra":"16/07/2026","ss_pct":0,"ss_class":"Regular","top_produto":"ZMA","trend":"up","trend_pct":67,"churn":false,"comprou_3m":"Sim"},{"id":"P9143903","mercado":"FR","programa":"Performance","n_encomendas":17,"valor_total":34551,"valor_medio":2159,"frequencia":33,"dias_desde_ultima":1,"ultima_compra":"25/05/2026","proxima_compra":"27/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Magnésio","trend":"down","trend_pct":15,"churn":false,"comprou_3m":"Sim"},{"id":"P3219824","mercado":"DEAT","programa":"Professionals","n_encomendas":3,"valor_total":4599,"valor_medio":1533,"frequencia":100,"dias_desde_ultima":308,"ultima_compra":"22/07/2025","proxima_compra":"30/10/2025","ss_pct":0,"ss_class":"Regular","top_produto":"Ganho de Massa","trend":"down","trend_pct":63,"churn":true,"comprou_3m":"Não"},{"id":"P8935169","mercado":"BNL","programa":"Professionals","n_encomendas":20,"valor_total":34128,"valor_medio":1706,"frequencia":25,"dias_desde_ultima":17,"ultima_compra":"09/05/2026","proxima_compra":"03/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"ZMA","trend":"down","trend_pct":26,"churn":false,"comprou_3m":"Sim"},{"id":"P2582524","mercado":"FR","programa":"Corporate","n_encomendas":19,"valor_total":37757,"valor_medio":1987,"frequencia":26,"dias_desde_ultima":23,"ultima_compra":"03/05/2026","proxima_compra":"29/05/2026","ss_pct":0,"ss_class":"Regular","top_produto":"BCAA Premium","trend":"up","trend_pct":40,"churn":false,"comprou_3m":"Sim"},{"id":"P8231838","mercado":"BNL","programa":"Pro Box","n_encomendas":7,"valor_total":10904,"valor_medio":1558,"frequencia":53,"dias_desde_ultima":120,"ultima_compra":"26/01/2026","proxima_compra":"20/03/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Proteína Whey Concentrada","trend":"down","trend_pct":39,"churn":true,"comprou_3m":"Não"},{"id":"P7897151","mercado":"DEAT","programa":"Horeca","n_encomendas":13,"valor_total":24450,"valor_medio":1881,"frequencia":38,"dias_desde_ultima":9,"ultima_compra":"17/05/2026","proxima_compra":"24/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Omega 3","trend":"flat","trend_pct":0,"churn":false,"comprou_3m":"Sim"},{"id":"P1908841","mercado":"FR","programa":"Elite","n_encomendas":18,"valor_total":30981,"valor_medio":1822,"frequencia":28,"dias_desde_ultima":54,"ultima_compra":"02/04/2026","proxima_compra":"30/04/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Proteína Whey Concentrada","trend":"down","trend_pct":33,"churn":false,"comprou_3m":"Sim"},{"id":"P7754864","mercado":"BNL","programa":"Horeca","n_encomendas":7,"valor_total":6935,"valor_medio":991,"frequencia":68,"dias_desde_ultima":71,"ultima_compra":"16/03/2026","proxima_compra":"23/05/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Omega 3","trend":"up","trend_pct":73,"churn":false,"comprou_3m":"Sim"},{"id":"P2833230","mercado":"FR","programa":"Professionals","n_encomendas":9,"valor_total":17858,"valor_medio":2232,"frequencia":52,"dias_desde_ultima":57,"ultima_compra":"30/03/2026","proxima_compra":"21/05/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Ganho de Massa","trend":"up","trend_pct":22,"churn":false,"comprou_3m":"Sim"},{"id":"P4191175","mercado":"DEAT","programa":"Professionals","n_encomendas":10,"valor_total":18752,"valor_medio":1875,"frequencia":47,"dias_desde_ultima":49,"ultima_compra":"07/04/2026","proxima_compra":"24/05/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Proteína Whey Concentrada","trend":"up","trend_pct":65,"churn":false,"comprou_3m":"Sim"},{"id":"P8077999","mercado":"FR","programa":"Pro Gym","n_encomendas":18,"valor_total":29152,"valor_medio":1715,"frequencia":30,"dias_desde_ultima":17,"ultima_compra":"09/05/2026","proxima_compra":"08/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Magnésio","trend":"flat","trend_pct":0,"churn":false,"comprou_3m":"Sim"},{"id":"P8761611","mercado":"FR","programa":"Horeca","n_encomendas":8,"valor_total":8741,"valor_medio":1093,"frequencia":56,"dias_desde_ultima":93,"ultima_compra":"22/02/2026","proxima_compra":"19/04/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Proteína Whey Concentrada","trend":"flat","trend_pct":0,"churn":true,"comprou_3m":"Não"},{"id":"P2264748","mercado":"DEAT","programa":"Horeca","n_encomendas":10,"valor_total":21262,"valor_medio":2126,"frequencia":32,"dias_desde_ultima":193,"ultima_compra":"14/11/2025","proxima_compra":"16/12/2025","ss_pct":0,"ss_class":"Regular","top_produto":"Proteína Isolada","trend":"down","trend_pct":51,"churn":true,"comprou_3m":"Não"},{"id":"P2642635","mercado":"FR","programa":"Corporate","n_encomendas":11,"valor_total":16267,"valor_medio":1479,"frequencia":29,"dias_desde_ultima":43,"ultima_compra":"13/04/2026","proxima_compra":"12/05/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Colagénio","trend":"up","trend_pct":59,"churn":false,"comprou_3m":"Sim"},{"id":"P1247595","mercado":"FR","programa":"Horeca","n_encomendas":5,"valor_total":5895,"valor_medio":1179,"frequencia":40,"dias_desde_ultima":317,"ultima_compra":"13/07/2025","proxima_compra":"22/08/2025","ss_pct":0,"ss_class":"Regular","top_produto":"ZMA","trend":"up","trend_pct":178,"churn":true,"comprou_3m":"Não"},{"id":"P4965789","mercado":"FR","programa":"Pro Box","n_encomendas":14,"valor_total":33820,"valor_medio":2416,"frequencia":38,"dias_desde_ultima":11,"ultima_compra":"15/05/2026","proxima_compra":"22/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Queimador de Gordura","trend":"flat","trend_pct":0,"churn":false,"comprou_3m":"Sim"},{"id":"P9147706","mercado":"DEAT","programa":"Professionals","n_encomendas":13,"valor_total":23889,"valor_medio":1838,"frequencia":38,"dias_desde_ultima":32,"ultima_compra":"24/04/2026","proxima_compra":"01/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Pre-Treino Intenso","trend":"down","trend_pct":26,"churn":false,"comprou_3m":"Sim"},{"id":"P7728339","mercado":"FR","programa":"Professionals","n_encomendas":20,"valor_total":43949,"valor_medio":2313,"frequencia":28,"dias_desde_ultima":10,"ultima_compra":"16/05/2026","proxima_compra":"13/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Omega 3","trend":"flat","trend_pct":0,"churn":false,"comprou_3m":"Sim"},{"id":"P7358113","mercado":"FR","programa":"Pro Box","n_encomendas":6,"valor_total":8281,"valor_medio":1380,"frequencia":45,"dias_desde_ultima":240,"ultima_compra":"28/09/2025","proxima_compra":"12/11/2025","ss_pct":0,"ss_class":"Regular","top_produto":"Pre-Treino Intenso","trend":"down","trend_pct":11,"churn":true,"comprou_3m":"Não"},{"id":"P5449368","mercado":"DEAT","programa":"Pro Gym","n_encomendas":6,"valor_total":6705,"valor_medio":1117,"frequencia":79,"dias_desde_ultima":105,"ultima_compra":"10/02/2026","proxima_compra":"30/04/2026","ss_pct":8,"ss_class":"Regular","top_produto":"Colagénio","trend":"down","trend_pct":13,"churn":true,"comprou_3m":"Não"},{"id":"P8096887","mercado":"DEAT","programa":"Professionals","n_encomendas":15,"valor_total":27094,"valor_medio":1935,"frequencia":36,"dias_desde_ultima":9,"ultima_compra":"17/05/2026","proxima_compra":"22/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Ganho de Massa","trend":"up","trend_pct":25,"churn":false,"comprou_3m":"Sim"},{"id":"P4185957","mercado":"CH","programa":"Professionals","n_encomendas":20,"valor_total":32414,"valor_medio":1621,"frequencia":26,"dias_desde_ultima":6,"ultima_compra":"20/05/2026","proxima_compra":"15/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Proteína Whey Concentrada","trend":"down","trend_pct":58,"churn":false,"comprou_3m":"Sim"},{"id":"P1981186","mercado":"FR","programa":"Corporate","n_encomendas":7,"valor_total":8007,"valor_medio":1144,"frequencia":47,"dias_desde_ultima":13,"ultima_compra":"13/05/2026","proxima_compra":"29/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"BCAA Premium","trend":"up","trend_pct":55,"churn":false,"comprou_3m":"Sim"},{"id":"P6261415","mercado":"FR","programa":"Elite","n_encomendas":15,"valor_total":23877,"valor_medio":1592,"frequencia":25,"dias_desde_ultima":25,"ultima_compra":"01/05/2026","proxima_compra":"26/05/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Ganho de Massa","trend":"down","trend_pct":25,"churn":false,"comprou_3m":"Sim"},{"id":"P8999183","mercado":"FR","programa":"Elite","n_encomendas":8,"valor_total":11092,"valor_medio":1387,"frequencia":53,"dias_desde_ultima":6,"ultima_compra":"20/05/2026","proxima_compra":"12/07/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Proteína Isolada","trend":"down","trend_pct":46,"churn":false,"comprou_3m":"Sim"},{"id":"P9519948","mercado":"FR","programa":"Horeca","n_encomendas":9,"valor_total":14834,"valor_medio":1648,"frequencia":61,"dias_desde_ultima":5,"ultima_compra":"21/05/2026","proxima_compra":"21/07/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Proteína Whey Concentrada","trend":"flat","trend_pct":0,"churn":false,"comprou_3m":"Sim"},{"id":"P4117625","mercado":"FR","programa":"Performance","n_encomendas":19,"valor_total":31057,"valor_medio":1725,"frequencia":26,"dias_desde_ultima":12,"ultima_compra":"14/05/2026","proxima_compra":"09/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Creatina Monohidratada","trend":"flat","trend_pct":0,"churn":false,"comprou_3m":"Sim"},{"id":"P2140194","mercado":"FR","programa":"Pro Box","n_encomendas":18,"valor_total":27854,"valor_medio":1547,"frequencia":30,"dias_desde_ultima":1,"ultima_compra":"25/05/2026","proxima_compra":"24/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Proteína Isolada","trend":"flat","trend_pct":0,"churn":false,"comprou_3m":"Sim"},{"id":"P3011363","mercado":"FR","programa":"Performance","n_encomendas":5,"valor_total":11237,"valor_medio":2247,"frequencia":68,"dias_desde_ultima":105,"ultima_compra":"10/02/2026","proxima_compra":"19/04/2026","ss_pct":18,"ss_class":"Regular","top_produto":"ZMA","trend":"up","trend_pct":75,"churn":true,"comprou_3m":"Não"},{"id":"P1666754","mercado":"FR","programa":"Pro Box","n_encomendas":12,"valor_total":18459,"valor_medio":1538,"frequencia":38,"dias_desde_ultima":41,"ultima_compra":"15/04/2026","proxima_compra":"23/05/2026","ss_pct":22,"ss_class":"Misto","top_produto":"Proteína Whey Concentrada","trend":"down","trend_pct":18,"churn":false,"comprou_3m":"Sim"},{"id":"P9770838","mercado":"BNL","programa":"Pro Gym","n_encomendas":14,"valor_total":29760,"valor_medio":2126,"frequencia":38,"dias_desde_ultima":4,"ultima_compra":"22/05/2026","proxima_compra":"29/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Colagénio","trend":"up","trend_pct":22,"churn":false,"comprou_3m":"Sim"},{"id":"P4426900","mercado":"BNL","programa":"Professionals","n_encomendas":7,"valor_total":15479,"valor_medio":2211,"frequencia":72,"dias_desde_ultima":50,"ultima_compra":"06/04/2026","proxima_compra":"17/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"BCAA Premium","trend":"down","trend_pct":30,"churn":false,"comprou_3m":"Sim"},{"id":"P5456272","mercado":"BNL","programa":"Professionals","n_encomendas":12,"valor_total":24549,"valor_medio":2232,"frequencia":44,"dias_desde_ultima":19,"ultima_compra":"07/05/2026","proxima_compra":"20/06/2026","ss_pct":0,"ss_class":"Regular","top_produto":"Pre-Treino Intenso","trend":"flat","trend_pct":0,"churn":false,"comprou_3m":"Sim"}];
const BENCH_PROG = {"Corporate":{"val_medio":1865,"freq":41},"Professionals":{"val_medio":1897,"freq":46},"Elite":{"val_medio":1860,"freq":40},"Performance":{"val_medio":1892,"freq":43},"Horeca":{"val_medio":1715,"freq":72},"Pro Gym":{"val_medio":1642,"freq":48},"Pro Box":{"val_medio":1879,"freq":48}};
const BENCH_MKT = {"FR":{"val_medio":1805,"freq":46},"BNL":{"val_medio":1885,"freq":51},"CH":{"val_medio":1838,"freq":51},"DEAT":{"val_medio":1845,"freq":48}};
const MKT_LABELS_TP = {FR:"França",CH:"Suíça",BNL:"Benelux",DEAT:"DE-AT"};
const PROGRAMAS_LIST = ["Corporate","Professionals","Elite","Performance","Horeca","Pro Gym","Pro Box"];

function TopParceirosTab() {
  const [filterMkt, setFilterMkt] = useState("all");
  const [filterProg, setFilterProg] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("valor_total");
  const [search, setSearch] = useState("");

  const filtered = TOP_CLIENTS
    .filter(c => filterMkt==="all" || c.mercado===filterMkt)
    .filter(c => filterProg==="all" || c.programa===filterProg)
    .filter(c => filterStatus==="all" || (filterStatus==="churn"&&c.churn) || (filterStatus==="ss"&&c.ss_class==="SS-dependente") || (filterStatus==="misto"&&c.ss_class==="Misto"))
    .filter(c => !search || c.id.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => sortBy==="valor_total" ? b.valor_total-a.valor_total : sortBy==="freq" ? a.frequencia-b.frequencia : a.dias_desde_ultima-b.dias_desde_ultima);

  const totalFat = TOP_CLIENTS.reduce((s,c)=>s+c.valor_total,0);
  const churnCount = TOP_CLIENTS.filter(c=>c.churn).length;
  const ssDep = TOP_CLIENTS.filter(c=>c.ss_class==="SS-dependente").length;
  const misto = TOP_CLIENTS.filter(c=>c.ss_class==="Misto").length;

  const ssLabel = c => c.ss_class==="SS-dependente" ? {bg:"#FAEEDA",color:"#633806",txt:"SS-dependente"} : c.ss_class==="Misto" ? {bg:"#FEF3C7",color:"#92400E",txt:"Misto"} : {bg:"#E1F5EE",color:"#085041",txt:"Regular"};
  const trendEl = c => c.trend==="up" ? <span style={{color:"#3B6D11",fontSize:12}}>↑ +{c.trend_pct}%</span> : c.trend==="down" ? <span style={{color:"#A32D2D",fontSize:12}}>↓ -{c.trend_pct}%</span> : <span style={{color:C.muted,fontSize:12}}>→ estável</span>;
  const mktBadge = mkt => <span style={{fontSize:11,padding:"2px 8px",borderRadius:20,background:"#E6F1FB",color:"#0C447C"}}>{MKT_LABELS_TP[mkt]||mkt}</span>;
  const progBadge = prog => <span style={{fontSize:11,padding:"2px 8px",borderRadius:20,background:"#E1F5EE",color:"#085041"}}>{prog}</span>;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>

      {/* Visão geral */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:10}}>
        {[
          {label:"Parceiros seguidos", value:TOP_CLIENTS.length, sub:"100 clientes fictícios", subColor:C.muted},
          {label:"Faturação total", value:fmtEur(totalFat), sub:"Jan 2025 — Mai 2026", subColor:C.muted},
          {label:"Em risco de churn", value:churnCount, sub:"Sem compra há +90 dias", subColor:churnCount>0?C.red:C.green},
          {label:"SS-dependentes", value:ssDep+misto>0?ssDep+misto:"0", sub:ssDep+misto>0?`${ssDep} dependentes · ${misto} mistos`:"Nenhum detectado", subColor:ssDep>0?C.amber:C.muted},
        ].map((s,i)=>(
          <div key={i} style={{...T.card}}>
            <p style={{...T.label}}>{s.label}</p>
            <p style={{...T.value,fontSize:20}}>{s.value}</p>
            <p style={{fontSize:11,color:s.subColor,margin:"4px 0 0"}}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Top 10 */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}}>
        {[
          {title:"Top 10 — faturação", data:[...TOP_CLIENTS].sort((a,b)=>b.valor_total-a.valor_total).slice(0,10), key:"valor_total", fmt:fmtEur},
          {title:"Top 10 — nº encomendas", data:[...TOP_CLIENTS].sort((a,b)=>b.n_encomendas-a.n_encomendas).slice(0,10), key:"n_encomendas", fmt:n=>n+" enc."},
        ].map(({title,data,key,fmt:f})=>(
          <div key={title} style={T.card}>
            <p style={T.sectionTitle}>{title}</p>
            {data.map((c,i)=>(
              <div key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderBottom:i<9?`0.5px solid ${C.border}`:"none"}}>
                <span style={{fontSize:11,fontWeight:500,color:i<3?C.green:C.muted,minWidth:18,textAlign:"right"}}>{i+1}</span>
                <span style={{fontSize:13,fontWeight:500,color:C.text,flex:1}}>{c.id}</span>
                <span style={{fontSize:11,padding:"2px 7px",borderRadius:20,background:"#E6F1FB",color:"#0C447C"}}>{MKT_LABELS_TP[c.mercado]||c.mercado}</span>
                <span style={{fontSize:11,padding:"2px 7px",borderRadius:20,background:"#E1F5EE",color:"#085041"}}>{c.programa}</span>
                <span style={{fontSize:13,fontWeight:500,color:C.text,textAlign:"right",minWidth:80}}>{f(c[key])}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Contactar hoje + SS */}
      {(()=>{
        const hoje = new Date(2026,4,26);
        const amanha = new Date(2026,4,27);
        const fmt_date = d => `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
        const amanhaStr = fmt_date(amanha);
        const contactarHoje = TOP_CLIENTS.filter(c=>c.proxima_compra===amanhaStr);
        const ssClients = [...TOP_CLIENTS].filter(c=>c.ss_pct>0).sort((a,b)=>b.ss_pct-a.ss_pct);
        return (
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}}>
            <div style={{...T.card,borderLeft:contactarHoje.length>0?`3px solid ${C.amber}`:undefined,borderRadius:contactarHoje.length>0?"0 12px 12px 0":12}}>
              <p style={T.sectionTitle}>Parceiros a contactar hoje</p>
              <p style={{fontSize:11,color:C.muted,margin:"0 0 10px"}}>Próxima compra prevista para amanhã ({amanhaStr})</p>
              {contactarHoje.length===0
                ? <p style={{fontSize:13,color:C.muted,textAlign:"center",padding:"1rem 0"}}>Nenhum para hoje.</p>
                : contactarHoje.map(c=>(
                  <div key={c.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:`0.5px solid ${C.border}`}}>
                    <span style={{fontSize:13,fontWeight:500,color:C.text,flex:1}}>{c.id}</span>
                    <span style={{fontSize:11,padding:"2px 7px",borderRadius:20,background:"#E6F1FB",color:"#0C447C"}}>{MKT_LABELS_TP[c.mercado]||c.mercado}</span>
                    <span style={{fontSize:11,padding:"2px 7px",borderRadius:20,background:"#E1F5EE",color:"#085041"}}>{c.programa}</span>
                    <span style={{fontSize:11,color:C.muted}}>{c.top_produto}</span>
                  </div>
                ))
              }
            </div>
            <div style={T.card}>
              <p style={T.sectionTitle}>Prioritários em Supersales</p>
              <p style={{fontSize:11,color:C.muted,margin:"0 0 10px"}}>Clientes com maior % de compras em dias SS</p>
              {ssClients.length===0
                ? <p style={{fontSize:13,color:C.muted,textAlign:"center",padding:"1rem 0"}}>Nenhum SS detectado nos dados actuais.</p>
                : ssClients.map((c,i)=>(
                  <div key={c.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:i<ssClients.length-1?`0.5px solid ${C.border}`:"none"}}>
                    <span style={{fontSize:13,fontWeight:500,color:C.text,flex:1}}>{c.id}</span>
                    <span style={{fontSize:11,padding:"2px 7px",borderRadius:20,background:"#E6F1FB",color:"#0C447C"}}>{MKT_LABELS_TP[c.mercado]||c.mercado}</span>
                    <span style={{fontSize:11,padding:"2px 7px",borderRadius:20,background:"#FAEEDA",color:"#633806"}}>{c.ss_class}</span>
                    <span style={{fontSize:13,fontWeight:500,color:C.amber,minWidth:40,textAlign:"right"}}>{c.ss_pct}%</span>
                  </div>
                ))
              }
            </div>
          </div>
        );
      })()}

      {/* Benchmarks */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}}>
        <div style={T.card}>
          <p style={T.sectionTitle}>Por programa</p>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr>
              <th style={{textAlign:"left",color:C.muted,fontWeight:400,padding:"4px 0",fontSize:11}}>Programa</th>
              <th style={{textAlign:"right",color:C.muted,fontWeight:400,padding:"4px 0",fontSize:11}}>Val. médio enc.</th>
              <th style={{textAlign:"right",color:C.muted,fontWeight:400,padding:"4px 0",fontSize:11}}>Freq. média</th>
            </tr></thead>
            <tbody>
              {Object.entries(BENCH_PROG).map(([prog,v])=>(
                <tr key={prog} style={{borderTop:`0.5px solid ${C.border}`}}>
                  <td style={{padding:"6px 0",color:C.text}}>{prog}</td>
                  <td style={{padding:"6px 0",textAlign:"right",fontWeight:500,color:C.text}}>{fmtEur(v.val_medio)}</td>
                  <td style={{padding:"6px 0",textAlign:"right",color:C.muted}}>{v.freq} dias</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={T.card}>
          <p style={T.sectionTitle}>Por mercado</p>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr>
              <th style={{textAlign:"left",color:C.muted,fontWeight:400,padding:"4px 0",fontSize:11}}>Mercado</th>
              <th style={{textAlign:"right",color:C.muted,fontWeight:400,padding:"4px 0",fontSize:11}}>Val. médio enc.</th>
              <th style={{textAlign:"right",color:C.muted,fontWeight:400,padding:"4px 0",fontSize:11}}>Freq. média</th>
            </tr></thead>
            <tbody>
              {Object.entries(BENCH_MKT).map(([mkt,v])=>(
                <tr key={mkt} style={{borderTop:`0.5px solid ${C.border}`}}>
                  <td style={{padding:"6px 0",color:C.text}}>{MKT_LABELS_TP[mkt]||mkt}</td>
                  <td style={{padding:"6px 0",textAlign:"right",fontWeight:500,color:C.text}}>{fmtEur(v.val_medio)}</td>
                  <td style={{padding:"6px 0",textAlign:"right",color:C.muted}}>{v.freq} dias</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filtros + lista */}
      <div style={T.card}>
        <div style={{display:"flex",gap:8,flexWrap:"nowrap",alignItems:"center",marginBottom:14,overflowX:"auto"}}>
          {[{id:"all",l:`Todos (${TOP_CLIENTS.length})`},{id:"churn",l:`Churn (${churnCount})`},{id:"ss",l:`SS-dep. (${ssDep})`},{id:"misto",l:`Misto (${misto})`}].map(f=>(
            <button key={f.id} onClick={()=>setFilterStatus(f.id)}
              style={{padding:"5px 12px",borderRadius:20,fontSize:12,border:`0.5px solid ${C.border}`,cursor:"pointer",flexShrink:0,
                background:filterStatus===f.id?C.green:"transparent",color:filterStatus===f.id?"#fff":C.muted}}>
              {f.l}
            </button>
          ))}
          <div style={{width:1,height:20,background:C.border,flexShrink:0}} />
          <select value={filterMkt} onChange={e=>setFilterMkt(e.target.value)}
            style={{padding:"5px 8px",border:`0.5px solid ${C.border}`,borderRadius:8,fontSize:12,background:C.bg,color:C.muted,outline:"none",flexShrink:0}}>
            <option value="all">Mercado</option>
            {Object.entries(MKT_LABELS_TP).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filterProg} onChange={e=>setFilterProg(e.target.value)}
            style={{padding:"5px 8px",border:`0.5px solid ${C.border}`,borderRadius:8,fontSize:12,background:C.bg,color:C.muted,outline:"none",flexShrink:0}}>
            <option value="all">Programa</option>
            {PROGRAMAS_LIST.map(p=><option key={p} value={p}>{p}</option>)}
          </select>
          <select value={sortBy} onChange={e=>setSortBy(e.target.value)}
            style={{padding:"5px 8px",border:`0.5px solid ${C.border}`,borderRadius:8,fontSize:12,background:C.bg,color:C.muted,outline:"none",flexShrink:0}}>
            <option value="valor_total">↓ Maior faturação</option>
            <option value="freq">↑ Mais frequente</option>
            <option value="churn">⚠ Mais urgente</option>
          </select>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar ID..."
            style={{padding:"5px 10px",border:`0.5px solid ${C.border}`,borderRadius:8,fontSize:12,background:C.bg,color:C.text,outline:"none",width:130,flexShrink:0}} />
          <span style={{fontSize:12,color:C.muted,flexShrink:0,marginLeft:"auto"}}>{filtered.length} resultado{filtered.length!==1?"s":""}</span>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {filtered.map(c => {
            const ssl = ssLabel(c);
            const benchP = BENCH_PROG[c.programa];
            const benchM = BENCH_MKT[c.mercado];
            const vsMktBench = benchM ? (c.valor_medio > benchM.val_medio ? "↑" : c.valor_medio < benchM.val_medio*0.9 ? "↓" : "→") : null;
            return (
              <div key={c.id} style={{background:c.churn?"#FCEBEB":C.bg,border:`0.5px solid ${c.churn?"#F09595":C.border}`,borderRadius:10,padding:"12px 14px",
                borderLeft:c.churn?"3px solid #E24B4A":undefined}}>
                {/* Linha 1 */}
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                  <span style={{fontWeight:500,fontSize:14,color:C.text}}>{c.id}</span>
                  {mktBadge(c.mercado)}
                  {progBadge(c.programa)}
                  <span style={{fontSize:11,padding:"2px 8px",borderRadius:20,background:ssl.bg,color:ssl.color}}>{ssl.txt}</span>
                  <span style={{marginLeft:"auto"}}>{trendEl(c)}</span>
                </div>
                {/* Linha 2 — métricas */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:6}}>
                  <div>
                    <p style={{fontSize:10,color:C.muted,margin:"0 0 2px"}}>Faturação total</p>
                    <p style={{fontSize:13,fontWeight:500,margin:0,color:C.text}}>{fmtEur(c.valor_total)}</p>
                  </div>
                  <div>
                    <p style={{fontSize:10,color:C.muted,margin:"0 0 2px"}}>Nº encomendas</p>
                    <p style={{fontSize:13,fontWeight:500,margin:0,color:C.text}}>{c.n_encomendas}</p>
                  </div>
                  <div>
                    <p style={{fontSize:10,color:C.muted,margin:"0 0 2px"}}>Val. médio enc.</p>
                    <p style={{fontSize:13,fontWeight:500,margin:0,color:C.text}}>{fmtEur(c.valor_medio)}</p>
                    {vsMktBench&&<p style={{fontSize:10,margin:0,color:vsMktBench==="↑"?"#3B6D11":vsMktBench==="↓"?"#A32D2D":C.muted}}>{vsMktBench} vs. benchmark</p>}
                  </div>
                  <div>
                    <p style={{fontSize:10,color:C.muted,margin:"0 0 2px"}}>Frequência</p>
                    <p style={{fontSize:13,fontWeight:500,margin:0,color:C.text}}>{c.frequencia} dias</p>
                  </div>
                  <div>
                    <p style={{fontSize:10,color:C.muted,margin:"0 0 2px"}}>Última compra</p>
                    <p style={{fontSize:13,fontWeight:500,margin:0,color:c.churn?C.red:C.text}}>há {c.dias_desde_ultima} dias</p>
                  </div>
                </div>
                {/* Linha 3 — footer */}
                <div style={{display:"flex",gap:8,marginTop:10,paddingTop:8,borderTop:`0.5px solid ${C.border}`,fontSize:11,color:C.muted,alignItems:"center"}}>
                  {c.churn
                    ? <span style={{background:"#FCEBEB",color:"#791F1F",padding:"3px 8px",borderRadius:6}}>⚠ Risco de churn — contactar urgente</span>
                    : <span style={{background:"#E1F5EE",color:"#085041",padding:"3px 8px",borderRadius:6}}>Próxima compra prevista: {c.proxima_compra}</span>
                  }
                  {c.ss_pct>0&&<span style={{background:"#FAEEDA",color:"#633806",padding:"3px 8px",borderRadius:6}}>{c.ss_pct}% compras em Supersales</span>}
                  <span style={{color:C.muted}}>Produto top: {c.top_produto}</span>
                </div>
              </div>
            );
          })}
          {filtered.length===0&&<p style={{color:C.muted,fontSize:13,textAlign:"center",padding:"2rem"}}>Nenhum resultado.</p>}
        </div>
      </div>
    </div>
  );
}

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
        <p style={{ fontWeight:500, fontSize:18, margin:"0 0 4px", color:C.text }}>Partners França</p>
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

async function loadHistoricalSSAvg(year, month) {
  // Load previous months, find months that had a SS day, sum their SS day values, divide by count
  const keys = [];
  for (let i = 1; i <= 12; i++) {
    const d = new Date(year, month - i, 1);
    keys.push(monthKey(d.getFullYear(), d.getMonth()));
  }
  const { data } = await supabase.from("billing_months").select("entries").in("month_key", keys);
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
      const val = (Number(e.FR)||0)+(Number(e["CH-BNL-DEAT"])||0)+(Number(e.CH)||0)+(Number(e.BNL)||0)+(Number(e.DEAT)||0);
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

async function loadPartnersCount(year, month) {
  const start = new Date(year, month, 1).toISOString();
  const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
  const { count } = await supabase.from("partner_followup")
    .select("*", { count:"exact", head:true })
    .gte("original_created_at", start)
    .lte("original_created_at", end)
    .neq("status", "deleted");
  return count || 0;
}

async function loadPartnersCountPrev(year, month) {
  const start = new Date(year - 1, month, 1).toISOString();
  const end = new Date(year - 1, month + 1, 0, 23, 59, 59).toISOString();
  const { count } = await supabase.from("partner_followup")
    .select("*", { count:"exact", head:true })
    .gte("original_created_at", start)
    .lte("original_created_at", end);
  return count || 0;
}

function buildDaily(entries, totalDays, year, month) {
  const daily = []; let lastFR=0, lastCH=0, prevCumul=0;
  for (let d=1; d<=totalDays; d++) {
    const e = entries[d] || {};
    if (e.FR !== undefined) lastFR = Number(e.FR)||0;
    if (e["CH-BNL-DEAT"] !== undefined) lastCH = Number(e["CH-BNL-DEAT"])||0;
    const cumul = lastFR + lastCH;
    const dow = (year!=null&&month!=null) ? new Date(year, month, d).getDay() : null;
    daily.push({ day:d, FR:lastFR, CH:lastCH, cumul, dayValue:cumul>prevCumul?cumul-prevCumul:0, supersales:e.supersales===true, dow });
    prevCumul = cumul;
  }
  return daily;
}

function buildDailyFirstRev(entries, totalDays, newStruct) {
  const fields = newStruct ? ["first_rev_FR","first_rev_CH","first_rev_BNL","first_rev_DEAT"] : ["first_rev_FR","first_rev_CH-BNL-DEAT"];
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

function computeStats(daily, teamGoals, totalDays, closedDay, historicalSSAvg=0) {
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

  // Day-of-week averages (0=Sun, 1=Mon, ... 6=Sat)
  // We need to know the year/month to get the day of week for each day
  // We pass year/month via the daily array's context — compute from totalDays anchor
  // Use a reference: day 1 of the month. We derive weekday from totalDays count (passed externally).
  // Instead, compute dow-based avg using closed days
  const dowAvg = {};
  const dowCount = {};
  closed.filter(d=>!d.supersales&&d.dayValue>0).forEach(d=>{
    // d.dow is set by buildDaily if available, otherwise skip
    if (d.dow==null) return;
    dowAvg[d.dow] = (dowAvg[d.dow]||0) + d.dayValue;
    dowCount[d.dow] = (dowCount[d.dow]||0) + 1;
  });
  const avgByDow = {};
  Object.keys(dowAvg).forEach(k=>{ avgByDow[k] = Math.round(dowAvg[k]/dowCount[k]); });
  const hasDowData = Object.keys(avgByDow).length >= 3;

  // Project remaining days using dow avg (fallback to avgNormal if dow not available)
  const remDayValues = hasDowData ? daily.filter(d=>d.day>closedDay&&!d.supersales).map(d=>avgByDow[d.dow]||avgNormal) : [];
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

function PartnersDetailModal({ year, month, closedDay, onClose }) {
  const [rows, setRows] = useState([]);
  useEffect(()=>{
    const start = new Date(year, month, 1).toISOString();
    const end = new Date(year, month+1, 0, 23, 59, 59).toISOString();
    supabase.from("partner_followup").select("original_created_at").gte("original_created_at", start).lte("original_created_at", end).neq("status","deleted")
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
    <Modal title="Novos parceiros — detalhe" subtitle={`Equipa FR · ${closedDay} dias fechados`} onClose={onClose}>
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

function AnaliseTab({ year, month, totalDays, closedDay, entries, teamGoals }) {
  const [modal, setModal] = useState(null);
  const [partnersCount, setPartnersCount] = useState(null);

  useEffect(()=>{
    loadPartnersCount(year, month).then(setPartnersCount);
  }, [year, month]);

  const newStruct = isNewStructure(year, month);
  const [historicalSSAvg, setHistoricalSSAvg] = useState(0);
  useEffect(()=>{ loadHistoricalSSAvg(year, month).then(setHistoricalSSAvg); }, [year, month]);
  const daily = useMemo(()=>buildDaily(entries,totalDays,year,month),[entries,totalDays,year,month]);
  const stats = useMemo(()=>computeStats(daily,teamGoals,totalDays,closedDay,historicalSSAvg),[daily,teamGoals,totalDays,closedDay,historicalSSAvg]);
  const dailyFirstRev = useMemo(()=>buildDailyFirstRev(entries,totalDays,newStruct),[entries,totalDays,newStruct]);
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
      {modal==="parceiros" && <PartnersDetailModal year={year} month={month} closedDay={closedDay} onClose={()=>setModal(null)} />}
      {modal && modal!=="parceiros" && (modal==="firstrev_faturado"||modal==="firstrev_objetivo"
        ? <DailyDetailModal daily={dailyFirstRev} closedDay={closedDay} goal={firstRevGoal} mode={modal==="firstrev_faturado"?"faturado":"objetivo"} onClose={()=>setModal(null)} />
        : <DailyDetailModal daily={daily} closedDay={closedDay} goal={stats.goal} mode={modal} onClose={()=>setModal(null)} />
      )}

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
              sub={firstRevGoal>0?`faltam ${fmtEur(Math.max(0,firstRevGoal-firstRevActual))} para o objetivo`:undefined}
              subColor={C.muted}
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

// ── Helper: is new structure (June 2026+) ─────────────────────────────────────
const isNewStructure = (year, month) => year > 2026 || (year === 2026 && month >= 5); // month is 0-indexed, 5 = June

// ── Registo Tab ────────────────────────────────────────────────────────────────
function RegistoTab({ year, month, totalDays, closedDay, monthData, setMonthData }) {
  const [subTab, setSubTab] = useState("faturacao");
  const newStruct = isNewStructure(year, month);

  const SUB_TABS = [
    { id:"faturacao",   label:"Faturação diária" },
    { id:"primeiras",   label:"1ªs Compras" },
    { id:"afiliacao",   label:"Afiliação" },
    { id:"encomendas",  label:"Encomendas" },
    { id:"parceiros",   label:"Parceiros / Leads" },
    { id:"margem",      label:"Margem" },
    { id:"objetivos",   label:"Objetivos" },
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
                  {["Dia", "França", ...(newStruct ? ["Suíça","Benelux","DE-AT"] : ["CH-BNL-DEAT"])].map((h,i) => (
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
                      {(newStruct ? ["first_rev_FR","first_rev_CH","first_rev_BNL","first_rev_DEAT"] : ["first_rev_FR","first_rev_CH-BNL-DEAT"]).map(field => (
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
        const LD_MKTS_OLD = [{key:"FR",label:"França"},{key:"CH-BNL-DEAT",label:"CH-BNL-DEAT"}];
        const LD_MKTS_NEW = [{key:"FR",label:"França"},{key:"CH",label:"Suíça"},{key:"BNL",label:"Benelux"},{key:"DEAT",label:"Alemanha e Áustria"}];
        const mktList = newStruct ? LD_MKTS_NEW : LD_MKTS_OLD;
        return (
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

// ── Partner constants & mappings ──────────────────────────────────────────────
const GESTORS = ["Antony", "Fabien", "Mónica"];
const ALL_MKTS = [
  {key:"FR",label:"França"},{key:"CH-BNL-DEAT",label:"CH-BNL-DEAT"},
  {key:"CH",label:"Suíça"},{key:"BNL",label:"Benelux"},{key:"DEAT",label:"Alemanha e Áustria"}
];
const GESTOR_MAP = {
  "ANTONY BARROS":"Antony","FABIEN COLETTE":"Fabien","MONICA OLIVEIRA":"Mónica",
  "ANTONY":"Antony","FABIEN":"Fabien","MONICA":"Mónica","MÓNICA":"Mónica",
};
const MKT_MAP = {
  "França":"FR","FRANCA":"FR","FRANCE":"FR",
  "Suiça":"CH","SUICA":"CH","SUIÇA":"CH","SWITZERLAND":"CH",
  "AT":"DEAT","DE":"DEAT","DEAT":"DEAT",
  "BE":"BNL","NL":"BNL","LU":"BNL","BNL":"BNL",
  "FR":"FR","CH":"CH",
};
const PROG_MAP = {
  "ELITE-PARTNER":"Elite","ELITE":"Elite",
  "PROFESSIONALS":"Professionals","PROFESSIONAL":"Professionals",
  "PRO GYM":"ProGym","PROGYM":"ProGym",
  "PRO BOX":"ProBox","PROBOX":"ProBox",
  "PRO TEAMS":"ProTeams","PROTEAMS":"ProTeams",
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
function PartnerFollowup({ year, month, gestor: gestorFilter }) {
  const isGestorFiltered = !!gestorFilter;
  const PROGS = ["Professionals","Elite","ProGym","ProBox","ProTeams","Performance","Horeca","Corporate"];
  const MKT_OLD = [{key:"FR",label:"França"},{key:"CH-BNL-DEAT",label:"CH-BNL-DEAT"}];
  const MKT_NEW = [{key:"FR",label:"França"},{key:"CH",label:"Suíça"},{key:"BNL",label:"Benelux"},{key:"DEAT",label:"Alemanha e Áustria"}];
  const isNew = isNewStructure(year, month);
  const mktList = isNew ? MKT_NEW : MKT_OLD;

  const STAGES = [
    { key:"s30", days:30, label:"30 dias" },
    { key:"s60", days:60, label:"60 dias" },
    { key:"s90", days:90, label:"90 dias" },
  ];

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
    let q = supabase.from("partner_followup").select("*").order("stage_started_at", { ascending:false });
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

      let headerIdx = rows.findIndex(r => r.some(c => String(c).trim().toUpperCase() === "ID"));
      if (headerIdx < 0) { setImportMsg("❌ Coluna ID não encontrada"); setImporting(false); return; }
      const headers = rows[headerIdx].map(h => String(h).trim().toUpperCase());
      const iID   = headers.findIndex(h => h==="ID");
      const iGest = headers.findIndex(h => h==="GESTOR");
      const iMkt  = headers.findIndex(h => h==="MERCADO");
      const iProg = headers.findIndex(h => h==="PROGRAMA");
      const iDate = headers.findIndex(h => h.includes("DATA"));
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
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <p style={{ fontSize:18, fontWeight:500, margin:0, color:C.text }}>Acompanhamento de Parceiros</p>
          <p style={{ fontSize:13, color:C.muted, margin:"3px 0 0" }}>Seguimento de primeiras compras · 30 / 60 / 90 dias</p>
        </div>
        {overdueCount>0 && (
          <span style={{ background:"#FCEBEB", color:C.red, fontSize:12, fontWeight:500, padding:"5px 12px", borderRadius:20 }}>
            ⚠ {overdueCount} {overdueCount===1?"alerta":"alertas"}
          </span>
        )}
      </div>

      {/* Form */}
      <div style={T.card}>
        <p style={T.sectionTitle}>Registar novo parceiro</p>
        <form onSubmit={handleAdd}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr auto", gap:10, alignItems:"end" }}>
            <div>
              <p style={{ fontSize:12, color:C.muted, margin:"0 0 5px" }}>ID do cliente</p>
              <input type="text" value={clientId} onChange={e=>setClientId(e.target.value)} placeholder="ex: 123456" required
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
        </select>
        {/* Programa */}
        <select value={filterProg} onChange={e=>setFilterProg(e.target.value)}
          style={{ padding:"5px 8px", border:`0.5px solid ${C.border}`, borderRadius:8, fontSize:12, background:C.bg, color:filterProg!=="all"?C.text:C.muted, outline:"none", cursor:"pointer", flexShrink:0 }}>
          <option value="all">Programa</option>
          <option value="Elite">Elite</option>
          <option value="Professionals">Professionals</option>
          <option value="ProGym">Pro Gym</option>
          <option value="ProBox">Pro Box</option>
          <option value="ProTeams">Pro Teams</option>
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
                      ✓ Fez compra
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
  useEffect(()=>{ setLoading(true); loadMonthData(year,month).then(d=>{ setMonthData(d); setLoading(false); }); },[year,month]);
  const monthOptions = Array.from({length:12},(_,i)=>{ const d=new Date(today.getFullYear(),today.getMonth()-i,1); return { value:monthKey(d.getFullYear(),d.getMonth()), label:`${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` }; });
  return (
    <div style={{ minHeight:"100vh", background:C.bg }}>
      <div style={{ maxWidth:920, margin:"0 auto", padding:"1.25rem 1rem" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1.5rem" }}>
          <div>
            <p style={{ fontSize:20, fontWeight:500, margin:0, color:C.text }}>Partners França</p>
            <p style={{ fontSize:13, color:C.muted, margin:"3px 0 0" }}>Equipa FR · {role.name}{isAdmin?" · Admin":""}</p>
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
          {[{id:"analise",l:"Dashboard",adminOnly:false},{id:"registo",l:"Registo",adminOnly:true},{id:"parceiros",l:"Follow-up",adminOnly:false},{id:"topparceiros",l:"Top Parceiros",adminOnly:true}]
            .filter(t=>!t.adminOnly||isAdmin)
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
          <AnaliseTab year={year} month={month} totalDays={totalDays} closedDay={closedDay} entries={monthData.entries||{}} teamGoals={monthData.team_goals||{}} />
        ):(
          <div style={{ textAlign:"center", padding:"4rem 0", color:C.muted, fontSize:14 }}>
            {tab==="registo" ? <RegistoTab year={year} month={month} totalDays={totalDays} closedDay={closedDay} monthData={monthData} setMonthData={setMonthData} /> : tab==="topparceiros" ? <TopParceirosTab /> : <PartnerFollowup year={year} month={month} gestor={isAdmin?null:gestor} />}
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
