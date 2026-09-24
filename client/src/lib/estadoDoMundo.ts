import type { ConcealZone, DoorState, EfeitoNaPorta, EfeitoNaZona, MapData, Pin, PinPassage, RegraDeEstado, Wall } from '../types/map'
import { isPinPassage } from './pins'

/**
 * ESTADO DO MUNDO — o mestre troca "Maré: alta → baixa" e as portas, os pinos
 * de viagem e as zonas ocultas amarrados à Maré, em todas as cenas, mudam
 * juntos. Plano: `docs/planos/estado-do-mundo.md`.
 *
 * A definição e o valor atual moram na aventura (`Adventure.estados`); a regra
 * mora no elemento (`porEstado`). Aplicar é GRAVAR o efeito no campo de sempre
 * (`open`/`locked`, `passagem`, `revealed`): colisão, névoa e host continuam
 * lendo só esses campos e nunca precisam conhecer o estado.
 */

export interface EstadoDoMundo {
  /** Estável: é o que `porEstado.estadoId` cita. */
  id: string
  /** "Maré" — só do mestre; nunca vai ao jogador. */
  nome: string
  /** Sem repetição e sem texto vazio; pelo menos um. */
  valores: string[]
  /** Sempre um de `valores`. */
  atual: string
}

/** Quanto uma troca mudou, para o aviso do painel. */
export interface ResumoDaTroca {
  elementos: number
  cenas: number
}

const EFEITOS_NA_PORTA: readonly EfeitoNaPorta[] = ['aberta', 'fechada', 'trancada']
const EFEITOS_NA_ZONA: readonly EfeitoNaZona[] = ['oculta', 'revelada']

export function isEfeitoNaPorta(value: unknown): value is EfeitoNaPorta {
  return EFEITOS_NA_PORTA.some((efeito) => efeito === value)
}

export function isEfeitoNaZona(value: unknown): value is EfeitoNaZona {
  return EFEITOS_NA_ZONA.some((efeito) => efeito === value)
}

/** O efeito da regra para `valor`, ou `undefined` quando a regra não é deste estado ou não fala desse valor. */
function efeitoPara<E extends string>(regra: RegraDeEstado<E> | undefined, estadoId: string, valor: string): E | undefined {
  if (regra === undefined || regra.estadoId !== estadoId) return undefined
  return regra.efeitos.find((entrada) => entrada.valor === valor)?.efeito
}

function portaCom(door: DoorState, efeito: EfeitoNaPorta): DoorState {
  const open = efeito === 'aberta'
  const locked = efeito === 'trancada'
  return door.open === open && door.locked === locked ? door : { ...door, open, locked }
}

function paredeNoEstado(wall: Wall, estadoId: string, valor: string): Wall {
  if (wall.door === null) return wall
  const efeito = efeitoPara(wall.door.porEstado, estadoId, valor)
  if (efeito === undefined) return wall
  const door = portaCom(wall.door, efeito)
  return door === wall.door ? wall : { ...wall, door }
}

function pinoNoEstado(pin: Pin, estadoId: string, valor: string): Pin {
  const efeito = efeitoPara(pin.porEstado, estadoId, valor)
  // `passagem` ausente vale 'pede' (`types/map.ts`): não reescrever o que já é.
  if (efeito === undefined || (pin.passagem ?? 'pede') === efeito) return pin
  return { ...pin, passagem: efeito }
}

function zonaNoEstado(zone: ConcealZone, estadoId: string, valor: string): ConcealZone {
  const efeito = efeitoPara(zone.porEstado, estadoId, valor)
  if (efeito === undefined) return zone
  const revealed = efeito === 'revelada'
  return zone.revealed === revealed ? zone : { ...zone, revealed }
}

/** A lista com cada item trocado por `mudar`, ou a MESMA lista quando nenhum mudou. */
function mesmaOuNova<T>(lista: T[], mudar: (item: T) => T): T[] {
  let mudou = false
  const nova = lista.map((item) => {
    const depois = mudar(item)
    if (depois !== item) mudou = true
    return depois
  })
  return mudou ? nova : lista
}

/**
 * O mapa com o efeito de `estadoId = valor` gravado em cada porta, pino e zona
 * amarrados. Devolve o MESMO mapa quando nada muda (cena que não fica pendente
 * de Salvar). Pura e válida para qualquer versão do mapa: serve de `transform`
 * para `applyPlayerChange`, que a reaplica no histórico do desfazer.
 */
export function aplicarEstadoNoMapa(map: MapData, estadoId: string, valor: string): MapData {
  const walls = mesmaOuNova(map.walls, (w) => paredeNoEstado(w, estadoId, valor))
  const pins = mesmaOuNova(map.pins, (p) => pinoNoEstado(p, estadoId, valor))
  const concealZones = mesmaOuNova(map.concealZones, (z) => zonaNoEstado(z, estadoId, valor))
  if (walls === map.walls && pins === map.pins && concealZones === map.concealZones) return map
  return { ...map, walls, pins, concealZones }
}

/** Quantos elementos do mapa `aplicarEstadoNoMapa` mudaria. */
export function contarMudancas(map: MapData, estadoId: string, valor: string): number {
  const portas = map.walls.filter((w) => paredeNoEstado(w, estadoId, valor) !== w).length
  const pinos = map.pins.filter((p) => pinoNoEstado(p, estadoId, valor) !== p).length
  const zonas = map.concealZones.filter((z) => zonaNoEstado(z, estadoId, valor) !== z).length
  return portas + pinos + zonas
}

