import { AppState, UI } from './state.js';

export function saveData() {
  localStorage.setItem('accord-sg-data', JSON.stringify(AppState));
  // If we have a file handle, write to it
  if (UI.fileHandle) {
    writeFileHandle();
  }
}

export async function writeFileHandle() {
  try {
    var writable = await UI.fileHandle.createWritable();
    await writable.write(JSON.stringify(AppState, null, 2));
    await writable.close();
  } catch(e) { console.warn('File write failed:', e); }
}

export function loadData() {
  var raw = localStorage.getItem('accord-sg-data');
  if (raw) {
    try {
      var d = JSON.parse(raw);
      AppState.config = d.config || { teamName: 'Anonymous' };
      AppState.categories = d.categories || [];
      AppState.tags = d.tags || [];
      AppState.suggestions = (d.suggestions || []).filter(function(s) {
        return s.id !== 'sug_demo1' && s.id !== 'sug_demo2';
      });
      AppState.history = (d.history || []).filter(function(h) {
        return h.suggestionId !== 'sug_demo1' && h.suggestionId !== 'sug_demo2';
      });
      AppState.docs = d.docs || [];
      // Remove stale demo categories if no suggestions reference them
      var usedCatIds = new Set(AppState.suggestions.map(function(s){ return s.categoryId; }));
      var demoCatIds = new Set(['cat_net','cat_sec','cat_ui']);
      AppState.categories = AppState.categories.filter(function(c) {
        return !demoCatIds.has(c.id) || usedCatIds.has(c.id);
      });
      AppState.tags = AppState.tags.filter(function(t) {
        return t.id !== 'tag_net' && t.id !== 'tag_nat' && t.id !== 'tag_sec';
      });
    } catch(e) {}
  }
}
