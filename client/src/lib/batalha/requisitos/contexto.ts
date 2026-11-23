import { mesmaMarca } from './ler'
import { ehNaoLido, ehUmDestes, type GrupoDeRequisitos, type Referencia, type TipoDeRequisito, type TipoDoAlvo } from './modelo'
import type { RespostasDoPedido } from '../perguntaNaHora'

/**
 * REQUISITOS: O CONTEXTO (fase B1 de docs/design/habilidades/REQUISITOS.md §4). O retrato da
 * batalha que o avaliador (`avaliar.ts`) lê: quem usa, os alvos, o campo e o que já foi
 * respondido. É dado puro, sem o tipo do motor: os montadores (do host, do mestre e do jogador)
 * leem o estado da batalha e preenchem isto, então o avaliador não puxa store, rede nem Pixi.
 *
 * Regra de todo campo opcional: AUSENTE = "não sei". O requisito que depende dele sai `naoSei`
 * ("o mestre confere"), nunca "ok" nem "falta". É assim que entram:
 * - o que o jogador não enxerga (a vida do NPC, o inimigo no escuro): o montador do jogador deixa
 *   de fora e o host, que tem tudo, decide;
 * - o que o motor ainda não guarda (o rastro da fase B3: andou, apanhou, acertou, errou, a última
 *   ação, as usadas; os aliados que caíram; a luz): até a B3, o montador deixa de fora.
 *
 * Puro: sem store, sem rede, sem Pixi.
 */

/** HP de agora e o máximo. */
export interface VidaNoContexto {
  atual: number
  max: number
}

/** Uma técnica ou passiva ligada (B1); `opcao` = a chave da variante escolhida, se tem. */
export interface LigadaNoContexto extends Referencia {
  opcao?: string
}

/** O nível de agora de um acumulador da ficha (A4). O que a ficha não tem conta como nível 0. */
export interface AcumuladorNoContexto {
  id: string
  nome: string
  nivel: number
}

/** Um item da mochila (F1); o mesmo item em duas vagas soma. */
export interface ItemNoContexto extends Referencia {
  quantidade: number
}

/** Uma arma na mão (F2), com a categoria dela ("Branca", "Fogo"), se tem. */
export interface ArmaNoContexto extends Referencia {
  categoria?: string
}

/** A ação imediatamente anterior de quem usa (C2). */
export type UltimaAcao = { tipo: 'cartao'; cartao: Referencia } | { tipo: 'atacar' } | { tipo: 'item' }

/**
 * O rastro de quem usa (fase B3, §5). Cada campo ausente = o motor ainda não guarda (ou o
 * montador não sabe): o requisito dele sai `naoSei`.
 */
export interface RastroNoContexto {
  /** Casas andadas nesta vez (B4 parado, B5 andou). */
  casasAndadas?: number
  /** Dano recebido desde o começo da última vez dele (B6). */
  danoDesdeAVez?: number
  /** Acertou alguém nesta vez (B7). */
  acertouNaVez?: boolean
  /** O último ataque dele (B8); `null` = ainda não atacou nesta batalha. */
  ultimoAtaque?: 'acertou' | 'errou' | null
  /** A ação imediatamente anterior dele (C2); `null` = nenhuma ainda. */
  ultimaAcao?: UltimaAcao | null
  /** As técnicas que ele já usou nesta batalha (C3). */
  usadas?: readonly Referencia[]
  /** Quantas ações ele já fez nesta vez (C4 "a primeira": 0). */
  acoesNaVez?: number
  /** Esta é a última ação que cabe na vez dele (C4 "a última"). */
  ehAUltimaAcao?: boolean
}

/** Quem usa a técnica (ou a arma, o item, a forma, o Evoluir). */
export interface QuemUsaNoContexto {
  tokenId: string
  nome: string
  sp?: number
  vida?: VidaNoContexto
  /** O Escudo de agora (A3: "de pé" = mais que 0). */
  escudo?: number
  acumuladores?: readonly AcumuladorNoContexto[]
  /** A concentração guardada, de 0 a 3 (A5, `CombateDoPersonagem.carga`). */
  carga?: number
  /** Tem a reação livre (A7; o contrário de `CombateDoPersonagem.semReacao`). */
  reacaoLivre?: boolean
  ligadas?: readonly LigadaNoContexto[]
  /** Os nomes dos selos que estão nele (B2). */
  selos?: readonly string[]
  /** As formas ligadas, a Parte incluída (B3); vazia = sem forma. */
  formas?: readonly Referencia[]
  mochila?: readonly ItemNoContexto[]
  armasNaMao?: readonly ArmaNoContexto[]
  /** As balas (F3, `municaoDaFicha.ts`). */
  balas?: number
  rastro?: RastroNoContexto
}

