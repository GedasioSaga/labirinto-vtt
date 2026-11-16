import { create } from 'zustand'
import type { Personagem } from '../../lib/personagem'
import type { LigaCena, LigaFicha } from '../../lib/preparo/tipos'
import { editarRpgDaPasta } from '../../stores/rpgDaPasta'
import { useAdventureStore } from '../../stores/adventureStore'
import { usePreludio } from '../estado/preludio'
import { useMapaNaMemoria } from '../mesa/catalogo'
import type { FioDoPreludio } from './fioDaJanela'
import type { AndamentoDoPor, ComoVaiAoMapa, EstadoDaMesa, ItemNaMesa, SecaoParaOMapa, TipoParaOMapa, VerbeteParaOMapa } from './protocolo'

/**
 * A MESA VISTA DE DENTRO DO PRELÚDIO (P2): o que a janela principal contou pelo
 * fio, para as páginas do Prelúdio (a sessão, o verbete, o quadro) que ficam
 * fundo demais na árvore para receber por propriedade. Só a janela do Prelúdio
 * liga (`JanelaDoPreludio.tsx`); na tela do Prelúdio dentro da principal a loja
 * fica desligada e as páginas leem o mapa direto das lojas do editor.
 */

interface EstadoDaMesaNaJanela {
  /** Esta é a janela do Prelúdio, com fio para a mesa. */
  ligada: boolean
  /** A mesa respondeu há pouco. */
  viva: boolean
  estado: EstadoDaMesa | null
  /** "Na mesa" (P3): os pinos ligados do mapa aberto na principal. */
  naMesa: readonly ItemNaMesa[]
  /** O "Pôr no mapa" em curso: pedido à mesa, ou esperando o clique do mestre. */
  pondo: PorNoMapaEmCurso | null
  /** Por que o último "Pôr no mapa" não aconteceu; `null` = nada a dizer. */
  avisoDoPor: string | null
  /** E3: o verbete inteiro indo ao mapa pelo tipo (token, item ou lugar). */
  pondoVerbete: PorVerbeteEmCurso | null
  /** E3: por que o último "Pôr no mapa" de verbete não aconteceu (à parte do das seções, que cada seção mostra). */
  avisoDoVerbete: string | null
  /** E3: o último verbete que a mesa pôs no mapa (para o "Na mesa" da linha), com o tipo. */
  postoVerbete: { readonly verbeteId: string; readonly como: ComoVaiAoMapa } | null
}

export interface PorVerbeteEmCurso {
  readonly pedido: number
  readonly fonte: VerbeteParaOMapa
  readonly como: ComoVaiAoMapa
  readonly andamento: 'pedindo' | 'esperando'
}

export interface PorNoMapaEmCurso {
  readonly pedido: number
  readonly fonte: SecaoParaOMapa
  readonly kind: TipoParaOMapa
  /** `pedindo` = a mesa ainda confere a seção; `esperando` = a ferramenta Pino está na mão lá. */
  readonly andamento: 'pedindo' | 'esperando'
}

export const useMesaNaJanela = create<EstadoDaMesaNaJanela>()(() => ({
  ligada: false,
  viva: false,
  estado: null,
  naMesa: [],
  pondo: null,
  avisoDoPor: null,
  pondoVerbete: null,
  avisoDoVerbete: null,
  postoVerbete: null,
}))

let fio: FioDoPreludio | null = null

/** Só a janela do Prelúdio liga (e desliga ao sair). */
export function definirFioDaMesa(novo: FioDoPreludio | null): void {
  fio = novo
  if (novo === null) useMesaNaJanela.setState({ ligada: false, viva: false, estado: null, naMesa: [], pondo: null, avisoDoPor: null, pondoVerbete: null, avisoDoVerbete: null, postoVerbete: null })
}

const NAO_GRAVOU = 'O Prelúdio ainda não gravou esta seção. Tente de novo em instantes.'
const NAO_GRAVOU_O_VERBETE = 'O Prelúdio ainda não gravou este verbete. Tente de novo em instantes.'

