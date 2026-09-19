"use client";
import { Icon } from "@/components/icons";
import { formatDA } from "@/lib/format";
import { useTranslations } from "next-intl";

/**
 * "Solde actuel" -- the single figure an imam checks before every payout.
 *
 * It used to be a small grey badge inside the "Entrees" stat card, where it was
 * easy to miss and impossible to read at a glance. It now has its own wide
 * container, shown at the top of both the dashboard and the donations page, so
 * the same number is displayed in exactly the same way in both places.
 *
 * Props:
 *   balance          current mosque balance (required)
 *   totalReceived    all-time donations in    (optional)
 *   totalDistributed all-time aid out         (optional)
 *   loading          renders a skeleton
 *   compact          smaller variant for secondary pages
 *   onAction/actionLabel  optional call-to-action button
 */
export default function BalanceCard({
  balance,
  totalReceived,
  totalDistributed,
  loading = false,
  compact = false,
  onAction,
  actionLabel,
}) {
  const t = useTranslations("App");
  const value = Number(balance ?? 0);
  // A negative balance is an accounting emergency, not a detail: the whole
  // container turns red instead of just the digits.
  const negative = value < 0;
  const low = !negative && value >= 0 && value < 10000;

  const tone = negative ? "danger" : low ? "warn" : "ok";

  return (
    <section
      className={`balance-card ${compact ? "compact" : ""} tone-${tone}`}
      aria-label={t("Solde actuel")}
    >
      <div className="balance-main">
        <div className="balance-ico" aria-hidden="true">
          <Icon name="wallet" size={compact ? 22 : 28} />
        </div>
        <div className="balance-text">
          <div className="balance-label">
            {t("Solde actuel")}
            {negative && (
              <span className="balance-flag">
                <Icon name="alert" size={13} /> {t("Solde n\u00e9gatif")}
              </span>
            )}
            {low && (
              <span className="balance-flag warn">
                <Icon name="alert" size={13} /> {t("Solde faible")}
              </span>
            )}
          </div>
          <div className="balance-value">
            {loading ? <span className="balance-skeleton" /> : formatDA(value)}
          </div>
          <div className="balance-hint">
            {t("Disponible pour les distributions")}
          </div>
        </div>
      </div>

      <div className="balance-side">
        {totalReceived !== undefined && totalReceived !== null && (
          <div className="balance-sub">
            <span className="balance-sub-ico in" aria-hidden="true">
              <Icon name="trendUp" size={14} />
            </span>
            <div>
              <div className="balance-sub-label">{t("Entr\u00e9es")}</div>
              <div className="balance-sub-value">{formatDA(totalReceived)}</div>
            </div>
          </div>
        )}
        {totalDistributed !== undefined && totalDistributed !== null && (
          <div className="balance-sub">
            <span className="balance-sub-ico out" aria-hidden="true">
              <Icon name="trendDown" size={14} />
            </span>
            <div>
              <div className="balance-sub-label">{t("Sorties")}</div>
              <div className="balance-sub-value">
                {formatDA(totalDistributed)}
              </div>
            </div>
          </div>
        )}
        {onAction && actionLabel && (
          <button className="btn btn-primary balance-cta" onClick={onAction}>
            <Icon name="plus" size={16} /> {actionLabel}
          </button>
        )}
      </div>
    </section>
  );
}
