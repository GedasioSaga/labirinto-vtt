import { createStore, type StoreApi } from 'zustand/vanilla'
import type { Casa } from '../lib/batalha/blocos'
import { somarNaTrilha } from '../lib/batalha/caminhoAndado'
import {
  ARMAS_NA_BATALHA_MAX,
  chaveDaVez,
  combateVazio,
  CONTRAS_MAX,
  DANO_MAX,
  EFEITOS_GUARDADOS,
  GOLPES_PENDENTES_MAX,
  INVOCACOES_PENDENTES_MAX,
  MODIFICADOR_DA_REACAO_MAX,
  PERFURACAO_MAX,
  type AlvoDoGolpe,
  type CombateDoPersonagem,
  type ContraAtaque,
  type EfeitoDaBatalha,
  type GolpeDaBatalha,
  type InvocadoNaBatalha,
  type NumerosDoInvocado,
  type MudancaDoAjuste,
  type PedidoDeAcao,
  type PedidoDeAjusteNaBatalha,
  type PedidoDoContador,
  type PedidoDeEvolucao,
  type PedidoDeInvocacao,
  type PedidoDeMarca,
  type PedidoDePassiva,
  type PedidoDeReacao,
  type LembreteDaPassiva,
  type AcaoDaForma,
  type FormaNaBatalha,
  type NumeroDaForma,
  type SaidaDaReacao,
  type SeloDaBatalha,
  type SeloPedido,
  type SeloDoGolpe,
  DANO_MAX as DELTA_DO_AJUSTE_MAX,
  MUDANCAS_DO_AJUSTE_MAX,
  NOME_DO_SELO_MAX,
} from '../lib/batalha/combate'
import { contadorDoPersonagem, motivoDoContador, nivelDoContador, seloDoContador, selosComONivel, temGolpeEsperando } from '../lib/batalha/contador'
import { gastarAcao } from '../lib/batalha/acoes'
import {
  chaveDoGastoDoInvocado,
  comBandosEmDia,
  comunsQueSaem,
  invocadoDaPendencia,
  invocadoDoToken,
  lerInvocacao,
  membrosDoBando,
  motivoDaInvocacao,
  nomeDaColocacao,
  nomeNumerado,
  novoIdDeInvocacao,
  numerosValidos,
  opcaoDaInvocacao,
  pedirInvocacao,
  pendenciaPorId,
  quantosNoCampo,
  semBandosVazios,
  ultraEmCampo,
  type ContextoDaInvocacao,
} from '../lib/batalha/invocacao'
import { fichaDoInvocado } from '../lib/livros/combate'
import { NOME_DA_MARCA, acertoNaMarca, criarMarca, golpeComOAlvo, marcaDoToken, modificadorDoTeste, motivoDaMarca, passivaDaMarca, type AcertoNaMarca } from '../lib/batalha/marca'
import { isTokenPhotoData } from '../lib/tokenPhoto'
import { recursoDeVida, vidaDoPersonagem } from '../lib/vidaDaFicha'
import type { Token } from '../types/map'
import {
  bonusDaBatalha,
  comSeloNovo,
  criarSelo,
  ondeNaVez,
  modsIguais,
  naturezaDosMods,
  novoIdDeSelo,
  pegaOSelo,
  seloEditado,
  seloPedidoValido,
  textoDoSelo,
  textoDoSeloComMods,
  textoDosMods,
  textoDosQueAcabaram,
  selosDoToken,
} from '../lib/batalha/selos'
import { acaoDaForma, ativarForma, descerUmaParte, desfazerForma, desfazerFormasNoFim, formaDaFicha, subidaDeParte, usosDaForma } from '../lib/batalha/transformacao'
import { comportamentoDoSelo, curaDoDano, ehLembreteDoSangramento, esquivaComDesvantagem, porVezDoLembrete, saidasComOsSelos, selosQueSaemNoGolpe, travaDoToken, vantagemDaReacao } from '../lib/batalha/condicoes'
import { comLembretesDaPreparacao, ehLembreteDaPreparacao, NOME_DA_PREPARACAO, seloDaPreparacao } from '../lib/batalha/preparacao'
import { danoComAsReducoes, nomesDasReducoes, porcentoDasReducoes, reducoesDoDano } from '../lib/batalha/reducaoDoDano'
import { ajusteDoRecurso, ajusteDoSpDaVez, comOCansaco, escudoNoComeco, ganhaSpNaVez, maximoDoRecurso, modsDoCansaco } from '../lib/batalha/recursosDaBatalha'
import { custoPorTurno, manterNaVez, mantidasComCusto, motivoDoCustoPorTurno, motivoDoPedidoDoCusto, pararAMantida, textoDoCustoPorTurno } from '../lib/batalha/custoPorTurno'
import { aliadosDe, equipeDe } from '../lib/batalha/equipes'
import { cartaoDaVariante, comEvoluida, custoDaEvolucao, evolucaoDe, motivoDoEvoluir, varianteDoPedido } from '../lib/batalha/escolhaEEvolucao'
import {
  acoesDaCarta,
  ajustesDoCusto,
  custoEmSp,
  depoisDaTecnica,
  golpePendente,
  lancarGolpe,
  PARTES_SEGUINTES_MAX,
  partesSeguintes,
  podeAgir,
  passarSemDano,
  resolverAlvo,
  rolarReacao,
  textoDaReacaoComTecnica,
  textoDaRolagem,
  textoDoGolpe,
  type ContextoDoGolpe,
} from '../lib/batalha/golpe'
import { quemUsaVence, rolarDisputa, textoDaDisputa } from '../lib/batalha/disputa'
import { lerDano } from '../lib/batalha/formula'
import { avisoAoCairDe, chavesDoDono, disputaNoAcerto, disputaNoUso, formulaDaCura, limpezaDe, mantidaDe, mecanicaDoCartao, perdaNoFimDaVez, porcentoDoMaximo, reacaoAMaoDe, rebatePertoDe, saidasTiradasDoDono, seloPegaNoAlvo, sobeDeParte } from '../lib/batalha/mecanicasAMao'
import { comADisputaNoUso } from '../lib/batalha/disputaNoUso'
import { debuffsDobrados, debuffsDoToken } from '../lib/batalha/debuffs'
import {
  ajustesDoPorTurno,
  chaveDoGatilho,
  comLembrada,
  comLembretesDaVez,
  comLembretesDoMomento,
  custoDaPassiva,
  efeitoPorTurno,
  gatilhoDaPassiva,
  modsSomados,
  motivoDaPassiva,
  seloDaPassiva,
  selosDaPassiva,
  semLembretes,
  textoDoPorTurno,
  type TurnosComLembretes,
} from '../lib/batalha/passivas'
import { motivoDaReacaoComTecnica, reacoesDisponiveis, reagirComTecnica, temOverloadDeReacao, temReacaoContraSurpresa, type PedidoDeTecnica } from '../lib/batalha/reacaoComTecnica'
import { casaNaAreaVirada } from '../lib/batalha/area'
import { lerJudgeNaCena, type JudgeNaCena } from '../lib/batalha/judge'
import { armasDe, CAMPO_DO_TEMPO, ehOverload, lerTempo, limiteDeArmas, recursoDoCusto, tecnicaPorId, tecnicasDe } from '../lib/batalha/leituraDaFicha'
import type { MesaDaBatalha } from '../lib/batalha/mesa'
import { ajustesDaCura, ajustesDoDano, perfuracaoValida, rolarComVantagem, rolarODadoDaEsquiva, saidaDoPassar, saidasDaRolagem } from '../lib/batalha/reacao'
import type { BatalhaEmTurnos, VezEsperada } from '../lib/batalha/ponte'
import {
  comLinha,
  desfazerFicha,
  ehPersonagemDeInvocado,
  invocadoSaiuPorLinha,
  linhaDesfeita,
  marcarDesfeita,
  mudancasDaVez,
  nomeDoAutor,
  partesDoAjuste,
  novoIdDeLinha,
  proximoSeq,
  registrarAjuste as registrarAjusteNasLinhas,
  reverterTurnos,
  semOContraGasto,
  semARecargaNasVezes,
  semOGastoNaFotoDaVez,
  semOLigarDeGraca,
  textoDaLinha,
  TIPOS_QUE_O_JOGADOR_DESFAZ,
  vezSemOsSelosDesfeitos,
  type LinhaDoRegistro,
  type ParteDaFicha,
  type Reversao,
  type TipoDaLinha,
} from '../lib/batalha/registro'
import type { RegrasDaBatalha } from '../lib/batalha/regrasDoCampo'
import {
  adicionarCartaExtra as adicionarCartaExtraNaOrdem,
  agilidadesDasCartas,
  cartaDaVez,
  darVez as darVezNaOrdem,
  incluirCombatente as incluirCombatenteNaOrdem,
  moverCarta as moverCartaNaOrdem,
  normalizar,
  novaCarta,
  ordenarPelaAgilidade as ordenarNaOrdem,
  passarVez as passarVezNaOrdem,
  removerCarta as removerCartaDaOrdem,
  selosQueSairam,
  tirarCombatente as tirarCombatenteDaOrdem,
  tokensCaidos,
  trocarDesempate as trocarDesempateNaOrdem,
  turnosVazios,
  type AcoesExtras,
  type AutorDaAcao,
  type CartaDaOrdem,
  type Desempate,
  type DuracaoDaExtra,
  type GastoDaVez,
  type TurnosDaCena,
} from '../lib/batalha/turnos'
import { aplicarAjustes, ajusteDoAtualDigitado, NOME_DO_MESTRE, NUMERO_DA_FICHA_MAX, type Ajuste } from '../lib/ajusteDaFicha'
import { numeroDaFicha, type CartaoDaFicha, type Personagem } from '../lib/personagem'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'

/**
 * MODO BATALHA (fatia B4 de docs/planos/modo-batalha-2026-10-24.md): quais
 * cenas estão em batalha e o caminho andado de cada ficha nelas. Estado da
 * SESSÃO do mestre (decisão 1): não vai ao arquivo, ao desfazer nem ao
 * jogador. A chave da cena é a de `tableSceneKey` (`net/hostSession.ts`): o id
 * da cena na aventura, ou o id do mapa solto.
 *
 * Quem lê é a sessão do host (`getBatalha`, a cada snapshot e pedido de
 * movimento); quem soma o caminho é a mesma sessão (`onBatalhaAndou`). O App
 * assina a store: troca de cena em batalha manda o snapshot na hora
 * (`notifyBatalhaChanged`) e o `anuncio` novo vai aos jogadores e à tela da
 * mesa (`anunciarBatalha`). A B5 só chama `ligar`, `desligar` e `zerarCaminhos`.
 *
 * BATALHA ONE PIECE F1 (docs/planos/batalha-one-piece-f1-plano.md): cada cena
 * ganha a ordem dos turnos, o registro com Desfazer e a cópia das regras do
 * campo. As regras puras moram em `lib/batalha/` (turnos, registro); aqui só
 * se escolhe o caminho e se escreve a linha do registro. Toda mudança disso
 * sobe `turnosRev` — e NÃO o `rev` dos caminhos, que faria snapshot inteiro do
 * mapa a cada vez (`deveAvisarJogadores`). O host lê pela `ponteDaBatalha`.
 *
 * ARENA DE TESTES, fase 0 (docs/planos/batalha-arena-de-testes-plano.md §4.2):
 * a store nasce de uma FÁBRICA, `criarBatalhaStore(mesa)`, e as fichas vêm só
 * da mesa recebida (`lib/batalha/mesa.ts`). `useBatalhaStore` é a instância da
 * mesa de verdade (`mesaDaAventura`), a única que o App, o host e a ponte
 * assinam; a arena cria a dela com as cópias, isolada de tudo isso.
 *
 * LOBBY v2, fatia T1 (docs/planos/lobby-jogadores-2026-11-05.md §8.2): a
 * fábrica mora sozinha AQUI, sem Tauri, sem a mesa de verdade e sem a store
 * DBT, para o treino do site rodar a mesma regra no navegador. O que vinha de
 * fora entra por `DependenciasDaBatalha`: o d20 (os 6 pontos que rolam) e a
 * pergunta "a cena já está na outra batalha?". `stores/batalhaStore.ts` só
 * instancia com o d20 seguro e a store DBT, e reexporta.
 *
 * A store é a VANILLA do zustand (`zustand/vanilla`, sem React): o duelo do
 * Worker (`lobby/nuvem/src/duelo.ts`) chega aqui pela regra do treino, e o
 * `zustand` inteiro puxava o `react` para o bundle. O hook do React
 * (`useBatalhaStore(seletor)`) mora só em `stores/batalhaStore.ts`, que embrulha
 * esta store com o `useStore`. A guarda é o `lib/nuvem/pureza.test.ts`.
 */

/** O que a fábrica recebe de fora (molde de `DependenciasDaBatalhaDBT`). */
export interface DependenciasDaBatalha {
  /** Um d20 (1 a 20). Na mesa, o seguro (`secureRollDie`); no treino, o da semente. */
  rolarD20: () => number
  /** A cena já está ligada na OUTRA batalha (a DBT, na mesa)? Ligada = o `ligar` não liga por cima. */
  outraBatalhaLigada: (sceneKey: string) => boolean
}

/** A abertura escolhida ao ligar: id da animação de transição e o texto dela ("Royals"). Os dois opcionais. */
export interface AberturaDaBatalha {
  transicao?: string
  texto?: string
}

/** O que o Iniciar decide (F1): quem entra (`combatentesIniciais`), a regra do campo e o desempate. */
export interface InicioDaBatalha {
  combatentes: readonly CartaDaOrdem[]
  regras: RegrasDaBatalha | null
  desempate: Desempate
  /** F3: onde o Judge nasce (`judgeInicial`). Ausente = o App põe logo depois, por `moverJudge`. */
  judge?: JudgeNaCena
}

export interface BatalhaDaCena extends BatalhaEmTurnos {
  /** Blocos andados por ficha desde que a batalha ligou (ou desde o último "Zerar caminhos"). */
  caminhos: Readonly<Record<string, number>>
  /** B6: as casas andadas por ficha, para o desenho do caminho (teto em `CASAS_POR_TRILHA`). */
  trilhas: Readonly<Record<string, readonly Casa[]>>
  /** Quantas vezes o mestre zerou os caminhos desta batalha: o jogador avisa quando o número sobe. */
  zerados: number
  /** Sobe a cada caminho somado ou zerado: o host refaz o recorte de quem está na cena. */
  rev: number
  /** F1: sobe a cada mudança da ordem, do registro ou das regras: o host refaz só o `batalha.estado`. */
  turnosRev: number
}

/** O último "ligou a batalha": `seq` novo a cada `ligar`, para o App mandar o aviso uma vez. */
export interface AnuncioDaBatalha extends AberturaDaBatalha {
  seq: number
  sceneKey: string
}

export interface BatalhaState {
  cenas: Readonly<Record<string, BatalhaDaCena>>
  anuncio: AnuncioDaBatalha | null
  /**
   * Liga a batalha na cena (caminhos zerados) e anuncia a abertura. Já ligada:
   * só anuncia de novo. `inicio` (F1): a ordem pela Agilidade com o desempate
   * escolhido, a vez na primeira carta e as regras do campo.
   */
  ligar: (sceneKey: string, abertura?: AberturaDaBatalha, inicio?: InicioDaBatalha) => void
  /** Desliga a batalha na cena; o caminho andado, a ordem e o registro somem com ela. */
  desligar: (sceneKey: string) => void
  /** "Zerar caminhos": a batalha continua, o caminho andado de toda ficha da cena volta a 0. */
  zerarCaminhos: (sceneKey: string) => void
  /** A sessão do host aceitou `blocos` para a ficha nesta cena, andando `casas`. Cena fora de batalha: nada. */
  somarCaminho: (sceneKey: string, tokenId: string, blocos: number, casas?: readonly Casa[]) => void
  /** A cena está em batalha? */
  ligada: (sceneKey: string) => boolean
  /** Sala fechada: nenhuma cena em batalha. */
  reset: () => void
  /**
   * Conserto das fichas F1, fatia S5 (P8): a batalha salva VOLTA como estava
   * (ordem, recargas, usos, Overload, selos, golpes pendentes, registro), sem
   * a abertura e sem limpar invocados. Cena já em batalha (aqui ou na DBT):
   * nada, e `false`.
   */
  retomar: (sceneKey: string, cena: BatalhaDaCena) => boolean
  /**
   * S5: "Encerrar" a batalha salva que não voltou: o mesmo fim do `desligar`
   * (formas desligam, cansaço do Overload sai, invocados saem), sem ela passar
   * pela memória. Cena já em batalha aqui: nada.
   */
  encerrarSalva: (sceneKey: string, cena: BatalhaDaCena) => void

  // ---- F1: ordem e vez (o mestre chama direto; o jogador só `passarVez` e `desfazer`, pela ponte) ----
  /** "Passar a vez" (pula carta caída, Q3). Com `esperado`, só passa se a vez ainda é aquela: clique duplo não passa duas. */
  passarVez: (sceneKey: string, autor?: AutorDaAcao, esperado?: VezEsperada) => boolean
  /**
   * Conserto das fichas F1 (bug 1): por que o `agir` deste pedido seria
   * recusado agora (o texto curto da regra, `podeAgir`), ou `null`. Só lê.
   */
  motivoDoAgir: (sceneKey: string, autor: AutorDaAcao, vez: VezEsperada | null, pedido: PedidoDeAcao) => string | null
  /** O mestre dá a vez a uma carta (até a de quem caiu). */
  darVez: (sceneKey: string, cartaId: string) => boolean
  /** Arrastar ou Alt + seta. Movimentos seguidos da mesma carta viram uma linha só. */
  moverCarta: (sceneKey: string, cartaId: string, indice: number) => boolean
  /** "Ordenar pela Agilidade" com o desempate da cena. */
  ordenarPelaAgilidade: (sceneKey: string) => boolean
  /** "1d20" ou "Eu decido". Vale no próximo Ordenar; não entra no registro. */
  trocarDesempate: (sceneKey: string, desempate: Desempate) => boolean
  /** "Incluir combatente": a ficha entra no fim da ordem (ou em `indice`). */
  incluirCombatente: (sceneKey: string, token: { id: string; characterId: string | null; name: string }, indice?: number) => boolean
  /** "Tirar combatente": todas as cartas da ficha (a original e as extras). */
  tirarCombatente: (sceneKey: string, tokenId: string) => boolean
  /** "+ Carta extra" da ficha em `indice`, só nesta rodada ou em todas. Devolve o id da carta nova. */
  adicionarCartaExtra: (sceneKey: string, tokenId: string, indice: number, duracao: DuracaoDaExtra) => string | null
  /** Tira uma carta só (a extra, normalmente). */
  removerCarta: (sceneKey: string, cartaId: string) => boolean
  /** A cópia das regras do campo desta batalha; `null` = nenhuma. */
  definirRegras: (sceneKey: string, regras: RegrasDaBatalha | null) => boolean
  /** Fichas que sumiram da cena saem da ordem (sem linha: não foi uma decisão do mestre). */
  normalizarCena: (sceneKey: string, tokenIdsDaCena: ReadonlySet<string>) => void
  /**
   * Põe o personagem em outra equipe (ou em nenhuma) pela aventura (ou pasta)
   * e, com a batalha ligada, escreve a linha nas cenas em que ele está na ordem.
   */
  trocarEquipe: (personagemId: string, equipeId: string | null) => boolean
  /** Um ajuste rápido aceito vira linha "ficha" em toda cena em batalha com o personagem na ordem. */
  registrarAjuste: (personagemId: string, antes: Personagem, depois: Personagem, autor: AutorDaAcao) => void
  /**
   * O ÚNICO caminho que reverte uma linha (também a pedido do jogador, pelo
   * host). O jogador só a dele, de tipo permitido — a conferência de "é a vez
   * dele" é do host, que sabe de quem é cada ficha. A linha fica riscada.
   */
  desfazer: (sceneKey: string, linhaId: string, autor: AutorDaAcao) => boolean

  // ---- F2: ações e golpe (o mestre chama direto; o jogador pela ponte). Fase 0: só o contrato, tudo devolve `false`. ----
  /**
   * Atacar, Habilidade, Concentrar ou o contra-ataque gasto em Mover: confere
   * a regra (`podeAgir`), cobra o custo pela aventura, gasta a ação, marca
   * recarga, usos e Overload, cria o golpe (alvo sem reação resolve na hora),
   * escreve UMA linha e os efeitos. `vez` null só com `contraDe` (Q6).
   */
  agir: (sceneKey: string, autor: AutorDaAcao, vez: VezEsperada | null, pedido: PedidoDeAcao) => boolean
  /** Rola (d20 do host) ou resolve a reação; o dano final cai na ficha e a linha do golpe é atualizada. Contra-atacar (Q6) zera o dano e dá a ação extra. */
  reagir: (sceneKey: string, autor: AutorDaAcao, pedido: PedidoDeReacao) => boolean
  /** Dano livre numa ficha: linha "dano" e efeito "dano" (a animação toca sempre). */
  darDano: (sceneKey: string, autor: AutorDaAcao, tokenId: string, valor: number) => boolean
  /** Ações extras do mestre para a carta (`null` tira): linha "acoesExtras". */
  darAcoesExtras: (sceneKey: string, cartaId: string, extras: AcoesExtras | null) => boolean
  /** As armas levadas, dentro do limite; troca quando quiser (Q8): linha "acao". */
  escolherArmas: (sceneKey: string, autor: AutorDaAcao, personagemId: string, armas: readonly string[]) => boolean
  /**
   * "Zerar" a concentração do personagem (carga → 0), a qualquer hora: linha
   * "acao" com Desfazer, que volta só a carga. C2 (lote de 01/11): na MESMA
   * vez do Concentrar, devolve a ação que ele gastou e libera concentrar de
   * novo ("é como se não tivesse feito nada"). Sem carga, ou personagem fora
   * da ordem: `false`.
   */
  zerarCarga: (sceneKey: string, autor: AutorDaAcao, personagemId: string) => boolean
  /**
   * Q4: o mestre liga ou desliga o Perfurante de um golpe que ainda tem alvo
   * esperando (o mestre decide no fim). `perfuracao` (1 a 100) troca também a
   * porcentagem; ausente = fica a do golpe. Porcentagem torta: `false`.
   */
  trocarPerfurante: (sceneKey: string, golpeId: string, perfurante: boolean, perfuracao?: number) => boolean

  // ---- F3 (fatia J): o Judge ----
  /**
   * Põe o Judge em `(x, y)` (px do mundo, o centro da casa: quem chama já
   * encaixou). Só o mestre (chamada direta). Não escreve linha nem se desfaz;
   * sobe `turnosRev` para os jogadores o verem lá. Cena fora de batalha,
   * número torto ou a mesma posição: `false`. A lembrança no aparelho
   * (`gravarJudgeLembrado`) é de quem chama.
   */
  moverJudge: (sceneKey: string, x: number, y: number) => boolean

  // ---- F3 (fatia T): selos à mão. Só o mestre (chamada direta). Ativar e Desfazer a forma vão pelo `agir`. ----
  /**
   * "Pôr selo..." na ficha (com carta na ordem): linha "selo" com reversão `selo` (antes `null`). Teto `SELOS_POR_TOKEN_MAX` por ficha e `SELOS_MAX` na cena.
   * Tipos de habilidade F2: com `mods` (filtrados pelo sistema); a cor vem do sinal deles (`naturezaDosMods`).
   */
  porSelo: (sceneKey: string, tokenId: string, selo: SeloPedido) => boolean
  /** Troca nome, turnos e mods de um selo (o `total` passa a ser os turnos novos): linha "selo" com o de antes (`seloEditado`). */
  editarSelo: (sceneKey: string, seloId: string, selo: SeloPedido) => boolean
  /** Tira o selo: linha "selo" com o de antes. */
  tirarSelo: (sceneKey: string, seloId: string) => boolean

  // ---- Tipos de habilidade F3: passivas (o mestre chama direto, por qualquer ficha; o jogador pela ponte, só as dele) ----
  /**
   * Ativar/Desligar a passiva da ficha `pedido.tokenId`, Aplicar o efeito "a
   * cada turno" ou "Agora não" no lembrete (`PedidoDePassiva`). Fora da vez,
   * sem gastar ação; regra em `motivoDaPassiva` (o jogador só aplica com o
   * lembrete esperando; o mestre, quando quiser). Ativar: custo pela
   * aventura, usos e recarga do Tempo, selo dourado com mods no dono ou no
   * alvo, linha "habilidade" com Desfazer que volta tudo (o lembrete volta
   * junto). Selo que não cabe no teto: `false`, nada muda.
   */
  passiva: (sceneKey: string, autor: AutorDaAcao, pedido: PedidoDePassiva) => boolean

  // ---- Tipos de habilidade F4: evolução (o mestre chama direto, por qualquer ficha, a qualquer hora; o jogador pela ponte, na vez dele) ----
  /**
   * Evoluir a técnica da ficha `pedido.tokenId` NESTA batalha (ação livre).
   * Regra em `motivoDoEvoluir`. Cobra o custo digitado (SP) pela aventura,
   * grava em `evoluidas` e escreve a linha "habilidade" ("Siegfried evoluiu
   * CAÇA AS BRUXAS! → SUPER CAÇA AS BRUXAS!") com Desfazer que tira a
   * evolução e devolve o SP.
   */
  evoluir: (sceneKey: string, autor: AutorDaAcao, pedido: PedidoDeEvolucao) => boolean
  /** F2 (revisão da fatia F): por que o `evoluir` deste pedido seria recusado agora (`motivoDoEvoluir`, com a Melodia da CAÇA), ou `null`. Só lê. */
  motivoDoEvoluir: (sceneKey: string, autor: AutorDaAcao, pedido: PedidoDeEvolucao) => string | null

  // ---- Invocação (docs/planos/batalha-invocacao-plano.md). O jogador só `invocar`, pela ponte; o resto é do mestre. ----
  /**
   * Pedir a técnica de Tipo Invocação da ficha `pedido.tokenId` (o dono), na
   * vez de uma carta do mesmo personagem. Regra em `motivoDaInvocacao`
   * (máximo = colocados + pendentes, carga do Ultra, recarga, SP, ação).
   * Gasta a ação, cobra o custo pela aventura, marca recarga e usos, gasta a
   * carga (Ultra) e cria a PENDÊNCIA em `turnos.invocacoes` (sem token
   * ainda). Linha "habilidade" ("Ryoko invocou 1 Lobo com Chamado do Lobo")
   * com Desfazer que tira a pendência (ou o invocado, se já posto) e devolve
   * SP, recarga, carga e a ação. Mesa sem mapa (a arena): `false`.
   */
  invocar: (sceneKey: string, autor: AutorDaAcao, pedido: PedidoDeInvocacao) => boolean
  /**
   * O MESTRE põe a pendência no mapa em `onde` (px do mundo; quem chama já
   * encaixou na casa): cria o personagem temporário (`fichaDoInvocado`) e o
   * token (imagem do cartão se ela for embutida, ou `ajuste.imageData`; sem
   * nenhuma = disco de iniciais) e o põe no bando do dono (a carta do bando
   * nasce logo depois da do dono, se ainda não há). Ultra: os comuns do mesmo
   * dono saem. `ajuste` = os números e o nome editados (sem eles, os da
   * pendência; pendência sem números exige `ajuste.numeros`). Linha
   * "invocacao" com Desfazer (o invocado sai, a pendência volta, os comuns
   * voltam). Devolve o tokenId novo, ou `null` (nada mudou).
   */
  colocarInvocado: (sceneKey: string, invocacaoId: string, onde: OndeNasceOInvocado, ajuste?: AjusteDaColocacao) => string | null
  /** O mestre cancela a pendência: é o Desfazer da linha do pedido (o SP, a recarga e a carga voltam). */
  cancelarInvocacao: (sceneKey: string, invocacaoId: string) => boolean
  /**
   * Na vez da carta do BANDO, o mestre age com o invocado `tokenId` (Atacar
   * ou Habilidade, com a ficha temporária dele; o dano vem no pedido, como
   * sempre). Cada invocado tem a Simples e o movimento dele
   * (`acoesDoInvocado`). Mesmo caminho do `agir`: linha, efeitos, alvo
   * invocado sem reação, HP 0 tira o invocado do mapa.
   */
  agirComInvocado: (sceneKey: string, vez: VezEsperada, tokenId: string, pedido: PedidoDeAcao) => boolean

  // ---- Lote de 01/11 (docs/planos/batalha-lote-01-11-plano.md). O mestre chama direto; o jogador pela ponte, só na ficha dele. ----
  /**
   * R1: a resposta ao lembrete "Marcar o alvo?" (`turnos.lembretesDaMarca`).
   * "sp" cobra o SP da passiva; "teste" rola d20 + modificador (o rank do
   * atributo) contra a CD, com o d20 para todos; "passou"/"falhou" = rolou
   * fora; "agoraNao" tira o lembrete sem linha. Passou: selo "Marcado" (sem
   * turnos) no alvo. Linha "habilidade" com Desfazer (o SP, a marca e o
   * lembrete voltam). Alvo já marcado ou fora da ordem: `false`.
   */
  marcar: (sceneKey: string, autor: AutorDaAcao, pedido: PedidoDeMarca) => boolean
  /**
   * R4 (lote de 01/11): o "Ajustar..." da carta: atual e máximo de HP, SP e
   * Escudo na ficha, e um modificador de atributo (selo sem turnos) até a
   * batalha acabar. Linha "ficha" com Desfazer por diff. Quem pode qual ficha
   * é do host (o jogador, só a dele de verdade).
   */
  ajustar: (sceneKey: string, autor: AutorDaAcao, pedido: PedidoDeAjusteNaBatalha) => boolean
  /**
   * R5 (lote de 01/11): "ganhar" sobe 1 nível do contador (a polaridade do
   * Vagn) gastando a reação até a vez dele; "zerar" é só do mestre. Linha
   * "habilidade" com Desfazer por diff do nível.
   */
  contador: (sceneKey: string, autor: AutorDaAcao, pedido: PedidoDoContador) => boolean
}

/** Invocação: onde o invocado nasce (px do mundo, o centro da casa) e em que piso; `piso` ausente = o térreo. */
export interface OndeNasceOInvocado {
  x: number
  y: number
  piso?: number
}

/** Invocação: o que o mestre ajusta ao colocar (decisão 10: os números do Ultra são sugestão). Tudo opcional. */
export interface AjusteDaColocacao {
  nome?: string
  numeros?: NumerosDoInvocado
  /** A foto pronta do token (`data:image/...`), quando a do cartão é `midia:` (quem chama resolve). `null` = disco de iniciais. */
  imageData?: string | null
}

