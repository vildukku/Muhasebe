/**
 * Daily Settlement & Z-Report (Gün Sonu Kapanış & Mutabakat) Module
 */

const ZReportsView = {
    selectedDate: new Date().toISOString().slice(0, 10),
    previewData: null,
    historyReports: [],

    async render() {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="flex items-center justify-center min-h-[400px]">
                <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
            </div>
        `;

        await Promise.all([
            this.loadPreview(),
            this.loadHistory()
        ]);

        const canManage = App.state.user && App.state.user.permissions.can_manage_z_reports;
        const p = this.previewData;
        const isClosed = p && p.is_already_closed;

        container.innerHTML = `
            <!-- Top Header & Date Picker -->
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                    <h1 class="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                        <i data-lucide="clipboard-check" class="w-6 h-6 text-amber-400"></i>
                        <span>Gün Sonu Kapanış ve Z-Raporu</span>
                    </h1>
                    <p class="text-sm text-gray-400 mt-1">Günlük nakit akışı, kasa sayımı ve finansal mutabakat tutanağı.</p>
                </div>
                <div class="flex items-center space-x-3">
                    <div class="flex items-center space-x-2 bg-gray-900 border border-gray-700 rounded-xl px-3 py-1.5">
                        <span class="text-xs text-gray-400">Tarih:</span>
                        <input type="date" id="z-report-date-picker" value="${this.selectedDate}" onchange="ZReportsView.changeDate(this.value)" class="bg-transparent text-white text-sm focus:outline-none">
                    </div>
                    <button onclick="window.print()" class="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-semibold border border-gray-700 transition-colors">
                        <i data-lucide="printer" class="w-4 h-4"></i>
                        <span>Yazdır / PDF</span>
                    </button>
                </div>
            </div>

            <!-- Active Day Summary Card (Z-Report Voucher Style) -->
            <div class="glass-card p-6 mb-8 border-t-4 ${isClosed ? 'border-emerald-500' : 'border-amber-500'}">
                <div class="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-800 pb-4 mb-6">
                    <div>
                        <div class="flex items-center space-x-2">
                            <h2 class="text-xl font-bold text-white tracking-wide">Z-RAPORU MUTABAKAT ÖZETİ</h2>
                            ${isClosed ? `
                                <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    ✓ Kapatıldı ve Kilitlendi
                                </span>
                            ` : `
                                <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                    ● Gün İçi Açık Rapor
                                </span>
                            `}
                        </div>
                        <p class="text-xs text-gray-400 mt-1">Rapor Tarihi: <strong class="text-white">${App.formatDate(this.selectedDate)}</strong></p>
                    </div>
                    <div class="mt-2 md:mt-0 text-xs text-gray-400 text-right">
                        <div>Sistem Saat: <span class="text-gray-200 font-mono">${new Date().toLocaleTimeString('tr-TR')}</span></div>
                        <div>Raporlayan: <span class="text-blue-400 font-medium">${App.state.user ? App.state.user.full_name : '-'}</span></div>
                    </div>
                </div>

                <!-- 4 KPI Metrics -->
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div class="p-4 rounded-xl bg-gray-900/60 border border-gray-800">
                        <div class="text-xs text-gray-400 uppercase font-semibold">Gün İçi Toplam Giriş</div>
                        <div class="text-xl font-bold text-emerald-400 mt-1">${App.formatCurrency(p ? p.total_income_try : 0, 'TRY')}</div>
                    </div>
                    <div class="p-4 rounded-xl bg-gray-900/60 border border-gray-800">
                        <div class="text-xs text-gray-400 uppercase font-semibold">Gün İçi Toplam Çıkış</div>
                        <div class="text-xl font-bold text-rose-400 mt-1">${App.formatCurrency(p ? p.total_expense_try : 0, 'TRY')}</div>
                    </div>
                    <div class="p-4 rounded-xl bg-gray-900/60 border border-gray-800">
                        <div class="text-xs text-gray-400 uppercase font-semibold">Net Gün Değişimi</div>
                        <div class="text-xl font-bold ${p && p.net_change_try >= 0 ? 'text-blue-400' : 'text-rose-400'} mt-1">
                            ${p && p.net_change_try >= 0 ? '+' : ''}${App.formatCurrency(p ? p.net_change_try : 0, 'TRY')}
                        </div>
                    </div>
                    <div class="p-4 rounded-xl bg-gray-900/60 border border-gray-800">
                        <div class="text-xs text-gray-400 uppercase font-semibold">Hesaplanan Kapanış Bakiyesi</div>
                        <div class="text-xl font-bold text-white mt-1">${App.formatCurrency(p ? p.calculated_closing_balance_try : 0, 'TRY')}</div>
                    </div>
                </div>

                <!-- Account Balances Breakdown Table for Z-Report -->
                <div class="mb-6">
                    <h3 class="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Kasa ve Hesap Sayım Detayları</h3>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr class="bg-gray-900/80 border-b border-gray-800 text-gray-400 uppercase">
                                    <th class="py-2.5 px-3">Kasa / Hesap Adı</th>
                                    <th class="py-2.5 px-3">Tür</th>
                                    <th class="py-2.5 px-3">Para Birimi</th>
                                    <th class="py-2.5 px-3 text-right">Orijinal Bakiye</th>
                                    <th class="py-2.5 px-3 text-right">TL Karşılığı</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-800/60">
                                ${(p && p.accounts_snapshot || []).map(acc => `
                                    <tr class="hover:bg-gray-800/20">
                                        <td class="py-2 px-3 font-medium text-white">${acc.name}</td>
                                        <td class="py-2 px-3 uppercase text-gray-400">${acc.type}</td>
                                        <td class="py-2 px-3 font-semibold text-gray-300">${acc.currency}</td>
                                        <td class="py-2 px-3 text-right font-mono font-bold text-white">${App.formatCurrency(acc.balance, acc.currency)}</td>
                                        <td class="py-2 px-3 text-right font-mono text-emerald-400 font-semibold">${App.formatCurrency(acc.balance_in_try, 'TRY')}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Physical Cash Count & Discrepancy Form -->
                ${canManage ? `
                    <div class="p-4 rounded-xl bg-gray-900/80 border border-gray-800 mb-6">
                        <h3 class="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                            <i data-lucide="calculator" class="w-4 h-4 text-blue-400"></i>
                            <span>Fiziksel Kasa Sayımı ve Mutabakat Farkı</span>
                        </h3>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label class="block text-xs text-gray-400 mb-1">Fiziki Sayılan Toplam Tutar (₺)</label>
                                <input type="number" step="0.01" id="z-actual-balance"
                                    value="${p && p.existing_report ? p.existing_report.actual_closing_balance_try : (p ? p.calculated_closing_balance_try : 0)}"
                                    oninput="ZReportsView.calculateDiscrepancy()"
                                    class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono font-bold focus:outline-none focus:border-blue-500">
                            </div>
                            <div>
                                <label class="block text-xs text-gray-400 mb-1">Kasa Farkı (Fazla / Eksik)</label>
                                <div id="z-discrepancy-badge" class="py-2 px-3 rounded-lg bg-gray-800 text-sm font-mono font-bold text-emerald-400">
                                    ₺ 0.00 (Tam Mutabakat)
                                </div>
                            </div>
                            <div>
                                <label class="block text-xs text-gray-400 mb-1">Kapanış Notları</label>
                                <input type="text" id="z-notes"
                                    value="${p && p.existing_report ? p.existing_report.notes : 'Gün sonu kasa sayımı ve banka bakiyeleri kontrol edildi.'}"
                                    placeholder="Opsiyonel kapanış notu..."
                                    class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500">
                            </div>
                        </div>

                        <div class="mt-4 flex justify-end">
                            <button onclick="ZReportsView.closeZReport()" class="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-900/30 transition-all active:scale-95">
                                <i data-lucide="lock" class="w-4 h-4"></i>
                                <span>${isClosed ? 'Z-Raporunu Güncelle & Yeniden Mühürle' : 'Günü Kapat & Z-Raporunu Kilitle'}</span>
                            </button>
                        </div>
                    </div>
                ` : ''}
            </div>

            <!-- Historical Z-Reports Table -->
            <div class="glass-card p-6">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h2 class="text-lg font-bold text-white">Geçmiş Z-Raporları Arşivi</h2>
                        <p class="text-xs text-gray-400">Daha önce kapatılmış günlük kapanış mutabakat kayıtları</p>
                    </div>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr class="border-b border-gray-800 text-xs uppercase text-gray-400">
                                <th class="pb-3 font-semibold">Tarih</th>
                                <th class="pb-3 font-semibold">Kapatan Yetkili</th>
                                <th class="pb-3 font-semibold text-right">Toplam Giriş</th>
                                <th class="pb-3 font-semibold text-right">Toplam Çıkış</th>
                                <th class="pb-3 font-semibold text-right">Kapanış Bakiyesi</th>
                                <th class="pb-3 font-semibold text-right">Kasa Farkı</th>
                                <th class="pb-3 font-semibold">Notlar</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-800/50">
                            ${this.historyReports.length === 0 ? `
                                <tr>
                                    <td colspan="7" class="py-8 text-center text-gray-500">Kayıtlı geçmiş Z-Raporu bulunamadı.</td>
                                </tr>
                            ` : this.historyReports.map(r => `
                                <tr class="hover:bg-gray-800/20">
                                    <td class="py-3 font-semibold text-white text-xs">${App.formatDate(r.report_date)}</td>
                                    <td class="py-3 text-xs text-gray-300">${r.closed_by_name}</td>
                                    <td class="py-3 text-right font-mono text-emerald-400">${App.formatCurrency(r.total_income_try, 'TRY')}</td>
                                    <td class="py-3 text-right font-mono text-rose-400">${App.formatCurrency(r.total_expense_try, 'TRY')}</td>
                                    <td class="py-3 text-right font-mono font-bold text-white">${App.formatCurrency(r.actual_closing_balance_try, 'TRY')}</td>
                                    <td class="py-3 text-right font-mono ${r.discrepancy_try === 0 ? 'text-gray-400' : 'text-amber-400 font-bold'}">
                                        ${r.discrepancy_try === 0 ? '₺ 0.00' : (r.discrepancy_try > 0 ? '+' : '') + App.formatCurrency(r.discrepancy_try, 'TRY')}
                                    </td>
                                    <td class="py-3 text-xs text-gray-400 max-w-xs truncate" title="${r.notes || ''}">${r.notes || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        if (window.lucide) lucide.createIcons();
        this.calculateDiscrepancy();
    },

    async loadPreview() {
        const res = await App.api(`/api/z-reports/preview?date=${this.selectedDate}`);
        if (res && res.success) {
            this.previewData = res;
        }
    },

    async loadHistory() {
        const res = await App.api('/api/z-reports');
        if (res && res.success) {
            this.historyReports = res.reports || [];
        }
    },

    changeDate(newDate) {
        this.selectedDate = newDate;
        this.render();
    },

    calculateDiscrepancy() {
        const actualInput = document.getElementById('z-actual-balance');
        const badge = document.getElementById('z-discrepancy-badge');
        if (!actualInput || !badge || !this.previewData) return;

        const actual = parseFloat(actualInput.value) || 0;
        const calculated = this.previewData.calculated_closing_balance_try;
        const diff = actual - calculated;

        if (Math.abs(diff) < 0.01) {
            badge.className = 'py-2 px-3 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-sm font-mono font-bold text-emerald-400';
            badge.textContent = '₺ 0.00 (Tam Mutabakat)';
        } else if (diff > 0) {
            badge.className = 'py-2 px-3 rounded-lg bg-blue-950/40 border border-blue-800/40 text-sm font-mono font-bold text-blue-400';
            badge.textContent = `+${App.formatCurrency(diff, 'TRY')} (Kasa Fazlası)`;
        } else {
            badge.className = 'py-2 px-3 rounded-lg bg-rose-950/40 border border-rose-800/40 text-sm font-mono font-bold text-rose-400';
            badge.textContent = `${App.formatCurrency(diff, 'TRY')} (Kasa Açığı)`;
        }
    },

    async closeZReport() {
        const actual = parseFloat(document.getElementById('z-actual-balance').value) || 0;
        const notes = document.getElementById('z-notes').value;

        const res = await App.api('/api/z-reports/close', {
            method: 'POST',
            body: JSON.stringify({
                report_date: this.selectedDate,
                actual_closing_balance_try: actual,
                notes: notes
            })
        });

        if (res && res.success) {
            App.toast(res.message || "Z-Raporu mühürlendi", "success");
            this.render();
        }
    }
};

window.ZReportsView = ZReportsView;
