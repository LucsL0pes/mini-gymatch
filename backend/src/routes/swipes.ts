import { Router } from 'express';
import { supabase } from '../services/db';
import { auth } from '../middleware/auth';
import { createMatchIfMutual } from '../services/match';

const r = Router();
r.use(auth);

r.post('/', async (req, res) => {
  const me = (req as any).userId as string;
  const body = req.body || {};

  const toUser = typeof body.to_user === 'string' ? body.to_user.trim() : '';
  const decision = typeof body.decision === 'string' ? body.decision : '';

  const allowedDecisions = new Set(['like', 'pass']);
  const uuidRegex = /^[0-9a-fA-F-]{32,36}$/;

  if (!toUser || !uuidRegex.test(toUser)) {
    return res.status(400).json({ error: 'invalid to_user' });
  }

  if (!allowedDecisions.has(decision)) {
    return res.status(400).json({ error: 'decision must be like or pass' });
  }

  if (toUser === me) {
    return res.status(400).json({ error: 'cannot swipe on yourself' });
  }

  const { error } = await supabase.from('swipes').insert([{ from_user: me, to_user: toUser, decision }]);
  if (error) return res.status(400).json({ error: error.message });

  let match = null;
  if (decision === 'like') match = await createMatchIfMutual(me, toUser);

  res.json({ ok: true, match });
});

export default r;
