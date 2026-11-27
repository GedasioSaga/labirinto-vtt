import { valorDoRank } from '../ajusteDaFicha'
import type { CartaoDaFicha, Personagem } from '../personagem'
import { rankDoValor, type SistemaDeRpg } from '../sistemaDeRpg'
import {
  DANO_MAX,
  partesDoBonus,
  valorComAsPartes,
  type AlvoDoGolpe,
  type BonusDaBatalha,
  type GolpeDaBatalha,
  type LembreteDaMarca,
  type SeloDaBatalha,
} from './combate'
import { normalizar } from './formula'
import { CAMPO_DO_CUSTO, tecnicasDe } from './leituraDaFicha'
import type { Reversao } from './registro'
import type { MarcaAMao } from './mecanicasAMao'
import { comSeloNovo, criarSelo, ondeNaVez, pegaOSelo } from './selos'
import { lerTipo } from './tiposDaHabilidade'
import type { TurnosDaCena } from './turnos'

/**
 * R1 (lote de 01/11, item 1 do pedido): A MARCA do Vincent (Olhar Artístico e
 * Desenhar o Alvo). O selo "Marcado" não tem turnos: dura até o próximo golpe
 * de QUALQUER um que acertar o marcado; esse golpe dá o dobro do dano que
 * chega (depois da reação) e a marca some. Um alvo tem uma marca só.
 *
 * Duas fontes:
 *  - a PASSIVA de marca (Olhar Artístico): quando o dono acerta com arma que
 *    atira, sai o lembrete "Marcar o alvo? Pagar 40 SP · Teste de Percepção ·
 *    Agora não" (nunca automático, como as passivas). O teste é "os dois": o
 *    host rola d20 + modificador do atributo (o rank) contra a CD, e existe
 *    "rolei fora: Passou / Falhou";
 *  - a TÉCNICA que marca ao acertar (Desenhar o Alvo): marca sozinha, sem
 *    custo nem teste.
 *
 * Leitura da ficha: o extra "Marca" é o campo explícito (na passiva, o texto
 * do custo: "Teste de Percepção CD 15 ou 40 SP"; na técnica, "Ao acertar").
 * Sem o extra, o texto: passiva que fala de "marca" com "teste de <atributo>"
 * no custo; técnica (não passiva) que fala de "marca" no efeito.
 *
 * Puro: sem store, sem rede.
 */

/** O nome do selo da marca. */
export const NOME_DA_MARCA = 'Marcado'
/** O golpe que acerta o marcado dá este tanto de dano. */
export const MULTIPLICADOR_DA_MARCA = 2
/** Lembretes de marca esperando numa cena (passou, os mais velhos saem). */
export const LEMBRETES_DA_MARCA_MAX = 16
/** O nome do extra explícito. */
const EXTRA_DA_MARCA = 'marca'

/** O teste que a passiva pede: o atributo (id do sistema) e a CD; `cd` null = a ficha não diz (só "rolei fora"). */
export interface TesteDaMarca {
  atributoId: string
  nome: string
  cd: number | null
}

export type LeituraDaMarca =
  /** A passiva: o SP que paga (`null` = não diz) e o teste (`null` = não diz). Pelo menos um dos dois existe. */
  | { tipo: 'passiva'; sp: number | null; teste: TesteDaMarca | null }
  /** A técnica que marca quem ela acerta. */
  | { tipo: 'aoAcertar' }

function extraDaMarca(cartao: Pick<CartaoDaFicha, 'extras'>): string | null {
  const extra = cartao.extras.find((candidato) => normalizar(candidato.nome) === EXTRA_DA_MARCA)
  return extra === undefined ? null : extra.valor
}

/** "Teste de Percepção Cd 15" (o atributo pelo nome ou abreviação do sistema). */
function testeDoTexto(normal: string, sistema: SistemaDeRpg): TesteDaMarca | null {
  const achado = /teste de ([a-z]+)(?:[^0-9]{0,12}?\bcd\s*(\d{1,3}))?/.exec(normal)
  const palavra = achado?.[1]
  if (achado === null || palavra === undefined) return null
  const atributo = sistema.atributos.find((candidato) => normalizar(candidato.nome) === palavra || normalizar(candidato.abreviacao) === palavra)
  if (atributo === undefined) return null
  const cd = achado[2] === undefined ? null : Number.parseInt(achado[2], 10)
  return { atributoId: atributo.id, nome: atributo.nome, cd }
}

