import { Essencial } from '../grimorio/Cartoes'
import { Fichas } from '../grimorio/Ficha'
import { DrawingStyleControls, type DrawingStyleControlsProps } from '../DrawingStyleControls'
import { FillControls, type FillControlsProps } from '../FillControls'
import { CAP_OPTIONS, DASH_OPTIONS, LineCapControls, type LineCapControlsProps } from '../LineCapControls'
import { LineShapeControls, type LineShapeControlsProps } from '../LineShapeControls'
import { ParedesAoRedorControls, type ParedesAoRedorControlsProps } from '../ParedesAoRedorControls'
import { PlayerSecretControls, type PlayerSecretControlsProps } from '../PlayerSecretControls'
import { FichaLembrada, type FichaLembradaProps } from './FichaLembrada'
import './fichaDoItem.css'

/*
 * FICHA DO DESENHO (fatia 16b do design consolidado; decisão 4.1: a gramática
 * da porta, sem perder controle). Vale para a linha, a curva, o pincel, as
 * formas e o caminho selecionados. O essencial diz como o desenho sai — Cor,
 * Espessura, o Formato (Reta ou Curva) na linha e na curva, Preenchido e
 * Opacidade nas formas — e o "Oculto para jogadores", gesto de mesa que fica
 * à vista, como na porta e no pino. As fichas recolhidas: "Traço" (Estilo do
 * traço e Ponta da linha) e "Paredes" (Paredes ao redor e o que vem com
 * elas). Endireitar segue no "Mais ações" da cabeça (fatia 8). Os controles e
 * os handlers são os de antes; com a ferramenta armada, os blocos inteiros.
 */

/** Chave da escolha lembrada de cada ficha: a família `lb-section:<id>` das seções recolhíveis. */
const PREFIXO_LEMBRADO = 'lb-section:ficha-desenho-'

export interface FichaDoDesenhoProps {
  /** Cor e Espessura do desenho selecionado (`target: 'selected'`). */
  estilo: DrawingStyleControlsProps
  /** Preenchido e Opacidade (grupo `fill`): só as formas. */
  preenchimento?: FillControlsProps
  /** Reta ou Curva: só a linha e a curva. */
  formato?: LineShapeControlsProps
  /** Estilo do traço e Ponta da linha (grupo `lineCap`): pincel, linha e curva. */
  traco?: LineCapControlsProps
  /** Paredes ao redor: o caminho não tem. */
  paredes?: ParedesAoRedorControlsProps
  /** Oculto para jogadores (grupo `playerVisibility`). */
  jogadores?: PlayerSecretControlsProps
}

/** Como o traço sai, numa palavra: o estilo na linha e na curva; no pincel, que não tem estilo, a ponta. */
function resumoDoTraco({ cap, dash }: LineCapControlsProps): string | undefined {
  const opcao = dash ? DASH_OPTIONS.find((o) => o.value === dash.dash) : CAP_OPTIONS.find((o) => o.value === cap)
  return opcao?.label
}

function resumoDasParedes({ valor }: ParedesAoRedorControlsProps): string {
  if (valor === undefined || !valor.ativo) return 'Desligadas'
  return valor.invisivel ? 'Invisíveis' : 'Ligadas'
}

/** Ficha do desenho com a escolha lembrada: as duas nascem fechadas, como as da porta. */
function FichaDoDesenhoLembrada(props: Omit<FichaLembradaProps, 'prefixo' | 'padrao'>) {
  return <FichaLembrada prefixo={PREFIXO_LEMBRADO} padrao={false} {...props} />
}

export function FichaDoDesenho({ estilo, preenchimento, formato, traco, paredes, jogadores }: FichaDoDesenhoProps) {
  return (
    <section className="lb-ficha-do-desenho">
      {/* O título do bloco de antes, só para o leitor de tela: a cabeça já diz o tipo. */}
      <h2 className="gr-sr">Estilo do desenho selecionado</h2>
      <Essencial>
        <DrawingStyleControls {...estilo} semTitulo />
        {formato !== undefined && <LineShapeControls {...formato} semTitulo />}
        {preenchimento !== undefined && <FillControls {...preenchimento} semTitulo />}
        {jogadores !== undefined && <PlayerSecretControls {...jogadores} embutido />}
      </Essencial>
      {(traco !== undefined || paredes !== undefined) && (
        <Fichas>
          {traco !== undefined && (
            <FichaDoDesenhoLembrada id="traco" titulo="Traço" icone="rota" resumo={resumoDoTraco(traco)}>
              <LineCapControls {...traco} semTitulo />
            </FichaDoDesenhoLembrada>
          )}
          {paredes !== undefined && (
            <FichaDoDesenhoLembrada id="paredes" titulo="Paredes" icone="parede" resumo={resumoDasParedes(paredes)}>
              <ParedesAoRedorControls {...paredes} semTitulo />
            </FichaDoDesenhoLembrada>
          )}
        </Fichas>
      )}
    </section>
  )
}
