import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ContextoDasFrases } from '../../../lib/condicoes/frasesDaCondicao'
import { NOMES_DOS_TIPOS_DE_DANO, TIPOS_DE_DANO, type CondicaoMontada, type PecaDaCondicaoDa, type TipoDeDano } from '../../../lib/condicoes/modelo'
import type { ConditionSymbol } from '../../../lib/tokenConditions'
import { Caixa, Escolher, Numero, Segmentos } from '../../batalha/editor/pecas/controlesDaPeca'
import type { OpcaoDaPeca } from '../../batalha/editor/pecas/vocabulario'
import { PastilhaDeCondicao } from '../../PastilhaDeCondicao'
import { FraseNaTela } from './PapelDaCondicao'
import { nomeNoContexto } from './pecas/vocabulario'
import { AJUSTES_DO_BONECO_PADRAO, ajustesQueContam, BONECO_BASE, type AjustesDoBoneco, type LinhaDoBoneco, type MotorDoBoneco, type ResultadoDoBoneco, type RodadaDoBoneco } from './registro'
import './editor.css'

/**
 * O BONECO (rework das condições, PLANO.md E6 a tela, D12; `blocoBoneco` do protótipo, prototipo.html:1119):
 * joga 2 a 5 rodadas com a condição do jeito que está, pelo mesmo motor da batalha (`MotorDoBoneco`, E5).
 * Só aparece o ajuste que a condição usa (`ajustesQueContam`): o golpe, a cura, o d20 do teste, a aura.
 * Refaz 150 ms depois da última mudança (o número que se digita não roda o motor a cada tecla). O d20 é
 * escolhido: o teste mostra a regra, não a sorte.
 */

/** Depois da última mudança, quanto espera para rodar o motor de novo (D12). */
const ESPERA_DO_BONECO_MS = 150
const RODADAS: readonly OpcaoDaPeca<string>[] = ['2', '3', '4', '5'].map((valor) => ({ valor, rotulo: valor }))
const DANO_DO_TESTE_MAX = 500
const TIPOS_NO_BONECO: readonly OpcaoDaPeca<TipoDeDano>[] = TIPOS_DE_DANO.map((tipo) => ({ valor: tipo, rotulo: tipo === 'qualquer' ? 'de qualquer tipo' : `de ${NOMES_DOS_TIPOS_DE_DANO[tipo]}` }))
const TIPOS_POR_VALOR: ReadonlyMap<string, TipoDeDano> = new Map(TIPOS_DE_DANO.map((tipo) => [tipo, tipo]))
const ROTULO_DA_LINHA: Readonly<Record<LinhaDoBoneco['tipo'], string>> = { dano: 'dano', cura: 'ganha', atr: 'atributo', cond: 'condição', nao: 'nota' }
const NOMES_DOS_ATRIBUTOS: Readonly<Record<string, string>> = {
  forca: 'Força',
  agilidade: 'Agilidade',
  percepcao: 'Percepção',
  resistencia: 'Resistência',
  intuicao: 'Intuição',
  espirito: 'Espírito',
  carisma: 'Carisma',
  determinacao: 'Determinação',
  velocidade: 'Velocidade',
  ca: 'CA',
  dano: 'Dano',
  alcance: 'Alcance',
}
const ESCUDO_DO_MEDIDOR = 60

/** "nenhuma", 1 … N: em que rodada chega o golpe, a cura, a vez de ele bater. */
function opcoesDeRodada(rodadas: number): OpcaoDaPeca<string>[] {
  return [{ valor: '0', rotulo: 'nenhuma' }, ...Array.from({ length: rodadas }, (_, indice) => ({ valor: String(indice + 1), rotulo: String(indice + 1) }))]
}

function ParteDoTeste({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="lb-cde-ajuste">
      <span className="lb-cde-ajuste__rot">{rotulo}</span>
      {children}
    </div>
  )
}

