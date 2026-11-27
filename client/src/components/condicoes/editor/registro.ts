import type { ComponentType } from 'react'
import type { ContextoDasFrases, FraseDaCondicao } from '../../../lib/condicoes/frasesDaCondicao'
import { AURA_DESTA_MESMA, type CondicaoMontada, type FamiliaDaPecaDaCondicao, type PecaDaCondicaoDa, type TipoDeDano } from '../../../lib/condicoes/modelo'
import type { ConditionSymbol } from '../../../lib/tokenConditions'
import { PecaAtributo } from './pecas/PecaAtributo'
import { PecaAura } from './pecas/PecaAura'
import { PecaBloqueio } from './pecas/PecaBloqueio'
import { PecaContra } from './pecas/PecaContra'
import { PecaDanoCura } from './pecas/PecaDanoCura'
import { PecaGatilho } from './pecas/PecaGatilho'
import { PecaMarca } from './pecas/PecaMarca'
import { PecaVez } from './pecas/PecaVez'

/**
 * O REGISTRO DAS PEÇAS DA CONDIÇÃO NA TELA e o CONTRATO DO BONECO (rework das condições, PLANO.md E1 o
 * contrato, E4 as entradas, E5 o motor do boneco, E6 a tela; molde: o registro das habilidades,
 * components/batalha/editor/pecas/registro.ts).
 *
 * Cada família de peça (`FamiliaDaPecaDaCondicao`) tem uma entrada: o nome, a frase curta do catálogo
 * "Pôr peça", o ícone, a cor, o selo "novo", a peça como nasce e o componente que edita o CORPO dela. A
 * moldura (a cor, subir, descer, tirar), a lista, a ordem e o cartão são do editor (E6). A peça guarda só
 * o que é dela (`PecaDaCondicaoDa<F>`, lib/condicoes/modelo.ts) e só no formato do modelo: o leitor
 * (`lerPecaDaCondicao`) recusa chave fora dele.
 *
 * O boneco (D12) joga 2 a 5 rodadas com a condição do jeito que está, pelo mesmo motor da batalha: o
 * motor é `ensaiarCondicao` (E5, lib/condicoes/ensaio.ts), do tipo `MotorDoBoneco`; a tela (E6) mostra os
 * ajustes que contam (`ajustesQueContam`) e as rodadas.
 *
 * Na E1 o registro nasceu vazio; a E4 o preencheu com as 8 famílias (os componentes em `pecas/`, o nome e a
 * pastilha em `NomeEPastilha.tsx`, o prazo e as saídas em `PrazoESaida.tsx`). Toda peça que um componente
 * entrega passa no leitor (`lerPecaDaCondicao`) do jeito que está: o número cabe no teto, a marca que
 * deixou de valer sai, e o gatilho nunca fica sem efeito.
 *
 * API pública (estável para E4, E5 e E6): `AtributoDaPeca`, `PropsDaPecaDaCondicao`, `PecaDaCondicaoNaTela`,
 * `RegistroDasPecasDaCondicao`, `EntradasDasPecasDaCondicao`, `REGISTRO_DAS_PECAS_DA_CONDICAO`,
 * `entradaDaPecaDaCondicao`, `AjustesDoBoneco`, `AJUSTES_DO_BONECO_PADRAO`,
 * `BonecoBase`, `BONECO_BASE`, `AjustesQueContam`, `ajustesQueContam`, `TipoDaLinhaDoBoneco`, `LinhaDoBoneco`,
 * `AtributoNaRodada`, `RodadaDoBoneco`, `ResultadoDoBoneco`, `MotorDoBoneco`.
 */

// ─── As peças na tela ──────────────────────────────────────────────────────

/** Um atributo que a peça oferece (o id do sistema, ou `velocidade`, `ca`, `dano`, `alcance`) e o nome dele. */
export interface AtributoDaPeca {
  id: string
  nome: string
}

