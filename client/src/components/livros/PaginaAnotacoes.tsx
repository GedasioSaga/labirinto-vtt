import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { entraNaBatalha } from '../../lib/livros/combate'
import { comNotaDoMestre, NOTA_DO_MESTRE_MAX, type Personagem } from '../../lib/personagem'
import { formatarNumero, gravarNoMundo, Retrato, trocarFicha } from './comum'
import './anotacoes.css'

/**
 * Página ANOTAÇÕES do mundo do livro (M2, docs/planos/livros-de-regras-plano.md):
 * à esquerda as fichas da pasta (jogadores e NPCs), à direita a nota do mestre
 * da escolhida. Só o mestre vê: a nota sai do fio em `paraOFio`. Grava sozinha
 * pouco depois da última tecla, pelo funil único da nota (`comNotaDoMestre`)
 * e pelo funil único do mundo (`gravarNoMundo` -> `mundo.mudar`).
 *
 * O `EditorDaNota` daqui é o MESMO no detalhe do NPC (PaginaNpcs.tsx): uma
 * nota, um jeito de escrever e de guardar.
 */

/** A espera depois da última tecla antes de gravar: cada letra não vira uma gravação no disco. */
const GUARDA_A_NOTA_DEPOIS_MS = 400
/** A partir de que fração do limite o contador de letras aparece. */
const CONTADOR_A_PARTIR_DE = 0.9

type SeloDaNota = { tipo: 'parado' } | { tipo: 'guardando' } | { tipo: 'guardada'; hora: string } | { tipo: 'falhou' }

function horaDeAgora(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function fraseDoSelo(selo: SeloDaNota): string {
  if (selo.tipo === 'guardando') return 'Guardando…'
  if (selo.tipo === 'guardada') return `Guardada às ${selo.hora}.`
  if (selo.tipo === 'falhou') return 'Não deu para guardar. Continue escrevendo para tentar de novo.'
  return ''
}

/** O selo "Só você vê" com o cadeado (o mesmo traço do protótipo, `i-cadeado`). */
export function SoVoceVe() {
  return (
    <span className="mu-privado">
      <svg className="mu-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
      Só você vê
    </span>
  )
}

export interface EditorDaNotaProps {
  personagem: Personagem
  /** O id do campo: o rótulo de quem usa aponta para ele. */
  campoId: string
  /** Campo mais baixo (o bloco no detalhe do NPC). */
  curto?: boolean
}

/**
 * O campo da nota que grava sozinho. Quem usa dá um `key` por ficha: trocar de
 * ficha desmonta este e grava na hora o que ficou pendente.
 */
export function EditorDaNota({ personagem, campoId, curto = false }: EditorDaNotaProps) {
  const gravada = personagem.notaDoMestre ?? ''
  const [texto, setTexto] = useState(gravada)
  const [selo, setSelo] = useState<SeloDaNota>({ tipo: 'parado' })
  const pendente = useRef<{ texto: string; relogio: number } | null>(null)
  const montado = useRef(true)
  const personagemId = personagem.id

  const guardarPendente = () => {
    const agora = pendente.current
    if (agora === null) return
    window.clearTimeout(agora.relogio)
    pendente.current = null
    void gravarNoMundo((lista) => trocarFicha(lista, personagemId, (atual) => comNotaDoMestre(atual, agora.texto))).then((gravou) => {
      // Escreveu de novo enquanto gravava: o selo continua "Guardando…" até a próxima.
      if (!montado.current || pendente.current !== null) return
      setSelo(gravou ? { tipo: 'guardada', hora: horaDeAgora() } : { tipo: 'falhou' })
    })
  }

  // Saiu da ficha (ou da página) com letra pendente: grava agora, sem esperar.
  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
      guardarPendente()
    }
  }, [])

  // A nota mudou por fora (a janela de ficha do mestre): o campo acompanha, se não há nada pendente aqui.
  // Compara como o disco guardaria: o próprio texto, depois de gravado, volta igual e não mexe no campo.
  useEffect(() => {
    if (pendente.current !== null) return
    setTexto((atual) => ((comNotaDoMestre(personagem, atual).notaDoMestre ?? '') === gravada ? atual : gravada))
  }, [gravada])

  const escrever = (novo: string) => {
    setTexto(novo)
    setSelo({ tipo: 'guardando' })
    if (pendente.current !== null) window.clearTimeout(pendente.current.relogio)
    pendente.current = { texto: novo, relogio: window.setTimeout(guardarPendente, GUARDA_A_NOTA_DEPOIS_MS) }
  }

  const perto = texto.length >= NOTA_DO_MESTRE_MAX * CONTADOR_A_PARTIR_DE

  return (
    <>
      <textarea
        id={campoId}
        className={curto ? 'mu-not-area mu-not-area--curta' : 'mu-not-area'}
        value={texto}
        maxLength={NOTA_DO_MESTRE_MAX}
        placeholder="Segredos, ganchos, o que ele quer, como reage se perder..."
        onChange={(event) => escrever(event.target.value)}
        onBlur={guardarPendente}
      />
      <div className="mu-not-pe">
        <span aria-live="polite">{fraseDoSelo(selo)}</span>
        {perto && (
          <span className="mu-not-pe__limite">
            {formatarNumero(texto.length)} de {formatarNumero(NOTA_DO_MESTRE_MAX)} letras
          </span>
        )}
      </div>
    </>
  )
}

