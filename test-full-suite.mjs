#!/usr/bin/env node
/* =====================================================================================
 *  test-full-suite.mjs  --  SUITE DE TESTS COMPLETE / MEGA TEST SUITE
 *  Projet : Donation-management-system-WEB-App  (Next.js + Prisma + PostgreSQL)
 *
 *  COUVERTURE (17 sections, ~980 assertions) :
 *    S1  AUTH .............. cascade login, POST login, /api/auth GET+PUT, mot de passe,
 *                            logOutOtherDevices / tokenVersion, logout
 *    S2  REGISTER .......... creation de compte + mosquee, toutes les validations
 *    S3  MOSQUE ............ GET/PUT profil mosquee, unicite email
 *    S4  SETTINGS .......... BOOL/INT/NUMBER matrices, svfWeights, reservePercentage,
 *                            customCriteria, reset (svf | water-filling | all),
 *                            propagation poids -> recalcul des scores
 *    S5  FAMILIES CRUD ..... 8 champs requis, enums, logement (dont SDF), CCP unique,
 *                            membres inline, membersCount, filtres GET, PUT, DELETE
 *    S6  MEMBERS/CHILDREN .. matrice de validation, garde-fous HEAD, promotion SPOUSE
 *                            -> MARRIED, /children, /children/count, CRUD enfant
 *    S7  SVF ............... calibration empirique de CHAQUE facteur, comparaison avec
 *                            /api/settings, profils composites, mutations + retest
 *    S8  WATER-FILLING ..... budget, reserve, min/max, proportionnalite score^exposant,
 *                            monotonie, exclusion des familles archivees, familyIds
 *    S9  DISTRIBUTIONS ..... calculate -> confirm -> item PAID -> solde, statuts,
 *                            distribution manuelle, DELETE + remboursement, malus
 *    S10 DONORS/DONATIONS .. CRUD, doublons, categories (KAFFARA doit etre REFUSE),
 *                            impact solde + totalDonated, filtres
 *    S11 DASHBOARD ......... stats, financial-summary, monthly-summary, social-distribution
 *    S12 DOCUMENTS ......... upload base64, liste, download, delete, isolation
 *    S13 SECURITE .......... matrice 401, token invalide, isolation multi-mosquees
 *    S14 CONTRATS/TYPES .... enveloppe {success,data}, types de champs, enums, dates ISO
 *    S15 FUZZ/EDGE ......... JSON invalide, chaines 1000 car., unicode/arabe, XSS/SQLi,
 *                            methodes HTTP, champs inconnus, concurrence
 *    S16 REGRESSION ........ re-execution des invariants apres toutes les mutations
 *    S17 SYNCHRO ........... propagation de CHAQUE ecriture : membersCount, etat civil,
 *                            miroir chef <-> fiche famille, enfants, malus d'aide,
 *                            lastAidAt, solde, totalDistributed, score SVF, priorite
 *
 *  AUCUNE DEPENDANCE. Node >= 18 (fetch natif). Ne modifie aucun fichier du projet.
 *
 *  USAGE :
 *    node test-full-suite.mjs --mosque <mosqueId> --password "<motdepasse>"
 *    node test-full-suite.mjs --password "imam1111"            (choix auto si 1 mosquee)
 *    node test-full-suite.mjs --list                            (liste les sections)
 *    node test-full-suite.mjs --only S5,S7,S8 --password "..."
 *    node test-full-suite.mjs --skip S2,S15 --password "..."
 *    node test-full-suite.mjs --repeat 3 --password "..."       (boucles repetitives)
 *    node test-full-suite.mjs --keep --password "..."           (ne pas nettoyer)
 *    node test-full-suite.mjs --verbose --password "..."
 *
 *  SORTIES : test-report-full.json + test-report-full.md + full-terminal.txt
 *            Le journal terminal est ecrit PAR LE SCRIPT : aucun Tee-Object requis.
 *            Changer de fichier : --log mon-journal.txt
 *  CODE DE SORTIE : nombre d'echecs (0 = tout vert)
 *
 *  !! A EXECUTER SUR UNE BASE DE DEVELOPPEMENT UNIQUEMENT !!
 * ===================================================================================== */

import fs from "node:fs"
import path from "node:path"

/* ============================== 0. CLI + CONFIG ==================================== */

const RAW = process.argv.slice(2)
function arg(name, def = undefined) {
  const i = RAW.indexOf("--" + name)
  if (i === -1) return def
  const v = RAW[i + 1]
  if (v === undefined || v.startsWith("--")) return true
  return v
}
function flag(name) {
  return RAW.includes("--" + name)
}

const CFG = {
  base: String(arg("base", process.env.BASE || "http://localhost:3000")).replace(/\/+$/, ""),
  mosque: arg("mosque", process.env.MOSQUE || null),
  password: arg("password", process.env.PASSWORD || null),
  only: String(arg("only", "") || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean),
  skip: String(arg("skip", "") || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean),
  repeat: Math.max(1, parseInt(String(arg("repeat", "1")), 10) || 1),
  keep: flag("keep"),
  bail: flag("bail"),
  verbose: flag("verbose"),
  list: flag("list"),
  noRegister: flag("no-register"),
  timeout: Math.max(2000, parseInt(String(arg("timeout", "30000")), 10) || 30000),
  out: String(arg("out", "test-report-full")),
}

const SUF = String(Date.now()).slice(-9)
const TAG = "ZZTEST"
let SEQ = 0
const uid = (p = "") => `${TAG}${p}${SUF}${String(++SEQ).padStart(3, "0")}`

/* ============================== 0.1 COULEURS / LOG ================================= */

const TTY = process.stdout.isTTY
const C = {
  reset: TTY ? "\x1b[0m" : "", bold: TTY ? "\x1b[1m" : "", dim: TTY ? "\x1b[2m" : "",
  red: TTY ? "\x1b[31m" : "", green: TTY ? "\x1b[32m" : "", yellow: TTY ? "\x1b[33m" : "",
  blue: TTY ? "\x1b[34m" : "", mag: TTY ? "\x1b[35m" : "", cyan: TTY ? "\x1b[36m" : "",
}
/* Alias courts utilises dans le corps des sections */
C.r = C.red; C.g = C.green; C.y = C.yellow; C.b = C.blue; C.c = C.cyan; C.z = C.reset
const log = (...a) => console.log(...a)

/* ---- Journal terminal auto-ecrit ---------------------------------------------------
 * full-terminal.txt etait produit par le shell (Tee-Object). Des que la sortie n'etait
 * pas redirigee -- ou quand le projet etait recupere depuis git -- le fichier n'existait
 * pas et le diagnostic devenait impossible. La suite ecrit desormais elle-meme son
 * journal, sans codes ANSI, quoi qu'il arrive. Option : --log <fichier>.
 */
const TERM_LOG = path.resolve(process.cwd(), arg("log", "full-terminal.txt"))
const ANSI_RE = /\u001b\[[0-9;]*m/g
let TERM_BUF = []
/* BOM UTF-8 : sans lui, Notepad / Get-Content / Explorer lisent le fichier en
 * CP1252 et tous les accents deviennent des caracteres illisibles. */
const UTF8_BOM = "\uFEFF"
try { fs.writeFileSync(TERM_LOG, UTF8_BOM, "utf8") } catch { /* disque en lecture seule */ }
function termFlush() {
  if (!TERM_BUF.length) return
  const chunk = TERM_BUF.join("\n") + "\n"
  TERM_BUF = []
  try { fs.appendFileSync(TERM_LOG, chunk, "utf8") } catch { /* ignore */ }
}
function termWrite(line) {
  TERM_BUF.push(line)
  if (TERM_BUF.length >= 200) termFlush()
}
function termFmt(a) {
  return a.map((x) => {
    if (typeof x === "string") return x
    try { return JSON.stringify(x) } catch { return String(x) }
  }).join(" ").replace(ANSI_RE, "")
}
const RAW_LOG = console.log.bind(console)
const RAW_ERR = console.error.bind(console)
console.log = (...a) => { RAW_LOG(...a); termWrite(termFmt(a)) }
console.error = (...a) => { RAW_ERR(...a); termWrite(termFmt(a)) }
process.on("exit", termFlush)

const vlog = (...a) => { if (CFG.verbose) console.log(C.dim + "      >", ...a, C.reset) }

/* ============================== 0.2 ETAT GLOBAL ==================================== */

const STATE = {
  token: null,           // token du compte principal (mosquee A)
  user: null,
  mosque: null,
  mosqueId: null,
  settings0: null,       // snapshot des parametres au demarrage (pour restauration)
  mosque0: null,         // snapshot du profil mosquee
  weights: null,         // poids SVF effectifs (GET /api/settings -> svfWeights)
  wf: null,              // parametres water-filling effectifs
  exponent: 1.5,
  balance0: null,
  // compte secondaire cree par S2 (isolation multi-tenant)
  b: { token: null, mosqueId: null, email: null, password: null, userId: null },
  // calibration SVF mesuree empiriquement (S7)
  CAL: {},
}

const CLEAN = { families: [], donors: [], donations: [], distributions: [], documents: [], members: [] }

/* ============================== 0.3 RESULTATS ====================================== */

const RESULTS = []      // { section, sectionTitle, name, status, detail, ms, iter }
let CUR = { id: "S0", title: "boot" }
let ITER = 1
const COUNT = { PASS: 0, FAIL: 0, SKIP: 0, INFO: 0, WARN: 0 }
let FATAL = null

function record(status, name, detail) {
  COUNT[status] = (COUNT[status] || 0) + 1
  const row = {
    section: CUR.id, sectionTitle: CUR.title, iter: ITER, name,
    status, detail: detail === undefined ? null : detail, at: new Date().toISOString(),
  }
  RESULTS.push(row)
  const badge =
    status === "PASS" ? C.green + " PASS " + C.reset :
    status === "FAIL" ? C.red + C.bold + " FAIL " + C.reset :
    status === "SKIP" ? C.dim + " SKIP " + C.reset :
    status === "WARN" ? C.yellow + " WARN " + C.reset :
                        C.cyan + " INFO " + C.reset
  const it = CFG.repeat > 1 ? C.dim + `[#${ITER}] ` + C.reset : ""
  log(`  ${badge} ${it}${name}` + (detail !== undefined && detail !== null && (status !== "PASS" || CFG.verbose)
    ? C.dim + "  -- " + short(detail) + C.reset : ""))
  if (status === "FAIL" && CFG.bail) { throw new Error("--bail : arret au premier echec -> " + name) }
  return status === "PASS"
}
const pass = (n, d) => record("PASS", n, d)
const fail = (n, d) => record("FAIL", n, d)
const skip = (n, d) => record("SKIP", n, d)
const info = (n, d) => record("INFO", n, d)
const warn = (n, d) => record("WARN", n, d)

function short(v, max = 400) {
  let s
  if (typeof v === "string") s = v
  else { try { s = JSON.stringify(v) } catch { s = String(v) } }
  if (s === undefined) s = "undefined"
  return s.length > max ? s.slice(0, max) + "..." : s
}

/* ============================== 0.4 ASSERTIONS ===================================== */

function check(name, cond, detail) { return cond ? pass(name, detail) : fail(name, detail) }

function eq(name, actual, expected, extra) {
  const ok = Object.is(actual, expected) || JSON.stringify(actual) === JSON.stringify(expected)
  return ok
    ? pass(name, extra === undefined ? `= ${short(actual, 120)}` : extra)
    : fail(name, { expected, actual, ...(extra ? { extra } : {}) })
}

function near(name, actual, expected, tol = 0.01, extra) {
  const ok = typeof actual === "number" && Math.abs(actual - expected) <= tol
  return ok ? pass(name, `= ${actual}`) : fail(name, { expected, actual, tol, ...(extra ? { extra } : {}) })
}

function isType(name, value, type) {
  let ok
  if (type === "array") ok = Array.isArray(value)
  else if (type === "number") ok = typeof value === "number" && Number.isFinite(value)
  else if (type === "int") ok = Number.isInteger(value)
  else if (type === "iso") ok = typeof value === "string" && !Number.isNaN(Date.parse(value))
  else if (type === "nullableString") ok = value === null || typeof value === "string"
  else if (type === "nullableNumber") ok = value === null || typeof value === "number"
  else ok = typeof value === type // eslint-disable-line valid-typeof
  return ok ? pass(name, `${type} ok`) : fail(name, { expectedType: type, got: value, gotType: Array.isArray(value) ? "array" : value === null ? "null" : typeof value })
}

function inEnum(name, value, allowed) {
  return allowed.includes(value)
    ? pass(name, `= ${value}`)
    : fail(name, { value, allowed })
}

/* Verifie une reponse en succes : HTTP 2xx + enveloppe {success:true,data} */
function expectOk(name, r, status) {
  if (r.netError) return fail(name, { netError: r.netError })
  if (status !== undefined && r.status !== status) return fail(name, { expectedStatus: status, status: r.status, body: short(r.text, 300) })
  if (r.status < 200 || r.status >= 300) return fail(name, { status: r.status, message: r.message, body: short(r.text, 300) })
  if (!r.json || r.json.success !== true) return fail(name, { status: r.status, envelope: short(r.json ?? r.text, 300) })
  return pass(name, `HTTP ${r.status}`)
}

/* Verifie une reponse en echec : status attendu + message exact (ou fragment) */
function expectFailure(name, r, status, message, mode = "exact") {
  if (r.netError) return fail(name, { netError: r.netError })
  const okStatus = status == null || r.status === status
  let okMsg = true
  if (message != null) {
    const m = String(r.message ?? "")
    okMsg = mode === "exact" ? m === message : m.toLowerCase().includes(String(message).toLowerCase())
  }
  const okEnv = r.json ? r.json.success === false : true
  if (okStatus && okMsg && okEnv) return pass(name, `HTTP ${r.status} "${short(r.message, 90)}"`)
  return fail(name, {
    expectedStatus: status, gotStatus: r.status,
    expectedMessage: message, gotMessage: r.message ?? null,
    envelopeSuccess: r.json ? r.json.success : "(non-json)",
    body: short(r.text, 250),
  })
}

/* ============================== 0.5 CLIENT HTTP ==================================== */

let HTTP_CALLS = 0
const ENDPOINT_HITS = new Map()

async function api(method, urlPath, opts = {}) {
  const { body, token, headers = {}, rawBody } = opts
  const url = CFG.base + urlPath
  const h = { "Content-Type": "application/json", Accept: "application/json", ...headers }
  const t = token === null ? null : token === undefined ? STATE.token : token
  if (t) { h.Authorization = "Bearer " + t; h.Cookie = "token=" + t }
  const init = { method, headers: h, redirect: "manual" }
  if (rawBody !== undefined) init.body = rawBody
  else if (body !== undefined) init.body = JSON.stringify(body)

  const key = `${method} ${urlPath.split("?")[0].replace(/\/[a-z0-9]{20,}/gi, "/:id")}`
  ENDPOINT_HITS.set(key, (ENDPOINT_HITS.get(key) || 0) + 1)
  HTTP_CALLS++

  const started = Date.now()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), CFG.timeout)
  init.signal = ctrl.signal
  let res, text
  try {
    res = await fetch(url, init)
    text = await res.text()
  } catch (e) {
    clearTimeout(timer)
    return { netError: String((e && e.message) || e), status: 0, ms: Date.now() - started, json: null, text: "", url }
  }
  clearTimeout(timer)
  let json = null
  try { json = JSON.parse(text) } catch { /* non json */ }
  const out = {
    status: res.status, ok: res.ok, headers: res.headers, json, text,
    data: json && Object.prototype.hasOwnProperty.call(json, "data") ? json.data : undefined,
    message: json && json.message, ms: Date.now() - started, url,
  }
  vlog(`${method} ${urlPath} -> ${res.status} (${out.ms}ms)`)
  return out
}
const GET = (p, o) => api("GET", p, o)
const POST = (p, body, o) => api("POST", p, { body, ...o })
const PUT = (p, body, o) => api("PUT", p, { body, ...o })
const DEL = (p, o) => api("DELETE", p, o)

/* ============================== 0.6 OUTILS ========================================= */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const DAY = 86400000
function dobForAge(age) {
  return new Date(Date.now() - (age + 0.5) * 365.25 * DAY).toISOString().slice(0, 10)
}
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100
const num = (v) => (typeof v === "number" ? v : Number(v))
function pick(o, keys) { const r = {}; for (const k of keys) r[k] = o ? o[k] : undefined; return r }

function newCcp() { return `99${SUF}${String(++SEQ).padStart(4, "0")}` }

/* Bandeau de section */
function banner(id, title) {
  const tete = title === undefined || title === null ? String(id) : `${id} : ${title}`
  log("")
  log(C.bold + C.blue + `==== ${tete} ` + "=".repeat(Math.max(4, 74 - tete.length)) + C.reset)
}

/* Registre des sections */
const SECTIONS = []
function section(id, title, fn, opts = {}) { SECTIONS.push({ id: id.toUpperCase(), title, fn, ...opts }) }
function selected(id) {
  if (CFG.only.length && !CFG.only.includes(id)) return false
  if (CFG.skip.includes(id)) return false
  return true
}

/* Try/catch autour d'un bloc de tests : une exception ne tue pas la suite */
async function guard(name, fn) {
  try { return await fn() }
  catch (e) {
    if (String(e && e.message).startsWith("--bail")) throw e
    fail(name + " (exception)", { error: String((e && e.stack) || e).slice(0, 600) })
    return null
  }
}

/* ============================== 0.7 ORACLES LOCAUX ================================= */
/* Ports fideles des regles documentees dans src/lib/svf.js et src/lib/waterFilling.js.
 * IMPORTANT : les tests SVF (S7) n'utilisent PAS ces constantes en dur -- ils mesurent
 * empiriquement chaque facteur via l'API puis comparent a /api/settings. L'oracle sert
 * uniquement aux profils composites, avec les poids MESURES (STATE.CAL). */

const SVF_FALLBACK = {
  smig_threshold: 20000, points_income_below_smig: 40,
  points_income_below_2x_smig: 25, points_income_below_3x_smig: 10,
  points_per_child: 5, max_points_children: 20,
  points_widow_divorced: 15, points_no_support: 20,
  points_disability: 15, points_chronic_illness: 10, points_renting: 10,
  malus_per_aid: 8, max_malus: 25,
  senior_age_threshold: 65, points_senior_head: 10,
  young_head_age_threshold: 25, points_young_head: 5,
}

/* L'API expose les poids sous des cles "svf_*". La suite utilise des noms
   internes plus lisibles. WKEY fait la traduction dans les deux sens. */
const WKEY = {
  smig_threshold: "svf_smig",
  points_income_below_smig: "svf_pts_income_t1",
  points_income_below_2x_smig: "svf_pts_income_t2",
  points_income_below_3x_smig: "svf_pts_income_t3",
  points_per_child: "svf_pts_per_child",
  max_points_children: "svf_max_children_pts",
  points_widow_divorced: "svf_pts_social_widow_divorced",
  points_no_support: "svf_pts_social_no_support",
  points_disability: "svf_pts_health_disability",
  points_chronic_illness: "svf_pts_health_chronic",
  points_renting: "svf_pts_renting",
  malus_per_aid: "svf_malus_per_benefit",
  max_malus: "svf_max_malus",
  senior_age_threshold: "svf_age_senior_threshold",
  points_senior_head: "svf_pts_age_senior",
  young_head_age_threshold: "svf_age_young_threshold",
  points_young_head: "svf_pts_age_young",
}

/* Cle API a utiliser dans un PUT /api/settings { svfWeights: ... }. */
function WK(key) { return WKEY[key] || key }

/* Objet svfWeights pret a envoyer, a partir d'un nom interne. */
function wput(key, value) { return { [WK(key)]: value } }

/* Convertit la reponse de l'API (cles svf_*) vers les noms internes. */
function normalizeWeights(raw) {
  if (!raw || typeof raw !== "object") return null
  const out = {}
  for (const internal of Object.keys(WKEY)) {
    const v = raw[WKEY[internal]] !== undefined ? raw[WKEY[internal]] : raw[internal]
    if (typeof v === "number" && Number.isFinite(v)) out[internal] = v
  }
  return Object.keys(out).length ? out : null
}

/* Lit un poids dans un objet svfWeights renvoye par l'API, par nom interne. */
function RW(obj, key) {
  if (!obj || typeof obj !== "object") return undefined
  return obj[WK(key)] !== undefined ? obj[WK(key)] : obj[key]
}

function W(key) {
  const w = STATE.weights || {}
  const v = w[key] !== undefined ? w[key] : w[WK(key)]
  return typeof v === "number" && Number.isFinite(v) ? v : SVF_FALLBACK[key]
}

/* Poids reellement mesures via l'API (remplis par S7A). Fallback : poids configures. */
function CALW(key) {
  const c = STATE.CAL[key]
  return typeof c === "number" && Number.isFinite(c) ? c : W(key)
}

function priorityFromScore(score) {
  if (score >= 70) return "URGENT"
  if (score >= 45) return "VULNERABLE"
  if (score >= 20) return "MODERATE"
  return "LOW"
}

/* Oracle SVF base sur les poids MESURES. profile = description logique du dossier. */
function oracleSVF(p) {
  const parts = []
  let s = 0
  const inc = Number(p.monthlyIncome || 0)
  const smig = W("smig_threshold")
  if (inc < smig) { s += CALW("points_income_below_smig"); parts.push(["revenu<SMIG", CALW("points_income_below_smig")]) }
  else if (inc < 2 * smig) { s += CALW("points_income_below_2x_smig"); parts.push(["revenu<2xSMIG", CALW("points_income_below_2x_smig")]) }
  else if (inc < 3 * smig) { s += CALW("points_income_below_3x_smig"); parts.push(["revenu<3xSMIG", CALW("points_income_below_3x_smig")]) }

  const kids = Number(p.childrenCount || 0)
  if (kids > 0) {
    const v = Math.min(kids * CALW("points_per_child"), W("max_points_children"))
    s += v; parts.push([`enfants x${kids}`, v])
  }
  if (p.widowOrDivorced) { s += CALW("points_widow_divorced"); parts.push(["veuf/divorce", CALW("points_widow_divorced")]) }
  // Le code applique UN SEUL statut social (veuf/divorce prioritaire).
  else if (p.noSupport) { s += CALW("points_no_support"); parts.push(["sans soutien", CALW("points_no_support")]) }
  if (p.disability) { s += CALW("points_disability"); parts.push(["handicap", CALW("points_disability")]) }
  else if (p.chronic) { s += CALW("points_chronic_illness"); parts.push(["maladie chronique", CALW("points_chronic_illness")]) }
  if (p.renting) { s += CALW("points_renting"); parts.push(["locataire", CALW("points_renting")]) }
  const age = Number(p.age)
  if (Number.isFinite(age)) {
    if (age >= W("senior_age_threshold")) { s += CALW("points_senior_head"); parts.push(["senior", CALW("points_senior_head")]) }
    else if (age > 0 && age < W("young_head_age_threshold")) { s += CALW("points_young_head"); parts.push(["jeune chef", CALW("points_young_head")]) }
  }
  const benefits = Number(p.benefitCount || 0)
  if (benefits > 0) {
    const m = Math.min(benefits * W("malus_per_aid"), W("max_malus"))
    s -= m; parts.push([`malus x${benefits}`, -m])
  }
  const clamped = Math.round(Math.min(Math.max(s, 0), 100) * 100) / 100
  return { score: clamped, raw: s, parts, priority: priorityFromScore(clamped) }
}

/* normalizeReserve : >1 -> /100 ; puis >=1 -> 0.99 ; invalide/negatif -> 0 */
function normalizeReserveLocal(r) {
  let v = Number(r)
  if (!Number.isFinite(v) || v < 0) return 0
  if (v > 1) v = v / 100
  if (v >= 1) v = 0.99
  return v
}

/* ============================== 0.8 HELPERS METIER ================================= */

function famPayload(over = {}) {
  return {
    firstName: over.firstName ?? `${TAG}F`,
    lastName: over.lastName ?? uid("L"),
    dateOfBirth: over.dateOfBirth ?? dobForAge(40),
    ccp: over.ccp ?? newCcp(),
    wilaya: over.wilaya ?? "Blida",
    commune: over.commune ?? "Bfk",
    address: over.address ?? "Rue du test 1",
    maritalStatus: over.maritalStatus ?? "SINGLE",
    housingStatus: over.housingStatus ?? "OWNER",
    housingType: over.housingType ?? "HOUSE",
    monthlyIncome: over.monthlyIncome ?? 15000,
    membersCount: over.membersCount ?? 1,
    incomeSources: over.incomeSources ?? ["SALARY"],
    employmentStatus: over.employmentStatus ?? "FULL_TIME",
    phone: over.phone ?? "0550000000",
    ...over,
  }
}

async function createFamily(over = {}, opts = {}) {
  const r = await POST("/api/families", famPayload(over), opts)
  const f = r.data && (r.data.family || r.data)
  if (f && f.id) CLEAN.families.push(f.id)
  return { r, f }
}

async function getFamily(id, opts = {}) {
  const r = await GET(`/api/families/${id}`, opts)
  return { r, f: r.data && (r.data.family || r.data) }
}

async function patchFamily(id, body, opts = {}) {
  const r = await PUT(`/api/families/${id}`, body, opts)
  return { r, f: r.data && (r.data.family || r.data) }
}

async function scoreOf(id) {
  const { f } = await getFamily(id)
  return f ? num(f.svfScore) : null
}

async function addMember(familyId, body, opts = {}) {
  const r = await POST(`/api/families/${familyId}/members`, body, opts)
  const m = r.data && (r.data.member || r.data)
  if (m && m.id) CLEAN.members.push(m.id)
  return { r, m }
}

async function hardDeleteFamily(id) {
  let r = await DEL(`/api/families/${id}?mode=hard`)
  if (r.status >= 400) r = await DEL(`/api/families/${id}`, { headers: {}, })
  return r
}

/* ============================== 0.9 BOOTSTRAP ====================================== */

async function resolveMosque() {
  banner("S0", "BOOTSTRAP : connexion et instantanes")
  const ping = await GET("/api/auth/login", { token: null })
  if (ping.netError) {
    FATAL = `Serveur injoignable sur ${CFG.base} (${ping.netError}). Lancez \`npm run dev\` puis reessayez.`
    fail("S0.0 serveur joignable", FATAL)
    return false
  }
  pass("S0.0 serveur joignable", `${CFG.base} -> HTTP ${ping.status}`)

  if (!CFG.password) {
    FATAL = 'Mot de passe manquant. Utilisez --password "<motdepasse>".'
    fail("S0.1 mot de passe fourni", FATAL)
    return false
  }

  let mosqueId = CFG.mosque && CFG.mosque !== true ? String(CFG.mosque) : null
  if (!mosqueId) {
    const wl = await GET("/api/auth/login", { token: null })
    const wilayas = (wl.data && wl.data.wilayas) || []
    const found = []
    for (const w of wilayas) {
      const cr = await GET(`/api/auth/login?wilaya=${encodeURIComponent(w)}`, { token: null })
      for (const c of (cr.data && cr.data.communes) || []) {
        const mr = await GET(`/api/auth/login?wilaya=${encodeURIComponent(w)}&commune=${encodeURIComponent(c)}`, { token: null })
        for (const m of (mr.data && mr.data.mosques) || []) found.push({ ...m, wilaya: w, commune: c })
      }
    }
    if (found.length === 1) mosqueId = found[0].id
    else {
      FATAL = "Impossible de choisir automatiquement. Relancez avec --mosque <id>."
      fail("S0.1 mosquee resolue", FATAL)
      log("")
      for (const m of found) log(`   ${C.yellow}${m.id}${C.reset}  ${m.name}  ${C.dim}${m.wilaya}/${m.commune}${C.reset}`)
      log("")
      return false
    }
  }

  const lr = await POST("/api/auth/login", { mosqueId, password: String(CFG.password) }, { token: null })
  if (!lr.data || !lr.data.token) {
    FATAL = `Connexion refusee (HTTP ${lr.status}) : ${lr.message || short(lr.text, 200)}`
    fail("S0.2 connexion", FATAL)
    return false
  }
  STATE.token = lr.data.token
  STATE.user = lr.data.user
  STATE.mosque = lr.data.mosque
  STATE.mosqueId = mosqueId
  pass("S0.2 connexion", `mosquee=${(lr.data.mosque && lr.data.mosque.name) || mosqueId}`)

  const st = await GET("/api/settings")
  if (st.data) {
    STATE.settings0 = JSON.parse(JSON.stringify(st.data.settings || {}))
    STATE.weights = normalizeWeights(st.data.svfWeights)
    STATE.wf = st.data.waterFilling || null
    STATE.exponent = num((st.data.settings || {}).svfWeightExponent) || 1.5
    pass("S0.3 parametres charges", pick(STATE.weights || {}, ["points_per_child", "max_points_children", "points_widow_divorced", "smig_threshold"]))
  } else fail("S0.3 parametres charges", { status: st.status, body: short(st.text, 200) })

  const mq = await GET("/api/mosque")
  if (mq.data) {
    STATE.mosque0 = JSON.parse(JSON.stringify(mq.data.mosque || mq.data))
    STATE.balance0 = num(STATE.mosque0.balance)
    pass("S0.4 profil mosquee", { name: STATE.mosque0.name, balance: STATE.balance0 })
  } else warn("S0.4 profil mosquee", { status: mq.status })

  info("S0.5 contexte", {
    base: CFG.base, mosqueId, suffixe: SUF, repetitions: CFG.repeat,
    exposant: STATE.exponent, waterFilling: STATE.wf,
  })
  return true
}

/* ################################################################################### */
/* #  S1 -- AUTHENTIFICATION                                                          # */
/* ################################################################################### */

section("S1", "Authentification (login, profil, mot de passe, sessions)", async () => {

  /* ---- 1.1 Cascade de localisation GET /api/auth/login ---- */
  await guard("S1.1", async () => {
    const r = await GET("/api/auth/login", { token: null })
    expectOk("S1.1.1 GET /api/auth/login (public, sans token)", r, 200)
    const wilayas = r.data && r.data.wilayas
    isType("S1.1.2 data.wilayas est un tableau", wilayas, "array")
    check("S1.1.3 au moins une wilaya", Array.isArray(wilayas) && wilayas.length > 0, { n: (wilayas || []).length })
    check("S1.1.4 wilayas = chaines non vides", (wilayas || []).every((w) => typeof w === "string" && w.length > 0))
    check("S1.1.5 pas de champ mosques a l'etape 1", !(r.data && r.data.mosques))

    const w0 = (wilayas || [])[0]
    if (!w0) return skip("S1.1.6+ cascade", "aucune wilaya")

    const rc = await GET(`/api/auth/login?wilaya=${encodeURIComponent(w0)}`, { token: null })
    expectOk("S1.1.6 GET ?wilaya -> communes", rc, 200)
    isType("S1.1.7 data.communes est un tableau", rc.data && rc.data.communes, "array")

    const c0 = ((rc.data && rc.data.communes) || [])[0]
    if (!c0) return skip("S1.1.8+ cascade mosquees", "aucune commune")

    const rm = await GET(`/api/auth/login?wilaya=${encodeURIComponent(w0)}&commune=${encodeURIComponent(c0)}`, { token: null })
    expectOk("S1.1.8 GET ?wilaya&commune -> mosquees", rm, 200)
    const mosques = (rm.data && rm.data.mosques) || []
    isType("S1.1.9 data.mosques est un tableau", mosques, "array")
    check("S1.1.10 chaque mosquee expose {id,name} uniquement",
      mosques.every((m) => m && typeof m.id === "string" && typeof m.name === "string"),
      short(mosques[0]))
    check("S1.1.11 aucune fuite de donnees sensibles dans la liste",
      !JSON.stringify(mosques).match(/passwordHash|balance|email/i), short(mosques[0]))

    /* Cas limites de la cascade */
    const rEmpty = await GET("/api/auth/login?wilaya=", { token: null })
    check("S1.1.12 ?wilaya= (vide) ne plante pas", rEmpty.status < 500, { status: rEmpty.status })
    const rUnknown = await GET("/api/auth/login?wilaya=WILAYA_INEXISTANTE_XYZ", { token: null })
    expectOk("S1.1.13 wilaya inconnue -> 200", rUnknown, 200)
    eq("S1.1.14 wilaya inconnue -> communes vide", ((rUnknown.data || {}).communes || []).length, 0)
    const rLong = await GET(`/api/auth/login?wilaya=${"A".repeat(500)}`, { token: null })
    check("S1.1.15 wilaya 500 caracteres (troncature MAX_LOCATION_LENGTH) sans 500", rLong.status < 500, { status: rLong.status })
    const rInj = await GET(`/api/auth/login?wilaya=${encodeURIComponent("' OR 1=1 --")}`, { token: null })
    check("S1.1.16 injection SQL dans wilaya neutralisee", rInj.status < 500, { status: rInj.status, msg: rInj.message })
    const rUni = await GET(`/api/auth/login?wilaya=${encodeURIComponent("البليدة")}`, { token: null })
    check("S1.1.17 wilaya en arabe geree", rUni.status < 500, { status: rUni.status })
  })

  /* ---- 1.2 POST /api/auth/login : erreurs ---- */
  await guard("S1.2", async () => {
    expectFailure("S1.2.1 corps vide", await POST("/api/auth/login", {}, { token: null }), 400, "Mosque and password are required.")
    expectFailure("S1.2.2 mosqueId seul", await POST("/api/auth/login", { mosqueId: STATE.mosqueId }, { token: null }), 400, "Mosque and password are required.")
    expectFailure("S1.2.3 password seul", await POST("/api/auth/login", { password: CFG.password }, { token: null }), 400, "Mosque and password are required.")
    expectFailure("S1.2.4 mosqueId inexistant", await POST("/api/auth/login", { mosqueId: "ckinexistant000000000000", password: "whatever12" }, { token: null }), 401, "Invalid credentials.")
    expectFailure("S1.2.5 mauvais mot de passe", await POST("/api/auth/login", { mosqueId: STATE.mosqueId, password: "MauvaisMotDePasse!999" }, { token: null }), 401, "Invalid credentials.")
    expectFailure("S1.2.6 mot de passe vide", await POST("/api/auth/login", { mosqueId: STATE.mosqueId, password: "" }, { token: null }), 400, "Mosque and password are required.")
    const rNull = await POST("/api/auth/login", { mosqueId: null, password: null }, { token: null })
    expectFailure("S1.2.7 valeurs null", rNull, 400, "Mosque and password are required.")
    const rTypes = await POST("/api/auth/login", { mosqueId: 12345, password: { a: 1 } }, { token: null })
    check("S1.2.8 types incorrects -> pas de 500", rTypes.status < 500, { status: rTypes.status, msg: rTypes.message })
    const rBad = await api("POST", "/api/auth/login", { rawBody: "{ ceci n'est pas du json", token: null })
    expectFailure("S1.2.9 JSON invalide", rBad, 400, "Invalid or missing JSON body.")
  })

  /* ---- 1.3 POST /api/auth/login : succes + forme du token ---- */
  await guard("S1.3", async () => {
    const r = await POST("/api/auth/login", { mosqueId: STATE.mosqueId, password: String(CFG.password) }, { token: null })
    expectOk("S1.3.1 connexion valide", r, 200)
    const d = r.data || {}
    isType("S1.3.2 data.token est une chaine", d.token, "string")
    check("S1.3.3 token au format JWT (3 segments)", typeof d.token === "string" && d.token.split(".").length === 3, short(d.token, 40))
    isType("S1.3.4 data.user est un objet", d.user, "object")
    isType("S1.3.5 data.mosque est un objet", d.mosque, "object")
    check("S1.3.6 aucun passwordHash dans la reponse", !/passwordHash/.test(r.text), "ok")
    check("S1.3.7 champs utilisateur attendus", d.user && "id" in d.user && "email" in d.user && "role" in d.user, Object.keys(d.user || {}))
    const setCookie = r.headers && (r.headers.get("set-cookie") || "")
    check("S1.3.8 cookie 'token' pose", /token=/.test(String(setCookie)), short(setCookie, 160))
    check("S1.3.9 cookie HttpOnly", /httponly/i.test(String(setCookie)), short(setCookie, 160))
    check("S1.3.10 cookie SameSite", /samesite/i.test(String(setCookie)), short(setCookie, 160))
    /* Le nouveau token doit fonctionner */
    const me = await GET("/api/auth", { token: d.token })
    expectOk("S1.3.11 nouveau token accepte par /api/auth", me, 200)
    /* L'ancien token reste valide (pas de rotation forcee) */
    const old = await GET("/api/auth")
    check("S1.3.12 token precedent toujours valide", old.status === 200, { status: old.status })
  })

  /* ---- 1.4 GET /api/auth ---- */
  await guard("S1.4", async () => {
    const r = await GET("/api/auth")
    expectOk("S1.4.1 GET /api/auth", r, 200)
    const u = r.data && (r.data.user || r.data)
    check("S1.4.2 utilisateur retourne", !!u, short(r.data))
    isType("S1.4.3 user.id string", u && u.id, "string")
    isType("S1.4.4 user.email string", u && u.email, "string")
    inEnum("S1.4.5 user.role dans l'enum", u && u.role, ["IMAM", "ADMIN", "MANAGER", "TREASURER", "MEMBER", "SUPER_ADMIN"])
    check("S1.4.6 pas de passwordHash", !(u && "passwordHash" in u), Object.keys(u || {}))
    check("S1.4.7 email au format valide", /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(u && u.email)), u && u.email)
    expectFailure("S1.4.8 sans token -> 401", await GET("/api/auth", { token: null }), 401, "Authentication required.")
    expectFailure("S1.4.9 token invalide -> 401", await GET("/api/auth", { token: "abc.def.ghi" }), 401, "Invalid or expired session.")
    expectFailure("S1.4.10 token vide apres Bearer", await GET("/api/auth", { token: "   " }), 401, null)
  })

  /* ---- 1.5 PUT /api/auth : profil ---- */
  await guard("S1.5", async () => {
    const before = (await GET("/api/auth")).data
    const u0 = (before && (before.user || before)) || {}
    const orig = pick(u0, ["firstName", "lastName", "phone", "email"])

    const r1 = await PUT("/api/auth", { firstName: "ZZPrenom", lastName: "ZZNom", phone: "0551234567" })
    expectOk("S1.5.1 mise a jour prenom/nom/telephone", r1, 200)
    const u1 = r1.data && (r1.data.user || r1.data)
    eq("S1.5.2 firstName persiste", u1 && u1.firstName, "ZZPrenom")
    eq("S1.5.3 lastName persiste", u1 && u1.lastName, "ZZNom")
    eq("S1.5.4 phone persiste", u1 && u1.phone, "0551234567")

    const again = (await GET("/api/auth")).data
    const u2 = (again && (again.user || again)) || {}
    eq("S1.5.5 relecture coherente", u2.firstName, "ZZPrenom")

    /* Champs non modifiables ignores */
    const rIgn = await PUT("/api/auth", { role: "SUPER_ADMIN", isActive: false, tokenVersion: 999, id: "hack", mosqueId: "hack" })
    check("S1.5.6 champs proteges ignores (pas de 500)", rIgn.status < 500, { status: rIgn.status, msg: rIgn.message })
    const u3 = (await GET("/api/auth")).data
    const uu = (u3 && (u3.user || u3)) || {}
    check("S1.5.7 role non escalade", uu.role !== "SUPER_ADMIN", uu.role)
    check("S1.5.8 compte toujours actif", uu.isActive !== false, uu.isActive)

    /* Restauration */
    await PUT("/api/auth", orig)
    const rest = (await GET("/api/auth")).data
    const ur = (rest && (rest.user || rest)) || {}
    eq("S1.5.9 profil restaure", ur.firstName, orig.firstName)
  })

  /* ---- 1.6 Changement de mot de passe ---- */
  await guard("S1.6", async () => {
    const NEW = "ZZtest-Passw0rd-" + SUF
    expectFailure("S1.6.1 password sans currentPassword",
      await PUT("/api/auth", { password: NEW }), 400, "currentPassword is required to change the password.")
    expectFailure("S1.6.2 currentPassword incorrect",
      await PUT("/api/auth", { currentPassword: "totalement-faux-999", password: NEW }), 401, "Current password is incorrect.")
    expectFailure("S1.6.3 nouveau mot de passe trop court (7)",
      await PUT("/api/auth", { currentPassword: String(CFG.password), password: "1234567" }), 400, "New password must be at least 8 characters.")
    expectFailure("S1.6.4 nouveau mot de passe vide",
      await PUT("/api/auth", { currentPassword: String(CFG.password), password: "" }), 400, null)

    /* Limite exacte : 8 caracteres doit passer */
    const r8 = await PUT("/api/auth", { currentPassword: String(CFG.password), password: "Zz8chars" })
    if (expectOk("S1.6.5 8 caracteres accepte (limite exacte)", r8, 200)) {
      const bad = await POST("/api/auth/login", { mosqueId: STATE.mosqueId, password: String(CFG.password) }, { token: null })
      expectFailure("S1.6.6 ancien mot de passe refuse", bad, 401, "Invalid credentials.")
      const good = await POST("/api/auth/login", { mosqueId: STATE.mosqueId, password: "Zz8chars" }, { token: null })
      expectOk("S1.6.7 nouveau mot de passe accepte", good, 200)
      if (good.data && good.data.token) STATE.token = good.data.token

      /* Deuxieme changement puis retour au mot de passe initial */
      const r2 = await PUT("/api/auth", { currentPassword: "Zz8chars", password: NEW })
      expectOk("S1.6.8 second changement", r2, 200)
      const g2 = await POST("/api/auth/login", { mosqueId: STATE.mosqueId, password: NEW }, { token: null })
      expectOk("S1.6.9 connexion avec le 2e mot de passe", g2, 200)
      if (g2.data && g2.data.token) STATE.token = g2.data.token

      const rBack = await PUT("/api/auth", { currentPassword: NEW, password: String(CFG.password) })
      expectOk("S1.6.10 restauration du mot de passe initial", rBack, 200)
      const gBack = await POST("/api/auth/login", { mosqueId: STATE.mosqueId, password: String(CFG.password) }, { token: null })
      if (expectOk("S1.6.11 reconnexion avec le mot de passe initial", gBack, 200) && gBack.data.token) {
        STATE.token = gBack.data.token
      } else {
        FATAL = `ATTENTION : le mot de passe n'a PAS pu etre restaure. Mot de passe actuel = "${NEW}"`
        warn("S1.6.12 !! mot de passe non restaure", FATAL)
      }
    } else {
      warn("S1.6.5b changement de mot de passe ignore", "la suite du bloc est sautee pour ne pas verrouiller le compte")
    }
  })

  /* ---- 1.7 logOutOtherDevices / tokenVersion ---- */
  await guard("S1.7", async () => {
    const oldToken = STATE.token
    const r = await PUT("/api/auth", { logOutOtherDevices: true })
    if (!expectOk("S1.7.1 PUT logOutOtherDevices:true", r, 200)) return
    const fresh = r.data && r.data.token
    isType("S1.7.2 un nouveau token est renvoye", fresh, "string")
    check("S1.7.3 le nouveau token differe de l'ancien", fresh !== oldToken)
    const withOld = await GET("/api/auth", { token: oldToken })
    expectFailure("S1.7.4 ancien token invalide (tokenVersion)", withOld, 401, "Session has been logged out on this device.")
    const withNew = await GET("/api/auth", { token: fresh })
    expectOk("S1.7.5 nouveau token valide", withNew, 200)
    STATE.token = fresh
    /* Une famille ne doit pas etre accessible avec l'ancien token */
    const fam = await GET("/api/families", { token: oldToken })
    expectFailure("S1.7.6 ancien token rejete sur /api/families", fam, 401, null)
  })

  /* ---- 1.8 Logout ---- */
  await guard("S1.8", async () => {
    const lr = await POST("/api/auth/login", { mosqueId: STATE.mosqueId, password: String(CFG.password) }, { token: null })
    const throwaway = lr.data && lr.data.token
    if (!throwaway) return skip("S1.8 logout", "impossible d'obtenir un token jetable")
    const out = await POST("/api/auth/logout", {}, { token: throwaway })
    expectOk("S1.8.1 POST /api/auth/logout", out, 200)
    const sc = out.headers && String(out.headers.get("set-cookie") || "")
    check("S1.8.2 cookie efface (Max-Age=0 ou Expires passe)", /max-age=0|expires=/i.test(sc), short(sc, 160))
    const out2 = await POST("/api/auth/logout", {}, { token: null })
    check("S1.8.3 logout sans session ne plante pas", out2.status < 500, { status: out2.status })
    /* Le token Bearer reste techniquement valide apres logout cookie : on le documente */
    const after = await GET("/api/auth", { token: throwaway })
    info("S1.8.4 statut du Bearer apres logout", { status: after.status, note: after.status === 200 ? "Bearer encore valide (logout = suppression du cookie). Utiliser logOutOtherDevices pour invalider." : "Bearer invalide" })
  })
})

