/**
 * Client-Side Storage & Database Engine - PRODUCTION RELEASE (Clean State)
 * 0 TL balance, clean accounts, standard categories, zero dummy data.
 */

const StorageDB = {
    KEY_DATA: 'finance_pro_production_data_v3',
    KEY_SESSION: 'finance_pro_auth_session',

    // Production Clean Template (0 TL & Empty Accounts)
    getCleanProductionData() {
        return {
            users: [
                {
                    id: 1,
                    username: "admin",
                    email: "admin@finans.pro",
                    full_name: "Yönetici",
                    role: "admin",
                    password_hash: "admin123",
                    is_active: 1,
                    created_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
                }
            ],
            accounts: [],
            categories: [
                { id: 1, name: "Müşteri Ödemesi & Satış", type: "income", icon: "hand-coins", color: "#10b981", is_system: 1 },
                { id: 2, name: "Hizmet & Danışmanlık Geliri", type: "income", icon: "laptop", color: "#06b6d4", is_system: 1 },
                { id: 3, name: "Kripto / Kur Geliri", type: "income", icon: "trending-up", color: "#8b5cf6", is_system: 1 },
                { id: 4, name: "Diğer Gelirler", type: "income", icon: "plus-circle", color: "#64748b", is_system: 1 },
                { id: 5, name: "Sunucu & Altyapı (AWS/Hetzner)", type: "expense", icon: "server", color: "#ef4444", is_system: 1 },
                { id: 6, name: "Yazılım & Lisanslar", type: "expense", icon: "code", color: "#f97316", is_system: 1 },
                { id: 7, name: "Personel & Ekip Maaşları", type: "expense", icon: "users", color: "#ec4899", is_system: 1 },
                { id: 8, name: "Ofis Kirası & Aidat", type: "expense", icon: "building", color: "#a855f7", is_system: 1 },
                { id: 9, name: "Pazarlama & Reklam (Google/Meta)", type: "expense", icon: "megaphone", color: "#eab308", is_system: 1 },
                { id: 10, name: "Yemek, Ulaşım & Temsil", type: "expense", icon: "coffee", color: "#14b8a6", is_system: 1 },
                { id: 11, name: "Banka Komisyon & Vergi", type: "expense", icon: "percent", color: "#94a3b8", is_system: 1 }
            ],
            transactions: [],
            subscriptions: [],
            z_reports: [],
            audit_logs: [
                {
                    id: 1,
                    user_id: 1,
                    username: "admin",
                    action: "SYSTEM_INIT",
                    entity_type: "system",
                    entity_id: 1,
                    details: '{"message": "Finans Pro üretim sürümü başlatıldı."}',
                    ip_address: "Client",
                    created_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
                }
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
            const cleanData = this.getCleanProductionData();
            this.save(cleanData);
            return cleanData;
        }
        try {
            return JSON.parse(raw);
        } catch (e) {
            const cleanData = this.getCleanProductionData();
            this.save(cleanData);
            return cleanData;
        }
    },

    save(data) {
        localStorage.setItem(this.KEY_DATA, JSON.stringify(data));
    },

    resetAllData() {
        const clean = this.getCleanProductionData();
        this.save(clean);
        return clean;
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
                    if (parsed.categories !== undefined) {
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
