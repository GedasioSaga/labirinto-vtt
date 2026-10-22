import type { AnimacaoDePorta, PortaParaDesenho } from '../../portas/animacoesDePorta'
import { desenharBatente, tracarRetanguloDaPorta } from '../../portas/animacoesDePorta'

/**
 * DUPLA: a folha vira duas, cada uma presa por dobradiça numa ponta do vão. As
 * duas giram juntas para o lado da normal (o mesmo lado do "Girar"), abrindo
 * do centro para as pontas, até ficarem de pé contra a parede; no fim recolhem
 * para dentro da dobradiça e sobra o batente, que é a porta aberta parada.
 *
 * Opaca o caminho inteiro (sem alfa): no telhado, a cópia de cima cobre a de
 * baixo e as duas ficam iguais. Tudo é função só do progresso, então inverter
 * no meio volta pelo mesmo caminho, sem salto.
 */

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x))
const trecho = (p: number, a: number, b: number): number => clamp01((p - a) / (b - a))
const suave = (x: number): number => x * x * (3 - 2 * x)
const saidaQuad = (x: number): number => 1 - (1 - x) * (1 - x)

/** De pé contra a parede: 90 graus. */
const GIRO_ABERTA_RAD = Math.PI / 2
/** O giro termina aqui (o resto do caminho é recolher). Ease-out no trecho: a folha encosta sem bater. */
const FIM_DO_GIRO = 0.78
/** Começa a recolher antes do giro acabar, para as duas fases se fundirem. */
const INICIO_DO_RECOLHER = 0.58

function desenharFechada(g: Parameters<AnimacaoDePorta['desenhar']>[0], porta: PortaParaDesenho): void {
  tracarRetanguloDaPorta(g, porta.cx, porta.cy, porta.ux, porta.uy, porta.meioComprimento, porta.espessura / 2)
  g.fill({ color: porta.cor })
}

const desenhar: AnimacaoDePorta['desenhar'] = (g, porta, progresso) => {
  const p = clamp01(progresso)
  // Nos extremos, exatamente o desenho da porta parada (fechada = cheia; aberta = só o batente).
  if (p <= 0) {
    desenharFechada(g, porta)
    return
  }
  desenharBatente(g, porta)
  if (p >= 1) return

  const angulo = GIRO_ABERTA_RAD * saidaQuad(trecho(p, 0, FIM_DO_GIRO))
  const meiaFolha = (porta.meioComprimento / 2) * (1 - suave(trecho(p, INICIO_DO_RECOLHER, 1)))
  if (meiaFolha <= 0) return
  const nx = -porta.uy
  const ny = porta.ux
  const cos = Math.cos(angulo)
  const sen = Math.sin(angulo)
  for (const lado of [-1, 1]) {
    // Dobradiça na ponta deste lado; a folha aponta para o centro do vão e gira para a normal.
    const dobradicaX = porta.cx + lado * porta.ux * porta.meioComprimento
    const dobradicaY = porta.cy + lado * porta.uy * porta.meioComprimento
    const dx = -lado * porta.ux * cos + nx * sen
    const dy = -lado * porta.uy * cos + ny * sen
    tracarRetanguloDaPorta(g, dobradicaX + dx * meiaFolha, dobradicaY + dy * meiaFolha, dx, dy, meiaFolha, porta.espessura / 2)
    g.fill({ color: porta.cor })
  }
}

export default desenhar
