// «Іспит» (білети, задачі з розв'язком, слабкі теми, план) і «Облік» (оцінки з прогнозом, відпрацювання).
// Використовує глобальні S, api, $, esc, fmt, renderMath, setTab, questionText, answerMarkup з index.html.
"use strict";
let exView = "ticket", exSubj = "phys", exTickets = null, exRun = null, exProb = null, exProbSubj = "phys", exProbGen = "",
    exWeak = null, exCards = {}, exTimer = 0;

/* ---------- генератори задач ---------- */
const R = (a, b, step = 1) => { const n = Math.round((a + Math.random() * (b - a)) / step) * step; return +n.toFixed(6) };
const pick = a => a[Math.floor(Math.random() * a.length)];
const f = (x, d = 3) => { if (!isFinite(x)) return "—"; const v = Math.abs(x) >= 1000 || Math.abs(x) < 0.01 && x !== 0 ? x.toExponential(2) : (+x.toFixed(d)).toString(); return v.replace(".", ",") };
const g = 9.81, Rg = 8.31, kB = 1.38e-23;
const GEN = {
  phys_throw: { s: "phys", t: "Горизонтальний кидок", f() {
    const t = R(0.3, 0.9, 0.1), k = R(2, 4, 0.5), vx = g * t / Math.sqrt(k * k - 1);
    return { text: `Камінь кинули горизонтально. Через $t=${f(t)}$ с його швидкість у $${f(k)}$ раза більша за горизонтальну складову. Знайти $v_x$.`,
      steps: ["Горизонтальна складова стала: $v_x$; вертикальна $v_y=gt$.", `$v=\\sqrt{v_x^2+v_y^2}=k\\,v_x$ ⇒ $v_y=v_x\\sqrt{k^2-1}$.`, `$v_x=\\dfrac{gt}{\\sqrt{k^2-1}}=\\dfrac{9{,}81\\cdot${f(t)}}{\\sqrt{${f(k)}^2-1}}$.`],
      answer: vx, unit: "м/с" } } },
  phys_carnot: { s: "phys", t: "Цикл Карно", f() {
    const [p, q] = pick([[1, 3], [2, 3], [1, 4], [4, 5], [1, 2], [3, 5]]), T2 = R(270, 320, 10), T1 = T2 * q / p;
    return { text: `Ідеальна теплова машина працює за циклом Карно і віддає холодильнику $${p}/${q}$ теплоти, отриманої від нагрівника. $T_2=${T2}$ К. Знайти $T_1$ і ККД.`,
      steps: ["Для циклу Карно $\\dfrac{Q_2}{Q_1}=\\dfrac{T_2}{T_1}$.", `$T_1=T_2\\cdot\\dfrac{Q_1}{Q_2}=${T2}\\cdot\\dfrac{${q}}{${p}}=${f(T1, 1)}$ К.`, `$\\eta=1-\\dfrac{Q_2}{Q_1}=1-\\dfrac{${p}}{${q}}=${f(1 - p / q)}$ (${f((1 - p / q) * 100, 1)} %).`],
      answer: T1, unit: "К" } } },
  phys_incline: { s: "phys", t: "Похила площина з тертям", f() {
    const a = pick([25, 30, 37, 45]), S = R(10, 40, 0.5), v = R(2, 6, 0.5), rad = a * Math.PI / 180, mu = (g * Math.sin(rad) - v * v / (2 * S)) / (g * Math.cos(rad));
    return { text: `Тіло без початкової швидкості з'їжджає з похилої площини з кутом $${a}°$. Пройшовши $S=${f(S)}$ м, воно має швидкість $v=${f(v)}$ м/с. Знайти коефіцієнт тертя $\\mu$.`,
      steps: ["$v^2=2aS$ ⇒ $a=\\dfrac{v^2}{2S}$.", "II закон Ньютона вздовж площини: $ma=mg\\sin\\alpha-\\mu mg\\cos\\alpha$.", `$\\mu=\\dfrac{g\\sin\\alpha-v^2/(2S)}{g\\cos\\alpha}$; $a=${f(v * v / (2 * S))}$ м/с².`],
      answer: mu, unit: "" } } },
  phys_carts: { s: "phys", t: "Візки й закон збереження імпульсу", f() {
    const m1 = R(1, 4, 1), m2 = R(2, 6, 1), v1 = R(1, 5, 1);
    return { text: `Два візки масами ${m1} кг та ${m2} кг спочатку нерухомі. Пружина розштовхнула їх. Перший візок набрав швидкість ${v1} м/с. Знайдіть модуль швидкості другого.`,
      steps: ["Сумарний імпульс дорівнює нулю, тому візки рухаються в протилежних напрямках.", `За модулями: m₁v₁ = m₂v₂. Отже, v₂ = ${m1} · ${v1} / ${m2}.`], answer: m1*v1/m2, unit: "м/с" } } },
  phys_vapor: { s: "phys", t: "Густина і концентрація пари", f() {
    const tc = R(10, 30, 1), p = R(1.2, 4.2, 0.1), T = tc + 273, rho = p * 1000 * 0.018 / (Rg * T), n = p * 1000 / (kB * T);
    return { text: `Тиск водяної пари при $${tc}$ °C дорівнює $${f(p)}$ кПа. Знайти густину пари і концентрацію молекул.`,
      steps: [`$T=${T}$ К, $M=0{,}018$ кг/моль.`, "$\\rho=\\dfrac{pM}{RT}$ (з рівняння Менделєєва–Клапейрона).", `$n=\\dfrac{p}{kT}=${f(n)}$ м⁻³.`], answer: rho, unit: "кг/м³" } } },
  phys_cylinder: { s: "phys", t: "Об'єм балона (рівняння стану)", f() {
    const m = R(2, 8, 0.2), tc = R(10, 30, 1), p = R(10, 16, 0.1), V = m * Rg * (tc + 273) / (0.032 * p * 1e6);
    return { text: `Який найменший об'єм балона, що вміщує $${f(m)}$ кг кисню при $${tc}$ °C, якщо стінки витримують тиск $${f(p)}$ МПа?`,
      steps: ["$pV=\\dfrac{m}{M}RT$, $M(O_2)=0{,}032$ кг/моль.", `$V=\\dfrac{mRT}{Mp}=\\dfrac{${f(m)}\\cdot8{,}31\\cdot${tc + 273}}{0{,}032\\cdot${f(p)}\\cdot10^6}$.`], answer: V, unit: "м³" } } },
  phys_isochoric: { s: "phys", t: "Ізохорний процес", f() {
    const Q = R(300, 1500, 1);
    return { text: `У ізохорному процесі газу передали $Q=${Q}$ Дж теплоти. Знайти зміну внутрішньої енергії $\\Delta U$ і роботу газу $A$.`,
      steps: ["При $V=\\text{const}$ газ роботи не виконує: $A=0$.", `I закон ТД: $Q=\\Delta U+A$ ⇒ $\\Delta U=Q=${Q}$ Дж.`], answer: Q, unit: "Дж (ΔU)" } } },
  phys_work: { s: "phys", t: "Робота і кінетична енергія", f() {
    const m = R(1, 5, 0.5), v1 = R(1, 4, 1), v2 = v1 + R(2, 6, 1), A = m * (v2 * v2 - v1 * v1) / 2;
    return { text: `Яку роботу треба виконати, щоб розігнати тіло масою $${f(m)}$ кг від $${v1}$ до $${v2}$ м/с?`,
      steps: ["Теорема про кінетичну енергію: $A=\\Delta E_k$.", `$A=\\dfrac{m(v_2^2-v_1^2)}{2}=\\dfrac{${f(m)}(${v2}^2-${v1}^2)}{2}$.`], answer: A, unit: "Дж" } } },
  phys_angle: { s: "phys", t: "Кидок під кутом до горизонту", f() {
    const v = R(8, 25, 1), a = pick([30, 40, 45, 50, 60]), h = (v * Math.sin(a * Math.PI / 180)) ** 2 / (2 * g);
    return { text: `Тіло кинули зі швидкістю $${v}$ м/с під кутом $${a}°$ до горизонту. Знайти максимальну висоту підйому.`,
      steps: ["Вертикальна складова $v_y=v\\sin\\alpha$; у верхній точці $v_y=0$.", "$h_{max}=\\dfrac{v^2\\sin^2\\alpha}{2g}$."], answer: h, unit: "м" } } },
  phys_entropy: { s: "phys", t: "Зміна ентропії при нагріванні й плавленні", f() {
    const m = R(0.2, 1, 0.1), T0 = R(280, 320, 10), c = 460, Tm = 1812, lam = 2.7e5, dS = m * c * Math.log(Tm / T0) + m * lam / Tm;
    return { text: `Залізо масою $${f(m)}$ кг при $T_0=${T0}$ К нагріли до температури плавлення і розплавили. Знайти $\\Delta S$. ($c=460$ Дж/(кг·К), $T_{пл}=1812$ К, $\\lambda=2{,}7\\cdot10^5$ Дж/кг)`,
      steps: ["Нагрівання: $\\Delta S_1=mc\\ln\\dfrac{T_{пл}}{T_0}$.", "Плавлення: $\\Delta S_2=\\dfrac{\\lambda m}{T_{пл}}$.", `$\\Delta S_1=${f(m * c * Math.log(Tm / T0), 1)}$, $\\Delta S_2=${f(m * lam / Tm, 1)}$ Дж/К.`], answer: dS, unit: "Дж/К" } } },
  phys_barometric: { s: "phys", t: "Барометрична формула", f() {
    const gas = pick([["повітря", 0.029], ["водню", 0.002], ["азоту", 0.028]]), k = pick([2, 3, 1.5]), T = 273, h = Rg * T * Math.log(k) / (gas[1] * g);
    return { text: `На якій висоті густина ${gas[0]} у $${f(k)}$ раза менша, ніж на рівні моря? $T=273$ К.`,
      steps: ["$\\rho=\\rho_0\\,e^{-Mgh/(RT)}$.", `$\\dfrac{\\rho_0}{\\rho}=${f(k)}$ ⇒ $h=\\dfrac{RT\\ln ${f(k)}}{Mg}$, $M=${gas[1]}$ кг/моль.`], answer: h, unit: "м" } } },
  phys_atwood: { s: "phys", t: "Машина Атвуда", f() {
    const m1 = R(1.5, 5, 0.5), m2 = R(0.5, m1 - 0.5, 0.5), a = (m1 - m2) * g / (m1 + m2), T = 2 * m1 * m2 * g / (m1 + m2);
    return { text: `На нитці через блок висять вантажі $m_1=${f(m1)}$ кг і $m_2=${f(m2)}$ кг. Знайти прискорення вантажів (блок і нитка невагомі).`,
      steps: ["Для кожного вантажу II закон Ньютона: $m_1a=m_1g-T$, $m_2a=T-m_2g$.", "Додаємо: $a=\\dfrac{(m_1-m_2)g}{m_1+m_2}$.", `Сила натягу $T=\\dfrac{2m_1m_2g}{m_1+m_2}=${f(T)}$ Н.`], answer: a, unit: "м/с²" } } },
  phys_steiner: { s: "phys", t: "Момент інерції, теорема Штайнера", f() {
    const m = R(1, 5, 0.5), R0 = R(0.2, 1, 0.1), J = 1.5 * m * R0 * R0;
    return { text: `Знайти момент інерції однорідного диска масою $${f(m)}$ кг і радіусом $${f(R0)}$ м відносно осі, що проходить через край диска перпендикулярно до його площини.`,
      steps: ["Відносно центра $J_c=\\dfrac{mR^2}{2}$.", "Штайнер: $J=J_c+md^2$, $d=R$.", "$J=\\dfrac{3}{2}mR^2$."], answer: J, unit: "кг·м²" } } },
  chem_faraday: { s: "chem", t: "Закони Фарадея (електроліз)", f() {
    const [name, M, n] = pick([["CuSO₄ (на катоді Cu)", 63.55, 2], ["AgNO₃ (на катоді Ag)", 107.87, 1], ["NiSO₄ (на катоді Ni)", 58.69, 2], ["FeSO₄ (на катоді Fe)", 55.85, 2], ["ZnCl₂ (на катоді Zn)", 65.38, 2]]),
      I = R(1, 10, 1), tm = R(20, 120, 10), m = M / n * I * tm * 60 / 96485;
    return { text: `Через розчин ${name} пропускали струм $I=${I}$ А протягом $${tm}$ хв. Яка маса металу виділилась на катоді (вихід 100 %)?`,
      steps: [`$Q=It=${I}\\cdot${tm * 60}=${I * tm * 60}$ Кл.`, `$M_{екв}=M/n=${M}/${n}=${f(M / n, 2)}$ г/моль.`, "$m=\\dfrac{M_{екв}It}{F}$, $F=96485$ Кл/моль."], answer: m, unit: "г" } } },
  chem_neutral: { s: "chem", t: "Теплота нейтралізації", f() {
    const V = 50, dt = R(5, 8, 0.1), Q = 4.18 * 2 * V * dt / 1000, n = 1 * V / 1000, H = -Q / n;
    return { text: `Змішали по $${V}$ мл 1 М розчинів HCl і NaOH (густина 1 г/мл, $c=4{,}18$ Дж/(г·К)). Температура зросла на $${f(dt)}$ К. Знайти $\\Delta H$ нейтралізації (теплоємністю калориметра знехтувати).`,
      steps: [`$Q=c\\,m\\,\\Delta t=4{,}18\\cdot${2 * V}\\cdot${f(dt)}=${f(Q * 1000, 0)}$ Дж.`, `$n(H_2O)=C\\cdot V=1\\cdot0{,}05=0{,}05$ моль.`, "$\\Delta H=-Q/n$ (кДж/моль). Теоретично ≈ −57,3."], answer: H, unit: "кДж/моль" } } },
  chem_ph: { s: "chem", t: "pH розчинів сильних кислот і лугів", f() {
    const acid = Math.random() < 0.5, C = pick([0.1, 0.05, 0.01, 0.002, 0.005, 0.02]), what = acid ? pick([["HCl", 1], ["HNO₃", 1], ["H₂SO₄", 2]]) : pick([["NaOH", 1], ["KOH", 1], ["Ba(OH)₂", 2]]),
      c = C * what[1], pH = acid ? -Math.log10(c) : 14 + Math.log10(c);
    return { text: `Обчислити pH розчину ${what[0]} з концентрацією $${f(C)}$ моль/л (повна дисоціація).`,
      steps: [acid ? `$[H^+]=${what[1]}\\cdot${f(C)}=${f(c)}$ моль/л.` : `$[OH^-]=${what[1]}\\cdot${f(C)}=${f(c)}$ моль/л.`, acid ? "$pH=-\\lg[H^+]$." : "$pOH=-\\lg[OH^-]$, $pH=14-pOH$."], answer: pH, unit: "" } } },
  chem_equiv: { s: "chem", t: "Молярна маса еквівалента", f() {
    const [sub, M, z, why] = pick([["H₂SO₄ (повна нейтралізація)", 98.08, 2, "основність 2"], ["Al₂(SO₄)₃", 342.15, 6, "2·Al³⁺ → 6"], ["Ca(OH)₂", 74.09, 2, "кислотність 2"], ["KMnO₄ у кислому середовищі", 158.03, 5, "Mn⁺⁷ → Mn⁺² (5e⁻)"], ["K₂Cr₂O₇ у кислому середовищі", 294.18, 6, "2Cr⁺⁶ → 2Cr⁺³ (6e⁻)"], ["Fe₂(SO₄)₃", 399.88, 6, "2·Fe³⁺ → 6"]]);
    return { text: `Обчислити молярну масу еквівалента ${sub}.`, steps: [`$M=${M}$ г/моль.`, `Число еквівалентності $z=${z}$ (${why}).`, "$M_{екв}=M/z$."], answer: M / z, unit: "г/моль" } } },
  chem_precip: { s: "chem", t: "Маса осаду (стехіометрія)", f() {
    const ms = R(100, 300, 10), w = R(4, 12, 1), mN = ms * w / 100, n = mN / 40, m = n / 2 * 97.56;
    return { text: `До розчину CuCl₂ додали $${ms}$ г розчину NaOH з масовою часткою $${w}$ %. Яка маса осаду Cu(OH)₂ утворилась (CuCl₂ у надлишку)?`,
      steps: ["$CuCl_2+2NaOH=Cu(OH)_2\\downarrow+2NaCl$.", `$m(NaOH)=${ms}\\cdot${f(w / 100, 2)}=${f(mN)}$ г; $n=${f(mN)}/40=${f(n)}$ моль.`, `$n(Cu(OH)_2)=n(NaOH)/2$; $M(Cu(OH)_2)=97{,}56$ г/моль.`], answer: m, unit: "г" } } },
  chem_emf: { s: "chem", t: "ЕРС гальванічного елемента (Нернст)", f() {
    const pair = pick([["Zn", -0.76, "Cu", 0.34], ["Zn", -0.76, "Ag", 0.80], ["Fe", -0.44, "Cu", 0.34], ["Mg", -2.37, "Zn", -0.76], ["Ni", -0.25, "Cu", 0.34]]),
      [a, Ea, k, Ek] = pair, Ca = pick([1, 0.1, 0.01, 0.001]), Ck = pick([1, 0.1, 0.01]), na = a === "Ag" ? 1 : 2, nk = k === "Ag" ? 1 : 2,
      E1 = Ea + 0.059 / na * Math.log10(Ca), E2 = Ek + 0.059 / nk * Math.log10(Ck);
    return { text: `Скласти схему гальванічного елемента ${a} | ${a}ⁿ⁺ ($${Ca}$ М) ‖ ${k}ⁿ⁺ ($${Ck}$ М) | ${k} і обчислити ЕРС.`,
      steps: [`Анод — ${a} ($E^0=${Ea}$ В), катод — ${k} ($E^0=${Ek}$ В).`, `Нернст: $E=E^0+\\dfrac{0{,}059}{n}\\lg C$: $E_a=${f(E1)}$, $E_k=${f(E2)}$ В.`, "ЕРС $=E_k-E_a$."], answer: E2 - E1, unit: "В" } } },
  math_det: { s: "math", t: "Визначник 3×3", f() {
    const A = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => R(-5, 5, 1)));
    const d = A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) - A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) + A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]);
    const M = "\\begin{vmatrix}" + A.map(r => r.join("&")).join("\\\\") + "\\end{vmatrix}";
    return { text: `Обчислити визначник $${M}$.`, steps: ["Розклад за першим рядком: $\\Delta=a_{11}A_{11}+a_{12}A_{12}+a_{13}A_{13}$.", `$A_{11}=${A[1][1] * A[2][2] - A[1][2] * A[2][1]}$, $A_{12}=${-(A[1][0] * A[2][2] - A[1][2] * A[2][0])}$, $A_{13}=${A[1][0] * A[2][1] - A[1][1] * A[2][0]}$.`], answer: d, unit: "" } } },
  math_angle: { s: "math", t: "Кут між векторами", f() {
    const a = [R(-4, 4, 1), R(-4, 4, 1), R(1, 4, 1)], b = [R(-4, 4, 1), R(1, 4, 1), R(-4, 4, 1)], dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
      la = Math.hypot(...a), lb = Math.hypot(...b), cos = dot / (la * lb);
    return { text: `Знайти косинус кута між векторами $\\vec a=(${a.join(";")})$ і $\\vec b=(${b.join(";")})$.`,
      steps: [`$(\\vec a,\\vec b)=${dot}$.`, `$|\\vec a|=\\sqrt{${a[0] ** 2 + a[1] ** 2 + a[2] ** 2}}$, $|\\vec b|=\\sqrt{${b[0] ** 2 + b[1] ** 2 + b[2] ** 2}}$.`, "$\\cos\\varphi=\\dfrac{(\\vec a,\\vec b)}{|\\vec a||\\vec b|}$."], answer: cos, unit: "" } } },
  math_plane: { s: "math", t: "Відстань від точки до площини", f() {
    const A = R(-4, 4, 1) || 1, B = R(-4, 4, 1) || 2, C = R(1, 4, 1), D = R(-9, 9, 1), P = [R(-5, 5, 1), R(-5, 5, 1), R(-5, 5, 1)], d = Math.abs(A * P[0] + B * P[1] + C * P[2] + D) / Math.hypot(A, B, C);
    return { text: `Знайти відстань від точки $M(${P.join(";")})$ до площини $${A}x${B < 0 ? "" : "+"}${B}y+${C}z${D < 0 ? "" : "+"}${D}=0$.`,
      steps: ["$d=\\dfrac{|Ax_0+By_0+Cz_0+D|}{\\sqrt{A^2+B^2+C^2}}$.", `Чисельник: $|${A * P[0] + B * P[1] + C * P[2] + D}|$, знаменник $\\sqrt{${A * A + B * B + C * C}}$.`], answer: d, unit: "" } } },
};
// десяткова кома у формулах KaTeX: 0,02 → 0{,}02 (інакше з'являється пробіл)
const mc = str => String(str).replace(/\$([^$]+)\$/g, (m, e) => "$" + e.replace(/(\d),(\d)/g, "$1{,}$2") + "$");
function genRun(id) { const p = GEN[id].f(); return { id, ...p, text: mc(p.text), steps: p.steps.map(mc) } }
const PHYS_MATCH = [[/горизонтально/i, "phys_throw"], [/Карно/i, "phys_carnot"], [/Похила/i, "phys_incline"], [/візк/i, "phys_carts"], [/пари/i, "phys_vapor"], [/балон/i, "phys_cylinder"], [/Ізохорн/i, "phys_isochoric"], [/розігнати|Підняли/i, "phys_work"], [/під кутом/i, "phys_angle"], [/ΔS|ентроп/i, "phys_entropy"], [/густина|Густина/, "phys_barometric"], [/Атвуда/i, "phys_atwood"]];

