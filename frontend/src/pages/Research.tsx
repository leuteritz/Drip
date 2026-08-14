import { useRef, useState, type RefObject } from "react";
import DownloadSimpleIcon from "~icons/ph/download-simple";
import FlaskIcon from "~icons/ph/flask";
import { api } from "../api/client";
import { useResource } from "../lib/resource";
import AttributionWaterfall from "../components/research/AttributionWaterfall";
import EdgeDistribution from "../components/research/EdgeDistribution";
import ForwardReturnsTable from "../components/research/ForwardReturnsTable";
import { useNearViewport } from "../components/research/hooks";
import ScoreHistory from "../components/research/ScoreHistory";
import ScoringVariants from "../components/research/ScoringVariants";
import SignalScreen from "../components/research/SignalScreen";
import WeekdayGrid from "../components/research/WeekdayGrid";
import { Loading, SectionHeading } from "../components/ui";

/**
 * The Research body: read-only analyses that audit the strategy instead of
 * reporting it. Nothing here can place an order or write a row.
 *
 * They all hit `/api/research/*`, which share one cached scoring table spanning
 * three years of candles — so the whole section defers until it is nearly in
 * view (`useNearViewport`) rather than making the dashboard wait on a cold
 * candle fetch it may never need.
 *
 * Each card owns its own range because they answer different questions at
 * different scales: attribution and the grid want the same window you actually
 * ran, the forward-return test wants as many days as it can get, and the
 * distribution is parameterised by window *length*, not window start.
 *
 * `EdgeDistribution` leads and comes first. The section poses one question in
 * its subtitle and used to answer it nowhere in particular — seven cards of
 * identical weight, each with its own range control, so the verdict was
 * something you had to already know how to find. There is exactly one `lead`
 * here, as everywhere.
 *
 * **A load is answered where it is read**, which is why these go through
 * `useResource` like the dashboard's do. They used to share one `error` string
 * and one alert card at the top — the very arrangement `lib/resource.ts` was
 * written to remove — and it had the same consequence here: one dead endpoint
 * put an alert above seven cards that then sat in their `Loading` branch for
 * ever, clocks climbing, because their `data` never arrived. Each card now says
 * what it could not build and offers to ask again. Retrying one is cheap even
 * when all seven failed: the scoring table is cached on the backend for an hour,
 * so the first card back warms it for the rest.
 */
export default function Research({
  scrollRef,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const wanted = useNearViewport(sectionRef, scrollRef);

  const [attributionDays, setAttributionDays] = useState(365);
  const [forwardDays, setForwardDays] = useState(1095);
  const [gridDays, setGridDays] = useState(365);
  const [scoreDays, setScoreDays] = useState(365);
  const [candidateDays, setCandidateDays] = useState(1095);
  const [variantDays, setVariantDays] = useState(365);
  const [windowDays, setWindowDays] = useState(365);

  // Nothing is asked for until the section is nearly in view — `wanted` is the
  // `enabled` gate, so a reader who never scrolls this far never pays for a
  // three-year candle fetch.
  const attribution = useResource(
    () => api.getAttribution(attributionDays), [attributionDays], wanted,
  );
  const forward = useResource(
    () => api.getForwardReturns(forwardDays), [forwardDays], wanted,
  );
  const rolling = useResource(
    () => api.getRollingWindows(windowDays), [windowDays], wanted,
  );
  const grid = useResource(
    () => api.getStrategyGrid(gridDays), [gridDays], wanted,
  );
  const scores = useResource(
    () => api.getScoreHistory(scoreDays), [scoreDays], wanted,
  );
  // Rides with the score history: the events are the halvings and the window's
  // extremes drawn onto that one chart, never a card of their own. It is
  // therefore not counted in the progress line, and a failure here leaves the
  // chart standing without its reference lines rather than taking it down.
  const events = useResource(
    () => api.getChartEvents(scoreDays), [scoreDays], wanted,
  );
  const candidates = useResource(
    () => api.getCandidateSignals(candidateDays), [candidateDays], wanted,
  );
  const variants = useResource(
    () => api.getScoringVariants(variantDays), [variantDays], wanted,
  );

  // The seven analyses, for the progress line below the heading. This section
  // is where waiting actually happens — a cold scoring table is three years of
  // candles — so it says how far along it is instead of showing seven silent
  // skeletons. One that failed is no longer pending: it has said so itself.
  const analyses = [attribution, rolling, scores, forward, candidates, variants, grid];
  const ready = analyses.filter((a) => a.data != null || a.error != null).length;

  return (
    <section
      ref={sectionRef}
      id="research"
      className="pad-safe-x mx-auto flex w-full max-w-shell scroll-mt-20 flex-col gap-3 px-3 pb-8 pt-5 sm:gap-4 sm:px-4 md:px-6 md:pb-10 md:pt-6"
    >
      <SectionHeading
        icon={<FlaskIcon />}
        title="Research"
        subtitle="Seven checks on one question: is buying more on dips better than buying the same amount every week?"
        actions={
          <a
            href={api.datasetUrl(1095)}
            download
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-sand-soft px-4 py-2.5 text-sm font-bold text-teal transition hover:bg-water-soft sm:flex-none sm:justify-start sm:py-2"
          >
            <DownloadSimpleIcon /> Download the data
          </a>
        }
      />

      {/* Only while something is genuinely still out. A card that failed says
          so itself, in its own words, where it is read — there is no section-
          wide alert any more, because one dead endpoint is not seven. */}
      {wanted && ready < analyses.length && (
        <div className="rounded-card border-2 border-water/50 bg-water-soft/30 px-4 py-3">
          <Loading
            compact
            what={`Testing the strategy — ${ready} of ${analyses.length} checks ready`}
            why="All seven share one table: three years of days, each scored the way the bot scores today."
            slow="Building that table takes a while on a cold cache — three years of prices are fetched from Coinbase. It is kept for an hour, so the rest arrive quickly."
            slowAfter={4}
          />
        </div>
      )}

      {/* The section's one `lead`, and it comes first because it is the answer
          to the question the heading asks: how often the multiplier actually
          beat a flat weekly buy. Everything under it is a narrower question
          about *why*, and they all keep the plain tile row. */}
      <EdgeDistribution
        data={rolling.data}
        error={rolling.error}
        onRetry={rolling.retry}
        windowDays={windowDays}
        onWindowDays={setWindowDays}
      />
      <AttributionWaterfall
        data={attribution.data}
        error={attribution.error}
        onRetry={attribution.retry}
        days={attributionDays}
        onDays={setAttributionDays}
      />
      <ScoreHistory
        data={scores.data}
        events={events.data}
        error={scores.error}
        onRetry={scores.retry}
        days={scoreDays}
        onDays={setScoreDays}
      />
      <ForwardReturnsTable
        data={forward.data}
        error={forward.error}
        onRetry={forward.retry}
        days={forwardDays}
        onDays={setForwardDays}
      />
      <SignalScreen
        data={candidates.data}
        error={candidates.error}
        onRetry={candidates.retry}
        days={candidateDays}
        onDays={setCandidateDays}
      />
      <ScoringVariants
        data={variants.data}
        error={variants.error}
        onRetry={variants.retry}
        windowDays={variantDays}
        onWindowDays={setVariantDays}
      />
      <WeekdayGrid
        data={grid.data}
        error={grid.error}
        onRetry={grid.retry}
        days={gridDays}
        onDays={setGridDays}
      />
    </section>
  );
}
