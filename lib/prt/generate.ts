import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib'

export interface PRTData {
  tenancyReference: string
  landlordName: string
  landlordRegistrationNumber: string | null
  landlordCouncilArea: string | null
  landlordAddress: string
  propertyAddress: string
  isHmo: boolean
  hmoLicenceNumber: string | null
  hmoLicenceExpiry: string | null
  tenantName: string
  tenantEmail: string
  startDate: string
  rentAmount: number
  rentDueDay: number
  depositAmount: number | null
  depositScheme: string | null
  depositReference: string | null
  roomReference: string | null
}

// ─── Layout constants ────────────────────────────────────────────────────────

const MARGIN      = 60
const PAGE_WIDTH  = 595.28
const PAGE_HEIGHT = 841.89
const BODY_WIDTH  = PAGE_WIDTH - MARGIN * 2

const FS_TITLE   = 15
const FS_H1      = 12
const FS_BODY    = 9.5
const FS_SMALL   = 8

const BLACK = rgb(0, 0, 0)
const GRAY  = rgb(0.45, 0.45, 0.45)
const LGRAY = rgb(0.82, 0.82, 0.82)

// ─── Cursor helpers ──────────────────────────────────────────────────────────

interface Ctx { doc: PDFDocument; pages: PDFPage[]; regular: PDFFont; bold: PDFFont; y: number }

const page  = (ctx: Ctx) => ctx.pages[ctx.pages.length - 1]

function newPage(ctx: Ctx) {
  ctx.pages.push(ctx.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]))
  ctx.y = PAGE_HEIGHT - MARGIN
}

function need(ctx: Ctx, h: number) { if (ctx.y - h < MARGIN + 20) newPage(ctx) }

function text(
  ctx: Ctx,
  str: string,
  opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; x?: number; maxW?: number; lh?: number } = {}
) {
  const font  = opts.font  ?? ctx.regular
  const size  = opts.size  ?? FS_BODY
  const color = opts.color ?? BLACK
  const x     = opts.x    ?? MARGIN
  const maxW  = opts.maxW ?? BODY_WIDTH - (x - MARGIN)
  const lh    = opts.lh   ?? size * 1.5

  const words = str.split(' ')
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (font.widthOfTextAtSize(test, size) > maxW && line) {
      need(ctx, lh)
      page(ctx).drawText(line, { x, y: ctx.y, size, font, color })
      ctx.y -= lh
      line = w
    } else { line = test }
  }
  if (line) {
    need(ctx, lh)
    page(ctx).drawText(line, { x, y: ctx.y, size, font, color })
    ctx.y -= lh
  }
}

const gap  = (ctx: Ctx, n = 6) => { ctx.y -= n }

function rule(ctx: Ctx, weight = 0.4) {
  need(ctx, 8)
  page(ctx).drawLine({ start: { x: MARGIN, y: ctx.y }, end: { x: MARGIN + BODY_WIDTH, y: ctx.y }, thickness: weight, color: LGRAY })
  ctx.y -= 8
}

function h1(ctx: Ctx, str: string) {
  gap(ctx, 14)
  need(ctx, 22)
  text(ctx, str, { font: ctx.bold, size: FS_H1 })
  gap(ctx, 2)
  rule(ctx, 0.6)
}

function term(ctx: Ctx, label: string) {
  gap(ctx, 10)
  need(ctx, 14)
  text(ctx, label, { font: ctx.bold, size: FS_BODY })
  gap(ctx, 2)
}

function kv(ctx: Ctx, key: string, val: string) {
  const labelW = 175
  need(ctx, 14)
  page(ctx).drawText(key, { x: MARGIN,           y: ctx.y, size: FS_BODY, font: ctx.bold,    color: GRAY  })
  text(ctx, val, { x: MARGIN + labelW, maxW: BODY_WIDTH - labelW, size: FS_BODY, lh: FS_BODY * 1.45 })
  // text() already moved y; if it drew multiple lines the first line sits at old y
}

