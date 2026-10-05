import { appScriptAssetFilename } from '../public/app';
import { appStylesAssetFilename } from '../public/styles';
import { AuthUser } from '../types';
import { escapeHtml } from '../utils/helpers';

export interface LayoutOptions {
  description?: string;
  gaId?: string;
  canonical?: string;
  ogImage?: string;
  /** Render the card as a large image rather than a thumbnail. Only set this
   *  when the image really is ~1200x630; a small logo stretched into a wide card
   *  looks worse than the thumbnail layout. */
  ogImageLarge?: boolean;
  ogType?: string;
  /** One or more JSON-LD blocks. Falsy entries are dropped, so builders can
   *  return '' when they have nothing to say. */
  jsonLd?: string | string[];
  /** Keep the page out of the index but let crawlers follow its links. */
  noindex?: boolean;
  keywords?: string;
  staticUrl?: string;
  activePath?: string;
  user?: AuthUser | null;
}

export function layout(title: string, content: string, options?: LayoutOptions): string {
  const desc = options?.description || '远程岛是面向华人的全球远程工作平台，每天更新来自世界各地的远程岗位，帮你找到不限地点、自由办公的理想工作。';
  const fullTitle = title;
  // gtag() is stubbed immediately so page scripts can queue events, but the
  // googletagmanager request is deferred until the page has loaded (or the user
  // interacts). It is unreachable from mainland China and used to sit on a
  // connection slot during the critical path.
  const ga = options?.gaId?.trim() ? `
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${options.gaId}');
  (function(){var loaded=false;function load(){if(loaded)return;loaded=true;var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id=${options.gaId}';document.head.appendChild(s);}
  if(document.readyState==='complete'){setTimeout(load,1000);}else{window.addEventListener('load',function(){setTimeout(load,1000);});}
  ['pointerdown','keydown','touchstart'].forEach(function(ev){window.addEventListener(ev,load,{once:true,passive:true});});})();</script>` : '';
  const canonical = options?.canonical ? `\n  <link rel="canonical" href="${options.canonical}">` : '';
  const ogImage = options?.ogImage || '';
  const ogType = options?.ogType || 'website';
  const robots = options?.noindex ? 'noindex, follow' : 'index, follow';
  // A 1200x630 card renders as a banner; anything else (a company logo, the
  // default) stays a thumbnail.
  const twitterCard = ogImage && options?.ogImageLarge ? 'summary_large_image' : 'summary';
  const ogImageMeta = ogImage
    ? `\n  <meta property="og:image" content="${ogImage}">${options?.ogImageLarge ? `\n  <meta property="og:image:width" content="1200">\n  <meta property="og:image:height" content="630">` : ''}\n  <meta property="og:image:alt" content="${escapeHtml(fullTitle)}">`
    : '';
  const keywords = options?.keywords || '远程工作,远程岗位,remote jobs,海外远程,远程招聘,在家工作,远程办公,华人远程工作';
  const jsonLdBlocks = (Array.isArray(options?.jsonLd) ? options?.jsonLd : [options?.jsonLd])
    .filter((block): block is string => typeof block === 'string' && block.length > 0);
  const jsonLd = jsonLdBlocks.map((block) => `\n  <script type="application/ld+json">${block}</script>`).join('');

  const ap = options?.activePath || '/';
  const user = options?.user;
  const navItems = [
    { href: '/', label: '首页' },
    { href: '/companies', label: '企业' },
    { href: '/locations', label: '地区' },
    { href: '/categories', label: '职位' },
  ];
  const isActive = (href: string) => href === '/' ? ap === '/' : ap.startsWith(href);
  const desktopNav = navItems.map(n =>
    `<a href="${n.href}" class="px-2 py-1 transition no-underline ${isActive(n.href) ? 'text-brand-500 font-semibold' : 'text-surface-600 hover:text-brand-500'}">${n.label}</a>`
  ).join('\n        ');
  const postJobDesktop = `<a href="/post-job" class="px-2 py-1 transition no-underline whitespace-nowrap ${ap.startsWith('/post-job') ? 'text-brand-500 font-semibold' : 'text-brand-500 hover:text-brand-600'}">+ 发布</a>`;
  const mobileNav = navItems.map(n =>
    `<a href="${n.href}" class="block px-4 py-2 text-sm no-underline ${isActive(n.href) ? 'text-brand-500 bg-brand-50 font-semibold' : 'text-surface-600 hover:bg-brand-50 hover:text-brand-500'}">${n.label}</a>`
  ).join('\n          ');
  const postJobMobile = `<a href="/post-job" class="block px-4 py-2 text-sm no-underline ${ap.startsWith('/post-job') ? 'text-brand-500 bg-brand-50 font-semibold' : 'text-brand-500 hover:bg-brand-50 hover:text-brand-600'}">+ 发布</a>`;

  const meLabel = user?.name ? escapeHtml(user.name) : '我的';
  const isAdminPath = ap.startsWith('/admin') || ap === '/users' || ap.startsWith('/users/');
  const adminNavDesktop = user?.role === 'admin'
    ? `<a href="/users" class="text-sm px-2 py-1 transition no-underline whitespace-nowrap ${isAdminPath ? 'text-brand-500 font-semibold' : 'text-surface-600 hover:text-brand-500'}">管理</a>`
    : '';
  const adminNavMobile = user?.role === 'admin'
    ? `<a href="/users" class="block px-4 py-2 text-sm no-underline ${isAdminPath ? 'text-brand-500 bg-brand-50 font-semibold' : 'text-surface-600 hover:bg-brand-50 hover:text-brand-500'}">管理</a>`
    : '';
  const authNavDesktop = user
    ? `<a href="/account" class="text-sm px-2 py-1 transition no-underline whitespace-nowrap ${ap.startsWith('/account') ? 'text-brand-500 font-semibold' : 'text-surface-600 hover:text-brand-500'}">${meLabel}</a>`
    : `<a href="/login" class="text-sm px-2 py-1 transition no-underline whitespace-nowrap ${ap.startsWith('/login') ? 'text-brand-500 font-semibold' : 'text-surface-600 hover:text-brand-500'}">登录</a>`;

  const authNavMobile = user
    ? `<a href="/account" class="block px-4 py-2 text-sm no-underline ${ap.startsWith('/account') ? 'text-brand-500 bg-brand-50 font-semibold' : 'text-surface-600 hover:bg-brand-50 hover:text-brand-500'}">${meLabel}</a>`
    : `<a href="/login" class="block px-4 py-2 text-sm no-underline ${ap.startsWith('/login') ? 'text-brand-500 bg-brand-50 font-semibold' : 'text-surface-600 hover:bg-brand-50 hover:text-brand-500'}">登录</a>`;

  // Company logos are served from the static CDN; warm the connection early now
  // that nothing else in <head> opens it.
  const cdnStatic = (options?.staticUrl || '').trim().replace(/\/$/, '');
  const cdnPreconnect = cdnStatic ? `\n  <link rel="preconnect" href="${cdnStatic}" crossorigin>\n  <link rel="dns-prefetch" href="${cdnStatic}">` : '';
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fullTitle}</title>
  <meta name="description" content="${desc}">
  <meta name="keywords" content="${keywords}">
  <meta name="robots" content="${robots}">
  <meta property="og:type" content="${ogType}">
  <meta property="og:title" content="${fullTitle}">
  <meta property="og:description" content="${desc}">
  <meta property="og:site_name" content="远程岛">
  <meta property="og:locale" content="zh_CN">${ogImageMeta}${canonical ? `\n  <meta property="og:url" content="${options?.canonical}">` : ''}
  <meta name="twitter:card" content="${twitterCard}">
  <meta name="twitter:title" content="${fullTitle}">
  <meta name="twitter:description" content="${desc}">${canonical}${ga}${jsonLd}
  <link rel="alternate" type="application/rss+xml" title="远程岛 - 最新远程职位" href="/feed.xml">
  <link rel="icon" href="/favicon.ico" type="image/x-icon">${cdnPreconnect}
  <link rel="stylesheet" href="/css/${appStylesAssetFilename}">
