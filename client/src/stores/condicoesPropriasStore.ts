import { create } from 'zustand'
import { join } from '@tauri-apps/api/path'
import type { CondicaoPropria } from '../types/map'
import { lerCatalogoDeCondicoes, lerCondicaoPropria, listaComCondicao, listaSemCondicao } from '../lib/condicoesProprias'
import { lerCondicoesDaPasta, mudarCondicoesDaPasta, type CondicoesLidas } from '../lib/condicoesNoDisco'
import { idDePastaValido, pastaDasPastas } from '../lib/pastasDeMapas'
import type { HostWorld } from '../net/hostSession'
import { useAdventureStore } from './adventureStore'
import { guardarCopiaDaListaDeCondicoes } from './conversaoDasCondicoes'
import { useToastStore } from './toastStore'

/**
 * A LISTA DE CONDIÇÕES QUE O MESTRE CRIOU (pedido de 09/11/2026). Mora junto
 * dos dados da PASTA aberta, num `condicoes.json` (`lib/condicoesNoDisco.ts`):
 *
 *  - mapa dentro de uma pasta do Carregar Mapa: `<appData>/pastas/<id>/`, ao
 *    lado do arquivo das fichas (`rpg.json`) — a lista é da campanha, e todo
 *    mapa da pasta a usa;
 *  - aventura fora de pasta: a pasta da aventura, ao lado do `adventure.json`;
 *  - mapa solto, aventura que ainda não foi salva, ou o app no navegador (sem
 *    disco): neste computador (`localStorage`), como era antes.
 *
 * MIGRAÇÃO: a pasta que ainda não tem o arquivo herda, na primeira vez que
 * abre, a lista que estava neste computador — e só nessa vez: daí em diante o
 * arquivo é a fonte, e o que o mestre excluir nele não volta. A lista do
 * computador não é apagada; segue valendo para o mapa solto.
 *
 * A marca posta numa ficha não depende desta lista — ela vai inteira dentro do
 * mapa (`Token.condicoesProprias`).
 *
 * REWORK DAS CONDIÇÕES (E2, docs/design/condicoes-rework/PLANO.md): a lista grava os campos novos (tipo,
 * desenho, peças, prazo e saídas; o arquivo sai na versão 2 quando algum aparece). Antes da 1ª gravação
 * numa pasta, a lista como era fica ao lado (`condicoes.json.antes-condicoes-v2`, uma vez,
 * `stores/conversaoDasCondicoes.ts`); sem a cópia, não grava. A condição que a leitura acharia torta
 * (o `confira` que ela acrescenta) não é gravada: nenhum campo sai do disco calado.
 */

const CHAVE = 'lb-condicoes-proprias'
/** O lugar "neste computador": o `localStorage`. */
const NO_COMPUTADOR = 'computador'

/** Sem armazenamento (janela privada, dado bloqueado, teste sem DOM) ou com lixo gravado, a lista nasce vazia. */
function lerDoComputador(): CondicaoPropria[] {
  try {
    const cru = window.localStorage.getItem(CHAVE)
    return cru === null ? [] : lerCatalogoDeCondicoes(JSON.parse(cru))
  } catch {
    return []
  }
}

function gravarNoComputador(catalogo: readonly CondicaoPropria[]): void {
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(catalogo))
  } catch {
    // Sem armazenamento a lista vale enquanto o app estiver aberto.
  }
}

/** Onde a lista mora: `chave` diz se mudou de lugar; `pasta` resolve o caminho (`null` = neste computador). */
export interface LugarDasCondicoes {
  chave: string
  pasta: (() => Promise<string>) | null
}

const LUGAR_NO_COMPUTADOR: LugarDasCondicoes = { chave: NO_COMPUTADOR, pasta: null }

/** O lugar da lista para o que está aberto no editor: a pasta do Carregar Mapa, a pasta da aventura, ou o computador. */
export function lugarDasCondicoesAberto(): LugarDasCondicoes {
  const { pasta, adventure, dir } = useAdventureStore.getState()
  if (pasta !== null && idDePastaValido(pasta.pastaId)) {
    const { pastaId } = pasta
    return { chave: `pasta:${pastaId}`, pasta: async () => join(await pastaDasPastas(), pastaId) }
  }
  if (adventure !== null && dir !== null) return { chave: `aventura:${dir}`, pasta: () => Promise.resolve(dir) }
  return LUGAR_NO_COMPUTADOR
}

