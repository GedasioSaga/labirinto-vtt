import { create } from 'zustand'
import type { Casa } from '../lib/batalha/blocos'
import { somarNaTrilha } from '../lib/batalha/caminhoAndado'
import { equipeDe } from '../lib/batalha/equipes'
import type { BatalhaEmTurnos, PonteDaBatalha, VezEsperada } from '../lib/batalha/ponte'
import {
  comLinha,
  desfazerFicha,
  marcarDesfeita,
  nomeDoAutor,
  novoIdDeLinha,
  proximoSeq,
  registrarAjuste as registrarAjusteNasLinhas,
  reverterTurnos,
  textoDaLinha,
  TIPOS_QUE_O_JOGADOR_DESFAZ,
  type LinhaDoRegistro,
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
  tirarCombatente as tirarCombatenteDaOrdem,
  tokensCaidos,
  trocarDesempate as trocarDesempateNaOrdem,
  turnosVazios,
  type AutorDaAcao,
  type CartaDaOrdem,
  type Desempate,
  type DuracaoDaExtra,
  type TurnosDaCena,
} from '../lib/batalha/turnos'
import { NOME_DO_MESTRE } from '../lib/ajusteDaFicha'
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
          id: novoIdDeLinha(),
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
      return { cena: { ...cena, turnos: reverterTurnos(cena.turnos, reversao) }, emParte: false, ok: true }
  }
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
      gravarCena(sceneKey, { ...cena, caminhos, trilhas, rev: cena.rev + 1 })
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
      const linha: LinhaNova = {
        tipo: 'vez',
        autor,
        texto: de === null ? `Começou: vez de ${nomeDaCarta(para, personagens)}` : `Vez: ${nomeDaCarta(de, personagens)} → ${nomeDaCarta(para, personagens)}${virou}`,
        tokenIds: [...new Set([de?.tokenId, para?.tokenId].filter((id): id is string => id !== undefined))],
        reversao: { tipo: 'vez', antes: { vez: turnos.vez, rodada: turnos.rodada, removidas: passada.removidas, gastos: turnos.gastos } },
      }
      gravarCena(sceneKey, comMudanca(cena, passada.turnos, linha))
      return true
    },

    darVez: (sceneKey, cartaId) =>
      mudarTurnos(
        sceneKey,
        (turnos) => darVezNaOrdem(turnos, cartaId),
        (antes, depois) => {
          const { personagens } = mesaDoRpg()
          const para = cartaDaVez(depois)
          return {
            tipo: 'vez',
            texto: `Vez dada a ${nomeDaCarta(para, personagens)}`,
            tokenIds: para === null ? [] : [para.tokenId],
            reversao: { tipo: 'vez', antes: { vez: antes.vez, rodada: antes.rodada, removidas: [], gastos: antes.gastos } },
          }
        },
      ),

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
      gravarCena(sceneKey, { ...atual, turnos: feito.cena.turnos, regras: feito.cena.regras, registro: marcarDesfeita(atual.registro, linhaId, por, Date.now()), turnosRev: atual.turnosRev + 1 })
      return true
    },
  }
})

/** A cena que nasce do Iniciar: a ordem pela Agilidade (com o desempate escolhido), a vez na primeira que joga, as regras. */
function cenaDoInicio(inicio: InicioDaBatalha): BatalhaDaCena {
  const { personagens, sistema } = mesaDoRpg()
  const vazios = turnosVazios(inicio.desempate)
  const comCartas: TurnosDaCena = { ...vazios, cartas: [...inicio.combatentes] }
  const ordenados = ordenarNaOrdem(comCartas, agilidadesDasCartas(comCartas.cartas, personagens, sistema), rolarD20)
  const comeco = passarVezNaOrdem(ordenados, tokensCaidos(ordenados.cartas, personagens, sistema))
  return { ...CENA_NOVA, turnos: comeco?.turnos ?? ordenados, regras: inicio.regras }
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