const SEM_CAMINHOS: Readonly<Record<string, number>> = {}
const SEM_TRILHAS: Readonly<Record<string, readonly Casa[]>> = {}
const SEM_LINHAS: readonly LinhaDoRegistro[] = []
const CENA_NOVA: BatalhaDaCena = {
  caminhos: SEM_CAMINHOS,
  trilhas: SEM_TRILHAS,
  zerados: 0,
  rev: 0,
  turnos: turnosVazios(),
  registro: SEM_LINHAS,
  regras: null,
  turnosRev: 0,
}
const MESTRE: AutorDaAcao = { tipo: 'mestre' }
/** Janela em que movimentos seguidos da mesma carta pelo mestre viram uma linha (Alt + seta repetido). */
const JANELA_DO_MOVIMENTO_MS = 5_000
/** A vez que ainda não gastou nada. */
const GASTO_ZERO: GastoDaVez = { simples: 0, movimento: 0, bonus: 0, blocos: 0 }

function semACena(cenas: Readonly<Record<string, BatalhaDaCena>>, sceneKey: string): Record<string, BatalhaDaCena> {
  const resto: Record<string, BatalhaDaCena> = {}
  for (const [chave, cena] of Object.entries(cenas)) if (chave !== sceneKey) resto[chave] = cena
  return resto
}

/** O sistema e os personagens em uso na mesa (aventura ou pasta; na arena, as cópias). */
interface FichasDaMesa {
  personagens: readonly Personagem[]
  sistema: SistemaDeRpg | null
}

/** O sistema e os personagens em uso na mesa, lidos agora. */
function fichasDaMesa(mesa: MesaDaBatalha): FichasDaMesa {
  return { personagens: mesa.personagens(), sistema: mesa.sistema() }
}

/** O nome que a linha usa para a carta: o do token, o do personagem, ou "Ficha". */
function nomeDaCarta(carta: CartaDaOrdem | null | undefined, personagens: readonly Personagem[]): string {
  if (carta === null || carta === undefined) return 'ninguém'
  if (carta.nome !== undefined && carta.nome.trim().length > 0) return carta.nome.trim()
  const personagem = carta.personagemId === null ? undefined : personagens.find((candidato) => candidato.id === carta.personagemId)
  return personagem?.nome ?? 'Ficha'
}

interface LinhaNova {
  /** Ausente = id novo. O golpe já nasce apontando para a linha que o atualiza. */
  id?: string
  tipo: TipoDaLinha
  texto: string
  tokenIds?: readonly string[]
  personagemIds?: readonly string[]
  reversao: Reversao
  autor?: AutorDaAcao
}

/** A cena com a ordem nova e a linha no registro; `turnosRev` sobe. */
function comMudanca(cena: BatalhaDaCena, turnos: TurnosDaCena, linha: LinhaNova | null, regras: RegrasDaBatalha | null = cena.regras): BatalhaDaCena {
  const registro =
    linha === null
      ? cena.registro
      : comLinha(cena.registro, {
          id: linha.id ?? novoIdDeLinha(),
          seq: proximoSeq(cena.registro),
          quando: Date.now(),
          rodada: turnos.rodada,
          autor: linha.autor ?? MESTRE,
          tipo: linha.tipo,
          texto: textoDaLinha(linha.texto),
          envolve: { tokenIds: linha.tokenIds ?? [], personagemIds: linha.personagemIds ?? [] },
          reversao: linha.reversao,
        })
  return { ...cena, turnos, registro, regras, turnosRev: cena.turnosRev + 1 }
}

/** Ids das cartas na ordem: a reversão de "ordem". */
function idsDaOrdem(turnos: TurnosDaCena): string[] {
  return turnos.cartas.map((carta) => carta.id)
}

/** As cenas em batalha em que o personagem tem carta, com os tokens dele na ordem. */
function cenasComOPersonagem(cenas: Readonly<Record<string, BatalhaDaCena>>, personagemId: string): { chave: string; cena: BatalhaDaCena; tokenIds: string[] }[] {
  const achadas: { chave: string; cena: BatalhaDaCena; tokenIds: string[] }[] = []
  for (const [chave, cena] of Object.entries(cenas)) {
    const tokenIds = [...new Set(cena.turnos.cartas.filter((carta) => carta.personagemId === personagemId).map((carta) => carta.tokenId))]
    if (tokenIds.length > 0) achadas.push({ chave, cena, tokenIds })
  }
  return achadas
}

/** O nome que vai no histórico da ficha ao desfazer: diferente do autor, para o `registrar` não fundir e apagar a linha velha. */
function quemDesfezNaFicha(autor: AutorDaAcao): string {
  return `${autor.tipo === 'mestre' ? NOME_DO_MESTRE : autor.nome} (desfez)`
}

/** O que o Desfazer fez com uma reversão: a cena nova, se voltou só em parte, e se deu. */
interface Desfeito {
  cena: BatalhaDaCena
  emParte: boolean
  ok: boolean
}

/**
 * Invocação: tira o invocado do mapa (token e personagem temporário pela
 * mesa) e da lista; a parte "invocadoSaiu" guarda como estavam, para o
 * Desfazer. A carta do bando sem ninguém sai depois, por `comBandosEmDia`.
 */
function tirarDoMapa(mesa: MesaDaBatalha, sceneKey: string, turnos: TurnosDaCena, invocado: InvocadoNaBatalha): { turnos: TurnosDaCena; parte: Reversao } {
  const tirado = mesa.tirarInvocado?.(sceneKey, invocado.personagemId, invocado.tokenId) ?? { personagem: null, token: null }
  const invocados = (turnos.invocados ?? []).filter((candidato) => candidato.tokenId !== invocado.tokenId)
  return { turnos: { ...turnos, invocados }, parte: { tipo: 'invocadoSaiu', invocado, personagem: tirado.personagem, token: tirado.token } }
}

