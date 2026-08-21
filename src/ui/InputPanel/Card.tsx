import type { ReactNode } from "react";

interface CardProps {
  title: string;
  children: ReactNode;
}

/* ==========================================
   CARD
========================================== */

export function Card({
  title,
  children
}: CardProps) {
  return (
    <section className="bg-gradient-to-br from-[#121826] to-[#0f172a] p-6 rounded-2xl border border-zinc-800 shadow-xl backdrop-blur">
      <h2 className="text-sm text-zinc-400 mb-4 text-center font-semibold tracking-wide relative">
        <span className="px-3 bg-[#121826] relative z-10">
          {title}
        </span>

        <div className="absolute top-1/2 left-0 w-full h-[1px] bg-zinc-700 -z-0" />
      </h2>

      <div className="space-y-1">
        {children}
      </div>
    </section>
  );
}
