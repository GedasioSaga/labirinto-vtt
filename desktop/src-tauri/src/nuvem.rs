//! LOBBY DOS JOGADORES: a ponte do app do mestre com a nuvem (fatia R1 de
//! docs/planos/lobby-jogadores-2026-11-05.md, seções 3.2, 5.4, 6 e 8.1).
//!
//! Desenho de segurança (o mesmo do assistente, `ia.rs`):
//! - o Service Token do Cloudflare Access (Client ID e Client Secret) mora no
//!   Credential Manager do Windows, alvo `labirinto-vtt.lobby`, como JSON;
//!   nunca em arquivo do app (o `fs:scope` deixa a webview ler toda a APPDATA),
//!   nunca em log, e nenhum comando o devolve à webview;
//! - o HTTP sai daqui: a webview escolhe uma ROTA de uma lista fechada
//!   ([`PedidoNuvem`]) e os ids dela, nunca a URL nem cabeçalho; a base é fixa
//!   ([`URL_BASE`]), só HTTPS, sem seguir redirecionamento (o Access redireciona
//!   para o login quando recusa o token: segui-lo levaria a credencial embora);
//! - cada pedido tem 15 s no total ([`TEMPO_TOTAL`]);
//! - a mídia sobe lida do disco por aqui, com o id conferido (forma, tipo pelos
//!   bytes, hash) antes de sair; a webview não manda bytes de imagem;
//! - todos os comandos recusam janela que não seja a `main` (a visão de jogador
//!   roda o mesmo front e não pode falar com a nuvem).
//!
//! CONTRATO COM O TYPESCRIPT (A5, `client/src/net/nuvem/`). O plano não fixa
//! nomes de comando; ficaram estes (o prefixo segue o `ia_` do assistente).
//! Argumentos em camelCase, como o Tauri 2 converte.
//!
//! | comando | argumentos | devolve |
//! |---|---|---|
//! | `nuvem_credencial_estado` | — | `boolean` (há credencial guardada) |
//! | `nuvem_credencial_guardar` | `clientId`, `clientSecret` | `null` |
//! | `nuvem_credencial_apagar` | — | `null` (apagar o que não existe não é erro) |
//! | `nuvem_pedir` | `pedido` (abaixo) | o JSON da resposta (`null` se vazia) |
//! | `nuvem_enviar_midia` | `campanhaId`, `pastaId`, `midiaId` | o JSON da resposta do PUT |
//! | `nuvem_baixar_midia` | `campanhaId`, `midiaId` | `null`; a imagem fica em `<appData>/midia/<midiaId>` |
//!
//! `pedido` é um objeto com o campo `rota` (seção 5.4):
//! - `{rota:'eu'}` → `GET /api/eu`
//! - `{rota:'publicar', campanhaId, corpo}` → `POST /api/c/:id/publicar`
//! - `{rota:'membros', campanhaId, corpo}` → `POST /api/c/:id/membros`
//! - `{rota:'ops', campanhaId, corpo}` → `POST /api/c/:id/ops`
//! - `{rota:'desde', campanhaId, rev, limite?}` → `GET /api/c/:id/desde/:rev?limite=` (padrão e teto 500)
//! - `{rota:'exportar', campanhaId, deRev?, ateRev?}` → `GET /api/c/:id/exportar?deRev=&ateRev=`
//! - `{rota:'salaDoChat', campanhaId, desde, limite?}` → `GET /api/c/:id/chat/sala?desde=&limite=`
//!   (v2, fatia C3R: a cópia da sala do chat no disco do mestre; padrão e teto
//!   500, o `LIMITE_DA_ROTA_DA_SALA` do Worker; devolve
//!   `{desde, ate, lista, temMais, cursorAtual}`, só a sala, nunca o privado)
//! - `{rota:'abrirSala', campanhaId, corpo}` → `POST /api/c/:id/sala`
//!   (fatia B3, "Entrar na mesa agora": a sala aberta no app aparece no Lobby).
//!   `corpo` = `{codigo, enderecos:[{tipo:'lan'|'tunel', url}]}`; quem confere
//!   o código e as URLs é o Worker (só `http://<IP privado>:<porta>/player` ou
//!   `https://<rótulo>.trycloudflare.com/player`). A mesma rota é a batida a
//!   cada 4 min: renova o prazo e troca os endereços, mantendo a chave. Devolve
//!   `{chave, agora, expiraEm}` (`agora` é o relógio do Lobby, para o app medir
//!   a diferença do seu). A `chave` é o segredo que assina os bilhetes de
//!   entrada: este módulo só a repassa ao `nuvem_pedir` da janela `main`, sem
//!   guardar, sem imprimir e sem pôr em `ErroNuvem` (o `detalhe` só sai de
//!   resposta que não é 2xx, e a chave só vem em 2xx)
//! - `{rota:'fecharSala', campanhaId}` → `POST /api/c/:id/sala/fechar` (no
//!   `net_stop_room`: o Lobby apaga o registro e a chave). Sem `corpo` vindo da
//!   webview; vai o JSON fixo `{}`, para o POST sair com Content-Length como os
//!   outros. Devolve o que o Worker responder (`null` se vazio)
//!
//! `corpo` é qualquer JSON (até 16 MiB); o formato é do Worker (W1), não daqui.
//! A resposta 2xx volta inteira como JSON (até 32 MiB). Campo a mais no
//! `pedido` ou rota fora da lista é recusado na desserialização do Tauri.
//!
//! Erro: `{codigo, mensagem, status, detalhe}` ([`ErroNuvem`]); `mensagem` vem
//! pronta para o usuário, `detalhe` é o começo do corpo da resposta, sem a
//! credencial. Códigos: `janela`, `credencial_invalida`, `sem_credencial`,
//! `cofre`, `pedido_invalido`, `midia_ausente`, `midia_invalida`, `disco`,
//! `rede` (sem conexão, 15 s estourados ou queda no meio), `acesso_negado`
//! (3xx, 401, 403), `nao_encontrado` (404), `ritmo` (429), `servidor` (5xx),
//! `http` (outro status), `resposta_invalida` (2xx que não é JSON, ou grande
//! demais).
//!
//! Escolhas onde o plano é ambíguo:
//! - id de campanha: 1 a 80 de `[A-Za-z0-9_-]` (vai no caminho da URL; nada de
//!   barra, ponto, `?` ou `%`). O plano não fixa a forma;
//! - `:hash` da mídia na URL é o id inteiro `<sha256>.<ext>` (a extensão é o
//!   que o Worker confere contra os bytes, 6.6); só imagem (webp, png, jpg,
//!   gif), nunca áudio nem SVG;
//! - a mídia sobe lida de `<appData>/pastas/<pastaId>/midia/<id>` (a cópia da
//!   pasta, 3.2) e, se não estiver lá, de `<appData>/midia/<id>` (a mídia da
//!   mesa, onde o app grava toda imagem); as duas são conferidas pelo hash;
//! - o GET da mídia grava em `<appData>/midia` (de onde o app lê toda imagem),
//!   só se os bytes conferem com o id.

use std::path::{Path, PathBuf};
use std::time::Duration;

use rand::Rng;
use reqwest::header::{HeaderValue, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Manager, State, WebviewWindow};

use crate::net::media::{self, ErroDeMidia, TipoDeMidia};

/// Única janela autorizada a falar com a nuvem.
const ROTULO_MAIN: &str = "main";
/// Nome da credencial no Gerenciador de Credenciais do Windows.
const ALVO_COFRE: &str = "labirinto-vtt.lobby";

/// O site do Lobby, atrás do Cloudflare Access (seção 6.1). Fixo no binário.
pub const URL_BASE: &str = "https://labirintolobby.pages.dev";
const TEMPO_TOTAL: Duration = Duration::from_secs(15);

/// Cabeçalhos do Service Token (docs do Cloudflare Access, "service tokens").
const CABECALHO_CLIENT_ID: &str = "cf-access-client-id";
const CABECALHO_CLIENT_SECRET: &str = "cf-access-client-secret";
const TIPO_JSON: &str = "application/json";

/// Forma do Service Token: Client ID = 32 caracteres + `.access`, Client
/// Secret = 64 caracteres. A faixa folga para não recusar uma mudança de
/// tamanho do Cloudflare; o que importa é caber num cabeçalho e não ser lixo.
const SUFIXO_DO_CLIENT_ID: &str = ".access";
const CLIENT_ID_MIN: usize = 16;
const CLIENT_ID_MAX: usize = 64;
const CLIENT_SECRET_MIN: usize = 32;
const CLIENT_SECRET_MAX: usize = 128;

const KIB: usize = 1024;
const MIB: usize = 1024 * KIB;
/// Publicar leva as fichas novas (até 256 KiB cada, 4.7) e o sistema.
const CORPO_MAX_BYTES: usize = 16 * MIB;
/// `desde` com 500 ops; a página que passar disso volta com `limite` menor.
const RESPOSTA_MAX_BYTES: usize = 32 * MIB;
/// Do corpo de uma resposta de erro só se lê o começo, para o `detalhe`.
const CORPO_DE_ERRO_MAX_BYTES: usize = 64 * KIB;
const DETALHE_MAX_CARACTERES: usize = 300;
const MASCARA: &str = "(credencial)";

