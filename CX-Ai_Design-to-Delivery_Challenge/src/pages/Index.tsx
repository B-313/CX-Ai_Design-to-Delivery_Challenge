import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import TechniquesSection from "@/components/TechniquesSection";
import ExamplesSection from "@/components/ExamplesSection";
import PrinciplesSection from "@/components/PrinciplesSection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <TechniquesSection />
      <ExamplesSection />
      <PrinciplesSection />
      <Footer />
    </div>
  );
};

export default Index;
