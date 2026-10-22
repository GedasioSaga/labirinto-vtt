import { useRef, useState } from 'react'
import { SettingsIcon } from './icons'
import { GridControls, type GridControlsProps } from './GridControls'
import { GridAlignControls, type GridAlignControlsProps } from './GridAlignControls'
import { MapScaleControls, type MapScaleControlsProps } from './MapScaleControls'
import { ScenarioLinkControls, type ScenarioLinkControlsProps } from './ScenarioLinkControls'
import { MovementControls, type MovementControlsProps } from './MovementControls'
import { MapSizeControls, type MapSizeControlsProps } from './MapSizeControls'
import { ArrivalTextControls, type ArrivalTextControlsProps } from './ArrivalTextControls'
import { SceneFloorControls, type SceneFloorControlsProps } from './SceneFloorControls'
import { FaceRangeControls, type FaceRangeControlsProps } from './FaceRangeControls'
import { Balao } from './grimorio/Balao'
import { Botao } from './grimorio/Botao'
import { Dialogo } from './grimorio/Dialogo'
import { NavegacaoVertical, type SecaoDaNavegacao } from './grimorio/NavegacaoVertical'
import { IconeDoLivro } from './livro/icones'
import { SistemaDeRpgDoMapa } from './SistemaDeRpgControls'
import { FEATURES } from '../lib/features'

export interface MapSettingsProps {
  grid: GridControlsProps
  gridAlign: GridAlignControlsProps
  mapScale: MapScaleControlsProps
  /** "Rostos só de perto" da cena. Ausente, a seção não aparece (quem monta a janela sem mapa de sessão). */
  faceRange?: FaceRangeControlsProps
  scenarioLink: ScenarioLinkControlsProps
  /** Passo máximo e ocupação da cena; ausente, a seção não aparece. */
  movement?: MovementControlsProps
  mapSize: MapSizeControlsProps
  /** Texto de chegada da cena; ausente, a seção não aparece. */
  arrivalText?: ArrivalTextControlsProps
  /** MAPA POR ANDARES: prédio e rótulo do andar da cena; ausente, a seção não aparece. */
  sceneFloor?: SceneFloorControlsProps
}

export interface MapSettingsDialogProps extends MapSettingsProps {
  onClose: () => void
}

interface ScenarioLinkVisibility {
  /** Default `FEATURES.scenarioLink`. Escondido, o dado continua passando e sendo gravado. */
  showScenarioLink?: boolean
  /** Default `FEATURES.andarDoPredio`. Escondido, prédio e andar guardados continuam valendo. */
  showSceneFloor?: boolean
}

/**
 * Janela "Configurações do mapa": o que é do mapa inteiro e se mexe pouco
 * (formato e estilo da grade, alinhamento à imagem, medição, tamanho, link de cenário)
 * sai do painel lateral e mora aqui.
 *
 * Casca do Grimório (fatia 20): o `Dialogo` (portal no `body`, foco preso,
 * Esc e fundo fecham, o foco volta a quem abriu) com a navegação vertical à
 * esquerda. As seções e os controles de dentro são os de antes, na mesma ordem.
 */
export function MapSettingsDialog({
  onClose,
  grid,
  gridAlign,
  mapScale,
  faceRange,
  scenarioLink,
  movement,
  mapSize,
  arrivalText,
  sceneFloor,
  showScenarioLink = FEATURES.scenarioLink,
  showSceneFloor = FEATURES.andarDoPredio,
}: MapSettingsDialogProps & ScenarioLinkVisibility) {
  const hasBackgroundImage = gridAlign.imageWidth !== null && gridAlign.imageHeight !== null
  const secoes: SecaoDaNavegacao[] = [
    { id: 'grade', rotulo: 'Grade', conteudo: <GridControls {...grid} /> },
    {
      id: 'alinhar',
      rotulo: 'Alinhar à imagem',
      conteudo: hasBackgroundImage ? (
        <GridAlignControls {...gridAlign} />
      ) : (
        <section className="lb-section">
          <h2 className="lb-eyebrow">Alinhar grade à imagem</h2>
          <p className="lb-field__hint">Importe uma imagem de fundo pela barra de baixo para ajustar a grade às casas desenhadas nela.</p>
        </section>
      ),
    },
    {
      id: 'medicao',
      rotulo: 'Medição',
      conteudo: (
        <>
          <MapScaleControls {...mapScale} />
          {/* Logo depois da Medição: o passo máximo conta com a mesma régua. */}
          {movement && <MovementControls {...movement} />}
        </>
      ),
    },
    { id: 'tamanho', rotulo: 'Tamanho do mapa', conteudo: <MapSizeControls {...mapSize} /> },
  ]
  if (arrivalText) secoes.push({ id: 'chegada', rotulo: 'Texto de chegada', conteudo: <ArrivalTextControls {...arrivalText} /> })
  if (showSceneFloor && sceneFloor) secoes.push({ id: 'andar', rotulo: 'Andar do prédio', conteudo: <SceneFloorControls {...sceneFloor} /> })
  if (faceRange !== undefined) secoes.push({ id: 'rostos', rotulo: 'Rostos', conteudo: <FaceRangeControls {...faceRange} /> })
  if (showScenarioLink) secoes.push({ id: 'cenario', rotulo: 'Link de cenário', conteudo: <ScenarioLinkControls {...scenarioLink} /> })
  // Vale para a mesa inteira, mapa solto incluído: a grade de sistemas abre por cima desta janela.
  secoes.push({ id: 'sistema', rotulo: 'Sistema de RPG', conteudo: <SistemaDeRpgDoMapa /> })

  return (
    <Dialogo aberto titulo="Configurações do mapa" onFechar={onClose}>
      <NavegacaoVertical rotulo="Seções das configurações do mapa" secoes={secoes} />
    </Dialogo>
  )
}

/** Engrenagem do cabeçalho do painel: abre a janela e devolve o foco a ela ao fechar. */
export function MapSettingsButton({
  showScenarioLink,
  aparencia = 'painel',
  ...props
}: MapSettingsProps &
  ScenarioLinkVisibility & {
    /** `livro`: a engrenagem do topo do livro do mestre (Grimório), com balão. */
    aparencia?: 'painel' | 'livro'
  }) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  function close() {
    setOpen(false)
    buttonRef.current?.focus()
  }

  const janela = open && <MapSettingsDialog {...props} showScenarioLink={showScenarioLink} onClose={close} />
  if (aparencia === 'livro') {
    return (
      <>
        <Balao texto="Configurações do mapa">
          {(gatilho) => (
            <Botao
              soIcone
              tamanho="p"
              aria-label="Configurações do mapa"
              aria-haspopup="dialog"
              aria-expanded={open}
              {...gatilho}
              ref={(no) => {
                gatilho.ref(no)
                buttonRef.current = no
              }}
              onClick={() => setOpen(true)}
            >
              <IconeDoLivro nome="engrenagem" />
            </Botao>
          )}
        </Balao>
        {janela}
      </>
    )
  }
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        // O balão repete o nome acessível, como nos ícones da barra: uma
        // engrenagem sozinha não diz o que abre. Para baixo, porque o
        // cabeçalho fica no topo do painel, e alinhado pela direita do botão
        // (main.css, `.lb-inspector__settings.lb-tip`): centrado, ele saía do
        // painel e a barra de ferramentas cortava o texto.
        className="lb-iconbtn lb-tip lb-inspector__settings"
        aria-label="Configurações do mapa"
        data-tip="Configurações do mapa"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <SettingsIcon size={18} />
      </button>
      {janela}
    </>
  )
}
