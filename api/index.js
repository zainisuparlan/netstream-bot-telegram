import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN || '8874951978:AAH7SoMNHC0g06vZemNdLmH9D7ILg1fVEYs';
const ADMIN_ID = process.env.ADMIN_ID || '5036719692';

const bot = new Telegraf(BOT_TOKEN);

// Simple In-memory store untuk menyimpan pilihan perangkat pengguna
const userStates = new Map();

// Helper delay (penjeda waktu balasan agar tampak alami)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper kalkulasi harga
function calculatePrice(devices) {
  const count = parseInt(devices, 10);
  if (isNaN(count) || count <= 0) return null;
  if (count === 1) return 50000;
  if (count === 2) return 100000;
  return 100000 + (count - 2) * 25000;
}

// Helper format IDR
function formatRupiah(number) {
  return new Intl.NumberFormat('id-ID').format(number);
}

// 1. Command /start & /id
bot.command('start', async (ctx) => {
  await ctx.sendChatAction('typing');
  await sleep(1500);
  return sendWelcomeMessage(ctx);
});

bot.command('id', (ctx) => {
  ctx.reply(`ID Telegram Anda adalah: \`${ctx.from.id}\``, { parse_mode: 'Markdown' });
});

// 2. Handler Pemicu Utama (Deteksi Teks Otomatis dari Aplikasi)
bot.on('text', async (ctx, next) => {
  const text = ctx.message.text.trim();

  // Pemicu dari aplikasi Wadah Guru
  const isTriggerMessage = 
    text.toLowerCase().includes('wadah guru') ||
    text.toLowerCase().includes('mitra mandiri') ||
    text.toLowerCase().includes('sponsorship') ||
    text.toLowerCase().includes('alokasi kuota');

  if (isTriggerMessage) {
    // Jeda alami: tampilkan animasi "sedang mengetik..." selama 1.8 detik
    await ctx.sendChatAction('typing');
    await sleep(1800);
    return sendWelcomeMessage(ctx);
  }

  // Jika pengguna membalas dengan angka (misal: 1, 3, 10, 15)
  const numericInput = text.match(/^\d+$/);
  if (numericInput) {
    const devices = parseInt(numericInput[0], 10);
    if (devices > 0 && devices <= 500) {
      await ctx.sendChatAction('typing');
      await sleep(1500);
      return handleDeviceSelection(ctx, devices);
    }
  }

  return next();
});

// Fungsi Kirim Pesan Selamat Datang & Pilihan Perangkat
async function sendWelcomeMessage(ctx) {
  const welcomeText = 
    `Halo *${ctx.from.first_name || 'Bapak/Ibu'}*! Selamat datang di layanan *Mitra Mandiri Wadah Guru*. 🎓✨\n\n` +
    `Terima kasih atas ketertarikan Sekolah Anda untuk bergabung dalam program Sponsorship agar mendapatkan alokasi kuota lisensi yang lebih besar.\n\n` +
    `👉 *Mohon pilih atau ketik jumlah perangkat (device) yang ingin didaftarkan:*`;

  const keyboard = Markup.inlineKeyboard([
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
      Markup.button.callback('💬 Ketik Jumlah Lain (Kirim Pesan Angka)', 'dev_custom')
    ]
  ]);

  return ctx.reply(welcomeText, { parse_mode: 'Markdown', ...keyboard });
}

// 3. Callback Query Handler (Tombol Interaktif)
bot.action(/dev_(\d+|custom)/, async (ctx) => {
  await ctx.answerCbQuery();
  const choice = ctx.match[1];

  if (choice === 'custom') {
    await ctx.sendChatAction('typing');
    await sleep(1200);
    return ctx.reply(
      `Silakan ketikkan *angka jumlah perangkat* yang Anda inginkan langsung di balasan chat ini.\n` +
      `_(Contoh: ketik *10* atau *15*)_`,
      { parse_mode: 'Markdown' }
    );
  }

  const devices = parseInt(choice, 10);
  return handleDeviceSelection(ctx, devices);
});

// Fungsi Memproses Jumlah Perangkat & Pengiriman QRIS
async function handleDeviceSelection(ctx, devices) {
  const price = calculatePrice(devices);
  if (!price) {
    return ctx.reply('Mohon masukkan jumlah angka perangkat yang valid (minimal 1).');
  }

  const formattedPrice = formatRupiah(price);

  userStates.set(ctx.from.id, {
    devices,
    price,
    formattedPrice,
    updatedAt: new Date()
  });

  const captionText = 
    `📌 *RINCIAN PENDAFTARAN LISENSI MITRA MANDIRI*\n` +
    `-------------------------------------------\n` +
    `📱 Jumlah Perangkat: *${devices} Perangkat*\n` +
    `💰 Total Pembayaran: *Rp ${formattedPrice}* / bulan\n` +
    `_(Tarif perpanjangan tetap seperti di awal)_\n\n` +
    `💳 *PETUNJUK PEMBAYARAN:*\n` +
    `1. Silakan scan kode QRIS di atas menggunakan aplikasi M-Banking atau E-Wallet Anda (GoPay, OVO, DANA, ShopeePay, LinkAja, BCA, Mandiri, dll).\n` +
    `2. Pastikan nominal pembayaran tepat *Rp ${formattedPrice}*.\n\n` +
    `📩 *LOKASI KONFIRMASI:*\n` +
    `Setelah pembayaran berhasil, silakan *kirimkan foto / screenshot Bukti Transfer* di chat Telegram ini.\n\n` +
    `⚡ Admin kami akan memverifikasi bukti pembayaran dan membalas manual untuk aktivasi lisensi sekolah Anda. Terima kasih! 🙏`;

  // Tampilkan efek "sedang mengunggah foto..." selama 2 detik
  await ctx.sendChatAction('upload_photo');
  await sleep(2000);

  const qrisPath = path.join(process.cwd(), 'photo_2026-07-30_18-24-48.jpg');

  try {
    if (fs.existsSync(qrisPath)) {
      await ctx.replyWithPhoto({ source: qrisPath }, { caption: captionText, parse_mode: 'Markdown' });
    } else {
      await ctx.replyWithPhoto('https://ibb.co.com/ynJ3gbBr', { caption: captionText, parse_mode: 'Markdown' });
    }
  } catch (error) {
    console.error('Gagal mengirim gambar QRIS:', error);
    await ctx.reply(captionText, { parse_mode: 'Markdown' });
  }
}