/**
 * Um alvo escolhido. `barraVisivel`: quem vai LER o resultado enxerga a barra de vida deste alvo.
 * Falso = o motivo de vida do alvo não sai (sai "O alvo não cumpre o requisito"): o host, que sabe
 * a vida, julga certo e não entrega a vida do NPC ao jogador.
 */
export interface AlvoNoContexto {
  tokenId: string
  nome: string
  barraVisivel: boolean
  vida?: VidaNoContexto
  /** Os nomes dos selos que estão nele (D1). */
  selos?: readonly string[]
  /** Tem a marca de quem usa (D3, `marca.ts`). */
  marcadoPorQuemUsa?: boolean
  tipo?: TipoDoAlvo
  /** Já agiu nesta rodada (D6, pela ordem). */
  jaAgiuNaRodada?: boolean
}

/** Um aliado ou um inimigo no campo (quem usa fica de fora da lista dos aliados). */
export interface VizinhoNoContexto {
  tokenId: string
  nome: string
  dePe: boolean
  /** NPC: quem responde ao pedido de ajuda é o mestre. */
  npc: boolean
  /** Casas até quem usa; ausente = não sei (no escuro, fora da visão). */
  distancia?: number
  /** As marcas das técnicas dele (G2, `CartaoDaFicha.marcas`); ausente = não sei. */
  marcas?: readonly string[]
  /** O que ele tem para pagar o pedido (G1); ausente = não sei. */
  sp?: number
  hp?: number
  escudo?: number
}

/** Os aliados ou os inimigos. `completa` falso = pode haver gente que quem lê não enxerga. */
export interface VizinhosNoContexto {
  lista: readonly VizinhoNoContexto[]
  completa: boolean
}

/** O retrato que o avaliador lê. Ausente = não sei (ver o topo do arquivo). */
export interface ContextoDosRequisitos {
  quemUsa: QuemUsaNoContexto
  /** Os alvos escolhidos; ausente = ainda sem alvo (o menu, antes da mira): os requisitos de alvo esperam. */
  alvos?: readonly AlvoNoContexto[]
  aliados?: VizinhosNoContexto
  inimigos?: VizinhosNoContexto
  rodada?: number
  /** Quem usa está na luz (E5). Só é medida se um requisito pede (`tiposDoGrupo`). */
  naLuz?: boolean
  /** O alcance da técnica em casas (E4 sem número de casas). */
  alcanceDaTecnica?: number
  /** As técnicas que os aliados usaram nesta rodada (G3). */
  usadasPorAliadosNaRodada?: readonly Referencia[]
  /** Algum aliado caiu nesta batalha (G5, `turnos.jaCairam` da fase B3). */
  aliadoCaiuNaBatalha?: boolean
  /** O custo normal da técnica em SP: o A1 que gasta precisa do número dele ALÉM deste. Ausente = 0. */
  custoEmSp?: number
  /** Usada na caixa REAÇÃO: o que espera alguém (G1, G2, J2) não vale. */
  naReacao?: boolean
  /** No treino do Lobby (sem mestre e sem relógio do servidor): G1, G2 e J2 ficam "Só na mesa". */
  noTreino?: boolean
  /** Quem pede é o mestre: o J2 ("o mestre decide") já vale. */
  autorEhMestre?: boolean
}

/**
 * O que já foi respondido. `respostas` é o campo do pedido (`perguntaNaHora.ts`): a caixa do J1 em
 * `req.<id>` = "sim"; a escolha do "Um destes" em `req.<id do grupo>` = o id da opção. O resto vem
 * do host: o aliado escolhido (`ajudaDe` do pedido) e se ele aceitou, se o mestre deixou, e o
 * resultado dos testes que o host rolou (id do requisito → passou).
 */
export interface RespostasDosRequisitos {
  respostas?: RespostasDoPedido
  ajudaDe?: string
  ajudaAceita?: boolean
  mestreDeixou?: boolean
  testes?: Readonly<Record<string, boolean>>
}

/**
 * A mesma coisa: o mesmo `id` quando os dois têm; senão o mesmo nome (sem olhar maiúscula nem
 * acento), que é o que casa quando o bloco veio do catálogo ou de outra ficha.
 */
export function mesmaReferencia(a: Referencia, b: Referencia): boolean {
  if (a.id !== undefined && a.id === b.id) return true
  return mesmaMarca(a.nome, b.nome)
}

/**
 * Os tipos que o grupo pede (as opções do "Um destes" incluídas): o montador só mede o caro (a
 * luz, as distâncias) quando algum requisito pede (`tiposDoGrupo(g).has('luz')`).
 */
export function tiposDoGrupo(grupo: GrupoDeRequisitos | undefined): ReadonlySet<TipoDeRequisito> {
  const tipos = new Set<TipoDeRequisito>()
  for (const peca of grupo?.todos ?? []) {
    const opcoes = ehUmDestes(peca) ? peca.umDestes : [peca]
    for (const opcao of opcoes) if (!ehNaoLido(opcao)) tipos.add(opcao.tipo)
  }
  return tipos
}
