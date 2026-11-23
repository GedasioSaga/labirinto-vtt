import { comARodadaSemUso, comGastoNoAcumulador, combateNoComecoDaBatalha, comOEventoNosAcumuladores, nivelDoAcumulador, valorDoGanho, type EventoDoAcumulador } from '../../../lib/batalha/acumuladorNaBatalha'
import { combateVazio, type CombateDoPersonagem } from '../../../lib/batalha/combate'
import { lerContador, type LeituraDoContador } from '../../../lib/batalha/contador'
import { normalizar } from '../../../lib/batalha/formula'
import { ABA_DAS_TECNICAS } from '../../../lib/batalha/leituraDaFicha'
import { mesmaReferencia } from '../../../lib/batalha/requisitos/contexto'
import { acumuladorParaGuardar, comoJson, lerAcumulador, mesmaMarca } from '../../../lib/batalha/requisitos/ler'
import {
  ID_DO_REQUISITO_MAX,
  NOME_DO_ACUMULADOR_MAX,
  REGRAS_DO_ACUMULADOR_MAX,
  VERSAO_DO_ACUMULADOR,
  type AcumuladorDaFicha,
  type ObjetoJson,
  type Referencia,
  type SubidaDoAcumulador,
  type ValorJson,
} from '../../../lib/batalha/requisitos/modelo'
import { cartoesDaAba, novoCartao, type CartaoDaFicha, type Personagem } from '../../../lib/personagem'

/**
 * OS ACUMULADORES DA FICHA NO EDITOR (ED6; EDITOR.md §8, protótipo dos requisitos, tela 8). A
 * definição mora num cartão (`CartaoDaFicha.acumulador`, decisão da B2) e é lida por `lerAcumulador`;
 * aqui ficam a lista da ficha, o que o editor grava e o "Testar", que roda as funções do motor
 * (`acumuladorNaBatalha.ts`) num combate de mentira.
 *
 * O contador de antes (a Polaridade do Vagn, lida do texto ou dos extras por `lerContador`) aparece
 * como acumulador convertido em memória: abrir não grava nada; a primeira mudança do mestre grava o
 * bloco novo no mesmo cartão, e o texto e os extras ficam como estão (o app de antes segue lendo).
 *
 * Puro: sem React, sem store.
 */

/** De onde veio: o bloco gravado no cartão, ou o contador de antes lido do texto (ainda não gravado). */
export type OrigemDoAcumulador = 'bloco' | 'texto'

export interface AcumuladorNaFicha {
  acumulador: AcumuladorDaFicha
  /** O cartão onde a definição mora (ou de onde o contador de antes foi lido). */
  cartaoId: string
  cartaoNome: string
  origem: OrigemDoAcumulador
  /** Parte é de um app mais novo: o editor só mostra (gravar apagaria o que ele não entende). */
  deAppNovo: boolean
  avisos: readonly string[]
}

/** A descrição do cartão que o "+ Acumulador" cria: é por ela que o Apagar sabe que pode levar o cartão junto. */
export const DESCRICAO_DO_CARTAO_DO_ACUMULADOR = 'Acumulador da ficha: as regras ficam em «Acumuladores», no topo da aba Habilidades (só o mestre edita).'
/** O nível máximo de partida de um acumulador novo (a Polaridade e a Fúria do protótipo ficam entre 3 e 5). */
const MAXIMO_DE_PARTIDA = 3
/** O nome de partida do acumulador novo ("Cargas", "Cargas 2"…), como no protótipo. */
const NOME_DE_PARTIDA = 'Cargas'
/** Quantas linhas o registro do Testar guarda. */
const LINHAS_DO_TESTE = 6
/** A parte do nome que vai no id (`acu_<nome>`), curta para caber no teto do id com o número. */
const NOME_NO_ID_MAX = 20

