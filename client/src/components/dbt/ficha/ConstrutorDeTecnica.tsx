import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { CONDICOES } from '../../../lib/dbt/dados/condicoes'
import {
  ATRIBUTO_DO_TIPO,
  LIMITES_DBT,
  TIPOS_DE_TECNICA,
  novoIdDBT,
  type EfeitoDaFaixaDBT,
  type FaixaDeDanoDBT,
  type IdAtributoDBT,
  type MomentoDaEspecialDBT,
  type RotuloDBT,
  type RotuloEscolhidoDBT,
  type TecnicaDBT,
} from '../../../lib/dbt/modelo'
import { SIGLA_DO_ATRIBUTO } from '../../../lib/dbt/regras/atributos'
import { CUSTO_DO_TIPO, NOME_DO_TIPO, nomeNormalizado } from '../../../lib/dbt/regras/tecnicas'
import { NOME_DA_FAIXA, useMontar } from './AbaTecnicas'
import { useFichaDBT } from './contexto'
import { LINHAS_DE_RANK, ROTULOS_POR_ID, RANKS_DBT, ehRotuloDeTipo, numero, rotuloEscolhido, sinal } from './edicaoDaFicha'
import { Interruptor, Segmentos, Stepper, inteiroDoCampo } from './pecas'

/**
 * CONSTRUTOR GUIADO de técnica (cap. 6 do Livro do Jogador): rank, tipo e
 * rótulos à esquerda; à direita o orçamento, o Ki, a faixa de dano e os avisos
 * saem ao vivo do montador (lib/dbt/regras/tecnicas.ts). A técnica especial
 * troca os rótulos por um efeito escrito, que o mestre aprova.
 *
 * Ocupa o lugar da ficha enquanto aberto (a ficha fica montada e escondida):
 * Esc fecha, perguntando antes se algo mudou; Tab não sai daqui.
 */

type AbaDeRotulos = 'alcance' | 'dano' | 'ki' | 'geral' | 'negativo'

const NOME_DA_ABA: Readonly<Record<AbaDeRotulos, string>> = {
  alcance: 'Alcance',
  dano: 'Dano',
  ki: 'Ki',
  geral: 'Gerais',
  negativo: 'Negativos',
}

const NOME_DO_MOMENTO: Readonly<Record<MomentoDaEspecialDBT, string>> = {
  acao: 'Ação',
  reacao: 'Reação',
  'acao-ou-reacao': 'Ação ou reação',
  passiva: 'Passiva',
}

const ATRIBUTOS_DA_HIBRIDA: readonly IdAtributoDBT[] = ['for', 'int', 'pre']
/** Teto dos steppers de pontos e de Ki investido: o livro não dá teto; o rank segura a conta. */
const PONTOS_MAX = 30
const CONDICOES_COM_VALOR = CONDICOES.filter((c) => c.valor !== null)
const FOCAVEIS = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), summary'

/** Rótulos escolhíveis (o tipo é escolhido à parte), com a aba e o nome de busca. */
const CATALOGO = Array.from(ROTULOS_POR_ID.values())
  .filter((rotulo) => !ehRotuloDeTipo(rotulo))
  .map((rotulo) => ({ rotulo, aba: abaDoRotulo(rotulo), busca: nomeNormalizado(`${rotulo.nome} ${rotulo.custoTexto}`), texto: nomeNormalizado(rotulo.efeito) }))

function abaDoRotulo(rotulo: RotuloDBT): AbaDeRotulos {
  if (rotulo.categoria === 'negativo') return 'negativo'
  if (rotulo.categoria === 'tipo_dano') return 'dano'
  if (rotulo.categoria === 'ki') return 'ki'
  if (rotulo.categoria === 'base' && rotulo.alcance !== null) return 'alcance'
  return 'geral'
}

function ehEscolhaDeCondicao(rotulo: RotuloDBT): boolean {
  return rotulo.custo.tipo === 'igual-ao-efeito-negativo' || nomeNormalizado(rotulo.nome) === 'efeito negativo'
}

/** Unidades compradas com Ki fora dos pontos: Aumentar Dano por Ki (+4 de dano cada) e o raio extra da Fragmentação. */
function kiDoInvestimento(rotulo: RotuloDBT): { rotulo: string } | null {
  if (nomeNormalizado(rotulo.nome) === 'aumentar dano por ki') return { rotulo: 'Ki investido (+4 de dano cada)' }
  const outros = rotulo.modificadorDeKi?.outros ?? {}
  const porUnidade = Object.values(outros).find((v): v is number => typeof v === 'number' && v > 0)
  if (porUnidade === undefined) return null
  return { rotulo: 'por_1_5m_raio_extra' in outros ? `Raio extra, de 1,5 em 1,5 m (+${porUnidade} Ki cada)` : `Unidades extras (+${porUnidade} Ki cada)` }
}

