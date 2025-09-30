import { Router } from 'express';
import { supabase } from '../services/db';
import { randomUUID } from 'crypto';
import { auth } from '../middleware/auth';

const r = Router();

r.post('/onboard', async (req, res) => {
  const { email, name, birthdate, gender, show_me, bio, interests, photo_url } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });

  const token = randomUUID();
  const { data, error } = await supabase
    .from('profiles')
    .insert([{ auth_token: token, email, name, birthdate, gender, show_me, bio, interests, photo_url }])
    .select('*')
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ token, profile: data });
});

r.get('/me', auth, async (req, res) => {
  const me = (req as any).userId as string;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, gender, show_me, bio, interests, photo_url, created_at')
    .eq('id', me)
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default r;
