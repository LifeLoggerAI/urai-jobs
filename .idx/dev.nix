{ pkgs, ... }:
{
  # Learn more about dev environments in Nix: https://nix.dev/tutorials/first-nix-build
  packages = [
    pkgs.nodejs_20
    pkgs.firebase-tools
    pkgs.jdk # Using the full JDK is more robust for providing Java
  ];
}
