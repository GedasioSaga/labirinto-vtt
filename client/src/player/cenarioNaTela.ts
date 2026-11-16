import { create } from 'zustand'
import { revelacaoDoPino, type DadosDaRevelacao } from '../cenario/revelacao/doPino'
import type { Pin } from '../types/map'

/**
 * "!" CENÁRIO NA TELA DO JOGADOR (P4): de onde a revelação datilografada abre
 * além do toque — o "Ler agora" do mestre, o "Ao chegar" e o "Ler de novo" do
 * caderno. A revelação é a de sempre (`CenarioOverlay`): até 4,6 s, "Pular",
 * e com movimento reduzido o texto chega inteiro.
 */

/** A revelação aberta; `pinId` = veio de um pino (fechar avisa o host que ele leu). */
export type RevelacaoAberta = DadosDaRevelacao & { readonly pinId?: string }

/**
 * A revelação na tela: `leitura` é nova a cada abertura e entra no `key` do
 * overlay (`chaveDaRevelacao`). A revelação só lê o título e o texto ao montar
 * (`RevelacaoDoLocal`): sem remontar, um 2º "Ler agora" por cima do 1º trocava
 * o título e deixava a datilografia do 1º pino.
 */
export type RevelacaoNaTela = RevelacaoAberta & { readonly leitura: number }

/** O `key` do overlay: o pino e a leitura, para cada leitura recomeçar do zero. */
export function chaveDaRevelacao(revelacao: RevelacaoNaTela): string {
  return `${revelacao.pinId ?? 'sem-pino'}#${revelacao.leitura}`
}

/** Só o painel, com o nome e o texto: o que o "Ler agora" e o caderno trazem. */
function soOPainel(nome: string, texto: string): DadosDaRevelacao {
  return { imagem: null, nome: nome.trim(), descricao: texto.trim(), quando: 'primeira' }
}

/**
 * A revelação do "Ler agora". O texto é o que o mestre mandou; o pino do
 * recorte, se já chegou com a imagem e a animação do cenário, empresta as duas.
 */
export function revelacaoDoLerAgora(lido: { readonly pinId: string; readonly nome: string; readonly texto: string }, pino: Pin | undefined): RevelacaoAberta {
  const doPino = pino === undefined ? null : revelacaoDoPino(pino)
  const base = doPino !== null && doPino.imagem !== null ? { ...doPino, nome: lido.nome.trim(), descricao: lido.texto.trim() } : soOPainel(lido.nome, lido.texto)
  return { ...base, pinId: lido.pinId }
}

/** A revelação do "Ao chegar": a do pino, ou só o painel quando ele não tem animação. */
export function revelacaoAoChegar(pino: Pin): RevelacaoAberta {
  const doPino = revelacaoDoPino(pino)
  return { ...(doPino ?? soOPainel(pino.nome ?? '', pino.description)), pinId: pino.id }
}

/** O próximo "!" do recorte que abre sozinho (a ficha chegou), fora os que esta tela já abriu. */
export function cenarioQueAbreAoChegar(pins: readonly Pin[] | undefined, jaAbriu: (pinId: string) => boolean): Pin | undefined {
  return pins?.find((pino) => pino.abreAoChegar === true && !jaAbriu(pino.id))
}

// ─── "Ler de novo" do caderno ──────────────────────────────────────────────

interface EstadoDaReleitura {
  pedido: { readonly id: number; readonly nome: string; readonly texto: string } | null
}

/** O caderno pede, a tela do mapa abre a revelação. Fica fora do painel para não passar por ele. */
export const useRelerCenario = create<EstadoDaReleitura>()(() => ({ pedido: null }))

let proximo = 1

export function lerDeNovo(nome: string, texto: string): void {
  useRelerCenario.setState({ pedido: { id: proximo++, nome, texto } })
}

/** A revelação do "Ler de novo"; o pedido sai da fila. */
export function atenderReleitura(): RevelacaoAberta | null {
  const { pedido } = useRelerCenario.getState()
  if (pedido === null) return null
  useRelerCenario.setState({ pedido: null })
  return soOPainel(pedido.nome, pedido.texto)
}
