import { CanvasSource, Container, Geometry, GlProgram, Mesh, Shader, UniformGroup, type Renderer, type TextureSource } from 'pixi.js'
import { AJUSTE_DO_CHAO_MOLHADO, type NiveisDoChao, type PassoDaPoca } from '../lib/chaoMolhado'
import { aquecerPrograma } from './aquecerPrograma'
import { telaVazia } from './drawNeblina'

/**
 * O CHÃO MOLHADO E A NEVE ACUMULADA no palco (`lib/chaoMolhado.ts`). Uma
 * camada por cima do chão (o Liso, as salas, as Texturas e o terreno das peças
 * com material) e abaixo da luz do relevo, das paredes, dos objetos e das
 * fichas: no editor, a faixa `chaoMolhado` logo acima do `terrenoDoChao`; no
 * jogador, `chaoMolhadoContainer`, com a máscara do conhecido (`knownMask`),
 * debaixo da névoa.
 *
 * Dois desenhos de um retângulo do tamanho do mapa, com o mesmo shader (o
 * `F_MAPA` do protótipo aprovado, partido em dois porque daqui não se lê a cor
 * de baixo):
 * - ESCURECER, em multiply: o chão molhado fica mais escuro e um pouco azul; a
 *   poça escurece e azula mais.
 * - COBRIR, em normal: o reflexo claro da poça e a neve em manchas (o desenho do
 *   mapa continua por baixo, nunca um véu branco por igual).
 *
 * Nada aqui anda sozinho: quem diz o nível (molhando, secando, juntando neve)
 * é o `drawAmbiente.ts`, que só pede quadro enquanto o nível anda. Parado, é
 * um desenho como qualquer outro: não faz a tela redesenhar.
 */

const VERTICE = `#version 300 es
precision highp float;
in vec2 aPosition;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform vec2 uMundo;
out vec2 vMundo;
void main() {
  vec2 p = aPosition * uMundo;
  vMundo = p;
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(p, 1.0)).xy, 0.0, 1.0);
}
`

const PIXEL = `#version 300 es
precision highp float;
in vec2 vMundo;
uniform vec2 uMundo;
// 0 = escurecer (multiply), 1 = cobrir (normal)
uniform float uPasso;
// molhado e neve juntada (o tempo, 0 a 1)
uniform vec2 uNivel;
// chuva e neve do mapa inteiro (0 a 1)
uniform vec2 uInteira;
// chuva e neve pintadas à vista (0 a 1)
uniform vec2 uPintada;
uniform vec4 uCaixaChuva;
uniform vec4 uCaixaNeve;
// casa / 40 (a régua do protótipo), tem poça (0 ou 1)
uniform vec2 uRegua;
uniform sampler2D uSeco;
uniform sampler2D uPincelChuva;
uniform sampler2D uPincelNeve;
uniform sampler2D uPoca;
out vec4 finalColor;

float sorteio(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float ruido(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = sorteio(i), b = sorteio(i + vec2(1.0, 0.0)), c = sorteio(i + vec2(0.0, 1.0)), d = sorteio(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  return ruido(p) * 0.55 + ruido(p * 2.03 + 17.1) * 0.3 + ruido(p * 4.01 + 31.7) * 0.15;
}

void main() {
  vec2 m = vMundo / uMundo;
  if (m.x < 0.0 || m.y < 0.0 || m.x > 1.0 || m.y > 1.0) discard;
  float E = uRegua.x;
  // Dentro de casa de teto fechado e de cômodo fechado não molha nem junta neve.
  float aberto = 1.0 - texture(uSeco, m).a;
  float chuva = max(uInteira.x, texture(uPincelChuva, (vMundo - uCaixaChuva.xy) * uCaixaChuva.zw).a * uPintada.x) * aberto;
  float molhado = chuva * uNivel.x;
  float n = fbm(vMundo / (65.0 * E)) * 0.6 + fbm(vMundo / (24.0 * E) + 7.3) * 0.4;
  float poca = uRegua.y * smoothstep(0.6, 0.66, n) * texture(uPoca, m).a * smoothstep(0.45, 0.9, molhado);
  if (uPasso < 0.5) {
    vec3 k = vec3(1.0 - 0.2 * molhado) * mix(vec3(1.0), vec3(0.93, 0.97, 1.0), molhado);
    k *= mix(vec3(1.0), vec3(0.78, 0.84, 0.94), poca * 0.6);
    float kMin = min(k.r, min(k.g, k.b));
    // Multiply do Pixi: baixo * (cor + 1 - alfa) = baixo * k.
    finalColor = vec4(k - kMin, 1.0 - kMin);
    return;
  }
  float neve = max(uInteira.y, texture(uPincelNeve, (vMundo - uCaixaNeve.xy) * uCaixaNeve.zw).a * uPintada.y) * aberto * uNivel.y;
  float nz = fbm(vMundo / (37.0 * E)) * 0.7 + fbm(vMundo / (10.0 * E) + 3.1) * 0.3;
  // Neve em manchas que crescem com o nível, e uma poeira leve por igual.
  float cobre = smoothstep(1.0 - neve * 0.62, 1.2 - neve * 0.62, nz) * step(0.002, neve);
  float a = max(cobre * 0.74, neve * 0.22);
  float reflexo = poca * 0.2;
  vec3 cor = vec3(0.93, 0.95, 0.98) * a + vec3(0.55, 0.6, 0.68) * reflexo * (1.0 - a);
  finalColor = vec4(cor, a + reflexo * (1.0 - a));
}
`

