"use client";
import { Suspense, useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Topbar from "@/components/Topbar";
import { StatCard, Loading, EmptyState, ErrorState } from "@/components/ui";
import { SelectLite } from "@/components/SelectLite";
import { Icon } from "@/components/icons";
import EnvelopeFormModal from "@/components/forms/EnvelopeFormModal";
import EnvelopeDetailModal from "@/components/forms/EnvelopeDetailModal";
import { api } from "@/lib/apiClient";
import { formatDA, formatDate } from "@/lib/format";
import {
  CATEGORY_METADATA,
  PERIOD_METADATA,
  ENVELOPE_CATEGORIES,
  ENVELOPE_PERIODS,
} from "@/lib/envelopes";
import { useTranslations, useLocale } from "next-intl";

function EnvelopesInner() {
  const searchParams = useSearchParams();
  const t = useTranslations("Envelopes");
  const tApp = useTranslations("App");
  const locale = useLocale();
  const isAr = locale === "ar";

  const [envelopes, setEnvelopes] = useState([]);
  const [summary, setSummary] = useState({
    totalAllocated: 0,
    totalSpent: 0,
    totalRemaining: 0,
    warningCount: 0,
    exhaustedCount: 0,
    activeCount: 0,
    closedCount: 0,
    totalCount: 0,
  });

  const [state, setState] = useState({ loading: true, error: "" });
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedPeriod, setSelectedPeriod] = useState("ALL");

  const [showCreateModal, setShowCreateModal] = useState(
    searchParams.get("create") === "1"
  );
  const [editingEnvelope, setEditingEnvelope] = useState(null);
  const [detailEnvelope, setDetailEnvelope] = useState(null);

  const fetchEnvelopes = useCallback(async () => {
    setState({ loading: true, error: "" });
    try {
      const params = new URLSearchParams();
      if (selectedStatus !== "ALL") params.set("status", selectedStatus);
      if (selectedCategory !== "ALL") params.set("category", selectedCategory);
      if (selectedPeriod !== "ALL") params.set("period", selectedPeriod);
      if (search.trim()) params.set("search", search.trim());

      const url = `/envelopes${params.toString() ? `?${params.toString()}` : ""}`;
      const data = await api.get(url);

      setEnvelopes(data.envelopes || []);
      if (data.summary) {
        setSummary(data.summary);
      }
      setState({ loading: false, error: "" });
    } catch (e) {
      setState({ loading: false, error: e.message || "Erreur de chargement" });
    }
  }, [selectedCategory, selectedStatus, selectedPeriod, search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEnvelopes();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchEnvelopes]);

  // Options for filter selects
  const categoryFilterOptions = [
    { value: "ALL", label: t("filters.allCategories") },
    ...ENVELOPE_CATEGORIES.map((c) => ({
      value: c,
      label: isAr ? CATEGORY_METADATA[c]?.arLabel || c : CATEGORY_METADATA[c]?.label || c,
    })),
  ];

  const statusFilterOptions = [
    { value: "ALL", label: t("filters.allStatuses") },
    { value: "ACTIVE", label: t("filters.statusActive") },
    { value: "CLOSED", label: t("filters.statusClosed") },
    { value: "EXHAUSTED", label: t("filters.statusExhausted") },
    { value: "DRAFT", label: t("filters.statusDraft") },
  ];

  const periodFilterOptions = [
    { value: "ALL", label: t("filters.allPeriods") },
    ...ENVELOPE_PERIODS.map((p) => ({
      value: p,
      label: isAr ? PERIOD_METADATA[p]?.arLabel || p : PERIOD_METADATA[p]?.label || p,
    })),
  ];

  return (
    <>
      <Topbar
        title={t("title")}
        subtitle={t("subtitle")}
      />

      <div className="content">
        {/* KPI Summary Cards */}
        <div
          className="grid stat-grid"
          style={{
            marginTop: 0,
            marginBottom: 20,
            gridTemplateColumns: "repeat(4, 1fr)",
          }}
        >
          <StatCard
            icon="wallet"
            iconColor="#06231a"
            iconBg="linear-gradient(135deg,#52b788,#3da574)"
            label={t("kpi.allocated")}
            value={formatDA(summary.totalAllocated)}
            badge={`${summary.activeCount} ${isAr ? "أظرفة نشطة" : "actives"}`}
            badgeType="flat"
          />

          <StatCard
            icon="trendDown"
            iconColor="#fff"
            iconBg="linear-gradient(135deg,#5b8def,#3f6fd0)"
            label={t("kpi.spent")}
            value={formatDA(summary.totalSpent)}
            badge={
              summary.totalAllocated > 0
                ? `${Math.round((summary.totalSpent / summary.totalAllocated) * 100)}% ${isAr ? "مستهلك" : "consommé"}`
                : "0%"
            }
            badgeType="flat"
          />

          <StatCard
            icon="gift"
            iconColor="#fff"
            iconBg={
              summary.totalRemaining < 0
                ? "linear-gradient(135deg,#e9806a,#c94f38)"
                : "linear-gradient(135deg,#10b981,#059669)"
            }
            label={t("kpi.remaining")}
            value={formatDA(summary.totalRemaining)}
            badge={
              summary.totalRemaining < 0
                ? isAr ? "عجز إجمالي" : "Déficit global"
                : isAr ? "رصيد متاح" : "Disponible"
            }
            badgeType={summary.totalRemaining < 0 ? "down" : "up"}
          />

          <StatCard
            icon="alert"
            iconColor="#fff"
            iconBg={
              summary.warningCount + summary.exhaustedCount > 0
                ? "linear-gradient(135deg,#f59e0b,#d97706)"
                : "linear-gradient(135deg,#6b7280,#4b5563)"
            }
            label={isAr ? "تنبيهات الميزانية" : "Alertes & Vigilance"}
            value={`${summary.warningCount + summary.exhaustedCount}`}
            badge={
              summary.exhaustedCount > 0
                ? `${summary.exhaustedCount} ${isAr ? "مستنفد" : "épuisées"}`
                : summary.warningCount > 0
                ? `${summary.warningCount} ${isAr ? "في حالة تنبيه" : "en alerte"}`
                : isAr ? "الوضع مستقر" : "Aucun dépassement"
            }
            badgeType={summary.warningCount + summary.exhaustedCount > 0 ? "down" : "flat"}
          />
        </div>

        {/* Toolbar & Filter Bar */}
        <div className="panel" style={{ padding: "16px 20px", marginBottom: 20 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", flex: 1 }}>
              {/* Search Bar */}
              <div style={{ position: "relative", minWidth: 240, flex: "1 1 240px" }}>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("filters.searchPlaceholder")}
                  style={{
                    width: "100%",
                    paddingInlineStart: 36,
                    height: 38,
                    fontSize: 13,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    transform: "translateY(-50%)",
                    insetInlineStart: 12,
                    color: "var(--muted)",
                    pointerEvents: "none",
                  }}
                >
                  <Icon name="search" size={15} />
                </div>
              </div>

              {/* Category Filter */}
              <div style={{ minWidth: 160 }}>
                <SelectLite
                  value={selectedCategory}
                  onChange={setSelectedCategory}
                  options={categoryFilterOptions}
                />
              </div>

              {/* Status Filter */}
              <div style={{ minWidth: 130 }}>
                <SelectLite
                  value={selectedStatus}
                  onChange={setSelectedStatus}
                  options={statusFilterOptions}
                />
              </div>

              {/* Period Filter */}
              <div style={{ minWidth: 140 }}>
                <SelectLite
                  value={selectedPeriod}
                  onChange={setSelectedPeriod}
                  options={periodFilterOptions}
                />
              </div>

              {(search || selectedCategory !== "ALL" || selectedStatus !== "ALL" || selectedPeriod !== "ALL") && (
                <button
                  type="button"
                  className="btn btn-text"
                  onClick={() => {
                    setSearch("");
                    setSelectedCategory("ALL");
                    setSelectedStatus("ALL");
                    setSelectedPeriod("ALL");
                  }}
                  style={{ fontSize: 12, padding: "6px 10px" }}
                >
                  <Icon name="close" size={14} />
                  {isAr ? "إعادة تعيين" : "Réinitialiser"}
                </button>
              )}
            </div>

            {/* Create CTA Button */}
            <button
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
              style={{ whiteSpace: "nowrap" }}
            >
              <Icon name="plus" size={16} />
              {t("newEnvelope")}
            </button>
          </div>
        </div>

        {/* Envelopes Grid Content */}
        {state.loading && envelopes.length === 0 ? (
          <Loading />
        ) : state.error ? (
          <ErrorState label={state.error} />
        ) : envelopes.length === 0 ? (
          <div
            className="panel"
            style={{
              padding: "48px 24px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "var(--panel-deep)",
                display: "grid",
                placeItems: "center",
                color: "var(--muted)",
              }}
            >
              <Icon name="envelope" size={28} />
            </div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
              {t("empty.title")}
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", maxWidth: 420 }}>
              {t("empty.description")}
            </p>
            <button
              className="btn btn-primary"
              style={{ marginTop: 8 }}
              onClick={() => setShowCreateModal(true)}
            >
              <Icon name="plus" size={16} />
              {t("newEnvelope")}
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: 20,
            }}
          >
            {envelopes.map((env) => {
              const catMeta = CATEGORY_METADATA[env.category] || CATEGORY_METADATA.OTHER;
              const periodMeta = PERIOD_METADATA[env.periodType] || PERIOD_METADATA.ANNUAL;
              const metrics = env.metrics;
              const isClosed = env.status === "CLOSED";
              const isExhausted = metrics.healthState === "EXHAUSTED" || env.status === "EXHAUSTED";
              const isWarning = metrics.healthState === "WARNING" && !isClosed && !isExhausted;

              const cardColor = env.color || catMeta.color || "#3b82f6";

              return (
                <div
                  key={env.id}
                  className="panel"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    padding: 0,
                    overflow: "hidden",
                    borderTop: `4px solid ${cardColor}`,
                    transition: "transform 0.2s, box-shadow 0.2s",
                    cursor: "pointer",
                  }}
                  onClick={() => setDetailEnvelope(env)}
                >
                  <div style={{ padding: "20px 22px 16px" }}>
                    {/* Header Row: Category Badge + Status Badge */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 12,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: `${cardColor}22`,
                          color: cardColor,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: cardColor,
                          }}
                        />
                        {isAr ? catMeta.arLabel : catMeta.label}
                      </span>

                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: isClosed
                            ? "rgba(107, 114, 128, 0.15)"
                            : isExhausted
                            ? "rgba(239, 68, 68, 0.15)"
                            : isWarning
                            ? "rgba(245, 158, 11, 0.15)"
                            : "rgba(16, 185, 129, 0.15)",
                          color: isClosed
                            ? "var(--muted)"
                            : isExhausted
                            ? "#ef4444"
                            : isWarning
                            ? "#f59e0b"
                            : "var(--green-1)",
                        }}
                      >
                        {isClosed
                          ? t("card.closedBadge")
                          : isExhausted
                          ? t("card.exhaustedBadge")
                          : isWarning
                          ? t("card.warningBadge")
                          : t("card.healthyBadge")}
                      </span>
                    </div>

                    {/* Name */}
                    <h4
                      style={{
                        margin: "0 0 4px",
                        fontSize: 16,
                        fontWeight: 700,
                        color: "var(--text)",
                        lineHeight: 1.35,
                      }}
                    >
                      {env.name}
                    </h4>

                    {/* Period Subtitle */}
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--muted)",
                        marginBottom: 16,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span>{isAr ? periodMeta.arLabel : periodMeta.label}</span>
                      <span>•</span>
                      <span>
                        {formatDate(env.startDate)} &rarr; {formatDate(env.endDate)}
                      </span>
                    </div>

                    {/* Financial Figures Row */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 10,
                        padding: "12px 14px",
                        background: "var(--panel-deep)",
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                        marginBottom: 16,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>
                          {t("card.consumed")}
                        </div>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 800,
                            color: metrics.statusColor,
                          }}
                        >
                          {formatDA(env.spentAmount)}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>
                          {t("card.remaining")}
                        </div>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 800,
                            color: metrics.remainingAmount < 0 ? "#ef4444" : "var(--green-1)",
                          }}
                        >
                          {formatDA(metrics.remainingAmount)}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar & Threshold */}
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 11,
                          marginBottom: 6,
                          fontWeight: 600,
                        }}
                      >
                        <span style={{ color: "var(--muted)" }}>
                          {isAr ? "نسبة الصرف" : "Consommation"}
                        </span>
                        <span style={{ color: metrics.statusColor, fontWeight: 700 }}>
                          {metrics.consumedRate}%{" "}
                          <span style={{ color: "var(--muted)", fontWeight: 400 }}>
                            / {formatDA(env.allocatedAmount)}
                          </span>
                        </span>
                      </div>

                      <div
                        style={{
                          position: "relative",
                          width: "100%",
                          height: 8,
                          background: "rgba(255, 255, 255, 0.08)",
                          borderRadius: 4,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.min(metrics.consumedRate, 100)}%`,
                            background: metrics.statusColor,
                            borderRadius: 4,
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginTop: 4,
                          fontSize: 10,
                          color: "var(--muted-2)",
                        }}
                      >
                        <span>0%</span>
                        <span style={{ color: isWarning ? "#f59e0b" : "var(--muted-2)" }}>
                          {t("card.thresholdAlert", { threshold: env.alertThreshold })}
                        </span>
                        <span>100%</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Actions */}
                  <div
                    style={{
                      borderTop: "1px solid var(--border-soft)",
                      padding: "10px 18px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      background: "rgba(0, 0, 0, 0.1)",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="btn btn-text"
                      style={{ fontSize: 12, padding: "4px 8px" }}
                      onClick={() => setDetailEnvelope(env)}
                    >
                      <Icon name="eye" size={14} />
                      {t("card.viewDetails")}
                    </button>

                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 12, padding: "4px 10px" }}
                      onClick={() => setEditingEnvelope(env)}
                    >
                      <Icon name="edit" size={13} />
                      {t("card.edit")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <EnvelopeFormModal
          onClose={() => setShowCreateModal(false)}
          onSaved={fetchEnvelopes}
        />
      )}

      {/* Edit Modal */}
      {editingEnvelope && (
        <EnvelopeFormModal
          envelope={editingEnvelope}
          onClose={() => setEditingEnvelope(null)}
          onSaved={fetchEnvelopes}
        />
      )}

      {/* Detail Modal */}
      {detailEnvelope && (
        <EnvelopeDetailModal
          envelope={detailEnvelope}
          onClose={() => setDetailEnvelope(null)}
          onEdit={(env) => setEditingEnvelope(env)}
          onUpdated={fetchEnvelopes}
          onDeleted={fetchEnvelopes}
        />
      )}
    </>
  );
}

export default function EnvelopesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <EnvelopesInner />
    </Suspense>
  );
}
