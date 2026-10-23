import type { Prop } from '../../types/map'
import { LAYER_LABELS, propLayer } from '../../lib/layers'
import { ehPecaNova } from '../../lib/mobilia/pecasNovas'
import { MATERIAIS } from '../../texturas/meioTermo/materiais'
import { Essencial } from '../grimorio/Cartoes'
import { Fichas } from '../grimorio/Ficha'
import { ItemNoChaoControls, type ItemNoChaoControlsProps } from '../ItemNoMapaControls'
import { ItemTransformControls, type ItemTransformControlsProps } from '../ItemTransformControls'
import { materiaisDaPeca } from '../MaterialDaPeca'
import { MobiliaControls, type MobiliaControlsProps } from '../MobiliaControls'
import { PropLayerControls, type PropLayerControlsProps } from '../PropLayerControls'
import { PropPlayerControls, type PropPlayerControlsProps } from '../PropPlayerControls'
import { FichaLembrada, type FichaLembradaProps } from './FichaLembrada'
import './fichaDoItem.css'

/*
 * FICHA DO OBJETO (fatia 16a do design consolidado; decisão 4.1: a gramática
 * da porta, sem perder controle). O essencial diz o que a peça É — Tipo, Vista
 * e Forma do móvel, ou o item no chão; a imagem solta não tem essencial — e as
 * fichas Aparência (só o móvel: Preencher, Cor, as cores da cama e Cor da
 * linha), No mapa (Rotação, Travado, Oculto no editor, Oculto para jogadores e
 * a Camada) e Para os jogadores (rótulo e imagem; o item no chão não tem: a
 * imagem dele já é o que o jogador vê). "No mapa" nasce aberta: Travado e
 * Oculto são gestos de mesa e ficavam à vista, como na trava do token. Os
 * controles e os handlers são os de antes.
 */

/** Chave da escolha lembrada de cada ficha: a família `lb-section:<id>` das seções recolhíveis. */
const PREFIXO_LEMBRADO = 'lb-section:ficha-objeto-'

export interface FichaDoObjetoProps {
  prop: Prop
  mobilia: Omit<MobiliaControlsProps, 'prop'>
  /** Ligação do item no chão; ausente, o objeto de item cai no corpo do móvel, como antes. */
  itemNoChao?: Omit<ItemNoChaoControlsProps, 'item'>
  transform: Omit<ItemTransformControlsProps, 'title' | 'rotation' | 'locked' | 'hidden' | 'secret'>
  onSetPropLayer: PropLayerControlsProps['onSetPropLayer']
  player: Omit<PropPlayerControlsProps, 'label' | 'showImage'>
}

/** Ficha do objeto com a escolha lembrada: vale para todo objeto e entre sessões. */
function FichaDoObjetoLembrada(props: Omit<FichaLembradaProps, 'prefixo'>) {
  return <FichaLembrada prefixo={PREFIXO_LEMBRADO} {...props} />
}

function resumoDaAparencia(prop: Prop): string {
  // A peça nova tem material, não cor livre nem "Preencher" (sai sempre com textura): o nome do material de cada lugar.
  if (ehPecaNova(prop.mobilia)) return materiaisDaPeca(prop, prop.mobilia).map(({ material }) => MATERIAIS[material].nome).join(', ')
  if (prop.mobiliaPreenchido === false) return 'Sem fundo'
  const corPropria = [prop.mobiliaCor, prop.mobiliaCorDaLinha, prop.mobiliaCorDoTravesseiro, prop.mobiliaCorDoCobertor].some((cor) => cor !== undefined)
  return corPropria ? 'Cor própria' : 'Padrão'
}

/** O que pesa no mapa, numa palavra: oculto e travado antes da camada. */
function resumoNoMapa(prop: Prop): string {
  if (prop.secret === true) return 'Oculto'
  if (prop.locked === true) return 'Travado'
  return LAYER_LABELS[propLayer(prop)]
}

function resumoParaOsJogadores(prop: Prop): string {
  const rotulo = prop.playerLabel?.trim() ?? ''
  if (rotulo !== '') return rotulo
  return prop.playerImage !== undefined ? 'Com imagem' : 'Só a silhueta'
}

export function FichaDoObjeto({ prop, mobilia, itemNoChao, transform, onSetPropLayer, player }: FichaDoObjetoProps) {
  const ehItem = prop.item !== undefined
  // A mesma escolha de antes: o item no chão com a ligação montada mostra o item; o resto, o móvel (se for móvel).
  const item = ehItem && itemNoChao !== undefined ? prop.item : undefined
  const movel = item === undefined && prop.mobilia !== undefined
  const titulo = ehItem ? 'Imagem no chão' : 'Objeto'
  return (
    <section className="lb-ficha-do-objeto">
      {/* O título do bloco de antes, só para o leitor de tela: a cabeça já diz o tipo. */}
      <h2 className="gr-sr">{movel ? 'Móvel' : titulo}</h2>
      {item !== undefined && itemNoChao !== undefined && (
        <Essencial>
          <ItemNoChaoControls item={item} {...itemNoChao} />
        </Essencial>
      )}
      {movel && (
        <Essencial>
          <MobiliaControls prop={prop} {...mobilia} parte="essencial" />
        </Essencial>
      )}
      <Fichas>
        {movel && (
          <FichaDoObjetoLembrada id="aparencia" titulo="Aparência" icone="imagem" padrao={false} resumo={resumoDaAparencia(prop)}>
            <MobiliaControls prop={prop} {...mobilia} parte="aparencia" />
          </FichaDoObjetoLembrada>
        )}
        <FichaDoObjetoLembrada id="no-mapa" titulo="No mapa" icone="cadeado" padrao resumo={resumoNoMapa(prop)}>
          <ItemTransformControls
            title={titulo}
            semTitulo
            rotation={prop.rotation ?? 0}
            locked={prop.locked === true}
            hidden={prop.hidden === true}
            secret={prop.secret === true}
            {...transform}
          />
          <PropLayerControls prop={prop} onSetPropLayer={onSetPropLayer} />
        </FichaDoObjetoLembrada>
        {!ehItem && (
          <FichaDoObjetoLembrada id="jogadores" titulo="Para os jogadores" icone="pessoa" padrao={false} resumo={resumoParaOsJogadores(prop)}>
            <PropPlayerControls label={prop.playerLabel ?? ''} showImage={prop.playerImage !== undefined} {...player} />
          </FichaDoObjetoLembrada>
        )}
      </Fichas>
    </section>
  )
}
