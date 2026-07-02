// ── Admin Dashboard ─────────────────────────────────────────

function escapeHTML(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const statusEl = document.getElementById('adminStatus');

function showStatus(message, isError) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#f5576c' : '';
  if (message) setTimeout(() => { statusEl.textContent = ''; }, 4000);
}

async function apiFetch(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch {
    showStatus('Cannot reach server — make sure it is running.', true);
    throw new Error('network error');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    showStatus(data.error || 'Request failed', true);
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

// ── Tabs ─────────────────────────────────────────────────────

document.querySelectorAll('.admin-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.admin-panel').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('adminPanel' + tab.dataset.tab[0].toUpperCase() + tab.dataset.tab.slice(1)).classList.add('active');
  });
});

// ── Users ────────────────────────────────────────────────────

async function loadUsers() {
  const body = document.getElementById('adminUsersBody');
  body.innerHTML = '<tr><td colspan="7">Loading…</td></tr>';
  let data;
  try {
    data = await apiFetch('/api/admin/users/');
  } catch {
    body.innerHTML = '<tr><td colspan="7">Failed to load users.</td></tr>';
    return;
  }
  body.innerHTML = '';
  data.users.forEach((u) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHTML(u.username)}</td>
      <td>${escapeHTML(u.display_name)}</td>
      <td>${escapeHTML(u.email)}</td>
      <td>${u.post_count}</td>
      <td>${new Date(u.date_joined).toLocaleDateString()}</td>
      <td>
        ${u.is_staff ? '<span class="admin-badge staff">Staff</span>' : ''}
        ${u.is_banned ? '<span class="admin-badge banned">Banned</span>' : '<span class="admin-badge active">Active</span>'}
      </td>
      <td>
        <button class="admin-action-btn" data-action="staff" data-username="${escapeHTML(u.username)}">${u.is_staff ? 'Remove Admin' : 'Make Admin'}</button>
        <button class="admin-action-btn ${u.is_banned ? '' : 'danger'}" data-action="ban" data-username="${escapeHTML(u.username)}">${u.is_banned ? 'Unban' : 'Ban'}</button>
      </td>
    `;
    body.appendChild(tr);
  });

  body.querySelectorAll('[data-action="ban"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const username = btn.dataset.username;
      if (!confirm(`${btn.textContent} user @${username}?`)) return;
      try {
        await apiFetch(`/api/admin/users/${encodeURIComponent(username)}/ban/`, { method: 'POST' });
        showStatus('Updated.');
        loadUsers();
      } catch {
        // error already shown
      }
    });
  });

  body.querySelectorAll('[data-action="staff"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const username = btn.dataset.username;
      if (!confirm(`${btn.textContent} @${username}?`)) return;
      try {
        await apiFetch(`/api/admin/users/${encodeURIComponent(username)}/toggle-staff/`, { method: 'POST' });
        showStatus('Updated.');
        loadUsers();
      } catch {
        // error already shown
      }
    });
  });
}

// ── Posts ────────────────────────────────────────────────────

async function loadPosts(query) {
  const body = document.getElementById('adminPostsBody');
  body.innerHTML = '<tr><td colspan="5">Loading…</td></tr>';
  let data;
  try {
    const url = query ? `/api/admin/posts/?q=${encodeURIComponent(query)}` : '/api/admin/posts/';
    data = await apiFetch(url);
  } catch {
    body.innerHTML = '<tr><td colspan="5">Failed to load posts.</td></tr>';
    return;
  }
  body.innerHTML = '';
  if (data.posts.length === 0) {
    body.innerHTML = '<tr><td colspan="5">No posts found.</td></tr>';
    return;
  }
  data.posts.forEach((p) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHTML(p.board)}</td>
      <td>${escapeHTML(p.username)}</td>
      <td class="admin-text-cell">${escapeHTML(p.text)}</td>
      <td>${escapeHTML(p.time)}</td>
      <td><button class="admin-action-btn danger" data-id="${p.id}">Delete</button></td>
    `;
    body.appendChild(tr);
  });

  body.querySelectorAll('.admin-action-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this post?')) return;
      try {
        await apiFetch(`/api/posts/${btn.dataset.id}/`, { method: 'DELETE' });
        showStatus('Post deleted.');
        btn.closest('tr').remove();
      } catch {
        // error already shown
      }
    });
  });
}

document.getElementById('adminPostSearchBtn').addEventListener('click', () => {
  loadPosts(document.getElementById('adminPostSearch').value.trim());
});
document.getElementById('adminPostSearch').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loadPosts(e.target.value.trim());
});

// ── Boards ───────────────────────────────────────────────────

