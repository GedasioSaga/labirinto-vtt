import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { BASICOS_ANUNCIADOS_MAX, BASICOS_ANUNCIADOS_MIN, CARGAS_KI_MAX, KI_OCULTO_MAX, TEXTO_DBT_MAX, type ExtrasDaAcao, type OpcaoDeAcao } from '../../../lib/dbt/batalha/tipos'
import { Interruptor, Stepper } from '../ficha/pecas'
import { BotaoDeOpcao, CustoDeKi } from './pecasDaBatalhaDBT'

/**
 * AS AÇÕES DA VEZ (seção 19, `MenuDeAcoesDBT`), no mestre e no jogador: a
 * lista de `OpcaoDeAcao` do motor, em grupos, cada uma com o custo de Ki e o
 * motivo quando não vale (nunca some). Ação sem alvo sai no clique; com alvo,
 * abre a escolha (lista, ou o mapa quando a mira existe) e os extras da
 * técnica. Enter usa, Esc volta.
 */

export interface CandidatoAoAlvo {
  id: string
  nome: string
  detalhe?: string
}

export interface TecnicaNoMenu {
  basica: boolean
  acumulacao: boolean
}

export interface MiraDoMenu {
  ligada: boolean
  onLigar: (ligar: boolean) => void
  /** A ficha clicada no mapa; `seq` muda a cada clique. */
  alvo: { tokenId: string; seq: number } | null
}

export interface MenuDeAcoesDBTProps {
  opcoes: readonly OpcaoDeAcao[]
  candidatos: (opcao: OpcaoDeAcao) => readonly CandidatoAoAlvo[]
  onAgir: (opcao: OpcaoDeAcao, alvos: readonly string[], extras: ExtrasDaAcao) => void
  /** Básica e Acumulação da técnica, para os extras; ausente = sem extras. */
  tecnica?: (tecnicaId: string) => TecnicaNoMenu | null
  /** Mais de 3 básicos só se anunciados antes do primeiro do turno (9.2). */
  podeAnunciarBasicos?: boolean
  mira?: MiraDoMenu
  ocupado?: boolean
}

interface Grupo {
  titulo: string
  opcoes: OpcaoDeAcao[]
}

function grupoDa(chave: string): string {
  const prefixo = chave.split(':')[0]
  if (prefixo === 'tecnica' || prefixo === 'carregar') return 'Técnicas'
  if (prefixo === 'transformar' || prefixo === 'destransformar') return 'Transformação'
  if (prefixo === 'voo') return 'Voo'
  return 'Outras ações'
}

function emGrupos(opcoes: readonly OpcaoDeAcao[]): Grupo[] {
  const grupos: Grupo[] = []
  for (const opcao of opcoes) {
    const titulo = grupoDa(opcao.chave)
    const grupo = grupos.find((candidato) => candidato.titulo === titulo)
    if (grupo === undefined) grupos.push({ titulo, opcoes: [opcao] })
    else grupo.opcoes.push(opcao)
  }
  return grupos
}

/** Marca ou desmarca o alvo: um só troca; vários somam até o teto. */
function comAlvo(atuais: readonly string[], id: string, maximo: number): readonly string[] {
  if (atuais.includes(id)) return atuais.filter((outro) => outro !== id)
  if (maximo <= 1) return [id]
  return atuais.length >= maximo ? atuais : [...atuais, id]
}

/** Ação Oculta pede texto e Ki; o resto sem alvo sai no clique. */
function precisaDeFormulario(opcao: OpcaoDeAcao): boolean {
  return opcao.alvo !== 'nenhum' || opcao.chave === 'oculta'
}

