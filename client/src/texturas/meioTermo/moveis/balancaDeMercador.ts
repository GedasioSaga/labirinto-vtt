/**
 * A balança de mercador (lote 9 dos objetos novos, 11/11/2026): a balança de
 * dois pratos de latão sobre um caixote baixo coberto por um pano. A coluna
 * torneada sai de um pé de madeira; no alto, o travessão com o fiel e o arco;
 * os pratos pendem de três correntes cada um: o mais baixo leva um saco aberto
 * de tempero, o outro dois pesos empilhados. Na frente, a escadinha de pesos de
 * bronze, do maior ao menor, e as moedas (uma pilha e três soltas na madeira).
 * É maior e mais rica que a balancinha da banca de frutas.
 *
 * O caixote é derivado (a 3/4 sobe o tampo e varre a frente). A balança, os
 * pesos e as moedas são desenhados duas vezes, pelas âncoras do gancho com
 * carne: de cima, eles somem quando a 3/4 sobe o caixote; de frente, montados
 * do ponto 3D (x, y, altura) já girado para a tela, aparecem só na 3/4, por
 * cima do caixote, do fundo para a frente. Girada, a balança é vista de lado
 * ou de costas como ficaria: o travessão foge para o fundo e os pratos ficam um
 * atrás do outro.
 */
import { caixa, cadeia, capsula, elipse, menos, uniao, barra, type Caixa, type Forma, type Ponto } from './formas'
import { SOMBRA_X, SOMBRA_Y, contato, texturaDaClasse, type Cena, type CriarPeca, type MaterialDaPeca, type OpcoesDaPeca, type Textura } from './motor'
import { G, materialDaPeca, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

// ---------- os materiais fixos ----------

const LATAO = materialDaPeca('latao')
/** O bronze dos pesos, mais escuro e mais marrom que o latão da balança. */
const BRONZE: MaterialDaPeca = { classe: 'metal', rgb: [0x8a, 0x68, 0x40] }
/** O saco de estopa e o tempero dentro dele (colorau apagado). */
const ESTOPA: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0x9c, 0x86, 0x60] }
const TEMPERO: MaterialDaPeca = { classe: 'liso', rgb: [0x9a, 0x62, 0x42] }
/** As moedas: ouro, prata e cobre, em área pequena. */
const OURO: MaterialDaPeca = { classe: 'metal', rgb: [0xc0, 0xa0, 0x58] }
const PRATA: MaterialDaPeca = { classe: 'metal', rgb: [0xb0, 0xae, 0xa6] }
const COBRE: MaterialDaPeca = { classe: 'metal', rgb: [0x9c, 0x6c, 0x4c] }
/** O galão e a franja do pano. */
const GALAO: MaterialDaPeca = { classe: 'liso', rgb: [0xbc, 0xa0, 0x66] }
/** A sombra que uma peça faz no pano ou na madeira, pintada (a peça de uma vista só não pode projetar). */
const SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [0x1e, 0x16, 0x12] }

// ---------- as medidas (px do protótipo, numa pegada de 1 x 0,7 casa; o detalhe cresce com `k`) ----------

/** O caixote quase enche a pegada e tem esta altura, em casas. */
const FOLGA_X = 1
const FOLGA_Y = 1.6
const ALTURA_DO_CAIXOTE = 0.34
/** O pano cobre esta fração do comprimento do tampo, de trás até a frente, e cai na frente. */
const PANO = 0.66
const QUEDA_DO_PANO = 6.5
/** A balança: o y do pé, a meia largura do travessão, o raio do prato e as alturas (acima do tampo). */
const Y_DA_BALANCA = -2.6
const MEIO_TRAVESSAO = 16
const RAIO_DO_PRATO = 8.2
const RAIO_DO_PE = 5.2
const ALTURA_DO_PE = 3
const ALTURA_DO_EIXO = 30
const ALTURA_DO_PRATO = 12.5
/** O travessão pende para o lado do saco: as pontas sobem e descem isto. */
const INCLINACAO = 1.3
/** O fiel fica dentro do arco: passando dele, os dois liam como uma cruz no alto da balança. */
const FIEL = 5.2
const ARCO_DO_FIEL = 6.6
/** As correntes saem do gancho logo abaixo da ponta do travessão e descem até três pontos da borda do prato. */
const ABAIXO_DA_PONTA = 2.6
const PONTOS_DA_CORRENTE: readonly number[] = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6]
/** A escadinha de pesos, do maior ao menor: raio e altura de cada um. */
const ESCADINHA: readonly (readonly [number, number])[] = [
  [3.3, 4.6],
  [2.9, 4],
  [2.5, 3.4],
  [2.1, 2.8],
  [1.7, 2.2],
]
const Y_DA_ESCADINHA = 12
const INICIO_DA_ESCADINHA = -21
const VAO_DA_ESCADINHA = 0.9
/** A pilha de moedas e as soltas: lugar, raio e espessura. */
const PILHA = { x: 15.5, y: 12.5, moedas: 4 }
const RAIO_DA_MOEDA = 2.3
const ESPESSURA_DA_MOEDA = 0.7
const SOLTAS: readonly (readonly [number, number, MaterialDaPeca])[] = [
  [21.5, 10, OURO],
  [20.6, 14.8, PRATA],
  [11.4, 15.3, COBRE],
]
/** A força da sombra pintada no tampo e o tom da frente de um cilindro (o lado de pé, sem a luz de cima). */
const FORCA_DA_SOMBRA = 0.16
const TOM_DE_PE = 0.72
/** Os elos da corrente, ao longo do fio. */
const PASSO_DO_ELO = 1.3

