"use client";

import { fadeIn, slideLeft, slideRight } from "@/lib/utils";
import { useInView, motion } from "framer-motion";
import { useRef } from "react";
import svgPaths from "@/imports/LandingPage/svg-zgxiiuzjal";
import { useLocale, useTranslations } from "next-intl";

export default function ContactSection() {
  const language = useLocale();
  const labels = useTranslations().raw("contact");
  const isRTL = language === "ar";
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section
      id="contact"
      className="dark:bg-transparent bg-[#f8f9fa] py-16 lg:py-20"
    >
      <div className="max-w-304 mx-auto px-6 lg:px-8 ">
        <motion.div
          ref={ref}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          className="bg-[#f8f9fa] rounded-[10px] flex flex-col lg:flex-row items-start gap-12 px-6 py-8"
        >
          {/* Left */}
          <motion.div
            variants={slideRight}
            custom={0}
            className="flex-1 min-w-0"
          >
            <p className="font-['Plus_Jakarta_Sans',sans-serif] font-bold text-[12px] uppercase tracking-[1.2px] text-[rgba(17,17,17,0.7)] mb-3">
              {labels.sectionHeading}
            </p>
            <h2
              className={`font-['Plus_Jakarta_Sans',sans-serif] font-extrabold text-[36px] leading-[1.25] text-[#111] mb-4 ${isRTL ? "text-right" : ""}`}
            >
              {labels.title}
            </h2>
            <p
              className={`font-['Plus_Jakarta_Sans',sans-serif] font-normal text-[16px] leading-[1.65] text-[rgba(17,17,17,0.7)] max-w-[480px] ${isRTL ? "text-right" : ""}`}
            >
              {labels.subtitle}
            </p>
          </motion.div>

          {/* Right */}
          <motion.div
            variants={slideLeft}
            custom={0.1}
            className="flex flex-col gap-4 w-full lg:w-auto lg:min-w-[584px]"
          >
            {/* Email */}
            <motion.div
              className="bg-[rgba(17,17,17,0.05)] border border-[rgba(255,255,255,0.2)] rounded-2xl px-5 py-4 flex items-center gap-4"
              whileHover={{
                scale: 1.02,
                backgroundColor: "rgba(17,17,17,0.07)",
              }}
              transition={{ duration: 0.2 }}
            >
              <div className="bg-[rgba(255,255,255,0.2)] rounded-2xl w-10 h-10 flex items-center justify-center flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d={svgPaths.pd919a80}
                    stroke="#111111"
                    strokeWidth="1.67"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={svgPaths.p189c1170}
                    stroke="#111111"
                    strokeWidth="1.67"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div>
                <p className="font-['Plus_Jakarta_Sans',sans-serif] font-normal text-[12px] text-[rgba(17,17,17,0.75)]">
                  Email
                </p>
                <p className="font-['Plus_Jakarta_Sans',sans-serif] font-semibold text-[16px] text-[#111]">
                  contact@zakat.dz
                </p>
              </div>
            </motion.div>

            {/* Phone */}
            <motion.div
              className="bg-[rgba(17,17,17,0.05)] border border-[rgba(255,255,255,0.2)] rounded-2xl px-5 py-4 flex items-center gap-4"
              whileHover={{
                scale: 1.02,
                backgroundColor: "rgba(17,17,17,0.07)",
              }}
              transition={{ duration: 0.2 }}
            >
              <div className="bg-[rgba(255,255,255,0.2)] rounded-2xl w-10 h-10 flex items-center justify-center flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <g clipPath="url(#clip_contact)">
                    <path
                      d={svgPaths.p1a7ce800}
                      stroke="#111111"
                      strokeWidth="1.67"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                  <defs>
                    <clipPath id="clip_contact">
                      <rect fill="white" height="20" width="20" />
                    </clipPath>
                  </defs>
                </svg>
              </div>
              <div>
                <p className="font-['Plus_Jakarta_Sans',sans-serif] font-normal text-[12px] text-[rgba(17,17,17,0.75)]">
                  Téléphone
                </p>
                <p className="font-['Plus_Jakarta_Sans',sans-serif] font-semibold text-[16px] text-[#111]">
                  +213 5 123 456 78
                </p>
              </div>
            </motion.div>

            {/* Tags */}
            <motion.div
              variants={fadeIn}
              custom={0.2}
              className="flex gap-3 flex-wrap"
            >
              {["Réponse rapide", "Support dédié", "Gratuit 30j"].map(
                (tag, i) => (
                  <motion.span
                    key={tag}
                    className="bg-[rgba(17,17,17,0.1)] border border-[rgba(255,255,255,0.2)] rounded-2xl px-4 py-2 font-['Plus_Jakarta_Sans',sans-serif] font-normal text-[14px] text-[rgba(17,17,17,0.7)]"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={inView ? { opacity: 1, scale: 1 } : {}}
                    transition={{ duration: 0.35, delay: 0.3 + i * 0.08 }}
                    whileHover={{ scale: 1.05 }}
                  >
                    {tag}
                  </motion.span>
                ),
              )}
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
