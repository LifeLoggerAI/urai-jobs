{ pkgs, ... }: {
  # Specifies the Nixpkgs channel to use for package lookups.
  # "stable-24.05" offers reliability, while "unstable" provides the latest packages.
  channel = "stable-24.05";

  # A list of packages to be installed in the development environment.
  packages = [
    # Provides the Node.js 20.x runtime, essential for running the web app and Firebase Functions.
    pkgs.nodejs_20
    # Installs the Firebase CLI for deploying and managing Firebase projects.
    pkgs.firebase-tools
    # Installs the Google Cloud SDK, needed for interacting with Google Cloud services.
    pkgs.google-cloud-sdk
  ];

  # Environment variables available in the workspace.
  env = {};

  # Configuration for the IDE.
  idx = {
    # A list of VS Code extensions to install from the Open VSX Registry.
    extensions = [
      # Linter for JavaScript and TypeScript.
      "dbaeumer.vscode-eslint"
      # Code formatter.
      "esbenp.prettier-vscode"
      # Provides Firebase integration for VS Code.
      "firebase.firebase-vscode"
    ];

    # Workspace lifecycle hooks.
    workspace = {
      # Commands to run when the workspace is first created.
      onCreate = {
        # Installs all npm dependencies defined in package.json, including for web and functions workspaces.
        install-deps = "npm install";
      };

      # Commands to run every time the workspace starts.
      onStart = {
        # Starts the development server, which typically includes the frontend and backend.
        start-dev-server = "npm run dev";
      };
    };

    # Configures web previews for the application.
    previews = {
      enable = true;
      previews = {
        # Defines a preview for the web application.
        web = {
          # Command to start the development server.
          # The '$PORT' variable is dynamically assigned by the environment.
          command = ["npm" "run" "dev" "--" "--port" "$PORT"];
          # Specifies the manager for this preview, in this case, a web browser.
          manager = "web";
        };
      };
    };
  };
}
