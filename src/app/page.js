import ContactSection from "./components/home/ContactSection";
import FeaturesSection from "./components/home/FeaturesSection";
import Footer from "./components/home/Footer";
import Header from "./components/home/Header";
import HeroSection from "./components/home/HeroSection";
import StatsSection from "./components/home/StatsSection";

// ── App ────────────────────────────────────────────────────────────────────
export default function Home() {
  return (
    <div className="    bg-background dark:bg-linear-[142deg] dark:from-0% dark:from-[#223D8F] dark:to-[#0A1129] dark:to-40% min-h-screen w-full font-['Plus_Jakarta_Sans',sans-serif]">
      <Header />
      <HeroSection />
      <FeaturesSection />
      <StatsSection />
      <ContactSection />
      <Footer />
    </div>
  );
}
