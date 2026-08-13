/**
 * 15-Minute Single-Stock Live Trading Application Controller
 * Powered by Supabase PostgreSQL Database Persistence
 * Handles 2-Step Onboarding, Unbiased Market Events, Atomic Trade Logging,
 * Weekly Snapshots, Session State Recovery, and Performance Reporting.
 */

class Live15MinTradingApp {
  constructor() {
    this.userName = '';
    this.userID = ''; // Participant Code
    this.participantId = null; // Supabase UUID
    this.currentAttemptId = null; // Supabase UUID for active simulation attempt
    this.currentWeek = 1;

    this.cash = 100000;
    this.initialCash = 100000;
    this.sharesHeld = 0;
    this.avgBuyPrice = 0;
    this.realizedPnL = 0;

    this.sim = new window.SingleStockSimulator();
    this.tradeHistory = [];
    this.chart = null;
    this.isProcessingTrade = false;

    this.init();
  }

  async init() {
    this.bindEvents();
    await this.checkRegistration();
  }

  async checkRegistration() {
    const savedName = localStorage.getItem('trader_15m_name');
    const savedID = localStorage.getItem('trader_15m_id');
    const savedParticipantId = localStorage.getItem('trader_participant_id');
    const savedAttemptId = localStorage.getItem('trader_attempt_id');

    const onboardingScreen = document.getElementById('onboardingScreen');
    const mainSimulatorView = document.getElementById('mainSimulatorView');

    if (savedName && savedID) {
      this.userName = savedName;
      this.userID = savedID;
      this.participantId = savedParticipantId;
      this.currentAttemptId = savedAttemptId;

      // Ensure participant and attempt exist in Supabase
      if (window.participantService && window.attemptService) {
        const { data: pData } = await window.participantService.findOrCreateParticipant(this.userName, this.userID);
        if (pData) {
          this.participantId = pData.id;
          localStorage.setItem('trader_participant_id', pData.id);
        }

        if (this.currentAttemptId) {
          const attempt = await window.attemptService.getAttempt(this.currentAttemptId);
          if (!attempt || attempt.status === 'completed') {
            // Create a fresh attempt if previous attempt was completed or invalid
            const { data: newAtt } = await window.attemptService.createAttempt(this.participantId);
            if (newAtt) {
              this.currentAttemptId = newAtt.id;
              localStorage.setItem('trader_attempt_id', newAtt.id);
            }
          }
        } else if (this.participantId) {
          const { data: newAtt } = await window.attemptService.createAttempt(this.participantId);
          if (newAtt) {
            this.currentAttemptId = newAtt.id;
            localStorage.setItem('trader_attempt_id', newAtt.id);
          }
        }
      }

      if (onboardingScreen) onboardingScreen.style.display = 'none';
      if (mainSimulatorView) mainSimulatorView.style.display = 'flex';

      this.startSimulation();
    } else {
      if (onboardingScreen) onboardingScreen.style.display = 'flex';
      if (mainSimulatorView) mainSimulatorView.style.display = 'none';

      // Reset onboarding steps to Step 1
      const step1 = document.getElementById('onboardingStep1');
      const step2 = document.getElementById('onboardingStep2');
      if (step1) step1.style.display = 'flex';
      if (step2) step2.style.display = 'none';
    }
  }

  startSimulation() {
    const userBadge = document.getElementById('userDisplayName');
    if (userBadge) {
      userBadge.innerText = `${this.userName} (ID: ${this.userID})`;
    }

    if (window.ChartEngine) {
      this.chart = new window.ChartEngine('priceChart');
      this.chart.setDigits(2);
    }

    this.sim.subscribe((type, data) => {
      if (type === 'tick') {
        this.onTick(data);
      } else if (type === 'complete') {
        this.onSimulationComplete();
      }
    });

    this.sim.subscribeEvents((evt) => {
      this.onMarketEvent(evt);
    });

    this.sim.start();
    this.updatePortfolioUI();
    this.sendHeartbeatToBackend();
  }

