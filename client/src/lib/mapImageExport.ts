import type { AlvoDoBalde, ConcealZone, Drawing, MapData, PinceladaDeTextura, Prop, Region, RegionPoint, Stair, Wall } from '../types/map'
import { contextoDeCamadas } from './camadas/consulta'
import { distanceToWall } from './doorReach'
import { paredesQueSeguram, presoNaParede } from './faixasDaParede'
import { shapeCenter } from './floorSdf'
import { isHidden } from './itemTransform'
import { isArrivalOnly } from './pinTravel'
import { ancestorsOf, pointInPolygonInclusive, pointOnPolygonBorder, subtreeIds } from './roomNesting'
import { roomHasRoof } from './roomOps'
import { rotatePointAround, rotationTrig } from './roomRotation'
import { areaPassaPorParede, comTexturas, comTexturasImportadas, importadasParaJogador } from './texturas'
import { comCarimbos, comCarimbosImportados, importadosParaJogador } from './carimbos'
import { amostrasDaCercaCurva } from './cercaCurva'
import { objetoEscondidoDosJogadores } from './fogFilter'

/**
 * "Exportar imagem": o que o mestre escolhe no diálogo antes de salvar o PNG.
 *
 * `masterOnly` desligado é o caso de postar a imagem no grupo: nada do que é
 * só do mestre pode sair nela — item "Oculto para jogadores" (`secret`), sala
 * secreta com tudo o que está dentro, zona oculta com o que ela cobre, nome de
 * sala escondido dos jogadores, pino de chegada oculta, o que mora em camada
 * escondida dos jogadores e o interior da casa de teto fechado (o telhado sai
 * cheio). Mesmas regras estáticas do recorte do jogador (`lib/fogFilter.ts`),
 * sem névoa: a imagem mostra a cena inteira.
 */
export interface ImageExportOptions {
  grid: boolean
  masterOnly: boolean
}

/** Gera o PNG da cena atual (bytes do arquivo). Mora no canvas do editor (`pixi/PixiCanvas.tsx`). */
export type MapImageExporter = (options: ImageExportOptions) => Promise<Uint8Array>

/** Maior lado do PNG, em px: nítido para imprimir e dentro do limite de textura de qualquer placa. */
export const IMAGE_EXPORT_MAX_SIDE_PX = 2048
/** Mapa pequeno não passa do dobro: acima disso a imagem só fica pesada, sem detalhe novo. */
export const IMAGE_EXPORT_MAX_SCALE = 2
/** Nome do arquivo quando o nome do mapa não sobra nada que o sistema aceite. */
const FALLBACK_FILE_NAME = 'mapa'

/** Escala do mundo para a imagem: o mapa inteiro, maior lado até `IMAGE_EXPORT_MAX_SIDE_PX`. */
export function imageExportScale(widthPx: number, heightPx: number): number {
  const side = Math.max(widthPx, heightPx)
  if (!Number.isFinite(side) || side <= 0) return 1
  return Math.min(IMAGE_EXPORT_MAX_SCALE, IMAGE_EXPORT_MAX_SIDE_PX / side)
}

/**
 * "Cripta do Farol" vira "Cripta do Farol.png". Tira o que o Windows recusa em
 * nome de arquivo (`<>:"/\|?*` e caracteres de controle) e o ponto/espaço do fim.
 */
export function imageExportFileName(mapName: string): string {
  const cleaned = Array.from(mapName)
    .filter((char) => char.charCodeAt(0) >= 32 && !'<>:"/\\|?*'.includes(char))
    .join('')
    .trim()
    .replace(/[. ]+$/, '')
  return `${cleaned === '' ? FALLBACK_FILE_NAME : cleaned}.png`
}

