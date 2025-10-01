import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { supabase } from './services/db';
import profiles from './routes/profiles';
import feed from './routes/feed';
import swipes from './routes/swipes';
import matches from './routes/matches';
import proofs from './routes/proofs';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health da API
app.get('/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Health do DB (Supabase)
app.get('/health/db', async (_req, res) => {
  const { data, error } = await supabase.from('profiles').select('id').limit(1);
  if (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
  res.json({ ok: true, rows: data?.length ?? 0 });
});

const port = Number(process.env.PORT || 3000);
app.use('/api/profiles', profiles);
app.use('/api/feed', feed);
app.use('/api/swipes', swipes);
app.use('/api/matches', matches);
app.use('/api/proofs', proofs);
app.listen(port, () => console.log(`API on http://localhost:${port}`));
