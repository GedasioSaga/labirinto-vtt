/**
 * A COOPERAÇÃO EM DOIS LUGARES (28/11, o 4º da `docs/design/puzzles/FILA.md`):
 * dois ou três pontos do mapa ligados ao mesmo puzzle. Em cada um há uma
 * alavanca, uma placa de pressão ou o botão de um painel, e um lampião que
 * acende quando alguém o aciona e apaga sozinho no fim da janela (`janela`, em
 * segundos). O puzzle cede quando todos os lampiões estão acesos ao mesmo tempo.
 *
 * Quem pode acionar um ponto é o host que diz: o jogador entra pelo selo DAQUELE
 * ponto (`lib/desafios.ts`, `idDoSeloDoPonto`) e a ficha dele precisa alcançá-lo,
 * a mesma régua do selo de sempre. O motor recebe o ponto conferido
 * (`ContextoDoMotor.ponto`) e recusa qualquer outro.
 *
 * Uma pessoa vale por um ponto só: acionar outro solta o de antes (ninguém
 * segura duas alavancas em salas diferentes). No teste do editor, o mestre
 * sozinho aciona todos.
 *
 * O PROGRESSO (`ProgressoDoPuzzle.acionados`) guarda o último acionamento de
 * cada ponto, com a hora do host. O que está aceso sai da hora de agora: o
 * lampião apaga sem ninguém gravar nada.
 *
 * Puro: sem React, sem rede, sem relógio (a hora vem de quem chama).
 */
import { ARTES_DO_PONTO, JANELA_MAX, JANELA_MIN, JANELA_PADRAO, MATERIAIS_DOS_INTERRUPTORES, PONTOS_MAX, PONTOS_MIN, ROTULO_DO_PONTO_MAX } from '../tipos'
import type { AcionamentoDoPonto, ArteDoPonto, CooperacaoDoPuzzle, CooperacaoNaVista, PontoDaCooperacao, ProgressoDoPuzzle, Puzzle } from '../tipos'

export const NOME_DA_COOPERACAO = 'Cooperação em dois lugares'

export const NOME_DA_ARTE_DO_PONTO: Readonly<Record<ArteDoPonto, string>> = { alavanca: 'Alavanca', placa: 'Placa de pressão', painel: 'Painel de botão' }

/** O verbo do gesto de cada arte, para o botão e o leitor de tela. */
export const GESTO_DA_ARTE: Readonly<Record<ArteDoPonto, string>> = { alavanca: 'Puxar a alavanca', placa: 'Pisar na placa', painel: 'Apertar o botão' }

const MS_POR_SEGUNDO = 1000

export function cooperacaoPadrao(): CooperacaoDoPuzzle {
  return {
    tipo: 'cooperacao',
    material: 'latao',
    janela: JANELA_PADRAO,
    pontos: [
      { arte: 'alavanca', rotulo: '' },
      { arte: 'alavanca', rotulo: '' },
    ],
  }
}

// ------------------------------------------------------------------ a leitura (o `futuro` é entrada hostil)

