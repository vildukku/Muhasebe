/**
 * Accounts & Multi-Vault Management Module (Bank, Cash, Crypto)
 */

const AccountsView = {
    accounts: [],

    async render() {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="flex items-center justify-center min-h-[400px]">
                <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
            </div>
        `;

        const res = await App.api('/api/accounts');
        if (!res || !res.success) {
            container.innerHTML = `<div class="p-8 text-center text-red-400">Kasalar yüklenemedi.</div>`;
            return;
        }

        this.accounts = res.accounts || [];
        App.state.accounts = this.accounts;

        const bankAccounts = this.accounts.filter(a => a.account_type === 'bank');
        const cashAccounts = this.accounts.filter(a => a.account_type === 'cash');
        const cryptoAccounts = this.accounts.filter(a => a.account_type === 'crypto');

        const canManage = App.state.user && App.state.user.permissions.can_manage_accounts;
        const canTransfer = App.state.user && App.state.user.permissions.can_transfer;

        container.innerHTML = `
            <!-- Top Header -->
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
                <div>
                    <h1 class="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                        <i data-lucide="layers" class="w-6 h-6 text-blue-400"></i>
                        <span>Kasa & Hesap Yönetimi</span>
                    </h1>
                    <p class="text-sm text-gray-400 mt-1">Banka IBAN'ları, elden nakit kasalar ve kripto cüzdanlarınızın yönetimi.</p>
                </div>
                <div class="flex items-center space-x-3">
                    ${canTransfer ? `
                        <button onclick="AccountsView.openTransferModal()" class="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-900/30 transition-all active:scale-95">
                            <i data-lucide="arrow-left-right" class="w-4 h-4"></i>
                            <span>Kasalar Arası Transfer</span>
                        </button>
                    ` : ''}
                    ${canManage ? `
                        <button onclick="AccountsView.openAccountModal()" class="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold border border-gray-700 transition-all active:scale-95">
                            <i data-lucide="plus" class="w-4 h-4"></i>
                            <span>+ Yeni Kasa Ekle</span>
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- 1. BANK ACCOUNTS SECTION -->
            <div class="mb-10">
                <div class="flex items-center justify-between mb-4 border-b border-gray-800 pb-2">
                    <h2 class="text-lg font-bold text-white flex items-center gap-2">
                        <i data-lucide="building-2" class="w-5 h-5 text-emerald-400"></i>
                        <span>Banka Hesapları (IBAN)</span>
                    </h2>
                    <span class="text-xs text-gray-400">${bankAccounts.length} Hesap</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    ${bankAccounts.map(acc => this.renderAccountCard(acc)).join('')}
                </div>
            </div>

            <!-- 2. CASH VAULTS SECTION -->
            <div class="mb-10">
                <div class="flex items-center justify-between mb-4 border-b border-gray-800 pb-2">
                    <h2 class="text-lg font-bold text-white flex items-center gap-2">
                        <i data-lucide="banknote" class="w-5 h-5 text-amber-400"></i>
                        <span>Elden Nakit Kasalar</span>
                    </h2>
                    <span class="text-xs text-gray-400">${cashAccounts.length} Kasa</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    ${cashAccounts.map(acc => this.renderAccountCard(acc)).join('')}
                </div>
            </div>

            <!-- 3. CRYPTO WALLETS SECTION -->
            <div class="mb-10">
                <div class="flex items-center justify-between mb-4 border-b border-gray-800 pb-2">
                    <h2 class="text-lg font-bold text-white flex items-center gap-2">
                        <i data-lucide="coins" class="w-5 h-5 text-orange-400"></i>
                        <span>Kripto Para Cüzdanları</span>
                    </h2>
                    <span class="text-xs text-gray-400">${cryptoAccounts.length} Cüzdan</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    ${cryptoAccounts.map(acc => this.renderAccountCard(acc)).join('')}
                </div>
            </div>
        `;

        if (window.lucide) lucide.createIcons();
    },

    renderAccountCard(acc) {
        const canManage = App.state.user && App.state.user.permissions.can_manage_accounts;
        const isNonTRY = acc.currency !== 'TRY';

        return `
            <div class="glass-card p-5 relative overflow-hidden flex flex-col justify-between hover:border-blue-500/40 transition-all">
                <div>
                    <div class="flex items-start justify-between mb-3">
                        <div class="flex items-center space-x-3">
                            <div class="p-2.5 rounded-xl bg-gray-800/80 text-blue-400 border border-gray-700/50">
                                <i data-lucide="${acc.icon || 'wallet'}" class="w-5 h-5"></i>
                            </div>
                            <div>
                                <h3 class="font-bold text-white text-base">${acc.name}</h3>
                                <div class="text-xs text-gray-400">${acc.bank_name || (acc.account_type === 'cash' ? 'Fiziksel Kasa' : 'Kripto Cüzdan')}</div>
                            </div>
                        </div>
                        <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase bg-gray-800 text-gray-300 border border-gray-700">
                            ${acc.currency}
                        </span>
                    </div>

                    <!-- Current Balance -->
                    <div class="my-4">
                        <div class="text-2xl font-extrabold text-white metric-value">
                            ${App.formatCurrency(acc.current_balance, acc.currency)}
                        </div>
                        ${isNonTRY ? `
                            <div class="text-xs text-emerald-400 font-mono mt-0.5">
                                ≈ ${App.formatCurrency(acc.balance_in_try, 'TRY')}
                            </div>
                        ` : `
                            <div class="text-xs text-gray-400 font-mono mt-0.5">
                                ≈ ${App.formatCurrency(acc.balance_in_usd, 'USD')}
                            </div>
                        `}
                    </div>

                    <!-- IBAN / Address with Copy -->
                    ${acc.iban_or_address ? `
                        <div class="mt-3 p-2.5 rounded-lg bg-gray-900/60 border border-gray-800 flex items-center justify-between text-xs font-mono text-gray-400">
                            <span class="truncate max-w-[200px]" title="${acc.iban_or_address}">${acc.iban_or_address}</span>
                            <button onclick="AccountsView.copyText('${acc.iban_or_address}')" class="text-blue-400 hover:text-blue-300 ml-2 p-1 rounded hover:bg-gray-800 transition-colors" title="Kopyala">
                                <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                            </button>
                        </div>
                    ` : ''}

                    ${acc.notes ? `
                        <div class="mt-2 text-xs text-gray-400 italic truncate" title="${acc.notes}">${acc.notes}</div>
                    ` : ''}
                </div>

                <!-- Footer Actions -->
                <div class="mt-5 pt-3 border-t border-gray-800/80 flex items-center justify-between text-xs">
                    <button onclick="TransactionsView.filterByAccount(${acc.id})" class="text-blue-400 hover:text-blue-300 font-medium">
                        Hareketleri İncele →
                    </button>
                    ${canManage ? `
                        <div class="flex items-center space-x-2">
                            <button onclick="AccountsView.editAccount(${acc.id})" class="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-800 transition-colors" title="Düzenle">
                                <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                            </button>
                            <button onclick="AccountsView.deleteAccount(${acc.id}, '${acc.name}')" class="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-900/20 transition-colors" title="Arşivle / Sil">
                                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    },

    copyText(text) {
        navigator.clipboard.writeText(text).then(() => {
            App.toast("Adres / IBAN panoya kopyalandı", "success");
        }).catch(() => {
            App.toast("Kopyalama başarısız", "error");
        });
    },

    // Open Transfer (Virman) Modal
    openTransferModal(preselectedFromId = null) {
        const fromSelect = document.getElementById('transfer-from-account');
        const toSelect = document.getElementById('transfer-to-account');

        if (!fromSelect || !toSelect) return;

        const optionsHtml = this.accounts.map(a => `
            <option value="${a.id}" data-currency="${a.currency}" data-balance="${a.current_balance}">
                ${a.name} (${App.formatCurrency(a.current_balance, a.currency)})
            </option>
        `).join('');

        fromSelect.innerHTML = optionsHtml;
        toSelect.innerHTML = optionsHtml;

        if (preselectedFromId) {
            fromSelect.value = preselectedFromId;
        }

        // Set toSelect to a different account
        if (this.accounts.length > 1) {
            const differentAcc = this.accounts.find(a => a.id != fromSelect.value);
            if (differentAcc) toSelect.value = differentAcc.id;
        }

        this.calculateTransferConversion();
        App.openModal('transfer-modal');
    },

    // Real-time calculation for transfer currency conversion
    calculateTransferConversion() {
        const fromSelect = document.getElementById('transfer-from-account');
        const toSelect = document.getElementById('transfer-to-account');
        const amountInput = document.getElementById('transfer-amount');
        const targetAmountInput = document.getElementById('transfer-target-amount');
        const infoEl = document.getElementById('transfer-conversion-info');

        if (!fromSelect || !toSelect || !amountInput || !targetAmountInput) return;

        const fromAcc = this.accounts.find(a => a.id == fromSelect.value);
        const toAcc = this.accounts.find(a => a.id == toSelect.value);
        const amount = parseFloat(amountInput.value) || 0;

        if (!fromAcc || !toAcc || amount <= 0) {
            targetAmountInput.value = '';
            if (infoEl) infoEl.innerHTML = '';
            return;
        }

        const rates = App.state.rates || {};
        let converted = amount;

        // Perform calculation using frontend rates
        if (fromAcc.currency !== toAcc.currency) {
            // Step 1: fromAcc -> TRY
            let tryVal = amount;
            if (fromAcc.currency === 'USD') tryVal = amount * (rates.USD_TRY || 34.20);
            else if (fromAcc.currency === 'EUR') tryVal = amount * (rates.EUR_TRY || 37.80);
            else if (fromAcc.currency === 'USDT') tryVal = amount * (rates.USDT_TRY || 34.25);
            else if (fromAcc.currency === 'BTC') tryVal = amount * (rates.BTC_USD || 63500) * (rates.USD_TRY || 34.20);

            // Step 2: TRY -> toAcc
            if (toAcc.currency === 'TRY') converted = tryVal;
            else if (toAcc.currency === 'USD') converted = tryVal / (rates.USD_TRY || 34.20);
            else if (toAcc.currency === 'EUR') converted = tryVal / (rates.EUR_TRY || 37.80);
            else if (toAcc.currency === 'USDT') converted = tryVal / (rates.USDT_TRY || 34.25);
            else if (toAcc.currency === 'BTC') converted = tryVal / ((rates.BTC_USD || 63500) * (rates.USD_TRY || 34.20));

            targetAmountInput.value = (toAcc.currency === 'BTC' ? converted.toFixed(6) : converted.toFixed(2));
            if (infoEl) {
                infoEl.innerHTML = `
                    <div class="p-2.5 rounded-lg bg-blue-950/40 border border-blue-800/40 text-xs text-blue-300">
                        ⚡ Otomatik Kur Çevirisi: <strong>${amount} ${fromAcc.currency}</strong> ≈ <strong>${targetAmountInput.value} ${toAcc.currency}</strong>
                    </div>
                `;
            }
        } else {
            targetAmountInput.value = amount.toFixed(2);
            if (infoEl) infoEl.innerHTML = '';
        }
    },

    async submitTransfer(e) {
        e.preventDefault();
        const fromId = document.getElementById('transfer-from-account').value;
        const toId = document.getElementById('transfer-to-account').value;
        const amount = document.getElementById('transfer-amount').value;
        const targetAmount = document.getElementById('transfer-target-amount').value;
        const description = document.getElementById('transfer-description').value;

        if (fromId === toId) {
            App.toast("Kaynak ve hedef kasa aynı olamaz!", "warning");
            return;
        }

        const res = await App.api('/api/accounts/transfer', {
            method: 'POST',
            body: JSON.stringify({
                from_account_id: fromId,
                to_account_id: toId,
                amount: parseFloat(amount),
                target_amount: parseFloat(targetAmount),
                description: description
            })
        });

        if (res && res.success) {
            App.toast(res.message || "Transfer tamamlandı", "success");
            App.closeModal('transfer-modal');
            this.render();
        }
    },

    // Create / Edit Account Modal
    openAccountModal(account = null) {
        document.getElementById('account-modal-title').textContent = account ? 'Kasayı / Hesabı Düzenle' : 'Yeni Kasa / Hesap Ekle';
        document.getElementById('account-id').value = account ? account.id : '';
        document.getElementById('account-name').value = account ? account.name : '';
        document.getElementById('account-type').value = account ? account.account_type : 'bank';
        document.getElementById('account-currency').value = account ? account.currency : 'TRY';
        document.getElementById('account-bank-name').value = account ? account.bank_name : '';
        document.getElementById('account-iban').value = account ? account.iban_or_address : '';
        document.getElementById('account-balance').value = account ? account.current_balance : '0';
        document.getElementById('account-notes').value = account ? account.notes : '';

        // Disable currency / type if editing
        document.getElementById('account-currency').disabled = !!account;
        document.getElementById('account-type').disabled = !!account;
        document.getElementById('account-balance').disabled = !!account;

        App.openModal('account-modal');
    },

    editAccount(accId) {
        const acc = this.accounts.find(a => a.id === accId);
        if (acc) this.openAccountModal(acc);
    },

    async saveAccount(e) {
        e.preventDefault();
        const id = document.getElementById('account-id').value;
        const name = document.getElementById('account-name').value;
        const account_type = document.getElementById('account-type').value;
        const currency = document.getElementById('account-currency').value;
        const bank_name = document.getElementById('account-bank-name').value;
        const iban_or_address = document.getElementById('account-iban').value;
        const initial_balance = parseFloat(document.getElementById('account-balance').value) || 0;
        const notes = document.getElementById('account-notes').value;

        if (id) {
            // Update
            const res = await App.api(`/api/accounts/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ name, bank_name, iban_or_address, notes })
            });
            if (res && res.success) {
                App.toast("Hesap güncellendi", "success");
                App.closeModal('account-modal');
                this.render();
            }
        } else {
            // Create
            const res = await App.api('/api/accounts', {
                method: 'POST',
                body: JSON.stringify({ name, account_type, currency, bank_name, iban_or_address, initial_balance, notes })
            });
            if (res && res.success) {
                App.toast("Yeni kasa başarıyla eklendi", "success");
                App.closeModal('account-modal');
                this.render();
            }
        }
    },

    async deleteAccount(id, name) {
        if (!confirm(`"${name}" kasasını arşivlemek istediğinizden emin misiniz?`)) return;
        const res = await App.api(`/api/accounts/${id}`, { method: 'DELETE' });
        if (res && res.success) {
            App.toast("Kasa arşivlendi", "info");
            this.render();
        }
    }
};

window.AccountsView = AccountsView;
