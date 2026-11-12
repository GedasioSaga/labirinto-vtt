import { hash } from './ruido'

/**
 * OS TRÊS MODELOS DE TELHADO DE 12/11/2026 (pedido do mestre: "mais versões
 * de telhados", para a vila não ter todas as casas iguais). A mesma forma de
 * hoje (águas, cumeeira, chaminé: `texturas/telhado.ts` cuida delas); aqui só
 * o MATERIAL, no ponto (`v` = altura desde a ponta do beiral, `u` = régua ao
 * longo da borda, `luzAoLongo` = o quanto a luz corre ao longo da borda), como
 * `luzDaTelha` e `luzDaMadeira`. Cada um se distingue dos outros pelo DESENHO,
 * também pequeno e de noite (a tinta azul do período tira a cor e deixa a luz):
 *
 * - ARDÓSIA: placas finas de pedra em fiadas paralelas ao beiral, desencontradas
 *   meia placa (com folga sorteada), largura de 11 a 23 px. Cada placa um tom,
 *   umas mais claras, umas com veio claro; fresta escura fina entre elas e a
 *   sombra fina da placa de cima. Uma ou outra trincada ou faltando. O musgo
 *   junto à cumeeira é pintado por `telhado.ts` (precisa da distância ao cume).
 * - METAL: chapas que descem da cumeeira ao beiral, de 12 a 14 px, com a junta
 *   em pé entre elas (um fio de luz do lado virado para a luz, sombra do outro),
 *   a emenda de topo desencontrada com uma fileira de rebites, e a pátina
 *   escorrida no sentido da água (riscos compridos que puxam para o cinza).
 * - TABUINHAS: telhinhas curtas de madeira rachada, fiadas de 6,5 px bem
 *   desencontradas, larguras de 3 a 11 px, pontas gastas e arredondadas (o canto
 *   de baixo de cada uma é comido, e ali aparece a sombra da fiada de baixo),
 *   umas empenadas, umas rachadas, sombra grossa debaixo de cada fiada.
 *
 * Puro e sem `Math.random`: todo sorteio é `hash`. O que o material diz além
 * da luz (quanto o pixel puxa para o cinza da própria cor, e o sorteio da
 * peça, que escolhe onde nasce o musgo) sai em `SAIDA_DO_MATERIAL`, lida
 * logo depois da chamada.
 */

/** Material de telhado no ponto: devolve a variação de luz e escreve o resto em `SAIDA_DO_MATERIAL`. */
export type LuzDoMaterial = (v: number, u: number, luzAoLongo: number) => number

export const SAIDA_DO_MATERIAL = new Float64Array(2)
/** 0 a 1: quanto o pixel puxa para o cinza da própria cor (pátina, madeira lavada de chuva). */
export const S_PARA_O_NEUTRO = 0
/** 0 a 1: o sorteio da peça do pixel (placa, chapa, tabuinha). */
export const S_SORTEIO_DA_PECA = 1

const TAU = Math.PI * 2
const PASSOS_DO_SENO = 1024
const SENO = new Float64Array(PASSOS_DO_SENO)
for (let i = 0; i < PASSOS_DO_SENO; i += 1) SENO[i] = Math.sin(((i + 0.5) / PASSOS_DO_SENO) * TAU)
const SENO_POR_RADIANO = PASSOS_DO_SENO / TAU
function seno(x: number): number {
  return SENO[((x * SENO_POR_RADIANO) | 0) & (PASSOS_DO_SENO - 1)]
}

/** De 0 (em `a` ou antes) a 1 (em `a + 1 / inverso` ou depois), suave. */
function rampa(a: number, inverso: number, t: number): number {
  const x = (t - a) * inverso
  if (x <= 0) return 0
  if (x >= 1) return 1
  return x * x * (3 - 2 * x)
}

/*
 * Memória curta dos sorteios (como `MEMORIA` em `telhado.ts`): pixels vizinhos
 * caem na mesma fiada e na mesma peça. Só lembra, não muda o resultado.
 */
