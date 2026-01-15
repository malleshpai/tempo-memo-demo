'use client'

import React from 'react'
import { AppShell } from '../../components/AppShell'

export default function DocsPage() {
  return (
    <AppShell
      title="Documentation"
      subtitle="Tempo Memo"
      unauthenticated={
        <div className="app-surface">
          <DocsContent />
        </div>
      }
    >
      <div className="app-surface">
        <DocsContent />
      </div>
    </AppShell>
  )
}

function DocsContent() {
  return (
    <div className="panel panel-wide">
      <div className="panel-header">
        <h3 className="panel-title">Tempo Memo Documentation</h3>
      </div>

      <div className="stack-md" style={{ marginTop: 12 }}>
        <div className="card">
          <div style={{ fontWeight: 600, fontSize: 16 }}>Overview</div>
          <div className="muted" style={{ marginTop: 8 }}>
            Tempo Memo is a demo application for sending TIP-20 stablecoin transfers with travel rule
            compliant metadata (IVMS101). Each transfer includes a memo containing sender/beneficiary
            information that can be stored either onchain (encrypted) or offchain (Vercel Blob).
          </div>
          <div className="muted" style={{ marginTop: 8 }}>
            The system supports three key personas: <strong>Sender</strong> (originator),{' '}
            <strong>Recipient</strong> (beneficiary), and <strong>Regulator</strong> (supervisory access).
            All three can decrypt onchain memos using ECDH key exchange.
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 600, fontSize: 16 }}>Quick Start</div>
          <div className="stack-sm" style={{ marginTop: 8 }}>
            <div>
              <div style={{ fontWeight: 600 }}>1. Sign Up / Log In</div>
              <div className="muted">
                Create a Tempo account using passkey authentication. New accounts are automatically
                funded from the testnet faucet.
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>2. Register Encryption Key</div>
              <div className="muted">
                Go to the Register tab and generate a P-256 encryption key. This key is stored locally
                and registered onchain for receiving encrypted memos.
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>3. Send a Transfer</div>
              <div className="muted">
                Enter recipient address, select token, amount, and fill in IVMS data. Choose between
                onchain (encrypted) or offchain storage. Set a purpose and optionally a custom memo ID (UETR).
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>4. View in Vault</div>
              <div className="muted">
                Both sender and recipient can view the memo in their Vault. Click any memo to see
                full details and decrypt the IVMS payload.
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 600, fontSize: 16 }}>Storage Modes</div>
          <div className="stack-sm" style={{ marginTop: 8 }}>
            <div>
              <span style={{ fontWeight: 600 }}>Onchain Encrypted (~1.8KB)</span>
              <div className="muted">
                IVMS payload is encrypted with AES-256-GCM. The symmetric key is wrapped for sender,
                recipient, and regulator using ECDH-P256 + HKDF-SHA256. Stored in MemoStore contract
                (max 2048 bytes).
              </div>
            </div>
            <div>
              <span style={{ fontWeight: 600 }}>Offchain (Vercel Blob)</span>
              <div className="muted">
                IVMS payload and optional invoice PDF stored in Vercel Blob. Only the memo hash is
                recorded onchain. Supports larger payloads and file attachments.
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 600, fontSize: 16 }}>Public Memo Header</div>
          <div className="muted" style={{ marginTop: 8 }}>
            Each memo creates a public header onchain with metadata visible without decryption:
          </div>
          <div className="stack-sm" style={{ marginTop: 8 }}>
            <div><span style={{ fontWeight: 600 }}>Purpose</span> — Payroll, Invoice, Payment, Refund, Transfer, Settlement</div>
            <div><span style={{ fontWeight: 600 }}>Memo ID</span> — Custom identifier (UETR, hex, or auto-generated hash)</div>
            <div><span style={{ fontWeight: 600 }}>Locator</span> — OnChain (points to MemoStore) or OffChain (URL)</div>
            <div><span style={{ fontWeight: 600 }}>Sender/Recipient</span> — Address + human-readable identifier (e.g., email)</div>
            <div><span style={{ fontWeight: 600 }}>Content Hash</span> — SHA-256 hash for integrity verification</div>
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 600, fontSize: 16 }}>Regulator Access</div>
          <div className="muted" style={{ marginTop: 8 }}>
            The regulator page provides supervisory access to all memos. After authentication,
            regulators can:
          </div>
          <div className="stack-sm" style={{ marginTop: 8 }}>
            <div className="muted">• Browse all indexed memos with filters (source, asset, address)</div>
            <div className="muted">• Decrypt onchain memos using the regulator's private key</div>
            <div className="muted">• Look up specific memos by ID</div>
            <div className="muted">• View full IVMS payload details</div>
          </div>
          <div className="muted" style={{ marginTop: 8 }}>
            <strong>Demo password:</strong> <code>Iamtheregulator</code>
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 600, fontSize: 16 }}>Deployed Contracts (Tempo Moderato Testnet)</div>
          <div className="stack-sm" style={{ marginTop: 12 }}>
            <div>
              <span style={{ fontWeight: 600 }}>PublicKeyRegistry</span>
              <div>
                <a
                  className="mono"
                  href="https://explore.tempo.xyz/address/0x1313219a547CB472dBc56F97E3C2cF273a0F511B"
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 13 }}
                >
                  0x1313219a547CB472dBc56F97E3C2cF273a0F511B
                </a>
              </div>
              <div className="muted" style={{ fontSize: 12 }}>Stores P-256 encryption public keys per address</div>
            </div>
            <div>
              <span style={{ fontWeight: 600 }}>MemoStore</span>
              <div>
                <a
                  className="mono"
                  href="https://explore.tempo.xyz/address/0xBd7D26352E199a66DdC15DC54A8a2DC697D13491"
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 13 }}
                >
                  0xBd7D26352E199a66DdC15DC54A8a2DC697D13491
                </a>
              </div>
              <div className="muted" style={{ fontSize: 12 }}>Stores encrypted memo payloads (max 2048 bytes)</div>
            </div>
            <div>
              <span style={{ fontWeight: 600 }}>PublicMemoHeader</span>
              <div>
                <a
                  className="mono"
                  href="https://explore.tempo.xyz/address/0x6E43Da2CF11Fc48671c59de7aA18B981D8a67D59"
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 13 }}
                >
                  0x6E43Da2CF11Fc48671c59de7aA18B981D8a67D59
                </a>
              </div>
              <div className="muted" style={{ fontSize: 12 }}>Stores public memo metadata (purpose, parties, locator)</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 600, fontSize: 16 }}>Network Details</div>
          <div className="stack-sm" style={{ marginTop: 8 }}>
            <div><span style={{ fontWeight: 600 }}>Network</span> — Tempo Moderato Testnet</div>
            <div><span style={{ fontWeight: 600 }}>Chain ID</span> — 42431</div>
            <div><span style={{ fontWeight: 600 }}>RPC</span> — https://rpc.moderato.tempo.xyz</div>
            <div><span style={{ fontWeight: 600 }}>Explorer</span> — <a href="https://explore.tempo.xyz" target="_blank" rel="noreferrer">https://explore.tempo.xyz</a></div>
            <div><span style={{ fontWeight: 600 }}>Fee Token</span> — PathUSD (stablecoin gas)</div>
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 600, fontSize: 16 }}>Onchain Memo Schema</div>
          <pre className="memo-json">{`{
  "v": 1,
  "memoHash": "0x...",
  "sender": "0x...",
  "recipient": "0x...",
  "senderPubKey": "0x04...",
  "regulatorPubKey": "0x04...",
  "createdAt": "2026-01-15T12:00:00Z",
  "contentType": "application/json",
  "ivmsHash": "0x...",
  "token": {
    "address": "0x20c0...0001",
    "symbol": "AlphaUSD",
    "decimals": 6
  },
  "amountDisplay": "100.00",
  "keyAlg": "ECDH-P256",
  "kdf": "HKDF-SHA256",
  "enc": {
    "alg": "AES-256-GCM",
    "iv": "base64...",
    "ciphertext": "base64..."
  },
  "keys": [
    { "addr": "0x...", "iv": "...", "encKey": "..." },
    { "addr": "0x...", "iv": "...", "encKey": "..." },
    { "addr": "0x...", "iv": "...", "encKey": "..." }
  ]
}`}</pre>
          <div className="muted" style={{ marginTop: 8 }}>
            Total size: ~1.8KB. The <code>keys</code> array contains wrapped data keys for sender,
            recipient, and regulator. Each party can decrypt using their private key + ECDH.
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 600, fontSize: 16 }}>Public Header Schema</div>
          <pre className="memo-json">{`{
  "purpose": "Payroll",
  "locatorType": 0,  // 0=OnChain, 1=OffChain
  "locatorHash": "0x...",
  "locatorUrl": "",
  "contentHash": "0x...",
  "signature": "0x",
  "sender": {
    "addr": "0x...",
    "identifier": "alice@company.com"
  },
  "recipient": {
    "addr": "0x...",
    "identifier": "bob@bank.com"
  },
  "version": "TempoMemoStandard::Version1",
  "createdAt": 1736942400
}`}</pre>
        </div>

        <div className="card">
          <div style={{ fontWeight: 600, fontSize: 16 }}>Contract Functions</div>
          <div className="stack-sm" style={{ marginTop: 8 }}>
            <div style={{ fontWeight: 600 }}>PublicKeyRegistry</div>
            <div className="muted mono" style={{ fontSize: 12 }}>setKey(bytes key, uint8 keyType, uint32 version)</div>
            <div className="muted mono" style={{ fontSize: 12 }}>getKey(address) → (bytes, uint8, uint32)</div>

            <div style={{ fontWeight: 600, marginTop: 8 }}>MemoStore</div>
            <div className="muted mono" style={{ fontSize: 12 }}>putMemo(bytes32 hash, bytes data, address sender, address recipient)</div>
            <div className="muted mono" style={{ fontSize: 12 }}>getMemo(bytes32) → (bytes, address, address, uint64)</div>
            <div className="muted mono" style={{ fontSize: 12 }}>deleteMemo(bytes32) — recipient only</div>

            <div style={{ fontWeight: 600, marginTop: 8 }}>PublicMemoHeader</div>
            <div className="muted mono" style={{ fontSize: 12 }}>createMemoHeader(CreateParams params) — sender only</div>
            <div className="muted mono" style={{ fontSize: 12 }}>getMemoHeader(bytes32) → PublicMemo</div>
            <div className="muted mono" style={{ fontSize: 12 }}>deleteMemoHeader(bytes32) — sender or recipient</div>
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 600, fontSize: 16 }}>Security Notes</div>
          <div className="muted" style={{ marginTop: 8 }}>
            <strong>Demo Only:</strong> The regulator private key is exposed client-side for demonstration.
            In production, regulator decryption should happen server-side with proper authentication,
            audit logging, and access controls.
          </div>
          <div className="muted" style={{ marginTop: 8 }}>
            <strong>Key Storage:</strong> User encryption keys are stored in browser localStorage.
            For production use, consider hardware security modules or secure key management services.
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 600, fontSize: 16 }}>Source Code</div>
          <div className="muted" style={{ marginTop: 8 }}>
            <a href="https://github.com/malleshpai/tempo-memo-demo" target="_blank" rel="noreferrer">
              github.com/malleshpai/tempo-memo-demo
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
