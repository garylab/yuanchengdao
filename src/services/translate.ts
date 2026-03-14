import { TranslationResult, CrawledJob, DecodedJobId } from '../types';

export interface TranslateInput {
  crawled: CrawledJob;
  decoded: DecodedJobId;
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
    description: (crawled.description || '').substring(0, 3000),
    extensions: crawled.extensions ? JSON.parse(crawled.extensions) : [],
    detected_extensions: detected,
    job_highlights: highlights,
  };
}

export async function translateBatch(
  inputs: TranslateInput[],
  apiKey: string,
  apiBase?: string
): Promise<TranslationResult[]> {
  if (inputs.length === 0) return [];

  const jobsForPrompt = inputs.map((input, idx) => ({
    index: idx,
    ...buildJobPayload(input),
  }));

  const prompt = `You are a professional translator and data extractor. Process the following job listings.

Each job has these location-related fields:
- "location": from the job listing (e.g. "San Francisco, CA", "Anywhere", "Remote")
- "address_city": decoded from Google's job ID (e.g. "United States", "Denver, CO", "London")
- "gl": the 2-letter country code from Google's job ID (e.g. "us", "gb", "de")
- "search_country": the country code used to search (e.g. "us", "gb")

For EACH job, return a JSON object with:
- "index": the original index number
- "title_zh": Chinese translation of the job title. Keep technical terms (React, Python, AWS, etc.) and company names in English.
- "description_zh": Chinese translation of the job description. Keep it concise (max 800 chars). Keep technical terms in English.
- "country_code": 2-letter lowercase country code (ISO 3166-1 alpha-2) for this job. Determine from "gl" first, then "address_city", then "search_country". Examples: "us", "gb", "de", "ca", "au", "sg", "jp".
- "country_name": The English name of the country. Examples: "United States", "United Kingdom", "Germany", "Japan", "Singapore".
- "country_name_cn": The Chinese name of the country. Examples: "美国", "英国", "德国", "日本", "新加坡".
- "country_timezone": IANA timezone string for the country's primary/capital timezone. Examples: "America/New_York" (US), "Europe/London" (UK), "Europe/Berlin" (Germany), "Asia/Tokyo" (Japan), "Asia/Singapore" (Singapore), "Australia/Sydney" (Australia), "America/Toronto" (Canada).
- "location_name": The city or region name in English. Extract from "address_city" first, then "location" field. If it contains a city (e.g. "Denver, CO"), use just the city name ("Denver"). If it's just a country name or "Anywhere", use the country name. NEVER use "Remote" — always return at least the country name.
- "location_name_cn": Chinese translation of location_name. Examples: "San Francisco" -> "旧金山", "New York" -> "纽约", "London" -> "伦敦", "Denver" -> "丹佛", "United States" -> "美国", "Germany" -> "德国", "Tokyo" -> "东京", "Singapore" -> "新加坡"
- "salary_lower": integer, lower bound of salary CONVERTED TO CNY (Chinese Yuan). Extract from detected_extensions.salary or description first, then convert to CNY using approximate exchange rates (e.g. 1 USD ≈ 7.2 CNY, 1 EUR ≈ 7.8 CNY, 1 GBP ≈ 9.1 CNY, 1 CAD ≈ 5.3 CNY, 1 AUD ≈ 4.7 CNY, 1 SGD ≈ 5.4 CNY, 1 JPY ≈ 0.048 CNY). If not found, use 0.
- "salary_upper": integer, upper bound of salary CONVERTED TO CNY. Same conversion rules. If not found, use 0.
- "salary_currency": always return "CNY".
- "salary_pay_cycle": one of "day", "week", "month", "year". The ORIGINAL pay cycle before any conversion. Default "year".
- "job_highlights_zh": translate the job_highlights array to Chinese. Keep the same structure [{title, items}]. Keep technical terms in English.

Jobs to process:
${JSON.stringify(jobsForPrompt, null, 2)}

Return ONLY a valid JSON array of objects. No markdown, no explanation.`;

  const endpoint = `${(apiBase || 'https://api.openai.com').replace(/\/+$/, '')}/v1/chat/completions`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 8000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(`OpenAI API error: ${response.status} - ${body.substring(0, 300)}`);
    return [];
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices[0]?.message?.content || '{}';

  try {
    const parsed = JSON.parse(content);
    const results: TranslationResult[] = Array.isArray(parsed) ? parsed : (parsed.jobs || parsed.results || parsed.data || []);

    return results.map(r => ({
      index: r.index ?? 0,
      title_zh: r.title_zh || '',
      description_zh: r.description_zh || '',
      country_code: (r.country_code || '').substring(0, 2).toLowerCase(),
      country_name: r.country_name || '',
      country_name_cn: r.country_name_cn || '',
      country_timezone: r.country_timezone || 'UTC',
      location_name: r.location_name || 'Remote',
      location_name_cn: r.location_name_cn || '远程',
      salary_lower: Math.round(Number(r.salary_lower) || 0),
      salary_upper: Math.round(Number(r.salary_upper) || 0),
      salary_currency: (r.salary_currency || 'CNY').substring(0, 3).toUpperCase(),
      salary_pay_cycle: ['day', 'week', 'month', 'year'].includes(r.salary_pay_cycle) ? r.salary_pay_cycle : 'year',
      job_highlights_zh: Array.isArray(r.job_highlights_zh) ? r.job_highlights_zh : [],
    }));
  } catch (err) {
    console.error('Failed to parse translation response:', err, content.substring(0, 500));
    return [];
  }
}
