import type { CabineNaParada, PinDestination } from '../types/map'
import { readPinDestination, sameDestination } from './pinTravel'

/**
 * CABINE DE TRANSPORTE — elevador, paternoster, cesto: um pino de viagem que
 * só leva quando a cabine está nele. Plano: `docs/planos/cabine-de-transporte-p.md`.
 *
 * A cabine mora na AVENTURA (`Adventure.cabines`), porque cruza cenas e tem
 * uma posição só; o `map.json` da cena não muda. As regras aqui são puras: sem
 * store, sem DOM, sem rede.
 *
 * Três coisas dizem o estado da cabine:
 * - a POSIÇÃO (`atual`), gravada na aventura;
 * - a FILA de chamadas (`fila`), gravada na aventura: quem está numa parada
 *   sem a cabine a chama, e quem chamou primeiro está na frente;
 * - o OCUPANTE: quem embarcou e espera o "Deixar ir" do mestre. É estado da
 *   SESSÃO (o pedido pendente no host, `net/hostSession.ts`), nunca do
 *   arquivo — um app fechado com alguém "dentro" deixaria a cabine presa.
 *   Aqui ele entra como o conjunto de cabines ocupadas (`ocupadas`).
 */

/** Uma chamada da fila: de qual parada, por qual ficha, e o nome que o mestre lê. */
export interface ChamadaDeCabine {
  parada: PinDestination
  /** A ficha que chamou (a do jogador mais perto do pino). */
  tokenId: string
  /** O nome da ficha quando chamou — o que o painel do mestre lista. */
  nome: string
}

export interface CabineDeTransporte {
  /** Estável: é o que o painel e o host citam. Nunca vai ao jogador. */
  id: string
  /** "Espinha" — só do mestre; nunca vai ao jogador. */
  nome: string
  /** As paradas (cena + pino de viagem), na ordem, sem repetir. */
  paradas: PinDestination[]
  /** A parada onde a cabine está, sempre uma de `paradas`; `null` = em lugar nenhum. */
  atual: PinDestination | null
  /**
   * As chamadas, na ordem em que chegaram: uma por parada, nunca a parada
   * onde a cabine está. Ausente = ninguém chamou (e a aventura grava sem a chave).
   */
  fila?: ChamadaDeCabine[]
}

/** A cabine anda: a posição nova de `cabineId`, que o integrador grava na aventura. */
export interface MovimentoDeCabine {
  cabineId: string
  parada: PinDestination
}

/** A chamada que o host aceitou, para o integrador pôr na fila de `cabineId`. */
export interface ChamadaAceita {
  cabineId: string
  chamada: ChamadaDeCabine
}

/** Teto do nome no painel: cabe na linha da lista sem quebrar. */
export const CABINE_NOME_MAX = 40

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function temParada(paradas: readonly PinDestination[], parada: PinDestination): boolean {
  return paradas.some((p) => sameDestination(p, parada))
}

function filaDe(cabine: CabineDeTransporte): readonly ChamadaDeCabine[] {
  return cabine.fila ?? []
}

/** A parada `parada` tem chamada na fila desta cabine? */
function chamadaDe(cabine: CabineDeTransporte, parada: PinDestination): boolean {
  return filaDe(cabine).some((c) => sameDestination(c.parada, parada))
}

/**
 * A cabine com esta fila. Fila vazia tira a chave: a cabine sem chamadas fica
 * igual à de antes da fila existir (arquivo e comparação).
 */
function comFila(cabine: CabineDeTransporte, fila: readonly ChamadaDeCabine[]): CabineDeTransporte {
  const base: CabineDeTransporte = { id: cabine.id, nome: cabine.nome, paradas: cabine.paradas, atual: cabine.atual }
  return fila.length === 0 ? base : { ...base, fila: [...fila] }
}

/** Uma chamada da fila lida do arquivo, ou `null` quando está fora da forma. */
function chamadaDoArquivo(raw: unknown): ChamadaDeCabine | null {
  if (!isRecord(raw)) return null
  const parada = readPinDestination(raw.parada)
  const { tokenId, nome } = raw
  if (parada === null || typeof tokenId !== 'string' || tokenId.length === 0) return null
  const limpo = typeof nome === 'string' ? nome.trim().slice(0, CABINE_NOME_MAX) : ''
  return { parada, tokenId, nome: limpo.length > 0 ? limpo : tokenId }
}

