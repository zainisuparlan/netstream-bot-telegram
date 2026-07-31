import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN || '8874951978:AAH7SoMNHC0g06vZemNdLmH9D7ILg1fVEYs';
const ADMIN_ID = process.env.ADMIN_ID || '5036719692';

const bot = new Telegraf(BOT_TOKEN);

// In-memory store state pengguna (per-instance, reset tiap cold start)
const userStates = new Map();

// ─── Helper kalkulasi harga ────────────────────────────────────────────────
function calculatePrice(devices) {
  const count = parseInt(devices, 10);
  if (isNaN(count) || count <= 0) return null;
  if (count === 1) return 50000;
  if (count === 2) return 100000;
  return 100000 + (count - 2) * 25000;
}

function formatRupiah(number) {
  return new Intl.NumberFormat('id-ID').format(number);
}

// ─── Tombol Keyboard Perangkat ─────────────────────────────────────────────
function deviceKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('1 Perangkat', 'dev_1'),
      Markup.button.callback('2 Perangkat', 'dev_2'),
      Markup.button.callback('3 Perangkat', 'dev_3')
    ],
    [
      Markup.button.callback('4 Perangkat', 'dev_4'),
      Markup.button.callback('5 Perangkat', 'dev_5')
    ],
    [
      Markup.button.callback('💬 Jumlah Lain? Ketik Angkanya', 'dev_custom')
    ]
  ]);
}

// ─── Fungsi Kirim Pesan Sambutan ───────────────────────────────────────────
async function sendWelcomeMessage(ctx) {
  const name = ctx.from?.first_name || 'Bapak/Ibu';
  const welcomeText =
    `Halo *${name}*! Selamat datang di layanan *Mitra Mandiri Wadah Guru* 🎓✨\n\n` +
    `Terima kasih atas ketertarikan Sekolah Anda untuk bergabung dalam program Sponsorship dan mendapatkan alokasi kuota lisensi yang lebih besar.\n\n` +
    `👉 *Berapa jumlah perangkat yang ingin didaftarkan?*\n` +
    `_(Pilih tombol di bawah atau ketik angka langsung)_`;

  return ctx.reply(welcomeText, { parse_mode: 'Markdown', ...deviceKeyboard() });
}

// ─── Fungsi Proses Pilihan Perangkat + Kirim QRIS ─────────────────────────
async function handleDeviceSelection(ctx, devices) {
  const price = calculatePrice(devices);
  if (!price) {
    return ctx.reply('Mohon masukkan angka yang valid (minimal 1 perangkat).');
  }

  const formattedPrice = formatRupiah(price);

  // Simpan state
  const userId = ctx.from?.id;
  if (userId) {
    userStates.set(userId, { devices, price, formattedPrice, updatedAt: new Date() });
  }

  const captionText =
    `📌 *RINCIAN PENDAFTARAN LISENSI MITRA MANDIRI*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📱 Jumlah Perangkat : *${devices} Perangkat*\n` +
    `💰 Total Pembayaran : *Rp ${formattedPrice}* / bulan\n` +
    `_(Tarif perpanjangan tetap seperti di awal)_\n\n` +
    `💳 *CARA BAYAR VIA QRIS:*\n` +
    `1. Scan kode QRIS di atas menggunakan M-Banking atau E-Wallet Anda _(GoPay, OVO, DANA, ShopeePay, LinkAja, BCA, Mandiri, dll)_.\n` +
    `2. Pastikan nominal tepat *Rp ${formattedPrice}*.\n\n` +
    `📩 *KONFIRMASI PEMBAYARAN:*\n` +
    `Setelah transfer berhasil, kirimkan *foto/screenshot Bukti Transfer* di chat ini.\n\n` +
    `⚡ Tim kami akan segera memverifikasi dan menghubungi Anda kembali. Terima kasih! 🙏`;

  // Coba kirim gambar QRIS (dari file lokal atau URL fallback)
  const qrisPath = path.join(process.cwd(), 'photo_2026-07-30_18-24-48.jpg');
  try {
    if (fs.existsSync(qrisPath)) {
      return ctx.replyWithPhoto(
        { source: qrisPath },
        { caption: captionText, parse_mode: 'Markdown' }
      );
    } else {
      return ctx.replyWithPhoto(
        'https://ibb.co.com/ynJ3gbBr',
        { caption: captionText, parse_mode: 'Markdown' }
      );
    }
  } catch (error) {
    console.error('Gagal mengirim QRIS:', error);
    return ctx.reply(captionText, { parse_mode: 'Markdown' });
  }
}

// ─── Handler /start ────────────────────────────────────────────────────────
bot.command('start', (ctx) => sendWelcomeMessage(ctx));

// ─── Handler /id ───────────────────────────────────────────────────────────
bot.command('id', (ctx) => {
  ctx.reply(`ID Telegram Anda: \`${ctx.from.id}\``, { parse_mode: 'Markdown' });
});

