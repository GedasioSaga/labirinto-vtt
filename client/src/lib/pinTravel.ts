import type { MapData, Pin, PinDestination, PinExit, PinExitLabel } from '../types/map'
import { PIN_HEAD_RADIUS, PIN_HEIGHT, pinSummary } from './pins'
import { seatTokenCenter } from './tokenSize'
import { snapPointForTarget } from '../pixi/tokenInteraction'

/**
 * PINO DE VIAGEM — as regras da ligação, puras: sem store, sem DOM, sem Pixi.
 *
 * Um pino de viagem leva a outra cena da aventura e chega num pino PAR de lá,
 * que é o ponto de chegada. A ligação mora nos DOIS pinos (mão dupla):
 * A → (cena B, pino B) e B → (cena A, pino A), para o par sempre trazer de
 * volta. Só conta como ligado o par que se aponta de volta: meia ligação
 * (sobra de um desfazer, arquivo editado à mão) é "sem destino" na tela e no
 * clique — o mestre nunca atravessa para um lugar de onde o pino não o traz.
 */

/** Forma de destino que o resto do app pode usar sem conferir de novo. */
export function isPinDestination(value: unknown): value is PinDestination {
  if (value === null || typeof value !== 'object') return false
  const { sceneId, pinId } = value as Record<string, unknown>
  return typeof sceneId === 'string' && sceneId.length > 0 && typeof pinId === 'string' && pinId.length > 0
}

/**
 * Leitura do disco: a forma certa vira destino (só os dois campos, sem o que
 * mais o arquivo trouxer); qualquer outra coisa é "sem destino".
 */
export function readPinDestination(value: unknown): PinDestination | null {
  return isPinDestination(value) ? { sceneId: value.sceneId, pinId: value.pinId } : null
}

/** Mesmo destino. Ausente e `null` são o mesmo "sem destino". */
export function sameDestination(a: PinDestination | null | undefined, b: PinDestination | null | undefined): boolean {
  if (!a || !b) return !a && !b
  return a.sceneId === b.sceneId && a.pinId === b.pinId
}

/** O destino que vale: só pino de VIAGEM leva a algum lugar. */
export function travelDestinationOf(pin: Pin): PinDestination | null {
  return pin.kind === 'viagem' && isPinDestination(pin.destino) ? pin.destino : null
}

/**
 * MÃO ÚNICA — o pino é a CHEGADA OCULTA de uma ligação que não volta.
 *
 * Só vale no pino de viagem: a marca esquecida num pino que virou "!" (o
 * mestre trocou o tipo) não pode sumir com um marcador comum da tela do
 * jogador. Voltando a ser de viagem, a ligação e a marca voltam juntas.
 * Quem pergunta: o recorte do jogador, o host (pedido de viagem), o painel e
 * o desenho do mestre — um predicado só para os quatro.
 */
export function isArrivalOnly(pin: Pin): boolean {
  return pin.kind === 'viagem' && pin.soChegada === true
}

/**
 * Marca (`on`) ou desmarca o pino `pinId` desta cena como chegada oculta.
 * Devolve o MESMO mapa quando nada muda, para quem grava não sujar a cena à toa.
 * Pino que sumiu ou que não é de viagem fica como está.
 */
export function setArrivalOnly(map: MapData, pinId: string, on: boolean): MapData {
  const pin = map.pins.find((p) => p.id === pinId)
  if (pin === undefined || pin.kind !== 'viagem') return map
  if ((pin.soChegada === true) === on) return map
  return {
    ...map,
    pins: map.pins.map((p) => {
      if (p.id !== pinId) return p
      if (on) return { ...p, soChegada: true }
      // Desmarcar TIRA a chave, em vez de gravar `undefined`: o pino volta a
      // ser, campo a campo, o par de sempre.
      const { soChegada: _tirada, ...semMarca } = p
      return semMarca
    }),
  }
}

