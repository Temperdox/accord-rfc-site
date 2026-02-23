import { AppState, UI, GH } from './state.js';
import { showToast, showModal, closeModal, escHtml } from './ui.js';
import { saveData } from './storage.js';
import { updateCounts, renderCatNav } from './categories.js';
import { renderPage } from './render.js';

export function ghLoadConfig() {
  try {
    var raw = localStorage.getItem('accord-gh-config');
    if (raw) Object.assign(GH, JSON.parse(raw));
  } catch(e) {}
}

export function ghSaveConfigLocal() {
  localStorage.setItem('accord-gh-config', JSON.stringify(GH));
}

export function ghSaveConfig() {
  GH.pat    = document.getElementById('gh-pat').value.trim();
  GH.repo   = document.getElementById('gh-repo').value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
  GH.branch = document.getElementById('gh-branch').value.trim() || 'main';
  GH.path   = document.getElementById('gh-path').value.trim().replace(/^\/|\/$/g, '');
  ghSaveConfigLocal();
  document.getElementById('dm-gh-config').classList.remove('open');
  dmUpdateSyncStatus();
  showToast('GitHub config saved.', 'success');
}

export async function ghTestConnection() {
  GH.pat    = document.getElementById('gh-pat').value.trim();
  GH.repo   = document.getElementById('gh-repo').value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
  GH.branch = document.getElementById('gh-branch').value.trim() || 'main';
  var btn = document.getElementById('gh-test-btn');
  var statusEl = document.getElementById('dm-gh-status');
  btn.textContent = 'Testing…'; btn.disabled = true;
  statusEl.style.display = 'none';
  try {
    var data = await ghAPI('GET', '/repos/'+GH.repo);
    statusEl.className = 'dm-gh-status ok';
    statusEl.textContent = '✓ Connected to '+data.full_name+' ('+data.default_branch+' default) · '+(data.private?'private':'public')+' repo';
    statusEl.style.display = 'block';
    // Check branch
    await ghAPI('GET', '/repos/'+GH.repo+'/git/ref/heads/'+GH.branch);
    statusEl.textContent += ' · branch "'+GH.branch+'" exists ✓';
  } catch(e) {
    statusEl.className = 'dm-gh-status err';
    statusEl.textContent = '✗ '+e.message;
    statusEl.style.display = 'block';
  }
  btn.textContent = 'Test Connection'; btn.disabled = false;
}

export function dmUpdateSyncStatus() {
  var dot   = document.getElementById('dm-sync-dot');
  var label = document.getElementById('dm-sync-label');
  if (!GH.pat || !GH.repo) {
    if (dot) dot.className = 'dm-sync-dot';
    if (label) label.textContent = 'Not configured — click Configure';
    return;
  }
  if (dot) dot.className = 'dm-sync-dot connected';
  var parts = [GH.repo + ' · ' + GH.branch];
  if (GH.path) parts.push('/' + GH.path);
  if (GH.lastPushAt) parts.push('pushed ' + relTime(GH.lastPushAt));
  if (GH.lastPullAt && !GH.lastPushAt) parts.push('pulled ' + relTime(GH.lastPullAt));
  if (GH.lastPushSha) parts.push(GH.lastPushSha.slice(0,7));
  if (label) label.textContent = parts.join(' · ');
}

export function dmSetBusy(busy) {
  var dot = document.getElementById('dm-sync-dot');
  var pushBtn = document.getElementById('gh-push-btn');
  var pullBtn = document.getElementById('gh-pull-btn');
  if (busy) {
    if (dot) dot.className = 'dm-sync-dot busy';
    if (pushBtn) { pushBtn.disabled = true; }
    if (pullBtn) { pullBtn.disabled = true; }
  } else {
    dmUpdateSyncStatus();
    if (pushBtn) { pushBtn.disabled = false; pushBtn.innerHTML = '<i class="fa-solid fa-upload"></i> Push'; }
    if (pullBtn) { pullBtn.disabled = false; pullBtn.innerHTML = '<i class="fa-solid fa-download"></i> Pull'; }
  }
}

export function dmClearLog() {
  var log = document.getElementById('dm-log');
  var inner = document.getElementById('dm-log-inner');
  if (inner) inner.innerHTML = '';
  if (log) log.style.display = 'none';
}

