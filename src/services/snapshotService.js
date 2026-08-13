/**
 * Weekly Snapshot Service
 * Records periodic/weekly portfolio state snapshots in Supabase for progress tracking and auditing.
 */
class SnapshotService {
  /**
   * Save a weekly portfolio snapshot for an active attempt.
   * @param {string} attemptId - UUID of active attempt
   * @param {number} week - Current week number (1-12)
   * @param {object} metrics - { cashBalance, holdingsValue, portfolioValue, realisedPl, unrealisedPl, stockPrice, sharesHeld }
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async saveSnapshot(attemptId, week, metrics) {
    const supabase = window.getSupabase();
    if (!supabase || !attemptId) {
      return { data: null, error: new Error('Supabase client or attemptId missing') };
    }

    try {
      const payload = {
        attempt_id: attemptId,
        week: Math.min(Math.max(1, week), 12),
        cash_balance: metrics.cashBalance,
        holdings_value: metrics.holdingsValue,
        portfolio_value: metrics.portfolioValue,
        realised_pl: metrics.realisedPl,
        unrealised_pl: metrics.unrealisedPl,
        stock_price: metrics.stockPrice,
        shares_held: metrics.sharesHeld
      };

      const { data, error } = await supabase
        .from('weekly_snapshots')
        .upsert([payload], { onConflict: 'attempt_id, week' })
        .select()
        .single();

      if (error) {
        console.error('Error saving weekly snapshot:', error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (err) {
      console.error('SnapshotService saveSnapshot exception:', err);
      return { data: null, error: err };
    }
  }

  /**
   * Fetch snapshots for an attempt.
   * @param {string} attemptId 
   */
  async getSnapshotsForAttempt(attemptId) {
    const supabase = window.getSupabase();
    if (!supabase || !attemptId) return [];

    const { data, error } = await supabase
      .from('weekly_snapshots')
      .select('*')
      .eq('attempt_id', attemptId)
      .order('week', { ascending: true });

    if (error) {
      console.error('Error fetching snapshots:', error);
      return [];
    }

    return data || [];
  }
}

window.snapshotService = new SnapshotService();
