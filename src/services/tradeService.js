/**
 * Trade Execution Service
 * Records BUY and SELL transactions in Supabase and syncs updated attempt balances.
 */
class TradeService {
  /**
   * Insert a trade record and update the attempt balances in Supabase.
   * @param {string} attemptId - UUID of active attempt
   * @param {string} participantId - UUID of participant
   * @param {object} tradeDetails - { symbol, tradeType, quantity, price, totalValue }
   * @param {object} updatedBalances - { cashBalance, holdingsValue, portfolioValue, realisedPl, unrealisedPl }
   * @returns {Promise<{success: boolean, trade: object|null, error: object|null}>}
   */
  async recordTrade(attemptId, participantId, tradeDetails, updatedBalances) {
    const supabase = window.getSupabase();
    if (!supabase || !attemptId || !participantId) {
      return { success: false, trade: null, error: new Error('Required IDs missing') };
    }

    try {
      const tradePayload = {
        attempt_id: attemptId,
        participant_id: participantId,
        symbol: tradeDetails.symbol || 'NCT',
        trade_type: tradeDetails.tradeType, // 'BUY' or 'SELL'
        quantity: tradeDetails.quantity,
        price: tradeDetails.price,
        total_value: tradeDetails.totalValue
      };

      // 1. Insert trade record into Supabase
      const { data: tradeData, error: tradeError } = await supabase
        .from('trades')
        .insert([tradePayload])
        .select()
        .single();

      if (tradeError) {
        console.error('Failed to record trade in Supabase:', tradeError);
        return { success: false, trade: null, error: tradeError };
      }

      // 2. Update attempt's current cash balance and portfolio metrics
      if (updatedBalances) {
        const attemptUpdatePayload = {
          cash_balance: updatedBalances.cashBalance,
          holdings_value: updatedBalances.holdingsValue,
          portfolio_value: updatedBalances.portfolioValue,
          realised_pl: updatedBalances.realisedPl,
          unrealised_pl: updatedBalances.unrealisedPl
        };

        const { error: attemptError } = await supabase
          .from('attempts')
          .update(attemptUpdatePayload)
          .eq('id', attemptId);

        if (attemptError) {
          console.warn('Trade saved, but updating attempt balance logged warning:', attemptError);
        }
      }

      return { success: true, trade: tradeData, error: null };
    } catch (err) {
      console.error('TradeService recordTrade exception:', err);
      return { success: false, trade: null, error: err };
    }
  }

  /**
   * Fetch all trades for an attempt.
   * @param {string} attemptId 
   */
  async getTradesForAttempt(attemptId) {
    const supabase = window.getSupabase();
    if (!supabase || !attemptId) return [];

    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('attempt_id', attemptId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching trade history:', error);
      return [];
    }

    return data || [];
  }
}

window.tradeService = new TradeService();