/** Desfaz a reversão: a ordem na própria cena; ficha e equipe pela mesa (a aventura); regras na cópia; o invocado pela mesa (mapa e aventura). */
function desfazerReversao(mesa: MesaDaBatalha, sceneKey: string, cena: BatalhaDaCena, reversao: Reversao, autor: AutorDaAcao): Desfeito {
  switch (reversao.tipo) {
    case 'ficha': {
      const sistema = mesa.sistema()
      if (sistema === null) return { cena, emParte: false, ok: false }
      // Invocação: o personagem temporário que já saiu do mapa não volta por aqui; o resto da linha volta ("em parte").
      if (!mesa.personagens().some((personagem) => personagem.id === reversao.personagemId) && ehPersonagemDeInvocado(cena.registro, reversao.personagemId)) {
        return { cena, emParte: true, ok: true }
      }
      let emParte = false
      const ok = mesa.ajustarPersonagem(reversao.personagemId, (atual) => {
        const feito = desfazerFicha(atual, sistema, reversao.partes, quemDesfezNaFicha(autor), Date.now())
        emParte = feito.emParte
        return feito.personagem
      })
      return { cena, emParte, ok }
    }
    case 'equipe': {
      const ok = mesa.trocarEquipe(reversao.personagemId, reversao.antes)
      return { cena, emParte: false, ok }
    }
    case 'regras':
      return { cena: { ...cena, regras: reversao.antes }, emParte: false, ok: true }
    case 'reacaoComTecnica': {
      // A linha do golpe já desfeita: o golpe não volta a esperar (o resto da reação, custo e selos, volta pelas outras partes).
      const linhaDoGolpe = cena.registro.find((linha) => linha.id === reversao.golpe.linhaId)
      if (linhaDoGolpe?.desfeita !== undefined) return { cena, emParte: false, ok: true }
      return { cena: { ...cena, turnos: reverterTurnos(cena.turnos, reversao) }, emParte: false, ok: true }
    }
    case 'composta': {
      let atual = cena
      let emParte = false
      let ok = true
      // Da última parte para a primeira, como foram feitas ao contrário.
      for (const parte of [...reversao.partes].reverse()) {
        const feito = desfazerReversao(mesa, sceneKey, atual, parte, autor)
        atual = feito.cena
        emParte = emParte || feito.emParte
        ok = ok && feito.ok
      }
      return { cena: atual, emParte, ok }
    }
    case 'invocacaoPedida': {
      // A pendência sai; se o mestre já a pôs no mapa, o invocado que veio dela também (decisão 11).
      const { pendente } = reversao
      let turnos = cena.turnos
      const invocacoes = (turnos.invocacoes ?? []).filter((candidata) => candidata.id !== pendente.id)
      if (invocacoes.length !== (turnos.invocacoes?.length ?? 0)) turnos = { ...turnos, invocacoes }
      const veio = (turnos.invocados ?? []).find((invocado) => invocado.pedidoId === pendente.id)
      if (veio !== undefined) turnos = tirarDoMapa(mesa, sceneKey, turnos, veio).turnos
      return { cena: { ...cena, turnos }, emParte: false, ok: true }
    }
    case 'invocacaoColocada': {
      // O invocado sai (se ainda está) e a pendência volta a esperar, se o pedido não foi desfeito.
      const { pendente, invocado } = reversao
      let turnos = cena.turnos
      const emCampo = invocadoDoToken(turnos, invocado.tokenId) !== null
      if (emCampo) turnos = tirarDoMapa(mesa, sceneKey, turnos, invocado).turnos
      // Já saiu por outra linha de pé (HP 0, o Ultra): a pendência não volta (passaria do máximo e "ressuscitaria" com HP cheio).
      const saiuPorOutraLinha = !emCampo && invocadoSaiuPorLinha(cena.registro, invocado.tokenId)
      if (!saiuPorOutraLinha && !linhaDesfeita(cena.registro, pendente.linhaId) && pendenciaPorId(turnos, pendente.id) === null) turnos = { ...turnos, invocacoes: [...(turnos.invocacoes ?? []), pendente] }
      return { cena: { ...cena, turnos }, emParte: false, ok: true }
    }
    case 'invocacaoCancelada': {
      // A pendência volta só se ainda cabe: no teto, no máximo da opção (um pedido novo pode ter tomado o lugar) e sem o Ultra em campo.
      const { pendente } = reversao
      const { turnos } = cena
      const dono = mesa.personagens().find((personagem) => personagem.id === pendente.donoPersonagemId)
      const sistema = mesa.sistema()
      const achada = dono === undefined || sistema === null ? null : tecnicaPorId(dono, sistema, pendente.cartaoId)
      const leitura = achada === null ? null : lerInvocacao(achada.cartao)
      const maximo = leitura === null ? null : (opcaoDaInvocacao(leitura, pendente.opcao)?.maximo ?? null)
      const cabe =
        pendenciaPorId(turnos, pendente.id) === null &&
        (turnos.invocacoes?.length ?? 0) < INVOCACOES_PENDENTES_MAX &&
        (maximo === null || quantosNoCampo(turnos, pendente.donoPersonagemId, pendente.cartaoId, pendente.opcao) < maximo) &&
        !ultraEmCampo(turnos, pendente)
      if (!cabe) return { cena, emParte: true, ok: true }
      return { cena: { ...cena, turnos: { ...turnos, invocacoes: [...(turnos.invocacoes ?? []), pendente] } }, emParte: false, ok: true }
    }
    case 'invocadoSaiu': {
      // Só volta quem foi posto por linhas ainda de pé (desfazer fora de ordem não ressuscita) e não está em campo.
      const { invocado } = reversao
      const podeVoltar = !linhaDesfeita(cena.registro, invocado.linhaId) && !linhaDesfeita(cena.registro, invocado.linhaDoPedido) && invocadoDoToken(cena.turnos, invocado.tokenId) === null
      if (!podeVoltar) return { cena, emParte: false, ok: true }
      if (mesa.criarInvocado === undefined || !mesa.criarInvocado(sceneKey, reversao.personagem, reversao.token)) return { cena, emParte: true, ok: true }
      return { cena: { ...cena, turnos: { ...cena.turnos, invocados: [...(cena.turnos.invocados ?? []), invocado] } }, emParte: false, ok: true }
    }
    case 'acaoDevolvida': {
      // C2: a linha do Concentrar já desfeita devolveu a ação por ela; gastar de novo tiraria uma ação que nada gastou.
      if (linhaDesfeita(cena.registro, reversao.linhaDoConcentrar)) return { cena, emParte: false, ok: true }
      return { cena: { ...cena, turnos: reverterTurnos(cena.turnos, reversao) }, emParte: false, ok: true }
    }
    case 'marcaUsada': {
      // R1: a marca só volta com a linha que a pôs de pé (desfazer fora de ordem não ressuscita) e o alvo ainda na ordem.
      const { selo } = reversao
      const posta = selo.linhaDaMarca === undefined || !linhaDesfeita(cena.registro, selo.linhaDaMarca)
      if (!posta || !cena.turnos.cartas.some((carta) => carta.tokenId === selo.tokenId)) return { cena, emParte: false, ok: true }
      return { cena: { ...cena, turnos: reverterTurnos(cena.turnos, reversao) }, emParte: false, ok: true }
    }
    case 'lembreteDaMarcaRespondido': {
      // R1: o lembrete só volta a esperar se o golpe que o deixou segue de pé e o alvo não ganhou marca.
      const { lembrete } = reversao
      if (linhaDesfeita(cena.registro, lembrete.linhaId) || marcaDoToken(cena.turnos.selos, lembrete.alvoTokenId) !== undefined) return { cena, emParte: false, ok: true }
      return { cena: { ...cena, turnos: reverterTurnos(cena.turnos, reversao) }, emParte: false, ok: true }
    }
    case 'lembreteDaMarca':
    case 'contador':
      return { cena: { ...cena, turnos: reverterTurnos(cena.turnos, reversao) }, emParte: false, ok: true }
    case 'vez': {
      // Bug 3: o selo que acabou na vez e cuja linha foi desfeita depois não volta com ela.
      const volta = { ...cena, turnos: reverterTurnos(cena.turnos, vezSemOsSelosDesfeitos(cena.registro, reversao)) }
      // Conserto das fichas F1: os +10 SP do começo da vez saem junto.
      return reversao.ficha === undefined ? { cena: volta, emParte: false, ok: true } : desfazerReversao(mesa, sceneKey, volta, { tipo: 'ficha', ...reversao.ficha }, autor)
    }
    case 'ordem':
    case 'cartaNova':
    case 'cartaRemovida':
    case 'gasto':
    case 'acoesExtras':
    case 'combate':
    case 'carga':
    case 'golpe':
    case 'contra':
    case 'forma':
    case 'selo':
    case 'evolucao':
    case 'linhaJunto':
      return { cena: { ...cena, turnos: reverterTurnos(cena.turnos, reversao) }, emParte: false, ok: true }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// F2: golpe, reação, dano — o lado que mexe na ficha e solta os efeitos
// ───────────────────────────────────────────────────────────────────────────

/** Um efeito antes de ganhar o `seq`. */
type EfeitoNovo = EfeitoDaBatalha extends infer E ? (E extends EfeitoDaBatalha ? Omit<E, 'seq'> : never) : never

/**
 * O último `seq` de efeito da sessão. Um contador só para todas as cenas e
 * batalhas: sobe sempre, então a conexão que guardou o último `seq` tocado
 * nunca vê um número velho de novo (nem depois de a batalha acabar e outra
 * começar).
 */
let ultimoSeqDeEfeito = 0

function comEfeitos(efeitos: readonly EfeitoDaBatalha[] | undefined, novos: readonly EfeitoNovo[]): readonly EfeitoDaBatalha[] | undefined {
  if (novos.length === 0) return efeitos
  const lista: EfeitoDaBatalha[] = [...(efeitos ?? [])]
  for (const novo of novos) {
    ultimoSeqDeEfeito += 1
    lista.push({ ...novo, seq: ultimoSeqDeEfeito })
  }
  return lista.slice(-EFEITOS_GUARDADOS)
}

function novoIdDeGolpe(): string {
  return `golpe_${crypto.randomUUID()}`
}

/**
 * Mexe na ficha pela mesa (na aventura, o histórico dela cresce em nome de
 * `quem` e a mudança chega ao jogador pelo `syncPersonagens` de sempre).
 * `ajustes` recebe o personagem de AGORA (o Escudo de agora, o SP de agora).
 * Devolve as partes que mudaram (vazio = nada), `null` (personagem ou
 * sistema não existe) ou `'recusada'` (ver `Recusada`).
 */
function mexerNaFicha(mesa: MesaDaBatalha, personagemId: string, ajustes: (atual: Personagem, sistema: SistemaDeRpg) => readonly Ajuste[], quem: string): ParteDaFicha[] | null | Recusada {
  const sistema = mesa.sistema()
  if (sistema === null) return null
  return gravarNaFicha(mesa, personagemId, sistema, (atual) => {
    const lista = ajustes(atual, sistema)
    return lista.length === 0 ? atual : aplicarAjustes(atual, sistema, lista, quem, Date.now())
  })
}

/**
 * Conserto das fichas F1 (bug 11): a mesa calculou a ficha nova e RECUSOU
 * gravá-la (a pasta publicada que o Lobby não aceitaria; o aviso já saiu). Não
 * é o `null` de "nada mudou": a ação que cobra custo ou dá dano para ali, sem
 * linha, e devolve `false` (o jogador vê a recusa). O que ela já tinha gravado
 * em outra ficha volta (`devolverFichasDaAcao`).
 */
type Recusada = 'recusada'

/** O miolo de `mexerNaFicha` e `trocarFicha`: `mudar` devolve `null` = não deu (a ficha fica). */
function gravarNaFicha(mesa: MesaDaBatalha, personagemId: string, sistema: SistemaDeRpg, mudar: (atual: Personagem) => Personagem | null): ParteDaFicha[] | null | Recusada {
  // Num objeto: a atribuição dentro do callback não estreita a variável de fora (o TS a daria como sempre `null`).
  const feito: { partes: ParteDaFicha[] | null } = { partes: null }
  const gravou = mesa.ajustarPersonagem(personagemId, (atual) => {
    const depois = mudar(atual)
    if (depois === null) return atual
    feito.partes = partesDoAjuste(atual, depois, sistema)
    return depois
  })
  if (gravou) return feito.partes
  // Ficha que não existe (o callback nem rodou) ou sem nada a mudar: `null`, como antes.
  return feito.partes === null || feito.partes.length === 0 ? null : 'recusada'
}

/**
 * Bug 11: a ação parou no meio porque a mesa recusou gravar uma ficha. O que
 * ela já gravou em outras fichas (as partes "ficha" juntadas até ali: o custo
 * de quem atacou, o dano do alvo anterior) volta, e nada dela fica.
 */
function devolverFichasDaAcao(mesa: MesaDaBatalha, sceneKey: string, cena: BatalhaDaCena, partes: readonly Reversao[], autor: AutorDaAcao): void {
  const daFicha = partes.filter((parte) => parte.tipo === 'ficha')
  if (daFicha.length > 0) desfazerReversao(mesa, sceneKey, cena, { tipo: 'composta', partes: daFicha }, autor)
}

/** O nome que vai no histórico da ficha quando a batalha mexe nela. */
function quemNaFicha(autor: AutorDaAcao): string {
  return nomeDoAutor(autor)
}

/** O personagem de cada ficha na ordem (alvo possível) e de cada invocado em campo; `undefined` = fora da ordem. */
function personagemDoTokenNa(turnos: TurnosDaCena): (tokenId: string) => string | null | undefined {
  return (tokenId) => turnos.cartas.find((carta) => carta.tokenId === tokenId)?.personagemId ?? invocadoDoToken(turnos, tokenId)?.personagemId
}

/** O nome da ficha para o texto, pela carta dela na ordem (o invocado, pelo nome dele). */
function nomeDoTokenNa(turnos: TurnosDaCena, personagens: readonly Personagem[]): (tokenId: string) => string {
  return (tokenId) => {
    const carta = turnos.cartas.find((candidata) => candidata.tokenId === tokenId)
    return carta === undefined ? (invocadoDoToken(turnos, tokenId)?.nome ?? nomeDaCarta(carta, personagens)) : nomeDaCarta(carta, personagens)
  }
}

/** Invocação: o texto da carta do bando ("Bando de Ryoko"), pelo nome do dono na ordem. */
function nomeDoBandoNa(turnos: TurnosDaCena, personagens: readonly Personagem[]): (donoTokenId: string) => string {
  const nomeDoToken = nomeDoTokenNa(turnos, personagens)
  return (donoTokenId) => `Bando de ${nomeDoToken(donoTokenId)}`
}

/**
 * Invocação (decisão 9): os invocados com a vida em 0 saem do mapa e do
 * bando. Lê a ficha de AGORA (depois do dano pela mesa). As partes
 * "invocadoSaiu" vão na linha do dano; os nomes, no texto dela.
 */
function semOsCaidos(mesa: MesaDaBatalha, sceneKey: string, turnos: TurnosDaCena): { turnos: TurnosDaCena; partes: Reversao[]; nomes: string[] } {
  const recurso = recursoDeVida(mesa.sistema())
  if (recurso === null || (turnos.invocados ?? []).length === 0) return { turnos, partes: [], nomes: [] }
  const personagens = mesa.personagens()
  let novos = turnos
  const partes: Reversao[] = []
  const nomes: string[] = []
  for (const invocado of turnos.invocados ?? []) {
    const personagem = personagens.find((candidato) => candidato.id === invocado.personagemId)
    const vida = personagem === undefined ? null : vidaDoPersonagem(personagem, recurso)
    if (vida === null || vida.atual > 0) continue
    const tirado = tirarDoMapa(mesa, sceneKey, novos, invocado)
    novos = tirado.turnos
    partes.push(tirado.parte)
    nomes.push(invocado.nome)
  }
  return { turnos: novos, partes, nomes }
}

/** " · Lobo saiu do mapa" para o texto da linha; ninguém saiu = vazio. */
function textoDosQueSairam(nomes: readonly string[]): string {
  return nomes.length === 0 ? '' : ` · ${nomes.join(', ')} ${nomes.length === 1 ? 'saiu' : 'saíram'} do mapa`
}

/** A reversão de uma ficha mexida; nada mudou = nenhuma. */
/** Conserto das fichas F1 (+10 SP por vez): as partes gravadas tiraram SP (o recurso de custo "sp" do sistema). */
function tirouSp(partes: readonly ParteDaFicha[] | null, sistema: SistemaDeRpg): boolean {
  const sp = recursoDoCusto(sistema, 'sp')
  return sp !== null && (partes ?? []).some((parte) => parte.parte === 'recurso' && parte.chave === sp.id && parte.para < parte.de)
}

function reversaoDaFicha(personagemId: string, partes: readonly ParteDaFicha[] | null): Reversao[] {
  return partes === null || partes.length === 0 ? [] : [{ tipo: 'ficha', personagemId, partes }]
}

/** R5: a ficha do token gastou a reação no contador (fica sem reagir até a vez dela). */
function gastouAReacao(turnos: TurnosDaCena, tokenId: string): boolean {
  const personagemId = personagemDoTokenNa(turnos)(tokenId)
  return personagemId !== undefined && personagemId !== null && turnos.combate?.[personagemId]?.semReacao === true
}

/** R4: a mudança do "Ajustar..." dentro do sistema e dos tetos (o fio já cortou o tamanho). */
function mudancaValida(sistema: SistemaDeRpg, mudanca: MudancaDoAjuste): boolean {
  if (mudanca.tipo === 'atributo') {
    return sistema.atributos.some((atributo) => atributo.id === mudanca.atributoId) && Number.isInteger(mudanca.delta) && mudanca.delta !== 0 && Math.abs(mudanca.delta) <= DELTA_DO_AJUSTE_MAX
  }
  return sistema.recursos.some((recurso) => recurso.id === mudanca.recursoId) && Number.isInteger(mudanca.valor) && mudanca.valor >= 0 && mudanca.valor <= NUMERO_DA_FICHA_MAX
}

/** A lista com o golpe trocado (ou tirado, se não espera mais ninguém). */
function comGolpe(golpes: readonly GolpeDaBatalha[] | undefined, golpe: GolpeDaBatalha): GolpeDaBatalha[] {
  const outros = (golpes ?? []).filter((candidato) => candidato.id !== golpe.id)
  return golpePendente(golpe) ? [...outros, golpe] : outros
}

/** As partes "reacaoComTecnica" de uma reversão (a linha da reação com técnica). */
function reacoesComTecnicaDe(reversao: Reversao): Extract<Reversao, { tipo: 'reacaoComTecnica' }>[] {
  if (reversao.tipo === 'reacaoComTecnica') return [reversao]
  return reversao.tipo === 'composta' ? reversao.partes.flatMap(reacoesComTecnicaDe) : []
}

/** Os golpes que nasceram na linha (partes "golpe"). */
function golpesDaReversao(reversao: Reversao): string[] {
  if (reversao.tipo === 'golpe') return [reversao.golpeId]
  return reversao.tipo === 'composta' ? reversao.partes.flatMap(golpesDaReversao) : []
}

/** F2 (fatia B): as linhas que nasceram junto desta (o 2º golpe do Rapid Dash), na ordem em que foram escritas. */
function linhasJuntoDe(reversao: Reversao): string[] {
  if (reversao.tipo === 'linhaJunto') return [reversao.linhaId]
  return reversao.tipo === 'composta' ? reversao.partes.flatMap(linhasJuntoDe) : []
}

/** Os contra-ataques que a linha deu: todo contra do golpe que nasceu nela (`tokenId` null) e o da reação com técnica que saiu "contra". */
function contrasDaReversao(reversao: Reversao): { golpeId: string; tokenId: string | null }[] {
  const doGolpe = golpesDaReversao(reversao).map((golpeId) => ({ golpeId, tokenId: null }))
  const daReacao = reacoesComTecnicaDe(reversao)
    .filter((parte) => parte.golpe.alvos.some((alvo) => alvo.tokenId === parte.tokenId && alvo.saida === 'contra'))
    .map((parte) => ({ golpeId: parte.golpe.id, tokenId: parte.tokenId }))
  return [...doGolpe, ...daReacao]
}

/**
 * O dano final do alvo na ficha dele, com o efeito "dano". Golpe perfurante (Q4) não gasta o Escudo; com `perfuracao`, só
 * aquela porcentagem pula o Escudo. `'recusada'` (bug 11): a mesa não gravou o dano; quem chama para sem linha e sem animação.
 */
function danoNoAlvo(mesa: MesaDaBatalha, alvo: AlvoDoGolpe, golpe: Pick<GolpeDaBatalha, 'perfurante' | 'perfuracao'> & Partial<Pick<GolpeDaBatalha, 'curaDoDano' | 'atacantePersonagemId'>>, autor: AutorDaAcao): { partes: Reversao[]; efeito: EfeitoNovo | null } | Recusada {
  if (alvo.danoFinal === undefined || alvo.saida === undefined) return { partes: [], efeito: null }
  const valor = alvo.danoFinal
  const partes = alvo.personagemId === null || valor <= 0 ? null : mexerNaFicha(mesa, alvo.personagemId, (atual, sistema) => ajustesDoDano(atual, sistema, valor, golpe.perfurante, golpe.perfuracao), quemNaFicha(autor))
  if (partes === 'recusada') return partes
  const reversao: Reversao[] = alvo.personagemId === null ? [] : [...reversaoDaFicha(alvo.personagemId, partes)]
  // F2 (fatia C, Bênção de uma Raposa): quem bateu recupera a porcentagem do dano que causou, na mesma linha (o Desfazer tira junto).
  // A cura recusada (a ficha de quem bateu não grava) não derruba o golpe: o dano já valeu.
  const quemBateu = golpe.atacantePersonagemId ?? null
  const cura = partes === null || quemBateu === null ? 0 : curaDoDano(valor, golpe.curaDoDano ?? 0)
  const curou = cura === 0 || quemBateu === null ? null : mexerNaFicha(mesa, quemBateu, (atual, sistema) => ajustesDaCura(atual, sistema, cura), quemNaFicha(autor))
  if (curou !== null && curou !== 'recusada' && quemBateu !== null) reversao.push(...reversaoDaFicha(quemBateu, curou))
  // A animação toca sempre (esquiva também: "ESQUIVOU" sobre a ficha).
  return { partes: reversao, efeito: { tipo: 'dano', tokenId: alvo.tokenId, valor, saida: alvo.saida } }
}

function novoIdDaMarca(): string {
  return `marca_${crypto.randomUUID()}`
}

/**
 * R1 (lote de 01/11): o alvo resolvido passa pela marca ANTES do dano na
 * ficha (o dobro sai no número do dano e no texto). A passiva de marca é a do
 * personagem de quem atacou; a técnica que marca é a do golpe (`golpe.marca`).
 */
function acertoComMarca(mesa: MesaDaBatalha, turnos: TurnosDaCena, golpe: GolpeDaBatalha, alvo: AlvoDoGolpe): AcertoNaMarca {
  const sistema = mesa.sistema()
  const atacante = golpe.atacantePersonagemId === null ? undefined : mesa.personagens().find((personagem) => personagem.id === golpe.atacantePersonagemId)
  const passiva = sistema === null || atacante === undefined ? null : (passivaDaMarca(atacante, sistema)?.cartao ?? null)
  const tecnicaQueMarca = golpe.marca === undefined ? null : { id: golpe.marca, nome: golpe.nome }
  const acerto = acertoNaMarca(turnos, golpe, alvo, { linhaId: golpe.linhaId, novoId: novoIdDaMarca, passiva, tecnicaQueMarca })
  // R6: a forma ligada do alvo que reduz o dano recebido (Resiliente: -20%), depois do dobro da marca.
  // S4: e a Determinação (rank 4+, HP abaixo da metade), uma depois da outra.
  const dele = alvo.personagemId === null || sistema === null ? undefined : mesa.personagens().find((personagem) => personagem.id === alvo.personagemId)
  const { danoFinal } = acerto.alvo
  if (dele === undefined || sistema === null || danoFinal === undefined || danoFinal <= 0) return acerto
  const reducoes = reducoesDoDano(dele, sistema)
  if (reducoes.length === 0) return acerto
  const reduzido: AlvoDoGolpe = { ...acerto.alvo, danoFinal: danoComAsReducoes(danoFinal, reducoes), reducao: porcentoDasReducoes(reducoes) }
  // Só a forma: o registro segue "(forma −20%)", como antes.
  if (reducoes.some((reducao) => reducao.nome === 'Determinação')) reduzido.reducaoDe = nomesDasReducoes(reducoes)
  return { ...acerto, alvo: reduzido }
}

/** A linha do registro com outro texto e mais partes na reversão (o golpe que se resolve alvo a alvo). */
function linhaAtualizada(registro: readonly LinhaDoRegistro[], linhaId: string, texto: string, maisPartes: readonly Reversao[]): readonly LinhaDoRegistro[] {
  const indice = registro.findIndex((linha) => linha.id === linhaId)
  const linha = registro[indice]
  if (linha === undefined) return registro
  const reversao: Reversao = maisPartes.length === 0 ? linha.reversao : { tipo: 'composta', partes: [...(linha.reversao.tipo === 'composta' ? linha.reversao.partes : [linha.reversao]), ...maisPartes] }
  const lista = [...registro]
  lista[indice] = { ...linha, texto: textoDaLinha(texto), reversao }
  return lista
}

// ───────────────────────────────────────────────────────────────────────────
// F3 (fatia T): forma e selos
// ───────────────────────────────────────────────────────────────────────────

/**
 * Como `mexerNaFicha`, mas com o personagem novo pronto (a forma passa pelo
 * `aplicarAjustes` em `transformacao.ts`). `mudar` devolve `null` = não deu:
 * a ficha fica e volta `null`. Gravação recusada = `'recusada'` (bug 11).
 */
function trocarFicha(mesa: MesaDaBatalha, personagemId: string, mudar: (atual: Personagem, sistema: SistemaDeRpg) => Personagem | null): ParteDaFicha[] | null | Recusada {
  const sistema = mesa.sistema()
  if (sistema === null) return null
  return gravarNaFicha(mesa, personagemId, sistema, (atual) => mudar(atual, sistema))
}

/**
 * Conserto das fichas F1 (bug 2): os golpes lançados na vez que está
 * acabando, o contra-ataque fora da vez incluído: a linha deles veio depois
 * da linha "vez" de pé mais nova. O alvo deles ainda não teve tempo de
 * responder, então esperam a virada seguinte. Sem linha "vez" (a primeira vez
 * da batalha): todos são da vez de agora.
 */
function golpesDaVezQueAcaba(cena: BatalhaDaCena): ReadonlySet<string> {
  let comeco = Number.NEGATIVE_INFINITY
  for (let i = cena.registro.length - 1; i >= 0; i -= 1) {
    const linha = cena.registro[i]
    if (linha !== undefined && linha.tipo === 'vez' && linha.desfeita === undefined) {
      comeco = linha.seq
      break
    }
  }
  const depois = new Set(cena.registro.filter((linha) => linha.seq > comeco).map((linha) => linha.id))
  return new Set((cena.turnos.golpes ?? []).filter((golpe) => depois.has(golpe.linhaId)).map((golpe) => golpe.id))
}

/** Um efeito "selo" por selo que acabou ("ATORDOADO ACABOU"). */
function efeitosDosSelos(acabaram: readonly SeloDaBatalha[]): EfeitoNovo[] {
  return acabaram.map((selo): EfeitoNovo => ({ tipo: 'selo', tokenId: selo.tokenId, nome: selo.nome, acabou: true }))
}

/** Q6: o selo do golpe no alvo que ele ACERTOU (resolvido com saída que pega). Sem selo, sem acerto ou no teto: `null`. */
function seloDoGolpe(turnos: TurnosDaCena, golpe: GolpeDaBatalha, alvo: AlvoDoGolpe): { selos: SeloDaBatalha[]; parte: Reversao } | null {
  if (golpe.selo === undefined || alvo.saida === undefined || !pegaOSelo(alvo.saida)) return null
  const pedido = golpe.selo
  // F2 (fatia A): o selo que renova (Queimando) volta aos turnos cheios em vez de pôr outro.
  const renovado = seloRenovado(turnos, alvo.tokenId, pedido)
  if (renovado !== null) return renovado
  const selo = criarSelo(alvo.tokenId, pedido, { id: novoIdDeSelo(), rodada: turnos.rodada, ...ondeNaVez(turnos), origem: golpe.nome })
  const selos = comSeloNovo(turnos.selos, selo)
  return selos === null ? null : { selos, parte: { tipo: 'selo', seloId: selo.id, antes: null } }
}

/** F2 (fatia A): o selo igual que já está no alvo e renova; `null` = não renova (põe um novo). */
function seloRenovado(turnos: TurnosDaCena, tokenId: string, pedido: SeloDoGolpe): { selos: SeloDaBatalha[]; parte: Reversao } | null {
  const comportamento = comportamentoDoSelo(pedido.nome)
  if (comportamento?.renova !== true) return null
  const antes = (turnos.selos ?? []).find((selo) => selo.tokenId === tokenId && comportamentoDoSelo(selo.nome) === comportamento)
  if (antes === undefined) return null
  const depois: SeloDaBatalha = { ...antes, turnos: pedido.turnos, total: pedido.turnos }
  if (pedido.porVez !== undefined) depois.porVez = pedido.porVez
  return { selos: (turnos.selos ?? []).map((selo) => (selo.id === antes.id ? depois : selo)), parte: { tipo: 'selo', seloId: antes.id, antes, editado: true } }
}

/**
 * Tipos de habilidade F3: as partes "combate" dos lembretes que um gancho
 * pôs (Iniciar, virada da rodada, dano), para o Desfazer da linha tirar SÓ
 * eles e a chave deles em `lembradas`.
 */
function partesDosLembretes(feito: TurnosComLembretes): Reversao[] {
  return feito.mudaram.flatMap(({ personagemId, antes }): Reversao[] => {
    const depois = feito.turnos.combate?.[personagemId]
    return depois === undefined ? [] : [{ tipo: 'combate', personagemId, antes, depois }]
  })
}

const ROTULO_DA_ACAO_DA_FORMA: Readonly<Record<AcaoDaForma, string>> = { simples: 'Simples', completa: 'Completa', bonus: 'Bônus', livre: 'Livre' }

/** "+1 Simples, +1 Bônus". */
function textoDasExtras(extras: AcoesExtras): string {
  const partes = [extras.simples > 0 ? `+${extras.simples} Simples` : null, extras.bonus > 0 ? `+${extras.bonus} Bônus` : null, extras.mov > 0 ? `+${extras.mov} Movimento` : null]
  return partes.filter((parte): parte is string => parte !== null).join(', ')
}

const EXTRAS_MAX = 20

function contadorDeExtra(valor: number): number {
  return Number.isFinite(valor) ? Math.min(EXTRAS_MAX, Math.max(0, Math.trunc(valor))) : 0
}

/**
 * O corpo da store (o que era o inicializador do `create`), preso à `mesa`:
 * toda leitura e gravação de ficha das ações passa por ela. Todo d20 sai de
 * `deps.rolarD20`.
 */
function estadoDaBatalha(mesa: MesaDaBatalha, deps: DependenciasDaBatalha, set: StoreApi<BatalhaState>['setState'], get: StoreApi<BatalhaState>['getState']): BatalhaState {
  /** O sistema e os personagens da mesa desta store, lidos agora. */
  const mesaDoRpg = (): FichasDaMesa => fichasDaMesa(mesa)

  /** A cena ligada, ou `undefined`. */
  const cenaDe = (sceneKey: string): BatalhaDaCena | undefined => get().cenas[sceneKey]

  /** Troca a cena (que tem de estar ligada). */
  const gravarCena = (sceneKey: string, cena: BatalhaDaCena): void => {
    set({ cenas: { ...get().cenas, [sceneKey]: cena } })
  }

  /** Aplica `mudar` aos turnos da cena; mudou = grava com a linha que `linha` monta. */
  const mudarTurnos = (sceneKey: string, mudar: (turnos: TurnosDaCena) => TurnosDaCena, linha: (antes: TurnosDaCena, depois: TurnosDaCena) => LinhaNova | null): boolean => {
    const cena = cenaDe(sceneKey)
    if (cena === undefined) return false
    const turnos = mudar(cena.turnos)
    if (turnos === cena.turnos) return false
    gravarCena(sceneKey, comMudanca(cena, turnos, linha(cena.turnos, turnos)))
    return true
  }

  /**
   * Conserto das fichas F1 (resposta do Vincent, "o Escudo volta cheio a cada
   * batalha"): no Iniciar, o Escudo de cada personagem da ordem volta ao cheio
   * gravado em `maximos` (`escudoNoComeco`; sem cheio, o de agora vira o
   * cheio). Gravação recusada pela pasta publicada: fica como está.
   */
  const encherOsEscudos = (cartas: readonly CartaDaOrdem[]): void => {
    const sistema = mesa.sistema()
    if (sistema === null) return
    const ids = new Set(cartas.flatMap((carta) => (carta.personagemId === null ? [] : [carta.personagemId])))
    for (const personagemId of ids) {
      mesa.ajustarPersonagem(personagemId, (atual) => {
        const escudo = escudoNoComeco(atual, sistema)
        if (escudo === null) return atual
        const gravado: Personagem = { ...atual, maximos: { ...atual.maximos, [escudo.escudoId]: escudo.cheio } }
        return escudo.ajuste === null ? gravado : aplicarAjustes(gravado, sistema, [escudo.ajuste], NOME_DO_MESTRE, Date.now())
      })
    }
  }

  /**
   * Conserto das fichas F1 (resposta do Vagn): no fim da batalha, cada
   * personagem dela (na ordem ou com combate) desliga TODAS as formas (o atual
   * perde o que elas deram, bug 9). O cansaço do Overload mora nos selos da
   * batalha e some com ela. Gravação recusada pela pasta publicada: fica como está.
   */
  const fimDaBatalhaNasFichas = (turnos: TurnosDaCena): void => {
    const sistema = mesa.sistema()
    if (sistema === null) return
    const ids = new Set([...turnos.cartas.flatMap((carta) => (carta.personagemId === null ? [] : [carta.personagemId])), ...Object.keys(turnos.combate ?? {})])
    for (const personagemId of ids) mesa.ajustarPersonagem(personagemId, (atual) => desfazerFormasNoFim(atual, sistema, NOME_DO_MESTRE, Date.now()) ?? atual)
  }

  /**
   * Conserto das fichas F1 (resposta do Vincent): +10 SP no começo da vez de
   * quem não gastou SP desde a vez anterior (`ganhaSpNaVez` no combate de
   * `antes`; a primeira vez da batalha não ganha). Grava pela mesa e devolve a
   * parte para a linha da vez e o pedaço do texto (só do jogador: o SP do NPC
   * não aparece). Nada a ganhar, SP cheio ou gravação recusada = `null`.
   */
  const spDoComecoDaVez = (antes: TurnosDaCena, depois: TurnosDaCena, autor: AutorDaAcao): { ficha: { personagemId: string; partes: ParteDaFicha[] }; texto: string } | null => {
    const para = cartaDaVez(depois)
    if (para === null || para.personagemId === null || para.id === antes.vez || !ganhaSpNaVez(antes.combate?.[para.personagemId])) return null
    const personagemId = para.personagemId
    const feito = mexerNaFicha(
      mesa,
      personagemId,
      (atual, sistemaDaMesa) => {
        const ajuste = ajusteDoSpDaVez(atual, sistemaDaMesa)
        return ajuste === null ? [] : [ajuste]
      },
      quemNaFicha(autor),
    )
    if (feito === null || feito === 'recusada' || feito.length === 0) return null
    const ganho = feito.reduce((soma, parte) => (parte.parte === 'recurso' ? soma + parte.para - parte.de : soma), 0)
    const personagem = mesa.personagens().find((candidato) => candidato.id === personagemId)
    const nome = personagem?.nome.trim() || 'a ficha'
    return { ficha: { personagemId, partes: feito }, texto: personagem?.tipo === 'jogador' ? ` · ${nome} recupera ${ganho} SP` : '' }
  }

  /**
   * F2 (fatia F, Siegfried): o que o fim da vez de `saindo` tira e dá sozinho,
   * numa linha própria com Desfazer, gravada depois da linha da vez:
   *  - Doença das Trevas: o dono perde 3% do HP máximo (27) se andou ou agiu
   *    nesta vez (`gasto`);
   *  - Chamas Celestes: em quem tem o selo, −15 SP; no dono da técnica, +10 SP
   *    e −3% do HP máximo dele.
   * Nada a fazer: a cena fica como está.
   */
  const fimDaVezDasMecanicas = (sceneKey: string, saindo: CartaDaOrdem | null, gasto: GastoDaVez | undefined, autor: AutorDaAcao): void => {
    const cena = cenaDe(sceneKey)
    if (cena === undefined || saindo === null || saindo.personagemId === null) return
    const { personagens, sistema } = mesaDoRpg()
    if (sistema === null) return
    const quem = quemNaFicha(autor)
    const partes: Reversao[] = []
    const textos: string[] = []
    const tokenIds = new Set<string>([saindo.tokenId])
    const fichaDe = (personagemId: string): Personagem | undefined => mesa.personagens().find((candidato) => candidato.id === personagemId)
    const nomeDe = (personagemId: string): string => fichaDe(personagemId)?.nome.trim() || 'a ficha'
    /** Soma `delta` no recurso; devolve quanto mudou de verdade (0 = nada, ou recusado). */
    const mexer = (personagemId: string, qual: 'sp' | 'hp', delta: number): number => {
      const antes = fichaDe(personagemId)
      const feito = mexerNaFicha(mesa, personagemId, (atual, sistemaDaMesa) => {
        const ajuste = ajusteDoRecurso(atual, sistemaDaMesa, qual, delta)
        return ajuste === null ? [] : [ajuste]
      }, quem)
      if (feito === null || feito === 'recusada' || feito.length === 0 || antes === undefined) return 0
      partes.push(...reversaoDaFicha(personagemId, feito))
      return feito.reduce((soma, parte) => (parte.parte === 'recurso' ? soma + parte.para - parte.de : soma), 0)
    }
    const perdaDoMaximo = (personagemId: string, porcento: number): number => {
      const ficha = fichaDe(personagemId)
      const maximo = ficha === undefined ? null : maximoDoRecurso(ficha, sistema, 'hp')
      return maximo === null ? 0 : porcentoDoMaximo(maximo, porcento)
    }
    // Doença das Trevas: só na vez em que andou ou agiu (Mover, Atacar, técnica, Concentrar). `golpeou`: a técnica livre (Florescer) não soma nos contadores.
    const agiu = gasto !== undefined && (gasto.movimento > 0 || gasto.blocos > 0 || gasto.simples > 0 || gasto.bonus > 0 || gasto.atacou === true || gasto.golpeou === true)
    const dona = fichaDe(saindo.personagemId)
    const doenca = dona === undefined ? null : perdaNoFimDaVez(chavesDoDono(dona))
    if (agiu && doenca !== null) {
      const perdeu = mexer(saindo.personagemId, 'hp', -perdaDoMaximo(saindo.personagemId, doenca.hpPorcento))
      if (perdeu !== 0) textos.push(`${nomeDe(saindo.personagemId)} perde ${-perdeu} HP (Doença das Trevas)`)
    }
    // Chamas Celestes: cada selo dela em quem sai.
    for (const selo of cena.turnos.selos ?? []) {
      const dreno = selo.tokenId === saindo.tokenId && selo.cartaoId !== undefined ? mecanicaDoCartao(selo.cartaoId)?.drenoNoFimDaVez : undefined
      const cartaoDoSelo = selo.cartaoId
      if (dreno === undefined || cartaoDoSelo === undefined) continue
      const dono = personagens.find((candidato) => chavesDoDono(candidato).includes(cartaoDoSelo))
      const tirou = mexer(saindo.personagemId, 'sp', -dreno.alvoSp)
      const partesDoDono: string[] = []
      if (dono !== undefined) {
        const ganhou = mexer(dono.id, 'sp', dreno.donoSp)
        const perdeu = mexer(dono.id, 'hp', -perdaDoMaximo(dono.id, dreno.donoHpPorcento))
        if (ganhou !== 0) partesDoDono.push(`+${ganhou} SP`)
        if (perdeu !== 0) partesDoDono.push(`${perdeu} HP`)
        const doDono = cena.turnos.cartas.find((carta) => carta.personagemId === dono.id && carta.extra === undefined)
        if (doDono !== undefined) tokenIds.add(doDono.tokenId)
      }
      const noAlvo = tirou === 0 ? 'sem SP para tirar' : `${tirou} SP`
      textos.push(`${selo.nome} em ${nomeDe(saindo.personagemId)}: ${noAlvo}${dono === undefined || partesDoDono.length === 0 ? '' : `; ${dono.nome.trim() || 'o dono'} ${partesDoDono.join(', ')}`}`)
    }
    if (partes.length === 0) return
    let novos = cena.turnos
    const lembrados = lembrarDepoisDoDano(novos)
    partes.push(...partesDosLembretes(lembrados))
    novos = lembrados.turnos
    const atual = cenaDe(sceneKey) ?? cena
    gravarCena(sceneKey, comMudanca(atual, novos, { tipo: 'acao', texto: `Fim da vez: ${textos.join(' · ')}`, autor, tokenIds: [...tokenIds], reversao: { tipo: 'composta', partes } }))
    avisarQuemCaiu(sceneKey, autor)
  }

  /**
   * Conserto das fichas F1 (Overload): depois dele, os atributos base do
   * personagem da ficha `tokenId` ficam pela metade até o fim da batalha. Mora
   * nos selos "Cansaço do Overload" da batalha (`comOCansaco`), NUNCA na ficha:
   * o app fechado no meio não deixa a ficha pela metade. Já cansado = `null`
   * (a metade não divide de novo). As partes "selo" vão na linha do Overload:
   * o Desfazer dela tira o cansaço; o mestre também tira pelo selo.
   */
  const cansarNoOverload = (personagemId: string, tokenId: string, turnos: TurnosDaCena): { turnos: TurnosDaCena; partes: Reversao[] } | null => {
    const { personagens, sistema } = mesaDoRpg()
    const personagem = personagens.find((candidato) => candidato.id === personagemId)
    if (personagem === undefined || sistema === null) return null
    const cansado = comOCansaco(turnos, tokenId, modsDoCansaco(personagem, sistema), novoIdDeSelo)
    return cansado === null ? null : { turnos: cansado.turnos, partes: cansado.selos.map((selo): Reversao => ({ tipo: 'selo', seloId: selo.id, antes: null })) }
  }

  /**
   * F2 (fatia B): o selo do golpe no alvo acertado, com a disputa da mecânica
   * à mão (Corta Cenoura: d20 + FOR com vantagem contra d20 + RES do alvo): o
   * app rola e o selo só pega se quem usou vencer. O resultado vai no alvo
   * (`disputa`) para a linha do golpe. Sem disputa: o selo de sempre.
   */
  const seloNoAcerto = (turnos: TurnosDaCena, golpe: GolpeDaBatalha, alvo: AlvoDoGolpe): { selado: ReturnType<typeof seloDoGolpe>; alvo: AlvoDoGolpe } => {
    const feito = seloDoGolpeNoAcerto(turnos, golpe, alvo)
    // F2 (revisão da fatia E, Bala de Prata): o selo da bala pega junto, por cima do da mira, do da técnica e da marca.
    if (golpe.seloDaBala === undefined) return feito
    const daBala = seloDoGolpe(feito.selado === null ? turnos : { ...turnos, selos: feito.selado.selos }, { ...golpe, selo: golpe.seloDaBala }, feito.alvo)
    if (daBala === null) return feito
    return { alvo: feito.alvo, selado: feito.selado === null ? daBala : { selos: daBala.selos, parte: { tipo: 'composta', partes: [feito.selado.parte, daBala.parte] } } }
  }

  /** O selo do golpe (o da mira ou o da técnica) no alvo que ele acertou, com a disputa da mecânica à mão quando há. */
  const seloDoGolpeNoAcerto = (turnos: TurnosDaCena, golpe: GolpeDaBatalha, alvo: AlvoDoGolpe): { selado: ReturnType<typeof seloDoGolpe>; alvo: AlvoDoGolpe } => {
    const cartaoId = golpe.selo?.cartaoId
    const { personagens, sistema } = mesaDoRpg()
    // F2 (fatia C, A Luz do Sol): o selo só nos aliados de quem usou (no inimigo vai só o dano).
    if (cartaoId !== undefined && golpe.atacantePersonagemId !== null && !seloPegaNoAlvo(cartaoId, alvo.personagemId, aliadosDe(new Set([golpe.atacantePersonagemId]), mesa.equipes(), personagens))) return { selado: null, alvo }
    const disputa = cartaoId === undefined || alvo.saida === undefined || !pegaOSelo(alvo.saida) ? null : disputaNoAcerto(cartaoId)
    const usa = personagens.find((candidato) => candidato.id === golpe.atacantePersonagemId)
    const resiste = personagens.find((candidato) => candidato.id === alvo.personagemId)
    if (disputa === null || usa === undefined || resiste === undefined || sistema === null) return { selado: seloDoGolpe(turnos, golpe, alvo), alvo }
    const deQuemUsa = { personagem: usa, bonus: bonusDaBatalha(turnos.selos, golpe.atacanteTokenId) }
    const doAlvo = { personagem: resiste, bonus: bonusDaBatalha(turnos.selos, alvo.tokenId) }
    const quemUsaTesta = disputa.testa === 'quemUsa'
    // F2 (fatia C): a carga gasta no golpe entra na CD (a dança da Aira).
    const resultado = rolarDisputa(disputa, { testa: quemUsaTesta ? deQuemUsa : doAlvo, usa: deQuemUsa, resiste: quemUsaTesta ? doAlvo : deQuemUsa }, sistema, golpe.carga ?? 0, deps.rolarD20)
    // Quando o alvo testa, quem usa vence se o alvo NÃO passou; sem teste (concentração), quem usa vence.
    const venceu = quemUsaVence(resultado, disputa.testa)
    const comTexto: AlvoDoGolpe = { ...alvo, disputa: `${textoDaDisputa(resultado)}, ${venceu ? 'o selo pegou' : 'o selo não pegou'}` }
    return { selado: venceu ? seloDoGolpe(turnos, golpe, alvo) : null, alvo: comTexto }
  }

  /**
   * F2 (fatia B): o aviso ao mestre de quem caiu a 0 com cartão que avisa
   * (Recuperação Espantosa: o mestre decide quando e com quanto HP volta), uma
   * vez por batalha (chave em `lembradas`). Linha própria "acao", cujo
   * Desfazer tira a chave. Nada a avisar: a cena fica como está.
   */
  const avisarQuemCaiu = (sceneKey: string, autor: AutorDaAcao): void => {
    const cena = cenaDe(sceneKey)
    const { personagens, sistema } = mesaDoRpg()
    const recurso = sistema === null ? null : recursoDeVida(sistema)
    if (cena === undefined || recurso === null) return
    let novos = cena.turnos
    const partes: Reversao[] = []
    const textos: string[] = []
    const ids = new Set(cena.turnos.cartas.flatMap((carta) => (carta.personagemId === null ? [] : [carta.personagemId])))
    for (const personagemId of ids) {
      const personagem = personagens.find((candidato) => candidato.id === personagemId)
      const vida = personagem === undefined ? null : vidaDoPersonagem(personagem, recurso)
      if (personagem === undefined || vida === null || vida.atual > 0) continue
      const aviso = avisoAoCairDe(Object.values(personagem.abas).flatMap((cartoes) => cartoes.map((cartao) => cartao.id)))
      const chave = aviso === null ? null : `${aviso.cartaoId}:caiu`
      const antes = novos.combate?.[personagemId]
      if (aviso === null || chave === null || (antes?.lembradas ?? []).includes(chave)) continue
      const depois: CombateDoPersonagem = { ...(antes ?? combateVazio()), lembradas: [...(antes?.lembradas ?? []), chave] }
      partes.push({ tipo: 'combate', personagemId, antes: antes ?? null, depois })
      novos = { ...novos, combate: { ...(novos.combate ?? {}), [personagemId]: depois } }
      textos.push(`${personagem.nome.trim() || 'A ficha'}: ${aviso.texto}`)
    }
    if (textos.length === 0) return
    gravarCena(sceneKey, comMudanca(cena, novos, { tipo: 'acao', texto: textos.join(' · '), autor, reversao: { tipo: 'composta', partes } }))
  }

  /** F2 (fatia B): o pedido que saiu e pode ter tirado HP (o Aplicar do Sangramento ou do Queimando, o "a cada turno", o Ajustar) passa pelo aviso de quem caiu. */
  const comAvisoDeQuemCaiu = (sceneKey: string, autor: AutorDaAcao, feito: boolean): boolean => {
    if (feito) avisarQuemCaiu(sceneKey, autor)
    return feito
  }

  /**
   * F3 (fatia T): Ativar a forma (gasta a ação escolhida, liga o cartão, o
   * atual ganha a diferença do máximo, Q1) ou Desfazer a forma (ação livre).
   * Só na vez da carta. A ficha muda pela aventura; a linha "transformacao"
   * leva a reversão composta [gasto, ficha, forma] e o texto sem números.
   */
  /**
   * F2 (fatia E, Fúria do Dragão): o pedido da técnica que sobe de Parte, na
   * vez da carta, vira o Ativar da Parte seguinte (a ação é a do campo Ação da
   * técnica). `null` = não é essa técnica, ou não há Parte acima (aí o pedido
   * segue e o `podeAgir` recusa com o motivo).
   */
  const subidaDoPedido = (sceneKey: string, pedido: PedidoDeAcao): Extract<PedidoDeAcao, { tipo: 'transformar' }> | null => {
    if (pedido.tipo !== 'habilidade' || pedido.contraDe !== undefined || !sobeDeParte(pedido.cartaoId)) return null
    const cena = cenaDe(sceneKey)
    const carta = cena === undefined ? null : cartaDaVez(cena.turnos)
    const { personagens, sistema } = mesaDoRpg()
    const personagem = carta === null || carta.personagemId === null ? undefined : personagens.find((candidato) => candidato.id === carta.personagemId)
    if (personagem === undefined || sistema === null) return null
    const subida = subidaDeParte(personagem, sistema, pedido.cartaoId)
    const tecnica = tecnicaPorId(personagem, sistema, pedido.cartaoId)
    if (subida === null || !('para' in subida) || tecnica === null) return null
    return { tipo: 'transformar', cartaoId: subida.para.id, acao: acaoDaForma(tecnica.cartao), trocarImagem: true }
  }

  const mudarForma = (sceneKey: string, autor: AutorDaAcao, vez: VezEsperada | null, pedido: Extract<PedidoDeAcao, { tipo: 'transformar' | 'destransformar' }>): boolean => {
    const cena = cenaDe(sceneKey)
    if (cena === undefined || vez === null) return false
    const { turnos } = cena
    if (turnos.vez !== vez.cartaId || turnos.rodada !== vez.rodada) return false
    const carta = cartaDaVez(turnos)
    if (carta === null || carta.personagemId === null) return false
    const personagemId = carta.personagemId
    const { personagens, sistema } = mesaDoRpg()
    const personagem = personagens.find((candidato) => candidato.id === personagemId) ?? null
    if (personagem === null || sistema === null) return false
    const ctx: ContextoDoGolpe = { turnos, carta, personagem, sistema, regras: cena.regras, autor, personagens, personagemDoToken: personagemDoTokenNa(turnos) }
    if (podeAgir(ctx, pedido) !== null) return false
    const cartao = formaDaFicha(personagem, sistema, pedido.cartaoId)
    const nomeDaForma = cartao?.nome.trim() || 'a forma'
    const quem = quemNaFicha(autor)
    const quemAge = nomeDoTokenNa(turnos, personagens)(carta.tokenId)
    const formaAntes = turnos.formas?.[personagemId] ?? null
    const partes: Reversao[] = []
    const efeitos: EfeitoNovo[] = []
    let novos: TurnosDaCena = turnos
    let texto: string
    if (pedido.tipo === 'transformar') {
      let numeros: NumeroDaForma[] = []
      // R2: as formas do mesmo grupo que a troca desligou (os cartões voltam pela parte "ficha" no Desfazer).
      let desligadas: string[] = []
      const fichaMudou = trocarFicha(mesa, personagemId, (atual, sistemaDaMesa) => {
        const feito = ativarForma(atual, sistemaDaMesa, pedido.cartaoId, quem, Date.now())
        if (feito !== null) {
          numeros = feito.numeros
          desligadas = feito.desligadas.map((cartaoDesligado) => cartaoDesligado.nome.trim() || 'a forma')
        }
        return feito?.personagem ?? null
      })
      if (fichaMudou === null || fichaMudou === 'recusada') return false
      // S4: a ação é a que quem se transforma escolheu na hora ("livre" não gasta); a de "Usos por batalha" conta o uso (o Desfazer o devolve pela parte "combate").
      if (pedido.acao !== 'livre') {
        partes.push({ tipo: 'gasto', cartaId: carta.id, antes: turnos.gastos[carta.id] ?? null })
        novos = { ...novos, gastos: { ...novos.gastos, [carta.id]: gastarAcao(turnos.gastos[carta.id] ?? GASTO_ZERO, pedido.acao) } }
      }
      if (cartao !== null && usosDaForma(cartao) !== null) {
        const combateAntes = turnos.combate?.[personagemId]
        const base = combateAntes ?? combateVazio()
        const depois: CombateDoPersonagem = { ...base, usos: { ...base.usos, [cartao.id]: (base.usos[cartao.id] ?? 0) + 1 } }
        partes.push({ tipo: 'combate', personagemId, antes: combateAntes ?? null, depois })
        novos = { ...novos, combate: { ...(novos.combate ?? {}), [personagemId]: depois } }
      }
      // Conserto das fichas F1: a forma Overload (A Caçada Começa) gasta o Overload da batalha (1 por batalha).
      if (cartao !== null && ehOverload(cartao)) {
        const combateAntes = novos.combate?.[personagemId]
        const depois: CombateDoPersonagem = { ...(combateAntes ?? combateVazio()), overload: true }
        partes.push({ tipo: 'combate', personagemId, antes: combateAntes ?? null, depois })
        novos = { ...novos, combate: { ...(novos.combate ?? {}), [personagemId]: depois } }
      }
      // O Desfazer volta as partes de trás para a frente: o cartão vem PRIMEIRO aqui para o ganho voltar antes de
      // desligar (1.500/1.800 → 900/1.800 → 900/1.200). Na ordem de `partesDoAjuste`, o corte do desligar viria antes
      // e o delta tiraria o ganho de novo (1.200 − 600 = 600).
      const cartaoPrimeiro = [...fichaMudou.filter((parte) => parte.parte === 'cartao'), ...fichaMudou.filter((parte) => parte.parte !== 'cartao')]
      partes.push(...reversaoDaFicha(personagemId, cartaoPrimeiro))
      const imagem = pedido.trocarImagem ? (cartao?.imagem ?? null) : null
      const forma: FormaNaBatalha = { cartaoId: pedido.cartaoId, imagem }
      partes.push({ tipo: 'forma', personagemId, antes: formaAntes })
      novos = { ...novos, formas: { ...(novos.formas ?? {}), [personagemId]: forma } }
      const efeito: EfeitoNovo = { tipo: 'transformacao', tokenId: carta.tokenId, forma: nomeDaForma, imagem }
      if (numeros.length > 0) efeito.numeros = numeros
      efeitos.push(efeito)
      const comoAtiva = pedido.acao === 'livre' ? 'sem gastar ação' : ROTULO_DA_ACAO_DA_FORMA[pedido.acao]
      texto = `${quemAge} ativa ${nomeDaForma} (${comoAtiva})${desligadas.length === 0 ? '' : ` · desliga ${desligadas.join(', ')}`}`
    } else {
      const fichaMudou = trocarFicha(mesa, personagemId, (atual, sistemaDaMesa) => desfazerForma(atual, sistemaDaMesa, pedido.cartaoId, quem, Date.now()))
      if (fichaMudou === null || fichaMudou === 'recusada') return false
      partes.push(...reversaoDaFicha(personagemId, fichaMudou))
      // Conserto das fichas F1 (resposta do Alexei): o fim da forma Overload deixa os atributos base pela metade.
      if (cartao !== null && ehOverload(cartao)) {
        const cansado = cansarNoOverload(personagemId, carta.tokenId, novos)
        if (cansado !== null) {
          partes.push(...cansado.partes)
          novos = cansado.turnos
        }
      }
      // A imagem e o nome na carta saem junto (só se eram desta forma).
      if (formaAntes !== null && formaAntes.cartaoId === pedido.cartaoId) {
        partes.push({ tipo: 'forma', personagemId, antes: formaAntes })
        const formas = { ...(novos.formas ?? {}) }
        delete formas[personagemId]
        novos = { ...novos, formas }
      }
      efeitos.push({ tipo: 'forma', tokenId: carta.tokenId, forma: nomeDaForma, ligou: false })
      texto = `${quemAge} desfaz ${nomeDaForma} (ação livre)`
    }
    // A ficha passou pela aventura no meio: grava sobre a cena de agora, com a ordem calculada daqui.
    const atual = cenaDe(sceneKey) ?? cena
    gravarCena(sceneKey, {
      ...comMudanca(atual, novos, { tipo: 'transformacao', texto, autor, tokenIds: [carta.tokenId], reversao: { tipo: 'composta', partes } }),
      efeitos: comEfeitos(atual.efeitos, efeitos),
    })
    return true
  }

  /**
   * Tipos de habilidade F3: depois de dano ou custo de vida (golpe, reação,
   * Dar dano), os lembretes das passivas de vida baixa. Um ponto só, chamado
   * depois de `danoNoAlvo` e de `darDano`: a ficha já mudou pela mesa, e o
   * gatilho lê a vida de AGORA.
   */
  const lembrarDepoisDoDano = (turnos: TurnosDaCena): TurnosComLembretes => comLembretesDoMomento('dano', turnos, mesaDoRpg())

  /**
   * Conserto das fichas F1 (bug 10, P6): o lembrete "Aplicar / pular" do
   * custo por turno de uma FORMA ligada. Pular: só tira o lembrete. Aplicar
   * com recurso: cobra (`ajustesDoCusto`) e marca `gastouSp`. Sem recurso: a
   * forma desce uma Parte (`descerUmaParte`: da Parte 1, volta para a base).
   * A reversão é [combate, ficha, forma]; o Desfazer devolve o lembrete.
   */
  const custoDaFormaNaVez = (
    sceneKey: string,
    cena: BatalhaDaCena,
    autor: AutorDaAcao,
    carta: CartaDaOrdem,
    personagem: Personagem,
    sistema: SistemaDeRpg,
    pedido: Extract<PedidoDePassiva, { tipo: 'lembrete' }>,
  ): boolean => {
    const { turnos } = cena
    if (motivoDoPedidoDoCusto({ personagem, sistema, turnos, aplicarSoComLembrete: autor.tipo === 'jogador' }, pedido) !== null) return false
    const personagemId = personagem.id
    const combateAntes = turnos.combate?.[personagemId] ?? null
    const combateBase = combateAntes ?? combateVazio()
    const semOLembrete = semLembretes(combateBase, pedido.cartaoId)
    if (!pedido.aplicar) {
      gravarCena(sceneKey, comMudanca(cena, { ...turnos, combate: { ...(turnos.combate ?? {}), [personagemId]: semOLembrete } }, null))
      return true
    }
    const cartao = formaDaFicha(personagem, sistema, pedido.cartaoId)
    const custo = cartao === null ? null : custoPorTurno(cartao, personagem)
    if (cartao === null || custo === null) return false
    const quem = quemNaFicha(autor)
    const nome = cartao.nome.trim() || 'a forma'
    const dono = nomeDoTokenNa(turnos, mesaDoRpg().personagens)(carta.tokenId)
    const partes: Reversao[] = []
    let novos: TurnosDaCena
    let texto: string
    const paga = motivoDoCustoPorTurno(personagem, sistema, custo) === null
    if (paga) {
      const doCusto = mexerNaFicha(mesa, personagemId, (atual, sistemaDaMesa) => ajustesDoCusto(atual, sistemaDaMesa, custo), quem)
      // Bug 11: o custo recusado não aplica (o lembrete fica esperando).
      if (doCusto === 'recusada') return false
      const combate: CombateDoPersonagem = custoEmSp(custo) && semOLembrete.gastouSp !== true ? { ...semOLembrete, gastouSp: true } : semOLembrete
      partes.push({ tipo: 'combate', personagemId, antes: combateAntes, depois: combate }, ...reversaoDaFicha(personagemId, doCusto))
      novos = { ...turnos, combate: { ...(turnos.combate ?? {}), [personagemId]: combate } }
      texto = `${dono} mantém ${nome} (paga ${textoDoCustoPorTurno(custo, sistema)})`
    } else {
      // Sem recurso (resposta da Ryoko): desce uma Parte. O cartão vem primeiro na reversão, como no Ativar da forma.
      // Num objeto: a atribuição dentro do callback não estreita a variável de fora.
      const descida: { anterior: CartaoDaFicha | null } = { anterior: null }
      const fichaMudou = trocarFicha(mesa, personagemId, (atual, sistemaDaMesa) => {
        const feita = descerUmaParte(atual, sistemaDaMesa, cartao.id, quem, Date.now())
        descida.anterior = feita?.anterior ?? null
        return feita?.personagem ?? null
      })
      if (fichaMudou === null || fichaMudou === 'recusada') return false
      partes.push({ tipo: 'combate', personagemId, antes: combateAntes, depois: semOLembrete })
      partes.push(...reversaoDaFicha(personagemId, [...fichaMudou.filter((parte) => parte.parte === 'cartao'), ...fichaMudou.filter((parte) => parte.parte !== 'cartao')]))
      novos = { ...turnos, combate: { ...(turnos.combate ?? {}), [personagemId]: semOLembrete } }
      // A imagem da forma na carta: passa para a Parte anterior (se a de agora mostrava imagem) ou sai.
      const formaAntes = turnos.formas?.[personagemId] ?? null
      if (formaAntes !== null && formaAntes.cartaoId === cartao.id) {
        partes.push({ tipo: 'forma', personagemId, antes: formaAntes })
        const formas = { ...(novos.formas ?? {}) }
        const voltou = descida.anterior
        if (voltou === null) delete formas[personagemId]
        else formas[personagemId] = { cartaoId: voltou.id, imagem: formaAntes.imagem === null ? null : voltou.imagem }
        novos = { ...novos, formas }
      }
      const destino = descida.anterior
      const recurso = recursoDoCusto(sistema, custo.recurso)?.nome ?? custo.recurso.toUpperCase()
      texto = `${dono} sem ${recurso} para manter ${nome}: ${destino === null ? 'sai da forma' : `volta para ${destino.nome.trim() || 'a Parte anterior'}`}`
    }
    const atual = cenaDe(sceneKey) ?? cena
    gravarCena(sceneKey, comMudanca(atual, novos, { tipo: 'transformacao', texto, autor, tokenIds: [carta.tokenId], personagemIds: [personagemId], reversao: { tipo: 'composta', partes } }))
    return true
  }

  /**
   * F2 (revisão da fatia D): o lembrete "Aplicar / pular" da técnica MANTIDA
   * (Giro da Lança, Campo de Contenção). Aplicar com recurso: cobra o custo da
   * vez (`custoDaMantida`), marca `gastouSp` e, no Campo, +1 de Concentração
   * (`manterNaVez`). Pular, ou Aplicar sem recurso: para (`pararAMantida`: a
   * recarga começa agora) e os selos que a técnica pôs saem (ninguém fica
   * preso no campo desligado). A reversão é [combate, ficha | selos].
   */
  const custoDaMantidaNaVez = (
    sceneKey: string,
    cena: BatalhaDaCena,
    autor: AutorDaAcao,
    carta: CartaDaOrdem,
    personagem: Personagem,
    sistema: SistemaDeRpg,
    pedido: Extract<PedidoDePassiva, { tipo: 'lembrete' }>,
  ): boolean => {
    const { turnos } = cena
    if (motivoDoPedidoDoCusto({ personagem, sistema, turnos, aplicarSoComLembrete: autor.tipo === 'jogador' }, pedido) !== null) return false
    const personagemId = personagem.id
    const combateAntes = turnos.combate?.[personagemId] ?? null
    const semOLembrete = semLembretes(combateAntes ?? combateVazio(), pedido.cartaoId)
    const mantida = mantidasComCusto(personagem, sistema, combateAntes ?? undefined).find(({ cartao }) => cartao.id === pedido.cartaoId)
    if (mantida === undefined) return false
    const { cartao, custo } = mantida
    const nome = cartao.nome.trim() || 'a técnica'
    const dono = nomeDoTokenNa(turnos, mesaDoRpg().personagens)(carta.tokenId)
    const partes: Reversao[] = []
    let novos: TurnosDaCena
    let texto: string
    if (pedido.aplicar && motivoDoCustoPorTurno(personagem, sistema, custo) === null) {
      const doCusto = mexerNaFicha(mesa, personagemId, (atual, sistemaDaMesa) => ajustesDoCusto(atual, sistemaDaMesa, custo), quemNaFicha(autor))
      // Bug 11: o custo recusado não aplica (o lembrete fica esperando).
      if (doCusto === 'recusada') return false
      const mantido = manterNaVez(semOLembrete, cartao.id)
      const combate: CombateDoPersonagem = custoEmSp(custo) && mantido.gastouSp !== true ? { ...mantido, gastouSp: true } : mantido
      partes.push({ tipo: 'combate', personagemId, antes: combateAntes, depois: combate }, ...reversaoDaFicha(personagemId, doCusto))
      novos = { ...turnos, combate: { ...(turnos.combate ?? {}), [personagemId]: combate } }
      const daCarga = combate.carga === semOLembrete.carga ? '' : `; Concentração ${combate.carga}`
      texto = `${dono} mantém ${nome} (paga ${textoDoCustoPorTurno(custo, sistema)}${daCarga})`
    } else {
      const parado = pararAMantida(semOLembrete, cartao)
      const tirados = (turnos.selos ?? []).filter((selo) => selo.cartaoId === cartao.id)
      partes.push({ tipo: 'combate', personagemId, antes: combateAntes, depois: parado }, ...tirados.map((selo): Reversao => ({ tipo: 'selo', seloId: selo.id, antes: selo })))
      novos = { ...turnos, combate: { ...(turnos.combate ?? {}), [personagemId]: parado }, selos: (turnos.selos ?? []).filter((selo) => selo.cartaoId !== cartao.id) }
      const recarga = parado.recargas[cartao.id]
      const porque = pedido.aplicar ? `sem ${recursoDoCusto(sistema, custo.recurso)?.nome ?? custo.recurso.toUpperCase()} para manter` : 'parou'
      texto = `${dono} ${porque} ${nome}${recarga === undefined ? '' : ` (recarga ${recarga})`}`
    }
    const atual = cenaDe(sceneKey) ?? cena
    gravarCena(sceneKey, comMudanca(atual, novos, { tipo: 'habilidade', texto, autor, tokenIds: [carta.tokenId], personagemIds: [personagemId], reversao: { tipo: 'composta', partes } }))
    return true
  }

  /**
   * Tipos de habilidade F3: a passiva (`PedidoDePassiva`). Ver `passiva` em
   * `BatalhaState`. A reversão de Ativar é [combate, ficha, selo]; a de
   * Desligar, [combate, selos]; a de Aplicar, [combate, selo, ficha]. O
   * "combate" volta só o que a linha mudou (o lembrete tirado, os usos), e
   * vem primeiro: no Desfazer, o selo volta antes e o lembrete "a cada turno"
   * acha a passiva ligada.
   */
  /**
   * Conserto das fichas F1 (S4): a resposta aos lembretes que a REGRA põe (não
   * uma passiva da ficha). `lembrete` = o que está esperando no combate.
   *  - Sangramento: só o mestre decide. Aplicar tira 10 direto no HP (sem
   *    Escudo), menos as reduções de quem sangra (F2, revisão da fatia E: a
   *    Ryoko tira 7), com linha "dano"; pular só tira o lembrete.
   *  - Preparação para a Batalha: Aplicar com `atributoId` põe o selo +20 nele
   *    até o fim do combate; "Agora não" só tira o lembrete.
   * A reversão é [combate, ficha | selo]: o Desfazer devolve o lembrete.
   */
  const lembreteDaRegra = (sceneKey: string, cena: BatalhaDaCena, autor: AutorDaAcao, carta: CartaDaOrdem, personagemId: string, lembrete: LembreteDaPassiva, pedido: Extract<PedidoDePassiva, { tipo: 'lembrete' }>): boolean => {
    const { turnos } = cena
    const { personagens, sistema } = mesaDoRpg()
    const sangramento = ehLembreteDoSangramento(lembrete)
    if (sistema === null || (sangramento && autor.tipo === 'jogador')) return false
    const combateAntes = turnos.combate?.[personagemId] ?? null
    const semOLembrete = semLembretes(combateAntes ?? combateVazio(), lembrete.cartaoId)
    const comCombate = (base: TurnosDaCena): TurnosDaCena => ({ ...base, combate: { ...(base.combate ?? {}), [personagemId]: semOLembrete } })
    if (!pedido.aplicar) {
      gravarCena(sceneKey, comMudanca(cena, comCombate(turnos), null))
      return true
    }
    const quem = nomeDoTokenNa(turnos, personagens)(carta.tokenId)
    const partes: Reversao[] = [{ tipo: 'combate', personagemId, antes: combateAntes, depois: semOLembrete }]
    if (sangramento) {
      // F2 (fatia A): quanto tira (Sangrando 10, Queimando N) e o verbo da linha vêm do selo, ou do lembrete se o selo já saiu no fim da vez.
      const { nome, dano: porVez } = porVezDoLembrete(lembrete, turnos.selos)
      // F2 (revisão da fatia E): o dano por vez também passa pelas reduções de quem sangra ("na Ryoko os −30% valem contra TUDO": 10 vira 7).
      let dado = porVez
      let reducao = ''
      const feito = mexerNaFicha(
        mesa,
        personagemId,
        (atual, sistemaDaMesa) => {
          const reducoes = reducoesDoDano(atual, sistemaDaMesa)
          dado = danoComAsReducoes(porVez, reducoes)
          reducao = reducoes.length === 0 ? '' : `; ${reducoes.map((parte) => `${parte.nome} -${parte.porcento}%`).join(', ')}: de ${porVez}`
          return ajustesDoDano(atual, sistemaDaMesa, dado, true)
        },
        quemNaFicha(autor),
      )
      if (feito === 'recusada') return false
      partes.push(...reversaoDaFicha(personagemId, feito))
      const atual = cenaDe(sceneKey) ?? cena
      const caidos = semOsCaidos(mesa, sceneKey, comCombate(atual.turnos))
      partes.push(...caidos.partes)
      const semCaidos = caidos.partes.length === 0 ? caidos.turnos : comBandosEmDia(caidos.turnos, nomeDoBandoNa(caidos.turnos, mesa.personagens()))
      const lembrados = lembrarDepoisDoDano(semCaidos)
      partes.push(...partesDosLembretes(lembrados))
      const texto = `${quem} ${comportamentoDoSelo(nome)?.verbo ?? 'sangra'}: -${dado} HP (direto, sem o Escudo${reducao})${textoDosQueSairam(caidos.nomes)}`
      gravarCena(sceneKey, {
        ...comMudanca(atual, lembrados.turnos, { tipo: 'dano', texto, autor, tokenIds: [carta.tokenId], personagemIds: [personagemId], reversao: { tipo: 'composta', partes } }),
        efeitos: comEfeitos(atual.efeitos, [{ tipo: 'dano', tokenId: carta.tokenId, valor: dado, saida: 'direto' }]),
      })
      return true
    }
    const pedidoDoSelo = pedido.atributoId === undefined ? null : seloDaPreparacao(sistema, pedido.atributoId)
    if (pedidoDoSelo === null) return false
    const selo = criarSelo(carta.tokenId, { ...pedidoDoSelo, natureza: 'buff' }, { id: novoIdDeSelo(), rodada: turnos.rodada, ...ondeNaVez(turnos), origem: NOME_DA_PREPARACAO })
    const selos = comSeloNovo(turnos.selos, selo)
    if (selos === null) return false
    partes.push({ tipo: 'selo', seloId: selo.id, antes: null })
    const texto = `${quem} faz a ${NOME_DA_PREPARACAO}: ${textoDosMods(selo.mods, sistema)} até o fim do combate`
    gravarCena(sceneKey, comMudanca(cena, { ...comCombate(turnos), selos }, { tipo: 'selo', texto, autor, tokenIds: [carta.tokenId], personagemIds: [personagemId], reversao: { tipo: 'composta', partes } }))
    return true
  }

  const mudarPassiva = (sceneKey: string, autor: AutorDaAcao, pedido: PedidoDePassiva): boolean => {
    const cena = cenaDe(sceneKey)
    if (cena === undefined) return false
    const { turnos } = cena
    const carta = turnos.cartas.find((candidata) => candidata.tokenId === pedido.tokenId)
    if (carta === undefined || carta.personagemId === null) return false
    const personagemId = carta.personagemId
    // S4: o lembrete do Sangramento e o da Preparação têm caminho próprio (não são passiva da ficha).
    if (pedido.tipo === 'lembrete') {
      const daRegra = (turnos.combate?.[personagemId]?.lembretes ?? []).find((lembrete) => lembrete.cartaoId === pedido.cartaoId && (ehLembreteDoSangramento(lembrete) || ehLembreteDaPreparacao(lembrete)))
      if (daRegra !== undefined) return lembreteDaRegra(sceneKey, cena, autor, carta, personagemId, daRegra, pedido)
    }
    const { personagens, sistema } = mesaDoRpg()
    const personagem = personagens.find((candidato) => candidato.id === personagemId) ?? null
    // Conserto das fichas F1 (P6): o lembrete do custo por turno de uma FORMA tem caminho próprio.
    if (pedido.tipo === 'lembrete' && personagem !== null && sistema !== null && formaDaFicha(personagem, sistema, pedido.cartaoId) !== null) {
      return custoDaFormaNaVez(sceneKey, cena, autor, carta, personagem, sistema, pedido)
    }
    // F2 (revisão da fatia D): e o da técnica MANTIDA (Giro, Campo), na mesma faixa.
    if (pedido.tipo === 'lembrete' && personagem !== null && sistema !== null && mantidaDe(pedido.cartaoId) !== null) {
      return custoDaMantidaNaVez(sceneKey, cena, autor, carta, personagem, sistema, pedido)
    }
    if (motivoDaPassiva({ personagem, sistema, turnos, aplicarSoComLembrete: autor.tipo === 'jogador' }, pedido) !== null || personagem === null || sistema === null) return false
    const achada = tecnicaPorId(personagem, sistema, pedido.cartaoId)
    if (achada === null) return false
    const { cartao } = achada
    const combateAntes = turnos.combate?.[personagemId] ?? null
    const combateBase = combateAntes ?? combateVazio()
    const semOLembrete = semLembretes(combateBase, cartao.id)
    const comCombate = (base: TurnosDaCena, combate: CombateDoPersonagem): TurnosDaCena => (combate === combateBase ? base : { ...base, combate: { ...(base.combate ?? {}), [personagemId]: combate } })
    // "Agora não" / pular: só tira o lembrete, sem linha (a tira Passivas ativa a qualquer hora).
    if (pedido.tipo === 'lembrete' && !pedido.aplicar) {
      gravarCena(sceneKey, comMudanca(cena, comCombate(turnos, semOLembrete), null))
      return true
    }
    const nomeDoToken = nomeDoTokenNa(turnos, personagens)
    const dono = nomeDoToken(carta.tokenId)
    const nome = cartao.nome.trim() || 'a passiva'
    const quem = quemNaFicha(autor)
    const partes: Reversao[] = []
    // O lembrete que Aplicar e Desligar tiram volta no Desfazer (só ele: a parte "combate" volta o que a linha mudou).
    const parteDoLembrete: Reversao[] = semOLembrete === combateBase ? [] : [{ tipo: 'combate', personagemId, antes: combateAntes, depois: semOLembrete }]
    const tokenIds = new Set([carta.tokenId])
    let novos: TurnosDaCena
    let texto: string
    if (pedido.tipo === 'lembrete') {
      // Aplicar o "a cada turno" (decisão 4): HP/SP pela aventura e os mods somados no selo dela.
      const efeito = efeitoPorTurno(cartao, sistema)
      // Conserto das fichas F1 (P6): o custo por turno da técnica mantida (a regra já conferiu que o recurso paga).
      const custoDaVez = custoPorTurno(cartao, personagem)
      const selo = selosDaPassiva(turnos.selos, personagemId, cartao.id)[0]
      if ((efeito === null && custoDaVez === null) || selo === undefined) return false
      const doCusto = custoDaVez === null ? null : mexerNaFicha(mesa, personagemId, (atual, sistemaDaMesa) => ajustesDoCusto(atual, sistemaDaMesa, custoDaVez), quem)
      // Bug 11: o custo recusado não aplica (o lembrete fica para o Aplicar de novo).
      if (doCusto === 'recusada') return false
      const fichas: Reversao[] = reversaoDaFicha(personagemId, doCusto)
      novos = turnos
      // HP e SP em quem tem o selo, como os mods: no oponente, "o alvo perde 20 de HP a cada turno" não tira do dono.
      const doSelo = turnos.cartas.find((candidata) => candidata.tokenId === selo.tokenId)?.personagemId ?? null
      let doPorTurno: ParteDaFicha[] | null = null
      if (efeito !== null && doSelo !== null) {
        const feito = mexerNaFicha(mesa, doSelo, (atual, sistemaDaMesa) => ajustesDoPorTurno(atual, sistemaDaMesa, efeito), quem)
        // Bug 11: a ficha recusada não leva o "a cada turno" (o custo já pago volta; o lembrete fica para o Aplicar de novo).
        if (feito === 'recusada') {
          devolverFichasDaAcao(mesa, sceneKey, cena, fichas, autor)
          return false
        }
        doPorTurno = feito
        fichas.push(...reversaoDaFicha(doSelo, feito))
      }
      // Conserto das fichas F1 (+10 SP por vez): o custo, ou o "a cada turno" que tira SP do próprio dono (Manter o Giro), conta como gastar SP.
      const gastou = (custoDaVez !== null && custoEmSp(custoDaVez)) || (doSelo === personagemId && tirouSp(doPorTurno, sistema))
      const combateDepois: CombateDoPersonagem = gastou && semOLembrete.gastouSp !== true ? { ...semOLembrete, gastouSp: true } : semOLembrete
      if (combateDepois !== combateBase) partes.push({ tipo: 'combate', personagemId, antes: combateAntes, depois: combateDepois })
      novos = comCombate(turnos, combateDepois)
      if (efeito !== null && efeito.mods.length > 0) {
        const mods = modsSomados(selo.mods, efeito.mods)
        const depois: SeloDaBatalha = { ...selo }
        if (mods.length > 0) depois.mods = mods
        else delete depois.mods
        partes.push({ tipo: 'selo', seloId: selo.id, antes: selo, editado: true })
        novos = { ...novos, selos: (novos.selos ?? []).map((candidato) => (candidato.id === selo.id ? depois : candidato)) }
      }
      partes.push(...fichas)
      tokenIds.add(selo.tokenId)
      const pago = custoDaVez === null ? '' : `${dono} paga ${textoDoCustoPorTurno(custoDaVez, sistema)}`
      const doEfeito = efeito === null ? '' : `em ${nomeDoToken(selo.tokenId)}: ${textoDoPorTurno(efeito, sistema)}`
      texto = `${nome} (a cada turno) ${[doEfeito, pago].filter((parte) => parte !== '').join(' · ')}`
    } else if (!pedido.ligar) {
      const tirados = selosDaPassiva(turnos.selos, personagemId, cartao.id)
      const ids = new Set(tirados.map((selo) => selo.id))
      partes.push(...parteDoLembrete)
      for (const selo of tirados) {
        partes.push({ tipo: 'selo', seloId: selo.id, antes: selo })
        tokenIds.add(selo.tokenId)
      }
      novos = { ...comCombate(turnos, semOLembrete), selos: (turnos.selos ?? []).filter((selo) => !ids.has(selo.id)) }
      const unico = tirados.length === 1 && partes.length === 1 ? tirados[0] : undefined
      const semOLigar = unico === undefined ? null : semOLigarDeGraca(cena.registro, autor, unico.id)
      if (semOLigar !== null) {
        gravarCena(sceneKey, { ...comMudanca(cena, novos, null), registro: semOLigar })
        return true
      }
      texto = `${dono} desligou ${nome}`
    } else {
      // Ativar: tudo calculado ANTES de cobrar (selo que não cabe no teto recusa sem mexer na ficha).
      const custo = custoDaPassiva(cartao, personagem, pedido.custo)
      // Tipos de habilidade F4: a opção escolhida (Melodia); sem selo editado, o selo sai do texto dela.
      const variante = pedido.variante === undefined ? null : varianteDoPedido(cartao, pedido.variante)
      const pedidoDoSelo = pedido.selo === undefined ? seloDaPassiva(variante === null ? cartao : cartaoDaVariante(cartao, variante), sistema) : seloPedidoValido(pedido.selo, sistema)
      const alvoTokenId = pedido.alvoTokenId ?? carta.tokenId
      if (pedidoDoSelo === null) return false
      const onde = { id: novoIdDeSelo(), rodada: turnos.rodada, ...ondeNaVez(turnos), origem: cartao.nome }
      // F2 (fatia F, Melodia): a opção que não é a principal fica no selo (o "+20 contra o analisado" só vale na principal).
      const selo: SeloDaBatalha = { ...criarSelo(alvoTokenId, { ...pedidoDoSelo, natureza: 'passiva', cartaoId: cartao.id }, onde), donoId: personagemId, ...(variante === null || variante.principal ? {} : { opcao: variante.chave }) }
      const selos = comSeloNovo(turnos.selos, selo)
      if (selos === null) return false
      // Usos e recarga do Tempo, o lembrete fora e a chave do gatilho em `lembradas` (ativada à mão antes do gatilho não lembra depois).
      const chave = chaveDoGatilho(cartao.id, gatilhoDaPassiva(cartao))
      const usada = semLembretes(depoisDaTecnica(combateBase, { cartao, tempo: lerTempo(cartao.campos[CAMPO_DO_TEMPO] ?? ''), overload: ehOverload(cartao), custo }), cartao.id)
      const combate = chave === null ? usada : comLembrada(usada, chave)
      if (combate !== combateBase) partes.push({ tipo: 'combate', personagemId, antes: combateAntes, depois: combate })
      const doCusto = mexerNaFicha(mesa, personagemId, (atual, sistemaDaMesa) => ajustesDoCusto(atual, sistemaDaMesa, custo), quem)
      // Bug 11: custo recusado = a passiva não liga (sem selo, recarga nem linha).
      if (doCusto === 'recusada') return false
      partes.push(...reversaoDaFicha(personagemId, doCusto))
      partes.push({ tipo: 'selo', seloId: selo.id, antes: null })
      novos = { ...comCombate(turnos, combate), selos }
      tokenIds.add(alvoTokenId)
      const pago = custo.tipo === 'valor' && custo.valor > 0 ? ` (${custo.valor} ${custo.recurso.toUpperCase()})` : ''
      const emQuem = alvoTokenId === carta.tokenId ? '' : ` em ${nomeDoToken(alvoTokenId)}`
      // O selo com o mesmo nome e sem mods nem turnos ("Fortaleza · Fortaleza") não diz nada a mais.
      const doSelo = textoDoSeloComMods(selo, sistema)
      const escolha = variante === null ? '' : ` (${variante.rotulo})`
      texto = `${dono} ativou ${nome}${escolha}${emQuem}${pago}${doSelo === nome ? '' : ` · ${doSelo}`}`
    }
    // O custo de HP do Ativar e o HP que o Aplicar tira podem levar alguém abaixo do gatilho de vida (o mesmo ponto do dano).
    if (partes.some((parte) => parte.tipo === 'ficha')) {
      const lembrados = lembrarDepoisDoDano(novos)
      partes.push(...partesDosLembretes(lembrados))
      novos = lembrados.turnos
    }
    // A ficha passa pela aventura no meio: grava sobre a cena de agora, com a ordem calculada daqui.
    // `personagemIds` = o dono: a linha da passiva de NPC (custo, HP) não sai ao jogador.
    const atual = cenaDe(sceneKey) ?? cena
    gravarCena(sceneKey, comMudanca(atual, novos, { tipo: 'habilidade', texto, autor, tokenIds: [...tokenIds], personagemIds: [personagemId], reversao: { tipo: 'composta', partes } }))
    return true
  }

  /**
   * Tipos de habilidade F4: Evoluir (`PedidoDeEvolucao`). Ver `evoluir` em
   * `BatalhaState`. A reversão é [evolucao, ficha]: o Desfazer tira só esta
   * técnica de `evoluidas` e devolve o SP. O custo e o SP saem do texto do
   * NPC: a linha pode chegar a jogador da equipe dele.
   */
  const evoluirTecnica = (sceneKey: string, autor: AutorDaAcao, pedido: PedidoDeEvolucao): boolean => {
    const cena = cenaDe(sceneKey)
    if (cena === undefined) return false
    const { turnos } = cena
    const carta = turnos.cartas.find((candidata) => candidata.tokenId === pedido.tokenId)
    if (carta === undefined || carta.personagemId === null) return false
    const personagemId = carta.personagemId
    const { personagens, sistema } = mesaDoRpg()
    const personagem = personagens.find((candidato) => candidato.id === personagemId) ?? null
    if (motivoDoEvoluir({ personagem, sistema, turnos, soNaVez: autor.tipo === 'jogador' }, pedido) !== null || personagem === null || sistema === null) return false
    const achada = tecnicaPorId(personagem, sistema, pedido.cartaoId)
    const evolucao = achada === null ? null : evolucaoDe(achada.cartao, tecnicasDe(personagem, sistema))
    if (achada === null || evolucao === null) return false
    const { cartao } = achada
    const custo = custoDaEvolucao(pedido.custo)
    const combateAntes = turnos.combate?.[personagemId]
    const evoluida = comEvoluida(combateAntes ?? combateVazio(), cartao.id)
    // Conserto das fichas F1 (+10 SP por vez): evoluir pagando SP conta como gastar SP na vez.
    const combate: CombateDoPersonagem = custoEmSp(custo) && evoluida.gastouSp !== true ? { ...evoluida, gastouSp: true } : evoluida
    const novos: TurnosDaCena = { ...turnos, combate: { ...(turnos.combate ?? {}), [personagemId]: combate } }
    const partes: Reversao[] = [{ tipo: 'evolucao', personagemId, cartaoId: cartao.id }]
    if (combate !== evoluida) partes.push({ tipo: 'combate', personagemId, antes: combateAntes ?? null, depois: combate })
    const doCusto = mexerNaFicha(mesa, personagemId, (atual, sistemaDaMesa) => ajustesDoCusto(atual, sistemaDaMesa, custo), quemNaFicha(autor))
    // Bug 11: custo recusado = a técnica não evolui.
    if (doCusto === 'recusada') return false
    partes.push(...reversaoDaFicha(personagemId, doCusto))
    const dono = nomeDoTokenNa(turnos, personagens)(carta.tokenId)
    const nome = cartao.nome.trim() || 'a técnica'
    // Com link: "→ SUPER CAÇA AS BRUXAS!"; sem link e o texto diz OVERLOAD: o uso evoluído é Overload.
    const destino = evolucao.para !== null ? ` → ${evolucao.para.nome.trim() || 'a evoluída'}` : evolucao.overload ? ' (agora Overload)' : ''
    const recurso = recursoDoCusto(sistema, 'sp')?.nome ?? 'SP'
    const pago = custo.tipo === 'valor' && personagem.tipo === 'jogador' ? ` (${custo.valor} ${recurso})` : ''
    const texto = `${dono} evoluiu ${nome}${destino}${pago}`
    // A ficha passa pela aventura no meio: grava sobre a cena de agora, com a ordem calculada daqui.
    const atual = cenaDe(sceneKey) ?? cena
    gravarCena(sceneKey, comMudanca(atual, novos, { tipo: 'habilidade', texto, autor, tokenIds: [carta.tokenId], personagemIds: [personagemId], reversao: { tipo: 'composta', partes } }))
    return true
  }

  /** R1: a resposta ao lembrete da marca. Ver `marcar` em `BatalhaState`. */
  const marcarOAlvo = (sceneKey: string, autor: AutorDaAcao, pedido: PedidoDeMarca): boolean => {
    const cena = cenaDe(sceneKey)
    if (cena === undefined) return false
    const { turnos } = cena
    const lembrete = (turnos.lembretesDaMarca ?? []).find((candidato) => candidato.id === pedido.lembreteId)
    if (lembrete === undefined) return false
    const semOLembrete: TurnosDaCena = { ...turnos, lembretesDaMarca: (turnos.lembretesDaMarca ?? []).filter((candidato) => candidato.id !== lembrete.id) }
    // "Agora não": só tira o lembrete, sem linha (como na passiva).
    if (pedido.como === 'agoraNao') {
      gravarCena(sceneKey, comMudanca(cena, semOLembrete, null))
      return true
    }
    const { personagens, sistema } = mesaDoRpg()
    const personagem = personagens.find((candidato) => candidato.id === lembrete.personagemId)
    const achada = personagem === undefined || sistema === null ? null : passivaDaMarca(personagem, sistema)
    if (personagem === undefined || sistema === null || achada === null || achada.cartao.id !== lembrete.cartaoId) return false
    // O alvo segue na ordem e sem marca (uma marca por alvo).
    if (!turnos.cartas.some((carta) => carta.tokenId === lembrete.alvoTokenId) || marcaDoToken(turnos.selos, lembrete.alvoTokenId) !== undefined) return false
    const recursoDoSp = recursoDoCusto(sistema, 'sp')
    const sp = recursoDoSp === null ? 0 : numeroDaFicha(personagem.recursos, recursoDoSp.id)
    const { leitura } = achada
    if (motivoDaMarca(leitura, pedido.como, sp) !== null) return false
    const linhaId = novoIdDeLinha()
    const efeitos: EfeitoNovo[] = []
    let passou: boolean
    let detalhe: string
    if (pedido.como === 'teste' && leitura.teste !== null && leitura.teste.cd !== null) {
      const d20 = deps.rolarD20()
      // O digitado na tela vence o do rank (o parse do fio já limitou o número).
      const modificador = pedido.modificador ?? modificadorDoTeste(personagem, sistema, leitura.teste.atributoId, bonusDaBatalha(turnos.selos, lembrete.tokenId))
      const total = d20 + modificador
      passou = total >= leitura.teste.cd
      detalhe = `${leitura.teste.nome} ${textoDaRolagem(d20, modificador, total)} contra CD ${leitura.teste.cd}`
      efeitos.push({ tipo: 'reacao', golpeId: null, tokenId: lembrete.tokenId, d20, modificador, total })
    } else if (pedido.como === 'sp') {
      passou = true
      detalhe = personagem.tipo === 'jogador' ? `${leitura.sp ?? 0} ${recursoDoSp?.nome ?? 'SP'}` : 'pagou'
    } else {
      passou = pedido.como === 'passou'
      detalhe = 'teste rolado fora'
    }
    let novos = semOLembrete
    const partes: Reversao[] = [{ tipo: 'lembreteDaMarcaRespondido', lembrete }]
    if (passou) {
      // A marca é calculada ANTES de cobrar: selo que não cabe no teto recusa sem mexer no SP.
      const marca = criarMarca(novos, lembrete.alvoTokenId, { selo: novoIdDaMarca(), linha: linhaId }, achada.cartao)
      const selos = comSeloNovo(novos.selos, marca)
      if (selos === null) return false
      if (pedido.como === 'sp' && leitura.sp !== null) {
        const custo = leitura.sp
        const doCusto = mexerNaFicha(mesa, personagem.id, (atual, sistemaDaMesa) => ajustesDoCusto(atual, sistemaDaMesa, { tipo: 'valor', recurso: 'sp', valor: custo, porTurno: false }), quemNaFicha(autor))
        // Bug 11: o SP recusado não marca (o lembrete fica esperando).
        if (doCusto === 'recusada') return false
        // Conserto das fichas F1 (+10 SP por vez, regra que veio do Vincent): a Marca paga com SP conta como gastar SP.
        const combateAntes = novos.combate?.[personagem.id]
        if (tirouSp(doCusto, sistema) && combateAntes?.gastouSp !== true) {
          const depois: CombateDoPersonagem = { ...(combateAntes ?? combateVazio()), gastouSp: true }
          partes.push({ tipo: 'combate', personagemId: personagem.id, antes: combateAntes ?? null, depois })
          novos = { ...novos, combate: { ...(novos.combate ?? {}), [personagem.id]: depois } }
        }
        partes.push(...reversaoDaFicha(personagem.id, doCusto))
      }
      partes.push({ tipo: 'selo', seloId: marca.id, antes: null })
      novos = { ...novos, selos }
    }
    const nomeDoToken = nomeDoTokenNa(turnos, personagens)
    const nome = achada.cartao.nome.trim() || 'a passiva'
    const texto = passou
      ? `${nomeDoToken(lembrete.tokenId)} marcou ${nomeDoToken(lembrete.alvoTokenId)} (${nome} · ${detalhe})`
      : `${nomeDoToken(lembrete.tokenId)} não marcou ${nomeDoToken(lembrete.alvoTokenId)} (${nome} · ${detalhe} · falhou)`
    // A ficha passa pela aventura no meio: grava sobre a cena de agora, com a ordem calculada daqui.
    const atual = cenaDe(sceneKey) ?? cena
    gravarCena(sceneKey, {
      ...comMudanca(atual, novos, { id: linhaId, tipo: 'habilidade', texto, autor, tokenIds: [lembrete.tokenId, lembrete.alvoTokenId], personagemIds: [personagem.id], reversao: { tipo: 'composta', partes } }),
      efeitos: comEfeitos(atual.efeitos, efeitos),
    })
    return true
  }

  /**
   * R4: o "Ajustar..." (ver `ajustar` no estado). Mudança torta (recurso ou
   * atributo que o sistema não tem, número fora do teto) recusa o pedido
   * inteiro, antes de mexer em nada.
   */
  const ajustarNaBatalha = (sceneKey: string, autor: AutorDaAcao, pedido: PedidoDeAjusteNaBatalha): boolean => {
    const cena = cenaDe(sceneKey)
    if (cena === undefined) return false
    const { turnos } = cena
    const personagemId = personagemDoTokenNa(turnos)(pedido.tokenId)
    const sistema = mesa.sistema()
    const { mudancas } = pedido
    if (personagemId === undefined || personagemId === null || sistema === null || mudancas.length === 0 || mudancas.length > MUDANCAS_DO_AJUSTE_MAX) return false
    if (!mudancas.every((mudanca) => mudancaValida(sistema, mudanca))) return false
    // F2 (fatia B, resposta da Saga): Atual e Máximo juntos valem o digitado (1300/1300): o Máximo entra antes, para o Atual não parar no máximo de antes.
    const naFicha = mudancas.filter((mudanca) => mudanca.tipo !== 'atributo').sort((a, b) => Number(b.tipo === 'maximo') - Number(a.tipo === 'maximo'))
    const partes: Reversao[] = []
    if (naFicha.length > 0) {
      const ajustes = (atual: Personagem): Ajuste[] =>
        naFicha.flatMap((mudanca): Ajuste[] =>
          mudanca.tipo === 'atual' ? [ajusteDoAtualDigitado(atual, mudanca.recursoId, mudanca.valor)] : mudanca.tipo === 'maximo' ? [{ parte: 'maximo', chave: mudanca.recursoId, valor: mudanca.valor }] : [],
        )
      const naMesa = mexerNaFicha(mesa, personagemId, ajustes, quemNaFicha(autor))
      // Bug 11: recusada = o "Ajustar..." inteiro não entra (nem os atributos, que só moram aqui).
      if (naMesa === 'recusada') return false
      partes.push(...reversaoDaFicha(personagemId, naMesa))
    }
    const atual = cenaDe(sceneKey) ?? cena
    let novos = atual.turnos
    const pedacos: string[] = []
    for (const mudanca of mudancas) {
      if (mudanca.tipo === 'atributo') {
        const nome = sistema.atributos.find((atributo) => atributo.id === mudanca.atributoId)?.nome ?? mudanca.atributoId
        const sinal = mudanca.delta > 0 ? `+${mudanca.delta}` : String(mudanca.delta)
        const selo: SeloDaBatalha = {
          ...criarSelo(pedido.tokenId, { nome: `${nome} ${sinal}`.slice(0, NOME_DO_SELO_MAX), turnos: null, mods: [{ alvo: mudanca.atributoId, delta: mudanca.delta }], natureza: mudanca.delta > 0 ? 'buff' : 'debuff' }, { id: novoIdDeSelo(), rodada: novos.rodada, ...ondeNaVez(novos), origem: 'Ajustar' }),
          ajuste: true,
        }
        const selos = comSeloNovo(novos.selos, selo)
        if (selos === null) continue
        novos = { ...novos, selos }
        partes.push({ tipo: 'selo', seloId: selo.id, antes: null })
        pedacos.push(`${nome} ${sinal} até o fim da batalha`)
        continue
      }
      const recurso = sistema.recursos.find((candidato) => candidato.id === mudanca.recursoId)
      pedacos.push(`${recurso?.nome ?? mudanca.recursoId}${mudanca.tipo === 'maximo' ? ' máximo' : ''} ${mudanca.valor}`)
    }
    if (partes.length === 0) return false
    const nomeDoToken = nomeDoTokenNa(turnos, mesaDoRpg().personagens)
    // `personagemIds` = a ficha: a linha de ajuste de NPC (HP, atributo) não sai ao jogador.
    const texto = `${nomeDoAutor(autor)} ajustou ${nomeDoToken(pedido.tokenId)}: ${pedacos.join(' · ')}`
    gravarCena(sceneKey, comMudanca(atual, novos, { tipo: 'ficha', texto, autor, tokenIds: [pedido.tokenId], personagemIds: [personagemId], reversao: { tipo: 'composta', partes } }))
    return true
  }

  /** R5: o contador (ver `contador` no estado). O "sem reação" mora no combate; o nível, no selo do token. */
  const mexerNoContador = (sceneKey: string, autor: AutorDaAcao, pedido: PedidoDoContador): boolean => {
    const cena = cenaDe(sceneKey)
    if (cena === undefined || (pedido.tipo === 'zerar' && autor.tipo !== 'mestre')) return false
    const { turnos } = cena
    const carta = turnos.cartas.find((candidata) => candidata.tokenId === pedido.tokenId && candidata.bando === undefined)
    const personagemId = carta?.personagemId ?? null
    const { personagens, sistema } = mesaDoRpg()
    const personagem = personagens.find((candidato) => candidato.id === personagemId)
    const achado = personagem === undefined || sistema === null ? null : contadorDoPersonagem(personagem, sistema)
    if (personagemId === null || achado === null || achado.cartao.id !== pedido.cartaoId) return false
    // S4: carregar gasta a reação, e o Atordoado ou Paralisado não reage. Zerar (do mestre) continua valendo.
    if (pedido.tipo === 'ganhar' && travaDoToken(turnos.selos, pedido.tokenId) !== null) return false
    const { leitura } = achado
    const combateAntes = turnos.combate?.[personagemId]
    const nivel = nivelDoContador(turnos, pedido.tokenId, pedido.cartaoId)
    if (motivoDoContador(pedido.tipo, nivel, leitura.danoPorNivel.length, combateAntes?.semReacao === true, temGolpeEsperando(turnos.golpes, pedido.tokenId)) !== null) return false
    const molde = seloDoContador(turnos, pedido.tokenId, pedido.cartaoId) ?? {
      ...criarSelo(pedido.tokenId, { nome: leitura.nome, turnos: null, natureza: 'buff', cartaoId: achado.cartao.id }, { id: novoIdDeSelo(), rodada: turnos.rodada, ...ondeNaVez(turnos), origem: achado.cartao.nome }),
      contador: 0,
    }
    // Selo novo acima do teto da ficha ou da cena: recusa sem gastar a reação.
    if (nivel === 0 && comSeloNovo(turnos.selos, molde) === null) return false
    const delta = pedido.tipo === 'ganhar' ? 1 : -nivel
    const selos = selosComONivel(turnos.selos ?? [], molde, leitura.nome, leitura.danoPorNivel, delta)
    const partes: Reversao[] = [{ tipo: 'contador', selo: molde, nome: leitura.nome, danoPorNivel: leitura.danoPorNivel, delta }]
    let novos: TurnosDaCena = { ...turnos, selos: [...selos] }
    if (pedido.tipo === 'ganhar') {
      const depois: CombateDoPersonagem = { ...(combateAntes ?? combateVazio()), semReacao: true }
      partes.push({ tipo: 'combate', personagemId, antes: combateAntes ?? null, depois })
      novos = { ...novos, combate: { ...(novos.combate ?? {}), [personagemId]: depois } }
    }
    const nome = nomeDoTokenNa(turnos, personagens)(pedido.tokenId)
    const dano = leitura.danoPorNivel[nivel] ?? 0
    const texto = pedido.tipo === 'ganhar' ? `${nome} carregou ${leitura.nome}: nível ${nivel + 1} (+${dano} de dano) · sem reação até a vez dele` : `${nomeDoAutor(autor)} zerou ${leitura.nome} de ${nome}`
    gravarCena(sceneKey, comMudanca(cena, novos, { tipo: 'habilidade', texto, autor, tokenIds: [pedido.tokenId], personagemIds: [personagemId], reversao: { tipo: 'composta', partes } }))
    return true
  }

  /** O selo trocado (`depois`) ou tirado (`null`), com a linha "selo" do mestre. */
  const mudarSelo = (sceneKey: string, seloId: string, depois: SeloDaBatalha | null): boolean => {
    const cena = cenaDe(sceneKey)
    const antes = cena?.turnos.selos?.find((selo) => selo.id === seloId)
    if (cena === undefined || antes === undefined) return false
    const selos = (cena.turnos.selos ?? []).flatMap((selo) => (selo.id !== seloId ? [selo] : depois === null ? [] : [depois]))
    const { personagens, sistema } = mesaDoRpg()
    const nome = nomeDoTokenNa(cena.turnos, personagens)(antes.tokenId)
    const texto = depois === null ? `Mestre tirou ${textoDoSelo(antes)} de ${nome}` : `Mestre: ${textoDoSeloComMods(antes, sistema)} → ${textoDoSeloComMods(depois, sistema)} em ${nome}`
    const reversao: Reversao = depois === null ? { tipo: 'selo', seloId, antes } : { tipo: 'selo', seloId, antes, editado: true }
    gravarCena(sceneKey, comMudanca(cena, { ...cena.turnos, selos }, { tipo: 'selo', texto, tokenIds: [antes.tokenId], reversao }))
    return true
  }

  /**
   * Reverte a linha e a deixa riscada, sem conferir quem pede (o `desfazer`
   * confere). A reação com técnica desfeita refaz o texto da linha do golpe
   * (o alvo volta a "esperando reação").
   */
  const desfazerLinha = (sceneKey: string, linhaId: string, autor: AutorDaAcao): boolean => {
    const cena = cenaDe(sceneKey)
    const linha = cena?.registro.find((candidata) => candidata.id === linhaId)
    if (cena === undefined || linha === undefined || linha.desfeita !== undefined) return false
    const feito = desfazerReversao(mesa, sceneKey, cena, linha.reversao, autor)
    if (!feito.ok) return false
    const por = `${nomeDoAutor(autor)}${feito.emParte ? ' (em parte)' : ''}`
    // A cena de agora: o Desfazer da ficha passa pela aventura, e a store pode ter mudado no meio.
    const atual = cenaDe(sceneKey) ?? cena
    // F3: o desfazer do MESTRE faz o Judge erguer a carta em todas as telas; o do jogador, não.
    const efeitos = autor.tipo === 'mestre' ? comEfeitos(atual.efeitos, [{ tipo: 'judge', gesto: 'carta' }]) : atual.efeitos
    // Bug 3: a linha de uma vez que já passou: o gasto dela sai também da linha "Vez" que encerrou aquela vez.
    let registro = semOGastoNaFotoDaVez(marcarDesfeita(atual.registro, linhaId, por, Date.now()), linha)
    // Bug 3: a recarga que esta linha pôs sai também das linhas "Vez" que a desceram (a que chegou a 0 voltaria no Desfazer delas).
    registro = semARecargaNasVezes(registro, linha)
    // O contra-ataque que esta linha deu e alguém já gastou: o Desfazer de quem gastou não o devolve mais.
    for (const { golpeId, tokenId } of contrasDaReversao(linha.reversao)) registro = semOContraGasto(registro, golpeId, tokenId)
    const nomeDoToken = nomeDoTokenNa(feito.cena.turnos, mesaDoRpg().personagens)
    for (const parte of reacoesComTecnicaDe(linha.reversao)) {
      const voltou = feito.cena.turnos.golpes?.find((golpe) => golpe.id === parte.golpe.id)
      if (voltou !== undefined) registro = linhaAtualizada(registro, voltou.linhaId, textoDoGolpe(voltou, nomeDoToken), [])
    }
    // Invocação: o invocado que saiu ou voltou leva a carta do bando junto (some sem ninguém, volta com o mesmo id).
    const turnos = comBandosEmDia(feito.cena.turnos, nomeDoBandoNa(feito.cena.turnos, mesaDoRpg().personagens))
    gravarCena(sceneKey, { ...atual, turnos, regras: feito.cena.regras, registro, efeitos, turnosRev: atual.turnosRev + 1 })
    return true
  }

  /**
   * Tipos de habilidade F1: a reação COM TÉCNICA (sem d20, ou "rolar" com o
   * d20 do host). Confere a regra (`motivoDaReacaoComTecnica`), cobra o custo
   * pela aventura, marca recarga, usos e Overload, resolve o alvo (dano,
   * selo do golpe, contra-ataque da Q6), põe o selo em quem atacou se pedido
   * e escreve a linha "reacao" própria, com Desfazer que volta tudo e devolve
   * o alvo à espera. Não gasta ação da vez. A linha do golpe ganha o texto
   * novo ("esquivou com Passo de Valsa").
   */
  const reagirComTecnicaNaCena = (sceneKey: string, cena: BatalhaDaCena, golpe: GolpeDaBatalha, alvo: AlvoDoGolpe, autor: AutorDaAcao, pedido: PedidoDeTecnica): boolean => {
    const { turnos } = cena
    // F2 (fatia B, o "perto" do Aplauso): quem reage no lugar do alvo é um dos `porPerto` dele, só com a técnica que rebate e só rebatendo.
    const { por } = pedido
    if (por !== undefined && (!(alvo.porPerto ?? []).includes(por) || pedido.saida !== 'contra' || rebatePertoDe(pedido.cartaoId) === null)) return false
    const reageTokenId = por ?? alvo.tokenId
    const personagemId = por === undefined ? alvo.personagemId : (personagemDoTokenNa(turnos)(por) ?? null)
    if (personagemId === null) return false
    const { personagens, sistema } = mesaDoRpg()
    const personagem = personagens.find((candidato) => candidato.id === personagemId) ?? null
    const combateAntes = turnos.combate?.[personagemId]
    // Conserto das fichas F1: contra golpe Overload, só técnica Overload. F2 (revisão da fatia E): contra Surpresa, só a que vale contra
    // ela; a técnica que o mestre confirma (Recuperação de forças) só ele usa.
    if (motivoDaReacaoComTecnica({ personagem, sistema, combate: combateAntes, quemPede: autor.tipo }, alvo, pedido, golpe.overload, golpe.surpresa) !== null || personagem === null || sistema === null) return false
    // S4: Atordoado ou Paralisado não reage, nem com técnica.
    if (travaDoToken(turnos.selos, reageTokenId) !== null) return false
    // F2 (revisão da fatia D): quem está preso no Campo de Contenção rola com desvantagem, sem marcar.
    const selosDeQuemReage = selosDoToken(turnos.selos, reageTokenId)
    const rolado = pedido.saida === 'rolar' ? rolarComVantagem(deps.rolarD20, vantagemDaReacao(pedido.vantagem, selosDeQuemReage, golpe)) : null
    // F2 (revisão da fatia E): o Marcado esquiva com desvantagem também depois da técnica que rola (o Giro da Lança tem a rolagem dele).
    const esquiva = rolado !== null && reacaoAMaoDe(pedido.cartaoId)?.rolagem === undefined && esquivaComDesvantagem(selosDeQuemReage, rolado.vantagem?.modo) ? rolarODadoDaEsquiva(deps.rolarD20, rolado.d20) : undefined
    const combateBase = combateAntes ?? combateVazio()
    const lida = reagirComTecnica(golpe, alvo.tokenId, pedido, personagem, sistema, combateBase, rolado?.d20 ?? null, rolado?.vantagem, esquiva)
    if (lida === null) return false
    // R1: resolvido na reação, o alvo passa pela marca antes do dano (o golpe da reversão já leva o dobro).
    const acerto = lida.alvo.danoFinal === undefined ? null : acertoComMarca(mesa, turnos, lida.golpe, lida.alvo)
    const feita = acerto === null ? lida : { ...lida, alvo: acerto.alvo, golpe: golpeComOAlvo(lida.golpe, acerto.alvo) }
    const quem = quemNaFicha(autor)
    const partes: Reversao[] = [{ tipo: 'reacaoComTecnica', golpe: feita.golpe, tokenId: alvo.tokenId, alvoAntes: alvo }, ...(acerto?.partes ?? [])]
    const efeitos: EfeitoNovo[] = []
    let novos: TurnosDaCena = { ...(acerto?.turnos ?? turnos), golpes: comGolpe(turnos.golpes, feita.golpe) }
    // `depoisDaTecnica` devolve o MESMO combate quando a técnica não marca nada (sem recarga, usos nem Overload).
    if (feita.combate !== combateBase) {
      partes.push({ tipo: 'combate', personagemId, antes: combateAntes ?? null, depois: feita.combate })
      novos = { ...novos, combate: { ...(novos.combate ?? {}), [personagemId]: feita.combate } }
    }
    if (feita.custo.length > 0) {
      const custo = feita.custo
      const doCusto = mexerNaFicha(mesa, personagemId, () => custo, quem)
      // Bug 11: custo recusado = a reação não sai (o alvo segue esperando).
      if (doCusto === 'recusada') return false
      partes.push(...reversaoDaFicha(personagemId, doCusto))
    }
    // Conserto das fichas F1 (Overload, resposta da May "nos 2 modos"): reagir com Overload também cansa.
    if (feita.combate.overload && !combateBase.overload) {
      const cansado = cansarNoOverload(personagemId, reageTokenId, novos)
      if (cansado !== null) {
        partes.push(...cansado.partes)
        novos = cansado.turnos
      }
    }
    const { alvo: depois } = feita
    let golpeFeito = feita.golpe
    let textoDoRebate = ''
    if (depois.rolagem !== undefined && depois.danoFinal === undefined) {
      efeitos.push({ tipo: 'reacao', golpeId: golpe.id, tokenId: depois.tokenId, d20: depois.rolagem.d20, modificador: depois.rolagem.modificador, total: depois.rolagem.total })
    } else {
      const dano = danoNoAlvo(mesa, depois, golpe, autor)
      // Bug 11: o dano recusado leva o custo junto de volta; a reação não sai.
      if (dano === 'recusada') {
        devolverFichasDaAcao(mesa, sceneKey, cena, partes, autor)
        return false
      }
      partes.push(...dano.partes)
      if (dano.efeito !== null) efeitos.push(dano.efeito)
      // F3 (Q6): o selo do golpe só pega se o golpe acertou este alvo (Metade, Receber). F2 (fatia B): com a disputa da mecânica à mão.
      const noAcerto = seloNoAcerto(novos, golpe, depois)
      if (noAcerto.alvo !== depois) {
        golpeFeito = golpeComOAlvo(golpeFeito, noAcerto.alvo)
        novos = { ...novos, golpes: comGolpe(turnos.golpes, golpeFeito) }
      }
      const selado = noAcerto.selado
      if (selado !== null) {
        partes.push(selado.parte)
        novos = { ...novos, selos: selado.selos }
      }
      // F2 (fatia B, Aplauso da May): a técnica que REBATE devolve o dano que chegou + a Força dela em quem atacou, na hora (no lugar do contra-ataque).
      const rebate = depois.saida === 'contra' && depois.tecnica !== undefined ? mecanicaDoCartao(depois.tecnica.cartaoId)?.rebate : undefined
      // F2 (fatia D, Armadura Humana "Atacar"): toma o golpe inteiro e devolve o que tomou ÷ 7 (para baixo) em quem atacou, sem reação.
      const devolve = feita.devolveDividido === undefined || feita.devolveDividido <= 0 ? 0 : Math.floor((depois.danoFinal ?? 0) / feita.devolveDividido)
      if (devolve > 0) {
        const noAtacante: AlvoDoGolpe = { tokenId: golpe.atacanteTokenId, personagemId: golpe.atacantePersonagemId, dano: devolve, podeReagir: false, saida: 'semReacao', danoFinal: devolve }
        const devolvido = danoNoAlvo(mesa, noAtacante, { perfurante: false }, autor)
        if (devolvido === 'recusada') {
          devolverFichasDaAcao(mesa, sceneKey, cena, partes, autor)
          return false
        }
        partes.push(...devolvido.partes)
        if (devolvido.efeito !== null) efeitos.push(devolvido.efeito)
        textoDoRebate = ` · devolveu ${devolve} em ${nomeDoTokenNa(turnos, personagens)(golpe.atacanteTokenId)} (${depois.danoFinal ?? 0} ÷ ${feita.devolveDividido ?? 1})`
      } else if (rebate !== undefined) {
        // A Força de antes da reação: o cansaço do Overload dela vem DEPOIS de rebater.
        const lida = lerDano(rebate.soma, { personagem, sistema, arma: null, vidaDoAlvo: null, bonusDaBatalha: bonusDaBatalha(turnos.selos, reageTokenId) })
        const soma = lida.tipo === 'valor' ? lida.valor : 0
        const total = Math.min(DANO_MAX, (depois.dano ?? 0) + soma)
        const noAtacante: AlvoDoGolpe = { tokenId: golpe.atacanteTokenId, personagemId: golpe.atacantePersonagemId, dano: total, podeReagir: false, saida: 'semReacao', danoFinal: total }
        const rebatido = danoNoAlvo(mesa, noAtacante, { perfurante: false }, autor)
        if (rebatido === 'recusada') {
          devolverFichasDaAcao(mesa, sceneKey, cena, partes, autor)
          return false
        }
        partes.push(...rebatido.partes)
        if (rebatido.efeito !== null) efeitos.push(rebatido.efeito)
        textoDoRebate = ` · rebateu ${total} em ${nomeDoTokenNa(turnos, personagens)(golpe.atacanteTokenId)} (${depois.dano ?? 0} + ${soma})`
      } else if (depois.saida === 'contra' && (novos.contras?.length ?? 0) < CONTRAS_MAX) {
        // Q6: Contra = sem dano e uma ação a mais na hora (sai no Desfazer pela parte "reacaoComTecnica").
        const ganho: ContraAtaque = { golpeId: golpe.id, tokenId: depois.tokenId, personagemId: depois.personagemId, atacanteTokenId: golpe.atacanteTokenId, rodada: turnos.rodada }
        novos = { ...novos, contras: [...(novos.contras ?? []), ganho] }
      }
      // F2 (fatia E, Recuperação de forças): 20% do dano que chegava volta em vida (até o máximo); só o mestre usa (ele confirmou o fogo ou a explosão).
      const cura = feita.cura ?? 0
      const curou = cura <= 0 ? null : mexerNaFicha(mesa, personagemId, (atual, sistemaDaMesa) => ajustesDaCura(atual, sistemaDaMesa, cura), quem)
      if (curou === 'recusada') {
        devolverFichasDaAcao(mesa, sceneKey, cena, partes, autor)
        return false
      }
      if (curou !== null) {
        partes.push(...reversaoDaFicha(personagemId, curou))
        textoDoRebate += ` · come o golpe e cura ${cura} (o mestre confirmou: fogo ou explosão)`
      }
    }
    // O selo da técnica em QUEM ATACOU ("Marcado"), se marcado na caixa e o atacante segue na ordem.
    // "Marcado" é a MARCA de verdade (Passo de Valsa, decisão do usuário 01/11): o próximo golpe que acertar dá o dobro; uma por alvo.
    const linhaId = novoIdDeLinha()
    const marcaNoAtacante = feita.seloNoAtacante?.nome === NOME_DA_MARCA && depois.tecnica !== undefined
    const atacanteJaMarcado = marcaNoAtacante && marcaDoToken(novos.selos, golpe.atacanteTokenId) !== undefined
    if (feita.seloNoAtacante !== null && !atacanteJaMarcado && turnos.cartas.some((carta) => carta.tokenId === golpe.atacanteTokenId)) {
      const selo =
        marcaNoAtacante && depois.tecnica !== undefined
          ? criarMarca(novos, golpe.atacanteTokenId, { selo: novoIdDaMarca(), linha: linhaId }, { id: depois.tecnica.cartaoId, nome: depois.tecnica.nome })
          : criarSelo(golpe.atacanteTokenId, feita.seloNoAtacante, { id: novoIdDeSelo(), rodada: turnos.rodada, ...ondeNaVez(turnos), origem: depois.tecnica?.nome })
      const selos = comSeloNovo(novos.selos, selo)
      if (selos !== null) {
        partes.push({ tipo: 'selo', seloId: selo.id, antes: null })
        novos = { ...novos, selos }
      }
    }
    // Tipos de habilidade F3: o dano (ou o custo de HP da técnica) pode levar alguém abaixo do gatilho de vida.
    const lembrados = lembrarDepoisDoDano(novos)
    partes.push(...partesDosLembretes(lembrados))
    novos = lembrados.turnos
    const nomeDoToken = nomeDoTokenNa(turnos, personagens)
    // A ficha passa pela aventura no meio: grava sobre a cena de agora, com a ordem calculada daqui.
    const atual = cenaDe(sceneKey) ?? cena
    const comOGolpe = { ...atual, registro: linhaAtualizada(atual.registro, golpe.linhaId, textoDoGolpe(golpeFeito, nomeDoToken), []) }
    const quemReage = por === undefined ? textoDaReacaoComTecnica(depois, nomeDoToken) : `${nomeDoToken(por)} reage com ${depois.tecnica?.nome ?? 'técnica'} por ${nomeDoToken(depois.tokenId)}: o golpe não pega`
    const texto = quemReage + textoDoRebate
    gravarCena(sceneKey, {
      ...comMudanca(comOGolpe, novos, { id: linhaId, tipo: 'reacao', texto, autor, tokenIds: [...new Set([reageTokenId, depois.tokenId, golpe.atacanteTokenId])], reversao: { tipo: 'composta', partes } }),
      efeitos: comEfeitos(atual.efeitos, efeitos),
    })
    avisarQuemCaiu(sceneKey, autor)
    return true
  }

  /**
   * R3 (lote de 01/11): o alvo passa sem tomar dano, antes ou depois do dado.
   * Nada de ficha, selo, marca nem contra: só o golpe resolvido e a linha
   * "reacao" própria ("Siegfried passou sem dano"), cujo Desfazer devolve o
   * alvo à espera pela mesma parte da reação com técnica.
   */
  const passarSemDanoNaCena = (sceneKey: string, cena: BatalhaDaCena, golpe: GolpeDaBatalha, alvo: AlvoDoGolpe, autor: AutorDaAcao): boolean => {
    const novo = passarSemDano(golpe, alvo.tokenId)
    if (novo === golpe) return false
    const nomeDoToken = nomeDoTokenNa(cena.turnos, mesaDoRpg().personagens)
    const atual = cenaDe(sceneKey) ?? cena
    const novos: TurnosDaCena = { ...atual.turnos, golpes: comGolpe(atual.turnos.golpes, novo) }
    const comOGolpe = { ...atual, registro: linhaAtualizada(atual.registro, golpe.linhaId, textoDoGolpe(novo, nomeDoToken), []) }
    const texto = `${nomeDoToken(alvo.tokenId)} passou sem dano`
    const linha: LinhaNova = { tipo: 'reacao', texto, autor, tokenIds: [...new Set([alvo.tokenId, golpe.atacanteTokenId])], reversao: { tipo: 'reacaoComTecnica', golpe: novo, tokenId: alvo.tokenId, alvoAntes: alvo } }
    if (alvo.personagemId !== null) linha.personagemIds = [alvo.personagemId]
    gravarCena(sceneKey, comMudanca(comOGolpe, novos, linha))
    return true
  }

  /**
   * O corpo do `agir`: lança o golpe (ou concentra, ou move pelo contra) pela
   * carta `carta`. `turnosDoCtx` são os turnos que a regra lê (para o
   * invocado, com o gasto DELE no lugar do da carta do bando); `chaveDoGasto`
   * é onde o gasto novo é gravado (`carta.id`, ou a chave do membro do
   * bando). A base do que muda é sempre `cena.turnos`.
   */
  /**
   * F2 (fatia B, o "perto" do Aplauso = o 6x6 à frente da May): as fichas que
   * podem rebater o golpe Overload de `atacanteTokenId` no alvo: técnica de
   * reação Overload disponível com rebate e área `perto` (mecânica à mão), o
   * alvo dentro dela, sem Atordoado nem Paralisado; fora quem ataca e o
   * próprio alvo. A mesa sem mapa (arena, duelo) não sabe onde ninguém está:
   * ninguém.
   */
  const quemRebatePor = (sceneKey: string, turnos: TurnosDaCena, atacanteTokenId: string) => (alvoTokenId: string): string[] => {
    const { personagens, sistema } = mesaDoRpg()
    const doAlvo = mesa.posicaoDoToken?.(sceneKey, alvoTokenId) ?? null
    if (sistema === null || doAlvo === null) return []
    const tokens = new Set<string>()
    for (const carta of turnos.cartas) {
      const { tokenId, personagemId } = carta
      // Como o alvo: quem gastou a reação no contador (R5) ou está travado (S4) não reage.
      if (personagemId === null || tokenId === alvoTokenId || tokenId === atacanteTokenId || tokens.has(tokenId) || gastouAReacao(turnos, tokenId) || travaDoToken(turnos.selos, tokenId) !== null) continue
      const personagem = personagens.find((candidato) => candidato.id === personagemId)
      if (personagem === undefined) continue
      const areas = reacoesDisponiveis(personagem, sistema, turnos.combate?.[personagemId]).flatMap((reacao) => {
        const perto = reacao.overload && reacao.motivo === null ? rebatePertoDe(reacao.cartao.id) : null
        return perto === null ? [] : [perto]
      })
      const dele = areas.length === 0 ? null : (mesa.posicaoDoToken?.(sceneKey, tokenId) ?? null)
      if (dele !== null && areas.some((forma) => casaNaAreaVirada(forma, dele.casa, dele.direcao, doAlvo.casa))) tokens.add(tokenId)
    }
    return [...tokens]
  }

  /** O que a regra do golpe lê para `carta` agir agora (`podeAgir`, `lancarGolpe`). */
  const contextoDaCarta = (sceneKey: string, cena: BatalhaDaCena, autor: AutorDaAcao, carta: CartaDaOrdem, turnosDoCtx: TurnosDaCena): ContextoDoGolpe => {
    const { turnos } = cena
    const { personagens, sistema } = mesaDoRpg()
    const personagem = carta.personagemId === null ? null : (personagens.find((candidato) => candidato.id === carta.personagemId) ?? null)
    return {
      turnos: turnosDoCtx,
      carta,
      personagem,
      sistema,
      regras: cena.regras,
      autor,
      personagens,
      personagemDoToken: personagemDoTokenNa(turnos),
      // Invocação (decisão 8): o invocado não reage; o dano nele resolve na hora.
      // R5: quem gastou a reação no contador também não reage (até a vez dele).
      // Conserto das fichas F1 (S4): Atordoado ou Paralisado não reage (o golpe nele resolve na hora).
      semReacao: (tokenId) => invocadoDoToken(turnos, tokenId) !== null || gastouAReacao(turnos, tokenId) || travaDoToken(turnos.selos, tokenId) !== null,
      // Conserto das fichas F1: o golpe Overload espera só quem tem outra Overload de reação disponível.
      reageAOverload: (tokenId) => {
        const personagemId = personagemDoTokenNa(turnos)(tokenId)
        const alvo = personagemId === null || personagemId === undefined ? undefined : personagens.find((candidato) => candidato.id === personagemId)
        return alvo !== undefined && sistema !== null && temOverloadDeReacao(alvo, sistema, turnos.combate?.[alvo.id])
      },
      // F2 (revisão da fatia E): o golpe Surpresa espera só quem tem técnica que vale contra ela (Recuperação de forças).
      reageASurpresa: (tokenId) => {
        const personagemId = personagemDoTokenNa(turnos)(tokenId)
        const alvo = personagemId === null || personagemId === undefined ? undefined : personagens.find((candidato) => candidato.id === personagemId)
        return alvo !== undefined && sistema !== null && temReacaoContraSurpresa(alvo, sistema, turnos.combate?.[alvo.id])
      },
      quemRebatePor: quemRebatePor(sceneKey, turnos, carta.tokenId),
      // F2 (fatia C, A Luz do Sol): os aliados de quem age não tomam o dano da técnica de selo só nos aliados.
      aliados: carta.personagemId === null ? new Set<string>() : aliadosDe(new Set([carta.personagemId]), mesa.equipes(), personagens),
    }
  }

  const agirComACarta = (sceneKey: string, cena: BatalhaDaCena, autor: AutorDaAcao, carta: CartaDaOrdem, turnosDoCtx: TurnosDaCena, chaveDoGasto: string, pedido: PedidoDeAcao): boolean => {
    const { turnos } = cena
    const { personagens } = mesaDoRpg()
    const ctx = contextoDaCarta(sceneKey, cena, autor, carta, turnosDoCtx)
    if (podeAgir(ctx, pedido) !== null) return false
    const linhaId = novoIdDeLinha()
    // F2 (fatias B e C): os ids das partes seguintes vão sempre; só a técnica com `segundoGolpe` e o Atacar melhorado (Aira com a Bênção) os usam.
    const bruto = lancarGolpe(ctx, pedido, {
      golpe: novoIdDeGolpe(),
      linha: linhaId,
      segundo: { golpe: novoIdDeGolpe(), linha: novoIdDeLinha() },
      seguintes: Array.from({ length: PARTES_SEGUINTES_MAX }, () => ({ golpe: novoIdDeGolpe(), linha: novoIdDeLinha() })),
    })
    // F2 (fatia D, Explosão): a disputa da mecânica à mão rolada LOGO AO USAR (o alvo testa; passou = nada; se ninguém falhou, não gasta).
    const noUso = pedido.tipo === 'habilidade' ? disputaNoUso(pedido.cartaoId) : null
    const fichaNaDisputa = (personagemId: string | null, tokenId: string) => {
      const dele = personagemId === null ? undefined : personagens.find((candidato) => candidato.id === personagemId)
      return dele === undefined ? null : { personagem: dele, bonus: bonusDaBatalha(turnos.selos, tokenId) }
    }
    const deQuemUsa = fichaNaDisputa(carta.personagemId, carta.tokenId)
    const usado =
      noUso === null || deQuemUsa === null || ctx.sistema === null
        ? null
        : comADisputaNoUso(bruto, noUso, {
            usa: deQuemUsa,
            fichaDoAlvo: (alvo) => fichaNaDisputa(alvo.personagemId, alvo.tokenId),
            combateAntes: carta.personagemId === null ? undefined : turnos.combate?.[carta.personagemId],
            sistema: ctx.sistema,
            carga: bruto.cargaUsada,
            rolarD20: deps.rolarD20,
          })
    const lancado = usado?.lancado ?? bruto
    const quem = quemNaFicha(autor)
    // A ordem da reversão é a da seção 3.6: gasto, combate, custo, contra-ataque, golpe, fichas dos alvos.
    const partes: Reversao[] = []
    let novos: TurnosDaCena = turnos
    if (lancado.gasto !== null) {
      partes.push({ tipo: 'gasto', cartaId: chaveDoGasto, antes: turnos.gastos[chaveDoGasto] ?? null })
      novos = { ...novos, gastos: { ...novos.gastos, [chaveDoGasto]: lancado.gasto } }
    }
    if (lancado.combate !== null && carta.personagemId !== null) {
      partes.push({ tipo: 'combate', personagemId: carta.personagemId, antes: turnos.combate?.[carta.personagemId] ?? null, depois: lancado.combate })
      novos = { ...novos, combate: { ...(novos.combate ?? {}), [carta.personagemId]: lancado.combate } }
    }
    if (lancado.custo.length > 0 && carta.personagemId !== null) {
      const custo = lancado.custo
      const doCusto = mexerNaFicha(mesa, carta.personagemId, () => custo, quem)
      // Bug 11: custo recusado = a técnica não sai (sem recarga, sem golpe, sem linha).
      if (doCusto === 'recusada') return false
      partes.push(...reversaoDaFicha(carta.personagemId, doCusto))
    }
    // Conserto das fichas F1 (Overload): quem usou fica com os atributos base pela metade até o fim da batalha.
    if (lancado.golpe?.overload === true && carta.personagemId !== null) {
      const cansado = cansarNoOverload(carta.personagemId, carta.tokenId, novos)
      if (cansado !== null) {
        partes.push(...cansado.partes)
        novos = cansado.turnos
      }
    }
    if (lancado.contraUsado !== null) {
      const usado = lancado.contraUsado
      partes.push({ tipo: 'contra', contra: usado })
      novos = { ...novos, contras: (novos.contras ?? []).filter((candidato) => !(candidato.golpeId === usado.golpeId && candidato.tokenId === usado.tokenId)) }
    }
    const efeitos: EfeitoNovo[] = []
    let golpe = lancado.golpe
    if (golpe !== null) {
      // F2 (fatia F, redoma da Orquídea): o selo que dura "até o próximo golpe" sai dos alvos deste golpe (antes do selo novo dele).
      for (const saiu of selosQueSaemNoGolpe(novos.selos, golpe.alvos.map((alvo) => alvo.tokenId))) {
        partes.push({ tipo: 'selo', seloId: saiu.id, antes: saiu })
        novos = { ...novos, selos: (novos.selos ?? []).filter((selo) => selo.id !== saiu.id) }
      }
      // F2 (fatia F, Golpe Baixo): quem usa ganha o selo da técnica ("+8 em reação" por 2 turnos dele).
      if (golpe.seloEmQuemUsa !== undefined) {
        const proprio = criarSelo(carta.tokenId, golpe.seloEmQuemUsa, { id: novoIdDeSelo(), rodada: novos.rodada, ...ondeNaVez(novos), origem: golpe.nome })
        const comOProprio = comSeloNovo(novos.selos, proprio)
        if (comOProprio !== null) {
          partes.push({ tipo: 'selo', seloId: proprio.id, antes: null })
          novos = { ...novos, selos: comOProprio }
        }
      }
      partes.push({ tipo: 'golpe', golpeId: golpe.id })
      efeitos.push({ tipo: 'golpe', golpeId: golpe.id, atacanteTokenId: golpe.atacanteTokenId, nome: golpe.nome, alvos: golpe.alvos.map((alvo) => alvo.tokenId), surpresa: golpe.surpresa, overload: golpe.overload })
      for (const resolvido of lancado.resolvidos) {
        // R1: a marca antes do dano (o dobro, a marca da técnica, o lembrete da passiva).
        const acerto = acertoComMarca(mesa, novos, golpe, resolvido)
        novos = acerto.turnos
        golpe = golpeComOAlvo(golpe, acerto.alvo)
        const alvo = acerto.alvo
        const feito = danoNoAlvo(mesa, alvo, golpe, autor)
        // Bug 11: o dano recusado leva de volta o custo e o dano dos alvos anteriores; o golpe não sai.
        if (feito === 'recusada') {
          devolverFichasDaAcao(mesa, sceneKey, cena, partes, autor)
          return false
        }
        partes.push(...feito.partes, ...acerto.partes)
        if (feito.efeito !== null) efeitos.push(feito.efeito)
        // F3 (Q6): o selo do golpe pega no alvo que ele acertou (F2, fatia B: com a disputa da mecânica à mão).
        const noAcerto = seloNoAcerto(novos, golpe, alvo)
        golpe = golpeComOAlvo(golpe, noAcerto.alvo)
        const selado = noAcerto.selado
        if (selado !== null) {
          partes.push(selado.parte)
          novos = { ...novos, selos: selado.selos }
        }
      }
      // F2 (fatia D, Explosão): em quem falhou, os selos negativos dobram os turnos que faltam (Atordoado 2 vira 4).
      if (usado !== null && noUso?.seQuemUsaVence?.dobraOsDebuffs === true) {
        for (const tokenId of usado.venceuEm) {
          for (const { antes, depois } of debuffsDobrados(novos.selos, tokenId)) {
            partes.push({ tipo: 'selo', seloId: antes.id, antes, editado: true })
            novos = { ...novos, selos: (novos.selos ?? []).map((selo) => (selo.id === antes.id ? depois : selo)) }
          }
        }
      }
      // F2 (fatia D, Revigorar): tira os selos negativos (o cansaço do Overload junto) e cura, em cada alvo (ele ou um aliado).
      const limpeza = pedido.tipo === 'habilidade' ? limpezaDe(pedido.cartaoId) : null
      if (limpeza !== null && ctx.personagem !== null && ctx.sistema !== null) {
        for (const alvo of golpe.alvos) {
          // F2 (fatia F, Medicina): a que só cura deixa os debuffs.
          const tirados = limpeza.soCura === true ? [] : debuffsDoToken(novos.selos, alvo.tokenId)
          for (const selo of tirados) partes.push({ tipo: 'selo', seloId: selo.id, antes: selo })
          const fora = new Set(tirados.map((selo) => selo.id))
          novos = { ...novos, selos: (novos.selos ?? []).filter((selo) => !fora.has(selo.id)) }
          // A cura lê o Espírito de quem usa DEPOIS da limpeza (sem o cansaço, se ele limpou a si mesmo); com 3 cargas, a fórmula do X3 da ficha.
          const lida = lerDano(formulaDaCura(limpeza, lancado.cargaUsada), { personagem: ctx.personagem, sistema: ctx.sistema, arma: null, vidaDoAlvo: null, bonusDaBatalha: bonusDaBatalha(novos.selos, carta.tokenId) })
          const cura = lida.tipo === 'valor' ? lida.valor : 0
          const curou = alvo.personagemId === null || cura <= 0 ? null : mexerNaFicha(mesa, alvo.personagemId, (atual, sistema) => ajustesDaCura(atual, sistema, cura), quem)
          if (curou === 'recusada') {
            devolverFichasDaAcao(mesa, sceneKey, cena, partes, autor)
            return false
          }
          if (curou !== null && alvo.personagemId !== null) partes.push(...reversaoDaFicha(alvo.personagemId, curou))
          // F2 (fatia F, Medicina): a nota diz o item gasto ("curou 100, gastou 1 Kit Médico").
          const item = pedido.tipo === 'habilidade' ? mecanicaDoCartao(pedido.cartaoId)?.gastaItem : undefined
          const doItem = item === undefined ? '' : `, gastou 1 ${item}`
          const nota = limpeza.soCura === true ? `curou ${cura}${doItem}` : `tirou ${tirados.length} ${tirados.length === 1 ? 'debuff' : 'debuffs'}, curou ${cura}${doItem}`
          golpe = golpeComOAlvo(golpe, { ...alvo, nota })
        }
      }
      novos = { ...novos, golpes: comGolpe(novos.golpes, golpe) }
    }
    // F2 (fatia B, Rapid Dash; fatia C, o Atacar da Aira com a Bênção): as partes seguintes entram juntas, cada uma com a linha dela
    // (gravada logo depois); o dano de quem não reage cai já, com o selo da parte.
    const seguintes: { golpe: GolpeDaBatalha; partes: Reversao[] }[] = []
    for (const parte of partesSeguintes(lancado)) {
      // O Desfazer da linha do 1º golpe desfaz junto a das outras partes (e as reações a elas).
      partes.push({ tipo: 'linhaJunto', linhaId: parte.golpe.linhaId })
      const daParte: Reversao[] = [{ tipo: 'golpe', golpeId: parte.golpe.id }]
      let golpeDaParte = parte.golpe
      for (const resolvido of parte.resolvidos) {
        const feito = danoNoAlvo(mesa, resolvido, golpeDaParte, autor)
        if (feito === 'recusada') {
          devolverFichasDaAcao(mesa, sceneKey, cena, [...partes, ...seguintes.flatMap((anterior) => anterior.partes), ...daParte], autor)
          return false
        }
        daParte.push(...feito.partes)
        if (feito.efeito !== null) efeitos.push(feito.efeito)
        const noAcerto = seloNoAcerto(novos, golpeDaParte, resolvido)
        golpeDaParte = golpeComOAlvo(golpeDaParte, noAcerto.alvo)
        if (noAcerto.selado !== null) {
          daParte.push(noAcerto.selado.parte)
          novos = { ...novos, selos: noAcerto.selado.selos }
        }
      }
      novos = { ...novos, golpes: comGolpe(novos.golpes, golpeDaParte) }
      seguintes.push({ golpe: golpeDaParte, partes: daParte })
    }
    // Invocação (decisão 9): o invocado que o dano levou a 0 sai do mapa e do bando.
    const caidos = semOsCaidos(mesa, sceneKey, novos)
    partes.push(...caidos.partes)
    novos = caidos.partes.length === 0 ? caidos.turnos : comBandosEmDia(caidos.turnos, nomeDoBandoNa(caidos.turnos, mesa.personagens()))
    // Tipos de habilidade F3: o dano dos alvos sem reação (e o custo de HP) pode levar alguém abaixo do gatilho de vida.
    const lembrados = lembrarDepoisDoDano(novos)
    partes.push(...partesDosLembretes(lembrados))
    novos = lembrados.turnos
    const nomeDoToken = nomeDoTokenNa(turnos, personagens)
    const quemAge = nomeDoToken(carta.tokenId)
    let texto: string
    let tipo: TipoDaLinha
    if (golpe !== null) {
      texto = textoDoGolpe(golpe, nomeDoToken)
      tipo = pedido.tipo === 'habilidade' ? 'habilidade' : 'golpe'
    } else if (pedido.tipo === 'concentrar') {
      texto = `${quemAge} concentrou (carga ${lancado.combate?.carga ?? 0}${lancado.acao === 'livre' ? ', sem gastar ação' : ''})`
      tipo = 'acao'
    } else {
      texto = `${quemAge} usou o contra-ataque para se mover`
      tipo = 'acao'
    }
    texto += textoDosQueSairam(caidos.nomes)
    const tokenIds = [...new Set([carta.tokenId, ...(golpe?.alvos.map((alvo) => alvo.tokenId) ?? [])])]
    // A ficha passa pela aventura no meio: grava sobre a cena de agora, com a ordem calculada daqui.
    const atual = cenaDe(sceneKey) ?? cena
    gravarCena(sceneKey, {
      ...comMudanca(atual, novos, { id: linhaId, tipo, texto, autor, tokenIds, reversao: { tipo: 'composta', partes } }),
      efeitos: comEfeitos(atual.efeitos, efeitos),
    })
    for (const parte of seguintes) {
      const comALinha = cenaDe(sceneKey)
      if (comALinha !== undefined) gravarCena(sceneKey, comMudanca(comALinha, comALinha.turnos, { id: parte.golpe.linhaId, tipo, texto: textoDoGolpe(parte.golpe, nomeDoToken), autor, tokenIds, reversao: { tipo: 'composta', partes: parte.partes } }))
    }
    avisarQuemCaiu(sceneKey, autor)
    // Conserto das fichas F1 (bug 2): acima do teto, o golpe mais velho vira "Não reagiu"; o ataque novo nunca é recusado por isso.
    const esperando = cenaDe(sceneKey)?.turnos.golpes ?? []
    if (esperando.length > GOLPES_PENDENTES_MAX) {
      const ficam = new Set(esperando.slice(-GOLPES_PENDENTES_MAX).map((pendente) => pendente.id))
      fecharGolpesSemResposta(sceneKey, (pendente) => !ficam.has(pendente.id), 'a tempo (golpes demais esperando)')
    }
    return true
  }

  /**
   * Conserto das fichas F1 (bug 2, regra P3 do grilling): o alvo que não
   * respondeu vira "Não reagiu" sozinho, como no botão Não reagir do mestre
   * (a marca, o dano na ficha, o selo do golpe). Uma linha "reacao" por golpe
   * diz quem não reagiu e por quê (`porque`); o Desfazer dela devolve o alvo à
   * espera e o dano à ficha (as mesmas partes da reação com técnica). `fecha`
   * escolhe os golpes, lidos da cena de agora. Devolve os ids das linhas
   * escritas, na ordem.
   */
  const fecharGolpesSemResposta = (sceneKey: string, fecha: (golpe: GolpeDaBatalha) => boolean, porque: string): string[] => {
    const ids = (cenaDe(sceneKey)?.turnos.golpes ?? []).filter(fecha).map((golpe) => golpe.id)
    const linhas: string[] = []
    for (const golpeId of ids) {
      const cena = cenaDe(sceneKey)
      const antes = cena?.turnos.golpes?.find((candidato) => candidato.id === golpeId)
      if (cena === undefined || antes === undefined) continue
      let golpe = antes
      let novos: TurnosDaCena = cena.turnos
      const partes: Reversao[] = []
      const efeitos: EfeitoNovo[] = []
      const resolvidos: AlvoDoGolpe[] = []
      let recusou = false
      for (const esperando of antes.alvos) {
        if (esperando.danoFinal !== undefined) continue
        // Quem já rolou e não escolheu toma o "Passar" (o 1 natural continua crítico): esperar a virada não foge do dado.
        const saida = esperando.rolagem === undefined ? 'naoReagiu' : saidaDoPassar(esperando.rolagem.d20)
        const semResposta = resolverAlvo(golpe, esperando.tokenId, saida)
        const semMarca = semResposta.alvos.find((candidato) => candidato.tokenId === esperando.tokenId)
        if (semMarca === undefined) continue
        // R1: a marca antes do dano, como em toda reação.
        const acerto = acertoComMarca(mesa, novos, semResposta, semMarca)
        novos = acerto.turnos
        golpe = golpeComOAlvo(semResposta, acerto.alvo)
        const feito = danoNoAlvo(mesa, acerto.alvo, golpe, MESTRE)
        // Bug 11: dano recusado = este golpe segue esperando (o dano dos outros alvos dele volta); a próxima virada tenta de novo.
        if (feito === 'recusada') {
          devolverFichasDaAcao(mesa, sceneKey, cena, partes, MESTRE)
          recusou = true
          break
        }
        partes.push({ tipo: 'reacaoComTecnica', golpe, tokenId: esperando.tokenId, alvoAntes: esperando }, ...acerto.partes, ...feito.partes)
        if (feito.efeito !== null) efeitos.push(feito.efeito)
        const noAcerto = seloNoAcerto(novos, golpe, acerto.alvo)
        golpe = golpeComOAlvo(golpe, noAcerto.alvo)
        const selado = noAcerto.selado
        if (selado !== null) {
          partes.push(selado.parte)
          novos = { ...novos, selos: selado.selos }
        }
        resolvidos.push(acerto.alvo)
      }
      if (recusou || resolvidos.length === 0) continue
      novos = { ...novos, golpes: comGolpe(novos.golpes, golpe) }
      const lembrados = lembrarDepoisDoDano(novos)
      partes.push(...partesDosLembretes(lembrados))
      novos = lembrados.turnos
      const nomeDoToken = nomeDoTokenNa(cena.turnos, mesaDoRpg().personagens)
      const nomes = resolvidos.map((alvo) => nomeDoToken(alvo.tokenId))
      const quem = nomes.length === 1 ? (nomes[0] ?? '') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1] ?? ''}`
      const texto = `${quem} não ${nomes.length === 1 ? 'reagiu' : 'reagiram'} ${porque} (${golpe.nome} de ${nomeDoToken(golpe.atacanteTokenId)})`
      const linhaId = novoIdDeLinha()
      const linha: LinhaNova = { id: linhaId, tipo: 'reacao', texto, tokenIds: [...new Set([golpe.atacanteTokenId, ...resolvidos.map((alvo) => alvo.tokenId)])], reversao: { tipo: 'composta', partes } }
      const personagemIds = resolvidos.flatMap((alvo) => (alvo.personagemId === null ? [] : [alvo.personagemId]))
      if (personagemIds.length > 0) linha.personagemIds = personagemIds
      // A ficha passa pela aventura no meio: grava sobre a cena de agora, com a ordem calculada daqui.
      const atual = cenaDe(sceneKey) ?? cena
      const comOGolpe = { ...atual, registro: linhaAtualizada(atual.registro, golpe.linhaId, textoDoGolpe(golpe, nomeDoToken), []) }
      gravarCena(sceneKey, { ...comMudanca(comOGolpe, novos, linha), efeitos: comEfeitos(atual.efeitos, efeitos) })
      avisarQuemCaiu(sceneKey, MESTRE)
      linhas.push(linhaId)
    }
    return linhas
  }

  return {
    cenas: {},
    anuncio: null,

    ligar: (sceneKey, abertura = {}, inicio) => {
      const { cenas, anuncio } = get()
      const seq = (anuncio?.seq ?? 0) + 1
      const novo: AnuncioDaBatalha = { seq, sceneKey }
      if (abertura.transicao !== undefined) novo.transicao = abertura.transicao
      if (abertura.texto !== undefined) novo.texto = abertura.texto
      const jaLigada = Object.hasOwn(cenas, sceneKey)
      // BATALHA DBT: a cena já está na batalha Dragon Ball. Não liga por cima nem anuncia (a mesma cena nunca fica nas duas).
      if (!jaLigada && deps.outraBatalhaLigada(sceneKey)) return
      if (jaLigada) {
        set({ anuncio: novo })
        return
      }
      // Invocação: o app fechado no meio da batalha deixou lobos salvos (personagem temporário e token).
      // Saem ANTES da ordem, e a carta de um deles que o mestre escolheu não entra.
      const sobras = new Set(mesa.personagens().filter((personagem) => personagem.combate?.invocadoNaCena === sceneKey).map((personagem) => personagem.id))
      if (sobras.size > 0) mesa.limparInvocados?.(sceneKey)
      const semSobras = inicio === undefined || sobras.size === 0 ? inicio : { ...inicio, combatentes: inicio.combatentes.filter((carta) => carta.personagemId === null || !sobras.has(carta.personagemId)) }
      // Conserto das fichas F1 (resposta do Vincent): o Escudo de cada combatente volta cheio. Sem linha: o Iniciar não se desfaz.
      if (semSobras !== undefined) encherOsEscudos(semSobras.combatentes)
      set({ cenas: { ...get().cenas, [sceneKey]: semSobras === undefined ? CENA_NOVA : cenaDoInicio(mesa, semSobras, deps.rolarD20) }, anuncio: novo })
    },

    desligar: (sceneKey) => {
      const { cenas } = get()
      const cena = Object.hasOwn(cenas, sceneKey) ? cenas[sceneKey] : undefined
      // Invocação (decisão 10): o fim da batalha tira os invocados e os personagens temporários (nada vai ao bestiário).
      // Primeiro os da lista; depois a varredura pela marca pega o que sobrou (token tirado à mão, pendência perdida).
      for (const invocado of cena?.turnos.invocados ?? []) mesa.tirarInvocado?.(sceneKey, invocado.personagemId, invocado.tokenId)
      mesa.limparInvocados?.(sceneKey)
      if (cena === undefined) return
      // Conserto das fichas F1: no fim da batalha as formas desligam sozinhas e o cansaço do Overload sai.
      fimDaBatalhaNasFichas(cena.turnos)
      set({ cenas: semACena(get().cenas, sceneKey) })
    },

    zerarCaminhos: (sceneKey) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined || Object.keys(cena.caminhos).length === 0) return
      gravarCena(sceneKey, { ...cena, caminhos: SEM_CAMINHOS, trilhas: SEM_TRILHAS, zerados: cena.zerados + 1, rev: cena.rev + 1 })
    },

    somarCaminho: (sceneKey, tokenId, blocos, casas = []) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined || !Number.isFinite(blocos) || blocos <= 0) return
      const caminhos = { ...cena.caminhos, [tokenId]: (cena.caminhos[tokenId] ?? 0) + blocos }
      const trilhas = { ...cena.trilhas, [tokenId]: somarNaTrilha(cena.trilhas[tokenId] ?? [], casas) }
      const daVez = cartaDaVez(cena.turnos)
      // Invocação: na vez do bando, quem anda é um membro; o "Mov" conta no gasto dele.
      const chave = daVez === null ? null : daVez.bando === undefined ? (daVez.tokenId === tokenId ? daVez.id : null) : membrosDoBando(cena.turnos, daVez).some((membro) => membro.tokenId === tokenId) ? chaveDoGastoDoInvocado(daVez.id, tokenId) : null
      if (chave === null) {
        gravarCena(sceneKey, { ...cena, caminhos, trilhas, rev: cena.rev + 1 })
        return
      }
      // S7: a ficha da carta da vez andou — o "Mov 2/4" conta (e não trava, decisão 6); `turnosRev` sobe para o recorte chegar.
      const gasto = cena.turnos.gastos[chave] ?? GASTO_ZERO
      const turnos: TurnosDaCena = { ...cena.turnos, gastos: { ...cena.turnos.gastos, [chave]: { ...gasto, blocos: gasto.blocos + blocos } } }
      gravarCena(sceneKey, { ...cena, caminhos, trilhas, turnos, rev: cena.rev + 1, turnosRev: cena.turnosRev + 1 })
    },

    ligada: (sceneKey) => Object.hasOwn(get().cenas, sceneKey),

    reset: () => set({ cenas: {}, anuncio: null }),

    retomar: (sceneKey, cena) => {
      if (Object.hasOwn(get().cenas, sceneKey) || deps.outraBatalhaLigada(sceneKey)) return false
      // As animações não voltam (já tocaram); sem `anuncio`, a abertura não toca de novo.
      const { efeitos: _jaTocados, ...semEfeitos } = cena
      set({ cenas: { ...get().cenas, [sceneKey]: semEfeitos } })
      return true
    },

    encerrarSalva: (sceneKey, cena) => {
      if (Object.hasOwn(get().cenas, sceneKey)) return
      for (const invocado of cena.turnos.invocados ?? []) mesa.tirarInvocado?.(sceneKey, invocado.personagemId, invocado.tokenId)
      mesa.limparInvocados?.(sceneKey)
      fimDaBatalhaNasFichas(cena.turnos)
    },

    passarVez: (sceneKey, autor = MESTRE, esperado) => {
      const inicio = cenaDe(sceneKey)
      if (inicio === undefined) return false
      if (esperado !== undefined && (inicio.turnos.vez !== esperado.cartaId || inicio.turnos.rodada !== esperado.rodada)) return false
      const mesaDeAntes = mesaDoRpg()
      const caidosAntes = tokensCaidos(inicio.turnos.cartas, mesaDeAntes.personagens, mesaDeAntes.sistema)
      const previa = passarVezNaOrdem(inicio.turnos, caidosAntes)
      if (previa === null) return false
      // Conserto das fichas F1 (bug 2, P3): na virada, o golpe que ninguém respondeu vira "Não reagiu" ANTES de a vez andar
      // (quem cai com ele não ganha a vez). O da vez que está acabando espera a virada seguinte: o alvo dele ainda não teve tempo.
      let fechados: string[] = []
      if (previa.turnos.rodada !== inicio.turnos.rodada) {
        const daVezQueAcaba = golpesDaVezQueAcaba(inicio)
        fechados = fecharGolpesSemResposta(sceneKey, (golpe) => !daVezQueAcaba.has(golpe.id), 'até a virada da rodada')
      }
      const cena = cenaDe(sceneKey) ?? inicio
      const { turnos } = cena
      const { personagens, sistema } = mesaDoRpg()
      // Sem fechamento a cena não mudou: vale a prévia. Todos caíram no fechamento: a vez anda como andaria antes dele (a batalha não trava).
      const passadaNaOrdem = fechados.length === 0 ? previa : (passarVezNaOrdem(turnos, tokensCaidos(turnos.cartas, personagens, sistema)) ?? passarVezNaOrdem(turnos, caidosAntes))
      if (passadaNaOrdem === null) return false
      // Invocação: a carta do bando que ficou vazia na vez dela sai agora; o Desfazer da vez a põe de volta no lugar.
      const semVazios = semBandosVazios(passadaNaOrdem.turnos, turnos.cartas)
      const passada = semVazios.removidas.length === 0 ? passadaNaOrdem : { ...passadaNaOrdem, turnos: semVazios.turnos, removidas: [...passadaNaOrdem.removidas, ...semVazios.removidas] }
      // Tipos de habilidade F3: na virada, o lembrete das passivas de "rodada N"; no começo da vez, o "a cada turno" do dono.
      // Só o combate muda, e a reversão "vez" guarda o combate de antes e de depois de quem mudou: o Desfazer da vez tira os lembretes.
      const virada = passada.turnos.rodada !== turnos.rodada ? comLembretesDoMomento('rodada', passada.turnos, { personagens, sistema }).turnos : passada.turnos
      const comLembretes = comLembretesDaVez(virada, { personagens, sistema }).turnos
      // Conserto das fichas F1 (bug 3): a linha guarda só o que a vez mudou (o Desfazer volta só isso).
      const mudou = mudancasDaVez(turnos, comLembretes)
      const de = cartaDaVez(turnos)
      const para = cartaDaVez(passada.turnos)
      const virou = passada.turnos.rodada !== turnos.rodada ? ` (rodada ${passada.turnos.rodada})` : ''
      const acabaram = passada.acabaram ?? []
      // F3 (Q4): "· Atordoado acabou em Ilo" no fim da linha da vez.
      const fimDosSelos = acabaram.length === 0 ? '' : ` · ${textoDosQueAcabaram(acabaram, nomeDoTokenNa(turnos, personagens))}`
      // Conserto das fichas F1: +10 SP para quem começa a vez sem ter gastado SP na anterior.
      const sp = spDoComecoDaVez(turnos, comLembretes, autor)
      const linha: LinhaNova = {
        tipo: 'vez',
        autor,
        texto: `${de === null ? `Começou: vez de ${nomeDaCarta(para, personagens)}` : `Vez: ${nomeDaCarta(de, personagens)} → ${nomeDaCarta(para, personagens)}${virou}`}${fimDosSelos}${sp?.texto ?? ''}`,
        tokenIds: [...new Set([de?.tokenId, para?.tokenId].filter((id): id is string => id !== undefined))],
        // Os "Não reagiu" vieram antes da vez (fora de `mudou`); `fechados` diz ao Desfazer da vez quais linhas voltam junto.
        reversao: { tipo: 'vez', antes: { vez: turnos.vez, rodada: turnos.rodada, removidas: passada.removidas, gastos: turnos.gastos }, ...(mudou === undefined ? {} : { mudou }), ...(fechados.length === 0 ? {} : { fechados }), ...(sp === null ? {} : { ficha: sp.ficha }) },
      }
      // A ficha passou pela aventura (o SP): grava sobre a cena de agora.
      const atual = cenaDe(sceneKey) ?? cena
      gravarCena(sceneKey, { ...comMudanca(atual, comLembretes, linha), efeitos: comEfeitos(atual.efeitos, efeitosDosSelos(acabaram)) })
      // F2 (fatia F): a Doença das Trevas e as Chamas Celestes de quem saiu, numa linha própria (com Desfazer).
      fimDaVezDasMecanicas(sceneKey, de, de === null ? undefined : turnos.gastos[de.id], autor)
      return true
    },

    motivoDoAgir: (sceneKey, autor, vez, pedido) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return 'A batalha não está ligada nesta cena'
      const { turnos } = cena
      const contraDe = pedido.tipo === 'concentrar' ? undefined : pedido.contraDe
      const contra = contraDe === undefined ? null : ((turnos.contras ?? []).find((candidato) => candidato.golpeId === contraDe) ?? null)
      if (contraDe !== undefined && contra === null) return 'Esse contra-ataque não existe mais'
      if (contra === null && (vez === null || turnos.vez !== vez.cartaId || turnos.rodada !== vez.rodada)) return 'A vez já passou'
      const carta = contra === null ? cartaDaVez(turnos) : (turnos.cartas.find((candidata) => candidata.tokenId === contra.tokenId) ?? null)
      if (carta === null || carta.bando !== undefined) return 'Não é a vez desta ficha'
      return podeAgir(contextoDaCarta(sceneKey, cena, autor, carta, turnos), pedido)
    },

    darVez: (sceneKey, cartaId) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return false
      const antes = cena.turnos
      const dadaNaOrdem = darVezNaOrdem(antes, cartaId)
      if (dadaNaOrdem === antes) return false
      // Invocação: a carta do bando que ficou vazia na vez dela sai agora; o Desfazer da vez a põe de volta no lugar.
      const { turnos: dada, removidas } = semBandosVazios(dadaNaOrdem, antes.cartas)
      const { personagens, sistema } = mesaDoRpg()
      // Tipos de habilidade F3: o "a cada turno" do dono no começo da vez dada (a reversão "vez" volta o combate).
      const depois = comLembretesDaVez(dada, { personagens, sistema }).turnos
      const para = cartaDaVez(depois)
      const acabaram = selosQueSairam(antes, depois)
      const fimDosSelos = acabaram.length === 0 ? '' : ` · ${textoDosQueAcabaram(acabaram, nomeDoTokenNa(antes, personagens))}`
      const mudou = mudancasDaVez(antes, depois)
      // Conserto das fichas F1: +10 SP para quem começa a vez sem ter gastado SP na anterior.
      const sp = spDoComecoDaVez(antes, depois, MESTRE)
      const linha: LinhaNova = {
        tipo: 'vez',
        texto: `Vez dada a ${nomeDaCarta(para, personagens)}${fimDosSelos}${sp?.texto ?? ''}`,
        tokenIds: para === null ? [] : [para.tokenId],
        reversao: { tipo: 'vez', antes: { vez: antes.vez, rodada: antes.rodada, removidas, gastos: antes.gastos }, ...(mudou === undefined ? {} : { mudou }), ...(sp === null ? {} : { ficha: sp.ficha }) },
      }
      // A ficha passou pela aventura (o SP): grava sobre a cena de agora.
      const atual = cenaDe(sceneKey) ?? cena
      gravarCena(sceneKey, { ...comMudanca(atual, depois, linha), efeitos: comEfeitos(atual.efeitos, efeitosDosSelos(acabaram)) })
      return true
    },

    moverCarta: (sceneKey, cartaId, indice) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return false
      const turnos = moverCartaNaOrdem(cena.turnos, cartaId, indice)
      if (turnos === cena.turnos) return false
      const carta = turnos.cartas.find((candidata) => candidata.id === cartaId)
      const posicao = turnos.cartas.findIndex((candidata) => candidata.id === cartaId) + 1
      const texto = `${nomeDaCarta(carta, mesaDoRpg().personagens)} foi para a posição ${posicao}`
      const ultima = cena.registro[cena.registro.length - 1]
      // Alt + seta repetido: a mesma linha, com a ordem de ANTES do primeiro movimento.
      const mesmaLinha =
        ultima !== undefined &&
        ultima.tipo === 'ordem' &&
        ultima.autor.tipo === 'mestre' &&
        ultima.desfeita === undefined &&
        ultima.reversao.tipo === 'ordem' &&
        carta !== undefined &&
        ultima.envolve.tokenIds.length === 1 &&
        ultima.envolve.tokenIds[0] === carta.tokenId &&
        Date.now() - ultima.quando < JANELA_DO_MOVIMENTO_MS
      if (mesmaLinha) {
        const registro = [...cena.registro]
        registro[registro.length - 1] = { ...ultima, quando: Date.now(), texto: textoDaLinha(texto) }
        gravarCena(sceneKey, { ...cena, turnos, registro, turnosRev: cena.turnosRev + 1 })
        return true
      }
      gravarCena(sceneKey, comMudanca(cena, turnos, { tipo: 'ordem', texto, tokenIds: carta === undefined ? [] : [carta.tokenId], reversao: { tipo: 'ordem', antes: idsDaOrdem(cena.turnos) } }))
      return true
    },

    ordenarPelaAgilidade: (sceneKey) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return false
      const { personagens, sistema } = mesaDoRpg()
      const turnos = ordenarNaOrdem(cena.turnos, agilidadesDasCartas(cena.turnos.cartas, personagens, sistema), deps.rolarD20)
      const rolou = Object.keys(turnos.d20).length > 0
      // O número do d20 não vai no texto: o jogador lê o registro e nunca vê o d20.
      const texto = rolou ? 'Ordem pela Agilidade, empate no 1d20' : 'Ordem pela Agilidade'
      gravarCena(sceneKey, comMudanca(cena, turnos, { tipo: rolou ? 'desempate' : 'ordem', texto, reversao: { tipo: 'ordem', antes: idsDaOrdem(cena.turnos) } }))
      return true
    },

    trocarDesempate: (sceneKey, desempate) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return false
      const turnos = trocarDesempateNaOrdem(cena.turnos, desempate)
      if (turnos === cena.turnos) return false
      gravarCena(sceneKey, comMudanca(cena, turnos, null))
      return true
    },

    incluirCombatente: (sceneKey, token, indice) => {
      const carta = novaCarta(token.id, token.characterId, token.name)
      return mudarTurnos(
        sceneKey,
        (turnos) => incluirCombatenteNaOrdem(turnos, carta, indice),
        () => ({ tipo: 'combatente', texto: `${nomeDaCarta(carta, mesaDoRpg().personagens)} entrou na luta`, tokenIds: [token.id], reversao: { tipo: 'cartaNova', cartaId: carta.id } }),
      )
    },

    tirarCombatente: (sceneKey, tokenId) => {
      const cena = cenaDe(sceneKey)
      // Invocação: a carta do bando não sai assim (todo Desfazer a recriaria sem aviso): saem os membros dela.
      if (cena === undefined || cena.turnos.cartas.some((carta) => carta.tokenId === tokenId && carta.bando !== undefined)) return false
      const { turnos, removidas } = tirarCombatenteDaOrdem(cena.turnos, tokenId)
      const primeira = removidas[0]
      if (primeira === undefined) return false
      // Desfazer volta as partes da última para a primeira: em ordem decrescente aqui, cada uma reentra no lugar certo.
      const partes: Reversao[] = [...removidas].sort((a, b) => b.indice - a.indice).map(({ carta, indice }) => ({ tipo: 'cartaRemovida', carta, indice }))
      const linha: LinhaNova = { tipo: 'combatente', texto: `${nomeDaCarta(primeira.carta, mesaDoRpg().personagens)} saiu da luta`, tokenIds: [tokenId], reversao: { tipo: 'composta', partes } }
      gravarCena(sceneKey, comMudanca(cena, turnos, linha))
      return true
    },

    adicionarCartaExtra: (sceneKey, tokenId, indice, duracao) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return null
      const feito = adicionarCartaExtraNaOrdem(cena.turnos, tokenId, indice, duracao)
      if (feito === null) return null
      const quanto = duracao === 'rodada' ? 'só nesta rodada' : 'em todas as rodadas'
      const texto = `Carta extra de ${nomeDaCarta(feito.carta, mesaDoRpg().personagens)} (${quanto})`
      gravarCena(sceneKey, comMudanca(cena, feito.turnos, { tipo: 'cartaExtra', texto, tokenIds: [tokenId], reversao: { tipo: 'cartaNova', cartaId: feito.carta.id } }))
      return feito.carta.id
    },

    removerCarta: (sceneKey, cartaId) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return false
      const feito = removerCartaDaOrdem(cena.turnos, cartaId)
      // Invocação: a carta do bando não sai assim (todo Desfazer a recriaria sem aviso): saem os membros dela.
      if (feito === null || feito.removida.carta.bando !== undefined) return false
      const { carta, indice } = feito.removida
      const nome = nomeDaCarta(carta, mesaDoRpg().personagens)
      const linha: LinhaNova = {
        tipo: carta.extra === undefined ? 'combatente' : 'cartaExtra',
        texto: carta.extra === undefined ? `${nome} saiu da luta` : `Carta extra de ${nome} saiu`,
        tokenIds: [carta.tokenId],
        reversao: { tipo: 'cartaRemovida', carta, indice },
      }
      gravarCena(sceneKey, comMudanca(cena, feito.turnos, linha))
      return true
    },

    definirRegras: (sceneKey, regras) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return false
      const texto = regras === null ? 'Sem regras do campo' : `Regras do campo: ${regras.nome}`
      gravarCena(sceneKey, comMudanca(cena, cena.turnos, { tipo: 'regras', texto, reversao: { tipo: 'regras', antes: cena.regras } }, regras))
      return true
    },

    normalizarCena: (sceneKey, tokenIdsDaCena) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return
      const turnos = normalizar(cena.turnos, tokenIdsDaCena)
      if (turnos !== cena.turnos) gravarCena(sceneKey, comMudanca(cena, turnos, null))
    },

    trocarEquipe: (personagemId, equipeId) => {
      // Lidos ANTES de trocar, como a foto da aventura de antes: a equipe e o nome não mudam com a troca.
      const equipes = mesa.equipes()
      const personagens = mesa.personagens()
      const antes = equipeDe(personagemId, equipes)
      if ((antes?.id ?? null) === equipeId) return true
      if (!mesa.trocarEquipe(personagemId, equipeId)) return false
      const depois = equipeId === null ? null : (equipes.find((equipe) => equipe.id === equipeId) ?? null)
      const personagem = personagens.find((candidato) => candidato.id === personagemId)
      const texto = `${personagem?.nome ?? 'Personagem'}: ${antes?.nome ?? 'sem equipe'} → ${depois?.nome ?? 'sem equipe'}`
      const cenas = { ...get().cenas }
      for (const { chave, cena, tokenIds } of cenasComOPersonagem(cenas, personagemId)) {
        cenas[chave] = comMudanca(cena, cena.turnos, {
          tipo: 'equipe',
          texto,
          tokenIds,
          personagemIds: [personagemId],
          reversao: { tipo: 'equipe', personagemId, antes: antes?.id ?? null, depois: equipeId },
        })
      }
      set({ cenas })
      return true
    },

    registrarAjuste: (personagemId, antes, depois, autor) => {
      if (antes === depois) return
      const { sistema } = mesaDoRpg()
      const cenas = { ...get().cenas }
      let mudou = false
      for (const { chave, cena, tokenIds } of cenasComOPersonagem(cenas, personagemId)) {
        const registro = registrarAjusteNasLinhas(cena.registro, { antes, depois, autor, sistema, quando: Date.now(), rodada: cena.turnos.rodada, tokenIds })
        if (registro === cena.registro) continue
        cenas[chave] = { ...cena, registro, turnosRev: cena.turnosRev + 1 }
        mudou = true
      }
      if (mudou) set({ cenas })
    },

    desfazer: (sceneKey, linhaId, autor) => {
      const cena = cenaDe(sceneKey)
      const linha = cena?.registro.find((candidata) => candidata.id === linhaId)
      if (cena === undefined || linha === undefined || linha.desfeita !== undefined) return false
      if (autor.tipo === 'jogador' && (linha.autor.tipo !== 'jogador' || linha.autor.playerId !== autor.playerId || !TIPOS_QUE_O_JOGADOR_DESFAZ.has(linha.tipo))) return false
      // F2 (fatia B, Rapid Dash): a linha que nasceu junto (o 2º golpe) sai com esta.
      const juntas = linhasJuntoDe(linha.reversao).flatMap((id) => cena.registro.find((candidata) => candidata.id === id) ?? [])
      // Tipos de habilidade F1: desfazer o golpe desfaz ANTES as reações com técnica a ele (o custo de quem reagiu volta).
      const golpeIds = new Set([linha, ...juntas].flatMap((dela) => golpesDaReversao(dela.reversao)))
      if (golpeIds.size > 0) {
        for (const outra of cena.registro) {
          if (outra.desfeita === undefined && reacoesComTecnicaDe(outra.reversao).some((parte) => golpeIds.has(parte.golpe.id))) desfazerLinha(sceneKey, outra.id, autor)
        }
      }
      for (const junta of [...juntas].reverse()) desfazerLinha(sceneKey, junta.id, autor)
      if (!desfazerLinha(sceneKey, linhaId, autor)) return false
      // Conserto das fichas F1 (bug 2): o Desfazer da vez desfaz junto os "Não reagiu" que a virada dela escreveu,
      // do mais novo para o mais velho. O já desfeito fica como está. (Bug 3: a vez guarda só o que ela mudou, então
      // o "Não reagiu" desfeito sozinho antes não volta com ela.)
      if (linha.reversao.tipo === 'vez') {
        for (const fechado of [...(linha.reversao.fechados ?? [])].reverse()) desfazerLinha(sceneKey, fechado, autor)
      }
      return true
    },

    agir: (sceneKey, autor, vez, pedido) => {
      // F3 (fatia T): Ativar e Desfazer a forma têm caminho próprio (não lançam golpe).
      if (pedido.tipo === 'transformar' || pedido.tipo === 'destransformar') return mudarForma(sceneKey, autor, vez, pedido)
      // F2 (fatia E, Fúria do Dragão): a técnica que sobe de Parte é o Ativar da Parte seguinte, com a ação da técnica.
      const subida = subidaDoPedido(sceneKey, pedido)
      if (subida !== null) return mudarForma(sceneKey, autor, vez, subida)
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return false
      const { turnos } = cena
      const contraDe = pedido.tipo === 'concentrar' ? undefined : pedido.contraDe
      // O contra-ataque (Q6) age fora da vez, pela carta da ficha que o ganhou; o resto, só a carta da vez nesta rodada.
      const contra = contraDe === undefined ? null : ((turnos.contras ?? []).find((candidato) => candidato.golpeId === contraDe) ?? null)
      if (contraDe !== undefined && contra === null) return false
      if (contra === null && (vez === null || turnos.vez !== vez.cartaId || turnos.rodada !== vez.rodada)) return false
      const carta = contra === null ? cartaDaVez(turnos) : (turnos.cartas.find((candidata) => candidata.tokenId === contra.tokenId) ?? null)
      // Invocação: na carta do bando, o mestre age pelo invocado (`agirComInvocado`), nunca pela carta.
      if (carta === null || carta.bando !== undefined) return false
      return agirComACarta(sceneKey, cena, autor, carta, turnos, carta.id, pedido)
    },

    agirComInvocado: (sceneKey, vez, tokenId, pedido) => {
      if ((pedido.tipo !== 'atacar' && pedido.tipo !== 'habilidade') || pedido.contraDe !== undefined) return false
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return false
      const { turnos } = cena
      if (turnos.vez !== vez.cartaId || turnos.rodada !== vez.rodada) return false
      const bando = cartaDaVez(turnos)
      const invocado = bando === null ? undefined : membrosDoBando(turnos, bando).find((membro) => membro.tokenId === tokenId)
      if (bando === null || invocado === undefined) return false
      // O invocado age como se fosse a carta da vez, com o gasto DELE (a Simples de cada um é dele).
      const chave = chaveDoGastoDoInvocado(bando.id, tokenId)
      const carta: CartaDaOrdem = { id: bando.id, tokenId, personagemId: invocado.personagemId, nome: invocado.nome }
      const doInvocado: TurnosDaCena = { ...turnos, gastos: { ...turnos.gastos, [bando.id]: turnos.gastos[chave] ?? GASTO_ZERO } }
      return agirComACarta(sceneKey, cena, MESTRE, carta, doInvocado, chave, pedido)
    },

    invocar: (sceneKey, autor, pedido) => {
      const cena = cenaDe(sceneKey)
      // Mesa sem mapa (a arena) não invoca: não há onde pôr o token.
      if (cena === undefined || mesa.criarInvocado === undefined) return false
      const { turnos } = cena
      const dono = turnos.cartas.find((carta) => carta.tokenId === pedido.tokenId && carta.bando === undefined)
      const daVez = cartaDaVez(turnos)
      if (dono === undefined || dono.personagemId === null || daVez === null || daVez.bando !== undefined) return false
      // Conserto das fichas F1 (S4): Atordoado ou Paralisado só passa a vez, então não invoca.
      if (travaDoToken(turnos.selos, dono.tokenId) !== null) return false
      const personagemId = dono.personagemId
      const { personagens, sistema } = mesaDoRpg()
      const personagem = personagens.find((candidato) => candidato.id === personagemId) ?? null
      const ctx: ContextoDaInvocacao = { personagem, sistema, turnos, acoes: acoesDaCarta({ turnos, carta: daVez, personagem, sistema, regras: cena.regras }) }
      if (motivoDaInvocacao(ctx, pedido) !== null) return false
      const linhaId = novoIdDeLinha()
      const pedida = pedirInvocacao({ ...ctx, autor, donoTokenId: dono.tokenId }, pedido, { pendente: novoIdDeInvocacao(), linha: linhaId })
      if (pedida === null) return false
      // Desfazer de trás para a frente: lembretes, a pendência (e o invocado que veio dela), o SP, a recarga e a carga, a ação.
      const partes: Reversao[] = [
        // A ação só volta se ainda é esta vez: o Cancelar da pendência numa vez depois não zera o gasto de agora.
        { tipo: 'gasto', cartaId: daVez.id, antes: turnos.gastos[daVez.id] ?? null, vez: { cartaId: daVez.id, rodada: turnos.rodada } },
        { tipo: 'combate', personagemId, antes: turnos.combate?.[personagemId] ?? null, depois: pedida.combate },
      ]
      const { custo } = pedida
      if (custo.length > 0) {
        const doCusto = mexerNaFicha(mesa, personagemId, () => custo, quemNaFicha(autor))
        // Bug 11: custo recusado = a invocação não sai.
        if (doCusto === 'recusada') return false
        partes.push(...reversaoDaFicha(personagemId, doCusto))
      }
      partes.push({ tipo: 'invocacaoPedida', pendente: pedida.pendente })
      let novos: TurnosDaCena = {
        ...turnos,
        gastos: { ...turnos.gastos, [daVez.id]: pedida.gasto },
        combate: { ...(turnos.combate ?? {}), [personagemId]: pedida.combate },
        invocacoes: [...(turnos.invocacoes ?? []), pedida.pendente],
      }
      // O custo de HP pode levar o dono abaixo do gatilho de vida (o mesmo ponto do golpe).
      const lembrados = lembrarDepoisDoDano(novos)
      partes.push(...partesDosLembretes(lembrados))
      novos = lembrados.turnos
      // O SP só aparece na linha da ficha de jogador (o de NPC nunca vai à mesa).
      const recurso = pedida.pago === null || sistema === null ? null : (recursoDoCusto(sistema, pedida.pago.recurso)?.nome ?? pedida.pago.recurso.toUpperCase())
      const pago = pedida.pago !== null && personagem !== null && personagem.tipo === 'jogador' ? ` (${pedida.pago.valor} ${recurso ?? ''})` : ''
      const texto = `${nomeDoTokenNa(turnos, personagens)(dono.tokenId)} invocou 1 ${pedida.pendente.nome} com ${pedida.tecnica}${pago}`
      // A ficha passa pela aventura no meio: grava sobre a cena de agora, com a ordem calculada daqui.
      const atual = cenaDe(sceneKey) ?? cena
      gravarCena(sceneKey, comMudanca(atual, novos, { id: linhaId, tipo: 'habilidade', texto, autor, tokenIds: [dono.tokenId], personagemIds: [personagemId], reversao: { tipo: 'composta', partes } }))
      return true
    },

    colocarInvocado: (sceneKey, invocacaoId, onde, ajuste = {}) => {
      const cena = cenaDe(sceneKey)
      const sistema = mesa.sistema()
      if (cena === undefined || sistema === null || mesa.criarInvocado === undefined) return null
      const { turnos } = cena
      const pendente = pendenciaPorId(turnos, invocacaoId)
      if (pendente === null || !Number.isFinite(onde.x) || !Number.isFinite(onde.y) || (onde.piso !== undefined && !Number.isInteger(onde.piso))) return null
      // Decisão 10: o comum pendente de antes do Ultra não entra ao lado dele (o mestre cancela a pendência e o custo volta).
      if (ultraEmCampo(turnos, pendente)) return null
      // Os números do texto, ou os que o mestre ajustou (o Ultra só sugere, decisão 10); torto = nada muda.
      const pedidos = ajuste.numeros ?? pendente.numeros
      const numeros = pedidos === null ? null : numerosValidos(pedidos)
      if (numeros === null) return null
      // "Lobo 1", "Lobo 2", "Lobo 3": os do mesmo dono com o mesmo nome ganham número (a lista "Quem age" e o mapa dizem qual é qual).
      const nome = nomeNumerado(turnos, pendente, nomeDaColocacao(pendente, ajuste.nome))
      const personagem = fichaDoInvocado(sistema, nome, { hp: numeros.hp, dano: numeros.dano }, pendente.donoPersonagemId, sceneKey)
      const token: Token = { id: crypto.randomUUID(), characterId: personagem.id, name: nome, x: onde.x, y: onde.y, size: 1, image: null }
      // A foto só vale embutida (`data:image/...`); `midia:` do cartão quem chama resolve e manda em `ajuste.imageData`.
      const foto = ajuste.imageData === undefined ? pendente.imagem : ajuste.imageData
      if (isTokenPhotoData(foto)) token.imageData = foto
      if (onde.piso !== undefined && onde.piso !== 0) token.piso = onde.piso
      if (!mesa.criarInvocado(sceneKey, personagem, token)) return null
      const linhaId = novoIdDeLinha()
      const invocado = invocadoDaPendencia(pendente, { tokenId: token.id, personagemId: personagem.id, linhaId, nome, numeros })
      let novos: TurnosDaCena = {
        ...turnos,
        invocacoes: (turnos.invocacoes ?? []).filter((candidata) => candidata.id !== pendente.id),
        invocados: [...(turnos.invocados ?? []), invocado],
      }
      // Desfazer de trás para a frente: os comuns voltam, depois o invocado sai e a pendência volta.
      const partes: Reversao[] = [{ tipo: 'invocacaoColocada', pendente, invocado }]
      // Ultra (decisão 10): os comuns do mesmo dono e da mesma técnica saem quando ele entra.
      const saem = comunsQueSaem(turnos, pendente)
      for (const comum of saem) {
        const tirado = tirarDoMapa(mesa, sceneKey, novos, comum)
        novos = tirado.turnos
        partes.push(tirado.parte)
      }
      const personagens = mesa.personagens()
      novos = comBandosEmDia(novos, nomeDoBandoNa(novos, personagens))
      const texto = `${nomeDoTokenNa(turnos, personagens)(pendente.donoTokenId)}: ${nome} entrou no mapa${textoDosQueSairam(saem.map((comum) => comum.nome))}`
      const atual = cenaDe(sceneKey) ?? cena
      gravarCena(sceneKey, comMudanca(atual, novos, { id: linhaId, tipo: 'invocacao', texto, autor: MESTRE, tokenIds: [pendente.donoTokenId, token.id], personagemIds: [pendente.donoPersonagemId], reversao: { tipo: 'composta', partes } }))
      return token.id
    },

    cancelarInvocacao: (sceneKey, invocacaoId) => {
      const cena = cenaDe(sceneKey)
      const pendente = cena === undefined ? null : pendenciaPorId(cena.turnos, invocacaoId)
      if (cena === undefined || pendente === null) return false
      // É o Desfazer da linha do pedido: a pendência sai e o SP, a recarga, a carga e a ação voltam.
      if (cena.registro.some((linha) => linha.id === pendente.linhaId)) return desfazerLinha(sceneKey, pendente.linhaId, MESTRE)
      // A linha do pedido saiu do teto do registro: não há o que devolver, mas a pendência não fica presa.
      const turnos: TurnosDaCena = { ...cena.turnos, invocacoes: (cena.turnos.invocacoes ?? []).filter((candidata) => candidata.id !== pendente.id) }
      const nomeDoDono = nomeDoTokenNa(cena.turnos, mesaDoRpg().personagens)(pendente.donoTokenId)
      const texto = `Mestre cancelou 1 ${pendente.nome} de ${nomeDoDono} (o pedido já saiu do registro: o custo não volta)`
      gravarCena(sceneKey, comMudanca(cena, turnos, { tipo: 'invocacao', texto, tokenIds: [pendente.donoTokenId], personagemIds: [pendente.donoPersonagemId], reversao: { tipo: 'invocacaoCancelada', pendente } }))
      return true
    },

    reagir:(sceneKey, autor, pedido) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return false
      const { turnos } = cena
      const { personagens } = mesaDoRpg()
      const nomeDoToken = nomeDoTokenNa(turnos, personagens)
      if ((pedido.tipo === 'rolar' || pedido.tipo === 'rerolar') && (!Number.isInteger(pedido.modificador) || Math.abs(pedido.modificador) > MODIFICADOR_DA_REACAO_MAX)) return false
      // Reação livre (o botão Reação sem golpe esperando): o d20 para todos e uma linha.
      if (pedido.tipo === 'rolar' && pedido.golpeId === null) {
        if (!turnos.cartas.some((carta) => carta.tokenId === pedido.tokenId)) return false
        // S4: com vantagem ou desvantagem, 2 d20 (fica o maior ou o menor). F2 (revisão da fatia D): preso no Campo, desvantagem.
        const { d20, vantagem } = rolarComVantagem(deps.rolarD20, vantagemDaReacao(pedido.vantagem, selosDoToken(turnos.selos, pedido.tokenId)))
        const total = d20 + pedido.modificador
        const texto = `${nomeDoToken(pedido.tokenId)} reagiu: ${textoDaRolagem(d20, pedido.modificador, total, vantagem)}`
        gravarCena(sceneKey, {
          ...comMudanca(cena, turnos, { tipo: 'reacao', texto, autor, tokenIds: [pedido.tokenId], reversao: { tipo: 'composta', partes: [] } }),
          efeitos: comEfeitos(cena.efeitos, [{ tipo: 'reacao', golpeId: null, tokenId: pedido.tokenId, d20, modificador: pedido.modificador, total }]),
        })
        return true
      }
      const golpe = (turnos.golpes ?? []).find((candidato) => candidato.id === pedido.golpeId)
      const alvo = golpe?.alvos.find((candidato) => candidato.tokenId === pedido.tokenId)
      if (golpe === undefined || alvo === undefined || alvo.danoFinal !== undefined) return false
      // Tipos de habilidade F1: a técnica de reação no lugar do d20 tem linha própria.
      if (pedido.tipo === 'tecnica') return reagirComTecnicaNaCena(sceneKey, cena, golpe, alvo, autor, pedido)
      if (pedido.tipo === 'semDano') return passarSemDanoNaCena(sceneKey, cena, golpe, alvo, autor)
      let novo: GolpeDaBatalha
      const efeitos: EfeitoNovo[] = []
      const partes: Reversao[] = []
      let contras = turnos.contras
      let selos = turnos.selos
      // R1: os turnos depois da marca (os lembretes da marca moram neles); os selos seguem em `selos`.
      let marcados: TurnosDaCena = turnos
      switch (pedido.tipo) {
        case 'rolar':
        case 'rerolar': {
          // Rolar só sem rolagem; Rerolar só com (Ponto Saga é manual, sem limite: decisão 10).
          // Conserto das fichas F1: Overload não erra; o d20 não defende dele (só outra Overload, pela técnica).
          // F2 (revisão da fatia E): Surpresa também não rola (quem espera nela só reage com a técnica que vale contra ela).
          if (!alvo.podeReagir || golpe.overload || golpe.surpresa || (pedido.tipo === 'rolar') !== (alvo.rolagem === undefined)) return false
          // S4: Atordoado ou Paralisado não reage (o golpe que já esperava também não).
          if (travaDoToken(turnos.selos, alvo.tokenId) !== null) return false
          // F2 (revisão da fatia D): quem está preso no Campo de Contenção rola com desvantagem, sem marcar.
          const selosDoAlvo = selosDoToken(turnos.selos, alvo.tokenId)
          const { d20, vantagem } = rolarComVantagem(deps.rolarD20, vantagemDaReacao(pedido.vantagem, selosDoAlvo, golpe))
          // F2 (revisão da fatia E): o Marcado esquiva e contra-ataca com desvantagem (mais um d20, fica o menor); Defender usa o d20.
          const esquiva = esquivaComDesvantagem(selosDoAlvo, vantagem?.modo) ? rolarODadoDaEsquiva(deps.rolarD20, d20) : undefined
          novo = rolarReacao(golpe, alvo.tokenId, pedido.modificador, d20, vantagem, esquiva)
          efeitos.push({ tipo: 'reacao', golpeId: golpe.id, tokenId: alvo.tokenId, d20, modificador: pedido.modificador, total: d20 + pedido.modificador })
          break
        }
        case 'escolher':
        case 'naoReagir':
        case 'passar': {
          let saida: SaidaDaReacao = 'naoReagiu'
          // Depois de rolar, o jogador escolhe entre o que o dado deu: "Não reagir" no 1 natural fugiria do crítico. O mestre pode tudo.
          if (pedido.tipo === 'naoReagir' && alvo.rolagem !== undefined && autor.tipo === 'jogador') return false
          if (pedido.tipo === 'escolher') {
            // F2 (fatia A): Aéreo tira a Esquiva e o Contra-ataque de quem reage.
            // F2 (fatia E, Orgulho dos Ogros): o ogro (menos a Ryoko) só Defende ou Recebe.
            const doAlvo = personagens.find((candidato) => candidato.id === alvo.personagemId)
            const daRaca = doAlvo === undefined ? [] : saidasTiradasDoDono(chavesDoDono(doAlvo))
            if (alvo.rolagem === undefined || daRaca.includes(pedido.saida) || !saidasComOsSelos(saidasDaRolagem(alvo.rolagem), selosDoToken(turnos.selos, alvo.tokenId)).includes(pedido.saida)) return false
            saida = pedido.saida
          }
          // Passar só depois do dado: o golpe inteiro, sem usar a reação; o 1 natural continua crítico.
          if (pedido.tipo === 'passar') {
            if (alvo.rolagem === undefined) return false
            saida = saidaDoPassar(alvo.rolagem.d20)
          }
          novo = resolverAlvo(golpe, alvo.tokenId, saida)
          const semMarca = novo.alvos.find((candidato) => candidato.tokenId === alvo.tokenId)
          if (semMarca === undefined) return false
          // R1: a marca antes do dano (o dobro, a marca da técnica, o lembrete da passiva).
          const acerto = acertoComMarca(mesa, turnos, novo, semMarca)
          marcados = acerto.turnos
          selos = marcados.selos
          novo = golpeComOAlvo(novo, acerto.alvo)
          const resolvido = acerto.alvo
          const feito = danoNoAlvo(mesa, resolvido, golpe, autor)
          // Bug 11: dano recusado = o alvo segue esperando (sem linha nova nem animação).
          if (feito === 'recusada') return false
          partes.push(...feito.partes, ...acerto.partes)
          if (feito.efeito !== null) efeitos.push(feito.efeito)
          // F3 (Q6): o selo do golpe só pega se o golpe acertou este alvo.
          const noAcerto = seloNoAcerto(marcados, golpe, resolvido)
          novo = golpeComOAlvo(novo, noAcerto.alvo)
          const selado = noAcerto.selado
          if (selado !== null) {
            partes.push(selado.parte)
            selos = selado.selos
          }
          // Q6: 20 e Contra-atacar = sem dano e uma ação a mais na hora, fora da vez (Atacar, Habilidade ou Mover).
          if (saida === 'contra' && (contras?.length ?? 0) < CONTRAS_MAX) {
            const ganho: ContraAtaque = { golpeId: golpe.id, tokenId: alvo.tokenId, personagemId: alvo.personagemId, atacanteTokenId: golpe.atacanteTokenId, rodada: turnos.rodada }
            contras = [...(contras ?? []), ganho]
          }
          break
        }
      }
      let novos: TurnosDaCena = { ...marcados, golpes: comGolpe(turnos.golpes, novo) }
      if (contras !== undefined) novos.contras = contras
      if (selos !== undefined) novos.selos = selos
      // Tipos de habilidade F3: o alvo resolvido tomou o dano: o gatilho de vida lê a ficha de agora (a reversão vai na linha do golpe).
      if (partes.length > 0) {
        const lembrados = lembrarDepoisDoDano(novos)
        partes.push(...partesDosLembretes(lembrados))
        novos = lembrados.turnos
      }
      const atual = cenaDe(sceneKey) ?? cena
      const registro = linhaAtualizada(atual.registro, golpe.linhaId, textoDoGolpe(novo, nomeDoToken), partes)
      gravarCena(sceneKey, { ...atual, turnos: novos, registro, efeitos: comEfeitos(atual.efeitos, efeitos), turnosRev: atual.turnosRev + 1 })
      avisarQuemCaiu(sceneKey, autor)
      return true
    },

    darDano: (sceneKey, autor, tokenId, valor) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined || !Number.isInteger(valor) || valor < 1 || valor > DANO_MAX) return false
      // A ficha da ordem, ou o invocado em campo (que não tem carta própria: está no bando).
      const personagemId = personagemDoTokenNa(cena.turnos)(tokenId)
      if (personagemId === undefined || personagemId === null) return false
      // R6: a forma ligada do alvo que reduz o dano recebido (Resiliente: -20%) vale também no dano livre do mestre.
      // S4 (P5): no "Me dar dano" o jogador digita o dano CHEIO; o app desconta a forma e a Determinação (a tela avisa antes).
      let dado = valor
      let reducao = ''
      const partes = mexerNaFicha(
        mesa,
        personagemId,
        (atual, sistema) => {
          const reducoes = reducoesDoDano(atual, sistema)
          dado = danoComAsReducoes(valor, reducoes)
          reducao = reducoes.length === 0 ? '' : ` (${reducoes.map((parte) => `${parte.nome} -${parte.porcento}%`).join(', ')}: de ${valor})`
          return ajustesDoDano(atual, sistema, dado, false)
        },
        quemNaFicha(autor),
      )
      if (partes === null || partes === 'recusada') return false
      const alvo = nomeDoTokenNa(cena.turnos, mesaDoRpg().personagens)(tokenId)
      const atual = cenaDe(sceneKey) ?? cena
      // Invocação (decisão 9): o invocado que o dano levou a 0 sai do mapa e do bando.
      const caidos = semOsCaidos(mesa, sceneKey, atual.turnos)
      const semCaidos = caidos.partes.length === 0 ? caidos.turnos : comBandosEmDia(caidos.turnos, nomeDoBandoNa(caidos.turnos, mesa.personagens()))
      const texto = `${nomeDoAutor(autor)} deu ${dado} de dano em ${alvo}${reducao}${textoDosQueSairam(caidos.nomes)}`
      // Tipos de habilidade F3: o gatilho de vida depois do dano livre (o mesmo ponto do golpe).
      const lembrados = lembrarDepoisDoDano(semCaidos)
      gravarCena(sceneKey, {
        ...comMudanca(atual, lembrados.turnos, { tipo: 'dano', texto, autor, tokenIds: [tokenId], reversao: { tipo: 'composta', partes: [...reversaoDaFicha(personagemId, partes), ...caidos.partes, ...partesDosLembretes(lembrados)] } }),
        efeitos: comEfeitos(atual.efeitos, [{ tipo: 'dano', tokenId, valor: dado, saida: 'direto' }]),
      })
      // F2 (fatia B): o dano livre também pode levar a ficha a 0 (Recuperação Espantosa avisa o mestre).
      avisarQuemCaiu(sceneKey, autor)
      return true
    },

    darAcoesExtras: (sceneKey, cartaId, extras) => {
      const cena = cenaDe(sceneKey)
      const carta = cena?.turnos.cartas.find((candidata) => candidata.id === cartaId)
      if (cena === undefined || carta === undefined) return false
      const antes = cena.turnos.extras[cartaId] ?? null
      const limpas: AcoesExtras | null =
        extras === null ? null : { simples: contadorDeExtra(extras.simples), bonus: contadorDeExtra(extras.bonus), mov: contadorDeExtra(extras.mov), duracao: extras.duracao, rodada: cena.turnos.rodada }
      const valem = limpas !== null && limpas.simples + limpas.bonus + limpas.mov > 0 ? limpas : null
      if (antes === null && valem === null) return false
      const extrasNovas: Record<string, AcoesExtras> = { ...cena.turnos.extras }
      if (valem === null) delete extrasNovas[cartaId]
      else extrasNovas[cartaId] = valem
      const nome = nomeDaCarta(carta, mesaDoRpg().personagens)
      const quanto = valem?.duracao === 'sempre' ? 'em todas as vezes' : 'só nesta vez'
      const texto = valem === null ? `Mestre tirou as ações extras de ${nome}` : `Mestre: ${textoDasExtras(valem)} para ${nome} (${quanto})`
      gravarCena(sceneKey, comMudanca(cena, { ...cena.turnos, extras: extrasNovas }, { tipo: 'acoesExtras', texto, tokenIds: [carta.tokenId], reversao: { tipo: 'acoesExtras', cartaId, antes } }))
      return true
    },

    escolherArmas: (sceneKey, autor, personagemId, armas) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return false
      const tokenIds = [...new Set(cena.turnos.cartas.filter((carta) => carta.personagemId === personagemId).map((carta) => carta.tokenId))]
      const personagem = mesaDoRpg().personagens.find((candidato) => candidato.id === personagemId)
      if (tokenIds.length === 0 || personagem === undefined) return false
      // Q8: troca quando quiser, sempre dentro do limite da ficha; só armas da aba Armas, sem repetir.
      const daFicha = armasDe(personagem)
      const limite = limiteDeArmas(personagem) ?? ARMAS_NA_BATALHA_MAX
      if (new Set(armas).size !== armas.length || armas.length > limite || !armas.every((id) => daFicha.some((arma) => arma.id === id))) return false
      const antes: CombateDoPersonagem | null = cena.turnos.combate?.[personagemId] ?? null
      const base = antes ?? combateVazio()
      if (base.armas !== null && base.armas.length === armas.length && base.armas.every((id, i) => armas[i] === id)) return true
      const nomes = armas.map((id) => daFicha.find((arma) => arma.id === id)?.nome ?? 'arma')
      const lista = nomes.length === 0 ? 'nenhuma arma' : nomes.length === 1 ? (nomes[0] ?? '') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1] ?? ''}`
      const depois: CombateDoPersonagem = { ...base, armas: [...armas] }
      const turnos: TurnosDaCena = { ...cena.turnos, combate: { ...(cena.turnos.combate ?? {}), [personagemId]: depois } }
      // `personagemIds` = o dono das armas: a linha das armas de NPC não sai ao jogador (as armas dele são segredo).
      gravarCena(sceneKey, comMudanca(cena, turnos, { tipo: 'acao', texto: `${personagem.nome} levou ${lista}`, autor, tokenIds, personagemIds: [personagemId], reversao: { tipo: 'combate', personagemId, antes, depois } }))
      return true
    },

    zerarCarga: (sceneKey, autor, personagemId) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return false
      const cartas = cena.turnos.cartas.filter((carta) => carta.personagemId === personagemId)
      const combate = cena.turnos.combate?.[personagemId]
      if (cartas.length === 0 || combate === undefined || combate.carga === 0) return false
      const antes = combate.carga
      const tokenIds = [...new Set(cartas.map((carta) => carta.tokenId))]
      const nome = nomeDaCarta(cartas[0], mesaDoRpg().personagens)
      const { turnos: turnosAntes } = cena
      // C2: concentrou NESTA vez e zerou = não fez nada: a ação do Concentrar volta e ele pode concentrar de novo.
      const daVez = cartaDaVez(turnosAntes)
      const mesmaVez = daVez !== null && daVez.personagemId === personagemId && combate.concentrouEm === chaveDaVez(turnosAntes.rodada, daVez.id)
      const { concentrouEm: _em, concentrouCom: _com, ...semAVez } = combate
      const depois: CombateDoPersonagem = mesmaVez ? { ...semAVez, carga: 0 } : { ...combate, carga: 0 }
      let turnos: TurnosDaCena = { ...turnosAntes, combate: { ...(turnosAntes.combate ?? {}), [personagemId]: depois } }
      // A reversão "combate" volta só o que mudou (a carga, a vez do Concentrar), por campo: nada que outra linha mexeu depois.
      const partes: Reversao[] = [{ tipo: 'combate', personagemId, antes: combate, depois }]
      const devolvida = mesmaVez ? combate.concentrouCom : undefined
      if (daVez !== null && devolvida !== undefined) {
        const gasto = turnosAntes.gastos[daVez.id] ?? GASTO_ZERO
        turnos = { ...turnos, gastos: { ...turnos.gastos, [daVez.id]: { ...gasto, [devolvida.acao]: Math.max(0, gasto[devolvida.acao] - 1) } } }
        partes.push({ tipo: 'acaoDevolvida', cartaId: daVez.id, rodada: turnosAntes.rodada, acao: devolvida.acao, linhaDoConcentrar: devolvida.linhaId })
      }
      const texto = `${nome} zerou a concentração (carga ${antes} → 0)${devolvida === undefined ? '' : ' · a ação do Concentrar voltou'}`
      // `personagemIds` = o dono: a carga de NPC não sai ao jogador (só o mestre e o dono a veem, `dadosDaFaixa`).
      gravarCena(sceneKey, comMudanca(cena, turnos, { tipo: 'acao', texto, autor, tokenIds, personagemIds: [personagemId], reversao: { tipo: 'composta', partes } }))
      return true
    },

    trocarPerfurante: (sceneKey, golpeId, perfurante, perfuracao) => {
      const cena = cenaDe(sceneKey)
      const golpe = cena?.turnos.golpes?.find((candidato) => candidato.id === golpeId)
      const lida = perfuracao === undefined ? undefined : perfuracaoValida(perfuracao)
      if (cena === undefined || golpe === undefined || lida === null) return false
      // 100 = o Perfurante inteiro, que é o golpe sem o campo (a mesma forma de `lancarGolpe`).
      const porcentagem = lida === undefined ? golpe.perfuracao : lida < PERFURACAO_MAX ? lida : undefined
      if (golpe.perfurante === perfurante && golpe.perfuracao === porcentagem) return false
      const { perfuracao: _antiga, ...semPorcentagem } = golpe
      const novo: GolpeDaBatalha = porcentagem === undefined ? { ...semPorcentagem, perfurante } : { ...semPorcentagem, perfurante, perfuracao: porcentagem }
      const registro = linhaAtualizada(cena.registro, golpe.linhaId, textoDoGolpe(novo, nomeDoTokenNa(cena.turnos, mesaDoRpg().personagens)), [])
      gravarCena(sceneKey, { ...cena, turnos: { ...cena.turnos, golpes: comGolpe(cena.turnos.golpes, novo) }, registro, turnosRev: cena.turnosRev + 1 })
      return true
    },

    moverJudge: (sceneKey, x, y) => {
      const cena = cenaDe(sceneKey)
      const judge = lerJudgeNaCena({ x, y })
      if (cena === undefined || judge === null) return false
      if (cena.judge !== undefined && cena.judge.x === judge.x && cena.judge.y === judge.y) return false
      // Sem linha: mover o Judge não é jogada. `turnosRev` sobe para o `batalha.estado` levar a posição nova.
      gravarCena(sceneKey, { ...cena, judge, turnosRev: cena.turnosRev + 1 })
      return true
    },

    porSelo: (sceneKey, tokenId, pedido) => {
      const cena = cenaDe(sceneKey)
      const { personagens, sistema } = mesaDoRpg()
      const selo = seloPedidoValido(pedido, sistema)
      if (cena === undefined || selo === null || !cena.turnos.cartas.some((carta) => carta.tokenId === tokenId)) return false
      const { turnos } = cena
      // Tipos de habilidade F2: a cor do selo à mão vem do sinal dos mods ("Reação +3" = buff).
      // F2 (fatia A): o que o selo faz pelo nome (Cego zera a Percepção) é lido na hora (`bonusDaBatalha`), nada é gravado aqui.
      const novo = criarSelo(tokenId, { ...selo, natureza: naturezaDosMods(selo.mods) }, { id: novoIdDeSelo(), rodada: turnos.rodada, ...ondeNaVez(turnos) })
      const selos = comSeloNovo(turnos.selos, novo)
      if (selos === null) return false
      const texto = `Mestre pôs ${textoDoSeloComMods(novo, sistema)} em ${nomeDoTokenNa(turnos, personagens)(tokenId)}`
      gravarCena(sceneKey, comMudanca(cena, { ...turnos, selos }, { tipo: 'selo', texto, tokenIds: [tokenId], reversao: { tipo: 'selo', seloId: novo.id, antes: null } }))
      return true
    },

    editarSelo: (sceneKey, seloId, pedido) => {
      const selo = seloPedidoValido(pedido, mesaDoRpg().sistema)
      const antes = cenaDe(sceneKey)?.turnos.selos?.find((candidato) => candidato.id === seloId)
      if (selo === null || antes === undefined) return false
      if (antes.nome === selo.nome && antes.turnos === selo.turnos && modsIguais(antes.mods, selo.mods)) return false
      return mudarSelo(sceneKey, seloId, seloEditado(antes, selo))
    },

    tirarSelo: (sceneKey, seloId) => mudarSelo(sceneKey, seloId, null),

    passiva: (sceneKey, autor, pedido) => comAvisoDeQuemCaiu(sceneKey, autor, mudarPassiva(sceneKey, autor, pedido)),

    evoluir: (sceneKey, autor, pedido) => evoluirTecnica(sceneKey, autor, pedido),

    motivoDoEvoluir: (sceneKey, autor, pedido) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return 'A batalha não está ligada nesta cena'
      const personagemId = cena.turnos.cartas.find((candidata) => candidata.tokenId === pedido.tokenId)?.personagemId ?? null
      const { personagens, sistema } = mesaDoRpg()
      const personagem = personagemId === null ? null : (personagens.find((candidato) => candidato.id === personagemId) ?? null)
      return motivoDoEvoluir({ personagem, sistema, turnos: cena.turnos, soNaVez: autor.tipo === 'jogador' }, pedido)
    },

    marcar: (sceneKey, autor, pedido) => marcarOAlvo(sceneKey, autor, pedido),
    ajustar: (sceneKey, autor, pedido) => comAvisoDeQuemCaiu(sceneKey, autor, ajustarNaBatalha(sceneKey, autor, pedido)),
    contador: (sceneKey, autor, pedido) => mexerNoContador(sceneKey, autor, pedido),
  }
}

