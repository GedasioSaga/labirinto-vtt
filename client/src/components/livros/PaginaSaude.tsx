import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ABA_DAS_TECNICAS } from '../../lib/batalha/leituraDaFicha'
import { ehVariacao } from '../../lib/livros/combate'
import {
  CAMPOS_DA_SAUDE,
  CAMPO_DO_CARTAO,
  ROTULO_DO_CAMPO,
  ROTULO_DO_ESTADO,
  corrigirCampo,
  deixarAMao,
  lerCampo,
  lerSaude,
  mudarCartao,
  type AchadoDaSaude,
  type CampoDaSaude,
  type ContagemDaSaude,
  type EstadoDaLeitura,
  type LeituraDoCampo,
} from '../../lib/livros/saude'
import { aplicarSugestao, sugestoesPara, type SugestaoDaFicha } from '../../lib/livros/sugestoes'
import type { CartaoDaFicha, Personagem } from '../../lib/personagem'
import { abaDoSistema, type SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { useMundoDoLivroStore, type MudancaDoMundo } from '../../stores/mundoDoLivroStore'
import { gravarNoMundo, Retrato, trocarFicha } from './comum'
import { IconeDoMundo } from './icones'

/**
 * SAÚDE DA FICHA (M2, docs/planos/livros-de-regras-plano.md, seção M2): o
 * quanto das fichas da pasta a batalha automática lê sozinha. Quatro
 * medidores (Custo, Dano, Ação, Tempo) e a lista do que não lê, filtrável,
 * com o texto da ficha, o motivo, as sugestões e o "Corrigir" com a releitura
 * ao vivo. Porte fiel da aba Saúde do protótipo aprovado
 * (docs/design/livros-de-regras/). As contas são de lib/livros/saude.ts e
 * sugestoes.ts; toda escrita passa pelo `gravarNoMundo` (o `mundo.mudar`),
 * com Desfazer no aviso. Variação não conta: corrige-se no modelo.
 */

/** Os traços do protótipo que o conjunto do mundo (icones.tsx) ainda não tem. */
const TRACOS = {
  ok: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  relogio: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </>
  ),
  nao: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </>
  ),
} as const

function IconeDoEstado({ estado }: { estado: EstadoDaLeitura }) {
  if (estado === 'aMao') return <IconeDoMundo nome="nota" />
  const nome = estado === 'lido' ? 'ok' : estado === 'naHora' ? 'relogio' : 'nao'
  return (
    <svg className="mu-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {TRACOS[nome]}
    </svg>
  )
}

function SeloDoEstado({ estado }: { estado: EstadoDaLeitura }) {
  return (
    <span className={`mu-status mu-status--${estado}`}>
      <IconeDoEstado estado={estado} />
      {ROTULO_DO_ESTADO[estado]}
    </span>
  )
}

/** O título de cada medidor ("Ações lidas": o plural certo, que o protótipo errava). */
const TITULO_DO_MEDIDOR: Readonly<Record<CampoDaSaude, string>> = { custo: 'Custos lidos', dano: 'Danos lidos', acao: 'Ações lidas', tempo: 'Tempos lidos' }

type Filtro = 'todos' | CampoDaSaude
const FILTROS: readonly Filtro[] = ['todos', ...CAMPOS_DA_SAUDE]

/** Não lê primeiro (é o que pede conserto), depois Lê na hora. */
const ORDEM_DO_ESTADO: Readonly<Record<EstadoDaLeitura, number>> = { naoLe: 0, naHora: 1, aMao: 2, lido: 3 }

const chaveDoAchado = (achado: AchadoDaSaude): string => `${achado.personagemId}|${achado.cartaoId}|${achado.campo}`

function acharNaLista(cartoes: readonly CartaoDaFicha[], cartaoId: string): CartaoDaFicha | undefined {
  for (const cartao of cartoes) {
    if (cartao.id === cartaoId) return cartao
    const dentro = acharNaLista(cartao.subcartoes, cartaoId)
    if (dentro !== undefined) return dentro
  }
  return undefined
}

