# Circuit artifacts

`verification_key.dev.json` — the Groth16 verifying key from a **local, throwaway**
trusted setup. It exists so the on-chain verifier can be wired and tested against
real proofs during development.

**It is NOT the production key.** A mainnet deployment must run a multi-party
trusted-setup ceremony (public transcripts) and embed that key instead. Using this
dev key in production would let anyone who ran the local setup forge proofs.
