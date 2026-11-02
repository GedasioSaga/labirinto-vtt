import { useEffect, useRef, useState } from 'react'
import type { ExtrasDaAcao, OpcaoDaPendencia, OpcaoDeAcao } from '../../../lib/dbt/batalha/tipos'
import type { CartaDBT, DeclaracaoDBT, JanelaDBTParaJogador, PendenciaDBTParaJogador, VistaDBT } from '../../../lib/dbt/batalha/vista'
import '../ficha/fichaDBT.css'
import './batalhaDBT.css'
import { CaixaDeReacaoDBT, type GolpeNaTela } from './CaixaDeReacaoDBT'
import { NOME_DO_VOO } from './dadosDaBatalhaDBT'
import { MenuDeAcoesDBT, type CandidatoAoAlvo, type MiraDoMenu, type TecnicaNoMenu } from './MenuDeAcoesDBT'
import { BarraDeRecurso, RespostasDaPendencia, Secao, type ExtraDaResposta } from './pecasDaBatalhaDBT'
import { RegistroDBT, linhasDoJogadorDBT } from './RegistroDBT'

/**
 * A BATALHA DBT NA TELA DO JOGADOR (seção 19, `BatalhaDoJogadorDBT`): o
 * menu da vez à esquerda (as fichas dele, o Ki que voltou no início do
 * turno, "transformar antes?", as respostas que esperam por ele, as ações
 * com o custo de Ki e o registro público) e a caixa de reação embaixo no
 * meio quando um golpe cai nele ou num aliado. Lê só a `VistaDBT` que o host
 * recortou (sem d20 do mestre, sem PV, CA e Ki de quem ele não vê) e só
 * envia chave de opção: nenhum número de regra sai daqui.
 */

/** A resposta do host (`batalhaDBT.resultado`); `void` = o envio não espera, a recusa chega por `recusa`. */
export type RespostaDoEnvioDBT = void | { ok: boolean; motivo?: string }
type Envio<P> = (pedido: P) => RespostaDoEnvioDBT | Promise<RespostaDoEnvioDBT>

/** Os pedidos do jogador, um por mensagem `batalhaDBT.*` (o `reqId` é da rede). */
export interface EnvioDaBatalhaDBT {
  declarar: Envio<{ combatenteId: string; transformacaoId: string | null }>
  agir: Envio<{ combatenteId: string; vez: { rodada: number; turno: number }; opcao: string; alvos: string[]; extras?: ExtrasDaAcao }>
  responder: Envio<{ pendenciaId: string; combatenteId: string; opcao: string; aposta?: number; atributo?: 'des' | 'for' }>
  passar: Envio<{ combatenteId: string; rodada: number; turno: number }>
  desfazer: Envio<string>
}

export interface BatalhaDoJogadorDBTProps {
  /** O recorte do host (`batalhaDBT.estado`); desmonte quando ele vira null. */
  vista: VistaDBT
  enviar: EnvioDaBatalhaDBT
  /** A última recusa do host, quando o envio não devolve resposta. */
  recusa?: string | null
  /** Tocar na ficha do mapa escolhe o alvo (o mapa liga `aoEscolherFicha` enquanto `ligada`). */
  mira?: MiraDoMenu
  /**
   * Básica e Acumulação de uma técnica da ficha dele (`lerFichaParaBatalha(personagem, sistema)?.tecnicas`),
   * para anunciar básicos (9.2) e a Carga por Ki. Ausente = o menu não mostra esses extras.
   */
  tecnicaDoPersonagem?: (personagemId: string, tecnicaId: string) => TecnicaNoMenu | null
}

function golpeDaJanela(janela: JanelaDBTParaJogador): GolpeNaTela {
  return { atacante: janela.atacante, alvo: janela.alvo, tecnica: janela.tecnica, total: null, d20: null, ca: null, faixa: janela.faixa, critico: janela.critico, dano: janela.danoPrevisto }
}

/**
 * A carta é do lado de quem age? O recorte do host diz em `mesmoLado` quando
 * o traz (o lado escolhido em "Quem entra na batalha?"); sem o campo, vale o
 * `lado` da vista ("outro" = do outro lado).
 */
function doMesmoLado(carta: CartaDBT): boolean {
  if ('mesmoLado' in carta && typeof carta.mesmoLado === 'boolean') return carta.mesmoLado
  return carta.lado !== 'outro'
}

