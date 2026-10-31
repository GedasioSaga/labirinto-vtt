import { useMemo, type ReactNode } from 'react'
import { maximoComposto } from '../../lib/ajusteDaFicha'
import { ehVariacao, entraNaBatalha, trocarForca, variacoesDe } from '../../lib/livros/combate'
import {
  COMPARAR_MAX,
  COMPARAR_MIN,
  FATOR_DA_REACAO,
  NOME_DO_PESO,
  ajusteDoPeso,
  colunaDaComparacao,
  melhorGolpe,
  pesoDoEncontro,
  type AlvoDoPeso,
  type ColunaDaComparacao,
  type GolpeDaFicha,
  type PesoDoEncontro,
  type ResultadoDoEncontro,
} from '../../lib/livros/encontro'
import type { EstadoDaLeitura } from '../../lib/livros/saude'
import { forcaDe, type Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { recursoDeVida } from '../../lib/vidaDaFicha'
import { INIMIGOS_POR_NPC_MAX, useMundoDoLivroStore } from '../../stores/mundoDoLivroStore'
import { useToastStore } from '../../stores/toastStore'
import { formatarForca, formatarNumero, forcaMexida, gravarNoMundo, Retrato } from './comum'
import { IconeDoMundo } from './icones'

/**
 * COMPARAR E BALANCEAR (M2, docs/planos/livros-de-regras-plano.md, seção M2):
 * de 2 a 4 fichas lado a lado com a força já aplicada e, embaixo, o peso do
 * encontro (grupo x inimigos) com os botões que ajustam a força dos inimigos.
 * Porte fiel da aba Comparar do protótipo aprovado
 * (docs/design/livros-de-regras/). Os números vêm todos de
 * lib/livros/encontro.ts (que só usa os funis da batalha); a escolha das
 * fichas, o grupo e os inimigos são estado de sessão do mundoDoLivroStore.
 */

function IconeDoPeso({ peso }: { peso: PesoDoEncontro }) {
  if (peso === 'facil') return <IconeDoMundo nome="ok" />
  if (peso === 'justo') return <IconeDoMundo nome="balanca" />
  if (peso === 'duro') return <IconeDoMundo nome="alerta" />
  return <IconeDoMundo nome="nao" />
}

/** O que o golpe sem número mostra no lugar do dano, em cinza. */
const DANO_SEM_NUMERO: Readonly<Record<EstadoDaLeitura, string>> = { lido: 'Lido', naHora: 'Na hora', naoLe: 'Não lê', aMao: 'À mão' }

/** A frase final do veredito, do protótipo. */
const FRASE_DO_PESO: Readonly<Record<PesoDoEncontro, string>> = {
  facil: 'O grupo atropela.',
  justo: 'Dá trabalho, mas o grupo chega primeiro.',
  duro: 'Perto demais: um azar no d20 vira derrota.',
  mortal: 'Os inimigos chegam antes.',
}

const ALVOS: readonly AlvoDoPeso[] = ['facil', 'justo', 'duro']

/** "×0,6": o fator da reação como a linha "Por rodada" e as premissas o escrevem. */
const FATOR_ESCRITO = formatarNumero(Math.round(FATOR_DA_REACAO * 100) / 100)
/** "40%": quanto a reação tira em média (o resto do fator). */
const REACAO_TIRA = `${Math.round((1 - FATOR_DA_REACAO) * 100)}%`

/** "~2,3", "menos de 1", "nunca": as rodadas como o protótipo escreve. */
function rodadasEscritas(rodadas: number): string {
  if (rodadas === Infinity) return 'nunca'
  if (rodadas < 1) return 'menos de 1'
  return `~${formatarNumero(Math.round(rodadas * 10) / 10)}`
}

/** "em ~2,3 rodadas", "em menos de 1 rodada"; `null` = nunca. */
function emRodadas(rodadas: number): string | null {
  if (rodadas === Infinity) return null
  if (rodadas < 1) return 'menos de 1 rodada'
  return `${rodadasEscritas(rodadas)} rodadas`
}

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

interface LinhaDeBarrasProps {
  rotulo: string
  sub?: string
  /** Um valor por coluna; `null` = a ficha não tem (o sistema não tem o recurso). */
  valores: readonly (number | null)[]
  chaves: readonly string[]
  classe?: string
  extra?: (indice: number) => ReactNode
}

/** Uma linha da tabela: o número e a barra; a barra mais longa (sozinha) marca quem lidera. */
function LinhaDeBarras({ rotulo, sub, valores, chaves, classe, extra }: LinhaDeBarrasProps) {
  const numeros = valores.map((valor) => valor ?? 0)
  const maior = Math.max(...numeros, 1)
  const lideres = numeros.filter((valor) => valor === maior).length
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
}

function TabelaDaComparacao({ colunas, fichas, personagens, porRodada, sistema }: TabelaProps) {
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
  const algum = (valores: readonly (number | null)[]) => valores.some((valor) => valor !== null)

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
                  </div>
                </div>
              </th>
            )
          })}
        </tr>
      </thead>
      <tbody>
        {(algum(hp) || algum(sp) || algum(escudo)) && grupo('Vida e fôlego')}
        {algum(hp) && <LinhaDeBarras rotulo="HP" sub="com a força" valores={hp} chaves={chaves} classe="mu-barra--hp" />}
        {algum(sp) && <LinhaDeBarras rotulo="SP" valores={sp} chaves={chaves} classe="mu-barra--sp" />}
        {algum(escudo) && <LinhaDeBarras rotulo="Escudo" valores={escudo} chaves={chaves} classe="mu-barra--esc" />}
        {sistema.atributos.length > 0 && grupo('Atributos')}
        {sistema.atributos.map((atributo, a) => (
          <LinhaDeBarras
            key={atributo.id}
            rotulo={atributo.nome}
            sub={atributo.abreviacao}
            valores={colunas.map((coluna) => coluna.atributos[a]?.valor ?? null)}
            chaves={chaves}
            extra={(i) => {
              const rank = colunas[i].atributos[a]?.rank
              return rank === null || rank === undefined ? null : <small>{rank}</small>
            }}
          />
        ))}
        {grupo('Dano pelas fórmulas da ficha')}
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
        <LinhaDeBarras rotulo="Por rodada" sub={`melhor golpe × reação (${FATOR_ESCRITO})`} valores={porRodada} chaves={chaves} />
      </tbody>
    </table>
  )
}

