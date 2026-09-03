# XR Job Types Contract

Jobs runtime should support XR-related job categories through standard lifecycle states.

## Suggested jobType values
- `asset.render.orb`
- `asset.render.scene`
- `asset.render.anchor`
- `spatial.scene.compile`
- `spatial.scene.publish`

## Output contract
Each successful job should return `resultAssetIds[]` compatible with `URAI_ECOSYSTEM_SCHEMA_V1`.

## Status model
`PENDING -> LEASED -> RUNNING -> SUCCESS|FAILED|DEAD|CANCELLED`
