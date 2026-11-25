import type { CarriedItem, Token } from '../../types/map'
import type { Ajuste } from '../ajusteDaFicha'
import { aplicarAjustes } from '../ajusteDaFicha'
import { ajustesDoRecursoDaCura, curaPelaParteDoMaximo, notaDoRecursoDaCura, quantoCabeNoRecurso } from '../batalha/curaDoRecurso'
import { lerDano } from '../batalha/formula'
import { textoDaSobra, sobraDoUso, vagaParaUsar, type VagaComEfeito } from '../batalha/itemNaBatalha'
import type { Efeito, MecanicaV2, NumeroSimples } from '../batalha/mecanica/modelo'
import { lerMecanicaParaOMotor } from '../batalha/mecanica/golpe'
import { MODELOS_DE_ITEM, modeloSugeridoParaOItem } from '../batalha/mecanica/modelosDeItem'
import { ajustesDaCura, curaQueCabe, notaDaCura } from '../batalha/reacao'
import { bonusDaBatalha } from '../batalha/selos'
import { chaveDaCondicao } from '../condicaoPorNome'
import { condicoesPropriasOf } from '../condicoesProprias'
import type { Personagem } from '../personagem'
import { tirarCondicaoDaFicha } from '../prazoDaCondicao'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { TOKEN_CONDITION_LABELS, tokenConditionsOf } from '../tokenConditions'
import { recursoDeVida, vidaDoPersonagem } from '../vidaDaFicha'
import { tirarDaMochilaDaFicha } from './darNaFicha'

/**
 * "USAR" FORA DA BATALHA (SISTEMA.md §5.2, Fase 8): o botão da vaga da mochila
 * aplica a cura (HP, SP), tira condição e levanta o caído, e gasta 1. Só o que
 * não pede alvo inimigo, área, teste nem dano: a granada fora da batalha é o
 * "Dar dano" do mestre (decisão C19). O efeito sai das peças da cópia de quem
 * resolve (a mesa do mestre, ou o host para o jogador); o jogador manda só o
 * id da vaga e o alvo.
 *
 * DECISÕES DO CLAUDE (22/11/2026), não do mestre:
 *  - O alcance (o "toque" a 1 casa) não vale fora da batalha: o alvo é a
 *    própria ficha ou uma ficha de jogador na mesma cena, sem medir casa.
 *  - O selo (Vigor, Cego...) e o dreno só existem na batalha: o item que tem
 *    um deles não se usa fora.
 *  - "Tirar os negativos" fora da batalha tira as condições da ficha no mapa,
 *    menos Invisível (a única de fábrica que não é ruim).
 *
 * Puro: sem store, sem rede.
 */

/** A ficha que recebe: o personagem e o token dele na cena (as condições moram no token). */
export interface FichaQueRecebe {
  personagem: Personagem
  token: Token | null
}

/** O uso resolvido: as fichas novas e a frase do que aconteceu. Nada daqui grava. */
export interface UsoForaResolvido {
  vaga: VagaComEfeito
  /** Quem usou, já sem 1 da vaga (e com a cura em si, quando o alvo é ele mesmo ou o efeito é em quem usa). */
  quemUsa: Personagem
  /** O alvo curado; `null` = o alvo é quem usa (já em `quemUsa`). */
  alvo: Personagem | null
  /** O token do alvo sem as condições tiradas; `null` = nada a tirar. */
  tokenDoAlvo: Token | null
  /** "curou 100", "tirou Envenenado", "levantou com 50 de vida". */
  nota: string
  /** Quantos sobram na vaga; `undefined` = não acaba. */
  sobra: number | undefined
}

const CONDICAO_QUE_NAO_E_RUIM = 'invisivel'

