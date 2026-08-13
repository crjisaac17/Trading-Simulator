/**
 * High-Performance Canvas Chart Engine (Fixed Scaling & Fitting)
 * Renders Candlestick charts, Technical Indicators (EMA, RSI), and Crosshair seamlessly filling container bounds.
 */
class ChartEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    this.candles = [];
    this.indicators = {
      ema20: true,
      ema50: true,
      rsi: true
    };

    this.padding = { top: 20, right: 65, bottom: 25, left: 15 };
    this.subChartHeight = 70;

    this.visibleCount = 60;
    this.mouseX = -1;
    this.mouseY = -1;

    this.digits = 2;
    this.initEvents();
  }

  setDigits(digits) {
    this.digits = digits;
  }

  toggleIndicator(name) {
    if (this.indicators.hasOwnProperty(name)) {
      this.indicators[name] = !this.indicators[name];
      this.draw();
    }
  }

  setData(candles) {
    this.candles = candles || [];
    this.resizeCanvas();
    this.draw();
  }

  initEvents() {
    if (!this.canvas) return;

    window.addEventListener('resize', () => {
      this.resizeCanvas();
      this.draw();
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
      this.draw();
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.mouseX = -1;
      this.mouseY = -1;
      this.draw();
    });

    this.resizeCanvas();
  }

  resizeCanvas() {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    if (parent) {
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      // Set display size (CSS pixels)
      this.canvas.style.width = `${rect.width}px`;
      this.canvas.style.height = `${rect.height}px`;

      // Set actual render bitmap resolution
      this.canvas.width = Math.floor(rect.width * dpr);
      this.canvas.height = Math.floor(rect.height * dpr);
    }
  }

  draw() {
    if (!this.canvas || !this.ctx || this.candles.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.width / dpr;
    const height = this.canvas.height / dpr;

    // Reset transform matrix and clear bitmap
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Scale for high-DPR screens
    this.ctx.scale(dpr, dpr);

    let subChartCount = 0;
    if (this.indicators.rsi) subChartCount++;

    const totalSubHeight = subChartCount * this.subChartHeight;
    const mainChartHeight = Math.max(100, height - this.padding.top - this.padding.bottom - totalSubHeight);
    const chartWidth = Math.max(100, width - this.padding.left - this.padding.right);

    // Visible slice
    const totalCount = this.candles.length;
    const start = Math.max(0, totalCount - this.visibleCount);
    const visibleCandles = this.candles.slice(start);

    if (visibleCandles.length === 0) return;

    // Min & Max Price calculation with dynamic padding
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    visibleCandles.forEach(c => {
      if (c.low < minPrice) minPrice = c.low;
      if (c.high > maxPrice) maxPrice = c.high;
    });

    const priceRange = (maxPrice - minPrice) || 1;
    minPrice -= priceRange * 0.05;
    maxPrice += priceRange * 0.05;

    // Draw Grid & Price Axis
    this.drawGrid(width, mainChartHeight, chartWidth, minPrice, maxPrice);

    // Candle Spacing & Width
    const candleSpacing = chartWidth / visibleCandles.length;
    const candleWidth = Math.max(3, candleSpacing * 0.65);

    // Draw Candlesticks & Volume
    visibleCandles.forEach((c, i) => {
      const x = this.padding.left + i * candleSpacing + candleSpacing / 2;
      const openY = this.padding.top + mainChartHeight * (1 - (c.open - minPrice) / (maxPrice - minPrice));
      const closeY = this.padding.top + mainChartHeight * (1 - (c.close - minPrice) / (maxPrice - minPrice));
      const highY = this.padding.top + mainChartHeight * (1 - (c.high - minPrice) / (maxPrice - minPrice));
      const lowY = this.padding.top + mainChartHeight * (1 - (c.low - minPrice) / (maxPrice - minPrice));

      const isBull = c.close >= c.open;
      const color = isBull ? '#00e676' : '#ff1744';

      // Wick
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 1.2;
      this.ctx.beginPath();
      this.ctx.moveTo(x, highY);
      this.ctx.lineTo(x, lowY);
      this.ctx.stroke();

      // Body
      this.ctx.fillStyle = color;
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(Math.abs(closeY - openY), 1.5);
      this.ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
    });

    // Technical Indicators
    if (this.indicators.ema20) this.drawEMA(visibleCandles, 20, '#00e5ff', chartWidth, mainChartHeight, minPrice, maxPrice);
    if (this.indicators.ema50) this.drawEMA(visibleCandles, 50, '#ff9100', chartWidth, mainChartHeight, minPrice, maxPrice);

    // Sub-chart (RSI)
    if (this.indicators.rsi) {
      const currentSubY = this.padding.top + mainChartHeight + 10;
      this.drawRSI(visibleCandles, currentSubY, chartWidth, this.subChartHeight - 15);
    }

    // Crosshair Cursor & Hover Tag
    if (this.mouseX > this.padding.left && this.mouseX < this.padding.left + chartWidth && this.mouseY > this.padding.top && this.mouseY < height - this.padding.bottom) {
      this.drawCrosshair(width, height, chartWidth, mainChartHeight, minPrice, maxPrice);
    }
  }

  drawGrid(width, mainChartHeight, chartWidth, minPrice, maxPrice) {
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    this.ctx.lineWidth = 1;
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = '11px sans-serif';
    this.ctx.textAlign = 'left';

    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const y = this.padding.top + (mainChartHeight / steps) * i;
      const price = maxPrice - ((maxPrice - minPrice) / steps) * i;

      this.ctx.beginPath();
      this.ctx.moveTo(this.padding.left, y);
      this.ctx.lineTo(this.padding.left + chartWidth, y);
      this.ctx.stroke();

      this.ctx.fillText(`$${price.toFixed(this.digits)}`, this.padding.left + chartWidth + 6, y + 4);
    }
  }

  drawEMA(visibleCandles, period, color, chartWidth, mainChartHeight, minPrice, maxPrice) {
    const k = 2 / (period + 1);
    let ema = visibleCandles[0].close;
    const points = [];
    const candleSpacing = chartWidth / visibleCandles.length;

    visibleCandles.forEach((c, i) => {
      ema = c.close * k + ema * (1 - k);
      const x = this.padding.left + i * candleSpacing + candleSpacing / 2;
      const y = this.padding.top + mainChartHeight * (1 - (ema - minPrice) / (maxPrice - minPrice));
      points.push({ x, y });
    });

    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    points.forEach((p, i) => {
      if (i === 0) this.ctx.moveTo(p.x, p.y);
      else this.ctx.lineTo(p.x, p.y);
    });
    this.ctx.stroke();
  }

  drawRSI(visibleCandles, topY, chartWidth, subHeight) {
    const period = 14;
    const rsiValues = [];
    let gains = 0, losses = 0;

    for (let i = 1; i <= period && i < visibleCandles.length; i++) {
      const diff = visibleCandles[i].close - visibleCandles[i - 1].close;
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }

    let avgGain = gains / (period || 1);
    let avgLoss = losses / (period || 1);

    const candleSpacing = chartWidth / visibleCandles.length;

    visibleCandles.forEach((c, i) => {
      if (i < period) {
        rsiValues.push(50);
        return;
      }
      const diff = c.close - visibleCandles[i - 1].close;
      avgGain = (avgGain * 13 + (diff > 0 ? diff : 0)) / 14;
      avgLoss = (avgLoss * 13 + (diff < 0 ? -diff : 0)) / 14;
      const rs = avgGain / (avgLoss || 0.00001);
      const rsi = 100 - (100 / (1 + rs));
      rsiValues.push(rsi);
    });

    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    this.ctx.fillRect(this.padding.left, topY, chartWidth, subHeight);

    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    this.ctx.beginPath();
    const y70 = topY + subHeight * (1 - 0.7);
    const y30 = topY + subHeight * (1 - 0.3);
    this.ctx.moveTo(this.padding.left, y70);
    this.ctx.lineTo(this.padding.left + chartWidth, y70);
    this.ctx.moveTo(this.padding.left, y30);
    this.ctx.lineTo(this.padding.left + chartWidth, y30);
    this.ctx.stroke();

    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = '10px sans-serif';
    this.ctx.fillText('RSI (14)', this.padding.left + 5, topY + 12);
    this.ctx.fillText('70', this.padding.left + chartWidth + 6, y70 + 3);
    this.ctx.fillText('30', this.padding.left + chartWidth + 6, y30 + 3);

    this.ctx.strokeStyle = '#ab47bc';
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    rsiValues.forEach((rsi, i) => {
      const x = this.padding.left + i * candleSpacing + candleSpacing / 2;
      const y = topY + subHeight * (1 - rsi / 100);
      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    });
    this.ctx.stroke();
  }

  drawCrosshair(width, height, chartWidth, mainChartHeight, minPrice, maxPrice) {
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([3, 3]);

    // Vertical line
    this.ctx.beginPath();
    this.ctx.moveTo(this.mouseX, this.padding.top);
    this.ctx.lineTo(this.mouseX, height - this.padding.bottom);
    this.ctx.stroke();

    // Horizontal line
    this.ctx.beginPath();
    this.ctx.moveTo(this.padding.left, this.mouseY);
    this.ctx.lineTo(this.padding.left + chartWidth, this.mouseY);
    this.ctx.stroke();

    this.ctx.setLineDash([]);

    const hoverPrice = maxPrice - ((this.mouseY - this.padding.top) / mainChartHeight) * (maxPrice - minPrice);
    if (hoverPrice >= minPrice && hoverPrice <= maxPrice) {
      this.ctx.fillStyle = '#1e293b';
      this.ctx.fillRect(this.padding.left + chartWidth + 2, this.mouseY - 9, 62, 18);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '10px sans-serif';
      this.ctx.fillText(`$${hoverPrice.toFixed(this.digits)}`, this.padding.left + chartWidth + 6, this.mouseY + 3);
    }
  }
}

window.ChartEngine = ChartEngine;
