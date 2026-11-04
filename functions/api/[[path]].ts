type Env = {
  AI?: { run: (model: string, input: Record<string, unknown>) => Promise<unknown> };
  GEMINI_API_KEY?: string;
  GROQ_API_KEY?: string;
  CEREBRAS_API_KEY?: string;
  SAMBANOVA_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  AI_PROVIDER_ORDER?: string;
  CLOUDFLARE_AI_MODEL?: string;
  GROQ_AI_MODEL?: string;
  CEREBRAS_AI_MODEL?: string;
  SAMBANOVA_AI_MODEL?: string;
  OPENROUTER_AI_MODEL?: string;
  GEMINI_AI_MODEL?: string;
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

type AiMessage = { role: 'system' | 'user'; content: string };
type ProviderResult = { text: string; provider: string; sources: { title: string; uri: string }[] };
type CompactTrade = {
  assetClass?: string; side?: string; setup?: string; timeframe?: string; durationMinutes?: number;
  realizedR?: number; maeR?: number; mfeR?: number; planFollowed?: boolean; emotion?: string; mistakeTags?: string[];
};

const boundedNumber = (value: unknown, min = -10000, max = 10000): number | undefined => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : undefined;
};

// Whitelist structured coaching features. Never forward IDs, symbols, dates, prices,
// quantity, free-text notes, account details, or screenshot/link URLs to a model.
function compactTrade(value: unknown): CompactTrade | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const trade = value as Record<string, any>;
  const allowedEmotions = ['Calm', 'Confident', 'Anxious', 'FOMO', 'Revenge', 'Greedy', 'Fearful', 'Bored'];
  return {
    assetClass: typeof trade.assetClass === 'string' ? trade.assetClass.slice(0, 20) : undefined,
    side: trade.side === 'Long' || trade.side === 'Short' ? trade.side : undefined,
    setup: typeof trade.setup === 'string' ? trade.setup.slice(0, 48) : undefined,
    timeframe: typeof trade.timeframe === 'string' ? trade.timeframe.slice(0, 16) : undefined,
    durationMinutes: boundedNumber(trade.durationMinutes ?? trade.duration_minutes, 0, 100000),
    realizedR: boundedNumber(trade.realizedR ?? trade.realized_r, -100, 100),
    maeR: boundedNumber(trade.maeR ?? trade.mae_r, -100, 100),
    mfeR: boundedNumber(trade.mfeR ?? trade.mfe_r, -100, 100),
    planFollowed: typeof trade.rulesFollowed === 'boolean' ? trade.rulesFollowed : typeof trade.planFollowed === 'boolean' ? trade.planFollowed : undefined,
    emotion: allowedEmotions.includes(trade.emotion) ? trade.emotion : undefined,
    mistakeTags: Array.isArray(trade.mistakes ?? trade.mistakeTags)
      ? (trade.mistakes ?? trade.mistakeTags).filter((tag: unknown): tag is string => typeof tag === 'string').slice(0, 3).map((tag: string) => tag.slice(0, 32))
      : undefined,
  };
}

function compactStats(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const stats = value as Record<string, unknown>;
  return {
    totalTrades: boundedNumber(stats.totalTrades, 0, 100000),
    closedTrades: boundedNumber(stats.closedTrades, 0, 100000),
    winRatePct: boundedNumber(stats.winRate ?? stats.winRatePct ?? stats.win_rate_pct, 0, 100),
    netPnL: boundedNumber(stats.netPnL ?? stats.total_pnl_usd),
    netRealizedR: boundedNumber(stats.netRealizedR ?? stats.net_realized_r, -100000, 100000),
    avgRealizedR: boundedNumber(stats.avgRealizedR ?? stats.avg_realized_r_per_win, -100, 100),
    avgMaeR: boundedNumber(stats.avgMaeR ?? stats.avg_mae_r_on_winners, -100, 100),
    avgMfeR: boundedNumber(stats.avgMfeR ?? stats.avg_mfe_r_per_win, -100, 100),
    captureEfficiencyPct: boundedNumber(stats.captureEfficiencyPct ?? stats.profit_capture_efficiency_pct, 0, 1000),
    planAdherencePct: boundedNumber(stats.rulesCompliance, 0, 100),
    profitFactor: boundedNumber(stats.profitFactor, 0, 10000),
  };
}

