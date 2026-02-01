"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock } from "lucide-react";

type HistoryRow = {
  id: string;
  created_at: string;
  title: string | null;
  requested_count: number | null;
  style: string | null;
  mode: string | null;
};

export default function HistoryPage() {
  const router = useRouter();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("generations")
        .select("id,created_at,title,requested_count,style,mode")
        .order("created_at", { ascending: false })
        .limit(50);

      if (!error && Array.isArray(data)) setRows(data as any);
      setLoading(false);
    })();
  }, [router]);

  return (
    <main className="min-h-dvh relative">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.22),transparent_60%),radial-gradient(ellipse_at_bottom,_rgba(236,72,153,0.16),transparent_60%),linear-gradient(to_bottom,_rgba(10,10,12,0.92),_rgba(10,10,12,0.72),_rgba(255,255,255,0.02))]" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-16">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" className="rounded-xl" onClick={() => router.push("/dashboard")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Clock className="h-4 w-4" /> History
          </div>
        </div>

        <Card className="mt-6 rounded-3xl bg-background/45 border-white/10 backdrop-blur-xl p-5">
          <h1 className="text-xl font-semibold tracking-tight">Your generations</h1>
          <p className="mt-1 text-sm text-muted-foreground">Last 50 flashcard generations saved to your account.</p>

          {loading ? (
            <div className="mt-6 text-sm text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="mt-6 text-sm text-muted-foreground">No history yet. Generate flashcards to see them here.</div>
          ) : (
            <div className="mt-6 space-y-3">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                  <div>
                    <div className="font-medium">{r.title || "Flashcards"}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()} • {r.mode || "auto"} • {r.style || "balanced"}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">{r.requested_count || "—"} cards</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}