/**
 * ENCRUZILHADA — um pino de viagem com várias saídas.
 *
 * A principal continua em `Pin.destino` (rótulo em `Pin.rotulo`) e as outras
 * em `Pin.saidas`: mapa gravado antes disto abre sem migração, e todo código
 * que só conhece `destino` continua certo para o pino de uma saída. O id da
 * principal é fixo — é o que vale quando o pedido do jogador não diz a saída
 * (cliente antigo) — e nenhuma saída extra pode usá-lo.
 */
export const SAIDA_PRINCIPAL = 'principal'
/** Teto do id de uma saída: o mesmo `REQ_ID_MAX_LENGTH` que o protocolo aceita no pedido. */
export const EXIT_ID_MAX_LENGTH = 64
/** Teto do rótulo: cabe num botão do cartão do jogador sem virar parágrafo. */
export const EXIT_LABEL_MAX_LENGTH = 40
/**
 * Teto de saídas EXTRAS de um pino (12 saídas contando a principal). Sem ele,
 * um arquivo com dezenas de milhares de saídas válidas congelava o host: o
 * recorte do jogador remonta `escolhas` por pino a cada envio, e a comparação
 * de ligações é quadrática no número de saídas (revisão de segurança, 22/09).
 */
export const EXIT_EXTRA_MAX_COUNT = 11

/** Uma saída que leva a algum lugar, com o id que o pedido do jogador usa. */
export interface TravelExit {
  id: string
  rotulo: string
  destino: PinDestination
}

/** O rótulo como o disco e o painel o guardam: texto, sem espaço nas pontas, no teto. */
export function cleanExitLabel(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, EXIT_LABEL_MAX_LENGTH) : ''
}

/**
 * Leitura do disco das saídas extras. Saída sem id, com id repetido (ou o da
 * principal), longo demais, ou com destino fora da forma é DESCARTADA — as
 * outras ficam. Nada sobrou = campo ausente, o pino de uma saída de sempre.
 */
export function readPinExits(value: unknown): PinExit[] | undefined {
  if (!Array.isArray(value)) return undefined
  const vistos = new Set<string>([SAIDA_PRINCIPAL])
  const saidas: PinExit[] = []
  for (const item of value) {
    if (saidas.length >= EXIT_EXTRA_MAX_COUNT) break
    if (item === null || typeof item !== 'object') continue
    const { id, rotulo, destino } = item as Record<string, unknown> // objeto não-nulo acima; cada campo é conferido abaixo
    if (typeof id !== 'string' || id.length === 0 || id.length > EXIT_ID_MAX_LENGTH || vistos.has(id)) continue
    const lido = readPinDestination(destino)
    if (lido === null) continue
    vistos.add(id)
    saidas.push({ id, rotulo: cleanExitLabel(rotulo), destino: lido })
  }
  return saidas.length === 0 ? undefined : saidas
}

/** As saídas que levam a algum lugar, na ordem: a principal primeiro. Só pino de VIAGEM tem saída. */
export function travelExitsOf(pin: Pin): TravelExit[] {
  if (pin.kind !== 'viagem') return []
  const saidas: TravelExit[] = []
  if (isPinDestination(pin.destino)) saidas.push({ id: SAIDA_PRINCIPAL, rotulo: pin.rotulo ?? '', destino: pin.destino })
  for (const saida of pin.saidas ?? []) {
    if (saida.id !== SAIDA_PRINCIPAL && isPinDestination(saida.destino)) saidas.push(saida)
  }
  return saidas
}

/** A saída `exitId` do pino (ausente = a principal), ou `null` se ela não leva a lugar nenhum. */
export function travelExitOf(pin: Pin, exitId: string = SAIDA_PRINCIPAL): TravelExit | null {
  return travelExitsOf(pin).find((saida) => saida.id === exitId) ?? null
}

/**
 * O que o JOGADOR lê de cada saída: o id e o rótulo, nunca o destino. Sem
 * rótulo, "Saída 1", "Saída 2"… pela posição — um botão sem nome não dá
 * para escolher.
 */
