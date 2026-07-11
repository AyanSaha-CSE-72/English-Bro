import { db } from "@/db";
import { conversations } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(conversations).orderBy(desc(conversations.updatedAt)).limit(20);
  return Response.json({ conversations: rows });
}

export async function POST() {
  const [conversation] = await db.insert(conversations).values({}).returning();
  return Response.json({ conversation });
}
