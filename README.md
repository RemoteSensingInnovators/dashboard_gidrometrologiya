# Samarqand Dashboard

Bu loyiha Samarqand uchun yillik va oylik ifloslanish ko'rsatkichlarini vizuallashtirish uchun tayyorlangan statik web dashboarddir.

## Foydalanish

1. `c:\Users\USER\Downloads\laziz_bro_dashboard` papkasiga o'ting.
2. Agar brauzeringizda lokal `fetch` muammolari bo'lsa, quyidagi buyruq bilan oddiy serverni ishga tushiring:

```bash
python -m http.server 8000
```

3. Brauzeringizda `http://localhost:8000` manzilini oching.

## Fayllar

- `index.html` — dashboard sahifasi.
- `style.css` — dizayn va tartib.
- `dashboard.js` — xaritalar va diagrammalarni hosil qilish uchun JavaScript.
- `data/samarqand_data.json` — 2016–2025 yillar Excel ma'lumotlaridan generatsiyalangan JSON.
- `samarqand.json` — Samarqand uchun geometrik hudud geojson fayli.
- `build_data.py` — agar kelajakda Excel fayllarni yangilash kerak bo'lsa, JSON ma'lumotni qayta yaratish uchun skript.