/** Todos os cartões da ficha, das abas e dos subcartões, na ordem da ficha. */
function todosOsCartoes(personagem: Pick<Personagem, 'abas'>): CartaoDaFicha[] {
  const todos: CartaoDaFicha[] = []
  const juntar = (cartao: CartaoDaFicha): void => {
    todos.push(cartao)
    cartao.subcartoes.forEach(juntar)
  }
  for (const cartoes of Object.values(personagem.abas)) cartoes.forEach(juntar)
  return todos
}

/** O id de um acumulador novo: `acu_` + o nome sem acento; repetido ganha `_2`, `_3`. */
export function idParaOAcumulador(nome: string, usados: readonly string[]): string {
  const pedaco = normalizar(nome)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, NOME_NO_ID_MAX)
  const base = `acu_${pedaco === '' ? 'medidor' : pedaco}`
  let id = base
  for (let numero = 2; usados.includes(id); numero++) id = `${base}_${numero}`
  return id.slice(0, ID_DO_REQUISITO_MAX)
}

/**
 * O contador de antes como acumulador (modelo.ts §"O ACUMULADOR"): gastar a reação sobe 1, zera no fim
 * da batalha, cada nível dá o dano lido ("10" = +10 por nível; "10, 25, 40" = um valor por nível).
 */
export function acumuladorDoContador(leitura: LeituraDoContador, id: string): AcumuladorDaFicha {
  const danos = leitura.danoPorNivel
  const primeiro = danos[0] ?? 0
  const porNivel = primeiro > 0 && danos.every((dano, indice) => dano === primeiro * (indice + 1))
  return {
    v: VERSAO_DO_ACUMULADOR,
    id,
    nome: leitura.nome.slice(0, NOME_DO_ACUMULADOR_MAX),
    maximo: danos.length,
    sobe: [{ quando: 'gastaReacao', quanto: 1 }],
    desce: [{ quando: 'fimDaBatalha' }],
    ganho: porNivel ? { ganho: 'dano', cada: primeiro } : { ganho: 'dano', niveis: [...danos] },
  }
}

/** O primeiro cartão de técnica sem bloco que o leitor do contador de antes reconhece (o mesmo que a batalha de hoje acha). */
function contadorDeAntes(personagem: Pick<Personagem, 'abas'>): { cartao: CartaoDaFicha; leitura: LeituraDoContador } | null {
  const tecnicas: CartaoDaFicha[] = []
  const juntar = (cartao: CartaoDaFicha): void => {
    tecnicas.push(cartao)
    cartao.subcartoes.forEach(juntar)
  }
  for (const cartao of personagem.abas[ABA_DAS_TECNICAS] ?? []) juntar(cartao)
  for (const cartao of tecnicas) {
    if (cartao.acumulador !== undefined) continue
    const leitura = lerContador(cartao)
    if (leitura !== null) return { cartao, leitura }
  }
  return null
}

/**
 * Os acumuladores da ficha: os blocos dos cartões (um por id, o primeiro vale) e, no fim, o contador
 * de antes convertido (se nenhum bloco tem o mesmo nome).
 */
export function acumuladoresNaFicha(personagem: Pick<Personagem, 'abas'>): AcumuladorNaFicha[] {
  const achados: AcumuladorNaFicha[] = []
  for (const cartao of todosOsCartoes(personagem)) {
    if (cartao.acumulador === undefined) continue
    const lido = lerAcumulador(cartao.acumulador)
    const acumulador = lido.acumulador
    if (acumulador === null || achados.some((outro) => outro.acumulador.id === acumulador.id)) continue
    achados.push({ acumulador, cartaoId: cartao.id, cartaoNome: cartao.nome, origem: 'bloco', deAppNovo: lido.deAppNovo, avisos: lido.avisos })
  }
  const antes = contadorDeAntes(personagem)
  if (antes !== null && !achados.some((outro) => mesmaMarca(outro.acumulador.nome, antes.leitura.nome))) {
    const id = idParaOAcumulador(antes.leitura.nome, achados.map((outro) => outro.acumulador.id))
    achados.push({ acumulador: acumuladorDoContador(antes.leitura, id), cartaoId: antes.cartao.id, cartaoNome: antes.cartao.nome, origem: 'texto', deAppNovo: false, avisos: [] })
  }
  return achados
}

