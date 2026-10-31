import { create } from 'zustand'
import type { Casa } from '../lib/batalha/blocos'
import { somarNaTrilha } from '../lib/batalha/caminhoAndado'
import {
  ARMAS_NA_BATALHA_MAX,
  combateVazio,
  CONTRAS_MAX,
  DANO_MAX,
  EFEITOS_GUARDADOS,
  MODIFICADOR_DA_REACAO_MAX,
  type AlvoDoGolpe,
  type CombateDoPersonagem,
  type ContraAtaque,
  type EfeitoDaBatalha,
  type GolpeDaBatalha,
  type PedidoDeAcao,
  type PedidoDeReacao,
  type AcaoDaForma,
  type FormaNaBatalha,
  type NumeroDaForma,
  type SaidaDaReacao,
  type SeloDaBatalha,
  type SeloPedido,
} from '../lib/batalha/combate'
import { gastarAcao } from '../lib/batalha/acoes'
import { comSeloNovo, criarSelo, novoIdDeSelo, pegaOSelo, seloPedidoValido, textoDoSelo, textoDosQueAcabaram } from '../lib/batalha/selos'
import { ativarForma, desfazerForma, formaDaFicha } from '../lib/batalha/transformacao'
import { equipeDe } from '../lib/batalha/equipes'
import { golpePendente, lancarGolpe, podeAgir, resolverAlvo, rolarReacao, textoDaRolagem, textoDoGolpe, type ContextoDoGolpe } from '../lib/batalha/golpe'
import { lerJudgeNaCena, type JudgeNaCena } from '../lib/batalha/judge'
import { armasDe, limiteDeArmas } from '../lib/batalha/leituraDaFicha'
import { ajustesDoDano, saidaDoPassar, saidasPossiveis } from '../lib/batalha/reacao'
import type { BatalhaEmTurnos, PonteDaBatalha, VezEsperada } from '../lib/batalha/ponte'
import {
  comLinha,
  desfazerFicha,
  marcarDesfeita,
  nomeDoAutor,
  partesDoAjuste,
  novoIdDeLinha,
  proximoSeq,
  registrarAjuste as registrarAjusteNasLinhas,
  reverterTurnos,
  textoDaLinha,
  TIPOS_QUE_O_JOGADOR_DESFAZ,
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
import { aplicarAjustes, NOME_DO_MESTRE, type Ajuste } from '../lib/ajusteDaFicha'
import { secureRollDie } from '../lib/dice'
import type { Personagem } from '../lib/personagem'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import { equipesAtivas, personagensAtivos, sistemaAtivo, useAdventureStore } from './adventureStore'
import { sistemaPorId, useRpgStore } from './rpgStore'

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
 */

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

interface BatalhaState {
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

  // ---- F1: ordem e vez (o mestre chama direto; o jogador só `passarVez` e `desfazer`, pela ponte) ----
  /** "Passar a vez" (pula carta caída, Q3). Com `esperado`, só passa se a vez ainda é aquela: clique duplo não passa duas. */
  passarVez: (sceneKey: string, autor?: AutorDaAcao, esperado?: VezEsperada) => boolean
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
   * "acao" com Desfazer, que volta só a carga. NÃO devolve a ação gasta no
   * Concentrar. Sem carga, ou personagem fora da ordem: `false`.
   */
  zerarCarga: (sceneKey: string, autor: AutorDaAcao, personagemId: string) => boolean
  /** Q4: o mestre liga ou desliga o Perfurante de um golpe que ainda tem alvo esperando (o mestre decide no fim). */
  trocarPerfurante: (sceneKey: string, golpeId: string, perfurante: boolean) => boolean

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
  /** "Pôr selo..." na ficha (com carta na ordem): linha "selo" com reversão `selo` (antes `null`). Teto `SELOS_POR_TOKEN_MAX` por ficha e `SELOS_MAX` na cena. */
  porSelo: (sceneKey: string, tokenId: string, selo: SeloPedido) => boolean
  /** Troca nome e turnos de um selo (o `total` passa a ser os turnos novos): linha "selo" com o de antes. */
  editarSelo: (sceneKey: string, seloId: string, selo: SeloPedido) => boolean
  /** Tira o selo: linha "selo" com o de antes. */
  tirarSelo: (sceneKey: string, seloId: string) => boolean
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
const LADOS_DO_D20 = 20
/** A vez que ainda não gastou nada. */
const GASTO_ZERO: GastoDaVez = { simples: 0, movimento: 0, bonus: 0, blocos: 0 }

function semACena(cenas: Readonly<Record<string, BatalhaDaCena>>, sceneKey: string): Record<string, BatalhaDaCena> {
  const resto: Record<string, BatalhaDaCena> = {}
  for (const [chave, cena] of Object.entries(cenas)) if (chave !== sceneKey) resto[chave] = cena
  return resto
}

/** O sistema e os personagens em uso na mesa (aventura ou pasta). */
function mesaDoRpg(): { personagens: readonly Personagem[]; sistema: SistemaDeRpg | null } {
  const aventura = useAdventureStore.getState()
  const sistema = sistemaPorId(useRpgStore.getState().biblioteca, sistemaAtivo(aventura)) ?? null
  return { personagens: personagensAtivos(aventura), sistema }
}

function rolarD20(): number {
  return secureRollDie(LADOS_DO_D20)
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

/** Desfaz a reversão: a ordem na própria cena; ficha e equipe pela aventura; regras na cópia. */
function desfazerReversao(cena: BatalhaDaCena, reversao: Reversao, autor: AutorDaAcao): Desfeito {
  switch (reversao.tipo) {
    case 'ficha': {
      const { sistema } = mesaDoRpg()
      if (sistema === null) return { cena, emParte: false, ok: false }
      let emParte = false
      const ok = useAdventureStore.getState().ajustarPersonagem(reversao.personagemId, (atual) => {
        const feito = desfazerFicha(atual, sistema, reversao.partes, quemDesfezNaFicha(autor), Date.now())
        emParte = feito.emParte
        return feito.personagem
      })
      return { cena, emParte, ok }
    }
    case 'equipe': {
      const ok = useAdventureStore.getState().trocarEquipe(reversao.personagemId, reversao.antes)
      return { cena, emParte: false, ok }
    }
    case 'regras':
      return { cena: { ...cena, regras: reversao.antes }, emParte: false, ok: true }
    case 'composta': {
      let atual = cena
      let emParte = false
      let ok = true
      // Da última parte para a primeira, como foram feitas ao contrário.
      for (const parte of [...reversao.partes].reverse()) {
        const feito = desfazerReversao(atual, parte, autor)
        atual = feito.cena
        emParte = emParte || feito.emParte
        ok = ok && feito.ok
      }
      return { cena: atual, emParte, ok }
    }
    case 'vez':
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
 * Mexe na ficha pela aventura (o histórico dela cresce em nome de `quem`; a
 * mudança chega ao jogador pelo `syncPersonagens` de sempre). `ajustes`
 * recebe o personagem de AGORA (o Escudo de agora, o SP de agora). Devolve as
 * partes que mudaram (vazio = nada), ou `null` (personagem ou sistema não
 * existe).
 */
function mexerNaFicha(personagemId: string, ajustes: (atual: Personagem, sistema: SistemaDeRpg) => readonly Ajuste[], quem: string): ParteDaFicha[] | null {
  const { sistema } = mesaDoRpg()
  if (sistema === null) return null
  let partes: ParteDaFicha[] | null = null
  useAdventureStore.getState().ajustarPersonagem(personagemId, (atual) => {
    const lista = ajustes(atual, sistema)
    const depois = lista.length === 0 ? atual : aplicarAjustes(atual, sistema, lista, quem, Date.now())
    partes = partesDoAjuste(atual, depois, sistema)
    return depois
  })
  return partes
}

/** O nome que vai no histórico da ficha quando a batalha mexe nela. */
function quemNaFicha(autor: AutorDaAcao): string {
  return nomeDoAutor(autor)
}

/** O personagem de cada ficha na ordem (alvo possível); `undefined` = fora da ordem. */
function personagemDoTokenNa(turnos: TurnosDaCena): (tokenId: string) => string | null | undefined {
  return (tokenId) => turnos.cartas.find((carta) => carta.tokenId === tokenId)?.personagemId
}

/** O nome da ficha para o texto, pela carta dela na ordem. */
function nomeDoTokenNa(turnos: TurnosDaCena, personagens: readonly Personagem[]): (tokenId: string) => string {
  return (tokenId) => nomeDaCarta(turnos.cartas.find((carta) => carta.tokenId === tokenId), personagens)
}

/** A reversão de uma ficha mexida; nada mudou = nenhuma. */
function reversaoDaFicha(personagemId: string, partes: readonly ParteDaFicha[] | null): Reversao[] {
  return partes === null || partes.length === 0 ? [] : [{ tipo: 'ficha', personagemId, partes }]
}

/** A lista com o golpe trocado (ou tirado, se não espera mais ninguém). */
function comGolpe(golpes: readonly GolpeDaBatalha[] | undefined, golpe: GolpeDaBatalha): GolpeDaBatalha[] {
  const outros = (golpes ?? []).filter((candidato) => candidato.id !== golpe.id)
  return golpePendente(golpe) ? [...outros, golpe] : outros
}

/** O dano final do alvo na ficha dele, com o efeito "dano". Golpe perfurante (Q4) não gasta o Escudo. */
function danoNoAlvo(alvo: AlvoDoGolpe, perfurante: boolean, autor: AutorDaAcao): { partes: Reversao[]; efeito: EfeitoNovo | null } {
  if (alvo.danoFinal === undefined || alvo.saida === undefined) return { partes: [], efeito: null }
  const valor = alvo.danoFinal
  const partes = alvo.personagemId === null || valor <= 0 ? null : mexerNaFicha(alvo.personagemId, (atual, sistema) => ajustesDoDano(atual, sistema, valor, perfurante), quemNaFicha(autor))
  // A animação toca sempre (esquiva também: "ESQUIVOU" sobre a ficha).
  return { partes: alvo.personagemId === null ? [] : reversaoDaFicha(alvo.personagemId, partes), efeito: { tipo: 'dano', tokenId: alvo.tokenId, valor, saida: alvo.saida } }
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
 * a ficha fica e volta `null`.
 */
function trocarFicha(personagemId: string, mudar: (atual: Personagem, sistema: SistemaDeRpg) => Personagem | null): ParteDaFicha[] | null {
  const { sistema } = mesaDoRpg()
  if (sistema === null) return null
  let partes: ParteDaFicha[] | null = null
  useAdventureStore.getState().ajustarPersonagem(personagemId, (atual) => {
    const depois = mudar(atual, sistema)
    if (depois === null) return atual
    partes = partesDoAjuste(atual, depois, sistema)
    return depois
  })
  return partes
}

/** Os selos de antes na reversão da vez: só quando a vez os mexeu (senão o Desfazer da vez apagaria selo posto depois). */
function selosDeAntes(antes: TurnosDaCena, depois: TurnosDaCena): { selos?: TurnosDaCena['selos'] } {
  return antes.selos === depois.selos ? {} : { selos: antes.selos ?? [] }
}

/** Um efeito "selo" por selo que acabou ("ATORDOADO ACABOU"). */
function efeitosDosSelos(acabaram: readonly SeloDaBatalha[]): EfeitoNovo[] {
  return acabaram.map((selo): EfeitoNovo => ({ tipo: 'selo', tokenId: selo.tokenId, nome: selo.nome, acabou: true }))
}

/** Q6: o selo do golpe no alvo que ele ACERTOU (resolvido com saída que pega). Sem selo, sem acerto ou no teto: `null`. */
function seloDoGolpe(turnos: TurnosDaCena, golpe: GolpeDaBatalha, alvo: AlvoDoGolpe): { selos: SeloDaBatalha[]; parte: Reversao } | null {
  if (golpe.selo === undefined || alvo.saida === undefined || !pegaOSelo(alvo.saida)) return null
  const selo = criarSelo(alvo.tokenId, golpe.selo, { id: novoIdDeSelo(), rodada: turnos.rodada, tokenDaVez: cartaDaVez(turnos)?.tokenId ?? null, origem: golpe.nome })
  const selos = comSeloNovo(turnos.selos, selo)
  return selos === null ? null : { selos, parte: { tipo: 'selo', seloId: selo.id, antes: null } }
}

const ROTULO_DA_ACAO_DA_FORMA: Readonly<Record<AcaoDaForma, string>> = { simples: 'Simples', completa: 'Completa', bonus: 'Bônus' }

/** "+1 Simples, +1 Bônus". */
function textoDasExtras(extras: AcoesExtras): string {
  const partes = [extras.simples > 0 ? `+${extras.simples} Simples` : null, extras.bonus > 0 ? `+${extras.bonus} Bônus` : null, extras.mov > 0 ? `+${extras.mov} Movimento` : null]
  return partes.filter((parte): parte is string => parte !== null).join(', ')
}

const EXTRAS_MAX = 20

function contadorDeExtra(valor: number): number {
  return Number.isFinite(valor) ? Math.min(EXTRAS_MAX, Math.max(0, Math.trunc(valor))) : 0
}

export const useBatalhaStore = create<BatalhaState>()((set, get) => {
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
   * F3 (fatia T): Ativar a forma (gasta a ação escolhida, liga o cartão, o
   * atual ganha a diferença do máximo, Q1) ou Desfazer a forma (ação livre).
   * Só na vez da carta. A ficha muda pela aventura; a linha "transformacao"
   * leva a reversão composta [gasto, ficha, forma] e o texto sem números.
   */
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
      const fichaMudou = trocarFicha(personagemId, (atual, sistemaDaMesa) => {
        const feito = ativarForma(atual, sistemaDaMesa, pedido.cartaoId, quem, Date.now())
        if (feito !== null) numeros = feito.numeros
        return feito?.personagem ?? null
      })
      if (fichaMudou === null) return false
      partes.push({ tipo: 'gasto', cartaId: carta.id, antes: turnos.gastos[carta.id] ?? null })
      novos = { ...novos, gastos: { ...novos.gastos, [carta.id]: gastarAcao(turnos.gastos[carta.id] ?? GASTO_ZERO, pedido.acao) } }
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
      texto = `${quemAge} ativa ${nomeDaForma} (${ROTULO_DA_ACAO_DA_FORMA[pedido.acao]})`
    } else {
      const fichaMudou = trocarFicha(personagemId, (atual, sistemaDaMesa) => desfazerForma(atual, sistemaDaMesa, pedido.cartaoId, quem, Date.now()))
      if (fichaMudou === null) return false
      partes.push(...reversaoDaFicha(personagemId, fichaMudou))
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

  /** O selo trocado (`depois`) ou tirado (`null`), com a linha "selo" do mestre. */
  const mudarSelo = (sceneKey: string, seloId: string, depois: SeloDaBatalha | null): boolean => {
    const cena = cenaDe(sceneKey)
    const antes = cena?.turnos.selos?.find((selo) => selo.id === seloId)
    if (cena === undefined || antes === undefined) return false
    const selos = (cena.turnos.selos ?? []).flatMap((selo) => (selo.id !== seloId ? [selo] : depois === null ? [] : [depois]))
    const nome = nomeDoTokenNa(cena.turnos, mesaDoRpg().personagens)(antes.tokenId)
    const texto = depois === null ? `Mestre tirou ${textoDoSelo(antes)} de ${nome}` : `Mestre: ${textoDoSelo(antes)} → ${textoDoSelo(depois)} em ${nome}`
    gravarCena(sceneKey, comMudanca(cena, { ...cena.turnos, selos }, { tipo: 'selo', texto, tokenIds: [antes.tokenId], reversao: { tipo: 'selo', seloId, antes } }))
    return true
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
      if (jaLigada) {
        set({ anuncio: novo })
        return
      }
      set({ cenas: { ...cenas, [sceneKey]: inicio === undefined ? CENA_NOVA : cenaDoInicio(inicio) }, anuncio: novo })
    },

    desligar: (sceneKey) => {
      const { cenas } = get()
      if (!Object.hasOwn(cenas, sceneKey)) return
      set({ cenas: semACena(cenas, sceneKey) })
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
      if (daVez === null || daVez.tokenId !== tokenId) {
        gravarCena(sceneKey, { ...cena, caminhos, trilhas, rev: cena.rev + 1 })
        return
      }
      // S7: a ficha da carta da vez andou — o "Mov 2/4" conta (e não trava, decisão 6); `turnosRev` sobe para o recorte chegar.
      const gasto = cena.turnos.gastos[daVez.id] ?? { simples: 0, movimento: 0, bonus: 0, blocos: 0 }
      const turnos: TurnosDaCena = { ...cena.turnos, gastos: { ...cena.turnos.gastos, [daVez.id]: { ...gasto, blocos: gasto.blocos + blocos } } }
      gravarCena(sceneKey, { ...cena, caminhos, trilhas, turnos, rev: cena.rev + 1, turnosRev: cena.turnosRev + 1 })
    },

    ligada: (sceneKey) => Object.hasOwn(get().cenas, sceneKey),

    reset: () => set({ cenas: {}, anuncio: null }),

    passarVez: (sceneKey, autor = MESTRE, esperado) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return false
      const { turnos } = cena
      if (esperado !== undefined && (turnos.vez !== esperado.cartaId || turnos.rodada !== esperado.rodada)) return false
      const { personagens, sistema } = mesaDoRpg()
      const passada = passarVezNaOrdem(turnos, tokensCaidos(turnos.cartas, personagens, sistema))
      if (passada === null) return false
      const de = cartaDaVez(turnos)
      const para = cartaDaVez(passada.turnos)
      const virou = passada.turnos.rodada !== turnos.rodada ? ` (rodada ${passada.turnos.rodada})` : ''
      const acabaram = passada.acabaram ?? []
      // F3 (Q4): "· Atordoado acabou em Ilo" no fim da linha da vez.
      const fimDosSelos = acabaram.length === 0 ? '' : ` · ${textoDosQueAcabaram(acabaram, nomeDoTokenNa(turnos, personagens))}`
      const linha: LinhaNova = {
        tipo: 'vez',
        autor,
        texto: `${de === null ? `Começou: vez de ${nomeDaCarta(para, personagens)}` : `Vez: ${nomeDaCarta(de, personagens)} → ${nomeDaCarta(para, personagens)}${virou}`}${fimDosSelos}`,
        tokenIds: [...new Set([de?.tokenId, para?.tokenId].filter((id): id is string => id !== undefined))],
        reversao: { tipo: 'vez', antes: { vez: turnos.vez, rodada: turnos.rodada, removidas: passada.removidas, gastos: turnos.gastos, extras: turnos.extras, combate: turnos.combate ?? {}, ...selosDeAntes(turnos, passada.turnos) } },
      }
      gravarCena(sceneKey, { ...comMudanca(cena, passada.turnos, linha), efeitos: comEfeitos(cena.efeitos, efeitosDosSelos(acabaram)) })
      return true
    },

    darVez: (sceneKey, cartaId) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return false
      const antes = cena.turnos
      const depois = darVezNaOrdem(antes, cartaId)
      if (depois === antes) return false
      const { personagens } = mesaDoRpg()
      const para = cartaDaVez(depois)
      const acabaram = selosQueSairam(antes, depois)
      const fimDosSelos = acabaram.length === 0 ? '' : ` · ${textoDosQueAcabaram(acabaram, nomeDoTokenNa(antes, personagens))}`
      const linha: LinhaNova = {
        tipo: 'vez',
        texto: `Vez dada a ${nomeDaCarta(para, personagens)}${fimDosSelos}`,
        tokenIds: para === null ? [] : [para.tokenId],
        reversao: { tipo: 'vez', antes: { vez: antes.vez, rodada: antes.rodada, removidas: [], gastos: antes.gastos, extras: antes.extras, combate: antes.combate ?? {}, ...selosDeAntes(antes, depois) } },
      }
      gravarCena(sceneKey, { ...comMudanca(cena, depois, linha), efeitos: comEfeitos(cena.efeitos, efeitosDosSelos(acabaram)) })
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
      const turnos = ordenarNaOrdem(cena.turnos, agilidadesDasCartas(cena.turnos.cartas, personagens, sistema), rolarD20)
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
      if (cena === undefined) return false
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
      if (feito === null) return false
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
      const aventura = useAdventureStore.getState()
      const equipes = equipesAtivas(aventura)
      const antes = equipeDe(personagemId, equipes)
      if ((antes?.id ?? null) === equipeId) return true
      if (!aventura.trocarEquipe(personagemId, equipeId)) return false
      const depois = equipeId === null ? null : (equipes.find((equipe) => equipe.id === equipeId) ?? null)
      const personagem = personagensAtivos(aventura).find((candidato) => candidato.id === personagemId)
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
      const feito = desfazerReversao(cena, linha.reversao, autor)
      if (!feito.ok) return false
      const por = `${nomeDoAutor(autor)}${feito.emParte ? ' (em parte)' : ''}`
      // A cena de agora: o Desfazer da ficha passa pela aventura, e a store pode ter mudado no meio.
      const atual = cenaDe(sceneKey) ?? cena
      // F3: o desfazer do MESTRE faz o Judge erguer a carta em todas as telas; o do jogador, não.
      const efeitos = autor.tipo === 'mestre' ? comEfeitos(atual.efeitos, [{ tipo: 'judge', gesto: 'carta' }]) : atual.efeitos
      gravarCena(sceneKey, { ...atual, turnos: feito.cena.turnos, regras: feito.cena.regras, registro: marcarDesfeita(atual.registro, linhaId, por, Date.now()), efeitos, turnosRev: atual.turnosRev + 1 })
      return true
    },

    agir: (sceneKey, autor, vez, pedido) => {
      // F3 (fatia T): Ativar e Desfazer a forma têm caminho próprio (não lançam golpe).
      if (pedido.tipo === 'transformar' || pedido.tipo === 'destransformar') return mudarForma(sceneKey, autor, vez, pedido)
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return false
      const { turnos } = cena
      const contraDe = pedido.tipo === 'concentrar' ? undefined : pedido.contraDe
      // O contra-ataque (Q6) age fora da vez, pela carta da ficha que o ganhou; o resto, só a carta da vez nesta rodada.
      const contra = contraDe === undefined ? null : ((turnos.contras ?? []).find((candidato) => candidato.golpeId === contraDe) ?? null)
      if (contraDe !== undefined && contra === null) return false
      if (contra === null && (vez === null || turnos.vez !== vez.cartaId || turnos.rodada !== vez.rodada)) return false
      const carta = contra === null ? cartaDaVez(turnos) : (turnos.cartas.find((candidata) => candidata.tokenId === contra.tokenId) ?? null)
      if (carta === null) return false
      const { personagens, sistema } = mesaDoRpg()
      const personagem = carta.personagemId === null ? null : (personagens.find((candidato) => candidato.id === carta.personagemId) ?? null)
      const ctx: ContextoDoGolpe = { turnos, carta, personagem, sistema, regras: cena.regras, autor, personagens, personagemDoToken: personagemDoTokenNa(turnos) }
      if (podeAgir(ctx, pedido) !== null) return false
      const linhaId = novoIdDeLinha()
      const lancado = lancarGolpe(ctx, pedido, { golpe: novoIdDeGolpe(), linha: linhaId })
      const quem = quemNaFicha(autor)
      // A ordem da reversão é a da seção 3.6: gasto, combate, custo, contra-ataque, golpe, fichas dos alvos.
      const partes: Reversao[] = []
      let novos: TurnosDaCena = turnos
      if (lancado.gasto !== null) {
        partes.push({ tipo: 'gasto', cartaId: carta.id, antes: turnos.gastos[carta.id] ?? null })
        novos = { ...novos, gastos: { ...novos.gastos, [carta.id]: lancado.gasto } }
      }
      if (lancado.combate !== null && carta.personagemId !== null) {
        partes.push({ tipo: 'combate', personagemId: carta.personagemId, antes: turnos.combate?.[carta.personagemId] ?? null })
        novos = { ...novos, combate: { ...(novos.combate ?? {}), [carta.personagemId]: lancado.combate } }
      }
      if (lancado.custo.length > 0 && carta.personagemId !== null) {
        const custo = lancado.custo
        partes.push(...reversaoDaFicha(carta.personagemId, mexerNaFicha(carta.personagemId, () => custo, quem)))
      }
      if (lancado.contraUsado !== null) {
        const usado = lancado.contraUsado
        partes.push({ tipo: 'contra', contra: usado })
        novos = { ...novos, contras: (novos.contras ?? []).filter((candidato) => !(candidato.golpeId === usado.golpeId && candidato.tokenId === usado.tokenId)) }
      }
      const efeitos: EfeitoNovo[] = []
      const { golpe } = lancado
      if (golpe !== null) {
        partes.push({ tipo: 'golpe', golpeId: golpe.id })
        efeitos.push({ tipo: 'golpe', golpeId: golpe.id, atacanteTokenId: golpe.atacanteTokenId, nome: golpe.nome, alvos: golpe.alvos.map((alvo) => alvo.tokenId), surpresa: golpe.surpresa, overload: golpe.overload })
        for (const alvo of lancado.resolvidos) {
          const feito = danoNoAlvo(alvo, golpe.perfurante, autor)
          partes.push(...feito.partes)
          if (feito.efeito !== null) efeitos.push(feito.efeito)
          // F3 (Q6): o selo do golpe pega no alvo que ele acertou.
          const selado = seloDoGolpe(novos, golpe, alvo)
          if (selado !== null) {
            partes.push(selado.parte)
            novos = { ...novos, selos: selado.selos }
          }
        }
        novos = { ...novos, golpes: comGolpe(novos.golpes, golpe) }
      }
      const nomeDoToken = nomeDoTokenNa(turnos, personagens)
      const quemAge = nomeDoToken(carta.tokenId)
      let texto: string
      let tipo: TipoDaLinha
      if (golpe !== null) {
        texto = textoDoGolpe(golpe, nomeDoToken)
        tipo = pedido.tipo === 'habilidade' ? 'habilidade' : 'golpe'
      } else if (pedido.tipo === 'concentrar') {
        texto = `${quemAge} concentrou (carga ${lancado.combate?.carga ?? 0})`
        tipo = 'acao'
      } else {
        texto = `${quemAge} usou o contra-ataque para se mover`
        tipo = 'acao'
      }
      const tokenIds = [...new Set([carta.tokenId, ...(golpe?.alvos.map((alvo) => alvo.tokenId) ?? [])])]
      // A ficha passa pela aventura no meio: grava sobre a cena de agora, com a ordem calculada daqui.
      const atual = cenaDe(sceneKey) ?? cena
      gravarCena(sceneKey, {
        ...comMudanca(atual, novos, { id: linhaId, tipo, texto, autor, tokenIds, reversao: { tipo: 'composta', partes } }),
        efeitos: comEfeitos(atual.efeitos, efeitos),
      })
      return true
    },

    reagir: (sceneKey, autor, pedido) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return false
      const { turnos } = cena
      const { personagens } = mesaDoRpg()
      const nomeDoToken = nomeDoTokenNa(turnos, personagens)
      if ((pedido.tipo === 'rolar' || pedido.tipo === 'rerolar') && (!Number.isInteger(pedido.modificador) || Math.abs(pedido.modificador) > MODIFICADOR_DA_REACAO_MAX)) return false
      // Reação livre (o botão Reação sem golpe esperando): o d20 para todos e uma linha.
      if (pedido.tipo === 'rolar' && pedido.golpeId === null) {
        if (!turnos.cartas.some((carta) => carta.tokenId === pedido.tokenId)) return false
        const d20 = rolarD20()
        const total = d20 + pedido.modificador
        const texto = `${nomeDoToken(pedido.tokenId)} reagiu: ${textoDaRolagem(d20, pedido.modificador, total)}`
        gravarCena(sceneKey, {
          ...comMudanca(cena, turnos, { tipo: 'reacao', texto, autor, tokenIds: [pedido.tokenId], reversao: { tipo: 'composta', partes: [] } }),
          efeitos: comEfeitos(cena.efeitos, [{ tipo: 'reacao', golpeId: null, tokenId: pedido.tokenId, d20, modificador: pedido.modificador, total }]),
        })
        return true
      }
      const golpe = (turnos.golpes ?? []).find((candidato) => candidato.id === pedido.golpeId)
      const alvo = golpe?.alvos.find((candidato) => candidato.tokenId === pedido.tokenId)
      if (golpe === undefined || alvo === undefined || alvo.danoFinal !== undefined) return false
      let novo: GolpeDaBatalha
      const efeitos: EfeitoNovo[] = []
      const partes: Reversao[] = []
      let contras = turnos.contras
      let selos = turnos.selos
      switch (pedido.tipo) {
        case 'rolar':
        case 'rerolar': {
          // Rolar só sem rolagem; Rerolar só com (Ponto Saga é manual, sem limite: decisão 10).
          if (!alvo.podeReagir || (pedido.tipo === 'rolar') !== (alvo.rolagem === undefined)) return false
          const d20 = rolarD20()
          novo = rolarReacao(golpe, alvo.tokenId, pedido.modificador, d20)
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
            if (alvo.rolagem === undefined || !saidasPossiveis(alvo.rolagem.d20, alvo.rolagem.total).includes(pedido.saida)) return false
            saida = pedido.saida
          }
          // Passar só depois do dado: o golpe inteiro, sem usar a reação; o 1 natural continua crítico.
          if (pedido.tipo === 'passar') {
            if (alvo.rolagem === undefined) return false
            saida = saidaDoPassar(alvo.rolagem.d20)
          }
          novo = resolverAlvo(golpe, alvo.tokenId, saida)
          const resolvido = novo.alvos.find((candidato) => candidato.tokenId === alvo.tokenId)
          if (resolvido === undefined) return false
          const feito = danoNoAlvo(resolvido, golpe.perfurante, autor)
          partes.push(...feito.partes)
          if (feito.efeito !== null) efeitos.push(feito.efeito)
          // F3 (Q6): o selo do golpe só pega se o golpe acertou este alvo.
          const selado = seloDoGolpe(turnos, golpe, resolvido)
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
      const novos: TurnosDaCena = { ...turnos, golpes: comGolpe(turnos.golpes, novo) }
      if (contras !== undefined) novos.contras = contras
      if (selos !== undefined) novos.selos = selos
      const atual = cenaDe(sceneKey) ?? cena
      const registro = linhaAtualizada(atual.registro, golpe.linhaId, textoDoGolpe(novo, nomeDoToken), partes)
      gravarCena(sceneKey, { ...atual, turnos: novos, registro, efeitos: comEfeitos(atual.efeitos, efeitos), turnosRev: atual.turnosRev + 1 })
      return true
    },

    darDano: (sceneKey, autor, tokenId, valor) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined || !Number.isInteger(valor) || valor < 1 || valor > DANO_MAX) return false
      const carta = cena.turnos.cartas.find((candidata) => candidata.tokenId === tokenId)
      if (carta === undefined || carta.personagemId === null) return false
      const personagemId = carta.personagemId
      const partes = mexerNaFicha(personagemId, (atual, sistema) => ajustesDoDano(atual, sistema, valor, false), quemNaFicha(autor))
      if (partes === null) return false
      const alvo = nomeDaCarta(carta, mesaDoRpg().personagens)
      const texto = `${nomeDoAutor(autor)} deu ${valor} de dano em ${alvo}`
      const atual = cenaDe(sceneKey) ?? cena
      gravarCena(sceneKey, {
        ...comMudanca(atual, atual.turnos, { tipo: 'dano', texto, autor, tokenIds: [tokenId], reversao: { tipo: 'composta', partes: reversaoDaFicha(personagemId, partes) } }),
        efeitos: comEfeitos(atual.efeitos, [{ tipo: 'dano', tokenId, valor, saida: 'direto' }]),
      })
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
      const turnos: TurnosDaCena = { ...cena.turnos, combate: { ...(cena.turnos.combate ?? {}), [personagemId]: { ...base, armas: [...armas] } } }
      // `personagemIds` = o dono das armas: a linha das armas de NPC não sai ao jogador (as armas dele são segredo).
      gravarCena(sceneKey, comMudanca(cena, turnos, { tipo: 'acao', texto: `${personagem.nome} levou ${lista}`, autor, tokenIds, personagemIds: [personagemId], reversao: { tipo: 'combate', personagemId, antes } }))
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
      // Só a carga: o `concentrouEm` fica (a ação gasta não volta, e ele não concentra de novo nesta vez).
      const turnos: TurnosDaCena = { ...cena.turnos, combate: { ...(cena.turnos.combate ?? {}), [personagemId]: { ...combate, carga: 0 } } }
      // `personagemIds` = o dono: a carga de NPC não sai ao jogador (só o mestre e o dono a veem, `dadosDaFaixa`).
      gravarCena(sceneKey, comMudanca(cena, turnos, { tipo: 'acao', texto: `${nome} zerou a concentração (carga ${antes} → 0)`, autor, tokenIds, personagemIds: [personagemId], reversao: { tipo: 'carga', personagemId, antes } }))
      return true
    },

    trocarPerfurante: (sceneKey, golpeId, perfurante) => {
      const cena = cenaDe(sceneKey)
      const golpe = cena?.turnos.golpes?.find((candidato) => candidato.id === golpeId)
      if (cena === undefined || golpe === undefined || golpe.perfurante === perfurante) return false
      const novo: GolpeDaBatalha = { ...golpe, perfurante }
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
      const selo = seloPedidoValido(pedido)
      if (cena === undefined || selo === null || !cena.turnos.cartas.some((carta) => carta.tokenId === tokenId)) return false
      const { turnos } = cena
      const novo = criarSelo(tokenId, selo, { id: novoIdDeSelo(), rodada: turnos.rodada, tokenDaVez: cartaDaVez(turnos)?.tokenId ?? null })
      const selos = comSeloNovo(turnos.selos, novo)
      if (selos === null) return false
      const texto = `Mestre pôs ${textoDoSelo(novo)} em ${nomeDoTokenNa(turnos, mesaDoRpg().personagens)(tokenId)}`
      gravarCena(sceneKey, comMudanca(cena, { ...turnos, selos }, { tipo: 'selo', texto, tokenIds: [tokenId], reversao: { tipo: 'selo', seloId: novo.id, antes: null } }))
      return true
    },

    editarSelo: (sceneKey, seloId, pedido) => {
      const selo = seloPedidoValido(pedido)
      const antes = cenaDe(sceneKey)?.turnos.selos?.find((candidato) => candidato.id === seloId)
      if (selo === null || antes === undefined) return false
      if (antes.nome === selo.nome && antes.turnos === selo.turnos) return false
      // Turnos novos = o total novo; a marca "já contou nesta rodada" fica.
      return mudarSelo(sceneKey, seloId, { ...antes, nome: selo.nome, turnos: selo.turnos, total: selo.turnos })
    },

    tirarSelo: (sceneKey, seloId) => mudarSelo(sceneKey, seloId, null),
  }
})

/** A cena que nasce do Iniciar: a ordem pela Agilidade (com o desempate escolhido), a vez na primeira que joga, as regras. */
function cenaDoInicio(inicio: InicioDaBatalha): BatalhaDaCena {
  const { personagens, sistema } = mesaDoRpg()
  const vazios = turnosVazios(inicio.desempate)
  const comCartas: TurnosDaCena = { ...vazios, cartas: [...inicio.combatentes] }
  const ordenados = ordenarNaOrdem(comCartas, agilidadesDasCartas(comCartas.cartas, personagens, sistema), rolarD20)
  const comeco = passarVezNaOrdem(ordenados, tokensCaidos(ordenados.cartas, personagens, sistema))
  const cena: BatalhaDaCena = { ...CENA_NOVA, turnos: comeco?.turnos ?? ordenados, regras: inicio.regras }
  // F3: o Judge que o Iniciar já trouxe (torto fica de fora; o App põe depois).
  const judge = inicio.judge === undefined ? null : lerJudgeNaCena(inicio.judge)
  if (judge !== null) cena.judge = judge
  return cena
}

/**
 * A ponte que o host usa (S1: `App.tsx` a passa às duas pontes como
 * `ponteDaBatalha`). Lê e muda pela store; o host já validou quem pede.
 */
export const ponteDaBatalha: PonteDaBatalha = {
  cena: (sceneKey) => useBatalhaStore.getState().cenas[sceneKey] ?? null,
  passarVez: (sceneKey, autor, esperado) => useBatalhaStore.getState().passarVez(sceneKey, autor, esperado),
  desfazer: (sceneKey, linhaId, autor) => useBatalhaStore.getState().desfazer(sceneKey, linhaId, autor),
  registrarAjuste: (personagemId, antes, depois, autor) => useBatalhaStore.getState().registrarAjuste(personagemId, antes, depois, autor),
  agir: (sceneKey, autor, vez, pedido) => useBatalhaStore.getState().agir(sceneKey, autor, vez, pedido),
  reagir: (sceneKey, autor, pedido) => useBatalhaStore.getState().reagir(sceneKey, autor, pedido),
  darDano: (sceneKey, autor, tokenId, valor) => useBatalhaStore.getState().darDano(sceneKey, autor, tokenId, valor),
  escolherArmas: (sceneKey, autor, personagemId, armas) => useBatalhaStore.getState().escolherArmas(sceneKey, autor, personagemId, armas),
  zerarCarga: (sceneKey, autor, personagemId) => useBatalhaStore.getState().zerarCarga(sceneKey, autor, personagemId),
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
 */
export function esperandoOMestre(state: EstadoDaBatalha, sceneKey: string | null): number {
  if (sceneKey === null) return 0
  const cena = state.cenas[sceneKey]
  if (cena === undefined) return 0
  const { personagens } = mesaDoRpg()
  const daVez = cartaDaVez(cena.turnos)
  let esperando = daVez !== null && ehDoMestre(daVez.personagemId, personagens) ? 1 : 0
  for (const golpe of cena.turnos.golpes ?? []) {
    for (const alvo of golpe.alvos) {
      if (alvo.danoFinal === undefined && alvo.podeReagir && ehDoMestre(alvo.personagemId, personagens)) esperando += 1
    }
  }
  return esperando
}
