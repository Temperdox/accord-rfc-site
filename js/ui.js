import { AppState, UI, GH } from './state.js';
import { saveData } from './storage.js';
import { ghLoadConfig, dmUpdateSyncStatus, dmClearLog } from './github.js';

export function getCatById(id) {
  if (!id) return null;
  if (id.startsWith('doc:')) {
    var docId = id.slice(4);
    var sec = (AppState.docs || []).find(function(s){ return s.id === docId; });
    if (sec) {
      return { id: id, name: sec.title.replace(/^\d+\.\s+/, ''), emoji: '📄', isDocSection: true };
    }
    return null;
  }
  return AppState.categories.find(function(c){ return c.id === id; }) || null;
}

export function getSugById(id) { return AppState.suggestions.find(function(s){ return s.id === id; }) || null; }

export function fmtDate(iso) {
  if (!iso) return '';
  try {
    var d = new Date(iso);
    return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
  } catch(e) { return iso; }
}

export function escHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

export function showModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.add('show');
}

export function closeModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.remove('show');
}

var toastTimer = null;
export function showToast(msg, type) {
  var el = document.getElementById('toast');
  if (!el) return;
  var icons = { success:'<i class="fa-solid fa-check"></i>', error:'<i class="fa-solid fa-xmark"></i>', info:'<i class="fa-solid fa-circle-info"></i>' };
  el.innerHTML = '<span>' + (icons[type]||'·') + '</span> ' + escHtml(msg);
  el.className = 'notif-toast ' + (type||'info') + ' show';
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ el.classList.remove('show'); }, 2800);
}

export function toggleTheme(cb) {
  document.documentElement.setAttribute('data-theme', cb.checked ? 'light' : 'dark');
  localStorage.setItem('accord-theme', cb.checked ? 'light' : 'dark');
}

export function openSettings() {
  document.getElementById('settings-team').value = AppState.config.teamName;
  showModal('modal-settings');
}

export function saveSettings() {
  var name = document.getElementById('settings-team').value.trim() || 'Anonymous';
  AppState.config.teamName = name;
  document.getElementById('topbar-team').textContent = name;
  saveData();
  closeModal('modal-settings');
  showToast('Settings saved!', 'success');
}

export var EMOJIS = ['🗂️','🌐','🔒','⚡','🛡️','🔧','📡','🎯','🔗','💡','🚀','🔑','🌍','🏗️','📊','🎨','🔬','💻','🤝','📋','🦾','🧬','⚙️','🎛️','🌱','🔮','🏆','🎪','🌊','🔥','💫','🎭','🛸','🌙','⭐','🎲','🦋','🐸','🐱','WOLF','🦅','FOX','🐉','🧠','👾','🎵','🎸','🎯','🏴','🚩','✨','💎','🔴','🟢','🟡','🔵','🟣'];

export function renderEmojiGrids() {
  ['emoji-grid-cat','emoji-grid-tag'].forEach(function(id) {
    var grid = document.getElementById(id);
    if (!grid) return;
    grid.innerHTML = EMOJIS.map(function(e) {
      return '<button onmousedown="selectEmoji(\'' + id + '\',\'' + e + '\')" title="' + e + '">' + e + '</button>';
    }).join('');
  });
}

export function toggleEmojiPicker(pickerId) {
  var picker = document.getElementById(pickerId);
  if (picker) picker.classList.toggle('show');
}

export function selectEmoji(gridId, emoji) {
  if (gridId === 'emoji-grid-cat') {
    UI.newCatEmojiSelected = emoji;
    document.getElementById('new-cat-emoji-preview').textContent = emoji;
  } else {
    UI.tagEmojiSelected = emoji;
    document.getElementById('editor-tag-emoji-display').textContent = emoji;
  }
  // close picker
  document.querySelectorAll('.emoji-picker-mini').forEach(function(p){ p.classList.remove('show'); });
}

export function onTagInput(val) {
  var list = document.getElementById('tag-suggestions-list');
  if (!list) return;
  if (!val.trim()) { list.classList.remove('show'); return; }
  var upper = val.toUpperCase();
  var matches = AppState.tags.filter(function(t){ return t.name.includes(upper); });
  if (!matches.length) { list.classList.remove('show'); return; }
  list.innerHTML = matches.map(function(t) {
    return '<div class="tag-suggestion-item" onmousedown="selectTag(\'' + escHtml(t.name) + '\',\'' + escHtml(t.emoji||'🏷️') + '\')">' +
      '<span>' + escHtml(t.emoji||'🏷️') + '</span>' +
      '<span class="tag-sug-name">' + escHtml(t.name) + '</span>' +
      '</div>';
  }).join('');
  list.classList.add('show');
}

export function selectTag(name, emoji) {
  document.getElementById('editor-tag').value = name;
  document.getElementById('editor-tag-emoji-display').textContent = emoji;
  UI.tagEmojiSelected = emoji;
  document.getElementById('tag-suggestions-list').classList.remove('show');
}

export function hideSugAfterDelay() {
  setTimeout(function(){ 
    var list = document.getElementById('tag-suggestions-list');
    if (list) list.classList.remove('show'); 
  }, 200);
}

export function openDataModal() {
  ghLoadConfig();
  // Populate fields
  document.getElementById('gh-pat').value    = GH.pat    || '';
  document.getElementById('gh-repo').value   = GH.repo   || '';
  document.getElementById('gh-branch').value = GH.branch || 'main';
  document.getElementById('gh-path').value   = GH.path   || '';

  // Show config panel open if not yet configured, closed if configured
  var cfgPanel = document.getElementById('dm-gh-config');
  if (cfgPanel) {
    if (GH.pat && GH.repo) {
      cfgPanel.classList.remove('open');
    } else {
      cfgPanel.classList.add('open');
    }
  }

  dmUpdateSyncStatus();
  dmClearLog();

  // Stats
  var totalAtt = AppState.suggestions.reduce(function(n,s){ return n+(s.attachments?s.attachments.length:0); },0);
  var mediaBytes = AppState.suggestions.reduce(function(n,s){
    return n+(s.attachments||[]).reduce(function(m,a){ return m+(a.data?a.data.length:0); },0);
  },0);
  var statsEl = document.getElementById('data-stats');
  if (statsEl) {
    statsEl.innerHTML =
      '<div class="data-stat-chip"><strong>'+AppState.suggestions.length+'</strong> suggestions</div>'+
      '<div class="data-stat-chip"><strong>'+totalAtt+'</strong> attachments</div>'+
      '<div class="data-stat-chip"><strong>'+(mediaBytes/1024/1024).toFixed(2)+' MB</strong> media</div>'+
      '<div class="data-stat-chip"><strong>'+AppState.history.length+'</strong> history entries</div>';
  }

  showModal('modal-data');
}
