# DailyCap

DailyCap, kişisel ve Multinet bütçelerini ayrı ayrı yöneten mobil öncelikli bir günlük bütçe PWA'sıdır. Günlük harcama hakkını, devreden bakiyeyi ve aylık gidişatı cihaz üzerinde hesaplar; çevrimdışı çalışır.

## Yerel geliştirme

Node.js sürümü `.nvmrc`, pnpm sürümü `package.json` içinde sabitlenmiştir.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

## Kontroller

```bash
pnpm test
pnpm typecheck
pnpm build
```

Production çıktısı `dist/` dizinine oluşturulur. Vite, manifest ve tüm PWA adresleri GitHub Pages için `/budget00/` taban yolunu kullanır.

## Deployment

`.github/workflows/deploy-pages.yml`, `main` dalına yapılan push sonrasında bağımlılık kurulumunu, testleri, strict TypeScript kontrolünü ve production build'i çalıştırır. Başarılı çıktı GitHub Pages'a yayınlanır.

Beklenen adres: `https://sein456.github.io/budget00/`

## iPhone'a kurulum

1. Production adresini iPhone'da Safari ile aç.
2. Paylaş düğmesine dokun.
3. **Ana Ekrana Ekle** seçeneğini seç.
4. **Ekle** ile onayla.

Uygulama ana ekrandan standalone modda açılır ve daha önce yüklenen uygulama kabuğuyla çevrimdışı kullanılabilir.

## Veriler ve yedekleme

Bütçe planları, işlemler ve ayarlar sunucuya gönderilmez; cihazın IndexedDB alanında saklanır. Tarayıcı/site verileri silinirse bu kayıtlar kaybolabileceği için Ayarlar bölümündeki JSON dışa aktarma özelliğiyle düzenli yedek almak önemlidir. JSON içe aktarma mevcut verinin üzerine yazmadan önce doğrulama ve kullanıcı onayı uygular.
