/**
 * @file ui.js
 * Accessible UI renderer with XSS prevention and native <dialog> management.
 */

let uiCallbacks = {
  onAddCard: null,
  onUpdateCard: null,
  onDeleteCard: null,
  onMoveCard: null
};

/**
 * Formats tag list into array of cleaned string tags
 * @param {string} rawTags 
 * @returns {string[]}
 */
function parseTags(rawTags) {
  if (!rawTags) return [];
  return rawTags
    .split(',')
    .map(t => t.trim().toLowerCase().replace(/^#/, ''))
    .filter(t => t.length > 0);
}

/**
 * Creates SVG icon element for Edit (pencil)
 * @returns {SVGElement}
 */
function createEditIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>';
  return svg;
}

/**
 * Creates SVG icon element for Delete (trash)
 * @returns {SVGElement}
 */
function createDeleteIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line>';
  return svg;
}

/**
 * Creates a single DOM card element safely without innerHTML XSS injection
 * @param {object} card 
 * @returns {HTMLElement}
 */
function createCardElement(card) {
  const article = document.createElement('article');
  article.className = 'kanban-card';
  article.id = `card-node-${card.id}`;
  article.dataset.cardId = card.id;
  article.setAttribute('draggable', 'true');
  article.setAttribute('tabindex', '0');
  article.setAttribute('role', 'listitem');
  article.setAttribute('aria-label', `${card.title}, Priority: ${card.priority}`);

  // Top Bar: Priority Badge + Actions
  const topBar = document.createElement('div');
  topBar.className = 'card-top-bar';

  const priorityBadge = document.createElement('span');
  priorityBadge.className = `badge-priority priority-${card.priority}`;
  priorityBadge.textContent = card.priority;
  topBar.appendChild(priorityBadge);

  const actionsGroup = document.createElement('div');
  actionsGroup.className = 'card-actions';

  // Edit Action Button
  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'btn-card-action btn-edit-card';
  editBtn.setAttribute('aria-label', `Edit task: ${card.title}`);
  editBtn.title = 'Edit task';
  editBtn.appendChild(createEditIcon());
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openEditModal(card);
  });

  // Delete Action Button
  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'btn-card-action btn-delete-card';
  deleteBtn.setAttribute('aria-label', `Delete task: ${card.title}`);
  deleteBtn.title = 'Delete task';
  deleteBtn.appendChild(createDeleteIcon());
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm(`Hapus kartu "${card.title}"?`)) {
      if (typeof uiCallbacks.onDeleteCard === 'function') {
        uiCallbacks.onDeleteCard(card.id);
      }
    }
  });

  actionsGroup.appendChild(editBtn);
  actionsGroup.appendChild(deleteBtn);
  topBar.appendChild(actionsGroup);
  article.appendChild(topBar);

  // Title
  const titleEl = document.createElement('h3');
  titleEl.className = 'card-title';
  titleEl.textContent = card.title;
  article.appendChild(titleEl);

  // Description
  if (card.description && card.description.trim()) {
    const descEl = document.createElement('p');
    descEl.className = 'card-desc';
    descEl.textContent = card.description;
    article.appendChild(descEl);
  }

  // Tags Footer
  if (Array.isArray(card.tags) && card.tags.length > 0) {
    const footer = document.createElement('div');
    footer.className = 'card-footer';
    for (const tag of card.tags) {
      const tagBadge = document.createElement('span');
      tagBadge.className = 'tag-badge';
      tagBadge.textContent = `#${tag}`;
      footer.appendChild(tagBadge);
    }
    article.appendChild(footer);
  }

  // Keyboard accessibility: Enter key on card opens edit dialog
  article.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target === article) {
      openEditModal(card);
    }
  });

  return article;
}

/**
 * Opens modal dialog in 'create' mode
 * @param {string} columnId 
 */
