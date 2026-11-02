import { useId, useState, type FormEvent } from 'react'
import { CATEGORIAS_DE_NPC, LIMITES_DBT, RANKS, type CategoriaDeNpcDBT, type RankDBT } from '../../../lib/dbt/modelo'
import { NOME_DA_CATEGORIA, PDL_DO_MARCO_DE_EP, PDL_DO_MARCO_DE_VIDA } from '../../../lib/dbt/regras/ficha'
import { CampoQueColaImagem } from '../../CampoQueColaImagem'
import { ImagemOuIniciais } from '../../FichaPecas'
import { useFichaDBT } from './contexto'
import { comTipo, descansoLongo, ND_MAX, NPC_PADRAO, numero, RACAS_DO_BASICO, RACAS_DOS_SUPLEMENTOS, racaPorId, somarPdl } from './edicaoDaFicha'
import { Formula, inteiroDoCampo, Segmentos, Stepper } from './pecas'

/**
 * O topo da ficha: quem é (retrato, nome, raça), o poder (PDL e marcos, ou o
 * ND do NPC para o mestre) e a Escala de Poder. Embaixo, PV e PK.
 */

const RACA_LIVRE = '__livre__'
/** Teto do PV extra por 10.000 PDL de uma raça livre (o leitor do disco aceita até 1000). */
const VIDA_DA_RACA_LIVRE_MAX = 100
const EP_INICIAL_MAX = 20

export function CabecalhoDBT({ tituloId, escolherImagem }: { tituloId?: string; escolherImagem: () => Promise<string | null> }) {
  const { ehNpc, ehMestre } = useFichaDBT()
  return (
    <section className="dbf-hero" aria-label="Identidade e poder">
      <Identidade tituloId={tituloId} escolherImagem={escolherImagem} />
      {ehNpc && ehMestre ? <NivelDeDesafio /> : <PoderDeLuta />}
      <EscalaDePoder />
    </section>
  )
}

function Mira() {
  return (
    <>
      <span className="dbf-mira dbf-mira--a" aria-hidden="true" />
      <span className="dbf-mira dbf-mira--b" aria-hidden="true" />
    </>
  )
}

