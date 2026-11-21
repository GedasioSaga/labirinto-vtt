import { create } from 'zustand'
import { buildTokenSharedPhoto } from '../lib/imageImport'
import {
  ehFichaDoAcervo,
  fichaQueNasceuDaPeca,
  lugarNaPasta,
  migrarFichasParaOAcervo,
  nomeDaProximaCopia,
  pastaDaFichaNoAcervo,
  precisaMigrar,
  textoDoAvisoDaMigracao,
  type LugarDaFicha,
} from '../lib/fichasNoAcervo'
import { novaVariacao } from '../lib/livros/combate'
import { novoPersonagem, type Personagem } from '../lib/personagem'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import { ACERVO_NAO_LIDO, fichaQueEntra, garantirSubpastasNoAcervo, mochilaComVagasNovas, type ExtrasDaPeca, type ItemDoAcervoNaTela } from '../lib/tokenLibrary'
import { fichasNoAcervoAtivas, pastasDeFichasAtivas, personagensAtivos, sistemaAtivo, useAdventureStore, type AdventureState } from './adventureStore'

/** A pasta padrão Jogadores do acervo (`id` fixo de `lib/tokenLibrary.ts`): a peça dela ganha ficha de jogador. */
const ID_DA_PASTA_JOGADORES = 'jogadores'
import { pastaQueManda } from './donoDasFichas'
import { useLivroDoMestreStore } from './livroDoMestreStore'
import { useRpgStore } from './rpgStore'
import { useToastStore } from './toastStore'
import { useTokenLibraryStore } from './tokenLibraryStore'

/**
 * NPCs NO ACERVO — o que mexe no disco e nas stores (a conta pura mora em
 * `lib/fichasNoAcervo.ts`). Ordem de toda gravação (NOTAS §Migração 3):
 * primeiro o acervo (as subpastas; o `.anterior` já é tirado), depois o dono
 * das fichas (`fichasNoAcervo`). Se a segunda falhar, a próxima abertura migra
 * de novo e reaproveita as subpastas pelo nome.
 */

interface AvisoDaMigracaoState {
  /** O aviso de uma vez só no topo do acervo; `null` = nada a dizer (ou o mestre já disse "Entendi"). */
  aviso: string | null
  entendi: () => void
  /** Cresce a cada "Mostrar no Acervo": o painel do acervo abre e destaca a pasta NPCs quando muda. */
  pedidosDeMostrar: number
}

export const useAvisoDaMigracaoStore = create<AvisoDaMigracaoState>()((set) => ({
  aviso: null,
  entendi: () => set({ aviso: null }),
  pedidosDeMostrar: 0,
}))

/** "Mostrar no Acervo" (coluna dos jogadores): abre a página Acervo e pede o destaque da pasta NPCs. */
export function mostrarNpcsNoAcervo(): void {
  useLivroDoMestreStore.getState().abrirPagina('acervo', true)
  useAvisoDaMigracaoStore.setState((state) => ({ pedidosDeMostrar: state.pedidosDeMostrar + 1 }))
}

/** Quem é o dono das fichas agora: a troca de mapa no meio de uma gravação não pode gravar o lugar no dono errado. */
function chaveDoDono(state: AdventureState): string | null {
  const pasta = pastaQueManda(state)
  if (pasta !== null) return `pasta:${pasta.pastaId}`
  return state.adventure === null ? null : `aventura:${state.adventure.id}`
}

let emCurso: Promise<boolean> | null = null

/**
 * MIGRAÇÃO, uma vez por dono: roda se ele tem ficha de NPC e ainda não tem o
 * campo. Só com o acervo LIDO de verdade (`podeOrganizar`): sem ele não migra
 * (`false`), a mesma recusa de toda gravação do acervo. `true` = o dono já
 * migrou, acabou de migrar, ou não tem nada a migrar. `excluir`: a ficha que
 * quem chama vai pôr num lugar já escolhido (a da peça), fora da conta.
 */
export function garantirMigracao(excluir?: string): Promise<boolean> {
  if (emCurso !== null) return emCurso
  const rodando = migrar(excluir).finally(() => {
    emCurso = null
  })
  emCurso = rodando
  return rodando
}

