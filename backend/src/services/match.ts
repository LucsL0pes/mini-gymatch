import { supabase } from './db';

export async function createMatchIfMutual(from: string, to: string) {
  const rec = await supabase
    .from('swipes')
    .select('id')
    .eq('from_user', to)
    .eq('to_user', from)
    .eq('decision', 'like')
    .maybeSingle();

  if (!rec.data) return null;

  const [a, b] = [from, to].sort();
  const ins = await supabase
    .from('matches')
    .insert([{ user_a: a, user_b: b }])
    .select('*')
    .single();

  return ins.data || null;
}
