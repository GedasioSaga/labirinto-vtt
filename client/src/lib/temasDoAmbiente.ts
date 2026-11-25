import type { EscolhaDoTema, IdDoTema, MapData, TemaDeUmPiso } from '../types/map'
import type { Ambiente } from './periodo'
import { ehPiso } from './pisos'

export type { EscolhaDoTema, IdDoTema }

/**
 * TEMA DO AMBIENTE (pedido do mestre de 17/11/2026): "mudar o tema do ambiente,
 * deixar mais escuro ou parecer que o lugar é iluminado por uma luz mais
 * alaranjada", por mapa e por andar. Respostas do mestre:
 *  - cinco temas prontos (Normal, Escuro, Tocha, Frio, Noite), um controle de
 *    força e uma cor livre;
 *  - as luzes do próprio mapa (tochas, lareiras, velas) continuam furando o
 *    escuro;
 *  - onde há tema, ele SUBSTITUI a tinta da tarde e da noite;
 *  - só cor: a visão dos jogadores não muda.
 *
 * Só os números e a conta, puros. A folha de aprovação
 * (`tmp/pedidos-2026-11-17/tema-folha/`) foi desenhada pelo caminho de verdade
 * (o mapa de luz do editor, `pixi/mapaDeLuz.ts`) com estes valores. Quem liga:
 * `tintaDaCena` (editor), `luzParaJogador` (host, pelo piso do jogador),
 * "Configurar > Ambiente" (mapa) e a barra dos pisos (piso).
 *
 * A cor entra como a tinta do período: misturada ao branco na força
 * (`corDaTinta`) e MULTIPLICANDO o mapa, no mesmo sprite. Por isso as cores
 * são a luz que banha o lugar, não uma pintura por cima: força 0 = o mapa como
 * foi desenhado.
 */

export interface TemaDoAmbiente {
  id: IdDoTema
  rotulo: string
  /** A cor da luz do lugar, `#rrggbb`. */
  cor: string
  /** Onde o controle de força começa (0 a 1). */
  forca: number
  /**
   * Quanto da força de cada luz do mapa entra com este tema (como
   * `LUZ_POR_PERIODO`): 1 = a tocha fura o escuro inteira. Vale o maior entre
   * o do tema e o do período.
   */
  fatorDaLuz: number
  /** O porquê, dito ao mestre no balão do botão. */
  dica: string
}

/**
 * Os cinco temas, do mais claro ao mais escuro. Noite é a noite já aprovada
 * (`AMBIENTE_PADRAO.noite`, 24/10/2026), para o tema e o relógio darem a mesma
 * noite. Cores contidas (regra 5 do Meio-Termo): nenhuma estoura no zoom 100%.
 */
export const TEMAS_DO_AMBIENTE: readonly TemaDoAmbiente[] = [
  { id: 'normal', rotulo: 'Normal', cor: '#ffffff', forca: 0, fatorDaLuz: 0, dica: 'Sem tema: o mapa segue o período (dia, tarde ou noite).' },
  { id: 'escuro', rotulo: 'Escuro', cor: '#1c1f26', forca: 0.55, fatorDaLuz: 1, dica: 'Mais escuro sem mudar a cor do lugar; tochas e lareiras furam o escuro. Só cor: a visão e o "no escuro" seguem a Cena escura e o período Noite.' },
  // Luz a 0,3 (a conta da tarde, `LUZ_POR_PERIODO.tarde`), não 1: com o mapa já alaranjado, a luz inteira
  // devolve a cor de dia perto da tocha e o claro fica cinza-esverdeado no meio do laranja (visto na folha;
  // a 0,5 ainda esverdeia). A 0,3 o claro fica quente e discreto. Em aberto com o mestre.
  { id: 'tocha', rotulo: 'Tocha', cor: '#d9742c', forca: 0.65, fatorDaLuz: 0.3, dica: 'Um lugar iluminado por tochas: alaranjado e um pouco mais escuro.' },
  { id: 'frio', rotulo: 'Frio', cor: '#7f9ccb', forca: 0.5, fatorDaLuz: 1, dica: 'Azulado e frio, como pedra úmida ou gelo; o mapa continua claro.' },
  { id: 'noite', rotulo: 'Noite', cor: '#465a92', forca: 0.85, fatorDaLuz: 1, dica: 'A noite aprovada, a qualquer hora: azul-ardósia escuro. Só cor: para a visão curta e o "no escuro", use o período Noite ou a Cena escura.' },
]

