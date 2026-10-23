/**
 * CERCA de cima com volume (`objetos.js:1237-1290`): o topo cortado de cada
 * mourão (a casca em volta e os anéis no meio) e, entre os mourões, as varas da
 * mesma madeira, a corda ou os dois fios de arame. Materiais: `madeira`
 * (mourões) e `ligacao` (varas, corda ou arame).
 *
 * Os mourões saem da MESMA geometria do desenho de linhas
 * (`geometriaDaCerca` de `lib/mobilia.ts`): um a cada ~1 casa pela reta ou
 * pelo ARCO da cerca curva, com o raio tirado da espessura. Assim a imagem
 * acompanha o comprimento e a curva com o padrão no tamanho de sempre (mais
 * mourões, nunca mourões esticados), e a seleção e o clique (que leem a mesma
 * geometria) caem em cima do desenho.
 *
 * Na cerca reta cada ligação é reta de mourão a mourão. Na CURVA ela segue o
 * arco, como o fio do desenho de linhas (`fioNoArco`): cápsulas encadeadas em
 * pedaços de até `PEDACO_DO_ARCO` (o arame, dois arcos de raio R ± o
 * afastamento). Ligação reta entre mourões de um arco de 90° em 3 casas fazia
 * quinas de 30° (no app, 120° em 150 px, de 40°): a cerca lia como bandeja
 * dobrada e a vara saía até ~5 px para dentro do contorno da seleção.
 */
import { geometriaDaCerca, type GeometriaDaCerca } from '../../../lib/mobilia'
import { ruido, contato, type Cena, type Textura } from './motor'
import { cadeia, capsula, elipse, type Forma, type Ponto } from './formas'
import type { ContextoDoMovel, MontarMovel } from './contexto'

/** Altura do mourão em casas (a sombra). */
const ALTURA_DO_MOURAO = 0.72
/** As ligações ficam a esta fração da altura do mourão (a sombra delas). */
const ALTURA_DA_LIGACAO = 0.7
/**
 * Raio de cada ligação, em px do protótipo, e quanto ela recua da borda do
 * mourão (fração do raio dele). A corda e o arame são mais grossos que no
 * protótipo (1,3 e 0,55): no nível 1 (0,89 pixel por px) o fio de 1,1 px não
 * chegava a um pixel opaco, e a cerca de arame cobria só 16% da pegada (o
 * piso é 25%); a de corda curva, 24%.
 */
const RAIO_DA_VARA = 1.8
const RAIO_DA_CORDA = 1.5
const RAIO_DO_ARAME = 0.9
/** Os dois fios do arame, afastados do eixo para cada lado (px do protótipo): separados, não um fio grosso. */
const AFASTAMENTO_DO_ARAME = 1.3
const RECUO_DA_LIGACAO = 0.55
/** Recuo da sombra da ligação, em fração do raio do mourão. */
const RECUO_DA_SOMBRA = 0.5
/** Maior pedaço do arco numa ligação da cerca curva, em radianos (o fio do desenho de linhas usa π/64). */
export const PEDACO_DO_ARCO = Math.PI / 16

/**
 * O caminho de uma ligação: os pontos dela recuados `recuo` px de cada mourão
 * e afastados `afastamento` px do eixo (para fora do arco na curva), e a
 * coordenada do veio que acompanha esse caminho.
 */
interface Trilho {
  pontos(recuo: number, afastamento: number): Ponto[]
  readonly veio: { readonly eixo: number } | { readonly arco: { readonly cx: number; readonly cy: number; readonly r: number; readonly a0: number } }
}

/** Topo de madeira cortada: anéis em volta do centro do mourão (`objetos.js:410-415`). */
function texTopo(cx: number, cy: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const raio = Math.hypot(x - cx, y - cy) + ruido(x * 0.2 + p.semente, y * 0.2) * 1.4
    s[3] += Math.sin(raio * 4.2) * 0.035 + ruido(x * 0.6, y * 0.6) * 0.05 + 0.06
  }
}

/** O segmento de `a` a `b` recuado `k` px em cada ponta. */
function encurtar(a: Ponto, b: Ponto, k: number): [number, number, number, number] {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const l = Math.hypot(dx, dy) || 1
  return [a[0] + (dx / l) * k, a[1] + (dy / l) * k, b[0] - (dx / l) * k, b[1] - (dy / l) * k]
}

/** A ligação reta de `a` a `b` (a cerca reta). */
function trilhoReto(a: Ponto, b: Ponto): Trilho {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0])
  const nx = -Math.sin(ang)
  const ny = Math.cos(ang)
  return {
    pontos(recuo, afastamento) {
      const [ax, ay, bx, by] = encurtar(a, b, recuo)
      return [[ax + nx * afastamento, ay + ny * afastamento], [bx + nx * afastamento, by + ny * afastamento]]
    },
    veio: { eixo: ang },
  }
}

