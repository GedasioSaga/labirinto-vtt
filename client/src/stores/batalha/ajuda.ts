/**
 * REQUISITOS, fase E (docs/design/habilidades/REQUISITOS.md §7): o PEDIDO DE AJUDA a um aliado na
 * store. O portão diz "só falta o aliado aceitar" (`perguntaAoAliado`) e o caminho (técnica, Atacar,
 * item, Evoluir) chama `pedirAjuda`: nasce a pendência em `turnos.pedidosDeAjuda` e nada é gasto. O
 * aliado (ou o mestre, pelo NPC) responde por `ajuda`; o aceite roda o pedido congelado pelo portão
 * inteiro de novo, com o autor de quem pediu, e sai uma linha só (o Desfazer dela volta os dois). Quem
 * pode responder ou cancelar pela rede o host confere (`net/batalhaNoHost.ts`).
 */
import type { AcaoDaAjuda, AjudaPendente, PedidoDeAcao } from '../../lib/batalha/combate'
import type { ContextoDoGolpe } from '../../lib/batalha/golpe'
import { tecnicaPorId } from '../../lib/batalha/leituraDaFicha'
import { ajudaAberta, comAAjuda, comOPrazo, esperandoAjuda, fecharAAjuda, novaAjuda, novoPedidoAoMestre, semAAjuda, type AceitesDoPedido, type PerguntaAoMestre, type PerguntaDaAjuda } from '../../lib/batalha/requisitos/ajuda'
import { PREFIXO_DA_AJUDA, type CancelamentoDaAjuda, type RespostaDaAjuda } from '../../lib/batalha/requisitos/modelo'
import type { AutorDaAcao, CartaDaOrdem, TurnosDaCena } from '../../lib/batalha/turnos'
import { nomeNaBatalha } from '../../lib/habilidadeOculta'
import { nomeDoTokenNa, personagemDoTokenNa } from './cena'
import type { GolpeNaStore } from './golpe'
import type { NucleoDaBatalha } from './nucleo'
import type { BatalhaDaCena, BatalhaState } from './tipos'

/** O relógio da store: o do `deps` (a prova o fixa), senão o do sistema. */
function agoraDa(nucleo: Pick<NucleoDaBatalha, 'deps'>): number {
  return nucleo.deps.agora === undefined ? Date.now() : nucleo.deps.agora()
}

/** O nome do que se pede, para as duas telas ("Armadura Humana", "Atacar"). A técnica oculta sai como na batalha. */
export function nomeDaAcaoDaAjuda(ctx: Pick<ContextoDoGolpe, 'personagem' | 'sistema'>, pedido: PedidoDeAcao): string {
  const { personagem, sistema } = ctx
  switch (pedido.tipo) {
    case 'habilidade': {
      const achada = personagem === null || sistema === null ? null : tecnicaPorId(personagem, sistema, pedido.cartaoId)
      return achada === null ? 'a técnica' : nomeNaBatalha(personagem, achada.cartao, 'a técnica')
    }
    case 'atacar':
      return 'Atacar'
    case 'item':
      return 'o item'
    default:
      return 'a ação'
  }
}

/**
 * A pendência nasce (o portão já disse que o resto do pedido vale supondo o aceite). `false` = sem
 * aliado escolhido entre os que podem, ou a ficha já espera outra resposta.
 */