// ─── Handler Teks Masuk ────────────────────────────────────────────────────
bot.on('text', async (ctx, next) => {
  const text = ctx.message.text.trim();

  // Deteksi pesan pemicu dari aplikasi Wadah Guru
  const isTrigger =
    text.toLowerCase().includes('wadah guru') ||
    text.toLowerCase().includes('mitra mandiri') ||
    text.toLowerCase().includes('sponsorship') ||
    text.toLowerCase().includes('alokasi kuota');

  if (isTrigger) {
    return sendWelcomeMessage(ctx);
  }

  // Deteksi input angka (jumlah perangkat)
  const numMatch = text.match(/^\d+$/);
  if (numMatch) {
    const devices = parseInt(numMatch[0], 10);
    if (devices > 0 && devices <= 500) {
      return handleDeviceSelection(ctx, devices);
    }
  }

  return next();
});

// ─── Callback: Tombol Pilih Perangkat ─────────────────────────────────────
bot.action(/dev_(\d+|custom)/, async (ctx) => {
  await ctx.answerCbQuery();
  const choice = ctx.match[1];

  if (choice === 'custom') {
    return ctx.reply(
      `Silakan ketikkan *angka jumlah perangkat* yang Anda inginkan langsung di chat ini.\n_(Contoh: ketik *10* atau *20*)_`,
      { parse_mode: 'Markdown' }
    );
  }

  return handleDeviceSelection(ctx, parseInt(choice, 10));
});

// ─── Handler Bukti Pembayaran (Foto / Dokumen) ─────────────────────────────
bot.on(['photo', 'document'], async (ctx) => {
  const userId = ctx.from.id;
  const userState = userStates.get(userId);

  // Balas ke pelanggan
  await ctx.reply(
    `✅ *Bukti Transfer Berhasil Diterima!*\n\n` +
    `Terima kasih, Bukti pembayaran Anda telah kami terima.\n` +
    `Mohon tunggu, Tim Wadah Guru akan segera mengecek dan menghubungi Anda kembali untuk aktivasi lisensi. 🙏`,
    { parse_mode: 'Markdown' }
  );

  // Forward ke Admin
  if (ADMIN_ID) {
    try {
      const customerName = `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim() || 'Tidak diketahui';
      const username = ctx.from.username ? `@${ctx.from.username}` : 'Tidak ada username';
      const devicesInfo = userState ? `${userState.devices} Perangkat` : 'Belum tercatat';
      const priceInfo = userState ? `Rp ${userState.formattedPrice}` : 'Belum tercatat';

      const adminNotice =
        `🔔 *BUKTI TRANSFER BARU MASUK!*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 Nama       : *${customerName}*\n` +
        `🏷 Username   : ${username}\n` +
        `🆔 ID TG      : \`${userId}\`\n` +
        `📱 Perangkat  : *${devicesInfo}*\n` +
        `💰 Tagihan    : *${priceInfo}*\n\n` +
        `👉 Silakan Admin balas pesan pengguna secara manual untuk aktivasi lisensi.`;

      if (ctx.message.photo) {
        const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        await bot.telegram.sendPhoto(ADMIN_ID, fileId, { caption: adminNotice, parse_mode: 'Markdown' });
      } else if (ctx.message.document) {
        await bot.telegram.sendDocument(ADMIN_ID, ctx.message.document.file_id, { caption: adminNotice, parse_mode: 'Markdown' });
      }
    } catch (err) {
      console.error('Gagal forward ke admin:', err);
    }
  }
});

// ─── Vercel Serverless Handler ─────────────────────────────────────────────
export default async function handler(req, res) {
  const host = req.headers['host'] || 'localhost';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${proto}://${host}`;

  // GET → Set Webhook + tampilkan status halaman
  if (req.method === 'GET') {
    try {
      const webhookUrl = `${baseUrl}/api/index`;
      await bot.telegram.setWebhook(webhookUrl);
      return res.status(200).send(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Netstream Bot Telegram — Status</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',sans-serif;background:#0f172a;color:#f8fafc;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:20px}
    .card{background:#1e293b;padding:36px 28px;border-radius:20px;box-shadow:0 20px 40px rgba(0,0,0,0.4);text-align:center;max-width:500px;width:100%}
    .icon{font-size:52px;margin-bottom:12px}
    h2{color:#38bdf8;font-size:22px;margin-bottom:6px}
    .badge{background:#059669;color:#fff;padding:8px 18px;border-radius:20px;font-weight:700;font-size:14px;display:inline-block;margin:14px 0}
    .url{background:#0f172a;color:#34d399;padding:10px 14px;border-radius:10px;font-size:12px;word-break:break-all;margin-top:10px}
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
    <p>Webhook Telegram berhasil dihubungkan ke:</p>
    <div class="url">${webhookUrl}</div>
  </div>
</body>
</html>`);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // POST → Terima update dari Telegram Webhook
  if (req.method === 'POST') {
    // Langsung kirim 200 OK ke Telegram agar tidak timeout
    res.status(200).json({ ok: true });
    try {
      // Proses update secara async setelah response terkirim
      await bot.handleUpdate(req.body);
    } catch (err) {
      console.error('Error handleUpdate:', err);
    }
    return;
  }

  return res.status(200).send('Netstream Telegram Bot OK.');
}
