type Account = { id: string; last_sign_in_at?: string };
type Dependencies = {
  enabled: boolean;
  projectMatches: boolean;
  allowedOrigins: string[];
  getUser: (token: string) => Promise<Account | null>;
  revokeSessions: (token: string) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  now?: () => number;
};

export function createDeleteAccountHandler(deps: Dependencies) {
  return async (request: Request) => {
    const origin = request.headers.get('origin') || '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    };
    if (deps.allowedOrigins.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
    const respond = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers });
    if (origin && !deps.allowedOrigins.includes(origin)) return respond(403, { error: 'ORIGIN_NOT_ALLOWED' });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (!['GET', 'POST'].includes(request.method)) return respond(405, { error: 'METHOD_NOT_ALLOWED' });
    if (!deps.projectMatches || !deps.enabled) return respond(503, { error: 'ACCOUNT_DELETION_UNAVAILABLE', enabled: false });
    const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') || '');
    if (!match) return respond(401, { error: 'LOGIN_REQUIRED' });
    try {
      const user = await deps.getUser(match[1]);
      if (!user) return respond(401, { error: 'LOGIN_REQUIRED' });
      if (request.method === 'GET') return respond(200, { enabled: true });
      const bodyText = await request.text();
      if (bodyText.length > 1024) return respond(400, { error: 'INVALID_CONFIRMATION' });
      let body;
      try { body = JSON.parse(bodyText); } catch { return respond(400, { error: 'INVALID_CONFIRMATION' }); }
      if (body?.confirmation !== 'DELETE_MY_ACCOUNT' || Object.keys(body).some(key => key !== 'confirmation')) return respond(400, { error: 'INVALID_CONFIRMATION' });
      const signedInAt = Date.parse(user.last_sign_in_at || '');
      const age = (deps.now?.() ?? Date.now()) - signedInAt;
      if (!Number.isFinite(age) || age < -60000 || age > 15 * 60000) return respond(401, { error: 'RECENT_LOGIN_REQUIRED' });
      await deps.revokeSessions(match[1]);
      // User id comes exclusively from the verified Auth service, never the body.
      // The database cascades this account's tickets atomically with user removal.
      await deps.deleteUser(user.id);
      return respond(200, { deleted: true });
    } catch { return respond(500, { error: 'ACCOUNT_DELETION_FAILED' }); }
  };
}
