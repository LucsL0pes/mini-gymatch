import { Request, Response, NextFunction } from 'express';
import { supabase } from '../services/db';

export async function auth(req: Request, res: Response, next: NextFunction) {
  const token = req.header('x-auth-token');
  if (!token) return res.status(401).json({ error: 'unauthorized', detail: 'missing token' });

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_token', token)
    .single();

  if (error || !data) return res.status(401).json({ error: 'unauthorized', detail: 'invalid token' });

  // Mantemos a propriedade `userId` para rotas existentes e também expomos
  // `user.id` para compatibilidade com handlers que esperam essa estrutura.
  (req as any).userId = data.id;
  (req as any).user = { id: data.id };
  next();
}
