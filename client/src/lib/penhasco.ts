import type { MapData, ModoDoPenhasco, RegionPoint, TracoDePenhasco } from '../types/map'

/**
 * PENHASCO (fatia 3 do plano do relevo de 09/10/2026): o pincel que põe rochedo
 * na costa.
 *
 * O mestre risca por cima da costa onde quer penhasco. A parede de pedra em
 * camadas nasce SÓ na beira terra-mar debaixo do risco (o risco "gruda" na
 * costa) e desce para o mar; quem a desenha é o relevo
 * (`pixi/relevoRaster.ts`), a partir da união da terra. Onde não riscou, sem
 * penhasco. A borracha da própria ferramenta (modo "Apagar", ou Alt) tira um
 * trecho.
 *
 * POR QUE RISCOS EM ORDEM, e não células como o Pincel de revelar
 * (`lib/concealBrush.ts`): a costa de um continente tem dezenas de milhares de
 * px de mundo, e uma grade fina o bastante para a ponta do penhasco viraria
 * milhares de células por risco. O risco é o caminho do pincel (uns poucos
 * pontos por raio), e apagar é outro risco que o rasterizador tira do que veio
 * ANTES dele (`destination-out`): soma e subtração de áreas sem recorte de
 * polígono, do jeito que a tela já faz.
 *
 * Folha de propósito (só tipos importados): `lib/relevo.ts` e
 * `lib/fogFilter.ts` importam daqui, e quem precisa saber o que é terra passa
 * a pergunta pronta (`naTerra`) em vez de este módulo importar o relevo — o
 * ciclo de imports já derrubou o app uma vez (`revealBrushCell.ts`).
 */

/** Largura do pincel de penhasco (preferência da ferramenta, fora do map.json). */
export type LarguraDoPenhasco = 'fina' | 'media' | 'larga'

/**
 * Diâmetro do pincel em px do protótipo do relevo (`LADO_DO_PROTOTIPO`): o
 * pincel cresce com o mapa, como a própria parede. A Média (24) cobre a costa
 * com folga no zoom de quem vê o continente inteiro, sem engolir a ilha vizinha.
 */
export const DIAMETRO_DO_PINCEL: Readonly<Record<LarguraDoPenhasco, number>> = { fina: 12, media: 24, larga: 48 }

/** Raio do pincel, em px de mundo (`unidade` = px de mundo por px do protótipo, `unidadeDoRelevo`). */
export function raioDoPincelDePenhasco(unidade: number, largura: LarguraDoPenhasco): number {
  return (DIAMETRO_DO_PINCEL[largura] * unidade) / 2
}

/**
 * Passo mínimo entre dois pontos do risco: um quarto do raio. O traço é
 * redondo e cobre o vão; mais denso que isso só pesaria no arquivo e na rede.
 */
export function passoDoRisco(raio: number): number {
  return raio / 4
}

/** O que o soltar do pincel fez, para a tela dizer quando não fez nada. */
export type ResultadoDoRisco =
  /** Penhasco novo na costa debaixo do risco. */
  | 'riscou'
  /** O risco não passa por costa nenhuma (só terra, ou só mar). */
  | 'longe-da-costa'
  /** Passa pela costa, mas só onde a parede ficaria atrás da terra (a beira de cima). */
  | 'costa-escondida'
  /** Tirou penhasco. */
  | 'apagou'
  /** A borracha não passou por penhasco nenhum. */
  | 'nada-a-apagar'

// ---------------------------------------------------------------------------
// Leitura do disco

function ehModo(valor: string): valor is ModoDoPenhasco {
  return valor === 'riscar' || valor === 'apagar'
}

function lerPonto(valor: unknown): RegionPoint | null {
  if (typeof valor !== 'object' || valor === null || !('x' in valor) || !('y' in valor)) return null
  const { x, y } = valor
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return null
  return { x, y }
}

function lerTraco(valor: unknown): TracoDePenhasco | null {
  if (typeof valor !== 'object' || valor === null) return null
  if (!('id' in valor) || !('modo' in valor) || !('raio' in valor) || !('pontos' in valor)) return null
  const { id, modo, raio, pontos } = valor
  if (typeof id !== 'string' || id === '' || typeof modo !== 'string' || !ehModo(modo)) return null
  if (typeof raio !== 'number' || !Number.isFinite(raio) || raio <= 0 || !Array.isArray(pontos)) return null
  const lidos: RegionPoint[] = []
  for (const p of pontos) {
    const ponto = lerPonto(p)
    // Um ponto quebrado mudaria o desenho do risco inteiro: o risco sai todo.
    if (ponto === null) return null
    lidos.push(ponto)
  }
  return lidos.length === 0 ? null : { id, modo, raio, pontos: lidos }
}

