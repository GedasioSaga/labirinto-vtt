import type { CarriedItem, EfeitoDoItem } from '../../types/map'
import { quantidadeDe } from '../items'
import { cartoesDaAba, novoCartao, type CartaoDaFicha, type Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { DANO_MAX, type AcaoDaTecnica, type PedidoDeAcao, type PedidoDeAlvo } from './combate'
import { ABA_DAS_TECNICAS } from './leituraDaFicha'
import { danoDaTecnica } from './leituraDaTecnica'
import { lerMarca } from './marca'
import { pecasDoCartao, reacaoDasPecas } from './mecanica/leitura'
import { lerMecanica, type QuemOAlvoPega } from './mecanica/modelo'
import { resumoDoEfeitoDoItem } from './mecanica/resumoDoItem'
import { limpezaDe, mecanicaDoCartao, perfuranteDaMecanica, respostasPadrao, type AreaAMao } from './mecanicasAMao'
import { REGISTRO_TEXTO_MAX } from './registro'
import { bonusDaBatalha, seloPedidoValido, type SeloQueSoma } from './selos'
import { seloSugeridoDaTecnica, type ReacaoDoTipo } from './tiposDaHabilidade'

/**
 * "USAR ITEM" NA BATALHA (Fase 8 de docs/design/habilidades/SISTEMA.md §5.2):
 * o pedido traz só a vaga da mochila de quem usa e os alvos. O efeito sai da
 * cópia de quem resolve (o host, ou a mesa do mestre): a vaga vira uma
 * "técnica" montada só nesta conta (o mesmo caminho da arma montada e do
 * Testar do item), com a ação das peças, sem custo, o dano e o selo das peças.
 * Nada daqui grava: a ficha com o cartão do item nunca vai para a mesa.
 */

export type PedidoDoItem = Extract<PedidoDeAcao, { tipo: 'item' }>
type PedidoDaHabilidade = Extract<PedidoDeAcao, { tipo: 'habilidade' }>

/** O id do cartão do item na conta: nunca casa com um cartão de verdade (os da ficha não têm ":"). */
const PREFIXO_DO_CARTAO_DO_ITEM = 'item:'

export function idDoCartaoDoItem(vagaId: string): string {
  return `${PREFIXO_DO_CARTAO_DO_ITEM}${vagaId}`
}

/** A vaga com o efeito (o tipo estreitado). */
export type VagaComEfeito = CarriedItem & { efeito: EfeitoDoItem }

function temEfeito(vaga: CarriedItem): vaga is VagaComEfeito {
  return vaga.efeito !== undefined
}

/** As vagas que aparecem na lista Itens da batalha: com efeito e que não são só de fora (aceite 4: sem efeito não aparece). */
export function vagasDeUsarNaBatalha(mochila: readonly CarriedItem[] | undefined): VagaComEfeito[] {
  return (mochila ?? []).filter(temEfeito).filter((vaga) => vaga.efeito.onde !== 'soFora')
}

/** As vagas do "Usar" fora da batalha: com efeito e que não são só da batalha. */
export function vagasDeUsarFora(mochila: readonly CarriedItem[] | undefined): VagaComEfeito[] {
  return (mochila ?? []).filter(temEfeito).filter((vaga) => vaga.efeito.onde !== 'soNaBatalha')
}

/** Por que a vaga não serve agora, ou a vaga achada (com o lugar dela na mochila). */
export function vagaParaUsar(mochila: readonly CarriedItem[] | undefined, vagaId: string, naBatalha: boolean): { vaga: VagaComEfeito; indice: number } | string {
  const lista = mochila ?? []
  const indice = lista.findIndex((candidata) => candidata.id === vagaId)
  const vaga = lista[indice]
  // Segurança (aceite 3): a vaga só vale na mochila da ficha de quem usa; a de outra ficha cai aqui.
  if (vaga === undefined) return 'O item não está na mochila de quem usa'
  if (!temEfeito(vaga)) return 'Este item não tem efeito'
  const nome = vaga.nome.trim() || 'O item'
  if (naBatalha && vaga.efeito.onde === 'soFora') return `${nome} vale só fora da batalha`
  if (!naBatalha && vaga.efeito.onde === 'soNaBatalha') return `${nome} vale só na batalha`
  if (quantidadeDe(vaga) < 1) return `${nome} acabou`
  const lida = lerMecanica(vaga.efeito.mecanica)
  if (lida.tipo === 'futura') return 'O efeito do item é de uma versão mais nova do app: atualize para usar'
  if (lida.tipo !== 'pecas') return 'O efeito do item tem uma peça torta: abra o item no Acervo'
  return { vaga, indice }
}

/** O cartão do item só para a conta: o nome da vaga e as peças do efeito. */
export function cartaoDoItem(vaga: VagaComEfeito): CartaoDaFicha {
  // REQUISITOS C: os requisitos da vaga (cópia do Acervo) vão com o cartão: o portão da técnica os confere.
  return { ...novoCartao(vaga.nome.trim() || 'Item'), id: idDoCartaoDoItem(vaga.id), mecanica: vaga.efeito.mecanica, ...(vaga.requisitos === undefined ? {} : { requisitos: vaga.requisitos }) }
}

/** A ficha com o cartão do item na aba Habilidades (troca o de mesmo id). Só para a conta: não grava. */
export function fichaComOItem(personagem: Personagem, cartao: CartaoDaFicha): Personagem {
  const tecnicas = cartoesDaAba(personagem, ABA_DAS_TECNICAS).filter((atual) => atual.id !== cartao.id)
  return { ...personagem, abas: { ...personagem.abas, [ABA_DAS_TECNICAS]: [...tecnicas, cartao] } }
}

/**
 * O pedido da "técnica" do item, como a mira do mestre o mandaria: sem custo,
 * a ação das peças (`acao: null`), o perfurante e o selo das peças, e o dano
 * lido das peças na ficha de quem usa (o pedido do item não traz número:
 * quem pede não manda no efeito).
 */
export function pedidoDaTecnicaDoItem(pedido: PedidoDoItem, cartao: CartaoDaFicha, quemUsa: Personagem, sistema: SistemaDeRpg, selos: readonly SeloQueSoma[] | undefined, tokenId: string): PedidoDaHabilidade {
  const sugerido = lerMarca(cartao, sistema)?.tipo === 'aoAcertar' ? null : seloSugeridoDaTecnica(cartao, sistema)
  const selo = sugerido === null ? null : seloPedidoValido(sugerido, sistema)
  const lido = danoDaTecnica(cartao, { personagem: quemUsa, sistema, arma: null, bonusDaBatalha: bonusDaBatalha(selos, tokenId) })
  const dano = lido.tipo === 'valor' ? Math.min(DANO_MAX, Math.max(0, Math.floor(lido.valor))) : null
  const alvos: PedidoDeAlvo[] = pedido.alvos.map((alvo) => ({ tokenId: alvo.tokenId, dano }))
  return {
    tipo: 'habilidade',
    cartaoId: cartao.id,
    armaId: null,
    alvos,
    surpresa: false,
    perfurante: perfuranteDaMecanica(cartao, respostasPadrao(cartao)) ?? false,
    custo: null,
    acao: null,
    ...(selo === null ? {} : { selo }),
    ...(pedido.ponto === undefined ? {} : { ponto: pedido.ponto }),
    ...(pedido.centroId === undefined ? {} : { centroId: pedido.centroId }),
    // Fase C do alcance: o lado da mira e a confirmação do "usar mesmo assim" seguem para a técnica do item.
    ...(pedido.direcao === undefined ? {} : { direcao: pedido.direcao }),
    ...(pedido.foraDoAlcance === undefined ? {} : { foraDoAlcance: pedido.foraDoAlcance }),
    // REQUISITOS C: a caixa, a escolha e o "usar mesmo assim" do mestre seguem para a técnica do item.
    ...(pedido.respostas === undefined ? {} : { respostas: pedido.respostas }),
    ...(pedido.forcarRequisitos === undefined ? {} : { forcarRequisitos: pedido.forcarRequisitos }),
  }
}

/** O uso do item resolvido: a ficha de quem usa com o cartão do item, o pedido da técnica e a vaga de onde sai. */
export interface UsoDoItem {
  quemUsa: Personagem
  cartao: CartaoDaFicha
  pedido: PedidoDaHabilidade
  vaga: VagaComEfeito
  indice: number
}

/** O item do pedido na mochila de `personagem` (a ficha da carta que age), virado técnica; ou o motivo da recusa. */
export function usoDoItem(personagem: Personagem | null, sistema: SistemaDeRpg | null, pedido: PedidoDoItem, selos: readonly SeloQueSoma[] | undefined, tokenId: string): UsoDoItem | string {
  if (personagem === null || sistema === null) return 'Ficha sem personagem não tem mochila: use "Dar dano"'
  const achada = vagaParaUsar(personagem.mochila, pedido.vagaId, true)
  if (typeof achada === 'string') return achada
  const cartao = cartaoDoItem(achada.vaga)
  const quemUsa = fichaComOItem(personagem, cartao)
  return { quemUsa, cartao, pedido: pedidoDaTecnicaDoItem(pedido, cartao, quemUsa, sistema, selos, tokenId), vaga: achada.vaga, indice: achada.indice }
}

/**
 * O ITEM COMO O JOGADOR O RECEBE (SISTEMA.md §5.1, decisão C8): o nome, a
 * frase, quantos tem e o que a MIRA precisa (em quem vale, o alcance, a área,
 * o teto, o reviver), lidos pelo host da cópia dele. Nunca as peças do efeito:
 * o pedido traz só a vaga, e o host resolve o resto.
 */
export interface ItemParaJogador {
  vagaId: string
  nome: string
  resumo: string
  quantos: number
  /** Cada uso tira 1 (`false` = o amuleto, não acaba). */
  gasta: boolean
  acao: AcaoDaTecnica
  quem: QuemOAlvoPega
  /** Se o alvo reage com o d20, como o host decide pelas peças (`reacaoDasPecas`): o teste rolado ao usar não reage. */
  reacao: ReacaoDoTipo
  alcance?: number
  area?: AreaAMao
  tetoDeAlvos?: number
  reviver?: true
  cura?: true
  semAlvo?: true
}

/** Teto de itens de um personagem no fio (a mochila tem bem menos vagas com efeito). */
export const ITENS_PARA_JOGADOR_MAX = 60

/** Os itens da lista Itens da batalha para a tela do jogador, lidos da mochila da cópia do host. */
export function itensParaJogador(mochila: readonly CarriedItem[] | undefined): ItemParaJogador[] {
  return vagasDeUsarNaBatalha(mochila)
    .slice(0, ITENS_PARA_JOGADOR_MAX)
    .flatMap((vaga): ItemParaJogador[] => {
      const cartao = cartaoDoItem(vaga)
      const pecas = pecasDoCartao(cartao)
      if (pecas === null) return []
      const mecanica = mecanicaDoCartao(cartao)
      const item: ItemParaJogador = {
        vagaId: vaga.id,
        nome: vaga.nome.trim() || 'Item',
        resumo: vaga.efeitoResumo ?? resumoDoEfeitoDoItem(vaga.efeito),
        quantos: quantidadeDe(vaga),
        gasta: vaga.efeito.gasta === 'um',
        // 'perguntar' não serve ao item (o pedido não traz a ação): a mira mostra a Simples, e o host recusa com o motivo.
        acao: pecas.acao === 'perguntar' ? 'simples' : pecas.acao,
        quem: pecas.alvo.quem,
        reacao: reacaoDasPecas(pecas),
      }
      if (mecanica?.alcance !== undefined) item.alcance = mecanica.alcance
      if (mecanica?.area !== undefined) item.area = mecanica.area
      if (mecanica?.tetoDeAlvosComDano !== undefined) item.tetoDeAlvos = mecanica.tetoDeAlvosComDano
      if (mecanica?.reviver !== undefined) item.reviver = true
      if (limpezaDe(cartao) !== null) item.cura = true
      if (mecanica?.semAlvo === true) item.semAlvo = true
      return [item]
    })
}

/** O corte do corpo da linha do item (o mesmo "…" de `textoDaLinha`). */
const RETICENCIAS = '…'

/** Quantos sobram na vaga depois deste uso; `undefined` = o item não acaba (o amuleto). */
export function sobraDoUso(vaga: VagaComEfeito): number | undefined {
  return vaga.efeito.gasta === 'um' ? Math.max(0, quantidadeDe(vaga) - 1) : undefined
}

/** O que a linha do registro diz do gasto: " · item da mochila: sobram 2". */
export function textoDaSobra(sobra: number): string {
  return ` · item da mochila: ${sobra === 0 ? 'era o último' : sobra === 1 ? 'sobra 1' : `sobram ${sobra}`}`
}

/** O gasto da vaga na linha do registro, ou nada (o amuleto não acaba). */
export function textoDoGasto(vaga: VagaComEfeito): string {
  const sobra = sobraDoUso(vaga)
  return sobra === undefined ? '' : textoDaSobra(sobra)
}

/**
 * A linha do item no teto do registro (`REGISTRO_TEXTO_MAX`): o gasto fecha a
 * linha e nunca some; quem cede é o corpo (os alvos), cortado com "…". Sem
 * isto, a granada com dois testes passava do teto e o corte comia o "sobra N".
 */
export function linhaComOGasto(corpo: string, gasto: string): string {
  if (corpo.length + gasto.length <= REGISTRO_TEXTO_MAX) return `${corpo}${gasto}`
  return `${corpo.slice(0, Math.max(0, REGISTRO_TEXTO_MAX - gasto.length - RETICENCIAS.length))}${RETICENCIAS}${gasto}`
}
