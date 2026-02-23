import { AppState, UI } from './state.js';
import { getSugById, showModal, closeModal, showToast } from './ui.js';
import { saveData } from './storage.js';
import { updateCounts, renderCatNav } from './categories.js';
import { renderPage } from './render.js';
import { ghPush } from './github.js';

export function confirmAction(action, id) {
  var s = getSugById(id);
  if (!s) return;
  var msgs = {
    approve: 'Approve this suggestion and move it to documentation?',
    reject: 'Reject this suggestion?',
    revoke: 'Remove this approved suggestion from documentation? It will be moved to Rejected.',
    archive: 'Archive this rejected suggestion? It will be hidden from the main rejected view.',
    restore: 'Restore this suggestion back to Pending?'
  };
  var btnStyles = {
    approve: 'btn-primary',
    reject: 'btn-danger',
    revoke: 'btn-danger',
    archive: 'btn-ghost',
    restore: 'btn-accent'
  };
  document.getElementById('confirm-title').textContent = action.charAt(0).toUpperCase() + action.slice(1) + ' Suggestion';
  document.getElementById('confirm-msg').textContent = msgs[action] || '';
  var noteArea = document.getElementById('confirm-note');
  noteArea.value = '';
  noteArea.style.display = ['reject','revoke'].includes(action) ? 'block' : 'none';
  var okBtn = document.getElementById('confirm-ok-btn');
  okBtn.className = 'btn ' + (btnStyles[action] || 'btn-primary');
  okBtn.textContent = action.charAt(0).toUpperCase() + action.slice(1);
  UI.confirmCallback = function() {
    var note = document.getElementById('confirm-note').value.trim();
    executeAction(action, id, note);
  };
  showModal('modal-confirm');
}

export function executeConfirmAction() {
  if (UI.confirmCallback) UI.confirmCallback();
  closeModal('modal-confirm');
}

export function executeAction(action, id, note) {
  var s = getSugById(id);
  if (!s) return;
  var by = AppState.config.teamName;
  var now = new Date().toISOString();
  if (action === 'approve') {
    s.status = 'approved'; s.approvedBy = by; s.updatedAt = now;
    addHistory('approved', id, s.title, by, note);
    showToast('Suggestion approved! ✓', 'success');
  } else if (action === 'reject') {
    s.status = 'rejected'; s.rejectedBy = by; s.updatedAt = now;
    addHistory('rejected', id, s.title, by, note);
    showToast('Suggestion rejected.', 'info');
  } else if (action === 'revoke') {
    s.status = 'rejected'; s.rejectedBy = by; s.updatedAt = now;
    addHistory('revoked', id, s.title, by, note);
    showToast('Removed from documentation.', 'info');
  } else if (action === 'archive') {
    s.status = 'archived'; s.archivedBy = by; s.updatedAt = now;
    addHistory('archived', id, s.title, by, note);
    showToast('Archived.', 'info');
  } else if (action === 'restore') {
    s.status = 'pending'; s.updatedAt = now;
    addHistory('restored', id, s.title, by, '');
    showToast('Restored to pending.', 'success');
  }
  saveData();
  updateCounts();
  renderPage();
  renderCatNav();
  ghPush(true); // Auto-save
}

export function addHistory(action, sugId, title, by, note) {
  AppState.history.push({
    id: 'hist_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
    action: action,
    suggestionId: sugId,
    title: title,
    by: by,
    at: new Date().toISOString(),
    note: note || ''
  });
  updateCounts();
}
