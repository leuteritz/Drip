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
import { Card, Loading, SectionHeading } from "../components/ui";

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
  }, [wanted, attributionDays]);

  useEffect(() => {
    if (!wanted) return;
    api.getForwardReturns(forwardDays).then(setForward).catch(fail);
  }, [wanted, forwardDays]);

  useEffect(() => {
    if (!wanted) return;
    api.getRollingWindows(windowDays).then(setRolling).catch(fail);
  }, [wanted, windowDays]);

  useEffect(() => {
    if (!wanted) return;
    api.getStrategyGrid(gridDays).then(setGrid).catch(fail);
  }, [wanted, gridDays]);

  useEffect(() => {
    if (!wanted) return;
    api.getScoreHistory(scoreDays).then(setScores).catch(fail);
    api.getChartEvents(scoreDays).then(setEvents).catch(fail);
  }, [wanted, scoreDays]);

  useEffect(() => {
    if (!wanted) return;
    api.getCandidateSignals(candidateDays).then(setCandidates).catch(fail);
  }, [wanted, candidateDays]);

  useEffect(() => {
    if (!wanted) return;
    api.getScoringVariants(variantDays).then(setVariants).catch(fail);
  }, [wanted, variantDays]);

  return (
    <section
      ref={sectionRef}
      id="research"
      className="scroll-mt-20 flex flex-col gap-4 px-4 pb-8 pt-5 md:px-6 md:pb-10 md:pt-6"
    >
      <SectionHeading
        icon={<FlaskIcon />}
        title="Research"
        subtitle="Seven ways of asking whether the score is worth its multiplier"
        actions={
          <a
            href={api.datasetUrl(1095)}
            download
            className="flex items-center gap-2 rounded-full bg-sand-soft px-4 py-2 text-sm font-bold text-teal transition hover:bg-water-soft"
          >
            <DownloadSimpleIcon /> Download the data
          </a>
        }
      />

      {wanted && !error && ready < analyses.length && (
        <div className="rounded-card border-2 border-water/50 bg-water-soft/30 px-4 py-3">
          <Loading
            compact
            what={`Auditing the strategy — ${ready} of ${analyses.length} analyses ready`}
            why="They share one scoring table: three years of days, each scored the way the bot scores today."
            slow="The first request builds that table, and on a cold cache fetches three years of candles from Coinbase. It is kept for an hour afterwards, so the rest of these arrive quickly."
            slowAfter={4}
          />
        </div>
      )}

      {error && (
        <Card className="border-rose/50">
          <div className="font-bold text-rose">{error}</div>
          <div className="mt-2 text-sm text-ink-soft">
            The research endpoints may need to fetch three years of candles on their
            first run.
          </div>
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
