/**
 * O DESENHO DOS EXTRAS DO PAPEL (fase D5; protótipo aprovado
 * `docs/design/puzzles/prototipo-documento-extras.html`: `ARTES`, `TINTAS`,
 * `poligono`, `fundoManchas`, `svgCera`, `svgCarimbo`). Puro: as contas que o
 * papel (`Papel.tsx`) desenha e os nomes que a ficha do mestre mostra.
 *
 * Tudo que tem acaso sai da semente do documento (`sementeDoTexto(docId)`):
 * as bordas comidas, as manchas, a cera e os furos do carimbo ficam iguais a
 * cada abertura, no mestre e em todo jogador.
 */
import { sorteio } from './resolver'
import type { ArteDoDocumento, DesgasteDoPapel, LetraDoDocumento, ManchasDoPapel, MostraDoTrecho, PapelDoDocumento, TintaDoDocumento } from './tipos'

// ------------------------------------------------------------------ os nomes e as cores das escolhas

/** Os desenhos de selo, carimbo e brasão: um traço só, no quadro 48 x 48 (os do protótipo). */
export const ARTES: Readonly<Record<ArteDoDocumento, { nome: string; d: string }>> = {
  rosa: { nome: 'Rosa', d: 'M24 10.5a7.5 7.5 0 1 0 .01 0zM24 14.6a3.4 3.4 0 1 0 .01 0zM18.4 13.6c2.9 2.2 8.3 2.2 11.2 0M24 25.5V40M24 34.2c3-3.2 6.6-3.6 9-2.4-2 3.2-5.8 3.8-9 2.4zM24 31c-2.6-2.4-5.6-2.6-7.6-1.6 1.8 2.6 4.8 3 7.6 1.6z' },
  corvo: { nome: 'Corvo', d: 'M8.5 30.5c4.6-.2 8.6-5 14.6-6.2 4.8-1 8.4.4 10.5 2.4l5.6-1.6-3.8 3.6c-.6 4.8-5 8.4-11.2 8.6L21 41.5M20.4 37.2h-5.6M15 27.5c3.6 2.6 9 3 13.4.8M31.4 25.2h.2' },
  chave: { nome: 'Chave', d: 'M16 9a7 7 0 1 0 .01 0zM21 21l17 17M30 30l4-4M34.2 34.2l3-3' },
  coroa: { nome: 'Coroa', d: 'M10 33h28l2-17-8 7-8-11-8 11-8-7zM12 38.5h24' },
  torre: { nome: 'Torre', d: 'M14 40V17h4v-5h4v5h4v-5h4v5h4v23zM21 40v-6a3 3 0 0 1 6 0v6M22.5 22.5h3v4h-3zM11 40h26' },
  ancora: { nome: 'Âncora', d: 'M24 13v25M17 19h14M11 29c1 6 6.5 9 13 9s12-3 13-9M24 7.5a3 3 0 1 0 .01 0z' },
}

export const NOMES_DAS_LETRAS: Readonly<Record<LetraDoDocumento, string>> = { mao: 'À mão', maquina: 'Máquina de escrever', impressa: 'Impressa' }

/** A tinta de cada escolha: as 4 do protótipo aprovado. */
export const TINTAS: Readonly<Record<TintaDoDocumento, { nome: string; cor: string }>> = {
  preta: { nome: 'Preta', cor: '#26201a' },
  sepia: { nome: 'Sépia', cor: '#5e3f22' },
  vermelha: { nome: 'Vermelha', cor: '#9b2b22' },
  sangue: { nome: 'Sangue', cor: '#6c120d' },
}

export interface CorComNome {
  valor: string
  nome: string
}

/** O papel envelhecido; a "do papel" é o `null` do desgaste (o botão "Cor padrão" da ficha). */
export const CORES_DO_PAPEL: readonly CorComNome[] = [
  { valor: '#eadcae', nome: 'Amarelado' },
  { valor: '#dcc796', nome: 'Envelhecido' },
  { valor: '#dedbd0', nome: 'Acinzentado' },
  { valor: '#cdb98e', nome: 'Encardido' },
]

export const CORES_DA_CERA: readonly CorComNome[] = [
  { valor: '#8e2a22', nome: 'Vermelha' },
  { valor: '#2f4a2b', nome: 'Verde-musgo' },
  { valor: '#26211f', nome: 'Preta' },
  { valor: '#a37a2c', nome: 'Dourada' },
  { valor: '#2e4470', nome: 'Azul' },
]

export const CORES_DO_CARIMBO: readonly CorComNome[] = [
  { valor: '#33508f', nome: 'Azul' },
  { valor: '#5a3a86', nome: 'Roxa' },
  { valor: '#9b2b22', nome: 'Vermelha' },
  { valor: '#26211f', nome: 'Preta' },
]