interface CondicoesPropriasState {
  catalogo: readonly CondicaoPropria[]
  /** Onde a lista mora agora (`LugarDasCondicoes.chave`). */
  lugar: string
  /**
   * Cria, ou troca a que tem o mesmo id. `false` quando não gravou: condição que não passa na leitura (ou
   * que a leitura deixaria sem algum campo do rework, `lidaSemPerder`), ou lista cheia.
   */
  salvar: (condicao: CondicaoPropria) => boolean
  /**
   * Rework das condições (E2): grava várias numa ida só (renomear nas outras criadas, o Desfazer disso),
   * todas ou nenhuma. `false` = alguma não passa na leitura sem perder campo, ou as novas não cabem; aí
   * nada muda.
   */
  salvarVarias: (condicoes: readonly CondicaoPropria[]) => boolean
  excluir: (id: string) => void
  /**
   * A pasta aberta mudou: a lista passa a ser a do lugar novo. Resolve quando
   * ela foi lida (e a do computador migrou, na primeira vez da pasta). Nunca
   * rejeita: o que o disco recusar vira aviso.
   */
  mudarDeLugar: (lugar: LugarDasCondicoes) => Promise<void>
}

/** A pasta do lugar de agora, já pedida ao sistema; `null` = neste computador. */
let pastaDeAgora: Promise<string> | null = null
/** Sobe a cada troca de lugar: o que ainda chegar do lugar de antes não entra na lista. */
let geracao = 0

function avisar(tipo: 'info' | 'error', texto: string): void {
  useToastStore.getState().push(tipo, texto, undefined, { chave: 'condicoes-no-disco' })
}

function textoDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

/**
 * A condição pela leitura sem perder campo do rework: se a leitura achou campo torto (peças, prazo,
 * saídas ou tipo fora do formato), ela o deixaria de fora com um `confira` novo; essa não é gravada.
 * O `confira` que já vinha (a condição lida torta antes) passa igual.
 */
function lidaSemPerder(condicao: CondicaoPropria): CondicaoPropria | null {
  const limpa = lerCondicaoPropria(condicao)
  if (limpa === null) return null
  return limpa.confira !== undefined && limpa.confira !== condicao.confira ? null : limpa
}

/** A lista com todas estas gravadas (`listaComCondicao` uma a uma); `null` = alguma não coube. */
function listaComTodas(lista: readonly CondicaoPropria[], condicoes: readonly CondicaoPropria[]): CondicaoPropria[] | null {
  let atual: CondicaoPropria[] = [...lista]
  for (const condicao of condicoes) {
    const proxima = listaComCondicao(atual, condicao)
    if (proxima === null) return null
    atual = proxima
  }
  return atual
}

/** A cópia da lista como era, por pasta: pedida uma vez, e toda gravação da pasta espera por ela. */
const copiasDaLista = new Map<string, Promise<unknown>>()

/**
 * Rework das condições (E2): antes da 1ª gravação da lista numa pasta, a cópia `.antes-condicoes-v2`,
 * UMA vez (`guardarCopiaDaListaDeCondicoes`, que nunca grava por cima da que já existe). Falhou: a
 * gravação não sai (lança com a frase pronta) e a próxima tenta a cópia de novo.
 */
function copiaDaListaAntes(caminho: string): Promise<unknown> {
  const ja = copiasDaLista.get(caminho)
  if (ja !== undefined) return ja
  const copia = guardarCopiaDaListaDeCondicoes(caminho).catch((erro: unknown) => {
    copiasDaLista.delete(caminho)
    throw new Error(`Não foi possível guardar a cópia da lista de condições de antes das condições novas: ${textoDoErro(erro)}.`)
  })
  copiasDaLista.set(caminho, copia)
  return copia
}

