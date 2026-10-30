/*
 * Judge v2, "modelo pronto": o juiz montado na ave, feito a partir de modelos 3D livres.
 *  - cavaleiro: "Knight", de Dawid2K (CC-BY 3.0), com esqueleto de 31 ossos
 *  - ave: "Hawk Lp Rigged", de Sherkiz (CC-BY 3.0), com esqueleto de 58 ossos
 *  - couraça com ombreiras: "Armor Metal", de Quaternius (CC0)
 * Os créditos completos estão no README.md desta pasta.
 *
 * Tudo o que muda está aqui, em three.js: a pose sai dos ossos (o juiz sentado, o braço que
 * ergue o cartão, as asas meio abertas, as pernas da ave no chão, a respiração), e o que faltava
 * é desenhado por cima: chifres, capa com dobras, cartão vermelho com brilho, elmo da ave,
 * rédeas, manta da sela e penas fofas no peito e nas pernas.
 *
 * Script clássico (abre por file://): usa os globais THREE, JudgeGLTFLoader e JudgeModelosGLB
 * (os .glb em base64, de modelos-embutidos.js) e publica window.JudgeModelo.
 *
 * Unidade: 1 = uma casa da grade. Os pés ficam em y = 0 e a frente olha para +Z
 * (no mapa, o sul, de frente para a câmera).
 */