/** A ligação pelo arco, do ângulo `de` ao `ate` (radianos de tela), entre dois mourões vizinhos da cerca curva. */
function trilhoNoArco(arco: NonNullable<GeometriaDaCerca['arco']>, de: number, ate: number): Trilho {
  const { center, radius } = arco
  const sentido = Math.sign(ate - de)
  return {
    pontos(recuo, afastamento) {
      const r = radius + afastamento
      const a0 = de + (sentido * recuo) / radius
      const a1 = ate - (sentido * recuo) / radius
      if ((a1 - a0) * sentido <= 0) return []
      const pedacos = Math.max(1, Math.ceil(Math.abs(a1 - a0) / PEDACO_DO_ARCO))
      const pontos: Ponto[] = []
      for (let k = 0; k <= pedacos; k += 1) {
        const a = a0 + ((a1 - a0) * k) / pedacos
        pontos.push([center.x + Math.cos(a) * r, center.y + Math.sin(a) * r])
      }
      return pontos
    },
    veio: { arco: { cx: center.x, cy: center.y, r: radius, a0: (de + ate) / 2 } },
  }
}

/** Uma cápsula entre dois pontos ou encadeada pelos pedaços do arco; `null` se o recuo comeu a ligação inteira. */
function formaDoTrilho(pontos: readonly Ponto[], raio: number): Forma | null {
  if (pontos.length < 2) return null
  if (pontos.length === 2) return capsula(pontos[0][0], pontos[0][1], pontos[1][0], pontos[1][1], raio)
  return cadeia(pontos, raio)
}

/** Os trilhos entre mourões vizinhos: retos na cerca reta, pelo arco na curva. */
function trilhosDaCerca(geometria: GeometriaDaCerca, pontos: readonly Ponto[]): Trilho[] {
  const trilhos: Trilho[] = []
  const arco = geometria.arco
  const vaos = pontos.length - 1
  for (let i = 0; i < vaos; i += 1) {
    trilhos.push(arco === null ? trilhoReto(pontos[i], pontos[i + 1]) : trilhoNoArco(arco, arco.startAngle + (arco.sweep * i) / vaos, arco.startAngle + (arco.sweep * (i + 1)) / vaos))
  }
  return trilhos
}

/** As ligações entre dois mourões vizinhos, pela escolha do lugar `ligacao` (a classe do material diz qual). */
function ligar(c: ContextoDoMovel, cena: Cena, trilho: Trilho, rp: number, i: number): void {
  const P = c.peca
  const recuo = rp * RECUO_DA_LIGACAO
  const lig = c.m.ligacao
  if (lig.classe === 'metal') {
    // Dois fios, um de cada lado do eixo (pela normal do trecho ou pelo raio do arco: vale na cerca em pé e na curva).
    for (const lado of [-1, 1]) {
      const forma = formaDoTrilho(trilho.pontos(recuo, lado * AFASTAMENTO_DO_ARAME), RAIO_DO_ARAME)
      if (forma !== null) cena.partes.push(P(forma, lig, { ...trilho.veio, bisel: RAIO_DO_ARAME, contorno: 0.1, semente: 120 + i }))
    }
    return
  }
  const corda = lig.classe === 'corda'
  const forma = formaDoTrilho(trilho.pontos(recuo, 0), corda ? RAIO_DA_CORDA : RAIO_DA_VARA)
  if (forma === null) return
  if (corda) cena.partes.push(P(forma, lig, { ...trilho.veio, bisel: RAIO_DA_CORDA, contorno: 0.18, semente: 110 + i }))
  else cena.partes.push(P(forma, lig, { ...trilho.veio, tabua: 0, bisel: 0.9, contorno: 0.26, tom: 0.94, semente: 100 + i }))
}

export const montarCerca: MontarMovel = (c, cena) => {
  const geometria = geometriaDaCerca(c.w, c.h, c.curva)
  if (geometria === null) return
  const rp = geometria.raio
  const pontos: Ponto[] = geometria.mouroes.map((m) => [m.x, m.y])
  const trilhos = trilhosDaCerca(geometria, pontos)
  const H = c.g * ALTURA_DO_MOURAO
  const arame = c.m.ligacao.classe === 'metal'
  for (const [px, py] of pontos) cena.sombras.push({ forma: elipse(px, py, rp, rp), z: H }, contato(elipse(px, py, rp, rp)))
  for (const trilho of trilhos) {
    const forma = formaDoTrilho(trilho.pontos(rp * RECUO_DA_SOMBRA, 0), arame ? 0.6 : 1.6)
    if (forma !== null) cena.sombras.push({ forma, z: H * ALTURA_DA_LIGACAO, forca: arame ? 0.18 : 0.26, solta: true })
  }
  trilhos.forEach((trilho, i) => ligar(c, cena, trilho, rp, i))
  const P = c.peca
  const mad = c.m.madeira
  pontos.forEach(([px, py], i) => {
    // A casca é o disco inteiro POR BAIXO do topo cortado (no protótipo, um anel até 0,8 do raio): com o anel, a
    // emenda das duas bordas suavizadas deixava um círculo meio transparente dentro do mourão, por onde o chão aparecia.
    cena.partes.push(P(elipse(px, py, rp, rp), mad, { polar: { cx: px, cy: py, r: rp }, tabua: 2.4, bisel: 1, tom: 0.66, semente: 80 + i }))
    cena.partes.push(P(elipse(px, py, rp * 0.81, rp * 0.81), mad, { textura: texTopo(px, py), bisel: 0.9, semente: 90 + i }))
  })
}
