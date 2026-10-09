import type * as Three from 'three'
import type { CriarCena, KitDeSom, ThreeModule } from '../../transicoes/tipos'
import { descartarCena, semente } from '../../transicoes/texturas'
import { clamp01, easeInOutCubic, easeInOutSine, easeInQuad, easeOutCubic, span } from '../../transicoes/curvas'

/**
 * Portão pesado: a tela de porta do Resident Evil 2 (1998) com um portão de
 * duas folhas que NÃO quer abrir. Fundo preto, uma luz fria só, câmera em
 * primeira pessoa que chega devagar. O 1º empurrão quase não mexe as folhas
 * (baque, poeira caindo do arco, tremor); depois de uma pausa, o 2º arranca
 * rangidos e as folhas cedem aos trancos; por fim abrem pesadas, para longe
 * da câmera, e a câmera entra no escuro.
 *
 * O ar de PlayStation vem de desenhar o mundo numa imagem pequena (~430×240)
 * e ampliá-la sem suavizar, com a cor reduzida a 15 bits e pontilhado
 * ordenado, como o console fingia degradê. O motor só chama
 * `renderer.render(scene, camera)`: a `scene` entregue é um quadro de tela
 * cheia, e o mundo de verdade (`mundo`, filho dela, invisível para o quadro)
 * é desenhado na imagem pequena no `onBeforeRender` da própria `scene`.
 */

/** Roteiro em segundos. Exportado para o teste conferir o ritmo contra as mesmas marcas. */
export const ROTEIRO_DO_PORTAO = {
  fadeInFim: 1.0,
  chegadaInicio: 0.2,
  chegadaFim: 2.45,
  /** 1º empurrão: o baque. As folhas quase não se mexem. */
  empurrao1: 2.6,
  /** 2º empurrão: começa o esforço (gemido da madeira) antes do 1º tranco. */
  esforco: 4.0,
  trancos: [4.25, 4.95, 5.65],
  aberturaInicio: 6.25,
  aberturaFim: 9.25,
  travessiaInicio: 7.4,
  travessiaFim: 10.6,
  fadeOutInicio: 9.7,
  fadeOutFim: 10.6,
} as const
const T = ROTEIRO_DO_PORTAO

/** Medidas em metros, tiradas da imagem de referência (1 px ≈ 1,2 cm). */
const VAO = { largura: 1.8, soleira: 0.045 }
const LINTEL = { base: 2.7, topo: 2.94 }
/** Bandeira em meia elipse sobre o lintel (achatada como na imagem) e a faixa de pedra em volta. */
const ARCO = { a: 0.9, b: 0.63, faixa: 0.16 }
const OMBREIRA = 0.16
const FOLHA = { espessura: 0.09, z: -0.1, folgaNoMeio: 0.004 }
/** Ângulo final das folhas (≈78°): abertas o bastante para a câmera passar entre elas. */
export const PORTAO_ABERTO_RAD = 1.36
/** Onde cada tranco deixa as folhas (rad). A direita cede antes e mais: portão velho não abre por igual. */
const DEGRAUS = { esquerda: [0.006, 0.055, 0.12, 0.2], direita: [0.006, 0.075, 0.16, 0.25] } as const
const ATRASO_DA_ESQUERDA = 0.09
const CAM = { y: 1.62, z0: 7.6, z1: 4.2, z2: 3.95, z3: -2.6, zReduzido: 5.0 }
/** Pixels da imagem pequena: ~430×240 em 16:9, a resolução de um jogo de PlayStation. */
const PIXELS_DA_TELA = 430 * 240