/** "Gastar 40 de SP", "40 SP". */
function spDoTexto(normal: string): number | null {
  const numero = /(\d{1,6}) ?(?:de )?sp\b/.exec(normal)?.[1]
  return numero === undefined ? null : Number.parseInt(numero, 10)
}

/** O texto em que a ficha fala da marca: campos e extras. */
function textoDoCartao(cartao: Pick<CartaoDaFicha, 'campos' | 'extras'>): string {
  return normalizar([...Object.values(cartao.campos), ...cartao.extras.flatMap((extra) => [extra.nome, extra.valor])].join(' \n '))
}

/** O que o cartão faz com a marca; `null` = nada. */
export function lerMarca(cartao: Pick<CartaoDaFicha, 'campos' | 'extras'>, sistema: SistemaDeRpg): LeituraDaMarca | null {
  const passiva = lerTipo(cartao).tipo === 'passiva'
  const explicito = extraDaMarca(cartao)
  if (explicito !== null) {
    const normal = normalizar(explicito)
    if (!passiva) return { tipo: 'aoAcertar' }
    const teste = testeDoTexto(normal, sistema)
    const sp = spDoTexto(normal)
    return teste === null && sp === null ? null : { tipo: 'passiva', sp, teste }
  }
  const texto = textoDoCartao(cartao)
  if (!/\bmarca\b/.test(texto)) return null
  if (!passiva) return { tipo: 'aoAcertar' }
  const custo = normalizar(cartao.campos[CAMPO_DO_CUSTO] ?? '')
  const teste = testeDoTexto(custo, sistema) ?? testeDoTexto(texto, sistema)
  const sp = spDoTexto(custo)
  return teste === null && sp === null ? null : { tipo: 'passiva', sp, teste }
}

/** A passiva de marca do personagem (a primeira das técnicas que valem agora), ou `null`. */
export function passivaDaMarca(personagem: Personagem, sistema: SistemaDeRpg): { cartao: CartaoDaFicha; leitura: Extract<LeituraDaMarca, { tipo: 'passiva' }> } | null {
  for (const cartao of tecnicasDe(personagem, sistema)) {
    const leitura = lerMarca(cartao, sistema)
    if (leitura?.tipo === 'passiva') return { cartao, leitura }
  }
  return null
}

/** A marca na ficha, ou `undefined`. */
export function marcaDoToken(selos: readonly SeloDaBatalha[] | undefined, tokenId: string): SeloDaBatalha | undefined {
  return (selos ?? []).find((selo) => selo.tokenId === tokenId && selo.marca === true)
}

/** Regra do usuário (01/11): +1 no teste a cada 2 ranks do atributo, arredondando para baixo (R1 = 0, R2-R3 = +1, R4-R5 = +2). */
const RANKS_POR_PONTO = 2

/**
 * O modificador do teste: metade do RANK do atributo, para baixo
 * (`RANKS_POR_PONTO`), com o que os selos somam no atributo. Atributo sem
 * tabela de rank = 0 (somar o valor inteiro passaria sempre). A tela deixa
 * trocar o número na mão (`PedidoDeMarca.modificador`).
 */
export function modificadorDoTeste(personagem: Personagem, sistema: SistemaDeRpg, atributoId: string, bonus?: BonusDaBatalha): number {
  const atributo = sistema.atributos.find((candidato) => candidato.id === atributoId)
  if (atributo === undefined) return 0
  // F2 (fatia A): com o Cego, a Percepção lida é 0 (`valorComAsPartes`), venha o buff antes ou depois dele.
  const rank = rankDoValor(atributo.rank, valorComAsPartes(valorDoRank(personagem, atributoId), partesDoBonus(bonus, atributoId))) ?? 0
  return Math.floor(rank / RANKS_POR_PONTO)
}

/**
 * Rework das habilidades (PLANO.md D10, a peça Marca e a marca da forma): como a marca nova nasce e
 * como o golpe nela a usa. `soDe` = o personagem que aproveita (`SeloDaBatalha.marcaDe`; `null` =
 * qualquer um); `vezes` = o multiplicador do dano; `some` = sai no golpe que a aproveita.
 */
export interface MoldeDaMarca {
  nome: string
  turnos: number | null
  vezes: number
  soDe: string | null
  some: boolean
}