export function openCreateModal(columnId = 'todo') {
  const modal = document.getElementById('card-modal');
  const modalTitle = document.getElementById('modal-title');
  const form = document.getElementById('card-form');
  const taskIdInput = document.getElementById('task-id');
  const taskColInput = document.getElementById('task-column-id');
  const targetColSelect = document.getElementById('task-target-col');
  const errorBanner = document.getElementById('form-error-banner');

  if (!modal || !form) return;

  form.reset();
  errorBanner.hidden = true;
  errorBanner.textContent = '';

  taskIdInput.value = '';
  taskColInput.value = columnId;
  targetColSelect.value = columnId;
  modalTitle.textContent = 'Create Task';

  modal.showModal();
  document.getElementById('task-title')?.focus();
}

/**
 * Opens modal dialog in 'edit' mode with prefilled values
 * @param {object} card 
 */
export function openEditModal(card) {
  const modal = document.getElementById('card-modal');
  const modalTitle = document.getElementById('modal-title');
  const taskIdInput = document.getElementById('task-id');
  const taskColInput = document.getElementById('task-column-id');
  const titleInput = document.getElementById('task-title');
  const descInput = document.getElementById('task-desc');
  const prioritySelect = document.getElementById('task-priority');
  const tagsInput = document.getElementById('task-tags');
  const targetColSelect = document.getElementById('task-target-col');
  const errorBanner = document.getElementById('form-error-banner');

  if (!modal) return;

  errorBanner.hidden = true;
  errorBanner.textContent = '';

  modalTitle.textContent = 'Edit Task';
  taskIdInput.value = card.id;
  titleInput.value = card.title;
  descInput.value = card.description || '';
  prioritySelect.value = card.priority || 'medium';
  tagsInput.value = (card.tags || []).join(', ');

  // Determine current column
  const currentCol = findCardColumn(card.id) || 'todo';
  taskColInput.value = currentCol;
  targetColSelect.value = currentCol;

  modal.showModal();
  titleInput.focus();
}

/**
 * Helper to find column containing cardId from DOM
 * @param {string} cardId 
 * @returns {string|null}
 */
function findCardColumn(cardId) {
  const cardNode = document.getElementById(`card-node-${cardId}`);
  if (cardNode) {
    const col = cardNode.closest('.column');
    return col ? col.dataset.columnId : null;
  }
  return null;
}

/**
 * Closes modal dialog safely
 */
export function closeModal() {
  const modal = document.getElementById('card-modal');
  if (modal && modal.open) {
    modal.close();
  }
}

/**
 * Renders the entire board based on the state snapshot
 * @param {object} state 
 */
export function render(state) {
  if (!state || !state.columns || !state.cards) return;

  // 1. Update Hero Value Proposition Metrics Strip
  const statTotal = document.getElementById('stat-total');
  const statActive = document.getElementById('stat-active');
  const statDone = document.getElementById('stat-done');

  const totalCards = Object.keys(state.cards || {}).length;
  const activeCards = (state.columns.doing && state.columns.doing.cardIds.length) || 0;
  const doneCards = (state.columns.done && state.columns.done.cardIds.length) || 0;

  if (statTotal) statTotal.textContent = String(totalCards);
  if (statActive) statActive.textContent = String(activeCards);
  if (statDone) statDone.textContent = String(doneCards);

  // 2. Render Columns & Cards
  for (const [colId, colData] of Object.entries(state.columns)) {
    const listContainer = document.getElementById(`list-${colId}`);
    const countBadge = document.querySelector(`[data-col-count="${colId}"]`);

    if (countBadge) {
      const total = colData.cardIds.length;
      countBadge.textContent = String(total);
      countBadge.setAttribute('aria-label', `${total} tasks`);
    }

    if (!listContainer) continue;

    // Bersihkan isi sebelumnya
    listContainer.innerHTML = '';

    if (colData.cardIds.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-dropzone';
      const emptyText = document.createElement('span');
      emptyText.textContent = 'Drop tasks here';
      emptyState.appendChild(emptyText);
      listContainer.appendChild(emptyState);
    } else {
      for (const cardId of colData.cardIds) {
        const card = state.cards[cardId];
        if (card) {
          listContainer.appendChild(createCardElement(card));
        }
      }
    }
  }
}