export function pedirAjuda(nucleo: Pick<NucleoDaBatalha, 'deps' | 'mesaDoRpg' | 'gravarCena'>, sceneKey: string, cena: BatalhaDaCena, autor: AutorDaAcao, carta: CartaDaOrdem, acao: AcaoDaAjuda, pergunta: PerguntaDaAjuda, tecnica: string): boolean {
  const escolhido = pergunta.candidatos.find((candidato) => candidato.tokenId === pergunta.escolhido)
  if (escolhido === undefined || carta.personagemId === null) return false
  const { turnos } = cena
  if (esperandoAjuda(turnos, carta.tokenId) !== null) return false
  const nomeDe = nomeDoTokenNa(turnos, nucleo.mesaDoRpg().personagens)
  const ajuda = novaAjuda({
    id: `${PREFIXO_DA_AJUDA}${crypto.randomUUID()}`,
    acao,
    autor,
    deTokenId: carta.tokenId,
    dePersonagemId: carta.personagemId,
    nomeDe: nomeDe(carta.tokenId),
    paraTokenId: escolhido.tokenId,
    paraPersonagemId: personagemDoTokenNa(turnos)(escolhido.tokenId) ?? null,
    nomePara: escolhido.nome,
    responde: escolhido.responde,
    pergunta,
    tecnica,
    turnos,
    agora: agoraDa(nucleo),
  })
  nucleo.gravarCena(sceneKey, { ...cena, turnos: comAAjuda(turnos, ajuda), turnosRev: cena.turnosRev + 1 })
  return true
}

/**
 * REQUISITOS J2: o pedido ao mestre nasce (o portão já disse que o resto do pedido vale supondo a
 * aprovação). Mesma lista e mesmas regras da ajuda; `jaAceita` = o aliado aceitou antes (G1/G2 + J2).
 * `false` = a ficha já espera outra resposta.
 */
export function pedirAoMestre(nucleo: Pick<NucleoDaBatalha, 'deps' | 'mesaDoRpg' | 'gravarCena'>, sceneKey: string, cena: BatalhaDaCena, autor: AutorDaAcao, carta: CartaDaOrdem, acao: AcaoDaAjuda, pergunta: PerguntaAoMestre, tecnica: string, jaAceita: boolean): boolean {
  if (carta.personagemId === null) return false
  const { turnos } = cena
  if (esperandoAjuda(turnos, carta.tokenId) !== null) return false
  const nomeDe = nomeDoTokenNa(turnos, nucleo.mesaDoRpg().personagens)
  const ajuda = novoPedidoAoMestre({ id: `${PREFIXO_DA_AJUDA}${crypto.randomUUID()}`, acao, autor, deTokenId: carta.tokenId, dePersonagemId: carta.personagemId, nomeDe: nomeDe(carta.tokenId), pergunta, tecnica, turnos, agora: agoraDa(nucleo), jaAceita })
  nucleo.gravarCena(sceneKey, { ...cena, turnos: comAAjuda(turnos, ajuda), turnosRev: cena.turnosRev + 1 })
  return true
}

/** O que o pedido congelado leva ao rodar de novo: o aceite do aliado ou a aprovação do mestre (com o aceite de antes). */
function aceitesDa(ajuda: AjudaPendente): AceitesDoPedido {
  if (ajuda.aoMestre !== true) return { ajuda: true }
  return ajuda.jaAceita === true ? { ajuda: true, mestre: true } : { mestre: true }
}

