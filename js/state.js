export var AppState = {
  config: { teamName: 'Anonymous', savedFolder: null },
  categories: [],
  tags: [],
  suggestions: [],
  history: [],
  docs: [],
  notifications: []
};

export var UI = {
  currentView: 'pending',
  currentCatFilter: 'all',
  editingId: null,
  selectedCatId: null,
  confirmCallback: null,
  codeInsertMode: null,
  tagEmojiSelected: '🏷️',
  newCatEmojiSelected: '🗂️',
  attachType: null,
  pendingAttachments: [], // for editor in-progress
  fileHandle: null,
  dirHandle: null
};

export var GH = {
  pat: '', repo: '', branch: 'main', path: '',
  lastPushAt: null, lastPushSha: null, lastPullAt: null,
  headSha: null, // Tracks the commit we are currently based on
  syncTimeout: null,
  pendingSync: false,
  isPrivate: true
};
