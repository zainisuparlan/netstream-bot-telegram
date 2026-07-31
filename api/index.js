import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN || '8874951978:AAH7SoMNHC0g06vZemNdLmH9D7ILg1fVEYs';
const ADMIN_ID  = process.env.ADMIN_ID  || '5036719692';
const QRIS_URL  = 'https://raw.githubusercontent.com/zainisuparlan/netstream-bot-telegram/main/photo_2026-07-30_18-24-48.jpg';

const bot = new Telegraf(BOT_TOKEN);

function calculatePrice(n) {
  if (n === 1) return 50000;
  if (n === 2) return 100000;
  return 100000 + (n - 2) * 25000;
}

function rupiah(n) {
  return new Intl.NumberFormat('id-ID').format(n);
}

function extractSchool(text) {
  if (!text) return '–';
  const m = text.match(/Sekolah:\s*<b>(.+?)<\/b>/i) || text.match(/Sekolah:\s*(.+?)(?:\n|$)/i);
  return m ? m[1].replace(/<\/?[^>]+(>|$)/g, "").trim() : '–';
}

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

async function welcome(ctx) {
  const first = ctx.from?.first_name || 'Bapak/Ibu';
  return ctx.reply(
    `Halo <b>${first}</b>! Selamat datang di <b>Mitra Mandiri Wadah Guru</b> 🎓\n\n` +
    `📝 Ketikkan <b>nama lengkap sekolah</b> Anda:`,
    {
      parse_mode: 'HTML',
      reply_markup: { force_reply: true, input_field_placeholder: 'Contoh: SDN 01 Maju Bersama' }
    }
  );
}

async function showDevices(ctx, school) {
  return ctx.reply(
    `✅ Sekolah: <b>${school}</b>\n\n` +
    `Pilih jumlah perangkat yang ingin didaftarkan:`,
    { parse_mode: 'HTML', ...keyboard }
  );
}

async function sendQRIS(ctx, n, school) {
  const price = calculatePrice(n);
  const harga = rupiah(price);
  const uid = ctx.from?.id || '?';
  const nama = `${ctx.from?.first_name || ''} ${ctx.from?.last_name || ''}`.trim() || '–';
  const user = ctx.from?.username ? `@${ctx.from.username}` : '(tanpa username)';

  const caption =
    `📌 <b>RINCIAN MITRA MANDIRI WADAH GURU</b>\n` +
    `🏫 Sekolah  : <b>${school}</b>\n` +
    `📱 Perangkat: <b>${n} unit</b>\n` +
    `💰 Tagihan  : <b>Rp ${harga}/bulan</b>\n\n` +
    `💳 <b>BAYAR VIA QRIS DI ATAS</b>\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📩 <b>PETUNJUK KONFIRMASI PEMBAYARAN:</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Setelah transfer berhasil, silakan kirimkan:\n` +
    `1. 📄 <b>Bukti Transfer (Foto/Screenshot)</b>\n` +
    `2. 🏫 <b>Nama Sekolah (${school})</b>\n` +
    `3. 📱 <b>Jumlah Perangkat (${n} unit)</b>\n\n` +
    `ke Admin melalui link Telegram berikut:\n\n` +
    `👇👇 <b>KLIK LINK DI BAWAH UNTUK KONFIRMASI</b> 👇👇\n` +
    `👉 <b><a href="https://t.me/netstream_cloud">https://t.me/netstream_cloud</a></b> 👈\n` +
    `👆👆 <b>KLIK LINK DI ATAS UNTUK KONFIRMASI</b> 👆👆\n\n` +
    `⚠️ <i>Kirim bukti & data di atas langsung ke link Admin di atas, BUKAN di chat bot ini!</i>`;

  try {
    await ctx.replyWithPhoto(QRIS_URL, { caption, parse_mode: 'HTML' });
  } catch (err) {
    console.error('replyWithPhoto err:', err.message);
    await ctx.reply(caption, { parse_mode: 'HTML' }).catch(() => {});
  }

  // Notif ke admin (disable_web_page_preview agar ringkas & rapi)
  if (ADMIN_ID) {
    try {
      await bot.telegram.sendMessage(
        ADMIN_ID,
        `🛒 <b>PESANAN MASUK!</b>\n` +
        `🏫 Sekolah : <b>${school}</b>\n` +
        `👤 Nama    : <b>${nama}</b>\n` +
        `🏷 User    : ${user}\n` +
        `🆔 ID TG   : <code>${uid}</code>\n` +
        `📱 Unit    : <b>${n} Perangkat</b>\n` +
        `💰 Tagihan : <b>Rp ${harga}/bulan</b>\n\n` +
        `⏳ Menunggu bukti & data dari pelanggan via https://t.me/netstream_cloud`,
        { parse_mode: 'HTML', disable_web_page_preview: true }
      );
    } catch (err) {
      console.error('Admin msg err:', err.message);
    }
  }
}

