#!/usr/bin/env node
/**
 * ============================================================================
 *  SUITE DE TESTS \u2014 SYNCHRONISATION DES DONN\u00c9ES ET DU SCORE SVF
 *  test-sync-suite.mjs
 * ============================================================================
 *
 *  Cette suite ne teste PAS la formule SVF (voir test-svf-integrity.mjs) ni
 *  toutes les fonctionnalit\u00e9s (voir test-full-suite.mjs).
 *  Elle teste UNE seule chose, celle qui \u00e9tait cass\u00e9e :
 *
 *      \u00ab\u00a0Quand une donn\u00e9e bouge quelque part, est-ce que TOUT ce qui en
 *        d\u00e9pend bouge aussi\u00a0?\u00a0\u00bb
 *
 *  Autrement dit : apr\u00e8s chaque \u00e9criture (ajout de membre, modification du
 *  chef, suppression, distribution, validation de paiement, annulation,
 *  changement de param\u00e8tres), on relit la famille depuis la base via l'API
 *  et on v\u00e9rifie que :
 *
 *    - le score SVF a \u00e9t\u00e9 recalcul\u00e9 (et pas laiss\u00e9 tel quel) ;
 *    - la priorit\u00e9 d\u00e9rive bien du nouveau score ;
 *    - les champs miroir chef <-> famille sont identiques des deux c\u00f4t\u00e9s ;
 *    - le nombre de membres suit les ajouts/suppressions ;
 *    - le solde de la mosqu\u00e9e suit les paiements ;
 *    - une annulation restaure exactement l'\u00e9tat pr\u00e9c\u00e9dent.
 *
 *  ---------------------------------------------------------------------------
 *  UTILISATION
 *  ---------------------------------------------------------------------------
 *      npm run dev            (dans un premier terminal)
 *      node test-sync-suite.mjs --password "votre_mot_de_passe"
 *
 *  Options :
 *      --base   http://localhost:3000     URL de l'application
 *      --mosque <id>                      si plusieurs mosqu\u00e9es existent
 *      --password <mdp>                   mot de passe de l'imam (obligatoire)
 *      --only   T3,T7                     ne lancer que ces tests
 *      --skip   T12                       sauter ces tests
 *      --keep                             ne pas supprimer les donn\u00e9es de test
 *      --verbose                          afficher le d\u00e9tail de chaque assertion
 *      --list                             lister les tests et quitter
 *
 *  Sortie : console + sync-report.json + sync-report.md
 *  Code de sortie : 0 = tout passe, 1 = au moins un \u00e9chec, 2 = erreur fatale
 *
 *  AUCUNE donn\u00e9e existante n'est modifi\u00e9e : tout est cr\u00e9\u00e9 avec le pr\u00e9fixe
 *  ZZSYNC puis supprim\u00e9 \u00e0 la fin.
 * ============================================================================
 */

import fs from "node:fs";

/* ==========================================================================
   1. CONFIGURATION
   ========================================================================== */

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  if (next === undefined || next.startsWith("--")) return true;
  return next;
}

const CFG = {
  base: String(arg("base", process.env.BASE || "http://localhost:3000")).replace(
    /\/+$/,
    "",
  ),
  mosque: arg("mosque", process.env.MOSQUE || null),
  password: arg("password", process.env.PASSWORD || null),
  only: arg("only", null),
  skip: arg("skip", null),
  keep: arg("keep", false) === true,
  verbose: arg("verbose", false) === true,
  list: arg("list", false) === true,
  timeout: 30000,
  out: "sync-report",
};

const TAG = "ZZSYNC";
const SUF = Date.now().toString().slice(-6);
let SEQ = 0;
const uid = () => `${SUF}${String(++SEQ).padStart(3, "0")}`;
// CCP = 12 chiffres, unique dans toute la base.
const newCcp = () => `88${SUF}${String(SEQ).padStart(4, "0")}`.slice(0, 12);

/* ==========================================================================
   2. AFFICHAGE
   ========================================================================== */

const C = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  red: "\u001b[31m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  blue: "\u001b[34m",
  cyan: "\u001b[36m",
  grey: "\u001b[90m",
};
const r = (s) => `${C.red}${s}${C.reset}`;
const g = (s) => `${C.green}${s}${C.reset}`;
const y = (s) => `${C.yellow}${s}${C.reset}`;
const b = (s) => `${C.blue}${s}${C.reset}`;
const c = (s) => `${C.cyan}${s}${C.reset}`;
const z = (s) => `${C.grey}${s}${C.reset}`;

/* ==========================================================================
   3. \u00c9TAT GLOBAL
   ========================================================================== */

const STATE = {
  token: null,
  mosqueId: null,
  mosqueName: null,
  settings0: null, // param\u00e8tres d'origine, restaur\u00e9s \u00e0 la fin
  weights: null,
  balance0: 0,
};

// Tout ce qui devra \u00eatre effac\u00e9 \u00e0 la fin.
const CLEAN = { families: [], distributions: [], donors: [], donations: [] };

const RESULTS = [];
const COUNT = { PASS: 0, FAIL: 0, SKIP: 0, INFO: 0 };
let HTTP_CALLS = 0;
let FATAL = null;
let CUR = { id: "-", title: "-" };

function record(status, name, detail = "") {
  COUNT[status] = (COUNT[status] || 0) + 1;
  RESULTS.push({
    test: CUR.id,
    testTitle: CUR.title,
    name,
    status,
    detail: String(detail || ""),
    at: new Date().toISOString(),
  });
  const badge =
    status === "PASS"
      ? g("PASS")
      : status === "FAIL"
        ? r("FAIL")
        : status === "SKIP"
          ? y("SKIP")
          : c("INFO");
  if (status !== "PASS" || CFG.verbose) {
    console.log(`  ${badge}  ${name}${detail ? z("  \u2014 " + detail) : ""}`);
  }
}

const pass = (n, d) => record("PASS", n, d);
const fail = (n, d) => record("FAIL", n, d);
const skip = (n, d) => record("SKIP", n, d);
const info = (n, d) => record("INFO", n, d);

/** Assertion bool\u00e9enne. */
function check(cond, name, detail = "") {
  if (cond) pass(name, CFG.verbose ? detail : "");
  else fail(name, detail);
  return Boolean(cond);
}

/** \u00c9galit\u00e9 stricte, avec les deux valeurs dans le message d'erreur. */
function eq(actual, expected, name) {
  const okv = actual === expected;
  return check(
    okv,
    name,
    okv ? `= ${JSON.stringify(actual)}` : `attendu ${JSON.stringify(expected)}, re\u00e7u ${JSON.stringify(actual)}`,
  );
}

/** \u00c9galit\u00e9 num\u00e9rique \u00e0 la tol\u00e9rance pr\u00e8s (arrondis \u00e0 2 d\u00e9cimales). */
function near(actual, expected, name, tol = 0.011) {
  const a = Number(actual);
  const e = Number(expected);
  const okv = Number.isFinite(a) && Number.isFinite(e) && Math.abs(a - e) <= tol;
  return check(
    okv,
    name,
    okv ? `= ${a}` : `attendu ~${e}, re\u00e7u ${a} (\u0394 ${(a - e).toFixed(3)})`,
  );
}

/** V\u00e9rifie qu'une valeur a bien CHANG\u00c9 (le c\u0153ur de cette suite). */
function changed(before, after, name, extra = "") {
  const okv = Number(before) !== Number(after);
  return check(
    okv,
    name,
    okv
      ? `${before} \u2192 ${after}${extra ? " " + extra : ""}`
      : `valeur inchang\u00e9e (${before}) \u2014 la synchronisation n'a pas eu lieu${extra ? " " + extra : ""}`,
  );
}

/** V\u00e9rifie qu'une valeur n'a PAS chang\u00e9. */
function stable(before, after, name) {
  return near(after, before, name);
}

/* ==========================================================================
   4. CLIENT HTTP
   ========================================================================== */