async function loadBoards() {
  const body = document.getElementById('adminBoardsBody');
  body.innerHTML = '<tr><td colspan="4">Loading…</td></tr>';
  let data;
  try {
    data = await apiFetch('/api/boards/');
  } catch {
    body.innerHTML = '<tr><td colspan="4">Failed to load boards.</td></tr>';
    return;
  }
  body.innerHTML = '';
  data.boards.forEach((b) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="admin-color-swatch" style="background:${escapeHTML(b.color)}"></span></td>
      <td class="admin-board-name">${escapeHTML(b.name)}</td>
      <td>${b.post_count}</td>
      <td>
        <button class="admin-action-btn" data-action="rename" data-id="${b.id}" data-name="${escapeHTML(b.name)}">Rename</button>
        <button class="admin-action-btn danger" data-action="delete" data-id="${b.id}" data-name="${escapeHTML(b.name)}">Delete</button>
      </td>
    `;
    body.appendChild(tr);
  });

  body.querySelectorAll('[data-action="rename"]').forEach((btn) => {
    btn.addEventListener('click', () => startBoardRename(btn));
  });
  body.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Delete board "${btn.dataset.name}"? This also deletes all of its posts.`)) return;
      try {
        await apiFetch(`/api/boards/${btn.dataset.id}/`, { method: 'DELETE' });
        showStatus('Board deleted.');
        loadBoards();
      } catch {
        // error already shown
      }
    });
  });
}

function startBoardRename(btn) {
  const cell = btn.closest('tr').querySelector('.admin-board-name');
  const currentName = btn.dataset.name;
  cell.innerHTML = `<input type="text" class="admin-inline-input" value="${escapeHTML(currentName)}">`;
  const input = cell.querySelector('input');
  input.focus();
  input.select();

  const save = async () => {
    const newName = input.value.trim();
    if (!newName || newName === currentName) {
      loadBoards();
      return;
    }
    try {
      await apiFetch(`/api/boards/${btn.dataset.id}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });
      showStatus('Board renamed.');
    } catch {
      // error already shown
    }
    loadBoards();
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') loadBoards();
  });
  input.addEventListener('blur', save);
}

document.getElementById('adminAddBoardBtn').addEventListener('click', async () => {
  const nameInput = document.getElementById('adminNewBoardName');
  const colorInput = document.getElementById('adminNewBoardColor');
  const name = nameInput.value.trim();
  if (!name) return;
  try {
    await apiFetch('/api/boards/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color: colorInput.value }),
    });
    showStatus('Board created.');
    nameInput.value = '';
    loadBoards();
  } catch {
    // error already shown
  }
});

// ── Quotes ───────────────────────────────────────────────────

async function loadQuotes() {
  const body = document.getElementById('adminQuotesBody');
  body.innerHTML = '<tr><td colspan="2">Loading…</td></tr>';
  let data;
  try {
    data = await apiFetch('/api/admin/quotes/');
  } catch {
    body.innerHTML = '<tr><td colspan="2">Failed to load quotes.</td></tr>';
    return;
  }
  body.innerHTML = '';
  data.quotes.forEach((q) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="admin-quote-text">${escapeHTML(q.text)}</td>
      <td>
        <button class="admin-action-btn" data-action="edit" data-id="${q.id}" data-text="${escapeHTML(q.text)}">Edit</button>
        <button class="admin-action-btn danger" data-action="delete" data-id="${q.id}">Delete</button>
      </td>
    `;
    body.appendChild(tr);
  });

  body.querySelectorAll('[data-action="edit"]').forEach((btn) => {
    btn.addEventListener('click', () => startQuoteEdit(btn));
  });
  body.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this quote?')) return;
      try {
        await apiFetch(`/api/admin/quotes/${btn.dataset.id}/`, { method: 'DELETE' });
        showStatus('Quote deleted.');
        loadQuotes();
      } catch {
        // error already shown
      }
    });
  });
}

function startQuoteEdit(btn) {
  const cell = btn.closest('tr').querySelector('.admin-quote-text');
  const currentText = btn.dataset.text;
  cell.innerHTML = `<input type="text" class="admin-inline-input" value="${escapeHTML(currentText)}">`;
  const input = cell.querySelector('input');
  input.focus();
  input.select();

  const save = async () => {
    const newText = input.value.trim();
    if (!newText || newText === currentText) {
      loadQuotes();
      return;
    }
    try {
      await apiFetch(`/api/admin/quotes/${btn.dataset.id}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newText }),
      });
      showStatus('Quote updated.');
    } catch {
      // error already shown
    }
    loadQuotes();
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') loadQuotes();
  });
  input.addEventListener('blur', save);
}

document.getElementById('adminAddQuoteBtn').addEventListener('click', async () => {
  const textInput = document.getElementById('adminNewQuoteText');
  const text = textInput.value.trim();
  if (!text) return;
  try {
    await apiFetch('/api/admin/quotes/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    showStatus('Quote added.');
    textInput.value = '';
    loadQuotes();
  } catch {
    // error already shown
  }
});

// ── Init ─────────────────────────────────────────────────────

loadUsers();
loadPosts();
loadBoards();
loadQuotes();
