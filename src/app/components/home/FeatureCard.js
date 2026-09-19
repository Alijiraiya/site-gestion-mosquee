"use client";

import { motion } from "framer-motion";
import { fadeUp } from "@/lib/utils";

// ── Feature Card ─────────────────────────────────────────────────────────────

export default function FeatureCard({ icon, title, description, delay }) {
  return (
    <motion.div
      variants={fadeUp}
      custom={delay}
      className="bg-white/95 rounded-2xl border border-[rgba(45,122,62,0.15)] p-6 flex flex-col gap-4 group hover:shadow-[0_8px_30px_rgba(45,122,62,0.12)] transition-shadow duration-300"
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="bg-[#e8f5e9] rounded-2xl w-12 h-12 flex items-center justify-center"
        whileHover={{ scale: 1.1, rotate: 5 }}
        transition={{ duration: 0.25 }}
      >
        {icon}
      </motion.div>
      <h3 className="font-['Plus_Jakarta_Sans',sans-serif] font-bold text-[16px] text-[#1a2e1a]">{title}</h3>
      <p className="font-['Plus_Jakarta_Sans',sans-serif] font-normal text-[14px] leading-[1.65] text-[#2b3a67]">{description}</p>
    </motion.div>
  );
}