/** A ficha com o cartão `cartaoId` trocado (em qualquer aba ou subcartão); `null` tira o cartão. Não achou = a MESMA ficha. */
function comOCartao(personagem: Personagem, cartaoId: string, mudar: (cartao: CartaoDaFicha) => CartaoDaFicha | null): Personagem {
  let achou = false
  const naLista = (cartoes: readonly CartaoDaFicha[]): CartaoDaFicha[] =>
    cartoes.flatMap((cartao) => {
      if (cartao.id === cartaoId) {
        achou = true
        const novo = mudar(cartao)
        return novo === null ? [] : [novo]
      }
      if (cartao.subcartoes.length === 0) return [cartao]
      const subcartoes = naLista(cartao.subcartoes)
      return [subcartoes.some((sub, indice) => sub !== cartao.subcartoes[indice]) || subcartoes.length !== cartao.subcartoes.length ? { ...cartao, subcartoes } : cartao]
    })
  const abas = Object.fromEntries(Object.entries(personagem.abas).map(([aba, cartoes]) => [aba, naLista(cartoes)]))
  return achou ? { ...personagem, abas } : personagem
}

/** A regra "zera no fim da batalha" sempre vai junto: a batalha nova começa do zero (o nível mora no combate). */
function comOFimDaBatalha(acumulador: AcumuladorDaFicha): AcumuladorDaFicha {
  if (acumulador.desce.some((regra) => regra.quando === 'fimDaBatalha')) return acumulador
  return { ...acumulador, desce: [{ quando: 'fimDaBatalha' }, ...acumulador.desce] }
}

/** O cartão foi criado pelo "+ Acumulador" e não ganhou mais nada: o Apagar leva o cartão junto. */
function cartaoSoDoAcumulador(cartao: CartaoDaFicha): boolean {
  const camposComTexto = Object.entries(cartao.campos).filter(([, valor]) => valor.trim() !== '')
  return (
    cartao.mecanica === undefined &&
    cartao.requisitos === undefined &&
    cartao.subcartoes.length === 0 &&
    cartao.extras.length === 0 &&
    camposComTexto.every(([campo, valor]) => (campo === 'descricao' && valor === DESCRICAO_DO_CARTAO_DO_ACUMULADOR) || (campo === 'tipo' && valor === 'Passiva'))
  )
}

/** A referência A4 casa com o acumulador: pelo id; sem id, pelo nome que ele tinha. */
function referenciaCasa(ref: ValorJson | undefined, acumuladorId: string, nome: string): boolean {
  if (ref === null || ref === undefined || typeof ref !== 'object' || Array.isArray(ref)) return false
  if (typeof ref.id === 'string') return ref.id === acumuladorId
  return typeof ref.nome === 'string' && mesmaMarca(ref.nome, nome)
}

/** O JSON com toda peça A4 (`tipo: 'contador'`) que aponta o acumulador trocada por `mudar`, em qualquer profundidade. */
function comAsPecasDoContador(valor: ValorJson, casa: (ref: ValorJson | undefined) => boolean, mudar: (peca: ObjetoJson) => ObjetoJson): ValorJson {
  if (Array.isArray(valor)) return valor.map((item) => comAsPecasDoContador(item, casa, mudar))
  if (valor === null || typeof valor !== 'object') return valor
  const filhos: ObjetoJson = Object.fromEntries(Object.entries(valor).map(([chave, item]) => [chave, comAsPecasDoContador(item, casa, mudar)]))
  return filhos.tipo === 'contador' && casa(filhos.acumulador) ? mudar(filhos) : filhos
}

