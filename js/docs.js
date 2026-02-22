import { AppState } from './state.js';
import { escHtml } from './ui.js';

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
  // Build nav
  var navHtml = AppState.docs.map(function(s) {
    var isSub = s.level >= 3;
    var label = s.title.replace(/\s+/g, ' ').trim();
    if (label.length > 36) label = label.slice(0, 34) + '…';
    return '<a class="docs-nav-item' + (isSub ? ' sub' : '') + '" href="#" onclick="scrollToDocSection(\'' + s.id + '\');return false;" data-doc-id="' + s.id + '">' + escHtml(label) + '</a>';
  }).join('');
  navList.innerHTML = navHtml;
  // Build content
  var contentHtml = AppState.docs.map(function(s) {
    return '<div class="docs-section" id="doc-sec-' + s.id + '">' +
      '<a class="docs-section-anchor" id="' + s.id + '"></a>' +
      s.contentHtml +
      '</div>';
      }).join('\n');  container.innerHTML = contentHtml;
  // Highlight first nav item
  var firstNav = navList.querySelector('.docs-nav-item');
  if (firstNav) firstNav.classList.add('active');
}

export function scrollToDocSection(id) {
  var el = document.getElementById(id);
  if (el) {
    var mainEl = document.getElementById('main');
    mainEl.scrollTo({ top: el.offsetTop - 60, behavior: 'smooth' });
  }
}

export function updateDocsActiveNav() {
  var navItems = document.querySelectorAll('#docs-nav-list .docs-nav-item');
  var mainEl = document.getElementById('main');
  var scrollTop = mainEl.scrollTop;
  var activeId = null;
  navItems.forEach(function(item) {
    var docId = item.getAttribute('data-doc-id');
    var target = document.getElementById(docId);
    if (target && target.offsetTop - 80 <= scrollTop) {
      activeId = docId;
    }
    item.classList.remove('active');
  });
  if (activeId) {
    var activeItem = document.querySelector('#docs-nav-list [data-doc-id="' + activeId + '"]');
    if (activeItem) activeItem.classList.add('active');
  }
}