// ---------- o giro e as âncoras (as do gancho com carne) ----------

/** Os quartos de volta do giro do objeto (0 a 3). */
function quartosDoGiro(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

/** O ponto girado `q` quartos de volta no sentido da tela, como o `girarPonto` de `tresQuartos.ts`. */
function girarPonto(x: number, y: number, q: number): Ponto {
  return q === 1 ? [-y, x] : q === 2 ? [-x, -y] : q === 3 ? [y, -x] : [x, y]
}

/** A forma girada `q` quartos de volta, como o `girarForma` de `tresQuartos.ts`. */
function girarForma(f: Forma, q: number): Forma {
  if (q === 0) return f
  const b = f.b
  const girada: Caixa = q === 1 ? [-b[3], b[0], -b[1], b[2]] : q === 2 ? [-b[2], -b[3], -b[0], -b[1]] : [b[1], -b[2], b[3], -b[0]]
  const volta = 4 - q
  return {
    b: girada,
    d: (x, y) => {
      const [mx, my] = girarPonto(x, y, volta)
      return f.d(mx, my)
    },
  }
}

/** A peça só é pintada no lugar em que foi desenhada (`dy` zero): a de cima some quando a 3/4 a sobe, a de frente só aparece quando a 3/4 a traz de volta. */
function soNoLugar(textura: Textura | null): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (p.dy !== 0) {
      s[5] = 0
      return
    }
    if (textura !== null) textura(u, v, x, y, p, s, escala)
  }
}

/** A mesma forma com a caixa de pintura centrada em (cx, cy): é o meio da caixa que a 3/4 lê para saber em que estrutura a peça está. */
function presa(forma: Forma, cx: number, cy: number): Forma {
  const mx = Math.max(cx - forma.b[0], forma.b[2] - cx)
  const my = Math.max(cy - forma.b[1], forma.b[3] - cy)
  return { b: [cx - mx, cy - my, cx + mx, cy + my], d: (x, y) => forma.d(x, y) }
}

const RAIO_DA_ANCORA = 1e-6
const FORA_DA_ANCORA = 1e3
const BORDA_DA_ANCORA = 0.05
/** Cada grupo aberto fica isto mais ao sul que o anterior: na mesma base, a 3/4 os pinta na ordem em que foram abertos. */
const PASSO_DA_ORDEM = 1e-3
/** O que só aparece de cima sobe quase nada na 3/4: o bastante para sair do lugar e sumir. */
const QUASE_NADA = 0.02

/** A âncora de um grupo: um tampo solto de um ponto só, sem sombra, no chão da pegada já girada. */
function ancorar(cena: Cena, q: number, x: number, y: number, z: number): void {
  const ponto: Forma = {
    b: [x, y, x, y],
    d: (px, py) => (Math.abs(px - x) < RAIO_DA_ANCORA && Math.abs(py - y) < RAIO_DA_ANCORA ? -1 : FORA_DA_ANCORA),
  }
  cena.sombras.push({ forma: girarForma(ponto, (4 - q) % 4), z, solta: true, forca: 0, suave: BORDA_DA_ANCORA })
}

/** A peça de uma vista só não tem deslocamento nem sombra própria (a sombra dela cairia na outra vista). */
type OpcoesDaVista = Omit<OpcoesDaPeca, 'dx' | 'dy' | 'projeta' | 'polar' | 'arco' | 'curvaY'>

/** Uma peça ainda sem grupo: o grupo é aberto com a caixa de todas, para a janela de pintura ficar justa. */
interface Desenho {
  readonly forma: Forma
  readonly mat: MaterialDaPeca
  readonly o: OpcoesDaVista
}

/** A caixa que junta as formas. */
function caixaDe(lista: readonly Desenho[]): Caixa {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const { forma } of lista) {
    x0 = Math.min(x0, forma.b[0])
    y0 = Math.min(y0, forma.b[1])
    x1 = Math.max(x1, forma.b[2])
    y1 = Math.max(y1, forma.b[3])
  }
  return [x0, y0, x1, y1]
}

/** Põe as peças só na vista de cima, num grupo em volta do meio delas. */
function porDeCima(P: CriarPeca, cena: Cena, lista: readonly Desenho[]): void {
  if (lista.length === 0) return
  const b = caixaDe(lista)
  const x = (b[0] + b[2]) / 2
  const y = (b[1] + b[3]) / 2
  ancorar(cena, 0, x, y, QUASE_NADA)
  for (const { forma, mat, o } of lista) cena.partes.push(P(presa(forma, x, y), mat, { ...o, textura: soNoLugar(o.textura ?? texturaDaClasse(mat.classe)) }))
}

/** A tela da 3/4: quem desenha nela escreve em coordenadas da tela, com a pegada já girada. */
interface Tela {
  /** Põe as peças só na 3/4, num grupo que sobe junto; a base (o y da âncora, ao sul do caixote) dá a ordem. */
  por(lista: readonly Desenho[], base: number): void
}