  bindEvents() {
    // STEP 1: Registration Form Submit -> Proceed to Step 2 Case Study
    const step1Form = document.getElementById('step1Form');
    if (step1Form) {
      step1Form.addEventListener('submit', (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('inputTraderName').value.trim();
        const idInput = document.getElementById('inputTraderID').value.trim();

        if (nameInput && idInput) {
          this.userName = nameInput;
          this.userID = idInput;

          const step1 = document.getElementById('onboardingStep1');
          const step2 = document.getElementById('onboardingStep2');
          if (step1) step1.style.display = 'none';
          if (step2) step2.style.display = 'flex';
        }
      });
    }

    // Step 2 Back Button
    const btnBackToStep1 = document.getElementById('btnBackToStep1');
    if (btnBackToStep1) {
      btnBackToStep1.addEventListener('click', () => {
        const step1 = document.getElementById('onboardingStep1');
        const step2 = document.getElementById('onboardingStep2');
        if (step1) step1.style.display = 'flex';
        if (step2) step2.style.display = 'none';
      });
    }

    // Step 2 Checkbox Agreement Toggle & Start Simulation
    const chkAgree = document.getElementById('chkAgreeRules');
    const btnStartSim = document.getElementById('btnStartSimulation');
    if (chkAgree && btnStartSim) {
      chkAgree.addEventListener('change', (e) => {
        btnStartSim.disabled = !e.target.checked;
        btnStartSim.style.opacity = e.target.checked ? '1' : '0.5';
      });

      btnStartSim.addEventListener('click', async () => {
        if (!chkAgree.checked) return;

        btnStartSim.disabled = true;
        btnStartSim.innerText = 'INITIALIZING SUPABASE SESSION...';

        try {
          // 1. Create or Find Participant in Supabase
          if (window.participantService) {
            const { data: participant, error: pErr } = await window.participantService.findOrCreateParticipant(this.userName, this.userID);
            if (pErr || !participant) {
              const errorMsg = pErr?.message || (pErr ? JSON.stringify(pErr) : 'Unknown error');
              alert(`Could not initialize participant session in Supabase: ${errorMsg}`);
              btnStartSim.disabled = false;
              btnStartSim.innerText = 'START 15-MINUTE SIMULATION ➔';
              return;
            }
            this.participantId = participant.id;
            localStorage.setItem('trader_participant_id', participant.id);
          }

          // 2. Create NEW Simulation Attempt record in Supabase
          if (window.attemptService && this.participantId) {
            const { data: attempt, error: aErr } = await window.attemptService.createAttempt(this.participantId);
            if (aErr || !attempt) {
              alert('Could not create simulation attempt in database. Please try again.');
              btnStartSim.disabled = false;
              btnStartSim.innerText = 'START 15-MINUTE SIMULATION ➔';
              return;
            }
            this.currentAttemptId = attempt.id;
            localStorage.setItem('trader_attempt_id', attempt.id);
          }

          localStorage.setItem('trader_15m_name', this.userName);
          localStorage.setItem('trader_15m_id', this.userID);

          const onboardingScreen = document.getElementById('onboardingScreen');
          const mainSimulatorView = document.getElementById('mainSimulatorView');

          if (onboardingScreen) onboardingScreen.style.display = 'none';
          if (mainSimulatorView) mainSimulatorView.style.display = 'flex';

          this.startSimulation();
        } catch (err) {
          console.error('Failed to start session with Supabase:', err);
          alert('Error initializing session. Starting local session as fallback.');
          this.startSimulation();
        } finally {
          btnStartSim.disabled = false;
          btnStartSim.innerText = 'START 15-MINUTE SIMULATION ➔';
        }
      });
    }

    // Buy & Sell Buttons
    const btnBuy = document.getElementById('btnBuyShares');
    const btnSell = document.getElementById('btnSellShares');
    if (btnBuy) btnBuy.addEventListener('click', () => this.executeTrade(true));
    if (btnSell) btnSell.addEventListener('click', () => this.executeTrade(false));

    // Quantity Input Listener
    const qtyInput = document.getElementById('tradeQtyInput');
    if (qtyInput) {
      qtyInput.addEventListener('input', () => this.updateCostPreview());
    }

    // Switch User (Logout)
    const btnSwitchUser = document.getElementById('btnSwitchUser');
    if (btnSwitchUser) {
      btnSwitchUser.addEventListener('click', () => {
        localStorage.removeItem('trader_15m_name');
        localStorage.removeItem('trader_15m_id');
        localStorage.removeItem('trader_participant_id');
        localStorage.removeItem('trader_attempt_id');
        location.reload();
      });
    }

    // Restart 15-Min Simulation
    const btnRestartSim = document.getElementById('btnRestartSim');
    if (btnRestartSim) {
      btnRestartSim.addEventListener('click', () => this.restartSimulation());
    }

    // Export CSV Report
    const btnExportReport = document.getElementById('btnExportReport');
    if (btnExportReport) {
      btnExportReport.addEventListener('click', () => this.exportReportCSV());
    }
  }

