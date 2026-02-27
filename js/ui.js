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

export var EMOJIS = [
  { n: 'folder', e: '🗂️' }, { n: 'globe', e: '🌐' }, { n: 'lock', e: '🔒' }, { n: 'lightning', e: '⚡' },
  { n: 'shield', e: '🛡️' }, { n: 'wrench', e: '🔧' }, { n: 'dish', e: '📡' }, { n: 'target', e: '🎯' },
  { n: 'link', e: '🔗' }, { n: 'bulb', e: '💡' }, { n: 'rocket', e: '🚀' }, { n: 'key', e: '🔑' },
  { n: 'earth', e: '🌍' }, { n: 'crane', e: '🏗️' }, { n: 'chart', e: '📊' }, { n: 'palette', e: '🎨' },
  { n: 'microscope', e: '🔬' }, { n: 'laptop', e: '💻' }, { n: 'handshake', e: '🤝' }, { n: 'clipboard', e: '📋' },
  { n: 'robot', e: '🦾' }, { n: 'dna', e: '🧬' }, { n: 'gear', e: '⚙️' }, { n: 'knob', e: '🎛️' },
  { n: 'sprout', e: '🌱' }, { n: 'crystal', e: '🔮' }, { n: 'trophy', e: '🏆' }, { n: 'circus', e: '🎪' },
  { n: 'wave', e: '🌊' }, { n: 'fire', e: '🔥' }, { n: 'sparkles', e: '💫' }, { n: 'theater', e: '🎭' },
  { n: 'ufo', e: '🛸' }, { n: 'moon', e: '🌙' }, { n: 'star', e: '⭐' }, { n: 'dice', e: '🎲' },
  { n: 'butterfly', e: '🦋' }, { n: 'frog', e: '🐸' }, { n: 'cat', e: '🐱' }, { n: 'wolf', e: '🐺' },
  { n: 'eagle', e: '🦅' }, { n: 'fox', e: '🦊' }, { n: 'dragon', e: '🐉' }, { n: 'brain', e: '🧠' },
  { n: 'invader', e: '👾' }, { n: 'music', e: '🎵' }, { n: 'guitar', e: '🎸' }, { n: 'flag', e: '🚩' },
  { n: 'diamond', e: '💎' }, { n: 'circle-red', e: '🔴' }, { n: 'circle-green', e: '🟢' },
  { n: 'circle-yellow', e: '🟡' }, { n: 'circle-blue', e: '🔵' }, { n: 'circle-purple', e: '🟣' }
];

export function renderEmojiGrids() {
  ['emoji-grid-cat','emoji-grid-tag'].forEach(function(id) {
    renderEmojiGrid(id, '');
  });
}

export function renderEmojiGrid(gridId, filter) {
  var grid = document.getElementById(gridId);
  if (!grid) return;
  var fl = filter ? filter.toLowerCase() : '';
  var matches = EMOJIS.filter(function(item) {
    return !fl || item.n.toLowerCase().indexOf(fl) !== -1 || item.e.indexOf(fl) !== -1;
  });
  
  if (!matches.length) {
    grid.innerHTML = '<div style="padding:10px;font-size:11px;color:var(--text-muted);width:100%;text-align:center;">No emojis found</div>';
    return;
  }
  
  grid.innerHTML = matches.map(function(item) {
    return '<button onmousedown="selectEmoji(\'' + gridId + '\',\'' + item.e + '\')" title="' + item.n + '">' + item.e + '</button>';
  }).join('');
}

export function filterEmojis(gridId, val) {
  renderEmojiGrid(gridId, val);
}

export function toggleEmojiPicker(pickerId) {
  var picker = document.getElementById(pickerId);
  if (picker) {
    var isShowing = picker.classList.contains('show');
    // Close all other pickers
    document.querySelectorAll('.emoji-picker-mini').forEach(function(p){ p.classList.remove('show'); });
    if (!isShowing) {
      picker.classList.add('show');
      // Reset search
      var searchInp = picker.querySelector('.emoji-search');
      if (searchInp) {
        searchInp.value = '';
        var gridId = picker.querySelector('.emoji-grid').id;
        renderEmojiGrid(gridId, '');
        setTimeout(function(){ searchInp.focus(); }, 50);
      }
    }
  }
}

export function selectEmoji(gridId, emoji) {
  if (gridId === 'emoji-grid-cat') {
    UI.newCatEmojiSelected = emoji;
    document.getElementById('new-cat-emoji-preview').textContent = emoji;
  } else {
    UI.tagEmojiSelected = emoji;
    var display = document.getElementById('editor-tag-emoji-display');
    if (display) display.textContent = emoji;
  }
  // close all pickers
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

export function openNotifications() {
  renderNotifications();
  showModal('modal-notifications');
  // Mark all as read conceptually by hiding badge
  var badge = document.getElementById('notif-badge');
  if (badge) badge.classList.remove('show');
}

export function renderNotifications() {
  var list = document.getElementById('notif-list');
  if (!list) return;
  if (!AppState.notifications || !AppState.notifications.length) {
    list.innerHTML = '<div style="padding:40px 20px;text-align:center;color:var(--text-muted);"><i class="fa-solid fa-bell-slash" style="font-size:32px;margin-bottom:12px;display:block;"></i>No new notifications</div>';
    return;
  }
  
  list.innerHTML = AppState.notifications.slice().reverse().map(n => {
    var icon = n.type === 'suggestion' ? '<i class="fa-solid fa-lightbulb"></i>' : '<i class="fa-solid fa-circle-check"></i>';
    return `
      <div class="notif-item">
        <div class="notif-item-icon">${icon}</div>
        <div class="notif-item-content">
          <div class="notif-item-title">${escHtml(n.title)}</div>
          <div class="notif-item-meta">${escHtml(n.by)} · ${fmtDate(n.at)}</div>
        </div>
      </div>
    `;
  }).join('');
}

export function clearNotifications() {
  AppState.notifications = [];
  saveData();
  renderNotifications();
  updateNotifBadge();
}

export function updateNotifBadge() {
  var badge = document.getElementById('notif-badge');
  if (!badge) return;
  var count = (AppState.notifications || []).length;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.classList.add('show');
  } else {
    badge.classList.remove('show');
  }
}

export function toggleSidebar() {
  if (window.innerWidth <= 768) {
    var sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('open');
  } else {
    document.body.classList.toggle('sidebar-collapsed');
    localStorage.setItem('accord-sidebar-collapsed', document.body.classList.contains('sidebar-collapsed'));
  }
}