function novaTela(P: CriarPeca, cena: Cena, q: number): Tela {
  const volta = (4 - q) % 4
  let abertos = 0
  return {
    por(lista, base) {
      if (lista.length === 0) return
      const b = caixaDe(lista)
      const x = (b[0] + b[2]) / 2
      const meio = (b[1] + b[3]) / 2
      const chao = base + abertos * PASSO_DA_ORDEM
      abertos += 1
      const z = chao - meio
      ancorar(cena, q, x, chao, z)
      const [dx, dy] = girarPonto(0, z, volta)
      for (const { forma, mat, o } of lista) {
        const noMeio = presa(forma, x, meio)
        if (q === 0) {
          cena.partes.push(P(noMeio, mat, { ...o, dy: z, textura: soNoLugar(o.textura ?? texturaDaClasse(mat.classe)) }))
          continue
        }
        // Girada, a cena só serve à 3/4: a peça sai desgirada (a forma, o veio e o ponto que a textura lê) e a volta da 3/4 a põe como foi desenhada.
        const textura = o.textura
        cena.partes.push(
          P(girarForma(noMeio, volta), mat, {
            ...o,
            dx,
            dy,
            eixo: (o.eixo ?? 0) - q * QUARTO,
            textura:
              textura === undefined
                ? undefined
                : (u, v, tx, ty, p, s, escala) => {
                    const [sx, sy] = girarPonto(tx, ty, q)
                    textura(u, v, sx, sy, p, s, escala)
                  },
          }),
        )
      }
    },
  }
}

// ---------- o que a balança sabe da bancada ----------

interface Bancada {
  readonly q: number
  readonly k: number
  /** A altura do tampo do caixote. */
  readonly H: number
  /** Meia pegada do caixote na tela (de lado, trocadas). */
  readonly tx: number
  readonly ty: number
}

/** O ponto (x, y) do tampo, a `h` acima dele, na tela da 3/4. */
function naTela(b: Bancada, x: number, y: number, h: number): Ponto {
  const [sx, sy] = girarPonto(x, y, b.q)
  return [sx, sy - b.H - h]
}

/** Onde cai, no tampo, a sombra do ponto (x, y) a `h` acima dele (a luz é da tela, de cima à esquerda). */
function sombraNaTela(b: Bancada, x: number, y: number, h: number): Ponto {
  const [sx, sy] = girarPonto(x, y, b.q)
  return [sx + SOMBRA_X * h, sy + SOMBRA_Y * h - b.H]
}

/** O cilindro de pé na 3/4 (a borda do pé, a frente e o topo): a vista não encurta o redondo, só o sobe. */
function cilindro(b: Bancada, x: number, y: number, r: number, h0: number, h1: number): Forma {
  const [ax, ay] = naTela(b, x, y, h0)
  const [, ty] = naTela(b, x, y, h1)
  return uniao(uniao(elipse(ax, ay, r, r), caixa(ax - r, ty, ax + r, ay)), elipse(ax, ty, r, r))
}

/** O fio entre dois pontos, com o veio ao longo dele. */
function fio(a: Ponto, z: Ponto, raio: number, mat: MaterialDaPeca, o: OpcoesDaVista): Desenho {
  return { forma: capsula(a[0], a[1], z[0], z[1], raio), mat, o: { tabua: 0, bisel: 0.5, contorno: 0.26, ...o, eixo: Math.atan2(z[1] - a[1], z[0] - a[0]) } }
}

/** Os elos da corrente: a cada passo ao longo do fio, um elo claro e uma junta escura. */
const texDaCorrente: Textura = (u, _v, _x, _y, _p, s) => {
  const f = 0.8 + 0.2 * Math.cos((u * 2 * Math.PI) / PASSO_DO_ELO)
  s[0] *= f
  s[1] *= f
  s[2] *= f
}

const DO_LATAO: OpcoesDaVista = { tabua: 0, bisel: 0.9, contorno: 0.28 }
const DA_SOMBRA: OpcoesDaVista = { tabua: 0, bisel: 0, contorno: 0, alfa: FORCA_DA_SOMBRA }

// ---------- a balança de pé, na 3/4 ----------

/** As alturas das pontas do travessão: a do saco (esquerda) desce, a dos pesos sobe. */
function pontaDoTravessao(k: number, lado: number): number {
  return (ALTURA_DO_EIXO + lado * INCLINACAO) * k
}

