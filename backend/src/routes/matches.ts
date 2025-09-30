import { Router } from 'express';
import { supabase } from '../services/db';
import { auth } from '../middleware/auth';

const r = Router();
r.use(auth);

r.get('/', async (req, res) => {
  const me = (req as any).userId as string;
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .or(`user_a.eq.${me},user_b.eq.${me}`)
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default r;