async function api(method, path, body, opts = {}) {
  HTTP_CALLS++;
  const url = `${CFG.base}/api${path}`;
  const headers = { "Content-Type": "application/json" };
  const token = opts.token === undefined ? STATE.token : opts.token;
  if (token) headers.Authorization = `Bearer ${token}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CFG.timeout);
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return {
      status: res.status,
      ok: res.ok,
      json,
      data: json?.data ?? null,
      message: json?.message ?? null,
      raw: text.slice(0, 400),
    };
  } catch (e) {
    return {
      status: 0,
      ok: false,
      json: null,
      data: null,
      message: String(e?.message || e),
      raw: "",
    };
  } finally {
    clearTimeout(timer);
  }
}

const GET = (p, o) => api("GET", p, undefined, o);
const POST = (p, bdy, o) => api("POST", p, bdy, o);
const PUT = (p, bdy, o) => api("PUT", p, bdy, o);
const DEL = (p, o) => api("DELETE", p, undefined, o);

/** Appel qui DOIT r\u00e9ussir : journalise le corps d'erreur si ce n'est pas le cas. */
async function must(res, name) {
  if (!res.ok) {
    fail(name, `HTTP ${res.status} \u2014 ${res.message || res.raw}`);
    return null;
  }
  return res.data;
}

/* ==========================================================================
   5. UTILITAIRES M\u00c9TIER
   ========================================================================== */

const DAY = 86400000;
const round2 = (n) => Math.round(Number(n) * 100) / 100;
const num = (v) => (v === null || v === undefined ? 0 : Number(v));
const sleep = (ms) => new Promise((rs) => setTimeout(rs, ms));

/** Date de naissance correspondant \u00e0 l'\u00e2ge demand\u00e9 (au 15 du mois, sans pi\u00e8ge). */
function dobForAge(age) {
  const d = new Date(Date.now() - (age * 365.25 + 40) * DAY);
  return d.toISOString().slice(0, 10);
}

/** Priorit\u00e9 attendue pour un score (miroir de priorityFromScore c\u00f4t\u00e9 serveur). */
function priorityFromScore(s) {
  const n = Number(s) || 0;
  if (n >= 70) return "URGENT";
  if (n >= 45) return "VULNERABLE";
  if (n >= 20) return "MODERATE";
  return "LOW";
}

/** Charge une famille compl\u00e8te. */
async function getFamily(id) {
  const res = await GET(`/families/${id}`);
  return res.data?.family ?? null;
}

/** Raccourci : score SVF actuel d'une famille, relu depuis la base. */
async function scoreOf(id) {
  const f = await getFamily(id);
  return f ? Number(f.svfScore) : NaN;
}

/** Liste des membres d'une famille. */
async function membersOf(id) {
  const res = await GET(`/families/${id}/members`);
  return res.data?.members ?? [];
}

/** Corps de cr\u00e9ation d'une famille, avec des valeurs par d\u00e9faut cr\u00e9dibles. */
function famPayload(over = {}) {
  return {
    firstName: `Fam${uid()}`,
    lastName: `${TAG}${uid()}`,
    dateOfBirth: dobForAge(40),
    ccp: newCcp(),
    wilaya: "Blida",
    address: "Rue des tests 12",
    phone: "0550000000",
    maritalStatus: "SINGLE",
    housingStatus: "OWNER",
    housingType: "HOUSE",
    monthlyIncome: 15000,
    employmentStatus: "NONE",
    membersCount: 1,
    childrenSchoolCount: 0,
    hasDisability: false,
    diseases: "",
    ...over,
  };
}

/** Cr\u00e9e une famille de test et l'enregistre pour le nettoyage. */
async function createFamily(over = {}) {
  const res = await POST("/families", famPayload(over));
  const fam = res.data?.family ?? null;
  if (fam?.id) CLEAN.families.push(fam.id);
  else fail("Cr\u00e9ation de famille", `HTTP ${res.status} \u2014 ${res.message || res.raw}`);
  return fam;
}

/** Ajoute un membre. */
async function addMember(familyId, over = {}) {
  const res = await POST(`/families/${familyId}/members`, {
    firstName: `Mem${uid()}`,
    lastName: `${TAG}m`,
    role: "CHILD",
    dateOfBirth: dobForAge(10),
    ...over,
  });
  return res;
}

/** Solde courant de la mosqu\u00e9e. */
async function mosqueBalance() {
  const res = await GET("/dashboard/stats");
  return num(res.data?.balance);
}

/** Cr\u00e9dite la mosqu\u00e9e via un vrai don, pour pouvoir distribuer ensuite. */
async function fundMosque(amount) {
  const donor = await POST("/donors", {
    name: `${TAG} Donateur ${uid()}`,
    donorType: "INDIVIDUAL",
    phone: "0551111111",
  });
  const donorId = donor.data?.donor?.id ?? null;
  if (donorId) CLEAN.donors.push(donorId);
  const don = await POST("/donations", {
    donorId,
    amount,
    category: "SADAQAH",
    paymentMethod: "CASH",
    receivedAt: new Date().toISOString(),
  });
  const donationId = don.data?.donation?.id ?? null;
  if (donationId) CLEAN.donations.push(donationId);
  return don.ok;
}

/* ==========================================================================
   6. D\u00c9CLARATION DES TESTS
   ========================================================================== */

const TESTS = [];
const test = (id, title, fn) => TESTS.push({ id, title, fn });

function selected(id) {
  if (CFG.only && CFG.only !== true) {
    const list = String(CFG.only)
      .split(",")
      .map((s) => s.trim().toUpperCase());
    if (!list.includes(id.toUpperCase())) return false;
  }
  if (CFG.skip && CFG.skip !== true) {
    const list = String(CFG.skip)
      .split(",")
      .map((s) => s.trim().toUpperCase());
    if (list.includes(id.toUpperCase())) return false;
  }
  return true;
}

/** Ex\u00e9cute un test en isolant ses exceptions : un test cass\u00e9 n'arr\u00eate pas la suite. */
async function guard(t) {
  CUR = { id: t.id, title: t.title };
  console.log(`\n${b("\u2500".repeat(74))}`);
  console.log(`${b(t.id)}  ${C.bold}${t.title}${C.reset}`);
  console.log(b("\u2500".repeat(74)));
  const t0 = Date.now();
  try {
    await t.fn();
  } catch (e) {
    fail(`${t.id} \u2014 exception non rattrap\u00e9e`, String(e?.stack || e));
  }
  console.log(z(`  (${((Date.now() - t0) / 1000).toFixed(1)} s)`));
}

/* ==========================================================================
   7. TESTS
   ========================================================================== */

/* --------------------------------------------------------------------------
   T1 \u2014 Le score existe d\u00e8s la cr\u00e9ation, et la priorit\u00e9 en d\u00e9coule
   -------------------------------------------------------------------------- */
test("T1", "Cr\u00e9ation d'une famille : score et priorit\u00e9 calcul\u00e9s imm\u00e9diatement", async () => {
  const fam = await createFamily({ monthlyIncome: 5000, membersCount: 1 });
  if (!fam) return;

  check(
    Number.isFinite(Number(fam.svfScore)),
    "Le score SVF est un nombre d\u00e8s la r\u00e9ponse de cr\u00e9ation",
    `svfScore = ${fam.svfScore}`,
  );
  check(Number(fam.svfScore) > 0, "Un revenu de 5 000 DA donne un score > 0", `= ${fam.svfScore}`);
  eq(fam.priority, priorityFromScore(fam.svfScore), "La priorit\u00e9 correspond au score");

  // Relecture : la valeur renvoy\u00e9e doit \u00eatre celle r\u00e9ellement \u00e9crite en base.
  const reread = await getFamily(fam.id);
  near(reread?.svfScore, fam.svfScore, "Le score relu en base est identique au score renvoy\u00e9");
  eq(reread?.priority, fam.priority, "La priorit\u00e9 relue en base est identique");
});

/* --------------------------------------------------------------------------
   T2 \u2014 Ajouter un membre : effectif, situation maritale et score
   -------------------------------------------------------------------------- */
test("T2", "Ajout d'un membre : effectif, statut marital et score suivent", async () => {
  const fam = await createFamily({
    monthlyIncome: 12000,
    maritalStatus: "SINGLE",
    membersCount: 1,
  });
  if (!fam) return;

  const before = await getFamily(fam.id);
  const scoreBefore = Number(before.svfScore);

  // 1) Ajout d'un\u00b7e \u00e9poux\u00b7se : le chef c\u00e9libataire doit passer \u00e0 \u00ab\u00a0Mari\u00e9(e)\u00a0\u00bb.
  const res = await addMember(fam.id, { role: "SPOUSE", dateOfBirth: dobForAge(35) });
  if (!res.ok) {
    fail("Ajout de l'\u00e9poux/\u00e9pouse", `HTTP ${res.status} \u2014 ${res.message || res.raw}`);
    return;
  }
  check(Boolean(res.data?.member?.id), "Le membre est cr\u00e9\u00e9");

  const afterSpouse = await getFamily(fam.id);
  eq(afterSpouse.maritalStatus, "MARRIED", "C\u00e9libataire + \u00e9poux(se) \u2192 la famille passe \u00e0 MARRIED");
  check(
    Number(afterSpouse.membersCount) >= 2,
    "Le nombre de membres a \u00e9t\u00e9 relev\u00e9 \u00e0 au moins 2",
    `membersCount = ${afterSpouse.membersCount}`,
  );
  check(
    res.data?.maritalStatusChanged === true ||
      res.data?.family?.maritalStatus === "MARRIED",
    "La r\u00e9ponse de l'API signale le passage \u00e0 MARRIED",
    JSON.stringify(res.data?.maritalStatusChanged),
  );

  // 2) Ajout d'un enfant : l'effectif monte encore et le score doit \u00eatre recalcul\u00e9.
  const scoreMid = Number(afterSpouse.svfScore);
  const kid = await addMember(fam.id, { role: "CHILD", dateOfBirth: dobForAge(8) });
  check(kid.ok, "Ajout d'un enfant accept\u00e9", kid.message || "");

  const afterKid = await getFamily(fam.id);
  check(
    Number(afterKid.membersCount) >= 3,
    "L'effectif suit le second ajout",
    `membersCount = ${afterKid.membersCount}`,
  );
  check(
    Number.isFinite(Number(afterKid.svfScore)),
    "Le score reste un nombre valide apr\u00e8s deux ajouts",
    `${scoreBefore} \u2192 ${scoreMid} \u2192 ${afterKid.svfScore}`,
  );
  eq(afterKid.priority, priorityFromScore(afterKid.svfScore), "Priorit\u00e9 recoh\u00e9rente apr\u00e8s ajouts");

  const list = await membersOf(fam.id);
  check(list.length >= 2, "Les deux membres sont bien list\u00e9s", `${list.length} membre(s)`);
});

/* --------------------------------------------------------------------------
   T3 \u2014 Modifier le CHEF : miroir vers la fiche famille + recalcul
   C'est la nouvelle fonctionnalit\u00e9 : le chef devient modifiable.
   -------------------------------------------------------------------------- */
test("T3", "Modification du chef de famille : miroir vers la famille et recalcul SVF", async () => {
  const fam = await createFamily({
    monthlyIncome: 9000,
    dateOfBirth: dobForAge(40),
    hasDisability: false,
    membersCount: 2,
  });
  if (!fam) return;

  // Le chef est cr\u00e9\u00e9 automatiquement avec la famille.
  let list = await membersOf(fam.id);
  let head = list.find((m) => m.role === "HEAD");
  if (!head) {
    const created = await addMember(fam.id, {
      role: "HEAD",
      firstName: fam.firstName,
      lastName: fam.lastName,
      dateOfBirth: fam.dateOfBirth,
    });
    head = created.data?.member ?? null;
  }
  if (!head) {
    fail("Chef de famille introuvable", "impossible de poursuivre T3");
    return;
  }
  info("Chef de famille identifi\u00e9", `${head.firstName} ${head.lastName} (${head.id})`);

  const before = await getFamily(fam.id);
  const scoreBefore = Number(before.svfScore);

  // 1) Changement de la date de naissance vers 70 ans \u2192 points \u00ab\u00a0personne \u00e2g\u00e9e\u00a0\u00bb.
  const seniorDob = dobForAge(70);
  const up = await PUT(`/members/${head.id}`, { dateOfBirth: seniorDob });
  if (!up.ok) {
    fail(
      "Le chef de famille doit \u00eatre modifiable",
      `HTTP ${up.status} \u2014 ${up.message || up.raw}`,
    );
    return;
  }
  pass("Le chef de famille est modifiable via PUT /members/:id");

  const afterDob = await getFamily(fam.id);
  eq(
    String(afterDob.dateOfBirth).slice(0, 10),
    seniorDob,
    "La date de naissance du chef est report\u00e9e sur la fiche famille (miroir)",
  );
  changed(scoreBefore, afterDob.svfScore, "Le score SVF a \u00e9t\u00e9 recalcul\u00e9 apr\u00e8s le changement d'\u00e2ge du chef");
  check(
    up.data?.headMirrored === true,
    "La r\u00e9ponse signale que les champs du chef ont \u00e9t\u00e9 report\u00e9s",
    JSON.stringify(up.data?.headMirrored),
  );
  eq(afterDob.priority, priorityFromScore(afterDob.svfScore), "Priorit\u00e9 recoh\u00e9rente");

  // 2) Passage en situation de handicap \u2192 points \u00ab\u00a0sant\u00e9\u00a0\u00bb.
  const scoreMid = Number(afterDob.svfScore);
  const up2 = await PUT(`/members/${head.id}`, { hasDisability: true });
  check(up2.ok, "Modification du handicap du chef accept\u00e9e", up2.message || "");

  const afterDis = await getFamily(fam.id);
  eq(afterDis.hasDisability, true, "Le handicap du chef est report\u00e9 sur la fiche famille");
  changed(scoreMid, afterDis.svfScore, "Le score SVF a \u00e9t\u00e9 recalcul\u00e9 apr\u00e8s le handicap du chef");

  // 3) Le r\u00f4le du chef ne peut pas \u00eatre chang\u00e9 (sinon la famille perdrait sa t\u00eate).
  const roleChange = await PUT(`/members/${head.id}`, { role: "CHILD" });
  check(
    roleChange.status === 409 || roleChange.status === 400,
    "Changer le r\u00f4le du chef est refus\u00e9",
    `HTTP ${roleChange.status} \u2014 ${roleChange.message}`,
  );

  // 4) Le chef ne peut pas \u00eatre supprim\u00e9 seul.
  const delHead = await DEL(`/members/${head.id}`);
  check(
    delHead.status === 409 || delHead.status === 400,
    "Supprimer le chef seul est refus\u00e9",
    `HTTP ${delHead.status} \u2014 ${delHead.message}`,
  );
});

/* --------------------------------------------------------------------------
   T4 \u2014 Miroir dans l'autre sens : famille \u2192 chef
   -------------------------------------------------------------------------- */
test("T4", "Modification de la fiche famille : le chef est mis \u00e0 jour en retour", async () => {
  const fam = await createFamily({
    monthlyIncome: 11000,
    dateOfBirth: dobForAge(45),
    hasDisability: false,
    membersCount: 2,
  });
  if (!fam) return;

  const list = await membersOf(fam.id);
  const head = list.find((m) => m.role === "HEAD");
  if (!head) {
    skip("T4 : aucun chef enregistr\u00e9 automatiquement", "miroir non testable");
    return;
  }

  const scoreBefore = Number((await getFamily(fam.id)).svfScore);
  const newDob = dobForAge(68);

  const up = await PUT(`/families/${fam.id}`, {
    dateOfBirth: newDob,
    hasDisability: true,
    firstName: "Chef" + uid(),
  });
  if (!up.ok) {
    fail("Modification de la famille", `HTTP ${up.status} \u2014 ${up.message || up.raw}`);
    return;
  }

  const after = await getFamily(fam.id);
  changed(scoreBefore, after.svfScore, "Le score est recalcul\u00e9 apr\u00e8s modification de la fiche famille");

  const list2 = await membersOf(fam.id);
  const head2 = list2.find((m) => m.id === head.id);
  check(Boolean(head2), "Le chef est toujours pr\u00e9sent apr\u00e8s la modification");
  if (head2) {
    eq(
      String(head2.dateOfBirth).slice(0, 10),
      newDob,
      "La date de naissance saisie sur la famille est report\u00e9e sur le membre chef",
    );
    eq(head2.hasDisability, true, "Le handicap saisi sur la famille est report\u00e9 sur le membre chef");
    eq(head2.firstName, after.firstName, "Le pr\u00e9nom est identique des deux c\u00f4t\u00e9s");
  }
  check(
    up.data?.headMirrored === true || up.data?.headMirrored === false,
    "La r\u00e9ponse expose l'indicateur de miroir",
    JSON.stringify(up.data?.headMirrored),
  );
});

/* --------------------------------------------------------------------------
   T5 \u2014 Suppression d'un membre : effectif et score
   -------------------------------------------------------------------------- */
test("T5", "Suppression d'un membre : effectif et score recalcul\u00e9s", async () => {
  const fam = await createFamily({ monthlyIncome: 10000, membersCount: 1 });
  if (!fam) return;

  const add = await addMember(fam.id, { role: "BROTHER", dateOfBirth: dobForAge(20) });
  const memberId = add.data?.member?.id;
  if (!memberId) {
    fail("Ajout du membre \u00e0 supprimer", add.message || `HTTP ${add.status}`);
    return;
  }

  const before = await getFamily(fam.id);
  const countBefore = Number(before.membersCount);
  const scoreBefore = Number(before.svfScore);

  const del = await DEL(`/members/${memberId}`);
  check(del.ok, "Suppression du membre accept\u00e9e", del.message || `HTTP ${del.status}`);

  const after = await getFamily(fam.id);
  check(
    Number(after.membersCount) <= countBefore,
    "L'effectif ne s'est pas mis \u00e0 grimper apr\u00e8s une suppression",
    `${countBefore} \u2192 ${after.membersCount}`,
  );
  check(
    Number.isFinite(Number(after.svfScore)),
    "Le score reste valide apr\u00e8s la suppression",
    `${scoreBefore} \u2192 ${after.svfScore}`,
  );
  eq(after.priority, priorityFromScore(after.svfScore), "Priorit\u00e9 recoh\u00e9rente apr\u00e8s suppression");

  const list = await membersOf(fam.id);
  check(
    !list.some((m) => m.id === memberId),
    "Le membre supprim\u00e9 ne figure plus dans la liste",
  );
});

/* --------------------------------------------------------------------------
   T6 \u2014 Enfants scolaris\u00e9s : chaque ajout/suppression bouge le score
   -------------------------------------------------------------------------- */
test("T6", "Enfants scolaris\u00e9s : ajout et suppression recalculent le score", async () => {
  const fam = await createFamily({
    monthlyIncome: 14000,
    childrenSchoolCount: 0,
    membersCount: 2,
  });
  if (!fam) return;

  const scoreBefore = Number((await getFamily(fam.id)).svfScore);

  const add = await POST(`/families/${fam.id}/children`, {
    firstName: `Enf${uid()}`,
    lastName: `${TAG}c`,
    dateOfBirth: dobForAge(9),
    isSchooled: true,
    schoolLevel: "PRIMARY",
  });
  if (!add.ok) {
    skip("T6 : ajout d'enfant refus\u00e9", `HTTP ${add.status} \u2014 ${add.message}`);
    return;
  }
  const childId = add.data?.child?.id ?? null;

  const afterAdd = await getFamily(fam.id);
  changed(scoreBefore, afterAdd.svfScore, "Le score monte apr\u00e8s l'ajout d'un enfant scolaris\u00e9");
  check(
    Number(afterAdd.svfScore) >= scoreBefore,
    "Un enfant de plus ne fait jamais baisser le score",
    `${scoreBefore} \u2192 ${afterAdd.svfScore}`,
  );

  if (childId) {
    const del = await DEL(`/children/${childId}`);
    check(del.ok, "Suppression de l'enfant accept\u00e9e", del.message || "");
    const afterDel = await getFamily(fam.id);
    near(
      afterDel.svfScore,
      scoreBefore,
      "Le score revient exactement \u00e0 sa valeur d'origine apr\u00e8s suppression de l'enfant",
    );
  }
});

/* --------------------------------------------------------------------------
   T7 \u2014 Aide manuelle : malus appliqu\u00e9, ligne PAY\u00c9E, solde d\u00e9bit\u00e9
   -------------------------------------------------------------------------- */
test("T7", "Aide manuelle : le score baisse, la ligne est pay\u00e9e, le solde est d\u00e9bit\u00e9", async () => {
  const fam = await createFamily({ monthlyIncome: 6000, membersCount: 3 });
  if (!fam) return;

  await fundMosque(60000);
  const balBefore = await mosqueBalance();
  const scoreBefore = Number((await getFamily(fam.id)).svfScore);

  const amount = 5000;
  const res = await POST("/distributions", {
    familyId: fam.id,
    amount,
    note: `${TAG} aide manuelle`,
  });
  if (!res.ok) {
    fail("Aide manuelle refus\u00e9e", `HTTP ${res.status} \u2014 ${res.message || res.raw}`);
    return;
  }
  const distId = res.data?.distribution?.id ?? null;
  if (distId) CLEAN.distributions.push(distId);

  // C'est LE bug historique : l'aide \u00e9tait vers\u00e9e sans jamais rejouer le score.
  const after = await getFamily(fam.id);
  changed(
    scoreBefore,
    after.svfScore,
    "Le score SVF baisse apr\u00e8s une aide re\u00e7ue (malus d'aide)",
  );
  check(
    Number(after.svfScore) < scoreBefore,
    "La variation va bien dans le sens d'une BAISSE",
    `${scoreBefore} \u2192 ${after.svfScore}`,
  );
  eq(after.priority, priorityFromScore(after.svfScore), "Priorit\u00e9 recoh\u00e9rente apr\u00e8s l'aide");
  check(
    res.data?.svfScore !== undefined,
    "La r\u00e9ponse de l'API renvoie le nouveau score",
    JSON.stringify(res.data?.svfScore),
  );

  // La ligne doit \u00eatre PAY\u00c9E : une aide manuelle est de l'argent d\u00e9j\u00e0 sorti.
  const detail = await GET(`/distributions/${distId}`);
  const item = detail.data?.distribution?.items?.[0] ?? null;
  check(Boolean(item), "La distribution contient bien une ligne");
  if (item) {
    eq(item.paymentStatus, "PAID", "La ligne d'aide manuelle est marqu\u00e9e PAID");
    check(Boolean(item.paidAt), "La date de paiement est renseign\u00e9e", String(item.paidAt));
  }

  const balAfter = await mosqueBalance();
  near(balAfter, balBefore - amount, "Le solde de la mosqu\u00e9e est d\u00e9bit\u00e9 du montant vers\u00e9");
  check(Boolean(after.lastAidAt), "La date de derni\u00e8re aide est enregistr\u00e9e", String(after.lastAidAt));
});

/* --------------------------------------------------------------------------
   T8 \u2014 Le malus est cumulatif et plafonn\u00e9
   -------------------------------------------------------------------------- */
test("T8", "Aides successives : le malus se cumule puis se plafonne", async () => {
  const fam = await createFamily({ monthlyIncome: 4000, membersCount: 4 });
  if (!fam) return;

  await fundMosque(200000);
  const scores = [Number((await getFamily(fam.id)).svfScore)];

  for (let i = 0; i < 5; i++) {
    const res = await POST("/distributions", {
      familyId: fam.id,
      amount: 2000,
      note: `${TAG} aide ${i + 1}`,
    });
    if (!res.ok) {
      info(`Aide ${i + 1} refus\u00e9e`, `HTTP ${res.status} \u2014 ${res.message}`);
      break;
    }
    if (res.data?.distribution?.id) CLEAN.distributions.push(res.data.distribution.id);
    scores.push(Number((await getFamily(fam.id)).svfScore));
  }

  info("S\u00e9quence des scores", scores.join(" \u2192 "));
  check(scores.length >= 3, "Au moins deux aides ont pu \u00eatre vers\u00e9es", `${scores.length - 1} aide(s)`);

  let monotone = true;
  for (let i = 1; i < scores.length; i++) {
    if (scores[i] > scores[i - 1] + 0.011) monotone = false;
  }
  check(monotone, "Le score ne remonte jamais apr\u00e8s une aide suppl\u00e9mentaire");

  const total = scores[0] - scores[scores.length - 1];
  check(
    total <= 25.011,
    "La baisse cumul\u00e9e reste sous le plafond de malus param\u00e9tr\u00e9",
    `baisse totale = ${round2(total)}`,
  );
  check(
    Number(scores[scores.length - 1]) >= 0,
    "Le score ne devient jamais n\u00e9gatif",
    `= ${scores[scores.length - 1]}`,
  );
});

/* --------------------------------------------------------------------------
   T9 \u2014 Distribution calcul\u00e9e puis confirm\u00e9e : tous les b\u00e9n\u00e9ficiaires rejou\u00e9s
   -------------------------------------------------------------------------- */
test("T9", "Confirmation d'une distribution : le score baisse pour CHAQUE b\u00e9n\u00e9ficiaire", async () => {
  // Trois familles bien distinctes, pour v\u00e9rifier que le recalcul est fait en lot
  // et pas seulement sur la premi\u00e8re ligne.
  const fams = [];
  for (const income of [3000, 8000, 18000]) {
    const f = await createFamily({ monthlyIncome: income, membersCount: 3 });
    if (f) fams.push(f);
  }
  if (fams.length < 2) {
    skip("T9 : familles de test non cr\u00e9\u00e9es", "test impossible");
    return;
  }

  await fundMosque(400000);

  const before = {};
  for (const f of fams) before[f.id] = await scoreOf(f.id);

  const budget = 90000;
  const calc = await POST("/distribution/calculate", {
    totalBudget: budget,
    familyIds: fams.map((f) => f.id),
  });
  if (!calc.ok) {
    skip("T9 : calcul de r\u00e9partition refus\u00e9", `HTTP ${calc.status} \u2014 ${calc.message}`);
    return;
  }
  const plan = calc.data?.distributions ?? calc.data?.result?.distributions ?? [];
  check(plan.length > 0, "Le calcul renvoie au moins une allocation", `${plan.length} ligne(s)`);

  const confirm = await POST("/distribution/confirm", {
    totalBudget: budget,
    distributions: plan,
  });
  if (!confirm.ok) {
    fail("Confirmation refus\u00e9e", `HTTP ${confirm.status} \u2014 ${confirm.message || confirm.raw}`);
    return;
  }
  const distId = confirm.data?.distribution?.id ?? null;
  if (distId) CLEAN.distributions.push(distId);

  check(
    confirm.data?.svfRecalculated !== undefined || confirm.data?.svfScores !== undefined,
    "La r\u00e9ponse de confirmation expose le r\u00e9sultat du recalcul",
    JSON.stringify(confirm.data?.svfRecalculated ?? confirm.data?.svfScores),
  );

  // C'\u00e9tait le d\u00e9faut principal : confirmer une distribution ne rejouait AUCUN score.
  let moved = 0;
  for (const line of plan) {
    const id = line.familyId;
    if (!before[id]) continue;
    const now = await scoreOf(id);
    if (Number(now) !== Number(before[id])) moved++;
    check(
      Number(now) <= Number(before[id]) + 0.011,
      `Le score de la famille aid\u00e9e ne remonte pas (${String(id).slice(-6)})`,
      `${before[id]} \u2192 ${now}`,
    );
  }
  check(
    moved === plan.length,
    "TOUS les b\u00e9n\u00e9ficiaires ont vu leur score recalcul\u00e9, pas seulement le premier",
    `${moved}/${plan.length}`,
  );

  // Les instantan\u00e9s doivent conserver le score d'AVANT l'aide : c'est la trace
  // de la d\u00e9cision, elle ne doit pas \u00eatre \u00e9cras\u00e9e par le recalcul.
  const detail = await GET(`/distributions/${distId}`);
  const items = detail.data?.distribution?.items ?? [];
  let snapOk = true;
  for (const it of items) {
    const wanted = before[it.familyId];
    if (wanted === undefined) continue;
    if (Math.abs(Number(it.svfSnapshot) - Number(wanted)) > 0.011) snapOk = false;
  }
  check(snapOk, "L'instantan\u00e9 svfSnapshot garde le score d'AVANT le recalcul");
});

/* --------------------------------------------------------------------------
   T10 \u2014 Validation du paiement : pas de double malus, solde d\u00e9bit\u00e9
   -------------------------------------------------------------------------- */
test("T10", "Validation d'un paiement : solde d\u00e9bit\u00e9, score stable (pas de double malus)", async () => {
  const fam = await createFamily({ monthlyIncome: 5000, membersCount: 3 });
  if (!fam) return;

  await fundMosque(120000);
  const budget = 30000;

  const calc = await POST("/distribution/calculate", {
    totalBudget: budget,
    familyIds: [fam.id],
  });
  const plan = calc.data?.distributions ?? [];
  if (!calc.ok || plan.length === 0) {
    skip("T10 : calcul impossible", `HTTP ${calc.status} \u2014 ${calc.message}`);
    return;
  }

  const confirm = await POST("/distribution/confirm", {
    totalBudget: budget,
    distributions: plan,
  });
  const distId = confirm.data?.distribution?.id ?? null;
  if (!distId) {
    fail("T10 : confirmation impossible", confirm.message || `HTTP ${confirm.status}`);
    return;
  }
  CLEAN.distributions.push(distId);

  const detail = await GET(`/distributions/${distId}`);
  const item = (detail.data?.distribution?.items ?? [])[0];
  if (!item) {
    fail("T10 : ligne introuvable");
    return;
  }
  eq(item.paymentStatus, "PENDING", "La ligne est en attente juste apr\u00e8s la confirmation");

  const scoreAfterConfirm = await scoreOf(fam.id);
  const balBefore = await mosqueBalance();

  const pay = await PUT(`/distributions/${distId}`, {
    itemId: item.id,
    paymentStatus: "PAID",
  });
  if (!pay.ok) {
    fail("Validation du paiement", `HTTP ${pay.status} \u2014 ${pay.message || pay.raw}`);
    return;
  }

  const balAfter = await mosqueBalance();
  near(balAfter, balBefore - Number(item.amount), "Le solde est d\u00e9bit\u00e9 au moment du paiement");

  // Le malus compte d\u00e9j\u00e0 les aides en attente : passer \u00e0 PAY\u00c9 ne doit pas
  // p\u00e9naliser la famille une seconde fois pour la m\u00eame aide.
  const scoreAfterPay = await scoreOf(fam.id);
  stable(scoreAfterConfirm, scoreAfterPay, "Le score ne bouge pas une deuxi\u00e8me fois au paiement");
  check(
    pay.data?.svfScore !== undefined,
    "La r\u00e9ponse renvoie le score \u00e0 jour",
    JSON.stringify(pay.data?.svfScore),
  );

  const detail2 = await GET(`/distributions/${distId}`);
  const item2 = (detail2.data?.distribution?.items ?? []).find((i) => i.id === item.id);
  eq(item2?.paymentStatus, "PAID", "La ligne est bien pass\u00e9e \u00e0 PAID");
  check(Boolean(item2?.paidAt), "La date de paiement est enregistr\u00e9e");
});

/* --------------------------------------------------------------------------
   T11 \u2014 Annulation d'une ligne : le score doit REMONTER
   -------------------------------------------------------------------------- */
test("T11", "Annulation d'une ligne : le malus est retir\u00e9 et le score remonte", async () => {
  const fam = await createFamily({ monthlyIncome: 5000, membersCount: 3 });
  if (!fam) return;

  const scoreOrigin = await scoreOf(fam.id);
  await fundMosque(120000);

  const calc = await POST("/distribution/calculate", {
    totalBudget: 30000,
    familyIds: [fam.id],
  });
  const plan = calc.data?.distributions ?? [];
  if (!calc.ok || plan.length === 0) {
    skip("T11 : calcul impossible", calc.message || `HTTP ${calc.status}`);
    return;
  }
  const confirm = await POST("/distribution/confirm", {
    totalBudget: 30000,
    distributions: plan,
  });
  const distId = confirm.data?.distribution?.id ?? null;
  if (!distId) {
    fail("T11 : confirmation impossible", confirm.message || `HTTP ${confirm.status}`);
    return;
  }
  CLEAN.distributions.push(distId);

  const scoreAfterAid = await scoreOf(fam.id);
  check(
    Number(scoreAfterAid) < Number(scoreOrigin),
    "Le score a bien baiss\u00e9 apr\u00e8s l'aide",
    `${scoreOrigin} \u2192 ${scoreAfterAid}`,
  );

  const detail = await GET(`/distributions/${distId}`);
  const item = (detail.data?.distribution?.items ?? [])[0];
  if (!item) {
    fail("T11 : ligne introuvable");
    return;
  }

  const cancel = await PUT(`/distributions/${distId}`, {
    itemId: item.id,
    paymentStatus: "CANCELLED",
  });
  check(cancel.ok, "Annulation de la ligne accept\u00e9e", cancel.message || `HTTP ${cancel.status}`);

  const scoreAfterCancel = await scoreOf(fam.id);
  near(
    scoreAfterCancel,
    scoreOrigin,
    "Le score revient EXACTEMENT \u00e0 sa valeur d'avant l'aide annul\u00e9e",
  );
  check(
    Number(scoreAfterCancel) > Number(scoreAfterAid),
    "Le score est bien remont\u00e9 apr\u00e8s l'annulation",
    `${scoreAfterAid} \u2192 ${scoreAfterCancel}`,
  );
});

/* --------------------------------------------------------------------------
   T12 \u2014 Annulation de TOUTE la distribution
   -------------------------------------------------------------------------- */
test("T12", "Annulation de la distribution enti\u00e8re : toutes les lignes et tous les scores suivent", async () => {
  const fams = [];
  for (const income of [4000, 9000]) {
    const f = await createFamily({ monthlyIncome: income, membersCount: 3 });
    if (f) fams.push(f);
  }
  if (fams.length < 2) {
    skip("T12 : familles non cr\u00e9\u00e9es");
    return;
  }

  await fundMosque(200000);
  const origin = {};
  for (const f of fams) origin[f.id] = await scoreOf(f.id);

  const calc = await POST("/distribution/calculate", {
    totalBudget: 60000,
    familyIds: fams.map((f) => f.id),
  });
  const plan = calc.data?.distributions ?? [];
  if (!calc.ok || plan.length === 0) {
    skip("T12 : calcul impossible", calc.message || `HTTP ${calc.status}`);
    return;
  }
  const confirm = await POST("/distribution/confirm", {
    totalBudget: 60000,
    distributions: plan,
  });
  const distId = confirm.data?.distribution?.id ?? null;
  if (!distId) {
    fail("T12 : confirmation impossible", confirm.message || `HTTP ${confirm.status}`);
    return;
  }
  CLEAN.distributions.push(distId);

  const cancel = await PUT(`/distributions/${distId}`, { status: "CANCELLED" });
  check(
    cancel.ok,
    "Annulation de la distribution accept\u00e9e",
    cancel.message || `HTTP ${cancel.status}`,
  );

  const detail = await GET(`/distributions/${distId}`);
  const items = detail.data?.distribution?.items ?? [];
  const stillPending = items.filter((i) => i.paymentStatus === "PENDING");
  eq(
    stillPending.length,
    0,
    "Aucune ligne ne reste \u00ab\u00a0en attente\u00a0\u00bb apr\u00e8s l'annulation globale",
  );

  for (const f of fams) {
    const now = await scoreOf(f.id);
    near(
      now,
      origin[f.id],
      `Le score de ${String(f.id).slice(-6)} est restaur\u00e9 apr\u00e8s l'annulation globale`,
    );
  }
});