/** Bytes de um data URL em base64 (`data:image/png;base64,...`), como o `extract` do Pixi devolve. */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',')
  if (!dataUrl.startsWith('data:') || comma === -1 || !dataUrl.slice(0, comma).endsWith(';base64')) {
    throw new Error('imagem gerada em formato inesperado')
  }
  const binary = atob(dataUrl.slice(comma + 1))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * O mapa como ele sai na imagem. A grade segue a opção do diálogo (não a do
 * editor), item "Oculto no editor" (`hidden`) nunca sai — no editor ele é só
 * um fantasma de trabalho — e, sem `masterOnly`, sai sem nada do que é só do
 * mestre (ver `ImageExportOptions`). Não muda o mapa recebido.
 */
export function mapForImageExport(map: MapData, options: ImageExportOptions): MapData {
  const shown: MapData = {
    ...map,
    showGrid: options.grid,
    tokens: map.tokens.filter((t) => !isHidden(t)),
    props: map.props.filter((p) => !isHidden(p)),
    pins: map.pins.filter((p) => !isHidden(p)),
    lights: map.lights.filter((l) => !isHidden(l)),
    stairs: map.stairs.filter((s) => !isHidden(s)),
    walls: map.walls.filter((w) => !isHidden(w)),
    regions: map.regions.filter((r) => !isHidden(r)),
  }
  return options.masterOnly ? shown : withoutMasterOnly(shown, map.walls.filter(isHidden), new Set(map.tokens.map((t) => t.id)))
}

/**
 * CAMADA ESCONDIDA DOS JOGADORES (caça de 12/11/2026, P-NEVOA): o olho
 * "Jogadores veem" de cada item (`jogadorVeItem`, o mesmo do recorte do
 * jogador), e Terreno escondido leva as texturas, o relevo, o penhasco e o
 * barranco. Sem isto o barril e a parede da camada livre escondida saíam na
 * imagem para os jogadores.
 */
function soOQueOsJogadoresVeem(map: MapData): MapData {
  const camadas = contextoDeCamadas(map)
  if ((map.ocultasDoJogador ?? map.hiddenLayers).length === 0) return map
  const terreno = camadas.jogadorVe('terreno')
  return {
    ...map,
    walls: map.walls.filter((w) => camadas.jogadorVeItem('parede', w)),
    floor: map.floor.filter((f) => camadas.jogadorVeItem('peca', f)),
    regions: map.regions.filter((r) => camadas.jogadorVeItem('regiao', r)),
    stairs: map.stairs.filter((s) => camadas.jogadorVeItem('escada', s)),
    lights: map.lights.filter((l) => camadas.jogadorVeItem('luz', l)),
    tokens: map.tokens.filter((t) => camadas.jogadorVeItem('ficha', t)),
    props: map.props.filter((p) => camadas.jogadorVeItem('objeto', p)),
    pins: map.pins.filter((p) => camadas.jogadorVeItem('pino', p)),
    lines: map.lines.filter((l) => camadas.jogadorVeItem('linha', l)),
    markers: map.markers.filter((m) => camadas.jogadorVeItem('marcador', m)),
    drawings: map.drawings.filter((d) => camadas.jogadorVeItem('desenho', d)),
    ...(map.carimbos === undefined ? {} : { carimbos: map.carimbos.filter((c) => camadas.jogadorVeItem('carimbo', c)) }),
    ...(terreno ? {} : { texturas: undefined, relevo: false, penhascos: undefined, barranco: undefined }),
  }
}

/** Afasta `p` do centro `c` em direção a ele por `px` (sem passar do centro). */
function puxarParaDentro(p: RegionPoint, c: RegionPoint, px: number): RegionPoint {
  const d = Math.hypot(c.x - p.x, c.y - p.y)
  if (!(d > px)) return c
  return { x: p.x + ((c.x - p.x) / d) * px, y: p.y + ((c.y - p.y) / d) * px }
}

/**
 * O centro e os cantos da pegada do objeto (girados, 1 px para dentro: encostar
 * na parede por fora não conta) e o arco da cerca curva, que sai da caixa reta
 * (`amostrasDaCercaCurva`, o mesmo do recorte do jogador).
 */
