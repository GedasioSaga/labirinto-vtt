import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ImagemDaMesa } from '../../../components/ImagemDaMesa'
import { idDoItemDaPeca } from '../../../lib/acervoDeItens'
import { resolverComBase, URL_DA_MIDIA_NA_SALA, type ResolverDeImagem } from '../../../lib/midia'
import { IDS_DAS_PECAS_DESENHADAS, urlDaPeca } from '../../../puzzles/arte/pecas'
import { agirNoPuzzle, progressoInicial } from '../../../puzzles/motor'
import { camadasPadrao, descricaoDaLamina, idDoItemDaLamina, marcasDas, nomeDaLamina, puzzleDasCamadas } from '../../../puzzles/camadas/camadas'
import { figuraDeFabrica, pngDaLamina } from '../../../puzzles/camadas/raster'
import { combinacaoPadrao } from '../../../puzzles/combinacao'
import { giratoriasPadrao } from '../../../puzzles/giratorias/giratorias'
import { interruptoresPadrao } from '../../../puzzles/interruptores/interruptores'
import { misturaPadrao } from '../../../puzzles/mistura/mistura'
import { cooperacaoPadrao } from '../../../puzzles/cooperacao/cooperacao'
import { PECAS_DESENHADAS, puzzleDoModelo } from '../../../puzzles/padroes'
import { canvasDoPainel, pngDaPlaca } from '../../../puzzles/relevo/raster'
import { poligonoDaPlaca } from '../../../puzzles/relevo/placas'
import { descricaoDaPlaca, idDoItemDaPlaca, nomeDaPlaca, placasDoPuzzle, puzzleDoRelevo, visualDoRelevo } from '../../../puzzles/relevo/relevo'
import { CATEGORIA_DA_PECA_DE_PUZZLE, CENAS_DO_RELEVO, METAIS_DO_RELEVO } from '../../../puzzles/tipos'
import type { CamadasDoPuzzle, CooperacaoDoPuzzle, DeslizantesDoPuzzle, IdDaPecaDesenhada, PecaDoAcervo, ProgressoDoPuzzle, Puzzle, QuemMexe } from '../../../puzzles/tipos'
import { deslizantesPadrao, pecasQueDeslizam, tabuleiroNoProgresso } from '../../../puzzles/deslizantes/deslizantes'
import { themeCss } from '../../../theme'
import type { CarriedItem } from '../../../types/map'
import { useJogoLocalDoPuzzle, type JogoLocalDoPuzzle } from '../jogoLocal'
import { TelaDoPuzzle } from '../TelaDoPuzzle'

/**
 * VITRINE DA TELA DO JOGADOR NO PUZZLE — só para desenvolvimento e provas, fora
 * do build (não está nas entradas do vite.config.ts). O motor e o recorte de
 * verdade rodam no navegador (`jogoLocal.ts`), no lugar do host, até a ligação
 * com a rede (onda 4). Sair mostra o puzzle "de fora"; Examinar volta com
 * tudo guardado.
 *
 *   npm run dev  ->  http://localhost:1420/src/player/puzzle/vitrine/vitrine.html
 *   ?puzzle=fonte (padrão) | porta | altar | imagem | relevo (com &cena=dragao &metal=bronze)
 *   ?puzzle=giro (o medalhão da cena) | giroSimbolos | giroVizinhas (6 anéis, cada um leva os do lado)
 *   ?puzzle=luzes (6 lampiões, os do lado) | luzesDesenho (9 em 3 x 3, igual à plaqueta) | luzesRegra (5 em fila, a regra do mestre, ferro)
 *   ?puzzle=liquidos (jarras de 3 e 5, medir 4 L) | liquidosCores (o laranja 2:1) | liquidosReceita (erva e enxofre, ferro)
 *   ?puzzle=coop (dois pontos, a Lara na Cripta) | coopTres (três pontos, ferro); &ponto=2 põe a Lara no ponto 2
 *   ?puzzle=camadas (o farol em vidro, 3 lâminas que giram) | camadasPapel (a rosa, 4, giro e ordem) | camadasFerro (o código K7X2, só a ordem)
 *   ?desfecho=texto | cena   (troca o modo do desfecho do puzzle escolhido)
 *   window.__vitrinePuzzle.estado()  o progresso, a mochila e os PV de agora
 */

const parametros = new URLSearchParams(location.search)

const estilo = document.createElement('style')
estilo.textContent = `${themeCss()}\nbody { font-family: var(--lb-font-sans); color: var(--lb-color-parchment); }`
document.head.append(estilo)

