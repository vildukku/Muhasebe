/**
 * Dashboard & Net Worth Overview Module (Luxury Apple / Revolut Style)
 */

const DashboardView = {
    chartInstance: null,

    async render() {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="flex items-center justify-center min-h-[400px]">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        `;

        const data = await App.api('/api/dashboard/summary');
        if (!data || !data.success) {
            container.innerHTML = `<div class="p-8 text-center text-red-400">Veriler yüklenirken bir hata oluştu.</div>`;
            return;
        }

        const nw = data.net_worth || {};
        const cf = data.cash_flow_30d || {};
        const accounts = data.accounts || [];
        const recentTx = data.recent_transactions || [];
        const upcomingSubs = data.upcoming_subscriptions || [];

        // Empty state handling
        if (accounts.length === 0) {
            container.innerHTML = `
                <div class="max-w-xl mx-auto py-12 px-4 text-center">
                    <div class="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-blue-600/10 border border-blue-500/20 text-blue-400 mb-6 shadow-2xl">
                        <i data-lucide="sparkles" class="w-10 h-10"></i>
                    </div>
                    <h1 class="text-3xl font-extrabold text-white tracking-tight mb-2">Kasa Takip Sistemine Hoş Geldiniz</h1>
                    <p class="text-sm text-gray-400 mb-8">Henüz hiç kasa veya hesap eklenmedi. Kendi kasalarınızı sıfırdan ekleyebilir veya hazır demo verileriyle hemen deneyebilirsiniz.</p>
                    
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto mb-8">
                        <button onclick="AccountsView.openAccountModal()" class="flex items-center justify-center space-x-2 p-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-xl shadow-blue-900/30 transition-all active:scale-95">
                            <i data-lucide="plus-circle" class="w-5 h-5"></i>
                            <span>+ İlk Kasayı Ekle</span>
                        </button>
                        <button onclick="App.loadDemoData()" class="flex items-center justify-center space-x-2 p-4 rounded-2xl bg-gray-800/80 hover:bg-gray-700/80 text-gray-200 font-bold text-sm border border-gray-700 transition-all active:scale-95">
                            <i data-lucide="database" class="w-5 h-5 text-amber-400"></i>
                            <span>Demo Verileri Yükle</span>
                        </button>
                    </div>

                    <div class="p-4 rounded-2xl bg-gray-900/50 border border-gray-800 text-xs text-gray-400 text-left space-y-2">
                        <div class="font-semibold text-gray-300">💡 Neler Yapabilirsiniz?</div>
                        <div>• Banka IBAN hesapları (Garanti, İş Bankası, Yapı Kredi vb.) tanımlayın.</div>
                        <div>• Elden nakit kasaları (TL, Dolar, Euro) oluşturun.</div>
                        <div>• USDT ve Bitcoin gibi kripto cüzdanlarınızı anlık kurla takip edin.</div>
                    </div>
                </div>
            `;
            if (window.lucide) lucide.createIcons();
            return;
        }

        container.innerHTML = `
            <!-- Top Hero Net Worth Section -->
            <div class="mb-8">
                <div class="glass-card p-6 md:p-8 relative overflow-hidden border border-gray-800">
                    <div class="absolute -right-10 -bottom-10 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
                    <div class="absolute -left-10 -top-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

                    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <div class="flex items-center space-x-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                <span>Toplam Konsolide Varlık</span>
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                            </div>
                            <div class="metric-hero text-white mb-2">
                                ${App.formatCurrency(nw.total_try, 'TRY')}
                            </div>
                            <div class="flex items-center flex-wrap gap-3 text-xs text-gray-400">
                                <span class="px-2.5 py-1 rounded-lg bg-gray-800/80 border border-gray-700/60 text-gray-300 font-mono">
                                    ≈ ${App.formatCurrency(nw.total_usd, 'USD')}
                                </span>
                                <span class="px-2.5 py-1 rounded-lg bg-gray-800/80 border border-gray-700/60 text-gray-300 font-mono">
                                    ≈ ${App.formatCurrency(nw.total_eur, 'EUR')}
                                </span>
                            </div>
                        </div>

                        <!-- 4 Quick Action Capsules -->
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 md:mt-0">
                            <button onclick="TransactionsView.openTransactionModal('income')" class="action-btn-income flex flex-col items-center justify-center p-3 rounded-2xl text-white transition-all text-xs font-bold">
                                <i data-lucide="plus-circle" class="w-5 h-5 mb-1"></i>
                                <span>Para Girişi</span>
                            </button>
                            <button onclick="TransactionsView.openTransactionModal('expense')" class="action-btn-expense flex flex-col items-center justify-center p-3 rounded-2xl text-white transition-all text-xs font-bold">
                                <i data-lucide="minus-circle" class="w-5 h-5 mb-1"></i>
                                <span>Ödeme Çıkışı</span>
                            </button>
                            <button onclick="AccountsView.openTransferModal()" class="action-btn-transfer flex flex-col items-center justify-center p-3 rounded-2xl text-white transition-all text-xs font-bold">
                                <i data-lucide="arrow-left-right" class="w-5 h-5 mb-1"></i>
                                <span>Virman</span>
                            </button>
                            <button onclick="App.navigate('z-reports')" class="flex flex-col items-center justify-center p-3 rounded-2xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 transition-all text-xs font-bold active:scale-95">
                                <i data-lucide="clipboard-check" class="w-5 h-5 mb-1"></i>
                                <span>Z-Raporu</span>
                            </button>
                        </div>
                    </div>

                    <!-- 3 KPI Mini-Stats -->
                    <div class="grid grid-cols-3 gap-2 md:gap-4 mt-6 pt-6 border-t border-gray-800/80">
                        <div>
                            <div class="text-[11px] text-gray-400 uppercase font-medium">Banka Toplamı</div>
                            <div class="text-sm md:text-lg font-bold text-emerald-400 font-mono mt-0.5">${App.formatCurrency(nw.bank_try, 'TRY')}</div>
                        </div>
                        <div>
                            <div class="text-[11px] text-gray-400 uppercase font-medium">Nakit Kasalar</div>
                            <div class="text-sm md:text-lg font-bold text-amber-400 font-mono mt-0.5">${App.formatCurrency(nw.cash_try, 'TRY')}</div>
                        </div>
                        <div>
                            <div class="text-[11px] text-gray-400 uppercase font-medium">Kripto Varlıklar</div>
                            <div class="text-sm md:text-lg font-bold text-orange-400 font-mono mt-0.5">${App.formatCurrency(nw.crypto_try, 'TRY')}</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Accounts Horizontal Scroll / Cards -->
            <div class="mb-8">
                <div class="flex items-center justify-between mb-3 px-1">
                    <h2 class="text-base font-bold text-white flex items-center gap-2">
                        <i data-lucide="layers" class="w-4 h-4 text-blue-400"></i>
                        <span>Kasalarım & Cüzdanlarım</span>
                    </h2>
                    <a href="#accounts" class="text-xs text-blue-400 hover:text-blue-300 font-semibold">Tümünü Gör (${accounts.length}) →</a>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    ${accounts.slice(0, 6).map(acc => {
                        const isBank = acc.account_type === 'bank';
                        const isCrypto = acc.account_type === 'crypto';
                        const isCash = acc.account_type === 'cash';
                        const cardClass = isCrypto ? 'wallet-card-crypto' : (isCash ? 'wallet-card-cash' : (acc.currency === 'USD' ? 'wallet-card-usd' : 'wallet-card-bank'));

                        return `
                            <div class="glass-card ${cardClass} p-5 rounded-2xl relative overflow-hidden flex flex-col justify-between">
                                <div>
                                    <div class="flex items-start justify-between mb-3">
                                        <div class="flex items-center space-x-2.5">
                                            <div class="p-2 rounded-xl bg-black/40 text-white border border-white/10">
                                                <i data-lucide="${acc.icon || 'wallet'}" class="w-4 h-4"></i>
                                            </div>
                                            <div>
                                                <h3 class="font-bold text-white text-sm truncate max-w-[160px]">${acc.name}</h3>
                                                <div class="text-[11px] text-gray-400">${acc.bank_name || (isCash ? 'Nakit Kasa' : 'Kripto')}</div>
                                            </div>
                                        </div>
                                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-black/50 text-gray-200 border border-white/10">
                                            ${acc.currency}
                                        </span>
                                    </div>

                                    <div class="my-3">
                                        <div class="text-xl font-extrabold text-white metric-value font-mono">
                                            ${App.formatCurrency(acc.current_balance, acc.currency)}
                                        </div>
                                        ${acc.currency !== 'TRY' ? `
                                            <div class="text-xs text-emerald-300/80 font-mono mt-0.5">
                                                ≈ ${App.formatCurrency(acc.balance_in_try, 'TRY')}
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>

                                <div class="pt-2 flex items-center justify-between text-xs border-t border-white/5">
                                    <button onclick="TransactionsView.filterByAccount(${acc.id})" class="text-blue-400 hover:text-blue-300 font-medium">
                                        Hareketler →
                                    </button>
                                    <button onclick="AccountsView.openTransferModal(${acc.id})" class="text-gray-300 hover:text-white font-medium">
                                        Transfer Et
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- Recent Activity List -->
            <div class="glass-card p-6 mb-8">
                <div class="flex items-center justify-between mb-4 pb-2 border-b border-gray-800">
                    <div>
                        <h2 class="text-base font-bold text-white">Son Hareketler</h2>
                        <p class="text-xs text-gray-400">Kasalarınızdan gerçekleşen en son gelir, gider ve transferler</p>
                    </div>
                    <a href="#transactions" class="text-xs text-blue-400 hover:text-blue-300 font-semibold">Tümü →</a>
                </div>

                <div class="divide-y divide-gray-800/60">
                    ${recentTx.length === 0 ? `
                        <div class="py-8 text-center text-gray-500 text-sm">Henüz kayıtlı işlem bulunmuyor.</div>
                    ` : recentTx.map(tx => {
                        const isIncome = tx.transaction_type === 'income';
                        const isTransfer = tx.transaction_type === 'transfer';
                        return `
                            <div class="py-3.5 flex items-center justify-between hover:bg-gray-800/20 px-2 rounded-xl transition-colors">
                                <div class="flex items-center space-x-3 min-w-0">
                                    <div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isIncome ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : (isTransfer ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20')}">
                                        <i data-lucide="${isIncome ? 'arrow-down-left' : (isTransfer ? 'arrow-left-right' : 'arrow-up-right')}" class="w-4 h-4"></i>
                                    </div>
                                    <div class="min-w-0">
                                        <div class="text-sm font-semibold text-white truncate max-w-[200px] md:max-w-md">${tx.description || (isIncome ? 'Gelir' : (isTransfer ? 'Transfer' : 'Gider'))}</div>
                                        <div class="text-xs text-gray-400 flex items-center space-x-1.5 mt-0.5">
                                            <span>${isTransfer ? `${tx.from_account_name} ➔ ${tx.to_account_name}` : (tx.from_account_name || tx.to_account_name || 'Kasa')}</span>
                                            <span>•</span>
                                            <span>${App.formatDate(tx.transaction_date, true)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div class="text-right ml-3 font-mono font-bold whitespace-nowrap ${isIncome ? 'text-emerald-400' : (isTransfer ? 'text-blue-400' : 'text-rose-400')}">
                                    ${isIncome ? '+' : (isTransfer ? '' : '-')}${App.formatCurrency(tx.amount, tx.currency)}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        if (window.lucide) lucide.createIcons();
    }
};

window.DashboardView = DashboardView;
