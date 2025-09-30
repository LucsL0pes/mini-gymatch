import { Router } from 'express';
import { supabase } from '../services/db';
import { randomUUID } from 'crypto';
import { auth } from '../middleware/auth';

type OnboardPayload = {
  email?: string;
  name: string;
  birthdate?: string | null;
  gender: 'male' | 'female' | 'other';
  show_me: 'male' | 'female' | 'everyone';
  bio?: string | null;
  interests?: string[] | null;
  photo_url?: string | null;
};

function parseOnboardPayload(body: any): OnboardPayload {
  if (!body || typeof body !== 'object') {
    throw new Error('invalid payload');
  }

  const errors: string[] = [];

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length < 2) {
    errors.push('name must have at least 2 characters');
  }

  const emailRaw = typeof body.email === 'string' ? body.email.trim() : '';
  let email: string | undefined;
  if (emailRaw) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailRaw.toLowerCase())) {
      errors.push('email must be valid');
    } else {
      email = emailRaw.toLowerCase();
    }
  }

  const allowedGenders = new Set(['male', 'female', 'other']);
  const allowedShow = new Set(['male', 'female', 'everyone']);

  const gender = typeof body.gender === 'string' ? (body.gender as string) : '';
  if (!allowedGenders.has(gender)) {
    errors.push('gender must be one of male, female or other');
  }

  const showMe = typeof body.show_me === 'string' ? (body.show_me as string) : '';
  if (!allowedShow.has(showMe)) {
    errors.push('show_me must be one of male, female or everyone');
  }

  let birthdate: string | null | undefined = undefined;
  if (body.birthdate != null) {
    if (typeof body.birthdate !== 'string' || !body.birthdate.trim()) {
      errors.push('birthdate must be a string');
    } else {
      birthdate = body.birthdate.trim();
    }
  }

  let bio: string | null | undefined = undefined;
  if (body.bio != null) {
    if (typeof body.bio !== 'string') {
      errors.push('bio must be a string');
    } else if (body.bio.length > 500) {
      errors.push('bio must be at most 500 characters');
    } else {
      bio = body.bio;
    }
  }

  let interests: string[] | null | undefined = undefined;
  if (body.interests != null) {
    if (!Array.isArray(body.interests)) {
      errors.push('interests must be an array of strings');
    } else {
      const parsedInterests = body.interests.filter((item: any) => typeof item === 'string' && item.trim());
      interests = parsedInterests.length ? parsedInterests : null;
    }
  }

  let photoUrl: string | null | undefined = undefined;
  if (body.photo_url != null) {
    if (typeof body.photo_url !== 'string' || !body.photo_url.trim()) {
      errors.push('photo_url must be a string');
    } else {
      photoUrl = body.photo_url.trim();
    }
  }

  if (errors.length) {
    throw new Error(errors[0]);
  }

  return {
    email,
    name,
    birthdate: birthdate ?? null,
    gender: gender as OnboardPayload['gender'],
    show_me: showMe as OnboardPayload['show_me'],
    bio: bio ?? null,
    interests: interests ?? null,
    photo_url: photoUrl ?? null,
  };
}

const r = Router();

r.post('/onboard', async (req, res) => {
  let payload: OnboardPayload;
  try {
    payload = parseOnboardPayload(req.body);
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'invalid payload' });
  }

  const token = randomUUID();
  const { data, error } = await supabase
    .from('profiles')
    .insert([
      {
        auth_token: token,
        email: payload.email,
        name: payload.name,
        birthdate: payload.birthdate,
        gender: payload.gender,
        show_me: payload.show_me,
        bio: payload.bio,
        interests: payload.interests,
        photo_url: payload.photo_url,
      },
    ])
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
