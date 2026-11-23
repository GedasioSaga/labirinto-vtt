import { createContext, useContext, useId, useState, type ReactNode } from 'react'
import { VEZES_MAX, type MecanicaV1, type NumeroSimples } from '../../../lib/batalha/mecanica/modelo'
import { numeroComVirgula, type FichaDaPrevia } from '../../../lib/batalha/mecanica/resumo'
import type { CartaoDaFicha } from '../../../lib/personagem'
import { CampoNumero } from '../../FichaPecas'

/**
 * As PEÇAS DE CONTROLE dos blocos da mecânica (construtor, fatia C2), num
 * arquivo só desde a fase 5 (SISTEMA.md §8: "BlocosDaMecanica.tsx se divide
 * num arquivo por bloco antes de crescer"). Cada bloco mora no seu arquivo
 * desta pasta; aqui ficam os controles que todos usam e o texto dos números.
 */

export interface BlocosProps {
  mecanica: MecanicaV1
  /** O cartão que está sendo montado (o campo Dano de exemplo da prévia sai dele). */
  cartao: CartaoDaFicha
  ficha: FichaDaPrevia
  onChange: (mecanica: MecanicaV1) => void
  /** Construtor C8: montando o efeito da própria arma (não há "qual arma" a perguntar). */
  naArma?: boolean
}

export interface Opcao<T extends string> {
  valor: T
  rotulo: string
  /** Por que não dá para escolher agora; ausente = dá. */
  bloqueio?: string | null
}

/** Botões de escolha única: rádio de verdade por baixo (setas, Espaço e o rótulo funcionam como o sistema). */
export function Escolha<T extends string>({ legenda, opcoes, valor, onChange }: { legenda: string; opcoes: readonly Opcao<T>[]; valor: T; onChange: (valor: T) => void }) {
  const nome = useId()
  const bloqueios = opcoes.flatMap((opcao) => (opcao.bloqueio === null || opcao.bloqueio === undefined ? [] : [opcao.bloqueio]))
  const motivo = bloqueios[0]
  return (
    <fieldset className="lb-mec__escolha">
      <legend className="lb-mec__legenda">{legenda}</legend>
      <div className="lb-mec__opcoes">
        {opcoes.map((opcao) => {
          const bloqueada = opcao.bloqueio !== null && opcao.bloqueio !== undefined
          return (
            <label key={opcao.valor} className="lb-mec__opcao" data-bloqueada={bloqueada ? '' : undefined} title={bloqueada ? (opcao.bloqueio ?? undefined) : undefined}>
              <input className="lb-sr-only" type="radio" name={nome} value={opcao.valor} checked={opcao.valor === valor} disabled={bloqueada} onChange={() => onChange(opcao.valor)} />
              <span>{opcao.rotulo}</span>
            </label>
          )
        })}
      </div>
      {motivo !== undefined && <p className="lb-field__hint">{motivo}</p>}
    </fieldset>
  )
}

/** Caixa de marcar com o rótulo na frente (clicar no texto marca). */
export function Marcar({ rotulo, marcado, onChange, bloqueio }: { rotulo: string; marcado: boolean; onChange: (marcado: boolean) => void; bloqueio?: string | null }) {
  const bloqueada = bloqueio !== null && bloqueio !== undefined
  return (
    <div className="lb-mec__marcar-linha">
      <label className="lb-mec__marcar" data-bloqueada={bloqueada ? '' : undefined}>
        <input type="checkbox" checked={marcado} disabled={bloqueada} onChange={(event) => onChange(event.target.checked)} />
        <span>{rotulo}</span>
      </label>
      {bloqueada && <span className="lb-field__hint">{bloqueio}</span>}
    </div>
  )
}

/** Número inteiro com rótulo visível ao lado, preso entre `minimo` e `maximo`. */
export function CampoInteiro({ rotulo, valor, minimo, maximo, onChange, depois }: { rotulo: string; valor: number; minimo: number; maximo: number; onChange: (valor: number) => void; depois?: string }) {
  const id = useId()
  return (
    <span className="lb-mec__numero">
      <label className="lb-mec__numero-rotulo" htmlFor={id}>
        {rotulo}
      </label>
      <CampoNumero id={id} rotulo={rotulo} valor={valor} onChange={(novo) => onChange(Math.min(maximo, Math.max(minimo, novo)))} />
      {depois !== undefined && <span className="lb-mec__numero-depois">{depois}</span>}
    </span>
  )
}