function candidatosDaVista(cartas: readonly CartaDBT[], atorId: string, alvo: OpcaoDeAcao['alvo']): CandidatoAoAlvo[] {
  const vivas = cartas.filter((carta) => carta.situacao !== 'morto' && carta.tokenId !== atorId)
  const escolhidas = alvo === 'inimigo' ? vivas.filter((carta) => !doMesmoLado(carta)) : alvo === 'aliado' ? vivas.filter(doMesmoLado) : alvo === 'qualquer' ? vivas : []
  return escolhidas.map((carta) => ({ id: carta.tokenId, nome: carta.nome, ...(carta.pv === null ? {} : { detalhe: `PV ${carta.pv.atual}/${carta.pv.max}` }) }))
}

type KiQueVoltou = ReadonlyMap<string, { de: number; para: number }>

interface FotoDoTurno {
  rodada: number
  n: number
  vez: string | null
  pk: ReadonlyMap<string, number>
}

/** Turno novo para a frente: a recarga (7.2) chega no mesmo estado que troca a vez. Voltar (desfazer) não conta. */
function turnoAvancou(antes: FotoDoTurno, vista: VistaDBT): boolean {
  if (vista.fase !== 'combate' || vista.vez === null) return false
  if (vista.rodada !== antes.rodada) return vista.rodada > antes.rodada
  return vista.vez !== antes.vez && vista.turno.n > antes.n
}

/**
 * "Ki recarregou": o Ki de um combatente dele subiu no estado em que a vez
 * chegou a ele (início do turno, 7.2), mesmo com uma pendência de início
 * de turno na frente. Ki devolvido por desfazer no meio do turno não conta.
 * Some quando a vez passa a outro.
 */
function useKiQueVoltou(vista: VistaDBT): KiQueVoltou {
  const anterior = useRef<FotoDoTurno | null>(null)
  const [voltou, setVoltou] = useState<KiQueVoltou>(() => new Map())
  useEffect(() => {
    const antes = anterior.current
    const chegou = new Map<string, { de: number; para: number }>()
    if (antes !== null && turnoAvancou(antes, vista)) {
      const meu = vista.meus.find((candidato) => candidato.tokenId === vista.vez)
      const pkAntes = meu === undefined ? undefined : antes.pk.get(meu.tokenId)
      if (meu !== undefined && pkAntes !== undefined && meu.pk.atual > pkAntes) chegou.set(meu.tokenId, { de: pkAntes, para: meu.pk.atual })
    }
    anterior.current = { rodada: vista.rodada, n: vista.turno.n, vez: vista.vez, pk: new Map(vista.meus.map((meu) => [meu.tokenId, meu.pk.atual])) }
    setVoltou((atual) => {
      const seguem = new Map([...atual].filter(([id]) => id === vista.vez))
      for (const [id, valor] of chegou) seguem.set(id, valor)
      return seguem.size === atual.size && chegou.size === 0 ? atual : seguem
    })
  }, [vista])
  return voltou
}

/** Quando cada janela apareceu na tela dele, para o "a mesa espera há". */
function useDesde(ids: readonly string[]): ReadonlyMap<string, number> {
  const [desde, setDesde] = useState<ReadonlyMap<string, number>>(() => new Map())
  const chave = ids.join('|')
  useEffect(() => {
    setDesde((atual) => {
      const agora = Date.now()
      const novo = new Map<string, number>()
      for (const id of chave === '' ? [] : chave.split('|')) novo.set(id, atual.get(id) ?? agora)
      return novo
    })
  }, [chave])
  return desde
}

