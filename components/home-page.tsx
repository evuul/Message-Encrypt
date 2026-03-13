"use client";

import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";
import { CheckCircle2, Download, Link2, LockKeyhole, RefreshCcw, Shield, Trash2, Upload } from "lucide-react";
import { SiteLanguage, useLanguage } from "@/components/language-provider";
import { SiteHeader } from "@/components/site-header";
import { MAX_FILE_SIZE_BYTES, TTL_OPTIONS } from "@/lib/constants";
import { createPassphrase, encryptSecret } from "@/lib/crypto";

const homeCopy: Record<SiteLanguage, {
  createFile: string;
  createMessage: string;
  messageLabel: string;
  messagePlaceholder: string;
  fileDropTitle: string;
  fileDropText: string;
  selectedFile: string;
  maxSize: string;
  oneDownload: string;
  localKey: string;
  ttlOptions: Array<{ label: string; value: number }>;
  uploading: string;
  encrypting: string;
  uploadFile: string;
  encryptMessage: string;
  savedTitle: string;
  savedDescriptionMessage: string;
  savedDescriptionFile: string;
  remember: string;
  rememberText: string;
  directLink: string;
  directLinkDesc: string;
  shortLink: string;
  shortLinkDesc: string;
  key: string;
  keyDesc: string;
  copy: string;
  directCopied: string;
  shortCopied: string;
  keyCopied: string;
  validUntil: string;
  newMessage: string;
  heroTitle: string;
  heroText: string;
  fileMissing: string;
  messageMissing: string;
  fileUploaded: string;
  linkCreated: string;
  createFailed: string;
  copyFailed: string;
}> = {
  sv: {
    createFile: "Ladda upp fil",
    createMessage: "Kryptera meddelande",
    messageLabel: "Ditt meddelande",
    messagePlaceholder: "Ange ditt meddelande...",
    fileDropTitle: "Dra och släpp eller klicka för att välja en fil",
    fileDropText: "Filuppladdning är utformad för små filer som nycklar, certifikat och dokument.",
    selectedFile: "Vald fil",
    maxSize: "Max storlek",
    oneDownload: "Endast en nedladdning",
    localKey: "Skapa dekrypteringsnyckel lokalt",
    ttlOptions: [
      { label: "En timme", value: 3600 },
      { label: "En dag", value: 86400 },
      { label: "En vecka", value: 604800 }
    ],
    uploading: "Laddar upp...",
    encrypting: "Krypterar...",
    uploadFile: "Ladda upp fil",
    encryptMessage: "Kryptera meddelande",
    savedTitle: "Meddelandet sparat",
    savedDescriptionMessage: "Ditt meddelande har krypterats och lagrats. Dela dessa länkar för att ge åtkomst.",
    savedDescriptionFile: "Din fil har krypterats och lagrats. Dela dessa länkar för att ge åtkomst.",
    remember: "Kom ihåg",
    rememberText: "Meddelandet kan bara laddas ner en gång. Öppna inte länken själv. För extra säkerhet, skicka dekrypteringsnyckeln i en separat kanal.",
    directLink: "Direktlänk",
    directLinkDesc: "Dela denna länk för direkt åtkomst till meddelandet",
    shortLink: "Kort länk",
    shortLinkDesc: "Kräver att dekrypteringsnyckeln delas separat",
    key: "Dekrypteringsnyckel",
    keyDesc: "Krävs för att dekryptera meddelandet med den korta länken",
    copy: "Kopiera",
    directCopied: "Direktlänken är kopierad.",
    shortCopied: "Korta länken är kopierad.",
    keyCopied: "Nyckeln är kopierad.",
    validUntil: "Giltig till",
    newMessage: "Skapa ett nytt meddelande",
    heroTitle: "Dela meddelanden säkert med enkelhet",
    heroText: "Meddelandet krypteras i din webbläsare innan det skickas. Servern får aldrig dekrypteringsnyckeln, och posten försvinner efter första öppning eller när tiden går ut.",
    fileMissing: "Välj en fil innan du laddar upp.",
    messageMissing: "Skriv ett meddelande innan du krypterar.",
    fileUploaded: "Filen är uppladdad och krypterad.",
    linkCreated: "Länken är skapad. Nyckeln finns bara hos mottagaren om du delar den.",
    createFailed: "Kunde inte skapa länk.",
    copyFailed: "Kunde inte kopiera automatiskt."
  },
  en: {
    createFile: "Upload file",
    createMessage: "Encrypt message",
    messageLabel: "Your message",
    messagePlaceholder: "Enter your message...",
    fileDropTitle: "Drag and drop or click to choose a file",
    fileDropText: "File upload is designed for small files such as keys, certificates and documents.",
    selectedFile: "Selected file",
    maxSize: "Max size",
    oneDownload: "Single download only",
    localKey: "Create decryption key locally",
    ttlOptions: [
      { label: "One hour", value: 3600 },
      { label: "One day", value: 86400 },
      { label: "One week", value: 604800 }
    ],
    uploading: "Uploading...",
    encrypting: "Encrypting...",
    uploadFile: "Upload file",
    encryptMessage: "Encrypt message",
    savedTitle: "Message saved",
    savedDescriptionMessage: "Your message has been encrypted and stored. Share these links to grant access.",
    savedDescriptionFile: "Your file has been encrypted and stored. Share these links to grant access.",
    remember: "Remember",
    rememberText: "The message can only be downloaded once. Do not open the link yourself. For extra security, send the decryption key in a separate channel.",
    directLink: "Direct link",
    directLinkDesc: "Share this link for direct access to the message",
    shortLink: "Short link",
    shortLinkDesc: "Requires the decryption key to be shared separately",
    key: "Decryption key",
    keyDesc: "Required to decrypt the message with the short link",
    copy: "Copy",
    directCopied: "Direct link copied.",
    shortCopied: "Short link copied.",
    keyCopied: "Key copied.",
    validUntil: "Valid until",
    newMessage: "Create a new message",
    heroTitle: "Share messages securely with ease",
    heroText: "The message is encrypted in your browser before it is sent. The server never receives the decryption key, and the record disappears after the first open or when time runs out.",
    fileMissing: "Choose a file before uploading.",
    messageMissing: "Write a message before encrypting.",
    fileUploaded: "The file is uploaded and encrypted.",
    linkCreated: "The link is ready. The key only exists with the recipient if you share it.",
    createFailed: "Could not create link.",
    copyFailed: "Could not copy automatically."
  }
};