/** O cartão da ficha (em qualquer aba, também dentro de transformação). */
function cartaoDaFicha(personagem: Personagem, cartaoId: string): CartaoDaFicha | undefined {
  for (const cartoes of Object.values(personagem.abas)) {
    const achado = acharNaLista(cartoes, cartaoId)
    if (achado !== undefined) return achado
  }
  return undefined
}

/** Os nomes (como o sistema os escreve) dos campos que a sugestão muda além do medido: "Efeito", "Descrição". */
function outrosCampos(campos: Readonly<Record<string, string>>, campoId: string, sistema: SistemaDeRpg): string[] {
  const aba = abaDoSistema(sistema, ABA_DAS_TECNICAS)
  return Object.keys(campos)
    .filter((id) => id !== campoId)
    .map((id) => aba?.campos.find((campo) => campo.id === id)?.rotulo ?? id)
}

/** "agora é lido", "continua sem leitura"...: o fim da frase do aviso depois de gravar. */
function fraseDaReleitura(leitura: LeituraDoCampo | null): string {
  if (leitura === null) return 'ficou vazio'
  if (leitura.estado === 'lido') return 'agora é lido'
  if (leitura.estado === 'naHora') return 'agora é lido na hora'
  if (leitura.estado === 'aMao') return 'fica à mão de propósito'
  return 'continua sem leitura'
}

/** A releitura ao vivo do "Corrigir", como o protótipo a escreve. */
function Releitura({ campo, leitura }: { campo: CampoDaSaude; leitura: LeituraDoCampo | null }) {
  if (leitura === null) {
    return (
      <>
        <span className="mu-status mu-status--aMao">
          <IconeDoMundo nome="nota" />
          Vazio
        </span>{' '}
        {campo === 'dano' ? 'Sem dano: a técnica vira suporte.' : 'Sem valor neste campo.'}
      </>
    )
  }
  if (leitura.estado === 'naoLe') {
    return (
      <>
        <SeloDoEstado estado="naoLe" /> Ainda não lê: {leitura.motivo}
      </>
    )
  }
  if (leitura.estado === 'aMao') {
    return (
      <>
        <SeloDoEstado estado="aMao" /> {leitura.motivo}
      </>
    )
  }
  return (
    <>
      <SeloDoEstado estado={leitura.estado} /> O app lê: {leitura.leitura}
      {leitura.estado === 'naHora' && leitura.motivo.length > 0 ? `. ${leitura.motivo}` : ''}
    </>
  )
}

interface MedidorProps {
  campo: CampoDaSaude
  contagem: ContagemDaSaude
  porcentagem: number
}

function Medidor({ campo, contagem, porcentagem }: MedidorProps) {
  const lidos = contagem.lido + contagem.naHora
  const total = lidos + contagem.naoLe
  const partes: readonly { classe: string; n: number }[] = [
    { classe: 'mu-m-lido', n: contagem.lido },
    { classe: 'mu-m-ajuda', n: contagem.naHora },
    { classe: 'mu-m-nao', n: contagem.naoLe },
  ]
  return (
    <div className="mu-cartao mu-medidor">
      <div className="mu-medidor__cab">
        <span className="mu-medidor__rot">{TITULO_DO_MEDIDOR[campo]}</span>
        <span className="mu-medidor__num">{total === 0 ? '—' : `${porcentagem}%`}</span>
      </div>
      <div className="mu-medidor__barra" role="img" aria-label={`${contagem.lido} lidos, ${contagem.naHora} lidos na hora, ${contagem.naoLe} não lidos`}>
        {partes.map((parte) => (parte.n > 0 ? <span key={parte.classe} className={parte.classe} style={{ flexGrow: parte.n }} /> : null))}
      </div>
      <p className="mu-medidor__leg">
        {total === 0 ? 'Nenhum escrito' : `${lidos} de ${total}`}
        {contagem.aMao > 0 ? ` · ${contagem.aMao} à mão de propósito` : ''}
      </p>
    </div>
  )
}

