"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Download, Link2, LockKeyhole, RefreshCcw, Shield, Trash2 } from "lucide-react";
import { TTL_OPTIONS } from "@/lib/constants";
import { createPassphrase, encryptSecret } from "@/lib/crypto";

const featureCards = [
  {
    icon: Shield,
    iconClass: "icon-green",
    title: "End-to-end-kryptering",
    text: "Kryptering och dekryptering sker lokalt i webblasaren. Nyckeln skickas aldrig till servern."
  },
  {
    icon: Trash2,
    iconClass: "icon-red",
    title: "Självförstoring",
    text: "Meddelandet tas bort automatiskt efter vald livslangd eller direkt efter forsta oppning."
  },
  {
    icon: Download,
    iconClass: "icon-cyan",
    title: "Endast en oppning",
    text: "Varje lank fungerar exakt en gang. Efter det finns inget kvar att hamta."
  },
  {
    icon: Link2,
    iconClass: "icon-cyan",
    title: "Enkel delning",
    text: "Du skickar bara en kort lank. Krypteringsnyckeln ligger i fragmentdelen och stannar i webblasaren."
  },
  {
    icon: CheckCircle2,
    iconClass: "icon-gold",
    title: "Inga konton behovs",
    text: "Inga konton, inga profiler och inga onodiga metadatafalt for sjalva hemligheten."
  },
  {
    icon: RefreshCcw,
    iconClass: "icon-orange",
    title: "Stateless leverans",
    text: "Servern lagrar bara krypterad text och engangstoken till dess att posten forbrukas."
  }
];

export function HomePage() {
  const [message, setMessage] = useState("");
  const [ttl, setTtl] = useState<number>(3600);
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<"idle" | "error" | "success">("idle");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ fullUrl: string; shortUrl: string; passphrase: string; expiresAt: number } | null>(null);

  const shareText = useMemo(() => {
    if (!result) return "";
    return `${result.shortUrl}\n\nDekrypteringsnyckel: ${result.passphrase}`;
  }, [result]);

  async function handleEncrypt() {
    const trimmed = message.trim();
    if (!trimmed) {
      setStatusType("error");
      setStatus("Skriv ett meddelande innan du krypterar.");
      return;
    }

    setLoading(true);
    setStatusType("idle");
    setStatus("");

    try {
      const passphrase = createPassphrase();
      const encrypted = await encryptSecret(trimmed, passphrase);

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
        throw new Error(payload.error || "Kunde inte skapa lank.");
      }

      const shortUrl = `${window.location.origin}/s/${payload.id}#${payload.token}`;
      const fullUrl = `${shortUrl}.${passphrase}`;
      setResult({ fullUrl, shortUrl, passphrase, expiresAt: payload.expiresAt });
      setStatusType("success");
      setStatus("Lanken ar skapad. Nyckeln finns bara hos mottagaren om du delar den.");
      setMessage("");
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Nagot gick fel.");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setMessage("");
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
      setStatus("Kunde inte kopiera automatiskt.");
    }
  }

  return (
    <div className="page-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="brand-mark"><LockKeyhole size={18} /></span>
            <span>MessageEncrypt</span>
          </div>
          <div className="top-actions">
            <span>Ladda upp</span>
            <span>SV</span>
            <span>Saker delning</span>
          </div>
        </div>
      </header>

      <main className="main-column">
        <section className="hero-grid">
          <article className="hero-card">
            <h1>Kryptera meddelande</h1>
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
              <LockKeyhole size={18} />
              {loading ? "Krypterar..." : "Kryptera meddelande"}
            </button>

            <p className={`status ${statusType === "error" ? "error" : statusType === "success" ? "success" : ""}`}>{status}</p>
          </article>

          {result ? (
            <article className="result-card">
              <h1>Meddelandet sparat</h1>
              <p>Ditt meddelande har krypterats och lagrats. Dela dessa lankar for att ge atkomst.</p>

              <div className="notice-banner">
                <div className="notice-title">Kom ihag</div>
                <div className="notice-text">
                  Meddelandet kan bara laddas ner en gang. Oppna inte lanken sjalv. For extra sakerhet, skicka dekrypteringsnyckeln i en separat kanal.
                </div>
              </div>

              <div className="result-stack">
                <section className="share-card">
                  <h3>Direktlank</h3>
                  <p>Dela denna lank for direkt atkomst till meddelandet</p>
                  <div className="share-row">
                    <button className="copy-chip" onClick={() => copyToClipboard(result.fullUrl, "Direktlanken ar kopierad.")}>Kopiera</button>
                    <a className="result-link" href={result.fullUrl}>{result.fullUrl}</a>
                  </div>
                </section>

                <section className="share-card">
                  <h3>Kort lank</h3>
                  <p>Kraver att dekrypteringsnyckeln delas separat</p>
                  <div className="share-row">
                    <button className="copy-chip" onClick={() => copyToClipboard(result.shortUrl, "Korta lanken ar kopierad.")}>Kopiera</button>
                    <a className="result-link" href={result.shortUrl}>{result.shortUrl}</a>
                  </div>
                </section>

                <section className="share-card">
                  <h3>Dekrypteringsnyckel</h3>
                  <p>Kravs for att dekryptera meddelandet med den korta lanken</p>
                  <div className="share-row">
                    <button className="copy-chip" onClick={() => copyToClipboard(result.passphrase, "Nyckeln ar kopierad.")}>Kopiera</button>
                    <div className="result-link">{result.passphrase}</div>
                  </div>
                </section>
              </div>

              <div className="result-footer">
                <span className="result-note">Giltig till: {new Date(result.expiresAt).toLocaleString("sv-SE")}</span>
                <div className="result-actions">
                  <button className="secondary-btn" onClick={() => copyToClipboard(shareText, "Kort lank och nyckel ar kopierade.")}>Kopiera kort länk + nyckel</button>
                  <button className="outline-btn" onClick={resetForm}>Skapa ett nytt meddelande</button>
                </div>
              </div>
            </article>
          ) : null}
        </section>

        <section className="hero-copy">
          <h2>Dela meddelanden sakert med enkelhet</h2>
          <p>
            Meddelandet krypteras i din webblasare innan det skickas. Servern far aldrig dekrypteringsnyckeln,
            och posten forsvinner efter forsta oppning eller nar tiden gar ut.
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
    </div>
  );
}
