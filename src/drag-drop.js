/**
 * @file drag-drop.js
 * Native HTML5 Drag and Drop controller with bounding rect midpoint algorithm.
 */

/**
 * Drop indicator DOM element reuse
 */
let indicatorElement = null;

/**
 * State tracking during active drag
 */
let currentDraggedCardId = null;
let currentDraggedElement = null;

/**
 * Creates or retrieves the singleton drop indicator element
 * @returns {HTMLElement}
 */
function getOrCreateIndicator() {
  if (!indicatorElement) {
    indicatorElement = document.createElement('div');
    indicatorElement.className = 'drop-indicator';
    indicatorElement.setAttribute('aria-hidden', 'true');
  }
  return indicatorElement;
}

/**
 * Menghitung elemen kartu terdekat berdasarkan posisi kursor vertikal (midpoint check).
 * @param {HTMLElement} container - Card list element
 * @param {number} cursorY - e.clientY
 * @returns {HTMLElement|null} - Elemen yang berada tepat di bawah drop spot
 */
export function getDragAfterElement(container, cursorY) {
  const cards = [
    ...container.querySelectorAll('.kanban-card:not(.is-dragging)')
  ];

  return cards.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      // Jarak kursor terhadap titik tengah kartu
      const offset = cursorY - (box.top + box.height / 2);

      // Offset negatif mendekati 0 berarti kursor tepat berada di atas paruh atas kartu
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY, element: null }
  ).element;
}

/**
 * Membersihkan seluruh visual feedback drag
 */
function cleanupVisuals() {
  if (currentDraggedElement) {
    currentDraggedElement.classList.remove('is-dragging');
  }
  currentDraggedElement = null;
  currentDraggedCardId = null;

  if (indicatorElement && indicatorElement.parentNode) {
    indicatorElement.parentNode.removeChild(indicatorElement);
  }

  document.querySelectorAll('.column-drag-over').forEach((col) => {
    col.classList.remove('column-drag-over');
  });
}

/**
 * Inisialisasi event delegation drag and drop
 * @param {{ onCardDrop: (cardId: string, targetColId: string, targetIndex: number) => void }} options
 */
export function initDragAndDrop({ onCardDrop }) {
  const board = document.getElementById('board');
  if (!board) return;

  // 1. DRAG START
  board.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.kanban-card');
    if (!card) return;

    currentDraggedCardId = card.dataset.cardId;
    currentDraggedElement = card;

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', currentDraggedCardId);

    // Beri jeda 0ms agar thumbnail ghost drag bawaan browser tetap utuh sebelum styling is-dragging diterapkan
    setTimeout(() => {
      if (currentDraggedElement) {
        currentDraggedElement.classList.add('is-dragging');
      }
    }, 0);
  });

  // 2. DRAG OVER (Delegated to columns & card-lists)
  board.addEventListener('dragover', (e) => {
    const column = e.target.closest('.column');
    if (!column || !currentDraggedCardId) return;

    // Default browser mencegah drop; preventDefault membuka drop access
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const cardList = column.querySelector('.card-list');
    if (!cardList) return;

    // Visual highlight column
    document.querySelectorAll('.column').forEach((col) => {
      if (col === column) {
        col.classList.add('column-drag-over');
      } else {
        col.classList.remove('column-drag-over');
      }
    });

    // Kalkulasi posisi indicator
    const afterElement = getDragAfterElement(cardList, e.clientY);
    const indicator = getOrCreateIndicator();

    if (afterElement == null) {
      // Tempatkan di paling bawah list
      cardList.appendChild(indicator);
    } else {
      // Sisipkan tepat sebelum elemen target
      cardList.insertBefore(indicator, afterElement);
    }
  });

  // 3. DRAG LEAVE
  board.addEventListener('dragleave', (e) => {
    const column = e.target.closest('.column');
    // Jika keluar dari area board atau relatedTarget bukan bagian dari kolom
    if (column && !column.contains(e.relatedTarget)) {
      column.classList.remove('column-drag-over');
    }
  });

  // 4. DROP
  board.addEventListener('drop', (e) => {
    const column = e.target.closest('.column');
    if (!column) {
      cleanupVisuals();
      return;
    }

    e.preventDefault();

    const targetColId = column.dataset.columnId;
    const cardId = e.dataTransfer.getData('text/plain') || currentDraggedCardId;
    const cardList = column.querySelector('.card-list');

    if (!cardId || !targetColId || !cardList) {
      cleanupVisuals();
      return;
    }

    // Tentukan targetIndex berdasarkan posisi indicator di DOM
    const cards = [
      ...cardList.querySelectorAll('.kanban-card:not(.is-dragging)')
    ];
    const afterElement = getDragAfterElement(cardList, e.clientY);

    let targetIndex = cards.length;
    if (afterElement) {
      const idx = cards.indexOf(afterElement);
      if (idx !== -1) targetIndex = idx;
    }

    // Bersihkan visual sebelum callback memicu re-render
    cleanupVisuals();

    if (typeof onCardDrop === 'function') {
      onCardDrop(cardId, targetColId, targetIndex);
    }
  });

  // 5. DRAG END (Cancelled / completed)
  board.addEventListener('dragend', () => {
    cleanupVisuals();
  });
}