/** O que o componente de uma peça recebe. */
export interface PropsDaPecaDaCondicao<F extends FamiliaDaPecaDaCondicao> {
  peca: PecaDaCondicaoDa<F>
  /** A condição inteira do rascunho (as outras peças, o prazo), só para ler. */
  condicao: CondicaoMontada
  /** A peça mudou (o editor grava a condição com ela no lugar). */
  aoMudar: (peca: PecaDaCondicaoDa<F>) => void
  /** O catálogo em volta (as de fábrica e as criadas): as listas da Aura, da Contra-condição e do gatilho. */
  contexto: ContextoDasFrases
  /** Os atributos do sistema da mesa; ausente = os 8 da ficha de One Piece mais Velocidade, CA, Dano e Alcance. */
  atributos?: readonly AtributoDaPeca[]
  /**
   * E4, opcional: a pastilha de uma condição do catálogo pelo id (os chips da Contra-condição). Ausente = só
   * as de fábrica ganham pastilha (`simboloDaFabricaPeloId`, pecas/vocabulario.ts); a criada fica com o ponto.
   */
  pastilhaDe?: (id: string) => ConditionSymbol | null
}

/** A entrada de uma família no registro (o `PECAS` e o `pecaNova` do protótipo, prototipo.html:546-588). */
export interface PecaDaCondicaoNaTela<F extends FamiliaDaPecaDaCondicao> {
  familia: F
  /** "Efeito na vez". */
  nome: string
  /** A frase curta do catálogo ("Ao entrar, no começo ou no fim da vez: tira ou dá vida, SP ou Escudo..."). */
  faz: string
  /** O nome do ícone do protótipo ("vez", "status", "trava" ...). */
  icone: string
  /** A cor da família, um token do tema. */
  cor: string
  /** Mostra o selo "novo" (a batalha ainda não faz tudo dela). */
  novo: boolean
  /** A peça como nasce ao pôr, já no formato do modelo (só o que difere do padrão). */
  nova: () => PecaDaCondicaoDa<F>
  Componente: ComponentType<PropsDaPecaDaCondicao<F>>
}

/** Uma entrada por família, cada uma com o tipo da própria peça. */
export type RegistroDasPecasDaCondicao = { readonly [F in FamiliaDaPecaDaCondicao]?: PecaDaCondicaoNaTela<F> }

/** O registro completo: toda família tem entrada (o tipo cobra, não só o leitor). */
export type EntradasDasPecasDaCondicao = { readonly [F in FamiliaDaPecaDaCondicao]: PecaDaCondicaoNaTela<F> }

/**
 * O registro: as 8 famílias (E4), com o nome, a frase, o ícone e a cor do `PECAS` do protótipo e a peça
 * como nasce do `pecaNova` dele, já no formato do modelo (só o que difere do padrão: sem `direto`, `rouba`
 * e `espalha` desligados, sem as linhas desligadas do Dano e cura). O ícone se desenha com
 * `GlifoDaCondicao` (pecas/glifos.tsx); a cor é a das peças das habilidades, mais `--lb-peca-gelo`
 * (pecas/pecas.css). "novo" fica na Aura e na Contra-condição, as duas que a batalha de antes não tinha.
 */
