export interface Env {
  DB: D1Database;
  R2: R2Bucket;
  SERPAPI_KEY: string;
  OPENAI_API_KEY: string;
  SITE_URL: string;
  STATIC_URL: string;
  GA_ID?: string;
}

// Raw SerpAPI response shape for a single job
export interface SerpApiJob {
  title: string;
  company_name: string;
  location: string;
  via: string;
  description: string;
  job_id: string;
  share_link?: string;
  thumbnail?: string;
  extensions?: string[];
  detected_extensions?: {
    posted_at?: string;
    schedule_type?: string;
    salary?: string;
    health_insurance?: boolean;
    dental_coverage?: boolean;
    paid_time_off?: boolean;
    [key: string]: unknown;
  };
  job_highlights?: Array<{
    title: string;
    items: string[];
  }>;
  apply_options?: Array<{
    title: string;
    link: string;
  }>;
}

// Decoded fields from the base64 job_id
export interface DecodedJobId {
  htidocid: string;
  address_city?: string;
  gl?: string;
}

// DB row for jobs_crawled table
export interface CrawledJob {
  id: number;
  job_id: string;
  htidocid: string;
  title: string;
  company_name: string;
  location: string | null;
  via: string | null;
  description: string | null;
  thumbnail: string | null;
  extensions: string | null;
  detected_extensions: string | null;
  job_highlights: string | null;
  apply_options: string | null;
  search_query: string | null;
  search_country: string | null;
  process_status: number;
  failed_reason: string | null;
  created_at: string;
}

// DB row for countries table
export interface Country {
  id: number;
  code: string;
  name: string;
  name_cn: string;
  slug: string;
  timezone: string;
  is_active: number;
  created_at: string;
}

// DB row for locations table
export interface Location {
  id: number;
  name: string;
  name_cn: string;
  slug: string;
  country_id: number | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

// DB row for companies table
export interface Company {
  id: number;
  name: string;
  slug: string;
  thumbnail: string | null;
  location_id: number | null;
  created_at: string;
  updated_at: string;
}

// DB row for processed jobs table (with joined fields)
export interface Job {
  id: number;
  crawled_id: number;
  slug: string;
  title: string;
  description: string;
  company_id: number | null;
  location_id: number | null;
  country_id: number | null;
  posted_at: string | null;
  salary_lower: number;
  salary_upper: number;
  salary_currency: string;
  salary_pay_cycle: string;
  detected_extensions: string | null;
  job_highlights: string | null;
  apply_options: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
  // joined fields
  company_name?: string;
  company_thumbnail?: string;
  location_name?: string;
  location_name_cn?: string;
  country_code?: string;
  country_name_cn?: string;
}

// ChatGPT translation response shape for a single job
export interface TranslationResult {
  index: number;
  title_zh: string;
  description_zh: string;
  country_code: string;
  country_name: string;
  country_name_cn: string;
  country_timezone: string;
  location_name: string;
  location_name_cn: string;
  salary_lower: number;
  salary_upper: number;
  salary_currency: string;
  salary_pay_cycle: 'day' | 'week' | 'month' | 'year';
  job_highlights_zh: Array<{
    title: string;
    items: string[];
  }>;
}