export function exitLabelsOf(pin: Pin): PinExitLabel[] {
  return travelExitsOf(pin).map((saida, index) => {
    const rotulo = cleanExitLabel(saida.rotulo)
    return { id: saida.id, rotulo: rotulo === '' ? `Saída ${index + 1}` : rotulo }
  })
}

/**
 * As saídas de uma placa que o jogador ainda NÃO consegue ler (pino "só de
 * perto", ficha longe): o id fica — é com ele que o pedido de passagem volta —,
 * mas o nome vira "Saída N" pela posição. O rótulo é texto escrito na placa, e
 * texto de pino "só de perto" não sai de longe.
 */
export function unreadExitLabels(saidas: readonly PinExitLabel[]): PinExitLabel[] {
  return saidas.map((saida, index) => ({ id: saida.id, rotulo: `Saída ${index + 1}` }))
}

/** Alguma saída do pino leva a `destino`. É assim que o par "aponta de volta". */
export function leadsTo(pin: Pin, destino: PinDestination): boolean {
  return travelExitsOf(pin).some((saida) => sameDestination(saida.destino, destino))
}

/** O que muda num pino quando uma saída dele muda: vai direto para `updatePin`. */
export type ExitPatch = Partial<Pick<Pin, 'destino' | 'rotulo' | 'saidas'>>

/**
 * Liga a saída `exitId` a `destino`, ou a desliga (`null`). Desligar a
 * principal de uma encruzilhada faz a primeira extra subir para o lugar dela:
 * a principal é a que o cliente antigo pede, e um pino com saídas extras e
 * sem principal deixaria esse jogador sem porta nenhuma.
 * Não confere o tipo do pino: quem desliga o par de um pino que deixou de ser
 * de viagem ainda precisa achar a ligação crua.
 */
export function setExitDestination(pin: Pin, exitId: string, destino: PinDestination | null): ExitPatch {
  const extras = pin.saidas ?? []
  if (exitId === SAIDA_PRINCIPAL) {
    if (destino !== null) return { destino }
    const [primeira, ...resto] = extras
    if (primeira === undefined) return { destino: null }
    return { destino: primeira.destino, rotulo: primeira.rotulo === '' ? undefined : primeira.rotulo, saidas: resto.length === 0 ? undefined : resto }
  }
  if (!extras.some((saida) => saida.id === exitId)) return {}
  if (destino === null) {
    const resto = extras.filter((saida) => saida.id !== exitId)
    return { saidas: resto.length === 0 ? undefined : resto }
  }
  return { saidas: extras.map((saida) => (saida.id === exitId ? { ...saida, destino } : saida)) }
}

/**
 * "+ Outra saída": acrescenta a saída `exitId` para `destino`. Pino ainda sem
 * a principal ganha a principal — a primeira ligação é sempre a de hoje.
 */
export function addExit(pin: Pin, exitId: string, destino: PinDestination): ExitPatch {
  if (!isPinDestination(pin.destino)) return { destino }
  const extras = pin.saidas ?? []
  if (extras.length >= EXIT_EXTRA_MAX_COUNT) return {}
  return { saidas: [...extras, { id: exitId, rotulo: '', destino }] }
}

/** Dá nome à saída `exitId`. Vazio = sem nome (o jogador lê "Saída N"). */
export function renameExit(pin: Pin, exitId: string, rotulo: string): ExitPatch {
  const limpo = cleanExitLabel(rotulo)
  if (exitId === SAIDA_PRINCIPAL) return { rotulo: limpo === '' ? undefined : limpo }
  const extras = pin.saidas ?? []
  if (!extras.some((saida) => saida.id === exitId)) return {}
  return { saidas: extras.map((saida) => (saida.id === exitId ? { ...saida, rotulo: limpo } : saida)) }
}