/**
 * Binds UI listeners for modal, forms, theme toggle, and triggers
 * @param {{ onAddCard: Function, onUpdateCard: Function, onDeleteCard: Function, onMoveCard?: Function }} callbacks 
 */
export function initUI(callbacks) {
  uiCallbacks = { ...callbacks };

  // Theme Toggle (Dark / Light Mode)
  const themeToggleBtn = document.getElementById('btn-theme-toggle');
  const savedTheme = localStorage.getItem('kanban_theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  const currentTheme = document.documentElement.getAttribute('data-theme');
  const isInitiallyDark = currentTheme === 'dark' || (!currentTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);

  if (themeToggleBtn) {
    themeToggleBtn.setAttribute('aria-label', `Switch to ${isInitiallyDark ? 'light' : 'dark'} mode`);
    themeToggleBtn.addEventListener('click', () => {
      const activeTheme = document.documentElement.getAttribute('data-theme');
      const isDark = activeTheme === 'dark' || (!activeTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
      const nextTheme = isDark ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', nextTheme);
      localStorage.setItem('kanban_theme', nextTheme);
      themeToggleBtn.setAttribute('aria-label', `Switch to ${nextTheme === 'dark' ? 'light' : 'dark'} mode`);
    });
  }

  // Quick Add Button in header
  const quickAddBtn = document.getElementById('btn-quick-add');
  if (quickAddBtn) {
    quickAddBtn.addEventListener('click', () => openCreateModal('todo'));
  }

  // Column Add Buttons
  document.querySelectorAll('.btn-add-card').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const colId = e.currentTarget.dataset.columnId || 'todo';
      openCreateModal(colId);
    });
  });

  // Modal Cancel & Close Buttons
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCancelModal = document.getElementById('btn-cancel-modal');
  const modal = document.getElementById('card-modal');

  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
  if (btnCancelModal) btnCancelModal.addEventListener('click', closeModal);

  // Close modal when clicking on backdrop
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // Modal Form Submission
  const form = document.getElementById('card-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const taskId = document.getElementById('task-id').value;
      const titleInput = document.getElementById('task-title');
      const descInput = document.getElementById('task-desc');
      const prioritySelect = document.getElementById('task-priority');
      const tagsInput = document.getElementById('task-tags');
      const colInput = document.getElementById('task-column-id');
      const targetColSelect = document.getElementById('task-target-col');
      const errorBanner = document.getElementById('form-error-banner');

      const title = titleInput.value.trim();
      if (!title) {
        errorBanner.hidden = false;
        errorBanner.textContent = 'Task title cannot be empty.';
        titleInput.focus();
        return;
      }

      const cardData = {
        title,
        description: descInput.value.trim(),
        priority: prioritySelect.value,
        tags: parseTags(tagsInput.value)
      };

      if (taskId) {
        // Edit Mode
        const initialCol = colInput.value;
        const chosenCol = targetColSelect ? targetColSelect.value : null;

        if (typeof uiCallbacks.onUpdateCard === 'function') {
          uiCallbacks.onUpdateCard(taskId, cardData);
        }

        // Check if column was changed in modal dropdown
        if (chosenCol && initialCol && chosenCol !== initialCol && typeof uiCallbacks.onMoveCard === 'function') {
          uiCallbacks.onMoveCard(taskId, chosenCol, 0);
        }
      } else {
        // Create Mode
        const targetCol = (targetColSelect && targetColSelect.value) || colInput.value || 'todo';
        if (typeof uiCallbacks.onAddCard === 'function') {
          uiCallbacks.onAddCard(targetCol, cardData);
        }
      }

      closeModal();
    });
  }
}
