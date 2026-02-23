import { AppState, UI } from './state.js';
import { getCatById, escHtml, fmtDate } from './ui.js';
import { openEditor } from './editor.js';
import { confirmAction } from './actions.js';

export function renderPage() {
  var view = UI.currentView;
  if (view === 'history') { renderHistory(); return; }
  var container = document.getElementById('cards-' + view);
  if (!container) return;
  var search = (document.getElementById('search-' + view) || {}).value || '';
  search = search.toLowerCase();

  var filtered = AppState.suggestions.filter(function(s) {
    if (s.status !== view) return false;
    if (UI.currentCatFilter !== 'all' && s.categoryId !== UI.currentCatFilter) return false;
    if (search) {
      var haystack = (s.title + ' ' + s.body + ' ' + (s.tag ? s.tag.name : '')).toLowerCase();
      if (haystack.indexOf(search) === -1) return false;
    }
    return true;
  });

  // Group by category
  var grouped = {};
  filtered.forEach(function(s) {
    var cat = getCatById(s.categoryId);
    var key = s.categoryId || 'uncategorized';
    if (!grouped[key]) grouped[key] = { cat: cat, items: [] };
    grouped[key].items.push(s);
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-lightbulb"></i></div><h3>No ' + view + ' suggestions</h3><p>Nothing to show here yet.</p></div>';
    return;
  }

  var html = '';
  Object.values(grouped).forEach(function(g) {
    if (UI.currentCatFilter === 'all' && Object.keys(grouped).length > 1) {
      var catName = g.cat ? (g.cat.emoji + ' ' + g.cat.name) : '🗂️ Uncategorized';
      html += '<div class="section-divider">' + escHtml(catName) + '<span>' + g.items.length + ' suggestion' + (g.items.length !== 1 ? 's' : '') + '</span></div>';
    }
    g.items.forEach(function(s) { html += renderCardHTML(s); });
  });
  container.innerHTML = html;
  renderMermaidInContainer(container);
}

export function renderCardHTML(s) {
  var cat = getCatById(s.categoryId);
  var tag = s.tag || { name: 'UNTAGGED', emoji: '' };
  var badgeCls = 'badge-' + s.status;
  var badgeText = s.status.charAt(0).toUpperCase() + s.status.slice(1);

  var authorLabel = 'Suggested by';
  var authorCls = '';
  var authorName = s.suggestedBy || AppState.config.teamName;
  if (s.status === 'approved') {
    authorLabel = 'Approved by'; authorCls = 'approved'; authorName = s.approvedBy || authorName;
  } else if (s.status === 'rejected') {
    authorLabel = 'Rejected by'; authorCls = 'rejected'; authorName = s.rejectedBy || authorName;
  } else if (s.status === 'archived') {
    authorLabel = 'Archived by'; authorCls = 'archived'; authorName = s.archivedBy || authorName;
  }

  // Info boxes
  var infoHtml = '';
  var hasBoxes = s.infoBoxes && s.infoBoxes.some(function(b){ return b.label || b.value; });
  if (hasBoxes) {
    infoHtml = '<div class="impact-grid">';
    s.infoBoxes.forEach(function(b) {
      if (b.label || b.value) {
        infoHtml += '<div class="impact-item"><div class="impact-label">' + escHtml(b.label) + '</div><div class="impact-value">' + escHtml(b.value) + '</div></div>';
      }
    });
    infoHtml += '</div>';
  }

  // Attachments
  var attHtml = '';
  if (s.attachments && s.attachments.length) {
    attHtml = '<div class="card-attachments">';
    s.attachments.forEach(function(a, i) {
      if (a.type === 'image') {
        attHtml += '<div class="card-attachment"><img src="' + a.data + '" alt="attachment" loading="lazy"><div class="card-attachment-label"><i class="fa-solid fa-image"></i> ' + escHtml(a.name || 'image') + '</div></div>';
      } else if (a.type === 'video') {
        attHtml += '<div class="card-attachment"><video src="' + a.data + '" controls preload="metadata"></video><div class="card-attachment-label"><i class="fa-solid fa-film"></i> ' + escHtml(a.name || 'video') + '</div></div>';
      } else if (a.type === 'html') {
        var blob = new Blob([a.data], {type:'text/html'});
        var url = URL.createObjectURL(blob);
        var fwClass = a.fullwidth ? ' fullwidth' : '';
        attHtml += '<div class="card-attachment' + fwClass + '"><iframe src="' + url + '" sandbox="allow-scripts allow-same-origin" loading="lazy"></iframe><div class="card-attachment-label"><i class="fa-solid fa-code"></i> ' + escHtml(a.name || 'HTML Block') + '</div></div>';
      } else if (a.type === 'mermaid') {
        attHtml += '<div class="mermaid-wrap"><div class="mermaid-label"><i class="fa-solid fa-diagram-project"></i> Mermaid Diagram</div><div class="mermaid pending-render" id="mermaid-' + s.id + '-' + i + '">' + escHtml(a.data) + '</div></div>';
      }
    });
    attHtml += '</div>';
  }

  // Action buttons
  var actionsHtml = '<div class="card-actions">';
  if (s.status === 'pending') {
    actionsHtml += '<button class="card-action-btn approve-btn" onclick="confirmAction(\'approve\',\'' + s.id + '\')"><i class="fa-solid fa-check"></i> Approve</button>';
    actionsHtml += '<button class="card-action-btn reject-btn" onclick="confirmAction(\'reject\',\'' + s.id + '\')"><i class="fa-solid fa-xmark"></i> Reject</button>';
    actionsHtml += '<button class="card-action-btn edit-btn" onclick="openEditor(\'' + s.id + '\')"><i class="fa-solid fa-pen"></i> Edit</button>';
  } else if (s.status === 'approved') {
    actionsHtml += '<button class="card-action-btn reject-btn" onclick="confirmAction(\'revoke\',\'' + s.id + '\')"><i class="fa-solid fa-xmark"></i> Remove from Docs</button>';
    actionsHtml += '<button class="card-action-btn edit-btn" onclick="openEditor(\'' + s.id + '\')"><i class="fa-solid fa-pen"></i> Edit</button>';
  } else if (s.status === 'rejected') {
    actionsHtml += '<button class="card-action-btn approve-btn" onclick="confirmAction(\'approve\',\'' + s.id + '\')"><i class="fa-solid fa-check"></i> Approve</button>';
    actionsHtml += '<button class="card-action-btn archive-btn" onclick="confirmAction(\'archive\',\'' + s.id + '\')"><i class="fa-solid fa-box-archive"></i> Archive</button>';
  } else if (s.status === 'archived') {
    actionsHtml += '<button class="card-action-btn" onclick="confirmAction(\'restore\',\'' + s.id + '\')"><i class="fa-solid fa-rotate-left"></i> Restore to Pending</button>';
  }
  actionsHtml += '</div>';

  return '<div class="suggestion-card status-' + s.status + '" id="card-' + s.id + '">' +
    '<div class="card-top">' +
    '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
    '<div class="card-tag">' + (tag.emoji ? escHtml(tag.emoji) + ' ' : '') + escHtml(tag.name) + '</div>' +
    (cat ? '<span class="card-category-pill">' + escHtml(cat.emoji||'') + ' ' + escHtml(cat.name) + '</span>' : '') +
    '</div>' +
    '<span class="card-status-badge ' + badgeCls + '">' + badgeText + '</span>' +
    '</div>' +
    '<div class="card-title">' + escHtml(s.title) + '</div>' +
    '<div class="card-body">' + parseMarkdown(s.body || '') + '</div>' +
    infoHtml +
    attHtml +
    '<div class="card-meta" style="margin-top:14px;">' +
    '<div class="card-author-tag ' + authorCls + '"><span class="author-dot"></span>' + escHtml(authorLabel) + ': ' + escHtml(authorName) + '</div>' +
    '<span style="margin-left:auto;font-size:10.5px;font-family:\'JetBrains Mono\',monospace;color:var(--text-muted);">' + fmtDate(s.createdAt) + '</span>' +
    '</div>' +
    actionsHtml +
    '</div>';
}

var mermaidObserver = null;
export function renderMermaidInContainer(container) {
  var mermaidEls = container.querySelectorAll('.mermaid.pending-render');
  if (!mermaidEls.length) return;

  if (!mermaidObserver) {
    mermaidObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          var el = entry.target;
          if (el.classList.contains('pending-render')) {
            el.classList.remove('pending-render');
            // Schedule rendering for a moment when the browser is idle
            const renderTask = () => {
              mermaid.run({ nodes: [el] });
            };
            if (window.requestIdleCallback) {
              window.requestIdleCallback(renderTask, { timeout: 2000 });
            } else {
              setTimeout(renderTask, 1);
            }
            mermaidObserver.unobserve(el);
          }
        }
      });
    }, { rootMargin: '200px' });
  }

  mermaidEls.forEach(el => mermaidObserver.observe(el));
}