</head>
<body class="bg-surface-50 text-surface-900 min-h-screen">
  <header class="bg-white border-b border-surface-200 sticky top-0 z-50">
    <div class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
      <div class="flex items-center gap-4 sm:gap-6 min-w-0">
        <a href="/" class="flex items-center gap-2 no-underline flex-shrink-0">
          <img src="/yuanchengdao-logo.png" alt="远程岛" class="h-8" width="64" height="32" fetchpriority="high" decoding="async">
        </a>
        <nav class="hidden sm:flex items-center gap-4 text-sm">
          ${desktopNav}
          ${postJobDesktop}
        </nav>
      </div>
      <div class="flex items-center gap-2 sm:gap-4">
        <div class="hidden sm:flex items-center gap-4">
          ${adminNavDesktop}
          ${authNavDesktop}
        </div>
        <div class="relative sm:hidden">
          <button id="mobile-menu-btn" class="p-2 text-surface-600 hover:text-brand-500 transition" aria-label="菜单">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
          <div id="mobile-menu" class="hidden absolute right-0 top-full mt-1 w-40 bg-white rounded shadow-lg border border-surface-200 py-1 z-50">
            ${mobileNav}
            ${postJobMobile}
            ${adminNavMobile}
            ${authNavMobile}
          </div>
        </div>
      </div>
    </div>
  </header>

  ${content}

  <footer class="border-t border-surface-200 bg-white mt-16">
    <div class="max-w-5xl mx-auto px-4 py-8 text-sm text-surface-400">
      <div class="flex flex-row items-center justify-between gap-4">
        <div class="text-left space-y-2 min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span class="text-surface-500">© ${new Date().getFullYear()}</span>
            <a href="/" class="ml-2 no-underline text-surface-400 hover:text-brand-500 transition inline-flex items-center flex-shrink-0">远程岛</a>
            <a href="/about" class="ml-2 no-underline transition ${ap.startsWith('/about') ? 'text-brand-500 font-medium' : 'text-surface-400 hover:text-brand-500'}">关于</a>
            <a href="/feedback" class="ml-2 no-underline transition ${ap.startsWith('/feedback') ? 'text-brand-500 font-medium' : 'text-surface-400 hover:text-brand-500'}">意见反馈</a>
            <a href="/weekly-reports" class="ml-2 no-underline transition ${ap.startsWith('/weekly-reports') ? 'text-brand-500 font-medium' : 'text-surface-400 hover:text-brand-500'}">周报</a>
            <a href="/salary-report" class="ml-2 no-underline transition ${ap.startsWith('/salary-report') ? 'text-brand-500 font-medium' : 'text-surface-400 hover:text-brand-500'}">薪资</a>
            <a href="/jobs/english-none" class="ml-2 no-underline transition ${ap.startsWith('/jobs/english-') ? 'text-brand-500 font-medium' : 'text-surface-400 hover:text-brand-500'}">未标明英语要求</a>
            <a href="/jobs/chinese" class="ml-2 no-underline transition ${ap.startsWith('/jobs/chinese') ? 'text-brand-500 font-medium' : 'text-surface-400 hover:text-brand-500'}">中文岗位</a>
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