/**
 * Leitura do `adventure.json`. Ausente = aventura antiga, que continua sem a
 * chave. Cabine sem id (ou com id repetido) sai; parada fora da forma ou
 * repetida sai; `atual` que não é parada dela vira `null` — nunca uma cabine
 * "aqui" num pino que não é parada. Na fila, sai a chamada fora da forma, a
 * de pino que não é parada, a da parada onde a cabine está e a repetida (fica
 * a primeira: quem chamou primeiro).
 */
export function cabinesDoArquivo(raw: unknown): CabineDeTransporte[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const cabines: CabineDeTransporte[] = []
  for (const bruta of raw) {
    if (!isRecord(bruta)) continue
    const { id, nome, paradas, atual, fila } = bruta
    if (typeof id !== 'string' || id.length === 0 || cabines.some((c) => c.id === id)) continue
    const limpas: PinDestination[] = []
    for (const p of Array.isArray(paradas) ? paradas : []) {
      const parada = readPinDestination(p)
      if (parada !== null && !temParada(limpas, parada)) limpas.push(parada)
    }
    const lida = readPinDestination(atual)
    const onde = lida !== null && temParada(limpas, lida) ? lida : null
    const chamadas: ChamadaDeCabine[] = []
    for (const c of Array.isArray(fila) ? fila : []) {
      const chamada = chamadaDoArquivo(c)
      if (chamada === null || !temParada(limpas, chamada.parada) || sameDestination(onde, chamada.parada)) continue
      if (chamadas.some((ja) => sameDestination(ja.parada, chamada.parada))) continue
      chamadas.push(chamada)
    }
    const cabine: CabineDeTransporte = {
      id,
      nome: typeof nome === 'string' && nome.trim().length > 0 ? nome.trim().slice(0, CABINE_NOME_MAX) : id,
      paradas: limpas,
      atual: onde,
    }
    cabines.push(comFila(cabine, chamadas))
  }
  return cabines
}

/** A cabine de que o pino `pinId` da cena `sceneId` é parada; `null` = não é parada (ou mapa solto). */
export function cabineDaParada(cabines: readonly CabineDeTransporte[] | undefined, sceneId: string | null, pinId: string): CabineDeTransporte | null {
  if (cabines === undefined || sceneId === null) return null
  const parada = { sceneId, pinId }
  return cabines.find((c) => temParada(c.paradas, parada)) ?? null
}

/**
 * O que a parada diz: a cabine está `aqui`; está aqui mas `ocupada` (alguém
 * embarcou — `ocupadas` tem o id dela); não está, e esta parada já a
 * `chamada`; ou está `longe`. `null` = o pino não é parada.
 */
export function cabineNaParada(
  cabines: readonly CabineDeTransporte[] | undefined,
  sceneId: string | null,
  pinId: string,
  ocupadas: ReadonlySet<string> = new Set(),
): CabineNaParada | null {
  const cabine = cabineDaParada(cabines, sceneId, pinId)
  if (cabine === null || sceneId === null) return null
  const parada = { sceneId, pinId }
  if (sameDestination(cabine.atual, parada)) return ocupadas.has(cabine.id) ? 'ocupada' : 'aqui'
  return chamadaDe(cabine, parada) ? 'chamada' : 'longe'
}

/**
 * Quem passa de uma parada com a cabine para outra parada DA MESMA cabine
 * leva a cabine: ela passa a estar na chegada. Qualquer outra viagem não
 * mexe em cabine nenhuma (`null`).
 */
export function cabineAposViagem(cabines: readonly CabineDeTransporte[] | undefined, de: PinDestination, para: PinDestination): MovimentoDeCabine | null {
  const cabine = cabineDaParada(cabines, de.sceneId, de.pinId)
  if (cabine === null || !sameDestination(cabine.atual, de) || !temParada(cabine.paradas, para)) return null
  return { cabineId: cabine.id, parada: { sceneId: para.sceneId, pinId: para.pinId } }
}

/** Uma cabine nova com `parada` como primeira parada e a cabine nela. Nome vazio: `null`. */
export function novaCabine(nome: string, parada: PinDestination, id: string = `cabine_${crypto.randomUUID()}`): CabineDeTransporte | null {
  const limpo = nome.trim().slice(0, CABINE_NOME_MAX)
  if (limpo.length === 0) return null
  const aqui = { sceneId: parada.sceneId, pinId: parada.pinId }
  return { id, nome: limpo, paradas: [aqui], atual: aqui }
}

/**
 * `parada` passa a ser da cabine `cabineId` (`null` = de nenhuma) e sai de
 * qualquer outra. A cabine que perde a parada onde estava vai para a primeira
 * que sobrou (e a chamada dessa parada, se havia, está atendida); a chamada da
 * parada que saiu sai da fila junto; a que ganha a primeira parada recebe a
 * cabine nela. `null` quando nada muda — quem grava não suja a aventura à toa.
 */