export const NOMES_DAS_MANCHAS: Readonly<Record<ManchasDoPapel, string>> = { 0: 'Nenhuma', 1: 'Leves', 2: 'Várias', 3: 'Muitas' }

export const NOMES_DAS_MOSTRAS: Readonly<Record<MostraDoTrecho, string>> = { embaralhado: 'Embaralhado', codigo: 'Código', lingua: 'Outra língua' }

// ------------------------------------------------------------------ as contas do desenho

/** A cor `#rrggbb` mais clara (`f` > 1) ou mais escura (`f` < 1): a sombra e o brilho da cera. */
export function tom(hex: string, f: number): string {
  const n = Number.parseInt(hex.slice(1), 16) || 0
  const canais = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * f))))
  return `#${((1 << 24) | (canais[0] << 16) | (canais[1] << 8) | canais[2]).toString(16).slice(1)}`
}

/** Os lados de cada borda do polígono (o `N` do protótipo). */
const LADOS_DA_BORDA = 18
/** O canto de cima à direita, rasgado: a partir de 80% da largura a borda de cima para. */
const INICIO_DO_RASGO = 80
/** Abaixo do rasgo do canto, a borda direita recomeça da 5ª divisão (5/18 da folha mais baixa, o bilhete de 300 px, dá 83 px). */
const DIVISAO_ABAIXO_DO_RASGO = 5
/** O rasgo da esquerda fica a 58% da altura. */
const ALTURA_DO_RASGO_DA_ESQUERDA = 0.58

/**
 * A borda queimada e os rasgos: um `polygon()` com as bordas comidas, da
 * semente do documento. O bilhete mantém o dente da borda de baixo; o
 * pergaminho, os rolos de fora (só os lados do meio são comidos).
 */
export function recorteDoPapel(semente: number, desgaste: Pick<DesgasteDoPapel, 'bordaQueimada' | 'rasgos'>, papel: PapelDoDocumento): string {
  const proximo = sorteio(semente ^ 0x51ed)
  const comido = (): number => (desgaste.bordaQueimada ? 1 + proximo() * 9 : 0)
  const pergaminho = papel === 'pergaminho'
  const bilhete = papel === 'bilhete'
  // O canto rasgado é da borda de cima (o pergaminho tem o rolo lá); o rasgo da esquerda vale em todos.
  const rasgos = desgaste.rasgos && !pergaminho
  const n1 = (v: number): string => v.toFixed(1)
  const pontos: string[] = []
  if (pergaminho) pontos.push('-16px -14px', 'calc(100% + 16px) -14px', 'calc(100% + 16px) 10px')
  else {
    for (let i = 0; i <= LADOS_DA_BORDA; i++) {
      const x = (i / LADOS_DA_BORDA) * 100
      if (rasgos && x > INICIO_DO_RASGO) break
      pontos.push(`${n1(x)}% ${n1(comido())}px`)
    }
    if (rasgos) pontos.push('calc(100% - 50px) 9px', 'calc(100% - 41px) 22px', 'calc(100% - 28px) 31px', 'calc(100% - 17px) 48px', 'calc(100% - 7px) 57px', `calc(100% - ${n1(comido())}px) 72px`)
  }
  for (let i = 1; i < LADOS_DA_BORDA; i++) {
    if (rasgos && i < DIVISAO_ABAIXO_DO_RASGO) continue
    pontos.push(`calc(100% - ${n1(comido())}px) ${n1((i / LADOS_DA_BORDA) * 100)}%`)
  }
  if (pergaminho) pontos.push('calc(100% + 16px) calc(100% - 10px)', 'calc(100% + 16px) calc(100% + 14px)', '-16px calc(100% + 14px)', '-16px calc(100% - 10px)')
  else {
    for (let i = LADOS_DA_BORDA; i >= 0; i--) {
      const x = (i / LADOS_DA_BORDA) * 100
      const recuo = bilhete ? (i % 2 === 1 ? 20 : 7) + proximo() * 5 : comido()
      pontos.push(`${n1(x)}% calc(100% - ${n1(recuo)}px)`)
    }
  }
  const rasgoDaEsquerda = Math.round(LADOS_DA_BORDA * ALTURA_DO_RASGO_DA_ESQUERDA)
  for (let i = LADOS_DA_BORDA - 1; i >= 1; i--) {
    const y = n1((i / LADOS_DA_BORDA) * 100)
    if (desgaste.rasgos && i === rasgoDaEsquerda) {
      pontos.push(`${n1(comido())}px calc(${y}% + 10px)`, `17px calc(${y}% + 4px)`, `30px ${y}%`, `13px calc(${y}% - 6px)`, `${n1(comido())}px calc(${y}% - 12px)`)
      continue
    }
    pontos.push(`${n1(comido())}px ${y}%`)
  }
  if (pergaminho) pontos.push('-16px 10px')
  return `polygon(${pontos.join(', ')})`
}

