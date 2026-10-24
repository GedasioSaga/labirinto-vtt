import { ehVideoDoYoutube, type AlvoDosSons, type EfeitoDeSom, type FonteDoSom } from '../lib/sons/biblioteca'
import type { MotorAoVivo, ResultadoDoToque } from '../lib/sons/aoVivo/motor'
import { idDaRefDeAudio } from '../lib/midia'
import type { FonteDeSomNaRede } from './protocol'

/**
 * SONS AO VIVO, fatia F4 (`docs/planos/sons-ao-vivo-2026-10-23.md`, seções 2 e
 * 4): liga o motor local (o som que o mestre ouve) à rede (o que jogadores e a
 * TV ouvem). A aba Sons só fala com isto; a ponte do mestre (`hostBridge`) se
 * registra aqui quando a sala abre e sai quando fecha — sem sala, o som toca
 * só no computador do mestre.
 *
 * O que vai à rede é só id opaco: a instância é um apelido sorteado por efeito
 * (não o id da biblioteca) e a fonte é o id do áudio guardado. Nome, pasta e a
 * biblioteca nunca atravessam.
 */

/** O que a rede recebe para tocar: nada do efeito além do que soa. */
export interface PedidoDeSomAoVivo {
  instancia: string
  fonte: FonteDeSomNaRede
  volume: number
  loop: boolean
}

export type RecusaDoSomNaRede = 'sem-sala' | 'pedido-invalido' | 'limite-de-loops'
export type ResultadoDoSomNaRede = { ok: true; enviados: number } | { ok: false; motivo: RecusaDoSomNaRede }

/** A parte da ponte do mestre que manda som pela rede. Cada número devolvido é quantas conexões receberam. */
export interface RedeDosSons {
  tocarSomAoVivo(pedido: PedidoDeSomAoVivo, alvo: AlvoDosSons): ResultadoDoSomNaRede
  pararSomAoVivo(instancia: string, fadeMs?: number): number
  pararTodosOsSons(): number
  volumeDoSom(instancia: string, volume: number): number
  /**
   * Traz os bytes antes do clique, só na AUDIÊNCIA (o alvo do seletor; o gatilho
   * é da F5, que passa o alvo de agora — ausente = Todos, o padrão do seletor).
   * Troca a pré-carga anterior; quem passar a ser da audiência recebe depois.
   */
  precarregarSonsAoVivo(midias: readonly string[], alvo?: AlvoDosSons): number
  /** Quantos aparelhos contaram (`som.falhou`) que aquele toque não soou: o "não tocou para N". */
  falhasDoSom(instancia: string): number
  /**
   * Os ids de áudio que esta sala mandou à conexão `clientId` (tocar ou
   * pré-carregar): o que a F5 pode servir por `/sons/<id>` a ELA. Sem
   * `clientId`, a união de todas (só leitura do mestre).
   */
  midiasDeSomLiberadas(clientId?: string): string[]
  /**
   * A pasta da aventura aberta, de onde o servidor da sala serve `/sons/<id>`
   * (F5, `net_sons_aventura`); `null` = nenhuma (o servidor deixa de servir).
   */
  mudarPastaDosSons(pasta: string | null): void
}

let redeRegistrada: RedeDosSons | null = null
/** A pasta que a aba Sons informou por último (`informarPastaDosSons`); vive mais que a sala. */
let pastaDosSons: string | null = null
const ouvintesDaRede = new Set<() => void>()

function avisarOuvintes(): void {
  for (const ouvinte of ouvintesDaRede) ouvinte()
}

/** A ponte do mestre se registra ao abrir a sala; a função devolvida tira o registro (só se ainda for o dela). */
export function registrarRedeDosSons(rede: RedeDosSons): () => void {
  redeRegistrada = rede
  // O servidor da sala nasce sem pasta: só há o que contar se a aba Sons já disse qual é.
  if (pastaDosSons !== null) rede.mudarPastaDosSons(pastaDosSons)
  avisarOuvintes()
  return () => {
    if (redeRegistrada !== rede) return
    redeRegistrada = null
    avisarOuvintes()
  }
}

/**
 * A aba Sons informa a pasta da aventura (a da biblioteca de sons) a cada troca;
 * a rede de agora a recebe na hora, e a que se registrar depois, ao registrar.
 */
export function informarPastaDosSons(pasta: string | null): void {
  if (pasta === pastaDosSons) return
  pastaDosSons = pasta
  redeRegistrada?.mudarPastaDosSons(pasta)
}

/** A rede de agora; `null` = sala fechada (o som fica só no computador do mestre). */
export function redeDosSons(): RedeDosSons | null {
  return redeRegistrada
}

/** Avisa quando a sala abre ou fecha e quando chega um `som.falhou` contado. */
export function assinarRedeDosSons(ouvinte: () => void): () => void {
  ouvintesDaRede.add(ouvinte)
  return () => {
    ouvintesDaRede.delete(ouvinte)
  }
}

/** A ponte do mestre chama quando uma falha nova foi contada. */
export function avisarFalhaDeSom(): void {
  avisarOuvintes()
}