export function MenuDeAcoesDBT({ opcoes, candidatos, onAgir, tecnica, podeAnunciarBasicos = false, mira, ocupado = false }: MenuDeAcoesDBTProps) {
  const [escolhida, setEscolhida] = useState<OpcaoDeAcao | null>(null)

  // A opção escolhida sumiu ou travou (o turno mudou por fora): volta à lista.
  const viva = escolhida === null ? null : (opcoes.find((opcao) => opcao.chave === escolhida.chave && opcao.bloqueio === null) ?? null)
  useEffect(() => {
    if (escolhida !== null && viva === null) setEscolhida(null)
  }, [escolhida, viva])

  if (viva !== null) {
    return (
      <FormularioDaAcao
        key={viva.chave}
        opcao={viva}
        candidatos={candidatos(viva)}
        tecnica={viva.tecnicaId === null ? null : (tecnica?.(viva.tecnicaId) ?? null)}
        podeAnunciarBasicos={podeAnunciarBasicos}
        mira={mira}
        ocupado={ocupado}
        onVoltar={() => setEscolhida(null)}
        onUsar={(alvos, extras) => {
          onAgir(viva, alvos, extras)
          setEscolhida(null)
        }}
      />
    )
  }

  return (
    <div className="dbb-grupo">
      {emGrupos(opcoes).map((grupo) => (
        <div key={grupo.titulo} className="dbb-grupo" role="group" aria-label={grupo.titulo}>
          <p className="dbb-grupo__t" aria-hidden="true">
            {grupo.titulo}
          </p>
          <ul className="dbb-ops">
            {grupo.opcoes.map((opcao) => (
              <li key={opcao.chave}>
                <BotaoDeOpcao
                  rotulo={opcao.rotulo}
                  ki={opcao.ki}
                  gratis={opcao.gratis}
                  bloqueio={ocupado && opcao.bloqueio === null ? 'Enviando…' : opcao.bloqueio}
                  onEscolher={() => (precisaDeFormulario(opcao) ? setEscolhida(opcao) : onAgir(opcao, [], {}))}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function FormularioDaAcao({
  opcao,
  candidatos,
  tecnica,
  podeAnunciarBasicos,
  mira,
  ocupado,
  onVoltar,
  onUsar,
}: {
  opcao: OpcaoDeAcao
  candidatos: readonly CandidatoAoAlvo[]
  tecnica: TecnicaNoMenu | null
  podeAnunciarBasicos: boolean
  mira: MiraDoMenu | undefined
  ocupado: boolean
  onVoltar: () => void
  onUsar: (alvos: readonly string[], extras: ExtrasDaAcao) => void
}) {
  const [alvos, setAlvos] = useState<readonly string[]>(() => (candidatos.length === 1 && opcao.alvo !== 'nenhum' ? [candidatos[0].id] : []))
  const [anunciar, setAnunciar] = useState(false)
  const [basicos, setBasicos] = useState(BASICOS_ANUNCIADOS_MIN)
  const [cargas, setCargas] = useState(0)
  const [agarrar, setAgarrar] = useState(false)
  const [texto, setTexto] = useState('')
  const [kiOculto, setKiOculto] = useState(0)
  const caixa = useRef<HTMLFormElement>(null)
  const multiplos = opcao.alvosMax > 1

  const alternarAlvo = (id: string) => setAlvos((atuais) => comAlvo(atuais, id, opcao.alvosMax))

  // O clique no mapa marca (ou desmarca) o alvo, se ele está entre os candidatos.
  const ultimoSeq = useRef(mira?.alvo?.seq ?? 0)
  const alvoDoMapa = mira?.alvo
  const alvosMax = opcao.alvosMax
  useEffect(() => {
    if (alvoDoMapa === null || alvoDoMapa === undefined || alvoDoMapa.seq === ultimoSeq.current) return
    ultimoSeq.current = alvoDoMapa.seq
    if (candidatos.some((candidato) => candidato.id === alvoDoMapa.tokenId)) setAlvos((atuais) => comAlvo(atuais, alvoDoMapa.tokenId, alvosMax))
  }, [alvoDoMapa, candidatos, alvosMax])

  // Fechar o formulário desliga a mira (o clique no mapa volta a ser do editor).
  const desligarMira = useRef(mira?.onLigar)
  desligarMira.current = mira?.onLigar
  useEffect(() => () => desligarMira.current?.(false), [])

  useEffect(() => {
    caixa.current?.querySelector<HTMLElement>('button, input, textarea')?.focus()
  }, [])

  const tecnicaDeAtaque = opcao.chave.startsWith('tecnica:') && opcao.alvo === 'inimigo'
  const faltaAlvo = opcao.alvo !== 'nenhum' && alvos.length === 0
  const oculta = opcao.chave === 'oculta'

  const usar = (evento: FormEvent) => {
    evento.preventDefault()
    if (faltaAlvo || ocupado) return
    const extras: ExtrasDaAcao = {}
    if (tecnicaDeAtaque && agarrar) extras.modo = 'agarrar'
    if (tecnica?.basica === true && anunciar) extras.basicos = basicos
    if (tecnica?.acumulacao === true && cargas > 0) extras.cargasKi = cargas
    if (oculta) {
      extras.textoOculto = texto.trim()
      extras.kiOculto = kiOculto
    }
    onUsar(alvos, extras)
  }

  const teclas = (evento: KeyboardEvent<HTMLFormElement>) => {
    if (evento.key !== 'Escape') return
    evento.preventDefault()
    evento.stopPropagation()
    onVoltar()
  }

  return (
    <form ref={caixa} className="dbb-cartao dbb-cartao--calmo" onSubmit={usar} onKeyDown={teclas} aria-label={opcao.rotulo}>
      <p className="dbb-cartao__t">
        {opcao.rotulo} <CustoDeKi ki={opcao.ki} gratis={opcao.gratis} />
      </p>
      {opcao.alvo !== 'nenhum' && (
        <div className="dbb-grupo">
          <p className="dbb-grupo__t" id={`alvo-${opcao.chave}`}>
            {multiplos ? `Alvos (até ${opcao.alvosMax})` : opcao.alvo === 'aliado' ? 'Em qual aliado' : 'Em quem'}
          </p>
          {candidatos.length === 0 ? (
            <p className="dbb-cartao__d">Ninguém pode ser alvo desta ação agora.</p>
          ) : (
            <div className="dbb-alvos" role="group" aria-labelledby={`alvo-${opcao.chave}`}>
              {candidatos.map((candidato) => (
                <button key={candidato.id} type="button" className="dbb-alvo" aria-pressed={alvos.includes(candidato.id)} onClick={() => alternarAlvo(candidato.id)}>
                  {candidato.nome}
                  {candidato.detalhe !== undefined && <small>{candidato.detalhe}</small>}
                </button>
              ))}
            </div>
          )}
          {mira !== undefined && candidatos.length > 0 && (
            <Interruptor ligado={mira.ligada} onTrocar={() => mira.onLigar(!mira.ligada)}>
              Escolher no mapa
            </Interruptor>
          )}
        </div>
      )}
      {tecnicaDeAtaque && !multiplos && (
        <Interruptor ligado={agarrar} onTrocar={() => setAgarrar(!agarrar)}>
          Agarrar em vez de causar dano
        </Interruptor>
      )}
      {tecnica?.basica === true && podeAnunciarBasicos && (
        <div className="dbb-campos">
          <Interruptor ligado={anunciar} onTrocar={() => setAnunciar(!anunciar)}>
            Anunciar mais de 3 básicos
          </Interruptor>
          {anunciar && (
            <Stepper
              rotulo="básicos anunciados"
              valor={basicos}
              onMenos={() => setBasicos(Math.max(BASICOS_ANUNCIADOS_MIN, basicos - 1))}
              onMais={() => setBasicos(Math.min(BASICOS_ANUNCIADOS_MAX, basicos + 1))}
              podeMenos={basicos > BASICOS_ANUNCIADOS_MIN}
              podeMais={basicos < BASICOS_ANUNCIADOS_MAX}
            />
          )}
        </div>
      )}
      {tecnica?.acumulacao === true && (
        <span className="dbb-campo">
          Cargas por Ki (cada uma soma o Ki da técnica)
          <Stepper rotulo="cargas por Ki" valor={cargas} onMenos={() => setCargas(Math.max(0, cargas - 1))} onMais={() => setCargas(Math.min(CARGAS_KI_MAX, cargas + 1))} podeMenos={cargas > 0} podeMais={cargas < CARGAS_KI_MAX} />
        </span>
      )}
      {oculta && (
        <div className="dbb-grupo">
          <label className="dbf-fld">
            O que ele prepara (só o mestre lê)
            <textarea className="dbf-inp dbf-area" value={texto} maxLength={TEXTO_DBT_MAX} onChange={(evento) => setTexto(evento.target.value)} />
          </label>
          <span className="dbb-campo">
            Ki reservado
            <Stepper rotulo="Ki da Ação Oculta" valor={kiOculto} onMenos={() => setKiOculto(Math.max(0, kiOculto - 1))} onMais={() => setKiOculto(Math.min(KI_OCULTO_MAX, kiOculto + 1))} podeMenos={kiOculto > 0} podeMais={kiOculto < KI_OCULTO_MAX} />
          </span>
        </div>
      )}
      <div className="dbb-cartao__acoes">
        <button type="submit" className="dbf-btn dbf-btn--pri" disabled={faltaAlvo || ocupado} aria-keyshortcuts="Enter">
          {ocupado ? 'Enviando…' : faltaAlvo ? 'Escolha o alvo' : 'Usar'}
        </button>
        <button type="button" className="dbf-btn dbf-btn--ghost" onClick={onVoltar} aria-keyshortcuts="Escape">
          Voltar
        </button>
      </div>
    </form>
  )
}
