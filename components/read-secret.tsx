"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
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
  const attemptedAutoOpenRef = useRef(false);
  const [passphrase, setPassphrase] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [filePayload, setFilePayload] = useState<{ name: string; mimeType: string; size: number; data: string } | null>(null);
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<"idle" | "error" | "success">("idle");
  const [loading, setLoading] = useState(false);
  const [consumed, setConsumed] = useState(false);
  const downloadUrl = useMemo(() => {
    if (!filePayload) return null;
    return `data:${filePayload.mimeType};base64,${filePayload.data}`;
  }, [filePayload]);

  function parseDecryptedPayload(decrypted: string) {
    try {
      const parsed = JSON.parse(decrypted);
      if (parsed && parsed.kind === "text" && typeof parsed.message === "string") {
        return { kind: "text" as const, message: parsed.message };
      }

      if (
        parsed &&
        parsed.kind === "file" &&
        typeof parsed.name === "string" &&
        typeof parsed.mimeType === "string" &&
        typeof parsed.size === "number" &&
        typeof parsed.data === "string"
      ) {
        return {
          kind: "file" as const,
          name: parsed.name,
          mimeType: parsed.mimeType,
          size: parsed.size,
          data: parsed.data
        };
      }
    } catch {}

    return { kind: "legacy-text" as const, message: decrypted };
  }

  async function openSecretInternal(options?: { passphrase?: string; token?: string }) {
    const secretParts = readSecretPartsFromHash();
    const currentPassphrase = options?.passphrase ?? (passphrase || secretParts.passphrase);
    const currentToken = options?.token ?? secretParts.token;

    if (!currentToken) {
      setStatusType("error");
      setStatus("Engångstoken saknas i länken. Använd hela originallänken.");
      return;
    }

    if (!currentPassphrase) {
      setStatusType("error");
      setStatus("Dekrypteringsnyckel saknas i länkens fragment eller fältet nedan.");
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
        throw new Error(payload.error || "Länken kunde inte öppnas.");
      }

      const decrypted = await decryptSecret(payload, currentPassphrase);
      const parsed = parseDecryptedPayload(decrypted);
      if (parsed.kind === "file") {
        setFilePayload(parsed);
        setMessage(null);
      } else {
        setMessage(parsed.message);
        setFilePayload(null);
      }
      setConsumed(true);
      setStatusType("success");
      setStatus(parsed.kind === "file" ? "Filen har dekrypterats. Länken är nu förbrukad." : "Meddelandet har dekrypterats. Länken är nu förbrukad.");
      window.history.replaceState(null, "", window.location.pathname);
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Något gick fel.");
    } finally {
      setLoading(false);
    }
  }

  function openSecret() {
    void openSecretInternal();
  }

  useEffect(() => {
    if (attemptedAutoOpenRef.current || consumed || loading) {
      return;
    }

    const secretParts = readSecretPartsFromHash();
    if (!secretParts.token || !secretParts.passphrase) {
      return;
    }

    attemptedAutoOpenRef.current = true;
    void openSecretInternal(secretParts);
  }, [consumed, loading]);

  return (
    <div className="read-card">
      <h1>Öppna hemligt meddelande</h1>
      <p>
        Denna länk kan användas exakt en gång. Om den redan har öppnats, eller om tidsgränsen passerats,
        finns inget meddelande kvar att hämta.
      </p>

      {!consumed ? (
        <p className="status">
          Direktlänkar med inbyggd nyckel öppnas automatiskt. Korta länkar kräver att nyckeln klistras in här.
        </p>
      ) : null}

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
          placeholder="Klistra in nyckeln här om den inte finns i länken"
        />
      </div>

      <div className="result-actions" style={{ marginTop: 20 }}>
        <button className="cta" onClick={openSecret} disabled={loading || consumed}>
          {loading ? "Öppnar..." : consumed ? "Länken är förbrukad" : "Öppna meddelande"}
        </button>
      </div>

      <p className={`status ${statusType === "error" ? "error" : statusType === "success" ? "success" : ""}`}>{status}</p>

      {message ? (
        <div className="secret-output">
          <label className="field-label">Dekrypterat meddelande</label>
          <pre>{message}</pre>
        </div>
      ) : null}

      {filePayload && downloadUrl ? (
        <div className="secret-output">
          <label className="field-label">Dekrypterad fil</label>
          <div className="file-result-card">
            <div>
              <strong>{filePayload.name}</strong>
              <div className="file-result-meta">{filePayload.mimeType} • {Math.round(filePayload.size / 1024) || 1} KB</div>
            </div>
            <a className="secondary-btn file-download-btn" href={downloadUrl} download={filePayload.name}>
              <Download size={16} />
              Ladda ner fil
            </a>
          </div>
        </div>
      ) : null}

      <div className="warning-box">
        Av säkerhetsskäl raderas posten på servern innan innehållet visas. Om du använder fel nyckel går posten inte att återställa.
      </div>
    </div>
  );
}
