import { useEffect, useId, useRef, useState } from 'react'
import type { Personagem } from '../../../../lib/personagem'
import type { SistemaDeRpg } from '../../../../lib/sistemaDeRpg'
import {
  ACOES_DA_TECNICA,
  CUSTO_DA_TECNICA_MAX,
  DANO_DA_TECNICA_MAX,
  danoQueALutaLe,
  leituraDoDano,
  NOME_DA_TECNICA_MAX,
  nomeDaTecnica,
  RECARGA_DA_TECNICA_MAX,
  TECNICAS_DE_TREINO_MAX,
  tecnicaNova,
  type TecnicaDeTreino,
} from './tecnicaDeTreino'

/**
 * OS CAMPOS DO TREINO (fatia J): o inteiro com rascunho e o editor das
 * técnicas de treino, os mesmos no Judge e no rascunho da própria ficha. Cada
 * valor válido vai na hora para quem chama (que guarda no navegador); o texto
 * torto fica só no campo, marcado, e volta ao guardado ao sair dele.
 */

interface CampoInteiroProps {
  rotulo: string
  valor: number
  min: number
  max: number
  onMudar(valor: number): void
  /** A linha embaixo ("na ficha: 120", "igual ao padrão"). */
  nota?: string
  /** O campo saiu do valor de partida: a borda muda de cor. */
  mudou?: boolean
}

export function CampoInteiro({ rotulo, valor, min, max, onMudar, nota, mudou = false }: CampoInteiroProps) {
  const id = useId()
  // O rascunho vale só para o valor em que nasceu: gravou (ou mudou por fora), ele sai sozinho.
  const [guardado, setGuardado] = useState<{ texto: string; de: number } | null>(null)
  const texto = guardado !== null && guardado.de === valor ? guardado.texto : String(valor)
  const ler = (bruto: string): number | null => {
    const limpo = bruto.trim()
    if (!/^\d+$/.test(limpo)) return null
    const numero = Number(limpo)
    return Number.isSafeInteger(numero) && numero >= min && numero <= max ? numero : null
  }
  const invalido = texto.trim() !== '' && ler(texto) === null
  const passo = (delta: number) => {
    const novo = Math.min(max, Math.max(min, valor + delta))
    if (novo !== valor) onMudar(novo)
  }
  return (
    <div className="lo-tr-campo" data-mudou={mudou ? '1' : undefined}>
      <label htmlFor={id}>{rotulo}</label>
      <input
        id={id}
        className="lo-numero"
        inputMode="numeric"
        autoComplete="off"
        value={texto}
        aria-invalid={invalido || undefined}
        aria-describedby={`${id}-nota`}
        onChange={(evento) => {
          setGuardado({ texto: evento.target.value, de: valor })
          const lido = ler(evento.target.value)
          if (lido !== null && lido !== valor) onMudar(lido)
        }}
        onBlur={() => setGuardado(null)}
        onKeyDown={(evento) => {
          if (evento.key === 'ArrowUp' || evento.key === 'ArrowDown') {
            evento.preventDefault()
            passo(evento.key === 'ArrowUp' ? 1 : -1)
            setGuardado(null)
          }
        }}
      />
      <span id={`${id}-nota`} className="lo-tr-campo__ficha" data-erro={invalido ? '1' : undefined}>
        {invalido ? `Use um número inteiro de ${min.toLocaleString('pt-BR')} a ${max.toLocaleString('pt-BR')}.` : (nota ?? '')}
      </span>
    </div>
  )
}

interface EditorDeTecnicasProps {
  tecnicas: readonly TecnicaDeTreino[]
  onMudar(tecnicas: TecnicaDeTreino[]): void
  /** De quem são (o dano é lido com os números dela, como a luta lê). */
  personagem: Personagem
  sistema: SistemaDeRpg
  titulo: string
}