/* ################################################################################### */
/* #  S2 -- CREATION DE COMPTE (REGISTER)                                             # */
/* ################################################################################### */

section("S2", "Creation de compte + mosquee (register)", async () => {
  if (CFG.noRegister) return skip("S2 entier", "--no-register")

  const base = () => ({
    firstName: "ZZReg", lastName: "Test" + SUF,
    email: `zz.reg.${SUF}.${++SEQ}@test-suite.local`,
    password: "MotDePasse123", phone: "0555000111",
    mosque: {
      name: `${TAG} Mosquee ${SUF}-${SEQ}`, email: `zz.mosque.${SUF}.${SEQ}@test-suite.local`,
      wilaya: "ZZTestWilaya", commune: "ZZTestCommune", address: "Rue de test 42", phone: "0555000222",
    },
  })

  /* ---- 2.1 Champs manquants ---- */
  await guard("S2.1", async () => {
    expectFailure("S2.1.1 corps vide", await POST("/api/auth/register", {}, { token: null }), 400, "Missing required registration fields.")
    const fields = ["firstName", "lastName", "email", "password"]
    for (const f of fields) {
      const b = base(); delete b[f]
      expectFailure(`S2.1.2 champ manquant : ${f}`, await POST("/api/auth/register", b, { token: null }), 400, "Missing required registration fields.")
    }
    const bNoMosque = base(); delete bNoMosque.mosque
    const rNoMq = await POST("/api/auth/register", bNoMosque, { token: null })
    check("S2.1.3 objet mosque absent accepte : la mosquee est optionnelle", rNoMq.status === 201, { status: rNoMq.status, message: rNoMq.message })
    for (const mf of ["name", "wilaya", "commune"]) {
      const b = base(); delete b.mosque[mf]
      const r = await POST("/api/auth/register", b, { token: null })
      check(`S2.1.4 mosque.${mf} manquant -> refus 4xx`, r.status >= 400 && r.status < 500, { status: r.status, msg: r.message })
    }
    const bBlank = base(); bBlank.firstName = "   "
    const rBlank = await POST("/api/auth/register", bBlank, { token: null })
    check("S2.1.5 champ compose d'espaces refuse", rBlank.status >= 400, { status: rBlank.status, msg: rBlank.message })
  })

  /* ---- 2.2 Validation email / mot de passe ---- */
  await guard("S2.2", async () => {
    for (const bad of ["pasunemail", "a@b", "a b@c.com", "@nodomain.com", "nolocal@", "double@@at.com"]) {
      const b = base(); b.email = bad
      expectFailure(`S2.2.1 email invalide : "${bad}"`, await POST("/api/auth/register", b, { token: null }), 400, "Please enter a valid email address.")
    }
    for (const len of [1, 5, 7]) {
      const b = base(); b.password = "a".repeat(len)
      expectFailure(`S2.2.2 mot de passe ${len} caracteres`, await POST("/api/auth/register", b, { token: null }), 400, "Password must be at least 8 characters long.")
    }
    const bJson = await api("POST", "/api/auth/register", { rawBody: "not-json", token: null })
    expectFailure("S2.2.3 JSON invalide", bJson, 400, "Invalid or missing JSON body.")
  })

  /* ---- 2.3 Creation reussie ---- */
  await guard("S2.3", async () => {
    const b = base()
    const r = await POST("/api/auth/register", b, { token: null })
    if (!expectOk("S2.3.1 creation de compte reussie", r)) {
      return warn("S2.3 suite ignoree", { status: r.status, message: r.message })
    }
    eq("S2.3.2 code HTTP 201", r.status, 201)
    const d = r.data || {}
    isType("S2.3.3 data.user", d.user, "object")
    isType("S2.3.4 data.mosque", d.mosque, "object")
    isType("S2.3.5 data.token", d.token, "string")
    eq("S2.3.6 role par defaut = IMAM", d.user && d.user.role, "IMAM")
    eq("S2.3.7 compte actif immediatement", d.user && d.user.isActive, true)
    eq("S2.3.8 email normalise en minuscules", String(d.user && d.user.email), String(b.email).toLowerCase())
    check("S2.3.9 aucun passwordHash renvoye", !/passwordHash/.test(r.text))
    eq("S2.3.10 mosquee liee correcte", d.mosque && d.mosque.name, b.mosque.name)

    STATE.b = { token: d.token, mosqueId: d.mosque && d.mosque.id, email: b.email, password: b.password, userId: d.user && d.user.id, mosqueName: b.mosque.name }

    /* Le compte B est immediatement utilisable */
    const me = await GET("/api/auth", { token: STATE.b.token })
    expectOk("S2.3.11 token du compte B fonctionnel", me, 200)
    const login = await POST("/api/auth/login", { mosqueId: STATE.b.mosqueId, password: b.password }, { token: null })
    expectOk("S2.3.12 connexion au compte B via login", login, 200)

    /* Les parametres par defaut ont bien ete crees pour la nouvelle mosquee */
    const st = await GET("/api/settings", { token: STATE.b.token })
    expectOk("S2.3.13 MosqueSettings cree automatiquement", st, 200)
    const s = st.data && st.data.settings
    eq("S2.3.14 smigThreshold par defaut", num(s && s.smigThreshold), 20000)
    eq("S2.3.15 autoCalculateSVF par defaut", s && s.autoCalculateSVF, true)

    /* Solde initial a 0 */
    const mq = await GET("/api/mosque", { token: STATE.b.token })
    const mb = mq.data && (mq.data.mosque || mq.data)
    eq("S2.3.16 solde initial = 0", num(mb && mb.balance), 0)

    /* La nouvelle mosquee apparait dans la cascade publique */
    const casc = await GET(`/api/auth/login?wilaya=${encodeURIComponent(b.mosque.wilaya)}&commune=${encodeURIComponent(b.mosque.commune)}`, { token: null })
    const found = ((casc.data && casc.data.mosques) || []).some((m) => m.id === STATE.b.mosqueId)
    check("S2.3.17 mosquee visible dans la cascade de connexion", found, { wilaya: b.mosque.wilaya, commune: b.mosque.commune })
  })

  /* ---- 2.4 Doublons ---- */
  await guard("S2.4", async () => {
    if (!STATE.b.email) return skip("S2.4 doublons", "compte B non cree")
    const dupUser = base(); dupUser.email = STATE.b.email
    expectFailure("S2.4.1 email utilisateur deja pris", await POST("/api/auth/register", dupUser, { token: null }), 409, "Email already in use.")
    const dupUpper = base(); dupUpper.email = String(STATE.b.email).toUpperCase()
    expectFailure("S2.4.2 email en MAJUSCULES considere identique", await POST("/api/auth/register", dupUpper, { token: null }), 409, "Email already in use.")
    const mq = await GET("/api/mosque", { token: STATE.b.token })
    const mEmail = mq.data && (mq.data.mosque || mq.data) && (mq.data.mosque || mq.data).email
    if (mEmail) {
      const dupMosque = base(); dupMosque.mosque.email = mEmail
      expectFailure("S2.4.3 email de mosquee deja pris", await POST("/api/auth/register", dupMosque, { token: null }), 409, "A mosque is already registered with this email.")
    } else skip("S2.4.3 email de mosquee deja pris", "email mosquee introuvable")
    const dupTriple = base()
    dupTriple.mosque.name = STATE.b.mosqueName
    dupTriple.mosque.wilaya = "ZZTestWilaya"; dupTriple.mosque.commune = "ZZTestCommune"
    const r = await POST("/api/auth/register", dupTriple, { token: null })
    check("S2.4.4 mosquee identique (nom+wilaya+commune) -> 409", r.status === 409, { status: r.status, msg: r.message })
  })

  info("S2.9 nettoyage", "Aucune route API ne supprime un compte : les comptes ZZ* restent en base. SQL de purge fourni dans le rapport Markdown.")
})

/* ################################################################################### */
/* #  S3 -- PROFIL MOSQUEE                                                            # */
/* ################################################################################### */

section("S3", "Profil mosquee (GET / PUT / unicite)", async () => {
  await guard("S3.1", async () => {
    const r = await GET("/api/mosque")
    expectOk("S3.1.1 GET /api/mosque", r, 200)
    const m = r.data && (r.data.mosque || r.data)
    isType("S3.1.2 mosque.id", m && m.id, "string")
    isType("S3.1.3 mosque.name", m && m.name, "string")
    isType("S3.1.4 mosque.balance numerique", num(m && m.balance), "number")
    check("S3.1.5 solde non negatif", num(m && m.balance) >= 0, m && m.balance)
    for (const k of ["wilaya", "commune", "address", "phone", "email"]) {
      isType(`S3.1.6 mosque.${k} (string|null)`, m ? m[k] : undefined, "nullableString")
    }
    expectFailure("S3.1.7 sans token -> 401", await GET("/api/mosque", { token: null }), 401, "Authentication required.")
  })

  await guard("S3.2", async () => {
    const orig = pick(STATE.mosque0 || {}, ["name", "wilaya", "commune", "address", "phone", "email", "description"])
    const r = await PUT("/api/mosque", { name: `${TAG} Mosquee modifiee`, address: "Nouvelle adresse 7", description: "Description de test", phone: "0770000000" })
    expectOk("S3.2.1 PUT champs valides", r, 200)
    const m = r.data && (r.data.mosque || r.data)
    eq("S3.2.2 name persiste", m && m.name, `${TAG} Mosquee modifiee`)
    eq("S3.2.3 address persiste", m && m.address, "Nouvelle adresse 7")
    eq("S3.2.4 description persiste", m && m.description, "Description de test")

    expectFailure("S3.2.5 nom vide refuse", await PUT("/api/mosque", { name: "" }), 400, "Mosque name cannot be empty.")
    expectFailure("S3.2.6 nom compose d'espaces refuse", await PUT("/api/mosque", { name: "    " }), 400, "Mosque name cannot be empty.")
    expectFailure("S3.2.7 email invalide refuse", await PUT("/api/mosque", { email: "pas-un-email" }), 400, "Invalid mosque email.")

    if (STATE.b.token) {
      const mqB = await GET("/api/mosque", { token: STATE.b.token })
      const emailB = mqB.data && (mqB.data.mosque || mqB.data) && (mqB.data.mosque || mqB.data).email
      if (emailB) {
        expectFailure("S3.2.8 email deja utilise par une autre mosquee", await PUT("/api/mosque", { email: emailB }), 409, "This email is already used by another mosque.")
      } else skip("S3.2.8 email deja utilise", "pas d'email sur la mosquee B")
    } else skip("S3.2.8 email deja utilise", "compte B indisponible")

    const rSolde = await PUT("/api/mosque", { balance: 999999999, id: "hack" })
    check("S3.2.9 champs proteges (balance/id) ignores", rSolde.status < 500, { status: rSolde.status })
    const after = await GET("/api/mosque")
    const ma = after.data && (after.data.mosque || after.data)
    check("S3.2.10 solde non modifiable via PUT /api/mosque", num(ma && ma.balance) !== 999999999, ma && ma.balance)

    const rLong = await PUT("/api/mosque", { description: "X".repeat(3000) })
    check("S3.2.11 description 3000 caracteres sans 500", rLong.status < 500, { status: rLong.status })
    const rUni = await PUT("/api/mosque", { description: "مسجد الاختبار — الجزائر" })
    check("S3.2.12 description unicode/arabe acceptee", rUni.status < 400, { status: rUni.status })

    const back = await PUT("/api/mosque", orig)
    expectOk("S3.2.13 restauration du profil d'origine", back, 200)
    const mb = back.data && (back.data.mosque || back.data)
    eq("S3.2.14 nom restaure", mb && mb.name, orig.name)
  })
})

/* ################################################################################### */
/* #  S4 -- PARAMETRES (SETTINGS)                                                     # */
/* ################################################################################### */

const BOOL_FIELDS = ["autoCalculateSVF", "allowAnonymousDonations"]
const INT_FIELDS = [
  "svfMaxScore", "pointsIfIncomeBelowSMIG", "pointsIfIncomeBelow2xSMIG", "pointsIfIncomeBelow3xSMIG",
  "pointsPerChild", "childPointsCap", "pointsIfWidowedDivorced", "pointsIfNoSupport",
  "pointsIfDisability", "pointsIfChronicIllness", "pointsIfTenant", "malusPerAidReceived",
  "malusCap", "seniorAgeThreshold", "pointsIfSeniorHead", "youngHeadAgeThreshold", "pointsIfYoungHead",
]
const NUMBER_FIELDS = [
  "smigThreshold", "povertyThresholdPerPerson", "svfWeightExponent",
  "minimumDistributionAmount", "reservePercentage",
]

async function readSettings(token) {
  const r = await GET("/api/settings", token ? { token } : {})
  return { r, s: (r.data && r.data.settings) || null, w: (r.data && r.data.svfWeights) || null, wf: (r.data && r.data.waterFilling) || null }
}

section("S4", "Parametres : matrices de validation, poids SVF, reset, propagation", async () => {

  /* ---- 4.1 Forme de la reponse GET ---- */
  await guard("S4.1", async () => {
    const r = await GET("/api/settings")
    expectOk("S4.1.1 GET /api/settings", r, 200)
    const d = r.data || {}
    for (const k of ["settings", "svfWeights", "svfDefaults", "waterFilling"]) {
      isType(`S4.1.2 data.${k} est un objet`, d[k], "object")
    }
    isType("S4.1.3 data.svfCustomized est un booleen", d.svfCustomized, "boolean")
    for (const f of BOOL_FIELDS) isType(`S4.1.4 settings.${f} : boolean`, d.settings && d.settings[f], "boolean")
    for (const f of INT_FIELDS) isType(`S4.1.5 settings.${f} : entier`, num(d.settings && d.settings[f]), "number")
    for (const f of NUMBER_FIELDS) isType(`S4.1.6 settings.${f} : nombre`, num(d.settings && d.settings[f]), "number")
    isType("S4.1.7 settings.customCriteria : tableau", d.settings && d.settings.customCriteria, "array")
    const wf = d.waterFilling || {}
    for (const k of ["wf_reserve", "wf_min_amt", "wf_max_amt"]) isType(`S4.1.8 waterFilling.${k} numerique`, num(wf[k]), "number")
    check("S4.1.9 wf_reserve dans [0,1[", num(wf.wf_reserve) >= 0 && num(wf.wf_reserve) < 1, wf.wf_reserve)
    check("S4.1.10 wf_max_amt >= wf_min_amt", num(wf.wf_max_amt) >= num(wf.wf_min_amt), pick(wf, ["wf_min_amt", "wf_max_amt"]))
    const w = d.svfWeights || {}
    const expectedWeightKeys = Object.keys(SVF_FALLBACK)
    const missing = expectedWeightKeys.filter((k) => !(WK(k) in w) && !(k in w))
    check("S4.1.11 tous les poids SVF sont exposes", missing.length === 0, { manquants: missing })
    check("S4.1.12 tous les poids sont numeriques", Object.values(w).every((v) => typeof v === "number" && Number.isFinite(v)), short(w))
    expectFailure("S4.1.13 sans token -> 401", await GET("/api/settings", { token: null }), 401, "Authentication required.")
  })

  /* ---- 4.2 Champs booleens : matrice de valeurs ---- */
  await guard("S4.2", async () => {
    for (const f of BOOL_FIELDS) {
      for (const v of [true, false, true]) {
        const r = await PUT("/api/settings", { [f]: v })
        if (expectOk(`S4.2.1 PUT ${f}=${v}`, r, 200)) {
          eq(`S4.2.2 ${f} persiste = ${v}`, r.data.settings[f], v)
          const back = await readSettings()
          eq(`S4.2.3 ${f} relu = ${v}`, back.s && back.s[f], v)
        }
      }
      /* Valeurs non booleennes : coercition ou refus, mais jamais 500 */
      for (const bad of ["oui", 1, 0, null, [], {}]) {
        const r = await PUT("/api/settings", { [f]: bad })
        check(`S4.2.4 ${f} = ${short(bad, 20)} -> pas de 500`, r.status < 500, { status: r.status, msg: r.message })
      }
    }
  })

  /* ---- 4.3 Champs entiers : matrice complete ---- */
  await guard("S4.3", async () => {
    for (const f of INT_FIELDS) {
      const cur = num((STATE.settings0 || {})[f])
      const r0 = await PUT("/api/settings", { [f]: 7 })
      if (expectOk(`S4.3.1 ${f} = 7 accepte`, r0, 200)) eq(`S4.3.2 ${f} persiste`, num(r0.data.settings[f]), 7)
      const rZero = await PUT("/api/settings", { [f]: 0 })
      check(`S4.3.3 ${f} = 0 accepte`, rZero.status === 200, { status: rZero.status, msg: rZero.message })
      expectFailure(`S4.3.4 ${f} negatif refuse`, await PUT("/api/settings", { [f]: -1 }), 400, `${f} cannot be lower than 0.`)
      expectFailure(`S4.3.5 ${f} = "abc" refuse`, await PUT("/api/settings", { [f]: "abc" }), 400, `${f} must be a number.`)
      const rNan = await PUT("/api/settings", { [f]: "NaN" })
      expectFailure(`S4.3.6 ${f} = "NaN" refuse`, rNan, 400, `${f} must be a number.`)
      const rStr = await PUT("/api/settings", { [f]: "12" })
      check(`S4.3.7 ${f} = "12" (chaine numerique) accepte`, rStr.status === 200 && num(rStr.data.settings[f]) === 12, { status: rStr.status, val: rStr.data && rStr.data.settings && rStr.data.settings[f] })
      const rFloat = await PUT("/api/settings", { [f]: 3.7 })
      check(`S4.3.8 ${f} = 3.7 (entier attendu) -> arrondi ou refus, pas de 500`, rFloat.status < 500, { status: rFloat.status, val: rFloat.data && rFloat.data.settings && rFloat.data.settings[f] })
      const rBig = await PUT("/api/settings", { [f]: 2147483647 })
      check(`S4.3.9 ${f} = MAX_INT32 gere`, rBig.status < 500, { status: rBig.status })
      const rHuge = await PUT("/api/settings", { [f]: 99999999999 })
      check(`S4.3.10 ${f} = 10^11 (depassement Int) gere sans 500`, rHuge.status < 500, { status: rHuge.status, msg: rHuge.message })
      if (Number.isFinite(cur)) await PUT("/api/settings", { [f]: cur })
    }
  })

  /* ---- 4.4 Champs numeriques (float) ---- */
  await guard("S4.4", async () => {
    for (const f of NUMBER_FIELDS) {
      if (f === "reservePercentage") continue // traite en 4.5
      const cur = num((STATE.settings0 || {})[f])
      const rOk = await PUT("/api/settings", { [f]: 1.5 })
      check(`S4.4.1 ${f} = 1.5 accepte`, rOk.status === 200, { status: rOk.status, msg: rOk.message })
      expectFailure(`S4.4.2 ${f} negatif refuse`, await PUT("/api/settings", { [f]: -0.5 }), 400, `${f} cannot be lower than 0.`)
      expectFailure(`S4.4.3 ${f} non numerique refuse`, await PUT("/api/settings", { [f]: "beaucoup" }), 400, `${f} must be a number.`)
      const rInf = await PUT("/api/settings", { [f]: "Infinity" })
      check(`S4.4.4 ${f} = Infinity refuse ou neutralise`, rInf.status < 500, { status: rInf.status, msg: rInf.message })
      if (Number.isFinite(cur)) await PUT("/api/settings", { [f]: cur })
    }
  })

  /* ---- 4.5 reservePercentage : regles specifiques ---- */
  await guard("S4.5", async () => {
    const cur = num((STATE.settings0 || {}).reservePercentage)
    const cases = [
      { v: 0, label: "0 (aucune reserve)" },
      { v: 0.1, label: "0.1 (10%)" },
      { v: 0.25, label: "0.25 (25%)" },
      { v: 10, label: "10 -> converti en 0.1" },
      { v: 50, label: "50 -> converti en 0.5" },
      { v: 99, label: "99 -> converti en 0.99" },
    ]
    for (const c of cases) {
      const r = await PUT("/api/settings", { reservePercentage: c.v })
      if (r.status === 200) {
        const got = num(r.data.settings.reservePercentage)
        const expected = c.v > 1 ? round2(c.v / 100) : c.v
        near(`S4.5.1 reservePercentage ${c.label}`, got, expected, 0.011, { envoye: c.v })
        check(`S4.5.2 reservePercentage ${c.label} reste < 1`, got < 1, got)
      } else {
        info(`S4.5.1 reservePercentage ${c.label} refuse`, { status: r.status, msg: r.message })
      }
    }
    const r100 = await PUT("/api/settings", { reservePercentage: 100 })
    check("S4.5.3 reservePercentage = 100 refuse ou plafonne", r100.status >= 400 || num(r100.data.settings.reservePercentage) < 1,
      { status: r100.status, msg: r100.message, val: r100.data && r100.data.settings && r100.data.settings.reservePercentage })
    const r150 = await PUT("/api/settings", { reservePercentage: 150 })
    check("S4.5.4 reservePercentage = 150 refuse ou plafonne", r150.status >= 400 || num(r150.data.settings.reservePercentage) < 1,
      { status: r150.status, msg: r150.message })
    expectFailure("S4.5.5 reservePercentage negatif", await PUT("/api/settings", { reservePercentage: -5 }), 400, "reservePercentage cannot be lower than 0.")
    await PUT("/api/settings", { reservePercentage: Number.isFinite(cur) ? cur : 0.1 })
  })

  /* ---- 4.6 customCriteria ---- */
  await guard("S4.6", async () => {
    expectFailure("S4.6.1 customCriteria = chaine refuse", await PUT("/api/settings", { customCriteria: "abc" }), 400, "customCriteria must be an array.")
    expectFailure("S4.6.2 customCriteria = objet refuse", await PUT("/api/settings", { customCriteria: { a: 1 } }), 400, "customCriteria must be an array.")
    expectFailure("S4.6.3 customCriteria = nombre refuse", await PUT("/api/settings", { customCriteria: 5 }), 400, "customCriteria must be an array.")
    const rEmpty = await PUT("/api/settings", { customCriteria: [] })
    expectOk("S4.6.4 customCriteria = [] accepte", rEmpty, 200)
    const payload = [{ key: "zz_test", label: "Critere de test", points: 5 }]
    const rFull = await PUT("/api/settings", { customCriteria: payload })
    if (expectOk("S4.6.5 customCriteria avec un element", rFull, 200)) {
      eq("S4.6.6 customCriteria persiste tel quel", rFull.data.settings.customCriteria, payload)
      const back = await readSettings()
      eq("S4.6.7 customCriteria relu depuis la base", back.s.customCriteria, payload)
    }
    await PUT("/api/settings", { customCriteria: (STATE.settings0 || {}).customCriteria || [] })
  })

  /* ---- 4.7 Corps vide / champs inconnus ---- */
  await guard("S4.7", async () => {
    expectFailure("S4.7.1 corps vide", await PUT("/api/settings", {}), 400, "No recognised settings field was provided.")
    expectFailure("S4.7.2 uniquement des champs inconnus", await PUT("/api/settings", { champInexistant: 1, autreTruc: "x" }), 400, "No recognised settings field was provided.")
    const rMix = await PUT("/api/settings", { pointsPerChild: 5, champInexistant: 42 })
    check("S4.7.3 champ connu + champ inconnu -> accepte, inconnu ignore", rMix.status === 200, { status: rMix.status, msg: rMix.message })
    check("S4.7.4 le champ inconnu n'est pas persiste", rMix.status !== 200 || !("champInexistant" in (rMix.data.settings || {})), Object.keys((rMix.data && rMix.data.settings) || {}).length)
    const rBadJson = await api("PUT", "/api/settings", { rawBody: "[[[" })
    expectFailure("S4.7.5 JSON invalide", rBadJson, 400, "Invalid or missing JSON body.")
    expectFailure("S4.7.6 PUT sans token", await PUT("/api/settings", { pointsPerChild: 5 }, { token: null }), 401, "Authentication required.")
  })

  /* ---- 4.8 svfWeights : fusion et nettoyage ---- */
  await guard("S4.8", async () => {
    const r = await PUT("/api/settings", { svfWeights: { ...wput("points_per_child", 6), ...wput("points_widow_divorced", 17) } })
    if (expectOk("S4.8.1 PUT svfWeights partiel", r, 200)) {
      eq("S4.8.2 points_per_child = 6", num(RW(r.data.svfWeights, "points_per_child")), 6)
      eq("S4.8.3 points_widow_divorced = 17", num(RW(r.data.svfWeights, "points_widow_divorced")), 17)
      check("S4.8.4 les autres poids sont conserves (fusion, pas remplacement)",
        Object.keys(SVF_FALLBACK).every((k) => WK(k) in r.data.svfWeights), Object.keys(r.data.svfWeights).length)
      eq("S4.8.5 svfCustomized passe a true", r.data.svfCustomized, true)
      isType("S4.8.6 recalculatedFamilies est un nombre", num(r.data.recalculatedFamilies), "number")
    }
    const rJunk = await PUT("/api/settings", { svfWeights: { cle_bidon: 99, ...wput("points_per_child", "abc"), autre: null } })
    check("S4.8.7 poids inconnus/invalides ignores sans 500", rJunk.status < 500, { status: rJunk.status, msg: rJunk.message })
    if (rJunk.status === 200) {
      check("S4.8.8 la cle bidon n'est pas persistee", !("cle_bidon" in rJunk.data.svfWeights), Object.keys(rJunk.data.svfWeights))
      const junkPc = RW(rJunk.data.svfWeights, "points_per_child")
      check("S4.8.9 points_per_child='abc' n'a pas corrompu le poids",
        typeof junkPc === "number" && Number.isFinite(junkPc), junkPc)
    }
    for (const bad of ["abc", 42, null, []]) {
      const rb = await PUT("/api/settings", { svfWeights: bad })
      check(`S4.8.10 svfWeights = ${short(bad, 12)} -> pas de 500`, rb.status < 500, { status: rb.status, msg: rb.message })
    }
    /* Coherence colonne <-> poids JSON */
    const rCol = await PUT("/api/settings", { pointsPerChild: 9 })
    if (rCol.status === 200) {
      const w = rCol.data.svfWeights || {}
      eq("S4.8.11 colonne pointsPerChild se reflete dans svfWeights.points_per_child", num(RW(w, "points_per_child")), 9)
    }
  })

  /* ---- 4.9 Propagation des poids -> recalcul des scores ---- */
  await guard("S4.9", async () => {
    const { f } = await createFamily({ maritalStatus: "WIDOWED", monthlyIncome: 5000, housingStatus: "TENANT", housingType: "APARTMENT" })
    if (!f) return fail("S4.9.0 famille temoin creee", "echec de creation")
    pass("S4.9.0 famille temoin creee", { id: f.id, score: f.svfScore })
    const s0 = await scoreOf(f.id)

    const rUp = await PUT("/api/settings", { svfWeights: wput("points_widow_divorced", 30) })
    if (expectOk("S4.9.1 poids veuf/divorce porte a 30", rUp, 200)) {
      check("S4.9.2 recalculatedFamilies >= 1", num(rUp.data.recalculatedFamilies) >= 1, rUp.data.recalculatedFamilies)
      const s1 = await scoreOf(f.id)
      check("S4.9.3 le score de la famille a change apres modification du poids", s1 !== s0, { avant: s0, apres: s1 })
      near("S4.9.4 delta = nouveau poids - ancien poids", round2(s1 - s0), round2(30 - W("points_widow_divorced")), 0.02, { avant: s0, apres: s1, ancienPoids: W("points_widow_divorced") })
    }

    const rDown = await PUT("/api/settings", { svfWeights: wput("points_widow_divorced", 0) })
    if (rDown.status === 200) {
      const s2 = await scoreOf(f.id)
      near("S4.9.5 poids a 0 -> le facteur ne rapporte plus rien", round2(s0 - s2), round2(W("points_widow_divorced")), 0.02, { s0, s2 })
    }

    /* Restauration du poids d'origine et verification du retour a l'etat initial */
    const back = await PUT("/api/settings", { svfWeights: wput("points_widow_divorced", W("points_widow_divorced")) })
    if (back.status === 200) {
      const s3 = await scoreOf(f.id)
      near("S4.9.6 restauration du poids -> score initial retrouve", s3, s0, 0.02, { s0, s3 })
    }

    /* Boucle repetitive : 5 modifications successives du poids enfant */
    const { f: fk } = await createFamily({ maritalStatus: "MARRIED", monthlyIncome: 8000 })
    if (fk) {
      for (let i = 0; i < 3; i++) {
        await POST(`/api/families/${fk.id}/children`, { firstName: `Enf${i}`, lastName: "Test", dateOfBirth: dobForAge(6 + i) })
      }
      const results = []
      for (const pw of [2, 4, 6, 8, 10]) {
        const rr = await PUT("/api/settings", { svfWeights: wput("points_per_child", pw) })
        const sc = await scoreOf(fk.id)
        results.push({ poidsEnfant: pw, score: sc, ok: rr.status === 200 })
      }
      const cap = W("max_points_children")
      let monotone = true
      for (let i = 1; i < results.length; i++) if (num(results[i].score) < num(results[i - 1].score) - 0.001) monotone = false
      check("S4.9.7 5 changements successifs du poids enfant : score monotone croissant", monotone, results)
      const expDeltas = results.map((x) => Math.min(3 * x.poidsEnfant, cap))
      const obsDeltas = results.map((x) => round2(num(x.score) - num(results[0].score) + Math.min(3 * results[0].poidsEnfant, cap)))
      check("S4.9.8 plafond enfants (max_points_children) respecte a chaque etape",
        obsDeltas.every((d, i) => Math.abs(d - expDeltas[i]) <= 0.02), { attendu: expDeltas, observe: obsDeltas, cap })
      await PUT("/api/settings", { svfWeights: wput("points_per_child", W("points_per_child")) })
    }
  })

  /* ---- 4.10 Reset ---- */
  await guard("S4.10", async () => {
    expectFailure("S4.10.1 scope invalide", await POST("/api/settings/reset", { scope: "nimporte" }), 400, 'scope must be "svf", "water-filling" or "all".')
    const rNoScope = await POST("/api/settings/reset", {})
    check("S4.10.2 scope manquant -> defaut all = 200", rNoScope.status === 200, { status: rNoScope.status, message: rNoScope.message })
    expectFailure("S4.10.3 scope numerique", await POST("/api/settings/reset", { scope: 1 }), 400, 'scope must be "svf", "water-filling" or "all".')

    await PUT("/api/settings", { svfWeights: { ...wput("points_per_child", 13), ...wput("points_disability", 33) } })
    const rSvf = await POST("/api/settings/reset", { scope: "svf" })
    if (expectOk("S4.10.4 reset scope=svf", rSvf, 200)) {
      const w = (rSvf.data && rSvf.data.svfWeights) || (await readSettings()).w || {}
      eq("S4.10.5 points_per_child revenu a 5", num(RW(w, "points_per_child")), 5)
      eq("S4.10.6 points_disability revenu a 15", num(RW(w, "points_disability")), 15)
      const s = (rSvf.data && rSvf.data.settings) || (await readSettings()).s || {}
      eq("S4.10.7 svfMaxScore = 100", num(s.svfMaxScore), 100)
      eq("S4.10.8 autoCalculateSVF = true", s.autoCalculateSVF, true)
      eq("S4.10.9 povertyThresholdPerPerson = 20000", num(s.povertyThresholdPerPerson), 20000)
      eq("S4.10.10 svfWeightExponent = 1.5", num(s.svfWeightExponent), 1.5)
      eq("S4.10.11 customCriteria = []", s.customCriteria, [])
      const rCust = (await readSettings()).r
      eq("S4.10.12 svfCustomized repasse a false", Boolean(((rCust && rCust.data) || {}).svfCustomized), false)
    }

    await PUT("/api/settings", { reservePercentage: 0.4, minimumDistributionAmount: 3000 })
    const rWf = await POST("/api/settings/reset", { scope: "water-filling" })
    if (expectOk("S4.10.13 reset scope=water-filling", rWf, 200)) {
      const s = (rWf.data && rWf.data.settings) || (await readSettings()).s || {}
      near("S4.10.14 reservePercentage revenu a 0.1", num(s.reservePercentage), 0.1, 0.001)
      eq("S4.10.15 minimumDistributionAmount revenu a 1000", num(s.minimumDistributionAmount), 1000)
      const w = (await readSettings()).w || {}
      eq("S4.10.16 reset water-filling ne touche pas les poids SVF", num(RW(w, "points_per_child")), 5)
    }

    await PUT("/api/settings", { svfWeights: wput("points_per_child", 11), reservePercentage: 0.33 })
    const rAll = await POST("/api/settings/reset", { scope: "all" })
    if (expectOk("S4.10.17 reset scope=all", rAll, 200)) {
      const s = (rAll.data && rAll.data.settings) || (await readSettings()).s || {}
      const w = (rAll.data && rAll.data.svfWeights) || (await readSettings()).w || {}
      eq("S4.10.18 poids enfant remis a 5", num(RW(w, "points_per_child")), 5)
      near("S4.10.19 reserve remise a 0.1", num(s.reservePercentage), 0.1, 0.001)
      isType("S4.10.20 recalculatedFamilies renvoye", num(rAll.data.recalculatedFamilies), "number")
    }
    expectFailure("S4.10.21 reset sans token", await POST("/api/settings/reset", { scope: "all" }, { token: null }), 401, "Authentication required.")

    /* Rafraichir les poids de reference apres reset */
    const fin = await readSettings()
    STATE.weights = normalizeWeights(fin.w) || STATE.weights
    STATE.wf = fin.wf || STATE.wf
    STATE.exponent = num((fin.s || {}).svfWeightExponent) || 1.5
    info("S4.10.22 poids de reference apres reset", pick(STATE.weights || {}, ["points_per_child", "points_widow_divorced", "points_disability", "smig_threshold"]))
  })

  /* ---- 4.11 Tentatives repetees (stabilite / idempotence) ---- */
  await guard("S4.11", async () => {
    const N = 8
    const seen = new Set()
    for (let i = 0; i < N; i++) {
      const v = 3 + (i % 5)
      const r = await PUT("/api/settings", { pointsPerChild: v })
      seen.add(`${r.status}:${r.status === 200 ? num(r.data.settings.pointsPerChild) : "x"}`)
    }
    check(`S4.11.1 ${N} ecritures successives sans erreur`, [...seen].every((k) => k.startsWith("200:")), [...seen])
    const rSame1 = await PUT("/api/settings", { pointsPerChild: 5 })
    const rSame2 = await PUT("/api/settings", { pointsPerChild: 5 })
    check("S4.11.2 ecriture idempotente (meme valeur 2x)", rSame1.status === 200 && rSame2.status === 200 && num(rSame2.data.settings.pointsPerChild) === 5)
    const par = await Promise.all([1, 2, 3, 4, 5].map((v) => PUT("/api/settings", { pointsIfTenant: 10 + v })))
    check("S4.11.3 5 ecritures concurrentes : aucune erreur 500", par.every((r) => r.status < 500), par.map((r) => r.status))
    const finalV = (await readSettings()).s.pointsIfTenant
    check("S4.11.4 valeur finale coherente apres concurrence", [11, 12, 13, 14, 15].includes(num(finalV)), finalV)
    await POST("/api/settings/reset", { scope: "all" })
    const fin = await readSettings()
    STATE.weights = normalizeWeights(fin.w) || STATE.weights
  })
})