// 4. Handler Menerima Bukti Pembayaran (Foto / Dokumen)
bot.on(['photo', 'document'], async (ctx) => {
  const userId = ctx.from.id;
  const userState = userStates.get(userId);

  // Efek mengetik sebelum membalas konfirmasi
  await ctx.sendChatAction('typing');
  await sleep(1800);

  await ctx.reply(
    `✅ *Bukti Transfer Berhasil Diterima!*\n\n` +
    `Terima kasih. Bukti pembayaran Anda telah kami terima dan diteruskan ke Admin.\n` +
    `Mohon tunggu sebentar, Admin Wadah Guru akan mengecek dan membalas pesan ini secara manual untuk aktivasi lisensi Anda. 🙏`,
    { parse_mode: 'Markdown' }
  );

  // Forward ke Admin Telegram
  if (ADMIN_ID) {
    try {
      const customerName = `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim();
      const username = ctx.from.username ? `@${ctx.from.username}` : 'Tidak ada username';
      const devicesInfo = userState ? `${userState.devices} Perangkat` : 'Belum tercatat';
      const priceInfo = userState ? `Rp ${userState.formattedPrice}` : 'Belum tercatat';

      const adminNotice = 
        `🔔 *BUKTI TRANSFER BARU MASUK!*\n` +
        `-----------------------------------\n` +
        `👤 *Nama Pelanggan:* ${customerName}\n` +
        `🏷 *Username:* ${username}\n` +
        `🆔 *ID Telegram:* \`${userId}\`\n` +
        `📱 *Jumlah Perangkat:* ${devicesInfo}\n` +
        `💰 *Tagihan (QRIS):* ${priceInfo}\n\n` +
        `👉 *Silakan Admin cek foto di atas dan balas pesan pengguna secara manual.*`;

      if (ctx.message.photo) {
        const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        await bot.telegram.sendPhoto(ADMIN_ID, fileId, { caption: adminNotice, parse_mode: 'Markdown' });
      } else if (ctx.message.document) {
        const fileId = ctx.message.document.file_id;
        await bot.telegram.sendDocument(ADMIN_ID, fileId, { caption: adminNotice, parse_mode: 'Markdown' });
      }
    } catch (err) {
      console.error('Gagal meneruskan bukti transfer ke Admin:', err);
    }
  }
});

// Vercel Serverless Function Handler
export default async function handler(req, res) {
  const host = req.headers['host'] || 'localhost';
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const currentUrl = `${protocol}://${host}`;

  // Route GET (Browser / Set-Webhook)
  if (req.method === 'GET') {
    try {
      const webhookUrl = `${currentUrl}/api/index`;
      await bot.telegram.setWebhook(webhookUrl);
      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Netstream Telegram Bot Status</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #f8fafc; display: flex; height: 100vh; align-items: center; justify-content: center; margin: 0; }
              .card { background: #1e293b; padding: 30px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); text-align: center; max-width: 480px; width: 90%; }
              .icon { font-size: 48px; margin-bottom: 10px; }
              h2 { color: #38bdf8; margin-top: 0; }
              code { background: #0f172a; padding: 6px 10px; border-radius: 6px; color: #34d399; font-size: 13px; word-break: break-all; }
              .badge { background: #059669; color: white; padding: 6px 14px; border-radius: 20px; font-weight: bold; display: inline-block; margin-top: 15px; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="icon">🤖⚡</div>
              <h2>Bot Telegram Wadah Guru</h2>
              <p>Status: <span class="badge">Aktif 24 Jam di Vercel</span></p>
              <hr style="border-color: #334155; margin: 20px 0;">
              <p style="font-size: 14px; color: #94a3b8;">Webhook Telegram telah berhasil dihubungkan ke:</p>
              <code>${webhookUrl}</code>
            </div>
          </body>
        </html>
      `);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // Route POST (Telegram Webhook Updates)
  if (req.method === 'POST') {
    try {
      await bot.handleUpdate(req.body, res);
    } catch (err) {
      console.error('Error handling webhook update:', err);
      if (!res.headersSent) {
        res.status(200).json({ ok: true });
      }
    }
  } else {
    res.status(200).send('Netstream Telegram Bot Webhook Engine.');
  }
}
