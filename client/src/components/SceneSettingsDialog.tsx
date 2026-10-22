import { Dialogo } from './grimorio/Dialogo'
import { NavegacaoVertical, type SecaoDaNavegacao } from './grimorio/NavegacaoVertical'
import { SceneVisionControls, type SceneVisionControlsProps } from './SceneVisionControls'
import { SceneMapaVivoControls, SceneMapTypeControls, temMapaVivo, type SceneMapTypeControlsProps } from './SceneMapTypeControls'

/** Raio em px que o jogador usa quando a cena não diz nada (`DEFAULT_VISION_RADIUS`, `net/hostBridge.ts`). */
export const RAIO_PADRAO_PX = 700

/** Lado da prévia, em px de tela. */
const PREVIA_LADO = 168
/** Folga, em quadrados, entre a borda do raio e a borda da prévia. */
const PREVIA_FOLGA = 1.5
/** Abaixo disso a grade vira borrão: some e fica só o círculo. */
const QUADRO_MIN_PX = 6

export interface SceneSettingsDialogProps {
  sceneName: string
  /** Tamanho do quadro da cena em px: converte o raio padrão em quadrados. */
  cellPx: number
  vision: Required<Pick<SceneVisionControlsProps, 'dark' | 'onDarkChange'>> & SceneVisionControlsProps
  /** "Tipo de mapa" (Normal | Continente) e a caravana dentro do Continente. Ausente omite a seção. */
  mapType?: SceneMapTypeControlsProps
  /** A seção que abre à vista (`SECAO_MAPA_VIVO`); ausente ou sem conteúdo, a primeira. */
  secaoInicial?: string
  onClose: () => void
}

/** Quadrados que o jogador enxerga: o valor da cena, senão o raio padrão convertido. */
export function raioEmQuadrados(visionCells: number | undefined, cellPx: number): { cells: number; padrao: boolean } {
  if (visionCells !== undefined) return { cells: visionCells, padrao: false }
  const lado = Number.isFinite(cellPx) && cellPx > 0 ? cellPx : 64
  return { cells: Math.round((RAIO_PADRAO_PX / lado) * 10) / 10, padrao: true }
}

function formatarQuadrados(cells: number): string {
  const texto = String(cells).replace('.', ',')
  return cells === 1 ? '1 quadrado' : `${texto} quadrados`
}

/**
 * Radar da visão: a ficha no meio, a grade em volta e o círculo até onde o
 * jogador enxerga. Em cena escura só a casa da ficha fica clara; o círculo vira
 * tracejado, porque lá fora ele só vê o que uma Luz ilumina.
 */
export function VisionPreview({ cells, dark }: { cells: number; dark: boolean }) {
  const meio = PREVIA_LADO / 2
  const quadro = meio / (cells + PREVIA_FOLGA)
  const raio = cells * quadro
  const linhas: number[] = []
  if (quadro >= QUADRO_MIN_PX) {
    // Linhas a partir do centro: a ficha fica no meio de uma casa.
    for (let d = quadro / 2; d < meio; d += quadro) linhas.push(meio + d, meio - d)
  }
  return (
    <svg className="lb-cena-config__previa" width={PREVIA_LADO} height={PREVIA_LADO} viewBox={`0 0 ${PREVIA_LADO} ${PREVIA_LADO}`} role="img" aria-label={`Prévia: o jogador vê ${formatarQuadrados(cells)} em volta${dark ? ', cena escura' : ''}`}>
      <rect width={PREVIA_LADO} height={PREVIA_LADO} className="lb-cena-config__escuro" />
      {!dark && <circle cx={meio} cy={meio} r={raio} className="lb-cena-config__visto" />}
      {dark && <rect x={meio - quadro * 1.5} y={meio - quadro * 1.5} width={quadro * 3} height={quadro * 3} className="lb-cena-config__visto" />}
      {linhas.map((p) => (
        <g key={p} className="lb-cena-config__grade">
          <line x1={p} y1={0} x2={p} y2={PREVIA_LADO} />
          <line x1={0} y1={p} x2={PREVIA_LADO} y2={p} />
        </g>
      ))}
      <circle cx={meio} cy={meio} r={raio} className={`lb-cena-config__borda${dark ? ' lb-cena-config__borda--escura' : ''}`} />
      <circle cx={meio} cy={meio} r={Math.max(3, quadro * 0.35)} className="lb-cena-config__ficha" />
    </svg>
  )
}

/** A seção "Mapa vivo": o atalho da página Cena abre a janela já nela. */
export const SECAO_MAPA_VIVO = 'mapa-vivo'

/**
 * "Configurar cena" (pedido de 07/10/2026): a visão dos jogadores, por cena,
 * com o radar ao lado, o "Tipo de mapa" (09/10/2026) e o "Mapa vivo" (fatia
 * 20: Relevo, Nomes dos lugares, Nuvens). Abre pelo botão de engrenagem na
 * linha da cena, e pelo "Mapa vivo" da página Cena.
 *
 * Casca do Grimório: `Dialogo` com a navegação vertical; os controles são os
 * de antes. O foco entra no campo da visão, o que se mexe mais.
 */
export function SceneSettingsDialog({ sceneName, cellPx, vision, mapType, secaoInicial, onClose }: SceneSettingsDialogProps) {
  const { cells, padrao } = raioEmQuadrados(vision.visionCells, cellPx)
  const secoes: SecaoDaNavegacao[] = [
    {
      id: 'visao',
      rotulo: 'Visão',
      conteudo: (
        <div className="lb-cena-config__corpo">
          <SceneVisionControls {...vision} />
          <figure className="lb-cena-config__radar">
            <VisionPreview cells={cells} dark={vision.dark} />
            <figcaption className="lb-field__hint">
              {padrao ? `Sem valor: raio padrão, cerca de ${formatarQuadrados(cells)}.` : `${formatarQuadrados(cells)} em volta da ficha.`}
              {vision.dark ? ' Cena escura: fora da casa da ficha, só o que uma Luz ilumina.' : ''} Vezes o fator de cada jogador.
            </figcaption>
          </figure>
        </div>
      ),
    },
  ]
  if (mapType !== undefined) {
    secoes.push({ id: 'tipo', rotulo: 'Tipo de mapa', conteudo: <SceneMapTypeControls {...mapType} /> })
    // Sem chave nenhuma, a seção não aparece vazia.
    if (temMapaVivo(mapType)) secoes.push({ id: SECAO_MAPA_VIVO, rotulo: 'Mapa vivo', conteudo: <SceneMapaVivoControls {...mapType} /> })
  }
  const inicial = secoes.some((secao) => secao.id === secaoInicial) ? secaoInicial : undefined

  return (
    <Dialogo aberto titulo={`Configurar ${sceneName}`} onFechar={onClose} classe="lb-cena-config">
      <NavegacaoVertical rotulo="Seções da configuração da cena" secoes={secoes} secaoInicial={inicial} />
    </Dialogo>
  )
}
