/**
 * @file state.js
 * Normalized application state store with LocalStorage persistence and Pub/Sub mechanism.
 */

const STORAGE_KEY = 'kanban_board_app_v1';

/**
 * Initial mock data for first-time visits
 */
const INITIAL_STATE = {
  columns: {
    todo: {
      id: 'todo',
      title: 'To Do',
      cardIds: ['card-1', 'card-2']
    },
    doing: {
      id: 'doing',
      title: 'In Progress',
      cardIds: ['card-3']
    },
    done: {
      id: 'done',
      title: 'Done',
      cardIds: ['card-4']
    }
  },
  cards: {
    'card-1': {
      id: 'card-1',
      title: 'Aksesibilitas WCAG 2.2 AA audit',
      description: 'Verifikasi keyboard navigasi, focus ring, dan atribut ARIA pada dialog serta list item.',
      priority: 'high',
      tags: ['a11y', 'qa'],
      createdAt: 1729240000000
    },
    'card-2': {
      id: 'card-2',
      title: 'Bounding Rect drag-and-drop controller',
      description: 'Implementasi midpoint cursor distance calculation untuk drop indicator yang presisi.',
      priority: 'medium',
      tags: ['frontend', 'dnd'],
      createdAt: 1729241000000
    },
    'card-3': {
      id: 'card-3',
      title: 'Optimasi Core Web Vitals',
      description: 'Reduksi reflow trigger pada dragover menggunakan visual indicator.',
      priority: 'high',
      tags: ['performance'],
      createdAt: 1729242000000
    },
    'card-4': {
      id: 'card-4',
      title: 'Sistem Token CSS & Container Queries',
      description: 'Penerapan CSS Variables dan Cascade Layers untuk styling modular.',
      priority: 'low',
      tags: ['css', 'ui'],
      createdAt: 1729243000000
    }
  }
};

/**
 * Current in-memory state snapshot
 */
let state = null;

/**
 * Set of subscriber listener functions
 */
const subscribers = new Set();

/**
 * Deep clones state object to prevent accidental external mutation
 * @param {object} obj
 * @returns {object}
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Validates normalized state structure
 * @param {any} raw
 * @returns {boolean}
 */
function isValidStateSchema(raw) {
  if (!raw || typeof raw !== 'object') return false;
  if (!raw.columns || typeof raw.columns !== 'object') return false;
  if (!raw.cards || typeof raw.cards !== 'object') return false;
  
  const requiredCols = ['todo', 'doing', 'done'];
  for (const colId of requiredCols) {
    if (!raw.columns[colId] || !Array.isArray(raw.columns[colId].cardIds)) {
      return false;
    }
  }
  return true;
}

/**
 * Loads state from LocalStorage with schema verification and fallback
 * @returns {object}
 */
export function loadState() {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (serialized) {
      const parsed = JSON.parse(serialized);
      if (isValidStateSchema(parsed)) {
        state = parsed;
        return getState();
      }
    }
  } catch (err) {
    console.warn('Gagal membaca LocalStorage, fallback ke initial mock data:', err);
  }

  state = deepClone(INITIAL_STATE);
  saveState();
  return getState();
}

/**
 * Persists current state to LocalStorage
 * @returns {boolean}
 */
export function saveState() {
  try {
    if (!state) return false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.error('Gagal menyimpan state ke LocalStorage:', err);
    return false;
  }
}

/**
 * Retrieves an immutable snapshot of the current state
 * @returns {object}
 */
export function getState() {
  if (!state) {
    loadState();
  }
  return deepClone(state);
}

/**
 * Subscribes a listener to state modifications
 * @param {Function} listener
 * @returns {Function} unsubscribe function
 */
