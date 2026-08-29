import "./_group.css";

type Candle = {
  x: number;
  open: number;
  close: number;
  high: number;
  low: number;
};

const bullish: Candle[] = [
  { x: 74, open: 230, close: 176, high: 144, low: 252 },
  { x: 136, open: 190, close: 132, high: 98, low: 214 },
  { x: 198, open: 148, close: 94, high: 62, low: 171 },
  { x: 260, open: 112, close: 66, high: 40, low: 134 },
  { x: 322, open: 82, close: 42, high: 24, low: 102 },
];

const bearish: Candle[] = [
  { x: 74, open: 42, close: 94, high: 20, low: 116 },
  { x: 136, open: 78, close: 136, high: 54, low: 160 },
  { x: 198, open: 120, close: 178, high: 96, low: 202 },
  { x: 260, open: 160, close: 220, high: 136, low: 246 },
  { x: 322, open: 204, close: 258, high: 180, low: 286 },
];

function CandleChart({
  title,
  subtitle,
  candles,
  bullishMode,
}: {
  title: string;
  subtitle: string;
  candles: Candle[];
  bullishMode: boolean;
}) {
  const tone = bullishMode ? "#4ade80" : "#fb7185";
  const mutedTone = bullishMode ? "#bbf7d0" : "#fecdd3";

  return (
    <article className="candle-card">
      <div className="candle-card-head">
        <div>
          <p className="eyebrow">{bullishMode ? "UPTREND" : "DOWNTREND"}</p>
          <h2>{title}</h2>
        </div>
        <span className="signal-dot" style={{ background: tone }} />
      </div>
      <svg
        className="candle-chart"
        viewBox="0 0 390 320"
        role="img"
        aria-label={`${title} candlestick example`}
      >
        <g className="chart-grid">
          {[58, 112, 166, 220, 274].map((y) => (
            <line key={y} x1="28" y1={y} x2="362" y2={y} />
          ))}
          {[74, 136, 198, 260, 322].map((x) => (
            <line key={x} x1={x} y1="30" x2={x} y2="286" />
          ))}
        </g>
        {candles.map((candle) => {
          const top = Math.min(candle.open, candle.close);
          const bodyHeight = Math.max(14, Math.abs(candle.open - candle.close));
          return (
            <g key={candle.x} className="candle" style={{ color: tone }}>
              <line x1={candle.x} y1={candle.high} x2={candle.x} y2={candle.low} />
              <rect
                x={candle.x - 14}
                y={top}
                width="28"
                height={bodyHeight}
                rx="4"
                fill={tone}
                stroke={mutedTone}
              />
            </g>
          );
        })}
        <path
          className="trend-line"
          style={{ stroke: mutedTone }}
          d={bullishMode ? "M42 258 C120 236 156 192 214 150 S300 100 348 58" : "M42 50 C112 74 156 116 214 154 S300 210 348 258"}
        />
      </svg>
      <div className="candle-card-foot">
        <span className="legend"><i style={{ background: tone }} /> Close {bullishMode ? "above" : "below"} open</span>
        <span>{subtitle}</span>
      </div>
    </article>
  );
}

export function CandlestickReference() {
  return (
    <main className="reference-shell">
      <header className="reference-head">
        <div>
          <p className="eyebrow">PRICE ACTION PRIMER</p>
          <h1>Read the candle before the signal.</h1>
        </div>
        <span className="reference-mark">PFX / 01</span>
      </header>
      <section className="candle-grid">
        <CandleChart
          title="Bullish candle"
          subtitle="Buying pressure"
          candles={bullish}
          bullishMode
        />
        <CandleChart
          title="Bearish candle"
          subtitle="Selling pressure"
          candles={bearish}
          bullishMode={false}
        />
      </section>
      <p className="disclaimer">Illustrative price action only — a single candle is not a trading signal.</p>
    </main>
  );
}