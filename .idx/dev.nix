{
  pkgs, ...
}: {
  # Which nixpkgs channel to use.
  channel = "stable-23.11"; # or "unstable"

  # Collection of packages that will be installed
  # in your environment.
  packages = [
    pkgs.nodejs_20
    pkgs.firebase-tools
    pkgs.google-cloud-sdk
  ];

  # Collection of environment variables that will be
  # available in your shell.
  env = {};

  # VS Code extensions that will be automatically installed.
  idx.extensions = [
    "dbaeumer.vscode-eslint"
    "esbenp.prettier-vscode"
  ];

  # Defines the workspace lifecycle hooks.
  idx.workspace = {
    # Runs when a workspace is first created.
    onCreate = {
      install-deps = "npm install";
    };

    # Runs every time the workspace is (re)started.
    onStart = {
      # start-dev-server = "npm run dev";
    };
  };

  # Defines a preview of your application.
  idx.previews = {
    enable = true;
    previews = [
      {
        # The name that will be displayed in the web preview
        # anme = "Web";
        # The command that will be run to start your application
        command = ["npm" "run" "dev"];
        # Whether to keep the process running after the initial startup
        # has completed. This is useful for servers and other
        # long-running processes.
        # keep_alive = true;
        # The directory that will be used as the root of the
        # web server. This is useful for static sites.
        # root = "dist";
        manager = "web";
      }
    ];
  };

  # The list of ports that should be exposed to the
  # internet.
  # ports = [];
}