export function subscribe(listener) {
  if (typeof listener !== 'function') {
    throw new TypeError('Subscriber listener harus berupa function');
  }
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

/**
 * Notifies all subscribers with the updated state snapshot
 */
function notify() {
  const snapshot = getState();
  for (const listener of subscribers) {
    try {
      listener(snapshot);
    } catch (err) {
      console.error('Error saat mengeksekusi listener subscriber:', err);
    }
  }
}

/**
 * Generates unique card ID
 * @returns {string}
 */
function generateId() {
  return 'card-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7);
}

/**
 * Adds a new card to a specific column
 * @param {string} columnId 
 * @param {{ title: string, description?: string, priority?: string, tags?: string[] }} cardData 
 * @returns {object|null}
 */
export function addCard(columnId, cardData) {
  if (!state || !state.columns[columnId]) {
    console.error(`Kolom dengan id "${columnId}" tidak ditemukan.`);
    return null;
  }

  const title = (cardData.title || '').trim();
  if (!title) {
    console.error('Judul kartu tidak boleh kosong.');
    return null;
  }

  const id = generateId();
  const newCard = {
    id,
    title,
    description: (cardData.description || '').trim(),
    priority: ['low', 'medium', 'high'].includes(cardData.priority) ? cardData.priority : 'medium',
    tags: Array.isArray(cardData.tags) ? cardData.tags : [],
    createdAt: Date.now()
  };

  state.cards[id] = newCard;
  state.columns[columnId].cardIds.push(id);

  saveState();
  notify();
  return deepClone(newCard);
}

/**
 * Updates an existing card
 * @param {string} cardId 
 * @param {Partial<{ title: string, description: string, priority: string, tags: string[] }>} updates 
 * @returns {object|null}
 */
export function updateCard(cardId, updates) {
  if (!state || !state.cards[cardId]) {
    console.error(`Kartu dengan id "${cardId}" tidak ditemukan.`);
    return null;
  }

  const card = state.cards[cardId];
  if (updates.title !== undefined) {
    const trimmedTitle = updates.title.trim();
    if (trimmedTitle) card.title = trimmedTitle;
  }
  if (updates.description !== undefined) {
    card.description = updates.description.trim();
  }
  if (updates.priority && ['low', 'medium', 'high'].includes(updates.priority)) {
    card.priority = updates.priority;
  }
  if (Array.isArray(updates.tags)) {
    card.tags = updates.tags;
  }

  saveState();
  notify();
  return deepClone(card);
}

/**
 * Deletes a card and cleans references in columns
 * @param {string} cardId 
 * @returns {boolean}
 */
export function deleteCard(cardId) {
  if (!state || !state.cards[cardId]) return false;

  delete state.cards[cardId];

  // Hapus dari kolom yang memuat cardId
  for (const col of Object.values(state.columns)) {
    col.cardIds = col.cardIds.filter(id => id !== cardId);
  }

  saveState();
  notify();
  return true;
}

/**
 * Moves and reorders a card precisely within or across columns
 * @param {string} cardId 
 * @param {string} targetColId 
 * @param {number} targetIndex 
 * @returns {boolean}
 */
export function moveCard(cardId, targetColId, targetIndex) {
  if (!state || !state.cards[cardId] || !state.columns[targetColId]) {
    return false;
  }

  // Cari kolom asal
  let sourceColId = null;
  for (const [colKey, col] of Object.entries(state.columns)) {
    if (col.cardIds.includes(cardId)) {
      sourceColId = colKey;
      break;
    }
  }

  if (!sourceColId) return false;

  const sourceList = state.columns[sourceColId].cardIds;
  const targetList = state.columns[targetColId].cardIds;

  if (sourceColId === targetColId) {
    // Reorder dalam kolom yang sama
    const currentIndex = sourceList.indexOf(cardId);
    if (currentIndex === -1) return false;

    sourceList.splice(currentIndex, 1);
    const clampedIndex = Math.max(0, Math.min(targetIndex, sourceList.length));
    sourceList.splice(clampedIndex, 0, cardId);
  } else {
    // Pindah antar kolom berbeda
    state.columns[sourceColId].cardIds = sourceList.filter(id => id !== cardId);
    const clampedIndex = Math.max(0, Math.min(targetIndex, targetList.length));
    targetList.splice(clampedIndex, 0, cardId);
  }

  saveState();
  notify();
  return true;
}
