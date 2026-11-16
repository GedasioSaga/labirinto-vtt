/**
 * ARMADILHAS DOS JOGOS DE ABRIR: o que sai do recipiente aberto, sem aviso
 * (surpresa total, decisão do mestre em PEDIDO.md).
 *
 * COBRA: susto forte. Salta da boca do recipiente até a cara de quem joga em
 * 0,12 s, fica de boca aberta chiando, a tela treme e um único flash quente
 * marca o bote; em 0,8 s volta para dentro.
 * ARANHA: susto menor. Sobe pela boca, ergue as patas da frente e desce, sem
 * salto, sem tremor e sem flash.
 * MOVIMENTO REDUZIDO: sem tremor, sem flash e sem salto. Só a imagem (parada,
 * do tamanho cheio) e o som.
 *
 * Linha do tempo pura, sem DOM, em passo fixo DT: `quadro()` diz, para um
 * instante, onde o bicho está e quanto a tela treme. O tremor é uma função do
 * tempo (não de sorteio), para a mesma partida tremer igual em toda execução.
 */
import { DT, type Evento } from '../abrir/tipos'

export type Armadilha = 'nenhuma' | 'cobra' | 'aranha'
export type Bicho = Exclude<Armadilha, 'nenhuma'>
export const ARMADILHAS: readonly Armadilha[] = ['nenhuma', 'cobra', 'aranha']
export const NOME_DA_ARMADILHA: Readonly<Record<Armadilha, string>> = { nenhuma: 'Nenhuma', cobra: 'Cobra', aranha: 'Aranha' }

/** Onde o bicho fica no meio do susto: o centro da tela lógica, um pouco acima. */
export const CENTRO_DO_SUSTO: readonly [number, number] = [120, 66]

/* Linha do tempo da cobra, em s e px. */
export const COBRA = {
  /** Duração total do susto (meta: 0,8 s ± 0,05). */
  duracao: 0.8,
  /** Do bote até a cara de quem joga. */
  salto: 0.12,
  /** Volta para dentro no fim. */
  recuo: 0.16,
  /** Tamanho na boca do recipiente, em fração do tamanho cheio. */
  escalaInicial: 0.2,
  /** Amplitude do tremor no bote, em px da tela lógica. */
  tremorPx: 4,
  /** Tempo até o tremor zerar, em s. */
  tremorQueda: 0.45,
  /** Duração do único flash, em s. */
  flash: 0.09,
  /** Opacidade máxima do flash: quente e meio transparente, nunca branco cheio. */
  flashAlfa: 0.5,
  /** Balanço da cabeça enquanto chia, em px (só no movimento normal). */
  balanco: 1.5,
} as const

/* Linha do tempo da aranha, em s e px. */
export const ARANHA = {
  duracao: 1.2,
  /** Sobe da boca até a borda. */
  subida: 0.26,
  /** Patas da frente erguidas (ameaça). */
  ameacaInicio: 0.34,
  ameacaFim: 0.86,
  /** Volta para dentro. */
  descida: 0.26,
  /** Quanto ela sobe acima da boca, em px (a aranha desenhada tem ~16 px de corpo). */
  altura: 18,
} as const

/** Fade de saída no movimento reduzido, em s: opacidade não é movimento. */
const SAIDA_REDUZIDA = 0.1

export interface Susto {
  bicho: Bicho
  reduzido: boolean
  /** Boca do recipiente aberto, em px: de onde o bicho sai. */
  boca: readonly [number, number]
  /** Tempo desde o começo do susto, em s. */
  t: number
  fim: boolean
  /** Eventos do último passo (som). */
  eventos: Evento[]
}

export function duracaoDoSusto(bicho: Bicho): number {
  return bicho === 'cobra' ? COBRA.duracao : ARANHA.duracao
}

export function criarSusto(bicho: Bicho, reduzido: boolean, boca: readonly [number, number]): Susto {
  return { bicho, reduzido, boca, t: 0, fim: false, eventos: [] }
}

/** Avança um passo de DT. No primeiro passo sai o som do bicho. Devolve true quando acabou. */
export function passoSusto(s: Susto): boolean {
  s.eventos = []
  if (s.fim) return true
  if (s.t === 0) s.eventos.push({ nome: s.bicho === 'cobra' ? 'bote' : 'aranha' })
  s.t += DT
  if (s.t >= duracaoDoSusto(s.bicho) - 1e-9) s.fim = true
  return s.fim
}

/** O estado visível de um instante do susto. */
export interface QuadroDoSusto {
  /** Tamanho do bicho, em fração do tamanho cheio. */
  escala: number
  /** Centro do bicho na tela lógica, em px. */
  x: number
  y: number
  /** Deslocamento da cena inteira (tremor), em px inteiros. */
  tremorX: number
  tremorY: number
  /** 0..1 do flash quente por cima de tudo. */
  flash: number
  /** 0..1 de opacidade do bicho. */
  opacidade: number
  /** 0..1 da pose: boca aberta da cobra, patas erguidas da aranha. */
  pose: number
  /** Fase das patas da aranha andando (0 parada). */
  passada: number
  /** 0..1 de língua da cobra para fora (tremula no normal; parada no reduzido). */
  lingua: number
}

