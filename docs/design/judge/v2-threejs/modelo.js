/*
 * Judge v2: o avatar do mestre, esculpido do zero em three.js.
 *
 * Diferente da v1 (bolas, cones e cilindros colados), aqui cada peça é um campo de
 * distância com união suave, virado malha por surface nets (escultura.js):
 *  - a ave marrom, quase um grifo: peito fundo, coxas emplumadas, tarso com escamas e
 *    garras curvas, pescoço grosso com crina, bico de rapina, elmo de metal com orelhas;
 *  - asas meio abertas de penas longas em camadas (rêmiges, coberteiras), cauda em leque
 *    e uns 570 tufos de penugem que dão a silhueta peluda;
 *  - o juiz em armadura de placas: couraça com quilha, faldas em degrau, ombreiras
 *    grandes de três lâminas com guarda de pescoço, cotoveleiras com leque, elmo fechado
 *    de focinho com fenda e chifres largos de touro;
 *  - capa azul pesada que cai sobre a garupa (dobras + vento) e assenta no corpo;
 *  - sela, manta, cilha, peitoral, estribos e rédeas que seguem a cabeça.
 * Nada foi tirado de jogo ou da pintura: geometria própria, gerada aqui.
 *
 * Unidade: 1 = uma casa da grade. Pés em y = 0, frente para +Z.
 * Script clássico (abre por file://): usa THREE e Escultura globais e publica window.JudgeV2.
 */
