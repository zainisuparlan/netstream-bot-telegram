import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN || '8874951978:AAH7SoMNHC0g06vZemNdLmH9D7ILg1fVEYs';
const ADMIN_ID  = process.env.ADMIN_ID  || '5036719692';
const QRIS_URL  = 'https://raw.githubusercontent.com/zainisuparlan/netstream-bot-telegram/main/photo_2026-07-30_18-24-48.jpg';

const bot = new Telegraf(BOT_TOKEN);

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

// ─── Step 1: Minta Nama Sekolah (ForceReply) ───────────────────────────────
// ForceReply = Telegram memaksa user untuk reply ke pesan ini
// Sehingga kita bisa deteksi konteks tanpa menyimpan state
async function askSchoolName(ctx) {
  const name = ctx.from?.first_name || 'Bapak/Ibu';
  return ctx.reply(
    `Halo *${name}*! Selamat datang di layanan *Mitra Mandiri Wadah Guru* 🎓✨\n\n` +
    `Terima kasih atas ketertarikan Sekolah Anda untuk bergabung dalam program Sponsorship.\n\n` +
    `📝 *Ketikkan nama lengkap sekolah Anda:*`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        force_reply: true,
        input_field_placeholder: 'Contoh: SDN 01 Maju Bersama'
      }
    }
  );
}

// ─── Step 2: Simpan Nama Sekolah di Teks Pesan + Tampilkan Tombol ──────────
// Nama sekolah di-embed dalam teks pesan agar bisa dibaca saat tombol diklik
async function askDeviceCount(ctx, schoolName) {
  return ctx.reply(
    `✅ Nama sekolah: *${schoolName}*\n\n` +
    `👉 *Berapa jumlah perangkat yang ingin didaftarkan?*\n` +
    `_(Pilih tombol di bawah atau ketik angkanya langsung)_`,
    { parse_mode: 'Markdown', ...deviceKeyboard() }
  );
}

// ─── Step 3: Kirim QRIS + Notifikasi Admin ─────────────────────────────────
async function handleDevice(ctx, n, schoolName) {
  const price = calculatePrice(n);
  if (!price) return ctx.reply('Masukkan angka perangkat yang valid (min. 1).');

  const harga = rupiah(price);

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
    `Setelah transfer berhasil, segera kirimkan *foto/screenshot Bukti Transfer* langsung ke Admin:\n\n` +
    `👇 *KLIK LINK INI UNTUK KIRIM KE ADMIN* 👇\n` +
    `➡️ https://t.me/netstream_cloud ⬅️\n\n` +
    `⚠️ *PENTING:* Kirim bukti di link atas, *bukan di chat ini*.\n` +
    `Admin akan memverifikasi dan mengaktifkan lisensi *${schoolName}*. Terima kasih! 🙏`;

  // Kirim QRIS - dengan fallback teks jika foto gagal
  try {
    await ctx.replyWithPhoto(QRIS_URL, { caption, parse_mode: 'Markdown' });
  } catch (photoErr) {
    console.error('replyWithPhoto gagal:', photoErr.message);
    // Fallback: kirim teks saja jika gambar gagal
    try {
      await ctx.reply(
        caption + `\n\n🖼 _(Gambar QRIS sementara tidak dapat ditampilkan. Scan QRIS langsung saat konfirmasi ke Admin)_`,
        { parse_mode: 'Markdown' }
      );
    } catch (textErr) {
      console.error('reply teks juga gagal:', textErr.message);
    }
  }

  // Notifikasi ke Admin
  if (ADMIN_ID) {
    try {
      const uid = ctx.from?.id;
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
        `⏳ Pelanggan diarahkan kirim bukti ke *t.me/netstream_cloud*.\n` +
        `Mohon standby untuk konfirmasi aktivasi lisensi.`;

      await bot.telegram.sendMessage(ADMIN_ID, adminNotice, { parse_mode: 'Markdown' });
    } catch (e) {
      console.error('Notifikasi admin gagal:', e.message);
    }
  }
}

// ─── Helper: Ekstrak nama sekolah dari teks pesan (robust) ───────────────────
function extractSchoolName(text) {
  if (!text) return null;
  // Coba berbagai format (dengan atau tanpa markdown symbol *)
  const patterns = [
    /Nama sekolah:\s*\*([^\n*]+)\*/i,   // dengan asterisk bold
    /Nama sekolah:\s*([^\n*]+)/i,        // tanpa asterisk
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1].trim().length > 1) return match[1].trim();
  }
  return null;
}