/** Trocar o nome no editor: todo requisito A4 da ficha que aponta o acumulador passa a dizer o nome novo (e o id). */
function comONomeNosRequisitos(personagem: Personagem, acumulador: Pick<AcumuladorDaFicha, 'id' | 'nome'>, nomeAntigo: string): Personagem {
  let mudou = false
  const casa = (ref: ValorJson | undefined) => referenciaCasa(ref, acumulador.id, nomeAntigo)
  const trocar = (cartao: CartaoDaFicha): CartaoDaFicha => {
    const subcartoes = cartao.subcartoes.map(trocar)
    const subMudou = subcartoes.some((sub, indice) => sub !== cartao.subcartoes[indice])
    if (cartao.requisitos === undefined) return subMudou ? { ...cartao, subcartoes } : cartao
    const antes = comoJson(cartao.requisitos)
    const depois = comAsPecasDoContador(antes, casa, (peca) => ({ ...peca, acumulador: { id: acumulador.id, nome: acumulador.nome } }))
    const blocoMudou = JSON.stringify(antes) !== JSON.stringify(depois)
    if (!blocoMudou && !subMudou) return cartao
    mudou = true
    return { ...cartao, subcartoes, ...(blocoMudou && depois !== null && typeof depois === 'object' && !Array.isArray(depois) ? { requisitos: depois } : {}) }
  }
  const abas = Object.fromEntries(Object.entries(personagem.abas).map(([aba, cartoes]) => [aba, cartoes.map(trocar)]))
  return mudou ? { ...personagem, abas } : personagem
}

/**
 * A ficha com a definição gravada no cartão dela (o contador de antes vira bloco aqui, na primeira
 * mudança do mestre). Nome trocado: os requisitos A4 acompanham, e o cartão criado só para o
 * acumulador troca de nome junto.
 */
export function comOAcumuladorGravado(personagem: Personagem, item: AcumuladorNaFicha, acumulador: AcumuladorDaFicha): Personagem {
  const definicao = comOFimDaBatalha(acumulador)
  const nomeAntigo = item.acumulador.nome
  let ficha = comOCartao(personagem, item.cartaoId, (cartao) => {
    const renomear = definicao.nome !== nomeAntigo && cartao.nome === nomeAntigo && cartaoSoDoAcumulador(cartao)
    return { ...cartao, ...(renomear ? { nome: definicao.nome } : {}), acumulador: acumuladorParaGuardar(definicao) }
  })
  if (definicao.nome !== nomeAntigo) ficha = comONomeNosRequisitos(ficha, definicao, nomeAntigo)
  return ficha
}

/** O nome livre para um acumulador novo na ficha ("Cargas", "Cargas 2"…). */
function nomeLivre(personagem: Pick<Personagem, 'abas'>): string {
  const nomes = acumuladoresNaFicha(personagem).map((item) => item.acumulador.nome)
  let nome = NOME_DE_PARTIDA
  for (let numero = 2; nomes.some((outro) => mesmaMarca(outro, nome)); numero++) nome = `${NOME_DE_PARTIDA} ${numero}`
  return nome
}

/**
 * "+ Acumulador": um cartão novo na aba Habilidades (Passiva, com o nome do acumulador) que guarda a
 * definição. Começa até o nível 3, sem regra de subir e sem ganho (só conta).
 */
export function comAcumuladorNovo(personagem: Personagem): { personagem: Personagem; id: string } {
  const nome = nomeLivre(personagem)
  const id = idParaOAcumulador(nome, acumuladoresNaFicha(personagem).map((item) => item.acumulador.id))
  const acumulador: AcumuladorDaFicha = { v: VERSAO_DO_ACUMULADOR, id, nome, maximo: MAXIMO_DE_PARTIDA, sobe: [], desce: [{ quando: 'fimDaBatalha' }], ganho: { ganho: 'nada' } }
  const cartao: CartaoDaFicha = { ...novoCartao(nome), campos: { tipo: 'Passiva', descricao: DESCRICAO_DO_CARTAO_DO_ACUMULADOR }, acumulador: acumuladorParaGuardar(acumulador) }
  return { personagem: { ...personagem, abas: { ...personagem.abas, [ABA_DAS_TECNICAS]: [...cartoesDaAba(personagem, ABA_DAS_TECNICAS), cartao] } }, id }
}

