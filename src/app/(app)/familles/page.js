"use client";
import { Suspense, useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Topbar from "@/components/Topbar";
import { Loading, EmptyState, ErrorState, useToast } from "@/components/ui";
import { Icon } from "@/components/icons";
import { SelectLite } from "@/components/SelectLite";
import FamilyFormModal from "@/components/forms/FamilyFormModal";
import MemberFormModal from "@/components/forms/MemberFormModal";
import FamilyDetailModal from "@/components/forms/FamilyDetailModal";
import ConfirmDialog from "@/components/forms/ConfirmDialog";
import {
  formatDA,
  initials,
  maritalLabel,
  healthState,
  HEALTH_COLOR,
  HEALTH_LABEL,
  PRIORITY_LABEL,
  PRIORITY_COLOR,
  svfPercent,
  svfColor,
} from "@/lib/format";
import { api } from "@/lib/apiClient";
import { useTranslations } from "next-intl";

const PAGE_SIZE = 8;

function FamillesInner() {
  const params = useSearchParams();
  const t = useTranslations("App");
  const toast = useToast();
  const [search, setSearch] = useState(params.get("search") || "");
  const [status, setStatus] = useState("ACTIVE");
  const [families, setFamilies] = useState([]);
  const [state, setState] = useState({ loading: true, error: "" });
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(params.get("add") === "1");
  const [memberFor, setMemberFor] = useState(null);
  const [detailFor, setDetailFor] = useState(null);
  const [deleteFor, setDeleteFor] = useState(null);

  // ---- Advanced field filters -------------------------------------------
  // Applied client-side on top of the server text search so the user can
  // combine them freely without extra round-trips.
  const [showFilters, setShowFilters] = useState(false);
  const [health, setHealth] = useState("ALL");
  const [svfOp, setSvfOp] = useState("gte");
  const [svfValue, setSvfValue] = useState("");
  const [incomeOp, setIncomeOp] = useState("lte");
  const [incomeValue, setIncomeValue] = useState("");

  const activeFilterCount =
    (health !== "ALL" ? 1 : 0) +
    (svfValue !== "" ? 1 : 0) +
    (incomeValue !== "" ? 1 : 0);

  function resetFilters() {
    setHealth("ALL");
    setSvfOp("gte");
    setSvfValue("");
    setIncomeOp("lte");
    setIncomeValue("");
  }

  const load = useCallback(async () => {
    setState({ loading: true, error: "" });
    try {
      const data = await api.get("/families", {
        search: search || undefined,
        status: status === "ALL" ? undefined : status,
      });
      setFamilies(data.families || []);
      setPage(1);
      setState({ loading: false, error: "" });
    } catch (e) {
      setState({ loading: false, error: e.message });
    }
  }, [search, status]);

  // ---- Delete a family ---------------------------------------------------
  // Two levels on purpose. Archiving keeps the file and its aid history but
  // removes the family from the lists; permanent deletion erases the family,
  // its members and its documents, and the API refuses it when the family has
  // already received aid (the distribution history must stay readable).
  const removeFamily = useCallback(
    async (fam, mode) => {
      try {
        await api.del(
          `/families/${fam.id}${mode === "hard" ? "?mode=hard" : ""}`,
        );
        toast(mode === "hard" ? t("Famille supprim\u00e9e") : t("Famille archiv\u00e9e"));
        setDeleteFor(null);
        setDetailFor(null);
        await load();
      } catch (e) {
        toast(e.message || t("\u00c9chec de la suppression"), "err");
      }
    },
    [load, t, toast],
  );

  // Undo an archive. The row never left Postgres -- only its status changed --
  // so putting it back to ACTIVE is enough to make the family live again.
  const restoreFamily = useCallback(
    async (fam) => {
      try {
        await api.put(`/families/${fam.id}`, { status: "ACTIVE" });
        toast(t("Famille r\u00e9activ\u00e9e"));
        await load();
      } catch (e) {
        toast(e.message || t("\u00c9chec de la r\u00e9activation"), "err");
      }
    },
    [load, t, toast],
  );

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const filtered = useMemo(() => {
    return families.filter((fam) => {
      // État de santé
      if (health !== "ALL" && healthState(fam) !== health) return false;

      // Score SVF (compared on the same 0-100 scale shown in the table)
      if (svfValue !== "") {
        const threshold = Number(svfValue);
        if (Number.isFinite(threshold)) {
          const pct = svfPercent(fam.svfScore);
          if (svfOp === "gte" ? pct < threshold : pct > threshold) return false;
        }
      }

      // Revenu mensuel
      if (incomeValue !== "") {
        const threshold = Number(incomeValue);
        if (Number.isFinite(threshold)) {
          const income = fam.monthlyIncome;
          // Families with no recorded income can't satisfy a numeric filter.
          if (income == null) return false;
          if (incomeOp === "gte" ? income < threshold : income > threshold)
            return false;
        }
      }

      return true;
    });
  }, [families, health, svfOp, svfValue, incomeOp, incomeValue]);

  // Keep pagination valid when a filter shrinks the result set.
  useEffect(() => {
    setPage(1);
  }, [health, svfOp, svfValue, incomeOp, incomeValue]);

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <Topbar
        title={t("Familles")}
        subtitle={`${total} ${total > 1 ? t("familles enregistrées") : t("famille enregistrée")}`}
      />
      <div className="content">
        <div className="panel">
          <div className="toolbar">
            <div className="field-search">
              <span className="s-ico">
                <Icon name="search" size={16} />
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("Rechercher une famille…")}
              />
            </div>
            <div className="segment">
              {[
                ["ACTIVE", "Actives"],
                // Archived families live here: the API accepts a list of
                // statuses, so "Inactives" means INACTIVE + ARCHIVED.
                ["INACTIVE,ARCHIVED", "Inactives"],
                ["ALL", "Toutes"],
              ].map(([v, l]) => (
                <button
                  key={v}
                  className={status === v ? "on" : ""}
                  onClick={() => setStatus(v)}
                >
                  {t(l)}
                </button>
              ))}
            </div>
            <button
              className={`btn btn-ghost${showFilters || activeFilterCount ? " on" : ""}`}
              style={{ marginInlineStart: "auto" }}
              onClick={() => setShowFilters((v) => !v)}
            >
              <Icon name="sliders" size={16} /> {t("Filtres")}
              {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </button>
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
              <Icon name="plus" size={16} /> {t("Ajouter une famille")}
            </button>
          </div>

          {showFilters && (
            <div className="filter-bar">
              {/* État de santé */}
              <div className="filter-item">
                <label>{t("État de santé")}</label>
                <SelectLite
                  value={health}
                  onChange={setHealth}
                  options={[
                    { value: "ALL", label: t("Tous") },
                    { value: "good", label: t("Bonne") },
                    { value: "warn", label: t("Maladie") },
                    { value: "bad", label: t("Handicap") },
                  ]}
                />
              </div>

              {/* Score SVF  >= / <=  valeur */}
              <div className="filter-item">
                <label>{t("Score SVF")} (%)</label>
                <div className="filter-compare">
                  <SelectLite
                    value={svfOp}
                    onChange={setSvfOp}
                    options={[
                      { value: "gte", label: "≥" },
                      { value: "lte", label: "≤" },
                    ]}
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={svfValue}
                    onChange={(e) => setSvfValue(e.target.value)}
                    placeholder="0 – 100"
                  />
                </div>
              </div>

              {/* Revenu mensuel  >= / <=  montant */}
              <div className="filter-item">
                <label>{t("Revenu mensuel")} (DA)</label>
                <div className="filter-compare">
                  <SelectLite
                    value={incomeOp}
                    onChange={setIncomeOp}
                    options={[
                      { value: "gte", label: "≥" },
                      { value: "lte", label: "≤" },
                    ]}
                  />
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={incomeValue}
                    onChange={(e) => setIncomeValue(e.target.value)}
                    placeholder={t("Montant")}
                  />
                </div>
              </div>

              <button
                className="btn btn-ghost"
                style={{ marginInlineStart: "auto" }}
                onClick={resetFilters}
                disabled={activeFilterCount === 0}
              >
                {t("Réinitialiser")}
              </button>
            </div>
          )}

          {state.loading ? (
            <Loading />
          ) : state.error ? (
            <ErrorState label={state.error} />
          ) : total === 0 ? (
            <EmptyState label={t("Aucune famille trouvée")} />
          ) : (
            <>
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>{t("Famille")}</th>
                      <th>{t("Wilaya")}</th>
                      <th>{t("Situation")}</th>
                      <th>{t("Revenu")}</th>
                      <th>{t("Santé")}</th>
                      <th>{t("Score SVF")}</th>
                      <th>{t("Priorité")}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {slice.map((fam) => {
                      const hs = healthState(fam);
                      const pct = svfPercent(fam.svfScore);
                      const name = `${fam.firstName} ${fam.lastName}`;
                      return (
                        <tr
                          key={fam.id}
                          className="row-click"
                          onClick={() => setDetailFor(fam)}
                          title={t("Voir les d\u00e9tails")}
                        >
                          <td>
                            <div className="cell-name">
                              <div className="avatar sq sm">
                                {initials(name)}
                              </div>
                              <div>
                                {name}
                                {fam.status === "ARCHIVED" && (
                                  <span
                                    className="pill"
                                    style={{
                                      marginInlineStart: 8,
                                      background: "var(--border)",
                                      color: "var(--muted)",
                                      fontSize: 11,
                                    }}
                                  >
                                    {t("Archiv\u00e9e")}
                                  </span>
                                )}
                                <div
                                  className="muted-2"
                                  style={{ fontWeight: 400, fontSize: 12 }}
                                >
                                  CCP {fam.ccp}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="muted">{fam.wilaya}</td>
                          <td className="muted">
                            {t(maritalLabel(fam.maritalStatus))}
                          </td>
                          <td className="muted">
                            {fam.monthlyIncome != null
                              ? formatDA(fam.monthlyIncome)
                              : "—"}
                          </td>
                          <td>
                            <span
                              className="pill"
                              style={{
                                background: HEALTH_COLOR[hs] + "28",
                                color: HEALTH_COLOR[hs],
                              }}
                            >
                              <span
                                className="dot"
                                style={{ background: HEALTH_COLOR[hs] }}
                              />
                              {t(HEALTH_LABEL[hs])}
                            </span>
                          </td>
                          <td>
                            <div className="svf">
                              <div className="val">{pct}%</div>
                              <div className="track">
                                <div
                                  className="fill"
                                  style={{
                                    width: `${pct}%`,
                                    background: svfColor(pct),
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td>
                            {fam.priority ? (
                              <span
                                className="pill"
                                style={{
                                  background:
                                    PRIORITY_COLOR[fam.priority] + "28",
                                  color: PRIORITY_COLOR[fam.priority],
                                }}
                              >
                                {PRIORITY_LABEL[fam.priority]}
                              </span>
                            ) : (
                              <span className="muted-2">—</span>
                            )}
                          </td>
                          <td>
                            <div
                              style={{
                                display: "flex",
                                gap: 6,
                                alignItems: "center",
                              }}
                            >
                              <button
                                className="btn btn-ghost"
                                style={{ padding: "7px 12px", fontSize: 12.5 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMemberFor({
                                    id: fam.id,
                                    name,
                                    lastName: fam.lastName,
                                  });
                                }}
                              >
                                <Icon name="plus" size={14} /> {t("Membre")}
                              </button>
                              {/* An archived family can be brought back:
                                  nothing was deleted, only its status. */}
                              {fam.status !== "ACTIVE" && (
                                <button
                                  className="btn btn-ghost"
                                  title={t("R\u00e9activer la famille")}
                                  aria-label={t("R\u00e9activer la famille")}
                                  style={{
                                    padding: "7px 9px",
                                    color: HEALTH_COLOR.good,
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    restoreFamily(fam);
                                  }}
                                >
                                  <Icon name="refresh" size={14} />
                                </button>
                              )}
                              {/* Deleting is one click away but never happens
                                  without the confirmation dialog. */}
                              <button
                                className="btn btn-ghost"
                                title={t("Supprimer la famille")}
                                aria-label={t("Supprimer la famille")}
                                style={{
                                  padding: "7px 9px",
                                  color: HEALTH_COLOR.bad,
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteFor({ id: fam.id, name });
                                }}
                              >
                                <Icon name="trash" size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="pager">
                <span className="muted" style={{ fontSize: 13 }}>
                  {(page - 1) * PAGE_SIZE + 1}–
                  {Math.min(page * PAGE_SIZE, total)} {t("sur")} {total}
                </span>
                <div className="pages">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <Icon name="chevronLeft" size={15} />
                  </button>
                  {Array.from({ length: pages }).map((_, i) => (
                    <button
                      key={i}
                      className={page === i + 1 ? "on" : ""}
                      onClick={() => setPage(i + 1)}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    disabled={page === pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <Icon name="chevronRight" size={15} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showAdd && (
        <FamilyFormModal onClose={() => setShowAdd(false)} onSaved={load} />
      )}
      {detailFor && (
        <FamilyDetailModal
          family={detailFor}
          onClose={() => setDetailFor(null)}
          onAddMember={(fam) => {
            setDetailFor(null);
            setMemberFor(fam);
          }}
          onDelete={(fam) => setDeleteFor({ id: fam.id, name: fam.name })}
        />
      )}
      {deleteFor && (
        <ConfirmDialog
          title={t("Supprimer la famille")}
          subtitle={deleteFor.name}
          message={t("Voulez-vous vraiment supprimer cette famille ?")}
          warning={
            <>
              {t(
                "Les membres et les documents seront effac\u00e9s d\u00e9finitivement, cette action est irr\u00e9versible",
              )}
              <div style={{ marginTop: 4 }}>
                {t("La famille restera visible dans \u00ab Inactives \u00bb")}
              </div>
            </>
          }
          confirmLabel={t("Supprimer d\u00e9finitivement")}
          secondaryLabel={t("Archiver seulement")}
          onConfirm={() => removeFamily(deleteFor, "hard")}
          onSecondary={() => removeFamily(deleteFor, "soft")}
          onClose={() => setDeleteFor(null)}
        />
      )}
      {memberFor && (
        <MemberFormModal
          familyId={memberFor.id}
          familyName={memberFor.name}
          familyLastName={memberFor.lastName}
          onClose={() => setMemberFor(null)}
          onSaved={load}
        />
      )}
    </>
  );
}

export default function FamillesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <FamillesInner />
    </Suspense>
  );
}
