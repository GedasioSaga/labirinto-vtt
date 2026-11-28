/**
 * A ARTE DA MESA DE LUZ (28/11): tudo em SVG como texto, desenhado pelo
 * navegador num `<img>` (fora da linha principal, como a bancada da mistura):
 * - a base do quadro (`urlDaMesa`): a parede, a moldura da mesa e o vidro
 *   fosco aceso por baixo, em nogueira e latão (vidro), carvalho de prancheta
 *   (papel) ou ferro rebitado (ferro);
 * - as figuras de fábrica e o código (`urlDaFigura`), num quadro de 100 x 100;
 * - a pele de cada lâmina (`urlDaPele`): o vidro com os veios de chumbo e o
 *   reflexo, o papel vegetal com a fibra e os furos, ou a grade de ferro com
 *   os rebites; as manchas; a marca gravada num canto.
 * A figura em si entra na lâmina recortada pelos cacos dela (`MesaDeLuz.tsx`
 * na tela, `raster.ts` no PNG do item), então a pele não leva a figura.
 *
 * Arte original do Labirinto; só a mecânica vem dos jogos (REFERENCIAS.md).
 */
import type { FiguraDasCamadas, MarcaDaLamina, MaterialDasCamadas } from '../tipos'
import type { Ponto } from './camadas'

export const LARGURA_DO_QUADRO = 1600
export const ALTURA_DO_QUADRO = 1000

/** O vidro da mesa, onde as lâminas pousam (em unidades do quadro). */
export const VIDRO_DA_MESA = { x: 120, y: 80, lado: 840 } as const
/** A coluna da pilha, à direita da mesa. */
export const COLUNA_DA_PILHA = { x: 1032, y: 80, largura: 488, altura: 840 } as const

const SVG = 'xmlns="http://www.w3.org/2000/svg"'

function emUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function n(valor: number): string {
  return String(Math.round(valor * 100) / 100)
}

function pontos(poligono: readonly Ponto[]): string {
  return poligono.map(([x, y]) => `${n(x)},${n(y)}`).join(' ')
}