/** A tinta que o mapa de luz desenha: cor e força (como a do período) e o fator das luzes. */
export interface AmbienteComTema extends Ambiente {
  fatorDaLuz: number
}

const COR_HEX = /^#[0-9a-f]{6}$/i

function grampear01(valor: number): number {
  return Number.isFinite(valor) ? Math.min(1, Math.max(0, valor)) : 0
}

/**
 * A conta do tema: o ambiente do período (`ambienteDoPeriodo` com o fator de
 * `LUZ_POR_PERIODO`) com a escolha do mapa ou do andar por cima.
 *  - sem escolha, ou Normal: o período manda, como hoje;
 *  - com tema: a cor e a força do tema SUBSTITUEM as do período (a cor livre
 *    vence a do tema; força fora de 0..1 é grampeada), e as luzes entram com o
 *    maior fator entre o período e o tema (de noite a tocha não enfraquece).
 */
export function ambienteComTema(periodo: AmbienteComTema, escolha: EscolhaDoTema | null | undefined): AmbienteComTema {
  const tema = escolha === null || escolha === undefined ? undefined : TEMAS_DO_AMBIENTE.find((t) => t.id === escolha.id)
  if (tema === undefined || tema.id === 'normal') return { ...periodo }
  const cor = escolha?.cor !== undefined && COR_HEX.test(escolha.cor) ? escolha.cor : tema.cor
  const forca = escolha?.forca === undefined ? tema.forca : grampear01(escolha.forca)
  return { cor, forca, fatorDaLuz: Math.max(grampear01(periodo.fatorDaLuz), tema.fatorDaLuz) }
}

/** O tema pronto de `id` (Normal se o id não é de tema nenhum). */
export function temaPronto(id: IdDoTema): TemaDoAmbiente {
  return TEMAS_DO_AMBIENTE.find((t) => t.id === id) ?? TEMAS_DO_AMBIENTE[0]
}

/** A cor e a força que valem na escolha: as livres dela, senão as do tema. */
export function corEForcaDoTema(escolha: EscolhaDoTema): { cor: string; forca: number } {
  const tema = temaPronto(escolha.id)
  return {
    cor: escolha.cor !== undefined && COR_HEX.test(escolha.cor) ? escolha.cor : tema.cor,
    forca: escolha.forca === undefined ? tema.forca : grampear01(escolha.forca),
  }
}

/** O tema que o PRÓPRIO piso escolheu na barra dos pisos (sem cair no do mapa); ausente = segue o mapa. */
export function temaProprioDoPiso(map: Pick<MapData, 'temasDosPisos'>, piso: number): EscolhaDoTema | undefined {
  return map.temasDosPisos?.find((t) => t.piso === piso)?.tema
}

/**
 * O tema que vale no piso `piso`: o do piso, senão o do mapa. Normal no piso
 * vence o tema do mapa (aquele piso fica sem tema). `undefined` = sem tema.
 */
export function temaDoPiso(map: Pick<MapData, 'tema' | 'temasDosPisos'>, piso: number): EscolhaDoTema | undefined {
  return temaProprioDoPiso(map, piso) ?? map.tema
}

function mesmaEscolha(a: EscolhaDoTema | undefined, b: EscolhaDoTema | undefined): boolean {
  if (a === undefined || b === undefined) return a === b
  return a.id === b.id && a.forca === b.forca && a.cor === b.cor
}