const DESDE_LIMITE_PADRAO: u32 = 500;
/// Página da cópia da sala (`LIMITE_DA_ROTA_DA_SALA` em `lobby/nuvem/src/chat.ts`).
const SALA_DO_CHAT_LIMITE_PADRAO: u32 = 500;
const ID_DE_CAMPANHA_MAX: usize = 80;

/// `<appData>/pastas/<id>/midia/` (client/src/lib/pastasDeMapas.ts).
const PASTA_DAS_PASTAS: &str = "pastas";
const PASTA_DE_MIDIA_DA_PASTA: &str = "midia";
/// `^pasta_[A-Za-z0-9-]{1,64}$`, a mesma regra de `idDePastaValido` no TS.
const PREFIXO_DO_ID_DE_PASTA: &str = "pasta_";
const ID_DE_PASTA_MAX: usize = 64;

// ---------------------------------------------------------------------------
// Erro que cruza o IPC
// ---------------------------------------------------------------------------

/// Erro devolvido à webview. `codigo` é estável (o TS decide por ele);
/// `mensagem` já vem pronta para o usuário. Nunca carrega a credencial: o
/// `detalhe` passa por [`detalhe_seguro`] antes de sair.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ErroNuvem {
    pub codigo: &'static str,
    pub mensagem: String,
    pub status: Option<u16>,
    pub detalhe: Option<String>,
}

impl ErroNuvem {
    fn novo(codigo: &'static str, mensagem: impl Into<String>) -> Self {
        Self {
            codigo,
            mensagem: mensagem.into(),
            status: None,
            detalhe: None,
        }
    }

    fn com_http(mut self, status: u16, detalhe: String) -> Self {
        self.status = Some(status);
        self.detalhe = (!detalhe.is_empty()).then_some(detalhe);
        self
    }
}

fn erro_cofre(mensagem: impl Into<String>) -> ErroNuvem {
    ErroNuvem::novo("cofre", mensagem)
}

fn pedido_invalido(mensagem: impl Into<String>) -> ErroNuvem {
    ErroNuvem::novo("pedido_invalido", mensagem)
}

fn erro_credencial(mensagem: impl Into<String>) -> ErroNuvem {
    ErroNuvem::novo("credencial_invalida", mensagem)
}

fn midia_invalida(mensagem: impl Into<String>) -> ErroNuvem {
    ErroNuvem::novo("midia_invalida", mensagem)
}

fn erro_disco(_erro: std::io::Error) -> ErroNuvem {
    ErroNuvem::novo("disco", "Não deu para gravar a imagem na mídia do app.")
}

fn resposta_invalida(mensagem: impl Into<String>) -> ErroNuvem {
    ErroNuvem::novo("resposta_invalida", mensagem)
}

fn exigir_main(window: &WebviewWindow) -> Result<(), ErroNuvem> {
    if window.label() == ROTULO_MAIN {
        Ok(())
    } else {
        Err(ErroNuvem::novo(
            "janela",
            "O Lobby só funciona na janela principal do app.",
        ))
    }
}

// ---------------------------------------------------------------------------
// A credencial (Service Token) e o cofre
// ---------------------------------------------------------------------------

/// O JSON guardado no cofre. Sem `Debug` de propósito: nada imprime isto.
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Credencial {
    client_id: String,
    client_secret: String,
}

fn so_letras_e_digitos(texto: &str) -> bool {
    texto.bytes().all(|b| b.is_ascii_alphanumeric())
}

/// Aparada e na forma do Cloudflare. As mensagens citam o campo, nunca o
/// conteúdo.
fn validar_credencial(client_id: &str, client_secret: &str) -> Result<Credencial, ErroNuvem> {
    let id = client_id.trim();
    let segredo = client_secret.trim();
    if id.is_empty() || segredo.is_empty() {
        return Err(erro_credencial(
            "Cole o Client ID e o Client Secret do Service Token.",
        ));
    }
    if segredo.ends_with(SUFIXO_DO_CLIENT_ID) && !id.ends_with(SUFIXO_DO_CLIENT_ID) {
        return Err(erro_credencial(
            "Os campos parecem trocados: o Client ID é o que termina em .access.",
        ));
    }
    let id_ok = id.strip_suffix(SUFIXO_DO_CLIENT_ID).is_some_and(|prefixo| {
        (CLIENT_ID_MIN..=CLIENT_ID_MAX).contains(&prefixo.len()) && so_letras_e_digitos(prefixo)
    });
    if !id_ok {
        return Err(erro_credencial(
            "O Client ID não tem a forma do Cloudflare (letras e números terminando em .access).",
        ));
    }
    if !(CLIENT_SECRET_MIN..=CLIENT_SECRET_MAX).contains(&segredo.len())
        || !so_letras_e_digitos(segredo)
    {
        return Err(erro_credencial(format!(
            "O Client Secret não tem a forma do Cloudflare ({CLIENT_SECRET_MIN} a {CLIENT_SECRET_MAX} letras e números)."
        )));
    }
    Ok(Credencial {
        client_id: id.to_owned(),
        client_secret: segredo.to_owned(),
    })
}

#[cfg(windows)]
mod cofre {
    use std::collections::HashMap;

    use keyring_core::api::CredentialStoreApi as _;
    use keyring_core::{Entry, Error};

    use super::{erro_cofre, ErroNuvem, ALVO_COFRE};

    const SERVICO: &str = "lobby";
    const USUARIO: &str = "labirinto-vtt";

    fn mensagem(erro: &Error) -> String {
        // O Display da keyring-core descreve a falha do Windows; nunca inclui
        // o segredo (ele não passa pelos erros da crate).
        format!("Não deu para usar o Cofre do Windows ({erro}).")
    }

    fn entrada() -> Result<Entry, ErroNuvem> {
        let store =
            windows_native_keyring_store::Store::new().map_err(|e| erro_cofre(mensagem(&e)))?;
        // `target` fixa o nome da credencial; `Local` = só neste computador
        // (o padrão da crate, Enterprise, viaja com o perfil de domínio).
        let modificadores = HashMap::from([("target", ALVO_COFRE), ("persistence", "Local")]);
        store
            .build(SERVICO, USUARIO, Some(&modificadores))
            .map_err(|e| erro_cofre(mensagem(&e)))
    }

    pub fn ler() -> Result<Option<String>, ErroNuvem> {
        match entrada()?.get_password() {
            Ok(texto) => Ok(Some(texto)),
            Err(Error::NoEntry) => Ok(None),
            Err(e) => Err(erro_cofre(mensagem(&e))),
        }
    }

    pub fn gravar(texto: &str) -> Result<(), ErroNuvem> {
        entrada()?
            .set_password(texto)
            .map_err(|e| erro_cofre(mensagem(&e)))
    }

    pub fn apagar() -> Result<(), ErroNuvem> {
        match entrada()?.delete_credential() {
            Ok(()) | Err(Error::NoEntry) => Ok(()),
            Err(e) => Err(erro_cofre(mensagem(&e))),
        }
    }
}

#[cfg(not(windows))]
mod cofre {
    use super::{erro_cofre, ErroNuvem};

    const INDISPONIVEL: &str = "Cofre indisponível neste sistema.";

    pub fn ler() -> Result<Option<String>, ErroNuvem> {
        Err(erro_cofre(INDISPONIVEL))
    }

    pub fn gravar(_texto: &str) -> Result<(), ErroNuvem> {
        Err(erro_cofre(INDISPONIVEL))
    }

    pub fn apagar() -> Result<(), ErroNuvem> {
        Err(erro_cofre(INDISPONIVEL))
    }
}

/// O Credential Manager é chamada bloqueante do Windows: sai do worker async.
async fn no_cofre<T, F>(f: F) -> Result<T, ErroNuvem>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, ErroNuvem> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|_| erro_cofre("O acesso ao Cofre do Windows foi interrompido."))?
}

async fn ler_credencial() -> Result<Option<Credencial>, ErroNuvem> {
    let Some(texto) = no_cofre(cofre::ler).await? else {
        return Ok(None);
    };
    let danificada = || {
        erro_cofre(format!(
            "A credencial {ALVO_COFRE} está danificada. Apague e cole de novo em Conta na nuvem."
        ))
    };
    let guardada: Credencial = serde_json::from_str(&texto).map_err(|_| danificada())?;
    // Editada à mão fora do app: só passa a forma que o app grava, que é
    // também o que cabe num cabeçalho HTTP.
    validar_credencial(&guardada.client_id, &guardada.client_secret)
        .map(Some)
        .map_err(|_| danificada())
}

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