/** O prato pendurado de frente: as correntes de trás, a bacia (a borda e o fundo), o que vai nela e as correntes da frente. */
function pratoDeFrente(b: Bancada, lado: number): Desenho[] {
  const { k } = b
  const px = lado * MEIO_TRAVESSAO * k
  const py = Y_DA_BALANCA * k
  const r = RAIO_DO_PRATO * k
  const hp = ALTURA_DO_PRATO * k + (pontaDoTravessao(k, lado) - ALTURA_DO_EIXO * k)
  const gancho = naTela(b, px, py, pontaDoTravessao(k, lado) - ABAIXO_DA_PONTA * k)
  const [, yDoMeio] = naTela(b, px, py, hp)
  const correntes = PONTOS_DA_CORRENTE.map((a) => naTela(b, px + r * 0.92 * Math.cos(a), py + r * 0.92 * Math.sin(a), hp))
  const corrente = (p: Ponto): Desenho => fio(gancho, p, 0.4 * k, LATAO, { textura: texDaCorrente, tom: 0.92 })
  const lista: Desenho[] = correntes.filter((p) => p[1] < yDoMeio).map(corrente)
  const [cx, cy] = naTela(b, px, py, hp)
  lista.push({ forma: cilindro(b, px, py, r, hp - 1.6 * k, hp), mat: LATAO, o: { ...DO_LATAO, tom: TOM_DE_PE } })
  lista.push({ forma: elipse(cx, cy, r, r), mat: LATAO, o: { ...DO_LATAO, bisel: 1.2, tom: 1 } })
  lista.push({ forma: elipse(cx, cy, r * 0.78, r * 0.78), mat: LATAO, o: { ...DO_LATAO, tom: 0.84, recesso: { k: 1.4, forca: 0.35 } } })
  if (lado < 0) lista.push(...sacoDeFrente(b, px, py, hp))
  else lista.push(...pesosNoPrato(b, px, py, hp))
  lista.push(...correntes.filter((p) => p[1] >= yDoMeio).map(corrente))
  return lista
}

/** O saco de estopa aberto, com a boca enrolada e o tempero em monte. */
function sacoDeFrente(b: Bancada, px: number, py: number, hp: number): Desenho[] {
  const { k } = b
  const alto = hp + 5.4 * k
  const [tx, ty] = naTela(b, px, py, alto)
  return [
    { forma: cilindro(b, px, py, 4.8 * k, hp - 0.4 * k, alto), mat: ESTOPA, o: { tabua: 0, bisel: 1.4, contorno: 0.26, ruga: 0.6, eixo: QUARTO, tom: 0.9, semente: 210 } },
    { forma: menos(elipse(tx, ty, 4.9 * k, 4.9 * k), elipse(tx, ty, 3.5 * k, 3.5 * k)), mat: ESTOPA, o: { tabua: 0, bisel: 1, contorno: 0.24, tom: 1.02, semente: 211 } },
    { forma: elipse(tx, ty, 3.6 * k, 3.6 * k), mat: TEMPERO, o: { tabua: 0, bisel: 1.6, contorno: 0.2, ruga: 0.8 } },
    { forma: elipse(tx - 0.7 * k, ty - 0.8 * k, 1.7 * k, 1.5 * k), mat: TEMPERO, o: { tabua: 0, bisel: 1, contorno: 0, tom: 1.12 } },
  ]
}

/** Dois pesos empilhados no prato (o contrapeso do saco). */
function pesosNoPrato(b: Bancada, px: number, py: number, hp: number): Desenho[] {
  const { k } = b
  return [...peso(b, px, py, 4.1 * k, hp - 0.4 * k, hp + 2.6 * k, false), ...peso(b, px - 0.3 * k, py - 0.2 * k, 3 * k, hp + 2.6 * k, hp + 4.8 * k, true)]
}

/** Um peso de bronze de pé: a frente, o topo e (se `pegador`) o botão de pegar. */
function peso(b: Bancada, x: number, y: number, r: number, h0: number, h1: number, pegador: boolean): Desenho[] {
  const { k } = b
  const [tx, ty] = naTela(b, x, y, h1)
  const lista: Desenho[] = [
    { forma: cilindro(b, x, y, r, h0, h1), mat: BRONZE, o: { tabua: 0, bisel: 0.8, contorno: 0.3, tom: TOM_DE_PE } },
    { forma: elipse(tx, ty, r, r), mat: BRONZE, o: { tabua: 0, bisel: 0.9, contorno: 0.28, tom: 1.02 } },
    { forma: elipse(tx, ty, r * 0.66, r * 0.66), mat: BRONZE, o: { tabua: 0, bisel: 0.5, contorno: 0.12, tom: 0.92 } },
  ]
  if (pegador) {
    const [, ky] = naTela(b, x, y, h1 + 1.4 * k)
    lista.push({ forma: capsula(tx, ty, tx, ky, 0.55 * k), mat: BRONZE, o: { tabua: 0, bisel: 0.4, contorno: 0.3, tom: 0.8 } })
    lista.push({ forma: elipse(tx, ky, 0.95 * k, 0.95 * k), mat: BRONZE, o: { tabua: 0, bisel: 0.9, contorno: 0.28, metal: 0.55 } })
  }
  return lista
}

