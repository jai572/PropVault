import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib'

export interface PRTData {
  // Tenancy reference (auto-generated, passed in after DB insert)
  tenancyReference: string
  // Landlord / legal entity
  landlordName: string
  landlordRegistrationNumber: string | null
  landlordCouncilArea: string | null
  landlordAddress: string
  // Property
  propertyAddress: string
  isHmo: boolean
  hmoLicenceNumber: string | null
  hmoLicenceExpiry: string | null
  // Tenant
  tenantName: string
  tenantEmail: string
  // Tenancy terms
  startDate: string         // ISO date
  rentAmount: number        // £ per month
  rentDueDay: number        // 1–28
  depositAmount: number | null
  depositScheme: string | null
  depositReference: string | null
  roomReference: string | null
}

// ─── Layout constants ────────────────────────────────────────────────────────

const MARGIN = 56
const PAGE_WIDTH  = 595.28  // A4
const PAGE_HEIGHT = 841.89  // A4
const BODY_WIDTH  = PAGE_WIDTH - MARGIN * 2

const FONT_SIZE_TITLE   = 16
const FONT_SIZE_HEADING = 12
const FONT_SIZE_BODY    = 10
const FONT_SIZE_SMALL   =  8

const BLACK  = rgb(0, 0, 0)
const GRAY   = rgb(0.4, 0.4, 0.4)
const LGRAY  = rgb(0.85, 0.85, 0.85)

// ─── Cursor / page helpers ──────────────────────────────────────────────────

interface Ctx {
  doc:     PDFDocument
  pages:   PDFPage[]
  regular: PDFFont
  bold:    PDFFont
  y:       number
}

function currentPage(ctx: Ctx) { return ctx.pages[ctx.pages.length - 1] }

function addPage(ctx: Ctx) {
  const page = ctx.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  ctx.pages.push(page)
  ctx.y = PAGE_HEIGHT - MARGIN
}

function ensureSpace(ctx: Ctx, needed: number) {
  if (ctx.y - needed < MARGIN) addPage(ctx)
}

function drawText(
  ctx: Ctx,
  text: string,
  opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; indent?: number; lineHeight?: number } = {}
) {
  const font       = opts.font ?? ctx.regular
  const size       = opts.size ?? FONT_SIZE_BODY
  const color      = opts.color ?? BLACK
  const indent     = opts.indent ?? 0
  const lineHeight = opts.lineHeight ?? size * 1.45

  const maxWidth = BODY_WIDTH - indent
  const words = text.split(' ')
  let line = ''

  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    const testWidth = font.widthOfTextAtSize(test, size)
    if (testWidth > maxWidth && line) {
      ensureSpace(ctx, lineHeight)
      currentPage(ctx).drawText(line, { x: MARGIN + indent, y: ctx.y, size, font, color })
      ctx.y -= lineHeight
      line = word
    } else {
      line = test
    }
  }

  if (line) {
    ensureSpace(ctx, lineHeight)
    currentPage(ctx).drawText(line, { x: MARGIN + indent, y: ctx.y, size, font, color })
    ctx.y -= lineHeight
  }
}

function gap(ctx: Ctx, amount = 8) { ctx.y -= amount }

function rule(ctx: Ctx) {
  ensureSpace(ctx, 12)
  currentPage(ctx).drawLine({
    start: { x: MARGIN, y: ctx.y },
    end:   { x: MARGIN + BODY_WIDTH, y: ctx.y },
    thickness: 0.5,
    color: LGRAY,
  })
  ctx.y -= 10
}

function sectionHeading(ctx: Ctx, text: string) {
  gap(ctx, 14)
  ensureSpace(ctx, 24)
  drawText(ctx, text, { font: ctx.bold, size: FONT_SIZE_HEADING })
  gap(ctx, 4)
  rule(ctx)
}

function termHeading(ctx: Ctx, label: string) {
  gap(ctx, 10)
  ensureSpace(ctx, 16)
  drawText(ctx, label, { font: ctx.bold, size: FONT_SIZE_BODY })
  gap(ctx, 2)
}

