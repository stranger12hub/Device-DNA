'use client';

import { motion } from 'framer-motion';
import { ArrowRight, BriefcaseBusiness, Smartphone } from 'lucide-react';
import { LogoMark, PrimaryButton } from '@/components/device-dna';

export default function RolePage() {
  return (
    <main className="min-h-screen bg-device-ice p-4 text-device-ink">
      <section className="subtle-blue-field mx-auto flex min-h-[calc(100vh-32px)] max-w-[1440px] flex-col justify-between border border-device-darkBorder p-5 text-white md:p-8">
        <div className="flex items-center justify-between">
          <LogoMark />
          <span className="hidden text-xs uppercase tracking-[0.18em] text-white/60 md:block">Read-only records. Permanent history.</span>
        </div>
        <div className="grid gap-8 py-10 md:grid-cols-[1fr_0.9fr] md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-device-cyan">Device DNA</p>
            <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-tight md:text-7xl">The complete history of your device.</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/70">Track ownership, repair records, components, warranties, and public QR passports for phones and laptops.</p>
          </div>
          <div className="grid gap-3">
            <RoleCard icon={<Smartphone />} title="Continue as owner" body="Manage registered devices, warranties, documents, and public passports." href="/owner/home" />
            <RoleCard icon={<BriefcaseBusiness />} title="Continue as technician" body="Create permanent repair records and correction entries that build trust." href="/technician/home" />
          </div>
        </div>
      </section>
    </main>
  );
}

function RoleCard({ icon, title, body, href }: { icon: React.ReactNode; title: string; body: string; href: string }) {
  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.18 }} className="border border-white/20 bg-white p-5 text-device-ink">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-device-border bg-device-ice text-device-blue">{icon}</div>
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-device-slate">{body}</p>
          <div className="mt-5"><PrimaryButton href={href}>Open workspace <ArrowRight size={16} /></PrimaryButton></div>
        </div>
      </div>
    </motion.div>
  );
}
