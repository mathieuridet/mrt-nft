// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice One-time token claims for an allowlist using a Merkle root.
/// Leaf = keccak256(abi.encodePacked(index, account, amount))
contract MerkleDistributor is Ownable {
    IERC20  public immutable token;
    bytes32 public immutable merkleRoot;

    // index -> claimed bitmap
    mapping(uint256 => uint256) private claimedBitMap;

    event Claimed(uint256 indexed index, address indexed account, uint256 amount);

    constructor(address initialOwner, IERC20 _token, bytes32 _merkleRoot) Ownable(initialOwner) {
        token = _token;
        merkleRoot = _merkleRoot;
    }

    function isClaimed(uint256 index) public view returns (bool) {
        uint256 wordIndex = index >> 8;        // /256
        uint256 bitIndex  = index & 255;       // %256
        uint256 word = claimedBitMap[wordIndex];
        uint256 mask = (1 << bitIndex);
        return (word & mask) != 0;
    }

    function _setClaimed(uint256 index) private {
        uint256 wordIndex = index >> 8;
        uint256 bitIndex  = index & 255;
        claimedBitMap[wordIndex] = claimedBitMap[wordIndex] | (1 << bitIndex);
    }

    function claim(uint256 index, address account, uint256 amount, bytes32[] calldata merkleProof) external {
        require(!isClaimed(index), "ALREADY_CLAIMED");

        // Must exactly match off-chain leaf encoding
        bytes32 leaf = keccak256(abi.encodePacked(index, account, amount));
        require(MerkleProof.verify(merkleProof, merkleRoot, leaf), "BAD_PROOF");

        _setClaimed(index);
        require(token.transfer(account, amount), "TRANSFER_FAILED");
        emit Claimed(index, account, amount);
    }

    /// @notice owner can rescue leftover tokens (after the claim window)
    function rescue(address to, uint256 amount) external onlyOwner {
        require(token.transfer(to, amount), "TRANSFER_FAILED");
    }
}