export const REGISTRO_DAS_PECAS_DA_CONDICAO: EntradasDasPecasDaCondicao = {
  vez: {
    familia: 'vez',
    nome: 'Efeito na vez',
    faz: 'Ao entrar, no começo ou no fim da vez: tira ou dá vida, SP ou Escudo, fixo ou em % da vida.',
    icone: 'vez',
    cor: 'var(--lb-peca-dano)',
    novo: false,
    nova: () => ({ tipo: 'vez', quando: 'comeco', faz: 'tira', v: 10, conta: 'fixo', recurso: 'vida' }),
    Componente: PecaVez,
  },
  atributo: {
    familia: 'atributo',
    nome: 'Muda atributo',
    faz: 'Tira, soma ou prende um atributo: de uma vez, a cada turno com teto, ou a partir do turno N.',
    icone: 'status',
    cor: 'var(--lb-peca-agua)',
    novo: false,
    nova: () => ({ tipo: 'atributo', atr: 'velocidade', faz: 'tira', v: 10, conta: 'fixo', ritmo: 'umaVez' }),
    Componente: PecaAtributo,
  },
  bloqueio: {
    familia: 'bloqueio',
    nome: 'Bloqueio',
    faz: 'O que quem está com ela não pode fazer: desviar, reagir, andar, usar técnica, agir.',
    icone: 'trava',
    cor: 'var(--lb-peca-couro)',
    novo: false,
    nova: () => ({ tipo: 'bloqueio', itens: { naoMove: true } }),
    Componente: PecaBloqueio,
  },
  danoCura: {
    familia: 'danoCura',
    nome: 'Dano e cura',
    faz: 'Muda em % o dano que recebe ou causa e a cura que recebe; ou cura parte do dano que causa.',
    icone: 'balanca',
    cor: 'var(--lb-peca-ameixa)',
    novo: false,
    nova: () => ({ tipo: 'danoCura', recV: 25 }),
    Componente: PecaDanoCura,
  },
  gatilho: {
    familia: 'gatilho',
    nome: 'Depois de X turnos',
    faz: 'Conta os turnos e, ao chegar, dá dano, cura, põe ou tira condição. Uma vez ou a cada X.',
    icone: 'gatilho',
    cor: 'var(--lb-peca-cura)',
    novo: false,
    nova: () => ({ tipo: 'gatilho', gatilho: { turnos: 3, vezes: 'uma', aoDisparar: 'some', pecas: [{ tipo: 'dano', valor: 30 }] } }),
    Componente: PecaGatilho,
  },
  marca: {
    familia: 'marca',
    nome: 'Marca',
    faz: 'O próximo golpe nele dá mais dano; quem tem desvia com desvantagem.',
    icone: 'marca',
    cor: 'var(--lb-peca-selo)',
    novo: false,
    nova: () => ({ tipo: 'marca', mult: 2, quem: 'todos', sai: true, desvDesv: true }),
    Componente: PecaMarca,
  },
  aura: {
    familia: 'aura',
    nome: 'Aura',
    faz: 'Quem estiver perto de quem tem pega uma condição enquanto ficar perto.',
    icone: 'aura',
    cor: 'var(--lb-peca-latao)',
    novo: true,
    nova: () => ({ tipo: 'aura', casas: 1, quem: 'aliados', cond: AURA_DESTA_MESMA }),
    Componente: PecaAura,
  },
  contra: {
    familia: 'contra',
    nome: 'Contra-condição',
    faz: 'Ao entrar, apaga outras condições; enquanto durar, elas não pegam nele.',
    icone: 'contra',
    cor: 'var(--lb-peca-gelo)',
    novo: true,
    nova: () => ({ tipo: 'contra', apaga: ['queimando'], impede: true }),
    Componente: PecaContra,
  },
}

/**
 * A entrada de uma família, sempre presente (o registro está completo). Com a família de uma peça da lista
 * (`entradaDaPecaDaCondicao(peca.tipo)`), o `Componente` aceita a peça como está, como no editor de
 * habilidades (`entradaDaPeca`, components/batalha/editor/pecas/registro.ts).
 */
export function entradaDaPecaDaCondicao<F extends FamiliaDaPecaDaCondicao>(familia: F): PecaDaCondicaoNaTela<F> {
  return REGISTRO_DAS_PECAS_DA_CONDICAO[familia]
}

// ─── O boneco ──────────────────────────────────────────────────────────────

/**
 * Os ajustes do boneco (o `testeNovo` do protótipo, prototipo.html:682): quantas rodadas, o d20 fixo dos
 * testes, e em que rodada chegam o golpe (o dano e o tipo), a cura, a vez de ele bater, a mesma condição
 * de novo e o "Tentar sair"; `perto` = um aliado a 1 casa (a Aura); `ja` = ele já estava com a condição
 * que a Contra-condição apaga.
 */
export interface AjustesDoBoneco {
  rodadas: number
  d20: number
  golpeR: number
  golpeV: number
  golpeTipo: TipoDeDano
  curaR: number
  curaV: number
  bateR: number
  deNovoR: number
  tentaR: number
  perto: boolean
  ja: boolean
}

export const AJUSTES_DO_BONECO_PADRAO: AjustesDoBoneco = { rodadas: 3, d20: 9, golpeR: 2, golpeV: 30, golpeTipo: 'qualquer', curaR: 3, curaV: 40, bateR: 2, deNovoR: 2, tentaR: 3, perto: true, ja: true }

/** O boneco de treino: vida, SP, os atributos (pelo id das peças) e os modificadores dos testes. */
export interface BonecoBase {
  vida: number
  sp: number
  atr: Readonly<Record<string, number>>
  mod: Readonly<Record<string, number>>
}

/**
 * O boneco do protótipo (`BONECO`, prototipo.html:677). No motor a Velocidade é a Agilidade (D10): a ficha
 * do boneco que a E5 monta usa a Agilidade, e a Velocidade daqui é só a que o protótipo mostra.
 */