/* --------------------------------------------------------------------------
   T13 \u2014 Suppression d'une distribution : restauration compl\u00e8te
   -------------------------------------------------------------------------- */
test("T13", "Suppression d'une distribution : solde et scores restaur\u00e9s", async () => {
  const fam = await createFamily({ monthlyIncome: 4500, membersCount: 3 });
  if (!fam) return;

  await fundMosque(120000);
  const scoreOrigin = await scoreOf(fam.id);

  const res = await POST("/distributions", {
    familyId: fam.id,
    amount: 4000,
    note: `${TAG} \u00e0 supprimer`,
  });
  const distId = res.data?.distribution?.id ?? null;
  if (!distId) {
    fail("T13 : aide manuelle impossible", res.message || `HTTP ${res.status}`);
    return;
  }

  const scoreAfterAid = await scoreOf(fam.id);
  const balAfterAid = await mosqueBalance();
  check(
    Number(scoreAfterAid) < Number(scoreOrigin),
    "Le score a baiss\u00e9 avant la suppression",
    `${scoreOrigin} \u2192 ${scoreAfterAid}`,
  );

  const del = await DEL(`/distributions/${distId}`);
  check(del.ok, "Suppression de la distribution accept\u00e9e", del.message || `HTTP ${del.status}`);

  const scoreAfterDel = await scoreOf(fam.id);
  near(scoreAfterDel, scoreOrigin, "Le score est restaur\u00e9 apr\u00e8s la suppression de la distribution");

  const balAfterDel = await mosqueBalance();
  near(balAfterDel, balAfterAid + 4000, "Le solde est recr\u00e9dit\u00e9 du montant supprim\u00e9");

  const gone = await GET(`/distributions/${distId}`);
  check(gone.status === 404, "La distribution supprim\u00e9e n'est plus lisible", `HTTP ${gone.status}`);
});