bot.command('start', welcome);

bot.action(/^dev_(\d+|other)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery().catch(() => {});
    const match = ctx.match[1];
    const msgText = ctx.callbackQuery?.message?.text || '';
    const school = extractSchool(msgText);

    if (match === 'other') {
      return ctx.reply(
        `Sekolah: <b>${school}</b>\n\nMasukkan jumlah perangkat yang Anda inginkan:`,
        {
          parse_mode: 'HTML',
          reply_markup: { force_reply: true, input_field_placeholder: 'Contoh: 10' }
        }
      );
    }

    const n = parseInt(match, 10);
    if (n > 0) {
      return sendQRIS(ctx, n, school);
    }
  } catch (err) {
    console.error('Action err:', err.message);
  }
});

bot.on('text', async (ctx) => {
  const txt = ctx.message.text.trim();
  const replyTo = ctx.message.reply_to_message?.text || '';

  if (
    txt.toLowerCase().includes('wadah guru') ||
    txt.toLowerCase().includes('mitra mandiri') ||
    txt.toLowerCase().includes('sponsorship') ||
    txt.toLowerCase().includes('alokasi kuota')
  ) {
    return welcome(ctx);
  }

  if (replyTo.includes('nama lengkap sekolah') || replyTo.includes('nama sekolah')) {
    if (txt.length < 3) {
      return ctx.reply('Nama sekolah terlalu pendek, ketik nama lengkapnya.', {
        reply_markup: { force_reply: true }
      });
    }
    return showDevices(ctx, txt);
  }

  if (replyTo.includes('Masukkan jumlah perangkat')) {
    const school = extractSchool(replyTo);
    const n = parseInt(txt, 10);
    if (isNaN(n) || n <= 0 || n > 999) {
      return ctx.reply('Masukkan angka yang valid (1-999).', { reply_markup: { force_reply: true } });
    }
    return sendQRIS(ctx, n, school);
  }

  if (/^\d+$/.test(txt)) {
    const n = parseInt(txt, 10);
    if (n > 0 && n <= 999) {
      return sendQRIS(ctx, n, '–');
    }
  }
});

bot.on(['photo', 'document'], async (ctx) => {
  return ctx.reply(
    `⚠️ <b>Bukti transfer dikirim ke tempat yang salah!</b>\n\n` +
    `Mohon kirim Bukti Transfer + Nama Sekolah + Jumlah Perangkat langsung ke Admin:\n\n` +
    `👇👇 <b>KLIK LINK DI BAWAH</b> 👇👇\n` +
    `👉 <b><a href="https://t.me/netstream_cloud">https://t.me/netstream_cloud</a></b> 👈`,
    { parse_mode: 'HTML' }
  );
});

export default async function handler(req, res) {
  const host  = req.headers['host']              || 'localhost';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const base  = `${proto}://${host}`;

  if (req.method === 'GET') {
    const wh = `${base}/api/index`;
    try { await bot.telegram.setWebhook(wh); } catch(e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
    return res.status(200).send(`OK Webhook: ${wh}`);
  }

  if (req.method === 'POST') {
    try {
      await bot.handleUpdate(req.body, res);
    } catch (err) {
      console.error('Update err:', err.message);
      if (!res.headersSent) res.status(200).json({ ok: true });
    }
    return;
  }

  res.status(200).send('OK');
}