interface CorrecaoAberta {
  chave: string
  rascunho: string
  /** A sugestão que preencheu o rascunho (os outros campos dela vão junto ao salvar); `null` = o texto da ficha. */
  sugestao: SugestaoDaFicha | null
}

interface LinhaProps {
  achado: AchadoDaSaude
  personagem: Personagem
  cartao: CartaoDaFicha
  sistema: SistemaDeRpg
  correcao: CorrecaoAberta | null
  onAbrir: (rascunho: string, sugestao: SugestaoDaFicha | null) => void
  onRascunho: (texto: string) => void
  onFechar: () => void
  onGravou: () => void
}

function LinhaDoAchado({ achado, personagem, cartao, sistema, correcao, onAbrir, onRascunho, onFechar, onGravou }: LinhaProps) {
  const { campo, cartaoId, leitura } = achado
  const campoId = CAMPO_DO_CARTAO[campo]
  const rotulo = ROTULO_DO_CAMPO[campo]
  const nomeDoCartao = achado.nomeDoCartao.trim().length > 0 ? achado.nomeDoCartao : 'a técnica'
  const sugestoes = useMemo(() => sugestoesPara(campo, cartao, personagem, sistema), [campo, cartao, personagem, sistema])
  const podeCorrigir = leitura.estado === 'naoLe' || sugestoes.length > 0
  const botaoRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const idDoCampo = useId()
  const editando = correcao !== null

  useEffect(() => {
    if (!editando) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editando])

  /** Grava pelo funil do mundo; o Desfazer devolve o cartão inteiro como estava. */
  const gravar = (mudar: (atual: Personagem) => Personagem, texto: string) => {
    const antes = cartao
    const mudanca: MudancaDoMundo = (lista) => trocarFicha(lista, personagem.id, mudar)
    void gravarNoMundo(mudanca, {
      texto,
      desfazer: (lista) => trocarFicha(lista, personagem.id, (atual) => mudarCartao(atual, cartaoId, () => antes)),
    }).then((gravou) => {
      if (gravou) onGravou()
    })
  }

  const abrir = () => {
    const sugestao = sugestoes.find((candidata) => campoId in candidata.campos) ?? null
    onAbrir(sugestao === null ? achado.texto : sugestao.campos[campoId], sugestao)
  }

  const cancelar = () => {
    onFechar()
    requestAnimationFrame(() => botaoRef.current?.focus())
  }

  const aplicar = (sugestao: SugestaoDaFicha) => {
    const releitura = sugestao.aMao === true ? null : campoId in sugestao.campos ? lerCampo(campo, sugestao.campos[campoId], cartao, personagem, sistema) : leitura
    const frase = sugestao.aMao === true ? 'fica à mão de propósito: sai da porcentagem' : fraseDaReleitura(releitura)
    const outros = outrosCampos(sugestao.campos, campoId, sistema)
    gravar((atual) => aplicarSugestao(atual, cartaoId, sugestao), `${rotulo} de ${nomeDoCartao} ${frase}.${outros.length > 0 ? ` Também mudou: ${outros.join(', ')}.` : ''}`)
  }

  const rascunho = correcao?.rascunho ?? ''
  const sugestaoAberta = correcao?.sugestao ?? null
  const junto = sugestaoAberta === null ? [] : outrosCampos(sugestaoAberta.campos, campoId, sistema)
  const releituraAoVivo = editando ? lerCampo(campo, rascunho, cartao, personagem, sistema) : null
  const igual = rascunho.trim() === achado.texto.trim() && junto.length === 0

  const salvar = () => {
    if (igual) return
    const texto = rascunho.trim()
    const campos: Record<string, string> = { ...(sugestaoAberta?.campos ?? {}), [campoId]: texto }
    gravar(
      (atual) => Object.entries(campos).reduce((ficha, [id, valor]) => corrigirCampo(ficha, cartaoId, id, valor), atual),
      `${rotulo} de ${nomeDoCartao} ${fraseDaReleitura(lerCampo(campo, texto, cartao, personagem, sistema))}.${junto.length > 0 ? ` Também mudou: ${junto.join(', ')}.` : ''}`,
    )
  }

  const aMao = () => gravar((atual) => deixarAMao(atual, cartaoId, true), `Dano de ${nomeDoCartao} fica à mão de propósito: sai da porcentagem.`)

  return (
    <li className="mu-cartao mu-prob">
      <div className="mu-prob__corpo">
        <div className="mu-prob__onde">
          <Retrato imagem={personagem.retrato} nome={personagem.nome} tamanho="p" />
          <b>{personagem.nome}</b>
          <span>
            {nomeDoCartao}
            {achado.forma !== undefined ? ` · forma ${achado.forma}` : ''}
          </span>
          <span>· {rotulo}</span>
          <SeloDoEstado estado={leitura.estado} />
        </div>
        <p className="mu-prob__escrito">
          Está escrito <q>{achado.texto}</q>
        </p>
        <p className="mu-prob__porque">
          {leitura.estado === 'naHora' && leitura.leitura.length > 0 ? `Lê ${leitura.leitura}. ` : ''}
          {leitura.motivo}
        </p>
        {sugestoes.map((sugestao) => (
          <div key={sugestao.regra} className="mu-prob__sug">
            <button type="button" className="mu-bt mu-bt--p" onClick={() => aplicar(sugestao)}>
              {sugestao.rotulo}
            </button>
            <span>{sugestao.porque}</span>
          </div>
        ))}
      </div>
      <div className="mu-prob__acoes">
        {podeCorrigir && !editando && (
          <button type="button" ref={botaoRef} className="mu-bt mu-bt--p mu-bt--latao" onClick={abrir}>
            Corrigir
          </button>
        )}
        <button type="button" className="mu-bt mu-bt--p mu-bt--fantasma" onClick={() => useMundoDoLivroStore.getState().abrirFicha(personagem.id)}>
          Abrir ficha
        </button>
      </div>
      {editando && (
        <div className="mu-corrige">
          <div className="mu-campo">
            <label htmlFor={idDoCampo}>
              Novo {rotulo.toLowerCase()} de {nomeDoCartao}
            </label>
            <input
              ref={inputRef}
              className="mu-entrada"
              id={idDoCampo}
              value={rascunho}
              autoComplete="off"
              spellCheck={false}
              aria-describedby={`${idDoCampo}-leitura`}
              onChange={(event) => onRascunho(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  salvar()
                } else if (event.key === 'Escape') {
                  // O Esc é da correção: o mundo não fecha atrás (MundoDoLivro olha o `defaultPrevented`).
                  event.preventDefault()
                  cancelar()
                }
              }}
            />
          </div>
          <div className="mu-corrige__acoes">
            <button type="button" className="mu-bt mu-bt--primario" disabled={igual} onClick={salvar}>
              Salvar na ficha
            </button>
            {campo === 'dano' && cartao.aMao !== true && (
              <button type="button" className="mu-bt" onClick={aMao}>
                Deixar à mão
              </button>
            )}
            <button type="button" className="mu-bt mu-bt--fantasma" onClick={cancelar}>
              Cancelar
            </button>
          </div>
          {junto.length > 0 && <p className="mu-corrige__junto">Ao salvar, também muda: {junto.join(', ')}.</p>}
          <p className="mu-corrige__leitura" id={`${idDoCampo}-leitura`} aria-live="polite">
            <Releitura campo={campo} leitura={releituraAoVivo} />
          </p>
        </div>
      )}
    </li>
  )
}

