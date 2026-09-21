const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

// mesmo sistema usado no Salve (src/qr.js): nivel de correcao de erro medio
// (~15% de tolerancia a sujeira/dano), gera SVG (hand-rolled, escala sem
// perder nitidez em qualquer tamanho) + PNG (resolucao alta o suficiente
// pra impressao) UMA UNICA VEZ e persiste em disco — depois da primeira
// geracao, sempre serve o MESMO arquivo, nunca recalcula. Garante que o QR
// nunca muda depois de impresso, mesmo que a lib "qrcode" mude de versao.
const ECC = 'M';
const SVG_SCALE = 8;
const SVG_MARGIN = 2;
const PNG_WIDTH = 512;

function encodeQr(text, ecc) {
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel: ecc || ECC });
    const { size } = qr.modules;
    const matrix = [];
    for (let r = 0; r < size; r++) {
      const row = [];
      for (let c = 0; c < size; c++) row.push(qr.modules.get(r, c) ? 1 : 0);
      matrix.push(row);
    }
    return { matrix, size };
  } catch (err) {
    return { error: err.message };
  }
}

function qrToSvg(text, { ecc, scale, margin, fg, bg } = {}) {
  const enc = encodeQr(text, ecc);
  if (!enc || enc.error) return '';
  const { matrix, size } = enc;
  const cell = Math.max(1, scale | 0);
  const m = Math.max(0, margin | 0);
  const view = (size + 2 * m) * cell;
  const origin = m * cell;
  let d = '';
  for (let r = 0; r < size; r++) {
    const y = (r + m) * cell;
    let c = 0;
    while (c < size) {
      while (c < size && !matrix[r][c]) c++;
      if (c >= size) break;
      const start = c;
      while (c < size && matrix[r][c]) c++;
      const w = (c - start) * cell;
      d += `M${origin + start * cell} ${y}h${w}v${cell}h-${w}z`;
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${view}" height="${view}" ` +
    `viewBox="0 0 ${view} ${view}" role="img" aria-label="QR Code">` +
    `<rect width="100%" height="100%" fill="${bg}"/>` +
    (d ? `<path d="${d}" fill="${fg}"/>` : '') +
    `</svg>`
  );
}

function qrDir() {
  return path.join(__dirname, '..', 'uploads', 'qrcodes');
}

// gera (uma unica vez, por codigo de link curto) e persiste o SVG/PNG —
// pra forcar regeracao (ex: mudou o dominio publico de verdade), e preciso
// apagar os arquivos manualmente em uploads/qrcodes/{codigo}.*
async function ensureQrFiles(codigo, text) {
  const dir = qrDir();
  fs.mkdirSync(dir, { recursive: true });
  const svgPath = path.join(dir, `${codigo}.svg`);
  const pngPath = path.join(dir, `${codigo}.png`);

  if (!fs.existsSync(svgPath)) {
    const svg = qrToSvg(text, { ecc: ECC, scale: SVG_SCALE, margin: SVG_MARGIN, fg: '#000000', bg: '#ffffff' });
    fs.writeFileSync(svgPath, svg, 'utf8');
  }
  if (!fs.existsSync(pngPath)) {
    const buffer = await QRCode.toBuffer(text, {
      errorCorrectionLevel: ECC,
      margin: SVG_MARGIN,
      width: PNG_WIDTH,
      color: { dark: '#000000ff', light: '#ffffffff' },
    });
    fs.writeFileSync(pngPath, buffer);
  }

  return { svgPath, pngPath };
}

module.exports = { qrToSvg, encodeQr, ensureQrFiles };
