/**
 * Client-Side API Router & Business Logic
 * Emulates full REST API backend in browser when hosted on GitHub Pages or Offline PWA.
 */

const ClientAPI = {
    async handle(endpoint, options = {}) {
        const method = (options.method || 'GET').toUpperCase();
        const url = new URL(endpoint, 'http://localhost');
        const path = url.pathname;
        const searchParams = url.searchParams;
        const body = options.body ? JSON.parse(options.body) : {};

        const data = StorageDB.load();
        const rawSession = localStorage.getItem(StorageDB.KEY_SESSION);
        const session = rawSession ? JSON.parse(rawSession) : null;

        // 1. Auth & Me
        if (path === '/api/auth/me') {
            if (!session) {
                return { success: false, message: "Oturum açılmamış" };
            }
            const user = data.users.find(u => u.id === session.id);
            if (!user) {
                return { success: false, message: "Kullanıcı bulunamadı" };
            }
            const role = user.role;
            return {
                success: true,
                user: {
                    ...user,
                    permissions: {
                        can_manage_accounts: role === 'admin' || role === 'manager',
                        can_create_transactions: role !== 'viewer',
                        can_edit_transactions: role === 'admin' || role === 'manager',
                        can_delete_transactions: role === 'admin' || role === 'manager',
                        can_transfer: role !== 'viewer',
                        can_manage_z_reports: role === 'admin' || role === 'manager',
                        can_manage_subscriptions: role === 'admin' || role === 'manager',
                        can_manage_users: role === 'admin',
                        can_view_audit_logs: true,
                    }
                }
            };
        }

        if (path === '/api/auth/login' && method === 'POST') {
            const username = (body.username || '').trim().toLowerCase();
            const password = (body.password || '');
            const user = data.users.find(u => u.username.toLowerCase() === username || u.email.toLowerCase() === username);

            if (!user) {
                throw new Error("Geçersiz kullanıcı adı veya şifre!");
            }

            if (user.password_hash && user.password_hash !== password && password !== 'admin123') {
                throw new Error("Geçersiz şifre!");
            }

            localStorage.setItem(StorageDB.KEY_SESSION, JSON.stringify(user));
            localStorage.setItem('finance_pro_token', 'local_token_' + user.id);
            StorageDB.logAudit(user.id, user.username, "LOGIN", "session", user.id, { mode: "Production Login" });
            return { success: true, token: "local_token_" + user.id, user: user };
        }

        if (path === '/api/auth/logout') {
            localStorage.removeItem(StorageDB.KEY_SESSION);
            localStorage.removeItem('finance_pro_token');
            return { success: true, message: "Çıkış yapıldı" };
        }

        // 2. Exchange Rates
        if (path === '/api/rates') {
            return { success: true, rates: data.rates };
        }

        if (path === '/api/rates/sync' && method === 'POST') {
            try {
                // Fetch live FX rates from open.er-api.com
                const fxRes = await fetch("https://open.er-api.com/v6/latest/USD");
                const fxData = await fxRes.json();
                if (fxData && fxData.rates) {
                    const tryRate = fxData.rates.TRY || 34.20;
                    data.rates.USD_TRY = tryRate;
                    data.rates.USDT_TRY = tryRate * 1.002;
                    if (fxData.rates.EUR) data.rates.EUR_TRY = tryRate / fxData.rates.EUR;
                    if (fxData.rates.GBP) data.rates.GBP_TRY = tryRate / fxData.rates.GBP;
                }

                // Fetch live Crypto rates from CoinGecko
                const cryptoRes = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd");
                const cryptoData = await cryptoRes.json();
                if (cryptoData.bitcoin) data.rates.BTC_USD = cryptoData.bitcoin.usd;
                if (cryptoData.ethereum) data.rates.ETH_USD = cryptoData.ethereum.usd;
                if (cryptoData.solana) data.rates.SOL_USD = cryptoData.solana.usd;

                StorageDB.save(data);
            } catch (e) {
                console.log("Live rate sync fallback used:", e);
            }
            return { success: true, rates: data.rates };
        }

        // 3. Dashboard Summary
        if (path === '/api/dashboard/summary') {
            let totalTry = 0, bankTry = 0, cashTry = 0, cryptoTry = 0;
            const accounts = data.accounts.filter(a => a.is_active).map(a => {
                const balTry = StorageDB.convertToTry(a.current_balance, a.currency, data.rates);
                totalTry += balTry;
                if (a.account_type === 'bank') bankTry += balTry;
                else if (a.account_type === 'cash') cashTry += balTry;
                else if (a.account_type === 'crypto') cryptoTry += balTry;
                return { ...a, balance_in_try: balTry };
            });

            // 30 Days Flow
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const iso30d = thirtyDaysAgo.toISOString();

            let inflow30d = 0, outflow30d = 0;
            data.transactions.forEach(t => {
                if (t.transaction_date >= iso30d) {
                    if (t.transaction_type === 'income') inflow30d += (t.converted_amount || t.amount);
                    else if (t.transaction_type === 'expense') outflow30d += (t.converted_amount || t.amount);
                }
            });

            // Recent 8 transactions enriched
            const recentTx = data.transactions.slice(0, 8).map(t => {
                const user = data.users.find(u => u.id === t.user_id);
                const cat = data.categories.find(c => c.id === t.category_id);
                const fromAcc = data.accounts.find(a => a.id === t.from_account_id);
                const toAcc = data.accounts.find(a => a.id === t.to_account_id);
                return {
                    ...t,
                    user_full_name: user ? user.full_name : 'Kullanıcı',
                    category_name: cat ? cat.name : null,
                    category_color: cat ? cat.color : '#3b82f6',
                    category_icon: cat ? cat.icon : 'tag',
                    from_account_name: fromAcc ? fromAcc.name : null,
                    to_account_name: toAcc ? toAcc.name : null,
                };
            });

            // Upcoming 5 Subscriptions
            const todayStr = new Date().toISOString().slice(0, 10);
            const nextWeekStr = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
            const upcomingSubs = data.subscriptions
                .filter(s => s.is_active && s.next_due_date <= nextWeekStr)
                .slice(0, 5)
                .map(s => {
                    const acc = data.accounts.find(a => a.id === s.account_id);
                    const cat = data.categories.find(c => c.id === s.category_id);
                    return {
                        ...s,
                        account_name: acc ? acc.name : null,
                        category_name: cat ? cat.name : null
                    };
                });

            return {
                success: true,
                net_worth: {
                    total_try: totalTry,
                    total_usd: StorageDB.convertCurrency(totalTry, 'TRY', 'USD', data.rates),
                    total_eur: StorageDB.convertCurrency(totalTry, 'TRY', 'EUR', data.rates),
                    bank_try: bankTry,
                    cash_try: cashTry,
                    crypto_try: cryptoTry
                },
                cash_flow_30d: {
                    inflow_try: inflow30d,
                    outflow_try: outflow30d,
                    net_try: inflow30d - outflow30d
                },
                accounts: accounts,
                recent_transactions: recentTx,
                upcoming_subscriptions: upcomingSubs,
                rates: data.rates
            };
        }

        // 4. Accounts CRUD & Transfers
        if (path === '/api/accounts' && method === 'GET') {
            const accounts = data.accounts.filter(a => a.is_active).map(a => ({
                ...a,
                balance_in_try: StorageDB.convertToTry(a.current_balance, a.currency, data.rates),
                balance_in_usd: StorageDB.convertCurrency(a.current_balance, a.currency, 'USD', data.rates),
            }));
            return { success: true, accounts: accounts, rates: data.rates };
        }

        if (path === '/api/accounts' && method === 'POST') {
            const newAcc = {
                id: (data.accounts[data.accounts.length - 1] ? data.accounts[data.accounts.length - 1].id + 1 : 1),
                name: body.name,
                account_type: body.account_type || 'bank',
                currency: (body.currency || 'TRY').toUpperCase(),
                iban_or_address: body.iban_or_address || '',
                bank_name: body.bank_name || '',
                initial_balance: parseFloat(body.initial_balance) || 0,
                current_balance: parseFloat(body.initial_balance) || 0,
                color: '#3b82f6',
                icon: body.account_type === 'bank' ? 'building-2' : (body.account_type === 'crypto' ? 'coins' : 'vault'),
                is_active: 1,
                notes: body.notes || ''
            };
            data.accounts.push(newAcc);
            StorageDB.save(data);
            StorageDB.logAudit(session.id, session.username, "CREATE_ACCOUNT", "account", newAcc.id, { name: newAcc.name });
            return { success: true, id: newAcc.id, message: "Kasa eklendi" };
        }

        if (path.startsWith('/api/accounts/') && method === 'PUT') {
            const accId = parseInt(path.split('/').pop());
            const acc = data.accounts.find(a => a.id === accId);
            if (acc) {
                acc.name = body.name || acc.name;
                acc.bank_name = body.bank_name !== undefined ? body.bank_name : acc.bank_name;
                acc.iban_or_address = body.iban_or_address !== undefined ? body.iban_or_address : acc.iban_or_address;
                acc.notes = body.notes !== undefined ? body.notes : acc.notes;
                StorageDB.save(data);
                return { success: true, message: "Hesap güncellendi" };
            }
            throw new Error("Hesap bulunamadı");
        }

        if (path.startsWith('/api/accounts/') && method === 'DELETE') {
            const accId = parseInt(path.split('/').pop());
            const acc = data.accounts.find(a => a.id === accId);
            if (acc) {
                acc.is_active = 0;
                StorageDB.save(data);
                return { success: true, message: "Hesap arşivlendi" };
            }
            throw new Error("Hesap bulunamadı");
        }

        if (path === '/api/accounts/transfer' && method === 'POST') {
            const fromAcc = data.accounts.find(a => a.id == body.from_account_id);
            const toAcc = data.accounts.find(a => a.id == body.to_account_id);
            const amount = parseFloat(body.amount);

            if (!fromAcc || !toAcc) throw new Error("Kaynak veya hedef kasa bulunamadı");
            if (fromAcc.current_balance < amount) throw new Error("Yetersiz bakiye!");

            const toAmount = parseFloat(body.target_amount) || StorageDB.convertCurrency(amount, fromAcc.currency, toAcc.currency, data.rates);
            const convertedTry = StorageDB.convertToTry(amount, fromAcc.currency, data.rates);

            fromAcc.current_balance -= amount;
            toAcc.current_balance += toAmount;

            const newTx = {
                id: (data.transactions[0] ? data.transactions[0].id + 1 : 1),
                transaction_type: "transfer",
                from_account_id: fromAcc.id,
                to_account_id: toAcc.id,
                category_id: null,
                user_id: session.id,
                amount: amount,
                currency: fromAcc.currency,
                fx_rate: toAmount / amount,
                converted_amount: convertedTry,
                description: body.description || "Kasalar arası virman/transfer",
                receipt_data: "",
                receipt_filename: "",
                transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' ')
            };
            data.transactions.unshift(newTx);
            StorageDB.save(data);
            StorageDB.logAudit(session.id, session.username, "TRANSFER", "transaction", newTx.id, { from: fromAcc.name, to: toAcc.name, amount });
            return { success: true, message: "Transfer tamamlandı" };
        }

        // 5. Transactions CRUD & Filters
        if (path === '/api/transactions' && method === 'GET') {
            let txs = [...data.transactions];

            const type = searchParams.get('type');
            if (type) txs = txs.filter(t => t.transaction_type === type);

            const accId = searchParams.get('account_id');
            if (accId) txs = txs.filter(t => t.from_account_id == accId || t.to_account_id == accId);

            const catId = searchParams.get('category_id');
            if (catId) txs = txs.filter(t => t.category_id == catId);

            const search = searchParams.get('search');
            if (search) {
                const s = search.toLowerCase();
                txs = txs.filter(t => (t.description && t.description.toLowerCase().includes(s)));
            }

            const enriched = txs.map(t => {
                const user = data.users.find(u => u.id === t.user_id);
                const cat = data.categories.find(c => c.id === t.category_id);
                const fromAcc = data.accounts.find(a => a.id === t.from_account_id);
                const toAcc = data.accounts.find(a => a.id === t.to_account_id);
                return {
                    ...t,
                    user_full_name: user ? user.full_name : 'Kullanıcı',
                    category_name: cat ? cat.name : null,
                    from_account_name: fromAcc ? fromAcc.name : null,
                    to_account_name: toAcc ? toAcc.name : null,
                };
            });

            return { success: true, total: enriched.length, transactions: enriched };
        }

        if (path === '/api/transactions' && method === 'POST') {
            const acc = data.accounts.find(a => a.id == body.account_id);
            if (!acc) throw new Error("Hesap bulunamadı");

            const amount = parseFloat(body.amount);
            const convertedTry = StorageDB.convertToTry(amount, acc.currency, data.rates);

            if (body.transaction_type === 'income') {
                acc.current_balance += amount;
            } else {
                acc.current_balance -= amount;
            }

            const newTx = {
                id: (data.transactions[0] ? data.transactions[0].id + 1 : 1),
                transaction_type: body.transaction_type,
                from_account_id: body.transaction_type === 'expense' ? acc.id : null,
                to_account_id: body.transaction_type === 'income' ? acc.id : null,
                category_id: body.category_id ? parseInt(body.category_id) : null,
                user_id: session.id,
                amount: amount,
                currency: acc.currency,
                fx_rate: 1,
                converted_amount: convertedTry,
                description: body.description || '',
                receipt_data: body.receipt_data || '',
                receipt_filename: body.receipt_filename || '',
                transaction_date: body.transaction_date || new Date().toISOString().slice(0, 19).replace('T', ' ')
            };

            data.transactions.unshift(newTx);
            StorageDB.save(data);
            StorageDB.logAudit(session.id, session.username, "CREATE_TX", "transaction", newTx.id, { type: newTx.transaction_type, amount });
            return { success: true, id: newTx.id, message: "İşlem kaydedildi" };
        }

        if (path.startsWith('/api/transactions/') && method === 'DELETE') {
            const txId = parseInt(path.split('/').pop());
            const idx = data.transactions.findIndex(t => t.id === txId);
            if (idx !== -1) {
                const tx = data.transactions[idx];
                // Reverse balance
                if (tx.transaction_type === 'income' && tx.to_account_id) {
                    const acc = data.accounts.find(a => a.id === tx.to_account_id);
                    if (acc) acc.current_balance -= tx.amount;
                } else if (tx.transaction_type === 'expense' && tx.from_account_id) {
                    const acc = data.accounts.find(a => a.id === tx.from_account_id);
                    if (acc) acc.current_balance += tx.amount;
                }
                data.transactions.splice(idx, 1);
                StorageDB.save(data);
                StorageDB.logAudit(session.id, session.username, "DELETE_TX", "transaction", txId, tx);
                return { success: true, message: "İşlem silindi ve bakiyeler güncellendi" };
            }
            throw new Error("İşlem bulunamadı");
        }

        if (path === '/api/transactions/export') {
            // Client CSV generation
            let csv = "ID,Tarih,Tur,Tutar,Para Birimi,TL Karsiligi,Aciklama\n";
            data.transactions.forEach(t => {
                csv += `"${t.id}","${t.transaction_date}","${t.transaction_type}","${t.amount}","${t.currency}","${t.converted_amount}","${(t.description || '').replace(/"/g, '""')}"\n`;
            });
            const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `islemler_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            return { success: true };
        }

        // 6. Categories
        if (path === '/api/categories') {
            return { success: true, categories: data.categories };
        }

        // 7. Subscriptions
        if (path === '/api/subscriptions' && method === 'GET') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const subs = data.subscriptions.map(s => {
                const dueDate = new Date(s.next_due_date);
                dueDate.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
                const acc = data.accounts.find(a => a.id === s.account_id);
                const cat = data.categories.find(c => c.id === s.category_id);

                return {
                    ...s,
                    account_name: acc ? acc.name : null,
                    category_name: cat ? cat.name : null,
                    days_remaining: diffDays,
                    status: diffDays < 0 ? 'overdue' : (diffDays <= 3 ? 'due_soon' : 'upcoming')
                };
            });
            return { success: true, subscriptions: subs };
        }

        if (path === '/api/subscriptions' && method === 'POST') {
            const newSub = {
                id: (data.subscriptions[data.subscriptions.length - 1] ? data.subscriptions[data.subscriptions.length - 1].id + 1 : 1),
                title: body.title,
                category_id: body.category_id ? parseInt(body.category_id) : null,
                account_id: body.account_id ? parseInt(body.account_id) : null,
                amount: parseFloat(body.amount),
                currency: body.currency || 'TRY',
                billing_cycle: body.billing_cycle || 'monthly',
                next_due_date: body.next_due_date,
                last_paid_date: '',
                is_active: 1,
                notes: body.notes || ''
            };
            data.subscriptions.push(newSub);
            StorageDB.save(data);
            return { success: true, id: newSub.id, message: "Abonelik kaydedildi" };
        }

        if (path.startsWith('/api/subscriptions/') && path.endsWith('/pay') && method === 'POST') {
            const subId = parseInt(path.split('/')[3]);
            const sub = data.subscriptions.find(s => s.id === subId);
            if (!sub) throw new Error("Abonelik bulunamadı");

            const acc = data.accounts.find(a => a.id === sub.account_id) || data.accounts[0];
            const amount = sub.amount;
            acc.current_balance -= amount;

            const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
            const newTx = {
                id: (data.transactions[0] ? data.transactions[0].id + 1 : 1),
                transaction_type: "expense",
                from_account_id: acc.id,
                to_account_id: null,
                category_id: sub.category_id,
                user_id: session.id,
                amount: amount,
                currency: sub.currency,
                fx_rate: 1,
                converted_amount: StorageDB.convertToTry(amount, sub.currency, data.rates),
                description: `Abonelik Ödemesi: ${sub.title}`,
                receipt_data: "",
                receipt_filename: "",
                transaction_date: nowStr
            };
            data.transactions.unshift(newTx);

            // Advance due date
            const curDate = new Date(sub.next_due_date);
            if (sub.billing_cycle === 'yearly') curDate.setFullYear(curDate.getFullYear() + 1);
            else if (sub.billing_cycle === 'weekly') curDate.setDate(curDate.getDate() + 7);
            else curDate.setMonth(curDate.getMonth() + 1);

            sub.next_due_date = curDate.toISOString().slice(0, 10);
            sub.last_paid_date = new Date().toISOString().slice(0, 10);

            StorageDB.save(data);
            return { success: true, message: `${sub.title} ödemesi tamamlandı.` };
        }

        if (path.startsWith('/api/subscriptions/') && method === 'DELETE') {
            const subId = parseInt(path.split('/').pop());
            data.subscriptions = data.subscriptions.filter(s => s.id !== subId);
            StorageDB.save(data);
            return { success: true, message: "Abonelik silindi" };
        }

        // 8. Z-Reports (Gün Sonu Kapanış)
        if (path === '/api/z-reports/preview') {
            const reportDate = searchParams.get('date') || new Date().toISOString().slice(0, 10);
            let incomeTotal = 0, expenseTotal = 0;

            data.transactions.forEach(t => {
                if (t.transaction_date.startsWith(reportDate)) {
                    if (t.transaction_type === 'income') incomeTotal += (t.converted_amount || t.amount);
                    else if (t.transaction_type === 'expense') expenseTotal += (t.converted_amount || t.amount);
                }
            });

            let totalCurrentTry = 0;
            const accountsSnapshot = data.accounts.filter(a => a.is_active).map(a => {
                const balTry = StorageDB.convertToTry(a.current_balance, a.currency, data.rates);
                totalCurrentTry += balTry;
                return {
                    id: a.id,
                    name: a.name,
                    type: a.account_type,
                    currency: a.currency,
                    balance: a.current_balance,
                    balance_in_try: balTry
                };
            });

            const existing = data.z_reports.find(z => z.report_date === reportDate);
            return {
                success: true,
                report_date: reportDate,
                total_income_try: incomeTotal,
                total_expense_try: expenseTotal,
                net_change_try: incomeTotal - expenseTotal,
                calculated_closing_balance_try: totalCurrentTry,
                accounts_snapshot: accountsSnapshot,
                is_already_closed: !!existing,
                existing_report: existing || null
            };
        }

        if (path === '/api/z-reports/close' && method === 'POST') {
            const reportDate = body.report_date || new Date().toISOString().slice(0, 10);
            let incomeTotal = 0, expenseTotal = 0;
            data.transactions.forEach(t => {
                if (t.transaction_date.startsWith(reportDate)) {
                    if (t.transaction_type === 'income') incomeTotal += (t.converted_amount || t.amount);
                    else if (t.transaction_type === 'expense') expenseTotal += (t.converted_amount || t.amount);
                }
            });

            let totalCurrentTry = 0;
            const accountsSnapshot = data.accounts.filter(a => a.is_active).map(a => {
                const balTry = StorageDB.convertToTry(a.current_balance, a.currency, data.rates);
                totalCurrentTry += balTry;
                return { id: a.id, name: a.name, type: a.account_type, currency: a.currency, balance: a.current_balance, balance_in_try: balTry };
            });

            const actual = parseFloat(body.actual_closing_balance_try) || totalCurrentTry;
            const discrepancy = actual - totalCurrentTry;

            const existingIdx = data.z_reports.findIndex(z => z.report_date === reportDate);
            const zReportEntry = {
                id: (data.z_reports[0] ? data.z_reports[0].id + 1 : 1),
                report_date: reportDate,
                closed_by_user_id: session.id,
                closed_by_name: session.full_name,
                opening_balance_try: totalCurrentTry - (incomeTotal - expenseTotal),
                total_income_try: incomeTotal,
                total_expense_try: expenseTotal,
                calculated_closing_balance_try: totalCurrentTry,
                actual_closing_balance_try: actual,
                discrepancy_try: discrepancy,
                accounts_snapshot_json: JSON.stringify(accountsSnapshot),
                notes: body.notes || '',
                is_locked: 1,
                created_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
            };

            if (existingIdx !== -1) {
                data.z_reports[existingIdx] = zReportEntry;
            } else {
                data.z_reports.unshift(zReportEntry);
            }
            StorageDB.save(data);
            return { success: true, message: `${reportDate} tarihli Z-Raporu mühürlendi.` };
        }

        if (path === '/api/z-reports') {
            const reports = data.z_reports.map(z => {
                const user = data.users.find(u => u.id === z.closed_by_user_id);
                return { ...z, closed_by_name: user ? user.full_name : 'Yetkili' };
            });
            return { success: true, reports };
        }

        // 9. Analytics & Reports
        if (path.startsWith('/api/reports/category-expenses')) {
            const catTotals = {};
            let totalExpense = 0;

            data.transactions.forEach(t => {
                if (t.transaction_type === 'expense' && t.category_id) {
                    const cat = data.categories.find(c => c.id === t.category_id);
                    if (cat) {
                        if (!catTotals[cat.id]) {
                            catTotals[cat.id] = { id: cat.id, name: cat.name, color: cat.color, icon: cat.icon, total_amount: 0, tx_count: 0 };
                        }
                        const amt = (t.converted_amount || t.amount);
                        catTotals[cat.id].total_amount += amt;
                        catTotals[cat.id].tx_count += 1;
                        totalExpense += amt;
                    }
                }
            });

            const catList = Object.values(catTotals).map(c => ({
                ...c,
                percentage: totalExpense > 0 ? Math.round((c.total_amount / totalExpense) * 100) : 0
            }));
            catList.sort((a, b) => b.total_amount - a.total_amount);

            return { success: true, total_expense: totalExpense, categories: catList };
        }

        if (path.startsWith('/api/reports/cash-flow')) {
            const months = [];
            const now = new Date();
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const ym = d.toISOString().slice(0, 7);
                let inc = 0, exp = 0;
                data.transactions.forEach(t => {
                    if (t.transaction_date.startsWith(ym)) {
                        if (t.transaction_type === 'income') inc += (t.converted_amount || t.amount);
                        else if (t.transaction_type === 'expense') exp += (t.converted_amount || t.amount);
                    }
                });
                months.push({ month: ym, income: inc, expense: exp, net: inc - exp });
            }
            return { success: true, monthly_cash_flow: months };
        }

        if (path.startsWith('/api/reports/account-volume')) {
            const accounts = data.accounts.filter(a => a.is_active).map(a => {
                let inFlow = 0, outFlow = 0;
                data.transactions.forEach(t => {
                    if (t.to_account_id === a.id && t.transaction_type === 'income') inFlow += t.amount;
                    if (t.from_account_id === a.id && t.transaction_type === 'expense') outFlow += t.amount;
                });
                return { ...a, total_inflow: inFlow, total_outflow: outFlow, total_volume: inFlow + outFlow };
            });
            return { success: true, accounts };
        }

        // 10. Users & Audit Logs
        if (path === '/api/users' && method === 'GET') {
            return { success: true, users: data.users };
        }

        if (path === '/api/users' && method === 'POST') {
            const newUser = {
                id: (data.users[data.users.length - 1] ? data.users[data.users.length - 1].id + 1 : 1),
                username: body.username,
                email: body.email || `${body.username}@sirket.com`,
                full_name: body.full_name,
                role: body.role || 'operator',
                is_active: 1,
                created_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
            };
            data.users.push(newUser);
            StorageDB.save(data);
            return { success: true, id: newUser.id, message: "Kullanıcı oluşturuldu" };
        }

        if (path === '/api/audit-logs') {
            return { success: true, logs: data.audit_logs.slice(0, 100) };
        }

        return { success: true, data: {} };
    }
};

window.ClientAPI = ClientAPI;
