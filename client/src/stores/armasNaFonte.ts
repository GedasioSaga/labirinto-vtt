import { guardarAcervoAntesDasArmas, novoIdDeItem, novoItemDoCatalogo } from '../lib/acervoDeItens'
import type { ItemDoCatalogo } from '../lib/livros/catalogo'
import { guardarCatalogoAntesDasArmas } from '../lib/livros/catalogoNoDisco'
import { ensaiarArmas, fichasComARegraDaArma, juntarAsArmas, type EnsaioDasArmas, type EntradaDoJuntar, type EscolhaDaArma } from '../lib/livros/regraDaArma'
import { guardarRpgAntesDasArmas } from '../lib/pastasDeMapas'
import type { Personagem } from '../lib/personagem'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import { useAcervoDeItensStore } from './acervoDeItensStore'
import { useCatalogoStore } from './catalogoStore'
import { useMundoDoLivroStore, type MundoAberto } from './mundoDoLivroStore'
import { useToastStore } from './toastStore'

/**
 * A ARMA NUMA FONTE SÓ, no disco (docs/design/habilidades/ARMAS-FONTE-UNICA.md
 * §2 e §4, fase F2): o catálogo do livro aberto (a fonte), as fichas da pasta
 * aberta (as cópias) e o Acervo do app (as coisas). A lógica é pura
 * (`lib/livros/regraDaArma.ts`); aqui só a ordem das gravações:
 *
 *   cópias de antes (`.antes-das-armas`, uma vez; sem elas nada se grava)
 *   -> coisas novas no Acervo -> catálogo -> fichas (`mundo.mudar`)
 *
 * Conflito nunca é decidido aqui: sem a escolha do mestre ele fica como está.
 */

const SEM_CATALOGO = 'O catálogo deste livro não foi lido do disco; nada foi gravado.'
const SEM_PASTA = 'As fichas da pasta não foram lidas; nada foi gravado.'

/** O catálogo, as fichas e o Acervo de agora. Lança se o catálogo ou as fichas não foram lidos (gravar seria por cima do que não se viu). */
function dadosDeAgora(sistema: SistemaDeRpg): EntradaDoJuntar & { pastaId: string } {
  const catalogo = useCatalogoStore.getState()
  if (catalogo.sistemaId !== sistema.id || !catalogo.podeGravar) throw new Error(SEM_CATALOGO)
  const { aberto, daPasta } = useMundoDoLivroStore.getState()
  if (aberto === null || daPasta === null) throw new Error(SEM_PASTA)
  const acervo = useAcervoDeItensStore.getState()
  return { catalogo: catalogo.itens, personagens: daPasta, sistema, ...(acervo.podeGravar ? { acervo: acervo.itens } : {}), pastaId: aberto.pastaId }
}

const algumMudou = <T,>(antes: readonly T[], depois: readonly T[]): boolean => depois.length !== antes.length || depois.some((item, indice) => item !== antes[indice])

/** O ENSAIO do "Juntar as armas": a lista do que mudaria, sem gravar nada. Lança como `dadosDeAgora`. */
export function ensaiarJuntarAsArmas(sistema: SistemaDeRpg): EnsaioDasArmas {
  return ensaiarArmas(dadosDeAgora(sistema))
}

/**
 * O CONFIRMAR do "Juntar as armas": grava o certo (casos 1 a 3) e o que o
 * mestre escolheu. Devolve quantas entradas, fichas e coisas mudaram (0 = nada
 * gravado). Lança com a frase pronta.
 */
export async function confirmarJuntarAsArmas(sistema: SistemaDeRpg, escolhas: readonly EscolhaDaArma[]): Promise<number> {
  const { pastaId, ...dados } = dadosDeAgora(sistema)
  const acervoLido = useAcervoDeItensStore.getState().podeGravar
  const juntadas = juntarAsArmas(dados, ensaiarArmas(dados), { escolhas, criarCoisas: acervoLido, novoIdDeCoisa: novoIdDeItem })
  if (juntadas.mudancas === 0) return 0
  const catalogoMuda = algumMudou(dados.catalogo, juntadas.catalogo)
  const fichasMudam = algumMudou(dados.personagens, juntadas.personagens)
  // As cópias primeiro, todas: se uma falhar, nada foi gravado ainda.
  if (juntadas.coisasNovas.length > 0) await guardarAcervoAntesDasArmas()
  if (catalogoMuda) await guardarCatalogoAntesDasArmas(sistema.id)
  if (fichasMudam) await guardarRpgAntesDasArmas(pastaId)
  for (const coisa of juntadas.coisasNovas) await useAcervoDeItensStore.getState().salvarItem({ ...novoItemDoCatalogo('Arma'), id: coisa.id, nome: coisa.nome })
  if (catalogoMuda) await useCatalogoStore.getState().gravarArmas(juntadas.catalogo)
  if (fichasMudam) {
    // A versão escolhida já é a do livro agora: a mesma escolha, de novo sobre as fichas do disco, vira "vale o livro".
    const depois = escolhas.map((escolha): EscolhaDaArma => ('vale' in escolha ? { entradaId: escolha.entradaId, vale: 'livro' } : escolha))
    await useMundoDoLivroStore.getState().mudar((personagens) => {
      const sobreODisco = { catalogo: juntadas.catalogo, personagens, sistema }
      return juntarAsArmas(sobreODisco, ensaiarArmas(sobreODisco), { escolhas: depois, criarCoisas: false, novoIdDeCoisa: novoIdDeItem }).personagens
    })
  }
  return juntadas.mudancas
}

