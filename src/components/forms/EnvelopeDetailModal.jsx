"use client";
import { useState } from "react";
import { Modal, useToast } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api } from "@/lib/apiClient";
import { formatDA, formatDate } from "@/lib/format";
import {
  CATEGORY_METADATA,
  PERIOD_METADATA,
  calculateEnvelopeMetrics,
} from "@/lib/envelopes";
import { useTranslations, useLocale } from "next-intl";

export default function EnvelopeDetailModal({
  envelope,
  onClose,
  onEdit,
  onUpdated,
  onDeleted,
}) {
  const toast = useToast();
  const t = useTranslations("Envelopes");
  const locale = useLocale();
  const isAr = locale === "ar";

  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "transfers" | "expenses"

  if (!envelope) return null;

  const metrics =
    envelope.metrics ||
    calculateEnvelopeMetrics(
      envelope.allocatedAmount,
      envelope.spentAmount,
      envelope.alertThreshold
    );

  const catMeta = CATEGORY_METADATA[envelope.category] || CATEGORY_METADATA.OTHER;
  const periodMeta = PERIOD_METADATA[envelope.periodType] || PERIOD_METADATA.ANNUAL;

  const isClosed = envelope.status === "CLOSED";
  const isExhausted = metrics.healthState === "EXHAUSTED" || envelope.status === "EXHAUSTED";
  const isWarning = metrics.healthState === "WARNING" && !isClosed && !isExhausted;

  async function handleToggleStatus() {
    const nextStatus = isClosed ? "ACTIVE" : "CLOSED";
    const confirmMsg = isClosed
      ? isAr ? "هل تريد إعادة فتح هذا الظرف المالي؟" : "Voulez-vous rouvrir cette enveloppe ?"
      : t("modal.confirmClose");

    if (!window.confirm(confirmMsg)) return;

    setBusy(true);
    try {
      await api.put(`/envelopes/${envelope.id}`, { status: nextStatus });
      toast(isClosed ? (isAr ? "تم إعادة فتح الظرف المالي." : "Enveloppe rouverte.") : t("modal.successClose"));
      onUpdated?.();
      onClose?.();
    } catch (e) {
      toast(e.message || (isAr ? "تعذر تغيير الحالة." : "Impossible de modifier le statut."), "err");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(t("modal.confirmDelete"))) return;

    setBusy(true);
    try {
      const res = await api.delete(`/envelopes/${envelope.id}`);
      if (res?.closed) {
        toast(isAr ? "تم إغلاق الظرف المالي لحفظ السجل." : "L'enveloppe a été clôturée car elle contient un historique.");
      } else {
        toast(isAr ? "تم حذف الظرف المالي بنجاح." : "Enveloppe supprimée.");
      }
      onDeleted?.();
      onClose?.();
    } catch (e) {
      toast(e.message || (isAr ? "تعذر الحذف." : "Échec de la suppression."), "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={envelope.name}
      subtitle={`${isAr ? catMeta.arLabel : catMeta.label} • ${isAr ? periodMeta.arLabel : periodMeta.label}`}
      icon="envelope"
      onClose={onClose}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-text"
              style={{ color: "#ef4444" }}
              onClick={handleDelete}
              disabled={busy}
              title={isAr ? "حذف أو إغلاق" : "Supprimer"}
            >
              <Icon name="trash" size={15} />
              {t("card.delete")}
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleToggleStatus}
              disabled={busy}
            >
              {isClosed ? t("card.reopen") : t("card.close")}
            </button>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-text" onClick={onClose}>
              {t("modal.cancel")}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                onClose();
                onEdit?.(envelope);
              }}
            >
              <Icon name="edit" size={15} />
              {t("card.edit")}
            </button>
          </div>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Navigation Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--border-soft)",
            gap: 16,
            paddingBottom: 8,
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            style={{
              background: "none",
              border: "none",
              color: activeTab === "overview" ? "var(--green-1)" : "var(--muted)",
              fontWeight: activeTab === "overview" ? 700 : 500,
              borderBottom: activeTab === "overview" ? "2px solid var(--green-1)" : "none",
              paddingBottom: 6,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            {isAr ? "نظرة عامة ومؤشرات" : "Vue d'ensemble & Métriques"}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("transfers")}
            style={{
              background: "none",
              border: "none",
              color: activeTab === "transfers" ? "var(--green-1)" : "var(--muted)",
              fontWeight: activeTab === "transfers" ? 700 : 500,
              borderBottom: activeTab === "transfers" ? "2px solid var(--green-1)" : "none",
              paddingBottom: 6,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            {isAr ? "التحويلات بين الأظرفة (الجزء 2)" : "Transferts Inter-Enveloppes"}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("expenses")}
            style={{
              background: "none",
              border: "none",
              color: activeTab === "expenses" ? "var(--green-1)" : "var(--muted)",
              fontWeight: activeTab === "expenses" ? 700 : 500,
              borderBottom: activeTab === "expenses" ? "2px solid var(--green-1)" : "none",
              paddingBottom: 6,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            {isAr ? "المصاريف المرتبطة (مروة)" : "Dépenses imputées"}
          </button>
        </div>

        {activeTab === "overview" && (
          <>
            {/* Top KPI Cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
              }}
            >
              <div
                style={{
                  background: "var(--panel-deep)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "14px 16px",
                }}
              >
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                  {t("card.allocated")}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)" }}>
                  {formatDA(envelope.allocatedAmount)}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 2 }}>
                  100% {isAr ? "الميزانية الكلية" : "du budget initial"}
                </div>
              </div>

              <div
                style={{
                  background: "var(--panel-deep)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "14px 16px",
                }}
              >
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                  {t("card.consumed")}
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: metrics.statusColor,
                  }}
                >
                  {formatDA(envelope.spentAmount)}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 2 }}>
                  {metrics.consumedRate}% {isAr ? "مستهلك" : "consommé"}
                </div>
              </div>

              <div
                style={{
                  background: "var(--panel-deep)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "14px 16px",
                }}
              >
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                  {t("card.remaining")}
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: metrics.remainingAmount < 0 ? "#ef4444" : "var(--green-1)",
                  }}
                >
                  {formatDA(metrics.remainingAmount)}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 2 }}>
                  {metrics.remainingAmount < 0
                    ? isAr ? "عجز في الميزانية" : "Dépassement de budget"
                    : isAr ? "رصيد متاح للصرف" : "Disponible"}
                </div>
              </div>
            </div>

            {/* Visual Consumption Gauge */}
            <div
              style={{
                background: "var(--panel-deep)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "16px 18px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700 }}>
                  {isAr ? "مؤشر استهلاك الظرف" : "Jauge d'utilisation du budget"}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: metrics.statusColor,
                  }}
                >
                  {metrics.consumedRate}%
                </span>
              </div>

              {/* Progress Bar Container */}
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: 14,
                  background: "rgba(255, 255, 255, 0.08)",
                  borderRadius: 7,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(metrics.consumedRate, 100)}%`,
                    background: metrics.statusColor,
                    borderRadius: 7,
                    transition: "width 0.4s ease",
                  }}
                />
              </div>

              {/* Threshold Marker Indicator */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 6,
                  fontSize: 11,
                  color: "var(--muted)",
                }}
              >
                <span>0%</span>
                <span
                  style={{
                    color: metrics.consumedRate >= envelope.alertThreshold ? "#f59e0b" : "var(--muted)",
                    fontWeight: 600,
                  }}
                >
                  {t("card.thresholdAlert", { threshold: envelope.alertThreshold })}
                </span>
                <span>100%</span>
              </div>

              {/* High Alert Callout */}
              {isExhausted && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "8px 12px",
                    background: "rgba(239, 68, 68, 0.12)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: 8,
                    color: "#fca5a5",
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Icon name="alert" size={16} />
                  <span>
                    {isAr
                      ? "تم استنفاد ميزانية هذا الظرف بالكامل! يوصى بإجراء تحويل بين الأظرفة."
                      : "Cette enveloppe a atteint sa limite budgétaire. Un transfert inter-enveloppes est recommandé."}
                  </span>
                </div>
              )}

              {isWarning && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "8px 12px",
                    background: "rgba(245, 158, 11, 0.12)",
                    border: "1px solid rgba(245, 158, 11, 0.3)",
                    borderRadius: 8,
                    color: "#fcd34d",
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Icon name="alert" size={16} />
                  <span>
                    {isAr
                      ? `تحذير: تجاوز الاستهلاك حد التنبيه المحدد (${envelope.alertThreshold}%).`
                      : `Alerte : Le seuil de vigilance (${envelope.alertThreshold}%) a été franchi.`}
                  </span>
                </div>
              )}
            </div>

            {/* Metadata Table */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                fontSize: 13,
              }}
            >
              <div
                style={{
                  background: "var(--panel-deep)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: "10px 14px",
                }}
              >
                <span style={{ color: "var(--muted)", display: "block", fontSize: 11, marginBottom: 2 }}>
                  {t("modal.categoryLabel")}
                </span>
                <span style={{ fontWeight: 600 }}>{isAr ? catMeta.arLabel : catMeta.label}</span>
              </div>

              <div
                style={{
                  background: "var(--panel-deep)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: "10px 14px",
                }}
              >
                <span style={{ color: "var(--muted)", display: "block", fontSize: 11, marginBottom: 2 }}>
                  {t("modal.statusLabel")}
                </span>
                <span
                  style={{
                    fontWeight: 700,
                    color: isClosed ? "var(--muted)" : isExhausted ? "#ef4444" : isWarning ? "#f59e0b" : "var(--green-1)",
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

              <div
                style={{
                  background: "var(--panel-deep)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: "10px 14px",
                }}
              >
                <span style={{ color: "var(--muted)", display: "block", fontSize: 11, marginBottom: 2 }}>
                  {isAr ? "فترة الصلاحية" : "Période de validité"}
                </span>
                <span style={{ fontWeight: 600 }}>
                  {formatDate(envelope.startDate)} &rarr; {formatDate(envelope.endDate)}
                </span>
              </div>

              <div
                style={{
                  background: "var(--panel-deep)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: "10px 14px",
                }}
              >
                <span style={{ color: "var(--muted)", display: "block", fontSize: 11, marginBottom: 2 }}>
                  {isAr ? "أنشئ بواسطة" : "Créé par"}
                </span>
                <span style={{ fontWeight: 600 }}>
                  {envelope.createdBy
                    ? `${envelope.createdBy.firstName} ${envelope.createdBy.lastName}`
                    : "—"}
                </span>
              </div>
            </div>

            {/* Description */}
            {envelope.description && (
              <div
                style={{
                  background: "var(--panel-deep)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: "12px 14px",
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: "var(--muted)",
                }}
              >
                <div style={{ fontSize: 11, color: "var(--muted-2)", fontWeight: 700, marginBottom: 4 }}>
                  {t("modal.descriptionLabel")}
                </div>
                {envelope.description}
              </div>
            )}
          </>
        )}

        {activeTab === "transfers" && (
          <div
            style={{
              padding: "24px 16px",
              textAlign: "center",
              background: "var(--panel-deep)",
              borderRadius: 12,
              border: "1px dashed var(--border)",
            }}
          >
            <div style={{ color: "var(--blue)", marginBottom: 8 }}>
              <Icon name="spread" size={32} />
            </div>
            <h4 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700 }}>
              {isAr ? "نظام التحويل الاستثنائي بين الأظرفة (الجزء 2)" : "Transferts Exceptionnels Inter-Enveloppes (Partie 2)"}
            </h4>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", maxWidth: 440, marginInline: "auto" }}>
              {isAr
                ? "يسمح هذا القسم بتغطية العجز المالي المؤقت عبر استعارة مخصصات من ظرف مالي آخر مع تتبع جدول السداد تلقائيًا."
                : "Ce module permettra d'effectuer des emprunts temporaires d'une enveloppe excédentaire vers une enveloppe déficitaire avec suivi de remboursement."}
            </p>
          </div>
        )}

        {activeTab === "expenses" && (
          <div
            style={{
              padding: "24px 16px",
              textAlign: "center",
              background: "var(--panel-deep)",
              borderRadius: 12,
              border: "1px dashed var(--border)",
            }}
          >
            <div style={{ color: "var(--green-1)", marginBottom: 8 }}>
              <Icon name="wallet" size={32} />
            </div>
            <h4 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700 }}>
              {isAr ? "سجل النفقات والمصروفات المباشرة" : "Journal des Dépenses Réelles"}
            </h4>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", maxWidth: 440, marginInline: "auto" }}>
              {isAr
                ? "سيتم ربط فواتير الصيانة والكهرباء ومصروفات المسجد المسجلة مباشرة بهذا الظرف لخصمها آنيًا من الميزانية."
                : "Les factures et justificatifs de dépenses saisis seront directement imputés sur cette enveloppe, recalculant son solde en temps réel."}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
