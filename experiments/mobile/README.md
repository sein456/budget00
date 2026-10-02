# DailyCap Deneme — ayrı telefon uygulaması

Adres: https://sein456.github.io/budget00/deneme/

Grafik, kategori sıralama, hızlı tekrar, günlük hak açıklaması ve simüle tarih kontrolleri.
Ana uygulamanın ekranları değiştirilmez. Ayrı manifest kimliği, başlangıç adresi, service worker kapsamı ve `budget00-experimental` veritabanı kullanılır.
Deneme bütçeleri kişisel 30.000 TL, Multinet 6.000 TL. Kayıtlar yalnızca kullanıldığı cihazda tutulur; bilgisayardaki kayıtlar telefona otomatik taşınmaz.

Ana üretim build'inden sonra bu alt uygulama `dist/deneme` içine build edilir. Bağımlılıklar üst projenin lockfile'ından gelir.

iPhone: Safari'de aç, Paylaş → Ana Ekrana Ekle. İsim: DC Deneme. Ana uygulamayı silme.
Eski ana uygulama çevrimdışı sürümü deneme adresini ana sayfaya yönlendirirse, ana uygulamada Güncelle'ye basıp deneme bağlantısını yeniden aç.
