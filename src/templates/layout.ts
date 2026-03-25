import { appScriptVersion } from '../public/app';

export interface LayoutOptions {
  description?: string;
  gaId?: string;
  canonical?: string;
  ogImage?: string;
  jsonLd?: string;
  keywords?: string;
  staticUrl?: string;
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
  <link rel="icon" href="${options?.staticUrl || ''}/favicon.ico" type="image/x-icon">
  <script src="${options?.staticUrl || ''}/js/tailwindcss.js"></script>
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
    .tag-pill { @apply inline-block px-2 py-0.5 text-xs rounded-full; }
  </style>
</head>
<body class="bg-surface-50 text-surface-900 min-h-screen">
  <header class="bg-white border-b border-surface-200 sticky top-0 z-50">
    <div class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
      <a href="/" class="flex items-center gap-2 no-underline flex-shrink-0">
        <img src="${options?.staticUrl || ''}/yuanchengdao-logo.png" alt="远程岛" class="h-8">
        <span class="text-xs text-surface-400 hidden sm:inline ml-1">华人全球远程工作机会平台</span>
      </a>
      <nav class="flex items-center gap-1 sm:gap-4 text-sm">
        <a href="/" class="px-2 py-1 text-surface-600 hover:text-brand-500 transition no-underline">首页</a>
        <a href="/companies" class="px-2 py-1 text-surface-600 hover:text-brand-500 transition no-underline">企业</a>
        <a href="/categories" class="px-2 py-1 text-surface-600 hover:text-brand-500 transition no-underline">分类</a>
        <a href="/about" class="px-2 py-1 text-surface-600 hover:text-brand-500 transition no-underline">关于</a>
      </nav>
    </div>
  </header>

  ${content}

  <!-- Footer -->
  <footer class="border-t border-surface-200 bg-white mt-16">
    <div class="max-w-5xl mx-auto px-4 py-8 text-center text-sm text-surface-400">
      <p class="mb-2 inline-flex items-center justify-center gap-1"><a href="/" class="no-underline text-surface-400 hover:text-brand-500 transition inline-flex items-center"><img src="${options?.staticUrl || ''}/yuanchengdao-logo.png" alt="远程岛" class="h-5"></a> <span>— 为中国人提供全球远程工作机会</span></p>
      <p class="mt-2">© ${new Date().getFullYear()} <a href="/" class="no-underline text-surface-400 hover:text-brand-500 transition">yuanchengdao.com</a></p>
    </div>
  </footer>
  <script src="/js/app.js?v=${appScriptVersion}" defer></script>
</body>
</html>`;
}