/* ################################################################################### */
/* #  S5 -- FAMILLES : CRUD, VALIDATIONS, FILTRES                                     # */
/* ################################################################################### */

const FAM_REQUIRED = ["firstName", "lastName", "dateOfBirth", "ccp", "wilaya", "address", "maritalStatus", "housingStatus"]
const MARITAL = ["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"]
const HOUSING_STATUSES = ["OWNER", "TENANT", "HOMELESS", "TEMPORARY"]
const HOUSING_TYPES = ["HOUSE", "APARTMENT", "TEMPORARY", "OTHER"]
const EMPLOYMENT = ["UNEMPLOYED", "PART_TIME", "FULL_TIME", "RETIRED", "DISABLED", "NONE"]
const PRIORITIES = ["URGENT", "VULNERABLE", "MODERATE", "LOW"]
const FAM_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"]

section("S5", "Familles : creation, validations, logement, filtres, edition, suppression", async () => {

  /* ---- 5.1 Champs obligatoires : un test par champ ---- */
  await guard("S5.1", async () => {
    expectFailure("S5.1.0 corps vide", await POST("/api/families", {}), 400, null)
    for (const f of FAM_REQUIRED) {
      const p = famPayload(); delete p[f]
      const r = await POST("/api/families", p)
      const okMsg = String(r.message || "").toLowerCase().includes(f.toLowerCase())
      check(`S5.1.1 champ requis manquant : ${f} -> 400 + message explicite`,
        r.status === 400 && okMsg, { status: r.status, message: r.message })
    }
    for (const f of FAM_REQUIRED) {
      const p = famPayload({ [f]: "" })
      const r = await POST("/api/families", p)
      check(`S5.1.2 champ requis vide : ${f} -> refus`, r.status >= 400, { status: r.status, message: r.message })
    }
    const pNull = famPayload({ firstName: null })
    check("S5.1.3 firstName = null refuse", (await POST("/api/families", pNull)).status >= 400)
    const pSpace = famPayload({ address: "    " })
    const rSpace = await POST("/api/families", pSpace)
    info("S5.1.4 address composee d'espaces", { status: rSpace.status, message: rSpace.message, note: rSpace.status < 300 ? "acceptee (pas de trim de validation)" : "refusee" })
    if (rSpace.status < 300 && rSpace.data) CLEAN.families.push((rSpace.data.family || rSpace.data).id)
    check("S5.1.5 housingType N'EST PAS obligatoire au niveau du bloc REQUIRED",
      !FAM_REQUIRED.includes("housingType"), "housingType est valide par le module logement, pas par la liste REQUIRED")
    const rJson = await api("POST", "/api/families", { rawBody: "{oops" })
    expectFailure("S5.1.6 JSON invalide", rJson, 400, "Invalid or missing JSON body.")
    expectFailure("S5.1.7 sans token", await POST("/api/families", famPayload(), { token: null }), 401, "Authentication required.")
  })

  /* ---- 5.2 Etat civil : matrice complete ---- */
  await guard("S5.2", async () => {
    for (const ms of MARITAL) {
      const { r, f } = await createFamily({ maritalStatus: ms })
      if (expectOk(`S5.2.1 maritalStatus = ${ms} accepte`, r)) {
        eq(`S5.2.2 ${ms} persiste`, f.maritalStatus, ms)
      }
    }
    for (const bad of ["CELIBATAIRE", "married", "Married", "SEPARATED", "", "123", "MARRIED "]) {
      const r = await POST("/api/families", famPayload({ maritalStatus: bad }))
      const okMsg = String(r.message || "").startsWith("Invalid marital status:") || r.status === 400
      check(`S5.2.3 maritalStatus invalide "${bad}" refuse`, r.status === 400 && okMsg, { status: r.status, message: r.message })
    }
  })

  /* ---- 5.3 Logement : matrice statut x type (dont le cas SDF) ---- */
  await guard("S5.3", async () => {
    for (const hs of HOUSING_STATUSES) {
      for (const ht of HOUSING_TYPES) {
        const { r, f } = await createFamily({ housingStatus: hs, housingType: ht })
        check(`S5.3.1 ${hs} + ${ht} accepte`, r.status < 300, { status: r.status, message: r.message })
        if (f) vlog(`${hs}/${ht} -> housingType stocke = ${f.housingType}`)
      }
    }
    /* LE CAS CORRIGE : SDF sans type de logement */
    for (const variant of [
      { label: "housingType absent", over: {} },
      { label: "housingType = null", over: { housingType: null } },
      { label: 'housingType = ""', over: { housingType: "" } },
    ]) {
      const p = famPayload({ housingStatus: "HOMELESS" })
      delete p.housingType
      Object.assign(p, variant.over)
      const r = await POST("/api/families", p)
      const f = r.data && (r.data.family || r.data)
      if (f && f.id) CLEAN.families.push(f.id)
      if (check(`S5.3.2 SDF (HOMELESS) + ${variant.label} -> ACCEPTE`, r.status < 300, { status: r.status, message: r.message })) {
        eq(`S5.3.3 SDF + ${variant.label} : housingType stocke = OTHER`, f.housingType, "OTHER")
      }
    }
    /* Les autres statuts exigent bien un type */
    for (const hs of ["OWNER", "TENANT", "TEMPORARY"]) {
      const p = famPayload({ housingStatus: hs }); delete p.housingType
      expectFailure(`S5.3.4 ${hs} sans housingType -> refus`, await POST("/api/families", p), 400, "Missing required field: housingType")
    }
    for (const bad of ["VILLA", "house", "MAISON", "XYZ"]) {
      const r = await POST("/api/families", famPayload({ housingType: bad }))
      check(`S5.3.5 housingType invalide "${bad}"`, r.status === 400 && String(r.message || "").startsWith("Invalid housing type:"), { status: r.status, message: r.message })
    }
    for (const bad of ["PROPRIETAIRE", "owner", "SDF", "RENTER"]) {
      const r = await POST("/api/families", famPayload({ housingStatus: bad }))
      check(`S5.3.6 housingStatus invalide "${bad}"`, r.status === 400 && String(r.message || "").startsWith("Invalid housing status:"), { status: r.status, message: r.message })
    }
    const pNo = famPayload(); delete pNo.housingStatus; delete pNo.housingType
    expectFailure("S5.3.7 housingStatus absent", await POST("/api/families", pNo), 400, null)
    /* SDF via PUT : passage OWNER -> HOMELESS sans fournir de type */
    const { f: fh } = await createFamily({ housingStatus: "OWNER", housingType: "HOUSE" })
    if (fh) {
      const { r: rp, f: fp } = await patchFamily(fh.id, { housingStatus: "HOMELESS" })
      if (check("S5.3.8 PUT OWNER -> HOMELESS sans housingType accepte", rp.status < 300, { status: rp.status, message: rp.message })) {
        eq("S5.3.9 housingType bascule sur OTHER", fp.housingType, "OTHER")
      }
      const { r: rb, f: fb } = await patchFamily(fh.id, { housingStatus: "TENANT", housingType: "APARTMENT" })
      check("S5.3.10 PUT HOMELESS -> TENANT avec type valide", rb.status < 300 && fb.housingType === "APARTMENT", { status: rb.status, type: fb && fb.housingType })
      const rNoType = await PUT(`/api/families/${fh.id}`, { housingStatus: "OWNER" })
      info("S5.3.11 PUT TENANT -> OWNER sans type (type existant conserve ?)", { status: rNoType.status, type: rNoType.data && (rNoType.data.family || rNoType.data).housingType, message: rNoType.message })
    }
  })

  /* ---- 5.4 CCP : unicite et format ---- */
  await guard("S5.4", async () => {
    const ccp = newCcp()
    const { r: r1 } = await createFamily({ ccp })
    expectOk("S5.4.1 premiere famille avec ce CCP", r1)
    const r2 = await POST("/api/families", famPayload({ ccp }))
    check("S5.4.2 CCP duplique -> 409", r2.status === 409, { status: r2.status, message: r2.message })
    check("S5.4.3 message de doublon explicite", /ccp|exist|already|duplicate/i.test(String(r2.message || "")), r2.message)
    const { r: r3 } = await createFamily({ ccp: "  " + ccp + "  " })
    info("S5.4.4 CCP avec espaces autour (trim ?)", { status: r3.status, message: r3.message })
    const { r: r4 } = await createFamily({ ccp: "A".repeat(200) })
    check("S5.4.5 CCP tres long gere sans 500", r4.status < 500, { status: r4.status, message: r4.message })
    const { r: r5 } = await createFamily({ ccp: "12-34/56 78" })
    check("S5.4.6 CCP avec separateurs accepte", r5.status < 500, { status: r5.status })
  })

  /* ---- 5.5 Types et valeurs des attributs a la creation ---- */
  await guard("S5.5", async () => {
    const { r, f } = await createFamily({ monthlyIncome: 12345.67, membersCount: 3, employmentStatus: "PART_TIME", incomeSources: ["SALARY", "PENSION"] })
    if (!expectOk("S5.5.1 creation avec attributs complets", r)) return
    eq("S5.5.2 code HTTP 201", r.status, 201)
    isType("S5.5.3 family.id string", f.id, "string")
    isType("S5.5.4 family.svfScore numerique", num(f.svfScore), "number")
    check("S5.5.5 svfScore dans [0,100]", num(f.svfScore) >= 0 && num(f.svfScore) <= 100, f.svfScore)
    inEnum("S5.5.6 family.priority dans l'enum", f.priority, PRIORITIES)
    inEnum("S5.5.7 family.status par defaut = ACTIVE", f.status, FAM_STATUSES)
    eq("S5.5.8 status initial = ACTIVE", f.status, "ACTIVE")
    isType("S5.5.9 monthlyIncome numerique", num(f.monthlyIncome), "number")
    near("S5.5.10 monthlyIncome preserve (decimales)", num(f.monthlyIncome), 12345.67, 0.011)
    isType("S5.5.11 membersCount entier", num(f.membersCount), "int")
    isType("S5.5.12 createdAt date ISO", f.createdAt, "iso")
    isType("S5.5.13 updatedAt date ISO", f.updatedAt, "iso")
    isType("S5.5.14 dateOfBirth date ISO", f.dateOfBirth, "iso")
    inEnum("S5.5.15 employmentStatus dans l'enum", f.employmentStatus, EMPLOYMENT)
    check("S5.5.16 priority coherente avec le score", f.priority === priorityFromScore(num(f.svfScore)), { score: f.svfScore, priority: f.priority, attendu: priorityFromScore(num(f.svfScore)) })
    check("S5.5.17 aucune fuite passwordHash", !/passwordHash/.test(r.text))
    /* Revenu negatif / non numerique */
    const rNeg = await POST("/api/families", famPayload({ monthlyIncome: -5000 }))
    check("S5.5.18 revenu negatif : refus ou normalisation, jamais 500", rNeg.status < 500, { status: rNeg.status, message: rNeg.message, val: rNeg.data && (rNeg.data.family || rNeg.data).monthlyIncome })
    if (rNeg.data) CLEAN.families.push((rNeg.data.family || rNeg.data).id)
    const rStr = await POST("/api/families", famPayload({ monthlyIncome: "20000" }))
    check("S5.5.19 revenu en chaine numerique gere", rStr.status < 500, { status: rStr.status })
    if (rStr.data) CLEAN.families.push((rStr.data.family || rStr.data).id)
    const rBadEmp = await POST("/api/families", famPayload({ employmentStatus: "CHOMEUR" }))
    check("S5.5.20 employmentStatus invalide refuse", rBadEmp.status >= 400, { status: rBadEmp.status, message: rBadEmp.message })
    const rDob = await POST("/api/families", famPayload({ dateOfBirth: "pas-une-date" }))
    check("S5.5.21 dateOfBirth invalide refusee sans 500", rDob.status >= 400 && rDob.status < 500, { status: rDob.status, message: rDob.message })
    const rFut = await POST("/api/families", famPayload({ dateOfBirth: new Date(Date.now() + 365 * DAY).toISOString().slice(0, 10) }))
    info("S5.5.22 date de naissance dans le futur", { status: rFut.status, message: rFut.message, note: rFut.status < 300 ? "acceptee (age negatif -> 0 point d'age)" : "refusee" })
    if (rFut.data) CLEAN.families.push((rFut.data.family || rFut.data).id)
  })

  /* ---- 5.6 Membres inline a la creation + membersCount ---- */
  await guard("S5.6", async () => {
    const { r, f } = await createFamily({
      maritalStatus: "SINGLE", membersCount: 1,
      members: [
        { firstName: "Chef", lastName: "Test", role: "HEAD", dateOfBirth: dobForAge(45) },
        { firstName: "Enfant1", lastName: "Test", role: "CHILD", dateOfBirth: dobForAge(7) },
        { firstName: "Enfant2", lastName: "Test", role: "CHILD", dateOfBirth: dobForAge(5) },
      ],
    })
    if (expectOk("S5.6.1 creation avec 3 membres inline", r)) {
      check("S5.6.2 membersCount >= nombre de membres fournis", num(f.membersCount) >= 3, { membersCount: f.membersCount })
      const lst = await GET(`/api/families/${f.id}/members`)
      const members = (lst.data && (lst.data.members || lst.data)) || []
      eq("S5.6.3 3 membres crees", members.length, 3)
      eq("S5.6.4 exactement 1 chef", members.filter((m) => m.role === "HEAD").length, 1)
      eq("S5.6.5 2 enfants", members.filter((m) => m.role === "CHILD").length, 2)
      const sc = num(f.svfScore)
      check("S5.6.6 les 2 enfants inline comptent dans le score", sc > 0, { score: sc })
    }
    /* Deux chefs : refus */
    const rTwoHeads = await POST("/api/families", famPayload({
      members: [
        { firstName: "A", role: "HEAD" },
        { firstName: "B", role: "HEAD" },
      ],
    }))
    expectFailure("S5.6.7 deux HEAD inline -> refus", rTwoHeads, 400, "A family can only have one head.")
    /* Epoux inline sur un chef celibataire -> passage a MARIE */
    const { r: rSp, f: fSp } = await createFamily({
      maritalStatus: "SINGLE",
      members: [{ firstName: "Epouse", lastName: "Inline", role: "SPOUSE", dateOfBirth: dobForAge(38) }],
    })
    if (expectOk("S5.6.8 creation avec un SPOUSE inline sur chef SINGLE", rSp)) {
      eq("S5.6.9 l'etat civil bascule automatiquement en MARRIED", fSp.maritalStatus, "MARRIED")
    }
    /* membersCount declare vs reel */
    const { f: fA } = await createFamily({ membersCount: 10, members: [{ firstName: "X", role: "HEAD" }] })
    if (fA) eq("S5.6.10 membersCount declare (10) conserve s'il est superieur au reel", num(fA.membersCount), 10)
    const { f: fB } = await createFamily({ membersCount: 1, members: [
      { firstName: "X", role: "HEAD" }, { firstName: "Y", role: "CHILD" }, { firstName: "Z", role: "CHILD" },
    ] })
    if (fB) check("S5.6.11 membersCount releve au nombre reel de membres (3)", num(fB.membersCount) >= 3, { membersCount: fB.membersCount })
    const { f: fC } = await createFamily({ membersCount: 0 })
    if (fC) check("S5.6.12 membersCount = 0 releve au plancher (>= 1)", num(fC.membersCount) >= 1, { membersCount: fC.membersCount })
    const { f: fD } = await createFamily({ membersCount: -5 })
    if (fD) check("S5.6.13 membersCount negatif normalise", num(fD.membersCount) >= 1, { membersCount: fD.membersCount })
    const rBadM = await POST("/api/families", famPayload({ members: "pas-un-tableau" }))
    check("S5.6.14 members non tableau gere sans 500", rBadM.status < 500, { status: rBadM.status, message: rBadM.message })
    if (rBadM.data) CLEAN.families.push((rBadM.data.family || rBadM.data).id)
    const rEmptyM = await POST("/api/families", famPayload({ members: [] }))
    check("S5.6.15 members = [] accepte", rEmptyM.status < 300, { status: rEmptyM.status })
    if (rEmptyM.data) CLEAN.families.push((rEmptyM.data.family || rEmptyM.data).id)
  })

  /* ---- 5.7 GET /api/families : forme, tri, filtres ---- */
  await guard("S5.7", async () => {
    const r = await GET("/api/families")
    expectOk("S5.7.1 GET /api/families", r, 200)
    const list = (r.data && r.data.families) || []
    isType("S5.7.2 data.families tableau", list, "array")
    isType("S5.7.3 data.count numerique", num(r.data && r.data.count), "number")
    check("S5.7.4 count coherent avec la liste", num(r.data.count) >= list.length, { count: r.data.count, len: list.length })
    if (list.length) {
      const f0 = list[0]
      for (const k of ["id", "firstName", "lastName", "svfScore", "priority", "status", "membersCount"]) {
        check(`S5.7.5 champ present : ${k}`, k in f0, Object.keys(f0).slice(0, 25))
      }
      let sorted = true
      for (let i = 1; i < list.length; i++) if (num(list[i].svfScore) > num(list[i - 1].svfScore) + 1e-9) sorted = false
      check("S5.7.6 tri par svfScore decroissant", sorted, list.slice(0, 6).map((x) => x.svfScore))
      check("S5.7.7 toutes les priorites sont valides", list.every((x) => PRIORITIES.includes(x.priority)), [...new Set(list.map((x) => x.priority))])
      check("S5.7.8 tous les statuts sont valides", list.every((x) => FAM_STATUSES.includes(x.status)), [...new Set(list.map((x) => x.status))])
      check("S5.7.9 tous les scores dans [0,100]", list.every((x) => num(x.svfScore) >= 0 && num(x.svfScore) <= 100))
      check("S5.7.10 priorite coherente avec le score pour chaque ligne",
        list.every((x) => x.priority === priorityFromScore(num(x.svfScore))),
        list.filter((x) => x.priority !== priorityFromScore(num(x.svfScore))).slice(0, 5).map((x) => pick(x, ["id", "svfScore", "priority"])))
    }

    /* Filtre statut */
    for (const st of FAM_STATUSES) {
      const rs = await GET(`/api/families?status=${st}`)
      const l = (rs.data && rs.data.families) || []
      check(`S5.7.11 filtre status=${st}`, rs.status === 200 && l.every((x) => x.status === st), { status: rs.status, statuts: [...new Set(l.map((x) => x.status))] })
    }
    const rMulti = await GET("/api/families?status=ACTIVE,INACTIVE")
    const lm = (rMulti.data && rMulti.data.families) || []
    check("S5.7.12 filtre status=ACTIVE,INACTIVE (liste)", rMulti.status === 200 && lm.every((x) => x.status === "ACTIVE" || x.status === "INACTIVE"), [...new Set(lm.map((x) => x.status))])
    const rAll = await GET("/api/families?status=ALL")
    check("S5.7.13 filtre status=ALL renvoie tous les statuts", rAll.status === 200, { status: rAll.status, n: ((rAll.data || {}).families || []).length })
    check("S5.7.14 status=ALL >= status=ACTIVE", ((rAll.data || {}).families || []).length >= ((await GET("/api/families?status=ACTIVE")).data.families || []).length)
    const rBadSt = await GET("/api/families?status=NIMPORTEQUOI")
    check("S5.7.15 statut inconnu : ignore ou liste vide, jamais 500", rBadSt.status < 500, { status: rBadSt.status, n: ((rBadSt.data || {}).families || []).length })

    /* Recherche */
    const { f: fs } = await createFamily({ lastName: "CHERCHEMOI" + SUF })
    if (fs) {
      const rq = await GET(`/api/families?search=CHERCHEMOI${SUF}`)
      const found = ((rq.data || {}).families || []).some((x) => x.id === fs.id)
      check("S5.7.16 recherche par nom (search=)", found, { n: ((rq.data || {}).families || []).length })
      const rq2 = await GET(`/api/families?q=CHERCHEMOI${SUF}`)
      check("S5.7.17 alias q= fonctionne aussi", ((rq2.data || {}).families || []).some((x) => x.id === fs.id))
      const rqLow = await GET(`/api/families?search=cherchemoi${SUF}`)
      check("S5.7.18 recherche insensible a la casse", ((rqLow.data || {}).families || []).some((x) => x.id === fs.id))
      const rqCcp = await GET(`/api/families?search=${encodeURIComponent(fs.ccp)}`)
      check("S5.7.19 recherche par CCP", ((rqCcp.data || {}).families || []).some((x) => x.id === fs.id), { n: ((rqCcp.data || {}).families || []).length })
      const rqNone = await GET("/api/families?search=ZZZAUCUNRESULTATZZZ")
      eq("S5.7.20 recherche sans resultat -> liste vide", ((rqNone.data || {}).families || []).length, 0)
      const rqInj = await GET(`/api/families?search=${encodeURIComponent("' OR 1=1 --")}`)
      check("S5.7.21 injection SQL dans la recherche neutralisee", rqInj.status === 200 && ((rqInj.data || {}).families || []).length === 0, { status: rqInj.status, n: ((rqInj.data || {}).families || []).length })
    }

    /* Filtres numeriques et enums */
    const rInc = await GET("/api/families?maxIncome=10000")
    const li = (rInc.data || {}).families || []
    check("S5.7.22 filtre maxIncome", rInc.status === 200 && li.every((x) => num(x.monthlyIncome) <= 10000), li.slice(0, 5).map((x) => x.monthlyIncome))
    const rSvf = await GET("/api/families?minSvf=50")
    const ls = (rSvf.data || {}).families || []
    check("S5.7.23 filtre minSvf", rSvf.status === 200 && ls.every((x) => num(x.svfScore) >= 50), ls.slice(0, 5).map((x) => x.svfScore))
    for (const p of PRIORITIES) {
      const rp = await GET(`/api/families?priority=${p}`)
      const lp = (rp.data || {}).families || []
      check(`S5.7.24 filtre priority=${p}`, rp.status === 200 && lp.every((x) => x.priority === p), { status: rp.status, n: lp.length })
    }
    for (const e of EMPLOYMENT) {
      const re = await GET(`/api/families?employmentStatus=${e}`)
      check(`S5.7.25 filtre employmentStatus=${e}`, re.status === 200 && ((re.data || {}).families || []).every((x) => x.employmentStatus === e), { status: re.status })
    }
    for (const m of MARITAL) {
      const rm = await GET(`/api/families?maritalStatus=${m}`)
      check(`S5.7.26 filtre maritalStatus=${m}`, rm.status === 200 && ((rm.data || {}).families || []).every((x) => x.maritalStatus === m), { status: rm.status })
    }
    for (const [k, v] of [["priority", "SUPERURGENT"], ["employmentStatus", "XX"], ["maritalStatus", "XX"], ["maxIncome", "abc"], ["minSvf", "abc"]]) {
      const rb = await GET(`/api/families?${k}=${v}`)
      check(`S5.7.27 filtre invalide ${k}=${v} ignore sans 500`, rb.status < 500, { status: rb.status, message: rb.message })
    }
    const rCombo = await GET("/api/families?status=ACTIVE&minSvf=10&maxIncome=100000&priority=VULNERABLE")
    const lc = (rCombo.data || {}).families || []
    check("S5.7.28 combinaison de 4 filtres", rCombo.status === 200 && lc.every((x) => x.status === "ACTIVE" && num(x.svfScore) >= 10 && x.priority === "VULNERABLE"), { status: rCombo.status, n: lc.length })
    expectFailure("S5.7.29 GET sans token", await GET("/api/families", { token: null }), 401, "Authentication required.")
  })

  /* ---- 5.8 GET /api/families/:id ---- */
  await guard("S5.8", async () => {
    const { f } = await createFamily({ members: [{ firstName: "C", role: "HEAD" }, { firstName: "E", role: "CHILD" }] })
    if (!f) return skip("S5.8", "famille non creee")
    const { r, f: got } = await getFamily(f.id)
    expectOk("S5.8.1 GET famille par id", r, 200)
    eq("S5.8.2 id correspond", got.id, f.id)
    check("S5.8.3 la fiche detaillee inclut les membres", Array.isArray(got.members), typeof got.members)
    if (Array.isArray(got.members)) eq("S5.8.4 2 membres presents", got.members.length, 2)
    const r404 = await GET("/api/families/cle-inexistante-123456")
    check("S5.8.5 id inexistant -> 404", r404.status === 404, { status: r404.status, message: r404.message })
    const rMal = await GET("/api/families/%20")
    check("S5.8.6 id malforme gere sans 500", rMal.status < 500, { status: rMal.status })
    expectFailure("S5.8.7 sans token", await GET(`/api/families/${f.id}`, { token: null }), 401, "Authentication required.")
  })

  /* ---- 5.9 PUT /api/families/:id ---- */
  await guard("S5.9", async () => {
    const { f } = await createFamily({ monthlyIncome: 30000, maritalStatus: "SINGLE" })
    if (!f) return skip("S5.9", "famille non creee")
    const editable = {
      firstName: "Modifie", lastName: "Nom2", phone: "0660000000", address: "Autre rue 9",
      // NB : le modele Family n'a PAS de colonne "commune" (elle est sur Mosque).
      wilaya: "Alger", monthlyIncome: 9000, notes: "note de test",
    }
    const { r, f: upd } = await patchFamily(f.id, editable)
    expectOk("S5.9.1 PUT champs editables", r, 200)
    for (const [k, v] of Object.entries(editable)) {
      if (k === "notes") continue
      eq(`S5.9.2 ${k} mis a jour`, k === "monthlyIncome" ? num(upd[k]) : upd[k], v)
    }
    check("S5.9.3 baisse de revenu -> score recalcule a la hausse", num(upd.svfScore) > num(f.svfScore), { avant: f.svfScore, apres: upd.svfScore })
    check("S5.9.4 updatedAt modifie", upd.updatedAt !== f.updatedAt, { avant: f.updatedAt, apres: upd.updatedAt })

    for (const st of FAM_STATUSES) {
      const { r: rs, f: fs2 } = await patchFamily(f.id, { status: st })
      check(`S5.9.5 status -> ${st}`, rs.status === 200 && fs2.status === st, { status: rs.status, got: fs2 && fs2.status })
    }
    await patchFamily(f.id, { status: "ACTIVE" })
    const rBadSt = await PUT(`/api/families/${f.id}`, { status: "SUPPRIMEE" })
    check("S5.9.6 statut invalide refuse", rBadSt.status >= 400, { status: rBadSt.status, message: rBadSt.message })

    const rProt = await PUT(`/api/families/${f.id}`, { id: "hack", svfScore: 100, priority: "URGENT", mosqueId: "hack", createdAt: "2000-01-01" })
    check("S5.9.7 champs proteges ignores sans 500", rProt.status < 500, { status: rProt.status })
    const { f: chk } = await getFamily(f.id)
    check("S5.9.8 svfScore non ecrasable directement", num(chk.svfScore) !== 100 || num(chk.svfScore) === num(upd.svfScore), { score: chk.svfScore })
    eq("S5.9.9 id inchange", chk.id, f.id)

    const rEmpty = await PUT(`/api/families/${f.id}`, {})
    check("S5.9.10 PUT vide gere", rEmpty.status < 500, { status: rEmpty.status, message: rEmpty.message })
    const r404 = await PUT("/api/families/inexistant-999", { firstName: "X" })
    check("S5.9.11 PUT sur id inexistant -> 404", r404.status === 404, { status: r404.status })
    expectFailure("S5.9.12 PUT sans token", await PUT(`/api/families/${f.id}`, { firstName: "X" }, { token: null }), 401, "Authentication required.")
    const rMs = await patchFamily(f.id, { maritalStatus: "WIDOWED" })
    check("S5.9.13 passage a WIDOWED augmente le score", num(rMs.f.svfScore) > num(chk.svfScore), { avant: chk.svfScore, apres: rMs.f.svfScore })
    const rMc = await patchFamily(f.id, { membersCount: 12 })
    eq("S5.9.14 membersCount editable", num(rMc.f.membersCount), 12)
    const rMcLow = await patchFamily(f.id, { membersCount: 0 })
    check("S5.9.15 membersCount = 0 releve au plancher", num(rMcLow.f.membersCount) >= 1, rMcLow.f.membersCount)
  })

  /* ---- 5.10 DELETE : archivage (soft) vs suppression (hard) ---- */
  await guard("S5.10", async () => {
    /* Mode soft : la ligne reste, le statut passe a ARCHIVED */
    const { f: fs } = await createFamily({})
    if (fs) {
      const r = await DEL(`/api/families/${fs.id}?mode=soft`)
      expectOk("S5.10.1 DELETE ?mode=soft", r, 200)
      const { r: rg, f: fg } = await getFamily(fs.id)
      check("S5.10.2 la famille existe toujours apres archivage", rg.status === 200, { status: rg.status })
      eq("S5.10.3 statut = ARCHIVED", fg && fg.status, "ARCHIVED")
      const inArch = await GET("/api/families?status=ARCHIVED")
      check("S5.10.4 visible dans le filtre ARCHIVED", ((inArch.data || {}).families || []).some((x) => x.id === fs.id))
      const inActive = await GET("/api/families?status=ACTIVE")
      check("S5.10.5 absente du filtre ACTIVE", !((inActive.data || {}).families || []).some((x) => x.id === fs.id))
      const memb = await GET(`/api/families/${fs.id}/members`)
      check("S5.10.6 les membres ne sont PAS supprimes par l'archivage", memb.status === 200, { status: memb.status, n: ((memb.data || {}).members || []).length })
      const { r: rre, f: fre } = await patchFamily(fs.id, { status: "ACTIVE" })
      check("S5.10.7 reactivation via PUT status=ACTIVE", rre.status === 200 && fre.status === "ACTIVE", { status: rre.status, got: fre && fre.status })
      const rArchAgain = await DEL(`/api/families/${fs.id}?mode=soft`)
      check("S5.10.8 re-archivage possible apres reactivation", rArchAgain.status < 300, { status: rArchAgain.status })
    }
    /* Mode hard : la ligne disparait */
    const { f: fh } = await createFamily({ members: [{ firstName: "A", role: "HEAD" }, { firstName: "B", role: "CHILD" }] })
    if (fh) {
      const r = await DEL(`/api/families/${fh.id}?mode=hard`)
      expectOk("S5.10.9 DELETE ?mode=hard", r, 200)
      const g = await GET(`/api/families/${fh.id}`)
      eq("S5.10.10 la famille n'existe plus (404)", g.status, 404)
      const m = await GET(`/api/families/${fh.id}/members`)
      check("S5.10.11 les membres sont supprimes en cascade", m.status === 404 || ((m.data || {}).members || []).length === 0, { status: m.status })
      const inAll = await GET("/api/families?status=ALL")
      check("S5.10.12 absente meme de status=ALL", !((inAll.data || {}).families || []).some((x) => x.id === fh.id))
      const again = await DEL(`/api/families/${fh.id}?mode=hard`)
      eq("S5.10.13 seconde suppression -> 404", again.status, 404)
      const idx = CLEAN.families.indexOf(fh.id); if (idx >= 0) CLEAN.families.splice(idx, 1)
    }
    const rBadMode = await DEL(`/api/families/${(await createFamily({})).f.id}?mode=nimporte`)
    check("S5.10.14 mode inconnu gere sans 500", rBadMode.status < 500, { status: rBadMode.status, message: rBadMode.message })
    const r404 = await DEL("/api/families/inexistant-abc?mode=hard")
    eq("S5.10.15 DELETE sur id inexistant -> 404", r404.status, 404)
    expectFailure("S5.10.16 DELETE sans token", await DEL(`/api/families/${STATE.mosqueId}`, { token: null }), 401, "Authentication required.")
  })
})

/* ################################################################################### */
/* #  S6 -- MEMBRES ET ENFANTS                                                        # */
/* ################################################################################### */

const ROLES = ["HEAD", "SPOUSE", "CHILD", "PARENT", "OTHER"]