let programa: GlProgram | null = null
function programaDoChao(): GlProgram {
  programa ??= new GlProgram({ vertex: VERTICE, fragment: PIXEL, name: 'chao-molhado' })
  return programa
}

/**
 * Compila o shader do chão em segundo plano (`aquecerPrograma.ts`): compilado
 * no primeiro desenho, ele travava o ligar da chuva (262 ms no Goa). `false` =
 * a placa não compila: sem chão molhado (com aviso), o resto segue igual.
 */
export function aquecerChaoMolhado(renderer: Renderer): Promise<boolean> {
  return aquecerPrograma(renderer, programaDoChao(), '[chão molhado] o shader não compilou nesta placa; o chão não molha')
}

/** A máscara de um efeito pintado: a tela e a caixa dela (x, y, texels por px em x e em y), como a das partículas. */
export interface PincelDoChao {
  fonte: TextureSource
  caixa: Float32Array
  /** O quanto o pincel já apareceu (0 a 1). */
  aparecido: number
}

export interface EntradaDoChaoMolhado {
  largura: number
  altura: number
  grid: number
  /** Chuva e neve do mapa inteiro, 0 a 1. */
  inteira: { chuva: number; neve: number }
  chuva: PincelDoChao | null
  neve: PincelDoChao | null
  /** O seco (`drawAmbiente.ts`): alfa 1 dentro de casa fechada. */
  seco: TextureSource
}

export interface ChaoMolhado {
  readonly camada: Container
  definir: (entrada: EntradaDoChaoMolhado) => void
  /** O quanto já molhou e já juntou neve agora. Os dois em 0 = a camada some (não desenha nada). */
  niveis: (niveis: NiveisDoChao) => void
  /** Onde a chuva forte abre poça; `null` ou vazio = em lugar nenhum. */
  pocas: (passos: readonly PassoDaPoca[] | null, largura: number, altura: number, grid: number) => void
  /** O shader compilou (`aquecerChaoMolhado`): antes disso a camada não aparece, para o Pixi não compilar travando. */
  shaderPronto: () => void
  destruir: () => void
}

function caminho(g: CanvasRenderingContext2D, pontos: readonly { x: number; y: number }[], fechar: boolean): boolean {
  const [primeiro, ...resto] = pontos
  if (primeiro === undefined) return false
  g.beginPath()
  g.moveTo(primeiro.x, primeiro.y)
  // Um ponto só (um clique de pincel) vira um disco: a ponta redonda de um traço quase nulo.
  if (resto.length === 0) g.lineTo(primeiro.x + 0.01, primeiro.y)
  for (const p of resto) g.lineTo(p.x, p.y)
  if (fechar) g.closePath()
  return true
}

/** Pinta a máscara das poças (alfa 1 = a chuva forte pode abrir poça aqui). `null` = nenhuma. */
export function pintarPocas(passos: readonly PassoDaPoca[], largura: number, altura: number, grid: number): HTMLCanvasElement | null {
  if (passos.length === 0 || largura <= 0 || altura <= 0) return null
  const ajuste = AJUSTE_DO_CHAO_MOLHADO
  const escala = Math.min(ajuste.texelsDaPocaPorCasa / Math.max(1, grid), ajuste.ladoMaximoDaPoca / Math.max(1, largura, altura))
  const tela = document.createElement('canvas')
  tela.width = Math.max(1, Math.ceil(largura * escala))
  tela.height = Math.max(1, Math.ceil(altura * escala))
  const g = tela.getContext('2d')
  if (g === null) return null
  g.setTransform(escala, 0, 0, escala, 0, 0)
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.strokeStyle = '#fff'
  g.fillStyle = '#fff'
  for (const passo of passos) {
    g.globalCompositeOperation = passo.modo === 'poe' ? 'source-over' : 'destination-out'
    g.globalAlpha = Math.min(1, Math.max(0, passo.forca))
    if (passo.forma === 'traco') {
      if (!caminho(g, passo.pontos, false)) continue
      g.lineWidth = passo.raio * 2
      g.stroke()
    } else if (caminho(g, passo.pontos, true)) {
      g.fill('evenodd')
    }
  }
  return tela
}

