import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOT_TOKEN = process.env.BOT_TOKEN || '8874951978:AAH7SoMNHC0g06vZemNdLmH9D7ILg1fVEYs';
const ADMIN_ID = process.env.ADMIN_ID || '5036719692';

const bot = new Telegraf(BOT_TOKEN);
const userStates = new Map();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

bot.command('start', async (ctx) => {
  await ctx.sendChatAction('typing');
  await sleep(1500);
  return sendWelcomeMessage(ctx);
});

bot.command('id', (ctx) => {
  ctx.reply(`ID Telegram Anda adalah: \`${ctx.from.id}\``, { parse_mode: 'Markdown' });
});

bot.on('text', async (ctx, next) => {
  const text = ctx.message.text.trim();
  const isTriggerMessage = 
    text.toLowerCase().includes('wadah guru') ||
    text.toLowerCase().includes('mitra mandiri') ||
    text.toLowerCase().includes('sponsorship') ||
    text.toLowerCase().includes('alokasi kuota');

  if (isTriggerMessage) {
    await ctx.sendChatAction('typing');
    await sleep(1800);
    return sendWelcomeMessage(ctx);
  }

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

  await ctx.sendChatAction('upload_photo');
  await sleep(2000);

  const qrisPath = path.join(__dirname, 'photo_2026-07-30_18-24-48.jpg');

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

bot.on(['photo', 'document'], async (ctx) => {
  const userId = ctx.from.id;
  const userState = userStates.get(userId);

  await ctx.sendChatAction('typing');
  await sleep(1800);

  await ctx.reply(
    `✅ *Bukti Transfer Berhasil Diterima!*\n\n` +
    `Terima kasih. Bukti pembayaran Anda telah kami terima dan diteruskan ke Admin.\n` +
    `Mohon tunggu sebentar, Admin Wadah Guru akan mengecek dan membalas pesan ini secara manual untuk aktivasi lisensi Anda. 🙏`,
    { parse_mode: 'Markdown' }
  );

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

bot.launch().then(() => {
  console.log('🤖 Auto Bot Telegram Mitra Mandiri (Local Mode) BERHASIL BERJALAN!');
}).catch((err) => {
  console.error('Gagal menjalankan bot lokal:', err);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