/**
 * Apagar: a definição sai do cartão (o cartão criado só para ela sai junto). Os requisitos A4 que o
 * apontavam ficam como estão: a frase passa a dizer "(não achada na ficha)".
 */
export function semOAcumulador(personagem: Personagem, item: AcumuladorNaFicha): Personagem {
  if (item.origem !== 'bloco') return personagem
  return comOCartao(personagem, item.cartaoId, (cartao) => {
    if (cartaoSoDoAcumulador(cartao)) return null
    const { acumulador: _fora, ...resto } = cartao
    return resto
  })
}

/** Quanto a técnica soma ao ser usada (a regra "usar a técnica X"); `null` = não soma. */
export function somaDaTecnica(acumulador: AcumuladorDaFicha, tecnica: Referencia): number | null {
  for (const regra of acumulador.sobe) if (regra.quando === 'usaTecnica' && mesmaReferencia(regra.tecnica, tecnica)) return regra.quanto
  return null
}

/** Fase ED4: quando a técnica soma: ao usar, ou só se o golpe dela acertar. */
export type QuandoSomaATecnica = 'aoUsar' | 'seAcertar'

/** Quando a regra "usar a técnica X" soma; sem a regra = 'aoUsar' (a escolha de partida). */
export function quandoSomaATecnica(acumulador: AcumuladorDaFicha, tecnica: Referencia): QuandoSomaATecnica {
  for (const regra of acumulador.sobe) if (regra.quando === 'usaTecnica' && mesmaReferencia(regra.tecnica, tecnica)) return regra.seAcertar === true ? 'seAcertar' : 'aoUsar'
  return 'aoUsar'
}

/**
 * O acumulador com a técnica somando `quanto` ao ser usada (`null` = não soma mais). A regra fica no
 * acumulador ("usar a técnica X"), que é o que o motor de hoje roda. Sem espaço para mais uma regra =
 * `null` (o editor avisa).
 */
export function comSomaDaTecnica(acumulador: AcumuladorDaFicha, tecnica: Referencia, quanto: number | null, quando: QuandoSomaATecnica = quandoSomaATecnica(acumulador, tecnica)): AcumuladorDaFicha | null {
  const outras = acumulador.sobe.filter((regra) => !(regra.quando === 'usaTecnica' && mesmaReferencia(regra.tecnica, tecnica)))
  if (quanto === null) return { ...acumulador, sobe: outras }
  if (outras.length >= REGRAS_DO_ACUMULADOR_MAX) return null
  const tecnicaGuardada: Referencia = tecnica.id === undefined ? { nome: tecnica.nome } : { id: tecnica.id, nome: tecnica.nome }
  const indice = acumulador.sobe.findIndex((regra) => regra.quando === 'usaTecnica' && mesmaReferencia(regra.tecnica, tecnica))
  const nova: SubidaDoAcumulador = quando === 'seAcertar' ? { quando: 'usaTecnica', tecnica: tecnicaGuardada, quanto, seAcertar: true } : { quando: 'usaTecnica', tecnica: tecnicaGuardada, quanto }
  if (indice < 0) return { ...acumulador, sobe: [...outras, nova] }
  return { ...acumulador, sobe: acumulador.sobe.map((regra, atual) => (atual === indice ? nova : regra)) }
}

/** Uma técnica (ou ação) que mexe no acumulador, para a seção "Técnicas que usam". */
export interface UsoDoAcumulador {
  chave: string
  tecnica: string
  oQue: string
  nota: string
}

