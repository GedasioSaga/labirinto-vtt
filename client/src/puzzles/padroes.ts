/**
 * OS 4 MODELOS PRONTOS (Fonte, Porta de brasões, Cofre, Altar): o ponto de
 * partida do mestre, com os números do `BASE` do protótipo aprovado
 * (`docs/design/puzzles/prototipo-v2.html`). Posição e tamanho dos encaixes
 * estão em % do quadro, casados com a arte de cada modelo
 * (`puzzles/arte/modelos.ts`): mudar um número aqui desencaixa o desenho.
 *
 * O Cofre é da combinação: nasce com as rodas de números do v2 (código 318),
 * sem encaixes, e o controle no meio da porta do cofre.
 *
 * Puro: sem React, sem disco.
 */
import { combinacaoPadrao } from './combinacao'
import type {
  CastigoDoPuzzle,
  CombinacaoDoPuzzle,
  CoresDoModelo,
  EncaixeDoPuzzle,
  FormaDoEncaixe,
  IdDaPecaDesenhada,
  ModeloDoPuzzle,
  Puzzle,
  RegraDoPuzzle,
  TipoDeCastigo,
} from './tipos'

export const NOME_DO_MODELO: Readonly<Record<ModeloDoPuzzle, string>> = {
  fonte: 'Fonte',
  porta: 'Porta de brasões',
  cofre: 'Cofre',
  altar: 'Altar',
}

interface EncaixeDoModelo {
  x: number
  y: number
  t: number
  forma: FormaDoEncaixe
  /** A peça desenhada que o v2 põe neste encaixe; vira um `itemId` quando ela está no acervo. */
  peca: IdDaPecaDesenhada
}

interface PadraoDoModelo {
  regra: RegraDoPuzzle
  cores: CoresDoModelo
  inscricao: string
  encaixes: readonly EncaixeDoModelo[]
  controle: { x: number; y: number; s: number }
  /** O v1 abre a Fonte, a Porta e o Altar com a cena; o Cofre, só com o texto. */
  modoDoDesfecho: 'texto' | 'cena'
  /** A mecânica do modelo quando não é de encaixes: o Cofre é de rodas de números (o `tipo: 'numeros'` do v2). */
  combinacao?: 'numeros'
}

/** O `BASE` do v2. A Fonte aceita qualquer medalhão em qualquer encaixe (`qualquer: true`). */
export const PADROES_DOS_MODELOS: Readonly<Record<ModeloDoPuzzle, Readonly<PadraoDoModelo>>> = {
  fonte: {
    regra: 'qualquerLugar',
    cores: { parede: '#6d6556', chao: '#514a3f', objeto: '#b8b4a6' },
    inscricao: 'Aqui a água lembra',
    encaixes: [
      { x: 37, y: 52, t: 9.4, forma: 'redondo', peca: 'med-garca' },
      { x: 50, y: 45, t: 9.4, forma: 'redondo', peca: 'med-sapo' },
      { x: 63, y: 52, t: 9.4, forma: 'redondo', peca: 'med-junco' },
    ],
    controle: { x: 50, y: 66, s: 1 },
    modoDoDesfecho: 'cena',
  },
  porta: {
    regra: 'ordem',
    cores: { parede: '#625a4c', chao: '#4c453a', objeto: '#a07b51' },
    inscricao: 'Da sombra à aurora',
    encaixes: [
      { x: 33.5, y: 43, t: 8.4, forma: 'brasao', peca: 'bra-carvalho' },
      { x: 44.5, y: 43, t: 8.4, forma: 'brasao', peca: 'bra-lobo' },
      { x: 55.5, y: 43, t: 8.4, forma: 'brasao', peca: 'bra-lua' },
      { x: 66.5, y: 43, t: 8.4, forma: 'brasao', peca: 'bra-sol' },
    ],
    controle: { x: 50, y: 44, s: 1 },
    modoDoDesfecho: 'cena',
  },
  cofre: {
    regra: 'lugarCerto',
    cores: { parede: '#5e5749', chao: '#493f35', objeto: '#6a6f73' },
    inscricao: 'Conte os degraus antes de dormir.',
    encaixes: [],
    controle: { x: 50, y: 46, s: 1 },
    modoDoDesfecho: 'texto',
    combinacao: 'numeros',
  },
  altar: {
    regra: 'lugarCerto',
    cores: { parede: '#5f5749', chao: '#4b4338', objeto: '#aeab9e' },
    inscricao: 'O fogo, o céu e a roda',
    encaixes: [
      { x: 31, y: 41, t: 6.6, forma: 'joia', peca: 'joia-ambar' },
      { x: 44, y: 39, t: 6.6, forma: 'joia', peca: 'joia-safira' },
      { x: 57, y: 41, t: 8, forma: 'redondo', peca: 'engr-bronze' },
    ],
    controle: { x: 44, y: 40, s: 1 },
    modoDoDesfecho: 'cena',
  },
}