// A vitrine desenha as peças pelo SVG de `arte/pecas.ts`, sem gravar na mídia; o resto como na sala.
const daSala = resolverComBase(URL_DA_MIDIA_NA_SALA)
// As placas do relevo saem do canvas do painel como blob: (no app, elas vão para a mídia do acervo).
const resolverDaVitrine: ResolverDeImagem = (valor) => (typeof valor === 'string' && (valor.startsWith('data:image/svg+xml') || valor.startsWith('blob:')) ? valor : daSala(valor))

// ------------------------------------------------------------------ o acervo de mentira

function pecaDesenhada(id: IdDaPecaDesenhada): PecaDoAcervo {
  return { nome: PECAS_DESENHADAS[id].nome, descricao: PECAS_DESENHADAS[id].descricao, imagem: urlDaPeca(id), categoria: CATEGORIA_DA_PECA_DE_PUZZLE, itemId: idDoItemDaPeca(id) }
}

function pecaSemDesenho(itemId: string, nome: string): PecaDoAcervo {
  return { nome, categoria: CATEGORIA_DA_PECA_DE_PUZZLE, itemId }
}

const PEDRAS = {
  leve: pecaSemDesenho('item_pedra_leve', 'Pedra de rio'),
  media: pecaSemDesenho('item_pedra_media', 'Pedra de muro'),
  pesada: pecaSemDesenho('item_pedra_pesada', 'Pedra de moinho'),
}
const METADES = {
  dentes: pecaSemDesenho('item_metade_dentes', 'Metade com dentes'),
  eixo: pecaSemDesenho('item_metade_eixo', 'Metade com eixo'),
}
const CORDA: PecaDoAcervo = { nome: 'Corda de cânhamo', categoria: 'Ferramenta', itemId: 'item_corda' }
const POCAO: PecaDoAcervo = { nome: 'Poção vermelha', categoria: 'Consumível', itemId: 'item_pocao', quantidade: 2 }

const ACERVO = new Map<string, PecaDoAcervo>(
  [...IDS_DAS_PECAS_DESENHADAS.map(pecaDesenhada), ...Object.values(PEDRAS), ...Object.values(METADES), CORDA, POCAO].flatMap((peca) =>
    peca.itemId === undefined ? [] : [[peca.itemId, peca] as const],
  ),
)

function pecaDoAcervo(itemId: string): PecaDoAcervo | null {
  return ACERVO.get(itemId) ?? null
}

let vagas = 0
function vaga(peca: PecaDoAcervo): CarriedItem {
  vagas += 1
  return { ...peca, id: `vaga-${vagas}` }
}

const EU: QuemMexe = { personagemId: 'p-lara', tokenId: 't-lara', nome: 'Lara' }
const BENTO: QuemMexe = { personagemId: 'p-bento', tokenId: 't-bento', nome: 'Bento' }
const CORA: QuemMexe = { personagemId: 'p-cora', tokenId: 't-cora', nome: 'Cora' }

// ------------------------------------------------------------------ os puzzles de exemplo (os do protótipo)

interface Exemplo {
  puzzle: Puzzle
  mochila: CarriedItem[]
  progresso?: ProgressoDoPuzzle
  /** A cooperação: o ponto onde a Lara está (o host conferiria pela ficha). */
  ponto?: number
}

function pecasDoModelo(ids: IdDaPecaDesenhada[]): Partial<Record<IdDaPecaDesenhada, string>> {
  return Object.fromEntries(ids.map((id) => [id, idDoItemDaPeca(id)]))
}

function fonte(): Exemplo {
  const puzzle = puzzleDoModelo('fonte', pecasDoModelo(['med-garca', 'med-sapo', 'med-junco']))
  puzzle.nomePublico = 'Fonte das Três Garças'
  puzzle.dica = { tipo: 'texto', texto: 'Três bicos secos. Cada um espera um medalhão.' }
  puzzle.desfecho = {
    modo: 'cena',
    texto: 'A água volta a correr pelos três bicos. No fundo da bacia, uma chave pequena brilha.',
    itens: [{ item: pecaDesenhada('chave-jardim'), quantidade: 1 }],
    moedas: 12,
    documentos: [],
    abrePorta: false,
  }
  // Bento já pôs o Sapo no encaixe do meio: o "posto por Bento".
  const progresso = progressoInicial(puzzle)
  progresso.encaixes.e2 = { vaga: vaga(pecaDesenhada('med-sapo')), por: BENTO }
  progresso.rev = 1
  const mochila = [vaga(pecaDesenhada('med-garca')), vaga(CORDA), vaga(pecaDesenhada('med-junco')), vaga(pecaDesenhada('chave-latao')), vaga(POCAO), vaga(pecaDesenhada('engr-ferro'))]
  return { puzzle, mochila, progresso }
}