/**
 * Os riscos do arquivo, ou `undefined` (sem o campo). O arquivo não é
 * confiável (map.json editado à mão, versão futura): risco quebrado sai, e o
 * resto fica na ordem.
 */
export function lerPenhascos(valor: unknown): TracoDePenhasco[] | undefined {
  if (!Array.isArray(valor)) return undefined
  const lista: TracoDePenhasco[] = []
  for (const item of valor) {
    const traco = lerTraco(item)
    if (traco !== null) lista.push(traco)
  }
  return lista.length > 0 ? lista : undefined
}

/** O mapa com estes riscos. Lista vazia tira o campo (o mapa volta a ser o de antes do penhasco). */
export function comPenhascos(map: MapData, lista: readonly TracoDePenhasco[]): MapData {
  if (lista.length > 0) return { ...map, penhascos: [...lista] }
  if (map.penhascos === undefined) return map
  const { penhascos: _semPenhasco, ...resto } = map
  return resto
}

// ---------------------------------------------------------------------------
// Geometria

function distanciaAoSegmento(p: RegionPoint, a: RegionPoint, b: RegionPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** Os lados do caminho do risco; um ponto só vira um lado de comprimento zero (o disco). */
function ladosDe(pontos: readonly RegionPoint[]): [RegionPoint, RegionPoint][] {
  if (pontos.length === 1) return [[pontos[0], pontos[0]]]
  const lados: [RegionPoint, RegionPoint][] = []
  for (let i = 1; i < pontos.length; i += 1) lados.push([pontos[i - 1], pontos[i]])
  return lados
}

function distanciaAoCaminho(p: RegionPoint, pontos: readonly RegionPoint[]): number {
  let menor = Infinity
  for (const [a, b] of ladosDe(pontos)) menor = Math.min(menor, distanciaAoSegmento(p, a, b))
  return menor
}

function lado(a: RegionPoint, b: RegionPoint, c: RegionPoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

/** Distância entre dois segmentos: zero quando se cruzam, senão a menor das quatro pontas. */
function distanciaEntreSegmentos(a: RegionPoint, b: RegionPoint, c: RegionPoint, d: RegionPoint): number {
  const cruzam = lado(a, b, c) * lado(a, b, d) < 0 && lado(c, d, a) * lado(c, d, b) < 0
  if (cruzam) return 0
  return Math.min(distanciaAoSegmento(a, c, d), distanciaAoSegmento(b, c, d), distanciaAoSegmento(c, a, b), distanciaAoSegmento(d, a, b))
}

interface Caixa {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function caixaDoTraco(traco: Pick<TracoDePenhasco, 'pontos' | 'raio'>): Caixa {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of traco.pontos) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { minX: minX - traco.raio, minY: minY - traco.raio, maxX: maxX + traco.raio, maxY: maxY + traco.raio }
}

/** As áreas dos dois riscos (o caminho engrossado pelo raio) se encostam? */
export function tracosSeTocam(a: Pick<TracoDePenhasco, 'pontos' | 'raio'>, b: Pick<TracoDePenhasco, 'pontos' | 'raio'>): boolean {
  const ca = caixaDoTraco(a)
  const cb = caixaDoTraco(b)
  if (ca.maxX < cb.minX || cb.maxX < ca.minX || ca.maxY < cb.minY || cb.maxY < ca.minY) return false
  const alcance = a.raio + b.raio
  for (const [p, q] of ladosDe(a.pontos)) {
    for (const [r, s] of ladosDe(b.pontos)) {
      if (distanciaEntreSegmentos(p, q, r, s) <= alcance) return true
    }
  }
  return false
}

/**
 * A área do `risco` cabe INTEIRA na da `borracha`? Cada lado do risco é
 * amostrado de `d` em `d`; um ponto do lado entre duas amostras fica a até
 * `d/2` da mais perto, então a amostra a `raio + d/2` da borda da borracha (ou
 * mais para dentro) garante o pedaço todo. Na dúvida, não cabe: o risco fica
 * e a borracha continua valendo por cima dele no desenho.
 */
function cabeNaBorracha(risco: TracoDePenhasco, borracha: TracoDePenhasco): boolean {
  if (risco.raio >= borracha.raio) return false
  const d = (borracha.raio - risco.raio) / 2
  for (const [a, b] of ladosDe(risco.pontos)) {
    const passos = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / d))
    for (let k = 0; k <= passos; k += 1) {
      const t = k / passos
      const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
      if (distanciaAoCaminho(p, borracha.pontos) + risco.raio + d / 2 > borracha.raio) return false
    }
  }
  return true
}

// ---------------------------------------------------------------------------
// Riscar e apagar

