import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN || '8874951978:AAH7SoMNHC0g06vZemNdLmH9D7ILg1fVEYs';
const ADMIN_ID  = process.env.ADMIN_ID  || '5036719692';

// URL gambar QRIS dari GitHub (agar tersedia di Vercel)
const QRIS_URL = 'https://raw.githubusercontent.com/zainisuparlan/netstream-bot-telegram/main/photo_2026-07-30_18-24-48.jpg';

const bot = new Telegraf(BOT_TOKEN);

// ─── State per-user ────────────────────────────────────────────────────────
// step: 'IDLE' | 'WAITING_SCHOOL' | 'WAITING_DEVICES' | 'WAITING_PAYMENT'
const userStates = new Map();

function getState(uid) {
  return userStates.get(uid) || { step: 'IDLE' };
}
function setState(uid, data) {
  userStates.set(uid, { ...getState(uid), ...data });
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function calculatePrice(n) {
  if (n <= 0) return null;
  if (n === 1) return 50000;
  if (n === 2) return 100000;
  return 100000 + (n - 2) * 25000;
}

function rupiah(n) {
  return new Intl.NumberFormat('id-ID').format(n);
}

// ─── Keyboard Pilihan Perangkat ────────────────────────────────────────────
function deviceKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('1 Perangkat', 'dev_1'),
      Markup.button.callback('2 Perangkat', 'dev_2'),
      Markup.button.callback('3 Perangkat', 'dev_3'),
    ],
    [
      Markup.button.callback('4 Perangkat', 'dev_4'),
      Markup.button.callback('5 Perangkat', 'dev_5'),
    ],
    [Markup.button.callback('💬 Jumlah Lain? Ketik Angkanya', 'dev_custom')],
  ]);
}

// ─── Step 1: Minta Nama Sekolah ────────────────────────────────────────────
async function askSchoolName(ctx) {
  const name = ctx.from?.first_name || 'Bapak/Ibu';
  setState(ctx.from.id, { step: 'WAITING_SCHOOL', schoolName: null, devices: null });

  return ctx.reply(
    `Halo *${name}*! Selamat datang di layanan *Mitra Mandiri Wadah Guru* 🎓✨\n\n` +
    `Terima kasih atas ketertarikan Sekolah Anda untuk bergabung dalam program Sponsorship.\n\n` +
    `📝 *Mohon ketikkan nama lengkap sekolah Anda untuk memulai proses pendaftaran:*`,
    { parse_mode: 'Markdown' }
  );
}

// ─── Step 2: Simpan Nama Sekolah, Tampilkan Pilihan Perangkat ─────────────
async function askDeviceCount(ctx, schoolName) {
  setState(ctx.from.id, { step: 'WAITING_DEVICES', schoolName });

  return ctx.reply(
    `✅ Nama sekolah tercatat: *${schoolName}*\n\n` +
    `👉 *Berapa jumlah perangkat yang ingin didaftarkan?*\n` +
    `_(Pilih tombol di bawah atau ketik angkanya langsung)_`,
    { parse_mode: 'Markdown', ...deviceKeyboard() }
  );
}