const MEMORIA = new Float64Array(24)
// A fiada e as bordas da peça (`pecaNaFileira`).
const M_FILEIRA = 0
const M_J0 = 1
const M_B0 = 2
const M_B1 = 3
// O desencontro da fiada.
const M_FILEIRA_DO_DESLOCAMENTO = 4
const M_DESLOCAMENTO = 5
// Os sorteios da peça (placa ou tabuinha).
const M_PECA_FILEIRA = 6
const M_PECA = 7
const M_SORTEIO = 8
const M_TIPO = 9
const M_A = 10
const M_B = 11
const M_FASE = 12
const M_SECO = 13
// A chapa do metal.
const M_CHAPA_J0 = 14
const M_CHAPA_B0 = 15
const M_CHAPA_B1 = 16
const M_CHAPA = 17
const M_CHAPA_COMPRIMENTO = 18
const M_CHAPA_DESLOCAMENTO = 19
const M_CHAPA_FASE = 20

/** Esquece os sorteios guardados (uma pintura nova começa limpa). */
export function esquecerMateriais(): void {
  MEMORIA.fill(Number.NaN)
}
esquecerMateriais()

/**
 * A peça da fiada `n` que cobre `u`, entre bordas sorteadas: grava em `inicioFim`
 * o começo e o fim dela e devolve o índice. `deslocamento(n)` diz quanto a fiada
 * anda (desencontro); `folga` é quanto cada borda pode sair do lugar (× largura).
 */
const INICIO_FIM = new Float64Array(2)
function pecaNaFileira(n: number, u: number, largura: number, folga: number, semente: number, deslocamento: number): number {
  const m = MEMORIA
  const j0 = Math.floor(u / largura - deslocamento)
  if (m[M_FILEIRA] !== n || m[M_J0] !== j0) {
    m[M_FILEIRA] = n
    m[M_J0] = j0
    m[M_B0] = (j0 + deslocamento + (hash(n, j0, semente) - 0.5) * folga) * largura
    m[M_B1] = (j0 + 1 + deslocamento + (hash(n, j0 + 1, semente) - 0.5) * folga) * largura
  }
  const b0 = m[M_B0]
  const b1 = m[M_B1]
  if (u < b0) {
    INICIO_FIM[0] = (j0 - 1 + deslocamento + (hash(n, j0 - 1, semente) - 0.5) * folga) * largura
    INICIO_FIM[1] = b0
    return j0 - 1
  }
  if (u >= b1) {
    INICIO_FIM[0] = b1
    INICIO_FIM[1] = (j0 + 2 + deslocamento + (hash(n, j0 + 2, semente) - 0.5) * folga) * largura
    return j0 + 1
  }
  INICIO_FIM[0] = b0
  INICIO_FIM[1] = b1
  return j0
}

// ---------- ardósia ----------

/** Altura de uma fiada de ardósia (a parte da placa que fica à mostra), px do mapa. */
export const CURSO_DA_ARDOSIA_PX = 10
/** Largura média da placa; cada borda sai do lugar até 18% disso (placas de 11 a 23 px). */
export const LARGURA_DA_ARDOSIA_PX = 17
const SEMENTE_DA_ARDOSIA = 6131
const INVERSO_DO_CURSO_DA_ARDOSIA = 1 / CURSO_DA_ARDOSIA_PX

/** Fiadas desencontradas meia placa, com folga sorteada: a junta nunca vira coluna. */
function deslocamentoDaArdosia(n: number): number {
  return (n & 1) * 0.5 + (hash(n, 0, SEMENTE_DA_ARDOSIA + 7) - 0.5) * 0.3
}

// O que a placa tem além do tom (pelo segundo sorteio dela).
const PLACA_LISA = 0
const PLACA_CLARA = 1
const PLACA_COM_VEIO = 2
const PLACA_TRINCADA = 3
const PLACA_FALTANDO = 4

/**
 * O tipo da placa da fiada `n` pelo sorteio `s`: 12% mais claras, 18% com veio,
 * 4% trincadas, 0,8% faltando (nunca na fiada do beiral: ali o buraco parecia
 * um dente na borda do telhado, folha de 12/11).
 */
function tipoDaPlaca(n: number, s: number): number {
  if (s < 0.12) return PLACA_CLARA
  if (s < 0.3) return PLACA_COM_VEIO
  if (s < 0.34) return PLACA_TRINCADA
  if (s < 0.348 && n > 0) return PLACA_FALTANDO
  return PLACA_LISA
}

