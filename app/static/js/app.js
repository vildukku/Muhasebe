/**
 * Kasa & Finans Takip Sistemi - Core SPA Application Engine
 */

const App = {
    state: {
        user: null,
        token: localStorage.getItem('token') || null,
        rates: {},
        currentRoute: 'dashboard',
        accounts: [],
        categories: [],
        currencyDisplay: 'TRY', // 'TRY' or 'USD'
    },

    // Initialize application
    async init() {
        console.log("Finance App initializing...");
        this.setupNavigation();
        this.setupModals();

        // Check if user is logged in
        if (this.state.token) {
            const ok = await this.fetchCurrentUser();
            if (ok) {
                this.showApp();
                await this.fetchRates();
                this.navigate(window.location.hash.replace('#', '') || 'dashboard');
            } else {
                this.showLogin();
            }
        } else {
            this.showLogin();
        }

        // Periodically refresh rates every 2 minutes
        setInterval(() => this.fetchRates(), 120000);
    },

    // HTTP API Request Helper with Bearer Token
    async api(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        if (this.state.token) {
            headers['Authorization'] = `Bearer ${this.state.token}`;
        }

        try {
            const res = await fetch(endpoint, {
                ...options,
                headers
            });

            if (res.status === 401) {
                this.logout(false);
                this.toast("Oturum süreniz doldu, lütfen tekrar giriş yapın.", "warning");
                return null;
            }

            const data = await res.json();
            if (!res.ok || data.error) {
                throw new Error(data.message || 'İşlem başarısız');
            }
            return data;
        } catch (err) {
            console.error(`API Error (${endpoint}):`, err);
            this.toast(err.message || 'Bağlantı hatası oluştu', 'error');
            return null;
        }
    },

    // Fetch Current Logged In User & Permissions
    async fetchCurrentUser() {
        const res = await this.api('/api/auth/me');
        if (res && res.success) {
            this.state.user = res.user;
            this.renderUserProfile();
            return true;
        }
        return false;
    },

    // Fetch Live Exchange & Crypto Rates
    async fetchRates() {
        const res = await this.api('/api/rates');
        if (res && res.success) {
            this.state.rates = res.rates;
            this.renderRatesTicker();
        }
    },

    async syncRates() {
        this.toast("Kurlar güncelleniyor...", "info");
        const res = await this.api('/api/rates/sync', { method: 'POST' });
        if (res && res.success) {
            this.state.rates = res.rates;
            this.renderRatesTicker();
            this.toast("Döviz ve Kripto kurları güncellendi", "success");
            this.refreshCurrentView();
        }
    },

    // Rates Ticker in Topbar
    renderRatesTicker() {
        const el = document.getElementById('rates-ticker');
        if (!el || !this.state.rates) return;

        const r = this.state.rates;
        el.innerHTML = `
            <div class="flex items-center space-x-4 text-xs font-mono text-gray-400">
                <span class="flex items-center space-x-1">
                    <span class="text-gray-500 font-sans">USD/TRY:</span>
                    <span class="text-emerald-400 font-semibold">₺${(r.USD_TRY || 34.20).toFixed(2)}</span>
                </span>
                <span class="flex items-center space-x-1">
                    <span class="text-gray-500 font-sans">EUR/TRY:</span>
                    <span class="text-emerald-400 font-semibold">₺${(r.EUR_TRY || 37.80).toFixed(2)}</span>
                </span>
                <span class="flex items-center space-x-1">
                    <span class="text-gray-500 font-sans">USDT/TRY:</span>
                    <span class="text-amber-400 font-semibold">₺${(r.USDT_TRY || 34.25).toFixed(2)}</span>
                </span>
                <span class="flex items-center space-x-1">
                    <span class="text-gray-500 font-sans">BTC:</span>
                    <span class="text-yellow-400 font-semibold">$${Number(r.BTC_USD || 63500).toLocaleString('en-US')}</span>
                </span>
                <button onclick="App.syncRates()" title="Kurları Canlı Senkronize Et" class="hover:text-blue-400 transition-colors">
                    <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
                </button>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
    },

    // User Profile in Topbar & Sidebar
    renderUserProfile() {
        const u = this.state.user;
        if (!u) return;

        const roleLabels = {
            admin: { name: "Yönetici", color: "bg-red-500/10 text-red-400 border-red-500/20" },
            manager: { name: "Finans Müdürü", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
            operator: { name: "Kasa Sorumlusu", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
            viewer: { name: "Denetçi / İzleyici", color: "bg-slate-500/10 text-slate-400 border-slate-500/20" }
        };

        const roleBadge = roleLabels[u.role] || roleLabels.viewer;

        const userEls = document.querySelectorAll('.user-name-display');
        userEls.forEach(el => el.textContent = u.full_name);

        const userRoleEls = document.querySelectorAll('.user-role-display');
        userRoleEls.forEach(el => {
            el.textContent = roleBadge.name;
            el.className = `user-role-display text-xs px-2 py-0.5 rounded-full border ${roleBadge.color}`;
        });

        // Hide admin-only or manager-only navigation links if no permission
        document.querySelectorAll('[data-permission]').forEach(navItem => {
            const perm = navItem.getAttribute('data-permission');
            if (u.permissions && !u.permissions[perm]) {
                navItem.style.display = 'none';
            } else {
                navItem.style.display = '';
            }
        });
    },

    // View Routing
    setupNavigation() {
        window.addEventListener('hashchange', () => {
            const route = window.location.hash.replace('#', '') || 'dashboard';
            this.navigate(route);
        });

        document.querySelectorAll('[data-route]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const route = link.getAttribute('data-route');
                window.location.hash = route;
            });
        });
    },

    navigate(route) {
        this.state.currentRoute = route;

        // Highlight active nav item
        document.querySelectorAll('[data-route]').forEach(link => {
            if (link.getAttribute('data-route') === route) {
                link.classList.add('bg-blue-600/10', 'text-blue-400', 'border-blue-500');
                link.classList.remove('text-gray-400', 'hover:bg-gray-800/50');
            } else {
                link.classList.remove('bg-blue-600/10', 'text-blue-400', 'border-blue-500');
                link.classList.add('text-gray-400', 'hover:bg-gray-800/50');
            }
        });

        // Load route view
        if (route === 'dashboard') {
            DashboardView.render();
        } else if (route === 'accounts') {
            AccountsView.render();
        } else if (route === 'transactions') {
            TransactionsView.render();
        } else if (route === 'z-reports') {
            ZReportsView.render();
        } else if (route === 'subscriptions') {
            SubscriptionsView.render();
        } else if (route === 'reports') {
            ReportsView.render();
        } else if (route === 'users') {
            UsersView.render();
        } else if (route === 'audit-logs') {
            UsersView.renderAuditLogs();
        } else {
            DashboardView.render();
        }

        window.scrollTo(0, 0);
    },

    refreshCurrentView() {
        this.navigate(this.state.currentRoute);
    },

    // Show/Hide App and Login Screens
    showApp() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.remove('hidden');
    },

    showLogin() {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app-screen').classList.add('hidden');
    },

    // User Login Action
    async login(username, password) {
        const res = await this.api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });

        if (res && res.success) {
            this.state.token = res.token;
            localStorage.setItem('token', res.token);
            this.state.user = res.user;
            await this.fetchCurrentUser();
            this.toast(`Hoş geldiniz, ${res.user.full_name}!`, "success");
            this.showApp();
            await this.fetchRates();
            this.navigate('dashboard');
        }
    },

    // User Logout Action
    async logout(notify = true) {
        if (this.state.token) {
            await this.api('/api/auth/logout', { method: 'POST' });
        }
        localStorage.removeItem('token');
        this.state.token = null;
        this.state.user = null;
        this.showLogin();
        if (notify) this.toast("Güvenli çıkış yapıldı", "info");
    },

    // Universal Toast Notification Engine
    toast(message, type = "info") {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        const colors = {
            success: 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200',
            error: 'bg-rose-950/90 border-rose-500/40 text-rose-200',
            warning: 'bg-amber-950/90 border-amber-500/40 text-amber-200',
            info: 'bg-slate-900/90 border-blue-500/40 text-blue-200'
        };
        const icons = {
            success: 'check-circle',
            error: 'alert-circle',
            warning: 'alert-triangle',
            info: 'info'
        };

        toast.className = `toast-item flex items-center space-x-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl text-sm ${colors[type] || colors.info}`;
        toast.innerHTML = `
            <i data-lucide="${icons[type] || 'info'}" class="w-5 h-5 flex-shrink-0"></i>
            <span class="font-medium">${message}</span>
        `;

        container.appendChild(toast);
        if (window.lucide) lucide.createIcons();

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3800);
    },

    // Modal Helpers
    setupModals() {
        document.querySelectorAll('[data-close-modal]').forEach(btn => {
            btn.addEventListener('click', () => {
                const modal = btn.closest('.modal-backdrop');
                if (modal) modal.classList.add('hidden');
            });
        });

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(m => m.classList.add('hidden'));
            }
        });
    },

    openModal(modalId) {
        const m = document.getElementById(modalId);
        if (m) {
            m.classList.remove('hidden');
            if (window.lucide) lucide.createIcons();
        }
    },

    closeModal(modalId) {
        const m = document.getElementById(modalId);
        if (m) m.classList.add('hidden');
    },

    toggleMobileDrawer() {
        const drawer = document.getElementById('mobile-drawer');
        if (drawer) {
            drawer.classList.toggle('hidden');
            if (window.lucide) lucide.createIcons();
        }
    },

    // Currency Formatter
    formatCurrency(amount, currency = 'TRY', showDecimals = true) {
        const num = Number(amount) || 0;
        const curr = currency.toUpperCase();

        const symbols = {
            TRY: '₺',
            USD: '$',
            EUR: '€',
            GBP: '£',
            USDT: '₮',
            BTC: '₿',
            ETH: 'Ξ'
        };

        const decimals = (curr === 'BTC' || curr === 'ETH') ? 4 : (showDecimals ? 2 : 0);
        const formattedNumber = num.toLocaleString('tr-TR', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });

        const symbol = symbols[curr] || curr;
        return `${symbol} ${formattedNumber}`;
    },

    formatDate(dateStr, includeTime = false) {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr.replace(' ', 'T'));
            if (isNaN(d.getTime())) return dateStr;
            const options = {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {})
            };
            return d.toLocaleDateString('tr-TR', options);
        } catch (e) {
            return dateStr;
        }
    }
};

window.App = App;

// Bootstrap on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
