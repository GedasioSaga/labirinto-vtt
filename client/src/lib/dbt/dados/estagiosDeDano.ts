/**
 * Gerado por scripts/dbt/gerar-dados.cjs a partir de docs/fontes/dragon-ball-tales/.
 * Não editar à mão: mude o gerador (ou a fonte) e rode `node scripts/dbt/gerar-dados.cjs`.
 *
 * Os estágios de dano pela margem acerto − CA, sem diferença de EP (8.4, p. 103-104).
 */
import type { EstagioDeDanoDBT } from '../modelo'

export const ESTAGIOS_DE_DANO: EstagioDeDanoDBT[] = [
  {
    id: 'erro',
    nome: 'Erro',
    margemMin: null,
    margemMax: 0,
    fracao: 0,
    efeito: 'Se o valor do ataque for igual ou inferior à CA do alvo, o ataque erra completamente. Nenhum dano é causado — o golpe foi bloqueado, desviado, ou o inimigo simplesmente errou o alvo.',
  },
  {
    id: 'minimo',
    nome: 'Dano mínimo (raspão)',
    margemMin: 1,
    margemMax: 2,
    fracao: 0.25,
    efeito: 'Se o valor do ataque superar a CA em apenas 1 ou 2 pontos, o golpe acerta de raspão, ou o defensor conseguiu amortecer boa parte do impacto. Neste caso, o personagem sofre dano mínimo, equivalente a 25% (¼) do dano total da técnica ou ataque utilizado.',
  },
  {
    id: 'medio',
    nome: 'Dano médio',
    margemMin: 3,
    margemMax: 5,
    fracao: 0.5,
    efeito: 'Se o ataque superar a CA entre 3 e 5 pontos, o golpe acerta com mais firmeza. Ele não foi completamente eficaz, mas passou pelas defesas com certa precisão. Isso representa um dano médio, correspondente a 50% (½) do valor total da técnica.',
  },
  {
    id: 'completo',
    nome: 'Dano total (completo)',
    margemMin: 6,
    margemMax: null,
    fracao: 1,
    efeito: 'Se o ataque superar a CA em 6 ou mais pontos, o acerto foi limpo, direto e eficaz. O defensor foi pego de surpresa, não teve tempo de reagir ou não conseguiu se proteger a tempo. Neste caso, o dano é total, ou seja, o valor completo da técnica é aplicado.',
  },
]