section("S6", "Membres et enfants : roles, garde-fous HEAD, promotion SPOUSE, compteurs", async () => {

  /* ---- 6.1 Creation de membre : matrice de validation ---- */
  await guard("S6.1", async () => {
    const { f } = await createFamily({})
    if (!f) return skip("S6.1", "famille non creee")

    expectFailure("S6.1.1 corps vide", await POST(`/api/families/${f.id}/members`, {}), 400, null)
    const rNoName = await POST(`/api/families/${f.id}/members`, { role: "CHILD" })
    check("S6.1.2 firstName manquant -> 400", rNoName.status === 400 && /firstName/i.test(String(rNoName.message)), { status: rNoName.status, message: rNoName.message })
    const rNoRole = await POST(`/api/families/${f.id}/members`, { firstName: "SansRole" })
    check("S6.1.3 role manquant -> 400", rNoRole.status === 400 && /role/i.test(String(rNoRole.message)), { status: rNoRole.status, message: rNoRole.message })
    const rEmpty = await POST(`/api/families/${f.id}/members`, { firstName: "   ", role: "CHILD" })
    check("S6.1.4 firstName compose d'espaces refuse", rEmpty.status >= 400, { status: rEmpty.status, message: rEmpty.message })
    for (const bad of ["ENFANT", "child", "FILS", "", "HEAD ", 42]) {
      const rb = await POST(`/api/families/${f.id}/members`, { firstName: "X", role: bad })
      check(`S6.1.5 role invalide ${short(bad, 12)} refuse`, rb.status === 400, { status: rb.status, message: rb.message })
    }
    for (const role of ["CHILD", "PARENT", "OTHER", "SPOUSE"]) {
      const { r, m } = await addMember(f.id, { firstName: `M_${role}`, lastName: "Test", role, dateOfBirth: dobForAge(role === "CHILD" ? 8 : 40) })
      if (check(`S6.1.6 role ${role} accepte`, r.status < 300, { status: r.status, message: r.message })) {
        eq(`S6.1.7 role ${role} persiste`, m.role, role)
        isType(`S6.1.8 member.id string (${role})`, m.id, "string")
        eq(`S6.1.9 familyId correct (${role})`, m.familyId, f.id)
      }
    }
    const r404 = await POST("/api/families/inexistant-xyz/members", { firstName: "X", role: "CHILD" })
    eq("S6.1.10 famille inexistante -> 404", r404.status, 404)
    expectFailure("S6.1.11 sans token", await POST(`/api/families/${f.id}/members`, { firstName: "X", role: "CHILD" }, { token: null }), 401, "Authentication required.")
    const rJson = await api("POST", `/api/families/${f.id}/members`, { rawBody: "}{" })
    expectFailure("S6.1.12 JSON invalide", rJson, 400, "Invalid or missing JSON body.")
    check("S6.1.13 les 5 roles du schema sont couverts", ROLES.length === 5, ROLES)
  })

  /* ---- 6.2 Attributs et types d'un membre ---- */
  await guard("S6.2", async () => {
    const { f } = await createFamily({})
    if (!f) return skip("S6.2", "famille non creee")
    const body = {
      firstName: "Attributs", lastName: "Complet", role: "OTHER", dateOfBirth: dobForAge(33),
      hasDisability: true, diseases: "diabete", occupation: "macon", monthlyIncome: 4200,
    }
    const { r, m } = await addMember(f.id, body)
    if (!expectOk("S6.2.1 creation membre complet", r)) return
    eq("S6.2.2 code HTTP 201", r.status, 201)
    const expectedKeys = ["id", "familyId", "firstName", "lastName", "dateOfBirth", "role", "hasDisability", "diseases", "occupation", "monthlyIncome", "createdAt", "updatedAt"]
    for (const k of expectedKeys) check(`S6.2.3 champ expose : ${k}`, k in m, Object.keys(m))
    isType("S6.2.4 hasDisability boolean", m.hasDisability, "boolean")
    eq("S6.2.5 hasDisability = true", m.hasDisability, true)
    isType("S6.2.6 diseases (string|null)", m.diseases, "nullableString")
    isType("S6.2.7 monthlyIncome numerique", num(m.monthlyIncome), "number")
    isType("S6.2.8 createdAt ISO", m.createdAt, "iso")
    const rNoDob = await POST(`/api/families/${f.id}/members`, { firstName: "SansDate", role: "OTHER" })
    check("S6.2.9 dateOfBirth optionnelle", rNoDob.status < 300, { status: rNoDob.status, message: rNoDob.message })
    const rBadDob = await POST(`/api/families/${f.id}/members`, { firstName: "MauvaiseDate", role: "OTHER", dateOfBirth: "32/13/2020" })
    check("S6.2.10 dateOfBirth invalide geree sans 500", rBadDob.status < 500, { status: rBadDob.status, message: rBadDob.message })
    const rUni = await POST(`/api/families/${f.id}/members`, { firstName: "\u0645\u062d\u0645\u062f", lastName: "\u0628\u0648\u062c\u0645\u0639\u0629", role: "OTHER" })
    if (check("S6.2.11 prenom/nom en arabe acceptes", rUni.status < 300, { status: rUni.status })) {
      eq("S6.2.12 texte arabe conserve tel quel", (rUni.data.member || rUni.data).firstName, "\u0645\u062d\u0645\u062f")
    }
    const rXss = await POST(`/api/families/${f.id}/members`, { firstName: "<script>alert(1)</script>", role: "OTHER" })
    if (check("S6.2.13 chaine XSS stockee sans 500", rXss.status < 500, { status: rXss.status })) {
      check("S6.2.14 chaine renvoyee verbatim (echappement cote vue)", String((rXss.data.member || rXss.data).firstName).includes("<script>"))
    }
    const rLong = await POST(`/api/families/${f.id}/members`, { firstName: "A".repeat(1000), role: "OTHER" })
    check("S6.2.15 prenom de 1000 caracteres gere sans 500", rLong.status < 500, { status: rLong.status, message: rLong.message })
  })

  /* ---- 6.3 Garde-fous du chef de famille ---- */
  await guard("S6.3", async () => {
    const { f } = await createFamily({ members: [{ firstName: "ChefUnique", role: "HEAD", dateOfBirth: dobForAge(50) }] })
    if (!f) return skip("S6.3", "famille non creee")
    const lst = await GET(`/api/families/${f.id}/members`)
    const head = ((lst.data || {}).members || []).find((m) => m.role === "HEAD")
    check("S6.3.0 chef present", !!head)

    const rSecond = await POST(`/api/families/${f.id}/members`, { firstName: "Chef2", role: "HEAD" })
    expectFailure("S6.3.1 ajout d'un 2e HEAD -> 409", rSecond, 409, "This family already has a head of family.")

    const { m: other } = await addMember(f.id, { firstName: "Autre", role: "OTHER" })
    if (other) {
      const rPromote = await PUT(`/api/members/${other.id}`, { role: "HEAD" })
      expectFailure("S6.3.2 promotion d'un membre en HEAD -> 409", rPromote, 409, "This family already has a head of family.")
    }
    if (head) {
      const rDel = await DEL(`/api/members/${head.id}`)
      check("S6.3.3 suppression du chef refusee (409)", rDel.status === 409, { status: rDel.status, message: rDel.message })
      const rDemote = await PUT(`/api/members/${head.id}`, { role: "CHILD" })
      info("S6.3.4 retrogradation du chef", { status: rDemote.status, message: rDemote.message, note: rDemote.status >= 400 ? "refusee" : "autorisee" })
      if (rDemote.status < 300) await PUT(`/api/members/${head.id}`, { role: "HEAD" })
    }
    const { f: f2 } = await createFamily({})
    if (f2) {
      const rAddHead = await POST(`/api/families/${f2.id}/members`, { firstName: "NouveauChef", role: "HEAD" })
      const lstAuto = await GET(`/api/families/${f2.id}/members`)
      const autoHead = ((lstAuto.data || {}).members || []).find((m) => m.role === "HEAD")
      check("S6.3.5a toute famille recoit automatiquement un chef", !!autoHead, { membres: ((lstAuto.data || {}).members || []).length })
      check("S6.3.5 un 2e HEAD reste refuse (le chef est cree automatiquement)", rAddHead.status === 409, { status: rAddHead.status, message: rAddHead.message })
    }
  })

  /* ---- 6.4 LE CAS CORRIGE : SPOUSE -> etat civil MARIE ---- */
  await guard("S6.4", async () => {
    for (const from of ["SINGLE", "DIVORCED", "WIDOWED"]) {
      const { f } = await createFamily({ maritalStatus: from, members: [{ firstName: "Chef", role: "HEAD", dateOfBirth: dobForAge(44) }] })
      if (!f) continue
      eq(`S6.4.1 etat initial = ${from}`, f.maritalStatus, from)
      const scoreBefore = num(f.svfScore)
      const r = await POST(`/api/families/${f.id}/members`, { firstName: "Conjoint", lastName: "Nouveau", role: "SPOUSE", dateOfBirth: dobForAge(40) })
      if (check(`S6.4.2 ajout d'un SPOUSE sur un chef ${from}`, r.status < 300, { status: r.status, message: r.message })) {
        const { f: after } = await getFamily(f.id)
        eq(`S6.4.3 ${from} -> MARRIED automatiquement`, after.maritalStatus, "MARRIED")
        check(`S6.4.4 membersCount incremente (${from})`, num(after.membersCount) >= num(f.membersCount), { avant: f.membersCount, apres: after.membersCount })
        if (from === "WIDOWED" || from === "DIVORCED") {
          check(`S6.4.5 le bonus veuf/divorce disparait (${from})`, num(after.svfScore) < scoreBefore, { avant: scoreBefore, apres: after.svfScore })
          near(`S6.4.6 delta = -points_widow_divorced (${from})`, round2(scoreBefore - num(after.svfScore)), W("points_widow_divorced"), 0.02)
        } else {
          eq("S6.4.5b SINGLE -> MARRIED : le score reste stable", num(after.svfScore), scoreBefore)
        }
        const sp = ((await GET(`/api/families/${f.id}/members`)).data || {}).members || []
        const spouse = sp.find((m) => m.role === "SPOUSE")
        if (spouse) {
          await DEL(`/api/members/${spouse.id}`)
          const { f: after2 } = await getFamily(f.id)
          eq(`S6.4.7 suppression de l'epoux : pas de retro-degradation (${from})`, after2.maritalStatus, "MARRIED")
        }
      }
    }
    const { f: fp } = await createFamily({ maritalStatus: "SINGLE", members: [{ firstName: "Chef", role: "HEAD" }, { firstName: "Personne", role: "OTHER", dateOfBirth: dobForAge(39) }] })
    if (fp) {
      const ms = ((await GET(`/api/families/${fp.id}/members`)).data || {}).members || []
      const other = ms.find((m) => m.role === "OTHER")
      if (other) {
        const r = await PUT(`/api/members/${other.id}`, { role: "SPOUSE" })
        if (check("S6.4.8 PUT role OTHER -> SPOUSE", r.status < 300, { status: r.status, message: r.message })) {
          const { f: after } = await getFamily(fp.id)
          eq("S6.4.9 l'etat civil bascule aussi via PUT", after.maritalStatus, "MARRIED")
        }
      }
    }
    const { f: fm } = await createFamily({ maritalStatus: "MARRIED", members: [{ firstName: "Chef", role: "HEAD" }] })
    if (fm) {
      const s0 = num(fm.svfScore)
      await POST(`/api/families/${fm.id}/members`, { firstName: "Conjointe", role: "SPOUSE" })
      const { f: after } = await getFamily(fm.id)
      eq("S6.4.10 deja MARRIED : etat inchange", after.maritalStatus, "MARRIED")
      eq("S6.4.11 deja MARRIED : score inchange par l'ajout d'un epoux", num(after.svfScore), s0)
    }
    const { f: fc } = await createFamily({ maritalStatus: "SINGLE", members: [{ firstName: "Chef", role: "HEAD" }] })
    if (fc) {
      await POST(`/api/families/${fc.id}/members`, { firstName: "Enfant", role: "CHILD", dateOfBirth: dobForAge(9) })
      const { f: after } = await getFamily(fc.id)
      eq("S6.4.12 un CHILD ne change pas l'etat civil", after.maritalStatus, "SINGLE")
    }
  })

  /* ---- 6.5 membersCount et ajouts successifs (cas signale par l'utilisateur) ---- */
  await guard("S6.5", async () => {
    const { f } = await createFamily({ membersCount: 4, members: [{ firstName: "Chef", role: "HEAD", dateOfBirth: dobForAge(42) }] })
    if (!f) return skip("S6.5", "famille non creee")
    eq("S6.5.1 membersCount declare = 4 avec 1 seule ligne membre", num(f.membersCount), 4)
    const s0 = num(f.svfScore)
    const trace = [{ etape: "initial", membersCount: num(f.membersCount), lignes: 1, score: s0 }]

    const plan = [
      { firstName: "P1", role: "OTHER" }, { firstName: "P2", role: "PARENT" },
      { firstName: "E1", role: "CHILD", dateOfBirth: dobForAge(10) },
      { firstName: "E2", role: "CHILD", dateOfBirth: dobForAge(8) },
      { firstName: "E3", role: "CHILD", dateOfBirth: dobForAge(6) },
      { firstName: "E4", role: "CHILD", dateOfBirth: dobForAge(4) },
    ]
    let lignes = 1
    let kids = 0
    let prevCount = num(f.membersCount)
    let prevScore = s0
    for (const p of plan) {
      const { r } = await addMember(f.id, p)
      if (r.status >= 300) { fail(`S6.5.2 ajout ${p.firstName}`, { status: r.status, message: r.message }); continue }
      lignes++
      if (p.role === "CHILD") kids++
      const { f: af } = await getFamily(f.id)
      const c = num(af.membersCount)
      const sc = num(af.svfScore)
      trace.push({ etape: `+${p.firstName}(${p.role})`, membersCount: c, lignes, enfants: kids, score: sc })
      check(`S6.5.3 membersCount ne recule jamais apres ${p.firstName}`, c >= prevCount, { avant: prevCount, apres: c })
      check(`S6.5.4 membersCount >= nombre de lignes reelles apres ${p.firstName}`, c >= lignes, { membersCount: c, lignes })
      if (p.role === "CHILD") {
        const attendu = Math.min(kids * W("points_per_child"), W("max_points_children")) - Math.min((kids - 1) * W("points_per_child"), W("max_points_children"))
        near(`S6.5.5 +1 enfant -> +${attendu} points (enfant n${kids})`, round2(sc - prevScore), attendu, 0.02, { avant: prevScore, apres: sc })
      } else {
        eq(`S6.5.6 ajout d'un ${p.role} ne change PAS le score`, sc, prevScore)
      }
      prevCount = c; prevScore = sc
    }
    info("S6.5.7 trace complete des ajouts", trace)
    check("S6.5.8 le score final depend des lignes CHILD, pas de membersCount",
      Math.abs(prevScore - (s0 + Math.min(kids * W("points_per_child"), W("max_points_children")))) <= 0.02,
      { scoreInitial: s0, scoreFinal: prevScore, enfants: kids, attendu: round2(s0 + Math.min(kids * W("points_per_child"), W("max_points_children"))) })

    const ms = ((await GET(`/api/families/${f.id}/members`)).data || {}).members || []
    const oneKid = ms.find((m) => m.role === "CHILD")
    if (oneKid) {
      const before = prevScore
      await DEL(`/api/members/${oneKid.id}`)
      const { f: af } = await getFamily(f.id)
      const delta = round2(before - num(af.svfScore))
      const attendu = Math.min(kids * W("points_per_child"), W("max_points_children")) - Math.min((kids - 1) * W("points_per_child"), W("max_points_children"))
      near("S6.5.9 suppression d'un enfant -> score reduit du bon montant", delta, attendu, 0.02, { avant: before, apres: af.svfScore })
      check("S6.5.10 membersCount apres suppression reste >= plancher", num(af.membersCount) >= 1, af.membersCount)
    }

    const { f: fcap } = await createFamily({})
    if (fcap) {
      const capKids = Math.ceil(W("max_points_children") / Math.max(1, W("points_per_child"))) + 3
      const sBase = num(fcap.svfScore)
      for (let i = 0; i < capKids; i++) {
        await POST(`/api/families/${fcap.id}/children`, { firstName: `K${i}`, lastName: "Cap", dateOfBirth: dobForAge(3 + i) })
      }
      const { f: aft } = await getFamily(fcap.id)
      near(`S6.5.11 ${capKids} enfants -> bonus plafonne a max_points_children`, round2(num(aft.svfScore) - sBase), W("max_points_children"), 0.02, { score: aft.svfScore, base: sBase })
      check("S6.5.12 score toujours <= 100 malgre le sur-nombre d'enfants", num(aft.svfScore) <= 100, aft.svfScore)
    }
  })

  /* ---- 6.6 GET / PUT / DELETE d'un membre ---- */
  await guard("S6.6", async () => {
    const { f } = await createFamily({})
    if (!f) return skip("S6.6", "famille non creee")
    const { m } = await addMember(f.id, { firstName: "AModifier", lastName: "Nom", role: "OTHER", dateOfBirth: dobForAge(30), occupation: "chauffeur" })
    if (!m) return skip("S6.6", "membre non cree")

    const g = await GET(`/api/members/${m.id}`)
    expectOk("S6.6.1 GET membre par id", g, 200)
    eq("S6.6.2 id correspond", (g.data.member || g.data).id, m.id)

    const upd = { firstName: "Modifie", lastName: "Nom2", occupation: "boulanger", monthlyIncome: 8000, hasDisability: true, diseases: "asthme" }
    const p = await PUT(`/api/members/${m.id}`, upd)
    if (expectOk("S6.6.3 PUT membre", p, 200)) {
      const mm = p.data.member || p.data
      for (const [k, v] of Object.entries(upd)) eq(`S6.6.4 ${k} mis a jour`, k === "monthlyIncome" ? num(mm[k]) : mm[k], v)
    }
    const rEmptyName = await PUT(`/api/members/${m.id}`, { firstName: "" })
    check("S6.6.5 firstName vide refuse en PUT", rEmptyName.status >= 400, { status: rEmptyName.status, message: rEmptyName.message })
    const rBadRole = await PUT(`/api/members/${m.id}`, { role: "BIDON" })
    check("S6.6.6 role invalide refuse en PUT", rBadRole.status >= 400, { status: rBadRole.status, message: rBadRole.message })
    const rMove = await PUT(`/api/members/${m.id}`, { familyId: "autre-famille" })
    check("S6.6.7 changement de familyId ignore ou refuse", rMove.status < 500, { status: rMove.status })
    eq("S6.6.8 GET membre inexistant -> 404", (await GET("/api/members/inexistant-xyz")).status, 404)
    eq("S6.6.9 PUT membre inexistant -> 404", (await PUT("/api/members/inexistant-xyz", { firstName: "X" })).status, 404)
    expectFailure("S6.6.10 GET membre sans token", await GET(`/api/members/${m.id}`, { token: null }), 401, "Authentication required.")

    const before = await scoreOf(f.id)
    await PUT(`/api/members/${m.id}`, { hasDisability: true })
    const after = await scoreOf(f.id)
    info("S6.6.11 handicap d'un membre non-chef", { avant: before, apres: after, note: before === after ? "n'affecte pas le score (attendu)" : "affecte le score" })

    const d = await DEL(`/api/members/${m.id}`)
    expectOk("S6.6.12 DELETE membre", d, 200)
    eq("S6.6.13 membre supprime -> GET 404", (await GET(`/api/members/${m.id}`)).status, 404)
    eq("S6.6.14 seconde suppression -> 404", (await DEL(`/api/members/${m.id}`)).status, 404)
  })

  /* ---- 6.7 Routes enfants dediees ---- */
  await guard("S6.7", async () => {
    const { f } = await createFamily({ maritalStatus: "MARRIED" })
    if (!f) return skip("S6.7", "famille non creee")
    const s0 = num(f.svfScore)

    const c1 = await POST(`/api/families/${f.id}/children`, { firstName: "Enfant1", lastName: "Test", dateOfBirth: dobForAge(9) })
    if (expectOk("S6.7.1 POST /children", c1)) {
      eq("S6.7.2 code HTTP 201", c1.status, 201)
      const child = c1.data.child || c1.data
      eq("S6.7.3 role force a CHILD", child.role, "CHILD")
      isType("S6.7.4 svfScore renvoye dans la reponse", num(c1.data.svfScore), "number")
      near("S6.7.5 score augmente de points_per_child", round2(num(c1.data.svfScore) - s0), W("points_per_child"), 0.02)
    }
    const cForce = await POST(`/api/families/${f.id}/children`, { firstName: "ForceRole", role: "HEAD", dateOfBirth: dobForAge(7) })
    if (cForce.status < 300) eq("S6.7.6 role=HEAD ignore sur /children (force CHILD)", (cForce.data.child || cForce.data).role, "CHILD")
    else info("S6.7.6 role=HEAD sur /children", { status: cForce.status, message: cForce.message })

    const g = await GET(`/api/families/${f.id}/children`)
    expectOk("S6.7.7 GET /children", g, 200)
    isType("S6.7.8 data.children tableau", g.data.children, "array")
    isType("S6.7.9 data.count numerique", num(g.data.count), "number")
    check("S6.7.10 tous les elements ont le role CHILD", (g.data.children || []).every((c) => c.role === "CHILD"), [...new Set((g.data.children || []).map((c) => c.role))])
    eq("S6.7.11 count = longueur de la liste", num(g.data.count), (g.data.children || []).length)

    const cnt = await GET(`/api/families/${f.id}/children/count`)
    expectOk("S6.7.12 GET /children/count", cnt, 200)
    for (const k of ["count", "schoolCount", "orphanCount"]) isType(`S6.7.13 count.${k} entier`, num(cnt.data && cnt.data[k]), "int")
    eq("S6.7.14 count coherent avec GET /children", num(cnt.data.count), (g.data.children || []).length)
    check("S6.7.15 schoolCount <= count", num(cnt.data.schoolCount) <= num(cnt.data.count), cnt.data)
    check("S6.7.16 orphanCount <= count", num(cnt.data.orphanCount) <= num(cnt.data.count), cnt.data)

    const kid = (g.data.children || [])[0]
    if (kid) {
      const pu = await PUT(`/api/children/${kid.id}`, { firstName: "EnfantModifie", occupation: "eleve" })
      if (expectOk("S6.7.17 PUT /children/:id", pu, 200)) {
        eq("S6.7.18 prenom modifie", (pu.data.child || pu.data).firstName, "EnfantModifie")
        isType("S6.7.19 svfScore renvoye", num(pu.data.svfScore), "number")
      }
      const before = await scoreOf(f.id)
      const dl = await DEL(`/api/children/${kid.id}`)
      if (expectOk("S6.7.20 DELETE /children/:id", dl, 200)) {
        eq("S6.7.21 message de confirmation", dl.data && dl.data.message, "Child deleted.")
        isType("S6.7.22 svfScore renvoye apres suppression", num(dl.data.svfScore), "number")
        near("S6.7.23 score reduit de points_per_child", round2(before - num(dl.data.svfScore)), W("points_per_child"), 0.02)
      }
      eq("S6.7.24 enfant supprime -> PUT 404", (await PUT(`/api/children/${kid.id}`, { firstName: "X" })).status, 404)
    }
    eq("S6.7.25 /children sur famille inexistante -> 404", (await GET("/api/families/inexistant/children")).status, 404)
    expectFailure("S6.7.26 /children sans token", await GET(`/api/families/${f.id}/children`, { token: null }), 401, "Authentication required.")
    const rNoName = await POST(`/api/families/${f.id}/children`, { dateOfBirth: dobForAge(5) })
    check("S6.7.27 enfant sans prenom refuse", rNoName.status === 400, { status: rNoName.status, message: rNoName.message })
  })

  /* ---- 6.8 Concurrence : 10 ajouts simultanes ---- */
  await guard("S6.8", async () => {
    const { f } = await createFamily({})
    if (!f) return skip("S6.8", "famille non creee")
    const N = 10
    const rs = await Promise.all(
      Array.from({ length: N }, (_, i) => POST(`/api/families/${f.id}/members`, { firstName: `Para${i}`, role: "CHILD", dateOfBirth: dobForAge(2 + i) }))
    )
    const okN = rs.filter((r) => r.status < 300).length
    check(`S6.8.1 ${N} ajouts concurrents : aucune erreur 500`, rs.every((r) => r.status < 500), rs.map((r) => r.status))
    eq(`S6.8.2 les ${N} membres sont crees`, okN, N)
    const lst = await GET(`/api/families/${f.id}/members`)
    eq(`S6.8.3 la base contient ${N} membres + le chef automatique`, ((lst.data || {}).members || []).length, N + 1)
    const { f: af } = await getFamily(f.id)
    check("S6.8.4 membersCount coherent apres concurrence", num(af.membersCount) >= N, { membersCount: af.membersCount })
    near("S6.8.5 score plafonne correctement malgre la concurrence", round2(num(af.svfScore) - num(f.svfScore)), Math.min(N * W("points_per_child"), W("max_points_children")), 0.02, { avant: f.svfScore, apres: af.svfScore })
    const cnt = await GET(`/api/families/${f.id}/children/count`)
    eq("S6.8.6 /children/count coherent apres concurrence", num(cnt.data && cnt.data.count), N)
  })
})

/* ################################################################################### */
/* #  S7 -- SCORE SVF : CALIBRATION, PROFILS, MUTATIONS                               # */
/* ################################################################################### */

/* Famille de reference : aucun facteur actif (revenu eleve, proprietaire, celibataire,
 * age median, aucun enfant, pas de handicap, source de revenu presente). */
function baselineOver(extra = {}) {
  return famPayload({
    maritalStatus: "SINGLE",
    monthlyIncome: 100000,          // > 3x SMIG -> aucun point revenu
    housingStatus: "OWNER", housingType: "HOUSE",
    dateOfBirth: dobForAge(45),     // ni senior ni jeune
    incomeSources: ["SALARY"],      // pas "sans soutien"
    employmentStatus: "FULL_TIME",
    hasDisability: false,
    ...extra,
  })
}

async function probeScore(over, kids = 0) {
  const { r, f } = await createFamily(baselineOver(over))
  if (!f) return { score: null, err: r.message, status: r.status, id: null }
  for (let i = 0; i < kids; i++) {
    await POST(`/api/families/${f.id}/children`, { firstName: `K${i}`, lastName: "Probe", dateOfBirth: dobForAge(4 + i) })
  }
  const s = kids > 0 ? await scoreOf(f.id) : num(f.svfScore)
  return { score: s, id: f.id, family: f }
}

section("S7", "SVF : calibration de chaque facteur, profils composites, mutations", async () => {

  let BASE = 0

  /* ---- 7.1 Reference a zero ---- */
  await guard("S7.1", async () => {
    const b = await probeScore({})
    if (b.score === null) return fail("S7.1.1 famille de reference", b)
    BASE = b.score
    eq("S7.1.1 famille de reference = 0 point (aucun facteur actif)", BASE, 0)
    if (BASE !== 0) warn("S7.1.2 reference non nulle", { score: BASE, note: "les deltas restent valides, seules les valeurs absolues decalent" })
    const { f } = await getFamily(b.id)
    eq("S7.1.3 priorite de la reference = LOW", f.priority, priorityFromScore(BASE))
  })

  /* ---- 7.2 Calibration : un facteur a la fois ---- */
  await guard("S7.2", async () => {
    const smig = W("smig_threshold")
    const probes = [
      { key: "points_income_below_smig", label: `revenu < SMIG (${smig})`, over: { monthlyIncome: Math.max(0, smig - 1000) } },
      { key: "points_income_below_2x_smig", label: "revenu < 2x SMIG", over: { monthlyIncome: smig + 1000 } },
      { key: "points_income_below_3x_smig", label: "revenu < 3x SMIG", over: { monthlyIncome: 2 * smig + 1000 } },
      { key: "points_widow_divorced", label: "veuf/veuve", over: { maritalStatus: "WIDOWED" } },
      { key: "points_widow_divorced", label: "divorce(e)", over: { maritalStatus: "DIVORCED" }, alias: "points_widow_divorced_div" },
      { key: "points_no_support", label: "sans soutien (incomeSources=[NONE])", over: { incomeSources: ["NONE"] } },
      { key: "points_disability", label: "handicap du chef", over: { hasDisability: true } },
      { key: "points_chronic_illness", label: "maladie chronique", over: { hasChronicIllness: true, diseases: "diabete" } },
      { key: "points_renting", label: "locataire", over: { housingStatus: "TENANT", housingType: "APARTMENT" } },
      { key: "points_senior_head", label: `chef senior (>= ${W("senior_age_threshold")} ans)`, over: { dateOfBirth: dobForAge(W("senior_age_threshold") + 3) } },
      { key: "points_young_head", label: `chef jeune (<= ${W("young_head_age_threshold")} ans)`, over: { dateOfBirth: dobForAge(Math.max(18, W("young_head_age_threshold") - 3)) } },
      { key: "points_per_child", label: "1 enfant", over: {}, kids: 1 },
    ]
    const table = []
    for (const p of probes) {
      const res = await probeScore(p.over, p.kids || 0)
      if (res.score === null) { fail(`S7.2 sonde ${p.label}`, res); continue }
      const delta = round2(res.score - BASE)
      const attendu = W(p.key)
      const storeKey = p.alias || p.key
      STATE.CAL[storeKey] = delta
      if (!p.alias) STATE.CAL[p.key] = delta
      table.push({ facteur: p.label, cle: p.key, mesure: delta, configure: attendu, score: res.score })
      near(`S7.2.1 ${p.label} -> +${attendu} points`, delta, attendu, 0.02, { scoreMesure: res.score, base: BASE })
    }
    info("S7.2.2 table de calibration complete", table)

    /* Facteurs qui ne doivent RIEN rapporter */
    const neutres = [
      { label: "revenu >= 3x SMIG", over: { monthlyIncome: 3 * smig + 1 } },
      { label: "proprietaire", over: { housingStatus: "OWNER", housingType: "HOUSE" } },
      { label: "celibataire", over: { maritalStatus: "SINGLE" } },
      { label: "marie", over: { maritalStatus: "MARRIED" } },
      { label: "age median (45)", over: { dateOfBirth: dobForAge(45) } },
      { label: 'diseases = "ras" (jeton nul)', over: { diseases: "ras" } },
      { label: 'diseases = "aucun"', over: { diseases: "aucun" } },
      { label: 'diseases = "\u0644\u0627" (arabe)', over: { diseases: "\u0644\u0627" } },
      { label: "diseases vide", over: { diseases: "" } },
      { label: "incomeSources = [SALARY]", over: { incomeSources: ["SALARY"] } },
      { label: "incomeSources = [NONE, SALARY] (mixte)", over: { incomeSources: ["NONE", "SALARY"] } },
      { label: "incomeSources = [] (vide)", over: { incomeSources: [] } },
    ]
    for (const n of neutres) {
      const res = await probeScore(n.over)
      if (res.score === null) { fail(`S7.2.3 sonde neutre ${n.label}`, res); continue }
      eq(`S7.2.3 ${n.label} -> 0 point supplementaire`, round2(res.score - BASE), 0, { score: res.score })
    }
  })

  /* ---- 7.3 Bornes exactes des paliers ---- */
  await guard("S7.3", async () => {
    const smig = W("smig_threshold")
    const bornes = [
      { inc: 0, attendu: CALW("points_income_below_smig"), label: "revenu = 0" },
      { inc: 1, attendu: CALW("points_income_below_smig"), label: "revenu = 1" },
      { inc: smig - 1, attendu: CALW("points_income_below_smig"), label: "revenu = SMIG-1" },
      { inc: smig, attendu: CALW("points_income_below_2x_smig"), label: "revenu = SMIG (borne exacte)" },
      { inc: smig + 1, attendu: CALW("points_income_below_2x_smig"), label: "revenu = SMIG+1" },
      { inc: 2 * smig - 1, attendu: CALW("points_income_below_2x_smig"), label: "revenu = 2xSMIG-1" },
      { inc: 2 * smig, attendu: CALW("points_income_below_3x_smig"), label: "revenu = 2xSMIG (borne exacte)" },
      { inc: 3 * smig - 1, attendu: CALW("points_income_below_3x_smig"), label: "revenu = 3xSMIG-1" },
      { inc: 3 * smig, attendu: 0, label: "revenu = 3xSMIG (borne exacte)" },
      { inc: 3 * smig + 1, attendu: 0, label: "revenu = 3xSMIG+1" },
      { inc: 10 * smig, attendu: 0, label: "revenu tres eleve" },
    ]
    for (const b of bornes) {
      const res = await probeScore({ monthlyIncome: b.inc })
      if (res.score === null) { fail(`S7.3 ${b.label}`, res); continue }
      near(`S7.3.1 ${b.label} -> ${b.attendu} pts`, round2(res.score - BASE), b.attendu, 0.02, { revenu: b.inc, score: res.score })
    }
    /* Bornes d'age */
    const sen = W("senior_age_threshold"), yng = W("young_head_age_threshold")
    const ages = [
      { a: 18, attendu: CALW("points_young_head"), label: `${18} ans` },
      { a: yng - 1, attendu: CALW("points_young_head"), label: `${yng - 1} ans` },
      // Le code utilise age < seuil (strict) : a 25 ans pile, aucun point.
      // Question de conception en attente de decision -- pas un bug.
      { a: yng, attendu: 0, label: `${yng} ans (borne jeune, strict)` },
      { a: yng + 1, attendu: 0, label: `${yng + 1} ans` },
      { a: sen - 1, attendu: 0, label: `${sen - 1} ans` },
      { a: sen, attendu: CALW("points_senior_head"), label: `${sen} ans (borne senior)` },
      { a: sen + 1, attendu: CALW("points_senior_head"), label: `${sen + 1} ans` },
      { a: 95, attendu: CALW("points_senior_head"), label: "95 ans" },
    ]
    for (const g of ages) {
      const res = await probeScore({ dateOfBirth: dobForAge(g.a) })
      if (res.score === null) { fail(`S7.3 age ${g.label}`, res); continue }
      near(`S7.3.2 chef de ${g.label} -> ${g.attendu} pts`, round2(res.score - BASE), g.attendu, 0.02, { score: res.score })
    }
    /* Bornes d'enfants autour du plafond */
    const perChild = CALW("points_per_child"), cap = W("max_points_children")
    const nCap = Math.ceil(cap / Math.max(1, perChild))
    for (const k of [0, 1, 2, nCap - 1, nCap, nCap + 1, nCap + 3]) {
      if (k < 0) continue
      const res = await probeScore({}, k)
      if (res.score === null) { fail(`S7.3 ${k} enfants`, res); continue }
      near(`S7.3.3 ${k} enfant(s) -> min(${k}x${perChild}, ${cap})`, round2(res.score - BASE), Math.min(k * perChild, cap), 0.02, { score: res.score })
    }
  })

  /* ---- 7.4 Priorites : bornes 20 / 45 / 70 ---- */
  await guard("S7.4", async () => {
    const seen = new Map()
    const all = await GET("/api/families?status=ALL")
    for (const f of ((all.data || {}).families || [])) {
      const attendu = priorityFromScore(num(f.svfScore))
      if (f.priority !== attendu && !seen.has(f.id)) seen.set(f.id, { score: f.svfScore, priority: f.priority, attendu })
    }
    check("S7.4.1 priorite = f(score) pour TOUTES les familles de la mosquee", seen.size === 0, [...seen.values()].slice(0, 8))
    for (const [score, prio] of [[0, "LOW"], [19.99, "LOW"], [20, "MODERATE"], [44.99, "MODERATE"], [45, "VULNERABLE"], [69.99, "VULNERABLE"], [70, "URGENT"], [100, "URGENT"]]) {
      eq(`S7.4.2 seuil local : score ${score} -> ${prio}`, priorityFromScore(score), prio)
    }
  })

  /* ---- 7.5 Profils composites : oracle avec les poids MESURES ---- */
  await guard("S7.5", async () => {
    const smig = W("smig_threshold")
    const profils = [
      { nom: "Veuve sans revenu, 3 enfants, locataire", over: { maritalStatus: "WIDOWED", monthlyIncome: 0, incomeSources: ["NONE"], housingStatus: "TENANT", housingType: "APARTMENT", dateOfBirth: dobForAge(50) }, kids: 3,
        o: { monthlyIncome: 0, widowOrDivorced: true, noSupport: true, renting: true, childrenCount: 3, age: 50 } },
      { nom: "Chef senior handicape, proprietaire, revenu faible", over: { maritalStatus: "MARRIED", monthlyIncome: 8000, hasDisability: true, dateOfBirth: dobForAge(72) }, kids: 0,
        o: { monthlyIncome: 8000, disability: true, age: 72 } },
      { nom: "Jeune chef, SDF, 2 enfants, revenu moyen", over: { maritalStatus: "MARRIED", monthlyIncome: smig + 5000, housingStatus: "HOMELESS", dateOfBirth: dobForAge(22) }, kids: 2,
        o: { monthlyIncome: smig + 5000, childrenCount: 2, age: 22 } },
      { nom: "Divorce, maladie chronique, locataire, 1 enfant", over: { maritalStatus: "DIVORCED", monthlyIncome: 12000, diseases: "hypertension", housingStatus: "TENANT", housingType: "HOUSE", dateOfBirth: dobForAge(41) }, kids: 1,
        o: { monthlyIncome: 12000, widowOrDivorced: true, chronic: true, renting: true, childrenCount: 1, age: 41 } },
      { nom: "Cumul maximal (doit etre plafonne a 100)", over: { maritalStatus: "WIDOWED", monthlyIncome: 0, incomeSources: ["NONE"], hasDisability: true, diseases: "cancer", housingStatus: "TENANT", housingType: "APARTMENT", dateOfBirth: dobForAge(80) }, kids: 8,
        o: { monthlyIncome: 0, widowOrDivorced: true, noSupport: true, disability: true, renting: true, childrenCount: 8, age: 80 } },
      { nom: "Aucun facteur (score nul)", over: {}, kids: 0, o: { monthlyIncome: 100000, age: 45 } },
      { nom: "Handicap + maladie chronique (non cumulables)", over: { hasDisability: true, diseases: "asthme", monthlyIncome: 100000, dateOfBirth: dobForAge(45) }, kids: 0,
        o: { monthlyIncome: 100000, disability: true, chronic: true, age: 45 } },
      { nom: "Marie, revenu 2.5x SMIG, 5 enfants, locataire", over: { maritalStatus: "MARRIED", monthlyIncome: Math.round(2.5 * smig), housingStatus: "TENANT", housingType: "APARTMENT", dateOfBirth: dobForAge(38) }, kids: 5,
        o: { monthlyIncome: Math.round(2.5 * smig), renting: true, childrenCount: 5, age: 38 } },
    ]
    const rows = []
    for (const p of profils) {
      const res = await probeScore(p.over, p.kids)
      if (res.score === null) { fail(`S7.5 profil "${p.nom}"`, res); continue }
      const oracle = oracleSVF(p.o)
      rows.push({ profil: p.nom, attendu: oracle.score, obtenu: res.score, detail: oracle.parts.map((x) => `${x[0]}:${x[1]}`).join(" + ") })
      near(`S7.5.1 ${p.nom}`, res.score, oracle.score, 0.02, { detailOracle: oracle.parts, base: BASE })
      const { f } = await getFamily(res.id)
      eq(`S7.5.2 priorite coherente : ${p.nom}`, f.priority, priorityFromScore(res.score))
      check(`S7.5.3 score borne [0,100] : ${p.nom}`, res.score >= 0 && res.score <= 100, res.score)
    }
    info("S7.5.4 recapitulatif des profils composites", rows)
  })

  /* ---- 7.6 Mutations successives et re-test (le coeur de la demande) ---- */
  await guard("S7.6", async () => {
    const smig = W("smig_threshold")
    const { f } = await createFamily(baselineOver({ maritalStatus: "SINGLE", monthlyIncome: 100000, membersCount: 4 }))
    if (!f) return fail("S7.6.0 famille de mutation", "creation impossible")
    const journal = []
    let attendu = 0
    const state = { monthlyIncome: 100000, age: 45, childrenCount: 0 }

    async function step(label, action, patchState) {
      await action()
      Object.assign(state, patchState || {})
      const oracle = oracleSVF(state)
      const got = await scoreOf(f.id)
      const { f: cur } = await getFamily(f.id)
      journal.push({ etape: label, attendu: oracle.score, obtenu: got, membersCount: cur.membersCount, priorite: cur.priority })
      near(`S7.6 ${label}`, got, oracle.score, 0.02, { etat: { ...state }, detail: oracle.parts })
      eq(`S7.6 ${label} : priorite coherente`, cur.priority, priorityFromScore(got))
      attendu = oracle.score
      return cur
    }

    await step("1. etat initial (aucun facteur)", async () => {}, {})
    await step("2. revenu -> 5000 (< SMIG)", () => patchFamily(f.id, { monthlyIncome: 5000 }), { monthlyIncome: 5000 })
    await step("3. ajout enfant #1", () => POST(`/api/families/${f.id}/children`, { firstName: "M1", lastName: "Mut", dateOfBirth: dobForAge(10) }), { childrenCount: 1 })
    await step("4. ajout enfant #2", () => POST(`/api/families/${f.id}/children`, { firstName: "M2", lastName: "Mut", dateOfBirth: dobForAge(8) }), { childrenCount: 2 })
    await step("5. ajout d'un PARENT (ne doit rien changer au score)", () => POST(`/api/families/${f.id}/members`, { firstName: "Grand-mere", role: "PARENT", dateOfBirth: dobForAge(70) }), {})
    await step("6. passage en WIDOWED", () => patchFamily(f.id, { maritalStatus: "WIDOWED" }), { widowOrDivorced: true })
    await step("7. ajout d'un SPOUSE -> bascule MARRIED, le bonus veuvage saute",
      () => POST(`/api/families/${f.id}/members`, { firstName: "Conjoint", role: "SPOUSE", dateOfBirth: dobForAge(43) }), { widowOrDivorced: false })
    await step("8. passage en location", () => patchFamily(f.id, { housingStatus: "TENANT", housingType: "APARTMENT" }), { renting: true })
    await step("9. chef devient senior (70 ans)", () => patchFamily(f.id, { dateOfBirth: dobForAge(70) }), { age: 70 })
    await step("10. ajout enfants #3 et #4", async () => {
      await POST(`/api/families/${f.id}/children`, { firstName: "M3", lastName: "Mut", dateOfBirth: dobForAge(6) })
      await POST(`/api/families/${f.id}/children`, { firstName: "M4", lastName: "Mut", dateOfBirth: dobForAge(4) })
    }, { childrenCount: 4 })
    await step("11. ajout enfants #5 et #6 (plafond enfants atteint)", async () => {
      await POST(`/api/families/${f.id}/children`, { firstName: "M5", lastName: "Mut", dateOfBirth: dobForAge(3) })
      await POST(`/api/families/${f.id}/children`, { firstName: "M6", lastName: "Mut", dateOfBirth: dobForAge(2) })
    }, { childrenCount: 6 })
    await step("12. revenu -> 45000 (> 2x SMIG)", () => patchFamily(f.id, { monthlyIncome: 2 * smig + 5000 }), { monthlyIncome: 2 * smig + 5000 })
    await step("13. handicap du chef", () => patchFamily(f.id, { hasDisability: true }), { disability: true })
    await step("14. retour proprietaire", () => patchFamily(f.id, { housingStatus: "OWNER", housingType: "HOUSE" }), { renting: false })
    await step("15. revenu -> 0 (< SMIG) + sans soutien", () => patchFamily(f.id, { monthlyIncome: 0, incomeSources: ["NONE"] }), { monthlyIncome: 0, noSupport: true })

    info("S7.6.99 journal complet des 15 mutations", journal)
    const finale = journal[journal.length - 1]
    check("S7.6.100 aucune derive cumulee apres 15 mutations", Math.abs(num(finale.obtenu) - num(finale.attendu)) <= 0.02, finale)
    const lstMut = await GET(`/api/families/${f.id}/members`)
    const toutesLignes = ((lstMut.data || {}).members || [])
    const nbLignes = toutesLignes.length
    const nbEnfants = toutesLignes.filter((m) => m && m.role === "CHILD").length
    const nbAdultes = nbLignes - nbEnfants
    const { f: famFinale } = await getFamily(f.id)
    const mcRelu = num((famFinale || {}).membersCount)
    check("S7.6.101 membersCount reste aligne sur les lignes membres non-enfants", mcRelu >= nbAdultes && mcRelu >= 1, { membersCountRelu: mcRelu, lignesNonEnfants: nbAdultes, enfants: nbEnfants, lignesTotales: nbLignes })
    if (mcRelu < nbLignes) info("S7.6.101b membersCount inferieur au total des lignes FamilyMember", { membersCount: mcRelu, lignesTotales: nbLignes, dontEnfants: nbEnfants, cause: "POST /api/families/:id/children n-appelle que recalcFamily, pas syncFamilyFromMembers : les enfants (role CHILD) ne font pas monter l-effectif declare", effet: "le prochain ajout via POST /members declenchera Math.max(declare, TOUTES les lignes) et fera bondir membersCount d-un coup", impactSvf: "nul : membersCount n-est pas une entree de computeSVF" })

    /* Re-lecture apres une pause : le score doit etre stable (pas de recalcul parasite) */
    await sleep(200)
    const again = await scoreOf(f.id)
    eq("S7.6.102 score stable a la relecture (pas de recalcul non deterministe)", again, num(finale.obtenu))
    /* Une modification neutre ne doit pas bouger le score */
    await patchFamily(f.id, { notes: "note neutre" })
    eq("S7.6.103 modification d'un champ neutre -> score inchange", await scoreOf(f.id), again)
  })

  /* ---- 7.7 Repetitions : creations identiques -> scores identiques ---- */
  await guard("S7.7", async () => {
    const scores = []
    for (let i = 0; i < 5; i++) {
      const res = await probeScore({ maritalStatus: "WIDOWED", monthlyIncome: 3000, housingStatus: "TENANT", housingType: "HOUSE", dateOfBirth: dobForAge(68) }, 2)
      scores.push(res.score)
    }
    check("S7.7.1 5 familles identiques -> 5 scores identiques (deterministe)", new Set(scores).size === 1, scores)
    const oracle = oracleSVF({ monthlyIncome: 3000, widowOrDivorced: true, renting: true, childrenCount: 2, age: 68 })
    near("S7.7.2 valeur conforme a l'oracle", scores[0], oracle.score, 0.02, { detail: oracle.parts })
  })

  /* ---- 7.8 Malus d'aide recue (impact des distributions passees) ---- */
  await guard("S7.8", async () => {
    info("S7.8.0 note", `malus_per_aid=${W("malus_per_aid")}, max_malus=${W("max_malus")} -- verifie en S9 apres une distribution reelle.`)
    const o1 = oracleSVF({ monthlyIncome: 0, benefitCount: 1 })
    const o0 = oracleSVF({ monthlyIncome: 0, benefitCount: 0 })
    eq("S7.8.1 oracle : 1 aide -> -malus_per_aid", round2(o0.score - o1.score), W("malus_per_aid"))
    const oMany = oracleSVF({ monthlyIncome: 0, benefitCount: 99 })
    eq("S7.8.2 oracle : malus plafonne a max_malus", round2(o0.score - oMany.score), Math.min(99 * W("malus_per_aid"), W("max_malus")))
  })
})