export const criarCenaPortaoPesado: CriarCena = (THREE, { reduzirMovimento }) => {
  const scene = new THREE.Scene()
  const mundo = new THREE.Scene()
  mundo.fog = new THREE.FogExp2(0x000000, 0.085)
  scene.add(mundo)

  // A câmera do motor só enxerga o quadro de tela cheia; quem anda é o `olho`.
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10)
  const olho = new THREE.PerspectiveCamera(48, 1, 0.05, 30)
  olho.name = 'olho'
  mundo.add(olho)

  // Uma luz só, fria, acima e à frente do portão: sombra dura do lintel e do
  // arco nas folhas e, quando elas abrem, uma cunha de luz no chão de dentro.
  mundo.add(new THREE.AmbientLight(0x1c2533, 0.2))
  const luz = new THREE.SpotLight(0xc8d5ea, 1.2, 16, 0.55, 0.65, 1.7)
  luz.name = 'luz'
  luz.position.set(0.4, 4.7, 3.0)
  luz.target.position.set(0, 1.4, -0.8)
  luz.castShadow = true
  luz.shadow.mapSize.set(1024, 1024)
  luz.shadow.bias = -0.0008
  luz.shadow.normalBias = 0.02
  luz.shadow.camera.near = 0.5
  luz.shadow.camera.far = 16
  mundo.add(luz, luz.target)

  montarChaoEParede(THREE, mundo)
  montarMoldura(THREE, mundo)
  const esquerda = montarFolha(THREE, mundo, -1)
  const direita = montarFolha(THREE, mundo, 1)
  const poeira = criarQueda(THREE, { quantidade: 100, cor: 0xa79e8c, tamanho: [0.016, 0.028], pesado: false, semente: 71 })
  const calica = criarQueda(THREE, { quantidade: 10, cor: 0x6f6a62, tamanho: [0.025, 0.042], pesado: true, semente: 72 })
  mundo.add(poeira.malha, calica.malha)

  // A imagem pequena: meio-float para o degradê escuro não virar faixas antes
  // do pontilhado (8 bits lineares perdem os tons perto do preto).
  const alvo = new THREE.WebGLRenderTarget(430, 240, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, depthBuffer: true })
  const uniforms = { tCena: { value: alvo.texture }, uResolucao: { value: new THREE.Vector2(430, 240) }, uTempo: { value: 0 } }
  const quadro = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms, vertexShader: VERTICE_DO_QUADRO, fragmentShader: FRAGMENTO_DO_QUADRO, depthTest: false, depthWrite: false }))
  quadro.frustumCulled = false
  scene.add(quadro)

  mundo.visible = false
  let tipoConferido = false
  scene.onBeforeRender = (renderer) => {
    // Celular sem render em meio-float daria tela PRETA: antes do primeiro
    // desenho (a textura ainda não existe na GPU), cai para 8 bits — perde só
    // um pouco do degradê perto do preto, que o pontilhado ainda disfarça.
    if (!tipoConferido) {
      tipoConferido = true
      const meioFloat = renderer.extensions.has('EXT_color_buffer_half_float') || renderer.extensions.has('EXT_color_buffer_float')
      if (!meioFloat) alvo.texture.type = THREE.UnsignedByteType
    }
    const anterior = renderer.getRenderTarget()
    mundo.visible = true
    renderer.setRenderTarget(alvo)
    renderer.render(mundo, olho)
    renderer.setRenderTarget(anterior)
    mundo.visible = false
  }

  // A intensidade só vale depois da conversão de unidades do motor (feita
  // logo após `criar`): a base é lida no primeiro quadro, não aqui.
  let luzBase = -1

  function atualizar(t: number) {
    if (luzBase < 0) luzBase = luz.intensity
    uniforms.uTempo.value = t

    const angEsq = anguloDaFolha(t, DEGRAUS.esquerda, ATRASO_DA_ESQUERDA, reduzirMovimento)
    const angDir = anguloDaFolha(t, DEGRAUS.direita, 0, reduzirMovimento)
    esquerda.rotation.y = angEsq
    direita.rotation.y = -angDir
    poeira.atualizar(t)
    calica.atualizar(t)

    // A lâmpada estremece com o baque e com cada tranco (metade, se reduzir movimento).
    let treme = pancada(t - T.empurrao1) * 0.3
    for (const tk of T.trancos) treme += pancada(t - tk) * 0.12
    luz.intensity = luzBase * (1 - treme * (reduzirMovimento ? 0.5 : 1))

    const chegada = easeInOutSine(span(t, T.chegadaInicio, T.chegadaFim))
    const espreita = easeInOutSine(span(t, T.chegadaFim, T.travessiaInicio))
    const travessia = easeInQuad(span(t, T.travessiaInicio, T.travessiaFim))
    const z = reduzirMovimento ? CAM.zReduzido : CAM.z0 + (CAM.z1 - CAM.z0) * chegada + (CAM.z2 - CAM.z1) * espreita + (CAM.z3 - CAM.z2) * travessia
    let tx = 0
    let ty = 0
    let giro = 0
    if (!reduzirMovimento) {
      const forte = tremor(t, T.empurrao1, 0.55)
      let fraco = 0
      for (const tk of T.trancos) fraco += tremor(t, tk, 0.35)[0] * 0.45
      tx = (forte[0] + fraco) * 0.012
      ty = forte[1] * 0.009
      giro = (forte[0] - fraco) * 0.004
    }
    olho.position.set(0.02 + tx, CAM.y + ty, z)
    olho.lookAt(0, 1.9 - 0.25 * (reduzirMovimento ? 0 : travessia), z - 5)
    if (giro !== 0) olho.rotateZ(giro)

    const fIn = 1 - span(t, 0, T.fadeInFim)
    const fOut = span(t, T.fadeOutInicio, T.fadeOutFim)
    return { fade: Math.max(fIn, fOut) }
  }

  function ajustarTela(aspecto: number) {
    const altura = Math.max(120, Math.round(Math.sqrt(PIXELS_DA_TELA / aspecto)))
    const largura = Math.max(64, Math.round(altura * aspecto))
    alvo.setSize(largura, altura)
    uniforms.uResolucao.value.set(largura, altura)
    olho.aspect = aspecto
    olho.fov = aspecto < 0.8 ? 66 : 48
    olho.updateProjectionMatrix()
    camera.aspect = aspecto
    camera.updateProjectionMatrix()
  }

  function criarSom(kitDoMotor: KitDeSom) {
    // Limitador na saída da cena: rangido é trem de estalos, com picos muito
    // acima da média; sem ele o tranco passava do teto (1,08) e estalava.
    const limitador = kitDoMotor.ctx.createDynamicsCompressor()
    limitador.threshold.value = -9
    limitador.knee.value = 6
    limitador.ratio.value = 12
    limitador.attack.value = 0.002
    limitador.release.value = 0.2
    limitador.connect(kitDoMotor.destino)
    const kit: KitDeSom = { ...kitDoMotor, destino: limitador }
    const tocadas = new Set<string>()
    const pistas: Array<[string, number, (agora: number) => void]> = [
      ['ambiente', 0, (a) => ambiente(kit, a, T.fadeOutFim)],
      ['passo1', 0.5, (a) => passo(kit, a, 0.5, false)],
      ['passo2', 1.25, (a) => passo(kit, a, 0.55, false)],
      ['passo3', 1.95, (a) => passo(kit, a, 0.45, false)],
      ['baque', T.empurrao1, (a) => baque(kit, a, 1)],
      ['poeira', T.empurrao1 + 0.08, (a) => areia(kit, a, 1.8, 0.06)],
      ['esforco', T.esforco, (a) => rangido(kit, a, 0.5, GEMIDO_DA_MADEIRA)],
      ...T.trancos.map((tk, k): [string, number, (agora: number) => void] => [
        `tranco${k}`,
        tk,
        (a) => {
          rangido(kit, a, 0.55, RANGIDO_DO_TRANCO)
          baque(kit, a + 0.02, 0.4)
          areia(kit, a + 0.05, 0.8, 0.03)
        },
      ]),
      ['abre', T.aberturaInicio, (a) => rangido(kit, a, T.aberturaFim - T.aberturaInicio, RANGIDO_DA_ABERTURA)],
      ['assenta', T.aberturaFim - 0.1, (a) => baque(kit, a, 0.22)],
      ['passo4', 8.45, (a) => passo(kit, a, 0.4, true)],
      ['passo5', 9.2, (a) => passo(kit, a, 0.38, true)],
      ['passo6', 9.95, (a) => passo(kit, a, 0.34, true)],
    ]
    return {
      atualizar(t: number) {
        for (const [nome, quando, tocar] of pistas) {
          if (t >= quando && !tocadas.has(nome)) {
            tocadas.add(nome)
            tocar(kit.ctx.currentTime)
          }
        }
      },
      reiniciar: () => tocadas.clear(),
    }
  }

  function descartar() {
    poeira.malha.dispose()
    calica.malha.dispose()
    descartarCena(scene)
    alvo.dispose()
  }

  return { scene, camera, atualizar, ajustarTela, criarSom, descartar }
}

