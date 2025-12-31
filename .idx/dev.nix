{ pkgs, ... }: {
  # Nix channel, determines available package versions.
  channel = "stable-24.05";

  # List of packages to install.
  packages = [
    pkgs.nodejs_20  # For functions and frontend.
    pkgs.firebase-tools # For emulators and deployment.
    pkgs.nodePackages.pnpm # For package management.
  ];

  # VS Code extensions to install.
  idx.extensions = [
    "dbaeumer.vscode-eslint" # For linting.
    "esbenp.prettier-vscode" # For code formatting.
  ];

  # Workspace lifecycle hooks.
  idx.workspace = {
    # Runs when a workspace is first created.
    onCreate = {
      install-deps = "pnpm install --prefer-offline"; # Installs all dependencies.
    };
    # Runs every time the workspace is (re)started.
    onStart = {
      # Starts Firebase emulators in the background.
      emulators = "firebase emulators:start --import=./firebase-data --export-on-exit";
    };
  };

  # Web preview configuration.
  idx.previews = {
    enable = true;
    previews = {
      # The web app dev server.
      web = {
        command = ["pnpm", "--filter", "web", "run", "dev"];
        manager = "web";
      };
      # The Firebase emulator UI.
      emulators-ui = {
        # This is a dummy command, the port is what matters.
        command = ["echo", "Emulator UI running on port 4000"];
        manager = "web";
        port = 4000;
      };
    };
  };

  # Environment variables.
  env = {
    # This is picked up by the firebase-tools.
    GCLOUD_PROJECT = "urai-jobs";
  };
}