/** O pé torneado, a coluna com os anéis, o travessão inclinado com o gancho de cada ponta, o arco e o fiel. */
function colunaDeFrente(b: Bancada, mad: MaterialDaPeca): Desenho[] {
  const { k } = b
  const y = Y_DA_BALANCA * k
  const eixo = ALTURA_DO_EIXO * k
  const [pex, pey] = naTela(b, 0, y, ALTURA_DO_PE * k)
  const lista: Desenho[] = [
    { forma: cilindro(b, 0, y, RAIO_DO_PE * k, 0, ALTURA_DO_PE * k), mat: mad, o: { tabua: 0, bisel: 0.9, contorno: 0.3, tom: TOM_DE_PE, eixo: QUARTO, semente: 230 } },
    { forma: elipse(pex, pey, RAIO_DO_PE * k, RAIO_DO_PE * k), mat: mad, o: { tabua: 0, bisel: 1.2, contorno: 0.28, tom: 0.98, semente: 231 } },
    { forma: elipse(pex, pey, RAIO_DO_PE * 0.6 * k, RAIO_DO_PE * 0.6 * k), mat: mad, o: { tabua: 0, bisel: 0.8, contorno: 0.2, tom: 0.9, semente: 232 } },
    fio(naTela(b, 0, y, ALTURA_DO_PE * k - 0.4), naTela(b, 0, y, eixo), 1.25 * k, LATAO, { bisel: 0.9, contorno: 0.3 }),
  ]
  for (const h of [0.08, 0.36, 0.66, 0.94]) {
    const [rx, ry] = naTela(b, 0, y, ALTURA_DO_PE * k + h * (eixo - ALTURA_DO_PE * k))
    lista.push({ forma: elipse(rx, ry, 2.1 * k, 0.9 * k), mat: LATAO, o: { ...DO_LATAO, tom: 1 } })
  }
  // O arco do fiel, no plano do travessão, e o fiel, de pé em ângulo reto com ele.
  const arco: Ponto[] = []
  for (let i = 0; i <= 8; i += 1) {
    const a = Math.PI * (0.3 + (0.4 * i) / 8)
    arco.push(naTela(b, Math.cos(a) * ARCO_DO_FIEL * k, y, eixo + Math.sin(a) * ARCO_DO_FIEL * k))
  }
  lista.push({ forma: cadeia(arco, 0.42 * k), mat: LATAO, o: { ...DO_LATAO, bisel: 0.4, tom: 0.9 } })
  const seno = (INCLINACAO * k) / (MEIO_TRAVESSAO * k)
  // O travessão: da ponta do saco (esquerda, mais baixa) à dos pesos.
  const esquerda = naTela(b, -MEIO_TRAVESSAO * k, y, pontaDoTravessao(k, -1))
  const direita = naTela(b, MEIO_TRAVESSAO * k, y, pontaDoTravessao(k, 1))
  lista.push({ forma: barra(esquerda[0], esquerda[1], direita[0], direita[1], 2 * k), mat: LATAO, o: { ...DO_LATAO, eixo: Math.atan2(direita[1] - esquerda[1], direita[0] - esquerda[0]), tom: 0.98 } })
  for (const lado of [-1, 1]) {
    const ponta = naTela(b, lado * (MEIO_TRAVESSAO + 1.5) * k, y, pontaDoTravessao(k, lado) + lado * seno * 1.5 * k)
    lista.push({ forma: elipse(ponta[0], ponta[1], 1.4 * k, 1.4 * k), mat: LATAO, o: { ...DO_LATAO, bisel: 1, metal: 0.55 } })
    const [gx, gy] = naTela(b, lado * MEIO_TRAVESSAO * k, y, pontaDoTravessao(k, lado) - 1.6 * k)
    lista.push({ forma: menos(elipse(gx, gy, 1.5 * k, 1.5 * k), elipse(gx, gy, 0.7 * k, 0.7 * k)), mat: LATAO, o: { ...DO_LATAO, bisel: 0.5, tom: 0.9 } })
  }
  const pivo = naTela(b, 0, y, eixo)
  const ponta = naTela(b, -seno * FIEL * k, y, eixo + FIEL * k)
  lista.push({ forma: capsula(pivo[0], pivo[1], ponta[0], ponta[1], 0.5 * k), mat: LATAO, o: { ...DO_LATAO, bisel: 0.4, tom: 1.06 } })
  lista.push({ forma: elipse(pivo[0], pivo[1], 2.4 * k, 2 * k), mat: LATAO, o: { ...DO_LATAO, bisel: 1.2, metal: 0.5 } })
  return lista
}

/** A escadinha de pesos e as moedas, cada coisa no seu lugar no tampo (x, y), para a ordem do fundo para a frente. */
interface Coisa {
  readonly x: number
  readonly y: number
  readonly deFrente: () => Desenho[]
}

function coisasNoTampo(b: Bancada): Coisa[] {
  const { k } = b
  const coisas: Coisa[] = []
  let x = INICIO_DA_ESCADINHA * k
  for (const [r, h] of ESCADINHA) {
    const meio = x + r * k
    coisas.push({ x: meio, y: Y_DA_ESCADINHA * k, deFrente: () => peso(b, meio, Y_DA_ESCADINHA * k, r * k, 0, h * k, true) })
    x = meio + r * k + VAO_DA_ESCADINHA * k
  }
  coisas.push({
    x: PILHA.x * k,
    y: PILHA.y * k,
    deFrente: () =>
      Array.from({ length: PILHA.moedas }, (_, j) => {
        const mx = (PILHA.x + j * 0.3) * k
        const my = (PILHA.y - j * 0.2) * k
        const [tx, ty] = naTela(b, mx, my, (j + 1) * ESPESSURA_DA_MOEDA * k)
        const mat = j % 2 === 0 ? OURO : PRATA
        return [
          { forma: cilindro(b, mx, my, RAIO_DA_MOEDA * k, j * ESPESSURA_DA_MOEDA * k, (j + 1) * ESPESSURA_DA_MOEDA * k), mat, o: { tabua: 0, bisel: 0.4, contorno: 0.3, tom: TOM_DE_PE } },
          { forma: elipse(tx, ty, RAIO_DA_MOEDA * k, RAIO_DA_MOEDA * k), mat, o: { tabua: 0, bisel: 0.8, contorno: 0.28, metal: 0.55 } },
        ]
      }).flat(),
  })
  for (const [mx, my, mat] of SOLTAS) {
    coisas.push({
      x: mx * k,
      y: my * k,
      deFrente: () => {
        const [tx, ty] = naTela(b, mx * k, my * k, 0.4 * k)
        return [{ forma: elipse(tx, ty, RAIO_DA_MOEDA * 0.95 * k, RAIO_DA_MOEDA * 0.95 * k), mat, o: { tabua: 0, bisel: 0.8, contorno: 0.3, metal: 0.55 } }]
      },
    })
  }
  return coisas
}