/** Mesmas saídas, mesmos rótulos: o que `updatePin` usa para não empilhar desfazer vazio. */
export function sameExits(a: Pin, b: Pin): boolean {
  if ((a.rotulo ?? '') !== (b.rotulo ?? '')) return false
  const x = a.saidas ?? []
  const y = b.saidas ?? []
  return x.length === y.length && x.every((saida, i) => saida.id === y[i].id && saida.rotulo === y[i].rotulo && sameDestination(saida.destino, y[i].destino))
}

/** As ligações CRUAS do pino (sem conferir tipo nem forma), com o id de cada saída. */
function rawLinks(pin: Pin): { id: string; destino: PinDestination | null | undefined }[] {
  return [{ id: SAIDA_PRINCIPAL, destino: pin.destino }, ...(pin.saidas ?? [])]
}

/** Uma cena como a ligação a enxerga: o nome e o mapa (`null` = a cena não abriu). */
export interface TravelScene {
  name: string
  map: MapData | null
}

/** Para onde um pino de viagem leva, do ponto de vista da cena onde ele está. */
export type PinTravel =
  | { status: 'sem-destino' }
  /** A cena de destino está na aventura, mas o arquivo dela não abriu. */
  | { status: 'indisponivel'; sceneId: string; sceneName: string }
  | { status: 'ligado'; sceneId: string; sceneName: string; partner: Pin }

const SEM_DESTINO: PinTravel = { status: 'sem-destino' }

/**
 * Resolve a ligação da saída `exitId` de `pin` (ausente = a principal), que
 * mora na cena `hereSceneId`. `sceneById` entrega as cenas da aventura (a
 * aberta e as de fundo). Ligação para a própria cena não existe: o painel só
 * oferece as OUTRAS cenas. O par vale se QUALQUER saída dele volta para este
 * pino: o par também pode ser uma encruzilhada.
 */
export function resolvePinTravel(
  pin: Pin,
  hereSceneId: string | null,
  sceneById: (sceneId: string) => TravelScene | null,
  exitId: string = SAIDA_PRINCIPAL,
): PinTravel {
  const destino = travelExitOf(pin, exitId)?.destino ?? null
  if (destino === null || hereSceneId === null || destino.sceneId === hereSceneId) return SEM_DESTINO
  const scene = sceneById(destino.sceneId)
  if (scene === null) return SEM_DESTINO
  if (scene.map === null) return { status: 'indisponivel', sceneId: destino.sceneId, sceneName: scene.name }
  const partner = scene.map.pins.find((p) => p.id === destino.pinId)
  if (partner === undefined) return SEM_DESTINO
  if (!leadsTo(partner, { sceneId: hereSceneId, pinId: pin.id })) return SEM_DESTINO
  return { status: 'ligado', sceneId: destino.sceneId, sceneName: scene.name, partner }
}

/** Um pino da cena aberta cuja ligação mudou entre dois estados do mapa. */
export interface TravelLinkChange {
  pinId: string
  before: PinDestination | null
  after: PinDestination | null
}

/** Os destinos de todas as saídas de cada pino de viagem que leva a algum lugar. */
function linksOf(pins: readonly Pin[]): Map<string, PinDestination[]> {
  const links = new Map<string, PinDestination[]>()
  for (const pin of pins) {
    const destinos = travelExitsOf(pin).map((saida) => saida.destino)
    if (destinos.length > 0) links.set(pin.id, destinos)
  }
  return links
}

const semOs = (lista: readonly PinDestination[], tirar: readonly PinDestination[]): PinDestination[] =>
  lista.filter((destino) => !tirar.some((outro) => sameDestination(outro, destino)))

/**
 * O que mudou nas ligações entre `before` e `after` da MESMA cena: pino
 * ligado, desligado, religado a outro par, apagado (sai com `after: null`),
 * devolvido pelo desfazer (entra com `before: null`) ou que deixou de ser de
 * viagem. É a entrada de quem mantém o par do outro lado em dia.
 *
 * Numa encruzilhada cada saída é uma ligação: o que saiu e o que entrou são
 * pareados na ordem (religar uma saída continua sendo UMA mudança com antes e
 * depois), e o que sobra sai sozinho. Saída que só mudou de rótulo não muda
 * ligação nenhuma.
 */
