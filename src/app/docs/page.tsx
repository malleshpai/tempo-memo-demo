'use client'

import React from 'react'
import { AppShell } from '../../../components/AppShell'

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
            This demo shows Tempo TIP-20 transfers with reconciliation memos. It supports offchain
            IVMS data storage (hash onchain) and onchain encrypted memo storage with key sharing for
            sender, recipient, and regulator.
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 600 }}>User flows</div>
          <div className="stack-sm" style={{ marginTop: 8 }}>
            <div>
              <div style={{ fontWeight: 600 }}>1) Login</div>
              <div className="muted">
                Passkey login via Tempo accounts. Faucet funding is attempted during sign up.
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>2) Register encryption key</div>
              <div className="muted">
                Generates a local P-256 keypair and registers the public key onchain in the
                PublicKeyRegistry. The private key is stored in localStorage per address.
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>3) Send memo transfer</div>
              <div className="muted">
                Fill destination, token, amount, and IVMS data (upload or form). The app computes
                a canonical IVMS JSON string, hashes it, and uses it as the TIP-20 transfer memo.
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>4) Offchain memo</div>
              <div className="muted">
                If onchain encryption is off, the IVMS payload + files are stored in Vercel Blob.
                The memo hash is used as the locator.
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>5) Onchain encrypted memo</div>
              <div className="muted">
                If enabled, the IVMS payload is encrypted with a one-time symmetric key. The
                symmetric key is wrapped to sender, recipient, and regulator using ECDH-P256 +
                HKDF-SHA256. The encrypted JSON is stored onchain in MemoStore and referenced by
                the same memo hash used in transferWithMemo.
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>6) View memo</div>
              <div className="muted">
                Navigate to /0x... (memo hash). If you are sender or recipient, the app can decrypt the
                onchain memo (or show the offchain memo if stored).
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>7) Regulator access</div>
              <div className="muted">
                /regulator is password-protected and can decrypt any onchain memo that includes the
                regulator key entry.
              </div>
            </div>
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
}`}
          </pre>
          <div className="muted">
            The JSON is encoded and stored as bytes in MemoStore. Max size is 2048 bytes.
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 600 }}>Smart contracts</div>
          <div className="stack-sm" style={{ marginTop: 8 }}>
            <div><span style={{ fontWeight: 600 }}>PublicKeyRegistry</span> — stores encryption keys per address.</div>
            <div className="muted">
              setKey(bytes key, uint8 keyType, uint32 version) — registers a public key.
            </div>
            <div className="muted">
              getKey(address owner) returns (bytes key, uint8 keyType, uint32 version).
            </div>
            <div><span style={{ fontWeight: 600 }}>MemoStore</span> — stores encrypted memo blobs by memo hash.</div>
            <div className="muted">
              putMemo(bytes32 memoHash, bytes data, address sender, address recipient).
            </div>
            <div className="muted">
              deleteMemo(bytes32 memoHash) — only recipient can delete.
            </div>
            <div className="muted">
              getMemo(bytes32 memoHash) returns (bytes data, address sender, address recipient, uint64 createdAt).
            </div>
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
            Regulator private key is currently exposed to the client for demo purposes. In a
            production deployment this should move server-side and be protected by proper auth.
          </div>
        </div>
      </div>
    </div>
  )
}
