import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import type { PipelineFieldErrors } from "./types";

// Every signed-in user may manage pipelines: sign-up is disabled, so only accounts an
// administrator created can sign in. Swap this for a role check when roles are added.
export async function getAuthorizedSession(request: Request) {
  return auth.api.getSession({ headers: request.headers });
}

export const unauthorized = () =>
  NextResponse.json({ error: "You are not signed in." }, { status: 401 });

export const notFound = () =>
  NextResponse.json(
    { error: "This pipeline no longer exists. It may have been deleted by someone else." },
    { status: 404 }
  );

export function validationError(errors: PipelineFieldErrors) {
  return NextResponse.json(
    { error: "Some fields need attention.", fieldErrors: errors },
    { status: 400 }
  );
}

export function duplicateCodeError(code: string) {
  return NextResponse.json(
    {
      error: "A pipeline with this ID already exists.",
      fieldErrors: { pipelineCode: `Pipeline ID ${code} is already in use. Choose another ID.` },
    },
    { status: 409 }
  );
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export const badBody = () =>
  NextResponse.json({ error: "The request could not be read." }, { status: 400 });

export function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export function isNotFound(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}