export const BONECO_BASE: BonecoBase = {
  vida: 300,
  sp: 60,
  atr: { forca: 20, agilidade: 20, percepcao: 10, resistencia: 20, intuicao: 10, espirito: 10, carisma: 5, determinacao: 10, velocidade: 30, ca: 12, dano: 0, alcance: 3 },
  mod: { forca: 2, agilidade: 2, percepcao: 1, resistencia: 2, intuicao: 1, espirito: 1, carisma: 0, determinacao: 1 },
}

/** Quais ajustes mudam algo para esta condição (a tela só mostra estes; o `relevantes` do protótipo). */
export interface AjustesQueContam {
  d20: boolean
  golpe: boolean
  cura: boolean
  bate: boolean
  deNovo: boolean
  tenta: boolean
  perto: boolean
  ja: boolean
}

export function ajustesQueContam(condicao: CondicaoMontada): AjustesQueContam {
  const { pecas, saidas, prazo } = condicao
  const danoCura = pecas.find((peca): peca is PecaDaCondicaoDa<'danoCura'> => peca.tipo === 'danoCura')
  return {
    d20: saidas.some((saida) => saida.tipo === 'teste' || (saida.tipo === 'pagar' && saida.como !== 'pagar')),
    golpe:
      danoCura?.recV !== undefined ||
      pecas.some((peca) => peca.tipo === 'marca' || (peca.tipo === 'bloqueio' && peca.itens.naoAlvo === true) || (peca.tipo === 'vez' && peca.recurso === 'escudo')) ||
      saidas.some((saida) => saida.tipo === 'dano') ||
      prazo.modo === 'proximoGolpe',
    cura: danoCura?.curaV !== undefined || saidas.some((saida) => saida.tipo === 'cura'),
    bate: danoCura?.cauV !== undefined || danoCura?.cddV !== undefined || saidas.some((saida) => saida.tipo === 'agir'),
    deNovo: prazo.deNovo === 'pilha' || (prazo.deNovo === 'renova' && prazo.modo === 'turnos'),
    tenta: saidas.some((saida) => saida.tipo === 'pagar'),
    perto: pecas.some((peca) => peca.tipo === 'aura'),
    ja: pecas.some((peca) => peca.tipo === 'contra' && peca.apaga.length > 0),
  }
}

/** A cor de uma linha do boneco: dano, cura, atributo, a condição (entra, sai, pilha) e o que ele não pôde fazer. */
export type TipoDaLinhaDoBoneco = 'dano' | 'cura' | 'atr' | 'cond' | 'nao'

/** Uma linha do que aconteceu, em pedaços (como o cartão, sem HTML). */
export interface LinhaDoBoneco {
  tipo: TipoDaLinhaDoBoneco
  frase: FraseDaCondicao
}

/** Um atributo do boneco no fim da rodada, ao lado do de partida. */
export interface AtributoNaRodada {
  atr: string
  v: number
  base: number
}

/** Uma rodada do boneco: os números no fim dela e as linhas na ordem em que aconteceram. */
export interface RodadaDoBoneco {
  rodada: number
  vida: number
  sp: number
  escudo: number
  /** Ainda está com a condição no fim da rodada. */
  ativa: boolean
  /** Começou a rodada com a condição. */
  comecou: boolean
  /** Os turnos que faltam; `null` = sem prazo em turnos (até tirarem, a batalha toda, até o próximo golpe). */
  restam: number | null
  pilhas: number
  atributos: readonly AtributoNaRodada[]
  /** Os ids das outras condições que o boneco ganhou (o gatilho, a aura). */
  outras: readonly string[]
  linhas: readonly LinhaDoBoneco[]
}

/** O ensaio inteiro: o que acontece quando ela entra, e as rodadas. */
export interface ResultadoDoBoneco {
  entrada: readonly LinhaDoBoneco[]
  rodadas: readonly RodadaDoBoneco[]
}

/** O motor do boneco (E5: `ensaiarCondicao`, lib/condicoes/ensaio.ts), o mesmo motor da batalha numa mesa em memória. */
export type MotorDoBoneco = (condicao: CondicaoMontada, ajustes: AjustesDoBoneco, contexto: ContextoDasFrases) => ResultadoDoBoneco
