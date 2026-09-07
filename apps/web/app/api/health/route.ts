import { NextResponse } from "next/server";
import { prisma } from "@docupulse/db";
export async function GET() {
  const projects = await prisma.project.count();
  return NextResponse.json({ ok: true, projects, time: new Date().toISOString() });
}
