import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { asc, eq, isNotNull, and } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function scoreLabel(score: number): { label: string; feedback: string } {
  if (score >= 9) {
    return {
      label: "Excellent",
      feedback: "Your spoken English is fluent and clean — you're speaking with real confidence!",
    };
  }
  if (score >= 7) {
    return {
      label: "Strong",
      feedback: "You're doing great! Just a few small slips to iron out and you'll sound even more natural.",
    };
  }
  if (score >= 5) {
    return {
      label: "Good progress",
      feedback: "Solid effort — keep practicing the corrections below and you'll level up quickly.",
    };
  }
  return {
    label: "Keep practicing",
    feedback: "You're building a great habit by speaking often. Review the tips below and try again soon!",
  };
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const conversationRows = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  if (conversationRows.length === 0) {
    return Response.json({ error: "Conversation not found." }, { status: 404 });
  }

  const allMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.order), asc(messages.createdAt));

  const correctionRows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.conversationId, id), isNotNull(messages.correction)));

  const userMessages = allMessages.filter((m) => m.role === "user");
  const totalUserMessages = userMessages.length;
  const totalCorrections = correctionRows.length;

  const correctionRate = totalUserMessages > 0 ? totalCorrections / totalUserMessages : 0;
  const rawScore = 10 - correctionRate * 10;
  const fluencyScore = Math.max(1, Math.min(10, Math.round(rawScore)));

  const avgWordsPerTurn =
    totalUserMessages > 0
      ? Math.round(
          (userMessages.reduce((sum, m) => sum + m.content.trim().split(/\s+/).filter(Boolean).length, 0) /
            totalUserMessages) *
            10
        ) / 10
      : 0;

  const startedAt = allMessages[0]?.createdAt ?? conversationRows[0].createdAt;
  const endedAt = allMessages[allMessages.length - 1]?.createdAt ?? startedAt;
  const durationSeconds = Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000));

  const { label, feedback } = scoreLabel(fluencyScore);

  return Response.json({
    conversationTitle: conversationRows[0].title,
    totalUserMessages,
    totalCorrections,
    fluencyScore,
    scoreLabel: label,
    feedback,
    avgWordsPerTurn,
    durationSeconds,
    corrections: correctionRows.map((m) => ({ id: m.id, correction: m.correction, order: m.order })),
  });
}