function LinhaDaTecnica({ tecnica, personagem, sistema, onMudar, onTirar, focarAoNascer }: { tecnica: TecnicaDeTreino; personagem: Personagem; sistema: SistemaDeRpg; onMudar(nova: TecnicaDeTreino): void; onTirar(): void; focarAoNascer: boolean }) {
  const id = useId()
  const nomeRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (focarAoNascer) nomeRef.current?.focus()
    // Só ao nascer: a técnica nova recebe o cursor no nome.
  }, [])
  const leitura = leituraDoDano(tecnica, personagem, sistema)
  const le = danoQueALutaLe(leitura)
  return (
    <fieldset className="lo-tr-tecnica">
      <legend className="lo-sr">{nomeDaTecnica(tecnica)}</legend>
      <div className="lo-tr-tecnica__linha">
        <div className="lo-tr-campo lo-tr-tecnica__nome">
          <label htmlFor={`${id}-nome`}>Nome</label>
          <input
            ref={nomeRef}
            id={`${id}-nome`}
            className="lo-texto"
            maxLength={NOME_DA_TECNICA_MAX}
            autoComplete="off"
            value={tecnica.nome}
            onChange={(evento) => onMudar({ ...tecnica, nome: evento.target.value })}
          />
        </div>
        <fieldset className="lo-tr-tecnica__acao">
          <legend>Ação</legend>
          <div className="lo-tr-seg">
            {ACOES_DA_TECNICA.map((acao) => (
              <label key={acao.id} className="lo-tr-seg__op">
                <input type="radio" name={`${id}-acao`} checked={tecnica.acao === acao.id} onChange={() => onMudar({ ...tecnica, acao: acao.id })} />
                <span>{acao.nome}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="lo-tr-tecnica__linha">
        <div className="lo-tr-campo lo-tr-tecnica__dano">
          <label htmlFor={`${id}-dano`}>Dano</label>
          <input
            id={`${id}-dano`}
            className="lo-texto"
            maxLength={DANO_DA_TECNICA_MAX}
            autoComplete="off"
            spellCheck={false}
            value={tecnica.dano}
            aria-invalid={!le || undefined}
            aria-describedby={`${id}-leitura`}
            onChange={(evento) => onMudar({ ...tecnica, dano: evento.target.value })}
          />
          <span id={`${id}-leitura`} className="lo-tr-tecnica__leitura" data-erro={le ? undefined : '1'}>
            {le ? `${leitura.valor.toLocaleString('pt-BR')} de dano: ${leitura.conta}` : 'A luta não lê esta conta. Use números e atributos, como Força + 20.'}
          </span>
        </div>
        <CampoInteiro rotulo="Custo (SP)" valor={tecnica.custo} min={0} max={CUSTO_DA_TECNICA_MAX} onMudar={(custo) => onMudar({ ...tecnica, custo })} nota={tecnica.custo === 0 ? 'de graça' : 'por uso'} />
        <CampoInteiro
          rotulo="Recarga"
          valor={tecnica.recarga}
          min={0}
          max={RECARGA_DA_TECNICA_MAX}
          onMudar={(recarga) => onMudar({ ...tecnica, recarga })}
          nota={tecnica.recarga === 0 ? 'usa toda vez' : tecnica.recarga === 1 ? 'turno' : 'turnos'}
        />
        <button type="button" className="lo-btn lo-btn--fantasma lo-tr-tecnica__tirar" onClick={onTirar} aria-label={`Tirar ${nomeDaTecnica(tecnica)}`}>
          Tirar
        </button>
      </div>
    </fieldset>
  )
}

export function EditorDeTecnicas({ tecnicas, onMudar, personagem, sistema, titulo }: EditorDeTecnicasProps) {
  const [nascida, setNascida] = useState<string | null>(null)
  const novaRef = useRef<HTMLButtonElement>(null)
  const cheia = tecnicas.length >= TECNICAS_DE_TREINO_MAX
  return (
    <section className="lo-tr-tecnicas" aria-label={titulo}>
      <div className="lo-tr-tecnicas__cab">
        <h3 className="lo-tr-tecnicas__titulo">{titulo}</h3>
        <button
          ref={novaRef}
          type="button"
          className="lo-btn"
          disabled={cheia}
          onClick={() => {
            const nova = tecnicaNova(tecnicas)
            setNascida(nova.id)
            onMudar([...tecnicas, nova])
          }}
        >
          Nova técnica
        </button>
      </div>
      {cheia && <p className="lo-motivo">No máximo {TECNICAS_DE_TREINO_MAX} técnicas de treino.</p>}
      {tecnicas.length === 0 ? (
        <p className="lo-tr-tecnicas__vazio">Nenhuma técnica de treino. As da ficha continuam valendo; a nova entra no fim das Habilidades.</p>
      ) : (
        tecnicas.map((tecnica) => (
          <LinhaDaTecnica
            key={tecnica.id}
            tecnica={tecnica}
            personagem={personagem}
            sistema={sistema}
            focarAoNascer={nascida === tecnica.id}
            onMudar={(nova) => onMudar(tecnicas.map((outra) => (outra.id === tecnica.id ? nova : outra)))}
            onTirar={() => {
              onMudar(tecnicas.filter((outra) => outra.id !== tecnica.id))
              novaRef.current?.focus()
            }}
          />
        ))
      )}
    </section>
  )
}
