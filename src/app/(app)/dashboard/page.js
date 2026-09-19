"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import { StatCard, Loading, ErrorState } from "@/components/ui";
import {
  BarChart,
  DonutChart,
  ClickableChart,
  ChartModal,
} from "@/components/Charts";
import BalanceCard from "@/components/BalanceCard";
import { api, readUser } from "@/lib/apiClient";
import { useTranslations } from "next-intl";
import {
  formatDA,
  formatNumber,
  relativeTime,
  categoryLabel,
  healthState,
} from "@/lib/format";

const MONTH_LABELS = [
  "Janv",
  "Févr",
  "Mars",
  "Avr",
  "Mai",
  "Juin",
  "Juil",
  "Août",
  "Sept",
  "Oct",
  "Nov",
  "Déc",
];

export default function DashboardPage() {
  const router = useRouter();
  const t = useTranslations("App");
  const [state, setState] = useState({ loading: true, error: "" });
  const [stats, setStats] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [social, setSocial] = useState({ difficile: 0, aucun: 0 });
  const [distCount, setDistCount] = useState(0);
  const [recent, setRecent] = useState([]);
  const [openChart, setOpenChart] = useState(null); // "bar" | "donut" | null

  const user = readUser();
  const firstName = user?.firstName || "";

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, m, fams, dists, dons] = await Promise.all([
          api.get("/dashboard/stats"),
          api.get("/dashboard/monthly-summary", { months: 6 }),
          api.get("/families").catch(() => ({ families: [] })),
          api.get("/distributions").catch(() => ({ distributions: [] })),
          api.get("/donations").catch(() => ({ donations: [] })),
        ]);
        if (!alive) return;
        setStats(s);
        setMonthly(
          (m.months || []).map((x) => {
            const mm = Number(x.month.split("-")[1]);
            return {
              label: t(MONTH_LABELS[mm - 1] || x.month),
              received: x.received,
              distributed: x.distributed,
            };
          }),
        );
        setSocial(computeSocial(fams.families || []));
        setDistCount((dists.distributions || []).length);
        setRecent(buildActivity(dons.donations || [], t));
        setState({ loading: false, error: "" });
      } catch (e) {
        if (alive) setState({ loading: false, error: e.message });
      }
    })();
    return () => {
      alive = false;
    };
  }, [t]);

  const socialTotal = social.difficile + social.aucun;
  const pctDifficile = socialTotal
    ? Math.round((social.difficile / socialTotal) * 100)
    : 0;
  const pctAucun = socialTotal ? 100 - pctDifficile : 0;
  const donutSegments = [
    {
      label: t("Difficile"),
      value: social.difficile,
      color: "#e0b341",
      pct: pctDifficile,
    },
    { label: t("Aucun"), value: social.aucun, color: "#52b788", pct: pctAucun },
  ];

  const barLegend = [
    { label: t("Entrées"), color: "#52b788" },
    { label: t("Sorties"), color: "#e9806a" },
  ];

  const subtitle = `${t("Bon retour")}${firstName ? ", " + firstName : ""} \u2014 ${t("voici l'aperçu du jour")}`;

  return (
    <>
      <Topbar title={t("Tableau de bord")} subtitle={subtitle} />
      <div className="content">
        {state.loading ? (
          <Loading label={t("Chargement…")} />
        ) : state.error ? (
          <ErrorState label={state.error} />
        ) : (
          <div className="grid" style={{ gap: 20 }}>
            {/* 0) CURRENT BALANCE — the figure checked before every payout,
                in its own container instead of a badge nobody could read. */}
            <BalanceCard
              balance={stats.balance}
              totalReceived={stats.totalReceived}
              totalDistributed={stats.totalDistributed}
              onAction={() => router.push("/distributions?new=1")}
              actionLabel={t("Nouvelle distribution")}
            />

            {/* 1) QUICK ACTIONS — directly under the top bar */}
            <div className="panel panel-pad">
              <div className="panel-title">{t("Actions Rapides")}</div>
              <div className="qa-grid qa-grid-4" style={{ marginTop: 16 }}>
                <button
                  className="qa"
                  style={{
                    background: "linear-gradient(135deg,#52b788,#3da574)",
                  }}
                  onClick={() => router.push("/dons?add=1")}
                >
                  {t("Ajouter un don")}
                </button>
                <button
                  className="qa"
                  style={{
                    background: "linear-gradient(135deg,#5b8def,#3f6fd0)",
                  }}
                  onClick={() => router.push("/familles?add=1")}
                >
                  {t("Ajouter une famille")}
                </button>
                <button
                  className="qa"
                  style={{
                    background: "linear-gradient(135deg,#e8945a,#d5803b)",
                  }}
                  onClick={() => router.push("/donateurs?add=1")}
                >
                  {t("Ajouter un donateur")}
                </button>
                <button
                  className="qa"
                  style={{
                    background: "linear-gradient(135deg,#9b7bd4,#7d5cc0)",
                  }}
                  onClick={() => router.push("/distributions?new=1")}
                >
                  {t("Nouvelle distribution")}
                </button>
              </div>
            </div>

            {/* 2) STATISTICS */}
            <div className="grid stat-grid">
              <StatCard
                icon="wallet"
                iconColor="#06231a"
                iconBg="linear-gradient(135deg,#52b788,#3da574)"
                label={t("Entrées")}
                value={formatDA(stats.totalReceived)}
                badge={`${formatNumber(stats.donations)} ${t("dons")}`}
                badgeType="flat"
              />
              <StatCard
                icon="families"
                iconColor="#fff"
                iconBg="linear-gradient(135deg,#5b8def,#3f6fd0)"
                label={t("Familles aidées")}
                value={formatNumber(stats.families)}
                badge={`${formatNumber(stats.children)} ${t("enfants")}`}
                badgeType="flat"
              />
              <StatCard
                icon="donors"
                iconColor="#fff"
                iconBg="linear-gradient(135deg,#e8945a,#d5803b)"
                label={t("Donateurs actifs")}
                value={formatNumber(stats.donors)}
                badge={`${formatNumber(stats.donations)} ${t("dons")}`}
                badgeType="flat"
              />
              <StatCard
                icon="distributions"
                iconColor="#fff"
                iconBg="linear-gradient(135deg,#9b7bd4,#7d5cc0)"
                label={t("Distributions")}
                value={formatNumber(distCount)}
                badge={formatDA(stats.totalDistributed)}
                badgeType="flat"
              />
            </div>

            {/* 3) GRAPHS (interactive — click to open popup) */}
            <div className="grid two-col">
              <div className="panel panel-pad">
                <div style={{ display: "flex", alignItems: "center" }}>
                  <div>
                    <div className="panel-title">{t("Entrées / Sorties")}</div>
                    <div
                      className="muted"
                      style={{ fontSize: 12.5, marginTop: 6 }}
                    >
                      {t("6 derniers mois (DA)")}
                    </div>
                  </div>
                  <div
                    style={{
                      marginInlineStart: "auto",
                      display: "flex",
                      gap: 16,
                      fontSize: 12.5,
                    }}
                  >
                    <span
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <span className="dot" style={{ background: "#52b788" }} />{" "}
                      {t("Entrées")}
                    </span>
                    <span
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <span className="dot" style={{ background: "#e9806a" }} />{" "}
                      {t("Sorties")}
                    </span>
                  </div>
                </div>
                <div style={{ marginTop: 14 }}>
                  <ClickableChart onOpen={() => setOpenChart("bar")}>
                    <BarChart data={monthly} />
                  </ClickableChart>
                </div>
              </div>

              <div className="panel panel-pad">
                <div className="panel-title">{t("Situation sociale")}</div>
                <ClickableChart onOpen={() => setOpenChart("donut")}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 20,
                      marginTop: 18,
                    }}
                  >
                    <DonutChart
                      segments={donutSegments}
                      centerTop={`${pctDifficile}%`}
                      centerSub={t("Difficile")}
                    />
                    <div className="legend" style={{ flex: 1 }}>
                      {socialTotal === 0 ? (
                        <div className="muted">
                          {t("Aucune famille enregistrée")}
                        </div>
                      ) : (
                        donutSegments.map((s) => (
                          <div className="legend-row" key={s.label}>
                            <span
                              className="dot"
                              style={{ background: s.color }}
                            />
                            {s.label}
                            <span className="lg-val">{s.pct}%</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </ClickableChart>
              </div>
            </div>

            {/* 4) ACTIVITY FEED */}
            <div className="grid two-col">
              <div className="panel panel-pad">
                <div style={{ display: "flex", alignItems: "center" }}>
                  <div className="panel-title">{t("Activités récentes")}</div>
                  <a
                    className="link"
                    style={{ marginInlineStart: "auto" }}
                    href="/dons"
                  >
                    {t("Tout voir")}
                  </a>
                </div>
                <div className="feed" style={{ marginTop: 8 }}>
                  {recent.length === 0 && (
                    <div className="muted" style={{ padding: "14px 0" }}>
                      {t("Aucune activité récente")}
                    </div>
                  )}
                  {recent.map((r) => (
                    <div className="feed-row" key={r.id}>
                      <div
                        className="feed-ico"
                        style={{ background: r.color }}
                      />
                      <div className="feed-main">
                        <b>{r.title}</b>
                        <span>{r.sub}</span>
                      </div>
                      <div className="feed-time">{r.time}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div />
            </div>
          </div>
        )}
      </div>

      {/* Interactive chart popups */}
      {openChart === "bar" && (
        <ChartModal
          title={t("Entrées / Sorties")}
          legend={barLegend}
          description={t("barChartDescription")}
          onClose={() => setOpenChart(null)}
        >
          <BarChart data={monthly} height={320} />
        </ChartModal>
      )}
      {openChart === "donut" && (
        <ChartModal
          title={t("Situation sociale")}
          legend={donutSegments.map((s) => ({
            label: s.label,
            color: s.color,
            value: `${s.pct}%`,
          }))}
          description={t("donutChartDescription")}
          onClose={() => setOpenChart(null)}
        >
          <DonutChart
            segments={donutSegments}
            size={240}
            thickness={40}
            centerTop={`${pctDifficile}%`}
            centerSub={t("Difficile")}
          />
        </ChartModal>
      )}
    </>
  );
}

function computeSocial(families) {
  let difficile = 0;
  let aucun = 0;
  families.forEach((f) => {
    if (healthState(f) === "good") aucun++;
    else difficile++;
  });
  return { difficile, aucun };
}

function buildActivity(donations, t) {
  return donations.slice(0, 5).map((d) => ({
    id: d.id,
    color:
      d.category === "ZAKAT_MAL" || d.category === "ZAKAT_FITR"
        ? "#e0b341"
        : d.isAnonymous
          ? "#8aa0c8"
          : "#52b788",
    title: t("Nouveau don reçu"),
    sub: `${d.isAnonymous ? t("Anonyme") : d.donor?.name || t("Donateur")} \u2014 ${formatDA(
      d.amount,
    )} \u00b7 ${t(categoryLabel(d.category))}`,
    time: relativeTime(d.receivedAt),
  }));
}
