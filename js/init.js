import '../css/style.css';
import '../css/variables.css';
import '../css/layout.css';
import '../css/components.css';
import '../css/cards.css';
import '../css/modals.css';
import '../css/editor.css';
import '../css/docs.css';
import '../css/download.css';
import '../css/responsive.css';

import { AppState, UI } from './state.js';
import { loadData } from './storage.js';
import { ghLoadConfig, ghTestConnection, ghSaveConfig, ghPull, ghPush, togglePatVisibility, toggleGhConfig, ghCheckForUpdates } from './github.js';
import { renderEmojiGrids, toggleTheme, openSettings, saveSettings, toggleEmojiPicker, onTagInput, hideSugAfterDelay, openDataModal, closeModal, selectEmoji, selectTag, toggleSidebar, openNotifications, clearNotifications, updateNotifBadge } from './ui.js';
import { updateCounts, renderCatNav, openCategoryPicker, filterCatOptions, saveNewCategory, openNewCatModal, selectCat, proceedToEditor, filterCategory } from './categories.js';
import { renderPage, renderHistory, renderMermaidInContainer } from './render.js';
import { renderInfoBoxes, tbInsert, togglePreview, triggerAttach, handleDropZoneFiles, confirmCodeInsert, openCodeInsert, saveSuggestion, removeAttachment } from './editor.js';
import { confirmAction, executeConfirmAction } from './actions.js';
import { renderDocs, scrollToDocSection, updateDocsActiveNav } from './docs.js';
import { renderDownloadPage } from './download.js';
import { exportZip, importZip, openPasteJson, loadPastedJson, pickSaveFolder } from './data.js';

// Global attach functions to window for onclick handlers
window.setView = (view, btn) => {
  UI.currentView = view;
  document.querySelectorAll('.sidebar-btn').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('active'); });
  document.getElementById('page-' + view).classList.add('active');
  renderCatNav();
  if (view === 'history') renderHistory();
  else renderPage();
  var sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.remove('open');
  window.scrollTo(0, 0);
};

window.renderDownloadPage = renderDownloadPage;

window.filterCategory = filterCategory;

window.switchMainTab = (tab) => {
  document.getElementById('tab-home').classList.toggle('active', tab === 'home');
  document.getElementById('tab-download').classList.toggle('active', tab === 'download');
  
  document.getElementById('sidebar-top-nav').classList.toggle('hidden', tab !== 'home');
  document.getElementById('download-nav-container').classList.toggle('hidden', tab === 'home');
  
  if (tab === 'home') {
    // Default to suggestions if home is selected
    window.switchPageTab('suggestions');
  } else {
    // Switch to download page
    document.getElementById('suggestions-sidebar-nav').classList.add('hidden');
    document.getElementById('docs-sidebar-nav').classList.add('hidden');
    document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('active'); });
    document.getElementById('page-download').classList.add('active');
    renderDownloadPage();
  }
};

window.switchPageTab = (tab) => {
  document.getElementById('sub-tab-docs').classList.toggle('active', tab === 'docs');
  document.getElementById('sub-tab-suggestions').classList.toggle('active', tab === 'suggestions');
  
  var sugNav = document.getElementById('suggestions-sidebar-nav');
  var docsNav = document.getElementById('docs-sidebar-nav');
  var mainEl = document.getElementById('main');
  
  if (tab === 'docs') {
    sugNav.classList.add('hidden');
    docsNav.classList.remove('hidden');
    ['pending','approved','rejected','archived','history','download'].forEach(function(v) {
      var p = document.getElementById('page-' + v);
      if (p) p.classList.remove('active');
    });
    var docsPage = document.getElementById('page-docs');
    docsPage.classList.add('active');
    renderDocs();
    renderMermaidInContainer(document.getElementById('docs-content'));
    
    if (!window._throttledDocsNav) {
      window._throttledDocsNav = debounce(updateDocsActiveNav, 100);
    }
    mainEl.addEventListener('scroll', window._throttledDocsNav, { passive: true });
  } else {
    sugNav.classList.remove('hidden');
    docsNav.classList.add('hidden');
    document.getElementById('page-docs').classList.remove('active');
    document.getElementById('page-download').classList.remove('active');
    if (window._throttledDocsNav) {
      mainEl.removeEventListener('scroll', window._throttledDocsNav);
    }
    var activeView = UI.currentView;
    ['pending','approved','rejected','archived','history'].forEach(function(v) {
      var p = document.getElementById('page-' + v);
      if (p) p.classList.toggle('active', v === activeView);
    });
    renderCatNav();
    if (activeView === 'history') renderHistory();
    else renderPage();
  }
  var sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.remove('open');
  window.scrollTo(0, 0);
};

