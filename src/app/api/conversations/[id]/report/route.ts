import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { id } = await context.params;

  return NextResponse.json({
    conversationId: id,
    report: {
      totalUserMessages: 0,
      totalCorrections: 0,
      fluencyScore: 10,
      scoreLabel: "Ready",
      feedback: "No database connection is configured yet, so this conversation report is empty.",
      avgWordsPerTurn: 0,
      durationSeconds: 0,
      corrections: [],
    },
  });
}
