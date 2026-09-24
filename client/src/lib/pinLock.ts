import type { MapData, Pin, PinLock, PinLockForm, PinLockPublic, PinPassage } from '../types/map'

/**
 * FECHADURA COM SEGREDO — o jogador digita ou gira a combinação no cartão do
 * pino, o HOST confere contra a resposta que só ele guarda e, se bateu, abre a
 * fechadura (e destranca a porta ligada). Aqui mora a parte pura: normalizar,
 * conferir, o que o jogador pode saber e o efeito de abrir.
 */

/** Teto da tentativa que o jogador manda (e do campo do mestre), em unidades UTF-16. */
export const LOCK_ANSWER_MAX_LENGTH = 64

/** A ordem do seletor do mestre. */
export const PIN_LOCK_FORMS: readonly PinLockForm[] = ['teclado', 'volantes']

export const PIN_LOCK_FORM_LABELS: Record<PinLockForm, string> = {
  teclado: 'Teclado',
  volantes: 'Volantes',
}

export function isPinLockForm(value: unknown): value is PinLockForm {
  return PIN_LOCK_FORMS.some((form) => form === value)
}

/**
 * Espaço, traço, ponto, barra, vírgula e sublinhado não contam, nem a caixa:
 * "6-12-18", "6 12 18" e "61218" são a mesma combinação. É o jeito como a
 * mesa DIZ a combinação ("seis, doze, dezoito"), e o volante não tem traço.
 */
export function normalizeLockAnswer(text: string): string {
  return text.toLowerCase().replace(/[\s\-./,_]+/g, '')
}

/** Só número: é o que um volante (0 a 9) consegue mostrar. */
const SO_NUMEROS = /^[0-9]+$/

/** Fechada = tem resposta de verdade e ninguém acertou ainda. Sem resposta, não tranca nada. */
export function isLockClosed(pin: Pin): boolean {
  const lock = pin.segredo
  return lock !== undefined && lock.aberta !== true && normalizeLockAnswer(lock.resposta) !== ''
}

/** A tentativa abre? Vazia nunca abre, nem uma fechadura sem resposta. */
export function lockAccepts(lock: PinLock, attempt: string): boolean {
  const certa = normalizeLockAnswer(lock.resposta)
  return certa !== '' && normalizeLockAnswer(attempt) === certa
}

/**
 * O que o jogador vê de uma fechadura FECHADA: a forma e, nos volantes,
 * quantas casas — o que qualquer um enxerga olhando o cadeado. O teclado não
 * leva `casas`: o campo não mostra o tamanho da senha, e o número saindo pela
 * rede contaria ao jogador o que o mestre escondeu. `null` = nada a mostrar
 * (sem fechadura, sem resposta ou já aberta). Volante com resposta que não é
 * só número vira teclado: o jogador não teria como girar a letra.
 */
export function publicLockOf(pin: Pin): PinLockPublic | null {
  const lock = pin.segredo
  if (lock === undefined || !isLockClosed(pin)) return null
  const certa = normalizeLockAnswer(lock.resposta)
  if (lock.forma === 'volantes' && SO_NUMEROS.test(certa)) return { forma: 'volantes', casas: certa.length }
  return { forma: 'teclado' }
}

/**
 * A fechadura como veio do disco. Sem `resposta` em texto não há fechadura
 * (`undefined`); forma desconhecida volta `teclado`; `aberta` só `true`;
 * `abrePorta` só texto. Campo que a versão não conhece fica de fora.
 */
