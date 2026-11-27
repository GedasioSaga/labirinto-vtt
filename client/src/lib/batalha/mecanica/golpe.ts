import { MODS_POR_SELO_MAX, NOME_DO_SELO_MAX } from '../combate'
import { normalizar } from '../formula'
import { lerMecanica, TESTE_DO_TIPO_DE_PARTIDA, type GolpeDaMecanica, type MecanicaLida, type MecanicaV2, type TipoComRegra, type TipoDoGolpe } from './modelo'
import { atributoNoMotor, nomeDoAtributoDaPeca, pecasDo, type ItemDoStatus, type PecaStatus } from './pecas'

/**
 * O TIPO DO GOLPE VIRA PEÇAS (fase ED1 do editor novo; docs/design/habilidades/EDITOR.md §3.2).
 * A mecânica guarda a ESCOLHA (`golpe`: "Impacto com teste", "Veneno 3 vezes"); o motor lê as
 * peças de sempre, montadas aqui, só na leitura. A expansão nunca vai ao disco: quem grava lê
 * a mecânica por `lerMecanica` (a escolha), e o motor por `lerMecanicaParaOMotor`.
 *
 * Envenenado, Congelado e Eletrizado são selos montados com peças que já existem; a tabela de
 * selos por nome (`condicoes.ts`) não muda, e um "Envenenado" posto à mão continua sem regra.
 *
 * Puro: sem store, sem rede.
 */

/** O nome do tipo na tela e nas frases. */
export const NOME_DO_TIPO: Readonly<Record<TipoDoGolpe, string>> = {
  impacto: 'Impacto',
  cortante: 'Cortante',
  perfurante: 'Perfurante',
  queimadura: 'Queimadura',
  veneno: 'Veneno',
  congelamento: 'Congelamento',
  choque: 'Choque',
  cegueira: 'Cegueira',
  enfraquecer: 'Enfraquecer',
  outro: 'Outro',
}

/** "Golpe de fogo": o que o "só o tipo" dá ao golpe (o Outro usa o nome da condição). */
export const ADJETIVO_DO_TIPO: Readonly<Record<Exclude<TipoDoGolpe, 'outro'>, string>> = {
  impacto: 'de impacto',
  cortante: 'cortante',
  perfurante: 'perfurante',
  queimadura: 'de fogo',
  veneno: 'venenoso',
  congelamento: 'de gelo',
  choque: 'elétrico',
  cegueira: 'que cega',
  enfraquecer: 'que enfraquece',
}

/** A condição que cada tipo põe no alvo acertado (o Outro usa o nome escolhido; o Perfurante não põe). */
export const CONDICAO_DO_TIPO: Readonly<Record<Exclude<TipoDoGolpe, 'perfurante' | 'outro'>, string>> = {
  impacto: 'Atordoado',
  cortante: 'Sangrando',
  queimadura: 'Queimando',
  veneno: 'Envenenado',
  congelamento: 'Congelado',
  choque: 'Eletrizado',
  cegueira: 'Cego',
  enfraquecer: 'Enfraquecido',
}

/** O Veneno: a cura que o envenenado recebe cai pela metade (`regra.curaRecebida`). */
const CURA_RECEBIDA_NO_VENENO = -50
/** O atributo que o Enfraquecer baixa (id do sistema; o Dano é o `dano` dos números do selo). */
export const ATRIBUTO_DO_ENFRAQUECER = 'forca'
/** A versão das peças montadas: a 4 (o teste do selo e o "reage com desvantagem" só existem nela, fase ED4). */
const VERSAO_DAS_PECAS_MONTADAS = 4

/** Uma peça como o disco a guardaria, antes da leitura conferir. */
type PecaCrua = Readonly<Record<string, unknown>>

/** O tipo que põe condição (todos menos o Perfurante). */
type TipoComCondicao = TipoComRegra<Exclude<TipoDoGolpe, 'perfurante'>>

/** "Empurra 2 casas (o mestre move a ficha)." */
export function fraseDoEmpurrao(casas: number): string {
  return `Empurra ${casas} ${casas === 1 ? 'casa' : 'casas'} (o mestre move a ficha).`
}

/** O nome da condição que o tipo põe. */
export function condicaoDoTipo(escolha: TipoComCondicao): string {
  return escolha.tipo === 'outro' ? escolha.regra.nome : CONDICAO_DO_TIPO[escolha.tipo]
}

/** O "tira N por vez" do selo (o HP pelo lembrete Aplicar, o SP no fim da vez); 0 = sem a peça. */
function porTurno(recurso: 'hp' | 'sp', porVez: number): PecaCrua {
  return porVez > 0 ? { porTurno: { recurso, quanto: { fixo: porVez }, direto: true } } : {}
}

