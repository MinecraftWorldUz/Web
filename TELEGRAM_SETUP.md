# Minecraft World — Telegram Mini App (ulangan)

Bot: [@Minecraft_World_Robot](https://t.me/Minecraft_World_Robot)

Mini App: https://minecraftworlduz.github.io/Web/

Edge Function: https://ruovdgyfcucspffrvijh.supabase.co/functions/v1/telegram-mod

## Hozirgi holat

- Telegram Bot API `getMe` botni tasdiqladi.
- `setChatMenuButton` orqali butun bot uchun `🌐 Minecraft World` Web App menyu tugmasi o‘rnatildi.
- `getChatMenuButton` javobi **web_app** turini, matnni va yuqoridagi HTTPS manzilni qaytardi.
- Bot kaliti GitHub yoki brauzer kodida emas, Supabase Postgres Vault ichida shifrlangan; xizmat uni `telegram_bot_token_for_service` RPC orqali oladi. RPC faqat `service_role` uchun ochiq.
- `telegram-mod` Edge Function v2: Telegram imzosini tekshiradi, tasdiqlangan modni private Storage’dan oladi va `sendDocument` orqali yuboradi.
- Oddiy brauzerda saytning eski yuklab olish imkoniyati saqlangan.
- Noto‘g‘ri Telegram initData bilan endpoint sinovdan o‘tdi: server **401** qaytardi.
- Real faylning shaxsiy Telegram chatiga yetkazilishini foydalanuvchi botni ishga tushirgach sinash kerak.

## Foydalanish

1. [Botni oching](https://t.me/Minecraft_World_Robot).
2. Telegram shaxsiy chatida **Start** yoki `/start` bosing.
3. **🌐 Minecraft World** menyu tugmasidan Mini App’ni oching.
4. Tasdiqlangan modni tanlang, **Telegramga yuborish** tugmasini bosing.
5. Bot faylni shu chatga hujjat sifatida yuboradi. Agar birinchi urinishda bo‘lmasa, botga /start bosilganini va Telegram ichidan Mini App ochilganini tekshiring.

## Xavfsizlik va cheklovlar

- Faqat Telegram imzosidan o‘tgan foydalanuvchi o‘z chatiga mod yubora oladi.
- Bir Telegram foydalanuvchisi uchun: 1 daqiqada ko‘pi bilan 3 ta yuborish.
- File size chegarasi: 49 MB.
- Faqat `approved` statusli modlarga ruxsat.
- `Telegram WebApp.initData` eskirgan bo‘lsa (12 soatdan katta), Mini App’ni bot menyusidan qayta ochish kerak.
- Frontendda bot tokeni ham, Supabase server kaliti ham yo‘q.
