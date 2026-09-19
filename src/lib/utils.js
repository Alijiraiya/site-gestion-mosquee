import { useEffect, useState } from "react";

// ── Shared animation variants ──────────────────────────────────────────────
export  const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1], delay },
  }),
};

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: (delay = 0) => ({
    opacity: 1,
    transition: { duration: 0.6, ease: "easeOut", delay },
  }),
};

export const slideRight = {
  hidden: { opacity: 0, x: -50 },
  visible: (delay = 0) => ({
    opacity: 1,
    x: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1], delay },
  }),
};

export const slideLeft = {
  hidden: { opacity: 0, x: 50 },
  visible: (delay = 0) => ({
    opacity: 1,
    x: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1], delay },
  }),
};

export function useCounter(target, inView, duration = 1600) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [inView, target, duration]);
  return count;
}

// ── Section wrapper with scroll-triggered animations ──────────────────────
export function AnimatedSection({ children, className = "" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export const gMosqueImage = "/97f5173d92884b47399e93d40f6ebe8eb64b873e.png";
export const imgLogo = "/6e3485467acbb315086028bdde0482cf3ac97239.png";

export const imgMosqueLogo = "/2d19207046d3666beef75f5018e7dbf5b8439ee7.png";
export const imgAlgeriaMap = "/a274c7c33299206dd21bae1731134006bf1c01a5.png";
export const loginImg = "/ondrej-bocek-FUmAMxL78Z8-unsplash.jpg";
export const registerImg = "/haidan-Qec3HPaHWTI-unsplash.jpg";
export const textLang = {
  "fr":{
    "logo":"",
    "header":{
      "links":["","","",""],
      "button":""
    },
    "hero":{
      "big":["","",""],
      "small":"",
      "very-small":["","",""],
      "buttons":["",""]
    }  
  },"ar":{

  }
}
