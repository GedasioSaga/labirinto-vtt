import { useMemo } from 'react'
import { VIDA_POR_GOLPE } from '../../../lib/dbt/dados/tabelas'
import { compararPersonagens, COMPARAR_MAX, COMPARAR_MIN, type ColunaDoCompararDBT, type ComparacaoDBT } from '../../../lib/dbt/regras/comparar'
import { limiaresPelaDiferencaDeEP } from '../../../lib/dbt/regras/dano'
import { NOME_DA_AMEACA } from '../../../lib/dbt/regras/npc'
import type { TabelaDeRanksDBT } from '../../../lib/dbt/regras/tecnicas'
import { entraNaBatalha } from '../../../lib/livros/combate'
import type { Personagem } from '../../../lib/personagem'
import { INIMIGOS_POR_NPC_MAX, useMundoDoLivroStore } from '../../../stores/mundoDoLivroStore'
import { avisarComDesfazer, formatarNumero, Retrato } from '../../livros/comum'
import { IconeDoMundo } from '../../livros/icones'
import { derivadosDoPersonagem, fichaDe, notacaoDoNpc, pesoDoEncontroDBT, racaDaFicha, RANKS_DO_LIVRO, ROTULOS_DO_LIVRO, type EncontroDBT } from './contasDoMundo'
import { faixaEscrita } from './ResumoDoNpcDBT'
import './mundoDBT.css'

/**
 * COMPARAR E BALANCEAR do Dragon Ball (plano docs/planos/sistema-dragon-ball.md,
 * item 9): de 2 a 4 fichas lado a lado (PDL, EP, PV, PK, CA, ST), cada técnica
 * ativa com a chance de acerto e o dano esperado contra a CA de cada outro (a
 * faixa já deslocada pela diferença de EP), a vitória automática do livro e,
 * embaixo, o peso de um encontro grupo x inimigos. As contas são de
 * lib/dbt/regras/comparar.ts; a escolha é o mesmo estado de sessão do Comparar
 * do motor padrão (mundoDoLivroStore).
 */

const porcento = (fracao: number): string => `${Math.round(fracao * 100)}%`
const umaCasa = (valor: number): string => formatarNumero(Math.round(valor * 10) / 10)
const comSinalDeEP = (diferenca: number): string => (diferenca > 0 ? `+${diferenca}` : String(diferenca))

/** "derruba os inimigos em ~2,3 rodadas", "... em menos de 1 rodada", "nunca derruba os inimigos". */
function derruba(alvo: string, rodadas: number): string {
  if (rodadas === Infinity) return `nunca derruba ${alvo}`
  if (rodadas < 1) return `derruba ${alvo} em menos de 1 rodada`
  return `derruba ${alvo} em ~${umaCasa(rodadas)} rodadas`
}

/** "d20 + 2 + EP"; sem bônus, "d20 + EP". */
function acertoEscrito(acerto: number): string {
  if (acerto === 0) return 'd20 + EP'
  return `d20 ${acerto > 0 ? '+' : '−'} ${Math.abs(acerto)} + EP`
}

function papelDaFicha(personagem: Personagem): { rotulo: string; classe: string } {
  return personagem.tipo === 'jogador' ? { rotulo: 'Jogador', classe: 'mu-etiqueta--jogador' } : { rotulo: 'NPC', classe: 'mu-etiqueta--npc' }
}

interface LinhaDaTabela {
  rotulo: string
  sub?: string
  valor: (coluna: ColunaDoCompararDBT) => number
  /** Texto no lugar do número (ST usados/total); null = "—". */
  texto?: (coluna: ColunaDoCompararDBT, ehNpc: boolean) => string | null
  formula: (coluna: ColunaDoCompararDBT) => string
}

