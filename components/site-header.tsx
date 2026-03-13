"use client";

import { LockKeyhole } from "lucide-react";
import { SiteLanguage, useLanguage } from "@/components/language-provider";

const headerCopy: Record<SiteLanguage, {
  upload: string;
  message: string;
  secureSharing: string;
}> = {
  sv: {
    upload: "Ladda upp",
    message: "Meddelande",
    secureSharing: "Säker delning"
  },
  en: {
    upload: "Upload",
    message: "Message",
    secureSharing: "Secure sharing"
  }
};

type SiteHeaderProps = {
  mode?: "text" | "file";
  onModeChange?: (mode: "text" | "file") => void;
};

export function SiteHeader({ mode, onModeChange }: SiteHeaderProps) {
  const { language, setLanguage } = useLanguage();
  const copy = headerCopy[language];

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a className="brand" href="/">
          <span className="brand-mark"><LockKeyhole size={18} /></span>
          <span className="brand-copy">
            <span className="brand-title">Keyburn</span>
            <span className="brand-subtitle">MessageEncrypt</span>
          </span>
        </a>
        <div className="top-actions">
          {onModeChange ? (
            <>
              <button className={`top-action-btn ${mode === "file" ? "active" : ""}`} type="button" onClick={() => onModeChange("file")}>{copy.upload}</button>
              <button className={`top-action-btn ${mode === "text" ? "active" : ""}`} type="button" onClick={() => onModeChange("text")}>{copy.message}</button>
            </>
          ) : null}
          <div className="lang-toggle" role="group" aria-label="Language selector">
            <button className={`lang-btn ${language === "sv" ? "active" : ""}`} type="button" onClick={() => setLanguage("sv")}>SV</button>
            <button className={`lang-btn ${language === "en" ? "active" : ""}`} type="button" onClick={() => setLanguage("en")}>EN</button>
          </div>
          <span>{copy.secureSharing}</span>
        </div>
      </div>
    </header>
  );
}
