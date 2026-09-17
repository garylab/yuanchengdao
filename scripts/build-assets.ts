import { minify as terserMinify } from 'terser';
import CleanCSS from 'clean-css';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '../src/public/generated');

function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

const rawCss = `
body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
.job-row-header:hover { background-color: #fef3ec; }
.job-row-header { transition: background-color 0.15s ease; }
.job-row.expanded .job-row-header { background-color: #fef3ec; }
.job-row.visited .job-row-header { background-color: #fef3ec; }
.tag-pill { display: inline-block; padding: 0.125rem 0.5rem; font-size: 0.75rem; line-height: 1rem; border-radius: 0.25rem; }
`;

const rawJs = `
document.addEventListener('click', function(e) {
  var collapse = e.target.closest('.job-collapse');
  if (collapse) {
    var row = collapse.closest('.job-row');
    row.classList.remove('expanded');
    row.classList.add('visited');
    row.querySelector('.job-expand').classList.add('hidden');
    return;
  }
  var link = e.target.closest('.job-row-header a');
  if (link) return;
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

(function() {
  var params = new URLSearchParams(window.location.search);
  var q = params.get('q');
  if (q && typeof gtag === 'function') {
    gtag('event', 'search', { search_term: q });
  }
})();

document.addEventListener('click', function(e) {
  var btn = e.target.closest('.apply-btn');
  if (btn && typeof gtag === 'function') {
    gtag('event', 'apply_click', {
      from: btn.dataset.from || '',
      job_title: btn.dataset.job || '',
      company: btn.dataset.company || '',
      url: btn.href || ''
    });
  }
});

(function() {
  var btn = document.getElementById('mobile-menu-btn');
  var menu = document.getElementById('mobile-menu');
  if (btn && menu) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      menu.classList.toggle('hidden');
    });
    document.addEventListener('click', function() {
      menu.classList.add('hidden');
    });
  }
})();

(function() {
  var btn = document.getElementById('share-btn');
  if (!btn) return;
  btn.addEventListener('click', function() {
    var title = document.title;
    var url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: title, url: url }).catch(function() {});
    } else {
      navigator.clipboard.writeText(url).then(function() {
        var orig = btn.innerHTML;
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> \\u5df2\\u590d\\u5236';
        setTimeout(function() { btn.innerHTML = orig; }, 2000);
      }).catch(function() {});
    }
  });
})();

(function() {
  var openPanel = null;
  document.querySelectorAll('.filter-dropdown').forEach(function(dd) {
    var btn = dd.querySelector('.filter-btn');
    var panel = dd.querySelector('.filter-panel');
    var search = dd.querySelector('.filter-search');
    var options = dd.querySelectorAll('.filter-option');
    var param = dd.dataset.param;
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (openPanel && openPanel !== panel) { openPanel.classList.add('hidden'); }
      panel.classList.toggle('hidden');
      openPanel = panel.classList.contains('hidden') ? null : panel;
      if (search && !panel.classList.contains('hidden')) {
        search.value = '';
        options.forEach(function(o) { o.style.display = ''; });
        search.focus();
      }
    });
    if (search) {
      search.addEventListener('input', function() {
        var q = this.value.toLowerCase();
        options.forEach(function(o) {
          var label = (o.dataset.label || o.textContent || '').toLowerCase();
          o.style.display = label.indexOf(q) >= 0 ? '' : 'none';
        });
      });
      search.addEventListener('click', function(e) { e.stopPropagation(); });
    }
    options.forEach(function(o) {
      o.addEventListener('click', function(e) {
        e.stopPropagation();
        var val = this.dataset.value;
        var url = new URL(window.location.href);
        url.searchParams.delete('page');
        if (val) { url.searchParams.set(param, val); } else { url.searchParams.delete(param); }
        window.location.href = url.toString();
      });
    });
  });
  document.addEventListener('click', function() {
    if (openPanel) { openPanel.classList.add('hidden'); openPanel = null; }
  });
})();

(function() {
  document.querySelectorAll('.qr-hover-wrap').forEach(function(wrap) {
    var pop = wrap.querySelector('.qr-hover-popover');
    var loaded = false;
    wrap.addEventListener('mouseenter', function() {
      if (!loaded) {
        var src = pop.dataset.qrSrc;
        if (src) {
          var img = document.createElement('img');
          img.alt = 'QR Code';
          img.style.cssText = 'width:176px;height:176px;object-fit:contain';
          pop.insertBefore(img, pop.firstChild);
          img.src = src;
        }
        loaded = true;
      }
      pop.classList.remove('hidden');
    });
    wrap.addEventListener('mouseleave', function() { pop.classList.add('hidden'); });
  });
})();

document.addEventListener('click', function(e) {
  var btn = e.target.closest('.favorite-btn');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  if (btn.dataset.loginRequired === '1') {
    window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname + window.location.search);
    return;
  }
  var jobId = btn.dataset.jobId;
  if (!jobId) return;
  var favorited = btn.dataset.favorited === '1';
  var method = favorited ? 'DELETE' : 'POST';
  btn.disabled = true;
  fetch('/api/favorites/' + jobId, { method: method, credentials: 'same-origin' })
    .then(function(response) {
      if (response.status === 401) {
        window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname + window.location.search);
        return null;
      }
      return response.json().then(function(data) {
        return { ok: response.ok, data: data };
      });
    })
    .then(function(result) {
      if (!result) return;
      if (!result.ok) return;
      var nextFavorited = !favorited;
      btn.dataset.favorited = nextFavorited ? '1' : '0';
      var label = btn.querySelector('span');
      if (label) label.textContent = nextFavorited ? '\\u5df2\\u6536\\u85cf' : '\\u6536\\u85cf';
      var icon = btn.querySelector('svg');
      if (icon) icon.setAttribute('fill', nextFavorited ? 'currentColor' : 'none');
      btn.classList.toggle('text-brand-500', nextFavorited);
      btn.classList.toggle('border-brand-200', nextFavorited);
      btn.classList.toggle('bg-brand-50', nextFavorited);
    })
    .finally(function() { btn.disabled = false; });
});
`;

async function build() {
  const { mkdirSync } = await import('fs');
  mkdirSync(outDir, { recursive: true });

  const minCss = new CleanCSS({ level: 2 }).minify(rawCss).styles;
  const cssHash = simpleHash(minCss);

  const jsResult = await terserMinify(rawJs, {
    compress: { passes: 2 },
    mangle: true,
    format: { comments: false },
  });
  const minJs = jsResult.code || '';
  const jsHash = simpleHash(minJs);

  const generated = `export const appStyles = ${JSON.stringify(minCss)};
export const appStylesAssetFilename = ${JSON.stringify(`app.${cssHash}.css`)};
export const appScript = ${JSON.stringify(minJs)};
export const appScriptAssetFilename = ${JSON.stringify(`app.${jsHash}.js`)};
`;

  writeFileSync(resolve(outDir, 'assets.ts'), generated);

  const rawCssSize = Buffer.byteLength(rawCss);
  const rawJsSize = Buffer.byteLength(rawJs);
  const minCssSize = Buffer.byteLength(minCss);
  const minJsSize = Buffer.byteLength(minJs);
  console.log(`CSS: ${rawCssSize}B → ${minCssSize}B (${Math.round((1 - minCssSize / rawCssSize) * 100)}% saved)`);
  console.log(`JS:  ${rawJsSize}B → ${minJsSize}B (${Math.round((1 - minJsSize / rawJsSize) * 100)}% saved)`);
  console.log(`Generated: src/public/generated/assets.ts`);
}

build();
