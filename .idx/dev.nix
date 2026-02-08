{ pkgs, ... }:
      
      {
        channel = "stable-24.05";
      
        packages = [
          pkgs.psmisc,
          pkgs.nodejs_22,
          pkgs.firebase-tools,
          pkgs.git
        ];
     
        # Firebase Studio / IDX metadata
        idx = {
          extensions = [
            "dbaeumer.vscode-eslint",
            "esbenp.prettier-vscode",
            "ms-vscode.typescript-next",
            "firebase.firebase-vscode"
          ];
     
          workspace = {
            onCreate = {
              install = ''
                echo "Installing dependencies..."
                pnpm install --frozen-lockfile
              '';
            };
            
            # Restart the environment by adding a comment here
            onStart = {
              dev = "pnpm dev";
            };
          };
        };
      }
      