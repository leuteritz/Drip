import CircleHalfTiltIcon from "~icons/ph/circle-half-tilt";
import MoonStarsIcon from "~icons/ph/moon-stars";
import SunIcon from "~icons/ph/sun";
import type { ThemeChoice } from "../../lib/theme";

const NEXT: Record<ThemeChoice, ThemeChoice> = {
  system: "light",
  light: "dark",
  dark: "system",
};

const FACE: Record<
  ThemeChoice,
  { Icon: typeof SunIcon; label: string; title: string }
> = {
  system: {
    Icon: CircleHalfTiltIcon,
    label: "Theme: following the system",
    title: "Following your system - click for day",
  },
  light: { Icon: SunIcon, label: "Theme: day", title: "Day - click for night" },
  dark: {
    Icon: MoonStarsIcon,
    label: "Theme: night",
    title: "Night - click to follow your system again",
  },
};

/**
 * Day, night, or whatever the device says — the tank's own light switch, in the
 * sticky bar beside Setup.
 *
 * Three states rather than two, because "follow the system" is the default and
 * has to be reachable again once it has been overridden. Each state has its own
 * glyph, so the button always says which one it is on without a label taking up
 * bar it does not have.
 */
export default function ThemeToggle({
  choice,
  onChange,
}: {
  choice: ThemeChoice;
  onChange: (choice: ThemeChoice) => void;
}) {
  const { Icon, label, title } = FACE[choice];

  return (
    <button
      type="button"
      onClick={() => onChange(NEXT[choice])}
      title={title}
      aria-label={label}
      className="flex items-center rounded-full bg-teal/10 px-2.5 py-1.5 text-2xs font-bold text-teal transition hover:bg-teal/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
    >
      <Icon className="text-sm" />
    </button>
  );
}
