{ pkgs, ... }: {
  packages = [
    pkgs.nodejs
    pkgs.jdk21
    pkgs.firebase-tools
  ];
}
