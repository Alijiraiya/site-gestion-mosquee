"use client";
import { fadeUp, slideLeft } from "@/lib/utils";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import imgMosque from "@/imports/LandingPage/97f5173d92884b47399e93d40f6ebe8eb64b873e.png";
import svgPaths from "@/imports/LandingPage/svg-zgxiiuzjal";
import { gMosqueImage } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";

// ── Hero Section ───────────────────────────────────────────────────────────
export default function HeroSection() {
  const language = useLocale();
  const labels = useTranslations().raw("hero");
  const isRTL = language === "ar" ? true : false;
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <section
      ref={ref}
      className="bg-white dark:bg-transparent  pt-16.5 min-h-250 flex items-center overflow-hidden"
    >
      <div className="max-w-304 mx-auto px-6 lg:px-8 w-full py-20 lg:py-24">
        <div
          className={` flex flex-col lg:flex-row  items-center gap-12 lg:gap-16`}
        >
          {/* Left content */}
          <motion.div
            style={{ y, opacity }}
            className="flex-1 w-full justify- min-w-0"
          >
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={0}
              className="relative mb-6"
            >
              <h1
                className={`font-['Plus_Jakarta_Sans',sans-serif] font-extrabold text-[42px] lg:text-[52px] leading-[1.15] text-foreground ${isRTL ? "text-right" : ""}`}
              >
                {labels.pre}{" "}
                <span className="relative inline-block text-primary">
                  {labels.highlight}
                  <motion.span
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{
                      duration: 0.6,
                      delay: 0.7,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="absolute -bottom-1 left-0 right-0 h-[4px] bg-primary rounded-full origin-left"
                  />
                </span>{" "}
                {labels.post}
              </h1>
            </motion.div>

            <motion.p
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={0.15}
              className={`font-['Plus_Jakarta_Sans',sans-serif] font-normal text-[16px] leading-[1.65] dark:text-foreground/60 text-[#2b3a67] mb-8 w-full  ${isRTL ? "text-right" : "max-w-127"}`}
            >
              {labels.body}
            </motion.p>

            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={0.25}
              className={`flex w-full ${"justify-start"} gap-3 mb-8`}
            >
              <motion.button
                className="bg-primary text-white font-['Plus_Jakarta_Sans',sans-serif] font-semibold text-[16px] px-6 py-3.5 rounded-[14px] flex items-center gap-2 shadow-[0_4px_12px_rgba(45,122,62,0.25)]"
                whileHover={{
                  scale: 1.03,
                  y: -2,
                  boxShadow: "0 8px 20px rgba(45,122,62,0.3)",
                }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.2 }}
              >
                {labels.primaryCta}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M6 12L10 8L6 4"
                    stroke="white"
                    strokeWidth="1.33"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </motion.button>
              <motion.button
                className="border-2 border-primary text-primary font-['Plus_Jakarta_Sans',sans-serif] font-semibold text-[16px] px-6 py-3.5 rounded-[14px] flex items-center gap-2"
                whileHover={{
                  scale: 1.03,
                  y: -2,
                  backgroundColor: "rgba(82,183,136,0.05)",
                }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.2 }}
              >
                {labels.secondaryCta}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3.33333 8H12.6667"
                    stroke="#52B788"
                    strokeWidth="1.33"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={svgPaths.p1d405500}
                    stroke="#52B788"
                    strokeWidth="1.33"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </motion.button>
            </motion.div>

            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={0.35}
              className={`flex flex-wrap justify-${isRTL ? "end" : "start"} gap-4`}
            >
              {labels.badges.map((badge) => (
                <motion.div
                  key={badge}
                  className="flex items-center gap-1.5"
                  whileHover={{ x: 2 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="bg-background rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path
                        d="M10 3L4.5 8.5L2 6"
                        stroke="#52B788"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <span className="font-['Plus_Jakarta_Sans',sans-serif] font-normal text-[14px] text-foreground/60">
                    {badge}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* Right image */}
          <motion.div
            variants={slideLeft}
            initial="hidden"
            animate="visible"
            custom={0.2}
            className="shrink-0 relative"
          >
            <div className="absolute -top-6 -right-6 w-72 h-72 bg-[rgba(45,122,62,0.05)] rounded-full blur-xl" />
            <div className="absolute bottom-12 -left-8 w-48 h-48 bg-[rgba(67,168,87,0.08)] rounded-full blur-xl" />
            <motion.div
              className="relative rounded-3xl overflow-hidden border-4 border-white shadow-[0_25px_60px_rgba(45,122,62,0.18)] w-[380px] lg:w-[440px]"
              whileHover={{ scale: 1.02, rotate: 0.5 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <img
                src={gMosqueImage}
                alt={labels.alt}
                className="w-full h-[420px] lg:h-[480px] object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[rgba(26,46,26,0.15)] to-transparent" />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