/** Um medidor de barra: o valor no fim da rodada, a barra cheia no máximo e a marca do de partida. */
function Medidor({ rotulo, valor, maximo, base, recurso }: { rotulo: string; valor: number; maximo: number; base?: number; recurso: 'vida' | 'sp' | 'escudo' | 'atr' }) {
  const fracao = maximo > 0 ? Math.min(1, Math.max(0, valor / maximo)) : 0
  const marca = base !== undefined && maximo > 0 ? Math.min(1, Math.max(0, base / maximo)) : null
  return (
    <div className="lb-cde-medidor">
      <div className="lb-cde-medidor__rot">
        <span>{rotulo}</span>
        <b>
          {valor}
          {base !== undefined && base !== valor && <small> de {base}</small>}
        </b>
      </div>
      <div className="lb-cde-medidor__barra" data-recurso={recurso} aria-hidden="true">
        <i style={{ transform: `scaleX(${fracao})` }} />
        {marca !== null && <s style={{ left: `${marca * 100}%` }} />}
      </div>
    </div>
  )
}

function Registro({ linhas }: { linhas: readonly LinhaDoBoneco[] }) {
  if (linhas.length === 0) return <p className="lb-cde-nota">Nada acontece.</p>
  return (
    <ol className="lb-cde-registro">
      {linhas.map((linha, indice) => (
        <li key={indice} data-tipo={linha.tipo}>
          <span>{ROTULO_DA_LINHA[linha.tipo]}</span>
          <span>
            <FraseNaTela frase={linha.frase} />
          </span>
        </li>
      ))}
    </ol>
  )
}

function estadoDaRodada(rodada: RodadaDoBoneco): string {
  if (rodada.ativa) return rodada.restam === null ? 'ativa' : `faltam ${rodada.restam}`
  return rodada.comecou ? 'saiu' : 'sem ela'
}

export interface BonecoDaCondicaoProps {
  condicao: CondicaoMontada
  pastilha: ConditionSymbol
  contexto: ContextoDasFrases
  /** O motor da batalha numa mesa em memória (E5, `ensaiarCondicao`). Ausente = o boneco ainda não joga. */
  motor?: MotorDoBoneco
  /** Para os ids de cada boneco na mesma tela (o editor e o lado da lista). */
  onde: string
}

type Ensaio = { tipo: 'ok'; resultado: ResultadoDoBoneco } | { tipo: 'erro'; texto: string } | { tipo: 'semMotor' }

function ensaiar(motor: MotorDoBoneco | undefined, condicao: CondicaoMontada, ajustes: AjustesDoBoneco, contexto: ContextoDasFrases): Ensaio {
  if (motor === undefined) return { tipo: 'semMotor' }
  try {
    return { tipo: 'ok', resultado: motor(condicao, ajustes, contexto) }
  } catch (erro) {
    return { tipo: 'erro', texto: erro instanceof Error ? erro.message : String(erro) }
  }
}

