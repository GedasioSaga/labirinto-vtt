import { useId } from 'react'
import type { Prop } from '../../types/map'
import { contextoDeCamadas } from '../../lib/camadas/consulta'
import { nomeDaCamada } from '../../lib/camadas/mover'
import { meioTermoLigado } from '../../lib/estiloDoMapa'
import { saiComTextura } from '../../lib/mobilia/desenhoDoMovel'
import { barraPassagemEscolhida, objetoPodeBarrar, objetoPodeTapar, tapaVisaoEscolhida } from '../../lib/obstaculosDeObjeto'
import { useMapStore } from '../../stores/mapStore'
import { Toggle } from '../Toggle'
import { Essencial } from '../grimorio/Cartoes'
import { Fichas } from '../grimorio/Ficha'
import { ItemNoChaoControls, type ItemNoChaoControlsProps } from '../ItemNoMapaControls'
import { ItemTransformControls, type ItemTransformControlsProps } from '../ItemTransformControls'
import { materiaisDaPeca, nomeDaOpcao } from '../MaterialDaPeca'
import { MobiliaControls, type MobiliaControlsProps } from '../MobiliaControls'
import { PropPlayerControls, type PropPlayerControlsProps } from '../PropPlayerControls'
import { FichaLembrada, type FichaLembradaProps } from './FichaLembrada'
import './fichaDoItem.css'

/*
 * FICHA DO OBJETO (fatia 16a do design consolidado; decisão 4.1: a gramática
 * da porta, sem perder controle). O essencial diz o que a peça É — Tipo, Vista
 * e Forma do móvel, ou o item no chão; a imagem solta não tem essencial — e as
 * fichas Aparência (só o móvel: Preencher, Cor, as cores da cama e Cor da
 * linha), No mapa (Rotação, Travado, Oculto no editor, Oculto para jogadores e,
 * desde 12/11/2026, "Barra a passagem", `lib/obstaculosDeObjeto.ts`;
 * a Camada mora no topo da ficha desde a fatia 8 das camadas, o resumo ainda a
 * diz) e Para os jogadores (rótulo e imagem; o item no chão não tem: a
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
  player: Omit<PropPlayerControlsProps, 'label' | 'showImage'>
}

/** Ficha do objeto com a escolha lembrada: vale para todo objeto e entre sessões. */
function FichaDoObjetoLembrada(props: Omit<FichaLembradaProps, 'prefixo'>) {
  return <FichaLembrada prefixo={PREFIXO_LEMBRADO} {...props} />
}

function resumoDaAparencia(prop: Prop): string {
  // O móvel com textura (a peça nova sempre; os de antes com o Meio-Termo, fora da versão em linhas) tem material,
  // não cor livre nem "Preencher": o nome do material de cada lugar.
  if (prop.mobilia !== undefined && saiComTextura(prop, meioTermoLigado())) return materiaisDaPeca(prop, prop.mobilia).map(({ material }) => nomeDaOpcao(material)).join(', ')
  if (prop.mobiliaPreenchido === false) return 'Sem fundo'
  const corPropria = [prop.mobiliaCor, prop.mobiliaCorDaLinha, prop.mobiliaCorDoTravesseiro, prop.mobiliaCorDoCobertor].some((cor) => cor !== undefined)
  return corPropria ? 'Cor própria' : 'Padrão'
}

/** O que pesa no mapa, numa palavra: oculto e travado antes da camada (a escolhida, que o seletor do topo da ficha troca). */
function resumoNoMapa(prop: Prop, camada: string): string {
  if (prop.secret === true) return 'Oculto'
  if (prop.locked === true) return 'Travado'
  return camada
}

function resumoParaOsJogadores(prop: Prop): string {
  const rotulo = prop.playerLabel?.trim() ?? ''
  if (rotulo !== '') return rotulo
  return prop.playerImage !== undefined ? 'Com imagem' : 'Só a silhueta'
}

export function FichaDoObjeto({ prop, mobilia, itemNoChao, transform, player }: FichaDoObjetoProps) {
  const camada = useMapStore((state) => nomeDaCamada(state.map, contextoDeCamadas(state.map).camadaDe('objeto', prop)))
  // "Barra a passagem" vai direto à cena aberta (a mesma de onde a camada acima é lida), com um Ctrl+Z.
  const setPropBarraPassagem = useMapStore((state) => state.setPropBarraPassagem)
  const explicacaoDaPassagemId = useId()
  // "Tapa a visão" (construções, 12/11/2026): também direto à cena aberta, com um Ctrl+Z.
  const setPropTapaVisao = useMapStore((state) => state.setPropTapaVisao)
  const explicacaoDaVisaoId = useId()
  const ehItem = prop.item !== undefined
  // A mesma escolha de antes: o item no chão com a ligação montada mostra o item; o resto, o móvel (se for móvel).
  const item = ehItem && itemNoChao !== undefined ? prop.item : undefined
  const movel = item === undefined && prop.mobilia !== undefined
  const titulo = ehItem ? 'Imagem no chão' : 'Objeto'
  return (
    <section className="lb-ficha-do-objeto">
      {/* O título do bloco de antes, só para o leitor de tela: a cabeça já diz o tipo. */}
      {/* "Objeto" também no móvel desenhado (caça 12/11, E20: um nome só para a mesma coisa). */}
      <h2 className="gr-sr">{titulo}</h2>
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
        <FichaDoObjetoLembrada id="no-mapa" titulo="No mapa" icone="cadeado" padrao resumo={resumoNoMapa(prop, camada)}>
          <ItemTransformControls
            title={titulo}
            semTitulo
            rotation={prop.rotation ?? 0}
            locked={prop.locked === true}
            hidden={prop.hidden === true}
            secret={prop.secret === true}
            {...transform}
          />
          {/* BARRA A PASSAGEM: o objeto de chão e o item não mostram (a ficha pisa neles). */}
          {objetoPodeBarrar(prop) && (
            <div className="lb-field">
              <Toggle label="Barra a passagem" checked={barraPassagemEscolhida(prop)} onChange={(barra) => setPropBarraPassagem(prop.id, barra)} describedBy={explicacaoDaPassagemId} />
              <p id={explicacaoDaPassagemId} className="lb-field__hint">
                A ficha do jogador não atravessa este objeto. Você, mestre, atravessa sempre.
              </p>
            </div>
          )}
          {/* TAPA A VISÃO: só a construção tem a chave (decisão do mestre de 12/11/2026). */}
          {objetoPodeTapar(prop) && (
            <div className="lb-field">
              <Toggle label="Tapa a visão" checked={tapaVisaoEscolhida(prop)} onChange={(tapa) => setPropTapaVisao(prop.id, tapa)} describedBy={explicacaoDaVisaoId} />
              <p id={explicacaoDaVisaoId} className="lb-field__hint">
                Os jogadores não veem o que está atrás desta construção, como numa parede. Escondida, ela não tapa nada.
              </p>
            </div>
          )}
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