(function () {
  'use strict'
  const T = THREE

  // ---------------- medidas e pose (ajustadas olhando a pintura) ----------------
  const ESCALA_AVE = 0.58 // casas por unidade do falcão
  const ESCALA_CAV = 0.305 // casas por unidade do cavaleiro (de pé ele teria 1,4 casa)
  const PERNA_AVE = 1.6 // pernas da ave mais longas e grossas que as do falcão original
  const INCLINACAO_AVE = 0.3 // rad: o peito da ave sobe, como um grifo pousado
  // asas (lado esquerdo; o direito espelha x): para onde aponta cada segmento e para onde caem as penas
  const ASA_UMERO = [0.85, 0.35, -0.4]
  const ASA_ANTEBRACO = [0.85, 0.42, -0.3]
  const ASA_MAO = [0.62, 0.68, -0.38]
  const ASA_FUGA = [0.2, -0.8, -0.55]
  // pescoço longo como o da pintura: os ossos se afastam (estica a pele) em vez de crescer tudo junto,
  // que inflava o peito numa bola
  const PESCOCO_AVE = 1.3 // grossura
  const ESTICAR_PESCOCO = 2.4
  const ESTICAR_NUCA = 1.6
  const CABECA_AVE = 1.0 // (relativo ao pescoço: a cabeça fica 1,3 vez a do falcão)
  const SELA_ACIMA = 0.3 // da coluna da ave até o assento, em unidades do falcão
  const SELA_FRENTE = 0.05 // 0 = meio do lombo, 1 = base do pescoço
  const PERIODO_RESPIRO_S = 4
  const ALTURA_SURGIR = 3.2

  const COR = {
    aco: 0xc3cad5,
    acoEscuro: 0x7d8695,
    latao: 0xc9a35c,
    capa: 0x2d58b0,
    capaBrilho: 0x9db8ff,
    couro: 0x3b2619,
    chifre: 0x8a8174, // chifre escuro, cinza de pedra, como na pintura
    chifrePonta: 0x2e2924,
    cartao: 0xd8322c,
    pena: [0x5c3d28, 0x6e4a31, 0x80583a, 0x93683f, 0xa77d52, 0x4e3322],
  }

  const X = new T.Vector3(1, 0, 0)
  const Y = new T.Vector3(0, 1, 0)
  const Z = new T.Vector3(0, 0, 1)
  const dir = (x, y, z) => new T.Vector3(x, y, z).normalize()

  // temporários (nada aloca por quadro)
  const _a = new T.Vector3()
  const _b = new T.Vector3()
  const _c = new T.Vector3()
  const _v = new T.Vector3()
  const _q = new T.Quaternion()
  const _qPai = new T.Quaternion()
  const _qM = new T.Quaternion()
  const _m = new T.Matrix4()

  // ---------------- carregar os .glb embutidos ----------------
  let modelos = null

  function b64ParaBuffer(b64) {
    const bin = atob(b64)
    const u = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i)
    return u.buffer
  }

  function lerGLB(nome) {
    const b64 = window.JudgeModelosGLB && window.JudgeModelosGLB[nome]
    if (!b64) return Promise.reject(new Error(`O modelo "${nome}" não veio em modelos-embutidos.js.`))
    return new Promise((ok, erro) => new window.JudgeGLTFLoader().parse(b64ParaBuffer(b64), '', ok, erro))
  }

  async function preparar() {
    if (modelos) return modelos
    const [cavaleiro, ave, armadura] = await Promise.all([lerGLB('cavaleiro'), lerGLB('ave'), lerGLB('armadura')])
    modelos = { cavaleiro, ave, armadura }
    return modelos
  }

  // ---------------- ossos: girar no espaço do modelo ----------------
  function ossosPorNome(raiz) {
    const r = {}
    raiz.traverse((o) => {
      if (o.isBone) {
        r[o.name] = o
        o.userData.q0 = o.quaternion.clone()
        o.userData.p0 = o.position.clone()
        o.userData.s0 = o.scale.clone()
      }
    })
    return r
  }

  /** Gira o osso por qMundo (no espaço do modelo, com a raiz parada na origem), sem mover a origem dele. */
  function girarMundo(osso, qMundo) {
    osso.parent.getWorldQuaternion(_qPai)
    _q.copy(_qPai).invert().multiply(qMundo).multiply(_qPai)
    osso.quaternion.premultiply(_q)
    osso.updateMatrixWorld(true)
  }

  function girar(osso, eixo, angulo) {
    if (Math.abs(angulo) < 1e-6) return
    _qM.setFromAxisAngle(eixo, angulo)
    girarMundo(osso, _qM)
  }

  /** Aponta o segmento osso -> filho para a direção pedida (vetor unitário no espaço do modelo). */
  function mirar(osso, filho, direcao) {
    osso.getWorldPosition(_a)
    filho.getWorldPosition(_b)
    _v.subVectors(_b, _a)
    if (_v.lengthSq() < 1e-10) return
    _v.normalize()
    _qM.setFromUnitVectors(_v, direcao)
    girarMundo(osso, _qM)
  }

  const _e = new T.Vector3()
  const _r = new T.Vector3()
  const _l = new T.Vector3()
  /** Gira o osso em volta do próprio eixo (osso -> filho) até a ref, um osso abaixo dele, ficar do lado do alvo. */
  function torcer(osso, filho, ref, alvo) {
    osso.getWorldPosition(_a)
    filho.getWorldPosition(_e)
    _e.sub(_a).normalize()
    ref.getWorldPosition(_r)
    _r.sub(_a).addScaledVector(_e, -_r.dot(_e))
    _l.copy(alvo).addScaledVector(_e, -alvo.dot(_e))
    if (_r.lengthSq() < 1e-10 || _l.lengthSq() < 1e-10) return
    _r.normalize()
    _l.normalize()
    girar(osso, _e, Math.atan2(_v.crossVectors(_r, _l).dot(_e), _r.dot(_l)))
  }

  /** Direção entre a e b que gira pelo caminho mais curto (o braço sobe pela frente). */
  function entreDirecoes(a, b, t, alvo) {
    _qM.setFromUnitVectors(a, b)
    _q.identity().slerp(_qM, t)
    return alvo.copy(a).applyQuaternion(_q)
  }

  // ---------------- geometrias que faltavam ----------------
  /** Tubo afinado ao longo de uma curva, com cor que escurece na ponta. */
  function tuboAfinado(pontos, raioBase, raioPonta, segs, lados, corBase, corPonta) {
    const curva = new T.CatmullRomCurve3(pontos)
    const geo = new T.TubeGeometry(curva, segs, 1, lados, false)
    const pos = geo.attributes.position
    const cores = new Float32Array(pos.count * 3)
    const ca = new T.Color(corBase)
    const cb = new T.Color(corPonta)
    const tmp = new T.Color()
    const centro = new T.Vector3()
    for (let i = 0; i <= segs; i++) {
      const t = i / segs
      curva.getPointAt(t, centro)
      const r = raioBase + (raioPonta - raioBase) * Math.pow(t, 0.8)
      tmp.copy(ca).lerp(cb, T.MathUtils.smoothstep(t, 0.55, 1))
      for (let j = 0; j <= lados; j++) {
        const k = i * (lados + 1) + j
        _v.fromBufferAttribute(pos, k).sub(centro).multiplyScalar(r).add(centro)
        pos.setXYZ(k, _v.x, _v.y, _v.z)
        cores[k * 3] = tmp.r
        cores[k * 3 + 1] = tmp.g
        cores[k * 3 + 2] = tmp.b
      }
    }
    geo.setAttribute('color', new T.BufferAttribute(cores, 3))
    geo.computeVertexNormals()
    return geo
  }

  /** Uma pena: losango comprido, dobrado no meio (a nervura), com a ponta caída. */
  function geometriaPena() {
    const p = [
      [0, 0, 0],
      [-0.42, 0.06, 0.32],
      [0, -0.05, 0.36],
      [0.42, 0.06, 0.32],
      [0, -0.12, 1],
    ]
    const idx = [0, 1, 2, 0, 2, 3, 1, 4, 2, 2, 4, 3]
    const geo = new T.BufferGeometry()
    geo.setAttribute('position', new T.Float32BufferAttribute(p.flat(), 3))
    geo.setIndex(idx)
    geo.computeVertexNormals()
    return geo
  }

  function texturaBrilho() {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')
    const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64)
    grad.addColorStop(0, 'rgba(255, 214, 196, 1)')
    grad.addColorStop(0.18, 'rgba(255, 92, 70, 0.75)')
    grad.addColorStop(0.5, 'rgba(230, 40, 32, 0.22)')
    grad.addColorStop(1, 'rgba(200, 20, 20, 0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
    const t = new T.CanvasTexture(c)
    t.colorSpace = T.SRGBColorSpace
    return t
  }

  /** Ambiente para o metal refletir: céu frio e claro em cima, névoa no meio, chão escuro. Um por renderizador. */
  function criarAmbiente(renderer) {
    const pm = new T.PMREMGenerator(renderer)
    const cena = new T.Scene()
    const geo = new T.SphereGeometry(10, 48, 24)
    const pos = geo.attributes.position
    const cores = new Float32Array(pos.count * 3)
    const topo = new T.Color(0.62, 0.74, 1.05)
    const meio = new T.Color(0.42, 0.47, 0.56)
    const chao = new T.Color(0.06, 0.055, 0.05)
    const tmp = new T.Color()
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 10
      if (y > 0) tmp.copy(meio).lerp(topo, Math.pow(y, 0.6))
      else tmp.copy(meio).lerp(chao, Math.min(1, -y * 2.4))
      cores[i * 3] = tmp.r
      cores[i * 3 + 1] = tmp.g
      cores[i * 3 + 2] = tmp.b
    }
    geo.setAttribute('color', new T.BufferAttribute(cores, 3))
    cena.add(new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })))
    // dois "painéis" de luz: o contorno frio atrás e a luz suave da frente
    const painel = (cor, intensidade, x, y, z, lado) => {
      const m = new T.Mesh(new T.PlaneGeometry(lado, lado), new T.MeshBasicMaterial({ color: new T.Color(cor).multiplyScalar(intensidade), side: T.DoubleSide }))
      m.position.set(x, y, z)
      m.lookAt(0, 0, 0)
      cena.add(m)
    }
    painel(0xaecbff, 5, 4, 5, -6, 5)
    painel(0xfff0dc, 2.2, -5, 4, 5, 4)
    const rt = pm.fromScene(cena, 0.035)
    pm.dispose()
    geo.dispose()
    return rt.texture
  }

  // ---------------- montar a cena ----------------
  let rigUnico = null

  function criarCena() {
    if (!modelos) throw new Error('Chame JudgeModelo.preparar() antes de criarCena().')
    if (rigUnico) return rigUnico
    const cena = new T.Scene()
    const raiz = new T.Group()
    raiz.name = 'judge'
    cena.add(raiz)

    const mats = {
      aco: new T.MeshStandardMaterial({ color: COR.aco, metalness: 0.82, roughness: 0.36, envMapIntensity: 1.25, name: 'aço' }),
      acoEscuro: new T.MeshStandardMaterial({ color: COR.acoEscuro, metalness: 0.9, roughness: 0.38, name: 'aço escuro' }),
      latao: new T.MeshStandardMaterial({ color: COR.latao, metalness: 1, roughness: 0.34, name: 'latão' }),
      couro: new T.MeshStandardMaterial({ color: COR.couro, metalness: 0, roughness: 0.72, name: 'couro' }),
      chifre: new T.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, metalness: 0, roughness: 0.48, name: 'chifre' }),
      capa: new T.MeshPhysicalMaterial({ color: COR.capa, roughness: 0.8, sheen: 1, sheenColor: new T.Color(COR.capaBrilho), sheenRoughness: 0.42, side: T.DoubleSide, name: 'capa' }),
      pena: new T.MeshStandardMaterial({ color: 0xffffff, metalness: 0, roughness: 0.92, side: T.DoubleSide, name: 'pena' }),
      cartao: new T.MeshStandardMaterial({ color: COR.cartao, emissive: new T.Color(COR.cartao), emissiveIntensity: 0.15, roughness: 0.4, metalness: 0, name: 'cartão' }),
    }

    // --- ave ---
    const aveBase = new T.Group()
    aveBase.name = 'ave'
    raiz.add(aveBase)
    const ave = modelos.ave.scene
    aveBase.add(ave)
    aveBase.quaternion.setFromAxisAngle(X, -INCLINACAO_AVE).multiply(new T.Quaternion().setFromAxisAngle(Y, Math.PI))
    aveBase.scale.setScalar(ESCALA_AVE)
    const A = ossosPorNome(ave)

    // --- cavaleiro ---
    const cavBase = new T.Group()
    cavBase.name = 'cavaleiro'
    raiz.add(cavBase)
    const cav = modelos.cavaleiro.scene
    cavBase.add(cav)
    const K = ossosPorNome(cav)
    raiz.updateMatrixWorld(true)
    cav.position.sub(K.Root.getWorldPosition(new T.Vector3())) // o quadril do modelo vai para a origem
    cavBase.scale.setScalar(ESCALA_CAV)

    const peles = []
    for (const r of [ave, cav]) {
      r.traverse((o) => {
        if (o.isSkinnedMesh) {
          peles.push(o)
          o.frustumCulled = false // a caixa do modelo em repouso não vale para a pose
        }
        if (o.isMesh) o.castShadow = o.receiveShadow = false
      })
    }
    // o metal do cavaleiro brilha um pouco mais que o padrão do arquivo
    cav.traverse((o) => {
      if (o.isMesh) o.material.envMapIntensity = 1.15
    })
    // as asas do falcão são uma folha só: vistas por baixo sumiam e viravam varetas
    ave.traverse((o) => {
      if (o.isMesh) o.material.side = T.DoubleSide
    })

    const rig = {
      cena, raiz, aveBase, cavBase, A, K, peles, mats,
      ossos: Object.values(A).concat(Object.values(K)),
      ancoras: [],
      solo: 0,
      cartao: null,
      brilho: null,
      luzCartao: null,
      capa: null,
      redeas: [],
      maoR: new T.Vector3(),
      maoL: new T.Vector3(),
      ombroL: new T.Vector3(),
      ombroR: new T.Vector3(),
      nuca: new T.Vector3(),
      quadril: new T.Vector3(),
    }

    // 1) pose de base (respiração no meio, cartão baixo) para medir onde vai cada acessório
    poseOssos(rig, 0, 0, 0, 0, 0)
    // chão: o dedo mais baixo encosta em y = 0
    let minY = Infinity
    for (const nome of Object.keys(A)) if (/^t_(middle|index|ring|thumb)002/.test(nome)) minY = Math.min(minY, A[nome].getWorldPosition(_a).y)
    rig.solo = -minY + 0.015
    rig.selaBase = null // medir de novo, já com a ave no chão
    poseOssos(rig, 0, 0, 0, 0, 0)

    montarAcessorios(rig)
    montarLuzes(cena)
    posar(rig, { yaw: 0, fase: 0, cartao: 0, olharAve: 0, olharJuiz: 0, surgir: 1 })
    rig.estatisticas = contar(cena)
    rigUnico = rig
    return rig
  }

  function montarLuzes(cena) {
    // céu frio e névoa: a luz que vem de cima é azulada, a de baixo é terra
    cena.add(new T.HemisphereLight(0xb8c8f0, 0x2a2420, 0.85))
    const chave = new T.DirectionalLight(0xfff2e6, 1.7) // da frente e da esquerda, suave
    chave.position.set(-1.6, 2.8, 2.6)
    cena.add(chave)
    const contorno = new T.DirectionalLight(0x9cc0ff, 4.6) // contorno frio de trás e do alto, como na pintura
    contorno.position.set(-1.4, 3.0, -3.2)
    cena.add(contorno)
    const contorno2 = new T.DirectionalLight(0xb4ccff, 2.4)
    contorno2.position.set(2.6, 1.2, -2.4)
    cena.add(contorno2)
  }

  /** Ponto preso a um osso: segue o osso como peça rígida, a partir da pose de base. */
  function ancora(rig, osso) {
    const g = new T.Group()
    g.matrixAutoUpdate = false
    g.userData.osso = osso
    g.userData.base = osso.matrixWorld.clone().invert()
    rig.raiz.add(g)
    rig.ancoras.push(g)
    return g
  }

  function montarAcessorios(rig) {
    const { A, K, mats } = rig
    const pos = (o) => o.getWorldPosition(new T.Vector3())

    // --- chifres grandes e curvos, presos ao elmo ---
    const cabeca = ancora(rig, K.Head)
    const pCabeca = pos(K.Head)
    const pTopo = pos(K.Head_end)
    const altCabeca = pTopo.y - pCabeca.y
    for (const lado of [-1, 1]) {
      const b = new T.Vector3(pCabeca.x + lado * 0.06, pCabeca.y + altCabeca * 0.62, pCabeca.z - 0.008)
      // como na pintura: saem para o lado, sobem e a ponta vira para a frente
      const pts = [
        b.clone(),
        b.clone().add(new T.Vector3(lado * 0.08, 0.015, -0.015)),
        b.clone().add(new T.Vector3(lado * 0.16, 0.03, -0.012)),
        b.clone().add(new T.Vector3(lado * 0.225, 0.085, 0.01)),
        b.clone().add(new T.Vector3(lado * 0.245, 0.165, 0.045)),
        b.clone().add(new T.Vector3(lado * 0.215, 0.23, 0.095)),
      ]
      const chifre = new T.Mesh(tuboAfinado(pts, 0.038, 0.003, 28, 10, COR.chifre, COR.chifrePonta), mats.chifre)
      cabeca.add(chifre)
      // anel de aço onde o chifre sai do elmo
      const anel = new T.Mesh(new T.TorusGeometry(0.03, 0.009, 6, 14), mats.aco)
      anel.position.copy(b).add(new T.Vector3(lado * 0.012, 0, 0))
      anel.lookAt(anel.position.clone().add(new T.Vector3(lado, 0.15, 0)))
      cabeca.add(anel)
    }
    // crista baixa no alto do elmo
    const crista = new T.Mesh(new T.BoxGeometry(0.012, 0.03, 0.12), mats.latao)
    crista.position.set(pCabeca.x, pTopo.y - altCabeca * 0.02, pCabeca.z - 0.005)
    cabeca.add(crista)

    // --- couraça com ombreiras grandes (Quaternius), presa ao peito ---
    const peito = ancora(rig, K.Spine2)
    const armadura = modelos.armadura.scene
    armadura.traverse((o) => {
      if (o.isMesh) o.material = mats.aco
    })
    const caixaA = new T.Box3().setFromObject(armadura)
    const tamA = caixaA.getSize(new T.Vector3())
    const pOmbroL = pos(K.UpperArmL)
    const pOmbroR = pos(K.UpperArmR)
    const larguraOmbros = pOmbroL.distanceTo(pOmbroR)
    const k = (larguraOmbros * 1.62) / tamA.x
    armadura.scale.setScalar(k)
    const centroA = caixaA.getCenter(new T.Vector3()).multiplyScalar(k)
    const meioOmbros = pOmbroL.clone().add(pOmbroR).multiplyScalar(0.5)
    armadura.position.set(meioOmbros.x - centroA.x, meioOmbros.y + 0.035 - (caixaA.max.y * k), meioOmbros.z - centroA.z + 0.006)
    peito.add(armadura)

    // --- cartão vermelho com brilho (não fica preso à mão: no alto, vira para a câmera) ---
    const cartao = new T.Group()
    const folha = new T.Mesh(new T.BoxGeometry(0.12, 0.17, 0.006), mats.cartao)
    folha.position.y = 0.06
    cartao.add(folha)
    const brilho = new T.Sprite(new T.SpriteMaterial({ map: texturaBrilho(), color: 0xffffff, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0 }))
    brilho.position.y = 0.06
    brilho.scale.setScalar(0.62)
    cartao.add(brilho)
    const luzCartao = new T.PointLight(0xff3a2a, 0, 0.55, 2)
    luzCartao.position.set(0, 0.06, 0.05)
    cartao.add(luzCartao)
    rig.raiz.add(cartao)
    rig.cartao = cartao
    rig.folhaCartao = folha
    rig.brilho = brilho
    rig.luzCartao = luzCartao

    // --- elmo da ave ---
    const cabecaAve = ancora(rig, A.head)
    const pCA = pos(A.head)
    const pBico = pos(A.beak001T)
    const frente = pBico.clone().sub(pCA)
    const comp = frente.length()
    frente.normalize()
    const elmo = new T.Group()
    elmo.position.copy(pCA).addScaledVector(frente, comp * 0.18)
    elmo.quaternion.setFromUnitVectors(Z, frente)
    const casco = new T.Mesh(new T.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), mats.aco)
    casco.scale.set(comp * 0.62, comp * 0.5, comp * 0.95)
    casco.rotation.x = -0.12
    casco.position.y = comp * 0.08
    elmo.add(casco)
    const quilha = new T.Mesh(new T.BoxGeometry(comp * 0.07, comp * 0.12, comp * 1.5), mats.latao)
    quilha.position.set(0, comp * 0.56, -comp * 0.05)
    quilha.rotation.x = -0.1
    elmo.add(quilha)
    const ponta = new T.Mesh(new T.ConeGeometry(comp * 0.08, comp * 0.5, 8), mats.latao)
    ponta.position.set(0, comp * 0.62, -comp * 0.62)
    ponta.rotation.x = -1.0
    elmo.add(ponta)
    for (const lado of [-1, 1]) {
      const face = new T.Mesh(new T.CylinderGeometry(comp * 0.26, comp * 0.3, comp * 0.05, 14), mats.acoEscuro)
      face.position.set(lado * comp * 0.5, comp * 0.02, -comp * 0.08)
      face.rotation.z = Math.PI / 2
      elmo.add(face)
      const rebite = new T.Mesh(new T.SphereGeometry(comp * 0.05, 8, 6), mats.latao)
      rebite.position.set(lado * comp * 0.54, comp * 0.02, -comp * 0.08)
      elmo.add(rebite)
    }
    cabecaAve.add(elmo)
    // pontos das rédeas: nos cantos do bico, presos à cabeça da ave
    rig.bocal = [-1, 1].map((lado) => {
      const o = new T.Object3D()
      o.position.copy(pCA).addScaledVector(frente, comp * 0.62).add(new T.Vector3(lado * comp * 0.36, -comp * 0.12, 0))
      cabecaAve.add(o)
      return o
    })
    const geoCorda = new T.CylinderGeometry(1, 1, 1, 5, 1, true)
    for (let i = 0; i < 4; i++) {
      const m = new T.Mesh(geoCorda, mats.couro)
      m.frustumCulled = false
      rig.raiz.add(m)
      rig.redeas.push(m)
    }

    // --- manta da sela: pano azul com barra de latão sobre o lombo ---
    const lombo = ancora(rig, A.spine005)
    const pSela = rig.selaBase
    const geoManta = new T.PlaneGeometry(1, 1, 12, 6)
    const pm = geoManta.attributes.position
    const barraPts = [[], []]
    for (let i = 0; i < pm.count; i++) {
      const u = pm.getX(i) * 2 // -1..1, de um flanco ao outro
      const v = pm.getY(i) * 2 // -1..1, da frente para trás
      const x = u * 0.17 * (1 - 0.15 * u * u)
      const y = -0.03 - u * u * 0.2 - Math.abs(u) * 0.02 * (v + 1)
      const z = -0.02 + v * 0.16 + u * u * 0.03
      pm.setXYZ(i, pSela.x + x, pSela.y + y, pSela.z + z)
      if (Math.abs(Math.abs(u) - 1) < 1e-6) barraPts[u < 0 ? 0 : 1].push(new T.Vector3(pSela.x + x, pSela.y + y - 0.004, pSela.z + z))
    }
    geoManta.computeVertexNormals()
    lombo.add(new T.Mesh(geoManta, mats.capa))
    // barra de latão nas duas beiradas da manta
    for (const pts of barraPts) {
      pts.sort((a, b) => a.z - b.z)
      lombo.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 10, 0.008, 5, false), mats.latao))
    }

    // --- penas fofas: gola no peito e "calças" nas pernas ---
    const geoPena = geometriaPena()
    const cor = new T.Color()
    function tufo(osso, centro, raios, n, semente, comprimento, filtro, orientar) {
      const anc = ancora(rig, osso)
      const im = new T.InstancedMesh(geoPena, mats.pena, n)
      let s = semente
      const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
      const m = new T.Matrix4()
      const q = new T.Quaternion()
      const p = new T.Vector3()
      const normal = new T.Vector3()
      const sc = new T.Vector3()
      let i = 0
      let tent = 0
      while (i < n && tent < n * 40) {
        tent++
        // ponto na casca do elipsoide
        const u = rnd() * 2 - 1
        const th = rnd() * Math.PI * 2
        const r = Math.sqrt(1 - u * u)
        normal.set(r * Math.cos(th), u, r * Math.sin(th))
        if (!filtro(normal)) continue
        p.set(normal.x * raios.x, normal.y * raios.y, normal.z * raios.z).add(centro)
        const desce = orientar(normal, p)
        q.setFromUnitVectors(Z, desce)
        const l = comprimento * (0.75 + rnd() * 0.5)
        sc.set(l * 0.42, l, l)
        m.compose(p, q, sc)
        im.setMatrixAt(i, m)
        cor.setHex(COR.pena[Math.floor(rnd() * COR.pena.length)])
        im.setColorAt(i, cor)
        i++
      }
      im.count = i
      im.instanceMatrix.needsUpdate = true
      if (im.instanceColor) im.instanceColor.needsUpdate = true
      im.frustumCulled = false
      anc.add(im)
    }
    // gola: em volta da base do pescoço, as penas caem para baixo e para fora
    const pPescoco = pos(A.neck001)
    const pPeito = pos(A.spine006)
    const centroGola = pPescoco.clone().lerp(pPeito, 0.45).add(new T.Vector3(0, -0.02, 0.03))
    tufo(A.spine006, centroGola, new T.Vector3(0.17, 0.17, 0.16), 120, 7, 0.15, (n) => n.z > -0.35 && n.y < 0.75, (n) =>
      new T.Vector3(n.x * 0.6, -0.85, n.z * 0.7).normalize()
    )
    // pescoço: penas de cima, para trás, em duas camadas ao longo do pescoço esticado
    const pCabecaAve = pos(A.neck002)
    for (const [t, n, sem] of [[0.3, 40, 11], [0.72, 34, 13]]) {
      tufo(A.neck001, pPescoco.clone().lerp(pCabecaAve, t), new T.Vector3(0.085, 0.12, 0.085), n, sem, 0.11, (v) => v.z < 0.5, (v) =>
        new T.Vector3(v.x * 0.5, -0.45, -0.85).normalize()
      )
    }
    // calças: nas coxas, penas caindo sobre a canela
    for (const [coxa, canela, sem] of [[A.thighR, A.shinR, 3], [A.thighL, A.shinL, 5]]) {
      const c0 = pos(canela).lerp(pos(coxa), 0.35)
      tufo(coxa, c0, new T.Vector3(0.075, 0.09, 0.075), 30, sem, 0.12, (n) => n.y > -0.6, (n) => new T.Vector3(n.x * 0.35, -0.94, n.z * 0.35).normalize())
    }

    // --- capa longa com dobras (geometria refeita a cada quadro) ---
    const nu = 14
    const nv = 16
    const geoCapa = new T.PlaneGeometry(1, 1, nu, nv)
    const capa = new T.Mesh(geoCapa, mats.capa)
    capa.frustumCulled = false
    rig.raiz.add(capa)
    rig.capa = { malha: capa, geo: geoCapa, nu, nv }
  }

  // ---------------- pose ----------------
  /** Põe só os ossos: ave em pé, juiz sentado. s, s2: respiração; c: cartão 0..1. */
  function poseOssos(rig, s, s2, c, olharAve, olharJuiz) {
    const { raiz, A, K, aveBase, cavBase } = rig
    raiz.position.set(0, 0, 0)
    raiz.quaternion.identity()
    for (const o of rig.ossos) {
      o.quaternion.copy(o.userData.q0)
      o.position.copy(o.userData.p0)
      o.scale.copy(o.userData.s0)
    }
    aveBase.position.set(0, rig.solo, 0)
    A.thighR.scale.multiplyScalar(PERNA_AVE)
    A.thighL.scale.multiplyScalar(PERNA_AVE)
    A.neck001.scale.multiplyScalar(PESCOCO_AVE)
    A.neck002.position.multiplyScalar(ESTICAR_PESCOCO)
    A.head.position.multiplyScalar(ESTICAR_NUCA)
    A.head.scale.multiplyScalar(CABECA_AVE)
    raiz.updateMatrixWorld(true)

    // ave: peito sobe e desce devagar
    girar(A.spine004, X, -0.035 * s)
    // pescoço longo e erguido, como na pintura: a cabeça chega perto da altura do elmo do juiz
    mirar(A.neck001, A.neck002, dir(0, 0.88 + 0.03 * s2, 0.47))
    mirar(A.neck002, A.head, dir(0, 0.72, 0.69))
    mirar(A.head, A.beak001T, dir(0, -0.15 - 0.03 * s2, 0.99))
    girar(A.neck001, Y, olharAve * 0.45)
    girar(A.head, Y, olharAve * 0.55)
    // asas de grifo: abertas para os lados e para cima, com a face das penas virada para a frente
    // (de lado elas viravam duas varetas atrás do cavaleiro); abrem um pouco ao inspirar
    for (const [lado, w, w1, w2, d] of [[-1, A.WingR, A.Wing001R, A.Wing002R, 'R'], [1, A.WingL, A.Wing001L, A.Wing002L, 'L']]) {
      mirar(w, w1, dir(lado * ASA_UMERO[0], ASA_UMERO[1], ASA_UMERO[2]))
      torcer(w, w1, A['w_feather003' + d], dir(lado * ASA_FUGA[0], ASA_FUGA[1], ASA_FUGA[2]))
      mirar(w1, w2, dir(lado * ASA_ANTEBRACO[0], ASA_ANTEBRACO[1], ASA_ANTEBRACO[2]))
      mirar(w2, A['w_feather002' + d], dir(lado * ASA_MAO[0], ASA_MAO[1], ASA_MAO[2]))
      girar(w, Z, lado * 0.05 * s)
    }
    // cauda um pouco erguida
    girar(A.spine002, X, 0.16)
    // pernas: coxa para a frente, canela para baixo, pé no chão e dedos abertos
    for (const [lado, coxa, canela, pe, d] of [[-1, A.thighR, A.shinR, A.footR, 'R'], [1, A.thighL, A.shinL, A.footL, 'L']]) {
      mirar(coxa, canela, dir(lado * 0.12, -0.3, 0.95))
      mirar(canela, pe, dir(lado * 0.06, -0.93, -0.36))
      mirar(pe, A['t_middle001' + d], dir(lado * 0.02, -0.98, 0.2))
      mirar(A['t_middle001' + d], A['t_middle002' + d], dir(lado * 0.05, -0.12, 0.99))
      mirar(A['t_index001' + d], A['t_index002' + d], dir(-lado * 0.42, -0.12, 0.9))
      mirar(A['t_ring001' + d], A['t_ring002' + d], dir(lado * 0.5, -0.12, 0.86))
      mirar(A['t_thumb001' + d], A['t_thumb002' + d], dir(lado * 0.05, -0.2, -0.98))
    }

    // assento: em cima da coluna, entre o pescoço e as asas
    A.spine006.getWorldPosition(_a)
    A.neck001.getWorldPosition(_b)
    const sela = _c.copy(_a).lerp(_b, SELA_FRENTE)
    sela.y += SELA_ACIMA * ESCALA_AVE
    if (!rig.selaBase) rig.selaBase = sela.clone()

    // juiz: sentado, as pernas abertas sobre o corpo da ave
    for (const [lado, perna, joelho, pe, ponta] of [[1, K.UpperLegL, K.LowerLegL, K.FotL, K.FotL_end], [-1, K.UpperLegR, K.LowerLegR, K.FotR, K.FotR_end]]) {
      mirar(perna, joelho, dir(lado * 0.5, -0.4, 0.77))
      mirar(joelho, pe, dir(lado * 0.14, -0.78, -0.61))
      mirar(pe, ponta, dir(lado * 0.15, -0.45, 0.88))
    }
    // tronco: firme, um pouco para trás quando ergue o cartão; sobe ao inspirar
    mirar(K.Spine1, K.Spine2, dir(0, 0.995, 0.06 - 0.08 * c + 0.012 * s2))
    mirar(K.Spine2, K.Head, dir(0, 0.99, 0.08 - 0.05 * c))
    // braço esquerdo: segura as rédeas
    mirar(K.UpperArmL, K.LowerArmL, dir(0.32, -0.6, 0.72))
    mirar(K.LowerArmL, K.HandL, dir(-0.2, -0.08, 0.98))
    mirar(K.HandL, K.HandL_end, dir(-0.25, -0.35, 0.9))
    // braço direito: do quadril ao alto, varrendo pela frente
    mirar(K.UpperArmR, K.LowerArmR, entreDirecoes(dir(-0.3, -0.92, 0.25), dir(-0.2, 0.95, 0.24), c, _v.clone()))
    mirar(K.LowerArmR, K.HandR, entreDirecoes(dir(0.08, -0.55, 0.83), dir(-0.04, 0.99, 0.12), c, _v.clone()))
    mirar(K.HandR, K.HandR_end, entreDirecoes(dir(0.05, -0.8, 0.6), dir(0, 0.99, 0.1), c, _v.clone()))
    // elmo: olha para quem tem a vez antes do corpo; acompanha o cartão
    girar(K.Head, X, -0.06 * c)
    girar(K.Head, Y, olharJuiz)

    // põe o quadril do juiz no assento
    K.UpperLegL.getWorldPosition(_a)
    K.UpperLegR.getWorldPosition(_b)
    _a.add(_b).multiplyScalar(0.5)
    cavBase.position.add(sela).sub(_a)
    cavBase.updateMatrixWorld(true)
  }

  // em repouso o cartão pende da mão, rente à perna: comprimento para baixo, face para fora
  const QUAT_CARTAO_BAIXO = new T.Quaternion().setFromRotationMatrix(
    new T.Matrix4().makeBasis(new T.Vector3(0, 0, -1), new T.Vector3(0, -1, 0), new T.Vector3(-1, 0, 0))
  )
  const QUAT_CARTAO_ALTO = new T.Quaternion().setFromEuler(new T.Euler(-0.28, 0, 0))

  /**
   * Põe o rig numa pose. Determinística: a mesma pose dá a mesma imagem, então o 3D ao vivo,
   * a vista grande e os quadros fotografados saem da mesma função.
   * p = { yaw, fase 0..1 (respiração), cartao 0..1, olharAve, olharJuiz (rad), surgir 0..1,
   *       quatCamera? (no alto, o cartão vira para essa orientação; padrão: de frente para a mesa) }
   */
  function posar(rig, p) {
    const s = Math.sin(2 * Math.PI * p.fase)
    const s2 = Math.sin(2 * Math.PI * p.fase - 0.7)
    const c = p.cartao
    poseOssos(rig, s, s2, c, p.olharAve, p.olharJuiz)

    // âncoras: cada acessório segue o osso dele como peça rígida
    for (const g of rig.ancoras) {
      g.matrix.multiplyMatrices(g.userData.osso.matrixWorld, g.userData.base)
      g.matrixWorldNeedsUpdate = true
    }
    // pontos medidos ainda com a raiz na origem (espaço do modelo)
    rig.K.HandR_end.getWorldPosition(rig.maoR)
    rig.K.HandL.getWorldPosition(rig.maoL).lerp(rig.K.HandL_end.getWorldPosition(_a), 0.5)
    rig.K.UpperArmL.getWorldPosition(rig.ombroL)
    rig.K.UpperArmR.getWorldPosition(rig.ombroR)
    rig.K.Head.getWorldPosition(rig.nuca)
    moldarCapa(rig, p.fase, c)
    rig.raiz.updateMatrixWorld(true)
    moverRedeas(rig, s2)

    // raiz: para onde olha e quanto já saiu do token
    rig.raiz.rotation.set(0, p.yaw, 0)
    rig.raiz.position.set(0, -(1 - p.surgir) * ALTURA_SURGIR, 0)
    rig.raiz.updateMatrixWorld(true)

    // cartão: na mão, deitado; no alto, de pé e virado para quem olha
    const k = T.MathUtils.smoothstep(c, 0.25, 0.9)
    const qRaiz = rig.raiz.getWorldQuaternion(_qPai)
    const qBaixo = _q.copy(qRaiz).multiply(QUAT_CARTAO_BAIXO)
    const qAlto = p.quatCamera || _qM.copy(QUAT_CARTAO_ALTO)
    qBaixo.slerp(qAlto, k)
    rig.cartao.quaternion.copy(qRaiz.invert().multiply(qBaixo))
    rig.cartao.position.copy(rig.maoR)
    rig.mats.cartao.emissiveIntensity = 0.15 + 1.1 * k
    rig.brilho.material.opacity = 0.9 * k
    rig.brilho.visible = k > 0.01
    rig.luzCartao.intensity = 0.9 * k
    rig.raiz.updateMatrixWorld(true)
    for (const m of rig.peles) m.skeleton.update()
  }

  /** Capa: presa nos ombros, cai para trás sobre o lombo da ave e escorre pelos flancos. */
  function moldarCapa(rig, fase, c) {
    const { geo, nu, nv } = rig.capa
    const pos = geo.attributes.position
    const onda = 2 * Math.PI * fase
    const meio = _a.copy(rig.ombroL).add(rig.ombroR).multiplyScalar(0.5)
    const largura = rig.ombroL.distanceTo(rig.ombroR)
    // começa atrás da nuca, um pouco abaixo dos ombros
    const topoY = meio.y + 0.005
    const topoZ = meio.z - 0.06
    const comprimento = 0.86
    let n = 0
    for (let j = 0; j <= nv; j++) {
      const t = j / nv
      // linha do meio: para trás sobre o lombo e depois caindo junto à cauda
      const cz = topoZ - comprimento * (0.7 * t - 0.12 * t * t) + 0.04 * c * t
      const cy = topoY - comprimento * (0.3 * t + 0.5 * t * t)
      const meia = largura * (0.6 + 0.5 * t)
      for (let i = 0; i <= nu; i++) {
        const u = (i / nu) * 2 - 1
        // escorre pelos flancos: as beiradas descem mais
        const flanco = u * u * t * 0.42
        const dobra = Math.sin(u * Math.PI * 3.2 + 0.5) * 0.03 * (0.25 + t)
        const vento = Math.sin(onda - t * 2.4 + u * 0.7) * 0.018 * t
        const x = meio.x + u * meia * (1 - 0.1 * t * u * u)
        const y = cy - flanco + vento * 0.5
        const z = cz + Math.abs(u) * 0.05 * t + dobra + vento - u * u * 0.06 * t
        pos.setXYZ(n++, x, y, z)
      }
    }
    pos.needsUpdate = true
    geo.computeVertexNormals()
  }

  /** Rédeas: do bocal da ave até a mão esquerda, com uma barriga no meio. */
  function moverRedeas(rig, s2) {
    const mao = rig.maoL
    const r = 0.0065
    rig.bocal.forEach((ponto, i) => {
      ponto.getWorldPosition(_b)
      const meio = _c.copy(_b).lerp(mao, 0.5)
      meio.y -= 0.05 + 0.006 * s2
      segmento(rig.redeas[i * 2], _b, meio, r)
      segmento(rig.redeas[i * 2 + 1], meio, mao, r)
    })
  }

  function segmento(malha, a, b, r) {
    _v.subVectors(b, a)
    const l = _v.length()
    malha.position.copy(a).addScaledVector(_v, 0.5)
    malha.quaternion.setFromUnitVectors(Y, _v.normalize())
    malha.scale.set(r, l, r)
  }

  /** Peças desenhadas (cada malha = 1 chamada de desenho) e triângulos. */
  function contar(cena) {
    let chamadas = 0
    let triangulos = 0
    let bytes = 0
    const vistas = new Set()
    cena.traverse((o) => {
      if (!o.isMesh || !o.visible) return
      chamadas++
      const g = o.geometry
      const n = o.isInstancedMesh ? o.count : 1
      triangulos += ((g.index ? g.index.count : g.attributes.position.count) / 3) * n
      if (!vistas.has(g)) {
        vistas.add(g)
        for (const nome in g.attributes) bytes += g.attributes[nome].array.byteLength
        if (g.index) bytes += g.index.array.byteLength
      }
    })
    return { chamadas, triangulos: Math.round(triangulos), bytes }
  }

  window.JudgeModelo = { preparar, criarCena, posar, criarAmbiente, PERIODO_RESPIRO_S, ALTURA_SURGIR, COR }
})()
