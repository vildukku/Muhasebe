/**
 * Subscriptions & Recurring Expenses (Abonelikler ve Düzenli Giderler) Module
 */

const SubscriptionsView = {
    subscriptions: [],
    categories: [],
    accounts: [],

    async render() {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="flex items-center justify-center min-h-[400px]">
                <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
            </div>
        `;

        await Promise.all([
            this.loadDependencies(),
            this.fetchSubscriptions()
        ]);

        const canManage = App.state.user && App.state.user.permissions.can_manage_subscriptions;

        // Calculate monthly estimated burn
        let monthlyBurnTry = 0;
        this.subscriptions.filter(s => s.is_active).forEach(s => {
            const rates = App.state.rates || {};
            let tryVal = s.amount;
            if (s.currency === 'USD') tryVal = s.amount * (rates.USD_TRY || 34.20);
            else if (s.currency === 'EUR') tryVal = s.amount * (rates.EUR_TRY || 37.80);
            else if (s.currency === 'USDT') tryVal = s.amount * (rates.USDT_TRY || 34.25);

            if (s.billing_cycle === 'yearly') tryVal /= 12;
            else if (s.billing_cycle === 'weekly') tryVal *= 4.3;

            monthlyBurnTry += tryVal;
        });

        container.innerHTML = `
            <!-- Top Header & Actions -->
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                    <h1 class="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                        <i data-lucide="repeat" class="w-6 h-6 text-purple-400"></i>
                        <span>Abonelikler & Düzenli Giderler</span>
                    </h1>
                    <p class="text-sm text-gray-400 mt-1">Sunucu, SaaS yazılımları, ofis kirası gibi periyodik masraflar ve vade takibi.</p>
                </div>
                <div class="flex items-center space-x-3">
                    ${canManage ? `
                        <button onclick="SubscriptionsView.openSubscriptionModal()" class="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold shadow-lg shadow-purple-900/30 transition-all active:scale-95">
                            <i data-lucide="plus" class="w-4 h-4"></i>
                            <span>+ Yeni Abonelik / Gider Ekle</span>
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- Monthly Burn Rate Banner -->
            <div class="glass-card p-5 mb-8 border-l-4 border-purple-500 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div class="text-xs uppercase font-semibold text-gray-400">Tahmini Aylık Sabit Masraf (Burn Rate)</div>
                    <div class="text-2xl font-extrabold text-white metric-value mt-1">
                        ${App.formatCurrency(monthlyBurnTry, 'TRY')} <span class="text-xs text-gray-400 font-normal">/ ay</span>
                    </div>
                </div>
                <div class="flex items-center space-x-2 text-xs text-gray-400">
                    <i data-lucide="info" class="w-4 h-4 text-purple-400"></i>
                    <span>Tüm döviz ve kripto abonelikleri güncel kurlardan TL'ye endekslenmiştir.</span>
                </div>
            </div>

            <!-- Subscriptions Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
                ${this.subscriptions.length === 0 ? `
                    <div class="col-span-full py-12 text-center text-gray-500">
                        Henüz kayıtlı düzenli abonelik veya sabit gider bulunmuyor.
                    </div>
                ` : this.subscriptions.map(s => this.renderSubscriptionCard(s)).join('')}
            </div>
        `;

        if (window.lucide) lucide.createIcons();
    },

    renderSubscriptionCard(s) {
        const canManage = App.state.user && App.state.user.permissions.can_manage_subscriptions;
        const days = s.days_remaining;

        let statusBadge = '';
        if (days < 0) {
            statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">Vadesi ${Math.abs(days)} Gün Geçti!</span>`;
        } else if (days === 0) {
            statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">Bugün Ödenecek!</span>`;
        } else if (days <= 3) {
            statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">${days} Gün Kaldı</span>`;
        } else {
            statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">${days} Gün Sonra</span>`;
        }

        const cycleLabels = {
            monthly: 'Aylık',
            yearly: 'Yıllık',
            weekly: 'Haftalık',
            quarterly: '3 Aylık'
        };

        return `
            <div class="glass-card p-5 relative flex flex-col justify-between hover:border-purple-500/40 transition-all">
                <div>
                    <div class="flex items-start justify-between mb-3">
                        <div>
                            <h3 class="font-bold text-white text-base">${s.title}</h3>
                            <div class="text-xs text-gray-400">${s.category_name || 'Genel Masraf'} • <span class="capitalize text-purple-300">${cycleLabels[s.billing_cycle] || s.billing_cycle}</span></div>
                        </div>
                        ${statusBadge}
                    </div>

                    <!-- Price & Account -->
                    <div class="my-4">
                        <div class="text-2xl font-extrabold text-white metric-value">
                            ${App.formatCurrency(s.amount, s.currency)}
                        </div>
                        <div class="text-xs text-gray-400 mt-1 flex items-center gap-1.5">
                            <i data-lucide="wallet" class="w-3.5 h-3.5 text-gray-500"></i>
                            <span>Ödenecek Kasa: <strong class="text-gray-300">${s.account_name || 'Belirtilmedi'}</strong></span>
                        </div>
                    </div>

                    <div class="p-3 rounded-xl bg-gray-900/60 border border-gray-800 text-xs space-y-1">
                        <div class="flex justify-between">
                            <span class="text-gray-500">Sonraki Ödeme:</span>
                            <span class="text-gray-300 font-semibold font-mono">${App.formatDate(s.next_due_date)}</span>
                        </div>
                        ${s.last_paid_date ? `
                            <div class="flex justify-between">
                                <span class="text-gray-500">Son Ödeme:</span>
                                <span class="text-gray-400 font-mono">${App.formatDate(s.last_paid_date)}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <!-- Footer Actions -->
                <div class="mt-5 pt-3 border-t border-gray-800 flex items-center justify-between text-xs">
                    <button onclick="SubscriptionsView.paySubscription(${s.id})" class="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 font-semibold transition-colors">
                        <i data-lucide="check" class="w-3.5 h-3.5"></i>
                        <span>Tek Tıkla Öde</span>
                    </button>
                    ${canManage ? `
                        <div class="flex items-center space-x-2">
                            <button onclick="SubscriptionsView.editSubscription(${s.id})" class="p-1 text-gray-400 hover:text-white" title="Düzenle">
                                <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                            </button>
                            <button onclick="SubscriptionsView.deleteSubscription(${s.id}, '${s.title}')" class="p-1 text-rose-400 hover:text-rose-300" title="Sil">
                                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    },

    async loadDependencies() {
        const [catsRes, accsRes] = await Promise.all([
            App.api('/api/categories'),
            App.api('/api/accounts')
        ]);
        if (catsRes && catsRes.success) this.categories = catsRes.categories.filter(c => c.type === 'expense');
        if (accsRes && accsRes.success) this.accounts = accsRes.accounts;
    },

    async fetchSubscriptions() {
        const res = await App.api('/api/subscriptions');
        if (res && res.success) {
            this.subscriptions = res.subscriptions || [];
        }
    },

    async paySubscription(subId) {
        const sub = this.subscriptions.find(s => s.id === subId);
        if (!confirm(`"${sub ? sub.title : 'Abonelik'}" ödemesini ilgili kasadan düşmek ve vadesini bir sonraki döneme aktarmak istiyor musunuz?`)) return;

        const res = await App.api(`/api/subscriptions/${subId}/pay`, { method: 'POST' });
        if (res && res.success) {
            App.toast(res.message || "Ödeme tamamlandı", "success");
            this.render();
        }
    },

    openSubscriptionModal(sub = null) {
        document.getElementById('sub-modal-title').textContent = sub ? 'Aboneliği Düzenle' : 'Yeni Düzenli Masraf / Abonelik Ekle';
        document.getElementById('sub-id').value = sub ? sub.id : '';
        document.getElementById('sub-title').value = sub ? sub.title : '';
        document.getElementById('sub-amount').value = sub ? sub.amount : '';
        document.getElementById('sub-currency').value = sub ? sub.currency : 'TRY';
        document.getElementById('sub-cycle').value = sub ? sub.billing_cycle : 'monthly';
        document.getElementById('sub-due-date').value = sub ? sub.next_due_date : new Date().toISOString().slice(0, 10);
        document.getElementById('sub-notes').value = sub ? (sub.notes || '') : '';

        const catSelect = document.getElementById('sub-category');
        catSelect.innerHTML = `
            <option value="">Kategori Seçin...</option>
            ${this.categories.map(c => `<option value="${c.id}" ${sub && sub.category_id == c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
        `;

        const accSelect = document.getElementById('sub-account');
        accSelect.innerHTML = `
            <option value="">Ödeme Yapılacak Kasa Seçin...</option>
            ${this.accounts.map(a => `<option value="${a.id}" ${sub && sub.account_id == a.id ? 'selected' : ''}>${a.name} (${a.currency})</option>`).join('')}
        `;

        App.openModal('subscription-modal');
    },

    editSubscription(subId) {
        const sub = this.subscriptions.find(s => s.id === subId);
        if (sub) this.openSubscriptionModal(sub);
    },

    async saveSubscription(e) {
        e.preventDefault();
        const id = document.getElementById('sub-id').value;
        const title = document.getElementById('sub-title').value;
        const category_id = document.getElementById('sub-category').value;
        const account_id = document.getElementById('sub-account').value;
        const amount = parseFloat(document.getElementById('sub-amount').value);
        const currency = document.getElementById('sub-currency').value;
        const billing_cycle = document.getElementById('sub-cycle').value;
        const next_due_date = document.getElementById('sub-due-date').value;
        const notes = document.getElementById('sub-notes').value;

        if (!title || !amount) {
            App.toast("Lütfen başlık ve tutar girin", "warning");
            return;
        }

        const payload = {
            title, category_id: category_id ? parseInt(category_id) : null,
            account_id: account_id ? parseInt(account_id) : null,
            amount, currency, billing_cycle, next_due_date, notes
        };

        if (id) {
            const res = await App.api(`/api/subscriptions/${id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            if (res && res.success) {
                App.toast("Abonelik güncellendi", "success");
                App.closeModal('subscription-modal');
                this.render();
            }
        } else {
            const res = await App.api('/api/subscriptions', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (res && res.success) {
                App.toast("Abonelik eklendi", "success");
                App.closeModal('subscription-modal');
                this.render();
            }
        }
    },

    async deleteSubscription(subId, title) {
        if (!confirm(`"${title}" aboneliğini silmek istediğinizden emin misiniz?`)) return;
        const res = await App.api(`/api/subscriptions/${subId}`, { method: 'DELETE' });
        if (res && res.success) {
            App.toast("Abonelik silindi", "info");
            this.render();
        }
    }
};

window.SubscriptionsView = SubscriptionsView;
