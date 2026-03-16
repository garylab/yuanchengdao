import { layout } from './layout';
import { breadcrumb } from '../utils/helpers';

export function aboutPage(gaId?: string, staticUrl?: string): string {
  const bc = breadcrumb([
    { label: '首页', href: '/' },
    { label: '关于' },
  ]);

  const content = `
    ${bc}
    <div class="max-w-3xl mx-auto px-4 py-8">
      <div class="bg-white rounded-xl shadow-sm border border-surface-200 p-8">
        <h1 class="text-3xl font-bold mb-6 flex items-center gap-2"><img src="${staticUrl || ''}/yuanchengdao.svg" alt="远程岛" class="h-8"> 关于远程岛</h1>
        
        <div class="prose text-surface-700 leading-relaxed space-y-4">
          <p class="text-lg">
            <strong>远程岛 (yuanchengdao.com)</strong> 是专为中国人打造的全球远程工作信息平台。
          </p>
          
          <p>
            我们收集来自全球的远程工作机会，让你轻松浏览和申请海外远程工作。
          </p>

          <h2 class="text-xl font-bold mt-8 mb-3">平台特色</h2>
          <ul class="list-disc list-inside space-y-2 text-surface-600">
            <li>覆盖全球各类远程岗位</li>
            <li>按位置、薪资、关键词轻松筛选</li>
            <li>移动端完美适配</li>
          </ul>

          <h2 class="text-xl font-bold mt-8 mb-3">"远程岛"的含义</h2>
          <p>
            "远程"（yuancheng）意为远距离工作，"岛"（dao）寓意一片属于远程工作者的自由天地。
            无论你身在何处，都能找到理想的工作机会。
          </p>
        </div>
      </div>
    </div>`;

  return layout('关于我们 - 远程岛', content, {
    gaId,
    description: '远程岛是什么？一个帮助华人发现全球远程工作机会的平台，无论你身在何处，都能找到不限地点的理想工作。',
    keywords: '远程岛,关于我们,远程工作平台,华人远程工作,海外远程岗位',
    staticUrl,
  });
}