/* --------------------------------------------------------------------------
   T14 \u2014 Param\u00e8tres : changer un poids doit rejouer TOUTES les familles
   -------------------------------------------------------------------------- */
test("T14", "Changement de param\u00e8tres : toutes les familles sont recalcul\u00e9es", async () => {
  const fam = await createFamily({
    monthlyIncome: 3000,
    membersCount: 3,
    housingStatus: "TENANT",
    housingType: "APARTMENT",
    rentAmount: 8000,
  });
  if (!fam) return;

  const before = await scoreOf(fam.id);
  const s0 = STATE.settings0 || {};
  const baseTenant = Number(s0.pointsIfTenant ?? 10);
  const newTenant = baseTenant === 30 ? 20 : 30;

  const up = await PUT("/settings", { pointsIfTenant: newTenant });
  if (!up.ok) {
    fail("Modification des param\u00e8tres", `HTTP ${up.status} \u2014 ${up.message || up.raw}`);
    return;
  }
  eq(up.data?.settings?.pointsIfTenant, newTenant, "Le param\u00e8tre est bien enregistr\u00e9");
  check(
    Number(up.data?.recalculatedFamilies ?? 0) > 0,
    "L'API indique combien de familles ont \u00e9t\u00e9 recalcul\u00e9es",
    `recalculatedFamilies = ${up.data?.recalculatedFamilies}`,
  );

  const after = await scoreOf(fam.id);
  changed(before, after, "Le score d'une famille locataire suit le nouveau bar\u00e8me");

  // Retour au bar\u00e8me d'origine : le score doit revenir \u00e0 l'identique.
  const back = await PUT("/settings", { pointsIfTenant: baseTenant });
  check(back.ok, "Retour au bar\u00e8me d'origine accept\u00e9", back.message || "");
  const restored = await scoreOf(fam.id);
  near(restored, before, "Le score revient exactement \u00e0 sa valeur initiale");

  // Bornes : une valeur absurde ne doit pas provoquer une erreur serveur.
  const huge = await PUT("/settings", { pointsIfTenant: 999999999999 });
  check(
    huge.status !== 500,
    "Une valeur d\u00e9mesur\u00e9e est refus\u00e9e proprement (pas d'erreur 500)",
    `HTTP ${huge.status} \u2014 ${huge.message}`,
  );
  const neg = await PUT("/settings", { pointsIfTenant: -5 });
  check(
    neg.status !== 500,
    "Une valeur n\u00e9gative est refus\u00e9e proprement (pas d'erreur 500)",
    `HTTP ${neg.status} \u2014 ${neg.message}`,
  );
  await PUT("/settings", { pointsIfTenant: baseTenant });
});

