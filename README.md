# 💼 Kasa & Finans Takip Sistemi (Modern Cash Flow & Vault Management)

Geleneksel ve hantal muhasebe programlarının karmaşık arayüzlerinden sıyrılmış, tamamen **günlük operasyonel nakit akışına, çoklu kasa yönetimine (Banka IBAN, Nakit, Kripto) ve hızlı finansal takibe** odaklanan yeni nesil finans yönetim platformu.

---

## 🌟 Öne Çıkan Özellikler

### 1. 🏦 Çoklu Kasa & Varlık Havuzu (Multi-Currency Vaults)
- **Banka Hesapları:** Garanti BBVA, İş Bankası vb. IBAN ve banka adı takibi.
- **Elden Nakit Kasalar:** Ofis çelik kasaları, seyahat ve acil durum nakitleri (TRY, USD, EUR).
- **Kripto Cüzdanları:** USDT, BTC, ETH cüzdanları ve anlık kur üzerinden konsolide varlık değeri hesabı.
- **Kasalar Arası Transfer (Virman):** Otomatik kur çevrimi, kur farkı/komisyon desteği ve atomik çift taraflı bakiye güncellemesi.

### 2. ⚡ Hızlı Gelir / Gider Girişi ve Fiş/Fatura Yükleme
- Tek ekrandan saniyeler içinde **Para Girişi (+)** veya **Ödeme Çıkışı (-)** kaydı.
- Kategori bazlı sınıflandırma (Sunucu Masrafı, Müşteri Ödemesi, Reklam, Maaş vb.).
- Yapılan ödemelere ait **fatura/dekont/fiş görseli veya PDF** yükleme ve modal içinde tam boy görüntüleme.
- Tek tıkla **CSV / Excel formatında dışa aktarma**.

### 3. 🛡️ Rol Tabanlı Yetkilendirme (RBAC) & Güvenlik
- **Yönetici (Admin):** Tam yetki, kullanıcı ekleme/düzenleme, sistem logları, kasa silme.
- **Finans Müdürü (Manager):** Kasa oluşturma, virman, gelir/gider ekleme, Z-Raporu kapatma, abonelik yönetimi.
- **Kasa Operatörü (Operator):** Sadece yetkili olduğu kasadan günlük hızlı para girişi ve çıkışı.
- **Denetçi / İzleyici (Viewer):** Yalnızca raporları, hareketleri ve denetim loglarını okuma (değişiklik yapamaz).

### 4. 📋 Gün Sonu Kapanış & Z-Raporu (Mutabakat)
- Seçilen günün açılış bakiyesi, gün içi giren/çıkan para ve hesaplanan kapanış bakiyesi.
- **Fiziksel Kasa Sayımı:** Fiziki sayılan tutar girildiğinde kasa açığı veya kasa fazlasını anında otomatik tespit etme.
- Raporu kilitleme/mühürleme ve **PDF / Yazıcı çıktısı** formatı.

### 5. 🔁 Abonelikler ve Düzenli Gider Takibi
- AWS, OpenAI, Hetzner, Figma, Ofis Kirası gibi periyodik masraflar.
- Kalan gün geri sayım rozetleri (`Kritik: 2 gün kaldı`, `Vadesi Geçti`, `Gelecek Hafta`).
- **"Tek Tıkla Öde"** butonu: İlgili kasadan gideri anında düşer, son ödeme tarihini kaydeder ve bir sonraki vadeyi otomatik ileri tarihe atar.

### 6. 📈 Detaylı Raporlar & Nakit Akışı Grafikleri
- **Gider Kategorileri Dağılımı:** İnteraktif Doughnut Chart ve harcama yüzdeleri.
- **6 Aylık Kar / Zarar Tablosu:** Gelir vs Gider aylık net akış karşılaştırması.
- **Kasa Bazlı Hacim Raporu:** Hangi bankadan veya cüzdandan ne kadar para geçtiği.

### 7. 🔒 Değiştirilemez Denetim İzi (Audit Log)
- Kim, ne zaman, hangi IP adresinden, hangi kasada hangi işlemi yaptı?
- Tüm hareketler geriye dönük silinemez şekilde kayıt altına alınır.

---

## 🚀 Hızlı Başlangıç ve Kurulum

Sistem **Python 3 standart kütüphanesi** ve **SQLite WAL** mimarisi ile inşa edildiğinden harici paket kurulumuna ihtiyaç duymaz.

### 1. Uygulamayı Başlatma
```bash
python3 run.py
```
*(Farklı bir port için: `python3 run.py --port 9000`)*

### 2. Tarayıcıdan Giriş
Tarayıcınızda şu adrese gidin:
👉 **[http://localhost:8080](http://localhost:8080)**

---

## 🔑 Hazır Demo Giriş Hesapları

| Rol | Kullanıcı Adı | Şifre | Yetki Seviyesi |
| :--- | :--- | :--- | :--- |
| **👑 Yönetici (Admin)** | `admin` | `admin123` | Tam Yetki & Kullanıcı Yönetimi |
| **📊 Finans Müdürü** | `manager` | `manager123` | Kasa, Virman, Z-Raporu & Raporlar |
| **💼 Kasa Sorumlusu** | `operator` | `operator123` | Hızlı Gelir / Gider Girişi |
| **👁️ Denetçi / İzleyici** | `viewer` | `viewer123` | Salt Okunur Rapor & Log İnceleme |

*(Giriş ekranındaki hızlı butonlar ile tek tıkla istediğiniz rolle giriş yapabilirsiniz.)*

---

## 🏗️ Proje Mimarisi

```
Muhasebe/
├── app/
│   ├── __init__.py
│   ├── db.py               # SQLite Veritabanı, Foreign Keys, İndeksler ve Audit Log
│   ├── auth.py             # PBKDF2-HMAC-SHA256 Şifreleme & RBAC Yetkilendirme
│   ├── rates_service.py    # FX (USD/EUR) ve Kripto (USDT/BTC) Canlı Kur Motoru
│   ├── seed_data.py        # Hazır Demo Verileri (Bankalar, Nakit, Kripto, İşlemler)
│   ├── server.py           # REST API Sunucusu & SPA Yönlendirici
│   ├── static/
│   │   ├── css/
│   │   │   └── style.css   # Dark FinTech UI & Print CSS
│   │   ├── js/
│   │   │   ├── app.js          # Core SPA Router, Auth, Kurlar & Toast Sistemi
│   │   │   ├── dashboard.js    # Net Varlık Özeti, Nakit Akışı Grafiği
│   │   │   ├── accounts.js     # Kasa/Hesap Kartları & Virman Motoru
│   │   │   ├── transactions.js # Gelir/Gider Girişi & Fiş Önizleme
│   │   │   ├── zreports.js     # Z-Raporu ve Gün Sonu Kasa Mutabakatı
│   │   │   ├── subscriptions.js# Abonelikler & Tek Tıkla Ödeme
│   │   │   ├── reports.js      # Kategori Pasta Grafiği & Kar/Zarar
│   │   │   └── users.js        # RBAC Kullanıcı Yönetimi & Audit Log
│   │   └── index.html      # Modern SPA Ana Şablonu
│   └── uploads/            # Fiş / Dekont / Belge Deposu
├── data/
│   └── finance.db          # SQLite İlişkisel Veritabanı
├── run.py                  # Uygulama Başlatıcı
├── requirements.txt        # Bağımlılık Bilgisi (Zero-Dependency)
└── README.md
```
