// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockProtocol {
    event Ping(address indexed from, uint256 value, bytes32 ret);

    function ping(uint256 v) external returns (bytes32) {
        bytes32 r = keccak256(abi.encodePacked(v));
        emit Ping(msg.sender, v, r);
        return r;
    }
}

