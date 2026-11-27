import { ajustesQueContam, BONECO_BASE, type AjustesDoBoneco, type AtributoNaRodada, type LinhaDoBoneco, type MotorDoBoneco, type ResultadoDoBoneco, type RodadaDoBoneco, type TipoDaLinhaDoBoneco } from '../../components/condicoes/editor/registro'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from '../../stores/batalhaFabrica'
import type { CondicaoPropria } from '../../types/map'
import { comAjustes, valorDoRank, type Ajuste } from '../ajusteDaFicha'
import { partesDoBonus, valorComAsPartes, type SeloDaBatalha } from '../batalha/combate'
import { curaComOsSelos, selosQueSaemCom, selosQueSaemNoGolpe } from '../batalha/condicoes'
import { ehLembreteDaSaida } from '../batalha/condicoesNaVez'
import { recursoDoEscudo } from '../batalha/leituraDaFicha'
import type { MesaDaBatalha } from '../batalha/mesa'
import type { LinhaDoRegistro, TipoDaLinha } from '../batalha/registro'
import { ajustesDaCura, ajustesDoDano } from '../batalha/reacao'
import { bonusDaBatalha } from '../batalha/selos'
import { cartaDaVez, combatentesIniciais, type AutorDaAcao } from '../batalha/turnos'
import { novoPersonagem, numeroDaFicha, type Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { SISTEMA_ONE_PIECE } from '../sistemaOnePiece'
import { aplicarSangramentos } from '../treino/duelo'
import { criarMesaEmMemoria, montarLutadores } from '../treino/mesaEmMemoria'
import { recursoDeVida } from '../vidaDaFicha'
import { fichaDoBoneco } from '../arena/boneco'
import { BONECO_PADRAO } from '../arena/tipos'
import { condicaoDoCatalogoPeloNome } from './catalogo'
import { condicaoDaFabrica, ehDaFabrica } from './fabrica'
import type { ContextoDasFrases, FraseDaCondicao } from './frasesDaCondicao'
import { TURNOS_PADRAO_DA_CONDICAO, type CondicaoMontada, type PecaDaCondicaoDa } from './modelo'
import { alvoNoMotor } from './traducao'

/**
 * O MOTOR DO BONECO (rework das condições, PLANO.md D12, E5): a condição do editor jogada de verdade, pela
 * store da batalha numa mesa em memória (molde: `lib/batalha/ensaio/ensaio.ts`). O boneco (`BONECO_BASE`) e
 * um outro, parado, fecham os dois lados; a condição entra fora da vez do boneco (o 1º desconto do prazo cai
 * no fim da rodada 1) e cada rodada é a vez dele: o começo (Efeito na vez, "Tentar sair"), o "Aplicar" da
 * vida tirada no começo (como a Arena, `aplicarSangramentos`), o que os ajustes mandam naquela rodada (golpe,
 * cura, ele bater, a mesma condição de novo, tentar sair) e o fim (Efeito na vez, gatilho, teste, prazo).
 * O d20 de todo teste é o dos ajustes. A `simular()` do protótipo é só a resposta esperada.
 *
 * Os números vêm da ficha e dos selos (nunca de uma conta à parte): a vida, o SP e o Escudo são os da ficha
 * do boneco; cada atributo é o da ficha com os mods dos selos no alvo do motor (`alvoNoMotor`: a Velocidade
 * é a Agilidade, D10). Por isso a ficha do boneco usa na Agilidade a Velocidade do protótipo quando a
 * condição mexe só na Velocidade.
 *
 * Fora daqui (ainda não roda no boneco): o golpe não passa pelo % de dano recebido nem pela marca (é o
 * caminho da reação, que pede um atacante com técnica), e o golpe dele não passa pelo % de dano causado;
 * a Aura (D9) não tem aliado na mesa do boneco.
 *
 * API pública: `ensaiarCondicao`.
 */

const CENA_DO_BONECO = 'boneco-da-condicao'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }
const ID_DO_BONECO = 'boneco-da-condicao'
const ID_DO_OUTRO = 'boneco-da-condicao-outro'
const NOME_DO_BONECO = 'Boneco'
const RECURSO_DO_SP = 'sp'
/** O que o boneco bate quando os ajustes mandam (o protótipo: "O boneco bate com 30"). */
const GOLPE_DO_BONECO = 30
const RODADAS_MIN = 2
const RODADAS_MAX = 5
/** O nome da condição sem nome no rascunho (o selo precisa de um). */
const NOME_SEM_NOME = 'Condição em teste'
const COR_DO_BONECO = '#888888'
/** A de fábrica que empresta a cor e o desenho à criada do boneco. */
const ID_DO_MOLDE = 'envenenado'
const SIMBOLO_SEM_MOLDE = 'skull'
/** O nome do rascunho que perde para outra do catálogo pelo nome (a de fábrica de antes vence, D5) ganha isto no boneco. */
const SUFIXO_DO_RASCUNHO = ' (rascunho)'
/** Os tipos de linha do registro que são da ordem e da mesa, não da condição: o boneco não mostra. */
const LINHAS_DA_MESA: ReadonlySet<TipoDaLinha> = new Set<TipoDaLinha>(['vez', 'ordem', 'cartaExtra', 'combatente', 'equipe', 'regras', 'desempate'])
const NOME_DO_ALVO: Readonly<Record<string, string>> = { velocidade: 'Velocidade', ca: 'CA', dano: 'Dano', alcance: 'Alcance' }

