import { CONTA_DO_MESTRE, type FichaGuardada, type Membro } from '../../lib/nuvem/tipos'
import type { Personagem } from '../../lib/personagem'
import { SISTEMA_ONE_PIECE } from '../../lib/sistemaOnePiece'
import { aplicarJogada, criarDuelo, desistirDoDuelo, marcarAusente, marcarPresente, type DueloGravado, type MotorDoDuelo } from '../../lib/treino/duelo'
import { CONVITE_VALE_MS, type ConviteDoDuelo, type MensagemDoDueloDoServidor, type PedidoDoDuelo } from '../../lib/treino/dueloDoLobby'
import { VAGAS_POR_LADO_MAX } from '../../lib/treino/mesaEmMemoria'
import { criarSorteio, sementeNova } from '../../lib/treino/sorteio'
import { dueloParaOLado, ladoDaContaNoDuelo, type DueloDoLado } from '../../lib/treino/vistaDoDuelo'
import { passoDoRobo, type GolpesDaVez } from './roboDoDuelo'

/**
 * O DUELO DA DEMONSTRAÇÃO (`?demo=1`, fatia T7): o DO Campanha de mentira
 * para os `duelo.*`, com a MESMA regra do duelo de verdade (`criarDuelo`,
 * `aplicarJogada`, `desistirDoDuelo`, ausência). O colega desafiado é o robô
 * do treino: aceita o convite pouco depois, joga a vez dele com uma pausa
 * curta e, uma vez por duelo, "cai da conexão" por alguns segundos e volta,
 * para a tela mostrar o aviso de quem caiu. Ao abrir, um colega já deixou um
 * convite esperando. Recarregar a página volta tudo ao começo.
 */

/** Quanto o colega inventado demora para aceitar o convite e para jogar a vez dele. */
const ACEITA_EM_MS = 1_800
const JOGA_EM_MS = 900
/**
 * Na montagem (ninguém agiu ainda), o colega espera mais antes da 1ª jogada
 * dele: quem vê a demo manda as casas escolhidas (`montar`, uma por vez, com a
 * latência da demo nos dois sentidos), e cada `montar` aceito recomeça a espera.
 */
const ESPERA_A_MONTAGEM_MS = 2_000
/** Depois de quantas jogadas dele o colega cai da conexão, e por quanto tempo fica fora. */
const CAI_DEPOIS_DE = 3
const FICA_FORA_MS = 12_000

export interface OpcoesDoDueloDaDemo {
  campanhaId: string
  agora(): number
  depois(ms: number, fazer: () => void): () => void
  membros(): Membro[]
  fichas(): FichaGuardada[]
  /** Quem vê a demo nesta mesa. */
  euContaId: string
}

export interface DueloDaDemo {
  /** A lista do `ola`, como `duelosNoOla` manda. */
  listaPara(contaId: string): MensagemDoDueloDoServidor
  atender(pedido: PedidoDoDuelo, eu: Membro, entregar: (mensagem: MensagemDoDueloDoServidor) => void): void
  /** O canal aberto passa a receber o que o colega faz sozinho (aceitar, jogar, cair). Devolve quem desliga. */
  ouvir(entregar: (mensagem: MensagemDoDueloDoServidor) => void): () => void
}

interface DueloDaMesa {
  gravado: DueloGravado
  golpesDaVez: GolpesDaVez | null
  jogadasDoColega: number
  jaCaiu: boolean
  agendado: boolean
  /** Desliga a jogada agendada do colega (o `montar` aceito recomeça a espera); `null` = nada para desligar. */
  desligarColega: (() => void) | null
}

interface ConviteDaMesa {
  convite: ConviteDoDuelo
  fichasDe: Personagem[]
}