/** Em quem o "Usar" pode cair: quem usa primeiro, depois cada ficha de jogador com token na cena (uma vez cada). */
export function fichasQueRecebem(quemUsa: Personagem, tokensDaCena: readonly Token[], personagens: readonly Personagem[]): FichaQueRecebe[] {
  const tokenDe = (personagemId: string): Token | null => tokensDaCena.find((token) => token.characterId === personagemId) ?? null
  const colegas = personagens.filter((personagem) => personagem.id !== quemUsa.id && personagem.tipo === 'jogador' && tokenDe(personagem.id) !== null)
  return [{ personagem: quemUsa, token: tokenDe(quemUsa.id) }, ...colegas.map((personagem) => ({ personagem, token: tokenDe(personagem.id) }))]
}

/** Por que a vaga não se usa fora da batalha, ou `null` (serve). Sem olhar o alvo: é o que acende ou apaga o botão. */
export function motivoDeNaoUsarFora(vaga: CarriedItem): string | null {
  const achada = vagaParaUsar([vaga], vaga.id, false)
  if (typeof achada === 'string') return achada
  const mecanica = mecanicaDa(achada.vaga)
  if (mecanica === null) return 'O efeito do item tem uma peça torta: abra o item no Acervo'
  return motivoDasPecas(achada.vaga.nome.trim() || 'O item', mecanica)
}

/**
 * Levantamento das mecânicas duplicadas, Nº 9 (a fonte é o efeito do item): o consumível SEM efeito não se usa
 * mais por palpite pelo nome (antes gastava 1 e só tirava o Envenenado: a "Poção — Cura 2d6" não curava). O
 * "Usar" fica apagado e diz o modelo que o "Sugerir efeito" do Acervo propõe; sem modelo parecido, o mestre
 * narra o uso. `null` = o item tem efeito (o motivo é o de `motivoDeNaoUsarFora`).
 */
export function motivoDoItemSemEfeito(vaga: CarriedItem): string | null {
  if (vaga.efeito !== undefined) return null
  const sugerido = modeloSugeridoParaOItem(vaga.nome, vaga.descricao ?? '')
  const modelo = sugerido === null ? undefined : MODELOS_DE_ITEM.find((candidato) => candidato.id === sugerido)
  return modelo === undefined ? 'Sem efeito no Acervo: narre o uso' : `Sem efeito no Acervo: o "Sugerir efeito" de lá propõe ${modelo.nome}; até lá, narre o uso`
}

/** O item só vale em quem usa (`alvo.quem: 'si'`)? Então não há alvo a escolher. */
export function soEmQuemUsa(vaga: CarriedItem): boolean {
  const mecanica = vaga.efeito === undefined ? null : mecanicaDa({ ...vaga, efeito: vaga.efeito })
  return mecanica?.alvo.quem === 'si'
}

/** As peças que o uso executa (fase ED1: com o tipo do golpe já montado, como no motor da batalha). */
function mecanicaDa(vaga: VagaComEfeito): MecanicaV2 | null {
  const lida = lerMecanicaParaOMotor(vaga.efeito.mecanica)
  return lida.tipo === 'pecas' ? lida.mecanica : null
}

function motivoDasPecas(nome: string, mecanica: MecanicaV2): string | null {
  const soNaBatalha = `${nome} se usa só na batalha`
  if (mecanica.alvo.quem === 'inimigos' || mecanica.alvo.quem === 'todos') return `${soNaBatalha} (pede alvo inimigo)`
  if (mecanica.alvo.forma.tipo !== 'um') return `${soNaBatalha} (é de área)`
  if (mecanica.teste.tipo !== 'naoErra') return `${soNaBatalha} (pede teste)`
  if (mecanica.dano !== undefined) return `${soNaBatalha} (dá dano)`
  if (mecanica.efeitos.some((efeito) => efeito.tipo === 'selo' || efeito.tipo === 'dreno' || (efeito.tipo === 'cura' && efeito.recurso === 'escudo'))) return `${soNaBatalha} (o efeito dura na batalha)`
  if (!mecanica.efeitos.some((efeito) => efeito.tipo === 'cura' || efeito.tipo === 'tirarSelos' || efeito.tipo === 'reviver' || efeito.tipo === 'aMao')) return `${nome} não faz nada fora da batalha`
  return null
}