// ─── Command /start ────────────────────────────────────────────────────────
bot.command('start', (ctx) => askSchoolName(ctx));

// ─── Command /id ───────────────────────────────────────────────────────────
bot.command('id', (ctx) =>
  ctx.reply(`ID Anda: \`${ctx.from.id}\``, { parse_mode: 'Markdown' })
);

// ─── Text Handler ──────────────────────────────────────────────────────────
bot.on('text', async (ctx, next) => {
  const text = ctx.message.text.trim();

  // Pesan pemicu dari Aplikasi Wadah Guru
  const isTrigger =
    text.toLowerCase().includes('wadah guru') ||
    text.toLowerCase().includes('mitra mandiri') ||
    text.toLowerCase().includes('sponsorship') ||
    text.toLowerCase().includes('alokasi kuota');

  if (isTrigger) {
    return askSchoolName(ctx);
  }

  // STATELESS: Deteksi reply ke pesan "Ketikkan nama lengkap sekolah"
  const replyText = ctx.message.reply_to_message?.text || '';
  if (replyText.includes('nama lengkap sekolah')) {
    if (text.length < 3) {
      return ctx.reply(
        '⚠️ Nama sekolah terlalu pendek. Mohon ketik nama lengkap sekolah Anda.',
        { reply_markup: { force_reply: true } }
      );
    }
    return askDeviceCount(ctx, text);
  }

  // STATELESS: Deteksi reply ke pesan "Ketik angka jumlah perangkat"
  if (replyText.includes('Ketik angka jumlah perangkat')) {
    const schoolName = extractSchoolName(replyText);
    const m = text.match(/^\d+$/);
    if (m) {
      const n = parseInt(m[0], 10);
      if (n > 0 && n <= 999) return handleDevice(ctx, n, schoolName);
    }
    return ctx.reply('Masukkan angka yang valid (contoh: 3 atau 10).', {
      reply_markup: { force_reply: true }
    });
  }

  // Fallback: input angka langsung jika ada konteks perangkat di history
  const m = text.match(/^\d+$/);
  if (m) {
    const n = parseInt(m[0], 10);
    if (n > 0 && n <= 999) {
      // Coba ambil nama sekolah dari pesan sebelumnya yang di-reply
      const schoolName = extractSchoolName(replyText) || '–';
      return handleDevice(ctx, n, schoolName);
    }
  }

  return next();
});

// ─── Callback Tombol Perangkat ─────────────────────────────────────────────
bot.action(/dev_(\d+|custom)/, async (ctx) => {
  try {
    await ctx.answerCbQuery();

    // STATELESS: Baca nama sekolah dari teks pesan yang berisi tombol ini
    const msgText = ctx.callbackQuery.message?.text || '';
    const schoolName = extractSchoolName(msgText);

    if (!schoolName) {
      return askSchoolName(ctx);
    }

  if (ctx.match[1] === 'custom') {
    return ctx.reply(
      `✅ Nama sekolah: *${schoolName}*\n\n` +
      `Ketik angka jumlah perangkat yang Anda inginkan:\n_(Contoh: ketik *10*)_`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          force_reply: true,
          input_field_placeholder: 'Contoh: 10'
        }
      }
    );
  }

    return handleDevice(ctx, parseInt(ctx.match[1], 10), schoolName);
  } catch (err) {
    console.error('Callback error:', err.message);
    try {
      await ctx.reply('⚠️ Terjadi gangguan sementara. Mohon coba klik tombol lagi atau ketik angka perangkat secara langsung.');
    } catch(_) {}
  }
});

// ─── Handler: Foto/Dokumen Salah Kirim ke Bot ─────────────────────────────
bot.on(['photo', 'document'], async (ctx) => {
  return ctx.reply(
    `⚠️ *Ups! Sepertinya Anda mengirim bukti transfer di sini.*\n\n` +
    `Mohon kirimkan foto bukti transfer Anda *langsung ke Admin* melalui tautan berikut:\n\n` +
    `👇 *KLIK LINK INI UNTUK KIRIM KE ADMIN* 👇\n` +
    `➡️ https://t.me/netstream_cloud ⬅️\n\n` +
    `Admin siap menerima dan memproses konfirmasi pembayaran Anda. Terima kasih! 🙏`,
    { parse_mode: 'Markdown' }
  );
});

// ─── Vercel Serverless Handler ─────────────────────────────────────────────
export default async function handler(req, res) {
  const host  = req.headers['host']              || 'localhost';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const base  = `${proto}://${host}`;

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