/** D10: o molde da marca da peça (da técnica ou da forma), para o dono `donoPersonagemId`. */
export function moldeDaMarca(marca: MarcaAMao, donoPersonagemId: string | null): MoldeDaMarca {
  return { nome: marca.selo.nome, turnos: marca.selo.turnos, vezes: marca.vezes, soDe: marca.soDoDono ? donoPersonagemId : null, some: marca.some }
}

/**
 * A marca nova no alvo: "Marcado", sem turnos, debuff. `linhaId` = a linha que a pôs (o Desfazer de quem a usou só a devolve com ela de pé).
 * D10: com `molde`, o nome, os turnos, quem aproveita, as vezes e se fica vêm da peça.
 */
export function criarMarca(turnos: TurnosDaCena, alvoTokenId: string, ids: { selo: string; linha: string }, origem: Pick<CartaoDaFicha, 'id' | 'nome'>, molde?: MoldeDaMarca): SeloDaBatalha {
  const selo = criarSelo(alvoTokenId, { nome: molde?.nome ?? NOME_DA_MARCA, turnos: molde?.turnos ?? null, natureza: 'debuff', cartaoId: origem.id }, { id: ids.selo, rodada: turnos.rodada, ...ondeNaVez(turnos), origem: origem.nome })
  const nova: SeloDaBatalha = { ...selo, marca: true, linhaDaMarca: ids.linha }
  if (molde === undefined) return nova
  if (molde.soDe !== null) nova.marcaDe = molde.soDe
  if (molde.vezes !== MULTIPLICADOR_DA_MARCA) nova.marcaVezes = molde.vezes
  if (!molde.some) nova.marcaFica = true
  return nova
}

/** O que precisa para o acerto achar a passiva de quem atacou. */
export interface ContextoDoAcerto {
  /** A linha do golpe (a marca da técnica e o lembrete nascem dela). */
  linhaId: string
  novoId: () => string
  /** A passiva de marca de quem atacou; `null` = não tem. */
  passiva: Pick<CartaoDaFicha, 'id'> | null
  /** A técnica do golpe, quando ela marca ao acertar (o id e o nome que vão no selo). */
  tecnicaQueMarca: Pick<CartaoDaFicha, 'id' | 'nome'> | null
  /** D10: o molde da marca da técnica (a peça Marca); ausente = a do R1 ("Marcado", sem turnos, o dobro, qualquer um aproveita). */
  moldeDaTecnica?: MoldeDaMarca
  /** D10: a forma ligada de quem atacou que deixa a marca a cada acerto (a Transformação com marca); ausente = nenhuma. */
  formaQueMarca?: { origem: Pick<CartaoDaFicha, 'id' | 'nome'>; molde: MoldeDaMarca }
}

/** O alvo depois do acerto, os turnos novos e as partes da reversão. Nada a fazer = os MESMOS objetos e nenhuma parte. */
export interface AcertoNaMarca {
  alvo: AlvoDoGolpe
  turnos: TurnosDaCena
  partes: Reversao[]
}

/**
 * O alvo resolvido passou pela marca: se o golpe ACERTOU (`pegaOSelo`) e tem
 * dano, a marca dele dobra o dano final e some; a técnica que marca põe a
 * marca nova (sem custo nem teste); a passiva de quem atirou com arma que
 * atira deixa o lembrete. Alvo que já tem marca (ou acabou de usar a dele e
 * ganhou outra) não ganha lembrete.
 */
