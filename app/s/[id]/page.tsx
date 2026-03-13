import { ReadSecret } from "@/components/read-secret";
import { SiteHeader } from "@/components/site-header";

export default async function SecretPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="read-shell">
        <ReadSecret id={id} />
      </main>
    </div>
  );
}
