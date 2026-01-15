import { Metadata } from 'next';
import { SurvivalGame } from '@/components/survival';

export const metadata: Metadata = {
  title: 'Claude Survival Game | GOD AI vs SURVIVOR AI',
  description: 'Watch Claude (AI) try to survive in a hostile forest controlled by another AI. A dual-AI survival experiment with live chat.',
  openGraph: {
    title: 'Claude Survival Game',
    description: 'GOD AI vs SURVIVOR AI - Can Claude survive The Forest?',
    type: 'website',
  },
};

export default function SurvivalPage() {
  return <SurvivalGame />;
}
