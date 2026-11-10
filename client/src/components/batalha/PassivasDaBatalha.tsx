import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react'
import { CUSTO_MAX, NOME_DO_SELO_MAX, TURNOS_DO_SELO_MAX, type LembreteDaPassiva, type PedidoDePassiva, type SeloDaBatalha, type SeloPedido } from '../../lib/batalha/combate'
import { DANO_DO_SANGRAMENTO, ehLembreteDoSangramento, porVezDoLembrete } from '../../lib/batalha/condicoes'
import { ehLembreteDoCustoDaForma, type CustoDaFormaNaTela } from '../../lib/batalha/custoPorTurno'
import { BONUS_DA_PREPARACAO, NOME_DA_PREPARACAO, ehLembreteDaPreparacao } from '../../lib/batalha/preparacao'
import { cartaoDaVariante, temEscolha, variantesDe } from '../../lib/batalha/escolhaEEvolucao'
import { CAMPO_DO_EFEITO, type LeituraDoCusto } from '../../lib/batalha/leituraDaFicha'
import { passivasDe, passivasLigadas, seloDaPassiva, textoDoPorTurno, type EstadoDaPassiva, type PassivaNaTira } from '../../lib/batalha/passivas'
import { alvosDeMod, ehNomeDeSelo, selosDoToken } from '../../lib/batalha/selos'
import type { CartaDaOrdem, TurnosDaCena } from '../../lib/batalha/turnos'
import type { CombateParaJogador } from '../../lib/batalha/vistaDoJogador'
import type { Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { lerInteiro, textoDoCusto, type AlvoNaMira, type OpcaoNaTela, type PipDaVez } from './dadosDoMenu'
import { LinhasDeMods, linhasDosMods, modsDasLinhas, resumoDasLinhas, type LinhaDeMod } from './LinhasDeMods'
import { CabecaDaVez, Tira, andarComSetas, rasgo, semRolarDeLado, sementeDe } from './ListaDeTecnicas'
import { ChipsDaOpcao } from './MiraDoGolpe'
import './batalha.css'
import './combate.css'
import './passiva.css'

/**
 * AS PASSIVAS NA BATALHA (tipos de habilidade F3, seções 4b e 6 do plano
 * docs/planos/batalha-tipos-de-habilidade-plano.md; decisões 3 e 4 do
 * usuário): a passiva NUNCA ativa sozinha.
 *
 *  - `PainelDaPassiva`: o papel de uma passiva, no desenho da mira (cabeça em
 *    tinta, corpo que rola, pé preso). Na ordem de quem lê: o que ela faz (o
 *    texto da ficha, uma vez só), quando dispara, o custo e, desligada, em
 *    quem vai o selo (pedido antes quando o texto diz "escolhendo um
 *    oponente") e quanto gastar quando a ficha não fecha o custo. No pé, a
 *    frase do que o Ativar vai fazer. O selo dourado sugerido (nome, turnos e
 *    as linhas `LinhasDeMods`) fica atrás de "Ajustar o selo". Ativar cobra e
 *    põe o selo; ligada, Desligar o tira.
 *  - `ListaDePassivasDoMenu`: a tira Passivas aberta no menu da vez (tiras e o painel).
 *  - `PassivasDaFicha`: as linhas do painel do NPC, do perfil da carta e da
 *    janela "Passivas" do jogador, com a seta que abre o painel embaixo.
 *  - `LembretesDaPassiva`: a faixa pequena "Melodia pronta · Rodada 3:
 *    Ativar / Agora não" e "Fortaleza · a cada turno: HP +30, FOR +10:
 *    Aplicar / Pular". Ativar sai num clique quando não há o que perguntar
 *    (selo no dono, custo lido, sem opção); senão abre o painel ali embaixo.
 *
 * Tipos de habilidade F4: a passiva "um ou outro" (Melodia) pede a opção no
 * Ativar (os chips da mira, `ChipsDaOpcao`); a escolhida troca o efeito
 * mostrado e o selo sugerido (o que o texto dela diz) e vai no pedido.
 *
 * Tudo fora da vez e sem gastar ação. Mestre e Arena pedem pela store; o
 * jogador, pela conexão (o host confere a posse da ficha).
 */

/** Uma ficha que pode receber o selo da passiva (a mesma lista da mira). */
export type AlvoDaPassiva = Pick<AlvoNaMira, 'tokenId' | 'nome' | 'lado'>

/** O pedido saiu? (`false` = sem conexão, ou a regra recusou na hora.) */
export type PedirPassiva = (pedido: PedidoDePassiva) => boolean

const ROTULO_DO_ESTADO: Record<EstadoDaPassiva, string> = { ativa: 'Ativa', pronta: 'Pronta', espera: 'Espera', sempre: 'Sempre' }

/** A ordem dos alvos na escolha: oponentes primeiro, depois aliados, o dono por último. */
const ORDEM_DO_LADO: Record<AlvoDaPassiva['lado'], number> = { outro: 0, aliado: 1, eu: 2 }

/** C5: o corte do que a passiva faz na tira (duas linhas na largura do menu). */
const RESUMO_NA_TIRA_MAX = 110

// ───────────────────────────────────────────────────────────────────────────
// De onde a tela tira as passivas
// ───────────────────────────────────────────────────────────────────────────

/** As passivas da ficha na cena do mestre (store da mesa ou da Arena): ligadas pelos selos dourados, teto de selos no dono. */
export function passivasNaCena(personagem: Personagem | null | undefined, sistema: SistemaDeRpg | null, turnos: TurnosDaCena, tokenId: string): PassivaNaTira[] {
  if (personagem === null || personagem === undefined || sistema === null) return []
  return passivasDe(personagem, sistema, {
    rodada: turnos.rodada,
    ativas: passivasLigadas(turnos.selos, personagem.id),
    combate: turnos.combate?.[personagem.id],
    selosNoDono: selosDoToken(turnos.selos, tokenId).length,
  })
}

/** As passivas do personagem DELE, pelo recorte do host: ligadas = `passivasAtivas`. */
export function passivasNoRecorte(personagem: Personagem | null | undefined, sistema: SistemaDeRpg | null, rodada: number, combate: CombateParaJogador | undefined, selosNoDono: number | undefined): PassivaNaTira[] {
  if (personagem === null || personagem === undefined || sistema === null) return []
  const cena = { rodada, ativas: new Set(combate?.passivasAtivas ?? []), combate }
  return passivasDe(personagem, sistema, selosNoDono === undefined ? cena : { ...cena, selosNoDono })
}

/**
 * As fichas da ordem como alvos da passiva (uma por ficha), do ponto de vista
 * do dono: ele é "eu"; os outros, "aliado" quando `mesmoLado` diz. Para o
 * perfil da carta (mestre e Arena), que não tem a mira à mão.
 */
export function alvosDaOrdemParaPassiva(
  cartas: readonly Pick<CartaDaOrdem, 'tokenId' | 'personagemId'>[],
  nomeDe: (tokenId: string) => string,
  donoTokenId: string,
  mesmoLado: (personagemId: string | null) => boolean = () => false,
): AlvoDaPassiva[] {
  const vistos = new Set<string>()
  const alvos: AlvoDaPassiva[] = []
  for (const carta of cartas) {
    if (vistos.has(carta.tokenId)) continue
    vistos.add(carta.tokenId)
    alvos.push({ tokenId: carta.tokenId, nome: nomeDe(carta.tokenId), lado: carta.tokenId === donoTokenId ? 'eu' : mesmoLado(carta.personagemId) ? 'aliado' : 'outro' })
  }
  return alvos
}

// ───────────────────────────────────────────────────────────────────────────
// Textos
// ───────────────────────────────────────────────────────────────────────────

/** "Até desligar", "2 turnos". */
function textoDosTurnos(turnos: number | null): string {
  return turnos === null ? 'até desligar' : `${turnos} ${turnos === 1 ? 'turno' : 'turnos'}`
}

/** A linha de baixo da passiva: o estado e o porquê ("Pronta · Rodada 3", "Espera · ao acertar dois disparos"). */
function detalheDaPassiva(passiva: PassivaNaTira): string {
  switch (passiva.estado) {
    case 'ativa':
      return passiva.porTurno === null ? 'Ativa · desligue quando quiser' : 'Ativa · o efeito a cada turno lembra no começo da vez'
    case 'sempre':
      return 'Vale sempre · não lembra'
    case 'pronta':
    case 'espera':
      return `${ROTULO_DO_ESTADO[passiva.estado]} · ${passiva.textoDoGatilho}`
  }
}

/** O campo que não diz nada: vazio, "-" ou só "Passiva". */
function semTexto(texto: string): boolean {
  return texto === '' || texto === '-' || texto.toLowerCase() === 'passiva'
}

/**
 * C5: o que a passiva faz: o Efeito da ficha; quando ele só diz "Passiva"
 * (a Fortaleza da May), os extras ("Regeneração de Juggernaut: ...") e, sem
 * eles, a Descrição (as Mecânicas gerais da fruta do Vagn). Nada = ''.
 */
function textoDaPassiva(passiva: PassivaNaTira): string {
  const { campos, extras } = passiva.cartao
  const efeito = (campos[CAMPO_DO_EFEITO] ?? '').trim()
  if (!semTexto(efeito)) return efeito
  const dosExtras = extras
    .filter((extra) => !semTexto(extra.valor.trim()))
    .map((extra) => (extra.nome.trim() === '' ? extra.valor.trim() : `${extra.nome.trim()}: ${extra.valor.trim()}`))
    .join(' · ')
  if (dosExtras !== '') return dosExtras
  const descricao = (campos.descricao ?? '').trim()
  return semTexto(descricao) ? '' : descricao
}

/** C5: o que a passiva faz, para a tira (a tira corta em duas linhas; o papel tem o texto inteiro). Sem texto na ficha = `null`. */
function resumoDaPassiva(passiva: PassivaNaTira): string | null {
  const texto = textoDaPassiva(passiva)
  if (texto === '') return null
  return texto.length <= RESUMO_NA_TIRA_MAX ? texto : `${texto.slice(0, RESUMO_NA_TIRA_MAX).trimEnd()}…`
}

/** Quantas letras do começo bastam para dizer que dois textos são o mesmo. */
const COMECO_COMPARADO = 32

function mesmoComeco(a: string, b: string): boolean {
  const corte = (texto: string) => texto.replace(/\s+/g, ' ').trim().slice(0, COMECO_COMPARADO).toLowerCase()
  return corte(a) !== '' && corte(a) === corte(b)
}

/**
 * C5: na tira, o gatilho que é o próprio efeito não se repete: o estado já
 * está no canto ("ESPERA") e o resumo, logo abaixo, mostra o efeito.
 */
function detalheNaTira(passiva: PassivaNaTira, resumo: string | null): string {
  const esperaOuPronta = passiva.estado === 'pronta' || passiva.estado === 'espera'
  const repete = esperaOuPronta && resumo !== null && mesmoComeco(passiva.textoDoGatilho, resumo)
  const motivo = passiva.motivo !== null && passiva.estado !== 'ativa' ? passiva.motivo : null
  return [repete ? null : detalheDaPassiva(passiva), motivo].filter(Boolean).join(' · ')
}

/**
 * C5: o que a passiva faz, no papel: o texto da ficha, uma vez só. Recolhido,
 * mostra as linhas que a folha deixa (`--bt-passiva-linhas`, menos na tela
 * baixa); "Ler mais" só aparece quando sobra texto, e abre ali mesmo.
 */
function TextoDaFicha({ texto }: { texto: string }) {
  const [aberto, setAberto] = useState(false)
  const [sobra, setSobra] = useState(false)
  const paragrafo = useRef<HTMLParagraphElement>(null)
  const id = useId()

  useLayoutEffect(() => {
    const el = paragrafo.current
    if (el === null || aberto) return
    const medir = () => setSobra(el.scrollHeight > el.clientHeight + 1)
    medir()
    // A largura da coluna muda com a janela, e o corte com ela. Sem ResizeObserver, vale a primeira medida.
    if (typeof ResizeObserver === 'undefined') return
    const observador = new ResizeObserver(medir)
    observador.observe(el)
    return () => observador.disconnect()
  }, [aberto, texto])

  return (
    <div className="bt-ler-mais" role="group" aria-label="O que faz">
      <p ref={paragrafo} id={id} className="bt-passiva__texto" data-aberto={aberto ? 'sim' : 'nao'}>
        {texto}
      </p>
      {(sobra || aberto) && (
        <button type="button" className="bt-ler-mais__botao" aria-expanded={aberto} aria-controls={id} onClick={() => setAberto((antes) => !antes)}>
          {aberto ? 'Ler menos' : 'Ler mais'}
        </button>
      )}
    </div>
  )
}

/**
 * Quando a passiva dispara, em português simples, e a ressalva ao lado. O
 * requisito costuma ser o próprio Efeito ("Ao atingir inimigos..."): com o
 * texto já na carta (`naTela`), ele não se repete.
 */
function quandoDispara(passiva: PassivaNaTira, naTela: string): { texto: string; nota: string | null } {
  const jaAconteceu = passiva.estado === 'pronta' ? 'já aconteceu' : null
  switch (passiva.gatilho.tipo) {
    case 'inicio':
      return { texto: 'No início do combate', nota: jaAconteceu }
    case 'rodada':
      return { texto: `A partir da rodada ${passiva.gatilho.rodada}`, nota: jaAconteceu }
    case 'vida':
      return { texto: `Com a vida abaixo de ${passiva.gatilho.abaixoDe}%`, nota: jaAconteceu }
    case 'requisito':
      return { texto: mesmoComeco(passiva.gatilho.texto, naTela) ? 'Na condição do texto' : passiva.gatilho.texto, nota: 'o app não confere: veja na mesa' }
    case 'sempre':
      return { texto: 'Vale sempre', nota: passiva.estado === 'ativa' ? null : 'sem lembrete: ative quando quiser' }
  }
}

/** O que o Ativar cobra, com o que já foi digitado: "30 SP", "? SP" (falta dizer quanto); `null` = não gasta nada. */
function gastoDoAtivar(custo: LeituraDoCusto, digitado: number | null): string | null {
  if (custo.tipo === 'nada') return null
  if (custo.tipo === 'valor') return custo.valor > 0 ? textoDoCusto(custo) : null
  if (digitado === null) return `? ${custo.recurso.toUpperCase()}`
  return digitado > 0 ? textoDoCusto({ tipo: 'valor', recurso: custo.recurso, valor: digitado, porTurno: false }) : null
}

/** A folga entre o campo e a borda do corpo que rola. */
const FOLGA_NO_CORPO = 8

/**
 * Põe `el` à vista dentro do corpo da carta. O topo de `el` nunca sai: o que
 * é mais alto que o corpo fica com o começo à mostra. Corpo que não rola (a
 * carta dentro de uma coluna): com `aColunaAnda`, a coluna de fora é que
 * anda; sem ele nada se mexe (ao abrir, o foco vai com `preventScroll` para
 * a página não pular).
 */
function mostrarNoCorpo(corpo: HTMLElement | null, el: HTMLElement | null, aColunaAnda = false): void {
  if (corpo === null || el === null) return
  if (corpo.scrollHeight <= corpo.clientHeight + 1) {
    if (aColunaAnda) el.scrollIntoView?.({ block: 'nearest' })
    return
  }
  const caixa = corpo.getBoundingClientRect()
  const alvo = el.getBoundingClientRect()
  if (alvo.top < caixa.top) corpo.scrollTop -= caixa.top - alvo.top + FOLGA_NO_CORPO
  else if (alvo.bottom > caixa.bottom) corpo.scrollTop += Math.min(alvo.bottom - caixa.bottom + FOLGA_NO_CORPO, alvo.top - caixa.top)
}

/** O nome no lembrete, sem o "(Passiva)" que a ficha costuma pôr: a faixa é de uma linha. */
function nomeCurto(passiva: PassivaNaTira): string {
  return passiva.nome.replace(/\s*\([^)]*\)/g, '').trim() || passiva.nome
}

