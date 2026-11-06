import { cartaDaVez } from '../../../../lib/batalha/turnos'
import type { DueloNoFio } from '../../../../lib/treino/duelo'
import type { VagaDoTreino } from '../../../../lib/treino/mesaEmMemoria'
import { recursoDeVida, vidaDoPersonagem } from '../../../../lib/vidaDaFicha'
import type { CasaDaArena } from '../../../../lib/arena/grade'
import { SISTEMA_DO_LOBBY } from '../../contexto'
import { ID_DO_JUIZ } from '../juiz/juizDoTreino'
import type { BonecoNaGrade } from './bonecos'
import { quemOJuizOlha } from './olharDoJuiz'
import { retratoDoBoneco } from './retratos'

/**
 * Os bonecos de uma luta no formato do fio (`DueloNoFio`, o do treino e o do
 * duelo): a casa de cada vaga (`posicoes`), quem está na vez, a Vida que resta
 * e quem caiu. `podeAndar` é de quem liga: no treino, o lado de quem joga; no
 * duelo, o servidor decide e a tela só deixa pegar a ficha que ele aceitaria.
 */

const RECURSO_DA_VIDA = recursoDeVida(SISTEMA_DO_LOBBY)

/** O Judge na luta: para quem ele olha (o golpe que o envolve, senão a ficha da vez), como casa da grade. */
function olharDoJuiz(duelo: DueloNoFio, tokenId: string): { olhaPara: CasaDaArena | null } {
  const outro = quemOJuizOlha(duelo.turnos, tokenId)
  return { olhaPara: outro === null ? null : (duelo.posicoes[outro] ?? null) }
}

export function bonecosDoDuelo(duelo: DueloNoFio, demo: boolean, podeAndar: (vaga: VagaDoTreino, dePe: boolean) => boolean): BonecoNaGrade[] {
  const vezDe = duelo.fim === null ? (cartaDaVez(duelo.turnos)?.tokenId ?? null) : null
  const porId = new Map(duelo.lutadores.personagens.map((personagem) => [personagem.id, personagem]))
  const bonecos: BonecoNaGrade[] = []
  for (const vaga of duelo.lutadores.vagas) {
    const doc = porId.get(vaga.personagemId)
    const casa = duelo.posicoes[vaga.tokenId]
    if (doc === undefined || casa === undefined) continue
    const vida = RECURSO_DA_VIDA === null ? null : vidaDoPersonagem(doc, RECURSO_DA_VIDA)
    const dePe = vida === null || vida.atual > 0
    bonecos.push({
      ...(vaga.origem === ID_DO_JUIZ ? { juiz: olharDoJuiz(duelo, vaga.tokenId) } : {}),
      tokenId: vaga.tokenId,
      nome: doc.nome,
      lado: vaga.lado,
      casa,
      // A semente do rosto inventado da demo é a ficha de origem: as cópias do mesmo inimigo têm o mesmo rosto.
      retrato: retratoDoBoneco(doc.retrato, vaga.origem, demo),
      vida: vida === null ? null : vida.atual / vida.maximo,
      naVez: vezDe === vaga.tokenId,
      caiu: !dePe,
      podeAndar: duelo.fim === null && podeAndar(vaga, dePe),
    })
  }
  return bonecos
}