/**
 * O que o risco encontra debaixo dele: alguma COSTA (terra e mar dentro do
 * pincel) e alguma costa de onde a PAREDE desce à vista — terra com mar logo
 * abaixo. O mapa é visto de cima e um pouco de frente: na beira de cima de
 * uma terra a parede ficaria escondida atrás dela, como no protótipo.
 *
 * Amostra uma treliça de meio raio dentro do pincel, de meio em meio raio do
 * caminho: a costa que atravessa o pincel passa entre duas amostras vizinhas.
 */
export function oQueORiscoCobre(
  traco: Pick<TracoDePenhasco, 'pontos' | 'raio'>,
  naTerra: (p: RegionPoint) => boolean,
): { costa: boolean; parede: boolean } {
  const s = traco.raio / 2
  let terra = false
  let mar = false
  for (const centro of centrosDoCaminho(traco.pontos, s)) {
    // Coluna a coluna, de cima para baixo: terra seguida de mar é a beira de baixo.
    for (let i = -2; i <= 2; i += 1) {
      let acima: boolean | null = null
      for (let j = -2; j <= 2; j += 1) {
        if (i * i + j * j > 4) {
          acima = null
          continue
        }
        const aqui = naTerra({ x: centro.x + i * s, y: centro.y + j * s })
        if (aqui) terra = true
        else mar = true
        if (acima === true && !aqui) return { costa: true, parede: true }
        acima = aqui
      }
    }
  }
  return { costa: terra && mar, parede: false }
}

/** Pontos de `passo` em `passo` ao longo do caminho, com as duas pontas. */
function centrosDoCaminho(pontos: readonly RegionPoint[], passo: number): RegionPoint[] {
  const centros: RegionPoint[] = [pontos[0]]
  for (let i = 1; i < pontos.length; i += 1) {
    const a = pontos[i - 1]
    const b = pontos[i]
    const passos = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / passo))
    for (let k = 1; k <= passos; k += 1) centros.push({ x: a.x + ((b.x - a.x) * k) / passos, y: a.y + ((b.y - a.y) * k) / passos })
  }
  return centros
}

/**
 * Soltar o pincel: o risco novo entra na lista, ou a lista volta a MESMA (sem
 * passo vazio no desfazer) com o motivo de não ter entrado.
 *
 * - Riscar sem costa debaixo, ou só na beira escondida, não guarda nada: o
 *   risco ficaria invisível e a borracha não teria o que mostrar.
 * - Apagar tira de vez o risco que a borracha cobre inteiro, e só entra na
 *   lista se ainda encosta em algum risco de antes: borracha no vazio não
 *   pesa no arquivo.
 */
export function riscarPenhasco(
  lista: readonly TracoDePenhasco[],
  traco: TracoDePenhasco,
  naTerra: (p: RegionPoint) => boolean,
): { lista: readonly TracoDePenhasco[]; resultado: ResultadoDoRisco } {
  if (traco.pontos.length === 0 || !(traco.raio > 0)) return { lista, resultado: traco.modo === 'riscar' ? 'longe-da-costa' : 'nada-a-apagar' }
  if (traco.modo === 'riscar') {
    const cobre = oQueORiscoCobre(traco, naTerra)
    if (!cobre.costa) return { lista, resultado: 'longe-da-costa' }
    if (!cobre.parede) return { lista, resultado: 'costa-escondida' }
    return { lista: [...lista, traco], resultado: 'riscou' }
  }
  const restantes = lista.filter((t) => t.modo !== 'riscar' || !cabeNaBorracha(t, traco))
  const encosta = restantes.some((t) => t.modo === 'riscar' && tracosSeTocam(t, traco))
  if (restantes.length === lista.length && !encosta) return { lista, resultado: 'nada-a-apagar' }
  // Sem risco nenhum sobrando, as borrachas de antes também não apagam mais nada.
  if (!restantes.some((t) => t.modo === 'riscar')) return { lista: [], resultado: 'apagou' }
  return { lista: encosta ? [...restantes, traco] : restantes, resultado: 'apagou' }
}

/** Há algum risco que põe penhasco? Só borracha não desenha nada. */
export function temRiscoDePenhasco(lista: readonly TracoDePenhasco[] | undefined): boolean {
  return lista !== undefined && lista.some((t) => t.modo === 'riscar')
}

// ---------------------------------------------------------------------------
// Jogador e assinatura

/** Oito direções (de 45 em 45 graus), em vetor unitário. */
const EM_VOLTA: readonly (readonly [number, number])[] = Array.from({ length: 8 }, (_, i): readonly [number, number] => {
  const t = (i / 8) * Math.PI * 2
  return [Math.cos(t), Math.sin(t)]
})