/** Ativar pergunta algo antes (oponente, custo que a ficha não fecha, a opção "um ou outro")? Senão o lembrete ativa num clique. */
function precisaPerguntar(passiva: PassivaNaTira): boolean {
  return passiva.alvo === 'oponente' || passiva.custo.tipo === 'pergunta' || temEscolha(passiva.cartao)
}

/** Tipos de habilidade F4: as opções da passiva para os chips (o selo de cada uma o painel lê na hora); uma só = `null`. */
function opcoesDaPassiva(passiva: PassivaNaTira): OpcaoNaTela[] | null {
  const variantes = variantesDe(passiva.cartao)
  if (variantes.length < 2) return null
  return variantes.map((variante) => ({ chave: variante.chave, rotulo: variante.rotulo, texto: variante.texto, principal: variante.principal, dano: null, selo: null }))
}

/** Tipos de habilidade F4: "2 opções" na linha e na tira da passiva com escolha. */
function MarcaDasOpcoesDaPassiva({ passiva }: { passiva: PassivaNaTira }) {
  const total = variantesDe(passiva.cartao).length
  if (total < 2) return null
  return <span className="bt-etq bt-etq--opcoes">{total} opções</span>
}

function alvosOrdenados(alvos: readonly AlvoDaPassiva[]): AlvoDaPassiva[] {
  return [...alvos].sort((a, b) => ORDEM_DO_LADO[a.lado] - ORDEM_DO_LADO[b.lado])
}