const saidaCubica = (u: number): number => 1 - Math.pow(1 - u, 3)
const entradaQuadratica = (u: number): number => u * u
const limitar = (v: number, a = 0, b = 1): number => Math.max(a, Math.min(b, v))

function quadroDaCobra(t: number, reduzido: boolean, boca: readonly [number, number]): QuadroDoSusto {
  const [cx, cy] = CENTRO_DO_SUSTO
  const d = COBRA.duracao
  if (reduzido) {
    const opacidade = t >= d - SAIDA_REDUZIDA ? limitar((d - t) / SAIDA_REDUZIDA) : 1
    return { escala: 1, x: cx, y: cy, tremorX: 0, tremorY: 0, flash: 0, opacidade, pose: 1, passada: 0, lingua: 1 }
  }
  let escala: number, x: number, y: number
  if (t < COBRA.salto) {
    const u = saidaCubica(t / COBRA.salto)
    escala = COBRA.escalaInicial + (1 - COBRA.escalaInicial) * u
    x = boca[0] + (cx - boca[0]) * u
    y = boca[1] + (cy - boca[1]) * u
  } else if (t < d - COBRA.recuo) {
    escala = 1
    x = cx + COBRA.balanco * Math.sin((t - COBRA.salto) * 14)
    y = cy
  } else {
    const u = entradaQuadratica(limitar((t - (d - COBRA.recuo)) / COBRA.recuo))
    escala = 1 - (1 - COBRA.escalaInicial) * u
    x = cx + (boca[0] - cx) * u
    y = cy + (boca[1] - cy) * u
  }
  const amp = COBRA.tremorPx * Math.max(0, 1 - t / COBRA.tremorQueda)
  const tremorX = Math.round(amp * Math.sin(t * 91 + 0.7))
  const tremorY = Math.round(amp * 0.7 * Math.sin(t * 67 + 2.1))
  const flash = t < COBRA.flash ? COBRA.flashAlfa * (1 - t / COBRA.flash) : 0
  // A boca abre no salto e fica escancarada; fecha um pouco no recuo.
  const pose = t < COBRA.salto ? 0.4 + 0.6 * (t / COBRA.salto) : t < d - COBRA.recuo ? 1 : 0.6
  const opacidade = t >= d - 0.05 ? limitar((d - t) / 0.05) : 1
  // Língua: curta no salto, depois tremula rápido (~4,5 vezes por segundo) enquanto chia.
  const lingua = t < COBRA.salto ? 0.3 : 0.55 + 0.45 * Math.abs(Math.sin((t - COBRA.salto) * 14))
  return { escala, x, y, tremorX, tremorY, flash, opacidade, pose, passada: 0, lingua }
}

function quadroDaAranha(t: number, reduzido: boolean, boca: readonly [number, number]): QuadroDoSusto {
  const d = ARANHA.duracao
  const topo = boca[1] - ARANHA.altura
  if (reduzido) {
    const opacidade = t >= d - SAIDA_REDUZIDA ? limitar((d - t) / SAIDA_REDUZIDA) : 1
    return { escala: 1, x: boca[0], y: topo, tremorX: 0, tremorY: 0, flash: 0, opacidade, pose: 1, passada: 0, lingua: 0 }
  }
  const dentro = boca[1] + 6
  let y: number
  let andando = false
  if (t < ARANHA.subida) {
    y = dentro + (topo - dentro) * saidaCubica(t / ARANHA.subida)
    andando = true
  } else if (t < d - ARANHA.descida) {
    y = topo
  } else {
    y = topo + (dentro - topo) * entradaQuadratica(limitar((t - (d - ARANHA.descida)) / ARANHA.descida))
    andando = true
  }
  const pose = t >= ARANHA.ameacaInicio && t < ARANHA.ameacaFim ? 1 : 0
  return { escala: 1, x: boca[0], y, tremorX: 0, tremorY: 0, flash: 0, opacidade: 1, pose, passada: andando ? t * 22 : 0, lingua: 0 }
}

/** O quadro do instante atual do susto. */
export function quadro(s: Readonly<Susto>): QuadroDoSusto {
  return s.bicho === 'cobra' ? quadroDaCobra(s.t, s.reduzido, s.boca) : quadroDaAranha(s.t, s.reduzido, s.boca)
}

/** Números do gráfico do movimento. */
export function amostraSusto(s: Readonly<Susto>): Readonly<Record<string, number>> {
  const q = quadro(s)
  return {
    t: s.t, escala: q.escala, x: q.x, y: q.y, tremorX: q.tremorX, tremorY: q.tremorY,
    tremor: Math.hypot(q.tremorX, q.tremorY), flash: q.flash, opacidade: q.opacidade, pose: q.pose,
  }
}

/** Roda o susto inteiro amostrando a cada `passos` passos (12 = 0,1 s), sem desenhar. */
export function simularSusto(bicho: Bicho, reduzido: boolean, boca: readonly [number, number], passos = 12): { t: number; v: Readonly<Record<string, number>> }[] {
  const s = criarSusto(bicho, reduzido, boca)
  const amostras: { t: number; v: Readonly<Record<string, number>> }[] = []
  for (let i = 0; !s.fim; i++) {
    if (i % passos === 0) amostras.push({ t: s.t, v: amostraSusto(s) })
    passoSusto(s)
  }
  amostras.push({ t: s.t, v: amostraSusto(s) })
  return amostras
}
