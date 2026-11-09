import PageClient from "./page.client";

export const instant = false;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PageClient runId={id} />;
}
