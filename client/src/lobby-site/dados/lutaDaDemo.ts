import { chaveDaVez } from '../../lib/batalha/combate'
import { CONTA_DO_MESTRE, type FichaGuardada, type Membro } from '../../lib/nuvem/tipos'
import type { Personagem } from '../../lib/personagem'
import { SISTEMA_ONE_PIECE } from '../../lib/sistemaOnePiece'
import { arbitrarNaLuta } from '../../lib/treino/arbitroDaLuta'
import type { MotorDoDuelo } from '../../lib/treino/duelo'
import { ajustesPadraoDoJuiz, validarAjustesDoJuiz } from '../../lib/treino/juiz'
import { aplicarJogadaNaLuta, CONTAS_POR_LUTA_MAX, criarLuta, participanteDaConta, sairDaLuta, type EstadoDaLuta, type InscricaoNaLuta, type ResultadoNaLuta } from '../../lib/treino/luta'
import {
  ESPERA_DA_LUTA_MS,
  PAGINA_DO_HISTORICO_MAX,
  resumoDaLuta,
  type ConvidadoDaLuta,
  type EsperaDaLuta,
  type LutaAcontecendo,
  type LutaNoHistorico,
  type MensagemDaLutaDoServidor,
  type MotivoDaLutaRecusada,
  type PedidoDaLuta,
} from '../../lib/treino/lutaDoLobby'
import { VAGAS_POR_LADO_MAX, type LadoDaLuta } from '../../lib/treino/mesaEmMemoria'
import { jogadaDoRobo } from '../../lib/treino/robo'
import { criarSorteio, sementeNova } from '../../lib/treino/sorteio'
import { lutaParaAConta } from '../../lib/treino/vistaDaLuta'
import { candidatasDoRobo, golpesNaVezDe, type GolpesDaVez } from './roboDoDuelo'

/**
 * A LUTA DE N LADOS DA DEMONSTRAÇÃO (`?demo=1`, Arena multijogador F5): o DO
 * Campanha de mentira para os `luta.*`, com a MESMA regra da luta de verdade
 * (`criarLuta`, `aplicarJogadaNaLuta`, `arbitrarNaLuta`, `sairDaLuta`, a vista
 * de cada papel e o resumo do histórico). Os colegas inventados são o robô do
 * treino: aceitam o convite pouco depois (com a primeira ficha deles; o mestre
 * inventado como Judge, com o Judge padrão) e jogam a vez deles com uma pausa.
 * Ao abrir, dois colegas já lutam (para o "Assistir"), o histórico tem lutas
 * acabadas e, na mesa com 3 colegas, um deles deixou um convite esperando.
 * Recarregar a página volta tudo ao começo.
 */

const ACEITA_EM_MS = 1_400
const COMECA_EM_MS = 1_600
const JOGA_EM_MS = 1_100
/** As lutas do histórico inicial são jogadas na hora pelo robô: um teto para nunca travar a página. */
const PASSOS_DO_HISTORICO_MAX = 3_000

export interface OpcoesDaLutaDaDemo {
  campanhaId: string
  agora(): number
  depois(ms: number, fazer: () => void): () => void
  membros(): Membro[]
  fichas(): FichaGuardada[]
  euContaId: string
}

export interface LutaDaDemo {
  atender(pedido: PedidoDaLuta, eu: Membro, entregar: (mensagem: MensagemDaLutaDoServidor) => void): void
  /** O canal aberto passa a receber o que os colegas fazem sozinhos. Devolve quem desliga. */
  ouvir(entregar: (mensagem: MensagemDaLutaDoServidor) => void): () => void
}

interface AceiteDaDemo {
  fichas: string[]
  ajustes: Record<string, unknown> | null
}

interface EsperaDaDemo {
  espera: EsperaDaLuta
  aceites: Map<string, AceiteDaDemo>
}

interface LutaDaMesa {
  luta: EstadoDaLuta
  golpesDaVez: GolpesDaVez | null
  agendado: boolean
}

