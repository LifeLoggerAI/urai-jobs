# Jobs release-contract and CI reconciliation

- Canonical worker authority base: `3f0b87d692ba0e4de2d24098fa0766fadc600e98`
- Release-contract source: `331c720f284d9dd085ccaae08c5d021eaa7cc147`
- Frozen-runtime-CI source: `6d3893e8574d1bb635294ac19750960d6debd82e`
- Publication method: authenticated bounded source transfer
- Cloud Run deployment: false
- Firebase mutation: false
- Provider call: false
- Credential mutation: false
- Production-data mutation: false

The canonical V1-V5 contract transferred into the current worker authority. The sole runtime-CI conflict was bounded to `.github/workflows/urai-jobs-runtime-ci.yml`; the stronger current exact-head checkout and Firebase CLI controls were retained while the Java action was immutably pinned and public-repository evidence retention was corrected from 365 to 90 days.

This receipt certifies source reconciliation only. Exact-head testing, artifact inspection, protected Cloud Run/Pub/Sub staging, recovery proof, and independent security/release review remain required before consumption into PR #75 or `main`.
