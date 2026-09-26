import type { MapData, MapLine, MapMarker, Region, RegionPoint, Wall } from '../types/map'
import type { ClueEntry, NoteEntry } from '../net/protocol'
import { buildFloorOutline } from '../lib/floorContour'
import { forEachExploredRun, type Exploration } from '../lib/exploration'

/**
 * LEVAR O MAPA E O CADERNO PARA CASA. A página do jogador só existe enquanto o
 * app do mestre está aberto na LAN; entre as sessões não sobra nada. O botão
 * "Baixar meu caderno" gera, NO APARELHO DO JOGADOR, um `.html` único que abre
 * sem rede: um mapa por cena que ele conhece, as pistas e os recados.
 *
 * Nada é pedido ao host. Tudo sai do que o recorte (`lib/fogFilter.ts`) já
 * entregou a este jogador — o nome da cena nunca chegou (`name: ''`), então a
 * cena é "Cena 1", "Cena 2", na ordem em que ele chegou nela. Da cena guardada
 * fica só a PLANTA (chão, salas, paredes, portas, traços) e as fichas DELE:
 * ficha alheia, objeto, luz e pino mudam de lugar, e uma posição velha de
 * outra cena no arquivo seria dizer onde alguém estava sem ele ver.
 */

/** A planta da cena como o recorte a mandou: só o estático. */
export type PlantaLembrada = Pick<MapData, 'width' | 'height' | 'grid' | 'background' | 'floor' | 'floorStyle' | 'regions' | 'walls' | 'lines' | 'markers'>

/** Uma cena que o jogador conhece, com a última memória que o host mandou dela. */
export interface CenaLembrada {
  /** Só para achar a cena de novo na volta; nunca vai para o arquivo. */
  mapId: string
  planta: PlantaLembrada
  explored: Exploration | undefined
  /**
   * Visão do último snapshot, SÓ da cena em que ele está agora. Ao sair ela
   * zera: o pedaço de zona que o pincel mostrava "não vira memória"
   * (`fogFilter.ts`, `sentVision`), e o arquivo segue a mesma regra.
   */
  vision: RegionPoint[][]
  /** Zonas ocultas ativas: preto por cima, como na tela. */
  concealed: RegionPoint[][]
  /** Onde as fichas DELE estavam na última vez que ele viu esta cena. */
  minhasFichas: { x: number; y: number; size: number }[]
  /** A cena do último snapshot: onde ele está (ou estava quando a sala fechou). Só uma é. */
  atual: boolean
}

/** O que chega num snapshot, do jeito que `playerConnection` já tem. */
export interface SnapshotDaCena {
  map: MapData
  vision: RegionPoint[][]
  explored: Exploration | undefined
  concealed: RegionPoint[][]
  ownTokens: readonly string[]
}

/** Teto de cenas guardadas no aparelho: passou, sai a mais antiga. Uma torre de 12 andares cabe com folga. */
export const CADERNO_MAX_CENAS = 40

const SEM_VISAO: RegionPoint[][] = []

/**
 * Guarda (ou atualiza) a cena do snapshot. A ordem é a da PRIMEIRA chegada:
 * voltar à Cena 1 não a renumera. As outras cenas perdem a visão ao vivo.
 * Snapshot sem memória (`explored` ausente) mantém a que já estava guardada.
 */
export function lembrarCena(cenas: readonly CenaLembrada[], snap: SnapshotDaCena): CenaLembrada[] {
  const { map } = snap
  const anterior = cenas.find((c) => c.mapId === map.id)
  const donas = new Set(snap.ownTokens)
  const cena: CenaLembrada = {
    mapId: map.id,
    planta: {
      width: map.width,
      height: map.height,
      grid: map.grid,
      background: map.background,
      floor: map.floor,
      floorStyle: map.floorStyle,
      regions: map.regions,
      walls: map.walls,
      lines: map.lines,
      markers: map.markers,
    },
    explored: snap.explored ?? anterior?.explored,
    vision: snap.vision,
    concealed: snap.concealed,
    minhasFichas: map.tokens.filter((t) => donas.has(t.id)).map((t) => ({ x: t.x, y: t.y, size: t.size })),
    atual: true,
  }
  const outras = cenas.map((c) => (c.mapId === map.id || (!c.atual && c.vision.length === 0) ? c : { ...c, vision: SEM_VISAO, atual: false }))
  const lista = anterior === undefined ? [...outras, cena] : outras.map((c) => (c.mapId === map.id ? cena : c))
  return lista.length > CADERNO_MAX_CENAS ? lista.slice(lista.length - CADERNO_MAX_CENAS) : lista
}