function entre(valor: number, minimo: number, maximo: number): number {
  return Number.isFinite(valor) ? Math.min(maximo, Math.max(minimo, Math.trunc(valor))) : minimo
}

function linha(tipo: TipoDaLinhaDoBoneco, ...pedacos: FraseDaCondicao): LinhaDoBoneco {
  return { tipo, frase: pedacos }
}

/**
 * A condição do rascunho (ou do catálogo em volta) como criada da mesa. A cor e o desenho não contam no motor,
 * mas o leitor (`lerCondicaoPropria`) recusa desenho desconhecido: vêm da de fábrica dela ou da do molde.
 */
function comoCriada(condicao: CondicaoMontada, nome: string): CondicaoPropria {
  const molde = condicaoDaFabrica(condicao.id) ?? condicaoDaFabrica(ID_DO_MOLDE)
  return { id: condicao.id, nome, cor: molde?.cor ?? COR_DO_BONECO, simbolo: molde?.simbolo ?? SIMBOLO_SEM_MOLDE, tipo: condicao.tipo, pecas: condicao.pecas, prazo: condicao.prazo, saidas: condicao.saidas }
}

/** O nome de uma condição pelo id: o catálogo em volta, depois a de fábrica. */
function nomeDoId(id: string, contexto: ContextoDasFrases): string {
  return contexto.todas?.find((condicao) => condicao.id === id)?.nome ?? condicaoDaFabrica(id)?.nome ?? id
}

function nomeDoAlvo(atr: string, sistema: SistemaDeRpg): string {
  return sistema.atributos.find((atributo) => atributo.id === atr)?.nome ?? NOME_DO_ALVO[atr] ?? atr
}

/** Os atributos que as peças da condição mexem, sem repetir, na ordem delas. */
function atributosDaCondicao(condicao: CondicaoMontada): string[] {
  const ids = condicao.pecas.filter((peca): peca is PecaDaCondicaoDa<'atributo'> => peca.tipo === 'atributo').map((peca) => peca.atr)
  return [...new Set(ids)]
}

/** A ficha do boneco: vida, SP, os atributos do sistema pelos do boneco; a Agilidade é a Velocidade quando a condição só mexe nesta (D10). */
function fichaDoBonecoDaCondicao(sistema: SistemaDeRpg, condicao: CondicaoMontada): Personagem {
  const base = novoPersonagem(sistema, 'npc', NOME_DO_BONECO)
  const atrs = atributosDaCondicao(condicao)
  const agilidadeEhVelocidade = atrs.includes('velocidade') && !atrs.includes('agilidade')
  const atributos: Record<string, number> = {}
  for (const atributo of sistema.atributos) atributos[atributo.id] = BONECO_BASE.atr[atributo.id] ?? 0
  const velocidade = BONECO_BASE.atr.velocidade
  if (agilidadeEhVelocidade && velocidade !== undefined) atributos.agilidade = velocidade
  const vida = recursoDeVida(sistema)
  const escudo = recursoDoEscudo(sistema)
  const recursos: Record<string, number> = { ...base.recursos, [RECURSO_DO_SP]: BONECO_BASE.sp }
  const maximos: Record<string, number> = { ...base.maximos, [RECURSO_DO_SP]: BONECO_BASE.sp }
  if (vida !== null) {
    recursos[vida.id] = BONECO_BASE.vida
    maximos[vida.id] = BONECO_BASE.vida
  }
  if (escudo !== null) recursos[escudo.id] = 0
  return { ...base, id: ID_DO_BONECO, atributos, recursos, maximos }
}

