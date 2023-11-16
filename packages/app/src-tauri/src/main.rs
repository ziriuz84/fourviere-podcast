// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod utils;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::network::fetch_feed,
            commands::fs::read_text_file,
            commands::s3::s3_upload,
            commands::ftp::ftp_upload,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