  async onTick(data) {
    const { remainingSeconds, elapsedSeconds, stock, candles } = data;

    // Update 15-Minute Timer Display
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    const timerEl = document.getElementById('timerDisplay');
    if (timerEl) timerEl.innerText = timeStr;

    const progressPct = ((900 - remainingSeconds) / 900) * 100;
    const progressEl = document.getElementById('timerProgressBar');
    if (progressEl) progressEl.style.width = `${progressPct}%`;

    // Calculate Week Progression (12 Weeks mapped over 900 seconds = 75 seconds per week)
    const computedWeek = Math.min(12, Math.floor(elapsedSeconds / 75) + 1);
    if (computedWeek > this.currentWeek) {
      this.currentWeek = computedWeek;

      // Save weekly snapshot in Supabase
      if (window.snapshotService && this.currentAttemptId) {
        const metrics = {
          cashBalance: this.cash,
          holdingsValue: this.getTotalStockValue(),
          portfolioValue: this.getTotalEquity(),
          realisedPl: this.realizedPnL,
          unrealisedPl: this.getUnrealizedPnL(),
          stockPrice: stock.price,
          sharesHeld: this.sharesHeld
        };
        window.snapshotService.saveSnapshot(this.currentAttemptId, this.currentWeek, metrics);
      }

      // Update current_week on attempt record in Supabase
      if (window.attemptService && this.currentAttemptId) {
        window.attemptService.updateAttemptState(this.currentAttemptId, { currentWeek: this.currentWeek });
      }
    }

    // Update Live Stock Price Display
    const priceEl = document.getElementById('liveStockPrice');
    const changeEl = document.getElementById('liveStockChange');

    if (priceEl) priceEl.innerText = `$${stock.price.toFixed(2)}`;

    const changePct = (((stock.price - stock.startingPrice) / stock.startingPrice) * 100).toFixed(2);
    if (changeEl) {
      changeEl.innerText = `${changePct >= 0 ? '+' : ''}${changePct}%`;
      changeEl.className = `stat-value ${changePct >= 0 ? 'up' : 'down'}`;
    }

    this.updateCostPreview();
    this.updatePortfolioUI();

    // Render Canvas Candlestick Chart
    if (this.chart && candles.length > 0) {
      this.chart.setData(candles);
    }

    // Send Heartbeat to Instructor Backend and Sync Supabase attempt balance every 10 seconds
    if (remainingSeconds % 10 === 0) {
      this.syncAttemptBalanceToSupabase();
      this.sendHeartbeatToBackend();
    }
  }

  onMarketEvent(evt) {
    const feed = document.getElementById('marketEventFeed');
    if (!feed) return;

    const card = document.createElement('div');
    card.className = 'news-card';
    card.style.borderLeft = '3px solid var(--blue)';
    card.innerHTML = `
      <div>
        <div class="news-title">⚡ [MARKET ANNOUNCEMENT] ${evt.title}</div>
        <div style="font-size:11px; margin-top:2px; color:var(--text-main);">${evt.headline}</div>
        <div class="news-meta" style="margin-top:4px;">${evt.description}</div>
      </div>
      <span class="indicator-pill active">ANNOUNCEMENT</span>
    `;

    feed.prepend(card);
    if (window.soundEngine) window.soundEngine.playChime();
  }

