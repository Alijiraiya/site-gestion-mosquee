"use client";
import { Modal } from "@/components/ui";
import { Icon } from "@/components/icons";
import {
  formatDA,
  formatDate,
  initials,
  ageFromDate,
  memberRoleLabel,
  HEALTH_COLOR,
} from "@/lib/format";
import { useTranslations } from "next-intl";

const DASH = "\u2014";

// Same three-state reading as the family badge, so a member shown "Handicap"
// here is the same member that pushes the family into the red.
function memberHealth(m) {
  if (m.hasDisability) return "bad";
  if (m.diseases && String(m.diseases).trim()) return "warn";
  return "good";
}

/**
 * Read-only description of ONE family member, opened by clicking that member's
 * rectangle in the family popup.
 *
 * The "Modifier" button hands the member back to the caller, which opens
 * MemberFormModal in edit mode -- including for the head of family.
 */
export default function MemberDetailModal({
  member,
  familyName,
  onClose,
  onEdit,
  onDelete,
}) {
  const t = useTranslations("App");
  if (!member) return null;

  const name = `${member.firstName || ""} ${member.lastName || ""}`.trim();
  const isHead = member.role === "HEAD";
  const hs = memberHealth(member);
  const age = member.dateOfBirth ? ageFromDate(member.dateOfBirth) : null;

  const healthLabel =
    hs === "bad"
      ? t("Handicap")
      : hs === "warn"
        ? member.diseases || t("Maladie chronique")
        : t("Bonne");

  const rows = [
    [t("R\u00f4le"), t(memberRoleLabel(member.role))],
    [
      t("Date de naissance"),
      member.dateOfBirth ? formatDate(member.dateOfBirth) : DASH,
    ],
    [
      t("\u00c2ge"),
      age !== null && age !== DASH ? `${age} ${t("ans")}` : DASH,
    ],
    [t("\u00c9tat de sant\u00e9"), healthLabel],
    [t("Occupation"), member.occupation || DASH],
    [
      t("Revenu mensuel"),
      member.monthlyIncome !== null && member.monthlyIncome !== undefined
        ? formatDA(member.monthlyIncome)
        : DASH,
    ],
    [
      t("Enregistr\u00e9 le"),
      member.createdAt ? formatDate(member.createdAt) : DASH,
    ],
    [
      t("Derni\u00e8re modification"),
      member.updatedAt ? formatDate(member.updatedAt) : DASH,
    ],
  ];

  return (
    <Modal
      title={name || t("Membre")}
      subtitle={
        familyName
          ? `${t("Famille")} ${familyName}`
          : t("D\u00e9tails du membre")
      }
      icon="user"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-text" onClick={onClose}>
            {t("Fermer")}
          </button>
          {onDelete && !isHead && (
            <button
              className="btn btn-ghost"
              style={{ color: HEALTH_COLOR.bad }}
              onClick={() => onDelete(member)}
            >
              <Icon name="trash" size={16} /> {t("Supprimer")}
            </button>
          )}
          {onEdit && (
            <button className="btn btn-primary" onClick={() => onEdit(member)}>
              <Icon name="sliders" size={16} /> {t("Modifier")}
            </button>
          )}
        </>
      }
    >
      <div className="md-head">
        <div className="avatar sq" aria-hidden="true">
          {initials(name || "?")}
        </div>
        <div className="md-head-main">
          <div className="md-head-name">{name || DASH}</div>
          <div className="md-chips">
            <span className="pill pill-role">
              {t(memberRoleLabel(member.role))}
            </span>
            <span
              className="pill"
              style={{
                background: HEALTH_COLOR[hs] + "28",
                color: HEALTH_COLOR[hs],
              }}
            >
              <span className="dot" style={{ background: HEALTH_COLOR[hs] }} />
              {healthLabel}
            </span>
          </div>
        </div>
      </div>

      {/* The head is also stored on the family record itself, so editing it
          moves the SVF score. Warn before, not after. */}
      {isHead && (
        <div className="fd-todo" style={{ marginTop: 14 }}>
          <Icon name="alert" size={16} />
          <div>
            <b>{t("Chef de famille")}</b>
            <div className="fd-todo-sub">
              {t(
                "Ses informations alimentent le score SVF de la famille (\u00e2ge, sant\u00e9)",
              )}
              .
            </div>
          </div>
        </div>
      )}

      <div className="fd-info" style={{ marginTop: 14 }}>
        {rows.map(([k, v]) => (
          <div className="fd-row" key={k}>
            <span className="fd-key">{k}</span>
            <span className="fd-val">{v}</span>
          </div>
        ))}
      </div>

      {member.diseases && String(member.diseases).trim() && (
        <div className="md-note">
          <div className="fd-key">{t("Maladies d\u00e9clar\u00e9es")}</div>
          <div>{member.diseases}</div>
        </div>
      )}
    </Modal>
  );
}
