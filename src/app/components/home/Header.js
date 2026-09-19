"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { imgMosqueLogo } from "@/lib/utils";
import Link from "next/link";
import LanguageButton from "../ui/LanguageButton";
import ThemeButton from "../ui/ThemeButton";
import { useLocale, useTranslations } from "next-intl";

// ── Header ─────────────────────────────────────────────────────────────────
export default function Header() {
  const language = useLocale();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const labels = useTranslations("header");
  // Shared FR->AR catalogue (src/lib/i18n.js) for the brand tagline, which
  // was hard-coded in French and never switched with the locale.
  const tApp = useTranslations("App");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { link: "#", label: labels("home") },
    { link: ".#features", label: labels("features") },
    { link: ".#mosques", label: labels("mosques") },
    { link: ".#contact", label: labels("contact") },
  ];

  return (
    <motion.header
      dir={language === "ar" ? "rtl" : "ltr"}
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white shadow-[0_1px_12px_rgba(0,0,0,0.08)] dark:bg-[#0A1129] dark:shadow-[0_1px_12px_rgba(0,0,0,0.45)]"
          : "bg-white/90 backdrop-blur-sm dark:bg-[#0A1129]/80"
      } border-b border-[rgba(45,122,62,0.12)] dark:border-white/10`}
    >
      <div className="max-w-304 mx-auto px-6 lg:px-8 h-[65px] flex items-center justify-between">
        {/* Logo */}

        <motion.div
          className="shrink-0 flex gap-2"
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.1 }}
        >
          <img
            src={imgMosqueLogo}
            alt="ZAKAT"
            className="h-13 w-auto rounded object-fill"
          />
          <div className="w-full h-full flex-1 items-between">
            <h1 className="text-foreground text-2xl font-semibold ">ZAKAT</h1>
            <p className="text-primary text-xs">{tApp("brandTagline")}</p>
          </div>
        </motion.div>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-6">
          {links.map((link, i) => (
            <motion.a
              key={i}
              href={link.link}
              className="text-[14px] font-medium text-foreground hover:text-primary transition-colors duration-200 font-['Plus_Jakarta_Sans',sans-serif]"
              whileHover={{ y: -1 }}
              transition={{ duration: 0.15 }}
            >
              {link.label}
            </motion.a>
          ))}
        </nav>

        {/* Actions */}
        <div className="hidden lg:flex items-center gap-3">
          <LanguageButton />
          <ThemeButton />
          <Link
            href="/login"
            className="bg-primary text-white text-[14px] font-semibold px-4 py-2 rounded-[10px] font-['Plus_Jakarta_Sans',sans-serif]"
          >
            {labels("login")}
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="lg:hidden p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <div className="w-5 h-0.5 bg-[#1a2e1a] dark:bg-white mb-1 transition-all" />
          <div className="w-5 h-0.5 bg-[#1a2e1a] dark:bg-white mb-1 transition-all" />
          <div className="w-5 h-0.5 bg-[#1a2e1a] dark:bg-white transition-all" />
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="lg:hidden bg-white dark:bg-[#0A1129] border-t border-[rgba(45,122,62,0.1)] dark:border-white/10 overflow-hidden"
          >
            <div className="px-6 py-4 flex flex-col gap-4">
              {links.map((link, i) => (
                <a
                  key={i}
                  href={link.link}
                  onClick={() => setMobileOpen(false)}
                  className="text-[14px] font-medium text-[rgba(26,46,26,0.7)] dark:text-white/70 font-['Plus_Jakarta_Sans',sans-serif]"
                >
                  {link.label}
                </a>
              ))}
              <div className="flex items-center gap-3">
                <LanguageButton />
                <ThemeButton />
              </div>
              <Link
                href="/login"
                className="bg-[#52b788] text-white text-[14px] font-semibold px-4 py-2 rounded-[10px] w-fit font-['Plus_Jakarta_Sans',sans-serif]"
              >
                {labels("login")}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