/** A mesa do boneco montada e ligada. */
interface MesaDoBoneco {
  loja: LojaDaBatalha
  mesa: MesaDaBatalha
  sistema: SistemaDeRpg
  tokenId: string
  personagemId: string
}

/** As criadas da mesa do boneco: o rascunho primeiro (vence as do catálogo pelo nome), e as criadas em volta (os nomes do gatilho e do contra). */
function criadasDoBoneco(condicao: CondicaoMontada, nome: string, contexto: ContextoDasFrases): CondicaoPropria[] {
  const emVolta = (contexto.todas ?? []).filter((outra) => outra.id !== condicao.id && !ehDaFabrica(outra.id)).map((outra) => comoCriada(outra, outra.nome))
  return [comoCriada(condicao, nome), ...emVolta]
}

/** O nome do selo no boneco: o do rascunho, ou com o sufixo quando outra do catálogo venceria por ele. */
function nomeNoBoneco(condicao: CondicaoMontada, nome: string, contexto: ContextoDasFrases): string {
  const achada = condicaoDoCatalogoPeloNome(nome, criadasDoBoneco(condicao, nome, contexto))
  return achada === null || achada.id === condicao.id ? nome : `${nome}${SUFIXO_DO_RASCUNHO}`
}

function montarMesaDoBoneco(condicao: CondicaoMontada, nome: string, contexto: ContextoDasFrases, d20: number): MesaDoBoneco | string {
  const sistema = SISTEMA_ONE_PIECE
  // O outro lado é o Judge da Arena (vida, nenhuma técnica): sem vida, a ficha não entraria na ordem.
  const outro: Personagem = { ...fichaDoBoneco(sistema, BONECO_PADRAO, ID_DO_OUTRO), nome: 'Outro' }
  const montagem = montarLutadores([
    { ficha: fichaDoBonecoDaCondicao(sistema, condicao), lado: 'a' },
    { ficha: outro, lado: 'b' },
  ])
  if (!montagem.ok) return `A mesa do boneco não montou (${montagem.motivo}).`
  const emMemoria = criarMesaEmMemoria(sistema, montagem.lutadores)
  const criadas: readonly CondicaoPropria[] = criadasDoBoneco(condicao, nome, contexto)
  const mesa: MesaDaBatalha = { ...emMemoria, condicoesCriadas: () => criadas }
  const loja = criarBatalhaStore(mesa, { rolarD20: () => d20, outraBatalhaLigada: () => false })
  const tokens = emMemoria.tokens()
  loja.getState().ligar(CENA_DO_BONECO, {}, { combatentes: combatentesIniciais(tokens, emMemoria.personagens(), sistema, new Set(tokens.map((token) => token.id))), regras: null, desempate: 'd20' })
  const vaga = emMemoria.vagas().find((candidata) => candidata.origem === ID_DO_BONECO)
  if (vaga === undefined) return 'O boneco não entrou na mesa.'
  return { loja, mesa, sistema, tokenId: vaga.tokenId, personagemId: vaga.personagemId }
}

function cenaDe(loja: LojaDaBatalha): BatalhaDaCena | null {
  return loja.getState().cenas[CENA_DO_BONECO] ?? null
}

function fichaDe(montada: MesaDoBoneco): Personagem | null {
  return montada.mesa.personagens().find((personagem) => personagem.id === montada.personagemId) ?? null
}

function selosDoBoneco(montada: MesaDoBoneco): SeloDaBatalha[] {
  return (cenaDe(montada.loja)?.turnos.selos ?? []).filter((selo) => selo.tokenId === montada.tokenId)
}

/** O selo da condição no boneco (o `condId` congelado; o de antes, pelo nome). */
function seloDaCondicao(montada: MesaDoBoneco, condicao: CondicaoMontada, nome: string): SeloDaBatalha | null {
  return selosDoBoneco(montada).find((selo) => selo.regras?.condId === condicao.id || selo.nome === nome) ?? null
}

/** É a vez do boneco agora? */
function vezDoBoneco(montada: MesaDoBoneco): boolean {
  const turnos = cenaDe(montada.loja)?.turnos
  return turnos !== undefined && cartaDaVez(turnos)?.tokenId === montada.tokenId
}