/* ---------- вкладка «Іспит» ---------- */
function examTab() {
  const views = [["ticket", "Білет"], ["problems", "Задачі"], ["weak", "Слабкі теми"], ["plan", "План"]];
  $("#main").innerHTML = `<div class="filters" role="tablist">${views.map(([k, v]) => `<button class="btn ${k === exView ? "" : "ghost"}" onclick="exView='${k}';examTab()">${v}</button>`).join("")}</div><div id="exam-body"></div>`;
  ({ ticket: exTicketView, problems: exProblemsView, weak: exWeakView, plan: exPlanView })[exView]();
}
async function exLoadTickets() { if (!exTickets) exTickets = await api("/api/tickets"); return exTickets }
async function exLoadCards(subj) { if (!exCards[subj]) exCards[subj] = await api("/api/cards?subject=" + subj); return exCards[subj] }
function exBody(html) { const b = $("#exam-body"); b.innerHTML = html; renderMath(b) }

async function exTicketView() {
  const T = await exLoadTickets();
  if (exRun) return exDrawRun();
  const t = T[exSubj];
  exBody(`<div class="card"><div class="filters"><select onchange="exSubj=this.value;exTicketView()">${Object.keys(T).map(k => `<option value="${k}" ${k === exSubj ? "selected" : ""}>${esc(subjectName(k))}</option>`).join("")}</select></div>
   <h2>${esc(t.title)}</h2><p class="mut">Формат: ${esc(t.format)} · таймер ${t.minutes} хв${t.official ? "" : " · ⚠️ навчальні, справжніх білетів з цього предмета ще немає"}</p>
   <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" onclick="exStart()">Випадковий білет</button>
   <select id="ex-num" style="width:auto">${t.tickets.map(x => `<option value="${x.n}">Білет ${x.n}</option>`).join("")}</select><button class="btn ghost" onclick="exStart(+$('#ex-num').value)">Відкрити</button></div></div>
   ${exHistory()}`);
}
function exHistory() {
  const att = (S.grades || []).filter(x => x.kind === "пробний білет" && x.subject === exSubj).slice(-6).reverse();
  return att.length ? `<div class="card"><h2>Попередні спроби</h2>${att.map(a => `<div class="row"><div class="t">${esc(a.title)} · ${esc(a.date)}</div><b>${f(a.points, 1)} / ${f(a.max, 0)}</b></div>`).join("")}</div>` : "";
}
function exStart(n) {
  const t = exTickets[exSubj], tk = n ? t.tickets.find(x => x.n === n) : pick(t.tickets);
  const gens = (tk.gen || []).map(genRun);
  exRun = { subj: exSubj, n: tk.n, theory: tk.theory, tasks: tk.tasks, gens, until: Date.now() + t.minutes * 60000, done: false, open: {} };
  exDrawRun(); clearInterval(exTimer); exTimer = setInterval(exTick, 1000);
}
function exTick() {
  if (!exRun || exRun.done) return clearInterval(exTimer);
  const s = Math.ceil((exRun.until - Date.now()) / 1000), el = $("#ex-clock");
  if (s <= 0) { exFinish(); return }
  if (el) el.textContent = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}
