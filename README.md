# DeChit Implementation

Hardhat-based project with three contracts: `ChitToken`, `CreditScoreOracle`, and `ChitFund`. Includes scripts to deploy and interact with pools, auctions, oracle signals, and token operations.

## Setup
- Install deps: `npm install`
- Configure env: copy `.env` and set `PRIVATE_KEY`, `RPC_URL`, etc.
- Common cmds: `npm run build`, `npm run node` (local chain)

## Deploy
- Local: `npm run deploy:local`
- Custom network: `npm run deploy -- --network <name>` (set `RPC_URL`, `PRIVATE_KEY`)
- Saves addresses to `deployments/last-deploy.json`

## Scripts
- Admin: `npm run admin -- --action register-operator --address 0x...`
- Pool: `npm run pool -- --action create-pool --size <wei> --rating <0-255>`
- Premium: `npm run pool -- --action deposit-premium --poolId 1 --value <wei>`
- Auction: create/commit/reveal/close via `npm run auction -- --action <...>`
- Oracle: trust/outcome/payment/score via `npm run oracle -- --action <...>`
- Token: mint/approve/balance via `npm run token -- --action <...>`
- Trade: `npm run trade -- --to 0x... --amount <wei>`

## Env Vars
- RPC/auth: `PRIVATE_KEY`, `RPC_URL`, `ETHERSCAN_API_KEY`
- Deploy defaults: `TOKEN_NAME`, `TOKEN_SYMBOL`, `TOKEN_SUPPLY`, `POOL_SIZE_CAP`, `MIN_CREDIT_LARGE`, `MIN_OPERATOR_RATING`

## Notes
- Contracts import OpenZeppelin; ensure installed: `npm i -D @openzeppelin/contracts`
- Numbers are in 18 decimals unless noted. Use `--network localhost` or configure `.env`.
