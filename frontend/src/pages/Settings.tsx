import { useEffect, useState } from "react";
import {
  api,
  fmtEur,
  WEEKDAYS,
  type BotSettings,
  type Indicators,
} from "../api/client";
import { Badge, Card, CardTitle, Spinner, Toggle } from "../components/ui";

const PAUSE_PRESETS = [
  { label: "1 Woche", days: 7 },
  { label: "2 Wochen", days: 14 },
  { label: "4 Wochen", days: 28 },
];

export default function Settings() {
  const [settings, setSettings] = useState<BotSettings | null>(null);
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmLive, setConfirmLive] = useState(false);
  const [customPauseDays, setCustomPauseDays] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getSettings().then(setSettings).catch((e) => setError(String(e)));
    api.getIndicators().then(setIndicators).catch(() => {});
  }, []);

  const save = async (update: Partial<BotSettings>) => {
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    try {
      const next = await api.updateSettings(update);
      setSettings(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const pause = async (days: number) => {
    setSaving(true);
    try {
      setSettings(await api.pause(days));
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const resume = async () => {
    setSaving(true);
    try {
      setSettings(await api.resume());
    } finally {
      setSaving(false);
    }
  };

  if (error) return <Card className="border-down/40 text-down">⚠️ {error}</Card>;
  if (!settings) return <Spinner />;

  const isPaused =
    settings.paused_until !== null &&
    new Date(settings.paused_until) >= new Date(new Date().toDateString());

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">⚙️ Konfiguration</h1>
        {saving && <Badge tone="gray">Speichern…</Badge>}
        {saved && <Badge tone="green">✓ Gespeichert</Badge>}
      </div>

      {/* Kaufbetrag */}
      <Card>
        <CardTitle>Kaufbetrag</CardTitle>
        <label className="mb-2 block text-sm text-slate-400">
          Basisbetrag pro Kauf (der Bot multipliziert je nach Marktlage mit 0,5× bis 1,5×)
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={5}
            max={500}
            step={5}
            value={settings.base_amount_eur}
            onChange={(e) =>
              setSettings({ ...settings, base_amount_eur: Number(e.target.value) })
            }
            onMouseUp={() => save({ base_amount_eur: settings.base_amount_eur })}
            onTouchEnd={() => save({ base_amount_eur: settings.base_amount_eur })}
            className="w-full accent-btc"
          />
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              value={settings.base_amount_eur}
              onChange={(e) =>
                setSettings({ ...settings, base_amount_eur: Number(e.target.value) })
              }
              onBlur={() => save({ base_amount_eur: settings.base_amount_eur })}
              className="w-24 rounded-lg border border-line bg-surface-2 px-3 py-2 text-right font-semibold tabular-nums outline-none focus:border-btc"
            />
            <span className="text-slate-400">€</span>
          </div>
        </div>
        {indicators && (
          <div className="mt-4 rounded-xl border border-btc/30 bg-btc/5 p-3 text-sm">
            <span className="text-slate-300">Beim nächsten Kauf (aktuelle Marktlage): </span>
            <span className="font-bold text-btc">
              {fmtEur(settings.base_amount_eur)} × {indicators.multiplier} ={" "}
              {fmtEur(settings.base_amount_eur * indicators.multiplier)}
            </span>
            <span className="ml-2 text-slate-500">({indicators.signal})</span>
          </div>
        )}
      </Card>

      {/* Zeitplan */}
      <Card>
        <CardTitle>Kaufzeitpunkt</CardTitle>
        <label className="mb-2 block text-sm text-slate-400">Wochentag</label>
        <div className="mb-4 flex flex-wrap gap-2">
          {WEEKDAYS.map((day, idx) => (
            <button
              key={day}
              onClick={() => save({ schedule_weekday: idx })}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                settings.schedule_weekday === idx
                  ? "bg-btc text-black"
                  : "bg-surface-2 text-slate-400 hover:text-slate-200"
              }`}
            >
              {day.slice(0, 2)}
            </button>
          ))}
        </div>
        <label className="mb-2 block text-sm text-slate-400">Uhrzeit</label>
        <input
          type="time"
          value={settings.schedule_time}
          onChange={(e) => save({ schedule_time: e.target.value })}
          className="rounded-lg border border-line bg-surface-2 px-3 py-2 font-semibold outline-none focus:border-btc [color-scheme:dark]"
        />
        <p className="mt-3 text-sm text-slate-500">
          Der Bot kauft jeden <b className="text-slate-300">{WEEKDAYS[settings.schedule_weekday]}</b> um{" "}
          <b className="text-slate-300">{settings.schedule_time} Uhr</b>.
        </p>
      </Card>

      {/* Pause */}
      <Card>
        <CardTitle>Pausieren</CardTitle>
        {isPaused ? (
          <div className="flex flex-wrap items-center gap-4">
            <Badge tone="gray">
              ⏸ Pausiert bis {new Date(settings.paused_until!).toLocaleDateString("de-DE")}
            </Badge>
            <button
              onClick={resume}
              className="rounded-lg bg-up px-4 py-2 text-sm font-semibold text-black transition hover:bg-green-400"
            >
              ▶ Jetzt fortsetzen
            </button>
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm text-slate-400">
              Käufe für einen Zeitraum aussetzen — der Zeitplan bleibt erhalten und läuft danach
              automatisch weiter.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {PAUSE_PRESETS.map((p) => (
                <button
                  key={p.days}
                  onClick={() => pause(p.days)}
                  className="rounded-lg bg-surface-2 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-700"
                >
                  {p.label}
                </button>
              ))}
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={365}
                  placeholder="Tage"
                  value={customPauseDays}
                  onChange={(e) => setCustomPauseDays(e.target.value)}
                  className="w-20 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-btc"
                />
                <button
                  onClick={() => customPauseDays && pause(Number(customPauseDays))}
                  disabled={!customPauseDays}
                  className="rounded-lg bg-surface-2 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-700 disabled:opacity-40"
                >
                  Pausieren
                </button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Modus & Benachrichtigungen */}
      <Card>
        <CardTitle>Modus &amp; Benachrichtigungen</CardTitle>
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-semibold">
                Live-Trading{" "}
                {!settings.dry_run && <Badge tone="red">AKTIV — echtes Geld!</Badge>}
              </div>
              <div className="text-sm text-slate-500">
                Aus = Dry-Run (Käufe werden nur simuliert und geloggt)
              </div>
            </div>
            <Toggle
              checked={!settings.dry_run}
              onChange={(live) => {
                if (live) {
                  setConfirmLive(true);
                } else {
                  save({ dry_run: true });
                }
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-semibold">Discord-Benachrichtigungen</div>
              <div className="text-sm text-slate-500">
                Webhook-URL wird in <code>backend/.env</code> konfiguriert
              </div>
            </div>
            <Toggle
              checked={settings.discord_enabled}
              onChange={(v) => save({ discord_enabled: v })}
            />
          </div>
        </div>
      </Card>

      {/* Live-Bestätigungs-Dialog */}
      {confirmLive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="max-w-md border-down/50">
            <h3 className="mb-2 text-lg font-bold text-down">⚠️ Live-Trading aktivieren?</h3>
            <p className="text-sm text-slate-300">
              Der Bot kauft ab sofort <b>mit echtem Geld</b> über deine Coinbase-API — jeden{" "}
              {WEEKDAYS[settings.schedule_weekday]} um {settings.schedule_time} Uhr, Basisbetrag{" "}
              {fmtEur(settings.base_amount_eur)} (× Multiplikator je nach Marktlage).
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmLive(false)}
                className="rounded-lg bg-surface-2 px-4 py-2 text-sm font-semibold text-slate-300"
              >
                Abbrechen
              </button>
              <button
                onClick={() => {
                  setConfirmLive(false);
                  save({ dry_run: false });
                }}
                className="rounded-lg bg-down px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500"
              >
                Ja, live handeln
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