/** As peças A4 do bloco cru que apontam o acumulador, com "está no evoluir". */
function pecasA4(valor: ValorJson, casa: (ref: ValorJson | undefined) => boolean, noEvoluir: boolean, achadas: { peca: ObjetoJson; noEvoluir: boolean }[]): void {
  if (Array.isArray(valor)) {
    for (const item of valor) pecasA4(item, casa, noEvoluir, achadas)
    return
  }
  if (valor === null || typeof valor !== 'object') return
  if (valor.tipo === 'contador' && casa(valor.acumulador)) achadas.push({ peca: valor, noEvoluir })
  for (const [chave, item] of Object.entries(valor)) pecasA4(item, casa, noEvoluir || chave === 'evoluir', achadas)
}

/** O que soma (as regras "gastar a reação" e "usar a técnica X") e o que pede ou gasta (os requisitos A4 da ficha). */
export function usosDoAcumulador(personagem: Pick<Personagem, 'abas'>, acumulador: AcumuladorDaFicha): UsoDoAcumulador[] {
  const usos: UsoDoAcumulador[] = []
  acumulador.sobe.forEach((regra, indice) => {
    if (regra.quando === 'gastaReacao') usos.push({ chave: `sobe-${indice}`, tecnica: `Carregar ${acumulador.nome}`, oQue: `soma +${regra.quanto} e gasta a reação`, nota: 'ação do menu da batalha, nasce desta regra' })
    if (regra.quando === 'usaTecnica') usos.push({ chave: `sobe-${indice}`, tecnica: regra.tecnica.nome, oQue: `soma +${regra.quanto} ${regra.seAcertar === true ? 'se acertar' : 'ao usar'}`, nota: 'regra "usar uma técnica" deste acumulador' })
  })
  const casa = (ref: ValorJson | undefined) => referenciaCasa(ref, acumulador.id, acumulador.nome)
  for (const cartao of todosOsCartoes(personagem)) {
    if (cartao.requisitos === undefined) continue
    const achadas: { peca: ObjetoJson; noEvoluir: boolean }[] = []
    pecasA4(comoJson(cartao.requisitos), casa, false, achadas)
    achadas.forEach(({ peca, noEvoluir }, indice) => {
      const nivel = typeof peca.nivel === 'number' ? peca.nivel : 0
      const oQue = peca.nao === true ? `pede menos de ${nivel}` : `pede ${nivel}${peca.gasta === true ? ` e gasta ${nivel}` : ''}`
      usos.push({ chave: `${cartao.id}-${indice}`, tecnica: cartao.nome.trim() || 'Técnica sem nome', oQue, nota: noEvoluir ? 'nos Requisitos para evoluir (A4)' : 'nos Requisitos (A4)' })
    })
  }
  return usos
}

/* ------------------------------------------------------------------------- o Testar ---------- */

/** Um passo do Testar: um acontecimento da batalha, uma técnica que gasta, a virada da rodada ou o fim. */
export type EventoDoTeste =
  | { tipo: 'evento'; evento: EventoDoAcumulador; rotulo: string }
  | { tipo: 'gasta'; rotulo: string }
  | { tipo: 'rodada'; rotulo: string }
  | { tipo: 'fim'; rotulo: string }

export interface EstadoDoTeste {
  combate: CombateDoPersonagem
  rodada: number
  /** O mais novo primeiro: "Recebeu dano: Fúria 0 → 1." */
  registro: readonly string[]
}

/** Fase ED4: o Testar começa como a batalha, com o nível de começo do acumulador. */
export function testeNovo(acumulador?: Pick<AcumuladorDaFicha, 'id' | 'maximo' | 'inicial'>): EstadoDoTeste {
  return { combate: acumulador === undefined ? combateVazio() : combateNoComecoDaBatalha(combateVazio(), [acumulador]), rodada: 1, registro: [] }
}

const ROTULO_DO_EVENTO: Readonly<Record<Exclude<EventoDoAcumulador['quando'], 'usaTecnica' | 'acertaComTecnica' | 'gastaSp'>, string>> = {
  gastaReacao: 'Gastou a reação',
  acerta: 'Acertou um golpe',
  apanha: 'Recebeu dano',
  comecoDaVez: 'Começou a vez',
  derruba: 'Derrubou alguém',
  esquiva: 'Esquivou',
}