function passarAVez(montada: MesaDoBoneco): void {
  const turnos = cenaDe(montada.loja)?.turnos
  if (turnos === undefined || turnos.vez === null) return
  montada.loja.getState().passarVez(CENA_DO_BONECO, MESTRE, { cartaId: turnos.vez, rodada: turnos.rodada })
}

function mexerNoBoneco(montada: MesaDoBoneco, ajustes: (ficha: Personagem) => readonly Ajuste[]): void {
  montada.mesa.ajustarPersonagem(montada.personagemId, (ficha) => comAjustes(ficha, montada.sistema, ajustes(ficha)))
}

function tirarOsSelos(montada: MesaDoBoneco, selos: readonly SeloDaBatalha[]): void {
  for (const selo of selos) montada.loja.getState().tirarSelo(CENA_DO_BONECO, selo.id)
}

/** O número de um atributo no motor: o da ficha (ou o do boneco, fora do sistema) com os mods dos selos no alvo dele. */
function valorNoMotor(montada: MesaDoBoneco, atr: string, comOsSelos: boolean): number {
  const alvo = alvoNoMotor(atr)
  const ficha = fichaDe(montada)
  const ehDoSistema = montada.sistema.atributos.some((atributo) => atributo.id === alvo)
  const base = ehDoSistema && ficha !== null ? valorDoRank(ficha, alvo) : (BONECO_BASE.atr[atr] ?? 0)
  if (!comOsSelos) return base
  return Math.max(0, valorComAsPartes(base, partesDoBonus(bonusDaBatalha(selosDoBoneco(montada), montada.tokenId), alvo)))
}

function atributosNaRodada(montada: MesaDoBoneco, atrs: readonly string[]): AtributoNaRodada[] {
  return atrs.map((atr) => ({ atr, v: valorNoMotor(montada, atr, true), base: valorNoMotor(montada, atr, false) }))
}

/** As linhas que a batalha escreveu de `desde` até `ate` (ausente = até agora), sem as da ordem e da mesa, com a cor pelo tipo. */
function linhasDoRegistro(montada: MesaDoBoneco, desde: number, ate?: number): LinhaDoBoneco[] {
  const registro: readonly LinhaDoRegistro[] = cenaDe(montada.loja)?.registro ?? []
  return registro
    .slice(desde, ate)
    .filter((linhaDoRegistro) => !LINHAS_DA_MESA.has(linhaDoRegistro.tipo))
    .map((linhaDoRegistro) => linha(linhaDoRegistro.tipo === 'dano' ? 'dano' : 'cond', { texto: linhaDoRegistro.texto }))
}

function tamanhoDoRegistro(montada: MesaDoBoneco): number {
  return cenaDe(montada.loja)?.registro.length ?? 0
}

function recursosDoBoneco(montada: MesaDoBoneco): { vida: number; sp: number; escudo: number } {
  const ficha = fichaDe(montada)
  const vida = recursoDeVida(montada.sistema)
  const escudo = recursoDoEscudo(montada.sistema)
  if (ficha === null) return { vida: 0, sp: 0, escudo: 0 }
  return {
    vida: vida === null ? 0 : numeroDaFicha(ficha.recursos, vida.id),
    sp: numeroDaFicha(ficha.recursos, RECURSO_DO_SP),
    escudo: escudo === null ? 0 : numeroDaFicha(ficha.recursos, escudo.id),
  }
}

/** A condição de novo no boneco: o motor decide se renova, soma pilha, bate no teto ou volta. */
function porACondicao(montada: MesaDoBoneco, condicao: CondicaoMontada, nome: string): void {
  montada.loja.getState().porSelo(CENA_DO_BONECO, montada.tokenId, { nome, turnos: condicao.prazo.modo === 'turnos' ? (condicao.prazo.n ?? TURNOS_PADRAO_DA_CONDICAO) : null })
}

/**
 * Os ajustes de uma rodada que acontecem na vez do boneco, entre o começo e o fim. Só os que contam para esta
 * condição (`ajustesQueContam`, o mesmo filtro da tela e o `relevantes` do protótipo).
 */
