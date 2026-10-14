# Maria Private Stock - Desktop App

Tauri desktop application for Maria Private Stock, built from the web app.

## Structure
- `src/` - React/Vite frontend (same as web app)
- `src-tauri/` - Tauri/Rust backend
- `dist/` - Built frontend assets (generated)

## Development

```bash
# Install dependencies
npm install

# Start dev server (frontend only)
npm run dev

# Start Tauri dev mode (frontend + Rust backend)
npm run tauri:dev
```

## Building

```bash
# Build frontend only
npm run build

# Build Tauri desktop app (requires Rust)
npm run tauri:build
```

## GitHub Actions

Automated builds for Windows, macOS, and Linux on tag push:
- Push a tag like `v1.0.0` to trigger builds
- Download installers from GitHub Releases

### Installers produced:
- **Windows**: `.msi` installer
- **macOS**: `.dmg` (Intel + Apple Silicon)
- **Linux**: `.AppImage`, `.deb`, `.rpm`

## Local Rust Setup (for local builds)

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# or on Windows: https://rustup.rs/

# Restart terminal, then:
rustup target add x86_64-pc-windows-msvc  # Windows
rustup target add x86_64-apple-darwin aarch64-apple-darwin  # macOS
rustup target add x86_64-unknown-linux-gnu  # Linux
```

## Note
This is a separate desktop app folder parallel to the main web project. The web project at `../maria-projects/maria-private/app/` remains unchanged for web/Capacitor/Android deployment.