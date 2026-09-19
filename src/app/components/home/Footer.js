"use client";
import { imgMosqueLogo } from "@/lib/utils";

import { useInView, motion } from "framer-motion";
import { useRef } from "react";
import svgPaths from "@/imports/LandingPage/svg-zgxiiuzjal";
import { fadeIn, fadeUp } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";

export default function Footer() {
  const language = useLocale();
  const labels = useTranslations().raw("footer");
  const isRTL = language === "ar";
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  const footerCols = labels.sections;

  const socialIcons = [
    { path: svgPaths.p391f9d80, label: "Facebook" },
    { path: svgPaths.p36786300, label: "Twitter" },
    { path: svgPaths.p14dc0c00, label: "LinkedIn", extra: true },
  ];

  return (
    <footer className="bg-[#357e5c] py-14">
      <div className="max-w-[1216px] mx-auto px-6 lg:px-8">
        <motion.div
          ref={ref}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
        >
          <div className="flex flex-col lg:flex-row gap-12 pb-12">
            {/* Brand column */}
            <motion.div
              variants={fadeUp}
              custom={0}
              className="flex-shrink-0 w-full lg:w-[218px]"
            >
              <div className="flex items-center gap-2 mb-4">
                <img
                  src={imgMosqueLogo}
                  alt="ZAKAT Logo"
                  className="h-[43px] w-[32px] object-contain rounded-[5px]"
                />
                <div>
                  <p className="font-['Inter',sans-serif] font-bold text-[15px] tracking-[0.38px] text-[#efefef]">
                    ZAKAT
                  </p>
                  <p className="font-['Inter',sans-serif] font-normal text-[8.5px] text-[rgba(239,239,239,0.5)]">
                    Gérer. Distribuer. Impacter.
                  </p>
                </div>
              </div>
              <p className="font-['Plus_Jakarta_Sans',sans-serif] font-normal text-[14px] leading-[1.65] text-[rgba(239,239,239,0.5)] mb-4">
                {labels.brandText}
              </p>
              <div className="flex gap-3">
                {/* Facebook */}
                <motion.div
                  className="bg-[rgba(239,239,239,0.1)] rounded-[10px] w-8 h-8 flex items-center justify-center cursor-pointer"
                  whileHover={{
                    scale: 1.15,
                    backgroundColor: "rgba(239,239,239,0.2)",
                  }}
                  transition={{ duration: 0.2 }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d={svgPaths.p391f9d80}
                      stroke="#EFEFEF"
                      strokeWidth="1.33"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </motion.div>
                {/* Twitter */}
                <motion.div
                  className="bg-[rgba(239,239,239,0.1)] rounded-[10px] w-8 h-8 flex items-center justify-center cursor-pointer"
                  whileHover={{
                    scale: 1.15,
                    backgroundColor: "rgba(239,239,239,0.2)",
                  }}
                  transition={{ duration: 0.2 }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d={svgPaths.p36786300}
                      stroke="#EFEFEF"
                      strokeWidth="1.33"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </motion.div>
                {/* Instagram */}
                <motion.div
                  className="bg-[rgba(239,239,239,0.1)] rounded-[10px] w-8 h-8 flex items-center justify-center cursor-pointer"
                  whileHover={{
                    scale: 1.15,
                    backgroundColor: "rgba(239,239,239,0.2)",
                  }}
                  transition={{ duration: 0.2 }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <g clipPath="url(#clip_insta)">
                      <path
                        d={svgPaths.p22916300}
                        stroke="#EFEFEF"
                        strokeWidth="1.33"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d={svgPaths.p2c68500}
                        stroke="#EFEFEF"
                        strokeWidth="1.33"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M11.6667 4.33333H11.6733"
                        stroke="#EFEFEF"
                        strokeWidth="1.33"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                    <defs>
                      <clipPath id="clip_insta">
                        <rect fill="white" height="16" width="16" />
                      </clipPath>
                    </defs>
                  </svg>
                </motion.div>
                {/* LinkedIn */}
                <motion.div
                  className="bg-[rgba(239,239,239,0.1)] rounded-[10px] w-8 h-8 flex items-center justify-center cursor-pointer"
                  whileHover={{
                    scale: 1.15,
                    backgroundColor: "rgba(239,239,239,0.2)",
                  }}
                  transition={{ duration: 0.2 }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d={svgPaths.p14dc0c00}
                      stroke="#EFEFEF"
                      strokeWidth="1.33"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M4 6H1.33333V14H4V6Z"
                      stroke="#EFEFEF"
                      strokeWidth="1.33"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d={svgPaths.p342eb800}
                      stroke="#EFEFEF"
                      strokeWidth="1.33"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </motion.div>
              </div>
            </motion.div>

            {/* Link columns */}
            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-8">
              {footerCols.map((col, colIdx) => (
                <motion.div
                  key={col.heading}
                  variants={fadeUp}
                  custom={colIdx * 0.07 + 0.1}
                >
                  <p className="font-['Plus_Jakarta_Sans',sans-serif] font-bold text-[12px] uppercase tracking-[1.2px] text-[rgba(239,239,239,0.4)] mb-4">
                    {col.heading}
                  </p>
                  <div className="flex flex-col gap-2">
                    {col.links.map((link) => (
                      <motion.a
                        key={link}
                        href="#"
                        className="font-['Plus_Jakarta_Sans',sans-serif] font-normal text-[14px] text-[#efefef] hover:text-white transition-colors"
                        whileHover={{ x: 3 }}
                        transition={{ duration: 0.15 }}
                      >
                        {link}
                      </motion.a>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Bottom bar */}
          <motion.div
            variants={fadeIn}
            custom={0.4}
            className="border-t border-[rgba(239,239,239,0.1)] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4"
          >
            <p className="font-['Plus_Jakarta_Sans',sans-serif] font-normal text-[12px] text-[rgba(239,239,239,0.4)]">
              {labels.copyright}
            </p>
            <div className="flex gap-4">
              {labels.bottomLinks.map((link) => (
                <a
                  key={link}
                  href="#"
                  className="font-['Plus_Jakarta_Sans',sans-serif] font-normal text-[12px] text-[rgba(239,239,239,0.4)] hover:text-[rgba(239,239,239,0.7)] transition-colors"
                >
                  {link}
                </a>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </footer>
  );
}