/**
 * A FÁBRICA (arena, fase 0; treino, T1): uma store de batalha nova, que lê
 * e grava as fichas só pela `mesa` e rola o d20 só por `deps.rolarD20`. Cada
 * chamada é uma store separada, com as cenas dela; só o contador
 * `ultimoSeqDeEfeito` é do módulo (sobe sempre, não atrapalha ninguém).
 */
export function criarBatalhaStore(mesa: MesaDaBatalha, deps: DependenciasDaBatalha): StoreApi<BatalhaState> {
  return createStore<BatalhaState>()((set, get) => estadoDaBatalha(mesa, deps, set, get))
}

/**
 * Uma store de batalha SEM o hook do React (`getState`, `setState`,
 * `subscribe`): a do treino e a do duelo do Worker. A da mesa de verdade e a
 * da arena são esta mesma store com o hook, em `stores/batalhaStore.ts`.
 */
export type LojaDaBatalha = ReturnType<typeof criarBatalhaStore>

/** A cena que nasce do Iniciar: a ordem pela Agilidade (com o desempate escolhido), a vez na primeira que joga, as regras. */
function cenaDoInicio(mesa: MesaDaBatalha, inicio: InicioDaBatalha, rolarD20: () => number): BatalhaDaCena {
  const { personagens, sistema } = fichasDaMesa(mesa)
  const vazios = turnosVazios(inicio.desempate)
  const comCartas: TurnosDaCena = { ...vazios, cartas: [...inicio.combatentes] }
  const ordenados = ordenarNaOrdem(comCartas, agilidadesDasCartas(comCartas.cartas, personagens, sistema), rolarD20)
  const comeco = passarVezNaOrdem(ordenados, tokensCaidos(ordenados.cartas, personagens, sistema))
  // Tipos de habilidade F3: o lembrete das passivas de início do combate (e das que já começam no gatilho: rodada 1, vida baixa).
  // Nunca ativa (decisão 3). Sem linha: o Iniciar não se desfaz.
  const lembrados = comLembretesDoMomento('inicio', comeco?.turnos ?? ordenados, { personagens, sistema }).turnos
  // Conserto das fichas F1 (S4): quem tem a Preparação para a Batalha recebe a pergunta "vai fazer?" no começo.
  const turnos = comLembretesDaPreparacao(lembrados, { personagens, sistema }).turnos
  const cena: BatalhaDaCena = { ...CENA_NOVA, turnos, regras: inicio.regras }
  // F3: o Judge que o Iniciar já trouxe (torto fica de fora; o App põe depois).
  const judge = inicio.judge === undefined ? null : lerJudgeNaCena(inicio.judge)
  if (judge !== null) cena.judge = judge
  return cena
}