/** Quantos elementos do mapa obedecem a `estadoId`. */
export function contarAmarrados(map: MapData, estadoId: string): number {
  const cita = (regra: RegraDeEstado<string> | undefined) => regra?.estadoId === estadoId
  return (
    map.walls.filter((w) => w.door !== null && cita(w.door.porEstado)).length +
    map.pins.filter((p) => cita(p.porEstado)).length +
    map.concealZones.filter((z) => cita(z.porEstado)).length
  )
}

/**
 * Quantos elementos obedecem a cada estado, somando `mapas` — uma passada só
 * por mapa, qualquer que seja o número de estados. O painel do mestre mostra
 * a conta ao lado de cada estado.
 */
export function amarradosPorEstado(mapas: Iterable<MapData>): Map<string, number> {
  const conta = new Map<string, number>()
  const soma = (regra: RegraDeEstado<string> | undefined) => {
    if (regra !== undefined) conta.set(regra.estadoId, (conta.get(regra.estadoId) ?? 0) + 1)
  }
  for (const map of mapas) {
    for (const w of map.walls) if (w.door !== null) soma(w.door.porEstado)
    for (const p of map.pins) soma(p.porEstado)
    for (const z of map.concealZones) soma(z.porEstado)
  }
  return conta
}

// ───────────────────────────────────────────────────────────────────────────
// Criar e trocar
// ───────────────────────────────────────────────────────────────────────────

/** "alta, baixa, alta, " → ["alta", "baixa"]: sem vazio e sem repetição, na ordem. */
export function valoresDoTexto(texto: string): string[] {
  const valores: string[] = []
  for (const bruto of texto.split(',')) {
    const valor = bruto.trim()
    if (valor.length > 0 && !valores.includes(valor)) valores.push(valor)
  }
  return valores
}

/** Estado novo com o primeiro valor como atual, ou `null` sem nome ou sem valor. */
export function novoEstadoDoMundo(nome: string, valoresTexto: string): EstadoDoMundo | null {
  const limpo = nome.trim()
  const valores = valoresDoTexto(valoresTexto)
  if (limpo.length === 0 || valores.length === 0) return null
  return { id: `estado_${crypto.randomUUID()}`, nome: limpo, valores, atual: valores[0] }
}

/** A lista com `estadoId` no valor `valor`, ou `null` quando o estado não existe ou o valor não é dele. */
export function comValorAtual(estados: readonly EstadoDoMundo[], estadoId: string, valor: string): EstadoDoMundo[] | null {
  const alvo = estados.find((estado) => estado.id === estadoId)
  if (alvo === undefined || !alvo.valores.includes(valor)) return null
  return estados.map((estado) => (estado.id === estadoId ? { ...estado, atual: valor } : estado))
}

// ───────────────────────────────────────────────────────────────────────────
// Leitura do disco (arquivo editado à mão, versão futura)
// ───────────────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * A regra lida do disco. Sem `estadoId` de texto, ou sem nenhum efeito bom:
 * `undefined` (o elemento volta a ser o de sempre). Efeito desconhecido, valor
 * que não é texto e valor repetido saem da lista; os bons ficam.
 */
export function regraDoArquivo<E extends string>(raw: unknown, isEfeito: (value: unknown) => value is E): RegraDeEstado<E> | undefined {
  if (!isRecord(raw)) return undefined
  const { estadoId, efeitos } = raw
  if (typeof estadoId !== 'string' || estadoId.length === 0 || !Array.isArray(efeitos)) return undefined
  const bons: RegraDeEstado<E>['efeitos'] = []
  for (const entrada of efeitos) {
    if (!isRecord(entrada)) continue
    const { valor, efeito } = entrada
    if (typeof valor !== 'string' || !isEfeito(efeito) || bons.some((b) => b.valor === valor)) continue
    bons.push({ valor, efeito })
  }
  return bons.length === 0 ? undefined : { estadoId, efeitos: bons }
}

export function regraDePinoDoArquivo(raw: unknown): RegraDeEstado<PinPassage> | undefined {
  return regraDoArquivo(raw, isPinPassage)
}

/**
 * Valores lidos do disco: só texto não vazio, sem repetição. Sem `trim`: a
 * regra de cada elemento cita o valor exatamente como foi gravado.
 */
function valoresDoArquivo(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const valores: string[] = []
  for (const valor of raw) {
    if (typeof valor === 'string' && valor.trim().length > 0 && !valores.includes(valor)) valores.push(valor)
  }
  return valores
}

/**
 * A lista de estados lida do `adventure.json`. Ausente (aventura antiga) ou
 * que não é lista: `undefined`, e a aventura grava sem a chave. Estado sem id,
 * com id repetido ou sem valor bom sai; `atual` fora da lista volta ao primeiro.
 */
export function estadosDoArquivo(raw: unknown): EstadoDoMundo[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const estados: EstadoDoMundo[] = []
  for (const bruto of raw) {
    if (!isRecord(bruto)) continue
    const { id, nome, valores, atual } = bruto
    if (typeof id !== 'string' || id.length === 0 || estados.some((e) => e.id === id)) continue
    const limpos = valoresDoArquivo(valores)
    if (limpos.length === 0) continue
    estados.push({
      id,
      nome: typeof nome === 'string' && nome.trim().length > 0 ? nome : id,
      valores: limpos,
      atual: typeof atual === 'string' && limpos.includes(atual) ? atual : limpos[0],
    })
  }
  return estados
}
