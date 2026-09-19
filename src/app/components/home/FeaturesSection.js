"use client";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import svgPaths from "@/imports/LandingPage/svg-zgxiiuzjal";
import FeatureCard from "./FeatureCard";
import { fadeUp } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";

// ── Features Section ───────────────────────────────────────────────────────
export default function FeaturesSection() {
  const  language = useLocale();
  const labels = useTranslations().raw("features");
  const isRTL = language === "ar";
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  const icons = [
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d={svgPaths.p15a56410}
        stroke="#52B788"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 8V21"
        stroke="#52B788"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={svgPaths.pb845c00}
        stroke="#52B788"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={svgPaths.p31fb2b00}
        stroke="#52B788"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>,
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d={svgPaths.p1d820380}
        stroke="#52B788"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={svgPaths.p161d4800}
        stroke="#52B788"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={svgPaths.p2981fe00}
        stroke="#52B788"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={svgPaths.p13e20900}
        stroke="#52B788"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>,
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d={svgPaths.pd5bb600}
        stroke="#52B788"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 6H16"
        stroke="#52B788"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 14V18"
        stroke="#52B788"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 10H16.01"
        stroke="#52B788"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 10H12.01"
        stroke="#52B788"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 10H8.01"
        stroke="#52B788"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 14H12.01"
        stroke="#52B788"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 14H8.01"
        stroke="#52B788"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>,
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d={svgPaths.p1d820380}
        stroke="#52B788"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={svgPaths.p161d4800}
        stroke="#52B788"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 11L18 13L22 9"
        stroke="#52B788"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>,
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d={svgPaths.p36c5af80}
        stroke="#52B788"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 17V9"
        stroke="#52B788"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13 17V5"
        stroke="#52B788"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 17V14"
        stroke="#52B788"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>,
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d={svgPaths.p3f3d8e00}
        stroke="#52B788"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>,
  ];

  const features = labels.cards.map((card, index) => ({
    title: card.title,
    description: card.description,
    icon: icons[index] ?? icons[0],
  }));

  return (
    <section
      id="features"
      dir={isRTL ? "rtl" : "ltr"}
      className=" bg-background py-20 lg:py-24"
    >
      <div className="max-w-304 mx-auto px-6 lg:px-8">
        <motion.div
          ref={ref}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          className="flex flex-col gap-12"
        >
          <motion.div variants={fadeUp} custom={0} className="text-center">
            <h2
              className={`font-['Plus_Jakarta_Sans',sans-serif] font-extrabold text-[36px] text-foreground mb-2 `}
            >
              {labels.heading}
            </h2>
            <p className="font-['Plus_Jakarta_Sans',sans-serif] font-bold text-[30px] text-primary">
              {labels.subheading}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <FeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                delay={i * 0.08}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