export function BonecoDaCondicao({ condicao, pastilha, contexto, motor, onde }: BonecoDaCondicaoProps) {
  const [ajustes, setAjustes] = useState<AjustesDoBoneco>(AJUSTES_DO_BONECO_PADRAO)
  // O que o motor roda: a condição e os ajustes de 150 ms atrás (D12). Nasce com o de agora.
  const [pedido, setPedido] = useState({ condicao, ajustes })
  useEffect(() => {
    if (pedido.condicao === condicao && pedido.ajustes === ajustes) return
    const espera = window.setTimeout(() => setPedido({ condicao, ajustes }), ESPERA_DO_BONECO_MS)
    return () => window.clearTimeout(espera)
  }, [condicao, ajustes, pedido])
  const ensaio = useMemo(() => ensaiar(motor, pedido.condicao, pedido.ajustes, contexto), [motor, pedido, contexto])
  const contam = ajustesQueContam(condicao)
  const mudar = <K extends keyof AjustesDoBoneco>(campo: K, valor: AjustesDoBoneco[K]) => setAjustes((antes) => ({ ...antes, [campo]: valor }))
  const rodada = (campo: 'golpeR' | 'curaR' | 'bateR' | 'deNovoR' | 'tentaR', rotulo: string) => (
    <Escolher rotulo={rotulo} valor={String(Math.min(ajustes[campo], ajustes.rodadas))} opcoes={opcoesDeRodada(ajustes.rodadas)} onChange={(valor) => mudar(campo, Number(valor))} />
  )
  const contra = condicao.pecas.find((peca): peca is PecaDaCondicaoDa<'contra'> => peca.tipo === 'contra')
  const jaEstava = contra?.apaga[0]
  const tituloId = `boneco-${onde}`
  const resultado = ensaio.tipo === 'ok' ? ensaio.resultado : null
  const usaSp = condicao.pecas.some((peca) => peca.tipo === 'vez' && peca.recurso === 'sp') || condicao.saidas.some((saida) => saida.tipo === 'pagar' && saida.paga === 'sp')
  const usaEscudo = resultado !== null && resultado.rodadas.some((linha) => linha.escudo > 0)
  return (
    <section className="lb-cde-boneco" aria-labelledby={tituloId}>
      <div className="lb-cde-boneco__cab">
        <b id={tituloId}>Testar no boneco</b>
        <small>
          vida {BONECO_BASE.vida}, SP {BONECO_BASE.sp}; refaz a cada mudança
        </small>
      </div>
      <div className="lb-cde-ajustes" role="group" aria-label="Ajustes do teste">
        <ParteDoTeste rotulo="Rodadas">
          <Segmentos rotulo="Rodadas" valor={String(ajustes.rodadas)} opcoes={RODADAS} onChange={(valor) => mudar('rodadas', Number(valor))} />
          {contam.d20 && (
            <>
              <span className="lb-cde-ajuste__rot">o d20 rola</span>
              <Numero rotulo="O d20 rola" valor={ajustes.d20} minimo={1} maximo={20} onChange={(valor) => mudar('d20', valor)} />
            </>
          )}
        </ParteDoTeste>
        {contam.golpe && (
          <ParteDoTeste rotulo="Na rodada">
            {rodada('golpeR', 'Rodada do golpe')}
            <span className="lb-cde-ajuste__rot">toma um golpe de</span>
            <Numero rotulo="Dano do golpe" valor={ajustes.golpeV} minimo={0} maximo={DANO_DO_TESTE_MAX} onChange={(valor) => mudar('golpeV', valor)} />
            <Escolher rotulo="Tipo do golpe" valor={ajustes.golpeTipo} opcoes={TIPOS_NO_BONECO} onChange={(valor) => mudar('golpeTipo', TIPOS_POR_VALOR.get(valor) ?? 'qualquer')} />
          </ParteDoTeste>
        )}
        {contam.cura && (
          <ParteDoTeste rotulo="Na rodada">
            {rodada('curaR', 'Rodada da cura')}
            <span className="lb-cde-ajuste__rot">recebe uma cura de</span>
            <Numero rotulo="Cura" valor={ajustes.curaV} minimo={0} maximo={DANO_DO_TESTE_MAX} onChange={(valor) => mudar('curaV', valor)} />
          </ParteDoTeste>
        )}
        {contam.bate && <ParteDoTeste rotulo="O boneco bate com 30 na rodada">{rodada('bateR', 'Rodada em que o boneco bate')}</ParteDoTeste>}
        {contam.deNovo && <ParteDoTeste rotulo="Ganha de novo na rodada">{rodada('deNovoR', 'Rodada em que ganha de novo')}</ParteDoTeste>}
        {contam.tenta && <ParteDoTeste rotulo="Na vez dele, tenta sair a partir da rodada">{rodada('tentaR', 'Rodada em que começa a tentar sair')}</ParteDoTeste>}
        {(contam.perto || (contam.ja && jaEstava !== undefined)) && (
          <div className="lb-cde-ajuste">
            {contam.perto && <Caixa rotulo="Um aliado dele está a 1 casa" marcado={ajustes.perto} onChange={(valor) => mudar('perto', valor)} />}
            {contam.ja && jaEstava !== undefined && <Caixa rotulo={`Ele já estava ${nomeNoContexto(jaEstava, contexto)}`} marcado={ajustes.ja} onChange={(valor) => mudar('ja', valor)} />}
          </div>
        )}
      </div>
      {ensaio.tipo === 'semMotor' && <p className="lb-cde-nota">O boneco joga com o motor da batalha, que ainda não chegou nesta versão. Os ajustes acima já valem quando ele chegar.</p>}
      {ensaio.tipo === 'erro' && (
        <p className="lb-cde-nota lb-cde-nota--erro" role="status">
          O boneco não conseguiu jogar: {ensaio.texto}
        </p>
      )}
      {resultado !== null && (
        <>
          <ol className="lb-cde-tempo" aria-label="Rodada a rodada: a pastilha some quando a condição sai">
            {resultado.rodadas.map((linha) => (
              <li key={linha.rodada} data-saiu={!linha.ativa && linha.comecou ? '' : undefined}>
                <span className="lb-cde-tempo__r">R{linha.rodada}</span>
                <span className="lb-cde-tempo__p">
                  {linha.ativa || linha.comecou ? <PastilhaDeCondicao symbol={pastilha} tamanho={26} /> : <span className="lb-cde-tempo__fora" />}
                  {linha.ativa && linha.pilhas > 1 && <em>{linha.pilhas}</em>}
                </span>
                <span className="lb-cde-tempo__v">{linha.vida}</span>
                <span className="lb-cde-tempo__e">{estadoDaRodada(linha)}</span>
              </li>
            ))}
          </ol>
          <div className="lb-cde-rodadas">
            <article className="lb-cde-rodada" aria-label="Ao pôr">
              <div className="lb-cde-rodada__cab">
                <h4>Ao pôr</h4>
                <span>antes da rodada 1</span>
              </div>
              <Registro linhas={resultado.entrada} />
            </article>
            {resultado.rodadas.map((linha) => (
              <RodadaNaTela key={linha.rodada} rodada={linha} todas={resultado.rodadas} nome={condicao.nome.trim() || 'A condição'} usaSp={usaSp} usaEscudo={usaEscudo} contexto={contexto} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function RodadaNaTela({ rodada, todas, nome, usaSp, usaEscudo, contexto }: { rodada: RodadaDoBoneco; todas: readonly RodadaDoBoneco[]; nome: string; usaSp: boolean; usaEscudo: boolean; contexto: ContextoDasFrases }) {
  const estado = rodada.ativa ? (rodada.restam === null ? `${nome} continua` : `${nome}: faltam ${rodada.restam}`) : rodada.comecou ? 'saiu nesta rodada' : 'sem a condição'
  const pilhas = rodada.ativa && rodada.pilhas > 1 ? `, ${rodada.pilhas} pilhas` : ''
  const outras = rodada.outras.length > 0 ? `; também ${rodada.outras.map((id) => nomeNoContexto(id, contexto)).join(', ')}` : ''
  return (
    <article className="lb-cde-rodada" data-fora={rodada.comecou ? undefined : ''} aria-label={`Rodada ${rodada.rodada}`}>
      <div className="lb-cde-rodada__cab">
        <h4>Rodada {rodada.rodada}</h4>
        <span>
          {estado}
          {pilhas}
          {outras}
        </span>
      </div>
      <div className="lb-cde-medidores">
        <Medidor rotulo="Vida" valor={rodada.vida} maximo={BONECO_BASE.vida} recurso="vida" />
        {usaSp && <Medidor rotulo="SP" valor={rodada.sp} maximo={BONECO_BASE.sp} recurso="sp" />}
        {usaEscudo && <Medidor rotulo="Escudo" valor={rodada.escudo} maximo={ESCUDO_DO_MEDIDOR} recurso="escudo" />}
        {rodada.atributos.map((atributo) => {
          const maximo = Math.max(atributo.base, ...todas.map((outra) => outra.atributos.find((igual) => igual.atr === atributo.atr)?.v ?? 0))
          return <Medidor key={atributo.atr} rotulo={NOMES_DOS_ATRIBUTOS[atributo.atr] ?? atributo.atr} valor={atributo.v} maximo={maximo} base={atributo.base} recurso="atr" />
        })}
      </div>
      <Registro linhas={rodada.linhas} />
    </article>
  )
}