export function dmLog(msg, cls) {
  var log = document.getElementById('dm-log');
  var inner = document.getElementById('dm-log-inner');
  if (log) log.style.display = 'block';
  var span = document.createElement('span');
  span.className = 'dm-log-line ' + (cls||'');
  span.textContent = msg;
  if (inner) {
    inner.appendChild(span);
    inner.scrollTop = inner.scrollHeight;
  }
}

export async function ghAPI(method, endpoint, body) {
  var url = 'https://api.github.com' + endpoint;
  var opts = {
    method: method,
    headers: {
      'Authorization': 'Bearer ' + GH.pat,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    }
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  var res = await fetch(url, opts);
  var json = await res.json().catch(function(){ return {}; });
  if (!res.ok) {
    throw new Error((json.message || res.statusText || 'HTTP '+res.status) +
      (json.errors ? ' — '+JSON.stringify(json.errors) : ''));
  }
  return json;
}

export async function ghCreateBlob(content, encoding) {
  var r = await ghAPI('POST', '/repos/'+GH.repo+'/git/blobs', {
    content: content,
    encoding: encoding || 'utf-8'
  });
  return r.sha;
}

// ─── SMART PUSH ─────────────────────────────
export async function ghPush(auto = false) {
  ghLoadConfig();
  if (!GH.pat || !GH.repo) {
    if (!auto) {
      showToast('Configure GitHub first.', 'error');
      document.getElementById('dm-gh-config').classList.add('open');
    }
    return;
  }
  
  if (!auto) {
    var pushBtn = document.getElementById('gh-push-btn');
    if (pushBtn) pushBtn.textContent = 'Pushing…';
    dmSetBusy(true);
    dmClearLog();
  } else {
    // Quiet mode for auto-push
    showToast('Saving to cloud...', 'info');
  }

  try {
    var basePath = GH.path ? GH.path + '/' : '';

    if (!auto) dmLog('Getting branch ref…');
    var refData = await ghAPI('GET', '/repos/'+GH.repo+'/git/ref/heads/'+GH.branch);
    var latestCommitSha = refData.object.sha;
    
    // Conflict Detection
    if (GH.headSha && latestCommitSha !== GH.headSha) {
      if (!auto) dmLog('⚠️ Remote has changed! Merging...', 'warn');
      showToast('Remote changes detected. Merging...', 'warn');
      
      // Fetch remote data to merge
      var commitData = await ghAPI('GET', '/repos/'+GH.repo+'/git/commits/'+latestCommitSha);
      var baseTreeSha = commitData.tree.sha;
      var jsonPath = basePath + 'accord-data.json';
      var fileData = await ghAPI('GET', '/repos/'+GH.repo+'/contents/'+encodeURIComponent(jsonPath)+'?ref='+encodeURIComponent(GH.branch));
      var jsonText = decodeBase64Unicode(fileData.content.replace(/\n/g,''));
      var remoteData = JSON.parse(jsonText);
      
      // Merge Strategy: Combine lists, prefer local for conflicts if necessary, but here we just union by ID
      // Suggestions
      var localMap = new Map(AppState.suggestions.map(s => [s.id, s]));
      (remoteData.suggestions || []).forEach(s => {
        if (!localMap.has(s.id)) {
          AppState.suggestions.push(s); // Add new remote ones
        } else {
          // If both exist, we keep local version (Last Write Wins from our perspective)
          // Ideally we check timestamps, but local edits are "newer" user intent
        }
      });
      // History (append missing)
      var histMap = new Set(AppState.history.map(h => h.id));
      (remoteData.history || []).forEach(h => {
        if (!histMap.has(h.id)) AppState.history.push(h);
      });
      // Categories (union by id)
      var catMap = new Map(AppState.categories.map(c => [c.id, c]));
      (remoteData.categories || []).forEach(c => {
        if (!catMap.has(c.id)) AppState.categories.push(c);
      });
      
      saveData();
      if (!auto) {
        updateCounts();
        renderPage();
        renderCatNav();
      }
      
      // Update our base to the new latest so we can push on top of it
      GH.headSha = latestCommitSha;
    }

    // Proceed with Push
    var commitData = await ghAPI('GET', '/repos/'+GH.repo+'/git/commits/'+latestCommitSha);
    var baseTreeSha = commitData.tree.sha;

    if (!auto) dmLog('Serialising data…');
    var exportState = JSON.parse(JSON.stringify(AppState));
    var treeItems = [];

    // Attachments
    var attCount = 0;
    var totalAtt = exportState.suggestions.reduce((n,s) => n+(s.attachments||[]).filter(a => a.type==='image'||a.type==='video').length, 0);

    for (var s of exportState.suggestions) {
      for (var [ai, a] of (s.attachments||[]).entries()) {
        if ((a.type==='image'||a.type==='video') && a.data && a.data.startsWith('data:')) {
          var match = a.data.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            attCount++;
            var ext = match[1].split('/')[1] || 'bin';
            var fname = s.id + '_' + ai + '_' + sanitizeFilename(a.name || ('file.'+ext));
            var attPath = basePath + 'attachments/' + fname;
            if (!auto) dmLog('  Uploading attachment ' + attCount + '/' + totalAtt + ': ' + fname);
            var blobSha = await ghCreateBlob(match[2], 'base64');
            treeItems.push({ path: attPath, mode: '100644', type: 'blob', sha: blobSha });
            a.data = 'attachments/' + fname;
          }
        }
      }
    }

    if (!auto) dmLog('Creating JSON blob…');
    var jsonContent = JSON.stringify(exportState, null, 2);
    var jsonBlobSha = await ghCreateBlob(jsonContent, 'utf-8');
    treeItems.push({ path: basePath + 'accord-data.json', mode: '100644', type: 'blob', sha: jsonBlobSha });

    if (!auto) dmLog('Creating tree…');
    var newTree = await ghAPI('POST', '/repos/'+GH.repo+'/git/trees', {
      base_tree: baseTreeSha,
      tree: treeItems
    });

    var now = new Date();
    var msg = (auto ? 'Auto-save' : 'Accord sync') + ' — ' + now.toISOString().replace('T',' ').slice(0,19) + ' UTC\n\n' +
      AppState.suggestions.length + ' suggestions · ' + AppState.history.length + ' history entries';
    
    if (!auto) dmLog('Creating commit…');
    var newCommit = await ghAPI('POST', '/repos/'+GH.repo+'/git/commits', {
      message: msg,
      tree: newTree.sha,
      parents: [latestCommitSha]
    });

    if (!auto) dmLog('Updating branch ref…');
    await ghAPI('PATCH', '/repos/'+GH.repo+'/git/refs/heads/'+GH.branch, {
      sha: newCommit.sha
    });

    GH.lastPushAt  = now.toISOString();
    GH.lastPushSha = newCommit.sha;
    GH.headSha     = newCommit.sha; // We are now based on this commit
    ghSaveConfigLocal();
    
    if (!auto) dmLog('✓ Pushed! Commit: ' + newCommit.sha.slice(0,7), 'ok');
    showToast('Saved to cloud ✓', 'success');

  } catch(e) {
    if (!auto) dmLog('✗ Push failed: ' + e.message, 'err');
    showToast('Auto-save failed: ' + e.message, 'error');
    console.error(e);
  }

  if (!auto) dmSetBusy(false);
}

