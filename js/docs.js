import { AppState } from './state.js';
import { escHtml } from './ui.js';
import { renderMermaidInContainer, parseMarkdown } from './render.js';

export function renderDocs() {
  var container = document.getElementById('docs-content');
  var navList = document.getElementById('docs-nav-list');
  if (!AppState.docs || !AppState.docs.length) {
    container.innerHTML = '<div class="docs-empty-state">' +
      '<div class="empty-icon"><i class="fa-solid fa-file-lines"></i></div>' +
      '<h3>No documentation loaded</h3>' +
      '<p>Import a JSON file containing a <code>docs</code> array to view the technical design document here.</p>' +
      '</div>';
    navList.innerHTML = '';
    return;
  }

  var search = (document.getElementById('search-docs') || {}).value || '';
  search = search.toLowerCase();

  // 1. Prepare Doc Sections
  var sections = JSON.parse(JSON.stringify(AppState.docs));
  
  // 2. Inject Approved Suggestions
  var approved = AppState.suggestions.filter(s => s.status === 'approved');
  if (approved.length) {
    var appendixIdx = sections.findIndex(s => s.title.toLowerCase().includes('appendix a'));
    if (appendixIdx === -1) appendixIdx = sections.length;

    var grouped = {};
    approved.forEach(s => {
      var catId = s.categoryId || 'uncategorized';
      if (!grouped[catId]) grouped[catId] = [];
      grouped[catId].push(s);
    });

    var injectedSections = [];
    Object.keys(grouped).forEach(catId => {
      var catName = 'New Module';
      if (catId.startsWith('doc:')) {
        var ref = AppState.docs.find(d => d.id === catId.slice(4));
        catName = ref ? ref.title.replace(/^\d+\.\s+/, '') : catName;
      } else {
        var cat = AppState.categories.find(c => c.id === catId);
        catName = cat ? cat.name : catName;
      }

      var contentHtml = `<h2 class="docs-injected-header">${escHtml(catName)}</h2>`;
      grouped[catId].forEach(s => {
        contentHtml += `
          <div class="docs-suggestion-block">
            <h3>${escHtml(s.title)}</h3>
            <div class="docs-suggestion-body">${parseMarkdown(s.body)}</div>
          </div>
        `;
      });

      injectedSections.push({
        id: 'injected-' + catId,
        title: catName,
        level: 2,
        contentHtml: contentHtml,
        isInjected: true
      });
    });

    sections.splice(appendixIdx, 0, ...injectedSections);
  }

  // 3. Filter by Search
  if (search) {
    sections = sections.filter(s => {
      var haystack = (s.title + ' ' + s.contentHtml).toLowerCase();
      return haystack.indexOf(search) !== -1;
    });
  }

  if (sections.length === 0 && search) {
    container.innerHTML = '<div class="docs-empty-state"><h3>No matches found</h3><p>Try a different search term.</p></div>';
    navList.innerHTML = '';
    return;
  }

  // 4. Build Nav
  var navHtml = sections.map(function(s) {
    var isSub = s.level >= 3;
    var label = s.title.replace(/\s+/g, ' ').trim();
    if (label.length > 36) label = label.slice(0, 34) + '…';
    return `<a class="docs-nav-item${isSub ? ' sub' : ''}" href="#" onclick="scrollToDocSection('${s.id}');return false;" data-doc-id="${s.id}">${escHtml(label)}</a>`;
  }).join('');
  navList.innerHTML = navHtml;

  // 5. Build Content
  var contentHtml = sections.map(function(s) {
    return '<div class="docs-section" id="doc-sec-' + s.id + '">' +
      '<a class="docs-section-anchor" id="' + s.id + '"></a>' +
      s.contentHtml +
      '</div>';
  }).join('\n');
  container.innerHTML = contentHtml;

  // 6. Setup Intersection Observer for Scroll-Spy
  setupDocsObserver();
}

var docsObserver = null;
var intersectingSections = new Set();

function setupDocsObserver() {
  if (docsObserver) docsObserver.disconnect();
  intersectingSections.clear();

  var docsContainer = document.getElementById('docs-content');
  if (!docsContainer) return;

  docsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        intersectingSections.add(entry.target.id);
      } else {
        intersectingSections.delete(entry.target.id);
      }
    });

    updateActiveNavItem();
  }, {
    root: document.getElementById('main'),
    threshold: [0, 0.1],
    rootMargin: '-5% 0px -70% 0px'
  });

  document.querySelectorAll('.docs-section').forEach(sec => docsObserver.observe(sec));
}

function updateActiveNavItem() {
  var sections = Array.from(intersectingSections);
  if (!sections.length) return;

  var activeId = sections.reduce((closest, current) => {
    var closestEl = document.getElementById(closest);
    var currentEl = document.getElementById(current);
    if (!closestEl || !currentEl) return closest;
    return currentEl.getBoundingClientRect().top < closestEl.getBoundingClientRect().top ? current : closest;
  });

  var docId = activeId.replace('doc-sec-', '');
  document.querySelectorAll('#docs-nav-list .docs-nav-item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-doc-id') === docId);
  });
}

export function scrollToDocSection(id) {
  var el = document.getElementById('doc-sec-' + id);
  if (el) {
    var mainEl = document.getElementById('main');
    var offset = 70;
    var targetScroll = el.offsetTop - offset;
    mainEl.scrollTo({ top: targetScroll, behavior: 'smooth' });
  }
}

export function updateDocsActiveNav() {}