function exDrawRun() {
  const r = exRun, phys = r.subj === "phys";
  const items = [...r.theory.map((q, i) => ({ kind: "Теорія", text: q, max: phys ? 10 : 10, key: "t" + i })),
    ...r.tasks.map((q, i) => ({ kind: "Задача", text: q, max: 15, key: "z" + i })),
    ...r.gens.map((p, i) => ({ kind: "Задача", text: p.text, max: 15, key: "g" + i, gen: p }))];
  r.items = items;
  exBody(`<div class="card"><div class="mut">${esc(subjectName(r.subj))} · білет ${r.n} ${r.done ? "· завершено" : `· залишилось <b id="ex-clock"></b>`}</div>
   ${items.map((it, i) => `<div class="row"><div class="t"><b>${i + 1}. ${it.kind}</b><div>${fmt(it.text)}</div>${r.done ? exCheck(it) : ""}</div>${r.done ? `<label class="mut">бали<input type="number" min="0" max="${it.max}" step="0.5" style="width:70px" id="pts-${it.key}"> / ${it.max}</label>` : ""}</div>`).join("")}
   <div style="display:flex;gap:8px;margin-top:10px">${r.done ? `<button class="btn" onclick="exSave()">Зберегти результат</button>` : `<button class="btn" onclick="exFinish()">Завершити й перевірити</button>`}<button class="btn ghost" onclick="exRun=null;clearInterval(exTimer);exTicketView()">Вийти</button></div></div>`);
  exTick();
}
function exFinish() { exRun.done = true; clearInterval(exTimer); exLoadCards(exRun.subj).then(exDrawRun) }
function exRelated(text, subj) {
  const words = new Set(text.toLowerCase().match(/[a-zа-яіїєґ0-9]{4,}/giu) || []);
  return (exCards[subj] || []).map(c => { const w = (questionText(c) + " " + c.q).toLowerCase().match(/[a-zа-яіїєґ0-9]{4,}/giu) || []; return [w.filter(x => words.has(x)).length, c] })
    .filter(([n]) => n > 0).sort((a, b) => b[0] - a[0]).slice(0, 3).map(([, c]) => c);
}
function exCheck(it) {
  if (it.gen) return `<details><summary>Розв'язок</summary>${it.gen.steps.map(s => `<div>${fmt(s)}</div>`).join("")}<div><b>Відповідь: ${f(it.gen.answer)} ${esc(it.gen.unit)}</b></div></details>`;
  if (it.kind === "Задача") { const m = PHYS_MATCH.find(([re]) => re.test(it.text)); if (!m) return ""; const p = genRun(m[1]);
    return `<details><summary>Схожа задача з розв'язком</summary><div>${fmt(p.text)}</div>${p.steps.map(s => `<div>${fmt(s)}</div>`).join("")}<div><b>Відповідь: ${f(p.answer)} ${esc(p.unit)}</b></div></details>` }
  const rel = exRelated(it.text, exRun.subj);
  return rel.length ? `<details><summary>Звір з картками (${rel.length})</summary>${rel.map(c => `<div class="card"><b>${fmt(questionText(c))}</b><div>${answerMarkup(c)}</div></div>`).join("")}</details>` : `<div class="mut">Карток на цю тему ще немає — звір із конспектом.</div>`;
}
async function exSave() {
  const r = exRun; let pts = 0, max = 0;
  for (const it of r.items) { pts += Math.min(it.max, +($("#pts-" + it.key)?.value || 0)); max += it.max }
  await api("/api/grades", { method: "POST", body: { subject: r.subj, title: "Білет " + r.n, kind: "пробний білет", points: pts, max, date: S.today } });
  exRun = null; S = await api("/api/state"); exTicketView();
}