function porta(): Exemplo {
  const puzzle = puzzleDoModelo('porta', pecasDoModelo(['bra-carvalho', 'bra-lobo', 'bra-lua', 'bra-sol']))
  puzzle.nomePublico = 'Porta dos Quatro Brasões'
  puzzle.dica = { tipo: 'texto', texto: 'Da sombra à aurora.' }
  puzzle.castigo = { tipo: 'dano', pv: 3, texto: 'Dardos saem das frestas da porta.' }
  puzzle.desfecho = { modo: 'cena', texto: 'Os quatro brasões afundam juntos. A tranca cede e a porta range para dentro.', itens: [], moedas: 0, documentos: [], abrePorta: true }
  const mochila = (['bra-sol', 'bra-lua', 'bra-lobo', 'bra-carvalho', 'chave-latao'] as const).map((id) => vaga(pecaDesenhada(id)))
  return { puzzle, mochila }
}

function altar(): Exemplo {
  const puzzle = puzzleDoModelo('altar', pecasDoModelo(['joia-ambar', 'joia-safira', 'engr-bronze']))
  puzzle.nomePublico = 'Altar da Roda'
  const [primeiro, segundo, terceiro] = puzzle.encaixes
  if (primeiro !== undefined && segundo !== undefined && terceiro !== undefined) {
    // O terceiro encaixe pede as duas metades: juntas, viram a engrenagem de bronze.
    puzzle.encaixes = [primeiro, segundo, { ...terceiro, jeito: 'metades', metades: [METADES.dentes.itemId ?? null, METADES.eixo.itemId ?? null], vira: { nome: 'Engrenagem de bronze', imagem: urlDaPeca('engr-bronze') } }]
  }
  puzzle.troca = {
    guarda: idDoItemDaPeca('joia-ambar'),
    peso: 4,
    pesos: { [PEDRAS.leve.itemId ?? '']: 1, [PEDRAS.media.itemId ?? '']: 2, [PEDRAS.pesada.itemId ?? '']: 3 },
    x: 79,
    y: 54,
  }
  puzzle.dica = { tipo: 'texto', texto: 'O fogo, o céu e a roda. A joia quente só sai por um peso igual.' }
  puzzle.castigo = { tipo: 'armadilha', pv: 2, texto: 'Uma lâmina corre rente ao pedestal.' }
  puzzle.desfecho = {
    modo: 'texto',
    texto: 'O altar range. Uma gaveta de pedra desliza para fora com um cálice e uma poção.',
    itens: [
      { item: { nome: 'Cálice de prata', categoria: 'Tesouro', itemId: 'item_calice' }, quantidade: 1 },
      { item: { ...POCAO, quantidade: undefined }, quantidade: 1 },
    ],
    moedas: 0,
    documentos: [],
    abrePorta: false,
  }
  const mochila = [vaga(pecaDesenhada('joia-safira')), vaga(METADES.dentes), vaga(METADES.eixo), vaga(PEDRAS.leve), vaga(PEDRAS.media), vaga(PEDRAS.pesada), vaga(pecaDesenhada('engr-ferro'))]
  return { puzzle, mochila }
}

function imagem(): Exemplo {
  const base = puzzleDoModelo('fonte', pecasDoModelo(['chave-jardim', 'chave-latao']))
  const puzzle: Puzzle = {
    ...base,
    nomePublico: 'Baú do escrivão',
    regra: 'lugarCerto',
    visual: { tipo: 'imagem', imagem: null },
    encaixes: [
      { id: 'e1', x: 40, y: 50, t: 9, forma: 'quadrado', jeito: 'peca', itemId: idDoItemDaPeca('chave-jardim') },
      { id: 'e2', x: 60, y: 50, t: 9, forma: 'quadrado', jeito: 'peca', itemId: idDoItemDaPeca('chave-latao') },
    ],
    desfecho: { modo: 'cena', texto: 'As duas fechaduras cedem ao mesmo tempo.', itens: [], moedas: 5, documentos: [], abrePorta: false },
  }
  const mochila = [vaga(pecaDesenhada('chave-latao')), vaga(pecaDesenhada('chave-jardim')), vaga(pecaDesenhada('joia-safira'))]
  return { puzzle, mochila }
}

