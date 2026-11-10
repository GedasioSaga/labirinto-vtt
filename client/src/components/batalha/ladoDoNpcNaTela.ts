import { EQUIPES_MAX, equipeDosJogadores, equipesComOLado, type LadoDoNpc } from '../../lib/batalha/equipes'
import { equipesAtivas, personagensAtivos, useAdventureStore } from '../../stores/adventureStore'
import { useBatalhaStore } from '../../stores/batalhaStore'
import { useToastStore } from '../../stores/toastStore'

/**
 * Conserto de 09/11/2026 (a Bolha do Tree "não curou nada"): o mestre escolhe
 * de que lado cada NPC luta, na lista de quem entra e no menu da carta da
 * faixa. Por baixo é a equipe de sempre (`equipesComOLado`): "do lado dos
 * jogadores" = na equipe que tem jogador.
 */

/** As duas escolhas, com as palavras da tela. */
export const ROTULO_DO_LADO: Readonly<Record<LadoDoNpc, string>> = {
  contra: 'Contra os jogadores',
  jogadores: 'Do lado dos jogadores',
}

const SEM_DONO_DO_LADO = 'Sem aventura aberta: as equipes moram na aventura (ou na pasta de mapas). Abra uma para escolher o lado do NPC.'
const SEM_VAGA_PARA_O_LADO = `Já há ${EQUIPES_MAX} equipes: apague uma em "Equipes", no painel da batalha, para criar a dos jogadores.`

/**
 * Põe o NPC no lado pedido; `false` = não deu (o aviso diz por quê). Com a
 * equipe dos jogadores já criada (ou só saindo dela), é a troca de equipe de
 * sempre: entra no registro da batalha com o Desfazer. Sem equipe com jogador,
 * nasce a equipe "Jogadores" com todos os jogadores e ele.
 */
export function porNpcNoLado(personagemId: string, lado: LadoDoNpc): boolean {
  const aventura = useAdventureStore.getState()
  const equipes = equipesAtivas(aventura)
  const personagens = personagensAtivos(aventura)
  const depois = equipesComOLado(equipes, personagens, personagemId, lado)
  if (depois === equipes) return true
  if (depois === null) {
    useToastStore.getState().push('info', SEM_VAGA_PARA_O_LADO)
    return false
  }
  const destino = lado === 'jogadores' ? equipeDosJogadores(equipes, personagens) : null
  const feito = lado === 'contra' || destino !== null ? useBatalhaStore.getState().trocarEquipe(personagemId, destino?.id ?? null) : aventura.salvarEquipes(depois)
  if (!feito) useToastStore.getState().push('info', SEM_DONO_DO_LADO)
  return feito
}
