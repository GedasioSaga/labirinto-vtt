import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react'
import { tocarSomDoCombate } from '../../lib/sons/sonsDoCombate'
import { rasgo, sementeDe } from './ListaDeTecnicas'
import {
  ALVOS_MAX,
  CUSTO_MAX,
  DANO_MAX,
  MULTIPLICADOR_DA_SURPRESA,
  NOME_DO_SELO_MAX,
  PERFURACAO_MAX,
  TURNOS_DO_SELO_MAX,
  type AcaoDaTecnica,
  type PedidoDeAcao,
  type PedidoDeAlvo,
  type SeloDoGolpe,
  type SeloPedido,
} from '../../lib/batalha/combate'
import type { PerguntaNaHora, RespostasDoPedido } from '../../lib/batalha/perguntaNaHora'
import { divisaoDoDano } from '../../lib/batalha/reacao'
import { dividirDano, type Direcao } from '../../lib/batalha/area'
import type { AreaAMao } from '../../lib/batalha/mecanicasAMao'
import { ehNomeDeSelo, textoDoSelo } from '../../lib/batalha/selos'
import { iniciais } from '../FichaPecas'
import { useImagemDaMesa } from '../ImagemDaMesa'
import { BotaoDaCalculadora, CalculadoraDeDano } from './CalculadoraDeDano'
import { ContaComBonus } from './ContaComBonus'
import { LinhasDeMods, linhasDosMods, modsDasLinhas, resumoDasLinhas, type LinhaDeMod } from './LinhasDeMods'
import {
  alvosNaAreaDaMira,
  alvosNaOrdemDaAjuda,
  feridosParaACura,
  golpeDeAjuda,
  semFeridoDoLado,
  alvosNaAreaPelaGrade,
  areaComFrente,
  contaDoGolpe,
  direcaoDaAreaAoAbrir,
  miraComGrade,
  formatarNumero,
  lerInteiro,
  lerPerfuracao,
  textoDaAcao,
  textoDoPerfurante,
  type AlvoNaMira,
  type BalaNaTela,
  type DanoNaTela,
  type GolpeNaTela,
  type OpcaoNaTela,
} from './dadosDoMenu'
import './batalha.css'
import './combate.css'

/**
 * A MIRA DO GOLPE (o `.menu--alvo` e o `.mira` do protótipo aprovado): os
 * alvos que ele vê, na ordem (Espaço ou clique marca vários; clicar na ficha
 * no mapa também, S4), o dano que chega em cada um, editável, com a conta ao
 * lado ("205 × 2 concentração = 410"; "editado" quando mudou), o custo
 * perguntado quando a ficha não diz, a ação perguntada quando a ficha não diz,
 * Surpresa (×1,5, sem reação), Perfurante (Q4), a nota da reação e Lançar.
 * F3: o selo que a técnica sugere ("por 1 turno" = "Selo: Atordoado · 1
 * turno") vem marcado, com nome e turnos editáveis e o desmarcar; pega só no
 * alvo que o golpe acerta (Q6). Atacar com arma de balas: a escolha da bala
 * ("Sem bala especial" = o dano da arma) refaz o Dano base e a conta, e o
 * pedido leva o `balaId`. Na técnica cuja fórmula diz "Dano da Bala" (tipos
 * de habilidade F1), a mesma escolha refaz a conta da técnica; o pedido de
 * habilidade não tem `balaId`: a bala vai no dano de cada alvo.
 *
 * Tipos de habilidade F2: Buff começa marcado em quem usa (aliados também
 * marcáveis) e não pede reação; Debuff mira um inimigo, que reage (esquivou,
 * o selo não pega). O selo deles traz as linhas "atributo / delta" lidas do
 * Efeito, editáveis (pôr e tirar linha, até 4). A conta do dano pinta o
 * bônus dos selos de quem age ("+20 (Fúria)").
 *
 * Tipos de habilidade F4: a técnica "um ou outro" abre com os chips das
 * opções logo abaixo do nome (a principal marcada); trocar a opção refaz o
 * Dano base e o selo com o que o texto dela diz (tudo segue editável), e a
 * escolhida vai no pedido e no registro ("Medicina (Cirugia)").
 *
 * Esc volta à lista; Enter num campo lança.
 */

/** S4: a posição da ficha na tela (coordenadas da janela), pela câmera; `null` = fora da tela. */
export type ConsultaDaFicha = (tokenId: string) => { x: number; y: number; raio: number } | null

/** O que a mira devolve para virar `PedidoDeAcao`. */
export interface EscolhaDaMira {
  alvos: PedidoDeAlvo[]
  surpresa: boolean
  perfurante: boolean
  /** Com `perfurante`: quanto perfura, de 1 a 100; `null` = tudo (100%). */
  perfuracao: number | null
  /** O custo confirmado; `null` = o da ficha. */
  custo: number | null
  /** A ação escolhida; `null` = a da ficha. */
  acao: AcaoDaTecnica | null
  /** F3: o selo sugerido, se ficou marcado (editado ou não); `null` = sem selo. */
  selo: SeloPedido | null
  /** Atacar com arma de balas: o tipo de bala escolhido; ausente = "Sem bala especial" (o dano da arma). */
  balaId?: string
  /** Tipos de habilidade F4: a chave da opção escolhida nos chips; ausente = a técnica não tem escolha. */
  variante?: string
  /** F2 (fatia B): as respostas das perguntas na hora; ausente = a técnica não pergunta. */
  respostas?: RespostasDoPedido
  /** F2 (fatia F, Siegfried): a arma escolhida na técnica que pergunta qual; ausente = a do golpe. */
  armaId?: string
}

/** F2 (fatia B): a resposta de cada pergunta ao abrir: a 1ª opção, ou o mínimo do número. */
function respostasAoAbrir(perguntas: readonly PerguntaNaHora[] | undefined): Readonly<Record<string, string | number>> {
  const respostas: Record<string, string | number> = {}
  for (const pergunta of perguntas ?? []) {
    const padrao = pergunta.tipo === 'opcoes' ? pergunta.opcoes[0]?.valor : pergunta.minimo
    if (padrao !== undefined) respostas[pergunta.chave] = padrao
  }
  return respostas
}

/** F2 (fatia B): o dano e o selo que as respostas pedem (a última mudança que casa vence); `undefined` = nenhuma resposta muda aquilo. */
function mudancaNaMira(golpe: GolpeNaTela, respostas: Readonly<Record<string, string | number>>): { dano?: DanoNaTela; selo?: SeloDoGolpe | null } {
  const regras = golpe.respostasMudam ?? []
  const casam = regras.filter((regra) => respostas[regra.chave] === regra.valor)
  const mudanca: { dano?: DanoNaTela; selo?: SeloDoGolpe | null } = {}
  for (const regra of casam) if (regra.dano !== null) mudanca.dano = regra.dano
  // Só quando a técnica tem selo por resposta: sem a resposta que pede, o golpe sai sem selo.
  if (regras.some((regra) => regra.selo !== null)) mudanca.selo = casam.reduce<SeloDoGolpe | null>((selo, regra) => regra.selo ?? selo, null)
  return mudanca
}