function exProblemsView() {
  const gens = Object.entries(GEN).filter(([, v]) => v.s === exProbSubj);
  if (exProbGen && !GEN[exProbGen]) exProbGen = "";
  const p = exProb;
  exBody(`<div class="card"><div class="filters"><select onchange="exProbSubj=this.value;exProbGen='';exProb=null;exProblemsView()">${["phys", "chem", "math"].map(k => `<option value="${k}" ${k === exProbSubj ? "selected" : ""}>${esc(subjectName(k))}</option>`).join("")}</select>
   <select onchange="exProbGen=this.value"><option value="">будь-яка тема</option>${gens.map(([k, v]) => `<option value="${k}" ${k === exProbGen ? "selected" : ""}>${esc(v.t)}</option>`).join("")}</select>
   <button class="btn" onclick="exNewProblem()">Нова задача</button></div><p class="mut">Числа щоразу нові. Розв'яжи, введи відповідь — перевірка з точністю 2 %. Підказки відкриваються по кроку.</p></div>
   ${p ? `<div class="card"><div class="mut">${esc(GEN[p.id].t)}</div><h2>${fmt(p.text)}</h2>
   <div style="display:flex;gap:8px;align-items:center"><input id="ex-ans" inputmode="decimal" placeholder="відповідь${p.unit ? ", " + esc(p.unit) : ""}" style="max-width:220px" onkeydown="if(event.key==='Enter')exAnswer()"><button class="btn" style="white-space:nowrap" onclick="exAnswer()">Перевірити</button></div>
   <div id="ex-res" role="status" style="margin-top:8px"></div>
   ${p.steps.slice(0, p.shown).map((s, i) => `<div>Крок ${i + 1}: ${fmt(s)}</div>`).join("")}
   ${p.shown < p.steps.length ? `<button class="btn ghost" onclick="exProb.shown++;exProblemsView()">Підказка (крок ${p.shown + 1})</button>` : `<div><b>Відповідь: ${f(p.answer)} ${esc(p.unit)}</b></div>`}</div>` : ""}`);
}
function exNewProblem() { const ids = Object.keys(GEN).filter(k => GEN[k].s === exProbSubj), id = exProbGen || pick(ids); exProb = { shown: 0, ...genRun(id) }; exProblemsView() }
function exAnswer() {
  const v = parseFloat(String($("#ex-ans").value).replace(",", ".").replace(/\s/g, "")), a = exProb.answer;
  const ok = isFinite(v) && (Math.abs(v - a) <= Math.max(0.02 * Math.abs(a), 1e-9) || Math.abs(a) < 1e-6 && Math.abs(v) < 1e-6);
  $("#ex-res").innerHTML = isFinite(v) ? (ok ? "✅ Правильно" : `❌ Не збігається. Подивись підказки.`) : "Введи число.";
}