(function () {
  'use strict'
  const T = THREE
  const E = window.Escultura
  const { clamp, mix, smoothstep, smin } = E
  const esf = E.esfera
  const eli = E.elipsoide
  const cone = E.coneRedondo
  const cil = E.coneCortado
  const caixa = E.caixa
  const toro = E.toro
  const cadeia = E.cadeia
  const PI = Math.PI

  const PERIODO_RESPIRO_S = 3.6

  // Paleta (sRGB). Marrom da ave, prata fria, azul real da capa, vermelho do cartão.
  const HEX = {
    penaEscura: '#3a281c',
    penaMedia: '#6e4d34',
    penaClara: '#a37d58',
    penaPeito: '#bc9770',
    penaPonta: '#d7bc96',
    remigeBase: '#5c4231',
    remigePonta: '#a68b69',
    primariaBase: '#43312a',
    primariaPonta: '#8d7a64',
    coberteiraBase: '#7a5940',
    coberteiraPonta: '#9f7d5a',
    caudaBase: '#432f23',
    caudaPonta: '#c4a47e',
    pele: '#6a5847',
    peleClara: '#958169',
    garra: '#1b1816',
    bico: '#c3ab7b',
    bicoBaixo: '#9b8762',
    bicoBase: '#c99f4f',
    bicoPonta: '#2c2723',
    aco: '#e1e6ee',
    acoEscuro: '#7b8495',
    acoFerro: '#4a4f58',
    malha: '#3c414c',
    latao: '#b88f3c',
    couro: '#4a2a1c',
    couroClaro: '#7b4b30',
    manta: '#2a4387',
    mantaFriso: '#b9933f',
    capa: '#2a4c9e',
    chifre: '#ece6d8',
    chifreMeio: '#cfc5b2',
    chifrePonta: '#8a8175',
    fenda: '#0c0e12',
    olho: '#0a0a0c',
    cartao: '#e3372c',
  }
  const C = {}
  for (const k in HEX) C[k] = new T.Color(HEX[k])

  // metal, aspereza, veludo (sheen) por tipo de superfície
  const MAT = {
    pena: [0, 0.9, 0.35],
    pele: [0, 0.6, 0.12],
    garra: [0, 0.22, 0],
    bico: [0, 0.34, 0],
    aco: [0.78, 0.3, 0],
    ferro: [1, 0.5, 0],
    malha: [0.85, 0.62, 0],
    latao: [1, 0.32, 0],
    couro: [0, 0.66, 0.35],
    pano: [0, 0.86, 1],
    chifre: [0, 0.4, 0.1],
    fenda: [0.3, 0.7, 0],
    olho: [0, 0.07, 0],
  }

  // Esqueleto: pivô de cada osso no mundo em repouso (pais antes dos filhos).
  const OSSOS = {
    raiz: { pai: null, p: [0, 0, 0] },
    ave: { pai: 'raiz', p: [0, 0, 0] },
    corpo: { pai: 'ave', p: [0, 1.0, 0] },
    pescoco: { pai: 'corpo', p: [0, 1.36, 0.44] },
    cabeca: { pai: 'pescoco', p: [0, 1.9, 0.62] },
    asaE: { pai: 'corpo', p: [0.27, 1.26, 0.12] },
    asaD: { pai: 'corpo', p: [-0.27, 1.26, 0.12] },
    cauda: { pai: 'corpo', p: [0, 1.08, -0.66] },
    cavaleiro: { pai: 'ave', p: [0, 1.43, -0.18] },
    tronco: { pai: 'cavaleiro', p: [0, 1.5, -0.18] },
    elmo: { pai: 'tronco', p: [0, 1.97, -0.17] },
    ombreiraE: { pai: 'tronco', p: [0.235, 1.86, -0.17] },
    ombreiraD: { pai: 'tronco', p: [-0.235, 1.86, -0.17] },
    bracoE: { pai: 'tronco', p: [0.235, 1.86, -0.17] },
    cotoveloE: { pai: 'bracoE', p: [0.25, 1.62, -0.17] },
    maoE: { pai: 'cotoveloE', p: [0.25, 1.4, -0.17] },
    bracoD: { pai: 'tronco', p: [-0.235, 1.86, -0.17] },
    cotoveloD: { pai: 'bracoD', p: [-0.25, 1.62, -0.17] },
    maoD: { pai: 'cotoveloD', p: [-0.25, 1.4, -0.17] },
  }
  const PEGADA = [0, -0.07, 0.025] // centro da mão fechada, no espaço da mão

  const asaPontos = (l) => [
    [l * 0.26, 1.25, 0.11],
    [l * 0.55, 1.43, -0.04],
    [l * 0.8, 1.45, -0.33],
    [l * 0.95, 1.36, -0.6],
  ]

  // ======================================================================
  // As peças esculpidas
  // ======================================================================
  function definirPecas() {
    const pecas = []
    const peca = (o) => {
      pecas.push(o)
      return o
    }

    // ---------------- ave: corpo ----------------
    // massa de grifo: peito fundo, barriga cheia e coxas grossas que escondem a perna
    const nucleo = eli([0, 1.02, -0.1], [0.37, 0.36, 0.58], [-0.14, 0, 0])
    const peito = eli([0, 0.98, 0.31], [0.37, 0.43, 0.34], [0.1, 0, 0])
    const dorso = eli([0, 1.21, 0.1], [0.32, 0.2, 0.36])
    const garupa = eli([0, 1.05, -0.53], [0.3, 0.27, 0.3], [-0.2, 0, 0])
    const barriga = eli([0, 0.78, -0.06], [0.3, 0.24, 0.4])
    const baseColo = cone([0, 1.1, 0.3], [0, 1.42, 0.47], 0.32, 0.26)
    const calcaE = eli([0.22, 0.58, -0.06], [0.16, 0.26, 0.18], [0.3, 0, -0.08])
    const calcaD = eli([-0.22, 0.58, -0.06], [0.16, 0.26, 0.18], [0.3, 0, 0.08])
    const ombroE = eli([0.24, 1.2, 0.14], [0.13, 0.12, 0.19])
    const ombroD = eli([-0.24, 1.2, 0.14], [0.13, 0.12, 0.19])
    function corpoLiso(x, y, z) {
      let d = nucleo(x, y, z)
      d = smin(d, peito(x, y, z), 0.16)
      d = smin(d, dorso(x, y, z), 0.12)
      d = smin(d, garupa(x, y, z), 0.14)
      d = smin(d, barriga(x, y, z), 0.12)
      d = smin(d, baseColo(x, y, z), 0.12)
      d = smin(d, calcaE(x, y, z), 0.09)
      d = smin(d, calcaD(x, y, z), 0.09)
      d = smin(d, ombroE(x, y, z), 0.08)
      d = smin(d, ombroD(x, y, z), 0.08)
      return d
    }
    // tufos que caem: ruído esticado na vertical
    const penugem = (x, y, z) => 0.011 * E.fbm(x * 17, y * 9, z * 17, 2)
    const corpoPenas = (x, y, z) => {
      const d = corpoLiso(x, y, z)
      return d > 0.05 ? d : d + penugem(x, y, z)
    }
    peca({ nome: 'corpo', osso: 'corpo', campo: corpoPenas, campoAO: corpoLiso, caixa: [-0.47, 0.27, -0.92, 0.47, 1.6, 0.78], celula: 0.02, pintar: pintarPenugem, guardar: true })

    // ---------------- ave: pescoço e cabeça ----------------
    const colo = cadeia(
      [
        [0, 1.22, 0.34, 0.29],
        [0, 1.5, 0.5, 0.245],
        [0, 1.74, 0.58, 0.2],
        [0, 1.93, 0.625, 0.17],
      ],
      0.08
    )
    const coloPenas = (x, y, z) => {
      const d = colo(x, y, z)
      return d > 0.05 ? d : d + penugem(x, y, z)
    }
    peca({ nome: 'pescoco', osso: 'pescoco', campo: coloPenas, campoAO: colo, caixa: [-0.34, 0.94, 0.0, 0.34, 2.14, 0.86], celula: 0.016, pintar: pintarPescoco, guardar: true })

    const cranio = eli([0, 1.985, 0.665], [0.156, 0.149, 0.19], [-0.15, 0, 0])
    const bochE = eli([0.08, 1.935, 0.735], [0.08, 0.074, 0.098])
    const bochD = eli([-0.08, 1.935, 0.735], [0.08, 0.074, 0.098])
    const nuca = eli([0, 1.95, 0.56], [0.15, 0.165, 0.145])
    const cabeca = (x, y, z) => {
      let d = cranio(x, y, z)
      d = smin(d, bochE(x, y, z), 0.05)
      d = smin(d, bochD(x, y, z), 0.05)
      return smin(d, nuca(x, y, z), 0.06)
    }
    peca({ nome: 'cabeca', osso: 'cabeca', campo: cabeca, caixa: [-0.2, 1.76, 0.38, 0.2, 2.17, 0.9], celula: 0.011, pintar: pintarPescoco, guardar: true })

    const bicoSup = cadeia(
      [
        [0, 1.975, 0.775, 0.07],
        [0, 1.972, 0.865, 0.057],
        [0, 1.955, 0.94, 0.039],
        [0, 1.918, 0.985, 0.021],
        [0, 1.872, 0.985, 0.005],
      ],
      0.03
    )
    const bicoInf = cadeia(
      [
        [0, 1.912, 0.77, 0.05],
        [0, 1.898, 0.858, 0.033],
        [0, 1.892, 0.918, 0.011],
      ],
      0.02
    )
    const sup = (x, y, z) => bicoSup(x / 0.72, y, z) * 0.72
    const inf = (x, y, z) => bicoInf(x / 0.7, y, z) * 0.7
    peca({
      nome: 'bico',
      osso: 'cabeca',
      campo: (x, y, z) => Math.min(sup(x, y, z), inf(x, y, z)),
      caixa: [-0.07, 1.84, 0.68, 0.07, 2.06, 1.02],
      celula: 0.0068,
      pintar(p, n, s) {
        const emCima = sup(p.x, p.y, p.z) < inf(p.x, p.y, p.z)
        s.cor.copy(emCima ? C.bico : C.bicoBaixo)
        s.cor.lerp(C.bicoBase, smoothstep(0.84, 0.77, p.z) * 0.8)
        s.cor.lerp(C.bicoPonta, smoothstep(0.92, 0.985, p.z))
        s.mrs = MAT.bico
      },
    })

    // elmo da ave (testeira de metal): casca cortada, friso na borda, crista, orelhas, furos dos olhos
    const elmoAve = eli([0, 1.995, 0.675], [0.176, 0.17, 0.222], [-0.15, 0, 0])
    const narigueira = caixa([0, 1.99, 0.82], [0.052, 0.02, 0.078], 0.018, [-0.22, 0, 0])
    const furoE = esf([0.134, 1.99, 0.745], 0.045)
    const furoD = esf([-0.134, 1.99, 0.745], 0.045)
    const orelhaE = cone([0.085, 2.1, 0.58], [0.13, 2.26, 0.49], 0.036, 0.007)
    const orelhaD = cone([-0.085, 2.1, 0.58], [-0.13, 2.26, 0.49], 0.036, 0.007)
    const tiraE = cone([0.142, 1.935, 0.66], [0.074, 1.902, 0.785], 0.011, 0.009)
    const tiraD = cone([-0.142, 1.935, 0.66], [-0.074, 1.902, 0.785], 0.011, 0.009)
    const argolaE = toro([0.074, 1.9, 0.79], 0.02, 0.0055, [0, 0, PI / 2])
    const argolaD = toro([-0.074, 1.9, 0.79], 0.02, 0.0055, [0, 0, PI / 2])
    const RQ = 1 / Math.sqrt(1.25)
    function testeira(x, y, z) {
      const e = elmoAve(x, y, z)
      const pl = (y - 1.945 + 0.5 * (z - 0.66)) * RQ
      let d = Math.max(Math.abs(e + 0.009) - 0.009, -pl)
      d = smin(d, Math.sqrt(pl * pl + (e + 0.009) * (e + 0.009)) - 0.012, 0.006)
      d = smin(d, narigueira(x, y, z), 0.012)
      d = Math.max(d, -furoE(x, y, z), -furoD(x, y, z))
      const crista = Math.max(Math.abs(x) - 0.011, e - 0.028, 0.012 - pl, -(e + 0.018))
      d = smin(d, crista, 0.008)
      d = smin(d, orelhaE(x, y, z), 0.015)
      d = smin(d, orelhaD(x, y, z), 0.015)
      return Math.min(d, tiraE(x, y, z), tiraD(x, y, z), argolaE(x, y, z), argolaD(x, y, z))
    }
    peca({
      nome: 'testeira',
      osso: 'cabeca',
      campo: testeira,
      caixa: [-0.21, 1.8, 0.44, 0.21, 2.28, 0.92],
      celula: 0.0095,
      pintar(p, n, s) {
        if (Math.min(argolaE(p.x, p.y, p.z), argolaD(p.x, p.y, p.z)) < 0.003) {
          s.cor.copy(C.latao)
          s.mrs = MAT.latao
        } else if (Math.min(tiraE(p.x, p.y, p.z), tiraD(p.x, p.y, p.z)) < 0.003) {
          s.cor.copy(C.couro)
          s.mrs = MAT.couro
        } else pintarAco(p, n, s)
      },
    })

    // ---------------- ave: pernas e pés ----------------
    for (const lado of [1, -1]) {
      const pe = pernaAve(lado)
      peca({
        nome: 'perna' + lado,
        osso: 'ave',
        campo: pe.campo,
        caixa: [lado * 0.21 - 0.3, -0.045, -0.26, lado * 0.21 + 0.3, 0.6, 0.37],
        celula: 0.0072,
        pintar(p, n, s) {
          if (pe.garra(p.x, p.y, p.z) < 0.004) {
            s.cor.copy(C.garra)
            s.mrs = MAT.garra
            return
          }
          s.cor.copy(C.pele).lerp(C.peleClara, clamp(0.35 + pe.escama(p.x, p.y, p.z) * 120, 0, 1) * 0.6)
          s.cor.multiplyScalar(0.92 + 0.16 * E.ruido(p.x * 40, p.y * 40, p.z * 40))
          s.mrs = MAT.pele
        },
      })
    }

    // ---------------- ave: braço das asas (as penas vêm depois) ----------------
    for (const lado of [1, -1]) {
      const P = asaPontos(lado)
      const braco = cadeia(
        [
          [...P[0], 0.1],
          [...P[1], 0.078],
          [...P[2], 0.056],
          [...P[3], 0.03],
        ],
        0.04
      )
      const xs = [lado * 0.1, lado * 1.06].sort((a, b) => a - b)
      peca({
        nome: 'asa' + lado,
        osso: lado > 0 ? 'asaE' : 'asaD',
        campo: (x, y, z) => {
          const d = braco(x, y, z)
          return d > 0.04 ? d : d + 0.008 * E.fbm(x * 20, y * 12, z * 20, 2)
        },
        campoAO: braco,
        caixa: [xs[0], 1.05, -0.76, xs[1], 1.62, 0.28],
        celula: 0.016,
        pintar: pintarPenugem,
      })
      // a folha de penas da asa, só para a sombra de ambiente (não vira malha)
      const folha = eli([lado * 0.7, 0.98, -0.5], [0.06, 0.3, 0.42], [0.25, 0, -lado * 0.35])
      peca({ nome: 'sombraAsa' + lado, soAO: true, campo: folha, caixa: [Math.min(lado * 0.45, lado * 1.0), 0.6, -0.95, Math.max(lado * 0.45, lado * 1.0), 1.35, -0.05] })
    }
    peca({ nome: 'sombraCauda', soAO: true, campo: eli([0, 0.98, -0.9], [0.3, 0.05, 0.32], [-0.45, 0, 0]), caixa: [-0.32, 0.8, -1.25, 0.32, 1.18, -0.55] })

    // ---------------- ave: sela, manta, cilha e peitoral ----------------
    const patilha = eli([0, 1.43, 0.025], [0.075, 0.06, 0.05])
    const arcao = eli([0, 1.455, -0.4], [0.17, 0.065, 0.045], [0.4, 0, 0])
    const RC = 1 / Math.hypot(1, 0.22)
    function partesArreio(x, y, z, o) {
      const c = corpoLiso(x, y, z)
      o.manta = Math.max(Math.abs(c - 0.015) - 0.011, Math.abs(z + 0.18) - 0.3, 1.0 - y)
      let sela = Math.max(Math.abs(c - 0.045) - 0.014, Math.abs(z + 0.18) - 0.2, 1.13 - y)
      sela = smin(sela, patilha(x, y, z), 0.03)
      o.sela = smin(sela, arcao(x, y, z), 0.03)
      const pc = (z + 0.06 + 0.22 * (y - 1.0)) * RC
      o.cilha = Math.max(Math.abs(c - 0.008) - 0.012, Math.abs(pc) - 0.032, y - 1.2)
      const pp = 0.9 * (y - 1.0) + 0.436 * (z - 0.62)
      o.peitoral = Math.max(Math.abs(c - 0.008) - 0.012, Math.abs(pp) - 0.028, 0.02 - z, y - 1.3)
      return c
    }
    const tmpArreio = {}
    function arreio(x, y, z) {
      if (y < 0.56 || y > 1.6) return 0.2
      const c = corpoLiso(x, y, z)
      // longe do corpo: limite por baixo (o arção sobe ~0,2 acima do dorso)
      if (c > 0.25) return c - 0.21
      partesArreio(x, y, z, tmpArreio)
      return Math.min(tmpArreio.manta, tmpArreio.sela, tmpArreio.cilha, tmpArreio.peitoral)
    }
    peca({
      nome: 'arreio',
      osso: 'corpo',
      campo: arreio,
      caixa: [-0.43, 0.56, -0.56, 0.43, 1.56, 0.72],
      celula: 0.0135,
      pintar(p, n, s) {
        const o = {}
        partesArreio(p.x, p.y, p.z, o)
        const m = Math.min(o.manta, o.sela, o.cilha, o.peitoral)
        if (m === o.manta) {
          const friso = Math.abs(p.z + 0.18) > 0.262 || p.y < 1.04
          s.cor.copy(friso ? C.mantaFriso : C.manta)
          if (!friso) s.cor.multiplyScalar(0.9 + 0.2 * E.fbm(p.x * 14, p.y * 14, p.z * 14, 2))
          s.mrs = friso ? MAT.latao.map((v, i) => (i === 0 ? 0.6 : i === 1 ? 0.45 : 0.4)) : MAT.pano
        } else if (m === o.sela) {
          const borda = Math.abs(p.z + 0.18) > 0.185 || p.y < 1.15
          s.cor.copy(borda ? C.couroClaro : C.couro)
          s.mrs = MAT.couro
        } else {
          s.cor.copy(C.couro).multiplyScalar(0.8)
          s.mrs = MAT.couro
        }
      },
    })

    // ---------------- juiz: tronco (couraça, cintura de malha, faldas, gorjal) ----------------
    const peitoA = eli([0, 1.765, -0.155], [0.2, 0.19, 0.14], [0.08, 0, 0])
    const peitoB = eli([0, 1.745, -0.105], [0.16, 0.152, 0.1])
    const couraca = (x, y, z) => smin(peitoA(x, y, z), peitoB(x, y, z), 0.05)
    const cintura = cil([0, 1.5, -0.18], [0, 1.64, -0.175], 0.135, 0.13)
    const faldas = [
      cil([0, 1.625, -0.17], [0, 1.578, -0.175], 0.148, 0.16),
      cil([0, 1.59, -0.175], [0, 1.543, -0.18], 0.16, 0.173),
      cil([0, 1.555, -0.18], [0, 1.508, -0.185], 0.173, 0.186),
    ]
    const gorjal = [cil([0, 1.915, -0.165], [0, 1.952, -0.165], 0.1, 0.09), cil([0, 1.946, -0.165], [0, 1.982, -0.165], 0.09, 0.08)]
    const escarcelaE = eli([0.085, 1.495, -0.075], [0.072, 0.07, 0.018], [0.5, 0, 0])
    const escarcelaD = eli([-0.085, 1.495, -0.075], [0.072, 0.07, 0.018], [0.5, 0, 0])
    function placaPeito(x, y, z) {
      const c0 = couraca(x, y, z)
      let d = Math.max(c0, 1.615 - y)
      const dy = y - 1.618
      d = smin(d, Math.sqrt(dy * dy + (c0 + 0.006) * (c0 + 0.006)) - 0.0095, 0.004)
      const quilha = Math.max(Math.abs(x) - 0.0065, c0 - 0.011, 1.64 - y, -(z + 0.11), y - 1.9)
      return smin(d, quilha, 0.006)
    }
    function placasTronco(x, y, z) {
      let d = placaPeito(x, y, z)
      for (const f of faldas) d = Math.min(d, f(x, y, z))
      for (const g of gorjal) d = Math.min(d, g(x, y, z))
      return Math.min(d, escarcelaE(x, y, z), escarcelaD(x, y, z))
    }
    const tronco = (x, y, z) => Math.min(placasTronco(x, y, z), cintura(x, y, z))
    peca({
      nome: 'tronco',
      osso: 'tronco',
      campo: tronco,
      caixa: [-0.25, 1.44, -0.38, 0.25, 2.0, 0.06],
      celula: 0.0088,
      pintar(p, n, s) {
        if (cintura(p.x, p.y, p.z) < placasTronco(p.x, p.y, p.z) - 0.001) {
          s.cor.copy(C.malha).multiplyScalar(0.8 + 0.4 * Math.abs(Math.sin(p.y * 260) * Math.sin(p.x * 260 + p.z * 260)))
          s.mrs = MAT.malha
        } else pintarAco(p, n, s)
      },
    })

    // ---------------- juiz: ombreiras grandes de três lâminas ----------------
    for (const lado of [1, -1]) {
      peca({
        nome: 'ombreira' + lado,
        osso: lado > 0 ? 'ombreiraE' : 'ombreiraD',
        campo: ombreira(lado),
        caixa: [lado > 0 ? 0.08 : -0.57, 1.57, -0.42, lado > 0 ? 0.57 : -0.08, 2.08, 0.08],
        celula: 0.0092,
        pintar: pintarAco,
      })
    }

    // ---------------- juiz: braços (giram: ficam fora da sombra de ambiente) ----------------
    for (const lado of [1, -1]) {
      const b = bracoJuiz(lado)
      const x = lado * 0.245
      const sfx = lado > 0 ? 'E' : 'D'
      const pintarBraco = (p, n, s) => {
        if (b.malha(p.x, p.y, p.z) < b.placas(p.x, p.y, p.z) - 0.001) {
          s.cor.copy(C.malha)
          s.mrs = MAT.malha
        } else pintarAco(p, n, s)
      }
      peca({ nome: 'braco' + sfx, osso: 'braco' + sfx, campo: b.superior, caixa: [x - 0.11, 1.57, -0.29, x + 0.11, 1.94, -0.05], celula: 0.0068, pintar: pintarBraco, ocluir: false })
      peca({ nome: 'antebraco' + sfx, osso: 'cotovelo' + sfx, campo: b.inferior, caixa: [x - 0.12, 1.37, -0.31, x + 0.12, 1.71, -0.04], celula: 0.0068, pintar: pintarAco, ocluir: false })
      peca({ nome: 'mao' + sfx, osso: 'mao' + sfx, campo: b.mao, caixa: [x - 0.1, 1.26, -0.26, x + 0.1, 1.47, -0.06], celula: 0.0055, pintar: pintarAco, ocluir: false })
    }

    // ---------------- juiz: pernas, joelheiras, escarpes e estribos ----------------
    for (const lado of [1, -1]) {
      const pj = pernaJuiz(lado)
      peca({
        nome: 'pernaJuiz' + lado,
        osso: 'cavaleiro',
        campo: pj.campo,
        caixa: [lado > 0 ? 0.04 : -0.6, 0.93, -0.28, lado > 0 ? 0.6 : -0.04, 1.57, 0.2],
        celula: 0.009,
        pintar(p, n, s) {
          if (pj.loro(p.x, p.y, p.z) < 0.003) {
            s.cor.copy(C.couro)
            s.mrs = MAT.couro
          } else if (pj.estribo(p.x, p.y, p.z) < 0.003) {
            s.cor.copy(C.acoFerro)
            s.mrs = MAT.ferro
          } else pintarAco(p, n, s)
        },
      })
    }

    // ---------------- juiz: elmo fechado de focinho ----------------
    const cranioJ = eli([0, 2.087, -0.172], [0.112, 0.126, 0.124])
    const viseira = eli([0, 2.045, -0.112], [0.1, 0.096, 0.112])
    // viseira em cunha (achatada dos lados) com quilha no meio: nada de focinho redondo
    const bico = cone([0, 2.05, -0.07], [0, 2.03, 0.022], 0.062, 0.012)
    const focinho = (x, y, z) => bico(x / 0.7, y, z) * 0.7
    const quilha = caixa([0, 2.035, -0.035], [0.008, 0.07, 0.055], 0.006, [0.35, 0, 0])
    const fenda = caixa([0, 2.07, -0.04], [0.078, 0.006, 0.06], 0.003)
    const bossaE = esf([0.104, 2.118, -0.175], 0.027)
    const bossaD = esf([-0.104, 2.118, -0.175], 0.027)
    const elmoBase = (x, y, z) => smin(smin(smin(cranioJ(x, y, z), viseira(x, y, z), 0.035), focinho(x, y, z), 0.028), quilha(x, y, z), 0.012)
    function elmo(x, y, z) {
      const e0 = elmoBase(x, y, z)
      let d = Math.max(e0, 1.955 - y)
      const dy = y - 1.958
      d = smin(d, Math.sqrt(dy * dy + (e0 + 0.006) * (e0 + 0.006)) - 0.0085, 0.004)
      d = Math.max(d, -fenda(x, y, z))
      const crista = Math.max(Math.abs(x) - 0.009, cranioJ(x, y, z) - 0.024, 2.06 - y, z + 0.03)
      d = smin(d, crista, 0.008)
      return smin(d, Math.min(bossaE(x, y, z), bossaD(x, y, z)), 0.012)
    }
    peca({
      nome: 'elmo',
      osso: 'elmo',
      campo: elmo,
      caixa: [-0.16, 1.93, -0.32, 0.16, 2.25, 0.05],
      celula: 0.0064,
      pintar(p, n, s) {
        if (fenda(p.x, p.y, p.z) < 0.004) {
          s.cor.copy(C.fenda)
          s.mrs = MAT.fenda
          return
        }
        pintarAco(p, n, s)
        // furos de respiro no focinho
        if (n.z > 0.35 && p.y > 1.99 && p.y < 2.04 && p.z > -0.03) {
          const gx = Math.round(p.x / 0.016) * 0.016
          const gy = 1.997 + Math.round((p.y - 1.997) / 0.016) * 0.016
          if (Math.abs(gx) < 0.04 && Math.hypot(p.x - gx, p.y - gy) < 0.0048) {
            s.cor.copy(C.fenda)
            s.mrs = MAT.fenda
          }
        }
      },
    })

    // ---------------- para a capa assentar ----------------
    const ombE = ombreira(1)
    const ombD = ombreira(-1)
    // a capa larga desce pelos flancos: passa por fora das pernas do juiz
    const pernaCapaE = pernaJuiz(1).campo
    const pernaCapaD = pernaJuiz(-1).campo
    function colisaoCapa(x, y, z) {
      let d = corpoLiso(x, y, z)
      d = Math.min(d, tronco(x, y, z), arcao(x, y, z) - 0.01, ombE(x, y, z), ombD(x, y, z), elmo(x, y, z), pernaCapaE(x, y, z), pernaCapaD(x, y, z))
      d = Math.min(d, (eli([0, 0.98, -0.9], [0.3, 0.05, 0.32], [-0.45, 0, 0]))(x, y, z))
      return d
    }

    return { pecas, corpoLiso, colo, cabeca, colisaoCapa, testeira }
  }

  // ---------------- pintores ----------------
  function pintarPenugem(p, n, s) {
    const mancha = E.fbm(p.x * 5, p.y * 7, p.z * 5, 3)
    const risco = E.ruido(p.x * 34, p.y * 8, p.z * 34)
    s.cor.copy(C.penaMedia).lerp(C.penaClara, clamp(0.42 + 0.55 * mancha + 0.22 * risco, 0, 1))
    const k = smoothstep(0.08, 0.42, p.z) * smoothstep(1.32, 0.86, p.y)
    s.cor.lerp(C.penaPeito, k * 0.6)
    s.cor.lerp(C.penaEscura, clamp(smoothstep(1.18, 1.45, p.y) * 0.45 + smoothstep(-0.25, -0.85, n.y) * 0.4, 0, 0.8))
    s.mrs = MAT.pena
  }
  function pintarPescoco(p, n, s) {
    const mancha = E.fbm(p.x * 6, p.y * 9, p.z * 6, 3)
    const risco = E.ruido(p.x * 36, p.y * 9, p.z * 36)
    s.cor.copy(C.penaMedia).lerp(C.penaClara, clamp(0.45 + 0.5 * mancha + 0.22 * risco, 0, 1))
    s.cor.lerp(C.penaPeito, smoothstep(0.1, 0.7, n.z) * 0.55)
    s.cor.lerp(C.penaEscura, smoothstep(-0.1, -0.7, n.z) * 0.4)
    s.mrs = MAT.pena
  }
  function pintarAco(p, n, s) {
    const r = E.fbm(p.x * 9, p.y * 9, p.z * 9, 2)
    s.cor.copy(C.aco).lerp(C.acoEscuro, clamp(0.1 + r * 0.3, 0, 1))
    s.mrs = MAT.aco
  }

  // ---------------- peças compostas ----------------
  function pernaAve(lado) {
    const hx = lado * 0.21
    const fx = hx * 1.03
    const tarso = cone([hx, 0.5, -0.14], [fx, 0.075, 0.02], 0.078, 0.06)
    const ax = fx - hx
    const ay = 0.075 - 0.5
    const az = 0.16
    const aL2 = ax * ax + ay * ay + az * az
    const dedos = []
    const garras = []
    const F = [fx, 0.055, 0.03]
    for (const psi of [-0.5, 0, 0.5]) {
      const a = psi + lado * 0.12
      const dx = Math.sin(a)
      const dz = Math.cos(a)
      const k1 = [F[0] + dx * 0.11, F[1] - 0.012, F[2] + dz * 0.11]
      const tp = [F[0] + dx * 0.2, F[1] - 0.02, F[2] + dz * 0.2]
      dedos.push(
        cadeia(
          [
            [F[0], F[1], F[2], 0.05],
            [...k1, 0.042],
            [...tp, 0.034],
          ],
          0.02
        )
      )
      // garra grossa o bastante para a grade da malha (ponta >= 1 célula)
      garras.push(
        cadeia(
          [
            [tp[0] + dx * 0.012, tp[1] + 0.006, tp[2] + dz * 0.012, 0.03],
            [tp[0] + dx * 0.055, tp[1] + 0.012, tp[2] + dz * 0.055, 0.023],
            [tp[0] + dx * 0.09, tp[1] - 0.006, tp[2] + dz * 0.09, 0.015],
            [tp[0] + dx * 0.104, tp[1] - 0.03, tp[2] + dz * 0.104, 0.008],
          ],
          0.008
        )
      )
    }
    {
      const a = PI - lado * 0.25
      const dx = Math.sin(a)
      const dz = Math.cos(a)
      const tp = [F[0] + dx * 0.09, F[1] - 0.012, F[2] + dz * 0.09]
      dedos.push(
        cadeia(
          [
            [F[0], F[1] + 0.01, F[2], 0.048],
            [...tp, 0.036],
          ],
          0.02
        )
      )
      garras.push(
        cadeia(
          [
            [tp[0] + dx * 0.012, tp[1] + 0.008, tp[2] + dz * 0.012, 0.032],
            [tp[0] + dx * 0.06, tp[1] + 0.01, tp[2] + dz * 0.06, 0.024],
            [tp[0] + dx * 0.095, tp[1] - 0.01, tp[2] + dz * 0.095, 0.015],
            [tp[0] + dx * 0.108, tp[1] - 0.034, tp[2] + dz * 0.108, 0.008],
          ],
          0.008
        )
      )
    }
    function escama(x, y, z) {
      const t = ((x - hx) * ax + (y - 0.5) * ay + (z + 0.14) * az) / aL2
      return 0.0035 * (0.5 + 0.5 * Math.cos(t * PI * 2 * 12))
    }
    function garra(x, y, z) {
      if (y > 0.13) return 1
      let d = garras[0](x, y, z)
      for (let i = 1; i < garras.length; i++) d = Math.min(d, garras[i](x, y, z))
      return d
    }
    function campo(x, y, z) {
      let d = tarso(x, y, z)
      if (d < 0.02 && y > 0.1) d += escama(x, y, z)
      if (y < 0.16) {
        for (const f of dedos) d = smin(d, f(x, y, z), 0.025)
        d = smin(d, garra(x, y, z), 0.006)
      }
      return d
    }
    return { campo, garra, escama }
  }

  function ombreira(lado) {
    const ox = lado * 0.235
    const oy = 1.86
    const oz = -0.17
    // calota grande por cima; duas lâminas estreitas embaixo, cada uma maior e mais aberta, em degrau
    const domo = eli([0.02, 0.0, 0], [0.155, 0.1, 0.16], [0, 0, -0.3])
    const l1 = eli([0.03, -0.024, 0], [0.16, 0.103, 0.15], [0, 0, -0.4])
    const l2 = eli([0.042, -0.048, 0], [0.163, 0.105, 0.14], [0, 0, -0.5])
    const guarda = caixa([-0.04, 0.1, 0], [0.007, 0.045, 0.11], 0.006, [0, 0, -0.15])
    const rebites = [esf([0.13, -0.02, 0.075], 0.009), esf([0.13, -0.02, -0.075], 0.009), esf([0.152, -0.058, 0.0], 0.009)]
    const NQ = 1 / Math.hypot(1, 0.5)
    const casca = (e) => Math.abs(e + 0.01) - 0.01
    const rolo = (pl, e) => Math.sqrt(pl * pl + (e + 0.01) * (e + 0.01)) - 0.008
    // ombreira grande, como a da pintura: a peça toda cresce a partir da junta do ombro
    const S = 1.12
    return function (x, y, z) {
      return S * forma((lado * (x - ox)) / S, (y - oy) / S, (z - oz) / S)
    }
    function forma(u, v, w) {
      const p0 = (v + 0.045 + 0.5 * u) * NQ
      const p1 = (v + 0.085 + 0.5 * u) * NQ
      const p2 = (v + 0.125 + 0.5 * u) * NQ
      const e0 = domo(u, v, w)
      const e1 = l1(u, v, w)
      const e2 = l2(u, v, w)
      let d = smin(Math.max(casca(e0), -p0), rolo(p0, e0), 0.004)
      const a = smin(Math.max(casca(e1), -p1, p0 - 0.014), rolo(p1, e1), 0.004)
      const b = smin(Math.max(casca(e2), -p2, p1 - 0.014), rolo(p2, e2), 0.004)
      d = Math.min(d, a, b)
      d = Math.max(d, -(u + 0.1))
      d = smin(d, guarda(u, v, w), 0.006)
      for (const r of rebites) d = Math.min(d, r(u, v, w))
      return d
    }
  }

  function bracoJuiz(lado) {
    const J = [lado * 0.235, 1.86, -0.17]
    const Ec = [lado * 0.25, 1.62, -0.17]
    const Wx = lado * 0.25
    // braço de armadura cheio (nada de palito): placas largas, cotoveleira com leque, manopla de punho largo
    const malha = cone(J, Ec, 0.06, 0.055)
    const lam1 = cil([lado * 0.238, 1.83, -0.17], [lado * 0.241, 1.785, -0.17], 0.073, 0.07)
    const lam2 = cil([lado * 0.241, 1.795, -0.17], [lado * 0.247, 1.655, -0.17], 0.068, 0.062)
    const placas = (x, y, z) => Math.min(lam1(x, y, z), lam2(x, y, z))
    const cotoveleira = esf([Ec[0], Ec[1], Ec[2] - 0.006], 0.07)
    const leque = eli([Ec[0] + lado * 0.036, Ec[1], Ec[2] - 0.04], [0.014, 0.07, 0.062], [0, lado * 0.78, 0])
    const avambraco = cil([Ec[0], 1.588, -0.17], [Wx, 1.425, -0.17], 0.061, 0.053)
    const punho = cil([Wx, 1.445, -0.17], [Wx, 1.39, -0.17], 0.055, 0.074)
    const palma = caixa([Wx, 1.343, -0.163], [0.038, 0.052, 0.032], 0.018)
    const dedos = caixa([Wx, 1.306, -0.138], [0.036, 0.034, 0.026], 0.016)
    const polegar = cone([Wx - lado * 0.036, 1.372, -0.15], [Wx - lado * 0.036, 1.328, -0.124], 0.02, 0.015)
    return {
      malha,
      placas,
      superior: (x, y, z) => Math.min(malha(x, y, z), placas(x, y, z)),
      inferior: (x, y, z) => Math.min(smin(cotoveleira(x, y, z), leque(x, y, z), 0.008), avambraco(x, y, z)),
      mao: (x, y, z) => Math.min(punho(x, y, z), smin(smin(palma(x, y, z), dedos(x, y, z), 0.01), polegar(x, y, z), 0.008)),
    }
  }

  function pernaJuiz(lado) {
    // as pernas abrem por cima do grifo mais largo
    const H = [lado * 0.14, 1.47, -0.17]
    const K = [lado * 0.445, 1.315, 0.075]
    const A = [lado * 0.495, 1.04, 0.0]
    const coxote = cil(H, K, 0.086, 0.07)
    const joelheira = esf(K, 0.072)
    const asaJoelho = eli([K[0] + lado * 0.058, K[1] - 0.005, K[2] - 0.01], [0.014, 0.064, 0.058])
    const greva = cil(K, A, 0.062, 0.05)
    const pe1 = cil([A[0], A[1] + 0.005, A[2] - 0.005], [lado * 0.5, 1.022, 0.065], 0.053, 0.048)
    const pe2 = cil([lado * 0.501, 1.026, 0.055], [lado * 0.505, 1.012, 0.11], 0.046, 0.04)
    const biqueira = eli([lado * 0.507, 1.006, 0.128], [0.039, 0.031, 0.046])
    const calcanhar = eli([A[0], A[1] - 0.02, A[2] - 0.03], [0.046, 0.036, 0.041])
    const estribo = toro([lado * 0.5, 1.02, 0.065], 0.064, 0.0085, [PI / 2, 0, 0])
    const loro = cone([lado * 0.41, 1.31, -0.06], [lado * 0.51, 1.085, 0.06], 0.011, 0.011)
    function campo(x, y, z) {
      let d = Math.min(coxote(x, y, z), smin(joelheira(x, y, z), asaJoelho(x, y, z), 0.01), greva(x, y, z))
      d = Math.min(d, pe1(x, y, z), pe2(x, y, z), smin(biqueira(x, y, z), calcanhar(x, y, z), 0.0))
      return Math.min(d, estribo(x, y, z), loro(x, y, z))
    }
    return { campo, estribo, loro }
  }

  // ======================================================================
  // Penas em cartões
  // ======================================================================
  const _p = new T.Vector3()
  const _n = new T.Vector3()
  const _f = new T.Vector3()
  const _dir = new T.Vector3()
  const _lado = new T.Vector3()
  const _base = new T.Vector3()
  const _ponta = new T.Vector3()

  const aoMul = (a) => 0.32 + 0.68 * a

  function tufos(malha, quantos, semente, regra, pintor, lote, ocl) {
    const rnd = E.aleatorio(semente)
    const nV = malha.pos.length / 3
    const s = { cor: new T.Color(), mrs: null }
    let feitos = 0
    let tentativas = 0
    while (feitos < quantos && tentativas < quantos * 40) {
      tentativas++
      const q = Math.floor(rnd() * nV)
      _p.set(malha.pos[3 * q], malha.pos[3 * q + 1], malha.pos[3 * q + 2])
      _n.set(malha.nor[3 * q], malha.nor[3 * q + 1], malha.nor[3 * q + 2])
      const r = regra(_p, _n, rnd)
      if (!r) continue
      _dir.copy(r.fluxo).addScaledVector(_n, -r.fluxo.dot(_n))
      if (_dir.lengthSq() < 1e-4) continue
      _dir.normalize().addScaledVector(_n, r.ergue).normalize()
      _lado.crossVectors(_n, _dir).normalize()
      _base.copy(_p).addScaledVector(_n, -0.004).addScaledVector(_dir, -r.comp * 0.15)
      _ponta.copy(_base).addScaledVector(_dir, r.comp)
      pintor(_p, _n, s)
      const corBase = s.cor.clone().multiplyScalar(0.82)
      const corPonta = s.cor.clone().lerp(C.penaPonta, r.clarear)
      E.pena(lote, {
        base: _base,
        dir: _dir,
        lado: _lado,
        comp: r.comp,
        larg: r.larg,
        tipo: r.tipo,
        curva: r.curva === undefined ? 0.14 : r.curva,
        concha: 0.15,
        corBase,
        corPonta,
        normal: _n.clone(),
        mistura: 0.72,
        ao: aoMul(ocl(_p.x, _p.y, _p.z, _n.x, _n.y, _n.z)),
        aoPonta: aoMul(ocl(_ponta.x, _ponta.y, _ponta.z, _n.x, _n.y, _n.z)),
        cima: _n,
      })
      feitos++
    }
  }

  function penasDoCorpo(malhas, ocl) {
    const lote = E.novoLote()
    const desce = new T.Vector3(0, -1, 0.08)
    const desceAtras = new T.Vector3(0, -1, -0.15)
    const tras = new T.Vector3(0, -0.3, -1)
    // peito: penas longas e desgrenhadas que caem
    tufos(malhas.corpo, 130, 7, (p, n, r) => {
      if (p.z < 0.1 || p.y > 1.3 || p.y < 0.56 || n.y < -0.6) return null
      return { fluxo: desce, comp: 0.11 + r() * 0.09, larg: 0.07 + r() * 0.035, tipo: r() < 0.5 ? 2 : 3, ergue: 0.22, clarear: 0.38 }
    }, pintarPenugem, lote, ocl)
    // calças (coxas)
    tufos(malhas.corpo, 120, 8, (p, n, r) => {
      if (Math.abs(p.x) < 0.1 || p.y > 0.86 || p.y < 0.34 || p.z > 0.14 || p.z < -0.32) return null
      return { fluxo: desceAtras, comp: 0.1 + r() * 0.06, larg: 0.075, tipo: 2, ergue: 0.3, clarear: 0.25 }
    }, pintarPenugem, lote, ocl)
    // flancos e garupa
    tufos(malhas.corpo, 150, 9, (p, n, r) => {
      if (p.z > 0.16 || n.y < -0.45) return null
      if (p.y > 0.97 && Math.abs(p.z + 0.18) < 0.33) return null // debaixo da manta
      return { fluxo: tras, comp: 0.08 + r() * 0.05, larg: 0.068, tipo: r() < 0.55 ? 1 : 2, ergue: 0.16, clarear: 0.3 }
    }, pintarPenugem, lote, ocl)
    return lote
  }

  function penasDoPescoco(malhas, ocl) {
    const lote = E.novoLote()
    const desce = new T.Vector3(0, -0.93, -0.37)
    tufos(malhas.pescoco, 120, 12, (p, n, r) => {
      if (p.y < 1.27) return null
      const atras = n.z < -0.2
      return {
        fluxo: desce,
        comp: atras ? 0.13 + r() * 0.08 : 0.08 + r() * 0.05,
        larg: atras ? 0.08 : 0.065,
        tipo: atras ? 3 : 2,
        ergue: atras ? 0.38 : 0.2,
        clarear: 0.3,
      }
    }, pintarPescoco, lote, ocl)
    return lote
  }

  function penasDaCabeca(malhas, ocl) {
    const lote = E.novoLote()
    const tras = new T.Vector3(0, -0.5, -1)
    // crina que escapa por baixo do elmo, atrás
    tufos(malhas.cabeca, 50, 13, (p, n, r) => {
      const pl = p.y - 1.945 + 0.5 * (p.z - 0.66)
      if (pl > -0.012 || p.z > 0.7 || n.y < -0.5) return null
      return { fluxo: tras, comp: 0.11 + r() * 0.08, larg: 0.075, tipo: 3, ergue: 0.32, clarear: 0.25 }
    }, pintarPescoco, lote, ocl)
    return lote
  }

  function penasDaAsa(lado, ocl) {
    const lote = E.novoLote()
    const P = asaPontos(lado).map((p) => new T.Vector3(p[0], p[1], p[2]))
    const curva = new T.CatmullRomCurve3(P, false, 'centripetal')
    const cima = new T.Vector3(lado * 0.78, 0.62, 0.05).normalize()
    const rnd = E.aleatorio(lado > 0 ? 101 : 202)
    const pt = new T.Vector3()
    const tg = new T.Vector3()
    const dir = new T.Vector3()
    const base = new T.Vector3()
    const ponta = new T.Vector3()
    const dirSec = new T.Vector3(lado * 0.08, -0.62, -0.78).normalize()
    const dirPri = new T.Vector3(lado * 0.5, -0.22, -0.84).normalize()
    const dirTer = new T.Vector3(0, -0.5, -0.87).normalize()
    function linha(n, t0, t1, o) {
      for (let i = 0; i < n; i++) {
        const t = mix(t0, t1, n === 1 ? 0 : i / (n - 1))
        curva.getPointAt(t, pt)
        curva.getTangentAt(t, tg)
        dir.copy(dirSec).lerp(dirPri, smoothstep(0.5, 0.95, t)).lerp(dirTer, smoothstep(0.16, 0.0, t)).normalize()
        base.copy(pt).addScaledVector(cima, o.camada + i * 0.0011).addScaledVector(dir, o.recuo)
        const comp = o.comp(t) * (0.95 + rnd() * 0.1)
        ponta.copy(base).addScaledVector(dir, comp)
        const varia = 0.9 + rnd() * 0.2
        E.pena(lote, {
          base,
          dir,
          lado: tg,
          comp,
          larg: o.larg,
          tipo: o.tipo,
          curva: o.curva,
          concha: 0.12,
          corBase: o.corBase.clone().multiplyScalar(varia),
          corPonta: o.corPonta.clone().multiplyScalar(0.95 + rnd() * 0.1),
          normal: cima,
          mistura: 0.45,
          ao: aoMul(ocl(base.x, base.y, base.z, cima.x, cima.y, cima.z)),
          aoPonta: aoMul(ocl(ponta.x, ponta.y, ponta.z, cima.x, cima.y, cima.z)),
          cima,
        })
      }
    }
    // de baixo para cima: primárias, secundárias, terciárias, coberteiras
    linha(10, 0.62, 1.0, { comp: (t) => mix(0.68, 0.88, smoothstep(0.62, 0.9, t)) - 0.08 * smoothstep(0.93, 1, t), larg: 0.12, tipo: 0, curva: 0.05, camada: 0, recuo: -0.02, corBase: C.primariaBase, corPonta: C.primariaPonta })
    linha(11, 0.15, 0.6, { comp: () => 0.63, larg: 0.13, tipo: 0, curva: 0.06, camada: 0.004, recuo: -0.02, corBase: C.remigeBase, corPonta: C.remigePonta })
    linha(3, 0.0, 0.12, { comp: () => 0.48, larg: 0.13, tipo: 0, curva: 0.05, camada: 0.008, recuo: -0.02, corBase: C.remigeBase, corPonta: C.remigePonta })
    linha(16, 0.05, 0.96, { comp: (t) => 0.25 - 0.05 * t, larg: 0.09, tipo: 1, curva: 0.08, camada: 0.016, recuo: 0.03, corBase: C.coberteiraBase, corPonta: C.coberteiraPonta })
    linha(16, 0.03, 0.9, { comp: () => 0.15, larg: 0.075, tipo: 1, curva: 0.1, camada: 0.028, recuo: -0.005, corBase: C.coberteiraBase, corPonta: C.coberteiraPonta })
    linha(18, 0.0, 0.85, { comp: () => 0.1, larg: 0.07, tipo: 2, curva: 0.12, camada: 0.04, recuo: -0.035, corBase: C.penaMedia, corPonta: C.penaClara })
    return lote
  }

  function penasDaCauda(ocl) {
    const lote = E.novoLote()
    const rnd = E.aleatorio(303)
    const cima = new T.Vector3(0, 1, 0.25).normalize()
    const add = (base, dir, comp, larg, tipo, curva, cb, cp) => {
      const lado = new T.Vector3(dir.z, 0, -dir.x).normalize()
      const ponta = base.clone().addScaledVector(dir, comp)
      E.pena(lote, {
        base,
        dir,
        lado,
        comp,
        larg,
        tipo,
        curva,
        concha: 0.1,
        corBase: cb,
        corPonta: cp,
        normal: cima,
        mistura: 0.4,
        ao: aoMul(ocl(base.x, base.y, base.z, 0, 1, 0)),
        aoPonta: aoMul(ocl(ponta.x, ponta.y, ponta.z, 0, 1, 0)),
        cima,
      })
    }
    for (let i = 0; i < 11; i++) {
      const u = (i - 5) / 5
      const camada = (5 - Math.abs(i - 5)) * 0.004
      const v = 0.9 + rnd() * 0.2
      add(new T.Vector3(u * 0.1, 1.11 - 0.02 * Math.abs(u) + camada, -0.6), new T.Vector3(u * 0.42, -0.42, -0.86).normalize(), 0.56 + 0.07 * (1 - Math.abs(u)), 0.12, 0, 0.07, C.caudaBase.clone().multiplyScalar(v), C.caudaPonta.clone().multiplyScalar(v))
    }
    for (let i = 0; i < 9; i++) {
      const u = (i - 4) / 4
      add(new T.Vector3(u * 0.09, 1.16, -0.56), new T.Vector3(u * 0.3, -0.35, -0.9).normalize(), 0.3, 0.1, 1, 0.08, C.coberteiraBase, C.coberteiraPonta)
    }
    return lote
  }

  // ======================================================================
  // Capa: forma de repouso (com dobras, assentada no corpo) e vento por quadro
  // ======================================================================
  const CAPA_NU = 26
  const CAPA_NV = 34

  function formaDaCapa(colisao, ocl) {
    const meio = new T.CatmullRomCurve3(
      [
        new T.Vector3(0, 1.955, -0.275),
        new T.Vector3(0, 1.75, -0.35),
        new T.Vector3(0, 1.53, -0.455),
        new T.Vector3(0, 1.36, -0.64),
        new T.Vector3(0, 1.16, -0.85),
        new T.Vector3(0, 0.94, -0.99),
      ],
      false,
      'centripetal'
    )
    const nu = CAPA_NU
    const nv = CAPA_NV
    const pos = new Float32Array((nu + 1) * (nv + 1) * 3)
    const cor = new Float32Array((nu + 1) * (nv + 1) * 3)
    const C0 = new T.Vector3()
    const Tg = new T.Vector3()
    const X = new T.Vector3(1, 0, 0)
    const Nin = new T.Vector3()
    const P = new T.Vector3()
    const g = new T.Vector3()
    const h = 0.004
    for (let j = 0; j <= nv; j++) {
      const v = j / nv
      meio.getPointAt(v, C0)
      meio.getTangentAt(v, Tg)
      Nin.crossVectors(Tg, X).normalize() // aponta para o corpo
      const meia = 0.24 + 0.6 * Math.pow(smoothstep(0, 1, v), 0.85)
      const R = mix(0.27, 0.5, v)
      const dobraA = 0.066 * smoothstep(0.06, 0.5, v)
      for (let i = 0; i <= nu; i++) {
        const u = (i / nu) * 2 - 1
        const th = (u * meia) / R
        P.copy(C0).addScaledVector(X, R * Math.sin(th)).addScaledVector(Nin, R * (1 - Math.cos(th)))
        const dobra = Math.sin(u * PI * 3.1 + 0.6 + v * 0.8) * dobraA
        P.addScaledVector(Nin, -dobra)
        // a barra ondulada e o vento que leva a ponta para a esquerda do juiz
        P.y += 0.02 * Math.sin(u * 9.0) * smoothstep(0.85, 1, v)
        P.x += 0.1 * v * v
        P.z -= 0.035 * v * v
        // assenta: empurra para fora do corpo e da armadura
        for (let it = 0; it < 3; it++) {
          const d = colisao(P.x, P.y, P.z)
          const folga = 0.014 + 0.01 * v
          if (d >= folga) break
          g.set(colisao(P.x + h, P.y, P.z) - colisao(P.x - h, P.y, P.z), colisao(P.x, P.y + h, P.z) - colisao(P.x, P.y - h, P.z), colisao(P.x, P.y, P.z + h) - colisao(P.x, P.y, P.z - h))
          if (g.lengthSq() < 1e-12) break
          g.normalize()
          P.addScaledVector(g, folga - d)
        }
        const k = 3 * (j * (nu + 1) + i)
        pos[k] = P.x
        pos[k + 1] = P.y
        pos[k + 2] = P.z
        // cor: dobra funda mais escura, crista mais clara, topo na sombra do elmo
        const luz = 1 + 0.16 * (dobraA > 0 ? dobra / dobraA : 0)
        const topo = mix(0.72, 1, smoothstep(0.0, 0.18, v))
        const a = aoMul(ocl(P.x, P.y, P.z, -Nin.x, -Nin.y, -Nin.z))
        const c = C.capa.clone().multiplyScalar(luz * topo * (0.55 + 0.45 * a))
        cor[k] = c.r
        cor[k + 1] = c.g
        cor[k + 2] = c.b
      }
    }
    const idx = []
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const a = j * (nu + 1) + i
        const b = a + 1
        const c = a + nu + 1
        const d = c + 1
        idx.push(a, b, c, b, d, c)
      }
    }
    const geo = new T.BufferGeometry()
    geo.setAttribute('position', new T.BufferAttribute(pos.slice(), 3))
    geo.setAttribute('color', new T.BufferAttribute(cor, 3))
    geo.setIndex(idx)
    geo.computeVertexNormals()
    const nor = geo.attributes.normal.array.slice()
    return { geo, repouso: pos, normais: nor, nu, nv }
  }

  // ======================================================================
  // Geometrias soltas: chifres, olhos, cartão
  // ======================================================================
  function atributosConstantes(geo, cor, mrs) {
    const n = geo.attributes.position.count
    const c = new Float32Array(n * 3)
    const m = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      c[3 * i] = cor.r
      c[3 * i + 1] = cor.g
      c[3 * i + 2] = cor.b
      m[3 * i] = mrs[0]
      m[3 * i + 1] = mrs[1]
      m[3 * i + 2] = mrs[2]
    }
    geo.setAttribute('color', new T.BufferAttribute(c, 3))
    geo.setAttribute('mrs', new T.BufferAttribute(m, 3))
    return geo
  }

  function chifre(lado, ocl) {
    const pts = [
      // chifre de touro: sai bem para o lado, quase na horizontal; só a ponta sobe e vem para a frente
      [0.095, 2.118, -0.178],
      [0.2, 2.135, -0.19],
      [0.31, 2.15, -0.185],
      [0.405, 2.175, -0.16],
      [0.47, 2.215, -0.12],
      [0.5, 2.27, -0.075],
      [0.495, 2.33, -0.04],
    ].map((p) => new T.Vector3(lado * p[0], p[1], p[2]))
    const raio = (t) => (0.075 * Math.pow(1 - t, 0.85) + 0.004) * (t < 0.8 ? 1 + 0.05 * Math.sin(t * 56) : 1)
    const geo = E.tubo(pts, raio, 48, 14)
    const n = geo.attributes.position.count
    const uv = geo.attributes.uv
    const pos = geo.attributes.position
    const nor = geo.attributes.normal
    const c = new Float32Array(n * 3)
    const m = new Float32Array(n * 3)
    const tmp = new T.Color()
    for (let i = 0; i < n; i++) {
      const t = uv.getY(i)
      tmp.copy(C.chifre).lerp(C.chifreMeio, smoothstep(0.2, 0.6, t)).lerp(C.chifrePonta, smoothstep(0.7, 1.0, t))
      if (t < 0.8) tmp.multiplyScalar(0.9 + 0.1 * Math.sin(t * 50))
      const a = mix(1, aoMul(ocl(pos.getX(i), pos.getY(i), pos.getZ(i), nor.getX(i), nor.getY(i), nor.getZ(i))), 0.45)
      c[3 * i] = tmp.r * a
      c[3 * i + 1] = tmp.g * a
      c[3 * i + 2] = tmp.b * a
      m[3 * i] = MAT.chifre[0]
      m[3 * i + 1] = MAT.chifre[1]
      m[3 * i + 2] = MAT.chifre[2]
    }
    geo.setAttribute('color', new T.BufferAttribute(c, 3))
    geo.setAttribute('mrs', new T.BufferAttribute(m, 3))
    return geo
  }

  function geometriaCartao() {
    const w = 0.13
    const h = 0.18
    const r = 0.018
    const f = new T.Shape()
    f.moveTo(-w / 2 + r, 0)
    f.lineTo(w / 2 - r, 0)
    f.quadraticCurveTo(w / 2, 0, w / 2, r)
    f.lineTo(w / 2, h - r)
    f.quadraticCurveTo(w / 2, h, w / 2 - r, h)
    f.lineTo(-w / 2 + r, h)
    f.quadraticCurveTo(-w / 2, h, -w / 2, h - r)
    f.lineTo(-w / 2, r)
    f.quadraticCurveTo(-w / 2, 0, -w / 2 + r, 0)
    const g = new T.ExtrudeGeometry(f, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.004, bevelSegments: 2, curveSegments: 5 })
    g.translate(0, 0, -0.003)
    return g
  }

  // ======================================================================
  // Materiais: pintura no shader (pincelada triplanar + contorno de céu frio)
  // ======================================================================
  const PINCEL_GLSL = [
    'float pincel(vec3 p, vec3 n) {',
    '  vec3 w = pow(abs(n), vec3(4.0));',
    '  w /= (w.x + w.y + w.z + 1e-5);',
    '  float a = texture2D(tPincel, p.yz * 3.1).r;',
    '  float b = texture2D(tPincel, p.zx * 3.1 + 0.37).r;',
    '  float c = texture2D(tPincel, p.xy * 3.1 + 0.71).r;',
    '  return a * w.x + b * w.y + c * w.z;',
    '}',
  ].join('\n')

  function injetarPintura(sh, tex, o) {
    sh.uniforms.tPincel = { value: tex.pincel }
    // contorno de céu frio; nas penas (cartões finos) ele é fraco, senão a asa vira branca na contraluz
    sh.uniforms.uContorno = { value: new T.Color(0xa8bcff).multiplyScalar(o.contorno === undefined ? 1 : o.contorno) }
    const mrsV = o.mrs ? '\nattribute vec3 mrs;\nvarying vec3 vMRS;' : ''
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPosObj;\nvarying vec3 vNorObj;' + mrsV)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPosObj = position;\nvNorObj = normal;' + (o.mrs ? '\nvMRS = mrs;' : ''))
    let fs = sh.fragmentShader
    fs = fs.replace('#include <common>', '#include <common>\nuniform sampler2D tPincel;\nuniform vec3 uContorno;\nvarying vec3 vPosObj;\nvarying vec3 vNorObj;' + (o.mrs ? '\nvarying vec3 vMRS;' : '') + '\n' + PINCEL_GLSL)
    fs = fs.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\nfloat pinc = pincel(vPosObj, vNorObj);\ndiffuseColor.rgb *= mix(0.84, 1.16, pinc);' + (o.forro ? '\nif (!gl_FrontFacing) diffuseColor.rgb *= vec3(0.46, 0.5, 0.66);' : '')
    )
    if (o.mrs) {
      fs = fs.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(vMRS.y + (pinc - 0.5) * 0.14, 0.05, 1.0);')
      fs = fs.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vMRS.x;')
      fs = fs.replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\nmaterial.sheenColor *= vMRS.z;')
    }
    if (o.semVirar) fs = fs.replace('#include <normal_fragment_begin>', T.ShaderChunk.normal_fragment_begin.replace('gl_FrontFacing ? 1.0 : - 1.0', '1.0'))
    fs = fs.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n{\n  float fr = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);\n  totalEmissiveRadiance += uContorno * fr * mix(0.3, 1.0, saturate(normal.y * 0.6 + 0.5)) * (0.25 + 0.75 * diffuseColor.rgb) * 0.55;\n}'
    )
    sh.fragmentShader = fs
  }

  function criarMateriais(tex) {
    const solido = new T.MeshPhysicalMaterial({ vertexColors: true, roughness: 1, metalness: 1, sheen: 1, sheenRoughness: 0.5, sheenColor: new T.Color(0xf3e7d9) })
    solido.onBeforeCompile = (sh) => injetarPintura(sh, tex, { mrs: true })
    solido.customProgramCacheKey = () => 'judge-v2-solido'
    const penas = new T.MeshPhysicalMaterial({
      vertexColors: true,
      map: tex.penas,
      alphaTest: 0.42,
      alphaToCoverage: true,
      side: T.DoubleSide,
      roughness: 0.86,
      metalness: 0,
      sheen: 0.35,
      sheenRoughness: 0.55,
      sheenColor: new T.Color(0xf6eadb),
    })
    penas.onBeforeCompile = (sh) => injetarPintura(sh, tex, { semVirar: true, contorno: 0.3 })
    penas.customProgramCacheKey = () => 'judge-v2-penas'
    const capa = new T.MeshPhysicalMaterial({ vertexColors: true, side: T.DoubleSide, roughness: 0.78, metalness: 0, sheen: 0.9, sheenRoughness: 0.45, sheenColor: new T.Color(0x9fb6ff) })
    capa.onBeforeCompile = (sh) => injetarPintura(sh, tex, { forro: true, contorno: 0.7 })
    capa.customProgramCacheKey = () => 'judge-v2-capa'
    const cartao = new T.MeshStandardMaterial({ color: C.cartao, emissive: new T.Color(0xff1408), emissiveIntensity: 0.25, roughness: 0.42, metalness: 0 })
    return { solido, penas, capa, cartao }
  }

  // ======================================================================
  // Esculpir: roda uma vez; as cenas só reaproveitam as geometrias
  // ======================================================================
  const pausa = () => new Promise((ok) => setTimeout(ok, 0))

  function campoDaCena(pecas) {
    const lista = pecas.filter((p) => p.ocluir !== false).map((p) => ({ f: p.campoAO || p.campo, b: p.caixa }))
    return function (x, y, z) {
      let melhor = 0.4
      for (let i = 0; i < lista.length; i++) {
        const b = lista[i].b
        const dx = Math.max(b[0] - x, 0, x - b[3])
        const dy = Math.max(b[1] - y, 0, y - b[4])
        const dz = Math.max(b[2] - z, 0, z - b[5])
        if (dx * dx + dy * dy + dz * dz >= melhor * melhor) continue
        const d = lista[i].f(x, y, z)
        if (d < melhor) melhor = d
      }
      return melhor
    }
  }

  function geometriaPintada(m, pintor, ocl) {
    const nV = m.pos.length / 3
    const cor = new Float32Array(nV * 3)
    const mrs = new Float32Array(nV * 3)
    const p = new T.Vector3()
    const n = new T.Vector3()
    const s = { cor: new T.Color(), mrs: MAT.aco }
    for (let i = 0; i < nV; i++) {
      p.set(m.pos[3 * i], m.pos[3 * i + 1], m.pos[3 * i + 2])
      n.set(m.nor[3 * i], m.nor[3 * i + 1], m.nor[3 * i + 2])
      pintor(p, n, s)
      const a = aoMul(ocl(p.x, p.y, p.z, n.x, n.y, n.z))
      cor[3 * i] = s.cor.r * a
      cor[3 * i + 1] = s.cor.g * a
      cor[3 * i + 2] = s.cor.b * a
      mrs[3 * i] = s.mrs[0]
      mrs[3 * i + 1] = s.mrs[1]
      mrs[3 * i + 2] = s.mrs[2]
    }
    const g = new T.BufferGeometry()
    g.setAttribute('position', new T.BufferAttribute(m.pos.slice(), 3)) // cópia: translate() não pode mexer na malha guardada
    g.setAttribute('normal', new T.BufferAttribute(m.nor.slice(), 3))
    g.setAttribute('color', new T.BufferAttribute(cor, 3))
    g.setAttribute('mrs', new T.BufferAttribute(mrs, 3))
    g.setIndex(new T.BufferAttribute(m.idx, 1))
    return g
  }

  const pivo = (osso) => OSSOS[osso].p

  /** Esculpe tudo. aoProgresso(fração 0..1, texto). Devolve os recursos compartilhados. */
  async function esculpir(aoProgresso) {
    const avisar = aoProgresso || (() => {})
    const tex = {
      penas: E.texturaPenas(),
      pincel: E.texturaPincel(),
      ceu: E.texturaCeu(),
      brilho: E.texturaBrilho(),
    }
    const mat = criarMateriais(tex)
    const def = definirPecas()
    avisar(0.02, 'Medindo a sombra de ambiente')
    await pausa()
    const ocl = E.criarOclusao(campoDaCena(def.pecas), [-1.05, -0.05, -1.2, 1.05, 2.6, 1.2], 0.04)

    const solidos = []
    const malhas = {}
    const reais = def.pecas.filter((p) => !p.soAO)
    let feitas = 0
    for (const pc of reais) {
      avisar(0.05 + 0.8 * (feitas / reais.length), 'Esculpindo ' + pc.nome)
      await pausa()
      const m = E.malhaDoCampo(pc.campo, pc.caixa, pc.celula)
      if (pc.guardar) malhas[pc.nome] = m
      const g = geometriaPintada(m, pc.pintar, ocl)
      const pv = pivo(pc.osso)
      g.translate(-pv[0], -pv[1], -pv[2])
      g.computeBoundingSphere()
      solidos.push({ osso: pc.osso, geo: g, nome: pc.nome })
      feitas++
    }

    avisar(0.88, 'Penteando as penas')
    await pausa()
    const penas = []
    const juntar = (osso, lote) => {
      const g = E.geometriaDoLote(lote)
      const pv = pivo(osso)
      g.translate(-pv[0], -pv[1], -pv[2])
      g.computeBoundingSphere()
      penas.push({ osso, geo: g })
    }
    juntar('corpo', penasDoCorpo(malhas, ocl))
    juntar('pescoco', penasDoPescoco(malhas, ocl))
    juntar('cabeca', penasDaCabeca(malhas, ocl))
    juntar('asaE', penasDaAsa(1, ocl))
    juntar('asaD', penasDaAsa(-1, ocl))
    juntar('cauda', penasDaCauda(ocl))

    avisar(0.94, 'Costurando a capa')
    await pausa()
    for (const lado of [1, -1]) {
      const g = chifre(lado, ocl)
      const pv = pivo('elmo')
      g.translate(-pv[0], -pv[1], -pv[2])
      solidos.push({ osso: 'elmo', geo: g, nome: 'chifre' + lado })
    }
    const olho = atributosConstantes(new T.SphereGeometry(0.026, 14, 10), C.olho, MAT.olho)
    const capa = formaDaCapa(def.colisaoCapa, ocl)
    const colisaoRedea = (x, y, z) => Math.min(def.colo(x, y, z), def.cabeca(x, y, z) - 0.01, def.corpoLiso(x, y, z))
    avisar(1, 'Pronto')
    return { tex, mat, solidos, penas, olho, capa, geoCartao: geometriaCartao(), colisaoRedea }
  }

  // ======================================================================
  // Uma cópia do Judge para uma cena (as geometrias são compartilhadas)
  // ======================================================================
  const Q_REPOUSO = (() => {
    const Y = new T.Vector3(0, -0.55, 0.83).normalize()
    const Z = new T.Vector3(-1, 0, 0)
    const X = new T.Vector3().crossVectors(Y, Z)
    return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(X, Y, Z))
  })()

  function criarJudge(rec) {
    const ossos = {}
    for (const nome in OSSOS) {
      const d = OSSOS[nome]
      const g = new T.Group()
      g.name = nome
      const pp = d.pai ? OSSOS[d.pai].p : [0, 0, 0]
      g.position.set(d.p[0] - pp[0], d.p[1] - pp[1], d.p[2] - pp[2])
      if (d.pai) ossos[d.pai].add(g)
      ossos[nome] = g
    }
    const sombra = (m) => {
      m.castShadow = true
      m.receiveShadow = true
      return m
    }
    for (const s of rec.solidos) ossos[s.osso].add(sombra(new T.Mesh(s.geo, rec.mat.solido)))
    for (const s of rec.penas) ossos[s.osso].add(sombra(new T.Mesh(s.geo, rec.mat.penas)))
    for (const lado of [1, -1]) {
      const o = sombra(new T.Mesh(rec.olho, rec.mat.solido))
      o.position.set(lado * 0.138, 1.992 - 1.9, 0.75 - 0.62)
      ossos.cabeca.add(o)
    }

    // cartão na mão direita, com brilho e luz vermelha
    const cartao = new T.Group()
    cartao.position.set(PEGADA[0], PEGADA[1], PEGADA[2])
    ossos.maoD.add(cartao)
    // o vermelho do cartão fica fora do tone mapping: com ACES ele desbota para laranja
    const matCartao = rec.mat.cartao.clone()
    matCartao.toneMapped = false
    const folha = sombra(new T.Mesh(rec.geoCartao, matCartao))
    cartao.add(folha)
    const brilho = new T.Sprite(new T.SpriteMaterial({ map: rec.tex.brilho, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, toneMapped: false }))
    brilho.position.set(0, 0.09, 0.02)
    brilho.scale.setScalar(0.3)
    brilho.renderOrder = 5
    cartao.add(brilho)
    const luz = new T.PointLight(0xff4636, 0, 1.6, 2)
    luz.position.set(0, 0.09, 0.07)
    cartao.add(luz)

    // capa: geometria própria (o vento mexe nela), âncoras presas ao tronco
    const capaGeo = rec.capa.geo.clone()
    capaGeo.setAttribute('position', new T.BufferAttribute(rec.capa.repouso.slice(), 3))
    const capaMalha = sombra(new T.Mesh(capaGeo, rec.mat.capa))
    capaMalha.frustumCulled = false
    ossos.ave.add(capaMalha)
    const ancoras = []
    const tp = pivo('tronco')
    for (let i = 0; i <= rec.capa.nu; i++) {
      const a = new T.Object3D()
      a.position.set(rec.capa.repouso[3 * i] - tp[0], rec.capa.repouso[3 * i + 1] - tp[1], rec.capa.repouso[3 * i + 2] - tp[2])
      ossos.tronco.add(a)
      ancoras.push(a)
    }

    // rédeas: da mão esquerda às argolas do bico
    const pegadaE = new T.Object3D()
    pegadaE.position.set(PEGADA[0], PEGADA[1], PEGADA[2])
    ossos.maoE.add(pegadaE)
    const redeas = []
    for (const lado of [1, -1]) {
      const argola = new T.Object3D()
      argola.position.set(lado * 0.074, 0, 0.79 - 0.62)
      ossos.cabeca.add(argola)
      const geo = E.tubo([new T.Vector3(0, 1.5, 0), new T.Vector3(0, 1.6, 0.2), new T.Vector3(0, 1.7, 0.4), new T.Vector3(0, 1.8, 0.6)], () => 0.0075, 18, 5)
      atributosConstantes(geo, C.couro, MAT.couro)
      const m = sombra(new T.Mesh(geo, rec.mat.solido))
      m.frustumCulled = false
      ossos.ave.add(m)
      redeas.push({ lado, argola, geo })
    }

    const rig = {
      ossos,
      raiz: ossos.raiz,
      cartao,
      folha,
      matCartao,
      brilho,
      luz,
      capa: { geo: capaGeo, ancoras, rec: rec.capa, delta: new Float32Array((rec.capa.nu + 1) * 3) },
      redeas,
      pegadaE,
      colisaoRedea: rec.colisaoRedea,
      cavaleiroY: ossos.cavaleiro.position.y,
      qTmp: new T.Quaternion(),
      qTmp2: new T.Quaternion(),
      qErguido: new T.Quaternion(),
      eTmp: new T.Euler(),
      vTmp: new T.Vector3(),
      vTmp2: new T.Vector3(),
    }
    posar(rig, { yaw: 0, fase: 0, cartao: 0, olharAve: 0, olharJuiz: 0, surgir: 1 })
    return rig
  }

  // ======================================================================
  // Pose: determinística (mesma pose = mesma imagem), serve ao vivo e à folha
  // ======================================================================
  function moldarCapa(rig, fase) {
    const cp = rig.capa
    const R = cp.rec.repouso
    const Nr = cp.rec.normais
    const nu = cp.rec.nu
    const nv = cp.rec.nv
    const pos = cp.geo.attributes.position
    const arr = pos.array
    const v = rig.vTmp
    for (let i = 0; i <= nu; i++) {
      cp.ancoras[i].getWorldPosition(v)
      rig.ossos.ave.worldToLocal(v)
      cp.delta[3 * i] = v.x - R[3 * i]
      cp.delta[3 * i + 1] = v.y - R[3 * i + 1]
      cp.delta[3 * i + 2] = v.z - R[3 * i + 2]
    }
    const onda = 2 * PI * fase
    for (let j = 0; j <= nv; j++) {
      const t = j / nv
      const segue = 1 - smoothstep(0, 0.5, t)
      for (let i = 0; i <= nu; i++) {
        const u = (i / nu) * 2 - 1
        const k = 3 * (j * (nu + 1) + i)
        const sopro = 0.024 * t * (0.5 + 0.5 * Math.sin(onda - t * 3.4 + u * 1.2))
        arr[k] = R[k] + Nr[k] * sopro + cp.delta[3 * i] * segue + 0.012 * t * t * Math.sin(onda + u)
        arr[k + 1] = R[k + 1] + Nr[k + 1] * sopro + cp.delta[3 * i + 1] * segue
        arr[k + 2] = R[k + 2] + Nr[k + 2] * sopro + cp.delta[3 * i + 2] * segue
      }
    }
    pos.needsUpdate = true
    cp.geo.computeVertexNormals()
  }

  const _a = new T.Vector3()
  const _m = new T.Vector3()
  const _g = new T.Vector3()
  function afastar(f, p, folga) {
    const h = 0.004
    for (let it = 0; it < 3; it++) {
      const d = f(p.x, p.y, p.z)
      if (d >= folga) return
      _g.set(f(p.x + h, p.y, p.z) - f(p.x - h, p.y, p.z), f(p.x, p.y + h, p.z) - f(p.x, p.y - h, p.z), f(p.x, p.y, p.z + h) - f(p.x, p.y, p.z - h))
      if (_g.lengthSq() < 1e-12) return
      p.addScaledVector(_g.normalize(), folga - d)
    }
  }

  function moldarRedeas(rig) {
    rig.pegadaE.getWorldPosition(_m)
    rig.ossos.ave.worldToLocal(_m)
    for (const r of rig.redeas) {
      r.argola.getWorldPosition(_a)
      rig.ossos.ave.worldToLocal(_a)
      const p0 = _a.clone()
      const p1 = _a.clone().add(new T.Vector3(r.lado * 0.08, -0.1, -0.16))
      const p2 = p1.clone().lerp(_m, 0.5).add(new T.Vector3(r.lado * 0.06, -0.03, 0))
      afastar(rig.colisaoRedea, p1, 0.02)
      afastar(rig.colisaoRedea, p2, 0.02)
      E.tubo([p0, p1, p2, _m.clone()], () => 0.0075, 18, 5, null, r.geo)
    }
  }

  /**
   * p = { yaw, fase 0..1 (respiração), cartao 0..1, olharAve, olharJuiz (rad), surgir 0..1 }
   */
  function posar(rig, p) {
    const o = rig.ossos
    const s = Math.sin(2 * PI * p.fase)
    const s2 = Math.sin(2 * PI * p.fase - 0.7)
    const c = clamp(p.cartao, 0, 1)
    const braco = smoothstep(0, 1, c)
    const estica = smoothstep(0.3, 1, c)
    rig.raiz.rotation.y = p.yaw
    rig.raiz.position.y = -(1 - p.surgir) * 3.4

    // ave: o peito sobe, as asas assentam, a cauda e a cabeça acompanham
    o.corpo.scale.set(1 + 0.005 * s, 1 + 0.012 * s, 1 + 0.006 * s)
    o.asaE.rotation.set(0.015 * s2, 0, 0.2 + 0.03 * s)
    o.asaD.rotation.set(0.015 * s2, 0, -0.2 - 0.03 * s)
    o.cauda.rotation.set(-0.035 * s2, 0.02 * Math.sin(4 * PI * p.fase), 0)
    o.pescoco.rotation.set(-0.025 * s2 - 0.05 * c, p.olharAve * 0.45, 0)
    o.cabeca.rotation.set(0.035 * s2 + 0.07 * c, p.olharAve * 0.55, 0)

    // juiz: assenta na sela, inclina para trás ao erguer o cartão
    o.cavaleiro.position.y = rig.cavaleiroY + 0.01 * s2
    o.tronco.rotation.set(0.012 * s2 - 0.05 * c, -0.1 * c, 0)
    o.elmo.rotation.set(-0.08 * c, p.olharJuiz + 0.06 * c, 0)

    // braço do cartão (direito): varre para a frente e para cima (como o juiz da pintura,
    // que mostra o cartão para a frente da ave), o cotovelo estica no fim
    o.bracoD.rotation.set(mix(-0.3, -2.75, braco), mix(0, 0.1, braco), mix(-0.2, -0.4, braco))
    o.cotoveloD.rotation.set(mix(-1.0, -0.35, estica), 0, 0)
    o.maoD.rotation.set(mix(-0.35, 0, estica), 0, 0)
    o.ombreiraD.rotation.set(o.bracoD.rotation.x * 0.2, 0, o.bracoD.rotation.z * 0.4)
    // braço das rédeas (esquerdo)
    o.bracoE.rotation.set(-0.52 + 0.015 * s2, 0, 0.16)
    o.cotoveloE.rotation.set(-1.18, 0, -0.35)
    o.maoE.rotation.set(-0.15, 0, 0)
    o.ombreiraE.rotation.set(o.bracoE.rotation.x * 0.2, 0, o.bracoE.rotation.z * 0.4)

    // no alto, o cartão vira de frente para quem olha a mesa
    rig.raiz.updateMatrixWorld(true)
    const qMao = o.maoD.getWorldQuaternion(rig.qTmp)
    const qQuer = rig.qTmp2.copy(qMao).multiply(Q_REPOUSO)
    const vira = smoothstep(0.35, 0.95, c)
    // inclinação para a câmera: -0,42 na mesa (câmera a 30 graus); a vista grande manda a sua
    const incl = p.inclinacaoCartao === undefined ? -0.42 : p.inclinacaoCartao
    rig.eTmp.set(incl, 0, 0)
    qQuer.slerp(rig.qErguido.setFromEuler(rig.eTmp), vira)
    rig.cartao.quaternion.copy(qMao.invert().multiply(qQuer))
    const brilha = smoothstep(0.55, 1, c)
    rig.matCartao.emissiveIntensity = 0.25 + 0.8 * brilha
    rig.brilho.material.opacity = 0.55 * brilha
    rig.brilho.scale.setScalar(0.24 + 0.1 * brilha)
    rig.luz.intensity = 0.07 * brilha

    rig.raiz.updateMatrixWorld(true)
    moldarCapa(rig, p.fase)
    moldarRedeas(rig)
  }

  /** Luzes parecidas com as da pintura: céu frio, contraluz forte atrás à esquerda. */
  function montarLuzes(cena, renderer, rec, tamanhoSombra) {
    const hemi = new T.HemisphereLight(0xbccaf0, 0x2b2622, 0.55)
    const sol = new T.DirectionalLight(0xfff1e2, 2.5)
    sol.position.set(-2.2, 5.2, 3.0)
    sol.target.position.set(0, 1.2, 0)
    sol.castShadow = true
    sol.shadow.mapSize.set(tamanhoSombra, tamanhoSombra)
    const sc = sol.shadow.camera
    sc.left = -1.9
    sc.right = 1.9
    sc.top = 1.9
    sc.bottom = -1.9
    sc.near = 1
    sc.far = 14
    sol.shadow.bias = -0.0004
    sol.shadow.normalBias = 0.012
    sol.shadow.radius = 3
    const contra = new T.DirectionalLight(0xd2e1ff, 2.6)
    contra.position.set(-1.6, 3.0, -4.2)
    const preenche = new T.DirectionalLight(0x7d93cc, 0.5)
    preenche.position.set(3.5, 1.2, 1.5)
    cena.add(hemi, sol, sol.target, contra, preenche)
    const pm = new T.PMREMGenerator(renderer)
    cena.environment = pm.fromEquirectangular(rec.tex.ceu).texture
    cena.environmentIntensity = 0.8
    pm.dispose()
    return { hemi, sol, contra, preenche }
  }

  function prepararRenderer(r) {
    r.outputColorSpace = T.SRGBColorSpace
    r.toneMapping = T.ACESFilmicToneMapping
    r.toneMappingExposure = 1.0
    r.shadowMap.enabled = true
    r.shadowMap.type = T.PCFShadowMap
  }

  /** Peças desenhadas e triângulos de uma cópia. */
  function contar(raiz) {
    let pecas = 0
    let triangulos = 0
    raiz.traverse((o) => {
      if (!o.isMesh || !o.visible) return
      pecas++
      const g = o.geometry
      triangulos += (g.index ? g.index.count : g.attributes.position.count) / 3
    })
    return { pecas, triangulos: Math.round(triangulos) }
  }

  window.JudgeV2 = { esculpir, criarJudge, posar, montarLuzes, prepararRenderer, contar, PERIODO_RESPIRO_S, COR: HEX }
})()
