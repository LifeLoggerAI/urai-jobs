# URAI Jobs

This project is a job runner for URAI.

## Local Setup

1.  Install dependencies:

    ```bash
    pnpm install
    ```

2.  Run the emulators:

    ```bash
    firebase emulators:start
    ```

3.  Run the web dev server:

    ```bash
    pnpm --filter jobs-web dev
    ```

## Deployment

To deploy the project, run the following command:

```bash
./scripts/deploy_jobs.sh
```
