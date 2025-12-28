// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Stores encrypted memo payloads by memo hash.
contract MemoStore {
    struct MemoRecord {
        bytes data;
        address sender;
        address recipient;
        uint64 createdAt;
    }

    uint256 public constant MAX_MEMO_BYTES = 2048;

    mapping(bytes32 => MemoRecord) private memos;

    event MemoStored(bytes32 indexed memoHash, address indexed sender, address indexed recipient, bytes data);
    event MemoDeleted(bytes32 indexed memoHash, address indexed recipient);

    function putMemo(bytes32 memoHash, bytes calldata data, address sender, address recipient) external {
        require(data.length <= MAX_MEMO_BYTES, "MEMO_TOO_LARGE");
        require(memos[memoHash].createdAt == 0, "MEMO_EXISTS");
        require(msg.sender == sender, "ONLY_SENDER");

        memos[memoHash] = MemoRecord({
            data: data,
            sender: sender,
            recipient: recipient,
            createdAt: uint64(block.timestamp)
        });

        emit MemoStored(memoHash, sender, recipient, data);
    }

    function deleteMemo(bytes32 memoHash) external {
        MemoRecord storage record = memos[memoHash];
        require(record.createdAt != 0, "MEMO_MISSING");
        require(msg.sender == record.recipient, "ONLY_RECIPIENT");
        delete memos[memoHash];
        emit MemoDeleted(memoHash, msg.sender);
    }

    function getMemo(bytes32 memoHash)
        external
        view
        returns (bytes memory data, address sender, address recipient, uint64 createdAt)
    {
        MemoRecord storage record = memos[memoHash];
        return (record.data, record.sender, record.recipient, record.createdAt);
    }
}