/** As sombras pintadas no tampo, na 3/4: do pé, da coluna, do travessão, dos pratos e de cada peso. */
function sombrasNoTampo(b: Bancada, coisas: readonly Coisa[]): Desenho[] {
  const { k } = b
  const y = Y_DA_BALANCA * k
  const ponto = (x: number, yy: number, h: number): Ponto => sombraNaTela(b, x, yy, h)
  const lista: Desenho[] = []
  const pe = ponto(0, y, ALTURA_DO_PE * k)
  lista.push({ forma: elipse(pe[0], pe[1], RAIO_DO_PE * k, RAIO_DO_PE * k), mat: SOMBRA, o: DA_SOMBRA })
  // Sem a sombra do travessão: na 3/4 ela cai longe dele, na frente do pé, e lia como uma vareta solta no pano.
  lista.push(fio(ponto(0, y, ALTURA_DO_PE * k), ponto(0, y, ALTURA_DO_EIXO * k), 1.2 * k, SOMBRA, DA_SOMBRA))
  for (const lado of [-1, 1]) {
    const p = ponto(lado * MEIO_TRAVESSAO * k, y, ALTURA_DO_PRATO * k)
    lista.push({ forma: elipse(p[0], p[1], RAIO_DO_PRATO * k, RAIO_DO_PRATO * k), mat: SOMBRA, o: DA_SOMBRA })
  }
  for (const c of coisas) {
    const p = ponto(c.x, c.y, 2.4 * k)
    lista.push({ forma: elipse(p[0], p[1], 2.6 * k, 2.4 * k), mat: SOMBRA, o: { ...DA_SOMBRA, alfa: FORCA_DA_SOMBRA * 0.8 } })
  }
  return lista
}

/** A frente do caixote na 3/4: as duas ripas dos cantos e o pano que cai do tampo (só de frente; de lado o pano acaba antes da beira). */
function frenteDoCaixote(b: Bancada, mad: MaterialDaPeca, pano: MaterialDaPeca, cx: number): Desenho[] {
  const { k, H, tx, ty } = b
  const lista: Desenho[] = []
  for (const lado of [-1, 1]) {
    const x = lado * (tx - 1.8 * k)
    lista.push({ forma: caixa(x - 1.7 * k, ty - H + 0.3, x + 1.7 * k, ty, 0.4), mat: mad, o: { tabua: 0, bisel: 0.8, contorno: 0.26, eixo: QUARTO, tom: 0.66, semente: 240 + lado } })
  }
  // O pano corre de trás para a frente do caixote: cai pela frente da tela sem giro e de costas; de lado, cai pelos lados, que a 3/4 não mostra.
  if (b.q % 2 === 1) return lista
  const x = PANO * cx
  const fim = ty - H + QUEDA_DO_PANO * k
  lista.push({ forma: caixa(-x, ty - H - 0.4, x, fim), mat: pano, o: { tabua: 0, bisel: 0.7, contorno: 0.24, ruga: 0.5, tom: TOM_DE_PE, semente: 250 } })
  lista.push({ forma: caixa(-x, fim - 1.1 * k, x, fim - 0.2 * k), mat: GALAO, o: { tabua: 0, bisel: 0.3, contorno: 0.14, tom: 0.8 } })
  for (let fx = -x + 1.1 * k; fx < x; fx += 2.2 * k) lista.push({ forma: capsula(fx, fim - 0.4, fx, fim + 1.5 * k, 0.42 * k), mat: GALAO, o: { tabua: 0, bisel: 0.3, contorno: 0.2, tom: 0.76 } })
  return lista
}

function deFrente(c: ContextoDoMovel, tela: Tela, b: Bancada, cx: number): void {
  const mad = c.m.madeira
  const base = b.ty + 1.5
  const coisas = coisasNoTampo(b)
  tela.por(frenteDoCaixote(b, mad, c.m.pano, cx), base)
  tela.por(sombrasNoTampo(b, coisas), base)
  // Do fundo para a frente da tela: os dois pratos, a coluna com o travessão e cada coisa do tampo, pelo y do pé de cada um.
  const y = Y_DA_BALANCA * b.k
  const grupos: { readonly fundo: number; readonly desenho: () => Desenho[] }[] = [
    { fundo: girarPonto(-MEIO_TRAVESSAO * b.k, y, b.q)[1], desenho: () => pratoDeFrente(b, -1) },
    { fundo: girarPonto(MEIO_TRAVESSAO * b.k, y, b.q)[1], desenho: () => pratoDeFrente(b, 1) },
    { fundo: girarPonto(0, y, b.q)[1], desenho: () => colunaDeFrente(b, mad) },
    ...coisas.map((coisa) => ({ fundo: girarPonto(coisa.x, coisa.y, b.q)[1], desenho: coisa.deFrente })),
  ]
  for (const g of grupos.sort((p, s) => p.fundo - s.fundo)) tela.por(g.desenho(), base)
}

