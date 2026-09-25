/**
 * Zoom com a roda sem refazer o desenho a cada passo.
 *
 * Paredes, portas, escadas, marcador das luzes, móvel desenhado e contornos de
 * seleção têm espessura em px de TELA, então cada mudança de escala refazia a
 * geometria inteira. Medido no editor (GPU, mapa cheio, 16 passos de roda de
 * 10% a 68%): 10,6 s de longtask, pico de 1.404 ms. Durante o giro o `world`
 * já escala sozinho (applyCamera); a linha só fica um pouco mais grossa ou
 * mais fina até a roda parar, e aí a geometria é refeita uma vez.
 *
 * Zoom que não vem da roda (enquadrar, Ctrl+0, trocar de cena, "Ir lá")
 * continua redesenhando no quadro, como antes.
 */

/** Silêncio da roda que conta como "parou". Curto o bastante para a linha
 * voltar à espessura certa antes de a pessoa mirar em algo; longo o bastante
 * para cobrir o intervalo entre entalhes de uma roda girada devagar. */
export const ZOOM_DA_RODA_PARADA_MS = 150

export interface ZoomDaRodaOpcoes {
  /** Refaz as camadas que dependem da escala (chamada quando a roda para). */
  redesenhar: () => void
  /** O caminho de sempre: redesenho agendado para o próximo quadro. */
  redesenharNoQuadro: () => void
}

export interface ZoomDaRoda {
  /** Chamar a cada evento de ZOOM da roda, ANTES de mover a câmera. */
  rodaGirou: () => void
  /** Chamar quando `camera.scale` muda, venha de onde vier. */
  escalaMudou: () => void
  /** Desmonte: nada redesenha depois. */
  cancelar: () => void
}

export function createZoomDaRoda({ redesenhar, redesenharNoQuadro }: ZoomDaRodaOpcoes): ZoomDaRoda {
  let timer: ReturnType<typeof setTimeout> | null = null
  // A escala mudou durante o giro e a geometria ainda não acompanhou.
  let pendente = false

  const pararTimer = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  const rodaParou = () => {
    timer = null
    if (!pendente) return
    pendente = false
    redesenhar()
  }

  return {
    rodaGirou() {
      pararTimer()
      timer = setTimeout(rodaParou, ZOOM_DA_RODA_PARADA_MS)
    },
    escalaMudou() {
      if (timer !== null) {
        pendente = true
        return
      }
      redesenharNoQuadro()
    },
    cancelar() {
      pararTimer()
      pendente = false
    },
  }
}