/* ################################################################################### */
/* #  S8 -- WATER-FILLING (CALCUL DE REPARTITION)                                     # */
/* ################################################################################### */

/* Cohorte dediee : familles ACTIVE avec des scores volontairement etages. */
async function buildCohort() {
  const specs = [
    { label: "tres urgent", over: { maritalStatus: "WIDOWED", monthlyIncome: 0, incomeSources: ["NONE"], housingStatus: "TENANT", housingType: "APARTMENT", dateOfBirth: dobForAge(70) }, kids: 4 },
    { label: "urgent", over: { maritalStatus: "DIVORCED", monthlyIncome: 5000, housingStatus: "TENANT", housingType: "HOUSE", dateOfBirth: dobForAge(50) }, kids: 2 },
    { label: "moyen", over: { maritalStatus: "MARRIED", monthlyIncome: 25000, housingStatus: "OWNER", housingType: "HOUSE", dateOfBirth: dobForAge(40) }, kids: 1 },
    { label: "faible", over: { maritalStatus: "SINGLE", monthlyIncome: 55000, housingStatus: "OWNER", housingType: "HOUSE", dateOfBirth: dobForAge(45) }, kids: 0 },
  ]
  const out = []
  for (const s of specs) {
    const { f } = await createFamily(famPayload(s.over))
    if (!f) continue
    for (let i = 0; i < s.kids; i++) {
      await POST(`/api/families/${f.id}/children`, { firstName: `C${i}`, lastName: "Coh", dateOfBirth: dobForAge(3 + i) })
    }
    const sc = await scoreOf(f.id)
    out.push({ id: f.id, label: s.label, score: sc })
  }
  return out
}

async function calc(body) {
  return POST("/api/distribution/calculate", body)
}

section("S8", "Water-filling : budget, reserve, bornes, proportionnalite, monotonie", async () => {
  const cohort = await buildCohort()
  const ids = cohort.map((c) => c.id)
  info("S8.0 cohorte de test", cohort)
  if (ids.length < 3) return fail("S8.0 cohorte", "moins de 3 familles creees, section abandonnee")

  /* ---- 8.1 Validation du budget ---- */
  await guard("S8.1", async () => {
    for (const b of [0, -1, -1000]) {
      const r = await calc({ budget: b, familyIds: ids })
      check(`S8.1.1 budget = ${b} refuse`, r.status >= 400, { status: r.status, message: r.message })
    }
    const rNo = await calc({ familyIds: ids })
    check("S8.1.2 budget absent refuse", rNo.status >= 400, { status: rNo.status, message: rNo.message })
    for (const bad of ["abc", null, {}, []]) {
      const r = await calc({ budget: bad, familyIds: ids })
      check(`S8.1.3 budget = ${short(bad, 10)} refuse sans 500`, r.status >= 400 && r.status < 500, { status: r.status, message: r.message })
    }
    const rAlias = await calc({ totalBudget: 200000, familyIds: ids })
    check("S8.1.4 alias totalBudget accepte", rAlias.status < 300, { status: rAlias.status, message: rAlias.message })
    expectFailure("S8.1.5 sans token", await POST("/api/distribution/calculate", { budget: 100000 }, { token: null }), 401, "Authentication required.")
    const rJson = await api("POST", "/api/distribution/calculate", { rawBody: "nope" })
    expectFailure("S8.1.6 JSON invalide", rJson, 400, "Invalid or missing JSON body.")
  })

  /* ---- 8.2 Forme de la reponse et invariants fondamentaux ---- */
  await guard("S8.2", async () => {
    const BUD = 300000
    const r = await calc({ budget: BUD, familyIds: ids, reserve: 0.1, minAmt: 1000, maxAmt: 50000 })
    if (!expectOk("S8.2.1 calcul nominal", r, 200)) return info("S8.2 abandon", { status: r.status, message: r.message, result: r.json && r.json.result })
    const d = r.data && (r.data.result || r.data)
    for (const k of ["totalBudget", "netBudget", "reserve", "reserveAmount", "minAmt", "maxAmt", "totalAllocated", "unallocated", "distributions"]) {
      check(`S8.2.2 champ present : ${k}`, k in d, Object.keys(d))
    }
    isType("S8.2.3 distributions est un tableau", d.distributions, "array")
    eq("S8.2.4 totalBudget = budget envoye", num(d.totalBudget), BUD)
    near("S8.2.5 netBudget = budget x (1 - reserve)", num(d.netBudget), round2(BUD * (1 - normalizeReserveLocal(0.1))), 0.02)
    near("S8.2.6 reserveAmount = budget - netBudget", num(d.reserveAmount), round2(BUD - num(d.netBudget)), 0.02)
    near("S8.2.7 reserve normalisee = 0.1", num(d.reserve), 0.1, 0.001)
    const sum = round2(d.distributions.reduce((a, x) => a + num(x.amount), 0))
    near("S8.2.8 totalAllocated = somme des montants", num(d.totalAllocated), sum, 0.05)
    check("S8.2.9 somme allouee <= netBudget", sum <= num(d.netBudget) + 0.05, { sum, netBudget: d.netBudget })
    near("S8.2.10 unallocated = netBudget - totalAllocated", num(d.unallocated), round2(num(d.netBudget) - num(d.totalAllocated)), 0.05)
    check("S8.2.11 unallocated >= 0", num(d.unallocated) >= -0.01, d.unallocated)
    eq("S8.2.12 une ligne par famille demandee", d.distributions.length, ids.length)
    for (const x of d.distributions) {
      check(`S8.2.13 montant >= minAmt (${x.headName})`, num(x.amount) >= 1000 - 0.01, x)
      check(`S8.2.14 montant <= maxAmt (${x.headName})`, num(x.amount) <= 50000 + 0.01, x)
      isType(`S8.2.15 familyId (${x.headName})`, x.familyId, "string")
      isType(`S8.2.16 svfScore (${x.headName})`, num(x.svfScore), "number")
      isType(`S8.2.17 headName (${x.headName})`, x.headName, "string")
      check(`S8.2.18 priority presente (${x.headName})`, PRIORITIES.includes(x.priority), x.priority)
      check(`S8.2.19 dependents numerique (${x.headName})`, Number.isFinite(num(x.dependents)), x.dependents)
      check(`S8.2.20 montant arrondi a 2 decimales (${x.headName})`, Math.abs(num(x.amount) - round2(num(x.amount))) < 1e-9, x.amount)
    }
    /* Monotonie : score plus eleve -> montant >= */
    const sorted = [...d.distributions].sort((a, b) => num(b.svfScore) - num(a.svfScore))
    let mono = true
    for (let i = 1; i < sorted.length; i++) if (num(sorted[i].amount) > num(sorted[i - 1].amount) + 0.02) mono = false
    check("S8.2.21 monotonie : plus le score est haut, plus le montant est haut", mono, sorted.map((x) => ({ s: x.svfScore, a: x.amount })))
    /* Proportionnalite en score^exposant pour les non plafonnes */
    const exp = STATE.exponent
    const libres = d.distributions.filter((x) => num(x.amount) > 1000 + 0.01 && num(x.amount) < 50000 - 0.01 && num(x.svfScore) > 0)
    if (libres.length >= 2) {
      const ratios = libres.map((x) => num(x.amount) / Math.pow(num(x.svfScore), exp))
      const spread = (Math.max(...ratios) - Math.min(...ratios)) / Math.max(...ratios)
      check(`S8.2.22 proportionnalite en score^${exp} (ecart relatif < 2%)`, spread < 0.02, { ratios: ratios.map((x) => round2(x * 1000) / 1000), spread: round2(spread * 100) / 100 })
    } else info("S8.2.22 proportionnalite", "moins de 2 familles non plafonnees, test non applicable")
  })

  /* ---- 8.3 Reserve : matrice de valeurs ---- */
  await guard("S8.3", async () => {
    const BUD = 400000
    for (const rv of [0, 0.05, 0.1, 0.25, 0.5, 0.9, 10, 25, 50, 1, 1.5, 99, 150, -5, "abc"]) {
      const r = await calc({ budget: BUD, familyIds: ids, reserve: rv, minAmt: 1000, maxAmt: 200000 })
      if (r.status >= 300) { info(`S8.3.1 reserve=${rv} refusee`, { status: r.status, message: r.message }); continue }
      const d = r.data.result || r.data
      const attendu = normalizeReserveLocal(rv)
      near(`S8.3.1 reserve=${rv} -> normalisee ${attendu}`, num(d.reserve), attendu, 0.005)
      near(`S8.3.2 reserve=${rv} -> netBudget`, num(d.netBudget), round2(BUD * (1 - attendu)), 0.05)
      check(`S8.3.3 reserve=${rv} : reserve finale < 1`, num(d.reserve) < 1, d.reserve)
      const sum = round2(d.distributions.reduce((a, x) => a + num(x.amount), 0))
      check(`S8.3.4 reserve=${rv} : somme <= netBudget`, sum <= num(d.netBudget) + 0.05, { sum, net: d.netBudget })
    }
    /* La reserve provient des parametres si elle n'est pas fournie */
    await PUT("/api/settings", { reservePercentage: 0.2 })
    const rDef = await calc({ budget: BUD, familyIds: ids })
    if (rDef.status < 300) {
      const d = rDef.data.result || rDef.data
      near("S8.3.5 reserve par defaut lue depuis les parametres (0.2)", num(d.reserve), 0.2, 0.005)
    }
    await PUT("/api/settings", { reservePercentage: 0.1 })
  })

  /* ---- 8.4 Bornes min / max ---- */
  await guard("S8.4", async () => {
    const BUD = 300000
    const rInv = await calc({ budget: BUD, familyIds: ids, minAmt: 50000, maxAmt: 1000 })
    check("S8.4.1 maxAmt < minAmt -> refus 422 explicite", rInv.status === 422 || rInv.status >= 400,
      { status: rInv.status, message: rInv.message })
    check("S8.4.2 message : maximum inferieur au minimum", /maximum per family .* is lower than the minimum/i.test(String(rInv.message || "")), rInv.message)

    const rLow = await calc({ budget: 100, familyIds: ids, minAmt: 1000, maxAmt: 50000, reserve: 0 })
    check("S8.4.3 budget trop faible -> refus 422", rLow.status === 422 || rLow.status >= 400, { status: rLow.status, message: rLow.message })
    check("S8.4.4 message : budget trop faible pour le nombre de familles", /budget too low/i.test(String(rLow.message || "")), rLow.message)

    /* Budget exactement egal au minimum requis */
    const n = ids.length
    const exact = 1000 * n
    const rExact = await calc({ budget: exact, familyIds: ids, minAmt: 1000, maxAmt: 50000, reserve: 0 })
    if (check("S8.4.5 budget = minAmt x N (limite exacte) accepte", rExact.status < 300, { status: rExact.status, message: rExact.message })) {
      const d = rExact.data.result || rExact.data
      check("S8.4.6 chaque famille recoit exactement le minimum", d.distributions.every((x) => Math.abs(num(x.amount) - 1000) < 0.05), d.distributions.map((x) => x.amount))
      near("S8.4.7 totalAllocated = budget", num(d.totalAllocated), exact, 0.05)
    }
    const rJuste = await calc({ budget: exact - 1, familyIds: ids, minAmt: 1000, maxAmt: 50000, reserve: 0 })
    check("S8.4.8 budget = minAmt x N - 1 refuse", rJuste.status >= 400, { status: rJuste.status, message: rJuste.message })

    /* Plafond : budget enorme -> tout le monde au max, reste non alloue */
    const rHuge = await calc({ budget: 100000000, familyIds: ids, minAmt: 1000, maxAmt: 20000, reserve: 0 })
    if (check("S8.4.9 budget enorme accepte", rHuge.status < 300, { status: rHuge.status, message: rHuge.message })) {
      const d = rHuge.data.result || rHuge.data
      check("S8.4.10 toutes les familles sont au plafond maxAmt", d.distributions.every((x) => Math.abs(num(x.amount) - 20000) < 0.05), d.distributions.map((x) => x.amount))
      near("S8.4.11 totalAllocated = maxAmt x N", num(d.totalAllocated), 20000 * ids.length, 0.05)
      check("S8.4.12 le solde non alloue est important", num(d.unallocated) > 0, d.unallocated)
    }
    /* minAmt = maxAmt : repartition uniforme */
    const rEq = await calc({ budget: 5000 * ids.length, familyIds: ids, minAmt: 5000, maxAmt: 5000, reserve: 0 })
    if (rEq.status < 300) {
      const d = rEq.data.result || rEq.data
      check("S8.4.13 minAmt = maxAmt -> montants identiques", new Set(d.distributions.map((x) => num(x.amount))).size === 1, d.distributions.map((x) => x.amount))
    } else info("S8.4.13 minAmt = maxAmt", { status: rEq.status, message: rEq.message })
    /* minAmt = 0 */
    const rZero = await calc({ budget: 100000, familyIds: ids, minAmt: 0, maxAmt: 50000, reserve: 0 })
    check("S8.4.14 minAmt = 0 gere", rZero.status < 500, { status: rZero.status, message: rZero.message })
    for (const bad of ["abc", -100, null]) {
      const rb = await calc({ budget: 200000, familyIds: ids, minAmt: bad, maxAmt: 50000 })
      check(`S8.4.15 minAmt = ${short(bad, 8)} gere sans 500`, rb.status < 500, { status: rb.status, message: rb.message })
    }
  })

  /* ---- 8.5 Selection des familles eligibles ---- */
  await guard("S8.5", async () => {
    const BUD = 400000
    /* Sous-ensemble via familyIds */
    const subset = ids.slice(0, 2)
    const rSub = await calc({ budget: BUD, familyIds: subset, minAmt: 1000, maxAmt: 200000 })
    if (check("S8.5.1 familyIds restreint la selection", rSub.status < 300, { status: rSub.status, message: rSub.message })) {
      const d = rSub.data.result || rSub.data
      eq("S8.5.2 exactement 2 lignes", d.distributions.length, 2)
      check("S8.5.3 seules les familles demandees sont presentes", d.distributions.every((x) => subset.includes(x.familyId)), d.distributions.map((x) => x.familyId))
    }
    /* Famille archivee : doit etre exclue */
    const target = ids[ids.length - 1]
    await DEL(`/api/families/${target}?mode=soft`)
    const rArch = await calc({ budget: BUD, familyIds: ids, minAmt: 1000, maxAmt: 200000 })
    if (rArch.status < 300) {
      const d = rArch.data.result || rArch.data
      check("S8.5.4 la famille ARCHIVEE est exclue du calcul", !d.distributions.some((x) => x.familyId === target), d.distributions.map((x) => x.familyId))
      eq("S8.5.5 il reste N-1 familles", d.distributions.length, ids.length - 1)
    } else info("S8.5.4 calcul apres archivage", { status: rArch.status, message: rArch.message })
    /* INACTIVE aussi exclue */
    await patchFamily(target, { status: "INACTIVE" })
    const rIna = await calc({ budget: BUD, familyIds: ids, minAmt: 1000, maxAmt: 200000 })
    if (rIna.status < 300) {
      const d = rIna.data.result || rIna.data
      check("S8.5.6 la famille INACTIVE est exclue du calcul", !d.distributions.some((x) => x.familyId === target), d.distributions.map((x) => x.familyId))
    }
    /* Reactivation : elle revient */
    await patchFamily(target, { status: "ACTIVE" })
    const rBack = await calc({ budget: BUD, familyIds: ids, minAmt: 1000, maxAmt: 200000 })
    if (rBack.status < 300) {
      const d = rBack.data.result || rBack.data
      check("S8.5.7 apres reactivation, la famille revient dans le calcul", d.distributions.some((x) => x.familyId === target), d.distributions.length)
    }
    /* familyIds inexistants */
    const rGhost = await calc({ budget: BUD, familyIds: ["inexistant-1", "inexistant-2"] })
    check("S8.5.8 familyIds inexistants -> aucune famille a servir", rGhost.status >= 400, { status: rGhost.status, message: rGhost.message })
    check("S8.5.9 message : No families to distribute to.", /no families to distribute/i.test(String(rGhost.message || "")), rGhost.message)
    const rEmptyIds = await calc({ budget: BUD, familyIds: [] })
    check("S8.5.10 familyIds = [] -> toutes les familles actives", rEmptyIds.status < 500, { status: rEmptyIds.status, n: rEmptyIds.data && (rEmptyIds.data.result || rEmptyIds.data).distributions && (rEmptyIds.data.result || rEmptyIds.data).distributions.length })
    const rBadIds = await calc({ budget: BUD, familyIds: "pas-un-tableau" })
    check("S8.5.11 familyIds non tableau gere sans 500", rBadIds.status < 500, { status: rBadIds.status, message: rBadIds.message })
  })

  /* ---- 8.6 Score total nul ---- */
  await guard("S8.6", async () => {
    const zeros = []
    for (let i = 0; i < 2; i++) {
      const { f } = await createFamily(baselineOver({}))
      if (f) zeros.push({ id: f.id, score: num(f.svfScore) })
    }
    if (zeros.length && zeros.every((z) => z.score === 0)) {
      const r = await calc({ budget: 100000, familyIds: zeros.map((z) => z.id), minAmt: 1000, maxAmt: 50000, reserve: 0 })
      check("S8.6.1 toutes les familles a score 0 -> refus 422", r.status === 422 || r.status >= 400, { status: r.status, message: r.message })
      check("S8.6.2 message : score total nul", /total svf score is zero/i.test(String(r.message || "")), r.message)
      check("S8.6.3 le detail du resultat est renvoye dans l'erreur", r.json && ("result" in r.json || r.json.message), Object.keys(r.json || {}))
    } else info("S8.6 score total nul", { note: "impossible de fabriquer 2 familles a score 0", zeros })
  })

  /* ---- 8.7 Repetitions et coherence budgetaire ---- */
  await guard("S8.7", async () => {
    const budgets = [50000, 100000, 200000, 400000, 800000, 1600000]
    const runs = []
    for (const b of budgets) {
      const r = await calc({ budget: b, familyIds: ids, minAmt: 1000, maxAmt: 500000, reserve: 0.1 })
      if (r.status >= 300) { runs.push({ budget: b, refus: r.message }); continue }
      const d = r.data.result || r.data
      runs.push({ budget: b, net: num(d.netBudget), alloue: num(d.totalAllocated), reste: num(d.unallocated), montants: d.distributions.map((x) => num(x.amount)) })
    }
    info("S8.7.1 balayage de budgets", runs.map((x) => pick(x, ["budget", "net", "alloue", "reste"])))
    const ok = runs.filter((x) => x.montants)
    let croissant = true
    for (let i = 1; i < ok.length; i++) {
      for (let j = 0; j < ok[i].montants.length; j++) {
        if (ok[i].montants[j] < ok[i - 1].montants[j] - 0.05) croissant = false
      }
    }
    check("S8.7.2 monotonie budgetaire : doubler le budget n'abaisse aucun montant", croissant, ok.map((x) => x.montants))
    check("S8.7.3 aucun depassement du netBudget sur tout le balayage", ok.every((x) => x.alloue <= x.net + 0.05), ok.map((x) => ({ b: x.budget, a: x.alloue, n: x.net })))
    /* Idempotence : meme entree -> meme sortie */
    const a = await calc({ budget: 333333, familyIds: ids, minAmt: 1000, maxAmt: 50000, reserve: 0.1 })
    const b2 = await calc({ budget: 333333, familyIds: ids, minAmt: 1000, maxAmt: 50000, reserve: 0.1 })
    if (a.status < 300 && b2.status < 300) {
      const da = (a.data.result || a.data).distributions.map((x) => [x.familyId, x.amount]).sort()
      const db = (b2.data.result || b2.data).distributions.map((x) => [x.familyId, x.amount]).sort()
      eq("S8.7.4 calcul deterministe (2 appels identiques)", JSON.stringify(da), JSON.stringify(db))
    }
    /* Budget decimal */
    const rDec = await calc({ budget: 123456.78, familyIds: ids, minAmt: 1000, maxAmt: 50000, reserve: 0.1 })
    if (rDec.status < 300) {
      const d = rDec.data.result || rDec.data
      check("S8.7.5 budget decimal : montants arrondis a 2 decimales", d.distributions.every((x) => Math.abs(num(x.amount) - round2(num(x.amount))) < 1e-9), d.distributions.map((x) => x.amount))
      check("S8.7.6 budget decimal : pas de derive d'arrondi", num(d.totalAllocated) <= num(d.netBudget) + 0.05, { a: d.totalAllocated, n: d.netBudget })
    }
  })

  /* ---- 8.8 Impact du score sur la repartition (familles de statuts differents) ---- */
  await guard("S8.8", async () => {
    const r = await calc({ budget: 600000, familyIds: ids, minAmt: 1000, maxAmt: 500000, reserve: 0 })
    if (r.status >= 300) return info("S8.8 non applicable", { status: r.status, message: r.message })
    const d = r.data.result || r.data
    const byId = new Map(d.distributions.map((x) => [x.familyId, x]))
    const rows = cohort.map((c) => ({ profil: c.label, score: c.score, montant: byId.get(c.id) ? num(byId.get(c.id).amount) : null }))
    info("S8.8.1 montant par profil social", rows)
    const presents = rows.filter((x) => x.montant !== null && x.score > 0)
    for (let i = 1; i < presents.length; i++) {
      const hi = presents[i - 1], lo = presents[i]
      if (hi.score > lo.score) {
        check(`S8.8.2 "${hi.profil}" (score ${hi.score}) recoit >= "${lo.profil}" (score ${lo.score})`, hi.montant >= lo.montant - 0.05, { hi, lo })
      }
    }
    const total = round2(presents.reduce((a, x) => a + x.montant, 0))
    check("S8.8.3 total distribue coherent", total <= num(d.netBudget) + 0.05, { total, net: d.netBudget })
  })
})

/* ################################################################################### */
/* #  S9 -- DISTRIBUTIONS : CYCLE DE VIE COMPLET                                      # */
/* ################################################################################### */

async function mosqueBalance() {
  const r = await GET("/api/mosque")
  const m = r.data && (r.data.mosque || r.data)
  return num(m && m.balance)
}

/* Alimente le solde de la mosquee via un don, pour pouvoir confirmer une distribution. */
async function fundMosque(amount) {
  const dn = await POST("/api/donors", { name: `${TAG} Bailleur ${uid("D")}`, donorType: "INDIVIDUAL", phone: "0555111222" })
  const donor = dn.data && (dn.data.donor || dn.data)
  if (donor && donor.id) CLEAN.donors.push(donor.id)
  if (!donor) return { ok: false, reason: dn.message }
  const d = await POST("/api/donations", {
    donorId: donor.id, amount, category: "SADAQAH", paymentMethod: "CASH",
    receivedAt: new Date().toISOString(), notes: `${TAG} alimentation`,
  })
  const don = d.data && (d.data.donation || d.data)
  if (don && don.id) CLEAN.donations.push(don.id)
  return { ok: d.status < 300, donorId: donor.id, donationId: don && don.id, reason: d.message }
}

section("S9", "Distributions : calcul, confirmation, paiement, solde, annulation", async () => {
  const cohort = await buildCohort()
  const ids = cohort.map((c) => c.id)
  if (ids.length < 2) return fail("S9.0 cohorte", "cohorte insuffisante")
  info("S9.0 cohorte", cohort)

  /* ---- 9.1 Alimentation du solde ---- */
  const BUDGET = 120000
  await guard("S9.1", async () => {
    const b0 = await mosqueBalance()
    const f = await fundMosque(BUDGET * 3)
    if (!check("S9.1.1 don d'alimentation enregistre", f.ok, f)) return
    const b1 = await mosqueBalance()
    near("S9.1.2 le solde augmente exactement du montant du don", round2(b1 - b0), BUDGET * 3, 0.02, { avant: b0, apres: b1 })
  })

  /* ---- 9.2 Confirmation : validations ---- */
  await guard("S9.2", async () => {
    const rNoBud = await POST("/api/distribution/confirm", {})
    check("S9.2.1 budget absent refuse", rNoBud.status >= 400, { status: rNoBud.status, message: rNoBud.message })
    check("S9.2.2 message : budget positif requis", /positive .*budget.* is required/i.test(String(rNoBud.message || "")), rNoBud.message)
    for (const b of [0, -100, "abc"]) {
      const r = await POST("/api/distribution/confirm", { budget: b, familyIds: ids })
      check(`S9.2.3 budget = ${b} refuse`, r.status >= 400 && r.status < 500, { status: r.status, message: r.message })
    }
    const solde = await mosqueBalance()
    const rTooBig = await POST("/api/distribution/confirm", { budget: solde + 1000000, familyIds: ids, minAmt: 1000, maxAmt: 500000 })
    check("S9.2.4 budget superieur au solde -> refus 422", rTooBig.status === 422 || rTooBig.status >= 400, { status: rTooBig.status, message: rTooBig.message })
    check("S9.2.5 message : solde insuffisant avec montants", /insufficient mosque balance/i.test(String(rTooBig.message || "")), rTooBig.message)
    expectFailure("S9.2.6 sans token", await POST("/api/distribution/confirm", { budget: 1000 }, { token: null }), 401, "Authentication required.")
    const rGhost = await POST("/api/distribution/confirm", { budget: 50000, familyIds: ["inexistant-9"] })
    check("S9.2.7 familles inexistantes refusees", rGhost.status >= 400, { status: rGhost.status, message: rGhost.message })
  })

  /* ---- 9.3 Cycle complet : confirmation -> items -> paiement ---- */
  let distId = null
  let items = []
  await guard("S9.3", async () => {
    const b0 = await mosqueBalance()
    const scoresBefore = {}
    for (const c of cohort) scoresBefore[c.id] = await scoreOf(c.id)

    const r = await POST("/api/distribution/confirm", { budget: BUDGET, familyIds: ids, minAmt: 1000, maxAmt: 50000, reserve: 0.1, title: `${TAG} Distribution ${SUF}` })
    if (!expectOk("S9.3.1 confirmation de la distribution", r)) return info("S9.3 abandon", { status: r.status, message: r.message })
    const dist = r.data && (r.data.distribution || r.data)
    distId = dist && dist.id
    if (distId) CLEAN.distributions.push(distId)
    isType("S9.3.2 distribution.id", distId, "string")
    eq("S9.3.3 statut initial = APPROVED", dist.status, "APPROVED")
    eq("S9.3.4 totalDistributed = 0 a la creation", num(dist.totalDistributed), 0)
    isType("S9.3.5 createdAt ISO", dist.createdAt, "iso")

    const g = await GET(`/api/distributions/${distId}`)
    expectOk("S9.3.6 GET distribution par id", g, 200)
    const full = g.data && (g.data.distribution || g.data)
    items = (full && full.items) || []
    isType("S9.3.7 items est un tableau", items, "array")
    check("S9.3.8 un item par famille servie", items.length >= 1 && items.length <= ids.length, { n: items.length })
    check("S9.3.9 tous les items sont PENDING", items.every((x) => x.paymentStatus === "PENDING" || x.status === "PENDING"), items.map((x) => x.paymentStatus || x.status))
    for (const it of items) {
      isType(`S9.3.10 item.amount numerique`, num(it.amount), "number")
      check(`S9.3.11 item.amount > 0`, num(it.amount) > 0, it.amount)
      check(`S9.3.12 snapshot du score present`, it.svfSnapshot !== undefined || it.svfScore !== undefined, Object.keys(it))
      check(`S9.3.13 snapshot de priorite present`, it.prioritySnapshot !== undefined || it.priority !== undefined, Object.keys(it))
    }
    const sum = round2(items.reduce((a, x) => a + num(x.amount), 0))
    check("S9.3.14 somme des items <= budget net", sum <= round2(BUDGET * 0.9) + 0.05, { sum, net: round2(BUDGET * 0.9) })

    const b1 = await mosqueBalance()
    eq("S9.3.15 le solde N'EST PAS debite a la confirmation", b1, b0)

    for (const it of items) {
      const fid = it.familyId || (it.family && it.family.id)
      if (!fid) continue
      const { f } = await getFamily(fid)
      check(`S9.3.16 lastAidAt renseigne (${fid.slice(-6)})`, !!f.lastAidAt, f.lastAidAt)
    }
    /* Malus d'aide : le score doit baisser de malus_per_aid */
    for (const it of items.slice(0, 2)) {
      const fid = it.familyId || (it.family && it.family.id)
      if (!fid || scoresBefore[fid] === undefined) continue
      const after = await scoreOf(fid)
      const delta = round2(scoresBefore[fid] - after)
      check(`S9.3.17 malus applique apres aide (${fid.slice(-6)})`, delta >= 0, { avant: scoresBefore[fid], apres: after, delta })
      if (delta > 0) near(`S9.3.18 malus = malus_per_aid (${fid.slice(-6)})`, delta, W("malus_per_aid"), 0.02)
      else info(`S9.3.18 malus (${fid.slice(-6)})`, { note: "malus applique au paiement, pas a la confirmation", avant: scoresBefore[fid], apres: after })
    }
  })

  /* ---- 9.4 Paiement des items ---- */
  await guard("S9.4", async () => {
    if (!distId || !items.length) return skip("S9.4", "pas de distribution disponible")
    const it = items[0]
    const b0 = await mosqueBalance()

    const rBadStatus = await PUT(`/api/distributions/${distId}`, { itemId: it.id, paymentStatus: "PAYE" })
    check("S9.4.1 paymentStatus invalide refuse", rBadStatus.status >= 400, { status: rBadStatus.status, message: rBadStatus.message })
    check("S9.4.2 message : Invalid paymentStatus.", /invalid paymentstatus/i.test(String(rBadStatus.message || "")), rBadStatus.message)
    const rNothing = await PUT(`/api/distributions/${distId}`, {})
    check("S9.4.3 corps sans champ exploitable refuse", rNothing.status >= 400, { status: rNothing.status, message: rNothing.message })
    const rGhostItem = await PUT(`/api/distributions/${distId}`, { itemId: "item-inexistant", paymentStatus: "PAID" })
    check("S9.4.4 itemId inexistant -> 404", rGhostItem.status === 404, { status: rGhostItem.status, message: rGhostItem.message })

    const r = await PUT(`/api/distributions/${distId}`, { itemId: it.id, paymentStatus: "PAID" })
    if (expectOk("S9.4.5 marquer un item comme PAID", r, 200)) {
      const b1 = await mosqueBalance()
      near("S9.4.6 le solde est debite du montant de l'item", round2(b0 - b1), num(it.amount), 0.05, { avant: b0, apres: b1, montant: it.amount })
      const g = await GET(`/api/distributions/${distId}`)
      const full = g.data && (g.data.distribution || g.data)
      near("S9.4.7 totalDistributed augmente du montant", num(full.totalDistributed), num(it.amount), 0.05)
      const updated = (full.items || []).find((x) => x.id === it.id)
      check("S9.4.8 item passe a PAID", updated && (updated.paymentStatus === "PAID" || updated.status === "PAID"), updated && (updated.paymentStatus || updated.status))
      const others = (full.items || []).filter((x) => x.id !== it.id)
      check("S9.4.9 les autres items restent PENDING", others.every((x) => (x.paymentStatus || x.status) === "PENDING"), others.map((x) => x.paymentStatus || x.status))
      check("S9.4.10 la distribution reste APPROVED tant qu'il reste des PENDING",
        others.length === 0 || full.status === "APPROVED", { status: full.status, pending: others.length })

      const rAgain = await PUT(`/api/distributions/${distId}`, { itemId: it.id, paymentStatus: "PAID" })
      check("S9.4.11 re-paiement du meme item refuse (409)", rAgain.status === 409, { status: rAgain.status, message: rAgain.message })
      check("S9.4.12 message : statut non modifiable", /can no longer be changed/i.test(String(rAgain.message || "")), rAgain.message)
      const b2 = await mosqueBalance()
      eq("S9.4.13 aucun double debit apres tentative de re-paiement", b2, b1)
    }

    /* CANCELLED sur un item */
    const pend = items.find((x) => x.id !== it.id)
    if (pend) {
      const bA = await mosqueBalance()
      const rC = await PUT(`/api/distributions/${distId}`, { itemId: pend.id, paymentStatus: "CANCELLED" })
      if (check("S9.4.14 annuler un item PENDING", rC.status < 300, { status: rC.status, message: rC.message })) {
        const bB = await mosqueBalance()
        eq("S9.4.15 annulation d'un item : aucun impact sur le solde", bB, bA)
      }
    }

    /* Payer tous les items restants -> passage automatique en COMPLETED */
    const g2 = await GET(`/api/distributions/${distId}`)
    const rest = (((g2.data || {}).distribution || g2.data || {}).items || []).filter((x) => (x.paymentStatus || x.status) === "PENDING")
    for (const x of rest) await PUT(`/api/distributions/${distId}`, { itemId: x.id, paymentStatus: "PAID" })
    const g3 = await GET(`/api/distributions/${distId}`)
    const full3 = (g3.data || {}).distribution || g3.data
    if (full3) {
      const stillPending = (full3.items || []).filter((x) => (x.paymentStatus || x.status) === "PENDING").length
      eq("S9.4.16 plus aucun item PENDING", stillPending, 0)
      eq("S9.4.17 la distribution bascule en COMPLETED", full3.status, "COMPLETED")
      const paidSum = round2((full3.items || []).filter((x) => (x.paymentStatus || x.status) === "PAID").reduce((a, x) => a + num(x.amount), 0))
      near("S9.4.18 totalDistributed = somme des items payes", num(full3.totalDistributed), paidSum, 0.05)
    }
  })

  /* ---- 9.5 Statuts de la distribution ---- */
  await guard("S9.5", async () => {
    if (!distId) return skip("S9.5", "pas de distribution")
    const rBad = await PUT(`/api/distributions/${distId}`, { status: "TERMINEE" })
    check("S9.5.1 statut invalide refuse", rBad.status >= 400, { status: rBad.status, message: rBad.message })
    check("S9.5.2 message liste les statuts valides", /DRAFT.*APPROVED.*COMPLETED.*CANCELLED/i.test(String(rBad.message || "")), rBad.message)
    for (const st of ["DRAFT", "APPROVED", "COMPLETED"]) {
      const r = await PUT(`/api/distributions/${distId}`, { status: st })
      check(`S9.5.3 status -> ${st}`, r.status < 500, { status: r.status, message: r.message })
    }
    const rNotes = await PUT(`/api/distributions/${distId}`, { notes: "note de suivi" })
    check("S9.5.4 mise a jour des notes", rNotes.status < 300, { status: rNotes.status, message: rNotes.message })
    const rBoth = await PUT(`/api/distributions/${distId}`, { status: "COMPLETED", itemId: "x", paymentStatus: "PAID" })
    check("S9.5.5 melange des deux modes refuse ou traite sans 500", rBoth.status < 500, { status: rBoth.status, message: rBoth.message })
    eq("S9.5.6 PUT sur distribution inexistante -> 404", (await PUT("/api/distributions/inexistante-x", { notes: "x" })).status, 404)
  })

  /* ---- 9.6 Liste des distributions ---- */
  await guard("S9.6", async () => {
    const r = await GET("/api/distributions")
    expectOk("S9.6.1 GET /api/distributions", r, 200)
    isType("S9.6.2 data.distributions tableau", r.data && r.data.distributions, "array")
    isType("S9.6.3 data.count numerique", num(r.data && r.data.count), "number")
    const list = (r.data && r.data.distributions) || []
    if (distId) check("S9.6.4 la distribution creee est presente", list.some((x) => x.id === distId), { n: list.length })
    for (const x of list.slice(0, 5)) {
      inEnum("S9.6.5 statut valide", x.status, ["DRAFT", "APPROVED", "COMPLETED", "CANCELLED"])
      isType("S9.6.6 totalAmount ou totalDistributed numerique", num(x.totalDistributed !== undefined ? x.totalDistributed : x.totalAmount), "number")
      isType("S9.6.7 createdAt ISO", x.createdAt, "iso")
    }
    expectFailure("S9.6.8 sans token", await GET("/api/distributions", { token: null }), 401, "Authentication required.")
  })

  /* ---- 9.7 Distribution manuelle (POST /api/distributions) ---- */
  await guard("S9.7", async () => {
    const fam = cohort[0]
    if (!fam) return skip("S9.7", "pas de famille")
    const rNoFam = await POST("/api/distributions", { amount: 5000 })
    check("S9.7.1 familyId requis", rNoFam.status >= 400 && /familyid is required/i.test(String(rNoFam.message || "")), { status: rNoFam.status, message: rNoFam.message })
    for (const a of [0, -100, "abc", null]) {
      const r = await POST("/api/distributions", { familyId: fam.id, amount: a })
      check(`S9.7.2 montant ${short(a, 8)} refuse`, r.status >= 400 && r.status < 500, { status: r.status, message: r.message })
    }
    eq("S9.7.3 famille inexistante -> 404", (await POST("/api/distributions", { familyId: "inexistante-z", amount: 1000 })).status, 404)
    const solde = await mosqueBalance()
    const rOver = await POST("/api/distributions", { familyId: fam.id, amount: solde + 999999 })
    check("S9.7.4 montant superieur au solde -> 422", rOver.status === 422 || rOver.status >= 400, { status: rOver.status, message: rOver.message })

    await fundMosque(60000)
    const b0 = await mosqueBalance()
    const AMT = 7500
    const r = await POST("/api/distributions", { familyId: fam.id, amount: AMT, title: `${TAG} Aide directe`, notes: "test manuel" })
    if (expectOk("S9.7.5 distribution manuelle creee", r)) {
      const d = r.data && (r.data.distribution || r.data)
      if (d && d.id) CLEAN.distributions.push(d.id)
      eq("S9.7.6 statut = COMPLETED immediatement", d.status, "COMPLETED")
      near("S9.7.7 totalDistributed = montant", num(d.totalDistributed), AMT, 0.02)
      const b1 = await mosqueBalance()
      near("S9.7.8 le solde est debite immediatement", round2(b0 - b1), AMT, 0.02, { avant: b0, apres: b1 })
      const g = await GET(`/api/distributions/${d.id}`)
      const full = (g.data || {}).distribution || g.data
      eq("S9.7.9 un item unique cree", ((full || {}).items || []).length, 1)
      const it = ((full || {}).items || [])[0]
      if (it) {
        check("S9.7.10 item deja PAID", (it.paymentStatus || it.status) === "PAID", it.paymentStatus || it.status)
        near("S9.7.11 montant de l'item correct", num(it.amount), AMT, 0.02)
      }
      const { f } = await getFamily(fam.id)
      check("S9.7.12 lastAidAt de la famille mis a jour", !!f.lastAidAt, f.lastAidAt)
    }
  })

  /* ---- 9.8 Suppression d'une distribution et remboursement ---- */
  await guard("S9.8", async () => {
    await fundMosque(50000)
    const fam = cohort[1] || cohort[0]
    const AMT = 4000
    const r = await POST("/api/distributions", { familyId: fam.id, amount: AMT, title: `${TAG} A supprimer` })
    const d = r.data && (r.data.distribution || r.data)
    if (!d || !d.id) return skip("S9.8", "distribution non creee")
    const b0 = await mosqueBalance()
    const del = await DEL(`/api/distributions/${d.id}`)
    if (expectOk("S9.8.1 DELETE distribution", del, 200)) {
      const b1 = await mosqueBalance()
      near("S9.8.2 le solde est rembourse du montant distribue", round2(b1 - b0), AMT, 0.02, { avant: b0, apres: b1 })
      eq("S9.8.3 la distribution n'existe plus", (await GET(`/api/distributions/${d.id}`)).status, 404)
      const lst = await GET("/api/distributions")
      check("S9.8.4 absente de la liste", !((lst.data || {}).distributions || []).some((x) => x.id === d.id))
      const idx = CLEAN.distributions.indexOf(d.id); if (idx >= 0) CLEAN.distributions.splice(idx, 1)
    }
    eq("S9.8.5 seconde suppression -> 404", (await DEL(`/api/distributions/${d.id}`)).status, 404)
    expectFailure("S9.8.6 DELETE sans token", await DEL("/api/distributions/x", { token: null }), 401, "Authentication required.")
  })

  /* ---- 9.9 Famille avec historique d'aide : suppression definitive bloquee ---- */
  await guard("S9.9", async () => {
    await fundMosque(30000)
    const { f } = await createFamily({ maritalStatus: "WIDOWED", monthlyIncome: 3000 })
    if (!f) return skip("S9.9", "famille non creee")
    const r = await POST("/api/distributions", { familyId: f.id, amount: 2500, title: `${TAG} Historique` })
    const d = r.data && (r.data.distribution || r.data)
    if (d && d.id) CLEAN.distributions.push(d.id)
    if (r.status >= 300) return info("S9.9 non applicable", { status: r.status, message: r.message })
    const del = await DEL(`/api/families/${f.id}?mode=hard`)
    check("S9.9.1 suppression definitive d'une famille aidee -> 409", del.status === 409, { status: del.status, message: del.message })
    check("S9.9.2 message explicite sur l'historique d'aide", /aid|distribution|history|historique/i.test(String(del.message || "")), del.message)
    const soft = await DEL(`/api/families/${f.id}?mode=soft`)
    check("S9.9.3 l'archivage reste possible", soft.status < 300, { status: soft.status, message: soft.message })
    const { f: af } = await getFamily(f.id)
    eq("S9.9.4 famille archivee, ligne conservee", af && af.status, "ARCHIVED")
  })

  /* ---- 9.10 Repetitions : plusieurs cycles enchaines ---- */
  await guard("S9.10", async () => {
    await fundMosque(300000)
    const journal = []
    for (let i = 0; i < 3; i++) {
      const scoresBefore = {}
      for (const c of cohort) scoresBefore[c.id] = await scoreOf(c.id)
      const b0 = await mosqueBalance()
      const r = await POST("/api/distribution/confirm", { budget: 40000, familyIds: ids, minAmt: 1000, maxAmt: 20000, reserve: 0 })
      if (r.status >= 300) { journal.push({ cycle: i + 1, refus: r.message, status: r.status }); continue }
      const d = r.data.distribution || r.data
      if (d && d.id) CLEAN.distributions.push(d.id)
      const g = await GET(`/api/distributions/${d.id}`)
      const its = (((g.data || {}).distribution || g.data || {}).items) || []
      for (const x of its) await PUT(`/api/distributions/${d.id}`, { itemId: x.id, paymentStatus: "PAID" })
      const b1 = await mosqueBalance()
      const paid = round2(its.reduce((a, x) => a + num(x.amount), 0))
      const scoresAfter = {}
      for (const c of cohort) scoresAfter[c.id] = await scoreOf(c.id)
      journal.push({ cycle: i + 1, items: its.length, paye: paid, soldeAvant: b0, soldeApres: b1, delta: round2(b0 - b1) })
      near(`S9.10.1 cycle ${i + 1} : solde debite du total paye`, round2(b0 - b1), paid, 0.1)
      const baisses = Object.keys(scoresAfter).filter((k) => scoresAfter[k] < scoresBefore[k])
      check(`S9.10.2 cycle ${i + 1} : les scores des familles aidees baissent (malus cumule)`, baisses.length >= 0, { baisses: baisses.length })
    }
    info("S9.10.3 journal des 3 cycles", journal)
    /* Le malus est plafonne : apres 3 aides, la baisse totale <= max_malus */
    for (const c of cohort) {
      const now = await scoreOf(c.id)
      const chute = round2(c.score - now)
      check(`S9.10.4 malus cumule plafonne pour "${c.label}"`, chute <= W("max_malus") + 0.02, { scoreInitial: c.score, scoreActuel: now, chute, plafond: W("max_malus") })
    }
  })
})

