// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Stores an address->public key mapping for memo encryption.
contract PublicKeyRegistry {
    struct KeyRecord {
        bytes key;
        uint8 keyType;
        uint32 version;
    }

    mapping(address => KeyRecord) private records;

    event KeyUpdated(address indexed owner, uint8 keyType, uint32 version, bytes key);

    function setKey(bytes calldata key, uint8 keyType, uint32 version) external {
        require(key.length > 0, "KEY_EMPTY");
        records[msg.sender] = KeyRecord({key: key, keyType: keyType, version: version});
        emit KeyUpdated(msg.sender, keyType, version, key);
    }

    function getKey(address owner) external view returns (bytes memory key, uint8 keyType, uint32 version) {
        KeyRecord storage record = records[owner];
        return (record.key, record.keyType, record.version);
    }
}
