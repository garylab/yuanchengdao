export function layout(title: string, content: string, options?: { description?: string; gaId?: string }): string {
  const desc = options?.description || '远程岛 - 为中国人提供全球远程工作岗位';
  const ga = options?.gaId ? `
  <script async src="https://www.googletagmanager.com/gtag/js?id=${options.gaId}"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${options.gaId}');</script>` : '';
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | 远程岛 - yuanchengdao.com</title>
  <meta name="description" content="${desc}">${ga}
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏝️</text></svg>">
  <script src="https://cdn.tailwindcss.com"></script>
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
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700&display=swap');
    body { font-family: 'Noto Sans SC', system-ui, sans-serif; }
    .job-row-header:hover { background-color: #fef3ec; }
    .job-row-header { transition: background-color 0.15s ease; }
    .job-row.expanded .job-row-header { background-color: #fef3ec; }
    .job-row.expanded .job-chevron { transform: rotate(180deg); }
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
        <span class="text-xs text-surface-400 hidden sm:inline ml-1">华人的全球远程工作机会</span>
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
      <p class="mb-2">🏝️ 远程岛 — 为中国人提供全球远程工作机会</p>
      <p class="mt-2">© ${new Date().getFullYear()} yuanchengdao.com</p>
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
