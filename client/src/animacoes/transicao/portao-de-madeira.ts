/// <reference types="vite/client" />
import type { CenaTransicao, CriarCena, KitDeSom, OpcoesDaCena, ThreeModule } from '../../transicoes/tipos'
import { easeInOutSine, easeOutCubic, span } from '../../transicoes/curvas'
import meta from './portao-de-madeira.json'
import urlDoVideo from './portao-de-madeira/video.webm'
import urlDoSom from './portao-de-madeira/som.webm'

/**
 * Portão de madeira pesado (aprovado em 27/11/2026: "Gostei da animação, pode
 * colocar"). Atravessar um portão grande de madeira em primeira pessoa, no
 * fundo preto: a tranca sobe e cai, as folhas arrancam aos trancos, abrem
 * devagar, batem nos batentes e a câmera passa para o escuro. Não é o "Portão
 * pesado" (`portao-pesado.ts`, three.js com ar de PlayStation): as duas ficam.
 *
 * A cena foi renderizada no Blender (`docs/design/portao-madeira/`), então
 * aqui ela é um VÍDEO, no mesmo formato da `batalha/armaduras-despertam`: WebM
 * VP9 1280x720 a 30 fps, mudo, que o Vite do script do pacote embute em base64
 * no módulo. O som aprovado vem à parte (`som.webm`, a faixa Opus do vídeo com
 * som, copiada sem recodificar) e toca no `criarSom`, pelo volume e pelo mudo
 * do motor, preso ao mesmo relógio da imagem.
 *
 * O relógio é o do motor. Quando o mestre escolhe outra duração (2 a 30 s
 * contra os 7 naturais), o tempo da cena anda mais rápido ou mais devagar: a
 * cena mede esse ritmo e toca o vídeo e o som nele (o som muda de tom junto,
 * o Web Audio não segura o tom). O vídeo só é reposicionado quando se afasta
 * do `t` do motor (quem entra atrasado, aba que voltou, repetição).
 *
 * O vídeo já sai do preto e termina no preto; a cortina do motor só garante o
 * preto no último décimo de segundo. Movimento reduzido: um quadro parado do
 * portão aberto, com a cortina abrindo e fechando, e o som inteiro. A
 * miniatura da galeria é um quadro tirado do próprio vídeo na `pronta` (o
 * motor desenha a miniatura logo depois do `atualizar`, sem esperar o seek). O
 * `nome` do destino é ignorado: o vídeo não tem onde pôr texto.
 */

const DURACAO_DO_VIDEO_S = 7
const QUADROS_POR_SEGUNDO = 30
/** O instante do último quadro (o vídeo termina em 7 s, e ele começa em 7 - 1/30). */
const ULTIMO_QUADRO_S = DURACAO_DO_VIDEO_S - 1 / QUADROS_POR_SEGUNDO
const LARGURA_DO_VIDEO = 1280
const ALTURA_DO_VIDEO = 720
const PROPORCAO_DO_VIDEO = LARGURA_DO_VIDEO / ALTURA_DO_VIDEO
/** Só reposiciona o vídeo quando ele se afasta mais que isto do relógio do motor: seek em VP9 engasga. */
const TOLERANCIA_DE_SINCRONIA_S = 0.2
/** O quadro da galeria (o `quadroDaMiniaturaS` do .json): o portão ainda fechado, já claro. */
const QUADRO_DA_MINIATURA_S = meta.quadroDaMiniaturaS
/** Movimento reduzido: o portão já aberto, o corredor à frente. */
const QUADRO_DO_REDUZIDO_S = 5.3
/** Movimento reduzido: a cortina abre sobre o quadro parado e fecha junto com o escuro do vídeo (6,4 a 7 s). */
const CORTINA_ABRE_REDUZIDO_S = 0.3
const CORTINA_FECHA_REDUZIDO = { inicio: 6.4, fim: DURACAO_DO_VIDEO_S }
/** O vídeo já termina preto; a cortina só cobre o caso de ele ficar para trás num seek. */
const CORTINA_FINAL_S = 0.1

/** O ritmo vale o que o motor escala: 7/30 a 7/2. Fora disso é medida errada, e fica preso na borda. */
const RITMO_MIN = 0.2
const RITMO_MAX = 4
/** Janela mínima da medida: com menos, a folga entre o quadro e a chamada (alguns ms) pesa demais. */
const RITMO_JANELA_MIN_S = 0.3
/** Medida a até 2% de 1 é a duração natural; o resto anda em passos de 0,01 para não mexer no vídeo a cada quadro. */
const RITMO_IGUAL = 0.02
const RITMO_PASSO = 0.01

