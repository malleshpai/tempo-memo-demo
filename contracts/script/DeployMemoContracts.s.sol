// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import { PublicKeyRegistry } from "../src/PublicKeyRegistry.sol";
import { MemoStore } from "../src/MemoStore.sol";

contract DeployMemoContracts is Script {
    function run() external {
        vm.startBroadcast();
        PublicKeyRegistry registry = new PublicKeyRegistry();
        MemoStore memoStore = new MemoStore();
        vm.stopBroadcast();

        console2.log("PublicKeyRegistry:", address(registry));
        console2.log("MemoStore:", address(memoStore));
    }
}
