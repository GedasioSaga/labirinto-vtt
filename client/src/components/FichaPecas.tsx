import { useEffect, useState } from 'react'

/**
 * Peças pequenas da ficha de personagem, usadas pelo bloco do personagem e
 * pelos cartões das abas.
 */

/** Quantos tons o retrato sem foto tem (`.lb-ficha__iniciais[data-tom]` no CSS). */
const TONS_DO_RETRATO = 5

/** Até 2 iniciais em maiúsculas: "May D. Ark" → "MD". */
export function iniciais(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .filter((parte) => parte.length > 0)
    .slice(0, 2)
    .map((parte) => parte[0] ?? '')
    .join('')
    .toUpperCase()
}

/** Tom estável pelo nome: o mesmo personagem tem sempre a mesma cor de retrato vazio. */
export function tomDoNome(nome: string): number {
  let hash = 0
  for (let i = 0; i < nome.length; i += 1) hash = (hash * 31 + nome.charCodeAt(i)) >>> 0
  return hash % TONS_DO_RETRATO
}

/** O retrato de quem ainda não tem foto: as iniciais sobre um tom do nome (o projeto-rpg-v2 fazia igual). */
export function IniciaisDoNome({ nome }: { nome: string }) {
  return (
    <span className="lb-ficha__iniciais" data-tom={tomDoNome(nome)} aria-hidden="true">
      {iniciais(nome)}
    </span>
  )
}

/** Inteiro do texto do campo; `null` enquanto não é número (vazio, "-" no meio da digitação). */
function inteiroDoTexto(texto: string): number | null {
  if (!/^-?\d+$/.test(texto.trim())) return null
  const valor = Number(texto.trim())
  return Number.isSafeInteger(valor) ? valor : null
}

export interface CampoNumeroProps {
  /** Nome acessível do campo: quem o mostra decide se há rótulo visível. */
  rotulo: string
  valor: number
  onChange: (valor: number) => void
  id?: string
}

/**
 * Campo de número inteiro que deixa apagar e redigitar: o texto é do campo,
 * e o número só sobe quando o texto vira um inteiro. Ao sair do campo com
 * texto que não é número, ele volta ao último valor — nunca grava `NaN` nem
 * transforma o vazio em 0 no meio da digitação.
 */
export function CampoNumero({ rotulo, valor, onChange, id }: CampoNumeroProps) {
  const [texto, setTexto] = useState(String(valor))
  // Valor trocado de fora (cancelar a edição, outro personagem): o texto acompanha.
  useEffect(() => {
    setTexto((atual) => (inteiroDoTexto(atual) === valor ? atual : String(valor)))
  }, [valor])
  return (
    <input
      id={id}
      className="lb-input lb-ficha__numero"
      inputMode="numeric"
      aria-label={id === undefined ? rotulo : undefined}
      value={texto}
      onChange={(event) => {
        setTexto(event.target.value)
        const numero = inteiroDoTexto(event.target.value)
        if (numero !== null && numero !== valor) onChange(numero)
      }}
      onBlur={() => setTexto(String(valor))}
    />
  )
}