function pontosDoObjeto(p: Prop): RegionPoint[] {
  const centro = { x: p.x, y: p.y }
  const giro = rotationTrig(p.rotation ?? 0)
  const meiaL = p.width / 2
  const meiaA = p.height / 2
  const cantos = [
    { x: p.x - meiaL, y: p.y - meiaA },
    { x: p.x + meiaL, y: p.y - meiaA },
    { x: p.x + meiaL, y: p.y + meiaA },
    { x: p.x - meiaL, y: p.y + meiaA },
  ].map((canto) => puxarParaDentro(rotatePointAround(canto, centro, giro), centro, 1))
  return [centro, ...cantos.filter((q) => Number.isFinite(q.x) && Number.isFinite(q.y)), ...amostrasDaCercaCurva(p)]
}

/**
 * CASA DE TETO FECHADO (caça de 12/11/2026, decisão 31 do mestre): na imagem
 * para os jogadores ela sai com o telhado CHEIO (o canvas desenha o telhado
 * inteiro, `pixi/PixiCanvas.tsx`) e sem o interior, como na tela de quem está
 * fora. Sai o que mora sob o telhado que os jogadores veem: objeto com alguma
 * ponta lá dentro (a tocha presa na parede de fora, com o centro na linha,
 * também, como no recorte), ficha, pino, luz, marcador e carimbo com o centro
 * lá, escada e linha com alguma ponta, desenho com a maioria dos pontos, a
 * parede de dentro (a do contorno fica) e as salas de dentro.
 */
function semOInteriorDosTetos(map: MapData): MapData {
  const camadas = contextoDeCamadas(map)
  const tetos = map.regions.filter(
    (r) => roomHasRoof(r.room) && camadas.jogadorVeItem('telhado', r) && r.points.length >= 3 && r.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
  )
  if (tetos.length === 0) return map
  const sobTeto = (p: RegionPoint): boolean => tetos.some((teto) => pointInPolygonInclusive(p, teto.points))
  const algumSob = (pontos: readonly RegionPoint[]): boolean => pontos.some(sobTeto)
  const maioriaSob = (pontos: readonly RegionPoint[]): boolean => pontos.length > 0 && pontos.filter(sobTeto).length * 2 > pontos.length
  const tetoIds = new Set(tetos.map((t) => t.id))
  const deDentro = new Set(
    map.regions
      .filter((r) => !tetoIds.has(r.id))
      .filter((r) => tetos.some((teto) => subtreeIds(map.regions, teto.id).has(r.id)) || (r.points.length > 0 && r.points.every(sobTeto)))
      .map((r) => r.id),
  )
  const paredeDeDentro = (w: Wall): boolean => {
    const pontos = wallPoints(w)
    return tetos.some((teto) => pontos.every((p) => pointInPolygonInclusive(p, teto.points)) && !pontos.every((p) => pointOnPolygonBorder(p, teto.points)))
  }
  return {
    ...map,
    regions: map.regions.filter((r) => !deDentro.has(r.id)),
    walls: map.walls.filter((w) => !paredeDeDentro(w)),
    props: map.props.filter((p) => !algumSob(pontosDoObjeto(p))),
    tokens: map.tokens.filter((t) => !sobTeto(t)),
    pins: map.pins.filter((p) => !sobTeto(p)),
    lights: map.lights.filter((l) => !sobTeto(l)),
    markers: map.markers.filter((m) => !sobTeto({ x: m.cx, y: m.cy })),
    stairs: map.stairs.filter((s) => !algumSob(stairPoints(s))),
    lines: map.lines.filter((l) => !algumSob(l.points)),
    drawings: map.drawings.filter((d) => !maioriaSob(drawingPoints(d))),
    ...(map.carimbos === undefined ? {} : { carimbos: map.carimbos.filter((c) => !sobTeto(c)) }),
  }
}

