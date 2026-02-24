import { escHtml } from './ui.js';
import { GH } from './state.js';

export function renderDownloadPage() {
  const container = document.getElementById('download-content');
  if (!container) return;

  container.innerHTML = `
    <div class="page-header">
      <h1>Download & Setup</h1>
    </div>
    
    <div class="dl-hero">
      <div class="dl-hero-content">
        <h2>Accord Development Test Environment</h2>
        <p>Accord is a federated peer-to-peer messaging platform. These installers set up a multi-VM Vagrant environment for testing Accord's federated architecture locally.</p>
      </div>
    </div>

    <div id="dl-section-installers" class="dl-section">
      <h3 class="dl-section-title"><i class="fa-solid fa-box-open"></i> Available Installers</h3>
      <div id="github-releases" class="releases-grid">
        <div class="loading-spinner">
          <i class="fa-solid fa-circle-notch fa-spin"></i> Loading releases from GitHub...
        </div>
      </div>
    </div>

    <div id="dl-section-environment" class="dl-section">
      <h3 class="dl-section-title"><i class="fa-solid fa-server"></i> Test Environment Details</h3>
      <p class="dl-text">The environment consists of several Virtual Machines communicating over a host-only network (192.168.56.0/24).</p>
      <div class="vm-table-wrap">
        <table class="vm-table">
          <thead>
            <tr>
              <th>VM Name</th>
              <th>IP Address</th>
              <th>RAM</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code class="dl-code">docker-vm</code></td>
              <td>192.168.56.5</td>
              <td>4 GB</td>
              <td>Ubuntu Server (Docker Stack)</td>
            </tr>
            <tr>
              <td><code class="dl-code">nixos-server</code></td>
              <td>192.168.56.30</td>
              <td>4 GB</td>
              <td>NixOS Server</td>
            </tr>
            <tr>
              <td><code class="dl-code">ubuntu-client</code></td>
              <td>192.168.56.10</td>
              <td>2 GB</td>
              <td>Alice (Ubuntu Client)</td>
            </tr>
            <tr>
              <td><code class="dl-code">windows-client</code></td>
              <td>192.168.56.20</td>
              <td>4 GB</td>
              <td>Bob (Windows Client)</td>
            </tr>
            <tr>
              <td><code class="dl-code">nixos-client</code></td>
              <td>192.168.56.31</td>
              <td>3 GB</td>
              <td>Charlie (NixOS Client)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div id="dl-section-docker" class="dl-section">
      <h3 class="dl-section-title"><i class="fa-solid fa-layer-group"></i> Docker Stack Components</h3>
      <div class="stack-grid">
        <div class="stack-item">
          <div class="stack-item-hdr">Network & Discovery</div>
          <ul>
            <li><strong>accord-bootstrap:</strong> Kademlia DHT bootstrap node</li>
            <li><strong>coturn:</strong> STUN/TURN server</li>
          </ul>
        </div>
        <div class="stack-item">
          <div class="stack-item-hdr">Messaging Servers</div>
          <ul>
            <li><strong>accord-server-alice:</strong> Port 7700</li>
            <li><strong>accord-server-bob:</strong> Port 7701</li>
          </ul>
        </div>
        <div class="stack-item">
          <div class="stack-item-hdr">Storage & Data</div>
          <ul>
            <li><strong>PostgreSQL:</strong> Persistent storage</li>
            <li><strong>MinIO:</strong> S3-compatible attachments</li>
            <li><strong>KeyDB:</strong> Redis-compatible caching</li>
          </ul>
        </div>
      </div>
    </div>
  `;

  fetchReleases();
}

async function fetchReleases() {
  const releasesEl = document.getElementById('github-releases');
  if (!releasesEl) return;

  try {
    const repo = GH.repo || 'accordgg/rfc';
    const headers = { 'Accept': 'application/vnd.github.v3+json' };
    if (GH.pat) {
      headers['Authorization'] = `token ${GH.pat}`;
    }

    const response = await fetch(`https://api.github.com/repos/${repo}/releases`, { headers });
    if (!response.ok) throw new Error('Failed to fetch releases');
    const releases = await response.json();
    
    if (releases.length === 0) {
      releasesEl.innerHTML = '<div class="empty-state">No releases found.</div>';
      return;
    }

    // Sort releases by date
    releases.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

    let html = '';
    const latest = releases[0];
    
    html += `
      <div class="release-card latest">
        <div class="release-badge">Latest Release</div>
        <div class="release-hdr">
          <div class="release-version">${escHtml(latest.tag_name)}</div>
          <div class="release-date">${new Date(latest.published_at).toLocaleDateString()}</div>
        </div>
        <div class="release-assets">
          ${renderAssets(latest.assets)}
        </div>
      </div>
    `;

    // Show older releases if any
    if (releases.length > 1) {
      html += '<div class="older-releases-hdr">Previous Versions</div>';
      releases.slice(1, 4).forEach(rel => {
        html += `
          <div class="release-card">
            <div class="release-hdr">
              <div class="release-version">${escHtml(rel.tag_name)}</div>
              <div class="release-date">${new Date(rel.published_at).toLocaleDateString()}</div>
            </div>
            <div class="release-assets small">
              ${renderAssets(rel.assets)}
            </div>
          </div>
        `;
      });
    }

    releasesEl.innerHTML = html;
  } catch (error) {
    releasesEl.innerHTML = `
      <div class="error-state">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <p>Could not load releases from GitHub.</p>
        <a href="https://github.com/${GH.repo || 'accordgg/rfc'}/releases" target="_blank" class="dl-link">View on GitHub</a>
      </div>
    `;
  }
}

function renderAssets(assets) {
  if (!assets || assets.length === 0) return '<div class="no-assets">No files available</div>';
  
  return assets.map(asset => {
    let icon = '<i class="fa-solid fa-file"></i>';
    let label = 'Download';
    if (asset.name.endsWith('.exe')) { icon = '<i class="fa-brands fa-windows"></i>'; label = 'Windows Installer'; }
    else if (asset.name.endsWith('.dmg')) { icon = '<i class="fa-brands fa-apple"></i>'; label = 'macOS Installer'; }
    else if (asset.name.endsWith('.run')) { icon = '<i class="fa-brands fa-linux"></i>'; label = 'Linux Installer'; }
    
    return `
      <a href="${asset.browser_download_url}" class="asset-btn" title="${escHtml(asset.name)}">
        <span class="asset-icon">${icon}</span>
        <span class="asset-name">${escHtml(label)}</span>
        <span class="asset-size">${(asset.size / 1024 / 1024).toFixed(1)} MB</span>
      </a>
    `;
  }).join('');
}