window.scrollToDownload = (id) => {
  var el = document.getElementById('dl-section-' + id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
};

window.openDataModal = openDataModal;
window.openSettings = openSettings;
window.openNotifications = openNotifications;
window.clearNotifications = clearNotifications;
window.toggleSidebar = toggleSidebar;
window.toggleTheme = toggleTheme;
window.openCategoryPicker = openCategoryPicker;
window.renderPage = renderPage;
window.renderHistory = renderHistory;
window.confirmAction = confirmAction;
window.openEditor = (id) => openEditor(id);
window.closeModal = closeModal;
window.filterCatOptions = filterCatOptions;
window.openNewCatModal = openNewCatModal;
window.selectCat = selectCat;
window.proceedToEditor = proceedToEditor;
window.saveNewCategory = saveNewCategory;
window.toggleEmojiPicker = toggleEmojiPicker;
window.onTagInput = onTagInput;
window.hideSugAfterDelay = hideSugAfterDelay;
window.tbInsert = tbInsert;
window.triggerAttach = triggerAttach;
window.openCodeInsert = openCodeInsert;
window.togglePreview = togglePreview;
window.onDropZoneDragOver = (e) => { e.preventDefault(); document.getElementById('attach-drop-zone').classList.add('drag-over'); };
window.onDropZoneDragLeave = (e) => { document.getElementById('attach-drop-zone').classList.remove('drag-over'); };
window.onDropZoneDrop = (e) => {
  e.preventDefault();
  document.getElementById('attach-drop-zone').classList.remove('drag-over');
  handleDropZoneFiles(e.dataTransfer.files);
};
window.handleDropZoneFiles = handleDropZoneFiles;
window.saveSuggestion = saveSuggestion;
window.confirmCodeInsert = confirmCodeInsert;
window.saveSettings = saveSettings;
window.togglePatVisibility = togglePatVisibility;
window.ghTestConnection = ghTestConnection;
window.ghSaveConfig = ghSaveConfig;
window.ghPull = ghPull;
window.ghPush = ghPush;
window.toggleGhConfig = toggleGhConfig;
window.exportZip = exportZip;
window.importZip = importZip;
window.openPasteJson = openPasteJson;
window.pickSaveFolder = pickSaveFolder;
window.loadPastedJson = loadPastedJson;
window.executeConfirmAction = executeConfirmAction;
window.removeAttachment = removeAttachment;
window.renderDocs = renderDocs;
window.scrollToDocSection = scrollToDocSection;

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

document.addEventListener('DOMContentLoaded', function() {
  if (localStorage.getItem('accord-sidebar-collapsed') === 'true' && window.innerWidth > 768) {
    document.body.classList.add('sidebar-collapsed');
  }
  loadData();
  ghLoadConfig();
  renderEmojiGrids();
  renderInfoBoxes();
  updateCounts();
  
  // Initialize with Home/Suggestions
  window.switchMainTab('home');
  
  // Optimized Search Listeners
  const debouncedRender = debounce(renderPage, 250);
  const debouncedHistory = debounce(renderHistory, 250);
  const debouncedDocs = debounce(renderDocs, 250);
  
  ['pending', 'approved', 'rejected', 'archived'].forEach(id => {
    const el = document.getElementById('search-' + id);
    if (el) el.addEventListener('input', debouncedRender);
  });
  const histSearch = document.getElementById('search-history');
  if (histSearch) histSearch.addEventListener('input', debouncedHistory);
  
  // History Filter Listeners
  ['filter-history-action', 'filter-history-user', 'filter-history-start', 'filter-history-end', 'sort-history-order'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', debouncedHistory);
  });
  
  const docsSearch = document.getElementById('search-docs');
  if (docsSearch) docsSearch.addEventListener('input', debouncedDocs);

  updateNotifBadge();

  document.getElementById('topbar-team').textContent = AppState.config.teamName;
  document.getElementById('settings-team').value = AppState.config.teamName;
  document.addEventListener('click', function(e) {
    if (!e.target.closest('#tag-emoji-picker') && !e.target.closest('#editor-tag-emoji-btn')) {
      var p = document.getElementById('tag-emoji-picker');
      if (p) p.classList.remove('show');
    }
    if (!e.target.closest('#new-cat-emoji-picker') && !e.target.closest('#new-cat-emoji-preview')) {
      var p2 = document.getElementById('new-cat-emoji-picker');
      if (p2) p2.classList.remove('show');
    }
  });
  mermaid.initialize({ startOnLoad: false, theme: 'default' });
  
  // Watchdog: Check for updates every 60s
  setInterval(ghCheckForUpdates, 60000);
});
