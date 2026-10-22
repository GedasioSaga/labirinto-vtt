import type { AnimacaoDePorta, PecaDaFolha, PortaParaDesenho } from '../../portas/animacoesDePorta'
import { pintarFolha } from '../../portas/animacoesDePorta'
import { comecarQuadro, escalaDa, saidaQuad, suave, trecho } from './_folha'

/**
 * ARROMBADA: golpe (a folha cede 6 graus na hora), tremor (bate no batente e
 * treme), e então cede de vez: gira rápido na dobradiça de (x1,y1), no
 * batente, até ficar de pé, soltando estilhaços pequenos da fechadura (a ponta
 * de x2,y2), e recolhe. Fechando, o mesmo caminho de volta: bate no lugar e
 * treme ao assentar.
 *
 * O tempo do golpe e do tremor está no próprio desenho (por isso a curva de
 * abrir é linear: o desenho já tem o ritmo). Estilhaços: 5 quadradinhos
 * opacos, da cor da porta com o contorno escuro, com altura do salto, ponto
 * de queda e tamanho sorteados pela posição da porta (cada porta tem os seus,
 * sempre os mesmos).
 */

const GRAU = Math.PI / 180
const FIM_DO_GOLPE = 0.1
const FIM_DO_TREMOR = 0.34
const FIM_DO_GIRO = 0.86
const INICIO_DO_RECOLHER = 0.72
const GOLPE_RAD = 6 * GRAU
const TREMOR_RAD = 3 * GRAU
const TREMOR_IDAS = 2
const TREMOR_DESLIZE_PX = 0.6
const ABERTA_RAD = 90 * GRAU
const ESTILHACOS = 5
const FIM_DOS_ESTILHACOS = 0.8
/** Altura do salto (para o lado em que a folha abre) e ponto de queda na soleira, a partir da fechadura: px de TELA. */
const SALTO_MIN_PX = 5
const SALTO_VARIA_PX = 6
const QUEDA_MIN_PX = 4
const QUEDA_VARIA_PX = 10
/** Fração do vão em que o estilhaço pode cair: numa porta curta vista de longe ele não passa da dobradiça. */
const QUEDA_MAX_DO_VAO = 0.8

/** Ângulo da folha: cede no golpe, treme em volta disso, depois abre de vez (ease-out: rápido e assenta). */
function anguloDaFolha(p: number): number {
  if (p < FIM_DO_GOLPE) return GOLPE_RAD * saidaQuad(p / FIM_DO_GOLPE)
  if (p < FIM_DO_TREMOR) {
    const t = trecho(p, FIM_DO_GOLPE, FIM_DO_TREMOR)
    return GOLPE_RAD + TREMOR_RAD * Math.sin(2 * Math.PI * TREMOR_IDAS * t) * (1 - t)
  }
  return GOLPE_RAD + (ABERTA_RAD - GOLPE_RAD) * saidaQuad(trecho(p, FIM_DO_TREMOR, FIM_DO_GIRO))
}

