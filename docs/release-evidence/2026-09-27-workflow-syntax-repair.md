# Jobs deployment workflow syntax repair

Parent 1559dbe5671adc09535c33dffb318398ae66719a. Failed run 36316473930 has zero jobs. Found a column-zero NODE heredoc terminator outside the YAML run scalar. Indent it to the scalar baseline so YAML parses and Bash still receives the terminator at column zero.

Validated YAML parse and bash -n on all 26 run blocks. No run block executed. Only whitespace changes in the workflow; protected environments, exact-source and rollback checks, credential handling, permissions and manual dispatch remain intact. This repairs workflow syntax only; deployment, provider authority, independent approval and live verification remain unproven.
