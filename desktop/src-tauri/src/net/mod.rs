//! Transporte de rede local da sala (E1).
//!
//! `server` não depende de Tauri: recebe um `NetSink` (para onde vão os eventos)
//! e um `AssetSource` (de onde vem a página do jogador), o que permite testar o
//! servidor inteiro em `tests/net_server.rs` sem abrir janela. `commands` faz a
//! costura com o `AppHandle` e expõe os comandos IPC.

pub mod commands;
pub mod server;
pub mod tunnel;