/** Nome e descrição das 13 peças desenhadas (`PECAS_BASE` do v2): o que o "Pôr no acervo" grava no item. */
export const PECAS_DESENHADAS: Readonly<Record<IdDaPecaDesenhada, { nome: string; descricao: string }>> = {
  'bra-carvalho': { nome: 'Brasão do Carvalho', descricao: 'Escudo verde com uma árvore larga.' },
  'bra-lobo': { nome: 'Brasão do Lobo', descricao: 'Escudo azul com uma cabeça de lobo.' },
  'bra-lua': { nome: 'Brasão da Lua', descricao: 'Escudo prateado com uma lua crescente.' },
  'bra-sol': { nome: 'Brasão do Sol', descricao: 'Escudo cor de telha com um sol de oito raios.' },
  'chave-jardim': { nome: 'Chave de ferro', descricao: 'Pesada, de dentes gastos.' },
  'chave-latao': { nome: 'Chave de latão', descricao: 'A argola tem três folhas.' },
  'engr-bronze': { nome: 'Engrenagem de bronze', descricao: 'Oito dentes, um deles lascado.' },
  'engr-ferro': { nome: 'Engrenagem de ferro', descricao: 'Pequena, com um furo quadrado no meio.' },
  'joia-ambar': { nome: 'Joia âmbar', descricao: 'Quente na mão. Quatro riscos na base.' },
  'joia-safira': { nome: 'Joia safira', descricao: 'Fria e azul. Um risco na base.' },
  'med-garca': { nome: 'Medalhão da Garça', descricao: 'Latão gasto. Uma garça de pescoço longo em relevo.' },
  'med-sapo': { nome: 'Medalhão do Sapo', descricao: 'Latão com limo nas bordas. Um sapo sentado.' },
  'med-junco': { nome: 'Medalhão do Junco', descricao: 'Latão. Três juncos dobrados pelo vento.' },
}

/** O texto do desfecho de todo puzzle novo (v2). */
export const TEXTO_DO_DESFECHO_PADRAO = 'Algo cede com um estalo.'

/** O que acontece quando o mestre não escreve o texto do castigo (`CASTIGO_PADRAO` do v2). */
export const TEXTO_DO_CASTIGO_PADRAO: Readonly<Record<Exclude<TipoDeCastigo, 'nada'>, string>> = {
  dano: 'Um choque sobe pelas mãos',
  armadilha: 'Uma armadilha dispara.',
  barulho: 'Um estrondo ecoa pelo corredor. O mestre ouviu.',
}

/** O dano que o v2 sugere ao ligar o castigo. */
export const PV_DO_CASTIGO_PADRAO = 3

/** O castigo novo de cada tipo, com o texto vazio: a tela cai no `TEXTO_DO_CASTIGO_PADRAO`. */
export function castigoPadrao(tipo: TipoDeCastigo): CastigoDoPuzzle {
  switch (tipo) {
    case 'nada':
      return { tipo: 'nada' }
    case 'dano':
      return { tipo: 'dano', pv: PV_DO_CASTIGO_PADRAO, texto: '' }
    case 'armadilha':
      return { tipo: 'armadilha', pv: PV_DO_CASTIGO_PADRAO, texto: '' }
    case 'barulho':
      return { tipo: 'barulho', texto: '' }
  }
}

/** O peso que o v1 pede no pedestal do Altar. */
export const PESO_DA_TROCA_PADRAO = 4
/** O centro do pedestal e da bandeja do v1 (`left 69,4%`, `top 12%`, `19,4% x 84%`). */
export const POSICAO_DA_TROCA_PADRAO: Readonly<{ x: number; y: number }> = { x: 79, y: 54 }

/**
 * Um puzzle novo a partir do modelo `modelo`, com cópia própria de tudo (nunca
 * a constante). `pecas` liga a peça desenhada ao item do acervo
 * (`ItemDoCatalogo.id`); a que não estiver lá deixa o encaixe sem peça certa,
 * para o mestre escolher. Os ids dos encaixes só precisam ser únicos dentro do puzzle.
 */
export function puzzleDoModelo(modelo: ModeloDoPuzzle, pecas: Partial<Record<IdDaPecaDesenhada, string>> = {}): Puzzle {
  const padrao = PADROES_DOS_MODELOS[modelo]
  const encaixes: EncaixeDoPuzzle[] = padrao.encaixes.map((encaixe, i) => ({
    id: `e${i + 1}`,
    x: encaixe.x,
    y: encaixe.y,
    t: encaixe.t,
    forma: encaixe.forma,
    jeito: 'peca',
    itemId: pecas[encaixe.peca] ?? null,
  }))
  const puzzle: Puzzle = {
    nome: `Puzzle novo (${NOME_DO_MODELO[modelo]})`,
    nomePublico: NOME_DO_MODELO[modelo],
    regra: padrao.regra,
    visual: { tipo: 'modelo', modelo, cores: { ...padrao.cores }, inscricao: padrao.inscricao, moldura: 'original' },
    encaixes,
    troca: null,
    dica: { tipo: 'texto', texto: '' },
    desfecho: { modo: padrao.modoDoDesfecho, texto: TEXTO_DO_DESFECHO_PADRAO, itens: [], moedas: 0, documentos: [], abrePorta: false },
    castigo: castigoPadrao('nada'),
    controle: { ...padrao.controle },
  }
  const combinacao: CombinacaoDoPuzzle | null = padrao.combinacao === undefined ? null : combinacaoPadrao(padrao.combinacao)
  if (combinacao !== null) puzzle.futuro = combinacao
  return puzzle
}

/** A moldura Porta só existe nos modelos que não são porta; a Porta de brasões já é porta. */
export function aceitaMolduraPorta(modelo: ModeloDoPuzzle): boolean {
  return modelo !== 'porta'
}

/** O visual abre uma porta ao resolver: o modelo Porta de brasões ou a moldura Porta. Só aqui vale `abrePorta`. */
export function visualEhPorta(visual: Puzzle['visual']): boolean {
  return visual.tipo === 'modelo' && (visual.modelo === 'porta' || visual.moldura === 'porta')
}