// ───────────────────────────────────────────────────────────────────────────
// O papel de uma passiva
// ───────────────────────────────────────────────────────────────────────────

export interface PainelDaPassivaProps {
  passiva: PassivaNaTira
  /** A ficha do dono (o pedido vai com ela). */
  tokenId: string
  alvos: readonly AlvoDaPassiva[]
  sistema: SistemaDeRpg | null
  /** O mestre aplica o "a cada turno" quando quiser; o jogador, só com o lembrete esperando. */
  aplicarLivre?: boolean
  esperando?: boolean
  onPedir: PedirPassiva
  /** O pedido saiu: quem monta fecha o painel (ou volta à lista). */
  onFeito?: () => void
  /** Ausente = sem Voltar. */
  onVoltar?: () => void
  rotuloDoVoltar?: string
  className?: string
}

/** O que os ajustes do selo põem em foco: o primeiro campo (aberto pelo botão) ou o campo que a recusa aponta. */
type FocoNosAjustes = 'abrir' | 'nome' | 'turnos' | 'mods'

/** O papel de uma passiva: a leitura, o que o Ativar vai fazer e Ativar (com alvo, custo e selo ajustável) ou Desligar. */
export function PainelDaPassiva({ passiva, tokenId, alvos, sistema, aplicarLivre = false, esperando, onPedir, onFeito, onVoltar, rotuloDoVoltar = 'Voltar', className }: PainelDaPassivaProps) {
  const idBase = useId()
  const ligada = passiva.estado === 'ativa'
  const [alvoId, setAlvoId] = useState(passiva.alvo === 'dono' ? tokenId : '')
  const [custoTexto, setCustoTexto] = useState(passiva.custo.tipo === 'pergunta' && passiva.custo.sugestao !== null ? String(passiva.custo.sugestao) : '')
  const [seloNome, setSeloNome] = useState(passiva.selo.nome)
  const [seloTurnos, setSeloTurnos] = useState(passiva.selo.turnos === null ? '' : String(passiva.selo.turnos))
  const [linhas, setLinhas] = useState<LinhaDeMod[]>(() => linhasDosMods(passiva.selo.mods))
  // Tipos de habilidade F4: a opção "um ou outro" (a principal primeiro).
  const opcoes = useMemo(() => opcoesDaPassiva(passiva), [passiva])
  const [opcaoChave, setOpcaoChave] = useState<string | null>(() => opcoes?.[0]?.chave ?? null)
  const opcao = opcoes?.find((candidata) => candidata.chave === opcaoChave) ?? null
  const [erro, setErro] = useState<string | null>(null)
  // O selo sugerido já vai pronto no pedido: nome, turnos e modificadores só aparecem em "Ajustar o selo".
  const [ajustando, setAjustando] = useState(false)
  const [focoNosAjustes, setFocoNosAjustes] = useState<{ campo: FocoNosAjustes } | null>(null)
  const corpo = useRef<HTMLDivElement>(null)
  const ajustes = useRef<HTMLDivElement>(null)
  const campoDoAlvo = useRef<HTMLSelectElement>(null)
  const campoDoCusto = useRef<HTMLInputElement>(null)
  const campoDoNome = useRef<HTMLInputElement>(null)
  const campoDosTurnos = useRef<HTMLInputElement>(null)
  const botao = useRef<HTMLButtonElement>(null)

  const mods = alvosDeMod(sistema)
  const resumo = resumoDasLinhas(linhas, mods)
  // O texto da ficha, ou o da opção escolhida (F4); desligada com opções, quem o mostra são os chips.
  const daFicha = (opcao === null || opcao.principal ? textoDaPassiva(passiva) : opcao.texto).trim()
  const texto = semTexto(daFicha) ? '' : daFicha
  const escolhendo = !ligada && opcoes !== null
  const quando = quandoDispara(passiva, escolhendo ? (opcao?.texto ?? '') : texto)
  const motivo = ligada ? null : passiva.motivo
  const custo = textoDoCusto(passiva.custo)
  const custoDigitado = passiva.custo.tipo === 'pergunta' ? lerInteiro(custoTexto, CUSTO_MAX) : null
  const gasto = gastoDoAtivar(passiva.custo, custoDigitado)
  const faltaOCusto = passiva.custo.tipo === 'pergunta' && custoDigitado === null
  const podeAplicar = ligada && passiva.porTurno !== null && (aplicarLivre || passiva.lembrete?.tipo === 'porTurno')
  const turnosLidos = seloTurnos.trim() === '' ? null : lerInteiro(seloTurnos, TURNOS_DO_SELO_MAX)
  const ordenados = alvosOrdenados(alvos)
  const alvoEscolhido = ordenados.find((alvo) => alvo.tokenId === alvoId)
  const estiloDoRasgo = useMemo(() => {
    const semente = sementeDe(passiva.cartao.id)
    return { '--rasgo': rasgo(semente, 6), '--rasgo2': rasgo(semente + 7, 7) } as CSSProperties
  }, [passiva.cartao.id])

  // Abre com o foco no que ele precisa responder primeiro: o alvo, o custo ou o botão.
  useEffect(() => {
    const campo = ligada ? null : passiva.alvo === 'oponente' ? campoDoAlvo.current : passiva.custo.tipo === 'pergunta' ? campoDoCusto.current : null
    const primeiro = campo ?? botao.current
    primeiro?.focus({ preventScroll: true })
    // O campo que espera resposta fica à vista dentro do corpo (a página não pula).
    mostrarNoCorpo(corpo.current, campo)
    // Só ao abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Os ajustes do selo abertos pelo botão ganham o foco no nome; abertos por uma recusa, no campo recusado.
  useEffect(() => {
    if (focoNosAjustes === null) return
    const { campo } = focoNosAjustes
    const alvo = campo === 'turnos' ? campoDosTurnos.current : campo === 'mods' ? (ajustes.current?.querySelector<HTMLElement>('.bt-mods [aria-invalid="true"]') ?? null) : campoDoNome.current
    alvo?.focus({ preventScroll: true })
    mostrarNoCorpo(corpo.current, campo === 'abrir' ? ajustes.current : (alvo ?? ajustes.current), true)
  }, [focoNosAjustes])

  /** A recusa num campo do selo abre os ajustes e leva o foco ao campo: nada obrigatório fica escondido. */
  const recusarNoSelo = (recusa: string, campo: FocoNosAjustes) => {
    setErro(recusa)
    setAjustando(true)
    setFocoNosAjustes({ campo })
  }

  const pedir = (pedido: PedidoDePassiva, falhou: string) => {
    const saiu = onPedir(pedido)
    setErro(saiu ? null : falhou)
    if (saiu) onFeito?.()
  }

  /** Trocar a opção refaz o selo sugerido com o que o texto dela diz (nome, turnos, mods), como na mira. */
  const escolherOpcao = (chave: string) => {
    if (chave === opcaoChave) return
    const variante = variantesDe(passiva.cartao).find((candidata) => candidata.chave === chave)
    if (variante === undefined) return
    const selo = variante.principal || sistema === null ? passiva.selo : seloDaPassiva(cartaoDaVariante(passiva.cartao, variante), sistema)
    setErro(null)
    setOpcaoChave(chave)
    setSeloNome(selo.nome)
    setSeloTurnos(selo.turnos === null ? '' : String(selo.turnos))
    setLinhas(linhasDosMods(selo.mods))
  }

  const enviar = (evento?: FormEvent) => {
    evento?.preventDefault()
    if (esperando) return
    const { id: cartaoId } = passiva.cartao
    if (ligada) {
      pedir({ tipo: 'passiva', tokenId, cartaoId, ligar: false, custo: null }, 'Não desligou: sem conexão com o mestre, ou a passiva já estava desligada.')
      return
    }
    if (motivo !== null) {
      setErro(motivo)
      return
    }
    if (alvoId === '') {
      setErro('Escolha o oponente que recebe o selo.')
      campoDoAlvo.current?.focus()
      return
    }
    let custoPedido: number | null = null
    if (passiva.custo.tipo === 'pergunta') {
      custoPedido = lerInteiro(custoTexto, CUSTO_MAX)
      if (custoPedido === null) {
        setErro(`Confirme o custo: ${passiva.custo.texto}`)
        campoDoCusto.current?.focus()
        return
      }
    }
    const nome = seloNome.trim()
    if (!ehNomeDeSelo(nome)) {
      recusarNoSelo(`Dê um nome ao selo (até ${NOME_DO_SELO_MAX} letras).`, 'nome')
      return
    }
    if (seloTurnos.trim() !== '' && (turnosLidos === null || turnosLidos < 1)) {
      recusarNoSelo(`Os turnos do selo vão de 1 a ${TURNOS_DO_SELO_MAX} (vazio = até desligar).`, 'turnos')
      return
    }
    const lidos = modsDasLinhas(linhas, mods)
    if ('erro' in lidos) {
      recusarNoSelo(lidos.erro, 'mods')
      return
    }
    const selo: SeloPedido = { nome, turnos: turnosLidos }
    if (lidos.mods.length > 0) selo.mods = lidos.mods
    const pedido: PedidoDePassiva = { tipo: 'passiva', tokenId, cartaoId, ligar: true, custo: custoPedido, selo }
    if (alvoId !== tokenId) pedido.alvoTokenId = alvoId
    if (opcao !== null) pedido.variante = opcao.chave
    pedir(pedido, 'Não ativou: sem conexão com o mestre, ou a regra recusou (custo, recarga, selos). Tente de novo.')
  }

  const aplicar = () => {
    if (esperando) return
    pedir({ tipo: 'lembrete', tokenId, cartaoId: passiva.cartao.id, aplicar: true }, 'Não aplicou: sem conexão com o mestre.')
  }

  const teclar = (evento: KeyboardEvent<HTMLFormElement>) => {
    if (evento.key !== 'Escape' || onVoltar === undefined) return
    evento.preventDefault()
    evento.stopPropagation()
    onVoltar()
  }

  // O botão diz o que cobra (o digitado também); o nome da passiva já está na cabeça da carta.
  const rotuloDoBotao = ligada ? 'Desligar' : `Ativar${gasto === null || faltaOCusto ? '' : ` · ${gasto}`}`
  const classe = ['bt-mira', 'bt-papel', 'bt-passiva', className].filter(Boolean).join(' ')
  return (
    <form className={classe} style={estiloDoRasgo} onSubmit={enviar} onKeyDown={teclar} aria-labelledby={`${idBase}-nome`} noValidate>
      <div className="bt-mira__cabeca">
        <p className="bt-mira__rot">
          {ligada ? 'Passiva · ativa' : passiva.estado === 'pronta' ? 'Passiva · pronta' : 'Passiva'}
          {passiva.forma !== undefined && <span> · {passiva.forma}</span>}
        </p>
        <h3 className="bt-mira__nome" id={`${idBase}-nome`}>
          {passiva.nome}
        </h3>
      </div>
      <div className="bt-mira__corpo" ref={corpo}>
        {/* A leitura, na ordem de quem nunca viu a carta: o que faz, quando dispara, o custo; depois o que ele decide. */}
        <div className="bt-passiva__colunas">
          {escolhendo ? (
            <ChipsDaOpcao idBase={idBase} opcoes={opcoes} escolhida={opcao} onEscolher={escolherOpcao} />
          ) : texto !== '' ? (
            <TextoDaFicha texto={texto} />
          ) : (
            <p className="bt-passiva__sem-texto">A ficha não diz o que esta passiva faz.</p>
          )}
          <dl className="bt-passiva__fatos">
            <div>
              <dt>Quando</dt>
              <dd>
                {quando.texto}
                {quando.nota !== null && <small> · {quando.nota}</small>}
              </dd>
            </div>
            <div>
              <dt>Custo</dt>
              <dd>{passiva.custo.tipo === 'pergunta' ? `A ficha diz: “${passiva.custo.texto}”` : (custo ?? 'Sem custo')}</dd>
            </div>
            {passiva.porTurno !== null && (
              <div>
                <dt>A cada turno</dt>
                <dd>
                  {textoDoPorTurno(passiva.porTurno, sistema)}
                  <small> · lembra no começo da vez, com Aplicar</small>
                </dd>
              </div>
            )}
          </dl>
          {!ligada && (
            <label className="bt-linha-campo bt-passiva__campo">
              <span>Em quem</span>
              <select
                ref={campoDoAlvo}
                value={alvoId}
                aria-invalid={erro !== null && alvoId === '' ? true : undefined}
                onChange={(evento) => {
                  setErro(null)
                  setAlvoId(evento.target.value)
                }}
              >
                {passiva.alvo === 'oponente' && (
                  <option value="" disabled>
                    Escolha o oponente…
                  </option>
                )}
                {ordenados.map((alvo) => (
                  <option key={alvo.tokenId} value={alvo.tokenId}>
                    {alvo.tokenId === tokenId ? `${alvo.nome} (o dono)` : alvo.nome}
                  </option>
                ))}
              </select>
              {passiva.alvo === 'oponente' && <small className="bt-mira__nota">o texto diz "escolhendo um oponente"</small>}
            </label>
          )}
          {!ligada && passiva.custo.tipo === 'pergunta' && (
            <label className="bt-linha-campo bt-passiva__campo">
              <span>Gastar agora</span>
              <input
                ref={campoDoCusto}
                className="bt-num"
                inputMode="numeric"
                value={custoTexto}
                placeholder="?"
                aria-invalid={erro !== null && faltaOCusto ? true : undefined}
                onChange={(evento) => {
                  setErro(null)
                  setCustoTexto(evento.target.value)
                }}
              />
              {passiva.custo.recurso.toUpperCase()}
              <small className="bt-mira__nota">0 = não gasta</small>
            </label>
          )}
        </div>
        {!ligada && ajustando && (
          <div ref={ajustes} id={`${idBase}-ajustes`} className="bt-mira__selo bt-passiva__ajustes" role="group" aria-labelledby={`${idBase}-ajustes-nome`} data-marcado="sim" data-natureza="passiva">
            <p className="bt-passiva__ajustes-nome" id={`${idBase}-ajustes-nome`}>
              Ajustes do selo <small>a marca dourada que fica na carta de quem recebe, enquanto a passiva estiver ativa</small>
            </p>
            <div className="bt-mira__selo-campos">
              <label className="bt-linha-campo bt-passiva__nome-do-selo">
                <span>Nome</span>
                <input
                  ref={campoDoNome}
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
                  ref={campoDosTurnos}
                  className="bt-num"
                  inputMode="numeric"
                  value={seloTurnos}
                  onChange={(evento) => {
                    setErro(null)
                    setSeloTurnos(evento.target.value)
                  }}
                />
                <small className="bt-mira__nota">vazio = até desligar</small>
              </label>
              <LinhasDeMods
                idBase={`${idBase}-selo`}
                linhas={linhas}
                alvos={mods}
                dica="o que o selo soma ou tira; lido do texto, confira"
                onMudar={(novas) => {
                  setErro(null)
                  setLinhas(novas)
                }}
              />
            </div>
          </div>
        )}
      </div>
      {/* O pé fica preso embaixo (o corpo rola): o que vai acontecer, a recusa com o motivo e os botões, sempre na tela. */}
      <div className="bt-mira__pe">
        {motivo !== null ? (
          <p className="bt-passiva__resumo" data-tom="recusa" id={`${idBase}-motivo`}>
            {motivo}
          </p>
        ) : ligada ? (
          <p className="bt-passiva__resumo" id={`${idBase}-resumo`}>
            Está ativa. Desligar tira o selo dourado da carta.
          </p>
        ) : (
          <p className="bt-passiva__resumo" id={`${idBase}-resumo`}>
            Ativar{' '}
            {gasto === null ? (
              'não gasta nada'
            ) : (
              <>
                gasta <b data-falta={faltaOCusto ? 'sim' : undefined}>{gasto}</b>
              </>
            )}{' '}
            e põe o selo{' '}
            <span className="bt-selo" data-natureza="passiva">
              {seloNome.trim() || passiva.selo.nome}
            </span>{' '}
            {alvoId === '' ? 'no oponente que você escolher' : alvoEscolhido === undefined ? 'no dono' : <>em <b>{alvoEscolhido.nome}</b></>}{' '}
            {turnosLidos === null ? 'até desligar' : `por ${textoDosTurnos(turnosLidos)}`}
            {resumo !== '' && (
              <>
                , com <span className="bt-passiva__mods">{resumo}</span>
              </>
            )}
            .
          </p>
        )}
        {erro !== null && erro !== motivo && (
          <p className="bt-mira__erro" role="alert">
            {erro}
          </p>
        )}
        <div className="bt-pendente__acoes">
          <button
            ref={botao}
            type="submit"
            className={ligada ? 'bt-botao' : 'bt-botao bt-botao--passiva'}
            disabled={esperando || motivo !== null}
            aria-label={ligada ? `Desligar ${passiva.nome}` : undefined}
            aria-describedby={motivo === null ? `${idBase}-resumo` : `${idBase}-motivo`}
          >
            {rotuloDoBotao} <kbd>Enter</kbd>
          </button>
          {podeAplicar && passiva.porTurno !== null && (
            <button type="button" className="bt-botao bt-botao--passiva" disabled={esperando} onClick={aplicar}>
              Aplicar {textoDoPorTurno(passiva.porTurno, sistema)}
            </button>
          )}
          {!ligada && (
            <button
              type="button"
              className="bt-botao"
              aria-expanded={ajustando}
              aria-controls={ajustando ? `${idBase}-ajustes` : undefined}
              onClick={() => {
                setAjustando(!ajustando)
                setFocoNosAjustes(ajustando ? null : { campo: 'abrir' })
              }}
            >
              {ajustando ? 'Fechar ajustes' : 'Ajustar o selo'}
            </button>
          )}
          {onVoltar !== undefined && (
            <button type="button" className="bt-botao" onClick={onVoltar}>
              {rotuloDoVoltar} <kbd>Esc</kbd>
            </button>
          )}
          <small className="bt-mira__nota bt-passiva__nota">Não gasta ação. Dá para desfazer na linha do registro.</small>
        </div>
      </div>
    </form>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// A tira Passivas aberta no menu da vez (o jogador)
// ───────────────────────────────────────────────────────────────────────────

/** As etiquetas de uma passiva (custo, forma, "a cada turno", lembrete esperando). */
function ChipsDaPassiva({ passiva }: { passiva: PassivaNaTira }) {
  const custo = textoDoCusto(passiva.custo)
  return (
    <>
      {passiva.lembrete !== null && <span className="bt-etq bt-etq--passiva">Lembrete</span>}
      {custo !== null && <span className="bt-etq">{custo}</span>}
      <MarcaDasOpcoesDaPassiva passiva={passiva} />
      {passiva.porTurno !== null && <span className="bt-etq">A cada turno</span>}
      {passiva.forma !== undefined && <span className="bt-etq bt-etq--forma">{passiva.forma}</span>}
      {passiva.overload && <span className="bt-etq bt-etq--over">Overload</span>}
    </>
  )
}

/** O que o menu da vez sabe das passivas da ficha que age. */
export interface PassivasNoMenu {
  itens: readonly PassivaNaTira[]
  tokenId: string
  sistema: SistemaDeRpg | null
  onPedir: PedirPassiva
}

export interface ListaDePassivasDoMenuProps {
  pips: readonly PipDaVez[] | null
  carga: number
  passivas: PassivasNoMenu
  alvos: readonly AlvoDaPassiva[]
  /** Aberta pelo teclado: as tiras entram na hora. */
  instantaneo?: boolean
  esperando?: boolean
  onVoltar: () => void
}

/** Teclado: setas andam, Enter ou seta para a direita abrem o papel; Esc ou seta para a esquerda voltam. */
export function ListaDePassivasDoMenu({ pips, carga, passivas, alvos, instantaneo, esperando, onVoltar }: ListaDePassivasDoMenuProps) {
  const { itens, tokenId, sistema, onPedir } = passivas
  const tiras = useRef<(HTMLButtonElement | null)[]>([])
  const [atual, setAtual] = useState(0)
  const [aberta, setAberta] = useState<string | null>(null)
  const [porTeclado, setPorTeclado] = useState(Boolean(instantaneo))
  tiras.current.length = itens.length
  const passiva = aberta === null ? undefined : itens.find((candidata) => candidata.cartao.id === aberta)

  // Voltando do papel, o foco volta à tira da passiva que estava aberta.
  const voltarDoPainel = useRef(false)
  useEffect(() => {
    if (aberta !== null || !voltarDoPainel.current) return
    voltarDoPainel.current = false
    tiras.current[atual]?.focus()
    // Só a troca de tela devolve o foco.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta])

  const fechar = () => {
    voltarDoPainel.current = true
    setPorTeclado(true)
    setAberta(null)
  }

  if (passiva !== undefined) {
    return (
      <div className="bt-vez bt-vez--lista" data-instantaneo="sim">
        <CabecaDaVez quem="Passivas" pips={pips} carga={carga} />
        <PainelDaPassiva key={`${passiva.cartao.id}:${passiva.estado}`} passiva={passiva} tokenId={tokenId} alvos={alvos} sistema={sistema} esperando={esperando} onPedir={onPedir} onFeito={fechar} onVoltar={fechar} />
      </div>
    )
  }

  const abrir = (indice: number) => {
    const escolhida = itens[indice]
    if (escolhida === undefined || esperando) return
    setAtual(indice)
    setAberta(escolhida.cartao.id)
  }

  const teclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    if (andarComSetas(evento, tiras.current, atual)) return
    if (evento.key === 'ArrowRight') {
      evento.preventDefault()
      abrir(atual)
      return
    }
    if (evento.key === 'Escape' || evento.key === 'ArrowLeft') {
      evento.preventDefault()
      evento.stopPropagation()
      onVoltar()
    }
  }

  return (
    <div className="bt-vez bt-vez--lista" data-instantaneo={porTeclado ? 'sim' : 'nao'} onKeyDown={teclar}>
      <CabecaDaVez quem="Passivas" pips={pips} carga={carga} />
      {itens.length === 0 ? (
        <p className="bt-vez__aviso">Nenhuma passiva na ficha (nem nas transformações ligadas).</p>
      ) : (
        <ul className="bt-vez__tiras" aria-label="Passivas" onScroll={semRolarDeLado}>
          {itens.map((item, indice) => (
            <li key={item.cartao.id}>
              <Tira
                indice={indice}
                chave={`passiva:${item.cartao.id}`}
                nome={item.nome}
                lado={ROTULO_DO_ESTADO[item.estado].toUpperCase()}
                detalhe={detalheNaTira(item, resumoDaPassiva(item))}
                resumo={resumoDaPassiva(item)}
                chips={<ChipsDaPassiva passiva={item} />}
                passiva
                esta={atual === indice}
                onFoco={() => setAtual(indice)}
                onApontar={() => setAtual(indice)}
                onEscolher={() => abrir(indice)}
                refDaTira={(elemento) => {
                  tiras.current[indice] = elemento
                }}
              />
            </li>
          ))}
        </ul>
      )}
      <p className="bt-vez__dica">
        <kbd>↑</kbd> <kbd>↓</kbd> escolhe · <kbd>Enter</kbd> abre · <kbd>Esc</kbd> volta
      </p>
      <div className="bt-vez__rodape">
        <button type="button" className="bt-botao bt-botao--p" onClick={onVoltar}>
          Voltar
        </button>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// As linhas (painel do NPC, perfil da carta, janela do jogador)
// ───────────────────────────────────────────────────────────────────────────

export interface PassivasDaFichaProps {
  passivas: readonly PassivaNaTira[]
  tokenId: string
  alvos: readonly AlvoDaPassiva[]
  sistema: SistemaDeRpg | null
  aplicarLivre?: boolean
  esperando?: boolean
  onPedir: PedirPassiva
  /** Sem passiva: some (`null`) ou diz que não há (`true`). */
  mostrarVazio?: boolean
}

/** As passivas em linhas, cada uma com a seta que abre o papel embaixo (como a Transformação do NPC). */
export function PassivasDaFicha({ passivas, tokenId, alvos, sistema, aplicarLivre, esperando, onPedir, mostrarVazio = false }: PassivasDaFichaProps) {
  const [aberta, setAberta] = useState<string | null>(null)
  const setas = useRef(new Map<string, HTMLButtonElement>())
  if (passivas.length === 0) return mostrarVazio ? <p className="bt-npc__legenda">Nenhuma passiva na ficha.</p> : null
  const ativas = passivas.filter((passiva) => passiva.estado === 'ativa').length

  const fechar = (cartaoId: string) => {
    setAberta(null)
    setas.current.get(cartaoId)?.focus()
  }

  return (
    <div className="bt-npc__lista bt-passivas" role="group" aria-label="Passivas">
      <p className="bt-npc__legenda">
        Passivas ({passivas.length}){ativas > 0 && <span className="bt-passivas__ativas"> · {ativas === 1 ? '1 ativa' : `${ativas} ativas`}</span>}
      </p>
      {passivas.map((passiva) => {
        const id = passiva.cartao.id
        const expandida = aberta === id
        const ligada = passiva.estado === 'ativa'
        return (
          <div key={id}>
            <div className="bt-opcao bt-opcao--passiva" data-estado={passiva.estado}>
              <span className="bt-opcao__nome">
                {passiva.nome}
                <small>{[detalheDaPassiva(passiva), textoDoCusto(passiva.custo), !ligada ? passiva.motivo : null].filter(Boolean).join(' · ')}</small>
              </span>
              <span className="bt-opcao__lado">
                {passiva.lembrete !== null && <span className="bt-etq bt-etq--passiva">lembrete</span>}{' '}
                <MarcaDasOpcoesDaPassiva passiva={passiva} />{' '}
                <span className="bt-passivas__estado" data-estado={passiva.estado}>
                  {ROTULO_DO_ESTADO[passiva.estado].toLowerCase()}
                </span>
              </span>
              <button
                ref={(elemento) => {
                  if (elemento === null) setas.current.delete(id)
                  else setas.current.set(id, elemento)
                }}
                type="button"
                className="bt-seta"
                aria-expanded={expandida}
                aria-label={`${ligada ? 'Desligar' : 'Ativar'} ${passiva.nome}`}
                onClick={() => setAberta(expandida ? null : id)}
              >
                ›
              </button>
            </div>
            {expandida && (
              <PainelDaPassiva
                key={`${id}:${passiva.estado}`}
                passiva={passiva}
                tokenId={tokenId}
                alvos={alvos}
                sistema={sistema}
                aplicarLivre={aplicarLivre}
                esperando={esperando}
                onPedir={onPedir}
                onFeito={() => fechar(id)}
                onVoltar={() => fechar(id)}
                rotuloDoVoltar="Fechar"
                className="bt-forma--npc"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// A faixa de lembretes
// ───────────────────────────────────────────────────────────────────────────

export interface LembreteDaPassivaNaTela {
  lembrete: LembreteDaPassiva
  passiva: PassivaNaTira
  /** Os alvos do ponto de vista do dono (para o oponente da passiva). */
  alvos: readonly AlvoDaPassiva[]
  /** "May": o nome do dono, quando a tela mostra lembretes de mais de uma ficha. */
  quem?: string
}

/** Conserto das fichas F1 (P6): o lembrete do custo por turno de uma forma ligada. */
export interface LembreteDoCustoNaTela {
  lembrete: LembreteDaPassiva
  custo: CustoDaFormaNaTela
  quem?: string
}

/** Conserto das fichas F1 (S4): o lembrete de uma regra da mesa (Sangramento, Preparação para a Batalha). */
export interface LembreteDaRegraNaTela {
  lembrete: LembreteDaPassiva
  regra: 'sangramento' | 'preparacao'
  quem?: string
  /** F2 (fatia A): o selo que tira por vez (Sangrando 10, Queimando N), com o nome e quanto tira. Ausente = Sangrando, 10. */
  porVez?: { nome: string; dano: number }
}

export type LembreteNaTela = LembreteDaPassivaNaTela | LembreteDoCustoNaTela | LembreteDaRegraNaTela

/** S4: o lembrete do Sangramento ou da Preparação na tela; `null` = é de passiva ou de forma. */
export function lembreteDaRegraNaTela(lembrete: LembreteDaPassiva, quem?: string, selos?: readonly SeloDaBatalha[]): LembreteDaRegraNaTela | null {
  const regra = ehLembreteDoSangramento(lembrete) ? 'sangramento' : ehLembreteDaPreparacao(lembrete) ? 'preparacao' : null
  if (regra === null) return null
  const item: LembreteDaRegraNaTela = quem === undefined ? { lembrete, regra } : { lembrete, regra, quem }
  // F2 (fatia A): o nome e quanto tira vêm do selo (o `cartaoId` do lembrete é o id dele) ou, se ele já saiu no fim da vez, do próprio lembrete; é o mesmo que o Aplicar tira.
  if (regra === 'sangramento') item.porVez = porVezDoLembrete(lembrete, selos)
  return item
}

/**
 * Junta os lembretes de um dono com as passivas dele (lembrete de passiva que
 * sumiu da ficha fica de fora). `custos` (P6) = as formas ligadas com custo
 * por turno (`custosDasFormasNaTela`): o lembrete do custo de cada uma.
 */
export function lembretesNaTela(
  lembretes: readonly LembreteDaPassiva[] | undefined,
  passivas: readonly PassivaNaTira[],
  alvos: readonly AlvoDaPassiva[],
  quem?: string,
  custos?: readonly CustoDaFormaNaTela[],
): LembreteNaTela[] {
  const itens: LembreteNaTela[] = []
  for (const lembrete of lembretes ?? []) {
    const daRegra = lembreteDaRegraNaTela(lembrete, quem)
    if (daRegra !== null) {
      itens.push(daRegra)
      continue
    }
    if (ehLembreteDoCustoDaForma(lembrete)) {
      const custo = custos?.find((candidato) => candidato.cartaoId === lembrete.cartaoId)
      if (custo !== undefined) itens.push(quem === undefined ? { lembrete, custo } : { lembrete, custo, quem })
      continue
    }
    const passiva = passivas.find((candidata) => candidata.cartao.id === lembrete.cartaoId)
    if (passiva === undefined) continue
    itens.push(quem === undefined ? { lembrete, passiva, alvos } : { lembrete, passiva, alvos, quem })
  }
  return itens
}

export interface LembretesDaPassivaProps {
  itens: readonly LembreteNaTela[]
  sistema: SistemaDeRpg | null
  aplicarLivre?: boolean
  esperando?: boolean
  onPedir: PedirPassiva
  className?: string
}

/**
 * O botão de pagar do lembrete do custo: "Aplicar · 20 SP" na forma, "Manter ·
 * 30 SP" na técnica mantida; sem recurso, o que acontece ("Voltar para Parte
 * 1", "Sair da forma", "Parar").
 */
function textoDoAplicarDoCusto(custo: CustoDaFormaNaTela): string {
  const sem = custo.semRecurso
  if (custo.mantida === true) return sem === undefined ? `Manter · ${custo.custo}` : 'Parar'
  if (sem === undefined) return `Aplicar · ${custo.custo}`
  return sem.voltaPara === null ? 'Sair da forma' : `Voltar para ${sem.voltaPara}`
}

/**
 * Conserto das fichas F1 (P6): o lembrete do custo por turno de uma forma.
 * Aplicar paga; sem recurso, o mesmo botão desce a forma uma Parte (o texto
 * diz para onde). Pular só tira o lembrete. F2 (revisão da fatia D): na
 * técnica mantida, "Manter" paga e "Parar" desliga (a recarga começa).
 */
function UmLembreteDoCusto({ item, esperando, onPedir }: { item: LembreteDoCustoNaTela; esperando?: boolean; onPedir: PedirPassiva }) {
  const { lembrete, custo, quem } = item
  const [erro, setErro] = useState<string | null>(null)
  const id = useId()
  const pedir = (aplicar: boolean) => {
    if (esperando) return
    const saiu = onPedir({ tipo: 'lembrete', tokenId: lembrete.tokenId, cartaoId: lembrete.cartaoId, aplicar })
    setErro(saiu ? null : 'Não saiu: sem conexão com o mestre, ou o lembrete já foi respondido.')
  }
  const sem = custo.semRecurso
  return (
    <li className="bt-lembrete" data-tipo={lembrete.tipo}>
      <p className="bt-lembrete__texto" id={`${id}-texto`}>
        <span className="bt-lembrete__marca" aria-hidden="true" />
        {quem !== undefined && <span className="bt-lembrete__quem">{quem} · </span>}
        <b title={custo.nome}>{custo.nome}</b>
        <span className="bt-lembrete__det"> · a cada turno: {custo.custo}</span>
      </p>
      <div className="bt-lembrete__acoes" role="group" aria-labelledby={`${id}-texto`}>
        <button type="button" className="bt-botao bt-botao--passiva" disabled={esperando} aria-describedby={sem === undefined ? undefined : `${id}-motivo`} onClick={() => pedir(true)}>
          {textoDoAplicarDoCusto(custo)}
        </button>
        <button type="button" className="bt-botao" disabled={esperando} onClick={() => pedir(false)}>
          {custo.mantida === true ? 'Parar' : 'Pular'}
        </button>
      </div>
      {sem !== undefined && (
        <p className="bt-lembrete__motivo" id={`${id}-motivo`}>
          Sem {custo.recurso} para manter {custo.mantida === true ? 'a técnica' : 'a forma'}.
        </p>
      )}
      {erro !== null && (
        <p className="bt-lembrete__motivo" role="alert">
          {erro}
        </p>
      )}
    </li>
  )
}

/**
 * Conserto das fichas F1 (S4): o lembrete de uma regra da mesa.
 *  - Sangramento: no começo da vez de quem sangra, o mestre aplica (-10 HP
 *    direto, sem o Escudo) ou pula; o jogador só vê o aviso.
 *  - Preparação para a Batalha: no começo do combate, "vai fazer?" e qual
 *    atributo; Fazer põe +20 nele até o fim do combate.
 */
function UmLembreteDaRegra({ item, sistema, aplicarLivre, esperando, onPedir }: Omit<LembretesDaPassivaProps, 'itens' | 'className'> & { item: LembreteDaRegraNaTela }) {
  const { lembrete, regra, quem } = item
  const atributos = sistema?.atributos ?? []
  const [atributoId, setAtributoId] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const id = useId()
  const sangra = regra === 'sangramento'
  const decide = !sangra || aplicarLivre === true
  const motivo = sangra || atributoId !== '' ? null : 'Escolha o atributo que ganha +20'
  const pedir = (aplicar: boolean) => {
    if (esperando) return
    if (aplicar && motivo !== null) {
      setErro(motivo)
      return
    }
    const pedido: PedidoDePassiva = { tipo: 'lembrete', tokenId: lembrete.tokenId, cartaoId: lembrete.cartaoId, aplicar }
    if (aplicar && !sangra) pedido.atributoId = atributoId
    const saiu = onPedir(pedido)
    setErro(saiu ? null : 'Não saiu: sem conexão com o mestre, ou o lembrete já foi respondido.')
  }
  return (
    <li className="bt-lembrete" data-tipo={lembrete.tipo}>
      <p className="bt-lembrete__texto" id={`${id}-texto`}>
        <span className="bt-lembrete__marca" aria-hidden="true" />
        {quem !== undefined && <span className="bt-lembrete__quem">{quem} · </span>}
        {sangra ? (
          <>
            <b>{item.porVez?.nome ?? 'Sangrando'}</b>
            <span className="bt-lembrete__det">
              {' '}
              · tira {item.porVez?.dano ?? DANO_DO_SANGRAMENTO} de HP direto, sem o Escudo{decide ? '' : ' · o mestre aplica'}
            </span>
          </>
        ) : (
          <>
            <b title={NOME_DA_PREPARACAO}>{NOME_DA_PREPARACAO}</b>
            <span className="bt-lembrete__det"> · vai fazer? +{BONUS_DA_PREPARACAO} num atributo até o fim do combate</span>
          </>
        )}
      </p>
      {!sangra && (
        <label className="bt-lembrete__det">
          Atributo{' '}
          <select value={atributoId} disabled={esperando} onChange={(evento) => {
              setErro(null)
              setAtributoId(evento.target.value)
            }}
          >
            <option value="">Escolha…</option>
            {atributos.map((atributo) => (
              <option key={atributo.id} value={atributo.id}>
                {atributo.nome}
              </option>
            ))}
          </select>
        </label>
      )}
      {decide && (
        <div className="bt-lembrete__acoes" role="group" aria-labelledby={`${id}-texto`}>
          <button type="button" className="bt-botao bt-botao--passiva" disabled={esperando || motivo !== null} aria-describedby={motivo === null ? undefined : `${id}-motivo`} onClick={() => pedir(true)}>
            {sangra ? `Aplicar · -${item.porVez?.dano ?? DANO_DO_SANGRAMENTO} HP` : `Fazer (+${BONUS_DA_PREPARACAO})`}
          </button>
          <button type="button" className="bt-botao" disabled={esperando} onClick={() => pedir(false)}>
            {sangra ? 'Pular' : 'Agora não'}
          </button>
        </div>
      )}
      {motivo !== null && (
        <p className="bt-lembrete__motivo" id={`${id}-motivo`}>
          {motivo}
        </p>
      )}
      {erro !== null && erro !== motivo && (
        <p className="bt-lembrete__motivo" role="alert">
          {erro}
        </p>
      )}
    </li>
  )
}

function UmLembrete({ item, sistema, aplicarLivre, esperando, onPedir }: Omit<LembretesDaPassivaProps, 'itens' | 'className'> & { item: LembreteDaPassivaNaTela }) {
  const { lembrete, passiva, alvos, quem } = item
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const botao = useRef<HTMLButtonElement>(null)
  const id = useId()
  const ativar = lembrete.tipo === 'ativar'
  // Conserto das fichas F1 (P6): o Aplicar da técnica mantida apaga quando o recurso não paga o custo por turno.
  const motivo = ativar ? (passiva.estado !== 'ativa' ? passiva.motivo : null) : (passiva.motivoDoAplicar ?? null)
  const custo = textoDoCusto(passiva.custo)
  const pagaPorVez = passiva.custo.tipo === 'valor' && passiva.custo.porTurno ? `paga ${passiva.custo.valor} ${passiva.custo.recurso.toUpperCase()}` : null
  const efeito = [passiva.porTurno === null ? null : textoDoPorTurno(passiva.porTurno, sistema), pagaPorVez].filter((parte) => parte !== null).join(' · ') || 'efeito a cada turno'
  const base = { tokenId: lembrete.tokenId, cartaoId: lembrete.cartaoId }

  const pedir = (pedido: PedidoDePassiva) => {
    if (esperando) return
    const saiu = onPedir(pedido)
    setErro(saiu ? null : 'Não saiu: sem conexão com o mestre, ou o lembrete já foi respondido.')
  }

  const sim = () => {
    if (!ativar) {
      pedir({ tipo: 'lembrete', ...base, aplicar: true })
      return
    }
    // Oponente ou custo a confirmar: o papel abre aqui embaixo; senão ativa com o selo sugerido.
    if (precisaPerguntar(passiva)) {
      setAberto((antes) => !antes)
      return
    }
    pedir({ tipo: 'passiva', ...base, ligar: true, custo: null, selo: passiva.selo })
  }

  return (
    <li className="bt-lembrete" data-tipo={lembrete.tipo}>
      <p className="bt-lembrete__texto" id={`${id}-texto`}>
        <span className="bt-lembrete__marca" aria-hidden="true" />
        {quem !== undefined && <span className="bt-lembrete__quem">{quem} · </span>}
        <b title={passiva.nome}>{nomeCurto(passiva)}</b>
        {ativar ? (
          <>
            {' '}
            pronta <span className="bt-lembrete__det">· {passiva.textoDoGatilho}</span>
          </>
        ) : (
          <span className="bt-lembrete__det"> · a cada turno: {efeito}</span>
        )}
      </p>
      <div className="bt-lembrete__acoes" role="group" aria-labelledby={`${id}-texto`}>
        <button
          ref={botao}
          type="button"
          className="bt-botao bt-botao--passiva"
          disabled={esperando || motivo !== null}
          aria-expanded={ativar && precisaPerguntar(passiva) ? aberto : undefined}
          aria-describedby={motivo === null ? undefined : `${id}-motivo`}
          onClick={sim}
        >
          {ativar ? `Ativar${custo === null || passiva.custo.tipo === 'pergunta' || precisaPerguntar(passiva) ? '' : ` · ${custo}`}${precisaPerguntar(passiva) ? '…' : ''}` : 'Aplicar'}
        </button>
        <button type="button" className="bt-botao" disabled={esperando} onClick={() => pedir({ tipo: 'lembrete', ...base, aplicar: false })}>
          {ativar ? 'Agora não' : 'Pular'}
        </button>
      </div>
      {motivo !== null && (
        <p className="bt-lembrete__motivo" id={`${id}-motivo`}>
          {motivo}
        </p>
      )}
      {erro !== null && (
        <p className="bt-lembrete__motivo" role="alert">
          {erro}
        </p>
      )}
      {aberto && (
        <PainelDaPassiva
          passiva={passiva}
          tokenId={lembrete.tokenId}
          alvos={alvos}
          sistema={sistema}
          aplicarLivre={aplicarLivre}
          esperando={esperando}
          onPedir={onPedir}
          onVoltar={() => {
            setAberto(false)
            botao.current?.focus()
          }}
          rotuloDoVoltar="Fechar"
          className="bt-lembrete__papel"
        />
      )}
    </li>
  )
}

/**
 * A faixa de lembretes: um por passiva esperando ("Ativar / Agora não" no
 * gatilho, "Aplicar / Pular" no começo da vez). Some quando não há nenhum.
 */
export function LembretesDaPassiva({ itens, className, ...resto }: LembretesDaPassivaProps) {
  if (itens.length === 0) return null
  return (
    <section className={['bt-lembretes', className].filter(Boolean).join(' ')} aria-label="Lembretes de passiva">
      <ul className="bt-lembretes__lista">
        {itens.map((item) =>
          'regra' in item ? (
            <UmLembreteDaRegra key={`${item.lembrete.tokenId}:${item.lembrete.chave}`} item={item} {...resto} />
          ) : 'custo' in item ? (
            <UmLembreteDoCusto key={`${item.lembrete.tokenId}:${item.lembrete.chave}`} item={item} esperando={resto.esperando} onPedir={resto.onPedir} />
          ) : (
            <UmLembrete key={`${item.lembrete.tokenId}:${item.lembrete.chave}`} item={item} {...resto} />
          ),
        )}
      </ul>
    </section>
  )
}
