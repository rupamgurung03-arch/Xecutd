type Env = {
  GEMINI_API_KEY?: string;
  FINANCE_CALENDAR_API_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};
type PagesContext = { request: Request; env: Env };

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

const asText = (value: unknown, fallback = 'Not provided') => String(value ?? fallback);

async function verifyAccountSession(request: Request, env: Env): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return { ok: false, status: 401, error: 'Sign in to use this feature.' };
  if (!url || !key) return { ok: false, status: 503, error: 'Supabase verification is not configured for this deployment.' };
  try {
    const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: authorization } });
    return response.ok
      ? { ok: true as const }
      : { ok: false as const, status: 401, error: 'Your session has expired. Sign in again.' };
  } catch {
    return { ok: false as const, status: 503, error: 'Could not verify your Supabase session.' };
  }
}

async function callGemini(apiKey: string, prompt: string, systemInstruction: string, useSearch = false) {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      ...(useSearch ? { tools: [{ google_search: {} }] } : {}),
    }),
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; groundingMetadata?: { groundingChunks?: Array<{ web?: { title?: string; uri?: string } }> } }>;
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(payload.error?.message || `Gemini request failed (${response.status})`);
  const candidate = payload.candidates?.[0];
  return {
    text: candidate?.content?.parts?.map((part) => part.text || '').join('\n').trim() || '',
    sources: (candidate?.groundingMetadata?.groundingChunks || [])
      .filter((chunk) => chunk.web?.uri)
      .map((chunk) => ({ title: chunk.web?.title || chunk.web?.uri, uri: chunk.web?.uri })),
  };
}

function heuristicAudit(stats: Record<string, unknown> = {}, mistakes: unknown[] = [], setups: unknown[] = []) {
  const count = Number(stats.totalTrades || 0);
  const winRate = Number(stats.winRate || 0);
  const pnl = Number(stats.netPnL || 0);
  const compliance = Number(stats.rulesCompliance || 0);
  const leaks = mistakes.slice(0, 3).map((item) => typeof item === 'string' ? item : JSON.stringify(item)).join(', ') || 'No repeated mistake tags yet';
  const setupNames = setups.slice(0, 3).map((item) => typeof item === 'string' ? item : JSON.stringify(item)).join(', ') || 'No dominant setup yet';
  return `### Quick journal read\n\nYou have logged **${count} trades** with a **${winRate}% win rate** and **${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} net P&L**. ${count < 20 ? 'Treat this as an early signal; build a larger sample before changing a strategy.' : pnl >= 0 ? 'Your results are positive so far. Keep risk consistent while you validate the edge.' : 'Your results are negative so far. Reduce risk and review the process before taking more trades.'}\n\n- **Plan adherence:** ${compliance}%\n- **Most visible leaks:** ${leaks}\n- **Setups to review:** ${setupNames}\n\n**Next step:** Review your last five trades and write one specific adjustment before your next session.`;
}

function heuristicTradeReview(trade: Record<string, unknown>) {
  const pnl = Number(trade.pnl || 0);
  const followedPlan = Boolean(trade.rulesFollowed);
  const grade = followedPlan ? (pnl >= 0 ? 'A' : 'B') : (pnl >= 0 ? 'C' : 'F');
  return `### Execution grade: ${grade}\n\nThis ${asText(trade.side).toLowerCase()} ${asText(trade.symbol)} trade closed at **${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}**. ${followedPlan ? 'You recorded that you followed your plan; keep judging the decision by process as well as outcome.' : 'You recorded a plan deviation. Identify the exact point where execution changed.'}\n\n- **Risk and management:** Check that the initial risk and exit matched the setup rules.\n- **Behavior:** ${asText(trade.emotion, 'No emotion was recorded')}.\n- **Playbook takeaway:** Write one concrete rule you can apply to the next similar setup.`;
}

function heuristicChat(message: string, context: Record<string, unknown> = {}) {
  return `Based on the journal context, you have ${Number(context.totalTrades || 0)} logged trades, a ${Number(context.winRate || 0)}% win rate, and net P&L of $${Number(context.netPnL || 0).toFixed(2)}. For “${message.slice(0, 240)}”, start by checking your sample size, risk consistency, and whether the trade followed a documented setup. I can give a more specific review when you include the trade or setup you mean.`;
}

