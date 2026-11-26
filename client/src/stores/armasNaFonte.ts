import type { ItemDoCatalogo } from '../lib/livros/catalogo'
import { guardarCatalogoAntesDasArmas } from '../lib/livros/catalogoNoDisco'
import { ABA_DAS_ARMAS } from '../lib/batalha/leituraDaFicha'
import { entradaComARegraDoCartao, fichasComARegraDaArma, mesmaRegra, regraDaEntrada, regraDoCartao } from '../lib/livros/regraDaArma'
import { guardarRpgAntesDasArmas } from '../lib/pastasDeMapas'
import { cartoesDaAba, type Personagem } from '../lib/personagem'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import { useCatalogoStore } from './catalogoStore'
import { useMundoDoLivroStore } from './mundoDoLivroStore'

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
 *
 * ITENS REFEITOS (E7): o "Juntar as armas" e os consertos ao abrir e ao começar a batalha saíram. O
 * Atacar lê a arma EQUIPADA da mochila, e a conversão ao abrir já levou os cartões para ela.
 */

const SEM_CATALOGO = 'O catálogo deste livro não foi lido do disco; nada foi gravado.'

/** As fichas com a regra das entradas (cada cartão ligado recebe o que a sua diz). */
function comAsRegras(personagens: Personagem[], entradas: readonly ItemDoCatalogo[], sistema: SistemaDeRpg): Personagem[] {
  return entradas.reduce((atuais, entrada) => fichasComARegraDaArma(atuais, entrada, sistema), personagens)
}

/**
 * SALVAR A ARMA em qualquer dos 3 lugares (§2): grava a entrada (a fonte) e
 * reescreve na hora toda cópia ligada nas fichas da pasta aberta. Pasta
 * fechada: a cópia fica como está (a mochila é quem vale). Devolve quantas fichas
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

/**
 * SALVAR A FICHA com um cartão de arma ligado (§6, o 3º lugar): o que o mestre
 * mudou na regra do cartão (mecânica, campos, balas) vai à fonte, que reescreve
 * as outras cópias. Só o cartão cuja regra mudou nesta edição (`antes` x
 * `depois`): a cópia que já vinha diferente não sobe ao livro por acaso (o
 * mochila é quem vale). Livro deste sistema fechado = nada (a ficha
 * não sabe a fonte). Devolve os nomes das armas gravadas. Lança com a frase pronta.
 */
export async function gravarArmasDaFicha(antes: Personagem, depois: Personagem, sistema: SistemaDeRpg): Promise<string[]> {
  const deAntes = new Map(cartoesDaAba(antes, ABA_DAS_ARMAS).map((cartao) => [cartao.id, cartao]))
  const gravadas: string[] = []
  for (const cartao of cartoesDaAba(depois, ABA_DAS_ARMAS)) {
    const velho = deAntes.get(cartao.id)
    if (cartao.itemId === undefined || velho === undefined) continue
    const regra = regraDoCartao(cartao, sistema)
    if (mesmaRegra(regraDoCartao(velho, sistema), regra)) continue
    const catalogo = useCatalogoStore.getState()
    if (catalogo.sistemaId !== sistema.id || !catalogo.podeGravar) return gravadas
    const entrada = catalogo.itens.find((item) => item.tipo === 'arma' && item.acervoId === cartao.itemId)
    if (entrada === undefined || mesmaRegra(regraDaEntrada(entrada, sistema), regra)) continue
    await gravarRegraDaArma(entradaComARegraDoCartao(entrada, cartao, sistema), sistema)
    gravadas.push(entrada.nome)
  }
  return gravadas
}