export default criarCenaPortaoPesado

// ---------------------------------------------------------------------------
// Movimento
// ---------------------------------------------------------------------------

/**
 * Ângulo de uma folha no tempo t (rad, 0 = fechada). O 1º empurrão cede ~1°
 * e o portão devolve quase tudo; cada tranco leva a folha ao degrau seguinte
 * num estalo (ou numa rampa suave, com reduzir movimento); a abertura final
 * sai devagar e assenta sem quicar, como coisa pesada.
 */
function anguloDaFolha(t: number, degraus: readonly number[], atraso: number, reduzir: boolean): number {
  let a = 0
  const d1 = t - T.empurrao1 - atraso * 0.3
  if (d1 > 0) {
    const cede = reduzir ? easeInOutSine(clamp01(d1 / 0.3)) : easeOutCubic(clamp01(d1 / 0.1))
    const volta = easeInOutSine(clamp01((d1 - 0.2) / 0.7))
    a = 0.022 * cede - (0.022 - degraus[0]) * volta
    if (!reduzir) a += 0.005 * Math.exp(-d1 * 8) * Math.sin(d1 * 75)
  }
  // Força contínua entre os trancos: as folhas tremem presas (só sem reduzir).
  if (!reduzir) a += 0.0015 * Math.sin(t * 90) * span(t, T.esforco, T.esforco + 0.2) * (1 - span(t, T.aberturaInicio - 0.15, T.aberturaInicio + 0.2))
  T.trancos.forEach((tk, k) => {
    const d = t - tk - atraso
    if (d <= 0) return
    const passo = degraus[k + 1] - degraus[k]
    if (reduzir) a += passo * easeInOutSine(clamp01(d / 0.6))
    else a += passo * easeOutCubic(clamp01(d / 0.14)) + passo * 0.12 * Math.exp(-d * 9) * Math.sin(d * 48)
  })
  const final = span(t, T.aberturaInicio + atraso, T.aberturaFim)
  return a + (PORTAO_ABERTO_RAD - degraus[degraus.length - 1]) * easeInOutCubic(final)
}

/** Pulso que some rápido depois de um impacto (0 antes dele). */
function pancada(d: number): number {
  return d < 0 ? 0 : Math.exp(-d * 7) * Math.abs(Math.sin(d * 38))
}

/** Tremor de câmera amortecido: [lado, altura], determinístico pelo tempo. */
function tremor(t: number, inicio: number, duracao: number): [number, number] {
  const d = t - inicio
  if (d < 0 || d > duracao) return [0, 0]
  const queda = (1 - d / duracao) ** 2
  return [queda * (Math.sin(d * 57) * 0.6 + Math.sin(d * 33 + 1.7) * 0.4), queda * (Math.sin(d * 49 + 0.6) * 0.7 + Math.sin(d * 27) * 0.3)]
}

// ---------------------------------------------------------------------------
// Poeira e calica: caem do lintel e do arco no baque e em cada tranco
// ---------------------------------------------------------------------------

interface Grao {
  nasce: number
  x: number
  y: number
  z: number
  velocidade: number
  fase: number
  tamanho: number
  giro: number
}

interface OpcoesDaQueda {
  quantidade: number
  cor: number
  tamanho: [number, number]
  /** Caliça cai com gravidade e fica no chão; poeira desce devagar e some ao tocar o chão. */
  pesado: boolean
  semente: number
}

/** Rajadas: [quando, fração dos grãos, espalhamento em s]. O baque solta mais que os trancos. */
const RAJADAS: ReadonlyArray<readonly [number, number, number]> = [
  [T.empurrao1 + 0.03, 0.55, 0.5],
  [T.trancos[0], 0.15, 0.3],
  [T.trancos[1], 0.15, 0.3],
  [T.trancos[2], 0.15, 0.3],
]

