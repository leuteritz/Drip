import { useEffect, useRef, useState, type RefObject } from "react";
import DownloadSimpleIcon from "~icons/ph/download-simple";
import FlaskIcon from "~icons/ph/flask";
import {
  api,
  type Attribution,
  type ChartEvent,
  type CandidateSignals,
  type ForwardReturns,
  type RollingWindows,
  type ScorePoint,
  type ScoringVariants as ScoringVariantsData,
  type StrategyGrid,
} from "../api/client";
import AttributionWaterfall from "../components/research/AttributionWaterfall";
import EdgeDistribution from "../components/research/EdgeDistribution";
import ForwardReturnsTable from "../components/research/ForwardReturnsTable";
import { useNearViewport } from "../components/research/hooks";
import ScoreHistory from "../components/research/ScoreHistory";
import ScoringVariants from "../components/research/ScoringVariants";
import SignalScreen from "../components/research/SignalScreen";
import WeekdayGrid from "../components/research/WeekdayGrid";
import { Card, Failed, Loading, SectionHeading } from "../components/ui";

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

  const [attribution, setAttribution] = useState<Attribution | null>(null);
  const [forward, setForward] = useState<ForwardReturns | null>(null);
  const [rolling, setRolling] = useState<RollingWindows | null>(null);
  const [grid, setGrid] = useState<StrategyGrid | null>(null);
  const [scores, setScores] = useState<ScorePoint[] | null>(null);
  const [events, setEvents] = useState<ChartEvent[] | null>(null);
  const [candidates, setCandidates] = useState<CandidateSignals | null>(null);
  const [variants, setVariants] = useState<ScoringVariantsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped by the one retry, and a dependency of all seven effects.
  const [attempt, setAttempt] = useState(0);

  const fail = (e: unknown) =>
    setError(e instanceof Error ? e.message : String(e));

  // The seven analyses, for the progress line below the heading. This section
  // is where waiting actually happens — a cold scoring table is three years of
  // candles — so it says how far along it is instead of showing seven silent
  // skeletons. `events` rides with the score history and is not counted.
  const analyses = [attribution, rolling, scores, forward, candidates, variants, grid];
  const ready = analyses.filter((a) => a != null).length;

  useEffect(() => {
    if (!wanted) return;
    api.getAttribution(attributionDays).then(setAttribution).catch(fail);
  }, [wanted, attributionDays, attempt]);

  useEffect(() => {
    if (!wanted) return;
    api.getForwardReturns(forwardDays).then(setForward).catch(fail);
  }, [wanted, forwardDays, attempt]);

  useEffect(() => {
    if (!wanted) return;
    api.getRollingWindows(windowDays).then(setRolling).catch(fail);
  }, [wanted, windowDays, attempt]);

  useEffect(() => {
    if (!wanted) return;
    api.getStrategyGrid(gridDays).then(setGrid).catch(fail);
  }, [wanted, gridDays, attempt]);

  useEffect(() => {
    if (!wanted) return;
    api.getScoreHistory(scoreDays).then(setScores).catch(fail);
    api.getChartEvents(scoreDays).then(setEvents).catch(fail);
  }, [wanted, scoreDays, attempt]);

  useEffect(() => {
    if (!wanted) return;
    api.getCandidateSignals(candidateDays).then(setCandidates).catch(fail);
  }, [wanted, candidateDays, attempt]);

  useEffect(() => {
    if (!wanted) return;
    api.getScoringVariants(variantDays).then(setVariants).catch(fail);
  }, [wanted, variantDays, attempt]);

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

      {wanted && !error && ready < analyses.length && (
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

      {error && (
        <Card tone="alert">
          <Failed
            what="Could not build the strategy tests"
            why={error}
            /* One retry for the section rather than one per card: all seven are
               cut from the same scoring table, so they fail and recover
               together. `attempt` is in every effect's deps. */
            onRetry={() => {
              setError(null);
              setAttempt((n) => n + 1);
            }}
          />
          <p className="mt-2 text-center text-sm text-ink-soft">
            These may need to fetch three years of prices on their first run.
          </p>
        </Card>
      )}

      <AttributionWaterfall
        data={attribution}
        days={attributionDays}
        onDays={setAttributionDays}
      />
      <EdgeDistribution
        data={rolling}
        windowDays={windowDays}
        onWindowDays={setWindowDays}
      />
      <ScoreHistory
        data={scores}
        events={events}
        days={scoreDays}
        onDays={setScoreDays}
      />
      <ForwardReturnsTable
        data={forward}
        days={forwardDays}
        onDays={setForwardDays}
      />
      <SignalScreen
        data={candidates}
        days={candidateDays}
        onDays={setCandidateDays}
      />
      <ScoringVariants
        data={variants}
        windowDays={variantDays}
        onWindowDays={setVariantDays}
      />
      <WeekdayGrid data={grid} days={gridDays} onDays={setGridDays} />
    </section>
  );
}
