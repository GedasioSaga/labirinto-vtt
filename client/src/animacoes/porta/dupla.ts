import type { AnimacaoDePorta, PecaDaFolha } from '../../portas/animacoesDePorta'
import { pintarFolha } from '../../portas/animacoesDePorta'
import { comecarQuadro, saidaQuad, suave, trecho } from './_folha'

/**
 * DUPLA: a folha vira duas, cada uma presa por dobradiça numa ponta do vão (no
 * batente, agora que a folha enche o vão até a parede). As duas giram juntas
 * para o lado da normal (o mesmo lado do "Girar"), abrindo do centro para as
 * pontas, até ficarem de pé contra a parede; no fim recolhem para dentro da
 * dobradiça e sobra o batente, que é a porta aberta parada.
 *
 * As duas meias-folhas são pintadas juntas (`pintarFolha`): enquanto se tocam
 * no meio, são uma barra só com um contorno só. Opaca o caminho inteiro. Tudo
 * é função só do progresso, então inverter no meio volta pelo mesmo caminho.
 */

/** De pé contra a parede: 90 graus. */
const GIRO_ABERTA_RAD = Math.PI / 2
/** O giro termina aqui (o resto do caminho é recolher). Ease-out no trecho: a folha encosta sem bater. */
const FIM_DO_GIRO = 0.78
/** Começa a recolher antes do giro acabar, para as duas fases se fundirem. */
const INICIO_DO_RECOLHER = 0.58

const desenhar: AnimacaoDePorta['desenhar'] = (g, porta, progresso) => {
  const p = comecarQuadro(g, porta, progresso)
  if (p === null) return

  const angulo = GIRO_ABERTA_RAD * saidaQuad(trecho(p, 0, FIM_DO_GIRO))
  // Cada meia-folha tem metade do vão: meio comprimento dela = um quarto do vão.
  const meiaFolha = (porta.meioComprimento / 2) * (1 - suave(trecho(p, INICIO_DO_RECOLHER, 1)))
  if (meiaFolha <= 0) return
  const nx = -porta.uy
  const ny = porta.ux
  const cos = Math.cos(angulo)
  const sen = Math.sin(angulo)
  const pecas: PecaDaFolha[] = []
  for (const lado of [-1, 1]) {
    // Dobradiça na ponta deste lado; a folha aponta para o centro do vão e gira para a normal.
    const dobradicaX = porta.cx + lado * porta.ux * porta.meioComprimento
    const dobradicaY = porta.cy + lado * porta.uy * porta.meioComprimento
    const dx = -lado * porta.ux * cos + nx * sen
    const dy = -lado * porta.uy * cos + ny * sen
    pecas.push({ forma: 'retangulo', cx: dobradicaX + dx * meiaFolha, cy: dobradicaY + dy * meiaFolha, dx, dy, meioComprimento: meiaFolha, meiaEspessura: porta.espessura / 2 })
  }
  pintarFolha(g, porta, pecas)
}

export default desenhar
