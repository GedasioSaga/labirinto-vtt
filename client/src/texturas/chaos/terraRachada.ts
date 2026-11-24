import { empacotar, fbm, hash, luz, misturar, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * TERRA RACHADA (lote L11 de 24/11/2026, "Arena e cortiço"; textura nova, id `terra-rachada`): o fundo do fosso da
 * arena. Terra batida marrom-acinzentada, socada por anos de pés: manchas de uma casa, mais claras e secas onde mais
 * se pisa e um nada mais fundas ao lado (a variação mora na escala média: a mancha larga, uma por ladrilho, entregava
 * a emenda no 3 x 3). Por cima, o barro que secou e rachou em DOIS NÍVEIS: as fendas MESTRAS, largas, que separam as
 * placas grandes (de uma casa e meia), com a beira virada para a luz bem acesa e a de costas na sombra; e, dentro de
 * cada placa grande, a rede SECUNDÁRIA, fina e apagada, que a parte em três ou quatro. As fendas afinam e somem no
 * meio do caminho (a rede só aparece onde a máscara deixa: um terço do chão é terra solta, sem placa). Cada placa
 * num tom um nada diferente, um pouco abaulada. Entre as fendas, os fios de cabelo de uma rede bem mais miúda.
 *
 * Ladrilho de 8 casas, sem junta e sem grade: nenhuma fenda corre reta.
 * A mesma rede de fendas desenha o chão do fosso de arena (`moveis/fossoDeArena.ts`, por `rachadura`).
 */

/** Ladrilho de 8 casas: as larguras das fendas são em casas. */
const CASAS = 8
/**
 * As placas: células por lado do ladrilho (par: as placas grandes juntam as células de duas em duas e a conta tem de
 * dar a volta certa), a folga do ponto de cada uma e o quanto a rede é torcida (em células).
 */
const PLACAS = { celulas: 10, folga: 0.44, torcao: 0.42 } as const
/** Os fios de cabelo: a rede miúda, bem mais fraca. */
const FIOS = { celulas: 31, folga: 0.46, torcao: 0.25 } as const
/** A fenda MESTRA: meia largura do miolo e do halo, em casas, e quanto cada um puxa para a cor dela. */
const FENDA = { miolo: 0.022, halo: 0.06, forcaMiolo: 0.66, forcaHalo: 0.15 } as const
/** A rede SECUNDÁRIA, dentro das placas grandes: mais fina e mais apagada. */
const SECUNDARIA = { miolo: 0.01, halo: 0.03, forcaMiolo: 0.4, forcaHalo: 0.07 } as const
const FIO = { miolo: 0.007, forca: 0.16 } as const
/** A beira da placa grande: até onde (casas) ela acende virada para a luz ou escurece de costas, e quanto. */
const BEIRA = { largura: 0.085, luz: 0.12, sombra: 0.06 } as const
/** A beira da placa pequena (a da rede secundária): quase nada. */
const BEIRA_SECUNDARIA = { largura: 0.05, luz: 0.035, sombra: 0.025 } as const
/**
 * A máscara das placas: abaixo de `de` o chão é terra solta, sem placa; acima de `ate`, a rede inteira. O ruído dela
 * (fbm de 4 por ladrilho, 3 oitavas) tem o percentil 35 em -0,09 e o 78 em 0,16 (medido em 24/11/2026): 35% do chão
 * fica sem placa. Com 0 e 0,4 metade do chão ficava nua e a rede quase nunca chegava inteira: sobrava um cacho de
 * fendas por ladrilho, que entregava a repetição.
 */
const MASCARA = { de: -0.09, ate: 0.16 } as const
/** Quanto a terra funda entra nos baixos (com 0,6 a mancha escura larga entregava a emenda). */
const QUANTO_DA_FUNDA = 0.3
/** O abaulado da placa (mais clara no meio) e o tom sorteado de cada uma. */
const ABAULADO = 0.035
const TOM_DA_PLACA = 0.05

/** Marrom-acinzentado: a terra socada, a seca e clara das manchas e a funda e úmida. */
const TERRA: Rgb = rgb('#877766')
const TERRA_CLARA: Rgb = rgb('#9c8d79')
const TERRA_FUNDA: Rgb = rgb('#756758')
/** O fundo da fenda. */
const COR_DA_FENDA: Rgb = rgb('#473d35')

/** De onde vem a luz no plano (de cima à esquerda, a do relevo). */
const LUZ_X = -0.79
const LUZ_Y = -0.61

/**
 * A placa GRANDE da célula (ix, iy): as células juntam-se de duas em duas, com as fileiras desencontradas (a grade das
 * grandes não aparece). `n` = quantas células a grade tem de lado antes de dar a volta (par; 0 = não dá a volta).
 */
function placaGrande(ix: number, iy: number, n: number): number {
  const py = Math.floor(iy / 2)
  let px = Math.floor((ix + (py & 1)) / 2)
  if (n > 0) px = ((px % (n / 2)) + n / 2) % (n / 2)
  return px * 4099 + py
}

/**
 * A RACHADURA mais perto do ponto (x, y), dado em CÉLULAS: a borda entre as duas células de Voronoi mais perto dele.
 * `n` = quantas células a grade tem de lado antes de dar a volta (par; 0 = não dá a volta: o chão de um objeto).
 * Escreve em `saida` (5 lugares): [0] a distância até a fenda (em células), [1] o quanto a beira da placa em que o
 * ponto está é virada para a luz (-1 de costas a 1 de frente) e [2] o sorteio da placa (0 a 1); [3] e [4], o mesmo
 * que [0] e [1] só para a fenda MESTRA (a borda com uma célula de outra placa grande).
 */
export function rachadura(x: number, y: number, n: number, semente: number, folga: number, saida: Float64Array): void {
  const cx = Math.floor(x)
  const cy = Math.floor(y)
  const indice = (i: number): number => (n > 0 ? ((i % n) + n) % n : i)
  let melhor = Infinity
  let ax = 0
  let ay = 0
  let placa = 0
  let grande = 0
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
        grande = placaGrande(ix, iy, n)
      }
    }
  }
  let borda = Infinity
  let virada = 0
  let mestra = Infinity
  let viradaDaMestra = 0
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
      const paraALuz = (qx * LUZ_X + qy * LUZ_Y) / entre
      if (s < borda) {
        borda = s
        virada = paraALuz
      }
      if (s < mestra && placaGrande(ix, iy, n) !== grande) {
        mestra = s
        viradaDaMestra = paraALuz
      }
    }
  }
  saida[0] = borda
  saida[1] = virada
  saida[2] = placa
  saida[3] = mestra
  saida[4] = viradaDaMestra
}

