import OpenAI from 'openai';
import { TranslationResult, CrawledJob, DecodedJobId } from '../types';

export interface TranslateInput {
  crawled: CrawledJob;
  decoded: DecodedJobId;
}

export interface TranslateOptions {
  apiKey: string;
  apiBase?: string;
  model?: string;
  cfAigToken?: string;
}

function buildJobPayload(input: TranslateInput) {
  const { crawled, decoded } = input;
  const detected = crawled.detected_extensions ? JSON.parse(crawled.detected_extensions) : {};
  const highlights = crawled.job_highlights ? JSON.parse(crawled.job_highlights) : [];
  return {
    title: crawled.title,
    company_name: crawled.company_name,
    location: crawled.location,
    address_city: decoded.address_city || '',
    gl: decoded.gl || '',
    search_country: crawled.search_country || '',
    via: crawled.via,
    description: crawled.description || '',
    extensions: crawled.extensions ? JSON.parse(crawled.extensions) : [],
    detected_extensions: detected,
    job_highlights: highlights,
  };
}

function buildPrompt(job: Record<string, unknown>): string {
  return `You are a professional translator and data extractor. Process the following job listing.

The job has these location-related fields:
- "location": from the job listing (e.g. "San Francisco, CA", "Anywhere", "Remote", "United Arab Emirates")
- "address_city": decoded from Google's job ID (e.g. "United States", "Denver, CO", "London", "United Arab Emirates")
- "gl": the 2-letter country code used for the Google search — this is NOT necessarily the job's country, just the search locale
- "search_country": same as gl, the search locale, NOT the job's actual location

Return a JSON object with:
- "title_zh": Chinese translation of the job title. Keep technical terms (React, Python, AWS, etc.) and company names in English.
- "description_zh": Full Chinese translation of the job description. Translate ALL content completely — do NOT summarize or truncate. Keep technical terms in English.
- "country_code": 2-letter lowercase country code (ISO 3166-1 alpha-2) for the ACTUAL job location. Determine from "location" first, then "address_city". Only fall back to "gl" if both "location" and "address_city" are generic (e.g. "Anywhere", "Remote"). Examples: "us", "gb", "de", "ca", "au", "sg", "jp", "ae".
- "country_name": The English name of the country. Examples: "United States", "United Kingdom", "Germany", "Japan", "Singapore".
- "country_name_cn": The Chinese name of the country. Examples: "美国", "英国", "德国", "日本", "新加坡".
- "country_timezone": IANA timezone string for the country's primary/capital timezone. Examples: "America/New_York" (US), "Europe/London" (UK), "Europe/Berlin" (Germany), "Asia/Tokyo" (Japan), "Asia/Singapore" (Singapore), "Australia/Sydney" (Australia), "America/Toronto" (Canada).
- "location_name": The city or region name in English. Extract from "address_city" first, then "location" field. If it contains a city (e.g. "Denver, CO"), use just the city name ("Denver"). If it's just a country name or "Anywhere", use the country name. NEVER use "Remote" — always return at least the country name.
- "location_name_cn": Chinese translation of location_name. Examples: "San Francisco" -> "旧金山", "New York" -> "纽约", "London" -> "伦敦", "Denver" -> "丹佛", "United States" -> "美国", "Germany" -> "德国", "Tokyo" -> "东京", "Singapore" -> "新加坡"
- "salary_lower": integer, lower bound of salary CONVERTED TO CNY (Chinese Yuan). Extract from detected_extensions.salary or description first, then convert to CNY using approximate exchange rates (e.g. 1 USD ≈ 7.2 CNY, 1 EUR ≈ 7.8 CNY, 1 GBP ≈ 9.1 CNY, 1 CAD ≈ 5.3 CNY, 1 AUD ≈ 4.7 CNY, 1 SGD ≈ 5.4 CNY, 1 JPY ≈ 0.048 CNY). If not found, use 0.
- "salary_upper": integer, upper bound of salary CONVERTED TO CNY. Same conversion rules. If not found, use 0.
- "salary_currency": always return "CNY".
- "salary_pay_cycle": one of "hour", "day", "week", "month", "year". The ORIGINAL pay cycle before any conversion. Default "month".
- "job_highlights_zh": translate the job_highlights array to Chinese. Keep the same structure [{title, items}]. Keep technical terms in English.
- "location_requirement": determine the applicant location/eligibility requirement from the job description. Must be one of:
  - "anywhere": no geographic restrictions, open worldwide
  - "country": must reside in or be a citizen of a specific country
  - "region": must be in a specific geographic region (e.g. Americas, EMEA, APAC, EU)
  - "timezone": must work within a specific timezone or overlap hours
  - "authorized": must have existing work authorization or visa for a specific country
  - "unknown": cannot determine from the posting
  Look for phrases like "must be based in", "work authorization required", "US time zones", "open to candidates worldwide", "EU residents only", visa requirements, etc.

Job to process:
${JSON.stringify(job, null, 2)}

Return ONLY a valid JSON object. No markdown, no explanation.`;
}

function parseResult(r: Record<string, unknown>): TranslationResult {
  return {
    index: 0,
    title_zh: (r.title_zh as string) || '',
    description_zh: (r.description_zh as string) || '',
    country_code: ((r.country_code as string) || '').substring(0, 2).toLowerCase(),
    country_name: (r.country_name as string) || '',
    country_name_cn: (r.country_name_cn as string) || '',
    country_timezone: (r.country_timezone as string) || 'UTC',
    location_name: (r.location_name as string) || 'Remote',
    location_name_cn: (r.location_name_cn as string) || '远程',
    salary_lower: Math.round(Number(r.salary_lower) || 0),
    salary_upper: Math.round(Number(r.salary_upper) || 0),
    salary_currency: ((r.salary_currency as string) || 'CNY').substring(0, 3).toUpperCase(),
    salary_pay_cycle: (['hour', 'day', 'week', 'month', 'year'].includes(r.salary_pay_cycle as string) ? r.salary_pay_cycle : 'month') as 'hour' | 'day' | 'week' | 'month' | 'year',
    job_highlights_zh: Array.isArray(r.job_highlights_zh) ? r.job_highlights_zh : [],
    location_requirement: ({ anywhere: 0, country: 1, region: 2, timezone: 3, authorized: 4 } as Record<string, number>)[r.location_requirement as string] ?? 0,
  };
}

export async function translateBatch(
  inputs: TranslateInput[],
  options: TranslateOptions
): Promise<TranslationResult[]> {
  if (inputs.length === 0) return [];

  const defaultHeaders: Record<string, string> = {};
  if (options.cfAigToken) {
    defaultHeaders['cf-aig-authorization'] = `Bearer ${options.cfAigToken}`;
  }

  const client = new OpenAI({
    apiKey: options.apiKey,
    baseURL: options.apiBase || 'https://api.openai.com/v1',
    defaultHeaders,
  });

  const results: TranslationResult[] = [];

  for (let i = 0; i < inputs.length; i++) {
    const job = buildJobPayload(inputs[i]);
    const prompt = buildPrompt(job);

    try {
      const completion = await client.chat.completions.create({
        model: options.model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);
      const result = parseResult(parsed);
      result.index = i;
      results.push(result);
    } catch (err) {
      console.error(`OpenAI API error for job ${i}:`, err instanceof Error ? err.message : err);
    }
  }

  return results;
}