/** Sorteio determinístico (mulberry32) com semente na posição da porta. */
function sorteador(porta: PortaParaDesenho): () => number {
  let s = (Math.imul(Math.round(porta.x1 * 8), 73856093) ^ Math.imul(Math.round(porta.y1 * 8), 19349663) ^ Math.imul(Math.round(porta.x2 * 8), 83492791) ^ Math.imul(Math.round(porta.y2 * 8), 40503)) >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Os estilhaços saltam da fechadura e caem na soleira, dentro do vão, onde se
 * desfazem. Começam e acabam em cima do batente porque o desenho é o mesmo nos
 * dois sentidos: fechando, cada um nasce na soleira e volta para a fechadura.
 * Antes eles sumiam no ar, a 7-15 px de tudo, e ao fechar nasciam do nada lá
 * (5 a 10 px de salto na régua M5b, 22/10/2026).
 */
function estilhacos(porta: PortaParaDesenho, p: number): PecaDaFolha[] {
  const k = trecho(p, FIM_DO_TREMOR, FIM_DOS_ESTILHACOS)
  if (k <= 0 || k >= 1) return []
  const escala = escalaDa(porta)
  const nx = -porta.uy
  const ny = porta.ux
  // Saem da fechadura: a ponta de (x2,y2) da porta fechada.
  const ox = porta.cx + porta.ux * porta.meioComprimento
  const oy = porta.cy + porta.uy * porta.meioComprimento
  const sorte = sorteador(porta)
  const voo = saidaQuad(k)
  // Arco de salto: zero na saída e na queda, o pico no meio do voo.
  const arco = 4 * voo * (1 - voo)
  // Nascem pequenos e crescem em 10% do trecho (sem pipocar), encolhem até sumir enquanto caem.
  const vida = Math.min(1, k / 0.1) * (1 - suave(trecho(k, 0.45, 1)))
  // O contorno escuro vai em volta: a cor por dentro fica do tamanho do estilhaço do protótipo.
  const meiaBorda = (porta.borda ?? 0) / 2
  const quedaMaxPx = 2 * porta.meioComprimento * escala * QUEDA_MAX_DO_VAO
  const pecas: PecaDaFolha[] = []
  for (let i = 0; i < ESTILHACOS; i += 1) {
    const salto = ((SALTO_MIN_PX + SALTO_VARIA_PX * sorte()) / escala) * arco
    const recuo = (Math.min(quedaMaxPx, QUEDA_MIN_PX + QUEDA_VARIA_PX * sorte()) / escala) * voo
    const lado = ((1.4 + 1.0 * sorte()) / escala) * vida
    const giro = (sorte() * 2 - 1) * Math.PI * k
    if (lado <= 0) continue
    const meio = lado / 2 + meiaBorda * vida
    pecas.push({ forma: 'retangulo', cx: ox - porta.ux * recuo + nx * salto, cy: oy - porta.uy * recuo + ny * salto, dx: Math.cos(giro), dy: Math.sin(giro), meioComprimento: meio, meiaEspessura: meio })
  }
  return pecas
}

const desenhar: AnimacaoDePorta['desenhar'] = (g, porta, progresso) => {
  const p = comecarQuadro(g, porta, progresso)
  if (p === null) return

  const t = trecho(p, FIM_DO_GOLPE, FIM_DO_TREMOR)
  const deslize = p < FIM_DO_TREMOR && p > FIM_DO_GOLPE ? (TREMOR_DESLIZE_PX / escalaDa(porta)) * Math.sin(2 * Math.PI * 3 * t) * (1 - t) : 0
  const angulo = anguloDaFolha(p)
  const meio = porta.meioComprimento * (1 - suave(trecho(p, INICIO_DO_RECOLHER, 1)))
  if (meio > 0) {
    const nx = -porta.uy
    const ny = porta.ux
    const dx = porta.ux * Math.cos(angulo) + nx * Math.sin(angulo)
    const dy = porta.uy * Math.cos(angulo) + ny * Math.sin(angulo)
    const dobradicaX = porta.cx - porta.ux * (porta.meioComprimento - deslize)
    const dobradicaY = porta.cy - porta.uy * (porta.meioComprimento - deslize)
    // Mais curta que grossa, a folha encolhe por inteiro até o ponto da dobradiça (sem toco que some de uma vez em 1).
    pintarFolha(g, porta, [{ forma: 'retangulo', cx: dobradicaX + dx * meio, cy: dobradicaY + dy * meio, dx, dy, meioComprimento: meio, meiaEspessura: Math.min(porta.espessura / 2, meio) }])
  }
  // Os estilhaços voam soltos: pintados à parte, cada um com o contorno dele, por cima da folha.
  const pecas = estilhacos(porta, p)
  if (pecas.length > 0) pintarFolha(g, porta, pecas)
}

export default desenhar