/// A trava serializa o acesso ao cofre (a crate do Windows avisa que operações
/// na mesma credencial em threads diferentes não saem em ordem garantida) e
/// cobre só ler e gravar, nunca a chamada HTTP. A ponte é criada uma vez e
/// reaproveita a conexão: o app consulta a cada 5 s com a campanha aberta.
#[derive(Default)]
pub struct NuvemEstado {
    trava_cofre: tokio::sync::Mutex<()>,
    ponte: tokio::sync::OnceCell<Ponte>,
}

impl NuvemEstado {
    async fn ponte(&self) -> Result<&Ponte, ErroNuvem> {
        self.ponte
            .get_or_try_init(|| async { Ponte::producao() })
            .await
    }

    async fn credencial(&self) -> Result<Credencial, ErroNuvem> {
        let _trava = self.trava_cofre.lock().await;
        ler_credencial().await?.ok_or_else(|| {
            ErroNuvem::novo(
                "sem_credencial",
                "Sem a credencial do Lobby. Cole o Service Token em Conta na nuvem.",
            )
        })
    }
}

// ---------------------------------------------------------------------------
// Rotas (lista fechada, seção 5.4)
// ---------------------------------------------------------------------------

/// Id de campanha conferido: só vai no caminho da URL nesta forma.
struct CampanhaId(String);

impl CampanhaId {
    fn validar(bruto: &str) -> Result<Self, ErroNuvem> {
        let ok = (1..=ID_DE_CAMPANHA_MAX).contains(&bruto.len())
            && bruto
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-');
        if ok {
            Ok(Self(bruto.to_owned()))
        } else {
            Err(pedido_invalido("O id da campanha não tem a forma esperada."))
        }
    }
}

/// Id de mídia conferido (`<64 hex>.<webp|png|jpg|gif>`): o Lobby só aceita
/// imagem (6.6).
struct IdDeImagem {
    id: String,
    tipo: TipoDeMidia,
}