function isRecord(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function umDaLista<T extends string>(lista: readonly T[], valor: unknown): T | undefined {
  return lista.find((item) => item === valor)
}

function pontoLido(valor: unknown): PontoDaCooperacao {
  const bruto = isRecord(valor) ? valor : {}
  // Sem aparar aqui: o editor relê a cada letra, e "Sala " precisa do espaço para virar "Sala norte". Quem mostra apara (`rotuloDoPonto`).
  const rotulo = typeof bruto.rotulo === 'string' ? bruto.rotulo.slice(0, ROTULO_DO_PONTO_MAX) : ''
  return { arte: umDaLista(ARTES_DO_PONTO, bruto.arte) ?? 'alavanca', rotulo }
}

/** A cooperação guardada, campo a campo (campo torto vira o padrão). `null` = não é cooperação. */
export function lerCooperacao(valor: unknown): CooperacaoDoPuzzle | null {
  if (!isRecord(valor) || valor.tipo !== 'cooperacao') return null
  const lidos: readonly unknown[] = Array.isArray(valor.pontos) ? valor.pontos.slice(0, PONTOS_MAX) : []
  const pontos = lidos.map(pontoLido)
  while (pontos.length < PONTOS_MIN) pontos.push({ arte: 'alavanca', rotulo: '' })
  const janela = typeof valor.janela === 'number' && Number.isFinite(valor.janela) ? Math.round(Math.min(JANELA_MAX, Math.max(JANELA_MIN, valor.janela))) : JANELA_PADRAO
  return { tipo: 'cooperacao', material: umDaLista(MATERIAIS_DOS_INTERRUPTORES, valor.material) ?? 'latao', janela, pontos }
}

/** A cooperação do puzzle; `null` = ele é de outra mecânica. */
export function cooperacaoDoPuzzle(puzzle: Pick<Puzzle, 'futuro'>): CooperacaoDoPuzzle | null {
  const futuro = puzzle.futuro
  if (futuro === undefined || futuro.tipo !== 'cooperacao') return null
  return lerCooperacao(futuro)
}

/** O nome do ponto `i` como todos leem: o do mestre, ou "Ponto 2". */
export function rotuloDoPonto(ponto: Pick<PontoDaCooperacao, 'rotulo'>, i: number): string {
  const aparado = ponto.rotulo.trim()
  return aparado !== '' ? aparado : `Ponto ${i + 1}`
}

// ------------------------------------------------------------------ a conta

/** O último acionamento de cada um dos `quantos` pontos (o progresso torto ou de outro tamanho vira "nenhum"). */
export function acionadosNoProgresso(progresso: Pick<ProgressoDoPuzzle, 'acionados'>, quantos: number): (AcionamentoDoPonto | null)[] {
  const guardados = progresso.acionados ?? []
  return Array.from({ length: quantos }, (_, i) => guardados[i] ?? null)
}

/** Quanto falta para o lampião apagar, em ms (0 = apagado). Relógio que voltou conta como agora. */
export function restaDoPonto(acionado: AcionamentoDoPonto | null, janela: number, agora: number): number {
  if (acionado === null) return 0
  const janelaMs = janela * MS_POR_SEGUNDO
  const passou = Math.max(0, agora - acionado.em)
  return passou > janelaMs ? 0 : janelaMs - passou
}

/**
 * Os acionamentos depois de alguém acionar o ponto `ponto` agora. No jogo, a
 * mesma pessoa noutro ponto solta o de lá (ela não segura dois lugares).
 */
export function comAcionamento(acionados: readonly (AcionamentoDoPonto | null)[], ponto: number, novo: AcionamentoDoPonto, umaPessoaPorPonto: boolean, mesmaPessoa: (a: AcionamentoDoPonto['por'], b: AcionamentoDoPonto['por']) => boolean): (AcionamentoDoPonto | null)[] {
  return acionados.map((antes, i) => {
    if (i === ponto) return novo
    if (umaPessoaPorPonto && antes !== null && mesmaPessoa(antes.por, novo.por)) return null
    return antes
  })
}

/** Todos os lampiões acesos agora: a janela de cada um ainda não fechou. */
export function todosAcesos(acionados: readonly (AcionamentoDoPonto | null)[], janela: number, agora: number): boolean {
  return acionados.length > 0 && acionados.every((acionado) => restaDoPonto(acionado, janela, agora) > 0)
}

/** Quantos lampiões estão acesos agora (só para o mestre). */
export function pontosAcesos(cooperacao: CooperacaoDoPuzzle, progresso: Pick<ProgressoDoPuzzle, 'acionados'>, agora: number): number {
  return acionadosNoProgresso(progresso, cooperacao.pontos.length).filter((acionado) => restaDoPonto(acionado, cooperacao.janela, agora) > 0).length
}

/**
 * Os pontos para o jogador, por lista branca: a arte, o nome, aceso ou não,
 * quanto falta e quem acionou (o nome). Nunca o lugar no mapa nem os ids.
 * `agora` ausente (o quadro do editor) = tudo apagado; resolvido = tudo aceso.
 */
export function cooperacaoNaVista(cooperacao: CooperacaoDoPuzzle, progresso: Pick<ProgressoDoPuzzle, 'acionados' | 'resolvido'>, agora: number | undefined, meuPonto: number | null): CooperacaoNaVista {
  const acionados = acionadosNoProgresso(progresso, cooperacao.pontos.length)
  const resolvido = progresso.resolvido !== null
  return {
    material: cooperacao.material,
    janela: cooperacao.janela,
    meuPonto: meuPonto !== null && meuPonto >= 0 && meuPonto < cooperacao.pontos.length ? meuPonto : null,
    pontos: cooperacao.pontos.map((ponto, i) => {
      const acionado = acionados[i] ?? null
      const resta = agora === undefined ? 0 : restaDoPonto(acionado, cooperacao.janela, agora)
      const aceso = resolvido || resta > 0
      return { arte: ponto.arte, rotulo: rotuloDoPonto(ponto, i), aceso, restaMs: resolvido ? 0 : resta, por: aceso && acionado !== null ? acionado.por.nome : '' }
    }),
  }
}
