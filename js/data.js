import { AppState, UI } from './state.js';
import { showToast, closeModal, showModal } from './ui.js';
import { saveData, writeFileHandle } from './storage.js';
import { updateCounts, renderCatNav } from './categories.js';
import { renderPage } from './render.js';
import { sanitizeFilename, guessMime } from './github.js';

export async function exportZip() {
  var btn = document.getElementById('export-zip-btn');
  if (btn) { btn.textContent = 'Building…'; btn.disabled = true; }
  try {
    var zip = new JSZip();
    var attFolder = zip.folder('attachments');
    var exportState = JSON.parse(JSON.stringify(AppState));
    exportState.suggestions.forEach(function(s) {
      (s.attachments||[]).forEach(function(a, i) {
        if ((a.type==='image'||a.type==='video') && a.data && a.data.startsWith('data:')) {
          var match = a.data.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            var ext = match[1].split('/')[1] || 'bin';
            var fname = s.id+'_'+i+'_'+sanitizeFilename(a.name||('file.'+ext));
            attFolder.file(fname, match[2], { base64: true });
            a.data = 'attachments/' + fname;
          }
        }
      });
    });
    zip.file('accord-data.json', JSON.stringify(exportState, null, 2));
    var blob = await zip.generateAsync({ type:'blob', compression:'DEFLATE', compressionOptions:{level:6} });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = 'accord-data.zip'; a.click();
    URL.revokeObjectURL(url);
    showToast('accord-data.zip exported!', 'success');
  } catch(e) { showToast('Export failed: '+e.message, 'error'); }
  if (btn) { btn.innerHTML = '<i class="fa-solid fa-download"></i> Export ZIP'; btn.disabled = false; }
}

export async function importZip(input) {
  var file = input.files[0]; if (!file) return; input.value = '';
  try {
    var zip = await JSZip.loadAsync(file);
    var jsonFile = zip.file('accord-data.json');
    if (!jsonFile) throw new Error('accord-data.json not found in ZIP.');
    var jsonText = await jsonFile.async('text');
    var d = JSON.parse(jsonText);
    var attFiles = {};
    var attFolder = zip.folder('attachments');
    if (attFolder) attFolder.forEach(function(rel, entry){ attFiles[rel] = entry; });
    for (var si=0; si<(d.suggestions||[]).length; si++) {
      for (var ai=0; ai<(d.suggestions[si].attachments||[]).length; ai++) {
        var a = d.suggestions[si].attachments[ai];
        if (a.data && a.data.startsWith('attachments/')) {
          var rel = a.data.slice('attachments/'.length);
          if (attFiles[rel]) {
            var b64 = await attFiles[rel].async('base64');
            a.data = 'data:'+(a.type==='image'?guessMime(rel,'image/png'):guessMime(rel,'video/mp4'))+';base64,'+b64;
          }
        }
      }
    }
    AppState.config = d.config || AppState.config;
    AppState.categories = d.categories || [];
    AppState.tags = d.tags || [];
    AppState.suggestions = d.suggestions || [];
    AppState.history = d.history || [];
    AppState.docs = d.docs || [];
    saveData(); updateCounts(); renderPage(); renderCatNav();
    document.getElementById('topbar-team').textContent = AppState.config.teamName;
    document.getElementById('settings-team').value = AppState.config.teamName;
    closeModal('modal-data');
    showToast('Data imported from ZIP!', 'success');
  } catch(e) { showToast('Import failed: '+e.message, 'error'); console.error(e); }
}

export function openPasteJson() {
  document.getElementById('paste-json-input').value = '';
  document.getElementById('paste-json-error').style.display = 'none';
  closeModal('modal-data');
  showModal('modal-paste-json');
  setTimeout(function(){ document.getElementById('paste-json-input').focus(); }, 120);
}

export function loadPastedJson() {
  var text = document.getElementById('paste-json-input').value.trim();
  var errEl = document.getElementById('paste-json-error');
  errEl.style.display = 'none';
  if (!text) { errEl.textContent = 'Nothing to load.'; errEl.style.display = 'block'; return; }
  try {
    var d = JSON.parse(text);
    var preserved = AppState.config.teamName;
    AppState.config      = d.config      || AppState.config;
    AppState.categories  = d.categories  || [];
    AppState.tags        = d.tags        || [];
    AppState.suggestions = d.suggestions || [];
    AppState.history     = d.history     || [];
    AppState.docs        = d.docs        || [];
    if (!AppState.config.teamName) AppState.config.teamName = preserved;
    saveData(); updateCounts(); renderPage(); renderCatNav();
    document.getElementById('topbar-team').textContent = AppState.config.teamName;
    document.getElementById('settings-team').value = AppState.config.teamName;
    closeModal('modal-paste-json');
    showToast('JSON loaded — ' + AppState.suggestions.length + ' suggestions, ' + (AppState.docs||[]).length + ' doc sections.', 'success');
  } catch(e) {
    errEl.textContent = 'Parse error: ' + e.message;
    errEl.style.display = 'block';
  }
}

export async function pickSaveFolder() {
  if (!window.showDirectoryPicker) { showToast('File System Access API not supported.', 'error'); return; }
  try {
    UI.dirHandle = await window.showDirectoryPicker({ mode:'readwrite' });
    UI.fileHandle = await UI.dirHandle.getFileHandle('accord-data.json', { create:true });
    await writeFileHandle();
    var el = document.getElementById('folder-path-display');
    if (el) { el.style.display='block'; el.innerHTML='<i class="fa-solid fa-folder-open"></i> '+UI.dirHandle.name+'/accord-data.json'; }
    AppState.config.savedFolder = UI.dirHandle.name;
    saveData();
    showToast('Live sync active: '+UI.dirHandle.name, 'success');
  } catch(e) { if (e.name !== 'AbortError') showToast('Error: '+e.message, 'error'); }
}