function noMeioDaVez(montada: MesaDoBoneco, condicao: CondicaoMontada, nome: string, ajustes: AjustesDoBoneco, rodada: number): LinhaDoBoneco[] {
  const linhas: LinhaDoBoneco[] = []
  const { tokenId } = montada
  const contam = ajustesQueContam(condicao)
  // Cada acontecimento: a linha dele e, logo depois, as que a batalha escreveu por causa dele (a saída, a pilha).
  const acontece = (fazer: () => readonly LinhaDoBoneco[]): void => {
    const antes = tamanhoDoRegistro(montada)
    const minhas = fazer()
    linhas.push(...minhas, ...linhasDoRegistro(montada, antes))
  }
  // "Tentar sair": o lembrete que o começo da vez deixou, respondido como o robô (o motor paga se puder, senão rola).
  if (contam.tenta && ajustes.tentaR > 0 && rodada >= ajustes.tentaR) {
    const combates = Object.values(cenaDe(montada.loja)?.turnos.combate ?? {})
    const lembretes = combates.flatMap((combate) => (combate.lembretes ?? []).filter((lembrete) => lembrete.tokenId === tokenId && ehLembreteDaSaida(lembrete)))
    for (const lembrete of lembretes) {
      acontece(() => {
        montada.loja.getState().passiva(CENA_DO_BONECO, MESTRE, { tipo: 'lembrete', tokenId, cartaoId: lembrete.cartaoId, aplicar: true })
        return []
      })
    }
  }
  if (contam.bate && ajustes.bateR === rodada) {
    acontece(() => {
      tirarOsSelos(montada, selosQueSaemCom(selosDoBoneco(montada), tokenId, { tipo: 'agir' }))
      return [linha('dano', { texto: 'O boneco bate com ' }, { texto: String(GOLPE_DO_BONECO), tinta: 'dano' }, { texto: '.' })]
    })
  }
  if (contam.golpe && ajustes.golpeR === rodada) acontece(() => golpeNoBoneco(montada, ajustes))
  if (contam.cura && ajustes.curaR === rodada) acontece(() => curaNoBoneco(montada, ajustes))
  if (contam.deNovo && ajustes.deNovoR === rodada) {
    acontece(() => {
      porACondicao(montada, condicao, nome)
      return []
    })
  }
  return linhas
}

function golpeNoBoneco(montada: MesaDoBoneco, ajustes: AjustesDoBoneco): LinhaDoBoneco[] {
  const { tokenId } = montada
  const antes = recursosDoBoneco(montada)
  mexerNoBoneco(montada, (ficha) => ajustesDoDano(ficha, montada.sistema, ajustes.golpeV, false))
  const depois = recursosDoBoneco(montada)
  const selos = selosDoBoneco(montada)
  const tipos = ajustes.golpeTipo === 'qualquer' ? [] : [ajustes.golpeTipo]
  const saem = [...selosQueSaemCom(selos, tokenId, { tipo: 'dano', tipos }), ...selosQueSaemNoGolpe(selos, [tokenId])]
  tirarOsSelos(montada, [...new Map(saem.map((selo): [string, SeloDaBatalha] => [selo.id, selo])).values()])
  const segurou = antes.escudo - depois.escudo
  return [linha('dano', { texto: `Toma um golpe de ${ajustes.golpeV}: perde ` }, { texto: `${antes.vida - depois.vida} de vida`, tinta: 'dano' }, { texto: segurou > 0 ? `, o Escudo segura ${segurou}.` : '.' })]
}

function curaNoBoneco(montada: MesaDoBoneco, ajustes: AjustesDoBoneco): LinhaDoBoneco[] {
  const { tokenId } = montada
  const cura = curaComOsSelos(ajustes.curaV, selosDoBoneco(montada), tokenId)
  const antes = recursosDoBoneco(montada)
  mexerNoBoneco(montada, (ficha) => ajustesDaCura(ficha, montada.sistema, cura))
  const ganhou = recursosDoBoneco(montada).vida - antes.vida
  tirarOsSelos(montada, selosQueSaemCom(selosDoBoneco(montada), tokenId, { tipo: 'cura' }))
  return [linha('cura', { texto: `Recebe uma cura de ${ajustes.curaV}${cura === ajustes.curaV ? '' : ` (fica ${cura})`}: ganha ` }, { texto: `${ganhou} de vida`, tinta: 'cura' }, { texto: '.' })]
}

/** As linhas dos atributos que mudaram de `antes` para `depois`. */
function linhasDosAtributos(antes: readonly AtributoNaRodada[], depois: readonly AtributoNaRodada[], sistema: SistemaDeRpg): LinhaDoBoneco[] {
  return depois.flatMap((agora, indice) => {
    const era = antes[indice]
    if (era === undefined || era.v === agora.v) return []
    return [linha('atr', { texto: `${nomeDoAlvo(agora.atr, sistema)} fica em ` }, { texto: String(agora.v), tinta: 'selo' }, { texto: '.' })]
  })
}

