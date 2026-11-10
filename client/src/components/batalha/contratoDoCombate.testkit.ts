import { AUTOR_DA_ARENA, vistaDaArena } from '../../lib/arena/estadoDaArena'
import { CASA_DA_ARENA, centroDaCasaNaArena } from '../../lib/arena/grade'
import { CENA_DA_ARENA } from '../../lib/arena/tipos'
import { chaveDaVez, type PedidoDeAcao, type PedidoDePassiva } from '../../lib/batalha/combate'
import { ficha } from '../../lib/batalha/fichasDaFatiaB.testkit'
import { REVIGORAR } from '../../lib/batalha/fichasDaFatiaD.testkit'
import { ID_DA_RYOKO } from '../../lib/batalha/fichasDaFatiaE.testkit'
import { acoesDaCarta } from '../../lib/batalha/golpe'
import type { VezEsperada } from '../../lib/batalha/ponte'
import { bonusDaBatalha } from '../../lib/batalha/selos'
import { combatentesIniciais, type AutorDaAcao, type TurnosDaCena } from '../../lib/batalha/turnos'
import type { EstadoParaJogador } from '../../lib/batalha/vistaDoJogador'
import { createEmptyMap } from '../../lib/mapFactory'
import { numeroDaFicha, type CartaoDaFicha, type Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { ID_ONE_PIECE, SISTEMA_ONE_PIECE } from '../../lib/sistemaOnePiece'
import { aplicarJogada, type JogadaDoDuelo, type RecusaDaJogada } from '../../lib/treino/duelo'
import { dueloParaOLado } from '../../lib/treino/vistaDoDuelo'
import { vidasDaCena } from '../../lib/vidaDaFicha'
import { copiasDoLado, fichasDaLuta } from '../../lobby-site/telas/treino/hudDaLuta'
import { comecarLutaLocal, CONTA_DO_INIMIGO, jogarNaLuta } from '../../lobby-site/telas/treino/lutaDeTreino'
import { textoDaRecusa } from '../../lobby-site/telas/treino/textosDoTreino'
import { criarBatalhaNoHost, type ConexaoNaBatalha, type SaidaDaBatalha } from '../../net/batalhaNoHost'
import { parseBatalhaResultado } from '../../net/protocoloDaBatalha'
import { textoDaRecusaDaBatalha } from '../../player/playerConnection'
import { equipesAtivas, personagensAtivos, useAdventureStore } from '../../stores/adventureStore'
import { batalhaDaArena, useArenaStore } from '../../stores/arenaStore'
import { ponteDaBatalha, useBatalhaStore } from '../../stores/batalhaStore'
import { useMapStore } from '../../stores/mapStore'
import { mesaDaAventura } from '../../stores/mesaDaAventura'
import {
  RECUSA_SEM_MOTIVO,
  alvosDoRecorte,
  alvosNaOrdemDaMira,
  armaPadraoNaBatalha,
  combateDoJogador,
  golpesDeHabilidade,
  marcadosAoAbrirAMira,
  type AlvoNaMira,
  type FichaComPosicao,
  type GolpeNaTela,
  type MiraDoRecorte,
} from './dadosDoMenu'
import { alvosDaOrdem, type MesaDoMestre } from './mesaDoMestre'
import { pedidoDoGolpe } from './MiraDoGolpe'
import { nomesNumerados } from './nomesNumerados'
import { pedidosDaVez, type PedidosDaVez } from './pedidosDaVez'

/**
 * O CONTRATO DO COMBATE (fase final do plano de unificação, 10/11/2026): as
 * fichas inventadas e as QUATRO ENTRADAS da batalha, cada uma pela cola de
 * verdade dela, atrás de uma interface só (`EntradaDoContrato`):
 *
 *  - Arena: `useArenaStore` + a mesa da Arena + `pedidosDaVez` (o mestre opera tudo);
 *  - mapa (mestre): `useBatalhaStore` + `mesaDaAventura` + `pedidosDaVez`;
 *  - mapa (jogador): o host (`criarBatalhaNoHost` sobre a ponte de verdade) com
 *    a jogadora pedindo pela rede; o mestre opera o outro lado pela store;
 *  - site: `comecarLutaLocal` / `jogarNaLuta` / `aplicarJogada` do treino.
 *
 * O que cada entrada devolve é o que a REGRA fez e o que a TELA dela mostra
 * (a frase da recusa, o menu, quem a mira marca ao abrir), lido pelas mesmas
 * funções que a tela chama. Só para teste. Dados inventados: o repositório é
 * público, nenhuma ficha de mesa entra aqui (o Revigorar e o id da ficha com
 * regra presa já estavam nos testkits das fatias D e E).
 */

export const SISTEMA: SistemaDeRpg = SISTEMA_ONE_PIECE
const MESTRE: AutorDaAcao = { tipo: 'mestre' }
const CENA_DO_MAPA = 'cena_do_contrato'
const CASA_DO_MAPA = 50
const SEMENTE_DO_SITE = 20261110
/** Quantas vezes a vez anda até chegar em alguém (o elenco tem no máximo 5 cartas). */
const PASSOS_DA_VEZ_MAX = 16

// ───────────────────────────────────────────────────────────────────────────
// As técnicas inventadas (a forma das reais)
// ───────────────────────────────────────────────────────────────────────────

function cartaoDeTexto(id: string, nome: string, campos: Record<string, string>): CartaoDaFicha {
  return { id, nome, campos, extras: [], atributos: [], imagem: null, modificadores: [], subcartoes: [] }
}

function cartaoDePecas(id: string, nome: string, mecanica: NonNullable<CartaoDaFicha['mecanica']>, campos: Record<string, string> = {}): CartaoDaFicha {
  return { ...cartaoDeTexto(id, nome, campos), mecanica }
}

/** Técnica montada que não erra e tira um dano fixo de um inimigo, em ação Livre (várias na mesma vez). */
function golpeCerto(id: string, nome: string, dano: number): CartaoDaFicha {
  return cartaoDePecas(id, nome, {
    versao: 1,
    acao: 'livre',
    custos: [],
    alvo: { quem: 'inimigos', forma: { tipo: 'um' } },
    teste: { tipo: 'naoErra' },
    dano: { base: { fixo: dano }, multiplicadores: { concentracao: true, surpresa: true } },
  })
}

/** A cura por peças (a forma da Bolha): 30 de SP, Ação Simples, até 2 aliados, cura o Espírito de quem usa, 3 usos por batalha. */
export const BOLHA = cartaoDePecas(
  'cart_contrato_bolha',
  'Bolha de Teste',
  {
    versao: 1,
    limite: { usosPorBatalha: 3 },
    teste: { tipo: 'reacao' },
    efeitos: [{ tipo: 'cura', recurso: 'hp', quanto: { formula: 'Espírito' }, emQuem: 'alvo' }],
    acao: 'simples',
    custos: [{ recurso: 'sp', quanto: { fixo: 30 }, quando: 'aoUsar' }],
    alvo: { quem: 'aliados', forma: { tipo: 'varios', max: 2 } },
  },
  { dano: '', acao: 'Ação Simples', tipo: 'Buff' },
)
/** A cura "à mão" (a regra mora na tabela `MECANICAS_A_MAO`, pelo id do cartão): cura o Espírito, 50 de SP, Ação Completa. */
export const CURA_A_MAO = REVIGORAR
/** Dano simples escrito em texto: Força + 60, 20 de SP, o alvo reage. */
export const CORTE = cartaoDeTexto('cart_contrato_corte', 'Corte de Teste', { acao: 'Ação Simples', efeito: '-', custo: '-20', tempo: '1', dano: 'Força + 60' })
/** Área montada: o 3x3 em volta de quem usa, 40 em cada inimigo dentro. */
export const GIRO = cartaoDePecas('cart_contrato_giro', 'Giro de Teste', {
  versao: 1,
  acao: 'simples',
  custos: [],
  alvo: { quem: 'inimigos', forma: { tipo: 'quadrado', lado: 3, centro: 'si' } },
  teste: { tipo: 'naoErra' },
  dano: { base: { fixo: 40 }, multiplicadores: { concentracao: true, surpresa: true } },
})
/** Selo com dano por vez: Sangrando por 3 turnos (a regra tira 10 a cada vez de quem sangra). */
export const CORTE_FUNDO = cartaoDePecas('cart_contrato_corte_fundo', 'Corte Fundo de Teste', {
  versao: 1,
  acao: 'simples',
  custos: [],
  alvo: { quem: 'inimigos', forma: { tipo: 'um' } },
  teste: { tipo: 'naoErra' },
  efeitos: [{ tipo: 'selo', nome: 'Sangrando', duracao: 3, natureza: 'debuff' }],
})
/** Passiva com lembrete "a cada turno": +30 de HP no começo da vez do dono (Aplicar ou pular). */
export const FOLEGO = cartaoDeTexto('cart_contrato_folego', 'Fôlego de Teste', { tipo: 'Passiva', efeito: 'Recupera 30 de HP no início de cada turno' })
/** Golpe certo e Livre da curandeira, para ferir o inimigo sem gastar a ação da vez. */
export const AGULHA = golpeCerto('cart_contrato_agulha', 'Agulha de Teste', 50)
/** Os golpes certos do inimigo, que deixam o outro lado ferido (cada um num alvo). */
export const PANCADA = golpeCerto('cart_contrato_pancada', 'Pancada de Teste', 200)
export const MARTELADA = golpeCerto('cart_contrato_martelada', 'Martelada de Teste', 200)
export const ARRANHAO = golpeCerto('cart_contrato_arranhao', 'Arranhão de Teste', 40)

// ───────────────────────────────────────────────────────────────────────────
// As fichas inventadas
// ───────────────────────────────────────────────────────────────────────────

interface Numeros {
  hp: number
  sp: number
  escudo: number
}

function jogadora(nome: string, atributos: Record<string, number>, recursos: Numeros, habilidades: CartaoDaFicha[] = []): Personagem {
  return ficha(nome, atributos, recursos, { habilidades })
}

function npc(nome: string, atributos: Record<string, number>, recursos: Numeros, habilidades: CartaoDaFicha[] = []): Personagem {
  return { ...jogadora(nome, atributos, recursos, habilidades), tipo: 'npc' }
}

/** A Agilidade decide a ordem sem empate: Marujo, Curandeira, Sapo, Tartaruga, Capitã. */
export const CURANDEIRA = jogadora('Curandeira de Teste', { forca: 40, espirito: 50, agilidade: 60 }, { hp: 500, sp: 200, escudo: 0 }, [BOLHA, CURA_A_MAO, CORTE, GIRO, CORTE_FUNDO, FOLEGO, AGULHA])
export const SAPO = npc('Sapo de Teste', { espirito: 50, agilidade: 50 }, { hp: 500, sp: 120, escudo: 0 }, [BOLHA])
export const TARTARUGA = npc('Tartaruga de Teste', { agilidade: 45 }, { hp: 500, sp: 100, escudo: 300 })
export const MARUJO = npc('Marujo de Teste', { agilidade: 70 }, { hp: 500, sp: 100, escudo: 0 }, [PANCADA, MARTELADA, ARRANHAO])
export const CAPITA = npc('Capitã de Teste', { agilidade: 30 }, { hp: 500, sp: 100, escudo: 0 })

/** A ficha com regra presa ao ID (`ficha:<id>` na tabela "à mão": a esquiva normal de quem é da raça que só defende). */
const ogra = jogadora('Ogra de Teste', { agilidade: 60 }, { hp: 500, sp: 100, escudo: 0 })
export const OGRA_COM_REGRA_NA_FICHA: Personagem = { ...ogra, id: ID_DA_RYOKO, escolhas: { ...ogra.escolhas, raca: 'Ogro' } }
const ogroComum = jogadora('Ogro Comum de Teste', { agilidade: 50 }, { hp: 500, sp: 100, escudo: 0 })
export const OGRO_COMUM: Personagem = { ...ogroComum, escolhas: { ...ogroComum.escolhas, raca: 'Ogro' } }

export interface Casa {
  col: number
  row: number
}

export interface Lutador {
  ficha: Personagem
  casa: Casa
  /** No mapa por LAN, a ficha que a jogadora opera (a dela, ou o NPC que o mestre deu para ela controlar). */
  daJogadora?: true
}

/** Quem luta: o lado A (o de quem cura) e o lado B. */
export interface Elenco {
  a: readonly Lutador[]
  b: readonly Lutador[]
}

/** O elenco de sempre: a Curandeira com o Marujo colado à direita; a Capitã longe, ou onde o caso pedir. */
export function elencoDoContrato(casaDaCapita: Casa = { col: 10, row: 4 }): Elenco {
  return {
    a: [
      { ficha: CURANDEIRA, casa: { col: 5, row: 4 }, daJogadora: true },
      { ficha: SAPO, casa: { col: 4, row: 4 }, daJogadora: true },
      { ficha: TARTARUGA, casa: { col: 4, row: 5 } },
    ],
    b: [
      { ficha: MARUJO, casa: { col: 6, row: 4 } },
      { ficha: CAPITA, casa: casaDaCapita },
    ],
  }
}

/** A ficha com regra presa ao id e outra da mesma raça sem ela, contra o Marujo. */
export function elencoDasOgras(): Elenco {
  return {
    a: [
      { ficha: OGRA_COM_REGRA_NA_FICHA, casa: { col: 5, row: 4 }, daJogadora: true },
      { ficha: OGRO_COMUM, casa: { col: 4, row: 4 }, daJogadora: true },
    ],
    b: [{ ficha: MARUJO, casa: { col: 6, row: 4 } }],
  }
}

// ───────────────────────────────────────────────────────────────────────────
// A interface comum
// ───────────────────────────────────────────────────────────────────────────

export type NomeDaEntrada = 'Arena' | 'mapa (mestre)' | 'mapa (jogador)' | 'site'

/** O que o pedido deu: `tela` = a frase que a TELA da entrada mostra na recusa (`null` = aceito). */
export interface ResultadoDoPedido {
  ok: boolean
  tela: string | null
}

export interface EntradaDoContrato {
  nome: NomeDaEntrada
  token: (nome: string) => string
  /** A ficha que LUTA (na Arena e no site, a cópia). */
  copia: (nome: string) => Personagem
  recurso: (nome: string, chave: 'hp' | 'sp' | 'escudo') => number
  usos: (nome: string, cartaoId: string) => number
  selos: (nome: string) => string[]
  lembretes: (nome: string) => { chave: string; cartaoId: string }[]
  /** Passa a vez (quem opera a carta da vez em cada entrada) até a de `nome`. */
  vezDe: (nome: string) => VezEsperada
  passarAVez: () => void
  /** Quem opera `nome` nesta entrada pede o golpe, na vez dela. */
  agir: (nome: string, pedido: PedidoDeAcao) => ResultadoDoPedido
  /** Todo golpe esperando reação: ninguém reage (o dano entra inteiro). */
  ninguemReage: () => void
  /** Ativar a passiva, ou responder o lembrete dela, por quem opera `nome`. */
  passiva: (nome: string, pedido: PedidoDePassiva) => boolean
  /** A técnica como a tela de quem opera `nome` a mostra, na vez dela. */
  golpe: (nome: string, cartaoId: string) => GolpeNaTela
  /** A mira da técnica ao abrir: quem vem marcado (os nomes) e o lado de cada alvo. */
  mira: (nome: string, cartaoId: string) => { marcados: string[]; lados: Record<string, AlvoNaMira['lado']> }
  fechar: () => void
}

/** O pedido como a mira o manda (`MiraDoGolpe`: o dano da ficha em cada alvo, sem Surpresa, o custo e a ação da ficha). */
export function pedidoDaTela(entrada: EntradaDoContrato, quem: string, cartaoId: string, alvos: readonly string[]): PedidoDeAcao {
  const golpe = entrada.golpe(quem, cartaoId)
  const { dano } = golpe
  return pedidoDoGolpe(golpe, {
    alvos: alvos.map((nome) => ({ tokenId: entrada.token(nome), dano: dano.valor ?? (dano.semDano ? null : 0) })),
    surpresa: false,
    perfurante: golpe.perfurante,
    perfuracao: null,
    custo: null,
    acao: null,
    selo: null,
  })
}

/** `quem` usa a técnica nos `alvos`, pela mira da entrada. */
export function usar(entrada: EntradaDoContrato, quem: string, cartaoId: string, alvos: readonly string[]): ResultadoDoPedido {
  return entrada.agir(quem, pedidoDaTela(entrada, quem, cartaoId, alvos))
}

// ───────────────────────────────────────────────────────────────────────────
// O que é igual nas quatro: ler a batalha
// ───────────────────────────────────────────────────────────────────────────

function leituras(turnos: () => TurnosDaCena, personagens: () => readonly Personagem[]) {
  const copia = (nome: string): Personagem => {
    const achada = personagens().find((candidata) => candidata.nome === nome)
    if (achada === undefined) throw new Error(`sem a ficha de ${nome} na luta`)
    return achada
  }
  const cartaDe = (nome: string) => {
    const { id } = copia(nome)
    const achada = turnos().cartas.find((carta) => carta.personagemId === id && carta.bando === undefined)
    if (achada === undefined) throw new Error(`sem a carta de ${nome} na ordem`)
    return achada
  }
  const cartaDaVezAgora = () => {
    const atual = turnos()
    const daVez = atual.cartas.find((carta) => carta.id === atual.vez)
    if (daVez === undefined) throw new Error('a batalha está sem vez')
    return daVez
  }
  const vezAgora = (): VezEsperada => ({ cartaId: cartaDaVezAgora().id, rodada: turnos().rodada })
  const nomeDoToken = (tokenId: string): string => personagens().find((candidata) => candidata.id === turnos().cartas.find((carta) => carta.tokenId === tokenId)?.personagemId)?.nome ?? tokenId
  return {
    copia,
    cartaDe,
    cartaDaVezAgora,
    vezAgora,
    nomeDoToken,
    token: (nome: string): string => cartaDe(nome).tokenId,
    recurso: (nome: string, chave: 'hp' | 'sp' | 'escudo'): number => numeroDaFicha(copia(nome).recursos, chave),
    usos: (nome: string, cartaoId: string): number => turnos().combate?.[copia(nome).id]?.usos[cartaoId] ?? 0,
    selos: (nome: string): string[] => {
      const { tokenId } = cartaDe(nome)
      return (turnos().selos ?? []).filter((selo) => selo.tokenId === tokenId).map((selo) => `${selo.nome} ${selo.turnos ?? ''}`.trim())
    },
    lembretes: (nome: string): { chave: string; cartaoId: string }[] => (turnos().combate?.[copia(nome).id]?.lembretes ?? []).map((lembrete) => ({ chave: lembrete.chave, cartaoId: lembrete.cartaoId })),
    /** A vez é de `nome`? Quem pede fora da vez é erro do teste, não da regra. */
    naVezDe: (nome: string): VezEsperada => {
      if (cartaDaVezAgora().personagemId !== copia(nome).id) throw new Error(`não é a vez de ${nome}`)
      return vezAgora()
    },
    vezDe: (nome: string, passar: () => void): VezEsperada => {
      const { id } = copia(nome)
      for (let passo = 0; passo < PASSOS_DA_VEZ_MAX; passo += 1) {
        if (cartaDaVezAgora().personagemId === id) return vezAgora()
        passar()
      }
      throw new Error(`a vez de ${nome} não chegou`)
    },
    /** Os alvos de golpe que ainda esperam a reação. */
    esperandoReacao: (): { golpeId: string; tokenId: string }[] => (turnos().golpes ?? []).flatMap((golpe) => golpe.alvos.filter((alvo) => alvo.danoFinal === undefined).map((alvo) => ({ golpeId: golpe.id, tokenId: alvo.tokenId }))),
  }
}

type Leituras = ReturnType<typeof leituras>

/** A mira ao abrir, com os nomes no lugar dos tokens. */
function miraComNomes(l: Leituras, golpe: GolpeNaTela, alvos: readonly AlvoNaMira[]): { marcados: string[]; lados: Record<string, AlvoNaMira['lado']> } {
  const lados: Record<string, AlvoNaMira['lado']> = {}
  for (const alvo of alvos) lados[l.nomeDoToken(alvo.tokenId)] = alvo.lado
  return { marcados: marcadosAoAbrirAMira(golpe, alvos).map(l.nomeDoToken), lados }
}

function tecnicaDoMenu(habilidades: readonly GolpeNaTela[], cartaoId: string): GolpeNaTela {
  const golpe = habilidades.find((item) => item.chave === `tecnica:${cartaoId}`)
  if (golpe === undefined) throw new Error(`a técnica ${cartaoId} não está no menu da vez`)
  return golpe
}

// ───────────────────────────────────────────────────────────────────────────
// A tela da vez sobre um recorte (`BatalhaDoJogador`: a Arena, o jogador por LAN, o site)
// ───────────────────────────────────────────────────────────────────────────

/** O que a entrada dá ao `BatalhaDoJogador` (as props que mudam o menu e a mira). */
interface TelaDoRecorte {
  estado: EstadoParaJogador
  meus: readonly Personagem[]
  aliados: readonly Personagem[]
  fichas: readonly (FichaComPosicao & { name: string })[]
  sistema: SistemaDeRpg | null
  tamanhoDaCasa: number | undefined
  vidaPublica?: NonNullable<MiraDoRecorte['vidaPublica']>
}

/** O menu e os alvos da vez, pelas mesmas funções e na mesma ordem do `BatalhaDoJogador` (o `useMemo` do menu). */
function menuDoRecorte(tela: TelaDoRecorte): { habilidades: GolpeNaTela[]; alvos: AlvoNaMira[] } {
  const { estado, sistema } = tela
  const cartaQueAge = estado.minhaVez ? estado.cartas.find((carta) => carta.id === estado.vez) : undefined
  if (cartaQueAge === undefined || estado.vez === null) throw new Error('a tela não mostra a vez como dela')
  const fichasInteiras = [...tela.meus, ...tela.aliados]
  const personagem = fichasInteiras.find((candidato) => candidato.id === cartaQueAge.personagemId)
  if (personagem === undefined || sistema === null) throw new Error('a tela não tem a ficha de quem age')
  const meuCombate = estado.meus?.find((combate) => combate.personagemId === personagem.id)
  const combate = combateDoJogador(meuCombate, chaveDaVez(estado.rodada, estado.vez))
  const nomes = new Map<string, string>()
  for (const item of tela.fichas) nomes.set(item.id, item.name.trim())
  for (const carta of estado.cartas) if (carta.nome.trim() !== '') nomes.set(carta.tokenId, carta.nome.trim())
  const mira: MiraDoRecorte = { cartas: estado.cartas, quemAge: cartaQueAge, personagens: fichasInteiras, sistema, nomeDe: (tokenId) => nomes.get(tokenId) || 'Ficha', imagemDe: () => null }
  if (tela.vidaPublica !== undefined) mira.vidaPublica = tela.vidaPublica
  return {
    habilidades: golpesDeHabilidade(personagem, sistema, combate, estado.acoes ?? null, armaPadraoNaBatalha(personagem, combate)),
    alvos: alvosNaOrdemDaMira(alvosDoRecorte(mira), tela.fichas, cartaQueAge.tokenId, tela.tamanhoDaCasa),
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Quem opera pela store como mestre (a Arena e o mestre no mapa)
// ───────────────────────────────────────────────────────────────────────────

/** O pedido do mestre e a frase do `MenuDaVez` com as props que a Arena e o menu do centro passam (`motivoDaRecusa`, `avisoDaRecusa`). */
function pedirComoMestre(pedidos: PedidosDaVez, vez: VezEsperada, pedido: PedidoDeAcao): ResultadoDoPedido {
  if (pedidos.agir(vez, pedido)) return { ok: true, tela: null }
  return { ok: false, tela: pedidos.motivoDoAgir(vez, pedido) ?? RECUSA_SEM_MOTIVO }
}

function passarComoMestre(pedidos: PedidosDaVez, l: Leituras): void {
  const vez = l.vezAgora()
  if (!pedidos.passarVez(vez.cartaId, vez.rodada)) throw new Error('o mestre não conseguiu passar a vez')
}

function ninguemReageComoMestre(pedidos: PedidosDaVez, l: Leituras): void {
  for (const { golpeId, tokenId } of l.esperandoReacao()) {
    if (!pedidos.reagir({ tipo: 'naoReagir', golpeId, tokenId })) throw new Error('o mestre não conseguiu dispensar a reação')
  }
}

// ───────────────────────────────────────────────────────────────────────────
// (A) Arena
// ───────────────────────────────────────────────────────────────────────────

export function entradaDaArena(elenco: Elenco): EntradaDoContrato {
  const arena = useArenaStore.getState()
  arena.abrir(ID_ONE_PIECE)
  for (const { ficha: real } of elenco.a) arena.escolher(real.id, 'a')
  for (const { ficha: real } of elenco.b) arena.escolher(real.id, 'b')
  const todos = [...elenco.a, ...elenco.b]
  if (!useArenaStore.getState().lutar(todos.map((lutador) => lutador.ficha))) throw new Error('a Arena não começou a luta')
  const sessao = () => {
    const atual = useArenaStore.getState().sessao
    if (atual === null) throw new Error('a Arena fechou')
    return atual
  }
  const cena = () => {
    const atual = batalhaDaArena.getState().cenas[CENA_DA_ARENA]
    if (atual === undefined) throw new Error('a batalha da Arena não ligou')
    return atual
  }
  const l = leituras(() => cena().turnos, () => sessao().copias)
  for (const { ficha: real, casa } of todos) {
    const centro = centroDaCasaNaArena(casa)
    if (!useArenaStore.getState().moverFicha(l.token(real.nome), centro.x, centro.y)) throw new Error(`a Arena não pôs ${real.nome} na casa`)
  }
  // A mesma lista de pedidos da `TelaDaArena`.
  const pedidos = pedidosDaVez(batalhaDaArena, CENA_DA_ARENA, AUTOR_DA_ARENA)
  // O que a `TelaDaArena` dá ao `BatalhaDoJogador`.
  const menu = () => menuDoRecorte({ estado: vistaDaArena(cena(), sessao(), SISTEMA), meus: sessao().copias, aliados: [], fichas: sessao().tokens, sistema: SISTEMA, tamanhoDaCasa: CASA_DA_ARENA })
  const golpe = (nome: string, cartaoId: string): GolpeNaTela => {
    l.naVezDe(nome)
    return tecnicaDoMenu(menu().habilidades, cartaoId)
  }
  return {
    nome: 'Arena',
    token: l.token,
    copia: l.copia,
    recurso: l.recurso,
    usos: l.usos,
    selos: l.selos,
    lembretes: l.lembretes,
    vezDe: (nome) => l.vezDe(nome, () => passarComoMestre(pedidos, l)),
    passarAVez: () => passarComoMestre(pedidos, l),
    agir: (nome, pedido) => pedirComoMestre(pedidos, l.naVezDe(nome), pedido),
    ninguemReage: () => ninguemReageComoMestre(pedidos, l),
    passiva: (_nome, pedido) => pedidos.passiva(pedido),
    golpe,
    mira: (nome, cartaoId) => miraComNomes(l, golpe(nome, cartaoId), menu().alvos),
    fechar: () => useArenaStore.getState().sair(),
  }
}

// ───────────────────────────────────────────────────────────────────────────
// (B) O mapa: a aventura, o mapa e a batalha de verdade
// ───────────────────────────────────────────────────────────────────────────

function montarOMapa(elenco: Elenco): { l: Leituras; pedidos: PedidosDaVez; mesa: () => MesaDoMestre; tokenDe: (real: Personagem) => string } {
  useBatalhaStore.getState().reset()
  // A aventura de antes sai inteira: `adicionarPersonagens` só acrescenta, e a ficha ferida do caso anterior ficaria na frente.
  useAdventureStore.getState().reset()
  const aventura = useAdventureStore.getState()
  aventura.virarAventura(null)
  aventura.setSistemaDeRpg('one-piece')
  const todos = [...elenco.a, ...elenco.b]
  if (!useAdventureStore.getState().adicionarPersonagens(todos.map((lutador) => lutador.ficha))) throw new Error('a aventura de teste não guardou as fichas')
  useMapStore.getState().loadMap(createEmptyMap('mapa-do-contrato', 'Clareira de Teste', 20, 20, CASA_DO_MAPA))
  const tokenDe = (real: Personagem): string => `tok_${real.id}`
  for (const { ficha: real, casa } of todos) {
    // O centro da casa, como o token de 1 casa fica no mapa.
    useMapStore.getState().addToken({ id: tokenDe(real), characterId: real.id, name: real.nome, x: (casa.col + 0.5) * CASA_DO_MAPA, y: (casa.row + 0.5) * CASA_DO_MAPA, size: 1, image: null, ...(real.tipo === 'npc' ? { npc: true } : {}) })
  }
  // O lado A é uma equipe do mestre (a jogadora e os NPCs que lutam com ela); o lado B são os NPCs sem equipe.
  if (!useAdventureStore.getState().salvarEquipes([{ id: 'equipe_do_contrato', nome: 'Lado A de Teste', cor: '#336699', membros: elenco.a.map((lutador) => lutador.ficha.id) }])) throw new Error('a aventura de teste não guardou a equipe')
  const personagens = () => personagensAtivos(useAdventureStore.getState())
  const tokens = useMapStore.getState().map.tokens
  const combatentes = combatentesIniciais(tokens, personagens(), SISTEMA, new Set(tokens.map((token) => token.id)))
  useBatalhaStore.getState().ligar(CENA_DO_MAPA, {}, { combatentes, regras: null, desempate: 'd20' })
  const cena = () => {
    const atual = useBatalhaStore.getState().cenas[CENA_DO_MAPA]
    if (atual === undefined) throw new Error('a batalha do mapa não ligou')
    return atual
  }
  // A mesma leitura do `useMesa` da aba Batalha.
  const mesa = (): MesaDoMestre => {
    const fichas = useMapStore.getState().map.tokens
    return {
      cena: cena(),
      fichas,
      tamanhoDaCasa: useMapStore.getState().map.grid,
      personagens: personagens(),
      equipes: equipesAtivas(useAdventureStore.getState()),
      sistema: mesaDaAventura.sistema(),
      rotulos: nomesNumerados(fichas.map((item) => ({ id: item.id, nome: item.name }))),
    }
  }
  return { l: leituras(() => cena().turnos, personagens), pedidos: pedidosDaVez(useBatalhaStore, CENA_DO_MAPA, MESTRE), mesa, tokenDe }
}

/** O menu e a mira do mestre para a carta da vez (`golpesDaVezDoNpc` e `alvosDaOrdem` do `BatalhaDoMestre`). */
function menuDoMestre(mesa: MesaDoMestre, l: Leituras): { habilidades: GolpeNaTela[]; alvos: AlvoNaMira[] } {
  const { cena, sistema } = mesa
  if (cena === undefined || sistema === null) throw new Error('a mesa do mestre está sem batalha ou sem sistema')
  const { turnos } = cena
  const carta = l.cartaDaVezAgora()
  const personagem = mesa.personagens.find((candidato) => candidato.id === carta.personagemId)
  if (personagem === undefined) throw new Error('a carta da vez está sem ficha')
  const acoes = acoesDaCarta({ turnos, carta, personagem, sistema, regras: useBatalhaStore.getState().cenas[CENA_DO_MAPA]?.regras ?? null })
  const combate = turnos.combate?.[personagem.id]
  return {
    habilidades: golpesDeHabilidade(personagem, sistema, combate, acoes, armaPadraoNaBatalha(personagem, combate), bonusDaBatalha(turnos.selos, carta.tokenId)),
    alvos: alvosDaOrdem(mesa, turnos.cartas, carta),
  }
}

export function entradaDoMapaDoMestre(elenco: Elenco): EntradaDoContrato {
  const { l, pedidos, mesa } = montarOMapa(elenco)
  const golpe = (nome: string, cartaoId: string): GolpeNaTela => {
    l.naVezDe(nome)
    return tecnicaDoMenu(menuDoMestre(mesa(), l).habilidades, cartaoId)
  }
  return {
    nome: 'mapa (mestre)',
    token: l.token,
    copia: l.copia,
    recurso: l.recurso,
    usos: l.usos,
    selos: l.selos,
    lembretes: l.lembretes,
    vezDe: (nome) => l.vezDe(nome, () => passarComoMestre(pedidos, l)),
    passarAVez: () => passarComoMestre(pedidos, l),
    agir: (nome, pedido) => pedirComoMestre(pedidos, l.naVezDe(nome), pedido),
    ninguemReage: () => ninguemReageComoMestre(pedidos, l),
    passiva: (_nome, pedido) => pedidos.passiva(pedido),
    golpe,
    mira: (nome, cartaoId) => miraComNomes(l, golpe(nome, cartaoId), menuDoMestre(mesa(), l).alvos),
    fechar: () => useBatalhaStore.getState().reset(),
  }
}

export function entradaDoMapaDoJogador(elenco: Elenco): EntradaDoContrato {
  const { l, pedidos, mesa, tokenDe } = montarOMapa(elenco)
  const dela = [...elenco.a, ...elenco.b].filter((lutador) => lutador.daJogadora === true).map((lutador) => lutador.ficha)
  const delaDeVerdade = dela.filter((real) => real.tipo === 'jogador')
  const opera = (nome: string): boolean => dela.some((real) => real.nome === nome)
  const tokens = useMapStore.getState().map.tokens
  // A conexão como o host a conhece: as fichas dela (a dela e o NPC que ela controla) e só o personagem que é dela de verdade.
  const ana: ConexaoNaBatalha = {
    clientId: 'c-jogadora',
    playerId: 'jogadora_de_teste',
    nome: 'Jogadora de Teste',
    lugar: {
      sceneKey: CENA_DO_MAPA,
      meusTokens: new Set(dela.map(tokenDe)),
      fichasNaTela: tokens.map((token) => ({ id: token.id, name: token.name })),
      meusPersonagens: new Set(delaDeVerdade.map((real) => real.id)),
      personagemDaFicha: new Map(delaDeVerdade.map((real) => [tokenDe(real), real.id])),
    },
  }
  const host = criarBatalhaNoHost({ ponte: ponteDaBatalha, agora: () => 1_000, paraOFio: (personagem) => personagem })
  const mesaDoHost = () => ({ sistema: mesaDaAventura.sistema(), personagens: mesa().personagens, equipes: mesa().equipes ?? [] })
  // O que a página da jogadora guarda do que o host manda.
  let estado: EstadoParaJogador | null = null
  let aliados: readonly Personagem[] = []
  const receber = (saidas: readonly SaidaDaBatalha[]): void => {
    for (const { msg } of saidas) {
      if (msg.type === 'batalha.estado') estado = msg.estado
      else if (msg.type === 'batalha.aliados') aliados = msg.personagens
    }
  }
  const sincronizar = (): void => receber(host.sync([ana], mesaDoHost()))
  receber(host.entrou(ana, mesaDoHost()))
  let pedido = 0
  const reqId = (): string => {
    pedido += 1
    return `req_${pedido}`
  }
  // O que o `player/main.tsx` dá ao `BatalhaDoJogador`.
  const menu = () => {
    if (estado === null) throw new Error('a página da jogadora está sem o recorte da batalha')
    const meus = mesa().personagens.filter((candidato) => delaDeVerdade.some((real) => real.id === candidato.id))
    return menuDoRecorte({ estado, meus, aliados, fichas: useMapStore.getState().map.tokens, sistema: mesaDaAventura.sistema(), tamanhoDaCasa: useMapStore.getState().map.grid })
  }
  const golpe = (nome: string, cartaoId: string): GolpeNaTela => {
    l.naVezDe(nome)
    return tecnicaDoMenu((opera(nome) ? menu() : menuDoMestre(mesa(), l)).habilidades, cartaoId)
  }
  const comoMestre = <T>(fazer: () => T): T => {
    const feito = fazer()
    sincronizar()
    return feito
  }
  return {
    nome: 'mapa (jogador)',
    token: l.token,
    copia: l.copia,
    recurso: l.recurso,
    usos: l.usos,
    selos: l.selos,
    lembretes: l.lembretes,
    vezDe: (nome) => comoMestre(() => l.vezDe(nome, () => passarComoMestre(pedidos, l))),
    passarAVez: () => comoMestre(() => passarComoMestre(pedidos, l)),
    agir: (nome, pedidoDeAcao) => {
      const vez = l.naVezDe(nome)
      if (!opera(nome)) return comoMestre(() => pedirComoMestre(pedidos, vez, pedidoDeAcao))
      const resposta = parseBatalhaResultado(host.agir(ana, { type: 'batalha.agir', reqId: reqId(), vez, pedido: pedidoDeAcao }).saidas[0]?.msg)
      sincronizar()
      if (resposta === null) throw new Error('o host não respondeu o pedido da jogadora')
      // A frase que a página dela mostra (`playerConnection`: a recusa do host com o motivo).
      return resposta.ok ? { ok: true, tela: null } : { ok: false, tela: textoDaRecusaDaBatalha(resposta.motivo) }
    },
    ninguemReage: () => comoMestre(() => ninguemReageComoMestre(pedidos, l)),
    passiva: (nome, pedidoDePassiva) => {
      if (!opera(nome)) return comoMestre(() => pedidos.passiva(pedidoDePassiva))
      const resposta = parseBatalhaResultado(host.passiva(ana, { type: 'batalha.passiva', reqId: reqId(), pedido: pedidoDePassiva }).saidas[0]?.msg)
      sincronizar()
      return resposta?.ok === true
    },
    golpe,
    mira: (nome, cartaoId) => miraComNomes(l, golpe(nome, cartaoId), (opera(nome) ? menu() : menuDoMestre(mesa(), l)).alvos),
    fechar: () => useBatalhaStore.getState().reset(),
  }
}

// ───────────────────────────────────────────────────────────────────────────
// (C) O site: a luta de treino
// ───────────────────────────────────────────────────────────────────────────

export function entradaDoSite(elenco: Elenco): EntradaDoContrato {
  const comeco = comecarLutaLocal(
    {
      minhas: elenco.a.map((lutador) => lutador.ficha),
      inimigos: elenco.b.map((lutador) => lutador.ficha),
      largada: { a: elenco.a.map((lutador) => lutador.casa), b: elenco.b.map((lutador) => lutador.casa) },
    },
    SISTEMA,
    SEMENTE_DO_SITE,
  )
  if (!comeco.ok) throw new Error(`o site não montou a luta: ${comeco.motivo}`)
  let luta = comeco.luta
  const l = leituras(() => luta.duelo.cena.turnos, () => luta.duelo.lutadores.personagens)
  const ladoDoToken = (tokenId: string): 'a' | 'b' => {
    const vaga = luta.duelo.lutadores.vagas.find((candidata) => candidata.tokenId === tokenId)
    if (vaga === undefined) throw new Error('token fora da luta do site')
    return vaga.lado
  }
  /** A jogada de quem é dono do lado: a minha conta no A (`jogarNaLuta`), a do inimigo no B. `null` = aceita. */
  const jogar = (lado: 'a' | 'b', fazer: (seq: number) => JogadaDoDuelo): RecusaDaJogada | null => {
    const jogada = fazer(luta.duelo.seq)
    if (lado === 'a') {
      const feito = jogarNaLuta(luta, jogada)
      if (!feito.ok) return feito
      luta = feito.luta
      return null
    }
    const feito = aplicarJogada(luta.duelo, luta.motor, CONTA_DO_INIMIGO, jogada, 'livre')
    if (!feito.ok) return feito
    luta = { ...luta, duelo: feito.duelo }
    return null
  }
  const passar = (): void => {
    const vez = l.vezAgora()
    const recusa = jogar(ladoDoToken(l.cartaDaVezAgora().tokenId), (seq) => ({ tipo: 'passar', seq, vez }))
    if (recusa !== null) throw new Error(`o site não passou a vez: ${recusa.motivo} ${recusa.texto ?? ''}`)
  }
  // O que a `ArenaDaLuta` dá ao `BatalhaDoJogador`, do lado de quem opera a carta da vez.
  // A casa é a da Arena (`CASA_DA_ARENA`, a mesma que a ArenaDaLuta.tsx passa ao `<BatalhaDoJogador>`): a mira do site tem a grade.
  const menu = () => {
    const lado = ladoDoToken(l.cartaDaVezAgora().tokenId)
    const fio = dueloParaOLado(luta.duelo, lado, SISTEMA)
    const fichas = fichasDaLuta(fio, false)
    const vidas = vidasDaCena(fichas, fio.lutadores.personagens, SISTEMA)
    return menuDoRecorte({
      estado: fio.vista,
      meus: copiasDoLado(fio, (vaga) => vaga.lado === lado),
      aliados: [],
      fichas,
      sistema: SISTEMA,
      tamanhoDaCasa: CASA_DA_ARENA,
      vidaPublica: (tokenId) => vidas.get(tokenId) ?? null,
    })
  }
  const golpe = (nome: string, cartaoId: string): GolpeNaTela => {
    l.naVezDe(nome)
    return tecnicaDoMenu(menu().habilidades, cartaoId)
  }
  return {
    nome: 'site',
    token: l.token,
    copia: l.copia,
    recurso: l.recurso,
    usos: l.usos,
    selos: l.selos,
    lembretes: l.lembretes,
    vezDe: (nome) => l.vezDe(nome, passar),
    passarAVez: passar,
    agir: (nome, pedido) => {
      const vez = l.naVezDe(nome)
      const recusa = jogar(ladoDoToken(l.token(nome)), (seq) => ({ tipo: 'agir', seq, vez, pedido }))
      // A frase que a luta do site mostra (`LutaTurnoATurno`: `textoDaRecusa` do código e do texto da regra).
      return recusa === null ? { ok: true, tela: null } : { ok: false, tela: textoDaRecusa(recusa.motivo, recusa.texto) }
    },
    ninguemReage: () => {
      for (const { golpeId, tokenId } of l.esperandoReacao()) {
        const recusa = jogar(ladoDoToken(tokenId), (seq) => ({ tipo: 'reagir', seq, pedido: { tipo: 'naoReagir', golpeId, tokenId } }))
        if (recusa !== null) throw new Error(`o site não dispensou a reação: ${recusa.motivo} ${recusa.texto ?? ''}`)
      }
    },
    passiva: (nome, pedido) => jogar(ladoDoToken(l.token(nome)), (seq) => ({ tipo: 'passiva', seq, pedido })) === null,
    golpe,
    mira: (nome, cartaoId) => miraComNomes(l, golpe(nome, cartaoId), menu().alvos),
    fechar: () => {},
  }
}

export const ENTRADAS: readonly { nome: NomeDaEntrada; montar: (elenco: Elenco) => EntradaDoContrato }[] = [
  { nome: 'Arena', montar: entradaDaArena },
  { nome: 'mapa (mestre)', montar: entradaDoMapaDoMestre },
  { nome: 'mapa (jogador)', montar: entradaDoMapaDoJogador },
  { nome: 'site', montar: entradaDoSite },
]