export function parseMarkdown(text) {
  if (!text) return '';
  // Escape HTML first (except inside our custom syntax)
  var i = 0;
  var result = '';
  while (i < text.length) {
    // Custom syntax: (text [url]) | (text <tooltip>) | ([keyword])
    if (text[i] === '(' && i + 1 < text.length) {
      var closeIdx = findClosingParen(text, i);
      if (closeIdx !== -1) {
        var inner = text.slice(i+1, closeIdx);
        var parsed = parseCustomSyntax(inner);
        if (parsed !== null) {
          result += parsed;
          i = closeIdx + 1;
          continue;
        }
      }
    }
    // Bold: **text**
    if (text[i] === '*' && text[i+1] === '*') {
      var end = text.indexOf('**', i+2);
      if (end !== -1) {
        result += '<span class="sug-bold">' + escHtml(text.slice(i+2, end)) + '</span>';
        i = end + 2;
        continue;
      }
    }
    // Inline code: `code`
    if (text[i] === '`') {
      var end2 = text.indexOf('`', i+1);
      if (end2 !== -1) {
        result += '<code class="sug-code">' + escHtml(text.slice(i+1, end2)) + '</code>';
        i = end2 + 1;
        continue;
      }
    }
    // Newline
    if (text[i] === '\n') {
      result += '<br>';
      i++;
      continue;
    }
    result += escHtml(text[i]);
    i++;
  }
  return result;
}

