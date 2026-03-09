"use client";

import { useState } from "react";
import { decryptSecret } from "@/lib/crypto";

function readSecretPartsFromHash() {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return { token: "", passphrase: "" };

  const separatorIndex = hash.indexOf(".");
  if (separatorIndex === -1) return { token: decodeURIComponent(hash), passphrase: "" };

  return {
    token: decodeURIComponent(hash.slice(0, separatorIndex)),
    passphrase: decodeURIComponent(hash.slice(separatorIndex + 1))
  };
}

export function ReadSecret({ id }: { id: string }) {
  const [passphrase, setPassphrase] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<"idle" | "error" | "success">("idle");
  const [loading, setLoading] = useState(false);
  const [consumed, setConsumed] = useState(false);

  async function openSecret() {
    const secretParts = readSecretPartsFromHash();
    const currentPassphrase = passphrase || secretParts.passphrase;
    const currentToken = secretParts.token;

    if (!currentToken) {
      setStatusType("error");
      setStatus("Engangstoken saknas i lanken. Anvand hela original-lanken.");
      return;
    }

    if (!currentPassphrase) {
      setStatusType("error");
      setStatus("Dekrypteringsnyckel saknas i lankens fragment eller faltet nedan.");
      return;
    }

    setLoading(true);
    setStatus("");
    setStatusType("idle");

    try {
      const response = await fetch("/api/secret", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store"
        },
        body: JSON.stringify({ id, token: currentToken })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Lanken kunde inte oppnas.");
      }

      const decrypted = await decryptSecret(payload, currentPassphrase);
      setMessage(decrypted);
      setConsumed(true);
      setStatusType("success");
      setStatus("Meddelandet har dekrypterats. Lanken ar nu forbrukad.");
      window.history.replaceState(null, "", window.location.pathname);
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Nagot gick fel.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="read-card">
      <h1>Oppna hemligt meddelande</h1>
      <p>
        Denna lank kan anvandas exakt en gang. Om den redan har oppnats, eller om tidsgransen passerats,
        finns inget meddelande kvar att hamta.
      </p>

      <div className="passphrase-row">
        <label className="field-label" htmlFor="passphrase">Dekrypteringsnyckel</label>
        <input
          id="passphrase"
          className="passphrase-input"
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={passphrase}
          onChange={(event) => setPassphrase(event.target.value)}
          placeholder="Klistra in nyckeln har om den inte finns i lanken"
        />
      </div>

      <div className="result-actions" style={{ marginTop: 20 }}>
        <button className="cta" onClick={openSecret} disabled={loading || consumed}>
          {loading ? "Oppnar..." : consumed ? "Lanken ar forbrukad" : "Oppna meddelande"}
        </button>
      </div>

      <p className={`status ${statusType === "error" ? "error" : statusType === "success" ? "success" : ""}`}>{status}</p>

      {message ? (
        <div className="secret-output">
          <label className="field-label">Dekrypterat meddelande</label>
          <pre>{message}</pre>
        </div>
      ) : null}

      <div className="warning-box">
        Av sakerhetsskal raderas posten pa servern innan innehallet visas. Om du anvander fel nyckel gar posten inte att aterstalla.
      </div>
    </div>
  );
}
