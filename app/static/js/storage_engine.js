/**
 * Client-Side Storage & Database Engine (GitHub Pages & Offline PWA Ready)
 */

const StorageDB = {
    KEY_DATA: 'finance_pro_data_v2',
    KEY_SESSION: 'finance_pro_auth_session',

    // Clean Fresh Template (0 TL Empty State)
    getEmptyTemplate() {
        return {
            users: [
                { id: 1, username: "admin", email: "admin@finans.pro", full_name: "Yönetici", role: "admin", pin: "1234", is_active: 1, created_at: new Date().toISOString() }
            ],
            accounts: [],
            categories: [
                { id: 1, name: "Müşteri Ödemesi", type: "income", icon: "hand-coins", color: "#10b981", is_system: 1 },
                { id: 2, name: "Satış & Hizmet Geliri", type: "income", icon: "laptop", color: "#06b6d4", is_system: 1 },
                { id: 3, name: "Diğer Gelirler", type: "income", icon: "plus-circle", color: "#64748b", is_system: 1 },
                { id: 4, name: "Sunucu & Altyapı", type: "expense", icon: "server", color: "#ef4444", is_system: 1 },
                { id: 5, name: "Yazılım & Lisans", type: "expense", icon: "code", color: "#f97316", is_system: 1 },
                { id: 6, name: "Personel & Maaş", type: "expense", icon: "users", color: "#ec4899", is_system: 1 },
                { id: 7, name: "Kira & Sabit Gider", type: "expense", icon: "building", color: "#a855f7", is_system: 1 },
                { id: 8, name: "Pazarlama & Reklam", type: "expense", icon: "megaphone", color: "#eab308", is_system: 1 },
                { id: 9, name: "Yemek & Ulaşım", type: "expense", icon: "coffee", color: "#14b8a6", is_system: 1 },
            ],
            transactions: [],
            subscriptions: [],
            z_reports: [],
            audit_logs: [
                { id: 1, user_id: 1, username: "admin", action: "SYSTEM_INIT", entity_type: "system", entity_id: 1, details: '{"message": "Kasa Takip Sistemi kuruldu."}', ip_address: "Client", created_at: new Date().toISOString() }
            ],
            rates: {
                USD_TRY: 34.20,
                EUR_TRY: 37.80,
                GBP_TRY: 44.50,
                USDT_TRY: 34.25,
                BTC_USD: 63500.0,
                ETH_USD: 2650.0
            }
        };
    },

    // Realistic Demo Data (Optional)
    getDefaultDemoData() {
        const now = new Date();
        const formatDateStr = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
        const daysAgo = (n) => {
            const d = new Date(now);
            d.setDate(d.getDate() - n);
            return formatDateStr(d);
        };
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().slice(0, 10);

        return {
            users: [
                { id: 1, username: "admin", email: "admin@finans.pro", full_name: "Ahmet Yılmaz (Yönetici)", role: "admin", pin: "1234", is_active: 1, created_at: daysAgo(30) },
                { id: 2, username: "manager", email: "muhasebe@finans.pro", full_name: "Zeynep Kaya (Finans Müdürü)", role: "manager", pin: "1234", is_active: 1, created_at: daysAgo(30) },
                { id: 3, username: "operator", email: "kasa@finans.pro", full_name: "Burak Demir (Kasa Sorumlusu)", role: "operator", pin: "1234", is_active: 1, created_at: daysAgo(30) },
            ],
            accounts: [
                { id: 1, name: "Garanti BBVA Ticari", account_type: "bank", currency: "TRY", iban_or_address: "TR12 0006 2000 0001 2345 6789 01", bank_name: "Garanti BBVA", initial_balance: 350000, current_balance: 482500, color: "#10b981", icon: "building-2", is_active: 1, notes: "Ana şirket hesabı" },
                { id: 2, name: "İş Bankası USD", account_type: "bank", currency: "USD", iban_or_address: "TR34 0006 4000 0009 8765 4321 02", bank_name: "İş Bankası", initial_balance: 15000, current_balance: 24500, color: "#0284c7", icon: "landmark", is_active: 1, notes: "Yurtdışı ihracat hesabı" },
                { id: 3, name: "Ofis Çelik Kasa", account_type: "cash", currency: "TRY", iban_or_address: "", bank_name: "", initial_balance: 25000, current_balance: 18450, color: "#f59e0b", icon: "vault", is_active: 1, notes: "Ofis içi acil nakit" },
                { id: 4, name: "Binance USDT Cüzdanı", account_type: "crypto", currency: "USDT", iban_or_address: "TRC20: TLq8kM9XwP7zBv4NaQxYzW3uT1s8LkJ9pM", bank_name: "Binance", initial_balance: 10000, current_balance: 16850, color: "#f97316", icon: "coins", is_active: 1, notes: "USDT kripto kasası" },
                { id: 5, name: "Ledger Soğuk Cüzdan", account_type: "crypto", currency: "BTC", iban_or_address: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", bank_name: "Ledger", initial_balance: 0.5, current_balance: 0.85, color: "#eab308", icon: "shield", is_active: 1, notes: "BTC rezerv cüzdanı" }
            ],
            categories: [
                { id: 1, name: "Müşteri Ödemesi", type: "income", icon: "hand-coins", color: "#10b981", is_system: 1 },
                { id: 2, name: "SaaS Yazılım Satışı", type: "income", icon: "laptop", color: "#06b6d4", is_system: 1 },
                { id: 3, name: "Danışmanlık", type: "income", icon: "briefcase", color: "#3b82f6", is_system: 1 },
                { id: 4, name: "Diğer Gelirler", type: "income", icon: "plus-circle", color: "#64748b", is_system: 1 },
                { id: 5, name: "Sunucu & Bulut (AWS)", type: "expense", icon: "server", color: "#ef4444", is_system: 1 },
                { id: 6, name: "Yazılım & API Lisansları", type: "expense", icon: "code", color: "#f97316", is_system: 1 },
                { id: 7, name: "Personel Maaşları", type: "expense", icon: "users", color: "#ec4899", is_system: 1 },
                { id: 8, name: "Ofis Kirası", type: "expense", icon: "building", color: "#a855f7", is_system: 1 },
                { id: 9, name: "Pazarlama (Google/Meta)", type: "expense", icon: "megaphone", color: "#eab308", is_system: 1 },
            ],
            transactions: [
                { id: 1, transaction_type: "income", from_account_id: null, to_account_id: 1, category_id: 1, user_id: 1, amount: 125000, currency: "TRY", fx_rate: 1, converted_amount: 125000, description: "Acme Corp - Q3 Proje Hakedişi", receipt_data: "", receipt_filename: "", transaction_date: daysAgo(5) },
                { id: 2, transaction_type: "income", from_account_id: null, to_account_id: 2, category_id: 2, user_id: 2, amount: 8500, currency: "USD", fx_rate: 34.2, converted_amount: 290700, description: "Nexus Global - Yıllık SaaS Lisans Bedeli", receipt_data: "", receipt_filename: "", transaction_date: daysAgo(4) },
                { id: 3, transaction_type: "income", from_account_id: null, to_account_id: 4, category_id: 3, user_id: 1, amount: 5000, currency: "USDT", fx_rate: 34.25, converted_amount: 171250, description: "Web3 Danışmanlık ve Güvenlik Denetimi", receipt_data: "", receipt_filename: "", transaction_date: daysAgo(3) },
                { id: 4, transaction_type: "expense", from_account_id: 1, to_account_id: null, category_id: 7, user_id: 2, amount: 78000, currency: "TRY", fx_rate: 1, converted_amount: 78000, description: "Ağustos Ekip Maaş Ödemeleri", receipt_data: "", receipt_filename: "", transaction_date: daysAgo(7) },
                { id: 5, transaction_type: "expense", from_account_id: 2, to_account_id: null, category_id: 5, user_id: 1, amount: 450, currency: "USD", fx_rate: 34.2, converted_amount: 15390, description: "AWS Fatura Ödemesi", receipt_data: "", receipt_filename: "", transaction_date: daysAgo(6) },
                { id: 6, transaction_type: "transfer", from_account_id: 1, to_account_id: 3, category_id: null, user_id: 2, amount: 15000, currency: "TRY", fx_rate: 1, converted_amount: 15000, description: "Banka ATM'sinden Ofis Kasasına Nakit Takviyesi", receipt_data: "", receipt_filename: "", transaction_date: daysAgo(4) }
            ],
            subscriptions: [
                { id: 1, title: "AWS Bulut Altyapısı", category_id: 5, account_id: 2, amount: 480, currency: "USD", billing_cycle: "monthly", next_due_date: new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10), is_active: 1, notes: "Sunucular" },
                { id: 2, title: "OpenAI API", category_id: 6, account_id: 4, amount: 250, currency: "USDT", billing_cycle: "monthly", next_due_date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), is_active: 1, notes: "API kullanımı" },
                { id: 3, title: "Ofis Kirası & Aidat", category_id: 8, account_id: 1, amount: 45000, currency: "TRY", billing_cycle: "monthly", next_due_date: new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10), is_active: 1, notes: "Kira" }
            ],
            z_reports: [
                {
                    id: 1,
                    report_date: yesterdayStr,
                    closed_by_user_id: 1,
                    opening_balance_try: 1850000,
                    total_income_try: 69500,
                    total_expense_try: 10570,
                    calculated_closing_balance_try: 1908930,
                    actual_closing_balance_try: 1908930,
                    discrepancy_try: 0,
                    accounts_snapshot_json: JSON.stringify([]),
                    notes: "Dünkü kapanış mutabakatı tamamlandı.",
                    is_locked: 1,
                    created_at: daysAgo(1)
                }
            ],
            audit_logs: [
                { id: 1, user_id: 1, username: "admin", action: "SYSTEM_INIT", entity_type: "system", entity_id: 1, details: '{"message": "Demo sistemi kuruldu."}', ip_address: "Client", created_at: daysAgo(30) }
            ],
            rates: {
                USD_TRY: 34.20,
                EUR_TRY: 37.80,
                GBP_TRY: 44.50,
                USDT_TRY: 34.25,
                BTC_USD: 63500.0,
                ETH_USD: 2650.0
            }
        };
    },

    load() {
        const raw = localStorage.getItem(this.KEY_DATA);
        if (!raw) {
            const defaults = this.getDefaultDemoData();
            this.save(defaults);
            return defaults;
        }
        try {
            return JSON.parse(raw);
        } catch (e) {
            const defaults = this.getDefaultDemoData();
            this.save(defaults);
            return defaults;
        }
    },

    save(data) {
        localStorage.setItem(this.KEY_DATA, JSON.stringify(data));
    },

    resetToClean() {
        const clean = this.getEmptyTemplate();
        this.save(clean);
        return clean;
    },

    resetToDemo() {
        const demo = this.getDefaultDemoData();
        this.save(demo);
        return demo;
    },

    logAudit(userId, username, action, entityType, entityId, details) {
        const data = this.load();
        data.audit_logs.unshift({
            id: (data.audit_logs[0] ? data.audit_logs[0].id + 1 : 1),
            user_id: userId,
            username: username || 'admin',
            action: action,
            entity_type: entityType,
            entity_id: entityId,
            details: typeof details === 'string' ? details : JSON.stringify(details),
            ip_address: "Tarayıcı (Local)",
            created_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
        });
        this.save(data);
    },

    convertToTry(amount, currency, rates) {
        const c = (currency || 'TRY').toUpperCase();
        if (c === 'TRY') return amount;
        if (c === 'USD') return amount * (rates.USD_TRY || 34.20);
        if (c === 'EUR') return amount * (rates.EUR_TRY || 37.80);
        if (c === 'GBP') return amount * (rates.GBP_TRY || 44.50);
        if (c === 'USDT') return amount * (rates.USDT_TRY || 34.25);
        if (c === 'BTC') return amount * (rates.BTC_USD || 63500) * (rates.USD_TRY || 34.20);
        if (c === 'ETH') return amount * (rates.ETH_USD || 2650) * (rates.USD_TRY || 34.20);
        return amount;
    },

    convertCurrency(amount, fromCurr, toCurr, rates) {
        const f = (fromCurr || 'TRY').toUpperCase();
        const t = (toCurr || 'TRY').toUpperCase();
        if (f === t) return amount;

        const inTry = this.convertToTry(amount, f, rates);
        if (t === 'TRY') return inTry;
        if (t === 'USD') return inTry / (rates.USD_TRY || 34.20);
        if (t === 'EUR') return inTry / (rates.EUR_TRY || 37.80);
        if (t === 'GBP') return inTry / (rates.GBP_TRY || 44.50);
        if (t === 'USDT') return inTry / (rates.USDT_TRY || 34.25);
        if (t === 'BTC') return inTry / ((rates.BTC_USD || 63500) * (rates.USD_TRY || 34.20));
        return inTry;
    },

    exportBackupJSON() {
        const data = this.load();
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `finans_pro_yedek_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    importBackupJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const parsed = JSON.parse(e.target.result);
                    if (parsed.accounts !== undefined && parsed.transactions !== undefined) {
                        this.save(parsed);
                        resolve(true);
                    } else {
                        reject(new Error("Geçersiz yedek dosyası formatı."));
                    }
                } catch (err) {
                    reject(err);
                }
            };
            reader.readAsText(file);
        });
    }
};

window.StorageDB = StorageDB;