  async executeTrade(isBuy) {
    if (this.isProcessingTrade) return;

    const currentPrice = this.sim.stock.price;
    const qtyInput = document.getElementById('tradeQtyInput');
    const shares = parseInt(qtyInput?.value, 10);

    if (!shares || shares <= 0) {
      alert('Please enter a valid number of shares.');
      return;
    }

    const totalCost = shares * currentPrice;

    // Validate Trade against cash / shares limits
    if (isBuy && totalCost > this.cash) {
      alert('Insufficient cash balance to buy these shares!');
      return;
    }

    if (!isBuy && shares > this.sharesHeld) {
      alert(`You only own ${this.sharesHeld} shares!`);
      return;
    }

    // Prevent double clicking by disabling execution controls
    this.isProcessingTrade = true;
    this.setTradeButtonsDisabled(true);

    // Save previous state for rollback if needed
    const prevCash = this.cash;
    const prevShares = this.sharesHeld;
    const prevAvgPrice = this.avgBuyPrice;
    const prevRealizedPnL = this.realizedPnL;

    // Mutate state locally for immediate UX
    if (isBuy) {
      const newTotalShares = this.sharesHeld + shares;
      const newTotalCost = (this.sharesHeld * this.avgBuyPrice) + totalCost;
      this.avgBuyPrice = newTotalCost / newTotalShares;
      this.sharesHeld = newTotalShares;
      this.cash -= totalCost;
    } else {
      const pnl = (currentPrice - this.avgBuyPrice) * shares;
      this.realizedPnL += pnl;
      this.sharesHeld -= shares;
      if (this.sharesHeld === 0) this.avgBuyPrice = 0;
      this.cash += totalCost;
    }

    const updatedBalances = {
      cashBalance: this.cash,
      holdingsValue: this.getTotalStockValue(),
      portfolioValue: this.getTotalEquity(),
      realisedPl: this.realizedPnL,
      unrealisedPl: this.getUnrealizedPnL()
    };

    const tradeDetails = {
      symbol: 'NCT',
      tradeType: isBuy ? 'BUY' : 'SELL',
      quantity: shares,
      price: currentPrice,
      totalValue: totalCost
    };

    // Save to Supabase
    let saveSuccess = true;
    if (window.tradeService && this.currentAttemptId && this.participantId) {
      const res = await window.tradeService.recordTrade(
        this.currentAttemptId,
        this.participantId,
        tradeDetails,
        updatedBalances
      );

      if (!res.success) {
        saveSuccess = false;
        console.error('Trade persistence failed:', res.error);
        alert('Database error recording trade. The transaction could not be recorded in Supabase.');

        // Rollback local state
        this.cash = prevCash;
        this.sharesHeld = prevShares;
        this.avgBuyPrice = prevAvgPrice;
        this.realizedPnL = prevRealizedPnL;
      }
    }

    if (saveSuccess) {
      if (window.soundEngine) window.soundEngine.playOrderFill(isBuy);

      // Impact supply/demand vector
      this.sim.registerUserTrade(shares, isBuy);

      const tradeItem = {
        time: new Date().toLocaleTimeString(),
        elapsed: `${Math.floor(this.sim.elapsedSeconds / 60)}m ${this.sim.elapsedSeconds % 60}s`,
        type: isBuy ? 'BUY' : 'SELL',
        shares,
        price: currentPrice,
        totalCost
      };

      this.tradeHistory.unshift(tradeItem);
      this.updatePortfolioUI();
      this.renderTradeHistoryTable();
      this.sendTradeToBackend(tradeItem);
    }

    this.isProcessingTrade = false;
    this.setTradeButtonsDisabled(false);
  }

  setTradeButtonsDisabled(disabled) {
    const btnBuy = document.getElementById('btnBuyShares');
    const btnSell = document.getElementById('btnSellShares');
    if (btnBuy) {
      btnBuy.disabled = disabled;
      btnBuy.style.opacity = disabled ? '0.6' : '1';
    }
    if (btnSell) {
      btnSell.disabled = disabled;
      btnSell.style.opacity = disabled ? '0.6' : '1';
    }
  }

  async syncAttemptBalanceToSupabase() {
    if (window.attemptService && this.currentAttemptId) {
      const stateData = {
        cashBalance: this.cash,
        holdingsValue: this.getTotalStockValue(),
        portfolioValue: this.getTotalEquity(),
        realisedPl: this.realizedPnL,
        unrealisedPl: this.getUnrealizedPnL(),
        currentWeek: this.currentWeek
      };
      await window.attemptService.updateAttemptState(this.currentAttemptId, stateData);
    }
  }

