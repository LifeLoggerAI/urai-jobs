{
  "inputs.nixpkgs.url": "github:NixOS/nixpkgs/nixos-23.11",
  "inputs.flake-utils.url": "github:numtide/flake-utils",
  "outputs": "{ self, nixpkgs, flake-utils }: flake-utils.lib.eachDefaultSystem (system: {
    devShells.default = nixpkgs.legacyPackages.${system}.mkShellNoCC {
      packages = [
        nixpkgs.legacyPackages.${system}.nodejs_20
        nixpkgs.legacyPackages.${system}.nodePackages.pnpm
        nixpkgs.legacyPackages.${system}.gnupg
      ];
      shellHook = ''
        echo "Node.js $(node --version)"
        echo "pnpm $(pnpm --version)"
      '';
    };
  })"
}