/** O número da peça, lido da ficha de quem usa (a fórmula "50 + Espírito"); torto ou sem número = 0. */
function valorDe(numero: NumeroSimples, quemUsa: Personagem, sistema: SistemaDeRpg): number {
  if ('fixo' in numero) return Math.max(0, Math.floor(numero.fixo))
  const lido = lerDano(numero.formula, { personagem: quemUsa, sistema, arma: null, vidaDoAlvo: null, bonusDaBatalha: bonusDaBatalha(undefined, '') })
  return lido.tipo === 'valor' ? Math.max(0, Math.floor(lido.valor)) : 0
}

/** Quanto a cura dá: o número, a 1ª carga (fora não há Concentração) ou a parte do máximo do alvo. */
function quantoDaCura(quanto: Extract<Efeito, { tipo: 'cura' }>['quanto'], recurso: 'hp' | 'sp', recebe: Personagem, quemUsa: Personagem, sistema: SistemaDeRpg): number {
  if ('porcento' in quanto) return curaPelaParteDoMaximo(recebe, sistema, recurso, quanto.porcento)
  if ('porCarga' in quanto) return valorDe(quanto.porCarga[0], quemUsa, sistema)
  return valorDe(quanto, quemUsa, sistema)
}

/** A cura de um recurso na ficha: os ajustes e a nota ("curou 100", "recuperou 30 de SP"). */
function curar(recebe: Personagem, sistema: SistemaDeRpg, recurso: 'hp' | 'sp', cura: number): { ajustes: Ajuste[]; nota: string } {
  if (recurso === 'hp') return { ajustes: ajustesDaCura(recebe, sistema, cura), nota: notaDaCura(cura, curaQueCabe(recebe, sistema, cura)) }
  return { ajustes: ajustesDoRecursoDaCura(recebe, sistema, 'sp', cura), nota: notaDoRecursoDaCura('sp', cura, quantoCabeNoRecurso(recebe, sistema, 'sp', cura)) }
}

/** Os nomes das condições da ficha que a peça tira. */
function condicoesQueSaem(token: Token, quais: Extract<Efeito, { tipo: 'tirarSelos' }>['quais']): string[] {
  const deFabrica = tokenConditionsOf(token).map((condicao) => ({ id: condicao, nome: TOKEN_CONDITION_LABELS[condicao] }))
  const proprias = condicoesPropriasOf(token).map((propria) => ({ id: '', nome: propria.nome }))
  const todas = [...deFabrica, ...proprias]
  if (typeof quais === 'object') {
    const pedidas = new Set(quais.nomes.map(chaveDaCondicao))
    return todas.filter((condicao) => pedidas.has(chaveDaCondicao(condicao.nome))).map((condicao) => condicao.nome)
  }
  if (quais === 'positivos') return todas.filter((condicao) => condicao.id === CONDICAO_QUE_NAO_E_RUIM).map((condicao) => condicao.nome)
  if (quais === 'negativos') return todas.filter((condicao) => condicao.id !== CONDICAO_QUE_NAO_E_RUIM).map((condicao) => condicao.nome)
  return todas.map((condicao) => condicao.nome)
}

/**
 * Resolve o "Usar" da vaga `vagaId` da mochila de `quemUsa` em `alvo` (a
 * própria ficha, se o id for o mesmo). Recusa com o motivo: vaga que não é
 * de quem usa, item que não se usa fora, reviver em quem não caiu, nada a
 * fazer no alvo. `quando` é a hora do histórico da ficha.
 */
