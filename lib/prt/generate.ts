import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib'

// ─── Data types ───────────────────────────────────────────────────────────────

export interface PRTTenant {
  fullName: string
  dateOfBirth: string | null     // display string, e.g. "24 September 2002"
  passportNumber: string | null
  nationality: string | null
  currentAddress: string | null
  email: string
}

export interface PRTData {
  tenancyReference: string
  // Tenants
  tenants: PRTTenant[]
  // Landlord / legal entity
  landlordName: string
  landlordRegistrationNumber: string | null
  landlordAddress: string | null
  landlordEmail: string | null
  landlordTelephone: string | null
  // Property
  propertyAddress: string
  propertyType: string | null          // e.g. "Flat (Third Floor Left)"
  furnishedStatus: string | null       // e.g. "Furnished — see Inventory and Record of Condition"
  isHmo: boolean
  hmoLicenceNumber: string | null
  sharedAreas: string | null           // e.g. "Common stair and entrance"
  excludedAreas: string | null         // e.g. "None"
  parkingDescription: string | null    // e.g. "No parking is included with this tenancy"
  hasGas: boolean
  // Tenancy dates
  startDate: string                    // ISO
  rentAmount: number
  rentDueDay: number                   // 1–28
  // Deposit
  depositAmount: number | null
  depositScheme: string | null
  depositReference: string | null
  // Feature flags
  includeSection37: boolean            // true only for TJ Property Consultants Ltd
}

// ─── Layout constants ─────────────────────────────────────────────────────────

const MARGIN      = 56
const PAGE_W      = 595.28
const PAGE_H      = 841.89
const BODY_W      = PAGE_W - MARGIN * 2

const SZ_TITLE    = 14
const SZ_H1       = 11
const SZ_BODY     = 9
const SZ_SMALL    = 7.5

const BLACK  = rgb(0,    0,    0   )
const GRAY   = rgb(0.4,  0.4,  0.4 )
const LGRAY  = rgb(0.82, 0.82, 0.82)

// ─── Rendering context ────────────────────────────────────────────────────────

interface Ctx {
  doc:     PDFDocument
  pages:   PDFPage[]
  reg:     PDFFont
  bold:    PDFFont
  y:       number
}

const cp   = (c: Ctx) => c.pages[c.pages.length - 1]

function newPage(c: Ctx) {
  c.pages.push(c.doc.addPage([PAGE_W, PAGE_H]))
  c.y = PAGE_H - MARGIN
}

function need(c: Ctx, h: number) { if (c.y - h < MARGIN + 16) newPage(c) }

// Word-wrap text, advancing c.y
function txt(
  c:    Ctx,
  str:  string,
  opts: {
    font?:  PDFFont
    size?:  number
    color?: ReturnType<typeof rgb>
    x?:     number
    maxW?:  number
    lh?:    number
  } = {}
) {
  const font  = opts.font  ?? c.reg
  const size  = opts.size  ?? SZ_BODY
  const color = opts.color ?? BLACK
  const x     = opts.x    ?? MARGIN
  const maxW  = opts.maxW ?? BODY_W - (x - MARGIN)
  const lh    = opts.lh   ?? size * 1.52

  // Split on real newlines first, then word-wrap each line
  const lines = str.split('\n')
  for (const rawLine of lines) {
    if (rawLine.trim() === '') { c.y -= lh * 0.5; continue }
    const words = rawLine.split(' ')
    let line = ''
    for (const w of words) {
      const test = line ? `${line} ${w}` : w
      if (font.widthOfTextAtSize(test, size) > maxW && line) {
        need(c, lh)
        cp(c).drawText(line, { x, y: c.y, size, font, color })
        c.y -= lh
        line = w
      } else {
        line = test
      }
    }
    if (line) {
      need(c, lh)
      cp(c).drawText(line, { x, y: c.y, size, font, color })
      c.y -= lh
    }
  }
}

const gap   = (c: Ctx, n = 6) => { c.y -= n }

function rule(c: Ctx, w = 0.4) {
  need(c, 10)
  cp(c).drawLine({ start: { x: MARGIN, y: c.y }, end: { x: MARGIN + BODY_W, y: c.y }, thickness: w, color: LGRAY })
  c.y -= 8
}

function sectionTitle(c: Ctx, num: string, title: string) {
  gap(c, 12)
  need(c, 20)
  txt(c, `${num}. ${title}`, { font: c.bold, size: SZ_H1 })
  gap(c, 3)
  rule(c, 0.5)
}

function label(c: Ctx, key: string) {
  gap(c, 4)
  txt(c, key, { font: c.bold, size: SZ_SMALL, color: GRAY })
}

function value(c: Ctx, val: string) {
  txt(c, val, { size: SZ_BODY })
  gap(c, 2)
}

function lv(c: Ctx, key: string, val: string) {
  label(c, key)
  value(c, val)
}

function bullet(c: Ctx, text: string) {
  need(c, 14)
  const bx = MARGIN + 10
  cp(c).drawText('•', { x: MARGIN, y: c.y, size: SZ_BODY, font: c.reg, color: BLACK })
  txt(c, text, { x: bx, maxW: BODY_W - 10 })
}

// ─── Date / money helpers ─────────────────────────────────────────────────────

function fmtDate(iso: string, style: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }) {
  return new Date(iso).toLocaleDateString('en-GB', style)
}

