import { EQUIPES_MAX, ID_DA_EQUIPE_DOS_JOGADORES, equipeDosJogadores, equipesComOLado, type LadoDoNpc } from '../../lib/batalha/equipes'
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
 * Põe o NPC no lado pedido; `false` = não deu (o aviso diz por quê). É sempre
 * a troca de equipe da batalha: com o NPC na ordem, entra no registro com o
 * Desfazer. Sem equipe com jogador, o destino é a equipe automática "Jogadores"
 * (segunda auditoria, achado 2): a batalha a cria na troca e a tira quando o
 * último NPC sai dela.
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
  const destino = lado === 'jogadores' ? (equipeDosJogadores(equipes, personagens)?.id ?? ID_DA_EQUIPE_DOS_JOGADORES) : null
  const feito = useBatalhaStore.getState().trocarEquipe(personagemId, destino)
  if (!feito) useToastStore.getState().push('info', SEM_DONO_DO_LADO)
  return feito
}