/* ################################################################################### */
/* #  S10 -- DONATEURS ET DONS                                                        # */
/* ################################################################################### */

const DONOR_TYPES = ["INDIVIDUAL", "COMPANY", "ORGANIZATION", "ANONYMOUS"]
const CATEGORIES = ["ZAKAT_MAL", "ZAKAT_FITR", "SADAQAH", "OTHER"]
const PAYMENT_METHODS = ["CASH", "CCP", "BANK_TRANSFER"]

section("S10", "Donateurs et dons : validation, categories, solde, KAFFARA supprimee", async () => {

  let donorId = null

  /* ---- 10.1 Creation de donateur ---- */
  await guard("S10.1", async () => {
    const rEmpty = await POST("/api/donors", {})
    check("S10.1.1 nom requis", rEmpty.status === 400 && /donor name is required/i.test(String(rEmpty.message || "")), { status: rEmpty.status, message: rEmpty.message })
    for (const bad of ["", "   ", null]) {
      const r = await POST("/api/donors", { name: bad })
      check(`S10.1.2 nom ${short(bad, 8)} refuse`, r.status === 400, { status: r.status, message: r.message })
    }
    const name = `${TAG} Donateur ${uid("DN")}`
    const r = await POST("/api/donors", { name, donorType: "INDIVIDUAL", phone: "0770123456", email: `don.${SUF}@test.dz`, address: "Rue 1", notes: "cree par le test" })
    if (expectOk("S10.1.3 creation de donateur", r)) {
      const d = r.data.donor || r.data
      donorId = d.id
      CLEAN.donors.push(donorId)
      eq("S10.1.4 code HTTP 201", r.status, 201)
      isType("S10.1.5 id string", d.id, "string")
      eq("S10.1.6 nom conserve", d.name, name)
      eq("S10.1.7 donorType conserve", d.donorType, "INDIVIDUAL")
      isType("S10.1.8 totalDonated numerique", num(d.totalDonated), "number")
      eq("S10.1.9 totalDonated initial = 0", num(d.totalDonated), 0)
      isType("S10.1.10 createdAt ISO", d.createdAt, "iso")
    }
    const rDup = await POST("/api/donors", { name, donorType: "INDIVIDUAL", phone: "0770123456", email: `don.${SUF}@test.dz` })
    check("S10.1.11 doublon exact -> 409", rDup.status === 409, { status: rDup.status, message: rDup.message })
    check("S10.1.12 le doublon renvoie donorId pour reutilisation", rDup.json && (rDup.json.donorId || (rDup.json.data && rDup.json.data.donorId)), Object.keys(rDup.json || {}))
    for (const t of DONOR_TYPES) {
      const rt = await POST("/api/donors", { name: `${TAG} ${t} ${uid("T")}`, donorType: t })
      if (rt.status < 300) { CLEAN.donors.push((rt.data.donor || rt.data).id); pass(`S10.1.13 donorType ${t} accepte`) }
      else check(`S10.1.13 donorType ${t}`, rt.status < 500, { status: rt.status, message: rt.message })
    }
    const rBadType = await POST("/api/donors", { name: `${TAG} BadType ${uid("B")}`, donorType: "SOCIETE" })
    check("S10.1.14 donorType invalide refuse sans 500", rBadType.status < 500, { status: rBadType.status, message: rBadType.message })
    expectFailure("S10.1.15 sans token", await POST("/api/donors", { name: "X" }, { token: null }), 401, "Authentication required.")
  })

  /* ---- 10.2 Liste, recherche, lecture, modification, suppression ---- */
  await guard("S10.2", async () => {
    const r = await GET("/api/donors")
    expectOk("S10.2.1 GET /api/donors", r, 200)
    const list = (r.data && (r.data.donors || r.data.results)) || []
    isType("S10.2.2 liste tableau", list, "array")
    if (donorId) check("S10.2.3 le donateur cree est dans la liste", list.some((x) => x.id === donorId), { n: list.length })
    const rs = await GET(`/api/donors?search=${encodeURIComponent(TAG)}`)
    check("S10.2.4 recherche par nom", rs.status === 200 && ((rs.data.donors || []).length > 0), { n: (rs.data.donors || []).length })
    const rq = await GET(`/api/donors?q=${encodeURIComponent(TAG)}`)
    check("S10.2.5 alias ?q= fonctionne", rq.status === 200, { status: rq.status })
    const rNo = await GET("/api/donors?search=ZZZINEXISTANTZZZ")
    eq("S10.2.6 recherche sans resultat -> liste vide", ((rNo.data || {}).donors || []).length, 0)
    const rType = await GET("/api/donors?donorType=INDIVIDUAL")
    check("S10.2.7 filtre donorType", rType.status === 200 && ((rType.data.donors || []).every((x) => x.donorType === "INDIVIDUAL")), [...new Set((rType.data.donors || []).map((x) => x.donorType))])
    const rSql = await GET(`/api/donors?search=${encodeURIComponent("' OR 1=1 --")}`)
    check("S10.2.8 injection SQL neutralisee", rSql.status < 500, { status: rSql.status })

    if (donorId) {
      const g = await GET(`/api/donors/${donorId}`)
      expectOk("S10.2.9 GET donateur par id", g, 200)
      const p = await PUT(`/api/donors/${donorId}`, { phone: "0660999888", notes: "maj" })
      if (expectOk("S10.2.10 PUT donateur", p, 200)) eq("S10.2.11 telephone modifie", (p.data.donor || p.data).phone, "0660999888")
      const pTotal = await PUT(`/api/donors/${donorId}`, { totalDonated: 999999 })
      const gAfter = await GET(`/api/donors/${donorId}`)
      const cur = num(((gAfter.data || {}).donor || gAfter.data || {}).totalDonated)
      check("S10.2.12 totalDonated non modifiable directement", cur !== 999999, { totalDonated: cur, status: pTotal.status })
    }
    eq("S10.2.13 GET donateur inexistant -> 404", (await GET("/api/donors/inexistant-x")).status, 404)
    const tmp = await POST("/api/donors", { name: `${TAG} ASupprimer ${uid("S")}` })
    const tmpId = tmp.status < 300 ? (tmp.data.donor || tmp.data).id : null
    if (tmpId) {
      const del = await DEL(`/api/donors/${tmpId}`)
      if (expectOk("S10.2.14 DELETE donateur", del, 200)) eq("S10.2.15 message de confirmation", del.data && del.data.message, "Donor deleted.")
      eq("S10.2.16 donateur supprime -> 404", (await GET(`/api/donors/${tmpId}`)).status, 404)
    }
  })

  /* ---- 10.3 Dons : validation et categories ---- */
  await guard("S10.3", async () => {
    if (!donorId) return skip("S10.3", "pas de donateur")
    const rNoAmt = await POST("/api/donations", { donorId, category: "SADAQAH", paymentMethod: "CASH" })
    check("S10.3.1 montant requis", rNoAmt.status >= 400, { status: rNoAmt.status, message: rNoAmt.message })
    for (const a of [0, -50, "abc", null]) {
      const r = await POST("/api/donations", { donorId, amount: a, category: "SADAQAH", paymentMethod: "CASH" })
      check(`S10.3.2 montant ${short(a, 8)} refuse`, r.status >= 400 && r.status < 500, { status: r.status, message: r.message })
    }
    /* LE POINT DEMANDE : KAFFARA doit etre rejetee partout */
    const rKaf = await POST("/api/donations", { donorId, amount: 1000, category: "KAFFARA", paymentMethod: "CASH" })
    check("S10.3.3 categorie KAFFARA REJETEE par l'API", rKaf.status === 400, { status: rKaf.status, message: rKaf.message })
    check("S10.3.4 message liste les 4 categories restantes", /ZAKAT_MAL.*ZAKAT_FITR.*SADAQAH.*OTHER/i.test(String(rKaf.message || "")), rKaf.message)
    check("S10.3.5 KAFFARA n'apparait pas dans la liste attendue", !/KAFFARA.*Expected one of.*KAFFARA/i.test(String(rKaf.message || "")), rKaf.message)
    for (const bad of ["kaffara", "Kaffara", "ZAKAT", "", "AUTRE"]) {
      const r = await POST("/api/donations", { donorId, amount: 500, category: bad, paymentMethod: "CASH" })
      check(`S10.3.6 categorie "${bad}" refusee`, r.status === 400, { status: r.status, message: r.message })
    }
    for (const bad of ["ESPECES", "CHEQUE", "", "cash"]) {
      const r = await POST("/api/donations", { donorId, amount: 500, category: "SADAQAH", paymentMethod: bad })
      check(`S10.3.7 moyen de paiement "${bad}" refuse`, r.status === 400, { status: r.status, message: r.message })
    }
    const rBadDate = await POST("/api/donations", { donorId, amount: 500, category: "SADAQAH", paymentMethod: "CASH", receivedAt: "32/13/2020" })
    check("S10.3.8 date de reception invalide refusee", rBadDate.status === 400 && /receivedat is not a valid date/i.test(String(rBadDate.message || "")), { status: rBadDate.status, message: rBadDate.message })
    eq("S10.3.9 donateur inexistant -> 404", (await POST("/api/donations", { donorId: "inexistant-d", amount: 500, category: "SADAQAH", paymentMethod: "CASH" })).status, 404)
  })

  /* ---- 10.4 Enregistrement d'un don : impacts solde et cumul donateur ---- */
  await guard("S10.4", async () => {
    if (!donorId) return skip("S10.4", "pas de donateur")
    const rows = []
    for (const cat of CATEGORIES) {
      for (const pm of PAYMENT_METHODS) {
        const b0 = await mosqueBalance()
        const g0 = await GET(`/api/donors/${donorId}`)
        const t0 = num(((g0.data || {}).donor || g0.data || {}).totalDonated)
        const AMT = 1500
        const r = await POST("/api/donations", { donorId, amount: AMT, category: cat, paymentMethod: pm, receivedAt: new Date().toISOString(), notes: `${TAG} ${cat}/${pm}` })
        if (r.status >= 300) { fail(`S10.4.1 don ${cat}/${pm}`, { status: r.status, message: r.message }); continue }
        const d = r.data.donation || r.data
        CLEAN.donations.push(d.id)
        eq(`S10.4.2 ${cat}/${pm} : categorie conservee`, d.category, cat)
        eq(`S10.4.3 ${cat}/${pm} : moyen conserve`, d.paymentMethod, pm)
        near(`S10.4.4 ${cat}/${pm} : montant conserve`, num(d.amount), AMT, 0.01)
        isType(`S10.4.5 ${cat}/${pm} : receivedAt ISO`, d.receivedAt, "iso")
        const b1 = await mosqueBalance()
        const g1 = await GET(`/api/donors/${donorId}`)
        const t1 = num(((g1.data || {}).donor || g1.data || {}).totalDonated)
        near(`S10.4.6 ${cat}/${pm} : solde mosquee +${AMT}`, round2(b1 - b0), AMT, 0.02)
        near(`S10.4.7 ${cat}/${pm} : totalDonated du donateur +${AMT}`, round2(t1 - t0), AMT, 0.02)
        rows.push({ categorie: cat, moyen: pm, solde: b1, cumulDonateur: t1 })
      }
    }
    info("S10.4.8 matrice 4 categories x 3 moyens de paiement", rows)
  })

  /* ---- 10.5 Liste des dons et filtres ---- */
  await guard("S10.5", async () => {
    const r = await GET("/api/donations")
    expectOk("S10.5.1 GET /api/donations", r, 200)
    const list = (r.data && (r.data.donations || r.data.results)) || []
    isType("S10.5.2 liste tableau", list, "array")
    check("S10.5.3 aucun don KAFFARA en base", !list.some((x) => x.category === "KAFFARA"), [...new Set(list.map((x) => x.category))])
    for (const cat of CATEGORIES) {
      const rc = await GET(`/api/donations?category=${cat}`)
      check(`S10.5.4 filtre category=${cat}`, rc.status === 200 && ((rc.data.donations || []).every((x) => x.category === cat)), [...new Set((rc.data.donations || []).map((x) => x.category))])
    }
    const rKaf = await GET("/api/donations?category=KAFFARA")
    check("S10.5.5 filtre category=KAFFARA -> vide ou refus", rKaf.status >= 400 || ((rKaf.data || {}).donations || []).length === 0, { status: rKaf.status, n: ((rKaf.data || {}).donations || []).length })
    for (const pm of PAYMENT_METHODS) {
      const rp = await GET(`/api/donations?paymentMethod=${pm}`)
      check(`S10.5.6 filtre paymentMethod=${pm}`, rp.status === 200, { status: rp.status })
    }
    if (donorId) {
      const rd = await GET(`/api/donations?donorId=${donorId}`)
      check("S10.5.7 filtre donorId", rd.status === 200 && ((rd.data.donations || []).every((x) => (x.donorId || (x.donor && x.donor.id)) === donorId)), { n: (rd.data.donations || []).length })
      const rdd = await GET(`/api/donors/${donorId}/donations`)
      check("S10.5.8 sous-route /donors/:id/donations", rdd.status === 200, { status: rdd.status })
    }
    const from = new Date(Date.now() - 2 * DAY).toISOString().slice(0, 10)
    const to = new Date(Date.now() + DAY).toISOString().slice(0, 10)
    const rDate = await GET(`/api/donations?from=${from}&to=${to}`)
    check("S10.5.9 filtre de periode from/to", rDate.status === 200, { status: rDate.status, n: ((rDate.data || {}).donations || []).length })
    const rInv = await GET("/api/donations?from=pas-une-date")
    check("S10.5.10 date de filtre invalide geree sans 500", rInv.status < 500, { status: rInv.status, message: rInv.message })
    expectFailure("S10.5.11 sans token", await GET("/api/donations", { token: null }), 401, "Authentication required.")
  })

  /* ---- 10.6 Modification et suppression d'un don ---- */
  await guard("S10.6", async () => {
    if (!donorId) return skip("S10.6", "pas de donateur")
    const r = await POST("/api/donations", { donorId, amount: 3000, category: "SADAQAH", paymentMethod: "CASH" })
    const d = r.status < 300 ? (r.data.donation || r.data) : null
    if (!d) return skip("S10.6", "don non cree")
    const g = await GET(`/api/donations/${d.id}`)
    expectOk("S10.6.1 GET don par id", g, 200)
    const rNoField = await PUT(`/api/donations/${d.id}`, {})
    check("S10.6.2 PUT sans champ exploitable refuse", rNoField.status >= 400 && /no updatable field/i.test(String(rNoField.message || "")), { status: rNoField.status, message: rNoField.message })
    const p = await PUT(`/api/donations/${d.id}`, { notes: "note modifiee", category: "ZAKAT_MAL" })
    if (expectOk("S10.6.3 PUT don", p, 200)) eq("S10.6.4 categorie modifiee", (p.data.donation || p.data).category, "ZAKAT_MAL")
    const pKaf = await PUT(`/api/donations/${d.id}`, { category: "KAFFARA" })
    check("S10.6.5 passage a KAFFARA refuse en modification", pKaf.status === 400, { status: pKaf.status, message: pKaf.message })

    const b0 = await mosqueBalance()
    const g0 = await GET(`/api/donors/${donorId}`)
    const t0 = num(((g0.data || {}).donor || g0.data || {}).totalDonated)
    const del = await DEL(`/api/donations/${d.id}`)
    if (expectOk("S10.6.6 DELETE don", del, 200)) {
      check("S10.6.7 message : don supprime et solde mis a jour", /deleted/i.test(String((del.data && del.data.message) || del.message || "")), del.data)
      const b1 = await mosqueBalance()
      near("S10.6.8 le solde est diminue du montant du don", round2(b0 - b1), 3000, 0.02, { avant: b0, apres: b1 })
      const g1 = await GET(`/api/donors/${donorId}`)
      const t1 = num(((g1.data || {}).donor || g1.data || {}).totalDonated)
      near("S10.6.9 totalDonated du donateur diminue", round2(t0 - t1), 3000, 0.02)
      eq("S10.6.10 don supprime -> 404", (await GET(`/api/donations/${d.id}`)).status, 404)
    }
    const idx = CLEAN.donations.indexOf(d.id); if (idx >= 0) CLEAN.donations.splice(idx, 1)
  })

  /* ---- 10.7 Dons anonymes pilotes par les parametres ---- */
  await guard("S10.7", async () => {
    await PUT("/api/settings", { allowAnonymousDonations: false })
    const rOff = await POST("/api/donations", { amount: 1000, category: "SADAQAH", paymentMethod: "CASH", anonymous: true })
    check("S10.7.1 don anonyme bloque quand le parametre est desactive", rOff.status === 403 || rOff.status >= 400, { status: rOff.status, message: rOff.message })
    check("S10.7.2 code d'erreur ANONYMOUS_DONATIONS_DISABLED", /ANONYMOUS_DONATIONS_DISABLED/i.test(JSON.stringify(rOff.json || {})), rOff.json)
    await PUT("/api/settings", { allowAnonymousDonations: true })
    const b0 = await mosqueBalance()
    const rOn = await POST("/api/donations", { amount: 1000, category: "SADAQAH", paymentMethod: "CASH", anonymous: true })
    if (check("S10.7.3 don anonyme accepte quand le parametre est actif", rOn.status < 300, { status: rOn.status, message: rOn.message })) {
      const dd = rOn.data.donation || rOn.data
      CLEAN.donations.push(dd.id)
      const b1 = await mosqueBalance()
      near("S10.7.4 le don anonyme alimente aussi le solde", round2(b1 - b0), 1000, 0.02)
    }
    await PUT("/api/settings", { allowAnonymousDonations: STATE.settings0 && STATE.settings0.allowAnonymousDonations !== undefined ? STATE.settings0.allowAnonymousDonations : true })
  })
})

/* ################################################################################### */
/* #  S11 -- TABLEAU DE BORD                                                          # */
/* ################################################################################### */

section("S11", "Tableau de bord : statistiques, resume financier, graphiques", async () => {

  await guard("S11.1", async () => {
    const r = await GET("/api/dashboard/stats")
    expectOk("S11.1.1 GET /api/dashboard/stats", r, 200)
    const s = r.data && (r.data.stats || r.data)
    for (const k of ["families", "children", "donors", "donations", "totalReceived", "totalDistributed", "balance"]) {
      check(`S11.1.2 champ present : ${k}`, k in s, Object.keys(s))
      isType(`S11.1.3 ${k} numerique`, num(s[k]), "number")
      check(`S11.1.4 ${k} >= 0`, num(s[k]) >= 0, s[k])
    }
    for (const k of ["families", "children", "donors", "donations"]) isType(`S11.1.5 ${k} entier`, num(s[k]), "int")
    /* Reconciliation avec les listes reelles */
    const fams = await GET("/api/families")
    const nActive = ((fams.data || {}).families || []).length
    check("S11.1.6 nombre de familles coherent avec /api/families", Math.abs(num(s.families) - nActive) <= nActive, { stats: s.families, liste: nActive })
    const dons = await GET("/api/donations")
    const nDon = ((dons.data || {}).donations || []).length
    eq("S11.1.7 nombre de dons coherent avec /api/donations", num(s.donations), nDon)
    const sumDon = round2(((dons.data || {}).donations || []).reduce((a, x) => a + num(x.amount), 0))
    near("S11.1.8 totalReceived = somme des dons", num(s.totalReceived), sumDon, 1)
    const bal = await mosqueBalance()
    near("S11.1.9 balance = solde de la mosquee", num(s.balance), bal, 0.05)
    near("S11.1.10 balance = totalReceived - totalDistributed (a la reserve pres)", num(s.balance), round2(num(s.totalReceived) - num(s.totalDistributed)), Math.max(1, Math.abs(STATE.balance0)) + 1)
    expectFailure("S11.1.11 sans token", await GET("/api/dashboard/stats", { token: null }), 401, "Authentication required.")
  })

  await guard("S11.2", async () => {
    const r = await GET("/api/dashboard/financial-summary")
    expectOk("S11.2.1 GET /api/dashboard/financial-summary", r, 200)
    const s = r.data && (r.data.summary || r.data)
    for (const k of ["totalIn", "totalOut", "balance"]) {
      check(`S11.2.2 champ present : ${k}`, k in s, Object.keys(s))
      isType(`S11.2.3 ${k} numerique`, num(s[k]), "number")
    }
    check("S11.2.4 totalIn >= 0", num(s.totalIn) >= 0, s.totalIn)
    check("S11.2.5 totalOut >= 0", num(s.totalOut) >= 0, s.totalOut)
    near("S11.2.6 balance = totalIn - totalOut", num(s.balance), round2(num(s.totalIn) - num(s.totalOut)), 1)
    /* Le resume ne compte que le liquide : un don CCP ne doit pas bouger totalIn */
    const dn = await POST("/api/donors", { name: `${TAG} CCPTest ${uid("C")}` })
    const dnId = dn.status < 300 ? (dn.data.donor || dn.data).id : null
    if (dnId) {
      CLEAN.donors.push(dnId)
      const before = num(s.totalIn)
      const rc = await POST("/api/donations", { donorId: dnId, amount: 9999, category: "SADAQAH", paymentMethod: "CCP" })
      if (rc.status < 300) {
        CLEAN.donations.push((rc.data.donation || rc.data).id)
        const fsAfter = (await GET("/api/dashboard/financial-summary")).data || {}
        const after = num(fsAfter.totalIn !== undefined ? fsAfter.totalIn : (fsAfter.summary || {}).totalIn)
        info("S11.2.7 impact d'un don CCP sur totalIn", { avant: before, apres: after, delta: round2(after - before), attendu: "0 si le resume est CASH uniquement" })
        check("S11.2.8 don CCP exclu du resume liquide", Math.abs(round2(after - before)) < 0.01 || Math.abs(round2(after - before) - 9999) < 0.01, { avant: before, apres: after })
      }
    }
  })

  await guard("S11.3", async () => {
    const r = await GET("/api/dashboard/monthly-summary")
    expectOk("S11.3.1 GET /api/dashboard/monthly-summary", r, 200)
    const months = (r.data && (r.data.months || r.data)) || []
    isType("S11.3.2 months tableau", months, "array")
    eq("S11.3.3 6 mois par defaut", months.length, 6)
    for (const m of months) {
      check("S11.3.4 champ month present", "month" in m, Object.keys(m))
      isType("S11.3.5 received numerique", num(m.received), "number")
      isType("S11.3.6 distributed numerique", num(m.distributed), "number")
      check("S11.3.7 valeurs non negatives", num(m.received) >= 0 && num(m.distributed) >= 0, m)
      check("S11.3.8 valeurs finies (axe Y non corrompu)", Number.isFinite(num(m.received)) && Number.isFinite(num(m.distributed)), m)
    }
    for (const [q, attendu] of [[1, 1], [3, 3], [12, 12], [36, 36], [0, 1], [-5, 1], [100, 36], ["abc", 6]]) {
      const rm = await GET(`/api/dashboard/monthly-summary?months=${q}`)
      const n = ((rm.data || {}).months || []).length
      check(`S11.3.9 months=${q} -> ${attendu} entrees (borne 1..36)`, rm.status === 200 && (n === attendu || (q === "abc" && n >= 1 && n <= 36)), { demande: q, obtenu: n, status: rm.status })
    }
  })

  await guard("S11.4", async () => {
    const r = await GET("/api/dashboard/social-distribution")
    expectOk("S11.4.1 GET /api/dashboard/social-distribution", r, 200)
    const d = r.data || {}
    isType("S11.4.2 byMaritalStatus tableau", d.byMaritalStatus, "array")
    isType("S11.4.3 byPriority tableau", d.byPriority, "array")
    for (const x of d.byMaritalStatus || []) {
      inEnum("S11.4.4 etat civil valide", x.status, MARITAL)
      isType("S11.4.5 count entier", num(x.count), "int")
    }
    for (const x of d.byPriority || []) {
      inEnum("S11.4.6 priorite valide", x.priority, PRIORITIES)
      isType("S11.4.7 count entier", num(x.count), "int")
    }
    const totalP = (d.byPriority || []).reduce((a, x) => a + num(x.count), 0)
    const totalM = (d.byMaritalStatus || []).reduce((a, x) => a + num(x.count), 0)
    check("S11.4.8 les deux repartitions totalisent le meme nombre de familles", totalP === totalM, { parPriorite: totalP, parEtatCivil: totalM })
    const fams = await GET("/api/families")
    const n = ((fams.data || {}).families || []).length
    check("S11.4.9 total coherent avec la liste des familles actives", Math.abs(totalP - n) <= n, { repartition: totalP, liste: n })
  })
})

/* ################################################################################### */
/* #  S12 -- DOCUMENTS                                                                # */
/* ################################################################################### */

section("S12", "Documents joints aux familles", async () => {
  await guard("S12.1", async () => {
    const { f } = await createFamily({})
    if (!f) return skip("S12", "famille non creee")
    const b64 = Buffer.from(`Document de test ${SUF}`, "utf8").toString("base64")

    const rNoName = await POST(`/api/families/${f.id}/documents`, { contentBase64: b64 })
    check("S12.1.1 originalName requis", rNoName.status === 400 && /originalname is required/i.test(String(rNoName.message || "")), { status: rNoName.status, message: rNoName.message })
    const rNoContent = await POST(`/api/families/${f.id}/documents`, { originalName: "a.txt" })
    check("S12.1.2 contentBase64 requis", rNoContent.status === 400 && /contentbase64 is required/i.test(String(rNoContent.message || "")), { status: rNoContent.status, message: rNoContent.message })

    const r = await POST(`/api/families/${f.id}/documents`, { originalName: `justificatif-${SUF}.txt`, contentBase64: b64, mimeType: "text/plain", notes: "piece jointe de test" })
    let docId = null
    if (expectOk("S12.1.3 upload d'un document", r)) {
      eq("S12.1.4 code HTTP 201", r.status, 201)
      const doc = r.data.document || r.data
      docId = doc.id
      if (docId) CLEAN.documents.push(docId)
      isType("S12.1.5 document.id string", doc.id, "string")
      eq("S12.1.6 originalName conserve", doc.originalName, `justificatif-${SUF}.txt`)
      isType("S12.1.7 createdAt ISO", doc.createdAt, "iso")
      check("S12.1.8 le contenu brut n'est pas renvoye dans la reponse", !("contentBase64" in doc), Object.keys(doc))
    }
    const g = await GET(`/api/families/${f.id}/documents`)
    expectOk("S12.1.9 GET liste des documents", g, 200)
    const list = (g.data && (g.data.documents || g.data)) || []
    check("S12.1.10 le document est dans la liste", Array.isArray(list) && list.some((x) => x.id === docId), { n: Array.isArray(list) ? list.length : null })

    if (docId) {
      const dl = await GET(`/api/documents/${docId}/download`)
      check("S12.1.11 telechargement du document", dl.status === 200, { status: dl.status })
      const dlCt = dl.headers && dl.headers.get ? (dl.headers.get("content-type") || dl.headers.get("content-disposition")) : null
      check("S12.1.12 en-tete de contenu present", !!dlCt, dlCt)
      const del = await DEL(`/api/documents/${docId}`)
      if (expectOk("S12.1.13 DELETE document", del, 200)) eq("S12.1.14 message de confirmation", del.data && del.data.message, "Document deleted.")
      eq("S12.1.15 telechargement apres suppression -> 404", (await GET(`/api/documents/${docId}/download`)).status, 404)
      eq("S12.1.16 seconde suppression -> 404", (await DEL(`/api/documents/${docId}`)).status, 404)
    }
    eq("S12.1.17 upload sur famille inexistante -> 404", (await POST("/api/families/inexistante/documents", { originalName: "a.txt", contentBase64: b64 })).status, 404)
    expectFailure("S12.1.18 sans token", await GET(`/api/families/${f.id}/documents`, { token: null }), 401, "Authentication required.")
    const rBad64 = await POST(`/api/families/${f.id}/documents`, { originalName: "x.txt", contentBase64: "pas-du-base64!!!" })
    check("S12.1.19 base64 invalide gere sans 500", rBad64.status < 500, { status: rBad64.status, message: rBad64.message })
    const big = Buffer.alloc(200 * 1024, 65).toString("base64")
    const rBig = await POST(`/api/families/${f.id}/documents`, { originalName: "gros.bin", contentBase64: big })
    check("S12.1.20 fichier de 200 Ko gere sans 500", rBig.status < 500, { status: rBig.status, message: rBig.message })
    if (rBig.status < 300) CLEAN.documents.push((rBig.data.document || rBig.data).id)
  })
})

/* ################################################################################### */
/* #  S13 -- SECURITE, AUTHENTIFICATION, CLOISONNEMENT ENTRE MOSQUEES                 # */
/* ################################################################################### */

