/**
 * Simulation Attempt Service
 * Manages creation, state persistence, weekly progression, and completion of simulation attempts.
 */
class AttemptService {
  /**
   * Create a new simulation attempt for a participant.
   * Every new attempt starts with $100,000 cash balance.
   * @param {string} participantId - UUID of the participant
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async createAttempt(participantId) {
    const supabase = window.getSupabase();
    if (!supabase) {
      return { data: null, error: new Error('Supabase client not initialized') };
    }

    try {
      const payload = {
        participant_id: participantId,
        current_week: 1,
        starting_cash: 100000.00,
        cash_balance: 100000.00,
        holdings_value: 0.00,
        portfolio_value: 100000.00,
        realised_pl: 0.00,
        unrealised_pl: 0.00,
        status: 'in_progress',
        started_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('attempts')
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error('Error creating new attempt:', error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (err) {
      console.error('AttemptService createAttempt exception:', err);
      return { data: null, error: err };
    }
  }

  /**
   * Update current attempt state (balances, P&L, current_week).
   * @param {string} attemptId - UUID of attempt
   * @param {object} stateData - Updated financial metrics
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async updateAttemptState(attemptId, stateData) {
    const supabase = window.getSupabase();
    if (!supabase || !attemptId) {
      return { data: null, error: new Error('Supabase client or attemptId missing') };
    }

    try {
      const payload = {};
      if (stateData.currentWeek !== undefined) payload.current_week = stateData.currentWeek;
      if (stateData.cashBalance !== undefined) payload.cash_balance = stateData.cashBalance;
      if (stateData.holdingsValue !== undefined) payload.holdings_value = stateData.holdingsValue;
      if (stateData.portfolioValue !== undefined) payload.portfolio_value = stateData.portfolioValue;
      if (stateData.realisedPl !== undefined) payload.realised_pl = stateData.realisedPl;
      if (stateData.unrealisedPl !== undefined) payload.unrealised_pl = stateData.unrealisedPl;

      const { data, error } = await supabase
        .from('attempts')
        .update(payload)
        .eq('id', attemptId)
        .select()
        .single();

      if (error) {
        console.error('Error updating attempt state:', error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (err) {
      console.error('AttemptService updateAttemptState exception:', err);
      return { data: null, error: err };
    }
  }

  /**
   * Complete simulation attempt with final equity metrics and timestamp.
   * @param {string} attemptId - UUID of attempt
   * @param {object} finalMetrics - Final performance metrics
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async completeAttempt(attemptId, finalMetrics) {
    const supabase = window.getSupabase();
    if (!supabase || !attemptId) {
      return { data: null, error: new Error('Supabase client or attemptId missing') };
    }

    try {
      const payload = {
        status: 'completed',
        completed_at: new Date().toISOString(),
        cash_balance: finalMetrics.cashBalance,
        holdings_value: finalMetrics.holdingsValue,
        portfolio_value: finalMetrics.portfolioValue,
        realised_pl: finalMetrics.realisedPl,
        unrealised_pl: finalMetrics.unrealisedPl,
        final_return_percent: finalMetrics.finalReturnPercent
      };

      const { data, error } = await supabase
        .from('attempts')
        .update(payload)
        .eq('id', attemptId)
        .select()
        .single();

      if (error) {
        console.error('Error completing attempt:', error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (err) {
      console.error('AttemptService completeAttempt exception:', err);
      return { data: null, error: err };
    }
  }

  /**
   * Fetch an attempt by ID
   * @param {string} attemptId 
   */
  async getAttempt(attemptId) {
    const supabase = window.getSupabase();
    if (!supabase || !attemptId) return null;

    const { data } = await supabase
      .from('attempts')
      .select('*')
      .eq('id', attemptId)
      .maybeSingle();

    return data;
  }
}

window.attemptService = new AttemptService();
