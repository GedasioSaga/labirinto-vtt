import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { melhorGolpe, NOME_DO_PESO, type PesoDoEncontro } from '../../lib/livros/encontro'
import type { Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import {
  ajustarFicha,
  escudoDe,
  hpMaximo,
  LUTAS_DA_CONFERENCIA,
  LUTAS_POR_TENTATIVA,
  NOME_DO_BOTAO,
  type AvisoDoAchar,
  type BalancoDaSerie,
  type PropostaDoAchar,
  type VagaNoBalanco,
} from '../../lib/treino/balanceadorComum'
import type { Guardado, PropostaGuardada } from '../../stores/balanceadorStore'
import { formatarNumero } from './comum'
import { IconeDoMundo, type NomeDoIconeDoMundo } from './icones'

/**
 * O RESULTADO DO "TESTAR A LUTA" E O CARTÃO DA PROPOSTA (protótipo aprovado,
 * docs/design/balanceamento/): veredito, o que mudar, quanto dura, técnicas
 * mais usadas, ficha por ficha, luta típica e a semente; e o "Achei: Urso
 * com HP 1.660" com a conferência e o Aplicar.
 */

const TETO_DE_TURNOS = 30
const ORDEM_DO_PESO: readonly PesoDoEncontro[] = ['facil', 'justo', 'duro', 'mortal']

function pct(fracao: number): string {
  return `${Math.round(fracao * 100)}%`
}

function umaCasa(valor: number): string {
  return formatarNumero(Math.round(valor * 10) / 10)
}

function pesoDoBalanco(balanco: BalancoDaSerie): PesoDoEncontro {
  const vitoria = balanco.vitorias.a / balanco.n
  const aliados = balanco.vagas.filter((vaga) => vaga.lado === 'a')
  const quedas = aliados.reduce((soma, vaga) => soma + vaga.caiu, 0) / Math.max(1, aliados.length)
  if (vitoria >= 0.9) return quedas >= 0.34 ? 'justo' : 'facil'
  if (vitoria >= 0.65) return 'justo'
  if (vitoria >= 0.4) return 'duro'
  return 'mortal'
}

function fraseDoVeredito(balanco: BalancoDaSerie): string {
  const { n } = balanco
  const a = balanco.vitorias.a / n
  const b = balanco.vitorias.b / n
  const empate = balanco.vitorias.empate / n
  const duracao = `em ${umaCasa(balanco.mediana)} turnos (mediana)`
  if (a >= b && a >= empate) return `Os aliados vencem ${pct(a)} das lutas, ${duracao}.`
  if (b >= empate) return `Os inimigos vencem ${pct(b)} das lutas, ${duracao}.`
  return `A maioria das lutas (${pct(empate)}) termina empatada no teto de ${TETO_DE_TURNOS} turnos.`
}

/** As vagas somadas por ficha de origem (as cópias juntas). */
interface GrupoDoBalanco {
  origem: string
  lado: 'a' | 'b'
  nome: string
  n: number
  hpMaximo: number
  danoCausado: number
  cura: number
  caiuNaRodada: number
  semSp: number
  semSpNaRodada: number
  spMaximo: number
}

function gruposDo(balanco: BalancoDaSerie, porId: ReadonlyMap<string, Personagem>): GrupoDoBalanco[] {
  const mapa = new Map<string, GrupoDoBalanco>()
  for (const vaga of balanco.vagas) {
    const chave = `${vaga.lado}:${vaga.origem}`
    const grupo = mapa.get(chave) ?? { origem: vaga.origem, lado: vaga.lado, nome: porId.get(vaga.origem)?.nome ?? vaga.nome, n: 0, hpMaximo: vaga.hpMaximo, danoCausado: 0, cura: 0, caiuNaRodada: 0, semSp: 0, semSpNaRodada: 0, spMaximo: vaga.spMaximo }
    grupo.n += 1
    grupo.danoCausado += vaga.danoCausado
    grupo.cura += vaga.cura
    grupo.caiuNaRodada = Math.max(grupo.caiuNaRodada, vaga.caiuNaRodada)
    grupo.semSp = Math.max(grupo.semSp, vaga.semSp)
    grupo.semSpNaRodada = Math.max(grupo.semSpNaRodada, vaga.semSpNaRodada)
    mapa.set(chave, grupo)
  }
  return [...mapa.values()]
}

interface Recomendacao {
  icone: NomeDoIconeDoMundo
  tom: 'dica' | 'alerta' | 'info'
  texto: ReactNode
  sub?: string
  acao?: boolean
}

/** Arredonda para cima de 50 em 50 (a dica fala "~1.850"). */
function emCinquentas(valor: number): number {
  return Math.ceil(valor / 50) * 50
}

function recomendar(balanco: BalancoDaSerie, porId: ReadonlyMap<string, Personagem>, sistema: SistemaDeRpg, turnos: number | null, vitoriaPct: number | null): Recomendacao[] {
  const recs: Recomendacao[] = []
  const grupos = gruposDo(balanco, porId)
  const aliados = grupos.filter((grupo) => grupo.lado === 'a')
  const inimigos = grupos.filter((grupo) => grupo.lado === 'b')
  const vitoria = balanco.vitorias.a / balanco.n
  const mediana = balanco.mediana
  const danoDosAliados = aliados.reduce((soma, grupo) => soma + grupo.danoCausado, 0)
  const danoPorTurno = danoDosAliados / Math.max(1, balanco.media)
  if (turnos !== null) {
    if (mediana < turnos - 1 && vitoria < 0.5) {
      recs.push({ icone: 'relogio', tom: 'alerta', acao: true, texto: <>A luta acaba em <b>{umaCasa(mediana)} turnos</b> porque os <b>aliados</b> caem antes. Para durar <b>{turnos}</b>, os inimigos precisam bater menos: ligue "Dano" na frase da meta.</> })
    } else if (mediana < turnos - 1 && inimigos.length === 1) {
      const grupo = inimigos[0]
      const ficha = porId.get(grupo.origem)
      const escudo = ficha === undefined ? 0 : escudoDe(ficha, sistema)
      const precisa = (danoPorTurno * turnos) / grupo.n
      const hp = emCinquentas(Math.max(grupo.hpMaximo, precisa - escudo))
      const comEscudo = emCinquentas(Math.max(0, precisa - grupo.hpMaximo - escudo))
      recs.push({
        icone: 'relogio',
        tom: 'dica',
        acao: true,
        texto: <>{grupo.nome}{grupo.n > 1 ? ' (cada cópia)' : ''} cai em ~<b>{umaCasa(grupo.caiuNaRodada || mediana)} turnos</b>; para a luta durar <b>{turnos}</b>, suba o HP para ~<b>{formatarNumero(hp)}</b> ou dê Escudo ~<b>{formatarNumero(comEscudo)}</b>.</>,
        sub: 'Estimativa pelo dano que os aliados deram no teste. "Achar os números" confere com lutas de verdade.',
      })
    } else if (mediana < turnos - 1) {
      const vidaHoje = inimigos.reduce((soma, grupo) => soma + grupo.hpMaximo * grupo.n, 0)
      recs.push({ icone: 'relogio', tom: 'dica', acao: true, texto: <>A luta acaba em <b>{umaCasa(mediana)} turnos</b>, antes dos <b>{turnos}</b> da meta. Os inimigos precisam de ~<b>{formatarNumero(emCinquentas(danoPorTurno * turnos))}</b> de vida somada; hoje têm {formatarNumero(vidaHoje)} de HP.</> })
    } else if (mediana > turnos + 1) {
      recs.push({ icone: 'relogio', tom: 'dica', acao: true, texto: <>A luta dura <b>{umaCasa(mediana)} turnos</b>, mais que os <b>{turnos}</b> da meta. Baixe o HP ou o Escudo dos inimigos, ou dê mais dano aos aliados.</> })
    } else {
      recs.push({ icone: 'ok', tom: 'info', texto: <>A duração já bate a meta: <b>{umaCasa(mediana)} turnos</b> de mediana para <b>{turnos}</b> pedidos.</> })
    }
  }
  if (vitoriaPct !== null && Math.abs(vitoria - vitoriaPct / 100) > 0.06) {
    const fraco = vitoria > vitoriaPct / 100
    recs.push({ icone: 'balanca', tom: 'dica', acao: true, texto: <>Os aliados vencem <b>{pct(vitoria)}</b> e a meta é <b>{vitoriaPct}%</b>. Os inimigos precisam bater mais {fraco ? 'forte' : 'fraco'}: ligue "Dano" na frase da meta.</> })
  }
  if (aliados.length >= 2 && danoDosAliados > 0) {
    const maior = aliados.reduce((melhor, grupo) => (grupo.danoCausado > melhor.danoCausado ? grupo : melhor), aliados[0])
    const parte = maior.danoCausado / danoDosAliados
    if (parte >= 0.42) recs.push({ icone: 'raio', tom: 'info', texto: <>{maior.nome} carrega <b>{pct(parte)}</b> do dano dos aliados. Se cair cedo, a luta vira.</> })
  }
  const primeira = balanco.vagas.filter((vaga) => vaga.lado === 'a').reduce<VagaNoBalanco | null>((melhor, vaga) => (melhor === null || vaga.primeiro > melhor.primeiro ? vaga : melhor), null)
  if (primeira !== null && primeira.primeiro >= 0.35) {
    recs.push({ icone: 'alerta', tom: 'alerta', texto: <>{primeira.nome} é quem cai primeiro em <b>{pct(primeira.primeiro)}</b> das lutas{primeira.caiuNaRodada > 0 ? <>, por volta do turno <b>{Math.round(primeira.caiuNaRodada)}</b></> : null}.</> })
  }
  const longa = (turnos !== null && turnos >= 6) || mediana >= 6
  if (aliados.every((grupo) => grupo.cura === 0) && longa) recs.push({ icone: 'alerta', tom: 'alerta', texto: <>Os aliados não curaram em nenhuma luta: numa luta longa, o dano dos inimigos só acumula.</> })
  const curandeiro = inimigos.find((grupo) => grupo.cura > 0)
  if (curandeiro !== undefined) recs.push({ icone: 'saude', tom: 'info', texto: <>{curandeiro.nome} cura os inimigos: <b>{formatarNumero(Math.round(curandeiro.cura))}</b> de vida por luta, em média.</> })
  const semSp = aliados.filter((grupo) => grupo.semSp >= 0.5 && grupo.spMaximo > 0).sort((x, y) => y.semSp - x.semSp)[0]
  if (semSp !== undefined) recs.push({ icone: 'alerta', tom: 'alerta', texto: <>{semSp.nome} fica sem SP para as técnicas em <b>{pct(semSp.semSp)}</b> das lutas, por volta do turno <b>{Math.round(semSp.semSpNaRodada)}</b>. Depois disso o robô só usa o que não custa SP.</> })
  const tempo = balanco.noTeto / balanco.n
  if (tempo >= 0.1) recs.push({ icone: 'relogio', tom: 'alerta', texto: <><b>{pct(tempo)}</b> das lutas bateram no teto de {TETO_DE_TURNOS} turnos sem vencedor: ninguém consegue derrubar ninguém.</> })
  if (balanco.p90 - balanco.p10 >= Math.max(4, mediana)) recs.push({ icone: 'testar', tom: 'info', texto: <>A duração varia muito, de <b>{balanco.p10}</b> a <b>{balanco.p90}</b> turnos em 8 de cada 10 lutas: o d20 pesa. Mais HP e menos dano deixam a luta mais previsível.</> })
  if (vitoria >= 0.97 && vitoriaPct === null) recs.push({ icone: 'balanca', tom: 'info', texto: <>Os aliados vencem quase sempre (<b>{pct(vitoria)}</b>). Para um chefe, marque "os aliados vençam em 70%" e deixe o app mexer no Dano.</> })
  if (vitoria < 0.35) recs.push({ icone: 'nao', tom: 'alerta', texto: <>Os aliados perdem <b>{pct(1 - vitoria)}</b> das lutas. Para um encontro justo, tire um inimigo ou marque a meta de vitória.</> })
  return recs
}

export interface ResultadoDoBalancoProps {
  guardado: Guardado<BalancoDaSerie> | null
  velho: boolean
  nLutas: number
  rodando: boolean
  turnosDaMeta: number | null
  vitoriaDaMeta: number | null
  porId: ReadonlyMap<string, Personagem>
  sistema: SistemaDeRpg
  podeAchar: boolean
  onTestar: () => void
  onAchar: () => void
  onOutraSemente: () => void
}

export function ResultadoDoBalanco({ guardado, velho, nLutas, rodando, turnosDaMeta, vitoriaDaMeta, porId, sistema, podeAchar, onTestar, onAchar, onOutraSemente }: ResultadoDoBalancoProps) {
  // A revelação anima só a primeira vez que um resultado aparece nesta visita.
  const jaMostrou = useRef(false)
  const animar = guardado !== null && !jaMostrou.current
  if (guardado !== null) jaMostrou.current = true
  if (guardado === null) {
    return (
      <div className="mu-cartao bl-res-vazio">
        <strong>Ainda sem teste</strong>
        <p>Monte os dois lados e clique em Testar. O robô do treino joga a luta {nLutas} vezes, rolando o d20 de cada golpe, e o app conta quem vence, quanto dura e quem carrega cada lado.</p>
      </div>
    )
  }
  const balanco = guardado.valor
  const peso = pesoDoBalanco(balanco)
  const recs = recomendar(balanco, porId, sistema, turnosDaMeta, vitoriaDaMeta)
  const nA = balanco.vagas.filter((vaga) => vaga.lado === 'a').length
  const nB = balanco.vagas.length - nA
  const classe = (_indice: number) => (animar ? 'bl-res__parte bl-res__parte--entra' : 'bl-res__parte')
  // 45 ms entre as partes, como o protótipo.
  const atraso = (indice: number) => (animar ? { animationDelay: `${indice * 45}ms` } : undefined)
  return (
    <div className={velho ? 'bl-res bl-res--velho' : 'bl-res'}>
      {velho && (
        <div className="bl-res__velho" role="status">
          A montagem mudou depois deste teste.
          <button type="button" className="mu-bt mu-bt--p mu-bt--latao" disabled={rodando} onClick={onTestar}>
            Testar de novo
          </button>
        </div>
      )}
      <section className={`mu-cartao bl-veredito ${classe(0)}`} style={atraso(0)} aria-label="Veredito">
        <div className="bl-veredito__cab">
          <p className="bl-veredito__frase">{fraseDoVeredito(balanco)}</p>
          <div className="bl-peso" aria-label={`Peso da luta: ${NOME_DO_PESO[peso]}`}>
            <span className="bl-peso__marcas" aria-hidden="true">
              {ORDEM_DO_PESO.map((marca, i) => (
                <span key={marca} className={i <= ORDEM_DO_PESO.indexOf(peso) ? 'bl-peso__marca bl-peso__marca--on' : 'bl-peso__marca'} />
              ))}
            </span>
            <span className="bl-peso__txt">
              <small>Peso da luta</small>
              {NOME_DO_PESO[peso]}
            </span>
          </div>
        </div>
        <Placar balanco={balanco} />
        <dl className="bl-numeros">
          <div>
            <dt>Duração (mediana)</dt>
            <dd>
              <strong>{umaCasa(balanco.mediana)}</strong> turnos<small>média {umaCasa(balanco.media)}</small>
            </dd>
          </div>
          <div>
            <dt>Metade das lutas</dt>
            <dd>
              <strong>
                {balanco.q25} a {balanco.q75}
              </strong>{' '}
              turnos
              <small>
                8 em 10: {balanco.p10} a {balanco.p90}
              </small>
            </dd>
          </div>
          <div>
            <dt>Aliados de pé no fim</dt>
            <dd>
              <strong>{umaCasa(balanco.dePe.a)}</strong> de {nA}
              <small>média das {balanco.n} lutas</small>
            </dd>
          </div>
          <div>
            <dt>Inimigos de pé no fim</dt>
            <dd>
              <strong>{umaCasa(balanco.dePe.b)}</strong> de {nB}
              <small>média das {balanco.n} lutas</small>
            </dd>
          </div>
        </dl>
      </section>

      {recs.length > 0 && (
        <section className={`mu-cartao bl-recs ${classe(1)}`} style={atraso(1)} aria-labelledby="bl-recs-tit">
          <h3 className="bl-sec__tit" id="bl-recs-tit">
            O que mudar <small>tirado das {balanco.n} lutas</small>
          </h3>
          <ul className="bl-recs__lista">
            {recs.map((rec, i) => (
              <li key={i} className={`bl-rec bl-rec--${rec.tom}`}>
                <span className="bl-rec__ic" aria-hidden="true">
                  <IconeDoMundo nome={rec.icone} />
                </span>
                <div className="bl-rec__txt">
                  <p>{rec.texto}</p>
                  {rec.sub !== undefined && <small>{rec.sub}</small>}
                </div>
                {rec.acao === true && (
                  <button type="button" className="mu-bt mu-bt--p mu-bt--latao" disabled={!podeAchar || rodando} onClick={onAchar}>
                    Achar os números
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className={`bl-res__dupla ${classe(2)}`} style={atraso(2)}>
        <Histograma balanco={balanco} turnosDaMeta={turnosDaMeta} />
        <section className="mu-cartao bl-tecnicas" aria-labelledby="bl-tec-tit">
          <h3 className="bl-sec__tit" id="bl-tec-tit">
            Técnicas mais usadas <small>vezes por luta, em média</small>
          </h3>
          {balanco.tecnicas.length === 0 ? (
            <p className="mu-pg-nota">Ninguém usou técnica nem golpe nestas lutas.</p>
          ) : (
            <ul className="bl-tecnicas__lista">
              {balanco.tecnicas.map((tecnica, i) => (
                <li key={`${tecnica.quem}-${tecnica.nome}-${i}`}>
                  <span className="bl-tecnicas__nome">
                    {tecnica.nome}
                    <small>{tecnica.quem}</small>
                  </span>
                  <span className={`bl-mini bl-mini--${tecnica.lado}`} aria-hidden="true">
                    <span className="bl-mini__ench" style={{ transform: `scaleX(${(tecnica.vezes / Math.max(0.001, balanco.tecnicas[0].vezes)).toFixed(3)})` }} />
                  </span>
                  <span className="bl-tecnicas__n">{umaCasa(tecnica.vezes)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <FichaPorFicha balanco={balanco} classe={classe(3)} estilo={atraso(3)} />

      {balanco.tipica !== null && (
        <details className={`mu-cartao bl-tipica ${classe(4)}`} style={atraso(4)}>
          <summary>
            Luta típica: {balanco.tipica.vencedor === null ? 'empate' : `vencida pelos ${balanco.tipica.vencedor === 'a' ? 'Aliados' : 'Inimigos'}`} em {balanco.tipica.rodada} turnos (semente {balanco.tipica.semente})
          </summary>
          <ol className="bl-tipica__lista">
            {balanco.tipica.registro.map((linha, i) => (
              <li key={i}>{linha}</li>
            ))}
          </ol>
        </details>
      )}

      <p className="bl-rodape">
        Semente {balanco.semente}: mesma semente, mesmas lutas. {balanco.n} lutas em {umaCasa(guardado.ms / 1000)} s.{' '}
        <button type="button" className="mu-bt mu-bt--p mu-bt--fantasma" disabled={rodando} onClick={onOutraSemente}>
          Rodar com outra semente
        </button>
      </p>
    </div>
  )
}

function Placar({ balanco }: { balanco: BalancoDaSerie }) {
  const partes = [
    { chave: 'a', rotulo: 'Aliados vencem', valor: balanco.vitorias.a / balanco.n },
    { chave: 'empate', rotulo: 'Empate', valor: balanco.vitorias.empate / balanco.n },
    { chave: 'b', rotulo: 'Inimigos vencem', valor: balanco.vitorias.b / balanco.n },
  ]
  return (
    <div className="bl-placar">
      <div className="bl-placar__barra" role="img" aria-label={partes.map((parte) => `${parte.rotulo} ${pct(parte.valor)}`).join(', ')}>
        {partes.map((parte) =>
          parte.valor > 0 ? (
            <span key={parte.chave} className={`bl-placar__parte bl-cor--${parte.chave}`} style={{ flexGrow: parte.valor }}>
              {parte.valor >= 0.08 ? pct(parte.valor) : ''}
            </span>
          ) : null,
        )}
      </div>
      <ul className="bl-legenda">
        {partes.map((parte) => (
          <li key={parte.chave}>
            <span className={`bl-legenda__cor bl-cor--${parte.chave}`} aria-hidden="true" />
            {parte.rotulo} <b>{pct(parte.valor)}</b>
          </li>
        ))}
      </ul>
    </div>
  )
}

const LARGURA = 640
const ALTURA = 210
const MARGEM = { esq: 40, dir: 12, topo: 22, base: 26 }

function Histograma({ balanco, turnosDaMeta }: { balanco: BalancoDaSerie; turnosDaMeta: number | null }) {
  const [foco, setFoco] = useState<number | null>(null)
  const turnos = Math.max(balanco.histograma.length, turnosDaMeta ?? 0, 1)
  const largura = LARGURA - MARGEM.esq - MARGEM.dir
  const altura = ALTURA - MARGEM.topo - MARGEM.base
  const passo = largura / turnos
  const maior = Math.max(0.2, ...balanco.histograma.map((turno) => (turno.a + turno.b + turno.empate) / balanco.n))
  const topo = Math.ceil(maior * 5) / 5
  const y = (fracao: number) => MARGEM.topo + altura - (fracao / topo) * altura
  const x = (turno: number) => MARGEM.esq + (turno - 0.5) * passo
  const xLinha = (valor: number) => MARGEM.esq + (valor - 0.5) * passo
  const barra = Math.min(24, passo * 0.7)
  const marcas = Array.from({ length: Math.round(topo / 0.2) + 1 }, (_, i) => i * 0.2)
  const focado = foco === null ? null : balanco.histograma[foco]
  const teclar = (evento: KeyboardEvent) => {
    if (evento.key !== 'ArrowRight' && evento.key !== 'ArrowLeft') return
    evento.preventDefault()
    const ultimo = balanco.histograma.length - 1
    setFoco((atual) => (atual === null ? 0 : Math.max(0, Math.min(ultimo, atual + (evento.key === 'ArrowRight' ? 1 : -1)))))
  }
  return (
    <section className="mu-cartao bl-hist" aria-labelledby="bl-hist-tit">
      <h3 className="bl-sec__tit" id="bl-hist-tit">
        Quanto dura <small>lutas por turno em que acabaram, por quem venceu</small>
      </h3>
      <div className="bl-hist__area" tabIndex={0} role="group" aria-label="Lutas por turno. Use as setas para ler cada turno." onKeyDown={teclar} onBlur={() => setFoco(null)} onMouseLeave={() => setFoco(null)}>
        <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} className="bl-hist__svg" aria-hidden="true">
          {marcas.map((marca) => (
            <g key={marca}>
              <line x1={MARGEM.esq} x2={LARGURA - MARGEM.dir} y1={y(marca)} y2={y(marca)} className="bl-hist__grade" />
              <text x={MARGEM.esq - 6} y={y(marca) + 3} className="bl-hist__eixo" textAnchor="end">
                {Math.round(marca * 100)}%
              </text>
            </g>
          ))}
          <rect x={xLinha(balanco.q25) - passo / 2} width={(balanco.q75 - balanco.q25 + 1) * passo} y={MARGEM.topo} height={altura} className="bl-hist__faixa" />
          {balanco.histograma.map((turno, i) => {
            const a = turno.a / balanco.n
            const e = turno.empate / balanco.n
            const b = turno.b / balanco.n
            const base = y(0)
            return (
              <g key={turno.turno} onMouseEnter={() => setFoco(i)}>
                <rect x={x(turno.turno) - passo / 2} width={passo} y={MARGEM.topo} height={altura} fill="transparent" />
                {a > 0 && <rect x={x(turno.turno) - barra / 2} width={barra} y={y(a)} height={base - y(a)} rx={3} className="bl-cor--a" />}
                {b > 0 && <rect x={x(turno.turno) - barra / 2} width={barra} y={y(a + b) + 2} height={Math.max(0, y(a) - y(a + b) - 2)} rx={3} className="bl-cor--b" />}
                {e > 0 && <rect x={x(turno.turno) - barra / 2} width={barra} y={y(a + b + e) + 2} height={Math.max(0, y(a + b) - y(a + b + e) - 2)} rx={3} className="bl-cor--empate" />}
                {foco === i && <rect x={x(turno.turno) - passo / 2} width={passo} y={MARGEM.topo} height={altura} className="bl-hist__foco" />}
                {(turnos <= 15 || turno.turno % 2 === 1) && (
                  <text x={x(turno.turno)} y={ALTURA - 8} className="bl-hist__eixo" textAnchor="middle">
                    {turno.turno}
                  </text>
                )}
              </g>
            )
          })}
          <line x1={xLinha(balanco.mediana)} x2={xLinha(balanco.mediana)} y1={MARGEM.topo - 6} y2={y(0)} className="bl-hist__mediana" />
          <text x={xLinha(balanco.mediana)} y={MARGEM.topo - 9} className="bl-hist__rot" textAnchor="middle">
            mediana {umaCasa(balanco.mediana)}
          </text>
          {turnosDaMeta !== null && (
            <>
              <line x1={xLinha(turnosDaMeta)} x2={xLinha(turnosDaMeta)} y1={MARGEM.topo - 6} y2={y(0)} className="bl-hist__meta" />
              <text x={Math.min(LARGURA - MARGEM.dir, xLinha(turnosDaMeta))} y={MARGEM.topo - 9} className="bl-hist__rot bl-hist__rot--meta" textAnchor="end">
                meta {turnosDaMeta}
              </text>
            </>
          )}
        </svg>
        {focado !== null && focado !== undefined && (
          <p className="bl-hist__dica" role="status" style={{ left: `${(100 * x(focado.turno)) / LARGURA}%` }}>
            Turno {focado.turno}: {pct((focado.a + focado.b + focado.empate) / balanco.n)} das lutas (aliados {pct(focado.a / balanco.n)}, inimigos {pct(focado.b / balanco.n)}
            {focado.empate > 0 ? `, empate ${pct(focado.empate / balanco.n)}` : ''})
          </p>
        )}
      </div>
      <ul className="bl-legenda">
        <li>
          <span className="bl-legenda__cor bl-cor--a" aria-hidden="true" />
          Aliados vencem
        </li>
        <li>
          <span className="bl-legenda__cor bl-cor--b" aria-hidden="true" />
          Inimigos vencem
        </li>
        <li>
          <span className="bl-legenda__cor bl-cor--empate" aria-hidden="true" />
          Empate
        </li>
      </ul>
      <details className="bl-hist__tabela">
        <summary>Ver como tabela</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Turno</th>
              <th scope="col">Aliados vencem</th>
              <th scope="col">Inimigos vencem</th>
              <th scope="col">Empate</th>
            </tr>
          </thead>
          <tbody>
            {balanco.histograma.map((turno) => (
              <tr key={turno.turno}>
                <th scope="row">{turno.turno}</th>
                <td>{turno.a}</td>
                <td>{turno.b}</td>
                <td>{turno.empate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  )
}

function FichaPorFicha({ balanco, classe, estilo }: { balanco: BalancoDaSerie; classe: string; estilo: { animationDelay: string } | undefined }) {
  const danoDoLado = { a: 0, b: 0 }
  for (const vaga of balanco.vagas) danoDoLado[vaga.lado] += vaga.danoCausado
  return (
    <section className={`mu-cartao bl-fichas ${classe}`} style={estilo} aria-labelledby="bl-fichas-tit">
      <h3 className="bl-sec__tit" id="bl-fichas-tit">
        Ficha por ficha <small>médias por luta</small>
      </h3>
      <div className="bl-fichas__rolar">
        <table>
          <thead>
            <tr>
              <th scope="col">Ficha</th>
              <th scope="col">Dano causado</th>
              <th scope="col">Dano sofrido</th>
              <th scope="col">Parte do lado</th>
              <th scope="col">Cai primeiro</th>
              <th scope="col">Caiu</th>
              <th scope="col">SP gasto</th>
              <th scope="col">Mais usada</th>
            </tr>
          </thead>
          <tbody>
            {balanco.vagas.map((vaga) => (
              <tr key={vaga.vaga} className={`bl-fichas__lin--${vaga.lado}`}>
                <th scope="row">
                  {vaga.nome}
                  <small>{vaga.lado === 'a' ? 'Aliado' : 'Inimigo'}</small>
                </th>
                <td>{formatarNumero(Math.round(vaga.danoCausado))}</td>
                <td>{formatarNumero(Math.round(vaga.danoSofrido))}</td>
                <td>{danoDoLado[vaga.lado] > 0 ? pct(vaga.danoCausado / danoDoLado[vaga.lado]) : '—'}</td>
                <td>{pct(vaga.primeiro)}</td>
                <td>{vaga.caiu > 0 ? `${pct(vaga.caiu)} · turno ${umaCasa(vaga.caiuNaRodada)}` : 'nunca'}</td>
                <td>
                  {formatarNumero(Math.round(vaga.spGasto))}
                  {vaga.semSp > 0 && <small>sem SP em {pct(vaga.semSp)}</small>}
                </td>
                <td>{vaga.maisUsada === null ? '—' : `${vaga.maisUsada.nome} (${umaCasa(vaga.maisUsada.vezes)})`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// O cartão da proposta
// ───────────────────────────────────────────────────────────────────────────

type Confianca = { nivel: 'alta' | 'media' | 'baixa'; motivo: string }

function confiancaDa(proposta: PropostaDoAchar, turnos: number | null, vitoria: number | null): Confianca {
  const { conferencia } = proposta
  if (proposta.avisos.some((aviso) => aviso.tipo !== 'semAmeaca')) return { nivel: 'baixa', motivo: 'um botão bateu no limite antes da meta.' }
  const distTurnos = turnos === null ? 0 : Math.abs(conferencia.mediana - turnos)
  const distVitoria = vitoria === null ? 0 : Math.abs(conferencia.vitoria - vitoria)
  const leitura = [turnos === null ? null : `a mediana deu ${umaCasa(conferencia.mediana)} turnos para ${turnos} pedidos`, vitoria === null ? null : `a vitória deu ${pct(conferencia.vitoria)} para ${pct(vitoria)}`].filter((parte) => parte !== null).join(' e ')
  if (distTurnos <= 0.6 && distVitoria <= 0.05) return { nivel: 'alta', motivo: `${leitura}.` }
  if (distTurnos <= 1.5 && distVitoria <= 0.1) return { nivel: 'media', motivo: `${leitura}: perto, mas o d20 ainda puxa. Rodar de novo pode afinar.` }
  return { nivel: 'baixa', motivo: `${leitura}: longe da meta. Ligue outro botão ou procure de novo.` }
}

const NOME_DA_CONFIANCA: Readonly<Record<Confianca['nivel'], string>> = { alta: 'Confiança alta', media: 'Confiança média', baixa: 'Confiança baixa' }

function textoDoAviso(aviso: AvisoDoAchar, turnos: number | null, vitoria: number | null): string {
  if (aviso.tipo === 'semAmeaca') return 'A meta de vitória ficou de fora: ligue "Dano" ou "Atributos" para o app mexer nela.'
  if (aviso.tipo === 'limiteTurnos') return `Nem com o ${NOME_DO_BOTAO[aviso.botao]} no limite a luta chega a ${turnos ?? '?'} turnos: os inimigos derrubam os aliados antes, ou o dano dos aliados passa de qualquer vida. Ligue outro botão e procure de novo.`
  const extra = aviso.botao === 'dano' ? ' (a força do NPC vai de ×0,5 a ×2)' : ''
  return `Nem com o ${NOME_DO_BOTAO[aviso.botao]} no limite${extra} os aliados chegam a ${vitoria === null ? '?' : pct(vitoria)} de vitória.`
}

export interface CartaoDaPropostaProps {
  guardada: Guardado<PropostaGuardada>
  velha: boolean
  porId: ReadonlyMap<string, Personagem>
  sistema: SistemaDeRpg
  onAplicar: () => void
  onDescartar: () => void
}

export function CartaoDaProposta({ guardada, velha, porId, sistema, onAplicar, onDescartar }: CartaoDaPropostaProps) {
  const { proposta, alvos, turnos, vitoria } = guardada.valor
  const { ajuste, conferencia } = proposta
  const modelo = porId.get(alvos[0])
  const nulo = ajuste.hp === 1 && ajuste.escudo === 0 && ajuste.dano === 1 && ajuste.atributos === 1
  const depois = modelo === undefined ? undefined : ajustarFicha(modelo, ajuste, sistema)
  const quem = alvos.length > 1 ? 'todos os inimigos' : (modelo?.nome ?? 'o inimigo')
  const hpHoje = modelo === undefined ? null : hpMaximo(modelo, sistema)
  const hpDepois = depois === undefined ? null : hpMaximo(depois, sistema)
  const mudancas: string[] = []
  if (ajuste.hp !== 1) mudancas.push(alvos.length > 1 || hpDepois === null ? `HP ×${umaCasa(ajuste.hp)}` : `HP ${formatarNumero(hpDepois)}`)
  if (ajuste.escudo !== 0) mudancas.push(`Escudo +${formatarNumero(ajuste.escudo)}`)
  if (ajuste.dano !== 1) mudancas.push(`dano ×${formatarNumero(ajuste.dano)}`)
  if (ajuste.atributos !== 1) mudancas.push(`atributos ×${formatarNumero(ajuste.atributos)}`)
  const titulo = nulo ? 'Não achei números melhores que os de hoje' : `Achei: ${quem} com ${mudancas.join(' e ')}`
  const confianca = confiancaDa(proposta, turnos, vitoria)
  const sufixo = turnos !== null ? `${turnos} turnos` : vitoria !== null ? `${Math.round(vitoria * 100)}% de vitória` : 'ajustado'
  const motivo = velha ? 'A montagem mudou depois da procura: procure de novo.' : nulo ? 'Nada a aplicar: os números ficaram iguais aos de hoje.' : null
  const linhas: { rotulo: string; hoje: number | null; depois: number | null }[] =
    modelo === undefined || depois === undefined
      ? []
      : [
          { rotulo: 'HP', hoje: hpHoje, depois: hpDepois },
          { rotulo: 'Escudo', hoje: escudoDe(modelo, sistema), depois: escudoDe(depois, sistema) },
          { rotulo: 'Golpe mais forte', hoje: melhorGolpe(modelo, sistema)?.valor ?? null, depois: melhorGolpe(depois, sistema)?.valor ?? null },
        ]
  const outraSaida = !nulo && ajuste.hp > 1 && ajuste.escudo === 0 && hpHoje !== null && hpDepois !== null && alvos.length === 1 ? Math.round((hpDepois - hpHoje) / 50) * 50 : null
  return (
    <section className={velha ? 'mu-cartao bl-proposta bl-proposta--velha' : 'mu-cartao bl-proposta'} aria-live="polite" aria-labelledby="bl-proposta-tit">
      <h3 className="bl-proposta__tit" id="bl-proposta-tit">
        {titulo}
        <small>
          {proposta.tentativas.length} tentativas de {LUTAS_POR_TENTATIVA} lutas + {LUTAS_DA_CONFERENCIA} lutas novas para conferir · {umaCasa(guardada.ms / 1000)} s
        </small>
      </h3>
      <div className="bl-proposta__corpo">
        <div>
          {linhas.length > 0 && (
            <table className="bl-proposta__tabela">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="lb-sr-only">Linha</span>
                  </th>
                  <th scope="col">Hoje</th>
                  <th scope="col">Proposta</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((linha) => (
                  <tr key={linha.rotulo}>
                    <th scope="row">{linha.rotulo}</th>
                    <td>{linha.hoje === null ? '—' : formatarNumero(linha.hoje)}</td>
                    <td className={linha.hoje !== linha.depois ? 'bl-proposta__mudou' : undefined}>{linha.depois === null ? '—' : formatarNumero(linha.depois)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="bl-proposta__conf">
            Em {conferencia.n} lutas novas com estes números: a luta dura <b>{umaCasa(conferencia.mediana)} turnos</b> (mediana; metade entre {conferencia.q25} e {conferencia.q75}) e os aliados vencem <b>{pct(conferencia.vitoria)}</b> (de {pct(conferencia.vitoriaMin)} a {pct(conferencia.vitoriaMax)} com 95% de certeza).
          </p>
          <p className={`bl-confianca bl-confianca--${confianca.nivel}`}>
            <span className="bl-confianca__pontos" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            {NOME_DA_CONFIANCA[confianca.nivel]}: {confianca.motivo}
          </p>
          {proposta.avisos.map((aviso, i) => (
            <p key={i} className="bl-proposta__aviso">
              {textoDoAviso(aviso, turnos, vitoria)}
            </p>
          ))}
          {outraSaida !== null && outraSaida > 0 && (
            <p className="bl-proposta__outra">
              Outra saída com a mesma vida total: manter HP {formatarNumero(hpHoje ?? 0)} e dar Escudo ~{formatarNumero(outraSaida)}. É uma estimativa: ligue só "Escudo" e clique de novo para conferir.
            </p>
          )}
        </div>
        <ComoAchei proposta={proposta} turnos={turnos} vitoria={vitoria} />
      </div>
      <div className="bl-proposta__acoes">
        <button type="button" className="mu-bt mu-bt--primario" disabled={motivo !== null} onClick={onAplicar}>
          {alvos.length > 1 ? 'Aplicar aos inimigos (cria variações)' : `Aplicar ao ${quem} (cria "${quem} (${sufixo})")`}
        </button>
        <button type="button" className="mu-bt mu-bt--fantasma" onClick={onDescartar}>
          Descartar
        </button>
        <p className="bl-proposta__nota">{motivo ?? 'A ficha original não muda: a proposta vira uma variação nova, e a luta passa a usá-la.'}</p>
      </div>
    </section>
  )
}

const GRAF = { largura: 340, altura: 170, esq: 30, dir: 12, topo: 16, base: 22 }

function ComoAchei({ proposta, turnos, vitoria }: { proposta: PropostaDoAchar; turnos: number | null; vitoria: number | null }) {
  const meta: 'turnos' | 'vitoria' = turnos !== null ? 'turnos' : 'vitoria'
  const alvo = meta === 'turnos' ? turnos : vitoria
  const pontos = proposta.tentativas.filter((tentativa) => tentativa.meta === meta)
  if (pontos.length < 2 || alvo === null) return null
  const botao = pontos[0].botao
  const xs = pontos.map((ponto) => ponto.ajuste[botao])
  const ys = [...pontos.map((ponto) => ponto.valor), alvo]
  const [xMin, xMax] = [Math.min(...xs), Math.max(...xs)]
  const [yMin, yMax] = [Math.min(...ys), Math.max(...ys)]
  const largura = GRAF.largura - GRAF.esq - GRAF.dir
  const altura = GRAF.altura - GRAF.topo - GRAF.base
  const px = (valor: number) => GRAF.esq + (xMax === xMin ? largura / 2 : ((valor - xMin) / (xMax - xMin)) * largura)
  const py = (valor: number) => GRAF.topo + altura - (yMax === yMin ? altura / 2 : ((valor - yMin) / (yMax - yMin)) * altura)
  const escrever = (valor: number) => (meta === 'turnos' ? umaCasa(valor) : pct(valor))
  const escreverX = (valor: number) => (botao === 'escudo' ? `+${formatarNumero(Math.round(valor))}` : `×${formatarNumero(Math.round(valor * 100) / 100)}`)
  return (
    <figure className="bl-como">
      <figcaption>
        Como achei: cada ponto é uma tentativa ({NOME_DO_BOTAO[botao]} × {meta === 'turnos' ? 'turnos, mediana' : 'vitória dos aliados'})
      </figcaption>
      <svg viewBox={`0 0 ${GRAF.largura} ${GRAF.altura}`} role="img" aria-label={pontos.map((ponto, i) => `Tentativa ${i + 1}: ${escreverX(ponto.ajuste[botao])} deu ${escrever(ponto.valor)}`).join('; ')}>
        <line x1={GRAF.esq} x2={GRAF.largura - GRAF.dir} y1={py(alvo)} y2={py(alvo)} className="bl-como__meta" />
        <text x={GRAF.largura - GRAF.dir} y={py(alvo) - 4} textAnchor="end" className="bl-hist__rot bl-hist__rot--meta">
          meta {escrever(alvo)}
        </text>
        <polyline points={pontos.map((ponto) => `${px(ponto.ajuste[botao])},${py(ponto.valor)}`).join(' ')} className="bl-como__linha" />
        {pontos.map((ponto, i) => (
          <circle key={i} cx={px(ponto.ajuste[botao])} cy={py(ponto.valor)} r={i === pontos.length - 1 ? 4 : 3} className={i === 0 ? 'bl-como__ponto bl-como__ponto--hoje' : 'bl-como__ponto'} />
        ))}
        <text x={GRAF.esq} y={GRAF.altura - 6} className="bl-hist__eixo">
          {escreverX(xMin)}
        </text>
        <text x={GRAF.largura - GRAF.dir} y={GRAF.altura - 6} textAnchor="end" className="bl-hist__eixo">
          {escreverX(xMax)}
        </text>
      </svg>
    </figure>
  )
}
