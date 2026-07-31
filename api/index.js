import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN || '8874951978:AAH7SoMNHC0g06vZemNdLmH9D7ILg1fVEYs';
const ADMIN_ID  = process.env.ADMIN_ID  || '5036719692';

// URL gambar QRIS langsung dari GitHub (agar tersedia di Vercel)
const QRIS_URL = 'https://raw.githubusercontent.com/zainisuparlan/netstream-bot-telegram/main/photo_2026-07-30_18-24-48.jpg';

const bot = new Telegraf(BOT_TOKEN);

// State sederhana per user
const userStates = new Map();

// ─── Hitung Harga ──────────────────────────────────────────────────────────
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

// ─── Kirim Pesan Sambutan ──────────────────────────────────────────────────
async function sendWelcome(ctx) {
  const name = ctx.from?.first_name || 'Bapak/Ibu';
  const text =
    `Halo *${name}*! Selamat datang di layanan *Mitra Mandiri Wadah Guru* 🎓✨\n\n` +
    `Terima kasih atas ketertarikan Sekolah Anda untuk bergabung dalam program Sponsorship.\n\n` +
    `👉 *Berapa jumlah perangkat yang ingin didaftarkan?*\n` +
    `_(Pilih tombol di bawah atau ketik angkanya langsung)_`;

  return ctx.reply(text, { parse_mode: 'Markdown', ...deviceKeyboard() });
}

// ─── Proses Pilihan Perangkat + Kirim QRIS ────────────────────────────────
async function handleDevice(ctx, n) {
  const price = calculatePrice(n);
  if (!price) return ctx.reply('Masukkan angka perangkat yang valid (min. 1).');

  const harga = rupiah(price);
  const uid = ctx.from?.id;
  if (uid) userStates.set(uid, { devices: n, price, harga });

  const caption =
    `📌 *RINCIAN PENDAFTARAN LISENSI MITRA MANDIRI*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📱 Jumlah Perangkat : *${n} Perangkat*\n` +
    `💰 Total Bayar      : *Rp ${harga}* / bulan\n` +
    `_(Perpanjangan tetap sama seperti awal)_\n\n` +
    `💳 *CARA BAYAR VIA QRIS:*\n` +
    `1. Scan kode QRIS di atas dengan M-Banking / E-Wallet _(GoPay, OVO, DANA, ShopeePay, LinkAja, BCA, Mandiri, dll)_.\n` +
    `2. Pastikan nominal tepat *Rp ${harga}*.\n\n` +
    `📩 *KONFIRMASI PEMBAYARAN:*\n` +
    `Setelah transfer berhasil, *kirimkan foto / screenshot Bukti Transfer* di chat ini.\n\n` +
    `⚡ Tim kami akan segera memverifikasi dan mengaktifkan lisensi sekolah Anda. Terima kasih! 🙏`;

  return ctx.replyWithPhoto(QRIS_URL, { caption, parse_mode: 'Markdown' });
}

// ─── Command /start ────────────────────────────────────────────────────────
bot.command('start', (ctx) => sendWelcome(ctx));

// ─── Command /id ───────────────────────────────────────────────────────────
bot.command('id', (ctx) =>
  ctx.reply(`ID Anda: \`${ctx.from.id}\``, { parse_mode: 'Markdown' })
);

// ─── Text Handler ──────────────────────────────────────────────────────────
bot.on('text', async (ctx, next) => {
  const t = ctx.message.text.trim().toLowerCase();

  // Pesan pemicu dari Aplikasi Wadah Guru
  if (
    t.includes('wadah guru') ||
    t.includes('mitra mandiri') ||
    t.includes('sponsorship') ||
    t.includes('alokasi kuota')
  ) {
    return sendWelcome(ctx);
  }

  // Input angka manual
  const m = ctx.message.text.trim().match(/^\d+$/);
  if (m) {
    const n = parseInt(m[0], 10);
    if (n > 0 && n <= 999) return handleDevice(ctx, n);
  }

  return next();
});

// ─── Callback Tombol ───────────────────────────────────────────────────────
bot.action(/dev_(\d+|custom)/, async (ctx) => {
  await ctx.answerCbQuery();
  if (ctx.match[1] === 'custom') {
    return ctx.reply(
      `Ketik *angka jumlah perangkat* yang Anda inginkan di chat ini.\n_(Contoh: ketik *10*)_`,
      { parse_mode: 'Markdown' }
    );
  }
  return handleDevice(ctx, parseInt(ctx.match[1], 10));
});

// ─── Handler Bukti Pembayaran ─────────────────────────────────────────────
bot.on(['photo', 'document'], async (ctx) => {
  const uid   = ctx.from.id;
  const state = userStates.get(uid);

  await ctx.reply(
    `✅ *Bukti Transfer Diterima!*\n\n` +
    `Terima kasih, pembayaran Anda sedang kami verifikasi.\n` +
    `Tim Wadah Guru akan segera menghubungi Anda untuk aktivasi lisensi. 🙏`,
    { parse_mode: 'Markdown' }
  );

  if (ADMIN_ID) {
    try {
      const nama = `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim() || '–';
      const uname = ctx.from.username ? `@${ctx.from.username}` : 'Tanpa username';
      const devInfo = state ? `${state.devices} Perangkat` : 'Belum tercatat';
      const priceInfo = state ? `Rp ${state.harga}` : 'Belum tercatat';

      const notice =
        `🔔 *BUKTI TRANSFER MASUK!*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 Nama      : *${nama}*\n` +
        `🏷 Username  : ${uname}\n` +
        `🆔 ID TG     : \`${uid}\`\n` +
        `📱 Perangkat : *${devInfo}*\n` +
        `💰 Tagihan   : *${priceInfo}*\n\n` +
        `👉 Silakan balas manual untuk aktivasi lisensi pelanggan.`;

      if (ctx.message.photo) {
        const fid = ctx.message.photo.at(-1).file_id;
        await bot.telegram.sendPhoto(ADMIN_ID, fid, { caption: notice, parse_mode: 'Markdown' });
      } else {
        await bot.telegram.sendDocument(ADMIN_ID, ctx.message.document.file_id, { caption: notice, parse_mode: 'Markdown' });
      }
    } catch (e) {
      console.error('Forward ke admin gagal:', e.message);
    }
  }
});

// ─── Vercel Serverless Entry Point ────────────────────────────────────────
export default async function handler(req, res) {
  const host   = req.headers['host']              || 'localhost';
  const proto  = req.headers['x-forwarded-proto'] || 'https';
  const base   = `${proto}://${host}`;

  // GET → pasang webhook & tampilkan status
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

  // POST → proses update dari Telegram
  if (req.method === 'POST') {
    try {
      // PENTING: teruskan 'res' ke handleUpdate agar Telegraf mengirim 200 OK
      // setelah semua proses selesai — ini cara benar untuk serverless webhook
      await bot.handleUpdate(req.body, res);
    } catch (err) {
      console.error('handleUpdate error:', err.message);
      if (!res.headersSent) res.status(200).json({ ok: true });
    }
    return;
  }

  return res.status(200).send('OK');
}
