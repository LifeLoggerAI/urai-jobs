import axios from 'axios';
import { defineSecret } from 'firebase-functions/params';
import { z } from 'zod';

export const tinyFishApiKeySecret = defineSecret('TINYFISH_API_KEY');

const PRODUCTION_ENVS = new Set(['prod', 'production', 'staging']);
const SEARCH_ENDPOINT = 'https://api.search.tinyfish.ai';
const FETCH_ENDPOINT = 'https://api.fetch.tinyfish.ai';
const AGENT_ENDPOINT = 'https://agent.tinyfish.ai/v1/automation/run';

const SearchPayloadSchema = z.object({
  query: z.string().trim().min(1).max(2000),
  purpose: z.string().trim().min(1).max(2000).optional(),
  location: z.string().trim().min(2).max(8).optional(),
  language: z.string().trim().min(2).max(16).optional(),
  includeDomains: z.array(z.string().trim().min(1).max(253)).max(30).optional(),
  excludeDomains: z.array(z.string().trim().min(1).max(253)).max(30).optional(),
  domainType: z.enum(['web', 'news', 'research_paper']).optional(),
  recencyMinutes: z.number().int().min(1).max(5_256_000).optional(),
  afterDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  beforeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  pubYearMin: z.number().int().min(0).max(9999).optional(),
  pubYearMax: z.number().int().min(0).max(9999).optional(),
  page: z.number().int().min(0).max(10).optional(),
});

const FetchPayloadSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(10),
  purpose: z.string().trim().min(1).max(2000).optional(),
  format: z.enum(['markdown', 'html', 'json']).default('markdown'),
  links: z.boolean().default(false),
  imageLinks: z.boolean().default(false),
  pageMetadata: z.boolean().default(false),
  ttl: z.number().int().min(0).optional(),
});

const AgentAuthorizationSchema = z.object({
  approved: z.literal(true),
  allowPaidRun: z.literal(true),
  purpose: z.string().trim().min(3).max(500),
});

const AgentPayloadSchema = z.object({
  url: z.string().url(),
  goal: z.string().trim().min(3).max(6000),
  browserProfile: z.enum(['lite', 'stealth']).default('lite'),
  useProfile: z.boolean().default(false),
  profileId: z.string().trim().min(1).max(200).optional(),
  useVault: z.boolean().default(false),
  authorization: AgentAuthorizationSchema,
});

export type TinyFishJobType = 'web.search' | 'web.fetch' | 'web.agent';

function normalizedEnv(): string {
  return String(process.env.URAI_ENV || process.env.NODE_ENV || 'local').toLowerCase();
}

function envFlag(name: string): boolean {
  return String(process.env[name] || '').toLowerCase() === 'true';
}

