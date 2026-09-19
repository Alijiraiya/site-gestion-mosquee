"use client";
import { Suspense, useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Topbar from "@/components/Topbar";
import { StatCard, Loading, EmptyState, ErrorState } from "@/components/ui";
import { SelectLite } from "@/components/SelectLite";
import { Icon } from "@/components/icons";
import DonationFormModal from "@/components/forms/DonationFormModal";
import BalanceCard from "@/components/BalanceCard";
import {
  formatDA,
  formatNumber,
  formatDate,
  categoryLabel,
  categoryColor,
  methodLabel,
  initials,
} from "@/lib/format";
import { api } from "@/lib/apiClient";
import { useTranslations } from "next-intl";

const PAGE_SIZE = 9;

function DonsInner() {
  const params = useSearchParams();
  const t = useTranslations("App");
  const [donations, setDonations] = useState([]);
  const [state, setState] = useState({ loading: true, error: "" });
  const [cat, setCat] = useState("ALL");
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(params.get("add") === "1");
  // The balance does not live in /donations: it is the mosque's own column,
  // moved by donations AND by every paid distribution. It has to be read from
  // /dashboard/stats so this page shows exactly the same figure as the
  // dashboard instead of a locally recomputed sum of donations.
  const [stats, setStats] = useState(null);

  const load = useCallback(async () => {
    setState({ loading: true, error: "" });
    try {
      const [data, s] = await Promise.all([
        api.get("/donations"),
        api.get("/dashboard/stats").catch(() => null),
      ]);
      setDonations(data.donations || []);
      setStats(s);
      setState({ loading: false, error: "" });
    } catch (e) {
      setState({ loading: false, error: e.message });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    const total = donations.reduce((s, d) => s + Number(d.amount || 0), 0);
    const now = new Date();
    const monthTotal = donations
      .filter((d) => {
        const dt = new Date(d.receivedAt);
        return (
          dt.getMonth() === now.getMonth() &&
          dt.getFullYear() === now.getFullYear()
        );
      })
      .reduce((s, d) => s + Number(d.amount || 0), 0);
    const avg = donations.length ? Math.round(total / donations.length) : 0;
    return { total, monthTotal, avg, count: donations.length };
  }, [donations]);

  const filtered = useMemo(
    () =>
      cat === "ALL" ? donations : donations.filter((d) => d.category === cat),
    [donations, cat],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => setPage(1), [cat]);

  return (
    <>
      <Topbar title={t("Dons")} subtitle={t("Suivi des contributions reçues")} />
      <div className="content">
        {/* Same container, same figure as the dashboard. */}
        <BalanceCard
          balance={stats?.balance ?? 0}
          totalReceived={stats?.totalReceived}
          totalDistributed={stats?.totalDistributed}
          loading={state.loading || !stats}
          onAction={() => setShowAdd(true)}
          actionLabel={t("Ajouter un don")}
        />

        <div
          className="grid stat-grid"
          style={{
            marginTop: 20,
            marginBottom: 20,
            gridTemplateColumns: "repeat(3,1fr)",
          }}
        >
          <StatCard
            icon="wallet"
            iconColor="#06231a"
            iconBg="linear-gradient(135deg,#52b788,#3da574)"
            label={t("Total collecté")}
            value={formatDA(totals.total)}
            badge={`${formatNumber(totals.count)} ${t("dons")}`}
            badgeType="flat"
          />
          <StatCard
            icon="gift"
            iconColor="#fff"
            iconBg="linear-gradient(135deg,#5b8def,#3f6fd0)"
            label={t("Ce mois-ci")}
            value={formatDA(totals.monthTotal)}
            badge={t("Mois en cours")}
            badgeType="flat"
          />
          <StatCard
            icon="donors"
            iconColor="#fff"
            iconBg="linear-gradient(135deg,#e8945a,#d5803b)"
            label={t("Don moyen")}
            value={formatDA(totals.avg)}
            badge={t("par don")}
            badgeType="flat"
          />
        </div>

        <div className="panel">
          <div className="toolbar">
            <div className="panel-title">{t("Historique des dons")}</div>
            <SelectLite
              value={cat}
              onChange={setCat}
              options={[
                { value: "ALL", label: t("Tous les types") },
                { value: "ZAKAT_MAL", label: "Zakat Mal" },
                { value: "ZAKAT_FITR", label: "Zakat Fitr" },
                { value: "SADAQAH", label: "Sadaqah" },
                { value: "OTHER", label: "Autre" },
              ]}
            />
            <button
              className="btn btn-primary"
              style={{ marginInlineStart: "auto" }}
              onClick={() => setShowAdd(true)}
            >
              <Icon name="plus" size={16} /> {t("Ajouter un don")}
            </button>
          </div>

          {state.loading ? (
            <Loading />
          ) : state.error ? (
            <ErrorState label={state.error} />
          ) : filtered.length === 0 ? (
            <EmptyState label={t("Aucun don enregistré")} />
          ) : (
            <>
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>{t("Donateur")}</th>
                      <th>{t("Type")}</th>
                      <th>{t("Méthode")}</th>
                      <th>{t("Date")}</th>
                      <th className="num">{t("Montant")}</th>
                      <th>{t("Statut")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slice.map((d) => {
                      const donorName = d.isAnonymous
                        ? t("Anonyme")
                        : d.donor?.name || t("Donateur");
                      return (
                        <tr key={d.id}>
                          <td>
                            <div className="cell-name">
                              <div
                                className="avatar sq sm"
                                style={
                                  d.isAnonymous
                                    ? {
                                        background: "#2a3f74",
                                        color: "#97a3c2",
                                      }
                                    : undefined
                                }
                              >
                                {d.isAnonymous ? "?" : initials(donorName)}
                              </div>
                              {donorName}
                            </div>
                          </td>
                          <td>
                            <span
                              className="pill"
                              style={{
                                background: categoryColor(d.category) + "28",
                                color: categoryColor(d.category),
                              }}
                            >
                              <span
                                className="dot"
                                style={{
                                  background: categoryColor(d.category),
                                }}
                              />
                              {t(categoryLabel(d.category))}
                            </span>
                          </td>
                          <td className="muted">
                            {t(methodLabel(d.paymentMethod))}
                          </td>
                          <td className="muted">{formatDate(d.receivedAt)}</td>
                          <td className="num strong">{formatDA(d.amount)}</td>
                          <td>
                            <span className="pill green-ghost">
                              <span
                                className="dot"
                                style={{ background: "#52b788" }}
                              />{" "}
                              {t("Complété")}
                            </span>
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
                  {Math.min(page * PAGE_SIZE, filtered.length)} sur{" "}
                  {filtered.length}
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
        <DonationFormModal onClose={() => setShowAdd(false)} onSaved={load} />
      )}
    </>
  );
}

export default function DonsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <DonsInner />
    </Suspense>
  );
}