/// <reference types="vite/client" />
import type * as Three from 'three'
import type { CenaTransicao, CriarCena, OpcoesDaCena, ThreeModule } from '../../transicoes/tipos'
import { easeInOutSine, easeOutCubic, span } from '../../transicoes/curvas'
import urlDoVideo from './armaduras-despertam/video.webm'

/**
 * Armaduras despertam (pedido de 25/11/2026: "Ok coloca essa animação da
 * batalha"). Sai do preto, a câmera sobe, as 4 armaduras de trás acordam com
 * olhos vermelhos e a principal acorda por último com um pulso forte, diante de
 * um fundo em chamas. A página aprovada é three.js com dois modelos de ~15 MB,
 * carregador de glTF e brilho (bloom), que o pacote não comporta (só módulos
 * `.js` de até 2 MiB, sem `three/*` em tempo de execução). Por isso a cena é um
 * VÍDEO dela: 126 quadros a 30 fps gravados pela própria página (ferramenta em
 * ~/jogos/comeco-da-luta/ferramentas/gravar-quadros.cjs), WebM VP9 1280x720,
 * que o Vite do script do pacote embute em base64 no módulo.
 *
 * A cena só mostra o vídeo num plano que cobre a tela (corte central, sem
 * faixa, em qualquer proporção) e os créditos CC BY 4.0 num canto. O relógio
 * é o do motor: o vídeo toca em tempo real e só é reposicionado quando se
 * afasta do `t` do motor (quem entra atrasado, aba que voltou, repetição).
 * Depois do último quadro a cortina fecha em 0,3 s. Movimento reduzido: o
 * último quadro parado, abrindo e fechando a cortina. O `nome` da batalha é
 * ignorado (o vídeo não tem onde pôr texto, e o app não desenha um).
 */

/** Os créditos exigidos pela CC BY 4.0 (também em armaduras-despertam/CREDITOS.md). */
export const CREDITOS_DA_ABERTURA: readonly string[] = [
  'Modelos 3D sob CC BY 4.0: “The Forgotten Knight”, de dark_igorek ·',
  '“Lowpoly PBR Knight Armour”, de soidev (sketchfab.com). Texturas reduzidas.',
]

const DURACAO_DO_VIDEO_S = 4.2
const QUADROS_POR_SEGUNDO = 30
/** O instante do último quadro (o vídeo termina em 4,2 s, e ele começa em 4,2 - 1/30). */
const ULTIMO_QUADRO_S = DURACAO_DO_VIDEO_S - 1 / QUADROS_POR_SEGUNDO
const PROPORCAO_DO_VIDEO = 1280 / 720
/** Só reposiciona o vídeo quando ele se afasta mais que isto do relógio do motor: seek em VP9 engasga. */
const TOLERANCIA_DE_SINCRONIA_S = 0.2
/** A cortina fecha depois do vídeo; a duração natural no .json é o vídeo mais isto. */
const CORTINA_FECHA_S = 0.3
/** Movimento reduzido: a cortina abre sobre o quadro parado. */
const CORTINA_ABRE_REDUZIDO_S = 0.3
/** Os créditos entram quando o véu preto do vídeo já abriu (0,45 s). */
const CREDITOS_ENTRAM = { inicio: 0.45, fim: 0.85 }
const CREDITOS_OPACIDADE = 0.85

const FOV = 40
const DISTANCIA = 1
/** Altura do bloco de créditos (2 linhas) em fração da altura da tela, e o recuo da borda. */
const CREDITOS_ALTURA = 0.05
const CREDITOS_MARGEM = 0.025
/** O bloco nunca passa desta fração da largura: o botão "Pular" mora no canto direito. */
const CREDITOS_LARGURA_MAX = 0.62
const CREDITOS_FONTE_PX = 30
const CREDITOS_LINHA_PX = 40
const CREDITOS_FOLGA_PX = 8