const featureCards: Record<SiteLanguage, Array<{ icon: typeof Shield; iconClass: string; title: string; text: string }>> = {
  sv: [
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
      title: "Ingen permanent lagring",
      text: "Servern lagrar bara krypterad text och engångstoken till dess att posten förbrukas."
    }
  ],
  en: [
    {
      icon: Shield,
      iconClass: "icon-green",
      title: "End-to-end encryption",
      text: "Encryption and decryption happen locally in the browser. The key is never sent to the server."
    },
    {
      icon: Trash2,
      iconClass: "icon-red",
      title: "Self-destruct",
      text: "The message is removed automatically after the selected lifetime or right after the first open."
    },
    {
      icon: Download,
      iconClass: "icon-cyan",
      title: "Single open only",
      text: "Each link works exactly once. After that, nothing remains to fetch."
    },
    {
      icon: Link2,
      iconClass: "icon-cyan",
      title: "Easy sharing",
      text: "You only send a short link. The encryption key stays in the fragment and remains in the browser."
    },
    {
      icon: CheckCircle2,
      iconClass: "icon-gold",
      title: "No accounts needed",
      text: "No accounts, no profiles and no unnecessary metadata fields for the secret itself."
    },
    {
      icon: RefreshCcw,
      iconClass: "icon-orange",
      title: "No permanent storage",
      text: "The server only stores encrypted text and a one-time token until the record is consumed."
    }
  ]
};

