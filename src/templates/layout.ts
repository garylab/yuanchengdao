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
  const desc = options?.description || '远程岛 - 华人全球远程工作机会平台，精选海外远程岗位';
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
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏝️</text></svg>">
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
    @font-face {
      font-family: 'Noto Sans SC';
      font-style: normal;
      font-weight: 400 700;
      font-display: swap;
      src: url('${options?.staticUrl || ''}/fonts/noto-sans-sc.woff2') format('woff2');
    }
    body { font-family: 'Noto Sans SC', system-ui, sans-serif; }
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
        <span class="text-2xl">🏝️</span>
        <span class="text-xl font-bold text-surface-900">远程<span class="text-brand-500">岛</span></span>
        <span class="text-xs text-surface-400 hidden sm:inline ml-1">华人全球远程工作机会平台</span>
      </a>
      <form action="/" method="GET" class="relative flex-1 max-w-md">
        <input type="text" name="q"
          placeholder="搜索职位、公司或关键词..."
          class="w-full px-4 py-2 rounded-lg border border-surface-200 text-sm outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-300 placeholder:text-surface-400">
        <button type="submit" class="absolute right-1.5 top-1/2 -translate-y-1/2 bg-brand-500 text-white px-3 py-1 rounded-md text-xs font-medium hover:bg-brand-600 transition">
          搜索
        </button>
      </form>
    </div>
  </header>

  ${content}

  <!-- Footer -->
  <footer class="border-t border-surface-200 bg-white mt-16">
    <div class="max-w-5xl mx-auto px-4 py-8 text-center text-sm text-surface-400">
      <p class="mb-2"><a href="/" class="no-underline text-surface-400 hover:text-brand-500 transition">🏝️ 远程岛</a> — 为中国人提供全球远程工作机会</p>
      <p class="mt-2">© ${new Date().getFullYear()} <a href="/" class="no-underline text-surface-400 hover:text-brand-500 transition">yuanchengdao.com</a></p>
    </div>
  </footer>
  <script>
    document.addEventListener('click', function(e) {
      var collapse = e.target.closest('.job-collapse');
      if (collapse) {
        var row = collapse.closest('.job-row');
        row.classList.remove('expanded');
        row.classList.add('visited');
        row.querySelector('.job-expand').classList.add('hidden');
        return;
      }
      var title = e.target.closest('.job-title');
      if (title) return;
      var header = e.target.closest('.job-row-header');
      if (!header) return;
      e.preventDefault();
      var row = header.closest('.job-row');
      var panel = row.querySelector('.job-expand');
      var isOpen = row.classList.contains('expanded');
      document.querySelectorAll('.job-row.expanded, .job-row.visited').forEach(function(r) {
        if (r !== row) {
          r.classList.remove('expanded', 'visited');
          var p = r.querySelector('.job-expand');
          if (p) p.classList.add('hidden');
        }
      });
      if (isOpen) {
        row.classList.remove('expanded');
        row.classList.add('visited');
        panel.classList.add('hidden');
      } else {
        row.classList.remove('visited');
        row.classList.add('expanded');
        panel.classList.remove('hidden');
      }
    });
  </script>
</body>
</html>`;
}
