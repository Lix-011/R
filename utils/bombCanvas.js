const { createCanvas, loadImage, registerFont } = require('canvas');
const https = require('https');
const http = require('http');
const path = require('path');

try {
  registerFont(path.join(__dirname, '../data/Cairo-ExtraLight.ttf'), { family: 'Cairo' });
} catch (e) {
  console.warn('تعذر تحميل خط Cairo:', e.message);
}

// الخلفية الافتراضية الجديدة لصورة الجولة (الصورة الزرقاء)
// ضع ملف الصورة هنا: data/bomb-word-bg.png
const DEFAULT_WORD_BG = path.join(__dirname, '../data/bomb-word-bg.png');

// خلفية صورة الفائز الافتراضية (شعار Løst)
// ضع ملف الصورة هنا: data/bomb-winner-bg.png
const DEFAULT_WINNER_BG = path.join(__dirname, '../data/bomb-winner-bg.png');

// ألوان الثيم الكحلي (بدل الأزرق النيون الفاتح السابق)
const NAVY_DARK = '#0a1730';
const NAVY = '#16294d';
const NAVY_ACCENT = '#2c4a7c';
const NAVY_ACCENT_LIGHT = '#4a6ea3';

function fetchImageBuffer(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (res) => {
      if (res.statusCode >= 400) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// يرسم صورة cover-fit بدون تشويه النسبة
function drawImageCover(ctx, img, x, y, w, h) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx, sy, sw, sh;
  if (imgRatio > boxRatio) {
    sh = img.height; sw = sh * boxRatio; sx = (img.width - sw) / 2; sy = 0;
  } else {
    sw = img.width; sh = sw / boxRatio; sx = 0; sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

// ──────────────────────────────────────────────────────────────────
//  يرسم أفاتار دائري بطريقة cover-fit (بدون تمطيط/قص خاطئ)
//  هذا يحل مشكلة ظهور الصورة "مقصوصة"/مشوّهة عند رسمها داخل الدائرة
// ──────────────────────────────────────────────────────────────────
function drawAvatarCover(ctx, img, cx, cy, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  drawImageCover(ctx, img, cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}

// ──────────────────────────────────────────────────────────────────
//  خلفية بطابع Løst (كحلي + شظايا هندسية شفافة + شعار خافت)
//  تُستخدم كبديل احترافي بدل التدرج الفاتح لما ما فيه صورة خلفية مخصصة
// ──────────────────────────────────────────────────────────────────
function drawLostBrandBackground(ctx, W, H) {
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#020611');
  grad.addColorStop(0.5, NAVY_DARK);
  grad.addColorStop(1, '#020611');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // شظايا/أجنحة هندسية شفافة على الجانبين
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = NAVY_ACCENT;
  const shardCount = 6;
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < shardCount; i++) {
      const baseX = W / 2 + side * (40 + i * 26);
      const baseY = H * 0.12 + i * (H * 0.75 / shardCount);
      const w = 60 - i * 4;
      const h = 20;
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.lineTo(baseX + side * w, baseY + h * 0.4);
      ctx.lineTo(baseX + side * (w * 0.6), baseY + h * 1.6);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();

  // إطار رفيع
  ctx.strokeStyle = NAVY_ACCENT_LIGHT;
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, W - 8, H - 8);

  // شعار Løst خافت بالخلفية
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 42px Cairo`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Løst', W / 2, H - 8);
  ctx.restore();
}

// ──────────────────────────────────────────────────────────────────
//  أيقونات مرسومة (بديل عن الإيموجي عشان نتجنب مشكلة صناديق الكود
//  لما الخط لا يدعم رموز الإيموجي على السيرفر)
//  الألوان قابلة للتخصيص عشان نقدر نستخدم ثيم كحلي أو أي ثيم ثاني
// ──────────────────────────────────────────────────────────────────
function drawBombIcon(ctx, cx, cy, size, accent = '#29b6f6', accentLight = '#7ec8ff') {
  const r = size * 0.42;
  ctx.save();
  const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  grad.addColorStop(0, '#3a3a3a');
  grad.addColorStop(1, '#0a0a0a');
  ctx.beginPath();
  ctx.fillStyle = grad;
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = accentLight;
  ctx.lineWidth = Math.max(2, size * 0.07);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.55, cy - r * 0.6);
  ctx.quadraticCurveTo(cx + r * 1.2, cy - r * 1.3, cx + r * 1.0, cy - r * 1.9);
  ctx.stroke();

  const sx = cx + r * 1.0, sy = cy - r * 1.9;
  ctx.fillStyle = accent;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const ang = (Math.PI / 4) * i;
    const rr = i % 2 === 0 ? size * 0.16 : size * 0.06;
    const px = sx + Math.cos(ang) * rr;
    const py = sy + Math.sin(ang) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawFireIcon(ctx, cx, cy, size, colors = ['#0091ea', '#29b6f6', '#80d8ff']) {
  ctx.save();
  ctx.translate(cx, cy);
  const w = size * 0.5, h = size * 0.65;
  const grad = ctx.createLinearGradient(0, h, 0, -h);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(0.55, colors[1]);
  grad.addColorStop(1, colors[2]);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.bezierCurveTo(w, h * 0.25, w * 0.55, -h * 0.35, 0, -h);
  ctx.bezierCurveTo(-w * 0.55, -h * 0.35, -w, h * 0.25, 0, h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawTimerIcon(ctx, cx, cy, size, accent = '#7ec8ff') {
  const r = size * 0.38;
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, size * 0.07);
  ctx.beginPath();
  ctx.arc(cx, cy + size * 0.06, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.12, cy - r - size * 0.1);
  ctx.lineTo(cx + size * 0.12, cy - r - size * 0.1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy + size * 0.06);
  ctx.lineTo(cx, cy + size * 0.06 - r * 0.6);
  ctx.moveTo(cx, cy + size * 0.06);
  ctx.lineTo(cx + r * 0.4, cy + size * 0.06 + r * 0.25);
  ctx.lineWidth = Math.max(2, size * 0.05);
  ctx.stroke();
  ctx.restore();
}

function drawTrophyIcon(ctx, cx, cy, size) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.moveTo(-size * 0.3, -size * 0.35);
  ctx.lineTo(size * 0.3, -size * 0.35);
  ctx.lineTo(size * 0.18, size * 0.15);
  ctx.lineTo(-size * 0.18, size * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = size * 0.07;
  ctx.beginPath();
  ctx.arc(-size * 0.36, -size * 0.2, size * 0.13, Math.PI * 0.2, Math.PI * 1.3);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(size * 0.36, -size * 0.2, size * 0.13, Math.PI * 1.7, Math.PI * 0.8, true);
  ctx.stroke();
  ctx.fillRect(-size * 0.1, size * 0.15, size * 0.2, size * 0.12);
  ctx.fillRect(-size * 0.18, size * 0.27, size * 0.36, size * 0.08);
  ctx.restore();
}

function drawBoomIcon(ctx, cx, cy, size) {
  ctx.save();
  ctx.translate(cx, cy);
  const spikes = 10;
  ctx.fillStyle = '#ff5500';
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const ang = (Math.PI / spikes) * i;
    const rr = i % 2 === 0 ? size * 0.42 : size * 0.2;
    const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffcc00';
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ──────────────────────────────────────────────────────────────────
//  صورة الكلمة / الجولة  (ثيم كحلي - الحروف بيضاء)
//  تُعرض في القناة كل جولة بدل الـ embed
// ──────────────────────────────────────────────────────────────────
async function generateWordImage({ first, last, holderName, holderAvatarUrl, round, roundSeconds, bannerUrl = null }) {
  const W = 700, H = 300;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // ── الخلفية ──
  // أولوية: بانر مخصص من إعدادات السيرفر، وإلا الخلفية الافتراضية، وإلا خلفية Løst المرسومة
  let hasImageBg = false;
  if (bannerUrl) {
    try {
      const buf = await fetchImageBuffer(bannerUrl);
      const img = await loadImage(buf);
      drawImageCover(ctx, img, 0, 0, W, H);
      hasImageBg = true;
    } catch (e) {}
  }
  if (!hasImageBg) {
    try {
      const img = await loadImage(DEFAULT_WORD_BG);
      drawImageCover(ctx, img, 0, 0, W, H);
      hasImageBg = true;
    } catch (e) {}
  }

  if (!hasImageBg) {
    // خلفية Løst مرسومة برمجياً (كحلي + شظايا + شعار خافت) بدل التدرج البسيط القديم
    drawLostBrandBackground(ctx, W, H);
  } else {
    // تعتيم خفيف جداً فقط لضمان وضوح النص، بدون كسر لون الخلفية
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(0, 0, W, H);
  }

  // ── أفاتار الحامل ──
  const avR = 48;
  const avX = 80;
  const avY = H / 2;
  try {
    const buf = await fetchImageBuffer(holderAvatarUrl);
    const img = await loadImage(buf);
    drawAvatarCover(ctx, img, avX, avY, avR);
    // حلقة كحلية فاتحة (تناسق مع الخلفية)
    ctx.beginPath();
    ctx.arc(avX, avY, avR + 3, 0, Math.PI * 2);
    ctx.strokeStyle = NAVY_ACCENT_LIGHT;
    ctx.lineWidth = 3;
    ctx.stroke();
  } catch (e) {
    ctx.beginPath();
    ctx.arc(avX, avY, avR, 0, Math.PI * 2);
    ctx.fillStyle = '#0d1b2a';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 28px Cairo`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((holderName || '?')[0], avX, avY);
  }

  // أيقونة القنبلة فوق الأفاتار
  drawBombIcon(ctx, avX, avY - avR - 30, 56, NAVY_ACCENT, NAVY_ACCENT_LIGHT);

  // ── النصوص ──
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.95)';
  ctx.shadowBlur = 12;

  // "الجولة X"
  ctx.fillStyle = NAVY_ACCENT_LIGHT;
  ctx.font = `bold 18px Cairo`;
  ctx.fillText(`الجولة ${round}`, W - 30, 35);

  // اسم الحامل (+ أيقونة نار كحلية بدل 🔥)
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 22px Cairo`;
  const holderLine = `القنبلة عند: ${holderName}`;
  const holderY = H / 2 - 50;
  ctx.fillText(holderLine, W - 30, holderY);
  const holderW = ctx.measureText(holderLine).width;
  ctx.shadowBlur = 0;
  drawFireIcon(ctx, W - 30 - holderW - 22, holderY, 34, ['#12305c', NAVY_ACCENT, NAVY_ACCENT_LIGHT]);
  ctx.shadowBlur = 12;

  // الحروف المطلوبة - أكبر شيء في الصورة (أبيض)
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 80px Cairo`;
  ctx.fillText(`${first}  —  ${last}`, W - 30, H / 2 + 10);

  // الوقت المتبقي (+ أيقونة مؤقت كحلية بدل ⏱️)
  ctx.fillStyle = NAVY_ACCENT_LIGHT;
  ctx.font = `bold 20px Cairo`;
  const timeLine = `${roundSeconds} ثانية`;
  const timeY = H / 2 + 75;
  ctx.fillText(timeLine, W - 30, timeY);
  const timeW = ctx.measureText(timeLine).width;
  ctx.shadowBlur = 0;
  drawTimerIcon(ctx, W - 30 - timeW - 20, timeY, 30, NAVY_ACCENT_LIGHT);

  return canvas.toBuffer('image/png');
}

// ──────────────────────────────────────────────────────────────────
//  صورة الفائز  (خلفية شعار Løst + الأفاتار داخل الدائرة)
// ──────────────────────────────────────────────────────────────────
async function generateBombWinnerImage(winner, bannerUrl = null) {
  const W = 700, H = 300;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // ── الخلفية ──
  // أولوية: بانر مخصص من إعدادات السيرفر، وإلا خلفية Løst الافتراضية، وإلا خلفية Løst مرسومة
  let hasImageBg = false;
  if (bannerUrl) {
    try {
      const buf = await fetchImageBuffer(bannerUrl);
      const img = await loadImage(buf);
      drawImageCover(ctx, img, 0, 0, W, H);
      hasImageBg = true;
    } catch (e) {}
  }
  if (!hasImageBg) {
    try {
      const img = await loadImage(DEFAULT_WINNER_BG);
      drawImageCover(ctx, img, 0, 0, W, H);
      hasImageBg = true;
    } catch (e) {}
  }

  if (!hasImageBg) {
    drawLostBrandBackground(ctx, W, H);
  }

  // ── أفاتار الفائز ──
  // ملاحظة: القيم تحت مضبوطة لتتماشى مع دائرة تصميم شعار Løst الافتراضي.
  // إذا استخدمت بانر فائز مخصص وما كانت الدائرة بمكانها بالضبط، عدّل avX/avY/avR هنا.
  const avR = 92;
  const avX = W / 2 + 45;   // 395 — تمت إزاحته يميناً ليطابق دائرة شعار Løst
  const avY = 122;          // تم رفعه ليتماشى مع الدائرة بالتصميم

  const avatarUrl = winner.avatarURL
    ? (typeof winner.avatarURL === 'function' ? winner.avatarURL({ size: 256, format: 'png' }) : winner.avatarURL)
    : `https://cdn.discordapp.com/embed/avatars/0.png`;

  try {
    const buf = await fetchImageBuffer(avatarUrl);
    const img = await loadImage(buf);
    drawAvatarCover(ctx, img, avX, avY, avR);
    // حلقة رفيعة فوق حدود الأفاتار (تتماشى مع خط الدائرة بالخلفية)
    ctx.beginPath();
    ctx.arc(avX, avY, avR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(150,180,220,0.6)';
    ctx.lineWidth = 3;
    ctx.stroke();
  } catch (e) {
    ctx.beginPath();
    ctx.arc(avX, avY, avR, 0, Math.PI * 2);
    ctx.fillStyle = '#0d1b2a';
    ctx.fill();
  }

  // ── النصوص - تحت الدائرة، فوق منطقة شعار "Løst" ──
  ctx.shadowColor = 'rgba(0,0,0,0.95)';
  ctx.shadowBlur = 12;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // "الفائز!"
  ctx.fillStyle = '#FFD700';
  ctx.font = `bold 22px Cairo`;
  const winLabel = 'الفائز!';
  const winLabelY = avY + avR + 26;
  ctx.fillText(winLabel, avX, winLabelY);

  // اسم الفائز
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 26px Cairo`;
  ctx.fillText(winner.displayName || winner.username || '؟', avX, winLabelY + 32);

  return canvas.toBuffer('image/png');
}

// ──────────────────────────────────────────────────────────────────
//  صورة اللوبي
//  لو الأدمن حاط بانر مخصص: نعرض صورته هو بس (بدون برواز، بدون نيون،
//  بدون أي نص فوقها) — تماماً الصورة اللي حطها.
//  لو ما فيه بانر مخصص (أو فشل تحميله): نستخدم الشكل الافتراضي القديم.
// ──────────────────────────────────────────────────────────────────
async function generateBombLobbyImage(bannerUrl = null) {
  const W = 700, H = 280;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  if (bannerUrl) {
    try {
      const buf = await fetchImageBuffer(bannerUrl);
      const img = await loadImage(buf);
      drawImageCover(ctx, img, 0, 0, W, H);
      return canvas.toBuffer('image/png');
    } catch (e) {
      // فشل تحميل البانر المخصص -> نكمل على الشكل الافتراضي بالأسفل
    }
  }

  // ── الشكل الافتراضي (بدون بانر مخصص) ──
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#ff3300';
  ctx.lineWidth = 3;
  ctx.strokeRect(5, 5, W - 10, H - 10);

  ctx.font = `bold 62px Cairo`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const lobbyLabel = 'تمرير القنبلة';
  const lobbyW = ctx.measureText(lobbyLabel).width;
  const iconSize = 60, gap = 18;
  const totalW = iconSize + gap + lobbyW;
  const startX = W / 2 - totalW / 2;

  ctx.shadowColor = 'rgba(255,50,0,0.6)';
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(lobbyLabel, startX + iconSize + gap, H / 2);
  ctx.shadowBlur = 0;
  drawBombIcon(ctx, startX + iconSize / 2, H / 2, iconSize);

  return canvas.toBuffer('image/png');
}

module.exports = { generateWordImage, generateBombWinnerImage, generateBombLobbyImage };
