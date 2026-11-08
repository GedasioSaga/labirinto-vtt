import type { CartaoDaFicha, Personagem } from '../personagem'
import { ficha } from './fichasDaFatiaB.testkit'

/**
 * Conserto das fichas F2, fatia F: os cartões REAIS do Harvey Solferino e do
 * Siegfried (ids, ação, custo, tempo, dano, efeito e extras copiados do
 * rpg.json da pasta da mesa em 08/11, depois do F0; descrições de fora) e os
 * atributos, recursos e ids reais, para os testes. Só para teste.
 */

function cartao(id: string, nome: string, campos: Record<string, string>, extras: CartaoDaFicha['extras'] = []): CartaoDaFicha {
  return { id, nome, campos, extras, atributos: [], imagem: null, modificadores: [], subcartoes: [] }
}

export const GIRO_DE_PA = cartao('cart_9500ae10-0bdc-4f08-b472-edb73cb70685', 'Giro de Pá', { acao: 'Simples', efeito: 'Dano de Impacto', tempo: '1', dano: 'Força + Agilidade + 30 + Dano da Arma' })
export const PAZADA = cartao('cart_727db45b-e9a9-4510-9392-129c9dca7555', 'Pazada [+1]', {
  acao: 'Simples',
  efeito: 'Causar stun/paralisia de 1 turno para quem foi acertado',
  custo: '15 SP',
  tempo: '2',
  dano: 'Força + 45 + Dano da Arma',
  tipo: 'Debuff',
})
export const GOLPE_BAIXO = cartao(
  'cart_387e7dce-4d87-42d7-8392-10d0d015243b',
  'Golpe Baixo',
  { acao: 'Simples', efeito: 'O alvo fica cego por 2 turnos (cegueira temporária), mas pode atacar.', custo: '20 de SP', tempo: '3', dano: '0', tipo: 'Debuff' },
  [{ nome: 'Para você', valor: 'Você ganha +8 em reação.' }],
)
export const MEDICINA = cartao(
  'cart_d281702e-da8c-4e96-9a97-8e4dd8ef07e9',
  'Medicina',
  { acao: 'Completa', efeito: 'Recupera 100 de vida - Pode fazer isso 3 vezes', custo: '0', tempo: '0', dano: '0' },
  [
    { nome: 'Efeito 2 ', valor: 'Cirurgia - Pode fazer isso 1 vez' },
    { nome: 'Concentração', valor: ' Caso você consiga concentrar 3 vezes ao invés de curar 100 você cura 350 de vida.' },
  ],
)
export const PA = cartao('cart_442aa984-2439-42a9-91d5-c267036cfcce', 'Pá', { acao: 'Bateu com a Pá', categoria: 'Branca', dano: '10' })
export const ATRIBUTOS_DO_HARVEY = { forca: 50, agilidade: 33, percepcao: 10, resistencia: 20, intuicao: 30, espirito: 27, carisma: 5, determinacao: 40 }

/** Um Kit Médico na mochila (o "ele tem 1 AGORA" da resposta; a ficha real ainda não o tem: dado para o F0c). */
export const KIT_MEDICO = { id: 'pin_kit_medico', nome: 'Kit Médico' }

/** O Harvey (Skypean, HP 700, SP 60, Escudo 40); `mochila` = o que ele carrega. */
export function harveyCom(recursos = { hp: 700, sp: 60, escudo: 40 }, mochila: Personagem['mochila'] = [KIT_MEDICO]): Personagem {
  const base = ficha('Harvey Solferino', ATRIBUTOS_DO_HARVEY, recursos, { habilidades: [GIRO_DE_PA, PAZADA, GOLPE_BAIXO, MEDICINA], armas: [PA] })
  return { ...base, id: 'pers_ddda186b-f71f-42b7-bc45-e30b1fb0db7d', escolhas: { raca: 'Skypean', oficio: 'Médico' }, maximos: { hp: 700, sp: 60 }, mochila }
}