/** Um NPC na lista dos inimigos, com a quantidade. */
interface ResumoDoInimigo {
  personagem: Personagem
  hp: number | null
  golpe: number | null
  forca: number
}

function PassoDoInimigo({ resumo, quantos }: { resumo: ResumoDoInimigo; quantos: number }) {
  const { personagem, hp, golpe, forca } = resumo
  const nome = personagem.nome
  const partes = [hp === null ? null : `HP ${formatarNumero(hp)}`, golpe === null ? 'sem golpe que o app lê' : `golpe ${formatarNumero(golpe)}`, forcaMexida(forca) ? formatarForca(forca) : null]
  const mudar = (n: number) => useMundoDoLivroStore.getState().quantosInimigos(personagem.id, n)
  return (
    <div className="mu-passo">
      <Retrato imagem={personagem.retrato} nome={nome} tamanho="p" />
      <span className="mu-passo__nome">
        <span className="mu-passo__quem" title={nome}>
          {nome}
        </span>
        <small>{partes.filter((parte) => parte !== null).join(' · ')}</small>
      </span>
      <span className="mu-passo__ctrl" role="group" aria-label={`Quantos ${nome}`}>
        <button type="button" className="mu-bt mu-bt--ic mu-bt--p" aria-label={`Um ${nome} a menos`} disabled={quantos === 0} onClick={() => mudar(quantos - 1)}>
          <IconeDoMundo nome="menos" />
        </button>
        <output aria-live="polite" className={quantos > 0 ? 'mu-passo__n mu-passo__n--tem' : 'mu-passo__n'}>
          {quantos}
        </output>
        <button type="button" className="mu-bt mu-bt--ic mu-bt--p" aria-label={`Um ${nome} a mais`} disabled={quantos >= INIMIGOS_POR_NPC_MAX} onClick={() => mudar(quantos + 1)}>
          <IconeDoMundo nome="mais" />
        </button>
      </span>
    </div>
  )
}

interface VereditoProps {
  resultado: ResultadoDoEncontro
  personagens: readonly Personagem[]
  onDeixar: (alvo: AlvoDoPeso) => void
  onVerSaude: () => void
}