export interface PaginaSaudeProps {
  personagens: readonly Personagem[]
  sistema: SistemaDeRpg
}

export function PaginaSaude({ personagens, sistema }: PaginaSaudeProps) {
  const saude = useMemo(() => lerSaude(personagens, sistema), [personagens, sistema])
  const porId = useMemo(() => new Map(personagens.map((personagem) => [personagem.id, personagem])), [personagens])
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [correcao, setCorrecao] = useState<CorrecaoAberta | null>(null)
  const filtrosRef = useRef<HTMLDivElement>(null)
  const fichas = personagens.filter((personagem) => !ehVariacao(personagem)).length

  const lista = saude.achados
    .filter((achado) => filtro === 'todos' || achado.campo === filtro)
    .sort((a, b) => ORDEM_DO_ESTADO[a.leitura.estado] - ORDEM_DO_ESTADO[b.leitura.estado])

  const trocarFiltro = (novo: Filtro) => {
    setFiltro(novo)
    setCorrecao(null)
  }

  /** Gravou: a correção fecha e, se a linha sumiu com o foco nela, o foco vai para os filtros (não cai no corpo da página). */
  const aoGravar = () => {
    setCorrecao(null)
    requestAnimationFrame(() => {
      if (document.activeElement === null || document.activeElement === document.body) filtrosRef.current?.focus()
    })
  }

  return (
    <div className="mu-pg">
      <header className="mu-pg-cab">
        <div className="mu-pg-cab__txt">
          <h2 className="mu-pg-titulo">Saúde da ficha</h2>
          <p className="mu-pg-sub">
            O que a batalha automática não consegue ler nas fichas desta pasta, com uma sugestão de como escrever. Variação de NPC conta uma vez, pelo modelo.
          </p>
        </div>
      </header>

      {fichas === 0 ? (
        <div className="mu-vazio">
          <p>Nenhuma ficha nesta pasta ainda. Crie um jogador ou um NPC e a saúde das técnicas dele aparece aqui.</p>
        </div>
      ) : (
        <>
          <div className="mu-saude-resumo">
            {CAMPOS_DA_SAUDE.map((campo) => (
              <Medidor key={campo} campo={campo} contagem={saude.contagem[campo]} porcentagem={saude.porcentagem[campo]} />
            ))}
          </div>
          <ul className="mu-legenda">
            <li>
              <SeloDoEstado estado="lido" /> o app faz a conta sozinho
            </li>
            <li>
              <SeloDoEstado estado="naHora" /> precisa de algo na hora (arma, alvo ou confirmar um valor)
            </li>
            <li>
              <SeloDoEstado estado="naoLe" /> o app pergunta ou você digita
            </li>
            <li>
              <SeloDoEstado estado="aMao" /> fica fora da porcentagem, de propósito
            </li>
          </ul>

          <div className="mu-filtros" role="group" aria-label="Filtrar por campo" ref={filtrosRef} tabIndex={-1}>
            {FILTROS.map((chave) => {
              const n = chave === 'todos' ? saude.achados.length : saude.achados.filter((achado) => achado.campo === chave).length
              return (
                <button key={chave} type="button" className="mu-chip mu-chip--sem-ret" aria-pressed={filtro === chave} onClick={() => trocarFiltro(chave)}>
                  {chave === 'todos' ? 'Todos' : ROTULO_DO_CAMPO[chave]} · {n}
                </button>
              )
            })}
          </div>

          {lista.length === 0 ? (
            <div className="mu-vazio">
              <p>{saude.achados.length === 0 ? 'Tudo lido: a batalha automática entende todas as fichas desta pasta.' : 'Nada neste filtro.'}</p>
            </div>
          ) : (
            <ul className="mu-prob-lista">
              {lista.map((achado) => {
                const personagem = porId.get(achado.personagemId)
                const cartao = personagem === undefined ? undefined : cartaoDaFicha(personagem, achado.cartaoId)
                if (personagem === undefined || cartao === undefined) return null
                const chave = chaveDoAchado(achado)
                return (
                  <LinhaDoAchado
                    key={chave}
                    achado={achado}
                    personagem={personagem}
                    cartao={cartao}
                    sistema={sistema}
                    correcao={correcao !== null && correcao.chave === chave ? correcao : null}
                    onAbrir={(rascunho, sugestao) => setCorrecao({ chave, rascunho, sugestao })}
                    onRascunho={(rascunho) => setCorrecao((atual) => (atual === null || atual.chave !== chave ? atual : { ...atual, rascunho }))}
                    onFechar={() => setCorrecao(null)}
                    onGravou={aoGravar}
                  />
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