/** O Cofre do Capitão do v2 (passo "Cadeia"): rodas de números, código 318, com dano ao errar. */
function cofre(): Exemplo {
  const puzzle = puzzleDoModelo('cofre')
  puzzle.nomePublico = 'Cofre do Capitão'
  puzzle.dica = { tipo: 'texto', texto: 'Conte os degraus antes de dormir.' }
  puzzle.castigo = { tipo: 'dano', pv: 3, texto: '' }
  puzzle.desfecho = { modo: 'cena', texto: 'A porta do cofre gira nas dobradiças. Dentro, um diário encadernado em couro.', itens: [], moedas: 30, documentos: [], abrePorta: false }
  return { puzzle, mochila: [vaga(CORDA), vaga(POCAO)] }
}

/** As outras três combinações do v2, sobre o mesmo Cofre (`?puzzle=simbolos`, `relogio`, `botoes`). */
function combinacaoNoCofre(forma: 'simbolos' | 'relogio' | 'botoes', nome: string, castigo: Puzzle['castigo']): () => Exemplo {
  return () => {
    const exemplo = cofre()
    exemplo.puzzle.futuro = combinacaoPadrao(forma)
    exemplo.puzzle.nomePublico = nome
    exemplo.puzzle.castigo = castigo
    return exemplo
  }
}

/**
 * O painel em relevo (28/11): `?puzzle=relevo&cena=dragao&metal=bronze`. As placas são recortadas do mesmo
 * painel que o jogador vê, como no editor. Bento já pôs uma; na mochila, as outras três e duas coisas que não são placa.
 */
async function relevo(): Promise<Exemplo> {
  const cena = CENAS_DO_RELEVO.find((candidata) => candidata === parametros.get('cena')) ?? 'dragao'
  const metal = METAIS_DO_RELEVO.find((candidato) => candidato === parametros.get('metal')) ?? 'bronze'
  const visual = visualDoRelevo(cena, metal)
  const base = puzzleDoRelevo(visual, 4)
  const puzzle: Puzzle = { ...base, desfecho: { ...base.desfecho, abrePorta: true } }
  const painel = await canvasDoPainel(cena, metal)
  const placas = await Promise.all(
    placasDoPuzzle(puzzle).map(async (placa): Promise<PecaDoAcervo> => {
      const bytes = await pngDaPlaca(painel, poligonoDaPlaca(cena, placa))
      const imagem = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'image/png' }))
      return { nome: nomeDaPlaca(visual, placa), descricao: descricaoDaPlaca(visual), imagem, categoria: CATEGORIA_DA_PECA_DE_PUZZLE, itemId: idDoItemDaPlaca(visual, placa) ?? undefined }
    }),
  )
  const [primeira, segunda, terceira, quarta] = placas
  const [vao] = puzzle.encaixes
  if (primeira === undefined || segunda === undefined || terceira === undefined || quarta === undefined || vao === undefined) throw new Error('o painel da vitrine nasceu sem as 4 placas')
  const progresso = progressoInicial(puzzle)
  progresso.encaixes[vao.id] = { vaga: vaga(primeira), por: BENTO }
  progresso.rev = 1
  return { puzzle, mochila: [vaga(terceira), vaga(CORDA), vaga(quarta), vaga(segunda), vaga(POCAO)], progresso }
}

/** As peças giratórias (28/11): o medalhão do dragão, o de símbolos em pedra e o difícil de 6 anéis. Semente fixa. */
function medalhao(nomePublico: string, mudar: Partial<ReturnType<typeof giratoriasPadrao>>): () => Exemplo {
  return () => {
    const puzzle = puzzleDoModelo('fonte')
    puzzle.nomePublico = nomePublico
    puzzle.encaixes = []
    puzzle.futuro = { ...giratoriasPadrao(424242), ...mudar }
    puzzle.dica = { tipo: 'texto', texto: 'O que foi partido volta a ser inteiro quando tudo olha para cima.' }
    puzzle.desfecho = { modo: 'cena', texto: 'O último anel encaixa com um estalo surdo. O medalhão afunda na parede e a passagem se abre.', itens: [], moedas: 0, documentos: [], abrePorta: true }
    return { puzzle, mochila: [vaga(CORDA)] }
  }
}

/** Os interruptores com estado (28/11): o painel de latão dos lados, o 3 x 3 da plaqueta e a fila de ferro com regra própria. Semente fixa. */
function painel(nomePublico: string, mudar: Partial<ReturnType<typeof interruptoresPadrao>>): () => Exemplo {
  return () => {
    const puzzle = puzzleDoModelo('fonte')
    puzzle.nomePublico = nomePublico
    puzzle.encaixes = []
    puzzle.futuro = { ...interruptoresPadrao(777), ...mudar }
    puzzle.dica = { tipo: 'texto', texto: 'O gás corre pelos canos de um lampião ao outro: quem abre um, mexe nos vizinhos.' }
    puzzle.desfecho = { modo: 'cena', texto: 'O último lampião pega e a chapa inteira estala. A parede range e a passagem se abre.', itens: [], moedas: 0, documentos: [], abrePorta: true }
    return { puzzle, mochila: [vaga(CORDA)] }
  }
}

