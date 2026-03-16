function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

export const appScript = `
/* Job row expand/collapse */
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

/* GA: track search */
(function() {
  var params = new URLSearchParams(window.location.search);
  var q = params.get('q');
  if (q && typeof gtag === 'function') {
    gtag('event', 'search', { search_term: q });
  }
})();

/* GA: track apply clicks */
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

/* Filter dropdowns */
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
      if (openPanel && openPanel !== panel) {
        openPanel.classList.add('hidden');
      }
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
        if (val) {
          url.searchParams.set(param, val);
        } else {
          url.searchParams.delete(param);
        }
        window.location.href = url.toString();
      });
    });
  });

  document.addEventListener('click', function() {
    if (openPanel) {
      openPanel.classList.add('hidden');
      openPanel = null;
    }
  });
})();
`;

export const appScriptVersion = simpleHash(appScript);
