'use strict'
/*
 * Porta do vite por PASTA — uma por árvore de trabalho.
 *
 * POR QUE EXISTE. `vite.config.ts` fixa 1420 com `strictPort: true` e o
 * `playwright.config.ts` reaproveita servidor que já responde
 * (`reuseExistingServer`). Com duas árvores (worktrees) rodando o portão ao
 * mesmo tempo, o vite da segunda morre por porta ocupada e o Playwright dela
 * testa o app da PRIMEIRA: verde (ou vermelho) sobre código que não é o dela —
 * a mesma classe de falso-verde do incidente de porta de 17/09/2026.
 *
 * A árvore principal continua na 1420: é a porta que o exe em dev aponta
 * (desktop/src-tauri/src/net/server.rs:42) e a que o usuário abre na mão.
 * Worktree ganha porta própria, derivada do caminho — determinística, sem
 * combinar nada com quem dispara o portão.
 */
const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const PORTA_PRINCIPAL = 1420
const PRIMEIRA_PORTA_WORKTREE = 1500
const QUANTAS_PORTAS = 40
// Par a par: o vite usa a porta e o HMR costuma usar a seguinte.
const PASSO = 2

// Worktree do git tem `.git` ARQUIVO (aponta para a árvore principal);
// a árvore principal tem `.git` diretório.
function ehWorktree(raizDoRepo) {
  try {
    return fs.statSync(path.join(raizDoRepo, '.git')).isFile()
  } catch {
    return false
  }
}

function portaDoProjeto() {
  const daEnv = Number(process.env.LAB_PORTA)
  if (Number.isFinite(daEnv) && daEnv > 0) return daEnv
  const raizDoRepo = path.resolve(__dirname, '..')
  if (!ehWorktree(raizDoRepo)) return PORTA_PRINCIPAL
  const digest = createHash('sha1').update(raizDoRepo.toLowerCase()).digest()
  return PRIMEIRA_PORTA_WORKTREE + (digest.readUInt16BE(0) % QUANTAS_PORTAS) * PASSO
}

module.exports = { portaDoProjeto, PORTA_PRINCIPAL }
