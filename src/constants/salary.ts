export const SALARY_OPTIONS = [
  { value: '', label: '全部' },
  { value: '0-0', label: '无薪资' },
  { value: '1-', label: '有薪资' },
  { value: '1-499', label: '1-499' },
  { value: '500-999', label: '500-1K' },
  { value: '1000-2999', label: '1K-3K' },
  { value: '3000-6999', label: '3K-7K' },
  { value: '7000-9999', label: '7K-1万' },
  { value: '10000-19999', label: '1万-2万' },
  { value: '20000-29999', label: '2万-3万' },
  { value: '30000-39999', label: '3万-4万' },
  { value: '40000-49999', label: '4万-5万' },
  { value: '50000-', label: '5万+' },
];

export function isKnownSalaryRange(value: string): boolean {
  return SALARY_OPTIONS.some((o) => o.value === value);
}

export function salaryLabel(value: string | null | undefined): string {
  if (!value) return '不限';
  const opt = SALARY_OPTIONS.find((o) => o.value === value);
  return opt ? opt.label : value;
}

export function jobMatchesSalaryRange(
  salaryRange: string | null | undefined,
  salaryLower: number,
  salaryUpper: number,
): boolean {
  if (!salaryRange) return true;
  const [minStr, maxStr] = salaryRange.split('-');
  const salaryMin = parseInt(minStr, 10) || 0;
  const salaryMax = maxStr ? parseInt(maxStr, 10) : 0;
  if (salaryMax > 0) {
    return salaryUpper >= salaryMin && salaryLower <= salaryMax;
  }
  return salaryUpper >= salaryMin;
}

export function monthlySalarySql(expr: string): string {
  return `(CASE salary_pay_cycle WHEN 'year' THEN (${expr}) / 12.0 WHEN 'hour' THEN (${expr}) * 160.0 WHEN 'day' THEN (${expr}) * 21.0 WHEN 'week' THEN (${expr}) * 4.33 ELSE (${expr}) END)`;
}
