import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { PageNavLinks } from "@/components/page-nav-links";
import { PipelineManager } from "@/components/pipelines/pipeline-manager";

export const metadata: Metadata = { title: "Pipelines" };

export default function PipelinesPage() {
  return (
    <>
      <PageHeader
        title="Pipelines"
        description="Register, edit and remove pipeline segments. Changes appear on the map straight away."
        actions={<PageNavLinks current="/pipelines" />}
      />
      <PipelineManager />
    </>
  );
}