async function exWeakView() {
  exBody(`<div class="card mut">Рахуємо…</div>`);
  exWeak = await api("/api/weak?days=21");
  exBody(`<div class="card"><h2>Слабкі теми за 3 тижні</h2><p class="mut">Частка помилок у відповідях по темах (мінімум 2 відповіді). Натисни «Тренувати» — відкриється практика з цією темою.</p>
   ${exWeak.length ? exWeak.slice(0, 25).map(w => `<div class="row"><div class="t"><b>${esc(w.theme)}</b><div class="mut">${esc(subjectName(w.subject))} · помилок ${w.wrong} з ${w.answers} · вивчено карток ${w.learned}/${w.cards}</div>
     <div class="bar"><i style="width:${Math.round(w.rate * 100)}%;background:var(--bad)"></i></div></div><button class="btn ghost" onclick='exTrain(${JSON.stringify(w.subject)},${JSON.stringify(w.theme)})'>Тренувати</button></div>`).join("")
     : `<div class="mut">Поки немає помилок — пройди кілька підходів у «Практиці» або «Картках».</div>`}</div>`);
}
async function exTrain(subj, th) {
  if (!library.length) library = await api("/api/cards");
  selected = subj; topic = th; setTab("practice"); beginPractice("all");
}

async function exPlanView() {
  const examSubj = S.subjects.filter(s => s.form === "Е"), start = S.meta.session_start;
  const all = await api("/api/cards"), wk = await api("/api/weak?days=30"), rate = {};
  wk.forEach(w => rate[w.subject + "|" + w.theme] = w.rate);
  const th = c => c.q.includes(" — ") ? c.q.split(" — ")[0] : (c.subject === "hist" && c.q.includes(":") ? c.q.split(":")[0] : "Загальні питання");
  let todayList = [], blocks = "";
  examSubj.forEach((s, i) => {
    const date = s.exam_date || new Date(new Date(start).getTime() + i * 7 * 864e5).toISOString().slice(0, 10), assumed = !s.exam_date;
    const left = Math.max(1, days(date) - 1);
    const groups = {}; all.filter(c => c.subject === s.key).forEach(c => { const k = th(c); (groups[k] ||= []).push(c) });
    const topics = Object.entries(groups).map(([k, cs]) => ({ k, total: cs.length, open: cs.filter(c => c.box < 4).length, r: rate[s.key + "|" + k] || 0 }))
      .filter(t => t.open).sort((a, b) => b.r - a.r || b.open - a.open);
    const perDay = Math.max(1, Math.ceil(topics.length / left)), openCards = topics.reduce((a, t) => a + t.open, 0), cardsDay = Math.ceil(openCards / left);
    const today = topics.slice(0, perDay); todayList.push(...today.map(t => ({ s, ...t })));
    const sched = []; for (let d = 0; d < Math.min(7, left); d++) { const part = topics.slice(d * perDay, (d + 1) * perDay); if (part.length) sched.push(part) }
    blocks += `<div class="card subj" style="--c:${s.color}"><h3>${esc(s.name)}</h3><div class="mut">іспит ${date.split("-").reverse().join(".")}${assumed ? " (орієнтовно — дату ще не оголосили)" : ""} · ${days(date)} дн. · тем не вивчено: ${topics.length} (${openCards} карток) · ≈ ${perDay} тем / ${cardsDay} карток на день, останній день — повторення</div>
     <details><summary>Найближчий тиждень</summary>${sched.map((p, d) => `<div><b>${d === 0 ? "Сьогодні" : "+" + d + " дн."}:</b> ${p.map(t => esc(t.k)).join(", ")}</div>`).join("") || "<div class='mut'>усе вивчено</div>"}</details></div>`;
  });
  exBody(`<div class="card"><h2>Сьогодні за планом</h2>${todayList.length ? todayList.map(t => `<div class="row"><div class="t"><b>${esc(t.k)}</b><div class="mut">${esc(t.s.name)} · не вивчено ${t.open} з ${t.total}${t.r ? ` · помилок ${Math.round(t.r * 100)} %` : ""}</div></div><button class="btn ghost" onclick='exTrain(${JSON.stringify(t.s.key)},${JSON.stringify(t.k)})'>Вчити</button></div>`).join("") : "<div class='mut'>Нічого — усе вивчено 🎉</div>"}
   <p class="mut">Теми з помилками йдуть першими. Тема вважається вивченою, коли всі її картки в коробці 4+. Дати іспитів внеси у «Предмети» — план перерахується.</p></div>${blocks}`);
}

