"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Icon } from "./icons";
import { Loading, ErrorState, useToast } from "./ui";
import { api, clearSession } from "@/lib/apiClient";
import { formatDA } from "@/lib/format";

const PRIORITY_CLASS = {
  URGENT: "priority-critique",
  VULNERABLE: "priority-high",
  MODERATE: "priority-medium",
  LOW: "priority-low",
};

// DistributionItem.paymentStatus enum (see schema.prisma)
const STATUS_CLASS = {
  PENDING: "status-waiting",
  PAID: "status-paid",
  CANCELLED: "status-cancelled",
};
const STATUS_ICON = {
  PENDING: "clock",
  PAID: "check",
  CANCELLED: "close",
};

// onDeleted is called when the distribution this modal was opened for no
// longer exists (deleted elsewhere between opening the list and clicking
// "Détails"). The parent should close the modal and refresh its list.
// onStatusChange is called after any item's payment status is successfully
// updated, since that can flip the parent Distribution's overall status
// (e.g. to COMPLETED once nothing is PENDING anymore) -- the parent's
// history table won't reflect that until it refetches.
export default function DistributionDetailsModal({ distributionId, onClose, onDeleted, onStatusChange }) {
  const t = useTranslations("Distributions.detailsModal");
  const tPriority = useTranslations("Distributions.priority");
  const router = useRouter();
  const toast = useToast();
  const [state, setState] = useState({ loading: true, error: "", notFound: false });
  const [distribution, setDistribution] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  async function load() {
    setState({ loading: true, error: "", notFound: false });
    try {
      const data = await api.get(`/distributions/${distributionId}`);
      setDistribution(data.distribution);
      setState({ loading: false, error: "", notFound: false });
    } catch (err) {
      if (err?.status === 401) {
        clearSession();
        router.replace("/login");
        return;
      }
      if (err?.status === 404) {
        // The distribution was deleted (by this user in another tab, or by
        // someone else) between the list loading and this modal opening.
        setState({
          loading: false,
          error: t("notFound") || "Cette distribution n'existe plus.",
          notFound: true,
        });
        return;
      }
      setState({ loading: false, error: err.message || t("loadError"), notFound: false });
    }
  }

  useEffect(() => {
    if (!distributionId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distributionId]);

  async function updateStatus(itemId, paymentStatus) {
    setUpdatingId(itemId);
    try {
      await api.put(`/distributions/${distributionId}`, {
        itemId,
        paymentStatus,
      });
      setDistribution((d) =>
        d
          ? {
              ...d,
              items: d.items.map((it) =>
                it.id === itemId ? { ...it, paymentStatus } : it
              ),
            }
          : d
      );
      onStatusChange?.();
    } catch (err) {
      if (err?.status === 401) {
        clearSession();
        router.replace("/login");
        return;
      }
      if (err?.status === 404) {
        // The distribution itself (or the item) vanished mid-edit.
        toast(t("notFound") || "Cette distribution n'existe plus.", "err");
        onDeleted?.();
        return;
      }
      if (err?.status === 409) {
        // Another click/tab already locked this item's status first --
        // resync with the server instead of showing a confusing error.
        toast(t("alreadyLocked") || "Ce statut a déjà été verrouillé.", "err");
        await load();
        return;
      }
      toast(err.message || t("loadError"), "err");
    } finally {
      setUpdatingId(null);
    }
  }

  const items = distribution?.items || [];
  const paid = items.filter((i) => i.paymentStatus === "PAID").length;
  const waiting = items.filter((i) => i.paymentStatus === "PENDING").length;
  const cancelled = items.filter((i) => i.paymentStatus === "CANCELLED").length;

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal modal-wide" role="dialog" aria-modal="true">
        <div className="modal-head" style={{ padding: "22px 24px 0" }}>
          <div>
            <h3>{t("title")}</h3>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Fermer">
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="modal-body">
          {state.loading ? (
            <Loading />
          ) : state.notFound ? (
            <div className="empty-block">
              <div className="empty-icon-circle">
                <Icon name="alertTriangle" size={40} strokeWidth={1.3} />
              </div>
              <h4>{t("notFoundTitle") || "Introuvable"}</h4>
              <p>{state.error}</p>
              <div style={{ marginTop: 18 }}>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    onDeleted?.();
                  }}
                >
                  {t("backToList") || "Retour à la liste"}
                </button>
              </div>
            </div>
          ) : state.error ? (
            <ErrorState label={state.error} />
          ) : (
            <>
              <div className="mini-stats mini-stats-4">
                <div className="mini-stat">
                  <div className="label">{t("beneficiaries")}</div>
                  <div className="value">{items.length}</div>
                </div>
                <div className="mini-stat">
                  <div className="label">{t("paid")}</div>
                  <div className="value">{paid}</div>
                </div>
                <div className="mini-stat">
                  <div className="label">{t("waiting")}</div>
                  <div className="value">{waiting}</div>
                </div>
                <div className="mini-stat">
                  <div className="label">{t("cancelled")}</div>
                  <div className="value">{cancelled}</div>
                </div>
              </div>

              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>{t("family")}</th>
                      <th>SVF</th>
                      <th>{t("priorityCol")}</th>
                      <th>{t("amountCol")}</th>
                      <th>{t("statusCol")}</th>
                      <th>{t("actionsCol")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const busy = updatingId === item.id;
                      return (
                        <tr key={item.id}>
                          <td>
                            <div className="cell-family">
                              <b>
                                {item.family?.firstName} {item.family?.lastName}
                              </b>
                            </div>
                          </td>
                          <td className="muted">{item.svfSnapshot}</td>
                          <td>
                            <span className={`pill ${PRIORITY_CLASS[item.prioritySnapshot] || "priority-low"}`}>
                              {tPriority(item.prioritySnapshot, { default: item.prioritySnapshot })}
                            </span>
                          </td>
                          <td className="strong" style={{ color: "var(--green-1)" }}>
                            {formatDA(Number(item.amount))}
                          </td>
                          <td>
                            <span className={`pill ${STATUS_CLASS[item.paymentStatus] || "status-waiting"}`}>
                              <Icon name={STATUS_ICON[item.paymentStatus] || "clock"} size={12} />{" "}
                              {t(`status.${item.paymentStatus}`, { default: item.paymentStatus })}
                            </span>
                          </td>
                          <td>
                            {item.paymentStatus === "PENDING" ? (
                              <div className="row-actions">
                                <button
                                  className="row-action-btn"
                                  title={t("markPaid")}
                                  disabled={busy}
                                  onClick={() => updateStatus(item.id, "PAID")}
                                >
                                  <Icon name="check" size={15} />
                                </button>
                                <button
                                  className="row-action-btn"
                                  title={t("cancelAction")}
                                  disabled={busy}
                                  onClick={() => updateStatus(item.id, "CANCELLED")}
                                >
                                  <Icon name="close" size={15} />
                                </button>
                              </div>
                            ) : (
                              <span
                                className="row-action-icon"
                                title={t("locked") || "Statut verrouillé"}
                              >
                                <Icon name={STATUS_ICON[item.paymentStatus] || "clock"} size={15} />
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}