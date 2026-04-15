import { appScriptAssetFilename } from '../public/app';

export interface LayoutOptions {
  description?: string;
  gaId?: string;
  canonical?: string;
  ogImage?: string;
  jsonLd?: string;
  keywords?: string;
  staticUrl?: string;
  activePath?: string;
}

export function layout(title: string, content: string, options?: LayoutOptions): string {
  const desc = options?.description || '远程岛是面向华人的全球远程工作平台，每天更新来自世界各地的远程岗位，帮你找到不限地点、自由办公的理想工作。';
  const fullTitle = title;
  const ga = options?.gaId?.trim() ? `
  <script async src="https://www.googletagmanager.com/gtag/js?id=${options.gaId}"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${options.gaId}');</script>` : '';
  const canonical = options?.canonical ? `\n  <link rel="canonical" href="${options.canonical}">` : '';
  const ogImage = options?.ogImage || '';
  const keywords = options?.keywords || '远程工作,远程岗位,remote jobs,海外远程,远程招聘,在家工作,远程办公,华人远程工作';
  const jsonLd = options?.jsonLd ? `\n  <script type="application/ld+json">${options.jsonLd}</script>` : '';
  const ap = options?.activePath || '/';
  const navItems = [
    { href: '/', label: '工作' },
    { href: '/companies', label: '企业' },
    { href: '/locations', label: '地区' },
    { href: '/categories', label: '分类' },
  ];
  const isActive = (href: string) => href === '/' ? ap === '/' : ap.startsWith(href);
  const desktopNav = navItems.map(n =>
    `<a href="${n.href}" class="px-2 py-1 transition no-underline ${isActive(n.href) ? 'text-brand-500 font-semibold' : 'text-surface-600 hover:text-brand-500'}">${n.label}</a>`
  ).join('\n        ');
  const mobileNav = navItems.map(n =>
    `<a href="${n.href}" class="block px-4 py-2 text-sm no-underline ${isActive(n.href) ? 'text-brand-500 bg-brand-50 font-semibold' : 'text-surface-600 hover:bg-brand-50 hover:text-brand-500'}">${n.label}</a>`
  ).join('\n          ');
  const telegramChannelUrl = 'https://t.me/yuanchengdao';
  const cdnStatic = (options?.staticUrl || '').trim().replace(/\/$/, '');
  const tailwindSrc = cdnStatic ? `${cdnStatic}/js/tailwindcss.js` : '/js/tailwindcss.js';
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fullTitle}</title>
  <meta name="description" content="${desc}">
  <meta name="keywords" content="${keywords}">
  <meta name="robots" content="index, follow">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${fullTitle}">
  <meta property="og:description" content="${desc}">
  <meta property="og:site_name" content="远程岛">
  <meta property="og:locale" content="zh_CN">${ogImage ? `\n  <meta property="og:image" content="${ogImage}">` : ''}${canonical ? `\n  <meta property="og:url" content="${options?.canonical}">` : ''}
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${fullTitle}">
  <meta name="twitter:description" content="${desc}">${canonical}${ga}${jsonLd}
  <link rel="icon" href="/favicon.ico" type="image/x-icon">
  <script src="${tailwindSrc}"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brand: { 50: '#fef3ec', 100: '#fde4d4', 200: '#f9c5a8', 300: '#f5a071', 400: '#f07a3a', 500: '#ec6517', 600: '#dd4c0e', 700: '#b7370f', 800: '#922e14', 900: '#782814' },
            surface: { 50: '#fafaf9', 100: '#f5f5f4', 200: '#e7e5e4', 800: '#292524', 900: '#1c1917' }
          }
        }
      }
    }
  </script>
  <style>
    body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    .job-row-header:hover { background-color: #fef3ec; }
    .job-row-header { transition: background-color 0.15s ease; }
    .job-row.expanded .job-row-header { background-color: #fef3ec; }
    .job-row.visited .job-row-header { background-color: #fef3ec; }
    .tag-pill { @apply inline-block px-2 py-0.5 text-xs rounded; }
  </style>
</head>
<body class="bg-surface-50 text-surface-900 min-h-screen">
  <header class="bg-white border-b border-surface-200 sticky top-0 z-50">
    <div class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
      <a href="/" class="flex items-center gap-2 no-underline flex-shrink-0">
        <img src="/yuanchengdao-logo.png" alt="远程岛" class="h-8">
        <span class="text-xs text-surface-400 hidden sm:inline ml-1">全球<em class="not-italic">远程工作</em>机会平台</span>
      </a>
      <div class="flex items-center gap-2 sm:gap-4">
        <nav class="hidden sm:flex items-center gap-4 text-sm">
          ${desktopNav}
        </nav>
        <div class="relative sm:hidden">
          <button id="mobile-menu-btn" class="p-2 text-surface-600 hover:text-brand-500 transition" aria-label="菜单">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
          <div id="mobile-menu" class="hidden absolute right-0 top-full mt-1 w-36 bg-white rounded shadow-lg border border-surface-200 py-1 z-50">
            ${mobileNav}
          </div>
        </div>
      </div>
    </div>
  </header>

  ${content}

  <!-- Footer -->
  <footer class="border-t border-surface-200 bg-white mt-16">
    <div class="max-w-5xl mx-auto px-4 py-8 text-sm text-surface-400">
      <div class="flex flex-row items-center justify-between gap-4">
        <div class="text-left space-y-2 min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span class="text-surface-500">© ${new Date().getFullYear()}</span>
            <a href="/" class="ml-2 no-underline text-surface-400 hover:text-brand-500 transition inline-flex items-center flex-shrink-0">远程岛</a>
            <a href="/about" class="ml-2 no-underline transition ${ap.startsWith('/about') ? 'text-brand-500 font-medium' : 'text-surface-400 hover:text-brand-500'}">关于</a>
            <a href="${telegramChannelUrl}" target="_blank" class="ml-2 no-underline text-surface-400 hover:text-brand-500 transition" title="Telegram 频道" aria-label="Telegram 频道">Telegram频道</a>
          </div>
          
        </div>
        <div class="flex items-center justify-end gap-3 sm:gap-4 shrink-0">
          <a href="https://hirelala.com" target="_blank" class="no-underline text-surface-400 hover:text-brand-500 transition">海拉拉</a>
          <a href="https://mockreal.com/zh" target="_blank" class="inline-flex items-center no-underline text-surface-400 hover:text-brand-500 transition">
            <span class="relative z-10">英语模拟面试</span>
          </a>
        </div>
      </div>
    </div>
  </footer>
  <script src="/js/${appScriptAssetFilename}" defer></script>
</body>
</html>`;
}
