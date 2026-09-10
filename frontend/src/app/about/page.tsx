import type { Metadata } from "next";
import { AboutNavbar } from "@/components/about/AboutNavbar";
import { AboutHero } from "@/components/about/AboutHero";
import { AboutWhatIs } from "@/components/about/AboutWhatIs";
import { AboutWhyItMatters } from "@/components/about/AboutWhyItMatters";
import { AboutCpiConnection } from "@/components/about/AboutCpiConnection";
import { AboutProblemSolution } from "@/components/about/AboutProblemSolution";
import { AboutFourPillars } from "@/components/about/AboutFourPillars";
import { AboutMissionFooter } from "@/components/about/AboutMissionFooter";

export const metadata: Metadata = {
  title: "About VAYANTARA - From Airfare Movement to Economic Intelligence",
  description:
    "VAYANTARA transforms dynamic airfare data into a transparent, high-frequency Airfare Price Index (APIx) to support better economic measurement and policy decisions for India.",
};

export default function AboutPage() {
  return (
    <div className="bg-[#f8fafc] text-slate-800 font-sans antialiased overflow-x-hidden min-h-screen selection:bg-cyan-500 selection:text-black">
      <AboutNavbar />
      <main>
        <AboutHero />
        <AboutWhatIs />
        <AboutWhyItMatters />
        <AboutCpiConnection />
        <AboutProblemSolution />
        <AboutFourPillars />
      </main>
      <AboutMissionFooter />
    </div>
  );
}
