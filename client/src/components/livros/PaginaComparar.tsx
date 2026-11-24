import { useMemo, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { ehVariacao, entraNaBatalha, variacoesDe } from '../../lib/livros/combate'
import { COMPARAR_MAX, COMPARAR_MIN, FATOR_DA_REACAO, colunaDaComparacao, melhorGolpe, type ColunaDaComparacao, type GolpeDaFicha } from '../../lib/livros/encontro'
import type { EstadoDaLeitura } from '../../lib/livros/saude'
import type { Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import type { BalancoDaSerie } from '../../lib/treino/balanceadorComum'
import { useBalanceadorStore, type AbaDoBalanceador } from '../../stores/balanceadorStore'
import { useMundoDoLivroStore } from '../../stores/mundoDoLivroStore'
import { BalanceadorDaLuta } from './BalanceadorDaLuta'
import { formatarForca, formatarNumero, forcaMexida, Retrato } from './comum'
import './balancear.css'

/**
 * COMPARAR E BALANCEAR (M2, docs/planos/livros-de-regras-plano.md; refeita
 * pelo protótipo aprovado de 23/11/2026, docs/design/balanceamento/): duas
 * abas. "Testar a luta" (`BalanceadorDaLuta`) monta aliados contra inimigos,
 * roda as lutas do robô do treino e acha os números; o antigo "peso do
 * encontro" virou a linha da conta rápida. "Comparar fichas" mostra de 2 a 4
 * fichas lado a lado, com uma coluna base, a diferença para ela e "Só as
 * linhas que mudam". Os números da tabela vêm de lib/livros/encontro.ts.
 */

/** O que o golpe sem número mostra no lugar do dano, em cinza. */
const DANO_SEM_NUMERO: Readonly<Record<EstadoDaLeitura, string>> = { lido: 'Lido', naHora: 'Na hora', naoLe: 'Não lê', aMao: 'À mão' }

/** "×0,6": o fator da reação como a linha "Por rodada" o escreve. */
const FATOR_ESCRITO = formatarNumero(Math.round(FATOR_DA_REACAO * 100) / 100)

const ABAS: readonly { id: AbaDoBalanceador; rotulo: string }[] = [
  { id: 'testar', rotulo: 'Testar a luta' },
  { id: 'comparar', rotulo: 'Comparar fichas' },
]

function papelDaFicha(personagem: Personagem, personagens: readonly Personagem[]): { rotulo: string; classe: string } {
  if (personagem.tipo === 'jogador') return { rotulo: 'Jogador', classe: 'mu-etiqueta--jogador' }
  if (ehVariacao(personagem)) return { rotulo: 'Variação', classe: 'mu-etiqueta--npc' }
  if (variacoesDe(personagem.id, personagens).length > 0) return { rotulo: 'Modelo', classe: 'mu-etiqueta--modelo' }
  return { rotulo: 'NPC', classe: 'mu-etiqueta--npc' }
}

function Barra({ fracao, classe }: { fracao: number; classe?: string }) {
  return (
    <span className={classe === undefined ? 'mu-barra' : `mu-barra ${classe}`} aria-hidden="true">
      <span className="mu-barra__ench" style={{ transform: `scaleX(${Math.min(1, Math.max(0, fracao)).toFixed(3)})` }} />
    </span>
  )
}

/** "+920", "−40", "igual": a diferença de uma coluna para a base. */
function diferenca(valor: number, base: number): string {
  const delta = Math.round((valor - base) * 10) / 10
  if (delta === 0) return 'igual'
  return delta > 0 ? `+${formatarNumero(delta)}` : `−${formatarNumero(-delta)}`
}

interface LinhaDeBarrasProps {
  rotulo: string
  sub?: string
  /** Um valor por coluna; `null` = a ficha não tem (o sistema não tem o recurso). */
  valores: readonly (number | null)[]
  chaves: readonly string[]
  /** A coluna base: as outras mostram a diferença para ela. */
  base: number
  /** "Só as linhas que mudam": a linha com todos iguais some. */
  soDiferencas: boolean
  classe?: string
  extra?: (indice: number) => ReactNode
}

/** Uma linha da tabela: o número e a barra; o maior valor (sozinho) fica em latão. */
function LinhaDeBarras({ rotulo, sub, valores, chaves, base, soDiferencas, classe, extra }: LinhaDeBarrasProps) {
  const numeros = valores.map((valor) => valor ?? 0)
  if (soDiferencas && valores.every((valor) => valor === valores[0])) return null
  const maior = Math.max(...numeros, 1)
  const lideres = numeros.filter((valor) => valor === maior).length
  const valorDaBase = valores[base]
  return (
    <tr>
      <th scope="row">
        {rotulo}
        {sub !== undefined && <small>{sub}</small>}
      </th>
      {valores.map((valor, i) => (
        <td key={chaves[i]}>
          {valor === null ? (
            <span className="mu-val__nada">—</span>
          ) : (
            <div className={valor === maior && lideres === 1 && valor > 0 ? 'mu-val mu-val--lider' : 'mu-val'}>
              <Barra fracao={valor / maior} classe={classe} />
              <span className="mu-val__num">
                {formatarNumero(valor)}
                {extra?.(i)}
                {i !== base && valorDaBase !== null && valorDaBase !== undefined && <small className={valor === valorDaBase ? 'bl-dif bl-dif--igual' : 'bl-dif'}>{diferenca(valor, valorDaBase)}</small>}
              </span>
            </div>
          )}
        </td>
      ))}
    </tr>
  )
}

function Golpe({ golpe }: { golpe: GolpeDaFicha }) {
  const nome = golpe.forma === undefined ? golpe.nome : `${golpe.nome} · ${golpe.forma}`
  const semNumero = golpe.valor === null
  const naHora = golpe.estado === 'naHora' && golpe.valor !== null
  return (
    <li className={semNumero ? 'mu-golpe mu-golpe--cinza' : 'mu-golpe'}>
      <span className="mu-golpe__nome" title={nome}>
        {nome}
      </span>
      <span className="mu-golpe__dano">{golpe.valor === null ? DANO_SEM_NUMERO[golpe.estado] : formatarNumero(golpe.valor)}</span>
      {(golpe.conta.length > 0 || naHora) && (
        <span className="mu-golpe__conta">
          {naHora && <span className="mu-golpe__hora">Na hora · </span>}
          {golpe.conta}
        </span>
      )}
    </li>
  )
}

interface TabelaProps {
  colunas: readonly ColunaDaComparacao[]
  fichas: readonly Personagem[]
  personagens: readonly Personagem[]
  porRodada: readonly number[]
  sistema: SistemaDeRpg
  base: number
  soDiferencas: boolean
  onBase: (indice: number) => void
  /** O último teste, para as linhas "Na última simulação"; `null` = sem teste. */
  balanco: BalancoDaSerie | null
}

/** O que a ficha fez no último teste (as cópias somadas); `null` = não estava nele. */
function naSimulacao(balanco: BalancoDaSerie | null, id: string): { dano: number; primeiro: number; sp: number } | null {
  if (balanco === null) return null
  const vagas = balanco.vagas.filter((vaga) => vaga.origem === id)
  if (vagas.length === 0) return null
  const soma = (campo: 'danoCausado' | 'primeiro' | 'spGasto') => vagas.reduce((total, vaga) => total + vaga[campo], 0) / vagas.length
  return { dano: Math.round(soma('danoCausado')), primeiro: Math.round(soma('primeiro') * 100), sp: Math.round(soma('spGasto')) }
}

function TabelaDaComparacao({ colunas, fichas, personagens, porRodada, sistema, base, soDiferencas, onBase, balanco }: TabelaProps) {
  const chaves = colunas.map((coluna) => coluna.personagemId)
  const vezes = colunas.length + 1
  const grupo = (titulo: string) => (
    <tr className="mu-cmp-grupo">
      <th scope="rowgroup" colSpan={vezes}>
        {titulo}
      </th>
    </tr>
  )
  const hp = colunas.map((coluna) => coluna.hp?.maximo ?? null)
  const sp = colunas.map((coluna) => coluna.sp?.maximo ?? null)
  const escudo = colunas.map((coluna) => coluna.escudo)
  const golpeForte = colunas.map((coluna) => Math.max(0, ...coluna.golpes.map((golpe) => golpe.valor ?? 0)))
  const algum = (valores: readonly (number | null)[]) => valores.some((valor) => valor !== null)
  const simulacao = colunas.map((coluna) => naSimulacao(balanco, coluna.personagemId))
  const linha = { chaves, base, soDiferencas }

  return (
    <table>
      <caption className="lb-sr-only">Comparação de {colunas.map((coluna) => coluna.nome).join(', ')}</caption>
      <thead>
        <tr>
          <th scope="col">
            <span className="lb-sr-only">Linha</span>
          </th>
          {colunas.map((coluna, i) => {
            const ficha = fichas[i]
            const papel = papelDaFicha(ficha, personagens)
            const modelo = ficha.combate?.modeloId === undefined ? undefined : personagens.find((outro) => outro.id === ficha.combate?.modeloId)
            return (
              <th key={coluna.personagemId} scope="col">
                <div className="mu-cmp-col">
                  <Retrato imagem={ficha.retrato} nome={coluna.nome} />
                  <div className="mu-cmp-col__txt">
                    <span className="mu-cmp-col__nome" title={coluna.nome}>
                      {coluna.nome}
                    </span>
                    <span className="mu-cmp-col__sub">
                      <span className={`mu-etiqueta ${papel.classe}`}>{papel.rotulo}</span>
                      {forcaMexida(coluna.forca) && <span className="mu-etiqueta mu-etiqueta--forca">{formatarForca(coluna.forca)}</span>}
                    </span>
                    {modelo !== undefined && <span className="bl-cmp-col__var">variação de {modelo.nome}</span>}
                    {i === base ? (
                      <span className="bl-cmp-col__base">Base</span>
                    ) : (
                      <button type="button" className="mu-bt mu-bt--p mu-bt--fantasma bl-cmp-col__usar" onClick={() => onBase(i)}>
                        Usar como base
                      </button>
                    )}
                  </div>
                </div>
              </th>
            )
          })}
        </tr>
      </thead>
      <tbody>
        {(algum(hp) || algum(sp) || algum(escudo)) && grupo('Vida e fôlego')}
        {algum(hp) && <LinhaDeBarras rotulo="HP" sub="com a força" valores={hp} classe="mu-barra--hp" {...linha} />}
        {algum(sp) && <LinhaDeBarras rotulo="SP" valores={sp} classe="mu-barra--sp" {...linha} />}
        {algum(escudo) && <LinhaDeBarras rotulo="Escudo" valores={escudo} classe="mu-barra--esc" {...linha} />}
        {sistema.atributos.length > 0 && grupo('Atributos')}
        {sistema.atributos.map((atributo, a) => (
          <LinhaDeBarras
            key={atributo.id}
            rotulo={atributo.nome}
            sub={atributo.abreviacao}
            valores={colunas.map((coluna) => coluna.atributos[a]?.valor ?? null)}
            extra={(i) => {
              const rank = colunas[i].atributos[a]?.rank
              return rank === null || rank === undefined ? null : <small>{rank}</small>
            }}
            {...linha}
          />
        ))}
        {grupo('Dano pelas fórmulas da ficha')}
        <LinhaDeBarras rotulo="Golpe mais forte" valores={golpeForte} {...linha} />
        <LinhaDeBarras rotulo="Por rodada" sub={`melhor golpe × reação (${FATOR_ESCRITO})`} valores={porRodada} {...linha} />
        <tr className="mu-cmp-golpes">
          <th scope="row">
            Golpes<small>conta do app</small>
          </th>
          {colunas.map((coluna) => (
            <td key={coluna.personagemId}>
              {coluna.golpes.length === 0 ? (
                <p className="mu-golpe__conta">Sem golpe com dano.</p>
              ) : (
                <ul className="mu-golpes">
                  {coluna.golpes.map((golpe, i) => (
                    <Golpe key={`${golpe.cartao?.id ?? 'atacar'}-${i}`} golpe={golpe} />
                  ))}
                </ul>
              )}
            </td>
          ))}
        </tr>
        {simulacao.some((item) => item !== null) && (
          <>
            {grupo('Na última simulação')}
            <LinhaDeBarras rotulo="Dano por luta" valores={simulacao.map((item) => item?.dano ?? null)} {...linha} />
            <LinhaDeBarras rotulo="Cai primeiro" sub="% das lutas" valores={simulacao.map((item) => item?.primeiro ?? null)} {...linha} />
            <LinhaDeBarras rotulo="SP gasto" sub="por luta" valores={simulacao.map((item) => item?.sp ?? null)} {...linha} />
          </>
        )}
      </tbody>
    </table>
  )
}

export interface PaginaCompararProps {
  personagens: readonly Personagem[]
  sistema: SistemaDeRpg
  /** "Ver na Saúde da ficha": o mundo troca de marcador. */
  onVerSaude: () => void
}

export function PaginaComparar({ personagens, sistema }: PaginaCompararProps) {
  const aba = useBalanceadorStore((state) => state.aba)
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  // Abas: setas, Home e End trocam de aba (e o foco vai junto); o Tab entra no painel.
  const teclarNasAbas = (evento: KeyboardEvent) => {
    const atual = ABAS.findIndex((item) => item.id === aba)
    const alvos: Record<string, number> = { ArrowRight: atual + 1, ArrowLeft: atual - 1, Home: 0, End: ABAS.length - 1 }
    const proximo = alvos[evento.key]
    if (proximo === undefined) return
    evento.preventDefault()
    const indice = (proximo + ABAS.length) % ABAS.length
    useBalanceadorStore.getState().trocarAba(ABAS[indice].id)
    refs.current[indice]?.focus()
  }

  return (
    <div className="mu-pg">
      <header className="mu-pg-cab">
        <div className="mu-pg-cab__txt">
          <h2 className="mu-pg-titulo">Comparar e balancear</h2>
          <p className="mu-pg-sub">
            Monte os dois lados e deixe o robô jogar a luta muitas vezes: o app conta quem vence, quanto dura e quem carrega cada lado, e diz o que mudar. Ajuste nunca mexe na ficha original: vira uma ficha nova.
          </p>
        </div>
      </header>

      <div className="bl-abas" role="tablist" aria-label="O que fazer" onKeyDown={teclarNasAbas}>
        {ABAS.map((item, i) => (
          <button
            key={item.id}
            ref={(elemento) => {
              refs.current[i] = elemento
            }}
            type="button"
            role="tab"
            id={`bl-aba-${item.id}`}
            className="bl-aba"
            aria-selected={aba === item.id}
            aria-controls={`bl-painel-${item.id}`}
            tabIndex={aba === item.id ? 0 : -1}
            onClick={() => useBalanceadorStore.getState().trocarAba(item.id)}
          >
            {item.rotulo}
          </button>
        ))}
      </div>

      <section id={`bl-painel-${aba}`} role="tabpanel" aria-labelledby={`bl-aba-${aba}`} tabIndex={-1}>
        {aba === 'testar' ? <BalanceadorDaLuta personagens={personagens} sistema={sistema} /> : <CompararFichas personagens={personagens} sistema={sistema} />}
      </section>
    </div>
  )
}

function CompararFichas({ personagens, sistema }: { personagens: readonly Personagem[]; sistema: SistemaDeRpg }) {
  const comparar = useMundoDoLivroStore((state) => state.comparar)
  const lados = useBalanceadorStore((state) => state.lados)
  const balanco = useBalanceadorStore((state) => state.balanco)
  const baseId = useBalanceadorStore((state) => state.baseDoComparar)
  const soDiferencas = useBalanceadorStore((state) => state.soDiferencas)

  const lutaveis = useMemo(() => personagens.filter((personagem) => entraNaBatalha(personagem)), [personagens])
  const grupos = useMemo(
    () => [
      { titulo: 'Jogadores', fichas: lutaveis.filter((personagem) => personagem.tipo === 'jogador') },
      { titulo: 'NPCs', fichas: lutaveis.filter((personagem) => personagem.tipo === 'npc' && !ehVariacao(personagem)) },
      { titulo: 'Variações', fichas: lutaveis.filter((personagem) => personagem.tipo === 'npc' && ehVariacao(personagem)) },
    ],
    [lutaveis],
  )
  const escolhidas = useMemo(() => comparar.flatMap((id) => personagens.find((personagem) => personagem.id === id) ?? []), [comparar, personagens])
  const colunas = useMemo(() => escolhidas.map((personagem) => colunaDaComparacao(personagem, sistema)), [escolhidas, sistema])
  const porRodada = useMemo(() => escolhidas.map((personagem) => Math.round((melhorGolpe(personagem, sistema)?.valor ?? 0) * FATOR_DA_REACAO)), [escolhidas, sistema])
  const base = Math.max(0, escolhidas.findIndex((personagem) => personagem.id === baseId))
  const cheio = comparar.length >= COMPARAR_MAX
  const daLuta = [...lados.a, ...lados.b].map((ficha) => ficha.id).filter((id) => lutaveis.some((personagem) => personagem.id === id))

  const chips = (lista: readonly Personagem[]) =>
    lista.map((personagem) => {
      const dentro = comparar.includes(personagem.id)
      return (
        <button key={personagem.id} type="button" className="mu-chip" aria-pressed={dentro} disabled={!dentro && cheio} onClick={() => useMundoDoLivroStore.getState().alternarComparar(personagem.id)}>
          <Retrato imagem={personagem.retrato} nome={personagem.nome} tamanho="p" />
          {personagem.nome}
        </button>
      )
    })

  if (lutaveis.length === 0) {
    return (
      <div className="mu-vazio">
        <p>Nenhuma ficha de combate nesta pasta ainda. Crie um jogador em Jogadores ou um NPC em NPCs de combate para comparar aqui.</p>
      </div>
    )
  }
  return (
    <>
      <div className="mu-cmp-escolha" role="group" aria-label="Fichas para comparar">
        {grupos.map(
          (grupo) =>
            grupo.fichas.length > 0 && (
              <div key={grupo.titulo} className="mu-cmp-escolha__lin">
                <span className="mu-cmp-escolha__rot">{grupo.titulo}</span>
                <div className="mu-chips">{chips(grupo.fichas)}</div>
              </div>
            ),
        )}
        <div className="bl-cmp-ctrl">
          <p className="mu-pg-nota" aria-live="polite">
            {comparar.length} de {COMPARAR_MAX} escolhidas{cheio ? '. Tire uma para pôr outra.' : '.'}
          </p>
          <label className="bl-interruptor">
            <input type="checkbox" checked={soDiferencas} onChange={(e) => useBalanceadorStore.getState().mudarComparar({ soDiferencas: e.target.checked })} /> Só as linhas que mudam
          </label>
          <button
            type="button"
            className="mu-bt mu-bt--p mu-bt--fantasma"
            disabled={daLuta.length < COMPARAR_MIN}
            title={daLuta.length < COMPARAR_MIN ? 'Monte a luta em "Testar a luta" primeiro.' : undefined}
            onClick={() => useMundoDoLivroStore.setState({ comparar: daLuta.slice(0, COMPARAR_MAX) })}
          >
            Usar as fichas da luta
          </button>
        </div>
      </div>

      {colunas.length < COMPARAR_MIN ? (
        <div className="mu-vazio">
          <p>Escolha pelo menos {COMPARAR_MIN} fichas acima para ver lado a lado.</p>
        </div>
      ) : (
        <>
          <div className="mu-cartao mu-cmp">
            <TabelaDaComparacao
              colunas={colunas}
              fichas={escolhidas}
              personagens={personagens}
              porRodada={porRodada}
              sistema={sistema}
              base={base}
              soDiferencas={soDiferencas}
              onBase={(indice) => useBalanceadorStore.getState().mudarComparar({ baseDoComparar: escolhidas[indice]?.id ?? null })}
              balanco={balanco?.valor ?? null}
            />
          </div>
          <p className="mu-tabela-dica">O maior valor de cada linha fica em latão; as outras colunas mostram a diferença para a base. NPC com força diferente de ×1 já aparece com a força aplicada.</p>
        </>
      )}
    </>
  )
}