/**
 * Tudo que o jogador nunca recebe por decisão do mestre, fora do mapa.
 * `paredesInvisiveis`: as que `mapForImageExport` já tirou de `map`; contam
 * como paredes tiradas para a textura por área que acaba nelas (as de camada
 * escondida dos jogadores também). `todasAsFichas`: os ids de TODAS as fichas
 * da cena, também as "Ocultas no editor" que já saíram de `inteiro` (a tocha
 * presa numa delas sai junto).
 *
 * PELA SILHUETA, NÃO PELO CENTRO (caça de 12/11/2026, decisão 36 do mestre):
 * sala secreta e zona oculta levam junto o objeto com QUALQUER ponta lá dentro
 * (as amostras do recorte do jogador, `objetoEscondidoDosJogadores`, e os
 * cantos de `pontosDoObjeto`) e o desenho com qualquer amostra da forma lá
 * dentro (`pontosQueEncostam`); a luz presa numa ficha que não sai também não
 * sai (a do recorte, `masterHiddenTokenIds` em `lib/fogFilter.ts`). Pelo centro,
 * o armário com o centro no corredor e a ponta na sala secreta saía no PNG.
 */
function withoutMasterOnly(inteiro: MapData, paredesInvisiveis: readonly Wall[], todasAsFichas: ReadonlySet<string>): MapData {
  const naCamadaDosJogadores = soOQueOsJogadoresVeem(inteiro)
  const naCamada = new Set(naCamadaDosJogadores.walls)
  const paredesForaDaCamada = inteiro.walls.filter((w) => !naCamada.has(w))
  // O objeto PRESO só em parede que saiu pela camada (a tocha da parede escondida) sai junto: boiando no lugar dela,
  // ele desenharia a parede. Preso também numa que fica, fica.
  const seguramForaDaCamada = paredesQueSeguram(paredesForaDaCamada, inteiro.grid)
  const seguramNaCamada = seguramForaDaCamada.length === 0 ? [] : paredesQueSeguram(naCamadaDosJogadores.walls, inteiro.grid)
  const map: MapData =
    seguramForaDaCamada.length === 0
      ? naCamadaDosJogadores
      : { ...naCamadaDosJogadores, props: naCamadaDosJogadores.props.filter((p) => !presoNaParede(p, seguramForaDaCamada) || presoNaParede(p, seguramNaCamada)) }
  const secretRooms = map.regions.filter((r) => r.secret && r.room !== undefined)
  // Sala secreta leva junto as sub-salas e as paredes delas, como no recorte do jogador.
  const goneRegionIds = new Set([
    ...map.regions.filter((r) => r.secret).map((r) => r.id),
    ...secretRooms.flatMap((r) => [...subtreeIds(map.regions, r.id)]),
    ...map.regions.filter((r) => ancestorsOf(map.regions, r.id).some((a) => a.secret)).map((r) => r.id),
  ])
  const hiddenAreas = [...secretRooms.map((r) => r.points), ...activeZoneRings(map.concealZones)]
  const hidden = (point: RegionPoint): boolean => hiddenAreas.some((ring) => pointInPolygonInclusive(point, ring))
  const anyHidden = (points: readonly RegionPoint[]): boolean => hiddenAreas.length > 0 && points.some(hidden)
  const escondidoPelaSilhueta = objetoEscondidoDosJogadores(map)
  const drawings = map.drawings.filter((d) => !d.secret && !anyHidden(pontosQueEncostam(d)))
  const walls = map.walls.filter((w) => !(w.regionId !== undefined && goneRegionIds.has(w.regionId)) && !anyHidden(wallPoints(w)))
  const ficam = new Set(walls)
  const paredesTiradas = [...paredesInvisiveis, ...paredesForaDaCamada, ...map.walls.filter((w) => !ficam.has(w))]
  const texturas = texturasSemSegredo(map, goneRegionIds, new Set(drawings.map((d) => d.id)), hiddenAreas, paredesTiradas)

  const semSegredo: MapData = {
    ...map,
    regions: map.regions.filter((r) => !goneRegionIds.has(r.id)).map(withoutHiddenRoomName),
    walls,
    tokens: map.tokens.filter((t) => !t.secret && !anyHidden([t])),
    props: map.props.filter((p) => !p.secret && !anyHidden(pontosDoObjeto(p)) && !escondidoPelaSilhueta(p)),
    pins: map.pins.filter((p) => !p.secret && !isArrivalOnly(p) && !anyHidden([p])),
    lights: map.lights.filter((l) => !anyHidden([l])),
    stairs: map.stairs.filter((s) => !s.secret && !anyHidden(stairPoints(s))),
    drawings,
    markers: map.markers.filter((m) => !anyHidden([{ x: m.cx, y: m.cy }])),
    lines: map.lines.filter((l) => !anyHidden(l.points)),
    floor: map.floor.filter((f) => !anyHidden([shapeCenter(f.shape)])),
    // A zona é anotação do mestre: nem o contorno dela sai.
    concealZones: [],
  }
  // CARIMBOS: o objeto numa sala secreta ou numa zona oculta diria o que há lá
  // (um oásis, a mata que esconde a entrada). O de fora fica.
  // Teto fechado por último: o interior sai depois do segredo (decisão 31, `semOInteriorDosTetos`).
  const semTeto = semOInteriorDosTetos({ ...semSegredo, carimbos: (map.carimbos ?? []).filter((c) => !anyHidden([c])) })
  // TOCHA PRESA NA FICHA que não sai (oculta, secreta, na sala secreta, na zona, sob o teto, na camada escondida):
  // a luz sai junto, mesmo afastada dela. O halo no lugar diria onde a ficha está. Vínculo com ficha que não existe fica.
  const fichasQueSaem = new Set(semTeto.tokens.map((t) => t.id))
  const presaEmFichaQueNaoSai = (l: MapData['lights'][number]): boolean =>
    l.attachedTokenId !== undefined && todasAsFichas.has(l.attachedTokenId) && !fichasQueSaem.has(l.attachedTokenId)
  const semLuzDeFichaEscondida: MapData = { ...semTeto, lights: semTeto.lights.filter((l) => !presaEmFichaQueNaoSai(l)) }
  const carimbos = semTeto.carimbos ?? []
  // Das importadas, só as que os passos que ficaram usam: o nome e a imagem das outras são do mestre.
  const comPintura = comTexturasImportadas(comTexturas(semLuzDeFichaEscondida, texturas), importadasParaJogador(map.texturasImportadas, texturas) ?? [])
  return comCarimbosImportados(comCarimbos(comPintura, carimbos), importadosParaJogador(map.carimbosImportados, carimbos) ?? [])
}

