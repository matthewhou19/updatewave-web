/**
 * render-report-pdf.ts — Print an HTML report to PDF via headless Chromium.
 *
 * Usage:
 *   npx tsx scripts/render-report-pdf.ts <input.html> <output.pdf>
 *
 * Example (SJ report):
 *   npx tsx scripts/render-report-pdf.ts \
 *     "F:/Github/updatewave/2025_sanjose_新建房屋报告.html" \
 *     ./dist/sj-2025.pdf
 *
 * Then upload the PDF to Supabase Storage:
 *   1. Open the Supabase dashboard → Storage → city-lists-pdfs bucket
 *   2. Upload `./dist/sj-2025.pdf` as `sj-2025.pdf`
 *   (matches the seed value in migration 002 city_lists.pdf_storage_path)
 *
 * Uses Playwright (already a dev dependency) to render in Chromium with
 * letter-size pages and screen media so CSS layouts render the same as
 * the browser preview.
 */
import { chromium } from '@playwright/test'
import { existsSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { pathToFileURL } from 'url'

async function main() {
  const [, , inputArg, outputArg] = process.argv

  if (!inputArg || !outputArg) {
    console.error('Usage: tsx scripts/render-report-pdf.ts <input.html> <output.pdf>')
    process.exit(1)
  }

  const inputPath = resolve(inputArg)
  const outputPath = resolve(outputArg)

  if (!existsSync(inputPath)) {
    console.error(`Input not found: ${inputPath}`)
    process.exit(1)
  }

  const outputDir = dirname(outputPath)
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }

  const inputUrl = pathToFileURL(inputPath).toString()
  console.log(`Rendering ${inputUrl}`)
  console.log(`Output:    ${outputPath}`)

  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()

    await page.goto(inputUrl, { waitUntil: 'networkidle', timeout: 30_000 })
    await page.emulateMedia({ media: 'screen' })

    await page.pdf({
      path: outputPath,
      format: 'Letter',
      printBackground: true,
      margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
      preferCSSPageSize: false,
    })
  } finally {
    await browser.close()
  }
  console.log(`Done. PDF written to ${outputPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