// ─── Step 3: Proses Pilihan Perangkat + Kirim QRIS ────────────────────────
async function handleDevice(ctx, n) {
  const price = calculatePrice(n);
  if (!price) return ctx.reply('Masukkan angka perangkat yang valid (min. 1).');

  const harga = rupiah(price);
  const uid = ctx.from?.id;
  const state = getState(uid);
  const schoolName = state.schoolName || '–';

  setState(uid, { step: 'WAITING_PAYMENT', devices: n, price, harga });

  const caption =
    `📌 *RINCIAN PENDAFTARAN LISENSI MITRA MANDIRI*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🏫 Nama Sekolah     : *${schoolName}*\n` +
    `📱 Jumlah Perangkat : *${n} Perangkat*\n` +
    `💰 Total Bayar      : *Rp ${harga}* / bulan\n` +
    `_(Perpanjangan tetap sama seperti awal)_\n\n` +
    `💳 *CARA BAYAR VIA QRIS:*\n` +
    `1. Scan kode QRIS di atas dengan M-Banking / E-Wallet _(GoPay, OVO, DANA, ShopeePay, LinkAja, BCA, Mandiri, dll)_.\n` +
    `2. Pastikan nominal tepat *Rp ${harga}*.\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📩 *CARA KONFIRMASI SETELAH TRANSFER:*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Setelah transfer berhasil, segera kirimkan *foto/screenshot Bukti Transfer* langsung ke Admin kami:\n\n` +
    `👇 *KLIK LINK DI BAWAH INI* 👇\n` +
    `➡️ https://t.me/netstream_cloud ⬅️\n\n` +
    `⚠️ *PENTING:* Kirim bukti transfer ke link di atas, *bukan di chat ini*. Admin akan langsung memverifikasi dan mengaktifkan lisensi *${schoolName}*. Terima kasih! 🙏`;

  // Kirim QRIS ke pelanggan
  await ctx.replyWithPhoto(QRIS_URL, { caption, parse_mode: 'Markdown' });

  // Langsung kirim notifikasi pesanan ke Admin
  if (ADMIN_ID) {
    try {
      const customerName = `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim() || '–';
      const username = ctx.from.username ? `@${ctx.from.username}` : '_(Tanpa username)_';

      const adminNotice =
        `🛒 *PESANAN MASUK — MENUNGGU BUKTI TRANSFER!*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🏫 Sekolah   : *${schoolName}*\n` +
        `👤 Nama      : *${customerName}*\n` +
        `🏷 Username  : ${username}\n` +
        `🆔 ID TG     : \`${uid}\`\n` +
        `📱 Perangkat : *${n} Perangkat*\n` +
        `💰 Tagihan   : *Rp ${harga}* / bulan\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `⏳ Pelanggan sedang diarahkan untuk mengirim bukti transfer ke *t.me/netstream_cloud*.\n` +
        `Mohon standby untuk konfirmasi aktivasi lisensi.`;

      await bot.telegram.sendMessage(ADMIN_ID, adminNotice, { parse_mode: 'Markdown' });
    } catch (e) {
      console.error('Notifikasi admin gagal:', e.message);
    }
  }
}

// ─── Command /start ────────────────────────────────────────────────────────
bot.command('start', (ctx) => askSchoolName(ctx));

// ─── Command /id ───────────────────────────────────────────────────────────
bot.command('id', (ctx) =>
  ctx.reply(`ID Anda: \`${ctx.from.id}\``, { parse_mode: 'Markdown' })
);

// ─── Text Handler (Multi-Step) ─────────────────────────────────────────────
bot.on('text', async (ctx, next) => {
  const uid  = ctx.from.id;
  const text = ctx.message.text.trim();
  const state = getState(uid);

  // Pesan pemicu dari Aplikasi Wadah Guru (awal percakapan)
  const isTrigger =
    text.toLowerCase().includes('wadah guru') ||
    text.toLowerCase().includes('mitra mandiri') ||
    text.toLowerCase().includes('sponsorship') ||
    text.toLowerCase().includes('alokasi kuota');

  if (isTrigger) {
    return askSchoolName(ctx);
  }

  // Step: Menunggu nama sekolah
  if (state.step === 'WAITING_SCHOOL') {
    if (text.length < 3) {
      return ctx.reply('Nama sekolah terlalu pendek, mohon ketik nama lengkap sekolah Anda.');
    }
    return askDeviceCount(ctx, text);
  }

  // Step: Menunggu input angka perangkat (jika sudah punya nama sekolah)
  if (state.step === 'WAITING_DEVICES') {
    const m = text.match(/^\d+$/);
    if (m) {
      const n = parseInt(m[0], 10);
      if (n > 0 && n <= 999) return handleDevice(ctx, n);
    }
    return ctx.reply(
      'Silakan pilih tombol perangkat di atas atau *ketik angka* jumlah perangkat yang Anda inginkan.',
      { parse_mode: 'Markdown' }
    );
  }

  // Fallback: Jika ada angka tanpa step (misal user kirim ulang)
  const m = text.match(/^\d+$/);
  if (m && state.schoolName) {
    const n = parseInt(m[0], 10);
    if (n > 0 && n <= 999) return handleDevice(ctx, n);
  }

  return next();
});

// ─── Callback Tombol Perangkat ─────────────────────────────────────────────
bot.action(/dev_(\d+|custom)/, async (ctx) => {
  await ctx.answerCbQuery();
  const uid   = ctx.from.id;
  const state = getState(uid);

  // Jika nama sekolah belum ada, minta dulu
  if (!state.schoolName) {
    return askSchoolName(ctx);
  }

  if (ctx.match[1] === 'custom') {
    setState(uid, { step: 'WAITING_DEVICES' });
    return ctx.reply(
      `Ketik *angka jumlah perangkat* yang Anda inginkan di chat ini.\n_(Contoh: ketik *10*)_`,
      { parse_mode: 'Markdown' }
    );
  }

  return handleDevice(ctx, parseInt(ctx.match[1], 10));
});

// ─── Handler: Pelanggan Salah Kirim Foto ke Bot ────────────────────────────
// Bot tidak menerima bukti di sini — redirect ke Admin langsung
bot.on(['photo', 'document'], async (ctx) => {
  return ctx.reply(
    `⚠️ *Ups! Sepertinya Anda mengirim bukti transfer di sini.*\n\n` +
    `Mohon kirimkan foto bukti transfer Anda *langsung ke Admin* melalui tautan berikut:\n\n` +
    `👇 *KLIK LINK INI UNTUK KIRIM KE ADMIN* 👇\n` +
    `➡️ https://t.me/netstream_cloud ⬅️\n\n` +
    `Admin kami siap menerima dan memproses konfirmasi pembayaran Anda. Terima kasih! 🙏`,
    { parse_mode: 'Markdown' }
  );
});


// ─── Vercel Serverless Handler ─────────────────────────────────────────────
export default async function handler(req, res) {
  const host  = req.headers['host']              || 'localhost';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const base  = `${proto}://${host}`;

  // GET → pasang webhook + tampilkan halaman status
  if (req.method === 'GET') {
    const webhookUrl = `${base}/api/index`;
    try {
      await bot.telegram.setWebhook(webhookUrl);
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
    return res.status(200).send(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Netstream Bot — Status</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',sans-serif;background:#0f172a;color:#f8fafc;
         display:flex;min-height:100vh;align-items:center;justify-content:center;padding:20px}
    .card{background:#1e293b;padding:36px 28px;border-radius:20px;
          box-shadow:0 20px 40px rgba(0,0,0,.4);text-align:center;max-width:480px;width:100%}
    .icon{font-size:52px;margin-bottom:12px}
    h2{color:#38bdf8;font-size:22px;margin-bottom:6px}
    .badge{background:#059669;color:#fff;padding:8px 20px;border-radius:20px;
           font-weight:700;font-size:14px;display:inline-block;margin:14px 0}
    .url{background:#0f172a;color:#34d399;padding:10px 14px;border-radius:10px;
         font-size:12px;word-break:break-all;margin-top:10px}
    hr{border-color:#334155;margin:18px 0}
    p{color:#94a3b8;font-size:14px}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🤖⚡</div>
    <h2>Bot Telegram Wadah Guru</h2>
    <p>Mitra Mandiri Auto-Responder</p>
    <div class="badge">✅ Aktif 24 Jam di Vercel</div>
    <hr>
    <p>Webhook aktif di:</p>
    <div class="url">${webhookUrl}</div>
  </div>
</body>
</html>`);
  }

  // POST → proses update dari Telegram Webhook
  if (req.method === 'POST') {
    try {
      await bot.handleUpdate(req.body, res);
    } catch (err) {
      console.error('handleUpdate error:', err.message);
      if (!res.headersSent) res.status(200).json({ ok: true });
    }
    return;
  }

  return res.status(200).send('OK');
}