const LINHAS: readonly LinhaDaTabela[] = [
  { rotulo: 'PDL', sub: 'Poder de Luta', valor: (coluna) => coluna.pdl, formula: () => 'Poder de Luta base da ficha' },
  { rotulo: 'EP base', valor: (coluna) => coluna.epBase, formula: (coluna) => coluna.derivados.epBase.formula },
  { rotulo: 'EP total', sub: 'com a forma ativa', valor: (coluna) => coluna.epTotal, formula: (coluna) => coluna.derivados.epTotal.formula },
  { rotulo: 'PV', valor: (coluna) => coluna.pv, formula: (coluna) => coluna.derivados.pvMax.formula },
  { rotulo: 'PK', sub: 'Ki', valor: (coluna) => coluna.pk, formula: (coluna) => coluna.derivados.pkMax.formula },
  { rotulo: 'CA', valor: (coluna) => coluna.ca, formula: (coluna) => coluna.derivados.ca.formula },
  {
    rotulo: 'ST',
    sub: 'usados de',
    valor: (coluna) => coluna.st,
    texto: (coluna, ehNpc) => (ehNpc ? null : `${formatarNumero(coluna.stUsados)} / ${formatarNumero(coluna.st)}`),
    formula: (coluna) => coluna.derivados.st.formula,
  },
]

interface TabelaProps {
  comparacao: ComparacaoDBT
  fichas: readonly Personagem[]
}