export function travelLinkChanges(before: readonly Pin[], after: readonly Pin[]): TravelLinkChange[] {
  if (before === after) return []
  const antes = linksOf(before)
  const depois = linksOf(after)
  const changes: TravelLinkChange[] = []
  const parear = (pinId: string, eram: readonly PinDestination[], sao: readonly PinDestination[]) => {
    const sairam = semOs(eram, sao)
    const entraram = semOs(sao, eram)
    for (let i = 0; i < Math.max(sairam.length, entraram.length); i++) {
      changes.push({ pinId, before: sairam[i] ?? null, after: entraram[i] ?? null })
    }
  }
  for (const [pinId, destinos] of depois) parear(pinId, antes.get(pinId) ?? [], destinos)
  for (const [pinId, destinos] of antes) {
    if (!depois.has(pinId)) parear(pinId, destinos, [])
  }
  return changes
}

function withPatch(map: MapData, pinId: string, patch: ExitPatch): MapData {
  return { ...map, pins: map.pins.map((p) => (p.id === pinId ? { ...p, ...patch } : p)) }
}

/**
 * Grava no pino `partnerId` desta cena a volta para `back` (o outro lado da
 * mão dupla). Devolve o mapa — o MESMO objeto quando nada muda — e o destino
 * que o par tinha antes, que perdeu a volta e precisa ser desligado.
 * Pino que sumiu ou que não é de viagem não é ligado: a ida fica sem volta e
 * `resolvePinTravel` a trata como "sem destino".
 */
export function linkBack(map: MapData, partnerId: string, back: PinDestination): { map: MapData; displaced: PinDestination | null } {
  const partner = map.pins.find((p) => p.id === partnerId)
  if (partner === undefined || partner.kind !== 'viagem') return { map, displaced: null }
  // O par já volta para cá por alguma saída (ele mesmo pode ser encruzilhada): nada a gravar.
  if (leadsTo(partner, back)) return { map, displaced: null }
  const current = travelDestinationOf(partner)
  return { map: withPatch(map, partnerId, { destino: { sceneId: back.sceneId, pinId: back.pinId } }), displaced: current }
}

/**
 * Desliga, no pino `partnerId` desta cena, a saída que ainda leva a `back`.
 * Quem já foi religado a outro par fica como está: desligar A não pode
 * desmanchar a ligação nova de B com C. Numa encruzilhada, só a saída que
 * voltava para `back` sai; as outras ficam.
 */
export function unlinkBack(map: MapData, partnerId: string, back: PinDestination): MapData {
  const partner = map.pins.find((p) => p.id === partnerId)
  if (partner === undefined) return map
  const saida = rawLinks(partner).find((link) => sameDestination(link.destino, back))
  if (saida === undefined) return map
  const desligado = withPatch(map, partnerId, setExitDestination(partner, saida.id, null))
  // MÃO ÚNICA ÓRFÃ: a origem sumiu (apagada, religada a outro par, desligada)
  // e a chegada oculta volta a ser um pino de viagem COMUM, sem par — não
  // some. Apagar pino do mestre numa cena que ele nem está olhando seria
  // perder trabalho sem aviso; e uma chegada escondida sem origem ficaria
  // invisível ao jogador para sempre, sem motivo que o mestre enxergue.
  return setArrivalOnly(desligado, partnerId, false)
}

/** Direções em que o pino de chegada procura lugar quando o centro já tem pino. */
const DIRECOES: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
]
/** Quantas casas para fora do centro a procura vai antes de desistir e empilhar. */
const ANEIS_DE_PROCURA = 4

/**
 * Onde o pino de chegada nasce: no centro da cena, para o mestre achar e
 * arrastar. Se o centro já tem pino (a segunda ligação para a mesma cena), a
 * chegada nasce na casa livre mais perto — dois pinos na mesma ponta deixariam
 * o de baixo impossível de clicar.
 */
