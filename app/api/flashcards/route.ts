import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type Flashcard = {
  question: string;
  answer: string;
  tags?: string[];
};

type Plan = "free" | "premium";

function extractJson(text: string): unknown {
  // Prefer fenced ```json blocks if present
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return JSON.parse(fenced[1]);

  // Fallback: first JSON object/array in the text
  const first = Math.min(...[text.indexOf("["), text.indexOf("{")].filter((n) => n !== -1));
  const last = Math.max(text.lastIndexOf("]"), text.lastIndexOf("}"));
  if (first !== Infinity && first >= 0 && last > first) {
    return JSON.parse(text.slice(first, last + 1));
  }
  throw new Error("Model did not return valid JSON");
}

function buildFlashcardPrompt(
  userText: string,
  count: number,
  style: string,
  mode: "auto" | "questions" | "short_notes"
): string {
  const modeRules =
    mode === "questions"
      ? `The input is a QUESTION BANK / practice set. Create flashcards where the FRONT is the question and the BACK is the correct answer/explanation.`
      : mode === "short_notes"
        ? `The input is SHORT NOTES / summaries. Create flashcards where the FRONT is a short prompt (term, heading, key idea) and the BACK is the explanation/steps/formula.`
        : `Auto-detect: if the input contains many questions ("?", Q:, MCQ, etc.) treat it as a question bank; otherwise treat it as notes.`;

  return `You are an expert flashcard creator.
Return ONLY valid JSON, no extra text.

Task:
- Create ${count} high-quality flashcards.
- Each flashcard MUST feel like a real flashcard: short, testable FRONT and a complete BACK.

${modeRules}

Output schema (exact):
{
  "title": string,
  "flashcards": [
    { "question": string, "answer": string, "tags": string[] }
  ]
}

Quality rules:
- FRONT (question) should be short and specific (max ~140 chars if possible).
- BACK (answer) should be structured and correct; use short bullet-like lines as plain text if needed.
- Avoid duplicate cards.
- If content is formula/steps, include them cleanly.
- Tags: 0-4 short tags per card.
- No markdown, no code fences.
- Style: ${style} (balanced = mix of definitions+concepts, exam = more application, simple = easy language)

INPUT:
${userText}`.trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const notes = String(body?.notes ?? "").trim();
    const count = Math.max(3, Math.min(50, Number(body?.count ?? 12)));
    const style = String(body?.style ?? "balanced");
    const mode = (String(body?.mode ?? "auto") as "auto" | "questions" | "short_notes");

    if (!notes) {
      return NextResponse.json({ error: "Notes are required" }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server misconfigured: missing GROQ_API_KEY" },
        { status: 500 }
      );
    }

    // ---- Auth (Supabase) + per-user rate limits ----
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Server misconfigured: missing Supabase server env vars" },
        { status: 500 }
      );
    }

    const authHeader = req.headers.get("authorization") || "";
    const accessToken = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7)
      : "";

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sb = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userErr } = await sb.auth.getUser(accessToken);
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = userData.user.id;

    // Determine plan
    const { data: profile } = await sb
      .from("profiles")
      .select("plan")
      .eq("id", userId)
      .maybeSingle();

    const plan: Plan = profile?.plan === "premium" ? "premium" : "free";

    let usedBefore = 0;

    // Free plan: limit 100 flashcards lifetime (simple + predictable)
    if (plan === "free") {
      const { data: usageRow } = await sb
        .from("usage")
        .select("flashcards_used")
        .eq("user_id", userId)
        .maybeSingle();

      const used = Number(usageRow?.flashcards_used ?? 0);
      usedBefore = used;
      const limit = 100;
      if (used + count > limit) {
        return NextResponse.json(
          {
            error: "Free plan limit reached",
            details: `Free users can generate up to ${limit} flashcards. You have ${used} used.`,
            used,
            limit,
          },
          { status: 402 }
        );
      }
    }

    const prompt = buildFlashcardPrompt(notes, count, style, mode);

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You output only valid JSON." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!groqRes.ok) {
      const details = await groqRes.text();
      return NextResponse.json(
        { error: "Groq request failed", details },
        { status: groqRes.status }
      );
    }

    const data = await groqRes.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content;

    if (!text) {
      return NextResponse.json({ error: "No response from Groq" }, { status: 502 });
    }

    const parsed = (() => {
      try {
        return JSON.parse(text);
      } catch {
        return extractJson(text);
      }
    })() as any;

    const title = String(parsed?.title ?? "Flashcards");
    const flashcards = Array.isArray(parsed?.flashcards) ? parsed.flashcards : [];

    const cleaned: Flashcard[] = flashcards
      .map((c: any) => ({
        question: String(c?.question ?? "").trim(),
        answer: String(c?.answer ?? "").trim(),
        tags: Array.isArray(c?.tags) ? c.tags.map((t: any) => String(t)).slice(0, 6) : [],
      }))
      .filter((c: Flashcard) => c.question && c.answer)
      .slice(0, count);

    // Save history + usage (non-blocking)
    (async () => {
      try {
        await sb.from("generations").insert({
          user_id: userId,
          input: notes,
          mode,
          style,
          requested_count: count,
          title,
          output: { title, flashcards: cleaned },
        });

        if (plan === "free") {
          const nextUsed = usedBefore + cleaned.length;
          await sb
            .from("usage")
            .upsert({ user_id: userId, flashcards_used: nextUsed }, { onConflict: "user_id" });
        }
      } catch {
        // ignore
      }
    })();

    return NextResponse.json({ title, flashcards: cleaned });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
