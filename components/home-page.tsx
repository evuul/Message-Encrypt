"use client";

import Link from "next/link";
import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { CheckCircle2, Download, Link2, LockKeyhole, QrCode, RefreshCcw, Shield, Trash2, Upload, X } from "lucide-react";
import { MAX_FILE_SIZE_BYTES, TTL_OPTIONS } from "@/lib/constants";
import { createPassphrase, encryptSecret } from "@/lib/crypto";

const featureCards = [
  {
    icon: Shield,
    iconClass: "icon-green",
    title: "End-to-end-kryptering",
    text: "Kryptering och dekryptering sker lokalt i webbläsaren. Nyckeln skickas aldrig till servern."
  },
  {
    icon: Trash2,
    iconClass: "icon-red",
    title: "Självförstöring",
    text: "Meddelandet tas bort automatiskt efter vald livslängd eller direkt efter första öppning."
  },
  {
    icon: Download,
    iconClass: "icon-cyan",
    title: "Endast en öppning",
    text: "Varje länk fungerar exakt en gång. Efter det finns inget kvar att hämta."
  },
  {
    icon: Link2,
    iconClass: "icon-cyan",
    title: "Enkel delning",
    text: "Du skickar bara en kort länk. Krypteringsnyckeln ligger i fragmentdelen och stannar i webbläsaren."
  },
  {
    icon: CheckCircle2,
    iconClass: "icon-gold",
    title: "Inga konton behövs",
    text: "Inga konton, inga profiler och inga onödiga metadatafält för själva hemligheten."
  },
  {
    icon: RefreshCcw,
    iconClass: "icon-orange",
    title: "Stateless leverans",
    text: "Servern lagrar bara krypterad text och engångstoken till dess att posten förbrukas."
  }
];

