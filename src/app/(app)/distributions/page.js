"use client";
import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Topbar from "@/components/Topbar";
import { SelectLite } from "@/components/SelectLite";
import { Icon } from "@/components/icons";
import { Loading, ErrorState } from "@/components/ui";

import { formatDA, formatDate } from "@/lib/format";
import { api, clearSession } from "@/lib/apiClient";
import DistributionDetailsModal from "@/components/DistributionDetailsModal";

const PAGE_SIZE = 10;

// Family.priority enum values (see schema.prisma) mapped to pill classes.
const PRIORITY_CLASS = {
  URGENT: "priority-critique",
  VULNERABLE: "priority-high",
  MODERATE: "priority-medium",
  LOW: "priority-low",
};

const STATUS_PILL = {
  DRAFT: "pill-status-pending",
  APPROVED: "blue",
  COMPLETED: "green-ghost",
  CANCELLED: "red",
};

// Mirrors WF_DEFAULTS.wf_reserve in src/lib/waterFilling.js. Used only when
// GET /api/settings is unreachable or has no MosqueSettings row yet, which is
// the same fallback api/distribution/calculate/route.js applies server-side.
const WF_RESERVE_FALLBACK = 0.1;

function DistributionsInner() {
  const t = useTranslations("Distributions");
  const router = useRouter();
  const params = useSearchParams();

  // The dashboard "Nouvelle distribution" quick action links here with ?new=1.
  // Scroll the simulation form into view and focus it so the user lands
  // directly on the action they asked for.
  const simRef = useRef(null);
  const titleInputRef = useRef(null);
  const isNew = params.get("new") === "1";

  const [title, setTitle] = useState("");
  const [budget, setBudget] = useState("");
  const [method, setMethod] = useState("WATER_FILLING");

  // Available balance minus the reserve percentage from Settings, used by
  // the "Max" quick-fill button on the budget field.
  const [maxBudget, setMaxBudget] = useState(null);
  const [loadingMaxBudget, setLoadingMaxBudget] = useState(true);

  const [calcResult, setCalcResult] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState("");
  // Distinguishes "the simulated numbers are stale" (balance changed,
  // family became ineligible, etc.) from a generic failure. This status
  // comes straight from /api/distribution/confirm's 422 response.
  const [staleSimulation, setStaleSimulation] = useState(false);
  const [saving, setSaving] = useState(false);

  const [history, setHistory] = useState([]);
  const [historyState, setHistoryState] = useState({
    loading: true,
    error: "",
  });
  const [page, setPage] = useState(1);

  const [detailsId, setDetailsId] = useState(null);

  // --- Manual distribution mode: search + pick families, set each amount
  // by hand, then save via the same /api/distribution/confirm endpoint
  // (which already supports an explicit `distributions` array + method
  // "MANUAL" -- see distribution/confirm/route.js).
  const [manualSearch, setManualSearch] = useState("");
  const [manualResults, setManualResults] = useState([]);
  const [manualSearching, setManualSearching] = useState(false);
  const [manualRows, setManualRows] = useState([]); // [{familyId, headName, svfScore, priority, dependents, amount}]
  const [manualError, setManualError] = useState("");
  const [savingManual, setSavingManual] = useState(false);
  const manualRequestIdRef = useRef(0);
  const manualInFlightRef = useRef(false);

  // Guards against a fast double-click firing two requests before React
  // re-renders the disabled state on the button.
  const inFlightRef = useRef(false);

  function handleAuthError(err) {
    if (err?.status === 401) {
      clearSession();
      router.replace("/login");
      return true;
    }
    return false;
  }

  const loadHistory = useCallback(async () => {
    setHistoryState({ loading: true, error: "" });
    try {
      const data = await api.get("/distributions");
      setHistory(data.distributions || []);
      setPage(1);
      setHistoryState({ loading: false, error: "" });
    } catch (err) {
      if (handleAuthError(err)) return;
      setHistoryState({
        loading: false,
        error: err.message || t("newSimulation.calcFailed"),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!isNew) return;
    simRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    titleInputRef.current?.focus();
  }, [isNew]);

  // Load the mosque's current balance and reserve percentage once, so the
  // "Max" button can quick-fill the budget field with balance - reserve.
  //
  // The two reads are settled independently on purpose. GET /api/settings can
  // legitimately fail on a database whose columns are behind
  // prisma/schema.prisma (Prisma P2022 ColumnNotFound), and there may be no
  // MosqueSettings row at all on a fresh install. Sharing one Promise.all
  // would throw the balance away too and silently disable the Max button with
  // no way to tell why, so only a failed /auth read disables it.
  useEffect(() => {
    (async () => {
      setLoadingMaxBudget(true);
      const [authRes, settingsRes] = await Promise.allSettled([
        api.get("/auth"),
        api.get("/settings"),
      ]);

      if (authRes.status === "rejected") {
        if (handleAuthError(authRes.reason)) return;
        setMaxBudget(null);
        setLoadingMaxBudget(false);
        return;
      }

      // balance is Decimal(14,2), so it arrives as a JSON string.
      const balance = Number(authRes.value?.mosque?.balance ?? 0);

      // reservePercentage is stored as a FRACTION of the budget, not a
      // percentage: waterFilling.js documents `wf_reserve: 0.1` as 10% and
      // computes `budget * (1 - reserve)`. PUT /api/settings normalises any
      // value above 1 by dividing it by 100, so what comes back is always
      // below 1. Accept both shapes so the Max button stays correct even if
      // a row was written directly to the database.
      const rawReserve =
        settingsRes.status === "fulfilled"
          ? Number(
              settingsRes.value?.settings?.reservePercentage ??
                WF_RESERVE_FALLBACK
            )
          : WF_RESERVE_FALLBACK;
      const reserveFraction =
        Number.isFinite(rawReserve) && rawReserve > 0
          ? rawReserve > 1
            ? rawReserve / 100
            : rawReserve
          : 0;

      const net = balance * (1 - reserveFraction);
      setMaxBudget(Number.isFinite(net) && net > 0 ? Math.floor(net) : 0);
      setLoadingMaxBudget(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced family search for manual mode.
  useEffect(() => {
    const term = manualSearch.trim();
    if (!term) {
      setManualResults([]);
      return;
    }
    const requestId = ++manualRequestIdRef.current;
    const timer = setTimeout(async () => {
      setManualSearching(true);
      try {
        const data = await api.get("/families", { search: term });
        if (requestId !== manualRequestIdRef.current) return;
        const already = new Set(manualRows.map((r) => r.familyId));
        setManualResults(
          (data.families || []).filter((f) => !already.has(f.id))
        );
      } catch (err) {
        if (requestId !== manualRequestIdRef.current) return;
        if (handleAuthError(err)) return;
        setManualResults([]);
      } finally {
        if (requestId === manualRequestIdRef.current) setManualSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualSearch]);

  function handleUseMaxBudget() {
    if (maxBudget === null || maxBudget <= 0) return;
    setBudget(String(maxBudget));
    setCalcError("");
    setStaleSimulation(false);
  }

  function addManualFamily(family) {
    setManualRows((rows) => [
      ...rows,
      {
        familyId: family.id,
        headName: `${family.firstName ?? ""} ${family.lastName ?? ""}`.trim(),
        svfScore: family.svfScore ?? 0,
        priority: family.priority ?? "LOW",
        dependents: family.members?.length ?? 0,
        amount: "",
      },
    ]);
    setManualResults((r) => r.filter((f) => f.id !== family.id));
    setManualSearch("");
    setManualError("");
  }

  function removeManualFamily(familyId) {
    setManualRows((rows) => rows.filter((r) => r.familyId !== familyId));
  }

  function updateManualAmount(familyId, value) {
    setManualRows((rows) =>
      rows.map((r) => (r.familyId === familyId ? { ...r, amount: value } : r))
    );
  }

  function validateBudget(raw) {
    if (raw === "" || raw === null || raw === undefined) {
      return t("newSimulation.invalidBudget");
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) return t("newSimulation.invalidBudget");
    if (n <= 0) return t("newSimulation.invalidBudget");
    // Guard against absurd/garbage input (e.g. pasted long numbers).
    if (n > 1_000_000_000) return t("newSimulation.invalidBudget");
    return null;
  }

  async function handleSimulate() {
    if (inFlightRef.current) return;

    const budgetError = validateBudget(budget);
    if (budgetError) {
      setCalcError(budgetError);
      setStaleSimulation(false);
      return;
    }
    if (method !== "WATER_FILLING") {
      setCalcError(t("newSimulation.manualNotSupported"));
      setStaleSimulation(false);
      return;
    }

    inFlightRef.current = true;
    setCalculating(true);
    setCalcError("");
    setStaleSimulation(false);
    try {
      const data = await api.post("/distribution/calculate", {
        budget: Number(budget),
      });
      setCalcResult(data);
    } catch (err) {
      if (handleAuthError(err)) return;
      setCalcError(err.message || t("newSimulation.calcFailed"));
      setCalcResult(null);
    } finally {
      setCalculating(false);
      inFlightRef.current = false;
    }
  }

  async function handleSave() {
    if (!calcResult || inFlightRef.current) return;

    inFlightRef.current = true;
    setSaving(true);
    try {
      await api.post("/distribution/confirm", {
        title: title || undefined,
        budget: Number(budget),
        method: "WATER_FILLING",
        distributions: calcResult.distributions.map((d) => ({
          familyId: d.familyId,
          amount: d.amount,
        })),
      });
      setCalcResult(null);
      setTitle("");
      setBudget("");
      setStaleSimulation(false);
      loadHistory();
    } catch (err) {
      if (handleAuthError(err)) return;
      // /api/distribution/confirm returns 422 specifically when the mosque
      // balance or family eligibility changed since the simulation was run
      // (e.g. another distribution happened, or a family was deactivated).
      // That's not a "try again with the same data" situation -- the
      // simulated numbers are stale and need to be recomputed.
      if (err?.status === 422) {
        setStaleSimulation(true);
        setCalcError(err.message || t("newSimulation.saveFailed"));
      } else {
        setStaleSimulation(false);
        setCalcError(err.message || t("newSimulation.saveFailed"));
      }
    } finally {
      setSaving(false);
      inFlightRef.current = false;
    }
  }

  const manualTotal = manualRows.reduce(
    (sum, r) => sum + (Number(r.amount) || 0),
    0
  );

  async function handleSaveManual() {
    if (manualInFlightRef.current) return;
    setManualError("");

    if (manualRows.length === 0) {
      setManualError(t("newSimulation.manualNoFamilies"));
      return;
    }
    const invalid = manualRows.find((r) => !(Number(r.amount) > 0));
    if (invalid) {
      setManualError(
        t("newSimulation.manualInvalidAmount", { name: invalid.headName })
      );
      return;
    }
    if (maxBudget !== null && manualTotal > maxBudget) {
      setManualError(
        t("newSimulation.manualOverBudget", {
          total: formatDA(manualTotal),
          max: formatDA(maxBudget),
        })
      );
      return;
    }

    manualInFlightRef.current = true;
    setSavingManual(true);
    try {
      await api.post("/distribution/confirm", {
        title: title || undefined,
        budget: manualTotal,
        method: "MANUAL",
        distributions: manualRows.map((r) => ({
          familyId: r.familyId,
          amount: Number(r.amount),
        })),
      });
      setManualRows([]);
      setTitle("");
      loadHistory();
    } catch (err) {
      if (handleAuthError(err)) return;
      setManualError(err.message || t("newSimulation.saveFailed"));
    } finally {
      setSavingManual(false);
      manualInFlightRef.current = false;
    }
  }

  function handleResimulate() {
    setCalcResult(null);
    setCalcError("");
    setStaleSimulation(false);
    handleSimulate();
  }

  const historyPages = Math.max(1, Math.ceil(history.length / PAGE_SIZE));
  const historySlice = history.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <Topbar title={t("title")} subtitle={t("subtitle")} />

      <div className="content">
        {/* Nouvelle simulation */}
        <div
          ref={simRef}
          className={`panel panel-pad${isNew ? " panel-highlight" : ""}`}
          style={{ marginBottom: 20 }}
        >
          <div className="panel-title" style={{ marginBottom: 18 }}>
            {t("newSimulation.heading")}
          </div>

          <div className="sim-grid">
            <div className="field">
              <label>{t("newSimulation.titleLabel")}</label>
              <input
                ref={titleInputRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("newSimulation.titlePlaceholder")}
              />
            </div>

            <div className="field">
              <label>
                {t("newSimulation.budgetLabel")} <span className="req">*</span>
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="number"
                  min="1"
                  max={maxBudget !== null ? maxBudget : undefined}
                  step="1"
                  value={budget}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      setBudget("");
                      return;
                    }
                    const n = Number(raw);
                    if (
                      maxBudget !== null &&
                      Number.isFinite(n) &&
                      n > maxBudget
                    ) {
                      setBudget(String(maxBudget));
                    } else {
                      setBudget(raw);
                    }
                  }}
                  placeholder={t("newSimulation.budgetPlaceholder")}
                  style={{ paddingInlineEnd: 56 }}
                />
                <button
                  type="button"
                  className="budget-max-btn"
                  onClick={handleUseMaxBudget}
                  disabled={loadingMaxBudget || !maxBudget}
                  title={
                    maxBudget
                      ? `${t("newSimulation.maxBudgetHint")} : ${formatDA(
                          maxBudget
                        )}`
                      : undefined
                  }
                >
                  {t("newSimulation.maxBudget")}
                </button>
              </div>
            </div>

            <div className="field">
              <label>{t("newSimulation.methodLabel")}</label>
              <SelectLite
                value={method}
                onChange={setMethod}
                options={[
                  { value: "WATER_FILLING", label: t("method.WATER_FILLING") },
                  { value: "MANUAL", label: t("method.MANUAL") },
                ]}
              />
            </div>

            {method === "WATER_FILLING" && (
              <button
                className="btn btn-primary"
                onClick={handleSimulate}
                disabled={calculating}
              >
                <Icon name="play" size={16} />{" "}
                {calculating
                  ? t("newSimulation.simulating")
                  : t("newSimulation.simulate")}
              </button>
            )}
          </div>

          {method === "MANUAL" && (
            <div style={{ marginTop: 20 }}>
              <div
                className="field-search"
                style={{ maxWidth: 420, marginBottom: 12 }}
              >
                <span className="s-ico">
                  <Icon name="search" size={16} />
                </span>
                <input
                  value={manualSearch}
                  onChange={(e) => setManualSearch(e.target.value)}
                  placeholder={t("newSimulation.manualSearchPlaceholder")}
                />
              </div>

              {manualSearching && (
                <p className="muted" style={{ fontSize: 13 }}>
                  {t("newSimulation.manualSearching")}
                </p>
              )}

              {manualResults.length > 0 && (
                <div className="manual-results">
                  {manualResults.map((f) => (
                    <button
                      key={f.id}
                      className="manual-result-row"
                      onClick={() => addManualFamily(f)}
                    >
                      <span>
                        <b>
                          {f.firstName} {f.lastName}
                        </b>{" "}
                        <span className="muted" style={{ fontSize: 12.5 }}>
                          SVF {f.svfScore}
                        </span>
                      </span>
                      <Icon name="plus" size={15} />
                    </button>
                  ))}
                </div>
              )}

              {manualRows.length === 0 ? (
                <p className="muted" style={{ fontSize: 13.5 }}>
                  {t("newSimulation.manualEmpty")}
                </p>
              ) : (
                <div className="table-wrap">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>{t("newSimulation.family")}</th>
                        <th>SVF</th>
                        <th>{t("newSimulation.priorityCol")}</th>
                        <th className="num">{t("newSimulation.amount")}</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {manualRows.map((r) => (
                        <tr key={r.familyId}>
                          <td>
                            <div className="cell-family">
                              <b>{r.headName}</b>
                              <span>
                                {t("newSimulation.dependents", {
                                  count: r.dependents,
                                })}
                              </span>
                            </div>
                          </td>
                          <td className="muted">{r.svfScore}</td>
                          <td>
                            <span
                              className={`pill ${
                                PRIORITY_CLASS[r.priority] || "priority-low"
                              }`}
                            >
                              {t(`priority.${r.priority}`, {
                                default: r.priority,
                              })}
                            </span>
                          </td>
                          <td className="num">
                            <input
                              type="number"
                              min="1"
                              value={r.amount}
                              onChange={(e) =>
                                updateManualAmount(r.familyId, e.target.value)
                              }
                              className="manual-amount-input"
                              placeholder="0"
                            />
                          </td>
                          <td>
                            <button
                              className="row-action-btn"
                              onClick={() => removeManualFamily(r.familyId)}
                              title={t("newSimulation.cancel")}
                            >
                              <Icon name="close" size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {manualError && (
                <p style={{ color: "var(--red)", fontSize: 13, marginTop: 12 }}>
                  {manualError}
                </p>
              )}

              {manualRows.length > 0 && (
                <div className="manual-footer">
                  <span className="strong">
                    {t("newSimulation.totalSuggested")}: {formatDA(manualTotal)}
                  </span>
                  <button
                    className="btn btn-primary"
                    onClick={handleSaveManual}
                    disabled={savingManual}
                  >
                    <Icon name="save" size={16} />{" "}
                    {savingManual
                      ? t("newSimulation.saving")
                      : t("newSimulation.save")}
                  </button>
                </div>
              )}
            </div>
          )}

          {calcError && !staleSimulation && (
            <p style={{ color: "var(--red)", fontSize: 13, marginTop: 12 }}>
              {calcError}
            </p>
          )}

          {calcError && staleSimulation && (
            <div
              style={{
                marginTop: 12,
                padding: "12px 14px",
                borderRadius: "var(--radius-sm)",
                background: "var(--yellow-soft)",
                border: "1px solid var(--yellow)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon name="alertTriangle" size={16} />
                <span style={{ fontSize: 13.5 }}>{calcError}</span>
              </div>
              <button className="btn btn-ghost" onClick={handleResimulate} disabled={calculating}>
                <Icon name="refresh" size={15} />{" "}
                {t("newSimulation.resimulate") || "Relancer la simulation"}
              </button>
            </div>
          )}

          {calcResult && calcResult.distributions.length === 0 && (
            <div className="empty-block" style={{ marginTop: 20 }}>
              <div className="empty-icon-circle">
                <Icon name="spread" size={50} strokeWidth={1.3} />
              </div>
              <h4>{t("newSimulation.noEligibleTitle") || "Aucune famille éligible"}</h4>
              <p>
                {t("newSimulation.noEligibleBody") ||
                  "Aucune famille active n'a pu être retenue pour ce budget."}
              </p>
            </div>
          )}

          {calcResult && calcResult.distributions.length > 0 && (
            <>
              <div
                className="mini-stats mini-stats-3"
                style={{ marginTop: 20 }}
              >
                <div className="mini-stat">
                  <div className="label">
                    {t("newSimulation.retainedFamilies")}
                  </div>
                  <div className="value">{calcResult.distributions.length}</div>
                </div>
                <div className="mini-stat">
                  <div className="label">{t("newSimulation.totalBudget")}</div>
                  <div className="value">
                    {formatDA(calcResult.totalBudget)}
                  </div>
                </div>
                <div className="mini-stat">
                  <div className="label">
                    {t("newSimulation.totalSuggested")}
                  </div>
                  <div className="value">
                    {formatDA(calcResult.totalAllocated)}
                  </div>
                </div>
              </div>

              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>{t("newSimulation.family")}</th>
                      <th>SVF</th>
                      <th>{t("newSimulation.priorityCol")}</th>
                      <th className="num">{t("newSimulation.amount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calcResult.distributions.map((row) => (
                      <tr key={row.familyId}>
                        <td>
                          <div className="cell-family">
                            <b>{row.headName}</b>
                            <span>
                              {t("newSimulation.dependents", {
                                count: row.dependents,
                              })}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <div className="svf">
                              <div className="track">
                                <div
                                  className="fill"
                                  style={{
                                    width: `${row.svfScore}%`,
                                    background: "var(--green-1)",
                                  }}
                                />
                              </div>
                            </div>
                            <span className="muted" style={{ fontSize: 13 }}>
                              {row.svfScore}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`pill ${PRIORITY_CLASS[row.priority] || "priority-low"}`}
                          >
                            {t(`priority.${row.priority}`, {
                              default: row.priority,
                            })}
                          </span>
                        </td>
                        <td
                          className="num strong"
                          style={{ color: "var(--green-1)" }}
                        >
                          {formatDA(row.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  marginTop: 18,
                }}
              >
                <button
                  className="btn btn-ghost"
                  onClick={() => setCalcResult(null)}
                  disabled={saving}
                >
                  {t("newSimulation.cancel")}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  <Icon name="save" size={16} />{" "}
                  {saving ? t("newSimulation.saving") : t("newSimulation.save")}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Historique & suivi des paiements */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-pad" style={{ paddingBottom: 0 }}>
            <div className="panel-title">{t("history.heading")}</div>
          </div>

          {historyState.loading ? (
            <Loading />
          ) : historyState.error ? (
            <ErrorState label={historyState.error} />
          ) : history.length === 0 ? (
            <div className="empty-block">
              <div className="empty-icon-circle">
                <Icon name="spread" size={50} strokeWidth={1.3} />
              </div>
              <h4>{t("history.emptyTitle")}</h4>
              <p>{t("history.emptyBody")}</p>
            </div>
          ) : (
            <>
              <div className="table-wrap" style={{ marginTop: 10 }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>{t("history.titleCol")}</th>
                      <th>{t("history.methodCol")}</th>
                      <th>{t("history.budgetCol")}</th>
                      <th>{t("history.distributedCol")}</th>
                      <th>{t("history.statusCol")}</th>
                      <th>{t("history.createdCol")}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {historySlice.map((row) => (
                      <tr key={row.id}>
                        <td className="strong">{row.title}</td>
                        <td>
                          <span className="pill pill-outline">
                            {t(`method.${row.method}`, { default: row.method })}
                          </span>
                        </td>
                        <td
                          className="strong"
                          style={{ color: "var(--green-1)" }}
                        >
                          {formatDA(Number(row.totalBudget))}
                        </td>
                        <td
                          className="strong"
                          style={{ color: "var(--green-1)" }}
                        >
                          {formatDA(Number(row.totalDistributed))}
                        </td>
                        <td>
                          <span
                            className={`pill ${STATUS_PILL[row.status] || "plain"}`}
                          >
                            {t(`status.${row.status}`, { default: row.status })}
                          </span>
                        </td>
                        <td className="muted-2">{formatDate(row.createdAt)}</td>
                        <td>
                          <button
                            className="link-eye"
                            onClick={() => setDetailsId(row.id)}
                          >
                            <Icon name="eye" size={15} /> {t("history.details")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {historyPages > 1 && (
                <div className="pager">
                  <span className="muted" style={{ fontSize: 13 }}>
                    {(page - 1) * PAGE_SIZE + 1}–
                    {Math.min(page * PAGE_SIZE, history.length)} / {history.length}
                  </span>
                  <div className="pages">
                    <button
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <Icon name="chevronLeft" size={15} />
                    </button>
                    {Array.from({ length: historyPages }).map((_, i) => (
                      <button
                        key={i}
                        className={page === i + 1 ? "on" : ""}
                        onClick={() => setPage(i + 1)}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      disabled={page === historyPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <Icon name="chevronRight" size={15} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {detailsId && (
        <DistributionDetailsModal
          distributionId={detailsId}
          onClose={() => setDetailsId(null)}
          onDeleted={() => {
            setDetailsId(null);
            loadHistory();
          }}
          onStatusChange={loadHistory}
        />
      )}
    </>
  );
}

export default function DistributionsPage() {
  // useSearchParams needs a Suspense boundary during prerendering.
  return (
    <Suspense fallback={<Loading />}>
      <DistributionsInner />
    </Suspense>
  );
}