type EstadoDaBatalha = Pick<BatalhaState, 'cenas'>

/**
 * S2: o App avisa as pontes (`notifyBatalhaChanged`) quando isto é verdade:
 * uma cena ligou ou desligou, o mestre zerou caminhos, ou a ordem, o
 * registro ou as regras mudaram (`turnosRev`). O caminho que só soma vai com
 * o snapshot do próprio movimento.
 */
export function deveAvisarJogadores(state: EstadoDaBatalha, previous: EstadoDaBatalha): boolean {
  if (state.cenas === previous.cenas) return false
  const chaves = Object.keys(state.cenas)
  if (chaves.length !== Object.keys(previous.cenas).length) return true
  for (const chave of chaves) {
    const antes = previous.cenas[chave]
    const cena = state.cenas[chave]
    if (antes === undefined || cena === undefined) return true
    if (antes.zerados !== cena.zerados || antes.turnosRev !== cena.turnosRev) return true
  }
  return false
}

/** S4: o token da carta da vez na cena (para o anel e o pulso no mapa); `null` fora de batalha ou sem vez. */
export function vezTokenIdDaCena(state: EstadoDaBatalha, sceneKey: string | null): string | null {
  if (sceneKey === null) return null
  const cena = state.cenas[sceneKey]
  return cena === undefined ? null : (cartaDaVez(cena.turnos)?.tokenId ?? null)
}

