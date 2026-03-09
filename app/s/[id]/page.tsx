import { LockKeyhole } from "lucide-react";
import { ReadSecret } from "@/components/read-secret";

export default async function SecretPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="page-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="/">
            <span className="brand-mark"><LockKeyhole size={18} /></span>
            <span>MessageEncrypt</span>
          </a>
        </div>
      </header>
      <main className="read-shell">
        <ReadSecret id={id} />
      </main>
    </div>
  );
}