/** A escolha só com os campos que dizem algo: sem força nem cor ausentes gravadas como `undefined`. */
function escolhaLimpa(escolha: EscolhaDoTema): EscolhaDoTema {
  return {
    id: escolha.id,
    ...(escolha.forca === undefined ? {} : { forca: grampear01(escolha.forca) }),
    ...(escolha.cor !== undefined && COR_HEX.test(escolha.cor) ? { cor: escolha.cor.toLowerCase() } : {}),
  }
}

/**
 * O mestre muda o tema do MAPA. Normal (ou nada) TIRA o campo: o arquivo
 * fica como o de um mapa de antes. Nada muda: o próprio mapa.
 */
export function comTemaDoMapa(map: MapData, escolha: EscolhaDoTema | undefined): MapData {
  const nova = escolha === undefined || escolha.id === 'normal' ? undefined : escolhaLimpa(escolha)
  if (mesmaEscolha(map.tema, nova)) return map
  if (nova !== undefined) return { ...map, tema: nova }
  const copia = { ...map }
  delete copia.tema
  return copia
}

/**
 * O mestre muda o tema do piso `piso`. `undefined` = "Do mapa" (tira a
 * entrada; a lista vazia tira o campo). Normal fica gravado: é o piso sem
 * tema num mapa com tema. Nada muda: o próprio mapa.
 */
export function comTemaDoPiso(map: MapData, piso: number, escolha: EscolhaDoTema | undefined): MapData {
  const nova = escolha === undefined ? undefined : escolhaLimpa(escolha)
  if (mesmaEscolha(temaProprioDoPiso(map, piso), nova)) return map
  const outras = (map.temasDosPisos ?? []).filter((t) => t.piso !== piso)
  const lista: TemaDeUmPiso[] = nova === undefined ? outras : [...outras, { piso, tema: nova }]
  if (lista.length > 0) return { ...map, temasDosPisos: lista }
  const copia = { ...map }
  delete copia.temasDosPisos
  return copia
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

/** Uma escolha de arquivo: id de tema conhecido; força que não é número sai, a que é vem grampeada; cor torta sai. */
export function lerEscolhaDoTema(valor: unknown): EscolhaDoTema | undefined {
  if (!ehObjeto(valor)) return undefined
  const tema = TEMAS_DO_AMBIENTE.find((t) => t.id === valor.id)
  if (tema === undefined) return undefined
  const forca = typeof valor.forca === 'number' && Number.isFinite(valor.forca) ? grampear01(valor.forca) : undefined
  const cor = typeof valor.cor === 'string' && COR_HEX.test(valor.cor) ? valor.cor.toLowerCase() : undefined
  return { id: tema.id, ...(forca === undefined ? {} : { forca }), ...(cor === undefined ? {} : { cor }) }
}

/** `MapData.tema` de arquivo: torto ou Normal = sem o campo. */
export function temaDoMapaDoArquivo(valor: unknown): EscolhaDoTema | undefined {
  const lido = lerEscolhaDoTema(valor)
  return lido === undefined || lido.id === 'normal' ? undefined : lido
}

/**
 * `MapData.temasDosPisos` de arquivo: só entrada com piso inteiro na faixa e
 * tema conhecido fica, uma por piso (a primeira vale). Nada que sirva:
 * `undefined` (o campo nem existe, como em mapa de antes dele).
 */
export function temasDosPisosDoArquivo(valor: unknown): TemaDeUmPiso[] | undefined {
  if (!Array.isArray(valor)) return undefined
  const vistos = new Set<number>()
  const lista: TemaDeUmPiso[] = []
  for (const item of valor) {
    if (!ehObjeto(item) || !ehPiso(item.piso) || vistos.has(item.piso)) continue
    const tema = lerEscolhaDoTema(item.tema)
    if (tema === undefined) continue
    vistos.add(item.piso)
    lista.push({ piso: item.piso, tema })
  }
  return lista.length === 0 ? undefined : lista
}
