"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Download, Eye, Info, LockKeyhole } from "lucide-react";
import { SiteLanguage, useLanguage } from "@/components/language-provider";
import { decryptSecret } from "@/lib/crypto";

type SealedSecretPayload = {
  ciphertext: string;
  iv: string;
  salt: string;
  createdAt: number;
  expiresAt: number;
};

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

const readCopy: Record<SiteLanguage, {
  cachedMessageNotice: string;
  copied: string;
  copyFailed: string;
  missingToken: string;
  missingPassphrase: string;
  openFailed: string;
  decryptFailed: string;
  secureMessage: string;
  secureMessageDesc: string;
  cachedDesc: string;
  important: string;
  warningFresh: string;
  warningCached: string;
  decryptionKey: string;
  keyPlaceholder: string;
  opening: string;
  showMessage: string;
  fileDecrypted: string;
  messageDecrypted: string;
  fileSave: string;
  messageSave: string;
  copyToClipboard: string;
  downloadFile: string;
  linkConsumedFile: string;
  linkConsumedMessage: string;
}> = {
  sv: {
    cachedMessageNotice: "Det krypterade meddelandet finns sparat lokalt i den här fliken. Du kan försöka igen med rätt nyckel.",
    copied: "Meddelandet är kopierat.",
    copyFailed: "Kunde inte kopiera meddelandet.",
    missingToken: "Engångstoken saknas i länken. Använd hela originallänken.",
    missingPassphrase: "Dekrypteringsnyckel saknas i länkens fragment eller fältet nedan.",
    openFailed: "Länken kunde inte öppnas.",
    decryptFailed: "Dekrypteringen misslyckades. Kontrollera att dekrypteringsnyckeln är korrekt. Det krypterade innehållet finns sparat lokalt i den här fliken så att du kan försöka igen utan att förlora meddelandet.",
    secureMessage: "Säkert meddelande",
    secureMessageDesc: "Du har fått ett säkert meddelande som bara kan ses en gång.",
    cachedDesc: "Det här meddelandet har redan hämtats till den här fliken och kan nu dekrypteras lokalt.",
    important: "Viktigt",
    warningFresh: "Detta meddelande kommer att självförstöras efter visning. När det öppnats kan det inte ses igen. Var säker på att du är redo att visa det nu.",
    warningCached: "Länken är redan förbrukad på servern, men den krypterade kopian finns kvar lokalt i den här fliken tills du dekrypterar eller lämnar sidan.",
    decryptionKey: "Dekrypteringsnyckel",
    keyPlaceholder: "Klistra in nyckeln här om den inte finns i länken",
    opening: "Öppnar...",
    showMessage: "Visa meddelande",
    fileDecrypted: "Filen har dekrypterats",
    messageDecrypted: "Meddelandet har dekrypterats",
    fileSave: "Filen kan inte öppnas igen. Spara den nu om du behöver den.",
    messageSave: "Ditt meddelande kommer inte att vara tillgängligt igen. Se till att spara det nu.",
    copyToClipboard: "Kopiera till urklipp",
    downloadFile: "Ladda ner fil",
    linkConsumedFile: "Filen har dekrypterats. Länken är nu förbrukad.",
    linkConsumedMessage: "Meddelandet har dekrypterats. Länken är nu förbrukad."
  },
  en: {
    cachedMessageNotice: "The encrypted message is stored locally in this tab. You can try again with the correct key.",
    copied: "Message copied.",
    copyFailed: "Could not copy the message.",
    missingToken: "The one-time token is missing from the link. Use the full original link.",
    missingPassphrase: "The decryption key is missing from the link fragment or the field below.",
    openFailed: "The link could not be opened.",
    decryptFailed: "Decryption failed. Make sure the decryption key is correct. The encrypted content is stored locally in this tab so you can try again without losing the message.",
    secureMessage: "Secure message",
    secureMessageDesc: "You have received a secure message that can only be viewed once.",
    cachedDesc: "This message has already been fetched into this tab and can now be decrypted locally.",
    important: "Important",
    warningFresh: "This message will self-destruct after viewing. Once opened, it cannot be seen again. Make sure you are ready to view it now.",
    warningCached: "The link is already consumed on the server, but the encrypted copy remains locally in this tab until you decrypt it or leave the page.",
    decryptionKey: "Decryption key",
    keyPlaceholder: "Paste the key here if it is not included in the link",
    opening: "Opening...",
    showMessage: "Show message",
    fileDecrypted: "The file has been decrypted",
    messageDecrypted: "The message has been decrypted",
    fileSave: "The file cannot be opened again. Save it now if you need it.",
    messageSave: "Your message will not be available again. Make sure to save it now.",
    copyToClipboard: "Copy to clipboard",
    downloadFile: "Download file",
    linkConsumedFile: "The file has been decrypted. The link is now consumed.",
    linkConsumedMessage: "The message has been decrypted. The link is now consumed."
  }
};

