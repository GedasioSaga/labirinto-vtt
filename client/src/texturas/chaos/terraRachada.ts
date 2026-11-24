import { empacotar, fbm, hash, luz, misturar, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * TERRA RACHADA (lote L11 de 24/11/2026, "Arena e cortiço"; textura nova, id `terra-rachada`): o fundo do fosso da
 * arena. Terra batida marrom-acinzentada, socada por anos de pés: manchas largas mais claras e secas onde mais se
 * pisa e mais fundas e úmidas nos cantos. Por cima, o barro que secou e rachou em PLACAS: fendas finas e tortas, que
 * afinam e somem no meio do caminho (a rede inteira só aparece onde a máscara deixa); cada placa num tom um nada
 * diferente, um pouco abaulada (mais clara no meio dela), a beira virada para a luz acesa e a de costas na sombra.
 * Entre as fendas grandes, os fios de cabelo de uma rede bem mais miúda, quase apagada.
 *
 * Ladrilho de 8 casas, sem junta e sem grade: as placas têm de meia a uma casa e meia e nenhuma fenda corre reta.
 * A mesma rede de fendas desenha o chão do fosso de arena (`moveis/fossoDeArena.ts`, por `rachadura`).
 */

/** Ladrilho de 8 casas: as larguras das fendas são em casas. */
const CASAS = 8
/** As placas: células por lado do ladrilho, a folga do ponto de cada uma e o quanto a rede é torcida (em células). */
const PLACAS = { celulas: 9, folga: 0.44, torcao: 0.42 } as const
/** Os fios de cabelo: a rede miúda, bem mais fraca. */
const FIOS = { celulas: 31, folga: 0.46, torcao: 0.25 } as const
/** Meia largura do miolo e do halo da fenda, em casas, e quanto cada um puxa para a cor dela. */
const FENDA = { miolo: 0.012, halo: 0.045, forcaMiolo: 0.62, forcaHalo: 0.14 } as const
const FIO = { miolo: 0.007, forca: 0.2 } as const
/** A beira da placa: até onde (casas) ela acende virada para a luz ou escurece de costas, e quanto. */
const BEIRA = { largura: 0.07, luz: 0.07, sombra: 0.05 } as const
/** O abaulado da placa (mais clara no meio) e o tom sorteado de cada uma. */
const ABAULADO = 0.035
const TOM_DA_PLACA = 0.05

/** Marrom-acinzentado: a terra socada, a seca e clara das manchas largas e a funda e úmida. */
const TERRA: Rgb = rgb('#877766')
const TERRA_CLARA: Rgb = rgb('#9c8d79')
const TERRA_FUNDA: Rgb = rgb('#756758')
/** O fundo da fenda. */
const COR_DA_FENDA: Rgb = rgb('#473d35')

/** De onde vem a luz no plano (de cima à esquerda, a do relevo). */
const LUZ_X = -0.79
const LUZ_Y = -0.61

/**
 * A RACHADURA mais perto do ponto (x, y), dado em CÉLULAS: a borda entre as duas células de Voronoi mais perto dele.
 * `n` = quantas células a grade tem de lado antes de dar a volta (0 = não dá a volta: o chão de um objeto). Escreve
 * em `saida`: [0] a distância até a fenda (em células), [1] o quanto a beira da placa em que o ponto está é virada
 * para a luz (-1 de costas a 1 de frente) e [2] o sorteio da placa (0 a 1).
 */
export function rachadura(x: number, y: number, n: number, semente: number, folga: number, saida: Float64Array): void {
  const cx = Math.floor(x)
  const cy = Math.floor(y)
  const indice = (i: number): number => (n > 0 ? ((i % n) + n) % n : i)
  let melhor = Infinity
  let ax = 0
  let ay = 0
  let placa = 0
  for (let oy = -1; oy <= 1; oy += 1) {
    for (let ox = -1; ox <= 1; ox += 1) {
      const ix = indice(cx + ox)
      const iy = indice(cy + oy)
      const dx = x - (cx + ox + 0.5 + (hash(ix, iy, semente) - 0.5) * 2 * folga)
      const dy = y - (cy + oy + 0.5 + (hash(ix, iy, semente + 1) - 0.5) * 2 * folga)
      const d2 = dx * dx + dy * dy
      if (d2 < melhor) {
        melhor = d2
        ax = dx
        ay = dy
        placa = hash(ix, iy, semente + 2)
      }
    }
  }
  let borda = Infinity
  let virada = 0
  for (let oy = -1; oy <= 1; oy += 1) {
    for (let ox = -1; ox <= 1; ox += 1) {
      const ix = indice(cx + ox)
      const iy = indice(cy + oy)
      const dx = x - (cx + ox + 0.5 + (hash(ix, iy, semente) - 0.5) * 2 * folga)
      const dy = y - (cy + oy + 0.5 + (hash(ix, iy, semente + 1) - 0.5) * 2 * folga)
      // (qx, qy) vai do miolo desta placa ao da vizinha: a normal da beira, para fora.
      const qx = ax - dx
      const qy = ay - dy
      const entre = Math.sqrt(qx * qx + qy * qy)
      if (entre < 1e-9) continue
      const s = (dx * dx + dy * dy - melhor) / (2 * entre)
      if (s < borda) {
        borda = s
        virada = (qx * LUZ_X + qy * LUZ_Y) / entre
      }
    }
  }
  saida[0] = borda
  saida[1] = virada
  saida[2] = placa
}

const R = new Float64Array(3)

function naVolta(t: number): number {
  return t - Math.floor(t)
}

/** A cor da terra rachada no ponto (u, v) do ladrilho. */
export function texturaTerraRachada(u: number, v: number): number {
  const uu = naVolta(u)
  const vv = naVolta(v)
  // As manchas largas: a terra seca e clara onde mais se pisa, a funda nos baixos.
  const largo = fbm(uu, vv, 2, 3, 3301)
  const medio = fbm(uu, vv, 6, 3, 3302)
  let c = misturar(TERRA, TERRA_CLARA, passoSuave(-0.3, 0.6, largo * 0.85 + medio * 0.3))
  c = misturar(c, TERRA_FUNDA, passoSuave(0.15, 0.75, -medio - largo * 0.3) * 0.6)

  // As placas: a rede torcida pelo ruído (nenhuma fenda corre reta) e só onde a máscara deixa.
  const n = PLACAS.celulas
  rachadura(uu * n + fbm(uu, vv, 5, 2, 3303) * PLACAS.torcao, vv * n + fbm(uu, vv, 5, 2, 3304) * PLACAS.torcao, n, 3305, PLACAS.folga, R)
  const d = (R[0] * CASAS) / n
  const virada = R[1]
  const mascara = passoSuave(-0.2, 0.28, fbm(uu, vv, 3, 3, 3306))
  // O tom de cada placa e o abaulado dela (some onde não há fenda: ali é terra solta, sem placa).
  c = luz(c, mascara * ((R[2] - 0.5) * TOM_DA_PLACA + ABAULADO * (passoSuave(0, 0.3, d) - 0.6)))
  // A beira: acesa virada para a luz, na sombra de costas.
  const beira = passoSuave(BEIRA.largura, FENDA.miolo, d) * mascara
  c = luz(c, beira * (virada > 0 ? virada * BEIRA.luz : virada * BEIRA.sombra))

  // O grão: a terra socada em duas escalas, sem risco.
  c = luz(c, fbm(uu, vv, 28, 2, 3307) * 0.035 + (valor(uu * 512, vv * 512, 512, 3308) - 0.5) * 0.035)

  // Os fios de cabelo, antes das fendas (a fenda passa por cima).
  const m = FIOS.celulas
  rachadura(uu * m + fbm(uu, vv, 9, 2, 3309) * FIOS.torcao, vv * m + fbm(uu, vv, 9, 2, 3310) * FIOS.torcao, m, 3311, FIOS.folga, R)
  const fio = passoSuave(FIO.miolo, 0, (R[0] * CASAS) / m) * passoSuave(0.05, 0.5, fbm(uu, vv, 4, 2, 3312)) * mascara
  c = misturar(c, COR_DA_FENDA, fio * FIO.forca)

  // As fendas: o miolo fino e escuro e o halo úmido em volta; afinam com a máscara até sumir.
  if (mascara > 0) {
    const fenda = passoSuave(FENDA.miolo * mascara, 0, d) * FENDA.forcaMiolo + passoSuave(FENDA.halo * mascara, 0, d) * FENDA.forcaHalo
    c = misturar(c, COR_DA_FENDA, fenda)
  }
  return empacotar(c)
}
