/*
 * O playwright.config.ts de sempre, PULANDO os e2e vermelhos pré-existentes de
 * e2e/vermelhas-conhecidas.json (docs/planos/teste-em-niveis.md). Usado pelo
 * N0 e pelo N1 do scripts/teste-rapido.cjs: teste que já sabemos vermelho não
 * roda (nem espera o timeout dele) e todo o resto tem de passar. O N2 usa o
 * config de sempre, roda TUDO e compara as falhas com a lista.
 *
 * O Playwright casa o grep com "arquivo describe... título @tags" separados
 * por espaço (Suite._collectGrepTitlePath em playwright/lib/common/index.js);
 * a lista guarda "arquivo › describe › título", como o reporter list imprime.
 */
import { defineConfig } from '@playwright/test'
import base from './playwright.config'
import lista from './e2e/vermelhas-conhecidas.json' with { type: 'json' }

const ESPECIAIS_DE_REGEX = /[.*+?^${}()|[\]\\]/g

function escapar(texto: string): string {
  return texto.replace(ESPECIAIS_DE_REGEX, '\\$&')
}

/** Casa o título exato do teste (tags no fim são aceitas), nunca um prefixo dele. */
export function regexDoTitulo(nome: string): RegExp {
  return new RegExp('(?:^|\\s)' + nome.split(' › ').map(escapar).join(' ') + '(?: @\\S+)*$')
}

export default defineConfig({ ...base, grepInvert: lista.testes.map(regexDoTitulo) })
