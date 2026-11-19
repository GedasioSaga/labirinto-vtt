import type { MapData } from '../types/map'
import type { SelectionKind } from '../types/tools'
import type { SelectionSet } from '../lib/selectionModel'
import { EMPTY_SELECTION } from '../lib/selectionModel'
import { mapaDoPiso } from '../lib/pisos'
import { portaSozinhaNaSelecao } from '../lib/mapFactory'
import { barradoPeloGesto, useMapStore } from '../stores/mapStore'
import { useFerramentaDaAgua } from '../stores/ferramentaDaAgua'
import { useFerramentaDoAbismo } from '../stores/ferramentaDoAbismo'
import { apagarPinoPeloGesto } from '../stores/pinoPeloGesto'
import { pinTravelOf, useAdventureStore } from '../stores/adventureStore'
import { useToastStore } from '../stores/toastStore'
import type { GestoDoBarranco } from './barrancoNoEditor'
import type { GestoDoAbismo } from './abismoNoEditor'
import type { GestoDaAgua } from './aguaNoEditor'

/**
 * A ESCOLHA DO EDITOR: as seis coisas que podem estar escolhidas no mapa ao
 * mesmo tempo, lidas de UM lugar. Três moram na escolha do painel da store (o
 * conjunto, o pino aberto, a zona oculta aberta — exclusivos entre si pela
 * regra `escolhaNoPainel` do `mapStore`) e três nas ferramentas de terreno
 * (o risco do Barranco, a água, o abismo), que só valem com a ferramenta
 * delas na mão. O Esc e o Delete do canvas passam por aqui: quem solta o quê
 * e quem o Delete apaga primeiro está escrito uma vez só.
 */
export interface EscolhaDoEditor {
  /** O conjunto selecionado (`mapStore.selection`). */
  conjunto: SelectionSet
  /** O pino aberto no painel (`mapStore.selectedPinId`). */
  pino: string | null
  /** A zona oculta aberta no painel (`mapStore.selectedConcealZoneId`). */
  zona: string | null
  /** O risco escolhido com a ferramenta Barranco (`mapStore.barrancoEscolhido`). */
  risco: string | null
  /** A água escolhida com a ferramenta Água (`ferramentaDaAgua.escolhida`). */
  agua: string | null
  /** O abismo escolhido com a ferramenta Abismo (`ferramentaDoAbismo.escolhido`). */
  abismo: string | null
}

/** As seis escolhas num retrato só. */
export function lerEscolhaDoEditor(): EscolhaDoEditor {
  const { selection, selectedPinId, selectedConcealZoneId, barrancoEscolhido } = useMapStore.getState()
  return {
    conjunto: selection,
    pino: selectedPinId,
    zona: selectedConcealZoneId,
    risco: barrancoEscolhido,
    agua: useFerramentaDaAgua.getState().escolhida,
    abismo: useFerramentaDoAbismo.getState().escolhido,
  }
}

interface EntityLabel {
  um: string
  varios: string
  feminino: boolean
}

/**
 * Nome em PT-BR de cada tipo de item, para o aviso de apagar dizer O QUE
 * sumiu em vez de "1 item". Mesmos nomes que a pessoa já lê no painel
 * ("Parede" em `WallStyleControls`, "Escada" em `StairControls`, "Região" em
 * `RegionStyleControls`) e na lista de camadas (`LAYER_LABELS`, `lib/layers.ts`)
 * — o aviso não pode inventar um vocabulário terceiro.
 *
 * `feminino` existe por causa da concordância: sem ele o aviso sairia "Parede
 * apagado". `Record<SelectionKind, …>` é exaustivo por construção — tipo novo
 * de seleção sem rótulo aqui não compila.
 */
const ENTITY_LABELS: Record<SelectionKind, EntityLabel> = {
  wall: { um: 'parede', varios: 'paredes', feminino: true },
  region: { um: 'região', varios: 'regiões', feminino: true },
  stair: { um: 'escada', varios: 'escadas', feminino: true },
  light: { um: 'luz', varios: 'luzes', feminino: true },
  token: { um: 'token', varios: 'tokens', feminino: false },
  prop: { um: 'objeto', varios: 'objetos', feminino: false },
  drawing: { um: 'desenho', varios: 'desenhos', feminino: false },
  floor: { um: 'pedaço de chão', varios: 'pedaços de chão', feminino: false },
  carimbo: { um: 'carimbo', varios: 'carimbos', feminino: false },
  pin: { um: 'pino', varios: 'pinos', feminino: false },
  zone: { um: 'zona oculta', varios: 'zonas ocultas', feminino: true },
  agua: { um: 'água', varios: 'águas', feminino: true },
  barranco: { um: 'risco de barranco', varios: 'riscos de barranco', feminino: false },
  abismo: { um: 'abismo', varios: 'abismos', feminino: false },
}