/** A fonte como atravessa a rede; `null` = ref torta. YouTube: só o id do vídeo e o trecho (nunca link nem nome). */
export function fonteDeSomNaRede(fonte: FonteDoSom): FonteDeSomNaRede | null {
  if (fonte.tipo === 'youtube') {
    // Conferido de novo: o que sai daqui vira endereço de iframe em cada aparelho.
    if (!ehVideoDoYoutube(fonte.video)) return null
    return { tipo: 'youtube', video: fonte.video, ...(fonte.inicioS === undefined ? {} : { inicioS: fonte.inicioS }), ...(fonte.fimS === undefined ? {} : { fimS: fonte.fimS }) }
  }
  const midia = idDaRefDeAudio(fonte.ref)
  return midia === null ? null : { tipo: 'arquivo', midia }
}

export interface ResultadoDaPonte {
  /** O motor do mestre; `null` = "Tocar neste computador" desligado. */
  local: ResultadoDoToque | null
  /** A rede; `null` = sem sala, ou a fonte não vai pela rede, ou o local recusou na hora. */
  rede: ResultadoDoSomNaRede | null
}

export interface PonteDosSons {
  tocar(efeito: EfeitoDeSom, alvo: AlvoDosSons, opcoes: { local: boolean }): ResultadoDaPonte
  parar(efeitoId: string): void
  pararTudo(): void
  mudarVolume(efeitoId: string, volume: number): void
}

export interface DependenciasDaPonte {
  motor: MotorAoVivo
  rede: () => RedeDosSons | null
  /** O apelido de rede de um efeito; sorteado, para não ser o id guardado na biblioteca. */
  novaInstancia?: () => string
}

/**
 * Os apelidos de rede de cada efeito, POR REDE (a ponte da sala), e não por
 * ponte: a aba Sons que remonta com um loop tocando cria outra ponte, e o
 * Parar dela precisa alcançar o loop pelo mesmo apelido. Vivem enquanto o
 * toque pode existir: parar tira o do efeito, Parar tudo tira todos; a sala
 * que fecha leva a rede (e o mapa) junto.
 */
const apelidosPorRede = new WeakMap<RedeDosSons, Map<string, string>>()

function apelidosDa(rede: RedeDosSons): Map<string, string> {
  const conhecidos = apelidosPorRede.get(rede)
  if (conhecidos !== undefined) return conhecidos
  const novos = new Map<string, string>()
  apelidosPorRede.set(rede, novos)
  return novos
}

export function criarPonteDosSons(deps: DependenciasDaPonte): PonteDosSons {
  const novaInstancia = deps.novaInstancia ?? (() => `som-${crypto.randomUUID()}`)
  // Um apelido por efeito enquanto o toque vive: tocar de novo o mesmo efeito troca o toque nos dois lados, como no motor.
  const apelidoDe = (rede: RedeDosSons, efeitoId: string): string => {
    const apelidos = apelidosDa(rede)
    const conhecido = apelidos.get(efeitoId)
    if (conhecido !== undefined) return conhecido
    const novo = novaInstancia()
    apelidos.set(efeitoId, novo)
    return novo
  }

  return {
    tocar(efeito, alvo, { local }) {
      const resultadoLocal = local ? deps.motor.tocar(efeito.id, efeito.fonte, { loop: efeito.loop, volumeDoEfeito: efeito.volume }) : null
      // O que o motor do mestre recusa na hora (4º loop, arquivo que não está no disco) também não iria tocar na mesa.
      if (resultadoLocal !== null && !resultadoLocal.aceito) return { local: resultadoLocal, rede: null }
      const rede = deps.rede()
      const fonte = fonteDeSomNaRede(efeito.fonte)
      if (rede === null || fonte === null) return { local: resultadoLocal, rede: null }
      const pedido: PedidoDeSomAoVivo = { instancia: apelidoDe(rede, efeito.id), fonte, volume: efeito.volume, loop: efeito.loop }
      const resultadoDaRede = rede.tocarSomAoVivo(pedido, alvo)
      // O mestre ouve o que a mesa ouve: a mesa recusou (ex.: 4º loop lá, com loops tocados só na rede) e o local tinha
      // aceitado, o local para; a recusa volta para a tela avisar. Sem sala na hora (`sem-sala`), o mestre segue sozinho.
      if (resultadoLocal !== null && !resultadoDaRede.ok && resultadoDaRede.motivo !== 'sem-sala') deps.motor.parar(efeito.id)
      return { local: resultadoLocal, rede: resultadoDaRede }
    },
    parar(efeitoId) {
      deps.motor.parar(efeitoId)
      const rede = deps.rede()
      if (rede === null) return
      const apelidos = apelidosDa(rede)
      const apelido = apelidos.get(efeitoId)
      if (apelido === undefined) return
      apelidos.delete(efeitoId)
      rede.pararSomAoVivo(apelido)
    },
    pararTudo() {
      deps.motor.pararTudo()
      const rede = deps.rede()
      if (rede === null) return
      apelidosDa(rede).clear()
      rede.pararTodosOsSons()
    },
    mudarVolume(efeitoId, volume) {
      deps.motor.mudarVolume(efeitoId, volume)
      const rede = deps.rede()
      const apelido = rede === null ? undefined : apelidosDa(rede).get(efeitoId)
      if (rede !== null && apelido !== undefined) rede.volumeDoSom(apelido, volume)
    },
  }
}
