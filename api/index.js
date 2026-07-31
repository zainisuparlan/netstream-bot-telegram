import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN || '8874951978:AAH7SoMNHC0g06vZemNdLmH9D7ILg1fVEYs';
const ADMIN_ID  = process.env.ADMIN_ID  || '5036719692';
const QRIS_URL  = 'https://raw.githubusercontent.com/zainisuparlan/netstream-bot-telegram/main/photo_2026-07-30_18-24-48.jpg';

const bot = new Telegraf(BOT_TOKEN);

// ─── Helpers ───────────────────────────────────────────────────────────────
function calculatePrice(n) {
  if (n === 1) return 50000;
  if (n === 2) return 100000;
  return 100000 + (n - 2) * 25000;
}

function rupiah(n) {
  return new Intl.NumberFormat('id-ID').format(n);
}

function extractSchool(text) {
  if (!text) return null;
  // Cari "Sekolah: <nama>" di teks pesan (dengan atau tanpa *)
  const m = text.match(/Sekolah:\s*\*?(.+?)(?:\*|\n|$)/i);
  return m ? m[1].trim() : null;
}

// ─── Keyboard ──────────────────────────────────────────────────────────────
const keyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('1️⃣ 1 Perangkat', 'dev_1'),
    Markup.button.callback('2️⃣ 2 Perangkat', 'dev_2'),
  ],
  [
    Markup.button.callback('3️⃣ 3 Perangkat', 'dev_3'),
    Markup.button.callback('4️⃣ 4 Perangkat', 'dev_4'),
  ],
  [
    Markup.button.callback('5️⃣ 5 Perangkat', 'dev_5'),
    Markup.button.callback('🔢 Lainnya', 'dev_other'),
  ],
]);

// ─── Step 1: Sambutan + Minta Nama Sekolah ─────────────────────────────────
async function welcome(ctx) {
  const first = ctx.from?.first_name || 'Bapak/Ibu';
  await ctx.reply(
    `Halo *${first}*! Selamat datang di *Mitra Mandiri Wadah Guru* 🎓\n\n` +
    `📝 Ketikkan *nama lengkap sekolah* Anda:`,
    {
      parse_mode: 'Markdown',
      reply_markup: { force_reply: true, input_field_placeholder: 'Contoh: SDN 01 Maju Bersama' }
    }
  );
}

// ─── Step 2: Sekolah tercatat, tampilkan tombol perangkat ─────────────────
async function showDevices(ctx, school) {
  await ctx.reply(
    `✅ Sekolah: *${school}*\n\n` +
    `Pilih jumlah perangkat yang ingin didaftarkan:`,
    { parse_mode: 'Markdown', ...keyboard }
  );
}

// ─── Step 3: Kirim QRIS + Notif Admin ────────────────────────────────────
async function sendQRIS(ctx, n, school) {
  const price = calculatePrice(n);
  const harga = rupiah(price);
  const uid = ctx.from?.id || '?';
  const nama = `${ctx.from?.first_name || ''} ${ctx.from?.last_name || ''}`.trim() || '–';
  const user = ctx.from?.username ? `@${ctx.from.username}` : '_(tanpa username)_';

  const caption =
    `📌 *RINCIAN MITRA MANDIRI WADAH GURU*\n` +
    `🏫 Sekolah  : *${school}*\n` +
    `📱 Perangkat: *${n} unit*\n` +
    `💰 Tagihan  : *Rp ${harga}/bulan*\n\n` +
    `💳 *BAYAR VIA QRIS di atas*\n\n` +
    `📩 *Setelah transfer, kirim bukti ke Admin:*\n` +
    `➡️ https://t.me/netstream_cloud ⬅️\n\n` +
    `⚠️ Kirim bukti ke link atas, BUKAN di sini!`;

  try {
    await ctx.replyWithPhoto(QRIS_URL, { caption, parse_mode: 'Markdown' });
  } catch {
    await ctx.reply(caption, { parse_mode: 'Markdown' });
  }

  // Notif ke admin
  try {
    await bot.telegram.sendMessage(ADMIN_ID,
      `🛒 *PESANAN MASUK!*\n` +
      `🏫 Sekolah : *${school}*\n` +
      `👤 Nama    : *${nama}*\n` +
      `🏷 User    : ${user}\n` +
      `🆔 ID TG   : \`${uid}\`\n` +
      `📱 Unit    : *${n} Perangkat*\n` +
      `💰 Tagihan : *Rp ${harga}/bulan*\n\n` +
      `⏳ Menunggu bukti dari pelanggan via t.me/netstream_cloud`,
      { parse_mode: 'Markdown' }
    );
  } catch { /* silent */ }
}

// ─── /start ────────────────────────────────────────────────────────────────
bot.command('start', welcome);