function tecnicaEmBranco(): TecnicaDBT {
  return {
    id: novoIdDBT('tec'),
    nome: '',
    rank: 'E',
    tipo: 'ki',
    atributo: ATRIBUTO_DO_TIPO.ki,
    rotulos: [],
    alcance: '',
    descricao: '',
    ativa: false,
    especial: null,
    efeitoDaFaixa: 'dano',
    kiManual: null,
    danoManual: null,
  }
}

export function ConstrutorDeTecnica({ tecnicaId, onFechar }: { tecnicaId: string | null; onFechar: () => void }) {
  const { ficha, ehMestre, ehNpc, mudarFicha } = useFichaDBT()
  const montar = useMontar()
  const idBase = useId()
  const raiz = useRef<HTMLDivElement>(null)
  const campoDoNome = useRef<HTMLInputElement>(null)
  const original = useMemo(() => (tecnicaId === null ? null : (ficha.tecnicas.find((t) => t.id === tecnicaId) ?? null)), [ficha.tecnicas, tecnicaId])
  const [inicial] = useState<TecnicaDBT>(() => original ?? tecnicaEmBranco())
  const [tecnica, setTecnica] = useState<TecnicaDBT>(inicial)
  // Os rótulos ficam guardados ao passar para especial (que não usa rótulo) e voltam se desistir.
  const [rotulosGuardados, setRotulosGuardados] = useState<RotuloEscolhidoDBT[]>([])
  const [perguntaDeSaida, setPerguntaDeSaida] = useState(false)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)

  const montada = montar(tecnica)
  const rank = RANKS_DBT[tecnica.rank]
  const mudou = JSON.stringify(tecnica) !== JSON.stringify(inicial)
  const especial = tecnica.especial
  const semNome = tecnica.nome.trim() === ''
  const semEfeito = especial !== null && especial.efeito.trim() === ''
  const cheia = original === null && ficha.tecnicas.length >= LIMITES_DBT.tecnicas
  const motivo = semNome
    ? 'Dê um nome à técnica para salvar.'
    : semEfeito
      ? 'Escreva o efeito da técnica especial.'
      : cheia
        ? `A ficha já tem ${LIMITES_DBT.tecnicas} técnicas, o máximo.`
        : !montada.valida && !montada.manual.ki && !montada.manual.dano
          ? 'Corrija os avisos em vermelho para salvar.'
          : null

  useEffect(() => {
    // Abre no topo do construtor, com o foco no nome (o primeiro campo).
    raiz.current?.scrollIntoView({ block: 'start' })
    campoDoNome.current?.focus()
  }, [])

  const trocar = (mudanca: Partial<TecnicaDBT>) => setTecnica((atual) => ({ ...atual, ...mudanca }))
  const trocarRotulo = (indice: number, mudanca: Partial<RotuloEscolhidoDBT>) =>
    setTecnica((atual) => ({ ...atual, rotulos: atual.rotulos.map((r, i) => (i === indice ? { ...r, ...mudanca } : r)) }))
  const tirarRotulo = (indice: number) => setTecnica((atual) => ({ ...atual, rotulos: atual.rotulos.filter((_, i) => i !== indice) }))
  const porRotulo = (rotulo: RotuloDBT) =>
    setTecnica((atual) => {
      const ja = atual.rotulos.findIndex((r) => r.rotuloId === rotulo.id)
      // Clicar de novo tira; o que acumula ganha outra cópia (some pelo "Tirar" da lista).
      if (ja >= 0 && rotulo.acumula !== true) return { ...atual, rotulos: atual.rotulos.filter((_, i) => i !== ja) }
      if (atual.rotulos.length >= LIMITES_DBT.rotulosPorTecnica) return atual
      const novo = { ...rotuloEscolhido(rotulo.id), variavel: rotulo.custo.tipo === 'faixa' ? rotulo.custo.minimo : null }
      return { ...atual, rotulos: [...atual.rotulos, novo] }
    })

  const trocarModo = (modo: 'rotulos' | 'especial') => {
    if (modo === 'especial' && especial === null) {
      setRotulosGuardados(tecnica.rotulos)
      trocar({ rotulos: [], especial: { ofensiva: false, momento: 'acao', efeito: '', aprovada: false }, kiManual: rank.kiMinimoDaEspecial })
    } else if (modo === 'rotulos' && especial !== null) {
      trocar({ rotulos: rotulosGuardados, especial: null, kiManual: null })
    }
  }

  const salvar = () => {
    if (motivo !== null) return
    let final: TecnicaDBT = { ...tecnica, nome: tecnica.nome.trim() }
    // Especial aprovada que o jogador mexeu volta para o mestre aprovar.
    if (!ehMestre && final.especial !== null && final.especial.aprovada && mudou) final = { ...final, especial: { ...final.especial, aprovada: false } }
    mudarFicha((f) => ({ ...f, tecnicas: original === null ? [...f.tecnicas, final] : f.tecnicas.map((t) => (t.id === final.id ? final : t)) }))
    onFechar()
  }
  const excluir = () => {
    if (original === null) return
    mudarFicha((f) => ({ ...f, tecnicas: f.tecnicas.filter((t) => t.id !== original.id) }))
    onFechar()
  }
  const pedirFechar = () => {
    if (mudou) setPerguntaDeSaida(true)
    else onFechar()
  }

  const teclas = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      // Esc fecha só o construtor, não a janela da ficha.
      event.stopPropagation()
      event.preventDefault()
      if (perguntaDeSaida) setPerguntaDeSaida(false)
      else pedirFechar()
      return
    }
    if (event.key !== 'Tab') return
    event.stopPropagation()
    const itens = Array.from(raiz.current?.querySelectorAll<HTMLElement>(FOCAVEIS) ?? []).filter((el) => el.offsetParent !== null)
    if (itens.length === 0) return
    const primeiro = itens[0]
    const ultimo = itens[itens.length - 1]
    if (event.shiftKey && document.activeElement === primeiro) {
      event.preventDefault()
      ultimo.focus()
    } else if (!event.shiftKey && document.activeElement === ultimo) {
      event.preventDefault()
      primeiro.focus()
    }
  }

  const tituloId = `${idBase}-titulo`
  const avisosId = `${idBase}-avisos`

  return (
    <div ref={raiz} className="dbf-builder" role="region" aria-labelledby={tituloId} onKeyDown={teclas}>
      <header className="dbf-builder__head">
        <h3 className="dbf-builder__t" id={tituloId}>
          {original === null ? 'Nova técnica' : 'Editar técnica'}
        </h3>
        <label className="dbf-fld dbf-builder__nome">
          <span>Nome</span>
          <input
            ref={campoDoNome}
            className="dbf-inp"
            value={tecnica.nome}
            maxLength={LIMITES_DBT.nome}
            placeholder="Kamehameha, Soco do Dragão..."
            aria-invalid={semNome}
            onChange={(e) => trocar({ nome: e.target.value })}
          />
        </label>
        <Segmentos
          rotulo="Como a técnica é feita"
          opcoes={[
            { valor: 'rotulos', texto: 'Com rótulos' },
            { valor: 'especial', texto: 'Técnica especial' },
          ]}
          valor={especial === null ? 'rotulos' : 'especial'}
          onTrocar={trocarModo}
        />
        <button type="button" className="dbf-btn dbf-btn--ghost dbf-builder__x" aria-label="Fechar o construtor" onClick={pedirFechar}>
          ×
        </button>
      </header>

      <div className="dbf-builder__body">
        <div className="dbf-builder__esq">
          <EscolhaDoRank valor={tecnica.rank} especial={especial !== null} onTrocar={(r) => trocar({ rank: r, kiManual: especial !== null ? Math.max(tecnica.kiManual ?? 0, RANKS_DBT[r].kiMinimoDaEspecial) : tecnica.kiManual })} />
          {especial === null ? (
            <>
              <fieldset className="dbf-bset">
                <legend>Tipo</legend>
                <div className="dbf-opts dbf-opts--4">
                  {TIPOS_DE_TECNICA.map((tipo) => (
                    <label key={tipo} className="dbf-opt">
                      <input type="radio" name={`${idBase}-tipo`} checked={tecnica.tipo === tipo} onChange={() => trocar({ tipo, atributo: ATRIBUTO_DO_TIPO[tipo] })} />
                      <span className="dbf-opt__n">{NOME_DO_TIPO[tipo]}</span>
                      <span className="dbf-opt__d">
                        {CUSTO_DO_TIPO[tipo] === 0 ? 'grátis' : `${CUSTO_DO_TIPO[tipo]} ${CUSTO_DO_TIPO[tipo] === 1 ? 'ponto' : 'pontos'}`}, acerto {SIGLA_DO_ATRIBUTO[ATRIBUTO_DO_TIPO[tipo]]}
                      </span>
                    </label>
                  ))}
                </div>
                {tecnica.tipo === 'hibrida' && (
                  <label className="dbf-fld dbf-fld--linha">
                    <span>Acerto da híbrida</span>
                    <select className="dbf-sel" value={tecnica.atributo} onChange={(e) => trocar({ atributo: e.target.value as IdAtributoDBT })}>
                      {ATRIBUTOS_DA_HIBRIDA.map((id) => (
                        <option key={id} value={id}>
                          {SIGLA_DO_ATRIBUTO[id]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </fieldset>
              <EscolhaDosRotulos escolhidos={tecnica.rotulos} onRotulo={porRotulo} />
            </>
          ) : (
            <CamposDaEspecial tecnica={tecnica} onTrocar={trocar} ehMestre={ehMestre} />
          )}
          <fieldset className="dbf-bset">
            <legend>Texto da técnica</legend>
            <div className="dbf-builder__linha">
              <label className="dbf-fld">
                <span>Alcance</span>
                <input className="dbf-inp" value={tecnica.alcance} maxLength={LIMITES_DBT.textoCurto} placeholder="Vazio: sai dos rótulos" onChange={(e) => trocar({ alcance: e.target.value })} />
              </label>
              <label className="dbf-fld">
                <span>A faixa mede</span>
                <select className="dbf-sel" value={tecnica.efeitoDaFaixa} onChange={(e) => trocar({ efeitoDaFaixa: e.target.value as EfeitoDaFaixaDBT })}>
                  {(Object.keys(NOME_DA_FAIXA) as EfeitoDaFaixaDBT[]).map((efeito) => (
                    <option key={efeito} value={efeito}>
                      {NOME_DA_FAIXA[efeito]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="dbf-fld">
              <span>Descrição</span>
              <textarea className="dbf-inp dbf-area" rows={3} value={tecnica.descricao} maxLength={LIMITES_DBT.texto} placeholder="Como ela parece na mesa: o gesto, a cor do Ki, o grito." onChange={(e) => trocar({ descricao: e.target.value })} />
            </label>
          </fieldset>
          {ehMestre && <ValoresAMaoDaTecnica tecnica={tecnica} onTrocar={trocar} />}
        </div>

        <aside className="dbf-builder__dir" aria-label="Conta da técnica">
          {especial === null && (
            <div className="dbf-orc">
              <CelulaDoOrcamento rotulo="Base do rank" valor={montada.pontosBase} />
              <CelulaDoOrcamento rotulo="Tipo" valor={-montada.custoDoTipo} />
              <CelulaDoOrcamento rotulo={`Negativos (até ${montada.limiteDeNegativos})`} valor={Math.min(montada.negativos, montada.limiteDeNegativos)} />
              <CelulaDoOrcamento rotulo="Positivos" valor={-(montada.positivos - montada.custoDoTipo)} />
              <CelulaDoOrcamento rotulo="Sobra" valor={montada.sobra} destaque />
            </div>
          )}
          <div className="dbf-res-tec">
            <div>
              <span className="dbf-res-tec__l">Ki por uso</span>
              <span className="dbf-res-tec__ki">
                <b>{montada.ki}</b>
                {montada.multiplicadorDoKi !== 1 && !montada.manual.ki && <i> ×{montada.multiplicadorDoKi}</i>}
              </span>
              <p className="dbf-res-tec__f">{montada.formulaDoKi}</p>
            </div>
            {(especial === null || especial.ofensiva || montada.manual.dano) && (
              <div>
                <span className="dbf-res-tec__l">{NOME_DA_FAIXA[tecnica.efeitoDaFaixa]} mínimo, médio, completo</span>
                <span className="dbf-dn dbf-dn--grande">
                  <i>{numero(montada.faixa.minimo)}</i>
                  <i>{numero(montada.faixa.medio)}</i>
                  <i>{numero(montada.faixa.completo)}</i>
                </span>
                <p className="dbf-res-tec__f">{montada.formulaDoDano}</p>
              </div>
            )}
            <p className="dbf-res-tec__st">
              {especial !== null ? 'Especial: não ocupa ST.' : ehNpc ? `Rank ${rank.rank}: NPC não usa ST.` : `Preparada ocupa ${rank.slots} ST.`}
              {montada.acertoExtra !== 0 && ` Acerto ${sinal(montada.acertoExtra)} pelos rótulos.`}
            </p>
          </div>
          <div id={avisosId} aria-live="polite">
            {montada.avisos.length === 0 ? (
              <p className="dbf-aviso dbf-aviso--calmo">Dentro da regra do livro.</p>
            ) : (
              <ul className="dbf-avisos">
                {montada.avisos.map((a, i) => (
                  <li key={`${a.codigo}-${i}`} className={`dbf-aviso dbf-aviso--${a.gravidade === 'erro' ? 'mal' : 'amber'}`}>
                    {a.texto}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {montada.lembretes.length > 0 && (
            <details className="dbf-mao">
              <summary>Restrições do livro para conferir ({montada.lembretes.length})</summary>
              <ul className="dbf-lembretes">
                {montada.lembretes.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </details>
          )}
          {especial === null && <RotulosEscolhidos tecnica={tecnica} contas={montada.rotulos} onTrocar={trocarRotulo} onTirar={tirarRotulo} />}
        </aside>
      </div>

      <footer className="dbf-builder__foot">
        {perguntaDeSaida ? (
          <>
            <span className="dbf-motivo dbf-motivo--forte" role="alert">
              Fechar sem salvar? As mudanças desta técnica se perdem.
            </span>
            <button type="button" className="dbf-btn dbf-btn--ghost" onClick={() => setPerguntaDeSaida(false)}>
              Continuar editando
            </button>
            <button type="button" className="dbf-btn dbf-btn--mal" onClick={onFechar}>
              Descartar
            </button>
          </>
        ) : (
          <>
            {original !== null &&
              (confirmarExclusao ? (
                <>
                  <button type="button" className="dbf-btn dbf-btn--mal" onClick={excluir}>
                    Excluir de vez
                  </button>
                  <button type="button" className="dbf-btn dbf-btn--ghost" onClick={() => setConfirmarExclusao(false)}>
                    Manter
                  </button>
                </>
              ) : (
                <button type="button" className="dbf-btn dbf-btn--ghost dbf-btn--perigo" onClick={() => setConfirmarExclusao(true)}>
                  Excluir técnica
                </button>
              ))}
            <span className="dbf-builder__esp" />
            {motivo !== null && (
              <span className="dbf-motivo" id={`${idBase}-motivo`}>
                {motivo}
              </span>
            )}
            <button type="button" className="dbf-btn dbf-btn--ghost" onClick={pedirFechar}>
              Cancelar
            </button>
            <button type="button" className="dbf-btn dbf-btn--pri" disabled={motivo !== null} aria-describedby={motivo !== null ? `${idBase}-motivo` : undefined} onClick={salvar}>
              {original === null ? 'Criar técnica' : 'Salvar técnica'}
            </button>
          </>
        )}
      </footer>
    </div>
  )
}

function CelulaDoOrcamento({ rotulo, valor, destaque = false }: { rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <div className={`dbf-orc__c${destaque ? ' dbf-orc__c--sobra' : ''}${destaque && valor < 0 ? ' dbf-orc__c--mal' : ''}`}>
      <span className="dbf-orc__v">{destaque ? valor : sinal(valor)}</span>
      <span className="dbf-orc__l">{rotulo}</span>
    </div>
  )
}

function EscolhaDoRank({ valor, especial, onTrocar }: { valor: TecnicaDBT['rank']; especial: boolean; onTrocar: (rank: TecnicaDBT['rank']) => void }) {
  const { ficha, ehNpc } = useFichaDBT()
  const nome = useId()
  return (
    <fieldset className="dbf-bset">
      <legend>Rank</legend>
      <div className="dbf-opts dbf-opts--6">
        {LINHAS_DE_RANK.map((linha) => {
          const cedo = !ehNpc && ficha.pdl < linha.pdl
          return (
            <label key={linha.rank} className={`dbf-opt dbf-opt--rank${cedo ? ' dbf-opt--cedo' : ''}`} title={cedo ? `Pede ${numero(linha.pdl)} PDL para aprender` : undefined}>
              <input type="radio" name={nome} checked={valor === linha.rank} onChange={() => onTrocar(linha.rank)} />
              <span className="dbf-opt__rk">{linha.rank}</span>
              <span className="dbf-opt__d">
                {especial ? `Ki mín. ${linha.kiMinimoDaEspecial}` : `${linha.pontosDeRotuloBase} pts, ${linha.slots} ST`}
                <br />
                {especial ? linha.nome : `dano ${linha.danoMin}–${linha.danoMax}`}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

function EscolhaDosRotulos({ escolhidos, onRotulo }: { escolhidos: readonly RotuloEscolhidoDBT[]; onRotulo: (rotulo: RotuloDBT) => void }) {
  const [busca, setBusca] = useState('')
  const [aba, setAba] = useState<AbaDeRotulos>('alcance')
  const [emFoco, setEmFoco] = useState<RotuloDBT | null>(null)
  const campo = useRef<HTMLInputElement>(null)
  const idBase = useId()
  const quantos = new Map<string, number>()
  for (const r of escolhidos) quantos.set(r.rotuloId, (quantos.get(r.rotuloId) ?? 0) + 1)

  const termos = nomeNormalizado(busca).split(' ').filter((t) => t !== '')
  const buscando = termos.length > 0
  // Busca tolerante: cada palavra no nome; com 3+ letras também no texto do efeito (que vem depois).
  const peloNome = buscando ? CATALOGO.filter((c) => termos.every((t) => c.busca.includes(t))) : CATALOGO.filter((c) => c.aba === aba)
  const peloTexto = buscando && busca.trim().length >= 3 ? CATALOGO.filter((c) => !peloNome.includes(c) && termos.every((t) => c.texto.includes(t))) : []
  const lista = [...peloNome, ...peloTexto]
  const contagem = (a: AbaDeRotulos) => CATALOGO.filter((c) => c.aba === a).length
  const detalhe = emFoco ?? lista[0]?.rotulo ?? null

  // "/" leva à busca, fora de campo de texto.
  const atalho = (event: KeyboardEvent<HTMLFieldSetElement>) => {
    const alvo = event.target as HTMLElement
    if (event.key !== '/' || alvo.closest('input, textarea, select') !== null) return
    event.preventDefault()
    campo.current?.focus()
  }

  return (
    <fieldset className="dbf-bset" onKeyDown={atalho}>
      <legend>Rótulos</legend>
      <div className="dbf-busca">
        <input
          ref={campo}
          type="search"
          className="dbf-inp"
          value={busca}
          maxLength={60}
          aria-label="Buscar rótulo pelo nome"
          aria-controls={`${idBase}-lista`}
          placeholder="Buscar rótulo (atalho /)"
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && busca !== '') {
              e.stopPropagation()
              setBusca('')
            }
          }}
        />
      </div>
      {!buscando && (
        <Segmentos
          rotulo="Categoria de rótulo"
          className="dbf-seg--abas"
          opcoes={(Object.keys(NOME_DA_ABA) as AbaDeRotulos[]).map((a) => ({ valor: a, texto: `${NOME_DA_ABA[a]} ${contagem(a)}` }))}
          valor={aba}
          onTrocar={setAba}
        />
      )}
      <div className="dbf-rlist" id={`${idBase}-lista`}>
        {lista.length === 0 && <p className="dbf-vazio dbf-vazio--curto">Nenhum rótulo com “{busca.trim()}”. Tente parte do nome: “cone”, “dreno”, “precisão”.</p>}
        {lista.map(({ rotulo }, i) => {
          const n = quantos.get(rotulo.id) ?? 0
          const primeiraDoTexto = peloTexto.length > 0 && i === peloNome.length
          return (
            <div key={rotulo.id} className="dbf-rlist__item">
              {primeiraDoTexto && <p className="dbf-rlist__sep">Citados no texto</p>}
              <button
                type="button"
                className={`dbf-rot${n > 0 ? ' dbf-rot--on' : ''}${rotulo.categoria === 'negativo' ? ' dbf-rot--neg' : ''}`}
                aria-pressed={n > 0}
                onClick={() => onRotulo(rotulo)}
                onFocus={() => setEmFoco(rotulo)}
                onMouseEnter={() => setEmFoco(rotulo)}
              >
                <span className="dbf-rot__n">{rotulo.nome}</span>
                {n > 1 && <span className="dbf-rot__x">×{n}</span>}
                <span className="dbf-rot__c">{rotulo.custoTexto}</span>
              </button>
            </div>
          )
        })}
      </div>
      {detalhe !== null && <DetalheDoRotulo rotulo={detalhe} escolhido={(quantos.get(detalhe.id) ?? 0) > 0} />}
    </fieldset>
  )
}

function DetalheDoRotulo({ rotulo, escolhido }: { rotulo: RotuloDBT; escolhido: boolean }) {
  const ki = rotulo.modificadorDeKi
  const partesDoKi: string[] = []
  if (ki !== null) {
    if (ki.inicial !== null) partesDoKi.push(`${sinal(ki.inicial)} Ki`)
    if (ki.porPontoExtra !== null) partesDoKi.push(`${sinal(ki.porPontoExtra)} Ki por ponto extra`)
    if (ki.porRotulo !== null) partesDoKi.push(`${sinal(ki.porRotulo)} Ki por cópia`)
    if (ki.porPontoNegativo !== null) partesDoKi.push(`${sinal(ki.porPontoNegativo)} Ki por ponto negativo`)
    if (ki.multiplicador !== null) partesDoKi.push(`Ki ×${ki.multiplicador} no uso`)
  }
  return (
    <div className="dbf-rdet" aria-live="polite">
      <p className="dbf-rdet__t">
        {rotulo.nome} <span>{rotulo.custoTexto} {rotulo.categoria === 'negativo' ? '(devolve pontos)' : ''}</span>
        {escolhido && <span className="dbf-tag dbf-tag--amber">Na técnica</span>}
      </p>
      {partesDoKi.length > 0 && <p className="dbf-rdet__ki">{partesDoKi.join(', ')}</p>}
      <p className="dbf-rdet__ef">{rotulo.efeito}</p>
      {rotulo.restricoes.length > 0 && <p className="dbf-rdet__r">{rotulo.restricoes.join(' ')}</p>}
      <p className="dbf-rdet__p">Livro do Jogador, p. {rotulo.pagina}{rotulo.acumula === true ? '. Acumula: cada clique põe mais uma cópia.' : ''}</p>
    </div>
  )
}

function RotulosEscolhidos({
  tecnica,
  contas,
  onTrocar,
  onTirar,
}: {
  tecnica: TecnicaDBT
  contas: readonly { rotuloId: string; pontos: number; ki: number; dano: number }[]
  onTrocar: (indice: number, mudanca: Partial<RotuloEscolhidoDBT>) => void
  onTirar: (indice: number) => void
}) {
  if (tecnica.rotulos.length === 0) {
    return <p className="dbf-vazio dbf-vazio--curto">Nenhum rótulo ainda. Comece pelo alcance (Projétil, Cone, Estocada...) e depois o que a técnica faz.</p>
  }
  // A conta do montador vem na ordem dos rótulos válidos: casa pelo id, cópia a cópia.
  const usadas = new Map<string, number>()
  return (
    <ul className="dbf-chosen" aria-label="Rótulos da técnica">
      {tecnica.rotulos.map((escolhido, indice) => {
        const rotulo = ROTULOS_POR_ID.get(escolhido.rotuloId)
        const vez = usadas.get(escolhido.rotuloId) ?? 0
        usadas.set(escolhido.rotuloId, vez + 1)
        const conta = contas.filter((c) => c.rotuloId === escolhido.rotuloId)[vez]
        return (
          <li key={indice} className="dbf-chosen__i">
            <div className="dbf-chosen__top">
              <span className="dbf-chosen__n">{rotulo?.nome ?? escolhido.rotuloId}</span>
              <span className={`dbf-chosen__p${conta !== undefined && conta.pontos < 0 ? ' dbf-chosen__p--neg' : ''}`}>
                {conta === undefined ? 'não conta' : `${sinal(conta.pontos)} pts${conta.ki !== 0 ? `, ${sinal(conta.ki)} Ki` : ''}${conta.dano !== 0 ? `, +${conta.dano} dano` : ''}`}
              </span>
              <button type="button" className="dbf-btn dbf-btn--xs dbf-btn--ghost" aria-label={`Tirar ${rotulo?.nome ?? 'rótulo'}`} onClick={() => onTirar(indice)}>
                Tirar
              </button>
            </div>
            {rotulo !== undefined && <ControlesDoRotulo rotulo={rotulo} escolhido={escolhido} onTrocar={(m) => onTrocar(indice, m)} />}
          </li>
        )
      })}
    </ul>
  )
}

function ControlesDoRotulo({ rotulo, escolhido, onTrocar }: { rotulo: RotuloDBT; escolhido: RotuloEscolhidoDBT; onTrocar: (mudanca: Partial<RotuloEscolhidoDBT>) => void }) {
  const custo = rotulo.custo
  const controles: ReactNode[] = []
  if (custo.tipo === 'variavel' && custo.minimo !== null) {
    controles.push(
      <span key="extras" className="dbf-chosen__ctl">
        <span>Pontos extras</span>
        <Stepper rotulo={`pontos extras de ${rotulo.nome}`} valor={escolhido.pontosExtras} podeMenos={escolhido.pontosExtras > 0} podeMais={escolhido.pontosExtras < PONTOS_MAX} onMenos={() => onTrocar({ pontosExtras: escolhido.pontosExtras - 1 })} onMais={() => onTrocar({ pontosExtras: escolhido.pontosExtras + 1 })} />
      </span>,
    )
  }
  if (custo.tipo === 'faixa') {
    const menor = Math.min(custo.minimo, custo.maximo)
    const maior = Math.max(custo.minimo, custo.maximo)
    const atual = escolhido.variavel ?? custo.minimo
    controles.push(
      <span key="faixa" className="dbf-chosen__ctl">
        <span>Valor ({custo.minimo} a {custo.maximo})</span>
        <Stepper rotulo={`valor de ${rotulo.nome}`} valor={atual} podeMenos={atual > menor} podeMais={atual < maior} onMenos={() => onTrocar({ variavel: atual - 1 })} onMais={() => onTrocar({ variavel: atual + 1 })} />
      </span>,
    )
  }
  if (ehEscolhaDeCondicao(rotulo)) {
    controles.push(
      <label key="condicao" className="dbf-chosen__ctl">
        <span>Condição</span>
        <select
          className="dbf-sel"
          value={escolhido.nota}
          onChange={(e) => {
            const condicao = CONDICOES_COM_VALOR.find((c) => c.nome === e.target.value)
            onTrocar({ nota: e.target.value, variavel: condicao?.valor ?? null })
          }}
        >
          <option value="">Escolher...</option>
          {CONDICOES_COM_VALOR.map((c) => (
            <option key={c.id} value={c.nome}>
              {c.nome} ({c.valor})
            </option>
          ))}
        </select>
      </label>,
    )
  } else if (custo.tipo === 'variavel' && custo.minimo === null) {
    const atual = Math.abs(escolhido.variavel ?? 0)
    controles.push(
      <span key="variavel" className="dbf-chosen__ctl">
        <span>Pontos</span>
        <Stepper rotulo={`pontos de ${rotulo.nome}`} valor={escolhido.variavel === null ? '?' : atual} podeMenos={atual > 0} podeMais={atual < PONTOS_MAX} onMenos={() => onTrocar({ variavel: atual - 1 })} onMais={() => onTrocar({ variavel: atual + 1 })} />
      </span>,
    )
  }
  const investimento = kiDoInvestimento(rotulo)
  if (investimento !== null) {
    controles.push(
      <span key="investimento" className="dbf-chosen__ctl">
        <span>{investimento.rotulo}</span>
        <Stepper rotulo={investimento.rotulo} valor={escolhido.investimento} podeMenos={escolhido.investimento > 0} podeMais={escolhido.investimento < PONTOS_MAX} onMenos={() => onTrocar({ investimento: escolhido.investimento - 1 })} onMais={() => onTrocar({ investimento: escolhido.investimento + 1 })} />
      </span>,
    )
  }
  if (!ehEscolhaDeCondicao(rotulo)) {
    controles.push(
      <label key="nota" className="dbf-chosen__ctl dbf-chosen__ctl--nota">
        <span className="lb-sr-only">Anotação de {rotulo.nome}</span>
        <input className="dbf-inp dbf-inp--fino" value={escolhido.nota} maxLength={LIMITES_DBT.textoCurto} placeholder="Anotação (elemento, atributo...)" onChange={(e) => onTrocar({ nota: e.target.value })} />
      </label>,
    )
  }
  return <div className="dbf-chosen__ctls">{controles}</div>
}

function CamposDaEspecial({ tecnica, onTrocar, ehMestre }: { tecnica: TecnicaDBT; onTrocar: (mudanca: Partial<TecnicaDBT>) => void; ehMestre: boolean }) {
  const especial = tecnica.especial
  if (especial === null) return null
  const minimo = RANKS_DBT[tecnica.rank].kiMinimoDaEspecial
  const ki = tecnica.kiManual ?? minimo
  const trocarEspecial = (mudanca: Partial<NonNullable<TecnicaDBT['especial']>>) => onTrocar({ especial: { ...especial, ...mudanca } })
  return (
    <fieldset className="dbf-bset">
      <legend>Técnica especial</legend>
      <p className="dbf-nota">O que nenhum rótulo cobre: não usa orçamento nem ST. {ehMestre ? 'A ofensiva só o mestre cria.' : 'O mestre aprova antes de usar; ofensiva só o mestre cria.'}</p>
      <div className="dbf-builder__linha">
        <div className="dbf-fld">
          <span>Quando</span>
          <Segmentos
            rotulo="Quando a técnica especial é usada"
            opcoes={(Object.keys(NOME_DO_MOMENTO) as MomentoDaEspecialDBT[]).map((m) => ({ valor: m, texto: NOME_DO_MOMENTO[m] }))}
            valor={especial.momento}
            onTrocar={(momento) => trocarEspecial({ momento })}
          />
        </div>
        <div className="dbf-fld">
          <span>Ki por uso (mínimo {minimo})</span>
          <Stepper rotulo="Ki da técnica especial" valor={ki} podeMenos={ki > minimo} podeMais={ki < 999} onMenos={() => onTrocar({ kiManual: ki - 1 })} onMais={() => onTrocar({ kiManual: ki + 1 })} />
        </div>
      </div>
      <label className="dbf-fld">
        <span>Efeito</span>
        <textarea
          className="dbf-inp dbf-area"
          rows={4}
          value={especial.efeito}
          maxLength={LIMITES_DBT.texto}
          aria-invalid={especial.efeito.trim() === ''}
          placeholder="O que acontece, em quem, por quanto tempo e como resiste."
          onChange={(e) => trocarEspecial({ efeito: e.target.value })}
        />
      </label>
      {ehMestre ? (
        <div className="dbf-builder__linha">
          <Interruptor ligado={especial.ofensiva} onTrocar={() => trocarEspecial({ ofensiva: !especial.ofensiva })}>
            Ofensiva (dano mínimo do rank)
          </Interruptor>
          <Interruptor ligado={especial.aprovada} onTrocar={() => trocarEspecial({ aprovada: !especial.aprovada })}>
            Aprovada pelo mestre
          </Interruptor>
        </div>
      ) : (
        <p className="dbf-aviso dbf-aviso--calmo">{especial.aprovada ? 'Aprovada pelo mestre. Mudar o texto ou o Ki volta para ele aprovar.' : 'Fica marcada como “aguarda o mestre” até ele aprovar.'}</p>
      )}
    </fieldset>
  )
}

/** Só o mestre: Ki e faixa impressos (técnica de NPC pronto, regra da mesa) vencem a conta. */
function ValoresAMaoDaTecnica({ tecnica, onTrocar }: { tecnica: TecnicaDBT; onTrocar: (mudanca: Partial<TecnicaDBT>) => void }) {
  const faixa = tecnica.danoManual
  const trocarFaixa = (parte: keyof FaixaDeDanoDBT, texto: string) => {
    const valor = inteiroDoCampo(texto)
    if (valor === null && texto.trim() !== '') return
    const base: FaixaDeDanoDBT = faixa ?? { minimo: 0, medio: 0, completo: 0 }
    const proxima = { ...base, [parte]: Math.max(0, valor ?? 0) }
    onTrocar({ danoManual: proxima.minimo === 0 && proxima.medio === 0 && proxima.completo === 0 ? null : proxima })
  }
  const aberto = (tecnica.especial === null && tecnica.kiManual !== null) || faixa !== null
  return (
    <details className="dbf-mao" open={aberto}>
      <summary>Valores à mão (mestre)</summary>
      <p className="dbf-nota">Vazio = a conta do livro. Use para técnica de NPC pronto ou regra da mesa.</p>
      <div className="dbf-mao__grade">
        {tecnica.especial === null && (
          <label className="dbf-fld">
            <span>Ki</span>
            <input
              className="dbf-inp dbf-inp--num"
              inputMode="numeric"
              value={tecnica.kiManual ?? ''}
              placeholder="conta"
              onChange={(e) => {
                const valor = inteiroDoCampo(e.target.value)
                if (e.target.value.trim() === '') onTrocar({ kiManual: null })
                else if (valor !== null) onTrocar({ kiManual: Math.max(0, valor) })
              }}
            />
          </label>
        )}
        {(['minimo', 'medio', 'completo'] as const).map((parte) => (
          <label key={parte} className="dbf-fld">
            <span>{parte === 'minimo' ? 'Mínimo' : parte === 'medio' ? 'Médio' : 'Completo'}</span>
            <input className="dbf-inp dbf-inp--num" inputMode="numeric" value={faixa === null ? '' : faixa[parte]} placeholder="conta" onChange={(e) => trocarFaixa(parte, e.target.value)} />
          </label>
        ))}
      </div>
    </details>
  )
}
