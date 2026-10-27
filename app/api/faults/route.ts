import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteFaultPhoto, uploadFaultPhoto } from "@/lib/cloudinary";
import {
  getFaultSeverityLabel,
  getFaultTypeLabel,
} from "@/lib/faults/constants";
import { faultReportInclude, toFaultDto } from "@/lib/faults/serialize";
import { parseFaultForm } from "@/lib/faults/validation";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "You are not signed in." }, { status: 401 });
  }

  const reports = await prisma.faultReport.findMany({
    orderBy: { createdAt: "desc" },
    take: 1000,
    include: faultReportInclude,
  });

  return NextResponse.json({ faults: reports.map(toFaultDto) });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "You are not signed in." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "The request could not be read." }, { status: 400 });
  }

  const parsed = parseFaultForm(formData);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { photo, ...fields } = parsed.data;

  let uploadedPhoto;
  try {
    uploadedPhoto = await uploadFaultPhoto(photo);
  } catch (error) {
    console.error("Fault photo upload failed:", error);
    return NextResponse.json(
      { error: "The photograph could not be uploaded. Please try again." },
      { status: 502 }
    );
  }

  try {
    const { report, notifiedCount } = await prisma.$transaction(async (transaction) => {
      const report = await transaction.faultReport.create({
        data: {
          ...fields,
          reportedById: session.user.id,
          photos: {
            create: {
              cloudinaryPublicId: uploadedPhoto.publicId,
              url: uploadedPhoto.url,
              width: uploadedPhoto.width,
              height: uploadedPhoto.height,
            },
          },
        },
        include: faultReportInclude,
      });

      // Everyone except the reporter is notified. The notification bell is built in the next phase.
      const recipients = await transaction.user.findMany({
        where: { id: { not: session.user.id } },
        select: { id: true },
      });

      if (recipients.length > 0) {
        await transaction.notification.createMany({
          data: recipients.map((recipient) => ({
            userId: recipient.id,
            type: "FAULT_REPORTED" as const,
            title: "New pipeline fault reported",
            body: `${getFaultSeverityLabel(fields.severity)} · ${getFaultTypeLabel(fields.faultType)}: ${fields.title} (reported by ${session.user.name})`,
            faultReportId: report.id,
          })),
        });
      }

      return { report, notifiedCount: recipients.length };
    });

    return NextResponse.json(
      { fault: toFaultDto(report), notifiedCount },
      { status: 201 }
    );
  } catch (error) {
    console.error("Saving fault report failed:", error);
    // Do not leave an orphaned photograph in Cloudinary.
    await deleteFaultPhoto(uploadedPhoto.publicId).catch(() => undefined);
    return NextResponse.json(
      { error: "The report could not be saved. Please try again." },
      { status: 500 }
    );
  }
}