export function acertoNaMarca(turnos: TurnosDaCena, golpe: GolpeDaBatalha, alvo: AlvoDoGolpe, ctx: ContextoDoAcerto): AcertoNaMarca {
  const nada: AcertoNaMarca = { alvo, turnos, partes: [] }
  if (alvo.saida === undefined || alvo.danoFinal === undefined || !pegaOSelo(alvo.saida)) return nada
  let novoAlvo = alvo
  let novos = turnos
  const partes: Reversao[] = []
  const marca = marcaDoToken(turnos.selos, alvo.tokenId)
  // D10: a marca "só do dono" vale só no golpe dele (a dos outros passa sem dobrar nem sair).
  const vale = marca !== undefined && (marca.marcaDe === undefined || marca.marcaDe === golpe.atacantePersonagemId)
  if (marca !== undefined && vale && alvo.dano !== null) {
    const vezes = marca.marcaVezes ?? MULTIPLICADOR_DA_MARCA
    // O registro diz o multiplicador certo ("marca ×3"): `marcaVezes` só quando não é o ×2 de sempre.
    novoAlvo = { ...alvo, danoFinal: Math.min(DANO_MAX, alvo.danoFinal * vezes), marcado: true, ...(vezes === MULTIPLICADOR_DA_MARCA ? {} : { marcaVezes: vezes }) }
    // D10: a marca que fica (não "some") continua até acabar os turnos.
    if (marca.marcaFica !== true) {
      novos = { ...novos, selos: (novos.selos ?? []).filter((selo) => selo.id !== marca.id) }
      partes.push({ tipo: 'marcaUsada', selo: marca })
    }
  }
  const jaMarcado = marcaDoToken(novos.selos, alvo.tokenId) !== undefined
  // D10: a técnica que marca vence; sem ela, a forma ligada de quem atacou deixa a marca a cada acerto.
  const quemMarca = ctx.tecnicaQueMarca !== null ? { origem: ctx.tecnicaQueMarca, molde: ctx.moldeDaTecnica } : ctx.formaQueMarca === undefined ? null : ctx.formaQueMarca
  if (quemMarca !== null && !jaMarcado) {
    const nova = criarMarca(novos, alvo.tokenId, { selo: ctx.novoId(), linha: ctx.linhaId }, quemMarca.origem, quemMarca.molde)
    const selos = comSeloNovo(novos.selos, nova)
    if (selos !== null) {
      novos = { ...novos, selos }
      partes.push({ tipo: 'selo', seloId: nova.id, antes: null })
    }
  } else if (quemMarca === null && ctx.passiva !== null && golpe.armaQueAtira === true && !jaMarcado && alvo.tokenId !== golpe.atacanteTokenId && golpe.atacantePersonagemId !== null) {
    const lembrete: LembreteDaMarca = {
      id: ctx.novoId(),
      linhaId: ctx.linhaId,
      golpeId: golpe.id,
      cartaoId: ctx.passiva.id,
      tokenId: golpe.atacanteTokenId,
      personagemId: golpe.atacantePersonagemId,
      alvoTokenId: alvo.tokenId,
      rodada: turnos.rodada,
    }
    novos = { ...novos, lembretesDaMarca: [...(novos.lembretesDaMarca ?? []), lembrete].slice(-LEMBRETES_DA_MARCA_MAX) }
    partes.push({ tipo: 'lembreteDaMarca', lembrete })
  }
  // D10: a marca que fica multiplica sem parte nenhuma a desfazer (o dano vem no alvo novo).
  return partes.length === 0 && novoAlvo === alvo ? nada : { alvo: novoAlvo, turnos: novos, partes }
}

/** O golpe com o alvo trocado (mesmo lugar). */
export function golpeComOAlvo(golpe: GolpeDaBatalha, alvo: AlvoDoGolpe): GolpeDaBatalha {
  if (!golpe.alvos.some((candidato) => candidato.tokenId === alvo.tokenId)) return golpe
  return { ...golpe, alvos: golpe.alvos.map((candidato) => (candidato.tokenId === alvo.tokenId ? alvo : candidato)) }
}

/** Como a pessoa responde ao lembrete da marca. "teste" = o host rola; "passou"/"falhou" = rolou fora. */
export type ComoMarca = 'sp' | 'teste' | 'passou' | 'falhou' | 'agoraNao'

/** As respostas, para o enum fechado do fio. */
export const COMO_MARCA: readonly ComoMarca[] = ['sp', 'teste', 'passou', 'falhou', 'agoraNao']

/** Por que a resposta não vale, ou `null`. `sp` = o SP de agora de quem marca. */
export function motivoDaMarca(leitura: Extract<LeituraDaMarca, { tipo: 'passiva' }>, como: ComoMarca, sp: number): string | null {
  if (como === 'sp') {
    if (leitura.sp === null) return 'A passiva não diz quanto de SP'
    if (sp < leitura.sp) return `SP insuficiente: custa ${leitura.sp}, você tem ${sp}`
  }
  if (como === 'teste' && (leitura.teste === null || leitura.teste.cd === null)) return 'A passiva não diz a CD do teste'
  if ((como === 'passou' || como === 'falhou') && leitura.teste === null) return 'A passiva não pede teste'
  return null
}