export const useCondicoesPropriasStore = create<CondicoesPropriasState>()((set, get) => {
  /**
   * Grava a mudança onde a lista mora. Na pasta, `mudar` vale sobre o que está
   * no disco AGORA (ler-mudar-gravar na fila da pasta), e a lista da tela
   * passa a ser o que ficou lá. O disco recusou: a mudança fica na tela até o
   * app fechar, e o aviso diz que não foi gravada.
   */
  const persistir = (mudar: (lista: readonly CondicaoPropria[]) => readonly CondicaoPropria[]): void => {
    const pasta = pastaDeAgora
    if (pasta === null) {
      gravarNoComputador(get().catalogo)
      return
    }
    const minha = geracao
    void pasta
      .then(async (caminho) => {
        await copiaDaListaAntes(caminho)
        return mudarCondicoesDaPasta(caminho, mudar)
      })
      .then(
        (gravadas) => {
          if (minha === geracao) set({ catalogo: gravadas.condicoes })
        },
        (erro: unknown) => avisar('error', `${textoDoErro(erro)} A mudança vale até você fechar o app.`),
      )
  }

  return {
    catalogo: lerDoComputador(),
    lugar: NO_COMPUTADOR,

    salvar: (condicao) => {
      const limpa = lidaSemPerder(condicao)
      if (limpa === null) return false
      const catalogo = listaComCondicao(get().catalogo, limpa)
      if (catalogo === null) return false
      set({ catalogo })
      // No disco a lista pode estar cheia sem a tela saber (outra janela): aí ela fica como está.
      persistir((lista) => listaComCondicao(lista, limpa) ?? lista)
      return true
    },

    salvarVarias: (condicoes) => {
      const limpas: CondicaoPropria[] = []
      for (const condicao of condicoes) {
        const limpa = lidaSemPerder(condicao)
        if (limpa === null) return false
        limpas.push(limpa)
      }
      if (limpas.length === 0) return true
      const catalogo = listaComTodas(get().catalogo, limpas)
      if (catalogo === null) return false
      set({ catalogo })
      // Como no `salvar`: o que não couber no disco agora fica como está lá.
      persistir((lista) => listaComTodas(lista, limpas) ?? lista)
      return true
    },

    excluir: (id) => {
      const catalogo = listaSemCondicao(get().catalogo, id)
      if (catalogo === get().catalogo) return
      set({ catalogo })
      persistir((lista) => listaSemCondicao(lista, id))
    },

    mudarDeLugar: async (lugar) => {
      if (lugar.chave === get().lugar) return
      geracao += 1
      const minha = geracao
      if (lugar.pasta === null) {
        pastaDeAgora = null
        set({ lugar: lugar.chave, catalogo: lerDoComputador() })
        return
      }
      const pasta = lugar.pasta()
      // Quem lê `pastaDeAgora` trata a recusa; aqui ela só não pode ficar solta.
      pasta.catch(() => undefined)
      pastaDeAgora = pasta
      // A lista do lugar de antes sai da tela na hora: os chips de outra pasta não ficam à mão enquanto esta abre.
      set({ lugar: lugar.chave, catalogo: [] })
      const doComputador = lerDoComputador()
      let caminho: string
      try {
        caminho = await pasta
      } catch (erro) {
        // Nem o caminho da pasta saiu: a lista do computador vale na tela, sem gravar em lugar nenhum.
        if (minha !== geracao) return
        set({ catalogo: doComputador })
        avisar('error', `Não foi possível abrir a lista de condições desta pasta: ${textoDoErro(erro)}`)
        return
      }
      let lidas: CondicoesLidas = await lerCondicoesDaPasta(caminho)
      // MIGRAÇÃO: só a pasta que ainda não tem o arquivo herda a lista do computador. A conferência
      // é refeita dentro da fila (`existe`): duas aberturas seguidas não migram duas vezes.
      if (!lidas.existe && lidas.podeGravar && doComputador.length > 0) {
        try {
          lidas = await mudarCondicoesDaPasta(caminho, (_lista, existe) => (existe ? null : doComputador))
        } catch (erro) {
          // Não gravou: nada se perde — a lista continua no computador e vale na tela; a próxima abertura tenta de novo.
          lidas = { ...lidas, condicoes: doComputador, aviso: textoDoErro(erro) }
        }
      }
      if (minha !== geracao) return
      set({ catalogo: lidas.condicoes })
      if (lidas.aviso !== null) avisar(lidas.podeGravar ? 'info' : 'error', lidas.aviso)
    },
  }
})

/**
 * CONDIÇÕES NA FICHA (E4a): o mundo que o host serve leva a lista do mestre,
 * para o recorte de cada jogador desenhar a pastilha da condição criada que
 * está numa ficha de personagem (`lib/condicoes/pastilhas.ts`). Sem ficha no
 * mundo, ou lista vazia: o mesmo mundo.
 */
export function mundoComAsCondicoesCriadas(mundo: HostWorld): HostWorld {
  const { catalogo } = useCondicoesPropriasStore.getState()
  if (mundo.rpg === undefined || catalogo.length === 0) return mundo
  return { ...mundo, rpg: { ...mundo.rpg, condicoesCriadas: catalogo } }
}

/**
 * Liga a lista à pasta aberta no editor: a cada abertura (ou quando o mapa
 * entra numa pasta, sai dela, ou a aventura ganha a pasta dela no primeiro
 * Salvar), a lista troca de lugar. Só o app chama (`App.tsx`): no navegador
 * não há disco, e a lista fica no computador. Devolve o cancelamento.
 */
export function seguirAPastaDasCondicoes(): () => void {
  const acertar = (): void => {
    void useCondicoesPropriasStore.getState().mudarDeLugar(lugarDasCondicoesAberto())
  }
  acertar()
  return useAdventureStore.subscribe(acertar)
}
