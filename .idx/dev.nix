{ pkgs, ... }:

{
  channel = "stable-24.05";

  packages = [
    pkgs.nodejs_20
    pkgs.firebase-tools
    pkgs.git
  ];

  # Firebase Studio / IDX metadata
  idx = {
    extensions = [
      "dbaeumer.vscode-eslint"
      "esbenp.prettier-vscode"
      "ms-vscode.typescript-next"
      "firebase.firebase-vscode"
    ];

    workspace = {
      onCreate = {
        install = ''
          echo "Installing dependencies..."
          npm install || true
        '';
      };

      onStart = {
        welcome = ''
          echo "URAI-JOBS Firebase Studio environment ready"
          echo "Run: firebase use urai-4dc1d"
        '';
      };
    };

    previews = {
      enable = true;
      previews = {
        web = {
          command = [ "npm" "run" "dev" "--prefix" "web" ];
          manager = "web";
          env = {
            PORT = "3000";
          };
        };
      };
    };
  };
}