export function criarLutaDaDemo(opcoes: OpcoesDaLutaDaDemo): LutaDaDemo {
  const sorteio = criarSorteio(sementeNova())
  const motor: MotorDoDuelo = { sistema: SISTEMA_ONE_PIECE, rolarD20: () => sorteio.d20() }
  const esperas = new Map<string, EsperaDaDemo>()
  const lutas = new Map<string, LutaDaMesa>()
  let historico: LutaNoHistorico[] = []
  const ouvintes = new Set<(mensagem: MensagemDaLutaDoServidor) => void>()
  const eu = opcoes.euContaId
  let ids = 0

  const novoId = (): string => {
    ids += 1
    return `luta_demo_${opcoes.campanhaId.replace(/[^a-z0-9]/g, '_')}_${ids}`
  }
  const difundir = (mensagem: MensagemDaLutaDoServidor): void => {
    for (const entregar of ouvintes) entregar(mensagem)
  }
  const membro = (contaId: string): Membro | undefined => opcoes.membros().find((candidato) => candidato.contaId === contaId && candidato.estado === 'ativo')
  const nomeDe = (contaId: string): string => membro(contaId)?.nome ?? contaId

  // ── Fichas ────────────────────────────────────────────────────────────────

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
  function fichasDoTreino(pedidas: readonly string[]): Personagem[] | null {
    const fichas: Personagem[] = []
    for (const id of pedidas) {
      const guardada = opcoes.fichas().find((candidata) => candidata.doc.id === id)
      if (guardada === undefined || guardada.apagada || guardada.visivel !== 'treino') return null
      fichas.push(guardada.doc)
    }
    return fichas
  }
  const primeiraFichaDe = (contaId: string): Personagem | null =>
    opcoes.fichas().find((guardada) => !guardada.apagada && guardada.visivel === 'mesa' && guardada.doc.dono === contaId)?.doc ?? null
  function baseDoJuiz(baseFichaId: string | null): Personagem | null {
    if (baseFichaId === null) return null
    const guardada = opcoes.fichas().find((candidata) => candidata.doc.id === baseFichaId)
    return guardada === undefined || guardada.apagada || guardada.visivel === 'mestre' ? null : guardada.doc
  }

  /** O aceite serve para o papel? Como o `motivoDoAceite` do DO. */
  function motivoDoAceite(contaId: string, papel: ConvidadoDaLuta['papel'], aceite: AceiteDaDemo): MotivoDaLutaRecusada | null {
    switch (papel) {
      case 'jogador':
        return fichasDaConta(contaId, aceite.fichas) === null ? 'fichas' : null
      case 'juiz':
        if (aceite.ajustes === null || validarAjustesDoJuiz(aceite.ajustes, SISTEMA_ONE_PIECE) === null) return 'formato'
        return aceite.fichas.length < VAGAS_POR_LADO_MAX && fichasDoTreino(aceite.fichas) !== null ? null : 'fichas'
      case 'arbitro':
      case 'espectador':
        return aceite.fichas.length === 0 && aceite.ajustes === null ? null : 'papel'
    }
  }

  function inscricao(conta: EsperaDaLuta['contas'][number], aceite: AceiteDaDemo): InscricaoNaLuta | null {
    const { contaId, nome, papel, lado } = conta
    if (motivoDoAceite(contaId, papel, aceite) !== null) return null
    switch (papel) {
      case 'jogador': {
        const fichas = fichasDaConta(contaId, aceite.fichas)
        return fichas === null ? null : { contaId, nome, papel, lado, fichas }
      }
      case 'juiz': {
        const fichas = fichasDoTreino(aceite.fichas)
        const ajustes = aceite.ajustes === null ? null : validarAjustesDoJuiz(aceite.ajustes, SISTEMA_ONE_PIECE)
        if (fichas === null || ajustes === null) return null
        return { contaId, nome, papel, lado, fichas, juiz: { ajustes, base: baseDoJuiz(ajustes.baseFichaId) } }
      }
      case 'arbitro':
      case 'espectador':
        return { contaId, nome, papel, lado: null, fichas: [] }
    }
  }

  // ── O que vai ao site ─────────────────────────────────────────────────────

  function acontecendo(): LutaAcontecendo[] {
    return [...lutas.values()].flatMap(({ luta }) => {
      if (luta.fim !== null) return []
      const lados = [...new Set(luta.lutadores.vagas.map((vaga) => vaga.lado))].sort().map((lado) => ({
        lado,
        contas: luta.participantes.filter((participante) => participante.lado === lado).map(({ contaId, nome }) => ({ contaId, nome })),
      }))
      const assistindo = luta.participantes.filter((participante) => participante.papel === 'espectador').length
      return [{ id: luta.id, modo: luta.modo, lados, rodada: luta.cena.turnos.rodada, assistindo, vagas: CONTAS_POR_LUTA_MAX - luta.participantes.length, pausada: luta.pausada === true }]
    })
  }
  function convitesDe(contaId: string): EsperaDaLuta[] {
    const agora = opcoes.agora()
    return [...esperas.values()].filter(({ espera }) => espera.venceEm > agora && espera.contas.some((conta) => conta.contaId === contaId)).map(({ espera }) => espera)
  }
  const lista = (): MensagemDaLutaDoServidor => ({ t: 'luta.lista', convites: convitesDe(eu), acontecendo: acontecendo() })
  function estadoPara(luta: EstadoDaLuta, entregar: (mensagem: MensagemDaLutaDoServidor) => void): void {
    const daConta = lutaParaAConta(luta, eu, SISTEMA_ONE_PIECE)
    if (daConta !== null) entregar({ t: 'luta.estado', luta: daConta })
  }

  // ── O robô no lugar dos colegas ────────────────────────────────────────────

  /** Um passo do robô por uma conta que não é a de quem vê a demo; `null` = a vez (ou a reação) é de gente. */
  function passoDoRobo(daMesa: LutaDaMesa): boolean {
    const { luta } = daMesa
    if (luta.fim !== null || luta.pausada === true) return false
    const { turnos, regras } = luta.cena
    const jogada = jogadaDoRobo({ turnos, regras, vagas: luta.lutadores.vagas.filter((vaga) => vaga.fora !== true), personagens: luta.lutadores.personagens, sistema: SISTEMA_ONE_PIECE, golpesNaVez: golpesNaVezDe(turnos, daMesa.golpesDaVez) })
    if (jogada === null) return false
    const tokenId = jogada.tipo === 'reagir' ? jogada.pedido.tokenId : jogada.tokenId
    const contaId = luta.lutadores.vagas.find((vaga) => vaga.tokenId === tokenId)?.contaId
    if (contaId === undefined || contaId === eu) return false
    for (const candidata of candidatasDoRobo(jogada, luta.seq)) {
      const feito = aplicarJogadaNaLuta(luta, motor, contaId, candidata)
      if (!feito.ok) continue
      if (candidata.tipo === 'agir' && candidata.vez !== null) daMesa.golpesDaVez = { chave: chaveDaVez(candidata.vez.rodada, candidata.vez.cartaId), golpes: golpesNaVezDe(turnos, daMesa.golpesDaVez) + 1 }
      daMesa.luta = feito.luta
      return true
    }
    return false
  }

  function guardarNoHistorico(luta: EstadoDaLuta): void {
    const resumo = resumoDaLuta(luta, opcoes.agora())
    if (resumo !== null && !historico.some((antiga) => antiga.id === resumo.id)) historico = [resumo, ...historico].slice(0, 100)
  }

  /** Depois de cada mudança: o estado a quem vê (se está nela), a lista quando acabou, e a vez do robô agendada. */
  function publicar(daMesa: LutaDaMesa, acabouAntes: boolean, listaMudou = false): void {
    estadoPara(daMesa.luta, difundir)
    if (daMesa.luta.fim !== null && !acabouAntes) guardarNoHistorico(daMesa.luta)
    if (listaMudou || (daMesa.luta.fim !== null && !acabouAntes)) difundir(lista())
    agendarRobo(daMesa)
  }

  function agendarRobo(daMesa: LutaDaMesa): void {
    if (daMesa.agendado || daMesa.luta.fim !== null) return
    // A luta só de colegas anda enquanto quem vê a demo está nela (jogando, arbitrando ou assistindo):
    // sem isso ela acabava em segundos, antes de alguém chegar a "Assistir".
    if (participanteDaConta(daMesa.luta, eu) === null) return
    daMesa.agendado = true
    opcoes.depois(JOGA_EM_MS, () => {
      daMesa.agendado = false
      if (!passoDoRobo(daMesa)) return
      publicar(daMesa, false)
    })
  }

  function comecarLuta(espera: EsperaDaDemo): { ok: true; daMesa: LutaDaMesa } | { ok: false; motivo: MotivoDaLutaRecusada } {
    const inscricoes = espera.espera.contas.flatMap((conta) => {
      const aceite = espera.aceites.get(conta.contaId)
      const lida = aceite === undefined ? null : inscricao(conta, aceite)
      return lida === null ? [] : [lida]
    })
    const criada = criarLuta({ id: espera.espera.id, modo: espera.espera.modo, inscricoes }, motor)
    if (!criada.ok) return { ok: false, motivo: criada.motivo === 'cheia' ? 'cheia' : criada.motivo === 'papel' || criada.motivo === 'contaRepetida' ? 'papel' : criada.motivo === 'poucosLados' || criada.motivo === 'vazio' || criada.motivo === 'ladoRepetido' ? 'lados' : 'fichas' }
    esperas.delete(espera.espera.id)
    const daMesa: LutaDaMesa = { luta: criada.luta, golpesDaVez: null, agendado: false }
    lutas.set(espera.espera.id, daMesa)
    return { ok: true, daMesa }
  }

  // ── A abertura: uma luta rodando, o histórico e um convite ─────────────────

  const colegas = opcoes.membros().filter((candidato) => candidato.estado === 'ativo' && candidato.contaId !== eu && candidato.contaId !== CONTA_DO_MESTRE && primeiraFichaDe(candidato.contaId) !== null)

  function esperaDe(criador: Membro, modo: EsperaDaLuta['modo'], contas: readonly { membro: Membro; papel: ConvidadoDaLuta['papel']; lado: LadoDaLuta | null }[], agora: number): EsperaDaDemo {
    const id = novoId()
    const lados = [...new Set(contas.flatMap(({ lado }) => (lado === null ? [] : [lado])))].sort()
    return {
      espera: {
        id,
        criador: { contaId: criador.contaId, nome: criador.nome },
        modo,
        lados,
        contas: contas.map(({ membro: quem, papel, lado }) => ({ contaId: quem.contaId, nome: quem.nome, papel, lado, aceitou: false, fichas: [] })),
        criadoEm: agora,
        venceEm: agora + ESPERA_DA_LUTA_MS,
      },
      aceites: new Map(),
    }
  }

  /** O colega inventado aceita com a primeira ficha dele (o mestre como Judge, com o Judge padrão). */
  function aceiteDoColega(conta: EsperaDaLuta['contas'][number]): AceiteDaDemo | null {
    switch (conta.papel) {
      case 'jogador': {
        const ficha = primeiraFichaDe(conta.contaId)
        return ficha === null ? null : { fichas: [ficha.id], ajustes: null }
      }
      case 'juiz':
        return { fichas: [], ajustes: { ...ajustesPadraoDoJuiz() } }
      case 'arbitro':
      case 'espectador':
        return { fichas: [], ajustes: null }
    }
  }

  function marcarAceite(espera: EsperaDaDemo, contaId: string, aceite: AceiteDaDemo): void {
    espera.aceites.set(contaId, aceite)
    espera.espera = { ...espera.espera, contas: espera.espera.contas.map((conta) => (conta.contaId === contaId ? { ...conta, aceitou: true, fichas: [...aceite.fichas] } : conta)) }
  }

  function lutaDeAbertura(contas: readonly Membro[], modo: EsperaDaLuta['modo'], ate: 'fim' | 'rodando'): void {
    const [criador] = contas
    if (criador === undefined || contas.length < 2) return
    const espera = esperaDe(criador, modo, contas.map((quem, i) => ({ membro: quem, papel: 'jogador' as const, lado: (['a', 'b', 'c'] as const)[i] ?? 'c' })), opcoes.agora())
    for (const conta of espera.espera.contas) {
      const aceite = aceiteDoColega(conta)
      if (aceite !== null) marcarAceite(espera, conta.contaId, aceite)
    }
    const comecada = comecarLuta(espera)
    if (!comecada.ok) return
    const { daMesa } = comecada
    if (ate === 'rodando') {
      // Algumas jogadas já feitas: quem assiste chega no meio da luta.
      for (let i = 0; i < 4; i += 1) passoDoRobo(daMesa)
      return
    }
    for (let i = 0; i < PASSOS_DO_HISTORICO_MAX && daMesa.luta.fim === null; i += 1) {
      if (!passoDoRobo(daMesa)) break
    }
    lutas.delete(daMesa.luta.id)
    if (daMesa.luta.fim !== null) guardarNoHistorico(daMesa.luta)
  }

  const [primeiro, segundo, terceiro] = colegas
  if (primeiro !== undefined && segundo !== undefined) {
    if (terceiro !== undefined) lutaDeAbertura([primeiro, segundo, terceiro], 'todos', 'fim')
    lutaDeAbertura([segundo, primeiro], 'times', 'fim')
    lutaDeAbertura([primeiro, segundo], 'times', 'rodando')
  }
  // O convite que já espera quem vê a demo (na mesa com 3 colegas): o terceiro chama para um 1 contra 1.
  const euNaMesa = membro(eu)
  if (terceiro !== undefined && euNaMesa !== undefined && euNaMesa.papel === 'jogador') {
    const espera = esperaDe(terceiro, 'times', [{ membro: terceiro, papel: 'jogador', lado: 'a' }, { membro: euNaMesa, papel: 'jogador', lado: 'b' }], opcoes.agora())
    const aceite = aceiteDoColega(espera.espera.contas[0])
    if (aceite !== null) {
      marcarAceite(espera, terceiro.contaId, aceite)
      esperas.set(espera.espera.id, espera)
    }
  }

  // ── Pedidos ───────────────────────────────────────────────────────────────

  function recusar(entregar: (mensagem: MensagemDaLutaDoServidor) => void, pedido: PedidoDaLuta['t'], motivo: MotivoDaLutaRecusada, id?: string): void {
    entregar({ t: 'luta.recusado', pedido, motivo, ...(id === undefined ? {} : { id }) })
  }

  /** A espera vale? A vencida fecha aqui mesmo. */
  function esperaQueVale(id: string, entregar: (mensagem: MensagemDaLutaDoServidor) => void, pedido: PedidoDaLuta['t']): EsperaDaDemo | null {
    const espera = esperas.get(id)
    if (espera === undefined || !espera.espera.contas.some((conta) => conta.contaId === eu)) {
      recusar(entregar, pedido, 'nao-existe', id)
      return null
    }
    if (espera.espera.venceEm <= opcoes.agora()) {
      esperas.delete(id)
      difundir({ t: 'luta.fechada', id, motivo: 'expirou' })
      return null
    }
    return espera
  }

  /** Quem criou é um colega: começa sozinho quando todos aceitaram. Quem criou sou eu: os colegas aceitam um a um. */
  function andarAEspera(espera: EsperaDaDemo): void {
    const { id } = espera.espera
    const faltam = espera.espera.contas.filter((conta) => conta.contaId !== eu && !conta.aceitou)
    faltam.forEach((conta, i) => {
      opcoes.depois(ACEITA_EM_MS * (i + 1), () => {
        const agora = esperas.get(id)
        if (agora === undefined) return
        const aceite = aceiteDoColega(conta)
        if (aceite === null) {
          agora.espera = { ...agora.espera, contas: agora.espera.contas.filter((candidata) => candidata.contaId !== conta.contaId) }
        } else marcarAceite(agora, conta.contaId, aceite)
        difundir({ t: 'luta.espera', espera: agora.espera })
      })
    })
  }

  function criar(pedido: Extract<PedidoDaLuta, { t: 'luta.criar' }>, quem: Membro, entregar: (mensagem: MensagemDaLutaDoServidor) => void): void {
    const meu = pedido.convidados.find((convidado) => convidado.contaId === quem.contaId)
    if (meu === undefined || pedido.convidados.length > CONTAS_POR_LUTA_MAX) return recusar(entregar, pedido.t, pedido.convidados.length > CONTAS_POR_LUTA_MAX ? 'cheia' : 'papel')
    for (const convidado of pedido.convidados) {
      const deles = membro(convidado.contaId)
      if (deles === undefined) return recusar(entregar, pedido.t, 'nao-existe')
      if ((convidado.papel === 'juiz' || convidado.papel === 'arbitro') && deles.papel !== 'mestre') return recusar(entregar, pedido.t, 'papel')
    }
    const ladosDeQuemJoga = pedido.convidados.flatMap((convidado) => (convidado.lado === null ? [] : [convidado.lado]))
    if (!pedido.lados.every((lado) => ladosDeQuemJoga.includes(lado)) || (pedido.modo === 'todos' && new Set(ladosDeQuemJoga).size !== ladosDeQuemJoga.length)) return recusar(entregar, pedido.t, 'lados')
    const meuAceite: AceiteDaDemo = { fichas: [...pedido.fichas], ajustes: pedido.ajustes ?? null }
    const doAceite = motivoDoAceite(quem.contaId, meu.papel, meuAceite)
    if (doAceite !== null) return recusar(entregar, pedido.t, doAceite)
    if (esperas.size > 0 && [...esperas.values()].some(({ espera }) => espera.criador.contaId === quem.contaId)) return recusar(entregar, pedido.t, 'ocupado')
    const espera = esperaDe(
      quem,
      pedido.modo,
      pedido.convidados.flatMap((convidado) => {
        const deles = membro(convidado.contaId)
        return deles === undefined ? [] : [{ membro: deles, papel: convidado.papel, lado: convidado.lado }]
      }),
      opcoes.agora(),
    )
    espera.espera = { ...espera.espera, lados: [...pedido.lados] }
    marcarAceite(espera, quem.contaId, meuAceite)
    esperas.set(espera.espera.id, espera)
    difundir({ t: 'luta.espera', espera: espera.espera })
    andarAEspera(espera)
  }

  function aceitar(pedido: Extract<PedidoDaLuta, { t: 'luta.aceitar' }>, entregar: (mensagem: MensagemDaLutaDoServidor) => void): void {
    const espera = esperaQueVale(pedido.id, entregar, pedido.t)
    if (espera === null) return
    const meu = espera.espera.contas.find((conta) => conta.contaId === eu)
    if (meu === undefined) return recusar(entregar, pedido.t, 'nao-existe', pedido.id)
    const lado = pedido.lado === null || pedido.lado === meu.lado ? meu.lado : espera.espera.modo === 'times' && espera.espera.lados.includes(pedido.lado) ? pedido.lado : undefined
    if (lado === undefined) return recusar(entregar, pedido.t, 'lados', pedido.id)
    const aceite: AceiteDaDemo = { fichas: [...pedido.fichas], ajustes: pedido.ajustes ?? null }
    const motivo = motivoDoAceite(eu, meu.papel, aceite)
    if (motivo !== null) return recusar(entregar, pedido.t, motivo, pedido.id)
    espera.espera = { ...espera.espera, contas: espera.espera.contas.map((conta) => (conta.contaId === eu ? { ...conta, lado } : conta)) }
    marcarAceite(espera, eu, aceite)
    difundir({ t: 'luta.espera', espera: espera.espera })
    // Quem criou é o colega inventado: com todo mundo dentro, ele começa.
    if (espera.espera.criador.contaId !== eu && espera.espera.contas.every((conta) => conta.aceitou)) {
      opcoes.depois(COMECA_EM_MS, () => {
        const agora = esperas.get(pedido.id)
        if (agora === undefined) return
        const comecada = comecarLuta(agora)
        if (!comecada.ok) return difundir({ t: 'luta.fechada', id: pedido.id, motivo: 'desistiu' })
        publicar(comecada.daMesa, false, true)
      })
    }
  }

  function aplicado(daMesa: LutaDaMesa, feito: ResultadoNaLuta, pedido: PedidoDaLuta['t'], entregar: (mensagem: MensagemDaLutaDoServidor) => void, listaMudou = false): void {
    if (!feito.ok) {
      recusar(entregar, pedido, feito.motivo, daMesa.luta.id)
      if (feito.motivo === 'seqVelho' || feito.motivo === 'acabou') estadoPara(daMesa.luta, entregar)
      return
    }
    const acabouAntes = daMesa.luta.fim !== null
    daMesa.luta = feito.luta
    publicar(daMesa, acabouAntes, listaMudou)
  }

  function daConta(id: string, pedido: PedidoDaLuta['t'], entregar: (mensagem: MensagemDaLutaDoServidor) => void): LutaDaMesa | null {
    const daMesa = lutas.get(id)
    if (daMesa === undefined || participanteDaConta(daMesa.luta, eu) === null) {
      recusar(entregar, pedido, 'nao-existe', id)
      return null
    }
    return daMesa
  }

  /** Recusar o convite; quem criou desiste da sala inteira. Também o `luta.sair` na espera. */
  function recusarEspera(id: string, pedido: PedidoDaLuta['t'], entregar: (mensagem: MensagemDaLutaDoServidor) => void): void {
    const espera = esperaQueVale(id, entregar, pedido)
    if (espera === null) return
    if (espera.espera.criador.contaId === eu) {
      esperas.delete(id)
      return difundir({ t: 'luta.fechada', id, motivo: 'desistiu' })
    }
    espera.espera = { ...espera.espera, contas: espera.espera.contas.filter((conta) => conta.contaId !== eu) }
    espera.aceites.delete(eu)
    entregar({ t: 'luta.fechada', id, motivo: 'recusou' })
  }

  return {
    ouvir(entregar) {
      ouvintes.add(entregar)
      for (const daMesa of lutas.values()) agendarRobo(daMesa)
      return () => ouvintes.delete(entregar)
    },
    atender(pedido, quem, entregar) {
      switch (pedido.t) {
        case 'luta.lista':
          entregar(lista())
          for (const { luta } of lutas.values()) estadoPara(luta, entregar)
          return
        case 'luta.historico': {
          if (pedido.id !== undefined) {
            const achada = historico.find((luta) => luta.id === pedido.id)
            return entregar({ t: 'luta.historico', lista: achada === undefined ? [] : [achada], temMais: false })
          }
          const antes = pedido.antesDe
          const depois = historico.filter((luta) => antes === null || luta.fim < antes)
          const pagina = depois.slice(0, Math.min(pedido.limite, PAGINA_DO_HISTORICO_MAX)).map(({ registro: _registro, ...semRegistro }) => semRegistro)
          return entregar({ t: 'luta.historico', lista: pagina, temMais: depois.length > pagina.length })
        }
        case 'luta.criar':
          return criar(pedido, quem, entregar)
        case 'luta.aceitar':
          return aceitar(pedido, entregar)
        case 'luta.recusar':
          return recusarEspera(pedido.id, pedido.t, entregar)
        case 'luta.comecar': {
          const espera = esperaQueVale(pedido.id, entregar, pedido.t)
          if (espera === null) return
          if (espera.espera.criador.contaId !== eu) return recusar(entregar, pedido.t, 'so-criador', pedido.id)
          const semVoce = espera.espera.contas.filter((conta) => !conta.aceitou).map((conta) => conta.contaId)
          const comecada = comecarLuta(espera)
          if (!comecada.ok) return recusar(entregar, pedido.t, comecada.motivo, pedido.id)
          if (semVoce.includes(eu)) entregar({ t: 'luta.fechada', id: pedido.id, motivo: 'semVoce' })
          return publicar(comecada.daMesa, false, true)
        }
        case 'luta.jogar': {
          const daMesa = daConta(pedido.id, pedido.t, entregar)
          if (daMesa === null) return
          return aplicado(daMesa, aplicarJogadaNaLuta(daMesa.luta, motor, eu, pedido.jogada), pedido.t, entregar)
        }
        case 'luta.arbitrar': {
          const daMesa = daConta(pedido.id, pedido.t, entregar)
          if (daMesa === null) return
          return aplicado(daMesa, arbitrarNaLuta(daMesa.luta, motor, eu, pedido.pedido, opcoes.agora()), pedido.t, entregar)
        }
        case 'luta.sair':
        case 'luta.parar': {
          if (pedido.t === 'luta.sair' && esperas.has(pedido.id)) return recusarEspera(pedido.id, pedido.t, entregar)
          const daMesa = daConta(pedido.id, pedido.t, entregar)
          if (daMesa === null) return
          const papel = participanteDaConta(daMesa.luta, eu)?.papel
          if (pedido.t === 'luta.parar' && papel !== 'espectador') return recusar(entregar, pedido.t, 'papel', pedido.id)
          const feito = sairDaLuta(daMesa.luta, motor, eu, opcoes.agora())
          if (feito.ok && participanteDaConta(feito.luta, eu) === null) entregar({ t: 'luta.fechada', id: pedido.id, motivo: 'recusou' })
          return aplicado(daMesa, feito, pedido.t, entregar, papel === 'espectador')
        }
        case 'luta.assistir': {
          const daMesa = lutas.get(pedido.id)
          if (daMesa === undefined || daMesa.luta.fim !== null) return recusar(entregar, pedido.t, 'nao-existe', pedido.id)
          if (participanteDaConta(daMesa.luta, eu) !== null) return estadoPara(daMesa.luta, entregar)
          if (daMesa.luta.participantes.length >= CONTAS_POR_LUTA_MAX) return recusar(entregar, pedido.t, 'cheia', pedido.id)
          daMesa.luta = { ...daMesa.luta, participantes: [...daMesa.luta.participantes, { contaId: eu, nome: nomeDe(eu), papel: 'espectador', lado: null, ausenteDesde: null }] }
          return publicar(daMesa, false, true)
        }
      }
    },
  }
}
