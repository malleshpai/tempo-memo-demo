// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Stores publicly accessible memo headers with locator references.
contract PublicMemoHeader {
    enum LocatorType {
        OnChain,  // Content stored in MemoStore contract
        OffChain  // Content stored at external URL
    }

    struct Party {
        address addr;
        string identifier;
    }

    struct PublicMemo {
        string purpose;
        LocatorType locatorType;
        bytes32 locatorHash;
        string locatorUrl;
        bytes32 contentHash;
        bytes signature;
        Party sender;
        Party recipient;
        string version;
        uint64 createdAt;
    }

    struct CreateParams {
        bytes32 memoId;
        string purpose;
        LocatorType locatorType;
        bytes32 locatorHash;
        string locatorUrl;
        bytes32 contentHash;
        bytes signature;
        Party sender;
        Party recipient;
        string version;
    }

    mapping(bytes32 => PublicMemo) private memos;

    event MemoHeaderCreated(
        bytes32 indexed memoId,
        address indexed senderAddr,
        address indexed recipientAddr,
        string purpose,
        LocatorType locatorType
    );

    event MemoHeaderDeleted(bytes32 indexed memoId, address indexed deletedBy);

    function createMemoHeader(CreateParams calldata params) external {
        require(memos[params.memoId].createdAt == 0, "MEMO_EXISTS");
        require(msg.sender == params.sender.addr, "ONLY_SENDER");
        require(bytes(params.version).length > 0, "VERSION_REQUIRED");

        if (params.locatorType == LocatorType.OnChain) {
            require(params.locatorHash != bytes32(0), "LOCATOR_HASH_REQUIRED");
        } else {
            require(bytes(params.locatorUrl).length > 0, "LOCATOR_URL_REQUIRED");
        }

        memos[params.memoId] = PublicMemo({
            purpose: params.purpose,
            locatorType: params.locatorType,
            locatorHash: params.locatorHash,
            locatorUrl: params.locatorUrl,
            contentHash: params.contentHash,
            signature: params.signature,
            sender: params.sender,
            recipient: params.recipient,
            version: params.version,
            createdAt: uint64(block.timestamp)
        });

        emit MemoHeaderCreated(
            params.memoId,
            params.sender.addr,
            params.recipient.addr,
            params.purpose,
            params.locatorType
        );
    }

    function deleteMemoHeader(bytes32 memoId) external {
        PublicMemo storage memo = memos[memoId];
        require(memo.createdAt != 0, "MEMO_MISSING");
        require(
            msg.sender == memo.sender.addr || msg.sender == memo.recipient.addr,
            "ONLY_SENDER_OR_RECIPIENT"
        );

        delete memos[memoId];
        emit MemoHeaderDeleted(memoId, msg.sender);
    }

    function getMemoHeader(bytes32 memoId) external view returns (PublicMemo memory) {
        return memos[memoId];
    }
}
