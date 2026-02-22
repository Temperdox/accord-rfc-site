import { AppState, UI } from './state.js';
import { getCatById, getSugById, showModal, closeModal, showToast, escHtml } from './ui.js';
import { saveData } from './storage.js';
import { updateCounts, renderCatNav } from './categories.js';
import { renderPage, parseMarkdown } from './render.js';
import { addHistory } from './actions.js';

export function openEditor(id) {
  UI.editingId = id;
  var cat = getCatById(UI.selectedCatId);
  var s = id ? getSugById(id) : null;
  if (s) {
    UI.selectedCatId = s.categoryId;
    cat = getCatById(s.categoryId);
    UI.tagEmojiSelected = s.tag ? (s.tag.emoji || '🏷️') : '🏷️';
  } else {
    UI.tagEmojiSelected = '🏷️';
    UI.pendingAttachments = [];
  }

  var titleEl = document.getElementById('editor-modal-title');
  if (titleEl) titleEl.textContent = id ? 'Edit Suggestion' : 'New Suggestion';
  var subEl = document.getElementById('editor-modal-subtitle');
  if (subEl) subEl.textContent = 'Category: ' + (cat ? cat.emoji + ' ' + cat.name : '—');
  var tagEl = document.getElementById('editor-tag');
  if (tagEl) tagEl.value = s ? (s.tag ? s.tag.name : '') : '';
  var displayEl = document.getElementById('editor-tag-emoji-display');
  if (displayEl) displayEl.textContent = UI.tagEmojiSelected;
  var titleInp = document.getElementById('editor-title');
  if (titleInp) titleInp.value = s ? s.title : '';
  var bodyInp = document.getElementById('editor-body');
  if (bodyInp) bodyInp.value = s ? s.body : '';
  var previewEl = document.getElementById('editor-preview');
  if (previewEl) previewEl.classList.remove('show');
  if (bodyInp) bodyInp.style.display = 'block';
  var btn = document.getElementById('preview-toggle-btn');
  if (btn) btn.classList.remove('active');

  // Info boxes
  renderInfoBoxes(s ? s.infoBoxes : null);

  // Attachments
  if (s) UI.pendingAttachments = JSON.parse(JSON.stringify(s.attachments || []));
  renderAttachmentList();

  showModal('modal-editor');
}

export function renderInfoBoxes(data) {
  var grid = document.getElementById('info-boxes-grid');
  if (!grid) return;
  var defaults = [
    { label: 'IMPLEMENTATION', value: '' },
    { label: 'AFFECTS', value: '' },
    { label: 'BENEFIT', value: '' }
  ];
  var boxes = data || defaults;
  while (boxes.length < 3) boxes.push({ label: '', value: '' });
  grid.innerHTML = boxes.slice(0,3).map(function(b, i) {
    return '<div class="info-box-item">' +
      '<input class="info-box-title-field" id="ib-label-' + i + '" type="text" placeholder="LABEL" value="' + escHtml(b.label||'') + '">' +
      '<textarea class="info-box-val-field" id="ib-val-' + i + '" placeholder="Content…">' + escHtml(b.value||'') + '</textarea>' +
      '</div>';
  }).join('');
}

export function saveSuggestion() {
  var tagEl = document.getElementById('editor-tag');
  var tagName = tagEl ? tagEl.value.trim().toUpperCase() : '';
  var titleInp = document.getElementById('editor-title');
  var title = titleInp ? titleInp.value.trim() : '';
  var bodyInp = document.getElementById('editor-body');
  var body = bodyInp ? bodyInp.value : '';

  if (!title) { showToast('Title is required.', 'error'); return; }
  if (!tagName) { showToast('Tag is required.', 'error'); return; }

  var infoBoxes = [0,1,2].map(function(i) {
    return {
      label: (document.getElementById('ib-label-' + i)||{}).value || '',
      value: (document.getElementById('ib-val-' + i)||{}).value || ''
    };
  });

  // Update or add tag
  var existingTag = AppState.tags.find(function(t){ return t.name === tagName; });
  if (!existingTag) {
    AppState.tags.push({ id: 'tag_' + Date.now(), name: tagName, emoji: UI.tagEmojiSelected });
  }

  var now = new Date().toISOString();
  if (UI.editingId) {
    var s = getSugById(UI.editingId);
    if (s) {
      s.tag = { name: tagName, emoji: existingTag ? existingTag.emoji : UI.tagEmojiSelected };
      s.categoryId = UI.selectedCatId;
      s.title = title;
      s.body = body;
      s.infoBoxes = infoBoxes;
      s.attachments = UI.pendingAttachments;
      s.updatedAt = now;
      addHistory('edited', s.id, title, AppState.config.teamName, '');
      showToast('Suggestion updated!', 'success');
    }
  } else {
    var newS = {
      id: 'sug_' + Date.now(),
      categoryId: UI.selectedCatId,
      tag: { name: tagName, emoji: existingTag ? existingTag.emoji : UI.tagEmojiSelected },
      title: title,
      body: body,
      infoBoxes: infoBoxes,
      status: 'pending',
      suggestedBy: AppState.config.teamName,
      approvedBy: null, rejectedBy: null, archivedBy: null,
      createdAt: now, updatedAt: now,
      attachments: UI.pendingAttachments
    };
    AppState.suggestions.push(newS);
    addHistory('created', newS.id, title, AppState.config.teamName, '');
    showToast('Suggestion created!', 'success');
  }

  saveData();
  updateCounts();
  renderPage();
  renderCatNav();
  closeModal('modal-editor');
}

