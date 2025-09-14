// Minimal ABIs needed for UI interactions
export const ChitTokenABI = [
  { "inputs": [{"internalType":"address","name":"account","type":"address"}], "name":"balanceOf", "outputs":[{"internalType":"uint256","name":"","type":"uint256"}], "stateMutability":"view", "type":"function" },
  { "inputs": [{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}], "name":"approve", "outputs":[{"internalType":"bool","name":"","type":"bool"}], "stateMutability":"nonpayable", "type":"function" },
  { "inputs": [{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}], "name":"mint", "outputs": [], "stateMutability":"nonpayable", "type":"function" },
  { "inputs": [{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}], "name":"transferFrom", "outputs":[{"internalType":"bool","name":"","type":"bool"}], "stateMutability":"nonpayable", "type":"function" }
];

export const CreditScoreOracleABI = [
  { "inputs": [{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"weight","type":"uint256"}], "name":"setTrust", "outputs": [], "stateMutability":"nonpayable", "type":"function" },
  { "inputs": [{"internalType":"address","name":"user","type":"address"},{"internalType":"bool","name":"success","type":"bool"}], "name":"recordOutcome", "outputs": [], "stateMutability":"nonpayable", "type":"function" },
  { "inputs": [{"internalType":"address","name":"user","type":"address"},{"internalType":"bool","name":"onTime","type":"bool"},{"internalType":"uint256","name":"delaySeconds","type":"uint256"}], "name":"recordPaymentStats", "outputs": [], "stateMutability":"nonpayable", "type":"function" },
  { "inputs": [{"internalType":"address","name":"user","type":"address"}], "name":"computeCreditScore", "outputs": [{"internalType":"uint256","name":"","type":"uint256"}], "stateMutability":"view", "type":"function" },
  { "inputs": [{"internalType":"address","name":"user","type":"address"}], "name":"pageRank", "outputs": [{"internalType":"uint256","name":"","type":"uint256"}], "stateMutability":"view", "type":"function" }
];

export const ChitFundABI = [
  { "inputs": [{"internalType":"address","name":"user","type":"address"}], "name":"registerParticipant", "outputs": [], "stateMutability":"nonpayable", "type":"function" },
  { "inputs": [{"internalType":"address","name":"user","type":"address"}], "name":"registerOperator", "outputs": [], "stateMutability":"nonpayable", "type":"function" },
  { "inputs": [{"internalType":"address","name":"protocol","type":"address"},{"internalType":"bool","name":"allowed","type":"bool"}], "name":"setAllowedProtocol", "outputs": [], "stateMutability":"nonpayable", "type":"function" },
  { "inputs": [{"internalType":"uint256","name":"size","type":"uint256"},{"internalType":"uint8","name":"rating","type":"uint8"}], "name":"createPool", "outputs": [{"internalType":"uint256","name":"poolId","type":"uint256"}], "stateMutability":"nonpayable", "type":"function" },
  { "inputs": [{"internalType":"uint256","name":"poolId","type":"uint256"}], "name":"depositPremium", "outputs": [], "stateMutability":"payable", "type":"function" },
  { "inputs": [{"internalType":"uint256","name":"poolId","type":"uint256"},{"internalType":"uint256","name":"biddingDuration","type":"uint256"},{"internalType":"uint256","name":"revealDuration","type":"uint256"}], "name":"createAuction", "outputs": [{"internalType":"uint256","name":"auctionId","type":"uint256"}], "stateMutability":"nonpayable", "type":"function" },
  { "inputs": [{"internalType":"uint256","name":"auctionId","type":"uint256"},{"internalType":"bytes32","name":"commitHash","type":"bytes32"}], "name":"commitBid", "outputs": [], "stateMutability":"nonpayable", "type":"function" },
  { "inputs": [{"internalType":"uint256","name":"auctionId","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"string","name":"secret","type":"string"}], "name":"revealBid", "outputs": [], "stateMutability":"nonpayable", "type":"function" },
  { "inputs": [{"internalType":"uint256","name":"auctionId","type":"uint256"}], "name":"closeAuction", "outputs": [], "stateMutability":"nonpayable", "type":"function" },
  { "inputs": [{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}], "name":"tradeTokens", "outputs": [{"internalType":"bool","name":"","type":"bool"}], "stateMutability":"nonpayable", "type":"function" },
  { "inputs": [], "name":"token", "outputs": [{"internalType":"address","name":"","type":"address"}], "stateMutability":"view", "type":"function" },
  { "inputs": [], "name":"oracle", "outputs": [{"internalType":"address","name":"","type":"address"}], "stateMutability":"view", "type":"function" }
];
