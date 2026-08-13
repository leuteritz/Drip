import { useCallback, useEffect, useMemo, useState } from "react";
import CaretRightIcon from "~icons/ph/caret-right";
import CheckCircleIcon from "~icons/ph/check-circle";
import CoinsIcon from "~icons/ph/coins";
import DiscordIcon from "~icons/ph/discord-logo";
import GearIcon from "~icons/ph/gear-six";
import KeyIcon from "~icons/ph/key";
import NewspaperIcon from "~icons/ph/newspaper";
import PaperPlaneIcon from "~icons/ph/paper-plane-tilt";
import PlugsIcon from "~icons/ph/plugs-connected";
import PulseIcon from "~icons/ph/pulse";
import ShieldIcon from "~icons/ph/shield-check";
import WarningIcon from "~icons/ph/warning-circle";
import {
  api,
  type BotSettings,
  type CoinbaseTest,
  type CredentialsUpdate,
  type SetupInfo,
} from "../../api/client";
import { COINBASE_DEPOSIT_URL, COINBASE_KEYS_URL, HOST } from "../../lib/coinbase";
import type { IconComponent } from "../../lib/commands";
import { fmtEur } from "../../lib/format";
import { useStackAmount } from "../../lib/units";
import { Loading, Modal, Note, OutLink, Toggle } from "../ui";
import CredentialRow from "./CredentialRow";
import Maintenance from "./Maintenance";
import SystemPanel from "./SystemPanel";

export type SetupTab = "coinbase" | "discord" | "system";

const TABS: { id: SetupTab; label: string; Icon: typeof PlugsIcon }[] = [
  { id: "coinbase", label: "Coinbase", Icon: PlugsIcon },
  { id: "discord", label: "Discord", Icon: DiscordIcon },
  { id: "system", label: "System", Icon: PulseIcon },
];

const SENT_FLASH_MS = 3500;

/**
 * Everything the backend needs, without a shell on the Pi.
 *
 * The keys, the webhook, the state of the scheduler and the maintenance
 * escapes — the three things a saver has to reach for after the dashboard is
 * up, and the three that used to mean editing `backend/.env` over SSH and
 * restarting the container.
 *
 * It fetches its own state, like `Research` and the digest dialog do: `App`
 * owns what the whole page shares, and this owns what only it needs. Saving a
 * key is the exception it reports upwards — a new key changes the header's
 * credential pill and the well readout, so `onCredentialsChanged` reloads both.
 */
export default function SetupDialog({
  settings,
  initialTab = "coinbase",
  onSaveSettings,
  onTestWebhook,
  onCredentialsChanged,
  onHistoryChanged,
  onOpenDigest,
  onClose,
}: {
  settings: BotSettings | null;
  initialTab?: SetupTab;
  onSaveSettings: (update: Partial<BotSettings>) => Promise<void>;
  onTestWebhook: () => Promise<boolean>;
  onCredentialsChanged: () => void;
  onHistoryChanged: () => void;
  onOpenDigest: () => void;
  onClose: () => void;
}) {
  const [setup, setSetup] = useState<SetupInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<SetupTab>(initialTab);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setSetup(await api.getSetup());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(
    async (update: CredentialsUpdate) => {
      setSetup(await api.saveCredentials(update));
      onCredentialsChanged();
    },
    [onCredentialsChanged],
  );

  const fields = setup?.credentials ?? [];
  const group = useMemo(
    () => (name: string) => fields.filter((f) => f.group === name),
    [fields],
  );
  const configured = (name: string) => {
    const rows = group(name);
    return rows.length > 0 && rows.every((f) => f.configured);
  };

  return (
    <Modal
      onClose={onClose}
      closeOnBackdrop
      className="max-h-[88vh] w-full max-w-3xl overflow-y-auto ring-2 ring-teal/40"
    >
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <h3 className="flex items-center gap-2 font-display text-xl font-semibold text-teal">
          <GearIcon /> Setup
        </h3>
        <span className="text-xs text-ink-soft">
          What the backend runs on — from here, not from the Pi
        </span>
        <button
          onClick={onClose}
          className="ml-auto rounded-full bg-sand-soft px-4 py-1.5 text-xs font-bold text-ink transition hover:opacity-80"
        >
          Close
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map(({ id, label, Icon }) => {
          const on = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-current={on ? "true" : undefined}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
                on ? "bg-teal-deep text-cream" : "bg-sand-soft text-ink-soft hover:text-ink"
              }`}
            >
              <Icon className="text-sm" />
              {label}
              {id !== "system" && setup && (
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    configured(id) ? "bg-water" : "bg-rose"
                  }`}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="rounded-xl bg-rose-soft px-3.5 py-3 text-xs font-bold text-rose">
          Could not read the setup: {error}
        </p>
      ) : !setup ? (
        <Loading
          what="Reading the backend's setup"
          why="What is configured, and how the install is doing — one call, so nothing on screen is a guess."
        />
      ) : tab === "coinbase" ? (
        <CoinbaseTab rows={group("coinbase")} onSave={save} />
      ) : tab === "discord" ? (
        <DiscordTab
          rows={group("discord")}
          settings={settings}
          onSave={save}
          onSaveSettings={onSaveSettings}
          onTestWebhook={onTestWebhook}
          onOpenDigest={onOpenDigest}
        />
      ) : (
        <div className="space-y-5">
          <SystemPanel
            system={setup.system}
            onRefresh={load}
            refreshing={refreshing}
          />
          <Maintenance
            purchaseCount={setup.system.purchase_count}
            onChanged={() => {
              onHistoryChanged();
              load();
            }}
          />
        </div>
      )}
    </Modal>
  );
}

