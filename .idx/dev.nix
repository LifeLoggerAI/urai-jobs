{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = [
    pkgs.nodejs_20
    pkgs.pnpm
  ];

  shellHook = '''
    echo "URAI-JOBS dev shell loaded"
    node -v
    pnpm -v
  ''';
}
