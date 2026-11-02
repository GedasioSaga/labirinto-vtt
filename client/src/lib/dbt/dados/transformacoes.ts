/**
 * Gerado por scripts/dbt/gerar-dados.cjs a partir de docs/fontes/dragon-ball-tales/.
 * Não editar à mão: mude o gerador (ou a fonte) e rode `node scripts/dbt/gerar-dados.cjs`.
 *
 * Transformações do capítulo 7 (p. 92-95): a regra geral e o exemplo do Super Saiyajin.
 * O exemplo impresso usa EP +2/+3/+4 e Ki 6/9/12, fora da regra EP = estágio e Ki = 3 × estágio:
 * aqui vale o impresso. As transformações de cada raça ficam em racas.ts.
 */
import type { TransformacaoDBT } from '../modelo'

/** Regra geral (7.1.1-7.1.2, p. 93): EP bônus = estágio; Ki para ativar = 3 × estágio. */
export const REGRA_DE_TRANSFORMACAO = { epPorEstagio: 1, kiPorEstagio: 3, pagina: 93 } as const

export const TRANSFORMACOES_DE_EXEMPLO: TransformacaoDBT[] = [
  {
    id: 'super-saiyajin-estagio-1',
    nome: 'Super Saiyajin – Estágio 1',
    estagio: 1,
    estagioTexto: 'Estágio 1',
    ep: 2,
    custoKi: 6,
    custoTexto: '[KI: 06]',
    requisito: 'Superação de Limites',
    duracao: '',
    efeitos: [
      'Ao atingir esse estado, o Saiyajin desperta um poder explosivo que o impulsiona a superar seus limites constantemente. Sempre que falhar em um teste de rolagem, pode gastar Pontos de Ki (como Ação ou Reação) equivalente à diferença entre o resultado obtido e o necessário para o sucesso, transformando a falha em êxito. Essa mecânica representa a resiliência e determinação incomparáveis da raça Saiyajin.',
    ],
    pagina: 92,
  },
  {
    id: 'super-saiyajin-estagio-2',
    nome: 'Super Saiyajin – Estágio 2',
    estagio: 2,
    estagioTexto: 'Estágio 2',
    ep: 3,
    custoKi: 9,
    custoTexto: '[KI: 09]',
    requisito: 'Super Saiyajin – Estágio 1',
    duracao: '',
    efeitos: [
      'Além dos efeitos do Estágio 1, o usuário ganha controle total sobre sua energia em combate. Agora, pode gastar Pontos de Ki para aumentar o valor de qualquer rolagem na proporção de 1:1, independentemente de já ter acertado ou não. Isso significa que pode transformar erros em acertos e até maximizar o dano de ataques bem-sucedidos.',
    ],
    pagina: 92,
  },
  {
    id: 'super-saiyajin-estagio-3',
    nome: 'Super Saiyajin – Estágio 3',
    estagio: 3,
    estagioTexto: 'Estágio 3',
    ep: 4,
    custoKi: 12,
    custoTexto: '[KI: 12]',
    requisito: 'Super Saiyajin – Estágio 2',
    duracao: '',
    efeitos: [
      'A transformação atinge um nível ainda mais intenso. Além dos efeitos anteriores, o Ki gasto pelo Saiyajin durante a rodada de ação é acumulado como dano extra que pode ser aplicado a qualquer momento em soma a algum de seus ataques, esse acumulo é perdido caso o Saiyajin sofra qualquer peda de consciência',
    ],
    pagina: 93,
  },
]
