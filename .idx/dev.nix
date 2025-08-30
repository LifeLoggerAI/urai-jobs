# To learn more about how to use Nix to configure your environment
# see: https://developers.google.com/idx/guides/customize-idx-env
{ pkgs, ... }: {
  # Which nixpkgs channel to use.
  channel = "stable-24.05"; # or "unstable"

  # Use https://search.nixos.org/packages to find packages
  packages = [
    pkgs.nodejs_22  # Using Node.js 22 as specified in urai-jobs-codebase/package.json
    pkgs.nodePackages.genkit
    pkgs.firebase-tools # Added for Firebase CLI commands
  ];

  # Sets environment variables in the workspace
  env = {
    # Replace with your Google Cloud project ID
    GCLOUD_PROJECT = "your-gcloud-project-id";
    # Replace with your actual API key or secret name in IDX
    API_KEY = "your-api-key-secret";
  };

  # Configures IDX features and settings.
  idx = {
    # A list of extensions to install from the Open VSX Registry.
    # See https://open-vsx.org/ for more extensions.
    extensions = [
      "genkit.genkit-tools",
      "firebase.firebase-vscode-extension",
      "dbaeumer.vscode-eslint"
    ];

    # Workspace lifecycle hooks
    workspace = {
      # Runs when a workspace is first created
      onCreate = {
        npm-install = "npm install --prefix urai-jobs-codebase";
      };
      # Runs every time the workspace is (re)started
      onStart = {
        # Starts the Genkit developer UI.
        # The --port flag is set dynamically by IDX.
        genkit-start = "genkit start --port $PORT --prefix urai-jobs-codebase";
      };
    };
    
    # Enable a web preview for your application.
    previews = {
      enable = true;
      previews = {
        # The Genkit developer UI
        genkit-ui = {
          command = ["genkit" "start" "--port" "$PORT" "--prefix" "urai-jobs-codebase"];
          manager = "web";
        };
      };
    };
  };
}
