import { useEffect, useState } from "react";
import DropSlashIcon from "~icons/ph/drop-slash";
import PlayIcon from "~icons/ph/play-fill";
import PaperPlaneIcon from "~icons/ph/paper-plane-tilt";
import SlidersIcon from "~icons/ph/sliders-horizontal";
import WarningIcon from "~icons/ph/warning-fill";
import { api, fmtEur, WEEKDAYS, type BotSettings, type Indicators } from "../api/client";
import { Badge, Card, CardTitle, SectionHeading, Spinner, Toggle } from "../components/ui";

const PAUSE_PRESETS = [
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
  { label: "4 weeks", days: 28 },
];

export default function SettingsSection({
  settings: shared,
  indicators,
  onSettingsChange,
  onStatusChange,
}: {
  settings: BotSettings | null;
  indicators: Indicators | null;
  onSettingsChange: (s: BotSettings) => void;
  onStatusChange: () => void;
}) {
  // Local editable mirror so slider/number drags stay smooth; the shared copy
  // in App is the source of truth and updates after every successful save.
  const [settings, setSettings] = useState<BotSettings | null>(shared);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmLive, setConfirmLive] = useState(false);
  const [customPauseDays, setCustomPauseDays] = useState("");
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookResult, setWebhookResult] = useState<"sent" | "failed" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSettings(shared);
  }, [shared]);

  const save = async (update: Partial<BotSettings>) => {
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    try {
      const next = await api.updateSettings(update);
      setSettings(next);
      onSettingsChange(next);
      onStatusChange();
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
      const next = await api.pause(days);
      setSettings(next);
      onSettingsChange(next);
      onStatusChange();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const resume = async () => {
    setSaving(true);
    try {
      const next = await api.resume();
      setSettings(next);
      onSettingsChange(next);
      onStatusChange();
    } finally {
      setSaving(false);
    }
  };

  const testWebhook = async () => {
    setTestingWebhook(true);
    setWebhookResult(null);
    try {
      const { sent } = await api.testNotification();
      setWebhookResult(sent ? "sent" : "failed");
    } catch {
      setWebhookResult("failed");
    } finally {
      setTestingWebhook(false);
      setTimeout(() => setWebhookResult(null), 4000);
    }
  };

  const isPaused =
    settings?.paused_until != null &&
    new Date(settings.paused_until) >= new Date(new Date().toDateString());

  return (
    <section id="settings" className="scroll-mt-20 flex flex-col gap-4 px-4 py-5 md:px-6 md:py-6">
      <SectionHeading
        icon={<SlidersIcon />}
        title="Settings"
        subtitle="tune the faucet — amount, schedule, pauses and mode"
        actions={
          <>
            {saving && (
              <span className="inline-flex items-center rounded-full bg-sand-soft px-3 py-1.5 text-xs font-bold text-ink-soft">
                Saving...
              </span>
            )}
            {saved && (
              <span className="inline-flex items-center rounded-full bg-water-soft px-3 py-1.5 text-xs font-bold text-teal">
                Saved &#10003;
              </span>
            )}
          </>
        }
      />

      {error ? (
        <Card className="border-rose/50 font-bold text-rose">{error}</Card>
      ) : !settings ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Buy amount */}
          <Card className="flex flex-col overflow-hidden">
            <CardTitle>Buy amount</CardTitle>
            <label className="mb-3 block text-sm text-ink-soft">
              Base amount per buy &mdash; Drip multiplies it by 0.5x to 1.5x depending on
              the market
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
                className="w-full accent-teal"
              />
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  value={settings.base_amount_eur}
                  onChange={(e) =>
                    setSettings({ ...settings, base_amount_eur: Number(e.target.value) })
                  }
                  onBlur={() => save({ base_amount_eur: settings.base_amount_eur })}
                  className="w-20 rounded-xl border-2 border-sand bg-paper px-3 py-2 text-right font-bold outline-none focus:border-teal"
                />
                <span className="font-bold text-ink-soft">EUR</span>
              </div>
            </div>
            {indicators && (
              <div className="mt-4 rounded-xl border-2 border-water bg-water-soft p-3 text-sm">
                <span className="text-ink">Next at current market: </span>
                <span className="font-display text-base font-bold text-teal">
                  {fmtEur(settings.base_amount_eur)} x {indicators.multiplier} ={" "}
                  {fmtEur(settings.base_amount_eur * indicators.multiplier)}
                </span>
                <span className="ml-1.5 text-xs text-ink-soft">({indicators.signal})</span>
              </div>
            )}
          </Card>

          {/* Schedule */}
          <Card className="flex flex-col overflow-hidden">
            <CardTitle>Schedule</CardTitle>
            <label className="mb-2 block text-sm text-ink-soft">Day of the week</label>
            <div className="mb-4 flex flex-wrap gap-2">
              {WEEKDAYS.map((day, idx) => (
                <button
                  key={day}
                  onClick={() => save({ schedule_weekday: idx })}
                  className={`rounded-xl px-3.5 py-2 text-sm font-bold transition ${
                    settings.schedule_weekday === idx
                      ? "bg-ink text-cream"
                      : "bg-sand-soft text-ink-soft hover:text-ink"
                  }`}
                >
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>
            <label className="mb-2 block text-sm text-ink-soft">Time</label>
            <input
              type="time"
              value={settings.schedule_time}
              onChange={(e) => save({ schedule_time: e.target.value })}
              className="w-fit rounded-xl border-2 border-sand bg-paper px-3 py-2 font-bold outline-none focus:border-teal"
            />
            <p className="mt-4 text-sm text-ink-soft">
              Drip buys every{" "}
              <b className="text-ink">{WEEKDAYS[settings.schedule_weekday]}</b> at{" "}
              <b className="text-ink">{settings.schedule_time}</b>.
            </p>
          </Card>

          {/* Pause */}
          <Card className="flex flex-col overflow-hidden">
            <CardTitle>Pause the faucet</CardTitle>
            {isPaused ? (
              <div className="flex flex-wrap items-center gap-4">
                <Badge tone="rose">
                  <DropSlashIcon /> Off until{" "}
                  {new Date(settings.paused_until!).toLocaleDateString("en-GB")}
                </Badge>
                <button
                  onClick={resume}
                  className="flex items-center gap-2 rounded-full bg-teal px-5 py-2.5 text-sm font-bold text-cream transition hover:bg-ink"
                >
                  <PlayIcon /> Resume now
                </button>
              </div>
            ) : (
              <>
                <p className="mb-3 text-sm text-ink-soft">
                  Skip buys for a while &mdash; the schedule stays put and picks up again on
                  its own.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {PAUSE_PRESETS.map((p) => (
                    <button
                      key={p.days}
                      onClick={() => pause(p.days)}
                      className="rounded-xl bg-sand-soft px-4 py-2 text-sm font-bold text-ink transition hover:bg-sand"
                    >
                      {p.label}
                    </button>
                  ))}
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={365}
                      placeholder="Days"
                      value={customPauseDays}
                      onChange={(e) => setCustomPauseDays(e.target.value)}
                      className="w-20 rounded-xl border-2 border-sand bg-paper px-3 py-2 text-sm outline-none focus:border-teal"
                    />
                    <button
                      onClick={() => customPauseDays && pause(Number(customPauseDays))}
                      disabled={!customPauseDays}
                      className="rounded-xl bg-sand-soft px-3 py-2 text-sm font-bold text-ink transition hover:bg-sand disabled:opacity-40"
                    >
                      Pause
                    </button>
                  </div>
                </div>
              </>
            )}
          </Card>

          {/* Mode & alerts */}
          <Card className="flex flex-col overflow-hidden">
            <CardTitle>Mode and alerts</CardTitle>
            <div className="flex items-center justify-between gap-4 border-b border-sand-soft pb-4">
              <div>
                <div className="flex items-center gap-2 font-bold">
                  Live trading
                  {!settings.dry_run && <Badge tone="rose">real money</Badge>}
                </div>
                <div className="text-sm text-ink-soft">
                  Off = dry run (buys are only simulated and logged)
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
            <div className="flex items-start justify-between gap-4 pt-4">
              <div>
                <div className="font-bold">Discord notifications</div>
                <div className="text-sm text-ink-soft">
                  The webhook URL is configured in <code>backend/.env</code>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={testWebhook}
                    disabled={testingWebhook}
                    className="flex items-center gap-2 rounded-full bg-sand-soft px-4 py-2 text-sm font-bold text-ink transition hover:bg-sand disabled:opacity-40"
                  >
                    <PaperPlaneIcon />
                    {testingWebhook ? "Sending..." : "Send test message"}
                  </button>
                  {webhookResult === "sent" && <Badge tone="teal">Sent &#10003;</Badge>}
                  {webhookResult === "failed" && (
                    <Badge tone="rose">Not configured / failed</Badge>
                  )}
                </div>
              </div>
              <Toggle
                checked={settings.discord_enabled}
                onChange={(v) => save({ discord_enabled: v })}
              />
            </div>
          </Card>
        </div>
      )}

      {/* Live-trading confirmation dialog */}
      {confirmLive && settings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
          <Card className="max-w-md border-rose/60">
            <h3 className="mb-2 flex items-center gap-2 font-display text-xl font-semibold text-rose">
              <WarningIcon /> Turn on live trading?
            </h3>
            <p className="text-sm text-ink">
              Drip will buy <b>with real money</b> through your Coinbase API - every{" "}
              {WEEKDAYS[settings.schedule_weekday]} at {settings.schedule_time}, base amount{" "}
              {fmtEur(settings.base_amount_eur)} (times the market multiplier).
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmLive(false)}
                className="rounded-full bg-sand-soft px-5 py-2.5 text-sm font-bold text-ink"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmLive(false);
                  save({ dry_run: false });
                }}
                className="rounded-full bg-rose px-5 py-2.5 text-sm font-bold text-cream transition hover:opacity-90"
              >
                Trade live
              </button>
            </div>
          </Card>
        </div>
      )}
    </section>
  );
}