/** Sala é uma `Region` COM `room` (`types/map.ts`), e quem a apagou leu "Sala"
 *  no painel, não "Região". A distinção só existe olhando o mapa, por isso
 *  mora aqui e não na tabela acima, que é indexada só por `SelectionKind`. */
const SALA_LABEL: EntityLabel = { um: 'sala', varios: 'salas', feminino: true }

function entityLabel(map: MapData, item: { kind: SelectionKind; id: string }): EntityLabel {
  if (item.kind === 'region' && map.regions.some((region) => region.id === item.id && region.room)) return SALA_LABEL
  return ENTITY_LABELS[item.kind]
}

const capitalize = (texto: string): string => texto.charAt(0).toUpperCase() + texto.slice(1)

/**
 * Frase do aviso de apagar, NOMEANDO o que sumiu — "1 item apagado" não diz
 * nada a quem acabou de varrer o mapa com Ctrl+A. Três casos, que são os que
 * acontecem de verdade: um item ("Sala apagada"), N do mesmo tipo ("3 paredes
 * apagadas") e mistura ("12 itens apagados: 5 paredes, 4 salas, 3 tokens").
 *
 * Recebe o mapa de ANTES da remoção — depois dela os ids já não existem e não
 * há como saber se aquela região era uma Sala. Seleção vazia devolve `null`:
 * não houve nada para apagar, e aviso nenhum deve aparecer.
 */
function describeDeletion(map: MapData, selection: readonly { kind: SelectionKind; id: string }[]): string | null {
  if (selection.length === 0) return null

  // Chave = o rótulo singular: é o que distingue Sala de Região, e duas
  // entradas da tabela nunca compartilham singular.
  const porRotulo = new Map<string, { label: EntityLabel; total: number }>()
  for (const item of selection) {
    const label = entityLabel(map, item)
    const atual = porRotulo.get(label.um)
    if (atual) atual.total += 1
    else porRotulo.set(label.um, { label, total: 1 })
  }

  const grupos = [...porRotulo.values()]
  const frase = ({ label, total }: { label: EntityLabel; total: number }) =>
    total === 1 ? `1 ${label.um}` : `${total} ${label.varios}`
  const apagado = (label: EntityLabel, total: number) => `apagad${label.feminino ? 'a' : 'o'}${total === 1 ? '' : 's'}`

  if (grupos.length === 1) {
    const grupo = grupos[0]
    const alvo = grupo.total === 1 ? grupo.label.um : `${grupo.total} ${grupo.label.varios}`
    return capitalize(`${alvo} ${apagado(grupo.label, grupo.total)}`)
  }

  // Mistura: o total vem primeiro (é a informação que assusta) e a quebra
  // depois, do tipo mais numeroso para o menos — empate mantém a ordem em que
  // o tipo apareceu na seleção, para a frase não dançar entre dois gestos iguais.
  const detalhe = grupos
    .slice()
    .sort((a, b) => b.total - a.total)
    .map(frase)
    .join(', ')
  return `${selection.length} itens apagados: ${detalhe}`
}

export interface EscolhaNoCanvas {
  /** Esc, primeira parte: solta o risco do Barranco e a água escolhidos (o abismo é solto pelo `cancelar` do gesto dele, no `clearDrafts`). */
  soltarTerrenoNoEsc: () => void
  /**
   * Esc, segunda parte (depois de o canvas largar o laço aberto): limpa o
   * conjunto, de QUALQUER tamanho, e fecha o pino aberto. A zona oculta
   * aberta fica, como sempre ficou.
   */
  soltarPainelNoEsc: () => void
  /**
   * Delete: apaga a escolha que manda, nesta ordem — o risco, o abismo e a
   * água (cada um só com a ferramenta dele na mão), o pino aberto, a zona
   * aberta e, por fim, o conjunto, com o aviso do que sumiu.
   */
  apagar: () => void
}