/** `data:video/webm;base64,...` (o que o build do pacote entrega) vira Blob; outra URL (dev) segue como está. */
function blobDoVideo(url: string): Blob | null {
  const marca = ';base64,'
  const onde = url.startsWith('data:') ? url.indexOf(marca) : -1
  if (onde < 0) return null
  const binario = atob(url.slice(onde + marca.length))
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return new Blob([bytes], { type: 'video/webm' })
}

function desenharCreditos(THREE: ThreeModule): { textura: Three.CanvasTexture; proporcao: number } {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const fonte = `400 ${CREDITOS_FONTE_PX}px system-ui, "Segoe UI", Roboto, sans-serif`
  let largura = 1
  if (ctx) {
    ctx.font = fonte
    largura = Math.max(...CREDITOS_DA_ABERTURA.map((linha) => ctx.measureText(linha).width))
  }
  canvas.width = Math.ceil(largura) + CREDITOS_FOLGA_PX * 2
  canvas.height = CREDITOS_LINHA_PX * CREDITOS_DA_ABERTURA.length + CREDITOS_FOLGA_PX * 2
  if (ctx) {
    // Trocar o tamanho do canvas apaga o estado do contexto: a fonte vem de novo.
    ctx.font = fonte
    ctx.textBaseline = 'top'
    ctx.fillStyle = '#c9c0b4'
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)'
    ctx.shadowBlur = 6
    CREDITOS_DA_ABERTURA.forEach((linha, i) => ctx.fillText(linha, CREDITOS_FOLGA_PX, CREDITOS_FOLGA_PX + i * CREDITOS_LINHA_PX + 4))
  }
  const textura = new THREE.CanvasTexture(canvas)
  textura.colorSpace = THREE.SRGBColorSpace
  return { textura, proporcao: canvas.width / canvas.height }
}

/** Cortina: 0 = cena à vista, 1 = preto. Fecha depois do vídeo; no reduzido também abre. */
function cortina(t: number, reduzir: boolean): number {
  const fecha = easeInOutSine(span(t, DURACAO_DO_VIDEO_S, DURACAO_DO_VIDEO_S + CORTINA_FECHA_S))
  if (!reduzir) return fecha
  return Math.max(1 - easeOutCubic(span(t, 0, CORTINA_ABRE_REDUZIDO_S)), fecha)
}