export function criarDueloDaDemo(opcoes: OpcoesDoDueloDaDemo): DueloDaDemo {
  const sorteio = criarSorteio(sementeNova())
  const motor: MotorDoDuelo = { sistema: SISTEMA_ONE_PIECE, rolarD20: () => sorteio.d20() }
  const convites = new Map<string, ConviteDaMesa>()
  const duelos = new Map<string, DueloDaMesa>()
  const ouvintes = new Set<(mensagem: MensagemDoDueloDoServidor) => void>()
  let ids = 0

  const novoId = (): string => {
    ids += 1
    return `duelo_demo_${opcoes.campanhaId.replace(/[^a-z0-9]/g, '_')}_${ids}`
  }
  const difundir = (mensagem: MensagemDoDueloDoServidor): void => {
    for (const entregar of ouvintes) entregar(mensagem)
  }
  const membro = (contaId: string): Membro | undefined => opcoes.membros().find((candidato) => candidato.contaId === contaId && candidato.estado === 'ativo')

  /** O duelo do lado da conta, como o DO manda (`dueloParaOLado`: o fio e a vista dela); `null` = a conta não joga este duelo. */
  function dueloDaConta(gravado: DueloGravado, contaId: string): DueloDoLado | null {
    const lado = ladoDaContaNoDuelo(gravado, contaId)
    return lado === null ? null : dueloParaOLado(gravado, lado, motor.sistema)
  }
  /** O `duelo.estado` para a conta; fora do duelo, nada (o DO só manda às duas contas dele). */
  function estadoPara(gravado: DueloGravado, contaId: string, entregar: (mensagem: MensagemDoDueloDoServidor) => void): void {
    const doLado = dueloDaConta(gravado, contaId)
    if (doLado !== null) entregar({ t: 'duelo.estado', duelo: doLado })
  }
  /** Os canais abertos são todos de quem vê a demo: o estado vai do lado dela. */
  const difundirEstado = (gravado: DueloGravado): void => estadoPara(gravado, opcoes.euContaId, difundir)

  /** As fichas na mesa de uma conta, pelo doc completo (com o dono), como o `fichasDaConta` do DO; `null` = alguma não serve. */
  function fichasDaConta(contaId: string, pedidas: readonly string[]): Personagem[] | null {
    if (pedidas.length < 1 || pedidas.length > VAGAS_POR_LADO_MAX) return null
    const fichas: Personagem[] = []
    for (const id of pedidas) {
      const guardada = opcoes.fichas().find((candidata) => candidata.doc.id === id)
      if (guardada === undefined || guardada.apagada || guardada.visivel !== 'mesa' || guardada.doc.dono !== contaId) return null
      fichas.push(guardada.doc)
    }
    return fichas
  }
  const primeiraFichaDe = (contaId: string): Personagem | null =>
    opcoes.fichas().find((guardada) => !guardada.apagada && guardada.visivel === 'mesa' && guardada.doc.dono === contaId)?.doc ?? null

  const emAndamento = (contaId: string): boolean =>
    [...duelos.values()].some(({ gravado }) => gravado.fim === null && (gravado.jogadores.a.contaId === contaId || gravado.jogadores.b.contaId === contaId))

  function publicar(daMesa: DueloDaMesa): void {
    difundirEstado(daMesa.gravado)
    agendarColega(daMesa)
  }

  /** O colega (o lado que não é quem vê a demo) joga a vez dele, com uma pausa; uma vez cai e volta. */
  function agendarColega(daMesa: DueloDaMesa): void {
    if (daMesa.agendado || daMesa.gravado.fim !== null) return
    const ladoDoColega = daMesa.gravado.jogadores.a.contaId === opcoes.euContaId ? 'b' : 'a'
    const colega = daMesa.gravado.jogadores[ladoDoColega]
    if (colega.ausenteDesde !== null) return
    daMesa.agendado = true
    daMesa.desligarColega = opcoes.depois(daMesa.gravado.montagem ? ESPERA_A_MONTAGEM_MS : JOGA_EM_MS, () => {
      daMesa.agendado = false
      daMesa.desligarColega = null
      if (daMesa.gravado.fim !== null) return
      const passo = passoDoRobo(daMesa.gravado, motor, daMesa.golpesDaVez, (lado) => lado === ladoDoColega)
      if (passo === null) return
      daMesa.gravado = passo.duelo
      daMesa.golpesDaVez = passo.golpesDaVez
      daMesa.jogadasDoColega += 1
      if (!daMesa.jaCaiu && daMesa.jogadasDoColega >= CAI_DEPOIS_DE && daMesa.gravado.fim === null) {
        daMesa.jaCaiu = true
        daMesa.gravado = marcarAusente(daMesa.gravado, colega.contaId, opcoes.agora())
        difundirEstado(daMesa.gravado)
        opcoes.depois(FICA_FORA_MS, () => {
          if (daMesa.gravado.fim !== null) return
          daMesa.gravado = marcarPresente(daMesa.gravado, colega.contaId)
          publicar(daMesa)
        })
        return
      }
      publicar(daMesa)
    })
  }

  function comecar(id: string, a: { contaId: string; nome: string; fichas: Personagem[] }, b: { contaId: string; nome: string; fichas: Personagem[] }): DueloDaMesa | null {
    const criado = criarDuelo({ id, a, b }, motor)
    if (!criado.ok) return null
    const daMesa: DueloDaMesa = { gravado: criado.duelo, golpesDaVez: null, jogadasDoColega: 0, jaCaiu: false, agendado: false, desligarColega: null }
    duelos.set(id, daMesa)
    return daMesa
  }

  // O convite que já espera quem vê a demo: o primeiro colega com ficha na mesa (nunca o mestre).
  const colegaQueConvida = opcoes.membros().find((candidato) => candidato.contaId !== opcoes.euContaId && candidato.contaId !== CONTA_DO_MESTRE && primeiraFichaDe(candidato.contaId) !== null)
  const euNaMesa = membro(opcoes.euContaId)
  const fichaDoColega = colegaQueConvida === undefined ? null : primeiraFichaDe(colegaQueConvida.contaId)
  if (colegaQueConvida !== undefined && euNaMesa !== undefined && fichaDoColega !== null) {
    const id = novoId()
    const criadoEm = opcoes.agora()
    convites.set(id, {
      convite: { id, de: { contaId: colegaQueConvida.contaId, nome: colegaQueConvida.nome }, para: { contaId: euNaMesa.contaId, nome: euNaMesa.nome }, fichasDe: [fichaDoColega.id], criadoEm, venceEm: criadoEm + CONVITE_VALE_MS },
      fichasDe: [fichaDoColega],
    })
  }

  function convidar(pedido: Extract<PedidoDoDuelo, { t: 'duelo.convidar' }>, eu: Membro, entregar: (mensagem: MensagemDoDueloDoServidor) => void): void {
    const outro = membro(pedido.para)
    if (outro === undefined || outro.contaId === eu.contaId) return entregar({ t: 'duelo.recusado', pedido: pedido.t, motivo: 'nao-existe' })
    const minhas = fichasDaConta(eu.contaId, pedido.fichas)
    if (minhas === null) return entregar({ t: 'duelo.recusado', pedido: pedido.t, motivo: 'fichas' })
    const jaConvidou = [...convites.values()].some(({ convite }) => convite.de.contaId === eu.contaId)
    if (emAndamento(eu.contaId) || emAndamento(outro.contaId) || jaConvidou) return entregar({ t: 'duelo.recusado', pedido: pedido.t, motivo: 'ocupado' })
    const id = novoId()
    const criadoEm = opcoes.agora()
    const convite: ConviteDoDuelo = { id, de: { contaId: eu.contaId, nome: eu.nome }, para: { contaId: outro.contaId, nome: outro.nome }, fichasDe: [...pedido.fichas], criadoEm, venceEm: criadoEm + CONVITE_VALE_MS }
    convites.set(id, { convite, fichasDe: minhas })
    difundir({ t: 'duelo.convite', convite })
    // O colega responde sozinho: aceita com a primeira ficha dele, ou recusa se não tem nenhuma na mesa.
    opcoes.depois(ACEITA_EM_MS, () => {
      const daMesa = convites.get(id)
      if (daMesa === undefined) return
      convites.delete(id)
      const dele = primeiraFichaDe(outro.contaId)
      const comecado = dele === null ? null : comecar(id, { contaId: eu.contaId, nome: eu.nome, fichas: daMesa.fichasDe }, { contaId: outro.contaId, nome: outro.nome, fichas: [dele] })
      if (comecado === null) return difundir({ t: 'duelo.fechado', id, motivo: 'recusado' })
      publicar(comecado)
    })
  }

  function aceitar(pedido: Extract<PedidoDoDuelo, { t: 'duelo.aceitar' }>, eu: Membro, entregar: (mensagem: MensagemDoDueloDoServidor) => void): void {
    const daMesa = convites.get(pedido.id)
    if (daMesa === undefined || daMesa.convite.para.contaId !== eu.contaId) return entregar({ t: 'duelo.recusado', pedido: pedido.t, motivo: 'nao-existe', id: pedido.id })
    if (daMesa.convite.venceEm <= opcoes.agora()) {
      convites.delete(pedido.id)
      return difundir({ t: 'duelo.fechado', id: pedido.id, motivo: 'expirou' })
    }
    const minhas = fichasDaConta(eu.contaId, pedido.fichas)
    if (minhas === null) return entregar({ t: 'duelo.recusado', pedido: pedido.t, motivo: 'fichas', id: pedido.id })
    if (emAndamento(eu.contaId) || emAndamento(daMesa.convite.de.contaId)) return entregar({ t: 'duelo.recusado', pedido: pedido.t, motivo: 'ocupado', id: pedido.id })
    convites.delete(pedido.id)
    const comecado = comecar(pedido.id, { contaId: daMesa.convite.de.contaId, nome: daMesa.convite.de.nome, fichas: daMesa.fichasDe }, { contaId: eu.contaId, nome: eu.nome, fichas: minhas })
    if (comecado === null) return entregar({ t: 'duelo.recusado', pedido: pedido.t, motivo: 'fichas', id: pedido.id })
    publicar(comecado)
  }

  return {
    listaPara(contaId) {
      const agora = opcoes.agora()
      const meus = [...convites.values()].filter(({ convite }) => convite.venceEm > agora && (convite.de.contaId === contaId || convite.para.contaId === contaId))
      const comigo = [...duelos.values()].filter(({ gravado }) => gravado.jogadores.a.contaId === contaId || gravado.jogadores.b.contaId === contaId)
      const duelosDaConta = comigo.flatMap(({ gravado }) => {
        const doLado = dueloDaConta(gravado, contaId)
        return doLado === null ? [] : [doLado]
      })
      return { t: 'duelo.lista', convites: meus.map(({ convite }) => convite), duelos: duelosDaConta }
    },
    ouvir(entregar) {
      ouvintes.add(entregar)
      // Quem volta com o colega na vez dele: o colega continua.
      for (const daMesa of duelos.values()) agendarColega(daMesa)
      return () => ouvintes.delete(entregar)
    },
    atender(pedido, eu, entregar) {
      switch (pedido.t) {
        case 'duelo.convidar':
          return convidar(pedido, eu, entregar)
        case 'duelo.aceitar':
          return aceitar(pedido, eu, entregar)
        case 'duelo.recusar': {
          const daMesa = convites.get(pedido.id)
          if (daMesa === undefined || (daMesa.convite.de.contaId !== eu.contaId && daMesa.convite.para.contaId !== eu.contaId)) return entregar({ t: 'duelo.recusado', pedido: pedido.t, motivo: 'nao-existe', id: pedido.id })
          convites.delete(pedido.id)
          return difundir({ t: 'duelo.fechado', id: pedido.id, motivo: daMesa.convite.de.contaId === eu.contaId ? 'desistiu' : 'recusado' })
        }
        case 'duelo.jogar': {
          const daMesa = duelos.get(pedido.id)
          if (daMesa === undefined) return entregar({ t: 'duelo.recusado', pedido: pedido.t, motivo: 'nao-existe', id: pedido.id })
          const feito = aplicarJogada(daMesa.gravado, motor, eu.contaId, pedido.jogada)
          if (!feito.ok) {
            entregar({ t: 'duelo.recusado', pedido: pedido.t, motivo: feito.motivo, id: pedido.id, ...(feito.texto === undefined ? {} : { texto: feito.texto }) })
            if (feito.motivo === 'seqVelho' || feito.motivo === 'acabou') estadoPara(daMesa.gravado, eu.contaId, entregar)
            return
          }
          daMesa.gravado = feito.duelo
          // A casa escolhida chegou: a espera do colega recomeça (`publicar` agenda de novo).
          if (pedido.jogada.tipo === 'montar' && daMesa.desligarColega !== null) {
            daMesa.desligarColega()
            daMesa.desligarColega = null
            daMesa.agendado = false
          }
          return publicar(daMesa)
        }
        case 'duelo.desistir': {
          const daMesa = duelos.get(pedido.id)
          if (daMesa === undefined) return entregar({ t: 'duelo.recusado', pedido: pedido.t, motivo: 'nao-existe', id: pedido.id })
          const feito = desistirDoDuelo(daMesa.gravado, eu.contaId)
          if (!feito.ok) return entregar({ t: 'duelo.recusado', pedido: pedido.t, motivo: feito.motivo, id: pedido.id })
          daMesa.gravado = feito.duelo
          return publicar(daMesa)
        }
      }
    },
  }
}
