import { Component, type ErrorInfo, type ReactNode } from "react";
import { Card, Failed, type Ground } from "./ui";

/**
 * The last thing between a bug in one card and a blank page.
 *
 * `useResource` answers a load that *failed*; this answers a render that
 * **threw**, which React handles by unmounting the entire tree. Until now that
 * meant one bad number in one card took the whole dashboard with it — and on the
 * wall display, which refreshes itself and has nobody sitting in front of it,
 * a white monitor until somebody walks past.
 *
 * Three rules, and they are the same ones `Failed` follows:
 *
 * - **It says what broke, in the card's own voice.** `what` is the caller's
 *   sentence, so a reader is told which part of the page is missing rather than
 *   being shown a stack trace they cannot act on.
 * - **The retry is real.** Bumping `key` remounts the subtree, so a card that
 *   threw on a transient shape can genuinely come back. It is the same word and
 *   the same button as every other failure in the app.
 * - **No new vocabulary.** `Failed` already knows how to say this on paper and
 *   on the water; this only decides *when*.
 *
 * A class component because that is the only way React exposes this — the one
 * class in the app, and it is not a style to follow anywhere else.
 */
interface Props {
  children: ReactNode;
  /** Named in the past tense, in the voice of the thing that is missing. */
  what: string;
  /** Wrap the fallback in a `Card`, so a card-shaped hole stays card-shaped. */
  card?: boolean;
  on?: Ground;
}

interface State {
  error: Error | null;
  /** Remount counter — the retry, and the reason this can recover at all. */
  attempt: number;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // The console is the only place this can go: Drip has no error reporting
    // and is not getting any — it is a bot on somebody's home network, and
    // shipping a crash off it would be the one thing here that phones out.
    console.error(`Drip: ${this.props.what} crashed`, error, info.componentStack);
  }

  render() {
    const { children, what, card = false, on = "paper" } = this.props;
    const { error, attempt } = this.state;

    if (!error) return <div key={attempt}>{children}</div>;

    const fallback = (
      <Failed
        what={what}
        why={error.message}
        retryLabel="Reload this"
        on={on}
        onRetry={() => this.setState({ error: null, attempt: attempt + 1 })}
      />
    );

    return card ? (
      <Card>
        <div className="flex h-56 items-center justify-center">{fallback}</div>
      </Card>
    ) : (
      <div className="flex min-h-40 items-center justify-center px-4 py-8">
        {fallback}
      </div>
    );
  }
}
