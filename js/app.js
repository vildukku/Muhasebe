/**
 * Kasa & Finans Takip Sistemi - Core SPA Application Engine
 * Luxury Apple & Revolut UI with zero-backend GitHub Pages mode.
 */

const App = {
    state: {
        user: null,
        token: localStorage.getItem('finance_pro_token') || null,
        rates: {},
        currentRoute: 'dashboard',
        accounts: [],
        categories: [],
        currencyDisplay: 'TRY',
        isClientOnly: false
    },

    async init() {
        console.log("Finans Pro initializing...");
        this.setupNavigation();
        this.setupModals();

        if (window.location.protocol === 'file:' || window.location.hostname.includes('github.io') || window.location.hostname.includes('vercel.app')) {
            this.state.isClientOnly = true;
        }

        // Check authentication state
        const savedSession = localStorage.getItem('finance_pro_auth_session');
        if (savedSession || this.state.token) {
            const ok = await this.fetchCurrentUser();
            if (ok) {
                this.showApp();
                await this.fetchRates();
                this.navigate(window.location.hash.replace('#', '') || 'dashboard');
                return;
            }
        }

        // Show Luxury Login Screen by default
        this.showLogin();
        if (window.lucide) lucide.createIcons();
    },

    async api(endpoint, options = {}) {
        if (this.state.isClientOnly && window.ClientAPI) {
            try {
                return await ClientAPI.handle(endpoint, options);
            } catch (err) {
                console.error("ClientAPI Error:", err);
                this.toast(err.message || 'İşlem başarısız', 'error');
                return null;
            }
        }

        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        if (this.state.token) {
            headers['Authorization'] = `Bearer ${this.state.token}`;
        }

        try {
            const res = await fetch(endpoint, { ...options, headers });
            if (res.status === 401) {
                this.logout(false);
                return null;
            }
            const data = await res.json();
            if (!res.ok || data.error) {
                throw new Error(data.message || 'İşlem başarısız');
            }
            return data;
        } catch (err) {
            if (window.ClientAPI) {
                this.state.isClientOnly = true;
                return await ClientAPI.handle(endpoint, options);
            }
            console.error(`API Error (${endpoint}):`, err);
            this.toast(err.message || 'Bağlantı hatası oluştu', 'error');
            return null;
        }
    },

    async fetchCurrentUser() {
        const res = await this.api('/api/auth/me');
        if (res && res.success) {
            this.state.user = res.user;
            this.renderUserProfile();
            return true;
        }
        return false;
    },

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
            this.toast("Canlı kurlar güncellendi", "success");
            this.refreshCurrentView();
        }
    },

    renderRatesTicker() {
        const el = document.getElementById('rates-ticker');
        if (!el || !this.state.rates) return;

        const r = this.state.rates;
        el.innerHTML = `
            <div class="flex items-center space-x-3 text-xs font-mono text-gray-400">
                <span class="flex items-center space-x-1">
                    <span class="text-gray-500 font-sans">USD:</span>
                    <span class="text-emerald-400 font-semibold">₺${(r.USD_TRY || 34.20).toFixed(2)}</span>
                </span>
                <span class="flex items-center space-x-1">
                    <span class="text-gray-500 font-sans">EUR:</span>
                    <span class="text-emerald-400 font-semibold">₺${(r.EUR_TRY || 37.80).toFixed(2)}</span>
                </span>
                <span class="flex items-center space-x-1">
                    <span class="text-gray-500 font-sans">USDT:</span>
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

    renderUserProfile() {
        const u = this.state.user;
        if (!u) return;

        const roleLabels = {
            admin: { name: "Yönetici", color: "bg-red-500/10 text-red-400 border-red-500/20" },
            manager: { name: "Finans Müdürü", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
            operator: { name: "Kasa Sorumlusu", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
            viewer: { name: "Denetçi", color: "bg-slate-500/10 text-slate-400 border-slate-500/20" }
        };

        const roleBadge = roleLabels[u.role] || roleLabels.admin;

        document.querySelectorAll('.user-name-display').forEach(el => el.textContent = u.full_name);
        document.querySelectorAll('.user-role-display').forEach(el => {
            el.textContent = roleBadge.name;
            el.className = `user-role-display text-[10px] px-2 py-0.5 rounded-full border ${roleBadge.color}`;
        });
    },

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

        // Bottom nav & Sidebar active highlights
        document.querySelectorAll('[data-route]').forEach(link => {
            if (link.getAttribute('data-route') === route) {
                link.classList.add('text-blue-400', 'font-bold');
                link.classList.remove('text-gray-400');
            } else {
                link.classList.remove('text-blue-400', 'font-bold');
                link.classList.add('text-gray-400');
            }
        });

        if (route === 'dashboard') DashboardView.render();
        else if (route === 'accounts') AccountsView.render();
        else if (route === 'transactions') TransactionsView.render();
        else if (route === 'z-reports') ZReportsView.render();
        else if (route === 'subscriptions') SubscriptionsView.render();
        else if (route === 'reports') ReportsView.render();
        else if (route === 'users') UsersView.render();
        else if (route === 'audit-logs') UsersView.renderAuditLogs();
        else DashboardView.render();

        window.scrollTo(0, 0);
    },

    refreshCurrentView() {
        this.navigate(this.state.currentRoute);
    },

    showApp() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.remove('hidden');
        if (window.lucide) lucide.createIcons();
    },

    showLogin() {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app-screen').classList.add('hidden');
        if (window.lucide) lucide.createIcons();
    },

    async login(username, password) {
        const res = await this.api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });

        if (res && res.success) {
            this.state.token = res.token;
            localStorage.setItem('finance_pro_token', res.token);
            this.state.user = res.user;
            await this.fetchCurrentUser();
            this.toast(`Hoş geldiniz, ${res.user.full_name}!`, "success");
            this.showApp();
            await this.fetchRates();
            this.navigate('dashboard');
        }
    },

    async logout(notify = true) {
        localStorage.removeItem('finance_pro_token');
        localStorage.removeItem('finance_pro_auth_session');
        this.state.token = null;
        this.state.user = null;
        this.showLogin();
        if (notify) this.toast("Güvenli çıkış yapıldı", "info");
    },

    loadDemoData() {
        StorageDB.resetToDemo();
        this.toast("Demo verileri yüklendi", "success");
        this.refreshCurrentView();
    },

    resetToClean() {
        if (!confirm("Tüm kasa ve işlem verilerini sıfırlayıp 0 TL ile temiz başlamak istediğinize emin misiniz?")) return;
        StorageDB.resetToClean();
        this.toast("Sistem sıfırlandı. Temiz kasa başlangıcı hazır.", "info");
        this.refreshCurrentView();
    },

    toast(message, type = "info") {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        const colors = {
            success: 'bg-emerald-950/95 border-emerald-500/40 text-emerald-200',
            error: 'bg-rose-950/95 border-rose-500/40 text-rose-200',
            warning: 'bg-amber-950/95 border-amber-500/40 text-amber-200',
            info: 'bg-slate-900/95 border-blue-500/40 text-blue-200'
        };
        const icons = {
            success: 'check-circle',
            error: 'alert-circle',
            warning: 'alert-triangle',
            info: 'info'
        };

        toast.className = `toast-item flex items-center space-x-3 px-4 py-3 rounded-2xl border backdrop-blur-xl shadow-2xl text-xs font-semibold ${colors[type] || colors.info}`;
        toast.innerHTML = `
            <i data-lucide="${icons[type] || 'info'}" class="w-4 h-4 flex-shrink-0"></i>
            <span>${message}</span>
        `;

        container.appendChild(toast);
        if (window.lucide) lucide.createIcons();

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    },

    setupModals() {
        document.querySelectorAll('[data-close-modal]').forEach(btn => {
            btn.addEventListener('click', () => {
                const modal = btn.closest('.modal-backdrop');
                if (modal) modal.classList.add('hidden');
            });
        });

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

    formatCurrency(amount, currency = 'TRY', showDecimals = true) {
        const num = Number(amount) || 0;
        const curr = (currency || 'TRY').toUpperCase();

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
                ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {})
            };
            return d.toLocaleDateString('tr-TR', options);
        } catch (e) {
            return dateStr;
        }
    }
};

window.App = App;

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