// ─── Teks masuk ────────────────────────────────────────────────────────────
bot.on('text', async (ctx) => {
  const txt = ctx.message.text.trim();
  const replyTo = ctx.message.reply_to_message?.text || '';

  // Pemicu dari link aplikasi Wadah Guru
  if (
    txt.toLowerCase().includes('wadah guru') ||
    txt.toLowerCase().includes('mitra mandiri') ||
    txt.toLowerCase().includes('sponsorship') ||
    txt.toLowerCase().includes('alokasi kuota')
  ) {
    return welcome(ctx);
  }

  // Jawaban nama sekolah (reply ke force_reply "nama lengkap sekolah")
  if (replyTo.includes('nama lengkap sekolah') || replyTo.includes('nama sekolah')) {
    if (txt.length < 3) {
      return ctx.reply('Nama sekolah terlalu pendek, ketik nama lengkapnya.', {
        reply_markup: { force_reply: true }
      });
    }
    return showDevices(ctx, txt);
  }

  // Jawaban angka custom (reply ke force_reply "Lainnya")
  if (replyTo.includes('Masukkan jumlah perangkat')) {
    const school = extractSchool(replyTo) || '–';
    const n = parseInt(txt, 10);
    if (isNaN(n) || n <= 0 || n > 999) {
      return ctx.reply('Masukkan angka yang valid (1-999).', { reply_markup: { force_reply: true } });
    }
    return sendQRIS(ctx, n, school);
  }

  // Input angka langsung
  if (/^\d+$/.test(txt)) {
    const n = parseInt(txt, 10);
    if (n > 0 && n <= 999) {
      return sendQRIS(ctx, n, '–');
    }
  }
});

// ─── Callback Query (tombol inline keyboard) ───────────────────────────────
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery?.data || '';
  const msgText = ctx.callbackQuery?.message?.text || '';
  const school = extractSchool(msgText) || '–';

  await ctx.answerCbQuery().catch(() => {});

  if (!data.startsWith('dev_')) return;

  const choice = data.replace('dev_', '');

  if (choice === 'other') {
    await ctx.reply(
      `Sekolah: *${school}*\n\nMasukkan jumlah perangkat yang Anda inginkan:`,
      {
        parse_mode: 'Markdown',
        reply_markup: { force_reply: true, input_field_placeholder: 'Contoh: 10' }
      }
    );
    return;
  }

  const n = parseInt(choice, 10);
  if (n > 0) {
    await sendQRIS(ctx, n, school);
  }
});

// ─── Foto dikirim ke bot (salah tujuan) ─────────────────────────────────
bot.on(['photo', 'document'], async (ctx) => {
  await ctx.reply(
    `⚠️ *Bukti transfer dikirim ke tempat yang salah!*\n\n` +
    `Mohon kirim langsung ke Admin:\n` +
    `➡️ https://t.me/netstream_cloud ⬅️`,
    { parse_mode: 'Markdown' }
  );
});

// ─── Vercel Handler ────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const host  = req.headers['host']              || 'localhost';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const base  = `${proto}://${host}`;

  if (req.method === 'GET') {
    const wh = `${base}/api/index`;
    try { await bot.telegram.setWebhook(wh); } catch(e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
    return res.status(200).send(`<!DOCTYPE html><html lang="id">
<head><meta charset="UTF-8"><title>Bot Wadah Guru</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:sans-serif;background:#0f172a;color:#f8fafc;display:flex;min-height:100vh;align-items:center;justify-content:center}
.c{background:#1e293b;padding:32px;border-radius:16px;text-align:center;max-width:440px;width:90%}
h2{color:#38bdf8;margin-bottom:8px}.b{background:#059669;color:#fff;padding:6px 16px;border-radius:20px;display:inline-block;margin:12px 0;font-weight:700}
code{background:#0f172a;color:#34d399;padding:8px 12px;border-radius:8px;font-size:12px;word-break:break-all;display:block;margin-top:8px}
</style></head>
<body><div class="c"><div style="font-size:48px">🤖⚡</div>
<h2>Bot Telegram Wadah Guru</h2>
<p style="color:#94a3b8">Mitra Mandiri Auto-Responder</p>
<div class="b">✅ Aktif 24 Jam</div>
<hr style="border-color:#334155;margin:16px 0">
<p style="color:#94a3b8;font-size:14px">Webhook aktif:</p>
<code>${wh}</code></div></body></html>`);
  }

  if (req.method === 'POST') {
    try {
      await bot.handleUpdate(req.body, res);
    } catch (err) {
      console.error(err.message);
      if (!res.headersSent) res.status(200).json({ ok: true });
    }
    return;
  }

  res.status(200).send('OK');
}