/** A mistura de líquidos (28/11): as jarras de 3 e 5 com torneira, as tintas do laranja e a receita com dois itens na mochila. */
function bancada(nomePublico: string, mudar: Partial<ReturnType<typeof misturaPadrao>>, mochila: CarriedItem[] = [vaga(CORDA)]): () => Exemplo {
  return () => {
    const puzzle = puzzleDoModelo('fonte')
    puzzle.nomePublico = nomePublico
    puzzle.encaixes = []
    puzzle.futuro = { ...misturaPadrao(), ...mudar }
    puzzle.dica = { tipo: 'texto', texto: 'Só a medida exata abre o funil.' }
    puzzle.desfecho = { modo: 'cena', texto: 'A mistura desce pelo funil e o visor acende. Algo destrava atrás da parede.', itens: [], moedas: 0, documentos: [], abrePorta: true }
    return { puzzle, mochila }
  }
}

/**
 * Sobrepor camadas (28/11): `?puzzle=camadas` (o farol em vidro pintado, 3
 * lâminas que giram), `camadasPapel` (a rosa em papel vegetal, 4 lâminas, giro
 * e ordem) e `camadasFerro` (o código K7X2 na grade de ferro, só a ordem). As
 * lâminas saem com o PNG de verdade (`raster.ts`); o Bento já pôs uma na mesa
 * (pelo motor, como o host faria). Na mochila, as outras e uma corda.
 */
async function camadas(nomePublico: string, mudar: Partial<CamadasDoPuzzle>, quantas: number): Promise<Exemplo> {
  const mesa: CamadasDoPuzzle = { ...camadasPadrao(1847), ...mudar }
  const base = puzzleDasCamadas(puzzleDoModelo('fonte'), mesa, quantas)
  const puzzle: Puzzle = { ...base, nomePublico, desfecho: { ...base.desfecho, abrePorta: true } }
  const figura = await figuraDeFabrica(mesa)
  const laminas = await Promise.all(
    marcasDas(mesa, quantas).map(async (marca): Promise<PecaDoAcervo> => {
      const bytes = await pngDaLamina(mesa, quantas, marca, figura)
      const imagem = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'image/png' }))
      const peca: PecaDoAcervo = { nome: nomeDaLamina(mesa, marca), descricao: descricaoDaLamina(mesa), imagem, categoria: CATEGORIA_DA_PECA_DE_PUZZLE, itemId: idDoItemDaLamina(mesa, quantas, marca) }
      ACERVO.set(idDoItemDaLamina(mesa, quantas, marca), peca)
      return peca
    }),
  )
  const [doBento, ...minhas] = laminas
  if (doBento === undefined) throw new Error('a mesa da vitrine nasceu sem lâminas')
  const daMesa = vaga(doBento)
  let n = 0
  const pelo = { quem: BENTO, agora: Date.now(), modo: 'jogo' as const, pecaDoAcervo, novoId: () => `vitrine-${++n}` }
  const posta = agirNoPuzzle(puzzle, progressoInicial(puzzle), [daMesa], { tipo: 'empilhar', vagaId: daMesa.id }, pelo)
  // A ordem embaralhada (a semente fixa), para a mochila não entregar a ordem certa.
  const [a, b, c, d] = minhas
  const mochila = [c, a, d, b].flatMap((peca) => (peca === undefined ? [] : [vaga(peca)]))
  return { puzzle, mochila: [...mochila.slice(0, 1), vaga(CORDA), ...mochila.slice(1)], progresso: posta.progresso }
}

const ERVA: PecaDoAcervo = { nome: 'Erva verde', categoria: 'Ingrediente', itemId: 'item_erva' }
const PO: PecaDoAcervo = { nome: 'Pó de enxofre', categoria: 'Ingrediente', itemId: 'item_po' }

/**
 * A cooperação em dois lugares (28/11): a Lara está num ponto; o Bento, no
 * outro, aciona pelo `window.__vitrinePuzzle.colega(ponto)`. `&ponto=2` põe a
 * Lara no ponto 2.
 */
