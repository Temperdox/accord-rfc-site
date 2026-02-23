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

  // 3. Build Nav
  var navHtml = sections.map(function(s) {
    var isSub = s.level >= 3;
    var label = s.title.replace(/\s+/g, ' ').trim();
    if (label.length > 36) label = label.slice(0, 34) + '…';
    return `<a class="docs-nav-item${isSub ? ' sub' : ''}" href="#" onclick="scrollToDocSection('${s.id}');return false;" data-doc-id="${s.id}">${escHtml(label)}</a>`;
  }).join('');
  navList.innerHTML = navHtml;

  // 4. Build Content
  var contentHtml = sections.map(function(s) {
    return '<div class="docs-section" id="doc-sec-' + s.id + '">' +
      '<a class="docs-section-anchor" id="' + s.id + '"></a>' +
      s.contentHtml +
      '</div>';
  }).join('\n');
  container.innerHTML = contentHtml;

  // 5. Setup Intersection Observer for Scroll-Spy
  setupDocsObserver();
}

var docsObserver = null;
var intersectingSections = new Set();

function setupDocsObserver() {
  if (docsObserver) docsObserver.disconnect();
  intersectingSections.clear();

  docsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        intersectingSections.add(entry.target.id);
      } else {
        intersectingSections.delete(entry.target.id);
      }
    });

    // Determine the active section
    updateActiveNavItem();
  }, {
    root: document.getElementById('main'),
    threshold: [0, 0.1],
    rootMargin: '-5% 0px -70% 0px' // Target the top quarter of the screen
  });

  document.querySelectorAll('.docs-section').forEach(sec => docsObserver.observe(sec));
}

function updateActiveNavItem() {
  var sections = Array.from(intersectingSections);
  if (!sections.length) return;

  // If multiple are intersecting, the one with the smallest (most top) bounding box wins
  var activeId = sections.reduce((closest, current) => {
    var closestEl = document.getElementById(closest);
    var currentEl = document.getElementById(current);
    if (!closestEl || !currentEl) return closest;
    
    return currentEl.getBoundingClientRect().top < closestEl.getBoundingClientRect().top 
      ? current 
      : closest;
  });

  var docId = activeId.replace('doc-sec-', '');
  document.querySelectorAll('#docs-nav-list .docs-nav-list .docs-nav-item').forEach(item => {
    item.classList.remove('active');
  });
  
  var targetNav = document.querySelector(`#docs-nav-list [data-doc-id="${docId}"]`);
  if (targetNav) {
    // Only update if it's actually different to prevent flicker
    if (!targetNav.classList.contains('active')) {
      document.querySelectorAll('#docs-nav-list .docs-nav-item').forEach(el => el.classList.remove('active'));
      targetNav.classList.add('active');
    }
  }
}

export function scrollToDocSection(id) {
  var el = document.getElementById('doc-sec-' + id);
  if (el) {
    var mainEl = document.getElementById('main');
    // Use a fixed offset to account for the topbar
    var offset = 70;
    var targetScroll = el.offsetTop - offset;
    mainEl.scrollTo({ top: targetScroll, behavior: 'smooth' });
  }
}

export function updateDocsActiveNav() {
  // Now handled by setupDocsObserver/updateActiveNavItem logic
}