// ─── PULL ──────────────────────────────────
export async function ghPull() {
  ghLoadConfig();
  if (!GH.pat || !GH.repo) {
    showToast('Configure GitHub first.', 'error');
    document.getElementById('dm-gh-config').classList.add('open');
    return;
  }
  var pullBtn = document.getElementById('gh-pull-btn');
  pullBtn.textContent = 'Pulling…';
  dmSetBusy(true);
  dmClearLog();

  try {
    var basePath = GH.path ? GH.path + '/' : '';

    // Get current head SHA first
    var refData = await ghAPI('GET', '/repos/'+GH.repo+'/git/ref/heads/'+GH.branch);
    var latestCommitSha = refData.object.sha;

    dmLog('Fetching accord-data.json…');
    var jsonPath = basePath + 'accord-data.json';
    var fileData = await ghAPI('GET', '/repos/'+GH.repo+'/contents/'+encodeURIComponent(jsonPath)+'?ref='+encodeURIComponent(GH.branch));
    var jsonText = decodeBase64Unicode(fileData.content.replace(/\n/g,''));
    var d = JSON.parse(jsonText);
    dmLog('  JSON fetched (' + (jsonText.length/1024).toFixed(1) + ' KB)', 'ok');

    var attPaths = [];
    (d.suggestions||[]).forEach(function(s) {
      (s.attachments||[]).forEach(function(a, ai) {
        if (a.data && a.data.startsWith('attachments/')) {
          attPaths.push({ s: s, a: a, ai: ai });
        }
      });
    });

    dmLog('Fetching ' + attPaths.length + ' attachment' + (attPaths.length!==1?'s':'') + '…');
    for (var pi = 0; pi < attPaths.length; pi++) {
      var item = attPaths[pi];
      var relPath = item.a.data;
      var fullPath = basePath + relPath;
      dmLog('  ' + (pi+1) + '/' + attPaths.length + ': ' + relPath);
      try {
        var attFile = await ghAPI('GET', '/repos/'+GH.repo+'/contents/'+encodeURIComponent(fullPath)+'?ref='+encodeURIComponent(GH.branch));
        var b64 = attFile.content.replace(/\n/g,'');
        var mime = item.a.type === 'image'
          ? guessMime(relPath, 'image/png')
          : guessMime(relPath, 'video/mp4');
        item.a.data = 'data:' + mime + ';base64,' + b64;
      } catch(ae) {
        dmLog('  ⚠ Could not fetch ' + relPath + ': ' + ae.message, 'warn');
      }
    }

    var preserved = AppState.config.teamName;
    AppState.config      = d.config      || AppState.config;
    AppState.categories  = d.categories  || [];
    AppState.tags        = d.tags        || [];
    AppState.suggestions = d.suggestions || [];
    AppState.history     = d.history     || [];
    AppState.docs        = d.docs        || [];
    if (!AppState.config.teamName) AppState.config.teamName = preserved;
    saveData();
    updateCounts();
    renderPage();
    renderCatNav();
    document.getElementById('topbar-team').textContent   = AppState.config.teamName;
    document.getElementById('settings-team').value       = AppState.config.teamName;

    GH.lastPullAt = new Date().toISOString();
    GH.headSha = latestCommitSha; // Update our base
    ghSaveConfigLocal();
    dmLog('✓ Pull complete — ' + AppState.suggestions.length + ' suggestions loaded.', 'ok');
    showToast('Pulled from GitHub ✓', 'success');

  } catch(e) {
    dmLog('✗ Pull failed: ' + e.message, 'err');
    showToast('Pull failed: ' + e.message, 'error');
    console.error(e);
  }

  dmSetBusy(false);
}