function criarQueda(THREE: ThreeModule, opcoes: OpcoesDaQueda) {
  const rnd = semente(opcoes.semente)
  const graos: Grao[] = []
  for (const [inicio, fracao, espalha] of RAJADAS) {
    const n = Math.round(opcoes.quantidade * fracao)
    for (let i = 0; i < n; i++) {
      const doArco = rnd() < 0.4
      const phi = Math.PI * (0.12 + rnd() * 0.76)
      graos.push({
        nasce: inicio + rnd() * (opcoes.pesado ? espalha * 0.3 : espalha),
        x: doArco ? Math.cos(phi) * (ARCO.a + ARCO.faixa / 2) : (rnd() - 0.5) * VAO.largura,
        y: doArco ? LINTEL.topo + Math.sin(phi) * (ARCO.b + ARCO.faixa / 2) - 0.05 : LINTEL.base - 0.01,
        z: doArco ? 0.08 + rnd() * 0.06 : -0.03 + rnd() * 0.09,
        // Poeira de reboco é grão, não pluma: cai em 2-3 s e some antes da travessia.
        velocidade: opcoes.pesado ? rnd() * 0.3 : 0.9 + rnd() * 0.9,
        fase: rnd() * Math.PI * 2,
        tamanho: opcoes.tamanho[0] + rnd() * (opcoes.tamanho[1] - opcoes.tamanho[0]),
        giro: (rnd() - 0.5) * 14,
      })
    }
  }
  const malha = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: opcoes.cor }), graos.length)
  malha.frustumCulled = false
  const boneco = new THREE.Object3D()

  function atualizar(t: number) {
    graos.forEach((g, i) => {
      const d = t - g.nasce
      let visivel = d >= 0
      let x = g.x
      let y = g.y
      let z = g.z
      if (visivel && opcoes.pesado) {
        // Queda livre até o chão; lá a calica fica.
        const chao = g.tamanho / 2
        const pousa = (-g.velocidade + Math.sqrt(g.velocidade ** 2 + 19.6 * (g.y - chao))) / 9.8
        const dq = Math.min(d, pousa)
        y = Math.max(chao, g.y - g.velocidade * dq - 4.9 * dq * dq)
        z += 0.25 * dq
        x += Math.sin(g.fase) * 0.06 * dq
      } else if (visivel) {
        // Poeira: arranca parada e chega à velocidade limite (arrasto do ar), balançando.
        y = g.y - g.velocidade * (d - (1 - Math.exp(-d * 3)) / 3)
        x += Math.sin(d * 1.3 + g.fase) * 0.05 * Math.min(d, 1)
        z += 0.05 * d
        visivel = y > 0.005 && d < 6
      }
      boneco.position.set(x, y, z)
      boneco.rotation.set(d * g.giro, d * g.giro * 0.7, g.fase)
      boneco.scale.setScalar(visivel ? g.tamanho : 0)
      boneco.updateMatrix()
      malha.setMatrixAt(i, boneco.matrix)
    })
    malha.instanceMatrix.needsUpdate = true
  }

  atualizar(0)
  return { malha, atualizar }
}

// ---------------------------------------------------------------------------
// Construção
// ---------------------------------------------------------------------------

function montarChaoEParede(THREE: ThreeModule, mundo: Three.Scene) {
  const chaoTex = texturaDeLajes(THREE, 11)
  chaoTex.repeat.set(6, 9)
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(10, 15), new THREE.MeshStandardMaterial({ map: chaoTex, roughness: 0.92 }))
  chao.rotation.x = -Math.PI / 2
  chao.position.z = 0.5
  chao.receiveShadow = true
  mundo.add(chao)

  // Parede escura com o vão do portão recortado (retângulo + meia elipse da
  // bandeira). O contorno é um "U" único, não um furo encostado na borda,
  // para a triangulação não degenerar.
  const ext = VAO.largura / 2 + OMBREIRA
  const nascente = LINTEL.topo
  const forma = new THREE.Shape()
  forma.moveTo(-5, 0)
  forma.lineTo(-ext, 0)
  forma.lineTo(-ext, nascente)
  forma.absellipse(0, nascente, ARCO.a + ARCO.faixa, ARCO.b + ARCO.faixa, Math.PI, 0, true)
  forma.lineTo(ext, 0)
  forma.lineTo(5, 0)
  forma.lineTo(5, 6.5)
  forma.lineTo(-5, 6.5)
  forma.closePath()
  const paredeTex = texturaDeParede(THREE, 23)
  paredeTex.repeat.set(0.4, 0.4)
  const parede = new THREE.Mesh(new THREE.ExtrudeGeometry(forma, { depth: 0.4, bevelEnabled: false, curveSegments: 14 }), new THREE.MeshStandardMaterial({ map: paredeTex, roughness: 1 }))
  parede.position.z = -0.4
  parede.receiveShadow = true
  mundo.add(parede)
}

/** Moldura clara: ombreiras, lintel, aduelas do arco (caixas, poucos polígonos), bandeira com grade e soleira. */
function montarMoldura(THREE: ThreeModule, mundo: Three.Scene) {
  const pedraTex = texturaDePedraClara(THREE, 31)
  pedraTex.repeat.set(0.5, 0.5)
  const pedra = new THREE.MeshStandardMaterial({ map: pedraTex, roughness: 0.9 })
  const caixa = (w: number, h: number, d: number, x: number, y: number, z: number, material: Three.Material = pedra) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
    m.position.set(x, y, z)
    m.castShadow = true
    m.receiveShadow = true
    mundo.add(m)
    return m
  }
  const ombX = VAO.largura / 2 + OMBREIRA / 2
  caixa(OMBREIRA, LINTEL.topo, 0.46, -ombX, LINTEL.topo / 2, -0.17)
  caixa(OMBREIRA, LINTEL.topo, 0.46, ombX, LINTEL.topo / 2, -0.17)
  caixa(VAO.largura, LINTEL.topo - LINTEL.base, 0.4, 0, (LINTEL.base + LINTEL.topo) / 2, -0.15)
  caixa(VAO.largura + OMBREIRA * 2 + 0.04, VAO.soleira, 0.5, 0, VAO.soleira / 2, -0.1)

  // Aduelas: 13 blocos ao longo da elipse do meio da faixa; o do topo (chave) maior.
  const AD = 13
  const am = ARCO.a + ARCO.faixa / 2
  const bm = ARCO.b + ARCO.faixa / 2
  for (let i = 0; i < AD; i++) {
    const p0 = [am * Math.cos((Math.PI * i) / AD), LINTEL.topo + bm * Math.sin((Math.PI * i) / AD)]
    const p1 = [am * Math.cos((Math.PI * (i + 1)) / AD), LINTEL.topo + bm * Math.sin((Math.PI * (i + 1)) / AD)]
    const corda = Math.hypot(p1[0] - p0[0], p1[1] - p0[1])
    const chave = i === (AD - 1) / 2
    const bloco = caixa(corda - 0.012 + (chave ? 0.03 : 0), ARCO.faixa + (chave ? 0.05 : 0), chave ? 0.5 : 0.44, (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, -0.16)
    bloco.rotation.z = Math.atan2(p1[1] - p0[1], p1[0] - p0[0])
  }

  // Bandeira: vidro escuro e brilhante (pega o reflexo da luz) atrás da grade clara.
  const meia = new THREE.Shape()
  meia.moveTo(-ARCO.a, 0)
  meia.absellipse(0, 0, ARCO.a, ARCO.b, Math.PI, 0, true)
  meia.closePath()
  const vidro = new THREE.Mesh(new THREE.ShapeGeometry(meia, 14), new THREE.MeshStandardMaterial({ color: 0x0a1018, roughness: 0.55, metalness: 0.15 }))
  vidro.position.set(0, LINTEL.topo, -0.17)
  mundo.add(vidro)
  const grade = new THREE.MeshStandardMaterial({ color: 0xa6b5c5, roughness: 0.75 })
  for (const x of [0, -0.3, 0.3, -0.6, 0.6]) {
    const h = ARCO.b * Math.sqrt(1 - (x / ARCO.a) ** 2)
    caixa(x === 0 ? 0.045 : 0.03, h, 0.05, x, LINTEL.topo + h / 2, -0.14, grade)
  }
  for (const y of [0.18, 0.41]) {
    caixa(2 * ARCO.a * Math.sqrt(1 - (y / ARCO.b) ** 2), 0.03, 0.05, 0, LINTEL.topo + y, -0.14, grade)
  }
}