function compactTags(value: unknown, key: string) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).map((item) => {
    if (typeof item === 'string') return item.slice(0, 40);
    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      const label = record[key] ?? record.setup ?? record.tag;
      return typeof label === 'string' ? { [key]: label.slice(0, 48), count: boundedNumber(record.count, 0, 100000), winRate: typeof record.winRate === 'string' ? record.winRate.slice(0, 8) : undefined } : null;
    }
    return null;
  }).filter(Boolean);
}

function compactJournalContext(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const context = value as Record<string, unknown>;
  return {
    ...compactStats(context),
    topMistakes: compactTags(context.topMistakes, 'tag'),
    topSetups: compactTags(context.topSetups, 'setup'),
  };
}

function getModel(env: Env, provider: string) {
  const configured = (env as Record<string, string | undefined>)[`${provider.toUpperCase()}_AI_MODEL`];
  const defaults: Record<string, string> = {
    CLOUDFLARE: '@cf/meta/llama-3.1-8b-instruct', GROQ: 'openai/gpt-oss-20b',
    CEREBRAS: 'llama3.1-8b', SAMBANOVA: 'Meta-Llama-3.1-8B-Instruct',
    OPENROUTER: 'openrouter/free', GEMINI: 'gemini-3.8-flash',
  };
  return configured || defaults[provider.toUpperCase()];
}

async function callOpenAiCompatible(url: string, apiKey: string, model: string, messages: AiMessage[]) {
  const response = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: 500, stream: false }),
    signal: AbortSignal.timeout(4500),
  });
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message || `Provider request failed (${response.status})`);
  return payload.choices?.[0]?.message?.content?.trim() || '';
}

async function generateWithFallback(env: Env, messages: AiMessage[]): Promise<ProviderResult | null> {
  const order = (env.AI_PROVIDER_ORDER || 'cloudflare,groq,cerebras,sambanova,openrouter,gemini')
    .split(',').map((provider) => provider.trim().toLowerCase()).filter(Boolean);
  const providers: Record<string, () => Promise<string>> = {
    cloudflare: async () => {
      if (!env.AI) throw new Error('Workers AI binding is not configured');
      const result = await env.AI.run(getModel(env, 'cloudflare'), { messages, max_tokens: 500, temperature: 0.2 });
      const data = result as { response?: string; text?: string; choices?: Array<{ message?: { content?: string } }> };
      return data?.response?.trim() || data?.text?.trim() || data?.choices?.[0]?.message?.content?.trim() || '';
    },
    groq: () => env.GROQ_API_KEY ? callOpenAiCompatible('https://api.groq.com/openai/v1/chat/completions', env.GROQ_API_KEY, getModel(env, 'groq'), messages) : Promise.reject(new Error('Groq key is not configured')),
    cerebras: () => env.CEREBRAS_API_KEY ? callOpenAiCompatible('https://api.cerebras.ai/v1/chat/completions', env.CEREBRAS_API_KEY, getModel(env, 'cerebras'), messages) : Promise.reject(new Error('Cerebras key is not configured')),
    sambanova: () => env.SAMBANOVA_API_KEY ? callOpenAiCompatible('https://api.sambanova.ai/v1/chat/completions', env.SAMBANOVA_API_KEY, getModel(env, 'sambanova'), messages) : Promise.reject(new Error('SambaNova key is not configured')),
    openrouter: () => env.OPENROUTER_API_KEY ? callOpenAiCompatible('https://openrouter.ai/api/v1/chat/completions', env.OPENROUTER_API_KEY, getModel(env, 'openrouter'), messages) : Promise.reject(new Error('OpenRouter key is not configured')),
    gemini: async () => {
      if (!env.GEMINI_API_KEY) throw new Error('Gemini key is not configured');
      const system = messages.find((message) => message.role === 'system')?.content || '';
      const prompt = messages.filter((message) => message.role === 'user').map((message) => message.content).join('\n');
      return (await callGemini(env.GEMINI_API_KEY, prompt, system, getModel(env, 'gemini'))).text;
    },
  };
  for (const name of order) {
    const provider = providers[name];
    if (!provider) continue;
    try {
      const text = await provider();
      if (text) return { text, provider: name, sources: [] };
    } catch {
      // Continue to the next configured provider; never return provider errors or keys to the client.
    }
  }
  return null;
}

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

