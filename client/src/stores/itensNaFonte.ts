import type { ItemDoCatalogo } from '../lib/acervoDeItens'
import {
  comAEscolhaDasCopias,
  comAsCopiasEmDia,
  ensaiarCopias,
  fichaComOEfeitoDoItem,
  fichaComOsDadosMudados,
  itensComOEfeitoMudado,
  itensComOsDadosMudados,
  type DadosMudados,
  type EscolhaDaCopia,
} from '../lib/mochila/efeitoNasCopias'
import { guardarRpgAntesDosItens } from '../lib/pastasDeMapas'
import type { Personagem } from '../lib/personagem'
import { useAcervoDeItensStore } from './acervoDeItensStore'
import { personagensAtivos, useAdventureStore } from './adventureStore'
import { useMundoDoLivroStore, type MundoAberto } from './mundoDoLivroStore'
import { useToastStore } from './toastStore'

/**
 * O EFEITO DO ITEM NUMA FONTE SÓ, no disco (F6 de docs/design/habilidades/
 * ARMAS-FONTE-UNICA.md, a regra das armas em `armasNaFonte.ts`): o "O que ele
 * faz" da coisa do Acervo é a verdade; as vagas das mochilas da pasta aberta
 * são cópias. A lógica é pura (`lib/mochila/efeitoNasCopias.ts`); aqui só a
 * ordem: a cópia de antes (`rpg.json.antes-dos-itens`, uma vez; sem ela nada
 * se grava) -> as fichas (`mundo.mudar`, o mesmo caminho do Lobby e da LAN,
 * que já levam ao jogador só a frase).
 *
 *   salvar a coisa com outro efeito -> toda cópia dela segue, sem clique
 *   salvar a coisa com outros dados -> foto, luz e munições seguem; descrição e preço, na cópia intacta
 *   abrir a pasta                    -> a cópia já com efeito que divergiu segue, e foto, luz e munições
 *   conflito (dada antes do efeito, ou efeito que o Acervo tirou) -> lista do mestre
 */

const SEM_PASTA = 'As fichas da pasta não foram lidas; nada foi gravado.'

/** Os nomes das fichas que a mudança troca (a mesma referência = não mudou). */
function fichasQueMudam(antes: readonly Personagem[], depois: readonly Personagem[]): string[] {
  return depois.filter((personagem, indice) => personagem !== antes[indice]).map((personagem) => personagem.nome)
}

const juntos = (nomes: readonly string[]): string => [...new Set(nomes)].join(', ')

/** SALVAR A COISA: as cópias de cada item cujo efeito ou dados mudaram seguem a fonte na hora. Nunca lança: a falha vira aviso. */
async function seguirOAcervo(itens: readonly ItemDoCatalogo[], dados: readonly DadosMudados[], nomes: readonly string[]): Promise<void> {
  const aplicar = (lista: Personagem[]): Personagem[] =>
    itens.reduce((atuais, item) => atuais.map((ficha) => fichaComOEfeitoDoItem(ficha, item)), lista).map((ficha) => fichaComOsDadosMudados(ficha, dados))
  try {
    const mudam = [...(await seguirNoLivro(aplicar)), ...(await seguirNaAventura(aplicar))]
    if (mudam.length > 0) useToastStore.getState().push('info', `${juntos(nomes)}: a mochila de ${juntos(mudam)} segue o Acervo.`)
  } catch (erro) {
    useToastStore.getState().push('error', `As cópias nas mochilas não seguiram o Acervo: ${erro instanceof Error ? erro.message : String(erro)}`)
  }
}

/** As fichas do mundo do livro aberto seguem o Acervo. Devolve os nomes das que mudaram. */
async function seguirNoLivro(aplicar: (lista: Personagem[]) => Personagem[]): Promise<string[]> {
  const { aberto, daPasta } = useMundoDoLivroStore.getState()
  if (aberto === null || daPasta === null) return []
  const mudam = fichasQueMudam(daPasta, aplicar(daPasta))
  if (mudam.length === 0) return []
  await guardarRpgAntesDosItens(aberto.pastaId)
  await useMundoDoLivroStore.getState().mudar(aplicar)
  return mudam
}

/**
 * As fichas da aventura aberta na mesa seguem o Acervo na hora (levantamento de 25/11/2026, nº 11): antes só
 * ao abrir a pasta ou ao começar a batalha, e a vaga dada no meio da sessão ficava com a foto e a luz velhas.
 * Pelo funil da ficha, como o começo da batalha. Devolve os nomes das que mudaram.
 */
async function seguirNaAventura(aplicar: (lista: Personagem[]) => Personagem[]): Promise<string[]> {
  const aventura = useAdventureStore.getState()
  const fichas = [...personagensAtivos(aventura)]
  const depois = aplicar(fichas)
  const mudam = fichas.filter((ficha, indice) => ficha !== depois[indice])
  if (mudam.length === 0) return []
  if (aventura.pasta !== null) await guardarRpgAntesDosItens(aventura.pasta.pastaId)
  for (const ficha of mudam) useAdventureStore.getState().ajustarPersonagem(ficha.id, (atual) => aplicar([atual])[0] ?? atual)
  return mudam.map((ficha) => ficha.nome)
}

