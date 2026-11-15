# Minecraft World — Telegram Mini App va mod yuborish

Sayt: https://minecraftworlduz.github.io/Web/
Supabase Edge Function: https://ruovdgyfcucspffrvijh.supabase.co/functions/v1/telegram-mod

## 1. Telegram botni yaratish

1. Telegramda rasmiy [@BotFather](https://t.me/BotFather) botini oching.
2. `/newbot` yuboring. Nom sifatida **Minecraft World**, username uchun mavjud bo‘lgan va `bot` bilan tugaydigan nom tanlang.
3. BotFather sizga bot **TOKEN** beradi. Bu parolga teng. Uni hech kimga yubormang, GitHub’ga yozmang, saytning HTML/JS kodiga qo‘ymang.

## 2. Tokenni Supabase Secrets ga kiritish (asosiy yakuniy qadam)

- Supabase Dashboard → MinecraftWorldUz → Edge Functions → Secrets.
- Key: `TELEGRAM_BOT_TOKEN`
- Value: BotFather bergan token.
- Save bosing. Function kodida boshqa narsa almashtirish kerak emas.

## 3. Telegramdagi 🌐 Minecraft World tugmasi

BotFatherga `/setmenubutton` yuboring va yangi botni tanlang.
- URL: `https://minecraftworlduz.github.io/Web/`
- Button text: `🌐 Minecraft World`

BotFather interfeysida mavjud bo‘lsa, Main Mini App ham shu HTTPS URL bilan sozlanadi.
Yangi botning shaxsiy chatida `/start` bosing va menu tugmasidan saytni oching.

## 4. Ishlash tartibi

- Telegram bot menyusidan Mini App ochiladi.
- Modni bosib **Telegramga yuborish** tanlanadi.
- Supabase Edge Function Telegram WebApp initData HMAC imzosini maxfiy bot tokeni bilan tekshiradi.
- Faqat `approved` mod fayli Supabase Storage’dan olinadi.
- Bot faylni `sendDocument` orqali aynan shu Telegram foydalanuvchisining shaxsiy chatiga yuboradi.
- Yuborishdan keyin mod yuklab olishlar hisoblagichi yangilanadi.
- Telegramdan tashqarida saytning odatiy download tugmasi o‘z holicha qoladi.

## Cheklovlar va xavfsizlik

- Bot avval foydalanuvchi tomonidan ishga tushirilishi kerak (`/start`).
- Telegram Bot API fayllarni multipart bilan odatda 50 MB gacha yuboradi; loyihadagi cheklov 49 MB.
- Server funksiyasi 1 foydalanuvchiga 1 daqiqada 3 ta yuborishni cheklaydi.
- Telegram initData 12 soatdan eski bo‘lsa yangidan Mini App ochish kerak.
- Token faqat server secrets ichida turadi. `verify_jwt=false` funksiyada Telegram imzo tekshiruvi bilan himoyalangan.
- Test uchun: BotFather tokeni kiritilgach bot chatida `/start`, menu, Visible Trades → Telegramga yuborish.

**Muhim:** Token kiritilmaguncha modul tayyor, lekin Telegram fayl yuborishi ishlamaydi.
