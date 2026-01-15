#!/usr/bin/env npx tsx
import { list, del } from '@vercel/blob'

async function clearAllBlobs() {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) {
    console.log('No BLOB_READ_WRITE_TOKEN found in environment.')
    console.log('Run: vercel env pull')
    process.exit(1)
  }

  console.log('Listing all blobs...')
  let cursor: string | undefined
  let totalDeleted = 0

  do {
    const result = await list({ token, cursor, limit: 1000 })
    console.log(`Found ${result.blobs.length} blobs in this batch`)

    if (result.blobs.length > 0) {
      const urls = result.blobs.map(b => b.url)
      await del(urls, { token })
      totalDeleted += urls.length
      console.log(`Deleted ${urls.length} blobs`)
    }

    cursor = result.cursor
  } while (cursor)

  console.log(`\nTotal deleted: ${totalDeleted} blobs`)
  console.log('Blob store is now empty.')
}

clearAllBlobs().catch(console.error)
