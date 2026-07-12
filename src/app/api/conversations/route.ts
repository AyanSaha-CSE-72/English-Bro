import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ conversations: [] });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "New conversation";

  return NextResponse.json(
    {
      conversation: {
        id: crypto.randomUUID(),
        title,
        createdAt: new Date().toISOString(),
      },
    },
    { status: 201 }
  );
}