function cooperacao(nomePublico: string, mudar: Partial<CooperacaoDoPuzzle>): () => Exemplo {
  return () => {
    const puzzle = puzzleDoModelo('fonte')
    puzzle.nomePublico = nomePublico
    puzzle.encaixes = []
    puzzle.futuro = { ...cooperacaoPadrao(), ...mudar }
    puzzle.dica = { tipo: 'texto', texto: 'Uma alavanca sozinha não segura o portão: alguém precisa estar do outro lado.' }
    puzzle.desfecho = { modo: 'cena', texto: 'Os dois lampiões ardem juntos. As correntes do portão correm pelas roldanas e a grade sobe.', itens: [], moedas: 0, documentos: [], abrePorta: true }
    const ponto = Number(parametros.get('ponto') ?? '1') - 1
    return { puzzle, mochila: [vaga(CORDA)], ponto: Number.isInteger(ponto) && ponto >= 0 ? ponto : 0 }
  }
}

/**
 * As peças deslizantes (28/11): `?puzzle=deslizantes` (o farol em madeira
 * entalhada, 3 x 3), `deslizantesBronze` (a mariposa em bronze, 4 x 4) e
 * `deslizantesChave` (levar a peça-chave à saída, 4 x 4, bronze). O Bento já
 * deslizou uma peça (pelo motor, como o host faria): ela fica acesa com o nome.
 */
function deslizantes(nomePublico: string, mudar: Partial<DeslizantesDoPuzzle>): () => Exemplo {
  return () => {
    const tabuleiro: DeslizantesDoPuzzle = { ...deslizantesPadrao(1847), ...mudar }
    const puzzle = puzzleDoModelo('fonte')
    puzzle.nomePublico = nomePublico
    puzzle.encaixes = []
    puzzle.futuro = tabuleiro
    puzzle.dica = { tipo: 'texto', texto: tabuleiro.modo === 'chave' ? 'A peça com a fechadura precisa chegar à saída: abra caminho para ela.' : 'A figura está toda ali, só fora do lugar.' }
    puzzle.desfecho = { modo: 'cena', texto: 'A última peça desliza para o lugar. Algo estala por trás do painel e a porta destrava.', itens: [], moedas: 0, documentos: [], abrePorta: true }
    const comeco = progressoInicial(puzzle)
    const [peca] = pecasQueDeslizam(tabuleiroNoProgresso(comeco, tabuleiro).casas, tabuleiro.lado)
    if (peca === undefined) throw new Error('o tabuleiro da vitrine nasceu sem peça que deslize')
    let n = 0
    const pelo = { quem: BENTO, agora: Date.now(), modo: 'jogo' as const, pecaDoAcervo, novoId: () => `vitrine-${++n}` }
    const movida = agirNoPuzzle(puzzle, comeco, [], { tipo: 'deslizar', peca }, pelo)
    return { puzzle, mochila: [vaga(CORDA)], progresso: movida.progresso }
  }
}

const EXEMPLOS = {
  fonte,
  porta,
  altar,
  imagem,
  cofre,
  simbolos: combinacaoNoCofre('simbolos', 'Cofre das Marés', { tipo: 'barulho', texto: '' }),
  relogio: combinacaoNoCofre('relogio', 'Relógio da Torre', { tipo: 'armadilha', pv: 2, texto: '' }),
  botoes: combinacaoNoCofre('botoes', 'Painel dos Quatro Botões', { tipo: 'nada' }),
  giro: medalhao('Medalhão do Dragão', {}),
  giroSimbolos: medalhao('Selo das Marés', { desenho: 'simbolos', material: 'pedra', aneis: 4, simbolos: ['lua', 'peixe', 'estrela', 'olho'] }),
  giroVizinhas: medalhao('Medalhão do Cavaleiro', { cena: 'cavaleiro', material: 'ferro', aneis: 6, vizinhas: true }),
  luzes: painel('Lampiões da Cripta', {}),
  luzesDesenho: painel('Painel do Farol', { quantos: 9, objetivo: 'desenho', desenho: [false, true, false, true, true, true, false, true, false] }),
  luzesRegra: painel('Corredor dos Lampiões', { quantos: 5, material: 'ferro', ligacao: 'propria', ligados: [[1], [2], [3], [4], [0]] }),
  liquidos: bancada('Bancada do Alquimista', {}),
  liquidosCores: bancada('Tintas da Capela', { modo: 'cores', fonte: false, litros: null, cor: [0, 2, 1, 0, 0], recipientes: [{ capacidade: 4, comeca: 'vermelho', quanto: 4 }, { capacidade: 3, comeca: 'amarelo', quanto: 3 }, { capacidade: 6, comeca: null, quanto: 0 }] }),
  liquidosReceita: bancada('Antídoto do Pântano', { modo: 'receita', material: 'ferro', litros: null, ingredientes: [{ itemId: 'item_erva', nome: 'Erva verde' }, { itemId: 'item_po', nome: 'Pó de enxofre' }], recipientes: [{ capacidade: 4, comeca: 'agua', quanto: 0 }, { capacidade: 6, comeca: 'agua', quanto: 0 }, { capacidade: 3, comeca: 'agua', quanto: 0 }] }, [vaga(ERVA), vaga(CORDA), vaga(PO)]),
  coop: cooperacao('Portão das Duas Salas', { pontos: [{ arte: 'alavanca', rotulo: 'Cripta' }, { arte: 'placa', rotulo: 'Ponte' }] }),
  coopTres: cooperacao('Comporta do Esgoto', { material: 'ferro', janela: 8, pontos: [{ arte: 'alavanca', rotulo: 'Casa das bombas' }, { arte: 'placa', rotulo: 'Galeria' }, { arte: 'painel', rotulo: 'Torre' }] }),
  deslizantes: deslizantes('Painel do Farol', {}),
  deslizantesBronze: deslizantes('Placa da Mariposa', { material: 'bronze', figura: 'mariposa', lado: 4 }),
  deslizantesChave: deslizantes('Cofre do Ourives', { modo: 'chave', material: 'bronze', lado: 4, chave: 0, alvo: 15 }),
} as const
type NomeDoExemplo = keyof typeof EXEMPLOS

