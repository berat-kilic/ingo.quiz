import express from 'express';
import bodyParser from 'body-parser';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const loadDotEnv = () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
};

loadDotEnv();

const SUPABASE_URL = process.env.SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const app = express();
app.use(bodyParser.json());
app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  const allowList = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const allowAny = allowList.includes('*');
  const allowedOrigin = allowAny ? '*' : (allowList.includes(origin) ? origin : allowList[0]);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

const removeUserFromRooms = async (userId: string) => {
  const { data: rooms } = await supabaseAdmin.from('rooms').select('id, players');
  if (!rooms) return;

  for (const r of rooms as any[]) {
    if (Array.isArray(r.players) && r.players.some((p: any) => p.id === userId)) {
      const newPlayers = r.players.filter((p: any) => p.id !== userId);
      await supabaseAdmin.from('rooms').update({ players: newPlayers }).eq('id', r.id);
    }
  }
};

const hardDeleteUser = async (userId: string) => {
  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (authDeleteError) {
    throw new Error('Auth user delete failed: ' + authDeleteError.message);
  }

  await supabaseAdmin.from('profiles').delete().eq('id', userId);
  await removeUserFromRooms(userId);
};


app.post('/ban', async (req, res) => {
  const { userId, ban } = req.body as { userId: string; ban?: boolean };
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const isBanned = ban === undefined ? true : !!ban;

  try {
    if (!isBanned) {
      await hardDeleteUser(userId);
      return res.json({ ok: true, deleted: true });
    }

    const { error: rpcError } = await supabaseAdmin.rpc('admin_ban_user', {
      target_id: userId,
      is_banned: isBanned
    });

    if (rpcError) {
      console.warn('admin_ban_user rpc error, falling back to manual operations:', rpcError.message);
      await supabaseAdmin.from('profiles').update({ banned: isBanned }).eq('id', userId);

      try {
        await supabaseAdmin.from('auth.sessions').delete().eq('user_id', userId);
      } catch {
        
      }
      try {
        await supabaseAdmin.from('auth.refresh_tokens').delete().eq('user_id', userId);
      } catch {
        
      }
      await removeUserFromRooms(userId);
    }

    return res.json({ ok: true, banned: true });
  } catch (error: any) {
    console.error('Ban/Delete operation failed', error);
    return res.status(500).json({ error: error.message || String(error) });
  }
});


app.post('/delete-self', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) return res.status(401).json({ error: 'Missing bearer token' });

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    await hardDeleteUser(data.user.id);
    return res.json({ ok: true, deleted: true });
  } catch (error: any) {
    console.error('Self delete failed', error);
    return res.status(500).json({ error: error.message || String(error) });
  }
});

const port = process.env.PORT ? Number(process.env.PORT) : 8787;
app.listen(port, () => console.log(`Admin ban server listening on http://localhost:${port}`));

export default app;