/* --------------------------------------------------------------------------
   T15 \u2014 Familles archiv\u00e9es : exclues du calcul, conserv\u00e9es en base
   -------------------------------------------------------------------------- */
test("T15", "Famille archiv\u00e9e : exclue des distributions mais conserv\u00e9e", async () => {
  const fam = await createFamily({ monthlyIncome: 3000, membersCount: 4 });
  if (!fam) return;

  const arch = await DEL(`/families/${fam.id}?mode=soft`);
  check(arch.ok, "Archivage accept\u00e9", arch.message || `HTTP ${arch.status}`);

  const after = await getFamily(fam.id);
  check(Boolean(after), "La famille archiv\u00e9e existe toujours en base");
  eq(after?.status, "ARCHIVED", "Le statut est bien ARCHIVED (la ligne n'est pas supprim\u00e9e)");

  // Elle ne doit plus appara\u00eetre dans la liste active.
  const active = await GET("/families?status=ACTIVE");
  const inActive = (active.data?.families ?? []).some((f) => f.id === fam.id);
  check(!inActive, "Elle dispara\u00eet de la liste des familles actives");

  // Elle doit rester visible dans la liste archiv\u00e9e.
  const archived = await GET("/families?status=ARCHIVED");
  const inArchived = (archived.data?.families ?? []).some((f) => f.id === fam.id);
  check(inArchived, "Elle reste consultable dans la liste des archiv\u00e9es");

  // Et surtout : elle ne doit plus recevoir d'argent.
  await fundMosque(60000);
  const calc = await POST("/distribution/calculate", {
    totalBudget: 40000,
    familyIds: [fam.id],
  });
  const plan = calc.data?.distributions ?? [];
  const included = plan.some((l) => l.familyId === fam.id);
  check(
    !included || !calc.ok,
    "Une famille archiv\u00e9e n'entre pas dans le calcul de r\u00e9partition",
    calc.ok ? `${plan.length} ligne(s) renvoy\u00e9e(s)` : `HTTP ${calc.status} \u2014 ${calc.message}`,
  );

  // R\u00e9activation : on doit pouvoir la remettre en service.
  const back = await PUT(`/families/${fam.id}`, { status: "ACTIVE" });
  check(back.ok, "R\u00e9activation accept\u00e9e", back.message || `HTTP ${back.status}`);
  const reread = await getFamily(fam.id);
  eq(reread?.status, "ACTIVE", "La famille est de nouveau active");
});