function fmtMoney(n: number) {
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function ordinal(n: number) {
  const s = ['th','st','nd','rd']; const v = n % 100
  return n + (s[(v-20)%10] ?? s[v] ?? s[0])
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function monthName(month: number) {
  return new Date(2000, month, 1).toLocaleDateString('en-GB', { month: 'long' })
}

interface FirstPaymentCalc {
  firstPaymentAmount:  number
  firstPaymentDesc:    string    // e.g. "£810.00 due on 25 June 2026 (pro rata 25–30 June 2026: £135.00 + July 2026 in advance: £675.00)"
  firstPaymentShort:   string    // e.g. "£810.00 due on 25 June 2026 (pro rata 25–30 June 2026 [£135.00] + July 2026 in advance [£675.00])"
  subsequentDesc:      string    // e.g. "£675.00 due on the 1st of each calendar month from 1 August 2026 onwards"
  subsequentDescShort: string
}

function calcFirstPayment(startDateISO: string, rentAmount: number, rentDueDay: number): FirstPaymentCalc {
  const d = new Date(startDateISO)
  const day   = d.getDate()
  const month = d.getMonth()   // 0-based
  const year  = d.getFullYear()

  if (day === rentDueDay || day === 1) {
    // No pro-rata — starts on the due day
    const nextMonth = new Date(year, month + 1, rentDueDay)
    const nextDesc  = `${ordinal(rentDueDay)} of each calendar month from ${fmtDate(nextMonth.toISOString().slice(0,10))} onwards`
    const firstDesc = `${fmtMoney(rentAmount)} due on ${fmtDate(startDateISO)}`
    return {
      firstPaymentAmount:  rentAmount,
      firstPaymentDesc:    firstDesc,
      firstPaymentShort:   firstDesc,
      subsequentDesc:      `${fmtMoney(rentAmount)} due on the ${nextDesc}`,
      subsequentDescShort: `${fmtMoney(rentAmount)} due on the ${nextDesc}`,
    }
  }

  // Pro-rata for remaining days in start month + next full month in advance
  const totalDaysInMonth = daysInMonth(year, month)
  const remainingDays = totalDaysInMonth - day + 1
  const proRata = Math.round((rentAmount * remainingDays / totalDaysInMonth) * 100) / 100

  const lastDayOfMonth = new Date(year, month, totalDaysInMonth)
  const advanceMonth   = month + 1
  const advanceYear    = advanceMonth > 11 ? year + 1 : year
  const advMonthIdx    = advanceMonth % 12
  const advMonthName   = monthName(advMonthIdx)

  const subsequentMonth    = advMonthIdx + 1
  const subsequentYear     = subsequentMonth > 11 ? advanceYear + 1 : advanceYear
  const subsequentMonthIdx = subsequentMonth % 12
  const subsequentDate     = new Date(subsequentYear, subsequentMonthIdx, rentDueDay)

  const startStr       = fmtDate(startDateISO)
  const lastDayStr     = fmtDate(lastDayOfMonth.toISOString().slice(0,10), { day: 'numeric', month: 'long', year: 'numeric' })
  const total          = Math.round((proRata + rentAmount) * 100) / 100
  const subDateStr     = fmtDate(subsequentDate.toISOString().slice(0,10))

  const proRataRange  = `${fmtDate(startDateISO)} to ${lastDayStr.replace(`, ${year}`, '')}`
  const firstDesc     = `${fmtMoney(total)} due on ${startStr} (pro rata ${day}–${totalDaysInMonth} ${monthName(month)} ${year}: ${fmtMoney(proRata)} + ${advMonthName} ${advanceYear} in advance: ${fmtMoney(rentAmount)})`
  const firstShort    = `${fmtMoney(total)} due on ${startStr} (pro rata ${day}–${totalDaysInMonth} ${monthName(month)} ${year} [${fmtMoney(proRata)}] + ${advMonthName} ${advanceYear} in advance [${fmtMoney(rentAmount)}])`
  const subDesc       = `${fmtMoney(rentAmount)} due on the ${ordinal(rentDueDay)} of each calendar month from ${subDateStr} onwards`

  return {
    firstPaymentAmount:  total,
    firstPaymentDesc:    firstDesc,
    firstPaymentShort:   firstShort,
    subsequentDesc:      subDesc,
    subsequentDescShort: subDesc,
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generatePRT(data: PRTData): Promise<Uint8Array> {
  const doc  = await PDFDocument.create()
  doc.setTitle(`PRT — ${data.tenancyReference}`)
  doc.setSubject('Scottish Government Model Private Residential Tenancy Agreement (April 2024)')

  const reg  = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const c: Ctx = { doc, pages: [], reg, bold, y: 0 }
  newPage(c)
  c.y = PAGE_H - MARGIN - 8

  const fp = calcFirstPayment(data.startDate, data.rentAmount, data.rentDueDay)

  const tenantLabel = data.tenants.length > 1 ? 'the Tenants' : 'the Tenant'
  const tenantPronoun = data.tenants.length > 1 ? 'each Tenant' : 'the Tenant'

  // ── COVER / TITLE ──────────────────────────────────────────────────────────
  txt(c, 'Scottish Government Model', { font: bold, size: SZ_TITLE })
  txt(c, 'Private Residential Tenancy Agreement', { font: bold, size: SZ_TITLE })
  gap(c, 4)
  txt(c, 'For the private rented sector', { size: SZ_BODY, color: GRAY })
  txt(c, 'Private Housing (Tenancies) (Scotland) Act 2016', { size: SZ_BODY, color: GRAY })
  gap(c, 8)
  txt(c, data.propertyAddress, { font: bold, size: SZ_BODY })
  gap(c, 4)
  rule(c, 1)
  gap(c, 6)
  txt(c, 'Key:', { font: bold, size: SZ_SMALL })
  txt(c, 'Bold Text: Mandatory clauses — core rights and obligations', { size: SZ_SMALL, color: GRAY })
  txt(c, 'Normal Text: Discretionary clauses — a landlord can choose to include these if they wish', { size: SZ_SMALL, color: GRAY })
  gap(c, 6)
  txt(c, `Reference: ${data.tenancyReference}`, { font: bold, size: SZ_SMALL })

  // ── KNOW YOUR RIGHTS ───────────────────────────────────────────────────────
  newPage(c)
  c.y = PAGE_H - MARGIN - 8

  txt(c, 'The private residential tenancy: know your rights', { font: bold, size: SZ_H1 })
  gap(c, 6)
  rule(c, 0.5)

  txt(c, 'Your tenancy agreement', { font: bold, size: SZ_BODY })
  gap(c, 4)
  txt(c, 'Your tenancy is open-ended, which means it doesn\'t have a fixed length or a set date it will end. Your landlord cannot include an expected end date or minimum period in your tenancy agreement.')
  gap(c, 4)
  txt(c, 'If you are a joint tenant, all tenants are responsible for the rent, together and separately. This will apply for as long as the tenancy continues. To end a joint tenancy, all the joint tenants must agree to end it and give the landlord written notice that they want to leave.')
  gap(c, 10)

  txt(c, 'Your deposit and rent', { font: bold, size: SZ_BODY })
  gap(c, 4)
  txt(c, 'Your landlord can only increase your rent once in a 12-month period, and must give you at least three months\' notice that they are going to do this. If you think an increase is unreasonable, you can ask a rent officer from Rent Service Scotland to make a decision on whether it is fair.')
  gap(c, 4)
  txt(c, 'It is against the law for a landlord or letting agent to charge a fee or premium, or enter into a loan arrangement with you, as a condition of granting, renewing or continuing your tenancy. They can only charge you rent and a refundable deposit, and the deposit must not be more than two months\' rent.')
  gap(c, 4)
  txt(c, 'If you have paid a landlord a deposit, they must pay it into an approved tenancy deposit scheme, and give you further information about this within 30 working days of the start of your tenancy. This information should include, for example, the amount paid and the date it was paid, the address of the property, confirmation that the landlord is registered, and contact details for the scheme.')
  gap(c, 4)
  txt(c, 'If your landlord has not paid your deposit into the scheme within this 30-day timescale, you can take them to the First-tier Tribunal for Scotland (Housing and Property Chamber), where they could be told to pay you up to three times the value of the deposit.')
  gap(c, 10)

  txt(c, 'Repairs', { font: bold, size: SZ_BODY })
  gap(c, 4)
  txt(c, 'You can apply to the First-tier Tribunal for Scotland (Housing and Property Chamber) if your home doesn\'t reach a minimum standard of repair (known as the repairing standard).')
  gap(c, 10)

  txt(c, 'Ending a tenancy', { font: bold, size: SZ_BODY })
  gap(c, 4)
  txt(c, 'Your landlord cannot end your tenancy without good reason. They can only end it by giving you \'notice to leave\' for one or more of 18 reasons (grounds).')
  gap(c, 4)
  txt(c, 'If your landlord asks you to leave, they must give you: 28 days\' notice (if you have lived in the property for less than six months or the landlord is using one of the six \'behaviour\' grounds); or 84 days\' notice (if you have lived in the property for more than six months and the landlord is not using the \'behaviour\' grounds).')
  gap(c, 4)
  txt(c, 'If you want to leave, you must give your landlord 28 days\' notice in writing. In your notice you will need to state the day you want the tenancy to end (this is normally the day after the notice period has ended).')
  gap(c, 4)
  txt(c, 'If you disagree with the reason given in the notice to leave given to you by your landlord, you do not need to leave your property until such times as your landlord has obtained an eviction order from the First-tier Tribunal (Housing and Property Chamber).')
  gap(c, 4)
  txt(c, 'If you think that your tenancy was ended unlawfully (for example, the landlord served you with a notice to leave on the grounds that they intended to sell the property, but then they let it to another tenant), you can apply to the Tribunal for Scotland (Housing and Property Chamber). The Tribunal can award you up to six months\' rent.')
  gap(c, 10)
  txt(c, 'For more information on any of these rights, please see the relevant section of the following tenancy agreement.', { size: SZ_SMALL, color: GRAY })

  // ── SECTION 3 HEADER ──────────────────────────────────────────────────────
  gap(c, 14)
  txt(c, 'Section 3: Model Private Residential Tenancy Agreement', { font: bold, size: SZ_H1 })
  gap(c, 6)
  rule(c, 1)

  // ── 1. TENANT ─────────────────────────────────────────────────────────────
  sectionTitle(c, '1', 'TENANT')
  for (let i = 0; i < data.tenants.length; i++) {
    const t   = data.tenants[i]
    const num = data.tenants.length > 1 ? ` ${i + 1}` : ''
    lv(c, `Tenant${num} Full Name`, t.fullName.toUpperCase())
    if (t.dateOfBirth)    lv(c, `Tenant${num} Date of Birth`,    t.dateOfBirth)
    if (t.passportNumber) lv(c, `Tenant${num} Passport Number`, t.passportNumber)
    if (t.nationality)    lv(c, `Tenant${num} Nationality`,      t.nationality)
    if (t.currentAddress) lv(c, `Tenant${num} Current Address`,  t.currentAddress)
    lv(c, `Tenant${num} Email`, t.email)
    if (i < data.tenants.length - 1) gap(c, 6)
  }
  gap(c, 4)
  txt(c, `("${tenantLabel}")`, { font: bold, size: SZ_BODY })
  if (data.tenants.length > 1) {
    gap(c, 6)
    txt(c, 'Where this is a joint tenancy, the term "Tenant" applies to each of the individuals above and the full responsibilities and rights set out in this Agreement apply to each Tenant who will be jointly and severally liable for all of the obligations of the Tenant under this Agreement.')
  }

  // ── 2. LETTING AGENT ──────────────────────────────────────────────────────
  sectionTitle(c, '2', 'LETTING AGENT')
  txt(c, 'Not applicable. The Landlord is managing this tenancy directly.')

  // ── 3. LANDLORD ───────────────────────────────────────────────────────────
  sectionTitle(c, '3', 'LANDLORD')
  lv(c, 'Landlord Name', data.landlordName)
  if (data.landlordRegistrationNumber) lv(c, 'Landlord Registration No.', data.landlordRegistrationNumber)
  if (data.landlordAddress)            lv(c, 'Registered Address',         data.landlordAddress)
  if (data.landlordEmail)              lv(c, 'Email',                       data.landlordEmail)
  if (data.landlordTelephone)          lv(c, 'Telephone',                   data.landlordTelephone)
  gap(c, 4)
  txt(c, '("the Landlord")', { font: bold })

  // ── 4. COMMUNICATION ──────────────────────────────────────────────────────
  sectionTitle(c, '4', 'COMMUNICATION')
  txt(c, 'The Landlord and Tenant agree that all communications which may or must be made under the Act and in relation to this Agreement, including notices to be served by one party on the other will be made in writing using:')
  gap(c, 6)
  const tenantEmails = data.tenants.map((t, i) =>
    data.tenants.length > 1 ? `Tenant ${i + 1} — ${t.email}` : `Tenant — ${t.email}`
  ).join(' | ')
  txt(c, `Email: Landlord — ${data.landlordEmail ?? '[landlord email]'} | ${tenantEmails}`, { font: bold })
  gap(c, 6)
  txt(c, 'For communication by email it is essential that the Landlord(s) and Tenant(s) consider carefully whether this option is suitable for them. It should be noted that all notices will be sent by email, which includes important documents such as a rent-increase notice and a notice to leave the Let Property.')
  gap(c, 4)
  txt(c, 'To ensure all emails can be received and read in good time, the Landlord(s) and Tenant(s) agree to inform each other as soon as possible of any new email address which is to be used instead of the email address notified in this Agreement.')
  gap(c, 4)
  txt(c, 'If sending a document electronically or by recorded delivery post, the document will be regarded as having been received 48 hours after it was sent, unless the receiving party can provide proof that he or she received it later than this. This extra delivery time should be factored into any required notice period.')

  // ── 5. DETAILS OF THE LET PROPERTY ───────────────────────────────────────
  sectionTitle(c, '5', 'DETAILS OF THE LET PROPERTY')
  lv(c, 'Address', `${data.propertyAddress} ("the Let Property")`)
  if (data.propertyType)      lv(c, 'Type of Property',       data.propertyType)
  if (data.furnishedStatus)   lv(c, 'Furnished Status',       data.furnishedStatus)
  lv(c, 'Rent Pressure Zone', 'The Let Property is not located in a rent pressure zone')
  lv(c, 'HMO', data.isHmo
    ? `Yes — House in Multiple Occupation${data.hmoLicenceNumber ? ` (Licence: ${data.hmoLicenceNumber})` : ''}`
    : 'The Let Property is not a House in Multiple Occupation (HMO)')
  if (data.sharedAreas)       lv(c, 'Shared Areas/Facilities',    data.sharedAreas)
  if (data.excludedAreas)     lv(c, 'Excluded Areas/Facilities',  data.excludedAreas)
  if (data.parkingDescription) lv(c, 'Parking',                   data.parkingDescription)

  // ── 6. START DATE OF THE TENANCY ──────────────────────────────────────────
  sectionTitle(c, '6', 'START DATE OF THE TENANCY')
  lv(c, 'Tenancy Start Date', `${fmtDate(data.startDate)} ("the start date of the tenancy")`)
  lv(c, 'First Payment',      fp.firstPaymentDesc)
  lv(c, 'Subsequent Payments', fp.subsequentDesc)

  // ── 7. OCCUPATION AND USE ─────────────────────────────────────────────────
  sectionTitle(c, '7', 'OCCUPATION AND USE OF THE LET PROPERTY')
  txt(c, 'The Tenant agrees to continue to occupy the Let Property as his or her home and must obtain the Landlord\'s written permission before carrying out any trade, business or profession there.')

  // ── 8. RENT ──────────────────────────────────────────────────────────────
  sectionTitle(c, '8', 'RENT')
  lv(c, 'Monthly Rent',        `${fmtMoney(data.rentAmount)} per calendar month, payable in advance`)
  lv(c, 'First Payment',       fp.firstPaymentShort)
  lv(c, 'Subsequent Payments', fp.subsequentDescShort)
  lv(c, 'Payment Method',      'Bank transfer to the Landlord\'s nominated bank account (details provided separately in writing)')
  lv(c, 'Services Included in Rent', 'None — Tenant responsible for all utilities and council tax')

  // ── 9. RENT RECEIPTS ──────────────────────────────────────────────────────
  sectionTitle(c, '9', 'RENT RECEIPTS')
  txt(c, 'Where any payment of rent is made in cash, the Landlord must provide the Tenant with a dated written receipt for the payment stating: the amount paid, and either (as the case may be) the amount which remains outstanding, or confirmation that no further amount remains outstanding.')

  // ── 10. RENT INCREASES ───────────────────────────────────────────────────
  sectionTitle(c, '10', 'RENT INCREASES')
  txt(c, 'The rent cannot be increased more than once in any twelve month period and the Landlord must give the Tenant at least three months\' notice before any increase can take place. In order to increase the rent, the Landlord must give the Tenant a rent-increase notice, the content of which is set out in \'The Private Residential Tenancies (Prescribed Notices and Forms) (Scotland) Regulations 2017\'. The notice will be sent using the communication method agreed in the \'Communication\' clause above.')
  gap(c, 4)
  txt(c, 'Within 21 days of receiving a rent-increase notice, the Tenant can refer the increase to a rent officer for adjudication if he or she considers that the rent increase amount is unreasonable, unless the property is located in a rent pressure zone (RPZ). Before submitting a referral to a rent officer for rent adjudication, the Tenant must complete Part 3 of the rent-increase notice and return it to his or her Landlord to notify the Landlord of his or her intention to make a referral to a rent officer. Failure to return Part 3 to the Landlord will mean that the rent increase will take effect from the date proposed in the notice.')

  // ── 11. DEPOSIT ──────────────────────────────────────────────────────────
  sectionTitle(c, '11', 'DEPOSIT')
  txt(c, 'The Landlord must lodge any deposit they receive with a tenancy deposit scheme within 30 working days of the start date of the tenancy (when a deposit is paid in instalments then each instalment must be lodged within 30 working days of that instalment being paid).')
  gap(c, 6)
  if (data.depositAmount) {
    lv(c, 'Deposit Amount',           fmtMoney(data.depositAmount))
    lv(c, 'Deposit Protection Scheme', data.depositScheme ?? 'To be registered')
    lv(c, 'Registration Deadline',    `Within 30 working days of ${fmtDate(data.startDate)}`)
  } else {
    txt(c, 'No deposit is required for this tenancy.', { font: bold })
  }
  gap(c, 6)
  txt(c, 'By law, the deposit amount cannot exceed the equivalent of two months\' rent and cannot include any premiums. For example, charging for an administration fee or taking a holding fee (regardless of whether or not the holding fee is refundable).')
  gap(c, 4)
  txt(c, 'Where it is provided in this Agreement that the Tenant is responsible for a particular cost or to do any particular thing and the Tenant fails to meet that cost, or the Landlord carries out work or performs any other obligation for which the Tenant is responsible, the Landlord can apply for reasonable costs to be deducted from any deposit paid by the Tenant. This would include cases where a tenant has not paid all of the rent payable, any amount in respect of one-off services, or unpaid utility bills, or a sum in relation to breakages or cleaning.')
  gap(c, 4)
  txt(c, 'At the end of the tenancy the Landlord should ask the tenancy deposit scheme to release the deposit and the amounts payable to each party. If the Tenant disagrees with the amount, the scheme administrator will provide a dispute resolution mechanism.')
  gap(c, 4)
  txt(c, 'Where the Tenant owes the Landlord an amount greater than the amount held by the tenancy deposit scheme, the Tenant will remain liable for these costs, and the Landlord may take action to recover the difference from the Tenant.')
  gap(c, 4)
  txt(c, 'The deposit is strictly not to be used as payment for the last month\'s rent or any other rental period during or whilst ending the tenancy. Any attempt to do so shall be treated as a breach of this Agreement.')

  // ── 12. SUBLETTING ───────────────────────────────────────────────────────
  sectionTitle(c, '12', 'SUBLETTING AND ASSIGNATION')
  txt(c, 'Unless the Tenant has received prior written permission from the Landlord, the Tenant must not:')
  gap(c, 4)
  bullet(c, 'sublet the Let Property (or any part of it),')
  bullet(c, 'take in a lodger,')
  bullet(c, 'assign the Tenant\'s interest in the Let Property (or any part of it), or')
  bullet(c, 'otherwise part with, or give up to another person, possession of the Let Property (or any part of it).')

  // ── 13. NOTIFICATION ABOUT OTHER RESIDENTS ───────────────────────────────
  sectionTitle(c, '13', 'NOTIFICATION ABOUT OTHER RESIDENTS')
  txt(c, 'If a person aged 16 or over (who is not a Joint Tenant) occupies the Let Property with the Tenant as that person\'s only or principal home, the Tenant must tell the Landlord in writing that person\'s name, and relationship to the Tenant.')
  gap(c, 4)
  txt(c, 'If that person subsequently leaves the Let Property the Tenant must tell the Landlord.')
  gap(c, 4)
  txt(c, 'The Tenant will take reasonable care to ensure that anyone living with them does not do anything that would be a breach of this Agreement if they were the Tenant. If they do, the Tenant will be treated as being responsible for any such action and will be liable for the cost of any repairs, renewals or replacement of items where required.')

  // ── 14. OVERCROWDING ─────────────────────────────────────────────────────
  sectionTitle(c, '14', 'OVERCROWDING')
  txt(c, 'The number of people who may live in a Let Property depends on the number and size of the rooms, and the age, gender and relationships of the people. Living rooms and bedrooms are counted as rooms, but not the kitchen or bathroom.')
  gap(c, 4)
  txt(c, 'The Tenant must not allow the Let Property to become overcrowded. If the Let Property does become overcrowded, the Landlord can take action to evict the Tenant as the Tenant has breached this term of this Agreement.')

  // ── 15. INSURANCE ────────────────────────────────────────────────────────
  sectionTitle(c, '15', 'INSURANCE')
  txt(c, 'The Landlord is responsible for paying premiums for any insurance of the building and contents belonging to him or her, such as those items included in the property inventory. The Landlord will have no liability to insure any items belonging to the Tenant.')
  gap(c, 4)
  txt(c, 'The Tenant is responsible for arranging any contents insurance which the Tenant requires for his or her own belongings. The Tenant\'s belongings may include personal effects, foodstuffs and consumables, belongings, and any other contents brought in to the Let Property by the Tenant.')

  // ── 16. ABSENCES ─────────────────────────────────────────────────────────
  sectionTitle(c, '16', 'ABSENCES')
  txt(c, 'The Tenant agrees to tell the Landlord if he or she is to be absent from the Let Property for any reason for a period of more than 14 days. The Tenant must take such measures as the Landlord may reasonably require to secure the Let Property prior to such absence and take appropriate reasonable measures to meet the \'Reasonable Care\' section below.')

  // ── 17. REASONABLE CARE ──────────────────────────────────────────────────
  sectionTitle(c, '17', 'REASONABLE CARE')
  txt(c, 'The Tenant agrees to take reasonable care of the Let Property and any common parts, and in particular agrees to take all reasonable steps to:')
  gap(c, 4)
  bullet(c, 'keep the Let Property adequately ventilated and heated;')
  bullet(c, 'not bring any hazardous or combustible goods or material into the Let Property, notwithstanding the normal and safe storage of petroleum and gas for garden appliances (mowers etc.), barbecues or other commonly used household goods or appliances;')
  bullet(c, 'not put any damaging oil, grease or other harmful or corrosive substance into the washing or sanitary appliances or drains;')
  bullet(c, 'prevent water pipes freezing in cold weather;')
  bullet(c, 'avoid danger to the Let Property or neighbouring properties by way of fire or flooding;')
  bullet(c, 'ensure the Let Property and its fixtures and fittings are kept clean during the tenancy;')
  bullet(c, 'not interfere with the smoke detectors, carbon monoxide detectors, heat detectors or the fire alarm system;')
  bullet(c, 'not interfere with door closer mechanisms.')

  // ── 18. THE REPAIRING STANDARD ───────────────────────────────────────────
  sectionTitle(c, '18', 'THE REPAIRING STANDARD ETC. AND OTHER INFORMATION')

  txt(c, 'The Repairing Standard', { font: bold })
  gap(c, 4)
  txt(c, 'The Landlord is responsible for ensuring that the Let Property meets the Repairing Standard.')
  gap(c, 4)
  txt(c, 'The Landlord must carry out a pre-tenancy check of the Let Property to identify work required to meet the Repairing Standard (described below) and notify the Tenant of any such work. The Landlord also has a duty to repair and maintain the Let Property from the start date of the tenancy and throughout the tenancy. This includes a duty to make good any damage caused by doing this work. On becoming aware of a defect, the Landlord must complete the work within a reasonable time.')
  gap(c, 4)
  txt(c, 'A privately rented Let Property must meet the Repairing Standard as follows:')
  gap(c, 4)
  bullet(c, 'The house meets the Tolerable Standard, including satisfactory fire and carbon monoxide detection.')
  bullet(c, 'The Let Property must be wind and water tight and in all other respects reasonably fit for people to live in.')
  bullet(c, 'The structure and exterior (including drains, gutters and external pipes) must be in a reasonable state of repair and in proper working order.')
  bullet(c, 'Installations for supplying water, gas and electricity and for sanitation, space heating and heating water must be in a reasonable state of repair and in proper working order.')
  bullet(c, 'Any fixtures, fittings and appliances that the Landlord provides under the tenancy must be in a reasonable state of repair and in proper working order.')
  bullet(c, 'Any furnishings that the Landlord provides under the tenancy must be capable of being used safely for the purpose for which they are designed.')
  bullet(c, 'The Let Property must have satisfactory provision for, and safe access to a food storage area and a food preparation space.')
  bullet(c, 'Common parts pertaining to the house can be safely accessed and used.')
  bullet(c, 'Where a house is in a tenement, common doors are secure and fitted with satisfactory emergency exit locks.')
  gap(c, 8)

  // Gas Safety — conditional on hasGas
  if (data.hasGas) {
    txt(c, 'Gas Safety', { font: bold })
    gap(c, 4)
    txt(c, 'The Landlord must ensure that there is an annual Gas safety check on all pipework and appliances carried out by a Gas Safe registered engineer. The Tenant must be given a copy of the Landlord\'s gas safety certificate. The Landlord must keep certificates for at least 2 years. The Gas Safety (Installation and use) Regulations 1998 places duties on Tenants to report any defects with gas pipework or gas appliances that they are aware of to the Landlord. Tenants are forbidden to use appliances that have been deemed unsafe by a gas contractor.')
    gap(c, 4)
    txt(c, 'The Landlord must also ensure that a carbon monoxide detector is installed where there is a fixed carbon-fuelled appliance (excluding an appliance used solely for cooking) or where a fixed carbon-fuelled appliance is situated in an inter-connected space such as a garage.')
    gap(c, 4)
    txt(c, 'Tenants must be advised of the following action to be taken should there be a smell of gas, or suspicion of a gas escape, or a carbon monoxide leak:')
    gap(c, 4)
    bullet(c, 'Open all doors and windows;')
    bullet(c, 'Shut off the gas supply at the meter control valve;')
    bullet(c, 'If gas continues to escape the National Gas Emergency Service should be called on 0800 111 999 – it operates 24 hours a day; and')
    bullet(c, 'Any investigations or repairs must be carried out by a Gas Safe registered engineer.')
    gap(c, 8)
  }

  txt(c, 'Electrical Safety', { font: bold })
  gap(c, 4)
  txt(c, 'Landlords must ensure an electrical safety inspection comprising of periodic inspection and testing of the electrical installation and \'In-service inspection and testing of electrical equipment\' (also known as PAT testing) is carried out by a suitably competent person before the property is let for the first time, and then at intervals of no more than five years. Electrical inspection reports must be supplied to the tenant.')
  gap(c, 8)

  txt(c, 'Energy Performance Certificate (EPC)', { font: bold })
  gap(c, 4)
  txt(c, 'A valid EPC (not more than 10 years old) must be given to the Tenant at the start date of the tenancy, unless the Tenant is renting a room with shared access to a kitchen, bathroom and living area.')
  gap(c, 8)

  txt(c, 'Repair Timetable', { font: bold })
  gap(c, 4)
  txt(c, 'The Tenant undertakes to notify the Landlord as soon as is reasonably practicable of the need for any repair or emergency. The Landlord is responsible for carrying out necessary repairs as soon as is reasonably practicable after having been notified of the need to do so.')
  gap(c, 4)
  txt(c, 'The Tenant must allow the Landlord reasonable access to the Let Property to enable the Landlord to fulfil their duties under the repairing standard (see the clause on \'Access for Repairs\').')
  gap(c, 8)

  txt(c, 'Payment for Repairs', { font: bold })
  gap(c, 4)
  txt(c, 'The Tenant will be liable for the cost of repairs where the need for them is attributable to his or her fault or negligence, that of any person residing with him or her, or any guest of his or hers.')
  gap(c, 8)

  txt(c, 'Information', { font: bold })
  gap(c, 4)
  txt(c, 'In addition to this Agreement, the Landlord must give to the Tenant:-')
  gap(c, 4)
  if (data.hasGas) bullet(c, 'gas safety certificate;')
  bullet(c, 'electrical safety inspection reports;')
  bullet(c, 'energy performance certificate (unless the Tenant is renting a room with shared access to a kitchen, bathroom and living area).')

  // ── 19. LEGIONELLA ───────────────────────────────────────────────────────
  sectionTitle(c, '19', 'LEGIONELLA')
  txt(c, 'At the start of the tenancy and throughout, the Landlord must take reasonable steps to assess any risk from exposure to legionella to ensure the safety of the Tenant in the Let Property.')
  gap(c, 4)
  txt(c, 'Private landlords must advise tenants of control measures put in place and of their responsibility to help ensure they are maintained. Tenants must be advised:')
  gap(c, 4)
  bullet(c, 'Not to adjust the temperature setting of the hot water tank;')
  bullet(c, 'To regularly clean and disinfect showerheads; and')
  bullet(c, 'Inform the landlord if the hot water is not heating properly or if there are any other problems with the system.')

  // ── 20. ACCESS FOR REPAIRS ───────────────────────────────────────────────
  sectionTitle(c, '20', 'ACCESS FOR REPAIRS, INSPECTIONS AND VALUATIONS')
  txt(c, 'The Tenant must allow reasonable access to the Let Property for an authorised purpose where the Tenant has been given at least 48 hours\' notice, or access is required urgently. Authorised purposes are carrying out work in the Let Property which the Landlord is required to or is allowed to, either by law, under the terms of this Agreement, or any other agreement between the Landlord and the Tenant; inspecting the Let Property to see if any such work is needed; and carrying out a valuation of the Let Property. The right of access also covers access by others such as a contractor or tradesman hired by the Landlord.')
  gap(c, 4)
  txt(c, 'There is nothing to stop the Tenant and Landlord from mutually agreeing more generous rights of access if both parties want to resolve a non-urgent problem more promptly.')
  gap(c, 4)
  txt(c, 'The Landlord has no right to use retained keys to enter the Let Property without the Tenant\'s permission, except in an emergency.')

  // ── 21. RESPECT FOR OTHERS ───────────────────────────────────────────────
  sectionTitle(c, '21', 'RESPECT FOR OTHERS')
  txt(c, 'The Tenant, those living with him/her, and his/her visitors must not engage in antisocial behaviour to another person. A person includes anyone in the Let Property, a neighbour, visitor, the Landlord, Agent or contractor.')
  gap(c, 4)
  txt(c, '"Antisocial behaviour" means behaving in a way which causes, or is likely to cause, alarm, distress, nuisance or annoyance to any person; or which amounts to harassment of any person. Harassment of a person includes causing the person alarm or distress. Antisocial behaviour includes speech.')
  gap(c, 4)
  txt(c, 'In particular, the Tenant, those living with him/her, and his/her visitors must not:')
  gap(c, 4)
  bullet(c, 'make excessive noise. This includes, but is not limited to, the use of televisions, CD players, digital media players, radios and musical instruments and DIY and power tools;')
  bullet(c, 'fail to control pets properly or allow them to foul or cause damage to other people\'s property;')
  bullet(c, 'allow visitors to the Let Property to be noisy or disruptive;')
  bullet(c, 'vandalise or damage the Let Property or any part of the common parts or neighbourhood;')
  bullet(c, 'leave rubbish either in unauthorised places or at inappropriate times;')
  bullet(c, 'allow any other person (including children) living in or using the property to cause a nuisance or annoyance to other people by failing to take reasonable steps to prevent this;')
  bullet(c, 'harass any other Tenant, member of his/her household, visitors, neighbours, family members of the Landlord or employees of the Landlord or Agent, or any other person or persons in the house, or neighbourhood, for whatever reason. This includes behaviour due to that person\'s race, colour or ethnic origin, nationality, gender, sexuality, disability, age, religion or other belief, or other status;')
  gap(c, 4)
  txt(c, 'In addition, the Tenant, those living with him/her, and his/her visitors must not engage in the following unlawful activities:')
  gap(c, 4)
  bullet(c, 'use or carry offensive weapons;')
  bullet(c, 'use, sell, cultivate or supply unlawful drugs or sell alcohol;')
  bullet(c, 'store or bring onto the premises any type of unlicensed firearm or firearm ammunition including any replica or decommissioned firearms;')
  bullet(c, 'use the Let Property or allow it to be used, for illegal or immoral purposes;')
  bullet(c, 'threaten or assault any other Tenant, member of his/her household, visitors, neighbours, family members of the Landlord or employees of the Landlord or Agent, or any other person or persons in the house, or neighbourhood, for whatever reason.')

  // ── 22. EQUALITY REQUIREMENTS ────────────────────────────────────────────
  sectionTitle(c, '22', 'EQUALITY REQUIREMENTS')
  txt(c, 'Under the Equality Act 2010, the Landlord must not unlawfully discriminate against the Tenant or prospective Tenant on the basis of their disability, sex, gender reassignment, pregnancy or maternity, race, religion or belief or sexual orientation.')

  // ── 23. DATA PROTECTION ──────────────────────────────────────────────────
  sectionTitle(c, '23', 'DATA PROTECTION')
  txt(c, 'The Landlord must comply with the requirements of the Data Protection Laws to ensure that the Tenant\'s personal information is held securely and only lawfully disclosed. Personal data collected in connection with this tenancy shall be processed in accordance with the UK GDPR and the Data Protection Act 2018 for the purpose of managing the tenancy.')

  // ── 24. ENDING THE TENANCY ───────────────────────────────────────────────
  sectionTitle(c, '24', 'ENDING THE TENANCY')
  txt(c, 'This Tenancy may be ended by:-')
  gap(c, 4)
  bullet(c, 'The Tenant giving notice to the Landlord: The Tenant giving the Landlord at least 28 days\' notice in writing to terminate the tenancy, or an earlier date if the Landlord is content to waive the minimum 28 day notice period. Where the Landlord agrees to waive the notice period, his or her agreement must be in writing. The tenancy will come to an end on the date specified in the notice or, where appropriate, the earlier date agreed between the Tenant and Landlord. To end a joint tenancy, all the Joint Tenants must agree to end the tenancy. One Joint Tenant cannot terminate the joint tenancy on behalf of all Joint Tenants.')
  bullet(c, 'The Landlord giving notice to the Tenant, which is only possible using one of the 18 grounds for eviction set out in schedule 3 of the Act.')
  gap(c, 4)
  txt(c, 'The Landlord must give the Tenant 28 days\' notice if, on the day the Tenant receives the Notice to Leave, the Tenant has been entitled to occupy the Let Property for six months or less, or if the eviction ground (or grounds) that the Landlord is stating is one or more of the following. The Tenant: is not occupying the Let Property as his or her only or principal home; has breached the tenancy agreement; is in rent arrears for three or more consecutive months; has a relevant criminal conviction; has engaged in relevant antisocial behaviour; has associated with a person who has a relevant conviction or has engaged in antisocial behaviour.')
  gap(c, 4)
  txt(c, 'The Landlord must give the Tenant 84 days\' notice if, on the date the Tenant receives the Notice to Leave, the Tenant has been entitled to occupy the Let Property for over six months and the Notice to Leave does not rely exclusively on one (or more) of the eviction grounds already mentioned in this paragraph.')
  gap(c, 4)
  txt(c, 'The Landlord must secure repossession only by lawful means and must comply with all relevant legislation affecting private residential tenancies.')
  gap(c, 8)

  txt(c, 'Schedule 3 to the Act — Eviction Grounds (all discretionary)', { font: bold })
  gap(c, 4)
  bullet(c, 'The Landlord intends to sell the Let Property for market value within three months of the Tenant ceasing to occupy it.')
  bullet(c, 'Let Property to be sold by the mortgage lender.')
  bullet(c, 'The Landlord intends to refurbish and this will entail significantly disruptive works to, or in relation to, the Let Property.')
  bullet(c, 'The Landlord intends to live in the Let Property as his or her only or principal home.')
  bullet(c, 'The Landlord intends to use the Let Property for a purpose other than providing a person with a home.')
  bullet(c, 'The Let Property is held for a person engaged in the work of a religious denomination as a residence from which the duties of such a person are to be performed; the Let Property has previously been used for that purpose; and the Let Property is required for that purpose.')
  bullet(c, 'The Tenant is not occupying the Let Property as his or her only or principal home or has abandoned the Let Property.')
  bullet(c, 'After the start date of the tenancy, the Tenant is convicted of using, or allowing the use of, the Let Property for an immoral or illegal purpose, or is convicted of an imprisonable offence committed in or in the locality of the Let Property.')
  bullet(c, 'A member of the Landlord\'s family intends to live in the Let Property as his or her only or principal home.')
  bullet(c, 'The tenancy was entered into on account of the Tenant having an assessed need for community care and the Tenant has since been assessed as no longer having such need.')
  bullet(c, 'The Tenant has breached the tenancy agreement – this excludes the payment of rent.')
  bullet(c, 'The Tenant has acted in an antisocial manner to another person and the Tribunal is satisfied that it is reasonable to issue an eviction order given the nature of the behaviour and who it was in relation to or where it occurred.')
  bullet(c, 'The Tenant is associating in the Let Property with a person who has a relevant conviction or who has engaged in relevant antisocial behaviour.')
  bullet(c, 'Landlord registration has been refused or revoked by a local authority.')
  bullet(c, 'House in Multiple Occupation (HMO) license revoked by the local authority.')
  bullet(c, 'Overcrowding statutory notice in respect of the Let Property has been served on the Landlord.')
  bullet(c, 'The Tenant is in rent arrears over three consecutive months.')
  bullet(c, 'The tenancy was granted to an employee and the Tenant is no longer an employee.')
  gap(c, 6)
  txt(c, 'The Tenant agrees to remove all of his or her belongings when the Tenancy ends. The Tenant\'s belongings may include personal effects, foodstuffs and consumables, belongings, and any other contents brought in to the Let Property by the Tenant.')

  // ── 25. CONTENTS AND CONDITION ───────────────────────────────────────────
  sectionTitle(c, '25', 'CONTENTS AND CONDITION')
  txt(c, 'The Tenant agrees that the signed Inventory and Record of Condition, which will be supplied to the Tenant no later than the start date of the tenancy, is a full and accurate record of the contents and condition of the Let Property at the start date of the tenancy. The Tenant has a period of 7 days from the start date of the tenancy to ensure that the Inventory and Record of Condition is correct and either 1) to tell the Landlord of any discrepancies in writing, after which the Inventory and Record of Condition will be amended as appropriate or 2) to take no action and, after the 7-day period has expired, the Tenant shall be deemed to be fully satisfied with the terms.')
  gap(c, 4)
  txt(c, 'The Tenant agrees to replace or repair (or, at the option of the Landlord, to pay the reasonable cost of repairing or replacing) any of the contents which are destroyed, damaged, removed or lost during the tenancy, fair wear and tear excepted, where this was caused wilfully or negligently by the Tenant, anyone living with the Tenant or an invited visitor to the Let Property. Items to be replaced by the Tenant will be replaced by items of equivalent value and quality.')

  // ── 26. LOCAL AUTHORITY TAXES/CHARGES ────────────────────────────────────
  sectionTitle(c, '26', 'LOCAL AUTHORITY TAXES/CHARGES')
  txt(c, 'The Tenant will notify the local authority that they are responsible for paying the council tax and any other associated charges.')
  gap(c, 4)
  txt(c, 'Unless exempt, the Tenant will be responsible for payment of any council tax and water and sewerage charges, or any local tax which may replace this. The Tenant will advise the local authority of the start date and end date of the tenancy and apply for any exemptions or discounts that they may be eligible for.')
  gap(c, 4)
  txt(c, 'The Tenant must register with Aberdeen City Council for council tax within 14 days of the tenancy start date and provide the Landlord with written confirmation. Where a Tenant believes they are eligible for an exemption (e.g. full-time student), they must apply directly to the council and provide the Landlord with confirmation of the exemption within 14 days of the tenancy start date. The Landlord will notify Aberdeen City Council of the change of tenancy as required by law.')

  // ── 27. UTILITIES ────────────────────────────────────────────────────────
  sectionTitle(c, '27', 'UTILITIES')
  txt(c, 'The Tenant undertakes to ensure that the accounts for the supply to the Let Property of gas, electricity, telephone, TV licence, internet and broadband are entered in his or her name with the relevant supplier. The Tenant agrees to pay promptly all sums that become due for these supplies relative to the period of the tenancy.')
  gap(c, 4)
  txt(c, 'The Tenant agrees to make the necessary arrangements with the suppliers to settle all accounts for these services at the end of the tenancy.')
  gap(c, 4)
  txt(c, 'The Tenant has the right to change supplier if he or she pays the energy supplier directly for gas or electricity. The Tenant agrees to inform the Landlord if they choose to change the utilities supplier, and to provide the Landlord with details of the new supplier.')
  gap(c, 4)
  txt(c, 'The Tenant must take meter readings for all utilities on the day of entry and on the day of vacation and provide written copies to the Landlord or Agent within 48 hours of each reading being taken.')

  // ── 28. ALTERATIONS ──────────────────────────────────────────────────────
  sectionTitle(c, '28', 'ALTERATIONS')
  txt(c, 'The Tenant agrees not to make any alteration to the Let Property, its fixtures or fittings, nor to carry out any internal or external decoration without the prior written consent of the Landlord.')
  gap(c, 4)
  txt(c, 'Any request for adaptations, auxiliary aids or services under section 37 of the Equality Act 2010 or section 52 of the Housing (Scotland) Act 2006 must be made in writing to the Landlord and any other owners of the common parts, where appropriate. Consent for alterations requested under this legislation should not be unreasonably withheld.')
  gap(c, 4)
  txt(c, 'The Tenant must not carry out any building, structural or DIY works of any kind without the prior written consent of the Landlord. The Tenant must not repaint, redecorate or change the colour scheme of any room or surface without the prior written consent of the Landlord. Any consented works must be carried out to a professional standard. The Landlord may require the property to be returned to its original condition at the end of the tenancy.')

  // ── 29. COMMON PARTS ─────────────────────────────────────────────────────
  sectionTitle(c, '29', 'COMMON PARTS')
  txt(c, 'The Tenant agrees, in conjunction with the other proprietors/occupiers, to sweep and clean the common stairway and to co-operate with other proprietors/properties in keeping common areas clean and tidy. The Tenant must not leave any items in the common stair or shared areas that cause a fire, safety hazard, or nuisance or annoyance to neighbours.')

  // ── 30. PRIVATE GARDEN ───────────────────────────────────────────────────
  sectionTitle(c, '30', 'PRIVATE GARDEN')
  txt(c, 'Not applicable to this Let Property.')

  // ── 31. ROOF ─────────────────────────────────────────────────────────────
  sectionTitle(c, '31', 'ROOF')
  txt(c, 'The Tenant is not permitted to access the roof without the Landlord\'s written consent, except in the case of an emergency.')

  // ── 32. BINS AND RECYCLING ───────────────────────────────────────────────
  sectionTitle(c, '32', 'BINS AND RECYCLING')
  txt(c, 'The Tenant agrees to dispose of or recycle all rubbish in an appropriate manner and at the appropriate time. Rubbish must not be placed anywhere in the common stair at any time. The Tenant must take reasonable care to ensure that the rubbish is properly bagged or recycled in the appropriate container. If rubbish is normally collected from the street, on the day of collection it should be put out by the time specified by the local authority. Rubbish and recycling containers should be returned to their normal storage places as soon as possible after it has been collected. The Tenant must comply with any local arrangements for the disposal of large items.')

  // ── 33. STORAGE ──────────────────────────────────────────────────────────
  sectionTitle(c, '33', 'STORAGE')
  txt(c, 'Nothing belonging to the Tenant or anyone living with the Tenant or a visitor may be left or stored in the common stair if it causes a fire or safety hazard, or nuisance or annoyance to neighbours.')

  // ── 34. DANGEROUS SUBSTANCES ─────────────────────────────────────────────
  sectionTitle(c, '34', 'DANGEROUS SUBSTANCES INCLUDING LIQUID PETROLEUM GAS')
  txt(c, 'The Tenant agrees to the normal and safe storage of any petroleum and/or gas, including liquid petroleum gas, for garden appliances (mowers etc.), barbecues or other commonly used household goods or appliances. The Tenant must not store, keep or bring into the Let Property or any store, shed or garage any other flammable liquids, explosives or explosive gases which might reasonably be considered to be a fire hazard or otherwise dangerous to the Let Property or its occupants or the neighbours or the neighbour\'s property.')

  // ── 35. PETS ─────────────────────────────────────────────────────────────
  sectionTitle(c, '35', 'PETS')
  txt(c, 'The Tenant will not keep any animals or pets in the Let Property without the prior written consent of the Landlord. Any pet (where permitted) will be kept under supervision and control to ensure that it does not cause deterioration in the condition of the Let Property or common areas, nuisance either to neighbours or in the locality of the Let Property.')

  // ── 36. SMOKING ──────────────────────────────────────────────────────────
  sectionTitle(c, '36', 'SMOKING')
  txt(c, 'The Tenant agrees not to smoke, or to permit visitors to smoke tobacco, e-cigarettes, vaping devices or any other substance, in the Let Property, without the prior written consent of the Landlord. The Tenant will not smoke in stairwells or any other common parts.')

  // ── 37. ADDITIONAL TENANCY TERMS (TJ Property Consultants Ltd only) ──────
  if (data.includeSection37) {
    sectionTitle(c, '37', 'ADDITIONAL TENANCY TERMS')

    txt(c, 'a) Abandoned Goods', { font: bold })
    gap(c, 3)
    txt(c, 'The Tenant should ensure that all personal effects, furniture, furnishings and equipment or foodstuffs belonging to the Tenant or a member of the Tenant\'s household are removed from the Let Property prior to expiry of the tenancy. Any goods belonging to the Tenant which have not been removed after the tenancy has ceased shall be deemed to have been abandoned. The Landlord will make every effort to contact the Tenant using the forwarding details provided by the Tenant at the end of the tenancy and allow the Tenant a set time to uplift the goods. If the Tenant does not respond within the set time allowed and the goods remain unclaimed, the goods may be sold and the buyer will have legal title to them. The proceeds of any sale of the goods will be applied to any expenses for storing and selling the goods or towards any rent arrears or other costs incurred by any breach under the tenancy.')
    gap(c, 6)

    txt(c, 'b) Late Rent Payments', { font: bold })
    gap(c, 3)
    txt(c, 'The Landlord will be entitled to pursue the Tenant for any reasonable costs incurred as a result of the Tenant\'s failure to pay rent on time.')
    gap(c, 6)

    txt(c, 'c) Condensation', { font: bold })
    gap(c, 3)
    txt(c, 'The Tenant undertakes to take all reasonable steps to adequately heat and ventilate the Let Property in order to help prevent condensation. In the event of condensation occurring in the Let Property, the Tenant undertakes to wipe down and clean surfaces as required from time to time to prevent the build up of mould or damage to the Let Property or the fixtures and fittings included in the tenancy.')
    gap(c, 6)

    txt(c, 'd) Replacement Keys / Locked Out of Property', { font: bold })
    gap(c, 3)
    txt(c, 'If the Tenant loses keys for the Let Property, or fails to return the keys at the end of the Agreement, the Tenant will be required to meet the reasonable costs of replacing the keys and changing the locks. If the Tenant locks themselves out of the property outside of office hours and contacts the Out of Office Emergency Service for assistance, a call out charge will be payable by the Tenant. Alternatively, for a standard lockout, the Tenant will be liable to pay £60 plus the cost of any lost or replacement keys.')
    gap(c, 6)

    txt(c, 'e) Data Sharing', { font: bold })
    gap(c, 3)
    txt(c, 'The Landlord and Agent may share details about the performance of obligations under this Agreement by the Landlord and Tenant, past, present and future known addresses of the parties, with each other, with credit and reference providers for referencing purposes and rental decisions, with utility and water companies, local authority council tax and state benefit departments, mortgage lenders, to help prevent dishonesty, for administrative and accounting purposes, or for occasional debt tracing and fraud prevention.')
    gap(c, 6)

    txt(c, 'f) Property Inspections', { font: bold })
    gap(c, 3)
    txt(c, 'The Landlord will be entitled to carry out quarterly inspections of the Let Property. The Landlord will be required to advise the Tenant at least 48 hours in advance of such inspection.')
    gap(c, 6)

    txt(c, 'g) Remarketing Property', { font: bold })
    gap(c, 3)
    txt(c, 'During the twenty eight day notice period (if notice is given by the Tenant) or during the twenty eight days prior to termination (if notice is given by the Landlord) the Landlord will be entitled to access to the property to show prospective tenants or purchasers the Let Property by prior arrangement with the Tenant.')
    gap(c, 6)

    txt(c, 'h) Professional Cleaning at End of Tenancy', { font: bold })
    gap(c, 3)
    txt(c, 'Professional cleaning is required at the end of the tenancy. The Landlord will appoint the cleaners and the Tenant will pay the invoice in full. The cost of professional cleaning will be deducted from the deposit if not paid directly by the Tenant.')
    gap(c, 6)

    txt(c, 'i) Deposit Not to be Used as Rent', { font: bold })
    gap(c, 3)
    txt(c, 'The deposit is strictly not to be used as payment for the last month\'s rent or any other rental period whilst the tenancy is ongoing or during the notice period. Any attempt to do so shall be treated as a breach of this Agreement.')
    gap(c, 6)

    txt(c, 'j) Reporting of Damage, Defects and Accidents', { font: bold })
    gap(c, 3)
    txt(c, 'The Tenant must notify the Landlord in writing within 24 hours of discovering any damage, accident, defect or disrepair to the Let Property, its fixtures, fittings or installed systems. Failure to report promptly, resulting in deterioration of the property or increased repair costs, shall render the Tenant liable for the additional costs attributable to the delay.')
    gap(c, 6)

    txt(c, 'k) Parking', { font: bold })
    gap(c, 3)
    txt(c, data.parkingDescription
      ? `${data.parkingDescription} The Tenant must not use any associated parking areas without the prior written consent of the Landlord.`
      : 'No parking is included with this tenancy. The Tenant must not use any associated parking areas without the prior written consent of the Landlord.')
    gap(c, 6)

    txt(c, 'l) Boiler and Heating System', { font: bold })
    gap(c, 3)
    txt(c, 'The Tenant must not tamper with or adjust the boiler settings beyond normal day-to-day temperature control. Any failure of the heating system must be reported to the Landlord within 24 hours of discovery. During cold weather, the Tenant must maintain adequate background heating at all times to prevent frozen or burst pipes. Any damage caused by failure to maintain adequate heating shall be the Tenant\'s responsibility.')
    gap(c, 6)

    txt(c, 'm) Windows, Doors and Security', { font: bold })
    gap(c, 3)
    txt(c, 'The Tenant must ensure that all windows and external doors are locked and secured whenever the property is left unattended, including during short absences. The Tenant will be liable for any loss or damage arising from failure to properly secure the property.')
    gap(c, 6)

    txt(c, 'n) Mail and Post', { font: bold })
    gap(c, 3)
    txt(c, 'The Tenant must arrange to redirect all personal mail at the end of the tenancy and must not allow mail to accumulate at the Let Property or in the common stair after vacation. The Landlord accepts no responsibility for any mail received at the property after the tenancy has ended.')
    gap(c, 6)

    txt(c, 'o) Meter Readings', { font: bold })
    gap(c, 3)
    txt(c, 'The Tenant must take meter readings for all utilities (gas, electricity, water where applicable) on the day of entry and on the day of vacation and provide written copies to the Landlord or Agent within 48 hours of each reading being taken. This is to ensure accurate billing and to protect both parties at the end of the tenancy.')
    gap(c, 6)

    txt(c, 'p) Visitors and Overnight Guests', { font: bold })
    gap(c, 3)
    txt(c, 'No person may stay at the Let Property for more than 14 consecutive nights without the prior written consent of the Landlord. The Tenant is responsible for the behaviour of all visitors and overnight guests and shall be liable for any damage or breach of this Agreement caused by them.')
  }

  // ── 38. THE GUARANTOR ────────────────────────────────────────────────────
  sectionTitle(c, data.includeSection37 ? '38' : '37', 'THE GUARANTOR')
  txt(c, 'Not applicable to this tenancy.')

  // ── 39. DECLARATIONS ─────────────────────────────────────────────────────
  const declNum = data.includeSection37 ? '39' : '38'
  sectionTitle(c, declNum, 'DECLARATIONS')
  txt(c, `In signing this Agreement and taking entry to the Let Property, the Tenant confirms that he or she:`)
  gap(c, 4)
  bullet(c, 'has made full and true disclosure of all information sought by the Landlord or Letting Agent in connection with the granting of this tenancy')
  bullet(c, 'has not knowingly or carelessly made any false or misleading statements (whether written or oral) which might affect the Landlord\'s decision to grant the tenancy.')
  bullet(c, 'read and understood all of the terms of this Agreement including the accompanying legal commentary.')
  gap(c, 8)
  txt(c, 'Private residential tenancies are not subject to the Requirements of Writing (Scotland) Act 1995, so this Agreement can be \'signed\' by the Tenant(s) and Landlord(s) typing their names into the electronic document and sending it by email if all parties agree to this. A physical copy can be signed instead if this is preferred.')

  // ── SIGNATURES ────────────────────────────────────────────────────────────
  gap(c, 16)
  need(c, 24)
  txt(c, 'SIGNATURES', { font: bold, size: SZ_H1 })
  gap(c, 3)
  rule(c, 0.5)
  txt(c, 'By signing below, each party confirms they have read, understood and agree to be bound by the terms of this Private Residential Tenancy Agreement.')

  // Each tenant signature block
  for (let i = 0; i < data.tenants.length; i++) {
    const t   = data.tenants[i]
    const num = data.tenants.length > 1 ? ` ${i + 1}` : ''
    gap(c, 14)
    need(c, 90)
    txt(c, `Tenant${num} Signature`, { font: bold })
    gap(c, 4)
    txt(c, `Full Name (Block Capitals): ${t.fullName.toUpperCase()}`, { size: SZ_SMALL })
    if (t.currentAddress) txt(c, `Address: ${t.currentAddress}`, { size: SZ_SMALL })
    txt(c, `Email: ${t.email}`, { size: SZ_SMALL })
    gap(c, 8)
    const sy = c.y
    need(c, 50)
    cp(c).drawLine({ start: { x: MARGIN, y: sy - 14 }, end: { x: MARGIN + 240, y: sy - 14 }, thickness: 0.5, color: BLACK })
    cp(c).drawText('Signature (type full name for digital signing):', { x: MARGIN, y: sy - 26, size: SZ_SMALL, font: reg, color: GRAY })
    cp(c).drawLine({ start: { x: MARGIN, y: sy - 40 }, end: { x: MARGIN + 120, y: sy - 40 }, thickness: 0.5, color: BLACK })
    cp(c).drawText('Date:', { x: MARGIN, y: sy - 52, size: SZ_SMALL, font: reg, color: GRAY })
    c.y = sy - 60
  }

  // Landlord signature block
  gap(c, 14)
  need(c, 90)
  txt(c, 'Landlord Signature', { font: bold })
  gap(c, 4)
  txt(c, `Full Name (Block Capitals): ${data.landlordName.toUpperCase()}`, { size: SZ_SMALL })
  if (data.landlordAddress) txt(c, `Address: ${data.landlordAddress}`, { size: SZ_SMALL })
  if (data.landlordEmail)   txt(c, `Email: ${data.landlordEmail}`, { size: SZ_SMALL })
  gap(c, 8)
  const lsy = c.y
  need(c, 50)
  cp(c).drawLine({ start: { x: MARGIN, y: lsy - 14 }, end: { x: MARGIN + 240, y: lsy - 14 }, thickness: 0.5, color: BLACK })
  cp(c).drawText('Signature (type full name for digital signing):', { x: MARGIN, y: lsy - 26, size: SZ_SMALL, font: reg, color: GRAY })
  cp(c).drawLine({ start: { x: MARGIN, y: lsy - 40 }, end: { x: MARGIN + 120, y: lsy - 40 }, thickness: 0.5, color: BLACK })
  cp(c).drawText('Date:', { x: MARGIN, y: lsy - 52, size: SZ_SMALL, font: reg, color: GRAY })
  c.y = lsy - 60

  // ── Footers ───────────────────────────────────────────────────────────────
  const total = c.pages.length
  for (let i = 0; i < total; i++) {
    c.pages[i].drawText(
      `Scottish Government Model Private Residential Tenancy Agreement — April 2024 | ${data.landlordName} | ${data.propertyAddress}`,
      { x: MARGIN, y: MARGIN - 18, size: SZ_SMALL - 0.5, font: reg, color: GRAY }
    )
    c.pages[i].drawText(
      `Page ${i + 1} of ${total}   |   ${data.tenancyReference}`,
      { x: PAGE_W - MARGIN - 100, y: MARGIN - 18, size: SZ_SMALL - 0.5, font: reg, color: GRAY }
    )
  }

  return doc.save()
}
