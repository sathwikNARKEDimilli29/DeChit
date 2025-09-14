// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ICreditScoreOracle {
    function computeCreditScore(address user) external view returns (uint256);
}

contract ChitFund is AccessControl, ReentrancyGuard {
    // Roles
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant PARTICIPANT_ROLE = keccak256("PARTICIPANT_ROLE");

    // External contracts
    IERC20 public immutable token;
    ICreditScoreOracle public immutable oracle;

    // Parameters
    uint256 public immutable poolSizeCap; // threshold for large pool
    uint256 public immutable minCreditForLargePool; // e.g., 700e18
    uint8 public immutable minOperatorRating; // e.g., 3 (compared to pool.rating)

    // Insurance premiums per pool (ETH accumulator)
    mapping(uint256 => uint256) public premiums;

    // Pools
    struct Pool {
        uint256 size;
        uint8 rating;
        bool exists;
    }
    uint256 public poolCount;
    mapping(uint256 => Pool) public pools;

    event PoolCreated(uint256 indexed poolId, uint256 size, uint8 rating);
    event PremiumDeposited(uint256 indexed poolId, address indexed from, uint256 amount);

    // Auctions
    struct Auction {
        uint256 poolId;
        uint256 bidEnd;
        uint256 revealEnd;
        bool closed;
        address winner;
        uint256 highestBid;
    }
    uint256 public auctionCount;
    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => mapping(address => bytes32)) public bidCommits; // auctionId => user => commitHash
    mapping(uint256 => mapping(address => bool)) public revealed; // prevent double reveal

    event AuctionCreated(uint256 indexed auctionId, uint256 indexed poolId, uint256 bidEnd, uint256 revealEnd);
    event BidCommitted(uint256 indexed auctionId, address indexed bidder, bytes32 commitHash);
    event BidRevealed(uint256 indexed auctionId, address indexed bidder, uint256 amount);
    event AuctionClosed(uint256 indexed auctionId, address indexed winner, uint256 amount, uint256 bonus);

    // DeFi allowlist for safety
    mapping(address => bool) public allowedProtocol;
    event ProtocolAllowlisted(address indexed protocol, bool allowed);

    constructor(
        address admin,
        address token_,
        address oracle_,
        uint256 poolSizeCap_,
        uint256 minCreditForLargePool_,
        uint8 minOperatorRating_
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        _grantRole(PARTICIPANT_ROLE, admin);

        token = IERC20(token_);
        oracle = ICreditScoreOracle(oracle_);
        poolSizeCap = poolSizeCap_;
        minCreditForLargePool = minCreditForLargePool_;
        minOperatorRating = minOperatorRating_;
    }

    // =============== Admin ===============
    function registerParticipant(address user) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(PARTICIPANT_ROLE, user);
    }

    function registerOperator(address user) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(OPERATOR_ROLE, user);
    }

    function setAllowedProtocol(address protocol, bool allowed) external onlyRole(DEFAULT_ADMIN_ROLE) {
        allowedProtocol[protocol] = allowed;
        emit ProtocolAllowlisted(protocol, allowed);
    }

    // =============== Pools ===============
    function createPool(uint256 size, uint8 rating) external onlyRole(OPERATOR_ROLE) returns (uint256 poolId) {
        require(size > 0, "size=0");
        poolId = ++poolCount;
        pools[poolId] = Pool({size: size, rating: rating, exists: true});
        emit PoolCreated(poolId, size, rating);
    }

    // =============== Auctions ===============
    function createAuction(uint256 poolId, uint256 biddingDuration, uint256 revealDuration) external onlyRole(OPERATOR_ROLE) returns (uint256 auctionId) {
        Pool memory p = pools[poolId];
        require(p.exists, "pool!exists");
        require(p.rating >= minOperatorRating, "pool.rating<min");

        if (p.size > poolSizeCap) {
            uint256 credit = oracle.computeCreditScore(msg.sender);
            require(credit >= minCreditForLargePool, "operator credit low");
        }

        uint256 bidEnd = block.timestamp + biddingDuration;
        uint256 revealEnd = bidEnd + revealDuration;

        auctionId = ++auctionCount;
        auctions[auctionId] = Auction({
            poolId: poolId,
            bidEnd: bidEnd,
            revealEnd: revealEnd,
            closed: false,
            winner: address(0),
            highestBid: 0
        });

        emit AuctionCreated(auctionId, poolId, bidEnd, revealEnd);
    }

    function commitBid(uint256 auctionId, bytes32 commitHash) external onlyRole(PARTICIPANT_ROLE) {
        Auction memory a = auctions[auctionId];
        require(a.poolId != 0, "auction!exists");
        require(block.timestamp < a.bidEnd, "bidding over");
        bidCommits[auctionId][msg.sender] = commitHash; // last commit wins (known risk)
        emit BidCommitted(auctionId, msg.sender, commitHash);
    }

    function revealBid(uint256 auctionId, uint256 amount, string calldata secret) external onlyRole(PARTICIPANT_ROLE) {
        Auction storage a = auctions[auctionId];
        require(a.poolId != 0, "auction!exists");
        require(block.timestamp >= a.bidEnd && block.timestamp < a.revealEnd, "not in reveal");
        require(!revealed[auctionId][msg.sender], "already revealed");

        bytes32 commitHash = bidCommits[auctionId][msg.sender];
        require(commitHash != bytes32(0), "no commit");
        bytes32 h = keccak256(abi.encode(amount, secret));
        require(h == commitHash, "commit mismatch");

        revealed[auctionId][msg.sender] = true;

        // Determine if new highest or tie-break by credit score
        if (amount > a.highestBid) {
            a.highestBid = amount;
            a.winner = msg.sender;
        } else if (amount == a.highestBid && amount > 0) {
            if (a.winner == address(0)) {
                a.winner = msg.sender;
            } else {
                uint256 newScore = oracle.computeCreditScore(msg.sender);
                uint256 curScore = oracle.computeCreditScore(a.winner);
                if (newScore > curScore) {
                    a.winner = msg.sender;
                }
            }
        }

        emit BidRevealed(auctionId, msg.sender, amount);
    }

    function closeAuction(uint256 auctionId) external nonReentrant {
        Auction storage a = auctions[auctionId];
        require(a.poolId != 0, "auction!exists");
        require(block.timestamp >= a.revealEnd, "reveal ongoing");
        require(!a.closed, "already closed");
        a.closed = true;

        uint256 bonus = 0;
        if (a.winner != address(0) && a.highestBid > 0) {
            uint256 score = oracle.computeCreditScore(a.winner);
            uint256 threshold = 850e18;
            if (score >= threshold) {
                // bonus = highestBid * (score - 850e18) / 1e20
                uint256 diff = score - threshold; // scaled 1e18
                bonus = (a.highestBid * diff) / 1e20; // divisor 1e20
                if (bonus > 0) {
                    uint256 bal = token.balanceOf(address(this));
                    require(bal >= bonus, "insufficient bonus balance");
                    bool ok = token.transfer(a.winner, bonus);
                    require(ok, "bonus transfer failed");
                }
            }
        }

        emit AuctionClosed(auctionId, a.winner, a.highestBid, bonus);
    }

    // =============== Secondary market ===============
    function tradeTokens(address to, uint256 amount) external returns (bool) {
        return token.transferFrom(msg.sender, to, amount);
    }

    // =============== Insurance ===============
    function depositPremium(uint256 poolId) external payable {
        Pool memory p = pools[poolId];
        require(p.exists, "pool!exists");
        require(msg.value > 0, "no value");
        premiums[poolId] += msg.value;
        emit PremiumDeposited(poolId, msg.sender, msg.value);
    }

    // =============== DeFi hook ===============
    function integrateWithDefi(address protocol, bytes calldata data) external onlyRole(OPERATOR_ROLE) nonReentrant returns (bytes memory) {
        require(allowedProtocol[protocol], "protocol not allowed");
        (bool ok, bytes memory ret) = protocol.call(data);
        require(ok, "defi call failed");
        return ret;
    }
}
