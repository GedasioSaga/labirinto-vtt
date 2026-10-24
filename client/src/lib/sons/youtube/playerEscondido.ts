import type { VideoDoYoutube } from '../biblioteca'
import { criarPlayerPorMensagens, HOST_DO_PLAYER, type EventosDoPlayerYT, type PlayerYT } from './apiDoYoutube'

/**
 * O PLAYER ESCONDIDO do YouTube (Sistema 4, fatia F6; plano, seção 3): só o
 * áudio. Um palco fora da tela, direto no `document.body`, criado no primeiro
 * toque de um vídeo (nunca antes: nada do YouTube carrega enquanto ninguém
 * toca um). Mestre, jogador e TV usam este mesmo palco.
 *
 * Risco de política (registrado no plano uma vez): player escondido contraria
 * a política do player incorporado do YouTube; a escolha é do usuário.
 */

/** O lado do iframe: o mínimo que a política pede para um player, mesmo fora da tela. */
export const LADO_DO_PLAYER_PX = 200
/** Só o que o player precisa para rodar: script e a própria origem (cookies e armazenamento DELE). Sem popup, formulário nem navegação do topo. */
export const SANDBOX_DO_PLAYER = 'allow-scripts allow-same-origin'
/** Tocar sem clique dentro do iframe (a ativação vem do clique no app) e o áudio protegido. Nada de câmera, tela cheia, sensores. */
export const ALLOW_DO_PLAYER = 'autoplay; encrypted-media'

/**
 * O endereço do player, montado SÓ do id conferido (o tipo exige o validador)
 * e da origem desta página: o link colado nunca chega aqui. `origin=` faz o
 * player responder só a esta origem.
 */
export function enderecoDoPlayer(video: VideoDoYoutube, origem: string): string {
  const parametros = new URLSearchParams({
    enablejsapi: '1',
    origin: origem,
    playsinline: '1',
    autoplay: '0',
    controls: '0',
    disablekb: '1',
    fs: '0',
    rel: '0',
    iv_load_policy: '3',
  })
  return `${HOST_DO_PLAYER}/embed/${encodeURIComponent(video)}?${parametros.toString()}`
}

export function criarIframeDoPlayer(documento: Document, video: VideoDoYoutube, origem: string): HTMLIFrameElement {
  const iframe = documento.createElement('iframe')
  iframe.setAttribute('sandbox', SANDBOX_DO_PLAYER)
  // Atributo, não propriedade: o atributo vale em todo navegador (e no jsdom dos testes).
  iframe.setAttribute('allow', ALLOW_DO_PLAYER)
  // Sem Referer o player dá o erro 153; com a origem só (sem caminho), nada além dela sai daqui.
  iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
  iframe.title = 'Som do YouTube'
  iframe.width = String(LADO_DO_PLAYER_PX)
  iframe.height = String(LADO_DO_PLAYER_PX)
  iframe.tabIndex = -1
  iframe.src = enderecoDoPlayer(video, origem)
  return iframe
}

function criarPalco(documento: Document): HTMLElement {
  const palco = documento.createElement('div')
  palco.className = 'lb-sons-youtube'
  // Fora da tela, sem foco e sem leitor de tela: é só o alto-falante.
  palco.setAttribute('aria-hidden', 'true')
  Object.assign(palco.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: `${LADO_DO_PLAYER_PX}px`,
    height: `${LADO_DO_PLAYER_PX}px`,
    overflow: 'hidden',
    opacity: '0',
    pointerEvents: 'none',
  })
  documento.body.appendChild(palco)
  return palco
}

export interface PalcoDoYoutube {
  /** Um player novo já com o vídeo, no palco (que nasce agora, se for o primeiro). */
  abrirPlayer(video: VideoDoYoutube, eventos: EventosDoPlayerYT): PlayerYT
  /** Tira o palco (e os iframes que restarem) da página. */
  fechar(): void
}

export function criarPalcoDoYoutube(janela: Window = window): PalcoDoYoutube {
  let palco: HTMLElement | null = null
  return {
    abrirPlayer(video, eventos) {
      const iframe = criarIframeDoPlayer(janela.document, video, janela.location.origin)
      // Os ouvintes antes do iframe entrar na página: o `load` dele já encontra quem diga `listening`.
      const player = criarPlayerPorMensagens(janela, iframe, eventos)
      palco ??= criarPalco(janela.document)
      palco.appendChild(iframe)
      return player
    },
    fechar() {
      palco?.remove()
      palco = null
    },
  }
}
