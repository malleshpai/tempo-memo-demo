'use client'

import React from 'react'
import { AppShell } from '../../components/AppShell'

export default function DocsPage() {
  return (
    <AppShell
      title="Docs"
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
        <h3 className="panel-title">Tempo Memo Demo Docs</h3>
      </div>

      <div className="stack-md" style={{ marginTop: 12 }}>
        <div className="card">
          <div style={{ fontWeight: 600 }}>Overview</div>
          <div className="muted" style={{ marginTop: 8 }}>
            Tempo Memo lets you send TIP-20 transfers with travel rule metadata. Each transfer
            uses a memo hash, and the memo data can be stored offchain (Blob) or encrypted onchain.
            Memo links are shareable via /0x... and only the sender or recipient can decrypt.
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 600 }}>Quick start</div>
          <div className="stack-sm" style={{ marginTop: 8 }}>
            <div>
              <div style={{ fontWeight: 600 }}>1) Log in</div>
              <div className="muted">Passkey login through Tempo accounts. Sign up attempts a faucet fund.</div>
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>2) Register</div>
              <div className="muted">
                In the Register tab, generate and register your P-256 encryption key. This is required
                for onchain encrypted memos and stored locally per address.
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>3) Send</div>
              <div className="muted">
                Enter destination, token, amount, and IVMS data (upload or form). The app hashes the
                canonical IVMS payload into a 32-byte memo that goes into transferWithMemo.
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>4) Share</div>
              <div className="muted">
                Use the memo hash URL /0x... to open the memo viewer. Sender or recipient can verify
                and decrypt the memo.
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 600 }}>App modes</div>
          <div className="stack-sm" style={{ marginTop: 8 }}>
            <div><span style={{ fontWeight: 600 }}>Send</span> — create transfers, attach IVMS, and choose onchain vs offchain.</div>
            <div><span style={{ fontWeight: 600 }}>Register</span> — generate + register your encryption key for onchain memos.</div>
            <div><span style={{ fontWeight: 600 }}>Memo Vault</span> — browse incoming/outgoing memos with filters and onchain lookup.</div>
            <div><span style={{ fontWeight: 600 }}>Regulator mode</span> — password-protected access to onchain memos (and offchain list).</div>
            <div><span style={{ fontWeight: 600 }}>Docs</span> — this page.</div>
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 600 }}>Onchain vs offchain</div>
          <div className="stack-sm" style={{ marginTop: 8 }}>
            <div><span style={{ fontWeight: 600 }}>Offchain</span> — IVMS payload + files are stored in Vercel Blob. The onchain transfer memo is the hash only.</div>
            <div><span style={{ fontWeight: 600 }}>Onchain encrypted</span> — the IVMS payload is encrypted with a one-time symmetric key, and the encrypted JSON is stored in MemoStore (max 2048 bytes).</div>
            <div><span style={{ fontWeight: 600 }}>Key sharing</span> — the symmetric key is wrapped for sender, recipient, and regulator using ECDH-P256 + HKDF-SHA256.</div>
            <div><span style={{ fontWeight: 600 }}>Invoice PDF</span> — supported offchain only.</div>
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 600 }}>Vault and indexing</div>
          <div className="stack-sm" style={{ marginTop: 8 }}>
            <div>
              <div className="muted">
                The vault reads summaries from Blob. The indexer writes summaries for sender, recipient,
                and regulator when it scans onchain memos.
              </div>
            </div>
            <div><span style={{ fontWeight: 600 }}>Fetch latest memos</span> — manual refresh runs the indexer since last run (or last day).</div>
            <div><span style={{ fontWeight: 600 }}>Daily cron</span> — an auto indexer runs once per day on Vercel.</div>
            <div><span style={{ fontWeight: 600 }}>Filters</span> — source, sender, asset, amount range, and date range.</div>
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 600 }}>Transfer parameters</div>
          <div className="stack-sm" style={{ marginTop: 8 }}>
            <div><span style={{ fontWeight: 600 }}>to</span> — destination address.</div>
            <div><span style={{ fontWeight: 600 }}>token</span> — TIP-20 token address and symbol.</div>
            <div><span style={{ fontWeight: 600 }}>amount</span> — display amount, converted to base units.</div>
            <div><span style={{ fontWeight: 600 }}>memo</span> — 32-byte hash of canonicalized IVMS payload.</div>
            <div><span style={{ fontWeight: 600 }}>ivmsPayload</span> — IVMS data JSON or text.</div>
            <div><span style={{ fontWeight: 600 }}>ivmsCanonical</span> — canonical JSON string used for hashing.</div>
            <div><span style={{ fontWeight: 600 }}>invoice</span> — optional PDF attachment (offchain only).</div>
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 600 }}>Onchain memo schema</div>
          <pre className="memo-json">{`{
  v: 1,
  memoHash: 0x...,
  sender: 0x...,
  recipient: 0x...,
  senderPubKey: 0x...,
  regulatorPubKey: 0x...,
  createdAt: ISO8601,
  contentType: "application/json",
  ivmsHash: 0x...,
  token: { address, symbol, decimals },
  amountDisplay: "...",
  keyAlg: "ECDH-P256",
  kdf: "HKDF-SHA256",
  enc: { alg: "AES-256-GCM", iv, ciphertext },
  keys: [
    { addr, iv, encKey } // sender
    { addr, iv, encKey } // recipient
    { addr, iv, encKey } // regulator (optional)
  ]
}`}</pre>
          <div className="muted">The JSON is encoded and stored as bytes in MemoStore. Max size is 2048 bytes.</div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 600 }}>Deployed addresses (Tempo Testnet)</div>
          <div className="stack-sm" style={{ marginTop: 8 }}>
            <div>
              <span style={{ fontWeight: 600 }}>PublicKeyRegistry</span> —
              <a href="https://explore.tempo.xyz/address/0x02F64DEbd94560Bfb29B0c12246819AD4388156d?tab=contract&live=false" target="_blank" rel="noreferrer">
                0x02F64DEbd94560Bfb29B0c12246819AD4388156d
              </a>
            </div>
            <div>
              <span style={{ fontWeight: 600 }}>MemoStore</span> —
              <a href="https://explore.tempo.xyz/address/0x639223E5224Eae37e68FC390974bFB88Be7422B8?tab=contract&live=false" target="_blank" rel="noreferrer">
                0x639223E5224Eae37e68FC390974bFB88Be7422B8
              </a>
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 600 }}>Smart contracts</div>
          <div className="stack-sm" style={{ marginTop: 8 }}>
            <div><span style={{ fontWeight: 600 }}>PublicKeyRegistry</span> — stores encryption keys per address.</div>
            <div className="muted">setKey(bytes key, uint8 keyType, uint32 version) — registers a public key.</div>
            <div className="muted">getKey(address owner) returns (bytes key, uint8 keyType, uint32 version).</div>
            <div><span style={{ fontWeight: 600 }}>MemoStore</span> — stores encrypted memo blobs by memo hash.</div>
            <div className="muted">putMemo(bytes32 memoHash, bytes data, address sender, address recipient).</div>
            <div className="muted">deleteMemo(bytes32 memoHash) — only recipient can delete.</div>
            <div className="muted">getMemo(bytes32 memoHash) returns (bytes data, address sender, address recipient, uint64 createdAt).</div>
            <div className="muted">MAX_MEMO_BYTES = 2048.</div>
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 600 }}>Environment variables</div>
          <div className="stack-sm" style={{ marginTop: 8 }}>
            <div><span style={{ fontWeight: 600 }}>NEXT_PUBLIC_PUBLIC_KEY_REGISTRY_ADDRESS</span></div>
            <div><span style={{ fontWeight: 600 }}>NEXT_PUBLIC_MEMO_STORE_ADDRESS</span></div>
            <div><span style={{ fontWeight: 600 }}>NEXT_PUBLIC_REGULATOR_PUBLIC_KEY_HEX</span></div>
            <div><span style={{ fontWeight: 600 }}>NEXT_PUBLIC_REGULATOR_ADDRESS</span></div>
            <div><span style={{ fontWeight: 600 }}>NEXT_PUBLIC_REGULATOR_PRIVATE_KEY_JWK</span> (demo only)</div>
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 600 }}>Security notes</div>
          <div className="muted" style={{ marginTop: 8 }}>
            The regulator private key is exposed to the client for demo purposes only. In production,
            it should be protected server-side with proper authentication and access controls.
          </div>
        </div>
      </div>
    </div>
  )
}