function ehNomeDoExemplo(valor: string): valor is NomeDoExemplo {
  return Object.hasOwn(EXEMPLOS, valor)
}

const pedido = parametros.get('puzzle') ?? 'fonte'

/** As mesas de luz da vitrine (assíncronas: as lâminas viram PNG antes). */
const MESAS_DE_LUZ: Readonly<Record<string, () => Promise<Exemplo>>> = {
  camadas: () => camadas('Vitral do Farol', { material: 'vidro', figura: 'farol', rotacaoImporta: true, ordemImporta: false }, 3),
  camadasPapel: () => camadas('Planta da Estufa', { material: 'papel', figura: 'rosa', rotacaoImporta: true, ordemImporta: true }, 4),
  camadasFerro: () => camadas('Cofre da Grade', { material: 'ferro', figura: 'codigo', codigo: 'K7X2', rotacaoImporta: false, ordemImporta: true }, 3),
}

/** O exemplo pedido; o relevo espera o painel virar bitmap para recortar as placas (e as camadas, as lâminas). */
async function exemploPedido(): Promise<Exemplo> {
  const mesaDeLuz = MESAS_DE_LUZ[pedido]
  const escolhido = pedido === 'relevo' ? await relevo() : mesaDeLuz !== undefined ? await mesaDeLuz() : EXEMPLOS[ehNomeDoExemplo(pedido) ? pedido : 'fonte']()
  const modo = parametros.get('desfecho')
  if (modo === 'texto' || modo === 'cena') escolhido.puzzle.desfecho.modo = modo
  return escolhido
}

// ------------------------------------------------------------------ a mesa

function Vitrine({ exemplo }: { exemplo: Exemplo }) {
  const jogo = useJogoLocalDoPuzzle({ desafioId: 'vitrine', puzzle: exemplo.puzzle, mochila: exemplo.mochila, quem: EU, pv: { atual: 20, max: 20 }, pecaDoAcervo, progresso: exemplo.progresso, ...(exemplo.ponto !== undefined ? { ponto: exemplo.ponto } : {}) })
  const [dentro, setDentro] = useState(true)
  // O colega da cooperação: o Bento (ou a Cora, para o terceiro ponto), no ponto pedido, aciona como o host deixaria.
  const colega = (ponto: number, nome: 'Bento' | 'Cora' = 'Bento') => jogo.agir({ tipo: 'apertar', botao: ponto }, jogo.progresso.rev, { quem: nome === 'Cora' ? CORA : BENTO, ponto })
  Reflect.set(window, '__vitrinePuzzle', { estado: () => ({ progresso: jogo.progresso, mochila: jogo.vista.mochila, pv: jogo.pv, dentro }), colega })
  return (
    <ImagemDaMesa.Provider value={resolverDaVitrine}>
      {dentro ? (
        <TelaDoPuzzle vista={jogo.vista} eu={EU.nome} pv={jogo.pv} acontecimentos={jogo.acontecimentos} onAgir={jogo.agir} onSair={() => setDentro(false)} />
      ) : (
        <Fora jogo={jogo} onExaminar={() => setDentro(true)} />
      )}
    </ImagemDaMesa.Provider>
  )
}