const FOGO = [{ nome: 'Embuir Fogo', valor: 'Sim' }]
export const MELODIA = cartao(
  'cart_bb6d363f-449f-4fc1-bbe5-fac6589f2301',
  'Melodia de todas as coisas (Passiva)',
  {
    acao: 'Passiva (ativa-se automaticamente em combate contra um oponente).',
    efeito: 'No início da 3ª rodada. Escolhendo um oponente: aumenta a precisão de seus ataques em +20 contra o oponente analisado.',
    custo: '15SP',
    tempo: '1 vez por combate',
    dano: '0',
    tipo: 'Passiva',
  },
  [{ nome: 'Opção Dado de reação', valor: 'Você ganha + 1 no dado de reação.' }],
)
export const CACA = cartao(
  'cart_89db5c9a-728a-4150-8361-a5638b156ec4',
  'CAÇA AS BRUXAS!',
  { acao: 'Ação Completa', efeito: 'Dispara uma flecha flamejante condensada que causa dano flamejante, e atinge alvos a distância em até 10 quadrados.', custo: '35 SP', tempo: '4', dano: 'Espírito + 15 de dano base + 20 de dano de fogo' },
  [
    ...FOGO,
    { nome: 'Evolution', valor: ' Essa tecnica pode evoluir caso cumpra certas condições, se tornando OVERLOAD.' },
    { nome: 'Condições do Evolution', valor: 'Melodia de todas as coisas tem que está ativada e o caminho do dano deve está ativo, (gastar 50 sp para aprimorar a ação ou ser ajudo por outro NPC/Player que tenha pode de fogo)' },
    { nome: 'Evolui para', valor: 'SUPER CAÇA AS BRUXAS!' },
  ],
)
export const SUPER_CACA = cartao(
  'cart_53943bc4-be4f-4a4d-ab2d-8f6f9d43db01',
  'SUPER CAÇA AS BRUXAS!',
  { acao: 'OVERLOAD', efeito: 'Técnica Overload, quando você usa esse tecnica você ganha muita fadiga. Possui o mesmo efeito do caças as bruxas comum, esse ataque é perfurante acerta vida ignorando a defesa. Seguir todas as condições.', custo: '0', tempo: 'OVERLOAD', dano: '(Força + Espirito) + 100 + 30 de dano de fogo' },
  [{ nome: 'OVERLOAD', valor: 'Só pode usar uma  vez na batalha, você perde metade dos Status.' }],
)
export const LUA = cartao(
  'cart_366f98ce-8206-473a-8646-e34ae6907dbe',
  'Balmung: Lua Incandescente',
  { acao: 'Ação Simples', efeito: 'Acerta os blocos adjacentes: Exemplo  - - - (Acerta os três), é um ataque cortante simples. Você pode acertar até 3 inimigos com isso, o dano é dividido nessa situação.', custo: '30 SP', tempo: '3', dano: '(Força + 20) + Dano da Arma.' },
  FOGO,
)
export const ALVORADA = cartao('cart_bce515c2-a102-4ee0-b0ac-748878dce49a', 'Gram: Alvorada', { acao: 'Ação Simples', efeito: 'Acerta um inimigo único o jogando para cima, é um ataque cortante e de queimadura', custo: '20 SP', tempo: '2', dano: '(Força + 10) + Dano da Arma.' }, FOGO)
export const ENTARDECER = cartao(
  'cart_3868a90d-a138-4fa0-a902-c30a7a53be7b',
  'Gilgamesh: Entardecer',
  { acao: 'Ação Completa', efeito: 'Um golpe de cima para baixo, pode causar atordoamento de 1 turno(Cd 12), é um golpe de impacto.', custo: '35 Sp', tempo: '4', dano: '(Força + 25 de Dano) + Dano da Arma.', tipo: 'Debuff' },
  FOGO,
)
export const ORQUIDEA = cartao('cart_cbdb2bab-bf3e-488b-89ca-c71fcae3e77b', 'Apunhaladora de Sóis: Orquídea', {
  acao: 'Completa',
  efeito: 'Cria uma redoma de fogo em um alvo (1 quadrado envolta do alvo) . O alvo fica "Cego" (bloqueio de visão) e "Imobilizado"(Sem poder se mexer). Se o alvo tentar atacar ou sair da redoma, sofre um dano de fogo de 30 e é possivel da um golpe de oportunidade nele logo em seguida.',
  custo: '45',
  tempo: '3',
  dano: '30',
  tipo: 'Debuff',
})
export const FLORESCER = cartao(
  'cart_aa5281be-6028-47f3-a877-3ef8c40b2424',
  'Orquídea: Florescer',
  { acao: 'Bonus', efeito: 'Consome a redoma de fogo. O alvo sofre um golpe perfurante crítico(Por ser stealth) que ignora da resistência a dano.', custo: '30', tempo: '4', dano: '3*(Força+Agilidade+Dano da Arma) + 50 de queimadura' },
  [{ nome: 'Requisito', valor: 'Só pode ser usada contra um alvo que esteja sob o efeito da *Apunhaladora de Sóis: Orquídea* ou seja logo em seguida.' }],
)
export const CHAMAS = cartao('cart_22d65606-022c-4e24-b0f0-d77ba59c486a', 'Chamas Celenas.', {
  acao: 'Completa',
  efeito: 'O alvo do seu ataque selecionado perde 15 SP/turno e você recupera 10 SP/turno. Caso você sugue todo SP do seu alvo ele começa ter desvantagem no dado de reação. 3% do HP por turno (Isso soma a doença das trevas).',
  custo: '10% do HP',
  tempo: '1 vez na batalha',
  dano: '-',
  tipo: 'Debuff',
})
export const DOENCA = cartao('cart_5e20dfc2-6aad-440c-a2f7-4b5c3b82b67b', 'Condição Rara(Doença das Trevas)', { efeito: 'Perde 3% do HP total ao terminar turno em que se tenha feito uma ação. (Andar/Atacar)' })
const arma = (id: string, nome: string, dano: string, efeito?: string): CartaoDaFicha => cartao(id, nome, { categoria: 'Branca', dano, ...(efeito === undefined ? {} : { efeito }) })
export const BALMUNG = arma('cart_67909881-9ea3-48da-a4d7-046349eb7ae0', 'Balmung', '5')
export const GRAM = arma('cart_e825b2ac-9cd8-435c-b531-c9f2a8d6da67', 'Gram', '8')
export const GILGAMESH = arma('cart_7675b37e-40bb-450a-bb6e-aeeffadbe5c4', 'Gilgamesh', '8')
export const YAMATO = arma('cart_5df98507-049e-44fa-90e6-da876ee95aa5', 'Yamato', '5')
export const APUNHALADORA = arma('cart_a066a6fd-347c-467f-a5a1-d9e7c05965c7', 'Apunhaladora de Sóis', '5', '3x de dano em um ataque furtivo')
export const ATRIBUTOS_DO_SIEG = { forca: 46, agilidade: 33, percepcao: 0, resistencia: 40, intuicao: 30, espirito: 35, carisma: 0, determinacao: 21 }

/** O Siegfried (Lunariano, HP 900, SP 140, Escudo 80, "Armas por batalha: 3 armas"). */
export function siegCom(recursos = { hp: 900, sp: 140, escudo: 80 }): Personagem {
  const base = ficha('Siegfried', ATRIBUTOS_DO_SIEG, recursos, {
    habilidades: [MELODIA, CACA, SUPER_CACA, LUA, ALVORADA, ENTARDECER, ORQUIDEA, FLORESCER, CHAMAS],
    desvantagens: [DOENCA],
    armas: [BALMUNG, GRAM, GILGAMESH, YAMATO, APUNHALADORA],
  })
  return { ...base, id: 'pers_f665c18d-a3fa-46dd-9a58-02a100920d60', escolhas: { raca: 'Lunariano (sem asas)', oficio: 'Gatuno', armasPorBatalha: '3 armas' }, maximos: { hp: 900, sp: 140 } }
}
