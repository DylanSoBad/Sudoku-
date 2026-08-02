"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePrefs } from "@/components/app-providers";

export function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const { t, locale, setLocale, theme, setTheme, muted, setMuted } = usePrefs();

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={t.nav.settings}
        data-tour="settings"
      >
        <Settings className="h-4 w-4" />
        <span className="hidden sm:inline">{t.nav.settings}</span>
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t.settings.title}
        description={t.settings.description}
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-shelby-muted">{t.settings.mute}</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setMuted(!muted)}
              aria-pressed={muted}
            >
              {muted ? t.settings.muted : t.settings.soundOn}
            </Button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-shelby-muted">{t.settings.theme}</span>
            <div className="flex gap-2">
              <Button
                variant={theme === "dark" ? "primary" : "secondary"}
                size="sm"
                onClick={() => setTheme("dark")}
              >
                {t.settings.dark}
              </Button>
              <Button
                variant={theme === "light" ? "primary" : "secondary"}
                size="sm"
                onClick={() => setTheme("light")}
              >
                {t.settings.light}
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-shelby-muted">{t.settings.language}</span>
            <div className="flex gap-2">
              <Button
                variant={locale === "en" ? "primary" : "secondary"}
                size="sm"
                onClick={() => setLocale("en")}
              >
                EN
              </Button>
              <Button
                variant={locale === "vi" ? "primary" : "secondary"}
                size="sm"
                onClick={() => setLocale("vi")}
              >
                VI
              </Button>
            </div>
          </div>
        </div>
      </Dialog>
    </>
  );
}
