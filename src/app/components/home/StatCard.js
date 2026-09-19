"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { fadeUp } from "@/lib/utils";
import { useCounter } from "@/lib/utils";
// ── Stat Card ──────────────────────────────────────────────────────────────

export default function StatCard({ value, rawValue, suffix, label, sublabel, inView, delay }) {
  const count = useCounter(rawValue, inView, 1400);
  const displayValue = rawValue > 0 ? `${count.toLocaleString()}${suffix}` : value;

  return (
    <motion.div
      variants={fadeUp}
      custom={delay}
      className="bg-[#fff5e9] rounded-2xl border border-[rgba(45,122,62,0.1)] p-4 flex flex-col gap-1"
      whileHover={{ scale: 1.03 }}
      transition={{ duration: 0.25 }}
    >
      <span className="font-['Plus_Jakarta_Sans',sans-serif] font-extrabold text-[24px] text-[#52b788]">
        {displayValue}
      </span>
      <span className="font-['Plus_Jakarta_Sans',sans-serif] font-semibold text-[14px] text-[#1a2e1a]">{label}</span>
      <span className="font-['Plus_Jakarta_Sans',sans-serif] font-normal text-[12px] text-[#2b3a67]">{sublabel}</span>
    </motion.div>
  );
}
