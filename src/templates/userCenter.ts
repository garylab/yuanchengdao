import { AuthUser } from '../types';

function shell(
  activePath: string,
  innerContent: string,
  items: Array<{ href: string; label: string }>,
  wrapperClass: string,
): string {
  const isActive = (href: string) => activePath === href || activePath.startsWith(href + '/');
  const sidebarLink = (href: string, label: string, extraClasses = '') =>
    `<a href="${href}" class="${extraClasses} no-underline transition ${
      isActive(href)
        ? 'text-brand-600 bg-brand-50 font-semibold'
        : 'text-surface-700 hover:bg-surface-100 hover:text-brand-600'
    }">${label}</a>`;

  const desktopNav = items.map((it) =>
    sidebarLink(it.href, it.label, 'block px-4 py-2 rounded text-sm')
  ).join('\n          ');
  const mobileNav = items.map((it) =>
    sidebarLink(it.href, it.label, 'px-3 py-1.5 rounded text-sm border border-transparent')
  ).join('\n          ');

  return `
    <div class="${wrapperClass}">
      <div class="flex flex-col sm:flex-row gap-6">
        <aside class="sm:w-48 sm:flex-shrink-0">
          <nav class="hidden sm:block bg-white rounded shadow-sm border border-surface-200 p-2 sticky top-20">
            ${desktopNav}
          </nav>
          <nav class="sm:hidden flex flex-wrap gap-2 mb-2">
            ${mobileNav}
          </nav>
        </aside>
        <main class="min-w-0 flex-1 space-y-6">
          ${innerContent}
        </main>
      </div>
    </div>`;
}

export function userCenterShell(
  activePath: string,
  innerContent: string,
  _user: AuthUser,
): string {
  const items = [
    { href: '/account', label: '我的' },
    { href: '/favorites', label: '收藏' },
  ];
  return shell(activePath, innerContent, items, 'max-w-5xl mx-auto px-4 py-6');
}

export function adminShell(
  activePath: string,
  innerContent: string,
  _user: AuthUser,
): string {
  const items = [
    { href: '/users', label: '所有用户' },
    { href: '/admin/feedback', label: '反馈管理' },
    { href: '/admin/submissions', label: '投递审核' },
  ];
  return shell(activePath, innerContent, items, 'w-full px-4 py-6');
}