/**
 * Uma folha com pivô na dobradiça. `lado` -1 = esquerda (dobradiça em x
 * negativo), 1 = direita. As duas usam metades da MESMA textura, então o
 * emblema atravessa o encontro das folhas e se parte quando elas abrem.
 */
function montarFolha(THREE: ThreeModule, mundo: Three.Scene, lado: -1 | 1): Three.Group {
  const largura = VAO.largura / 2 - FOLHA.folgaNoMeio
  const altura = LINTEL.base - VAO.soleira - 0.005
  const dobradica = new THREE.Group()
  dobradica.name = lado < 0 ? 'folha-esquerda' : 'folha-direita'
  dobradica.position.set((lado * VAO.largura) / 2, VAO.soleira, FOLHA.z)
  mundo.add(dobradica)

  const frente = texturaDoPortao(THREE)
  frente.repeat.set(0.5, 1)
  frente.offset.set(lado < 0 ? 0 : 0.5, 0)
  frente.anisotropy = 4
  const pintura = new THREE.MeshStandardMaterial({ map: frente, roughness: 0.78, metalness: 0.05 })
  const quina = new THREE.MeshStandardMaterial({ color: 0x27323f, roughness: 0.85 })
  const tabua = new THREE.Mesh(new THREE.BoxGeometry(largura, altura, FOLHA.espessura), [quina, quina, quina, quina, pintura, quina])
  tabua.position.set((-lado * largura) / 2, altura / 2, 0)
  tabua.castShadow = true
  tabua.receiveShadow = true
  dobradica.add(tabua)

  // Puxador de ferro perto do encontro das folhas (pega um brilho da luz).
  const ferro = new THREE.MeshStandardMaterial({ color: 0x1c2128, roughness: 0.45, metalness: 0.7 })
  const xPuxador = -lado * (largura - 0.09)
  const zFrente = FOLHA.espessura / 2
  const barra = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.2, 6), ferro)
  barra.position.set(xPuxador, 1.05, zFrente + 0.035)
  barra.castShadow = true
  dobradica.add(barra)
  for (const dy of [-0.085, 0.085]) {
    const pe = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.035), ferro)
    pe.position.set(xPuxador, 1.05 + dy, zFrente + 0.0175)
    dobradica.add(pe)
  }
  if (lado > 0) {
    const espelho = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.008), ferro)
    espelho.position.set(xPuxador, 0.9, zFrente + 0.004)
    dobradica.add(espelho)
    const fechadura = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.03, 0.01), new THREE.MeshBasicMaterial({ color: 0x000000 }))
    fechadura.position.set(xPuxador, 0.89, zFrente + 0.008)
    dobradica.add(fechadura)
  }
  for (const y of [0.35, 1.3, 2.3]) {
    const gonzo = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.16, 6), ferro)
    gonzo.position.set(0, y, 0)
    dobradica.add(gonzo)
  }
  return dobradica
}

// ---------------------------------------------------------------------------
// Texturas (canvas com semente fixa: a miniatura sai igual toda vez)
// ---------------------------------------------------------------------------

function tela(largura: number, altura: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2D indisponível')
  return [canvas, ctx]
}

/** Granulado por pixel: a textura "suja" que o PlayStation mostrava em tudo. */
function granular(g: CanvasRenderingContext2D, largura: number, altura: number, rnd: () => number, forca: number) {
  const img = g.getImageData(0, 0, largura, altura)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * forca
    img.data[i] += n
    img.data[i + 1] += n
    img.data[i + 2] += n
  }
  g.putImageData(img, 0, 0)
}

function manchas(g: CanvasRenderingContext2D, largura: number, altura: number, rnd: () => number, quantas: number, raio: [number, number], cor: string) {
  for (let k = 0; k < quantas; k++) {
    const x = rnd() * largura
    const y = rnd() * altura
    const r = raio[0] + rnd() * (raio[1] - raio[0])
    const grd = g.createRadialGradient(x, y, 0, x, y, r)
    grd.addColorStop(0, cor)
    grd.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, largura, altura)
  }
}

function repetida(THREE: ThreeModule, canvas: HTMLCanvasElement): Three.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

