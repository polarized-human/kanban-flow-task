/**
 * @file app.js
 * Main application bootstrap: wires state, UI rendering, and Drag & Drop controller.
 */

import { loadState, getState, subscribe, addCard, updateCard, deleteCard, moveCard } from './state.js';
import { initUI, render } from './ui.js';
import { initDragAndDrop } from './drag-drop.js';

/**
 * Boots the Kanban Board application
 */
function bootstrap() {
  // 1. Initialize State from LocalStorage (or initial mock data)
  const initialState = loadState();

  // 2. Initialize UI Interactions & Bind CRUD Callbacks
  initUI({
    onAddCard: (colId, cardData) => {
      addCard(colId, cardData);
    },
    onUpdateCard: (cardId, updates) => {
      updateCard(cardId, updates);
    },
    onDeleteCard: (cardId) => {
      deleteCard(cardId);
    },
    onMoveCard: (cardId, targetColId, targetIndex) => {
      moveCard(cardId, targetColId, targetIndex);
    }
  });

  // 3. Initialize Drag and Drop Controller
  initDragAndDrop({
    onCardDrop: (cardId, targetColId, targetIndex) => {
      moveCard(cardId, targetColId, targetIndex);
    }
  });

  // 4. Subscribe UI to State changes (Reactive updates)
  subscribe((updatedState) => {
    render(updatedState);
  });

  // 5. Initial Render
  render(initialState);

  console.info('Kanban Flow initialized successfully.');
}

// Jalankan saat DOM siap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
