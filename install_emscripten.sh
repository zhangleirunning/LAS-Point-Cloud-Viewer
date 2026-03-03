#!/bin/bash
# Script to install Emscripten SDK

set -e

echo "╔══════════════════════════════════════════════════════════════════════════╗"
echo "║              Installing Emscripten SDK                                   ║"
echo "╚══════════════════════════════════════════════════════════════════════════╝"
echo ""

# Check if emsdk already exists
if [ -d "$HOME/emsdk" ]; then
    echo "⚠️  Emscripten SDK directory already exists at ~/emsdk"
    read -p "Do you want to reinstall? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping installation. To use existing installation, run:"
        echo "  source ~/emsdk/emsdk_env.sh"
        exit 0
    fi
    echo "Removing existing installation..."
    rm -rf "$HOME/emsdk"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1/5: Cloning Emscripten SDK..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cd "$HOME"
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2/5: Installing latest Emscripten..."
echo "⏱️  This may take 5-10 minutes (downloads ~500MB)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
./emsdk install latest

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3/5: Activating Emscripten..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
./emsdk activate latest

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 4/5: Setting up environment..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
source ./emsdk_env.sh

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 5/5: Verifying installation..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
emcc --version

echo ""
echo "╔══════════════════════════════════════════════════════════════════════════╗"
echo "║                    ✅ Installation Complete!                             ║"
echo "╚══════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "📝 IMPORTANT: To use Emscripten in this terminal session, run:"
echo ""
echo "    source ~/emsdk/emsdk_env.sh"
echo ""
echo "💡 To make this permanent, add to your shell profile:"
echo ""

# Detect shell
if [ -n "$ZSH_VERSION" ]; then
    SHELL_RC="~/.zshrc"
elif [ -n "$BASH_VERSION" ]; then
    SHELL_RC="~/.bashrc"
else
    SHELL_RC="~/.profile"
fi

echo "    echo 'source ~/emsdk/emsdk_env.sh' >> $SHELL_RC"
echo "    source $SHELL_RC"
echo ""
echo "🚀 Now you can build the project:"
echo ""
echo "    cd $(pwd | sed "s|$HOME/emsdk|~/Workspace/Esri3D|")"
echo "    ./build_wasm.sh"
echo ""