// ---------- de cima ----------

function deCima(c: ContextoDoMovel, cena: Cena, b: Bancada): void {
  const P = c.peca
  const { k } = b
  const y = Y_DA_BALANCA * k
  const r = RAIO_DO_PRATO * k
  const sombra = (dx: number, dy: number): Desenho[] => [
    { forma: barra(-MEIO_TRAVESSAO * k + dx, y + dy, MEIO_TRAVESSAO * k + dx, y + dy, 2 * k), mat: SOMBRA, o: DA_SOMBRA },
  ]
  const sombraDoPrato = SOMBRA_X * ALTURA_DO_PRATO * k
  const sombraDoPratoY = SOMBRA_Y * ALTURA_DO_PRATO * k

  // As sombras no pano: do travessão (alto), dos pratos e de cada peso.
  const coisas = coisasNoTampo(b)
  porDeCima(P, cena, [
    ...sombra(SOMBRA_X * ALTURA_DO_EIXO * k, SOMBRA_Y * ALTURA_DO_EIXO * k),
    ...[-1, 1].map((lado): Desenho => ({ forma: elipse(lado * MEIO_TRAVESSAO * k + sombraDoPrato, y + sombraDoPratoY, r, r), mat: SOMBRA, o: DA_SOMBRA })),
    ...coisas.map((coisa): Desenho => ({ forma: elipse(coisa.x + 0.9 * k, coisa.y + 0.7 * k, 2.8 * k, 2.6 * k), mat: SOMBRA, o: { ...DA_SOMBRA, alfa: FORCA_DA_SOMBRA * 0.8 } })),
  ])

  // A escadinha de pesos (o topo e o botão) e as moedas.
  const pesos: Desenho[] = []
  let x = INICIO_DA_ESCADINHA * k
  for (const [raio] of ESCADINHA) {
    const meio = x + raio * k
    pesos.push({ forma: elipse(meio, Y_DA_ESCADINHA * k, raio * k, raio * k), mat: BRONZE, o: { tabua: 0, bisel: 1, contorno: 0.3 } })
    pesos.push({ forma: elipse(meio, Y_DA_ESCADINHA * k, raio * 0.66 * k, raio * 0.66 * k), mat: BRONZE, o: { tabua: 0, bisel: 0.5, contorno: 0.12, tom: 0.92 } })
    pesos.push({ forma: elipse(meio - 0.2 * k, Y_DA_ESCADINHA * k - 0.2 * k, 0.95 * k, 0.95 * k), mat: BRONZE, o: { tabua: 0, bisel: 0.9, contorno: 0.28, metal: 0.55 } })
    x = meio + raio * k + VAO_DA_ESCADINHA * k
  }
  porDeCima(P, cena, pesos)
  const moedas: Desenho[] = []
  for (let j = 0; j < PILHA.moedas; j += 1) {
    moedas.push({ forma: elipse((PILHA.x + j * 0.3) * k, (PILHA.y - j * 0.2) * k, RAIO_DA_MOEDA * k, RAIO_DA_MOEDA * k), mat: j % 2 === 0 ? OURO : PRATA, o: { tabua: 0, bisel: 0.8, contorno: 0.3, metal: 0.55 } })
  }
  for (const [mx, my, mat] of SOLTAS) moedas.push({ forma: elipse(mx * k, my * k, RAIO_DA_MOEDA * 0.95 * k, RAIO_DA_MOEDA * 0.95 * k), mat, o: { tabua: 0, bisel: 0.8, contorno: 0.3, metal: 0.55 } })
  porDeCima(P, cena, moedas)

  // O pé torneado debaixo do travessão.
  porDeCima(P, cena, [
    { forma: elipse(0, y, RAIO_DO_PE * k, RAIO_DO_PE * k), mat: c.m.madeira, o: { tabua: 0, bisel: 1.2, contorno: 0.28, semente: 231 } },
    { forma: elipse(0, y, RAIO_DO_PE * 0.6 * k, RAIO_DO_PE * 0.6 * k), mat: c.m.madeira, o: { tabua: 0, bisel: 0.8, contorno: 0.2, tom: 0.9, semente: 232 } },
  ])

  // Os pratos: a bacia, o que vai nela e as três correntes até o gancho, debaixo da ponta do travessão.
  for (const lado of [-1, 1]) {
    const px = lado * MEIO_TRAVESSAO * k
    const prato: Desenho[] = [
      { forma: elipse(px, y, r, r), mat: LATAO, o: { ...DO_LATAO, bisel: 1.2 } },
      { forma: elipse(px, y, r * 0.78, r * 0.78), mat: LATAO, o: { ...DO_LATAO, tom: 0.84, recesso: { k: 1.4, forca: 0.35 } } },
    ]
    if (lado < 0) {
      prato.push({ forma: menos(elipse(px, y + 0.3 * k, 4.9 * k, 4.9 * k), elipse(px, y + 0.3 * k, 3.5 * k, 3.5 * k)), mat: ESTOPA, o: { tabua: 0, bisel: 1, contorno: 0.26, semente: 211 } })
      prato.push({ forma: elipse(px, y + 0.3 * k, 3.6 * k, 3.6 * k), mat: TEMPERO, o: { tabua: 0, bisel: 1.6, contorno: 0.2, ruga: 0.8 } })
      prato.push({ forma: elipse(px - 0.7 * k, y - 0.5 * k, 1.7 * k, 1.5 * k), mat: TEMPERO, o: { tabua: 0, bisel: 1, contorno: 0, tom: 1.12 } })
    } else {
      prato.push({ forma: elipse(px, y, 4.1 * k, 4.1 * k), mat: BRONZE, o: { tabua: 0, bisel: 1, contorno: 0.3 } })
      prato.push({ forma: elipse(px - 0.3 * k, y - 0.2 * k, 3 * k, 3 * k), mat: BRONZE, o: { tabua: 0, bisel: 0.9, contorno: 0.28, tom: 1.04 } })
      prato.push({ forma: elipse(px - 0.5 * k, y - 0.4 * k, 0.95 * k, 0.95 * k), mat: BRONZE, o: { tabua: 0, bisel: 0.9, contorno: 0.28, metal: 0.55 } })
    }
    for (const a of PONTOS_DA_CORRENTE) prato.push(fio([px, y], [px + r * 0.92 * Math.cos(a), y + r * 0.92 * Math.sin(a)], 0.4 * k, LATAO, { textura: texDaCorrente, tom: 0.92 }))
    porDeCima(P, cena, prato)
  }

  // O travessão por cima de tudo: a barra, as pontas, os ganchos e o miolo do eixo.
  const travessao: Desenho[] = [{ forma: barra(-MEIO_TRAVESSAO * k, y, MEIO_TRAVESSAO * k, y, 2 * k), mat: LATAO, o: { ...DO_LATAO, tom: 1.02 } }]
  for (const lado of [-1, 1]) {
    travessao.push({ forma: elipse(lado * (MEIO_TRAVESSAO + 1.5) * k, y, 1.4 * k, 1.4 * k), mat: LATAO, o: { ...DO_LATAO, bisel: 1, metal: 0.55 } })
    travessao.push({ forma: menos(elipse(lado * MEIO_TRAVESSAO * k, y, 1.5 * k, 1.5 * k), elipse(lado * MEIO_TRAVESSAO * k, y, 0.7 * k, 0.7 * k)), mat: LATAO, o: { ...DO_LATAO, bisel: 0.5, tom: 0.9 } })
  }
  travessao.push({ forma: elipse(0, y, 2.4 * k, 2.4 * k), mat: LATAO, o: { ...DO_LATAO, bisel: 1.2, metal: 0.5 } })
  porDeCima(P, cena, travessao)
}