/* ---------- вкладка «Облік» ---------- */
const exScale = s => { try { return JSON.parse(S.meta["scale_" + s.key]) } catch { return s.form === "Е" ? { current: 50, exam: 50 } : { current: 100, exam: 0 } } };
function recordTab() {
  const G = (S.grades || []).filter(x => x.kind !== "пробний білет"), A = S.absences || [], subs = S.subjects.filter(s => s.key !== "new");
  const rows = subs.map(s => {
    const g = G.filter(x => x.subject === s.key), pts = g.reduce((a, x) => a + (+x.points || 0), 0), max = g.reduce((a, x) => a + (+x.max || 0), 0), sc = exScale(s);
    const cur = max ? pts / max * sc.current : null;
    const need = t => cur == null || !sc.exam ? "" : (t - cur <= 0 ? "вже є" : t - cur > sc.exam ? "недосяжно" : f(t - cur, 1));
    return `<div class="card subj" style="--c:${s.color}"><h3>${esc(s.name)}</h3>
     <div class="mut">шкала: поточний контроль ${sc.current}${sc.exam ? ` + іспит ${sc.exam}` : ""} <a href="#" onclick="exSetScale('${s.key}');return false">змінити</a></div>
     ${cur == null ? `<div class="mut">оцінок ще немає</div>` : `<div><b>Поточні: ${f(cur, 1)} з ${sc.current}</b> (${f(pts, 1)}/${f(max, 1)} балів, ${Math.round(pts / max * 100)} %)</div>
     ${sc.exam ? `<div>На іспиті треба: на «добре» (71) — <b>${need(71)}</b>, на «відмінно» (88) — <b>${need(88)}</b> з ${sc.exam}</div>` : `<div>Прогноз підсумку: <b>${f(cur, 0)}</b> / 100</div>`}`}
     <details><summary>Оцінки (${g.length})</summary>${g.map(x => `<div class="row"><div class="t">${esc(x.date || "")} · ${esc(x.title)} <span class="mut">${esc(x.note || "")}</span></div><b>${f(+x.points, 1)}/${f(+x.max, 1)}</b><button class="x" onclick="exDel('grades',${x.id})">✕</button></div>`).join("")}</details></div>`;
  }).join("");
  const nextA = { todo: "ready", ready: "done", done: "todo" }, lblA = { todo: "не відпрацьовано", ready: "готово до здачі", done: "відпрацьовано" };
  $("#main").innerHTML = `<div class="card"><h2>Додати оцінку</h2><div class="form"><select id="gs">${subs.map(s => `<option value="${s.key}">${esc(s.name)}</option>`).join("")}</select>
    <input id="gt" placeholder="за що (лаба 5, к.р., семінар…)"><input id="gp" type="number" step="0.5" placeholder="бали"><input id="gm" type="number" step="0.5" placeholder="з максимуму (напр. 5)">
    <input id="gd" type="date" value="${S.today}"><input id="gn" placeholder="примітка"><div class="w"><button class="btn" onclick="exAddGrade()">Додати</button></div></div></div>
   <div class="grid">${rows}</div>
   <div class="card"><h2>Відпрацювання (н-ки)</h2>${A.length ? A.map(a => `<div class="row"><div class="t"><b>${esc(a.date.split("-").reverse().join("."))} · ${esc(subjectName(a.subject))}</b><div class="mut">${esc(a.topic)} ${a.note ? "· " + esc(a.note) : ""} ${a.file ? `<a href="/files/${encodeURI(a.file)}" target="_blank">файл</a>` : ""}</div></div>
     <button class="st ${a.status === "done" ? "submitted" : a.status}" onclick="exAbs(${a.id},'${nextA[a.status] || "todo"}')">${lblA[a.status] || a.status}</button><button class="x" onclick="exDel('absences',${a.id})">✕</button></div>`).join("") : "<div class='mut'>н-ок немає</div>"}
    <div class="form" style="margin-top:10px"><select id="as">${subs.map(s => `<option value="${s.key}">${esc(s.name)}</option>`).join("")}</select><input id="ad" type="date"><input class="w" id="at" placeholder="тема пари / що відпрацювати"><input class="w" id="af" placeholder="файл (шлях від Desktop, необов'язково)"><div class="w"><button class="btn" onclick="exAddAbs()">Додати н-ку</button></div></div></div>`;
}
async function exReload() { S = await api("/api/state"); render() }
async function exAddGrade() { const b = { subject: $("#gs").value, title: $("#gt").value.trim(), kind: "оцінка", points: +$("#gp").value, max: +$("#gm").value, date: $("#gd").value, note: $("#gn").value };
  if (!b.title || !b.max) return alert("Вкажи, за що оцінка, і максимум."); await api("/api/grades", { method: "POST", body: b }); exReload() }
async function exAddAbs() { const b = { subject: $("#as").value, date: $("#ad").value, topic: $("#at").value.trim(), file: $("#af").value.trim(), status: "todo" };
  if (!b.date || !b.topic) return alert("Вкажи дату і тему."); await api("/api/absences", { method: "POST", body: b }); exReload() }
async function exAbs(id, st) { await api("/api/absences/" + id, { method: "PATCH", body: { status: st } }); exReload() }
async function exDel(t, id) { if (confirm("Видалити?")) { await api(`/api/${t}/${id}`, { method: "DELETE" }); exReload() } }
async function exSetScale(k) {
  const s = S.subjects.find(x => x.key === k), sc = exScale(s), v = prompt("Скільки балів дає поточний контроль і скільки іспит? Формат: 50/50 (для заліку 100/0)", sc.current + "/" + sc.exam);
  if (!v) return; const [c, e] = v.split("/").map(Number); if (!(c >= 0 && e >= 0)) return;
  await api("/api/meta", { method: "POST", body: { ["scale_" + k]: JSON.stringify({ current: c, exam: e }) } }); exReload();
}
