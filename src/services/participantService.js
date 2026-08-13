/**
 * Participant Management Service
 * Handles finding or registering simulator participants in Supabase.
 */
class ParticipantService {
  /**
   * Find existing participant by participant_code or create a new participant.
   * @param {string} name - Participant full name
   * @param {string} participantCode - Participant code / ID number
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async findOrCreateParticipant(name, participantCode) {
    const supabase = window.getSupabase();
    if (!supabase) {
      return { data: null, error: new Error('Supabase client not initialized') };
    }

    try {
      const cleanCode = participantCode.trim();
      const cleanName = name.trim();

      // 1. Look up existing participant
      const { data: existing, error: selectError } = await supabase
        .from('participants')
        .select('*')
        .eq('participant_code', cleanCode)
        .maybeSingle();

      if (selectError) {
        console.error('Error fetching participant:', selectError);
        return { data: null, error: selectError };
      }

      if (existing) {
        // Update last_active_at timestamp
        const { data: updated, error: updateError } = await supabase
          .from('participants')
          .update({ last_active_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select()
          .single();

        return { data: updated || existing, error: updateError };
      }

      // 2. Create new participant if not found
      const { data: created, error: insertError } = await supabase
        .from('participants')
        .insert([{
          name: cleanName,
          participant_code: cleanCode
        }])
        .select()
        .single();

      if (insertError) {
        console.error('Error creating participant:', insertError);
        return { data: null, error: insertError };
      }

      return { data: created, error: null };
    } catch (err) {
      console.error('ParticipantService exception:', err);
      return { data: null, error: err };
    }
  }
}

window.participantService = new ParticipantService();