const R = new Float64Array(5)

function naVolta(t: number): number {
  return t - Math.floor(t)
}

/** A cor da terra rachada no ponto (u, v) do ladrilho. */
export function texturaTerraRachada(u: number, v: number): number {
  const uu = naVolta(u)
  const vv = naVolta(v)
  // As manchas: a terra seca e clara onde mais se pisa e a funda ao lado, na escala de uma casa (6 a 10 por ladrilho).
  // A mancha larga (2 por ladrilho) entra só de leve: era ela que desenhava a mesma nuvem escura a cada ladrilho.
  const largo = fbm(uu, vv, 2, 3, 3301)
  const medio = fbm(uu, vv, 6, 3, 3302)
  const miudo = fbm(uu, vv, 10, 2, 3313)
  let c = misturar(TERRA, TERRA_CLARA, passoSuave(-0.3, 0.6, medio * 0.7 + miudo * 0.45 + largo * 0.2))
  c = misturar(c, TERRA_FUNDA, passoSuave(0.15, 0.75, -medio * 0.8 - miudo * 0.5 - largo * 0.1) * QUANTO_DA_FUNDA)

  // As placas: a rede torcida pelo ruído (nenhuma fenda corre reta) e só onde a máscara deixa.
  const n = PLACAS.celulas
  rachadura(uu * n + fbm(uu, vv, 5, 2, 3303) * PLACAS.torcao, vv * n + fbm(uu, vv, 5, 2, 3304) * PLACAS.torcao, n, 3305, PLACAS.folga, R)
  const d = (R[0] * CASAS) / n
  const virada = R[1]
  const dMestra = (R[3] * CASAS) / n
  const viradaDaMestra = R[4]
  const mascara = passoSuave(MASCARA.de, MASCARA.ate, fbm(uu, vv, 4, 3, 3306))
  // A rede secundária some antes da mestra: onde a máscara é fraca sobra só a fenda grande, sozinha.
  const mascaraDaSecundaria = mascara * passoSuave(0.15, 0.7, mascara + fbm(uu, vv, 7, 2, 3314) * 0.5)
  // O tom de cada placa e o abaulado da placa grande (some onde não há fenda: ali é terra solta, sem placa).
  c = luz(c, mascara * ((R[2] - 0.5) * TOM_DA_PLACA + ABAULADO * (passoSuave(0, 0.36, dMestra) - 0.6)))
  // A beira: acesa virada para a luz, na sombra de costas; a da placa grande aparece, a da pequena é um nada.
  const beira = passoSuave(BEIRA.largura, FENDA.miolo, dMestra) * mascara
  c = luz(c, beira * (viradaDaMestra > 0 ? viradaDaMestra * BEIRA.luz : viradaDaMestra * BEIRA.sombra))
  const beiraPequena = passoSuave(BEIRA_SECUNDARIA.largura, SECUNDARIA.miolo, d) * mascaraDaSecundaria
  c = luz(c, beiraPequena * (virada > 0 ? virada * BEIRA_SECUNDARIA.luz : virada * BEIRA_SECUNDARIA.sombra))

  // O grão: a terra socada em duas escalas, sem risco.
  c = luz(c, fbm(uu, vv, 28, 2, 3307) * 0.035 + (valor(uu * 512, vv * 512, 512, 3308) - 0.5) * 0.035)

  // Os fios de cabelo, antes das fendas (a fenda passa por cima).
  const m = FIOS.celulas
  rachadura(uu * m + fbm(uu, vv, 9, 2, 3309) * FIOS.torcao, vv * m + fbm(uu, vv, 9, 2, 3310) * FIOS.torcao, m, 3311, FIOS.folga, R)
  const fio = passoSuave(FIO.miolo, 0, (R[0] * CASAS) / m) * passoSuave(0.05, 0.5, fbm(uu, vv, 4, 2, 3312)) * mascaraDaSecundaria
  c = misturar(c, COR_DA_FENDA, fio * FIO.forca)

  // As fendas: a secundária, fina e apagada, e por cima a mestra, larga, com o halo úmido em volta. As duas afinam
  // com a máscara até sumir.
  if (mascaraDaSecundaria > 0) {
    const fina = passoSuave(SECUNDARIA.miolo * mascaraDaSecundaria, 0, d) * SECUNDARIA.forcaMiolo + passoSuave(SECUNDARIA.halo * mascaraDaSecundaria, 0, d) * SECUNDARIA.forcaHalo
    c = misturar(c, COR_DA_FENDA, fina)
  }
  if (mascara > 0) {
    // A largura da mestra também varia ao longo dela: fenda de largura igual em todo lugar é pele de crocodilo.
    const larga = mascara * (0.8 + 0.4 * fbm(uu, vv, 8, 2, 3315))
    const fenda = passoSuave(FENDA.miolo * larga, 0, dMestra) * FENDA.forcaMiolo + passoSuave(FENDA.halo * mascara, 0, dMestra) * FENDA.forcaHalo
    c = misturar(c, COR_DA_FENDA, fenda)
  }
  return empacotar(c)
}