function findClosingParen(text, openIdx) {
  var depth = 0;
  for (var j = openIdx; j < text.length; j++) {
    if (text[j] === '(') depth++;
    else if (text[j] === ')') {
      depth--;
      if (depth === 0) return j;
    }
  }
  return -1;
}

function parseCustomSyntax(inner) {
  // ([keyword]) - keyword only
  if (inner.startsWith('[') && inner.endsWith(']')) {
    var kw = inner.slice(1, -1);
    return '<span class="sug-keyword">' + escHtml(kw) + '</span>';
  }
  // (text [url]) - hyperlink
  var linkMatch = inner.match(/^(.*?)\s*\[([^\]]+)\]\s*$/);
  if (linkMatch) {
    var linkText = linkMatch[1].trim();
    var url = linkMatch[2].trim();
    if (!url.match(/^https?:\/\//)) url = 'https://' + url;
    return '<a href="' + escHtml(url) + '" class="sug-link" target="_blank" rel="noopener">' + escHtml(linkText) + '</a>';
  }
  // (text <tooltip>) - tooltip
  var ttMatch = inner.match(/^(.*?)\s*<([^>]+)>\s*$/);
  if (ttMatch) {
    var ttText = ttMatch[1].trim();
    var ttContent = ttMatch[2].trim();
    return '<span class="sug-tooltip-wrap">' + escHtml(ttText) + '<span class="sug-tooltip-popup">' + escHtml(ttContent) + '</span></span>';
  }
  return null;
}

export function renderHistory() {
  var list = document.getElementById('history-list');
  if (!list) return;

  // 1. Populate User Filter (Dynamic)
  var userFilter = document.getElementById('filter-history-user');
  if (userFilter && userFilter.options.length <= 1) {
    var users = Array.from(new Set(AppState.history.map(h => h.by))).sort();
    users.forEach(u => {
      var opt = document.createElement('option');
      opt.value = u;
      opt.textContent = u;
      userFilter.appendChild(opt);
    });
  }

  // 2. Get Filter Values
  var search = (document.getElementById('search-history') || {}).value || '';
  var action = (document.getElementById('filter-history-action') || {}).value || 'all';
  var user = (document.getElementById('filter-history-user') || {}).value || 'all';
  var start = (document.getElementById('filter-history-start') || {}).value || '';
  var end = (document.getElementById('filter-history-end') || {}).value || '';
  var order = (document.getElementById('sort-history-order') || {}).value || 'desc';

  search = search.toLowerCase();

  // 3. Filter Logic
  var items = AppState.history.filter(h => {
    // Search
    if (search) {
      var haystack = (h.action + h.by + h.title + (h.note || '')).toLowerCase();
      if (haystack.indexOf(search) === -1) return false;
    }
    // Action
    if (action !== 'all' && h.action !== action) return false;
    // User
    if (user !== 'all' && h.by !== user) return false;
    // Date Range
    if (start) {
      if (new Date(h.at) < new Date(start)) return false;
    }
    if (end) {
      if (new Date(h.at) > new Date(end)) return false;
    }
    return true;
  });

  // 4. Sort Logic
  items.sort((a, b) => {
    var timeA = new Date(a.at).getTime();
    var timeB = new Date(b.at).getTime();
    return order === 'desc' ? timeB - timeA : timeA - timeB;
  });

  if (!items.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-clipboard-list"></i></div><h3>No matching history</h3><p>Try adjusting your filters.</p></div>';
    return;
  }

  // 5. Render
  var icons = { created:'<i class="fa-solid fa-lightbulb"></i>', approved:'<i class="fa-solid fa-circle-check"></i>', rejected:'<i class="fa-solid fa-circle-xmark"></i>', archived:'<i class="fa-solid fa-box-archive"></i>', edited:'<i class="fa-solid fa-pen"></i>', restored:'<i class="fa-solid fa-rotate-left"></i>', revoked:'<i class="fa-solid fa-ban"></i>' };
  var cls = { created:'hist-created', approved:'hist-approved', rejected:'hist-rejected', archived:'hist-archived', edited:'hist-edited', restored:'hist-created', revoked:'hist-rejected' };
  
  var html = items.map(function(h) {
    return '<div class="history-entry">' +
      '<div class="history-icon ' + (cls[h.action]||'hist-edited') + '">' + (icons[h.action]||'·') + '</div>' +
      '<div class="history-content">' +
      '<div class="history-action"><strong>' + escHtml(h.by) + '</strong> ' + escHtml(actionVerb(h.action)) + ' <strong>"' + escHtml(h.title) + '"</strong>' + (h.note ? ' — <em>' + escHtml(h.note) + '</em>' : '') + '</div>' +
      '<div class="history-meta"><span>' + escHtml(h.action) + '</span><span>' + fmtDate(h.at) + '</span></div>' +
      '</div>' +
      '</div>';
  }).join('');
  list.innerHTML = html;
}

function actionVerb(a) {
  var map = { created:'created suggestion', approved:'approved', rejected:'rejected', archived:'archived', edited:'edited', restored:'restored', revoked:'removed from docs' };
  return map[a] || a;
}
