import { Request, Response, NextFunction } from 'express';
import { supabase } from '../services/db';

export async function auth(req: Request, res: Response, next: NextFunction) {
  const token = req.header('x-auth-token');
  if (!token) return res.status(401).json({ error: 'missing token' });

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_token', token)
    .single();

  if (error || !data) return res.status(401).json({ error: 'invalid token' });
  (req as any).userId = data.id;
  next();
}