function Identidade({ tituloId, escolherImagem }: { tituloId?: string; escolherImagem: () => Promise<string | null> }) {
  const { personagem, ficha, raca, variante, editando, ehMestre, ehNpc, mudar, mudarFicha } = useFichaDBT()
  const idBase = useId()
  const [erroDoRetrato, setErroDoRetrato] = useState<string | null>(null)

  const pedirRetrato = async () => {
    setErroDoRetrato(null)
    try {
      const retrato = await escolherImagem()
      if (retrato !== null) mudar((p) => ({ ...p, retrato }))
    } catch (erro) {
      setErroDoRetrato(erro instanceof Error ? erro.message : String(erro))
    }
  }

  const trocarRaca = (valor: string) => {
    if (valor === RACA_LIVRE) {
      mudarFicha((f) => ({ ...f, raca: '', variante: '', racaLivre: f.racaLivre ?? { nome: 'Raça livre', vidaPor10k: 0 } }))
      return
    }
    const nova = racaPorId(valor)
    // Raça com uma variação só: a variante vazia vale (os traços estão na raça).
    const primeiraVariante = nova !== null && nova.variantes.length > 0 ? nova.variantes[0].id : ''
    mudarFicha((f) => ({ ...f, raca: valor, variante: primeiraVariante, racaLivre: null }))
  }

  const lente = (
    <span className="dbf-lente__foto">
      <ImagemOuIniciais imagem={personagem.retrato} nome={personagem.nome} alt={editando ? '' : `Retrato de ${personagem.nome}`} />
    </span>
  )

  return (
    <div className="dbf-id">
      {editando ? (
        <CampoQueColaImagem className="dbf-lente-cola" rotulo={`Retrato de ${personagem.nome}: clique e cole com Ctrl+V`} onImagem={(retrato) => mudar((p) => ({ ...p, retrato }))} onAviso={setErroDoRetrato}>
          <button type="button" className="dbf-lente" aria-label={personagem.retrato === null ? 'Escolher retrato' : 'Trocar retrato'} onClick={() => void pedirRetrato()}>
            {lente}
            <span className="dbf-lente__dica" aria-hidden="true">
              {personagem.retrato === null ? 'Retrato' : 'Trocar'}
            </span>
          </button>
        </CampoQueColaImagem>
      ) : (
        <div className="dbf-lente">{lente}</div>
      )}
      <div className="dbf-id__txt">
        {editando ? (
          <>
            <h2 id={tituloId} className="lb-sr-only">
              {personagem.nome}
            </h2>
            <label className="lb-sr-only" htmlFor={`${idBase}-nome`}>
              Nome do personagem
            </label>
            <input
              id={`${idBase}-nome`}
              className="dbf-nome"
              value={personagem.nome}
              maxLength={LIMITES_DBT.nome}
              placeholder="Nome do personagem"
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => mudar((p) => ({ ...p, nome: event.target.value }))}
            />
          </>
        ) : (
          <h2 id={tituloId} className="dbf-nome dbf-nome--lido">
            {personagem.nome}
          </h2>
        )}
        {editando ? (
          <div className="dbf-id__linha">
            <label className="lb-sr-only" htmlFor={`${idBase}-raca`}>
              Raça
            </label>
            <select id={`${idBase}-raca`} className="dbf-sel" value={ficha.racaLivre !== null ? RACA_LIVRE : ficha.raca} onChange={(event) => trocarRaca(event.target.value)}>
              <option value="">Escolha a raça</option>
              <optgroup label="Livro do Jogador">
                {RACAS_DO_BASICO.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Suplementos de fã">
                {RACAS_DOS_SUPLEMENTOS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome}
                  </option>
                ))}
              </optgroup>
              <option value={RACA_LIVRE}>Raça livre, combinada com o mestre</option>
            </select>
            {raca !== null && raca.variantes.length > 0 && (
              <>
                <label className="lb-sr-only" htmlFor={`${idBase}-variante`}>
                  Variante
                </label>
                <select id={`${idBase}-variante`} className="dbf-sel" value={ficha.variante} onChange={(event) => mudarFicha((f) => ({ ...f, variante: event.target.value }))}>
                  {raca.variantes.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nome}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        ) : (
          <p className="dbf-id__linha">
            {ficha.racaLivre !== null ? (
              <>
                <span className="dbf-tag">{ficha.racaLivre.nome}</span>
                <span className="dbf-tag dbf-tag--fraca">Raça livre</span>
              </>
            ) : raca !== null ? (
              <>
                <span className="dbf-tag">{raca.nome}</span>
                {variante !== null && raca.variantes.length > 1 && <span className="dbf-tag">{variante.nome}</span>}
                {raca.fonte === 'suplemento' && <span className="dbf-tag dbf-tag--fraca">Suplemento</span>}
              </>
            ) : (
              <span className="dbf-tag dbf-tag--fraca">Sem raça</span>
            )}
            {ehNpc && <span className="dbf-tag dbf-tag--amber">NPC</span>}
          </p>
        )}
        {editando && ficha.racaLivre !== null && (
          <div className="dbf-id__livre">
            <label className="dbf-fld">
              Nome da raça
              <input
                className="dbf-inp"
                value={ficha.racaLivre.nome}
                maxLength={LIMITES_DBT.nome}
                onChange={(event) => mudarFicha((f) => ({ ...f, racaLivre: { nome: event.target.value, vidaPor10k: f.racaLivre?.vidaPor10k ?? 0 } }))}
              />
            </label>
            <label className="dbf-fld">
              PV a cada 10 mil PDL
              <input
                className="dbf-inp dbf-inp--num dbf-inp--curto"
                type="number"
                min={0}
                max={VIDA_DA_RACA_LIVRE_MAX}
                value={ficha.racaLivre.vidaPor10k}
                onChange={(event) => {
                  const valor = inteiroDoCampo(event.target.value)
                  if (valor === null) return
                  mudarFicha((f) => ({ ...f, racaLivre: { nome: f.racaLivre?.nome ?? '', vidaPor10k: Math.min(VIDA_DA_RACA_LIVRE_MAX, Math.max(0, valor)) } }))
                }}
              />
            </label>
          </div>
        )}
        {editando && ehMestre && (
          <Segmentos
            rotulo="Tipo de ficha"
            className="dbf-seg--tipo"
            opcoes={[
              { valor: 'jogador', texto: 'Jogador' },
              { valor: 'npc', texto: 'NPC' },
            ]}
            valor={personagem.tipo}
            onTrocar={(tipo) => mudar((p) => comTipo(p, tipo))}
          />
        )}
        {erroDoRetrato !== null && (
          <p className="dbf-erro" role="alert">
            {erroDoRetrato}
          </p>
        )}
      </div>
    </div>
  )
}