export interface EntradaDoCaderno {
  cenas: readonly CenaLembrada[]
  pistas: readonly ClueEntry[]
  recados: readonly NoteEntry[]
  /** Nome do personagem (ou o que ele digitou ao entrar): título e nome do arquivo. */
  personagem: string
  geradoEm: Date
}

/** "Caio - meu caderno - 24-09-2026.html", sem o que o Windows recusa em nome de arquivo. */
export function nomeDoArquivoDoCaderno(personagem: string, geradoEm: Date): string {
  const limpo = Array.from(personagem)
    .filter((char) => char.charCodeAt(0) >= 32 && !'<>:"/\\|?*'.includes(char))
    .join('')
    .trim()
    .replace(/[. ]+$/, '')
  const dia = `${doisDigitos(geradoEm.getDate())}-${doisDigitos(geradoEm.getMonth() + 1)}-${geradoEm.getFullYear()}`
  return `${limpo === '' ? 'Meu caderno' : `${limpo} - meu caderno`} - ${dia}.html`
}

/**
 * O arquivo inteiro. Sem script e sem endereço de fora: a política de conteúdo
 * só deixa imagem em `data:` e o estilo embutido, então ele abre igual sem
 * rede, anos depois. Todo texto que veio da mesa entra escapado.
 */
