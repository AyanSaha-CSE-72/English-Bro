import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { id } = await context.params;

  return NextResponse.json({
    conversationId: id,
    messages: [],
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  const body = await request.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const role = body.role === "assistant" ? "assistant" : "user";

  return NextResponse.json(
    {
      conversationId: id,
      message: {
        id: crypto.randomUUID(),
        role,
        content,
        createdAt: new Date().toISOString(),
      },
    },
    { status: 201 }
  );
}
