{ pkgs, ... }:
{
  # Learn more about dev environments in Nix: https://nix.dev/tutorials/first-nix-build
  packages = [
    pkgs.nodejs_20
    pkgs.firebase-tools
    pkgs.jdk # Using the full JDK is more robust for providing Java
  ];

  # Set environment variables for your Firebase project.
  # IMPORTANT: Replace the placeholder values with your actual Firebase credentials.
  env = {
    NEXT_PUBLIC_FIREBASE_API_KEY = "your-api-key";
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "your-auth-domain";
    NEXT_PUBLIC_FIREBASE_PROJECT_ID = "your-project-id";
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "your-storage-bucket";
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "your-messaging-sender-id";
    NEXT_PUBLIC_FIREBASE_APP_ID = "your-app-id";
  };
}