// Qualquer gravação do Acervo (a janela do item, o painel, a página Itens) passa por aqui: não há caminho que esqueça as cópias.
useAcervoDeItensStore.subscribe((state, antes) => {
  if (!state.podeGravar || !antes.podeGravar || state.itens === antes.itens) return
  const mudaram = itensComOEfeitoMudado(antes.itens, state.itens)
  const dados = itensComOsDadosMudados(antes.itens, state.itens)
  if (mudaram.length === 0 && dados.length === 0) return
  const ids = new Set([...mudaram.map((item) => item.id), ...dados.map((mudado) => mudado.itemId)])
  const nomes = state.itens.filter((item) => ids.has(item.id)).map((item) => item.nome)
  // Numa tarefa à parte: o Salvar da janela termina de pintar antes de as fichas serem regravadas (nenhum trecho longo junto).
  setTimeout(() => void seguirOAcervo(mudaram, dados, nomes), 0)
})

/** A abertura da pasta já conferida (o `abrir` do mundo cria um objeto novo a cada vez). */
let jaConferido: MundoAberto | null = null

/**
 * ABRIR A PASTA: a cópia já com efeito que divergiu (app velho, pasta fechada
 * quando a coisa mudou) volta ao que o Acervo diz, com a cópia de antes e o
 * aviso. O conflito fica para o mestre (`decidirCopias`). Uma vez por
 * abertura. Nunca lança: a falha vira aviso.
 */
export async function consertarItensAoAbrir(): Promise<void> {
  const { aberto, daPasta } = useMundoDoLivroStore.getState()
  const acervo = useAcervoDeItensStore.getState()
  if (aberto === null || daPasta === null || !acervo.podeGravar || aberto === jaConferido) return
  jaConferido = aberto
  const mudam = fichasQueMudam(daPasta, comAsCopiasEmDia(daPasta, acervo.itens))
  if (mudam.length === 0) return
  try {
    await guardarRpgAntesDosItens(aberto.pastaId)
    await useMundoDoLivroStore.getState().mudar((lista) => comAsCopiasEmDia(lista, useAcervoDeItensStore.getState().itens))
    useToastStore.getState().push('info', `Voltei ao que o Acervo diz os itens da mochila de ${juntos(mudam)}.`)
  } catch (erro) {
    useToastStore.getState().push('error', `Não deu para conferir os itens das mochilas: ${erro instanceof Error ? erro.message : String(erro)}`)
  }
}

/** O CONFIRMAR do mestre para as cópias em conflito de UM item. Devolve quantas vagas mudaram. Lança com a frase pronta. */
export async function decidirCopias(item: ItemDoCatalogo, escolha: EscolhaDaCopia): Promise<number> {
  const { aberto, daPasta } = useMundoDoLivroStore.getState()
  if (aberto === null || daPasta === null) throw new Error(SEM_PASTA)
  const quantas = ensaiarCopias(daPasta, [item]).filter((copia) => copia.caso !== 'segue').length
  if (quantas === 0) return 0
  await guardarRpgAntesDosItens(aberto.pastaId)
  await useMundoDoLivroStore.getState().mudar((lista) => comAEscolhaDasCopias(lista, item, escolha))
  return quantas
}

/**
 * COMEÇAR A BATALHA: a mesma rede de segurança das armas para os itens. A
 * cópia já com efeito que divergiu nas fichas da aventura volta ao Acervo
 * antes da 1ª jogada (o host lê o efeito da vaga). O conflito fica para o
 * mestre. Acervo não lido = nada. Nunca lança: a falha vira aviso.
 */
export async function consertarItensAoComecarABatalha(): Promise<void> {
  const acervo = useAcervoDeItensStore.getState()
  if (!acervo.podeGravar) return
  const aventura = useAdventureStore.getState()
  const fichas = personagensAtivos(aventura)
  const mudam = comAsCopiasEmDia(fichas, acervo.itens).filter((personagem, indice) => personagem !== fichas[indice])
  if (mudam.length === 0) return
  try {
    if (aventura.pasta !== null) await guardarRpgAntesDosItens(aventura.pasta.pastaId)
    for (const ficha of mudam) useAdventureStore.getState().ajustarPersonagem(ficha.id, (atual) => comAsCopiasEmDia([atual], useAcervoDeItensStore.getState().itens)[0] ?? atual)
    useToastStore.getState().push('info', `Começo da batalha: voltei ao que o Acervo diz os itens da mochila de ${juntos(mudam.map((ficha) => ficha.nome))}.`)
  } catch (erro) {
    useToastStore.getState().push('error', `Não deu para conferir os itens da batalha: ${erro instanceof Error ? erro.message : String(erro)}`)
  }
}
