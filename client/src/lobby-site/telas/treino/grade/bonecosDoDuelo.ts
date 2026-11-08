import { cartaDaVez } from '../../../../lib/batalha/turnos'
import { EQUIPE_DA_LUTA, type VagaDaLuta } from '../../../../lib/treino/mesaEmMemoria'
import type { FioDaArena } from '../hudDaLuta'
import { recursoDeVida, vidaDoPersonagem } from '../../../../lib/vidaDaFicha'
import type { CasaDaArena } from '../../../../lib/arena/grade'
import type { SistemaDeRpg } from '../../../../lib/sistemaDeRpg'
import { ID_DO_JUIZ } from '../juiz/juizDoTreino'
import type { BonecoNaGrade } from './bonecos'
import { quemOJuizOlha } from './olharDoJuiz'
import { retratoDoBoneco } from './retratos'

/**
 * Os bonecos de uma luta no formato do fio (`DueloNoFio`, o do treino e o do
 * duelo): a casa de cada vaga (`posicoes`), quem está na vez, a Vida que resta
 * e quem caiu. `podeAndar` é de quem liga: no treino, o lado de quem joga; no
 * duelo, o servidor decide e a tela só deixa pegar a ficha que ele aceitaria.
 * A Vida é a do sistema da campanha (`sistema`).
 */

/** O Judge na luta: para quem ele olha (o golpe que o envolve, senão a ficha da vez), como casa da grade. */
function olharDoJuiz(duelo: FioDaArena, tokenId: string): { olhaPara: CasaDaArena | null } {
  const outro = quemOJuizOlha(duelo.turnos, tokenId)
  return { olhaPara: outro === null ? null : (duelo.posicoes[outro] ?? null) }
}

export function bonecosDoDuelo(duelo: FioDaArena, demo: boolean, podeAndar: (vaga: VagaDaLuta, dePe: boolean) => boolean, sistema: SistemaDeRpg): BonecoNaGrade[] {
  const recursoDaVida = recursoDeVida(sistema)
  const vezDe = duelo.fim === null ? (cartaDaVez(duelo.turnos)?.tokenId ?? null) : null
  const porId = new Map(duelo.lutadores.personagens.map((personagem) => [personagem.id, personagem]))
  const bonecos: BonecoNaGrade[] = []
  for (const vaga of duelo.lutadores.vagas) {
    const doc = porId.get(vaga.personagemId)
    const casa = duelo.posicoes[vaga.tokenId]
    // A vaga que saiu da luta (a conta sumiu ou saiu) não fica na grade.
    if (doc === undefined || casa === undefined || vaga.fora === true) continue
    const vida = recursoDaVida === null ? null : vidaDoPersonagem(doc, recursoDaVida)
    const dePe = vida === null || vida.atual > 0
    bonecos.push({
      ...(vaga.origem === ID_DO_JUIZ ? { juiz: olharDoJuiz(duelo, vaga.tokenId) } : {}),
      tokenId: vaga.tokenId,
      nome: doc.nome,
      // A luta de N lados (F5): a e b são os de sempre; de c em diante, a cor do lado vem junto e o nome também.
      lado: vaga.lado === 'a' ? 'a' : 'b',
      ...(vaga.lado === 'a' || vaga.lado === 'b' ? {} : { cor: EQUIPE_DA_LUTA[vaga.lado].cor, nomeDoLado: EQUIPE_DA_LUTA[vaga.lado].nome }),
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
