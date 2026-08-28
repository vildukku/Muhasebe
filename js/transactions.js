/**
 * Transactions (Gelir / Gider / Fiş Yönetimi) Module
 */

const TransactionsView = {
    transactions: [],
    categories: [],
    accounts: [],
    currentFilters: {
        type: '',
        account_id: '',
        category_id: '',
        search: '',
        start_date: '',
        end_date: '',
        limit: 50,
        offset: 0
    },
    uploadedReceiptData: null,
    uploadedReceiptName: null,

    async render() {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="flex items-center justify-center min-h-[400px]">
                <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
            </div>
        `;

        await Promise.all([
            this.loadDependencies(),
            this.fetchTransactions()
        ]);

        const canCreate = App.state.user && App.state.user.permissions.can_create_transactions;

        container.innerHTML = `
            <!-- Top Header & Actions -->
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                    <h1 class="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                        <i data-lucide="receipt-text" class="w-6 h-6 text-emerald-400"></i>
                        <span>Gelir & Gider İşlemleri</span>
                    </h1>
                    <p class="text-sm text-gray-400 mt-1">Tüm kasalardan gerçekleşen operasyonel para giriş ve çıkışları.</p>
                </div>
                <div class="flex items-center flex-wrap gap-2.5">
                    <button onclick="TransactionsView.exportCSV()" class="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-semibold border border-gray-700 transition-colors">
                        <i data-lucide="download" class="w-4 h-4"></i>
                        <span>CSV İndir</span>
                    </button>
                    ${canCreate ? `
                        <button onclick="TransactionsView.openTransactionModal('income')" class="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-900/30 transition-all active:scale-95">
                            <i data-lucide="plus-circle" class="w-4 h-4"></i>
                            <span>+ Hızlı Gelir Ekle</span>
                        </button>
                        <button onclick="TransactionsView.openTransactionModal('expense')" class="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold shadow-lg shadow-rose-900/30 transition-all active:scale-95">
                            <i data-lucide="minus-circle" class="w-4 h-4"></i>
                            <span>- Hızlı Gider Ekle</span>
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- Comprehensive Filter Bar -->
            <div class="glass-card p-4 mb-6">
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                    <!-- Search -->
                    <div>
                        <label class="block text-xs font-semibold text-gray-400 mb-1">Arama</label>
                        <div class="relative">
                            <input type="text" id="tx-filter-search" value="${this.currentFilters.search}" placeholder="Açıklama, kişi..." class="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500">
                        </div>
                    </div>

                    <!-- Type -->
                    <div>
                        <label class="block text-xs font-semibold text-gray-400 mb-1">İşlem Türü</label>
                        <select id="tx-filter-type" class="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500">
                            <option value="">Tüm Türler</option>
                            <option value="income" ${this.currentFilters.type === 'income' ? 'selected' : ''}>Sadece Gelirler (+)</option>
                            <option value="expense" ${this.currentFilters.type === 'expense' ? 'selected' : ''}>Sadece Giderler (-)</option>
                            <option value="transfer" ${this.currentFilters.type === 'transfer' ? 'selected' : ''}>Kasalar Arası Transfer (⇄)</option>
                        </select>
                    </div>

                    <!-- Account -->
                    <div>
                        <label class="block text-xs font-semibold text-gray-400 mb-1">Kasa / Hesap</label>
                        <select id="tx-filter-account" class="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500">
                            <option value="">Tüm Kasalar</option>
                            ${this.accounts.map(a => `<option value="${a.id}" ${this.currentFilters.account_id == a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
                        </select>
                    </div>

                    <!-- Category -->
                    <div>
                        <label class="block text-xs font-semibold text-gray-400 mb-1">Kategori</label>
                        <select id="tx-filter-category" class="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500">
                            <option value="">Tüm Kategoriler</option>
                            ${this.categories.map(c => `<option value="${c.id}" ${this.currentFilters.category_id == c.id ? 'selected' : ''}>${c.name} (${c.type === 'income' ? 'Gelir' : 'Gider'})</option>`).join('')}
                        </select>
                    </div>

                    <!-- Action Buttons -->
                    <div class="flex items-end space-x-2">
                        <button onclick="TransactionsView.applyFilters()" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2 px-3 rounded-lg transition-colors">
                            Filtrele
                        </button>
                        <button onclick="TransactionsView.resetFilters()" class="bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs py-2 px-3 rounded-lg transition-colors" title="Filtreleri Temizle">
                            Sıfırla
                        </button>
                    </div>
                </div>
            </div>

            <!-- Transactions Table Card -->
            <div class="glass-card overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr class="bg-gray-900/60 border-b border-gray-800 text-xs uppercase text-gray-400 tracking-wider">
                                <th class="py-3 px-4 font-semibold">Tarih</th>
                                <th class="py-3 px-4 font-semibold">Tür</th>
                                <th class="py-3 px-4 font-semibold">Kategori</th>
                                <th class="py-3 px-4 font-semibold">Hesap / Kasa</th>
                                <th class="py-3 px-4 font-semibold">Açıklama</th>
                                <th class="py-3 px-4 font-semibold">Kullanıcı</th>
                                <th class="py-3 px-4 font-semibold text-right">Tutar</th>
                                <th class="py-3 px-4 font-semibold text-center">Fiş / Belge</th>
                                <th class="py-3 px-4 font-semibold text-center">İşlem</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-800/50">
                            ${this.transactions.length === 0 ? `
                                <tr>
                                    <td colspan="9" class="py-12 text-center text-gray-500">
                                        Filtre kriterlerine uygun işlem kaydı bulunamadı.
                                    </td>
                                </tr>
                            ` : this.transactions.map(tx => this.renderTransactionRow(tx)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        if (window.lucide) lucide.createIcons();
    },

    renderTransactionRow(tx) {
        const isIncome = tx.transaction_type === 'income';
        const isTransfer = tx.transaction_type === 'transfer';
        const canDelete = App.state.user && App.state.user.permissions.can_delete_transactions;

        return `
            <tr class="hover:bg-gray-800/30 transition-colors group">
                <td class="py-3.5 px-4 text-xs text-gray-400 whitespace-nowrap">
                    ${App.formatDate(tx.transaction_date, true)}
                </td>
                <td class="py-3.5 px-4">
                    ${isIncome ? `
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            + Gelir
                        </span>
                    ` : isTransfer ? `
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            ⇄ Virman
                        </span>
                    ` : `
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            - Gider
                        </span>
                    `}
                </td>
                <td class="py-3.5 px-4 font-medium text-gray-200">
                    ${isTransfer ? '<span class="text-blue-400">Kasalar Arası Transfer</span>' : (tx.category_name || '<span class="text-gray-500">Genel</span>')}
                </td>
                <td class="py-3.5 px-4 text-gray-300 text-xs">
                    ${isTransfer ? `
                        <span class="text-gray-300 font-semibold">${tx.from_account_name}</span> ➔ <span class="text-emerald-400 font-semibold">${tx.to_account_name}</span>
                    ` : (tx.from_account_name || tx.to_account_name || '-')}
                </td>
                <td class="py-3.5 px-4 text-gray-300 max-w-xs truncate" title="${tx.description || ''}">
                    ${tx.description || '-'}
                </td>
                <td class="py-3.5 px-4 text-xs text-gray-400">
                    ${tx.user_full_name || '-'}
                </td>
                <td class="py-3.5 px-4 text-right font-bold whitespace-nowrap ${isIncome ? 'text-emerald-400' : isTransfer ? 'text-blue-400' : 'text-rose-400'}">
                    ${isIncome ? '+' : isTransfer ? '' : '-'}${App.formatCurrency(tx.amount, tx.currency)}
                    ${tx.currency !== 'TRY' ? `
                        <div class="text-[10px] text-gray-500 font-mono">≈ ${App.formatCurrency(tx.converted_amount, 'TRY')}</div>
                    ` : ''}
                </td>
                <td class="py-3.5 px-4 text-center">
                    ${tx.receipt_path || tx.receipt_data ? `
                        <button onclick="TransactionsView.showReceiptModal('${tx.receipt_path || ''}', '${tx.receipt_data || ''}', '${encodeURIComponent(tx.description || 'Fiş Önizleme')}')" class="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-blue-400 hover:text-blue-300 transition-colors" title="Fişi Görüntüle">
                            <i data-lucide="receipt" class="w-4 h-4"></i>
                        </button>
                    ` : `<span class="text-gray-600 text-xs">-</span>`}
                </td>
                <td class="py-3.5 px-4 text-center">
                    ${canDelete ? `
                        <button onclick="TransactionsView.deleteTransaction(${tx.id})" class="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 transition-all" title="İşlemi Sil (Bakiyeyi Geri Al)">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    ` : '<span class="text-gray-600 text-xs">-</span>'}
                </td>
            </tr>
        `;
    },

    async loadDependencies() {
        const [catsRes, accsRes] = await Promise.all([
            App.api('/api/categories'),
            App.api('/api/accounts')
        ]);
        if (catsRes && catsRes.success) this.categories = catsRes.categories;
        if (accsRes && accsRes.success) this.accounts = accsRes.accounts;
    },

    async fetchTransactions() {
        const q = new URLSearchParams();
        for (const [k, v] of Object.entries(this.currentFilters)) {
            if (v) q.append(k, v);
        }
        const res = await App.api(`/api/transactions?${q.toString()}`);
        if (res && res.success) {
            this.transactions = res.transactions;
        }
    },

    filterByAccount(accountId) {
        this.currentFilters.account_id = accountId;
        window.location.hash = 'transactions';
        this.render();
    },

    applyFilters() {
        this.currentFilters.search = document.getElementById('tx-filter-search').value;
        this.currentFilters.type = document.getElementById('tx-filter-type').value;
        this.currentFilters.account_id = document.getElementById('tx-filter-account').value;
        this.currentFilters.category_id = document.getElementById('tx-filter-category').value;
        this.render();
    },

    resetFilters() {
        this.currentFilters = {
            type: '',
            account_id: '',
            category_id: '',
            search: '',
            start_date: '',
            end_date: '',
            limit: 50,
            offset: 0
        };
        this.render();
    },

    exportCSV() {
        const q = new URLSearchParams();
        if (this.currentFilters.type) q.append('type', this.currentFilters.type);
        if (this.currentFilters.account_id) q.append('account_id', this.currentFilters.account_id);
        window.open(`/api/transactions/export?${q.toString()}`, '_blank');
    },

    // Transaction Modal (Income / Expense)
    openTransactionModal(type = 'income') {
        const modal = document.getElementById('transaction-modal');
        const titleEl = document.getElementById('tx-modal-title');
        const typeInput = document.getElementById('tx-type');
        const accSelect = document.getElementById('tx-account');
        const catSelect = document.getElementById('tx-category');

        typeInput.value = type;
        titleEl.textContent = type === 'income' ? '+ Yeni Para Girişi' : '- Yeni Ödeme / Gider Çıkışı';
        titleEl.className = type === 'income' ? 'text-lg font-bold text-emerald-400' : 'text-lg font-bold text-rose-400';

        // Filter categories based on transaction type
        const filteredCats = this.categories.filter(c => c.type === type);
        catSelect.innerHTML = `
            <option value="">Kategori Seçin...</option>
            ${filteredCats.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
        `;

        // Populate accounts
        accSelect.innerHTML = `
            <option value="">Kasa / Hesap Seçin...</option>
            ${this.accounts.map(a => `<option value="${a.id}">${a.name} (${App.formatCurrency(a.current_balance, a.currency)})</option>`).join('')}
        `;

        document.getElementById('tx-amount').value = '';
        document.getElementById('tx-description').value = '';
        document.getElementById('tx-date').value = new Date().toISOString().slice(0, 16);
        document.getElementById('tx-file-input').value = '';
        document.getElementById('tx-file-preview').classList.add('hidden');
        this.uploadedReceiptData = null;
        this.uploadedReceiptName = null;

        App.openModal('transaction-modal');
    },

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.uploadedReceiptName = file.name;
        const reader = new FileReader();
        reader.onload = (e) => {
            this.uploadedReceiptData = e.target.result;
            const previewEl = document.getElementById('tx-file-preview');
            previewEl.classList.remove('hidden');
            previewEl.innerHTML = `
                <div class="flex items-center space-x-2 text-xs text-emerald-400">
                    <i data-lucide="check-circle" class="w-4 h-4"></i>
                    <span class="truncate max-w-[200px]">${file.name}</span>
                    <button type="button" onclick="TransactionsView.removeReceipt()" class="text-rose-400 hover:text-rose-300 ml-2">Kaldır</button>
                </div>
            `;
            if (window.lucide) lucide.createIcons();
        };
        reader.readAsDataURL(file);
    },

    removeReceipt() {
        this.uploadedReceiptData = null;
        this.uploadedReceiptName = null;
        document.getElementById('tx-file-input').value = '';
        document.getElementById('tx-file-preview').classList.add('hidden');
    },

    async saveTransaction(e) {
        e.preventDefault();
        const type = document.getElementById('tx-type').value;
        const account_id = document.getElementById('tx-account').value;
        const category_id = document.getElementById('tx-category').value;
        const amount = parseFloat(document.getElementById('tx-amount').value);
        const description = document.getElementById('tx-description').value;
        const tx_date = document.getElementById('tx-date').value.replace('T', ' ') + ':00';

        if (!account_id) {
            App.toast("Lütfen bir kasa/hesap seçin", "warning");
            return;
        }
        if (!amount || amount <= 0) {
            App.toast("Geçerli bir tutar girin", "warning");
            return;
        }

        const payload = {
            transaction_type: type,
            account_id: parseInt(account_id),
            category_id: category_id ? parseInt(category_id) : null,
            amount: amount,
            description: description,
            transaction_date: tx_date,
            receipt_filename: this.uploadedReceiptName || '',
            receipt_data: this.uploadedReceiptData || ''
        };

        const res = await App.api('/api/transactions', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (res && res.success) {
            App.toast(res.message || "İşlem kaydedildi", "success");
            App.closeModal('transaction-modal');
            this.render();
        }
    },

    async deleteTransaction(txId) {
        if (!confirm("Bu işlemi silmek istediğinizden emin misiniz? Kasa bakiyesi otomatik olarak geri alınacaktır.")) return;
        const res = await App.api(`/api/transactions/${txId}`, { method: 'DELETE' });
        if (res && res.success) {
            App.toast(res.message || "İşlem silindi", "info");
            this.render();
        }
    },

    showReceiptModal(path, dataUri, desc) {
        const modal = document.getElementById('receipt-view-modal');
        const img = document.getElementById('receipt-modal-img');
        const title = document.getElementById('receipt-modal-title');
        const downloadBtn = document.getElementById('receipt-download-btn');

        const src = path || dataUri;
        img.src = src;
        title.textContent = decodeURIComponent(desc || 'Fiş / Fatura Önizleme');
        downloadBtn.href = src;

        App.openModal('receipt-view-modal');
    }
};

window.TransactionsView = TransactionsView;