/** Ardósia no ponto. Devolve a variação de luz; o sorteio da placa vai para `SAIDA_DO_MATERIAL` (o musgo usa). */
export function luzDaArdosia(v: number, u: number, luzAoLongo: number): number {
  // Uma onda longa e baixa na linha da fiada: a régua reta viraria risco.
  const rv = (v + 0.45 * seno(u * 0.09 + v * 0.05 + 0.7)) * INVERSO_DO_CURSO_DA_ARDOSIA
  const n = Math.floor(rv)
  const y = (rv - n) * CURSO_DA_ARDOSIA_PX // px acima da beira de baixo da placa
  const m = MEMORIA
  if (m[M_FILEIRA_DO_DESLOCAMENTO] !== n) {
    m[M_FILEIRA_DO_DESLOCAMENTO] = n
    m[M_DESLOCAMENTO] = deslocamentoDaArdosia(n)
  }
  const j = pecaNaFileira(n, u, LARGURA_DA_ARDOSIA_PX, 0.36, SEMENTE_DA_ARDOSIA, m[M_DESLOCAMENTO])
  const inicio = INICIO_FIM[0]
  const fim = INICIO_FIM[1]
  if (m[M_PECA_FILEIRA] !== n || m[M_PECA] !== j) {
    m[M_PECA_FILEIRA] = n
    m[M_PECA] = j
    m[M_SORTEIO] = hash(n, j, SEMENTE_DA_ARDOSIA + 1)
    const s2 = hash(n, j, SEMENTE_DA_ARDOSIA + 2)
    m[M_TIPO] = tipoDaPlaca(n, s2)
    // Veio e trinca: uma reta que cruza a placa de `a` (embaixo) a `b` (em cima), em fração da largura.
    m[M_A] = hash(n, j, SEMENTE_DA_ARDOSIA + 3)
    m[M_B] = hash(n, j, SEMENTE_DA_ARDOSIA + 4)
  }
  const sorteio = m[M_SORTEIO]
  SAIDA_DO_MATERIAL[S_PARA_O_NEUTRO] = 0
  SAIDA_DO_MATERIAL[S_SORTEIO_DA_PECA] = sorteio
  const tipo = m[M_TIPO]
  const naPlaca = u - inicio
  const ateFim = fim - u
  const largura = fim - inicio
  const ateTopo = CURSO_DA_ARDOSIA_PX - y
  if (tipo === PLACA_FALTANDO) {
    // O buraco: escuro, um pouco menos no alto (a placa de baixo aparece), com a beira suave.
    return -0.24 + 0.012 * y + 0.16 * (1 - rampa(0, 1 / 0.8, Math.min(naPlaca, ateFim)))
  }
  let luz =
    0.035 + // devolve a média ao tom escolhido (fresta e sombra escurecem em média)
    (sorteio - 0.5) * 0.14 - // cada placa um tom
    0.003 * y // o alto da placa um tico mais escuro
  if (tipo === PLACA_CLARA) luz += 0.06
  // A beira de baixo, cortada, pega luz; o alto fica na sombra fina da placa de cima.
  if (y < 0.9) luz += 0.05 * (1 - rampa(0, 1 / 0.9, y))
  if (ateTopo < 1.2) luz -= 0.24 * (1 - rampa(0.1, 1 / 1.1, ateTopo))
  // Fresta entre placas da mesma fiada, com a beira virada para a luz um tico mais clara.
  const ateBorda = naPlaca < ateFim ? naPlaca : ateFim
  if (ateBorda < 1.3) {
    luz -= 0.3 * (1 - rampa(0.12, 1 / 0.55, ateBorda))
    luz += luzAoLongo * 0.03 * (rampa(0.5, 1, naPlaca) - rampa(0.5, 1, ateFim))
  }
  if (tipo === PLACA_COM_VEIO || tipo === PLACA_TRINCADA) {
    const f = y * INVERSO_DO_CURSO_DA_ARDOSIA
    const xLinha = largura * (0.15 + 0.7 * (m[M_A] + (m[M_B] - m[M_A]) * f))
    const ate = Math.abs(naPlaca - xLinha)
    if (tipo === PLACA_COM_VEIO) {
      if (ate < 0.7) luz += 0.05 * (1 - rampa(0.12, 1 / 0.55, ate))
    } else if (ate < 0.6 && f < 0.85) {
      luz -= 0.2 * (1 - rampa(0.08, 1 / 0.45, ate))
    }
  }
  return luz
}

/** Até onde o musgo pode descer a partir da cumeeira (px do mapa). */
export const ALCANCE_DO_MUSGO_PX = 13