/* --------------------------------------------------------------------------
   T16 \u2014 Sc\u00e9nario complet : la cha\u00eene enti\u00e8re, bout \u00e0 bout
   -------------------------------------------------------------------------- */
test("T16", "Sc\u00e9nario complet : cr\u00e9ation \u2192 membres \u2192 modification \u2192 aide \u2192 annulation", async () => {
  const trace = [];
  const snap = async (label) => {
    const f = await getFamily(fam.id);
    trace.push({
      \u00e9tape: label,
      score: Number(f.svfScore),
      priorit\u00e9: f.priority,
      membres: Number(f.membersCount),
      marital: f.maritalStatus,
    });
    return f;
  };

  const fam = await createFamily({
    monthlyIncome: 7000,
    maritalStatus: "SINGLE",
    membersCount: 1,
    housingStatus: "OWNER",
    housingType: "HOUSE",
  });
  if (!fam) return;

  await snap("cr\u00e9ation");
  await addMember(fam.id, { role: "SPOUSE", dateOfBirth: dobForAge(33) });
  await snap("+ \u00e9poux(se)");
  await addMember(fam.id, { role: "CHILD", dateOfBirth: dobForAge(6) });
  await snap("+ enfant");

  const list = await membersOf(fam.id);
  const head = list.find((m) => m.role === "HEAD");
  if (head) {
    await PUT(`/members/${head.id}`, { hasDisability: true });
    await snap("chef handicap\u00e9");
  }

  await PUT(`/families/${fam.id}`, {
    housingStatus: "TENANT",
    housingType: "APARTMENT",
    rentAmount: 12000,
  });
  await snap("passage locataire");

  await fundMosque(80000);
  const aid = await POST("/distributions", {
    familyId: fam.id,
    amount: 3000,
    note: `${TAG} sc\u00e9nario`,
  });
  const distId = aid.data?.distribution?.id ?? null;
  if (distId) CLEAN.distributions.push(distId);
  await snap("aide re\u00e7ue");

  if (distId) {
    await DEL(`/distributions/${distId}`);
    await snap("aide supprim\u00e9e");
  }

  console.log(z("  Trace du sc\u00e9nario :"));
  for (const t of trace) {
    console.log(
      z(
        `    ${String(t["\u00e9tape"]).padEnd(20)} score=${String(t.score).padStart(6)}  ${String(t["priorit\u00e9"]).padEnd(11)}  membres=${t.membres}  ${t.marital}`,
      ),
    );
  }

  // Toutes les \u00e9tapes doivent avoir produit un score valide et une priorit\u00e9 coh\u00e9rente.
  let allValid = true;
  let allCoherent = true;
  for (const t of trace) {
    if (!Number.isFinite(t.score) || t.score < 0 || t.score > 100) allValid = false;
    if (priorityFromScore(t.score) !== t["priorit\u00e9"]) allCoherent = false;
  }
  check(allValid, "Le score reste dans [0, 100] \u00e0 chaque \u00e9tape du sc\u00e9nario");
  check(allCoherent, "La priorit\u00e9 correspond au score \u00e0 chaque \u00e9tape du sc\u00e9nario");

  const distinct = new Set(trace.map((t) => t.score)).size;
  check(
    distinct >= 3,
    "Le score a r\u00e9ellement suivi les \u00e9v\u00e9nements (au moins 3 valeurs diff\u00e9rentes)",
    `${distinct} valeurs distinctes sur ${trace.length} \u00e9tapes`,
  );

  const first = trace[0].score;
  const last = trace[trace.length - 1].score;
  check(
    last >= first,
    "Apr\u00e8s suppression de l'aide, le score final n'est pas inf\u00e9rieur au score initial",
    `${first} \u2192 ${last}`,
  );
});

