import { isTauri } from '@tauri-apps/api/core'
import { converterFichas, type RelatorioDaFicha } from '../lib/itens/conversao/ficha'
import type { Personagem } from '../lib/personagem'
import { arquivoDasFichasDoMapa, discoDoApp, levarFichasAoLobby, type Bruto, type DiscoDaMigracao } from '../net/nuvem/migracaoDaMochila'
import { useAcervoDeItensStore } from './acervoDeItensStore'
import { useToastStore } from './toastStore'

/**
 * SISTEMA DE ITENS REFEITO — a CONVERSÃO DAS FICHAS AO ABRIR (docs/design/itens-rework/PLANO.md
 * §2.1, E1). Pedido do dono: "dado salvo nunca se perde".
 *
 * Ao abrir um mapa, ANTES de o editor ler as fichas (logo depois da migração da mochila), os cartões
 * das abas Armas e Itens e os "Tipos de bala" passam para a mochila da ficha (`converterFichas`,
 * puro). A ordem é a da regra 6: o Acervo primeiro (dá os itens que a conversão criou ou completou),
 * depois as fichas. Antes de gravar as fichas, a cópia do arquivo como era (`.antes-itens-v2`, UMA
 * vez, nunca regravada). Só mudam `abas` e `mochila` de cada ficha trocada: o resto do arquivo fica
 * byte a byte como veio.
 *
 * Idempotente: abrir de novo não muda nada (a ficha convertida volta igual, e nada se grava). Sem o
 * Acervo lido do disco, não converte (criaria vagas apontando para itens que não se gravaram).
 */

export const SUFIXO_DA_COPIA_DOS_ITENS_V2 = '.antes-itens-v2'

function isRecord(value: unknown): value is Bruto {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** O arquivo das fichas como estava, só com as abas e a mochila de cada ficha convertida trocadas. */
export function brutoComAsFichas(bruto: Bruto, personagens: readonly Personagem[], antes: readonly Personagem[]): Bruto {
  const mudadas = new Map(personagens.filter((personagem, indice) => personagem !== antes[indice]).map((personagem) => [personagem.id, personagem]))
  if (!Array.isArray(bruto.personagens)) return bruto
  const lista = bruto.personagens.map((cru: unknown) => {
    if (!isRecord(cru) || typeof cru.id !== 'string') return cru
    const nova = mudadas.get(cru.id)
    if (nova === undefined) return cru
    const { mochila: _antes, ...resto } = cru
    return { ...resto, abas: nova.abas, ...(nova.mochila === undefined ? {} : { mochila: nova.mochila }) }
  })
  return { ...bruto, personagens: lista }
}

export interface ConversaoDasFichas {
  arquivo: string
  /** As fichas que mudaram (ganharam vaga, ligação ou "em uso"). */
  fichas: number
  /** Os itens que o Acervo ganhou ou completou. */
  itens: number
  /** As frases de conferir, por ficha. */
  relatorios: RelatorioDaFicha[]
}

/** O passo inteiro sobre o disco dado (o teste usa um disco falso; o app, `discoDoApp`). `null` = nada a converter. */
export async function converterFichasDoMapa(caminhoDoMapa: string, disco: DiscoDaMigracao): Promise<ConversaoDasFichas | null> {
  const acervo = useAcervoDeItensStore.getState()
  if (!acervo.podeGravar) await acervo.recarregar()
  const lido = useAcervoDeItensStore.getState()
  if (!lido.podeGravar) return null
  const alvo = await arquivoDasFichasDoMapa(caminhoDoMapa, disco)
  if (alvo === null || alvo.personagens.length === 0) return null
  const feito = converterFichas(lido.itens, alvo.personagens)
  const fichasMudam = feito.personagens !== alvo.personagens
  if (!fichasMudam && feito.novos.length === 0) return null
  // Regra 6: o Acervo primeiro. Falhou: lança, e as fichas não se gravam (a abertura seguinte tenta de novo, com os mesmos ids).
  await lido.juntarItens(feito.novos)
  if (fichasMudam) {
    const copia = `${alvo.arquivo}${SUFIXO_DA_COPIA_DOS_ITENS_V2}`
    if ((await disco.ler(copia)) === null) await disco.gravar(copia, alvo.texto)
    await disco.gravar(alvo.arquivo, JSON.stringify(brutoComAsFichas(alvo.bruto, feito.personagens, alvo.personagens), null, 2))
    if (alvo.pastaId !== null) levarFichasAoLobby(alvo.pastaId, alvo.personagens, feito.personagens, 'Os itens das abas Armas e Itens passaram para a mochila')
  }
  const fichas = feito.personagens.filter((personagem, indice) => personagem !== alvo.personagens[indice]).length
  return { arquivo: alvo.arquivo, fichas, itens: feito.novos.length, relatorios: feito.relatorios.filter((relatorio) => relatorio.vagasNovas.length > 0 || relatorio.confira.length > 0) }
}

/** O aviso ao abrir; `null` = nada que o mestre precise saber. */
export function avisoDaConversao(feita: ConversaoDasFichas): string | null {
  if (feita.fichas === 0 && feita.itens === 0) return null
  const partes = [feita.fichas === 1 ? 'Os itens de 1 ficha passaram a morar na mochila.' : `Os itens de ${feita.fichas} fichas passaram a morar na mochila.`]
  if (feita.itens > 0) partes.push(feita.itens === 1 ? 'O Acervo ganhou ou completou 1 item (veja os "Confira").' : `O Acervo ganhou ou completou ${feita.itens} itens (veja os "Confira").`)
  const conferir = feita.relatorios.reduce((soma, relatorio) => soma + relatorio.confira.length, 0)
  if (conferir > 0) partes.push(`${conferir === 1 ? '1 ponto' : `${conferir} pontos`} para conferir; a cópia de antes ficou ao lado do arquivo (${SUFIXO_DA_COPIA_DOS_ITENS_V2}).`)
  return partes.join(' ')
}

/**
 * A conversão na abertura do app (`App.tsx`, logo depois de `migrarMochilaAoAbrir`). Nunca lança e
 * nunca impede o mapa de abrir: falhou, avisa e o mapa abre como antes. Fora do app, não faz nada.
 */
export async function converterItensAoAbrir(caminhoDoMapa: string): Promise<void> {
  if (!isTauri()) return
  try {
    const feita = await converterFichasDoMapa(caminhoDoMapa, discoDoApp)
    if (feita === null) return
    const aviso = avisoDaConversao(feita)
    if (aviso !== null) useToastStore.getState().push('info', aviso)
  } catch (erro) {
    useToastStore.getState().push('error', `Não deu para passar os itens das abas para a mochila (${erro instanceof Error ? erro.message : String(erro)}): o mapa abre como antes.`)
  }
}