/** The key pair, and proof that Coinbase accepts it. */
function CoinbaseTab({
  rows,
  onSave,
}: {
  rows: SetupInfo["credentials"];
  onSave: (update: CredentialsUpdate) => Promise<void>;
}) {
  const stackAmount = useStackAmount();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<CoinbaseTest | null>(null);
  const stored = rows.length > 0 && rows.every((f) => f.configured);

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      setResult(await api.testCoinbase());
    } catch (e) {
      setResult({
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
        eur_available: null,
        btc_available: null,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl bg-water-soft/50 px-3.5 py-3">
        <ShieldIcon className="text-lg text-teal" aria-hidden="true" />
        <span className="text-sm font-bold text-ink">
          {stored ? "Key pair stored" : "No key pair yet"}
        </span>
        <span className="text-xs text-ink-soft">
          {stored
            ? "Only trading needs it — charts and backtests never did."
            : "The dashboard works without one; buying does not."}
        </span>
        <button
          type="button"
          onClick={test}
          disabled={testing || !stored}
          className="ml-auto flex items-center gap-1.5 rounded-full bg-teal-deep px-4 py-1.5 text-xs font-bold text-cream transition hover:opacity-90 disabled:opacity-40"
        >
          <PlugsIcon /> {testing ? "Asking Coinbase…" : "Test connection"}
        </button>
      </div>

      {result && (
        <div
          className={`flex flex-wrap items-start gap-2 rounded-xl px-3.5 py-3 text-xs ${
            result.ok ? "bg-water-soft/60 text-ink" : "bg-rose-soft text-rose"
          }`}
        >
          {result.ok ? (
            <CheckCircleIcon className="mt-0.5 shrink-0 text-teal" />
          ) : (
            <WarningIcon className="mt-0.5 shrink-0" />
          )}
          <span className="min-w-0 flex-1 break-words font-bold leading-relaxed">
            {result.detail}
          </span>
          {result.ok && (
            <span className="font-mono text-2xs text-ink-soft">
              {fmtEur(result.eur_available ?? 0)} · {stackAmount(result.btc_available ?? 0)}
            </span>
          )}
        </div>
      )}

      {rows.map((field) => (
        <CredentialRow key={field.key} field={field} onSave={onSave} />
      ))}

      {/* The two things Drip cannot do for you, gathered under one heading that
          says where they happen. Making a key and funding the account are both
          behind Coinbase's own login, so they are handed over rather than
          half-explained here — and grouping them is what stops either reading
          as a button that acts on this page. */}
      <div className="rounded-xl border border-sand bg-sand-soft/40 p-1.5">
        <p className="px-2 pb-1 pt-1.5 text-2xs font-bold uppercase tracking-[0.14em] text-ink-soft">
          At Coinbase · opens in a new tab
        </p>
        <AwayRow
          href={COINBASE_KEYS_URL}
          icon={KeyIcon}
          label="Create an API key"
          says="The key pair Drip trades with. Paste both halves into the fields above."
        />
        <AwayRow
          href={COINBASE_DEPOSIT_URL}
          icon={CoinsIcon}
          label="Deposit into your account"
          says="Drip only ever spends what is already there — it cannot move money in."
        />
      </div>

      <Note>
        Keys are stored in Drip's own database on the Pi and never sent back to
        this page — a stored key can be replaced or removed, never read. A key
        set here wins over <code>backend/.env</code>; remove it and the file
        takes over again. Live buying still needs the mode switch in the top bar.
      </Note>
    </div>
  );
}

/**
 * One line that leaves Drip. Both take the same shape, so the pair reads as a
 * pair — and each **shows its host** rather than only carrying it in a tooltip:
 * a phone has no hover, and "where does this take me" is a fair question to ask
 * before tapping a link on the page that holds your keys.
 */
function AwayRow({
  href,
  icon: Icon,
  label,
  says,
}: {
  href: string;
  icon: IconComponent;
  label: string;
  says: string;
}) {
  return (
    <OutLink
      href={href}
      host={HOST[href]}
      className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2.5 text-left transition hover:bg-paper"
      markClassName="ml-auto mt-0.5 text-sm text-ink-soft"
    >
      <Icon className="mt-0.5 shrink-0 text-base text-teal" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-ink">{label}</span>
          <span className="rounded-full bg-paper px-2 py-0.5 font-mono text-2xs text-ink-soft">
            {HOST[href]}
          </span>
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">{says}</span>
      </span>
    </OutLink>
  );
}

/** The webhook, whether Drip may post at all, and the way to the report. */
function DiscordTab({
  rows,
  settings,
  onSave,
  onSaveSettings,
  onTestWebhook,
  onOpenDigest,
}: {
  rows: SetupInfo["credentials"];
  settings: BotSettings | null;
  onSave: (update: CredentialsUpdate) => Promise<void>;
  onSaveSettings: (update: Partial<BotSettings>) => Promise<void>;
  onTestWebhook: () => Promise<boolean>;
  onOpenDigest: () => void;
}) {
  const [testing, setTesting] = useState(false);
  const [sent, setSent] = useState<boolean | null>(null);
  const stored = rows.some((f) => f.configured);

  const test = async () => {
    setTesting(true);
    setSent(null);
    try {
      setSent(await onTestWebhook());
      window.setTimeout(() => setSent(null), SENT_FLASH_MS);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl bg-water-soft/50 px-3.5 py-3">
        <Toggle
          checked={settings?.discord_enabled ?? false}
          disabled={!settings}
          onChange={(v) => onSaveSettings({ discord_enabled: v })}
        />
        <span className="text-sm font-bold text-ink">Let Drip post</span>
        <span className="text-xs text-ink-soft">
          Every buy, every skipped week, and the weekly report.
        </span>
        <button
          type="button"
          onClick={test}
          disabled={testing || !stored}
          className="ml-auto flex items-center gap-1.5 rounded-full bg-teal-deep px-4 py-1.5 text-xs font-bold text-cream transition hover:opacity-90 disabled:opacity-40"
        >
          <PaperPlaneIcon /> {testing ? "Sending…" : "Send test"}
        </button>
      </div>

      {sent !== null && (
        <p
          className={`rounded-xl px-3.5 py-2.5 text-xs font-bold ${
            sent ? "bg-water-soft/60 text-teal" : "bg-rose-soft text-rose"
          }`}
        >
          {sent
            ? "Discord took the message — check the channel."
            : "Discord did not accept it. Check that the webhook URL is complete and its channel still exists."}
        </p>
      )}

      {rows.map((field) => (
        <CredentialRow key={field.key} field={field} onSave={onSave} />
      ))}

      <button
        type="button"
        onClick={onOpenDigest}
        className="flex w-full items-center gap-2 rounded-xl bg-sand-soft/60 px-3.5 py-3 text-left text-xs font-bold text-ink transition hover:opacity-80"
      >
        <NewspaperIcon className="text-teal" />
        <span>
          Weekly report
          <span className="block text-xs font-normal text-ink-soft">
            When it goes out and what it carries.
          </span>
        </span>
        <CaretRightIcon className="ml-auto text-ink-soft" />
      </button>
    </div>
  );
}