/** A primeira linha da nota, para a prévia da lista. */
function previaDaNota(personagem: Personagem): string {
  const nota = (personagem.notaDoMestre ?? '').trim()
  if (nota.length === 0) return 'Sem nota'
  return nota.split('\n', 1)[0] ?? nota
}

interface GrupoDaLista {
  titulo: string
  fichas: readonly Personagem[]
}

/** Seta para cima e para baixo andam pela lista e já escolhem (como os marcadores da lombada). */
function andarNaLista(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  const botoes = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('.mu-not-item'))
  const i = botoes.findIndex((botao) => botao === document.activeElement)
  if (i < 0) return
  event.preventDefault()
  const destino = botoes[event.key === 'ArrowDown' ? Math.min(i + 1, botoes.length - 1) : Math.max(i - 1, 0)]
  if (destino === undefined || destino === botoes[i]) return
  destino.focus()
  destino.click()
}

export interface PaginaAnotacoesProps {
  personagens: readonly Personagem[]
}

export function PaginaAnotacoes({ personagens }: PaginaAnotacoesProps) {
  const [escolhidoId, setEscolhidoId] = useState<string | null>(null)
  const npcs = personagens.filter((personagem) => personagem.tipo === 'npc')
  const grupos: GrupoDaLista[] = [
    { titulo: 'Jogadores', fichas: personagens.filter((personagem) => personagem.tipo === 'jogador') },
    { titulo: 'NPCs de combate', fichas: npcs.filter(entraNaBatalha) },
    { titulo: 'Só no cenário', fichas: npcs.filter((personagem) => !entraNaBatalha(personagem)) },
  ].filter((grupo) => grupo.fichas.length > 0)
  const todas = grupos.flatMap((grupo) => grupo.fichas)
  const escolhido = todas.find((personagem) => personagem.id === escolhidoId) ?? todas[0]

  return (
    <div className="mu-pg">
      <header className="mu-pg-cab">
        <div className="mu-pg-cab__txt">
          <h2 className="mu-pg-titulo">Anotações</h2>
          <p className="mu-pg-sub">Notas do mestre em cada ficha e cada NPC. Só você vê: não aparecem na tela do jogador.</p>
        </div>
      </header>

      {escolhido === undefined ? (
        <div className="mu-vazio">
          <p>Nenhuma ficha nesta pasta ainda. Crie um jogador ou um NPC e a nota dele aparece aqui.</p>
        </div>
      ) : (
        <div className="mu-not">
          <nav className="mu-cartao mu-not-lista" aria-label="Fichas" onKeyDown={andarNaLista}>
            {grupos.map((grupo) => (
              <div key={grupo.titulo}>
                <h3 className="mu-bes-grupo__tit">{grupo.titulo}</h3>
                <ul>
                  {grupo.fichas.map((personagem) => (
                    <li key={personagem.id}>
                      <button type="button" className="mu-not-item" aria-current={personagem.id === escolhido.id} onClick={() => setEscolhidoId(personagem.id)}>
                        <Retrato imagem={personagem.retrato} nome={personagem.nome} tamanho="p" />
                        <span className="mu-not-item__txt">
                          <span className="mu-not-item__nome">{personagem.nome}</span>
                          <span className="mu-not-item__previa">{previaDaNota(personagem)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <section className="mu-cartao mu-not-ed" aria-labelledby="mu-not-nome">
            <div className="mu-not-ed__cab">
              <Retrato imagem={escolhido.retrato} nome={escolhido.nome} />
              <h3 className="mu-not-ed__nome" id="mu-not-nome">
                {escolhido.nome}
              </h3>
              <SoVoceVe />
            </div>
            <label className="mu-not-sr" htmlFor={`mu-nota-${escolhido.id}`}>
              Anotação sobre {escolhido.nome}
            </label>
            <EditorDaNota key={escolhido.id} personagem={escolhido} campoId={`mu-nota-${escolhido.id}`} />
            <p className="mu-pg-nota">A mesma nota aparece na janela de ficha e no detalhe do NPC.</p>
          </section>
        </div>
      )}
    </div>
  )
}
