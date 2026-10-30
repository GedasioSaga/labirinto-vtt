/*
 * Judge: o avatar do mestre, um juiz de armadura montado numa ave grande.
 * Feito do zero com primitivas do three.js (esfera, cone, cilindro, tubo afinado,
 * lençol da capa). Nenhuma arte ou malha foi tirada de jogo.
 *
 * Script clássico (abre por file://): usa o global THREE e publica window.JudgeModelo.
 *
 * Unidade: 1 = uma casa da grade. Os pés ficam em y = 0, a frente do modelo olha
 * para +Z (que no mapa é o sul, de frente para a câmera). Altura total ~2,9 casas,
 * que na vista 3/4 (câmera a 30 graus) dá umas 2,5 casas na tela.
 */
(function () {
  'use strict'
  const T = THREE

  // Cores contidas, perto do Meio-Termo: nada neon, contorno sai da própria cor.
  const COR = {
    pena: 0xecc45c,
    penaClara: 0xf5e2a4,
    penaPonta: 0xdf8a48,
    bico: 0xe4954a,
    bicoEscuro: 0xb86a34,
    perna: 0xd9a35e,
    garra: 0x4f4034,
    olho: 0x2b2420,
    brilho: 0xfffaf0,
    prata: 0xc9d0d9,
    prataEscura: 0x8d97a6,
    latao: 0xc9a356,
    capa: 0x43639a,
    capaDentro: 0x2b4170,
    cota: 0x4d5566,
    couro: 0x7c4a33,
    chifre: 0xe2d6bb,
    chifrePonta: 0x6f6050,
    visor: 0x1c222c,
    cartao: 0xd2433d,
  }

  const DETALHE = {
    // icosaedro facetado: o "low-poly"; esferas lisas nos outros dois
    lowpoly: { esfera: 'ico', cil: 6, tubo: [7, 5], capa: [6, 7], extras: 0, cartao: 1.3 },
    sprite: { esfera: [14, 10], cil: 10, tubo: [8, 7], capa: [6, 7], extras: 0, cartao: 1.6 },
    detalhado: { esfera: [30, 22], cil: 22, tubo: [16, 12], capa: [16, 18], extras: 1, cartao: 1.2 },
  }

  const PERIODO_RESPIRO_S = 3.6
  const Y = new T.Vector3(0, 1, 0)
  const Z = new T.Vector3(0, 0, 1)
  const v3 = (x, y, z) => new T.Vector3(x, y, z)

  let rampaToon = null
  function rampa() {
    if (!rampaToon) {
      rampaToon = new T.DataTexture(new Uint8Array([96, 170, 236]), 3, 1, T.RedFormat)
      rampaToon.minFilter = T.NearestFilter
      rampaToon.magFilter = T.NearestFilter
      rampaToon.generateMipmaps = false
      rampaToon.needsUpdate = true
    }
    return rampaToon
  }

  /** Céu falso para o metal do detalhado refletir (o three converte por renderer). */
  function texturaDeAmbiente() {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 128
    const g = c.getContext('2d')
    const ceu = g.createLinearGradient(0, 0, 0, 128)
    ceu.addColorStop(0, '#fff6e6')
    ceu.addColorStop(0.42, '#c9d2dc')
    ceu.addColorStop(0.55, '#7b8594')
    ceu.addColorStop(1, '#2e2a27')
    g.fillStyle = ceu
    g.fillRect(0, 0, 256, 128)
    const janela = g.createRadialGradient(70, 30, 2, 70, 30, 34)
    janela.addColorStop(0, 'rgba(255,255,255,0.95)')
    janela.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = janela
    g.fillRect(0, 0, 256, 128)
    const tex = new T.CanvasTexture(c)
    tex.mapping = T.EquirectangularReflectionMapping
    tex.colorSpace = T.SRGBColorSpace
    return tex
  }

  /** Tubo com raio que afina (chifre, pescoço). Normais para fora, sem tampa. */
  function geoTubo(pontos, r0, r1, nComp, nRadial, cores) {
    const curva = new T.CatmullRomCurve3(pontos)
    const frames = curva.computeFrenetFrames(nComp, false)
    const pos = []
    const cor = []
    const idx = []
    const ca = cores ? new T.Color(cores[0]) : null
    const cb = cores ? new T.Color(cores[1]) : null
    const tmp = new T.Color()
    for (let i = 0; i <= nComp; i++) {
      const t = i / nComp
      const p = curva.getPointAt(t)
      const r = r0 + (r1 - r0) * Math.pow(t, 0.85)
      const n = frames.normals[i]
      const b = frames.binormals[i]
      if (cores) tmp.copy(ca).lerp(cb, T.MathUtils.smoothstep(t, cores[2], 1))
      for (let j = 0; j <= nRadial; j++) {
        const a = (j / nRadial) * Math.PI * 2
        const cx = Math.cos(a)
        const sy = Math.sin(a)
        pos.push(p.x + r * (cx * n.x + sy * b.x), p.y + r * (cx * n.y + sy * b.y), p.z + r * (cx * n.z + sy * b.z))
        if (cores) cor.push(tmp.r, tmp.g, tmp.b)
      }
    }
    for (let i = 0; i < nComp; i++) {
      for (let j = 0; j < nRadial; j++) {
        const a = i * (nRadial + 1) + j
        const b = a + nRadial + 1
        idx.push(a, a + 1, b, b, a + 1, b + 1)
      }
    }
    const g = new T.BufferGeometry()
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3))
    if (cores) g.setAttribute('color', new T.Float32BufferAttribute(cor, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
  }

  /** Monta o Judge num estilo. Devolve a cena (com luz) e o "rig" para posar. */
  function criarCena(estilo) {
    const d = DETALHE[estilo]
    const extras = d.extras > 0
    const mats = new Map()

    function mat(cor, tipo) {
      const chave = cor + ':' + (tipo || '')
      if (mats.has(chave)) return mats.get(chave)
      let m
      const metal = tipo === 'metal'
      if (estilo === 'lowpoly') {
        m = new T.MeshStandardMaterial({ color: cor, flatShading: true, roughness: metal ? 0.5 : 0.9, metalness: metal ? 0.32 : 0 })
      } else if (estilo === 'sprite') {
        m = new T.MeshToonMaterial({ color: cor, gradientMap: rampa() })
      } else {
        const rug = metal ? 0.3 : tipo === 'pano' ? 0.93 : tipo === 'pena' ? 0.82 : tipo === 'cartao' ? 0.45 : 0.62
        m = new T.MeshStandardMaterial({ color: cor, roughness: rug, metalness: metal ? 0.88 : 0 })
      }
      if (tipo === 'vertice') m.vertexColors = true
      if (tipo === 'cartao') m.emissive = new T.Color(COR.cartao)
      if (tipo === 'cartao') m.emissiveIntensity = 0
      mats.set(chave, m)
      return m
    }

    function geoEsfera() {
      if (d.esfera === 'ico') return new T.IcosahedronGeometry(1, 1)
      return new T.SphereGeometry(1, d.esfera[0], d.esfera[1])
    }

    function malha(geo, cor, tipo) {
      return new T.Mesh(geo, mat(cor, tipo))
    }

    function elipsoide(pai, rx, ry, rz, cor, tipo, pos, rot) {
      const g = geoEsfera()
      g.scale(rx, ry, rz)
      const m = malha(g, cor, tipo)
      if (pos) m.position.copy(pos)
      if (rot) m.rotation.set(rot[0], rot[1], rot[2])
      pai.add(m)
      return m
    }

    /** Cilindro (ou cone) de a até b, com raio ra na base e rb na ponta. */
    function segmento(pai, a, b, ra, rb, cor, tipo, lados) {
      const dir = new T.Vector3().subVectors(b, a)
      const len = dir.length()
      const g = new T.CylinderGeometry(rb, ra, len, lados || d.cil, 1)
      g.translate(0, len / 2, 0)
      const m = malha(g, cor, tipo)
      m.position.copy(a)
      m.quaternion.setFromUnitVectors(Y, dir.normalize())
      pai.add(m)
      return m
    }

    /** Pena: losango achatado que nasce na origem e cresce para dir. */
    function pena(pai, origem, dir, comp, larg, cor) {
      const g = new T.OctahedronGeometry(1, 0)
      g.scale(larg, larg * 0.34, comp / 2)
      g.translate(0, 0, comp / 2)
      const m = malha(g, cor, 'pena')
      m.position.copy(origem)
      m.quaternion.setFromUnitVectors(Z, dir.clone().normalize())
      pai.add(m)
      return m
    }

    function cupula(pai, r, cor, tipo, pos, escala, rot, abertura) {
      const g = d.esfera === 'ico'
        ? new T.SphereGeometry(r, 7, 3, 0, Math.PI * 2, 0, abertura || Math.PI / 2)
        : new T.SphereGeometry(r, d.esfera[0], Math.max(6, d.esfera[1] >> 1), 0, Math.PI * 2, 0, abertura || Math.PI / 2)
      const m = malha(g, cor, tipo)
      m.material.side = T.DoubleSide
      if (pos) m.position.copy(pos)
      if (escala) m.scale.set(escala[0], escala[1], escala[2])
      if (rot) m.rotation.set(rot[0], rot[1], rot[2])
      pai.add(m)
      return m
    }

    function anel(pai, r, tubo, cor, pos, rot) {
      const m = malha(new T.TorusGeometry(r, tubo, 5, Math.max(10, d.cil)), cor, 'metal')
      if (pos) m.position.copy(pos)
      if (rot) m.rotation.set(rot[0], rot[1], rot[2])
      pai.add(m)
      return m
    }

    const cena = new T.Scene()
    const raiz = new T.Group()
    raiz.name = 'judge'
    cena.add(raiz)

    // ---------------- a ave ----------------
    const ave = new T.Group()
    raiz.add(ave)

    // corpo, cobertor e sela inclinam juntos (a frente um pouco mais alta)
    const aveTronco = new T.Group()
    aveTronco.position.set(0, 1.05, -0.02)
    aveTronco.rotation.x = -0.12
    ave.add(aveTronco)
    const RX = 0.42
    const RY = 0.4
    const RZ = 0.58
    elipsoide(aveTronco, RX, RY, RZ, COR.pena, 'pena')
    elipsoide(aveTronco, 0.35, 0.3, 0.38, COR.penaClara, 'pena', v3(0, -0.09, 0.22))

    const cobertor = cupula(aveTronco, 1, COR.capa, 'pano', v3(0, 0, -0.02), [RX * 1.045, RY * 1.045, RZ * 0.98], [0.06, 0, 0], 1.02)
    cobertor.name = 'cobertor'
    cupula(aveTronco, 1, COR.couro, 'couro', v3(0, 0, -0.03), [RX * 1.08, RY * 1.075, RZ * 0.62], [0.05, 0, 0], 0.5)
    segmento(aveTronco, v3(0, 0.37, 0.17), v3(0, 0.47, 0.19), 0.04, 0.03, COR.couro, 'couro') // cabeça da sela
    elipsoide(aveTronco, 0.13, 0.05, 0.035, COR.couro, 'couro', v3(0, 0.42, -0.2), [0.3, 0, 0]) // patilha

    // peito fofo: penas que caem para a frente
    const peito = new T.Group()
    peito.position.set(0, -0.12, 0.42)
    aveTronco.add(peito)
    const nPeito = extras ? 9 : 5
    for (let i = 0; i < nPeito; i++) {
      const s = nPeito === 1 ? 0 : (i / (nPeito - 1)) * 2 - 1
      pena(peito, v3(s * 0.2, 0.02 - Math.abs(s) * 0.05, -Math.abs(s) * 0.06), v3(s * 0.35, -0.85, 0.5), 0.22, 0.07, i % 2 ? COR.penaClara : COR.pena)
    }

    // asas pequenas
    const asas = []
    for (const lado of [-1, 1]) {
      const asa = new T.Group()
      asa.position.set(lado * 0.36, 0.06, -0.08)
      asa.rotation.set(0.32, 0, lado * 0.14)
      aveTronco.add(asa)
      elipsoide(asa, 0.075, 0.2, 0.33, COR.pena, 'pena')
      const nPrim = extras ? 5 : 2
      for (let i = 0; i < nPrim; i++) {
        const t = nPrim === 1 ? 0 : i / (nPrim - 1)
        pena(asa, v3(lado * 0.02, -0.08 + t * 0.12, -0.2), v3(lado * 0.1, -0.35 + t * 0.4, -1), 0.22 + t * 0.06, 0.06, COR.penaPonta)
      }
      asas.push(asa)
    }

    // cauda em leque, para trás e para cima
    const cauda = new T.Group()
    cauda.position.set(0, 0.14, -0.5)
    aveTronco.add(cauda)
    const nCauda = extras ? 9 : 5
    for (let i = 0; i < nCauda; i++) {
      const s = (i / (nCauda - 1)) * 2 - 1
      const ang = s * 0.62
      const dir = v3(Math.sin(ang) * 0.85, 0.62 - Math.abs(s) * 0.18, -Math.cos(ang))
      pena(cauda, v3(s * 0.08, 0, 0), dir, 0.48 - Math.abs(s) * 0.1, 0.085, i % 2 ? COR.penaPonta : COR.pena)
    }
    if (extras) {
      for (let i = 0; i < 6; i++) {
        const s = (i / 5) * 2 - 1
        pena(cauda, v3(s * 0.06, 0.06, 0.05), v3(Math.sin(s * 0.5) * 0.7, 0.75, -0.75), 0.3, 0.07, COR.pena)
      }
    }

    // pernas fortes: coxa de pena, canela fina, três dedos para a frente
    for (const lado of [-1, 1]) {
      elipsoide(ave, 0.2, 0.3, 0.24, COR.pena, 'pena', v3(lado * 0.23, 0.74, 0.02), [-0.2, 0, lado * -0.08])
      if (extras) {
        for (let i = 0; i < 5; i++) pena(ave, v3(lado * (0.27 + i * 0.008), 0.56, -0.06 + i * 0.04), v3(lado * 0.3, -1, 0.12 * (i - 2)), 0.15, 0.06, COR.pena)
      }
      const joelho = v3(lado * 0.23, 0.47, -0.05)
      const tornozelo = v3(lado * 0.23, 0.07, 0.05)
      elipsoide(ave, 0.075, 0.075, 0.075, COR.perna, 'pele', joelho)
      segmento(ave, joelho, tornozelo, 0.07, 0.056, COR.perna, 'pele')
      for (const giro of [-0.45, 0, 0.45]) {
        const g = giro * lado
        const ponta = v3(tornozelo.x + Math.sin(g) * 0.25, 0.025, tornozelo.z + Math.cos(g) * 0.25)
        segmento(ave, v3(tornozelo.x, 0.05, tornozelo.z), ponta, 0.05, 0.032, COR.perna, 'pele', 6)
        segmento(ave, ponta, v3(ponta.x + Math.sin(g) * 0.07, 0.004, ponta.z + Math.cos(g) * 0.07), 0.03, 0.004, COR.garra, 'pele', 5)
      }
      segmento(ave, v3(tornozelo.x, 0.055, tornozelo.z), v3(tornozelo.x, 0.015, tornozelo.z - 0.13), 0.04, 0.014, COR.perna, 'pele', 5)
    }

    // pescoço e cabeça (o pescoço gira para "olhar antes" do corpo)
    const pescoco = new T.Group()
    pescoco.position.set(0, 1.22, 0.38)
    ave.add(pescoco)
    pescoco.add(malha(geoTubo([v3(0, -0.04, -0.04), v3(0, 0.22, 0.13), v3(0, 0.43, 0.25), v3(0, 0.6, 0.3)], 0.19, 0.135, d.tubo[0], d.tubo[1] + 2), COR.pena, 'pena'))
    if (extras) {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2
        pena(pescoco, v3(Math.sin(a) * 0.13, 0.14, 0.06 + Math.cos(a) * 0.11), v3(Math.sin(a) * 0.4, -0.9, Math.cos(a) * 0.4 - 0.2), 0.16, 0.06, COR.pena)
      }
    }
    const cabeca = new T.Group()
    cabeca.position.set(0, 0.6, 0.3)
    pescoco.add(cabeca)
    elipsoide(cabeca, 0.21, 0.2, 0.25, COR.pena, 'pena', v3(0, 0.07, 0.05))
    const bicoCima = malha(new T.CylinderGeometry(0, 0.1, 0.31, d.esfera === 'ico' ? 5 : d.cil), COR.bico, 'pele')
    bicoCima.geometry.translate(0, 0.155, 0)
    bicoCima.position.set(0, 0.04, 0.22)
    bicoCima.rotation.x = Math.PI / 2 + 0.2
    bicoCima.scale.set(1, 1, 0.72)
    cabeca.add(bicoCima)
    const bicoBaixo = malha(new T.CylinderGeometry(0, 0.068, 0.2, d.esfera === 'ico' ? 5 : d.cil), COR.bicoEscuro, 'pele')
    bicoBaixo.geometry.translate(0, 0.1, 0)
    bicoBaixo.position.set(0, -0.02, 0.2)
    bicoBaixo.rotation.x = Math.PI / 2 + 0.42
    bicoBaixo.scale.set(1, 1, 0.6)
    cabeca.add(bicoBaixo)
    for (const lado of [-1, 1]) {
      elipsoide(cabeca, 0.037, 0.041, 0.034, COR.olho, 'pele', v3(lado * 0.165, 0.125, 0.15))
      if (extras) elipsoide(cabeca, 0.011, 0.011, 0.011, COR.brilho, 'pele', v3(lado * 0.19, 0.137, 0.162))
    }
    // crista de penas na nuca
    const nCrista = extras ? 7 : 4
    for (let i = 0; i < nCrista; i++) {
      const s = nCrista === 1 ? 0 : (i / (nCrista - 1)) * 2 - 1
      pena(cabeca, v3(s * 0.05, 0.23, -0.03), v3(s * 0.35, 0.72 - Math.abs(s) * 0.2, -0.7), 0.3 - Math.abs(s) * 0.07, 0.065, i % 2 ? COR.penaPonta : COR.pena)
    }
    if (extras) {
      // freio: argola no bico e rédea descendo pelo pescoço até a sela
      anel(cabeca, 0.11, 0.013, COR.latao, v3(0, 0.04, 0.22), [0, 0, 0])
      for (const lado of [-1, 1]) {
        pescoco.add(malha(geoTubo([v3(lado * 0.1, 0.62, 0.5), v3(lado * 0.16, 0.4, 0.4), v3(lado * 0.18, 0.16, 0.24), v3(lado * 0.13, 0.0, 0.02)], 0.012, 0.012, 10, 5), COR.couro, 'couro'))
      }
    }

    // ---------------- o juiz ----------------
    const cavaleiro = new T.Group()
    cavaleiro.position.set(0, 1.48, -0.06)
    ave.add(cavaleiro)
    elipsoide(cavaleiro, 0.2, 0.11, 0.16, COR.cota, 'pano', v3(0, 0.07, 0))
    const fralda = malha(new T.CylinderGeometry(0.215, 0.27, 0.16, d.cil, 1, true), COR.prata, 'metal')
    fralda.material.side = T.DoubleSide
    fralda.position.set(0, 0.1, 0)
    fralda.scale.set(1, 1, 0.85)
    cavaleiro.add(fralda)
    for (const lado of [-1, 1]) {
      const joelho = v3(lado * 0.34, 0.0, 0.24)
      const pe = v3(lado * 0.48, -0.36, 0.14)
      segmento(cavaleiro, v3(lado * 0.13, 0.07, 0.03), joelho, 0.09, 0.08, COR.prata, 'metal')
      segmento(cavaleiro, joelho, pe, 0.078, 0.066, COR.prata, 'metal')
      elipsoide(cavaleiro, 0.092, 0.092, 0.092, COR.prata, 'metal', joelho)
      elipsoide(cavaleiro, 0.068, 0.058, 0.13, COR.prataEscura, 'metal', v3(lado * 0.49, -0.4, 0.19))
      if (extras) {
        segmento(cavaleiro, joelho.clone().add(v3(0, 0.02, 0.05)), joelho.clone().add(v3(lado * 0.02, 0.0, 0.13)), 0.05, 0.004, COR.prata, 'metal', 8)
        anel(cavaleiro, 0.078, 0.012, COR.latao, joelho, [Math.PI / 2, 0, 0])
        // estribo pendurado na sela
        anel(cavaleiro, 0.058, 0.01, COR.latao, v3(lado * 0.49, -0.44, 0.14), [0, Math.PI / 2, 0])
      }
    }

    const tronco = new T.Group()
    tronco.position.set(0, 0.12, 0)
    cavaleiro.add(tronco)
    const peitoral = malha(new T.CylinderGeometry(0.24, 0.19, 0.4, d.cil), COR.prata, 'metal')
    peitoral.position.set(0, 0.22, 0)
    peitoral.scale.set(1, 1, 0.8)
    tronco.add(peitoral)
    const cinto = malha(new T.CylinderGeometry(0.198, 0.198, 0.045, d.cil), COR.latao, 'metal')
    cinto.position.set(0, 0.03, 0)
    cinto.scale.set(1, 1, 0.8)
    tronco.add(cinto)
    const gola = malha(new T.CylinderGeometry(0.115, 0.15, 0.075, d.cil), COR.prata, 'metal')
    gola.position.set(0, 0.445, 0)
    tronco.add(gola)
    if (extras) {
      elipsoide(tronco, 0.017, 0.17, 0.022, COR.prata, 'metal', v3(0, 0.24, 0.18))
      for (const y of [0.08, 0.125]) {
        const lamina = malha(new T.CylinderGeometry(0.205, 0.195, 0.038, d.cil, 1, true), COR.prataEscura, 'metal')
        lamina.material.side = T.DoubleSide
        lamina.position.set(0, y, 0)
        lamina.scale.set(1.01, 1, 0.8)
        tronco.add(lamina)
      }
      const emblema = malha(new T.OctahedronGeometry(0.045, 0), COR.latao, 'metal')
      emblema.position.set(0, 0.3, 0.185)
      emblema.scale.set(0.8, 1.1, 0.35)
      tronco.add(emblema)
      anel(tronco, 0.13, 0.013, COR.latao, v3(0, 0.46, 0), [Math.PI / 2, 0, 0])
      // tabardo azul na frente, caindo sobre a sela
      const tabardo = malha(new T.BoxGeometry(0.15, 0.22, 0.012), COR.capa, 'pano')
      tabardo.position.set(0, -0.08, 0.2)
      tabardo.rotation.x = 0.35
      tronco.add(tabardo)
    }
    for (const lado of [-1, 1]) {
      const ombreira = cupula(tronco, 0.165, COR.prata, 'metal', v3(lado * 0.27, 0.4, -0.005), [1.12, 0.92, 1.1], [0, 0, -lado * 0.42])
      anel(ombreira, 0.165, estilo === 'sprite' ? 0.018 : 0.013, COR.latao, v3(0, 0.0, 0), [Math.PI / 2, 0, 0])
      if (extras) {
        cupula(tronco, 0.135, COR.prata, 'metal', v3(lado * 0.35, 0.3, -0.005), [1.05, 0.8, 1.05], [0, 0, -lado * 0.7])
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2
          elipsoide(ombreira, 0.012, 0.012, 0.012, COR.latao, 'metal', v3(Math.cos(a) * 0.15, 0.04, Math.sin(a) * 0.15))
        }
      }
    }

    // capa: lençol que sai dos ombros e cai sobre o lombo da ave
    const [nu, nv] = d.capa
    const geoCapa = new T.BufferGeometry()
    geoCapa.setAttribute('position', new T.BufferAttribute(new Float32Array((nu + 1) * (nv + 1) * 3), 3))
    const idxCapa = []
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const a = j * (nu + 1) + i
        const b = a + 1
        const c = a + nu + 1
        const e = c + 1
        idxCapa.push(a, b, c, b, e, c)
      }
    }
    geoCapa.setIndex(idxCapa)
    const capaFora = malha(geoCapa, COR.capa, 'pano')
    const capaDentro = new T.Mesh(geoCapa, mat(COR.capaDentro, 'panoDentro'))
    capaFora.material.side = T.FrontSide
    capaDentro.material.side = T.BackSide
    tronco.add(capaFora, capaDentro)

    // elmo com chifres
    const elmo = new T.Group()
    elmo.position.set(0, 0.46, 0)
    tronco.add(elmo)
    elipsoide(elmo, 0.18, 0.192, 0.188, COR.prata, 'metal', v3(0, 0.17, 0))
    const queixeira = malha(new T.CylinderGeometry(0.16, 0.12, 0.14, d.cil), COR.prata, 'metal')
    queixeira.position.set(0, 0.07, 0.025)
    elmo.add(queixeira)
    const visor = malha(new T.BoxGeometry(0.24, 0.034, 0.07), COR.visor, 'pele')
    visor.position.set(0, 0.168, 0.155)
    elmo.add(visor)
    if (extras) {
      const fenda = malha(new T.BoxGeometry(0.03, 0.11, 0.06), COR.visor, 'pele')
      fenda.position.set(0, 0.11, 0.165)
      elmo.add(fenda)
      const crista = malha(new T.BoxGeometry(0.028, 0.055, 0.34), COR.latao, 'metal')
      crista.position.set(0, 0.36, -0.01)
      elmo.add(crista)
      anel(elmo, 0.17, 0.013, COR.latao, v3(0, 0.035, 0.01), [Math.PI / 2, 0, 0])
      for (let i = 0; i < 4; i++) elipsoide(elmo, 0.008, 0.008, 0.008, COR.visor, 'pele', v3(-0.06 + i * 0.04, 0.06, 0.175))
    }
    const raioChifre = estilo === 'sprite' ? 0.075 : 0.064
    for (const lado of [-1, 1]) {
      const pts = [v3(lado * 0.13, 0.23, -0.01), v3(lado * 0.3, 0.26, -0.04), v3(lado * 0.43, 0.34, -0.01), v3(lado * 0.47, 0.45, 0.05), v3(lado * 0.43, 0.53, 0.11)]
      elmo.add(malha(geoTubo(pts, raioChifre, 0.006, d.tubo[0], d.tubo[1], [COR.chifre, COR.chifrePonta, 0.45]), 0xffffff, 'vertice'))
      if (extras) anel(elmo, 0.064, 0.013, COR.latao, v3(lado * 0.175, 0.24, -0.02), [0, Math.PI / 2, 0.25 * lado])
    }

    // braços: o direito segura o cartão, o esquerdo a sela
    function braco(lado) {
      const ombro = new T.Group()
      ombro.position.set(lado * 0.31, 0.385, 0)
      tronco.add(ombro)
      segmento(ombro, v3(0, 0, 0), v3(0, -0.22, 0), 0.075, 0.068, COR.prata, 'metal')
      const cotovelo = new T.Group()
      cotovelo.position.set(0, -0.22, 0)
      ombro.add(cotovelo)
      elipsoide(cotovelo, 0.078, 0.078, 0.078, COR.prata, 'metal')
      segmento(cotovelo, v3(0, 0, 0), v3(0, -0.2, 0), 0.068, 0.062, COR.prata, 'metal')
      if (extras) {
        segmento(cotovelo, v3(0, -0.13, 0), v3(0, -0.21, 0), 0.07, 0.084, COR.prataEscura, 'metal')
        segmento(cotovelo, v3(0, 0.0, -0.02), v3(0, 0.02, -0.11), 0.055, 0.004, COR.prata, 'metal', 8)
      }
      elipsoide(cotovelo, 0.06, 0.072, 0.055, COR.prataEscura, 'metal', v3(0, -0.25, 0))
      const pegada = new T.Object3D()
      pegada.position.set(0, -0.27, 0.01)
      cotovelo.add(pegada)
      return { ombro, cotovelo, pegada }
    }
    const bracoD = braco(1)
    const bracoE = braco(-1)

    const cartao = new T.Group()
    bracoD.pegada.add(cartao)
    const k = d.cartao
    const folhaCartao = malha(new T.BoxGeometry(0.16 * k, 0.22 * k, 0.014), COR.cartao, 'cartao')
    folhaCartao.position.set(0, 0.085 * k, 0)
    cartao.add(folhaCartao)

    // ---------------- luz ----------------
    if (estilo === 'lowpoly') {
      cena.add(new T.HemisphereLight(0xfff1dc, 0x5d6274, 2.3))
      const sol = new T.DirectionalLight(0xffffff, 2.2)
      sol.position.set(-1.6, 3.2, 2.2)
      cena.add(sol)
      const recorte = new T.DirectionalLight(0xc6d6ff, 0.9)
      recorte.position.set(1.4, 1.6, -2.4)
      cena.add(recorte)
    } else if (estilo === 'sprite') {
      cena.add(new T.AmbientLight(0xffffff, 0.8))
      const sol = new T.DirectionalLight(0xffffff, 2.0)
      sol.position.set(-1.6, 3.0, 2.4)
      cena.add(sol)
    } else {
      cena.environment = texturaDeAmbiente()
      cena.environmentIntensity = 0.9
      cena.add(new T.HemisphereLight(0xfff1dc, 0x4a4e5c, 0.9))
      const sol = new T.DirectionalLight(0xfff6ea, 2.4)
      sol.position.set(-1.6, 3.2, 2.2)
      cena.add(sol)
      const recorte = new T.DirectionalLight(0xc6d6ff, 1.3)
      recorte.position.set(1.4, 1.8, -2.4)
      cena.add(recorte)
    }

    const rig = {
      estilo, raiz, aveTronco, asas, cauda, pescoco, cabeca, cavaleiro, tronco, elmo,
      bracoD, bracoE, cartao, folhaCartao, geoCapa, nu, nv,
      qTmp: new T.Quaternion(), qTmp2: new T.Quaternion(), eTmp: new T.Euler(),
    }
    posar(rig, { yaw: 0, fase: 0, cartao: 0, olharAve: 0, olharJuiz: 0, surgir: 1 })
    return { cena, rig, estatisticas: contar(cena) }
  }

  /** Recalcula a capa: dobras fixas mais uma onda lenta que segue a respiração. */
  function moldarCapa(rig, fase) {
    const pos = rig.geoCapa.attributes.position
    const { nu, nv } = rig
    const onda = 2 * Math.PI * fase
    let n = 0
    for (let j = 0; j <= nv; j++) {
      const t = j / nv
      // linha do meio: dos ombros, para trás e para baixo, por cima do lombo
      const a = 1 - t
      const cy = a * a * 0.41 + 2 * a * t * 0.0 + t * t * -0.26
      const cz = a * a * -0.17 + 2 * a * t * -0.4 + t * t * -0.54
      const meia = 0.26 + 0.12 * t
      for (let i = 0; i <= nu; i++) {
        const s = (i / nu) * 2 - 1
        // dobras verticais que abrem para baixo e o meio estufado para trás
        const dobra = Math.sin(s * Math.PI * 3 + 0.4) * 0.045 * t
        const barriga = -(1 - s * s) * 0.05 * t
        const vento = Math.sin(onda - t * 2.3 + s * 0.6) * 0.016 * t
        pos.setXYZ(n++, s * meia * (1 - 0.12 * s * s * t), cy - s * s * 0.2 * t + vento * 0.4, cz + s * s * 0.13 * t + dobra + barriga + vento)
      }
    }
    pos.needsUpdate = true
    rig.geoCapa.computeVertexNormals()
    rig.geoCapa.computeBoundingSphere()
  }

  const lerp = (a, b, t) => a + (b - a) * t
  const QUAT_EM_PE = new T.Quaternion().setFromEuler(new T.Euler(-0.12, 0, 0))
  const QUAT_REPOUSO = new T.Quaternion().setFromEuler(new T.Euler(Math.PI, 0, 0.1))

  /**
   * Põe o rig numa pose. Determinística: a mesma pose dá a mesma imagem, então
   * o 3D ao vivo e os quadros fotografados saem da mesma função.
   * p = { yaw, fase 0..1 (respiração), cartao 0..1, olharAve, olharJuiz (rad), surgir 0..1 }
   */
  function posar(rig, p) {
    const s = Math.sin(2 * Math.PI * p.fase)
    const s2 = Math.sin(2 * Math.PI * p.fase - 0.7)
    const c = p.cartao
    rig.raiz.rotation.y = p.yaw
    rig.raiz.position.y = -(1 - p.surgir) * 3.3

    rig.aveTronco.scale.set(1 + 0.006 * s, 1 + 0.02 * s, 1 + 0.008 * s)
    rig.asas[0].rotation.z = -0.14 - 0.035 * s
    rig.asas[1].rotation.z = 0.14 + 0.035 * s
    rig.cauda.rotation.x = -0.05 * s2
    rig.pescoco.rotation.set(-0.03 * s2 - 0.09 * c, p.olharAve * 0.45, 0)
    rig.cabeca.rotation.set(0.04 * s2 + 0.05 * c, p.olharAve * 0.55, 0)

    rig.cavaleiro.position.y = 1.48 + 0.018 * s2
    rig.tronco.rotation.x = 0.018 * s2 - 0.07 * c
    rig.elmo.rotation.set(0.03 * c, p.olharJuiz, 0)

    // braço do cartão: varre para a frente e para cima (ombro), estica o cotovelo
    rig.bracoD.ombro.rotation.set(lerp(-0.16, -2.6, c), 0, lerp(0.24, 0.4, c))
    rig.bracoD.cotovelo.rotation.set(lerp(-0.4, -0.5, c), 0, 0)
    rig.bracoE.ombro.rotation.set(-0.72 + 0.02 * s2, 0, -0.14)
    rig.bracoE.cotovelo.rotation.set(-0.88, 0, 0)

    // no alto, o cartão vira de frente para a câmera: todo mundo na mesa vê
    rig.raiz.updateMatrixWorld(true)
    const qMao = rig.bracoD.pegada.getWorldQuaternion(rig.qTmp)
    const qRepouso = rig.qTmp2.copy(qMao).multiply(QUAT_REPOUSO)
    const k = T.MathUtils.smoothstep(c, 0.3, 0.92)
    qRepouso.slerp(QUAT_EM_PE, k)
    rig.cartao.quaternion.copy(qMao.invert().multiply(qRepouso))
    const brilho = rig.folhaCartao.material
    if (brilho.emissive) brilho.emissiveIntensity = 0.22 * k

    moldarCapa(rig, p.fase)
    rig.raiz.updateMatrixWorld(true)
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
      triangulos += (g.index ? g.index.count : g.attributes.position.count) / 3
      if (!vistas.has(g)) {
        vistas.add(g)
        for (const nome in g.attributes) bytes += g.attributes[nome].array.byteLength
        if (g.index) bytes += g.index.array.byteLength
      }
    })
    return { chamadas, triangulos: Math.round(triangulos), bytes }
  }

  window.JudgeModelo = { criarCena, posar, PERIODO_RESPIRO_S, COR }
})()