function Veredito({ resultado, personagens, onDeixar, onVerSaude }: VereditoProps) {
  const { peso, razao } = resultado
  if (peso === null) {
    return (
      <div className="mu-vazio mu-peso__todo">
        <p>Escolha pelo menos um jogador e um inimigo para ver o peso do encontro.</p>
      </div>
    )
  }
  const rodadasDoGrupo = resultado.grupo.rodadasParaDerrubar
  const rodadasDosInimigos = resultado.inimigos.rodadasParaDerrubar
  const maior = Math.max(Number.isFinite(rodadasDoGrupo) ? rodadasDoGrupo : 0, Number.isFinite(rodadasDosInimigos) ? rodadasDosInimigos : 0, 1)
  const fracao = (rodadas: number) => (Number.isFinite(rodadas) ? rodadas / maior : 1)
  const grupoEm = emRodadas(rodadasDoGrupo)
  const inimigosEm = emRodadas(rodadasDosInimigos)
  const semGolpe = resultado.semGolpe.flatMap((id) => personagens.find((personagem) => personagem.id === id) ?? [])
  let travado: string | null = null
  if (razao === 0) travado = 'Os inimigos não têm golpe que o app lê: não há força para ajustar.'
  else if (!Number.isFinite(razao)) travado = 'O grupo não tem golpe que o app lê: a força dos inimigos não muda o resultado.'

  return (
    <div className="mu-cartao mu-veredito" data-peso={peso}>
      <div>
        <span className="mu-veredito__selo">
          <IconeDoPeso peso={peso} />
          {NOME_DO_PESO[peso]}
        </span>
        <p className="mu-veredito__txt">
          {grupoEm === null ? (
            <>
              O grupo <b>nunca</b> derruba os inimigos.
            </>
          ) : (
            <>
              O grupo derruba os inimigos em <b>{grupoEm}</b>.
            </>
          )}{' '}
          {inimigosEm === null ? (
            <>
              Os inimigos <b>nunca</b> derrubam o grupo.
            </>
          ) : (
            <>
              Os inimigos derrubam o grupo em <b>{inimigosEm}</b>.
            </>
          )}{' '}
          {FRASE_DO_PESO[peso]}
        </p>
      </div>
      <div className="mu-rodadas" role="group" aria-label="Rodadas até cair">
        <div className="mu-rodadas__lin mu-rodadas__grupo">
          <span className="mu-rodadas__rot">
            <span>Grupo derruba os inimigos</span>
            <b>{rodadasEscritas(rodadasDoGrupo)}</b>
          </span>
          <Barra fracao={fracao(rodadasDoGrupo)} />
        </div>
        <div className="mu-rodadas__lin mu-rodadas__inim">
          <span className="mu-rodadas__rot">
            <span>Inimigos derrubam o grupo</span>
            <b>{rodadasEscritas(rodadasDosInimigos)}</b>
          </span>
          <Barra fracao={fracao(rodadasDosInimigos)} />
        </div>
      </div>
      {semGolpe.length > 0 && (
        <p className="mu-pg-nota mu-veredito__aviso">
          <IconeDoMundo nome="alerta" />
          <span>
            {semGolpe.map((personagem, i) => (
              <span key={personagem.id}>
                {i > 0 && ', '}
                <b>{personagem.nome}</b>
              </span>
            ))}{' '}
            {semGolpe.length === 1 ? 'não tem golpe que o app lê: entra com dano 0.' : 'não têm golpe que o app lê: entram com dano 0.'}
          </span>
          <button type="button" className="mu-bt mu-bt--p mu-bt--fantasma" onClick={onVerSaude}>
            Ver na Saúde da ficha
          </button>
        </p>
      )}
      <div className="mu-veredito__acoes">
        <span className="mu-pg-nota">Ajustar a força dos inimigos:</span>
        {ALVOS.map((alvo) => (
          <button key={alvo} type="button" className={alvo === peso ? 'mu-bt mu-bt--p mu-bt--latao' : 'mu-bt mu-bt--p'} disabled={travado !== null} onClick={() => onDeixar(alvo)}>
            <IconeDoMundo nome="raio" />
            Deixar {NOME_DO_PESO[alvo]}
          </button>
        ))}
        {travado !== null && <span className="mu-pg-nota">{travado}</span>}
      </div>
      <p className="mu-premissas">
        Estimativa simples: cada um usa todo turno o melhor golpe que a ficha paga (sem OVERLOAD), a reação do alvo tira em média {REACAO_TIRA} do dano, e HP + Escudo somam a vida. Sem
        cura; transformação só conta se já estiver ligada na ficha.
      </p>
    </div>
  )
}

export interface PaginaCompararProps {
  personagens: readonly Personagem[]
  sistema: SistemaDeRpg
  /** "Ver na Saúde da ficha": o mundo troca de marcador. */
  onVerSaude: () => void
}

