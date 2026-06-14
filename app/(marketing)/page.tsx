import { Hero } from '@/components/marketing/Hero';
import { AboutSection } from '@/components/marketing/AboutSection';
import { FeatureSection } from '@/components/marketing/FeatureSection';

export default function Home() {
  return (
    <main>
      <Hero />
      <AboutSection />
      <FeatureSection />
    </main>
  );
}