async function migrar(excluir: string | undefined): Promise<boolean> {
  const antes = useAdventureStore.getState()
  if (fichasNoAcervoAtivas(antes) !== undefined) return true
  const semAExcluida = (lista: readonly Personagem[]) => lista.filter((personagem) => personagem.id !== excluir)
  if (!precisaMigrar(semAExcluida(personagensAtivos(antes)), undefined)) return true
  const acervo = useTokenLibraryStore.getState()
  if (!acervo.podeOrganizar) return false
  const dono = chaveDoDono(antes)
  const proposta = migrarFichasParaOAcervo(semAExcluida(personagensAtivos(antes)), pastasDeFichasAtivas(antes), acervo.pastas)
  let pastas = acervo.pastas
  if (proposta.pastasNovas.length > 0) {
    try {
      pastas = await garantirSubpastasNoAcervo(proposta.pastasNovas)
    } catch (erro) {
      useToastStore.getState().push('error', `Não deu para pôr as fichas de NPC no acervo: ${erro instanceof Error ? erro.message : String(erro)}`)
      return false
    }
  }
  const agora = useAdventureStore.getState()
  // Trocou de mapa durante a gravação, ou outra volta já migrou: as subpastas ficam (a próxima abertura as reaproveita pelo nome).
  if (chaveDoDono(agora) !== dono || fichasNoAcervoAtivas(agora) !== undefined) {
    if (proposta.pastasNovas.length > 0) await useTokenLibraryStore.getState().recarregar()
    return fichasNoAcervoAtivas(agora) !== undefined
  }
  // De novo, com as pastas como ficaram no disco: os `id`s gravados no dono são os de lá.
  const final = migrarFichasParaOAcervo(semAExcluida(personagensAtivos(agora)), pastasDeFichasAtivas(agora), pastas)
  if (!agora.salvarFichasNoAcervo(final.lugares)) return false
  if (proposta.pastasNovas.length > 0) await useTokenLibraryStore.getState().recarregar()
  if (final.resumo.fichas > 0) useAvisoDaMigracaoStore.setState({ aviso: textoDoAvisoDaMigracao(final.resumo) })
  return true
}

/**
 * Grava o lugar de UMA ficha (mover, a ficha que nasce de uma peça). Migra
 * antes, se faltar: o campo novo é a marca, e gravá-lo sem migrar deixaria
 * as outras fichas sem a organização de antes. `false` = não gravou (o
 * acervo não foi lido, ou não há onde guardar); o aviso já saiu.
 */
export async function guardarLugarDaFicha(fichaId: string, pastaId: string | null, daPeca?: string): Promise<boolean> {
  if (!(await garantirMigracao(fichaId))) {
    useToastStore.getState().push('error', `Não deu para guardar a ficha nesta pasta: ${ACERVO_NAO_LIDO}.`)
    return false
  }
  const state = useAdventureStore.getState()
  const atuais = fichasNoAcervoAtivas(state) ?? {}
  const lugar = lugarNaPasta(pastaId, useTokenLibraryStore.getState().pastas, daPeca ?? atuais[fichaId]?.daPeca)
  return state.salvarFichasNoAcervo({ ...atuais, [fichaId]: lugar })
}

/**
 * Decisão 16: a pasta `apagada` saiu do acervo e o conteúdo dela foi para
 * `destino` (`null` = Sem pasta). As fichas de NPC que estavam nela vão junto.
 * `pastasDeAntes`: o acervo antes de apagar, para achar quem estava lá.
 */
export async function levarFichasDaPastaApagada(apagada: string, destino: string | null, pastasDeAntes: readonly { id: string; nome: string; recolhida: boolean; dentroDe?: string }[]): Promise<void> {
  if (!(await garantirMigracao())) return
  const state = useAdventureStore.getState()
  const atuais = fichasNoAcervoAtivas(state)
  if (atuais === undefined) return
  const restantes = pastasDeAntes.filter((pasta) => pasta.id !== apagada)
  const novos: Record<string, LugarDaFicha> = { ...atuais }
  let mudou = false
  for (const [fichaId, lugar] of Object.entries(atuais)) {
    if (pastaDaFichaNoAcervo(lugar, pastasDeAntes) !== apagada) continue
    novos[fichaId] = lugarNaPasta(destino, restantes, lugar.daPeca)
    mudou = true
  }
  if (mudou) state.salvarFichasNoAcervo(novos)
}

/** "Fazer cópia": a cópia nasce embaixo do modelo ("Goblin 2"), com a mochila de vagas novas. Devolve o `id` dela, ou `null`. */
export function fazerCopiaDaFicha(fichaId: string): string | null {
  const state = useAdventureStore.getState()
  const personagens = personagensAtivos(state)
  const ficha = personagens.find((personagem) => personagem.id === fichaId)
  if (ficha === undefined) return null
  const copia = novaVariacao(ficha, nomeDaProximaCopia(ficha, personagens))
  const comMochila: Personagem = copia.mochila === undefined ? copia : { ...copia, mochila: mochilaComVagasNovas(copia.mochila) }
  return state.adicionarPersonagens([comMochila]) ? comMochila.id : null
}

