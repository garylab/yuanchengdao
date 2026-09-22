export const SUBSCRIPTION_KINDS = [
  { value: 'category', label: '按职位分类' },
  { value: 'keyword', label: '按关键词' },
  { value: 'company', label: '按公司' },
] as const;

export type SubscriptionKind = (typeof SUBSCRIPTION_KINDS)[number]['value'];

const KIND_SET = new Set<string>(SUBSCRIPTION_KINDS.map((k) => k.value));

export function isSubscriptionKind(value: unknown): value is SubscriptionKind {
  return typeof value === 'string' && KIND_SET.has(value);
}

export function subscriptionKindLabel(value: string): string {
  return SUBSCRIPTION_KINDS.find((k) => k.value === value)?.label || value;
}

export const KEYWORD_QUERY_MAX_LENGTH = 60;