/** O que o selo de cada tipo traz além do nome e da duração (EDITOR.md §3.2). */
function pecasDaCondicao(escolha: TipoComCondicao): PecaCrua {
  switch (escolha.tipo) {
    case 'impacto':
    case 'cegueira':
      return {}
    case 'cortante':
    case 'queimadura':
    case 'outro':
      return porTurno('hp', escolha.regra.porVez)
    case 'veneno':
      return { ...porTurno('hp', escolha.regra.porVez), regra: { curaRecebida: CURA_RECEBIDA_NO_VENENO } }
    case 'congelamento':
      return { regra: { reageComDesvantagem: true }, alcance: { mexe: 'soma', n: -escolha.regra.casas, vale: 'tudo' } }
    case 'choque':
      return porTurno('sp', escolha.regra.porVez)
    case 'enfraquecer': {
      const mods = [
        ...(escolha.regra.forca > 0 ? [{ alvo: ATRIBUTO_DO_ENFRAQUECER, delta: { fixo: -escolha.regra.forca } }] : []),
        ...(escolha.regra.dano > 0 ? [{ alvo: 'dano', delta: { fixo: -escolha.regra.dano } }] : []),
      ]
      return mods.length === 0 ? {} : { mods }
    }
  }
}

/** O selo do tipo, pronto para a leitura; `null` = "só o tipo" (só dá o nome ao golpe). O "com teste" leva a peça `pega`. */
function seloDoTipo(escolha: TipoComCondicao): PecaCrua | null {
  const { regra } = escolha
  if (regra.quando === 'soTipo') return null
  // A leitura sempre traz o teste no "com teste"; a escolha montada na tela sem ele usa o de partida (nunca vira "sempre").
  const pega = regra.quando === 'teste' ? { pega: regra.teste ?? TESTE_DO_TIPO_DE_PARTIDA } : {}
  return { tipo: 'selo', nome: condicaoDoTipo(escolha), duracao: regra.vezes, natureza: 'debuff', ...pecasDaCondicao(escolha), ...pega }
}

/** O nome do selo para comparar (sem acento nem caixa, como a tabela dos selos). */
function nomeParaComparar(nome: string): string {
  return normalizar(nome).trim()
}

/**
 * Os selos do tipo que entram: o que tem o mesmo nome de um selo já posto nos Efeitos (no alvo), ou
 * de outro tipo antes dele, não entra duas vezes.
 */
function selosDoTipoQueEntram(mecanica: MecanicaV2, tipos: readonly TipoComCondicao[]): PecaCrua[] {
  const vistos = new Set(mecanica.efeitos.flatMap((efeito) => (efeito.tipo === 'selo' && efeito.em === undefined ? [nomeParaComparar(efeito.nome)] : [])))
  return tipos.flatMap((escolha) => {
    const selo = seloDoTipo(escolha)
    const nome = nomeParaComparar(condicaoDoTipo(escolha))
    if (selo === null || vistos.has(nome)) return []
    vistos.add(nome)
    return [selo]
  })
}

/** Os tipos que põem condição, na ordem da tela (como bate, depois o que causa). */
function tiposComCondicao(golpe: GolpeDaMecanica): TipoComCondicao[] {
  const { bate, causa = [] } = golpe
  return [...(bate === undefined || bate.tipo === 'perfurante' ? [] : [bate]), ...causa]
}

export type MecanicaParaOMotor = Extract<MecanicaLida, { tipo: 'pecas' | 'invalida' }>

/** O nome do selo do "Muda atributo" sem o nome do cartão. */
const NOME_DO_SELO_DO_STATUS = 'Muda atributo'

/** O sinal dos números do "Muda atributo": tudo para cima = buff, tudo para baixo = debuff, misturado = sem natureza. */
function naturezaDosItens(itens: readonly ItemDoStatus[]): PecaCrua {
  const numeros = itens.map((item) => (item.modo === 'fixo' ? item.valor : item.porcento))
  if (numeros.every((numero) => numero > 0)) return { natureza: 'buff' }
  return numeros.every((numero) => numero < 0) ? { natureza: 'debuff' } : {}
}

/**
 * Versão 5 (PLANO.md D3): o "Muda atributo" vira os selos dos Efeitos, um por duração (até
 * `MODS_POR_SELO_MAX` atributos cada): por N turnos = `duracao: N`; até o fim da batalha =
 * `ateTirar`; "para sempre" = lembrete ao mestre (grava na ficha, à mão). No dono = `em: 'quemUsa'`,
 * a não ser que a técnica já mire em quem usa (aí o selo vai no alvo, que é ele, e cabe mais de um).
 */