function criar(THREE: ThreeModule, opcoes: OpcoesDaCena): CenaTransicao {
  const reduzir = opcoes.reduzirMovimento

  const blob = blobDoVideo(urlDoVideo)
  const urlLocal = blob ? URL.createObjectURL(blob) : null
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.src = urlLocal ?? urlDoVideo

  const pronta = new Promise<void>((resolver, rejeitar) => {
    const comDados = (): void => {
      if (!reduzir) return resolver()
      video.addEventListener('seeked', () => resolver(), { once: true })
      video.currentTime = ULTIMO_QUADRO_S
    }
    video.addEventListener('error', () => rejeitar(new Error('o vídeo da abertura não decodificou')), { once: true })
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) comDados()
    else video.addEventListener('loadeddata', comDados, { once: true })
  })
  // Quem não espera a `pronta` (pré-compilação) não deixa rejeição solta; o motor ainda recebe a original.
  void pronta.catch(() => undefined)
  video.load()

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000000)
  const camera = new THREE.PerspectiveCamera(FOV, PROPORCAO_DO_VIDEO, 0.1, 10)
  const meiaAltura = DISTANCIA * Math.tan(THREE.MathUtils.degToRad(FOV / 2))

  const texturaDoVideo = new THREE.VideoTexture(video)
  texturaDoVideo.colorSpace = THREE.SRGBColorSpace
  const plano = new THREE.PlaneGeometry(1, 1)
  const materialDoVideo = new THREE.MeshBasicMaterial({ map: texturaDoVideo, toneMapped: false, depthTest: false, depthWrite: false })
  const tela = new THREE.Mesh(plano, materialDoVideo)
  tela.position.z = -DISTANCIA
  scene.add(tela)

  const creditos = desenharCreditos(THREE)
  const materialDosCreditos = new THREE.MeshBasicMaterial({
    map: creditos.textura,
    transparent: true,
    opacity: 0,
    toneMapped: false,
    depthTest: false,
    depthWrite: false,
  })
  const placaDosCreditos = new THREE.Mesh(plano, materialDosCreditos)
  placaDosCreditos.renderOrder = 1
  placaDosCreditos.position.z = -DISTANCIA
  scene.add(placaDosCreditos)

  function sincronizar(t: number): void {
    if (reduzir || video.readyState < HTMLMediaElement.HAVE_METADATA) return
    if (t <= 0) {
      // O quadro escondido do motor (antes do relógio) não pode largar o vídeo adiantado.
      if (!video.paused) video.pause()
      if (video.currentTime !== 0 && !video.seeking) video.currentTime = 0
      return
    }
    const alvo = Math.min(t, ULTIMO_QUADRO_S)
    if (Math.abs(video.currentTime - alvo) > TOLERANCIA_DE_SINCRONIA_S && !video.seeking) video.currentTime = alvo
    if (t >= ULTIMO_QUADRO_S) {
      if (!video.paused) video.pause()
      return
    }
    if (video.paused) void video.play().catch(() => undefined)
  }

  /**
   * A VideoTexture sobe o quadro pelo `requestVideoFrameCallback`, que pode não
   * disparar para vídeo fora do DOM (caso deste); então o quadro novo sobe aqui
   * também, só quando o tempo do vídeo mudou e ele não está no meio de um seek.
   */
  let tempoEnviado = -1
  function subirQuadro(): void {
    if (video.seeking || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.currentTime === tempoEnviado) return
    tempoEnviado = video.currentTime
    texturaDoVideo.needsUpdate = true
  }

  function atualizar(t: number) {
    sincronizar(t)
    subirQuadro()
    materialDosCreditos.opacity = CREDITOS_OPACIDADE * easeOutCubic(span(t, CREDITOS_ENTRAM.inicio, CREDITOS_ENTRAM.fim))
    return { fade: cortina(t, reduzir) }
  }

  function ajustarTela(aspecto: number) {
    const proporcao = Math.max(0.2, aspecto)
    camera.aspect = proporcao
    camera.updateProjectionMatrix()
    const altura = meiaAltura * 2
    const largura = altura * proporcao
    // Cobre a tela: o lado que sobra é cortado igual dos dois lados.
    if (proporcao > PROPORCAO_DO_VIDEO) tela.scale.set(largura, largura / PROPORCAO_DO_VIDEO, 1)
    else tela.scale.set(altura * PROPORCAO_DO_VIDEO, altura, 1)

    const margem = altura * CREDITOS_MARGEM
    const larguraDosCreditos = Math.min(altura * CREDITOS_ALTURA * creditos.proporcao, largura * CREDITOS_LARGURA_MAX)
    const alturaDosCreditos = larguraDosCreditos / creditos.proporcao
    placaDosCreditos.scale.set(larguraDosCreditos, alturaDosCreditos, 1)
    placaDosCreditos.position.x = -largura / 2 + margem + larguraDosCreditos / 2
    placaDosCreditos.position.y = -altura / 2 + margem + alturaDosCreditos / 2
  }

  function descartar() {
    video.pause()
    video.removeAttribute('src')
    video.load()
    if (urlLocal) URL.revokeObjectURL(urlLocal)
    texturaDoVideo.dispose()
    creditos.textura.dispose()
    plano.dispose()
    materialDoVideo.dispose()
    materialDosCreditos.dispose()
  }

  ajustarTela(PROPORCAO_DO_VIDEO)
  atualizar(0)

  return { scene, camera, atualizar, ajustarTela, pronta, descartar }
}

const criarCena: CriarCena = criar
export default criarCena