function kv(ctx: Ctx, key: string, value: string) {
  ensureSpace(ctx, 14)
  const page = currentPage(ctx)
  page.drawText(key, { x: MARGIN, y: ctx.y, size: FONT_SIZE_BODY, font: ctx.bold, color: GRAY })
  page.drawText(value, { x: MARGIN + 180, y: ctx.y, size: FONT_SIZE_BODY, font: ctx.regular, color: BLACK })
  ctx.y -= FONT_SIZE_BODY * 1.6
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtMoney(amount: number) {
  return `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

// ─── Main export ────────────────────────────────────────────────────────────

export async function generatePRT(data: PRTData): Promise<Uint8Array> {
  const doc     = await PDFDocument.create()
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold    = await doc.embedFont(StandardFonts.HelveticaBold)

  const ctx: Ctx = { doc, pages: [], regular, bold, y: 0 }
  addPage(ctx)

  // ── Cover / title ────────────────────────────────────────────────────────
  ctx.y = PAGE_HEIGHT - MARGIN - 10
  drawText(ctx, 'PRIVATE RESIDENTIAL TENANCY AGREEMENT', { font: bold, size: FONT_SIZE_TITLE })
  drawText(ctx, 'Private Housing (Tenancies) (Scotland) Act 2016', { size: FONT_SIZE_SMALL, color: GRAY })
  gap(ctx, 4)
  drawText(ctx, `Tenancy Reference: ${data.tenancyReference}`, { font: bold, size: FONT_SIZE_BODY })
  gap(ctx, 4)
  rule(ctx)
  drawText(ctx, 'This agreement is a Private Residential Tenancy as defined by the Private Housing (Tenancies) (Scotland) Act 2016 and incorporates the statutory terms set out in the Mandatory Clauses of the Private Residential Tenancy (Statutory Terms) (Scotland) Regulations 2017.', { size: FONT_SIZE_SMALL, color: GRAY })

  // ── PART 1 — TENANCY DETAILS ────────────────────────────────────────────
  sectionHeading(ctx, 'PART 1 — TENANCY DETAILS')

  termHeading(ctx, '1. The Parties')
  kv(ctx, 'Landlord', data.landlordName)
  if (data.landlordRegistrationNumber) kv(ctx, 'Landlord Reg. No.', data.landlordRegistrationNumber)
  if (data.landlordCouncilArea)        kv(ctx, 'Council Area',      data.landlordCouncilArea)
  kv(ctx, 'Landlord Address', data.landlordAddress)
  kv(ctx, 'Tenant', data.tenantName)
  kv(ctx, 'Tenant Email', data.tenantEmail)

  termHeading(ctx, '2. The Property')
  kv(ctx, 'Address', data.propertyAddress)
  if (data.roomReference)    kv(ctx, 'Room / Unit',    data.roomReference)
  if (data.isHmo)            kv(ctx, 'HMO Property',   'Yes')
  if (data.hmoLicenceNumber) kv(ctx, 'HMO Licence No.', data.hmoLicenceNumber)
  if (data.hmoLicenceExpiry) kv(ctx, 'HMO Licence Expiry', fmtDate(data.hmoLicenceExpiry))

  termHeading(ctx, '3. Term')
  kv(ctx, 'Start Date', fmtDate(data.startDate))
  kv(ctx, 'End Date', 'Open-ended — no fixed end date (Private Residential Tenancy)')

  termHeading(ctx, '4. Rent')
  kv(ctx, 'Monthly Rent', fmtMoney(data.rentAmount))
  kv(ctx, 'Payment Due', `${ordinal(data.rentDueDay)} of each calendar month`)

  termHeading(ctx, '5. Deposit')
  if (data.depositAmount) {
    kv(ctx, 'Deposit Amount', fmtMoney(data.depositAmount))
    kv(ctx, 'Protection Scheme', data.depositScheme ?? 'To be confirmed')
    if (data.depositReference) kv(ctx, 'Scheme Reference', data.depositReference)
    gap(ctx, 4)
    drawText(ctx, 'The landlord must register the deposit with a Scottish Government-approved tenancy deposit scheme within 30 working days of the start of the tenancy.', { size: FONT_SIZE_SMALL, color: GRAY, indent: 0 })
  } else {
    kv(ctx, 'Deposit', 'No deposit required')
  }

  // ── PART 2 — MANDATORY STATUTORY TERMS ─────────────────────────────────
  sectionHeading(ctx, 'PART 2 — MANDATORY STATUTORY TERMS')
  gap(ctx, 2)
  drawText(ctx, 'The following terms are the statutory terms prescribed by the Mandatory Clauses of the Private Residential Tenancy (Statutory Terms) (Scotland) Regulations 2017 (SSI 2017/407). They apply to every Private Residential Tenancy and cannot be varied or excluded.', { size: FONT_SIZE_SMALL, color: GRAY })

  // Term 1 — Rent
  termHeading(ctx, 'Term 1 — Rent')
  drawText(ctx, `1(1) The tenant must pay to the landlord a rent of ${fmtMoney(data.rentAmount)} per month.`)
  gap(ctx, 4)
  drawText(ctx, `1(2) The rent is payable on the ${ordinal(data.rentDueDay)} day of each calendar month.`)
  gap(ctx, 4)
  drawText(ctx, '1(3) The landlord must provide a receipt for any rent paid in cash if the tenant requests one.')

  // Term 2 — Rent increases
  termHeading(ctx, 'Term 2 — Rent Increases')
  drawText(ctx, '2(1) The landlord may increase the rent by giving the tenant at least 3 months\' written notice of the increase.')
  gap(ctx, 4)
  drawText(ctx, '2(2) The landlord may not increase the rent more than once in any 12-month period.')
  gap(ctx, 4)
  drawText(ctx, '2(3) The tenant may refer a rent increase to a rent officer for adjudication under section 24 of the Private Housing (Tenancies) (Scotland) Act 2016.')

  // Term 3 — Tenant's right of possession
  termHeading(ctx, 'Term 3 — Tenant\'s Right of Possession')
  drawText(ctx, '3(1) The landlord must ensure that the tenant has possession of the let property on the start date.')
  gap(ctx, 4)
  drawText(ctx, '3(2) The landlord must not interfere with the tenant\'s peaceful enjoyment of the let property.')

  // Term 4 — Repairs and maintenance
  termHeading(ctx, 'Term 4 — Repairs and Maintenance')
  drawText(ctx, '4(1) The landlord must keep the let property, and any installations in it for the supply of water, gas, electricity, sanitation, space heating, and water heating, in repair and proper working order.')
  gap(ctx, 4)
  drawText(ctx, '4(2) The tenant must allow the landlord (or anyone authorised by the landlord) access to carry out repairs, inspections, or safety checks, provided that the landlord gives at least 24 hours\' written notice, except in an emergency.')
  gap(ctx, 4)
  drawText(ctx, '4(3) The tenant must report to the landlord any defect or disrepair in the let property as soon as they become aware of it.')
  gap(ctx, 4)
  drawText(ctx, '4(4) The tenant must not carry out any alterations, additions, or improvements to the let property without the prior written consent of the landlord.')

  // Term 5 — Care of the property
  termHeading(ctx, 'Term 5 — Care of Property')
  drawText(ctx, '5(1) The tenant must take reasonable care of the let property and its contents, and must not cause, or allow, the let property or its contents to be damaged beyond fair wear and tear.')
  gap(ctx, 4)
  drawText(ctx, '5(2) The tenant must keep the interior of the let property in a clean and tidy condition.')
  gap(ctx, 4)
  drawText(ctx, '5(3) The tenant is responsible for maintaining the garden (if any) of the let property in a reasonable condition unless the tenancy agreement provides otherwise.')

  // Term 6 — Utilities and council tax
  termHeading(ctx, 'Term 6 — Utilities and Council Tax')
  drawText(ctx, '6(1) Unless the tenancy agreement provides otherwise, the tenant is responsible for paying all charges in respect of any electricity, gas, telephony, broadband, and other utilities used at the let property during the tenancy.')
  gap(ctx, 4)
  drawText(ctx, '6(2) Unless the tenancy agreement provides otherwise, the tenant is responsible for paying council tax during the tenancy.')

  // Term 7 — Subletting and assignation
  termHeading(ctx, 'Term 7 — Subletting and Assignation')
  drawText(ctx, '7(1) The tenant must not sublet the let property, or any part of it, or assign the tenancy without the prior written consent of the landlord.')
  gap(ctx, 4)
  drawText(ctx, '7(2) The landlord must not unreasonably refuse consent. If the landlord refuses, the reasons must be given in writing.')

  // Term 8 — Conduct and use
  termHeading(ctx, 'Term 8 — Conduct and Use')
  drawText(ctx, '8(1) The tenant must not use the let property, or allow it to be used, for any illegal or immoral purpose.')
  gap(ctx, 4)
  drawText(ctx, '8(2) The tenant must not behave, or allow anyone living in or visiting the let property to behave, in an antisocial manner in the let property or in the locality of the let property. Antisocial behaviour means conduct that is, or is likely to be, a nuisance or annoyance to any person.')

  // Term 9 — Abandonment
  termHeading(ctx, 'Term 9 — Abandonment')
  drawText(ctx, '9(1) If the landlord reasonably believes that the let property has been abandoned by the tenant, the landlord may, after following the procedure set out in sections 21 to 23 of the Private Housing (Tenancies) (Scotland) Act 2016, repossess the let property.')

  // Term 10 — Ending the tenancy by the tenant
  termHeading(ctx, 'Term 10 — Ending the Tenancy by the Tenant')
  drawText(ctx, '10(1) The tenant may end the tenancy by giving the landlord not less than 28 days\' written notice of the date on which the tenant intends the tenancy to end.')
  gap(ctx, 4)
  drawText(ctx, '10(2) The notice must be in writing and signed by the tenant.')

  // Term 11 — Ending the tenancy by the landlord
  termHeading(ctx, 'Term 11 — Ending the Tenancy by the Landlord (Eviction)')
  drawText(ctx, '11(1) The landlord may apply to the First-tier Tribunal for Scotland (Housing and Property Chamber) to end this tenancy only on one or more of the grounds for eviction set out in schedule 3 of the Private Housing (Tenancies) (Scotland) Act 2016.')
  gap(ctx, 4)
  drawText(ctx, '11(2) The landlord must serve a Notice to Leave on the tenant before making an application to the Tribunal. The notice period is at least 28 days if the tenant has been in occupation for 6 months or less, or at least 84 days if the tenant has been in occupation for more than 6 months, unless the ground for eviction specifies a different notice period.')
  gap(ctx, 4)
  drawText(ctx, '11(3) The landlord cannot end this tenancy without an order from the First-tier Tribunal for Scotland (Housing and Property Chamber), except where the tenant voluntarily gives up possession.')

  // Term 12 — Information and documents
  termHeading(ctx, 'Term 12 — Information and Documents')
  drawText(ctx, '12(1) The landlord must give the tenant a copy of the Easy Read Notes for the Scottish Government Model Private Residential Tenancy Agreement at or before the start of the tenancy.')
  gap(ctx, 4)
  drawText(ctx, '12(2) The landlord must provide the tenant with the landlord\'s contact details, or the contact details of any letting agent acting for the landlord, within 28 days of the start of the tenancy.')

  // ── PART 3 — SIGNATURES ─────────────────────────────────────────────────
  sectionHeading(ctx, 'PART 3 — SIGNATURES')
  gap(ctx, 4)
  drawText(ctx, 'By signing below the parties confirm they have read and agree to the terms of this tenancy agreement.')
  gap(ctx, 20)

  const sigY = ctx.y
  ensureSpace(ctx, 80)
  const page = currentPage(ctx)

  // Landlord sig block
  page.drawLine({ start: { x: MARGIN, y: sigY - 20 }, end: { x: MARGIN + 200, y: sigY - 20 }, thickness: 0.5, color: BLACK })
  page.drawText('Landlord / Authorised Agent signature', { x: MARGIN, y: sigY - 34, size: FONT_SIZE_SMALL, font: regular, color: GRAY })
  page.drawLine({ start: { x: MARGIN, y: sigY - 50 }, end: { x: MARGIN + 100, y: sigY - 50 }, thickness: 0.5, color: BLACK })
  page.drawText('Date', { x: MARGIN, y: sigY - 64, size: FONT_SIZE_SMALL, font: regular, color: GRAY })

  // Tenant sig block
  page.drawLine({ start: { x: MARGIN + 260, y: sigY - 20 }, end: { x: MARGIN + 460, y: sigY - 20 }, thickness: 0.5, color: BLACK })
  page.drawText('Tenant signature', { x: MARGIN + 260, y: sigY - 34, size: FONT_SIZE_SMALL, font: regular, color: GRAY })
  page.drawLine({ start: { x: MARGIN + 260, y: sigY - 50 }, end: { x: MARGIN + 360, y: sigY - 50 }, thickness: 0.5, color: BLACK })
  page.drawText('Date', { x: MARGIN + 260, y: sigY - 64, size: FONT_SIZE_SMALL, font: regular, color: GRAY })

  ctx.y = sigY - 80

  // ── Footer on every page ─────────────────────────────────────────────────
  const totalPages = ctx.pages.length
  for (let i = 0; i < totalPages; i++) {
    const pg = ctx.pages[i]
    pg.drawText(
      `${data.tenancyReference}  ·  PropVault  ·  Page ${i + 1} of ${totalPages}`,
      { x: MARGIN, y: MARGIN - 16, size: FONT_SIZE_SMALL, font: regular, color: GRAY }
    )
  }

  return doc.save()
}
