/**
 * RBAC User Management & Audit Log (Denetim İzi) Module
 */

const UsersView = {
    users: [],
    logs: [],

    async render() {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="flex items-center justify-center min-h-[400px]">
                <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
            </div>
        `;

        const res = await App.api('/api/users');
        if (!res || !res.success) {
            container.innerHTML = `<div class="p-8 text-center text-red-400">Kullanıcı listesi yüklenemedi veya bu ekrana erişim yetkiniz yok.</div>`;
            return;
        }

        this.users = res.users || [];

        const roleBadges = {
            admin: { name: "Yönetici (Admin)", color: "bg-red-500/10 text-red-400 border-red-500/20" },
            manager: { name: "Finans Müdürü", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
            operator: { name: "Kasa Sorumlusu", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
            viewer: { name: "Denetçi / İzleyici", color: "bg-slate-500/10 text-slate-400 border-slate-500/20" }
        };

        container.innerHTML = `
            <!-- Top Header & Actions -->
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                    <h1 class="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                        <i data-lucide="shield-check" class="w-6 h-6 text-red-400"></i>
                        <span>Kullanıcı & Rol Yönetimi (RBAC)</span>
                    </h1>
                    <p class="text-sm text-gray-400 mt-1">Sisteme erişebilen personeller, yetki seviyeleri ve oturum güvenliği.</p>
                </div>
                <div class="flex items-center space-x-3">
                    <button onclick="UsersView.openUserModal()" class="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-900/30 transition-all active:scale-95">
                        <i data-lucide="user-plus" class="w-4 h-4"></i>
                        <span>+ Yeni Kullanıcı Tanımla</span>
                    </button>
                </div>
            </div>

            <!-- Role Hierarchy Card -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div class="p-4 rounded-xl bg-gray-900/60 border border-gray-800">
                    <div class="text-xs font-bold text-red-400 uppercase">Yönetici (Admin)</div>
                    <p class="text-xs text-gray-400 mt-1">Tüm kasaları yönetir, kullanıcı ekler/siler, sistem ayarlarını ve logları inceler.</p>
                </div>
                <div class="p-4 rounded-xl bg-gray-900/60 border border-gray-800">
                    <div class="text-xs font-bold text-purple-400 uppercase">Finans Müdürü (Manager)</div>
                    <p class="text-xs text-gray-400 mt-1">Kasa oluşturur, virman yapar, gelir/gider girer, Z-Raporu kapatır.</p>
                </div>
                <div class="p-4 rounded-xl bg-gray-900/60 border border-gray-800">
                    <div class="text-xs font-bold text-blue-400 uppercase">Kasa Sorumlusu (Operator)</div>
                    <p class="text-xs text-gray-400 mt-1">Sadece yetkili olduğu kasadan günlük hızlı para girişi ve çıkışı yapar.</p>
                </div>
                <div class="p-4 rounded-xl bg-gray-900/60 border border-gray-800">
                    <div class="text-xs font-bold text-slate-400 uppercase">Denetçi (Viewer)</div>
                    <p class="text-xs text-gray-400 mt-1">Sadece raporları, geçmiş hareketleri ve logları okur. Değişiklik yapamaz.</p>
                </div>
            </div>

            <!-- Users Table Card -->
            <div class="glass-card overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr class="bg-gray-900/80 border-b border-gray-800 text-xs uppercase text-gray-400 tracking-wider">
                                <th class="py-3.5 px-4 font-semibold">Ad Soyad</th>
                                <th class="py-3.5 px-4 font-semibold">Kullanıcı Adı</th>
                                <th class="py-3.5 px-4 font-semibold">E-Posta</th>
                                <th class="py-3.5 px-4 font-semibold">Rol</th>
                                <th class="py-3.5 px-4 font-semibold">Durum</th>
                                <th class="py-3.5 px-4 font-semibold">Kayıt Tarihi</th>
                                <th class="py-3.5 px-4 font-semibold text-center">İşlem</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-800/50">
                            ${this.users.map(u => {
                                const badge = roleBadges[u.role] || roleBadges.viewer;
                                return `
                                    <tr class="hover:bg-gray-800/30 transition-colors">
                                        <td class="py-3.5 px-4 font-semibold text-white">${u.full_name}</td>
                                        <td class="py-3.5 px-4 text-xs font-mono text-gray-300">@${u.username}</td>
                                        <td class="py-3.5 px-4 text-xs text-gray-400">${u.email}</td>
                                        <td class="py-3.5 px-4">
                                            <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.color}">
                                                ${badge.name}
                                            </span>
                                        </td>
                                        <td class="py-3.5 px-4">
                                            ${u.is_active ? `
                                                <span class="inline-flex items-center space-x-1 text-emerald-400 text-xs font-medium">
                                                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                                    <span>Aktif</span>
                                                </span>
                                            ` : `
                                                <span class="inline-flex items-center space-x-1 text-gray-500 text-xs font-medium">
                                                    <span class="w-1.5 h-1.5 rounded-full bg-gray-500"></span>
                                                    <span>Pasif</span>
                                                </span>
                                            `}
                                        </td>
                                        <td class="py-3.5 px-4 text-xs text-gray-400">${App.formatDate(u.created_at)}</td>
                                        <td class="py-3.5 px-4 text-center">
                                            <button onclick="UsersView.openEditUserModal(${u.id})" class="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors" title="Kullanıcıyı Düzenle">
                                                <i data-lucide="edit-3" class="w-4 h-4"></i>
                                            </button>
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
    },

    // Audit Logs View (Değiştirilemez Denetim İzi)
    async renderAuditLogs() {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="flex items-center justify-center min-h-[400px]">
                <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
            </div>
        `;

        const res = await App.api('/api/audit-logs?limit=100');
        if (!res || !res.success) {
            container.innerHTML = `<div class="p-8 text-center text-red-400">Denetim logları yüklenemedi.</div>`;
            return;
        }

        this.logs = res.logs || [];

        container.innerHTML = `
            <!-- Top Header -->
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                    <h1 class="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                        <i data-lucide="fingerprint" class="w-6 h-6 text-blue-400"></i>
                        <span>Güvenlik & Denetim İzi (Audit Log)</span>
                    </h1>
                    <p class="text-sm text-gray-400 mt-1">Kim, ne zaman, hangi kasadan hangi işlemi yaptı? Değiştirilemez sistem kayıtları.</p>
                </div>
            </div>

            <!-- Audit Logs Table -->
            <div class="glass-card overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr class="bg-gray-900/80 border-b border-gray-800 text-gray-400 uppercase">
                                <th class="py-3 px-4 font-semibold">Tarih / Saat</th>
                                <th class="py-3 px-4 font-semibold">Kullanıcı</th>
                                <th class="py-3 px-4 font-semibold">Eylem</th>
                                <th class="py-3 px-4 font-semibold">Varlık Türü</th>
                                <th class="py-3 px-4 font-semibold">Detaylar</th>
                                <th class="py-3 px-4 font-semibold">IP Adresi</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-800/50 font-mono">
                            ${this.logs.map(log => `
                                <tr class="hover:bg-gray-800/30">
                                    <td class="py-2.5 px-4 text-gray-400 whitespace-nowrap">${App.formatDate(log.created_at, true)}</td>
                                    <td class="py-2.5 px-4 font-bold text-blue-400 font-sans">@${log.username}</td>
                                    <td class="py-2.5 px-4 font-semibold text-white">
                                        <span class="px-2 py-0.5 rounded bg-gray-800 text-amber-300 border border-gray-700">${log.action}</span>
                                    </td>
                                    <td class="py-2.5 px-4 text-gray-300">${log.entity_type} (#${log.entity_id || '-'})</td>
                                    <td class="py-2.5 px-4 text-gray-400 font-mono max-w-md truncate" title="${log.details || ''}">${log.details || '-'}</td>
                                    <td class="py-2.5 px-4 text-gray-500">${log.ip_address}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        if (window.lucide) lucide.createIcons();
    },

    openUserModal() {
        document.getElementById('user-modal-title').textContent = 'Yeni Kullanıcı Oluştur';
        document.getElementById('user-id').value = '';
        document.getElementById('user-username').value = '';
        document.getElementById('user-username').disabled = false;
        document.getElementById('user-fullname').value = '';
        document.getElementById('user-email').value = '';
        document.getElementById('user-password').value = '';
        document.getElementById('user-password').placeholder = 'Güçlü parola girin';
        document.getElementById('user-role').value = 'operator';
        document.getElementById('user-status-group').classList.add('hidden');

        App.openModal('user-modal');
    },

    openEditUserModal(userId) {
        const u = this.users.find(x => x.id === userId);
        if (!u) return;

        document.getElementById('user-modal-title').textContent = 'Kullanıcıyı Düzenle';
        document.getElementById('user-id').value = u.id;
        document.getElementById('user-username').value = u.username;
        document.getElementById('user-username').disabled = true;
        document.getElementById('user-fullname').value = u.full_name;
        document.getElementById('user-email').value = u.email;
        document.getElementById('user-password').value = '';
        document.getElementById('user-password').placeholder = 'Değiştirmek istemiyorsanız boş bırakın';
        document.getElementById('user-role').value = u.role;
        document.getElementById('user-active').checked = !!u.is_active;
        document.getElementById('user-status-group').classList.remove('hidden');

        App.openModal('user-modal');
    },

    async saveUser(e) {
        e.preventDefault();
        const id = document.getElementById('user-id').value;
        const username = document.getElementById('user-username').value;
        const full_name = document.getElementById('user-fullname').value;
        const email = document.getElementById('user-email').value;
        const password = document.getElementById('user-password').value;
        const role = document.getElementById('user-role').value;
        const is_active = document.getElementById('user-active').checked ? 1 : 0;

        if (id) {
            // Update
            const payload = { full_name, role, is_active };
            if (password) payload.password = password;

            const res = await App.api(`/api/users/${id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            if (res && res.success) {
                App.toast("Kullanıcı güncellendi", "success");
                App.closeModal('user-modal');
                this.render();
            }
        } else {
            // Create
            if (!username || !password || !full_name) {
                App.toast("Lütfen tüm alanları doldurun", "warning");
                return;
            }
            const res = await App.api('/api/users', {
                method: 'POST',
                body: JSON.stringify({ username, email, full_name, password, role })
            });
            if (res && res.success) {
                App.toast("Yeni kullanıcı oluşturuldu", "success");
                App.closeModal('user-modal');
                this.render();
            }
        }
    }
};

window.UsersView = UsersView;