/** O puzzle visto do mapa (o `.fora__cartao` do v2): o progresso continua lá. */
function Fora({ jogo, onExaminar }: { jogo: JogoLocalDoPuzzle; onExaminar: () => void }) {
  const { vista } = jogo
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ display: 'grid', gap: 10, width: 'min(460px, 90vw)', padding: '14px 16px', borderRadius: 14, background: 'rgba(19, 19, 23, 0.94)', border: '1px solid var(--lb-color-line-panel)' }}>
        <h2 style={{ margin: 0, font: '400 15px/1.25 var(--lb-font-display)' }}>{vista.titulo}</h2>
        <p data-fora style={{ margin: 0, fontSize: 11.5, color: 'var(--lb-color-parchment-dim)' }}>
          {vista.resolvido ? 'Resolvido.' : `${vista.contagem.postos} de ${vista.contagem.total} no lugar. O que você pôs fica guardado.`}
        </p>
        <button type="button" onClick={onExaminar} style={{ justifySelf: 'start', minHeight: 32, padding: '0 12px', borderRadius: 6, border: '1px solid var(--lb-gr-filete-latao)', background: 'transparent', color: 'var(--lb-color-brass-bright)', font: 'inherit', cursor: 'pointer' }}>
          Examinar
        </button>
        <p style={{ margin: 0, fontSize: 10.5, color: 'var(--lb-color-parchment-faint)' }}>
          Outros exemplos: <a href="?puzzle=fonte">Fonte</a> · <a href="?puzzle=porta">Porta</a> · <a href="?puzzle=altar">Altar</a> · <a href="?puzzle=imagem">Imagem própria</a> · <a href="?puzzle=cofre">Cofre</a> · <a href="?puzzle=simbolos">Símbolos</a> ·{' '}
          <a href="?puzzle=relogio">Relógio</a> · <a href="?puzzle=botoes">Botões</a> · <a href="?puzzle=relevo">Relevo</a> · <a href="?puzzle=giro">Medalhão</a> · <a href="?puzzle=giroSimbolos">Selo</a> · <a href="?puzzle=giroVizinhas">Medalhão difícil</a> · <a href="?puzzle=luzes">Lampiões</a> · <a href="?puzzle=luzesDesenho">Plaqueta</a> · <a href="?puzzle=luzesRegra">Regra própria</a> · <a href="?puzzle=coop">Dois lugares</a> · <a href="?puzzle=coopTres">Três lugares</a>
        </p>
      </div>
    </main>
  )
}

/**
 * No app e no site, as três fontes do tema já estão carregadas quando o puzzle
 * abre (a casca usa todas). A vitrine abre direto no puzzle: sem isto, o 1º
 * layout carrega as três juntas (Segoe UI Variable, 1,8 MB, Bahnschrift e
 * Sitka) e vira uma tarefa de ~220 ms que não é da tela (medido em 28/11 pelo
 * trace do Edge). Cada peso de uma fonte variável é uma carga à parte, então
 * vai um peso por tarefa, como a casca faz ao abrir.
 */
async function aquecerFontes(): Promise<void> {
  const PESOS = ['400', '500', '600', '700', 'italic 400'] as const
  for (const familia of ['--lb-font-sans', '--lb-font-utility', '--lb-font-display']) for (const peso of PESOS) {
    // Primeiro cede: a primeira amostra também sai da tarefa que avalia os módulos.
    await new Promise((pronto) => setTimeout(pronto, 0))
    const amostra = document.createElement('span')
    amostra.textContent = 'Aa Çã 0123'
    amostra.style.cssText = `position:fixed;left:-9999px;top:0;font:${peso} 14px var(${familia})`
    document.body.append(amostra)
    void amostra.offsetWidth
    amostra.remove()
  }
}

const raiz = document.getElementById('raiz')
if (raiz !== null) {
  // Sem exports, o Fast Refresh recarrega a página inteira em vez de montar uma segunda raiz.
  if (Reflect.get(window, '__vitrinePuzzleMontada') === true) location.reload()
  else {
    Reflect.set(window, '__vitrinePuzzleMontada', true)
    void aquecerFontes()
      .then(exemploPedido)
      .then((exemplo) => {
        // As provas medem a abertura da tela a partir daqui (o preparo do exemplo não é da tela).
        performance.mark('vitrine:montar')
        createRoot(raiz).render(<Vitrine exemplo={exemplo} />)
      })
  }
}