/* ==========================================================================
   8. AMOR\u00c7AGE ET NETTOYAGE
   ========================================================================== */

async function resolveMosque() {
  if (CFG.mosque && CFG.mosque !== true) return String(CFG.mosque);

  const wilayas = await GET("/auth/login", { token: null });
  const list = wilayas.data?.wilayas ?? [];
  const found = [];
  for (const w of list) {
    const comms = await GET(`/auth/login?wilaya=${encodeURIComponent(w)}`, { token: null });
    for (const cm of comms.data?.communes ?? []) {
      const ms = await GET(
        `/auth/login?wilaya=${encodeURIComponent(w)}&commune=${encodeURIComponent(cm)}`,
        { token: null },
      );
      for (const m of ms.data?.mosques ?? []) found.push({ ...m, wilaya: w, commune: cm });
    }
  }
  if (found.length === 1) return found[0].id;
  if (found.length === 0) throw new Error("Aucune mosqu\u00e9e trouv\u00e9e sur cette instance.");
  console.log(y("\nPlusieurs mosqu\u00e9es existent. Relancez avec --mosque <id> :"));
  for (const m of found) console.log(`   ${m.id}  ${m.name}  (${m.wilaya} / ${m.commune})`);
  throw new Error("Choix de mosqu\u00e9e requis (--mosque <id>).");
}

async function bootstrap() {
  console.log(c(`\nConnexion \u00e0 ${CFG.base} \u2026`));

  const ping = await GET("/auth/login", { token: null });
  if (ping.status === 0) {
    throw new Error(
      `Application injoignable sur ${CFG.base}. Lancez \`npm run dev\` dans un autre terminal.`,
    );
  }

  if (!CFG.password || CFG.password === true) {
    throw new Error('Mot de passe requis : node test-sync-suite.mjs --password "votre_mdp"');
  }

  STATE.mosqueId = await resolveMosque();
  const login = await POST(
    "/auth/login",
    { mosqueId: STATE.mosqueId, password: CFG.password },
    { token: null },
  );
  if (!login.ok) {
    throw new Error(`\u00c9chec de connexion : HTTP ${login.status} \u2014 ${login.message || login.raw}`);
  }
  STATE.token = login.data?.token ?? null;
  STATE.mosqueName = login.data?.mosque?.name ?? "?";
  if (!STATE.token) throw new Error("Le serveur n'a pas renvoy\u00e9 de jeton de session.");

  const st = await GET("/settings");
  STATE.settings0 = st.data?.settings ?? null;
  STATE.weights = st.data?.svfWeights ?? null;
  STATE.balance0 = await mosqueBalance();

  console.log(g(`Connect\u00e9 \u00e0 \u00ab\u00a0${STATE.mosqueName}\u00a0\u00bb (${STATE.mosqueId})`));
  console.log(z(`Solde initial : ${STATE.balance0}`));
  if (STATE.settings0?.autoCalculateSVF === false) {
    console.log(
      y(
        "ATTENTION : le recalcul automatique du SVF est D\u00c9SACTIV\u00c9 dans les param\u00e8tres.\n" +
          "           Les tests de synchronisation vont \u00e9chouer tant qu'il n'est pas r\u00e9activ\u00e9.",
      ),
    );
  }
}

