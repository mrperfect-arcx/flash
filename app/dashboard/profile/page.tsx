"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Image as ImageIcon, User } from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string>("");
  const [frontBg, setFrontBg] = useState<string>("");
  const [backBg, setBackBg] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const user = sess.session?.user;
      if (!user) {
        router.replace("/login");
        return;
      }
      setEmail(user.email || "");

      const { data } = await supabase
        .from("profiles")
        .select("front_bg_url,back_bg_url")
        .eq("id", user.id)
        .maybeSingle();

      setFrontBg(String((data as any)?.front_bg_url ?? ""));
      setBackBg(String((data as any)?.back_bg_url ?? ""));
      setLoading(false);
    })();
  }, [router]);

  async function save() {
    setMsg(null);
    setSaving(true);
    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (!user) {
      router.replace("/login");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .upsert(
        { id: user.id, front_bg_url: frontBg.trim() || null, back_bg_url: backBg.trim() || null },
        { onConflict: "id" }
      );

    setSaving(false);
    setMsg(error ? "Failed to save settings." : "Saved! Your card backgrounds will update automatically.");
  }

  return (
    <main className="min-h-dvh relative">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.22),transparent_60%),radial-gradient(ellipse_at_bottom,_rgba(236,72,153,0.16),transparent_60%),linear-gradient(to_bottom,_rgba(10,10,12,0.92),_rgba(10,10,12,0.72),_rgba(255,255,255,0.02))]" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-16">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" className="rounded-xl" onClick={() => router.push("/dashboard")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <User className="h-4 w-4" /> Profile
          </div>
        </div>

        <Card className="mt-6 rounded-3xl bg-background/45 border-white/10 backdrop-blur-xl p-6">
          <h1 className="text-xl font-semibold tracking-tight">Profile & card theme</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Set background images for your flashcards (front and back). Use direct image URLs.
          </p>

          {loading ? (
            <div className="mt-6 text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs text-muted-foreground">Signed in as</div>
                <div className="mt-1 font-medium break-all">{email}</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ImageIcon className="h-4 w-4" /> Front background URL
                  </div>
                  <input
                    className="mt-3 w-full h-11 rounded-2xl border border-white/10 bg-black/10 px-4 text-sm outline-none focus:ring-2 focus:ring-primary/35"
                    placeholder="https://.../front.jpg"
                    value={frontBg}
                    onChange={(e) => setFrontBg(e.target.value)}
                  />
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ImageIcon className="h-4 w-4" /> Back background URL
                  </div>
                  <input
                    className="mt-3 w-full h-11 rounded-2xl border border-white/10 bg-black/10 px-4 text-sm outline-none focus:ring-2 focus:ring-primary/35"
                    placeholder="https://.../back.jpg"
                    value={backBg}
                    onChange={(e) => setBackBg(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button className="rounded-2xl" onClick={save} disabled={saving}>
                  {saving ? "Saving…" : "Save settings"}
                </Button>
                {msg && <div className="text-sm text-muted-foreground">{msg}</div>}
              </div>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
                }
    
