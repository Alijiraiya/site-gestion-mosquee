"use client";
import { fadeIn, slideLeft, slideRight } from "@/lib/utils";
import { useInView, motion } from "framer-motion";
import { useRef } from "react";
import StatCard from "./StatCard";
import svgPaths from "@/imports/LandingPage/svg-zgxiiuzjal";
import { imgAlgeriaMap } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";
// ── Stats Section ──────────────────────────────────────────────────────────
export default function StatsSection() {
  const language = useLocale();
  const labels = useTranslations().raw("stats");
  const isRTL = language === "ar";
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  const stats = [
    {
      label: labels.stats[0].label,
      sublabel: labels.stats[0].sublabel,
      value: "100+",
      rawValue: 100,
      suffix: "+",
    },
    {
      label: labels.stats[1].label,
      sublabel: labels.stats[1].sublabel,
      value: "25 000+",
      rawValue: 25000,
      suffix: "+",
    },
    {
      label: labels.stats[2].label,
      sublabel: labels.stats[2].sublabel,
      value: "130M+",
      rawValue: 130,
      suffix: "M+",
    },
    {
      label: labels.stats[3].label,
      sublabel: labels.stats[3].sublabel,
      value: "98%",
      rawValue: 98,
      suffix: "%",
    },
  ];

  return (
    <section
      id="mosques"
      dir={isRTL ? "rtl" : "ltr"}
      className=" dark:bg-transparent bg-white py-20 lg:py-24"
    >
      <div className="max-w-304 mx-auto px-6 lg:px-8">
        <motion.div
          ref={ref}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          className={`flex flex-col lg:flex-row ${isRTL ? "lg:flex-row-reverse" : ""} items-start gap-12 lg:gap-16 ${isRTL ? "text-right" : ""}`}
        >
          {/* Left text */}
          <div className="flex-1 min-w-0">
            <motion.h2
              variants={slideRight}
              custom={0}
              className={`font-['Plus_Jakarta_Sans',sans-serif] font-extrabold text-[36px] leading-tight text-foreground mb-4 ${isRTL ? "text-right" : ""}`}
            >
              {labels.heading}
            </motion.h2>
            <motion.p
              variants={slideRight}
              custom={0.1}
              className={`font-['Plus_Jakarta_Sans',sans-serif] font-normal text-[16px] leading-[1.6] text-foreground/60 mb-8 max-w-120 ${isRTL ? "text-right mx-auto" : ""}`}
            >
              {labels.description}
            </motion.p>

            {/* Stat cards grid */}
            <div className="grid grid-cols-2 gap-4 max-w-xl">
              {stats.map((stat, i) => (
                <StatCard
                  key={stat.label + stat.sublabel}
                  value={stat.value}
                  rawValue={stat.rawValue}
                  suffix={stat.suffix}
                  label={stat.label}
                  sublabel={stat.sublabel}
                  inView={inView}
                  delay={i * 0.08 + 0.2}
                />
              ))}
            </div>

            <motion.button
              variants={fadeIn}
              custom={0.5}
              className="mt-6 flex items-center gap-2 text-primary font-['Plus_Jakarta_Sans',sans-serif] font-semibold text-[14px]"
              whileHover={{ x: 4 }}
              transition={{ duration: 0.2 }}
            >
              {labels.action}
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
          </div>

          {/* Right: Algeria map card */}
          <motion.div
            variants={slideLeft}
            custom={0.15}
            className="shrink-0 w-full lg:w-xl"
          >
            <motion.div
              className="bg-[#e8f5e9] rounded-3xl border border-[rgba(45,122,62,0.1)] p-6"
              whileHover={{ scale: 1.01 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d={svgPaths.p1f466f80}
                    stroke="#52B788"
                    strokeWidth="1.33"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={svgPaths.p17781bc0}
                    stroke="#52B788"
                    strokeWidth="1.33"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="font-['Plus_Jakarta_Sans',sans-serif] font-semibold text-[14px] text-[#1a2e1a]">
                  {labels.mapTitle}
                </span>
              </div>
              <motion.img
                src={imgAlgeriaMap}
                alt="Présence en Algérie"
                className="w-full rounded-2xl object-cover"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={inView ? { opacity: 1, scale: 1 } : {}}
                transition={{
                  duration: 0.7,
                  delay: 0.3,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />
              <div className="flex gap-4 mt-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#52b788]" />
                  <span className="font-['Plus_Jakarta_Sans',sans-serif] font-normal text-[12px] text-[#2b3a67]">
                    {labels.legend1}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[rgba(45,122,62,0.2)]" />
                  <span className="font-['Plus_Jakarta_Sans',sans-serif] font-normal text-[12px] text-[#2b3a67]">
                    {labels.legend2}
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
