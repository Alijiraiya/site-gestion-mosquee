"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Topbar from "@/components/Topbar";
import { Icon } from "@/components/icons";
import { Field, Loading, useToast } from "@/components/ui";
import { api, clearSession, saveSession } from "@/lib/apiClient";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SettingsPage() {
  const t = useTranslations("Settings");
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState("user");

  // Deep links from the topbar profile menu: /settings?tab=user (Profil) and
  // /settings?tab=settings (Param\u00e8tres). The query string is read from
  // window.location rather than useSearchParams so this page keeps rendering
  // without a Suspense boundary. The custom event covers the case where the
  // menu is used while already on /settings: Next.js does not remount the page
  // for a query-only navigation, so the tab would otherwise stay put.
  useEffect(() => {
    const VALID = ["user", "mosque", "settings", "security"];
    const apply = (key) => {
      if (key && VALID.includes(key)) setTab(key);
    };
    apply(new URLSearchParams(window.location.search).get("tab"));
    const onTab = (e) => apply(e.detail);
    window.addEventListener("settings-tab", onTab);
    return () => window.removeEventListener("settings-tab", onTab);
  }, []);

  const TABS = [
    { key: "user", label: t("tabs.user"), icon: "user" },
    { key: "mosque", label: t("tabs.mosque"), icon: "building" },
    { key: "settings", label: t("tabs.settings"), icon: "sliders" },
    { key: "security", label: t("tabs.security"), icon: "shield" },
  ];

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [mosqueName, setMosqueName] = useState("");
  const [wilaya, setWilaya] = useState("");
  const [commune, setCommune] = useState("");
  const [address, setAddress] = useState("");
  const [mosquePhone, setMosquePhone] = useState("");
  const [mosqueEmail, setMosqueEmail] = useState("");
  const [description, setDescription] = useState("");

  // Score SVF
  const [svfMaxScore, setSvfMaxScore] = useState(100);
  const [autoCalculateSVF, setAutoCalculateSVF] = useState(true);

  // Calcul du Score SVF
  const [smigThreshold, setSmigThreshold] = useState(20000);
  const [pointsIfIncomeBelowSMIG, setPointsIfIncomeBelowSMIG] = useState(40);
  const [pointsIfIncomeBelow2xSMIG, setPointsIfIncomeBelow2xSMIG] = useState(25);
  const [pointsIfIncomeBelow3xSMIG, setPointsIfIncomeBelow3xSMIG] = useState(10);
  const [pointsPerChild, setPointsPerChild] = useState(5);
  const [childPointsCap, setChildPointsCap] = useState(20);
  const [pointsIfWidowedDivorced, setPointsIfWidowedDivorced] = useState(15);
  const [pointsIfNoSupport, setPointsIfNoSupport] = useState(20);
  const [pointsIfDisability, setPointsIfDisability] = useState(15);
  const [pointsIfChronicIllness, setPointsIfChronicIllness] = useState(10);
  const [pointsIfTenant, setPointsIfTenant] = useState(10);
  const [malusPerAidReceived, setMalusPerAidReceived] = useState(8);
  const [malusCap, setMalusCap] = useState(25);
  const [seniorAgeThreshold, setSeniorAgeThreshold] = useState(65);
  const [pointsIfSeniorHead, setPointsIfSeniorHead] = useState(10);
  const [youngHeadAgeThreshold, setYoungHeadAgeThreshold] = useState(25);
  const [pointsIfYoungHead, setPointsIfYoungHead] = useState(5);

  // Critères personnalisés
  const [customCriteria, setCustomCriteria] = useState([]);

  // Water-Filling (Distribution)
  const [povertyThreshold, setPovertyThreshold] = useState(20000);
  const [svfWeightExponent, setSvfWeightExponent] = useState(1.5);

  // Règles de distribution
  const [minimumDistributionAmount, setMinimumDistributionAmount] = useState(0);
  const [reservePercentage, setReservePercentage] = useState(0);

  // Dons & validation
  const [allowAnonymousDonations, setAllowAnonymousDonations] = useState(true);

  // Sécurité
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [logOutOtherDevices, setLogOutOtherDevices] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");

  // ============================================================
  // Persistence wiring. The form state above is now hydrated from
  // (and saved back to) the API instead of being presentational only.
  // ============================================================
  function handleAuthError(err) {
    if (err?.status === 401) {
      clearSession();
      router.replace("/login");
      return true;
    }
    return false;
  }

  // --- USER TAB -- GET/PUT /api/auth ---------------------------
  const [loadingUser, setLoadingUser] = useState(true);
  const [userLoadError, setUserLoadError] = useState("");
  const [savingUser, setSavingUser] = useState(false);
  const userInFlightRef = useRef(false);
  const userSnapshotRef = useRef(null);
  const [userDirty, setUserDirty] = useState(false);

  // NOTE: there is no date-of-birth field here on purpose. The User model in
  // this project's schema has no date-of-birth column, so the input was
  // removed from the UI rather than left in place silently failing on save.
  function buildUserPayload() {
    return { firstName, lastName, phone: phone || null, email };
  }

  const loadUser = useCallback(async () => {
    setLoadingUser(true);
    setUserLoadError("");
    try {
      const data = await api.get("/auth");
      setFirstName(data.user.firstName || "");
      setLastName(data.user.lastName || "");
      setPhone(data.user.phone || "");
      setEmail(data.user.email || "");
      userSnapshotRef.current = JSON.stringify({
        firstName: data.user.firstName || "",
        lastName: data.user.lastName || "",
        phone: data.user.phone || null,
        email: data.user.email || "",
      });
      setUserDirty(false);
      setLoadingUser(false);
    } catch (err) {
      if (handleAuthError(err)) return;
      setUserLoadError(err.message || t("loadError"));
      setLoadingUser(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (userSnapshotRef.current === null) return;
    setUserDirty(JSON.stringify(buildUserPayload()) !== userSnapshotRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstName, lastName, phone, email]);

  async function handleSaveUser() {
    if (userInFlightRef.current) return;
    if (!firstName.trim() || !lastName.trim()) {
      toast(t("user.nameRequired"), "err");
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      toast(t("user.emailInvalid"), "err");
      return;
    }

    userInFlightRef.current = true;
    setSavingUser(true);
    try {
      const payload = buildUserPayload();
      const data = await api.put("/auth", payload);
      saveSession({ user: data.user, mosque: data.mosque });
      userSnapshotRef.current = JSON.stringify(payload);
      setUserDirty(false);
      toast(t("user.saved"), "ok");
    } catch (err) {
      if (handleAuthError(err)) return;
      if (err?.status === 409) {
        toast(t("user.emailInUse"), "err");
      } else {
        toast(err.message || t("saveFailed"), "err");
      }
    } finally {
      setSavingUser(false);
      userInFlightRef.current = false;
    }
  }

  // --- MOSQUE TAB -- GET/PUT /api/mosque ----------------------
  const [loadingMosque, setLoadingMosque] = useState(true);
  const [mosqueLoadError, setMosqueLoadError] = useState("");
  const [savingMosque, setSavingMosque] = useState(false);
  const mosqueInFlightRef = useRef(false);
  const mosqueSnapshotRef = useRef(null);
  const [mosqueDirty, setMosqueDirty] = useState(false);

  function buildMosquePayload() {
    return {
      name: mosqueName,
      wilaya,
      commune,
      address,
      phone: mosquePhone,
      email: mosqueEmail,
      description: description || null,
    };
  }

  const loadMosque = useCallback(async () => {
    setLoadingMosque(true);
    setMosqueLoadError("");
    try {
      const data = await api.get("/mosque");
      const m = data.mosque;
      setMosqueName(m.name || "");
      setWilaya(m.wilaya || "");
      setCommune(m.commune || "");
      setAddress(m.address || "");
      setMosquePhone(m.phone || "");
      setMosqueEmail(m.email || "");
      setDescription(m.description || "");
      mosqueSnapshotRef.current = JSON.stringify({
        name: m.name || "",
        wilaya: m.wilaya || "",
        commune: m.commune || "",
        address: m.address || "",
        phone: m.phone || "",
        email: m.email || "",
        description: m.description || null,
      });
      setMosqueDirty(false);
      setLoadingMosque(false);
    } catch (err) {
      if (handleAuthError(err)) return;
      setMosqueLoadError(err.message || t("loadError"));
      setLoadingMosque(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadMosque();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mosqueSnapshotRef.current === null) return;
    setMosqueDirty(
      JSON.stringify(buildMosquePayload()) !== mosqueSnapshotRef.current
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mosqueName,
    wilaya,
    commune,
    address,
    mosquePhone,
    mosqueEmail,
    description,
  ]);

  async function handleSaveMosque() {
    if (mosqueInFlightRef.current) return;
    if (!mosqueName.trim()) {
      toast(t("mosque.nameRequired"), "err");
      return;
    }
    if (mosqueEmail.trim() && !EMAIL_RE.test(mosqueEmail.trim())) {
      toast(t("mosque.emailInvalid"), "err");
      return;
    }

    mosqueInFlightRef.current = true;
    setSavingMosque(true);
    try {
      const payload = buildMosquePayload();
      await api.put("/mosque", payload);
      mosqueSnapshotRef.current = JSON.stringify(payload);
      setMosqueDirty(false);
      toast(t("mosque.saved"), "ok");
    } catch (err) {
      if (handleAuthError(err)) return;
      if (err?.status === 409) {
        toast(t("mosque.emailInUse"), "err");
      } else {
        toast(err.message || t("saveFailed"), "err");
      }
    } finally {
      setSavingMosque(false);
      mosqueInFlightRef.current = false;
    }
  }

  // --- SETTINGS TAB -- GET/PUT /api/settings + reset -----------
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const inFlightRef = useRef(false);
  const loadedSnapshotRef = useRef(null);

  function applySettingsRow(s) {
    setSvfMaxScore(Number(s.svfMaxScore));
    setAutoCalculateSVF(Boolean(s.autoCalculateSVF));
    setSmigThreshold(Number(s.smigThreshold));
    setPointsIfIncomeBelowSMIG(Number(s.pointsIfIncomeBelowSMIG));
    setPointsIfIncomeBelow2xSMIG(Number(s.pointsIfIncomeBelow2xSMIG));
    setPointsIfIncomeBelow3xSMIG(Number(s.pointsIfIncomeBelow3xSMIG));
    setPointsPerChild(Number(s.pointsPerChild));
    setChildPointsCap(Number(s.childPointsCap));
    setPointsIfWidowedDivorced(Number(s.pointsIfWidowedDivorced));
    setPointsIfNoSupport(Number(s.pointsIfNoSupport));
    setPointsIfDisability(Number(s.pointsIfDisability));
    setPointsIfChronicIllness(Number(s.pointsIfChronicIllness));
    setPointsIfTenant(Number(s.pointsIfTenant));
    setMalusPerAidReceived(Number(s.malusPerAidReceived));
    setMalusCap(Number(s.malusCap));
    setSeniorAgeThreshold(Number(s.seniorAgeThreshold));
    setPointsIfSeniorHead(Number(s.pointsIfSeniorHead));
    setYoungHeadAgeThreshold(Number(s.youngHeadAgeThreshold));
    setPointsIfYoungHead(Number(s.pointsIfYoungHead));
    setCustomCriteria(Array.isArray(s.customCriteria) ? s.customCriteria : []);
    setPovertyThreshold(Number(s.povertyThresholdPerPerson));
    setSvfWeightExponent(Number(s.svfWeightExponent));
    setMinimumDistributionAmount(Number(s.minimumDistributionAmount));
    setReservePercentage(Number(s.reservePercentage));
    setAllowAnonymousDonations(Boolean(s.allowAnonymousDonations));
  }

  // Keys here match the allow-lists validated by PUT /api/settings.
  function buildPayload() {
    return {
      svfMaxScore,
      autoCalculateSVF,
      smigThreshold,
      pointsIfIncomeBelowSMIG,
      pointsIfIncomeBelow2xSMIG,
      pointsIfIncomeBelow3xSMIG,
      pointsPerChild,
      childPointsCap,
      pointsIfWidowedDivorced,
      pointsIfNoSupport,
      pointsIfDisability,
      pointsIfChronicIllness,
      pointsIfTenant,
      malusPerAidReceived,
      malusCap,
      seniorAgeThreshold,
      pointsIfSeniorHead,
      youngHeadAgeThreshold,
      pointsIfYoungHead,
      customCriteria,
      povertyThresholdPerPerson: povertyThreshold,
      svfWeightExponent,
      minimumDistributionAmount,
      reservePercentage,
      allowAnonymousDonations,
    };
  }

  // Same shape as buildPayload(), but computed straight from the API row --
  // NOT from React state. applySettingsRow() below only *schedules* its
  // setState calls; reading component state right after calling it (as
  // buildPayload() does) still sees the OLD values because React hasn't
  // re-rendered yet. Using this instead of buildPayload() for the "last
  // saved" snapshot avoids that stale-closure mismatch, which was making
  // the Paramètres tab's unsaved-changes dot show up permanently whenever
  // the loaded settings didn't happen to equal the form's initial defaults.
  function payloadFromRow(s) {
    return {
      svfMaxScore: Number(s.svfMaxScore),
      autoCalculateSVF: Boolean(s.autoCalculateSVF),
      smigThreshold: Number(s.smigThreshold),
      pointsIfIncomeBelowSMIG: Number(s.pointsIfIncomeBelowSMIG),
      pointsIfIncomeBelow2xSMIG: Number(s.pointsIfIncomeBelow2xSMIG),
      pointsIfIncomeBelow3xSMIG: Number(s.pointsIfIncomeBelow3xSMIG),
      pointsPerChild: Number(s.pointsPerChild),
      childPointsCap: Number(s.childPointsCap),
      pointsIfWidowedDivorced: Number(s.pointsIfWidowedDivorced),
      pointsIfNoSupport: Number(s.pointsIfNoSupport),
      pointsIfDisability: Number(s.pointsIfDisability),
      pointsIfChronicIllness: Number(s.pointsIfChronicIllness),
      pointsIfTenant: Number(s.pointsIfTenant),
      malusPerAidReceived: Number(s.malusPerAidReceived),
      malusCap: Number(s.malusCap),
      seniorAgeThreshold: Number(s.seniorAgeThreshold),
      pointsIfSeniorHead: Number(s.pointsIfSeniorHead),
      youngHeadAgeThreshold: Number(s.youngHeadAgeThreshold),
      pointsIfYoungHead: Number(s.pointsIfYoungHead),
      customCriteria: Array.isArray(s.customCriteria) ? s.customCriteria : [],
      povertyThresholdPerPerson: Number(s.povertyThresholdPerPerson),
      svfWeightExponent: Number(s.svfWeightExponent),
      minimumDistributionAmount: Number(s.minimumDistributionAmount),
      reservePercentage: Number(s.reservePercentage),
      allowAnonymousDonations: Boolean(s.allowAnonymousDonations),
    };
  }

  const loadSettings = useCallback(async () => {
    setLoadingSettings(true);
    setLoadError("");
    try {
      const data = await api.get("/settings");
      applySettingsRow(data.settings);
      loadedSnapshotRef.current = JSON.stringify(payloadFromRow(data.settings));
      setDirty(false);
      setLoadingSettings(false);
    } catch (err) {
      if (handleAuthError(err)) return;
      setLoadError(err.message || t("loadError"));
      setLoadingSettings(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loadedSnapshotRef.current === null) return;
    setDirty(JSON.stringify(buildPayload()) !== loadedSnapshotRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    svfMaxScore,
    autoCalculateSVF,
    smigThreshold,
    pointsIfIncomeBelowSMIG,
    pointsIfIncomeBelow2xSMIG,
    pointsIfIncomeBelow3xSMIG,
    pointsPerChild,
    childPointsCap,
    pointsIfWidowedDivorced,
    pointsIfNoSupport,
    pointsIfDisability,
    pointsIfChronicIllness,
    pointsIfTenant,
    malusPerAidReceived,
    malusCap,
    seniorAgeThreshold,
    pointsIfSeniorHead,
    youngHeadAgeThreshold,
    pointsIfYoungHead,
    customCriteria,
    povertyThreshold,
    svfWeightExponent,
    minimumDistributionAmount,
    reservePercentage,
    allowAnonymousDonations,
  ]);

  const anyDirty = userDirty || mosqueDirty || dirty;

  useEffect(() => {
    function onBeforeUnload(e) {
      if (!anyDirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [anyDirty]);

  function tabHasUnsavedChanges(key) {
    if (key === "user") return userDirty;
    if (key === "mosque") return mosqueDirty;
    if (key === "settings") return dirty;
    return false;
  }

  function validatePayload(p) {
    const numericFields = [
      "svfMaxScore",
      "smigThreshold",
      "pointsIfIncomeBelowSMIG",
      "pointsIfIncomeBelow2xSMIG",
      "pointsIfIncomeBelow3xSMIG",
      "pointsPerChild",
      "childPointsCap",
      "pointsIfWidowedDivorced",
      "pointsIfNoSupport",
      "pointsIfDisability",
      "pointsIfChronicIllness",
      "pointsIfTenant",
      "malusPerAidReceived",
      "malusCap",
      "seniorAgeThreshold",
      "pointsIfSeniorHead",
      "youngHeadAgeThreshold",
      "pointsIfYoungHead",
      "povertyThresholdPerPerson",
      "svfWeightExponent",
      "minimumDistributionAmount",
      "reservePercentage",
    ];
    for (const f of numericFields) {
      const v = Number(p[f]);
      if (!Number.isFinite(v) || v < 0) {
        return t("invalidNumberField", { field: f });
      }
    }
    if (Number(p.reservePercentage) > 100) {
      return t("reserveTooHigh");
    }
    if (Number(p.seniorAgeThreshold) <= Number(p.youngHeadAgeThreshold)) {
      return t("seniorAgeMustExceedYoung");
    }
    return null;
  }

  async function handleSavePrefs() {
    if (inFlightRef.current) return;
    const payload = buildPayload();
    const validationError = validatePayload(payload);
    if (validationError) {
      toast(validationError, "err");
      return;
    }

    inFlightRef.current = true;
    setSaving(true);
    try {
      const data = await api.put("/settings", payload);
      applySettingsRow(data.settings);
      loadedSnapshotRef.current = JSON.stringify(payloadFromRow(data.settings));
      setDirty(false);
      toast(
        t("savePrefsSuccess", { count: data.recalculatedFamilies || 0 }),
        "ok"
      );
    } catch (err) {
      if (handleAuthError(err)) return;
      toast(err.message || t("saveFailed"), "err");
    } finally {
      setSaving(false);
      inFlightRef.current = false;
    }
  }

  // --- SECURITY TAB -- password change via PUT /api/auth -------
  const [changingPassword, setChangingPassword] = useState(false);
  const passwordInFlightRef = useRef(false);

  async function handleChangePassword() {
    if (passwordInFlightRef.current) return;
    if (!currentPassword) {
      toast(t("security.currentPasswordRequired"), "err");
      return;
    }
    if (newPassword.length < 8) {
      toast(t("security.passwordTooShort"), "err");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast(t("security.passwordMismatch"), "err");
      return;
    }

    passwordInFlightRef.current = true;
    setChangingPassword(true);
    try {
      const data = await api.put("/auth", {
        currentPassword,
        password: newPassword,
        logOutOtherDevices: logOutOtherDevices || undefined,
      });
      // If other devices were logged out, the server rotated the session
      // token; save the new one so this device stays logged in.
      if (data?.token) saveSession({ token: data.token });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setLogOutOtherDevices(false);
      toast(t("security.passwordChanged"), "ok");
    } catch (err) {
      // Note: a wrong current password also returns 401 from the API, so we
      // must NOT run this through handleAuthError (which would treat it as
      // an expired session, silently log the user out, and redirect to
      // /login -- giving no feedback at all).
      if (err?.status === 401) {
        toast(t("security.currentPasswordIncorrect"), "err");
      } else {
        toast(err.message || t("security.changeFailed"), "err");
      }
    } finally {
      setChangingPassword(false);
      passwordInFlightRef.current = false;
    }
  }

  // --- SECURITY TAB -- standalone "log out other devices" button --------
  const [loggingOutOthers, setLoggingOutOthers] = useState(false);
  const logOutOthersInFlightRef = useRef(false);

  async function handleLogOutOtherDevices() {
    if (logOutOthersInFlightRef.current) return;
    logOutOthersInFlightRef.current = true;
    setLoggingOutOthers(true);
    try {
      const data = await api.put("/auth", { logOutOtherDevices: true });
      if (data?.token) saveSession({ token: data.token });
      toast(t("security.otherDevicesLoggedOut"), "ok");
    } catch (err) {
      if (handleAuthError(err)) return;
      toast(err.message || t("security.changeFailed"), "err");
    } finally {
      setLoggingOutOthers(false);
      logOutOthersInFlightRef.current = false;
    }
  }

  const theoreticalPointsSum =
    pointsIfIncomeBelowSMIG +
    pointsIfIncomeBelow2xSMIG +
    pointsIfIncomeBelow3xSMIG +
    childPointsCap +
    pointsIfWidowedDivorced +
    pointsIfNoSupport +
    pointsIfDisability +
    pointsIfChronicIllness +
    pointsIfTenant +
    pointsIfSeniorHead +
    pointsIfYoungHead;

  // Persisted reset: POST /api/settings/reset restores the stored SVF
  // columns server-side and recalculates every family score. Its response
  // returns { scope, svfWeights, recalculatedFamilies, message } and not a
  // full settings row, so the fresh values are re-fetched afterwards.
  async function resetSvfDefaults() {
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    setResetting(true);
    try {
      const data = await api.post("/settings/reset", { scope: "svf" });
      inFlightRef.current = false;
      await loadSettings();
      toast(
        t("svfCalc.resetSuccess", { count: data.recalculatedFamilies || 0 }),
        "ok"
      );
    } catch (err) {
      if (handleAuthError(err)) return;
      toast(err.message || t("svfCalc.resetFailed"), "err");
    } finally {
      setResetting(false);
      inFlightRef.current = false;
    }
  }

  function addCustomCriterion() {
    setCustomCriteria((c) => [...c, { id: Date.now(), label: "", points: 0 }]);
  }
  function updateCriterion(id, patch) {
    setCustomCriteria((c) => c.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  function removeCriterion(id) {
    setCustomCriteria((c) => c.filter((x) => x.id !== id));
  }

  return (
    <>
      <Topbar title={t("tabs.settings")} subtitle={t("subtitle")} />

      <div className="content">
        <div className="settings-tabs">
          {TABS.map((tItem) => (
            <button
              key={tItem.key}
              className={`settings-tab ${tab === tItem.key ? "active" : ""}`}
              onClick={() => setTab(tItem.key)}
              title={
                tabHasUnsavedChanges(tItem.key)
                  ? t("unsavedChanges")
                  : undefined
              }
            >
              <Icon name={tItem.icon} size={16} />
              {tItem.label}
              {tabHasUnsavedChanges(tItem.key) && (
                <span className="settings-dirty-dot" />
              )}
            </button>
          ))}
        </div>

        {tab === "user" && (
          <div className="panel panel-pad">
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{t("user.heading")}</div>
              <p className="muted" style={{ margin: "4px 0 0", fontSize: 13.5 }}>
                {t("user.subtitle")}
              </p>
            </div>

            {loadingUser && <Loading />}
            {userLoadError && (
              <div className="settings-load-error">
                <span>{userLoadError}</span>
                <button className="btn btn-ghost" onClick={loadUser}>
                  <Icon name="refresh" size={15} /> {t("retry")}
                </button>
              </div>
            )}

            <div className="form-grid">
              <Field label={t("user.lastName")}>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </Field>
              <Field label={t("user.firstName")}>
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </Field>

              <Field label={t("user.phone")}>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Field>
              <Field label={t("user.email")}>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 22 }}>
              <button
                className="btn btn-primary"
                onClick={handleSaveUser}
                disabled={savingUser || loadingUser}
              >
                {savingUser ? t("saving") : t("save")}
              </button>
            </div>
          </div>
        )}

        {tab === "mosque" && (
          <div className="panel panel-pad">
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{t("mosque.heading")}</div>
              <p className="muted" style={{ margin: "4px 0 0", fontSize: 13.5 }}>
                {t("mosque.subtitle")}
              </p>
            </div>

            {loadingMosque && <Loading />}
            {mosqueLoadError && (
              <div className="settings-load-error">
                <span>{mosqueLoadError}</span>
                <button className="btn btn-ghost" onClick={loadMosque}>
                  <Icon name="refresh" size={15} /> {t("retry")}
                </button>
              </div>
            )}

            <div className="form-grid">
              <Field label={t("mosque.name")} full>
                <input value={mosqueName} onChange={(e) => setMosqueName(e.target.value)} />
              </Field>

              <Field label={t("mosque.wilaya")}>
                <input value={wilaya} onChange={(e) => setWilaya(e.target.value)} />
              </Field>
              <Field label={t("mosque.commune")}>
                <input value={commune} onChange={(e) => setCommune(e.target.value)} />
              </Field>

              <Field label={t("mosque.address")} full>
                <input value={address} onChange={(e) => setAddress(e.target.value)} />
              </Field>

              <Field label={t("mosque.phone")}>
                <input value={mosquePhone} onChange={(e) => setMosquePhone(e.target.value)} />
              </Field>
              <Field label={t("mosque.email")}>
                <input
                  type="email"
                  value={mosqueEmail}
                  onChange={(e) => setMosqueEmail(e.target.value)}
                />
              </Field>

              <Field label={t("mosque.description")} full hint={t("mosque.optional")}>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 22 }}>
              <button
                className="btn btn-primary"
                onClick={handleSaveMosque}
                disabled={savingMosque || loadingMosque}
              >
                {savingMosque ? t("saving") : t("save")}
              </button>
            </div>
          </div>
        )}

        {tab === "settings" && (
          <>
            {loadingSettings && <Loading />}
            {loadError && (
              <div className="settings-load-error" style={{ marginBottom: 20 }}>
                <span>{loadError}</span>
                <button className="btn btn-ghost" onClick={loadSettings}>
                  <Icon name="refresh" size={15} /> {t("retry")}
                </button>
              </div>
            )}

            {/* Score SVF */}
            <div className="panel panel-pad" style={{ marginBottom: 20 }}>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{t("svf.heading")}</div>
                <p className="muted" style={{ margin: "4px 0 0", fontSize: 13.5 }}>
                  {t("svf.subtitle")}
                </p>
              </div>

              <div className="form-grid">
                <Field label={t("svf.maxScore")} hint={t("svf.maxScoreHint")}>
                  <input
                    type="number"
                    value={svfMaxScore}
                    onChange={(e) => setSvfMaxScore(Number(e.target.value))}
                  />
                </Field>
                <Field label={t("svf.theoreticalSum")} hint={t("svf.theoreticalSumHint")}>
                  <input value={theoreticalPointsSum} readOnly />
                </Field>
              </div>

              <div className="switch-row" style={{ marginTop: 6 }}>
                <div>
                  <div className="switch-label">{t("svf.auto")}</div>
                  <div className="switch-hint">{t("svf.autoHint")}</div>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={autoCalculateSVF}
                    onChange={(e) => setAutoCalculateSVF(e.target.checked)}
                  />
                  <span className="track" />
                </label>
              </div>
            </div>

            {/* Calcul du Score SVF */}
            <div className="panel panel-pad" style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 18,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{t("svfCalc.heading")}</div>
                  <p className="muted" style={{ margin: "4px 0 0", fontSize: 13.5 }}>
                    {t("svfCalc.subtitle")}
                  </p>
                </div>
                <button
                  className="reset-link"
                  onClick={resetSvfDefaults}
                  disabled={resetting || loadingSettings}
                >
                  <Icon name="refresh" size={16} />
                  <span>
                    {resetting ? t("svfCalc.resetting") : t("svfCalc.reset")}
                  </span>
                </button>
              </div>

              <div className="form-grid">
                <Field label={t("svfCalc.smigThreshold")}>
                  <input
                    type="number"
                    value={smigThreshold}
                    onChange={(e) => setSmigThreshold(Number(e.target.value))}
                  />
                </Field>
                <Field label={t("svfCalc.belowSMIG")}>
                  <input
                    type="number"
                    value={pointsIfIncomeBelowSMIG}
                    onChange={(e) => setPointsIfIncomeBelowSMIG(Number(e.target.value))}
                  />
                </Field>

                <Field label={t("svfCalc.below2xSMIG")}>
                  <input
                    type="number"
                    value={pointsIfIncomeBelow2xSMIG}
                    onChange={(e) => setPointsIfIncomeBelow2xSMIG(Number(e.target.value))}
                  />
                </Field>
                <Field label={t("svfCalc.below3xSMIG")}>
                  <input
                    type="number"
                    value={pointsIfIncomeBelow3xSMIG}
                    onChange={(e) => setPointsIfIncomeBelow3xSMIG(Number(e.target.value))}
                  />
                </Field>

                <Field label={t("svfCalc.perChild")}>
                  <input
                    type="number"
                    value={pointsPerChild}
                    onChange={(e) => setPointsPerChild(Number(e.target.value))}
                  />
                </Field>
                <Field label={t("svfCalc.childCap")}>
                  <input
                    type="number"
                    value={childPointsCap}
                    onChange={(e) => setChildPointsCap(Number(e.target.value))}
                  />
                </Field>

                <Field label={t("svfCalc.widowed")}>
                  <input
                    type="number"
                    value={pointsIfWidowedDivorced}
                    onChange={(e) => setPointsIfWidowedDivorced(Number(e.target.value))}
                  />
                </Field>
                <Field label={t("svfCalc.noSupport")}>
                  <input
                    type="number"
                    value={pointsIfNoSupport}
                    onChange={(e) => setPointsIfNoSupport(Number(e.target.value))}
                  />
                </Field>

                <Field label={t("svfCalc.disability")}>
                  <input
                    type="number"
                    value={pointsIfDisability}
                    onChange={(e) => setPointsIfDisability(Number(e.target.value))}
                  />
                </Field>
                <Field label={t("svfCalc.chronicIllness")}>
                  <input
                    type="number"
                    value={pointsIfChronicIllness}
                    onChange={(e) => setPointsIfChronicIllness(Number(e.target.value))}
                  />
                </Field>

                <Field label={t("svfCalc.tenant")}>
                  <input
                    type="number"
                    value={pointsIfTenant}
                    onChange={(e) => setPointsIfTenant(Number(e.target.value))}
                  />
                </Field>
                <Field label={t("svfCalc.malusPerAid")}>
                  <input
                    type="number"
                    value={malusPerAidReceived}
                    onChange={(e) => setMalusPerAidReceived(Number(e.target.value))}
                  />
                </Field>

                <Field label={t("svfCalc.malusCap")}>
                  <input
                    type="number"
                    value={malusCap}
                    onChange={(e) => setMalusCap(Number(e.target.value))}
                  />
                </Field>
                <Field label={t("svfCalc.seniorAge")}>
                  <input
                    type="number"
                    value={seniorAgeThreshold}
                    onChange={(e) => setSeniorAgeThreshold(Number(e.target.value))}
                  />
                </Field>

                <Field label={t("svfCalc.seniorHead")}>
                  <input
                    type="number"
                    value={pointsIfSeniorHead}
                    onChange={(e) => setPointsIfSeniorHead(Number(e.target.value))}
                  />
                </Field>
                <Field label={t("svfCalc.youngAge")}>
                  <input
                    type="number"
                    value={youngHeadAgeThreshold}
                    onChange={(e) => setYoungHeadAgeThreshold(Number(e.target.value))}
                  />
                </Field>

                <Field label={t("svfCalc.youngHead")}>
                  <input
                    type="number"
                    value={pointsIfYoungHead}
                    onChange={(e) => setPointsIfYoungHead(Number(e.target.value))}
                  />
                </Field>
              </div>
            </div>

            {/* Critères personnalisés */}
            <div className="panel panel-pad" style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{t("customCriteria.heading")}</div>
                  <p className="muted" style={{ margin: "4px 0 0", fontSize: 13.5 }}>
                    {t("customCriteria.subtitle")}
                  </p>
                </div>
                <button className="btn btn-primary" onClick={addCustomCriterion}>
                  <Icon name="plus" size={16} /> {t("customCriteria.add")}
                </button>
              </div>

              {customCriteria.length === 0 ? (
                <p className="muted" style={{ fontSize: 13.5, marginTop: 18, marginBottom: 0 }}>
                  {t("customCriteria.empty")}
                </p>
              ) : (
                <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                  {customCriteria.map((c) => (
                    <div key={c.id} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <input
                        style={{
                          flex: 1,
                          background: "var(--input-bg)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-sm)",
                          padding: "11px 13px",
                          color: "var(--text)",
                        }}
                        placeholder={t("customCriteria.namePlaceholder")}
                        value={c.label}
                        onChange={(e) => updateCriterion(c.id, { label: e.target.value })}
                      />
                      <input
                        type="number"
                        style={{
                          width: 100,
                          background: "var(--input-bg)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-sm)",
                          padding: "11px 13px",
                          color: "var(--text)",
                        }}
                        placeholder={t("customCriteria.pointsPlaceholder")}
                        value={c.points}
                        onChange={(e) => updateCriterion(c.id, { points: Number(e.target.value) })}
                      />
                      <button className="modal-close" onClick={() => removeCriterion(c.id)}>
                        <Icon name="close" size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Water-Filling (Distribution) */}
            <div className="panel panel-pad" style={{ marginBottom: 20 }}>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{t("waterFilling.heading")}</div>
                <p className="muted" style={{ margin: "4px 0 0", fontSize: 13.5 }}>
                  {t("waterFilling.subtitle")}
                </p>
              </div>

              <div className="form-grid">
                <Field label={t("waterFilling.povertyThreshold")} hint={t("waterFilling.povertyThresholdHint")}>
                  <input
                    type="number"
                    value={povertyThreshold}
                    onChange={(e) => setPovertyThreshold(Number(e.target.value))}
                  />
                </Field>
                <Field label={t("waterFilling.weightExponent")} hint={t("waterFilling.weightExponentHint")}>
                  <input
                    type="number"
                    step="0.1"
                    value={svfWeightExponent}
                    onChange={(e) => setSvfWeightExponent(Number(e.target.value))}
                  />
                </Field>
              </div>
            </div>

            {/* Règles de distribution */}
            <div className="panel panel-pad" style={{ marginBottom: 20 }}>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{t("distributionRules.heading")}</div>
              </div>

              <div className="form-grid">
                <Field label={t("distributionRules.minAmount")}>
                  <input
                    type="number"
                    value={minimumDistributionAmount}
                    onChange={(e) => setMinimumDistributionAmount(Number(e.target.value))}
                  />
                </Field>
                <Field label={t("distributionRules.reserve")} hint={t("distributionRules.reserveHint")}>
                  <input
                    type="number"
                    value={reservePercentage}
                    onChange={(e) => setReservePercentage(Number(e.target.value))}
                  />
                </Field>
              </div>
            </div>

            {/* Dons & validation */}
            <div className="panel panel-pad" style={{ marginBottom: 20 }}>
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{t("donationsValidation.heading")}</div>
              </div>

              <div className="switch-row">
                <div>
                  <div className="switch-label">{t("donationsValidation.anonymous")}</div>
                  <div className="switch-hint">{t("donationsValidation.anonymousHint")}</div>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={allowAnonymousDonations}
                    onChange={(e) => setAllowAnonymousDonations(e.target.checked)}
                  />
                  <span className="track" />
                </label>
              </div>

            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                className="btn btn-primary"
                onClick={handleSavePrefs}
                disabled={saving || loadingSettings || resetting}
              >
                {saving ? t("saving") : t("savePrefs")}
              </button>
            </div>
          </>
        )}

        {tab === "security" && (
          <>
            <div className="panel panel-pad" style={{ marginBottom: 20 }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{t("security.passwordHeading")}</div>
                <p className="muted" style={{ margin: "4px 0 0", fontSize: 13.5 }}>
                  {t("security.passwordSubtitle")}
                </p>
              </div>

              <div className="form-grid" style={{ marginBottom: 6 }}>
                <Field label={t("security.currentPassword")} full required>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </Field>
                <Field label={t("security.newPassword")}>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </Field>
                <Field label={t("security.confirmPassword")}>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </Field>
              </div>

              <div className="switch-row">
                <div>
                  <div className="switch-label">{t("security.logOutOthers")}</div>
                  <div className="switch-hint">{t("security.logOutOthersHint")}</div>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={logOutOtherDevices}
                    onChange={(e) => setLogOutOtherDevices(e.target.checked)}
                  />
                  <span className="track" />
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
                <button
                  className="btn btn-primary"
                  onClick={handleChangePassword}
                  disabled={changingPassword}
                >
                  {changingPassword
                    ? t("security.changing")
                    : t("security.changePassword")}
                </button>
              </div>
            </div>

            <div className="panel panel-pad">
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{t("security.sessionHeading")}</div>
                <p className="muted" style={{ margin: "4px 0 0", fontSize: 13.5 }}>
                  {t("security.sessionSubtitle")}
                </p>
              </div>

              <button
                className="btn btn-ghost"
                onClick={handleLogOutOtherDevices}
                disabled={loggingOutOthers}
              >
                <Icon name="logout" size={16} />{" "}
                {loggingOutOthers
                  ? t("security.loggingOutOthers")
                  : t("security.logOutOthersBtn")}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}