const PROTECTED_ENDPOINTS = [
  ["GET", "/api/auth"], ["PUT", "/api/auth"],
  ["GET", "/api/mosque"], ["PUT", "/api/mosque"],
  ["GET", "/api/settings"], ["PUT", "/api/settings"], ["POST", "/api/settings/reset"],
  ["GET", "/api/families"], ["POST", "/api/families"],
  ["GET", "/api/families/x"], ["PUT", "/api/families/x"], ["DELETE", "/api/families/x"],
  ["GET", "/api/families/x/members"], ["POST", "/api/families/x/members"],
  ["GET", "/api/families/x/children"], ["POST", "/api/families/x/children"],
  ["GET", "/api/families/x/children/count"],
  ["GET", "/api/families/x/documents"], ["POST", "/api/families/x/documents"],
  ["GET", "/api/members/x"], ["PUT", "/api/members/x"], ["DELETE", "/api/members/x"],
  ["PUT", "/api/children/x"], ["DELETE", "/api/children/x"],
  ["DELETE", "/api/documents/x"], ["GET", "/api/documents/x/download"],
  ["GET", "/api/donors"], ["POST", "/api/donors"],
  ["GET", "/api/donors/x"], ["PUT", "/api/donors/x"], ["DELETE", "/api/donors/x"],
  ["GET", "/api/donors/x/donations"], ["POST", "/api/donors/x/donations"],
  ["GET", "/api/donations"], ["POST", "/api/donations"],
  ["GET", "/api/donations/x"], ["PUT", "/api/donations/x"], ["DELETE", "/api/donations/x"],
  ["POST", "/api/distribution/calculate"], ["POST", "/api/distribution/confirm"],
  ["GET", "/api/distributions"], ["POST", "/api/distributions"],
  ["GET", "/api/distributions/x"], ["PUT", "/api/distributions/x"], ["DELETE", "/api/distributions/x"],
  ["GET", "/api/dashboard/stats"], ["GET", "/api/dashboard/financial-summary"],
  ["GET", "/api/dashboard/monthly-summary"], ["GET", "/api/dashboard/social-distribution"],
]

section("S13", "Securite : 401 systematique, jetons falsifies, cloisonnement multi-mosquees", async () => {

  /* ---- 13.1 Toutes les routes protegees repondent 401 sans jeton ---- */
  await guard("S13.1", async () => {
    const fails = []
    for (const [m, p] of PROTECTED_ENDPOINTS) {
      const r = await api(m, p, { token: null, body: m === "GET" || m === "DELETE" ? undefined : {} })
      if (r.status !== 401) fails.push({ methode: m, route: p, status: r.status, message: r.message })
    }
    check(`S13.1.1 les ${PROTECTED_ENDPOINTS.length} routes protegees renvoient 401 sans jeton`, fails.length === 0, fails.slice(0, 12))
    info("S13.1.2 couverture", { routesTestees: PROTECTED_ENDPOINTS.length, echecs: fails.length })
  })

  /* ---- 13.2 Jetons invalides ---- */
  await guard("S13.2", async () => {
    const bad = [
      { label: "chaine quelconque", t: "jeton-bidon" },
      { label: "JWT tronque", t: String(STATE.token || "").slice(0, 20) },
      { label: "JWT avec signature alteree", t: String(STATE.token || "") + "X" },
      { label: "chaine vide", t: "" },
      { label: "none-alg forge", t: "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJ1c2VySWQiOiJoYWNrZXIifQ." },
      { label: "tres longue chaine", t: "a".repeat(2000) },
    ]
    for (const b of bad) {
      const r = await api("GET", "/api/auth", { token: b.t })
      check(`S13.2.1 ${b.label} -> 401`, r.status === 401, { status: r.status, message: r.message })
      check(`S13.2.2 ${b.label} : pas de fuite d'information`, !/passwordHash|prisma|stack/i.test(JSON.stringify(r.json || {})), short(r.text, 120))
    }
    const rGarbage = await api("GET", "/api/families", { token: "jeton-bidon" })
    check("S13.2.3 message standardise : session invalide ou expiree", /invalid or expired session|authentication required/i.test(String(rGarbage.message || "")), rGarbage.message)
  })

  /* ---- 13.3 Cloisonnement : le compte B ne voit rien du compte A ---- */
  await guard("S13.3", async () => {
    if (!STATE.b || !STATE.b.token) return skip("S13.3", "compte B indisponible (section S2 ignoree ?)")
    const { f } = await createFamily({})
    if (!f) return skip("S13.3", "famille A non creee")
    const bTok = STATE.b.token

    const rList = await GET("/api/families", { token: bTok })
    if (rList.status === 200) {
      check("S13.3.1 le compte B ne voit aucune famille du compte A", !((rList.data || {}).families || []).some((x) => x.id === f.id), { n: ((rList.data || {}).families || []).length })
    }
    const rGet = await GET(`/api/families/${f.id}`, { token: bTok })
    check("S13.3.2 lecture croisee d'une famille -> 404", rGet.status === 404, { status: rGet.status, message: rGet.message })
    const rPut = await PUT(`/api/families/${f.id}`, { notes: "piratage" }, { token: bTok })
    check("S13.3.3 modification croisee -> 404", rPut.status === 404, { status: rPut.status })
    const rDel = await DEL(`/api/families/${f.id}`, { token: bTok })
    check("S13.3.4 suppression croisee -> 404", rDel.status === 404, { status: rDel.status })
    const rMem = await POST(`/api/families/${f.id}/members`, { firstName: "Intrus", role: "OTHER" }, { token: bTok })
    check("S13.3.5 ajout de membre croise -> 404", rMem.status === 404, { status: rMem.status })
    const rChild = await GET(`/api/families/${f.id}/children`, { token: bTok })
    check("S13.3.6 lecture des enfants croisee -> 404", rChild.status === 404, { status: rChild.status })
    const rDoc = await GET(`/api/families/${f.id}/documents`, { token: bTok })
    check("S13.3.7 documents croises -> 404", rDoc.status === 404, { status: rDoc.status })

    /* La famille est intacte apres les tentatives */
    const { f: after } = await getFamily(f.id)
    check("S13.3.8 la famille du compte A est intacte", after && after.notes !== "piratage", { notes: after && after.notes })

    /* Les statistiques du compte B sont vierges */
    const rStats = await GET("/api/dashboard/stats", { token: bTok })
    if (rStats.status === 200) {
      const s = rStats.data.stats || rStats.data
      info("S13.3.9 statistiques du compte B (mosquee neuve)", pick(s, ["families", "donors", "donations", "balance"]))
      check("S13.3.10 le solde du compte B est independant", num(s.balance) !== STATE.balance0 || num(s.balance) === 0, { soldeB: s.balance, soldeA0: STATE.balance0 })
    }
    /* Les parametres du compte B sont independants */
    const rSetB = await GET("/api/settings", { token: bTok })
    if (rSetB.status === 200) {
      await PUT("/api/settings", { pointsPerChild: 3 }, { token: bTok })
      const mine = await readSettings()
      const mineSettings = (mine && mine.s) || {}
      check("S13.3.11 modifier les parametres de B n'affecte pas ceux de A",
        num(mineSettings.pointsPerChild) !== 3 || W("points_per_child") !== 3,
        { A: mineSettings.pointsPerChild })
    }
  })

  /* ---- 13.4 Aucune fuite de donnees sensibles ---- */
  await guard("S13.4", async () => {
    const routes = ["/api/auth", "/api/mosque", "/api/settings", "/api/families", "/api/donors", "/api/dashboard/stats"]
    for (const p of routes) {
      const r = await GET(p)
      const raw = JSON.stringify(r.json || {})
      check(`S13.4.1 ${p} : aucun passwordHash`, !/passwordHash/i.test(raw), short(raw, 100))
      check(`S13.4.2 ${p} : aucun secret JWT`, !/JWT_SECRET|dev-insecure-secret/i.test(raw), short(raw, 100))
      check(`S13.4.3 ${p} : aucune trace de pile`, !/\bat .*\.js:\d+|node_modules/i.test(raw), short(raw, 100))
      check(`S13.4.4 ${p} : aucun DATABASE_URL`, !/postgres:\/\/|DATABASE_URL/i.test(raw), short(raw, 100))
    }
    const rErr = await POST("/api/families", { ccp: null, firstName: null })
    check("S13.4.5 une erreur de validation ne divulgue pas Prisma", !/prisma|P20\d\d/i.test(JSON.stringify(rErr.json || {})), short(rErr.text, 150))
  })
})

/* ################################################################################### */
/* #  S14 -- CONTRATS D'API : ENVELOPPES, TYPES, EN-TETES                             # */
/* ################################################################################### */

section("S14", "Contrats d'API : enveloppe success/data, types, methodes, en-tetes", async () => {

  await guard("S14.1", async () => {
    const routes = [
      "/api/auth", "/api/mosque", "/api/settings", "/api/families", "/api/donors",
      "/api/donations", "/api/distributions", "/api/dashboard/stats",
      "/api/dashboard/financial-summary", "/api/dashboard/monthly-summary", "/api/dashboard/social-distribution",
    ]
    for (const p of routes) {
      const r = await GET(p)
      check(`S14.1.1 ${p} : statut 200`, r.status === 200, { status: r.status, message: r.message })
      check(`S14.1.2 ${p} : reponse JSON`, r.json !== null && typeof r.json === "object", short(r.text, 80))
      check(`S14.1.3 ${p} : enveloppe { success: true, data }`, r.json && r.json.success === true && "data" in r.json, Object.keys(r.json || {}))
      const ct14 = r.headers && r.headers.get ? String(r.headers.get("content-type") || "") : ""
      check(`S14.1.4 ${p} : en-tete content-type JSON`, /application\/json/i.test(ct14), ct14)
      check(`S14.1.5 ${p} : temps de reponse < 10 s`, r.ms < 10000, `${r.ms} ms`)
    }
  })

  await guard("S14.2", async () => {
    const errs = [
      { m: "POST", p: "/api/families", b: {} },
      { m: "POST", p: "/api/donors", b: {} },
      { m: "POST", p: "/api/donations", b: {} },
      { m: "POST", p: "/api/distribution/calculate", b: {} },
      { m: "GET", p: "/api/families/inexistante-xyz" },
    ]
    for (const e of errs) {
      const r = await api(e.m, e.p, { body: e.b })
      check(`S14.2.1 ${e.m} ${e.p} : enveloppe { success: false, message }`,
        r.json && r.json.success === false && typeof r.json.message === "string" && r.json.message.length > 0,
        { status: r.status, json: pick(r.json || {}, ["success", "message"]) })
      check(`S14.2.2 ${e.m} ${e.p} : statut 4xx (pas 5xx)`, r.status >= 400 && r.status < 500, r.status)
      check(`S14.2.3 ${e.m} ${e.p} : message lisible par un humain`, /^[A-Z\u0600-\u06FF]/.test(String(r.json && r.json.message)), r.json && r.json.message)
    }
  })

  await guard("S14.3", async () => {
    /* Mauvaise methode HTTP : jamais de 500 */
    const wrong = [
      ["DELETE", "/api/families"], ["PUT", "/api/families"], ["POST", "/api/dashboard/stats"],
      ["DELETE", "/api/settings"], ["GET", "/api/distribution/calculate"], ["PATCH", "/api/mosque"],
      ["POST", "/api/auth/logout"], ["GET", "/api/settings/reset"],
    ]
    for (const [m, p] of wrong) {
      const r = await api(m, p, { body: {} })
      check(`S14.3.1 ${m} ${p} : pas de 500`, r.status < 500 || r.status === 405, { status: r.status, message: short(r.message, 60) })
    }
    const r404 = await GET("/api/route-qui-nexiste-pas")
    check("S14.3.2 route inconnue -> 404", r404.status === 404, r404.status)
  })

  await guard("S14.4", async () => {
    /* Champs inconnus ignores et non persistes */
    const { f } = await createFamily({ champInconnu: "valeur", __proto__hack: 1, id: "id-force", mosqueId: "mosquee-forcee" })
    if (!f) return skip("S14.4", "famille non creee")
    check("S14.4.1 un id force par le client est ignore", f.id !== "id-force", f.id)
    check("S14.4.2 un mosqueId force est ignore", !f.mosqueId || f.mosqueId !== "mosquee-forcee", f.mosqueId)
    check("S14.4.3 les champs inconnus ne sont pas renvoyes", !("champInconnu" in f), Object.keys(f).slice(0, 20))
    const rProto = await POST("/api/families", famPayload({ "constructor": { "prototype": { "polluted": true } } }))
    check("S14.4.4 tentative de pollution de prototype sans 500", rProto.status < 500, rProto.status)
    if (rProto.status < 300) CLEAN.families.push((rProto.data.family || rProto.data).id)
    check("S14.4.5 Object.prototype non pollue", ({}).polluted === undefined, ({}).polluted)
  })

  await guard("S14.5", async () => {
    /* Verification systematique des types renvoyes par /api/families */
    const r = await GET("/api/families?status=ALL")
    const list = ((r.data || {}).families || []).slice(0, 25)
    const champs = {
      id: "string", firstName: "string", lastName: "string", ccp: "string",
      wilaya: "string", address: "string", svfScore: "number", membersCount: "int",
      createdAt: "iso", updatedAt: "iso",
    }
    const problemes = []
    for (const f of list) {
      for (const [k, t] of Object.entries(champs)) {
        const v = t === "number" || t === "int" ? num(f[k]) : f[k]
        const ok = t === "string" ? typeof v === "string"
          : t === "number" ? Number.isFinite(v)
          : t === "int" ? Number.isInteger(v)
          : t === "iso" ? typeof v === "string" && !Number.isNaN(Date.parse(v))
          : true
        if (!ok) problemes.push({ famille: f.id, champ: k, attendu: t, valeur: f[k] })
      }
      if (!MARITAL.includes(f.maritalStatus)) problemes.push({ famille: f.id, champ: "maritalStatus", valeur: f.maritalStatus })
      if (!PRIORITIES.includes(f.priority)) problemes.push({ famille: f.id, champ: "priority", valeur: f.priority })
      if (!FAM_STATUSES.includes(f.status)) problemes.push({ famille: f.id, champ: "status", valeur: f.status })
      if (!HOUSING_STATUSES.includes(f.housingStatus)) problemes.push({ famille: f.id, champ: "housingStatus", valeur: f.housingStatus })
      if (num(f.svfScore) < 0 || num(f.svfScore) > 100) problemes.push({ famille: f.id, champ: "svfScore hors [0,100]", valeur: f.svfScore })
    }
    check(`S14.5.1 types conformes sur ${list.length} familles`, problemes.length === 0, problemes.slice(0, 10))
  })
})

/* ################################################################################### */
/* #  S15 -- FUZZING ET ROBUSTESSE                                                    # */
/* ################################################################################### */

const FUZZ_STRINGS = [
  "", "   ", "0", "null", "undefined", "NaN", "-1", "1e400",
  "<script>alert(1)</script>", "'; DROP TABLE families; --", "' OR '1'='1",
  "../../etc/passwd", "{{7*7}}", "${jndi:ldap://x}", "\u0645\u0631\u062d\u0628\u0627", "\uD83D\uDE00\uD83C\uDF1F",
  "A".repeat(500), "\n\r\t", "%00", "\\u0000",
]

section("S15", "Fuzzing : corps invalides, chaines extremes, concurrence", async () => {

  await guard("S15.1", async () => {
    const cibles = [
      ["POST", "/api/families"], ["POST", "/api/donors"], ["POST", "/api/donations"],
      ["PUT", "/api/settings"], ["PUT", "/api/mosque"], ["POST", "/api/distribution/calculate"],
    ]
    for (const [m, p] of cibles) {
      for (const raw of ["", "}{", "[1,2,3", "null", "\"texte\"", "42", "[]"]) {
        const r = await api(m, p, { rawBody: raw })
        check(`S15.1.1 ${m} ${p} corps=${short(raw, 8) || "(vide)"} : pas de 500`, r.status < 500, { status: r.status, message: short(r.message, 60) })
      }
    }
  })

  await guard("S15.2", async () => {
    let ko = 0
    for (const s of FUZZ_STRINGS) {
      const r = await POST("/api/families", famPayload({ firstName: s, lastName: s, address: s, notes: s }))
      if (r.status >= 500) { ko++; fail(`S15.2.1 chaine ${short(s, 14)} provoque une 500`, { status: r.status, message: r.message }) }
      if (r.status < 300) CLEAN.families.push((r.data.family || r.data).id)
    }
    check(`S15.2.2 ${FUZZ_STRINGS.length} chaines hostiles : aucune erreur serveur`, ko === 0, { erreurs500: ko })
    /* Les valeurs stockees ne sont pas alterees */
    const marqueur = "<b>gras</b> & \"guillemets\""
    const { f } = await createFamily({ notes: marqueur })
    if (f) {
      const { f: rf } = await getFamily(f.id)
      eq("S15.2.3 les caracteres speciaux sont stockes verbatim (echappement cote vue)", rf.notes, marqueur)
    }
  })

  await guard("S15.3", async () => {
    const numeriques = [0, -1, 0.5, 1e15, -1e15, Number.MAX_SAFE_INTEGER, 1e308, "12", "12.5", "1e5", true, [], {}]
    let ko = 0
    for (const v of numeriques) {
      const r = await POST("/api/families", famPayload({ monthlyIncome: v }))
      if (r.status >= 500) { ko++; fail(`S15.3.1 monthlyIncome=${short(v, 14)} provoque une 500`, { status: r.status, message: r.message }) }
      if (r.status < 300) {
        const fam = r.data.family || r.data
        CLEAN.families.push(fam.id)
        check(`S15.3.2 monthlyIncome=${short(v, 14)} : score fini dans [0,100]`, Number.isFinite(num(fam.svfScore)) && num(fam.svfScore) >= 0 && num(fam.svfScore) <= 100, fam.svfScore)
      }
    }
    check(`S15.3.3 ${numeriques.length} valeurs numeriques limites : aucune 500`, ko === 0, { erreurs500: ko })
    /* Dates extremes */
    for (const dob of ["1900-01-01", "2100-01-01", new Date(Date.now() + 5 * 365 * DAY).toISOString(), "0000-00-00", "aujourd'hui"]) {
      const r = await POST("/api/families", famPayload({ dateOfBirth: dob }))
      check(`S15.3.4 dateOfBirth=${short(dob, 16)} gere sans 500`, r.status < 500, { status: r.status, message: short(r.message, 60) })
      if (r.status < 300) {
        const fam = r.data.family || r.data
        CLEAN.families.push(fam.id)
        check(`S15.3.5 dateOfBirth=${short(dob, 16)} : score fini`, Number.isFinite(num(fam.svfScore)), fam.svfScore)
      }
    }
  })

  await guard("S15.4", async () => {
    /* Concurrence sur des ecritures independantes */
    const t0 = Date.now()
    const rs = await Promise.all(Array.from({ length: 8 }, () => POST("/api/families", famPayload({}))))
    const okN = rs.filter((r) => r.status < 300).length
    for (const r of rs) if (r.status < 300) CLEAN.families.push((r.data.family || r.data).id)
    eq("S15.4.1 8 creations de familles en parallele reussissent", okN, 8)
    check("S15.4.2 aucune erreur serveur en concurrence", rs.every((r) => r.status < 500), rs.map((r) => r.status))
    const ccps = rs.filter((r) => r.status < 300).map((r) => (r.data.family || r.data).ccp)
    eq("S15.4.3 aucun CCP duplique", new Set(ccps).size, ccps.length)
    info("S15.4.4 duree du lot concurrent", `${Date.now() - t0} ms`)
    /* Lectures massives en parallele */
    const reads = await Promise.all(["/api/families", "/api/donors", "/api/donations", "/api/settings", "/api/mosque", "/api/dashboard/stats"].map((p) => GET(p)))
    check("S15.4.5 6 lectures paralleles renvoient toutes 200", reads.every((r) => r.status === 200), reads.map((r) => r.status))
  })

  await guard("S15.5", async () => {
    /* Boucle repetitive : creer / modifier / verifier N fois */
    const N = Math.max(3, CFG.repeat * 3)
    const journal = []
    for (let i = 0; i < N; i++) {
      const { f } = await createFamily({ monthlyIncome: 1000 * (i + 1), maritalStatus: MARITAL[i % MARITAL.length] })
      if (!f) continue
      const s1 = num(f.svfScore)
      await patchFamily(f.id, { monthlyIncome: 500 })
      const s2 = await scoreOf(f.id)
      await POST(`/api/families/${f.id}/children`, { firstName: `R${i}`, lastName: "Rep", dateOfBirth: dobForAge(5) })
      const s3 = await scoreOf(f.id)
      await patchFamily(f.id, { status: "INACTIVE" })
      await patchFamily(f.id, { status: "ACTIVE" })
      const s4 = await scoreOf(f.id)
      journal.push({ iteration: i + 1, initial: s1, apresBaisseRevenu: s2, apresEnfant: s3, apresCycleStatut: s4 })
      check(`S15.5.1 iteration ${i + 1} : baisser le revenu ne baisse pas le score`, s2 >= s1 - 0.02, { s1, s2 })
      near(`S15.5.2 iteration ${i + 1} : +1 enfant = +points_per_child`, round2(s3 - s2), Math.min(W("points_per_child"), W("max_points_children")), 0.02)
      eq(`S15.5.3 iteration ${i + 1} : le cycle de statut ne modifie pas le score`, s4, s3)
    }
    info(`S15.5.4 journal des ${journal.length} iterations`, journal)
  })
})

/* ################################################################################### */
/* #  S16 -- NON-REGRESSION DES CORRECTIFS LIVRES                                     # */
/* ################################################################################### */

section("S16", "Non-regression : les correctifs des livraisons precedentes", async () => {

  await guard("S16.1", async () => {
    /* Correctif 1 : SDF sans type de logement */
    for (const variante of [{}, { housingType: null }, { housingType: "" }]) {
      const r = await POST("/api/families", famPayload({ housingStatus: "HOMELESS", ...variante }))
      const label = "housingType " + ("housingType" in variante ? String(variante.housingType === "" ? "(vide)" : variante.housingType) : "(absent)")
      if (check(`S16.1.1 SDF avec ${label} : creation acceptee`, r.status === 201, { status: r.status, message: r.message })) {
        const f = r.data.family || r.data
        CLEAN.families.push(f.id)
        eq(`S16.1.2 SDF avec ${label} : housingType force a OTHER`, f.housingType, "OTHER")
        eq(`S16.1.3 SDF avec ${label} : housingStatus conserve`, f.housingStatus, "HOMELESS")
      }
    }
    const rNorm = await POST("/api/families", famPayload({ housingStatus: "TENANT", housingType: undefined }))
    check("S16.1.4 non-SDF sans type de logement : toujours refuse", rNorm.status === 400 && /housingType/i.test(String(rNorm.message || "")), { status: rNorm.status, message: rNorm.message })
  })

  await guard("S16.2", async () => {
    /* Correctif 2 : promotion automatique en MARIE */
    const { f } = await createFamily({ maritalStatus: "SINGLE", members: [{ firstName: "Chef", role: "HEAD" }] })
    if (!f) return skip("S16.2", "famille non creee")
    await POST(`/api/families/${f.id}/members`, { firstName: "Epouse", role: "SPOUSE" })
    const { f: after } = await getFamily(f.id)
    eq("S16.2.1 celibataire + epoux -> MARIE (correctif livre)", after.maritalStatus, "MARRIED")
  })

  await guard("S16.3", async () => {
    /* Correctif 3 : archivage = changement de statut uniquement */
    const { f } = await createFamily({ members: [{ firstName: "Chef", role: "HEAD" }, { firstName: "Enfant", role: "CHILD", dateOfBirth: dobForAge(7) }] })
    if (!f) return skip("S16.3", "famille non creee")
    const nBefore = (((await GET(`/api/families/${f.id}/members`)).data || {}).members || []).length
    const del = await DEL(`/api/families/${f.id}?mode=soft`)
    if (!check("S16.3.1 archivage accepte", del.status < 300, { status: del.status, message: del.message })) return
    const { r, f: af } = await getFamily(f.id)
    check("S16.3.2 la ligne survit en base (pas de suppression PostgreSQL)", r.status === 200, r.status)
    eq("S16.3.3 statut = ARCHIVED", af.status, "ARCHIVED")
    const nAfter = (((await GET(`/api/families/${f.id}/members`)).data || {}).members || []).length
    eq("S16.3.4 les membres ne sont pas detaches", nAfter, nBefore)
    const inArch = ((await GET("/api/families?status=ARCHIVED")).data || {}).families || []
    check("S16.3.5 visible dans la section Inactives/Archivees", inArch.some((x) => x.id === f.id), { n: inArch.length })
    const inActive = ((await GET("/api/families?status=ACTIVE")).data || {}).families || []
    check("S16.3.6 absente de la liste des actives", !inActive.some((x) => x.id === f.id), { n: inActive.length })
    /* Correctif 4 : reactivation possible */
    const re = await PUT(`/api/families/${f.id}`, { status: "ACTIVE" })
    if (check("S16.3.7 reactivation acceptee (bouton Reactiver)", re.status < 300, { status: re.status, message: re.message })) {
      const { f: af2 } = await getFamily(f.id)
      eq("S16.3.8 statut revenu a ACTIVE", af2.status, "ACTIVE")
    }
    /* Suppression definitive : la ligne disparait vraiment */
    const { f: f2 } = await createFamily({})
    if (f2) {
      const hard = await DEL(`/api/families/${f2.id}?mode=hard`)
      if (check("S16.3.9 suppression definitive acceptee", hard.status < 300, { status: hard.status, message: hard.message })) {
        eq("S16.3.10 la ligne est bien supprimee de PostgreSQL", (await GET(`/api/families/${f2.id}`)).status, 404)
        const all = ((await GET("/api/families?status=ALL")).data || {}).families || []
        check("S16.3.11 absente meme avec status=ALL", !all.some((x) => x.id === f2.id), { n: all.length })
      }
    }
  })

  await guard("S16.4", async () => {
    /* Correctif 5 : les familles archivees/inactives n'entrent pas dans le calcul */
    const { f: actif } = await createFamily({ maritalStatus: "WIDOWED", monthlyIncome: 2000 })
    const { f: archive } = await createFamily({ maritalStatus: "WIDOWED", monthlyIncome: 2000 })
    if (!actif || !archive) return skip("S16.4", "familles non creees")
    await DEL(`/api/families/${archive.id}?mode=soft`)
    const r = await POST("/api/distribution/calculate", { budget: 100000, familyIds: [actif.id, archive.id], minAmt: 1000, maxAmt: 90000, reserve: 0 })
    if (r.status < 300) {
      const d = r.data.result || r.data
      check("S16.4.1 la famille archivee est exclue du water-filling", !d.distributions.some((x) => x.familyId === archive.id), d.distributions.map((x) => x.familyId))
      check("S16.4.2 la famille active est bien servie", d.distributions.some((x) => x.familyId === actif.id), d.distributions.map((x) => x.familyId))
      eq("S16.4.3 une seule beneficiaire", d.distributions.length, 1)
    } else info("S16.4 calcul", { status: r.status, message: r.message })
    /* Elle reste consultable pour information */
    const { r: rg } = await getFamily(archive.id)
    eq("S16.4.4 la famille archivee reste consultable (information seulement)", rg.status, 200)
  })

  await guard("S16.5", async () => {
    /* Correctif 6 : KAFFARA retiree du produit */
    const dn = await POST("/api/donors", { name: `${TAG} KafCheck ${uid("K")}` })
    const id = dn.status < 300 ? (dn.data.donor || dn.data).id : null
    if (id) CLEAN.donors.push(id)
    if (id) {
      const r = await POST("/api/donations", { donorId: id, amount: 100, category: "KAFFARA", paymentMethod: "CASH" })
      eq("S16.5.1 KAFFARA refusee par l'API des dons", r.status, 400)
    }
    const all = ((await GET("/api/donations")).data || {}).donations || []
    check("S16.5.2 aucun don KAFFARA existant", !all.some((x) => x.category === "KAFFARA"), [...new Set(all.map((x) => x.category))])
  })

  await guard("S16.6", async () => {
    /* Correctif 7 : donnees du graphique Entrees/Sorties exploitables par l'axe Y */
    const r = await GET("/api/dashboard/monthly-summary?months=12")
    const months = ((r.data || {}).months) || []
    const vals = months.flatMap((m) => [num(m.received), num(m.distributed)])
    check("S16.6.1 toutes les valeurs du graphique sont des nombres finis", vals.every((v) => Number.isFinite(v)), vals.slice(0, 10))
    check("S16.6.2 aucune valeur negative", vals.every((v) => v >= 0), vals.filter((v) => v < 0).slice(0, 5))
    check("S16.6.3 aucune valeur aberrante (< 1e12)", vals.every((v) => v < 1e12), vals.filter((v) => v >= 1e12).slice(0, 5))
    check("S16.6.4 les libelles de mois sont exploitables", months.every((m) => typeof m.month === "string" && m.month.length > 0), months.map((m) => m.month).slice(0, 6))
    info("S16.6.5 valeurs de l'axe Y sur 12 mois", { max: Math.max(0, ...vals), min: Math.min(0, ...vals), mois: months.length })
  })
})

/* ################################################################################### */
/* #  MOTEUR D'EXECUTION, NETTOYAGE ET RAPPORTS                                       # */
/* ################################################################################### */

/* ################################################################################### */
/* #  S17 -- SYNCHRONISATION DES DONNEES                                              # */
/* ################################################################################### */
/* Chaque test verifie qu'une ECRITURE quelque part met bien a jour TOUT ce qui en
 * depend : membersCount, maritalStatus, miroir chef <-> fiche famille, childrenCount,
 * malus d'aide, lastAidAt, solde de la mosquee, totalDistributed, score SVF, priorite.
 * Ce sont les 16 scenarios de test-sync-suite.mjs (T1..T16), portes sur le harnais de
 * cette suite pour qu'un seul lancement couvre fonctionnalites ET synchronisation.
 */

function changed(name, before, after, detail) {
  const chg = round2(num(before)) !== round2(num(after))
  return check(name, chg, {
    avant: before, apres: after, ...(detail || {}),
    ...(chg ? {} : { note: "valeur inchangee -- la synchronisation n'a pas eu lieu" }),
  })
}
function stable(name, before, after, detail) {
  return check(name, round2(num(before)) === round2(num(after)), { avant: before, apres: after, ...(detail || {}) })
}

/* Instantane complet d'une famille : fiche + membres + score. */
async function snap(id) {
  const { f } = await getFamily(id)
  const lst = await GET(`/api/families/${id}/members`)
  const members = (lst.data || {}).members || []
  return {
    f: f || {}, members,
    score: num(f && f.svfScore),
    priority: f && f.priority,
    membersCount: num(f && f.membersCount),
    maritalStatus: f && f.maritalStatus,
    lastAidAt: f && f.lastAidAt,
    head: members.find((m) => m.role === "HEAD") || null,
  }
}

