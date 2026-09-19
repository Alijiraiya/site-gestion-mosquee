"use client";
import { useLocale } from "next-intl";
import { Icon } from "@/components/icons";
import { useRouter } from "next/navigation";

function setLocaleCookie(next) {
  document.cookie = `locale=${next}; path=/; max-age=31536000`;
}


const LanguageButton = () => {
  const locale = useLocale();
  const router = useRouter();
function toggleLanguage() {
  const next = locale === "fr" ? "ar" : "fr";
  setLocaleCookie(next);
  router.refresh();
}
  return (
    <button
      onClick={toggleLanguage}
      className="landing-pill landing-pill-wide"
      title="FR / AR"
      aria-label="Changer de langue"
    >
      <Icon name="globe" size={15} />
      <span>{locale.toUpperCase()}</span>
    </button>
  );
};

export default LanguageButton;