/**
 * O musgo da ardósia no pixel a `ate` px da CUMEEIRA (quem chama confere que é
 * cumeeira): 0 a ~0,45. Só em 60% das placas (pelo sorteio delas), cada uma
 * até uma distância própria que ainda ondula ao longo do cume (de 2 a 13 px),
 * e em tufos: uma franja verde e rala junto ao cume, não um risco.
 */
export function musgoDaArdosia(ate: number, u: number, sorteioDaPlaca: number): number {
  if (sorteioDaPlaca >= 0.6) return 0
  const alcance = 2 + 11 * (0.5 + 0.5 * seno(u * 0.23 + sorteioDaPlaca * 13)) * (0.35 + sorteioDaPlaca)
  if (ate >= alcance) return 0
  const tufo = 0.6 + 0.4 * seno(u * 1.1 + ate * 1.7 + sorteioDaPlaca * 9)
  return 0.45 * (1 - rampa(alcance * 0.3, 1 / (alcance * 0.7), ate)) * tufo
}

// ---------- metal ----------

/** Largura média da chapa (de junta em pé a junta em pé), px do mapa: de 12,4 a 13,6 px. */
export const LARGURA_DA_CHAPA_PX = 13
const SEMENTE_DO_METAL = 4421

function bordaDaChapa(j: number): number {
  return (j + (hash(j, 0, SEMENTE_DO_METAL) - 0.5) * 0.1) * LARGURA_DA_CHAPA_PX
}

/** Metal em chapas no ponto. Devolve a variação de luz; a pátina vai para `SAIDA_DO_MATERIAL`. */
export function luzDoMetal(v: number, u: number, luzAoLongo: number): number {
  const m = MEMORIA
  const j0 = Math.floor(u / LARGURA_DA_CHAPA_PX)
  if (m[M_CHAPA_J0] !== j0) {
    m[M_CHAPA_J0] = j0
    m[M_CHAPA_B0] = bordaDaChapa(j0)
    m[M_CHAPA_B1] = bordaDaChapa(j0 + 1)
  }
  let j = j0
  let inicio = m[M_CHAPA_B0]
  let fim = m[M_CHAPA_B1]
  if (u < inicio) {
    j = j0 - 1
    fim = inicio
    inicio = bordaDaChapa(j)
  } else if (u >= fim) {
    j = j0 + 1
    inicio = fim
    fim = bordaDaChapa(j0 + 2)
  }
  if (m[M_CHAPA] !== j) {
    // Chapa de 64 a 104 px de comprido, a emenda de topo em lugar sorteado (desencontrada da vizinha).
    m[M_CHAPA] = j
    m[M_CHAPA_COMPRIMENTO] = 64 + hash(j, 1, SEMENTE_DO_METAL) * 40
    m[M_CHAPA_DESLOCAMENTO] = hash(j, 2, SEMENTE_DO_METAL)
    m[M_CHAPA_FASE] = hash(j, 3, SEMENTE_DO_METAL) * TAU * 5
  }
  const comprimento = m[M_CHAPA_COMPRIMENTO]
  const sv = v / comprimento + m[M_CHAPA_DESLOCAMENTO]
  const pedaco = Math.floor(sv)
  const acimaDaEmenda = (sv - pedaco) * comprimento
  const abaixoDaEmenda = comprimento - acimaDaEmenda
  const fase = m[M_CHAPA_FASE]
  const naChapa = u - inicio
  const ateFim = fim - u
  const largura = fim - inicio
  // Cada pedaço de chapa um tom, bem pouco (metal é liso).
  let luz = 0.012 + (hash(j, pedaco, SEMENTE_DO_METAL + 5) - 0.5) * 0.05
  // JUNTA EM PÉ: d > 0 logo depois da junta do começo, d < 0 antes da do fim.
  const d = naChapa < ateFim ? naChapa : -ateFim
  const ad = d < 0 ? -d : d
  if (ad < 2.3) {
    if (ad < 0.6) luz += 0.07 * (1 - rampa(0.15, 1 / 0.45, ad)) // o fio do alto da junta
    if (ad < 1.1) luz += 0.12 * luzAoLongo * (d < 0 ? -1 : 1) * (1 - rampa(0.35, 1 / 0.75, ad)) // um lado claro, o outro escuro
    // A sombra que a junta joga na chapa, do lado contrário à luz.
    const ladoDaSombra = luzAoLongo >= 0 ? -1 : 1
    if ((d < 0 ? -1 : 1) === ladoDaSombra && ad > 0.5) luz -= (0.035 + 0.06 * Math.abs(luzAoLongo)) * (1 - rampa(0.9, 1 / 1.4, ad))
  }
  // EMENDA DE TOPO: a chapa de cima cobre a de baixo; a beira dela pega luz e joga um fio de sombra embaixo.
  if (abaixoDaEmenda < 1) luz -= 0.13 * (1 - rampa(0.1, 1 / 0.8, abaixoDaEmenda))
  if (acimaDaEmenda < 0.8) luz += 0.05 * (1 - rampa(0, 1 / 0.8, acimaDaEmenda))
  // Fileira de rebites logo acima da emenda: 3 por chapa.
  const dvRebite = acimaDaEmenda - 1.6
  if (dvRebite > -0.9 && dvRebite < 0.9) {
    const passo = largura / 3
    const k = Math.floor(naChapa / passo)
    const du = naChapa - (k + 0.5) * passo
    const r = Math.sqrt(du * du + dvRebite * dvRebite)
    if (r < 0.85) luz += 0.11 * (1 - rampa(0.25, 1 / 0.6, r)) - 0.05 * (dvRebite < 0 ? 1 - rampa(0.3, 1 / 0.55, r) : 0)
  }
  // PÁTINA ESCORRIDA: riscos estreitos ao longo da chapa (passo curto em u, comprido em v), mais
  // fortes logo abaixo dos rebites de onde a água escorre. Puxa para o cinza e clareia um tico.
  const risco = 0.6 * seno(u * 1.35 + fase) + 0.6 * seno(u * 0.41 + fase * 2.3) - 0.35
  let patina = 0
  if (risco > 0) {
    patina = risco * (0.55 + 0.45 * seno(v * 0.045 + u * 0.013 + fase)) * (0.45 + 0.55 * (abaixoDaEmenda / comprimento < 0.5 ? 1 - (abaixoDaEmenda / comprimento) * 2 : 0))
    luz += patina * 0.05
  }
  SAIDA_DO_MATERIAL[S_PARA_O_NEUTRO] = patina * 0.6
  SAIDA_DO_MATERIAL[S_SORTEIO_DA_PECA] = m[M_CHAPA_DESLOCAMENTO]
  return luz
}

