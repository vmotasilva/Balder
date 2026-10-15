import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { type LearningReport, parseReport } from '../utils/forsetiLearningReview';

/**
 * Relatórios diários de aprendizado da Forseti (tabela forseti_learning_reports, supabase/forseti_learning_reports.sql).
 * O app só lê para quem é GESTOR (supabase/forseti_learning_review.sql) e só altera a lista de frases tratadas.
 */

const TABLE = 'forseti_learning_reports';

export const ForsetiLearningService = {
  /** Os relatórios mais recentes primeiro. Lança um erro com a explicação em português quando não dá para ler. */
  async list(limit = 14): Promise<LearningReport[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase.from(TABLE).select('*').order('report_date', { ascending: false }).limit(limit);
    if (error) {
      const missing = error.code === '42P01' || error.code === 'PGRST205' || /does not exist|could not find the table/i.test(error.message || '');
      throw new Error(
        missing
          ? 'A tabela forseti_learning_reports não existe. Rode supabase/forseti_learning_reports.sql e supabase/forseti_learning_review.sql no Supabase.'
          : 'Não foi possível carregar os relatórios. O script supabase/forseti_learning_review.sql foi executado?'
      );
    }
    return (data || []).map(parseReport).filter((r): r is LearningReport => !!r);
  },

  async setHandled(date: string, phrases: string[]): Promise<void> {
    const { error } = await supabase.from(TABLE).update({ handled_phrases: phrases }).eq('report_date', date);
    if (error) throw new Error('Não foi possível salvar. O script supabase/forseti_learning_review.sql foi executado?');
  },
};