/** As fichas com a regra das entradas (cada cartão ligado recebe o que a sua diz). */
function comAsRegras(personagens: Personagem[], entradas: readonly ItemDoCatalogo[], sistema: SistemaDeRpg): Personagem[] {
  return entradas.reduce((atuais, entrada) => fichasComARegraDaArma(atuais, entrada, sistema), personagens)
}

/**
 * SALVAR A ARMA em qualquer dos 3 lugares (§2): grava a entrada (a fonte) e
 * reescreve na hora toda cópia ligada nas fichas da pasta aberta. Pasta
 * fechada: a cópia é consertada quando ela abrir. Devolve quantas fichas
 * mudaram. Lança com a frase pronta.
 */
export async function gravarRegraDaArma(entrada: ItemDoCatalogo, sistema: SistemaDeRpg): Promise<number> {
  const catalogo = useCatalogoStore.getState()
  if (catalogo.sistemaId !== sistema.id || !catalogo.podeGravar) throw new Error(SEM_CATALOGO)
  await guardarCatalogoAntesDasArmas(sistema.id)
  await catalogo.salvarEntrada(entrada)
  const salva = useCatalogoStore.getState().itens.find((item) => item.id === entrada.id)
  const { aberto, daPasta } = useMundoDoLivroStore.getState()
  if (salva === undefined || aberto === null || daPasta === null) return 0
  const quantas = fichasComARegraDaArma(daPasta, salva, sistema).filter((personagem, indice) => personagem !== daPasta[indice]).length
  if (quantas === 0) return 0
  await guardarRpgAntesDasArmas(aberto.pastaId)
  await useMundoDoLivroStore.getState().mudar((personagens) => comAsRegras(personagens, [salva], sistema))
  return quantas
}

/** A abertura da pasta já conferida (o `abrir` do mundo cria um objeto novo a cada vez). */
let jaConferido: MundoAberto | null = null

/**
 * ABRIR A PASTA conserta a cópia ligada que divergiu (§2: app velho ou Lobby
 * mexeram nela): a fonte ganha, com a cópia de antes das armas e o aviso ao
 * mestre. Só o cartão já ligado (`itemId`): ligar o que ainda não está ligado
 * é o "Juntar as armas", com o ensaio na frente do mestre. Uma vez por
 * abertura. Nunca lança: a falha vira aviso.
 */
export async function consertarArmasAoAbrir(sistema: SistemaDeRpg): Promise<void> {
  const { aberto } = useMundoDoLivroStore.getState()
  if (aberto === null || aberto === jaConferido) return
  jaConferido = aberto
  try {
    const { pastaId, ...dados } = dadosDeAgora(sistema)
    const divergiram = ensaiarArmas(dados).armas.filter((arma) => arma.caso === 'fonteGanha')
    const entradas = dados.catalogo.filter((entrada) => divergiram.some((arma) => arma.entradaId === entrada.id))
    if (entradas.length === 0) return
    await guardarRpgAntesDasArmas(pastaId)
    await useMundoDoLivroStore.getState().mudar((personagens) => comAsRegras(personagens, entradas, sistema))
    const quais = divergiram.map((arma) => `${arma.nome} (${arma.cartoes.map((par) => par.personagemNome).join(', ')})`).join('; ')
    useToastStore.getState().push('info', `Voltei ao que diz o livro: ${quais}.`)
  } catch (erro) {
    useToastStore.getState().push('error', `Não deu para conferir as armas das fichas: ${erro instanceof Error ? erro.message : String(erro)}`)
  }
}