export function montarCaderno(entrada: EntradaDoCaderno): string {
  const titulo = entrada.personagem.trim() === '' ? 'Meu caderno' : `Caderno de ${entrada.personagem.trim()}`
  const quando = dataEHora(entrada.geradoEm.getTime(), ' às ')
  const cenas = entrada.cenas.map((cena, i) => secaoDaCena(cena, i, cena.atual)).join('\n')
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<style>${ESTILO}</style>
</head>
<body>
<header><h1>${esc(titulo)}</h1><p class="meta">Guardado em ${esc(quando)}. Só o que você viu e leu na mesa.</p></header>
<section><h2>Mapas</h2>
${entrada.cenas.length === 0 ? '<p class="vazio">Nenhuma cena explorada ainda.</p>' : cenas}
</section>
<section><h2>Pistas</h2>
${listaDePistas(entrada.pistas)}
</section>
<section><h2>Recados</h2>
${listaDeRecados(entrada.recados)}
</section>
</body>
</html>
`
}

/** Baixa o arquivo pelo próprio navegador do jogador. */
export function baixarArquivoHtml(html: string, nomeDoArquivo: string): void {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = nomeDoArquivo
  link.click()
  // Soltar o blob no mesmo tique cancela o download em alguns navegadores.
  setTimeout(() => URL.revokeObjectURL(url), SOLTAR_BLOB_MS)
}

const SOLTAR_BLOB_MS = 1000

// ---------------------------------------------------------------------------
// Mapa de uma cena em SVG, no estilo minimapa: chão chapado, parede em linha
// fina clara, porta como retângulo pequeno, sem grade. Fora do que ele conhece,
// preto — o recorte `clipPath` é a mesma máscara da névoa do `PlayerView`
// (anéis lembrados + células exploradas + visão atual).
// ---------------------------------------------------------------------------

/** Cor da parede: linha fina clara (nunca preta e grossa). */
const COR_PAREDE = '#d9dde2'
const COR_PORTA = '#bfc5cc'
const COR_FICHA = '#4da3ff'
const COR_NOME = '#f1f3f5'
/** Folga em volta do conhecido, em px de mundo, para o mapa não encostar na borda. */
const MARGEM_PX = 24
/** Amostragem do contorno do chão: um pouco mais grossa que a da tela, o arquivo não precisa do detalhe de 2 px. */
const PASSO_DO_CHAO = 3
/** Espessura da parede em fração da casa, com piso em px. */
const PAREDE_POR_CASA = 0.05
const PAREDE_MIN_PX = 1.5
const PORTA_POR_CASA = 0.2
const NOME_POR_CASA = 0.32
const NOME_MIN_PX = 10

function secaoDaCena(cena: CenaLembrada, indice: number, atual: boolean): string {
  const nome = `Cena ${indice + 1}`
  const rotulo = atual ? `${nome} <span class="aqui">onde você está</span>` : nome
  const svg = mapaDaCena(cena, `k${indice}`, nome)
  return `<figure class="cena"><figcaption>${rotulo}</figcaption>${svg ?? '<p class="vazio">Nada explorado nesta cena.</p>'}</figure>`
}

interface Caixa {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** O SVG da cena, ou `null` quando ele não conhece nada dela. */
export function mapaDaCena(cena: CenaLembrada, idDoRecorte: string, nomeAcessivel: string): string | null {
  const { planta } = cena
  const conhecido = recorteConhecido(cena)
  if (conhecido.caixa === null) return null
  const larguraMundo = planta.width * planta.grid
  const alturaMundo = planta.height * planta.grid
  const minX = Math.max(0, conhecido.caixa.minX - MARGEM_PX)
  const minY = Math.max(0, conhecido.caixa.minY - MARGEM_PX)
  const maxX = Math.min(larguraMundo, conhecido.caixa.maxX + MARGEM_PX)
  const maxY = Math.min(alturaMundo, conhecido.caixa.maxY + MARGEM_PX)
  const w = Math.max(1, maxX - minX)
  const h = Math.max(1, maxY - minY)
  const casa = planta.grid > 0 ? planta.grid : 50
  const parede = Math.max(PAREDE_MIN_PX, casa * PAREDE_POR_CASA)
  const fundo = planta.background.type === 'color' ? cor(planta.background.src, '#1b1d20') : '#1b1d20'

  const camadas = [
    `<rect x="${n(minX)}" y="${n(minY)}" width="${n(w)}" height="${n(h)}" fill="${fundo}"/>`,
    chaoSvg(planta, parede),
    planta.regions.map((r) => salaSvg(r, parede)).join(''),
    planta.lines.map(tracoSvg).join(''),
    planta.walls.map((wall) => paredeSvg(wall, parede, casa)).join(''),
    planta.markers.map(marcadorSvg).join(''),
    cena.concealed.filter((p) => p.length >= 3).map((p) => `<polygon points="${pontos(p)}" fill="#000"/>`).join(''),
    cena.minhasFichas
      .map((f) => `<circle cx="${n(f.x)}" cy="${n(f.y)}" r="${n((casa * Math.max(0.2, f.size)) / 2.6)}" fill="${COR_FICHA}" stroke="#fff" stroke-width="${n(parede)}"/>`)
      .join(''),
    planta.regions.map((r) => nomeDaSalaSvg(r, casa)).join(''),
  ].join('')

  return (
    `<svg class="mapa" viewBox="${n(minX)} ${n(minY)} ${n(w)} ${n(h)}" role="img" aria-label="${esc(nomeAcessivel)}">` +
    `<defs><clipPath id="${idDoRecorte}">${conhecido.formas}</clipPath></defs>` +
    `<rect x="${n(minX)}" y="${n(minY)}" width="${n(w)}" height="${n(h)}" fill="#000"/>` +
    `<g clip-path="url(#${idDoRecorte})">${camadas}</g></svg>`
  )
}

/** As formas do que ele conhece (união) e a caixa delas; `caixa: null` = nada. */
function recorteConhecido(cena: CenaLembrada): { formas: string; caixa: Caixa | null } {
  const partes: string[] = []
  let caixa: Caixa | null = null
  const somar = (x1: number, y1: number, x2: number, y2: number) => {
    caixa = caixa === null ? { minX: x1, minY: y1, maxX: x2, maxY: y2 } : { minX: Math.min(caixa.minX, x1), minY: Math.min(caixa.minY, y1), maxX: Math.max(caixa.maxX, x2), maxY: Math.max(caixa.maxY, y2) }
  }
  const anel = (ring: readonly RegionPoint[]) => {
    if (ring.length < 3) return
    partes.push(`<polygon points="${pontos(ring)}"/>`)
    for (const p of ring) somar(p.x, p.y, p.x, p.y)
  }
  cena.vision.forEach(anel)
  const exp = cena.explored
  if (exp !== undefined) {
    for (const ring of exp.rings) anel(ring.points)
    const cell = exp.cell
    const trechos: string[] = []
    // colEnd exclusivo (lib/exploration.ts): largura = (colEnd - colStart) * cell.
    forEachExploredRun(exp, (row, colStart, colEnd) => {
      const x = colStart * cell
      const y = row * cell
      const largura = (colEnd - colStart) * cell
      trechos.push(`M${n(x)} ${n(y)}h${n(largura)}v${n(cell)}h${n(-largura)}z`)
      somar(x, y, x + largura, y + cell)
    })
    if (trechos.length > 0) partes.push(`<path d="${trechos.join('')}"/>`)
  }
  return { formas: partes.join(''), caixa }
}

function chaoSvg(planta: PlantaLembrada, parede: number): string {
  if (planta.floor.length === 0) return ''
  const poligonos = buildFloorOutline(planta.floor, { step: PASSO_DO_CHAO })
  if (poligonos.length === 0) return ''
  const d = poligonos.map((p) => [p.outer, ...p.holes].map(caminhoFechado).join('')).join('')
  const estilo = planta.floorStyle
  const contorno = estilo.strokeColor === null ? '' : ` stroke="${cor(estilo.strokeColor, COR_PAREDE)}" stroke-width="${n(Math.max(parede, Math.min(estilo.strokeWidth, parede * 2)))}"`
  return `<path d="${d}" fill="${cor(estilo.fillColor, '#5b6b5e')}" fill-rule="evenodd"${contorno}/>`
}

/** Sala chapada (a hachura do editor sai lisa: o minimapa não tem hachura). */
function salaSvg(region: Region, parede: number): string {
  if (region.points.length < 3) return ''
  const preenche = region.filled !== false
  return `<polygon points="${pontos(region.points)}" fill="${preenche ? cor(region.fillColor, '#3a3f45') : 'none'}" stroke="${COR_PAREDE}" stroke-width="${n(parede)}" stroke-linejoin="round"/>`
}

function tracoSvg(line: MapLine): string {
  if (line.points.length < 2) return ''
  const tag = line.closed ? 'polygon' : 'polyline'
  const tracejado = line.dotted ? ` stroke-dasharray="${n(Math.max(1, line.width * 1.5))} ${n(Math.max(1, line.width * 2))}"` : ''
  return `<${tag} points="${pontos(line.points)}" fill="none" stroke="${cor(line.color, COR_PAREDE)}" stroke-width="${n(Math.max(0.5, line.width))}"${tracejado}/>`
}

function paredeSvg(wall: Wall, parede: number, casa: number): string {
  if (wall.door === null) {
    return `<line x1="${n(wall.x1)}" y1="${n(wall.y1)}" x2="${n(wall.x2)}" y2="${n(wall.y2)}" stroke="${COR_PAREDE}" stroke-width="${n(parede)}" stroke-linecap="round"/>`
  }
  // Porta: retângulo pequeno sobre o vão, deitado na direção da parede.
  const comprimento = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1)
  if (comprimento === 0) return ''
  const espessura = casa * PORTA_POR_CASA
  const cx = (wall.x1 + wall.x2) / 2
  const cy = (wall.y1 + wall.y2) / 2
  const graus = (Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1) * 180) / Math.PI
  const aberta = wall.door.open ? ' fill-opacity="0.35"' : ''
  return `<rect x="${n(cx - comprimento / 2)}" y="${n(cy - espessura / 2)}" width="${n(comprimento)}" height="${n(espessura)}" fill="${COR_PORTA}"${aberta} transform="rotate(${n(graus)} ${n(cx)} ${n(cy)})"/>`
}

function marcadorSvg(m: MapMarker): string {
  const fill = cor(m.color, COR_PORTA)
  const giro = m.rotation === 0 ? '' : ` transform="rotate(${n(m.rotation)} ${n(m.cx)} ${n(m.cy)})"`
  if (m.shape === 'ellipse') return `<ellipse cx="${n(m.cx)}" cy="${n(m.cy)}" rx="${n(m.w / 2)}" ry="${n(m.h / 2)}" fill="${fill}"${giro}/>`
  return `<rect x="${n(m.cx - m.w / 2)}" y="${n(m.cy - m.h / 2)}" width="${n(m.w)}" height="${n(m.h)}" fill="${fill}"${giro}/>`
}

/** Nome da Sala no meio da caixa dela (mais o deslocamento que o mestre deu). Nome vazio = oculto pelo recorte. */
function nomeDaSalaSvg(region: Region, casa: number): string {
  const nome = region.room?.name.trim() ?? ''
  if (nome === '' || region.points.length < 3) return ''
  const xs = region.points.map((p) => p.x)
  const ys = region.points.map((p) => p.y)
  const desvio = region.room?.labelOffset ?? { x: 0, y: 0 }
  const x = (Math.min(...xs) + Math.max(...xs)) / 2 + desvio.x
  const y = (Math.min(...ys) + Math.max(...ys)) / 2 + desvio.y
  const tamanho = Math.max(NOME_MIN_PX, casa * NOME_POR_CASA)
  return `<text x="${n(x)}" y="${n(y)}" font-size="${n(tamanho)}" fill="${COR_NOME}" text-anchor="middle" dominant-baseline="middle" paint-order="stroke" stroke="#000" stroke-width="${n(tamanho / 6)}">${esc(nome)}</text>`
}

// ---------------------------------------------------------------------------
// Pistas e recados
// ---------------------------------------------------------------------------

/** Só foto embutida de formato de imagem comum: caminho de disco, endereço de rede e SVG não entram no arquivo. */
const FOTO_EMBUTIDA = /^data:image\/(png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/]+=*$/

function listaDePistas(pistas: readonly ClueEntry[]): string {
  if (pistas.length === 0) return '<p class="vazio">Nenhuma pista ainda.</p>'
  const itens = [...pistas].reverse().map((pista) => {
    const origem = pista.from === undefined ? '' : ` · mostrada por ${esc(pista.from)}`
    const foto = pista.image !== null && FOTO_EMBUTIDA.test(pista.image) ? `<img src="${pista.image}" alt="">` : ''
    const texto = pista.text.trim() === '' ? '' : `<p class="texto">${esc(pista.text)}</p>`
    return `<li><h3>${esc(pista.title)}</h3><p class="meta">${esc(dataEHora(pista.at))}${origem}</p>${texto}${foto}</li>`
  })
  return `<ol class="lista">${itens.join('')}</ol>`
}

function listaDeRecados(recados: readonly NoteEntry[]): string {
  if (recados.length === 0) return '<p class="vazio">Nenhum recado ainda.</p>'
  const itens = [...recados].reverse().map((r) => `<li><p class="meta">${esc(dataEHora(r.at))} · Mestre</p><p class="texto">${esc(r.text)}</p></li>`)
  return `<ol class="lista">${itens.join('')}</ol>`
}

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

function esc(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** Só cor `#rgb`/`#rrggbb`(+alfa) entra num atributo: o resto cai na cor de fábrica. */
function cor(valor: string, padrao: string): string {
  return /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(valor) ? valor : padrao
}

/** Uma casa decimal basta para o mapa e encurta o arquivo. */
function n(valor: number): string {
  return String(Math.round(valor * 10) / 10)
}

function pontos(ring: readonly RegionPoint[]): string {
  return ring.map((p) => `${n(p.x)},${n(p.y)}`).join(' ')
}

function caminhoFechado(ring: readonly RegionPoint[]): string {
  if (ring.length < 3) return ''
  return `M${ring.map((p) => `${n(p.x)} ${n(p.y)}`).join('L')}z`
}

function doisDigitos(valor: number): string {
  return String(valor).padStart(2, '0')
}

/**
 * "24/09/2026 20:30" no relógio de quem baixa. Com a data, e não só a hora como
 * no Caderno da tela: o arquivo é lido sessões depois. Local, e não o
 * `formatNoteTime` do `PlayerNotebook`, para a conexão (que guarda as cenas)
 * não puxar componente React.
 */
function dataEHora(at: number, separador = ' '): string {
  const quando = new Date(at)
  const dia = `${doisDigitos(quando.getDate())}/${doisDigitos(quando.getMonth() + 1)}/${quando.getFullYear()}`
  return `${dia}${separador}${doisDigitos(quando.getHours())}:${doisDigitos(quando.getMinutes())}`
}

const ESTILO = `
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;padding:24px 16px 48px;background:#0e0f11;color:#e6e8eb;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;max-width:960px;margin-inline:auto}
h1{font-size:1.6rem;margin:0 0 4px}
h2{font-size:1.15rem;margin:32px 0 12px;border-bottom:1px solid #2a2d31;padding-bottom:6px}
h3{font-size:1rem;margin:0}
.meta{color:#9aa1a9;font-size:.85rem;margin:2px 0}
.vazio{color:#9aa1a9}
.cena{margin:0 0 24px}
.cena figcaption{font-weight:600;margin-bottom:8px}
.aqui{font-weight:400;font-size:.8rem;color:#0e0f11;background:#4da3ff;border-radius:4px;padding:1px 6px;margin-left:6px}
.mapa{display:block;width:100%;height:auto;max-height:80vh;background:#000;border:1px solid #2a2d31;border-radius:6px}
.lista{list-style:none;margin:0;padding:0}
.lista li{padding:12px 0;border-bottom:1px solid #1f2226}
.texto{white-space:pre-wrap;margin:6px 0 0}
.lista img{display:block;max-width:100%;margin-top:8px;border-radius:4px}
@media print{body{background:#fff;color:#000}.meta,.vazio{color:#444}}
`
