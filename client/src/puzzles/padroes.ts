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
  TipoDaPecaDesenhada,
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

/** Nome e descrição de cada peça desenhada (as 13 do `PECAS_BASE` do v2 e o catálogo de 21/11): o que o "Pôr no acervo" grava no item. */
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
  // O catálogo grande de 21/11: para pôr num encaixe.
  'med-cervo': { nome: 'Medalhão do Cervo', descricao: 'Latão. Um cervo de chifres largos, de frente.' },
  'med-coruja': { nome: 'Medalhão da Coruja', descricao: 'Prata escurecida. Uma coruja de olhos grandes.' },
  'med-peixe': { nome: 'Medalhão do Peixe', descricao: 'Bronze. Um peixe nadando sobre as ondas.' },
  'med-serpente': { nome: 'Medalhão da Serpente', descricao: 'Latão. Uma serpente enrolada em espiral.' },
  'joia-esmeralda': { nome: 'Joia esmeralda', descricao: 'Verde, lapidada em degraus. Fria ao toque.' },
  'joia-rubi': { nome: 'Joia rubi', descricao: 'Vermelha e redonda. Pesa mais do que parece.' },
  'joia-ametista': { nome: 'Joia ametista', descricao: 'Roxa, em forma de gota.' },
  'joia-onix': { nome: 'Joia de ônix', descricao: 'Negra e lisa, com um anel claro por dentro.' },
  'engr-latao': { nome: 'Engrenagem de latão', descricao: 'Doze dentes finos e um furo quadrado.' },
  'engr-cobre': { nome: 'Engrenagem de cobre', descricao: 'Dez dentes, avermelhada pelo tempo.' },
  'olho-jade': { nome: 'Olho de jade', descricao: 'Olho de estátua: mármore com a íris verde.' },
  'olho-obsidiana': { nome: 'Olho de obsidiana', descricao: 'Olho de estátua: mármore com a íris negra.' },
  'bra-torre': { nome: 'Brasão da Torre', descricao: 'Escudo vermelho com uma torre de ameias.' },
  'bra-corvo': { nome: 'Brasão do Corvo', descricao: 'Escudo negro com um corvo pousado.' },
  'bra-rosa': { nome: 'Brasão da Rosa', descricao: 'Escudo dourado com uma rosa de caule longo.' },
  'fig-cavalo': { nome: 'Estatueta do cavalo', descricao: 'Madeira escura. Uma cabeça de cavalo sobre a base.' },
  'fig-gato': { nome: 'Estatueta do gato', descricao: 'Pedra negra polida. Os olhos são de ouro.' },
  manivela: { nome: 'Manivela de ferro', descricao: 'Ponta quadrada e cabo de madeira.' },
  'orbe-cristal': { nome: 'Orbe de cristal', descricao: 'Claro, numa base de bronze. Algo se move dentro.' },
  'orbe-sombra': { nome: 'Orbe de sombra', descricao: 'Escuro e frio, numa base de ferro.' },
  'placa-runas': { nome: 'Placa de bronze', descricao: 'Rebites nos cantos e três runas gravadas.' },
  'mascara-ouro': { nome: 'Máscara de ouro', descricao: 'Rosto sereno, de olhos em fenda.' },
  'mascara-prata': { nome: 'Máscara de prata', descricao: 'Um sorriso largo. Fitas azuis nos lados.' },
  'tabua-runas': { nome: 'Tábua de runas', descricao: 'Pedra com seis runas em duas linhas.' },
  'disco-eclipse': { nome: 'Disco do eclipse', descricao: 'Bronze. Metade sol, metade lua.' },
  'espelho-bronze': { nome: 'Espelho de bronze', descricao: 'De mão. O reflexo parece atrasado.' },
  'selo-real': { nome: 'Selo real', descricao: 'Cera vermelha com uma coroa em relevo.' },
  'estrela-prata': { nome: 'Estrela de prata', descricao: 'Oito pontas e uma pedra azul no meio.' },
  'coroa-bronze': { nome: 'Coroa de bronze', descricao: 'Pequena, de três pontas, com três pedras.' },
  // Para juntar: duas metades, num encaixe de "Duas metades", viram a peça inteira.
  'metade-tabua-esq': { nome: 'Tábua de runas, metade esquerda', descricao: 'Pedra partida. Com a outra metade, vira a Tábua de runas.' },
  'metade-tabua-dir': { nome: 'Tábua de runas, metade direita', descricao: 'Pedra partida. Com a outra metade, vira a Tábua de runas.' },
  'metade-disco-sol': { nome: 'Disco do eclipse, lado do sol', descricao: 'Bronze partido. Com o lado da lua, vira o Disco do eclipse.' },
  'metade-disco-lua': { nome: 'Disco do eclipse, lado da lua', descricao: 'Bronze partido. Com o lado do sol, vira o Disco do eclipse.' },
  'metade-espelho-esq': { nome: 'Espelho de bronze, metade esquerda', descricao: 'Partido ao meio. Com a outra metade, vira o Espelho de bronze.' },
  'metade-espelho-dir': { nome: 'Espelho de bronze, metade direita', descricao: 'Partido ao meio. Com a outra metade, vira o Espelho de bronze.' },
  'metade-selo-esq': { nome: 'Selo real, metade esquerda', descricao: 'Cera partida. Com a outra metade, vira o Selo real.' },
  'metade-selo-dir': { nome: 'Selo real, metade direita', descricao: 'Cera partida. Com a outra metade, vira o Selo real.' },
  'metade-estrela-esq': { nome: 'Estrela de prata, metade esquerda', descricao: 'Partida ao meio. Com a outra metade, vira a Estrela de prata.' },
  'metade-estrela-dir': { nome: 'Estrela de prata, metade direita', descricao: 'Partida ao meio. Com a outra metade, vira a Estrela de prata.' },
  'metade-coroa-esq': { nome: 'Coroa de bronze, metade esquerda', descricao: 'Partida ao meio. Com a outra metade, vira a Coroa de bronze.' },
  'metade-coroa-dir': { nome: 'Coroa de bronze, metade direita', descricao: 'Partida ao meio. Com a outra metade, vira a Coroa de bronze.' },
  'metade-cervo-esq': { nome: 'Medalhão do Cervo, metade esquerda', descricao: 'Latão partido. Com a outra metade, vira o Medalhão do Cervo.' },
  'metade-cervo-dir': { nome: 'Medalhão do Cervo, metade direita', descricao: 'Latão partido. Com a outra metade, vira o Medalhão do Cervo.' },
  'metade-mascara-esq': { nome: 'Máscara de ouro, metade esquerda', descricao: 'Partida ao meio. Com a outra metade, vira a Máscara de ouro.' },
  'metade-mascara-dir': { nome: 'Máscara de ouro, metade direita', descricao: 'Partida ao meio. Com a outra metade, vira a Máscara de ouro.' },
  'metade-torre-esq': { nome: 'Brasão da Torre, metade esquerda', descricao: 'Escudo partido. Com a outra metade, vira o Brasão da Torre.' },
  'metade-torre-dir': { nome: 'Brasão da Torre, metade direita', descricao: 'Escudo partido. Com a outra metade, vira o Brasão da Torre.' },
  'metade-chave-argola': { nome: 'Chave do sol, argola', descricao: 'Quebrada na haste. Com a outra parte, vira a Chave do sol.' },
  'metade-chave-haste': { nome: 'Chave do sol, haste', descricao: 'Os dentes e a haste. Com a argola, vira a Chave do sol.' },
  // Chaves.
  'chave-espadas': { nome: 'Chave de espadas', descricao: 'Ferro. A argola é o naipe de espadas.' },
  'chave-copas': { nome: 'Chave de copas', descricao: 'Bronze. A argola é o naipe de copas.' },
  'chave-ouros': { nome: 'Chave de ouros', descricao: 'Ouro. A argola é o naipe de ouros.' },
  'chave-paus': { nome: 'Chave de paus', descricao: 'Ferro escuro. A argola é o naipe de paus.' },
  'chave-sol': { nome: 'Chave do sol', descricao: 'Ouro. A argola é um sol de doze raios.' },
  'chave-lua': { nome: 'Chave da lua', descricao: 'Prata. A argola é uma lua crescente.' },
  'chave-estrela': { nome: 'Chave da estrela', descricao: 'Prata. A argola é uma estrela de cinco pontas.' },
  'chave-aguia': { nome: 'Chave da águia', descricao: 'Bronze. Uma águia de asas abertas.' },
  'chave-serpente': { nome: 'Chave da serpente', descricao: 'Bronze verde. Uma serpente enrolada faz a argola.' },
  'chave-coroa': { nome: 'Chave da coroa', descricao: 'Ouro. A argola é uma coroa de três pontas.' },
  'chave-pedra': { nome: 'Chave de pedra', descricao: 'Grossa e pesada, com uma rachadura na argola.' },
  'chave-osso': { nome: 'Chave de osso', descricao: 'Talhada num osso comprido.' },
  'chave-cranio': { nome: 'Chave do crânio', descricao: 'Osso. A argola é um crânio pequeno.' },
  'chave-mestra': { nome: 'Chave mestra', descricao: 'Ferro. Quatro folhas na argola e dentes dos dois lados.' },
  'chave-roda': { nome: 'Chave da roda', descricao: 'Latão. A argola é uma engrenagem.' },
}

/** O nome de cada tipo de peça na biblioteca do editor, no seletor e na vitrine do acervo. */
export const NOME_DO_TIPO_DA_PECA: Readonly<Record<TipoDaPecaDesenhada, string>> = {
  encaixe: 'Para encaixar',
  metade: 'Para juntar',
  chave: 'Chaves',
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