/** As duas folhas lado a lado (384×576 ≈ 1,8 × 2,65 m): tábuas azul-acinzentadas, emblema, desgaste. */
function texturaDoPortao(THREE: ThreeModule): Three.CanvasTexture {
  const L = 384
  const A = 576
  const [canvas, g] = tela(L, A)
  const rnd = semente(40)
  g.fillStyle = '#6886a9'
  g.fillRect(0, 0, L, A)
  for (const x0 of [0, L / 2]) {
    const ix = x0 + 18
    const iw = L / 2 - 36
    const iy = 24
    const ih = A - 24 - 40
    g.fillStyle = '#5f7ea3'
    g.fillRect(ix, iy, iw, ih)
    for (let k = 0; k < 4; k++) {
      const x = ix + (iw * k) / 4
      g.fillStyle = rnd() > 0.5 ? `rgba(255,255,255,${0.03 + rnd() * 0.04})` : `rgba(0,0,0,${0.03 + rnd() * 0.05})`
      g.fillRect(x, iy, iw / 4, ih)
      if (k > 0) {
        g.fillStyle = '#2a3a50'
        g.fillRect(x - 1, iy, 2, ih)
        g.fillStyle = 'rgba(190,210,230,0.35)'
        g.fillRect(x + 1, iy, 1, ih)
      }
    }
    // Rebaixo da almofada: sombra em cima e nos lados (a luz vem de cima), fio claro embaixo.
    g.fillStyle = 'rgba(20,30,45,0.55)'
    g.fillRect(ix, iy, iw, 3)
    g.fillRect(ix, iy, 2, ih)
    g.fillRect(ix + iw - 2, iy, 2, ih)
    g.fillStyle = 'rgba(200,215,235,0.35)'
    g.fillRect(ix, iy + ih - 2, iw, 2)
    g.fillStyle = 'rgba(15,22,32,0.6)'
    g.fillRect(x0, 0, 2, A)
    g.fillRect(x0 + L / 2 - 2, 0, 2, A)
  }
  // Veio da madeira por baixo da tinta.
  g.strokeStyle = '#1d2836'
  for (let i = 0; i < 160; i++) {
    const x = rnd() * L
    g.globalAlpha = 0.03 + rnd() * 0.06
    g.lineWidth = 0.6 + rnd() * 1.4
    g.beginPath()
    g.moveTo(x, 0)
    for (let y = 0; y <= A; y += 16) g.lineTo(x + Math.sin(y / 40 + i) * 1.5, y)
    g.stroke()
  }
  g.globalAlpha = 1
  desenharEmblema(g, L)
  // Desgaste por cima de tudo: lascas de tinta, escorridos do alto, sujeira subindo do chão.
  for (let k = 0; k < 70; k++) {
    const x = rnd() * L
    const y = A * (0.25 + 0.75 * Math.sqrt(rnd()))
    const r = 1.5 + rnd() * 4
    g.fillStyle = rnd() > 0.45 ? `rgba(168,164,152,${0.5 + rnd() * 0.4})` : `rgba(58,46,34,${0.5 + rnd() * 0.4})`
    g.beginPath()
    g.moveTo(x + r, y)
    for (let s = 1; s < 6; s++) g.lineTo(x + Math.cos(s * 1.26) * r * (0.5 + rnd()), y + Math.sin(s * 1.26) * r * (0.5 + rnd()))
    g.fill()
  }
  for (let k = 0; k < 9; k++) {
    const x = rnd() * L
    const comprimento = 60 + rnd() * 160
    const grd = g.createLinearGradient(0, 20, 0, 20 + comprimento)
    grd.addColorStop(0, 'rgba(20,26,30,0.3)')
    grd.addColorStop(1, 'rgba(20,26,30,0)')
    g.fillStyle = grd
    g.fillRect(x, 20, 2 + rnd() * 5, comprimento)
  }
  const sujeira = g.createLinearGradient(0, A, 0, A * 0.8)
  sujeira.addColorStop(0, 'rgba(28,24,18,0.6)')
  sujeira.addColorStop(1, 'rgba(28,24,18,0)')
  g.fillStyle = sujeira
  g.fillRect(0, A * 0.8, L, A * 0.2)
  granular(g, L, A, rnd, 26)
  return new THREE.CanvasTexture(canvas)
}

/**
 * O emblema da imagem: duas asas em arco que se encontram na haste do meio
 * (sobre o encontro das folhas) e duas luas em gancho ligadas por uma barra.
 * Coordenadas no canvas de 384×576 (imagem de referência × 2,56).
 */
function desenharEmblema(g: CanvasRenderingContext2D, L: number) {
  const cor = '#22397a'
  g.fillStyle = cor
  g.strokeStyle = cor
  // Asas: pinceladas que engrossam no alto e afinam na ponta de fora.
  for (const espelho of [false, true]) {
    const px = (x: number) => (espelho ? L - x : x)
    const p = [
      [16, 276],
      [44, 150],
      [150, 142],
      [190, 238],
    ]
    for (let i = 0; i <= 140; i++) {
      const s = i / 140
      const u = 1 - s
      const x = u * u * u * p[0][0] + 3 * u * u * s * p[1][0] + 3 * u * s * s * p[2][0] + s * s * s * p[3][0]
      const y = u * u * u * p[0][1] + 3 * u * u * s * p[1][1] + 3 * u * s * s * p[2][1] + s * s * s * p[3][1]
      const r = s < 0.45 ? 1.2 + 6.8 * easeOutCubic(s / 0.45) : 8 - 4.8 * ((s - 0.45) / 0.55)
      g.beginPath()
      g.arc(px(x), y, r, 0, Math.PI * 2)
      g.fill()
    }
  }
  // Haste no encontro das folhas, com ponta embaixo.
  g.beginPath()
  g.moveTo(L / 2 - 3.5, 200)
  g.lineTo(L / 2 + 3.5, 200)
  g.lineTo(L / 2 + 3.5, 312)
  g.lineTo(L / 2, 330)
  g.lineTo(L / 2 - 3.5, 312)
  g.fill()
  // Barra entre as luas, levemente arqueada.
  g.lineWidth = 5
  g.beginPath()
  g.moveTo(126, 258)
  g.quadraticCurveTo(L / 2, 246, L - 126, 258)
  g.stroke()
  // Luas: disco menos um disco deslocado para fora (a abertura olha para longe da haste).
  const lua = document.createElement('canvas')
  lua.width = lua.height = 72
  const gl = lua.getContext('2d')
  if (!gl) return
  for (const [cx, abre] of [
    [110, -1],
    [L - 110, 1],
  ] as const) {
    gl.globalCompositeOperation = 'source-over'
    gl.clearRect(0, 0, 72, 72)
    gl.fillStyle = cor
    gl.beginPath()
    gl.arc(36, 36, 31, 0, Math.PI * 2)
    gl.fill()
    gl.globalCompositeOperation = 'destination-out'
    gl.beginPath()
    gl.arc(36 + abre * 13, 34, 27, 0, Math.PI * 2)
    gl.fill()
    g.drawImage(lua, cx - 36, 256 - 36)
  }
}

