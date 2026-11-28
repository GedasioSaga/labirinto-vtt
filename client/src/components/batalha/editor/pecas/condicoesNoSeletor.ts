import { useMemo, useSyncExternalStore } from 'react'
import { TURNOS_DO_SELO_MAX } from '../../../../lib/batalha/combate'
import type { DuracaoDoSelo } from '../../../../lib/batalha/mecanica/modelo'
import { catalogoDeCondicoes, condicaoDoCatalogoPeloNome, type CondicaoDoCatalogo } from '../../../../lib/condicoes/catalogo'
import { fraseCurta, type ContextoDasFrases } from '../../../../lib/condicoes/frasesDaCondicao'
import { nomesQueImpedem, type RascunhoDoLegado } from '../../../../lib/condicoes/legado'
import { chaveDaCondicao, turnosDoPrazo, type PrazoDaCondicao, type TipoDaCondicao } from '../../../../lib/condicoes/modelo'
import type { CondicaoPropria } from '../../../../types/map'

/**
 * O CATÁLOGO DE CONDIÇÕES NOS SELETORES (rework das condições, docs/design/condicoes-rework/PLANO.md
 * E7, D5 e D6). Quem põe uma condição (o selo da técnica, as peças "Se acertar", o "Ao acertar" do item,
 * o "Pôr selo…" da batalha) escolhe da MESMA lista: as 35 de fábrica e, no app, as criadas da pasta,
 * cada uma com a frase curta do cartão.
 *
 * As criadas moram na store do app (`stores/condicoesPropriasStore.ts`, que lê o disco pelo Tauri). O
 * editor de habilidades é o mesmo no app, no site do Lobby e no jogador, e o site não pode nem importar o
 * Tauri (guarda de import do `vite.lobby.config.ts`). Por isso este módulo não importa store: o app
 * registra a fonte (`registrarCondicoesDoApp`, feito por `condicoesDoApp.ts`, que só o app importa);
 * sem registro, a lista é a de fábrica e o "Virar condição nova" não aparece. O mesmo molde de
 * `components/habilidades/ponteDoCatalogo.ts`.
 */

/** De onde vêm as criadas: ler a lista de agora e ouvir quando ela muda (devolve o "parar de ouvir"). */
export interface FonteDasCriadas {
  ler: () => readonly CondicaoPropria[]
  seguir: (aviso: () => void) => () => void
}

/**
 * "Virar condição nova" (D4; PENDENCIAS nº 10): abre o editor da condição com o rascunho e as linhas de
 * "Confira", e só depois do Salvar de lá chama `aoVirar` com o nome com que ela ficou (fechar sem salvar =
 * nada muda). `false` = o rascunho não passou na leitura e o editor nem abriu.
 */
export type VirarCondicaoNova = (legado: RascunhoDoLegado, aoVirar: (nome: string) => void) => boolean

/** O que só o app tem: as criadas da pasta e quem grava uma nova. */
export interface CondicoesDoApp {
  fonte: FonteDasCriadas
  virar: VirarCondicaoNova
}

let doApp: CondicoesDoApp | null = null
const SEM_CRIADAS: readonly CondicaoPropria[] = []

/** Chamado uma vez, pela entrada do app, antes do 1º desenho (as telas já abertas não passam a ouvir a fonte). */
export function registrarCondicoesDoApp(condicoes: CondicoesDoApp): void {
  doApp = condicoes
}

function lerCriadas(): readonly CondicaoPropria[] {
  return doApp === null ? SEM_CRIADAS : doApp.fonte.ler()
}

function seguirCriadas(aviso: () => void): () => void {
  return doApp === null ? () => undefined : doApp.fonte.seguir(aviso)
}

/** Uma condição na lista do seletor. */
export interface OpcaoDeCondicao {
  nome: string
  /** A frase curta (a 1ª linha do cartão); vazia na condição sem peça. */
  frase: string
  tipo: TipoDaCondicao
  criada: boolean
  condicao: CondicaoDoCatalogo
}

/** O catálogo como os seletores o usam. */
export interface CatalogoDoSeletor {
  opcoes: readonly OpcaoDeCondicao[]
  /** As criadas como a fonte as dá (o "Virar condição nova" e o "(de fábrica)" precisam delas). */
  criadas: readonly CondicaoPropria[]
  /** Os nomes que uma condição nova não pode usar (`nomesQueImpedem`). */
  ocupados: readonly string[]
  contexto: ContextoDasFrases
}

/** O catálogo das criadas, puro (a mesma lista de "Pôr condição" e de Livros › Condições). */
export function catalogoDoSeletor(criadas: readonly CondicaoPropria[]): CatalogoDoSeletor {
  const lista = catalogoDeCondicoes(criadas)
  const contexto: ContextoDasFrases = { todas: lista.map((condicao) => condicao.montada) }
  return {
    opcoes: lista.map((condicao) => ({ nome: condicao.nome, frase: fraseCurta(condicao.montada, contexto), tipo: condicao.montada.tipo, criada: condicao.criada, condicao })),
    criadas,
    ocupados: nomesQueImpedem(criadas),
    contexto,
  }
}

/** A condição de um nome, pela precedência do catálogo (D5); `null` = nome fora do catálogo (o selo de nome livre). */
export function condicaoDoSeletor(catalogo: CatalogoDoSeletor, nome: string): CondicaoDoCatalogo | null {
  return condicaoDoCatalogoPeloNome(nome, catalogo.criadas)
}

/** A opção da lista com este nome exato (sem olhar maiúscula); `undefined` = fora da lista. */
export function opcaoDoNome(catalogo: CatalogoDoSeletor, nome: string): OpcaoDeCondicao | undefined {
  const chave = chaveDaCondicao(nome)
  return chave === '' ? undefined : catalogo.opcoes.find((opcao) => chaveDaCondicao(opcao.nome) === chave)
}

/** O catálogo de agora: de fábrica e, no app, as criadas (refaz quando a lista das criadas muda). */
export function useCatalogoDoSeletor(): CatalogoDoSeletor {
  const criadas = useSyncExternalStore(seguirCriadas, lerCriadas, lerCriadas)
  return useMemo(() => catalogoDoSeletor(criadas), [criadas])
}

/** Quem grava a condição nova; `null` fora do app (site e jogador): o botão não aparece. */
export function virarCondicaoNovaRegistrado(): VirarCondicaoNova | null {
  return doApp === null ? null : doApp.virar
}

/** Os turnos do prazo da condição ("o prazo dela", D6) dentro do teto de quem põe; `null` = o prazo não é em turnos. */
export function turnosDaCondicao(prazo: PrazoDaCondicao, maximo: number): number | null {
  const turnos = turnosDoPrazo(prazo)
  return turnos === null ? null : Math.min(maximo, Math.max(1, turnos))
}

/** O prazo da condição como duração do selo da técnica: turnos, até o próximo golpe ou até tirarem (o "até o fim da batalha" vira até tirarem). */
export function duracaoDoPrazo(prazo: PrazoDaCondicao): DuracaoDoSelo {
  if (prazo.modo === 'proximoGolpe') return 'proximoGolpe'
  if (prazo.modo === 'ateTirar' || prazo.modo === 'batalha') return 'ateTirar'
  return turnosDaCondicao(prazo, TURNOS_DO_SELO_MAX) ?? 1
}
