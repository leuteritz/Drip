import { useEffect, useRef, useState, type RefObject } from "react";
import FlaskIcon from "~icons/ph/flask";
import {
  api,
  type Attribution,
  type ForwardReturns,
  type RollingWindows,
  type StrategyGrid,
} from "../api/client";
import AttributionWaterfall from "../components/research/AttributionWaterfall";
import EdgeDistribution from "../components/research/EdgeDistribution";
import ForwardReturnsTable from "../components/research/ForwardReturnsTable";
import { useNearViewport } from "../components/research/hooks";
import WeekdayGrid from "../components/research/WeekdayGrid";
import { Card, SectionHeading } from "../components/ui";

/**
 * The Research body: four read-only analyses that audit the strategy instead of
 * reporting it. Nothing here can place an order or write a row.
 *
 * All four hit `/api/research/*`, which share one cached scoring table spanning
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
  const [windowDays, setWindowDays] = useState(365);

  const [attribution, setAttribution] = useState<Attribution | null>(null);
  const [forward, setForward] = useState<ForwardReturns | null>(null);
  const [rolling, setRolling] = useState<RollingWindows | null>(null);
  const [grid, setGrid] = useState<StrategyGrid | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fail = (e: unknown) =>
    setError(e instanceof Error ? e.message : String(e));

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

  return (
    <section
      ref={sectionRef}
      id="research"
      className="scroll-mt-20 flex flex-col gap-4 px-4 pb-8 pt-5 md:px-6 md:pb-10 md:pt-6"
    >
      <SectionHeading
        icon={<FlaskIcon />}
        title="Research"
        subtitle="Four ways of asking whether the score is worth its multiplier"
      />

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
      <ForwardReturnsTable
        data={forward}
        days={forwardDays}
        onDays={setForwardDays}
      />
      <WeekdayGrid data={grid} days={gridDays} onDays={setGridDays} />
    </section>
  );
}