export function criarEscolhaNoCanvas(dep: {
  barranco: Pick<GestoDoBarranco, 'apagarEscolhido'>
  abismo: Pick<GestoDoAbismo, 'apagarEscolhido'>
  agua: Pick<GestoDaAgua, 'apagarEscolhida' | 'soltarEscolhida'>
}): EscolhaNoCanvas {
  return {
    soltarTerrenoNoEsc() {
      // Barranco: Esc solta o risco escolhido.
      useMapStore.getState().setBarrancoEscolhido(null)
      // Água: Esc solta a água escolhida.
      dep.agua.soltarEscolhida()
    },
    soltarPainelNoEsc() {
      // O "de qualquer tamanho" é de 17/09/2026: até aqui só grupo (2+
      // itens) era largado, e um item só ficava grudado. No passeio, o
      // "Closet secreto" seguia contornado de amarelo depois de dois
      // Escape — um com a ferramenta Sala, outro com a Selecionar — e o
      // painel continuava mostrando as propriedades dele. Largar a
      // seleção só clicando numa área vazia é dizer que a tecla
      // universal de "deixa pra lá" não vale aqui; ela vale.
      if (useMapStore.getState().selection.length > 0) {
        useMapStore.getState().setSelection(EMPTY_SELECTION)
      }
      // O pino tem estado de seleção próprio e `setSelection` o preserva
      // de propósito, então Esc o deixava selecionado calado — e o Delete
      // de minutos depois apagaria um pino que o mestre já achava solto.
      // "Deixa pra lá" vale para ele também.
      if (useMapStore.getState().selectedPinId !== null) {
        useMapStore.getState().setSelectedPin(null)
      }
    },
    apagar() {
      // No meio de um arrasto, nada some (nem o pino, a zona ou o risco abertos) e o aviso do que sumiu não sai: a store diz por quê.
      if (barradoPeloGesto()) return
      // As escolhas do terreno: cada gesto confere a dele e devolve `false` sem mexer em nada quando não há o que apagar.
      const { activeTool } = useMapStore.getState()
      if (activeTool === 'barranco' && dep.barranco.apagarEscolhido()) return
      if (activeTool === 'abismo' && dep.abismo.apagarEscolhido()) return
      if (activeTool === 'agua' && dep.agua.apagarEscolhida()) return
      // Daqui em diante nada mudou: o retrato vale para o pino, a zona e o conjunto.
      const escolha = lerEscolhaDoEditor()
      const { map, pisoAtivo, removeConcealZone } = useMapStore.getState()
      // O pino de ponto de interesse vive FORA de `selection` (estado
      // próprio, `selectedPinId`), então Delete nunca o alcançava: dava
      // para colocar e não dava para tirar sem achar "Excluir ponto de
      // interesse" no painel. Os dois estados são exclusivos — selecionar
      // um limpa o outro —, então atender o pino primeiro não esconde
      // nenhuma seleção comum.
      //
      // `selectedPinId` pode estar VELHO: `undo` não mexe em seleção, então
      // colocar um pino e desfazer deixa o id apontando para um pino que
      // não existe mais. Sem conferir o mapa, o atalho engolia o
      // `removeSelected` e ainda prometia "Ctrl+Z desfaz" para uma ação que
      // não aconteceu — e o Ctrl+Z do mestre desfaria outra coisa.
      // PISOS: só o pino do piso em edição — o de outro piso não está na tela.
      const pinoApagado = escolha.pino === null ? undefined : mapaDoPiso(map, pisoAtivo).pins.find((pino) => pino.id === escolha.pino)
      if (pinoApagado !== undefined) {
        // O par de um pino de viagem mora em OUTRA cena: o aviso diz o
        // que mudou lá, porque daqui não dá para ver.
        const travessia = pinoApagado.kind === 'viagem' ? pinTravelOf(useAdventureStore.getState(), map, pinoApagado) : null
        // Camada travada: o pino fica, o aviso diz qual camada segurou e o Delete para aqui.
        if (!apagarPinoPeloGesto(pinoApagado.id)) return
        useToastStore
          .getState()
          .push(
            'info',
            travessia?.status === 'ligado'
              ? `Pino de viagem apagado; o de ${travessia.sceneName} ficou sem destino — Ctrl+Z desfaz`
              : pinoApagado.kind === 'viagem'
                ? 'Pino de viagem apagado — Ctrl+Z desfaz'
                : 'Pino apagado — Ctrl+Z desfaz',
          )
        return
      }
      // Caça 12/11 (E16): a ZONA OCULTA aberta também mora fora de `selection`
      // (`selectedConcealZoneId`): Delete a apaga, como o botão "Excluir zona", e avisa.
      // Conferida no mapa, pelo mesmo motivo do pino acima (o id pode estar velho).
      const zonaAberta = escolha.zona
      if (zonaAberta !== null && map.concealZones.some((zona) => zona.id === zonaAberta)) {
        removeConcealZone(zonaAberta)
        useToastStore.getState().push('info', 'Zona oculta apagada — Ctrl+Z desfaz')
        return
      }
      // O mapa é lido ANTES da remoção: depois dela não há como saber se
      // a região apagada era uma Sala (ver `describeDeletion`).
      const apagados = escolha.conjunto
      // A porta sozinha não some: `removeSelected` a tira e dá o aviso dela (o mesmo do botão "Tirar porta").
      const oQueSumiu = portaSozinhaNaSelecao(map, apagados) !== null ? null : describeDeletion(map, apagados)
      useMapStore.getState().removeSelected()
      if (oQueSumiu !== null) useToastStore.getState().push('info', `${oQueSumiu} — Ctrl+Z desfaz`)
    },
  }
}