function pecasDoStatus(peca: PecaStatus, nome: string, alvoEhQuemUsa: boolean): PecaCrua[] {
  const grupos = new Map<number | 'ateTirar', ItemDoStatus[]>()
  const paraSempre: string[] = []
  for (const item of peca.itens) {
    if (item.dura === 'permanente') {
      paraSempre.push(`${nomeDoAtributoDaPeca(item.atributo)} ${item.modo === 'fixo' ? `${item.valor > 0 ? '+' : ''}${item.valor}` : `${item.porcento > 0 ? '+' : ''}${item.porcento}% da ${nomeDoAtributoDaPeca(item.de)}`}`)
      continue
    }
    const duracao = item.dura === 'batalha' ? 'ateTirar' : item.turnos
    grupos.set(duracao, [...(grupos.get(duracao) ?? []), item])
  }
  const em = peca.quem === 'si' && !alvoEhQuemUsa ? { em: 'quemUsa' } : {}
  const selos = [...grupos].flatMap(([duracao, itens]) => {
    const pedacos: ItemDoStatus[][] = []
    for (let i = 0; i < itens.length; i += MODS_POR_SELO_MAX) pedacos.push(itens.slice(i, i + MODS_POR_SELO_MAX))
    return pedacos.map((pedaco): PecaCrua => {
      const mods = pedaco.map((item) => ({ alvo: atributoNoMotor(item.atributo), delta: item.modo === 'fixo' ? { fixo: item.valor } : { formula: `${nomeDoAtributoDaPeca(item.de)} * ${item.porcento} / 100` } }))
      return { tipo: 'selo', nome, duracao, ...naturezaDosItens(pedaco), ...em, mods }
    })
  })
  const lembrete = paraSempre.length === 0 ? [] : [{ tipo: 'aMao', texto: `Para sempre (o mestre grava na ficha): ${paraSempre.join(', ')}.` }]
  return [...selos, ...lembrete]
}

/**
 * As peças que o motor executa, com o tipo do golpe já montado (EDITOR.md §3.2): o selo de cada
 * tipo (fora o "só o tipo") antes dos Efeitos, o Perfurante no dano e o empurrão do Impacto como
 * lembrete ao mestre. Versão 5: o "Muda atributo" vira os selos dos Efeitos (`pecasDoStatus`) e sai
 * de `pecas`; `nome` (o do cartão) dá o nome do selo. Sem tipo nem "Muda atributo" = a MESMA
 * mecânica (o mesmo objeto: as versões 1 a 3 não mudam).
 *
 * As peças montadas passam pela mesma leitura das peças do disco: o motor nunca recebe o que não
 * receberia de um arquivo. O que ela recusa (o teto de 3 selos) volta como `invalida` com o motivo,
 * e o cartão fica à mão. Desde a ED4 o "com teste" (`pega`) e o Congelado rodam.
 */
export function pecasParaOMotor(mecanica: MecanicaV2, nome?: string): MecanicaParaOMotor {
  const { golpe, pecas, ...semGolpe } = mecanica
  const status = pecasDo(pecas, 'status')
  if (golpe === undefined && status.length === 0) return { tipo: 'pecas', mecanica }
  const selos = golpe === undefined ? [] : selosDoTipoQueEntram(mecanica, tiposComCondicao(golpe))
  const empurra = golpe?.bate?.tipo === 'impacto' && golpe.bate.regra.casas > 0 ? [{ tipo: 'aMao', texto: fraseDoEmpurrao(golpe.bate.regra.casas) }] : []
  const perfura = golpe?.bate?.tipo === 'perfurante' ? golpe.bate.regra.porcento : null
  if (perfura !== null && mecanica.dano === undefined) return { tipo: 'invalida', motivo: 'o golpe perfurante precisa de dano' }
  const dano = mecanica.dano === undefined || perfura === null ? {} : { dano: { ...mecanica.dano, perfurante: true, ...(perfura < 100 ? { perfuracao: perfura } : {}) } }
  const nomeDoSelo = (nome ?? '').trim().slice(0, NOME_DO_SELO_MAX).trim() || NOME_DO_SELO_DO_STATUS
  const doStatus = status.flatMap((peca) => pecasDoStatus(peca, nomeDoSelo, mecanica.alvo.quem === 'si'))
  const outras = (pecas ?? []).filter((peca) => peca.tipo !== 'status')
  const crua: PecaCrua = {
    ...semGolpe,
    versao: Math.max(VERSAO_DAS_PECAS_MONTADAS, mecanica.versao),
    ...dano,
    efeitos: [...selos, ...mecanica.efeitos, ...doStatus, ...empurra],
    ...(outras.length === 0 ? {} : { pecas: outras }),
  }
  const relida = lerMecanica(crua)
  if (relida.tipo === 'pecas') return { tipo: 'pecas', mecanica: { ...relida.mecanica, versao: mecanica.versao } }
  return relida.tipo === 'invalida' ? relida : { tipo: 'invalida', motivo: 'o tipo do golpe não virou peças' }
}

/**
 * `lerMecanica` para o motor: a escolha lida e, com peças válidas, montada (`pecasParaOMotor`).
 * `nome` = o nome do cartão (o do selo do "Muda atributo").
 */
export function lerMecanicaParaOMotor(valor: unknown, nome?: string): MecanicaLida {
  const lida = lerMecanica(valor)
  return lida.tipo === 'pecas' ? pecasParaOMotor(lida.mecanica, nome) : lida
}