export function ReadSecret({ id }: { id: string }) {
  const { language } = useLanguage();
  const copy = readCopy[language];
  const cacheKey = `message-encrypt:sealed:${id}`;
  const [passphrase, setPassphrase] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [filePayload, setFilePayload] = useState<{ name: string; mimeType: string; size: number; data: string } | null>(null);
  const [sealedSecret, setSealedSecret] = useState<SealedSecretPayload | null>(null);
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

  useEffect(() => {
    try {
      const cached = window.sessionStorage.getItem(cacheKey);
      if (!cached) return;

      const parsed = JSON.parse(cached) as SealedSecretPayload;
      if (
        typeof parsed?.ciphertext === "string" &&
        typeof parsed?.iv === "string" &&
        typeof parsed?.salt === "string"
      ) {
        setSealedSecret(parsed);
        setStatusType("idle");
        setStatus(copy.cachedMessageNotice);
      }
    } catch {
      window.sessionStorage.removeItem(cacheKey);
    }
  }, [cacheKey, copy.cachedMessageNotice]);

  useEffect(() => {
    if (!sealedSecret) return;
    window.sessionStorage.setItem(cacheKey, JSON.stringify(sealedSecret));
  }, [cacheKey, sealedSecret]);

  async function copyMessage() {
    if (!message) return;

    try {
      await navigator.clipboard.writeText(message);
      setStatusType("success");
      setStatus(copy.copied);
    } catch {
      setStatusType("error");
      setStatus(copy.copyFailed);
    }
  }

  async function openSecretInternal(options?: { passphrase?: string; token?: string }) {
    const secretParts = readSecretPartsFromHash();
    const currentPassphrase = options?.passphrase ?? (passphrase || secretParts.passphrase);
    const currentToken = options?.token ?? secretParts.token;

    if (!currentToken) {
      setStatusType("error");
      setStatus(copy.missingToken);
      return;
    }

    if (!currentPassphrase) {
      setStatusType("error");
      setStatus(copy.missingPassphrase);
      return;
    }

    setLoading(true);
    setStatus("");
    setStatusType("idle");

    try {
      let payload = sealedSecret;

      if (!payload) {
        const response = await fetch("/api/secret", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store"
          },
          body: JSON.stringify({ id, token: currentToken })
        });

        const responsePayload = await response.json();
        if (!response.ok) {
          throw new Error(responsePayload.error || copy.openFailed);
        }

        payload = responsePayload as SealedSecretPayload;
        setSealedSecret(payload);
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
      setSealedSecret(null);
      window.sessionStorage.removeItem(cacheKey);
      setStatusType("success");
      setStatus(parsed.kind === "file" ? copy.linkConsumedFile : copy.linkConsumedMessage);
      window.history.replaceState(null, "", window.location.pathname);
    } catch (error) {
      setStatusType("error");
      if (error instanceof DOMException || (error instanceof Error && /operation|decrypt/i.test(`${error.name} ${error.message}`))) {
        setStatus(copy.decryptFailed);
      } else {
        setStatus(error instanceof Error ? error.message : "Något gick fel.");
      }
    } finally {
      setLoading(false);
    }
  }

  function openSecret() {
    void openSecretInternal();
  }

  const hasEmbeddedPassphrase = Boolean(readSecretPartsFromHash().passphrase);

  return (
    <div className="read-card">
      {!consumed ? (
        <div className="read-stage">
          <div className="read-headline">
            <span className="read-headline-mark"><LockKeyhole size={22} /></span>
            <div>
              <h1>Säkert meddelande</h1>
              <p>
                {sealedSecret
                  ? copy.cachedDesc
                  : copy.secureMessageDesc}
              </p>
            </div>
          </div>

          <div className="read-warning-banner">
            <span className="read-warning-icon"><Info size={18} /></span>
            <div>
              <div className="read-warning-title">{copy.important}</div>
              <div className="read-warning-text">
                {sealedSecret
                  ? copy.warningCached
                  : copy.warningFresh}
              </div>
            </div>
          </div>

          {!hasEmbeddedPassphrase ? (
            <div className="passphrase-row">
              <label className="field-label" htmlFor="passphrase">{copy.decryptionKey}</label>
              <input
                id="passphrase"
                className="passphrase-input"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                placeholder={copy.keyPlaceholder}
              />
            </div>
          ) : null}

          <div className="read-primary-action">
            <button className="cta reveal-btn" onClick={openSecret} disabled={loading}>
              <Eye size={18} />
              {loading ? copy.opening : copy.showMessage}
            </button>
          </div>
        </div>
      ) : (
        <div className="read-stage">
          <div className="read-headline">
            <span className="read-headline-mark"><LockKeyhole size={22} /></span>
            <div>
              <h1>{filePayload ? copy.fileDecrypted : copy.messageDecrypted}</h1>
              <p>{filePayload ? copy.fileSave : copy.messageSave}</p>
            </div>
          </div>

          {message ? (
            <div className="secret-output revealed-secret">
              <pre>{message}</pre>
            </div>
          ) : null}

          {filePayload && downloadUrl ? (
            <div className="secret-output">
              <div className="file-result-card">
                <div>
                  <strong>{filePayload.name}</strong>
                  <div className="file-result-meta">{filePayload.mimeType} • {Math.round(filePayload.size / 1024) || 1} KB</div>
                </div>
                <a className="secondary-btn file-download-btn" href={downloadUrl} download={filePayload.name}>
                  <Download size={16} />
                  {copy.downloadFile}
                </a>
              </div>
            </div>
          ) : null}

          <div className="read-result-actions">
            {message ? (
              <button className="secondary-btn read-action-btn read-action-primary" onClick={() => void copyMessage()}>
                <Copy size={16} />
                {copy.copyToClipboard}
              </button>
            ) : null}
          </div>
        </div>
      )}

      <p className={`status ${statusType === "error" ? "error" : statusType === "success" ? "success" : ""}`}>{status}</p>
    </div>
  );
}