/** A fatia da ajuda: responder, cancelar e o prazo. */
export function criarAjuda(nucleo: NucleoDaBatalha, fatiaDoGolpe: Pick<GolpeNaStore, 'agirComAjudaAceita'>, fatiaDasPassivas: { evoluirComAjudaAceita: (sceneKey: string, autor: AutorDaAcao, pedido: Extract<AcaoDaAjuda, { tipo: 'evoluir' }>['pedido'], aceites: AceitesDoPedido) => boolean }) {
  const { cenaDe, gravarCena } = nucleo

  /** Os turnos novos sem linha no registro: o `turnosRev` sobe para os jogadores verem. */
  const gravarTurnos = (sceneKey: string, cena: BatalhaDaCena, turnos: TurnosDaCena): boolean => {
    if (turnos === cena.turnos) return false
    gravarCena(sceneKey, { ...cena, turnos, turnosRev: cena.turnosRev + 1 })
    return true
  }

  const responder = (sceneKey: string, autor: AutorDaAcao, pedido: RespostaDaAjuda): boolean => {
    const cena = cenaDe(sceneKey)
    const ajuda = cena?.turnos.pedidosDeAjuda?.find((candidata) => candidata.id === pedido.ajudaId)
    if (cena === undefined || ajuda === undefined || ajuda.estado !== 'esperando') return false
    // O NPC aliado só o mestre responde; o dono da ficha do aliado o host confere (a store não sabe quem é dono de quê).
    if (ajuda.paraPersonagemId === null && autor.tipo !== 'mestre') return false
    const agora = agoraDa(nucleo)
    // Resposta depois do prazo: o pedido venceu (o primeiro evento que chega vence).
    if (!ajudaAberta(ajuda, agora)) {
      gravarTurnos(sceneKey, cena, comOPrazo(cena.turnos, agora))
      return false
    }
    if (!pedido.aceita) {
      const quem = ajuda.aoMestre === true ? 'O mestre recusou' : autor.tipo === 'mestre' ? `O mestre recusou por ${ajuda.nomePara}` : `${ajuda.nomePara} recusou`
      return gravarTurnos(sceneKey, cena, fecharAAjuda(cena.turnos, ajuda.id, 'recusado', quem, agora))
    }
    // O aceite (ou a aprovação do mestre, J2): a pendência sai e o pedido congelado roda o portão inteiro de novo (o estado pode ter
    // mudado), com o autor de quem pediu.
    gravarCena(sceneKey, { ...cena, turnos: semAAjuda(cena.turnos, ajuda.id) })
    const { acao } = ajuda
    const aceites = aceitesDa(ajuda)
    const saiu = acao.tipo === 'agir' ? fatiaDoGolpe.agirComAjudaAceita(sceneKey, ajuda.autor, acao.vez, acao.pedido, aceites) : fatiaDasPassivas.evoluirComAjudaAceita(sceneKey, ajuda.autor, acao.pedido, aceites)
    if (saiu) return true
    // Não passou mais: a pendência volta como aviso para quem pediu; o aliado vê a recusa do pedido dele.
    const depois = cenaDe(sceneKey) ?? cena
    const quemAceitou = ajuda.aoMestre === true ? 'O mestre aprovou' : `${ajuda.nomePara} aceitou`
    gravarTurnos(sceneKey, depois, comAAjuda(depois.turnos, { ...ajuda, estado: 'naoPassou', motivo: `${quemAceitou}, mas ${ajuda.nomeDe} já não pode usar ${ajuda.tecnica}`, fechadoEm: agora }))
    return false
  }

  /** Quem pediu desiste (ou fecha o aviso); o mestre cancela qualquer um (quem pediu vê o aviso). */
  const cancelar = (sceneKey: string, autor: AutorDaAcao, pedido: CancelamentoDaAjuda): boolean => {
    const cena = cenaDe(sceneKey)
    const ajuda = cena?.turnos.pedidosDeAjuda?.find((candidata) => candidata.id === pedido.ajudaId)
    if (cena === undefined || ajuda === undefined) return false
    if (autor.tipo === 'mestre' && ajuda.estado === 'esperando' && ajuda.autor.tipo !== 'mestre') {
      return gravarTurnos(sceneKey, cena, fecharAAjuda(cena.turnos, ajuda.id, 'cancelado', 'O mestre cancelou o pedido', agoraDa(nucleo)))
    }
    return gravarTurnos(sceneKey, cena, semAAjuda(cena.turnos, ajuda.id))
  }

  const acoes: Pick<BatalhaState, 'ajuda' | 'vencerAjudas'> = {
    ajuda: (sceneKey, autor, pedido) => (pedido.tipo === 'responderAjuda' ? responder(sceneKey, autor, pedido) : cancelar(sceneKey, autor, pedido)),
    vencerAjudas: (sceneKey, agora) => {
      const cena = cenaDe(sceneKey)
      return cena === undefined ? false : gravarTurnos(sceneKey, cena, comOPrazo(cena.turnos, agora))
    },
  }
  return { acoes }
}
