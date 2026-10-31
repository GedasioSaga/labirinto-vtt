import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { CUSTO_MAX, NOME_DO_SELO_MAX, TURNOS_DO_SELO_MAX, type LembreteDaPassiva, type PedidoDePassiva, type SeloPedido } from '../../lib/batalha/combate'
import { cartaoDaVariante, temEscolha, variantesDe } from '../../lib/batalha/escolhaEEvolucao'
import { CAMPO_DO_EFEITO } from '../../lib/batalha/leituraDaFicha'
import { passivasDe, passivasLigadas, seloDaPassiva, textoDoPorTurno, type EstadoDaPassiva, type PassivaNaTira } from '../../lib/batalha/passivas'
import { alvosDeMod, ehNomeDeSelo, selosDoToken } from '../../lib/batalha/selos'
import type { CartaDaOrdem, TurnosDaCena } from '../../lib/batalha/turnos'
import type { CombateParaJogador } from '../../lib/batalha/vistaDoJogador'
import type { Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { lerInteiro, textoDoCusto, type AlvoNaMira, type OpcaoNaTela, type PipDaVez } from './dadosDoMenu'
import { LinhasDeMods, linhasDosMods, modsDasLinhas, resumoDasLinhas, type LinhaDeMod } from './LinhasDeMods'
import { CabecaDaVez, Tira, andarComSetas, semRolarDeLado } from './ListaDeTecnicas'
import { ChipsDaOpcao } from './MiraDoGolpe'
import './batalha.css'
import './combate.css'

/**
 * AS PASSIVAS NA BATALHA (tipos de habilidade F3, seções 4b e 6 do plano
 * docs/planos/batalha-tipos-de-habilidade-plano.md; decisões 3 e 4 do
 * usuário): a passiva NUNCA ativa sozinha.
 *
 *  - `PainelDaPassiva`: o papel de uma passiva (como o da forma): o gatilho,
 *    o efeito, o "a cada turno" e, desligada, em quem vai o selo (pedido
 *    antes quando o texto diz "escolhendo um oponente"), o custo que a ficha
 *    não fecha e o selo dourado sugerido, editável (nome, turnos e as linhas
 *    `LinhasDeMods`). Ativar cobra e põe o selo; ligada, Desligar o tira.
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

/** O texto do efeito que cabe no painel (a ficha às vezes traz parágrafos). */
const EFEITO_NO_PAINEL_MAX = 280

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

/** O efeito no painel; `texto` = o da opção escolhida (tipos de habilidade F4), senão o Efeito da ficha. */
function efeitoDaPassiva(passiva: PassivaNaTira, texto: string = (passiva.cartao.campos[CAMPO_DO_EFEITO] ?? '').trim()): string {
  if (texto === '-' || texto.toLowerCase() === 'passiva') return ''
  return texto.length <= EFEITO_NO_PAINEL_MAX ? texto : `${texto.slice(0, EFEITO_NO_PAINEL_MAX).trimEnd()}…`
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

/** O papel de uma passiva: a leitura e Ativar (com alvo, custo e selo editável) ou Desligar. */
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
  const campoDoAlvo = useRef<HTMLSelectElement>(null)
  const campoDoCusto = useRef<HTMLInputElement>(null)
  const botao = useRef<HTMLButtonElement>(null)

  const mods = alvosDeMod(sistema)
  const resumo = resumoDasLinhas(linhas, mods)
  const efeito = opcao === null || opcao.principal ? efeitoDaPassiva(passiva) : efeitoDaPassiva(passiva, opcao.texto)
  const motivo = ligada ? null : passiva.motivo
  const custo = textoDoCusto(passiva.custo)
  const podeAplicar = ligada && passiva.porTurno !== null && (aplicarLivre || passiva.lembrete?.tipo === 'porTurno')
  const turnosLidos = seloTurnos.trim() === '' ? null : lerInteiro(seloTurnos, TURNOS_DO_SELO_MAX)
  const ordenados = alvosOrdenados(alvos)

  // Abre com o foco no que ele precisa responder primeiro: o alvo, o custo ou o botão.
  useEffect(() => {
    if (!ligada && passiva.alvo === 'oponente') campoDoAlvo.current?.focus({ preventScroll: true })
    else if (!ligada && passiva.custo.tipo === 'pergunta') campoDoCusto.current?.focus({ preventScroll: true })
    else botao.current?.focus({ preventScroll: true })
    // Só ao abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      setErro(`Dê um nome ao selo (até ${NOME_DO_SELO_MAX} letras).`)
      return
    }
    if (seloTurnos.trim() !== '' && (turnosLidos === null || turnosLidos < 1)) {
      setErro(`Os turnos do selo vão de 1 a ${TURNOS_DO_SELO_MAX} (vazio = até desligar).`)
      return
    }
    const lidos = modsDasLinhas(linhas, mods)
    if ('erro' in lidos) {
      setErro(lidos.erro)
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

  const rotuloDoBotao = ligada ? `Desligar ${passiva.nome}` : `Ativar${custo === null || passiva.custo.tipo === 'pergunta' ? '' : ` · ${custo}`}`
  const classe = ['bt-mira', 'bt-papel', 'bt-passiva', className].filter(Boolean).join(' ')
  return (
    <form className={classe} onSubmit={enviar} onKeyDown={teclar} aria-labelledby={`${idBase}-nome`} noValidate>
      <p className="bt-mira__rot bt-passiva__rot">
        {ligada ? 'Passiva · ativa' : 'Passiva'}
        {passiva.forma !== undefined && <span> · {passiva.forma}</span>}
      </p>
      <h3 className="bt-mira__nome" id={`${idBase}-nome`}>
        {passiva.nome}
      </h3>
      <dl className="bt-passiva__leitura">
        <div>
          <dt>Gatilho</dt>
          <dd>
            {passiva.textoDoGatilho}
            {passiva.gatilho.tipo === 'requisito' && <small> · o app não confere: veja na mesa</small>}
            {passiva.estado === 'pronta' && <small> · já bateu</small>}
          </dd>
        </div>
        {custo !== null && (
          <div>
            <dt>Custo</dt>
            <dd>{passiva.custo.tipo === 'pergunta' ? `a ficha diz: ${passiva.custo.texto}` : custo}</dd>
          </div>
        )}
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
      {!ligada && opcoes !== null && <ChipsDaOpcao idBase={idBase} opcoes={opcoes} escolhida={opcao} onEscolher={escolherOpcao} />}
      {efeito !== '' && (ligada || opcoes === null) && <p className="bt-forma__texto">{efeito}</p>}
      {!ligada && (
        <>
          <label className="bt-linha-campo">
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
          {passiva.custo.tipo === 'pergunta' && (
            <label className="bt-linha-campo" title={`A ficha diz: ${passiva.custo.texto}`}>
              <span>Custo ({passiva.custo.recurso.toUpperCase()})</span>
              <input
                ref={campoDoCusto}
                className="bt-num"
                inputMode="numeric"
                value={custoTexto}
                placeholder="?"
                onChange={(evento) => {
                  setErro(null)
                  setCustoTexto(evento.target.value)
                }}
              />
            </label>
          )}
          <div className="bt-mira__selo" data-marcado="sim" data-natureza="passiva">
            <p className="bt-passiva__selo">
              Selo <span className="bt-selo" data-natureza="passiva">{seloNome.trim() || passiva.selo.nome}</span> · {textoDosTurnos(turnosLidos)}
              {resumo !== '' && <span className="bt-mira__selo-mods">{resumo}</span>}
              <small>pílula dourada na carta enquanto estiver ativa</small>
            </p>
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
                  placeholder="até desligar"
                  onChange={(evento) => {
                    setErro(null)
                    setSeloTurnos(evento.target.value)
                  }}
                />
              </label>
              <LinhasDeMods
                idBase={`${idBase}-selo`}
                linhas={linhas}
                alvos={mods}
                dica="lidas do Efeito; confira e ajuste"
                onMudar={(novas) => {
                  setErro(null)
                  setLinhas(novas)
                }}
              />
            </div>
          </div>
        </>
      )}
      {motivo !== null && (
        <p className="bt-mira__nota bt-forma__motivo" id={`${idBase}-motivo`}>
          {motivo}
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
          aria-describedby={motivo === null ? undefined : `${idBase}-motivo`}
        >
          {rotuloDoBotao} <kbd>Enter</kbd>
        </button>
        {podeAplicar && passiva.porTurno !== null && (
          <button type="button" className="bt-botao bt-botao--passiva" disabled={esperando} onClick={aplicar}>
            Aplicar {textoDoPorTurno(passiva.porTurno, sistema)}
          </button>
        )}
        {onVoltar !== undefined && (
          <button type="button" className="bt-botao" onClick={onVoltar}>
            {rotuloDoVoltar} <kbd>Esc</kbd>
          </button>
        )}
      </div>
      <p className="bt-mira__nota">Fora da vez, sem gastar ação. Desfazer na linha do registro volta tudo.</p>
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
                detalhe={item.motivo !== null && item.estado !== 'ativa' ? `${detalheDaPassiva(item)} · ${item.motivo}` : detalheDaPassiva(item)}
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

export interface LembreteNaTela {
  lembrete: LembreteDaPassiva
  passiva: PassivaNaTira
  /** Os alvos do ponto de vista do dono (para o oponente da passiva). */
  alvos: readonly AlvoDaPassiva[]
  /** "May": o nome do dono, quando a tela mostra lembretes de mais de uma ficha. */
  quem?: string
}

/** Junta os lembretes de um dono com as passivas dele (lembrete de passiva que sumiu da ficha fica de fora). */
export function lembretesNaTela(lembretes: readonly LembreteDaPassiva[] | undefined, passivas: readonly PassivaNaTira[], alvos: readonly AlvoDaPassiva[], quem?: string): LembreteNaTela[] {
  const itens: LembreteNaTela[] = []
  for (const lembrete of lembretes ?? []) {
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

function UmLembrete({ item, sistema, aplicarLivre, esperando, onPedir }: Omit<LembretesDaPassivaProps, 'itens' | 'className'> & { item: LembreteNaTela }) {
  const { lembrete, passiva, alvos, quem } = item
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const botao = useRef<HTMLButtonElement>(null)
  const id = useId()
  const ativar = lembrete.tipo === 'ativar'
  const motivo = ativar && passiva.estado !== 'ativa' ? passiva.motivo : null
  const custo = textoDoCusto(passiva.custo)
  const efeito = passiva.porTurno === null ? 'efeito a cada turno' : textoDoPorTurno(passiva.porTurno, sistema)
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
        {itens.map((item) => (
          <UmLembrete key={`${item.lembrete.tokenId}:${item.lembrete.chave}`} item={item} {...resto} />
        ))}
      </ul>
    </section>
  )
}
