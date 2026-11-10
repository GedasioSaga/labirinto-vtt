import { marcarRealceNoMapa } from '../lib/batalha/realceNoMapa'
import { isSingleGroup, NO_GROUPS } from '../lib/itemGroups'
import { EMPTY_SELECTION, isSelectionEmpty, selectionOfItem, selectionSingle, type SelectionSet } from '../lib/selectionModel'
import { useMapStore } from './mapStore'

/**
 * O seletor "Atribuir token" e o mapa conversam por aqui, sem o canvas saber
 * de nada: o destaque é a SELEÇÃO do editor (o anel que o mestre já conhece) e
 * o "clicar no token no mapa" é ouvir essa mesma seleção mudar DENTRO de um
 * clique no canvas.
 *
 * Tudo é vista do mestre: o mapa não muda (nada para desfazer) e a rede não
 * manda nada. O que os dois mexem no editor (ferramenta, seleção, pino) volta
 * a ser o que era quando acabam sem escolha.
 */

export interface DestaqueNoMapa {
  /** Acende o token da cena aberta; `null` (ou token de outra cena) volta ao que estava. */
  destacar(tokenId: string | null): void
  /** A lista fechou: a seleção volta a ser a de antes de abrir. */
  soltar(): void
}

/** A seleção que o destaque da lista faz não é clique do mestre: quem espera o clique no mapa a ignora. */
let peloDestaque = false

function selecionarPeloDestaque(selecao: SelectionSet): void {
  peloDestaque = true
  try {
    useMapStore.getState().setSelection(selecao)
  } finally {
    peloDestaque = false
  }
}

/** Quem espera o clique agora: chamado quando outro card arma ou quando uma lista abre. */
let esperaAtual: (() => void) | null = null

/** Guarda a seleção de agora e devolve o controle do destaque enquanto a lista está aberta. */
export function abrirDestaqueNoMapa(): DestaqueNoMapa {
  // Uma lista aberta tira a vez de quem esperava o clique no mapa: apontar uma
  // linha da lista de um jogador nunca dá o token a outro.
  esperaAtual?.()
  const inicio = useMapStore.getState()
  // Selecionar um token solta o pino e a zona oculta do painel: os dois voltam junto com a seleção.
  const antes = { selecao: inicio.selection, pino: inicio.selectedPinId, zona: inicio.selectedConcealZoneId }
  let aceso: string | null = null

  const voltar = (): void => {
    if (aceso === null) return
    const store = useMapStore.getState()
    // O mestre selecionou outra coisa no meio do caminho: a escolha dele fica.
    const atual = selectionSingle(store.selection)
    if (atual?.kind === 'token' && atual.id === aceso) {
      selecionarPeloDestaque(antes.selecao)
      if (antes.pino !== null) store.setSelectedPin(antes.pino)
      else if (antes.zona !== null) store.setSelectedConcealZone(antes.zona)
    }
    aceso = null
  }

  return {
    destacar(tokenId) {
      if (tokenId === aceso) return
      const store = useMapStore.getState()
      if (tokenId === null || !store.map.tokens.some((token) => token.id === tokenId)) {
        voltar()
        return
      }
      aceso = tokenId
      // A seleção aqui é só realce da lista: marcada, o Delete/Backspace/recortar do editor não age nela.
      const selecao = selectionOfItem({ kind: 'token', id: tokenId })
      marcarRealceNoMapa(selecao)
      selecionarPeloDestaque(selecao)
    },
    soltar: voltar,
  }
}

/** A área do mapa no editor (`App.tsx`): o canvas mora nela, e é sobre ela que o aviso da espera aparece. */
export const MAPA_DO_EDITOR = '.lb-editor__canvas'
/** Só o aperto que nasce no canvas do mapa é clique no mapa. */
const CANVAS_DO_MAPA = `${MAPA_DO_EDITOR} canvas`

/**
 * A espera desiste sozinha depois deste tempo: um modo esquecido ligado não dá
 * o próximo token que o mestre selecionar a ninguém.
 */
export const PRAZO_DA_ESPERA_MS = 30_000

/**
 * Por que a espera acabou sem escolha: `vez` = outro tirou a vez (outro card,
 * outra ferramenta, o prazo); `grupo` = o clique pegou um token agrupado.
 */
export type FimSemEscolha = 'vez' | 'grupo'