export function comParada(cabines: readonly CabineDeTransporte[], parada: PinDestination, cabineId: string | null): CabineDeTransporte[] | null {
  const dona = cabines.find((c) => temParada(c.paradas, parada))
  if ((dona?.id ?? null) === cabineId) return null
  if (cabineId !== null && !cabines.some((c) => c.id === cabineId)) return null
  const aqui = { sceneId: parada.sceneId, pinId: parada.pinId }
  return cabines.map((c) => {
    if (c.id === cabineId) {
      const paradas = [...c.paradas, aqui]
      return { ...c, paradas, atual: c.atual ?? aqui }
    }
    if (c === dona) {
      const paradas = c.paradas.filter((p) => !sameDestination(p, parada))
      const atual = sameDestination(c.atual, parada) ? (paradas[0] ?? null) : c.atual
      const fila = filaDe(c).filter((f) => !sameDestination(f.parada, parada) && !sameDestination(f.parada, atual))
      return comFila({ ...c, paradas, atual }, fila)
    }
    return c
  })
}

/**
 * A cabine `cabineId` passa a estar em `parada`, que tem de ser dela. A
 * chamada daquela parada, se havia, está atendida e sai da fila; as outras
 * ficam na ordem. `null` quando não dá ou ela já está lá.
 */
export function comCabineEm(cabines: readonly CabineDeTransporte[], cabineId: string, parada: PinDestination): CabineDeTransporte[] | null {
  const cabine = cabines.find((c) => c.id === cabineId)
  if (cabine === undefined || !temParada(cabine.paradas, parada) || sameDestination(cabine.atual, parada)) return null
  const aqui = { sceneId: parada.sceneId, pinId: parada.pinId }
  return cabines.map((c) =>
    c.id === cabineId
      ? comFila(
          { ...c, atual: aqui },
          filaDe(c).filter((f) => !sameDestination(f.parada, aqui)),
        )
      : c,
  )
}

/**
 * "Chamar a cabine": a chamada entra no fim da fila de `cabineId`. `null`
 * quando não entra — cabine que não existe, pino que não é parada dela,
 * parada onde ela já está, ou parada que já chamou (quem chamou primeiro
 * fica com a vez; a segunda chamada da mesma parada não passa à frente de
 * ninguém nem ocupa outro lugar).
 */
export function comChamada(cabines: readonly CabineDeTransporte[], cabineId: string, chamada: ChamadaDeCabine): CabineDeTransporte[] | null {
  const cabine = cabines.find((c) => c.id === cabineId)
  if (cabine === undefined || !temParada(cabine.paradas, chamada.parada)) return null
  if (sameDestination(cabine.atual, chamada.parada) || chamadaDe(cabine, chamada.parada)) return null
  const nova: ChamadaDeCabine = { parada: { sceneId: chamada.parada.sceneId, pinId: chamada.parada.pinId }, tokenId: chamada.tokenId, nome: chamada.nome }
  return cabines.map((c) => (c.id === cabineId ? comFila(c, [...filaDe(c), nova]) : c))
}

/** A primeira chamada da fila de `cabineId` — a que "Atender a próxima chamada" atende. */
export function proximaChamada(cabines: readonly CabineDeTransporte[], cabineId: string): ChamadaDeCabine | null {
  const cabine = cabines.find((c) => c.id === cabineId)
  return cabine === undefined ? null : (filaDe(cabine)[0] ?? null)
}

/**
 * OCUPANTES, para o painel do mestre: id da cabine → nome de quem embarcou
 * nela (o `naCabine` que o host põe na lista de jogadores). Forma mínima do
 * jogador, para esta regra não depender da rede.
 */
export function ocupantesDasCabines(jogadores: readonly { name: string; naCabine?: string }[]): Record<string, string> {
  const ocupantes: Record<string, string> = {}
  for (const jogador of jogadores) {
    if (jogador.naCabine !== undefined && ocupantes[jogador.naCabine] === undefined) ocupantes[jogador.naCabine] = jogador.name
  }
  return ocupantes
}

/** "Limpar a fila": `cabineId` sem chamadas. `null` quando não há o que limpar. */
export function semFila(cabines: readonly CabineDeTransporte[], cabineId: string): CabineDeTransporte[] | null {
  const cabine = cabines.find((c) => c.id === cabineId)
  if (cabine === undefined || filaDe(cabine).length === 0) return null
  return cabines.map((c) => (c.id === cabineId ? comFila(c, []) : c))
}
