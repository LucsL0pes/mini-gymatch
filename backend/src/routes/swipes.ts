import { Router } from 'express';
import { supabase } from '../services/db';
import { auth } from '../middleware/auth';
import { createMatchIfMutual } from '../services/match';

const r = Router();
r.use(auth);

r.post('/', async (req, res) => {
  const me = (req as any).userId as string;
  const { to_user, decision } = req.body || {};
  if (!to_user || !['like', 'pass'].includes(decision)) {
    return res.status(400).json({ error: 'bad payload' });
  }

  const { error } = await supabase.from('swipes').insert([{ from_user: me, to_user, decision }]);
  if (error) return res.status(400).json({ error: error.message });

  let match = null;
  if (decision === 'like') match = await createMatchIfMutual(me, to_user);

  res.json({ ok: true, match });
});

export default r;