/** O que cada marco de 10.000 PDL dá (3.0.11, p. 14), curto para a trilha. */
function PoderDeLuta() {
  const { ficha, derivados, editando, mudarFicha } = useFichaDBT()
  const idBase = useId()
  const [ganho, setGanho] = useState('')
  const pdl = ficha.pdl
  const inicioDaJanela = Math.floor(pdl / PDL_DO_MARCO_DE_EP) * PDL_DO_MARCO_DE_EP
  const fracao = (pdl - inicioDaJanela) / PDL_DO_MARCO_DE_EP
  const proximo = derivados.proximosMarcos[0]
  const marcas = [1, 2, 3, 4].map((i) => inicioDaJanela + i * PDL_DO_MARCO_DE_VIDA)

  const somar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const valor = inteiroDoCampo(ganho)
    if (valor === null || valor === 0) return
    mudarFicha((f) => somarPdl(f, valor))
    setGanho('')
  }

  return (
    <div className="dbf-scan">
      <Mira />
      <div className="dbf-scan__top">
        <h3 className="dbf-scan__lbl" id={`${idBase}-pdl`}>
          Poder de luta
        </h3>
        {editando && (
          <form className="dbf-ganho" onSubmit={somar}>
            <label className="lb-sr-only" htmlFor={`${idBase}-ganho`}>
              PDL para somar (negativo corrige)
            </label>
            <input id={`${idBase}-ganho`} className="dbf-inp dbf-inp--num" type="number" step={500} inputMode="numeric" placeholder="+ PDL" value={ganho} onChange={(event) => setGanho(event.target.value)} />
            <button type="submit" className="dbf-btn dbf-btn--sm" disabled={inteiroDoCampo(ganho) === null || inteiroDoCampo(ganho) === 0}>
              Somar
            </button>
          </form>
        )}
      </div>
      <div className="dbf-scan__linha">
        <p className="dbf-scan__num" aria-labelledby={`${idBase}-pdl`}>
          <span>{numero(pdl)}</span>
          <span className="dbf-scan__un">PDL</span>
        </p>
        {proximo !== undefined && (
          <span className="dbf-scan__falta">
            faltam <b>{numero(proximo.falta)}</b> para {numero(proximo.pdl)}
          </span>
        )}
      </div>
      <div className="dbf-trilha" role="img" aria-label={`${numero(pdl)} PDL. Próximo marco em ${numero(proximo?.pdl ?? pdl)}.`}>
        <div className="dbf-trilha__bar">
          <span className="dbf-trilha__fill" style={{ transform: `scaleX(${fracao})` }} />
        </div>
        <ol className="dbf-trilha__tk" aria-hidden="true">
          {marcas.map((marca, i) => (
            <li key={marca} className={`dbf-tk${pdl >= marca ? ' dbf-tk--ok' : ''}`} style={{ left: `${(i + 1) * 25}%` }}>
              <span className="dbf-tk__v">{numero(marca / 1000)} mil</span>
            </li>
          ))}
        </ol>
      </div>
      {proximo !== undefined && <p className="dbf-prox">No marco: {proximo.ganhos.join(', ')}.</p>}
    </div>
  )
}

