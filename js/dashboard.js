/**
 * Dashboard & Net Worth Overview Module
 */

const DashboardView = {
    chartInstance: null,

    async render() {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="flex items-center justify-center min-h-[400px]">
                <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
            </div>
        `;

        const data = await App.api('/api/dashboard/summary');
        if (!data || !data.success) {
            container.innerHTML = `<div class="p-8 text-center text-red-400">Veriler yüklenirken bir hata oluştu.</div>`;
            return;
        }

        const nw = data.net_worth;
        const cf = data.cash_flow_30d;
        const accounts = data.accounts || [];
        const recentTx = data.recent_transactions || [];
        const upcomingSubs = data.upcoming_subscriptions || [];

        container.innerHTML = `
            <!-- Top Header & Quick Action Buttons -->
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
                <div>
                    <h1 class="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                        <span>Finansal Gösterge Paneli</span>
                        <span class="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-normal">Canlı Senkronize</span>
                    </h1>
                    <p class="text-sm text-gray-400 mt-1">Tüm banka, kasa ve kripto varlıklarınızın anlık konsolide görünümü.</p>
                </div>
                <div class="flex items-center flex-wrap gap-2.5">
                    <button onclick="TransactionsView.openTransactionModal('income')" class="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-900/30 transition-all active:scale-95">
                        <i data-lucide="plus-circle" class="w-4 h-4"></i>
                        <span>+ Para Girişi</span>
                    </button>
                    <button onclick="TransactionsView.openTransactionModal('expense')" class="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold shadow-lg shadow-rose-900/30 transition-all active:scale-95">
                        <i data-lucide="minus-circle" class="w-4 h-4"></i>
                        <span>- Ödeme Çıkışı</span>
                    </button>
                    <button onclick="AccountsView.openTransferModal()" class="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-900/30 transition-all active:scale-95">
                        <i data-lucide="arrow-left-right" class="w-4 h-4"></i>
                        <span>⇄ Virman / Transfer</span>
                    </button>
                </div>
            </div>

            <!-- Net Worth Hero Cards -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <!-- Total Net Worth in TRY -->
                <div class="glass-card p-6 relative overflow-hidden group">
                    <div class="absolute -right-6 -bottom-6 w-28 h-28 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
                    <div class="flex items-center justify-between text-gray-400 mb-2">
                        <span class="text-xs uppercase font-semibold tracking-wider">Konsolide Net Varlık</span>
                        <div class="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                            <i data-lucide="wallet" class="w-5 h-5"></i>
                        </div>
                    </div>
                    <div class="text-2xl lg:text-3xl font-extrabold text-white metric-value mb-1">
                        ${App.formatCurrency(nw.total_try, 'TRY')}
                    </div>
                    <div class="flex items-center space-x-3 text-xs text-gray-400 mt-2">
                        <span>≈ ${App.formatCurrency(nw.total_usd, 'USD')}</span>
                        <span>•</span>
                        <span>≈ ${App.formatCurrency(nw.total_eur, 'EUR')}</span>
                    </div>
                </div>

                <!-- Bank Balances -->
                <div class="glass-card p-6 relative overflow-hidden">
                    <div class="flex items-center justify-between text-gray-400 mb-2">
                        <span class="text-xs uppercase font-semibold tracking-wider">Banka Hesapları</span>
                        <div class="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                            <i data-lucide="building-2" class="w-5 h-5"></i>
                        </div>
                    </div>
                    <div class="text-xl lg:text-2xl font-bold text-emerald-400 metric-value mb-1">
                        ${App.formatCurrency(nw.bank_try, 'TRY')}
                    </div>
                    <div class="text-xs text-gray-400">
                        ${accounts.filter(a => a.account_type === 'bank').length} Aktif Banka Hesabı
                    </div>
                </div>

                <!-- Cash Vaults -->
                <div class="glass-card p-6 relative overflow-hidden">
                    <div class="flex items-center justify-between text-gray-400 mb-2">
                        <span class="text-xs uppercase font-semibold tracking-wider">Elden Nakit Kasalar</span>
                        <div class="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                            <i data-lucide="banknote" class="w-5 h-5"></i>
                        </div>
                    </div>
                    <div class="text-xl lg:text-2xl font-bold text-amber-400 metric-value mb-1">
                        ${App.formatCurrency(nw.cash_try, 'TRY')}
                    </div>
                    <div class="text-xs text-gray-400">
                        ${accounts.filter(a => a.account_type === 'cash').length} Fiziksel Kasa
                    </div>
                </div>

                <!-- Crypto Wallets -->
                <div class="glass-card p-6 relative overflow-hidden">
                    <div class="flex items-center justify-between text-gray-400 mb-2">
                        <span class="text-xs uppercase font-semibold tracking-wider">Kripto Varlıklar</span>
                        <div class="p-2 rounded-lg bg-orange-500/10 text-orange-400">
                            <i data-lucide="coins" class="w-5 h-5"></i>
                        </div>
                    </div>
                    <div class="text-xl lg:text-2xl font-bold text-orange-400 metric-value mb-1">
                        ${App.formatCurrency(nw.crypto_try, 'TRY')}
                    </div>
                    <div class="text-xs text-gray-400">
                        ${accounts.filter(a => a.account_type === 'crypto').length} Kripto Cüzdan
                    </div>
                </div>
            </div>

            <!-- 30-Day Flow Metrics -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div class="glass-card p-5 border-l-4 border-emerald-500 flex items-center justify-between">
                    <div>
                        <div class="text-xs text-gray-400 uppercase font-semibold">Son 30 Gün Toplam Giriş</div>
                        <div class="text-xl font-bold text-emerald-400 mt-1">${App.formatCurrency(cf.inflow_try, 'TRY')}</div>
                    </div>
                    <div class="p-3 rounded-full bg-emerald-500/10 text-emerald-400">
                        <i data-lucide="arrow-down-left" class="w-6 h-6"></i>
                    </div>
                </div>
                <div class="glass-card p-5 border-l-4 border-rose-500 flex items-center justify-between">
                    <div>
                        <div class="text-xs text-gray-400 uppercase font-semibold">Son 30 Gün Toplam Çıkış</div>
                        <div class="text-xl font-bold text-rose-400 mt-1">${App.formatCurrency(cf.outflow_try, 'TRY')}</div>
                    </div>
                    <div class="p-3 rounded-full bg-rose-500/10 text-rose-400">
                        <i data-lucide="arrow-up-right" class="w-6 h-6"></i>
                    </div>
                </div>
                <div class="glass-card p-5 border-l-4 ${cf.net_try >= 0 ? 'border-blue-500' : 'border-red-500'} flex items-center justify-between">
                    <div>
                        <div class="text-xs text-gray-400 uppercase font-semibold">Son 30 Gün Net Nakit Akışı</div>
                        <div class="text-xl font-bold ${cf.net_try >= 0 ? 'text-blue-400' : 'text-rose-400'} mt-1">
                            ${cf.net_try >= 0 ? '+' : ''}${App.formatCurrency(cf.net_try, 'TRY')}
                        </div>
                    </div>
                    <div class="p-3 rounded-full ${cf.net_try >= 0 ? 'bg-blue-500/10 text-blue-400' : 'bg-rose-500/10 text-rose-400'}">
                        <i data-lucide="${cf.net_try >= 0 ? 'trending-up' : 'trending-down'}" class="w-6 h-6"></i>
                    </div>
                </div>
            </div>

            <!-- Main Split: Cash Flow Chart & Accounts Mini-Grid -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                <!-- Cash Flow Trend Chart -->
                <div class="glass-card p-6 lg:col-span-2 flex flex-col justify-between">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <h2 class="text-lg font-bold text-white">Nakit Akışı & Trend Analizi</h2>
                            <p class="text-xs text-gray-400">Son 6 aylık gelir ve gider karşılaştırması</p>
                        </div>
                        <div class="flex items-center space-x-3 text-xs">
                            <span class="flex items-center space-x-1.5">
                                <span class="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
                                <span class="text-gray-300">Gelir</span>
                            </span>
                            <span class="flex items-center space-x-1.5">
                                <span class="w-3 h-3 rounded-full bg-rose-500 inline-block"></span>
                                <span class="text-gray-300">Gider</span>
                            </span>
                        </div>
                    </div>
                    <div class="relative h-64 w-full">
                        <canvas id="cashflow-chart"></canvas>
                    </div>
                </div>

                <!-- Upcoming Subscriptions / Alerts -->
                <div class="glass-card p-6 flex flex-col justify-between">
                    <div>
                        <div class="flex items-center justify-between mb-4">
                            <h2 class="text-lg font-bold text-white flex items-center gap-2">
                                <i data-lucide="calendar-clock" class="w-5 h-5 text-amber-400"></i>
                                <span>Yaklaşan Ödemeler</span>
                            </h2>
                            <a href="#subscriptions" class="text-xs text-blue-400 hover:underline">Tümünü Gör</a>
                        </div>
                        <div class="space-y-3">
                            ${upcomingSubs.length === 0 ? `
                                <div class="text-center py-8 text-gray-500 text-sm">
                                    Önümüzdeki 7 gün içinde vadesi gelen ödeme yok.
                                </div>
                            ` : upcomingSubs.map(s => `
                                <div class="p-3 rounded-xl bg-gray-800/40 border border-gray-700/40 flex items-center justify-between">
                                    <div class="min-w-0 flex-1">
                                        <div class="text-sm font-semibold text-white truncate">${s.title}</div>
                                        <div class="text-xs text-gray-400">${s.account_name || 'Kasa seçilmedi'} • Vade: ${App.formatDate(s.next_due_date)}</div>
                                    </div>
                                    <div class="text-right ml-3">
                                        <div class="text-sm font-bold text-rose-400">${App.formatCurrency(s.amount, s.currency)}</div>
                                        <button onclick="SubscriptionsView.paySubscription(${s.id})" class="text-xs text-emerald-400 hover:text-emerald-300 font-medium underline">Tek Tıkla Öde</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="mt-4 pt-4 border-t border-gray-800">
                        <button onclick="SubscriptionsView.openSubscriptionModal()" class="w-full py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-gray-300 transition-colors">
                            + Yeni Düzenli Ödeme Ekle
                        </button>
                    </div>
                </div>
            </div>

            <!-- Recent Transactions Table -->
            <div class="glass-card p-6 mb-8">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h2 class="text-lg font-bold text-white">Son Hareketler</h2>
                        <p class="text-xs text-gray-400">Tüm kasalardan gerçekleşen en son para hareketleri</p>
                    </div>
                    <a href="#transactions" class="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-gray-300 transition-colors">
                        <span>Tüm İşlemleri İncele</span>
                        <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
                    </a>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr class="border-b border-gray-800 text-xs uppercase text-gray-400 tracking-wider">
                                <th class="pb-3 font-semibold">Tarih</th>
                                <th class="pb-3 font-semibold">Tür</th>
                                <th class="pb-3 font-semibold">Kategori / Kasa</th>
                                <th class="pb-3 font-semibold">Açıklama</th>
                                <th class="pb-3 font-semibold">İşlemi Yapan</th>
                                <th class="pb-3 font-semibold text-right">Tutar</th>
                                <th class="pb-3 font-semibold text-center">Fiş / Belge</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-800/60">
                            ${recentTx.length === 0 ? `
                                <tr>
                                    <td colspan="7" class="py-8 text-center text-gray-500">Henüz kaydedilmiş işlem bulunmuyor.</td>
                                </tr>
                            ` : recentTx.map(tx => {
                                const isIncome = tx.transaction_type === 'income';
                                const isTransfer = tx.transaction_type === 'transfer';
                                return `
                                    <tr class="hover:bg-gray-800/30 transition-colors group">
                                        <td class="py-3 text-xs text-gray-400 whitespace-nowrap">${App.formatDate(tx.transaction_date, true)}</td>
                                        <td class="py-3">
                                            ${isIncome ? `
                                                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                    + Gelir
                                                </span>
                                            ` : isTransfer ? `
                                                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                    ⇄ Virman
                                                </span>
                                            ` : `
                                                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                                    - Gider
                                                </span>
                                            `}
                                        </td>
                                        <td class="py-3">
                                            <div class="font-medium text-gray-200">
                                                ${isTransfer ? `${tx.from_account_name} ➔ ${tx.to_account_name}` : (tx.category_name || 'Genel')}
                                            </div>
                                            <div class="text-xs text-gray-400">
                                                ${!isTransfer ? (tx.from_account_name || tx.to_account_name || '-') : 'Kasalar Arası Aktarım'}
                                            </div>
                                        </td>
                                        <td class="py-3 text-gray-300 max-w-xs truncate" title="${tx.description || ''}">${tx.description || '-'}</td>
                                        <td class="py-3 text-xs text-gray-400">${tx.user_full_name || '-'}</td>
                                        <td class="py-3 text-right font-semibold whitespace-nowrap ${isIncome ? 'text-emerald-400' : isTransfer ? 'text-blue-400' : 'text-rose-400'}">
                                            ${isIncome ? '+' : isTransfer ? '' : '-'}${App.formatCurrency(tx.amount, tx.currency)}
                                        </td>
                                        <td class="py-3 text-center">
                                            ${tx.receipt_path || tx.receipt_data ? `
                                                <button onclick="TransactionsView.showReceiptModal('${tx.receipt_path || ''}', '${tx.receipt_data || ''}', '${encodeURIComponent(tx.description || 'Fiş Önizleme')}')" class="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-blue-400 transition-colors" title="Fişi Görüntüle">
                                                    <i data-lucide="receipt" class="w-4 h-4"></i>
                                                </button>
                                            ` : `<span class="text-gray-600 text-xs">-</span>`}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        if (window.lucide) lucide.createIcons();
        this.initCashFlowChart();
    },

    async initCashFlowChart() {
        const ctx = document.getElementById('cashflow-chart');
        if (!ctx) return;

        const cfData = await App.api('/api/reports/cash-flow');
        if (!cfData || !cfData.success) return;

        const months = cfData.monthly_cash_flow.map(m => m.month);
        const incomes = cfData.monthly_cash_flow.map(m => m.income);
        const expenses = cfData.monthly_cash_flow.map(m => m.expense);

        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        if (window.Chart) {
            this.chartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: months,
                    datasets: [
                        {
                            label: 'Gelir (₺)',
                            data: incomes,
                            backgroundColor: '#10b981',
                            borderRadius: 6,
                            borderSkipped: false,
                        },
                        {
                            label: 'Gider (₺)',
                            data: expenses,
                            backgroundColor: '#ef4444',
                            borderRadius: 6,
                            borderSkipped: false,
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: '#111827',
                            borderColor: '#374151',
                            borderWidth: 1,
                            padding: 10,
                            callbacks: {
                                label: function(context) {
                                    return `${context.dataset.label}: ₺${context.parsed.y.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            ticks: { color: '#9ca3af', font: { size: 11 } }
                        },
                        y: {
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            ticks: {
                                color: '#9ca3af',
                                font: { size: 11 },
                                callback: function(value) {
                                    if (value >= 1000) return '₺' + (value / 1000).toFixed(0) + 'k';
                                    return '₺' + value;
                                }
                            }
                        }
                    }
                }
            });
        }
    }
};

window.DashboardView = DashboardView;