export function arrivalPoint(map: MapData): { x: number; y: number } {
  const largura = map.width * map.grid
  const altura = map.height * map.grid
  const centro = { x: largura / 2, y: altura / 2 }
  const livre = (x: number, y: number) => map.pins.every((p) => Math.hypot(p.x - x, p.y - y) >= PIN_HEAD_RADIUS * 2)
  if (livre(centro.x, centro.y)) return centro
  for (let anel = 1; anel <= ANEIS_DE_PROCURA; anel++) {
    for (const [dx, dy] of DIRECOES) {
      const x = centro.x + dx * anel * map.grid
      const y = centro.y + dy * anel * map.grid
      if (x < 0 || y < 0 || x > largura || y > altura) continue
      if (livre(x, y)) return { x, y }
    }
  }
  return centro
}

/**
 * Onde o token de quem ATRAVESSA assenta na cena de destino: na ponta do pino
 * par, grudado no centro da célula como o snap de token do editor
 * (`snapPointForTarget` + `seatTokenCenter`, o mesmo par de `applySnap`), e
 * puxado para dentro do mapa — pino arrastado até a borda não pode largar a
 * ficha fora do mundo, onde nenhum movimento a traria de volta.
 */
export function arrivalSpot(map: MapData, partner: Pin, tokenCells: number): { x: number; y: number } {
  const raw = { x: partner.x, y: partner.y }
  const snapped = snapPointForTarget('token', map.gridShape, raw.x, raw.y, map.grid)
  const seated = map.gridShape === 'square' ? seatTokenCenter(raw, snapped, map.grid, tokenCells) : snapped
  const largura = map.width * map.grid
  const altura = map.height * map.grid
  return { x: Math.min(largura, Math.max(0, seated.x)), y: Math.min(altura, Math.max(0, seated.y)) }
}

/** O ponto que a câmera centraliza ao chegar por um pino: o meio do desenho, não a ponta cravada. */
export function pinFocusPoint(pin: Pin): { x: number; y: number } {
  return { x: pin.x, y: pin.y - PIN_HEIGHT / 2 }
}

/** Uma cena na lista "Leva a…". */
export interface TravelSceneOption {
  id: string
  name: string
  /** `false` = o arquivo da cena não abriu: aparece, desabilitada, com o motivo. */
  available: boolean
}

/** Um pino de viagem da cena escolhida, para ligar a um que já existe. */
export interface TravelPinOption {
  id: string
  label: string
  /** Por que não dá para escolher (`null` = livre): ele já é o destino atual, ou já leva a outra cena. */
  note: string | null
}

/**
 * Os pinos de viagem de `sceneId` que podem receber a ligação de `pinId`
 * (da cena `hereSceneId`). Pino já ligado a outro aparece com o motivo em vez
 * de sumir: o mestre vê que ele existe e por que não dá para escolhê-lo.
 */
export function travelPinOptions(
  sceneId: string,
  hereSceneId: string | null,
  pinId: string,
  sceneById: (sceneId: string) => TravelScene | null,
): TravelPinOption[] {
  const map = sceneById(sceneId)?.map ?? null
  if (map === null) return []
  const doMestre: PinDestination | null = hereSceneId === null ? null : { sceneId: hereSceneId, pinId }
  return map.pins
    .filter((p) => p.kind === 'viagem')
    .map((p, index) => {
      const label = p.description.trim() === '' ? `${pinSummary(p)} ${index + 1}` : pinSummary(p)
      const travel = resolvePinTravel(p, sceneId, sceneById)
      if (travel.status !== 'ligado') return { id: p.id, label, note: null }
      if (doMestre !== null && leadsTo(p, doMestre)) return { id: p.id, label, note: 'destino atual' }
      return { id: p.id, label, note: `já leva a ${travel.sceneName}` }
    })
}