/** O som só recomeça quando se afasta mais que isto da imagem (≈ 2 quadros e meio). */
const TOLERANCIA_DO_SOM_S = 0.08
/** Rampa curta de entrada e saída de cada trecho de som: corte seco estala. */
const RAMPA_DO_SOM_S = 0.01

const FOV = 40
const DISTANCIA = 1

/** `data:...;base64,...` (o que o build do pacote entrega) vira bytes; outra URL (dev) devolve `null`. */
function bytesDoDataUrl(url: string): Uint8Array<ArrayBuffer> | null {
  const marca = ';base64,'
  const onde = url.startsWith('data:') ? url.indexOf(marca) : -1
  if (onde < 0) return null
  const binario = atob(url.slice(onde + marca.length))
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return bytes
}

/** Os bytes do som: embutidos no pacote ou, no dev, baixados do servidor do Vite. */
async function bytesDoSom(): Promise<ArrayBuffer> {
  const embutidos = bytesDoDataUrl(urlDoSom)
  if (embutidos) return embutidos.buffer
  const resposta = await fetch(urlDoSom)
  if (!resposta.ok) throw new Error(`o som do portão não baixou (${resposta.status})`)
  return resposta.arrayBuffer()
}

/** Resolve no próximo `evento` do vídeo; rejeita se ele der erro antes. */
function esperarVideo(video: HTMLVideoElement, evento: 'loadeddata' | 'seeked'): Promise<void> {
  return new Promise((resolver, rejeitar) => {
    const chegou = (): void => {
      video.removeEventListener('error', falhou)
      resolver()
    }
    const falhou = (): void => {
      video.removeEventListener(evento, chegou)
      rejeitar(new Error('o vídeo do portão não decodificou'))
    }
    video.addEventListener(evento, chegou, { once: true })
    video.addEventListener('error', falhou, { once: true })
  })
}

/** Leva o vídeo a `s` e espera o quadro de lá estar pronto para desenhar. */
async function irPara(video: HTMLVideoElement, s: number): Promise<void> {
  const jaEsta = !video.seeking && video.currentTime === s && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
  if (jaEsta) return
  const chegou = esperarVideo(video, 'seeked')
  video.currentTime = s
  await chegou
}

/** Cortina do movimento reduzido: 0 = cena à vista, 1 = preto. */
function cortinaReduzida(t: number): number {
  const abre = 1 - easeOutCubic(span(t, 0, CORTINA_ABRE_REDUZIDO_S))
  const fecha = easeInOutSine(span(t, CORTINA_FECHA_REDUZIDO.inicio, CORTINA_FECHA_REDUZIDO.fim))
  return Math.max(abre, fecha)
}