/** O pedido de um golpe da mira (o mesmo no menu do jogador e no painel do NPC). */
export function pedidoDoGolpe(golpe: GolpeNaTela, escolha: EscolhaDaMira): PedidoDeAcao {
  const selo = escolha.selo === null ? {} : { selo: escolha.selo }
  // A porcentagem só vai quando é parcial: 100% é o Perfurante de sempre, o pedido sem o campo.
  const perfuracao = escolha.perfurante && escolha.perfuracao !== null && escolha.perfuracao < PERFURACAO_MAX ? { perfuracao: escolha.perfuracao } : {}
  // A bala só vai com a arma (o pedido sem `armaId` e com `balaId` é torto). F2 (revisão da fatia E): também na técnica
  // que diz "Dano da Bala" (Desenhar o alvo): o host lê dela o selo da bala ("Ferido por prata").
  const bala = golpe.armaId !== null && escolha.balaId !== undefined ? { balaId: escolha.balaId } : {}
  if (golpe.tipo === 'atacar') {
    // F2 (fatia C): as respostas de todo golpe do dono (o Electro da Aira) também no Atacar.
    const respostas = escolha.respostas === undefined ? {} : { respostas: escolha.respostas }
    return { tipo: 'atacar', armaId: golpe.armaId, alvos: escolha.alvos, surpresa: escolha.surpresa, perfurante: escolha.perfurante, ...perfuracao, ...selo, ...bala, ...respostas }
  }
  return {
    tipo: 'habilidade',
    cartaoId: golpe.cartaoId ?? '',
    armaId: escolha.armaId ?? golpe.armaId,
    alvos: escolha.alvos,
    surpresa: escolha.surpresa,
    perfurante: escolha.perfurante,
    ...perfuracao,
    custo: escolha.custo,
    acao: escolha.acao,
    ...selo,
    ...(escolha.variante === undefined ? {} : { variante: escolha.variante }),
    ...(escolha.respostas === undefined ? {} : { respostas: escolha.respostas }),
    ...bala,
  }
}

/** "1 turno", "2 turnos", "até tirar". */
function textoDosTurnos(turnos: number | null): string {
  return turnos === null ? 'até tirar' : `${turnos} ${turnos === 1 ? 'turno' : 'turnos'}`
}

const SEM_BALAS: readonly BalaNaTela[] = []

/**
 * Uma bala na escolha da mira: o nome, o dano como a ficha diz ("+15" soma,
 * "40" troca) e o total do ataque com ela; embaixo, o efeito numa linha (o
 * texto inteiro no `title`) e a quantidade, que só mostra.
 */
function OpcaoDeBala({ nome, marcada, titulo, danoTexto, total, detalhe, onEscolher }: { nome: string; marcada: boolean; titulo: string; danoTexto: string; total: DanoNaTela; detalhe: string; onEscolher: () => void }) {
  return (
    <label className="bt-bala" title={detalhe === '' ? undefined : detalhe}>
      <input type="radio" name={nome} checked={marcada} onChange={onEscolher} />
      <span className="bt-bala__nome">
        {titulo}
        {detalhe !== '' && <small className="bt-bala__det">{detalhe}</small>}
      </span>
      <span className="bt-bala__dano">
        <span className="bt-bala__fonte">{danoTexto}</span>
        <b>{total.valor === null ? 'à mão' : `= ${formatarNumero(total.valor)}`}</b>
      </span>
    </label>
  )
}

export interface MiraDoGolpeProps {
  golpe: GolpeNaTela
  carga: number
  alvos: readonly AlvoNaMira[]
  /** A ficha clicada no mapa (S4); `seq` muda a cada clique, mesmo na mesma ficha. */
  alvoDoMapa?: { tokenId: string; seq: number } | null
  /** `false` = não saiu (a mira continua, com o aviso). Um texto = não saiu, e o motivo é esse (a recusa da regra dita ao mestre). */
  onLancar: (escolha: EscolhaDaMira) => boolean | string
  onVoltar: () => void
  /** As marcas sobre as fichas do mapa. */
  consulta?: ConsultaDaFicha | null
  /** Contra-ataque (Q6): sem Surpresa. */
  contra?: boolean
  /** O alvo já marcado ao abrir (a sugestão do NPC); ausente = o primeiro de outra equipe. */
  alvoInicial?: string | null
  /** "Executar" no mestre. */
  rotuloDoLancar?: string
  /** O painel do mestre não tem para onde voltar. */
  semVoltar?: boolean
  /** O mestre liga "Escolher no mapa" à mão (com ele ligado, o clique no mapa só mira). */
  mapa?: { ligado: boolean; onTrocar: (ligado: boolean) => void }
  /** F2 (fatia F, Giro de Pá): quem está na área da técnica (`alvosDaAreaNaMira`), marcados ao abrir; ausente = a regra de sempre. */
  marcadosDaArea?: readonly string[]
  /**
   * Conserto de 09/11/2026 (a Bolha do Tree): a mira é do MESTRE. Cada linha diz o lado ("outro lado"), e a técnica de
   * ajuda (cura, Buff) num alvo do outro lado pede um toque a mais, na própria linha, antes de marcar.
   */
  confirmaOutroLado?: boolean
  /** A mira abriu pelo teclado: o foco entra no alvo marcado (ou no primeiro da lista). */
  focoAoAbrir?: boolean
}

const NOTA_SEM_FERIDO_DO_LADO = 'Ninguém do lado de quem usa está ferido. Marque alguém, se quiser.'
const ACOES_PERGUNTADAS: readonly AcaoDaTecnica[] = ['simples', 'completa', 'bonus', 'livre']
const NOTA_DA_REACAO = 'O alvo rola 1d20 para reagir: 10+ defende (metade), 15+ esquiva, 20 contra-ataca; 1 é crítico (×1,5).'
const NOTA_DO_BUFF = 'Buff: ninguém reage. O selo pega em todos que você marcar.'
const NOTA_DO_DEBUFF_SEM_DANO = 'O alvo rola 1d20 para reagir: se esquivar ou contra-atacar, o selo não pega.'

/**
 * D8 (decisão 3): os alvos que fazem sentido, à vista por padrão (o resto
 * atrás de "mostrar todos"): no ataque, o outro lado de pé; na ajuda, o lado
 * de quem usa (na cura, só os feridos; sem a vida à mão, conta como ferido).
 */
function fazSentido(golpe: GolpeNaTela, alvo: AlvoNaMira, ajuda: boolean): boolean {
  if (alvo.motivo) return false
  if (ajuda) return alvo.lado !== 'outro' && (golpe.cura !== true || alvo.ferido !== false)
  return alvo.lado === 'outro' && !alvo.caiu
}

/** D8: o lado do alvo em palavra ("você", "aliado", "outro lado"). */
function textoDoLado(alvo: AlvoNaMira, doMestre: boolean): string {
  if (alvo.lado === 'eu') return doMestre ? 'quem usa' : 'você'
  return alvo.lado === 'aliado' ? 'aliado' : 'outro lado'
}

/** D8: a mira cabe na tela: a altura até o fundo da janela (ou do menu que a cerca), com esta folga. */
const FOLGA_DA_MIRA = 12
const MIRA_ALTURA_MIN = 260

function primeiroAlvo(alvos: readonly AlvoNaMira[]): string | null {
  const validos = alvos.filter((alvo) => !alvo.motivo)
  return (validos.find((alvo) => alvo.lado === 'outro' && !alvo.caiu) ?? validos.find((alvo) => !alvo.caiu))?.tokenId ?? null
}

/** A nota do pé da mira: se o alvo reage, como `alvosDoGolpe` (golpe.ts) decide. `semDano` = o da opção escolhida. */
function notaDaReacao(golpe: GolpeNaTela, semReacao: boolean, semDano: boolean): string {
  if (golpe.reacao === 'nunca') return NOTA_DO_BUFF
  if (semReacao) return golpe.overload ? 'Overload: o alvo não reage.' : 'Surpresa: o alvo não reage.'
  if (semDano) return golpe.reacao === 'sempre' ? NOTA_DO_DEBUFF_SEM_DANO : 'Sem dano: o alvo não reage.'
  return NOTA_DA_REACAO
}

/** F2 (fatia F, Lua Incandescente): a nota do dano dividido ("71 ÷ 3 = 23 em cada"), com a mesma conta do host. */
function textoDoDanoDividido(base: number | null, alvos: number, teto: number): string {
  const cada = base === null ? null : dividirDano(base, alvos, teto)
  if (base === null || alvos < 1) return `O dano se divide entre os marcados (até ${teto}).`
  if (cada === null) return `No máximo ${teto} alvos: desmarque ${alvos - teto}.`
  return alvos === 1 ? `Um alvo só: toma ${base} (o dano se divide entre até ${teto}).` : `O dano se divide: ${base} ÷ ${alvos} = ${cada} em cada.`
}

