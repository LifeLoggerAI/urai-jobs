
# .idx/dev.nix
#
# This file defines the development environment for the urai-jobs project.
# It ensures that all developers have the same versions of tools and packages,
# leading to a consistent and reproducible setup.
#
# For more information, see: https://firebase.google.com/docs/studio/customize-environment
{ pkgs, ... }: {
  # Specifies the Nix channel to use. 'stable-24.05' provides a recent,
  # stable set of packages.
  channel = "stable-24.05";

  # A list of packages to install in the environment.
  packages = [
    # The project's package.json specifies Node.js v22. This ensures the
    # environment matches the requirement.
    pkgs.nodejs_22

    # The project uses pnpm for package management.
    pkgs.pnpm

    # The Firebase CLI is essential for deploying and managing the project.
    pkgs.firebase-tools

    # The Google Cloud CLI is used for authentication, especially for
    # Application Default Credentials (ADC).
    pkgs.gcloud
  ];

  # Workspace lifecycle hooks.
  idx = {
    workspace = {
      # Runs when the workspace is first created.
      onCreate = {
        # Installs all dependencies across the monorepo.
        install-deps = "pnpm install -w";
      };
      # Runs every time the workspace is (re)started.
      onStart = {
        # Provides a hint to the user on how to log in for ADC.
        login-prompt = "echo \"Run 'gcloud auth application-default login' if you need to re-authenticate.\"";
      };
    };
  };
}
