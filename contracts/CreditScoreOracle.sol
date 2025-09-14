// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * CreditScoreOracle
 * - Trust graph with inbound list and outbound weight sums
 * - Bayesian reputation (alpha/beta)
 * - Payment signals (frequency, inverse delay)
 * - One-step damped PageRank (scaled 1e18)
 * - Aggregate score = 0.4*PR + 0.4*Bayes + 0.1*PayFreq + 0.1*InvDelay
 */
contract CreditScoreOracle is AccessControl {
    // Roles
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    // Scaling
    uint256 public constant SCALE = 1e18;

    // Damping factor (0.85e18 by default). Exposed via view; immutable within code.
    uint256 private constant DAMPING = 85e16; // 0.85 * 1e18

    // Delay normalization unit in seconds (1 day). Used to scale delays to ~1.0 units per day.
    uint256 public constant DELAY_NORMALIZATION = 1 days;

    // Trust graph: directed weights from -> to
    mapping(address => mapping(address => uint256)) public trustWeight; // SCALE-scaled
    mapping(address => address[]) public inboundTrusters; // list of addresses that trust the key
    mapping(address => uint256) public outWeightSum; // sum of outgoing weights per address (SCALE-scaled)
    mapping(address => mapping(address => bool)) private _hasInbound; // to avoid duplicate push

    event TrustSet(address indexed from, address indexed to, uint256 weight);

    // Bayesian reputation parameters per user
    mapping(address => uint256) public alpha; // successes
    mapping(address => uint256) public beta;  // failures
    event RepUpdated(address indexed user, uint256 alpha, uint256 beta);

    // Payment stats per user
    mapping(address => uint256) public timelyPayments;
    mapping(address => uint256) public totalPayments;
    mapping(address => uint256) public cumulativeDelay; // in seconds
    mapping(address => uint256) public auctionCount;    // loosely tracked via recordPaymentStats
    event PaymentStatsUpdated(address indexed user, uint256 timely, uint256 total, uint256 cumulativeDelay);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ROLE, admin);
    }

    // =============== Trust Graph ===============
    function setTrust(address to, uint256 weight) external onlyRole(ORACLE_ROLE) {
        address from = msg.sender;
        uint256 prev = trustWeight[from][to];
        if (!_hasInbound[from][to] && weight > 0) {
            _hasInbound[from][to] = true;
            inboundTrusters[to].push(from);
        }

        // Update outWeightSum for the sender
        if (weight >= prev) {
            outWeightSum[from] += (weight - prev);
        } else {
            outWeightSum[from] -= (prev - weight);
        }

        trustWeight[from][to] = weight;
        emit TrustSet(from, to, weight);
    }

    // =============== Bayesian Reputation ===============
    function recordOutcome(address user, bool success) external onlyRole(ORACLE_ROLE) {
        if (success) {
            alpha[user] += 1;
        } else {
            beta[user] += 1;
        }
        emit RepUpdated(user, alpha[user], beta[user]);
    }

    function bayesianReputation(address user) public view returns (uint256) {
        uint256 a = alpha[user];
        uint256 b = beta[user];
        uint256 s = a + b;
        if (s == 0) {
            return SCALE / 2; // default 0.5
        }
        return (a * SCALE) / s;
    }

    // =============== Payment Signals ===============
    function recordPaymentStats(address user, bool onTime, uint256 delaySeconds) external onlyRole(ORACLE_ROLE) {
        totalPayments[user] += 1;
        if (onTime) {
            timelyPayments[user] += 1;
        }
        cumulativeDelay[user] += delaySeconds;
        auctionCount[user] += 1;
        emit PaymentStatsUpdated(user, timelyPayments[user], totalPayments[user], cumulativeDelay[user]);
    }

    function paymentFrequency(address user) public view returns (uint256) {
        uint256 total = totalPayments[user];
        if (total == 0) return 0;
        return (timelyPayments[user] * SCALE) / total; // scaled
    }

    function inverseDelayScore(address user) public view returns (uint256) {
        uint256 total = totalPayments[user];
        if (total == 0) return 0; // undefined until some data exists

        // avgDelay in units of DELAY_NORMALIZATION, scaled to 1e18
        // avgDelayUnitsScaled = (cumulativeDelay / total) / DELAY_NORMALIZATION, then scaled to 1e18
        // = cumulativeDelay * 1e18 / (total * DELAY_NORMALIZATION)
        uint256 avgDelayScaled = (cumulativeDelay[user] * SCALE) / (total * DELAY_NORMALIZATION);

        // score = 1 / (1 + avgDelay), scaled to 1e18 => SCALE^2 / (SCALE + avgDelayScaled)
        uint256 denom = SCALE + avgDelayScaled;
        return (SCALE * SCALE) / denom;
    }

    // =============== PageRank (one-step damped) ===============
    function dampingFactor() external pure returns (uint256) {
        return DAMPING;
    }

    function pageRank(address user) public view returns (uint256) {
        // One-step from uniform base using inbound edges and outbound normalization
        // R = (1 - d)*S + d * sum_{v in inbound(user)} (weight(v->user)/outSum(v)) * S
        // With S=1e18, d scaled to 1e18.
        uint256 d = DAMPING;
        uint256 rank = SCALE - d; // (1 - d) * SCALE, because d is already SCALE-scaled

        address[] memory inb = inboundTrusters[user];
        uint256 len = inb.length;
        for (uint256 i = 0; i < len; i++) {
            address v = inb[i];
            uint256 outSum = outWeightSum[v];
            if (outSum == 0) continue;
            uint256 w = trustWeight[v][user]; // SCALE-scaled weight
            // ratioScaled = w / outSum (SCALE-scaled) => w * SCALE / outSum
            uint256 ratioScaled = (w * SCALE) / outSum;
            // contribution = d * ratioScaled / SCALE
            uint256 contrib = (d * ratioScaled) / SCALE;
            rank += contrib;
        }
        return rank; // already SCALE-scaled
    }

    // =============== Aggregate Score ===============
    function computeCreditScore(address user) public view returns (uint256) {
        uint256 pr = pageRank(user);
        uint256 bayes = bayesianReputation(user);
        uint256 pf = paymentFrequency(user);
        uint256 invDelay = inverseDelayScore(user);

        // 40%, 40%, 10%, 10% weights
        uint256 sum = pr * 40 + bayes * 40 + pf * 10 + invDelay * 10;
        return sum / 100;
    }
}