function clause(ctx: Ctx, num: string, body: string) {
  gap(ctx, 5)
  need(ctx, 14)
  const numW = ctx.bold.widthOfTextAtSize(num + ' ', FS_BODY)
  page(ctx).drawText(num, { x: MARGIN, y: ctx.y, size: FS_BODY, font: ctx.bold, color: BLACK })
  text(ctx, body, { x: MARGIN + numW + 4, maxW: BODY_WIDTH - numW - 4 })
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}
function fmtMoney(n: number) {
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function ordinal(n: number) {
  const s = ['th','st','nd','rd']; const v = n % 100
  return n + (s[(v-20)%10] ?? s[v] ?? s[0])
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generatePRT(data: PRTData): Promise<Uint8Array> {
  const doc     = await PDFDocument.create()
  doc.setTitle(`Private Residential Tenancy — ${data.tenancyReference}`)
  doc.setSubject('Scottish Government Model Private Residential Tenancy Agreement (April 2024)')

  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold    = await doc.embedFont(StandardFonts.HelveticaBold)
  const ctx: Ctx = { doc, pages: [], regular, bold, y: 0 }
  newPage(ctx)
  ctx.y = PAGE_HEIGHT - MARGIN - 8

  // ── COVER ─────────────────────────────────────────────────────────────────
  text(ctx, 'PRIVATE RESIDENTIAL TENANCY AGREEMENT', { font: bold, size: FS_TITLE })
  gap(ctx, 2)
  text(ctx, 'Scottish Government Model Agreement (April 2024 edition)', { size: FS_SMALL, color: GRAY })
  text(ctx, 'Private Housing (Tenancies) (Scotland) Act 2016', { size: FS_SMALL, color: GRAY })
  gap(ctx, 4)
  text(ctx, `Tenancy Reference: ${data.tenancyReference}`, { font: bold })
  gap(ctx, 6)
  rule(ctx, 1)
  gap(ctx, 2)
  text(ctx, 'This agreement sets out the terms of a private residential tenancy as defined by section 1 of the Private Housing (Tenancies) (Scotland) Act 2016. The statutory terms in Part 3 are mandatory and cannot be varied or excluded.', { size: FS_SMALL, color: GRAY })

  // ── PART 1 — THE PARTIES AND PROPERTY ─────────────────────────────────────
  h1(ctx, 'PART 1 — THE PARTIES AND PROPERTY')

  term(ctx, '1. Landlord')
  kv(ctx, 'Name / Entity', data.landlordName)
  if (data.landlordRegistrationNumber) kv(ctx, 'Landlord Reg. No.', data.landlordRegistrationNumber)
  if (data.landlordCouncilArea)        kv(ctx, 'Council Area',      data.landlordCouncilArea)
  kv(ctx, 'Address', data.landlordAddress)

  term(ctx, '2. Tenant(s)')
  kv(ctx, 'Full name', data.tenantName)
  kv(ctx, 'Email', data.tenantEmail)

  term(ctx, '3. The Let Property')
  kv(ctx, 'Address', data.propertyAddress)
  if (data.roomReference)    kv(ctx, 'Room / Unit',        data.roomReference)
  if (data.isHmo)            kv(ctx, 'HMO',                'Yes — House in Multiple Occupation')
  if (data.hmoLicenceNumber) kv(ctx, 'HMO Licence No.',    data.hmoLicenceNumber)
  if (data.hmoLicenceExpiry) kv(ctx, 'HMO Licence Expiry', fmtDate(data.hmoLicenceExpiry))

  term(ctx, '4. Term')
  kv(ctx, 'Start date', fmtDate(data.startDate))
  kv(ctx, 'End date', 'None — open-ended Private Residential Tenancy (no fixed term)')

  term(ctx, '5. Rent')
  kv(ctx, 'Monthly rent', fmtMoney(data.rentAmount))
  kv(ctx, 'Due', `On or before the ${ordinal(data.rentDueDay)} day of each calendar month`)

  term(ctx, '6. Deposit')
  if (data.depositAmount) {
    kv(ctx, 'Amount', fmtMoney(data.depositAmount))
    kv(ctx, 'Scheme', data.depositScheme ?? 'To be registered')
    if (data.depositReference) kv(ctx, 'Scheme Reference', data.depositReference)
    gap(ctx, 4)
    text(ctx, 'The landlord must register the deposit with an approved tenancy deposit scheme within 30 working days of the tenancy start date (Housing (Scotland) Act 2006, s.120).', { size: FS_SMALL, color: GRAY })
  } else {
    kv(ctx, 'Deposit', 'No deposit required')
  }

  // ── PART 2 — ADDITIONAL TERMS ─────────────────────────────────────────────
  h1(ctx, 'PART 2 — ADDITIONAL TERMS')
  gap(ctx, 2)
  text(ctx, 'The following terms are agreed between the landlord and tenant in addition to the statutory terms in Part 3. Additional terms must not contradict or attempt to exclude any statutory term.', { size: FS_SMALL, color: GRAY })
  gap(ctx, 12)
  // Blank space for additional terms to be written in by parties
  for (let i = 0; i < 6; i++) {
    need(ctx, 18)
    page(ctx).drawLine({ start: { x: MARGIN, y: ctx.y }, end: { x: MARGIN + BODY_WIDTH, y: ctx.y }, thickness: 0.3, color: LGRAY })
    ctx.y -= 18
  }

  // ── PART 3 — STATUTORY TERMS ───────────────────────────────────────────────
  h1(ctx, 'PART 3 — STATUTORY TERMS')
  gap(ctx, 2)
  text(ctx, 'These are the mandatory terms prescribed by the Mandatory Clauses of the Private Residential Tenancy (Statutory Terms) (Scotland) Regulations 2017 (SSI 2017/407) as applicable to this tenancy. They apply automatically to every Private Residential Tenancy and cannot be varied or excluded by agreement.', { size: FS_SMALL, color: GRAY })

  // ── Statutory Term 1 — Rent ──────────────────────────────────────────────
  term(ctx, 'Statutory Term 1 — Rent')
  clause(ctx, '1.', `The tenant must pay to the landlord the monthly rent of ${fmtMoney(data.rentAmount)}.`)
  clause(ctx, '2.', `The rent is payable monthly in advance on the ${ordinal(data.rentDueDay)} day of each calendar month.`)
  clause(ctx, '3.', 'The landlord must provide a receipt for any payment of rent if the tenant asks for one.')

  // ── Statutory Term 2 — Rent Increases ───────────────────────────────────
  term(ctx, 'Statutory Term 2 — Rent Increases')
  clause(ctx, '1.', 'The landlord may increase the rent by giving the tenant at least 3 months\' written notice of the increase.')
  clause(ctx, '2.', 'The rent may not be increased more than once in any 12-month period.')
  clause(ctx, '3.', 'The tenant may refer an increase to a rent officer for determination under section 24 of the Private Housing (Tenancies) (Scotland) Act 2016.')

  // ── Statutory Term 3 — Repairs and Maintenance ──────────────────────────
  term(ctx, 'Statutory Term 3 — Repairs and Maintenance')
  clause(ctx, '1.', 'The landlord must ensure that, at the start of the tenancy and throughout, the let property is: (a) wind and watertight and in all other respects reasonably fit for people to live in; (b) in a reasonable state of repair; and (c) in reasonable working order.')
  clause(ctx, '2.', 'The landlord must keep in repair and proper working order any installation in the let property for the supply of water, gas or electricity, and for space heating or heating water.')
  clause(ctx, '3.', 'The tenant must allow the landlord (or any person authorised by the landlord) reasonable access to the let property to carry out an inspection or to carry out works necessary to comply with any obligation under the tenancy or any enactment. The landlord must give the tenant at least 24 hours\' notice before accessing the let property, except in an emergency.')
  clause(ctx, '4.', 'The tenant must report to the landlord any defect in the let property as soon as the tenant becomes aware of it.')
  clause(ctx, '5.', 'The tenant must not carry out any alterations or improvements to the let property without the prior written consent of the landlord.')

  // ── Statutory Term 4 — Care of the Let Property ─────────────────────────
  term(ctx, 'Statutory Term 4 — Care of the Let Property')
  clause(ctx, '1.', 'The tenant must take reasonable care of the let property. The tenant must not cause, or allow any person in the let property to cause, the let property or any common parts to be damaged, or to deteriorate beyond fair wear and tear.')
  clause(ctx, '2.', 'The tenant must keep the let property and any furnishings in it in a clean and tidy condition throughout the tenancy, and must leave it in a clean and tidy condition at the end of the tenancy.')
  clause(ctx, '3.', 'At the end of the tenancy the tenant must remove all the tenant\'s belongings from the let property.')

  // ── Statutory Term 5 — Utility Charges and Council Tax ──────────────────
  term(ctx, 'Statutory Term 5 — Utility Charges and Council Tax')
  clause(ctx, '1.', 'Unless the tenancy agreement otherwise provides, the tenant is responsible for: (a) the payment of any charges for electricity, gas and other fuels, and for water, used in the let property; and (b) the payment of council tax in respect of the let property during the tenancy.')

  // ── Statutory Term 6 — Subletting and Assignation ───────────────────────
  term(ctx, 'Statutory Term 6 — Subletting and Assignation')
  clause(ctx, '1.', 'The tenant must not sublet the let property, or any part of it, or otherwise grant to any person the right to occupy the let property or any part of it (whether on a permanent or temporary basis) without the prior written consent of the landlord.')
  clause(ctx, '2.', 'The tenant must not assign the tenancy without the prior written consent of the landlord.')
  clause(ctx, '3.', 'The landlord must not unreasonably withhold consent for subletting or assignation. Where the landlord refuses consent, the landlord must give written reasons.')

  // ── Statutory Term 7 — Antisocial Behaviour ─────────────────────────────
  term(ctx, 'Statutory Term 7 — Antisocial Behaviour')
  clause(ctx, '1.', 'The tenant must not use the let property, or allow it to be used, for any immoral or illegal purpose.')
  clause(ctx, '2.', 'The tenant must not act in an antisocial manner, and must not allow any person living with the tenant or any visitor to the let property to act in an antisocial manner in relation to other occupants of the let property or persons residing in the locality.')
  clause(ctx, '3.', 'For the purposes of this term, behaviour is "antisocial" if the person engaging in the behaviour causes or is likely to cause alarm, distress, nuisance or annoyance to any person.')

  // ── Statutory Term 8 — Visits and Inspections ───────────────────────────
  term(ctx, 'Statutory Term 8 — Permission for Landlord to Enter')
  clause(ctx, '1.', 'The tenant must allow the landlord, or any person authorised by the landlord, reasonable access to the let property for the purposes of: (a) viewing the condition and state of repair of the let property; (b) carrying out any works required in order to comply with any obligation of the landlord under the tenancy; or (c) carrying out any works required by any enactment.')
  clause(ctx, '2.', 'The landlord must give the tenant at least 24 hours\' notice before accessing the let property except in the case of emergency.')

  // ── Statutory Term 9 — Abandoned Property ───────────────────────────────
  term(ctx, 'Statutory Term 9 — Abandoned Let Property')
  clause(ctx, '1.', 'If the tenant has abandoned the let property the landlord may repossess it without a tribunal order by following the procedure set out in sections 21 to 23 of the Private Housing (Tenancies) (Scotland) Act 2016.')

  // ── Statutory Term 10 — Ending the Tenancy (Tenant) ─────────────────────
  term(ctx, 'Statutory Term 10 — Ending the Tenancy by the Tenant')
  clause(ctx, '1.', 'The tenant may bring the tenancy to an end by giving the landlord written notice of not less than 28 days.')
  clause(ctx, '2.', 'A notice under this term must be in writing and signed by the tenant. A notice period of less than 28 days may be accepted by agreement between the landlord and tenant.')

  // ── Statutory Term 11 — Ending the Tenancy (Landlord) ───────────────────
  term(ctx, 'Statutory Term 11 — Ending the Tenancy by the Landlord')
  clause(ctx, '1.', 'The landlord may bring the tenancy to an end only by: (a) serving a Notice to Leave on the tenant; and (b) applying to the First-tier Tribunal for Scotland (Housing and Property Chamber) for an eviction order if the tenant does not leave.')
  clause(ctx, '2.', 'The Notice to Leave must state: (a) the ground or grounds for eviction (as set out in Schedule 3 to the Private Housing (Tenancies) (Scotland) Act 2016); (b) the notice period, which must be at least 28 days if the tenant has occupied the property for 6 months or less, or at least 84 days in any other case, unless the ground specifies a different notice period.')
  clause(ctx, '3.', 'The landlord cannot remove the tenant from the let property, or otherwise require the tenant to leave, except by obtaining an eviction order from the First-tier Tribunal.')

  // ── Statutory Term 12 — Repossession and Information ────────────────────
  term(ctx, 'Statutory Term 12 — Information for Tenant')
  clause(ctx, '1.', 'Before or at the start of the tenancy the landlord must give the tenant a copy of: (a) this tenancy agreement; (b) the Easy Read Notes for the Scottish Government Model Private Residential Tenancy Agreement.')
  clause(ctx, '2.', 'The landlord must provide the tenant with the landlord\'s contact details (name and address or telephone number or email address) so that the tenant can contact the landlord in connection with the tenancy.')

  // ── PART 4 — DOMESTIC ABUSE PROVISION ─────────────────────────────────────
  h1(ctx, 'PART 4 — DOMESTIC ABUSE PROVISION (April 2024 update)')
  gap(ctx, 2)
  text(ctx, 'The following provision reflects the amendments made by the Domestic Abuse (Protection) (Scotland) Act 2021 and applies to this tenancy.', { size: FS_SMALL, color: GRAY })
  gap(ctx, 6)
  clause(ctx, '1.', 'Where a domestic abuse protection order (DAPO) has been made under the Domestic Abuse (Protection) (Scotland) Act 2021, and the order prohibits the perpetrator from occupying the let property, the tenancy continues as the sole tenancy of the protected person if the let property is the protected person\'s only or principal home.')
  clause(ctx, '2.', 'Where this applies, the landlord must not terminate the tenancy of the protected person solely by reason of the perpetrator\'s exclusion from the let property.')

  // ── PART 5 — SIGNATURES ────────────────────────────────────────────────────
  h1(ctx, 'PART 5 — SIGNATURES')
  gap(ctx, 4)
  text(ctx, 'The parties confirm that they have read this tenancy agreement and agree to be bound by its terms.')
  gap(ctx, 24)

  const sigY = ctx.y
  need(ctx, 90)
  const pg = page(ctx)

  // Landlord
  pg.drawLine({ start: { x: MARGIN, y: sigY - 20 }, end: { x: MARGIN + 195, y: sigY - 20 }, thickness: 0.5, color: BLACK })
  pg.drawText('Landlord / authorised agent signature', { x: MARGIN, y: sigY - 32, size: FS_SMALL, font: regular, color: GRAY })
  pg.drawLine({ start: { x: MARGIN, y: sigY - 50 }, end: { x: MARGIN + 100, y: sigY - 50 }, thickness: 0.5, color: BLACK })
  pg.drawText('Date', { x: MARGIN, y: sigY - 62, size: FS_SMALL, font: regular, color: GRAY })
  pg.drawLine({ start: { x: MARGIN, y: sigY - 80 }, end: { x: MARGIN + 195, y: sigY - 80 }, thickness: 0.5, color: BLACK })
  pg.drawText('Print name', { x: MARGIN, y: sigY - 92, size: FS_SMALL, font: regular, color: GRAY })

  // Tenant
  const tx = MARGIN + 255
  pg.drawLine({ start: { x: tx, y: sigY - 20 }, end: { x: tx + 195, y: sigY - 20 }, thickness: 0.5, color: BLACK })
  pg.drawText('Tenant signature', { x: tx, y: sigY - 32, size: FS_SMALL, font: regular, color: GRAY })
  pg.drawLine({ start: { x: tx, y: sigY - 50 }, end: { x: tx + 100, y: sigY - 50 }, thickness: 0.5, color: BLACK })
  pg.drawText('Date', { x: tx, y: sigY - 62, size: FS_SMALL, font: regular, color: GRAY })
  pg.drawLine({ start: { x: tx, y: sigY - 80 }, end: { x: tx + 195, y: sigY - 80 }, thickness: 0.5, color: BLACK })
  pg.drawText('Print name', { x: tx, y: sigY - 92, size: FS_SMALL, font: regular, color: GRAY })

  ctx.y = sigY - 100

  // ── Page footers ──────────────────────────────────────────────────────────
  const total = ctx.pages.length
  for (let i = 0; i < total; i++) {
    ctx.pages[i].drawText(
      `${data.tenancyReference}  ·  Private Residential Tenancy  ·  Page ${i + 1} of ${total}`,
      { x: MARGIN, y: MARGIN - 18, size: FS_SMALL, font: regular, color: GRAY }
    )
  }

  return doc.save()
}