function TabelaDoComparar({ comparacao, fichas }: TabelaProps) {
  const { colunas } = comparacao
  const nomePorId = new Map(colunas.map((coluna) => [coluna.id, coluna.nome]))
  const epPorId = new Map(colunas.map((coluna) => [coluna.id, coluna.epTotal]))
  const vezes = colunas.length + 1
  const grupo = (titulo: string) => (
    <tr className="mu-cmp-grupo">
      <th scope="rowgroup" colSpan={vezes}>
        {titulo}
      </th>
    </tr>
  )

  return (
    <table className="dbm-cmp">
      <caption className="lb-sr-only">Comparação de {colunas.map((coluna) => coluna.nome).join(', ')}</caption>
      <thead>
        <tr>
          <th scope="col">
            <span className="lb-sr-only">Linha</span>
          </th>
          {colunas.map((coluna, i) => {
            const ficha = fichas[i]
            const papel = papelDaFicha(ficha)
            const npc = fichaDe(ficha).npc
            return (
              <th key={coluna.id} scope="col">
                <div className="mu-cmp-col">
                  <Retrato imagem={ficha.retrato} nome={coluna.nome} />
                  <div className="mu-cmp-col__txt">
                    <span className="mu-cmp-col__nome" title={coluna.nome}>
                      {coluna.nome}
                    </span>
                    <span className="mu-cmp-col__sub">
                      <span className={`mu-etiqueta ${papel.classe}`}>{papel.rotulo}</span>
                      {npc !== undefined && <span className="dbm-notacao">{notacaoDoNpc(npc)}</span>}
                    </span>
                  </div>
                </div>
              </th>
            )
          })}
        </tr>
      </thead>
      <tbody>
        {grupo('Poder, vida e defesa')}
        {LINHAS.map((linha) => {
          const valores = colunas.map(linha.valor)
          const maior = Math.max(...valores)
          const lider = valores.filter((valor) => valor === maior).length === 1 && maior > 0
          return (
            <tr key={linha.rotulo}>
              <th scope="row">
                {linha.rotulo}
                {linha.sub !== undefined && <small>{linha.sub}</small>}
              </th>
              {colunas.map((coluna, i) => {
                const texto = linha.texto === undefined ? formatarNumero(valores[i]) : linha.texto(coluna, fichaDe(fichas[i]).npc !== undefined)
                return (
                  <td key={coluna.id} title={texto === null ? 'O NPC não usa Slots de Técnica: todas as técnicas dele estão prontas.' : linha.formula(coluna)}>
                    {texto === null ? (
                      <span className="mu-val__nada">—</span>
                    ) : (
                      <span className={lider && valores[i] === maior ? 'dbm-cmp__num dbm-cmp__num--lider' : 'dbm-cmp__num'}>{texto}</span>
                    )}
                  </td>
                )
              })}
            </tr>
          )
        })}
        {grupo('Técnicas de dano: acerto e dano esperado contra cada outro')}
        <tr className="mu-cmp-golpes">
          <th scope="row">
            Técnicas<small>ativas; no NPC, todas</small>
          </th>
          {colunas.map((coluna) => (
            <td key={coluna.id}>
              {coluna.tecnicas.length === 0 ? (
                <p className="mu-golpe__conta">Sem técnica de dano ativa.</p>
              ) : (
                <ul className="dbm-tecs">
                  {coluna.tecnicas.map((tecnica) => (
                    <li key={tecnica.id} className="dbm-tec">
                      <span className="dbm-tec__nome">{tecnica.nome}</span>
                      <span className="dbm-tec__meta">
                        Rank {tecnica.rank} · Ki {formatarNumero(tecnica.ki)} · <span className="dbm-tec__faixa">{faixaEscrita(tecnica.faixa)}</span> · acerto {acertoEscrito(tecnica.acerto)}
                        {!tecnica.valida && ' · montagem fora da regra'}
                      </span>
                      <ul className="dbm-contra">
                        {tecnica.contra.map((alvo) => {
                          const diferenca = coluna.epTotal - (epPorId.get(alvo.alvoId) ?? coluna.epTotal)
                          const limiares = limiaresPelaDiferencaDeEP(diferenca)
                          return (
                            <li
                              key={alvo.alvoId}
                              title={`Margem sobre a CA: mínimo ${comSinalDeEP(limiares.minimo)}, médio ${comSinalDeEP(limiares.medio)}, completo ${comSinalDeEP(limiares.completo)}. Crítico (20 natural) dobra.`}
                            >
                              contra {nomePorId.get(alvo.alvoId) ?? 'outro'}: <b>{porcento(alvo.chanceDeAcerto)}</b> de acerto · <b>{umaCasa(alvo.danoEsperado)}</b> de dano esperado
                              {diferenca !== 0 && ` · EP ${comSinalDeEP(diferenca)}`}
                            </li>
                          )
                        })}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  )
}

function ParesDoComparar({ comparacao }: { comparacao: ComparacaoDBT }) {
  const nomePorId = new Map(comparacao.colunas.map((coluna) => [coluna.id, coluna.nome]))
  const nome = (id: string): string => nomePorId.get(id) ?? '?'
  return (
    <ul className="dbm-pares" aria-label="Diferença de EP entre cada par">
      {comparacao.pares.map((par) => (
        <li key={`${par.aId}-${par.bId}`} className={par.vitoriaAutomatica === null ? 'dbm-par' : 'dbm-par dbm-par--vence'}>
          <span>
            {nome(par.aId)} × {nome(par.bId)}: diferença de EP <b>{comSinalDeEP(par.diferencaDeEP)}</b>
          </span>
          {par.vitoriaAutomatica !== null && (
            <span className="dbm-selo">
              <IconeDoMundo nome="raio" />
              Vitória automática de {nome(par.vitoriaAutomatica)}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Um NPC entre os inimigos, com a quantidade. */
function PassoDoInimigo({ personagem, ranks, quantos }: { personagem: Personagem; ranks: TabelaDeRanksDBT; quantos: number }) {
  const ficha = fichaDe(personagem)
  const derivados = derivadosDoPersonagem(personagem, ficha, ranks)
  const nome = personagem.nome
  const partes = [`PV ${formatarNumero(derivados.pvMax.valor)}`, `EP ${formatarNumero(derivados.epTotal.valor)}`, ficha.npc === undefined ? null : `Rank ${ficha.npc.rank}`]
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

function Veredito({ encontro, personagens }: { encontro: EncontroDBT; personagens: readonly Personagem[] }) {
  const { ameaca } = encontro
  if (ameaca === null) {
    return (
      <div className="mu-vazio mu-peso__todo">
        <p>Escolha pelo menos um jogador e um inimigo para ver o peso do encontro.</p>
      </div>
    )
  }
  const maisForte = personagens.find((personagem) => personagem.id === ameaca.personagemId)?.nome ?? 'O inimigo mais forte'
  const semGolpe = [...encontro.grupo.semGolpe, ...encontro.inimigos.semGolpe]
  return (
    <div className="mu-cartao mu-veredito">
      <div>
        <span className="dbm-selo dbm-ameaca" data-nivel={ameaca.nivel}>
          <IconeDoMundo nome={ameaca.nivel === 'mortal' ? 'alerta' : 'balanca'} />
          {NOME_DA_AMEACA[ameaca.nivel]}
        </span>
        <p className="mu-veredito__txt">
          Pela Escala de Poder (Livro do Narrador 4.0.3): {maisForte} tem EP <b>{ameaca.ep}</b> e o grupo, EP <b>{encontro.epDoGrupo}</b> (a média, para baixo).
        </p>
      </div>
      <div className="mu-rodadas" role="group" aria-label="Rodadas até cair">
        <p className="mu-pg-nota">
          O grupo <b>{derruba('os inimigos', encontro.grupo.rodadasParaDerrubar)}</b> ({umaCasa(encontro.grupo.danoPorRodada)} de dano esperado por rodada contra{' '}
          {formatarNumero(encontro.inimigos.vida)} PV).
        </p>
        <p className="mu-pg-nota">
          Os inimigos: <b>{derruba('o grupo', encontro.inimigos.rodadasParaDerrubar)}</b> ({umaCasa(encontro.inimigos.danoPorRodada)} por rodada contra {formatarNumero(encontro.grupo.vida)}{' '}
          PV).
        </p>
      </div>
      {semGolpe.length > 0 && (
        <p className="mu-pg-nota mu-veredito__aviso">
          <IconeDoMundo nome="alerta" />
          <span>
            Sem técnica de dano ativa: <b>{semGolpe.join(', ')}</b>. Entra com dano 0.
          </span>
        </p>
      )}
      <p className="mu-premissas">
        Estimativa simples: cada um usa todo turno a melhor técnica de dano contra um alvo médio do outro lado, com o d20 inteiro (o 20 dobra). Sem contar Ki, reação, cura nem
        transformação que não esteja ligada na ficha.
      </p>
    </div>
  )
}

export interface CompararDBTProps {
  personagens: readonly Personagem[]
}

export function CompararDBT({ personagens }: CompararDBTProps) {
  const comparar = useMundoDoLivroStore((state) => state.comparar)
  const grupo = useMundoDoLivroStore((state) => state.grupo)
  const inimigos = useMundoDoLivroStore((state) => state.inimigos)
  const ranks = RANKS_DO_LIVRO

  const jogadores = useMemo(() => personagens.filter((personagem) => personagem.tipo === 'jogador'), [personagens])
  const npcs = useMemo(() => personagens.filter((personagem) => personagem.tipo === 'npc' && entraNaBatalha(personagem)), [personagens])
  // Só conta quem tem chip na tela: o NPC que foi para "Só no cenário" depois de escolhido continua no estado, mas não entra nas contas.
  const idsDeCombate = useMemo(() => new Set([...jogadores, ...npcs].map((personagem) => personagem.id)), [jogadores, npcs])
  const colunas = useMemo(() => comparar.filter((id) => idsDeCombate.has(id)), [comparar, idsDeCombate])
  const grupoNaTela = useMemo(() => grupo.filter((id) => jogadores.some((personagem) => personagem.id === id)), [grupo, jogadores])
  const inimigosNaTela = useMemo(() => Object.fromEntries(Object.entries(inimigos).filter(([id]) => idsDeCombate.has(id))), [inimigos, idsDeCombate])
  const escolhidas = useMemo(() => colunas.flatMap((id) => personagens.find((personagem) => personagem.id === id) ?? []), [colunas, personagens])
  const comparacao = useMemo(() => {
    if (ranks === null || escolhidas.length < COMPARAR_MIN) return null
    const lista = escolhidas.map((personagem) => {
      const ficha = fichaDe(personagem)
      return { id: personagem.id, nome: personagem.nome, ficha, atributos: personagem.atributos, raca: racaDaFicha(ficha) }
    })
    return compararPersonagens(lista, { ranks, rotulos: ROTULOS_DO_LIVRO, vidaPorGolpe: VIDA_POR_GOLPE })
  }, [escolhidas, ranks])
  const encontro = useMemo(() => (ranks === null ? null : pesoDoEncontroDBT(grupoNaTela, inimigosNaTela, personagens, ranks)), [grupoNaTela, inimigosNaTela, personagens, ranks])

  if (ranks === null || encontro === null) {
    return (
      <div className="mu-pg">
        <div className="mu-vazio mu-vazio--erro" role="alert">
          <p>A tabela de ranks do livro Dragon Ball veio incompleta nesta versão do app: o Comparar não consegue calcular as técnicas.</p>
        </div>
      </div>
    )
  }

  const cheio = colunas.length >= COMPARAR_MAX
  const noGrupo = grupoNaTela.length
  const quantosInimigos = npcs.reduce((soma, personagem) => soma + (inimigosNaTela[personagem.id] ?? 0), 0)
  const temEncontro = grupoNaTela.length > 0 || Object.keys(inimigosNaTela).length > 0

  const alternarColuna = (personagemId: string) => {
    // A ficha que saiu da batalha ainda ocupa vaga no estado e não tem chip para sair: some antes de contar a vaga.
    if (colunas.length !== comparar.length) useMundoDoLivroStore.setState({ comparar: colunas })
    useMundoDoLivroStore.getState().alternarComparar(personagemId)
  }

  const chips = (lista: readonly Personagem[]) =>
    lista.map((personagem) => {
      const dentro = colunas.includes(personagem.id)
      return (
        <button
          key={personagem.id}
          type="button"
          className="mu-chip"
          aria-pressed={dentro}
          disabled={!dentro && cheio}
          onClick={() => alternarColuna(personagem.id)}
        >
          <Retrato imagem={personagem.retrato} nome={personagem.nome} tamanho="p" />
          {personagem.nome}
        </button>
      )
    })

  const esvaziar = () => {
    const antes = { grupo, inimigos }
    useMundoDoLivroStore.getState().limparEncontro()
    avisarComDesfazer('Encontro esvaziado.', () => useMundoDoLivroStore.setState(antes))
  }

  return (
    <div className="mu-pg dbm">
      <header className="mu-pg-cab">
        <div className="mu-pg-cab__txt">
          <h2 className="mu-pg-titulo">Comparar e balancear</h2>
          <p className="mu-pg-sub">
            Até {COMPARAR_MAX} fichas lado a lado: poder, vida, defesa e a chance de cada técnica contra a CA dos outros. Embaixo, o peso de um grupo de inimigos contra os jogadores.
          </p>
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
              {colunas.length} de {COMPARAR_MAX} escolhidas{cheio ? '. Tire uma para pôr outra.' : '.'} {jogadores.length + npcs.length} fichas de combate nesta pasta.
            </p>
          </div>

          {comparacao === null ? (
            <div className="mu-vazio">
              <p>Escolha pelo menos {COMPARAR_MIN} fichas acima para ver lado a lado.</p>
            </div>
          ) : (
            <>
              <div className="mu-cartao mu-cmp">
                <TabelaDoComparar comparacao={comparacao} fichas={escolhidas.slice(0, COMPARAR_MAX)} />
              </div>
              <ParesDoComparar comparacao={comparacao} />
              <p className="mu-tabela-dica">
                Vitória automática (Livro do Jogador 2.3.4): quando a EP de um é o dobro ou mais da do outro. É do livro, mas quem decide se aplica é o mestre. Passe o mouse num número
                para ver a conta.
              </p>
            </>
          )}

          <section className="mu-pg-secao" aria-labelledby="dbm-peso-tit">
            <div className="mu-pg-secao__cab">
              <h3 className="mu-pg-secao__tit" id="dbm-peso-tit">
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
                    PV {formatarNumero(encontro.grupo.vida)} · {umaCasa(encontro.grupo.danoPorRodada)} por rodada
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
                    PV {formatarNumero(encontro.inimigos.vida)} · {umaCasa(encontro.inimigos.danoPorRodada)} por rodada
                  </small>
                </h4>
                {npcs.length === 0 ? (
                  <p className="mu-pg-nota">Nenhum NPC de combate nesta pasta. Crie em NPCs de combate.</p>
                ) : (
                  <div className="mu-peso__lista">
                    {npcs.map((personagem) => (
                      <PassoDoInimigo key={personagem.id} personagem={personagem} ranks={ranks} quantos={inimigosNaTela[personagem.id] ?? 0} />
                    ))}
                  </div>
                )}
              </div>
              <Veredito encontro={encontro} personagens={personagens} />
            </div>
          </section>
        </>
      )}
    </div>
  )
}
