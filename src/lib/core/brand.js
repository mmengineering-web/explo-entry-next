// Brand art: the login scene. A laterite profile (bands) with a drill core running through it and a depth ruler.
// Pure SVG string, no network, no images. Colors are fixed (the scene sits on its own dark ground in both themes).
const BANDS = [   // [top y, fill] top to bottom: topsoil, ferricrete, limonite, transition, saprolite, bedrock (one hue, tonal)
  [0, '#2b1710'], [92, '#5a2410'], [172, '#8f3612'], [282, '#b4552a'], [362, '#7a4a33'], [540, '#3a2218'],
];
const bandAt = y => [...BANDS].reverse().find(b => y >= b[0])[1];
const wave = (y, k) => `M0 ${y} C 70 ${y - 12 * k}, 130 ${y + 14 * k}, 200 ${y} S 330 ${y - 16 * k}, 400 ${y + 6 * k} S 450 ${y - 8 * k}, 480 ${y} V720 H0 Z`;

export function strataHero() {
  const bands = BANDS.map(([y, c], i) => i === 0 ? `<rect width="480" height="720" fill="${c}"/>` : `<path d="${wave(y, 1 + (i % 3) * .35)}" fill="${c}"/>`).join('');
  const grain = Array.from({ length: 9 }, (_, i) => { const y = 60 + i * 74; return `<path d="M0 ${y} C 90 ${y - 10}, 180 ${y + 12}, 290 ${y - 4} S 440 ${y + 8}, 480 ${y}" fill="none" stroke="#fff" stroke-opacity=".07" stroke-width="1.5"/>`; }).join('');
  const lens = [52, 40, 64, 46, 58, 48, 66, 44, 60, 50, 56];
  let y = 34;
  const segs = lens.map((h, i) => {
    const top = y; y += h + 7;
    const crack = i % 3 === 1 ? `<path d="M${304 + (i % 2) * 10} ${top + 8} l 30 ${h - 16}" stroke="#000" stroke-opacity=".32" stroke-width="1.4" stroke-linecap="round"/>` : '';
    return `<g class="sh-seg" style="--i:${i}"><rect x="298" y="${top}" width="64" height="${h}" rx="11" fill="${bandAt(top + h / 2)}" stroke="#000" stroke-opacity=".38" stroke-width="1.5"/><rect x="298" y="${top}" width="64" height="${h}" rx="11" fill="url(#sh-shade)"/>${crack}</g>`;
  }).join('');
  const ticks = Array.from({ length: 20 }, (_, i) => { const ty = 24 + i * 36; return `<path d="M${i % 2 ? 450 : 444} ${ty}h${i % 2 ? 8 : 14}" stroke="#fff" stroke-opacity=".5" stroke-width="1.4"/>${i % 2 ? '' : `<text x="438" y="${ty + 3.5}" text-anchor="end" fill="#fff" fill-opacity=".55" font-family="Geist Mono,ui-monospace,monospace" font-size="10">${i * 5} m</text>`}`; }).join('');
  return `<svg class="sh" viewBox="0 0 480 720" preserveAspectRatio="xMaxYMid slice" aria-hidden="true" focusable="false">
    <defs><linearGradient id="sh-shade" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset=".32" stop-color="#fff" stop-opacity="0"/><stop offset=".72" stop-color="#000" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity=".4"/></linearGradient></defs>
    <g class="sh-bands">${bands}${grain}</g>
    <path d="M458 14V710" stroke="#fff" stroke-opacity=".35" stroke-width="1.4"/>${ticks}
    <g class="sh-core">${segs}</g>
  </svg>`;
}
