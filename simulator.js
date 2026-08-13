/**
 * 15-Minute Single-Stock Live Event Simulator Engine
 * Ticks every 1 second. Unbiased neutral market events impact supply and demand vectors.
 */

const SINGLE_STOCK = {
  symbol: "NCT",
  name: "NovaChip Technologies",
  sector: "Technology & AI Semiconductors",
  price: 80.00,
  startingPrice: 80.00,
  description: "Leading designer and manufacturer of high-performance AI chips and semiconductor hardware."
};

// Unbiased, neutral market events (No 'bullish'/'bearish' labels or badges)
const MARKET_EVENTS_SCHEDULE = [
  {
    timestamp: 30, // at 00:30
    title: "Supply Agreement Announcement",
    headline: "Enterprise Partner signs multi-year procurement agreement with NovaChip.",
    demandImpact: 0.08,
    description: "New commercial agreement executed for next-generation semiconductor hardware delivery."
  },
  {
    timestamp: 105, // at 01:45
    title: "Raw Material Import Policy Update",
    headline: "Tariff adjustments enacted on global silicon wafer imports across primary trade routes.",
    demandImpact: -0.03,
    description: "Updated international trade duties take effect for silicon input supplies."
  },
  {
    timestamp: 180, // at 03:00
    title: "Investment Bank Coverage Report",
    headline: "Major Wall Street Research Firm publishes updated valuation report for NovaChip.",
    demandImpact: 0.12,
    description: "Financial analysts issue updated 12-month sector valuation outlook."
  },
  {
    timestamp: 270, // at 04:30
    title: "Macro Economic CPI Release",
    headline: "Government Statistics Bureau releases monthly Consumer Price Index and inflation figures.",
    demandImpact: 0.05,
    description: "Latest macroeconomic data published regarding broad price indices."
  },
  {
    timestamp: 360, // at 06:00
    title: "Software Advisory Note",
    headline: "Technical Advisory: Firmware patch requirement identified for legacy system builds.",
    demandImpact: -0.09,
    description: "Engineering team issues technical notice regarding legacy firmware revision."
  },
  {
    timestamp: 450, // at 07:30
    title: "Firmware Maintenance Update",
    headline: "NovaChip Engineering confirms completion of scheduled server maintenance window.",
    demandImpact: 0.07,
    description: "All server infrastructure returns to standard operational status following maintenance."
  },
  {
    timestamp: 540, // at 09:00
    title: "Patent Office Notice",
    headline: "Patent & Trademark Office awards IP rights for 2nm micro-architecture design.",
    demandImpact: 0.16,
    description: "Intellectual property protection granted for new semiconductor cell layout."
  },
  {
    timestamp: 630, // at 10:30
    title: "Quarterly Portfolio Rebalancing",
    headline: "Institutional Investment Funds initiate scheduled quarterly portfolio allocation adjustments.",
    demandImpact: -0.05,
    description: "Institutional asset managers adjust sector weightings per quarterly mandate."
  },
  {
    timestamp: 720, // at 12:00
    title: "Global Infrastructure Projection",
    headline: "Industry Research Group releases 5-year global data center capacity forecast.",
    demandImpact: 0.09,
    description: "Market intelligence report published evaluating long-term server hardware demand."
  },
  {
    timestamp: 810, // at 13:30
    title: "Session Rebalance Trading",
    headline: "Index providers execute scheduled end-of-session portfolio index matching.",
    demandImpact: 0.07,
    description: "Index tracking funds complete daily asset weight adjustments."
  }
];

class SingleStockSimulator {
  constructor() {
    this.totalDurationSeconds = 900; // 15 Minutes
    this.elapsedSeconds = 0;
    this.stock = { ...SINGLE_STOCK };
    this.priceHistory = [SINGLE_STOCK.startingPrice];
    this.candles = [];
    this.activeDemandVelocity = 0;
    this.userTradeImpact = 0;

    this.timer = null;
    this.tickListeners = [];
    this.eventListeners = [];
  }

  start() {
    this.stop();
    this.timer = setInterval(() => {
      this.step();
    }, 1000);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  step() {
    if (this.elapsedSeconds >= this.totalDurationSeconds) {
      this.stop();
      this.notifyListeners('complete', { elapsed: this.elapsedSeconds });
      return;
    }

    this.elapsedSeconds++;

    // Check for scheduled market events
    const scheduledEvent = MARKET_EVENTS_SCHEDULE.find(e => e.timestamp === this.elapsedSeconds);
    if (scheduledEvent) {
      this.activeDemandVelocity += scheduledEvent.demandImpact * 0.8;
      this.notifyEvent(scheduledEvent);
    }

    // Decay active demand momentum
    this.activeDemandVelocity *= 0.94;
    this.userTradeImpact *= 0.90;

    // Per-second price calculation (1Hz tick rate)
    const randomNoise = (Math.random() - 0.49) * 0.004;
    const netPctChange = (this.activeDemandVelocity * 0.05) + (this.userTradeImpact * 0.02) + randomNoise;

    const oldPrice = this.stock.price;
    const newPrice = Math.max(1.00, Number((oldPrice * (1 + netPctChange)).toFixed(2)));
    this.stock.price = newPrice;
    this.priceHistory.push(newPrice);

    // Aggregate into 5-second candles for smooth chart display
    this.updateCandles(newPrice);

    this.notifyListeners('tick', {
      elapsedSeconds: this.elapsedSeconds,
      remainingSeconds: this.totalDurationSeconds - this.elapsedSeconds,
      stock: this.stock,
      priceHistory: this.priceHistory,
      candles: this.candles
    });
  }

  updateCandles(currentPrice) {
    const candleTime = Math.floor(this.elapsedSeconds / 5) * 5;
    const lastCandle = this.candles[this.candles.length - 1];

    if (!lastCandle || lastCandle.time !== candleTime) {
      this.candles.push({
        time: candleTime,
        open: currentPrice,
        high: currentPrice,
        low: currentPrice,
        close: currentPrice,
        volume: Math.floor(Math.random() * 50 + 10)
      });
      if (this.candles.length > 180) this.candles.shift();
    } else {
      lastCandle.high = Math.max(lastCandle.high, currentPrice);
      lastCandle.low = Math.min(lastCandle.low, currentPrice);
      lastCandle.close = currentPrice;
      lastCandle.volume += Math.floor(Math.random() * 15 + 2);
    }
  }

  registerUserTrade(shares, isBuy) {
    const impact = isBuy ? (shares * 0.0005) : (-shares * 0.0005);
    this.userTradeImpact += impact;
  }

  subscribe(cb) {
    this.tickListeners.push(cb);
  }

  subscribeEvents(cb) {
    this.eventListeners.push(cb);
  }

  notifyListeners(type, data) {
    this.tickListeners.forEach(cb => cb(type, data));
  }

  notifyEvent(evt) {
    this.eventListeners.forEach(cb => cb(evt));
  }

  reset() {
    this.stop();
    this.elapsedSeconds = 0;
    this.stock = { ...SINGLE_STOCK };
    this.priceHistory = [SINGLE_STOCK.startingPrice];
    this.candles = [];
    this.activeDemandVelocity = 0;
    this.userTradeImpact = 0;
  }
}

window.SINGLE_STOCK = SINGLE_STOCK;
window.MARKET_EVENTS_SCHEDULE = MARKET_EVENTS_SCHEDULE;
window.SingleStockSimulator = SingleStockSimulator;