/**
 * TEXTURAS sem o que é do mestre: o balde enche a forma do alvo, então o
 * balde de uma sala secreta (ou de um desenho que não sai) desenharia a
 * silhueta dela; a pincelada que encosta (a menos de um raio) numa sala
 * secreta ou numa zona oculta entrega o que tem lá. A borracha fica: ela só
 * tira tinta, não mostra nada.
 */
function texturasSemSegredo(
  map: MapData,
  goneRegionIds: ReadonlySet<string>,
  drawingIds: ReadonlySet<string>,
  hiddenAreas: readonly (readonly RegionPoint[])[],
  paredesTiradas: readonly Wall[],
): PinceladaDeTextura[] {
  const encosta = (p: RegionPoint, raio: number): boolean =>
    hiddenAreas.some(
      (ring) =>
        pointInPolygonInclusive(p, ring) ||
        ring.some((a, i) => {
          const b = ring[(i + 1) % ring.length]
          return distanceToWall(p, { x1: a.x, y1: a.y, x2: b.x, y2: b.y }) <= raio
        }),
    )
  // A ÁREA fechada por paredes não é forma do mapa: sai se o contorno encosta numa sala secreta ou zona
  // oculta, ou se corre numa parede que a imagem tira (a do cofre, mesmo fora da borda dele): o contorno a desenharia.
  const alvoFica = (alvo: AlvoDoBalde): boolean =>
    alvo.tipo === 'area'
      ? !alvo.pontos.some((p) => encosta(p, 0)) && !areaPassaPorParede(alvo.pontos, paredesTiradas, map.grid)
      : alvo.tipo === 'regiao'
      ? !goneRegionIds.has(alvo.id)
      : drawingIds.has(alvo.id)
  return (map.texturas ?? []).filter((passo) => {
    if (passo.tipo === 'balde' || passo.tipo === 'esvaziar') return alvoFica(passo.alvo)
    // A sala secreta não abre buraco na textura: o buraco desenharia a silhueta dela.
    if (passo.tipo === 'sala') return !goneRegionIds.has(passo.regiao)
    return passo.tipo === 'borracha' || !passo.pontos.some((p) => encosta(p, passo.raio))
  })
}

