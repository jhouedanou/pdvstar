/**
 * Re-export du client Supabase depuis services/supabase.js
 * Source unique de vérité pour tout le projet.
 *
 * Usage :
 *   import { supabase } from '../utils/supabase'
 *   // ou directement :
 *   import { supabase } from '../services/supabase'
 */
export { supabase } from '../services/supabase'
