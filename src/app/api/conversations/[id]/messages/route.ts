import { getDb } from "@/db";
import { conversations, messages } from "@/db/schema";
import { generateProfXReply, type ChatTurn } from "@/lib/profx-engine";
import { asc, eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const db = getDb();
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.order), asc(messages.createdAt));
  return Response.json({ messages: rows });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const db = getDb();
  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const topic = typeof body?.topic === "string" ? body.topic : undefined;

  if (!text) {
    return Response.json({ error: "Message text is required." }, { status: 400 });
  }

  const existing = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  if (existing.length === 0) {
    return Response.json({ error: "Conversation not found." }, { status: 404 });
  }

  const priorMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.order), asc(messages.createdAt));

  const nextOrder = priorMessages.length;

  const [userMessage] = await db
    .insert(messages)
    .values({
      conversationId: id,
      role: "user",
      content: text,
      order: nextOrder,
    })
    .returning();

  const history: ChatTurn[] = priorMessages.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));

  const { reply, correction } = await generateProfXReply(text, history, topic as any);

  const [assistantMessage] = await db
    .insert(messages)
    .values({
      conversationId: id,
      role: "assistant",
      content: reply,
      correction,
      order: nextOrder + 1,
    })
    .returning();

  // Keep the conversation title fresh and bump updatedAt for sorting.
  const isFirstExchange = priorMessages.length === 0;
  await db
    .update(conversations)
    .set({
      updatedAt: new Date(),
      ...(isFirstExchange ? { title: text.slice(0, 60) } : {}),
    })
    .where(eq(conversations.id, id));

  return Response.json({ userMessage, assistantMessage });
}
