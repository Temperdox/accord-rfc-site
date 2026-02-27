import { AppState, GH } from './state.js';
import { escHtml } from './ui.js';
import { renderMermaidInContainer, parseMarkdown, hydrateGhAttachments } from './render.js';
import { getRawGhUrl } from './github.js';

export function renderDocs() {
  var container = document.getElementById('docs-content');
  var navList = document.getElementById('docs-nav-list');
  var searchWrap = document.querySelector('#page-docs .page-filter-bar');
  
  if (!AppState.docs || !AppState.docs.length) {
    if (container) {
      container.innerHTML = '<div class="docs-empty-state">' +
        '<div class="empty-icon"><i class="fa-solid fa-file-lines"></i></div>' +
        '<h3>No documentation loaded</h3>' +
        '<p>Import a JSON file containing a <code>docs</code> array to view the technical design document here.</p>' +
        '</div>';
    }
    if (navList) navList.innerHTML = '';
    return;
  }

  var searchVal = (document.getElementById('search-docs') || {}).value || '';
  var search = searchVal.toLowerCase();

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
        var sAttHtml = '';
        if (s.attachments && s.attachments.length) {
          s.attachments.forEach(a => {
            var src = getRawGhUrl(a.data);
            var dataAttr = (GH.isPrivate && !a.data.startsWith('data:')) ? ' data-gh-path="' + escHtml(a.data) + '"' : '';
            if (a.type === 'image') {
              sAttHtml += `<div class="docs-suggestion-att"><img src="${src}"${dataAttr} alt="attachment"></div>`;
            } else if (a.type === 'video') {
              sAttHtml += `<div class="docs-suggestion-att"><video src="${src}"${dataAttr} controls></video></div>`;
            }
          });
        }
        contentHtml += `
          <div class="docs-suggestion-block">
            <h3>${escHtml(s.title)}</h3>
            <div class="docs-suggestion-body">${parseMarkdown(s.body)}</div>
            ${sAttHtml}
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
  var filteredSections = sections;
  if (search) {
    filteredSections = sections.filter(s => {
      var haystack = (s.title + ' ' + s.contentHtml).toLowerCase();
      return haystack.indexOf(search) !== -1;
    });
  }

  // 4. Build Nav (Always use full or filtered list for nav)
  var navHtml = filteredSections.map(function(s) {
    var isSub = s.level >= 3;
    var label = s.title.replace(/\s+/g, ' ').trim();
    if (label.length > 36) label = label.slice(0, 34) + '…';
    return `<a class="docs-nav-item${isSub ? ' sub' : ''}" href="#" onclick="scrollToDocSection('${s.id}');return false;" data-doc-id="${s.id}">${escHtml(label)}</a>`;
  }).join('');
  if (navList) navList.innerHTML = navHtml;

  // 5. Build Content with Search Bar Injection
  if (container) {
    container.innerHTML = '';
    
    if (filteredSections.length === 0 && search) {
      if (searchWrap) container.appendChild(searchWrap);
      container.innerHTML += '<div class="docs-empty-state"><h3>No matches found</h3><p>Try a different search term.</p></div>';
    } else {
      filteredSections.forEach((s, idx) => {
        var secEl = document.createElement('div');
        secEl.className = 'docs-section';
        secEl.id = 'doc-sec-' + s.id;
        secEl.innerHTML = `<a class="docs-section-anchor" id="${s.id}"></a>${s.contentHtml}`;
        container.appendChild(secEl);
        
        // Inject Search Bar after the first section (the title)
        if (idx === 0 && searchWrap) {
          container.appendChild(searchWrap);
        }
      });
    }
  }

  // 6. Setup Intersection Observer for Scroll-Spy
  setupDocsObserver();
  hydrateGhAttachments(container);
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
  var targetNav = document.querySelector(`#docs-nav-list [data-doc-id="${docId}"]`);
  
  if (targetNav && !targetNav.classList.contains('active')) {
    document.querySelectorAll('#docs-nav-list .docs-nav-item').forEach(el => el.classList.remove('active'));
    targetNav.classList.add('active');
  }
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
