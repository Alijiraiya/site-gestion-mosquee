"use client";
import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Topbar from "@/components/Topbar";
import { Loading, EmptyState, ErrorState, StatCard } from "@/components/ui";
import { SelectLite } from "@/components/SelectLite";
import { Icon } from "@/components/icons";
import { formatDA, formatDate, initials } from "@/lib/format";
import { api, clearSession } from "@/lib/apiClient";
import { imgMosqueLogo } from "@/lib/utils";
import DonorFormModal from "@/components/forms/DonorFormModal";

const PAGE_SIZE = 9;

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfPrevMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1);
}

// Defensive helpers -- API data can have nulls (missing name, malformed
// numbers, missing dates) that would otherwise crash rendering or sorting.
function safeAmount(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function safeDateValue(v) {
  const d = new Date(v);
  return isNaN(d) ? 0 : d.getTime();
}
function safeDateLabel(v) {
  const d = new Date(v);
  return isNaN(d) ? "—" : formatDate(v);
}

function DonateursInner() {
  const t = useTranslations("Donors");
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("search") || "");
  const [type, setType] = useState("ALL");
  const [sort, setSort] = useState("recent");
  const [donors, setDonors] = useState([]);
  const [state, setState] = useState({ loading: true, error: "" });
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(params.get("add") === "1");
  const [statsError, setStatsError] = useState(false);

  const [stats, setStats] = useState({
    thisMonthTotal: null,
    lastMonthTotal: null,
    newDonorsThisMonth: null,
    newDonorsLastMonth: null,
  });

  const TYPE_LABEL = {
    INDIVIDUAL: t("types.individual"),
    ORGANIZATION: t("types.organization"),
  };

  // Prevents "setState on unmounted component" if the user navigates away
  // while a request is still in flight.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  function handleAuthError(err) {
    if (err?.status === 401) {
      clearSession();
      router.replace("/login");
      return true;
    }
    return false;
  }

  // Tracks the most recent request so a slow, stale response can't overwrite
  // fresher results if the user typed again before it resolved.
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setState({ loading: true, error: "" });
    try {
      const data = await api.get("/donors", {
        search: search || undefined,
        donorType: type === "ALL" ? undefined : type,
      });
      if (!mountedRef.current) return;
      if (requestId !== requestIdRef.current) return; // a newer request won
      setDonors(data.donors || []);
      setPage(1);
      setState({ loading: false, error: "" });
    } catch (err) {
      if (!mountedRef.current) return;
      if (requestId !== requestIdRef.current) return;
      if (handleAuthError(err)) return;
      setState({ loading: false, error: err.message || "Erreur de chargement." });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, type]);

  useEffect(() => {
    const t2 = setTimeout(load, 250);
    return () => clearTimeout(t2);
  }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const thisStart = startOfMonth(now);
        const prevStart = startOfPrevMonth(now);

        const [thisMonthRes, lastMonthRes, allDonorsRes] = await Promise.all([
          api.get("/donations", { from: thisStart.toISOString(), to: now.toISOString() }),
          api.get("/donations", { from: prevStart.toISOString(), to: thisStart.toISOString() }),
          api.get("/donors", {}),
        ]);

        if (!mountedRef.current) return;

        const thisMonthTotal = (thisMonthRes.donations || []).reduce(
          (sum, d) => sum + safeAmount(d.amount),
          0
        );
        const lastMonthTotal = (lastMonthRes.donations || []).reduce(
          (sum, d) => sum + safeAmount(d.amount),
          0
        );

        const allDonors = allDonorsRes.donors || [];
        const newDonorsThisMonth = allDonors.filter(
          (d) => d.createdAt && new Date(d.createdAt) >= thisStart
        ).length;
        const newDonorsLastMonth = allDonors.filter(
          (d) => d.createdAt && new Date(d.createdAt) >= prevStart && new Date(d.createdAt) < thisStart
        ).length;

        setStats({ thisMonthTotal, lastMonthTotal, newDonorsThisMonth, newDonorsLastMonth });
        setStatsError(false);
      } catch (err) {
        if (!mountedRef.current) return;
        if (handleAuthError(err)) return;
        // Stats are supplementary -- don't block the page, but surface that
        // they failed instead of leaving "…" forever with no explanation.
        setStatsError(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sorted = [...donors].sort((a, b) => {
    if (sort === "amount") return safeAmount(b.totalDonated) - safeAmount(a.totalDonated);
    if (sort === "name") return (a.name || "").localeCompare(b.name || "");
    return safeDateValue(b.updatedAt) - safeDateValue(a.updatedAt);
  });

  const total = sorted.length;
  const totalAmount = sorted.reduce((sum, d) => sum + safeAmount(d.totalDonated), 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const slice = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const monthPct =
    stats.lastMonthTotal != null && stats.lastMonthTotal > 0
      ? Math.round(((stats.thisMonthTotal - stats.lastMonthTotal) / stats.lastMonthTotal) * 100)
      : null;
  const newDonorsDelta =
    stats.newDonorsThisMonth != null && stats.newDonorsLastMonth != null
      ? stats.newDonorsThisMonth - stats.newDonorsLastMonth
      : null;
  const avgContribution = total > 0 ? totalAmount / total : 0;

  // Exports the currently filtered/sorted donor list (search + type filter +
  // sort applied, all pages -- not just the visible slice) as a PDF file,
  // styled to match the app's light-mode look (white panels, dark navy text,
  // green accent) rather than a generic report. jsPDF + autoTable are
  // dynamically imported so they never end up in the main bundle.
  async function handleExport() {
    if (sorted.length === 0) return;

    const [{ default: jsPDF }, autoTableModule] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const autoTable = autoTableModule.default;

    // Site light-mode palette (see globals.css [data-theme="light"]) so the
    // export reads as part of the product, not a generic export.
    const COLOR_TEXT = [27, 33, 48]; // --text
    const COLOR_MUTED = [121, 131, 154]; // --muted
    const COLOR_MUTED_2 = [170, 178, 194]; // --muted-2
    const COLOR_BORDER = [228, 232, 238]; // --border
    const COLOR_HEAD_BG = [246, 247, 249]; // light-mode table head bg
    const COLOR_ROW_ALT = [247, 248, 250]; // light-mode row hover/alt bg
    const COLOR_GREEN = [82, 183, 136]; // --green-1
    const COLOR_GREEN_DARK = [61, 165, 116]; // --green-2

    const headers = [
      t("table.donor"),
      t("table.contact"),
      t("table.type"),
      t("table.totalGiven"),
      t("table.date"),
    ];

    const rows = sorted.map((d) => {
      const contact = [d.phone, d.email].filter(Boolean).join(" / ") || "—";
      return [
        d.name || "—",
        contact,
        TYPE_LABEL[d.donorType] || d.donorType || "—",
        formatDA(safeAmount(d.totalDonated)),
        safeDateLabel(d.updatedAt),
      ];
    });

    // Load the mosque logo as a data URL so jsPDF can embed it. Falls back to
    // a text-only header if it can't be fetched for any reason.
    async function loadLogoDataUrl() {
      try {
        const res = await fetch(imgMosqueLogo);
        const blob = await res.blob();
        return await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch {
        return null;
      }
    }
    const logoDataUrl = await loadLogoDataUrl();

    const doc = new jsPDF({ orientation: "landscape", unit: "pt" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 40;
    const today = new Date().toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    // Full-bleed off-white page background so it isn't stark printer-white,
    // matching --bg-2 in the app.
    doc.setFillColor(248, 249, 250);
    doc.rect(0, 0, pageWidth, pageHeight, "F");

    // Header: logo, title, today's date top-right.
    let titleX = marginX;
    if (logoDataUrl) {
      const logoSize = 30;
      doc.addImage(logoDataUrl, "PNG", marginX, 26, logoSize, logoSize);
      titleX = marginX + logoSize + 12;
    }
    doc.setTextColor(...COLOR_TEXT);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(t("title"), titleX, 47);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(today, pageWidth - marginX, 34, { align: "right" });

    // Thin green accent rule under the header, echoing the app's accent color.
    doc.setDrawColor(...COLOR_GREEN);
    doc.setLineWidth(1.5);
    doc.line(marginX, 68, pageWidth - marginX, 68);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(
      t("summary", { count: total, total: formatDA(totalAmount) }),
      marginX,
      84,
    );

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 98,
      margin: { left: marginX, right: marginX },
      styles: {
        fontSize: 9.5,
        cellPadding: 8,
        textColor: COLOR_TEXT,
        lineColor: COLOR_BORDER,
        lineWidth: 0.5,
      },
      headStyles: {
        fillColor: COLOR_HEAD_BG,
        textColor: COLOR_MUTED_2,
        fontStyle: "bold",
        fontSize: 8.5,
        halign: "left",
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
      },
      alternateRowStyles: {
        fillColor: COLOR_ROW_ALT,
      },
      // "Total donné" reads as a highlighted green amount, same accent used
      // throughout the app for positive/donation figures.
      columnStyles: {
        3: { textColor: COLOR_GREEN_DARK, fontStyle: "bold" },
      },
      didDrawPage: (data) => {
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(...COLOR_MUTED_2);
        doc.text(
          `${data.pageNumber} / ${pageCount}`,
          pageWidth - marginX,
          pageHeight - 20,
          { align: "right" },
        );
      },
    });

    const dateStamp = new Date().toISOString().slice(0, 10);
    doc.save(`donateurs_${dateStamp}.pdf`);
  }

  return (
    <>
      <Topbar
        title={t("title")}
        subtitle={t("summary", { count: total, total: formatDA(totalAmount) })}
        actions={
          <>
            <button
              className="btn btn-ghost"
              onClick={handleExport}
              disabled={sorted.length === 0}
            >
              <Icon name="export" size={16} /> {t("export")}
            </button>
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
              <Icon name="plus" size={16} /> {t("addDonor")}
            </button>
          </>
        }
      />
      <div className="content">
        <div className="grid stat-grid stat-grid-3" style={{ marginBottom: 20 }}>
          <StatCard
            icon="heart"
            iconColor="#52b788"
            iconBg="rgba(82,183,136,0.16)"
            label={t("stats.thisMonth")}
            value={statsError ? "—" : formatDA(stats.thisMonthTotal ?? 0)}
            badge={monthPct != null ? `${monthPct >= 0 ? "+" : ""}${monthPct}% ${t("stats.vsLastMonth")}` : undefined}
            badgeType={monthPct == null ? "flat" : monthPct >= 0 ? "up" : "down"}
          />
          <StatCard
            icon="users"
            iconColor="#5b8def"
            iconBg="rgba(91,141,239,0.16)"
            label={t("stats.newThisMonth")}
            value={statsError ? "—" : stats.newDonorsThisMonth ?? "…"}
            badge={
              newDonorsDelta != null
                ? `${newDonorsDelta >= 0 ? "+" : ""}${newDonorsDelta} ${t("stats.vsLastMonth")}`
                : undefined
            }
            badgeType={newDonorsDelta == null ? "flat" : newDonorsDelta >= 0 ? "up" : "down"}
          />
          <StatCard
            icon="wallet"
            iconColor="#e9806a"
            iconBg="rgba(233,128,106,0.16)"
            label={t("stats.averageContribution")}
            value={formatDA(Math.round(avgContribution))}
          />
        </div>

        <div className="panel">
          <div className="toolbar">
            <div className="field-search">
              <span className="s-ico">
                <Icon name="search" size={16} />
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchPlaceholder")}
              />
            </div>

            <SelectLite
              value={type}
              onChange={setType}
              options={[
                { value: "ALL", label: t("filters.all") },
                { value: "INDIVIDUAL", label: t("types.individual") },
                { value: "ORGANIZATION", label: t("types.organization") },
              ]}
            />

            <SelectLite
              value={sort}
              onChange={setSort}
              options={[
                { value: "recent", label: t("sort.recent") },
                { value: "amount", label: t("sort.amount") },
                { value: "name", label: t("sort.name") },
              ]}
            />
          </div>

          {state.loading ? (
            <Loading />
          ) : state.error ? (
            <ErrorState label={state.error} />
          ) : total === 0 ? (
            <EmptyState label={t("empty")} />
          ) : (
            <>
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>{t("table.donor")}</th>
                      <th>{t("table.contact")}</th>
                      <th>{t("table.type")}</th>
                      <th className="num">{t("table.totalGiven")}</th>
                      <th className="num">{t("table.date")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slice.map((donor) => (
                      <tr key={donor.id}>
                        <td>
                          <div className="cell-name">
                            <div className="avatar sm">{initials(donor.name || "?")}</div>
                            <span
                              style={{
                                maxWidth: 220,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {donor.name || "—"}
                            </span>
                          </div>
                        </td>
                        <td className="muted">
                          {donor.phone || donor.email ? (
                            <>
                              {donor.phone && <div>{donor.phone}</div>}
                              {donor.email && <div className="muted-2">{donor.email}</div>}
                            </>
                          ) : (
                            <span className="muted-2">—</span>
                          )}
                        </td>
                        <td className="muted">{TYPE_LABEL[donor.donorType] || donor.donorType || "—"}</td>
                        <td className="num strong">{formatDA(safeAmount(donor.totalDonated))}</td>
                        <td className="num muted-2">{safeDateLabel(donor.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pager">
                <span className="muted" style={{ fontSize: 13 }}>
                  {t("pagination.showing", {
                    from: (page - 1) * PAGE_SIZE + 1,
                    to: Math.min(page * PAGE_SIZE, total),
                    total,
                  })}
                </span>
                <div className="pages">
                  <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                    <Icon name="chevronLeft" size={15} />
                  </button>
                  {Array.from({ length: pages }).map((_, i) => (
                    <button key={i} className={page === i + 1 ? "on" : ""} onClick={() => setPage(i + 1)}>
                      {i + 1}
                    </button>
                  ))}
                  <button disabled={page === pages} onClick={() => setPage((p) => p + 1)}>
                    <Icon name="chevronRight" size={15} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showAdd && (
        <DonorFormModal onClose={() => setShowAdd(false)} onSaved={load} />
      )}
    </>
  );
}

export default function DonateursPage() {
  return (
    <Suspense fallback={<Loading />}>
      <DonateursInner />
    </Suspense>
  );
}