export function tbInsert(type) {
  var ta = document.getElementById('editor-body');
  if (!ta) return;
  var start = ta.selectionStart, end = ta.selectionEnd;
  var selected = ta.value.slice(start, end);
  var insert = '';
  if (type === 'link') insert = '(' + (selected||'link text') + ' [https://example.com])';
  else if (type === 'tooltip') insert = '(' + (selected||'term') + ' <Tooltip description here>)';
  else if (type === 'keyword') insert = '([' + (selected||'keyword') + '])';
  else if (type === 'bold') insert = '**' + (selected||'bold text') + '**';
  else if (type === 'code') insert = '`' + (selected||'code') + '`';
  var val = ta.value;
  ta.value = val.slice(0, start) + insert + val.slice(end);
  ta.focus();
  ta.selectionStart = ta.selectionEnd = start + insert.length;
}

export function togglePreview() {
  var bodyField = document.getElementById('editor-body');
  var preview = document.getElementById('editor-preview');
  var btn = document.getElementById('preview-toggle-btn');
  if (!bodyField || !preview || !btn) return;
  if (preview.classList.contains('show')) {
    preview.classList.remove('show');
    bodyField.style.display = 'block';
    btn.classList.remove('active');
  } else {
    preview.innerHTML = parseMarkdown(bodyField.value);
    preview.classList.add('show');
    bodyField.style.display = 'none';
    btn.classList.add('active');
    // render mermaid
    var mermaidEls = preview.querySelectorAll('.mermaid');
    if (mermaidEls.length) mermaid.run({ nodes: Array.from(mermaidEls) });
  }
}

export function triggerAttach(type) {
  UI.attachType = type;
  var input = document.getElementById('attach-drop-input');
  if (input) {
    input.accept = type === 'image' ? 'image/*' : 'video/*';
    input.click();
  }
}

export function handleDropZoneFiles(files) {
  if (!files || !files.length) return;
  Array.from(files).forEach(function(file) {
    var type = file.type.startsWith('image/') ? 'image' : (file.type.startsWith('video/') ? 'video' : null);
    if (!type) { showToast('Unsupported file type: ' + file.name, 'error'); return; }
    var reader = new FileReader();
    reader.onload = function(e) {
      UI.pendingAttachments.push({ type: type, name: file.name, data: e.target.result });
      renderAttachmentList();
      showToast(file.name + ' attached!', 'success');
    };
    reader.readAsDataURL(file);
  });
  // reset so same file can be re-selected
  var input = document.getElementById('attach-drop-input');
  if (input) input.value = '';
}

export function openCodeInsert(mode) {
  UI.codeInsertMode = mode;
  var titleEl = document.getElementById('code-insert-title');
  if (titleEl) titleEl.textContent = mode === 'html' ? 'Insert HTML Block' : 'Insert Mermaid Diagram';
  var subEl = document.getElementById('code-insert-sub');
  if (subEl) subEl.textContent = mode === 'html' ? 'Renders in an iframe sandbox' : 'Mermaid diagram syntax';
  var area = document.getElementById('code-insert-area');
  if (area) area.value = mode === 'mermaid' ? 'graph TD\n    A[Start] --> B[End]' : '<h1>Hello World</h1>';
  showModal('modal-code-insert');
}

export function confirmCodeInsert() {
  var area = document.getElementById('code-insert-area');
  var code = area ? area.value : '';
  if (!code.trim()) { closeModal('modal-code-insert'); return; }
  UI.pendingAttachments.push({ type: UI.codeInsertMode, name: UI.codeInsertMode === 'mermaid' ? 'diagram' : 'html-block', data: code });
  renderAttachmentList();
  closeModal('modal-code-insert');
  showToast((UI.codeInsertMode === 'mermaid' ? 'Mermaid diagram' : 'HTML block') + ' attached!', 'success');
}

export function renderAttachmentList() {
  var list = document.getElementById('attachment-list');
  if (!list) return;
  if (!UI.pendingAttachments.length) { list.innerHTML = '<span style="font-size:12px;color:var(--text-muted)">No attachments yet.</span>'; return; }
  list.innerHTML = UI.pendingAttachments.map(function(a, i) {
    var icon = { image:'<i class="fa-solid fa-image"></i>', video:'<i class="fa-solid fa-film"></i>', html:'<i class="fa-solid fa-code"></i>', mermaid:'<i class="fa-solid fa-diagram-project"></i>' }[a.type] || '<i class="fa-solid fa-paperclip"></i>';
    return '<div class="attachment-chip">' + icon + ' ' + escHtml(a.name) +
      '<button onclick="removeAttachment(' + i + ')" title="Remove"><i class="fa-solid fa-xmark"></i></button>' +
      '</div>';
  }).join('');
}

export function removeAttachment(idx) {
  UI.pendingAttachments.splice(idx, 1);
  renderAttachmentList();
}