function NivelDeDesafio() {
  const { ficha, derivados, editando, mudarFicha } = useFichaDBT()
  const idBase = useId()
  const npc = ficha.npc ?? NPC_PADRAO
  const mudarNpc = (mudanca: Partial<typeof npc>) => mudarFicha((f) => ({ ...f, npc: { ...(f.npc ?? NPC_PADRAO), ...mudanca } }))
  return (
    <div className="dbf-scan">
      <Mira />
      <div className="dbf-scan__top">
        <h3 className="dbf-scan__lbl" id={`${idBase}-nd`}>
          Nível de desafio, golpes que aguenta
        </h3>
      </div>
      <div className="dbf-nd">
        {editando && npc.nd !== null ? (
          <Stepper
            rotulo="ND"
            className="dbf-stepper--grande"
            valor={<span className="dbf-scan__num">{npc.nd}</span>}
            podeMenos={npc.nd > 1}
            podeMais={npc.nd < ND_MAX}
            onMenos={() => mudarNpc({ nd: Math.max(1, (npc.nd ?? 1) - 1) })}
            onMais={() => mudarNpc({ nd: Math.min(ND_MAX, (npc.nd ?? 0) + 1) })}
          />
        ) : (
          <p className="dbf-scan__num" aria-labelledby={`${idBase}-nd`}>
            {npc.nd ?? '—'}
          </p>
        )}
        {editando && npc.nd === null && (
          <button type="button" className="dbf-btn dbf-btn--sm" onClick={() => mudarNpc({ nd: 1 })}>
            Escolher ND
          </button>
        )}
        <div className="dbf-nd__cfg">
          {editando ? (
            <>
              <Segmentos<CategoriaDeNpcDBT>
                rotulo="Categoria do NPC"
                opcoes={CATEGORIAS_DE_NPC.map((c) => ({ valor: c, texto: NOME_DA_CATEGORIA[c] }))}
                valor={npc.categoria}
                onTrocar={(categoria) => mudarNpc({ categoria })}
              />
              <label className="dbf-nd__rank">
                Rank de referência
                <select className="dbf-sel" value={npc.rank} onChange={(event) => mudarNpc({ rank: RANKS.find((r) => r === event.target.value) ?? 'E' })}>
                  {RANKS.map((r: RankDBT) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <p className="dbf-id__linha">
              <span className="dbf-tag">{NOME_DA_CATEGORIA[npc.categoria]}</span>
              <span className="dbf-tag">Rank {npc.rank}</span>
            </p>
          )}
        </div>
      </div>
      <p className="dbf-prox">
        <Formula titulo="PV do NPC" conta={derivados.pvMax.formula} nota="NPC não usa a regra de vida do jogador (Livro do Narrador 4.0.2).">
          PV <b>{numero(derivados.pvMax.valor)}</b>
        </Formula>{' '}
        <span className="dbf-prox__falta">{npc.nd === null ? 'Sem ND, vale a conta do jogador.' : 'pela tabela de vida por golpe'}</span>
      </p>
    </div>
  )
}

function EscalaDePoder() {
  const { ficha, derivados, editando, mudarFicha } = useFichaDBT()
  const idBase = useId()
  const ativa = ficha.transformacoes.find((t) => t.id === ficha.transformacaoAtiva) ?? null
  return (
    <div className="dbf-scan">
      <Mira />
      <h3 className="dbf-scan__lbl" id={`${idBase}-ep`}>
        Escala de poder
      </h3>
      <div className="dbf-ep">
        <p className="dbf-scan__num dbf-scan__num--ep">
          <Formula titulo="Escala de poder total" conta={derivados.epTotal.formula} nota="É a EP que soma nas rolagens." rotulo={`Escala de poder total ${derivados.epTotal.valor}`}>
            {derivados.epTotal.valor}
          </Formula>
        </p>
        <dl className="dbf-ep__parts">
          <div className="dbf-ep__p">
            <dt>base</dt>
            <dd>
              <Formula titulo="EP base" conta={derivados.epBase.formula} nota="Entra na CA e nas perícias treinadas.">
                {derivados.epBase.valor}
              </Formula>
            </dd>
          </div>
          <div className={`dbf-ep__p${ativa !== null ? ' dbf-ep__p--on' : ''}`}>
            <dt>forma</dt>
            <dd>{ativa !== null ? `+${ativa.ep}` : '0'}</dd>
          </div>
        </dl>
      </div>
      {editando ? (
        <div className="dbf-ep__ini">
          <span id={`${idBase}-ini`}>EP inicial dada pelo mestre</span>
          <Stepper
            rotulo="EP inicial"
            valor={ficha.epInicial}
            podeMenos={ficha.epInicial > 0}
            podeMais={ficha.epInicial < EP_INICIAL_MAX}
            onMenos={() => mudarFicha((f) => ({ ...f, epInicial: Math.max(0, f.epInicial - 1) }))}
            onMais={() => mudarFicha((f) => ({ ...f, epInicial: Math.min(EP_INICIAL_MAX, f.epInicial + 1) }))}
          />
        </div>
      ) : (
        <p className={`dbf-ep__forma${ativa !== null ? ' dbf-ep__forma--on' : ''}`}>{ativa !== null ? ativa.nome : 'Forma normal'}</p>
      )}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// PV e PK
// ───────────────────────────────────────────────────────────────────────────

export function RecursosDBT() {
  return (
    <section className="dbf-res" aria-label="Pontos de vida e Ki">
      <Medidor recurso="pv" />
      <Medidor recurso="pk" />
    </section>
  )
}

const QUANTIA_PADRAO = 1

function Medidor({ recurso }: { recurso: 'pv' | 'pk' }) {
  const tela = useFichaDBT()
  const { personagem, ficha, derivados, editando, ajustar, mudar, mudarFicha } = tela
  const idBase = useId()
  const [quantia, setQuantia] = useState(String(QUANTIA_PADRAO))
  const ehPv = recurso === 'pv'
  const atual = ehPv ? tela.pvAtual : tela.pkAtual
  const maximo = ehPv ? tela.pvMax : tela.pkMax
  const derivado = ehPv ? derivados.pvMax : derivados.pkMax
  const bloqueado = ehPv ? 0 : Math.min(maximo, ficha.kiBloqueado)
  const fracao = maximo > 0 ? Math.min(1, atual / maximo) : 0
  const valorDaQuantia = inteiroDoCampo(quantia)
  const quantiaValida = valorDaQuantia !== null && valorDaQuantia > 0
  const nome = ehPv ? 'PV' : 'PK'
  const regraDiverge = !editando && personagem.maximos[recurso] !== undefined && derivado.valor !== maximo

  const mandar = (valor: number) => ajustar?.({ parte: 'recurso', chave: recurso, valor: Math.min(maximo, Math.max(0, valor)) })

  let legenda: string
  if (ehPv) legenda = atual === 0 ? 'Em 0 PV: inconsciente, e a forma ativa termina.' : 'Volta ao máximo no descanso longo.'
  else legenda = `Volta a ${derivados.pkDisponivel} no início de cada turno seu${bloqueado > 0 ? `; ${bloqueado} bloqueado pela exaustão até o descanso longo` : ''}.`

  return (
    <div className={`dbf-meter dbf-meter--${recurso}`}>
      <div className="dbf-meter__num">
        <span className="dbf-meter__lbl" id={`${idBase}-lbl`}>
          {ehPv ? 'Pontos de vida' : 'Pontos de Ki'}
        </span>
        <span className="dbf-meter__val">
          <b className="dbf-meter__cur">{numero(atual)}</b>
          <Formula
            titulo={ehPv ? 'PV máximo' : 'PK máximo'}
            conta={derivado.formula}
            nota={regraDiverge ? `A ficha grava ${maximo}; a conta do livro dá ${derivado.valor}. Editar e Salvar grava a conta.` : ehPv ? null : 'Volta ao máximo no início de cada turno.'}
            className="dbf-meter__max"
          >
            / {numero(maximo)}
          </Formula>
        </span>
      </div>
      <div className="dbf-bar" role="meter" aria-labelledby={`${idBase}-lbl`} aria-valuemin={0} aria-valuemax={maximo} aria-valuenow={atual} aria-valuetext={`${atual} de ${maximo} ${nome}`}>
        <span className="dbf-bar__ghost" style={{ transform: `scaleX(${fracao})` }} />
        <span className="dbf-bar__fill" style={{ transform: `scaleX(${fracao})` }} />
        {bloqueado > 0 && maximo > 0 && <span className="dbf-bar__bloq" style={{ left: `${(1 - bloqueado / maximo) * 100}%`, width: `${(bloqueado / maximo) * 100}%` }} />}
      </div>
      <div className="dbf-meter__ctl">
        {editando ? (
          <>
            <label className="dbf-fld dbf-fld--linha">
              {nome} atual
              <input
                className="dbf-inp dbf-inp--num dbf-inp--curto"
                type="number"
                min={0}
                max={maximo}
                value={atual}
                onChange={(event) => {
                  const valor = inteiroDoCampo(event.target.value)
                  if (valor === null) return
                  mudar((p) => ({ ...p, recursos: { ...p.recursos, [recurso]: Math.min(maximo, Math.max(0, valor)) } }))
                }}
              />
            </label>
            {!ehPv && (
              <span className="dbf-fld dbf-fld--linha">
                <span id={`${idBase}-bloq`}>Bloqueado</span>
                <Stepper
                  rotulo="Ki bloqueado pela exaustão"
                  valor={ficha.kiBloqueado}
                  podeMenos={ficha.kiBloqueado > 0}
                  podeMais={ficha.kiBloqueado < derivados.pkMax.valor}
                  onMenos={() => mudarFicha((f) => ({ ...f, kiBloqueado: Math.max(0, f.kiBloqueado - 1) }))}
                  onMais={() => mudarFicha((f) => ({ ...f, kiBloqueado: f.kiBloqueado + 1 }))}
                />
              </span>
            )}
          </>
        ) : ajustar !== undefined ? (
          <>
            <label className="lb-sr-only" htmlFor={`${idBase}-quantia`}>
              Quantia de {nome}
            </label>
            <input id={`${idBase}-quantia`} className="dbf-inp dbf-inp--num dbf-inp--amt" type="number" min={1} value={quantia} onChange={(event) => setQuantia(event.target.value)} />
            <button type="button" className="dbf-btn dbf-btn--sm" disabled={!quantiaValida || atual <= 0} onClick={() => mandar(atual - (valorDaQuantia ?? 0))}>
              {ehPv ? 'Dano' : 'Gastar'}
            </button>
            <button type="button" className="dbf-btn dbf-btn--sm" disabled={!quantiaValida || atual >= maximo} onClick={() => mandar(atual + (valorDaQuantia ?? 0))}>
              {ehPv ? 'Cura' : 'Recuperar'}
            </button>
          </>
        ) : null}
      </div>
      <p className="dbf-meter__cap">{legenda}</p>
      <div className="dbf-meter__alt">
        {ehPv ? <DescansoLongo /> : ajustar !== undefined && (
          <button type="button" className="dbf-btn dbf-btn--xs dbf-btn--ki" disabled={atual >= derivados.pkDisponivel} onClick={() => mandar(derivados.pkDisponivel)}>
            Começar turno
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Descanso longo (8.5.1): PV e PK cheios e o Ki bloqueado sai. Na edição vai
 * tudo para o rascunho. Na leitura o ajuste rápido só mexe em PV e PK: com Ki
 * bloqueado, o botão espera o Editar (o bloqueio é da ficha estruturada).
 */
function DescansoLongo() {
  const { personagem, ficha, derivados, editando, ajustar, mudar, pvAtual, pkAtual, pvMax, pkMax } = useFichaDBT()
  const idMotivo = useId()
  if (editando) {
    return (
      <button type="button" className="dbf-btn dbf-btn--xs dbf-btn--ghost" onClick={() => mudar((p) => descansoLongo(p, derivados))}>
        Descanso longo
      </button>
    )
  }
  if (ajustar === undefined) return null
  const cheio = pvAtual >= pvMax && pkAtual >= pkMax
  const travado = ficha.kiBloqueado > 0
  return (
    <>
      {travado && (
        <span className="dbf-motivo" id={idMotivo}>
          Ki bloqueado: o descanso fica em Editar
        </span>
      )}
      <button
        type="button"
        className="dbf-btn dbf-btn--xs dbf-btn--ghost"
        disabled={cheio || travado}
        aria-describedby={travado ? idMotivo : undefined}
        onClick={() => {
          if (personagem.recursos.pv !== pvMax) ajustar({ parte: 'recurso', chave: 'pv', valor: pvMax })
          if (personagem.recursos.pk !== pkMax) ajustar({ parte: 'recurso', chave: 'pk', valor: pkMax })
        }}
      >
        Descanso longo
      </button>
    </>
  )
}
