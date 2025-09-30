import { Router } from 'express';
import { supabase } from '../services/db';
import { auth } from '../middleware/auth';

const r = Router();
r.use(auth);

r.get('/', async (req, res) => {
  const me = (req as any).userId as string;

  const meResp = await supabase.from('profiles').select('gender, show_me').eq('id', me).single();
  if (meResp.error || !meResp.data) return res.status(400).json({ error: 'me not found' });

  const pref = meResp.data.show_me;
  const genderFilter = pref === 'everyone' ? undefined : pref;

  // ids já avaliados
  const sw = await supabase.from('swipes').select('to_user').eq('from_user', me);
  const excluded = new Set([me, ...(sw.data || []).map(s => s.to_user as string)]);

  let q = supabase
    .from('profiles')
    .select('id, email, name, birthdate, gender, show_me, bio, interests, photo_url, created_at')
    .neq('id', me)
    .limit(50);

  if (genderFilter) q = q.eq('gender', genderFilter);

  const { data, error } = await q;
  if (error) return res.status(400).json({ error: error.message });

  res.json((data || []).filter(u => !excluded.has(u.id)).slice(0, 20));
});

export default r;
