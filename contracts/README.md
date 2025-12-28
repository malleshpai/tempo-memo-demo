# Memo contracts

These contracts store encryption public keys and encrypted onchain memos.

## Deploy on Tempo Testnet

```bash
export TEMPO_RPC_URL=https://rpc.testnet.tempo.xyz
export VERIFIER_URL=https://contracts.tempo.xyz

forge script script/DeployMemoContracts.s.sol   --rpc-url $TEMPO_RPC_URL   --interactive   --sender <YOUR_WALLET_ADDRESS>   --broadcast   --verify
```