  sendHeartbeatToBackend() {
    const equity = this.getTotalEquity();
    const returnPct = (((equity - this.initialCash) / this.initialCash) * 100).toFixed(2);

    const payload = {
      userName: this.userName,
      userID: this.userID,
      cash: this.cash,
      sharesHeld: this.sharesHeld,
      equity,
      totalPnL: equity - this.initialCash,
      returnPct
    };

    fetch('/api/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(err => console.warn('Heartbeat error:', err));
  }

  sendTradeToBackend(tradeItem) {
    const payload = {
      userName: this.userName,
      userID: this.userID,
      ...tradeItem
    };

    fetch('/api/trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(err => console.warn('Trade log error:', err));
  }

  getTotalStockValue() {
    return this.sharesHeld * this.sim.stock.price;
  }

  getUnrealizedPnL() {
    if (this.sharesHeld === 0) return 0;
    return (this.sim.stock.price - this.avgBuyPrice) * this.sharesHeld;
  }

  getTotalEquity() {
    return this.cash + this.getTotalStockValue();
  }

  updateCostPreview() {
    const qtyInput = document.getElementById('tradeQtyInput');
    const shares = parseInt(qtyInput?.value, 10) || 0;
    const totalCost = shares * this.sim.stock.price;

    const costEl = document.getElementById('tradeCostPreview');
    if (costEl) {
      costEl.innerText = `$${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    }
  }

  updatePortfolioUI() {
    const stockVal = this.getTotalStockValue();
    const equity = this.getTotalEquity();
    const totalPnL = equity - this.initialCash;
    const returnPct = ((totalPnL / this.initialCash) * 100).toFixed(2);

    document.getElementById('valCash').innerText = `$${this.cash.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    document.getElementById('valShares').innerText = `${this.sharesHeld} shares`;
    document.getElementById('valAvgPrice').innerText = this.sharesHeld > 0 ? `$${this.avgBuyPrice.toFixed(2)}` : '-';
    document.getElementById('valStockVal').innerText = `$${stockVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    document.getElementById('valEquity').innerText = `$${equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    const pnlEl = document.getElementById('valTotalPnL');
    if (pnlEl) {
      pnlEl.innerText = `${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)} (${returnPct}%)`;
      pnlEl.className = `stat-value ${totalPnL >= 0 ? 'up' : 'down'}`;
    }
  }

  renderTradeHistoryTable() {
    const tbody = document.getElementById('tradeHistoryTableBody');
    if (!tbody) return;

    if (this.tradeHistory.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">No trades executed yet.</td></tr>`;
      return;
    }

    let html = '';
    this.tradeHistory.forEach(t => {
      html += `
        <tr>
          <td>${t.time} (${t.elapsed})</td>
          <td style="color:${t.type === 'BUY' ? 'var(--green)' : 'var(--red)'}; font-weight:700;">${t.type}</td>
          <td>${t.shares} shares</td>
          <td>$${t.price.toFixed(2)}</td>
          <td>$${t.totalCost.toFixed(2)}</td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  async onSimulationComplete() {
    if (window.soundEngine) window.soundEngine.playAlert(false);

    const totalEquity = this.getTotalEquity();
    const totalPnL = totalEquity - this.initialCash;
    const returnPct = ((totalPnL / this.initialCash) * 100).toFixed(2);

    document.getElementById('rptTraderName').innerText = this.userName;
    document.getElementById('rptTraderID').innerText = this.userID;
    document.getElementById('rptFinalEquity').innerText = `$${totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    document.getElementById('rptTotalReturn').innerText = `${totalPnL >= 0 ? '+' : ''}${returnPct}%`;
    document.getElementById('rptTotalReturn').className = `stat-value ${totalPnL >= 0 ? 'up' : 'down'}`;

    const reportModal = document.getElementById('reportModal');
    if (reportModal) reportModal.classList.remove('hidden');

    // Mark attempt as completed in Supabase
    if (window.attemptService && this.currentAttemptId) {
      const finalMetrics = {
        cashBalance: this.cash,
        holdingsValue: this.getTotalStockValue(),
        portfolioValue: totalEquity,
        realisedPl: this.realizedPnL,
        unrealisedPl: this.getUnrealizedPnL(),
        finalReturnPercent: parseFloat(returnPct)
      };
      await window.attemptService.completeAttempt(this.currentAttemptId, finalMetrics);
    }

    this.sendHeartbeatToBackend();
  }

  async restartSimulation() {
    // Create a NEW simulation attempt record in Supabase
    if (window.attemptService && this.participantId) {
      const { data: newAttempt } = await window.attemptService.createAttempt(this.participantId);
      if (newAttempt) {
        this.currentAttemptId = newAttempt.id;
        localStorage.setItem('trader_attempt_id', newAttempt.id);
      }
    }

    this.sim.reset();
    this.cash = 100000;
    this.sharesHeld = 0;
    this.avgBuyPrice = 0;
    this.realizedPnL = 0;
    this.currentWeek = 1;
    this.tradeHistory = [];

    const reportModal = document.getElementById('reportModal');
    if (reportModal) reportModal.classList.add('hidden');

    this.sim.start();
    this.updatePortfolioUI();
    this.renderTradeHistoryTable();
  }

  exportReportCSV() {
    let csv = `15-Minute Live Single-Stock Trading Simulator Performance Report\n`;
    csv += `Trader Name,${this.userName}\n`;
    csv += `ID Number,${this.userID}\n`;
    csv += `Stock Traded,${this.sim.stock.symbol} (${this.sim.stock.name})\n`;
    csv += `Final Equity,$${this.getTotalEquity().toFixed(2)}\n`;
    csv += `Total Return %,${((this.getTotalEquity() - 100000) / 1000).toFixed(2)}%\n\n`;

    csv += `Trade Execution Log:\n`;
    csv += `Time,SimElapsed,Type,Shares,ExecutionPrice,TotalCost\n`;
    this.tradeHistory.forEach(t => {
      csv += `${t.time},${t.elapsed},${t.type},${t.shares},${t.price},${t.totalCost}\n`;
    });

    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csv);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `trading_15m_report_${this.userID}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new Live15MinTradingApp();
});
