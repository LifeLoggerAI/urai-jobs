{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  name = "urai-jobs-dev";

  buildInputs = with pkgs; [
    nodejs_20
    git
    firebase-tools
  ];

  shellHook = ''
    echo "URAI-JOBS dev shell"
    node --version
    firebase --version || true
  '';
}
