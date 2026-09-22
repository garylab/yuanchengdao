export const FEEDBACK_CATEGORIES = [
  { value: 'category', label: '缺少职位', placeholder: '例如：希望增加"数据分析师"职位' },
  { value: 'location', label: '缺少地区', placeholder: '例如：希望增加"阿姆斯特丹"或"荷兰"地区' },
  { value: 'source', label: '推荐职位来源', placeholder: '例如：建议抓取 xxx.com 的远程职位' },
  { value: 'bug', label: '功能异常', placeholder: '例如：搜索结果不准确 / 页面样式错乱' },
  { value: 'other', label: '其他建议', placeholder: '任何想让远程岛变得更好的建议' },
];

export function feedbackCategoryLabel(value: string): string {
  return FEEDBACK_CATEGORIES.find((c) => c.value === value)?.label || value;
}

export function isKnownFeedbackCategory(value: string): boolean {
  return FEEDBACK_CATEGORIES.some((c) => c.value === value);
}
