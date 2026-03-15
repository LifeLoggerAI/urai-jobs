
# URAI Ecosystem Deployment

This document describes the process for deploying the URAI ecosystem.

## Deployment Pipeline

The deployment pipeline for the URAI ecosystem is configured as follows:

### Build Scripts

*   **`web/package.json`**: The `build` script in the `web` project's `package.json` file is responsible for building the frontend React application.
    ```json
    "build": "tsc -b && vite build"
    ```
*   **`functions/package.json`**: The `build` script in the `functions` project's `package.json` file is responsible for compiling the TypeScript code to JavaScript.
    ```json
    "build": "npm run lint && tsc"
    ```
*   **`package.json`**: The root `package.json` file contains a `build` script that builds both the `web` and `functions` projects in the correct order.
    ```json
    "build": "npm run build -w functions && npm run build -w web"
    ```

### Firebase Deployment Configuration

*   **`firebase.json`**: The `firebase.json` file is configured to deploy the `functions` and `hosting` services.
    ```json
    {
      "hosting": {
        "public": "web/build",
        "ignore": [
          "firebase.json",
          "**/.*",
          "**/node_modules/**"
        ],
        "rewrites": [
          {
            "source": "**",
            "destination": "/index.html"
          }
        ]
      },
      "functions": {
        "source": "functions"
      }
    }
    ```

## Deployment Steps

To deploy the entire URAI ecosystem, run the following commands from the root of the project:

1.  **Install dependencies**:
    ```bash
    npm install
    ```
2.  **Build the projects**:
    ```bash
    npm run build
    ```
3.  **Deploy to Firebase**:
    ```bash
    firebase deploy
    ```