export function BatalhaDoJogadorDBT({ vista, enviar, recusa = null, mira, tecnicaDoPersonagem }: BatalhaDoJogadorDBTProps) {
  const [ocupado, setOcupado] = useState(false)
  const [minhaRecusa, setMinhaRecusa] = useState<string | null>(null)
  const [verRegistro, setVerRegistro] = useState(false)
  const [desfazendo, setDesfazendo] = useState<string | null>(null)
  // O turno em que ele já usou um básico: anunciar mais de 3 só antes do 1º (9.2). Se o mestre agiu por ele, o host recusa e diz.
  const [basicoNoTurno, setBasicoNoTurno] = useState<string | null>(null)
  const kiVoltou = useKiQueVoltou(vista)
  const { janela } = vista
  // A reação da janela aberta vai para a caixa embaixo; o resto fica no menu.
  const reacoes = janela === null ? [] : vista.pendencias.filter((pendencia) => pendencia.tipo === 'reacao' && pendencia.id === janela.pendenciaId)
  const outras = vista.pendencias.filter((pendencia) => !reacoes.includes(pendencia))
  const desde = useDesde(reacoes.map((pendencia) => pendencia.id))

  /** true = enviado sem recusa (sem resposta do host conta como enviado). */
  const executar = async (fazer: () => RespostaDoEnvioDBT | Promise<RespostaDoEnvioDBT>): Promise<boolean> => {
    setOcupado(true)
    try {
      const resposta = await fazer()
      const recusado = resposta !== undefined && !resposta.ok
      setMinhaRecusa(recusado ? (resposta.motivo ?? 'O mestre recusou o pedido.') : null)
      return !recusado
    } catch {
      setMinhaRecusa('Sem conexão com o mestre. Tente de novo.')
      return false
    } finally {
      setOcupado(false)
    }
  }

  const responder = (pendencia: PendenciaDBTParaJogador) => (opcao: OpcaoDaPendencia, extra: ExtraDaResposta) =>
    void executar(() => enviar.responder({ pendenciaId: pendencia.id, combatenteId: pendencia.combatenteId, opcao: opcao.chave, ...extra }))

  const nomeDe = (tokenId: string) => vista.meus.find((meu) => meu.tokenId === tokenId)?.nome ?? vista.cartas.find((carta) => carta.tokenId === tokenId)?.nome ?? tokenId
  const naVez = vista.meus.find((meu) => meu.vez !== null) ?? null
  const vezDele = naVez?.vez ?? null
  const nomeDaVez = vista.vez === null ? null : nomeDe(vista.vez)
  const textoDaRecusa = minhaRecusa ?? recusa
  const registro = linhasDoJogadorDBT(vista.registro)
  const chaveDaVez = naVez === null || vezDele === null ? null : `${naVez.tokenId}-${vezDele.rodada}-${vezDele.turno}`
  const tecnicaDaVez = naVez === null || tecnicaDoPersonagem === undefined ? undefined : (tecnicaId: string) => tecnicaDoPersonagem(naVez.personagemId, tecnicaId)

  return (
    <>
      <aside className="dbf dbb dbb-jogador-menu" aria-label="Batalha">
        <div className="dbb-leitura">
          <span className="dbb-leitura__rodada" aria-label={vista.fase === 'iniciativa' ? 'Iniciativa' : `Rodada ${vista.rodada}`}>
            <b aria-hidden="true">{vista.fase === 'iniciativa' ? '0' : vista.rodada}</b>
            <span aria-hidden="true">{vista.fase === 'iniciativa' ? 'iniciativa' : 'rodada'}</span>
          </span>
          <p className="dbb-leitura__vez">
            {vista.fase === 'iniciativa' ? 'Antes do combate' : naVez !== null ? `Sua vez: ${naVez.nome}` : nomeDaVez === null ? 'Batalha' : `Vez de ${nomeDaVez}`}
            {vista.fase === 'combate' && (
              <small>
                Turno {vista.turno.n} de {vista.turno.m}
                {vista.modo === 'manual' ? ', o mestre confirma cada golpe' : ''}
              </small>
            )}
          </p>
        </div>

        {vista.meus.map((meu) => {
          const voltou = kiVoltou.get(meu.tokenId)
          return (
            <div key={meu.tokenId} className="dbb-sec">
              <span className="dbb-carta__nome">
                {meu.nome}
                <small>
                  EP {meu.epTotal}, CA {meu.ca}
                  {meu.transformacao !== null ? `, ${meu.transformacao.nome}` : ''}
                  {meu.voo !== 0 ? `, ${NOME_DO_VOO[meu.voo]}` : ''}
                </small>
              </span>
              <span className="dbb-recursos">
                <BarraDeRecurso tipo="pv" atual={meu.pv.atual} max={meu.pv.max} />
                <BarraDeRecurso tipo="pk" atual={meu.pk.atual} max={meu.pk.max} />
              </span>
              {voltou !== undefined && (
                <p className="dbb-ki-volta" role="status">
                  Ki recarregou: {voltou.de} → {voltou.para}
                </p>
              )}
            </div>
          )
        })}

        {textoDaRecusa !== null && (
          <p className="dbb-status" role="status">
            {textoDaRecusa}
          </p>
        )}

        {vista.declaracoes.map((declaracao) => (
          <Declaracao
            key={declaracao.combatenteId}
            declaracao={declaracao}
            nome={nomeDe(declaracao.combatenteId)}
            ocupado={ocupado}
            onDeclarar={(transformacaoId) => void executar(() => enviar.declarar({ combatenteId: declaracao.combatenteId, transformacaoId }))}
          />
        ))}

        {outras.map((pendencia) => (
          <section key={`${pendencia.id}-${pendencia.combatenteId}`} className={pendencia.ativa ? 'dbb-cartao' : 'dbb-cartao dbb-cartao--calmo'} aria-label={pendencia.texto}>
            <p className="dbb-cartao__t">{pendencia.texto}</p>
            {vista.meus.length > 1 && <p className="dbb-cartao__d">Responde: {nomeDe(pendencia.combatenteId)}</p>}
            {pendencia.ativa ? (
              <RespostasDaPendencia opcoes={pendencia.opcoes} ocupado={ocupado} onResponder={responder(pendencia)} />
            ) : (
              <p className="dbb-espera">Na fila: responde quando chegar a vez desta.</p>
            )}
          </section>
        ))}

        {vista.aguardando !== null && (
          <p className="dbb-espera" role="status">
            {vista.aguardando}
          </p>
        )}

        {naVez !== null && vezDele !== null && chaveDaVez !== null && (
          <Secao titulo={vista.meus.length > 1 ? `Ações de ${naVez.nome}` : 'Suas ações'} nota={`andou ${naVez.deslocamento.andou} de ${naVez.deslocamento.casas} casas`}>
            <MenuDeAcoesDBT
              key={chaveDaVez}
              opcoes={naVez.acoes}
              candidatos={(opcao) => candidatosDaVista(vista.cartas, naVez.tokenId, opcao.alvo)}
              tecnica={tecnicaDaVez}
              podeAnunciarBasicos={basicoNoTurno !== chaveDaVez}
              mira={mira}
              ocupado={ocupado}
              onAgir={(opcao, alvos, extras) => {
                const basica = opcao.tecnicaId !== null && tecnicaDaVez?.(opcao.tecnicaId)?.basica === true
                void executar(() => enviar.agir({ combatenteId: naVez.tokenId, vez: vezDele, opcao: opcao.chave, alvos: [...alvos], extras })).then((enviado) => {
                  if (enviado && basica) setBasicoNoTurno(chaveDaVez)
                })
              }}
            />
            <div className="dbb-cartao__acoes">
              <button
                type="button"
                className="dbf-btn dbf-btn--sm"
                disabled={ocupado}
                onClick={() => void executar(() => enviar.passar({ combatenteId: naVez.tokenId, rodada: vezDele.rodada, turno: vezDele.turno }))}
              >
                Passar a vez
              </button>
            </div>
          </Secao>
        )}

        <div className="dbb-sec">
          <button type="button" className="dbf-btn dbf-btn--sm dbf-btn--ghost" aria-expanded={verRegistro} onClick={() => setVerRegistro(!verRegistro)}>
            {verRegistro ? 'Esconder o registro' : `Registro (${registro.length})`}
          </button>
          {verRegistro && (
            <RegistroDBT
              linhas={registro}
              desfazendo={desfazendo}
              onDesfazer={(linhaId) => {
                setDesfazendo(linhaId)
                void executar(() => enviar.desfazer(linhaId)).finally(() => setDesfazendo(null))
              }}
            />
          )}
        </div>
      </aside>

      {janela !== null && reacoes.length > 0 && (
        <div className="dbf dbb dbb-jogador-reacao">
          {reacoes.map((pendencia) => (
            <CaixaDeReacaoDBT
              key={`${pendencia.id}-${pendencia.combatenteId}`}
              golpe={golpeDaJanela(janela)}
              reator={nomeDe(pendencia.combatenteId)}
              opcoes={pendencia.opcoes}
              desde={desde.get(pendencia.id) ?? null}
              ocupado={ocupado}
              onResponder={responder(pendencia)}
            />
          ))}
        </div>
      )}
    </>
  )
}

/** "Transformar antes do primeiro turno?" (5.1): o custo sai do Ki inicial, e é 0 com 20 natural na iniciativa. */
function Declaracao({ declaracao, nome, ocupado, onDeclarar }: { declaracao: DeclaracaoDBT; nome: string; ocupado: boolean; onDeclarar: (transformacaoId: string | null) => void }) {
  return (
    <section className="dbb-cartao" aria-label={`Transformação de ${nome}`}>
      <p className="dbb-cartao__t">{nome}: transformar antes do primeiro turno?</p>
      <p className="dbb-cartao__d">O EP da forma já soma na iniciativa. O custo sai do Ki inicial, e com 20 natural sai de graça.</p>
      <div className="dbb-cartao__acoes">
        <button type="button" className="dbf-btn dbf-btn--sm" disabled={ocupado} onClick={() => onDeclarar(null)}>
          Sem transformação
        </button>
        {declaracao.formas.map((forma) => (
          <button key={forma.id} type="button" className="dbf-btn dbf-btn--sm" disabled={ocupado} onClick={() => onDeclarar(forma.id)}>
            {forma.nome} ({forma.ki} Ki)
          </button>
        ))}
      </div>
    </section>
  )
}