export function resolverUsoFora(quemUsa: Personagem, vagaId: string, alvo: FichaQueRecebe, sistema: SistemaDeRpg, quem: string, quando: number): UsoForaResolvido | string {
  // Segurança (aceite 3 da Fase 8): a vaga só vale na mochila da ficha de quem usa.
  const achada = vagaParaUsar(quemUsa.mochila, vagaId, false)
  if (typeof achada === 'string') return achada
  const { vaga } = achada
  const nome = vaga.nome.trim() || 'O item'
  const mecanica = mecanicaDa(vaga)
  if (mecanica === null) return 'O efeito do item tem uma peça torta: abra o item no Acervo'
  const motivo = motivoDasPecas(nome, mecanica)
  if (motivo !== null) return motivo
  const emSi = alvo.personagem.id === quemUsa.id
  if (mecanica.alvo.quem === 'si' && !emSi) return `${nome} vale só em quem usa`
  const vida = recursoDeVida(sistema)
  const vidaDoAlvo = vida === null ? null : vidaDoPersonagem(emSi ? quemUsa : alvo.personagem, vida)
  const caido = vidaDoAlvo !== null && vidaDoAlvo.atual <= 0
  const reviver = mecanica.alvo.estado === 'caido'
  if (reviver && !caido) return `${alvo.personagem.nome} não está caído (0 de vida)`
  if (!reviver && caido) return `${alvo.personagem.nome} está caído: só item de reviver levanta`
  // Quem usa já sem 1 da vaga; a cura entra por cima (o alvo pode ser ele mesmo).
  let usou = vaga.efeito.gasta === 'um' ? tirarDaMochilaDaFicha(quemUsa, vaga.id, 1) : quemUsa
  let recebe = emSi ? usou : alvo.personagem
  let token = alvo.token
  const notas: string[] = []
  for (const efeito of mecanica.efeitos) {
    if (efeito.tipo === 'cura' && efeito.recurso !== 'escudo') {
      const emQuemUsa = efeito.em === 'quemUsa'
      const ficha = emQuemUsa ? usou : recebe
      const cura = quantoDaCura(efeito.quanto, efeito.recurso, ficha, quemUsa, sistema)
      if (cura <= 0) continue
      const feita = curar(ficha, sistema, efeito.recurso, cura)
      const curada = aplicarAjustes(ficha, sistema, feita.ajustes, quem, quando)
      if (emQuemUsa || emSi) usou = curada
      if (!emQuemUsa) recebe = emSi ? usou : curada
      notas.push(emQuemUsa && !emSi ? `${feita.nota} em quem usou` : feita.nota)
    } else if (efeito.tipo === 'tirarSelos') {
      const saem = token === null ? [] : condicoesQueSaem(token, efeito.quais)
      for (const condicao of saem) if (token !== null) token = tirarCondicaoDaFicha(token, condicao)
      notas.push(saem.length === 0 ? 'não tinha condição a tirar' : `tirou ${saem.join(', ')}`)
    } else if (efeito.tipo === 'reviver' && vidaDoAlvo !== null) {
      const volta = Math.max(1, 'porcento' in efeito.volta ? Math.floor((vidaDoAlvo.maximo * efeito.volta.porcento) / 100) : valorDe(efeito.volta, quemUsa, sistema))
      const levantado = aplicarAjustes(recebe, sistema, ajustesDaCura(recebe, sistema, volta), quem, quando)
      recebe = levantado
      if (emSi) usou = levantado
      notas.push(`levantou com ${Math.min(volta, vidaDoAlvo.maximo)} de vida`)
    } else if (efeito.tipo === 'aMao') {
      notas.push(efeito.texto.trim())
    }
  }
  const nota = notas.filter((parte) => parte !== '').join(', ')
  return { vaga, quemUsa: usou, alvo: emSi ? null : recebe, tokenDoAlvo: token === alvo.token ? null : token, nota: nota === '' ? 'nada mudou' : nota, sobra: sobraDoUso(vaga) }
}

/** O aviso do chat: "Lia usou Poção Grande em Bruno: curou 100 · item da mochila: sobra 1". */
export function textoDoUsoFora(quemUsa: string, item: string, alvo: string | null, uso: Pick<UsoForaResolvido, 'nota' | 'sobra'>): string {
  const emQuem = alvo === null ? '' : ` em ${alvo}`
  return `${quemUsa} usou ${item}${emQuem}: ${uso.nota}${uso.sobra === undefined ? '' : textoDaSobra(uso.sobra)}`
}