export function HomePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<"text" | "file">("text");
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [ttl, setTtl] = useState<number>(3600);
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<"idle" | "error" | "success">("idle");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ fullUrl: string; shortUrl: string; passphrase: string; expiresAt: number } | null>(null);
  const [showQrCode, setShowQrCode] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");

  const shareText = useMemo(() => {
    if (!result) return "";
    return `${result.shortUrl}\n\nDekrypteringsnyckel: ${result.passphrase}`;
  }, [result]);

  useEffect(() => {
    if (!showQrCode || !result?.fullUrl) {
      setQrCodeDataUrl("");
      return;
    }

    let cancelled = false;

    void QRCode.toDataURL(result.fullUrl, {
      margin: 1,
      width: 320,
      color: {
        dark: "#102013",
        light: "#0000"
      }
    }).then((dataUrl) => {
      if (!cancelled) {
        setQrCodeDataUrl(dataUrl);
      }
    }).catch(() => {
      if (!cancelled) {
        setStatusType("error");
        setStatus("Kunde inte skapa QR-koden.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [result?.fullUrl, showQrCode]);

  function formatFileSize(size: number) {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  function applyFile(file: File | null) {
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setStatusType("error");
      setStatus(`Filen är för stor. Max storlek är ${formatFileSize(MAX_FILE_SIZE_BYTES)}.`);
      return;
    }

    setSelectedFile(file);
    setStatusType("idle");
    setStatus("");
    setResult(null);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    applyFile(event.target.files?.[0] ?? null);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    applyFile(event.dataTransfer.files?.[0] ?? null);
  }

  async function createEncryptedPayload(passphrase: string) {
    if (mode === "file") {
      if (!selectedFile) {
        throw new Error("Välj en fil innan du laddar upp.");
      }

      const bytes = new Uint8Array(await selectedFile.arrayBuffer());
      const base64Data = btoa(String.fromCharCode(...bytes));
      return encryptSecret(JSON.stringify({
        kind: "file",
        name: selectedFile.name,
        mimeType: selectedFile.type || "application/octet-stream",
        size: selectedFile.size,
        data: base64Data
      }), passphrase);
    }

    const trimmed = message.trim();
    if (!trimmed) {
      throw new Error("Skriv ett meddelande innan du krypterar.");
    }

    return encryptSecret(JSON.stringify({
      kind: "text",
      message: trimmed
    }), passphrase);
  }

  async function handleEncrypt() {
    setLoading(true);
    setStatusType("idle");
    setStatus("");

    try {
      const passphrase = createPassphrase();
      const encrypted = await createEncryptedPayload(passphrase);

      const response = await fetch("/api/secret", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store"
        },
        body: JSON.stringify({ ...encrypted, ttlSeconds: ttl })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Kunde inte skapa länk.");
      }

      const shortUrl = `${window.location.origin}/s/${payload.id}#${payload.token}`;
      const fullUrl = `${shortUrl}.${passphrase}`;
      setResult({ fullUrl, shortUrl, passphrase, expiresAt: payload.expiresAt });
      setStatusType("success");
      setStatus(mode === "file" ? "Filen är uppladdad och krypterad." : "Länken är skapad. Nyckeln finns bara hos mottagaren om du delar den.");
      setMessage("");
      setSelectedFile(null);
      setShowQrCode(false);
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Något gick fel.");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setMessage("");
    setSelectedFile(null);
    setResult(null);
    setShowQrCode(false);
    setStatus("");
    setStatusType("idle");
  }

  async function copyToClipboard(text: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(text);
      setStatusType("success");
      setStatus(successMessage);
    } catch {
      setStatusType("error");
      setStatus("Kunde inte kopiera automatiskt.");
    }
  }

  return (
    <div className="page-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" href="/">
            <span className="brand-mark"><LockKeyhole size={18} /></span>
            <span>MessageEncrypt</span>
          </Link>
          <div className="top-actions">
            <button className={`top-action-btn ${mode === "file" ? "active" : ""}`} type="button" onClick={() => setMode("file")}>Ladda upp</button>
            <button className={`top-action-btn ${mode === "text" ? "active" : ""}`} type="button" onClick={() => setMode("text")}>Meddelande</button>
            <span>SV</span>
            <span>Säker delning</span>
          </div>
        </div>
      </header>

      <main className="main-column">
        <section className="hero-grid">
          <article className="hero-card">
            <h1>{mode === "file" ? "Ladda upp fil" : "Kryptera meddelande"}</h1>
            {mode === "file" ? (
              <>
                <label
                  className="upload-dropzone"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    className="file-input"
                    type="file"
                    onChange={handleFileChange}
                  />
                  <span className="upload-icon"><Upload size={38} /></span>
                  <strong>Dra och släpp eller klicka för att välja en fil</strong>
                  <span>Filuppladdning är utformad för små filer som nycklar, certifikat och dokument.</span>
                  {selectedFile ? (
                    <span className="upload-file-meta">
                      Vald fil: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                    </span>
                  ) : (
                    <span className="upload-file-meta">Max storlek: {formatFileSize(MAX_FILE_SIZE_BYTES)}</span>
                  )}
                </label>
              </>
            ) : (
              <>
                <label className="field-label" htmlFor="message">Ditt meddelande</label>
                <textarea
                  id="message"
                  className="secret-input"
                  placeholder="Ange ditt meddelande..."
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  spellCheck={false}
                  autoComplete="off"
                />
              </>
            )}

            <div className="options-row" role="radiogroup" aria-label="Radera automatiskt efter">
              {TTL_OPTIONS.map((option) => (
                <label key={option.value} className="option-pill">
                  <input
                    type="radio"
                    name="ttl"
                    checked={ttl === option.value}
                    onChange={() => setTtl(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>

            <div className="benefits">
              <div className="benefit"><CheckCircle2 size={20} color="#9be283" /> Endast en nedladdning</div>
              <div className="benefit"><CheckCircle2 size={20} color="#9be283" /> Skapa dekrypteringsnyckel lokalt</div>
            </div>

            <button className="cta" onClick={handleEncrypt} disabled={loading}>
              {mode === "file" ? <Upload size={18} /> : <LockKeyhole size={18} />}
              {loading ? (mode === "file" ? "Laddar upp..." : "Krypterar...") : (mode === "file" ? "Ladda upp fil" : "Kryptera meddelande")}
            </button>

            <p className={`status ${statusType === "error" ? "error" : statusType === "success" ? "success" : ""}`}>{status}</p>
          </article>

          {result ? (
            <article className="result-card">
              <h1>Meddelandet sparat</h1>
              <p>{mode === "file" ? "Din fil har krypterats och lagrats. Dela dessa länkar för att ge åtkomst." : "Ditt meddelande har krypterats och lagrats. Dela dessa länkar för att ge åtkomst."}</p>

              <div className="notice-banner">
                <div className="notice-title">Kom ihåg</div>
                <div className="notice-text">
                  Meddelandet kan bara laddas ner en gång. Öppna inte länken själv. För extra säkerhet, skicka dekrypteringsnyckeln i en separat kanal.
                </div>
              </div>

              <div className="result-stack">
                <section className="share-card">
                  <h3>Direktlänk</h3>
                  <p>Dela denna länk för direkt åtkomst till meddelandet</p>
                  <div className="share-row">
                    <button className="copy-chip" onClick={() => copyToClipboard(result.fullUrl, "Direktlänken är kopierad.")}>Kopiera</button>
                    <a className="result-link" href={result.fullUrl}>{result.fullUrl}</a>
                  </div>
                </section>

                <section className="share-card">
                  <h3>Kort länk</h3>
                  <p>Kräver att dekrypteringsnyckeln delas separat</p>
                  <div className="share-row">
                    <button className="copy-chip" onClick={() => copyToClipboard(result.shortUrl, "Korta länken är kopierad.")}>Kopiera</button>
                    <a className="result-link" href={result.shortUrl}>{result.shortUrl}</a>
                  </div>
                </section>

                <section className="share-card">
                  <h3>Dekrypteringsnyckel</h3>
                  <p>Krävs för att dekryptera meddelandet med den korta länken</p>
                  <div className="share-row">
                    <button className="copy-chip" onClick={() => copyToClipboard(result.passphrase, "Nyckeln är kopierad.")}>Kopiera</button>
                    <div className="result-link">{result.passphrase}</div>
                  </div>
                </section>
              </div>

              <div className="result-footer">
                <span className="result-note">Giltig till: {new Date(result.expiresAt).toLocaleString("sv-SE")}</span>
                <div className="result-actions">
                  <button className="secondary-btn" onClick={() => copyToClipboard(shareText, "Kort länk och nyckel är kopierade.")}>Kopiera kort länk + nyckel</button>
                  <button className="secondary-btn" onClick={() => setShowQrCode(true)}>
                    <QrCode size={16} />
                    Visa QR-kod
                  </button>
                  <button className="outline-btn" onClick={resetForm}>Skapa ett nytt meddelande</button>
                </div>
              </div>
            </article>
          ) : null}
        </section>

        <section className="hero-copy">
          <h2>Dela meddelanden säkert med enkelhet</h2>
          <p>
            Meddelandet krypteras i din webbläsare innan det skickas. Servern får aldrig dekrypteringsnyckeln,
            och posten försvinner efter första öppning eller när tiden går ut.
          </p>
        </section>

        <section className="feature-grid">
          {featureCards.map((card) => {
            const Icon = card.icon;
            return (
              <article className="info-card" key={card.title}>
                <div className={`icon-badge ${card.iconClass}`}><Icon size={22} /></div>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </article>
            );
          })}
        </section>
      </main>

      {showQrCode && result ? (
        <div className="modal-backdrop" onClick={() => setShowQrCode(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setShowQrCode(false)} aria-label="Stäng QR-kod">
              <X size={18} />
            </button>
            <h2>QR-kod för direktlänk</h2>
            <p>Skanna koden för att öppna meddelandet med inbyggd nyckel i samma steg.</p>
            <div className="qr-preview">
              {qrCodeDataUrl ? <img src={qrCodeDataUrl} alt="QR-kod för direktlänk" /> : <span>Skapar QR-kod...</span>}
            </div>
            <div className="qr-meta">{result.fullUrl}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
