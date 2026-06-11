"use client";

import { useState, useTransition } from "react";
import { askConciergeAction } from "@/domains/concierge/actions";

type Turn = {
  role: "user" | "assistant";
  text: string;
  citations?: { id: string; topic: string }[];
};

export function ConciergeChat() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([
    {
      role: "assistant",
      text: "Hi — ask me anything about the AI Champions program. I'll cite the program FAQ.",
    },
  ]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();

  function send() {
    if (!input.trim()) return;
    const userTurn: Turn = { role: "user", text: input };
    setTurns((prev) => [...prev, userTurn]);
    const question = input;
    setInput("");
    startTransition(async () => {
      const res = await askConciergeAction({ question });
      if (!res.ok) {
        setTurns((prev) => [
          ...prev,
          { role: "assistant", text: `Error: ${res.error}` },
        ]);
        return;
      }
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          text: res.data.text,
          citations: res.data.citations.map((c) => ({
            id: c.id,
            topic: c.topic,
          })),
        },
      ]);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 rounded-full bg-gradient-to-br from-brand to-brand-hover p-3.5 text-brand-fg shadow-lift transition-transform hover:scale-105 active:scale-95"
        aria-label="Open AI Concierge"
      >
        💬
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex h-[28rem] w-96 flex-col rounded-lg border border-surface-border bg-surface shadow-2xl">
      <div className="flex items-center justify-between border-b border-surface-border bg-brand px-3 py-2 text-brand-fg">
        <div className="font-semibold">AI Concierge</div>
        <button
          onClick={() => setOpen(false)}
          className="text-brand-fg/80 hover:text-white"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
        {turns.map((t, i) => (
          <div
            key={i}
            className={t.role === "user" ? "text-right" : "text-left"}
          >
            <div
              className={`inline-block whitespace-pre-wrap rounded-lg px-3 py-2 ${
                t.role === "user"
                  ? "bg-brand text-brand-fg"
                  : "bg-surface-subtle text-gray-800"
              }`}
            >
              {t.text}
            </div>
            {t.citations && t.citations.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {t.citations.map((c) => (
                  <span
                    key={c.id}
                    className="pill bg-gray-100 text-gray-600"
                    title={c.id}
                  >
                    {c.topic}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {pending && (
          <div className="text-left text-gray-500">…</div>
        )}
      </div>
      <div className="border-t border-surface-border p-2 flex gap-2">
        <input
          className="v3-input flex-1"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          placeholder="Ask about tiers, ROI, approvals…"
        />
        <button onClick={send} disabled={pending} className="v3-btn-primary">
          Send
        </button>
      </div>
    </div>
  );
}