/**
 * Apaga a ficha (o mesmo `apagarPersonagem` de sempre). As cópias dela ficam
 * como fichas soltas NA PASTA do modelo (decisão 16), e a entrada da ficha
 * apagada sai do mapa de lugares.
 */
export function apagarFichaDoAcervo(fichaId: string): boolean {
  const state = useAdventureStore.getState()
  const personagens = personagensAtivos(state)
  const copias = personagens.filter((personagem) => personagem.id !== fichaId && personagem.combate?.modeloId === fichaId && ehFichaDoAcervo(personagem))
  const atuais = fichasNoAcervoAtivas(state)
  if (!state.apagarPersonagem(fichaId)) return false
  if (atuais === undefined) return true
  const { [fichaId]: lugarDoModelo, ...resto } = atuais
  const pastas = useTokenLibraryStore.getState().pastas
  const lugar = lugarDoModelo ?? lugarNaPasta(pastaDaFichaNoAcervo(undefined, pastas), pastas)
  const { daPeca: _daPeca, ...semPeca } = lugar
  const novos: Record<string, LugarDaFicha> = { ...resto }
  for (const copia of copias) novos[copia.id] = semPeca
  useAdventureStore.getState().salvarFichasNoAcervo(novos)
  return true
}

/**
 * CLIQUE NA PEÇA DO ACERVO (pedido de 21/11/2026: "nós vamos poder clicar
 * neles e ver a ficha"): abre a ficha que a peça tem nesta aventura; sem ela,
 * a ficha guardada na peça (do mesmo sistema) entra na pasta da peça e abre,
 * como na 1ª vez que a peça vai ao mapa. `false` = a peça não tem ficha que
 * sirva aqui; quem chama oferece "Criar ficha".
 */
export function abrirFichaDaPeca(item: Pick<ItemDoAcervoNaTela, 'id' | 'pasta'> & ExtrasDaPeca): boolean {
  const state = useAdventureStore.getState()
  const existente = fichaQueNasceuDaPeca(item.id, personagensAtivos(state), fichasNoAcervoAtivas(state))
  if (existente !== null) {
    useRpgStore.getState().abrirFicha(existente.id)
    return true
  }
  const ficha = fichaQueEntra(item, sistemaAtivo(state), { mochila: mochilaComVagasNovas(item.mochila ?? []), moedas: item.moedas })
  if (ficha === null || !state.adicionarPersonagens([ficha])) return false
  void guardarLugarDaFicha(ficha.id, item.pasta, item.id)
  useRpgStore.getState().abrirFicha(ficha.id)
  return true
}

/**
 * "CRIAR FICHA" numa peça do acervo ("vai dá para criar ficha a partir do
 * acervo?"): ficha nova com o nome, a foto, a mochila e a bolsa da peça, na
 * pasta da peça e ligada a ela (a próxima vez no mapa usa esta ficha). NPC;
 * peça da pasta Jogadores ganha ficha de jogador. Abre logo depois.
 */
export async function criarFichaDaPeca(item: Pick<ItemDoAcervoNaTela, 'id' | 'nome' | 'pasta' | 'caminho' | 'imagemNoDisco'> & ExtrasDaPeca, sistema: SistemaDeRpg): Promise<boolean> {
  let retrato: string | null = null
  if (item.imagemNoDisco) {
    try {
      retrato = await buildTokenSharedPhoto(item.caminho)
    } catch {
      // Sem a foto a ficha nasce com as iniciais: perder a ficha por causa da miniatura seria pior.
    }
  }
  const tipo = item.pasta === ID_DA_PASTA_JOGADORES ? 'jogador' : 'npc'
  const mochila = mochilaComVagasNovas(item.mochila ?? [])
  const ficha: Personagem = {
    ...novoPersonagem(sistema, tipo, item.nome),
    retrato,
    ...(mochila.length > 0 ? { mochila } : {}),
    ...(item.moedas !== undefined ? { moedas: item.moedas } : {}),
  }
  if (!useAdventureStore.getState().adicionarPersonagens([ficha])) {
    useToastStore.getState().push('error', 'Não deu para criar a ficha: este mapa ainda não é uma aventura nem está numa pasta com sistema.')
    return false
  }
  void guardarLugarDaFicha(ficha.id, item.pasta, item.id)
  useRpgStore.getState().abrirFicha(ficha.id)
  return true
}

/** "+ NPC": a ficha nasce em NPCs (ficha sem entrada mora lá) e abre para dar o nome. `false` sem onde guardar. */
export function criarNpcNoAcervo(sistema: SistemaDeRpg): boolean {
  const personagem = novoPersonagem(sistema, 'npc', '')
  if (!useAdventureStore.getState().salvarPersonagem(personagem)) return false
  useRpgStore.getState().abrirFicha(personagem.id, true)
  return true
}
