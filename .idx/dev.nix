# To learn more about how to use Nix to configure your environment
# see: https://developers.google.com/idx/guides/customize-idx-env
{ pkgs, ... }: {
  # Which nixpkgs channel to use.
  channel = "stable-24.05"; # or "unstable"
  # Use https://search.nixos.org/packages to find packages
  packages = [
    pkgs.nodejs_22  # Using Node.js 22 as specified in urai-jobs-codebase/package.json
    pkgs.nodePackages.genkit
  ];
  # Sets environment variables in the workspace
  env = {
    # Replace with your Google Cloud project ID
    GCLOUD_PROJECT = "your-gcloud-project-id";
    # Replace with your actual API key or secret name in IDX
    API_KEY = "your-api-key-secret";
  };
  idx = {
    # Search for the extensions you want on https://open-vsx.org/ and use "publisher.id"
    extensions = [
      "dbaeumer.vscode-eslint" # For linting TypeScript and JavaScript
    ];
    # Enable previews
    previews = {
      enable = true;
    };
    # Workspace lifecycle hooks
    workspace = {
      # Runs when a workspace is first created
      onCreate = {
        # Install dependencies for both functions and urai-jobs-codebase
        install-deps = "(cd functions && npm install) && (cd urai-jobs-codebase && npm install)";
      };
      # Runs when the workspace is (re)started
      onStart = {
        # Start the Genkit development server
        genkit-start = "(cd urai-jobs-codebase && npm run genkit:start)";
      };
    };
  };
}