function envList(name: string): string[] {
  return String(process.env[name] || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function positiveInt(name: string, fallback: number): number {
  const parsed = Number.parseInt(String(process.env[name] || ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getApiKey(): string {
  try {
    const value = tinyFishApiKeySecret.value();
    if (value) return value;
  } catch {
    // Local tooling may not have Firebase secret bindings.
  }

  const value = String(process.env.TINYFISH_API_KEY || '').trim();
  if (!value) {
    throw new Error('TINYFISH_API_KEY Secret Manager binding is required for TinyFish jobs.');
  }
  return value;
}

function normalizeHostname(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, '');
}

function isObviouslyPrivateHostname(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host === 'metadata.google.internal' || host.endsWith('.internal')) return true;
  if (host === '0.0.0.0' || host === '::1') return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true;
  const match172 = host.match(/^172\.(\d{1,3})\./);
  if (match172) {
    const second = Number(match172[1]);
    if (second >= 16 && second <= 31) return true;
  }
  if (/^169\.254\./.test(host)) return true;
  if (/^100\.(6[4-9]|[78]\d|9\d|1[01]\d|12[0-7])\./.test(host)) return true;
  return false;
}

function parsePublicHttpUrl(value: string): URL {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('TinyFish targets must use http or https.');
  }
  if (url.username || url.password) {
    throw new Error('TinyFish targets must not embed credentials in URLs.');
  }
  if (isObviouslyPrivateHostname(url.hostname)) {
    throw new Error('TinyFish targets must not use local, link-local, or private hostnames.');
  }
  return url;
}

function domainMatches(hostname: string, allowed: string): boolean {
  const host = normalizeHostname(hostname);
  const candidate = normalizeHostname(allowed.replace(/^\*\./, ''));
  return host === candidate || host.endsWith('.' + candidate);
}

function assertAgentDomainAllowed(url: URL): void {
  const allowed = envList('TINYFISH_ALLOWED_AGENT_DOMAINS');
  if (allowed.length === 0) {
    if (PRODUCTION_ENVS.has(normalizedEnv())) {
      throw new Error('TINYFISH_ALLOWED_AGENT_DOMAINS is required for paid Agent jobs in staging/production.');
    }
    return;
  }
  if (!allowed.some((candidate) => domainMatches(url.hostname, candidate))) {
    throw new Error('TinyFish Agent target domain is not allowlisted: ' + url.hostname);
  }
}

function assertProfilePolicy(input: z.infer<typeof AgentPayloadSchema>): void {
  if (!input.useProfile && !input.useVault && !input.profileId) return;

  if (!envFlag('TINYFISH_AUTHENTICATED_AGENT_ENABLED')) {
    throw new Error('Authenticated TinyFish Agent runs are disabled.');
  }

  if (!input.useProfile || !input.profileId) {
    throw new Error('Authenticated TinyFish Agent runs require useProfile=true and an explicit profileId.');
  }

  const allowedProfiles = envList('TINYFISH_ALLOWED_PROFILE_IDS');
  if (allowedProfiles.length === 0 || !allowedProfiles.includes(input.profileId.toLowerCase())) {
    throw new Error('TinyFish Browser Context Profile is not allowlisted.');
  }

  if (input.useVault && !envFlag('TINYFISH_VAULT_ENABLED')) {
    throw new Error('TinyFish Vault access is disabled.');
  }
}

function providerTimeoutMs(surface: TinyFishJobType): number {
  if (surface === 'web.agent') {
    return positiveInt('TINYFISH_AGENT_TIMEOUT_MS', 300_000);
  }
  return positiveInt('TINYFISH_RETRIEVAL_TIMEOUT_MS', 60_000);
}

function sanitizeProviderError(surface: TinyFishJobType, error: unknown): Error {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error : new Error('TinyFish ' + surface + ' request failed.');
  }

  const status = error.response?.status;
  const body = error.response?.data as
    | { error?: { code?: unknown; message?: unknown }; message?: unknown }
    | undefined;
  const code = typeof body?.error?.code === 'string' ? body.error.code : undefined;
  const providerMessage =
    typeof body?.error?.message === 'string'
      ? body.error.message
      : typeof body?.message === 'string'
        ? body.message
        : error.code || 'provider request failed';

  const parts = [
    'TinyFish ' + surface + ' failed',
    status ? 'HTTP ' + status : undefined,
    code,
    providerMessage,
  ].filter(Boolean);

  return new Error(parts.join(' — '));
}

function truncateFetchText(response: unknown): unknown {
  if (!response || typeof response !== 'object') return response;
  const record = response as Record<string, unknown>;
  if (!Array.isArray(record.results)) return response;

  const maxChars = positiveInt('TINYFISH_MAX_TEXT_CHARS_PER_PAGE', 40_000);
  return {
    ...record,
    results: record.results.map((entry) => {
      if (!entry || typeof entry !== 'object') return entry;
      const item = entry as Record<string, unknown>;
      if (typeof item.text !== 'string' || item.text.length <= maxChars) return item;
      return {
        ...item,
        text: item.text.slice(0, maxChars),
        uraiTruncated: true,
        uraiOriginalTextChars: item.text.length,
      };
    }),
  };
}

function boundResult(surface: TinyFishJobType, response: unknown): Record<string, unknown> {
  const normalized = surface === 'web.fetch' ? truncateFetchText(response) : response;
  const completedAt = new Date().toISOString();
  const envelope = {
    provider: 'tinyfish',
    surface,
    completedAt,
    response: normalized,
  };

  const maxBytes = positiveInt('TINYFISH_MAX_RESULT_BYTES', 250_000);
  const serialized = JSON.stringify(envelope);
  const serializedBytes = Buffer.byteLength(serialized, 'utf8');
  if (serializedBytes <= maxBytes) return envelope;

  return {
    provider: 'tinyfish',
    surface,
    completedAt,
    truncated: true,
    originalBytes: serializedBytes,
    previewJson: serialized.slice(0, Math.max(1, maxBytes - 1024)),
  };
}

export function isTinyFishJobType(jobType: string): jobType is TinyFishJobType {
  return jobType === 'web.search' || jobType === 'web.fetch' || jobType === 'web.agent';
}

async function executeSearch(payload: unknown): Promise<Record<string, unknown>> {
  const input = SearchPayloadSchema.parse(payload);
  if (input.recencyMinutes && (input.afterDate || input.beforeDate)) {
    throw new Error('TinyFish Search recencyMinutes cannot be combined with afterDate/beforeDate.');
  }
  if (
    input.domainType === 'research_paper' &&
    (input.recencyMinutes || input.afterDate || input.beforeDate)
  ) {
    throw new Error('TinyFish research_paper searches must use pubYearMin/pubYearMax instead of date filters.');
  }

  try {
    const response = await axios.get(SEARCH_ENDPOINT, {
      headers: { 'X-API-Key': getApiKey() },
      timeout: providerTimeoutMs('web.search'),
      params: {
        query: input.query,
        purpose: input.purpose,
        location: input.location,
        language: input.language,
        include_domains: input.includeDomains?.join(','),
        exclude_domains: input.excludeDomains?.join(','),
        domain_type: input.domainType,
        recency_minutes: input.recencyMinutes,
        after_date: input.afterDate,
        before_date: input.beforeDate,
        pub_year_min: input.pubYearMin,
        pub_year_max: input.pubYearMax,
        page: input.page,
      },
      validateStatus: (status) => status >= 200 && status < 300,
    });
    return boundResult('web.search', response.data);
  } catch (error) {
    throw sanitizeProviderError('web.search', error);
  }
}

async function executeFetch(payload: unknown): Promise<Record<string, unknown>> {
  const input = FetchPayloadSchema.parse(payload);
  input.urls.forEach((value) => parsePublicHttpUrl(value));

  try {
    const response = await axios.post(
      FETCH_ENDPOINT,
      {
        urls: input.urls,
        purpose: input.purpose,
        format: input.format,
        links: input.links,
        image_links: input.imageLinks,
        page_metadata: input.pageMetadata,
        ...(input.ttl === undefined ? {} : { ttl: input.ttl }),
      },
      {
        headers: {
          'X-API-Key': getApiKey(),
          'Content-Type': 'application/json',
        },
        timeout: providerTimeoutMs('web.fetch'),
        validateStatus: (status) => status >= 200 && status < 300,
      },
    );
    return boundResult('web.fetch', response.data);
  } catch (error) {
    throw sanitizeProviderError('web.fetch', error);
  }
}

async function executeAgent(payload: unknown): Promise<Record<string, unknown>> {
  const input = AgentPayloadSchema.parse(payload);
  if (!envFlag('TINYFISH_AGENT_ENABLED')) {
    throw new Error('Paid TinyFish Agent execution is disabled. Set TINYFISH_AGENT_ENABLED=true after release approval.');
  }

  const target = parsePublicHttpUrl(input.url);
  assertAgentDomainAllowed(target);
  assertProfilePolicy(input);

  try {
    const response = await axios.post(
      AGENT_ENDPOINT,
      {
        url: target.toString(),
        goal: input.goal,
        browser_profile: input.browserProfile,
        ...(input.useProfile ? { use_profile: true, profile_id: input.profileId } : {}),
        ...(input.useVault ? { use_vault: true } : {}),
      },
      {
        headers: {
          'X-API-Key': getApiKey(),
          'Content-Type': 'application/json',
        },
        timeout: providerTimeoutMs('web.agent'),
        validateStatus: (status) => status >= 200 && status < 300,
      },
    );
    return boundResult('web.agent', response.data);
  } catch (error) {
    throw sanitizeProviderError('web.agent', error);
  }
}

export async function executeTinyFishJob(
  jobType: TinyFishJobType,
  payload: unknown,
): Promise<Record<string, unknown>> {
  if (jobType === 'web.search') return executeSearch(payload);
  if (jobType === 'web.fetch') return executeFetch(payload);
  return executeAgent(payload);
}
