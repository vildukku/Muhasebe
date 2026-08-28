/**
 * Client-Side Storage & Database Engine (GitHub Pages & Offline PWA Ready)
 * Provides 100% serverless, zero-backend persistence with localStorage.
 */

const StorageDB = {
    KEY_DATA: 'finance_pro_data_v1',
    KEY_SESSION: 'finance_pro_session',

    // Default Seed Data
    getDefaultData() {
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
                { id: 1, username: "admin", email: "admin@sirket.com", full_name: "Ahmet Yılmaz (Yönetici)", role: "admin", is_active: 1, created_at: daysAgo(30) },
                { id: 2, username: "manager", email: "muhasebe@sirket.com", full_name: "Zeynep Kaya (Finans Müdürü)", role: "manager", is_active: 1, created_at: daysAgo(30) },
                { id: 3, username: "operator", email: "kasa@sirket.com", full_name: "Burak Demir (Kasa Sorumlusu)", role: "operator", is_active: 1, created_at: daysAgo(30) },
                { id: 4, username: "viewer", email: "denetim@sirket.com", full_name: "Elif Öztürk (Denetçi / İzleyici)", role: "viewer", is_active: 1, created_at: daysAgo(30) },
            ],
            accounts: [
                { id: 1, name: "Garanti BBVA - Ana Ticari", account_type: "bank", currency: "TRY", iban_or_address: "TR12 0006 2000 0001 2345 6789 01", bank_name: "Garanti BBVA", initial_balance: 350000, current_balance: 482500, color: "#10b981", icon: "building-2", is_active: 1, notes: "Ana operasyonel banka hesabı" },
                { id: 2, name: "İş Bankası - İhracat Döviz", account_type: "bank", currency: "USD", iban_or_address: "TR34 0006 4000 0009 8765 4321 02", bank_name: "Türkiye İş Bankası", initial_balance: 15000, current_balance: 24500, color: "#0284c7", icon: "landmark", is_active: 1, notes: "Yurtdışı müşteri tahsilat hesabı" },
                { id: 3, name: "Ofis Ana Çelik Kasa", account_type: "cash", currency: "TRY", iban_or_address: "", bank_name: "", initial_balance: 25000, current_balance: 18450, color: "#f59e0b", icon: "vault", is_active: 1, notes: "Ofis içi acil nakit ve elden harcama kasası" },
                { id: 4, name: "Yurtdışı Seyahat Kasası", account_type: "cash", currency: "EUR", iban_or_address: "", bank_name: "", initial_balance: 2000, current_balance: 3200, color: "#8b5cf6", icon: "banknote", is_active: 1, notes: "Yurtdışı fuar ve seyahat nakit kasası" },
                { id: 5, name: "Binance Kurumsal Cüzdan", account_type: "crypto", currency: "USDT", iban_or_address: "TRC20: TLq8kM9XwP7zBv4NaQxYzW3uT1s8LkJ9pM", bank_name: "Binance", initial_balance: 10000, current_balance: 16850, color: "#f97316", icon: "coins", is_active: 1, notes: "USDT operasyonel kripto cüzdanı" },
                { id: 6, name: "Ledger Cold Storage", account_type: "crypto", currency: "BTC", iban_or_address: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", bank_name: "Ledger", initial_balance: 0.5, current_balance: 0.85, color: "#eab308", icon: "shield", is_active: 1, notes: "Şirket BTC rezerv soğuk cüzdanı" }
            ],
            categories: [
                { id: 1, name: "Müşteri Ödemesi", type: "income", icon: "hand-coins", color: "#10b981", is_system: 1 },
                { id: 2, name: "SaaS Yazılım Satışı", type: "income", icon: "laptop", color: "#06b6d4", is_system: 1 },
                { id: 3, name: "Danışmanlık Hizmeti", type: "income", icon: "briefcase", color: "#3b82f6", is_system: 1 },
                { id: 4, name: "Kur & Kripto Değer Artışı", type: "income", icon: "trending-up", color: "#8b5cf6", is_system: 1 },
                { id: 5, name: "Diğer Gelirler", type: "income", icon: "plus-circle", color: "#64748b", is_system: 1 },
                { id: 6, name: "Sunucu & Bulut (AWS / Hetzner)", type: "expense", icon: "server", color: "#ef4444", is_system: 1 },
                { id: 7, name: "Yazılım & API Lisansları", type: "expense", icon: "code", color: "#f97316", is_system: 1 },
                { id: 8, name: "Personel & Maaş Ödemeleri", type: "expense", icon: "users", color: "#ec4899", is_system: 1 },
                { id: 9, name: "Ofis Kirası & Aidat", type: "expense", icon: "building", color: "#a855f7", is_system: 1 },
                { id: 10, name: "Pazarlama & Reklam (Google/Meta)", type: "expense", icon: "megaphone", color: "#eab308", is_system: 1 },
                { id: 11, name: "Donanım & Ofis Demirbaşı", type: "expense", icon: "monitor", color: "#6366f1", is_system: 1 },
                { id: 12, name: "Yemek, Temsil & Ulaşım", type: "expense", icon: "coffee", color: "#14b8a6", is_system: 1 },
                { id: 13, name: "Banka & Transfer Komisyonu", type: "expense", icon: "percent", color: "#94a3b8", is_system: 1 },
            ],
            transactions: [
                { id: 1, transaction_type: "income", from_account_id: null, to_account_id: 1, category_id: 1, user_id: 1, amount: 125000, currency: "TRY", fx_rate: 1, converted_amount: 125000, description: "Acme Corp - Q3 Yazılım Geliştirme Hakedişi", receipt_data: "", receipt_filename: "", transaction_date: daysAgo(5) },
                { id: 2, transaction_type: "income", from_account_id: null, to_account_id: 2, category_id: 2, user_id: 2, amount: 8500, currency: "USD", fx_rate: 34.2, converted_amount: 290700, description: "Nexus Global - Yıllık Kurumsal SaaS Lisans Bedeli", receipt_data: "", receipt_filename: "", transaction_date: daysAgo(4) },
                { id: 3, transaction_type: "income", from_account_id: null, to_account_id: 5, category_id: 3, user_id: 1, amount: 5000, currency: "USDT", fx_rate: 34.25, converted_amount: 171250, description: "Web3 Proje Akıllı Sözleşme Güvenlik Denetim Ücreti", receipt_data: "", receipt_filename: "", transaction_date: daysAgo(3) },
                { id: 4, transaction_type: "income", from_account_id: null, to_account_id: 3, category_id: 5, user_id: 3, amount: 4500, currency: "TRY", fx_rate: 1, converted_amount: 4500, description: "Eski ofis monitör ve donanım elden nakit satışı", receipt_data: "", receipt_filename: "", transaction_date: daysAgo(2) },
                { id: 5, transaction_type: "income", from_account_id: null, to_account_id: 1, category_id: 1, user_id: 2, amount: 65000, currency: "TRY", fx_rate: 1, converted_amount: 65000, description: "TechNova - Mobil Uygulama Aşama-2 Teslimatı", receipt_data: "", receipt_filename: "", transaction_date: daysAgo(1) },
                { id: 6, transaction_type: "expense", from_account_id: 1, to_account_id: null, category_id: 8, user_id: 2, amount: 78000, currency: "TRY", fx_rate: 1, converted_amount: 78000, description: "Geliştirici Ekip Maaş & Prim Ödemeleri", receipt_data: "", receipt_filename: "", transaction_date: daysAgo(7) },
                { id: 7, transaction_type: "expense", from_account_id: 2, to_account_id: null, category_id: 6, user_id: 1, amount: 450, currency: "USD", fx_rate: 34.2, converted_amount: 15390, description: "AWS Fatura Ödemesi - Production Cluster", receipt_data: "", receipt_filename: "", transaction_date: daysAgo(6) },
                { id: 8, transaction_type: "expense", from_account_id: 1, to_account_id: null, category_id: 10, user_id: 2, amount: 14500, currency: "TRY", fx_rate: 1, converted_amount: 14500, description: "Google Ads & Meta Ads Aylık Dönüşüm Kampanyası", receipt_data: "", receipt_filename: "", transaction_date: daysAgo(3) },
                { id: 9, transaction_type: "expense", from_account_id: 3, to_account_id: null, category_id: 12, user_id: 3, amount: 2350, currency: "TRY", fx_rate: 1, converted_amount: 2350, description: "Müşteri öğle yemeği ve taksi ulaşım fişleri", receipt_data: "", receipt_filename: "", transaction_date: daysAgo(1) },
                { id: 10, transaction_type: "expense", from_account_id: 5, to_account_id: null, category_id: 7, user_id: 1, amount: 240, currency: "USDT", fx_rate: 34.25, converted_amount: 8220, description: "OpenAI API Usage faturası (LLM inference)", receipt_data: "", receipt_filename: "", transaction_date: daysAgo(0) },
                { id: 11, transaction_type: "transfer", from_account_id: 1, to_account_id: 3, category_id: null, user_id: 2, amount: 15000, currency: "TRY", fx_rate: 1, converted_amount: 15000, description: "Banka ATM'sinden Ofis Kasasına Nakit Takviyesi", receipt_data: "", receipt_filename: "", transaction_date: daysAgo(4) },
                { id: 12, transaction_type: "transfer", from_account_id: 2, to_account_id: 5, category_id: null, user_id: 1, amount: 3000, currency: "USD", fx_rate: 1, converted_amount: 102600, description: "Banka USD hesabından Binance USDT cüzdanına transfer", receipt_data: "", receipt_filename: "", transaction_date: daysAgo(2) },
            ],
            subscriptions: [
                { id: 1, title: "AWS Bulut Altyapısı", category_id: 6, account_id: 2, amount: 480, currency: "USD", billing_cycle: "monthly", next_due_date: new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10), is_active: 1, notes: "Prod Kubernetes" },
                { id: 2, title: "OpenAI API & ChatGPT Team", category_id: 7, account_id: 5, amount: 250, currency: "USDT", billing_cycle: "monthly", next_due_date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), is_active: 1, notes: "LLM API usage" },
                { id: 3, title: "Hetzner Dedicated Server", category_id: 6, account_id: 4, amount: 185, currency: "EUR", billing_cycle: "monthly", next_due_date: new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10), is_active: 1, notes: "Backup storage" },
                { id: 4, title: "Figma Enterprise Lisansı", category_id: 7, account_id: 2, amount: 90, currency: "USD", billing_cycle: "monthly", next_due_date: new Date(Date.now() + 18 * 86400000).toISOString().slice(0, 10), is_active: 1, notes: "Design team" },
                { id: 5, title: "Plaza Ofis Kirası & Yönetim", category_id: 9, account_id: 1, amount: 45000, currency: "TRY", billing_cycle: "monthly", next_due_date: new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10), is_active: 1, notes: "Ana ofis" },
                { id: 6, title: "Google Workspace & Domain", category_id: 7, account_id: 1, amount: 1850, currency: "TRY", billing_cycle: "monthly", next_due_date: new Date(Date.now() + 25 * 86400000).toISOString().slice(0, 10), is_active: 1, notes: "E-posta lisansı" },
            ],
            z_reports: [
                {
                    id: 1,
                    report_date: yesterdayStr,
                    closed_by_user_id: 2,
                    opening_balance_try: 1850000,
                    total_income_try: 69500,
                    total_expense_try: 10570,
                    calculated_closing_balance_try: 1908930,
                    actual_closing_balance_try: 1908930,
                    discrepancy_try: 0,
                    accounts_snapshot_json: JSON.stringify([
                        { name: "Garanti BBVA", currency: "TRY", balance: 432500, balance_in_try: 432500 },
                        { name: "İş Bankası USD", currency: "USD", balance: 24500, balance_in_try: 837900 },
                        { name: "Ofis Ana Çelik Kasa", currency: "TRY", balance: 18450, balance_in_try: 18450 },
                        { name: "Binance Kurumsal", currency: "USDT", balance: 16850, balance_in_try: 577112 },
                    ]),
                    notes: "Gün sonu kasa sayımı eksiksiz tamamlandı.",
                    is_locked: 1,
                    created_at: daysAgo(1)
                }
            ],
            audit_logs: [
                { id: 1, user_id: 1, username: "admin", action: "SYSTEM_INIT", entity_type: "system", entity_id: 1, details: '{"message": "Sistem GitHub Pages / Offline modunda başlatıldı."}', ip_address: "Client-Local", created_at: daysAgo(30) },
                { id: 2, user_id: 2, username: "manager", action: "CREATE_TX", entity_type: "transaction", entity_id: 1, details: '{"type": "income", "amount": "125000 TRY"}', ip_address: "Client-Local", created_at: daysAgo(5) },
                { id: 3, user_id: 2, username: "manager", action: "TRANSFER", entity_type: "transaction", entity_id: 11, details: '{"from": "Garanti BBVA", "to": "Ofis Kasası", "amount": "15000 TRY"}', ip_address: "Client-Local", created_at: daysAgo(4) },
            ],
            rates: {
                USD_TRY: 34.20,
                EUR_TRY: 37.80,
                GBP_TRY: 44.50,
                USDT_TRY: 34.25,
                BTC_USD: 63500.0,
                ETH_USD: 2650.0,
                SOL_USD: 145.0
            }
        };
    },

    load() {
        const raw = localStorage.getItem(this.KEY_DATA);
        if (!raw) {
            const defaults = this.getDefaultData();
            this.save(defaults);
            return defaults;
        }
        try {
            return JSON.parse(raw);
        } catch (e) {
            const defaults = this.getDefaultData();
            this.save(defaults);
            return defaults;
        }
    },

    save(data) {
        localStorage.setItem(this.KEY_DATA, JSON.stringify(data));
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

    // Multi-currency Converter
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

    // Export & Import Database Backup (JSON)
    exportBackupJSON() {
        const data = this.load();
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `finans_yedek_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    importBackupJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const parsed = JSON.parse(e.target.result);
                    if (parsed.accounts && parsed.transactions) {
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