/**
 * "Clicar no token no mapa": arma a ferramenta Selecionar com a seleção vazia
 * e avisa o primeiro token que o mestre CLICAR no mapa. Só o clique conta: a
 * seleção que muda fora de um aperto no canvas (o destaque de uma lista, outro
 * painel, um atalho) não escolhe ninguém. Devolve como desarmar.
 *
 * A seleção começa vazia de propósito: clicar no token que já estava
 * selecionado não mudaria nada, e o clique passaria em branco.
 *
 * Acaba de cinco jeitos: o clique (`aoClicar`, e o token clicado fica
 * selecionado), o desarmar de quem armou, os três que tiram a vez
 * (`aoPerderAVez('vez')`): outro card armou ou uma lista abriu, o mestre pegou
 * outra ferramenta, ou o prazo venceu; e o clique num token AGRUPADO
 * (`aoPerderAVez('grupo')`), que seleciona o grupo inteiro. Sem clique, a
 * ferramenta e a seleção voltam a ser as de antes.
 */
export function esperarTokenNoMapa(
  aoClicar: (tokenId: string) => void,
  aoPerderAVez: (motivo: FimSemEscolha) => void,
  prazoMs: number = PRAZO_DA_ESPERA_MS,
): () => void {
  // Um card de cada vez espera o clique: o que armou antes perde a vez.
  esperaAtual?.()
  const inicio = useMapStore.getState()
  const antes = { ferramenta: inicio.activeTool, selecao: inicio.selection }
  if (inicio.activeTool !== 'select') inicio.setActiveTool('select')
  inicio.setSelection(EMPTY_SELECTION)

  let viva = true
  let gestoNoMapa = false
  let fimDoGesto: ReturnType<typeof setTimeout> | null = null

  const aoApertar = (evento: PointerEvent): void => {
    if (fimDoGesto !== null) clearTimeout(fimDoGesto)
    fimDoGesto = null
    // Só o botão principal: o direito abre o menu do token, não o escolhe.
    gestoNoMapa = evento.button === 0 && evento.target instanceof Element && evento.target.matches(CANVAS_DO_MAPA)
  }
  const aoSoltar = (): void => {
    // O editor ainda seleciona ao soltar (o clique que fecha um laço): o gesto acaba depois dele.
    fimDoGesto = setTimeout(() => {
      fimDoGesto = null
      gestoNoMapa = false
    }, 0)
  }

  const encerrar = (): void => {
    viva = false
    parar()
    clearTimeout(prazo)
    if (fimDoGesto !== null) clearTimeout(fimDoGesto)
    window.removeEventListener('pointerdown', aoApertar, true)
    window.removeEventListener('pointerup', aoSoltar, true)
    window.removeEventListener('pointercancel', aoSoltar, true)
    if (esperaAtual === tirarAVez) esperaAtual = null
  }
  const devolver = (): void => {
    const agora = useMapStore.getState()
    // O mestre mexeu no meio do caminho (outra ferramenta, outra seleção): a escolha dele fica.
    if (agora.activeTool !== 'select' || !isSelectionEmpty(agora.selection)) return
    // A ferramenta antes da seleção: trocar para uma ferramenta que cria limpa a seleção.
    if (antes.ferramenta !== 'select') agora.setActiveTool(antes.ferramenta)
    if (!isSelectionEmpty(antes.selecao)) agora.setSelection(antes.selecao)
  }
  const desarmar = (): void => {
    if (!viva) return
    encerrar()
    devolver()
  }
  const tirarAVez = (motivo: FimSemEscolha = 'vez'): void => {
    if (!viva) return
    desarmar()
    aoPerderAVez(motivo)
  }

  const parar = useMapStore.subscribe((estado, anterior) => {
    // Com outra ferramenta na mão o clique não seleciona token: a espera acabou.
    if (estado.activeTool !== 'select') {
      tirarAVez()
      return
    }
    if (peloDestaque || !gestoNoMapa || estado.selection === anterior.selection) return
    const unico = selectionSingle(estado.selection)
    if (unico?.kind !== 'token') {
      // Token agrupado (Ctrl+G): o clique seleciona o grupo inteiro e a seleção não diz qual membro foi clicado.
      // A espera acaba avisando, em vez de ficar muda até o prazo; o grupo fica selecionado, para o mestre desagrupar dali.
      const noGrupo = estado.selection.some((item) => item.kind === 'token') && isSingleGroup(estado.itemGroups[estado.map.id] ?? NO_GROUPS, estado.selection)
      if (noGrupo) tirarAVez('grupo')
      return
    }
    // O clique fecha a espera sem devolver nada: o token clicado fica selecionado, e o gesto (talvez um arrasto) segue.
    encerrar()
    aoClicar(unico.id)
  })
  const prazo = setTimeout(tirarAVez, prazoMs)
  window.addEventListener('pointerdown', aoApertar, true)
  window.addEventListener('pointerup', aoSoltar, true)
  window.addEventListener('pointercancel', aoSoltar, true)
  esperaAtual = tirarAVez
  return desarmar
}