/** Pedra clara da moldura, manchada e com trincas finas. */
function texturaDePedraClara(THREE: ThreeModule, seed: number): Three.CanvasTexture {
  const [canvas, g] = tela(256, 256)
  const rnd = semente(seed)
  g.fillStyle = '#9fb1c5'
  g.fillRect(0, 0, 256, 256)
  granular(g, 256, 256, rnd, 34)
  manchas(g, 256, 256, rnd, 18, [12, 50], 'rgba(30,36,44,0.28)')
  g.strokeStyle = 'rgba(30,34,40,0.55)'
  g.lineWidth = 1
  for (let k = 0; k < 6; k++) {
    let x = rnd() * 256
    let y = rnd() * 256
    g.beginPath()
    g.moveTo(x, y)
    for (let s = 0; s < 7; s++) {
      x += (rnd() - 0.5) * 18
      y += rnd() * 14
      g.lineTo(x, y)
    }
    g.stroke()
  }
  return repetida(THREE, canvas)
}

/** Reboco escuro, frio, com escorridos de umidade. */
function texturaDeParede(THREE: ThreeModule, seed: number): Three.CanvasTexture {
  const [canvas, g] = tela(256, 256)
  const rnd = semente(seed)
  g.fillStyle = '#1a2028'
  g.fillRect(0, 0, 256, 256)
  granular(g, 256, 256, rnd, 18)
  manchas(g, 256, 256, rnd, 14, [30, 90], 'rgba(5,6,8,0.4)')
  for (let k = 0; k < 12; k++) {
    const grd = g.createLinearGradient(0, 0, 0, 256)
    grd.addColorStop(0, 'rgba(6,8,10,0.35)')
    grd.addColorStop(1, 'rgba(6,8,10,0)')
    g.fillStyle = grd
    g.fillRect(rnd() * 256, 0, 2 + rnd() * 6, 256)
  }
  return repetida(THREE, canvas)
}

/** Lajes de pedra (2×2 por ladrilho), cada uma num tom, com juntas escuras. */
function texturaDeLajes(THREE: ThreeModule, seed: number): Three.CanvasTexture {
  const [canvas, g] = tela(256, 256)
  const rnd = semente(seed)
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const tom = 44 + Math.round(rnd() * 14)
      g.fillStyle = `rgb(${tom},${tom + 3},${tom + 7})`
      g.fillRect(i * 128, j * 128, 128, 128)
    }
  }
  granular(g, 256, 256, rnd, 30)
  manchas(g, 256, 256, rnd, 16, [14, 60], 'rgba(0,0,0,0.35)')
  g.fillStyle = '#121417'
  for (const p of [0, 128]) {
    g.fillRect(p, 0, 3, 256)
    g.fillRect(0, p, 256, 3)
  }
  return repetida(THREE, canvas)
}

// ---------------------------------------------------------------------------
// Quadro de tela cheia: amplia a imagem pequena, cor de 15 bits com pontilhado
// ---------------------------------------------------------------------------

const VERTICE_DO_QUADRO = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

/**
 * Amostra o texel da imagem pequena (sem suavizar), converte para a cor da
 * tela como o three faria direto no canvas (`linearToOutputTexel`), passa um
 * granulado leve e multiplicativo (o preto continua preto) e reduz a 5 bits
 * por canal com a matriz de Bayer 4×4, alinhada aos pixels grandes.
 */
const FRAGMENTO_DO_QUADRO = /* glsl */ `
uniform sampler2D tCena;
uniform vec2 uResolucao;
uniform float uTempo;
varying vec2 vUv;

float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float acaso(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  vec2 px = floor(vUv * uResolucao);
  vec4 cor = linearToOutputTexel(texture2D(tCena, (px + 0.5) / uResolucao));
  float grao = acaso(px + floor(uTempo * 12.0) * 7.31) - 0.5;
  vec3 c = cor.rgb * (1.0 + grao * 0.14);
  c = floor(c * 31.0 + bayer4(px)) / 31.0;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`

// ---------------------------------------------------------------------------
// Som (Web Audio, sintetizado: nada de arquivo)
// ---------------------------------------------------------------------------

interface Rangido {
  /** Estalos por segundo no início, no meio e no fim: atrito que gruda e solta. */
  pulsos: readonly [number, number, number]
  /** [frequência, Q, ganho] de cada ressonância do material. */
  ressonancias: ReadonlyArray<readonly [number, number, number]>
  volume: number
  /** Volume aos solavancos, de ferro que não desliza liso. */
  gaguejo: boolean
}

const GEMIDO_DA_MADEIRA: Rangido = { pulsos: [12, 18, 14], ressonancias: [[260, 6, 4], [510, 8, 3]], volume: 0.45, gaguejo: false }
const RANGIDO_DO_TRANCO: Rangido = { pulsos: [30, 55, 36], ressonancias: [[780, 14, 5], [1350, 18, 4], [2400, 22, 3]], volume: 0.5, gaguejo: false }
const RANGIDO_DA_ABERTURA: Rangido = { pulsos: [18, 34, 11], ressonancias: [[520, 10, 5], [930, 14, 4.5], [1700, 18, 3]], volume: 0.55, gaguejo: true }

