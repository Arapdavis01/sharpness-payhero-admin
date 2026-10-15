/* =========================================================
   Admin Panel Logic
   Reads config from window.RUNTIME_CONFIG
   ========================================================= */

(function () {
    'use strict';

    const config = window.RUNTIME_CONFIG || {};
    const API_BASE = config.API_BASE || '';
    const API = API_BASE + '/api/admin';

    const TOKEN_KEY = 'eaglemaster_admin_token';
    const ADMIN_KEY = 'eaglemaster_admin_user';

    // ---------- State ----------
    const state = {
        token: localStorage.getItem(TOKEN_KEY) || null,
        admin: JSON.parse(localStorage.getItem(ADMIN_KEY) || 'null'),
        currentView: 'overview',
        txPage: 1,
        txLimit: 20,
        txFilters: { q: '', status: '', provider: '', from: '', to: '' },
        txTotalPages: 1,
    };

    // ---------- DOM refs ----------
    const $ = (sel) => document.querySelector(sel);

    const loginView = $('#loginView');
    const dashboardView = $('#dashboardView');
    const loginForm = $('#loginForm');
    const loginEmail = $('#loginEmail');
    const loginPassword = $('#loginPassword');
    const loginBtn = $('#loginBtn');
    const loginStatus = $('#loginStatus');
    const togglePassword = $('#togglePassword');

    const adminName = $('#adminName');
    const adminEmail = $('#adminEmail');
    const adminAvatar = $('#adminAvatar');
    const logoutBtn = $('#logoutBtn');
    const sidebar = $('#sidebar');
    const menuToggle = $('#menuToggle');
    const refreshBtn = $('#refreshBtn');
    const pageTitle = $('#pageTitle');

    const overviewView = $('#overviewView');
    const transactionsView = $('#transactionsView');
    const navItems = document.querySelectorAll('.nav-item');

    const statTotal = $('#statTotal');
    const statSuccessCount = $('#statSuccessCount');
    const statSuccessSum = $('#statSuccessSum');
    const statFailed = $('#statFailed');
    const statPending = $('#statPending');
    const statRate = $('#statRate');
    const statToday = $('#statToday');
    const statTodaySum = $('#statTodaySum');
    const recentTableBody = $('#recentTable tbody');

    const txTableBody = $('#txTable tbody');
    const filterSearch = $('#filterSearch');
    const filterStatus = $('#filterStatus');
    const filterProvider = $('#filterProvider');
    const filterFrom = $('#filterFrom');
    const filterTo = $('#filterTo');
    const clearFilters = $('#clearFilters');
    const prevPage = $('#prevPage');
    const nextPage = $('#nextPage');
    const pageInfo = $('#pageInfo');

    const drawerOverlay = $('#drawerOverlay');
    const drawerClose = $('#drawerClose');
    const drawerBody = $('#drawerBody');

    const toast = $('#toast');

    // ---------- Utilities ----------
    function showToast(message, type) {
        toast.textContent = message;
        toast.className = 'toast show' + (type === 'error' ? ' error' : '');
        setTimeout(() => toast.classList.remove('show'), 3200);
    }

    function setLoading(btn, loading) {
        btn.classList.toggle('loading', loading);
        btn.disabled = loading;
    }

    function formatCurrency(n) {
        const num = Number(n) || 0;
        return 'KES ' + num.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatDate(iso) {
        if (!iso) return '—';
        const d = new Date(iso);
        return d.toLocaleString('en-KE', {
            year: 'numeric', month: 'short', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
    }

    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    async function apiFetch(path, options) {
        const opts = options || {};
        const headers = Object.assign(
            { 'Content-Type': 'application/json' },
            opts.headers || {},
            state.token ? { Authorization: 'Bearer ' + state.token } : {}
        );

        const res = await fetch(API + path, Object.assign({}, opts, { headers }));

        if (res.status === 401) {
            logout();
            throw new Error('Session expired. Please sign in again.');
        }

        const text = await res.text();
        let data;
        try { data = text ? JSON.parse(text) : {}; }
        catch { data = { message: text }; }

        if (!res.ok) {
            throw new Error(data.message || ('HTTP ' + res.status));
        }
        return data;
    }

    // ---------- Auth ----------
    function showLogin() {
        loginView.classList.remove('hidden');
        dashboardView.classList.add('hidden');
    }

    function showDashboard() {
        loginView.classList.add('hidden');
        dashboardView.classList.remove('hidden');

        adminName.textContent = state.admin?.name || 'Admin';
        adminEmail.textContent = state.admin?.email || '';
        adminAvatar.textContent = (state.admin?.name || 'A').charAt(0).toUpperCase();

        switchView('overview');
    }

    function logout() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(ADMIN_KEY);
        state.token = null;
        state.admin = null;
        showLogin();
    }

    // ---------- Login handler ----------
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginStatus.className = 'status';
        setLoading(loginBtn, true);

        try {
            const res = await fetch(API_BASE + '/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: loginEmail.value.trim(),
                    password: loginPassword.value,
                }),
            });

            const text = await res.text();
            let data;
            try { data = JSON.parse(text); }
            catch { data = { message: text }; }

            if (!res.ok || !data.success) {
                throw new Error(data.message || 'Login failed');
            }

            state.token = data.token;
            state.admin = data.admin;
            localStorage.setItem(TOKEN_KEY, data.token);
            localStorage.setItem(ADMIN_KEY, JSON.stringify(data.admin));

            loginForm.reset();
            showDashboard();
            loadStats();
        } catch (err) {
            loginStatus.className = 'status show error';
            loginStatus.textContent = err.message;
        } finally {
            setLoading(loginBtn, false);
        }
    });

    togglePassword.addEventListener('click', () => {
        const type = loginPassword.type === 'password' ? 'text' : 'password';
        loginPassword.type = type;
        togglePassword.innerHTML = type === 'password'
            ? '<i class="fas fa-eye"></i>'
            : '<i class="fas fa-eye-slash"></i>';
    });

    logoutBtn.addEventListener('click', logout);

    // ---------- View switching ----------
    function switchView(view) {
        state.currentView = view;
        navItems.forEach((n) => n.classList.toggle('active', n.dataset.view === view));
        overviewView.classList.toggle('hidden', view !== 'overview');
        transactionsView.classList.toggle('hidden', view !== 'transactions');
        pageTitle.textContent = view === 'overview' ? 'Overview' : 'Transactions';

        if (window.innerWidth <= 900) sidebar.classList.remove('open');

        if (view === 'overview') loadStats();
        else loadTransactions();
    }

    navItems.forEach((n) => {
        n.addEventListener('click', (e) => {
            e.preventDefault();
            switchView(n.dataset.view);
        });
    });

    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    refreshBtn.addEventListener('click', () => {
        if (state.currentView === 'overview') loadStats();
        else loadTransactions();
    });

    // ---------- Stats ----------
    async function loadStats() {
        try {
            const res = await apiFetch('/stats');
            const s = res.data;
            statTotal.textContent = s.total;
            statSuccessCount.textContent = s.successCount;
            statSuccessSum.textContent = formatCurrency(s.successSum);
            statFailed.textContent = s.failedCount;
            statPending.textContent = s.pendingCount;
            statRate.textContent = s.successRate + '%';
            statToday.textContent = s.today.count;
            statTodaySum.textContent = formatCurrency(s.today.sum);
            renderRecent(s.recent);
        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    function renderRecent(rows) {
        if (!rows || rows.length === 0) {
            recentTableBody.innerHTML = '<tr><td colspan="5" class="empty-row">No transactions yet</td></tr>';
            return;
        }

        recentTableBody.innerHTML = rows.map((r) => `
            <tr>
                <td class="ref-cell">${escapeHtml(r.reference)}</td>
                <td>${escapeHtml(r.phone)}</td>
                <td>${escapeHtml(formatCurrency(r.amount))}</td>
                <td><span class="badge ${escapeHtml(r.status)}">${escapeHtml(r.status)}</span></td>
                <td>${escapeHtml(formatDate(r.createdAt))}</td>
            </tr>
        `).join('');
    }

    // ---------- Transactions ----------
    async function loadTransactions() {
        try {
            const params = new URLSearchParams();
            params.set('page', state.txPage);
            params.set('limit', state.txLimit);

            Object.entries(state.txFilters).forEach(([k, v]) => {
                if (v) params.set(k, v);
            });

            const res = await apiFetch('/transactions?' + params.toString());
            state.txTotalPages = res.pagination.pages || 1;
            renderTransactions(res.data);
            updatePagination();
        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    function renderTransactions(rows) {
        if (!rows || rows.length === 0) {
            txTableBody.innerHTML = '<tr><td colspan="8" class="empty-row">No transactions found</td></tr>';
            return;
        }

        txTableBody.innerHTML = rows.map((r) => `
            <tr>
                <td class="ref-cell">${escapeHtml(r.reference)}</td>
                <td>${escapeHtml(r.customerName || '—')}</td>
                <td>${escapeHtml(r.phone)}</td>
                <td>${escapeHtml(formatCurrency(r.amount))}</td>
                <td>${escapeHtml(r.provider)}</td>
                <td><span class="badge ${escapeHtml(r.status)}">${escapeHtml(r.status)}</span></td>
                <td>${escapeHtml(formatDate(r.createdAt))}</td>
                <td>
                    <button class="row-action" data-id="${escapeHtml(r._id)}" title="View details">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        txTableBody.querySelectorAll('.row-action').forEach((btn) => {
            btn.addEventListener('click', () => openDrawer(btn.dataset.id));
        });
    }

    function updatePagination() {
        pageInfo.textContent = 'Page ' + state.txPage + ' of ' + state.txTotalPages;
        prevPage.disabled = state.txPage <= 1;
        nextPage.disabled = state.txPage >= state.txTotalPages;
    }

    prevPage.addEventListener('click', () => {
        if (state.txPage > 1) {
            state.txPage--;
            loadTransactions();
        }
    });

    nextPage.addEventListener('click', () => {
        if (state.txPage < state.txTotalPages) {
            state.txPage++;
            loadTransactions();
        }
    });

    // Debounced search
    let searchTimer;
    filterSearch.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            state.txFilters.q = filterSearch.value.trim();
            state.txPage = 1;
            if (state.currentView === 'transactions') loadTransactions();
        }, 350);
    });

    filterStatus.addEventListener('change', () => {
        state.txFilters.status = filterStatus.value;
        state.txPage = 1;
        loadTransactions();
    });

    filterProvider.addEventListener('change', () => {
        state.txFilters.provider = filterProvider.value;
        state.txPage = 1;
        loadTransactions();
    });

    filterFrom.addEventListener('change', () => {
        state.txFilters.from = filterFrom.value;
        state.txPage = 1;
        loadTransactions();
    });

    filterTo.addEventListener('change', () => {
        state.txFilters.to = filterTo.value;
        state.txPage = 1;
        loadTransactions();
    });

    clearFilters.addEventListener('click', () => {
        filterSearch.value = '';
        filterStatus.value = '';
        filterProvider.value = '';
        filterFrom.value = '';
        filterTo.value = '';
        state.txFilters = { q: '', status: '', provider: '', from: '', to: '' };
        state.txPage = 1;
        loadTransactions();
    });

    // ---------- Drawer ----------
    async function openDrawer(id) {
        drawerOverlay.classList.add('active');
        drawerBody.innerHTML = '<p style="text-align:center;color:rgba(255,255,255,0.4)">Loading...</p>';

        try {
            const res = await apiFetch('/transactions/' + id);
            renderDrawer(res.data);
        } catch (err) {
            drawerBody.innerHTML = '<p style="color:#ff8886">' + escapeHtml(err.message) + '</p>';
        }
    }

    function renderDrawer(tx) {
        const safe = (v) => escapeHtml(v == null ? '—' : v);
        const json = (v) => v ? JSON.stringify(v, null, 2) : '—';

        drawerBody.innerHTML = `
            <div class="drawer-section">
                <h4>Transaction</h4>
                <div class="drawer-row"><span class="label">Reference</span><span class="value">${safe(tx.reference)}</span></div>
                <div class="drawer-row"><span class="label">Status</span><span class="value"><span class="badge ${escapeHtml(tx.status)}">${escapeHtml(tx.status)}</span></span></div>
                <div class="drawer-row"><span class="label">Amount</span><span class="value">${safe(formatCurrency(tx.amount))}</span></div>
                <div class="drawer-row"><span class="label">Provider</span><span class="value">${safe(tx.provider)}</span></div>
                <div class="drawer-row"><span class="label">Method</span><span class="value">${safe(tx.method)}</span></div>
            </div>

            <div class="drawer-section">
                <h4>Customer</h4>
                <div class="drawer-row"><span class="label">Name</span><span class="value">${safe(tx.customerName)}</span></div>
                <div class="drawer-row"><span class="label">Phone</span><span class="value">${safe(tx.phone)}</span></div>
            </div>

            <div class="drawer-section">
                <h4>Timeline</h4>
                <div class="drawer-row"><span class="label">Initiated</span><span class="value">${safe(formatDate(tx.initiatedAt || tx.createdAt))}</span></div>
                <div class="drawer-row"><span class="label">Completed</span><span class="value">${safe(tx.completedAt ? formatDate(tx.completedAt) : '—')}</span></div>
            </div>

            <div class="drawer-section">
                <h4>PayHero Result</h4>
                <div class="drawer-row"><span class="label">Result Code</span><span class="value">${safe(tx.resultCode)}</span></div>
                <div class="drawer-row"><span class="label">Description</span><span class="value">${safe(tx.resultDescription)}</span></div>
                <div class="drawer-row"><span class="label">Checkout Req ID</span><span class="value">${safe(tx.checkoutRequestId)}</span></div>
            </div>

            <div class="drawer-section">
                <h4>Initiate Response</h4>
                <pre class="drawer-pre">${escapeHtml(json(tx.initiateResponse))}</pre>
            </div>

            <div class="drawer-section">
                <h4>Callback Payload</h4>
                <pre class="drawer-pre">${escapeHtml(json(tx.callbackPayload))}</pre>
            </div>
        `;
    }

    drawerClose.addEventListener('click', () => drawerOverlay.classList.remove('active'));
    drawerOverlay.addEventListener('click', (e) => {
        if (e.target === drawerOverlay) drawerOverlay.classList.remove('active');
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') drawerOverlay.classList.remove('active');
    });

    // ---------- Boot ----------
    if (state.token && state.admin) {
        // Verify the token is still valid before showing dashboard
        apiFetch('/me')
            .then((res) => {
                state.admin = res.admin;
                localStorage.setItem(ADMIN_KEY, JSON.stringify(res.admin));
                showDashboard();
                loadStats();
            })
            .catch(() => {
                logout();
            });
    } else {
        showLogin();
    }
})();