export function readPinLock(value: unknown): PinLock | undefined {
  if (!isRecord(value)) return undefined
  const { resposta, forma, aberta, abrePorta } = value
  if (typeof resposta !== 'string') return undefined
  const lock: PinLock = { resposta: resposta.slice(0, LOCK_ANSWER_MAX_LENGTH), forma: isPinLockForm(forma) ? forma : 'teclado' }
  if (aberta === true) lock.aberta = true
  if (typeof abrePorta === 'string' && abrePorta !== '') lock.abrePorta = abrePorta
  return lock
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** As duas fechaduras são a mesma? `undefined` só é igual a `undefined`. */
export function sameLock(a: PinLock | undefined, b: PinLock | undefined): boolean {
  if (a === undefined || b === undefined) return a === b
  return a.resposta === b.resposta && a.forma === b.forma && a.aberta === b.aberta && a.abrePorta === b.abrePorta
}

/** Quantas portas o seletor "Destranca também" oferece: as mais perto do pino. */
export const LOCK_DOOR_OPTIONS_MAX = 12

/** Uma porta que a fechadura pode destrancar, como o painel do mestre a mostra. */
export interface LockDoorOption {
  id: string
  label: string
}

/**
 * As portas que a fechadura do `pin` pode destrancar: as TRANCADAS da cena, da
 * mais perto para a mais longe (a porta não tem nome; a distância é o que o
 * mestre reconhece olhando o mapa), até `LOCK_DOOR_OPTIONS_MAX`. A já ligada
 * entra sempre, mesmo destrancada — senão o seletor a perderia depois que um
 * jogador acertou.
 */
export function lockDoorOptions(map: MapData, pin: Pin): LockDoorOption[] {
  const ligada = pin.segredo?.abrePorta
  const quadro = map.grid > 0 ? map.grid : 1
  const portas = map.walls.flatMap((w) => {
    if (w.door === null || (!w.door.locked && w.id !== ligada)) return []
    const distancia = Math.hypot((w.x1 + w.x2) / 2 - pin.x, (w.y1 + w.y2) / 2 - pin.y)
    return [{ id: w.id, locked: w.door.locked, distancia }]
  })
  portas.sort((a, b) => a.distancia - b.distancia)
  const perto = portas.slice(0, LOCK_DOOR_OPTIONS_MAX)
  const faltou = portas.find((p) => p.id === ligada && !perto.includes(p))
  if (faltou !== undefined) perto.push(faltou)
  return perto.map((p) => {
    const quadros = Math.round(p.distancia / quadro)
    const onde = quadros === 1 ? 'a 1 quadro' : `a ${quadros} quadros`
    return { id: p.id, label: p.locked ? `Porta trancada ${onde}` : `Porta ${onde} (já destrancada)` }
  })
}

/** A passagem de um pino `trancada` depois que a combinação abriu: o jogador pede, o mestre decide. */
const PASSAGEM_DEPOIS_DO_SEGREDO: PinPassage = 'pede'

/**
 * Um jogador acertou: a fechadura do pino `pinId` fica aberta, e a porta
 * ligada (`abrePorta`) fica DESTRANCADA — fechada como estava: quem abre a
 * porta é o jogador, pelo toque de sempre. Pino com passagem `trancada` volta
 * a `pede`: o cartão prometeu "acerte a combinação para passar", então a
 * combinação é a chave da tranca também — e o mestre continua decidindo quem
 * passa. Transformação pura e reaplicável (entra também nos passos do desfazer
 * da cena); nada a mudar devolve o mesmo `map`. Porta que sumiu do mapa não
 * impede o pino de abrir.
 */
export function openPinLock(map: MapData, pinId: string): MapData {
  const pin = map.pins.find((p) => p.id === pinId)
  const lock = pin?.segredo
  if (pin === undefined || lock === undefined || lock.aberta === true) return map
  const aberta: PinLock = { ...lock, aberta: true }
  const pins = map.pins.map((p) => {
    if (p.id !== pinId) return p
    return p.passagem === 'trancada' ? { ...p, segredo: aberta, passagem: PASSAGEM_DEPOIS_DO_SEGREDO } : { ...p, segredo: aberta }
  })
  const walls = map.walls.map((w) => (w.id === lock.abrePorta && w.door !== null && w.door.locked ? { ...w, door: { ...w.door, locked: false } } : w))
  return { ...map, pins, walls }
}