/**
 * Rangido = trem de estalos (dente-de-serra lenta) excitando ressonâncias
 * estreitas; a taxa dos estalos é o que faz o "iiinc" subir e descer.
 */
function rangido(kit: KitDeSom, at: number, dur: number, r: Rangido) {
  const { ctx } = kit
  const fonte = ctx.createOscillator()
  fonte.type = 'sawtooth'
  fonte.frequency.setValueAtTime(r.pulsos[0], at)
  fonte.frequency.linearRampToValueAtTime(r.pulsos[1], at + dur * 0.45)
  fonte.frequency.linearRampToValueAtTime(r.pulsos[2], at + dur)
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 6.5
  const lfoGanho = ctx.createGain()
  lfoGanho.gain.value = r.pulsos[1] * 0.18
  lfo.connect(lfoGanho).connect(fonte.frequency)
  const env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, at)
  env.gain.exponentialRampToValueAtTime(r.volume, at + Math.min(0.12, dur * 0.2))
  env.gain.setValueAtTime(r.volume, at + dur * 0.75)
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  for (const [freq, q, ganho] of r.ressonancias) {
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = freq
    bp.Q.value = q
    const g = ctx.createGain()
    g.gain.value = ganho
    fonte.connect(bp).connect(g).connect(env)
  }
  const fim = at + dur + 0.05
  if (r.gaguejo) {
    const trem = ctx.createGain()
    trem.gain.value = 0.65
    const mod = ctx.createOscillator()
    mod.type = 'square'
    mod.frequency.value = 3.2
    const modGanho = ctx.createGain()
    modGanho.gain.value = 0.35
    mod.connect(modGanho).connect(trem.gain)
    env.connect(trem).connect(kit.destino)
    mod.start(at)
    mod.stop(fim)
  } else {
    env.connect(kit.destino)
  }
  fonte.start(at)
  lfo.start(at)
  fonte.stop(fim)
  lfo.stop(fim)
}

/** Baque surdo: corpo grave que despenca, impacto abafado e ferragem chacoalhando. */
function baque(kit: KitDeSom, at: number, forca: number) {
  const { ctx } = kit
  const corpo = ctx.createOscillator()
  corpo.frequency.setValueAtTime(70, at)
  corpo.frequency.exponentialRampToValueAtTime(34, at + 0.4)
  const gc = ctx.createGain()
  gc.gain.setValueAtTime(0.0001, at)
  gc.gain.exponentialRampToValueAtTime(0.8 * forca, at + 0.012)
  gc.gain.exponentialRampToValueAtTime(0.0001, at + 0.75)
  corpo.connect(gc).connect(kit.destino)
  corpo.start(at)
  corpo.stop(at + 0.8)
  const impacto = ctx.createBufferSource()
  impacto.buffer = kit.ruido(0.3)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 240
  const gi = ctx.createGain()
  gi.gain.setValueAtTime(0.9 * forca, at)
  gi.gain.exponentialRampToValueAtTime(0.0001, at + 0.28)
  impacto.connect(lp).connect(gi).connect(kit.destino)
  impacto.start(at)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 2300
  bp.Q.value = 5
  bp.connect(kit.destino)
  for (let k = 0; k < 6; k++) {
    const quando = at + 0.03 + k * 0.045 + (k % 2) * 0.012
    const estalo = ctx.createBufferSource()
    estalo.buffer = kit.ruido(0.05)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.5 * forca * (1 - k / 7), quando)
    g.gain.exponentialRampToValueAtTime(0.0001, quando + 0.035)
    estalo.connect(g).connect(bp)
    estalo.start(quando)
  }
}

/** Poeira e areia escorrendo do arco: chiado agudo e baixo. */
function areia(kit: KitDeSom, at: number, dur: number, volume: number) {
  const { ctx } = kit
  const s = ctx.createBufferSource()
  s.buffer = kit.ruido(dur)
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 3200
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(volume, at + 0.15)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  s.connect(hp).connect(g).connect(kit.destino)
  s.start(at)
}

/** Fundo: ronco grave e contínuo do lugar vazio. */
function ambiente(kit: KitDeSom, at: number, dur: number) {
  const { ctx } = kit
  const s = ctx.createBufferSource()
  s.buffer = kit.ruido(2)
  s.loop = true
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 180
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(0.16, at + 1.2)
  g.gain.setValueAtTime(0.16, at + dur - 1)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  s.connect(lp).connect(g).connect(kit.destino)
  s.start(at)
  s.stop(at + dur + 0.1)
}

/** Passo em pedra: baque grave da sola e um raspado. `eco` = já do lado de dentro, no escuro. */
function passo(kit: KitDeSom, at: number, volume: number, eco: boolean) {
  const { ctx } = kit
  const saida = ctx.createGain()
  saida.connect(kit.destino)
  if (eco) {
    const atraso = ctx.createDelay(1)
    atraso.delayTime.value = 0.14
    const volta = ctx.createGain()
    volta.gain.value = 0.32
    const abafa = ctx.createBiquadFilter()
    abafa.type = 'lowpass'
    abafa.frequency.value = 900
    saida.connect(atraso).connect(abafa).connect(volta).connect(atraso)
    volta.connect(kit.destino)
  }
  const s = ctx.createBufferSource()
  s.buffer = kit.ruido(0.2)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 420
  const g = ctx.createGain()
  g.gain.setValueAtTime(volume, at)
  g.gain.exponentialRampToValueAtTime(0.001, at + 0.16)
  s.connect(lp).connect(g).connect(saida)
  s.start(at)
  const raspa = ctx.createBufferSource()
  raspa.buffer = kit.ruido(0.08)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1800
  bp.Q.value = 2
  const gr = ctx.createGain()
  gr.gain.setValueAtTime(volume * 0.35, at + 0.01)
  gr.gain.exponentialRampToValueAtTime(0.001, at + 0.07)
  raspa.connect(bp).connect(gr).connect(saida)
  raspa.start(at + 0.01)
}