/** Construtor C3: a nota da área pela grade: quantas fichas ela pega daqui, e que dá para mudar. */
function textoDaAreaNaMira(naArea: number, comFrente: boolean): string {
  if (naArea === 0) return comFrente ? 'Ninguém na área deste lado. Vire a área ou marque à mão.' : 'Ninguém na área. Marque à mão, se quiser.'
  return `A área pega ${naArea} ${naArea === 1 ? 'ficha' : 'fichas'}. Clique numa ficha para tirar ou pôr.`
}

/** Buff (tipos de habilidade F2): a mira começa em quem usa (o "você" da lista; no mestre, o NPC da vez). */
function voceNaLista(alvos: readonly AlvoNaMira[]): string | null {
  const meus = alvos.filter((alvo) => alvo.lado === 'eu' && !alvo.motivo)
  return (meus.find((alvo) => !alvo.caiu) ?? meus[0])?.tokenId ?? null
}

/** Construtor C3: cada lado no seletor da área (o mapa visto de cima, como na tela), na ordem das setas do teclado. */
const LADOS_DA_AREA: readonly { direcao: Direcao; seta: string; rotulo: string }[] = [
  { direcao: 'oeste', seta: '←', rotulo: 'Esquerda' },
  { direcao: 'norte', seta: '↑', rotulo: 'Cima' },
  { direcao: 'sul', seta: '↓', rotulo: 'Baixo' },
  { direcao: 'leste', seta: '→', rotulo: 'Direita' },
]

/** Construtor C3: a área da técnica montada marca sozinha (tem a grade); `null` = a regra de sempre. */
function areaDaGrade(golpe: GolpeNaTela, alvos: readonly AlvoNaMira[]): AreaAMao | null {
  return golpe.areaPelaGrade === true && golpe.area !== undefined && miraComGrade(alvos) ? golpe.area : null
}

/** Marca ou desmarca `tokenId`; com o teto de 1 alvo, marcar outro troca (como escolher numa lista de um). */
function alternarNaLista(antes: readonly string[], tokenId: string, tetoDeAlvos: number | undefined): readonly string[] {
  if (antes.includes(tokenId)) return antes.filter((id) => id !== tokenId)
  return tetoDeAlvos === 1 ? [tokenId] : [...antes, tokenId].slice(-ALVOS_MAX)
}

/** Quem a mira marca ao abrir: Buff em si; quem está na área (F2, fatia F: Giro de Pá); a sugestão do NPC; o primeiro de outra equipe. */
function marcadosAoAbrir(golpe: GolpeNaTela, alvos: readonly AlvoNaMira[], alvoInicial: string | null | undefined, daArea: readonly string[] | undefined): string[] {
  // Pedido de 09/11 (a Bolha): a cura abre nos feridos do lado de quem usa; sem ferido (ou sem a vida na lista), em quem usa.
  const feridos = golpe.cura === true ? feridosParaACura(alvos, golpe.tetoDeAlvos ?? 1) : null
  if (feridos !== null) return feridos
  // Conserto de 09/11 (achado 5): a lista sabe a vida e ninguém do lado está ferido: abre sem alvo (a nota diz por quê).
  if (golpe.cura === true && semFeridoDoLado(alvos)) return []
  const emSi = golpe.alvoEmSi === true ? voceNaLista(alvos) : null
  if (emSi !== null) return [emSi]
  // F2 (fatia C): a técnica sem alvo (Armadilhar posiciona a armadilha) abre sem ninguém marcado.
  if (golpe.semAlvo === true) return []
  // Construtor C3: a área montada com a grade marca só quem está nela, mesmo ninguém (a área vazia não vira o "primeiro inimigo").
  if (areaDaGrade(golpe, alvos) !== null && daArea !== undefined) return daArea.slice(0, ALVOS_MAX)
  if (golpe.area !== undefined && daArea !== undefined && daArea.length > 0) return daArea.filter((tokenId) => alvos.some((alvo) => alvo.tokenId === tokenId && !alvo.motivo)).slice(0, ALVOS_MAX)
  const sugerido = alvoInicial !== undefined && alvoInicial !== null && alvos.some((alvo) => alvo.tokenId === alvoInicial && !alvo.motivo) ? alvoInicial : null
  const primeiro = sugerido ?? (alvoInicial === undefined ? primeiroAlvo(alvos) : null)
  return primeiro === null ? [] : [primeiro]
}