/** O metal reflete: a diferença de luz de uma água para outra é esta vez a das outras. */
export const BRILHO_DA_AGUA_DO_METAL = 1.15

// ---------- tabuinhas ----------

/** Altura de uma fiada de tabuinhas (a parte à mostra), px do mapa. */
export const CURSO_DAS_TABUINHAS_PX = 7
/** Largura média da tabuinha; cada borda sai do lugar até 25% disso (de 3,75 a 11,25 px). */
export const LARGURA_DA_TABUINHA_PX = 7.5
const SEMENTE_DAS_TABUINHAS = 8837
const INVERSO_DO_CURSO_DAS_TABUINHAS = 1 / CURSO_DAS_TABUINHAS_PX
/** O raio da ponta gasta: o canto de baixo de cada tabuinha é comido até esta altura. */
const RAIO_DA_PONTA_PX = 1.5
const INVERSO_DO_RAIO_DA_PONTA = 1 / RAIO_DA_PONTA_PX

/** Tabuinhas no ponto. Devolve a variação de luz; a madeira lavada de chuva vai para `SAIDA_DO_MATERIAL`. */
export function luzDasTabuinhas(v: number, u: number, luzAoLongo: number): number {
  const rv = (v + 0.35 * seno(u * 0.13 + v * 0.07 + 1.9)) * INVERSO_DO_CURSO_DAS_TABUINHAS
  const n = Math.floor(rv)
  const y = (rv - n) * CURSO_DAS_TABUINHAS_PX
  const m = MEMORIA
  if (m[M_FILEIRA_DO_DESLOCAMENTO] !== n) {
    m[M_FILEIRA_DO_DESLOCAMENTO] = n
    // Bem desencontradas: cada fiada anda um tanto sorteado, sem meia-peça certa.
    m[M_DESLOCAMENTO] = hash(n, 0, SEMENTE_DAS_TABUINHAS + 7)
  }
  const j = pecaNaFileira(n, u, LARGURA_DA_TABUINHA_PX, 0.5, SEMENTE_DAS_TABUINHAS, m[M_DESLOCAMENTO])
  const inicio = INICIO_FIM[0]
  const fim = INICIO_FIM[1]
  if (m[M_PECA_FILEIRA] !== n || m[M_PECA] !== j) {
    m[M_PECA_FILEIRA] = n
    m[M_PECA] = j
    m[M_SORTEIO] = hash(n, j, SEMENTE_DAS_TABUINHAS + 1)
    m[M_TIPO] = hash(n, j, SEMENTE_DAS_TABUINHAS + 2)
    m[M_A] = hash(n, j, SEMENTE_DAS_TABUINHAS + 3)
    m[M_FASE] = hash(n, j, SEMENTE_DAS_TABUINHAS + 4) * TAU * 3
    // A ponta de umas é mais curta (gasta): a beira de baixo sobe até 0,9 px.
    m[M_B] = hash(n, j, SEMENTE_DAS_TABUINHAS + 5) * 0.9
    // Umas tabuinhas (20%) lavadas de chuva: puxam para o cinza da própria cor.
    m[M_SECO] = m[M_FASE] > TAU * 2.4 ? 0.22 : 0
  }
  const sorteio = m[M_SORTEIO]
  SAIDA_DO_MATERIAL[S_SORTEIO_DA_PECA] = sorteio
  SAIDA_DO_MATERIAL[S_PARA_O_NEUTRO] = m[M_SECO]
  const x = u - inicio
  const largura = fim - inicio
  const canto = x < largura - x ? x : largura - x
  // A PONTA GASTA E ARREDONDADA: perto da junta a beira de baixo sobe; abaixo dela aparece a sombra.
  let beira = m[M_B]
  if (canto < RAIO_DA_PONTA_PX) {
    const c = 1 - canto * INVERSO_DO_RAIO_DA_PONTA
    beira += RAIO_DA_PONTA_PX * c * c
  }
  const acimaDaBeira = y - beira
  if (acimaDaBeira < 0) {
    // Debaixo da ponta: o alto da fiada de baixo, na sombra; a beira da ponta, suave (meio px).
    return -0.3 + 0.24 * rampa(-0.5, 2, acimaDaBeira)
  }
  const tipo = m[M_TIPO]
  const fase = m[M_FASE]
  // O VEIO desce a tabuinha, ondulado, em fios escuros finos a cada ~3 px (a fase é de cada uma, então
  // os fios não se alinham de uma para outra). É ele que diz "madeira rachada", e não pedra.
  const veio = seno(x * 2 + fase + 0.5 * seno(y * 0.4 + fase))
  const fio = veio > 0 ? veio * veio * veio * veio : 0
  let luz =
    0.085 + // devolve a média ao tom escolhido (a sombra da fiada escurece bastante em média)
    (sorteio - 0.5) * 0.08 + // cada tabuinha um tom, pouco (muito tom vira calçada de pedra, folha de 12/11)
    veio * 0.03 -
    fio * 0.16
  // A ponta, de topo, pega luz.
  if (acimaDaBeira < 0.9) luz += 0.05 * (1 - rampa(0, 1 / 0.9, acimaDaBeira))
  // SOMBRA GROSSA: a fiada de cima cobre o alto desta (2,4 px de rampa).
  const ateTopo = CURSO_DAS_TABUINHAS_PX - y
  if (ateTopo < 2.8) luz -= 0.3 * (1 - rampa(0.3, 1 / 2.4, ateTopo))
  // Fresta entre tabuinhas, a beira virada para a luz um tico mais clara.
  if (canto < 1.4) {
    luz -= 0.3 * (1 - rampa(0.1, 1 / 0.5, canto))
    luz += luzAoLongo * 0.04 * (rampa(0.4, 1, x) - rampa(0.4, 1, largura - x))
  }
  if (tipo < 0.18) {
    // Empenada: a tabuinha torce e a luz corre de um lado para o outro.
    luz += (x / largura - 0.5) * 0.16 * (m[M_A] < 0.5 ? 1 : -1)
  } else if (tipo < 0.3) {
    // Rachada no sentido do veio, da ponta até três quartos da altura.
    const xr = largura * (0.3 + 0.4 * m[M_A]) + (m[M_A] - 0.5) * 0.4 * y
    const ate = Math.abs(x - xr)
    if (ate < 0.55 && y < CURSO_DAS_TABUINHAS_PX * 0.75) luz -= 0.24 * (1 - rampa(0.08, 1 / 0.4, ate))
  }
  return luz
}