/** Texto de uma linha com rótulo visível. */
export function Texto({ rotulo, valor, maximo, onChange, placeholder, lista }: { rotulo: string; valor: string; maximo: number; onChange: (valor: string) => void; placeholder?: string; lista?: string }) {
  const id = useId()
  return (
    <span className="lb-mec__texto">
      <label className="lb-mec__numero-rotulo" htmlFor={id}>
        {rotulo}
      </label>
      <input id={id} className="lb-input" value={valor} maxLength={maximo} placeholder={placeholder} list={lista} spellCheck={false} onChange={(event) => onChange(event.target.value)} />
    </span>
  )
}

/**
 * B18: as vezes de um multiplicador ("1,5"). O texto torto ("abc", "0") não
 * fica na tela como se valesse: o campo diz o que aceita e, ao sair dele,
 * volta ao número que a ficha guarda.
 */
export function CampoDasVezes({ rotulo, vezes, onChange }: { rotulo: string; vezes: number; onChange: (vezes: number) => void }) {
  const erroId = useId()
  const [texto, setTexto] = useState(() => numeroComVirgula(vezes))
  const torto = vezesDoTexto(texto) === null
  return (
    <>
      <input
        className="lb-input lb-mec__vezes"
        aria-label={rotulo}
        aria-invalid={torto || undefined}
        aria-describedby={torto ? erroId : undefined}
        inputMode="decimal"
        value={texto}
        onChange={(event) => {
          setTexto(event.target.value)
          const novo = vezesDoTexto(event.target.value)
          if (novo !== null) onChange(novo)
        }}
        onBlur={() => {
          if (torto) setTexto(numeroComVirgula(vezes))
        }}
      />
      {torto && (
        <span className="lb-field__error" id={erroId} role="status">
          Um número maior que 0 e até {VEZES_MAX}; fica ×{numeroComVirgula(vezes)}.
        </span>
      )}
    </>
  )
}

/**
 * ED3 (docs/design/habilidades/EDITOR.md §5): no editor novo, cada linha já tem
 * o nome e a pergunta; o bloco de dentro mostra só o corpo, sempre aberto.
 */
export const BlocoSemCaixa = createContext(false)

/**
 * Um bloco numerado que abre e fecha; fechado, a frase do que está escolhido.
 * `abertoAoMontar` vale só quando o editor abre: depois, quem abre e fecha é
 * a pessoa. O bloco não fecha sozinho quando o conteúdo muda (desmarcar "Dá
 * dano", tirar o último efeito, "Sem limite"): fechava embaixo do cursor, e o
 * foco do teclado sumia junto com o controle.
 */
export function Bloco({ numero, titulo, frase, abertoAoMontar, children }: { numero: number; titulo: string; frase: string; abertoAoMontar: boolean; children: ReactNode }) {
  const semCaixa = useContext(BlocoSemCaixa)
  const [aberto, setAberto] = useState(abertoAoMontar)
  if (semCaixa) return <div className="lb-mec__bloco-corpo lb-mec__bloco-corpo--na-linha">{children}</div>
  return (
    <details className="lb-mec__bloco" open={aberto} onToggle={(event) => setAberto(event.currentTarget.open)}>
      <summary className="lb-mec__bloco-cab">
        <span className="lb-mec__bloco-numero" aria-hidden="true">
          {numero}
        </span>
        <span className="lb-mec__bloco-titulo">{titulo}</span>
        <span className="lb-mec__bloco-frase">{frase}</span>
      </summary>
      <div className="lb-mec__bloco-corpo">{children}</div>
    </details>
  )
}

/** O texto de um número da peça ("100", "Força + 10"). */
export function textoDoNumero(numero: NumeroSimples): string {
  return 'fixo' in numero ? String(numero.fixo) : numero.formula
}

/** O texto digitado vira número fixo (só dígitos, dentro do teto) ou fórmula. */
export function numeroDoTexto(texto: string, maximo: number): NumeroSimples {
  const limpo = texto.trim()
  if (/^\d+$/.test(limpo)) {
    const valor = Number(limpo)
    if (valor <= maximo) return { fixo: valor }
  }
  return { formula: texto }
}

/** "1,5" ou "1.5" → 1,5; torto = `null`. */
export function vezesDoTexto(texto: string): number | null {
  const valor = Number(texto.trim().replace(',', '.'))
  return Number.isFinite(valor) && valor > 0 && valor <= VEZES_MAX ? valor : null
}

/** "Já tem 8 efeitos." quando a lista está cheia; `null` = cabe mais um. */
export function semEspaco(cheio: boolean, teto: number): string | null {
  return cheio ? `Já tem ${teto} efeitos.` : null
}