function activeZoneRings(zones: readonly ConcealZone[]): RegionPoint[][] {
  return zones.filter((z) => !z.revealed && z.points.length >= 3).map((z) => z.points)
}

/** Sala com "nome oculto para jogadores" sai sem o nome, como no recorte do jogador. */
function withoutHiddenRoomName(region: Region): Region {
  if (region.room === undefined || region.room.nameHiddenFromPlayers !== true) return region
  return { ...region, room: { ...region.room, name: '' } }
}

function wallPoints(wall: Wall): RegionPoint[] {
  return [
    { x: wall.x1, y: wall.y1 },
    { x: (wall.x1 + wall.x2) / 2, y: (wall.y1 + wall.y2) / 2 },
    { x: wall.x2, y: wall.y2 },
  ]
}

function stairPoints(stair: Stair): RegionPoint[] {
  return stair.segments.flatMap((s) => [
    { x: s.x1, y: s.y1 },
    { x: s.x2, y: s.y2 },
  ])
}

/**
 * Pontos que dizem onde o desenho está. O teto fechado conta a maioria deles;
 * sala secreta e zona oculta contam a forma inteira (`pontosQueEncostam`).
 */
function drawingPoints(drawing: Drawing): RegionPoint[] {
  switch (drawing.kind) {
    case 'freehand':
    case 'curve':
    case 'polygon':
    case 'path':
      return drawing.points
    case 'line':
      return [
        { x: drawing.x1, y: drawing.y1 },
        { x: drawing.x2, y: drawing.y2 },
      ]
    case 'circle':
    case 'ellipse':
      return [{ x: drawing.cx, y: drawing.cy }]
    case 'text':
      return [{ x: drawing.x, y: drawing.y }]
    case 'rect':
      return [{ x: drawing.x + drawing.w / 2, y: drawing.y + drawing.h / 2 }]
  }
}

/** Recuo das amostras internas: os MESMOS números de `interiorSamples` (`INTERIOR_PULL`, `INTERIOR_PULL_MIN`, `lib/fogFilter.ts`). */
const RECUO_DA_AMOSTRA = 0.15
const RECUO_MINIMO_DA_AMOSTRA_PX = 4
/** Pontos do contorno do círculo e da elipse que contam (a cada 45 graus). */
const PONTOS_NO_CONTORNO_DA_ELIPSE = 8

/**
 * Amostras internas de uma forma, a conta do recorte do jogador
 * (`interiorSamples` em `lib/fogFilter.ts`, que não é exportada): o centróide
 * e cada vértice puxado em direção a ele. Com `anel`, só as que caem dentro
 * dele (o centróide do polígono côncavo cai fora); nenhuma dentro, todas.
 */