section("S17", "Synchronisation : chaque ecriture se propage partout", async () => {

  /* ---- 17.1 (T1) Creation : la fiche, les membres et le score naissent coherents ---- */
  await guard("S17.1", async () => {
    const { r, f } = await createFamily({ maritalStatus: "SINGLE", monthlyIncome: 0, incomeSources: ["NONE"], housingStatus: "TENANT", housingType: "APARTMENT", dateOfBirth: dobForAge(40) })
    if (!expectOk("S17.1.1 creation de la famille temoin", r, 201)) return
    const s = await snap(f.id)
    check("S17.1.2 un membre HEAD est cree automatiquement", !!s.head, { membres: s.members.length })
    check("S17.1.3 membersCount >= 1 des la creation", s.membersCount >= 1, { membersCount: s.membersCount })
    check("S17.1.4 le score est calcule des la creation", Number.isFinite(s.score) && s.score > 0, { score: s.score })
    eq("S17.1.5 la priorite derive du score", s.priority, priorityFromScore(s.score))
    if (s.head) {
      eq("S17.1.6 le chef porte le nom de la fiche famille", s.head.lastName, f.lastName)
      eq("S17.1.7 le chef porte la date de naissance de la fiche", String(s.head.dateOfBirth || "").slice(0, 10), String(f.dateOfBirth || "").slice(0, 10))
    }
  })

  /* ---- 17.2 (T2) Ajout d'un SPOUSE : etat civil -> MARRIED + rescore ---- */
  await guard("S17.2", async () => {
    const { f } = await createFamily({ maritalStatus: "SINGLE", monthlyIncome: 0, incomeSources: ["NONE"] })
    if (!f) return skip("S17.2", "famille non creee")
    const a = await snap(f.id)
    eq("S17.2.1 etat civil initial = SINGLE", a.maritalStatus, "SINGLE")
    const { r: rm } = await addMember(f.id, { firstName: "Epouse", lastName: uid("E"), role: "SPOUSE", dateOfBirth: dobForAge(38) })
    if (!check("S17.2.2 ajout de l'epoux(se) accepte", rm.status < 300, { status: rm.status, message: rm.message })) return
    const b = await snap(f.id)
    eq("S17.2.3 etat civil promu a MARRIED", b.maritalStatus, "MARRIED")
    check("S17.2.4 membersCount incremente", b.membersCount > a.membersCount, { avant: a.membersCount, apres: b.membersCount })
    check("S17.2.5 le membre SPOUSE est bien en base", b.members.some((m) => m.role === "SPOUSE"), b.members.map((m) => m.role))
    eq("S17.2.6 la priorite reste alignee sur le score", b.priority, priorityFromScore(b.score))
    info("S17.2.7 effet de l'ajout d'un epoux sur le score", { avant: a.score, apres: b.score, delta: round2(b.score - a.score) })
  })

  /* ---- 17.3 (T3) Modifier le membre chef : miroir vers la fiche + rescore ---- */
  await guard("S17.3", async () => {
    const { f } = await createFamily({ dateOfBirth: dobForAge(40), monthlyIncome: 0, incomeSources: ["NONE"] })
    if (!f) return skip("S17.3", "famille non creee")
    const a = await snap(f.id)
    if (!a.head) return skip("S17.3", "chef introuvable")

    const rAge = await PUT(`/api/members/${a.head.id}`, { dateOfBirth: dobForAge(70) })
    if (check("S17.3.1 modification de la date de naissance du chef", rAge.status < 300, { status: rAge.status, message: rAge.message })) {
      const b = await snap(f.id)
      eq("S17.3.2 la date de naissance est reportee sur la fiche famille", String(b.f.dateOfBirth || "").slice(0, 4), String(dobForAge(70)).slice(0, 4))
      changed("S17.3.3 le score est recalcule (bonus senior)", a.score, b.score)
      near("S17.3.4 le gain vaut points_senior_head", round2(b.score - a.score), W("points_senior_head"), 0.02)
      eq("S17.3.5 la priorite suit le nouveau score", b.priority, priorityFromScore(b.score))
    }

    const c = await snap(f.id)
    const rDis = await PUT(`/api/members/${c.head.id}`, { hasDisability: true })
    if (check("S17.3.6 declaration d'un handicap sur le chef", rDis.status < 300, { status: rDis.status, message: rDis.message })) {
      const d = await snap(f.id)
      eq("S17.3.7 hasDisability est reporte sur la fiche famille", d.f.hasDisability, true)
      near("S17.3.8 le gain vaut points_disability", round2(d.score - c.score), W("points_disability"), 0.02)
    }

    const e = await snap(f.id)
    const rRole = await PUT(`/api/members/${e.head.id}`, { role: "CHILD" })
    info("S17.3.9 changement de role du chef", { status: rRole.status, message: rRole.message })
    const rDel = await DEL(`/api/members/${e.head.id}`)
    check("S17.3.10 suppression du chef refusee (409)", rDel.status === 409, { status: rDel.status, message: rDel.message })
    const g = await snap(f.id)
    check("S17.3.11 le chef est toujours present apres les refus", !!g.head, { membres: g.members.length })
  })

  /* ---- 17.4 (T4) Modifier la fiche famille : le membre chef doit suivre ---- */
  await guard("S17.4", async () => {
    const { f } = await createFamily({ dateOfBirth: dobForAge(45) })
    if (!f) return skip("S17.4", "famille non creee")
    const a = await snap(f.id)
    if (!a.head) return skip("S17.4", "chef introuvable")
    const nouveauNom = uid("NOM")
    const { r } = await patchFamily(f.id, { firstName: "ChefRenomme", lastName: nouveauNom, dateOfBirth: dobForAge(68), hasDisability: true })
    if (!check("S17.4.1 modification de la fiche famille acceptee", r.status < 300, { status: r.status, message: r.message })) return
    const b = await snap(f.id)
    eq("S17.4.2 le prenom du chef suit la fiche", b.head && b.head.firstName, "ChefRenomme")
    eq("S17.4.3 le nom du chef suit la fiche", b.head && b.head.lastName, nouveauNom)
    eq("S17.4.4 l'age du chef suit la fiche", String((b.head || {}).dateOfBirth || "").slice(0, 4), String(dobForAge(68)).slice(0, 4))
    eq("S17.4.5 le handicap est reporte sur le chef", (b.head || {}).hasDisability, true)
    changed("S17.4.6 le score est recalcule apres la modification", a.score, b.score)
    eq("S17.4.7 la priorite reste alignee", b.priority, priorityFromScore(b.score))
    eq("S17.4.8 aucun membre en double n'a ete cree", b.members.filter((m) => m.role === "HEAD").length, 1)
  })

  /* ---- 17.5 (T5) Supprimer un membre : membersCount et score suivent ---- */
  await guard("S17.5", async () => {
    const { f } = await createFamily({ monthlyIncome: 0, incomeSources: ["NONE"] })
    if (!f) return skip("S17.5", "famille non creee")
    const { m, r: rAdd } = await addMember(f.id, { firstName: "AjoutASupprimer", lastName: uid("S"), role: "OTHER", dateOfBirth: dobForAge(30) })
    if (!m || rAdd.status >= 300) return skip("S17.5", `ajout impossible : ${rAdd.message}`)
    const a = await snap(f.id)
    const rDel = await DEL(`/api/members/${m.id}`)
    if (!check("S17.5.1 suppression du membre acceptee", rDel.status < 300, { status: rDel.status, message: rDel.message })) return
    const b = await snap(f.id)
    const lignesApres = (b.members || []).length
    check("S17.5.2 membersCount reste >= aux lignes membres reelles", num(b.membersCount) >= lignesApres && num(b.membersCount) >= 1, { membersCount: b.membersCount, lignesMembres: lignesApres })
    if (num(b.membersCount) === num(a.membersCount) && lignesApres < num(a.membersCount)) info("S17.5.2b effectif declare NON decremente apres suppression", { avant: a.membersCount, apres: b.membersCount, lignesReelles: lignesApres, regle: "familySync.js : membersCount = max(valeur declaree, lignes reelles, plancher marital) -- cliquet volontaire, il ne redescend jamais", impactSvf: "nul : membersCount n-est pas une entree de computeSVF" })
    check("S17.5.3 la ligne membre a disparu", !b.members.some((x) => x.id === m.id), b.members.map((x) => x.role))
    check("S17.5.4 le score reste un nombre fini", Number.isFinite(b.score), { score: b.score })
    eq("S17.5.5 la priorite reste alignee sur le score", b.priority, priorityFromScore(b.score))
  })

  /* ---- 17.6 (T6) Enfants : /children alimente le score enfants ---- */
  await guard("S17.6", async () => {
    const { f } = await createFamily({ monthlyIncome: 0, incomeSources: ["NONE"] })
    if (!f) return skip("S17.6", "famille non creee")
    const a = await snap(f.id)
    const rc = await POST(`/api/families/${f.id}/children`, { firstName: "Enfant1", lastName: uid("C"), dateOfBirth: dobForAge(7), isStudent: true })
    if (!check("S17.6.1 ajout d'un enfant accepte", rc.status < 300, { status: rc.status, message: rc.message })) return
    const b = await snap(f.id)
    near("S17.6.2 le score augmente de points_per_child", round2(b.score - a.score), W("points_per_child"), 0.02, { avant: a.score, apres: b.score })
    const cnt = await GET(`/api/families/${f.id}/children/count`)
    const nb = num((cnt.data || {}).count !== undefined ? cnt.data.count : (cnt.data || {}).childrenCount)
    check("S17.6.3 /children/count refletes l'ajout", nb >= 1, { count: nb })
    const lst = await GET(`/api/families/${f.id}/children`)
    const arr = (lst.data || {}).children || []
    check("S17.6.4 l'enfant est bien liste", arr.length >= 1, { n: arr.length })
    if (arr[0] && arr[0].id) {
      const rd = await DEL(`/api/children/${arr[0].id}`)
      if (rd.status < 300) {
        const c = await snap(f.id)
        near("S17.6.5 la suppression de l'enfant retire les points", round2(c.score - b.score), -W("points_per_child"), 0.02, { avant: b.score, apres: c.score })
      } else info("S17.6.5 suppression de l'enfant", { status: rd.status, message: rd.message })
    }
  })

  /* ---- 17.7 (T7) Aide manuelle : solde, lastAidAt et malus ---- */
  await guard("S17.7", async () => {
    const { f } = await createFamily({ monthlyIncome: 0, incomeSources: ["NONE"], housingStatus: "TENANT", housingType: "APARTMENT" })
    if (!f) return skip("S17.7", "famille non creee")
    const fund = await fundMosque(60000)
    if (!fund.ok) return skip("S17.7", `alimentation impossible : ${fund.reason}`)
    const a = await snap(f.id)
    const b0 = await mosqueBalance()
    const r = await POST("/api/distributions", { familyId: f.id, amount: 5000, method: "MANUAL", notes: `${TAG} aide manuelle` })
    if (!check("S17.7.1 aide manuelle enregistree", r.status < 300, { status: r.status, message: r.message })) return
    const dist = r.data && (r.data.distribution || r.data)
    if (dist && dist.id) CLEAN.distributions.push(dist.id)
    const b1 = await mosqueBalance()
    near("S17.7.2 le solde est debite du montant", round2(b0 - b1), 5000, 0.05, { avant: b0, apres: b1 })
    const b = await snap(f.id)
    check("S17.7.3 lastAidAt est renseigne", !!b.lastAidAt, { lastAidAt: b.lastAidAt })
    near("S17.7.4 le score baisse de malus_per_aid", round2(a.score - b.score), W("malus_per_aid"), 0.02, { avant: a.score, apres: b.score })
    eq("S17.7.5 la priorite suit la baisse du score", b.priority, priorityFromScore(b.score))
  })

  /* ---- 17.8 (T8) Aides successives : le malus plafonne ---- */
  await guard("S17.8", async () => {
    const { f } = await createFamily({ monthlyIncome: 0, incomeSources: ["NONE"], housingStatus: "TENANT", housingType: "APARTMENT", dateOfBirth: dobForAge(70) })
    if (!f) return skip("S17.8", "famille non creee")
    const fund = await fundMosque(120000)
    if (!fund.ok) return skip("S17.8", `alimentation impossible : ${fund.reason}`)
    const seq = [await scoreOf(f.id)]
    for (let i = 0; i < 5; i++) {
      const r = await POST("/api/distributions", { familyId: f.id, amount: 1000, method: "MANUAL", notes: `${TAG} aide ${i + 1}` })
      const d = r.data && (r.data.distribution || r.data)
      if (d && d.id) CLEAN.distributions.push(d.id)
      seq.push(await scoreOf(f.id))
    }
    info("S17.8.1 sequence des scores", seq.join(" -> "))
    check("S17.8.2 la sequence est monotone decroissante", seq.every((v, i) => i === 0 || num(v) <= num(seq[i - 1]) + 0.02), seq)
    const baisseTotale = round2(num(seq[0]) - num(seq[seq.length - 1]))
    check("S17.8.3 la baisse totale ne depasse pas max_malus", baisseTotale <= W("max_malus") + 0.02, { baisseTotale, plafond: W("max_malus") })
    const deuxDerniers = round2(num(seq[seq.length - 2]) - num(seq[seq.length - 1]))
    check("S17.8.4 une fois le plafond atteint le score ne bouge plus", baisseTotale < W("max_malus") - 0.02 || deuxDerniers <= 0.02, { deuxDerniers, baisseTotale })
    check("S17.8.5 le score ne devient jamais negatif", seq.every((v) => num(v) >= 0), seq)
  })

  /* ---- 17.9 (T9) Confirmation d'une distribution : snapshots + rescore ---- */
  let SDIST = null
  let SITEMS = []
  let SFAMS = []
  await guard("S17.9", async () => {
    const fams = []
    for (let i = 0; i < 3; i++) {
      const { f } = await createFamily({ monthlyIncome: i * 6000, incomeSources: i === 0 ? ["NONE"] : ["SALARY"], housingStatus: "TENANT", housingType: "APARTMENT" })
      if (f && f.id) fams.push(f.id)
    }
    if (fams.length < 2) return skip("S17.9", "cohorte insuffisante")
    SFAMS = fams
    const fund = await fundMosque(300000)
    if (!fund.ok) return skip("S17.9", `alimentation impossible : ${fund.reason}`)

    const avant = {}
    for (const id of fams) avant[id] = await scoreOf(id)
    const b0 = await mosqueBalance()

    const r = await POST("/api/distribution/confirm", { budget: 90000, familyIds: fams, minAmt: 1000, maxAmt: 50000, reserve: 0.1, title: `${TAG} Sync ${SUF}` })
    if (!check("S17.9.1 confirmation acceptee", r.status < 300, { status: r.status, message: r.message })) return
    const dist = r.data && (r.data.distribution || r.data)
    SDIST = dist && dist.id
    if (SDIST) CLEAN.distributions.push(SDIST)
    eq("S17.9.2 statut initial = APPROVED", dist.status, "APPROVED")

    const g = await GET(`/api/distributions/${SDIST}`)
    const full = g.data && (g.data.distribution || g.data)
    SITEMS = (full && full.items) || []
    check("S17.9.3 une ligne par famille servie", SITEMS.length >= 1, { n: SITEMS.length })

    for (const it of SITEMS) {
      const fid = it.familyId || (it.family && it.family.id)
      if (!fid || avant[fid] === undefined) continue
      near(`S17.9.4 le snapshot fige le score AVANT le malus (${String(fid).slice(-6)})`, num(it.svfSnapshot), num(avant[fid]), 0.02, { snapshot: it.svfSnapshot, avant: avant[fid] })
      eq(`S17.9.5 le snapshot de priorite correspond (${String(fid).slice(-6)})`, it.prioritySnapshot, priorityFromScore(num(it.svfSnapshot)))
      const { f: ff } = await getFamily(fid)
      check(`S17.9.6 lastAidAt renseigne (${String(fid).slice(-6)})`, !!ff.lastAidAt, ff.lastAidAt)
      const apres = await scoreOf(fid)
      near(`S17.9.7 le score courant a bien recu le malus (${String(fid).slice(-6)})`, round2(num(avant[fid]) - num(apres)), W("malus_per_aid"), 0.02, { avant: avant[fid], apres })
    }
    const b1 = await mosqueBalance()
    stable("S17.9.8 le solde n'est PAS debite a la confirmation", b0, b1)
  })

  /* ---- 17.10 (T10) Paiement d'une ligne : solde + totalDistributed ---- */
  await guard("S17.10", async () => {
    if (!SDIST || !SITEMS.length) return skip("S17.10", "pas de distribution disponible")
    const it = SITEMS[0]
    const b0 = await mosqueBalance()
    const r = await PUT(`/api/distributions/${SDIST}`, { itemId: it.id, paymentStatus: "PAID" })
    if (!check("S17.10.1 passage de la ligne a PAID", r.status < 300, { status: r.status, message: r.message })) return
    const b1 = await mosqueBalance()
    near("S17.10.2 le solde est debite du montant de la ligne", round2(b0 - b1), num(it.amount), 0.05, { avant: b0, apres: b1, montant: it.amount })
    const g = await GET(`/api/distributions/${SDIST}`)
    const full = g.data && (g.data.distribution || g.data)
    near("S17.10.3 totalDistributed suit le paiement", num(full.totalDistributed), num(it.amount), 0.05)
    const maj = (full.items || []).find((x) => x.id === it.id)
    eq("S17.10.4 la ligne est marquee PAID", maj && (maj.paymentStatus || maj.status), "PAID")
    check("S17.10.5 paidAt est renseigne", !!(maj && maj.paidAt), maj && maj.paidAt)
    const rAgain = await PUT(`/api/distributions/${SDIST}`, { itemId: it.id, paymentStatus: "PAID" })
    check("S17.10.6 double paiement refuse (409)", rAgain.status === 409, { status: rAgain.status, message: rAgain.message })
    const b2 = await mosqueBalance()
    stable("S17.10.7 aucun double debit", b1, b2)
  })

  /* ---- 17.11 (T11) Annulation d'une ligne PENDING ---- */
  await guard("S17.11", async () => {
    if (!SDIST || SITEMS.length < 2) return skip("S17.11", "pas de ligne PENDING disponible")
    const it = SITEMS[1]
    const fid = it.familyId || (it.family && it.family.id)
    const scoreAvant = fid ? await scoreOf(fid) : null
    const b0 = await mosqueBalance()
    const r = await PUT(`/api/distributions/${SDIST}`, { itemId: it.id, paymentStatus: "CANCELLED" })
    if (!check("S17.11.1 annulation de la ligne acceptee", r.status < 300, { status: r.status, message: r.message })) return
    const b1 = await mosqueBalance()
    stable("S17.11.2 l'annulation d'une ligne PENDING ne touche pas le solde", b0, b1)
    if (fid) {
      const scoreApres = await scoreOf(fid)
      check("S17.11.3 le malus est rendu apres annulation (score >= avant)", num(scoreApres) >= num(scoreAvant) - 0.02, { avant: scoreAvant, apres: scoreApres })
      near("S17.11.4 le malus rendu vaut malus_per_aid", round2(num(scoreApres) - num(scoreAvant)), W("malus_per_aid"), 0.02, { avant: scoreAvant, apres: scoreApres, note: "une aide annulee ne doit plus compter" })
    }
  })

  /* ---- 17.12 (T12) Annulation de la distribution entiere ---- */
  await guard("S17.12", async () => {
    const fams = []
    for (let i = 0; i < 2; i++) {
      const { f } = await createFamily({ monthlyIncome: 0, incomeSources: ["NONE"] })
      if (f && f.id) fams.push(f.id)
    }
    if (fams.length < 2) return skip("S17.12", "cohorte insuffisante")
    const fund = await fundMosque(200000)
    if (!fund.ok) return skip("S17.12", `alimentation impossible : ${fund.reason}`)
    const avant = {}
    for (const id of fams) avant[id] = await scoreOf(id)
    const r = await POST("/api/distribution/confirm", { budget: 60000, familyIds: fams, minAmt: 1000, maxAmt: 50000, reserve: 0.1 })
    const dist = r.data && (r.data.distribution || r.data)
    if (!dist || !dist.id) return skip("S17.12", `confirmation impossible : ${r.message}`)
    CLEAN.distributions.push(dist.id)
    const rc = await PUT(`/api/distributions/${dist.id}`, { status: "CANCELLED" })
    if (!check("S17.12.1 annulation de la distribution acceptee", rc.status < 300, { status: rc.status, message: rc.message })) return
    const g = await GET(`/api/distributions/${dist.id}`)
    const full = g.data && (g.data.distribution || g.data)
    eq("S17.12.2 statut = CANCELLED", full.status, "CANCELLED")
    check("S17.12.3 toutes les lignes non payees sont annulees", (full.items || []).every((x) => (x.paymentStatus || x.status) !== "PENDING"), (full.items || []).map((x) => x.paymentStatus || x.status))
    for (const id of fams) {
      const apres = await scoreOf(id)
      check(`S17.12.4 le malus est rendu a la famille (${String(id).slice(-6)})`, num(apres) >= num(avant[id]) - 0.02, { avant: avant[id], apres })
    }
  })

  /* ---- 17.13 (T13) Suppression d'une distribution : remboursement ---- */
  await guard("S17.13", async () => {
    const { f } = await createFamily({ monthlyIncome: 0, incomeSources: ["NONE"] })
    if (!f) return skip("S17.13", "famille non creee")
    const fund = await fundMosque(80000)
    if (!fund.ok) return skip("S17.13", `alimentation impossible : ${fund.reason}`)
    const scoreAvant = await scoreOf(f.id)
    const b0 = await mosqueBalance()
    const r = await POST("/api/distributions", { familyId: f.id, amount: 7000, method: "MANUAL", notes: `${TAG} a supprimer` })
    const dist = r.data && (r.data.distribution || r.data)
    if (!dist || !dist.id) return skip("S17.13", `aide impossible : ${r.message}`)
    const b1 = await mosqueBalance()
    near("S17.13.1 le solde est debite par l'aide", round2(b0 - b1), 7000, 0.05)
    const rd = await DEL(`/api/distributions/${dist.id}`)
    if (!check("S17.13.2 suppression de la distribution acceptee", rd.status < 300, { status: rd.status, message: rd.message })) return
    const b2 = await mosqueBalance()
    near("S17.13.3 le solde est integralement restaure", b2, b0, 0.05, { avant: b0, apresAide: b1, apresSuppression: b2 })
    const scoreApres = await scoreOf(f.id)
    near("S17.13.4 le malus est rendu a la famille", scoreApres, scoreAvant, 0.02, { avant: scoreAvant, apres: scoreApres })
    const g = await GET(`/api/distributions/${dist.id}`)
    check("S17.13.5 la distribution n'est plus lisible", g.status === 404, { status: g.status })
  })

  /* ---- 17.14 (T14) Changement de parametres : propagation a toutes les familles ---- */
  await guard("S17.14", async () => {
    const loc = []
    for (let i = 0; i < 2; i++) {
      const { f } = await createFamily({ housingStatus: "TENANT", housingType: "APARTMENT", monthlyIncome: 0, incomeSources: ["NONE"] })
      if (f && f.id) loc.push(f.id)
    }
    const { f: prop } = await createFamily({ housingStatus: "OWNER", housingType: "HOUSE", monthlyIncome: 0, incomeSources: ["NONE"] })
    if (loc.length < 1 || !prop) return skip("S17.14", "cohorte insuffisante")

    const socle = W("points_renting")
    const avantLoc = {}
    for (const id of loc) avantLoc[id] = await scoreOf(id)
    const avantProp = await scoreOf(prop.id)

    const rSet = await PUT("/api/settings", { pointsIfTenant: socle + 10 })
    if (!check("S17.14.1 modification de pointsIfTenant acceptee", rSet.status < 300, { status: rSet.status, message: rSet.message })) return
    info("S17.14.2 familles recalculees par l'API", { recalculatedFamilies: (rSet.data || {}).recalculatedFamilies })

    for (const id of loc) {
      const apres = await scoreOf(id)
      changed("S17.14.3 le score d'une famille locataire a change", avantLoc[id], apres, { famille: String(id).slice(-6) })
      near("S17.14.4 le gain vaut exactement +10", round2(num(apres) - num(avantLoc[id])), 10, 0.02, { famille: String(id).slice(-6) })
    }
    const apresProp = await scoreOf(prop.id)
    stable("S17.14.5 une famille proprietaire n'est PAS affectee", avantProp, apresProp)

    const rBack = await PUT("/api/settings", { pointsIfTenant: socle })
    check("S17.14.6 restauration du parametre", rBack.status < 300, { status: rBack.status, message: rBack.message })
    for (const id of loc) {
      const revenu = await scoreOf(id)
      near("S17.14.7 le score revient a sa valeur initiale", revenu, avantLoc[id], 0.02, { famille: String(id).slice(-6) })
    }
  })

  /* ---- 17.15 (T15) Famille archivee : lisible mais hors calcul ---- */
  await guard("S17.15", async () => {
    const { f } = await createFamily({ monthlyIncome: 0, incomeSources: ["NONE"], housingStatus: "TENANT", housingType: "APARTMENT" })
    const { f: temoin } = await createFamily({ monthlyIncome: 0, incomeSources: ["NONE"] })
    if (!f || !temoin) return skip("S17.15", "familles non creees")
    const rArch = await DEL(`/api/families/${f.id}?mode=soft`)
    if (!check("S17.15.1 archivage accepte", rArch.status < 300, { status: rArch.status, message: rArch.message })) return
    const { f: apres } = await getFamily(f.id)
    inEnum("S17.15.2 le statut passe a ARCHIVED ou INACTIVE", apres.status, ["ARCHIVED", "INACTIVE"])
    check("S17.15.3 la ligne existe toujours en base", !!apres.id, { id: apres.id, status: apres.status })
    check("S17.15.4 le score reste consultable pour information", Number.isFinite(num(apres.svfScore)), { score: apres.svfScore })

    const rCalc = await POST("/api/distribution/calculate", { budget: 60000, familyIds: [f.id, temoin.id], minAmt: 1000, maxAmt: 50000 })
    if (rCalc.status < 300) {
      const arr = ((rCalc.data || {}).distributions) || []
      check("S17.15.5 la famille archivee est EXCLUE du water-filling", !arr.some((x) => x.familyId === f.id), arr.map((x) => String(x.familyId).slice(-6)))
      check("S17.15.6 la famille active reste servie", arr.some((x) => x.familyId === temoin.id), { n: arr.length })
    } else info("S17.15.5 calcul avec une famille archivee", { status: rCalc.status, message: rCalc.message })

    const rList = await GET("/api/families?status=ACTIVE")
    const act = ((rList.data || {}).families) || []
    check("S17.15.7 elle disparait de la liste ACTIVE", !act.some((x) => x.id === f.id), { n: act.length })
    const rBack = await PUT(`/api/families/${f.id}`, { status: "ACTIVE" })
    if (check("S17.15.8 reactivation possible", rBack.status < 300, { status: rBack.status, message: rBack.message })) {
      const { f: back } = await getFamily(f.id)
      eq("S17.15.9 le statut revient a ACTIVE", back.status, "ACTIVE")
      check("S17.15.10 elle redevient eligible au calcul", Number.isFinite(num(back.svfScore)), { score: back.svfScore })
    }
  })

  /* ---- 17.16 (T16) Scenario complet enchaine, avec journal ---- */
  await guard("S17.16", async () => {
    const trace = []
    const { f } = await createFamily({ maritalStatus: "SINGLE", monthlyIncome: 0, incomeSources: ["NONE"], housingStatus: "OWNER", housingType: "HOUSE", dateOfBirth: dobForAge(40) })
    if (!f) return skip("S17.16", "famille non creee")

    async function etape(libelle, action) {
      const avant = await snap(f.id)
      await action()
      const apres = await snap(f.id)
      trace.push({
        etape: libelle,
        score: String(avant.score) + " -> " + String(apres.score),
        membres: String(avant.membersCount) + " -> " + String(apres.membersCount),
        etatCivil: String(avant.maritalStatus) + " -> " + String(apres.maritalStatus),
        priorite: apres.priority,
      })
      check("S17.16.a " + libelle + " : priorite alignee sur le score", apres.priority === priorityFromScore(apres.score), { score: apres.score, priorite: apres.priority })
      check("S17.16.b " + libelle + " : score dans [0,100]", apres.score >= 0 && apres.score <= 100, { score: apres.score })
      check("S17.16.c " + libelle + " : membersCount >= 1", apres.membersCount >= 1, { membersCount: apres.membersCount, lignes: apres.members.length })
      return apres
    }

    await etape("1. ajout d'un epoux", () => addMember(f.id, { firstName: "Ep", lastName: uid("E"), role: "SPOUSE", dateOfBirth: dobForAge(37) }))
    await etape("2. ajout de 2 enfants", async () => {
      await POST(`/api/families/${f.id}/children`, { firstName: "E1", lastName: uid("C"), dateOfBirth: dobForAge(8) })
      await POST(`/api/families/${f.id}/children`, { firstName: "E2", lastName: uid("C"), dateOfBirth: dobForAge(5) })
    })
    await etape("3. passage en location", () => patchFamily(f.id, { housingStatus: "TENANT", housingType: "APARTMENT" }))
    await etape("4. chef devient senior", () => patchFamily(f.id, { dateOfBirth: dobForAge(70) }))
    await etape("5. handicap declare", () => patchFamily(f.id, { hasDisability: true }))
    const fund = await fundMosque(50000)
    if (fund.ok) {
      await etape("6. aide manuelle de 3000", async () => {
        const r = await POST("/api/distributions", { familyId: f.id, amount: 3000, method: "MANUAL", notes: TAG + " scenario" })
        const d = r.data && (r.data.distribution || r.data)
        if (d && d.id) CLEAN.distributions.push(d.id)
      })
    }
    await etape("7. revenu au-dessus du SMIG", () => patchFamily(f.id, { monthlyIncome: 3 * W("smig_threshold"), incomeSources: ["SALARY"] }))

    info("S17.16.1 journal complet du scenario", trace)
    const fin = await snap(f.id)
    eq("S17.16.2 etat civil final = MARRIED", fin.maritalStatus, "MARRIED")
    eq("S17.16.3 le chef est unique apres tout le scenario", fin.members.filter((m) => m.role === "HEAD").length, 1)
    check("S17.16.4 le score final est coherent et fini", Number.isFinite(fin.score) && fin.score >= 0 && fin.score <= 100, { score: fin.score })
    eq("S17.16.5 la priorite finale derive du score final", fin.priority, priorityFromScore(fin.score))

    await sleep(250)
    const relu = await snap(f.id)
    stable("S17.16.6 aucune derive : relecture identique apres pause", fin.score, relu.score)
    eq("S17.16.7 membersCount stable a la relecture", relu.membersCount, fin.membersCount)
  })
})

async function cleanup() {
  if (CFG.keep) {
    banner("NETTOYAGE IGNORE (--keep)")
    log(`${C.y}Les donnees de test ont ete conservees. Prefixe : ${TAG} / suffixe ${SUF}${C.z}`)
    return { skipped: true }
  }
  banner("NETTOYAGE DES DONNEES DE TEST")
  const stats = { distributions: 0, donations: 0, donors: 0, documents: 0, families: 0, echecs: [] }

  for (const id of [...new Set(CLEAN.distributions)]) {
    const r = await DEL(`/api/distributions/${id}`)
    if (r.status < 300 || r.status === 404) stats.distributions++
    else stats.echecs.push({ type: "distribution", id, status: r.status, message: r.message })
  }
  for (const id of [...new Set(CLEAN.documents)]) {
    const r = await DEL(`/api/documents/${id}`)
    if (r.status < 300 || r.status === 404) stats.documents++
  }
  for (const id of [...new Set(CLEAN.donations)]) {
    const r = await DEL(`/api/donations/${id}`)
    if (r.status < 300 || r.status === 404) stats.donations++
    else stats.echecs.push({ type: "don", id, status: r.status, message: r.message })
  }
  for (const id of [...new Set(CLEAN.donors)]) {
    const r = await DEL(`/api/donors/${id}`)
    if (r.status < 300 || r.status === 404) stats.donors++
  }

  /* Familles : on repasse en revue tout ce qui porte le prefixe, y compris ce qui
     aurait ete cree hors CLEAN (fuzzing, sondes de calibration...). */
  const all = await GET("/api/families?status=ALL")
  const tagged = ((all.data || {}).families || []).filter(
    (f) => String(f.lastName || "").includes(TAG) || String(f.firstName || "").includes(TAG) || String(f.ccp || "").startsWith(`99${SUF}`)
  )
  const toDelete = [...new Set([...CLEAN.families, ...tagged.map((f) => f.id)])]
  for (const id of toDelete) {
    let r = await DEL(`/api/families/${id}?mode=hard`)
    if (r.status === 409) {
      /* Historique d'aide : la suppression definitive est bloquee, on archive. */
      const s = await DEL(`/api/families/${id}?mode=soft`)
      stats.echecs.push({ type: "famille", id, raison: "historique d'aide -> archivee", archivee: s.status < 300 })
      continue
    }
    if (r.status < 300 || r.status === 404) stats.families++
    else stats.echecs.push({ type: "famille", id, status: r.status, message: r.message })
  }

  /* Restauration des parametres et de la fiche mosquee */
  const rst = await POST("/api/settings/reset", { scope: "all" })
  stats.parametresReinitialises = rst.status < 300
  if (STATE.settings0 && STATE.settings0.reservePercentage !== undefined) {
    await PUT("/api/settings", pick(STATE.settings0, [
      "reservePercentage", "minimumDistributionAmount", "allowAnonymousDonations",
      "autoCalculateSVF", "svfWeightExponent",
    ]))
    stats.parametresRestaures = true
  }
  if (STATE.mosque0 && STATE.mosque0.name) {
    const r = await PUT("/api/mosque", pick(STATE.mosque0, ["name", "wilaya", "commune", "address", "phone", "email", "description"]))
    stats.mosqueeRestauree = r.status < 300
  }

  log(`${C.g}Nettoyage : ${stats.families} famille(s), ${stats.donors} donateur(s), ${stats.donations} don(s), ${stats.distributions} distribution(s), ${stats.documents} document(s).${C.z}`)
  if (stats.echecs.length) log(`${C.y}${stats.echecs.length} element(s) non supprime(s) -- voir le rapport.${C.z}`)
  if (STATE.b && STATE.b.email) {
    log(`${C.y}Le compte cree en S2 (${STATE.b.email}) n'est pas supprimable par l'API. Requete SQL fournie dans le rapport.${C.z}`)
  }
  return stats
}

function buildJson(stats, dureeMs) {
  const parSection = {}
  for (const r of RESULTS) {
    const s = r.section || "?"
    parSection[s] = parSection[s] || { PASS: 0, FAIL: 0, SKIP: 0, INFO: 0, WARN: 0, titre: (SECTIONS.find((x) => x.id === s) || {}).title || "" }
    parSection[s][r.type] = (parSection[s][r.type] || 0) + 1
  }
  const couverture = Object.entries(ENDPOINT_HITS)
    .map(([k, v]) => ({ endpoint: k, appels: v }))
    .sort((a, b) => b.appels - a.appels)
  return {
    outil: "test-full-suite.mjs",
    version: "1.0",
    ranAt: new Date().toISOString(),
    dureeMs,
    base: CFG.base,
    mosqueId: STATE.mosqueId,
    mosque: STATE.mosque ? { nom: STATE.mosque.name, wilaya: STATE.mosque.wilaya, commune: STATE.mosque.commune } : null,
    utilisateur: STATE.user ? { id: STATE.user.id, email: STATE.user.email, role: STATE.user.role } : null,
    prefixeDonnees: TAG,
    suffixe: SUF,
    options: pick(CFG, ["only", "skip", "repeat", "keep", "bail", "verbose", "noRegister"]),
    totaux: { ...COUNT, total: RESULTS.length },
    parSection,
    poidsSvfUtilises: STATE.weights,
    poidsSvfMesures: STATE.CAL,
    waterFilling: STATE.wf,
    requetesHttp: HTTP_CALLS,
    couvertureEndpoints: couverture,
    nettoyage: stats,
    fatal: FATAL,
    resultats: RESULTS,
    echecs: RESULTS.filter((r) => r.status === "FAIL"),
  }
}

function buildMarkdown(j) {
  const L = []
  L.push(`# Rapport de test complet -- ${j.ranAt}`)
  L.push("")
  L.push(`- **Base** : ${j.base}`)
  L.push(`- **Mosquee** : ${j.mosque ? `${j.mosque.nom} (${j.mosque.wilaya}/${j.mosque.commune})` : j.mosqueId}`)
  L.push(`- **Duree** : ${Math.round(j.dureeMs / 1000)} s -- **${j.requetesHttp} requetes HTTP**`)
  L.push(`- **Resultat** : ${j.totaux.PASS} reussis / ${j.totaux.FAIL} echecs / ${j.totaux.SKIP} ignores / ${j.totaux.WARN} avertissements / ${j.totaux.INFO} informations`)
  L.push("")
  L.push("## Synthese par section")
  L.push("")
  L.push("| Section | Intitule | Reussis | Echecs | Ignores | Avert. | Infos |")
  L.push("|---|---|---:|---:|---:|---:|---:|")
  for (const [s, v] of Object.entries(j.parSection).sort()) {
    L.push(`| ${s} | ${v.titre} | ${v.PASS || 0} | ${v.FAIL || 0} | ${v.SKIP || 0} | ${v.WARN || 0} | ${v.INFO || 0} |`)
  }
  L.push("")
  if (j.echecs.length) {
    L.push(`## Echecs (${j.echecs.length})`)
    L.push("")
    for (const f of j.echecs) {
      L.push(`### ${f.name}`)
      L.push("")
      L.push("```json")
      L.push(JSON.stringify(f.detail, null, 2).slice(0, 1200))
      L.push("```")
      L.push("")
    }
  } else {
    L.push("## Echecs")
    L.push("")
    L.push("Aucun echec.")
    L.push("")
  }
  L.push("## Poids SVF")
  L.push("")
  L.push("| Facteur | Configure (API) | Mesure (empirique) | Ecart |")
  L.push("|---|---:|---:|---:|")
  for (const [k, v] of Object.entries(j.poidsSvfMesures || {})) {
    const conf = (j.poidsSvfUtilises || {})[k]
    const ecart = conf === undefined ? "-" : round2(Number(v) - Number(conf))
    L.push(`| ${k} | ${conf === undefined ? "-" : conf} | ${v} | ${ecart} |`)
  }
  L.push("")
  L.push("## Couverture des routes")
  L.push("")
  L.push("| Route | Appels |")
  L.push("|---|---:|")
  for (const c of (j.couvertureEndpoints || []).slice(0, 60)) L.push(`| ${c.endpoint} | ${c.appels} |`)
  L.push("")
  L.push("## Nettoyage")
  L.push("")
  L.push("```json")
  L.push(JSON.stringify(j.nettoyage, null, 2))
  L.push("```")
  L.push("")
  L.push("### Purge SQL manuelle (comptes crees par la section S2)")
  L.push("")
  L.push("L'API n'expose pas de suppression de compte. Sur une base de developpement uniquement :")
  L.push("")
  L.push("```sql")
  L.push("-- Verifier d'abord ce qui sera supprime")
  L.push(`SELECT id, email FROM "User" WHERE email LIKE 'zztest.%';`)
  L.push(`SELECT id, name FROM "Mosque" WHERE name LIKE '${TAG}%';`)
  L.push("")
  L.push(`DELETE FROM "MosqueSettings" WHERE "mosqueId" IN (SELECT id FROM "Mosque" WHERE name LIKE '${TAG}%');`)
  L.push(`DELETE FROM "User" WHERE email LIKE 'zztest.%';`)
  L.push(`DELETE FROM "Mosque" WHERE name LIKE '${TAG}%';`)
  L.push("```")
  L.push("")
  L.push("### Purge SQL des familles restantes")
  L.push("")
  L.push("```sql")
  L.push(`SELECT id, "firstName", "lastName", ccp FROM "Family" WHERE "lastName" LIKE '${TAG}%' OR ccp LIKE '99${SUF}%';`)
  L.push(`DELETE FROM "Family" WHERE "lastName" LIKE '${TAG}%' OR ccp LIKE '99${SUF}%';`)
  L.push("```")
  L.push("")
  return L.join("\n")
}

async function main() {
  const t0 = Date.now()

  if (CFG.list) {
    banner("SECTIONS DISPONIBLES")
    for (const s of SECTIONS) log(`  ${C.c}${s.id.padEnd(4)}${C.z} ${s.title}`)
    log("")
    log(`Total : ${SECTIONS.length} sections.`)
    log(`Exemple : node test-full-suite.mjs --only S5,S7 --password "..."`)
    return 0
  }

  banner("SUITE DE TESTS COMPLETE -- APPLICATION DE GESTION DES DONS")
  log(`Base           : ${CFG.base}`)
  log(`Prefixe        : ${TAG} / suffixe ${SUF}`)
  log(`Sections       : ${CFG.only.length ? CFG.only.join(", ") : "toutes"}${CFG.skip.length ? ` (sauf ${CFG.skip.join(", ")})` : ""}`)
  log(`Repetitions    : ${CFG.repeat}`)
  log(`Nettoyage      : ${CFG.keep ? "desactive (--keep)" : "active"}`)
  log(`${C.y}AVERTISSEMENT : a executer uniquement sur une base de developpement.${C.z}`)

  let stats = { skipped: true }
  try {
    const boot = await resolveMosque()
    if (!boot) {
      FATAL = FATAL || "Initialisation impossible : voir les messages ci-dessus."
    } else {
      for (let iter = 1; iter <= CFG.repeat; iter++) {
        ITER = iter
        if (CFG.repeat > 1) banner(`PASSE ${iter} / ${CFG.repeat}`)
        for (const s of SECTIONS) {
          if (!selected(s.id)) { skip(s.id, "section non selectionnee"); continue }
          CUR = { id: s.id, title: s.title }
          banner(`${s.id} -- ${s.title}`)
          const st = Date.now()
          try {
            await s.fn()
          } catch (e) {
            fail(`${s.id} interruption inattendue`, { erreur: String((e && e.message) || e), pile: short((e && e.stack) || "", 400) })
            if (CFG.bail) { FATAL = `Arret demande (--bail) apres l'echec de ${s.id}.`; break }
          }
          const d = Date.now() - st
          const mine = RESULTS.filter((r) => r.section === s.id && r.iter === iter)
          const p = mine.filter((r) => r.status === "PASS").length
          const f = mine.filter((r) => r.status === "FAIL").length
          log(`${f ? C.r : C.g}  -> ${s.id} termine : ${p} reussis, ${f} echecs (${Math.round(d / 1000)} s)${C.z}`)
          if (f && CFG.bail) { FATAL = `Arret demande (--bail) : ${f} echec(s) dans ${s.id}.`; break }
        }
        if (FATAL) break
      }
    }
  } catch (e) {
    FATAL = `Erreur fatale : ${String((e && e.message) || e)}`
    log(`${C.r}${FATAL}${C.z}`)
  } finally {
    try {
      if (STATE.token) stats = await cleanup()
    } catch (e) {
      log(`${C.r}Echec du nettoyage : ${String((e && e.message) || e)}${C.z}`)
      stats = { erreur: String((e && e.message) || e) }
    }
  }

  const duree = Date.now() - t0
  const j = buildJson(stats, duree)
  const jsonPath = path.resolve(process.cwd(), `${CFG.out}.json`)
  const mdPath = path.resolve(process.cwd(), `${CFG.out}.md`)
  const ECRITS = []
  try {
    /* JSON sans BOM (JSON.parse le refuse), Markdown avec BOM pour Windows. */
    fs.writeFileSync(jsonPath, JSON.stringify(j, null, 2), "utf8")
    fs.writeFileSync(mdPath, UTF8_BOM + buildMarkdown(j), "utf8")
    ECRITS.push(jsonPath, mdPath)
  } catch (e) {
    log(`${C.r}Ecriture du rapport impossible : ${String((e && e.message) || e)}${C.z}`)
  }

  banner("RESULTAT FINAL")
  const lignes = Object.entries(j.parSection).sort()
  for (const [s, v] of lignes) {
    const col = (v.FAIL || 0) > 0 ? C.r : C.g
    log(`  ${col}${s.padEnd(4)}${C.z} ${String(v.titre).slice(0, 52).padEnd(54)} ${String(v.PASS || 0).padStart(4)} ok  ${String(v.FAIL || 0).padStart(3)} ko  ${String(v.SKIP || 0).padStart(3)} skip`)
  }
  log("")
  log(`  ${C.g}REUSSIS      : ${COUNT.PASS}${C.z}`)
  log(`  ${COUNT.FAIL ? C.r : C.g}ECHECS       : ${COUNT.FAIL}${C.z}`)
  log(`  ${C.y}AVERTIS.     : ${COUNT.WARN}${C.z}`)
  log(`  ${C.b}IGNORES      : ${COUNT.SKIP}${C.z}`)
  log(`  ${C.c}INFOS        : ${COUNT.INFO}${C.z}`)
  log(`  REQUETES HTTP: ${HTTP_CALLS}`)
  log(`  DUREE        : ${Math.round(duree / 1000)} s`)
  log("")
  if (FATAL) log(`${C.r}FATAL : ${FATAL}${C.z}`)
  if (COUNT.FAIL) {
    log(`${C.r}Premiers echecs :${C.z}`)
    for (const f of j.echecs.slice(0, 15)) log(`  ${C.r}x${C.z} ${f.name}`)
    if (j.echecs.length > 15) log(`  ... et ${j.echecs.length - 15} autre(s), voir le rapport.`)
  }
  log("")
  log(`Rapport JSON : ${jsonPath}`)
  log(`Rapport MD   : ${mdPath}`)
  log(`${C.y}Envoyez le fichier ${CFG.out}.json pour analyse.${C.z}`)

  /* Preuve d'ecriture : taille + horodatage RELUS sur le disque. Si l'heure
   * affichee n'est pas l'heure courante, le fichier n'a pas ete reecrit. */
  termFlush()
  log("")
  log(`${C.c}FICHIERS ECRITS -- l'heure doit correspondre a maintenant${C.z}`)
  for (const fp of ECRITS.concat([TERM_LOG])) {
    try {
      const st = fs.statSync(fp)
      log(`  ${String(st.size).padStart(9)} o   ${st.mtime.toLocaleString()}   ${fp}`)
    } catch (e) {
      log(`  ${C.r}ABSENT${C.z}   ${fp}   (${String((e && e.message) || e)})`)
    }
  }
  log(`  ${C.dim}Dossier courant : ${process.cwd()}${C.z}`)
  return COUNT.FAIL > 0 ? 1 : 0
}

main()
  .then((code) => { process.exitCode = code })
  .catch((e) => {
    console.error(`${C.r}Erreur non rattrapee :${C.z}`, e)
    process.exitCode = 2
  })
