/**
 * Order Book & Trade Tape Component Engine
 * Renders dynamic Level 2 Depth and real-time execution tick logs.
 */
class OrderBookEngine {
  constructor(containerId, tapeId) {
    this.container = document.getElementById(containerId);
    this.tapeContainer = document.getElementById(tapeId);
    this.bids = [];
    this.asks = [];
    this.trades = [];
    this.maxDepth = 10;
  }

  update(currentPrice, digits = 2) {
    if (!this.container) return;

    this.generateDepth(currentPrice, digits);
    this.renderBook(digits);
  }

  generateDepth(currentPrice, digits) {
    const spreadPct = 0.0003;
    const stepPct = 0.0004;

    this.asks = [];
    this.bids = [];

    let totalAskVol = 0;
    let totalBidVol = 0;

    // Asks (Sells above current price)
    for (let i = this.maxDepth; i >= 1; i--) {
      const p = currentPrice * (1 + spreadPct + i * stepPct);
      const size = Number((Math.random() * 2.5 + 0.1).toFixed(digits === 5 ? 2 : 4));
      totalAskVol += size;
      this.asks.push({ price: p, size, total: totalAskVol });
    }

    // Bids (Buys below current price)
    for (let i = 1; i <= this.maxDepth; i++) {
      const p = currentPrice * (1 - spreadPct - i * stepPct);
      const size = Number((Math.random() * 2.5 + 0.1).toFixed(digits === 5 ? 2 : 4));
      totalBidVol += size;
      this.bids.push({ price: p, size, total: totalBidVol });
    }

    // Occasionally add a random trade to the tape
    if (Math.random() < 0.6) {
      const isBuy = Math.random() > 0.48;
      const tradePrice = isBuy ? this.asks[this.asks.length - 1].price : this.bids[0].price;
      const tradeSize = Number((Math.random() * 1.5 + 0.05).toFixed(digits === 5 ? 2 : 3));
      this.addTradeToTape(tradePrice, tradeSize, isBuy, digits);
    }
  }

  renderBook(digits) {
    let html = `
      <div class="orderbook-header">
        <span>Price</span>
        <span>Size</span>
        <span>Total</span>
      </div>
      <div class="orderbook-asks">
    `;

    const maxAskTotal = this.asks[0]?.total || 1;
    this.asks.forEach(ask => {
      const depthPct = Math.min((ask.total / maxAskTotal) * 100, 100);
      html += `
        <div class="book-row ask-row">
          <div class="depth-bar ask-bar" style="width: ${depthPct}%"></div>
          <span class="ask-price">${ask.price.toFixed(digits)}</span>
          <span>${ask.size}</span>
          <span>${ask.total.toFixed(2)}</span>
        </div>
      `;
    });

    html += `</div><div class="orderbook-spread">Spread: ${(this.asks[this.asks.length - 1]?.price - this.bids[0]?.price || 0).toFixed(digits)}</div><div class="orderbook-bids">`;

    const maxBidTotal = this.bids[this.bids.length - 1]?.total || 1;
    this.bids.forEach(bid => {
      const depthPct = Math.min((bid.total / maxBidTotal) * 100, 100);
      html += `
        <div class="book-row bid-row">
          <div class="depth-bar bid-bar" style="width: ${depthPct}%"></div>
          <span class="bid-price">${bid.price.toFixed(digits)}</span>
          <span>${bid.size}</span>
          <span>${bid.total.toFixed(2)}</span>
        </div>
      `;
    });

    html += `</div>`;
    this.container.innerHTML = html;
  }

  addTradeToTape(price, size, isBuy, digits) {
    if (!this.tapeContainer) return;

    const timeStr = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const tradeItem = { time: timeStr, price, size, isBuy };
    this.trades.unshift(tradeItem);
    if (this.trades.length > 25) this.trades.pop();

    let html = `
      <div class="tape-header">
        <span>Time</span>
        <span>Price</span>
        <span>Qty</span>
      </div>
      <div class="tape-rows">
    `;

    this.trades.forEach(t => {
      html += `
        <div class="tape-row ${t.isBuy ? 'tape-buy' : 'tape-sell'}">
          <span>${t.time}</span>
          <span class="tape-price">${t.price.toFixed(digits)}</span>
          <span>${t.size}</span>
        </div>
      `;
    });

    html += `</div>`;
    this.tapeContainer.innerHTML = html;
  }
}

window.OrderBookEngine = OrderBookEngine;
