import { AppState, UI } from './state.js';
import { getCatById, showModal, closeModal, showToast, escHtml } from './ui.js';
import { saveData } from './storage.js';
import { renderPage } from './render.js';
import { openEditor } from './editor.js';

export function openCategoryPicker() {
  UI.editingId = null;
  UI.selectedCatId = null;
  UI.pendingAttachments = [];
  var input = document.getElementById('cat-search-input');
  if (input) input.value = '';
  renderCatOptions('');
  showModal('modal-cat-picker');
}

export function renderCatOptions(filter) {
  var list = document.getElementById('cat-options-list');
  if (!list) return;
  var fl = filter ? filter.toLowerCase() : '';

  // Suggestion categories
  var cats = AppState.categories.filter(function(c){
    return !fl || c.name.toLowerCase().indexOf(fl) !== -1;
  });

  // Doc sections (level 2 only — the main chapters)
  var docSections = (AppState.docs || []).filter(function(s){
    return s.level === 2 && (!fl || s.title.toLowerCase().indexOf(fl) !== -1);
  });

  if (!cats.length && !docSections.length) {
    list.innerHTML = '<div style="padding:16px;text-align:center;font-size:12px;color:var(--text-muted)">No categories found. Click + to create one.</div>';
    return;
  }

  var html = '';

  if (cats.length) {
    html += '<div class="cat-group-label">Suggestion Categories</div>';
    html += cats.map(function(c) {
      var count = AppState.suggestions.filter(function(s){ return s.categoryId === c.id; }).length;
      return '<div class="cat-option' + (UI.selectedCatId === c.id ? ' selected' : '') + '" onclick="selectCat(\'' + c.id + '\', this)">' +
        '<span class="cat-emoji-badge">' + escHtml(c.emoji||'🗂️') + '</span>' +
        '<span class="cat-name">' + escHtml(c.name) + '</span>' +
        '<span class="cat-sub">' + count + ' suggestion' + (count !== 1 ? 's' : '') + '</span>' +
        '</div>';
    }).join('');
  }

  if (docSections.length) {
    html += '<div class="cat-group-label"><i class="fa-solid fa-book" style="margin-right:5px;"></i>Documentation Sections</div>';
    html += docSections.map(function(s) {
      var docId = 'doc:' + s.id;
      var count = AppState.suggestions.filter(function(sg){ return sg.categoryId === docId; }).length;
      // Strip leading number like "3. " from title
      var title = s.title.replace(/^\d+\.\s+/, '');
      return '<div class="cat-option doc-cat' + (UI.selectedCatId === docId ? ' selected' : '') + '" onclick="selectCat(\'' + docId + '\', this)">' +
        '<span class="cat-emoji-badge"><i class="fa-solid fa-file-lines" style="font-size:14px;color:var(--accent);"></i></span>' +
        '<span class="cat-name">' + escHtml(title) + '</span>' +
        '<span class="cat-sub">' + count + ' suggestion' + (count !== 1 ? 's' : '') + '</span>' +
        '</div>';
    }).join('');
  }

  list.innerHTML = html;
}

export function filterCatOptions(val) { renderCatOptions(val); }

export function selectCat(id, el) {
  UI.selectedCatId = id;
  document.querySelectorAll('.cat-option').forEach(function(e){ e.classList.remove('selected'); });
  el.classList.add('selected');
}

export function proceedToEditor() {
  if (!UI.selectedCatId) {
    showToast('Please select a category first.', 'error');
    return;
  }
  closeModal('modal-cat-picker');
  openEditor(null);
}

export function openNewCatModal() {
  var nameInp = document.getElementById('new-cat-name');
  if (nameInp) nameInp.value = '';
  UI.newCatEmojiSelected = '🗂️';
  var preview = document.getElementById('new-cat-emoji-preview');
  if (preview) preview.textContent = '🗂️';
  showModal('modal-new-cat');
}

export function saveNewCategory() {
  var nameInp = document.getElementById('new-cat-name');
  var name = nameInp ? nameInp.value.trim() : '';
  if (!name) { showToast('Category name required.', 'error'); return; }
  var cat = { id: 'cat_' + Date.now(), name: name, emoji: UI.newCatEmojiSelected };
  AppState.categories.push(cat);
  saveData();
  renderCatNav();
  closeModal('modal-new-cat');
  UI.selectedCatId = cat.id;
  var searchInp = document.getElementById('cat-search-input');
  renderCatOptions(searchInp ? searchInp.value : '');
  showToast('Category "' + name + '" created!', 'success');
}

export function renderCatNav() {
  var list = document.getElementById('cat-nav-list');
  if (!list) return;
  var allCount = AppState.suggestions.filter(function(s){ return s.status === UI.currentView; }).length;
  var countAll = document.getElementById('cat-count-all');
  if (countAll) countAll.textContent = allCount;

  var html = '';

  // Regular suggestion categories
  var usedCats = AppState.categories.filter(function(c) {
    return AppState.suggestions.some(function(s){ return s.categoryId === c.id; });
  });
  if (usedCats.length) {
    usedCats.forEach(function(c) {
      var count = AppState.suggestions.filter(function(s){ return s.categoryId === c.id && s.status === UI.currentView; }).length;
      html += '<button class="cat-nav-item' + (UI.currentCatFilter === c.id ? ' active' : '') + '" onclick="filterCategory(\'' + c.id + '\', this)" data-cat="' + c.id + '">' +
        '<span class="cat-emoji" style="font-size:13px;">' + escHtml(c.emoji || '🗂️') + '</span>' +
        '<span>' + escHtml(c.name) + '</span>' +
        '<span class="cat-count">' + count + '</span>' +
        '</button>';
    });
  }

  // Doc-section categories (suggestions with categoryId starting "doc:")
  var docCatIds = [];
  AppState.suggestions.forEach(function(s) {
    if (s.categoryId && s.categoryId.startsWith('doc:') && docCatIds.indexOf(s.categoryId) === -1) {
      docCatIds.push(s.categoryId);
    }
  });
  if (docCatIds.length) {
    html += '<div class="sidebar-section-label" style="margin-top:8px;"><i class="fa-solid fa-book" style="margin-right:4px;opacity:0.6;"></i>Doc Sections</div>';
    docCatIds.forEach(function(docCatId) {
      var cat = getCatById(docCatId);
      if (!cat) return;
      var count = AppState.suggestions.filter(function(s){ return s.categoryId === docCatId && s.status === UI.currentView; }).length;
      html += '<button class="cat-nav-item' + (UI.currentCatFilter === docCatId ? ' active' : '') + '" onclick="filterCategory(\'' + docCatId + '\', this)" data-cat="' + docCatId + '">' +
        '<i class="fa-solid fa-file-lines" style="font-size:11px;color:var(--accent);flex-shrink:0;"></i>' +
        '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escHtml(cat.name) + '</span>' +
        '<span class="cat-count">' + count + '</span>' +
        '</button>';
    });
  }

  list.innerHTML = html;
}

export function filterCategory(catId, btn) {
  UI.currentCatFilter = catId;
  document.querySelectorAll('.cat-nav-item').forEach(function(b){ b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  renderPage();
  var sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.remove('open');
}

export function updateCounts() {
  ['pending','approved','rejected','archived'].forEach(function(v) {
    var el = document.getElementById('count-' + v);
    if (el) el.textContent = AppState.suggestions.filter(function(s){ return s.status === v; }).length;
  });
  var hEl = document.getElementById('count-history');
  if (hEl) hEl.textContent = AppState.history.length;
}