// ─── WATCHDOG ──────────────────────────────
export async function ghCheckForUpdates() {
  if (!GH.pat || !GH.repo || !GH.headSha) return;
  try {
    var refData = await ghAPI('GET', '/repos/'+GH.repo+'/git/ref/heads/'+GH.branch);
    var remoteSha = refData.object.sha;
    if (remoteSha !== GH.headSha) {
      showToast('New data available! Click Data > Pull.', 'info');
      // Optional: We could auto-pull here, but prompting is safer for user focus
    }
  } catch(e) { console.warn('Watchdog check failed', e); }
}

export function decodeBase64Unicode(b64) {
  var binary = atob(b64);
  var bytes = new Uint8Array(binary.length);
  for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

export function togglePatVisibility() {
  var inp = document.getElementById('gh-pat');
  if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
}

export function toggleGhConfig() {
  var cfg = document.getElementById('dm-gh-config');
  if (cfg) cfg.classList.toggle('open');
}

export function relTime(iso) {
  if (!iso) return '';
  var diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return diff + 's ago';
  if (diff < 3600) return Math.floor(diff/60) + 'm ago';
  if (diff < 86400)return Math.floor(diff/3600) + 'h ago';
  return Math.floor(diff/86400) + 'd ago';
}

export function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._\-]/g, '_').slice(0, 80);
}

export function guessMime(filename, fallback) {
  var ext = (filename.split('.').pop() || '').toLowerCase();
  var map = { jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', gif:'image/gif',
    webp:'image/webp', svg:'image/svg+xml', mp4:'video/mp4', webm:'video/webm',
    mov:'video/quicktime', avi:'video/x-msvideo' };
  return map[ext] || fallback;
}