/**
 * "PÔR NO MAPA" (P3): grava o que falta (a mesa lê a seção do disco) e pede à
 * mesa que espere o clique do mestre. Seção de segredo nem chega a pedir: o
 * botão fica desligado, e a mesa confere de novo do lado dela.
 */
export async function porNoMapa(fonte: SecaoParaOMapa, kind: TipoParaOMapa): Promise<void> {
  if (fio === null) return
  const anterior = useMesaNaJanela.getState().pondo
  if (anterior !== null) fio.cancelarPor(anterior.pedido)
  useMesaNaJanela.setState({ pondo: null, avisoDoPor: null })
  const gravou = await usePreludio.getState().salvarPendentes()
  if (fio === null) return
  if (!gravou) {
    useMesaNaJanela.setState({ avisoDoPor: NAO_GRAVOU })
    return
  }
  const pedido = fio.porNoMapa(fonte, kind)
  useMesaNaJanela.setState({ pondo: { pedido, fonte, kind, andamento: 'pedindo' } })
}

export function cancelarPorNoMapa(): void {
  const pondo = useMesaNaJanela.getState().pondo
  if (pondo === null) return
  fio?.cancelarPor(pondo.pedido)
  useMesaNaJanela.setState({ pondo: null })
}

/**
 * "PÔR NO MAPA" POR TIPO (E3): o verbete inteiro, e não uma seção. A mesa lê o
 * verbete do disco, prepara (a ficha do token, o item do Acervo, a imagem do
 * lugar) e espera o clique do mestre. Um "Pôr no mapa" de cada vez, de seção ou
 * de verbete.
 */
export async function porVerbeteNoMapa(fonte: VerbeteParaOMapa, como: ComoVaiAoMapa, ficha: LigaFicha | null): Promise<void> {
  if (fio === null) return
  const { pondo, pondoVerbete } = useMesaNaJanela.getState()
  if (pondo !== null) fio.cancelarPor(pondo.pedido)
  if (pondoVerbete !== null) fio.cancelarPor(pondoVerbete.pedido)
  useMesaNaJanela.setState({ pondo: null, pondoVerbete: null, avisoDoPor: null, avisoDoVerbete: null })
  const gravou = await usePreludio.getState().salvarPendentes()
  if (fio === null) return
  if (!gravou) {
    useMesaNaJanela.setState({ avisoDoVerbete: NAO_GRAVOU_O_VERBETE })
    return
  }
  const pedido = fio.porVerbete(fonte, como, ficha)
  useMesaNaJanela.setState({ pondoVerbete: { pedido, fonte, como, andamento: 'pedindo' } })
}

export function cancelarPorVerbete(): void {
  const pondoVerbete = useMesaNaJanela.getState().pondoVerbete
  if (pondoVerbete === null) return
  fio?.cancelarPor(pondoVerbete.pedido)
  useMesaNaJanela.setState({ pondoVerbete: null })
}

/**
 * A FICHA NOVA DO "VIRAR NPC" NA PASTA. Na janela do Prelúdio, pela mesa: é a
 * janela principal que tem a cópia aberta da pasta, e gravar por fora dela
 * deixaria a próxima gravação do mapa escrever por cima. No Prelúdio dentro da
 * principal, direto (`editarRpgDaPasta`). A ficha com o mesmo id troca a que
 * está lá. `null` = gravou; senão, o motivo.
 */
export async function gravarFichaNaPasta(pastaId: string, personagem: Personagem): Promise<string | null> {
  if (fio !== null) return fio.gravarFicha(pastaId, personagem)
  try {
    await editarRpgDaPasta(pastaId, (rpg) => ({ ...rpg, personagens: comAFicha(rpg.personagens, personagem) }))
    return null
  } catch (erro) {
    return erro instanceof Error ? erro.message : String(erro)
  }
}

