// Every conversation on this device, grouped by day and searchable.
import { motion } from "framer-motion";
import { MessageSquare, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ease } from "../components/ui";
import { groupByDay, useThreads } from "../lib/threads";
import { useStudio } from "./StudioContext";

export default function HistoryPage() {
  const { threads, remove } = useThreads();
  const { openThread } = useStudio();
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const all = threads.filter((t) => t.msgs.length);
    return s ? all.filter((t) => t.title.toLowerCase().includes(s) || t.msgs.some((m) => m.content.toLowerCase().includes(s))) : all;
  }, [threads, q]);

  return (
    <div className="mx-auto w-full max-w-[780px] px-4 pb-44 pt-8 sm:px-6 sm:pt-12">
      <p className="eyebrow">History</p>
      <h1 className="display mt-3 text-[48px] sm:text-[60px]">Your conversations</h1>
      <p className="mt-3 text-sm text-mist-soft">Kept only in this browser. Clear them any time from your profile menu.</p>
      <div className="relative mt-8">
        <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mist-faint" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conversations" className="w-full rounded-2xl border border-edge bg-white/[0.035] py-3 pl-11 pr-4 text-sm text-mist outline-none transition placeholder:text-mist-faint focus:border-white/25" />
      </div>
      {shown.length === 0 && <p className="mt-12 text-center text-sm text-mist-faint">{q ? "Nothing matches that search." : "No conversations yet — ask the stylist anything to start one."}</p>}
      <div className="mt-8 space-y-8">
        {groupByDay(shown).map((g) => (
          <section key={g.label}>
            <p className="eyebrow mb-2 !text-[9.5px]">{g.label}</p>
            <div className="divide-y divide-white/[0.05] overflow-hidden rounded-2xl border border-edge bg-white/[0.02]">
              {g.items.map((t, i) => {
                const lastAnswer = [...t.msgs].reverse().find((m) => m.role === "assistant" && m.content)?.content ?? "";
                return (
                  <motion.div key={t.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03, duration: 0.35, ease }} className="group flex items-center gap-3 px-4 py-3.5 transition hover:bg-white/[0.04]">
                    <MessageSquare size={15} className="shrink-0 text-mist-faint" />
                    <button onClick={() => openThread(t.id)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm text-mist">{t.title}</span>
                      <span className="block truncate text-xs text-mist-faint">{lastAnswer.replace(/[*_#]/g, "").slice(0, 120) || `${t.msgs.length} messages`}</span>
                    </button>
                    <span className="hidden shrink-0 text-[11px] text-mist-faint sm:block">{new Date(t.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    <button onClick={() => remove(t.id)} aria-label="Delete conversation" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-mist-faint opacity-60 transition hover:bg-white/[0.08] hover:text-mist group-hover:opacity-100"><Trash2 size={14} /></button>
                  </motion.div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