function amostrasInternas(pontos: readonly RegionPoint[], anel?: readonly RegionPoint[]): RegionPoint[] {
  if (pontos.length === 0) return []
  const c = { x: pontos.reduce((s, p) => s + p.x, 0) / pontos.length, y: pontos.reduce((s, p) => s + p.y, 0) / pontos.length }
  const amostras = [c]
  for (const p of pontos) {
    const d = Math.hypot(c.x - p.x, c.y - p.y)
    if (!(d > 0)) continue
    const passo = Math.min(d, Math.max(d * RECUO_DA_AMOSTRA, RECUO_MINIMO_DA_AMOSTRA_PX))
    amostras.push({ x: p.x + ((c.x - p.x) * passo) / d, y: p.y + ((c.y - p.y) * passo) / d })
  }
  if (anel === undefined || anel.length < 3) return amostras
  const dentro = amostras.filter((q) => pointInPolygonInclusive(q, anel))
  return dentro.length > 0 ? dentro : amostras
}

/** O contorno da elipse (a cada 45 graus), 1 px para dentro como os cantos do objeto. */
function contornoDaElipse(cx: number, cy: number, rx: number, ry: number): RegionPoint[] {
  const centro = { x: cx, y: cy }
  return Array.from({ length: PONTOS_NO_CONTORNO_DA_ELIPSE }, (_, i) => {
    const angulo = (i * 2 * Math.PI) / PONTOS_NO_CONTORNO_DA_ELIPSE
    return puxarParaDentro({ x: cx + rx * Math.cos(angulo), y: cy + ry * Math.sin(angulo) }, centro, 1)
  })
}

/**
 * O DESENHO QUE ENCOSTA no lugar escondido (caça de 12/11/2026, decisão 36):
 * os pontos de `drawingPoints` mais a forma inteira — as amostras do recorte do
 * jogador (`drawingSamplePoints`), os cantos do retângulo e o contorno do
 * círculo e da elipse, 1 px para dentro, e o meio da linha. Basta um lá dentro
 * para o desenho não sair: o retângulo com o centro no corredor e um canto na
 * sala secreta saía no PNG.
 */
function pontosQueEncostam(drawing: Drawing): RegionPoint[] {
  const base = drawingPoints(drawing)
  switch (drawing.kind) {
    case 'line':
      return [...base, { x: (drawing.x1 + drawing.x2) / 2, y: (drawing.y1 + drawing.y2) / 2 }]
    case 'polygon':
      return [...base, ...amostrasInternas(drawing.points, drawing.points)]
    case 'rect': {
      const cantos = [
        { x: drawing.x, y: drawing.y },
        { x: drawing.x + drawing.w, y: drawing.y },
        { x: drawing.x + drawing.w, y: drawing.y + drawing.h },
        { x: drawing.x, y: drawing.y + drawing.h },
      ]
      const centro = { x: drawing.x + drawing.w / 2, y: drawing.y + drawing.h / 2 }
      return [...base, ...cantos.map((p) => puxarParaDentro(p, centro, 1)), ...amostrasInternas(cantos)]
    }
    case 'circle':
      return [...base, ...contornoDaElipse(drawing.cx, drawing.cy, drawing.radius, drawing.radius), ...amostrasInternas(extremosDaElipse(drawing.cx, drawing.cy, drawing.radius, drawing.radius))]
    case 'ellipse':
      return [...base, ...contornoDaElipse(drawing.cx, drawing.cy, drawing.rx, drawing.ry), ...amostrasInternas(extremosDaElipse(drawing.cx, drawing.cy, drawing.rx, drawing.ry))]
    case 'freehand':
    case 'curve':
    case 'path':
    case 'text':
      return base
  }
}

/** Os quatro extremos da elipse, como `ellipseExtremes` do recorte. */
function extremosDaElipse(cx: number, cy: number, rx: number, ry: number): RegionPoint[] {
  return [
    { x: cx - rx, y: cy },
    { x: cx + rx, y: cy },
    { x: cx, y: cy - ry },
    { x: cx, y: cy + ry },
  ]
}