export function HomePage() {
  const { language } = useLanguage();
  const copy = homeCopy[language];
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<"text" | "file">("text");
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [ttl, setTtl] = useState<number>(3600);
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<"idle" | "error" | "success">("idle");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ fullUrl: string; shortUrl: string; passphrase: string; expiresAt: number } | null>(null);

  const shareText = useMemo(() => {
    if (!result) return "";
    return `${result.shortUrl}\n\nDekrypteringsnyckel: ${result.passphrase}`;
  }, [result]);

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

  async function fileToBase64(file: File) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== "string") {
          reject(new Error("Kunde inte läsa filen."));
          return;
        }

        const separatorIndex = result.indexOf(",");
        resolve(separatorIndex === -1 ? result : result.slice(separatorIndex + 1));
      };

      reader.onerror = () => {
        reject(new Error("Kunde inte läsa filen."));
      };

      reader.readAsDataURL(file);
    });
  }

  async function createEncryptedPayload(passphrase: string) {
    if (mode === "file") {
      if (!selectedFile) {
        throw new Error(copy.fileMissing);
      }

      const base64Data = await fileToBase64(selectedFile);
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
      throw new Error(copy.messageMissing);
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
        throw new Error(payload.error || copy.createFailed);
      }

      const shortUrl = `${window.location.origin}/s/${payload.id}#${payload.token}`;
      const fullUrl = `${shortUrl}.${passphrase}`;
      setResult({ fullUrl, shortUrl, passphrase, expiresAt: payload.expiresAt });
      setStatusType("success");
      setStatus(mode === "file" ? copy.fileUploaded : copy.linkCreated);
      setMessage("");
      setSelectedFile(null);
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
      setStatus(copy.copyFailed);
    }
  }

  return (
    <div className="page-shell">
      <SiteHeader mode={mode} onModeChange={setMode} />

      <main className="main-column">
        {result ? (
          <section className="hero-grid hero-grid-result">
            <article className="result-card">
              <h1>{copy.savedTitle}</h1>
              <p>{mode === "file" ? copy.savedDescriptionFile : copy.savedDescriptionMessage}</p>

              <div className="notice-banner">
                <div className="notice-title">{copy.remember}</div>
                <div className="notice-text">
                  {copy.rememberText}
                </div>
              </div>

              <div className="result-stack">
                <section className="share-card">
                  <h3>{copy.directLink}</h3>
                  <p>{copy.directLinkDesc}</p>
                  <div className="share-row">
                    <button className="copy-chip" onClick={() => copyToClipboard(result.fullUrl, copy.directCopied)}>{copy.copy}</button>
                    <a className="result-link" href={result.fullUrl}>{result.fullUrl}</a>
                  </div>
                </section>

                <section className="share-card">
                  <h3>{copy.shortLink}</h3>
                  <p>{copy.shortLinkDesc}</p>
                  <div className="share-row">
                    <button className="copy-chip" onClick={() => copyToClipboard(result.shortUrl, copy.shortCopied)}>{copy.copy}</button>
                    <a className="result-link" href={result.shortUrl}>{result.shortUrl}</a>
                  </div>
                </section>

                <section className="share-card">
                  <h3>{copy.key}</h3>
                  <p>{copy.keyDesc}</p>
                  <div className="share-row">
                    <button className="copy-chip" onClick={() => copyToClipboard(result.passphrase, copy.keyCopied)}>{copy.copy}</button>
                    <div className="result-link">{result.passphrase}</div>
                  </div>
                </section>
              </div>

              <div className="result-footer">
                <span className="result-note">{copy.validUntil}: {new Date(result.expiresAt).toLocaleString(language === "sv" ? "sv-SE" : "en-US")}</span>
                <button className="outline-btn result-reset-btn" onClick={resetForm}>{copy.newMessage}</button>
              </div>
            </article>
          </section>
        ) : (
          <section className="hero-grid">
            <article className="hero-card">
              <h1>{mode === "file" ? copy.createFile : copy.createMessage}</h1>
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
                    <strong>{copy.fileDropTitle}</strong>
                    <span>{copy.fileDropText}</span>
                    {selectedFile ? (
                      <span className="upload-file-meta">
                        {copy.selectedFile}: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                      </span>
                    ) : (
                      <span className="upload-file-meta">{copy.maxSize}: {formatFileSize(MAX_FILE_SIZE_BYTES)}</span>
                    )}
                  </label>
                </>
              ) : (
                <>
                  <label className="field-label" htmlFor="message">{copy.messageLabel}</label>
                  <textarea
                    id="message"
                    className="secret-input"
                    placeholder={copy.messagePlaceholder}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    spellCheck={false}
                    autoComplete="off"
                  />
                </>
              )}

              <div className="options-row" role="radiogroup" aria-label="Radera automatiskt efter">
                {copy.ttlOptions.map((option) => (
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
                <div className="benefit"><CheckCircle2 size={20} color="#9be283" /> {copy.oneDownload}</div>
                <div className="benefit"><CheckCircle2 size={20} color="#9be283" /> {copy.localKey}</div>
              </div>

              <button className="cta" onClick={handleEncrypt} disabled={loading}>
                {mode === "file" ? <Upload size={18} /> : <LockKeyhole size={18} />}
                {loading ? (mode === "file" ? copy.uploading : copy.encrypting) : (mode === "file" ? copy.uploadFile : copy.encryptMessage)}
              </button>

              <p className={`status ${statusType === "error" ? "error" : statusType === "success" ? "success" : ""}`}>{status}</p>
            </article>
          </section>
        )}

        <section className="hero-copy">
          <h2>{copy.heroTitle}</h2>
          <p>{copy.heroText}</p>
        </section>

        <section className="feature-grid">
          {featureCards[language].map((card) => {
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
    </div>
  );
}