impl IdDeImagem {
    fn validar(bruto: &str) -> Result<Self, ErroNuvem> {
        match media::tipo_do_id(bruto) {
            Some(tipo) if !tipo.eh_audio() => Ok(Self {
                id: bruto.to_owned(),
                tipo,
            }),
            _ => Err(pedido_invalido(
                "A mídia do Lobby é só imagem (webp, png, jpg ou gif) com o nome pelo hash.",
            )),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Metodo {
    Get,
    Post,
    Put,
}

/// Todas as rotas que o app usa. A URL sai só daqui: base fixa + caminho
/// montado com ids já conferidos e números.
enum Rota {
    Eu,
    Publicar(CampanhaId),
    Membros(CampanhaId),
    Ops(CampanhaId),
    Desde {
        campanha: CampanhaId,
        rev: u64,
        limite: u32,
    },
    Exportar {
        campanha: CampanhaId,
        de_rev: Option<u64>,
        ate_rev: Option<u64>,
    },
    /// A cópia da sala do chat (v2, C3R): as mensagens com `mudou > desde`.
    SalaDoChat {
        campanha: CampanhaId,
        desde: u64,
        limite: u32,
    },
    /// A sala aberta no app, publicada no Lobby (B3); também a batida que
    /// renova o prazo. A resposta traz a chave dos bilhetes.
    AbrirSala(CampanhaId),
    /// A sala fechou no app (B3): o Lobby apaga o registro e a chave.
    FecharSala(CampanhaId),
    EnviarMidia {
        campanha: CampanhaId,
        midia: IdDeImagem,
    },
    BaixarMidia {
        campanha: CampanhaId,
        midia: IdDeImagem,
    },
}

impl Rota {
    fn metodo(&self) -> Metodo {
        match self {
            Self::Eu
            | Self::Desde { .. }
            | Self::Exportar { .. }
            | Self::SalaDoChat { .. }
            | Self::BaixarMidia { .. } => Metodo::Get,
            Self::Publicar(_)
            | Self::Membros(_)
            | Self::Ops(_)
            | Self::AbrirSala(_)
            | Self::FecharSala(_) => Metodo::Post,
            Self::EnviarMidia { .. } => Metodo::Put,
        }
    }

    fn caminho(&self) -> String {
        match self {
            Self::Eu => "/api/eu".to_owned(),
            Self::Publicar(campanha) => format!("/api/c/{}/publicar", campanha.0),
            Self::Membros(campanha) => format!("/api/c/{}/membros", campanha.0),
            Self::Ops(campanha) => format!("/api/c/{}/ops", campanha.0),
            Self::Desde {
                campanha,
                rev,
                limite,
            } => format!("/api/c/{}/desde/{rev}?limite={limite}", campanha.0),
            Self::Exportar {
                campanha,
                de_rev,
                ate_rev,
            } => {
                let mut consulta = Vec::new();
                if let Some(de) = de_rev {
                    consulta.push(format!("deRev={de}"));
                }
                if let Some(ate) = ate_rev {
                    consulta.push(format!("ateRev={ate}"));
                }
                let base = format!("/api/c/{}/exportar", campanha.0);
                if consulta.is_empty() {
                    base
                } else {
                    format!("{base}?{}", consulta.join("&"))
                }
            }
            Self::SalaDoChat {
                campanha,
                desde,
                limite,
            } => format!(
                "/api/c/{}/chat/sala?desde={desde}&limite={limite}",
                campanha.0
            ),
            Self::AbrirSala(campanha) => format!("/api/c/{}/sala", campanha.0),
            Self::FecharSala(campanha) => format!("/api/c/{}/sala/fechar", campanha.0),
            Self::EnviarMidia { campanha, midia } | Self::BaixarMidia { campanha, midia } => {
                format!("/api/c/{}/midia/{}", campanha.0, midia.id)
            }
        }
    }
}

/// O que a webview manda ao `nuvem_pedir`: uma rota da lista e os dados dela.
/// A mídia tem comandos próprios (os bytes vêm do disco, não da webview).
#[derive(Deserialize)]
#[serde(
    tag = "rota",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum PedidoNuvem {
    /// Variante de struct vazia (não unitária) para o `deny_unknown_fields`
    /// valer também aqui.
    Eu {},
    Publicar {
        campanha_id: String,
        corpo: Value,
    },
    Membros {
        campanha_id: String,
        corpo: Value,
    },
    Ops {
        campanha_id: String,
        corpo: Value,
    },
    Desde {
        campanha_id: String,
        rev: u64,
        #[serde(default)]
        limite: Option<u32>,
    },
    Exportar {
        campanha_id: String,
        #[serde(default)]
        de_rev: Option<u64>,
        #[serde(default)]
        ate_rev: Option<u64>,
    },
    /// v2 (C3R): a cópia da sala do chat. `desde` é o cursor `mudou` do Worker.
    SalaDoChat {
        campanha_id: String,
        desde: u64,
        #[serde(default)]
        limite: Option<u32>,
    },
    /// B3: `corpo` = `{codigo, enderecos}`, conferido pelo Worker.
    AbrirSala {
        campanha_id: String,
        corpo: Value,
    },
    /// B3: sem corpo da webview (vai o `{}` fixo).
    FecharSala {
        campanha_id: String,
    },
}

impl PedidoNuvem {
    /// A rota com os ids conferidos e o corpo (só nas rotas POST).
    fn validar(self) -> Result<(Rota, Option<Value>), ErroNuvem> {
        Ok(match self {
            Self::Eu {} => (Rota::Eu, None),
            Self::Publicar { campanha_id, corpo } => (
                Rota::Publicar(CampanhaId::validar(&campanha_id)?),
                Some(corpo),
            ),
            Self::Membros { campanha_id, corpo } => (
                Rota::Membros(CampanhaId::validar(&campanha_id)?),
                Some(corpo),
            ),
            Self::Ops { campanha_id, corpo } => {
                (Rota::Ops(CampanhaId::validar(&campanha_id)?), Some(corpo))
            }
            Self::Desde {
                campanha_id,
                rev,
                limite,
            } => {
                let limite = limite.unwrap_or(DESDE_LIMITE_PADRAO);
                if !(1..=DESDE_LIMITE_PADRAO).contains(&limite) {
                    return Err(pedido_invalido(format!(
                        "O limite do desde vai de 1 a {DESDE_LIMITE_PADRAO}."
                    )));
                }
                let campanha = CampanhaId::validar(&campanha_id)?;
                (
                    Rota::Desde {
                        campanha,
                        rev,
                        limite,
                    },
                    None,
                )
            }
            Self::Exportar {
                campanha_id,
                de_rev,
                ate_rev,
            } => {
                if let (Some(de), Some(ate)) = (de_rev, ate_rev) {
                    if de > ate {
                        return Err(pedido_invalido(
                            "Na exportação, deRev não pode passar de ateRev.",
                        ));
                    }
                }
                let campanha = CampanhaId::validar(&campanha_id)?;
                (
                    Rota::Exportar {
                        campanha,
                        de_rev,
                        ate_rev,
                    },
                    None,
                )
            }
            Self::SalaDoChat {
                campanha_id,
                desde,
                limite,
            } => {
                let limite = limite.unwrap_or(SALA_DO_CHAT_LIMITE_PADRAO);
                if !(1..=SALA_DO_CHAT_LIMITE_PADRAO).contains(&limite) {
                    return Err(pedido_invalido(format!(
                        "O limite da sala do chat vai de 1 a {SALA_DO_CHAT_LIMITE_PADRAO}."
                    )));
                }
                let campanha = CampanhaId::validar(&campanha_id)?;
                (
                    Rota::SalaDoChat {
                        campanha,
                        desde,
                        limite,
                    },
                    None,
                )
            }
            Self::AbrirSala { campanha_id, corpo } => (
                Rota::AbrirSala(CampanhaId::validar(&campanha_id)?),
                Some(corpo),
            ),
            Self::FecharSala { campanha_id } => (
                Rota::FecharSala(CampanhaId::validar(&campanha_id)?),
                Some(Value::Object(serde_json::Map::new())),
            ),
        })
    }
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

struct Ponte {
    base: String,
    cliente: reqwest::Client,
}

impl Ponte {
    fn producao() -> Result<Self, ErroNuvem> {
        Self::nova(URL_BASE.to_owned(), TEMPO_TOTAL, true)
    }

    fn nova(base: String, tempo: Duration, so_https: bool) -> Result<Self, ErroNuvem> {
        let mut construtor = reqwest::Client::builder()
            .timeout(tempo)
            .https_only(so_https)
            // A URL é fixa; redirecionamento levaria a credencial para outro
            // lugar (e é como o Access responde a token recusado).
            .redirect(reqwest::redirect::Policy::none())
            .user_agent(concat!("labirinto-vtt/", env!("CARGO_PKG_VERSION")));
        if !so_https {
            // Só o servidor falso dos testes, em 127.0.0.1.
            construtor = construtor.no_proxy();
        }
        let cliente = construtor
            .build()
            .map_err(|_| ErroNuvem::novo("rede", "Não deu para preparar a conexão com o Lobby."))?;
        Ok(Self { base, cliente })
    }
}

struct Corpo {
    bytes: Vec<u8>,
    /// Sempre uma constante deste módulo ou de `TipoDeMidia::mime`.
    tipo: &'static str,
}

fn corpo_json(valor: &Value) -> Result<Corpo, ErroNuvem> {
    let bytes = serde_json::to_vec(valor)
        .map_err(|_| pedido_invalido("Não deu para preparar o pedido ao Lobby."))?;
    if bytes.len() > CORPO_MAX_BYTES {
        return Err(pedido_invalido(format!(
            "O pedido ao Lobby passou de {} MiB.",
            CORPO_MAX_BYTES / MIB
        )));
    }
    Ok(Corpo {
        bytes,
        tipo: TIPO_JSON,
    })
}

/// Valor de cabeçalho marcado como sensível: o `Debug` do reqwest/http não o
/// imprime.
fn cabecalho_sensivel(texto: &str) -> Result<HeaderValue, ErroNuvem> {
    let mut valor = HeaderValue::from_str(texto).map_err(|_| {
        erro_cofre("A credencial guardada está danificada. Apague e cole de novo em Conta na nuvem.")
    })?;
    valor.set_sensitive(true);
    Ok(valor)
}

fn erro_rede(erro: &reqwest::Error) -> ErroNuvem {
    // Sem o texto do erro do reqwest: não é preciso, e assim nada do pedido
    // escapa por ele.
    let mensagem = if erro.is_timeout() {
        format!(
            "O Lobby demorou mais de {} s para responder. Tente de novo.",
            TEMPO_TOTAL.as_secs()
        )
    } else if erro.is_connect() {
        "Sem conexão com o Lobby. Confira a internet.".to_owned()
    } else {
        "A conexão com o Lobby caiu no meio. Tente de novo.".to_owned()
    };
    ErroNuvem::novo("rede", mensagem)
}

/// Até 300 caracteres do corpo, com a credencial trocada por "(credencial)".
/// Mascara ANTES de cortar: cortar primeiro poderia deixar um pedaço que já
/// não casa com a busca.
fn detalhe_seguro(corpo: &[u8], credencial: &Credencial) -> String {
    let mut texto = String::from_utf8_lossy(corpo).into_owned();
    for segredo in [&credencial.client_secret, &credencial.client_id] {
        texto = texto.replace(segredo.as_str(), MASCARA);
    }
    texto.trim().chars().take(DETALHE_MAX_CARACTERES).collect()
}

fn erro_http(status: u16, corpo: &[u8], credencial: &Credencial) -> ErroNuvem {
    let erro = match status {
        300..=399 | 401 | 403 => ErroNuvem::novo(
            "acesso_negado",
            "O Cloudflare Access recusou a credencial do app. Confira o Client ID e o Client Secret em Conta na nuvem.",
        ),
        404 => ErroNuvem::novo(
            "nao_encontrado",
            "O Lobby não achou isso (campanha não publicada ou já removida).",
        ),
        429 => ErroNuvem::novo(
            "ritmo",
            "O Lobby pediu para esperar um pouco antes de mandar de novo.",
        ),
        500..=599 => ErroNuvem::novo(
            "servidor",
            format!("O Lobby está com problema agora ({status}). Tente de novo em instantes."),
        ),
        _ => ErroNuvem::novo("http", format!("O Lobby recusou o pedido ({status}).")),
    };
    erro.com_http(status, detalhe_seguro(corpo, credencial))
}

/// Lê o corpo em pedaços e para no teto, sem confiar no Content-Length.
async fn ler_limitado(resposta: &mut reqwest::Response, teto: usize) -> Result<Vec<u8>, ErroNuvem> {
    let grande = || {
        resposta_invalida(format!(
            "A resposta do Lobby veio grande demais (mais de {} KiB).",
            teto / KIB
        ))
    };
    if resposta
        .content_length()
        .is_some_and(|n| n > u64::try_from(teto).unwrap_or(u64::MAX))
    {
        return Err(grande());
    }
    let mut corpo = Vec::new();
    while let Some(pedaco) = resposta.chunk().await.map_err(|e| erro_rede(&e))? {
        // Saturar aqui é a resposta certa: passou do teto de qualquer jeito.
        if corpo.len().saturating_add(pedaco.len()) > teto {
            return Err(grande());
        }
        corpo.extend_from_slice(&pedaco);
    }
    Ok(corpo)
}

/// Um pedido com a credencial. Devolve o corpo de uma resposta 2xx (até
/// `teto` bytes); qualquer outro status vira [`ErroNuvem`].
async fn enviar(
    ponte: &Ponte,
    credencial: &Credencial,
    rota: &Rota,
    corpo: Option<Corpo>,
    teto: usize,
) -> Result<Vec<u8>, ErroNuvem> {
    let url = format!("{}{}", ponte.base, rota.caminho());
    let mut pedido = match rota.metodo() {
        Metodo::Get => ponte.cliente.get(url),
        Metodo::Post => ponte.cliente.post(url),
        Metodo::Put => ponte.cliente.put(url),
    }
    .header(CABECALHO_CLIENT_ID, cabecalho_sensivel(&credencial.client_id)?)
    .header(CABECALHO_CLIENT_SECRET, cabecalho_sensivel(&credencial.client_secret)?);
    if let Some(corpo) = corpo {
        // `from_static` só recebe as constantes de `Corpo::tipo` (ASCII
        // visível, válidas como cabeçalho).
        pedido = pedido
            .header(CONTENT_TYPE, HeaderValue::from_static(corpo.tipo))
            .body(corpo.bytes);
    }
    let mut resposta = pedido.send().await.map_err(|e| erro_rede(&e))?;
    let status = resposta.status().as_u16();
    if (200..300).contains(&status) {
        return ler_limitado(&mut resposta, teto).await;
    }
    // O detalhe é só ajuda: corpo grande demais ou que cai no meio fica vazio,
    // e o status continua dizendo o que houve.
    let corpo_do_erro = ler_limitado(&mut resposta, CORPO_DE_ERRO_MAX_BYTES)
        .await
        .unwrap_or_default();
    Err(erro_http(status, &corpo_do_erro, credencial))
}

/// Corpo vazio = `null`; o resto tem de ser JSON.
fn json_da_resposta(bytes: &[u8]) -> Result<Value, ErroNuvem> {
    if bytes.iter().all(u8::is_ascii_whitespace) {
        return Ok(Value::Null);
    }
    serde_json::from_slice(bytes)
        .map_err(|_| resposta_invalida("A resposta do Lobby veio num formato inesperado."))
}

async fn pedir_json(
    ponte: &Ponte,
    credencial: &Credencial,
    rota: &Rota,
    corpo: Option<Corpo>,
) -> Result<Value, ErroNuvem> {
    let bytes = enviar(ponte, credencial, rota, corpo, RESPOSTA_MAX_BYTES).await?;
    json_da_resposta(&bytes)
}

// ---------------------------------------------------------------------------
// Mídia
// ---------------------------------------------------------------------------

fn validar_id_de_pasta(bruto: &str) -> Result<(), ErroNuvem> {
    let ok = bruto
        .strip_prefix(PREFIXO_DO_ID_DE_PASTA)
        .is_some_and(|resto| {
            (1..=ID_DE_PASTA_MAX).contains(&resto.len())
                && resto.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
        });
    if ok {
        Ok(())
    } else {
        Err(pedido_invalido("O id da pasta não tem a forma esperada."))
    }
}

/// Os bytes da imagem a subir: a cópia da pasta e, se não estiver lá, a mídia
/// da mesa. Os dois caminhos são montados só com ids conferidos, e
/// `media::ler_midia` confere tamanho, tipo pelos bytes e hash.
async fn ler_imagem_para_enviar(
    dados_do_app: &Path,
    pasta_id: &str,
    midia: &IdDeImagem,
) -> Result<Vec<u8>, ErroNuvem> {
    validar_id_de_pasta(pasta_id)?;
    let da_pasta = dados_do_app
        .join(PASTA_DAS_PASTAS)
        .join(pasta_id)
        .join(PASTA_DE_MIDIA_DA_PASTA);
    let da_mesa = dados_do_app.join(media::PASTA_DE_MIDIA);
    let lida = match media::ler_midia(&da_pasta, &midia.id).await {
        Err(ErroDeMidia::NaoEncontrada) => media::ler_midia(&da_mesa, &midia.id).await,
        outra => outra,
    };
    match lida {
        Ok((bytes, _)) => Ok(bytes),
        Err(ErroDeMidia::NaoEncontrada) => Err(ErroNuvem::novo(
            "midia_ausente",
            "A imagem não está na pasta nem na mídia do app.",
        )),
        Err(ErroDeMidia::GrandeDemais) => Err(midia_invalida("A imagem passa de 2 MiB.")),
        Err(ErroDeMidia::IdInvalido | ErroDeMidia::ConteudoNaoConfere) => Err(midia_invalida(
            "O arquivo da imagem não confere com o nome (hash ou tipo).",
        )),
    }
}

async fn enviar_imagem(
    ponte: &Ponte,
    credencial: &Credencial,
    campanha: CampanhaId,
    midia: IdDeImagem,
    bytes: Vec<u8>,
) -> Result<Value, ErroNuvem> {
    let corpo = Corpo {
        bytes,
        tipo: midia.tipo.mime(),
    };
    let rota = Rota::EnviarMidia { campanha, midia };
    pedir_json(ponte, credencial, &rota, Some(corpo)).await
}

/// Grava a imagem baixada em `pasta` só se os bytes conferem com o id (tipo e
/// hash). Grava num nome temporário e troca, para nunca deixar meia imagem
/// com o nome certo.
async fn gravar_imagem_baixada(
    pasta: &Path,
    midia: &IdDeImagem,
    bytes: &[u8],
) -> Result<(), ErroNuvem> {
    let cabe = u64::try_from(bytes.len()).is_ok_and(|n| n <= media::MIDIA_MAX_BYTES);
    let hash_ok = midia
        .id
        .split_once('.')
        .is_some_and(|(hash, _)| hash == media::hash_hex(bytes));
    if !cabe || !hash_ok || media::tipo_dos_bytes(bytes) != Some(midia.tipo) {
        return Err(midia_invalida(
            "A imagem que veio do Lobby não confere com o nome (hash ou tipo).",
        ));
    }
    tokio::fs::create_dir_all(pasta).await.map_err(erro_disco)?;
    let temporario = pasta.join(format!(
        "{}.baixando-{:016x}",
        midia.id,
        rand::rng().random::<u64>()
    ));
    tokio::fs::write(&temporario, bytes).await.map_err(erro_disco)?;
    if let Err(erro) = tokio::fs::rename(&temporario, pasta.join(&midia.id)).await {
        // Limpeza de melhor esforço: o erro que importa é o da troca.
        let _ = tokio::fs::remove_file(&temporario).await;
        return Err(erro_disco(erro));
    }
    Ok(())
}

async fn baixar_imagem(
    ponte: &Ponte,
    credencial: &Credencial,
    campanha: CampanhaId,
    midia: IdDeImagem,
    pasta_da_mesa: &Path,
) -> Result<(), ErroNuvem> {
    // Já está e confere: nada a baixar.
    if media::ler_midia(pasta_da_mesa, &midia.id).await.is_ok() {
        return Ok(());
    }
    let teto = usize::try_from(media::MIDIA_MAX_BYTES).unwrap_or(usize::MAX);
    let rota = Rota::BaixarMidia { campanha, midia };
    let bytes = enviar(ponte, credencial, &rota, None, teto).await?;
    let Rota::BaixarMidia { midia, .. } = &rota else {
        // A rota foi montada como BaixarMidia duas linhas acima.
        return Err(pedido_invalido("Rota de mídia inesperada."));
    };
    gravar_imagem_baixada(pasta_da_mesa, midia, &bytes).await
}

fn dados_do_app(app: &AppHandle) -> Result<PathBuf, ErroNuvem> {
    app.path()
        .app_data_dir()
        .map_err(|_| ErroNuvem::novo("disco", "Não deu para achar a pasta de dados do app."))
}

// ---------------------------------------------------------------------------
// Comandos
// ---------------------------------------------------------------------------

/// Se há credencial guardada. Nunca devolve a credencial.
#[tauri::command]
pub async fn nuvem_credencial_estado(
    window: WebviewWindow,
    estado: State<'_, NuvemEstado>,
) -> Result<bool, ErroNuvem> {
    exigir_main(&window)?;
    let _trava = estado.trava_cofre.lock().await;
    Ok(ler_credencial().await?.is_some())
}

/// Guarda o Service Token colado na tela "Conta na nuvem" (substitui o de
/// antes).
#[tauri::command]
pub async fn nuvem_credencial_guardar(
    window: WebviewWindow,
    estado: State<'_, NuvemEstado>,
    client_id: String,
    client_secret: String,
) -> Result<(), ErroNuvem> {
    exigir_main(&window)?;
    let credencial = validar_credencial(&client_id, &client_secret)?;
    let texto = serde_json::to_string(&credencial)
        .map_err(|_| erro_cofre("Não deu para preparar a credencial para o cofre."))?;
    let _trava = estado.trava_cofre.lock().await;
    no_cofre(move || cofre::gravar(&texto)).await
}

/// Apaga a credencial do cofre (apagar o que não existe não é erro).
#[tauri::command]
pub async fn nuvem_credencial_apagar(
    window: WebviewWindow,
    estado: State<'_, NuvemEstado>,
) -> Result<(), ErroNuvem> {
    exigir_main(&window)?;
    let _trava = estado.trava_cofre.lock().await;
    no_cofre(cofre::apagar).await
}

/// Um pedido JSON a uma rota da lista. Devolve o JSON da resposta.
#[tauri::command]
pub async fn nuvem_pedir(
    window: WebviewWindow,
    estado: State<'_, NuvemEstado>,
    pedido: PedidoNuvem,
) -> Result<Value, ErroNuvem> {
    exigir_main(&window)?;
    let (rota, corpo) = pedido.validar()?;
    let corpo = corpo.as_ref().map(corpo_json).transpose()?;
    let credencial = estado.credencial().await?;
    let ponte = estado.ponte().await?;
    pedir_json(ponte, &credencial, &rota, corpo).await
}

/// Sobe a imagem `midiaId` da pasta `pastaId` para a campanha.
#[tauri::command]
pub async fn nuvem_enviar_midia(
    app: AppHandle,
    window: WebviewWindow,
    estado: State<'_, NuvemEstado>,
    campanha_id: String,
    pasta_id: String,
    midia_id: String,
) -> Result<Value, ErroNuvem> {
    exigir_main(&window)?;
    let campanha = CampanhaId::validar(&campanha_id)?;
    let midia = IdDeImagem::validar(&midia_id)?;
    let bytes = ler_imagem_para_enviar(&dados_do_app(&app)?, &pasta_id, &midia).await?;
    let credencial = estado.credencial().await?;
    let ponte = estado.ponte().await?;
    enviar_imagem(ponte, &credencial, campanha, midia, bytes).await
}

/// Baixa a imagem `midiaId` da campanha para `<appData>/midia` (se ainda não
/// estiver lá).
#[tauri::command]
pub async fn nuvem_baixar_midia(
    app: AppHandle,
    window: WebviewWindow,
    estado: State<'_, NuvemEstado>,
    campanha_id: String,
    midia_id: String,
) -> Result<(), ErroNuvem> {
    exigir_main(&window)?;
    let campanha = CampanhaId::validar(&campanha_id)?;
    let midia = IdDeImagem::validar(&midia_id)?;
    let pasta_da_mesa = dados_do_app(&app)?.join(media::PASTA_DE_MIDIA);
    let credencial = estado.credencial().await?;
    let ponte = estado.ponte().await?;
    baixar_imagem(ponte, &credencial, campanha, midia, &pasta_da_mesa).await
}

// ---------------------------------------------------------------------------
// Testes (sem rede real: servidor HTTP falso em 127.0.0.1, sem o cofre)
// ---------------------------------------------------------------------------

#[cfg(test)]
mod testes {
    use super::*;
    use serde_json::json;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    type Resultado = Result<(), Box<dyn std::error::Error>>;

    /// Credencial inventada, na forma do Cloudflare (32 + `.access`, 64).
    const CLIENT_ID: &str = "0123456789abcdef0123456789abcdef.access";
    const CLIENT_SECRET: &str = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";
    const PNG_MINIMO: &[u8] = b"\x89PNG\r\n\x1a\n\x00\x00\x00\x0dIHDR";

    fn credencial() -> Credencial {
        Credencial {
            client_id: CLIENT_ID.to_owned(),
            client_secret: CLIENT_SECRET.to_owned(),
        }
    }

    fn ponte_local(base: String, tempo: Duration) -> Result<Ponte, ErroNuvem> {
        Ponte::nova(base, tempo, false)
    }

    fn pedido(valor: Value) -> Result<(Rota, Option<Value>), Box<dyn std::error::Error>> {
        let pedido: PedidoNuvem = serde_json::from_value(valor)?;
        pedido.validar().map_err(|e| e.mensagem.into())
    }

    fn codigo_do_pedido(valor: Value) -> Result<&'static str, Box<dyn std::error::Error>> {
        let pedido: PedidoNuvem = serde_json::from_value(valor)?;
        match pedido.validar() {
            Ok(_) => Err("o pedido devia ser recusado".into()),
            Err(erro) => Ok(erro.codigo),
        }
    }

    struct Recebido {
        linha: String,
        cabecalhos: Vec<(String, String)>,
        corpo: Vec<u8>,
    }

    impl Recebido {
        fn cabecalho(&self, nome: &str) -> Option<&str> {
            self.cabecalhos
                .iter()
                .find(|(n, _)| n == nome)
                .map(|(_, v)| v.as_str())
        }
    }

    /// Servidor HTTP/1.1 de UM pedido em 127.0.0.1: guarda o que chegou e
    /// responde `resposta` crua.
    async fn servidor_falso(
        resposta: Vec<u8>,
    ) -> Result<(String, tokio::task::JoinHandle<std::io::Result<Recebido>>), std::io::Error> {
        let ouvinte = TcpListener::bind("127.0.0.1:0").await?;
        let base = format!("http://{}", ouvinte.local_addr()?);
        let tarefa = tokio::spawn(async move {
            let (mut conexao, _) = ouvinte.accept().await?;
            let mut lido = Vec::new();
            let mut buffer = [0u8; 4096];
            let fim_da_cabeca = loop {
                let n = conexao.read(&mut buffer).await?;
                if n == 0 {
                    return Err(std::io::Error::new(
                        std::io::ErrorKind::UnexpectedEof,
                        "pedido sem cabeçalho completo",
                    ));
                }
                lido.extend_from_slice(&buffer[..n]);
                if let Some(pos) = lido.windows(4).position(|j| j == b"\r\n\r\n") {
                    break pos;
                }
            };
            let cabeca = String::from_utf8_lossy(&lido[..fim_da_cabeca]).into_owned();
            let mut linhas = cabeca.split("\r\n");
            let linha = linhas.next().unwrap_or_default().to_owned();
            let cabecalhos: Vec<(String, String)> = linhas
                .filter_map(|l| l.split_once(':'))
                .map(|(n, v)| (n.trim().to_ascii_lowercase(), v.trim().to_owned()))
                .collect();
            let tamanho: usize = cabecalhos
                .iter()
                .find(|(n, _)| n == "content-length")
                .and_then(|(_, v)| v.parse().ok())
                .unwrap_or(0);
            let mut corpo = lido[fim_da_cabeca + 4..].to_vec();
            while corpo.len() < tamanho {
                let n = conexao.read(&mut buffer).await?;
                if n == 0 {
                    break;
                }
                corpo.extend_from_slice(&buffer[..n]);
            }
            conexao.write_all(&resposta).await?;
            // O cliente pode fechar primeiro (resposta recusada no cabeçalho).
            let _ = conexao.shutdown().await;
            Ok(Recebido {
                linha,
                cabecalhos,
                corpo,
            })
        });
        Ok((base, tarefa))
    }

    /// `extras`: linhas de cabeçalho já terminadas em `\r\n`.
    fn resposta_http(status: &str, extras: &str, corpo: &str) -> Vec<u8> {
        format!(
            "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n{extras}\r\n{corpo}",
            corpo.len()
        )
        .into_bytes()
    }

    /// Pasta só deste teste (os testes rodam em paralelo), limpa no começo.
    fn pasta_de_teste(nome: &str) -> Result<PathBuf, std::io::Error> {
        let pasta = std::env::temp_dir().join(format!(
            "labirinto-nuvem-{nome}-{}",
            std::process::id()
        ));
        if pasta.exists() {
            std::fs::remove_dir_all(&pasta)?;
        }
        std::fs::create_dir_all(&pasta)?;
        Ok(pasta)
    }

    fn id_de(bytes: &[u8], extensao: &str) -> String {
        format!("{}.{extensao}", media::hash_hex(bytes))
    }

    // --- credencial ---------------------------------------------------------

    #[test]
    fn credencial_colada_com_espacos_e_aparada() -> Resultado {
        let guardada = validar_credencial(
            &format!("  {CLIENT_ID}\n"),
            &format!("\t{CLIENT_SECRET}  "),
        )
        .map_err(|e| e.mensagem)?;
        assert_eq!(guardada.client_id, CLIENT_ID);
        assert_eq!(guardada.client_secret, CLIENT_SECRET);
        Ok(())
    }

    #[test]
    fn credencial_fora_da_forma_e_recusada_sem_ecoar_o_valor() {
        let casos = [
            (CLIENT_SECRET, CLIENT_ID),                 // trocados
            ("", CLIENT_SECRET),                        // vazio
            ("0123456789abcdef0123456789abcdef", CLIENT_SECRET), // sem .access
            (CLIENT_ID, "fedcba98 76543210fedcba9876543210fedcba9876543210"), // espaço no meio
            (CLIENT_ID, "curto"),
            ("0123456789abcdéf0123456789abcdef.access", CLIENT_SECRET), // não ASCII
        ];
        for (id, segredo) in casos {
            match validar_credencial(id, segredo) {
                Ok(_) => panic!("devia recusar o caso com id de {} bytes", id.len()),
                Err(erro) => {
                    assert_eq!(erro.codigo, "credencial_invalida");
                    assert!(!erro.mensagem.contains("0123456789abcdef"));
                    assert!(!erro.mensagem.contains("fedcba98"));
                }
            }
        }
    }

    // --- rotas --------------------------------------------------------------

    #[test]
    fn pedidos_viram_rotas_fixas() -> Resultado {
        let (eu, corpo) = pedido(json!({ "rota": "eu" }))?;
        assert_eq!((eu.metodo(), eu.caminho().as_str()), (Metodo::Get, "/api/eu"));
        assert!(corpo.is_none());

        let (desde, _) = pedido(json!({ "rota": "desde", "campanhaId": "camp_1", "rev": 42 }))?;
        assert_eq!(desde.caminho(), "/api/c/camp_1/desde/42?limite=500");

        let (exportar, _) =
            pedido(json!({ "rota": "exportar", "campanhaId": "camp_1", "deRev": 3 }))?;
        assert_eq!(exportar.caminho(), "/api/c/camp_1/exportar?deRev=3");

        // O que o TS manda (limite sempre 500) e o padrão sem limite.
        let (sala, corpo) = pedido(
            json!({ "rota": "salaDoChat", "campanhaId": "camp_1", "desde": 77, "limite": 500 }),
        )?;
        assert_eq!(
            (sala.metodo(), sala.caminho().as_str()),
            (Metodo::Get, "/api/c/camp_1/chat/sala?desde=77&limite=500")
        );
        assert!(corpo.is_none());
        let (sala, _) = pedido(json!({ "rota": "salaDoChat", "campanhaId": "camp_1", "desde": 0 }))?;
        assert_eq!(sala.caminho(), "/api/c/camp_1/chat/sala?desde=0&limite=500");

        let (ops, corpo) = pedido(
            json!({ "rota": "ops", "campanhaId": "pasta_a-1", "corpo": { "lote": [] } }),
        )?;
        assert_eq!((ops.metodo(), ops.caminho().as_str()), (Metodo::Post, "/api/c/pasta_a-1/ops"));
        assert_eq!(corpo, Some(json!({ "lote": [] })));

        // B3: abrir leva o corpo da webview como veio; fechar leva o `{}` fixo.
        let sala = json!({
            "codigo": "ABC123",
            "enderecos": [{ "tipo": "lan", "url": "http://192.168.0.10:7777/player" }],
        });
        let (abrir, corpo) =
            pedido(json!({ "rota": "abrirSala", "campanhaId": "camp_1", "corpo": &sala }))?;
        assert_eq!(
            (abrir.metodo(), abrir.caminho().as_str()),
            (Metodo::Post, "/api/c/camp_1/sala")
        );
        assert_eq!(corpo, Some(sala));
        let (fechar, corpo) = pedido(json!({ "rota": "fecharSala", "campanhaId": "camp_1" }))?;
        assert_eq!(
            (fechar.metodo(), fechar.caminho().as_str()),
            (Metodo::Post, "/api/c/camp_1/sala/fechar")
        );
        assert_eq!(corpo, Some(json!({})));

        let midia = Rota::EnviarMidia {
            campanha: CampanhaId::validar("camp_1").map_err(|e| e.mensagem)?,
            midia: IdDeImagem::validar(&id_de(PNG_MINIMO, "png")).map_err(|e| e.mensagem)?,
        };
        assert_eq!(midia.metodo(), Metodo::Put);
        assert_eq!(
            midia.caminho(),
            format!("/api/c/camp_1/midia/{}", id_de(PNG_MINIMO, "png"))
        );
        Ok(())
    }

    #[test]
    fn pedido_fora_da_lista_ou_com_id_perigoso_e_recusado() -> Resultado {
        let longo = "x".repeat(ID_DE_CAMPANHA_MAX + 1);
        for perigoso in ["../x", "a/b", "", "a?b", "a%2Fb", "a.b", longo.as_str()] {
            let codigo =
                codigo_do_pedido(json!({ "rota": "membros", "campanhaId": perigoso, "corpo": {} }))?;
            assert_eq!(codigo, "pedido_invalido", "id {perigoso:?}");
        }
        for limite in [0, 501] {
            let codigo = codigo_do_pedido(
                json!({ "rota": "desde", "campanhaId": "c", "rev": 0, "limite": limite }),
            )?;
            assert_eq!(codigo, "pedido_invalido");
        }
        let codigo = codigo_do_pedido(
            json!({ "rota": "exportar", "campanhaId": "c", "deRev": 9, "ateRev": 3 }),
        )?;
        assert_eq!(codigo, "pedido_invalido");
        for limite in [0, 501] {
            let codigo = codigo_do_pedido(
                json!({ "rota": "salaDoChat", "campanhaId": "c", "desde": 0, "limite": limite }),
            )?;
            assert_eq!(codigo, "pedido_invalido", "salaDoChat limite {limite}");
        }
        // Na sala também: id que escaparia do caminho, campo a mais e cursor
        // negativo nem chegam à URL.
        let codigo = codigo_do_pedido(
            json!({ "rota": "salaDoChat", "campanhaId": "../x", "desde": 0 }),
        )?;
        assert_eq!(codigo, "pedido_invalido");
        assert!(serde_json::from_value::<PedidoNuvem>(json!({ "rota": "salaDoChat", "campanhaId": "c", "desde": 0, "privado": true })).is_err());
        assert!(serde_json::from_value::<PedidoNuvem>(json!({ "rota": "salaDoChat", "campanhaId": "c", "desde": -1 })).is_err());
        // B3: id perigoso na sala nem chega à URL; fechar não aceita corpo da
        // webview, e abrir sem corpo nem desserializa.
        for rota in ["abrirSala", "fecharSala"] {
            let mut valor = json!({ "rota": rota, "campanhaId": "../x" });
            if rota == "abrirSala" {
                valor["corpo"] = json!({});
            }
            assert_eq!(codigo_do_pedido(valor)?, "pedido_invalido", "{rota}");
        }
        assert!(serde_json::from_value::<PedidoNuvem>(json!({ "rota": "fecharSala", "campanhaId": "c", "corpo": {} })).is_err());
        assert!(serde_json::from_value::<PedidoNuvem>(json!({ "rota": "abrirSala", "campanhaId": "c" })).is_err());
        // A webview não escolhe URL: campo a mais e rota fora da lista nem
        // desserializam.
        assert!(serde_json::from_value::<PedidoNuvem>(json!({ "rota": "eu", "url": "https://x" })).is_err());
        assert!(serde_json::from_value::<PedidoNuvem>(json!({ "rota": "admin" })).is_err());
        assert!(serde_json::from_value::<PedidoNuvem>(json!({ "rota": "desde", "campanhaId": "c", "rev": -1 })).is_err());
        Ok(())
    }

    // --- HTTP ---------------------------------------------------------------

    #[tokio::test]
    async fn eu_leva_a_credencial_nos_cabecalhos_e_devolve_o_json() -> Resultado {
        let corpo = r#"{"email":"mestre@example.com","campanhas":[]}"#;
        let (base, servidor) =
            servidor_falso(resposta_http("200 OK", "Content-Type: application/json\r\n", corpo))
                .await?;
        let ponte = ponte_local(base, Duration::from_secs(5)).map_err(|e| e.mensagem)?;
        let (rota, _) = pedido(json!({ "rota": "eu" }))?;
        let resposta = pedir_json(&ponte, &credencial(), &rota, None)
            .await
            .map_err(|e| e.mensagem)?;
        assert_eq!(resposta, json!({ "email": "mestre@example.com", "campanhas": [] }));

        let recebido = servidor.await??;
        assert_eq!(recebido.linha, "GET /api/eu HTTP/1.1");
        assert_eq!(recebido.cabecalho(CABECALHO_CLIENT_ID), Some(CLIENT_ID));
        assert_eq!(recebido.cabecalho(CABECALHO_CLIENT_SECRET), Some(CLIENT_SECRET));
        // O portão confere Origin; o app não manda Origin de navegador.
        assert_eq!(recebido.cabecalho("origin"), None);
        Ok(())
    }

    #[tokio::test]
    async fn redirecionamento_do_access_vira_acesso_negado_sem_seguir() -> Resultado {
        // Se a ponte seguisse o Location, cairia na porta 1 e o erro seria `rede`.
        let corpo = format!("login para {CLIENT_SECRET}");
        let (base, servidor) = servidor_falso(resposta_http(
            "302 Found",
            "Location: http://127.0.0.1:1/cdn-cgi/access/login\r\n",
            &corpo,
        ))
        .await?;
        let ponte = ponte_local(base, Duration::from_secs(5)).map_err(|e| e.mensagem)?;
        let (rota, corpo) = pedido(json!({ "rota": "ops", "campanhaId": "c1", "corpo": { "lote": [1] } }))?;
        let corpo = corpo.as_ref().map(corpo_json).transpose().map_err(|e| e.mensagem)?;
        let Err(erro) = pedir_json(&ponte, &credencial(), &rota, corpo).await else {
            return Err("o 302 devia virar erro".into());
        };
        assert_eq!(erro.codigo, "acesso_negado");
        assert_eq!(erro.status, Some(302));
        let detalhe = erro.detalhe.unwrap_or_default();
        assert!(detalhe.contains(MASCARA));
        assert!(!detalhe.contains(CLIENT_SECRET));

        let recebido = servidor.await??;
        assert_eq!(recebido.linha, "POST /api/c/c1/ops HTTP/1.1");
        assert_eq!(recebido.cabecalho("content-type"), Some(TIPO_JSON));
        assert_eq!(recebido.corpo, br#"{"lote":[1]}"#);
        Ok(())
    }

    #[tokio::test]
    async fn abrir_e_fechar_a_sala_vao_nas_rotas_certas_e_a_chave_volta_inteira() -> Resultado {
        // Chave inventada: 32 bytes em base64url (43 caracteres).
        let chave = "q8Kx0Zr2bN5vW1sT7yUe3iO9pA4dF6gH8jL0zXcVbMn";
        let resposta =
            format!(r#"{{"chave":"{chave}","agora":1762430000000,"expiraEm":1762430600000}}"#);
        let (base, servidor) =
            servidor_falso(resposta_http("200 OK", "Content-Type: application/json\r\n", &resposta))
                .await?;
        let ponte = ponte_local(base, Duration::from_secs(5)).map_err(|e| e.mensagem)?;
        let sala = json!({
            "codigo": "ABC123",
            "enderecos": [{ "tipo": "tunel", "url": "https://a-b.trycloudflare.com/player" }],
        });
        let (rota, corpo) =
            pedido(json!({ "rota": "abrirSala", "campanhaId": "c1", "corpo": &sala }))?;
        let corpo = corpo.as_ref().map(corpo_json).transpose().map_err(|e| e.mensagem)?;
        let aberta = pedir_json(&ponte, &credencial(), &rota, corpo)
            .await
            .map_err(|e| e.mensagem)?;
        assert_eq!(
            aberta,
            json!({ "chave": chave, "agora": 1_762_430_000_000_u64, "expiraEm": 1_762_430_600_000_u64 })
        );
        let recebido = servidor.await??;
        assert_eq!(recebido.linha, "POST /api/c/c1/sala HTTP/1.1");
        assert_eq!(recebido.cabecalho("content-type"), Some(TIPO_JSON));
        assert_eq!(serde_json::from_slice::<Value>(&recebido.corpo)?, sala);

        // Fechar: o `{}` fixo, e a resposta vazia vira `null`.
        let (base, servidor) = servidor_falso(resposta_http("200 OK", "", "")).await?;
        let ponte = ponte_local(base, Duration::from_secs(5)).map_err(|e| e.mensagem)?;
        let (rota, corpo) = pedido(json!({ "rota": "fecharSala", "campanhaId": "c1" }))?;
        let corpo = corpo.as_ref().map(corpo_json).transpose().map_err(|e| e.mensagem)?;
        let fechada = pedir_json(&ponte, &credencial(), &rota, corpo)
            .await
            .map_err(|e| e.mensagem)?;
        assert_eq!(fechada, Value::Null);
        let recebido = servidor.await??;
        assert_eq!(recebido.linha, "POST /api/c/c1/sala/fechar HTTP/1.1");
        assert_eq!(recebido.cabecalho("content-length"), Some("2"));
        assert_eq!(recebido.corpo, b"{}");
        Ok(())
    }

    #[tokio::test]
    async fn servidor_mudo_estoura_o_tempo() -> Resultado {
        let ouvinte = TcpListener::bind("127.0.0.1:0").await?;
        let base = format!("http://{}", ouvinte.local_addr()?);
        let mudo = tokio::spawn(async move {
            if let Ok((conexao, _)) = ouvinte.accept().await {
                tokio::time::sleep(Duration::from_secs(5)).await;
                drop(conexao);
            }
        });
        let ponte = ponte_local(base, Duration::from_millis(300)).map_err(|e| e.mensagem)?;
        let Err(erro) = pedir_json(&ponte, &credencial(), &Rota::Eu, None).await else {
            return Err("o servidor mudo devia estourar o tempo".into());
        };
        mudo.abort();
        assert_eq!(erro.codigo, "rede");
        assert!(erro.mensagem.contains("demorou"), "{}", erro.mensagem);
        Ok(())
    }

    #[tokio::test]
    async fn resposta_maior_que_o_teto_e_recusada_antes_de_ler() -> Resultado {
        let cabeca = format!(
            "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{{",
            RESPOSTA_MAX_BYTES + 1
        );
        let (base, servidor) = servidor_falso(cabeca.into_bytes()).await?;
        let ponte = ponte_local(base, Duration::from_secs(5)).map_err(|e| e.mensagem)?;
        let Err(erro) = pedir_json(&ponte, &credencial(), &Rota::Eu, None).await else {
            return Err("a resposta grande devia ser recusada".into());
        };
        assert_eq!(erro.codigo, "resposta_invalida");
        servidor.await??;
        Ok(())
    }

    #[test]
    fn status_e_corpo_viram_o_erro_certo() -> Resultado {
        let cred = credencial();
        for (status, codigo) in [
            (401, "acesso_negado"),
            (403, "acesso_negado"),
            (404, "nao_encontrado"),
            (429, "ritmo"),
            (503, "servidor"),
            (418, "http"),
        ] {
            let erro = erro_http(status, CLIENT_ID.as_bytes(), &cred);
            assert_eq!(erro.codigo, codigo);
            assert_eq!(erro.status, Some(status));
            assert_eq!(erro.detalhe.as_deref(), Some(MASCARA));
        }
        assert_eq!(erro_http(500, b"", &cred).detalhe, None);
        assert_eq!(json_da_resposta(b"").map_err(|e| e.mensagem)?, Value::Null);
        assert_eq!(json_da_resposta(b" \n").map_err(|e| e.mensagem)?, Value::Null);
        assert_eq!(
            json_da_resposta(b"<html>login</html>").map_err(|e| e.codigo).err(),
            Some("resposta_invalida")
        );
        Ok(())
    }

    // --- mídia --------------------------------------------------------------

    #[tokio::test]
    async fn imagem_sobe_da_pasta_ou_da_midia_do_app_com_o_tipo_certo() -> Resultado {
        let raiz = pasta_de_teste("enviar")?;
        let na_pasta = PNG_MINIMO.to_vec();
        let so_na_mesa = [PNG_MINIMO, b"mesa".as_slice()].concat();
        let pasta_da_pasta = raiz.join("pastas").join("pasta_abc-1").join("midia");
        std::fs::create_dir_all(&pasta_da_pasta)?;
        std::fs::create_dir_all(raiz.join("midia"))?;
        std::fs::write(pasta_da_pasta.join(id_de(&na_pasta, "png")), &na_pasta)?;
        std::fs::write(raiz.join("midia").join(id_de(&so_na_mesa, "png")), &so_na_mesa)?;

        let id_da_mesa = IdDeImagem::validar(&id_de(&so_na_mesa, "png")).map_err(|e| e.mensagem)?;
        let lida = ler_imagem_para_enviar(&raiz, "pasta_abc-1", &id_da_mesa)
            .await
            .map_err(|e| e.mensagem)?;
        assert_eq!(lida, so_na_mesa);

        let id_da_pasta = IdDeImagem::validar(&id_de(&na_pasta, "png")).map_err(|e| e.mensagem)?;
        let bytes = ler_imagem_para_enviar(&raiz, "pasta_abc-1", &id_da_pasta)
            .await
            .map_err(|e| e.mensagem)?;
        assert_eq!(bytes, na_pasta);

        let (base, servidor) = servidor_falso(resposta_http("200 OK", "", r#"{"ok":true}"#)).await?;
        let ponte = ponte_local(base, Duration::from_secs(5)).map_err(|e| e.mensagem)?;
        let campanha = CampanhaId::validar("camp_1").map_err(|e| e.mensagem)?;
        let resposta = enviar_imagem(&ponte, &credencial(), campanha, id_da_pasta, bytes)
            .await
            .map_err(|e| e.mensagem)?;
        assert_eq!(resposta, json!({ "ok": true }));
        let recebido = servidor.await??;
        assert_eq!(
            recebido.linha,
            format!("PUT /api/c/camp_1/midia/{} HTTP/1.1", id_de(&na_pasta, "png"))
        );
        assert_eq!(recebido.cabecalho("content-type"), Some("image/png"));
        assert_eq!(recebido.corpo, na_pasta);
        std::fs::remove_dir_all(&raiz)?;
        Ok(())
    }

    #[tokio::test]
    async fn envio_recusa_audio_pasta_perigosa_arquivo_adulterado_e_ausente() -> Resultado {
        let raiz = pasta_de_teste("recusas")?;
        let audio = format!("{}.mp3", "a".repeat(64));
        assert_eq!(IdDeImagem::validar(&audio).err().map(|e| e.codigo), Some("pedido_invalido"));
        assert_eq!(IdDeImagem::validar("../x.png").err().map(|e| e.codigo), Some("pedido_invalido"));

        let id = IdDeImagem::validar(&id_de(PNG_MINIMO, "png")).map_err(|e| e.mensagem)?;
        for pasta in ["../pasta_x", "pasta_", "pasta_a/b", "outra_1"] {
            let erro = ler_imagem_para_enviar(&raiz, pasta, &id).await.err().map(|e| e.codigo);
            assert_eq!(erro, Some("pedido_invalido"), "pasta {pasta:?}");
        }
        let erro = ler_imagem_para_enviar(&raiz, "pasta_1", &id).await.err().map(|e| e.codigo);
        assert_eq!(erro, Some("midia_ausente"));

        // Bytes que não têm o hash do nome.
        std::fs::create_dir_all(raiz.join("midia"))?;
        std::fs::write(raiz.join("midia").join(&id.id), [PNG_MINIMO, b"x".as_slice()].concat())?;
        let erro = ler_imagem_para_enviar(&raiz, "pasta_1", &id).await.err().map(|e| e.codigo);
        assert_eq!(erro, Some("midia_invalida"));
        std::fs::remove_dir_all(&raiz)?;
        Ok(())
    }

    #[tokio::test]
    async fn imagem_baixada_so_fica_no_disco_se_confere() -> Resultado {
        let raiz = pasta_de_teste("baixar")?;
        let pasta = raiz.join("midia");
        let id = IdDeImagem::validar(&id_de(PNG_MINIMO, "png")).map_err(|e| e.mensagem)?;

        let adulterada = [PNG_MINIMO, b"x".as_slice()].concat();
        let erro = gravar_imagem_baixada(&pasta, &id, &adulterada).await.err().map(|e| e.codigo);
        assert_eq!(erro, Some("midia_invalida"));
        assert!(!pasta.join(&id.id).exists());

        gravar_imagem_baixada(&pasta, &id, PNG_MINIMO)
            .await
            .map_err(|e| e.mensagem)?;
        let (bytes, tipo) = media::ler_midia(&pasta, &id.id)
            .await
            .map_err(|e| format!("{e:?}"))?;
        assert_eq!((bytes.as_slice(), tipo), (PNG_MINIMO, TipoDeMidia::Png));
        // Só a imagem: nenhum temporário sobrou.
        assert_eq!(std::fs::read_dir(&pasta)?.count(), 1);
        std::fs::remove_dir_all(&raiz)?;
        Ok(())
    }
}