async function cleanup() {
  if (CFG.keep) {
    console.log(y("\n--keep : les donn\u00e9es de test sont conserv\u00e9es."));
    console.log(z(`  familles : ${CLEAN.families.length}, distributions : ${CLEAN.distributions.length}`));
    return;
  }
  console.log(c("\nNettoyage des donn\u00e9es de test \u2026"));
  let removed = 0;
  let failed = 0;

  for (const id of CLEAN.distributions) {
    const res = await DEL(`/distributions/${id}`);
    res.ok || res.status === 404 ? removed++ : failed++;
  }
  for (const id of CLEAN.families) {
    const res = await DEL(`/families/${id}?mode=hard`);
    res.ok || res.status === 404 ? removed++ : failed++;
  }
  for (const id of CLEAN.donations) {
    const res = await DEL(`/donations/${id}`);
    res.ok || res.status === 404 ? removed++ : failed++;
  }
  for (const id of CLEAN.donors) {
    const res = await DEL(`/donors/${id}`);
    res.ok || res.status === 404 ? removed++ : failed++;
  }

  // Restauration des param\u00e8tres d'origine, pour ne rien laisser d\u00e9r\u00e9gl\u00e9.
  if (STATE.settings0) {
    await PUT("/settings", {
      pointsIfTenant: STATE.settings0.pointsIfTenant,
      autoCalculateSVF: STATE.settings0.autoCalculateSVF,
    });
  }

  const balEnd = await mosqueBalance();
  console.log(z(`  ${removed} \u00e9l\u00e9ment(s) supprim\u00e9(s), ${failed} \u00e9chec(s)`));
  console.log(
    Math.abs(balEnd - STATE.balance0) < 0.011
      ? g(`  Solde restaur\u00e9 : ${balEnd}`)
      : y(`  Solde : ${STATE.balance0} \u2192 ${balEnd} (\u00e9cart ${round2(balEnd - STATE.balance0)})`),
  );
  if (failed > 0) {
    console.log(y("  Reste \u00e9ventuel \u00e0 purger en SQL :"));
    console.log(z(`    DELETE FROM "Family" WHERE "lastName" LIKE '${TAG}%';`));
  }
}

/* ==========================================================================
   9. RAPPORTS
   ========================================================================== */

function buildJson(seconds) {
  const parTest = {};
  for (const rr of RESULTS) {
    parTest[rr.test] = parTest[rr.test] || {
      titre: rr.testTitle,
      PASS: 0,
      FAIL: 0,
      SKIP: 0,
      INFO: 0,
    };
    parTest[rr.test][rr.status] = (parTest[rr.test][rr.status] || 0) + 1;
  }
  return {
    genere: new Date().toISOString(),
    base: CFG.base,
    mosque: { id: STATE.mosqueId, nom: STATE.mosqueName },
    dureeSecondes: Number(seconds),
    requetesHttp: HTTP_CALLS,
    totaux: {
      ...COUNT,
      total: RESULTS.length,
    },
    parTest,
    fatal: FATAL,
    resultats: RESULTS,
  };
}

function buildMarkdown(json) {
  const L = [];
  L.push("# Rapport de synchronisation \u2014 score SVF et donn\u00e9es li\u00e9es");
  L.push("");
  L.push(`- Date : ${json.genere}`);
  L.push(`- Application : ${json.base}`);
  L.push(`- Mosqu\u00e9e : ${json.mosque.nom} (${json.mosque.id})`);
  L.push(`- Dur\u00e9e : ${json.dureeSecondes} s \u2014 ${json.requetesHttp} requ\u00eates HTTP`);
  L.push("");
  L.push(
    `**${json.totaux.PASS} r\u00e9ussites \u00b7 ${json.totaux.FAIL} \u00e9checs \u00b7 ${json.totaux.SKIP} ignor\u00e9s** (${json.totaux.total} v\u00e9rifications)`,
  );
  L.push("");
  L.push("| Test | Intitul\u00e9 | R\u00e9ussites | \u00c9checs |");
  L.push("| --- | --- | --- | --- |");
  for (const [id, s] of Object.entries(json.parTest)) {
    L.push(`| ${id} | ${s.titre} | ${s.PASS || 0} | ${s.FAIL || 0} |`);
  }
  L.push("");
  const fails = RESULTS.filter((x) => x.status === "FAIL");
  if (fails.length) {
    L.push("## \u00c9checs d\u00e9taill\u00e9s");
    L.push("");
    for (const f of fails) {
      L.push(`- **${f.test}** \u2014 ${f.name}`);
      if (f.detail) L.push(`  - ${f.detail}`);
    }
  } else {
    L.push("## Aucun \u00e9chec");
    L.push("");
    L.push(
      "Toutes les d\u00e9pendances test\u00e9es sont synchronis\u00e9es : chaque \u00e9criture rejoue le score SVF, la priorit\u00e9, les champs miroir et le solde.",
    );
  }
  return L.join("\n");
}

/* ==========================================================================
   10. POINT D'ENTR\u00c9E
   ========================================================================== */

async function main() {
  const t0 = Date.now();

  console.log(`\n${C.bold}SUITE DE TESTS \u2014 SYNCHRONISATION DES DONN\u00c9ES${C.reset}`);
  console.log(z(`${TESTS.length} tests d\u00e9clar\u00e9s\n`));

  if (CFG.list) {
    for (const t of TESTS) console.log(`  ${b(t.id)}  ${t.title}`);
    process.exit(0);
  }

  try {
    await bootstrap();
  } catch (e) {
    FATAL = String(e?.message || e);
    console.log(r(`\nERREUR FATALE : ${FATAL}`));
    process.exit(2);
  }

  for (const t of TESTS) {
    if (!selected(t.id)) {
      CUR = { id: t.id, title: t.title };
      skip(`${t.id} ignor\u00e9 (--only / --skip)`);
      continue;
    }
    await guard(t);
  }

  try {
    CUR = { id: "CLEAN", title: "Nettoyage" };
    await cleanup();
  } catch (e) {
    console.log(y(`Nettoyage incomplet : ${String(e?.message || e)}`));
  }

  const seconds = ((Date.now() - t0) / 1000).toFixed(1);
  const json = buildJson(seconds);
  fs.writeFileSync(`${CFG.out}.json`, JSON.stringify(json, null, 2), "utf8");
  fs.writeFileSync(`${CFG.out}.md`, buildMarkdown(json), "utf8");

  console.log(`\n${b("\u2550".repeat(74))}`);
  console.log(`${C.bold}R\u00c9SULTAT${C.reset}`);
  console.log(b("\u2550".repeat(74)));
  console.log(`  ${g("R\u00e9ussites")} : ${COUNT.PASS}`);
  console.log(`  ${r("\u00c9checs")}     : ${COUNT.FAIL}`);
  console.log(`  ${y("Ignor\u00e9s")}    : ${COUNT.SKIP}`);
  console.log(`  ${c("Infos")}      : ${COUNT.INFO}`);
  console.log(z(`  ${seconds} s \u00b7 ${HTTP_CALLS} requ\u00eates HTTP`));
  console.log(z(`  Rapports : ${CFG.out}.json et ${CFG.out}.md`));

  if (COUNT.FAIL > 0) {
    console.log(`\n${r("\u00c9checs :")}`);
    for (const f of RESULTS.filter((x) => x.status === "FAIL")) {
      console.log(`  ${r("\u2022")} [${f.test}] ${f.name}`);
      if (f.detail) console.log(z(`      ${f.detail}`));
    }
  } else {
    console.log(`\n${g("Tout est synchronis\u00e9.")}`);
  }
  console.log("");

  process.exit(COUNT.FAIL > 0 ? 1 : 0);
}

process.on("unhandledRejection", (e) => {
  console.log(r(`\nRejet non g\u00e9r\u00e9 : ${String(e?.stack || e)}`));
});

main().catch((e) => {
  console.log(r(`\nERREUR FATALE : ${String(e?.stack || e)}`));
  process.exit(2);
});