function umaRodada(montada: MesaDoBoneco, condicao: CondicaoMontada, nome: string, ajustes: AjustesDoBoneco, rodada: number): RodadaDoBoneco {
  const atrs = atributosDaCondicao(condicao)
  const comecou = seloDaCondicao(montada, condicao, nome) !== null
  const atributosAntes = atributosNaRodada(montada, atrs)
  const desde = tamanhoDoRegistro(montada)
  passarAVez(montada)
  // O "Aplicar" da vida tirada no começo (o sangramento), como a Arena: o mestre aplica.
  aplicarSangramentos(montada.loja, CENA_DO_BONECO)
  const desdeOMeio = tamanhoDoRegistro(montada)
  const doMeio = noMeioDaVez(montada, condicao, nome, ajustes, rodada)
  const desdeOFim = tamanhoDoRegistro(montada)
  passarAVez(montada)
  const selo = seloDaCondicao(montada, condicao, nome)
  const atributos = atributosNaRodada(montada, atrs)
  const linhas = [...linhasDoRegistro(montada, desde, desdeOMeio), ...doMeio, ...linhasDoRegistro(montada, desdeOFim), ...linhasDosAtributos(atributosAntes, atributos, montada.sistema)]
  if (comecou && selo === null) linhas.push(linha('cond', { texto: 'Sai: ' }, { texto: nome, tinta: 'selo' }, { texto: '.' }))
  if (linhas.length === 0) linhas.push(linha('nao', { texto: comecou ? 'Nada acontece nesta rodada.' : `Sem ${nome}: nada muda.` }))
  const recursos = recursosDoBoneco(montada)
  const outras = selosDoBoneco(montada).filter((outro) => outro.id !== selo?.id).map((outro) => outro.regras?.condId ?? outro.nome)
  return {
    rodada,
    ...recursos,
    ativa: selo !== null,
    comecou,
    restam: selo !== null ? selo.turnos : condicao.prazo.modo === 'turnos' ? 0 : null,
    pilhas: selo?.pilhas ?? 1,
    atributos,
    outras,
    linhas,
  }
}

/**
 * O boneco joga a condição: `ajustes.rodadas` rodadas (2 a 5), o d20 de todo teste fixo. A mesa que não monta
 * lança (a tela mostra o motivo).
 */
export const ensaiarCondicao: MotorDoBoneco = (condicao, ajustes, contexto) => {
  const nome = nomeNoBoneco(condicao, condicao.nome.trim() === '' ? NOME_SEM_NOME : condicao.nome.trim(), contexto)
  const montada = montarMesaDoBoneco(condicao, nome, contexto, entre(ajustes.d20, 1, 20))
  if (typeof montada === 'string') throw new Error(montada)
  // A condição entra fora da vez do boneco: o 1º desconto do prazo cai no fim da vez dele, na rodada 1.
  if (vezDoBoneco(montada)) passarAVez(montada)
  const atrs = atributosDaCondicao(condicao)
  const desde = tamanhoDoRegistro(montada)
  const entrada: LinhaDoBoneco[] = []
  const contra = condicao.pecas.find((peca): peca is PecaDaCondicaoDa<'contra'> => peca.tipo === 'contra')
  const jaEstava = contra?.apaga[0]
  if (ajustesQueContam(condicao).ja && ajustes.ja && jaEstava !== undefined) montada.loja.getState().porSelo(CENA_DO_BONECO, montada.tokenId, { nome: nomeDoId(jaEstava, contexto), turnos: null })
  const atributosAntes = atributosNaRodada(montada, atrs)
  porACondicao(montada, condicao, nome)
  entrada.push(...linhasDoRegistro(montada, desde), ...linhasDosAtributos(atributosAntes, atributosNaRodada(montada, atrs), montada.sistema))
  if (seloDaCondicao(montada, condicao, nome) === null) entrada.push(linha('nao', { texto: `${nome} não entrou no boneco.` }))
  const rodadas: RodadaDoBoneco[] = []
  const quantas = entre(ajustes.rodadas, RODADAS_MIN, RODADAS_MAX)
  for (let rodada = 1; rodada <= quantas; rodada += 1) rodadas.push(umaRodada(montada, condicao, nome, ajustes, rodada))
  const resultado: ResultadoDoBoneco = { entrada, rodadas }
  return resultado
}
