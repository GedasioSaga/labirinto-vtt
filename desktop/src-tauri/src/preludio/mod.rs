//! PRELÚDIO: a cópia de segurança no Google Drive (docs/planos/preludio-2026-11-08.md,
//! "Depois do conselho": cópia no Google Drive desde a F0, só o que mudou, cada imagem
//! uma vez, com restaurar de uma data).
//!
//! Desenho de segurança (o mesmo de `nuvem.rs` e `ia.rs`):
//! - o login é OAuth 2.0 com PKCE no navegador do sistema ([`google`]); o refresh
//!   token mora no Cofre do Windows e o access token só na memória deste processo.
//!   Nenhum dos dois volta à webview, e nenhum comando os devolve;
//! - o Client ID e o Client Secret do Google entram NA COMPILAÇÃO
//!   (`LABIRINTO_GOOGLE_CLIENT_ID` e `LABIRINTO_GOOGLE_CLIENT_SECRET`), nunca no git;
//!   sem eles o app compila e o login avisa que a build saiu sem o cliente do Google;
//! - escopo `drive.file`: o app só enxerga o que ele mesmo criou no Drive, e toda
//!   listagem desce da pasta marcada dele ([`drive`]). Nada aqui apaga no Drive;
//! - a webview escolhe o verbo (entrar, copiar, listar, restaurar) e, no restaurar, o
//!   id de uma cópia que o próprio Rust confere na lista; nunca caminho nem URL;
//! - todo comando recusa janela que não seja a `main` (a visão de jogador roda o
//!   mesmo front e não pode falar com o Google);
//! - nada roda sozinho: sem a chave `preparo` a tela não abre e a ponte do
//!   TypeScript (`client/src/preludio/copia/ponteDaCopia.ts`) não chama nada.
//!
//! CONTRATO COM O TYPESCRIPT. Argumentos em camelCase, como o Tauri 2 converte.
//!
//! | comando | argumentos | devolve |
//! |---|---|---|
//! | `preludio_google_estado` | — | `{credenciaisNaBuild, email}` (`email` = `null` sem login) |
//! | `preludio_google_entrar` | — | o e-mail da conta (abre o navegador e espera até 5 min) |
//! | `preludio_google_cancelar` | — | `null` (desiste do login que espera o navegador) |
//! | `preludio_google_sair` | — | `null` (esquece a conta neste PC; não revoga no Google) |
//! | `preludio_copia_ultima` | — | a última cópia feita neste PC, ou `null` |
//! | `preludio_copia_fazer` | — | o resumo da cópia (`nadaMudou` = o Drive já tinha tudo) |
//! | `preludio_copia_listar` | — | as cópias no Drive, da mais nova para a mais velha |
//! | `preludio_copia_restaurar` | `copiaId` | o resumo; o Prelúdio de antes fica guardado no PC |
//! | `preludio_espaco_livre` | — | os bytes livres no disco de `<appData>` (inteiro; a importação do Grimório exige 8 GB) |
//!
//! Enquanto copia ou restaura, o Rust avisa o andamento no evento `preludio:copia`
//! (só para a janela `main`): `{fase, feitos, total}`, com `fase` = `lendo`,
//! `conferindo`, `enviando`, `baixando` ou `trocando`, e `fim` quando o comando
//! termina (deu certo ou não).
//!
//! Erro: `{codigo, mensagem}` ([`ErroPreludio`]), `mensagem` pronta para o mestre.
//! Códigos: `janela`, `sem_credenciais_na_build`, `sem_conta` (falta entrar, ou a
//! conexão venceu), `login`, `cancelado`, `ocupado`, `cofre`, `rede`, `google`,
//! `disco`, `vazio`, `pedido_invalido`, `copia_invalida`, `copia_incompleta`.

pub mod comandos;
mod copia;
mod disco;
mod drive;
mod google;
mod plano;
mod rede;

use serde::Serialize;

/// Erro devolvido à webview. `codigo` é estável (o TS decide por ele); `mensagem` já
/// vem pronta. Nunca carrega token: as mensagens são montadas aqui, sem o corpo cru das
/// respostas do Google.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ErroPreludio {
    pub codigo: &'static str,
    pub mensagem: String,
}

impl ErroPreludio {
    fn novo(codigo: &'static str, mensagem: impl Into<String>) -> Self {
        Self {
            codigo,
            mensagem: mensagem.into(),
        }
    }
}

fn erro_disco(mensagem: impl Into<String>) -> ErroPreludio {
    ErroPreludio::novo("disco", mensagem)
}

fn erro_interrompido() -> ErroPreludio {
    ErroPreludio::novo("disco", "O trabalho no disco foi interrompido. Tente de novo.")
}

/// O estado do Prelúdio no Tauri. Criar não faz nada: nenhum disco, rede ou cofre é
/// tocado antes de um comando ser chamado.
#[derive(Default)]
pub struct PreludioEstado {
    google: google::EstadoGoogle,
    /// Um cliente HTTP só, criado no primeiro uso e reaproveitado (conexões vivas).
    http: tokio::sync::OnceCell<reqwest::Client>,
    /// Uma cópia ou restauração por vez.
    trava_da_copia: tokio::sync::Mutex<()>,
}

impl PreludioEstado {
    async fn http(&self) -> Result<&reqwest::Client, ErroPreludio> {
        self.http.get_or_try_init(|| async { rede::cliente() }).await
    }
}
