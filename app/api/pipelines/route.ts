import { NextResponse } from "next/server";
import {
  badBody,
  duplicateCodeError,
  getAuthorizedSession,
  isUniqueViolation,
  readJson,
  unauthorized,
  validationError,
} from "@/lib/pipelines/api";
import { pipelineInclude, toPipelineData, toPipelineDto } from "@/lib/pipelines/serialize";
import { parsePipelineInput } from "@/lib/pipelines/validation";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getAuthorizedSession(request);
  if (!session) return unauthorized();

  const pipelines = await prisma.pipeline.findMany({
    orderBy: { createdAt: "desc" },
    take: 2000,
    include: pipelineInclude,
  });

  // Never cache this list anywhere, so every client sees a change straight away.
  return NextResponse.json(
    { pipelines: pipelines.map(toPipelineDto) },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

export async function POST(request: Request) {
  const session = await getAuthorizedSession(request);
  if (!session) return unauthorized();

  const body = await readJson(request);
  if (!body) return badBody();

  const parsed = parsePipelineInput(body);
  if (!parsed.ok) return validationError(parsed.errors);
  const input = parsed.data;

  // Checked up front for a friendly message; the unique index still guards against races.
  const existing = await prisma.pipeline.findUnique({
    where: { pipelineCode: input.pipelineCode },
    select: { id: true },
  });
  if (existing) return duplicateCodeError(input.pipelineCode);

  try {
    const pipeline = await prisma.pipeline.create({
      data: {
        ...toPipelineData(input),
        createdById: session.user.id,
        updatedById: session.user.id,
      },
      include: pipelineInclude,
    });
    return NextResponse.json({ pipeline: toPipelineDto(pipeline) }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) return duplicateCodeError(input.pipelineCode);
    console.error("Saving pipeline failed:", error);
    return NextResponse.json(
      { error: "The pipeline could not be saved. Please try again." },
      { status: 500 }
    );
  }
}
