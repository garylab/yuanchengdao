import { layout } from './layout';

export function aboutPage(gaId?: string, staticUrl?: string): string {
  const content = `
    <div class="max-w-3xl mx-auto px-4 py-12">
      <div class="bg-white rounded-xl shadow-sm border border-surface-200 p-8">
        <h1 class="text-3xl font-bold mb-6">🏝️ 关于远程岛</h1>
        
        <div class="prose text-surface-700 leading-relaxed space-y-4">
          <p class="text-lg">
            <strong>远程岛 (yuanchengdao.com)</strong> 是专为中国人打造的全球远程工作信息平台。
          </p>
          
          <p>
            我们自动收集来自全球的远程工作机会，并使用 AI 技术将职位信息翻译成中文，
            让你无需精通英语也能轻松浏览和申请海外远程工作。
          </p>

          <h2 class="text-xl font-bold mt-8 mb-3">✨ 平台特色</h2>
          <ul class="list-disc list-inside space-y-2 text-surface-600">
            <li>🔄 每6小时自动更新，获取最新远程工作机会</li>
            <li>🤖 AI 智能翻译，职位描述准确易读</li>
            <li>🌍 覆盖全球各类远程岗位</li>
            <li>🔍 按分类、关键词轻松搜索</li>
            <li>📱 移动端完美适配</li>
          </ul>

          <h2 class="text-xl font-bold mt-8 mb-3">📌 职位来源</h2>
          <p>
            所有职位信息均来自 Google Jobs 公开数据，我们不直接发布职位。
            点击"申请"将跳转至原始招聘页面。
          </p>

          <h2 class="text-xl font-bold mt-8 mb-3">💡 "远程岛"的含义</h2>
          <p>
            "远程"（yuancheng）意为远距离工作，"岛"（dao）寓意一片属于远程工作者的自由天地。
            无论你身在何处，都能找到理想的工作机会。
          </p>
        </div>
      </div>
    </div>`;

  return layout('关于我们 - 远程岛', content, {
    gaId,
    description: '远程岛是专为华人打造的全球远程工作信息平台，AI翻译职位信息，每日自动更新海外远程岗位。',
    keywords: '远程岛,关于我们,远程工作平台,华人远程工作,海外远程岗位',
    staticUrl,
  });
}