export function PaginaComparar({ personagens, sistema, onVerSaude }: PaginaCompararProps) {
  const comparar = useMundoDoLivroStore((state) => state.comparar)
  const grupo = useMundoDoLivroStore((state) => state.grupo)
  const inimigos = useMundoDoLivroStore((state) => state.inimigos)

  const jogadores = useMemo(() => personagens.filter((personagem) => personagem.tipo === 'jogador'), [personagens])
  const npcs = useMemo(() => personagens.filter((personagem) => personagem.tipo === 'npc' && entraNaBatalha(personagem)), [personagens])
  const escolhidas = useMemo(() => comparar.flatMap((id) => personagens.find((personagem) => personagem.id === id) ?? []), [comparar, personagens])
  const colunas = useMemo(() => escolhidas.map((personagem) => colunaDaComparacao(personagem, sistema)), [escolhidas, sistema])
  const porRodada = useMemo(
    () => escolhidas.map((personagem) => Math.round((melhorGolpe(personagem, sistema)?.valor ?? 0) * FATOR_DA_REACAO)),
    [escolhidas, sistema],
  )
  const resumos = useMemo<ResumoDoInimigo[]>(() => {
    const vida = recursoDeVida(sistema)
    return npcs.map((personagem) => ({
      personagem,
      hp: vida === null ? null : maximoComposto(personagem, vida.id).total,
      golpe: melhorGolpe(personagem, sistema)?.valor ?? null,
      forca: forcaDe(personagem),
    }))
  }, [npcs, sistema])
  const resultado = useMemo(() => pesoDoEncontro(grupo, inimigos, personagens, sistema), [grupo, inimigos, personagens, sistema])

  const cheio = comparar.length >= COMPARAR_MAX
  const noGrupo = grupo.filter((id) => jogadores.some((personagem) => personagem.id === id)).length
  const quantosInimigos = npcs.reduce((soma, personagem) => soma + (inimigos[personagem.id] ?? 0), 0)
  const temEncontro = grupo.length > 0 || Object.keys(inimigos).length > 0

  const alternar = (id: string) => useMundoDoLivroStore.getState().alternarComparar(id)

  const chips = (lista: readonly Personagem[]) =>
    lista.map((personagem) => {
      const dentro = comparar.includes(personagem.id)
      return (
        <button key={personagem.id} type="button" className="mu-chip" aria-pressed={dentro} disabled={!dentro && cheio} onClick={() => alternar(personagem.id)}>
          <Retrato imagem={personagem.retrato} nome={personagem.nome} tamanho="p" />
          {personagem.nome}
        </button>
      )
    })

  const esvaziar = () => {
    const antes = { grupo, inimigos }
    useMundoDoLivroStore.getState().limparEncontro()
    useToastStore.getState().push('info', 'Encontro esvaziado.', undefined, {
      actions: [{ label: 'Desfazer', run: () => useMundoDoLivroStore.setState(antes) }],
    })
  }

  const deixar = (alvo: AlvoDoPeso) => {
    const atual = useMundoDoLivroStore.getState()
    const ajuste = ajusteDoPeso(atual.grupo, atual.inimigos, personagens, sistema, alvo)
    const mudou = Object.keys(ajuste.forcas).some((id) => ajuste.forcas[id] !== ajuste.antes[id])
    if (!mudou) {
      const texto = ajuste.noLimite
        ? 'A força dos inimigos já está no limite (×0,5 a ×2): mude o número de inimigos.'
        : `Nada mudou: o encontro já está ${NOME_DO_PESO[resultado.peso ?? alvo]}.`
      useToastStore.getState().push('info', texto)
      return
    }
    const ficou = ajuste.pesoDepois === null ? '' : `: o encontro ficou ${NOME_DO_PESO[ajuste.pesoDepois]}`
    const limite = ajuste.noLimite ? ' A força bateu no limite (×0,5 a ×2): mude o número de inimigos para chegar lá.' : ''
    const aplicar = (forcas: Readonly<Record<string, number>>) => (lista: Personagem[]) =>
      lista.map((personagem) => {
        const forca = forcas[personagem.id]
        return forca === undefined ? personagem : trocarForca(personagem, forca)
      })
    void gravarNoMundo(aplicar(ajuste.forcas), { texto: `Força dos inimigos ajustada${ficou}.${limite}`, desfazer: aplicar(ajuste.antes) })
  }

  return (
    <div className="mu-pg">
      <header className="mu-pg-cab">
        <div className="mu-pg-cab__txt">
          <h2 className="mu-pg-titulo">Comparar e balancear</h2>
          <p className="mu-pg-sub">Até 4 fichas lado a lado: atributos, vida e o dano que as fórmulas dão de verdade. Embaixo, o peso de um grupo de inimigos contra os jogadores.</p>
        </div>
      </header>

      {jogadores.length + npcs.length === 0 ? (
        <div className="mu-vazio">
          <p>Nenhuma ficha de combate nesta pasta ainda. Crie um jogador em Jogadores ou um NPC em NPCs de combate para comparar aqui.</p>
        </div>
      ) : (
        <>
          <div className="mu-cmp-escolha" role="group" aria-label="Fichas para comparar">
            {jogadores.length > 0 && (
              <div className="mu-cmp-escolha__lin">
                <span className="mu-cmp-escolha__rot">Jogadores</span>
                <div className="mu-chips">{chips(jogadores)}</div>
              </div>
            )}
            {npcs.length > 0 && (
              <div className="mu-cmp-escolha__lin">
                <span className="mu-cmp-escolha__rot">NPCs</span>
                <div className="mu-chips">{chips(npcs)}</div>
              </div>
            )}
            <p className="mu-pg-nota" aria-live="polite">
              {comparar.length} de {COMPARAR_MAX} escolhidas{cheio ? '. Tire uma para pôr outra.' : '.'} {jogadores.length + npcs.length} fichas de combate nesta pasta.
            </p>
          </div>

          {colunas.length < COMPARAR_MIN ? (
            <div className="mu-vazio">
              <p>Escolha pelo menos {COMPARAR_MIN} fichas acima para ver lado a lado.</p>
            </div>
          ) : (
            <>
              <div className="mu-cartao mu-cmp">
                <TabelaDaComparacao colunas={colunas} fichas={escolhidas} personagens={personagens} porRodada={porRodada} sistema={sistema} />
              </div>
              <p className="mu-tabela-dica">A barra mais longa de cada linha marca quem lidera. NPC com força diferente de ×1 já aparece com a força aplicada.</p>
            </>
          )}

          <section className="mu-pg-secao" aria-labelledby="mu-peso-tit">
            <div className="mu-pg-secao__cab">
              <h3 className="mu-pg-secao__tit" id="mu-peso-tit">
                Peso do encontro{' '}
                <small>
                  {noGrupo} {noGrupo === 1 ? 'jogador' : 'jogadores'} contra {quantosInimigos} {quantosInimigos === 1 ? 'inimigo' : 'inimigos'}
                </small>
              </h3>
              {temEncontro && (
                <button type="button" className="mu-bt mu-bt--p mu-bt--fantasma" onClick={esvaziar}>
                  Esvaziar
                </button>
              )}
            </div>
            <div className="mu-peso">
              <div className="mu-cartao mu-peso__lado">
                <h4 className="mu-peso__tit">
                  Jogadores
                  <small className="mu-pg-nota">
                    Vida {formatarNumero(resultado.grupo.vida)} · {formatarNumero(Math.round(resultado.grupo.danoPorRodada))} por rodada
                  </small>
                </h4>
                {jogadores.length === 0 ? (
                  <p className="mu-pg-nota">Nenhum jogador nesta pasta. Crie em Jogadores.</p>
                ) : (
                  <div className="mu-chips" role="group" aria-label="Jogadores no grupo">
                    {jogadores.map((personagem) => (
                      <button
                        key={personagem.id}
                        type="button"
                        className="mu-chip"
                        aria-pressed={grupo.includes(personagem.id)}
                        onClick={() => useMundoDoLivroStore.getState().alternarNoGrupo(personagem.id)}
                      >
                        <Retrato imagem={personagem.retrato} nome={personagem.nome} tamanho="p" />
                        {personagem.nome}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="mu-cartao mu-peso__lado">
                <h4 className="mu-peso__tit">
                  Inimigos
                  <small className="mu-pg-nota">
                    Vida {formatarNumero(resultado.inimigos.vida)} · {formatarNumero(Math.round(resultado.inimigos.danoPorRodada))} por rodada
                  </small>
                </h4>
                {resumos.length === 0 ? (
                  <p className="mu-pg-nota">Nenhum NPC de combate nesta pasta. Crie em NPCs de combate.</p>
                ) : (
                  <div className="mu-peso__lista">
                    {resumos.map((resumo) => (
                      <PassoDoInimigo key={resumo.personagem.id} resumo={resumo} quantos={inimigos[resumo.personagem.id] ?? 0} />
                    ))}
                  </div>
                )}
              </div>
              <Veredito resultado={resultado} personagens={personagens} onDeixar={deixar} onVerSaude={onVerSaude} />
            </div>
          </section>
        </>
      )}
    </div>
  )
}