function criar(THREE: ThreeModule, opcoes: OpcoesDaCena): CenaTransicao {
  const reduzir = opcoes.reduzirMovimento

  const bytesDoVideo = bytesDoDataUrl(urlDoVideo)
  let urlLocal = bytesDoVideo ? URL.createObjectURL(new Blob([bytesDoVideo], { type: 'video/webm' })) : null
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.src = urlLocal ?? urlDoVideo
  video.load()

  /** Solta o vídeo e o decodificador. Pode ser chamada mais de uma vez. */
  function soltarVideo(): void {
    video.pause()
    video.removeAttribute('src')
    video.load()
    if (urlLocal) URL.revokeObjectURL(urlLocal)
    urlLocal = null
  }

  // O quadro parado: a miniatura (portão fechado) ou, no movimento reduzido, o portão aberto.
  const quadroParado = document.createElement('canvas')
  quadroParado.width = LARGURA_DO_VIDEO
  quadroParado.height = ALTURA_DO_VIDEO
  const texturaParada = new THREE.CanvasTexture(quadroParado)
  texturaParada.colorSpace = THREE.SRGBColorSpace

  function pintarQuadroParado(): void {
    const ctx = quadroParado.getContext('2d')
    if (!ctx) throw new Error('sem canvas 2D para o quadro parado do portão')
    ctx.drawImage(video, 0, 0, quadroParado.width, quadroParado.height)
    texturaParada.needsUpdate = true
  }

  const pronta = (async () => {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) await esperarVideo(video, 'loadeddata')
    await irPara(video, reduzir ? QUADRO_DO_REDUZIDO_S : QUADRO_DA_MINIATURA_S)
    pintarQuadroParado()
    // O reduzido não toca o vídeo: fica só com o quadro. O normal volta ao começo para largar dali.
    if (reduzir) soltarVideo()
    else await irPara(video, 0)
  })()
  // Quem não espera a `pronta` (pré-compilação) não deixa rejeição solta; o motor ainda recebe a original.
  void pronta.catch(() => undefined)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000000)
  const camera = new THREE.PerspectiveCamera(FOV, PROPORCAO_DO_VIDEO, 0.1, 10)
  const meiaAltura = DISTANCIA * Math.tan(THREE.MathUtils.degToRad(FOV / 2))

  const plano = new THREE.PlaneGeometry(1, 1)
  const texturaDoVideo = new THREE.VideoTexture(video)
  texturaDoVideo.colorSpace = THREE.SRGBColorSpace
  const materialDoVideo = new THREE.MeshBasicMaterial({ map: texturaDoVideo, toneMapped: false, depthTest: false, depthWrite: false })
  const telaDoVideo = new THREE.Mesh(plano, materialDoVideo)
  telaDoVideo.position.z = -DISTANCIA
  telaDoVideo.visible = !reduzir
  scene.add(telaDoVideo)

  const materialParado = new THREE.MeshBasicMaterial({ map: texturaParada, toneMapped: false, depthTest: false, depthWrite: false })
  const telaParada = new THREE.Mesh(plano, materialParado)
  telaParada.position.z = -DISTANCIA
  telaParada.renderOrder = 1
  telaParada.visible = reduzir
  scene.add(telaParada)

  /**
   * O ritmo do tempo da cena contra o relógio da parede: 1 na duração
   * natural. Medido de uma origem que só volta quando o tempo recomeça (0,
   * repetição); `ritmoMedido` diz se a janela mínima já passou.
   */
  let ritmo = 1
  let ritmoMedido = false
  let origemDoRitmo: { t: number; ms: number } | null = null
  function medirRitmo(t: number): void {
    const agora = performance.now()
    if (t <= 0 || origemDoRitmo === null || t < origemDoRitmo.t) {
      origemDoRitmo = t > 0 ? { t, ms: agora } : null
      return
    }
    const decorridoS = (agora - origemDoRitmo.ms) / 1000
    if (decorridoS < RITMO_JANELA_MIN_S) return
    const medido = (t - origemDoRitmo.t) / decorridoS
    const preso = Math.min(RITMO_MAX, Math.max(RITMO_MIN, medido))
    ritmo = Math.abs(preso - 1) <= RITMO_IGUAL ? 1 : Math.round(preso / RITMO_PASSO) * RITMO_PASSO
    ritmoMedido = true
  }

  function sincronizar(t: number): void {
    if (video.readyState < HTMLMediaElement.HAVE_METADATA) return
    if (t <= 0) {
      // O quadro escondido do motor (antes do relógio) não pode largar o vídeo adiantado.
      if (!video.paused) video.pause()
      if (video.currentTime !== 0 && !video.seeking) video.currentTime = 0
      return
    }
    // O ritmo acabou de ser medido (raro: 1 ou 2 vezes por cena, só com outra duração): acerta o quadro de vez.
    const mudouRitmo = video.playbackRate !== ritmo
    if (mudouRitmo) video.playbackRate = ritmo
    const folga = mudouRitmo ? 1 / QUADROS_POR_SEGUNDO : TOLERANCIA_DE_SINCRONIA_S
    const alvo = Math.min(t, ULTIMO_QUADRO_S)
    if (Math.abs(video.currentTime - alvo) > folga && !video.seeking) video.currentTime = alvo
    if (t >= ULTIMO_QUADRO_S) {
      if (!video.paused) video.pause()
      return
    }
    if (video.paused) void video.play().catch(() => undefined)
  }

  /** O vídeo mostra mesmo o quadro de `t` (não está no meio de um seek nem longe dele). */
  function videoEmDia(t: number): boolean {
    if (video.seeking || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return false
    return Math.abs(video.currentTime - Math.min(t, ULTIMO_QUADRO_S)) <= TOLERANCIA_DE_SINCRONIA_S
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
    medirRitmo(t)
    if (reduzir) return { fade: cortinaReduzida(t) }
    sincronizar(t)
    subirQuadro()
    // A miniatura pede o quadro dela e desenha na hora, antes do seek acabar: mostra o quadro tirado na `pronta`.
    telaParada.visible = !videoEmDia(t) && Math.abs(t - QUADRO_DA_MINIATURA_S) <= TOLERANCIA_DE_SINCRONIA_S
    return { fade: span(t, DURACAO_DO_VIDEO_S - CORTINA_FINAL_S, DURACAO_DO_VIDEO_S) }
  }

  function ajustarTela(aspecto: number) {
    const proporcao = Math.max(0.2, aspecto)
    camera.aspect = proporcao
    camera.updateProjectionMatrix()
    const altura = meiaAltura * 2
    const largura = altura * proporcao
    // Cobre a tela: o lado que sobra é cortado igual dos dois lados.
    const escalaX = proporcao > PROPORCAO_DO_VIDEO ? largura : altura * PROPORCAO_DO_VIDEO
    const escalaY = proporcao > PROPORCAO_DO_VIDEO ? largura / PROPORCAO_DO_VIDEO : altura
    telaDoVideo.scale.set(escalaX, escalaY, 1)
    telaParada.scale.set(escalaX, escalaY, 1)
  }

  function criarSom(kit: KitDeSom) {
    let buffer: AudioBuffer | null = null
    void bytesDoSom()
      .then((bytes) => kit.ctx.decodeAudioData(bytes))
      .then((decodificado) => {
        buffer = decodificado
      })
      // Navegador que não decodifica Opus em WebM (ou contexto já fechado): a cena segue muda.
      .catch(() => undefined)

    /** O trecho tocando: de onde (`offsetS`, em tempo da cena) e quando (`inicioCtx`) ele partiu, e em que ritmo. */
    let tocando: { fonte: AudioBufferSourceNode; ganho: GainNode; inicioCtx: number; offsetS: number; ritmo: number } | null = null

    function parar(): void {
      if (tocando === null) return
      const agora = kit.ctx.currentTime
      const ganho = tocando.ganho.gain
      // A rampa de entrada pode não ter acabado: sai do valor de agora, sem o resto dela.
      ganho.cancelScheduledValues(agora)
      ganho.setValueAtTime(ganho.value, agora)
      ganho.linearRampToValueAtTime(0, agora + RAMPA_DO_SOM_S)
      tocando.fonte.stop(agora + RAMPA_DO_SOM_S * 2)
      tocando = null
    }

    function tocarDe(t: number, som: AudioBuffer): void {
      const agora = kit.ctx.currentTime
      const ganho = kit.ctx.createGain()
      ganho.gain.setValueAtTime(0, agora)
      ganho.gain.linearRampToValueAtTime(1, agora + RAMPA_DO_SOM_S)
      ganho.connect(kit.destino)
      const fonte = kit.ctx.createBufferSource()
      fonte.buffer = som
      fonte.playbackRate.value = ritmo
      fonte.connect(ganho)
      fonte.addEventListener('ended', () => ganho.disconnect(), { once: true })
      fonte.start(agora, t)
      tocando = { fonte, ganho, inicioCtx: agora, offsetS: t, ritmo }
    }

    return {
      atualizar(t: number) {
        // Contexto ainda suspenso (sem gesto): o relógio dele não anda, e recomeçar a cada quadro só empilharia nós.
        if (buffer === null || kit.ctx.state !== 'running') return
        if (t < 0 || t >= DURACAO_DO_VIDEO_S) {
          parar()
          return
        }
        if (tocando !== null) {
          const agora = kit.ctx.currentTime
          const posicao = tocando.offsetS + (agora - tocando.inicioCtx) * tocando.ritmo
          if (tocando.ritmo !== ritmo) {
            tocando.offsetS = posicao
            tocando.inicioCtx = agora
            tocando.ritmo = ritmo
            tocando.fonte.playbackRate.setValueAtTime(ritmo, agora)
          }
          // Antes de o ritmo ser medido, a deriva ainda não diz nada: recomeçar agora seria recomeçar de novo depois.
          if (!ritmoMedido || Math.abs(posicao - t) <= TOLERANCIA_DO_SOM_S) return
          parar()
        }
        tocarDe(t, buffer)
      },
      reiniciar: parar,
    }
  }

  function descartar() {
    soltarVideo()
    texturaDoVideo.dispose()
    texturaParada.dispose()
    plano.dispose()
    materialDoVideo.dispose()
    materialParado.dispose()
  }

  ajustarTela(PROPORCAO_DO_VIDEO)
  atualizar(0)

  return { scene, camera, atualizar, ajustarTela, criarSom, pronta, descartar }
}

const criarCena: CriarCena = criar
export default criarCena