/** O disco do pincel neste ponto encosta no que o jogador conhece? (o centro, ou a borda em oito direções) */
function discoConhecido(p: RegionPoint, raio: number, conhece: (p: RegionPoint) => boolean): boolean {
  return conhece(p) || EM_VOLTA.some(([dx, dy]) => conhece({ x: p.x + dx * raio, y: p.y + dy * raio }))
}

/**
 * O caminho com os lados longos divididos de `passo` em `passo`. O pincel só
 * impõe distância MÍNIMA entre pontos: um arrasto rápido com o mapa afastado
 * deixa pontos a centenas de px de mundo um do outro, e o filtro do jogador,
 * que olha ponto a ponto, deixaria passar um lado inteiro (e a folga da ponta)
 * por dentro da névoa ou de um lugar escondido.
 */
function caminhoDenso(pontos: readonly RegionPoint[], passo: number): RegionPoint[] {
  if (pontos.length < 2) return pontos.map((p) => ({ x: p.x, y: p.y }))
  return centrosDoCaminho(pontos, passo)
}

/**
 * A folga da ponta de um pedaço: o ponto vizinho de fora, trazido para no
 * máximo um raio do último ponto que ficou, e só se não cair em lugar
 * escondido. Sem ela o trecho que sai do conhecido encurtaria o penhasco que
 * ele já vê; com ela sem limite, a ponta levaria coordenada funda na névoa.
 */
function folgaDaPonta(
  dentro: RegionPoint,
  fora: RegionPoint | undefined,
  raio: number,
  escondido: (p: RegionPoint) => boolean,
): RegionPoint | null {
  if (fora === undefined) return null
  const d = Math.hypot(fora.x - dentro.x, fora.y - dentro.y)
  const t = d <= raio ? 1 : raio / d
  const folga = { x: dentro.x + (fora.x - dentro.x) * t, y: dentro.y + (fora.y - dentro.y) * t }
  return escondido(folga) ? null : folga
}

/**
 * Os riscos que vão ao jogador: só os pedaços cujo pincel encosta no que ele
 * conhece (`conhece`: visão, explorado, cômodo lembrado — fora de lugar
 * escondido), cada pedaço com um ponto de folga em cada ponta (`folgaDaPonta`).
 * O resto do caminho do mestre não sai: os riscos na névoa diriam onde há costa.
 *
 * `escondido` (Lugar escondido, zona oculta) corta o pedaço como corta uma
 * linha: ponto ali dentro nunca sai, nem quando a borda do pincel encosta no
 * conhecido ao lado — a coordenada diria onde a costa entra na enseada.
 *
 * A tela dele ainda corta a parede pelo conhecido e a guarda sob a máscara da
 * névoa (`ConhecidoDoRelevo`); isto aqui é o que viaja pela rede.
 * Borracha sem risco antes dela no que sobrou não muda nada e fica de fora.
 */
export function penhascosParaJogador(
  lista: readonly TracoDePenhasco[] | undefined,
  conhece: (p: RegionPoint) => boolean,
  escondido: (p: RegionPoint) => boolean,
): TracoDePenhasco[] | undefined {
  if (lista === undefined || lista.length === 0) return undefined
  const saida: TracoDePenhasco[] = []
  for (const traco of lista) {
    const pontos = caminhoDenso(traco.pontos, passoDoRisco(traco.raio))
    let pedaco = 0
    let inicio = -1
    const fechar = (fim: number) => {
      const antes = folgaDaPonta(pontos[inicio], pontos[inicio - 1], traco.raio, escondido)
      const depois = folgaDaPonta(pontos[fim - 1], pontos[fim], traco.raio, escondido)
      const meio = pontos.slice(inicio, fim)
      saida.push({
        id: `${traco.id}~${pedaco}`,
        modo: traco.modo,
        raio: traco.raio,
        pontos: [...(antes === null ? [] : [antes]), ...meio, ...(depois === null ? [] : [depois])],
      })
      pedaco += 1
    }
    for (let i = 0; i < pontos.length; i += 1) {
      if (!escondido(pontos[i]) && discoConhecido(pontos[i], traco.raio, conhece)) {
        if (inicio < 0) inicio = i
      } else if (inicio >= 0) {
        fechar(i)
        inicio = -1
      }
    }
    if (inicio >= 0) fechar(pontos.length)
  }
  const primeiroRisco = saida.findIndex((t) => t.modo === 'riscar')
  if (primeiroRisco < 0) return undefined
  return saida.slice(primeiroRisco)
}

/** Assinatura do que os riscos desenham: o relevo só é refeito quando ela muda (`assinaturaDaTerra`). */
export function assinaturaDosPenhascos(lista: readonly TracoDePenhasco[] | undefined): string {
  if (lista === undefined) return ''
  return lista.map((t) => `${t.id}:${t.modo}:${t.raio}:${t.pontos.map((p) => `${p.x},${p.y}`).join(' ')}`).join('|')
}
