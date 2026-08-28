/**
 * Reports & Deep Financial Analytics Module
 */

const ReportsView = {
    doughnutChart: null,
    barChart: null,
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),

    async render() {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="flex items-center justify-center min-h-[400px]">
                <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
            </div>
        `;

        const [catData, cashFlowData, volumeData] = await Promise.all([
            App.api(`/api/reports/category-expenses?start_date=${this.startDate}&end_date=${this.endDate}`),
            App.api('/api/reports/cash-flow'),
            App.api('/api/reports/account-volume')
        ]);

        const categories = (catData && catData.categories) || [];
        const totalExpense = (catData && catData.total_expense) || 0;
        const monthlyFlow = (cashFlowData && cashFlowData.monthly_cash_flow) || [];
        const accounts = (volumeData && volumeData.accounts) || [];

        container.innerHTML = `
            <!-- Top Header & Date Filter -->
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                    <h1 class="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                        <i data-lucide="pie-chart" class="w-6 h-6 text-blue-400"></i>
                        <span>Raporlar ve Finansal Analiz</span>
                    </h1>
                    <p class="text-sm text-gray-400 mt-1">Kategori bazlı harcama dağılımı, aylık trendler ve kasa işlem hacimleri.</p>
                </div>
                <div class="flex items-center space-x-2 bg-gray-900 border border-gray-700 rounded-xl p-1.5 text-xs">
                    <span class="text-gray-400 pl-2">Aralık:</span>
                    <input type="date" id="rep-start-date" value="${this.startDate}" onchange="ReportsView.updateDateRange()" class="bg-gray-800 text-white rounded px-2 py-1 focus:outline-none">
                    <span class="text-gray-500">-</span>
                    <input type="date" id="rep-end-date" value="${this.endDate}" onchange="ReportsView.updateDateRange()" class="bg-gray-800 text-white rounded px-2 py-1 focus:outline-none">
                </div>
            </div>

            <!-- Main Charts Row -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <!-- 1. Category Expense Doughnut Chart -->
                <div class="glass-card p-6 flex flex-col justify-between">
                    <div>
                        <div class="flex items-center justify-between mb-2">
                            <h2 class="text-base font-bold text-white">Gider Kategorileri Dağılımı</h2>
                        </div>
                        <p class="text-xs text-gray-400 mb-4">Seçilen dönemde toplam: <strong class="text-rose-400">${App.formatCurrency(totalExpense, 'TRY')}</strong></p>
                        <div class="relative h-56 w-full flex items-center justify-center">
                            ${categories.length === 0 ? `
                                <div class="text-center text-gray-500 text-xs">Bu tarih aralığında harcama kaydı yok.</div>
                            ` : `
                                <canvas id="category-doughnut-chart"></canvas>
                            `}
                        </div>
                    </div>
                </div>

                <!-- 2. Category Expense Breakdown List -->
                <div class="glass-card p-6 lg:col-span-2">
                    <h2 class="text-base font-bold text-white mb-4">Kategori Bazlı Harcama Dökümü</h2>
                    <div class="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                        ${categories.length === 0 ? `
                            <div class="text-center py-10 text-gray-500 text-sm">Harcama verisi bulunamadı.</div>
                        ` : categories.map(c => `
                            <div class="p-3 rounded-xl bg-gray-900/60 border border-gray-800 flex items-center justify-between">
                                <div class="flex items-center space-x-3">
                                    <div class="w-3 h-3 rounded-full" style="background-color: ${c.color || '#3b82f6'}"></div>
                                    <div>
                                        <div class="text-sm font-semibold text-white">${c.name}</div>
                                        <div class="text-xs text-gray-400">${c.tx_count} İşlem • %${c.percentage} Pay</div>
                                    </div>
                                </div>
                                <div class="text-right font-bold text-rose-400 font-mono">
                                    ${App.formatCurrency(c.total_amount, 'TRY')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <!-- Monthly Income vs Expense Trend Table -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <!-- Monthly Cash Flow History -->
                <div class="glass-card p-6">
                    <h2 class="text-base font-bold text-white mb-4">Aylık Kar / Zarar & Net Nakit Akışı</h2>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr class="border-b border-gray-800 text-gray-400 uppercase">
                                    <th class="py-2.5 px-3">Ay</th>
                                    <th class="py-2.5 px-3 text-right">Toplam Gelir</th>
                                    <th class="py-2.5 px-3 text-right">Toplam Gider</th>
                                    <th class="py-2.5 px-3 text-right">Net Durum</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-800/60 font-mono">
                                ${monthlyFlow.map(m => `
                                    <tr class="hover:bg-gray-800/20">
                                        <td class="py-2.5 px-3 font-sans font-medium text-white">${m.month}</td>
                                        <td class="py-2.5 px-3 text-right text-emerald-400">${App.formatCurrency(m.income, 'TRY')}</td>
                                        <td class="py-2.5 px-3 text-right text-rose-400">${App.formatCurrency(m.expense, 'TRY')}</td>
                                        <td class="py-2.5 px-3 text-right font-bold ${m.net >= 0 ? 'text-blue-400' : 'text-rose-400'}">
                                            ${m.net >= 0 ? '+' : ''}${App.formatCurrency(m.net, 'TRY')}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Account Volume Metrics -->
                <div class="glass-card p-6">
                    <h2 class="text-base font-bold text-white mb-4">Kasa Bazlı Toplam İşlem Hacmi</h2>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr class="border-b border-gray-800 text-gray-400 uppercase">
                                    <th class="py-2.5 px-3">Kasa / Hesap</th>
                                    <th class="py-2.5 px-3 text-right">Giren Toplam</th>
                                    <th class="py-2.5 px-3 text-right">Çıkan Toplam</th>
                                    <th class="py-2.5 px-3 text-right">Toplam Hacim</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-800/60 font-mono">
                                ${accounts.map(a => `
                                    <tr class="hover:bg-gray-800/20">
                                        <td class="py-2.5 px-3 font-sans font-medium text-white">${a.name} (${a.currency})</td>
                                        <td class="py-2.5 px-3 text-right text-emerald-400">${App.formatCurrency(a.total_inflow, a.currency)}</td>
                                        <td class="py-2.5 px-3 text-right text-rose-400">${App.formatCurrency(a.total_outflow, a.currency)}</td>
                                        <td class="py-2.5 px-3 text-right font-bold text-white">${App.formatCurrency(a.total_volume, a.currency)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        if (window.lucide) lucide.createIcons();
        if (categories.length > 0) this.initDoughnutChart(categories);
    },

    updateDateRange() {
        this.startDate = document.getElementById('rep-start-date').value;
        this.endDate = document.getElementById('rep-end-date').value;
        this.render();
    },

    initDoughnutChart(categories) {
        const ctx = document.getElementById('category-doughnut-chart');
        if (!ctx) return;

        const labels = categories.map(c => c.name);
        const data = categories.map(c => c.total_amount);
        const colors = categories.map(c => c.color || '#3b82f6');

        if (this.doughnutChart) {
            this.doughnutChart.destroy();
        }

        if (window.Chart) {
            this.doughnutChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: colors,
                        borderWidth: 2,
                        borderColor: '#111827'
                    }]
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
                                    return `${context.label}: ₺${context.parsed.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
                                }
                            }
                        }
                    },
                    cutout: '70%'
                }
            });
        }
    }
};

window.ReportsView = ReportsView;