export async function onRequest({ request, env }: PagesContext) {
  const url = new URL(request.url);

  if (request.method === 'GET' && url.pathname === '/api/economic-calendar') {
    const auth = await verifyAccountSession(request, env);
    if (!auth.ok) return json({ error: auth.error, events: [] }, auth.status);
    const apiKey = env.FINANCE_CALENDAR_API_KEY;
    if (!apiKey) return json({ configured: false, events: [] }, 503);
    try {
      const params = new URLSearchParams({ country: 'US,GB,EU,DE,JP,CA,AU,CN,CH,NZ,NO,SE,IN,HK', impact: 'high,medium', limit: '100', tz: 'UTC' });
      const response = await fetch(`https://www.financecalendar.com/wp-json/fc/v1/calendar?${params}`, {
        headers: { 'X-API-Key': apiKey },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return json({ configured: true, events: [], error: 'Calendar feed unavailable' }, 502);
      const payload = await response.json() as { events?: unknown[] };
      return json({ configured: true, events: Array.isArray(payload.events) ? payload.events : [], fetchedAt: Date.now() });
    } catch {
      return json({ configured: true, events: [], error: 'Calendar feed unavailable' }, 502);
    }
  }

  if (request.method !== 'POST' || !url.pathname.startsWith('/api/coach/')) return json({ error: 'Not found' }, 404);
  const auth = await verifyAccountSession(request, env);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  let body: Record<string, any>;
  try {
    body = await request.json() as Record<string, any>;
  } catch {
    return json({ error: 'Invalid JSON request body' }, 400);
  }

  const apiKey = env.GEMINI_API_KEY;
  try {
    if (url.pathname === '/api/coach/analyze') {
      const { stats = {}, tradesSummary = [], topMistakes = [], topSetups = [] } = body;
      if (!apiKey) return json({ analysis: heuristicAudit(stats, topMistakes, topSetups), mode: 'edge-engine', quotaExceeded: false });
      const prompt = `Review this trader's journal and give concise, direct feedback.\nStats: ${JSON.stringify(stats)}\nTop setups: ${JSON.stringify(topSetups)}\nMistakes: ${JSON.stringify(topMistakes)}\nRecent trades: ${JSON.stringify(tradesSummary)}\nGive four short sections: performance read, main leak, psychology/process pattern, and one action for the next 20 trades.`;
      const result = await callGemini(apiKey, prompt, 'You are a practical trading performance coach. Be concise, specific to the supplied journal data, and avoid overstating conclusions from small samples.');
      return result.text ? json({ analysis: result.text, mode: 'gemini', quotaExceeded: false }) : json({ analysis: heuristicAudit(stats, topMistakes, topSetups), mode: 'edge-engine', quotaExceeded: false });
    }

    if (url.pathname === '/api/coach/trade-review') {
      const trade = body.trade as Record<string, unknown> | undefined;
      if (!trade) return json({ error: 'Trade data required' }, 400);
      if (!apiKey) return json({ review: heuristicTradeReview(trade), mode: 'edge-engine', quotaExceeded: false });
      const prompt = `Review this trade post-mortem. Trade: ${JSON.stringify(trade)}. Respond concisely with an execution grade, risk/management critique, behavioral insight, and one playbook takeaway.`;
      const result = await callGemini(apiKey, prompt, 'You are a candid, practical trading performance coach. Distinguish a good process from a lucky outcome.');
      return result.text ? json({ review: result.text, mode: 'gemini', quotaExceeded: false }) : json({ review: heuristicTradeReview(trade), mode: 'edge-engine', quotaExceeded: false });
    }

    if (url.pathname === '/api/coach/chat') {
      const message = asText(body.message, '').trim();
      if (!message) return json({ error: 'Message required' }, 400);
      const journalContext = body.journalContext || {};
      const trades = Array.isArray(body.trades) ? body.trades : [];
      if (!apiKey) return json({ reply: heuristicChat(message, journalContext), mode: 'edge-engine', sources: [], quotaExceeded: false });
      const prompt = `Trader journal summary: ${JSON.stringify(journalContext)}\nRecent trades: ${JSON.stringify(trades.slice(-10))}\nTrader asks: ${message}\nAnswer directly and practically. Use the journal figures when relevant; avoid asserting live market facts unless grounded in search.`;
      const result = await callGemini(apiKey, prompt, 'You are a thoughtful trading buddy. Be concise, supportive, objective, and specific to the supplied journal.', true);
      return result.text ? json({ reply: result.text, mode: 'gemini', sources: result.sources, quotaExceeded: false }) : json({ reply: heuristicChat(message, journalContext), mode: 'edge-engine', sources: [], quotaExceeded: false });
    }

    return json({ error: 'Not found' }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const quotaExceeded = /429|quota|resource_exhausted/i.test(message);
    if (url.pathname === '/api/coach/analyze') return json({ analysis: heuristicAudit(body.stats, body.topMistakes, body.topSetups), mode: 'edge-engine', quotaExceeded });
    if (url.pathname === '/api/coach/trade-review') return json({ review: heuristicTradeReview(body.trade || {}), mode: 'edge-engine', quotaExceeded });
    return json({ reply: heuristicChat(asText(body.message, ''), body.journalContext), mode: 'edge-engine', sources: [], quotaExceeded });
  }
}