/** Os anéis de xícara e os borrões de umidade de cada nível de manchas (o `fundoManchas` do protótipo). */
const ANEIS_POR_NIVEL: Readonly<Record<ManchasDoPapel, number>> = { 0: 0, 1: 1, 2: 2, 3: 3 }
const BORROES_POR_NIVEL: Readonly<Record<ManchasDoPapel, number>> = { 0: 0, 1: 0, 2: 1, 3: 2 }

/** As manchas como camadas de `radial-gradient`, da semente do documento. Nível 0: vazio. */
export function fundoDasManchas(semente: number, nivel: ManchasDoPapel): string {
  const proximo = sorteio(semente ^ 0xa3c1)
  const camadas: string[] = []
  for (let i = 0; i < ANEIS_POR_NIVEL[nivel]; i++) {
    const x = (12 + proximo() * 76).toFixed(1)
    const y = (10 + proximo() * 80).toFixed(1)
    const r = 36 + proximo() * 46
    camadas.push(
      `radial-gradient(circle at ${x}% ${y}%, transparent ${(r * 0.85).toFixed(1)}px, rgba(122, 80, 32, 0.2) ${(r * 0.93).toFixed(1)}px, rgba(122, 80, 32, 0.34) ${r.toFixed(1)}px, transparent ${(r + 1.6).toFixed(1)}px)`,
      `radial-gradient(circle at ${x}% ${y}%, rgba(150, 104, 48, 0.07) ${(r * 0.86).toFixed(1)}px, transparent ${(r * 0.87).toFixed(1)}px)`,
    )
  }
  for (let i = 0; i < BORROES_POR_NIVEL[nivel]; i++) {
    const x = (10 + proximo() * 80).toFixed(1)
    const y = (10 + proximo() * 80).toFixed(1)
    const rx = (50 + proximo() * 70).toFixed(0)
    const ry = (30 + proximo() * 40).toFixed(0)
    camadas.push(`radial-gradient(ellipse ${rx}px ${ry}px at ${x}% ${y}%, rgba(140, 96, 42, 0.2), rgba(140, 96, 42, 0.08) 62%, transparent 74%)`)
  }
  return camadas.join(', ')
}

/** Os pontos da borda da cera derramada. */
const PONTOS_DA_CERA = 22

/** A borda irregular do selo de cera (quadro de -50 a 50), em curvas que passam pelo meio de cada par de pontos. */
export function contornoDaCera(semente: number): string {
  const proximo = sorteio(semente ^ 0x77)
  const pontos: [number, number][] = []
  for (let i = 0; i < PONTOS_DA_CERA; i++) {
    const angulo = (i / PONTOS_DA_CERA) * Math.PI * 2
    const raio = 41 + proximo() * 3.5 + (proximo() < 0.2 ? 3 + proximo() * 3 : 0)
    pontos.push([Math.cos(angulo) * raio, Math.sin(angulo) * raio])
  }
  const ponto = (i: number): [number, number] => pontos[(i + PONTOS_DA_CERA) % PONTOS_DA_CERA] ?? [0, 0]
  const meio = (p: [number, number], q: [number, number]): [number, number] => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
  const f = (p: [number, number]): string => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`
  let d = `M${f(meio(ponto(-1), ponto(0)))}`
  for (let i = 0; i < PONTOS_DA_CERA; i++) d += ` Q${f(ponto(i))} ${f(meio(ponto(i), ponto(i + 1)))}`
  return `${d}Z`
}

export interface FuroDoCarimbo {
  cx: number
  cy: number
  r: number
}

/** As falhas de tinta do carimbo. */
const FUROS_DO_CARIMBO = 46

/** As falhas de tinta do carimbo (quadro de -60 a 60): a máscara que deixa o carimbo com cara de batido no papel. */
export function furosDoCarimbo(semente: number): FuroDoCarimbo[] {
  const proximo = sorteio(semente ^ 0x3b)
  return Array.from({ length: FUROS_DO_CARIMBO }, () => ({ cx: (proximo() * 2 - 1) * 58, cy: (proximo() * 2 - 1) * 58, r: 0.5 + proximo() * 1.9 }))
}

/** O corpo do texto em volta do carimbo: cabe na volta inteira, entre 6,5 e 11,5. */
export function tamanhoDoTextoDoCarimbo(texto: string): number {
  return Math.min(11.5, Math.max(6.5, 150 / (Math.max(1, [...texto].length) * 0.68)))
}