export function criarChaoMolhado(): ChaoMolhado {
  const camada = new Container()
  camada.label = 'chaoMolhado'
  camada.eventMode = 'none'
  camada.interactiveChildren = false
  camada.visible = false

  const caixaChuva = new Float32Array([0, 0, 1, 1])
  const caixaNeve = new Float32Array([0, 0, 1, 1])
  const comum = new UniformGroup({
    uMundo: { value: new Float32Array([1, 1]), type: 'vec2<f32>' },
    uNivel: { value: new Float32Array(2), type: 'vec2<f32>' },
    uInteira: { value: new Float32Array(2), type: 'vec2<f32>' },
    uPintada: { value: new Float32Array(2), type: 'vec2<f32>' },
    uCaixaChuva: { value: caixaChuva, type: 'vec4<f32>' },
    uCaixaNeve: { value: caixaNeve, type: 'vec4<f32>' },
    uRegua: { value: new Float32Array([1, 0]), type: 'vec2<f32>' },
  })
  const vazia = telaVazia()
  let poca: CanvasSource = telaVazia()
  let temPoca = false
  let compilado = false

  function criarPasso(passo: 0 | 1): Mesh<Geometry, Shader> {
    const ajustes = new UniformGroup({ uPasso: { value: passo, type: 'f32' } })
    const shader = new Shader({
      glProgram: programaDoChao(),
      resources: { comum, passo: ajustes, uSeco: vazia, uPincelChuva: vazia, uPincelNeve: vazia, uPoca: poca },
    })
    const geometria = new Geometry({
      attributes: { aPosition: { buffer: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), format: 'float32x2' } },
      indexBuffer: new Uint16Array([0, 1, 2, 0, 2, 3]),
    })
    const mesh = new Mesh<Geometry, Shader>({ geometry: geometria, shader })
    mesh.eventMode = 'none'
    mesh.blendMode = passo === 0 ? 'multiply' : 'normal'
    camada.addChild(mesh)
    return mesh
  }
  const escurecer = criarPasso(0)
  const cobrir = criarPasso(1)
  const malhas = [escurecer, cobrir]

  function usar(nome: 'uSeco' | 'uPincelChuva' | 'uPincelNeve' | 'uPoca', fonte: TextureSource): void {
    for (const m of malhas) if (m.shader !== null && m.shader.resources[nome] !== fonte) m.shader.resources[nome] = fonte
  }

  /** O que cada desenho tem a fazer: escurecer só com chuva; cobrir com poça (chuva forte) ou com neve. */
  function mostrar(): void {
    const nivel = comum.uniforms.uNivel
    const molhado = nivel[0] > 0
    const neve = nivel[1] > 0
    escurecer.visible = molhado
    cobrir.visible = (molhado && temPoca) || neve
    camada.visible = compilado && (escurecer.visible || cobrir.visible)
  }

  return {
    camada,
    definir(e) {
      comum.uniforms.uMundo.set([Math.max(1, e.largura), Math.max(1, e.altura)])
      comum.uniforms.uInteira.set([e.inteira.chuva, e.inteira.neve])
      comum.uniforms.uPintada.set([e.chuva?.aparecido ?? 0, e.neve?.aparecido ?? 0])
      caixaChuva.set(e.chuva?.caixa ?? [0, 0, 1, 1])
      caixaNeve.set(e.neve?.caixa ?? [0, 0, 1, 1])
      comum.uniforms.uRegua[0] = Math.max(0.01, e.grid / 40)
      usar('uSeco', e.seco)
      usar('uPincelChuva', e.chuva?.fonte ?? vazia)
      usar('uPincelNeve', e.neve?.fonte ?? vazia)
    },
    niveis(niveis) {
      comum.uniforms.uNivel.set([niveis.molhado, niveis.neve])
      mostrar()
    },
    pocas(passos, largura, altura, grid) {
      const tela = passos === null ? null : pintarPocas(passos, largura, altura, grid)
      const velha = poca
      poca = tela === null ? telaVazia() : new CanvasSource({ resource: tela, scaleMode: 'linear', addressMode: 'clamp-to-edge' })
      temPoca = tela !== null
      comum.uniforms.uRegua[1] = temPoca ? 1 : 0
      usar('uPoca', poca)
      velha.destroy()
      mostrar()
    },
    shaderPronto() {
      compilado = true
      mostrar()
    },
    destruir() {
      camada.destroy({ children: true })
      poca.destroy()
      vazia.destroy()
    },
  }
}
