"use client";
import { useEffect, useState } from "react";
import { Modal, Field, Autocomplete, useToast } from "@/components/ui";
import { api } from "@/lib/apiClient";
import { DONATION_CATEGORIES, PAYMENT_METHODS } from "@/lib/format";
import { SelectLite } from "@/components/SelectLite";
import { useTranslations } from "next-intl";

export default function DonationFormModal({ onClose, onSaved }) {
  const toast = useToast();
  const t = useTranslations("App");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("SADAQAH");
  const [method, setMethod] = useState("CASH");
  const [anonymous, setAnonymous] = useState(false);
  const [donorQuery, setDonorQuery] = useState("");
  const [donorId, setDonorId] = useState(null);
  const [donors, setDonors] = useState([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get("/donors")
      .then((d) => setDonors(d.donors || []))
      .catch(() => setDonors([]));
  }, []);

  const filtered = anonymous
    ? []
    : donors
        .filter((d) => d.name.toLowerCase().includes(donorQuery.toLowerCase()))
        .slice(0, 8);

  async function submit() {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast(t("Veuillez saisir un montant valide"), "err");
      return;
    }
    setBusy(true);
    try {
      await api.post("/donations", {
        amount: amt,
        category,
        paymentMethod: method,
        isAnonymous: anonymous,
        donorId: anonymous ? undefined : donorId || undefined,
        notes: notes || undefined,
      });
      toast(t("Don enregistr\u00e9 avec succ\u00e8s"));
      onSaved?.();
      onClose?.();
    } catch (e) {
      if (e.code === "ANONYMOUS_DONATIONS_DISABLED") {
        toast(t("donationsAnonymousDisabled"), "err");
      } else {
        toast(e.message || t("\u00c9chec de l'enregistrement"), "err");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={t("Ajouter un don")}
      subtitle={t("Enregistrer une nouvelle contribution")}
      icon="gift"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-text" onClick={onClose} disabled={busy}>
            {t("Annuler")}
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? t("Enregistrement\u2026") : t("Enregistrer le don")}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label={t("Montant (DA)")} required full>
          <input
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="10000"
            style={{ fontSize: 18, fontWeight: 700 }}
          />
        </Field>

        <Field label={t("Type de don")}>
          <SelectLite
            value={category}
            onChange={setCategory}
            options={DONATION_CATEGORIES.map((c) => ({
              value: c.value,
              label: t(c.label),
            }))}
          />
        </Field>
        <Field label={t("M\u00e9thode de paiement")}>
          <SelectLite
            value={method}
            onChange={setMethod}
            options={PAYMENT_METHODS.map((m) => ({
              value: m.value,
              label: t(m.label),
            }))}
          />
        </Field>

        <Field label={t("Donateur")} full>
          <div className="toggle2" style={{ marginBottom: 10 }}>
            <button
              type="button"
              className={!anonymous ? "on" : ""}
              onClick={() => setAnonymous(false)}
            >
              {t("Donateur identifi\u00e9")}
            </button>
            <button
              type="button"
              className={anonymous ? "on" : ""}
              onClick={() => setAnonymous(true)}
            >
              {t("Anonyme")}
            </button>
          </div>
          {!anonymous && (
            <Autocomplete
              placeholder={t("Rechercher un donateur\u2026")}
              items={filtered}
              value={donorQuery}
              onChange={(v) => {
                setDonorQuery(v);
                setDonorId(null);
              }}
              onSelect={(it) => {
                setDonorQuery(it.name);
                setDonorId(it.id);
              }}
              renderItem={(it) => (
                <div>
                  <div>{it.name}</div>
                  {it.phone && <div className="sub">{it.phone}</div>}
                </div>
              )}
            />
          )}
        </Field>

        <Field label={t("Notes")} full>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("R\u00e9f\u00e9rence, objet du don\u2026")}
          />
        </Field>
      </div>
    </Modal>
  );
}