/** Escapa o texto que vai dentro do SVG (o código do mestre). */
function escapar(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ------------------------------------------------------------------ as figuras (100 x 100)

function farol(): string {
  const estrelas = [
    [8, 8, 0.6], [34, 6, 0.8], [44, 15, 0.5], [76, 7, 0.7], [90, 12, 0.5], [84, 40, 0.6], [12, 44, 0.5], [30, 30, 0.6], [70, 46, 0.45], [94, 56, 0.5], [6, 60, 0.55],
  ]
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`)
    .join('')
  return `<svg ${SVG} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="ceu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1838"/><stop offset=".6" stop-color="#22407c"/><stop offset="1" stop-color="#346a96"/></linearGradient>
<radialGradient id="halo" cx="58" cy="31" r="30" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffe9a8" stop-opacity=".85"/><stop offset=".45" stop-color="#ffd98a" stop-opacity=".25"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>
<linearGradient id="mar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f7480"/><stop offset="1" stop-color="#0a2a38"/></linearGradient>
<linearGradient id="torre" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fbf7ec"/><stop offset=".7" stop-color="#e9e1cf"/><stop offset="1" stop-color="#bfb59f"/></linearGradient>
<mask id="crescente"><circle cx="20" cy="19" r="8" fill="#fff"/><circle cx="23.6" cy="16.2" r="7" fill="#000"/></mask>
</defs>
<rect width="100" height="100" fill="url(#ceu)"/>
<g fill="#fff3cf">${estrelas}</g>
<circle cx="20" cy="19" r="8" fill="#f7efc6" mask="url(#crescente)"/>
<path d="M58 31 L100 13 L100 33 Z" fill="#ffe39a" opacity=".5"/>
<path d="M58 31 L0 21 L0 39 Z" fill="#ffe39a" opacity=".32"/>
<circle cx="58" cy="31" r="30" fill="url(#halo)"/>
<path d="M18 46 q2.2 -2.2 4.4 0 q2.2 -2.2 4.4 0 M76 52 q1.8 -1.8 3.6 0 q1.8 -1.8 3.6 0" stroke="#0a1430" stroke-width=".9" fill="none" stroke-linecap="round"/>
<path d="M0 73 Q12.5 69 25 73 T50 73 T75 73 T100 73 V100 H0 Z" fill="url(#mar)"/>
<path d="M0 81 Q10 77.5 20 81 T40 81 T60 81 T80 81 T100 81" stroke="#69bdbf" stroke-width="1.3" fill="none" opacity=".75"/>
<path d="M0 89 Q12.5 86 25 89 T50 89 T75 89 T100 89" stroke="#3f939c" stroke-width="1.1" fill="none" opacity=".8"/>
<path d="M0 96 Q12.5 93.5 25 96 T50 96 T75 96 T100 96" stroke="#2c7480" stroke-width="1" fill="none" opacity=".8"/>
<path d="M54 75 h8 l1.4 3 h-10.8 z M52.6 84 h10.8 l1.2 2.6 h-13.2 z M53.4 92 h9.2 l.8 2 h-10.8 z" fill="#ffe39a" opacity=".55"/>
<path d="M32 79 L41 67 L50 63.6 L66 65 L74 72 L79 79 Z" fill="#33281f"/>
<path d="M41 67 L50 63.6 L55 69 L44.5 71.5 Z M66 65 L74 72 L67.5 71 Z" fill="#54443a"/>
<path d="M50 66 L53.5 38 L62.5 38 L66 66 Z" fill="url(#torre)"/>
<path d="M50.88 59 L50 66 L66 66 L65.12 59 Z M51.63 53 L52.5 46 L63.5 46 L64.37 53 Z" fill="#c03a2c"/>
<rect x="56.8" y="40.4" width="2.4" height="3.4" rx="1.2" fill="#2a2a32"/>
<rect x="56.8" y="55" width="2.4" height="3" rx="1.2" fill="#7c241b"/>
<rect x="51.2" y="35.4" width="13.6" height="2.8" rx=".6" fill="#2a2a32"/>
<rect x="54" y="26.8" width="8" height="8.8" fill="#ffd769"/>
<path d="M54 26.8 H62 V35.6 H54 Z M58 26.8 V35.6" fill="none" stroke="#2a2a32" stroke-width=".8"/>
<path d="M52.6 27 L58 20.6 L63.4 27 Z" fill="#9a2a21"/>
<circle cx="58" cy="19.8" r="1.05" fill="#2a2a32"/>
</svg>`
}

function rosa(): string {
  const tracos = Array.from({ length: 32 }, (_, i) => {
    const a = (i / 32) * Math.PI * 2
    const r1 = i % 4 === 0 ? 33.5 : 35.2
    return `<line x1="${n(50 + Math.cos(a) * r1)}" y1="${n(50 + Math.sin(a) * r1)}" x2="${n(50 + Math.cos(a) * 37.6)}" y2="${n(50 + Math.sin(a) * 37.6)}"/>`
  }).join('')
  /** Uma ponta da rosa: metade clara e metade escura, da ponta (raio `r`) à base (raio `b`, a `abre` radianos do eixo). */
  const ponta = (angulo: number, r: number, b: number, abre: number, clara: string, escura: string): string => {
    const tip: Ponto = [50 + Math.cos(angulo) * r, 50 + Math.sin(angulo) * r]
    const e: Ponto = [50 + Math.cos(angulo - abre) * b, 50 + Math.sin(angulo - abre) * b]
    const d: Ponto = [50 + Math.cos(angulo + abre) * b, 50 + Math.sin(angulo + abre) * b]
    return `<polygon points="${pontos([[50, 50], e, tip])}" fill="${clara}"/><polygon points="${pontos([[50, 50], tip, d])}" fill="${escura}"/>`
  }
  const menores = [1, 3, 5, 7].map((i) => ponta((i * Math.PI) / 4 - Math.PI / 2, 25, 6.5, Math.PI / 8, '#e8e2cf', '#7f99a8')).join('')
  const maiores = [0, 2, 4, 6].map((i) => ponta((i * Math.PI) / 4 - Math.PI / 2, 36, 8.6, Math.PI / 4, '#f0cf73', '#a8772a')).join('')
  const letra = (x: number, y: number, l: string) => `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central">${l}</text>`
  return `<svg ${SVG} viewBox="0 0 100 100">
<defs><radialGradient id="f" cx="50" cy="50" r="66" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#21604f"/><stop offset="1" stop-color="#0a241f"/></radialGradient></defs>
<rect width="100" height="100" fill="url(#f)"/>
<g fill="#c9a453" opacity=".55"><path d="M8 8 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2z M92 8 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2z M8 80 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2z M92 80 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2z"/></g>
<circle cx="50" cy="50" r="40.5" fill="#123c33" stroke="#c9a453" stroke-width="1.5"/>
<circle cx="50" cy="50" r="37.6" fill="none" stroke="#c9a453" stroke-width=".5"/>
<g stroke="#c9a453" stroke-width=".55">${tracos}</g>
<circle cx="50" cy="50" r="20" fill="none" stroke="#c9a453" stroke-width=".45" opacity=".8"/>
${menores}${maiores}
<circle cx="50" cy="50" r="5.2" fill="#7a1f1f" stroke="#f0cf73" stroke-width=".9"/>
<circle cx="50" cy="50" r="1.6" fill="#f0cf73"/>
<g font-family="Georgia, serif" font-size="7.4" font-weight="700" fill="#f0cf73">${letra(50, 5.4, 'N')}${letra(94.4, 50, 'L')}${letra(50, 94.6, 'S')}${letra(5.6, 50, 'O')}</g>
</svg>`
}

function chave(): string {
  const damasco = Array.from({ length: 64 }, (_, i) => {
    const x = (i % 8) * 12.5 + 6.25 + (Math.floor(i / 8) % 2) * 6.25
    const y = Math.floor(i / 8) * 12.5 + 6.25
    return `<path d="M${n(x)} ${n(y - 2.6)} l1.6 2.6 -1.6 2.6 -1.6 -2.6z"/>`
  }).join('')
  return `<svg ${SVG} viewBox="0 0 100 100">
<defs>
<linearGradient id="v" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#641326"/><stop offset="1" stop-color="#2a0710"/></linearGradient>
<linearGradient id="o" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbe7a1"/><stop offset=".45" stop-color="#d9a640"/><stop offset="1" stop-color="#875a18"/></linearGradient>
</defs>
<rect width="100" height="100" fill="url(#v)"/>
<g fill="#86263a" opacity=".85">${damasco}</g>
<g transform="rotate(-35 50 50)">
<circle cx="25" cy="50" r="13" fill="url(#o)"/>
<circle cx="25" cy="50" r="8" fill="#3d0b17"/>
<g fill="url(#o)"><circle cx="25" cy="46.2" r="2.8"/><circle cx="25" cy="53.8" r="2.8"/><circle cx="21.2" cy="50" r="2.8"/><circle cx="28.8" cy="50" r="2.8"/></g>
<circle cx="25" cy="50" r="1.5" fill="#3d0b17"/>
<rect x="36.4" y="45.6" width="5.6" height="8.8" rx="1.4" fill="url(#o)"/>
<rect x="41" y="47.9" width="42" height="4.2" rx="2" fill="url(#o)"/>
<rect x="49" y="46.4" width="2.2" height="7.2" rx=".9" fill="#b7842c"/>
<rect x="55" y="46.4" width="2.2" height="7.2" rx=".9" fill="#b7842c"/>
<path d="M68 51.8 H83 V64 H78.6 V59 H75.4 V64 H71.2 V57 H68 Z" fill="url(#o)"/>
<circle cx="83" cy="50" r="2.6" fill="url(#o)"/>
<rect x="43" y="48.5" width="38" height="1" rx=".5" fill="#fff4c8" opacity=".75"/>
<path d="M17 42 A11 11 0 0 1 31 40" stroke="#fff4c8" stroke-width=".9" fill="none" opacity=".7" stroke-linecap="round"/>
</g>
</svg>`
}

function mariposa(): string {
  return `<svg ${SVG} viewBox="0 0 100 100">
<defs>
<radialGradient id="noite" cx="50" cy="46" r="72" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#40305f"/><stop offset="1" stop-color="#120b20"/></radialGradient>
<linearGradient id="asa1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0b34a"/><stop offset="1" stop-color="#a5481f"/></linearGradient>
<linearGradient id="asa2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8e3520"/><stop offset="1" stop-color="#4d1b16"/></linearGradient>
<g id="metade">
<path d="M48 44 C38 25 17 17 7 25 C3 36 13 49 30 52.5 C38 53.6 45 50.6 48 47 Z" fill="url(#asa1)"/>
<path d="M47 46 C38 37 26 29.5 13.5 26.5 M46.4 47 C37 44 24 41 11 41.5 M46 48.4 C38 49.4 29 50 20 48" stroke="#6a2a14" stroke-width=".8" fill="none"/>
<circle cx="23.5" cy="34" r="6.4" fill="#f5ecd2"/><circle cx="23.5" cy="34" r="3.8" fill="#1e1432"/><circle cx="24.8" cy="32.6" r="1.1" fill="#fff"/>
<path d="M48 52 C40 54 25.5 60 21.5 72 C21 83 34 85.5 42 75 C46.4 69 48 61 48 55 Z" fill="url(#asa2)"/>
<circle cx="33" cy="70.5" r="3.6" fill="#f0b34a"/><circle cx="33" cy="70.5" r="1.4" fill="#1e1432"/>
<path d="M47 36 C45 28 41 23.5 36 21.5" stroke="#2f1d12" stroke-width="1" fill="none" stroke-linecap="round"/>
</g>
</defs>
<rect width="100" height="100" fill="url(#noite)"/>
<circle cx="50" cy="46" r="36" fill="#f6e6b8" opacity=".09"/>
<g fill="#f6e6b8" opacity=".8"><circle cx="10" cy="10" r=".7"/><circle cx="88" cy="14" r=".6"/><circle cx="80" cy="88" r=".7"/><circle cx="14" cy="90" r=".6"/><circle cx="50" cy="6" r=".5"/><circle cx="94" cy="62" r=".5"/><circle cx="6" cy="58" r=".5"/></g>
<use href="#metade"/>
<use href="#metade" transform="translate(100 0) scale(-1 1)"/>
<ellipse cx="50" cy="53" rx="2.8" ry="13.5" fill="#3a2414"/>
<path d="M48.2 47 h3.6 M48 52 h4 M48.2 57 h3.6" stroke="#5b3a22" stroke-width=".7"/>
<circle cx="50" cy="38.6" r="3.2" fill="#3a2414"/>
</svg>`
}

function codigo(texto: string): string {
  const letras = texto === '' ? '?' : texto
  const tamanho = letras.length <= 2 ? 46 : letras.length <= 4 ? 30 : 22
  return `<svg ${SVG} viewBox="0 0 100 100">
<defs><linearGradient id="p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#303a48"/><stop offset="1" stop-color="#131820"/></linearGradient>
<linearGradient id="ouro" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0c2"/><stop offset="1" stop-color="#d8b062"/></linearGradient></defs>
<rect width="100" height="100" fill="url(#p)"/>
<g fill="none" stroke="#c9a453"><rect x="6.5" y="6.5" width="87" height="87" rx="3" stroke-width="1.4"/><rect x="10" y="10" width="80" height="80" rx="2" stroke-width=".5" opacity=".7"/></g>
<g fill="#c9a453"><path d="M50 3.6 l2.6 2.9 -2.6 2.9 -2.6 -2.9z M50 90.6 l2.6 2.9 -2.6 2.9 -2.6 -2.9z M3.6 50 l2.9 -2.6 2.9 2.6 -2.9 2.6z M90.6 50 l2.9 -2.6 2.9 2.6 -2.9 2.6z"/></g>
<path d="M22 24 H78 M22 76 H78" stroke="#c9a453" stroke-width=".6" opacity=".6"/>
<text x="50" y="51" text-anchor="middle" dominant-baseline="central" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="${tamanho}" letter-spacing="1.2" fill="url(#ouro)" stroke="#5c4214" stroke-width=".7" paint-order="stroke">${escapar(letras)}</text>
</svg>`
}

const figuras = new Map<string, string>()

/** A figura de fábrica ou o código como URL de imagem (100 x 100). `null` na imagem do mestre (vem da mídia). */
export function urlDaFigura(figura: FiguraDasCamadas, texto: string): string | null {
  if (figura === 'imagem') return null
  const guardada = figura === 'codigo' ? `codigo|${texto}` : figura
  const pronta = figuras.get(guardada)
  if (pronta !== undefined) return pronta
  const svg = figura === 'farol' ? farol() : figura === 'rosa' ? rosa() : figura === 'chave' ? chave() : figura === 'mariposa' ? mariposa() : codigo(texto)
  const url = emUrl(svg)
  figuras.set(guardada, url)
  return url
}

// ------------------------------------------------------------------ a marca gravada no canto da lâmina

function marca(qual: MarcaDaLamina): string {
  switch (qual) {
    case 'sol':
      return '<circle cx="3" cy="3" r="1.3"/><path d="M3 0 V.9 M3 5.1 V6 M0 3 H.9 M5.1 3 H6 M.9 .9 L1.5 1.5 M4.5 4.5 L5.1 5.1 M5.1 .9 L4.5 1.5 M1.5 4.5 L.9 5.1" fill="none"/>'
    case 'lua':
      return '<path d="M4.2 .5 A2.8 2.8 0 1 0 4.2 5.5 A2.2 2.2 0 1 1 4.2 .5 Z"/>'
    case 'estrela':
      return '<polygon points="3,.2 3.8,2.2 5.9,2.3 4.3,3.6 4.8,5.7 3,4.5 1.2,5.7 1.7,3.6 .1,2.3 2.2,2.2"/>'
    case 'olho':
      return '<path d="M.2 3 Q3 -.4 5.8 3 Q3 6.4 .2 3 Z" fill="none"/><circle cx="3" cy="3" r="1.1"/>'
    case 'coroa':
      return '<path d="M.4 5 L.6 1.4 L1.9 3 L3 .6 L4.1 3 L5.4 1.4 L5.6 5 Z"/>'
  }
}

const CANTOS: readonly Ponto[] = [
  [4.2, 4.2],
  [89.8, 4.2],
  [89.8, 89.8],
  [4.2, 89.8],
]

function marcaNoCanto(qual: MarcaDaLamina, canto: number, cor: string, traco: number): string {
  const [x, y] = CANTOS[canto % 4] ?? [4.2, 4.2]
  return `<g transform="translate(${x} ${y})" fill="${cor}" stroke="${cor}" stroke-width="${traco}" stroke-linecap="round" stroke-linejoin="round">${marca(qual)}</g>`
}

// ------------------------------------------------------------------ a pele de cada lâmina

export interface DesenhoDaPele {
  material: MaterialDasCamadas
  cacos: readonly (readonly Ponto[])[]
  meus: readonly number[]
  manchas: readonly number[]
  marca: MarcaDaLamina
  canto: number
}

function poligonosDe(cacos: DesenhoDaPele['cacos'], indices: readonly number[], atributos: string): string {
  return indices
    .map((i) => cacos[i])
    .filter((caco): caco is readonly Ponto[] => caco !== undefined)
    .map((caco) => `<polygon points="${pontos(caco)}" ${atributos}/>`)
    .join('')
}

function centro(caco: readonly Ponto[]): Ponto {
  const soma = caco.reduce<[number, number]>((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0])
  return [soma[0] / Math.max(1, caco.length), soma[1] / Math.max(1, caco.length)]
}

function peleDeVidro(d: DesenhoDaPele): string {
  const todos = [...d.meus, ...d.manchas]
  return `<defs>
<linearGradient id="brilho" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".43" stop-color="#fff" stop-opacity="0"/><stop offset=".49" stop-color="#fff" stop-opacity=".2"/><stop offset=".53" stop-color="#fff" stop-opacity=".06"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<pattern id="fumo" width="3.4" height="3.4" patternUnits="userSpaceOnUse" patternTransform="rotate(28)"><rect width="3.4" height="3.4" fill="#2a1f15"/><rect width="3.4" height="1" fill="#3e2e1f"/></pattern>
</defs>
<rect width="100" height="100" fill="#d4ece6" fill-opacity=".07"/>
${poligonosDe(d.cacos, d.manchas, 'fill="url(#fumo)" fill-opacity=".96"')}
${poligonosDe(d.cacos, todos, 'fill="none" stroke="#23252a" stroke-width="1.25" stroke-linejoin="round"')}
${poligonosDe(d.cacos, todos, 'fill="none" stroke="#fff" stroke-opacity=".16" stroke-width=".35" stroke-linejoin="round"')}
<rect width="100" height="100" fill="url(#brilho)"/>
<g fill="none" stroke="#fff" stroke-opacity=".28" stroke-width=".3"><circle cx="17" cy="71" r=".9"/><circle cx="19.4" cy="73.2" r=".5"/><circle cx="72" cy="22" r=".7"/><circle cx="63" cy="83" r=".6"/></g>
<rect x=".6" y=".6" width="98.8" height="98.8" rx="1.4" fill="none" stroke="#c6efe4" stroke-opacity=".6" stroke-width="1.2"/>
<rect x="1.7" y="1.7" width="96.6" height="96.6" rx="1" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width=".4"/>
${marcaNoCanto(d.marca, d.canto, 'rgba(255,255,255,0.62)', 0.35)}`
}

function peleDePapel(d: DesenhoDaPele): string {
  return `<defs>
<filter id="fibra" x="0" y="0" width="100" height="100" filterUnits="userSpaceOnUse"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 .52  0 0 0 0 .44  0 0 0 0 .33  0 0 0 .2 0"/></filter>
<pattern id="borrao" width="2.6" height="2.6" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)"><rect width="2.6" height="2.6" fill="#2d2118"/><rect width="2.6" height=".7" fill="#4a3727"/></pattern>
</defs>
<rect width="100" height="100" fill="#f7f1e2" fill-opacity=".2"/>
<rect width="100" height="100" filter="url(#fibra)"/>
${poligonosDe(d.cacos, d.manchas, 'fill="url(#borrao)" fill-opacity=".94" stroke="#2d2118" stroke-width=".6" stroke-linejoin="round"')}
<rect x=".4" y=".4" width="99.2" height="99.2" fill="none" stroke="#7a5a32" stroke-opacity=".42" stroke-width=".7"/>
<g fill="#2a1e14" fill-opacity=".55" stroke="#fffaf0" stroke-opacity=".5" stroke-width=".3"><circle cx="4" cy="4" r="1.3"/><circle cx="96" cy="4" r="1.3"/><circle cx="96" cy="96" r="1.3"/><circle cx="4" cy="96" r="1.3"/></g>
${marcaNoCanto(d.marca, d.canto, '#5a3d20', 0.4)}`
}

function peleDeFerro(d: DesenhoDaPele): string {
  const todos = [...d.meus, ...d.manchas]
  const vistos = new Set<string>()
  const rebites = todos
    .flatMap((i) => d.cacos[i] ?? [])
    .filter(([x, y]) => {
      const chave = `${Math.round(x * 10)}|${Math.round(y * 10)}`
      if (vistos.has(chave) || x < 2 || y < 2 || x > 98 || y > 98) return false
      vistos.add(chave)
      return true
    })
    .map(([x, y]) => `<circle cx="${n(x)}" cy="${n(y)}" r=".85"/>`)
    .join('')
  const naMancha = d.manchas
    .map((i) => d.cacos[i])
    .filter((caco): caco is readonly Ponto[] => caco !== undefined)
    .map((caco) => {
      const [x, y] = centro(caco)
      return `<circle cx="${n(x)}" cy="${n(y)}" r="4.2" fill="url(#ferrugem)"/><circle cx="${n(x)}" cy="${n(y)}" r="1" fill="#3e4147" stroke="#111214" stroke-width=".3"/>`
    })
    .join('')
  return `<defs>
<linearGradient id="fe" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4c5056"/><stop offset="1" stop-color="#1d1f22"/></linearGradient>
<radialGradient id="ferrugem"><stop offset="0" stop-color="#8f4c22" stop-opacity=".6"/><stop offset="1" stop-color="#8f4c22" stop-opacity="0"/></radialGradient>
</defs>
${poligonosDe(d.cacos, d.manchas, 'fill="url(#fe)"')}
${naMancha}
${poligonosDe(d.cacos, todos, 'fill="none" stroke="#1a1c1f" stroke-width="2.1" stroke-linejoin="round"')}
${poligonosDe(d.cacos, todos, 'fill="none" stroke="#fff" stroke-opacity=".13" stroke-width=".5" stroke-linejoin="round"')}
<g fill="#3d4046" stroke="#111214" stroke-width=".25">${rebites}</g>
<rect x="1.4" y="1.4" width="97.2" height="97.2" fill="none" stroke="url(#fe)" stroke-width="2.8"/>
<g fill="#4b4f55" stroke="#111214" stroke-width=".3"><circle cx="2.6" cy="2.6" r="1.2"/><circle cx="97.4" cy="2.6" r="1.2"/><circle cx="97.4" cy="97.4" r="1.2"/><circle cx="2.6" cy="97.4" r="1.2"/><circle cx="50" cy="1.4" r="1"/><circle cx="98.6" cy="50" r="1"/><circle cx="50" cy="98.6" r="1"/><circle cx="1.4" cy="50" r="1"/></g>
${marcaNoCanto(d.marca, d.canto, '#d0ac5a', 0.4)}`
}

const peles = new Map<string, string>()

/** A pele da lâmina (sem a figura) como URL de imagem, guardada pelo desenho. */
export function urlDaPele(d: DesenhoDaPele): string {
  const chave = `${d.material}|${d.meus.join('.')}|${d.manchas.join('.')}|${d.marca}|${d.canto}|${d.cacos.length}|${pontos(d.cacos[0] ?? [])}`
  const pronta = peles.get(chave)
  if (pronta !== undefined) return pronta
  const miolo = d.material === 'papel' ? peleDePapel(d) : d.material === 'ferro' ? peleDeFerro(d) : peleDeVidro(d)
  const url = emUrl(`<svg ${SVG} viewBox="0 0 100 100">${miolo}</svg>`)
  peles.set(chave, url)
  return url
}

/** O contorno dos cacos como caminho (o recorte da figura): um `d` de SVG, ou um Path2D no canvas. */
export function caminhoDosCacos(cacos: readonly (readonly Ponto[])[], indices: readonly number[], escala = 1): string {
  return indices
    .map((i) => cacos[i])
    .filter((caco): caco is readonly Ponto[] => caco !== undefined && caco.length > 2)
    .map((caco) => `M${caco.map(([x, y]) => `${n(x * escala)} ${n(y * escala)}`).join(' L')} Z`)
    .join(' ')
}

// ------------------------------------------------------------------ a base: a parede e a mesa de luz

const MOLDURA: Readonly<Record<MaterialDasCamadas, { clara: string; escura: string; canto: string; borda: string }>> = {
  vidro: { clara: '#6a4327', escura: '#2e1b10', canto: '#c9a453', borda: '#8f6a2c' },
  papel: { clara: '#b48d5b', escura: '#6b4d2c', canto: '#c9a453', borda: '#8a6a3c' },
  ferro: { clara: '#55595f', escura: '#1c1e21', canto: '#7b7f86', borda: '#3a3d42' },
}

const mesas = new Map<MaterialDasCamadas, string>()

export function urlDaMesa(material: MaterialDasCamadas): string {
  const pronta = mesas.get(material)
  if (pronta !== undefined) return pronta
  const m = MOLDURA[material]
  const { x, y, lado } = VIDRO_DA_MESA
  const col = COLUNA_DA_PILHA
  const borda = 34
  const tabuas = Array.from({ length: 9 }, (_, i) => `<rect x="${i * 180}" y="0" width="2" height="1000" fill="#000" opacity=".22"/>`).join('')
  const rebites =
    material === 'ferro'
      ? Array.from({ length: 12 }, (_, i) => {
          const t = i / 11
          const px = x - borda / 2 + t * (lado + borda)
          return `<circle cx="${n(px)}" cy="${y - borda / 2}" r="4.2"/><circle cx="${n(px)}" cy="${y + lado + borda / 2}" r="4.2"/><circle cx="${x - borda / 2}" cy="${n(y - borda / 2 + t * (lado + borda))}" r="4.2"/><circle cx="${x + lado + borda / 2}" cy="${n(y - borda / 2 + t * (lado + borda))}" r="4.2"/>`
        }).join('')
      : ''
  const cantoneiras =
    material === 'ferro'
      ? ''
      : [
          [x - borda, y - borda, 1, 1],
          [x + lado + borda, y - borda, -1, 1],
          [x + lado + borda, y + lado + borda, -1, -1],
          [x - borda, y + lado + borda, 1, -1],
        ]
          .map(([cx = 0, cy = 0, sx = 1, sy = 1]) => `<path d="M${cx} ${cy} h${sx * 92} v${sy * 14} h${-sx * 78} v${sy * 78} h${-sx * 14} Z" fill="${m.canto}" stroke="#5a4214" stroke-width="2"/><circle cx="${cx + sx * 8}" cy="${cy + sy * 8}" r="3.4" fill="#7a5a1c"/>`)
          .join('')
  const svg = `<svg ${SVG} viewBox="0 0 ${LARGURA_DO_QUADRO} ${ALTURA_DO_QUADRO}">
<defs>
<linearGradient id="parede" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d1611"/><stop offset="1" stop-color="#0c0907"/></linearGradient>
<linearGradient id="moldura" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${m.clara}"/><stop offset="1" stop-color="${m.escura}"/></linearGradient>
<radialGradient id="luz" cx="${x + lado / 2}" cy="${y + lado / 2}" r="${lado * 0.72}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fffaee"/><stop offset=".62" stop-color="#f6e7c2"/><stop offset="1" stop-color="#dcc28c"/></radialGradient>
<radialGradient id="derrame" cx="${x + lado / 2}" cy="${y + lado / 2}" r="${lado * 0.8}" gradientUnits="userSpaceOnUse"><stop offset=".55" stop-color="#ffd98a" stop-opacity=".24"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>
<filter id="fosco" x="${x}" y="${y}" width="${lado}" height="${lado}" filterUnits="userSpaceOnUse"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 .6  0 0 0 0 .52  0 0 0 0 .38  0 0 0 .12 0"/></filter>
</defs>
<rect width="${LARGURA_DO_QUADRO}" height="${ALTURA_DO_QUADRO}" fill="url(#parede)"/>
${tabuas}
<rect x="${x - 120}" y="${y - 120}" width="${lado + 240}" height="${lado + 240}" fill="url(#derrame)"/>
<rect x="${x - borda}" y="${y - borda}" width="${lado + borda * 2}" height="${lado + borda * 2}" rx="10" fill="url(#moldura)" stroke="${m.borda}" stroke-width="3"/>
<rect x="${x - 6}" y="${y - 6}" width="${lado + 12}" height="${lado + 12}" fill="#120c08"/>
<rect x="${x}" y="${y}" width="${lado}" height="${lado}" fill="url(#luz)"/>
<rect x="${x}" y="${y}" width="${lado}" height="${lado}" filter="url(#fosco)"/>
<g fill="${material === 'ferro' ? '#5a5e64' : '#2a1d12'}" stroke="#0e0a07" stroke-width="2">${rebites}</g>
${cantoneiras}
<rect x="${col.x}" y="${col.y}" width="${col.largura}" height="${col.altura}" rx="14" fill="#000" fill-opacity=".38" stroke="${m.borda}" stroke-opacity=".7" stroke-width="2"/>
<rect x="${col.x + 10}" y="${col.y + 10}" width="${col.largura - 20}" height="${col.altura - 20}" rx="10" fill="none" stroke="#fff" stroke-opacity=".05" stroke-width="2"/>
</svg>`
  const url = emUrl(svg)
  mesas.set(material, url)
  return url
}
