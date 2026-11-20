/**
 * O RECORTE DO JOGADOR (plano §2.3): o puzzle como vai a quem está dentro,
 * montado por LISTA BRANCA, campo a campo. Nunca copia o puzzle e apaga o que
 * não pode: um campo novo no puzzle só chega ao jogador se alguém o escrever
 * aqui, de propósito.
 *
 * Nunca vão ao jogador: a peça certa de cada encaixe, a regra e a ordem certa,
 * a peça guardada da troca, os pesos (só o das pedras já na bandeja, que o
 * mostrador do v1 soma), o castigo, o desfecho, a porta ligada, o `modeloId`
 * e o nome do mestre. O desfecho chega depois, na mensagem de resolvido, só
 * com o que cada um ganhou.
 *
 * Puro: o host chama com o mapa de agora e a mochila da ficha de quem vê.
 */
import type { CarriedItem } from '../types/map'
import { contagemDoPuzzle, pesoDe, postaEm } from './motor'
import { CATEGORIA_DA_PECA_DE_PUZZLE } from './tipos'
import type { EncaixeDoPuzzle, EncaixeNaVista, PecaPosta, PostaNaVista, ProgressoDoPuzzle, Puzzle, VagaNaVista, VisualDoPuzzle, VistaDoPuzzle } from './tipos'

/** O documento da dica, como quem vê o conhece: o título e se ele já o leu. `null` = o documento sumiu da biblioteca. */
export type DocumentoDaDica = (docId: string) => { titulo: string; podeLer: boolean } | null

export interface EntradaDaVista {
  desafioId: string
  puzzle: Puzzle
  progresso: ProgressoDoPuzzle
  /** A mochila de QUEM VÊ (a da ficha dele). */
  mochila: readonly CarriedItem[]
  /** Ausente = a dica por documento não aparece (a biblioteca Documentos chega na leva do Documento). */
  documentoDaDica?: DocumentoDaDica
}

export function vistaDoPuzzle(entrada: EntradaDaVista): VistaDoPuzzle {
  const { puzzle, progresso } = entrada
  const vista: VistaDoPuzzle = {
    desafioId: entrada.desafioId,
    rev: progresso.rev,
    titulo: puzzle.nomePublico,
    visual: visualNaVista(puzzle.visual),
    encaixes: puzzle.encaixes.map((encaixe) => encaixeNaVista(encaixe, progresso)),
    troca: trocaNaVista(puzzle, progresso),
    dica: dicaNaVista(puzzle, entrada.documentoDaDica),
    resolvido: progresso.resolvido !== null,
    contagem: contagemDoPuzzle(puzzle, progresso),
    mochila: entrada.mochila.map(vagaNaVista),
  }
  if (puzzle.futuro !== undefined) vista.versaoNova = true
  return vista
}

function visualNaVista(visual: VisualDoPuzzle): VisualDoPuzzle {
  if (visual.tipo === 'imagem') return { tipo: 'imagem', imagem: visual.imagem }
  return {
    tipo: 'modelo',
    modelo: visual.modelo,
    cores: { parede: visual.cores.parede, chao: visual.cores.chao, objeto: visual.cores.objeto },
    inscricao: visual.inscricao,
    moldura: visual.moldura,
  }
}

function postaNaVista(posta: PecaPosta): PostaNaVista {
  return { nome: posta.vaga.nome, imagem: posta.vaga.imagem ?? null, por: posta.por.nome }
}

function encaixeNaVista(encaixe: EncaixeDoPuzzle, progresso: ProgressoDoPuzzle): EncaixeNaVista {
  const base = { id: encaixe.id, x: encaixe.x, y: encaixe.y, t: encaixe.t, forma: encaixe.forma }
  const posta = postaEm(progresso, encaixe.id)
  if (encaixe.jeito === 'peca') {
    return { ...base, jeito: 'peca', posta: posta !== null && 'vaga' in posta ? postaNaVista(posta) : null }
  }
  const metades = posta !== null && 'a' in posta ? [posta.a, posta.b].filter((metade): metade is PecaPosta => metade !== null) : []
  const [primeira, segunda] = metades
  if (primeira === undefined) return { ...base, jeito: 'metades', posta: null, metadesPostas: 0 }
  if (segunda === undefined) return { ...base, jeito: 'metades', posta: postaNaVista(primeira), metadesPostas: 1 }
  // Juntas, viram a peça do puzzle: o nome e o desenho que o mestre deu a ela.
  const quem = [...new Set([primeira.por.nome, segunda.por.nome])].join(' e ')
  return { ...base, jeito: 'metades', posta: { nome: encaixe.vira.nome, imagem: encaixe.vira.imagem, por: quem }, metadesPostas: 2 }
}

function trocaNaVista(puzzle: Puzzle, progresso: ProgressoDoPuzzle): VistaDoPuzzle['troca'] {
  const troca = puzzle.troca
  if (troca === null) return null
  return {
    x: troca.x,
    y: troca.y,
    pesoPedido: troca.peso,
    naBandeja: progresso.bandeja.map((pedra) => ({ nome: pedra.vaga.nome, peso: pesoDe(troca, pedra.vaga.itemId) ?? 0 })),
    feita: progresso.trocaFeita,
  }
}

function dicaNaVista(puzzle: Puzzle, documentoDaDica: DocumentoDaDica | undefined): VistaDoPuzzle['dica'] {
  const dica = puzzle.dica
  if (dica.tipo === 'texto') return dica.texto.trim() === '' ? null : { tipo: 'texto', texto: dica.texto }
  const documento = documentoDaDica?.(dica.docId) ?? null
  if (documento === null) return null
  // Quem não leu só sabe que existe: nem o título vai, porque o documento pode nunca ter estado no mapa.
  return documento.podeLer ? { tipo: 'documento', titulo: documento.titulo, podeLer: true } : { tipo: 'documento', titulo: '', podeLer: false }
}

function vagaNaVista(vaga: CarriedItem): VagaNaVista {
  return {
    vagaId: vaga.id,
    nome: vaga.nome,
    imagem: vaga.imagem ?? null,
    quantidade: vaga.quantidade ?? 1,
    // Pela categoria, nunca por "serve neste puzzle": isso diria quais peças são a resposta.
    peca: vaga.categoria === CATEGORIA_DA_PECA_DE_PUZZLE,
  }
}