async function callGemini(apiKey: string, prompt: string, systemInstruction: string, model = 'gemini-3.8-flash') {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 500, temperature: 0.2 },
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
  return `Based on the journal context, you have ${Number(context.totalTrades || 0)} logged trades, a ${Number(context.winRatePct ?? context.winRate ?? 0)}% win rate, and net P&L of $${Number(context.netPnL || 0).toFixed(2)}. For “${message.slice(0, 240)}”, start by checking your sample size, risk consistency, and whether the trade followed a documented setup. I can give a more specific review when you include the trade or setup you mean.`;
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

  try {
    if (url.pathname === '/api/coach/analyze') {
      const { stats = {}, tradesSummary = [], topMistakes = [], topSetups = [] } = body;
      const safeStats = compactStats(stats);
      const safeMistakes = compactTags(topMistakes, 'tag');
      const safeSetups = compactTags(topSetups, 'setup');
      const safeTrades = Array.isArray(tradesSummary) ? tradesSummary.map(compactTrade).filter(Boolean).slice(-8) : [];
      const prompt = `Review this trader's journal and give concise, direct feedback.\nJournal metrics: ${JSON.stringify(safeStats)}\nSetup aggregates: ${JSON.stringify(safeSetups)}\nMistake-tag counts: ${JSON.stringify(safeMistakes)}\nAnonymized trade sample: ${JSON.stringify(safeTrades)}\nGive four short sections: performance read, main leak, psychology/process pattern, and one action for the next 20 trades. Do not infer missing facts.`;
      const result = await generateWithFallback(env, [
        { role: 'system', content: 'You are a practical trading performance coach. Be concise, specific to the supplied journal data, and avoid overstating conclusions from small samples.' },
        { role: 'user', content: prompt },
      ]);
      return result ? json({ analysis: result.text, mode: result.provider, quotaExceeded: false }) : json({ analysis: heuristicAudit(stats, topMistakes, topSetups), mode: 'edge-engine', quotaExceeded: true });
    }

    if (url.pathname === '/api/coach/trade-review') {
      const trade = body.trade as Record<string, unknown> | undefined;
      if (!trade) return json({ error: 'Trade data required' }, 400);
      const safeTrade = compactTrade(trade);
      const prompt = `Review this anonymized trade post-mortem: ${JSON.stringify(safeTrade)}. Respond concisely with an execution grade, risk/management critique, behavioral insight, and one playbook takeaway.`;
      const result = await generateWithFallback(env, [
        { role: 'system', content: 'You are a candid, practical trading performance coach. Distinguish a good process from a lucky outcome. Never invent missing prices or context.' },
        { role: 'user', content: prompt },
      ]);
      return result ? json({ review: result.text, mode: result.provider, quotaExceeded: false }) : json({ review: heuristicTradeReview(trade), mode: 'edge-engine', quotaExceeded: true });
    }

    if (url.pathname === '/api/coach/chat') {
      const message = asText(body.message, '').trim();
      if (!message) return json({ error: 'Message required' }, 400);
      const safeMessage = message.slice(0, 500);
      const journalContext = compactJournalContext(body.journalContext);
      const trades = Array.isArray(body.trades) ? body.trades.map(compactTrade).filter(Boolean).slice(-6) : [];
      const prompt = `Anonymized journal summary: ${JSON.stringify(journalContext)}\nAnonymized recent trade sample: ${JSON.stringify(trades)}\nTrader asks: ${safeMessage}\nAnswer directly and practically. Use only the supplied journal figures; do not assert live market facts.`;
      const result = await generateWithFallback(env, [
        { role: 'system', content: 'You are a thoughtful trading buddy. Be concise, supportive, objective, and specific to the supplied journal.' },
        { role: 'user', content: prompt },
      ]);
      return result ? json({ reply: result.text, mode: result.provider, sources: [], quotaExceeded: false }) : json({ reply: heuristicChat(safeMessage, journalContext), mode: 'edge-engine', sources: [], quotaExceeded: true });
    }

    return json({ error: 'Not found' }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const quotaExceeded = /429|quota|resource_exhausted/i.test(message);
    if (url.pathname === '/api/coach/analyze') return json({ analysis: heuristicAudit(body.stats, body.topMistakes, body.topSetups), mode: 'edge-engine', quotaExceeded });
    if (url.pathname === '/api/coach/trade-review') return json({ review: heuristicTradeReview(body.trade || {}), mode: 'edge-engine', quotaExceeded });
    return json({ reply: heuristicChat(asText(body.message, '').slice(0, 500), compactJournalContext(body.journalContext)), mode: 'edge-engine', sources: [], quotaExceeded });
  }
}