/** O escalão do detalhe: 1 na pegada de partida (1 x 0,7 casa), preso para a balança não sumir nem estourar se o mestre esticar o caixote. */
const ESCALA_MINIMA = 0.8
const ESCALA_MAXIMA = 1.4
const FUNDO_DE_PARTIDA = 0.7

export const montarBalancaDeMercador: MontarMovel = (c, cena) => {
  const q = quartosDoGiro(c.giro)
  const k = Math.min(ESCALA_MAXIMA, Math.max(ESCALA_MINIMA, Math.min(c.w / G, c.h / (FUNDO_DE_PARTIDA * G))))
  const cx = c.hw - FOLGA_X
  const cy = c.hh - FOLGA_Y
  const H = ALTURA_DO_CAIXOTE * G * k
  const deLado = q % 2 === 1
  const b: Bancada = { q, k, H, tx: deLado ? cy : cx, ty: deLado ? cx : cy }

  // O caixote (derivado): o tampo de tábuas, a sombra que vira a frente na 3/4 e o pano por cima, com o galão dos lados.
  const tampo = caixa(-cx, -cy, cx, cy, 1)
  cena.sombras.push({ forma: tampo, z: H }, contato(tampo, 0.3))
  cena.partes.push(c.peca(tampo, c.m.madeira, { eixo: 0, tabua: 6.5, bisel: 1, contorno: 0.24, semente: 200 }))
  const xDoPano = PANO * cx
  cena.partes.push(c.peca(caixa(-xDoPano, -cy - 0.3, xDoPano, cy + 0.3, 0.5), c.m.pano, { tabua: 0, bisel: 0.8, contorno: 0.22, ruga: 0.5, semente: 201 }))
  for (const lado of [-1, 1]) {
    const gx = lado * (xDoPano - 1.6 * k)
    cena.partes.push(c.peca(caixa(gx - 0.55 * k, -cy - 0.3, gx + 0.55 * k, cy + 0.3), GALAO, { tabua: 0, bisel: 0.3, contorno: 0.12, tom: 0.88 }))
  }

  // Girada, a cena só serve à 3/4: as peças de cima não entram.
  if (q === 0) deCima(c, cena, b)
  deFrente(c, novaTela(c.peca, cena, q), b, cx)
}