export function MiraDoGolpe({ golpe, carga, alvos, alvoDoMapa, onLancar, onVoltar, consulta, contra, alvoInicial, rotuloDoLancar, semVoltar, mapa, marcadosDaArea, confirmaOutroLado = false, focoAoAbrir = false }: MiraDoGolpeProps) {
  const idBase = useId()
  // Conserto de 09/11 (a Bolha): na ajuda, quem é do lado de quem usa vem primeiro (os feridos antes); o outro lado fica no fim.
  const ajuda = golpeDeAjuda(golpe)
  const lista = ajuda ? alvosNaOrdemDaAjuda(alvos) : alvos
  /** O alvo do outro lado que espera o segundo toque (a ajuda na mão do mestre). */
  const [pedindo, setPedindo] = useState<string | null>(null)
  // Construtor C3: a área montada aponta para a frente de quem age (ou o lado que pega mais); quem usa pode virar.
  const [direcao, setDirecao] = useState<Direcao>(() => {
    const area = areaDaGrade(golpe, alvos)
    return area === null ? 'norte' : direcaoDaAreaAoAbrir(area, alvos)
  })
  const [marcados, setMarcados] = useState<readonly string[]>(() => {
    const area = areaDaGrade(golpe, alvos)
    const daArea = area !== null ? alvosNaAreaPelaGrade(area, alvos, direcao) : golpe.area === undefined ? undefined : alvosNaAreaDaMira(golpe.area, alvos)
    return marcadosAoAbrir(golpe, alvos, alvoInicial, marcadosDaArea ?? daArea)
  })
  // F2 (fatia F, Siegfried): a arma da técnica (a 1ª levada vem marcada); trocar refaz o Dano base.
  const [armaId, setArmaId] = useState<string | null>(golpe.armas?.[0]?.id ?? null)
  const armaEscolhida = golpe.armas?.find((arma) => arma.id === armaId) ?? null
  const [foco, setFoco] = useState<string | null>(() => marcados[0] ?? null)
  const [baseTexto, setBaseTexto] = useState(golpe.dano.valor === null ? '' : String(golpe.dano.valor))
  const [editados, setEditados] = useState<Readonly<Record<string, string>>>({})
  const [surpresa, setSurpresa] = useState(false)
  const [perfurante, setPerfurante] = useState(golpe.perfurante)
  // Quanto perfura: o número que a habilidade diz ("perfura 50%") ou 100 (tudo direto no HP).
  const [perfuracaoTexto, setPerfuracaoTexto] = useState(String(golpe.perfuracao ?? PERFURACAO_MAX))
  const [custoTexto, setCustoTexto] = useState(golpe.custo.tipo === 'pergunta' && golpe.custo.sugestao !== null ? String(golpe.custo.sugestao) : '')
  const [acao, setAcao] = useState<AcaoDaTecnica | ''>('')
  // Tipos de habilidade F4: a opção "um ou outro" (a principal primeiro); a dela troca o dano e o selo sugeridos.
  const opcoes = golpe.opcoes
  const [opcaoChave, setOpcaoChave] = useState<string | null>(opcoes?.[0]?.chave ?? null)
  const opcao = opcoes?.find((candidata) => candidata.chave === opcaoChave) ?? null
  // F2 (fatia B): as perguntas na hora (ponto vital, quadrados empurrados): a resposta troca o dano e o selo sugeridos.
  const [respostas, setRespostas] = useState(() => respostasAoAbrir(golpe.perguntas))
  const mudanca = mudancaNaMira(golpe, respostas)
  const danoDaOpcao = opcao?.dano ?? mudanca.dano ?? armaEscolhida?.dano ?? golpe.dano
  // F3: o selo sugerido começa marcado; desmarcar tira do golpe.
  const sugerido = opcao?.selo ?? (mudanca.selo === undefined ? golpe.selo : mudanca.selo) ?? null
  const [comSelo, setComSelo] = useState(sugerido !== null)
  const [seloNome, setSeloNome] = useState(sugerido?.nome ?? '')
  const [seloTurnos, setSeloTurnos] = useState(sugerido?.turnos === null || sugerido === null ? '' : String(sugerido.turnos))
  // Tipos de habilidade F2: Buff e Debuff trazem as linhas "atributo / delta" lidas do Efeito (sugestão, sempre editável).
  const alvosDeMod = golpe.alvosDeMod
  const [linhasDoSelo, setLinhasDoSelo] = useState<LinhaDeMod[]>(() => linhasDosMods(sugerido?.mods))
  const resumoDoSelo = alvosDeMod === undefined ? '' : resumoDasLinhas(linhasDoSelo, alvosDeMod)
  const [erro, setErro] = useState<string | null>(null)
  // A bala da arma (Atacar com arma de fogo ou híbrida): `null` = sem bala especial, o dano da arma.
  const balas = golpe.balas ?? SEM_BALAS
  const [balaId, setBalaId] = useState<string | null>(null)
  const balaEscolhida = balaId === null ? null : (balas.find((bala) => bala.id === balaId) ?? null)
  const danoAtual = balaEscolhida?.dano ?? danoDaOpcao
  const caixas = useRef<Map<string, HTMLInputElement>>(new Map())
  // D8: os ajustes finos (Dano base, Calcular, o dano de cada alvo, Surpresa, Perfurante) atrás do "Ajustar".
  const [ajustando, setAjustando] = useState(false)
  // D8: por padrão só os alvos que fazem sentido; o resto atrás de "Mostrar todos".
  const [mostrarTodos, setMostrarTodos] = useState(false)
  // D8: a mira cabe na tela: o corpo rola por dentro e o pé (Lançar, Voltar) fica sempre à vista.
  const forma = useRef<HTMLFormElement>(null)
  useLayoutEffect(() => {
    const el = forma.current
    if (el === null) return
    const medir = () => {
      const topo = el.getBoundingClientRect().top
      let fundo = window.innerHeight
      // O menu que cerca a mira tem teto de altura (e rola): a mira não passa dele.
      for (let pai = el.parentElement; pai !== null; pai = pai.parentElement) {
        const teto = Number.parseFloat(window.getComputedStyle(pai).maxHeight)
        if (Number.isFinite(teto)) fundo = Math.min(fundo, pai.getBoundingClientRect().top + teto)
      }
      el.style.maxHeight = `${Math.max(MIRA_ALTURA_MIN, Math.floor(fundo - topo - FOLGA_DA_MIRA))}px`
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [])
  const estiloDoRasgo = useMemo(() => {
    const semente = sementeDe(golpe.chave)
    return { '--rasgo': rasgo(semente, 6), '--rasgo2': rasgo(semente + 7, 7) } as CSSProperties
  }, [golpe.chave])
  // A calculadora do Dano base: abre no lugar, "Usar este valor" põe o número no campo.
  const [calculando, setCalculando] = useState(false)
  const campoDaBase = useRef<HTMLInputElement>(null)
  const botaoDaCalculadora = useRef<HTMLButtonElement>(null)

  const alternar = (tokenId: string) => {
    const alvo = alvos.find((candidato) => candidato.tokenId === tokenId)
    if (alvo === undefined || alvo.motivo) return
    setErro(null)
    // A ajuda num alvo do outro lado: o primeiro toque pergunta na linha dele; o segundo marca.
    if (confirmaOutroLado && ajuda && alvo.lado === 'outro' && !marcados.includes(tokenId) && pedindo !== tokenId) {
      setPedindo(tokenId)
      return
    }
    setPedindo(null)
    setMarcados((antes) => alternarNaLista(antes, tokenId, golpe.tetoDeAlvos))
  }

  // S4: clicar numa ficha no mapa marca ou desmarca o alvo, pelo mesmo caminho da lista (o outro lado também pede o segundo toque).
  const alternarAgora = useRef(alternar)
  alternarAgora.current = alternar
  const ultimoSeq = useRef(alvoDoMapa?.seq ?? -1)
  useEffect(() => {
    if (alvoDoMapa === null || alvoDoMapa === undefined || alvoDoMapa.seq === ultimoSeq.current) return
    ultimoSeq.current = alvoDoMapa.seq
    setFoco(alvoDoMapa.tokenId)
    alternarAgora.current(alvoDoMapa.tokenId)
  }, [alvoDoMapa])

  // Achado 6: aberta pelo teclado, o foco entra na mira (o alvo marcado, ou o primeiro que dá para marcar).
  useEffect(() => {
    if (!focoAoAbrir) return
    const marcada = marcados[0] === undefined ? undefined : caixas.current.get(marcados[0])
    const primeira = marcada ?? visiveis.map((alvo) => caixas.current.get(alvo.tokenId)).find((caixa) => caixa !== undefined && !caixa.disabled)
    primeira?.focus({ preventScroll: true })
    // Só ao abrir: marcar e desmarcar depois não puxa o foco.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const semDano = danoDaOpcao.semDano
  const base = semDano ? null : lerInteiro(baseTexto, DANO_MAX)
  const comSurpresa = surpresa && !contra
  const semReacao = comSurpresa || golpe.overload
  const buff = golpe.reacao === 'nunca'
  const comPerfurante = !semDano && perfurante
  /** A porcentagem digitada (1 a 100); `null` = torta. Só conta com o Perfurante ligado. */
  const perfuracao = lerPerfuracao(perfuracaoTexto)

  /** A BASE do alvo (a store aplica concentração e Surpresa): a editada, ou a do golpe. */
  const baseDe = (tokenId: string): number | null => {
    if (semDano) return null
    const editado = editados[tokenId]
    return editado === undefined ? base : lerInteiro(editado, DANO_MAX)
  }

  /** Construtor C3: virar a área remarca quem está nela (o que quem usa mudou à mão sai junto: é outra mira). */
  const virarArea = (lado: Direcao) => {
    const area = areaDaGrade(golpe, alvos)
    if (area === null) return
    setErro(null)
    setDirecao(lado)
    setMarcados(alvosNaAreaPelaGrade(area, alvos, lado).slice(0, ALVOS_MAX))
  }

  const lancar = (evento?: FormEvent) => {
    evento?.preventDefault()
    if (marcados.length === 0 && golpe.semAlvo !== true) {
      setErro('Escolha ao menos um alvo (clique na ficha no mapa ou marque na lista).')
      return
    }
    // F2 (fatia F, Lua Incandescente): a mesma regra do host, dita antes de mandar.
    if (golpe.divide !== undefined && marcados.length > golpe.divide) {
      setErro(`${golpe.nome} acerta no máximo ${golpe.divide} alvos (o dano é dividido).`)
      return
    }
    // Construtor C3: a mesma regra do host (`motivoDoTetoDeDano`), dita antes de mandar.
    if (golpe.tetoDeAlvos !== undefined && marcados.length > golpe.tetoDeAlvos) {
      setErro(golpe.tetoDeAlvos === 1 ? `${golpe.nome} acerta um alvo só.` : `${golpe.nome} acerta no máximo ${golpe.tetoDeAlvos} alvos.`)
      return
    }
    const pedidoDeAlvos: PedidoDeAlvo[] = []
    for (const tokenId of marcados) {
      const dano = baseDe(tokenId)
      // F2 (fatia D, Explosão): o dano pela vida do alvo é do host (o jogador não vê a vida); vai 0 só para o golpe ter dano.
      if (!semDano && dano === null && danoDaOpcao.pelaVida !== true) {
        setErro('Digite o dano: a ficha não dá um número para este golpe.')
        return
      }
      pedidoDeAlvos.push({ tokenId, dano: dano ?? (semDano ? null : 0) })
    }
    let custo: number | null = null
    if (golpe.custo.tipo === 'pergunta') {
      custo = lerInteiro(custoTexto, CUSTO_MAX)
      if (custo === null) {
        setErro(`Confirme o custo: ${golpe.custo.texto}`)
        return
      }
    }
    if (golpe.acao === null && acao === '') {
      setErro('A ficha não diz a ação: escolha Simples, Completa, Bônus ou Livre.')
      return
    }
    if (comPerfurante && perfuracao === null) {
      setErro('Quanto perfura vai de 1 a 100%. Com 100, tudo vai direto no HP.')
      return
    }
    let selo: SeloPedido | null = null
    if (sugerido !== null && comSelo) {
      const nome = seloNome.trim()
      if (!ehNomeDeSelo(nome)) {
        setErro(`Dê um nome ao selo (até ${NOME_DO_SELO_MAX} letras), ou desmarque o selo.`)
        return
      }
      const turnos = seloTurnos.trim() === '' ? null : lerInteiro(seloTurnos, TURNOS_DO_SELO_MAX)
      if (seloTurnos.trim() !== '' && (turnos === null || turnos < 1)) {
        setErro(`Os turnos do selo vão de 1 a ${TURNOS_DO_SELO_MAX} (vazio = até tirar).`)
        return
      }
      selo = { nome, turnos }
      if (alvosDeMod !== undefined) {
        const lidos = modsDasLinhas(linhasDoSelo, alvosDeMod)
        if ('erro' in lidos) {
          setErro(lidos.erro)
          return
        }
        if (lidos.mods.length > 0) selo.mods = lidos.mods
      }
    }
    const saiu = onLancar({
      alvos: pedidoDeAlvos,
      surpresa: comSurpresa,
      perfurante: comPerfurante,
      perfuracao: comPerfurante && perfuracao !== null && perfuracao < PERFURACAO_MAX ? perfuracao : null,
      custo,
      acao: golpe.acao === null && acao !== '' ? acao : null,
      selo,
      ...(balaEscolhida === null ? {} : { balaId: balaEscolhida.id }),
      ...(opcao === null ? {} : { variante: opcao.chave }),
      ...(golpe.perguntas === undefined ? {} : { respostas }),
      ...(armaEscolhida === null ? {} : { armaId: armaEscolhida.id }),
    })
    if (saiu !== true) setErro(typeof saiu === 'string' ? saiu : 'O golpe não saiu: sem conexão com o mestre, ou a vez já passou. Tente de novo.')
    else tocarSomDoCombate('confirmar')
  }

  const teclar = (evento: KeyboardEvent<HTMLFormElement>) => {
    if (evento.key === 'Escape') {
      evento.preventDefault()
      evento.stopPropagation()
      onVoltar()
      return
    }
    // Setas trocam o alvo em foco na lista (Espaço marca).
    const alvo = evento.target instanceof HTMLInputElement && evento.target.type === 'checkbox' ? evento.target.dataset.alvo : undefined
    if (alvo === undefined || (evento.key !== 'ArrowDown' && evento.key !== 'ArrowUp')) return
    evento.preventDefault()
    const i = visiveis.findIndex((candidato) => candidato.tokenId === alvo)
    const proximo = visiveis[(i + (evento.key === 'ArrowDown' ? 1 : -1) + visiveis.length) % visiveis.length]
    if (proximo !== undefined) {
      caixas.current.get(proximo.tokenId)?.focus()
      tocarSomDoCombate('mover')
    }
  }

  /**
   * Tipos de habilidade F4: trocar a opção refaz o Dano base (o do texto dela,
   * ou o da técnica) e o selo sugerido (o dela, ou o da técnica), marcado de
   * novo; os danos editados por alvo voltam à conta. A opção com dano próprio
   * tira a bala (a conta da bala é a da fórmula da técnica).
   */
  const escolherOpcao = (chave: string) => {
    const escolhida = opcoes?.find((candidata) => candidata.chave === chave)
    if (escolhida === undefined || chave === opcaoChave) return
    const dano = escolhida.dano ?? golpe.dano
    const selo = escolhida.selo ?? golpe.selo ?? null
    setErro(null)
    setOpcaoChave(chave)
    if (escolhida.dano !== null) setBalaId(null)
    setBaseTexto(dano.valor === null ? '' : String(dano.valor))
    setEditados({})
    setComSelo(selo !== null)
    setSeloNome(selo?.nome ?? '')
    setSeloTurnos(selo === null || selo.turnos === null ? '' : String(selo.turnos))
    setLinhasDoSelo(linhasDosMods(selo?.mods))
  }

  /**
   * F2 (fatia B): responder a pergunta refaz o Dano base (o da resposta, ou o
   * da técnica) e, na técnica com selo por resposta, o selo (marcado de novo);
   * os danos editados por alvo voltam à conta.
   */
  const responder = (chave: string, valor: string | number) => {
    if (respostas[chave] === valor) return
    const novas = { ...respostas, [chave]: valor }
    const depois = mudancaNaMira(golpe, novas)
    const dano = opcao?.dano ?? depois.dano ?? golpe.dano
    setErro(null)
    setRespostas(novas)
    setBalaId(null)
    setBaseTexto(dano.valor === null ? '' : String(dano.valor))
    setEditados({})
    if (depois.selo !== undefined) {
      setComSelo(depois.selo !== null)
      setSeloNome(depois.selo?.nome ?? '')
      setSeloTurnos(depois.selo === null || depois.selo.turnos === null ? '' : String(depois.selo.turnos))
      setLinhasDoSelo(linhasDosMods(depois.selo?.mods))
    }
  }

  /** F2 (fatia F, Siegfried): trocar a arma refaz a conta: o Dano base vira o da técnica com ela, e os editados voltam à conta. */
  const escolherArma = (_chave: string, valor: string | number) => {
    const escolhida = golpe.armas?.find((arma) => arma.id === valor)
    if (escolhida === undefined || escolhida.id === armaId) return
    setErro(null)
    setArmaId(escolhida.id)
    setBaseTexto(escolhida.dano.valor === null ? '' : String(escolhida.dano.valor))
    setEditados({})
  }

  /** Trocar a bala refaz a conta: o Dano base vira o da bala, e os danos editados por alvo voltam à conta. */
  const escolherBala = (id: string | null) => {
    const dano = id === null ? danoDaOpcao : (balas.find((bala) => bala.id === id)?.dano ?? danoDaOpcao)
    setErro(null)
    setBalaId(id)
    setBaseTexto(dano.valor === null ? '' : String(dano.valor))
    setEditados({})
  }

  const marcadosSet = useMemo(() => new Set(marcados), [marcados])
  const areaNaGrade = areaDaGrade(golpe, alvos)
  const verbo = rotuloDoLancar ?? 'Lançar'
  const textoDoLancar = marcados.length > 1 ? `${verbo} em ${marcados.length} alvos` : verbo
  // D8: com a área ou sem alvo, todos à vista (a área marca pela grade). O marcado nunca some da lista.
  const filtra = !mostrarTodos && golpe.area === undefined && golpe.semAlvo !== true
  const visiveis = filtra ? lista.filter((alvo) => marcadosSet.has(alvo.tokenId) || fazSentido(golpe, alvo, ajuda)) : lista
  const escondidos = lista.length - visiveis.length
  // O Dano base que não fecha (fórmula, campo vazio) abre os ajustes: é ali que se digita.
  const ajustesAbertos = !semDano && (ajustando || base === null)

  return (
    <>
      <form ref={forma} className="bt-mira bt-papel" style={estiloDoRasgo} onSubmit={lancar} onKeyDown={teclar} aria-labelledby={`${idBase}-nome`} noValidate>
        {/* D8: a cabeça é uma tira em tinta (a linguagem do menu); o corpo rola por dentro; o pé fica sempre à vista. */}
        <div className="bt-mira__cabeca">
          <p className="bt-mira__rot">{contra ? 'Contra-ataque · mira' : 'Mira'}</p>
          <h3 className="bt-mira__nome" id={`${idBase}-nome`}>
            {golpe.nome}
          </h3>
        </div>
        <div className="bt-mira__corpo">
        {(golpe.categoria !== undefined || golpe.capacidade !== undefined) && (
          <p className="bt-mira__arma">
            {golpe.categoria !== undefined && <span className="bt-etq bt-etq--categoria">{golpe.categoria}</span>}
            {golpe.capacidade !== undefined && <span className="bt-etq" title={`Capacidade: ${golpe.capacidade}`}>Cap. {golpe.capacidade}</span>}
          </p>
        )}
        {opcoes !== undefined && <ChipsDaOpcao idBase={idBase} opcoes={opcoes} escolhida={opcao} onEscolher={escolherOpcao} />}
        {golpe.armas !== undefined && armaId !== null && (
          <PerguntaDaMira
            idBase={idBase}
            pergunta={{ chave: 'arma', texto: 'Qual arma?', para: 'quemUsa', tipo: 'opcoes', opcoes: golpe.armas.map((arma) => ({ valor: arma.id, rotulo: `${arma.nome} (${arma.dano.valor ?? '?'})` })) }}
            resposta={armaId}
            onResponder={escolherArma}
          />
        )}
        {golpe.perguntas?.map((pergunta) => <PerguntaDaMira key={pergunta.chave} idBase={idBase} pergunta={pergunta} resposta={respostas[pergunta.chave]} onResponder={responder} />)}
        {golpe.lembrete !== undefined && <p className="bt-mira__nota">{golpe.lembrete}</p>}
        {areaNaGrade !== null && areaComFrente(areaNaGrade) && (
          <fieldset className="bt-escolha">
            <legend>Para onde a área aponta</legend>
            <div className="bt-escolha__chips">
              {LADOS_DA_AREA.map((lado) => (
                <label key={lado.direcao} className="bt-escolha__chip bt-mira__lado" title={lado.rotulo}>
                  <input type="radio" className="bt-sr" name={`${idBase}-area`} checked={direcao === lado.direcao} onChange={() => virarArea(lado.direcao)} />
                  <span aria-hidden="true">{lado.seta}</span>
                  <span className="bt-sr">{lado.rotulo}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {areaNaGrade !== null && <p className="bt-mira__nota">{textoDaAreaNaMira(alvosNaAreaPelaGrade(areaNaGrade, alvos, direcao).length, areaComFrente(areaNaGrade))}</p>}
        {golpe.divide !== undefined && <p className="bt-mira__nota">{textoDoDanoDividido(base, marcados.length, golpe.divide)}</p>}
        {balas.length > 0 && (
          <fieldset className="bt-mira__balas">
            <legend>{golpe.tipo === 'habilidade' ? 'Bala · entra no "Dano da Bala" da técnica' : 'Bala · a conta do dano muda com ela'}</legend>
            <OpcaoDeBala
              nome={`${idBase}-bala`}
              marcada={balaId === null}
              titulo="Sem bala especial"
              danoTexto={golpe.tipo === 'habilidade' ? 'bala 0' : 'o da arma'}
              total={golpe.dano}
              detalhe={golpe.tipo === 'habilidade' ? 'O "Dano da Bala" da fórmula vale 0.' : 'Atira com o dano da própria arma.'}
              onEscolher={() => escolherBala(null)}
            />
            {balas.map((bala) => (
              <OpcaoDeBala
                key={bala.id}
                nome={`${idBase}-bala`}
                marcada={balaId === bala.id}
                titulo={bala.nome}
                danoTexto={bala.danoTexto === '' ? (golpe.tipo === 'habilidade' ? 'bala 0' : 'o da arma') : bala.danoTexto}
                total={bala.dano}
                detalhe={[bala.efeito, bala.quantidade === '' ? '' : `Qtd. ${bala.quantidade}`].filter(Boolean).join(' · ')}
                onEscolher={() => escolherBala(bala.id)}
              />
            ))}
          </fieldset>
        )}
        {ajustesAbertos && (
          <div className="bt-linha-campo">
            <label className="bt-linha-campo">
              <span>Dano base</span>
              <input
                ref={campoDaBase}
                className="bt-num"
                inputMode="numeric"
                value={baseTexto}
                aria-invalid={base === null ? true : undefined}
                onChange={(evento) => {
                  setErro(null)
                  setBaseTexto(evento.target.value)
                }}
              />
            </label>
            <BotaoDaCalculadora aberta={calculando} controla={`${idBase}-calc`} botao={botaoDaCalculadora} onAlternar={() => setCalculando((antes) => !antes)} />
            <small className="bt-mira__nota" title={danoAtual.conta}>
              <ContaComBonus conta={danoAtual.conta} bonus={golpe.bonus} />
            </small>
          </div>
        )}
        {ajustesAbertos && calculando && (
          <CalculadoraDeDano
            id={`${idBase}-calc`}
            inicial={baseTexto}
            onUsar={(dano) => {
              setErro(null)
              setBaseTexto(String(dano))
              setCalculando(false)
              campoDaBase.current?.focus()
            }}
            onFechar={() => {
              setCalculando(false)
              botaoDaCalculadora.current?.focus()
            }}
          />
        )}
        {golpe.cura === true && semFeridoDoLado(alvos) && <p className="bt-mira__nota">{NOTA_SEM_FERIDO_DO_LADO}</p>}
        <fieldset className="bt-mira__alvos">
          <legend>
            {alvos.length === 0
              ? 'Nenhuma ficha à vista para mirar'
              : confirmaOutroLado && ajuda
                ? 'Quem recebe · o lado de quem usa vem primeiro; Espaço marca, ou clique na ficha no mapa'
                : buff
                  ? 'Quem recebe · você e aliados; Espaço marca, ou clique na ficha no mapa'
                  : 'Alvos · Espaço marca, setas trocam, clique na ficha no mapa'}
          </legend>
          {visiveis.length === 0 && lista.length > 0 && (
            <p className="bt-mira__nota">{ajuda ? (golpe.cura === true ? 'Ninguém do seu lado está ferido.' : 'Ninguém do seu lado à vista.') : 'Nenhum inimigo de pé à vista.'}</p>
          )}
          {visiveis.map((alvo) => {
            const marcado = marcadosSet.has(alvo.tokenId)
            const baseDoAlvo = marcado ? baseDe(alvo.tokenId) : null
            const conta = baseDoAlvo === null ? null : contaDoGolpe(baseDoAlvo, carga, comSurpresa && golpe.semSurpresa !== true, golpe.multiplicadores)
            const editado = editados[alvo.tokenId] !== undefined
            // Perfurante parcial: quanto do que chega vai direto no HP ("· 123 direto no HP").
            const direto = conta === null || !comPerfurante || perfuracao === null || perfuracao >= PERFURACAO_MAX ? '' : ` · ${formatarNumero(divisaoDoDano(conta.valor, perfuracao).direto)} direto no HP`
            return (
              <div key={alvo.tokenId} className="bt-alvo" data-apagado={alvo.motivo ? 'sim' : undefined}>
                <input
                  ref={(elemento) => {
                    if (elemento === null) caixas.current.delete(alvo.tokenId)
                    else caixas.current.set(alvo.tokenId, elemento)
                  }}
                  id={`${idBase}-${alvo.tokenId}`}
                  type="checkbox"
                  data-alvo={alvo.tokenId}
                  checked={marcado}
                  disabled={Boolean(alvo.motivo)}
                  onChange={() => alternar(alvo.tokenId)}
                  onFocus={() => setFoco(alvo.tokenId)}
                />
                <label className="bt-alvo__nome" htmlFor={`${idBase}-${alvo.tokenId}`}>
                  <MiniaturaDoAlvo imagem={alvo.imagem} nome={alvo.nome} cor={alvo.cor} caiu={alvo.caiu} />
                  {/* D8: o cartaz do alvo: o nome, o lado e a vida (quando quem olha vê). */}
                  <span className="bt-alvo__texto">
                    <span className="bt-alvo__quem">{alvo.nome}</span>
                    <span className="bt-alvo__tags">
                      <small className="bt-alvo__lado" data-lado={alvo.lado}>
                        {textoDoLado(alvo, confirmaOutroLado)}
                      </small>
                      {alvo.caiu && <small className="bt-alvo__caiu">caído</small>}
                      {alvo.motivo && <small>{alvo.motivo}</small>}
                      {alvo.vida !== undefined && (
                        <small className="bt-alvo__vida-texto">
                          vida {formatarNumero(alvo.vida.atual)}/{formatarNumero(alvo.vida.maximo)}
                        </small>
                      )}
                    </span>
                    {alvo.vida !== undefined && alvo.vida.maximo > 0 && (
                      <span className="bt-alvo__vida" aria-hidden="true">
                        <span style={{ transform: `scaleX(${Math.max(0, Math.min(1, alvo.vida.atual / alvo.vida.maximo)).toFixed(3)})` }} />
                      </span>
                    )}
                  </span>
                </label>
                {marcado && !semDano && ajustesAbertos ? (
                  <span className="bt-alvo__dano">
                    <input
                      className="bt-num"
                      inputMode="numeric"
                      aria-label={`Dano base em ${alvo.nome}`}
                      value={editados[alvo.tokenId] ?? baseTexto}
                      aria-invalid={baseDoAlvo === null ? true : undefined}
                      onChange={(evento) => {
                        setErro(null)
                        const texto = evento.target.value
                        setEditados((antes) => ({ ...antes, [alvo.tokenId]: texto }))
                      }}
                    />
                  </span>
                ) : (
                  <span />
                )}
                {pedindo === alvo.tokenId && !marcado && (
                  <span className="bt-alvo__conta bt-alvo__confirma" role="alert">
                    <em>{alvo.nome} está do outro lado.</em>{' '}
                    <button type="button" className="bt-botao bt-botao--p" onClick={() => alternar(alvo.tokenId)}>
                      Marcar mesmo assim
                    </button>
                  </span>
                )}
                {marcado && !semDano && (
                  <span className="bt-alvo__conta">
                    {editado ? (
                      <>
                        <em>editado</em>
                        {conta !== null && ` · chega ${conta.conta}${direto}`}{' '}
                        <button
                          type="button"
                          className="bt-botao bt-botao--fantasma bt-botao--p"
                          onClick={() =>
                            setEditados((antes) => {
                              const { [alvo.tokenId]: _fora, ...resto } = antes
                              return resto
                            })
                          }
                        >
                          Voltar à conta
                        </button>
                      </>
                    ) : conta === null ? (
                      'Digite o dano base'
                    ) : (
                      `chega ${conta.conta}${direto}`
                    )}
                  </span>
                )}
              </div>
            )
          })}
          {(escondidos > 0 || mostrarTodos) && (
            <button type="button" className="bt-botao bt-botao--p bt-mira__todos" aria-pressed={mostrarTodos} onClick={() => setMostrarTodos(!mostrarTodos)}>
              {mostrarTodos ? 'Só os que fazem sentido' : `Mostrar todos (+${escondidos})`}
            </button>
          )}
        </fieldset>
        {golpe.custo.tipo === 'pergunta' && (
          <label className="bt-linha-campo">
            <span>Custo ({golpe.custo.recurso.toUpperCase()})</span>
            <input className="bt-num" inputMode="numeric" value={custoTexto} onChange={(evento) => setCustoTexto(evento.target.value)} />
            <small className="bt-mira__nota">A ficha diz: {golpe.custo.texto}</small>
          </label>
        )}
        {/* D8: sem seletor nativo branco: a Ação vira chips, como a área e as opções. */}
        {golpe.acao === null && (
          <fieldset className="bt-escolha">
            <legend>Ação · a ficha não diz: escolha</legend>
            <div className="bt-escolha__chips">
              {ACOES_PERGUNTADAS.map((opcao) => (
                <label key={opcao} className="bt-escolha__chip">
                  <input type="radio" className="bt-sr" name={`${idBase}-acao`} checked={acao === opcao} onChange={() => setAcao(opcao)} />
                  {textoDaAcao(opcao)}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {ajustesAbertos && (
          <div className="bt-npc__chaves">
            {!contra && (
              <label className="bt-chave">
                <input type="checkbox" role="switch" checked={surpresa} onChange={(evento) => setSurpresa(evento.target.checked)} />
                <span className="bt-chave__trilho" aria-hidden="true" />
                Surpresa <small>×{formatarNumero(MULTIPLICADOR_DA_SURPRESA)}, sem reação</small>
              </label>
            )}
            <span className="bt-perfura">
              <label className="bt-chave">
                <input type="checkbox" role="switch" checked={perfurante} aria-describedby={`${idBase}-perfura`} onChange={(evento) => setPerfurante(evento.target.checked)} />
                <span className="bt-chave__trilho" aria-hidden="true" />
                Perfurante
              </label>
              {perfurante && (
                <label className="bt-perfura__quanto">
                  <span className="bt-sr">Quanto perfura, em %</span>
                  <input
                    className="bt-num"
                    inputMode="numeric"
                    maxLength={3}
                    value={perfuracaoTexto}
                    aria-invalid={perfuracao === null ? true : undefined}
                    aria-describedby={`${idBase}-perfura`}
                    onFocus={(evento) => evento.target.select()}
                    onChange={(evento) => {
                      setErro(null)
                      setPerfuracaoTexto(evento.target.value)
                    }}
                  />
                  <span aria-hidden="true">%</span>
                </label>
              )}
              <small id={`${idBase}-perfura`} className="bt-perfura__texto">
                {!perfurante ? textoDoPerfurante(PERFURACAO_MAX) : perfuracao === null ? 'de 1 a 100%: quanto vai direto no HP' : textoDoPerfurante(perfuracao)}
              </small>
            </span>
          </div>
        )}
        {sugerido !== null && (
          <div className="bt-mira__selo" data-marcado={comSelo ? 'sim' : 'nao'} data-natureza={sugerido.natureza}>
            <label className="bt-chave">
              <input
                type="checkbox"
                role="switch"
                checked={comSelo}
                onChange={(evento) => {
                  setErro(null)
                  setComSelo(evento.target.checked)
                }}
              />
              <span className="bt-chave__trilho" aria-hidden="true" />
              Selo: {seloNome.trim() || sugerido.nome} · {textoDosTurnos(seloTurnos.trim() === '' ? null : lerInteiro(seloTurnos, TURNOS_DO_SELO_MAX))}
              {resumoDoSelo !== '' && <span className="bt-mira__selo-mods">{resumoDoSelo}</span>}
              <small>{buff ? 'sugerido pela técnica; pega em quem você marcar' : 'sugerido pela técnica; pega só se o golpe acertar'}</small>
            </label>
            {comSelo && (
              <div className="bt-mira__selo-campos">
                <label className="bt-linha-campo">
                  <span>Nome</span>
                  <input
                    className="bt-num bt-num--texto"
                    maxLength={NOME_DO_SELO_MAX}
                    value={seloNome}
                    aria-invalid={ehNomeDeSelo(seloNome.trim()) ? undefined : true}
                    onChange={(evento) => {
                      setErro(null)
                      setSeloNome(evento.target.value)
                    }}
                  />
                </label>
                <label className="bt-linha-campo">
                  <span>Turnos</span>
                  <input
                    className="bt-num"
                    inputMode="numeric"
                    value={seloTurnos}
                    placeholder="até tirar"
                    onChange={(evento) => {
                      setErro(null)
                      setSeloTurnos(evento.target.value)
                    }}
                  />
                  <small className="bt-mira__nota">vazio = até o mestre tirar</small>
                </label>
                {alvosDeMod !== undefined && (
                  <LinhasDeMods
                    idBase={`${idBase}-selo`}
                    linhas={linhasDoSelo}
                    alvos={alvosDeMod}
                    dica="lidas do Efeito; confira e ajuste"
                    onMudar={(linhas) => {
                      setErro(null)
                      setLinhasDoSelo(linhas)
                    }}
                  />
                )}
              </div>
            )}
            {!comSelo && <span className="bt-sr">{`Selo ${textoDoSelo(sugerido)} desmarcado: o golpe não põe selo.`}</span>}
          </div>
        )}
        <p className="bt-mira__nota">{notaDaReacao(golpe, semReacao, semDano)}</p>
        </div>
        {/* D8: o pé fica preso embaixo (o corpo rola): a recusa com o motivo, Lançar, Ajustar e Voltar sempre na tela. */}
        <div className="bt-mira__pe">
          {erro !== null && (
            <p className="bt-mira__erro" role="alert">
              {erro}
            </p>
          )}
          <div className="bt-pendente__acoes">
            <button type="submit" className="bt-botao bt-botao--batalha">
              {textoDoLancar} <kbd>Enter</kbd>
            </button>
            {!semDano && (
              <button type="button" className="bt-botao" aria-expanded={ajustesAbertos} disabled={base === null} title={base === null ? 'Digite o Dano base: a ficha não dá um número' : undefined} onClick={() => setAjustando(!ajustando)}>
                {ajustesAbertos ? 'Fechar ajustes' : 'Ajustar'}
              </button>
            )}
            {mapa !== undefined && (
              <button type="button" className="bt-botao" aria-pressed={mapa.ligado} onClick={() => mapa.onTrocar(!mapa.ligado)}>
                {mapa.ligado ? 'Clique na ficha no mapa…' : 'Escolher no mapa'}
              </button>
            )}
            {!semVoltar && (
              <button type="button" className="bt-botao" onClick={onVoltar}>
                Voltar <kbd>Esc</kbd>
              </button>
            )}
          </div>
        </div>
      </form>
      {consulta !== undefined && consulta !== null && <MarcasDaMira consulta={consulta} tokenIds={alvos.map((alvo) => alvo.tokenId)} marcados={marcadosSet} foco={foco} />}
    </>
  )
}

/**
 * Tipos de habilidade F4: os chips "um ou outro" (rádio, setas trocam) e,
 * embaixo, o texto da escolhida, para ler o que ela faz antes de lançar. Os
 * mesmos chips servem ao Ativar da passiva com opções (Melodia).
 */
export function ChipsDaOpcao({ idBase, opcoes, escolhida, onEscolher }: { idBase: string; opcoes: readonly OpcaoNaTela[]; escolhida: OpcaoNaTela | null; onEscolher: (chave: string) => void }) {
  const texto = escolhida?.texto.trim() ?? ''
  return (
    <fieldset className="bt-escolha" aria-describedby={texto === '' ? undefined : `${idBase}-opcao-texto`}>
      <legend>Opção · um ou outro</legend>
      <div className="bt-escolha__chips">
        {opcoes.map((opcao) => (
          <label key={opcao.chave} className="bt-escolha__chip" title={opcao.texto === '' ? undefined : opcao.texto}>
            <input type="radio" className="bt-sr" name={`${idBase}-opcao`} checked={escolhida?.chave === opcao.chave} onChange={() => onEscolher(opcao.chave)} />
            {opcao.rotulo}
          </label>
        ))}
      </div>
      {texto !== '' && (
        <p className="bt-escolha__texto" id={`${idBase}-opcao-texto`}>
          {texto}
        </p>
      )}
    </fieldset>
  )
}

/**
 * F2 (fatia B): uma pergunta na hora da técnica ("Acertou ponto vital?"):
 * opções em chips de rádio, como os do "um ou outro" (setas trocam); número
 * num campo com o mínimo e o máximo da pergunta.
 */
function PerguntaDaMira({ idBase, pergunta, resposta, onResponder }: { idBase: string; pergunta: PerguntaNaHora; resposta: string | number | undefined; onResponder: (chave: string, valor: string | number) => void }) {
  if (pergunta.tipo === 'numero') {
    return (
      <label className="bt-escolha">
        <span>{pergunta.texto}</span>
        <input
          type="number"
          inputMode="numeric"
          min={pergunta.minimo}
          max={pergunta.maximo}
          value={typeof resposta === 'number' ? resposta : pergunta.minimo}
          onChange={(evento) => {
            const numero = Number.parseInt(evento.target.value, 10)
            if (Number.isInteger(numero) && numero >= pergunta.minimo && numero <= pergunta.maximo) onResponder(pergunta.chave, numero)
          }}
        />
      </label>
    )
  }
  return (
    <fieldset className="bt-escolha">
      <legend>{pergunta.texto}</legend>
      <div className="bt-escolha__chips">
        {pergunta.opcoes.map((opcao) => (
          <label key={opcao.valor} className="bt-escolha__chip">
            <input type="radio" className="bt-sr" name={`${idBase}-pergunta-${pergunta.chave}`} checked={resposta === opcao.valor} onChange={() => onResponder(pergunta.chave, opcao.valor)} />
            {opcao.rotulo}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/**
 * A miniatura redonda do alvo, à esquerda do nome: a foto (forma, token ou
 * retrato, pelo resolvedor da tela) ou, sem ela, as iniciais no disco da cor
 * da equipe, no anel da mesma cor. Foto que não carrega volta às iniciais.
 * Decorativa (o nome já está no rótulo): fica fora da leitura de tela.
 */
function MiniaturaDoAlvo({ imagem, nome, cor, caiu }: { imagem: string | null | undefined; nome: string; cor: string | null | undefined; caiu: boolean }) {
  const src = useImagemDaMesa()(imagem)
  const [falhou, setFalhou] = useState<string | null>(null)
  const estilo = cor ? ({ '--lado': cor } as CSSProperties) : undefined
  return (
    <span className="bt-alvo__foto" style={estilo} data-caiu={caiu ? 'sim' : undefined} aria-hidden="true">
      {src !== null && falhou !== src ? <img src={src} alt="" draggable={false} onError={() => setFalhou(src)} /> : <span className="bt-alvo__iniciais">{iniciais(nome)}</span>}
    </span>
  )
}

/**
 * As marcas da mira sobre as fichas do mapa (S4): anel em quem pode ser alvo,
 * anel de papel em quem está marcado. A câmera anda: a posição é relida a
 * cada quadro enquanto a mira está aberta (poucas fichas, só transform).
 */
export function MarcasDaMira({ consulta, tokenIds, marcados, foco, variante }: { consulta: ConsultaDaFicha; tokenIds: readonly string[]; marcados: ReadonlySet<string>; foco: string | null; variante?: 'quem' }) {
  const camada = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let quadro = 0
    const desenhar = () => {
      const raiz = camada.current
      if (raiz !== null) {
        for (const marca of Array.from(raiz.children) as HTMLElement[]) {
          const posicao = consulta(marca.dataset.alvo ?? '')
          if (posicao === null) {
            marca.style.opacity = '0'
            continue
          }
          const lado = posicao.raio * 2 + 12
          marca.style.opacity = '1'
          marca.style.width = `${lado}px`
          marca.style.height = `${lado}px`
          marca.style.transform = `translate(${posicao.x - lado / 2}px, ${posicao.y - lado / 2}px)`
        }
      }
      quadro = window.requestAnimationFrame(desenhar)
    }
    quadro = window.requestAnimationFrame(desenhar)
    return () => window.cancelAnimationFrame(quadro)
  }, [consulta])
  return (
    <div ref={camada} className="bt-marcas-da-mira" aria-hidden="true">
      {tokenIds.map((tokenId) => (
        <span key={tokenId} className={variante === 'quem' ? 'bt-marca-mira bt-marca-mira--quem' : 'bt-marca-mira'} data-alvo={tokenId} data-foco={marcados.has(tokenId) || foco === tokenId ? 'sim' : 'nao'} style={{ opacity: 0 }} />
      ))}
    </div>
  )
}