const SEM_EFEITOS: readonly EfeitoDaBatalha[] = []

/**
 * S5: as animações da cena para o `EfeitosDaBatalha` do mestre (`App.tsx`).
 * Fora de batalha, a MESMA lista vazia (seletor estável).
 */
export function efeitosDaCena(state: EstadoDaBatalha, sceneKey: string | null): readonly EfeitoDaBatalha[] {
  if (sceneKey === null) return SEM_EFEITOS
  return state.cenas[sceneKey]?.efeitos ?? SEM_EFEITOS
}

/**
 * S-J1 (F3): onde o Judge está na cena, para o `PixiCanvas` do mestre;
 * `null` fora de batalha ou antes de o App o pôr. Devolve o MESMO objeto da
 * cena (seletor estável enquanto ele não anda).
 */
export function judgeDaCena(state: EstadoDaBatalha, sceneKey: string | null): JudgeNaCena | null {
  if (sceneKey === null) return null
  return state.cenas[sceneKey]?.judge ?? null
}

/** Ficha que o mestre move: sem personagem, ou de personagem NPC. */
function ehDoMestre(personagemId: string | null, personagens: readonly Personagem[]): boolean {
  if (personagemId === null) return true
  return personagens.find((personagem) => personagem.id === personagemId)?.tipo === 'npc'
}

/**
 * S9 (Q7): o contador do marcador Batalha no livro da mesa — a vez é de NPC
 * (1) mais as reações de NPC esperando. 0 = nada esperando o mestre. Lê os
 * personagens da mesa na hora (o tipo do personagem não mora na batalha).
 * Aqui a `mesa` é obrigatória; a de `stores/batalhaStore.ts` põe a de
 * verdade quando ela falta (a arena passa a dela).
 */
export function esperandoOMestre(state: EstadoDaBatalha, sceneKey: string | null, mesa: MesaDaBatalha): number {
  if (sceneKey === null) return 0
  const cena = state.cenas[sceneKey]
  if (cena === undefined) return 0
  const personagens = mesa.personagens()
  const daVez = cartaDaVez(cena.turnos)
  let esperando = daVez !== null && ehDoMestre(daVez.personagemId, personagens) ? 1 : 0
  for (const golpe of cena.turnos.golpes ?? []) {
    for (const alvo of golpe.alvos) {
      if (alvo.danoFinal === undefined && alvo.podeReagir && ehDoMestre(alvo.personagemId, personagens)) esperando += 1
    }
  }
  return esperando
}
