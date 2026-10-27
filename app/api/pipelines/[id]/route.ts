import { NextResponse } from "next/server";
import {
  badBody,
  duplicateCodeError,
  getAuthorizedSession,
  isNotFound,
  isUniqueViolation,
  notFound,
  readJson,
  unauthorized,
  validationError,
} from "@/lib/pipelines/api";
import { pipelineInclude, toPipelineData, toPipelineDto } from "@/lib/pipelines/serialize";
import { parsePipelineInput } from "@/lib/pipelines/validation";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const session = await getAuthorizedSession(request);
  if (!session) return unauthorized();

  const { id } = await context.params;
  const pipeline = await prisma.pipeline.findUnique({ where: { id }, include: pipelineInclude });
  if (!pipeline) return notFound();

  return NextResponse.json({ pipeline: toPipelineDto(pipeline) });
}

export async function PATCH(request: Request, context: Context) {
  const session = await getAuthorizedSession(request);
  if (!session) return unauthorized();

  const { id } = await context.params;
  const body = await readJson(request);
  if (!body) return badBody();

  // Edits send the full record, so the same validation as creation applies.
  const parsed = parsePipelineInput(body);
  if (!parsed.ok) return validationError(parsed.errors);
  const input = parsed.data;

  const current = await prisma.pipeline.findUnique({ where: { id }, select: { id: true } });
  if (!current) return notFound();

  const clash = await prisma.pipeline.findFirst({
    where: { pipelineCode: input.pipelineCode, id: { not: id } },
    select: { id: true },
  });
  if (clash) return duplicateCodeError(input.pipelineCode);

  try {
    const pipeline = await prisma.pipeline.update({
      where: { id },
      data: { ...toPipelineData(input), updatedById: session.user.id },
      include: pipelineInclude,
    });
    return NextResponse.json({ pipeline: toPipelineDto(pipeline) });
  } catch (error) {
    if (isUniqueViolation(error)) return duplicateCodeError(input.pipelineCode);
    if (isNotFound(error)) return notFound();
    console.error("Updating pipeline failed:", error);
    return NextResponse.json(
      { error: "The pipeline could not be updated. Please try again." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: Context) {
  const session = await getAuthorizedSession(request);
  if (!session) return unauthorized();

  const { id } = await context.params;
  try {
    await prisma.pipeline.delete({ where: { id } });
    return NextResponse.json({ id });
  } catch (error) {
    if (isNotFound(error)) return notFound();
    console.error("Deleting pipeline failed:", error);
    return NextResponse.json(
      { error: "The pipeline could not be deleted. Please try again." },
      { status: 500 }
    );
  }
}