/** Os botões do Testar: um por regra de subir, o "Recebeu dano" se ele faz cair, e sempre gastar, nova rodada e fim. */
export function eventosDoTeste(acumulador: AcumuladorDaFicha): EventoDoTeste[] {
  const eventos: EventoDoTeste[] = []
  const tem = (rotulo: string) => eventos.some((evento) => evento.rotulo === rotulo)
  for (const regra of acumulador.sobe) {
    if (regra.quando === 'naoLida') continue
    const evento: EventoDoTeste =
      regra.quando === 'usaTecnica'
        ? regra.seAcertar === true
          ? { tipo: 'evento', evento: { quando: 'acertaComTecnica', tecnica: regra.tecnica }, rotulo: `Acertou com ${regra.tecnica.nome}` }
          : { tipo: 'evento', evento: { quando: 'usaTecnica', tecnica: regra.tecnica }, rotulo: `Usou ${regra.tecnica.nome}` }
        : regra.quando === 'gastaSp'
          ? { tipo: 'evento', evento: { quando: 'gastaSp', sp: regra.cada }, rotulo: `Gastou ${regra.cada} SP` }
          : { tipo: 'evento', evento: { quando: regra.quando }, rotulo: ROTULO_DO_EVENTO[regra.quando] }
    if (!tem(evento.rotulo)) eventos.push(evento)
  }
  if (acumulador.desce.some((regra) => regra.quando === 'apanha') && !tem(ROTULO_DO_EVENTO.apanha)) eventos.push({ tipo: 'evento', evento: { quando: 'apanha' }, rotulo: ROTULO_DO_EVENTO.apanha })
  eventos.push({ tipo: 'gasta', rotulo: 'Uma técnica gasta 1' }, { tipo: 'rodada', rotulo: 'Nova rodada' }, { tipo: 'fim', rotulo: 'Fim da batalha' })
  return eventos
}

/** O passo pelo motor de verdade (as mesmas funções da batalha), com a linha do registro. */
export function passoDoTeste(acumulador: AcumuladorDaFicha, estado: EstadoDoTeste, evento: EventoDoTeste): EstadoDoTeste {
  const definicoes = [acumulador]
  const antes = nivelDoAcumulador(estado.combate, acumulador.id)
  let combate = estado.combate
  let rodada = estado.rodada
  if (evento.tipo === 'evento') combate = comOEventoNosAcumuladores(combate, definicoes, evento.evento, rodada)
  else if (evento.tipo === 'gasta') combate = comGastoNoAcumulador(combate, definicoes, { id: acumulador.id, nome: acumulador.nome }, 1, rodada)
  else if (evento.tipo === 'rodada') {
    combate = comARodadaSemUso(combate, definicoes, rodada)
    rodada += 1
  } else combate = combateNoComecoDaBatalha(combateVazio(), definicoes)
  const depois = nivelDoAcumulador(combate, acumulador.id)
  const linha = depois === antes ? `${evento.rotulo}: ${acumulador.nome} fica em ${depois}.` : `${evento.rotulo}: ${acumulador.nome} ${antes} → ${depois}.`
  return { combate, rodada: evento.tipo === 'fim' ? 1 : rodada, registro: [linha, ...estado.registro].slice(0, LINHAS_DO_TESTE) }
}

/** O que o nível dá, em palavras curtas ("+20 de dano", "+10 de Força"); nada = `null`. */
export function ganhoNoNivel(acumulador: AcumuladorDaFicha, nivel: number): string | null {
  const { ganho } = acumulador
  if (ganho.ganho === 'nada' || ganho.ganho === 'naoLido') return null
  const valor = valorDoGanho(ganho, nivel)
  return `+${valor} ${ganho.ganho === 'dano' ? 'de dano' : `de ${ganho.atributo.nome}`}`
}