/** A lista com a ficha: no lugar da de mesmo id, ou no fim. */
export function comAFicha(personagens: readonly Personagem[], ficha: Personagem): Personagem[] {
  return personagens.some((um) => um.id === ficha.id) ? personagens.map((um) => (um.id === ficha.id ? ficha : um)) : [...personagens, ficha]
}

/** O recado `pondo` da mesa. Pedido velho (outro "Pôr no mapa" já começou) não mexe em nada. */
export function aoPondo(pedido: number, andamento: AndamentoDoPor, motivo: string | null): void {
  const doVerbete = useMesaNaJanela.getState().pondoVerbete
  if (doVerbete !== null && doVerbete.pedido === pedido) {
    if (andamento === 'esperando') useMesaNaJanela.setState({ pondoVerbete: { ...doVerbete, andamento: 'esperando' } })
    else
      useMesaNaJanela.setState({
        pondoVerbete: null,
        avisoDoVerbete: andamento === 'recusado' ? (motivo ?? 'A mesa não pôs este verbete no mapa.') : null,
        postoVerbete: andamento === 'posto' ? { verbeteId: doVerbete.fonte.verbeteId, como: doVerbete.como } : useMesaNaJanela.getState().postoVerbete,
      })
    return
  }
  const atual = useMesaNaJanela.getState().pondo
  if (atual === null || atual.pedido !== pedido) return
  if (andamento === 'esperando') useMesaNaJanela.setState({ pondo: { ...atual, andamento: 'esperando' } })
  else useMesaNaJanela.setState({ pondo: null, avisoDoPor: andamento === 'recusado' ? (motivo ?? 'A mesa não pôs esta seção no mapa.') : null })
}

/** "Mostrar no mapa": a mesa abre a cena e seleciona o pino, pela porta dos links do roteiro. */
export function mostrarNoMapa(item: ItemNaMesa): void {
  fio?.irAMesa({ chave: item.chave, sceneId: item.sceneId, pinoId: item.pinoId })
}

/** "Ler agora" (P4) de um "!" da lista "Na mesa": a mesa lê para todos da cena do pino. */
export function lerAgoraNaMesa(item: ItemNaMesa): void {
  fio?.lerAgora({ chave: item.chave, sceneId: item.sceneId, pinoId: item.pinoId })
}

/** A cena aberta na mesa agora, no formato do link; `null` = nenhum mapa (ou mapa novo, sem pasta). */
export interface CenaAberta {
  readonly alvo: LigaCena
  readonly nome: string
}

/** Na janela, pelo que a mesa contou; na tela de dentro da principal, pelas lojas do editor. */
export function useCenaAbertaNaMesa(): CenaAberta | null {
  const ligada = useMesaNaJanela((estado) => estado.ligada)
  const estado = useMesaNaJanela((mesa) => mesa.estado)
  const naMemoria = useMapaNaMemoria()
  const activeSceneId = useAdventureStore((aventura) => aventura.activeSceneId)
  const adventure = useAdventureStore((aventura) => aventura.adventure)
  if (ligada) {
    const mapa = estado?.mapa ?? null
    if (mapa === null || mapa.chave === null) return null
    const cena = estado?.cena ?? null
    return { alvo: { chave: mapa.chave, sceneId: cena?.id ?? '' }, nome: cena === null ? mapa.nome : `${mapa.nome} › ${cena.nome}` }
  }
  if (naMemoria === null) return null
  const cena = adventure === null ? undefined : adventure.scenes.find((uma) => uma.id === activeSceneId)
  if (adventure !== null && cena === undefined) return null
  return { alvo: { chave: naMemoria.chave, sceneId: cena?.id ?? '' }, nome: cena === undefined ? naMemoria.nome : `${naMemoria.nome} › ${cena.name}` }
}

/** O mesmo lugar: mesmo mapa e mesma cena (o pino não conta). */
export function mesmaCena(a: LigaCena, b: LigaCena): boolean {
  return a.chave === b.chave && a.sceneId === b.sceneId
}
